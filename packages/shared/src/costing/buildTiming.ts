// ============================================================
// buildTiming — HOW LONG A BATCH TAKES, MEASURED OVER REAL BUILDS.
//
// PURPOSE:      David, 2026-09-25: *"batch time per item is measured from real builds and shown
//               ('measured over N batches'), never assumed."* LAWNS has never timed a batch, so the
//               honest answer today is that there is no figure — and this module's job is to say that
//               in words rather than return a plausible number.
//
// 🔴 IT NEVER FALLS BACK TO AN ESTIMATE. `item_recipes.build_minutes` exists and may hold a figure
//    somebody typed; this module does NOT read it, and does not average the two. A measured figure and
//    a typed one are different claims, and blending them produces a number with no provenance —
//    exactly the "right-looking figure" §6 r25 exists to prevent. The caller decides which to show;
//    this answers only "what do the real builds say?"
//
// 🔴 A RUN WITH NO TIMING IS EXCLUDED AND COUNTED, NOT TREATED AS ZERO. `build_runs.started_at` and
//    `finished_at` are nullable, because a run recorded by hand may carry neither. Averaging a NULL as
//    0 would drag the figure toward zero invisibly; the untimed runs are reported so a reader can see
//    how much of the history the figure actually rests on.
//
// DEPENDENCIES: none. PURE — no db, no clock, no env.
// OUTPUTS:      TimedRun · BatchTime · batchTimeFrom · batchTimeText.
// AC-1: no vertical noun. A batch of anything.
// STORY: user_stories.md → *Is there enough mix for Saturday?*
// ============================================================

/** One `build_runs` row, as much of it as a timing needs. */
export interface TimedRun {
  batches: number;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface BatchTime {
  /** Minutes for ONE batch, averaged over the timed runs. Null when nothing has been timed. */
  minutesPerBatch: number | null;
  /** How many runs the figure rests on. 0 when there is no figure. */
  timedRuns: number;
  /** Runs that carry no usable timing. Reported, never averaged as zero. */
  untimedRuns: number;
  /** Total batches across the timed runs — the denominator, stated so it can be checked. */
  batchesMeasured: number;
}

/**
 * The batch time the real builds support. A run is usable only if it has BOTH ends, they are in the
 * right order, and it names a positive batch count — anything else is counted as untimed.
 */
export function batchTimeFrom(runs: readonly TimedRun[]): BatchTime {
  let minutes = 0, batches = 0, timed = 0, untimed = 0;
  for (const r of runs) {
    const a = r.startedAt == null ? NaN : Date.parse(r.startedAt);
    const b = r.finishedAt == null ? NaN : Date.parse(r.finishedAt);
    const usable = Number.isFinite(a) && Number.isFinite(b) && b >= a
      && Number.isFinite(r.batches) && r.batches > 0;
    if (!usable) { untimed++; continue; }
    minutes += (b - a) / 60000;
    batches += r.batches;
    timed++;
  }
  return {
    minutesPerBatch: timed === 0 || batches <= 0 ? null : Math.round((minutes / batches) * 10) / 10,
    timedRuns: timed,
    untimedRuns: untimed,
    batchesMeasured: batches,
  };
}

/**
 * The sentence a screen shows. It NAMES its own provenance, so a figure can never appear without the
 * number of batches behind it — David's *"measured over N batches"*, made impossible to omit.
 */
export function batchTimeText(t: BatchTime): string {
  if (t.minutesPerBatch == null) {
    return t.untimedRuns === 0
      ? 'no batch has been timed yet'
      : `no batch has been timed yet — ${t.untimedRuns} build${t.untimedRuns === 1 ? '' : 's'} recorded without a start and finish`;
  }
  const runs = `measured over ${t.timedRuns} batch run${t.timedRuns === 1 ? '' : 's'}`;
  const held = t.untimedRuns > 0
    ? `; ${t.untimedRuns} other build${t.untimedRuns === 1 ? '' : 's'} carried no timing and ${t.untimedRuns === 1 ? 'is' : 'are'} not in this figure`
    : '';
  return `${t.minutesPerBatch} minutes a batch — ${runs}${held}`;
}
