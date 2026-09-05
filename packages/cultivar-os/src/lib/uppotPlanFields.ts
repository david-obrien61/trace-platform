// ============================================================
// uppotPlanFields — the ONE field list for a lot on the plan surface (E6).
//
// 🔴 A ZERO-DEP LEAF, DELIBERATELY. It was born inside `uppotPlanRead.ts` and moved out the moment
// its probe could not import it: that file pulls in the browser supabase client, so a test of the
// FIELD LIST could not run without a database handle. A list that cannot be asserted without
// standing up its consumer is a list nobody asserts — which is exactly how `VENDORS_SELECT` came
// to name 10 columns against a migration that creates 14 (tech-debt #179).
//
// The select string is DERIVED from the list, never typed beside it.
// ⚠️ A derived select is a plain `string`, so supabase-js loses row inference and every call site
// says `.returns<T[]>()`. Deriving costs the inference; that is cheaper than the defect.
// ============================================================

/**
 * Every column the planning model reads from `business_inventory`.
 *
 * A column the plan needs is added HERE and the query follows automatically.
 * `uppotPlanRead.test.ts` asserts both directions against the migration corpus.
 */
export const PLAN_LOT_FIELDS = [
  'id', 'name', 'sku', 'size', 'qty', 'location', 'status',
  'unit_kind', 'unit_value', 'unit_value_max', 'unit_name', 'unit_parsed_from',
  'retired_at',
] as const;

/** DERIVED, never typed twice. */
export const PLAN_LOT_SELECT = PLAN_LOT_FIELDS.join(', ');
