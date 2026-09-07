// ============================================================
// columnOrder — WHERE EACH PINNED TRACK GOES, as a pure function (PLATFORM — @trace/shared)
// PURPOSE:      G11's rule — **column order is ACTIONS · NAME · DATA** — decided in one place a
//               probe can reach. The layout it produces used to live inside `DataSheet.tsx` as
//               three `let`s and a loop between two JSX blocks, which is tech-debt #134's exact
//               shape: a rule inside a .tsx that no test can assert, so the only way to know the
//               order was to open the app and look. Extracted, it is 40 lines of arithmetic with
//               13 probes and a mutant board behind it.
// THE RULE:     the pinned segment reads, left to right —
//                 [G10 disclosure toggle] · [gutter marks] · [ACTIONS] · [IDENTIFIER] · [rest of
//                 the frozen run] · then the scrolling columns.
//               The actions track is inserted immediately BEFORE the column that declares
//               `identifier: true`. Every consumer inherits one order; none of them chooses.
// 🔴 WHY NOT "ACTIONS FIRST, ALWAYS": a per-row MARK is neither an action nor data, and it belongs
//               beside the row it marks. /inventory's flag glyph and G10's toggle are gutters; they
//               lead. Anything else ahead of the actions track is a divergence, and the grid-standard
//               probe fails it rather than letting a fourth shape appear.
// ⚠️ THE FALLBACK IS DELIBERATE AND IT IS THE SAFE DIRECTION: a grid whose identifier column is not
//               in the pinned run (or that declares none) puts ACTIONS FIRST in the pinned segment.
//               That is still ACTIONS-before-NAME, so a consumer that forgets the declaration gets
//               a conforming grid rather than a silently reordered one.
// DEPENDENCIES: none. No react, no dom, no styles — arithmetic over a column list.
// OUTPUTS:      a TrackPlan: the pinned tracks in render order with their accumulated `left`
//               offsets and reserved widths, plus the keys that scroll.
// ============================================================

/** The only column facts the plan needs. `DataSheetColumn` structurally satisfies it. */
export interface TrackColumn {
  key: string;
  frozen?: boolean;
  frozenWidth?: number;
  /** G11 — the record's identifier (Name / Invoice # / Item). Exactly one per grid. */
  identifier?: boolean;
}

export type TrackKind = 'expand' | 'actions' | 'column';

export interface PinnedTrack {
  kind: TrackKind;
  /** The column key, or the sentinel `__expand__` / `__actions__`. */
  key: string;
  left: number;
  width: number;
  /** The rightmost pinned track carries the freeze edge (the 1px line + shadow). */
  last: boolean;
}

export interface TrackPlan {
  /** Pinned tracks in render order, left to right. */
  pinned: PinnedTrack[];
  /** Keys of the columns that scroll, in order. */
  scrollKeys: string[];
}

/** §6 r14 — a frozen column with no declared width still reserves a deterministic track. */
export const DEFAULT_FROZEN_WIDTH = 160;

/**
 * Plan the pinned segment for one grid.
 *
 * @param cols          the SHOWN columns, in config order (hidden columns are already filtered out —
 *                      hiding the identifier must not silently move the actions track, and it does
 *                      not, because a hidden identifier simply falls back to actions-first).
 * @param expandWidth   width of G10's leading disclosure track, or null when the grid has no expansion.
 * @param actionsWidth  width of the pinned actions track, or null when the grid has no row actions.
 */
export function planTracks(
  cols: TrackColumn[],
  opts: { expandWidth?: number | null; actionsWidth?: number | null } = {},
): TrackPlan {
  const { expandWidth = null, actionsWidth = null } = opts;

  // G3 — only the LEADING contiguous run of frozen columns pins. A non-frozen column ends the run,
  // and every frozen column after it scrolls. (That is not a quirk to work around: it is what makes
  // the pinned block one contiguous strip. It is also how /inventory silently lost its pinned Name.)
  let firstScroll = 0;
  while (firstScroll < cols.length && cols[firstScroll].frozen) firstScroll++;
  const frozen = cols.slice(0, firstScroll);
  const scrollKeys = cols.slice(firstScroll).map(c => c.key);

  // G11 — the actions track goes immediately before the identifier column WITHIN the pinned run.
  // `-1` (no identifier pinned) means position 0: actions first. Never after.
  const idIdx = actionsWidth == null ? -1 : frozen.findIndex(c => c.identifier === true);
  const actionsAt = actionsWidth == null ? -1 : (idIdx === -1 ? 0 : idIdx);

  const pinned: PinnedTrack[] = [];
  let left = 0;
  const push = (kind: TrackKind, key: string, width: number) => {
    pinned.push({ kind, key, left, width, last: false });
    left += width;
  };

  if (expandWidth != null) push('expand', '__expand__', expandWidth);
  for (let i = 0; i < frozen.length; i++) {
    if (i === actionsAt) push('actions', '__actions__', actionsWidth!);
    push('column', frozen[i].key, frozen[i].frozenWidth ?? DEFAULT_FROZEN_WIDTH);
  }
  // A grid with row actions and NO frozen columns at all still gets its pinned actions track —
  // the loop above never ran, so nothing has emitted it. (When there IS a frozen run, `actionsAt`
  // is always a valid index into it, so the loop is the only emitter and this cannot double-push.)
  if (actionsWidth != null && frozen.length === 0) push('actions', '__actions__', actionsWidth);

  if (pinned.length) pinned[pinned.length - 1].last = true;
  return { pinned, scrollKeys };
}

/**
 * The G11 conformance of ONE grid's column list, as data. Used by the grid-standard probe and
 * available to any surface that wants to assert its own config.
 *
 * `ok` is false when a grid declares more than one identifier, or none at all — both are
 * configuration mistakes that produce a working screen, which is why nothing caught them.
 */
export function identifierOf(cols: TrackColumn[]): { key: string | null; count: number; ok: boolean } {
  const ids = cols.filter(c => c.identifier === true);
  return { key: ids[0]?.key ?? null, count: ids.length, ok: ids.length === 1 };
}
