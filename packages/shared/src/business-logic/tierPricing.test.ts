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
  normalizeDiscountTypes, resolveTier, applyTierPrice, RETAIL_TIER_NAME, RETAIL_FLOOR,
  computeOrderPricing, type PricingLineInput,
  type DiscountType,
  resolveTaxRate, type OrderTaxExemption,
} from './tierPricing';
import { describeTaxLine, taxExemptionLabel } from './taxExemption';

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

/* ══ DISCOUNT TYPES × TIERS (the generalized model · 2026-07-10) ═══════════════════ */

// Owner-configured: a "Contractor" type (percent tiers) + a "Wholesale" type with an at-cost tier.
const TYPES: DiscountType[] = [
  { name: 'Contractor', tiers: [
    { name: 'contractor', basis: 'retail_minus_percent', discountPercent: 10 },
    { name: 'fleet',      basis: 'retail_minus_percent', discountPercent: 20, accessTerms: '$25/yr membership' },
  ] },
  { name: 'Wholesale', tiers: [
    { name: 'wholesale',  basis: 'at_cost', discountPercent: 0 },
  ] },
];

// ── 7. resolveTier: name → tier across types; null/retail/unknown → the retail floor. ─
test('7. resolveTier resolves across types and floors the unknown/null/retail cases', () => {
  ok(resolveTier('contractor', TYPES).discountPercent === 10, 'contractor → 10% tier');
  ok(resolveTier('fleet', TYPES).accessTerms === '$25/yr membership', 'fleet carries accessTerms');
  ok(resolveTier('wholesale', TYPES).basis === 'at_cost', 'wholesale → at_cost basis');
  ok(resolveTier(null, TYPES).name === RETAIL_TIER_NAME, 'null → retail floor');
  ok(resolveTier('retail', TYPES).discountPercent === 0, 'retail → 0%');
  ok(resolveTier('nonesuch', TYPES).name === RETAIL_TIER_NAME, 'unknown tier → retail floor (money-safe)');
});

// ── 8. applyTierPrice percent branch mirrors the flat mechanism. ────────────────────
test('8. applyTierPrice percent basis discounts sell_price; retail passes through', () => {
  const r = applyTierPrice(124, 24, resolveTier('contractor', TYPES));
  ok(r.price === 111.6 && r.applied && !r.degraded && r.basis === 'retail_minus_percent', `contractor 10% off 124 → 111.6; got ${r.price}`);
  const retail = applyTierPrice(124, 24, resolveTier('retail', TYPES));
  ok(retail.price === 124 && !retail.applied, 'retail → unchanged, not applied');
});

// ── 9. at_cost basis charges the server unit_cost, never the sell_price. ────────────
test('9. at_cost charges unit_cost (margin 0), independent of sell_price', () => {
  const r = applyTierPrice(124, 24, resolveTier('wholesale', TYPES));
  ok(r.price === 24 && r.applied && !r.degraded && r.basis === 'at_cost', `at_cost → 24 (the cost), not 124; got ${r.price}`);
  ok(applyTierPrice(124, 30.005, resolveTier('wholesale', TYPES)).price === 30.01, 'at_cost rounds cost to cents');
});

// ── 10. GRACEFUL DEGRADATION — at_cost with no cost on file → retail fallback, never $0. ─
test('10. at_cost + null/zero cost → retail sell_price + degraded flag (never fabricate $0)', () => {
  const nullCost = applyTierPrice(124, null, resolveTier('wholesale', TYPES));
  ok(nullCost.price === 124 && nullCost.degraded && !nullCost.applied, `null cost → 124 (retail), degraded; got ${nullCost.price}`);
  ok(applyTierPrice(124, 0, resolveTier('wholesale', TYPES)).price === 124, 'zero cost → retail fallback, not $0');
  ok(applyTierPrice(124, undefined, resolveTier('wholesale', TYPES)).degraded === true, 'undefined cost flags degraded');
});

// ── 11. normalizeDiscountTypes NON-DESTRUCTIVELY forward-migrates legacy flat pricingTiers. ─
test('11. forward-migrate legacy pricingTiers → a Contractor type, carrying percents; nothing lost', () => {
  const legacy = { pricingTiers: [
    { name: 'retail', discountPercent: 0, isDefault: true },
    { name: 'contractor', discountPercent: 15 },
    { name: 'wholesale', discountPercent: 30 },
  ] };
  const types = normalizeDiscountTypes(legacy);
  ok(types.length === 1 && types[0].name === 'Contractor', 'legacy → one Contractor type');
  ok(resolveTier('contractor', types).discountPercent === 15, 'legacy contractor 15% carried forward (not lost)');
  ok(resolveTier('wholesale', types).discountPercent === 30, 'legacy wholesale 30% carried forward');
  ok(types[0].tiers.every(t => t.name !== 'retail'), 'retail floor is NOT wrapped as a discount tier');
});

// ── 12. normalizeDiscountTypes: new model wins; garbage → seed; at_cost tier zeroes its percent. ─
test('12. normalize prefers discountTypes, seeds on garbage, coerces basis + percent', () => {
  ok(normalizeDiscountTypes(undefined).length >= 1, 'no config → seed (non-empty)');
  ok(normalizeDiscountTypes({}).length >= 1, 'empty config → seed');
  const bad = normalizeDiscountTypes({ discountTypes: [{ name: 'T', tiers: [{ name: 'x', basis: 'at_cost', discountPercent: 99 }, { nope: 1 }, null] }] });
  ok(bad[0].tiers.length === 1 && bad[0].tiers[0].discountPercent === 0, 'at_cost tier zeroes discountPercent; junk tiers dropped');
  const dt = normalizeDiscountTypes({ discountTypes: [{ name: 'A', tiers: [{ name: 'a', basis: 'weird', discountPercent: 150 }] }] });
  ok(dt[0].tiers[0].basis === 'retail_minus_percent' && dt[0].tiers[0].discountPercent === 100, 'unknown basis → percent; 150 clamped to 100');
});

// ══ computeOrderPricing — the single Review/submit computation (D-39 · 2026-07-10) ══════════════

const CONTRACTOR = resolveTier('contractor', normalizeDiscountTypes({
  discountTypes: [{ name: 'Contractor', tiers: [{ name: 'contractor', basis: 'retail_minus_percent', discountPercent: 10 }] }],
}));

// ── 13. THE canonical demo order: 8× goods @$128 (contractor 10%) + services at FULL price. ──────
test('13. goods discounted 10%, services NOT, tax on the discounted subtotal', () => {
  const lines: PricingLineInput[] = [
    { kind: 'goods',   name: 'Shoal Creek Vitex', unitPrice: 128, qty: 8 },
    { kind: 'service', name: 'Placement Service',  unitPrice: 225, qty: 9 },
    { kind: 'service', name: 'Delivery',           unitPrice: 50,  qty: 1 },
  ];
  const p = computeOrderPricing(lines, CONTRACTOR, 0.0825);
  const goods = p.lines[0];
  ok(goods.netUnit === 115.2, `goods net unit 115.20, got ${goods.netUnit}`);           // $128 × 0.9
  ok(goods.netTotal === 921.6, `goods net total 921.60, got ${goods.netTotal}`);        // ×8
  ok(goods.discountAmt === 102.4, `goods discount $102.40, got ${goods.discountAmt}`);   // $1024 − $921.60
  ok(goods.discountPct === 10, `goods discountPct 10, got ${goods.discountPct}`);
  // services untouched — a WRONG impl would discount them too
  ok(p.lines[1].netTotal === 2025 && p.lines[1].discountAmt === 0, 'Placement full $2025, no discount');
  ok(p.lines[2].netTotal === 50 && p.lines[2].discountAmt === 0, 'Delivery full $50, no discount');
  // discounted subtotal = 921.60 + 2025 + 50 = 2996.60; tax on THAT (not on the retail subtotal)
  ok(p.discountedSubtotal === 2996.6, `discounted subtotal 2996.60, got ${p.discountedSubtotal}`);
  const wrongTaxOnRetail = round2Local((1024 + 2075) * 0.0825);
  ok(p.tax === round2Local(2996.6 * 0.0825) && p.tax !== wrongTaxOnRetail, `tax on discounted subtotal (${p.tax}), NOT on retail`);
  ok(p.total === round2Local(2996.6 + p.tax), `total = discounted subtotal + tax, got ${p.total}`);
  ok(p.goodsRetailSubtotal === 1024 && p.discountTotal === 102.4, 'show-the-work: retail $1024, discount $102.40');
});

// ── 14. Retail floor / null tier → no discount anywhere (Review must match a retail order). ──────
test('14. retail floor leaves goods AND services at full price', () => {
  const lines: PricingLineInput[] = [
    { kind: 'goods',   name: 'Live Oak', unitPrice: 200, qty: 2 },
    { kind: 'service', name: 'Delivery', unitPrice: 50,  qty: 1 },
  ];
  const p = computeOrderPricing(lines, RETAIL_FLOOR, 0.0825);
  ok(p.discountTotal === 0, 'no discount at retail');
  ok(p.lines[0].netTotal === 400 && p.lines[0].discountPct === 0, 'goods full at retail');
  ok(p.discountedSubtotal === 450, 'subtotal 450 (unchanged)');
});

// ── 15. at_cost basis discounts GOODS to cost; degrades to retail when no cost on file (D-9). ─────
test('15. at_cost goods → cost; missing cost → retail + degraded flag; services never at cost', () => {
  const atCost = resolveTier('wholesale', normalizeDiscountTypes({
    discountTypes: [{ name: 'Wholesale', tiers: [{ name: 'wholesale', basis: 'at_cost', discountPercent: 0 }] }],
  }));
  const p = computeOrderPricing([
    { kind: 'goods',   name: 'Priced',   unitPrice: 100, qty: 1, unitCost: 40 },
    { kind: 'goods',   name: 'NoCost',   unitPrice: 100, qty: 1, unitCost: null },
    { kind: 'service', name: 'Delivery', unitPrice: 50,  qty: 1 },
  ], atCost, 0);
  ok(p.lines[0].netUnit === 40 && !p.lines[0].degraded, 'priced good → $40 (cost)');
  ok(p.lines[1].netUnit === 100 && p.lines[1].degraded, 'no-cost good → retail $100, degraded (never $0)');
  ok(p.lines[2].netTotal === 50, 'service still full $50 (at_cost is a goods basis only)');
});

// ── 16. Service owner-override (leakage) passes through as the charge; still discountAmt 0. ───────
test('16. service overrideTotal replaces the charge, is not a tier discount', () => {
  const p = computeOrderPricing([
    { kind: 'goods',   name: 'Vitex',    unitPrice: 128, qty: 1 },
    { kind: 'service', name: 'Planting', unitPrice: 225, qty: 6, overrideTotal: 1000 },
  ], CONTRACTOR, 0);
  ok(p.lines[1].netTotal === 1000 && p.lines[1].discountAmt === 0, 'override $1000 charged, discountAmt 0 (leakage ≠ discount)');
  ok(p.lines[0].netUnit === 115.2, 'goods still tier-discounted alongside the override');
  ok(p.discountedSubtotal === round2Local(115.2 + 1000), 'subtotal = discounted goods + overridden service');
});

// ══ TAX — the three honest states + taxability filter + rounding + the rate seam (D-40) ══════════

const TAXED_ORDER: PricingLineInput[] = [
  { kind: 'goods',   name: 'Live Oak', unitPrice: 128, qty: 4 },  // $512
  { kind: 'service', name: 'Delivery', unitPrice: 125, qty: 1 },  // $125
];

// ── 17. taxStatus 'taxed': tax on the taxable discounted subtotal, ONE rounding method. ──────────
test("17. rate set → 'taxed', tax = round2(taxableSubtotal × rate)", () => {
  const CON10 = resolveTier('contractor', normalizeDiscountTypes({
    discountTypes: [{ name: 'Contractor', tiers: [{ name: 'contractor', basis: 'retail_minus_percent', discountPercent: 10 }] }],
  }));
  const p = computeOrderPricing(TAXED_ORDER, CON10, 0.0825);
  // goods $512 −10% = $460.80; + delivery $125 (never discounted) → discounted subtotal $585.80
  ok(p.discountedSubtotal === 585.8, `discounted subtotal 585.80, got ${p.discountedSubtotal}`);
  ok(p.taxableSubtotal === 585.8, 'all lines taxable by default → taxableSubtotal == discountedSubtotal');
  ok(p.taxStatus === 'taxed', `taxStatus 'taxed', got ${p.taxStatus}`);
  ok(p.tax === round2Local(585.8 * 0.0825), `tax = round2(585.80 × 0.0825) = ${round2Local(585.8 * 0.0825)}, got ${p.tax}`);
  ok(p.total === round2Local(585.8 + p.tax), 'total = discounted subtotal + tax');
  ok(p.taxExemptReason == null && p.taxExemptCertRef == null, 'no exemption fields when taxed');
});

// ── 18. taxStatus 'not_identified': rate null → tax 0, NOT a fabricated rate (the redline). ───────
test("18. rate null → 'not_identified', tax 0, total == subtotal (redline, never a default)", () => {
  const p = computeOrderPricing(TAXED_ORDER, RETAIL_FLOOR, null);
  ok(p.taxStatus === 'not_identified', `taxStatus 'not_identified', got ${p.taxStatus}`);
  ok(p.tax === 0, 'tax is 0 (not a fabricated 8.25%)');
  ok(p.total === p.discountedSubtotal, 'total excludes tax when the rate is not identified');
  // a garbage rate is ALSO not identified (never silently taxed at a wrong number)
  ok(resolveTaxRate({ taxRate: 'abc' }) === null && resolveTaxRate({ taxRate: '' }) === null && resolveTaxRate({}) === null, 'resolveTaxRate: garbage/empty/absent → null');
  ok(resolveTaxRate({ taxRate: 0.0725 }) === 0.0725 && resolveTaxRate({ taxRate: 0 }) === 0, 'resolveTaxRate: a real rate (incl. 0) passes through');
});

// ── 19. taxStatus 'exempt': a VALID exemption zeros tax; NO reason → NOT exempt (audit control). ──
test("19. exempt zeros tax ONLY with a recorded reason; reasonless exempt is refused", () => {
  const RATE = 0.0825;
  const exempt: OrderTaxExemption = { exempt: true, reason: 'agricultural', certRef: 'AG-TX-88213' };
  const p = computeOrderPricing(TAXED_ORDER, RETAIL_FLOOR, RATE, exempt);
  ok(p.taxStatus === 'exempt' && p.tax === 0, 'valid exemption → exempt, tax 0');
  ok(p.total === p.discountedSubtotal, 'exempt total excludes tax');
  ok(p.taxExemptReason === 'agricultural' && p.taxExemptCertRef === 'AG-TX-88213', 'exemption reason + cert carried');
  // no reason → the pure fn REFUSES to remove tax (no silent removal) → falls back to taxed
  const noReason = computeOrderPricing(TAXED_ORDER, RETAIL_FLOOR, RATE, { exempt: true, reason: '  ' });
  ok(noReason.taxStatus === 'taxed' && noReason.tax > 0, 'exempt WITHOUT a reason is NOT honored — tax still charged');
  // exempt beats an unset rate too (exempt is a definite $0, not the redline)
  const exemptNoRate = computeOrderPricing(TAXED_ORDER, RETAIL_FLOOR, null, exempt);
  ok(exemptNoRate.taxStatus === 'exempt', 'a valid exemption wins even when the rate is unset');
});

// ── 20. taxability filter: a non-taxable line is excluded from the taxable subtotal. ─────────────
test('20. taxable:false line drops out of the taxable subtotal (D-40 seam), goods default taxable', () => {
  const p = computeOrderPricing([
    { kind: 'goods',   name: 'Oak',      unitPrice: 100, qty: 1 },                    // taxable (default)
    { kind: 'service', name: 'Labor',    unitPrice: 200, qty: 1, taxable: false },    // opted out (jurisdiction)
  ], RETAIL_FLOOR, 0.10);
  ok(p.discountedSubtotal === 300, 'subtotal includes both lines ($300)');
  ok(p.taxableSubtotal === 100, 'only the taxable goods line is in the taxable subtotal ($100)');
  ok(p.tax === 10, 'tax = $100 × 10% = $10 (labor excluded), NOT $30');
  // default (undefined) keeps a line taxable — money-safety: no silent shift from today's behavior
  const allTaxable = computeOrderPricing([{ kind: 'service', name: 'S', unitPrice: 100, qty: 1 }], RETAIL_FLOOR, 0.10);
  ok(allTaxable.taxableSubtotal === 100 && allTaxable.tax === 10, 'a service with no taxable flag is taxable by default');
});

// ── 21. describeTaxLine: the SINGLE three-state presenter every surface renders from. ────────────
test('21. describeTaxLine wording — redline / taxed % / exempt reason+cert', () => {
  const ni = describeTaxLine({ taxStatus: 'not_identified', tax: 0 });
  ok(ni.redline && ni.amount === null && /not identified/i.test(ni.label), 'not_identified → redline, no amount, "not identified"');
  const tx = describeTaxLine({ taxStatus: 'taxed', tax: 48.33, taxRate: 0.0825 });
  ok(!tx.redline && tx.label === 'Tax (8.25%)' && tx.amount === '$48.33', 'taxed → "Tax (8.25%)" + amount');
  const ex = describeTaxLine({ taxStatus: 'exempt', tax: 0, reason: 'agricultural', certRef: 'AG-TX-88213' });
  ok(ex.label === 'Tax exempt — Agricultural exemption · cert AG-TX-88213' && ex.amount === '$0.00', 'exempt → reason label + cert + $0.00');
  ok(taxExemptionLabel('resale') === 'Resale / reseller certificate', 'known code → label');
  ok(taxExemptionLabel('special ag co-op') === 'special ag co-op', "'other' free text → text as-is");
});

function round2Local(n: number): number { return Math.round(n * 100) / 100; }

// ── run ────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => ' - ' + f).join('\n')); process.exit(1); }
