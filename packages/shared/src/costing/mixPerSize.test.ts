/**
 * ── mixPerSize — what the planting mix costs at every container size (ledger #370) ──
 *
 * 🔴 THIS IS [[R-155]]'s OUTSTANDING HALF, and its status cell is the reason these exist:
 * *"2.0 IS IMPLEMENTED FOR LOADING AND LIVE; NO MODEL APPLIES IT TO COST YET, AND NONE EVER HAS."*
 * The rungs below are LAWNS's own ladder. The per-gallon figure is what `recipeCost` derives from
 * the real Special Planting Mix receipts: $0.1960.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/costing/mixPerSize.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { mixCostPerSize } from './mixPerSize';
import type { Rung } from '../inventory/containerLadder';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const rung = (label: string, volumeGallons: number | null, sortOrder: number, active = true): Rung => ({
  label, aliases: [], sortOrder, volumeGallons,
  handlingMinutes: null, handlingBecause: 'not timed',
  installTPostsPerTree: 0, installTPostsBecause: 'not set',
  caliperMinInches: null, caliperMaxInches: null, caliperBecause: 'not recorded',
  active,
});

/** LAWNS's ladder, plus a slip (no volume) and a retired rung. */
const LADDER: Rung[] = [
  rung('slip', null, 1),
  rung('15 gal', 15, 2),
  rung('30 gal', 30, 3),
  rung('45 gal', 45, 4),
  rung('95 gal', 95, 5),
  rung('200 gal', 200, 6),
  rung('7 gal', 7, 7, false),
];

const PER_GALLON = 0.1960;   // recipeCost's figure for the real SPM

// ══ §A THE ARITHMETIC — RUNG VOLUME × RATIO × COST PER GALLON ═════════════════════════════════
{
  const rows = mixCostPerSize({ ladder: LADDER, mixContainerVolumesPerTree: 2, costPerGallon: PER_GALLON, recipeIncomplete: false });

  const thirty = rows.find(r => r.label === '30 gal')!;
  ok(thirty.mixGallons === 60,
    `🔴 A1: a 30 gallon tree takes 60 gallons of mix at the ratio of 2.0 (R-155) (got ${thirty.mixGallons})`);
  ok(thirty.cost === 11.76,
    `🔴 A2: 60 gallons at $0.1960 is $11.76 — the first time a mix RATIO has ever been multiplied by a PRICE (got ${thirty.cost})`);

  const twoHundred = rows.find(r => r.label === '200 gal')!;
  ok(twoHundred.mixGallons === 400 && twoHundred.cost === 78.4,
    `🔴 A3: the 200 gallon is computed like every other rung — 400 gallons, $78.40. No threshold, no lookup table, no upper bound (got ${twoHundred.mixGallons}/${twoHundred.cost})`);

  ok(rows.length === LADDER.length,
    `A4: EVERY rung gets a row — a report of what each size costs that omits sizes is worse than one that marks them (got ${rows.length})`);
  ok(rows.map(r => r.label).join(',') === 'slip,15 gal,30 gal,45 gal,95 gal,200 gal,7 gal',
    'A5: the ladder\'s own order is kept — never re-sorted by volume (R-157: sortOrder is the ONLY ordering)');

  // 🔴 A NEW RUNG APPEARS WITH NO CODE CHANGE. This is the clause David named: "a new rung appears
  // automatically." Terry starts running 7 gallon → it is a row in Settings → it is a row here.
  const withNew = mixCostPerSize({
    ladder: [...LADDER, rung('25 gal', 25, 8)],
    mixContainerVolumesPerTree: 2, costPerGallon: PER_GALLON, recipeIncomplete: false });
  const added = withNew.find(r => r.label === '25 gal')!;
  ok(added != null && added.cost === 9.8,
    `🔴 A6: a rung added in Settings is costed on the next render — no migration, no backfill, nobody remembering a list (got ${added?.cost})`);
}

// ══ §B WHAT IT REFUSES — AND IT NEVER REFUSES WITH A ZERO ═════════════════════════════════════
{
  const rows = mixCostPerSize({ ladder: LADDER, mixContainerVolumesPerTree: 2, costPerGallon: PER_GALLON, recipeIncomplete: false });

  const slip = rows.find(r => r.label === 'slip')!;
  ok(slip.cost === null && slip.mixGallons === null && /No volume recorded for slip/.test(slip.refusal ?? ''),
    '🔴 B1: a rung with no volume is NAMED, not costed at $0.00 — a slip is a rooted cutting and 0 would read as a measurement (A9)');

  const noPrice = mixCostPerSize({ ladder: LADDER, mixContainerVolumesPerTree: 2, costPerGallon: null, recipeIncomplete: true });
  const thirty = noPrice.find(r => r.label === '30 gal')!;
  ok(thirty.cost === null && thirty.mixGallons === 60,
    '🔴 B2: with no per-gallon figure the GALLONS are still shown — the half we know is not thrown away with the half we do not');
  ok(/60 gallons of mix, but the recipe has no cost per gallon yet/.test(thirty.refusal ?? ''),
    `B3: …and the sentence says exactly which half is missing (got "${thirty.refusal}")`);

  const noRatio = mixCostPerSize({ ladder: LADDER, mixContainerVolumesPerTree: 0, costPerGallon: PER_GALLON, recipeIncomplete: false });
  ok(noRatio[1].cost === null && /Settings → Operations has no mix ratio/.test(noRatio[1].refusal ?? ''),
    '🔴 B4: a missing ratio names the SETTING to fix, rather than silently costing every tree at nothing');
}

// ══ §C AN INCOMPLETE RECIPE TRAVELS DOWN TO EVERY SIZE ════════════════════════════════════════
{
  const partial = mixCostPerSize({ ladder: LADDER, mixContainerVolumesPerTree: 2, costPerGallon: PER_GALLON, recipeIncomplete: true });
  const thirty = partial.find(r => r.label === '30 gal')!;
  ok(thirty.cost === 11.76 && thirty.partial === true,
    '🔴 C1: a cost built on an incomplete recipe is SHOWN and marked partial — the caveat travels DOWN, it does not stop at the recipe screen');

  const whole = mixCostPerSize({ ladder: LADDER, mixContainerVolumesPerTree: 2, costPerGallon: PER_GALLON, recipeIncomplete: false });
  ok(whole.find(r => r.label === '30 gal')!.partial === false,
    'C2: …and a complete one is NOT marked, or the mark means nothing');
}

// ══ §D RETIRED RUNGS ARE MARKED, NEVER DROPPED (R-133) ════════════════════════════════════════
{
  const rows = mixCostPerSize({ ladder: LADDER, mixContainerVolumesPerTree: 2, costPerGallon: PER_GALLON, recipeIncomplete: false });
  const retired = rows.find(r => r.label === '7 gal')!;
  ok(retired != null && retired.active === false && retired.cost === 2.74,
    `🔴 D1: a RETIRED rung still resolves and is still costed, marked inactive — history must keep working (got active=${retired?.active}, cost=${retired?.cost})`);
  // ✏️ SIX, NOT FIVE. A first draft said five — I had counted the SLIP as inactive because it has
  // no volume. It is a live rung a grower sells; having no volume and being retired are two
  // different facts, which is exactly the distinction B1 exists to keep.
  ok(rows.filter(r => r.active).length === 6,
    `D2: …and the caller can tell the two apart — six live rungs of seven, the slip among them (got ${rows.filter(r => r.active).length})`);
}

console.log(`\nmixPerSize: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
