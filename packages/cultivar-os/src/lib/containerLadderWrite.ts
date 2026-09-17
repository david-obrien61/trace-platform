// ============================================================
// containerLadderWrite — the writes behind Settings → Container sizes (ledger #343).
//
// PURPOSE:      Add a size, edit a size, move a size up or down, retire or restore a size. NOTHING
//               ELSE — there is no delete here and there is no delete policy on the table
//               (20260914_container_ladder.sql: *"NO DELETE POLICY OF ANY KIND. Retiring is an
//               UPDATE."*). David, 2026-09-15: *"Retire, never delete."*
//
// 🔴 PERMISSION IS THE DATABASE'S, NOT THIS FILE'S. Insert and update are gated server-side on
//   `is_active_member` AND `has_permission(…, 'settings:update')` by the two existing policies. No
//   permission string is minted. The screen hides nothing it cannot enforce: a reader without
//   `settings:update` sees the list read-only, and a forged write returns zero rows.
//
// 🔴 A WRITE THAT CHANGED NOTHING MUST NOT REPORT SUCCESS (E5, R-12, tech-debt #74). An update RLS
//   refuses returns NO error and NO row. Every write here selects back and counts.
//
// ⚠️ A MOVE IS THREE UPDATES, NOT ONE, AND THAT IS SAID RATHER THAN HIDDEN. `(business_id,
//   sort_order)` is a plain unique index, so two rungs cannot swap positions in one statement:
//   the first goes to a free parking position, the second takes its place, the first takes the
//   second's. If the sequence stops part-way the ladder is still VALID (every position unique) and
//   the moved size is simply parked at the end — the screen re-reads and shows exactly that. The
//   durable form is one RPC; not minted inside a settings screen (tech-debt #69's shape).
//
// 🔴 NO HISTORY MOVES. Nothing stores a reference to a rung: plans snapshot their numbers
//   (`production_plan_lines.from_unit_value`), orders keep their own size text, and the load list
//   is computed at print time. Editing a rung changes what is printed NEXT, never what was written.
//
// DEPENDENCIES: ./supabase · ./containerLadderDraft.
// OUTPUTS:      addRung · updateRung · setRungActive · moveRung.
// INSTRUMENTATION (STD-003): [TRACE:LADDER] — ON.
// ============================================================
import { supabase } from './supabase';
import { draftToRow, nextSortOrder, type RungDraft } from './containerLadderDraft';
import type { Ladder, Rung } from '@trace/shared/inventory';

interface LadderWriteOutcome { ok: boolean; message: string }

const refused = (what: string, error: { message: string } | null): LadderWriteOutcome => ({
  ok: false,
  message: error
    ? `${what} was not saved — ${error.message}. Nothing changed.`
    : `${what} was not saved: the write returned no row, which usually means permission was refused. Nothing changed.`,
});

export async function addRung(businessId: string, ladder: Ladder, draft: RungDraft): Promise<LadderWriteOutcome> {
  const row = { business_id: businessId, sort_order: nextSortOrder(ladder), ...draftToRow(draft) };
  const { data, error } = await supabase.from('container_ladder').insert(row).select('id');
  console.log('[TRACE:LADDER] add size', { businessId, label: row.label, sort_order: row.sort_order, landed: data?.length ?? 0, code: (error as { code?: string } | null)?.code });
  if (error || !data || data.length === 0) return refused(`"${row.label}"`, error);
  return { ok: true, message: `Added "${row.label}". Every picker, count and load list offers it from now on.` };
}

/** Keyed on the LABEL: unique per business by `container_ladder_business_label_key`, and it is the
 *  only identity a `Rung` carries (the reader does not hand ids to the planning model). */
export async function updateRung(businessId: string, rung: Rung, draft: RungDraft): Promise<LadderWriteOutcome> {
  const row = draftToRow(draft);
  const { data, error } = await supabase.from('container_ladder')
    .update(row).eq('business_id', businessId).eq('label', rung.label).select('id');
  console.log('[TRACE:LADDER] edit size', { businessId, was: rung.label, now: row.label, posts: row.install_t_posts_per_tree, landed: data?.length ?? 0 });
  if (error || !data || data.length === 0) return refused(`"${rung.label}"`, error);
  return { ok: true, message: `Saved "${row.label}". The next load list and plan use it; nothing already written changes.` };
}

export async function setRungActive(businessId: string, rung: Rung, active: boolean): Promise<LadderWriteOutcome> {
  const { data, error } = await supabase.from('container_ladder')
    .update({ active, retired_at: active ? null : new Date().toISOString() })
    .eq('business_id', businessId).eq('label', rung.label).select('id');
  console.log('[TRACE:LADDER] retire/restore size', { businessId, label: rung.label, active, landed: data?.length ?? 0 });
  if (error || !data || data.length === 0) return refused(`"${rung.label}"`, error);
  return {
    ok: true,
    message: active
      ? `"${rung.label}" is offered again.`
      : `"${rung.label}" is retired: it is no longer offered, and every old lot and order that names it still reads it.`,
  };
}

/** Swap a rung with its neighbour in ladder order. `direction` -1 = up (smaller), +1 = down (bigger). */
export async function moveRung(businessId: string, ladder: Ladder, rung: Rung, direction: -1 | 1): Promise<LadderWriteOutcome> {
  const ordered = [...ladder].sort((a, b) => a.sortOrder - b.sortOrder);
  const i = ordered.findIndex((r) => r.label === rung.label);
  const other = ordered[i + direction];
  if (i < 0 || !other) return { ok: false, message: `"${rung.label}" is already at the ${direction < 0 ? 'top' : 'bottom'}.` };

  const park = nextSortOrder(ladder) + 1000;
  const step = async (label: string, sort_order: number) => {
    const { data, error } = await supabase.from('container_ladder')
      .update({ sort_order }).eq('business_id', businessId).eq('label', label).select('id');
    return !error && !!data && data.length > 0 ? null : (error ?? { message: 'no row returned' });
  };
  const e1 = await step(rung.label, park);
  const e2 = e1 ? null : await step(other.label, rung.sortOrder);
  const e3 = e1 || e2 ? null : await step(rung.label, other.sortOrder);
  const failedAt = e1 ? 1 : e2 ? 2 : e3 ? 3 : 0;
  console.log('[TRACE:LADDER] move size', { businessId, label: rung.label, swappedWith: other.label, failedAt });
  if (failedAt === 1) return refused(`Moving "${rung.label}"`, e1);
  if (failedAt) {
    return {
      ok: false,
      message: `Moving "${rung.label}" stopped part-way (step ${failedAt} of 3). The sizes are still in a valid order — "${rung.label}" may now sit at the end. Check the list below and move it again.`,
    };
  }
  return { ok: true, message: `Moved "${rung.label}" ${direction < 0 ? 'above' : 'below'} "${other.label}".` };
}
