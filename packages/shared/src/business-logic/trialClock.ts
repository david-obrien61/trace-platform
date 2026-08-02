// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Read a module's trial term out of `business_modules.config` and say how many days
//               are left. THE ONE READER of the `(trial_started_at, trial_days)` pair.
// DEPENDENCIES: none — a pure function over a config object and a clock.
// OUTPUTS:      trialDaysRemaining(config, now?) → number | null
//
// 🔴 IT READS THE STORED PAIR AND NEVER THE CATALOG. That is the 2026-08-01 snapshot ruling, and
// this is the function it was made for: `MODULE_CATALOG.trial_days` is THE OFFER (what a trial
// started today would be worth); `config.trial_days` is THE TERM GRANTED (what this tenant was
// actually given, on the day they were given it). Computing from the catalog would mean editing 30
// to 14 tomorrow retroactively expires every tenant seeded more than fourteen days ago, with no
// event marking it and nothing to appeal to. A tenant's terms are what they were given.
//
// ⚠️ WHY THIS IS IN `shared` AND NOT IN `useModules`, given it has ONE caller today: the marketplace
// (ITEM 3) reads the same pair to render the same number, and the rule above is the kind that gets
// re-derived differently the second time. One implementation is the whole point — the alternative
// is the dashboard and the marketplace disagreeing about how many days a customer has left, which
// is a disagreement about money.
//
// ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────────────────────────
// It does not decide ACCESS. Nothing here flips a lapsed module off; expiry is the fuzz and it is
// filed, not built. A trial that has run out keeps working until that lands, and this function
// reporting 0 is the only thing that currently notices.
//
// The URGENCY THRESHOLD — when a countdown should start reading alarming — is OWED (David's, filed
// 2026-08-02). This returns a NUMBER and takes no view; the caller decides how to paint it. Picking
// a threshold here would be answering a ruling by writing a constant, which is exactly the move the
// method forbids.

/** The shape this reads. Structurally what `business_modules.config` holds; unknown keys ignored. */
export interface TrialTerms {
  trial_started_at?: unknown;
  trial_days?: unknown;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Days remaining in a module's trial, or `null` when there is no trial to report on.
 *
 * 🔴 `null` AND `0` ARE DIFFERENT ANSWERS AND MUST STAY THAT WAY (D-9). `null` = this module is not
 * on a clock — it is core, or unpriced, or was never trialled. `0` = the trial is over. Collapsing
 * them would render "no trial" and "expired today" as the same pixel, which is the exact conflation
 * this whole build exists to undo one table over.
 *
 * A malformed or partial pair also returns `null` rather than a guess: a term with no start, a start
 * with no term, an unparseable date, or a non-positive term are all "we cannot say", and an honest
 * silence beats a fabricated number on a field that decides a bill.
 *
 * @param config the module row's `config` object (may be null — an unseeded/legacy row)
 * @param now    injectable for testing; defaults to the current time
 */
export function trialDaysRemaining(
  config: TrialTerms | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!config) return null;

  const startedRaw = config.trial_started_at;
  const daysRaw    = config.trial_days;

  if (typeof startedRaw !== 'string') return null;
  // The term must be a real positive number. `start_module_trial` refuses a non-positive term, so a
  // row carrying one is corrupt rather than expired — and reporting corrupt data as "0 days left"
  // would show a customer an expiry that nobody granted.
  if (typeof daysRaw !== 'number' || !Number.isFinite(daysRaw) || daysRaw <= 0) return null;

  const startedMs = Date.parse(startedRaw);
  if (Number.isNaN(startedMs)) return null;

  const endsMs    = startedMs + daysRaw * MS_PER_DAY;
  const remaining = (endsMs - now.getTime()) / MS_PER_DAY;

  // CEIL, so a trial with any time left at all reads as at least "1 day left" — never 0 while the
  // module still works. `0` is reserved for genuinely lapsed. The inclusive/exclusive boundary
  // David flagged bites at EXPIRY, not here: this function's job is to never claim a day that has
  // already gone, and never to claim zero on a module that is still live.
  return Math.max(0, Math.ceil(remaining));
}
