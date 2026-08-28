// ============================================================
// orderRosterFilter — the orders roster's status filter, as pure functions.
// PURPOSE: chips, matching, and the "showing N of M" sentence for the orders page. Pure and
//   testable, so the rule that makes every row reachable is asserted by a test rather than
//   trusted to a component.
//
// 🔴 THE CHIP SET IS DERIVED, NEVER TYPED — AND IT IS DERIVED FROM TWO SOURCES, NOT ONE.
//   A hardcoded chip list is how a status drifts out of the filter and its rows become
//   unreachable. That happened on 2026-08-27 to `user_stories.md`: three stories carried
//   `needs-build`, a value absent from the renderer's <select>, so they matched none of the
//   six filters and were reachable only under "all" — an OWED state displayed as no state.
//   So the chips are ORDER_STATUSES (the vocabulary) UNIONED WITH every status actually
//   present in the loaded rows (the data). The vocabulary alone would repeat that defect
//   the moment the data holds a value the enum does not; the data alone would make a
//   legitimate empty status vanish from the UI entirely. Both, not either.
//
// DEPENDENCIES: ./orderStatus (ORDER_STATUSES, orderStatusMeta, isOrderStatus).
// OUTPUTS: rosterStatusChips, filterOrdersByStatus, rosterCountLabel, ROSTER_PAGE_LIMIT.
// ============================================================
import { ORDER_STATUSES, orderStatusMeta, isOrderStatus } from './orderStatus';

/** The roster's page size. Named here because the COUNT SENTENCE has to know about it —
 *  a total that is silently a cap is a number that lies (see rosterCountLabel). */
export const ROSTER_PAGE_LIMIT = 50;

interface StatusChip {
  value: string;
  label: string;
  /** How many loaded rows carry this status. Zero is legitimate and still renders. */
  count: number;
  /** False for a value present in the data but absent from ORDER_STATUSES. Rendered so the
   *  owner can SEE that the vocabulary and the data disagree, rather than the row silently
   *  having no home. */
  known: boolean;
}

interface HasStatus { status: string | null | undefined }

/**
 * The chips, in a stable order: the canonical four first (in ORDER_STATUSES order, so the
 * lifecycle reads left to right), then any unrecognised value the data actually holds,
 * alphabetically. A row can therefore never be unreachable — if it exists, a chip selects it.
 */
export function rosterStatusChips(rows: readonly HasStatus[]): StatusChip[] {
  const counts = new Map<string, number>();
  for (const r of rows) {
    const key = String(r.status ?? '');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const canonical: StatusChip[] = ORDER_STATUSES.map((s) => ({
    value: s,
    label: orderStatusMeta(s).label,
    count: counts.get(s) ?? 0,
    known: true,
  }));

  const strays: StatusChip[] = [...counts.keys()]
    .filter((k) => !isOrderStatus(k))
    .sort()
    .map((k) => ({
      value: k,
      label: orderStatusMeta(k).label,
      count: counts.get(k) ?? 0,
      known: false,
    }));

  return [...canonical, ...strays];
}

/**
 * Apply the selection. An EMPTY selection means ALL — not "none".
 *
 * That choice is deliberate and it is the difference between a filter and a trap: the
 * default view shows everything (David's ruling — Lauren's habit is the current screen, and
 * a default that hides rows on day one is how someone concludes an order vanished), and
 * clearing the last chip returns to that default rather than emptying the screen.
 */
export function filterOrdersByStatus<T extends HasStatus>(
  rows: readonly T[], selected: ReadonlySet<string>,
): T[] {
  if (selected.size === 0) return [...rows];
  return rows.filter((r) => selected.has(String(r.status ?? '')));
}

/**
 * The count sentence. Follows DataSheet.tsx:296's pattern rather than inventing a second one.
 *
 * 🔴 IT NAMES THE PAGE CAP, WHICH THE ROSTER NEVER DID. The query is `.limit(50)`, and the
 * header has always read "N recent checkouts" — at the cap that sentence is false, and
 * "showing N of M" would inherit the lie by reporting a total that is really a ceiling. When
 * the loaded set is exactly the cap we say "of 50+" and mean it: there may be more orders
 * this screen has not seen, and the owner is entitled to know that before concluding one is
 * missing. (D-9: an honest "unknown", never a fabricated total.)
 */
export function rosterCountLabel(shown: number, loaded: number, filtering: boolean): string {
  const total = loaded >= ROSTER_PAGE_LIMIT ? `${loaded}+` : `${loaded}`;
  if (!filtering) return `${loaded} order${loaded === 1 ? '' : 's'}${loaded >= ROSTER_PAGE_LIMIT ? ' (most recent 50)' : ''}`;
  return `showing ${shown} of ${total}`;
}
