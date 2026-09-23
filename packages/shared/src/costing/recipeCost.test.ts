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
import { approx, convertQuantity, costRecipeBatch, suggestedPrice, type RecipeComponentInput } from './recipeCost';
import { GALLONS_PER_CUBIC_YARD } from '../production/productionConfig';

/** LAWNS's figures as Settings → Operations holds them today. */
const OPS = { mixShrinkPct: 0, mixerCubicYardsPerHour: 4, peopleMakingMix: 1, trueGallonsPerCubicYard: GALLONS_PER_CUBIC_YARD };

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
  // 🔴 A5 COULD NOT FAIL UNTIL 2026-09-22, AND THE COMMENT STAYS SO NOBODY RESTORES IT.
  // It read `Math.abs(gal.factor - 1 / 201.974025974) < 1e-9` — the SAME hardcoded literal the code
  // used, so it asserted the code equalled itself and would have passed on any drift from the
  // platform's figure. It now compares against `GALLONS_PER_CUBIC_YARD` imported from
  // `productionConfig`, which is the only value that can disagree.
  const gal = convertQuantity('gal', 'yd');
  ok(gal.ok && gal.factor === 1 / GALLONS_PER_CUBIC_YARD,
    '🔴 A5: gallons to cubic yards uses the PLATFORM constant exactly — not a copy, not a truncation');
  ok(GALLONS_PER_CUBIC_YARD === 46656 / 231 && GALLONS_PER_CUBIC_YARD !== 201.974025974,
    '🔴 A5b: …and the truncated literal this module used to carry is NOT equal to it — 201.974025974 vs 201.97402597402597735');
  const override = convertQuantity('gal', 'yd', 200);
  ok(override.ok && override.factor === 1 / 200,
    '🔴 A5c: a tenant that overrides trueGallonsPerCubicYard is HONOURED — a hardcoded literal could not read an override at all');
}

// ══ §B THE REAL RECIPE — INCOMPLETE, AND SAYING SO ════════════════════════════════════════════
{
  const r = costRecipeBatch({ measuredBuildMinutes: 38, ops: OPS, components: SPM });

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
  const equal = costRecipeBatch({ ops: OPS, components: SPM, spread: 'equal_per_item' });
  const value = costRecipeBatch({ ops: OPS, components: SPM, spread: 'pro_rata_by_value' });
  ok(equal.materials !== value.materials,
    `🔴 C1: the two spreads give DIFFERENT materials totals — that is why both are shown (${equal.materials} vs ${value.materials})`);
  ok(equal.materialsOtherSpread === value.materials && value.materialsOtherSpread === equal.materials,
    '🔴 C2: each result carries the other spread\'s total, so a screen never has to recompute one');
}

// ══ §D WHAT IT REFUSES ════════════════════════════════════════════════════════════════════════
{
  const noPack = costRecipeBatch({ ops: OPS, components: [
    { name: 'Hose', quantity: 10, unit: 'in', purchase: { landedPackCostEqualPerItem: 88, landedPackCostProRataByValue: 88, packSize: null, packUnit: 'ft' } },
  ] });
  ok(noPack.components[0].cost === null && /how much is in a pack/.test(noPack.components[0].refusal ?? ''),
    '🔴 D1: a purchase with no pack size cannot give a price per inch — refused by name');

  const roll = costRecipeBatch({ measuredBuildMinutes: 240, ops: OPS, components: [
    { name: 'Hose', quantity: 10, unit: 'in', purchase: { landedPackCostEqualPerItem: 88, landedPackCostProRataByValue: 88, packSize: 250, packUnit: 'ft' } },
  ] });
  ok(roll.components[0].unitCost === 0.03 && roll.components[0].cost === 0.29,
    `🔴 D2: 10 inches off a 250 ft roll at $88 is $0.29, not $880 — the factor-of-fifty trap, closed (got ${roll.components[0].cost})`);

  const wrongUnit = costRecipeBatch({ ops: OPS, components: [
    { name: 'Bark', quantity: 2, unit: 'yd', purchase: { landedPackCostEqualPerItem: 50, landedPackCostProRataByValue: 50, packSize: 50, packUnit: 'lb' } },
  ] });
  ok(wrongUnit.components[0].cost === null && /different things/.test(wrongUnit.components[0].refusal ?? ''),
    '🔴 D3: a yard of bark against a 50 lb bag is refused — nothing invents a density');

  const nothing = costRecipeBatch({ ops: OPS, components: [
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


// ══ §F THE BATCH SIZE IS DERIVED, AND SHRINK IS ONE KEY (David, 2026-09-22) ═══════════════════
{
  const r = costRecipeBatch({ components: SPM, ops: OPS });
  ok(r.looseVolumeCubicYards === 2.5,
    `🔴 F1: 2 yd bark + 0.5 yd compost = 2.5 LOOSE yards, derived — nobody types it (got ${r.looseVolumeCubicYards})`);
  ok(r.volumeComponents.join(',') === 'Shook Out Brown,Compost',
    `🔴 F2: only the VOLUME ingredients count toward the batch size (got ${r.volumeComponents.join(',')})`);
  ok(r.weightComponents.length === 5 && r.weightComponents.includes('Osmocote 21-4-8'),
    `🔴 F3: the five WEIGHT ingredients add cost and NO volume — 31 lb of fertiliser is real money and no extra yards (got ${r.weightComponents.length})`);
  ok(r.yieldCubicYards === 2.5 && !r.yieldMeasured,
    `F4: at LAWNS's shrink of 0 the settled yield equals the loose volume (got ${r.yieldCubicYards})`);
  // ✏️ 2.5 is exactly the figure a person used to TYPE into this recipe. The derivation reproduces
  // it, which is the check worth having: the model was not changed to produce a new answer.
  ok(r.costPerYieldUnit === 39.58,
    `F5: $98.96 over 2.5 derived yards is $39.58 a yard — the same figure the typed version gave (got ${r.costPerYieldUnit})`);

  const settled = costRecipeBatch({ components: SPM, ops: { ...OPS, mixShrinkPct: 0.1 } });
  ok(settled.looseVolumeCubicYards === 2.5 && settled.yieldCubicYards === 2.25,
    `🔴 F6: shrink converts LOOSE to SETTLED — 2.5 loose × (1 − 0.10) = 2.25 settled (got ${settled.yieldCubicYards})`);
  ok(settled.costPerYieldUnit === 43.98,
    `🔴 F7: …so the same materials over fewer yards cost MORE a yard — $43.98, not $39.58 (got ${settled.costPerYieldUnit})`);
  ok(/less 10% settling/.test(settled.yieldNote) && /approximate/.test(settled.yieldNote),
    `F8: the sentence says where the figure came from AND that it is approximate (got "${settled.yieldNote}")`);

  // 🔴 A MEASUREMENT REPLACES A DERIVATION — it is not averaged with it, not shown as a correction.
  const actual = costRecipeBatch({ components: SPM, ops: OPS, actualYieldCubicYards: 2.2, actualYieldBecause: 'Lauren measured the pile' });
  ok(actual.yieldCubicYards === 2.2 && actual.yieldMeasured,
    `🔴 F9: an ACTUAL yield typed after a real batch REPLACES the estimate (got ${actual.yieldCubicYards})`);
  ok(/measured after a real batch/.test(actual.yieldNote) && /Lauren measured the pile/.test(actual.yieldNote),
    'F10: …and says so, with where it came from');
  ok(actual.looseVolumeCubicYards === 2.5,
    'F11: the derived loose volume is still reported beside it — the measurement replaces the YIELD, not the working');

  const kit = costRecipeBatch({ ops: OPS, components: [
    { name: 'PVC 1 inch', quantity: 24, unit: 'in', purchase: null },
    { name: 'Bamboo stake', quantity: 1, unit: 'each', purchase: null }] });
  ok(kit.looseVolumeCubicYards === null && kit.yieldCubicYards === null,
    '🔴 F12: a water monitor kit has NO volume ingredient, so no batch size is invented — it is refused');
  ok(/type what one batch actually made/.test(kit.yieldNote),
    'F13: …and the sentence says what to do about it rather than showing a blank');
}

// ══ §G LABOUR MINUTES COME FROM THE MIXER, MONEY FROM THE LABOUR TABLE ════════════════════════
{
  const r = costRecipeBatch({ components: SPM, ops: OPS });
  ok(r.buildMinutes === 37.5 && !r.buildMinutesMeasured,
    `🔴 G1: 2.5 loose yards at 4 yd³/hr is 37.5 minutes, DERIVED — not typed (got ${r.buildMinutes})`);
  // ✏️ The typed figure in the original fixture was 38. The mixer's own output gives 37.5.
  ok(/4 yd³\/hr/.test(r.labourNote) && /no rates entered/.test(r.labourNote),
    `G2: the note shows its working and still says labour is not costed — the table ships empty (got "${r.labourNote}")`);

  const twoPeople = costRecipeBatch({ components: SPM, ops: { ...OPS, peopleMakingMix: 2 } });
  ok(twoPeople.buildMinutes === 75,
    `🔴 G3: two people at the mixer is 75 person-minutes, not 37.5 — their minutes both count (got ${twoPeople.buildMinutes})`);
  ok(/2 people/.test(twoPeople.labourNote), 'G3b: …and the note says so');

  const paid = costRecipeBatch({ components: SPM, ops: OPS, labourRates: [{ who: 'Yard crew', hourlyRate: 20 }] });
  ok(paid.labour === 12.5,
    `🔴 G4: 37.5 minutes at $20 an hour is $12.50 — minutes from the mixer, rate from the labour table (got ${paid.labour})`);
  ok(!paid.missing.includes('labour'), 'G4b: …and with a rate entered, labour stops being a gap');

  const timed = costRecipeBatch({ components: SPM, ops: OPS, measuredBuildMinutes: 52, measuredBuildBecause: 'Joel timed it' });
  ok(timed.buildMinutes === 52 && timed.buildMinutesMeasured && /Joel timed it/.test(timed.labourNote),
    `🔴 G5: a TIMED build replaces the derived minutes, same rule as the actual yield (got ${timed.buildMinutes})`);

  const noMixer = costRecipeBatch({ components: SPM, ops: { ...OPS, mixerCubicYardsPerHour: 0 } });
  ok(noMixer.buildMinutes === null && /no mixer output/.test(noMixer.labourNote),
    '🔴 G6: no mixer output in Settings gives NO minutes and names the setting — never 0 minutes, which would read as instant');
}

// ══ §H PER GALLON, AND THE APPROXIMATION ══════════════════════════════════════════════════════
{
  const r = costRecipeBatch({ components: SPM, ops: OPS });
  ok(r.costPerGallon === 0.1960,
    `🔴 H1: $39.58 a yard ÷ ${GALLONS_PER_CUBIC_YARD.toFixed(6)} gallons is $0.1960 a gallon (got ${r.costPerGallon})`);
  ok(r.costPerGallon !== null && Math.abs(r.costPerGallon - r.costPerYieldUnit! / GALLONS_PER_CUBIC_YARD) < 0.0001,
    'H2: …and it is the per-yard figure divided by the PLATFORM constant, not a second conversion');

  const tenant = costRecipeBatch({ components: SPM, ops: { ...OPS, trueGallonsPerCubicYard: 200 } });
  ok(tenant.costPerGallon === 0.1979,
    `🔴 H3: a tenant that overrides gallons-per-cubic-yard gets ITS figure — $39.58 ÷ 200 (got ${tenant.costPerGallon})`);

  // 🔴 FOUR DECIMALS ON THE GALLON, ONE ON THE YARD, AND BOTH ARE DELIBERATE. A gallon of mix is
  // cents: rounding it to $0.20 loses a fifth of it. A YARD is a tractor bucket, so it is shown
  // rounded — David, 2026-09-22: "this is approx, not exact science or math."
  ok(approx(2.4750000000000001) === '2.5', 'H4: a volume prints as a bucket figure — 2.5, not 2.4750000000000001');
  ok(approx(2.25) === '2.3' || approx(2.25) === '2.2', 'H4b: …to one decimal, whichever way the half rounds');
}


// ══ §I A TYPED PRICE IS ALLOWED, FLAGGED, AND NEVER ZERO (David, 2026-09-22) ══════════════════
{
  const typed = costRecipeBatch({ ops: OPS, components: [
    { name: 'Shook Out Brown', quantity: 2, unit: 'yd',
      purchase: { landedPackCostEqualPerItem: 30.88, landedPackCostProRataByValue: 30.88, packSize: 1, packUnit: 'yd' } },
    { name: 'MicroMax', quantity: 2, unit: 'lb', purchase: {
      landedPackCostEqualPerItem: 60, landedPackCostProRataByValue: 60, packSize: 50, packUnit: 'lb', source: 'typed' } },
  ] });
  const micro = typed.components.find(c => c.name === 'MicroMax')!;
  ok(micro.cost === 2.4,
    `🔴 I1: a TYPED price costs the component — 2 lb off a $60 50 lb bag is $2.40, not nothing (got ${micro.cost})`);
  ok(micro.priceSource === 'typed' && /no receipt/.test(micro.priceFlag ?? ''),
    `🔴 I2: …and it is FLAGGED "no receipt", so a reader can see which figures were typed (got ${micro.priceFlag})`);
  ok(!typed.missing.includes('MicroMax'),
    'I3: a typed price is NOT a gap — it has a cost, which is the whole point of allowing it');
  ok(typed.typedPrices.length === 1 && /Capture the invoice/.test(typed.typedPricesNote),
    `🔴 I4: the batch names every typed price in one sentence, so the caveat travels UP with the figure (got "${typed.typedPricesNote}")`);

  const bark = typed.components.find(c => c.name === 'Shook Out Brown')!;
  ok(bark.priceSource === 'receipt' && bark.priceFlag === null,
    'I5: a receipt-backed price carries NO flag — otherwise the flag means nothing');

  const none = costRecipeBatch({ ops: OPS, components: [{ name: 'MicroMax', quantity: 2, unit: 'lb', purchase: null }] });
  ok(none.components[0].cost === null && none.components[0].priceSource === null,
    '🔴 I6: no purchase AND no typed price is still NO cost — "never zero" does not mean "invent one"');
}

console.log(`\nrecipeCost: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
