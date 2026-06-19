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

// ── 5. MODEL B (D-16): PLATFORM_INVESTMENT is held OUT of the ÷N price, kept in known. ──
test('5. a PLATFORM_INVESTMENT cost leaves the divide but stays in known-monthly (payback line)', () => {
  // $1000/mo owner labor tagged PLATFORM_INVESTMENT + $200/mo COST_TO_SERVE subs (both CONFIRMED).
  const events: CostEvent[] = [
    { id: 'labor', label: 'Owner labor', amount: 1000, bucket: 'MONTHLY_POOL', amountConfidence: 'CONFIRMED', substantiation: 'OWNER_ASSERTED', recoveryBasis: 'PLATFORM_INVESTMENT', source: 'cost_objects:labor' },
    { id: 'subs', label: 'Subs', amount: 200, bucket: 'MONTHLY_POOL', amountConfidence: 'CONFIRMED', substantiation: 'OWNER_ASSERTED', recoveryBasis: 'COST_TO_SERVE', source: 'cost_objects:subs' },
  ];
  // A recurring-free, labor-free config so the ONLY pool inputs are these two events.
  const bare: CostToProduceConfig = { ...cfg(), denominators: [10], locations: [{ ...cfg().locations[0], recurring: [] }] };
  const r = analyze(bare, [], { rollupEvents: events });
  ok(r.confidence.knownMonthly === 1200, `known-monthly = 1000 + 200 = 1200 (honest total UNCHANGED); got ${r.confidence.knownMonthly}`);
  ok(r.costToServeMonthly === 200, `÷N price pool = COST_TO_SERVE only = 200; got ${r.costToServeMonthly}`);
  ok(r.platformInvestmentMonthly === 1000, `payback line = PLATFORM_INVESTMENT = 1000; got ${r.platformInvestmentMonthly}`);
  ok(r.costToServeMonthly + r.platformInvestmentMonthly === r.confidence.knownMonthly, 'split reconciles: cts + investment === known');
  // At N=10 the price divides ONLY cost-to-serve (200/10 = 20), NOT the whole 1200/10 = 120.
  ok(r.sensitivity[0].costKnown === 20, `per-N=10 cost uses cost-to-serve 200/10 = 20, NOT 1200/10 = 120; got ${r.sensitivity[0].costKnown}`);
  ok(r.sensitivity[0].costKnown !== 120, 'assertion has teeth: Model A would divide the whole 1200 → cost 120');
  // Contribution = priceKnown × N − cost-to-serve (the dollars/mo toward the investment). The
  // charm-rounded price ($33.99, not the raw $33.33) drives it, so assert against the definition.
  const expectedContrib = Math.round((r.sensitivity[0].priceKnown * 10 - 200) * 100) / 100;
  ok(r.sensitivity[0].contributionMonthly === expectedContrib,
    `contribution = priceKnown×N − cts = ${expectedContrib}; got ${r.sensitivity[0].contributionMonthly}`);
  ok(r.sensitivity[0].contributionMonthly < r.platformInvestmentMonthly,
    'honest payback: at this price+N the monthly contribution does NOT cover the $1000 investment');
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
