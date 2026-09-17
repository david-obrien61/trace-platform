// ============================================================
// stopProgress — the OFFICE door onto the one completion writer (ledger #347)
//
// PURPOSE:      David's ruling, 2026-09-17: *"the office's Mark done must behave like the crew's Done
//               — HOLD the review ask (never spend it) and be undoable — so both doors do the same
//               thing. One completion writer, registered with its path tests."*
//               So the schedule's Start / Mark done / Undo no longer write `deliveries` themselves.
//               They call `stop_act` (migration 20260917c §4b), which checks `deliveries:update`
//               server-side and then calls `stop_progress_apply` — the same function the crew link's
//               token door calls. Same columns, same event row, same audit row, same held ask.
// DEPENDENCIES: a Supabase client (Lauren's own session) · `./crewDayLink` for the refusal wording,
//               so the two doors say the same thing to two different people.
// OUTPUTS:      stopAct
//
// 🔴 WHAT CHANGED FOR THE PERSON: the review prompt no longer appears when the office marks a stop
//    done. The ask is HELD (`deliveries.review_ask_held_at`) and nothing sends it — a held ask can
//    still be asked later; an ask spent at a desk, days after the job, cannot be taken back.
// AC-1: no vertical noun. A stop is a stop.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { crewRefusalText, type CrewAction, type CrewStop } from './crewDayLink';

const TRACE_DELIVERY = true; // [TRACE:DELIVERY] STD-003 — ON until David owner-proves

type StopActResult =
  | { ok: true; changed: boolean; stop: CrewStop | null }
  | { ok: false; code: string; message: string };

/**
 * Start / Done / Undo / Note on a stop, as a logged-in member. `changed: false` means the stop was
 * already in that state — reported rather than dressed up as a write.
 */
export async function stopAct(
  db: SupabaseClient, businessId: string, stopId: string, action: CrewAction, note?: string,
): Promise<StopActResult> {
  const { data, error } = await db.rpc('stop_act', {
    p_business_id: businessId, p_stop_id: stopId, p_action: action, p_note: note ?? null,
  });
  if (error) {
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] stop_act failed', { action, stopId, code: (error as { code?: string }).code, message: error.message });
    // 🔴 THE DEPLOY-ORDER CASE, SAID IN WORDS RATHER THAN AS A MYSTERY FAILURE. If this build is live
    // before `20260917c` is applied, the function does not exist (PostgREST answers PGRST202) — and
    // marking a stop done is an EXISTING feature that would otherwise fail with a raw error. It names
    // the migration instead. (The migration should be applied BEFORE this code ships; this is the
    // belt for the window where it is not — the same care `20260916_container_ladder…` asked for.)
    if ((error as { code?: string }).code === 'PGRST202') {
      return { ok: false, code: 'needs_migration',
        message: 'Marking stops done needs the database update (20260917c) — it has not been applied yet.' };
    }
    return { ok: false, code: 'error', message: error.message };
  }
  const d = data as { ok: boolean; code?: string; message?: string; changed?: boolean; stop?: CrewStop | null };
  if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] stop_act', action, stopId.slice(0, 8), d?.ok ? (d.changed ? 'changed' : 'no change') : d?.code);
  if (!d?.ok) {
    const code = d?.code ?? 'error';
    return { ok: false, code, message: crewRefusalText(code, d?.message) };
  }
  return { ok: true, changed: !!d.changed, stop: d.stop ?? null };
}
