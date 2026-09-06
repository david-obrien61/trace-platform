// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the ONE place that says what "a live inventory row" means. A retired row is HIDDEN,
//   and hiding is a property of every read, not of one grid.
// DEPENDENCIES: none (zero-dep leaf — a client page, a server handler and a shared resolver all
//   import it, and none of them may drag a transitive dep in).
// OUTPUTS: RETIRED_COLUMN · onlyLiveInventory · RETIRED_HIDDEN_NOTE.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY THIS FILE EXISTS: `retired_at` HAD NO READER AND THE COLUMN SHIPPED ANYWAY.
// ══════════════════════════════════════════════════════════════════════════════════════════
// `20260903_inventory_retire_lifecycle.sql` added the column on 2026-09-03 and `docs/RULINGS.md`
// R-70's own state cell says what was left undone: *"and so is the reader-side filter that hides
// a retired row."* Measured 2026-09-06: exactly ONE consumer read it (`uppotPlanRead.ts`), and
// its own comment says it filters on a column nothing writes. So retiring LAWNS's 447 rows would
// have left all 447 sitting on Lauren's grid beside the 647 new ones — **1,094 rows** where the
// ruling promised a clean catalogue. The column would have been correct and invisible.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 IT IS A FUNCTION, NOT A CONVENTION, BECAUSE THE FAILURE MODE IS A MISSING LINE.
// ══════════════════════════════════════════════════════════════════════════════════════════
// Nine hand-typed `.is('retired_at', null)` calls are nine chances to forget the tenth, and a
// forgotten one shows a hidden product on a screen with no error anywhere. One function means the
// next reader is one call, and a grep for its name enumerates every surface that hides a retired
// row — which is a question somebody will ask.
//
// ⚠️ AND IT IS DELIBERATELY NOT `status`. `status` already has two writers that overwrite each
// other (tech-debt #71: the D-42 quantity-derive and the D-52 tombstone), and every retired row
// has qty 0, so the derive would recompute a `retired` status to `depleted` and the rows would
// come back. The 20260903 migration says the same thing at greater length. `.neq('status', …)`
// filters that already exist on some readers are a DIFFERENT question (archived / deleted lots)
// and are left exactly as they are — this composes with them, it does not replace them.
// ─────────────────────────────────────────────────────────────────────────────

/** The column, named once so a grep finds every user of it. */
export const RETIRED_COLUMN = 'retired_at' as const;

/** The minimum a PostgREST filter builder has to offer. Typed structurally so this leaf never
 *  imports the supabase client type — the resolver, the API handlers and the pages all pass
 *  different concrete builder types and every one of them satisfies this. */
export interface LiveFilterable<T> { is(column: string, value: null): T; }

/**
 * Restrict a `business_inventory` query to rows that have NOT been retired.
 *
 * ⚠️ THIS HIDES; IT NEVER DELETES. A retired row is still there, still queryable by anything that
 * deliberately does not call this, and still recoverable — which is the whole reason retirement
 * is a timestamp rather than a DELETE (R-70 clause ①: *"retire, never hard-delete"*).
 */
export function onlyLiveInventory<T>(query: LiveFilterable<T>): T {
  return query.is(RETIRED_COLUMN, null);
}

/** The owner-facing sentence for a hidden row, in ONE place so no two surfaces word it
 *  differently (STD-011). Used wherever a count is shown that a retired row is absent from. */
export const RETIRED_HIDDEN_NOTE =
  'Products replaced by a QuickBooks import are hidden here, not deleted.';
