/**
 * ── measure-production-plan-mutants — can the plan go back to lying quietly? ───────────
 *
 * PURPOSE:      Every mutant here restores a version of the planning model that LOOKS COMPLETELY
 *               NORMAL and is wrong. No error, no red, no empty screen — a number is simply
 *               different, and every number on this surface is one nobody can check by eye. That
 *               is the whole reason this file exists rather than a careful read.
 *
 * 🔴 THE PROBES IN `productionPlan.test.ts` WENT RED FIRST — 3 of 150 failed on the first run and
 * two of those were a real code defect (the crew test asked whether the seasonal staff leave
 * BEFORE the window opens, the opposite of the rule). But red-first proves the probe can fail on
 * the defect it was WATCHING FOR; it does not prove it can fail on the defects it was not. That is
 * what these are.
 *
 * 🔴 THE SHARPEST MUTANTS HERE ARE P1 AND P4, and both restore something that was genuinely
 * proposed: P1 puts the flat 3-minutes-a-pot rate back (the figure David gave first, before the
 * setup decomposition), and P4 restores the workbook's own still-sellable formula, which is
 * correct in the workbook and wrong the moment a real order exists.
 *
 * ⚠️ THIS MODULE HAS NO OTHER GUARD. `verify-ui-standard-divergence.mjs` scans
 * `packages/cultivar-os/src` and every file mutated here is in `packages/shared` (tech-debt #187,
 * filed 2026-09-04, is exactly this blind spot). These mutants and the owner-test cards are it.
 *
 * 🔴 GREEN CONTROL FIRST, EXIT CODE ONLY, AND A MUTANT THAT NEVER APPLIED IS AN ERROR — not a
 * pass. `#275`'s G10 found a NUL byte in a source file that way, so the rule has paid for itself.
 *
 * Run: node scripts/measure-production-plan-mutants.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ROOT  = new URL('..', import.meta.url).pathname;
const SUITE = 'packages/shared/src/production/productionPlan.test.ts';
const ESB   = ROOT + 'node_modules/.bin/esbuild';

const FILES = {
  math:   ROOT + 'packages/shared/src/production/productionMath.ts',
  config: ROOT + 'packages/shared/src/production/productionConfig.ts',
  hold:   ROOT + 'packages/shared/src/production/productionHold.ts',
  flags:  ROOT + 'packages/shared/src/production/productionFlags.ts',
  basis:  ROOT + 'packages/shared/src/production/basis.ts',
};

function suiteIsGreen() {
  try {
    execSync(`${ESB} ${SUITE} --bundle --platform=node --format=cjs 2>/dev/null | node`,
      { cwd: ROOT, stdio: 'pipe', shell: '/bin/bash' });
    return true;
  } catch { return false; }
}

const MUTANTS = [
  // ── LABOUR: the lever disappears ────────────────────────────────────────────────────
  { id: 'P1', file: 'math',
    why: '🔴 THE FLAT PER-POT RATE RESTORED — setup vanishes, every batch size costs the same, and the ONE lever the manager controls becomes invisible. This is the model David had before he decomposed it.',
    from: '  return ops.setupMinutesPerRun + pots * ops.handlingMinutesPerPot;',
    to:   '  return pots * ops.handlingMinutesPerPot;' },
  { id: 'P2', file: 'math',
    why: 'splitting a run becomes free — 20 + 20 costs the same as 40, so the schedule can silently fragment the work at no apparent cost',
    from: '  return { extraRuns, extraMinutes: extraRuns * ops.setupMinutesPerRun };',
    to:   '  return { extraRuns, extraMinutes: 0 };' },
  { id: 'P3', file: 'math',
    why: 'runs are counted by flooring — 41 pots at batches of 40 is charged as ONE setup, so every partial run is free',
    from: '  const runs = Math.ceil(pots / batch);',
    to:   '  const runs = Math.max(1, Math.floor(pots / batch));' },

  // ── THE SPLIT: the two workbook defects, restored ───────────────────────────────────
  { id: 'P4', file: 'math',
    why: "🔴 THE WORKBOOK'S OWN STILL-SELLABLE FORMULA RESTORED — committed stock stops being subtracted, so trees that are already sold read as available. Correct in the workbook only because every committed cell in it is zero.",
    from: '    stillSellable: Math.max(0, onHand - committed - uppotNow),',
    to:   '    stillSellable: Math.max(0, onHand - uppotNow),' },
  { id: 'P5', file: 'config',
    why: '🔴 COVER MONTHS STOPS TYING TO GROW MONTHS — the plan holds back one month less than the replacement takes to arrive, on every variety, silently. The workbook defect.',
    from: '  if (perVarietyGrow != null && Number.isFinite(perVarietyGrow)) return Number(perVarietyGrow);\n  return ops.growMonthsDefault;',
    to:   '  return 6;' },
  { id: 'P6', file: 'math',
    why: 'the clamp stops reporting itself — a manager types 200, gets 144, and nothing on the screen says his number was not used',
    from: '    clamped: asked > delta,',
    to:   '    clamped: false,' },
  { id: 'P7', file: 'math',
    why: 'the delta can go negative — a lot smaller than its own cover reports a negative number of trees available to pot',
    from: '  const delta = Math.max(0, onHand - mustKeepSellable - cushion);',
    to:   '  const delta = onHand - mustKeepSellable - cushion;' },

  // ── GROUPING: the six spellings of thirty split back apart ──────────────────────────
  { id: 'P8', file: 'math',
    why: '🔴 GROUPING GOES BACK TO THE RAW `size` STRING — the 90 rows at LAWNS holding unit_value 30 split into six rungs, and the plan under-counts every one of them.',
    from: '  return `${lot.name.trim().toLowerCase()}|${lot.unitValue}`;',
    to:   '  return `${lot.name.trim().toLowerCase()}|${lot.size ?? \'\'}`;' },
  { id: 'P9', file: 'math',
    why: '🔴 A RANGE IS SILENTLY ASSIGNED ITS LOW END — "10/15 gallon" is planned as a 10, which is the exact laundering tech-debt #125 records and four live LAWNS rows would hit',
    from: '  if (lot.unitValueMax != null && lot.unitValueMax !== lot.unitValue) return null;',
    to:   '' },
  { id: 'P10', file: 'math',
    why: '🔴 A NEVER-COUNTED LOT IS PLANNED AS ZERO — 445 of LAWNS\'s 447 rows, and "absent" becomes "empty" (A9)',
    from: '  if (lot.qty == null) {\n    return { ok: false, reason: \'never_counted\', detail: \'Never counted — this is not a count of zero.\' };\n  }',
    to:   '' },

  // ── THE POT CASCADE: the $2,100 disappears ──────────────────────────────────────────
  { id: 'P11', file: 'math',
    why: '🔴 THE CASCADE WORKS UP THE LADDER — smallest rung first, so nothing has been emptied when each rung needs its pots and the freed-pot saving evaporates',
    from: '  const sizes = [...new Set([...needed.keys(), ...freed.keys()])].sort((a, b) => b - a);',
    to:   '  const sizes = [...new Set([...needed.keys(), ...freed.keys()])].sort((a, b) => a - b);' },
  { id: 'P12', file: 'math',
    why: 'freed pots are counted as 100% reusable — the recovery rate stops biting and the buy list is short by every binned pot',
    from: '    const reusable = Math.floor(f * ops.potRecoveryRate);',
    to:   '    const reusable = f;' },
  { id: 'P13', file: 'math',
    why: 'needed and freed are keyed the same way — a tree leaving a size is counted as freeing the size it is GOING to, which inverts the whole cascade',
    from: '    freed.set(m.fromUnitValue, (freed.get(m.fromUnitValue) ?? 0) + q);',
    to:   '    freed.set(m.toUnitValue, (freed.get(m.toUnitValue) ?? 0) + q);' },
  { id: 'P14', file: 'math',
    why: '🔴 BLOCK REVISITS STOP BEING REPORTED — the tractor-trip cost of working down the ladder is hidden, which is precisely the trade David said not to resolve silently',
    from: '    .filter(([, rungs]) => rungs.size > 1)',
    to:   '    .filter(() => false)' },

  // ── THE HOLD: derived, and `draft` holds ────────────────────────────────────────────
  { id: 'P15', file: 'hold',
    why: '🔴 A DRAFT PLAN STOPS HOLDING STOCK — the manager is part-way through deciding and the trees he is planning around can be sold out from under him',
    from: "  return status !== 'completed' && status !== 'cancelled';",
    to:   "  return status === 'open';" },
  { id: 'P16', file: 'hold',
    why: '🔴 A COMPLETED BATCH KEEPS HOLDING — the trees moved and on-hand already changed, so they are now subtracted twice and the lot reads short forever',
    from: "  return status !== 'completed' && status !== 'cancelled';",
    to:   "  return status !== 'cancelled';" },
  { id: 'P17', file: 'hold',
    why: 'availability stops subtracting the hold — the whole build becomes decorative and held stock is offered for sale',
    from: '  return Math.max(0, Number(onHand ?? 0) - Number(committed ?? 0) - Number(held ?? 0));',
    to:   '  return Math.max(0, Number(onHand ?? 0) - Number(committed ?? 0));' },
  { id: 'P18', file: 'hold',
    why: 'availability can go negative — an over-claimed lot renders "−12 available" at a customer',
    from: '  return Math.max(0, Number(onHand ?? 0) - Number(committed ?? 0) - Number(held ?? 0));',
    to:   '  return Number(onHand ?? 0) - Number(committed ?? 0) - Number(held ?? 0);' },
  { id: 'P19', file: 'hold',
    why: '🔴 THE SENTENCE STOPS NAMING THE HOLD — "36 available" against a lot the owner can SEE holding 220, with no hint that production took the difference',
    from: "  if (held > 0) parts.push(`${held} held for uppotting`);",
    to:   '' },

  // ── THE FLAGS: the threshold, and the refusal to guess ──────────────────────────────
  { id: 'P20', file: 'flags',
    why: 'the threshold becomes >= — every batch cries wolf exactly on day seven, and a flag that fires early is a flag nobody reads',
    from: '      if (over > FLAG_THRESHOLD_DAYS) {',
    to:   '      if (over >= FLAG_THRESHOLD_DAYS) {' },
  { id: 'P21', file: 'flags',
    why: '🔴 A CANCELLED BATCH FLAGS AS OVERDUE — permanent red on work nobody is going to do',
    from: "    if (line.status === 'completed' || line.status === 'cancelled') continue;",
    to:   "    if (line.status === 'completed') continue;" },
  { id: 'P22', file: 'flags',
    why: '🔴 THE FLAG GUESSES A CAUSE — "ran late" and "was done and never marked" are indistinguishable from the data and have OPPOSITE consequences for the stock counts',
    from: 'This could be any of three things and the data cannot tell them apart.`,',
    to:   'The work probably ran late.`,' },
  { id: 'P23', file: 'flags',
    why: 'the data-consequence cause disappears from the list — the one that means the inventory is wrong RIGHT NOW',
    from: "  'The work finished and nobody marked it complete — if so, the stock counts are wrong right now.',",
    to:   "  'The work finished but was not recorded.',\n  'placeholder — keeps the list at three'," },
  { id: 'P24', file: 'flags',
    why: '🔴 BACKDATING STOPS NEEDING A REASON — a completion is dated three weeks back and the sellable date and every forecast on it move, with nothing recorded about why',
    from: "  if (backdated && (input.reason == null || input.reason.trim() === '')) {",
    to:   '  if (false) {' },
  { id: 'P25', file: 'flags',
    why: 'a partial completion is refused instead of rolling forward — David: "the remainder rolls forward and is not a failure"',
    from: '  if (input.qtyCompleted > input.qtyPlanned) {',
    to:   '  if (input.qtyCompleted !== input.qtyPlanned) {' },

  // ── BASIS: the laundering this module exists to prevent ─────────────────────────────
  { id: 'P26', file: 'basis',
    why: '🔴 A TOTAL TAKES ITS BEST INPUT INSTEAD OF ITS WORST — hours resting on a guessed rate render as a FACT, which is exactly what destroys trust the first time Terry catches one',
    from: '  return bases.reduce((w, b) => (RANK[b] > RANK[w] ? b : w), \'fact\' as BasisKind);',
    to:   '  return bases.reduce((w, b) => (RANK[b] < RANK[w] ? b : w), \'guess\' as BasisKind);' },
  { id: 'P27', file: 'basis',
    why: 'an EMPTY basis list defaults to fact — nothing was measured and the screen says it was',
    from: "  if (bases.length === 0) return 'guess';",
    to:   "  if (bases.length === 0) return 'fact';" },
  { id: 'P28', file: 'basis',
    why: '🔴 THE ASSUMPTION LEAVES THE SENTENCE — "62 hours" with no "at 3 minutes a pot", which is a suggestion wearing a fact\'s clothes',
    from: "  if (e.basis === 'suggestion') return `${e.because} — at ${e.assumption}`;",
    to:   "  if (e.basis === 'suggestion') return e.because;" },
  { id: 'P29', file: 'basis',
    why: 'a ratio against a zero plan returns Infinity instead of null — a number where there is not one',
    from: '  return { planned: p, actual: a, delta, ratio: p === 0 ? null : delta / p, withinPlan: delta <= 0 };',
    to:   '  return { planned: p, actual: a, delta, ratio: delta / p, withinPlan: delta <= 0 };' },

  // ── THE MONEY WALL ──────────────────────────────────────────────────────────────────
  { id: 'P30', file: 'config',
    why: '🔴 THE WITHHELD LABOUR RATE BECOMES ZERO — a redaction that reads as a real figure, so every cost on the screen is wrong and confident (D-9)',
    from: '    money.labourRateInSeason = null;\n    money.labourRateWinter = null;',
    to:   '    money.labourRateInSeason = 0;\n    money.labourRateWinter = 0;' },
  { id: 'P31', file: 'config',
    why: "🔴 THE MIX COST IS SWEPT BEHIND THE WALL WITH THE WAGES — David's explicit exception undone, and the plan's entire right-hand side goes blank for the manager who runs it",
    from: '    money.potCostByUnitValue = {};',
    to:   '    money.potCostByUnitValue = {};\n    money.blendedMixCostPerCubicYard = null;' },
  { id: 'P32', file: 'config',
    why: 'the wall stops being applied at all — the labour rate reaches a client that may not see it, and the leak is one careless JSX expression away from the screen',
    from: '  if (!canReadMoney) {',
    to:   '  if (false) {' },

  // ── THE ARITHMETIC SELF-CHECK ───────────────────────────────────────────────────────
  { id: 'P33', file: 'math',
    why: '🔴 THE TOLERANCE WIDENS TO A DOLLAR — the indicator David will read to know the model still works stops being able to go red',
    from: 'export const ARITHMETIC_TOLERANCE = 0.01;',
    to:   'export const ARITHMETIC_TOLERANCE = 1.0;' },
  { id: 'P34', file: 'math',
    why: 'the check reports PASS without reporting the cent — the gap is absorbed rather than shown, and the next gap hides in it too',
    from: '    return { label, expected, actual, passes: Math.abs(difference) <= ARITHMETIC_TOLERANCE + 1e-9, difference };',
    to:   '    return { label, expected, actual, passes: Math.abs(difference) <= ARITHMETIC_TOLERANCE + 1e-9, difference: 0 };' },
  { id: 'P35', file: 'math',
    why: '🔴 THE CHECK RENDERS AS FAILING WHEN THE MIX COST IS WITHHELD — a red indicator about a number the reader is not allowed to see',
    from: '  if (money.blendedMixCostPerCubicYard == null) return [];',
    to:   '  if (false) return [];' },

  // ── THE CREW, AND THE WINDOW ────────────────────────────────────────────────────────
  { id: 'P36', file: 'math',
    why: '🔴 THE PLAN IS COSTED AT FOUR PEOPLE — the seasonal staff leave after Thanksgiving and 56 of the window\'s 65 weekdays run on two, so capacity is overstated by 86% of the window. This is the defect the first red run caught.',
    from: '  const crewUsed = runsPastDeparture ? ops.crewSizeWinter : ops.crewSizeInSeason;',
    to:   '  const crewUsed = ops.crewSizeInSeason;' },
  { id: 'P37', file: 'math',
    why: 'a plan running past its window stops saying so — the manager commits it and finds out in February',
    from: "      overrunsWindow: !!(lastCompletion && ops.windowEnd && lastCompletion > ops.windowEnd),",
    to:   '      overrunsWindow: false,' },
  { id: 'P38', file: 'math',
    why: '🔴 FIRST-SELLABLE KEYS OFF THE START DATE INSTEAD OF THE FINISH — earlier rather than later, which is the wrong direction on the one asymmetry David named twice',
    from: '      firstSellable: completesOn == null ? null : addMonths(completesOn, lot.growMonths ?? ops.growMonthsDefault),',
    to:   '      firstSellable: startsOn == null ? null : addMonths(startsOn, lot.growMonths ?? ops.growMonthsDefault),' },
  { id: 'P39', file: 'math',
    why: 'a rung may go sideways or down — a "promotion" to the same size is planned, and the mix volume for it is zero',
    from: '    if (target == null || !Number.isFinite(target) || target <= (lot.unitValue ?? 0)) continue;',
    to:   '    if (target == null || !Number.isFinite(target)) continue;' },
  { id: 'P40', file: 'math',
    why: 'month arithmetic overflows instead of clamping — 31 January plus one month becomes 3 March, and every sellable date near a month end moves',
    from: '  const day = Math.min(d, lastDay);',
    to:   '  const day = d;' },
];

const originals = Object.fromEntries(Object.entries(FILES).map(([k, p]) => [k, readFileSync(p, 'utf8')]));
let caught = 0, survived = 0, errored = 0;

try {
  process.stdout.write('  CONTROL (unmutated) … ');
  if (!suiteIsGreen()) { console.log('RED — aborting; every CAUGHT below would be meaningless.'); process.exit(2); }
  console.log('GREEN ✓\n');

  for (const m of MUTANTS) {
    const path = FILES[m.file];
    const src = originals[m.file];
    if (!src.includes(m.from)) {
      console.log(`  ${m.id.padEnd(4)} ERROR    the from-text is not in ${m.file} — mutant never applied`);
      errored++; continue;
    }
    writeFileSync(path, src.replace(m.from, m.to));
    // 🔴 VERIFY THE MUTATION LANDED IN THE FILE BEFORE TRUSTING THE RESULT. #274's first batch
    // reported two false survivors because the helper restored each file before the anchor was
    // checked, so the mutation had landed on a header comment rather than the body.
    const landed = readFileSync(path, 'utf8') !== src;
    if (!landed) {
      console.log(`  ${m.id.padEnd(4)} ERROR    replacement produced an identical file — mutant never applied`);
      errored++; writeFileSync(path, src); continue;
    }
    const green = suiteIsGreen();
    writeFileSync(path, src);
    if (green) { console.log(`  ${m.id.padEnd(4)} SURVIVED 🔴  ${m.why}`); survived++; }
    else       { console.log(`  ${m.id.padEnd(4)} CAUGHT   ✓   ${m.why}`); caught++; }
  }
} finally {
  for (const [k, p] of Object.entries(FILES)) writeFileSync(p, originals[k]);
}

console.log(`\n  ── ${caught}/${caught + survived} caught · ${survived} survived · ${errored} never applied ──\n`);
process.exit(survived > 0 || errored > 0 ? 1 : 0);
