import { createClient } from '@supabase/supabase-js';
import { sendNotification } from '../../../shared/src/notifications/send';
import { findOrCreateCustomer } from '../../../shared/src/business-logic/customerUpsert';
import { callerHoldsPermission, callerIsBusinessOwner, resolveCallerUid } from '../../../shared/src/auth/callerPermission';
import { readPricingConfig } from '../../../shared/src/business-logic/financialDataAccess';
import { normalizeDiscountTypes, resolveTier, computeOrderPricing, resolveTaxRate, RETAIL_FLOOR, type PricingLineInput, type OrderTaxExemption } from '../../../shared/src/business-logic/tierPricing';
import { nettedQuantity, lineSubtotal } from '../../src/lib/netting';
import { ORDER_STATUSES } from '../../src/lib/orderStatus';
import { fetchCommittedByLot, availableFrom, movesOnHand } from '../../src/lib/inventoryStates';

const LARGE_CONTAINERS = ['15 gal', '30 gal', '45 gal', '60 gal', '100 gal'];

// The permission that gates order EDIT / DELETE / STATUS. Mirrors cultivar roles.ts
// PERMISSIONS.MANAGE_ORDERS (owner + manager, NOT staff) — a string VALUE (AC-1), kept local so
// the api bundle doesn't pull the frontend role tree.
const MANAGE_ORDERS = 'manage_orders';
// D-40: the gated + LOGGED authority to zero an order's tax via a per-order exemption OVERRIDE.
// Owner OR a member holding apply_tax_exempt. The anon/public path has no token → never self-exempt.
const APPLY_TAX_EXEMPT = 'apply_tax_exempt';

// Order-exemption cols on `orders` are gated (20260713). Stripped-and-retried on 42703/PGRST204.
const ORDER_EXEMPT_KEYS = ['tax_exempt_applied', 'tax_exempt_reason', 'tax_exempt_cert_ref', 'tax_exempt_by'];

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

// D-40 tax-exemption authority gate — owner OR a member holding apply_tax_exempt. Same shape as the
// manage-orders gate: resolved from the caller's Bearer token (NEVER the body). A per-order exemption
// OVERRIDE is honored ONLY when this returns true; the anon/public path (no token) can never self-exempt.
async function callerCanApplyTaxExempt(authHeader: string | undefined, businessId: string): Promise<boolean> {
  if (await callerIsBusinessOwner(authHeader, businessId)) return true;
  return callerHoldsPermission(authHeader, businessId, APPLY_TAX_EXEMPT);
}

// Normalize a client-posted per-order exemption override into an OrderTaxExemption (or null when
// absent/malformed). `exempt:true` requires a non-blank reason downstream to be honored.
function parseOrderExemption(raw: unknown): OrderTaxExemption | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.exempt !== 'boolean') return null;
  return {
    exempt: r.exempt,
    reason: typeof r.reason === 'string' ? r.reason : null,
    certRef: typeof r.certRef === 'string' ? r.certRef : null,
  };
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

// D-42: the ONE server-authoritative inventory-adjust path (STD-011 / STD-012). Atomic per-unit
// qty change via the adjust_inventory_qty RPC (a single guarded UPDATE — concurrency-safe, cannot
// drive qty negative). delta < 0 decrements (a sale/commit at order-paid); delta > 0 restores
// (edit-down / delete / cancel). Status DERIVES from qty inside the RPC (qty>0 → available,
// qty<=0 → depleted; a manual damaged/returned status is preserved). Replaces the old coarse
// whole-lot status flip to 'reserved'. Deploy-window-safe: if the RPC is not yet applied the call
// no-ops loudly (decrement deferred) so checkout never breaks before the gated migration lands.
// D-50 LAYER 2A-2: the movement is now ATTRIBUTED — who, when, why, and what caused it. The
// RPC already accepted these (LAYER 1); this path was passing none of them, which is why every
// order-driven ledger row carried a NULL actor. `actorUserId` is threaded from the real caller
// and is NULL only where there genuinely is no caller: anonymous QR checkout. That NULL is the
// HONEST answer, not a gap — assert_movement_actor admits it as a system write, and D-50 §11 is
// explicit that it must never be defaulted to the owner (a fabricated actor is worse than none).
async function adjustLotQty(
  db: ReturnType<typeof adminDb>, businessId: string, lotId: string | null, delta: number, ctx: string,
  mv: { actorUserId: string | null; kind: string; orderId: string; occurredAt: string },
): Promise<{ applied: boolean; newQty: number | null; reason: string }> {
  if (!lotId) return { applied: false, newQty: null, reason: 'no_lot' };
  if (delta === 0) return { applied: true, newQty: null, reason: 'noop' };
  const { data, error } = await db.rpc('adjust_inventory_qty', {
    p_lot_id: lotId, p_business_id: businessId, p_delta: delta,
    p_actor_user_id: mv.actorUserId, p_kind: mv.kind,
    p_source_type: 'order', p_source_id: mv.orderId, p_occurred_at: mv.occurredAt,
  });
  if (error) {
    // Missing-function (RPC not yet applied) → defer gracefully; anything else → surface, non-fatal.
    if (error.code === 'PGRST202' || error.code === '42883') {
      console.log('[TRACE:INVENTORY] adjust_inventory_qty RPC absent — decrement deferred (migration pending)', { ctx, lotId, delta, code: error.code });
      return { applied: false, newQty: null, reason: 'rpc_absent' };
    }
    console.log('[TRACE:INVENTORY] adjust FAILED', { ctx, lotId, delta, code: error.code, error: error.message });
    return { applied: false, newQty: null, reason: 'rpc_error' };
  }
  const row: any = Array.isArray(data) ? data[0] : data;
  const out = { applied: row?.applied === true, newQty: row?.new_qty ?? null, reason: row?.reason ?? 'unknown' };
  console.log('[TRACE:INVENTORY] lot qty adjusted', { ctx, lotId, delta, newQty: out.newQty, status: row?.new_status, reason: out.reason, kind: mv.kind, actor: mv.actorUserId ?? 'NULL(anon-checkout)', occurredAt: mv.occurredAt });
  if (!out.applied && out.reason === 'oversell_refused') {
    console.log('[TRACE:INVENTORY] OVERSELL REFUSED — qty not driven negative (surfaced, not silent)', { ctx, lotId, delta, currentQty: out.newQty });
  }
  return out;
}

// D-50 LAYER 2A-2: the ONE order-event seam (§6 r8). Every order-lifecycle transition emits one
// immutable event through record_order_event — aggregate_type='ORDER', delta 0, real actor, dated.
// delta 0 is enforced INSIDE the RPC, not passed here: an order event can never move on-hand, so
// these rows are free to reconcile's SUM. That is what lets ONE log carry both event families.
//
// NON-FATAL BY DESIGN, and the asymmetry is deliberate: failing to RECORD a transition must not
// block the transition itself (§6 r6 — integration failure never blocks an order). A dropped event
// is surfaced loudly in the trail rather than swallowed. Deploy-window-safe the same way
// adjustLotQty is: if the gated migration has not landed yet, the call no-ops loudly.
async function recordOrderEvent(
  db: ReturnType<typeof adminDb>, businessId: string, orderId: string, eventType: string,
  actorUserId: string | null, occurredAt: string, reason?: string,
): Promise<boolean> {
  const { error } = await db.rpc('record_order_event', {
    p_business_id: businessId, p_order_id: orderId, p_event_type: eventType,
    p_actor_user_id: actorUserId, p_reason: reason ?? null, p_occurred_at: occurredAt,
  });
  if (error) {
    if (error.code === 'PGRST202' || error.code === '42883') {
      console.log('[TRACE:ROSTER] record_order_event RPC absent — order event deferred (migration pending)', { orderId, eventType, code: error.code });
      return false;
    }
    console.log('[TRACE:ROSTER] order event FAILED (transition NOT blocked)', { orderId, eventType, code: error.code, error: error.message });
    return false;
  }
  console.log('[TRACE:ROSTER] order event recorded', { orderId, eventType, actor: actorUserId ?? 'NULL', occurredAt });
  return true;
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
    orderExemption: orderExemptionRaw, // D-40: per-order tax-exemption OVERRIDE (owner/manager only)
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

    // ── 2. Tax rate + price tier + tax exemption (business/customer-level, read once) ──────
    // D-40: the TAX RATE is per-tenant SUPPLIED DATA — business_pricing_config.config.taxRate via
    // the resolveTaxRate seam (NOT businesses.tax_rate; NOT a hardcoded 8.25%). Absent → null =
    // "not identified" (the redline; never a fabricated default). Read server-side (service key,
    // RLS-bypassed) so the rate resolves regardless of the caller's view_pricing_config grant.
    const { data: pricingCfg } = await readPricingConfig(db, businessId);
    const taxRate = resolveTaxRate(pricingCfg?.config);

    // PRICE TIER at checkout (D-35 + the generalized TYPES×TIERS model, 2026-07-10) — READ + APPLIED
    // SERVER-SIDE (tamper defense — the client supplies neither the tier nor the config). The customer's
    // stored price_tier NAME resolves against the owner-configured discount types to a tier + BASIS:
    //   • retail_minus_percent → % off the stored server-authoritative sell_price.
    //   • at_cost              → the server-read unit_cost (money-safety — cost NEVER from the client;
    //                            with graceful degradation to retail if no cost is on file, below).
    // Config-less business / retail / unknown tier → retail floor → price unchanged.
    // D-40: also read the customer's PERSISTENT tax exemption (the party attribute). select('*') is
    // deploy-window-safe (a missing gated column never errors a select, unlike a named column).
    const { data: custRow } = await db
      .from('customers').select('*').eq('id', customerId).maybeSingle();
    const storedTier = (custRow as any)?.price_tier ?? null;

    // ── D-40: effective tax exemption for THIS order ──────────────────────────
    // Default = the customer's PERSISTENT exemption. A per-order OVERRIDE (client-posted) is honored
    // ONLY on a token-verified owner/manager+apply_tax_exempt path (tamper defense — an anon/staff
    // caller's override is IGNORED, the persistent attribute governs). exemptBy = the acting uid ONLY
    // when it came from a per-order override (null when it rode the persistent customer attribute).
    const persistentExemption: OrderTaxExemption = {
      exempt:  (custRow as any)?.tax_exempt === true,
      reason:  (custRow as any)?.tax_exempt_reason ?? null,
      certRef: (custRow as any)?.tax_exempt_cert_ref ?? null,
    };
    const orderExemptionOverride = parseOrderExemption(orderExemptionRaw);
    let effectiveExemption: OrderTaxExemption = persistentExemption;
    let exemptBy: string | null = null;
    if (orderExemptionOverride) {
      const canExempt = await callerCanApplyTaxExempt(authHeader, businessId);
      if (canExempt) {
        effectiveExemption = orderExemptionOverride;
        exemptBy = await resolveCallerUid(authHeader);
        console.log('[TRACE:TAX] per-order exemption override HONORED (owner/manager + apply_tax_exempt)', {
          exempt: orderExemptionOverride.exempt, reason: orderExemptionOverride.reason, by: exemptBy, businessId,
        });
      } else {
        console.log('[TRACE:TAX] per-order exemption override IGNORED — caller lacks apply_tax_exempt (tamper defense)', {
          attempted: orderExemptionOverride.exempt, businessId,
        });
      }
    }

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

    // pricingCfg was already read in §2 (for the tax rate) — reuse it (no second read).
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
    // D-43: each resolved line carries its NET (unitPrice/subtotal — what's charged) AND its stored
    // show-the-work breakdown (retailUnit/discountPct/discountAmt) — all written to order_items so
    // every downstream surface renders the stored fact, no recompute. Filled after computeOrderPricing.
    const resolvedLines: Array<{ plant: any; quantity: number; stockLineId: string | null; unitPrice: number; subtotal: number; retailUnit: number; discountPct: number; discountAmt: number }> = [];
    const goodsInputs: PricingLineInput[] = [];
    let anyLargeContainer = false;

    // ── D-52: read COMMITTED once for the whole business, BEFORE the line loop ──────────────
    // The oversell guard below checks AVAILABLE (on-hand − committed), not raw on-hand. This is the
    // reservation protection D-42 could not provide: under checkout-decrement, on-hand and available
    // were the same number, so a delivery order sitting unfulfilled left its units looking sellable.
    // ONE query for every lot (not N+1 per line — this is the checkout path).
    const committedByLot = await fetchCommittedByLot(db, businessId);
    // Units this SAME cart has already claimed on an earlier line. Two lines can anchor the SAME lot
    // (e.g. the same variety added twice), and checking each line against the same untouched
    // available would let a 2-line cart take 2× the stock — each line individually "fits" while the
    // cart as a whole oversells. Pre-existing hole; fixed here because this is the touched surface.
    const claimedInThisCart = new Map<string, number>();

    for (const line of lines) {
      const plant = line.plant;
      const quantity = Number(line.quantity);
      const stockLineId: string | null = plant.stock_line_id ?? null;
      let serverSellPriceRaw: number | null | undefined;
      let serverUnitCost: number | null | undefined; // server-read cost (at_cost basis only; NEVER client)
      let stockLineSize: string | null = null;
      let availableQty: number | null = null; // server-read on-hand for the pre-flight oversell guard (D-42)

      if (stockLineId) {
        const { data: invRow } = await db
          .from('business_inventory')
          .select('sell_price, unit_cost, size, status, qty')
          .eq('id', stockLineId)
          .eq('business_id', businessId)
          .single();
        serverSellPriceRaw = (invRow as any)?.sell_price;
        serverUnitCost     = (invRow as any)?.unit_cost;
        stockLineSize      = (invRow as any)?.size ?? null;
        availableQty       = (invRow as any)?.qty ?? null;
        console.log('[TRACE:RESOLVE] order anchor — business_inventory (stock line)', { stockLineId });
      } else {
        const { data: invRow } = await db
          .from('cultivar_plants')
          .select('business_inventory ( sell_price, unit_cost, qty )')
          .eq('id', plant.id)
          .eq('business_id', businessId)
          .single();
        serverSellPriceRaw = (invRow as any)?.business_inventory?.sell_price;
        serverUnitCost     = (invRow as any)?.business_inventory?.unit_cost;
        availableQty       = (invRow as any)?.business_inventory?.qty ?? null;
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

      // ── OVERSELL PRE-FLIGHT (D-42 → D-52, Surface Honesty) — refuse the WHOLE order BEFORE any
      // write if a line's quantity exceeds what is genuinely SELLABLE, rather than driving stock
      // negative or silently short-selling.
      //
      // D-52 changed WHICH number this checks. It was raw on-hand; it is now AVAILABLE
      // (on-hand − committed − already-claimed-by-this-cart). Under D-42's checkout-decrement the
      // two were identical, so there was nothing to distinguish. Now that on-hand does NOT move
      // until fulfillment, a placed-but-undelivered order leaves its units sitting in on-hand —
      // physically present, already sold. Checking on-hand here would happily sell them TWICE.
      // The §11/status atomic RPC remains the authoritative guard against a concurrent-depletion
      // race; this is the clean common-case refusal that avoids a half-committed order.
      const lotIdForCheck = stockLineId ?? plant.inventory_id ?? null;
      const committedQty  = lotIdForCheck ? (committedByLot.get(lotIdForCheck) ?? 0) : 0;
      const cartClaimed   = lotIdForCheck ? (claimedInThisCart.get(lotIdForCheck) ?? 0) : 0;
      const sellableQty   = availableQty != null
        ? availableFrom(availableQty, committedQty + cartClaimed)
        : null;
      if (sellableQty != null && quantity > sellableQty) {
        const itemName = plant.common_name ?? plant.species ?? 'this item';
        console.log('[TRACE:INVENTORY] REFUSED — insufficient AVAILABLE (order blocked, no negative qty written)', {
          plantId: plant.id, itemName, requested: quantity,
          onHand: availableQty, committed: committedQty, claimedEarlierInCart: cartClaimed, sellable: sellableQty,
        });
        // The message names AVAILABLE, and says so when stock is present-but-committed — a bare
        // "only N in stock" against a lot the owner can SEE holding more reads as a bug (D-9).
        const detail = committedQty + cartClaimed > 0
          ? `Only ${sellableQty} of ${itemName} available to sell (${availableQty} on hand, ${committedQty + cartClaimed} committed to open orders)`
          : `Only ${sellableQty} of ${itemName} in stock`;
        return res.status(400).json({
          error: `${detail} — reduce the quantity or restock before selling.`,
          code: 'INSUFFICIENT_STOCK',
        });
      }
      if (lotIdForCheck) claimedInThisCart.set(lotIdForCheck, cartClaimed + quantity);

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
      resolvedLines.push({ plant, quantity, stockLineId, unitPrice: 0, subtotal: 0, retailUnit: 0, discountPct: 0, discountAmt: 0 }); // net + breakdown filled after compute
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
      const baseline: SvcResult = { amount: computed, isOverride: false, original: null, leakage: null, reason: null };
      if (ov && typeof ov.amount === 'number' && ov.amount >= 0) {
        // STD-013 — a money-affecting override REQUIRES a recorded reason. The UI blocks Apply
        // without one; THIS is the server-side enforcement (the UI gate is defense-in-depth, not
        // the control). Same shape as the D-40 reasonless-exemption refusal above: refuse, log,
        // charge the BASELINE. Refusal charges MORE, never gives money away unrecorded — the
        // money-safe direction. A concession with no reason is unreconcilable later (D-48).
        const reason = (ov.reason ?? '').trim();
        if (!reason) {
          console.log('[TRACE:PRICE] price override REFUSED — no reason recorded (STD-013); baseline charged', {
            offeringId, baseline: round2(computed), attempted: round2(ov.amount), overrideBy, businessId,
          });
          return baseline;
        }
        const amt  = round2(ov.amount);
        const leak = round2(computed - amt);
        console.log('[TRACE:LEAKAGE] price override honored', {
          offeringId, baseline: round2(computed), override: amt, leakage: leak, overrideBy, reason,
        });
        return { amount: amt, isOverride: true, original: round2(computed), leakage: leak, reason };
      }
      return baseline;
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

    // Override columns for a selection row. `is_manual_override` is set on EVERY row — true on the
    // overridden line, FALSE on the others — never omitted. WHY: order_service_selections is inserted
    // as a BATCH; PostgREST unions the column set across the batch, so if ANY row carries
    // is_manual_override the rows that omit it are inserted with an explicit NULL (the column's
    // `DEFAULT false` only applies when the column is absent from the WHOLE batch). Omitting it on
    // non-override rows therefore violated the NOT NULL constraint the moment an order had one
    // override (a pure non-override order omitted it on every row → default applied → no error; that's
    // why it stayed latent). Setting it false here keeps the per-row override signal truthful AND
    // gives every batch row the column. override_by = the acting user's auth.uid (server-resolved).
    const overrideCols = (res: SvcResult | null): Record<string, unknown> =>
      res?.isOverride
        ? { is_manual_override: true, original_price: res.original, price_leakage: res.leakage, override_by: overrideBy, override_reason: res.reason }
        : { is_manual_override: false };

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
    // D-48: an override rides overrideTotal + its REQUIRED overrideReason — the shared computation
    // expresses it as the line's discount (baseline preserved) and independently re-enforces the
    // reason rule, so the two gates agree by construction rather than by convention.
    const serviceInputs: PricingLineInput[] = [];
    if (selectedTransport) serviceInputs.push({ kind: 'service', name: selectedTransport.name, unitPrice: Number(selectedTransport.price), qty: qtyFor(selectedTransport), overrideTotal: transportRes?.isOverride ? transportAmount : null, overrideReason: transportRes?.reason ?? null });
    if (plantingActive && plantingOffering) serviceInputs.push({ kind: 'service', name: plantingOffering.name, unitPrice: Number(plantingOffering.price), qty: plantingQty, overrideTotal: plantingRes?.isOverride ? plantingAmount : null, overrideReason: plantingRes?.reason ?? null });
    if (nettingActive && nettingSelection?.offering) serviceInputs.push({ kind: 'service', name: nettingSelection.offering.name, unitPrice: Number(nettingUnitPrice), qty: nettingQty, overrideTotal: nettingRes?.isOverride ? nettingTotal : null, overrideReason: nettingRes?.reason ?? null });
    for (const x of otherResults) serviceInputs.push({ kind: 'service', name: x.offering.name, unitPrice: Number(x.offering.price), qty: qtyFor(x.offering), overrideTotal: x.res.isOverride ? x.res.amount : null, overrideReason: x.res.reason ?? null });

    // D-40: the tax rate + effective exemption flow into the SAME shared computation. taxStatus is
    // one of not_identified (rate unset → redline) / taxed / exempt (documented). The surfaces render
    // taxStatus; the server never fabricates a rate and never zeros tax without a reason.
    const pricing = computeOrderPricing([...goodsInputs, ...serviceInputs], resolvedTier, taxRate, effectiveExemption);
    // Write each goods line's tier-priced NET + its stored show-the-work BREAKDOWN back onto
    // resolvedLines (same order) → order_items (D-43). retailUnit/discountPct/discountAmt are the
    // frozen-at-charge provenance every downstream surface renders (no recompute). INVARIANT:
    // retail_total − discount_amt === net_total (discountAmt = round2(retailTotal − netTotal) by
    // construction in computeOrderPricing, so it holds exactly).
    const goodsPriced = pricing.lines.filter(p => p.kind === 'goods');
    resolvedLines.forEach((rl, i) => {
      const gp = goodsPriced[i];
      rl.unitPrice   = gp.netUnit;
      rl.subtotal    = gp.netTotal;
      rl.retailUnit  = gp.retailUnit;
      rl.discountPct = gp.discountPct;
      rl.discountAmt = gp.discountAmt;
    });
    for (const gp of goodsPriced) if (gp.degraded) degradedItems.push(gp.name);
    const subtotal  = pricing.discountedSubtotal;
    const taxAmount = pricing.tax;
    const total     = pricing.total;
    console.log('[TRACE:TAX] order tax resolved', {
      rateSource: 'config.taxRate', taxRate, taxStatus: pricing.taxStatus,
      taxableSubtotal: pricing.taxableSubtotal, tax: taxAmount,
      exemptApplied: effectiveExemption.exempt, exemptReason: pricing.taxExemptReason,
      exemptBy, businessId,
    });

    // Graceful-degradation surface (D-9) — an at_cost tier with NO cost on file was charged at
    // RETAIL (never $0). Honest order-level note (returned to the client + logged), not a silent mismatch.
    const pricingNotes: string[] = degradedItems.length
      ? [`At-cost pricing could not apply to ${degradedItems.length} line(s) with no cost on file — charged at retail instead: ${degradedItems.join(', ')}. Set a unit cost in Inventory to enable at-cost pricing.`]
      : [];

    // [TRACE:PRICE] D-48: every line now carries its own invariant proof (retailTotal − discountAmt
    // === netTotal) and an overridden service names its reason. THIS is the line that showed the
    // scar: Placement retailTotal 1575 / discountAmt 0 / netTotal 1000 — a line contradicting itself.
    console.log('[TRACE:PRICE] order priced (computeOrderPricing)', {
      tier: resolvedTier.name, basis: resolvedTier.basis, discountPercent: resolvedTier.discountPercent,
      lines: pricing.lines.map(p => ({ kind: p.kind, name: p.name, retailUnit: p.retailUnit, qty: p.qty, retailTotal: p.retailTotal, discountPct: p.discountPct, discountAmt: p.discountAmt, netTotal: p.netTotal, adjustmentReason: p.adjustmentReason ?? null, invariantOk: Math.abs(round2(p.retailTotal - p.discountAmt) - p.netTotal) <= 0.005 })),
      goodsRetailSubtotal: pricing.goodsRetailSubtotal, discountTotal: pricing.discountTotal,
      serviceAdjustmentTotal: pricing.serviceAdjustmentTotal,
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

    // ── D-52: WALK-IN COLLAPSES COMMIT AND FULFILL INTO ONE INSTANT ────────────────────────
    // A self-transport customer pays and drives away: the plant leaves the property AT CHECKOUT,
    // so the order is born already fulfilled. A delivery/install order is born 'pending' — its
    // units stay on the property, committed, until someone marks it fulfilled days later. Same two
    // transitions in both cases (D-52); only the spacing differs.
    //
    // The classification is lib/transport.ts's, reached through deriveTransportMethod — NOT a new
    // flag (§6 r8: one operation, one home). 'self' is the branch that means "customer hauls it."
    //
    // ⚠️ The status is not cosmetic here — it is LOAD-BEARING for the derivation. COMMITTED is
    // derived from open orders (holdsCommitment), so leaving a walk-in at 'pending' would count
    // units as committed that have physically LEFT — subtracting them from available a second time
    // after on-hand already dropped, permanently understating what the owner can sell. The
    // three-number model forces this answer; it is not a preference.
    const isWalkIn = transportMethod === 'self';
    const bornStatus = isWalkIn ? 'fulfilled' : 'pending';

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
      status:           bornStatus,   // D-52: 'fulfilled' for a walk-in, 'pending' for delivery
    };
    // GATED columns on `orders` — delivery_date (20260708) + the D-40 tax-exemption cols (20260713).
    // Both are deploy-window-safe: insert WITH them and, on a missing-column error, strip the gated
    // keys and retry (the order still lands; the gated fields re-enable once the migration applies).
    const deliveryDateVal: string | null =
      typeof deliveryDate === 'string' && deliveryDate.trim() ? deliveryDate.trim() : null;
    const GATED_ORDER_KEYS = ['delivery_date', ...ORDER_EXEMPT_KEYS];
    const gatedCols: Record<string, unknown> = {
      // D-40: persist the EFFECTIVE per-order tax state so every downstream surface renders the same
      // truth. applied = tax was actually exempted (an exempt flag with no reason falls to 'taxed').
      tax_exempt_applied:  pricing.taxStatus === 'exempt',
      tax_exempt_reason:   pricing.taxStatus === 'exempt' ? pricing.taxExemptReason : null,
      tax_exempt_cert_ref: pricing.taxStatus === 'exempt' ? pricing.taxExemptCertRef : null,
      tax_exempt_by:       exemptBy,   // set only when it came from a per-order OVERRIDE (else null)
    };
    if (deliveryDateVal) gatedCols.delivery_date = deliveryDateVal;

    let order: any;
    let orderErr: any;
    ({ data: order, error: orderErr } = await db
      .from('orders')
      .insert({ ...orderBase, ...gatedCols })
      .select('id')
      .single());

    // Missing-column fallback (42703 = undefined_column; PGRST204 = schema-cache miss).
    if (orderErr && (orderErr.code === '42703' || orderErr.code === 'PGRST204')) {
      console.log('[TRACE:TAX] gated order columns absent — retrying insert without them (migration pending)', {
        code: orderErr.code, strippedKeys: GATED_ORDER_KEYS, taxStatus: pricing.taxStatus, deliveryDate: deliveryDateVal,
      });
      ({ data: order, error: orderErr } = await db
        .from('orders')
        .insert(orderBase)
        .select('id')
        .single());
    } else if (!orderErr) {
      if (deliveryDateVal) console.log('[TRACE:DELIVERY] order created with delivery_date', { deliveryDate: deliveryDateVal });
      if (pricing.taxStatus === 'exempt') console.log('[TRACE:TAX] order created tax-exempt', { reason: pricing.taxExemptReason, cert: pricing.taxExemptCertRef, by: exemptBy });
    }

    if (orderErr) throw new Error(`Order: ${orderErr.message}`);
    const orderId = order!.id;

    // ── 8. Order items — ONE row per cart line, anchored to its business_inventory lot ──
    // D-34: the LOT is the SKU → every line anchors to business_inventory_id (the sole anchor;
    // the AC-1 vertical noun order_items.plant_id was dropped 20260709). A stock line anchors to
    // its own id; a specimen anchors to its lot (cultivar_plants.inventory_id, carried on the
    // cart plant object). Money/qty unchanged — only the line's NAME anchor.
    // D-43: each row carries the NET (unit_price/subtotal — what's charged) AND the persisted
    // show-the-work breakdown (retail_unit/discount_pct/discount_amt) so order-detail + QBO render
    // the stored discount line, no recompute. The breakdown cols are gated (20260713_order_items_
    // line_breakdown); insert WITH them and, on a missing-column error, strip + retry (deploy-window
    // safe — the order still lands; the breakdown re-enables once the migration applies).
    const BREAKDOWN_KEYS = ['retail_unit', 'discount_pct', 'discount_amt'];
    const itemRows = resolvedLines.map((rl) => ({
      order_id:   orderId,
      quantity:   rl.quantity,
      unit_price: rl.unitPrice,   // NET — server-authoritative sell_price after tier (D-35/D-39)
      subtotal:   rl.subtotal,    // NET line total
      business_inventory_id: rl.stockLineId ?? rl.plant.inventory_id ?? null,
      retail_unit:  rl.retailUnit,   // pre-discount unit price (frozen-at-charge provenance)
      discount_pct: rl.discountPct,  // tier % applied to this line (0 = none)
      discount_amt: rl.discountAmt,  // retail_total − net_total (0 = none)
    }));
    console.log('[TRACE:RESOLVE] order_items anchors', {
      count: itemRows.length,
      anchors: resolvedLines.map(rl => `inv:${rl.stockLineId ?? rl.plant.inventory_id ?? 'none'}`),
    });
    // [TRACE:PRICE] the PERSISTED per-line breakdown + the reconcile invariant (STD-012 persistence).
    console.log('[TRACE:PRICE] order_items breakdown persisted', {
      lines: resolvedLines.map(rl => ({
        retailUnit: rl.retailUnit, qty: rl.quantity, discountPct: rl.discountPct,
        discountAmt: rl.discountAmt, net: rl.subtotal,
        reconciles: Math.abs((round2(rl.retailUnit * rl.quantity) - rl.discountAmt) - rl.subtotal) < 0.01,
      })),
    });
    let itemErr: any;
    ({ error: itemErr } = await db.from('order_items').insert(itemRows));
    if (itemErr && (itemErr.code === '42703' || itemErr.code === 'PGRST204')) {
      console.log('[TRACE:PRICE] order_items breakdown columns absent — retrying insert without them (migration pending)', { code: itemErr.code });
      const stripped = itemRows.map((r) => {
        const c: Record<string, unknown> = { ...r };
        for (const k of BREAKDOWN_KEYS) delete c[k];
        return c;
      });
      ({ error: itemErr } = await db.from('order_items').insert(stripped));
    }
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
      // [TRACE:LEAKAGE] per-row override flag on the write — every row carries is_manual_override
      // (true on the overridden line, false elsewhere) so the batch can't NULL-violate. STD-003 ON.
      console.log('[TRACE:LEAKAGE] service-selection write — per-row is_manual_override', {
        rows: selectionRows.map((r: any) => ({ service_offering_id: r.service_offering_id, is_manual_override: r.is_manual_override === true, subtotal: r.subtotal })),
        overrides: selectionRows.filter((r: any) => r.is_manual_override === true).length,
      });
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

    // ── 11. COMMIT the order's stock — and decrement on-hand ONLY on a walk-in (D-52) ──────
    // ⚠️ D-52 MOVED THE ON-HAND DECREMENT OUT OF CHECKOUT. It used to fire here for every order.
    // It now fires when the order is FULFILLED — the moment the plant physically leaves — which
    // for a delivery is days later, in handleStatus. Checkout COMMITS the units (available drops,
    // on-hand does not) and the commitment is DERIVED from this open order, never stored.
    //
    // (History, kept because it cost real reasoning twice: the pre-2026-07-20 comment here claimed
    // this was "the ORDER-PAID commitment point ... committed at payment", describing a payment
    // lifecycle the code has never had — no 'paid' status exists. That falsehood sent a build spec
    // hunting a transition that was never there. Under D-52 the block finally means roughly what
    // that comment claimed — but by DECISION, not by accident, and the distinction is the point.)
    //
    // A WALK-IN is the one case that still decrements here, because commit and fulfill are the same
    // instant when the customer drives away with the plant. Per-unit, ATOMIC (qty = qty - n via the
    // RPC — concurrency-safe, cannot go negative), NOT a whole-lot status flip; status DERIVES from
    // the new qty inside the RPC. The lot targeted is the SAME id the line ANCHORS on
    // (rl.stockLineId ?? rl.plant.inventory_id — D-34) so it cannot silently no-op on a stock line.
    // A rare concurrent-depletion oversell is surfaced by the RPC (the pre-flight already refused
    // the common case) — logged, never a negative qty.
    //
    // D-50: the decrement writes a dated 'sale' ledger event carrying its actor. checkoutActor is
    // the staff member when a signed-in staffer rings the sale, and NULL for a genuine anonymous QR
    // checkout — the honest value (D-9), never defaulted to the owner.
    const checkoutActor = overrideBy ?? exemptBy ?? (authHeader ? await resolveCallerUid(authHeader) : null);
    const soldAt = new Date().toISOString();

    if (isWalkIn) {
      for (const rl of resolvedLines) {
        const lotId = rl.stockLineId ?? rl.plant.inventory_id ?? null;
        await adjustLotQty(db, businessId, lotId, -rl.quantity, 'walk-in sale decrement (commit+fulfill collapsed)',
          { actorUserId: checkoutActor, kind: 'sale', orderId, occurredAt: soldAt });
      }
    } else {
      console.log('[TRACE:INVENTORY] D-52 commit — units COMMITTED, on-hand deliberately UNCHANGED (decrements at fulfillment)', {
        orderId, transportMethod,
        lines: resolvedLines.map(rl => ({ lot: rl.stockLineId ?? rl.plant.inventory_id ?? null, qty: rl.quantity })),
      });
    }

    // The order's own birth event — the first entry in its lifecycle stream (delta 0).
    await recordOrderEvent(db, businessId, orderId, 'order_created', checkoutActor, soldAt,
      'checkout');

    // D-52: the COMMIT event — the moment units became spoken-for. This is the start of the
    // "how long did it sit" clock; the interval to order_fulfilled IS the committed duration.
    // Emitted for EVERY order including a walk-in, whose commit and fulfill share a timestamp:
    // recording only the fulfill would erase the fact that a commitment happened at all, and a
    // zero-length interval is a real, meaningful measurement (it says "collapsed"), not a gap.
    await recordOrderEvent(db, businessId, orderId, 'order_committed', checkoutActor, soldAt,
      isWalkIn ? 'walk-in — commit and fulfill collapsed' : `committed at checkout (${transportMethod})`);

    // A walk-in is fulfilled at birth, so its fulfillment event belongs to checkout too. The order
    // never passes through handleStatus, so this is the ONLY place that event can be written.
    if (isWalkIn) {
      await recordOrderEvent(db, businessId, orderId, 'order_fulfilled', checkoutActor, soldAt,
        'walk-in — customer took delivery at checkout');
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

    // D-39: return the AUTHORITATIVE per-line breakdown so the Confirmation receipt renders the
    // server's numbers (not the client Review preview) — Confirmation === QBO by construction, and
    // the discount is a visible line. No new endpoint (rides this existing response).
    const discountLabel = pricing.discountTotal > 0
      ? (resolvedTier.basis === 'at_cost' ? `${resolvedTier.name} — at cost` : `${resolvedTier.name} — ${resolvedTier.discountPercent}% off`)
      : null;
    const breakdown = {
      lines: pricing.lines,
      goodsRetailSubtotal: pricing.goodsRetailSubtotal,
      discountTotal: pricing.discountTotal,
      // D-48: the owner's service concessions ride their own roll-up so the receipt can show them
      // WITHOUT contaminating the "<tier> — N% off" line, which is a different fact.
      serviceAdjustmentTotal: pricing.serviceAdjustmentTotal,
      discountedSubtotal: pricing.discountedSubtotal,
      discountLabel,
    };
    console.log('[TRACE:PRICE] order priced — grouped breakdown (authoritative)', {
      tier: resolvedTier.name, basis: resolvedTier.basis, discountPercent: resolvedTier.discountPercent,
      goodsRetailSubtotal: pricing.goodsRetailSubtotal, discountTotal: pricing.discountTotal,
      goodsAfterDiscount: round2(pricing.goodsRetailSubtotal - pricing.discountTotal),
      discountedSubtotal: subtotal, tax: taxAmount, total,
    });
    res.json({
      orderId, invoiceNumber, total, subtotal, taxAmount, pricingNotes, breakdown,
      // D-40: the authoritative tax state → Confirmation + email render it (redline / taxed / exempt),
      // no surface re-derives. taxRate carried so a taxed surface shows the exact %.
      taxStatus: pricing.taxStatus, taxRate,
      taxExemptReason: pricing.taxExemptReason ?? null, taxExemptCertRef: pricing.taxExemptCertRef ?? null,
    });

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
    // Order must belong to this business (AC-3). select('*') is deploy-window-safe (a missing gated
    // column never errors a select) and carries the persisted D-40 exemption so an edit preserves it.
    const { data: order } = await db
      .from('orders').select('*').eq('id', orderId).eq('business_id', businessId).maybeSingle();
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

    // D-40: FOLD the roster-edit tax through the SAME computeOrderPricing the create path runs — no
    // off-seam `subtotal × rate` (closes the #107/#114 drift). handleUpdate stays baseline-only for
    // goods (RETAIL_FLOOR — no tier), so goods pass at full price = linesSubtotal; services carry their
    // already-netted subtotal (unitPrice=sub, qty=1 → netTotal=sub). The order's PERSISTED exemption is
    // re-applied so an exempt order stays exempt and a rate-unset order stays "not identified" across edits.
    const editGoods: PricingLineInput[] = kept.map(k => ({ kind: 'goods', name: k.r.name, unitPrice: k.r.sellPrice as number, qty: k.newQty }));
    const editServices: PricingLineInput[] = selectionUpdates.map(su => ({ kind: 'service', name: `svc:${su.id}`, unitPrice: su.subtotal, qty: 1 }));
    const editExemption: OrderTaxExemption = {
      exempt:  (order as any).tax_exempt_applied === true,
      reason:  (order as any).tax_exempt_reason ?? null,
      certRef: (order as any).tax_exempt_cert_ref ?? null,
    };
    const { data: editCfg } = await readPricingConfig(db, businessId);
    const taxRate     = resolveTaxRate(editCfg?.config);
    const editPricing = computeOrderPricing([...editGoods, ...editServices], RETAIL_FLOOR, taxRate, editExemption);
    const subtotal    = editPricing.discountedSubtotal;
    const taxAmount   = editPricing.tax;
    const total       = editPricing.total;
    const leakageFlag = anyLargeContainer && addonCategoryTotal === 0;
    console.log('[TRACE:TAX] order edit tax resolved (folded through computeOrderPricing)', {
      orderId, rateSource: 'config.taxRate', taxRate, taxStatus: editPricing.taxStatus,
      taxableSubtotal: editPricing.taxableSubtotal, tax: taxAmount, exemptApplied: editExemption.exempt,
    });

    // ── Re-adjust inventory qty for the edit (D-42 → D-52) ─────────────────────────
    // D-52 SPLIT this by whether the order's stock has physically left.
    //
    // OPEN order (pending/confirmed — the common edit): on-hand was NEVER decremented, so an edit
    // must NOT touch it. Editing quantities changes the COMMITMENT, and commitment is DERIVED from
    // these very line rows — rewriting order_items below IS the adjustment. No stock write at all.
    // Under D-42 this block adjusted on-hand by (oldQty − newQty) and was correct, because create
    // had taken the old qty out. With the decrement moved, that same arithmetic would credit or
    // debit on-hand for a movement that never happened — the same class of bug as the restore
    // guards, and the reason all four sites had to move together rather than just the two named.
    //
    // FULFILLED order (editing after delivery — a correction): on-hand DID move, so the difference
    // is a real physical adjustment and is applied exactly as before.
    const editTouchesOnHand = movesOnHand((order as any).status);
    const editDeltas = new Map<string, number>();
    if (editTouchesOnHand) {
      for (const x of resolvedAll) {
        const lotId = x.item.business_inventory_id;
        if (!lotId) continue;
        const effectiveNewQty = x.keep ? x.newQty : 0;
        const delta = Number(x.item.quantity) - effectiveNewQty; // >0 restore, <0 decrement further
        editDeltas.set(lotId, (editDeltas.get(lotId) ?? 0) + delta);
      }
    }
    // D-50: an edit is a real stock movement and gets a real actor — handleUpdate is manager-gated,
    // so a NULL here would be a defect, not an honest system write. Direction picks the vocabulary:
    // restoring stock is a 'sale_reversal', taking more is a further 'sale'.
    const editActor = await resolveCallerUid(req.headers?.authorization);
    const editedAt = new Date().toISOString();
    for (const [lotId, delta] of editDeltas) {
      await adjustLotQty(db, businessId, lotId, delta, 'order edit (fulfilled — physical correction)',
        { actorUserId: editActor, kind: delta > 0 ? 'sale_reversal' : 'sale', orderId, occurredAt: editedAt });
    }
    if (!editTouchesOnHand) {
      console.log('[TRACE:INVENTORY] D-52 edit on an OPEN order — commitment re-derived from the new line qtys, on-hand untouched', {
        orderId, status: (order as any).status, lines: resolvedAll.length,
      });
    }
    await recordOrderEvent(db, businessId, orderId, 'order_edited', editActor, editedAt,
      removed.size > 0 ? `lines removed: ${removed.size}` : undefined);
    console.log('[TRACE:PRICE] order edit — re-reserved + recomputed', {
      orderId, itemCount, linesSubtotal: round2(linesSubtotal), addonsAmount: round2(addonsAmount),
      subtotal, taxAmount, total, leakageFlag, removed: [...removed],
    });

    // ── Writes: line qtys, removals, service re-net, order totals + delivery date ──
    // D-43 (STD-016): the edit RE-PERSISTS each kept line's breakdown too — WITHOUT this, an edited
    // tiered order would keep its stale create-time retail_unit/discount_amt while unit_price/subtotal
    // move to the re-charged net, VIOLATING the invariant (retail − discount ≠ net). handleUpdate
    // charges baseline (RETAIL_FLOOR — no tier; the carried #107/#114 gap), so the refreshed breakdown
    // is retail_unit = sell_price, discount_pct 0, discount_amt 0 → order-detail shows net only, HONEST
    // to what the edit re-charged. The breakdown cols are gated; on a missing-column error, strip once
    // and update the rest without them (deploy-window safe).
    let breakdownColsMissing = false;
    for (const k of kept) {
      const net = round2(k.r.sellPrice! * k.newQty);
      const full: Record<string, unknown> = {
        quantity: k.newQty, unit_price: k.r.sellPrice, subtotal: net,
        retail_unit: k.r.sellPrice, discount_pct: 0, discount_amt: 0,
      };
      if (!breakdownColsMissing) {
        const { error: upErr } = await db.from('order_items').update(full).eq('id', k.item.id);
        if (upErr && (upErr.code === '42703' || upErr.code === 'PGRST204')) {
          console.log('[TRACE:PRICE] order_items breakdown columns absent on edit — updating without them (migration pending)', { code: upErr.code });
          breakdownColsMissing = true;
        } else { continue; }
      }
      // stripped path (columns absent): update only the net + qty
      await db.from('order_items')
        .update({ quantity: k.newQty, unit_price: k.r.sellPrice, subtotal: net })
        .eq('id', k.item.id);
    }
    console.log('[TRACE:PRICE] order edit — breakdown refreshed (baseline; STD-016)', {
      orderId, keptLines: kept.length, breakdownColsMissing,
    });
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
    res.json({ ok: true, orderId, subtotal, taxAmount, total, addonsAmount: round2(addonsAmount), leakageFlag, qbStale: true, taxStatus: editPricing.taxStatus });
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
      .from('orders').select('id, status').eq('id', orderId).eq('business_id', businessId).maybeSingle();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const { data: itemsRaw } = await db
      .from('order_items').select('id, quantity, business_inventory_id').eq('order_id', orderId);
    const items = (itemsRaw ?? []) as Array<{ quantity: number; business_inventory_id: string | null }>;

    // RESTORE on-hand — but ONLY for an order that actually took stock off the property.
    // D-52: that is exactly a FULFILLED order (movesOnHand). Deleting a pending/confirmed order
    // returns nothing to the lot, because nothing left it — the units were committed, and the
    // commitment evaporates on its own when the order rows disappear (committed is DERIVED from
    // open orders, so deleting the order releases it with no write at all). The prior guard was
    // "restore unless already cancelled", which was right under checkout-decrement and would have
    // become a stock-inventing bug the moment the decrement moved to fulfillment.
    // D-50: attributed + dated, and the event is written BEFORE the row is destroyed. The ledger
    // rows survive the order they describe — source_id is deliberately not an FK, so the movement
    // fact outlives the order exactly as it outlives a deleted lot (LAYER 1: history outlives the
    // row). Deleting an order therefore erases the order, never the record that it existed.
    const deleteActor = await resolveCallerUid(req.headers?.authorization);
    const deletedAt = new Date().toISOString();
    let restored = 0;
    const deletingFulfilled = movesOnHand((order as any).status);
    if (deletingFulfilled) {
      for (const it of items) {
        if (!it.business_inventory_id) continue;
        await adjustLotQty(db, businessId, it.business_inventory_id, Number(it.quantity), 'order delete restore (was fulfilled)',
          { actorUserId: deleteActor, kind: 'sale_reversal', orderId, occurredAt: deletedAt });
        restored++;
      }
    } else {
      console.log('[TRACE:INVENTORY] D-52 delete — on-hand untouched (order never fulfilled; commitment released by the delete itself)', {
        orderId, status: (order as any).status, lines: items.length,
      });
    }
    await recordOrderEvent(db, businessId, orderId, 'order_deleted', deleteActor, deletedAt,
      deletingFulfilled ? 'was fulfilled — on-hand restored' : `was ${(order as any).status ?? 'open'} — commitment released, on-hand untouched`);

    await db.from('order_compliance_records').delete().eq('order_id', orderId);
    await db.from('order_service_selections').delete().eq('order_id', orderId);
    await db.from('order_items').delete().eq('order_id', orderId);
    const { error: delErr } = await db.from('orders').delete().eq('id', orderId).eq('business_id', businessId);
    if (delErr) throw new Error(`Order delete: ${delErr.message}`);

    console.log('[TRACE:ROSTER] order deleted', { orderId, restoredLines: restored, wasFulfilled: deletingFulfilled, priorStatus: (order as any).status });
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
      .from('orders').select('id, status').eq('id', orderId).eq('business_id', businessId).maybeSingle();
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const prevStatus = (order as any).status ?? null;
    // A no-op re-submit of the SAME status writes no event. An event log records things that
    // HAPPENED; emitting 'order_confirmed' when the order was already confirmed would manufacture
    // a transition nobody performed — the same falsehood OP-14 forbids on a test card.
    if (prevStatus === status) {
      console.log('[TRACE:ROSTER] status unchanged — no event written', { orderId, status });
      return res.json({ ok: true, orderId, status, unchanged: true });
    }

    // D-50 LAYER 2A-2: the transition is manager-gated above, so the actor is always real here.
    const statusActor = await resolveCallerUid(req.headers?.authorization);
    const changedAt = new Date().toISOString();

    // ── D-52: ON-HAND MOVES ON THE FULFILL TRANSITION, AND ONLY THERE ──────────────────────
    // Both branches below are keyed off movesOnHand() — ONE predicate answering "did/does this
    // order's stock physically move?" — instead of each site assuming it independently. That
    // independent assumption is exactly what D-42's checkout-decrement left behind: every restore
    // path was written believing checkout had already decremented, and moving the decrement without
    // moving those beliefs would have manufactured stock out of nothing (see the cancel note).
    const wasOnHandDecremented = movesOnHand(prevStatus);
    const willDecrementOnHand  = movesOnHand(status) && !wasOnHandDecremented;
    const mustRestoreOnHand    = wasOnHandDecremented && !movesOnHand(status);

    if (willDecrementOnHand || mustRestoreOnHand) {
      const { data: itemsRaw } = await db
        .from('order_items').select('quantity, business_inventory_id').eq('order_id', orderId);
      const items = (itemsRaw ?? []) as Array<{ quantity: number; business_inventory_id: string | null }>;

      // → FULFILLED: the plant leaves the property. THIS is the sale decrement — the only place
      //   on-hand drops for a delivery order, dated at true departure (D-52), which is the
      //   timestamp reconcile subtracts against. The commitment simultaneously stops being
      //   derived, because the order is no longer open (holdsCommitment(fulfilled) === false).
      if (willDecrementOnHand) {
        for (const it of items) {
          if (!it.business_inventory_id) continue;
          await adjustLotQty(db, businessId, it.business_inventory_id, -Number(it.quantity), 'fulfillment sale decrement',
            { actorUserId: statusActor, kind: 'sale', orderId, occurredAt: changedAt });
        }
        console.log('[TRACE:INVENTORY] D-52 fulfilled — on-hand decremented at departure', {
          orderId, lines: items.length, from: prevStatus,
        });
      }

      // → BACK OUT OF FULFILLED (e.g. fulfilled → cancelled): the units never left after all, so
      //   the on-hand decrement is reversed. Note what is NOT here: cancelling a PENDING order
      //   restores nothing, because nothing was ever taken. Under D-42 this branch restored
      //   unconditionally — correct then, and silently wrong the instant the decrement moved: it
      //   would have credited on-hand for a decrement that never happened, inventing stock the
      //   nursery does not physically have. An append-only ledger would have recorded that
      //   invention as fact.
      if (mustRestoreOnHand) {
        for (const it of items) {
          if (!it.business_inventory_id) continue;
          await adjustLotQty(db, businessId, it.business_inventory_id, Number(it.quantity), 'un-fulfill restore',
            { actorUserId: statusActor, kind: 'sale_reversal', orderId, occurredAt: changedAt });
        }
        console.log('[TRACE:INVENTORY] D-52 backed out of fulfilled — on-hand restored', {
          orderId, lines: items.length, from: prevStatus, to: status,
        });
      }
    } else if (status === 'cancelled') {
      // The common cancel: an open (pending/confirmed) order. Its commitment simply stops being
      // derived — available rises the moment the status lands. No stock movement, so no ledger row:
      // recording a movement here would assert a physical event that did not occur.
      console.log('[TRACE:INVENTORY] D-52 cancelled while open — commitment released, on-hand untouched (nothing was taken)', {
        orderId, from: prevStatus,
      });
    }

    const { error: stErr } = await db.from('orders').update({ status }).eq('id', orderId).eq('business_id', businessId);
    if (stErr) throw new Error(`Order status: ${stErr.message}`);

    // The event is written AFTER the status write succeeds — an event asserts that something
    // happened, so it must not be recorded for a transition that then failed to land. The reverse
    // ordering would let a thrown stErr leave a lie in an append-only log that cannot be retracted.
    //
    // event_type is DERIVED from the status (`order_${status}`), not a hand-maintained mapping:
    // ORDER_STATUSES is an OPEN decision (R-STATUS — David ratifies the set), so when a status is
    // added it emits correctly with no code change here. A switch would silently miss the new one.
    await recordOrderEvent(db, businessId, orderId, `order_${status}`, statusActor, changedAt,
      prevStatus ? `from ${prevStatus}` : undefined);

    console.log('[TRACE:ROSTER] order status changed', { orderId, from: prevStatus, to: status, actor: statusActor ?? 'NULL' });
    res.json({ ok: true, orderId, status });
  } catch (err: any) {
    console.error('[orders/submit:status]', err.message);
    res.status(500).json({ error: err.message });
  }
}
