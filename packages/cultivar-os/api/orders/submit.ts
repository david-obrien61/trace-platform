import { createClient } from '@supabase/supabase-js';

const TAX_RATE        = 0.0825;
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
    let customerId: string;

    const { data: existing } = await db
      .from('customers')
      .select('id')
      .eq('business_id', businessId)
      .eq('email', customer.email)
      .limit(1);

    if (existing && existing.length > 0) {
      customerId = existing[0].id;
      await db.from('customers').update({
        first_name:       customer.first_name,
        last_name:        customer.last_name,
        phone:            customer.phone    ?? null,
        address_line1:    customer.address_line1 ?? null,
        city:             customer.city     ?? null,
        state:            customer.state    ?? 'TX',
        zip:              customer.zip      ?? null,
        marketing_opt_in: customer.marketing_opt_in ?? true,
      }).eq('id', customerId);
    } else {
      const { data: newCustomer, error: custErr } = await db
        .from('customers')
        .insert({
          business_id:      businessId,
          first_name:       customer.first_name,
          last_name:        customer.last_name,
          email:            customer.email,
          phone:            customer.phone    ?? null,
          address_line1:    customer.address_line1 ?? null,
          city:             customer.city     ?? null,
          state:            customer.state    ?? 'TX',
          zip:              customer.zip      ?? null,
          marketing_opt_in: customer.marketing_opt_in ?? true,
          source:           'qr-scan',
        })
        .select('id')
        .single();

      if (custErr) throw new Error(`Customer: ${custErr.message}`);
      customerId = newCustomer!.id;
    }

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

    const plantSubtotal = Number(plant.base_price) * quantity;
    const addonsAmount  = transportAmount + nettingTotal + otherTotal;
    const subtotal      = plantSubtotal + addonsAmount;
    const taxAmount     = Math.round(subtotal * TAX_RATE * 100) / 100;
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
      unit_price: plant.base_price,
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

    // ── 10. Reserve plant ──────────────────────────────────────────────────
    await db
      .from('plants')
      .update({ status: 'reserved', updated_at: new Date().toISOString() })
      .eq('id', plant.id);

    res.json({ orderId, invoiceNumber, total, subtotal, taxAmount });

  } catch (err: any) {
    console.error('[orders/submit]', err.message);
    res.status(500).json({ error: err.message });
  }
}
