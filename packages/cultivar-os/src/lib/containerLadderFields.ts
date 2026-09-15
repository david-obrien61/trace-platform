// ============================================================
// containerLadderFields — the ONE field list for a rung on the ladder read (ledger #326).
//
// 🔴 A ZERO-DEP LEAF, DELIBERATELY, AND FOR A REASON THIS REPO HAS ALREADY PAID FOR ONCE.
// It was born inside `containerLadderRead.ts` and moved out the moment its probe could not import
// it: that file pulls in the browser supabase client, so a test of the FIELD LIST could not run
// without a database handle. A list that cannot be asserted without standing up its consumer is a
// list nobody asserts — which is exactly how `VENDORS_SELECT` came to name 10 columns against a
// migration that creates 14 (tech-debt #179).
//
// This is the same split, for the same reason, as `uppotPlanFields.ts` beside it — whose header
// records the identical lesson. The select string is DERIVED from the list, never typed beside it.
// ============================================================

/**
 * Every column the ladder reader needs from `container_ladder`.
 * A column the ladder needs is added HERE and the query follows automatically.
 * `containerLadderFields.test.ts` asserts both directions against the migration.
 */
export const LADDER_FIELDS = [
  'id', 'label', 'aliases', 'sort_order', 'volume_gallons',
  'handling_minutes', 'handling_because', 'active',
] as const;

/** DERIVED, never typed twice. */
export const LADDER_SELECT = LADDER_FIELDS.join(', ');
