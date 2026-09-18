// ============================================================
// loadListSubset — WHICH of the day's stops one printed load sheet carries (ledger #354)
//
// PURPOSE:      David, 2026-09-18, from LAWNS: *"TWO CREWS SATURDAY, and the load list cannot be
//               split."* The sheet read every stop on the date, so Lauren split one sheet by hand.
//               This picks the stops a sheet carries: the whole day, or the ones she ticked. The page
//               hands ONLY the kept stops to `buildLoadList`, which is pure over its input — so every
//               total (mix, posts, rope, kits, bubblers, trunk protection, the floor warning, the
//               could-not-work-out lines) is for those stops only, and the day's totals are never
//               computed on a crew's sheet at all.
// DEPENDENCIES: none — pure.
// OUTPUTS:      parseStopsParam · pickStops · stopsParamFor
//
// 🔴 THE SAME MECHANISM TEAMS WILL USE (tech-debt #345). A team's sheet is "these stops of the day"
//    too; when a stop carries its team, the page picks by team instead of by tick. Only WHO chooses
//    changes — this function does not.
// 🔴 A STOP LEFT OFF EVERY SHEET IS THE REAL RISK, so a partial sheet names the stops it does NOT
//    carry (`leftOff`); two crews' sheets side by side then account for the whole day.
// 🔴 AN ID THAT IS NOT ONE OF THIS DAY'S STOPS IS REFUSED AND NAMED, never silently dropped — a link
//    kept from another day must not print as a short sheet that looks complete.
// AC-1: no vertical noun. A stop is a stop.
// ============================================================

/** The `stops=` value of the page's address. `null` = the parameter is absent = the WHOLE day.
 *  Present but empty = a sheet with no stops chosen (the page says so; it does not fall back to the day). */
export function parseStopsParam(raw: string | null | undefined): string[] | null {
  if (raw == null) return null;
  const seen = new Set<string>();
  for (const part of raw.split(',')) {
    const id = part.trim();
    if (id) seen.add(id);
  }
  return [...seen];
}

interface StopPick<T> {
  /** The stops this sheet carries, in the DAY's order (the saved route order), never the link's order. */
  kept: T[];
  /** The day's stops this sheet does NOT carry — printed by name on a partial sheet. */
  leftOff: T[];
  /** Ids in the link that are not this day's stops — refused, and named on the sheet. */
  unknown: string[];
  /** True when the sheet is anything other than the whole day. */
  isSubset: boolean;
}

/** Split the day's stops into the ones this sheet carries and the ones it does not. */
export function pickStops<T extends { id: string }>(day: readonly T[], requested: string[] | null): StopPick<T> {
  if (requested === null) return { kept: [...day], leftOff: [], unknown: [], isSubset: false };
  const want = new Set(requested);
  const onDay = new Set(day.map(s => s.id));
  const kept = day.filter(s => want.has(s.id));
  const leftOff = day.filter(s => !want.has(s.id));
  const unknown = requested.filter(id => !onDay.has(id));
  // Every one of the day's stops ticked, and nothing foreign: that IS the whole day.
  const isSubset = leftOff.length > 0 || unknown.length > 0;
  return { kept, leftOff, unknown, isSubset };
}

/** The `stops=` value for a set of ticked stops. `null` (drop the parameter) when every stop of the
 *  day is ticked, so "all ticked" and "no parameter" are one sheet, not two that could differ. */
export function stopsParamFor(dayIds: readonly string[], ticked: ReadonlySet<string>): string | null {
  const kept = dayIds.filter(id => ticked.has(id));
  if (kept.length === dayIds.length) return null;
  return kept.join(',');
}
