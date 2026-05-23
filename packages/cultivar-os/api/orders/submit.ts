import { createClient } from '@supabase/supabase-js';

const TAX_RATE = 0.0825;
const LARGE_CONTAINERS = ['15 gal', '30 gal', '45 gal', '60 gal', '100 gal'];

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

function buildTransportNote(transport: string, nettingDeclined: boolean, nettingActive: boolean): string {
  if (transport !== 'self') return 'LAWNS staff transport';
  if (nettingActive && !nettingDeclined) return 'Customer self-transport — netting purchased';
  return 'Customer self-transport — netting declined, Texas TCC Ch.725 waiver acknowledged';
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customer, plant, quantity, addons, transport, nettingDeclined, nettingPrice, nurseryId } = req.body;

  if (!customer || !plant || !quantity || !nurseryId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = adminDb();

  try {
    // ── 1. Find or create customer ─────────────────────────────────────────
    let customerId: string;

    const { data: existing } = await db
      .from('customers')
      .select('id')
      .eq('nursery_id', nurseryId)
      .eq('email', customer.email)
      .limit(1);

    if (existing && existing.length > 0) {
      customerId = existing[0].id;
      await db.from('customers').update({
        first_name:       customer.first_name,
        last_name:        customer.last_name,
        phone:            customer.phone ?? null,
        address_line1:    customer.address_line1 ?? null,
        city:             customer.city ?? null,
        state:            customer.state ?? 'TX',
        zip:              customer.zip ?? null,
        marketing_opt_in: customer.marketing_opt_in ?? true,
      }).eq('id', customerId);
    } else {
      const { data: newCustomer, error: custErr } = await db
        .from('customers')
        .insert({
          nursery_id:       nurseryId,
          first_name:       customer.first_name,
          last_name:        customer.last_name,
          email:            customer.email,
          phone:            customer.phone ?? null,
          address_line1:    customer.address_line1 ?? null,
          city:             customer.city ?? null,
          state:            customer.state ?? 'TX',
          zip:              customer.zip ?? null,
          marketing_opt_in: customer.marketing_opt_in ?? true,
          source:           'qr-scan',
        })
        .select('id')
        .single();

      if (custErr) throw new Error(`Customer: ${custErr.message}`);
      customerId = newCustomer!.id;
    }

    // ── 2. Calculate totals ────────────────────────────────────────────────
    const isSelf = transport === 'self';
    const isInstall = transport === 'install';
    const nettingActive = isSelf && !nettingDeclined;

    const nettingDbAddon = addons.find((a: any) => a.addon.trigger_rule === 'transport=self');
    const nettingUnitPrice = nettingDbAddon?.addon.price_per_plant ?? nettingPrice;
    const nettingTotal = nettingActive ? nettingUnitPrice * quantity : 0;

    const alwaysAddons = addons.filter(
      (a: any) => a.selected && a.addon.trigger_rule === 'always',
    );
    const alwaysTotal = alwaysAddons.reduce(
      (sum: number, a: any) => sum + a.addon.price_per_plant * quantity,
      0,
    );

    const installAmount = isInstall ? (plant.install_price ?? 0) * quantity : 0;

    const plantSubtotal = plant.base_price * quantity;
    const addonsAmount  = nettingTotal + alwaysTotal + installAmount;
    const subtotal      = plantSubtotal + addonsAmount;
    const taxAmount     = Math.round(subtotal * TAX_RATE * 100) / 100;
    const total         = subtotal + taxAmount;

    // ── 3. Leakage flag ────────────────────────────────────────────────────
    const isLargeContainer = LARGE_CONTAINERS.includes(plant.current_container);
    const leakageFlag = isLargeContainer && addonsAmount === 0;

    // ── 4. Transport note ──────────────────────────────────────────────────
    const transportNote = buildTransportNote(transport, nettingDeclined, nettingActive);

    // ── 5. Invoice number ──────────────────────────────────────────────────
    const now = new Date();
    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
    const seq = String(now.getMinutes() * 60 + now.getSeconds()).padStart(3, '0');
    const invoiceNumber = `CLV-${datePart}-${seq}`;

    // ── 6. Create order ────────────────────────────────────────────────────
    const { data: order, error: orderErr } = await db
      .from('orders')
      .insert({
        nursery_id:       nurseryId,
        customer_id:      customerId,
        transport_method: transport,
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

    // ── 8. Order addons ────────────────────────────────────────────────────
    if (nettingActive && nettingDbAddon) {
      await db.from('order_addons').insert({
        order_id:   orderId,
        addon_id:   nettingDbAddon.addon.id,
        quantity,
        unit_price: nettingUnitPrice,
        subtotal:   nettingTotal,
      });
    }
    for (const ca of alwaysAddons) {
      await db.from('order_addons').insert({
        order_id:   orderId,
        addon_id:   ca.addon.id,
        quantity,
        unit_price: ca.addon.price_per_plant,
        subtotal:   ca.addon.price_per_plant * quantity,
      });
    }

    // ── 9. Reserve plant ───────────────────────────────────────────────────
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
