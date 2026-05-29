import { createClient } from '@supabase/supabase-js';

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  const nurseryId = req.query.nursery_id as string | undefined;
  if (!nurseryId) return res.status(400).json({ error: 'nursery_id required' });

  try {
    const db = supabase();
    const todayStr = new Date().toISOString().slice(0, 10);

    const [ordersRes, plantsRes, nurseryRes] = await Promise.all([
      db.from('orders').select('id, total_amount, leakage_flag, created_at, status').eq('nursery_id', nurseryId),
      db.from('plants').select('base_price, status').eq('nursery_id', nurseryId),
      db.from('nurseries').select('qb_realm_id, name').eq('id', nurseryId).single(),
    ]);

    const orders = ordersRes.data || [];
    const plants = plantsRes.data || [];

    const todayOrders = orders.filter((o: any) => o.created_at?.slice(0, 10) === todayStr);
    const todayRevenue = todayOrders.reduce((s: number, o: any) => s + Number(o.total_amount), 0);
    const inventoryValue = plants
      .filter((p: any) => p.status === 'available')
      .reduce((s: number, p: any) => s + Number(p.base_price), 0);
    const leakageCount = orders.filter((o: any) => o.leakage_flag).length;

    return res.json({
      today_order_count: todayOrders.length,
      today_revenue: todayRevenue,
      inventory_value: inventoryValue,
      plant_count: plants.length,
      available_count: plants.filter((p: any) => p.status === 'available').length,
      leakage_count: leakageCount,
      qb_connected: !!nurseryRes.data?.qb_realm_id,
    });
  } catch (err: any) {
    console.error('[dashboard]', err);
    return res.status(500).json({ error: err?.message });
  }
}
