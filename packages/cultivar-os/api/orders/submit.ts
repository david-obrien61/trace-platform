import { createClient } from '@supabase/supabase-js';
import { sendNotification } from '../../../shared/src/notifications/send';
import { findOrCreateCustomer } from '../../../shared/src/business-logic/customerUpsert';
import { nettedQuantity, lineSubtotal } from '../../src/lib/netting';

const TAX_RATE_FALLBACK = 0.0825; // only for a business row predating the tax_rate column
const LARGE_CONTAINERS = ['15 gal', '30 gal', '45 gal', '60 gal', '100 gal'];

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    customer,
    lines,             // OrderLineInput[] — multi-item cart (each { plant, quantity })
    services,          // ServiceSelection[] — from the service_offerings model
    selectedTransport, // ServiceOffering | null — primary transport (delivery or self)
    plantingOffering,  // ServiceOffering | null — per-plant planting (Delivery + planting branch)
    plantingSelected,  // boolean — whether planting is attached
    nettingDeclined,
    serviceQuantities, // Record<offeringId, number> — owner-confirmed netted quantities
  } = req.body;
  const businessId: string = req.body.businessId || lines?.[0]?.plant?.business_id;

  if (!customer || !Array.isArray(lines) || lines.length === 0 || !businessId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Total plants across the cart — the denominator for a per-plant (per_unit) service.
  const plantCount = lines.reduce((s: number, l: any) => s + Number(l.quantity || 0), 0);
  if (plantCount <= 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = adminDb();

  try {
    // ── 1. Find or create customer ─────────────────────────────────────────
    const { customerId } = await findOrCreateCustomer(db, businessId, customer, 'qr-scan');

    // ── 2. Tax rate + price tier (business-level, read once) ────────────────
    const { data: bizTaxRow } = await db
      .from('businesses').select('tax_rate').eq('id', businessId).maybeSingle();
    const taxRate = Number((bizTaxRow as any)?.tax_rate ?? TAX_RATE_FALLBACK);

    // PRICE TIER at checkout (D-35) — READ WIRED, ADJUSTMENT HELD (AC-4). The tier→adjustment
    // MATH is undefined; per the buildspec STEP 5 STOP rule we apply NO adjustment (post == pre).
    const { data: custRow } = await db
      .from('customers').select('price_tier').eq('id', customerId).maybeSingle();
    const priceTier = (custRow as any)?.price_tier ?? null;
    console.log('[TRACE:PRICE] price_tier adjustment (order-level)', {
      customerId, priceTier, adjustmentApplied: false, note: 'tier math undefined — AC-4 hold',
    });

    // ── 3. Resolve + validate each cart line (server-authoritative sell_price per anchor) ──
    // D-34: two anchor lanes — a stock line (plant.stock_line_id set → read business_inventory
    // by that id) or a specimen (join cultivar_plants → its lot). Exactly one lane per line.
    // D-35: charge business_inventory.sell_price (retail), NEVER unit_cost. Server-authoritative;
    // the client-POSTed price is never trusted for the charge (tamper defense, per line).
    const resolvedLines: Array<{ plant: any; quantity: number; stockLineId: string | null; unitPrice: number; subtotal: number }> = [];
    let plantSubtotal = 0;
    let anyLargeContainer = false;

    for (const line of lines) {
      const plant = line.plant;
      const quantity = Number(line.quantity);
      const stockLineId: string | null = plant.stock_line_id ?? null;
      let serverSellPriceRaw: number | null | undefined;
      let stockLineSize: string | null = null;

      if (stockLineId) {
        const { data: invRow } = await db
          .from('business_inventory')
          .select('sell_price, size, status')
          .eq('id', stockLineId)
          .eq('business_id', businessId)
          .single();
        serverSellPriceRaw = (invRow as any)?.sell_price;
        stockLineSize      = (invRow as any)?.size ?? null;
        console.log('[TRACE:RESOLVE] order anchor — business_inventory (stock line)', { stockLineId });
      } else {
        const { data: invRow } = await db
          .from('cultivar_plants')
          .select('business_inventory ( sell_price )')
          .eq('id', plant.id)
          .eq('business_id', businessId)
          .single();
        serverSellPriceRaw = (invRow as any)?.business_inventory?.sell_price;
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
        const plantName = plant.common_name ?? plant.species ?? 'this item';
        console.log('[TRACE:PRICE] REFUSED — no sell_price set, sale blocked (no $0 order written)', {
          plantId: plant.id, plantName, serverSellPriceRaw,
        });
        return res.status(400).json({
          error: `No sale price set for ${plantName} — set a price in Inventory before selling.`,
          code: 'NO_SELL_PRICE',
        });
      }

      const unitPrice = serverSellPrice; // tier HOLD: no adjustment (AC-4)
      const sub = unitPrice * quantity;
      plantSubtotal += sub;

      // D-34: for a stock-line order the container is the lot's size (server-fetched).
      const container = stockLineId ? (stockLineSize ?? plant.current_container) : plant.current_container;
      if (LARGE_CONTAINERS.includes(container)) anyLargeContainer = true;

      console.log('[TRACE:PRICE] line — server-authoritative sell_price', {
        plantId: plant.id, unitPrice, quantity, subtotal: sub, anchor: stockLineId ? 'business_inventory_id' : 'plant_id',
      });

      resolvedLines.push({ plant, quantity, stockLineId, unitPrice, subtotal: sub });
    }

    // ── 4. Service amounts (attach-rule netting over the WHOLE cart) ─────────
    // qtyFor honors the owner-confirmed netted quantity (serviceQuantities), else applies
    // the rule (per_unit ? plantCount : 1). Same rule the client showed — display & charge agree.
    const transportMode = selectedTransport?.transport_mode ?? 'self';
    const qtyFor = (o: any): number => {
      const override = serviceQuantities?.[o.id];
      if (typeof override === 'number' && override > 0) return override;
      return nettedQuantity(o, plantCount);
    };

    const transportAmount = selectedTransport ? lineSubtotal(selectedTransport, qtyFor(selectedTransport)) : 0;

    // Planting — the SEPARATE per-plant service the "Delivery + planting" branch attaches
    // (delivery flat ×1 + planting per_unit ×N). Distinct from transport so both are charged.
    const plantingActive = !!(plantingSelected && plantingOffering);
    const plantingQty    = plantingActive ? qtyFor(plantingOffering) : 0;
    const plantingAmount = plantingActive ? lineSubtotal(plantingOffering, plantingQty) : 0;

    const nettingSelection = (services ?? []).find(
      (s: any) => s.offering?.trigger_transport_mode === 'self' && s.offering?.category === 'addon',
    );
    const nettingActive    = transportMode === 'self' && (nettingSelection?.selected ?? false) && !nettingDeclined;
    const nettingUnitPrice = nettingSelection?.offering?.price ?? 10;
    const nettingQty       = nettingActive && nettingSelection ? qtyFor(nettingSelection.offering) : 0;
    const nettingTotal     = nettingActive && nettingSelection ? lineSubtotal(nettingSelection.offering, nettingQty) : 0;

    const otherAddons = (services ?? []).filter(
      (s: any) => s.selected && s.offering?.category === 'addon' && !s.offering?.trigger_transport_mode,
    );
    const otherTotal = otherAddons.reduce((sum: number, s: any) => sum + lineSubtotal(s.offering, qtyFor(s.offering)), 0);

    console.log('[TRACE:CART] netting applied (server)', {
      plantCount, transportQty: selectedTransport ? qtyFor(selectedTransport) : 0,
      transportAmount, plantingActive, plantingQty, plantingAmount, nettingQty, nettingTotal, otherTotal,
    });

    const addonsAmount = transportAmount + plantingAmount + nettingTotal + otherTotal;
    const subtotal     = plantSubtotal + addonsAmount;
    const taxAmount    = Math.round(subtotal * taxRate * 100) / 100;
    const total        = subtotal + taxAmount;

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
    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
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
      })
      .select('id')
      .single();

    if (orderErr) throw new Error(`Order: ${orderErr.message}`);
    const orderId = order!.id;

    // ── 8. Order items — ONE row per cart line, each with its own D-34 anchor ──
    // one line = ONE anchor, never both: stock line → business_inventory_id (plant_id null);
    // specimen → plant_id.
    const itemRows = resolvedLines.map((rl) => {
      const row: Record<string, unknown> = {
        order_id:   orderId,
        quantity:   rl.quantity,
        unit_price: rl.unitPrice,   // server-authoritative sell_price (D-35)
        subtotal:   rl.subtotal,
      };
      if (rl.stockLineId) {
        row.business_inventory_id = rl.stockLineId;
        row.plant_id             = null;
      } else {
        row.plant_id             = rl.plant.id;
      }
      return row;
    });
    console.log('[TRACE:RESOLVE] order_items anchors', {
      count: itemRows.length,
      anchors: resolvedLines.map(rl => rl.stockLineId ? `inv:${rl.stockLineId}` : `plant:${rl.plant.id}`),
    });
    const { error: itemErr } = await db.from('order_items').insert(itemRows);
    if (itemErr) throw new Error(`Order item: ${itemErr.message}`);

    // ── 9. Order service selections (attach-rule netted quantities) ─────────
    const selectionRows: any[] = [];

    if (selectedTransport) {
      selectionRows.push({
        order_id:              orderId,
        service_offering_id:   selectedTransport.id,
        quantity:              qtyFor(selectedTransport),
        unit_price_at_time:    selectedTransport.price,
        subtotal:              transportAmount,
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
      });
    }

    if (nettingActive && nettingSelection?.offering?.id) {
      selectionRows.push({
        order_id:              orderId,
        service_offering_id:   nettingSelection.offering.id,
        quantity:              nettingQty,
        unit_price_at_time:    nettingUnitPrice,
        subtotal:              nettingTotal,
      });
    }

    for (const s of otherAddons) {
      selectionRows.push({
        order_id:              orderId,
        service_offering_id:   s.offering.id,
        quantity:              qtyFor(s.offering),
        unit_price_at_time:    s.offering.price,
        subtotal:              lineSubtotal(s.offering, qtyFor(s.offering)),
      });
    }

    if (selectionRows.length > 0) {
      const { error: selErr } = await db.from('order_service_selections').insert(selectionRows);
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
            quantity:      plantCount,
          },
        }).catch((err: any) => console.error('[leakage-alert]', err.message));
      }
    }

    res.json({ orderId, invoiceNumber, total, subtotal, taxAmount });

  } catch (err: any) {
    console.error('[orders/submit]', err.message);
    res.status(500).json({ error: err.message });
  }
}
