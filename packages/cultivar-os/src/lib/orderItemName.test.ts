/**
 * ── orderItemName — every order line names itself, or says it could not ──
 *
 * Written from the defect David found on the orders screen the day after the history-order build
 * shipped: EIGHT real orders for named, priced, invoiced trees rendered as eight lines reading
 * **"Unknown plant"**, while `description` sat unread on the very same rows holding
 * "Mexican Sycamore - 45 gallon" and `sku` held MS45.
 *
 * 🔴 THE ROOT, AND IT IS WORTH STATING BECAUSE IT WILL RECUR: a history line carries NO
 * `business_inventory_id` BY INVARIANT — the stock left the property before this platform existed,
 * so there is no lot to point at, and populating one to make a screen work would be a lie about
 * inventory. The resolver joined only the lot, got null, and printed a confident label over data it
 * had never looked at. Same shape as the green add-on check and the $0 that was really a failed
 * read: **absent is not empty, and un-joined is not unknown** (D-9 / A9).
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/orderItemName.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { orderItemName, orderItemTag, orderItemAnchor } from './orderItemName';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

/** Paul Christ's real line, exactly as the backfill wrote it. */
const HISTORY_LINE = {
  business_inventory_id: null,
  business_inventory: null,
  cultivar_plants: null,
  description: 'Mexican Sycamore - 45 gallon',
  sku: 'MS45',
};

// ══ §A THE LIVE DEFECT ══════════════════════════════════════════════════════
{
  ok(orderItemName(HISTORY_LINE) === 'Mexican Sycamore - 45 gallon',
    "🔴 THE DEFECT: Paul Christ's line reads its own description, not \"Unknown plant\". The name was on the row the whole time");
  ok(orderItemName(HISTORY_LINE) !== 'Unknown plant', 'and specifically NOT that string');
  ok(orderItemTag(HISTORY_LINE) === 'MS45',
    'the document sku is shown rather than an em-dash — a real identifier a person can look up, thrown away before this');
  ok(orderItemAnchor(HISTORY_LINE) === 'document',
    '`document` is a real anchor, not a degraded one — it is how EVERY history line names itself, and the TRACE trail should say so rather than reporting `unknown` eight times');
}

// ══ §B "Unknown plant" IS GONE, AND THE LAST RESORT IS HONEST ═══════════════
{
  const nameless = { business_inventory_id: null, business_inventory: null, cultivar_plants: null };
  ok(orderItemName(nameless) === 'No catalog match',
    "🔴 a row that genuinely carries NO name in any form says what is TRUE — it matched nothing in the catalog — rather than asserting a plant exists and is unidentified");
  ok(orderItemName(nameless) !== 'Unknown plant', 'the old string is not the fallback either');
  ok(orderItemTag(nameless) === '—', 'and its identifier is an honest em-dash');
  ok(orderItemAnchor(nameless) === 'unknown', '`unknown` now means what it says: nothing on the row could name it');
  ok(orderItemName({ description: '', sku: '' } as any) === 'No catalog match',
    'an EMPTY STRING description is not a name — it must not render as a blank label (A9: absent is not empty)');
}

// ══ §C THE EXISTING ANCHORS STILL WIN — this is a fallback, not a takeover ══
{
  const withLot = { ...HISTORY_LINE, business_inventory: { name: 'Lacey Oak', size: '45 gal', sku: 'LAO45' } };
  ok(orderItemName(withLot) === 'Lacey Oak',
    'OUR catalog record beats transcribed text when both exist — the lot is a record, the description is words off a photograph');
  ok(orderItemTag(withLot) === 'LAO45', 'and the lot sku beats the document sku');
  ok(orderItemAnchor(withLot) === 'stock_line', 'anchor still reports stock_line');

  const withSpecimen = { ...withLot, cultivar_plants: { tag_id: 'SCV-0031', common_name: 'Shumard Red Oak', species: null } };
  ok(orderItemName(withSpecimen) === 'Shumard Red Oak', 'a specimen still wins over both');
  ok(orderItemTag(withSpecimen) === 'SCV-0031', 'and its tag wins over both skus');
  ok(orderItemAnchor(withSpecimen) === 'specimen', 'anchor still reports specimen');

  // The pre-existing checkout shape — no description, no sku — must be untouched by this change.
  const checkoutLine = { business_inventory_id: 'lot-1', business_inventory: { name: 'Live Oak', size: '30 gal', sku: null }, cultivar_plants: null };
  ok(orderItemName(checkoutLine) === 'Live Oak', 'a normal checkout line is unaffected');
  ok(orderItemTag(checkoutLine) === '30 gal', 'falling back to size exactly as before');
}

// ══ §D THE REAL LINES FROM THE EIGHT ORDERS ════════════════════════════════
// Every one of these rendered as "Unknown plant" in production.
{
  const real: Array<[string, string]> = [
    ['Chinkapin Oak, 95 gallon', 'CHO95'],
    ['Mexican Sycamore - 45 gallon', 'MS45'],
    ['Lacey Oak - 45 Gallon', 'LAO45'],
    ['Eagleston Holly (Tree Form) - 45 Gallon', 'EH45TF'],
    ['Colorama Scarlet Crape Myrtle, 15 gallon', 'CSCM15'],
    ['Arizona Cypress, Blue Ice 30 gallon (Install & Warranty)', 'ACBI30'],
    ['Live Oak - 200 gallon (Install & Warranty)', 'LO200'],
    ['Desert Willow - 15 Gallon', 'DW15'],
    ['Trip Charge', 'TC'],
  ];
  const named = real.filter(([d, k]) =>
    orderItemName({ description: d, sku: k, business_inventory: null, cultivar_plants: null }) === d);
  ok(named.length === real.length,
    `all ${real.length} real transcribed lines name themselves (${named.length}/${real.length}) — including "Trip Charge", which is a service line and still must not read as an unknown plant`);
}

console.log(`\n  orderItemName: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
