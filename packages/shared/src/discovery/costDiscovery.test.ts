/**
 * ── COST-DISCOVERY — adversarial tests · 2026-06-21 ─────────────────────────────────
 *
 * Proves the D-9 cost honesty contract WITHOUT a live AI call (the gateway is injected).
 * Each test asserts the real code REFUSES the failure mode a naïve cost extractor would
 * commit: claiming CONFIRMED, fabricating a number, dressing a guess as DERIVED, or
 * clobbering a line on a declined answer.
 *
 * Run (no test runner installed — pure TS, esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/discovery/costDiscovery.test.ts \
 *     --bundle --platform=node --format=cjs --external:@anthropic-ai/sdk \
 *     --external:@supabase/supabase-js | node
 */

import {
  guardReasoning, costReasoningToInventoryUpdate, reasonCostTurn, applyCostReasoning,
  CostConfidenceViolation, type CostDiscoveryLine, type CostReasoning,
} from './costDiscovery';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
async function throws(fn: () => Promise<any> | any, ctor: any, msg: string): Promise<void> {
  try { await fn(); ok(false, msg + ' (did NOT throw)'); }
  catch (e) { ok(e instanceof ctor, msg + (e instanceof ctor ? '' : ` (wrong error: ${e})`)); }
}

const LINE = (over: Partial<CostDiscoveryLine> = {}): CostDiscoveryLine =>
  ({ id: 'inv-1', businessId: 'biz-1', name: '30-gal Live Oak', category: 'Oak',
     currentCost: null, currentConfidence: 'UNKNOWN', ...over });

// ── 1. guardReasoning REJECTS CONFIRMED — the core never-CONFIRMED guard ───────────
{
  void throws(() => guardReasoning({ cost: 12, confidence: 'CONFIRMED', basis: 'b' }), CostConfidenceViolation,
    '1: a model claiming CONFIRMED is rejected (not silently downgraded)');
  void throws(() => guardReasoning({ cost: 12, confidence: 'confirmed' }), CostConfidenceViolation,
    '1: CONFIRMED rejection is case-insensitive');
}

// ── 2. never fabricate — no real number ⇒ UNKNOWN no matter what was claimed ────────
{
  const r1 = guardReasoning({ cost: null, confidence: 'ESTIMATED', basis: 'guessy' });
  ok(r1.confidence === 'UNKNOWN' && r1.cost === null, '2: null cost + ESTIMATED → UNKNOWN/null');
  const r2 = guardReasoning({ cost: 0, confidence: 'DERIVED', derivation: '1+(-1)' });
  ok(r2.confidence === 'UNKNOWN' && r2.cost === null, '2: zero cost → UNKNOWN (never writes $0)');
  const r3 = guardReasoning({ cost: -5, confidence: 'ESTIMATED' });
  ok(r3.confidence === 'UNKNOWN' && r3.cost === null, '2: negative cost → UNKNOWN');
  const r4 = guardReasoning({ cost: 'not a number', confidence: 'ESTIMATED' });
  ok(r4.confidence === 'UNKNOWN' && r4.cost === null, '2: non-numeric cost → UNKNOWN');
}

// ── 3. a guess is never DERIVED — DERIVED without derivation → ESTIMATED ────────────
{
  const r = guardReasoning({ cost: 14.5, confidence: 'DERIVED', basis: 'feels right', derivation: '' });
  ok(r.confidence === 'ESTIMATED', '3: DERIVED with no arithmetic is demoted to ESTIMATED');
  ok(r.derivation === null, '3: demoted row carries no derivation');
  ok(r.cost === 14.5, '3: the number itself is preserved');
}

// ── 4. honest DERIVED + honest ESTIMATED pass through intact ────────────────────────
{
  const d = guardReasoning({ cost: 13.2, confidence: 'DERIVED', basis: 'computed', derivation: 'liner 4 + 18mo*0.4 + pot 2 = 13.2' });
  ok(d.confidence === 'DERIVED' && d.cost === 13.2 && !!d.derivation, '4: DERIVED with arithmetic stays DERIVED + keeps derivation');
  const e = guardReasoning({ cost: 9, confidence: 'ESTIMATED', basis: 'owner ballpark', derivation: 'should-be-stripped' });
  ok(e.confidence === 'ESTIMATED' && e.cost === 9, '4: ESTIMATED with a number stays ESTIMATED');
  ok(e.derivation === null, '4: a non-DERIVED row never carries a derivation');
}

// ── 5. costReasoningToInventoryUpdate — UNKNOWN writes nothing; valid writes a patch ─
{
  ok(costReasoningToInventoryUpdate({ cost: null, confidence: 'UNKNOWN', basis: 'x', derivation: null }) === null,
    '5: UNKNOWN → null patch (line left as-is)');
  const p = costReasoningToInventoryUpdate({ cost: 13.2, confidence: 'DERIVED', basis: 'x', derivation: 'd' });
  ok(p?.unit_cost === 13.2 && p?.cost_confidence === 'DERIVED', '5: DERIVED → patch with unit_cost + DERIVED');
  void throws(() => costReasoningToInventoryUpdate({ cost: 5, confidence: 'CONFIRMED' as any, basis: 'x', derivation: null }),
    CostConfidenceViolation, '5: a runtime CONFIRMED at the write boundary is rejected too');
}

// ── 6. reasonCostTurn — confidence SHARPENS ESTIMATED → DERIVED as answers arrive ───
(async () => {
  // Turn 1 (no answers): a soft ESTIMATED + the next question.
  // Turn 2 (one answer):  a DERIVED with arithmetic + no further question.
  const exec = (_cap: string, opts: { user: string }) =>
    Promise.resolve(/answer:/.test(opts.user) && !/no answers yet/.test(opts.user)
      ? { cost: 13.2, confidence: 'DERIVED', basis: 'computed', derivation: 'liner 4 + carry 7.2 + pot 2', needMore: false, nextQuestion: null }
      : { cost: 10, confidence: 'ESTIMATED', basis: 'ballpark from category', needMore: true, nextQuestion: { id: 'liner', prompt: 'What did the liner cost?' } });

  const t1 = await reasonCostTurn(LINE(), [], { apiKey: 'k', _execute: exec });
  ok(t1.reasoning.confidence === 'ESTIMATED' && t1.reasoning.cost === 10, '6: turn 1 is a soft ESTIMATED');
  ok(t1.needMore && t1.nextQuestion?.id === 'liner', '6: turn 1 asks the next question');

  const t2 = await reasonCostTurn(LINE(), [{ questionId: 'liner', text: '$4 each' }], { apiKey: 'k', _execute: exec });
  ok(t2.reasoning.confidence === 'DERIVED' && !!t2.reasoning.derivation, '6: turn 2 sharpens to DERIVED with arithmetic');
  ok(!t2.needMore && t2.nextQuestion === null, '6: turn 2 has enough → no further question');
})();

// ── 7. reasonCostTurn — a FORCED CONFIRMED from the model is BLOCKED (required proof) ─
(async () => {
  const forceConfirmed = () => Promise.resolve({ cost: 99, confidence: 'CONFIRMED', basis: 'I saw a receipt (it did not)', needMore: false, nextQuestion: null });
  await throws(() => reasonCostTurn(LINE(), [], { apiKey: 'k', _execute: forceConfirmed }), CostConfidenceViolation,
    '7: model forcing CONFIRMED is rejected by the turn (never written)');
})();

// ── 8. reasonCostTurn — a declined answer that yields UNKNOWN stays honest ───────────
(async () => {
  const declined = () => Promise.resolve({ cost: null, confidence: 'UNKNOWN', basis: 'owner declined; cannot estimate', needMore: false, nextQuestion: null });
  const t = await reasonCostTurn(LINE({ currentCost: 7, currentConfidence: 'ESTIMATED' }), [{ questionId: 'liner', text: '' }], { apiKey: 'k', _execute: declined });
  ok(t.reasoning.confidence === 'UNKNOWN' && t.reasoning.cost === null, '8: declined → UNKNOWN, no fabricated number');
})();

// ── 9. applyCostReasoning — UNKNOWN leaves the line WHERE IT WAS (no DB write) ───────
(async () => {
  let updateCalled = false;
  const fakeDb: any = { from: () => ({ update: () => { updateCalled = true; return { eq: () => ({ eq: () => ({ error: null }) }) }; } }) };
  const r: CostReasoning = { cost: null, confidence: 'UNKNOWN', basis: 'x', derivation: null };
  const res = await applyCostReasoning(LINE({ currentCost: 7, currentConfidence: 'ESTIMATED' }), r, fakeDb);
  ok(!res.updated && !updateCalled, '9: UNKNOWN → NO update call (line untouched)');
  ok(res.unitCost === 7 && res.confidence === 'ESTIMATED', '9: returns the line exactly as it was');
})();

// ── 10. applyCostReasoning — valid cost writes unit_cost + confidence, tenant-scoped ─
(async () => {
  const calls: any = { update: null, eqs: [] as Array<[string, any]> };
  const fakeDb: any = { from: (t: string) => { calls.table = t; return {
    update: (patch: any) => { calls.update = patch; return {
      eq: (k: string, v: any) => { calls.eqs.push([k, v]); return {
        eq: (k2: string, v2: any) => { calls.eqs.push([k2, v2]); return { error: null }; } }; } }; } }; } };
  const r: CostReasoning = { cost: 13.2, confidence: 'DERIVED', basis: 'computed', derivation: 'liner+carry+pot' };
  const res = await applyCostReasoning(LINE(), r, fakeDb);
  ok(res.updated && calls.update.unit_cost === 13.2 && calls.update.cost_confidence === 'DERIVED', '10: writes unit_cost + DERIVED');
  ok(calls.table === 'business_inventory', '10: writes to business_inventory');
  const eqMap = Object.fromEntries(calls.eqs);
  ok(eqMap['id'] === 'inv-1' && eqMap['business_id'] === 'biz-1', '10: scoped by id AND business_id (tenant-safe)');
})();

// ── results ───────────────────────────────────────────────────────────────────────
setTimeout(() => {
  console.log(`\ncostDiscovery.test.ts — ${passed} passed, ${failed} failed`);
  if (failed) { console.error('\nFAILURES:\n - ' + failures.join('\n - ')); process.exit(1); }
}, 200);
