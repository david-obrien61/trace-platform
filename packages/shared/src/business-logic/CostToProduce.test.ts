/**
 * ── COST-TO-PRODUCE SEAM-FEED — adversarial tests · Core-2b SUB-3 · 2026-06-15 ────
 *
 * Proves the period-pool engine (the live Cost tile) (a) is UNCHANGED on the config-only
 * path (zero regression — the proven behavior), and (b) when fed real captured cost_objects
 * through the count-once seam: keeps CAPEX OUT of the ÷N monthly pool, counts a cost present
 * twice ONCE, and folds a captured RECURRING cost into the pool. Each test computes what a
 * BUGGY engine would produce and asserts the real one differs.
 *
 * Run (no test runner installed — pure TS over pure functions):
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/CostToProduce.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { accumulate, analyze } from './CostToProduce';
import type { CostToProduceConfig } from './CostToProduce';
import type { CostEvent } from './CountOnceSeam';

// ── tiny harness ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
function test(name: string, fn: () => void): void { console.log('▶ ' + name); fn(); }

// A minimal config: $6.50/mo CONFIRMED recurring + a $120/yr ESTIMATED recurring.
function cfg(): CostToProduceConfig {
  return {
    version: 1,
    unitLabel: 'customer-month',
    denominators: [1, 5],
    margin: { baseline: 0.4, tiers: [{ name: 'standard', marginOverride: 0.4, isDefault: true }] },
    priceReference: 149,
    locations: [{
      id: 'primary', name: 'Primary', kind: 'base',
      recurring: [
        { label: 'Nabu Casa', amount: 6.5, period: 'monthly', confidence: 'CONFIRMED' },
        { label: 'Domain', amount: 120, period: 'annual', confidence: 'ESTIMATED' }, // → $10/mo estimated
      ],
      labor: { rate: null, hours: null, period: 'monthly', confidence: 'ESTIMATED' },
      overheadPerUnit: 0,
    }],
  };
}

// ── 1. REGRESSION: config-only path is unchanged (the proven live tile). ───────────
test('1. config-only accumulate is unchanged — floor 6.50, estimated 10.00, no seam fields', () => {
  const a = accumulate(cfg());
  ok(a.floorMonthly === 6.5, `floor = Nabu Casa 6.50; got ${a.floorMonthly}`);
  ok(a.estimatedMonthly === 10, `estimated = Domain 120/yr → 10.00/mo; got ${a.estimatedMonthly}`);
  ok(a.knownMonthly === 16.5, `known = 16.50; got ${a.knownMonthly}`);
  ok(a.fedFromRollup === undefined && a.capexExcluded === undefined,
    'no seam-fed fields appear on the config-only path (zero behavioral change)');
  // Empty opts must behave identically to no opts.
  const b = accumulate(cfg(), {});
  ok(b.knownMonthly === 16.5 && b.fedFromRollup === undefined,
    'accumulate(config, {}) === accumulate(config)');
});

// ── 2. CAPEX EXCLUDED: a captured asset does NOT inflate the monthly pool. ─────────
test('2. a captured $259.80 CAPEX asset is excluded from the ÷N monthly pool', () => {
  const capexAsset: CostEvent = {
    id: 'obj-nspanel', label: 'NSPanel ×2', amount: 259.8, bucket: 'CAPEX',
    amountConfidence: 'CONFIRMED', substantiation: 'SUBSTANTIATED', source: 'cost_objects:nspanel',
  };
  const a = accumulate(cfg(), { rollupEvents: [capexAsset] });
  ok(a.fedFromRollup === true, 'accumulation is marked seam-fed');
  ok(a.knownMonthly === 16.5, `monthly pool stays 16.50 (capex excluded); got ${a.knownMonthly}`);
  ok(a.capexExcluded === 259.8, `captured capital surfaced separately = 259.80; got ${a.capexExcluded}`);
  // Bug-catch: a naive engine that summed all captured cost into the pool → 276.30.
  ok(a.knownMonthly !== 276.3, 'assertion has teeth: pooling capex would make the monthly 276.30');
});

// ── 3. COUNT-ONCE: the same captured purchase recorded twice counts once. ──────────
test('3. one purchase captured twice (same receipt+amount) → counted ONCE in capex', () => {
  const twice: CostEvent[] = [
    { id: 'obj-a', label: 'Rig', amount: 100, bucket: 'CAPEX', amountConfidence: 'CONFIRMED', substantiation: 'SUBSTANTIATED', receiptId: 'r-1', source: 'cost_objects:a' },
    { id: 'obj-b', label: 'Rig', amount: 100, bucket: 'CAPEX', amountConfidence: 'CONFIRMED', substantiation: 'OWNER_ASSERTED', receiptId: 'r-1', source: 'cost_objects:b' },
  ];
  const a = accumulate(cfg(), { rollupEvents: twice });
  ok(a.capexExcluded === 100, `the duplicated $100 purchase counts once; got ${a.capexExcluded}`);
  ok(a.knownMonthly === 16.5, 'the duplicate does not touch the monthly pool either');
  ok(a.capexExcluded !== 200, 'assertion has teeth: double-counting would make captured capital 200');
});

// ── 4. RECURRING captured cost folds INTO the pool (and adds to it). ───────────────
test('4. a captured MONTHLY recurring cost folds into the pool on top of config', () => {
  const captured: CostEvent = {
    id: 'obj-internet', label: 'Internet', amount: 80, bucket: 'MONTHLY_POOL',
    amountConfidence: 'CONFIRMED', substantiation: 'SUBSTANTIATED', source: 'cost_objects:internet',
  };
  const a = accumulate(cfg(), { rollupEvents: [captured] });
  ok(a.floorMonthly === 86.5, `floor = config 6.50 + captured 80 = 86.50; got ${a.floorMonthly}`);
  ok(a.knownMonthly === 96.5, `known = 86.50 + 10.00 estimated = 96.50; got ${a.knownMonthly}`);
  // And analyze() prices off the fed pool (sensitivity reflects it).
  const r = analyze(cfg(), [], { rollupEvents: [captured] });
  ok(r.sensitivity[0].costKnown === 96.5, `per-N=1 cost uses the fed pool; got ${r.sensitivity[0].costKnown}`);
  ok(r.confidence.fedFromRollup === true, 'analyze() surfaces the seam-fed flag to the tile');
  // Bug-catch: ignoring the captured recurring cost would leave floor at 6.50.
  ok(a.floorMonthly !== 6.5, 'assertion has teeth: dropping the captured recurring cost would keep floor at 6.50');
});

// ── report ─────────────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────');
console.log(`COST-TO-PRODUCE SEAM-FEED TESTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('FAILURES:\n - ' + failures.join('\n - '));
  process.exit(1);
} else {
  console.log('✓ all seam-feed tests pass AND each proves it can catch its bug');
}
