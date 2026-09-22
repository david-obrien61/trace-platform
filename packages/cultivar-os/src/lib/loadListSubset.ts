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

// ── ONE SECTION PER TEAM (ledger #373, teams piece 4) ─────────────────────────────────────────
// 🔴 THE SAME MECHANISM, AS THIS FILE'S HEADER PREDICTED. `pickStops` already answered *which of the
//    day's stops does this sheet carry*; this answers *how are the carried stops grouped on it*. The
//    sheet still carries what Lauren ticked — grouping runs AFTER the pick, never instead of it, so
//    `stops=` and teams compose rather than competing for the same job.
// 🔴 AND THE ROLL-UP RULES ARE UNTOUCHED BY CONSTRUCTION. `buildLoadList` is pure over its input, so
//    a section's totals come from running the SAME builder over that section's stops — the allow-list
//    (resolveLoadItem step 0) and every roll-up rule are inherited, not re-stated. There is no
//    second arithmetic here and there must never be one (§6 r8, STD-011).

export interface TeamSection<T> {
  /** The team these stops belong to. `null` = the stops carrying NO team — a real state, printed. */
  teamId: string | null;
  stops: T[];
}

/**
 * Group the stops this sheet carries into one section per team, keeping the day's order inside each.
 *
 * 🔴 EVERY STOP APPEARS IN EXACTLY ONE SECTION — never dropped, never duplicated. That is the whole
 *    point: David's rule for the split sheet is that *"a stop left off every sheet is the real risk"*,
 *    and a silent omission here is that risk with a tidier surface. The stops with NO team are a
 *    SECTION, not a filter — they are exactly the ones nobody has claimed, so they are the ones most
 *    likely to be forgotten in the yard (D-9 / A9: absent is not empty).
 * 🔴 NO-TEAM GOES LAST, and it is deliberate: it reads as the remainder that still needs a decision,
 *    rather than as the first pile to load. The route page already REFUSES to route these ([[R-169]]).
 * ⚠️ Teams appear in the order they first appear in the day's order — NOT in the team list's order.
 *    This function is pure and takes no team list, so it cannot know `sort_order`; ordering by first
 *    appearance mirrors how the sheet is actually read and needs no second input. A RETIRED team, or
 *    one no longer listed, still gets its section — the stop carries it, so the paper must say so
 *    ([[R-133]]); naming it is the page's job via `teamLabel`, not this function's.
 */
export function groupStopsByTeam<T extends { id: string; team_id?: string | null }>(
  kept: readonly T[],
): TeamSection<T>[] {
  const byTeam = new Map<string, T[]>();
  const noTeam: T[] = [];
  for (const s of kept) {
    const id = s.team_id ?? null;
    if (id === null) { noTeam.push(s); continue; }
    const bucket = byTeam.get(id);
    if (bucket) bucket.push(s); else byTeam.set(id, [s]);
  }
  // Map preserves insertion order, which IS first-appearance order in the day's order.
  const sections: TeamSection<T>[] = [...byTeam.entries()].map(([teamId, stops]) => ({ teamId, stops }));
  if (noTeam.length > 0) sections.push({ teamId: null, stops: noTeam });
  return sections;
}

/**
 * Does this sheet show team sections at all?
 *
 * 🔴 A BUSINESS THAT NEVER SPLITS A DAY MUST SEE NO CHANGE — the same rule piece 2 holds as
 *    `route.unsplit-day-still-works`. When not one stop carries a team there is nothing to group by,
 *    so the sheet prints exactly as it did before teams existed: no headers, no sections, no
 *    "No team" caption telling a single-crew nursery about a feature it does not use.
 */
export function sheetIsSectioned<T extends { id: string; team_id?: string | null }>(
  sections: readonly TeamSection<T>[],
): boolean {
  return sections.some(s => s.teamId !== null);
}
