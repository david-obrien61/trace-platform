/**
 * ── capacityEstimate — one team or two, and the working behind it (ledger #375) ──────────
 *
 * David's rule, 2026-09-21: suggest ONE team until the estimated day exceeds X hours, TWO above
 * that; X is per-business (LAWNS 7); planting time is per-business (30 min default); every estimate
 * shows its working and Lauren can override it.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/capacityEstimate.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { estimateDay, type CapacityInputs, type CapacitySettings } from './capacityEstimate';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// LAWNS: X = 7 h, and ONE MINUTE A GALLON (David, 2026-09-25).
// ⚠️ `plantingMinutesPerTree` is kept in the fixture but is no longer what the day is built from.
const LAWNS: CapacitySettings = { dayHoursBeforeSecondTeam: 7, plantingMinutesPerGallon: 1, plantingMinutesPerTree: 30, fromSettings: true };
const day = (o: Partial<CapacityInputs> = {}): CapacityInputs =>
  ({ stops: 4, trees: 10, gallons: 300, treesSizeUnknown: 0, driveMinutes: 60, miles: 42, ...o });

// ══ §A THE RULE ══════════════════════════════════════════════════════════════════
{
  // 300 gal × 1 min = 300 min planting + 60 drive = 360 min = 6.0 h → within 7 → ONE
  // ⚠️ The old form read "10 trees × 30 min = 300" and reached the SAME 300 by a different route.
  //    That coincidence is why every probe below was re-read rather than trusted for still passing:
  //    a probe that passes for the wrong reason is #182's class, a check that never reached its target.
  const under = estimateDay(day(), LAWNS);
  ok(under.totalHours === 6 && under.suggestedTeams === 1,
    `A1: 6.0 h is within 7 → one team (got ${under.totalHours} h, ${under.suggestedTeams})`);

  // 420 gal × 1 min = 420 + 60 drive = 480 = 8.0 h → above 7 → TWO
  // ⚠️ The hours are driven by GALLONS now, not by the tree count — so these probes vary gallons.
  //    Varying `trees` would leave the estimate unmoved and the probe would assert nothing.
  const over = estimateDay(day({ trees: 14, gallons: 420 }), LAWNS);
  ok(over.totalHours === 8 && over.suggestedTeams === 2,
    `A2: 8.0 h is above 7 → two teams (got ${over.totalHours} h, ${over.suggestedTeams})`);

  // 🔴 EXACTLY X IS NOT OVER X. 360 gal × 1 min = 360 + 60 = 420 = 7.0 h.
  const exact = estimateDay(day({ trees: 12, gallons: 360 }), LAWNS);
  ok(exact.totalHours === 7 && exact.suggestedTeams === 1,
    `🔴 A3: exactly 7 h is NOT "exceeds 7" — one team (got ${exact.suggestedTeams})`);

  // 🔴 A THRESHOLD, NEVER A DIVISION. A 20-hour day still suggests TWO, not three or four.
  const huge = estimateDay(day({ trees: 100, gallons: 3000, driveMinutes: 120 }), LAWNS);
  ok(huge.suggestedTeams === 2,
    `🔴 A4: a ${huge.totalHours} h day suggests 2, never ceil(hours/X) — David said one team or two`);
}

// ══ §B X IS PER-BUSINESS AND NEVER LEARNS ════════════════════════════════════════
{
  const d = day({ trees: 14, gallons: 420 });        // 420 gal × 1 min + 60 drive = 8.0 h
  ok(estimateDay(d, LAWNS).suggestedTeams === 2, 'B1: at X=7, 8 h wants two');
  ok(estimateDay(d, { ...LAWNS, dayHoursBeforeSecondTeam: 9 }).suggestedTeams === 1,
    '🔴 B2: the SAME day wants ONE team at a nursery whose X is 9 — the threshold is the owner’s, not the platform’s');
  ok(estimateDay(d, LAWNS).thresholdHours === 7,
    'B3: the estimate CARRIES the X it was measured against, so a snapshot can be read without the settings');
}

// ══ §C PLANTING TIME IS PER-BUSINESS AND SAYS WHERE IT CAME FROM ═════════════════
{
  // 🔴 THE RATE IS PER GALLON NOW (David, 2026-09-25). At 2 min/gal, 300 gal = 600 min.
  const measured = estimateDay(day(), { ...LAWNS, plantingMinutesPerGallon: 2 });
  ok(measured.plantingMinutes === 600 && measured.totalHours === 11,
    `C1: 300 gal × 2 min = 600 min planting (got ${measured.plantingMinutes}, ${measured.totalHours} h)`);
  const dflt = estimateDay(day(), { ...LAWNS, fromSettings: false });
  const line = dflt.working.find(w => w.label === 'Planting time')!;
  ok(/standard figure — not set for this nursery/.test(line.because),
    '🔴 C2: a DEFAULT says it is a default — never presented as this nursery’s measured figure (D-9)');
  const own = estimateDay(day(), LAWNS).working.find(w => w.label === 'Planting time')!;
  ok(/this nursery’s setting/.test(own.because), 'C3: a saved setting says so');
}

// ══ §D 🔴 UNKNOWN DRIVE TIME IS NOT ZERO DRIVE TIME ══════════════════════════════
{
  const unrouted = estimateDay(day({ driveMinutes: null, miles: null }), LAWNS);
  ok(unrouted.driveKnown === false, 'D1: an unrouted day reports driveKnown = false');
  ok(unrouted.totalHours === 5, 'D2: the total is planting alone — 300 min = 5.0 h');
  ok(/at least/.test(unrouted.headline),
    '🔴 D3: the headline says the day is AT LEAST that long — a floor, never a finished estimate');
  const drive = unrouted.working.find(w => w.label === 'Drive time')!;
  ok(drive.value === 'not known' && /FLOOR/.test(drive.because),
    '🔴 D4: drive time reads "not known", never "0 h" — an absent value must not render as a present one (A9)');
  const miles = unrouted.working.find(w => w.label === 'Miles')!;
  ok(miles.value === 'not known', 'D5: miles the optimiser never reported are not shown as 0');

  // 🔴 THE CONSEQUENCE THAT MATTERS: an unrouted day must not look SHORTER than the routed one.
  const routed = estimateDay(day(), LAWNS);
  ok(unrouted.totalHours < routed.totalHours && unrouted.driveKnown === false,
    'D6: the unrouted total is lower BUT flagged as a floor — it is never read as the finished answer');
}

// ══ §E THE WORKING IS ALWAYS SHOWN, AND GALLONS ARE NOT TIME ═════════════════════
{
  const e = estimateDay(day(), LAWNS);
  for (const label of ['Stops', 'Trees', 'Container gallons', 'Planting time', 'Drive time', 'Miles', 'Estimated day', 'Second team above']) {
    ok(e.working.some(w => w.label === label), `E1: the working shows "${label}"`);
  }
  ok(e.working.every(w => w.because.length > 0), '🔴 E2: EVERY line says where its number came from');

  // 🔴 E3 IS INVERTED ON PURPOSE, AND THE OLD ASSERTION IS QUOTED SO THE REVERSAL IS VISIBLE.
  //    It used to read: "container gallons do NOT change the time — nothing has measured that a
  //    bigger pot plants slower, and a guess dressed as arithmetic is worse than an honest
  //    omission." That was right until it was measured. David, 2026-09-25, having measured it on
  //    his own crews: planting time IS gallons × minutes-per-gallon. So the probe now asserts the
  //    opposite, and it must FAIL on the old behaviour — which is what makes it a real check.
  const big = estimateDay(day({ gallons: 3000 }), LAWNS);
  ok(big.plantingMinutes === 3000 && big.totalHours > e.totalHours,
    `🔴 E3: ten times the gallons is ten times the planting time — 3000 gal × 1 min = 3000 min (got ${big.plantingMinutes} min, ${big.totalHours} h vs ${e.totalHours} h)`);
  // E4 · nothing could be sized at all → say so, never a zero.
  const unread = estimateDay(day({ gallons: null, treesSizeUnknown: 10 }), LAWNS).working.find(w => w.label === 'Container gallons')!;
  ok(unread.value === 'none could be read', `E4: sizes that could not be read say so rather than counting as zero (got "${unread.value}")`);

  // ══ E5-E8 · DAVID'S RULING, 2026-09-25: "size unknown — not counted", never 0 ══════════════
  const partial = estimateDay(day({ trees: 10, gallons: 150, treesSizeUnknown: 4, driveMinutes: 0 }), LAWNS);
  ok(partial.plantingMinutes === 150 && partial.treesNotCounted === 4,
    `🔴 E5: the six sized trees are counted (150 gal × 1 min) and the four unreadable ones are NOT — a partial sum beats discarding the answer (got ${partial.plantingMinutes} min, ${partial.treesNotCounted} not counted)`);
  const notCounted = partial.working.find(w => w.label === 'Trees not counted')!;
  ok(notCounted?.value === '4 — size unknown',
    `🔴 E6: the words are "size unknown", never a 0 — a zero reads as "no work" (got "${notCounted?.value}")`);
  ok(/at least/.test(partial.working.find(w => w.label === 'Estimated day')!.value),
    '🔴 E7: a day with an unsized tree is "at least" N hours — the estimate is a FLOOR and says so');
  ok(!estimateDay(day({ treesSizeUnknown: 0 }), LAWNS).working.some(w => w.label === 'Trees not counted'),
    'E8: …and a day where every size was read shows no such line at all — no empty reassurance');
  // 🔴 E10 ADDED AFTER A SURVIVING MUTANT, AND THAT IS THE REASON IT EXISTS. M3 removed
  //    `treesNotCounted === 0` from the HEADLINE's "at least" and all 36 probes still passed: E7
  //    reads the *working line*, which computes its own suffix, so the headline was unasserted.
  //    Lauren reads the headline first. A probe that misses the sentence a person actually reads is
  //    tech-debt #182's class — it never reached its target.
  ok(/at least/.test(partial.headline),
    `🔴 E10: the HEADLINE says "at least" too when a tree could not be sized (got "${partial.headline}")`);
  ok(!/at least/.test(estimateDay(day({ treesSizeUnknown: 0 }), LAWNS).headline),
    'E11: …and does NOT when every tree was sized and the day was routed — the hedge must mean something');
  // 🔴 E9 · THE WORKING IS SHOWN IN DAVID'S OWN FORM: "3 × 15 gal × 1 min = 45 min".
  const shown = estimateDay(day({ trees: 3, gallons: 45, treesSizeUnknown: 0 }), LAWNS)
    .working.find(w => w.label === 'Planting time')!;
  ok(shown.because.includes('45 gal × 1 min = 45 min'),
    `🔴 E9: the planting line shows its arithmetic, not just its answer (got "${shown.because}")`);
}

// ══ §F EDGES ═════════════════════════════════════════════════════════════════════
{
  const empty = estimateDay({ stops: 0, trees: 0, gallons: 0, treesSizeUnknown: 0, driveMinutes: 0, miles: 0 }, LAWNS);
  ok(empty.totalHours === 0 && empty.suggestedTeams === 1,
    'F1: an empty day is 0 h and suggests one team — never zero teams');
  const negTrees = estimateDay(day({ trees: -5, gallons: -300 }), LAWNS);
  ok(negTrees.plantingMinutes === 0, 'F2: negative gallons contribute no time, never negative time');
  // 🔴 SEPARATED FROM F2 ON A SURVIVING MUTANT. The original probe set BOTH to negative, so
  // clamping the tree count alone made it pass — it could not tell whether the SETTING was clamped.
  // A probe that passes for the wrong reason is the [[R-33]] shape: it could not have failed.
  // This one holds trees POSITIVE so only the setting's clamp can save it.
  const negSetting = estimateDay(day({ trees: 10, gallons: 300, driveMinutes: 0 }), { ...LAWNS, plantingMinutesPerGallon: -1 });
  ok(negSetting.plantingMinutes === 0 && negSetting.totalHours === 0,
    `🔴 F3: a NEGATIVE minutes-per-gallon rate yields 0, never negative time (got ${negSetting.plantingMinutes} min, ${negSetting.totalHours} h)`);
  ok(negSetting.suggestedTeams === 1,
    'F4: …and a nonsense setting can never suggest a second team by going negative past the threshold');
}

console.log(`\ncapacityEstimate: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
