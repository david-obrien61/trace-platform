// ============================================================
// rungDatesRead — the ONE read behind the potted-on surfaces
//
// PURPOSE:      Every dated entry for a business's lots, in one place a probe can reach. The screen
//               holds no query (tech-debt #134: a render condition inside a .tsx cannot be asserted).
// DEPENDENCIES: ./supabase · @trace/shared/production (the field list and the sort live there — this
//               file adds the handle, nothing else).
// OUTPUTS:      loadRungDates · RungDatesRead.
// AC-1:         generic table, generic columns.
// ============================================================
import { supabase } from './supabase';
import { RUNG_DATE_SELECT, type RungDateRow } from '@trace/shared/production';

export type RungDatesRead =
  | { phase: 'loading' }
  // 🔴 FAILED AND EMPTY STAY DISTINGUISHABLE (`ui-control-standards.md` §6/R1). Empty is the NORMAL
  // case here — nobody has dated anything yet — so a failed read that rendered the same way would
  // be invisible forever, on the one screen whose whole job is to say what is missing.
  | { phase: 'failed'; message: string }
  | { phase: 'loaded'; byLot: Map<string, RungDateRow[]> };

export async function loadRungDates(businessId: string): Promise<RungDatesRead> {
  const { data, error } = await supabase
    .from('production_rung_dates')
    .select(RUNG_DATE_SELECT)
    .eq('business_id', businessId)
    .returns<RungDateRow[]>();

  if (error) {
    console.log('[TRACE:UPPOT] rung dates read failed', { businessId, code: (error as { code?: string }).code, message: error.message });
    // 42P01 = the table does not exist: the migration is written and not yet applied. The screen
    // says exactly that rather than "something went wrong", because the two need different actions.
    const missing = (error as { code?: string }).code === '42P01';
    return {
      phase: 'failed',
      message: missing
        ? 'The potting-date record is not set up yet — its migration has not been applied.'
        : `Could not read the potting dates — ${error.message}`,
    };
  }

  const byLot = new Map<string, RungDateRow[]>();
  for (const r of data ?? []) {
    const list = byLot.get(r.inventory_id);
    if (list) list.push(r); else byLot.set(r.inventory_id, [r]);
  }
  console.log('[TRACE:UPPOT] rung dates loaded', { businessId, lots: byLot.size, rows: (data ?? []).length });
  return { phase: 'loaded', byLot };
}
