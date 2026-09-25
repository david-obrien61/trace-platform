// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      The bulk geocode as a RESUMABLE PLAN — what is left to do, what one batch does,
//               and what to tell the owner. Pure: no network, no React, no database.
// DEPENDENCIES: geocodeResult (the verdict — imported, never re-implemented).
// OUTPUTS:      planGeocodeRun() · applyOneResult() · runSummary() · GeocodeRunState.
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 NEVER BILLED TWICE, AND THE DATABASE IS WHAT GUARANTEES IT
// ═════════════════════════════════════════════════════════════════════════════
// The only rows selected are those with NO verdict (`geocode_status IS NULL`), and every outcome
// writes one. So a closed laptop, a lost connection or a second press resumes exactly where it
// stopped and re-spends nothing. There is no cursor file to go stale, no "already done" list to
// drift — the rows themselves are the progress.
//
// ⚠️ A ROW WE COULD NOT REACH KEEPS ITS NULL, deliberately. Writing `not_found` on a network
// failure would turn OUR outage into the customer's permanently-unpriced address (Rule 24, one
// layer out). It is simply retried next time.
// ─────────────────────────────────────────────────────────────────────────────
import { classifyGeocodeResponse, type GeocodeOutcome } from './geocodeResult';

export interface GeocodeRunState {
  /** Rows with no verdict yet — the work remaining. */
  remaining: number;
  located: number;
  needALook: number;
  cannotPlace: number;
  /** Reached this run and failed — kept NULL, retried next time. */
  unreachable: number;
}

export const EMPTY_RUN: GeocodeRunState = { remaining: 0, located: 0, needALook: 0, cannotPlace: 0, unreachable: 0 };

/** 25 QPS is Google's documented ceiling. 40ms between calls stays under it with room. */
export const GAP_MS = 40;
/** Small batches so a person can stop it, and so a closed tab loses at most this much. */
export const BATCH = 25;

export interface RunPlan {
  /** Should the caller ask for another batch? */
  more: boolean;
  /** How many to take next. */
  take: number;
  /** What the screen says while it works. */
  message: string;
}

export function planGeocodeRun(state: GeocodeRunState, stopped: boolean): RunPlan {
  if (stopped) return { more: false, take: 0, message: 'Stopped. Nothing is lost — press Locate to carry on.' };
  if (state.remaining <= 0) return { more: false, take: 0, message: 'Every address has been looked at.' };
  return {
    more: true,
    take: Math.min(BATCH, state.remaining),
    message: `${state.remaining} address${state.remaining === 1 ? '' : 'es'} left to look at…`,
  };
}

export interface OneResult {
  /** What to write, or null when nothing should be written (unreachable). */
  patch: { latitude: number | null; longitude: number | null; geocoded_at: string; geocode_status: 'found' | 'not_found' } | null;
  /** Belongs on Lauren's review list? */
  review: boolean;
  outcome: GeocodeOutcome | null;
}

/**
 * Turn one Google response into what the run writes.
 *
 * 🔴 A `confirm` IS NOT DECIDED BY A BATCH JOB. David's ruling: a tap is cheap, a wrong pin sends
 * a truck to the wrong place — and a bulk run has NOBODY TO ASK. So an interpolated or corrected
 * address is written NOT AT ALL and goes on Lauren's list instead. Storing Google's guess here
 * would be the machine answering a question that was designed for a person.
 */
export function applyOneResult(raw: unknown, now: Date, reachable = true): OneResult {
  if (!reachable) return { patch: null, review: false, outcome: null };
  const outcome = classifyGeocodeResponse(raw);
  const at = now.toISOString();
  if (outcome.verdict === 'found') {
    return { patch: { latitude: outcome.latitude, longitude: outcome.longitude, geocoded_at: at, geocode_status: 'found' }, review: false, outcome };
  }
  if (outcome.verdict === 'not_found') {
    return { patch: { latitude: null, longitude: null, geocoded_at: at, geocode_status: 'not_found' }, review: false, outcome };
  }
  return { patch: null, review: true, outcome };
}

/**
 * The sentence the owner reads. David asked for exactly this shape: "N located · M need a look".
 *
 * ⚠️ "NEED A LOOK" COUNTS BOTH the ones a person must confirm AND the ones that cannot be placed,
 * because both are work for a human and neither can be priced. Splitting them in the headline
 * would invite reading the smaller number as the whole problem.
 */
export function runSummary(s: GeocodeRunState): string {
  const look = s.needALook + s.cannotPlace;
  const parts = [`${s.located} located`, `${look} need a look`];
  if (s.unreachable > 0) parts.push(`${s.unreachable} could not be reached — they will be retried`);
  return parts.join(' · ');
}
