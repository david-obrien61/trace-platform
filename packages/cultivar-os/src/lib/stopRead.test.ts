/**
 * ── stopRead — one read of a stop, and a failed read is never an empty order ────────────────────
 *
 * WHAT THIS GUARDS (ledger #301): the schedule, the route and the order screen read a stop through
 * this one function. It asserts the three scopes filter the way each screen needs, that the lines are
 * a top-level read grouped by order, and the READ-HONESTY cases the stop card depends on:
 *   · a viewer without `order_items:read` issues NO lines query (RLS would hand them zero rows, and
 *     zero rows is what "No items recorded" asserts);
 *   · a lines query that ERRORS leaves every linked stop `unread`, not `no_lines`.
 *
 * The fake records every table and filter and can answer each table with data, an error, or the
 * 42703 a missing column produces (§6 r19 — a double that cannot refuse proves nothing).
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/stopRead.test.ts --bundle --platform=node --format=cjs | node
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { readStops, stopLoadOf, orderStatusOf, type StopRead } from './stopRead';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

interface Call { table: string; cols: string; filters: string[] }
type Result = { data: unknown; error: { message: string; code?: string } | null };

function fakeDb(handlers: Partial<Record<string, (call: Call) => Result>>) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const call: Call = { table, cols: '', filters: [] };
      calls.push(call);
      const b = {
        select(c: string) { call.cols = c; return b; },
        eq(k: string, v: unknown) { call.filters.push(`eq ${k} ${String(v)}`); return b; },
        neq(k: string, v: unknown) { call.filters.push(`neq ${k} ${String(v)}`); return b; },
        or(s: string) { call.filters.push(`or ${s}`); return b; },
        in(k: string, v: unknown[]) { call.filters.push(`in ${k} ${v.join(',')}`); return b; },
        order() { return b; },
        limit() { return b; },
        then(resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) {
          const h = handlers[table];
          return Promise.resolve(h ? h(call) : { data: [], error: null }).then(resolve, reject);
        },
      };
      return b;
    },
  };
  return { db: db as unknown as SupabaseClient, calls };
}

const stop = (id: string, order_id: string | null) => ({
  id, order_id, customer_id: 'c1', delivery_date: '2026-09-12', address_line1: '1 A St', city: 'Leander',
  state: 'TX', zip: '78641', status: 'scheduled', service_type: null, notes: null, created_at: '2026-09-01',
  started_at: null, completed_at: null, review_asked_at: null, review_ask_outcome: null, customers: null,
});
const STOPS = [stop('s-a', 'o1'), stop('s-b', 'o2'), stop('s-c', null), stop('s-d', 'o1')];
const LINES = [
  { order_id: 'o1', quantity: 2, description: 'Live Oak - 45 Gallon', sku: 'LO45', business_inventory_id: null, business_inventory: null },
  { order_id: 'o1', quantity: 1, description: 'Trip Charge', sku: 'TC', business_inventory_id: null, business_inventory: null },
];
const happy = {
  deliveries: () => ({ data: STOPS, error: null }),
  orders: () => ({ data: [{ id: 'o1', status: 'invoiced' }, { id: 'o2', status: 'fulfilled' }], error: null }),
  order_items: () => ({ data: LINES, error: null }),
};

function value(r: Awaited<ReturnType<typeof readStops>>): StopRead | null { return r.ok ? r.value : null; }

async function main(): Promise<void> {
  // ══ A. THE THREE SCOPES ════════════════════════════════════════════════════════════════════
  {
    const { db, calls } = fakeDb(happy);
    await readStops(db, 'biz-1', { kind: 'day', date: '2026-09-12' }, { readLines: true });
    const f = calls[0].filters;
    ok(calls[0].table === 'deliveries', 'A1 the first read is the stops');
    ok(f.includes('eq business_id biz-1') && f.includes('neq status cancelled'), 'A2 tenant-scoped, cancelled excluded (AC-3)');
    ok(f.includes('eq delivery_date 2026-09-12'), 'A3 the route/day scope asks for that day');
  }
  {
    const { db, calls } = fakeDb(happy);
    await readStops(db, 'biz-1', { kind: 'window', from: '2026-08-12' }, { readLines: true });
    ok(calls[0].filters.includes('or delivery_date.is.null,delivery_date.gte.2026-08-12'), 'A4 the schedule window keeps undated stops');
  }
  {
    const { db, calls } = fakeDb(happy);
    await readStops(db, 'biz-1', { kind: 'order', orderId: 'o1' }, { readLines: true });
    ok(calls[0].filters.includes('eq order_id o1'), 'A5 the order screen asks for its own stops');
  }

  // ══ B. LINES — top-level, deduped, grouped ═════════════════════════════════════════════════
  {
    const { db, calls } = fakeDb(happy);
    const v = value(await readStops(db, 'biz-1', { kind: 'day', date: '2026-09-12' }, { readLines: true }));
    const lineCall = calls.find(c => c.table === 'order_items');
    ok(!!lineCall && lineCall.filters.includes('in order_id o1,o2'), 'B1 ONE lines query over the linked orders, deduped, no null');
    ok(!!lineCall && /quantity, description, sku/.test(lineCall.cols) && /business_inventory \( name, size \)/.test(lineCall.cols),
      'B2 the lines carry quantity, description, sku — and the lot name + size a checkout line needs');
    ok(/order_id/.test(calls[0].cols) && /customers \(/.test(calls[0].cols), 'B3 the stop read carries order_id and the customer');
    ok(!!v && v.linesByOrderId.get('o1')?.length === 2 && !v.linesByOrderId.has('o2'), 'B4 grouped by order');
    ok(!!v && orderStatusOf(v, STOPS[0]) === 'invoiced' && orderStatusOf(v, STOPS[2]) === null, 'B5 statuses by order');
    if (v) {
      ok(stopLoadOf(v, STOPS[0]).state === 'lines', 'B6 a stop whose order has lines → lines');
      ok(stopLoadOf(v, STOPS[3]).state === 'lines', 'B7 two stops on one order both see its lines');
      ok(stopLoadOf(v, STOPS[1]).state === 'no_lines', 'B8 an order with none → no_lines');
      ok(stopLoadOf(v, STOPS[2]).state === 'no_order', 'B9 a stop with no order → no_order');
    }
  }

  // ══ C. READ HONESTY ════════════════════════════════════════════════════════════════════════
  {
    const { db, calls } = fakeDb(happy);
    const v = value(await readStops(db, 'biz-1', { kind: 'day', date: '2026-09-12' }, { readLines: false }));
    ok(!calls.some(c => c.table === 'order_items'), 'C1 🔴 without order_items:read NO lines query is issued');
    ok(!!v && stopLoadOf(v, STOPS[1]).state === 'withheld', 'C2 and the stop says WITHHELD, not "no items"');
  }
  {
    const { db } = fakeDb({ ...happy, order_items: () => ({ data: null, error: { message: 'boom' } }) });
    const v = value(await readStops(db, 'biz-1', { kind: 'day', date: '2026-09-12' }, { readLines: true }));
    ok(!!v && v.linesRead === false, 'C3 a failed lines read is recorded');
    ok(!!v && stopLoadOf(v, STOPS[1]).state === 'unread', 'C4 🔴 and an order it could not read is UNREAD, never "no items"');
  }
  {
    const { db } = fakeDb({ ...happy, orders: () => ({ data: null, error: { message: 'boom' } }) });
    const r = await readStops(db, 'biz-1', { kind: 'day', date: '2026-09-12' }, { readLines: true });
    ok(r.ok && r.value.orderStatusById.size === 0, 'C5 a failed status read degrades to no notice, not to a failed page');
  }

  // ══ D. THE MIGRATION FALLBACK AND THE HARD FAILURE ═════════════════════════════════════════
  {
    let n = 0;
    const { db, calls } = fakeDb({
      ...happy,
      deliveries: () => (++n === 1
        ? { data: null, error: { message: 'column deliveries.started_at does not exist', code: '42703' } }
        : { data: STOPS, error: null }),
    });
    const r = await readStops(db, 'biz-1', { kind: 'day', date: '2026-09-12' }, { readLines: true });
    const stopCalls = calls.filter(c => c.table === 'deliveries');
    ok(r.ok && r.value.fulfilmentColumns === false, 'D1 42703 → the core read, remembered');
    ok(stopCalls.length === 2 && /started_at/.test(stopCalls[0].cols) && !/started_at/.test(stopCalls[1].cols), 'D2 the retry drops the four columns');
  }
  {
    const { db } = fakeDb({ deliveries: () => ({ data: null, error: { message: 'permission denied for table deliveries' } }) });
    const r = await readStops(db, 'biz-1', { kind: 'day', date: '2026-09-12' }, { readLines: true });
    ok(!r.ok && /permission denied/.test(r.error), 'D3 a failed stop read is a failure with its reason, never an empty day');
  }
  {
    const { db, calls } = fakeDb({ ...happy, deliveries: () => ({ data: [stop('s-z', null)], error: null }) });
    await readStops(db, 'biz-1', { kind: 'day', date: '2026-09-12' }, { readLines: true });
    ok(calls.length === 1, 'D4 no linked orders → no order or line query at all');
  }

  // ══ E. NEGATIVE CONTROL ════════════════════════════════════════════════════════════════════
  {
    const { db } = fakeDb(happy);
    const v = value(await readStops(db, 'biz-1', { kind: 'day', date: '2026-09-12' }, { readLines: true }));
    ok(!!v && stopLoadOf(v, STOPS[0]).state !== 'no_lines', 'E1 the fixture can tell lines from none');
  }

  console.log(`\nstopRead: ${passed} passed, ${failed} failed`);
  if (failed) { for (const f of failures) console.log(`   ✗ ${f}`); process.exit(1); }
}

void main();
