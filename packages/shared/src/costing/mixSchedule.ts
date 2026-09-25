// ============================================================
// mixSchedule — NEED IT BEFORE YOU NEED IT: the planned batches, day by day.
//
// PURPOSE:      David, 2026-09-25: *"project on hand minus scheduled install demand day by day; the
//               first day it drops below the minimum, plan enough batches due LEAD TIME earlier."*
//               This is the MRP **planned order release**, and it is the one piece of the arithmetic
//               that did not already exist.
//
// 🔴 IT DOES NOT COMPUTE DEMAND, AND MUST NEVER START. `mixRequirement` (same folder, ledger #370,
//    merged and live) already turns one day's lines into a needed-yards figure, through the container
//    ladder and the Operations keys. This module takes those PER-DAY ANSWERS as its input and does the
//    only thing they do not: carry stock forward across days and decide when to make more (§6 r8).
//
// 🔴 A PROJECTION FROM AN UNCOUNTED PILE IS A CONFIDENT FICTION, SO IT REFUSES. Every one of LAWNS's
//    mix rows is `qty_basis = 'placeholder'` — a catalogue-import seed, never a count. Subtracting real
//    demand from a seeded 10 produces a plan that looks exactly like a real one. `planMixBatches`
//    returns a REFUSAL naming the reason, and plans nothing, until somebody counts the pile once.
//    D-9 / A9 at the one place where guessing would be cheapest and most expensive.
//
// 🔴 AND A DAY WHOSE DEMAND COULD NOT BE READ IS NOT ZERO DEMAND. `neededYards: null` means the day
//    had lines nobody could size. Treating it as 0 would carry stock forward that will not be there.
//    Such a day stops the projection being trusted, and the plan says which day and why.
//
// DEPENDENCIES: none. PURE — no db, no clock (the horizon is passed in), no env, no numbers of its own.
// OUTPUTS:      DayDemand · PlannedBatch · ProjectedDay · MixSchedule · planMixBatches.
// AC-1: no vertical noun. Stock, demand, a minimum, a batch and a lead time.
// STORY: user_stories.md → *Is there enough mix for Saturday?*
// ============================================================

/** One day's demand, as `mixRequirement` already answers it. `null` = it could not be worked out. */
export interface DayDemand {
  /** ISO date, `YYYY-MM-DD`. The caller supplies the horizon; this module invents no days. */
  day: string;
  neededYards: number | null;
  /** Why it could not be worked out, when it could not. Carried through to the sentence. */
  problem?: string | null;
}

export interface PlannedBatch {
  /** The day the batches must be MADE — the shortfall day less the lead time. */
  dueOn: string;
  /** The day they are needed for, so a person can see what the batch is for. */
  neededFor: string;
  batches: number;
  yards: number;
  /** True when `dueOn` is before the first day of the horizon — you are already late. */
  alreadyLate: boolean;
}

export interface ProjectedDay {
  day: string;
  demandYards: number | null;
  /** Stock at the END of the day, after that day's demand and any batch that landed. Null once unknown. */
  closingYards: number | null;
  /** True when the day closes below the minimum and nothing was planned for it. */
  belowMinimum: boolean;
  batchesLanding: number;
}

export interface MixSchedule {
  /** The batches to make, in date order. Empty when nothing is needed — or when nothing can be planned. */
  planned: PlannedBatch[];
  projection: ProjectedDay[];
  /** The first day stock would close below the minimum without a batch. Null when it never does. */
  firstShortDay: string | null;
  minimumYards: number;
  batchYards: number;
  leadTimeDays: number;
  /** Set when NOTHING can be planned, and it says why. `planned` is then empty by construction. */
  refusal: string | null;
  /** Days whose demand could not be read. The plan is not trustworthy while this is non-empty. */
  unreadableDays: string[];
  /** One sentence for a screen — David's *"NEED MIX — stock low: N batches by <day>"*, or the refusal. */
  sentence: string;
}

const addDays = (iso: string, n: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = Date.UTC(y, m - 1, d) + n * 86400000;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`;
};
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The planned batches. Walks the horizon in order, carrying stock forward; whenever a day would close
 * below the minimum, it plans enough WHOLE batches to bring the close back to the minimum and dates
 * them `leadTimeDays` earlier. Several shortfalls produce several planned batches — a plan that covers
 * only the first dip is not a plan.
 */
export function planMixBatches(input: {
  /** Days in chronological order. The caller decides the horizon; this module does not invent one. */
  days: readonly DayDemand[];
  /** Yards on hand at the START of the horizon, and whether that figure is a COUNT. */
  onHandYards: number | null;
  onHandIsCounted: boolean;
  /** The per-business minimum to keep on the ground. LAWNS: 5 yd. */
  minimumYards: number;
  /** What ONE batch makes. LAWNS: 2.5 yd, from `item_recipes.yield_quantity`. */
  batchYards: number;
  /** Days before the need-by date the batch must exist. LAWNS: 2, already in Operations config. */
  leadTimeDays: number;
}): MixSchedule {
  const { days, onHandYards, onHandIsCounted, minimumYards, batchYards, leadTimeDays } = input;
  const base: Omit<MixSchedule, 'planned' | 'projection' | 'firstShortDay' | 'refusal' | 'sentence' | 'unreadableDays'> = {
    minimumYards, batchYards, leadTimeDays,
  };
  const empty = (refusal: string): MixSchedule => ({
    ...base, planned: [], projection: [], firstShortDay: null, refusal,
    unreadableDays: days.filter(d => d.neededYards == null).map(d => d.day),
    sentence: refusal,
  });

  // ── THE REFUSALS. Each one is a state in which a number would be a fiction. ────────────────
  if (onHandYards == null) {
    return empty('There is no on-hand figure for the mix, so nothing can be projected. Set up the mix item first.');
  }
  if (!onHandIsCounted) {
    return empty('The mix has never been counted — every figure on it is a catalogue placeholder. Count the pile once and this will plan itself; planning from a seed value would look exactly like a real plan.');
  }
  if (!(batchYards > 0)) {
    return empty(`A batch is recorded as making ${batchYards} yards, so no number of batches would help. Set what one batch makes on the recipe.`);
  }
  if (!(minimumYards >= 0)) {
    return empty(`The minimum to keep on hand is ${minimumYards}, which cannot be used.`);
  }
  if (days.length === 0) {
    return { ...base, planned: [], projection: [], firstShortDay: null, refusal: null, unreadableDays: [],
      sentence: 'Nothing is scheduled, so no mix is needed.' };
  }

  const unreadableDays = days.filter(d => d.neededYards == null).map(d => d.day);
  const horizonStart = days[0].day;
  const planned: PlannedBatch[] = [];
  const projection: ProjectedDay[] = [];
  let stock: number | null = onHandYards;
  let firstShortDay: string | null = null;

  for (const d of days) {
    // 🔴 AN UNREADABLE DAY BREAKS THE CHAIN RATHER THAN BEING TREATED AS ZERO. Once one day's demand
    // is unknown, every closing figure after it is unknown too, and the projection says so.
    if (d.neededYards == null || stock == null) {
      stock = null;
      projection.push({ day: d.day, demandYards: null, closingYards: null, belowMinimum: false, batchesLanding: 0 });
      continue;
    }

    let landing = 0;
    const closingBefore = round2(stock - d.neededYards);
    if (closingBefore < minimumYards) {
      if (firstShortDay == null) firstShortDay = d.day;
      const shortBy = minimumYards - closingBefore;
      landing = Math.ceil(round2(shortBy) / batchYards);
      const dueOn = addDays(d.day, -leadTimeDays);
      planned.push({
        dueOn, neededFor: d.day, batches: landing, yards: round2(landing * batchYards),
        alreadyLate: dueOn < horizonStart,
      });
      stock = round2(closingBefore + landing * batchYards);
    } else {
      stock = closingBefore;
    }
    projection.push({
      day: d.day, demandYards: d.neededYards, closingYards: stock,
      belowMinimum: stock < minimumYards, batchesLanding: landing,
    });
  }

  const totalBatches = planned.reduce((n, p) => n + p.batches, 0);
  const late = planned.filter(p => p.alreadyLate);
  let sentence: string;
  if (totalBatches === 0) {
    sentence = unreadableDays.length > 0
      ? `No mix is needed on what could be read — but ${unreadableDays.length} day(s) could not be worked out (${unreadableDays.join(', ')}), so this is not the whole picture.`
      : `Enough mix for everything scheduled — closing above the ${minimumYards} yard minimum every day.`;
  } else {
    const first = planned[0];
    sentence = `NEED MIX — stock low: ${first.batches} batch${first.batches === 1 ? '' : 'es'} by ${first.dueOn}`
      + (first.alreadyLate ? ` (that date has passed — make it as soon as you can)` : '')
      + ` for ${first.neededFor}`
      + (planned.length > 1 ? `, and ${totalBatches - first.batches} more later in the window` : '')
      + (unreadableDays.length > 0 ? `. ⚠️ ${unreadableDays.length} day(s) could not be worked out, so more may be needed` : '');
  }
  if (late.length > 0 && totalBatches > 0) { /* the sentence already names it on the first batch */ }

  return { ...base, planned, projection, firstShortDay, refusal: null, unreadableDays, sentence };
}
