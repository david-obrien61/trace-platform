// ============================================================
// dashboardWindows — WHEN a dashboard metric counts, and WHAT the add-on banner may claim
// ============================================================
// PURPOSE:      The date windows the dashboard tiles filter on, and the state selection for the
//               add-on banner. Extracted from Dashboard.tsx so both can be tested: the window
//               math has an off-by-one at every boundary, and the banner makes a CLAIM about the
//               business that must never outrun what was measured.
// DEPENDENCIES: none — pure. Takes `now` as an argument so a test can stand anywhere in time.
// OUTPUTS:      ymd · dayWindow · weekWindow · addOnBannerState.
// ============================================================

/** Local calendar date as 'YYYY-MM-DD'. Local, NOT UTC: a business's week starts where it
 *  stands, and toISOString() would roll a late-evening sale into tomorrow west of Greenwich. */
export function ymd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// NOT exported — and deliberately, matching `holdsCommitment` in inventoryStates.ts. Callers want
// the WINDOW (which the exported functions return, fully inferred), not the ability to name its
// type and hand-build one. Exporting it would invite a second, hand-rolled window at a call site,
// which is the drift this module exists to prevent. Promote when a real consumer needs to name it.
interface Window { startDate: string; endDate: string; startIso: string; endIso: string }

function windowFrom(start: Date, days: number): Window {
  const s = new Date(start); s.setHours(0, 0, 0, 0);
  const e = new Date(s); e.setDate(e.getDate() + days);
  return { startDate: ymd(s), endDate: ymd(e), startIso: s.toISOString(), endIso: e.toISOString() };
}

/** Today, half-open [start, end). */
export function dayWindow(now: Date = new Date()): Window {
  return windowFrom(now, 1);
}

/**
 * The current week, Sunday-based, half-open [start, end).
 *
 * 🔴 THE END BOUND IS THE FIX. The install query was `gte(weekStart)` with NO upper limit, so
 * "this week" silently meant "this week and every week after it" — a planting booked for
 * September counted as an install done this week. Half-open, not inclusive, so a delivery dated
 * exactly next Sunday belongs to next week and is never counted twice.
 */
export function weekWindow(now: Date = new Date()): Window {
  const s = new Date(now); s.setDate(s.getDate() - s.getDay());
  return windowFrom(s, 7);
}

type AddOnBannerState = 'error' | 'no-sales' | 'none-assessable' | 'leaking' | 'clean';

interface AddOnInput {
  readFailed: boolean;
  /** every non-cancelled sale dated in the window, of any kind */
  salesInWindow: number;
  /** those the platform can actually judge — a transcribed document line has no container size */
  assessableSales: number;
  /** assessable sales that came up short */
  leakingSales: number;
}

/**
 * 🔴 WHY THIS IS A FUNCTION AND NOT A TERNARY — §6 r18. A section header is a CLAIM the reader
 * applies to everything beneath it, and this banner made the strongest claim on the page —
 * "Every large-container sale included an add-on" — as the `else` of ONE condition
 * (`leakageCount > 0`). Two states cannot describe four situations, so the else-branch absorbed
 * every situation nobody enumerated: a week with no sales at all certified a universal positive
 * over an EMPTY SET, and a week of captured invoices would have certified six real sales whose
 * add-ons were never assessed. Both are the same failure — a claim asserted where nothing was
 * measured (D-9 / A9).
 *
 * Ordered most-specific first, and every branch is reachable:
 *   error           — the read failed. Says so. NOT a clean bill of health.
 *   no-sales        — nothing was sold in the window, so nothing could have been missed.
 *   none-assessable — sales exist but none could be judged (all captured from documents).
 *   leaking         — the alert this feature exists for.
 *   clean           — the only branch entitled to a positive, and it must name its denominator.
 */
export function addOnBannerState(x: AddOnInput): AddOnBannerState {
  if (x.readFailed) return 'error';
  if (x.salesInWindow === 0) return 'no-sales';
  if (x.assessableSales === 0) return 'none-assessable';
  if (x.leakingSales > 0) return 'leaking';
  return 'clean';
}
