/**
 * ── mixSchedule — the planned batches, day by day · 2026-09-25 (ledger #414) ────────────────────
 *
 * PROBES BOTH DIRECTIONS (STD-022), and the negative half is most of the file, because every failure
 * mode here produces a PLAN THAT LOOKS REAL: a projection from an uncounted pile, an unreadable day
 * treated as zero demand, a plan that covers only the first dip, a due date in the past presented as
 * if it were achievable.
 *
 * 🔴 IT DOES NOT TEST THE DEMAND ARITHMETIC — `mixRequirement` owns that and has its own suite. The
 * per-day needed figures here are INPUTS.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/costing/mixSchedule.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { planMixBatches, type DayDemand } from './mixSchedule';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

/** LAWNS's real figures: keep 5 yd on hand, a batch makes 2.5 yd, two days' lead time. */
const LAWNS = { minimumYards: 5, batchYards: 2.5, leadTimeDays: 2 };
const day = (d: string, needed: number | null): DayDemand => ({ day: d, neededYards: needed });
const plan = (days: DayDemand[], onHandYards: number | null, counted = true) =>
  planMixBatches({ days, onHandYards, onHandIsCounted: counted, ...LAWNS });

// ══════════════════════════════════════════════════════════════════════════════════════════════
// A · THE REFUSALS — the states where a number would be a fiction
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // 🔴 THE ONE THAT MATTERS TODAY: every LAWNS mix row is a catalogue placeholder, never a count.
  const seeded = plan([day('2026-10-03', 9)], 10, false);
  ok(seeded.refusal !== null && /never been counted/.test(seeded.refusal as string),
    'A1 an UNCOUNTED on-hand REFUSES and names the reason — planning from a seed value would look exactly like a real plan');
  ok(seeded.planned.length === 0,
    'A2 and it plans NOTHING — the refusal is not advisory');
  ok(seeded.sentence === seeded.refusal,
    'A3 the sentence a screen shows IS the refusal, so there is no way to render a plan that was refused');

  const noFigure = plan([day('2026-10-03', 9)], null);
  ok(noFigure.refusal !== null && /no on-hand figure/.test(noFigure.refusal as string),
    'A4 no on-hand figure at all refuses — null is not 0 (D-9 / A9)');

  const noYield = planMixBatches({ days: [day('2026-10-03', 9)], onHandYards: 1, onHandIsCounted: true,
    minimumYards: 5, batchYards: 0, leadTimeDays: 2 });
  ok(noYield.refusal !== null && /no number of batches would help/.test(noYield.refusal as string),
    'A5 a batch that makes nothing refuses rather than dividing by zero into Infinity batches');

  const nothing = plan([], 10);
  ok(nothing.refusal === null && nothing.planned.length === 0 && /Nothing is scheduled/.test(nothing.sentence),
    'A6 NEGATIVE CONTROL: an empty horizon is not a refusal — it is a complete answer');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// B · THE ARITHMETIC
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // 10 on hand, Saturday needs 9 → closes at 1, below the 5 minimum by 4 → 2 batches (5 yd).
  const s = plan([day('2026-10-03', 9)], 10);
  ok(s.firstShortDay === '2026-10-03', 'B1 the first short day is named');
  ok(s.planned.length === 1 && s.planned[0].batches === 2,
    'B2 short by 4 yards with a 2.5 yd batch → 2 batches, rounded UP (you cannot make 1.6 of a batch)');
  ok(s.planned[0].dueOn === '2026-10-01',
    'B3 due TWO DAYS before the day it is needed for — the lead time, from config, not a constant here');
  ok(s.planned[0].neededFor === '2026-10-03' && s.planned[0].yards === 5,
    'B4 and the batch says what it is for, and how many yards it makes');
  ok(s.projection[0].closingYards === 6 && s.projection[0].belowMinimum === false,
    'B5 the projected close is 1 + 5 = 6, back above the minimum');
  ok(/NEED MIX — stock low: 2 batches by 2026-10-01/.test(s.sentence),
    `B6 the sentence is David's own words: "${s.sentence}"`);

  const enough = plan([day('2026-10-03', 2)], 10);
  ok(enough.planned.length === 0 && enough.firstShortDay === null,
    'B7 NEGATIVE CONTROL: a day that closes above the minimum plans nothing');
  ok(/Enough mix for everything scheduled/.test(enough.sentence) && /5 yard minimum/.test(enough.sentence),
    'B8 and it says so, naming the minimum it checked against');

  const exact = plan([day('2026-10-03', 5)], 10);
  ok(exact.planned.length === 0,
    'B9 closing EXACTLY at the minimum is not short — the minimum is a floor to keep, not to exceed');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// C · A PLAN THAT COVERS ONLY THE FIRST DIP IS NOT A PLAN
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const s = plan([day('2026-10-03', 9), day('2026-10-10', 6), day('2026-10-17', 6)], 10);
  ok(s.planned.length === 3,
    'C1 three shortfalls across the horizon produce THREE planned batches, not one');
  ok(s.planned.every(p => p.dueOn < p.neededFor),
    'C2 every one is dated before the day it is for');
  ok(s.projection.every(d => d.closingYards !== null && (d.closingYards as number) >= 5),
    'C3 and every projected day closes at or above the minimum once the plan is applied');
  ok(/and \d+ more later in the window/.test(s.sentence),
    `C4 the sentence says there is more than one: "${s.sentence}"`);

  // Stock carries forward: a big batch on day 1 can cover day 2 with nothing extra.
  const carried = plan([day('2026-10-03', 9), day('2026-10-10', 1)], 10);
  ok(carried.planned.length === 1,
    'C5 stock CARRIES FORWARD — the batch made for the first day covers the second, so nothing extra is planned');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// D · AN UNREADABLE DAY IS NOT ZERO DEMAND
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // 🔴 THE DEFECT THIS PREVENTS: treating a day nobody could size as 0 carries stock forward that
  //    will not be there, and the plan then looks complete while being short.
  const s = plan([day('2026-10-03', null), day('2026-10-10', 6)], 10);
  ok(s.unreadableDays.length === 1 && s.unreadableDays[0] === '2026-10-03',
    'D1 the unreadable day is NAMED');
  ok(s.projection[0].closingYards === null,
    'D2 its closing figure is null — not 10, and not 4');
  ok(s.projection[1].closingYards === null,
    'D3 🔴 AND EVERY DAY AFTER IT IS ALSO NULL — once one day is unknown the chain is broken, and a later day cannot be projected from a stock level nobody knows');
  ok(s.planned.length === 0,
    'D4 so nothing is planned from a broken chain');
  ok(/could not be worked out/.test(s.sentence) && /not the whole picture/.test(s.sentence),
    `D5 and the sentence refuses to claim completeness: "${s.sentence}"`);

  const readableFirst = plan([day('2026-10-03', 9), day('2026-10-10', null)], 10);
  ok(readableFirst.planned.length === 1 && /more may be needed/.test(readableFirst.sentence),
    'D6 a readable day BEFORE the unreadable one still plans — and the sentence warns that more may be needed');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// E · A DUE DATE IN THE PAST SAYS SO
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // The shortfall is on the FIRST day of the horizon, so due = two days before it started.
  const s = plan([day('2026-10-03', 9), day('2026-10-10', 1)], 10);
  ok(s.planned[0].alreadyLate === true,
    'E1 a batch due before the horizon began is flagged alreadyLate');
  ok(/that date has passed — make it as soon as you can/.test(s.sentence),
    `E2 and the sentence says so rather than printing an impossible date flatly: "${s.sentence}"`);

  const inTime = plan([day('2026-10-01', 0), day('2026-10-02', 0), day('2026-10-03', 9), day('2026-10-10', 1)], 10);
  ok(inTime.planned[0].alreadyLate === false && !/has passed/.test(inTime.sentence),
    'E3 NEGATIVE CONTROL: with the lead time inside the horizon it is NOT flagged late');
}

console.log(`\nmixSchedule: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
