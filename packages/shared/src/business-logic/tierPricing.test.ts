/**
 * ── TIER PRICING — adversarial tests · Item-1 AC-4 close · 2026-07-09 ────────────────
 *
 * Proves the percent-off-baseline tier mechanism (the SOLE arithmetic behind the cultivar
 * checkout tier discount): a configured tier discounts the stored sell_price; retail / default /
 * unknown / 0% leave it UNCHANGED; a discount never exceeds baseline; malformed config is coerced
 * to the safe seed. Each test computes what a WRONG implementation would produce and asserts.
 *
 * Run (no test runner — pure TS over pure functions):
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/tierPricing.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import {
  applyTierDiscount, tierDiscountPercent, normalizePricingTiers, clampPercent,
  DEFAULT_PRICING_TIERS, type PricingTier,
} from './tierPricing';

// ── tiny harness ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
function test(name: string, fn: () => void): void { console.log('▶ ' + name); fn(); }

// Owner-configured tiers: contractor 10% off, wholesale 25% off, retail default 0%.
const TIERS: PricingTier[] = [
  { name: 'retail',     discountPercent: 0,  isDefault: true },
  { name: 'contractor', discountPercent: 10 },
  { name: 'wholesale',  discountPercent: 25 },
];

// ── 1. the mechanism: a configured tier discounts the stored sell_price. ───────────
test('1. contractor 10% off $124 → $111.60', () => {
  ok(applyTierDiscount(124, 'contractor', TIERS) === 111.6, `got ${applyTierDiscount(124, 'contractor', TIERS)}`);
  ok(applyTierDiscount(200, 'wholesale', TIERS) === 150, `wholesale 25% off 200 → 150; got ${applyTierDiscount(200, 'wholesale', TIERS)}`);
});

// ── 2. retail / default / unknown / null → price UNCHANGED (never re-derives). ─────
test('2. retail + unknown + null tiers all pass the baseline through', () => {
  ok(applyTierDiscount(124, 'retail', TIERS) === 124, 'retail (0%) → unchanged');
  ok(applyTierDiscount(124, 'nonesuch', TIERS) === 124, 'unknown tier → default (retail 0%) → unchanged');
  ok(applyTierDiscount(124, null, TIERS) === 124, 'null tier → default → unchanged');
  ok(applyTierDiscount(124, undefined, TIERS) === 124, 'undefined tier → default → unchanged');
});

// ── 3. cents rounding on an odd baseline. ──────────────────────────────────────────
test('3. 10% off $99.99 → $89.99 (rounded to cents, not $89.991)', () => {
  ok(applyTierDiscount(99.99, 'contractor', TIERS) === 89.99, `got ${applyTierDiscount(99.99, 'contractor', TIERS)}`);
});

// ── 4. a discount NEVER produces a price above baseline; $0/negative pass through. ─
test('4. negative/absurd percents are clamped; non-positive price passes through', () => {
  const bad: PricingTier[] = [{ name: 'x', discountPercent: -50, isDefault: true }, { name: 'huge', discountPercent: 999 }];
  ok(applyTierDiscount(100, 'x', bad) === 100, 'negative % clamped to 0 → unchanged');
  ok(applyTierDiscount(100, 'huge', bad) === 0, '999% clamped to 100 → $0 floor, not negative');
  ok(applyTierDiscount(0, 'huge', bad) === 0, 'price 0 passes through');
  ok(applyTierDiscount(-5, 'huge', bad) === -5, 'non-positive price is untouched (submit.ts refuses it upstream)');
});

// ── 5. tierDiscountPercent lookup. ─────────────────────────────────────────────────
test('5. tierDiscountPercent resolves by name and falls back to default', () => {
  ok(tierDiscountPercent('contractor', TIERS) === 10, 'contractor → 10');
  ok(tierDiscountPercent('', TIERS) === 0, 'empty → default 0');
  ok(clampPercent(NaN) === 0 && clampPercent(150) === 100 && clampPercent(-1) === 0, 'clamp bounds');
});

// ── 6. normalizePricingTiers coerces jsonb garbage to the safe seed + guarantees a default. ─
test('6. normalize: garbage → seed; missing default → retail; malformed rows dropped', () => {
  ok(normalizePricingTiers(undefined).length === DEFAULT_PRICING_TIERS.length, 'undefined → seed');
  ok(normalizePricingTiers('nope' as unknown).some(t => t.isDefault), 'string → seed (has a default)');
  const noDefault = normalizePricingTiers([{ name: 'retail', discountPercent: 5 }, { name: 'contractor', discountPercent: 10 }]);
  ok(noDefault.find(t => t.name === 'retail')?.isDefault === true, 'no isDefault flagged → retail becomes default');
  const withGarbage = normalizePricingTiers([{ name: 'a', discountPercent: 5 }, { nope: 1 }, null, { name: 42 }]);
  ok(withGarbage.length === 1 && withGarbage[0].name === 'a', 'rows without a string name are dropped');
  ok(normalizePricingTiers([{ name: 'a', discountPercent: 'x' }])[0].discountPercent === 0, 'non-numeric percent → 0');
});

// ── run ────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => ' - ' + f).join('\n')); process.exit(1); }
