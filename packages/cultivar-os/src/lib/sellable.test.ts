/**
 * ── checkSellable — the ONE sellability predicate · 2026-07-22 ──
 *
 * Written from the live defect David proved on 679fb9a:
 *
 *   DISC-1105 displayed "0 available (29 on hand, 57 committed)" in the checkout picker
 *   AND STILL ADDED TO THE CART. The display was fixed; the CAP was not. The refusal
 *   arrived five screens later at review.
 *
 *   He then set status='depleted' by hand on that lot and it STILL added — correct per D-42
 *   (status DERIVES from qty), which is precisely why the status control must stop offering
 *   derived values it does not own.
 *
 * Three surfaces answered "can this be sold?" three different ways. These tests hold the single
 * answer, and hold the ORDER of the reasons — a damaged lot must not be described as a quantity
 * problem.
 *
 * Run (pure TS, no React imported — esbuild → node):
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/sellable.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import {
  checkSellable, availabilityLabel, deriveStatus, isManualCondition,
  MANUAL_CONDITION_STATUSES, DERIVED_STATUSES,
} from './inventoryStates';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ══ THE LIVE DEFECT — DISC-1105 ══════════════════════════════════════════════
{
  const v = checkSellable({ onHand: 29, committed: 57, status: 'available', sellPrice: 120 });
  ok(v.sellable === false, 'THE LIVE DEFECT: 29 on hand against 57 committed is NOT sellable — the picker must refuse to add it, not show the right number and add it anyway');
  ok(v.available === 0, 'available is 0, floored — never negative');
  ok(!v.sellable && /29 on hand/.test(v.detail) && /57 committed/.test(v.detail),
    'and the reason NAMES BOTH numbers — a bare "0 available" against a lot the owner can see holding 29 reads as a bug, not a rule');
}

// ══ THE HEALTHY LOT STILL SELLS — the cap must not be a wall ═════════════════
{
  const v = checkSellable({ onHand: 10, committed: 0, status: 'available', sellPrice: 45 });
  ok(v.sellable === true && v.available === 10, 'DISC-1104-shaped: 10 on hand, nothing committed, priced → sells normally');
}
{
  const v = checkSellable({ onHand: 10, committed: 9, status: 'available', sellPrice: 45 });
  ok(v.sellable === true && v.available === 1, 'partially committed still sells — down to the last available unit');
}

// ══ CONDITION BEATS QUANTITY — the order of reasons is the point ═════════════
{
  const v = checkSellable({ onHand: 50, committed: 0, status: 'damaged', sellPrice: 45 });
  ok(v.sellable === false && v.reason === 'condition', 'a DAMAGED lot cannot be sold even with 50 on hand and a price');
  ok(!v.sellable && /damaged/.test(v.detail) && !/available/.test(v.detail),
    'and it is described as a CONDITION, never as a quantity — "0 available" about a damaged lot would be true and useless');
}
{
  const v = checkSellable({ onHand: 0, committed: 0, status: 'damaged', sellPrice: 0 });
  ok(!v.sellable && v.reason === 'condition', 'condition is checked FIRST — a damaged, unpriced, empty lot reports the damage, not the emptiest true fact');
}
{
  for (const s of MANUAL_CONDITION_STATUSES) {
    const v = checkSellable({ onHand: 50, committed: 0, status: s, sellPrice: 45 });
    ok(v.sellable === false, `${s} blocks the sale everywhere`);
  }
}

// ══ PRICE IS A SETUP GAP, NOT A STOCK GAP ═══════════════════════════════════
{
  const v = checkSellable({ onHand: 50, committed: 0, status: 'available', sellPrice: null });
  ok(v.sellable === false && v.reason === 'no_price', 'an unpriced lot cannot be added to a cart (the scan picker used to allow it, then priced it at $0)');
  ok(!v.sellable && /Inventory/.test(v.detail), 'and the reason says WHERE to fix it');
}
{
  const v = checkSellable({ onHand: 50, committed: 0, status: 'available', sellPrice: 0 });
  ok(!v.sellable && v.reason === 'no_price', '$0 is refused as hard as null — D-9, no silent $0 sale');
}

// ══ DERIVED STATUS IS NOT A CONDITION ═══════════════════════════════════════
{
  const v = checkSellable({ onHand: 29, committed: 0, status: 'depleted', sellPrice: 120 });
  ok(v.sellable === true, "a hand-set 'depleted' on a lot holding 29 does NOT block the sale — status DERIVES from qty (D-42), so honoring the stale label would be honoring a value the next write overwrites");
  ok(deriveStatus(29) === 'available' && deriveStatus(0) === 'depleted', 'deriveStatus implements D-42: qty > 0 → available, else depleted');
  ok(isManualCondition('depleted') === false && isManualCondition('damaged') === true, 'depleted is DERIVED; damaged is a human assertion');
  ok(!(DERIVED_STATUSES as readonly string[]).includes('reserved'),
    "'reserved' is GONE — D-52 made reservation a derived QUANTITY, so a lot-wide status of the same name only invites the confusion it looks like it resolves");
}

// ══ THE SENTENCE, IN ONE PLACE ══════════════════════════════════════════════
{
  ok(availabilityLabel(29, 57) === '0 available (29 on hand, 57 committed)', 'the committed case names both numbers');
  ok(availabilityLabel(10, 0) === '10 available', 'the clean case stays short — no parenthetical noise when nothing is committed');
  ok(availabilityLabel(null, 0) === '', 'an unknown qty says NOTHING rather than fabricating a 0 (D-9)');
}

console.log(`\n  checkSellable: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
