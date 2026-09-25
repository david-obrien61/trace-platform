// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Whether a stored coordinate may still be used, must be re-fetched, or should be
//               forgotten — the 30-day rule from Google's terms, as a function.
// DEPENDENCIES: none — pure. No network, no database, no clock of its own (`now` is passed in).
// OUTPUTS:      CACHE_DAYS · coordinateState() · needsRefresh() · isUsable().
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 THIS IS A COMPLIANCE MECHANISM WEARING THE CLOTHES OF A CACHE.
// ═════════════════════════════════════════════════════════════════════════════
// Google's terms (§6.3.1) permit lat/lng to be stored for 30 days. That is not a performance
// budget we may trade against — it is the condition under which we are allowed to hold the data
// at all. So the rule is expressed once, here, and every surface that touches a coordinate asks
// this function rather than comparing dates itself. A second copy of "is it older than 30 days"
// somewhere else is a second place that can drift to 31.
//
// DAVID'S RULING, 2026-09-22 — LAZY, NOT SWEPT:
//   · older than 30 days and USED AGAIN  → re-fetch, and the clock rolls forward
//   · older than 30 days and NEVER USED  → delete rather than keep
//   · no cron, no timer, NO 13th `api/` function (the ceiling is 12 of 12, §6 r11)
// The refresh IS the compliance: an address that matters keeps proving itself, and one that does
// not matter ages out. Nothing has to run on a schedule for that to be true.
//
// ⚠️ `now` IS AN ARGUMENT, NOT `Date.now()`. A function that reads the clock itself cannot be
// tested at a boundary, and this one's whole content IS a boundary. Every caller passes the same
// `new Date()` it already has.
// ─────────────────────────────────────────────────────────────────────────────

/** Google ToS §6.3.1 — the maximum a coordinate may be stored. Not tunable for convenience. */
export const CACHE_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export type CoordinateState =
  /** Never geocoded, or geocoding found nothing. There is no coordinate to use. */
  | 'absent'
  /** Stored, within 30 days — usable as it stands. */
  | 'fresh'
  /** Stored, past 30 days — must be re-fetched before use, or forgotten if it is not needed. */
  | 'expired';

export interface StoredCoordinate {
  latitude?: number | null;
  longitude?: number | null;
  geocoded_at?: string | Date | null;
}

function asDate(v: string | Date | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * What may be done with this stored coordinate right now.
 *
 * 🔴 A COORDINATE WITH NO TIMESTAMP IS `expired`, NOT `fresh`. If we cannot say WHEN we obtained
 * it we cannot say we are inside the 30 days, and the honest answer to "may we use this?" is no.
 * Treating an unknown age as fresh is how a cache rule quietly becomes optional — and the row
 * costs nothing to re-fetch, because that is exactly what the lazy refresh does anyway.
 */
export function coordinateState(row: StoredCoordinate, now: Date): CoordinateState {
  const lat = row.latitude, lng = row.longitude;
  if (typeof lat !== 'number' || typeof lng !== 'number' || Number.isNaN(lat) || Number.isNaN(lng)) return 'absent';
  const at = asDate(row.geocoded_at);
  if (!at) return 'expired';
  const ageDays = (now.getTime() - at.getTime()) / MS_PER_DAY;
  // A timestamp in the FUTURE is not fresh either — it means a clock disagreed somewhere, and
  // trusting it would hold the coordinate past 30 real days.
  if (ageDays < 0) return 'expired';
  return ageDays < CACHE_DAYS ? 'fresh' : 'expired';
}

/**
 * 🔴 HOW OLD IS THE **ANSWER**, regardless of whether it left a coordinate.
 *
 * `coordinateState` dates a COORDINATE, so a row with none is `absent` and can never be `fresh`.
 * But two of the three verdicts deliberately store no coordinate — `not_found` has none to store,
 * and `confirm` must not borrow Google's pin for the text the person kept. Dating those by
 * `coordinateState` would say "we have never checked this", which is false and has a cost in both
 * directions:
 *   · the person is asked about the same bad address on EVERY visit, which is the second question
 *     the whole step exists to prevent;
 *   · or, if the caller short-circuits without a clock, an address marked unplaceable in January
 *     is still unplaceable in December — 🔴 AND IN LIBERTY HILL THAT IS WRONG BY CONSTRUCTION,
 *     because 35% of its streets are new enough that the maps have not caught up yet. They do get
 *     built, and we must look again.
 *
 * So the 30-day clock (Google ToS §6.3.1) runs on WHEN WE LAST ASKED, which is what `geocoded_at`
 * has always recorded. An UNDATED answer is stale, for the same reason an undated coordinate is:
 * if we cannot say when we learned it, we cannot claim to be inside the window.
 */
export function answerIsFresh(row: StoredCoordinate, now: Date): boolean {
  const at = asDate(row.geocoded_at);
  if (!at) return false;
  const ageDays = (now.getTime() - at.getTime()) / MS_PER_DAY;
  if (ageDays < 0) return false;          // a clock disagreed; do not hold it past 30 real days
  return ageDays < CACHE_DAYS;
}

/** True when using this address requires fetching the coordinate again first. */
export function needsRefresh(row: StoredCoordinate, now: Date): boolean {
  return coordinateState(row, now) !== 'fresh';
}

/** True when the stored coordinate may be used as it stands — the only state that may be read. */
export function isUsable(row: StoredCoordinate, now: Date): boolean {
  return coordinateState(row, now) === 'fresh';
}

/**
 * The coordinate fields to write when a stored one has expired and the address is NOT being used
 * — David's "deleted if unused" half. Returned as a patch so the caller writes it through its
 * own writer rather than this module touching the database.
 *
 * ⚠️ `geocode_status` IS NOT CLEARED. Whether the address was ever findable is a fact about the
 * address, not about the coordinate's age — clearing it would make a known-bad address look
 * merely un-geocoded, and checkout would go back to pricing it.
 */
/**
 * 🔴 THE ADDRESS TEXT CHANGED, SO THE WHOLE VERDICT IS VOID — including `geocode_status`.
 *
 * ⚠️ THIS IS NOT `forgetCoordinatePatch`, AND THE DIFFERENCE IS THE POINT. That one is for a
 * coordinate that has EXPIRED: same address, stale pin, and it deliberately KEEPS the status
 * because whether that address was ever findable is still a fact about it. Here the address is a
 * DIFFERENT ADDRESS. A verdict earned by "770 County Road 284, Liberty Hill TE" says nothing
 * about "…TX", and keeping it means a corrected address stays condemned for thirty days by an
 * answer about a place that never existed.
 *
 * Found by David at the counter, 2026-09-25: he corrected a state from the truncation bug and the
 * address was still reported unfindable. A stored verdict applies ONLY to the exact text it was
 * checked for.
 */
export function forgetVerdictPatch(): { latitude: null; longitude: null; geocoded_at: null; geocode_status: null } {
  return { latitude: null, longitude: null, geocoded_at: null, geocode_status: null };
}

export function forgetCoordinatePatch(): { latitude: null; longitude: null; geocoded_at: null } {
  return { latitude: null, longitude: null, geocoded_at: null };
}
