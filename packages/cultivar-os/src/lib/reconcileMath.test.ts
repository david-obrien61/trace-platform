/**
 * ── reconcileMath — the count-vs-book decision · D-50 reconcile reader · 2026-07-21 ──
 *
 * These tests exist because the two sharpest cases are the two the BUILD SPEC got wrong, and both
 * write to an APPEND-ONLY log. A wrong row here cannot be retracted — it can only be apologized
 * for with a second row. So the arithmetic is proven without a database, before the page runs it.
 *
 *   (A) EXPECTED IS A FULL REPLAY. The spec's `prior_count − sales` turns a +10 RECEIVE in the
 *       window into a −10 residual and asks the owner to account for shrinkage that never
 *       happened. Test group A holds that line.
 *
 *   (B) ATTRIBUTION SPLITS THE DELTA. `count_reconcile_inventory` and `adjust_inventory_manual`
 *       BOTH move qty. The spec ran them in sequence, which decrements twice. Test group B
 *       asserts the plan's deltas sum to exactly `counted − book`, no matter how it is attributed.
 *
 * Run (pure TS, no React imported — esbuild → node):
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/reconcileMath.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import {
  reconcileRow, buildWritePlan, planNetDelta, isVariance, summarizeMovements, isMovement,
  SEED_KIND,
  type LedgerMovement, type Attribution,
} from './reconcileMath';
import { SEED_LEDGER_KIND } from '@trace/shared/quickbooks/openingStock';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

let seq = 0;
const mv = (kind: string, delta: number, occurred_at = '2026-07-15T12:00:00Z'): LedgerMovement => ({
  id: `mv-${++seq}`, kind, delta, occurred_at,
  reason: null, source_type: null, source_id: null, actor_user_id: null,
});

// ══ A — MODE DETECTION ═══════════════════════════════════════════════════════
{
  const r = reconcileRow({ bookOnHand: 12, committed: 0, prior: null, movementsSincePrior: [], counted: 12 });
  ok(r.mode === 'baseline', 'no prior count → BASELINE mode');
  ok(r.replayExpected === null, 'baseline has no window to replay — replayExpected is null, not a fabricated 0');
  ok(r.evidence.length === 0, 'baseline shows NO evidence strip — an empty "sold" column on a fresh tenant is the confusing surface the demo must not have');
  ok(r.attributionRequired === false, 'baseline never demands attribution — there is no history to explain a first count against');
}
{
  const r = reconcileRow({
    bookOnHand: 9, committed: 0,
    prior: { counted_qty: 12, counted_at: '2026-07-10T00:00:00Z' },
    movementsSincePrior: [mv('sale', -3)], counted: 9,
  });
  ok(r.mode === 'delta', 'a prior count + movements → DELTA mode');
  ok(r.attributionRequired === false, 'a DELTA row that agrees with the book needs no attribution — the row is done');
}

// ══ A — THE RECEIVE THAT THE SPEC WOULD HAVE MIS-ATTRIBUTED ══════════════════
// Prior count 12. Since then: 3 sold, 10 received. Book = 12 − 3 + 10 = 19. Owner counts 19.
// The spec's `prior − sales` = 12 − 3 = 9 → residual = 19 − 9 = +10, a phantom "found 10".
{
  const r = reconcileRow({
    bookOnHand: 19, committed: 0,
    prior: { counted_qty: 12, counted_at: '2026-07-10T00:00:00Z' },
    movementsSincePrior: [mv('sale', -3), mv('receive', 10)], counted: 19,
  });
  ok(r.replayExpected === 19, 'the replay sums ALL deltas (−3 sale, +10 receive) → 19, NOT the spec\'s sales-only 9');
  ok(r.expected === 19, 'expected == book on-hand');
  ok(r.residual === 0, 'THE CORRECTION (A): a fully-explained window shows ZERO residual — the spec\'s formula would have shown +10 and asked the owner to account for a receive the system itself recorded');
  ok(r.bookAgreesWithReplay === true, 'book and replay agree — the D-50 `qty == SUM(delta)` guarantee holds for this lot');
  ok(r.attributionRequired === false, 'nothing to attribute');
}

// ══ A — THE GENESIS ROW IS A POSITION, NOT A MOVEMENT (THE LIVE 2026-07-22 DEFECT) ══
// Lot 3ec53db3 (Shoal Creek Vitex 45), reported live on 6245f27. True ledger: opening_balance +60,
// count_reconcile −2 → SUM(delta) = 58. The screen said "replays to 120 but book says 60".
// The genesis backfill dates opening_balance at MIGRATION-APPLY TIME, so for a lot last counted
// before 2026-07-20 it lands INSIDE the window and is replayed as if the stock just arrived:
// prior 60 + genesis 60 = 120. It looks like a 2× read; it is one read counting a starting
// position as a change.
{
  const r = reconcileRow({
    bookOnHand: 60, committed: 0,
    prior: { counted_qty: 60, counted_at: '2026-06-28T00:00:00Z' },
    movementsSincePrior: [mv('opening_balance', 60, '2026-07-20T18:00:00Z')],
    counted: null,
  });
  ok(r.replayExpected === 60, 'THE LIVE DEFECT: a genesis opening_balance inside the window must NOT be replayed — 60, never the reported 120');
  ok(r.bookAgreesWithReplay === true, 'and so the false "ledger replays to 120 but book says 60" line does NOT render');
  ok(r.evidence.length === 0, 'nor is it shown as EVIDENCE — "60 opening balance" is not something that happened since the count');
}
{
  // The full live row, after David's baseline accept took it 60 → 58.
  const r = reconcileRow({
    bookOnHand: 58, committed: 0,
    prior: { counted_qty: 60, counted_at: '2026-06-28T00:00:00Z' },
    movementsSincePrior: [
      mv('opening_balance', 60, '2026-07-20T18:00:00Z'),
      mv('count_reconcile', -2, '2026-07-21T22:00:00Z'),
    ],
    counted: null,
  });
  ok(r.replayExpected === 58, 'the true replay is 58 — prior 60, less the −2 count_reconcile, genesis excluded');
  ok(r.bookAgreesWithReplay === true, 'book 58 == replay 58 — David\'s VERIFY condition, asserted');
}
{
  ok(isMovement('sale') === true && isMovement('count_reconcile') === true, 'sales and counts are movements');
  ok(isMovement('opening_balance') === false, 'an opening balance asserts a POSITION, never a change');
}

// ══ A — THE LEDGER-INTEGRITY TELL ════════════════════════════════════════════
{
  const r = reconcileRow({
    bookOnHand: 20, committed: 0,
    prior: { counted_qty: 12, counted_at: '2026-07-10T00:00:00Z' },
    movementsSincePrior: [mv('sale', -3)], counted: 20,
  });
  ok(r.replayExpected === 9, 'replay says 9');
  ok(r.bookAgreesWithReplay === false, 'book (20) != replay (9) → the ledger guarantee has BROKEN for this lot, and that is surfaced, not averaged away');
  ok(r.expected === 20, 'expected still follows BOOK — it is the number the rest of the app transacts against; the replay is the check, not a competing answer');
}

// ══ A — REAL SHRINKAGE STILL SURFACES ════════════════════════════════════════
{
  const r = reconcileRow({
    bookOnHand: 30, committed: 4,
    prior: { counted_qty: 33, counted_at: '2026-07-10T00:00:00Z' },
    movementsSincePrior: [mv('sale', -3)], counted: 13,
  });
  ok(r.residual === -17, 'counted 13 against a book of 30 → residual −17');
  ok(r.varianceFlag === true, 'THE 13/30 CATCH — a 57% hole trips the variance flag');
  ok(r.attributionRequired === true, 'a nonzero DELTA residual demands a human account — the system does not guess a cause (D-9)');
  ok(r.available === 26, 'available = 30 on-hand − 4 committed (D-52, one definition)');
  ok(r.evidence[0].kind === 'sale' && r.evidence[0].net === -3, 'the evidence strip names the movement it replayed: 3 sold');
}

// ══ A — VARIANCE THRESHOLD SHAPE ═════════════════════════════════════════════
{
  ok(isVariance(-13, 30) === true, '13 of 30 → variance (the catch this exists for)');
  ok(isVariance(-2, 3) === false, '2 of 3 is proportionally huge but absolutely trivial — no flag, or every tiny lot cries wolf');
  ok(isVariance(-4, 1000) === false, '4 of 1000 → no flag');
  ok(isVariance(-60, 100000) === true, '60 units missing always flags regardless of lot size (the absolute ceiling)');
}

// ══ A — EVIDENCE SUMMARY ═════════════════════════════════════════════════════
{
  const s = summarizeMovements([mv('sale', -3), mv('sale', -2), mv('receive', 10), mv('dead', -1)]);
  ok(s.length === 3, 'movements collapse to one row per kind');
  ok(s[0].kind === 'receive' && s[0].net === 10, 'largest absolute movement first — the owner reads the biggest cause, not the alphabet');
  ok(s.find(x => x.kind === 'sale')!.net === -5 && s.find(x => x.kind === 'sale')!.events === 2, 'two sales net to −5 across 2 events');
}

// ══ B — THE WRITE PLAN: BASELINE IS ONE STEP ═════════════════════════════════
{
  const p = buildWritePlan({ bookOnHand: 0, counted: 12, attributions: [], mode: 'baseline' });
  ok(p.ok === true, 'a baseline accept builds a plan');
  if (p.ok) {
    ok(p.steps.length === 1, 'no attribution → exactly ONE step, the count_reconcile stamp');
    ok(p.steps[0].rpc === 'count_reconcile_inventory' && p.steps[0].newQty === 12, 'it lands absolutely on the counted number');
    ok(p.steps[0].reason === 'baseline', 'and it is reasoned "baseline" — no attribution invented for a first count');
    ok(planNetDelta(p.steps) === 12, 'net delta = counted − book');
  }
}

// ══ B — A ZERO-DELTA COUNT IS STILL WRITTEN ══════════════════════════════════
{
  const p = buildWritePlan({ bookOnHand: 12, counted: 12, attributions: [], mode: 'delta' });
  ok(p.ok === true && p.ok && p.steps.length === 1 && p.steps[0].delta === 0,
    '"counted, and it agreed" is a FACT worth recording — it is the evidence that closes a reconcile window (ledger migration §7b)');
}

// ══ B — THE DOUBLE-DECREMENT THE SPEC WOULD HAVE SHIPPED ═════════════════════
// Book 30, counted 13, residual −17, attributed: 4 dead, 3 loss, 10 unexplained.
// The spec: count_reconcile 30→13 (−17) THEN dead (−4) THEN loss (−3) = on-hand 6, net −24.
// Correct: dead 30→26 (−4), loss 26→23 (−3), count_reconcile 23→13 (−10). Net −17. Ends at 13.
{
  const attributions: Attribution[] = [{ kind: 'dead', qty: 4 }, { kind: 'loss', qty: 3 }];
  const p = buildWritePlan({ bookOnHand: 30, counted: 13, attributions, mode: 'delta' });
  ok(p.ok === true, 'the attributed plan builds');
  if (p.ok) {
    ok(p.steps.length === 3, 'three permanent dated lines — 4 dead, 3 loss, 10 unexplained (D-50\'s story, literally)');
    ok(planNetDelta(p.steps) === -17, 'THE CORRECTION (B): the plan\'s deltas sum to counted − book = −17. The spec\'s sequence summed to −24 and would have invented 7 dead plants in a log that cannot be retracted');
    ok(p.steps[p.steps.length - 1].newQty === 13, 'the LAST step lands absolutely on the counted number — so a concurrent sale mid-plan is absorbed, never lost');
    ok(p.steps[0].kind === 'dead' && p.steps[0].newQty === 26, 'step 1: dead 4 → 26');
    ok(p.steps[1].kind === 'loss' && p.steps[1].newQty === 23, 'step 2: loss 3 → 23');
    ok(p.steps[2].kind === 'count_reconcile' && p.steps[2].delta === -10, 'step 3: the unexplained −10 lands on the count_reconcile, honestly unattributed');
  }
}

// ══ B — CREDITS RUN FIRST SO THE PLAN CANNOT ABORT HALFWAY ═══════════════════
// Lot of 3. Attributed: 6 dead, 4 found. Debit-first would target 3 − 6 = −3 → the RPC RAISEs,
// leaving PART of the attribution written to an append-only log with no way to finish it.
{
  const p = buildWritePlan({
    bookOnHand: 3, counted: 1,
    attributions: [{ kind: 'dead', qty: 6 }, { kind: 'found', qty: 4 }], mode: 'delta',
  });
  ok(p.ok === true, 'credits-first keeps every intermediate target >= 0, so the plan survives');
  if (p.ok) {
    ok(p.steps[0].kind === 'found' && p.steps[0].newQty === 7, 'the +4 found runs FIRST (3 → 7)');
    ok(p.steps[1].kind === 'dead' && p.steps[1].newQty === 1, 'then the −6 dead (7 → 1) — never negative');
    ok(planNetDelta(p.steps) === -2, 'net still counted − book = 1 − 3 = −2');
  }
}

// ══ B — REFUSALS ═════════════════════════════════════════════════════════════
{
  const p = buildWritePlan({ bookOnHand: 3, counted: 0, attributions: [{ kind: 'dead', qty: 9 }], mode: 'delta' });
  ok(p.ok === false, 'attributing more dead than the lot holds is REFUSED — on-hand cannot go below zero');
  if (!p.ok) ok(/more than the 3/.test(p.error), 'and the refusal NAMES the number it refused against, rather than a bare "invalid"');
}
{
  const p = buildWritePlan({ bookOnHand: 3, counted: -1, attributions: [], mode: 'baseline' });
  ok(p.ok === false, 'a negative count is REFUSED before it reaches the RPC (§1.6 item 3 — validated at the write)');
}
{
  const p = buildWritePlan({ bookOnHand: 3, counted: 2.5, attributions: [], mode: 'baseline' });
  ok(p.ok === false, 'a fractional count is REFUSED — you cannot hold half a tree');
}
{
  const p = buildWritePlan({ bookOnHand: 3, counted: 2, attributions: [{ kind: 'dead', qty: 0 }], mode: 'delta' });
  ok(p.ok === false, 'a zero-qty attribution is REFUSED — leave it blank if it is not the cause');
}

// ══ §S — THE SEEDED MODE: A PLACEHOLDER IS NOT A COUNT ════════════════════════════════════
// The scenario is David's own, and it is the acceptance test for this whole build:
//   seeded 5, sold 3, added 4, counted 11 → the screen nets the sales and the additions and
//   hands the human the residual.

// 🔴 THE TWO STRINGS ARE ONE FACT. `reconcileMath` may not import the app's QuickBooks module at
// runtime (it is pure, dependency-free by contract), so the kind is written in both places — and
// that is exactly the STD-011 drift that eventually disagrees. This probe is what stops it.
ok(SEED_KIND === SEED_LEDGER_KIND,
   `S0  🔴 the reconcile's seed kind and the writer's seed kind are the SAME STRING ('${SEED_KIND}' vs '${SEED_LEDGER_KIND}')`);

ok(isMovement(SEED_KIND) === false,
   'S1  🔴 A SEED ASSERTS A POSITION, NEVER A CHANGE. Treated as a movement, a later window containing it replays the placeholder as freshly-arrived stock — tech-debt #70s live defect, reproduced on purpose');
ok(isMovement('opening_balance') === false && isMovement('sale') === true,
   'S1b and the existing vocabulary is unmoved: opening_balance is still a position, a sale is still a movement');

{
  // seeded 5 · sold 3 · added 4 · counted 11.  Book = 5 - 3 + 4 = 6.
  const r = reconcileRow({
    bookOnHand: 6, committed: 0, prior: null,
    seed: { seeded_qty: 5, seeded_at: '2026-09-15T09:00:00Z' },
    movementsSincePrior: [
      mv('sale', -3, '2026-09-16T10:00:00Z'),
      mv('receive', 4, '2026-09-18T10:00:00Z'),
      // The seed's OWN ledger row is in the window, exactly as the page will read it back.
      mv(SEED_KIND, 5, '2026-09-15T09:00:00Z'),
    ],
    counted: 11,
  });
  ok(r.mode === 'seeded', `S2  a lot with a seed and no count reconciles in SEEDED mode (got ${r.mode})`);
  ok(r.replayExpected === 6,
     `S3  🔴 THE REPLAY IS 5 − 3 + 4 = 6, NOT 11. The seed is the BASE and must not also be replayed as a movement on top of itself (got ${r.replayExpected})`);
  ok(r.bookAgreesWithReplay === true, 'S4  and it agrees with the book');
  ok(r.residual === 5, `S5  the human is handed the residual — 11 counted against 6 expected = 5 (got ${r.residual})`);
  ok(r.evidence.length === 2,
     `S6  🔴 THE EVIDENCE STRIP IS SHOWN, WHICH BASELINE MODE CANNOT DO. "3 sold, 4 received since you started this at 5" is what makes the remainder legible (got ${r.evidence.length} kinds)`);
  ok(r.evidence.every(e => e.kind !== SEED_KIND),
     'S6b and the seed itself is NOT in the evidence — it is the starting point, not something that happened since');
  ok(r.expectedIsFromAPlaceholder === true,
     'S7  🔴 AND THE SCREEN IS TOLD THE BASE WAS A PLACEHOLDER. A residual of 5 against a measured book is a discrepancy; against a seeded book it is the seed being wrong, which everybody expected');
  ok(r.attributionRequired === false,
     'S8  🔴 NO ATTRIBUTION IS DEMANDED. Asking where units "went" from a number nobody counted would write a permanent, immutable loss row for stock that never existed');
}

{
  // A REAL COUNT ALWAYS WINS. Once somebody has physically looked, the placeholder stops being
  // the base — it is history.
  const r = reconcileRow({
    bookOnHand: 6, committed: 0,
    prior: { counted_qty: 9, counted_at: '2026-09-20T00:00:00Z' },
    seed: { seeded_qty: 5, seeded_at: '2026-09-15T09:00:00Z' },
    movementsSincePrior: [mv('sale', -3, '2026-09-21T10:00:00Z')],
    counted: 6,
  });
  ok(r.mode === 'delta', `S9  a seeded lot that has SINCE been counted reconciles in DELTA mode (got ${r.mode})`);
  ok(r.replayExpected === 6, 'S9b replaying from the COUNT (9 − 3), never from the seed');
  ok(r.expectedIsFromAPlaceholder === false, 'S9c and the screen is no longer told the base is a placeholder — it is not');
}

{
  // NEGATIVE CONTROL, changing the POPULATION rather than the subject (tech-debt #182). If §S2–S8
  // passed because reconcileRow returns 'seeded' for everything, this is what says so.
  const r = reconcileRow({
    bookOnHand: 6, committed: 0, prior: null, seed: null,
    movementsSincePrior: [], counted: 11,
  });
  ok(r.mode === 'baseline', 'S10 NEGATIVE CONTROL — the same lot with NO seed is BASELINE, so §S2 measured a seed and not a constant');
  ok(r.evidence.length === 0, 'S10b and baseline still shows no evidence strip');
  ok(r.expectedIsFromAPlaceholder === false, 'S10c and does not claim a placeholder it never had');
  ok(r.replayExpected === null, 'S10d and has no replay, because there is no window');
}

{
  // A seed of ZERO is not the same as no seed, and the type keeps them apart — but the mode must
  // too, or a lot seeded at 0 would silently fall back to baseline and lose its evidence strip.
  const r = reconcileRow({
    bookOnHand: 2, committed: 0, prior: null,
    seed: { seeded_qty: 0, seeded_at: '2026-09-15T09:00:00Z' },
    movementsSincePrior: [mv('receive', 2, '2026-09-16T10:00:00Z')],
    counted: 2,
  });
  ok(r.mode === 'seeded', 'S11 a seed of 0 is still a seed — an object, not a falsy number');
  ok(r.replayExpected === 2, 'S11b and replays from it');
}

console.log(`\n  reconcileMath: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
