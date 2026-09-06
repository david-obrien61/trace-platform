import { createClient } from '@supabase/supabase-js';
import { fetchCommittedByLot, availableFrom } from '../src/lib/inventoryStates';
import { callerIsMember, callerCan } from '../../shared/src/auth/callerPermission';
import { isAssessable, REAL_BUSINESS_PGRST } from '../../shared/src/business-logic/orderKind';
import { dayWindow, weekWindow } from '../src/lib/dashboardWindows';

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  const businessId = (req.query.business_id as string) || (req.query.nursery_id as string);
  if (!businessId) return res.status(400).json({ error: 'business_id required' });

  // 🔴 CALLER AUTHORITY — MB_D-015. ADDED 2026-07-27; this endpoint had NONE.
  // `business_id` came off the QUERY STRING and every read below runs through the SERVICE KEY,
  // RLS bypassed. Anyone reaching the URL could read ANY tenant's order count, REVENUE, inventory
  // value, leakage count and QuickBooks connection state by naming its id. A read, not a write —
  // and still a complete cross-tenant disclosure of the business's numbers.
  //
  // MEMBERSHIP is the bar for the dashboard as a whole: every role sees a dashboard. Inventing a
  // permission string here would be a fake gate.
  const authHeader = req.headers?.authorization;
  if (!(await callerIsMember(authHeader, businessId))) {
    console.log('[TRACE:AUTHORITY] dashboard REFUSED — caller is not a member of this business', { businessId });
    return res.status(403).json({ error: 'Not authorized to read this business', code: 'FORBIDDEN' });
  }
  // …but membership answers "may you see this TENANT", never "may you see this FIELD". The payload
  // mixes operational counts with CONFIDENTIAL money: `inventory_value` is derived from unit_cost
  // and `today_revenue` from order totals. Both are withheld from a caller without `costs:read`,
  // returned as null rather than 0 — a redaction must not read as a real figure (D-9).
  // This is the 3b projection pattern applied at the api layer; the table-level split is 3b's job.
  const seesCosts = await callerCan(authHeader, businessId, 'costs:read');

  try {
    const db = supabase();

    const [ordersRes, cultivarPlantsRes, inventoryRes, businessRes] = await Promise.all([
      // ══════════════════════════════════════════════════════════════════════════════════════
      // 🔴 THE KIND FILTER, WHICH THIS QUERY HAD NONE OF. Every order for the business came
      // back and `leakage_count` was computed over the lot, while `Dashboard.tsx` excluded
      // captured invoices before counting the same thing. One number, two definitions —
      // and the moment a test order exists it lands in the identical hole.
      //
      // The exclusion is `REAL_BUSINESS_PGRST` from the ONE module that owns the question
      // (§6 r8). It is spelled `.or(is.null, not.in.(...))` and NOT `.neq(...)` because a
      // bare .neq drops every NULL row — which is every ordinary checkout order this
      // platform has written. See orderKind.ts for the trap in full.
      // ══════════════════════════════════════════════════════════════════════════════════════
      db.from('orders')
        .select('id, total_amount, leakage_flag, created_at, sale_date, order_kind, status')
        .eq('business_id', businessId)
        .neq('status', 'cancelled')
        .or(REAL_BUSINESS_PGRST),
      // identity count — cultivar_plants rows (one per QR tag/lot identity)
      db.from('cultivar_plants').select('id', { count: 'exact', head: true }).eq('business_id', businessId),
      // stock facts — business_inventory rows (qty * unit_cost for inventory value)
      // `.is('retired_at', null)` — inventory VALUE must not count rows a catalogue import hid.
      db.from('business_inventory').select('qty, unit_cost, status').eq('business_id', businessId).is('retired_at', null),
      db.from('businesses').select('accounting_company_id, name').eq('id', businessId).single(),
    ]);

    const orders         = ordersRes.data || [];
    const inventoryLots  = inventoryRes.data || [];
    const plant_count    = cultivarPlantsRes.count ?? 0;

    // ── WHEN A SALE COUNTS: `sale_date`, falling back to `created_at` ───────────────────────
    // 🔴 THIS ENDPOINT KEYED ON `created_at` ALONE, which is the moment a ROW WAS WRITTEN.
    // `Dashboard.tsx` fixed exactly this in its own copy and recorded why: six sales made
    // across five earlier days, backfilled in one afternoon, reported $14,370.21 as TODAY'S
    // revenue. The server copy never got the fix, so the two screens would have answered the
    // same question with different numbers — the STD-011 shape, one fact in two places.
    // The windows come from the SAME module the client uses, so they cannot drift either.
    const day  = dayWindow();
    const week = weekWindow();
    const inWindow = (o: any, w: { startDate: string; endDate: string }) =>
      o.sale_date ? (o.sale_date >= w.startDate && o.sale_date < w.endDate)
                  : (o.created_at?.slice(0, 10) >= w.startDate && o.created_at?.slice(0, 10) < w.endDate);

    const todayOrders    = orders.filter((o: any) => inWindow(o, day));
    const todayRevenue   = todayOrders.reduce((s: number, o: any) => s + Number(o.total_amount), 0);
    const availableLots  = inventoryLots.filter((l: any) => l.status === 'available');
    const inventoryValue = availableLots.reduce((s: number, l: any) => s + (Number(l.qty) * Number(l.unit_cost ?? 0)), 0);

    // ── LEAKAGE: THE SAME QUESTION THE CLIENT BANNER ASKS, ASKED THE SAME WAY ───────────────
    // 🔴 TWO CORRECTIONS IN ONE LINE, and neither is cosmetic. (1) The window: this counted
    // EVERY order the business had ever taken, against a client banner that counts THIS WEEK.
    // (2) The predicate: `isAssessable` excludes a captured invoice, whose `leakage_flag` is
    // false because the column is NOT NULL — false meaning UNEVALUATED, not "nothing leaked".
    // Counting those let unassessed sales prove a clean bill of health.
    // `assessable_sales` and `sales_in_window` ship alongside so the count can never be read
    // without its denominator (a pass over an empty set is not a pass).
    const weekOrders     = orders.filter((o: any) => inWindow(o, week));
    const assessable     = weekOrders.filter((o: any) => isAssessable(o.order_kind));
    const leakageCount   = assessable.filter((o: any) => o.leakage_flag === true).length;

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
      today_revenue:     seesCosts ? todayRevenue   : null,
      inventory_value:   seesCosts ? inventoryValue : null,
      plant_count,
      on_hand_count,
      committed_count,
      available_count,
      leakage_count:     leakageCount,
      // The denominators, so `leakage_count: 0` can be told apart from "nothing was measured".
      sales_in_window:   weekOrders.length,
      assessable_sales:  assessable.length,
      leakage_window:    { start: week.startDate, end: week.endDate },
      qb_connected:      !!businessRes.data?.accounting_company_id,
    });
  } catch (err: any) {
    console.error('[dashboard]', err);
    return res.status(500).json({ error: err?.message });
  }
}
