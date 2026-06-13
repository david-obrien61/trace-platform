import { createClient } from '@supabase/supabase-js';

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
    const available_count = availableLots.reduce((s: number, l: any) => s + Number(l.qty), 0);
    const leakageCount   = orders.filter((o: any) => o.leakage_flag).length;

    return res.json({
      today_order_count: todayOrders.length,
      today_revenue:     todayRevenue,
      inventory_value:   inventoryValue,
      plant_count,
      available_count,
      leakage_count:     leakageCount,
      qb_connected:      !!businessRes.data?.accounting_company_id,
    });
  } catch (err: any) {
    console.error('[dashboard]', err);
    return res.status(500).json({ error: err?.message });
  }
}
