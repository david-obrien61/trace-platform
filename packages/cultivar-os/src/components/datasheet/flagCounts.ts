// ============================================================
// flagCounts — the DataSheet engine's rule for "how many flagged rows is the owner LOOKING AT?"
//
// PURPOSE:      A flag banner describes the rows ON SCREEN. The engine counted flagged rows over
//               the FULL row set and rendered the number over whatever the filter had narrowed to,
//               so a filtered-clean view still shouted a red banner about a defect somewhere else
//               entirely. Live 2026-07-16: David filtered /inventory to "alley" — 4 of 123 shown,
//               sizes 15/30/45/60, all distinct, all grouped, ZERO collisions — and the banner read
//               "2 size collisions … Edit the size or variant group on a flagged row to fix it."
//               That was Acoma's collision, rendered over four clean rows, telling him to edit a
//               flagged row when no row on screen was flagged.
//
//               D-9 INVERTED: it does not fabricate a value, it MIS-ATTRIBUTES a real one — which is
//               the same dishonesty wearing the other face. The number was true; the place was a lie.
//
// DEPENDENCIES: none (zero-dep leaf, no React) — so the rule is testable without mounting a grid.
//               That is the whole reason it is a module and not a memo: the defect lived inside a
//               useMemo, where no test could reach it (the D-49 lesson, one layer up).
// OUTPUTS:      partitionFlagged(all, view, isFlagged, getRowId) → { inView, elsewhere }.
// CALLERS:      DataSheet.tsx (the flag banner). Consumers pass the copy; the engine passes BOTH
//               counts so a banner can say "here" and "elsewhere" as two different, honest facts.
// ============================================================

/** Flagged-row counts split by what the current filter/search actually shows.
 *  `inView` — flagged rows the owner can see and act on right now.
 *  `elsewhere` — flagged rows hidden by the active filter/search. Never conflate the two: a banner
 *  that adds them together and says "here" is the defect this module exists to prevent. */
interface FlagPartition {
  inView:    number;
  elsewhere: number;
}

/**
 * Split flagged rows into what the view shows vs what the filter hides. Pure.
 *
 * `isFlagged` is deliberately evaluated against the FULL row set, not the view: a collision is a
 * fact about the catalog, not about the filter, so a row must not stop being flagged just because
 * its twin scrolled out of view. What the filter changes is only WHERE the flagged rows are — which
 * is exactly the fact this returns.
 */
export function partitionFlagged<T>(
  all: T[],
  view: T[],
  isFlagged: (r: T) => boolean,
  getRowId: (r: T) => string,
): FlagPartition {
  const flagged = all.filter(isFlagged);
  if (flagged.length === 0) return { inView: 0, elsewhere: 0 };
  const shown = new Set(view.map(getRowId));
  const inView = flagged.filter(r => shown.has(getRowId(r))).length;
  return { inView, elsewhere: flagged.length - inView };
}
