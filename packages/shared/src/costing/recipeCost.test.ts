/**
 * ── recipeCost — what a batch costs, and what it will not pretend to know (ledger #370) ──
 *
 * 🔴 THE FIXTURE IS LAWNS'S OWN SPECIAL PLANTING MIX, with the landed figures this repo measured on
 * 2026-09-21 from the real receipts: Osmocote at $69.28 a 50 lb bag equal-per-item ($70.04 by value),
 * Ferrous Sulfate $29.45 ($28.09), 19-5-9 $27.52 ($26.11), Shook Out Brown $30.88 a yard. MicroMax
 * and 12-24-12 are on NO captured receipt, and compost has none matched yet — so the first real
 * recipe is incomplete, and these assert that it SAYS so.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/costing/recipeCost.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { convertQuantity, costRecipeBatch, suggestedPrice, type RecipeComponentInput } from './recipeCost';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const bag = (equal: number, value: number, size: number, unit: string, vendor = 'bwi') => ({
  landedPackCostEqualPerItem: equal, landedPackCostProRataByValue: value,
  packSize: size, packUnit: unit, vendor, purchasedOn: '2026-09-02',
  documentKey: `${vendor}|2026-09-02|647.79`,
});

/** The recipe David gave, one batch, yielding 2.5 yd. */
const SPM: RecipeComponentInput[] = [
  { name: 'Shook Out Brown', quantity: 2, unit: 'yd',
    purchase: { landedPackCostEqualPerItem: 30.88, landedPackCostProRataByValue: 30.88, packSize: 1, packUnit: 'yd', vendor: 'Bailey Bark Materials, Inc.', purchasedOn: '2026-07-07' } },
  { name: 'Compost', quantity: 0.5, unit: 'yd', purchase: null },
  { name: 'Osmocote 21-4-8', quantity: 25, unit: 'lb', purchase: bag(69.28, 70.04, 50, 'lb') },
  { name: 'MicroMax', quantity: 2, unit: 'lb', purchase: null },
  { name: 'Ferrous Sulfate', quantity: 2, unit: 'lb', purchase: bag(29.45, 28.09, 50, 'lb') },
  { name: '19-5-9', quantity: 2, unit: 'lb', purchase: bag(27.52, 26.11, 40, 'lb') },
  { name: '12-24-12', quantity: 2, unit: 'lb', purchase: null },
];

// ══ §A THE CONVERSION — THE FACTOR-OF-FIFTY TRAP ══════════════════════════════════════════════
{
  const inch = convertQuantity('in', 'ft');
  ok(inch.ok && Math.abs(inch.factor - 1 / 12) < 1e-9, '🔴 A1: inches convert to feet — the bubbler\'s hose, bought by the roll and used in inches');
  const lb = convertQuantity('lb', 'lb');
  ok(lb.ok && lb.factor === 1, 'A2: the same unit converts to itself');
  const cross = convertQuantity('lb', 'yd');
  ok(!cross.ok && cross.reason === 'different_families',
    '🔴 A3: pounds do NOT become yards — different things, refused rather than multiplied by something');
  ok(!cross.ok && /measure different things/.test(cross.detail), 'A3b: …and the refusal says so in words a person reads');
  const bogus = convertQuantity('sploops', 'lb');
  ok(!bogus.ok && bogus.reason === 'unknown_unit', 'A4: a unit nobody knows is refused, never assumed to be 1');
  const gal = convertQuantity('gal', 'yd');
  ok(gal.ok && Math.abs(gal.factor - 1 / 201.974025974) < 1e-9,
    'A5: gallons to cubic yards uses the platform\'s one conversion, not a rounded 202');
}

// ══ §B THE REAL RECIPE — INCOMPLETE, AND SAYING SO ════════════════════════════════════════════
{
  const r = costRecipeBatch({ yieldQuantity: 2.5, yieldUnit: 'yd', buildMinutes: 38, components: SPM });

  const osmo = r.components.find(c => c.name === 'Osmocote 21-4-8')!;
  ok(osmo.unitCost === 1.39 && osmo.cost === 34.64,
    `🔴 B1: 25 lb of Osmocote off a $69.28 bag of 50 lb costs $34.64 (got ${osmo.unitCost}/${osmo.cost})`);
  ok(osmo.costOtherSpread === 35.02, `B1b: …and $35.02 on the other spread, always in hand (got ${osmo.costOtherSpread})`);
  const bark = r.components.find(c => c.name === 'Shook Out Brown')!;
  ok(bark.cost === 61.76, `🔴 B2: 2 yd of bark at the LANDED $30.88 is $61.76 — at the line price it would be $27.50 (got ${bark.cost})`);
  const nine = r.components.find(c => c.name === '19-5-9')!;
  ok(nine.unitCost === 0.69 && nine.cost === 1.38, `B3: a 40 lb bag divides by 40, not by 50 (got ${nine.unitCost}/${nine.cost})`);

  for (const name of ['Compost', 'MicroMax', '12-24-12']) {
    const c = r.components.find(x => x.name === name)!;
    ok(c.cost === null && /no purchase we hold/.test(c.refusal ?? ''),
      `🔴 B4 (${name}): a component on no purchase has NO cost and says why — never a silent 0`);
  }

  // 61.76 bark + 34.64 Osmocote + 1.18 Ferrous (29.45 ÷ 50 × 2) + 1.38 of 19-5-9 (27.52 ÷ 40 × 2).
  ok(r.materials === 98.96, `B5: the materials that CAN be costed come to $98.96 (got ${r.materials})`);
  ok(r.labour === null && /no rates entered/.test(r.labourNote) && /38 minutes/.test(r.labourNote),
    '🔴 B6: labour is 38 MINUTES and no money — the labour table ships empty (David, 2026-09-21)');
  ok(r.incomplete && r.missing.length === 4 && r.missing.includes('labour') && r.missing.includes('12-24-12'),
    `🔴 B7: the batch is INCOMPLETE and names all four gaps, labour among them (got ${JSON.stringify(r.missing)})`);
  ok(/incomplete/.test(r.incompleteNote) && /only what we could cost/.test(r.incompleteNote),
    '🔴 B8: …in one sentence a screen prints — "a partial total presented as a total is the thing that gets someone fired"');
  ok(r.batchTotal === 98.96 && r.costPerYieldUnit === 39.58,
    `B9: the batch total is what was costed, and a yard of mix is $39.58 SO FAR — with three components and the labour still missing (got ${r.batchTotal}/${r.costPerYieldUnit})`);
}

// ══ §C BOTH SPREADS REACH THE PER-YARD FIGURE ═════════════════════════════════════════════════
{
  const equal = costRecipeBatch({ yieldQuantity: 2.5, yieldUnit: 'yd', components: SPM, spread: 'equal_per_item' });
  const value = costRecipeBatch({ yieldQuantity: 2.5, yieldUnit: 'yd', components: SPM, spread: 'pro_rata_by_value' });
  ok(equal.materials !== value.materials,
    `🔴 C1: the two spreads give DIFFERENT materials totals — that is why both are shown (${equal.materials} vs ${value.materials})`);
  ok(equal.materialsOtherSpread === value.materials && value.materialsOtherSpread === equal.materials,
    '🔴 C2: each result carries the other spread\'s total, so a screen never has to recompute one');
}

// ══ §D WHAT IT REFUSES ════════════════════════════════════════════════════════════════════════
{
  const noPack = costRecipeBatch({ yieldQuantity: 1, yieldUnit: 'each', components: [
    { name: 'Hose', quantity: 10, unit: 'in', purchase: { landedPackCostEqualPerItem: 88, landedPackCostProRataByValue: 88, packSize: null, packUnit: 'ft' } },
  ] });
  ok(noPack.components[0].cost === null && /how much is in a pack/.test(noPack.components[0].refusal ?? ''),
    '🔴 D1: a purchase with no pack size cannot give a price per inch — refused by name');

  const roll = costRecipeBatch({ yieldQuantity: 100, yieldUnit: 'each', buildMinutes: 240, components: [
    { name: 'Hose', quantity: 10, unit: 'in', purchase: { landedPackCostEqualPerItem: 88, landedPackCostProRataByValue: 88, packSize: 250, packUnit: 'ft' } },
  ] });
  ok(roll.components[0].unitCost === 0.03 && roll.components[0].cost === 0.29,
    `🔴 D2: 10 inches off a 250 ft roll at $88 is $0.29, not $880 — the factor-of-fifty trap, closed (got ${roll.components[0].cost})`);

  const wrongUnit = costRecipeBatch({ yieldQuantity: 1, yieldUnit: 'each', components: [
    { name: 'Bark', quantity: 2, unit: 'yd', purchase: { landedPackCostEqualPerItem: 50, landedPackCostProRataByValue: 50, packSize: 50, packUnit: 'lb' } },
  ] });
  ok(wrongUnit.components[0].cost === null && /different things/.test(wrongUnit.components[0].refusal ?? ''),
    '🔴 D3: a yard of bark against a 50 lb bag is refused — nothing invents a density');

  const nothing = costRecipeBatch({ yieldQuantity: 2.5, yieldUnit: 'yd', components: [
    { name: 'MicroMax', quantity: 2, unit: 'lb', purchase: null }] });
  ok(nothing.batchTotal === null && nothing.costPerYieldUnit === null && nothing.incomplete,
    '🔴 D4: a recipe nothing can be costed on returns NO total — not 0, which would read as free');
}

// ══ §E THE SUGGESTION, NEVER AN APPLIED PRICE ═════════════════════════════════════════════════
{
  const s = suggestedPrice(51.96, 40);
  ok(s.price === 72.74, `🔴 E1: 40% MARKUP on $51.96 is $72.74 — cost × 1.40, not cost ÷ 0.60 (got ${s.price})`);
  ok(/a suggestion, not a price/.test(s.how) && /You set the price/.test(s.how),
    '🔴 E2: …and it says whose decision the price is');
  ok(suggestedPrice(null).price === null, 'E3: no cost, no suggestion — it does not suggest a price for a number it does not have');
}

console.log(`\nrecipeCost: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
