import { createClient } from '@supabase/supabase-js';
import { sendNotification } from '../../../shared/src/notifications/send';
import { findOrCreateCustomer } from '../../../shared/src/business-logic/customerUpsert';

const TAX_RATE_FALLBACK = 0.0825; // only for a business row predating the tax_rate column
const LARGE_CONTAINERS = ['15 gal', '30 gal', '45 gal', '60 gal', '100 gal'];

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

// Derive the legacy transport_method value from a service offering.
// Kept for backward compat with delivery routing query and historical data.
function deriveTransportMethod(t: any): string {
  if (t.transport_mode === 'self') return 'self';
  if (t.transport_mode === 'staff' && t.price_type === 'per_unit') return 'install';
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
    customer, plant, quantity,
    services,          // ServiceSelection[] — from the new service_offerings model
    selectedTransport, // ServiceOffering | null
    nettingDeclined,
  } = req.body;
  const businessId: string = req.body.businessId || plant?.business_id;

  if (!customer || !plant || !quantity || !businessId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = adminDb();

  try {
    // ── 1. Find or create customer ─────────────────────────────────────────
    // Shared write path (extracted to customerUpsert so an OCR'd invoice can create a
    // customer without an order). Dedup-by-email + 'qr-scan' provenance preserved.
    const { customerId } = await findOrCreateCustomer(db, businessId, customer, 'qr-scan');

    // ── 2. Calculate totals ────────────────────────────────────────────────
    const transportMode = selectedTransport?.transport_mode ?? 'self';

    // Transport amount (flat or per-unit)
    const transportAmount = selectedTransport
      ? selectedTransport.price_type === 'per_unit'
        ? Number(selectedTransport.price) * quantity
        : Number(selectedTransport.price)
      : 0;

    // Netting
    const nettingSelection = (services ?? []).find(
      (s: any) => s.offering?.trigger_transport_mode === 'self' && s.offering?.category === 'addon',
    );
    const nettingActive    = transportMode === 'self' && (nettingSelection?.selected ?? false);
    const nettingUnitPrice = nettingSelection?.offering?.price ?? 10;
    const nettingTotal     = nettingActive ? nettingUnitPrice * quantity : 0;

    // Other addons
    const otherAddons = (services ?? []).filter(
      (s: any) => s.selected && s.offering?.category === 'addon' && !s.offering?.trigger_transport_mode,
    );
    const otherTotal = otherAddons.reduce((sum: number, s: any) => {
      const p = s.offering.price_type === 'per_unit'
        ? Number(s.offering.price) * quantity
        : Number(s.offering.price);
      return sum + p;
    }, 0);

    // AUTHORITATIVE sell price — server-fetched, NEVER the client-POSTed value. The charge
    // must not be client-controllable (price-tamper hole, decision 2026-06-21 Part B). The
    // customer-facing DISPLAY is unchanged; only the CHARGED amount is server-authoritative.
    // D-35: the cart charges business_inventory.sell_price (the retail price), NEVER unit_cost
    // (what the grower paid — cost, from receipts). Cost and price never conflate here.
    const { data: invRow } = await db
      .from('cultivar_plants')
      .select('business_inventory ( sell_price )')
      .eq('id', plant.id)
      .eq('business_id', businessId)
      .single();
    const serverSellPriceRaw = (invRow as any)?.business_inventory?.sell_price;
    const serverSellPrice    = Number(serverSellPriceRaw ?? 0);
    const clientClaimedPrice = Number(plant.business_inventory?.sell_price ?? 0);
    if (clientClaimedPrice !== serverSellPrice) {
      console.log('[TRACE:PRICE] sell_price mismatch — charging SERVER value (tamper defeated)', {
        plantId: plant.id, clientClaimedPrice, serverSellPrice,
      });
    }
    console.log('[TRACE:PRICE] server-authoritative sell_price read column=sell_price', {
      plantId: plant.id, serverSellPrice, quantity,
    });

    // ── $0/NULL REFUSAL (Surface Honesty, D-9) ─────────────────────────────
    // A lot with no sell_price set is UNPRICED — refuse the sale rather than silently
    // writing a $0 order. The cart surfaces this error instead of completing.
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

    // ── PRICE TIER at checkout (D-35) — READ WIRED, ADJUSTMENT HELD (AC-4) ──
    // The resolved customer's price_tier is read + logged here. The tier→adjustment
    // MATH is NOT yet defined anywhere (customers.price_tier = retail/contractor/wholesale
    // does not map to any config of adjustment values; the Cost-to-Produce tiers use
    // different names). Per the buildspec STEP 5 STOP rule, we do NOT invent tier math —
    // no adjustment is applied until David settles it (settle-once, AC-4). Post == pre today.
    const { data: custRow } = await db
      .from('customers').select('price_tier').eq('id', customerId).maybeSingle();
    const priceTier            = (custRow as any)?.price_tier ?? null;
    const tierAdjustedUnitPrice = serverSellPrice; // HOLD: no adjustment — mechanism undefined (AC-4)
    console.log('[TRACE:PRICE] price_tier adjustment', {
      customerId, priceTier, prePrice: serverSellPrice, postPrice: tierAdjustedUnitPrice,
      adjustmentApplied: false, note: 'tier math undefined — AC-4 hold, no adjustment applied',
    });
    // AUTHORITATIVE tax rate — the business's own setting (businesses.tax_rate, editable in
    // Settings), server-fetched so the invoiced tax matches the displayed tax (CartReview reads
    // the same column). Falls back to the constant only for a row predating the column.
    const { data: bizTaxRow } = await db
      .from('businesses').select('tax_rate').eq('id', businessId).maybeSingle();
    const taxRate = Number((bizTaxRow as any)?.tax_rate ?? TAX_RATE_FALLBACK);

    const plantSubtotal = tierAdjustedUnitPrice * quantity;
    const addonsAmount  = transportAmount + nettingTotal + otherTotal;
    const subtotal      = plantSubtotal + addonsAmount;
    const taxAmount     = Math.round(subtotal * taxRate * 100) / 100;
    const total         = subtotal + taxAmount;

    // ── 3. Leakage flag (missed add-on opportunities) ──────────────────────
    const isLargeContainer = LARGE_CONTAINERS.includes(plant.current_container);
    const leakageFlag      = isLargeContainer && (nettingTotal + otherTotal) === 0;

    // ── 4. Transport metadata ──────────────────────────────────────────────
    const transportMethod = deriveTransportMethod(selectedTransport ?? { transport_mode: 'self', price_type: 'flat' });
    const transportNote   = buildTransportNote(transportMode, nettingDeclined, nettingActive);

    // ── 5. Invoice number ──────────────────────────────────────────────────
    const now  = new Date();
    const dp   = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq  = String(now.getMinutes() * 60 + now.getSeconds()).padStart(3, '0');
    const invoiceNumber = `CLV-${dp}-${seq}`;

    // ── 6. Create order ────────────────────────────────────────────────────
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

    // ── 7. Order item ──────────────────────────────────────────────────────
    const { error: itemErr } = await db.from('order_items').insert({
      order_id:   orderId,
      plant_id:   plant.id,
      quantity,
      unit_price: tierAdjustedUnitPrice,   // server-authoritative sell_price (D-35), not the client-POSTed value
      subtotal:   plantSubtotal,
    });
    if (itemErr) throw new Error(`Order item: ${itemErr.message}`);

    // ── 8. Order service selections (new model) ────────────────────────────
    const selectionRows: any[] = [];

    // Transport offering
    if (selectedTransport) {
      selectionRows.push({
        order_id:              orderId,
        service_offering_id:   selectedTransport.id,
        quantity:              selectedTransport.price_type === 'per_unit' ? quantity : 1,
        unit_price_at_time:    selectedTransport.price,
        subtotal:              transportAmount,
      });
    }

    // Netting
    if (nettingActive && nettingSelection?.offering?.id) {
      selectionRows.push({
        order_id:              orderId,
        service_offering_id:   nettingSelection.offering.id,
        quantity,
        unit_price_at_time:    nettingUnitPrice,
        subtotal:              nettingTotal,
      });
    }

    // Other addons
    for (const s of otherAddons) {
      const amt = s.offering.price_type === 'per_unit'
        ? Number(s.offering.price) * quantity
        : Number(s.offering.price);
      selectionRows.push({
        order_id:              orderId,
        service_offering_id:   s.offering.id,
        quantity:              s.offering.price_type === 'per_unit' ? quantity : 1,
        unit_price_at_time:    s.offering.price,
        subtotal:              amt,
      });
    }

    if (selectionRows.length > 0) {
      const { error: selErr } = await db.from('order_service_selections').insert(selectionRows);
      if (selErr) throw new Error(`Service selections: ${selErr.message}`);
    }

    // ── 9. Compliance audit records ────────────────────────────────────────
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

    // ── 10. Reserve inventory lot ─────────────────────────────────────────
    // Stock state lives on business_inventory, not cultivar_plants (identity-only after untangle).
    // Skip if inventory_id is null — lot population is sequenced separately.
    if (plant.inventory_id) {
      await db
        .from('business_inventory')
        .update({ status: 'reserved', updated_at: new Date().toISOString() })
        .eq('id', plant.inventory_id);
    }

    // ── 11. Leakage alert to business owner (fire-and-forget) ──────────────
    if (leakageFlag) {
      const { data: biz } = await db
        .from('businesses')
        .select('phone, email')
        .eq('id', businessId)
        .single();

      if (biz?.phone || biz?.email) {
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
            plantName:     plant.common_name ?? plant.species,
            container:     plant.current_container,
            invoiceNumber,
            quantity,
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
