import { createClient } from '@supabase/supabase-js';
import { fetchCommittedByLot, availableFrom } from '../src/lib/inventoryStates';

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  const businessId = (req.query.business_id as string) || (req.query.nursery_id as string);
  if (!businessId) return res.status(400).json({ error: 'business_id required' });

  try {
    const db = supabase();
    const todayStr = new Date().toISOString().slice(0, 10);

    const [ordersRes, cultivarPlantsRes, inventoryRes, businessRes] = await Promise.all([
      db.from('orders').select('id, total_amount, leakage_flag, created_at, status').eq('business_id', businessId),
      // identity count — cultivar_plants rows (one per QR tag/lot identity)
      db.from('cultivar_plants').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      // stock facts — business_inventory rows (qty * unit_cost for inventory value)
      db.from('business_inventory').select('qty, unit_cost, status').eq('business_id', businessId),
      db.from('businesses').select('accounting_company_id, name').eq('id', businessId).single(),
    ]);

    const orders         = ordersRes.data || [];
    const inventoryLots  = inventoryRes.data || [];
    const plant_count    = cultivarPlantsRes.count ?? 0;

    const todayOrders    = orders.filter((o: any) => o.created_at?.slice(0, 10) === todayStr);
    const todayRevenue   = todayOrders.reduce((s: number, o: any) => s + Number(o.total_amount), 0);
    const availableLots  = inventoryLots.filter((l: any) => l.status === 'available');
    const inventoryValue = availableLots.reduce((s: number, l: any) => s + (Number(l.qty) * Number(l.unit_cost ?? 0)), 0);
    const leakageCount   = orders.filter((o: any) => o.leakage_flag).length;

    // ── D-52: the three numbers ────────────────────────────────────────────────────────────
    // `available_count` used to be the SUM OF ON-HAND, which was accurate only while D-42
    // decremented at checkout (on-hand and available were then the same number). Now that stock
    // stays on the property until fulfillment, the two diverge, and a field NAMED available must
    // report what is genuinely sellable (D-9 — the surface does not get to keep a name it has
    // stopped earning). `on_hand_count` is added so the physical total is still reported, rather
    // than being quietly redefined out of the payload.
    const on_hand_count   = availableLots.reduce((s: number, l: any) => s + Number(l.qty), 0);
    const committedMap    = await fetchCommittedByLot(db, businessId);
    const committed_count = [...committedMap.values()].reduce((a, b) => a + b, 0);
    const available_count = availableFrom(on_hand_count, committed_count);

    return res.json({
      today_order_count: todayOrders.length,
      today_revenue:     todayRevenue,
      inventory_value:   inventoryValue,
      plant_count,
      on_hand_count,
      committed_count,
      available_count,
      leakage_count:     leakageCount,
      qb_connected:      !!businessRes.data?.accounting_company_id,
    });
  } catch (err: any) {
    console.error('[dashboard]', err);
    return res.status(500).json({ error: err?.message });
  }
}
