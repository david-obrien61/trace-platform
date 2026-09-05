// ============================================================
// uppotPlanRead — the ONE read behind the Uppot plan screen, and the ONE field list (E6).
//
// PURPOSE:      Everything the plan surface needs, in one place a probe can reach. The screen
//               itself holds no query and no column list — tech-debt #134 is that a render
//               condition inside a .tsx cannot be asserted, and #179 is that a hand-maintained
//               column list silently drops columns nobody reads.
//
// 🔴 THE SELECT IS DERIVED FROM THE FIELD LIST, NOT TYPED BESIDE IT (E6 / tech-debt #179).
//   `VENDORS_SELECT` named 10 columns while its migration created 14 — the four missing were the
//   address — under a comment that said "ONE LIST, TWO READERS, AND THAT IS THE WHOLE POINT",
//   true about its intent and false about its effect. A column with no reader and no writer is
//   invisible to tsc, eslint, knip and every probe. So the list below is the SOURCE and the
//   select string is computed from it.
//   ⚠️ A derived select is a plain `string`, so supabase-js loses row inference — every call site
//   says `.returns<T[]>()`. Deriving costs the inference; that is cheaper than the defect.
//
// 🔴 THE READ IS A DISCRIMINATED UNION, NOT A VALUE WITH A FALLBACK.
//   `ui-control-standards.md` §6/R1, binding since 2026-08-23: *"A READ WHOSE ERROR PATH RETURNS A
//   VALUE MUST KEEP 'FAILED' DISTINGUISHABLE FROM 'EMPTY.'"* This matters more here than almost
//   anywhere: 445 of LAWNS's 447 rows have never been counted, so an empty-looking plan is the
//   NORMAL case, and a failed read that rendered the same way would be invisible forever.
//
// DEPENDENCIES: ../lib/supabase · @trace/shared/production · @trace/shared/inventory (nothing here
//               re-derives a unit).
// OUTPUTS:      loadPlanLots · PlanLotsRead. (The field list is ./uppotPlanFields.)
// AC-1:         reads `business_inventory` generically; no vertical noun in any identifier.
// ============================================================
import { supabase } from './supabase';
import type { LotInput } from '@trace/shared/production';
import { fetchCommittedByLot } from './inventoryStates';
// The field list lives in its own zero-dep leaf so its probe can import it without a db handle.
import { PLAN_LOT_SELECT } from './uppotPlanFields';


interface PlanLotRow {
  id: string; name: string; sku: string | null; size: string | null;
  qty: number | null; location: string | null; status: string | null;
  unit_kind: string | null; unit_value: number | null; unit_value_max: number | null;
  unit_name: string | null; unit_parsed_from: string | null;
  retired_at: string | null;
}

export type PlanLotsRead =
  | { phase: 'loading' }
  | { phase: 'failed'; message: string }
  | {
      phase: 'loaded';
      lots: LotInput[];
      /** Population, so every count the screen prints can name what it counted. */
      totalRows: number;
      neverCounted: number;
      retiredHidden: number;
    };

/**
 * Read every live lot for a business, shaped for the planner.
 *
 * 🔴 RETIRED ROWS ARE EXCLUDED, and that filter is the reader-side half R-70 records as OWED:
 * *"the applier is OWED… and so is the reader-side filter that hides a retired row."* Nothing has
 * written `retired_at` yet (measured live at LAWNS 2026-09-05: 0 of 447), so today this filter
 * removes nothing — it is here so that the day the applier runs, a retired lot does not appear on
 * a planning screen as a thing somebody could pot. The count of what it hid is REPORTED rather
 * than silently applied, because a filter nobody can see is how a screen starts lying by omission.
 *
 * `qty` is passed through as NULL where it is null. It is never coerced to 0 — 445 of 447 rows at
 * LAWNS are exactly this case, and coercing would turn "we have not counted this" into "there are
 * none", which is A9's own sentence (*absent is not empty*) inverted on the one screen where the
 * distinction decides whether a plan can be made at all.
 */
export async function loadPlanLots(businessId: string): Promise<PlanLotsRead> {
  const { data, error } = await supabase
    .from('business_inventory')
    .select(PLAN_LOT_SELECT)
    .eq('business_id', businessId)
    .order('name', { ascending: true })
    .returns<PlanLotRow[]>();

  if (error) {
    console.log('[TRACE:UPPOT] plan lot read FAILED', { businessId, code: (error as any)?.code, message: error.message });
    return {
      phase: 'failed',
      message: `Could not read the catalogue — ${error.message}. This is a failed read, NOT an empty one: how many lots exist is unknown right now.`,
    };
  }

  const rows = data ?? [];
  const live = rows.filter((r) => r.retired_at == null);
  const committed = await fetchCommittedByLot(supabase, businessId);

  const lots: LotInput[] = live.map((r) => ({
    id: r.id,
    name: r.name,
    size: r.size,
    unitValue: r.unit_value,
    unitValueMax: r.unit_value_max,
    unitKind: r.unit_kind,
    unitName: r.unit_name,
    qty: r.qty,
    committed: committed.get(r.id) ?? 0,
    location: r.location,
    // 🔴 THESE FOUR ARE NOT ON `business_inventory` AND ARE NOT INVENTED HERE.
    // Sales-a-month is stage ④ (from QuickBooks history) and is not built; per-variety cover,
    // cushion and grow months are per-plan-line inputs the manager sets. NULL means "use the
    // configured default", which `splitLot` and `coverMonthsFor` handle explicitly. Defaulting
    // them to a number here would bury the fact that nobody has supplied one.
    salesPerMonth: null,
    coverMonths: null,
    cushionPct: null,
    growMonths: null,
  }));

  console.log('[TRACE:UPPOT] plan lots read', {
    businessId, totalRows: rows.length, live: live.length,
    retiredHidden: rows.length - live.length,
    neverCounted: live.filter((r) => r.qty == null).length,
    lotsCommitted: committed.size,
  });

  return {
    phase: 'loaded',
    lots,
    totalRows: rows.length,
    neverCounted: live.filter((r) => r.qty == null).length,
    retiredHidden: rows.length - live.length,
  };
}
