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
  checkSellable, availabilityLabel, deriveStatus, isManualCondition, fetchSeededLots,
  SEEDED_NOTE, MANUAL_CONDITION_STATUSES, DERIVED_STATUSES,
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


// ══ §T — A SEEDED NUMBER WEARS ITS PROVENANCE, AND A COUNTED ONE DOES NOT ══════════════════

{
  ok(availabilityLabel(5, 0, true) === `5 available — ${SEEDED_NOTE}`,
     `T1  🔴 A SEEDED LOT SHOWS ITS NUMBER **AND** QUALIFIES IT. Hiding the figure makes the lot unsellable again; showing it bare asserts a count nobody performed (got "${availabilityLabel(5, 0, true)}")`);
  ok(availabilityLabel(5, 0, false) === '5 available',
     'T2  NEGATIVE CONTROL — the same lot, not seeded, is unchanged. §T1 measured the flag and not a constant suffix');
  ok(availabilityLabel(5, 0) === '5 available',
     'T3  🔴 AND THE DEFAULT IS THE OLD BEHAVIOUR EXACTLY, so every existing caller is untouched by this build');
  ok(availabilityLabel(29, 57, true) === `0 available (29 on hand, 57 committed) — ${SEEDED_NOTE}`,
     'T4  committed and seeded compose — both qualifications are shown, neither replaces the other');
  ok(availabilityLabel(null, 0, true) === '',
     'T5  🔴 AN UNKNOWN QTY STILL SAYS NOTHING. A lot with no number cannot have a seeded number, and printing the note alone would assert a placeholder that does not exist (D-9)');
}

// ── fetchSeededLots is ASYNC, so its probes live in an IIFE: the runner bundles to CJS, where a
// top-level `await` is a build error rather than a test failure — and a test file that will not
// BUILD is the shape tech-debt #293 is about (a no-build scoring as a pass).
void (async () => {
  function fakeLedger(rows: { inventory_id: string | null; kind: string; occurred_at: string }[], error: { message: string } | null = null) {
    const q = {
      select: () => q, eq: () => q, in: () => q,
      order: () => Promise.resolve({ data: error ? null : rows, error }),
    };
    return { from: () => q };
  }

  {
    const seeded = await fetchSeededLots(fakeLedger([
      { inventory_id: 'a', kind: 'opening_stock_seed', occurred_at: '2026-09-15T09:00:00Z' },
      { inventory_id: 'b', kind: 'opening_stock_seed', occurred_at: '2026-09-15T09:00:00Z' },
      { inventory_id: 'b', kind: 'count_reconcile',    occurred_at: '2026-09-20T09:00:00Z' },
    ]), 'biz');
    ok(seeded.has('a'), 'T6  a lot that was seeded and never counted IS a placeholder');
    ok(!seeded.has('b'), 'T7  🔴 A LOT THAT HAS SINCE BEEN COUNTED IS NOT. A real count always wins — and this is why the answer is DERIVED from the ledger rather than stored as a flag nobody would remember to clear (STD-011)');
    ok(!seeded.has('c'), 'T8  a lot with no ledger rows at all is not a placeholder');
  }

  {
    // A lot seeded AGAIN after a count is a placeholder again — order matters, not mere presence.
    const seeded = await fetchSeededLots(fakeLedger([
      { inventory_id: 'a', kind: 'opening_stock_seed', occurred_at: '2026-09-15T09:00:00Z' },
      { inventory_id: 'a', kind: 'count_reconcile',    occurred_at: '2026-09-16T09:00:00Z' },
      { inventory_id: 'a', kind: 'opening_stock_seed', occurred_at: '2026-09-17T09:00:00Z' },
    ]), 'biz');
    ok(seeded.has('a'), 'T9  the LAST event wins — a re-seed after a count is a placeholder again (a presence test would get this wrong)');
  }

  {
    // 🔴 THE WARNING IS CAPTURED, NOT ASSUMED. A degraded read that marks nothing AND SAYS NOTHING
    // is indistinguishable from a clean read that found nothing — which is tech-debt #75's class
    // (a check whose failure path is invisible). The silence is the defect, so the probe asserts
    // the announcement and not only the return value.
    const warns: string[] = [];
    const realWarn = console.warn;
    console.warn = (...a: unknown[]) => { warns.push(a.map(String).join(' ')); };
    let seeded: Set<string>;
    try {
      seeded = await fetchSeededLots(fakeLedger([], { message: 'permission denied' }), 'biz');
    } finally {
      console.warn = realWarn;
    }
    ok(seeded.size === 0,
       'T10 🔴 A FAILED READ MARKS NOTHING. Marking everything on an error would put "starting number, not counted" beside hundreds of genuinely counted lots and destroy the signal; under-claiming is recoverable, over-claiming is not');
    ok(warns.length === 1,
       `T10b 🔴 AND IT SAYS SO. A read that degraded in silence looks exactly like one that succeeded and found nothing (got ${warns.length} warnings)`);
    ok(warns.join(' ').includes('permission denied'),
       'T10c naming what actually went wrong, so the next person does not have to reproduce it to find out');
  }

  {
    // NEGATIVE CONTROL for T10b, changing the POPULATION rather than the subject (tech-debt #182):
    // a CLEAN read must be silent, or T10b would pass on a function that warns unconditionally.
    const warns: string[] = [];
    const realWarn = console.warn;
    console.warn = (...a: unknown[]) => { warns.push(a.map(String).join(' ')); };
    try {
      await fetchSeededLots(fakeLedger([{ inventory_id: 'a', kind: 'opening_stock_seed', occurred_at: '2026-09-15T09:00:00Z' }]), 'biz');
    } finally {
      console.warn = realWarn;
    }
    ok(warns.length === 0, 'T10d NEGATIVE CONTROL — a clean read warns NOTHING, so T10b measured a failure path and not a constant');
  }

  {
    const seeded = await fetchSeededLots(fakeLedger([
      { inventory_id: null, kind: 'opening_stock_seed', occurred_at: '2026-09-15T09:00:00Z' },
    ]), 'biz');
    ok(seeded.size === 0, 'T11 a ledger row whose lot is gone anchors nothing (inventory_id is nullable by design)');
  }

  console.log(`\n  checkSellable: ${passed} passed, ${failed} failed`);
  if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
})();
