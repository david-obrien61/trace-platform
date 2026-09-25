/**
 * ── buildTiming — how long a batch takes, measured · 2026-09-25 (ledger #413) ───────────────────
 *
 * PROBES BOTH DIRECTIONS (STD-022). The negative half is the point: with nothing timed the answer must
 * be a SENTENCE saying so, never a number; and a run with half a timing must be excluded and COUNTED
 * rather than averaged as zero, which would drag the figure toward zero invisibly.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/costing/buildTiming.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { batchTimeFrom, batchTimeText, type TimedRun } from './buildTiming';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const run = (batches: number, startMin: number | null, endMin: number | null): TimedRun => ({
  batches,
  startedAt: startMin == null ? null : new Date(Date.UTC(2026, 8, 25, 8, startMin)).toISOString(),
  finishedAt: endMin == null ? null : new Date(Date.UTC(2026, 8, 25, 8, endMin)).toISOString(),
});

// ── A · THE MEASUREMENT ───────────────────────────────────────────────────────────────────────
{
  const t = batchTimeFrom([run(1, 0, 40)]);
  ok(t.minutesPerBatch === 40 && t.timedRuns === 1 && t.batchesMeasured === 1,
    'A1 one run of one batch taking 40 minutes gives 40 minutes a batch');
  ok(/40 minutes a batch — measured over 1 batch run/.test(batchTimeText(t)),
    'A2 and the sentence NAMES the run count, so a figure cannot appear without it');

  const two = batchTimeFrom([run(2, 0, 60)]);
  ok(two.minutesPerBatch === 30, 'A3 one run of TWO batches taking an hour gives 30 minutes a batch');

  const many = batchTimeFrom([run(1, 0, 40), run(1, 0, 20), run(2, 0, 60)]);
  ok(many.batchesMeasured === 4 && many.minutesPerBatch === 30,
    'A4 three runs, 4 batches, 120 minutes → 30 minutes a batch (batches are the denominator, not runs)');
  ok(/measured over 3 batch runs/.test(batchTimeText(many)), 'A5 plural reads correctly');
}

// ── B · NOTHING TIMED IS A SENTENCE, NEVER A NUMBER ───────────────────────────────────────────
{
  const none = batchTimeFrom([]);
  ok(none.minutesPerBatch === null && none.timedRuns === 0,
    'B1 no runs at all → null, not 0 — LAWNS has never timed a batch, and this is that state');
  ok(batchTimeText(none) === 'no batch has been timed yet',
    'B2 and the sentence says exactly that');

  const untimed = batchTimeFrom([run(1, null, null), run(2, null, null)]);
  ok(untimed.minutesPerBatch === null && untimed.untimedRuns === 2,
    'B3 runs with no timing give null and are COUNTED');
  ok(/2 builds recorded without a start and finish/.test(batchTimeText(untimed)),
    'B4 and the sentence says how many builds exist but cannot be used — silence would read as "no builds"');
}

// ── C · THE HALF-TIMED AND NONSENSE RUNS ARE EXCLUDED AND COUNTED ─────────────────────────────
{
  // 🔴 THE DEFECT THIS PREVENTS: averaging a NULL as 0 drags the figure toward zero invisibly.
  const half = batchTimeFrom([run(1, 0, 40), run(1, 0, null)]);
  ok(half.minutesPerBatch === 40 && half.timedRuns === 1 && half.untimedRuns === 1,
    'C1 a run with a start and NO finish is excluded — the figure stays 40, not 20');
  ok(/1 other build carried no timing and is not in this figure/.test(batchTimeText(half)),
    'C2 and the sentence discloses the exclusion rather than hiding it');

  ok(batchTimeFrom([run(1, 40, 0)]).minutesPerBatch === null,
    'C3 a run that finished BEFORE it started is not usable');
  ok(batchTimeFrom([run(0, 0, 40)]).minutesPerBatch === null,
    'C4 a run of zero batches is not usable — it would divide by zero');
  ok(batchTimeFrom([run(-2, 0, 40)]).minutesPerBatch === null,
    'C5 a negative batch count is not usable');
  ok(batchTimeFrom([{ batches: 1, startedAt: 'not a date', finishedAt: 'nor this' }]).minutesPerBatch === null,
    'C6 an unparseable timestamp is not usable, and does not become NaN minutes');

  const instant = batchTimeFrom([run(1, 10, 10)]);
  ok(instant.minutesPerBatch === 0 && instant.timedRuns === 1,
    'C7 NEGATIVE CONTROL: a run that started and finished at the same moment is USABLE and gives 0 — somebody recorded it that way, and 0 measured is a different claim from nothing measured');
  ok(/0 minutes a batch — measured over 1 batch run/.test(batchTimeText(instant)),
    'C8 and it is shown as a measurement, so a reader can see it is wrong and fix it');
}

console.log(`\nbuildTiming: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
