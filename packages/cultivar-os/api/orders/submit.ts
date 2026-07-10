import { createClient } from '@supabase/supabase-js';
import { sendNotification } from '../../../shared/src/notifications/send';
import { findOrCreateCustomer } from '../../../shared/src/business-logic/customerUpsert';
import { callerHoldsPermission, callerIsBusinessOwner, resolveCallerUid } from '../../../shared/src/auth/callerPermission';
import { readPricingConfig } from '../../../shared/src/business-logic/financialDataAccess';
import { normalizeDiscountTypes, resolveTier, computeOrderPricing, type PricingLineInput } from '../../../shared/src/business-logic/tierPricing';
import { nettedQuantity, lineSubtotal } from '../../src/lib/netting';
import { ORDER_STATUSES } from '../../src/lib/orderStatus';

const TAX_RATE_FALLBACK = 0.0825; // only for a business row predating the tax_rate column
const LARGE_CONTAINERS = ['15 gal', '30 gal', '45 gal', '60 gal', '100 gal'];

// The permission that gates order EDIT / DELETE / STATUS. Mirrors cultivar roles.ts
// PERMISSIONS.MANAGE_ORDERS (owner + manager, NOT staff) — a string VALUE (AC-1), kept local so
// the api bundle doesn't pull the frontend role tree.
const MANAGE_ORDERS = 'manage_orders';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ── CRUD authority gate ────────────────────────────────────────────────────────
// Owner (by businesses.owner_id) OR a member holding manage_orders. Resolved from the caller's
// Bearer token (never the body), for the TARGET business (AC-3). The service key does the write
// AFTER this passes (MB_D-015 — write-authority proven independently of RLS-bypassing key).
async function callerCanManageOrders(authHeader: string | undefined, businessId: string): Promise<boolean> {
  if (await callerIsBusinessOwner(authHeader, businessId)) return true;
  return callerHoldsPermission(authHeader, businessId, MANAGE_ORDERS);
}

// Resolve a single order_item's server-authoritative sell_price + its inventory lot + container +
// display name, by its business_inventory_id anchor (the SOLE order-line anchor — D-34, the LOT is
// the SKU; the AC-1 vertical noun order_items.plant_id was dropped 20260709). Server-authoritative
// price (tamper defense), business_id-scoped (AC-3).
async function resolveItemForServer(
  db: ReturnType<typeof adminDb>,
  businessId: string,
  item: { business_inventory_id: string | null },
): Promise<{ sellPrice: number | null; inventoryId: string | null; container: string | null; name: string }> {
  if (item.business_inventory_id) {
    const { data } = await db
      .from('business_inventory')
      .select('sell_price, size, name')
      .eq('id', item.business_inventory_id)
      .eq('business_id', businessId)
      .maybeSingle();
    const r = data as { sell_price?: number | null; size?: string | null; name?: string | null } | null;
    return {
      sellPrice:   r?.sell_price ?? null,
      inventoryId: item.business_inventory_id,
      container:   r?.size ?? null,
      name:        r?.name ?? 'this item',
    };
  }
  return { sellPrice: null, inventoryId: null, container: null, name: 'this item' };
}

// Flip a set of inventory lots' status. Reservation is a coarse per-lot status flip (mirrors
// submit.ts §11) — release = 'available', reserve = 'reserved'. Null ids skipped.
async function setLotStatus(db: ReturnType<typeof adminDb>, businessId: string, lotIds: (string | null)[], status: 'available' | 'reserved'): Promise<void> {
  const ids = [...new Set(lotIds.filter((x): x is string => !!x))];
  for (const id of ids) {
    await db.from('business_inventory')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id).eq('business_id', businessId);
  }
}

// Derive the legacy transport_method value (backward compat: delivery routing query + history).
// Three-branch model: self → 'self'; a staff branch with planting attached (or a fused
// per-plant staff row) → 'install'; a plain staff delivery → 'delivery'.
function deriveTransportMethod(t: any, plantingSelected: boolean): string {
  if (t.transport_mode === 'self') return 'self';
  if (plantingSelected) return 'install';
  if (t.transport_mode === 'staff' && t.price_type === 'per_unit') return 'install'; // fused row
  return 'delivery';
}

function buildTransportNote(transportMode: string, nettingDeclined: boolean, nettingActive: boolean): string {
  if (transportMode !== 'self') return 'Staff transport';
  if (nettingActive && !nettingDeclined) return 'Customer self-transport — netting purchased';
  return 'Customer self-transport — netting declined, Texas TCC Ch.725 waiver acknowledged';
}

// ── DISPATCH ────────────────────────────────────────────────────────────────
// One endpoint, multiple actions (12-fn ceiling — CLAUDE.md §6 rule 11). action absent/'create'
// = the ORIGINAL checkout write (unchanged, anon-createable). 'update'/'delete'/'status' = the
// roster CRUD (owner/manager only, token-gated, server-recompute). No new api/ file (12/12 held).
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const action = req.body?.action ?? 'create';
  if (action === 'create') return handleCreate(req, res);
  if (action === 'update') return handleUpdate(req, res);
  if (action === 'delete') return handleDelete(req, res);
  if (action === 'status') return handleStatus(req, res);
  return res.status(400).json({ error: `Unknown action: ${action}` });
}

async function handleCreate(req: any, res: any) {
  const {
    customer,
    customerId: attachedCustomerIdRaw, // customer-first attach (way 1/4) — an EXISTING customer row id
    invokedTier: invokedTierRaw,       // order-scoped tier invoke (way 4) — a tier NAME, this order only
    lines,             // OrderLineInput[] — multi-item cart (each { plant, quantity })
    services,          // ServiceSelection[] — from the service_offerings model
    selectedTransport, // ServiceOffering | null — primary transport (delivery or self)
    plantingOffering,  // ServiceOffering | null — per-plant planting (Delivery + planting branch)
    plantingSelected,  // boolean — whether planting is attached
    nettingDeclined,
    serviceQuantities, // Record<offeringId, number> — owner-confirmed netted quantities
    serviceOverrides,  // Record<offeringId, {amount,reason}> — owner/manager PRICE overrides
    deliveryDate,      // string 'YYYY-MM-DD' | null — owner/manager-entered delivery date
  } = req.body;
  const businessId: string = req.body.businessId || lines?.[0]?.plant?.business_id;

  if (!customer || !Array.isArray(lines) || lines.length === 0 || !businessId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Total items across the cart — the denominator for a per-unit (e.g. per-plant) service.
  const itemCount = lines.reduce((s: number, l: any) => s + Number(l.quantity || 0), 0);
  if (itemCount <= 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = adminDb();

  try {
    // ── 0. Caller authority (owner/manager) — resolved ONCE from the Bearer token (NEVER the
    // body) for the TARGET business (AC-3). Needed for BOTH the order-scoped tier invoke (way 4)
    // AND price overrides (attributed leakage). Only resolved when a privileged act is requested;
    // the anon checkout path has no token → callerManages stays false → nothing privileged applies.
    const authHeader = req.headers?.authorization;
    const attachedCustomerId: string | null =
      typeof attachedCustomerIdRaw === 'string' && attachedCustomerIdRaw.trim() ? attachedCustomerIdRaw.trim() : null;
    const invokedTierName: string | null =
      typeof invokedTierRaw === 'string' && invokedTierRaw.trim() ? invokedTierRaw.trim() : null;
    const overridesIn: Record<string, { amount: number; reason: string }> =
      (serviceOverrides && typeof serviceOverrides === 'object') ? serviceOverrides : {};
    const hasOverrides = Object.keys(overridesIn).length > 0;
    let callerManages = false;
    let overrideBy: string | null = null;
    if (invokedTierName || hasOverrides) {
      callerManages = await callerCanManageOrders(authHeader, businessId);
      if (callerManages) overrideBy = await resolveCallerUid(authHeader);
    }

    // ── 1. Resolve the customer ─────────────────────────────────────────────
    // Customer-first attach (ways 1 & 4): when the order carries an explicit customerId, use THAT
    // existing row directly — do NOT re-run typed-field dedup (which could mint a tier-less
    // duplicate; the finding-D class). AC-3: the id MUST belong to this business — a cross-tenant
    // id is never trusted; it falls back to find-or-create. No attached id → dedup as before
    // (unchanged anon QR path + way-4 NEW customers, which submit creates here).
    let customerId: string;
    if (attachedCustomerId) {
      const { data: attachedRow } = await db
        .from('customers').select('id').eq('id', attachedCustomerId).eq('business_id', businessId).maybeSingle();
      if ((attachedRow as any)?.id) {
        customerId = (attachedRow as any).id;
        console.log('[TRACE:lookup] order using ATTACHED customer (dedup skipped)', { customerId, businessId });
      } else {
        console.log('[TRACE:lookup] attached customer not in this business — find-or-create (AC-3)', { attachedCustomerId, businessId });
        ({ customerId } = await findOrCreateCustomer(db, businessId, customer, 'qr-scan'));
      }
    } else {
      ({ customerId } = await findOrCreateCustomer(db, businessId, customer, 'qr-scan'));
    }

    // ── 2. Tax rate + price tier (business-level, read once) ────────────────
    const { data: bizTaxRow } = await db
      .from('businesses').select('tax_rate').eq('id', businessId).maybeSingle();
    const taxRate = Number((bizTaxRow as any)?.tax_rate ?? TAX_RATE_FALLBACK);

    // PRICE TIER at checkout (D-35 + the generalized TYPES×TIERS model, 2026-07-10) — READ + APPLIED
    // SERVER-SIDE (tamper defense — the client supplies neither the tier nor the config). The customer's
    // stored price_tier NAME resolves against the owner-configured discount types to a tier + BASIS:
    //   • retail_minus_percent → % off the stored server-authoritative sell_price.
    //   • at_cost              → the server-read unit_cost (money-safety — cost NEVER from the client;
    //                            with graceful degradation to retail if no cost is on file, below).
    // Config-less business / retail / unknown tier → retail floor → price unchanged.
    const { data: custRow } = await db
      .from('customers').select('price_tier').eq('id', customerId).maybeSingle();
    const storedTier = (custRow as any)?.price_tier ?? null;

    // Order-scoped tier INVOKE (way 4): a tier NAME chosen for THIS order only. Honored ONLY on a
    // token-verified owner/manager path (tamper defense — an anon/staff caller's invoke is ignored,
    // the stored tier governs). NOT persisted to the customer (that's the /customers roster path).
    let tierNameForOrder: string | null = storedTier;
    if (invokedTierName) {
      if (callerManages) {
        tierNameForOrder = invokedTierName;
        console.log('[TRACE:PRICE] order-scoped tier invoke HONORED (owner/manager, token-verified)', {
          invokedTier: invokedTierName, storedTier, by: overrideBy, businessId,
        });
      } else {
        console.log('[TRACE:PRICE] order-scoped tier invoke IGNORED — caller not owner/manager (tamper defense)', {
          invokedTier: invokedTierName, businessId,
        });
      }
    }

    const { data: pricingCfg } = await readPricingConfig(db, businessId);
    const discountTypes = normalizeDiscountTypes(pricingCfg?.config);
    const resolvedTier = resolveTier(tierNameForOrder, discountTypes);
    const degradedItems: string[] = []; // at_cost lines with no cost on file → charged at retail (D-9)
    console.log('[TRACE:PRICE] price_tier resolved (order-level)', {
      customerId, storedTier, invokedTier: invokedTierName, invokeHonored: !!invokedTierName && callerManages,
      resolvedName: resolvedTier.name, basis: resolvedTier.basis,
      discountPercent: resolvedTier.discountPercent, accessTerms: resolvedTier.accessTerms ?? null,
    });

    // ── 3. Resolve + validate each cart line (server-authoritative sell_price per anchor) ──
    // D-34: two anchor lanes — a stock line (plant.stock_line_id set → read business_inventory
    // by that id) or a specimen (join cultivar_plants → its lot). Exactly one lane per line.
    // D-35: charge business_inventory.sell_price (retail), NEVER unit_cost. Server-authoritative;
    // the client-POSTed price is never trusted for the charge (tamper defense, per line).
    // Collect each cart line's raw GOODS pricing input (server-authoritative sell_price + cost).
    // The tier is APPLIED once, below, via the shared computeOrderPricing (D-39 — the same fn the
    // Review runs → Review === submit === QBO). This loop validates, refuses unpriced lines, and
    // defeats client price tampering; it no longer computes the net per line.
    const resolvedLines: Array<{ plant: any; quantity: number; stockLineId: string | null; unitPrice: number; subtotal: number }> = [];
    const goodsInputs: PricingLineInput[] = [];
    let anyLargeContainer = false;

    for (const line of lines) {
      const plant = line.plant;
      const quantity = Number(line.quantity);
      const stockLineId: string | null = plant.stock_line_id ?? null;
      let serverSellPriceRaw: number | null | undefined;
      let serverUnitCost: number | null | undefined; // server-read cost (at_cost basis only; NEVER client)
      let stockLineSize: string | null = null;

      if (stockLineId) {
        const { data: invRow } = await db
          .from('business_inventory')
          .select('sell_price, unit_cost, size, status')
          .eq('id', stockLineId)
          .eq('business_id', businessId)
          .single();
        serverSellPriceRaw = (invRow as any)?.sell_price;
        serverUnitCost     = (invRow as any)?.unit_cost;
        stockLineSize      = (invRow as any)?.size ?? null;
        console.log('[TRACE:RESOLVE] order anchor — business_inventory (stock line)', { stockLineId });
      } else {
        const { data: invRow } = await db
          .from('cultivar_plants')
          .select('business_inventory ( sell_price, unit_cost )')
          .eq('id', plant.id)
          .eq('business_id', businessId)
          .single();
        serverSellPriceRaw = (invRow as any)?.business_inventory?.sell_price;
        serverUnitCost     = (invRow as any)?.business_inventory?.unit_cost;
        console.log('[TRACE:RESOLVE] order anchor — cultivar_plants (specimen)', { plantId: plant.id });
      }

      const serverSellPrice   = Number(serverSellPriceRaw ?? 0);
      const clientClaimedPrice = Number(plant.business_inventory?.sell_price ?? 0);
      if (clientClaimedPrice !== serverSellPrice) {
        console.log('[TRACE:PRICE] sell_price mismatch — charging SERVER value (tamper defeated)', {
          plantId: plant.id, clientClaimedPrice, serverSellPrice,
        });
      }

      // ── $0/NULL REFUSAL (Surface Honesty, D-9) — refuse the whole order if ANY line is
      // unpriced rather than silently writing a $0 line. Names the offending item.
      if (serverSellPriceRaw == null || serverSellPrice <= 0) {
        const itemName = plant.common_name ?? plant.species ?? 'this item';
        console.log('[TRACE:PRICE] REFUSED — no sell_price set, sale blocked (no $0 order written)', {
          plantId: plant.id, itemName, serverSellPriceRaw,
        });
        return res.status(400).json({
          error: `No sale price set for ${itemName} — set a price in Inventory before selling.`,
          code: 'NO_SELL_PRICE',
        });
      }

      // D-34: for a stock-line order the container is the lot's size (server-fetched).
      const container = stockLineId ? (stockLineSize ?? plant.current_container) : plant.current_container;
      if (LARGE_CONTAINERS.includes(container)) anyLargeContainer = true;

      // GOODS line for the shared computation — the tier is applied there, once (D-39). The net
      // unitPrice/subtotal are written back onto resolvedLines after computeOrderPricing, below.
      goodsInputs.push({
        kind: 'goods',
        name: plant.common_name ?? plant.species ?? 'this item',
        unitPrice: serverSellPrice, qty: quantity, unitCost: serverUnitCost,
      });
      resolvedLines.push({ plant, quantity, stockLineId, unitPrice: 0, subtotal: 0 }); // net filled after compute
    }

    // ── 4. Service amounts (attach-rule netting over the WHOLE cart) ─────────
    // qtyFor honors the owner-confirmed netted quantity (serviceQuantities), else applies
    // the rule (per_unit ? itemCount : 1). Same rule the client showed — display & charge agree.
    const transportMode = selectedTransport?.transport_mode ?? 'self';
    const qtyFor = (o: any): number => {
      const override = serviceQuantities?.[o.id];
      if (typeof override === 'number' && override > 0) return override;
      return nettedQuantity(o, itemCount);
    };

    // ── PRICE-OVERRIDE authority (attributed leakage) ───────────────────────
    // An override is a privileged owner/manager act. It is HONORED only when the CALLER is the
    // token-verified owner/manager for THIS business (resolved once in §0 as callerManages;
    // never a client-posted flag). The public (anon) checkout path has no token → overrides
    // ignored, baseline charged (tamper defense). overrideBy (§0) attributes the leakage.
    if (hasOverrides && !callerManages) {
      console.log('[TRACE:PRICE] price override IGNORED — caller not owner/manager (tamper defense)', {
        businessId, count: Object.keys(overridesIn).length,
      });
    }
    const honored = (hasOverrides && callerManages) ? overridesIn : {};

    type SvcResult = { amount: number; isOverride: boolean; original: number | null; leakage: number | null; reason: string | null };
    const applyOverride = (offeringId: string, computed: number): SvcResult => {
      const ov = honored[offeringId];
      if (ov && typeof ov.amount === 'number' && ov.amount >= 0) {
        const amt  = round2(ov.amount);
        const leak = round2(computed - amt);
        console.log('[TRACE:LEAKAGE] price override honored', {
          offeringId, baseline: round2(computed), override: amt, leakage: leak, overrideBy, reason: ov.reason ?? null,
        });
        return { amount: amt, isOverride: true, original: round2(computed), leakage: leak, reason: (ov.reason ?? '').trim() || null };
      }
      return { amount: computed, isOverride: false, original: null, leakage: null, reason: null };
    };

    const transportComputed = selectedTransport ? lineSubtotal(selectedTransport, qtyFor(selectedTransport)) : 0;
    const transportRes      = selectedTransport ? applyOverride(selectedTransport.id, transportComputed) : null;
    const transportAmount   = transportRes?.amount ?? 0;

    // Planting — the SEPARATE per-plant service the "Delivery + planting" branch attaches
    // (delivery flat ×1 + planting per_unit ×N). Distinct from transport so both are charged.
    const plantingActive   = !!(plantingSelected && plantingOffering);
    const plantingQty      = plantingActive ? qtyFor(plantingOffering) : 0;
    const plantingComputed = plantingActive ? lineSubtotal(plantingOffering, plantingQty) : 0;
    const plantingRes      = plantingActive ? applyOverride(plantingOffering.id, plantingComputed) : null;
    const plantingAmount   = plantingRes?.amount ?? 0;

    const nettingSelection = (services ?? []).find(
      (s: any) => s.offering?.trigger_transport_mode === 'self' && s.offering?.category === 'addon',
    );
    const nettingActive    = transportMode === 'self' && (nettingSelection?.selected ?? false) && !nettingDeclined;
    const nettingUnitPrice = nettingSelection?.offering?.price ?? 0; // H7: no tenant $10 fallback
    const nettingQty       = nettingActive && nettingSelection ? qtyFor(nettingSelection.offering) : 0;
    const nettingComputed  = nettingActive && nettingSelection ? lineSubtotal(nettingSelection.offering, nettingQty) : 0;
    const nettingRes       = nettingActive && nettingSelection ? applyOverride(nettingSelection.offering.id, nettingComputed) : null;
    const nettingTotal     = nettingRes?.amount ?? 0;

    const otherAddons = (services ?? []).filter(
      (s: any) => s.selected && s.offering?.category === 'addon' && !s.offering?.trigger_transport_mode,
    );
    const otherResults = otherAddons.map((s: any) => ({
      offering: s.offering,
      res: applyOverride(s.offering.id, lineSubtotal(s.offering, qtyFor(s.offering))),
    }));
    const otherTotal = otherResults.reduce((sum: number, x: any) => sum + x.res.amount, 0);

    // Override columns for a selection row (only when honored). override_by = the acting user's
    // auth.uid (server-resolved). Gated migration 20260708 adds these columns — insert falls back
    // without them if absent (deploy-window-safe, below).
    const overrideCols = (res: SvcResult | null): Record<string, unknown> =>
      res?.isOverride
        ? { is_manual_override: true, original_price: res.original, price_leakage: res.leakage, override_by: overrideBy, override_reason: res.reason }
        : {};

    console.log('[TRACE:CART] netting applied (server)', {
      itemCount, transportQty: selectedTransport ? qtyFor(selectedTransport) : 0,
      transportAmount, plantingActive, plantingQty, plantingAmount, nettingQty, nettingTotal, otherTotal,
      overridesHonored: Object.keys(honored).length,
    });

    const addonsAmount = transportAmount + plantingAmount + nettingTotal + otherTotal;

    // ── D-39: ONE pricing computation (the SAME shared fn the Review runs) ───────────────
    // Goods lines get the tier; SERVICE/LABOR lines pass through (an owner override is fed as
    // overrideTotal — attributed leakage, never a tier discount); tax on the DISCOUNTED subtotal.
    // Because the Review and this authoritative path both call computeOrderPricing over the same
    // inputs, Review === submit === QBO — closing the Review-vs-QBO price divergence.
    const serviceInputs: PricingLineInput[] = [];
    if (selectedTransport) serviceInputs.push({ kind: 'service', name: selectedTransport.name, unitPrice: Number(selectedTransport.price), qty: qtyFor(selectedTransport), overrideTotal: transportRes?.isOverride ? transportAmount : null });
    if (plantingActive && plantingOffering) serviceInputs.push({ kind: 'service', name: plantingOffering.name, unitPrice: Number(plantingOffering.price), qty: plantingQty, overrideTotal: plantingRes?.isOverride ? plantingAmount : null });
    if (nettingActive && nettingSelection?.offering) serviceInputs.push({ kind: 'service', name: nettingSelection.offering.name, unitPrice: Number(nettingUnitPrice), qty: nettingQty, overrideTotal: nettingRes?.isOverride ? nettingTotal : null });
    for (const x of otherResults) serviceInputs.push({ kind: 'service', name: x.offering.name, unitPrice: Number(x.offering.price), qty: qtyFor(x.offering), overrideTotal: x.res.isOverride ? x.res.amount : null });

    const pricing = computeOrderPricing([...goodsInputs, ...serviceInputs], resolvedTier, taxRate);
    // Write each goods line's tier-priced net back onto resolvedLines (same order) → order_items.
    const goodsPriced = pricing.lines.filter(p => p.kind === 'goods');
    resolvedLines.forEach((rl, i) => { rl.unitPrice = goodsPriced[i].netUnit; rl.subtotal = goodsPriced[i].netTotal; });
    for (const gp of goodsPriced) if (gp.degraded) degradedItems.push(gp.name);
    const subtotal  = pricing.discountedSubtotal;
    const taxAmount = pricing.tax;
    const total     = pricing.total;

    // Graceful-degradation surface (D-9) — an at_cost tier with NO cost on file was charged at
    // RETAIL (never $0). Honest order-level note (returned to the client + logged), not a silent mismatch.
    const pricingNotes: string[] = degradedItems.length
      ? [`At-cost pricing could not apply to ${degradedItems.length} line(s) with no cost on file — charged at retail instead: ${degradedItems.join(', ')}. Set a unit cost in Inventory to enable at-cost pricing.`]
      : [];

    console.log('[TRACE:PRICE] order priced (computeOrderPricing)', {
      tier: resolvedTier.name, basis: resolvedTier.basis, discountPercent: resolvedTier.discountPercent,
      lines: pricing.lines.map(p => ({ kind: p.kind, name: p.name, retailUnit: p.retailUnit, qty: p.qty, retailTotal: p.retailTotal, discountPct: p.discountPct, discountAmt: p.discountAmt, netTotal: p.netTotal })),
      goodsRetailSubtotal: pricing.goodsRetailSubtotal, discountTotal: pricing.discountTotal,
      discountedSubtotal: subtotal, tax: taxAmount, total, degraded: degradedItems,
    });

    // ── 5. Leakage flag (a large-container line went out with no add-on) ────
    const leakageFlag = anyLargeContainer && (nettingTotal + otherTotal) === 0;

    // ── 6. Transport metadata + invoice number ─────────────────────────────
    const transportMethod = deriveTransportMethod(selectedTransport ?? { transport_mode: 'self', price_type: 'flat' }, plantingActive);
    const transportNote   = buildTransportNote(transportMode, nettingDeclined, nettingActive);
    // [TRACE:PRICE] the decline capture — a self-transport netting decline is registered on the
    // order (netting_declined) AND in the immutable order_compliance_records log below.
    if (transportMode === 'self') {
      console.log('[TRACE:PRICE] netting decision (self-transport)', {
        nettingActive, nettingDeclined, note: transportNote,
      });
    }

    const now  = new Date();
    const dp   = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq  = String(now.getMinutes() * 60 + now.getSeconds()).padStart(3, '0');
    const invoiceNumber = `CLV-${dp}-${seq}`;

    // ── 7. Create order ────────────────────────────────────────────────────
    const orderBase: Record<string, unknown> = {
      business_id:      businessId,
      customer_id:      customerId,
      transport_method: transportMethod,   // backward compat for delivery routing
      transport_note:   transportNote,
      netting_declined: nettingDeclined,
      subtotal,
      tax_amount:       taxAmount,
      total_amount:     total,
      addons_amount:    addonsAmount,
      leakage_flag:     leakageFlag,
      notes:            invoiceNumber,
      status:           'pending',
    };
    // Owner/manager-entered delivery date. GATED migration 20260708_orders_delivery_date.sql
    // adds orders.delivery_date; until it applies, an insert carrying the column 42703's — so we
    // insert WITH the date and, on a missing-column error, retry WITHOUT it (deploy-window-safe;
    // the order still lands, the date is dropped and re-enabled once the column exists).
    const deliveryDateVal: string | null =
      typeof deliveryDate === 'string' && deliveryDate.trim() ? deliveryDate.trim() : null;

    let order: any;
    let orderErr: any;
    ({ data: order, error: orderErr } = await db
      .from('orders')
      .insert(deliveryDateVal ? { ...orderBase, delivery_date: deliveryDateVal } : orderBase)
      .select('id')
      .single());

    // Missing-column fallback (42703 = undefined_column; PGRST204 = schema-cache miss).
    if (orderErr && deliveryDateVal && (orderErr.code === '42703' || orderErr.code === 'PGRST204')) {
      console.log('[TRACE:DELIVERY] orders.delivery_date column absent — retrying without it (migration pending)', {
        code: orderErr.code, deliveryDate: deliveryDateVal,
      });
      ({ data: order, error: orderErr } = await db
        .from('orders')
        .insert(orderBase)
        .select('id')
        .single());
    } else if (!orderErr && deliveryDateVal) {
      console.log('[TRACE:DELIVERY] order created with delivery_date', { deliveryDate: deliveryDateVal });
    }

    if (orderErr) throw new Error(`Order: ${orderErr.message}`);
    const orderId = order!.id;

    // ── 8. Order items — ONE row per cart line, anchored to its business_inventory lot ──
    // D-34: the LOT is the SKU → every line anchors to business_inventory_id (the sole anchor;
    // the AC-1 vertical noun order_items.plant_id was dropped 20260709). A stock line anchors to
    // its own id; a specimen anchors to its lot (cultivar_plants.inventory_id, carried on the
    // cart plant object). Money/qty unchanged — only the line's NAME anchor.
    const itemRows = resolvedLines.map((rl) => {
      const row: Record<string, unknown> = {
        order_id:   orderId,
        quantity:   rl.quantity,
        unit_price: rl.unitPrice,   // server-authoritative sell_price (D-35)
        subtotal:   rl.subtotal,
        business_inventory_id: rl.stockLineId ?? rl.plant.inventory_id ?? null,
      };
      return row;
    });
    console.log('[TRACE:RESOLVE] order_items anchors', {
      count: itemRows.length,
      anchors: resolvedLines.map(rl => `inv:${rl.stockLineId ?? rl.plant.inventory_id ?? 'none'}`),
    });
    const { error: itemErr } = await db.from('order_items').insert(itemRows);
    if (itemErr) throw new Error(`Order item: ${itemErr.message}`);

    // ── 9. Order service selections (attach-rule netted quantities + override leakage) ──
    const selectionRows: any[] = [];

    if (selectedTransport) {
      selectionRows.push({
        order_id:              orderId,
        service_offering_id:   selectedTransport.id,
        quantity:              qtyFor(selectedTransport),
        unit_price_at_time:    selectedTransport.price,
        subtotal:              transportAmount,
        ...overrideCols(transportRes),
      });
    }

    // Planting is its OWN selection row (per-plant, netted ×N) — one order, two service lines
    // (delivery ×1 + planting ×N) for the "Delivery + planting" branch.
    if (plantingActive && plantingOffering?.id) {
      selectionRows.push({
        order_id:              orderId,
        service_offering_id:   plantingOffering.id,
        quantity:              plantingQty,
        unit_price_at_time:    plantingOffering.price,
        subtotal:              plantingAmount,
        ...overrideCols(plantingRes),
      });
    }

    if (nettingActive && nettingSelection?.offering?.id) {
      selectionRows.push({
        order_id:              orderId,
        service_offering_id:   nettingSelection.offering.id,
        quantity:              nettingQty,
        unit_price_at_time:    nettingUnitPrice,
        subtotal:              nettingTotal,
        ...overrideCols(nettingRes),
      });
    }

    for (const x of otherResults) {
      selectionRows.push({
        order_id:              orderId,
        service_offering_id:   x.offering.id,
        quantity:              qtyFor(x.offering),
        unit_price_at_time:    x.offering.price,
        subtotal:              x.res.amount,
        ...overrideCols(x.res),
      });
    }

    if (selectionRows.length > 0) {
      // Override columns are gated (20260708). Insert WITH them; on a missing-column error,
      // strip the override fields and retry (deploy-window-safe — the order still lands, the
      // give-away is dropped and re-enabled once the columns exist).
      const OVERRIDE_KEYS = ['is_manual_override', 'original_price', 'price_leakage', 'override_by', 'override_reason'];
      let selErr: any;
      ({ error: selErr } = await db.from('order_service_selections').insert(selectionRows));
      if (selErr && (selErr.code === '42703' || selErr.code === 'PGRST204')) {
        console.log('[TRACE:LEAKAGE] override columns absent — retrying selections without them (migration pending)', { code: selErr.code });
        const stripped = selectionRows.map((r) => {
          const c = { ...r };
          for (const k of OVERRIDE_KEYS) delete c[k];
          return c;
        });
        ({ error: selErr } = await db.from('order_service_selections').insert(stripped));
      }
      if (selErr) throw new Error(`Service selections: ${selErr.message}`);
    }

    // ── 10. Compliance audit records ───────────────────────────────────────
    // Immutable log: any service offering with a compliance notice gets a record
    // regardless of whether the customer accepted or declined.
    const complianceRows: any[] = [];
    for (const s of (services ?? [])) {
      const o = s.offering;
      if (!o?.compliance_title) continue;
      const isNettingOffering = o.trigger_transport_mode === 'self' && o.category === 'addon';
      const accepted = isNettingOffering ? nettingActive : s.selected;
      complianceRows.push({
        order_id:               orderId,
        service_offering_id:    o.id,
        business_id:            businessId,
        compliance_title_shown: o.compliance_title,
        compliance_body_shown:  o.compliance_body ?? null,
        decision:               accepted ? 'accepted' : 'declined',
      });
    }
    if (complianceRows.length > 0) {
      await db.from('order_compliance_records').insert(complianceRows);
    }

    // ── 11. Reserve each line's inventory lot ──────────────────────────────
    // Stock state lives on business_inventory. Skip a line whose inventory_id is null.
    for (const rl of resolvedLines) {
      if (rl.plant.inventory_id) {
        await db
          .from('business_inventory')
          .update({ status: 'reserved', updated_at: new Date().toISOString() })
          .eq('id', rl.plant.inventory_id);
      }
    }

    // ── 12. Leakage alert to business owner (fire-and-forget) ──────────────
    if (leakageFlag) {
      const { data: biz } = await db
        .from('businesses')
        .select('phone, email')
        .eq('id', businessId)
        .single();

      if (biz?.phone || biz?.email) {
        const firstPlant = resolvedLines[0]?.plant;
        const plantLabel = resolvedLines.length === 1
          ? (firstPlant?.common_name ?? firstPlant?.species)
          : `${firstPlant?.common_name ?? firstPlant?.species} +${resolvedLines.length - 1} more`;
        sendNotification({
          vertical:   'cultivar',
          templateId: 'owner_leakage_alert',
          entityId:   orderId,
          channel:    'sms',
          to: {
            phone:     biz.phone  ?? undefined,
            email:     biz.email  ?? undefined,
            smsOptIn:  true,
          },
          data: {
            customerName:  `${customer.first_name} ${customer.last_name}`.trim(),
            plantName:     plantLabel,
            container:     firstPlant?.current_container,
            invoiceNumber,
            quantity:      itemCount,
          },
        }).catch((err: any) => console.error('[leakage-alert]', err.message));
      }
    }

    res.json({ orderId, invoiceNumber, total, subtotal, taxAmount, pricingNotes });

  } catch (err: any) {
    console.error('[orders/submit]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ── UPDATE ──────────────────────────────────────────────────────────────────
// Edit a SUBMITTED order: per-line quantities, line removals, delivery date. RE-RESERVES
// inventory (release the old lot set, reserve the new) and RECOMPUTES totals server-authoritatively
// (re-reads sell_price per line, re-nets services over the new plant count) — an edit is not a
// blind row poke. Owner/manager only. Flags QB-invoice staleness (does not silently mismatch).
async function handleUpdate(req: any, res: any) {
  const { orderId, businessId, quantities, removedItemIds, deliveryDate } = req.body || {};
  if (!orderId || !businessId) return res.status(400).json({ error: 'Missing orderId or businessId' });

  if (!(await callerCanManageOrders(req.headers?.authorization, businessId))) {
    console.log('[TRACE:ROSTER] update REFUSED — caller lacks manage_orders/owner', { orderId, businessId });
    return res.status(403).json({ error: 'Not authorized to edit orders', code: 'FORBIDDEN' });
  }

  const db = adminDb();
  try {
    // Order must belong to this business (AC-3).
    const { data: order } = await db
      .from('orders').select('id, business_id').eq('id', orderId).eq('business_id', businessId).maybeSingle();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { data: itemsRaw } = await db
      .from('order_items')
      .select('id, quantity, business_inventory_id')
      .eq('order_id', orderId);
    const items = (itemsRaw ?? []) as Array<{ id: string; quantity: number; business_inventory_id: string | null }>;
    if (items.length === 0) return res.status(400).json({ error: 'Order has no line items' });

    const removed = new Set<string>(Array.isArray(removedItemIds) ? removedItemIds : []);
    const qtyOverride: Record<string, number> = (quantities && typeof quantities === 'object') ? quantities : {};

    // Resolve EVERY current line (for the old lot set + kept-line pricing).
    const resolvedAll = await Promise.all(items.map(async (it) => ({
      item: it,
      keep: !removed.has(it.id),
      newQty: Math.max(0, Number(qtyOverride[it.id] ?? it.quantity)),
      r: await resolveItemForServer(db, businessId, it),
    })));

    const kept = resolvedAll.filter(x => x.keep && x.newQty > 0);
    if (kept.length === 0) {
      return res.status(400).json({ error: 'An order must keep at least one line — delete the order instead.', code: 'EMPTY_ORDER' });
    }

    // Server-authoritative sell_price per kept line; refuse the whole edit if any is unpriced (D-9).
    let linesSubtotal = 0;
    let anyLargeContainer = false;
    for (const k of kept) {
      if (k.r.sellPrice == null || k.r.sellPrice <= 0) {
        return res.status(400).json({ error: `No sale price set for ${k.r.name} — set a price in Inventory before selling.`, code: 'NO_SELL_PRICE' });
      }
      linesSubtotal += k.r.sellPrice * k.newQty;
      if (k.r.container && LARGE_CONTAINERS.includes(k.r.container)) anyLargeContainer = true;
    }
    const itemCount = kept.reduce((s, k) => s + k.newQty, 0);

    // Re-net service selections over the NEW plant count (transport flat ×1 / planting·netting per_unit ×N).
    const { data: selsRaw } = await db
      .from('order_service_selections')
      .select('id, service_offering_id, unit_price_at_time')
      .eq('order_id', orderId);
    const sels = (selsRaw ?? []) as Array<{ id: string; service_offering_id: string; unit_price_at_time: number }>;
    const offeringIds = [...new Set(sels.map(s => s.service_offering_id).filter(Boolean))];
    let offerings: Array<{ id: string; price: number; price_type: string; category: string }> = [];
    if (offeringIds.length > 0) {
      const { data: offRaw } = await db
        .from('service_offerings').select('id, price, price_type, category')
        .in('id', offeringIds).eq('business_id', businessId);
      offerings = (offRaw ?? []) as typeof offerings;
    }
    const offById = new Map(offerings.map(o => [o.id, o]));

    let addonsAmount = 0;
    let addonCategoryTotal = 0;
    const selectionUpdates: Array<{ id: string; quantity: number; subtotal: number }> = [];
    for (const s of sels) {
      const o = offById.get(s.service_offering_id);
      if (!o) continue; // offering gone — leave the historical selection untouched
      const q   = nettedQuantity(o as any, itemCount);
      const sub = lineSubtotal(o as any, q);
      addonsAmount += sub;
      if (o.category === 'addon') addonCategoryTotal += sub;
      selectionUpdates.push({ id: s.id, quantity: q, subtotal: sub });
    }

    const subtotal    = round2(linesSubtotal + addonsAmount);
    const { data: bizTaxRow } = await db.from('businesses').select('tax_rate').eq('id', businessId).maybeSingle();
    const taxRate     = Number((bizTaxRow as any)?.tax_rate ?? TAX_RATE_FALLBACK);
    const taxAmount   = round2(subtotal * taxRate);
    const total       = round2(subtotal + taxAmount);
    const leakageFlag = anyLargeContainer && addonCategoryTotal === 0;

    // ── Re-reserve: release ALL old lots, reserve the KEPT lots (removed lines' lots go free) ──
    await setLotStatus(db, businessId, resolvedAll.map(x => x.r.inventoryId), 'available');
    await setLotStatus(db, businessId, kept.map(k => k.r.inventoryId), 'reserved');
    console.log('[TRACE:PRICE] order edit — re-reserved + recomputed', {
      orderId, itemCount, linesSubtotal: round2(linesSubtotal), addonsAmount: round2(addonsAmount),
      subtotal, taxAmount, total, leakageFlag, removed: [...removed],
    });

    // ── Writes: line qtys, removals, service re-net, order totals + delivery date ──
    for (const k of kept) {
      await db.from('order_items')
        .update({ quantity: k.newQty, unit_price: k.r.sellPrice, subtotal: round2(k.r.sellPrice! * k.newQty) })
        .eq('id', k.item.id);
    }
    const removeIds = resolvedAll.filter(x => !x.keep || x.newQty <= 0).map(x => x.item.id);
    if (removeIds.length > 0) {
      await db.from('order_items').delete().in('id', removeIds);
    }
    for (const su of selectionUpdates) {
      await db.from('order_service_selections').update({ quantity: su.quantity, subtotal: su.subtotal }).eq('id', su.id);
    }

    const orderUpdate: Record<string, unknown> = {
      subtotal, tax_amount: taxAmount, total_amount: total, addons_amount: round2(addonsAmount), leakage_flag: leakageFlag,
    };
    const deliveryDateVal: string | null | undefined =
      deliveryDate === undefined ? undefined
        : (typeof deliveryDate === 'string' && deliveryDate.trim() ? deliveryDate.trim() : null);
    // delivery_date column is gated (20260708). Include it; on a missing-column error, retry without.
    let updErr: any;
    ({ error: updErr } = await db.from('orders')
      .update(deliveryDateVal === undefined ? orderUpdate : { ...orderUpdate, delivery_date: deliveryDateVal })
      .eq('id', orderId).eq('business_id', businessId));
    if (updErr && deliveryDateVal !== undefined && (updErr.code === '42703' || updErr.code === 'PGRST204')) {
      console.log('[TRACE:DELIVERY] orders.delivery_date absent on update — retrying without it (migration pending)', { code: updErr.code });
      ({ error: updErr } = await db.from('orders').update(orderUpdate).eq('id', orderId).eq('business_id', businessId));
    }
    if (updErr) throw new Error(`Order update: ${updErr.message}`);

    // QB invoice staleness — totals changed, so any existing QB invoice is now out of date.
    // We surface it (never silently leave a mismatch); auto re-sync to QB is a separate decision (R-QBSTALE).
    console.log('[TRACE:PRICE] order edit — QB invoice may be stale (totals changed)', { orderId, total });
    res.json({ ok: true, orderId, subtotal, taxAmount, total, addonsAmount: round2(addonsAmount), leakageFlag, qbStale: true });
  } catch (err: any) {
    console.error('[orders/submit:update]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ── DELETE ──────────────────────────────────────────────────────────────────
// Delete an order and RELEASE its inventory reservation (don't orphan reserved stock).
// Owner/manager only. Children removed explicitly (no reliance on cascade).
async function handleDelete(req: any, res: any) {
  const { orderId, businessId } = req.body || {};
  if (!orderId || !businessId) return res.status(400).json({ error: 'Missing orderId or businessId' });

  if (!(await callerCanManageOrders(req.headers?.authorization, businessId))) {
    console.log('[TRACE:ROSTER] delete REFUSED — caller lacks manage_orders/owner', { orderId, businessId });
    return res.status(403).json({ error: 'Not authorized to delete orders', code: 'FORBIDDEN' });
  }

  const db = adminDb();
  try {
    const { data: order } = await db
      .from('orders').select('id').eq('id', orderId).eq('business_id', businessId).maybeSingle();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { data: itemsRaw } = await db
      .from('order_items').select('id, business_inventory_id').eq('order_id', orderId);
    const items = (itemsRaw ?? []) as Array<{ business_inventory_id: string | null }>;
    const lots = await Promise.all(items.map(it => resolveItemForServer(db, businessId, it)));
    await setLotStatus(db, businessId, lots.map(l => l.inventoryId), 'available');

    await db.from('order_compliance_records').delete().eq('order_id', orderId);
    await db.from('order_service_selections').delete().eq('order_id', orderId);
    await db.from('order_items').delete().eq('order_id', orderId);
    const { error: delErr } = await db.from('orders').delete().eq('id', orderId).eq('business_id', businessId);
    if (delErr) throw new Error(`Order delete: ${delErr.message}`);

    console.log('[TRACE:ROSTER] order deleted + reservations released', { orderId, releasedLots: lots.filter(l => l.inventoryId).length });
    res.json({ ok: true, orderId });
  } catch (err: any) {
    console.error('[orders/submit:delete]', err.message);
    res.status(500).json({ error: err.message });
  }
}

// ── STATUS ──────────────────────────────────────────────────────────────────
// Move an order through its lifecycle (off 'pending'). Owner/manager only. Validated against
// the canonical ORDER_STATUSES (R-STATUS — set pending ratification). Cancelling frees stock.
async function handleStatus(req: any, res: any) {
  const { orderId, businessId, status } = req.body || {};
  if (!orderId || !businessId) return res.status(400).json({ error: 'Missing orderId or businessId' });
  if (!(ORDER_STATUSES as readonly string[]).includes(status)) {
    return res.status(400).json({ error: `Invalid status: ${status}`, code: 'BAD_STATUS' });
  }

  if (!(await callerCanManageOrders(req.headers?.authorization, businessId))) {
    console.log('[TRACE:ROSTER] status REFUSED — caller lacks manage_orders/owner', { orderId, businessId });
    return res.status(403).json({ error: 'Not authorized to change order status', code: 'FORBIDDEN' });
  }

  const db = adminDb();
  try {
    const { data: order } = await db
      .from('orders').select('id').eq('id', orderId).eq('business_id', businessId).maybeSingle();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    // Cancelling frees the reserved stock (R-STATUS: un-cancel does NOT auto-re-reserve — edit to restock).
    if (status === 'cancelled') {
      const { data: itemsRaw } = await db
        .from('order_items').select('business_inventory_id').eq('order_id', orderId);
      const items = (itemsRaw ?? []) as Array<{ business_inventory_id: string | null }>;
      const lots = await Promise.all(items.map(it => resolveItemForServer(db, businessId, it)));
      await setLotStatus(db, businessId, lots.map(l => l.inventoryId), 'available');
    }

    const { error: stErr } = await db.from('orders').update({ status }).eq('id', orderId).eq('business_id', businessId);
    if (stErr) throw new Error(`Order status: ${stErr.message}`);

    console.log('[TRACE:ROSTER] order status changed', { orderId, status });
    res.json({ ok: true, orderId, status });
  } catch (err: any) {
    console.error('[orders/submit:status]', err.message);
    res.status(500).json({ error: err.message });
  }
}
