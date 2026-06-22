/**
 * ── COST-DISCOVERY SERVICE-KEY PROOF ───────────────────────────────────────────────
 *
 * PURPOSE: Prove the cost-discovery capability against the LIVE business_inventory
 *   table on the service key (BUILDER-COMPLETE bar):
 *     1. ESTIMATED is written correctly (unit_cost + cost_confidence='ESTIMATED').
 *     2. confidence SHARPENS ESTIMATED → DERIVED across answers and the write reflects it.
 *     3. the never-CONFIRMED guard ACTUALLY BLOCKS a forced-CONFIRMED model attempt —
 *        the turn raises CostConfidenceViolation and the row is left UNCHANGED.
 *     4. an UNKNOWN turn leaves the line WHERE IT WAS (no fabricated cost, no clobber).
 *   Operates on a self-created, self-deleted DISC-COSTPROOF line — touches no real data.
 *
 * DEPENDENCIES: packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY).
 *   The DB write path is REAL (live business_inventory). The Opus reasoning is replaced
 *   by a clearly-labelled deterministic STAND-IN (no Anthropic key needed) — the AI
 *   path's honesty is proven separately + exhaustively by costDiscovery.test.ts.
 *
 *   Run from repo root:
 *     node_modules/.bin/esbuild scripts/verify-cost-discovery.ts --bundle --platform=node \
 *       --format=cjs --external:@supabase/supabase-js --external:@anthropic-ai/sdk \
 *       | node - [--business=<uuid>]
 *
 * Instrumentation: [TRACE:COSTDISC] flows up from the shared module. ON by default.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import {
  reasonCostTurn, applyCostReasoning, CostConfidenceViolation,
  type CostDiscoveryLine,
} from '../packages/shared/src/discovery/costDiscovery';

const envText = readFileSync(`${process.cwd()}/packages/cultivar-os/.env.local`, 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
const arg = (k: string) => { const m = process.argv.find(a => a.startsWith(`--${k}=`)); return m ? m.split('=')[1] : null; };
const BUSINESS = arg('business') || env.VITE_DEMO_BUSINESS_ID || 'a1b2c3d4-0000-0000-0000-000000000001';

let pass = 0, fail = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) { pass++; console.log('   ✓ ' + m); } else { fail++; fails.push(m); console.error('   ✗ ' + m); } };

// ── deterministic AI stand-in — labelled, used in place of the Opus call ────────────
// Returns whatever scripted reasoning each phase needs. The DB write path is real.
const standIn = (script: any) => (_cap: string, _opts: any) => Promise.resolve(script);

async function readLine(id: string) {
  const { data } = await sb.from('business_inventory').select('id,business_id,unit_cost,cost_confidence,name').eq('id', id).maybeSingle();
  return data as any;
}

(async () => {
  console.log(`\n[cost-discovery proof] tenant ${BUSINESS} — live business_inventory, service key, stand-in reasoning\n`);

  // Create a throwaway line to cost.
  const ins = await sb.from('business_inventory').insert({
    business_id: BUSINESS, sku: 'DISC-COSTPROOF', name: 'PROOF 30-gal Live Oak',
    qty: 0, unit_cost: null, cost_confidence: 'UNKNOWN', status: 'available', notes: '[COSTPROOF] temp',
  }).select('id').single();
  if (ins.error) { console.error('setup insert failed:', ins.error.message); process.exit(1); }
  const id = (ins.data as any).id;
  const line = (cur: any): CostDiscoveryLine =>
    ({ id, businessId: BUSINESS, name: 'PROOF 30-gal Live Oak', category: 'Oak', currentCost: cur?.unit_cost ?? null, currentConfidence: cur?.cost_confidence ?? 'UNKNOWN' });

  try {
    // (1) ESTIMATED — a soft owner guess is written as ESTIMATED.
    const tEst = await reasonCostTurn(line(null), [], { apiKey: 'x', _execute: standIn(
      { cost: 10, confidence: 'ESTIMATED', basis: 'owner ballpark from category', needMore: true, nextQuestion: { id: 'liner', prompt: 'What did the liner cost?' } }) });
    ok(tEst.reasoning.confidence === 'ESTIMATED' && tEst.nextQuestion?.id === 'liner', '(1) turn yields ESTIMATED + a next question');
    await applyCostReasoning(line(null), tEst.reasoning, sb);
    let row = await readLine(id);
    ok(Number(row.unit_cost) === 10 && row.cost_confidence === 'ESTIMATED', '(1) DB now holds unit_cost=10, ESTIMATED');

    // (2) DERIVED — one answer later, the estimate sharpens; the write reflects it.
    const tDer = await reasonCostTurn(line(row), [{ questionId: 'liner', text: '$4 each, 18 months in pot' }], { apiKey: 'x', _execute: standIn(
      { cost: 13.2, confidence: 'DERIVED', basis: 'computed from confirmed inputs', derivation: 'liner 4 + 18mo*0.4 carry + pot 2 = 13.2', needMore: false, nextQuestion: null }) });
    ok(tDer.reasoning.confidence === 'DERIVED' && !!tDer.reasoning.derivation, '(2) turn SHARPENS ESTIMATED → DERIVED with arithmetic');
    await applyCostReasoning(line(row), tDer.reasoning, sb);
    row = await readLine(id);
    ok(Number(row.unit_cost) === 13.2 && row.cost_confidence === 'DERIVED', '(2) DB now holds unit_cost=13.2, DERIVED');

    // (3) FORCED CONFIRMED — the model lies and claims receipt-grade. The guard BLOCKS it.
    let blocked = false;
    try {
      await reasonCostTurn(line(row), [], { apiKey: 'x', _execute: standIn(
        { cost: 99, confidence: 'CONFIRMED', basis: 'pretending I saw a receipt', needMore: false, nextQuestion: null }) });
    } catch (e) { blocked = e instanceof CostConfidenceViolation; }
    ok(blocked, '(3) a forced CONFIRMED attempt raises CostConfidenceViolation (never reaches the DB)');
    row = await readLine(id);
    ok(Number(row.unit_cost) === 13.2 && row.cost_confidence === 'DERIVED', '(3) row UNCHANGED by the blocked attempt — still DERIVED, no $99, never CONFIRMED');

    // (4) UNKNOWN — a declined answer leaves the line exactly where it was.
    const tUnk = await reasonCostTurn(line(row), [{ questionId: 'losses', text: '' }], { apiKey: 'x', _execute: standIn(
      { cost: null, confidence: 'UNKNOWN', basis: 'owner declined; cannot derive losses', needMore: false, nextQuestion: null }) });
    const res = await applyCostReasoning(line(row), tUnk.reasoning, sb);
    ok(!res.updated, '(4) UNKNOWN turn makes NO write');
    row = await readLine(id);
    ok(Number(row.unit_cost) === 13.2 && row.cost_confidence === 'DERIVED', '(4) line left WHERE IT WAS — still 13.2 DERIVED, not blanked, not fabricated');
  } finally {
    await sb.from('business_inventory').delete().eq('id', id);   // cleanup — no proof rows left behind
    const gone = await readLine(id);
    ok(!gone, 'cleanup: proof row removed, real inventory untouched');
  }

  console.log(`\ncost-discovery proof — ${pass} passed, ${fail} failed`);
  if (fail) { console.error('FAILURES:\n - ' + fails.join('\n - ')); process.exit(1); }
})();
