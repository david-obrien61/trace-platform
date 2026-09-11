/**
 * ── stopLoad — what a stop's card says about its order, in every state ───────────────────────
 *
 * Written against the live 2026-09-11 LAWNS measurement rather than invented shapes: 39 stops, 38
 * linked to an order, and ALL 38 of those orders carry lines — the one stop with nothing to show is
 * `c87987b6…`, from a photographed invoice, with NO order at all. So the "no items" case the build
 * prompt named is really two facts (no order · an order with no lines), and each gets its own words.
 * Line shapes are LAWNS's own: `TC` Trip Charge (28 lines on linked orders), `Oak:MO95` Monterrey Oak.
 *
 * PROBES BOTH DIRECTIONS (STD-022).
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/stopLoad.test.ts --bundle --platform=node --format=cjs | node
 */
import { loadLineFrom, stopLoadModel, LOAD_COPY, type StopOrderItem } from './stopLoad';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

const HISTORY_TREE: StopOrderItem = {
  order_id: 'o1', quantity: 1, description: 'Monterrey Oak - 95 gallon', sku: 'Oak:MO95',
  business_inventory_id: null, business_inventory: null,
};
const HISTORY_FEE: StopOrderItem = {
  order_id: 'o1', quantity: 1, description: 'Trip Charge', sku: 'TC',
  business_inventory_id: null, business_inventory: null,
};
// A checkout line: a lot and NO description (`submit.ts` §8 writes neither description nor sku).
const CHECKOUT_LINE: StopOrderItem = {
  order_id: 'o2', quantity: 3, description: null, sku: null,
  business_inventory_id: 'lot-1', business_inventory: { name: 'Monterrey Oak', size: '45 gal' },
};

// ══ A. ONE LINE ═════════════════════════════════════════════════════════════════════════════════
{
  const l = loadLineFrom(HISTORY_TREE);
  ok(l.description === 'Monterrey Oak - 95 gallon', `A1 an invoice line keeps its own words (got ${l.description})`);
  ok(l.sku === 'Oak:MO95', 'A2 the seller\'s code is carried, sub-item structure intact');
  ok(l.quantity === 1 && l.anchored === false, 'A3 an invoice line has no lot');
}
{
  const l = loadLineFrom(CHECKOUT_LINE);
  ok(l.description === 'Monterrey Oak — 45 gal', `A4 a checkout line is named by its lot AND its size (got ${l.description})`);
  ok(l.quantity === 3 && l.anchored === true, 'A5 a checkout line is anchored');
  ok(l.sku === null, 'A6 no document code is invented for a checkout line');
}
{
  // Negative: a lot that did NOT name the line must not lend its size to a description.
  const l = loadLineFrom({ ...HISTORY_TREE, business_inventory: { name: null, size: '15 gal' } });
  ok(l.description === 'Monterrey Oak - 95 gallon', `A7 a size is never appended to words it did not name (got ${l.description})`);
}
{
  const l = loadLineFrom({ order_id: 'o', quantity: 2, description: null, sku: '   ', business_inventory_id: null, business_inventory: null });
  ok(l.description === 'No catalog match', 'A8 a line with no name says so — the shared resolver\'s words');
  ok(l.sku === null, 'A9 a whitespace code is absent, not blank');
}

// ══ B. EVERY STATE, AND WHICH FACT WINS ═════════════════════════════════════════════════════════
const base = { orderId: 'o1', canReadLines: true, linesRead: true, items: [HISTORY_TREE, HISTORY_FEE] };

ok(stopLoadModel({ ...base, orderId: null }).state === 'no_order', 'B1 no order → no_order');
ok(stopLoadModel({ ...base, orderId: null, canReadLines: false }).state === 'no_order', 'B2 a stop with no order has nothing to withhold');
ok(stopLoadModel({ ...base, canReadLines: false }).state === 'withheld', 'B3 no order_items:read → withheld');
ok(stopLoadModel({ ...base, canReadLines: false, items: [] }).state === 'withheld',
  'B4 🔴 a viewer RLS hands zero rows is told the data is WITHHELD, never that the order is empty');
ok(stopLoadModel({ ...base, linesRead: false }).state === 'unread', 'B5 a failed read → unread');
ok(stopLoadModel({ ...base, linesRead: false, items: [] }).state === 'unread',
  'B6 🔴 a failed read is never reported as "No items recorded" (D-9)');
ok(stopLoadModel({ ...base, items: [] }).state === 'no_lines', 'B7 an order that genuinely has no lines → no_lines');
{
  const m = stopLoadModel(base);
  ok(m.state === 'lines' && m.lines.length === 2 && m.unanchoredCount === 2, 'B8 two invoice lines, both unanchored');
}
{
  const m = stopLoadModel({ ...base, orderId: 'o2', items: [CHECKOUT_LINE] });
  ok(m.state === 'lines' && m.unanchoredCount === 0, 'B9 a checkout order raises NO invoice note — fees never become its lines');
}
{
  const m = stopLoadModel({ ...base, items: [CHECKOUT_LINE, HISTORY_FEE] });
  ok(m.state === 'lines' && m.unanchoredCount === 1, 'B10 a mixed order counts only its unanchored lines');
}

// ══ C. R-144 — NOTHING IS FILTERED BY NAME ══════════════════════════════════════════════════════
{
  const m = stopLoadModel(base);
  ok(m.state === 'lines' && m.lines.some(l => l.description === 'Trip Charge'),
    'C1 the trip charge is SHOWN — no line is dropped on its words (R-144; the filter waits on tech-debt #139)');
}

// ══ D. THE WORDS — none is a blank, and the heading never claims the lines are the load ═════════
ok(LOAD_COPY.no_lines === 'No items recorded on this order.', 'D1 David\'s words for an empty order, verbatim');
for (const k of ['no_order', 'no_lines', 'unread'] as const) {
  ok(LOAD_COPY[k].trim().length >= 20, `D2 ${k} says something in words`);
}
ok(!/load|truck/i.test(LOAD_COPY.heading(3)), 'D3 the heading claims only "on this order" (§6 r18)');
ok(LOAD_COPY.heading(1).endsWith('1 line') && LOAD_COPY.heading(2).endsWith('2 lines'), 'D4 singular and plural');
ok(/truck/i.test(LOAD_COPY.unanchoredNote) && /trip charge/i.test(LOAD_COPY.unanchoredNote),
  'D5 the invoice note names the hazard the crew is exposed to');

// ══ E. NEGATIVE CONTROLS — the fixture can fail ═════════════════════════════════════════════════
ok(stopLoadModel({ ...base, items: [] }).state !== 'lines', 'E1 an empty order does not render as lines');
ok(stopLoadModel(base).state !== 'no_lines', 'E2 an order with lines is not reported empty');

console.log(`\nstopLoad: ${passed} passed, ${failed} failed`);
if (failed) { for (const f of failures) console.log(`   ✗ ${f}`); process.exit(1); }
