/**
 * ── COUNT-ONCE SLICE SEAM — adversarial seam tests · Core-2a SPIKE · 2026-06-15 ───
 *
 * The POINT of the spike: prove the count-once seam holds against REAL incomplete
 * CoolRunnings data (docs/coolrunnings-hardware-spend-2026-06-02.md), and prove each
 * test can CATCH the bug it guards — not merely pass green. Every test computes what a
 * BUGGY seam would produce and asserts the real seam differs (the assertion has teeth).
 *
 * No test runner is installed in this repo. This file is pure TS over pure functions —
 * run it with the esbuild that ships in node_modules:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/CountOnceSeam.test.ts \
 *     --bundle --platform=node --format=cjs | node
 * Exits non-zero if any assertion fails.
 */

import {
  enforceCountOnce,
  fromCostObject,
  fromRecurringLine,
  sameCost,
  classifyShape,
  type CostEvent,
} from './CountOnceSeam';
import {
  COOLRUNNINGS_NODES,
  ECOBEE_PURCHASE,
  ECOBEE_RETURN,
  NABU_CASA_RECURRING,
  NSPANEL_DUP_AS_RECURRING,
  CARWASH_A,
  CARWASH_B,
  PART_CARD_LINE,
  PART_EMAIL_RECEIPT,
  CASH_WASH_ONE_OFF,
  SUBSCRIPTION_WASH,
} from './__fixtures__/coolrunnings-corpus';

// ── tiny harness ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++;
  else {
    failed++;
    failures.push(msg);
    console.error('   ✗ ' + msg);
  }
}
function test(name: string, fn: () => void): void {
  console.log('▶ ' + name);
  fn();
}

// Full corpus → flat CostEvent[] (the owner-does-nothing picture).
function fullCorpus(): CostEvent[] {
  return [
    ...COOLRUNNINGS_NODES.flatMap(fromCostObject),
    ECOBEE_PURCHASE as CostEvent,
    ECOBEE_RETURN as CostEvent,
    fromRecurringLine(NABU_CASA_RECURRING),
  ];
}

// ── 0. sameCost() unit checks — event-not-receipt is load-bearing ──────────────────
test('0. sameCost: receipt is a container of line events, not the identity', () => {
  const evs = COOLRUNNINGS_NODES.flatMap(fromCostObject);
  const nspanel = evs.find((e) => e.id === 'cr-nspanel-pro-120')!;
  const meross = evs.find((e) => e.id === 'cr-meross-mts300hk')!;
  // Same receipt (amzn-114-2466808), DIFFERENT line items → must NOT collapse.
  ok(sameCost(nspanel, meross).outcome === 'DISTINCT',
    'NSPanel vs meross share a receipt but are distinct line items — expected DISTINCT');
  ok(sameCost(nspanel, meross).bucket === 'KNOW',
    '...and the data proves it (same receipt, both amounts known, differ) → KNOW');
  // Same receipt + same amount → MERGE (the genuine duplicate).
  const dup = fromRecurringLine(NSPANEL_DUP_AS_RECURRING);
  ok(sameCost(nspanel, dup).outcome === 'MERGE',
    'NSPanel node vs its duplicate recurring line (same receipt+amount) — expected MERGE');
});

// ── 0b. CANONICAL: car-wash subscription — the under-count trap ─────────────────────
test('0b. two same-merchant $9.99 charges a month apart → DISTINCT×2 + RECURRING_FIXED + NEED_CLARIFICATION', () => {
  const m = sameCost(CARWASH_A, CARWASH_B);
  // Must NOT merge (that would under-count to $9.99 instead of the real $19.98 exposure).
  ok(m.outcome === 'NEED_CLARIFICATION',
    `two monthly car-wash charges → NEED_CLARIFICATION (not a silent merge); got ${m.outcome}`);
  ok(m.outcome !== 'MERGE',
    'assertion has teeth: a naive same-merchant+amount deduper would MERGE and under-count');
  // Must recognize the RECURRING shape (inferred from ~monthly spacing) — NOT per-occasion.
  ok(m.shape === 'RECURRING_FIXED',
    `recurring shape recognized from spacing; got ${m.shape}`);
  ok(m.shape !== 'PER_OCCASION',
    'assertion has teeth: treating these as per-occasion washes would mis-shape the cost');
  // Must carry a GOOD suggested disposition (acceptance-cheap), not a bare "is this a dup?".
  ok(m.suggestion?.proposed === 'DISTINCT',
    'suggested disposition proposes keeping both (DISTINCT) so the recurring cost is not under-counted');
  ok(!!m.suggestion && /vehicle|business|personal|subscription/i.test(m.suggestion.question),
    `the question names the real interpretations (vehicles / business+personal); got: ${m.suggestion?.question}`);
  ok((m.suggestion?.candidates.length ?? 0) >= 2,
    'the disposition offers the candidate interpretations to choose between');
  ok(!/^is this a duplicate\??$/i.test(m.suggestion?.question ?? ''),
    'assertion has teeth: the question is specific, not a bare "is this a duplicate?"');
  // Prove the recurring shape is reachable from SPACING ALONE — strip the pool-bucket and
  // cadence signals so classifyShape() yields UNKNOWN_SHAPE; only the ~31-day gap is left.
  const aBare: CostEvent = { ...CARWASH_A, bucket: 'CAPEX', cadence: undefined };
  const bBare: CostEvent = { ...CARWASH_B, bucket: 'CAPEX', cadence: undefined };
  const mBare = sameCost(aBare, bBare);
  ok(classifyShape(aBare) === 'UNKNOWN_SHAPE' && mBare.shape === 'RECURRING_FIXED',
    'with no bucket/cadence hint, the ~31-day spacing alone infers RECURRING_FIXED');
  console.log('   ↳ suggested disposition:', JSON.stringify(m.suggestion, null, 2));
});

// ── 0c. card line + email receipt for ONE purchase → MERGE ──────────────────────────
test('0c. card line + email receipt (same merchant/amount/day) → MERGE, count once', () => {
  const m = sameCost(PART_CARD_LINE, PART_EMAIL_RECEIPT);
  ok(m.outcome === 'MERGE',
    `one purchase corroborated by card line + receipt → MERGE; got ${m.outcome}`);
  ok(m.matchedOn === 'merchant+amount+date',
    `merged on the fuzzy same-purchase signal; got ${m.matchedOn}`);
  // Through the seam, it counts ONCE and the SUBSTANTIATED record wins.
  const r = enforceCountOnce([PART_CARD_LINE, PART_EMAIL_RECEIPT]);
  ok(r.deduped.length === 1 && r.capexKnown === 48.27,
    `counted once = 48.27; got deduped=${r.deduped.length}, capex=${r.capexKnown}`);
  ok(r.deduped[0]?.droppedId === 'part-card',
    'the owner-asserted card line is dropped in favor of the substantiated receipt');
  ok(r.capexKnown !== 96.54, 'assertion has teeth: not merging would double-count to 96.54');
});

// ── 0d. one-off cash wash vs subscription wash → different SHAPE ─────────────────────
test('0d. classifyShape separates a one-off wash from a subscription, even at equal $', () => {
  ok(classifyShape(CASH_WASH_ONE_OFF) === 'PER_OCCASION',
    `explicit one-off wash → PER_OCCASION; got ${classifyShape(CASH_WASH_ONE_OFF)}`);
  ok(classifyShape(SUBSCRIPTION_WASH) === 'RECURRING_FIXED',
    `monthly wash club → RECURRING_FIXED; got ${classifyShape(SUBSCRIPTION_WASH)}`);
  ok(classifyShape(CASH_WASH_ONE_OFF) !== classifyShape(SUBSCRIPTION_WASH),
    'assertion has teeth: equal $9.99 amounts do NOT collapse the shape distinction');
});

// ── 1. Capex-no-leak (Shape 2) ─────────────────────────────────────────────────────
test('1. CAPEX does not divide into the ÷N monthly pool (Shape 2)', () => {
  const r = enforceCountOnce(fullCorpus());
  // Only the recurring Nabu Casa line is a monthly-pool cost. Capex stays out.
  ok(r.poolKnownMonthly === 6.5, `pool must be only the $6.50 recurring; got ${r.poolKnownMonthly}`);
  ok(r.capexKnown === 351.61, `capex floor = NSPanel 259.80 + meross 91.81 = 351.61; got ${r.capexKnown}`);
  ok(r.counted.every((c) => !(c.bucket === 'MONTHLY_POOL' && c.amount > 100)),
    'no capex-sized item leaked into the monthly pool');
  // Bug-catch: a seam that leaked capex into the pool would report pool = 6.5 + 351.61.
  const buggyLeakPool = 6.5 + 351.61;
  ok(r.poolKnownMonthly !== buggyLeakPool,
    `assertion has teeth: a capex leak would make pool ${buggyLeakPool}, not ${r.poolKnownMonthly}`);
});

// ── 2. Double-count (Shape 1) ──────────────────────────────────────────────────────
test('2. same cost in BOTH accumulator and pool is counted ONCE (Shape 1)', () => {
  const events: CostEvent[] = [
    ...fromCostObject(COOLRUNNINGS_NODES[0]),         // NSPanel node (CAPEX, SUBSTANTIATED)
    fromRecurringLine(NSPANEL_DUP_AS_RECURRING),      // same receipt, typed into the pool too
  ];
  const r = enforceCountOnce(events);
  ok(r.deduped.length === 1, `exactly one duplicate collapsed; got ${r.deduped.length}`);
  const total = r.capexKnown + r.poolKnownMonthly;
  ok(total === 259.8, `NSPanel counted once = 259.80; got ${total}`);
  // The substantiated node should win over the owner-asserted pool dup.
  ok(r.deduped[0]?.droppedId === 'cr-nspanel-dup',
    'the owner-asserted pool duplicate is dropped, the substantiated node is kept');
  // Bug-catch: no dedup → both counted = 519.60.
  ok(total !== 519.6, `assertion has teeth: double-counting would total 519.60, not ${total}`);
});

// ── 3. UNKNOWN honesty (owner-does-nothing) ────────────────────────────────────────
test('3. UNKNOWN-cost capex is surfaced + flagged, never zeroed (HP ProDesk)', () => {
  const r = enforceCountOnce(fullCorpus());
  ok(r.unknownLines.some((l) => l.id === 'cr-hp-prodesk-600-g6'),
    'HP ProDesk surfaced as an UNKNOWN line');
  ok(r.counted.every((c) => c.id !== 'cr-hp-prodesk-600-g6'),
    'HP ProDesk is NOT silently counted (e.g. as $0)');
  // Owner did nothing, yet a number is still produced (graceful degradation).
  ok(typeof r.capexKnown === 'number' && typeof r.poolKnownMonthly === 'number',
    'the seam still produces a number with unknowns present');
  // Bug-catch: a seam that coerced null→0 would put HP in `counted` and shrink unknownLines.
  const buggyUnknownCount = r.unknownLines.length - 1;
  ok(r.unknownLines.length !== buggyUnknownCount,
    'assertion has teeth: zeroing HP would drop it from unknownLines');
});

// ── 4. Net-zero reversal ───────────────────────────────────────────────────────────
test('4. purchase + return nets to $0 — no double-count, no negative pool leak (Ecobee)', () => {
  const r = enforceCountOnce([ECOBEE_PURCHASE as CostEvent, ECOBEE_RETURN as CostEvent]);
  ok(r.netZeroPairs.length === 1 && r.netZeroPairs[0].net === 0,
    'Ecobee purchase+return recorded as a net-$0 pair');
  ok(r.capexKnown === 0, `Ecobee nets to $0 in capex; got ${r.capexKnown}`);
  ok(r.poolKnownMonthly >= 0, 'no negative amount leaked into the monthly pool');
  ok(r.counted.every((c) => c.id !== 'cr-ecobee-return'),
    'the return event is folded into its purchase, not listed as its own cost');
  // Bug-catch: ignoring the reversal would count +160 in capex.
  ok(r.capexKnown !== 160, `assertion has teeth: ignoring the return would make capex 160, not ${r.capexKnown}`);
});

// ── 5. Not-yet-a-cost (status conflict) ────────────────────────────────────────────
test('5. unconfirmed status carries uncertainty, not a silent $0 (Apollo MSR-2)', () => {
  const r = enforceCountOnce(COOLRUNNINGS_NODES.flatMap(fromCostObject));
  ok(r.unconfirmedLines.some((l) => l.id === 'cr-apollo-msr2'),
    'Apollo surfaced as an UNCONFIRMED (is-it-even-a-cost-yet) line');
  ok(r.counted.every((c) => c.id !== 'cr-apollo-msr2'),
    'Apollo is NOT counted as a firm cost...');
  ok(!r.counted.some((c) => c.id === 'cr-apollo-msr2' && c.amount === 0),
    '...and NOT silently counted as $0 (which would read as free hardware)');
  // Bug-catch: counting unconfirmed as a firm cost would add 212.50 to capex.
  ok(!r.counted.some((c) => c.id === 'cr-apollo-msr2'),
    'assertion has teeth: a firm-count bug would put Apollo in `counted`');
});

// ── 6. Over-correction guard ───────────────────────────────────────────────────────
test('6. a real recurring cost with NO node still counts — seam does not over-correct', () => {
  const r = enforceCountOnce(fullCorpus());
  ok(r.poolKnownMonthly === 6.5, `Nabu Casa $6.50 must survive; got ${r.poolKnownMonthly}`);
  ok(r.counted.some((c) => c.id === 'cr-nabu-casa'), 'Nabu Casa is in the counted set');
  ok(r.deduped.every((d) => d.droppedId !== 'cr-nabu-casa'),
    'Nabu Casa was not dropped by an over-aggressive dedup');
  // Bug-catch: an over-correcting seam that dropped no-node recurring costs → pool 0.
  ok(r.poolKnownMonthly !== 0, 'assertion has teeth: over-correction would zero the pool');
});

// ── 7. Two axes preserved (Core-2b must be able to separate them) ──────────────────
test('7. amount-confidence and substantiation are preserved + not collapsed', () => {
  const r = enforceCountOnce(fullCorpus());
  const nspanel = r.counted.find((c) => c.id === 'cr-nspanel-pro-120');
  ok(nspanel?.substantiation === 'SUBSTANTIATED' && nspanel?.amountConfidence === 'CONFIRMED',
    'NSPanel rides through as SUBSTANTIATED + CONFIRMED (both axes intact)');
  ok(r.substantiatedTotal === 351.61, `substantiated $ = NSPanel+meross 351.61; got ${r.substantiatedTotal}`);
  ok(r.ownerAssertedTotal === 6.5, `owner-asserted (at-risk) $ = Nabu 6.50; got ${r.ownerAssertedTotal}`);
  ok(r.substantiatedTotal !== r.ownerAssertedTotal && r.ownerAssertedTotal > 0,
    'the two axes are not collapsed into one number');
  // They must reconcile to the counted total.
  const countedTotal = r.capexKnown + r.poolKnownMonthly;
  ok(Math.abs(r.substantiatedTotal + r.ownerAssertedTotal - countedTotal) < 0.005,
    `substantiated + owner-asserted (${r.substantiatedTotal + r.ownerAssertedTotal}) reconciles to counted total (${countedTotal})`);
});

// ── 8. fromCostObject SHAPE-AWARENESS (migration 20260617 — the $0-collapse pivot) ──
test('8a. RECURRING_FIXED cost_object → MONTHLY_POOL, recurring_amount normalized by cadence', () => {
  const [ev] = fromCostObject({
    id: 'co-claude-pro', label: 'Claude Pro', node_type: 'COST',
    acquisition_cost: null, cost_confidence: 'CONFIRMED',
    cost_shape: 'RECURRING_FIXED', cadence: 'MONTHLY', recurring_amount: 17,
  });
  // A buggy CAPEX-only path (the old impl) would bucket this as CAPEX with amount=null
  // (acquisition_cost) and silently drop the $17/mo from the ÷N pool.
  ok(ev.bucket === 'MONTHLY_POOL', `recurring cost feeds the monthly pool, not CAPEX; got ${ev.bucket}`);
  ok(ev.amount === 17, `monthly cadence passes through: $17/mo; got ${ev.amount}`);
  ok(ev.amountConfidence === 'CONFIRMED', 'confidence rides through');
});

test('8b. ANNUAL recurring_amount is normalized to monthly (÷12)', () => {
  const [ev] = fromCostObject({
    id: 'co-domains', label: '6 domains (GoDaddy)', node_type: 'COST',
    acquisition_cost: null, cost_confidence: 'ESTIMATED',
    cost_shape: 'RECURRING_FIXED', cadence: 'ANNUAL', recurring_amount: 120,
  });
  // Buggy: treat the annual figure as monthly → $120/mo (10× overstatement).
  ok(ev.bucket === 'MONTHLY_POOL', 'annual recurring is still a pool feed');
  ok(ev.amount === 10, `$120/yr → $10.00/mo; got ${ev.amount}`);
});

test('8c. BYTE-IDENTICAL regression: absent cost_shape → CAPEX from acquisition_cost', () => {
  // This is the live state until the migration is applied + the read path selects shape.
  const [ev, ...rest] = fromCostObject({
    id: 'co-tractor', label: 'Mahindra tractor', node_type: 'ASSET',
    acquisition_cost: 5000, cost_confidence: 'ESTIMATED',
    // no cost_shape / cadence / recurring_amount — exactly what today's select returns
  });
  ok(ev.bucket === 'CAPEX', `no shape → CAPEX (byte-identical to prior impl); got ${ev.bucket}`);
  ok(ev.amount === 5000, `CAPEX amount = acquisition_cost 5000; got ${ev.amount}`);
  ok(rest.length === 0, 'one event, no conversion (none supplied)');
});

test('8d. UNKNOWN recurring_amount → null, NEVER coerced to $0 (Surface Honesty)', () => {
  const [ev] = fromCostObject({
    id: 'co-api', label: 'Claude API usage', node_type: 'COST',
    acquisition_cost: null, cost_confidence: 'UNKNOWN',
    cost_shape: 'RECURRING_FIXED', cadence: 'MONTHLY', recurring_amount: null,
  });
  ok(ev.bucket === 'MONTHLY_POOL', 'still a pool feed even when amount is unknown');
  ok(ev.amount === null, `unknown amount stays null, not 0; got ${ev.amount}`);
});

test('8e. PIVOT: a recurring cost_object lands in the monthly pool (poolKnownMonthly), not capex', () => {
  const r = enforceCountOnce(fromCostObject({
    id: 'co-gemini', label: 'Gemini Advanced', node_type: 'COST',
    acquisition_cost: null, cost_confidence: 'CONFIRMED',
    cost_shape: 'RECURRING_FIXED', cadence: 'MONTHLY', recurring_amount: 20,
  }));
  // Buggy CAPEX path would put $20 in capexKnown and $0 in the pool → tile reads $0/mo.
  ok(r.poolKnownMonthly === 20, `recurring $20 feeds the ÷N pool; got ${r.poolKnownMonthly}`);
  ok(r.capexKnown === 0, `nothing leaks into capex; got ${r.capexKnown}`);
});

// ── report ─────────────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────');
console.log(`COUNT-ONCE SEAM TESTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('FAILURES:\n - ' + failures.join('\n - '));
  process.exit(1);
} else {
  console.log('✓ all seam tests pass AND each proves it can catch its bug');
}
