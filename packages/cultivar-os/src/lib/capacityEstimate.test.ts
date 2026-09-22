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

const LAWNS: CapacitySettings = { dayHoursBeforeSecondTeam: 7, plantingMinutesPerTree: 30, fromSettings: true };
const day = (o: Partial<CapacityInputs> = {}): CapacityInputs =>
  ({ stops: 4, trees: 10, gallons: 300, driveMinutes: 60, miles: 42, ...o });

// ══ §A THE RULE ══════════════════════════════════════════════════════════════════
{
  // 10 trees × 30 = 300 min planting + 60 drive = 360 min = 6.0 h → within 7 → ONE
  const under = estimateDay(day(), LAWNS);
  ok(under.totalHours === 6 && under.suggestedTeams === 1,
    `A1: 6.0 h is within 7 → one team (got ${under.totalHours} h, ${under.suggestedTeams})`);

  // 14 trees × 30 = 420 + 60 = 480 = 8.0 h → above 7 → TWO
  const over = estimateDay(day({ trees: 14 }), LAWNS);
  ok(over.totalHours === 8 && over.suggestedTeams === 2,
    `A2: 8.0 h is above 7 → two teams (got ${over.totalHours} h, ${over.suggestedTeams})`);

  // 🔴 EXACTLY X IS NOT OVER X. 12 trees × 30 = 360 + 60 = 420 = 7.0 h.
  const exact = estimateDay(day({ trees: 12 }), LAWNS);
  ok(exact.totalHours === 7 && exact.suggestedTeams === 1,
    `🔴 A3: exactly 7 h is NOT "exceeds 7" — one team (got ${exact.suggestedTeams})`);

  // 🔴 A THRESHOLD, NEVER A DIVISION. A 20-hour day still suggests TWO, not three or four.
  const huge = estimateDay(day({ trees: 100, driveMinutes: 120 }), LAWNS);
  ok(huge.suggestedTeams === 2,
    `🔴 A4: a ${huge.totalHours} h day suggests 2, never ceil(hours/X) — David said one team or two`);
}

// ══ §B X IS PER-BUSINESS AND NEVER LEARNS ════════════════════════════════════════
{
  const d = day({ trees: 14 });                     // 8.0 h
  ok(estimateDay(d, LAWNS).suggestedTeams === 2, 'B1: at X=7, 8 h wants two');
  ok(estimateDay(d, { ...LAWNS, dayHoursBeforeSecondTeam: 9 }).suggestedTeams === 1,
    '🔴 B2: the SAME day wants ONE team at a nursery whose X is 9 — the threshold is the owner’s, not the platform’s');
  ok(estimateDay(d, LAWNS).thresholdHours === 7,
    'B3: the estimate CARRIES the X it was measured against, so a snapshot can be read without the settings');
}

// ══ §C PLANTING TIME IS PER-BUSINESS AND SAYS WHERE IT CAME FROM ═════════════════
{
  const measured = estimateDay(day(), { ...LAWNS, plantingMinutesPerTree: 20 });
  ok(measured.plantingMinutes === 200 && measured.totalHours === 4.3,
    `C1: 10 trees × 20 min = 200 min planting (got ${measured.plantingMinutes})`);
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

  // 🔴 GALLONS ARE REPORTED, NEVER MULTIPLIED. Doubling them must not move the estimate.
  const big = estimateDay(day({ gallons: 3000 }), LAWNS);
  ok(big.totalHours === e.totalHours && big.suggestedTeams === e.suggestedTeams,
    '🔴 E3: container gallons do NOT change the time — nothing has measured that a bigger pot plants slower, and a guess dressed as arithmetic is worse than an honest omission');
  const unread = estimateDay(day({ gallons: null }), LAWNS).working.find(w => w.label === 'Container gallons')!;
  ok(unread.value === 'not known', 'E4: sizes that could not be read say so rather than counting as zero');
}

// ══ §F EDGES ═════════════════════════════════════════════════════════════════════
{
  const empty = estimateDay({ stops: 0, trees: 0, gallons: 0, driveMinutes: 0, miles: 0 }, LAWNS);
  ok(empty.totalHours === 0 && empty.suggestedTeams === 1,
    'F1: an empty day is 0 h and suggests one team — never zero teams');
  const negTrees = estimateDay(day({ trees: -5 }), LAWNS);
  ok(negTrees.plantingMinutes === 0, 'F2: a negative tree count contributes no time');
  // 🔴 SEPARATED FROM F2 ON A SURVIVING MUTANT. The original probe set BOTH to negative, so
  // clamping the tree count alone made it pass — it could not tell whether the SETTING was clamped.
  // A probe that passes for the wrong reason is the [[R-33]] shape: it could not have failed.
  // This one holds trees POSITIVE so only the setting's clamp can save it.
  const negSetting = estimateDay(day({ trees: 10, driveMinutes: 0 }), { ...LAWNS, plantingMinutesPerTree: -30 });
  ok(negSetting.plantingMinutes === 0 && negSetting.totalHours === 0,
    `🔴 F3: a NEGATIVE planting-time setting yields 0, never negative time (got ${negSetting.plantingMinutes} min, ${negSetting.totalHours} h)`);
  ok(negSetting.suggestedTeams === 1,
    'F4: …and a nonsense setting can never suggest a second team by going negative past the threshold');
}

console.log(`\ncapacityEstimate: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
