/**
 * ── DELIVERY LIST WINDOW — which stops the schedule asks the database for ────────────────────
 *
 * PURPOSE      Decide the DATE BOUND of the `deliveries` read behind `<DeliverySchedule>`: one
 *              exact day when the calendar has a day selected, otherwise a rolling window of
 *              recent-plus-future work. Pure: a date in, a bound out. No supabase, no clock of
 *              its own — `now` is passed so the boundary is testable rather than untestable.
 * DEPENDENCIES none.
 * OUTPUTS      `DeliveryQueryBounds` — `{kind:'day'}` or `{kind:'window'}` — plus the ISO helper
 *              the window is built from.
 *
 * 🔴 WHY THIS EXISTS. `DeliverySchedule` read `deliveries` with NO date bound at all —
 * `.order('delivery_date', ascending).limit(200)` — and then filtered the selected day CLIENT-SIDE
 * (`rows.filter(r => r.delivery_date === filterDate)`). With ~26 rows in the table that is
 * indistinguishable from correct. It is not correct, and the history import is what makes the
 * difference visible: 564 past stops all sort BEFORE the nineteen future ones, so the oldest 200
 * fill the page and
 *
 *   ① the nineteen ingested stops and Saturday 2026-08-29's six vanish from the list, and
 *   ② — worse, and not what the Stage 0 recon first predicted — SELECTING ANY DAY on the
 *      operations calendar outside those oldest 200 returns EMPTY. The drill-in would say
 *      "Nothing scheduled on this day" for a day that has stops, because the client filter can
 *      only ever narrow what the query already fetched.
 *
 * ② is the serious one: that drill-in is the surface the fulfilment tap and `openOrderNotice`
 * mount on, and a screen that reports absence it has not established is the failure mode the whole
 * six-state ruling exists to prevent. A `filterDate` must therefore reach the QUERY.
 *
 * ⚠️ THE WINDOW KEEPS UNDATED STOPS. `delivery_date` is nullable and the list deliberately groups
 * undated rows last, so a bare `.gte()` would silently drop a state the UI already handles. The
 * caller pairs this bound with an `is null` alternative for exactly that reason.
 */

/** How far back the unfiltered list reaches. Recent enough that a stop made last week is still
 *  markable, short enough that fourteen months of imported history never crowds out this week. */
export const DELIVERY_LIST_PAST_DAYS = 30;

/** Internal, deliberately NOT exported: nothing outside this module needs to NAME the shape, and
 *  an exported type with no cross-module consumer is dead surface the knip gate correctly counts. */
type DeliveryQueryBounds =
  /** A day is selected on the calendar: ask for THAT DAY, at any distance in the past. */
  | { kind: 'day'; date: string }
  /** No day selected: the working list — everything from `from` forward, plus undated stops. */
  | { kind: 'window'; from: string; pastDays: number };

/**
 * `days` before `now`, as `YYYY-MM-DD`, in the VIEWER'S OWN timezone.
 *
 * 🔴 LOCAL, NOT UTC, AND THAT IS THE WHOLE POINT. `delivery_date` is a plain `date` — a calendar
 * day a crew works, not an instant. Building the bound from `toISOString()` would shift the
 * boundary by a day for anyone west of UTC, which is every user this platform has (Texas).
 */
export function isoDaysBefore(now: Date, days: number): string {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  d.setDate(d.getDate() - days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function deliveryQueryBounds(
  filterDate: string | null | undefined,
  now: Date,
  pastDays: number = DELIVERY_LIST_PAST_DAYS,
): DeliveryQueryBounds {
  // A selected day is asked for BY DATE and is never clamped to the window — the calendar can
  // reach March 2025, and a drill-in that silently returned nothing there would be the defect
  // this file was written to remove, reintroduced one layer down.
  if (filterDate) return { kind: 'day', date: filterDate };
  return { kind: 'window', from: isoDaysBefore(now, pastDays), pastDays };
}
