// ============================================================
// positionStore — THE ONE WRITER of business_context, business_positions and
//                 business_position_responsibilities (20260831).
//
// PURPOSE:      Every read and every write of the three position tables. ONE FILE, because
//               `verify-write-paths` counts a write path as a FILE per TABLE and more than one
//               fails the build unless declared (2026-07-29 ruling) — and because the reason
//               behind that rule is the real one: a second writer is how a column list drifts.
// DEPENDENCIES: @supabase/supabase-js (client passed in — no module-level client, so the caller's
//               session and RLS decide everything) · utils/readResult.
// OUTPUTS:      readPositionWorkspace · savePositionContext · createPosition · updatePosition ·
//               deletePosition · setPositionResponsibilities.
//
// 🔴 EVERY WRITE PROVES IT WROTE (R-12, 2026-08-23). A PostgREST write that matches ZERO rows
//    returns SUCCESS WITH NO ERROR, so an RLS refusal reads as a save. That is not theoretical
//    here: a STAFF member holds `settings:read` and NOT `settings:update`, so every mutation in
//    this file is one a real session can be refused on — the exact shape #238 found silently
//    degrading the catalogue one variety at a time. So each write asks for the row back and
//    asserts the count is what it named, and returns a `reason` the surface must show.
//
// 🔴 EVERY READ KEEPS FAILED DISTINGUISHABLE FROM EMPTY (R-11). `ReadResult<T>` is a
//    discriminated union, so a caller cannot reach the value without handling the failure —
//    the compiler enforces it, not a convention. A business with no positions yet and a business
//    whose read was refused must never render as the same screen.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import { readOk, readFailed, type ReadResult } from '../utils/readResult';
import {
  BUSINESS_CONTEXT_COLUMNS, POSITION_COLUMNS, POSITION_RESP_COLUMNS,
} from './positionFields';
import type {
  BusinessContextRow, PositionRow, PositionResponsibilityRow, OperatingDayRow,
} from './positionFields';

// 🔴 THE READ CONTRACT LIVES IN `positionFields.ts`, NOT HERE — one declarative field list per
// record (E6), imported by every consumer. `moduleState.ts:47` paid for that lesson when the
// field-lists cap caught the marketplace hand-writing a second copy of four columns; this file
// starts where that one ended up.
export {
  BUSINESS_CONTEXT_COLUMNS, POSITION_COLUMNS, POSITION_RESP_COLUMNS,
} from './positionFields';
export type {
  BusinessContextRow, PositionRow, PositionResponsibilityRow, OperatingDayRow,
} from './positionFields';

export interface PositionWorkspace {
  context:          BusinessContextRow | null;
  positions:        PositionRow[];
  responsibilities: PositionResponsibilityRow[];
  operatingDays:    OperatingDayRow[];
  /** Active member headcount — COUNTED, never asked for. See the migration's §1 comment. */
  memberCount:      number;
}

/**
 * The outcome of a write. `applied` is the row count the write PROVED, never an inference from
 * the absence of an error. `reason` is present when the server refused and MUST be surfaced.
 */
export interface WriteOutcome {
  applied: boolean;
  reason:  string | null;
}

const REFUSED =
  'The save did not go through. Changing position descriptions needs the settings permission — ' +
  'ask the account holder.';

/**
 * 🔴 THE COUNT COMPARISON IS WRITTEN OUT AT EVERY SITE, NOT HIDDEN IN HERE, AND THAT IS
 * DELIBERATE. `verify-zero-row-writes` reads the 400 characters after each mutation statement
 * looking for the check; a helper that swallowed the comparison would leave every site reading
 * as NEEDS_CHECK — and the cap would be right, because it is exactly the shape tech-debt #127
 * describes: `SyncEngine`'s wrapper is ONE baselined entry and every caller inherits its
 * blindness invisibly. A funnel that hides a correct check today hides a missing one tomorrow.
 * So the site does the comparing and this only says what a person reads.
 */
function refusal(error: { message?: string } | null): WriteOutcome {
  return { applied: false, reason: error?.message ?? REFUSED };
}

// ── READ ────────────────────────────────────────────────────────────────────────────────────
/**
 * Everything the positions surface needs, in one pass. Five reads rather than five hooks, so a
 * partial failure is one failure the screen can name instead of four half-rendered panels.
 */
export async function readPositionWorkspace(
  sb: SupabaseClient,
  businessId: string,
): Promise<ReadResult<PositionWorkspace>> {
  const [ctx, pos, resp, days, members] = await Promise.all([
    sb.from('business_context').select(BUSINESS_CONTEXT_COLUMNS).eq('business_id', businessId).maybeSingle(),
    sb.from('business_positions').select(POSITION_COLUMNS).eq('business_id', businessId).order('title'),
    sb.from('business_position_responsibilities').select(POSITION_RESP_COLUMNS).eq('business_id', businessId),
    // Pattern rows only — a dated exception is a one-off and does not describe how the week runs.
    sb.from('business_operating_days').select('weekday, day_type').eq('business_id', businessId).not('weekday', 'is', null),
    sb.from('business_members').select('id', { count: 'exact', head: true }).eq('business_id', businessId).eq('active', true),
  ]);

  const failure = ctx.error ?? pos.error ?? resp.error ?? days.error ?? members.error;
  if (failure) return readFailed<PositionWorkspace>(failure);

  return readOk<PositionWorkspace>({
    context:          (ctx.data as BusinessContextRow | null) ?? null,
    positions:        (pos.data ?? []) as PositionRow[],
    responsibilities: (resp.data ?? []) as PositionResponsibilityRow[],
    operatingDays:    (days.data ?? []) as OperatingDayRow[],
    memberCount:      members.count ?? 0,
  });
}

// ── WRITE ───────────────────────────────────────────────────────────────────────────────────
export async function savePositionContext(
  sb: SupabaseClient,
  businessId: string,
  ctx: { whatWeDo: string | null; whoWeServe: string | null; knownFor: string | null },
): Promise<WriteOutcome> {
  // `business_id` is the PRIMARY KEY, so an upsert cannot mint a second row for one business.
  const { data, error } = await sb
    .from('business_context')
    .upsert({
      business_id:  businessId,
      what_we_do:   ctx.whatWeDo,
      who_we_serve: ctx.whoWeServe,
      known_for:    ctx.knownFor,
    }, { onConflict: 'business_id' })
    .select('business_id');
  if (error) return refusal(error);
  if ((data ?? []).length !== 1) return { applied: false, reason: REFUSED };
  return { applied: true, reason: null };
}

export async function createPosition(
  sb: SupabaseClient,
  businessId: string,
  title: string,
): Promise<{ outcome: WriteOutcome; position: PositionRow | null }> {
  const { data, error } = await sb
    .from('business_positions')
    .insert({ business_id: businessId, title: title.trim() })
    .select(POSITION_COLUMNS);
  if (error) return { outcome: refusal(error), position: null };
  if ((data ?? []).length !== 1) return { outcome: { applied: false, reason: REFUSED }, position: null };
  return { outcome: { applied: true, reason: null }, position: (data ?? [])[0] as PositionRow };
}

export async function updatePosition(
  sb: SupabaseClient,
  positionId: string,
  patch: { title?: string; excellenceNote?: string | null },
): Promise<WriteOutcome> {
  const row: Record<string, unknown> = {};
  if (patch.title !== undefined)          row.title = patch.title.trim();
  if (patch.excellenceNote !== undefined) row.excellence_note = patch.excellenceNote;
  // A patch with nothing in it is a caller bug, not a save. Saying so beats writing `{}` and
  // reporting a success the user did not ask for.
  if (Object.keys(row).length === 0) return { applied: false, reason: 'Nothing to save.' };

  const { data, error } = await sb
    .from('business_positions').update(row).eq('id', positionId).select('id');
  if (error) return refusal(error);
  if ((data ?? []).length !== 1) return { applied: false, reason: REFUSED };
  return { applied: true, reason: null };
}

export async function deletePosition(sb: SupabaseClient, positionId: string): Promise<WriteOutcome> {
  // The pick rows go with it by ON DELETE CASCADE — one statement, no orphan window.
  const { data, error } = await sb
    .from('business_positions').delete().eq('id', positionId).select('id');
  if (error) return refusal(error);
  if ((data ?? []).length !== 1) return { applied: false, reason: REFUSED };
  return { applied: true, reason: null };
}

/**
 * Replace a position's ticks with exactly `picks`.
 *
 * 🔴 `expectedExisting` IS NOT BOOKKEEPING — IT IS THE ONLY WAY THE CLEAR CAN PROVE IT HAPPENED.
 * `verify-zero-row-writes` classified the first version of this delete UNCHECKABLE and it was
 * right about a real defect, not just a missing `.select()`: a DELETE refused by RLS matches zero
 * rows and returns NO ERROR, and zero rows is ALSO the legitimate answer when a position had
 * nothing ticked. Those two are indistinguishable from inside this function. So a staff member
 * unticking everything would have been told "Saved." while the rows sat untouched — the silent
 * degradation of #238, arriving through a different door. The caller knows how many rows it
 * loaded, so it says so, and the delete asserts EXACTLY that number.
 *
 * ⚠️ TWO STATEMENTS, AND THE SEQUENCE IS NOT ATOMIC — stated rather than discovered later
 * (#69's class). The delete can land and the insert fail, which empties a position instead of
 * changing it. Mitigated the way #69 was: the delete is scoped to ONE position, the caller is
 * told which step stopped and that the earlier one is already permanent, and the operation is
 * IDEMPOTENT — re-running with the same picks converges. The durable fix is ONE RPC taking the
 * whole set as jsonb in a single plpgsql transaction; it is a MIGRATION and it is not this pass.
 */
export async function setPositionResponsibilities(
  sb: SupabaseClient,
  businessId: string,
  positionId: string,
  picks: ReadonlyArray<{ responsibilityId: string; frequency: string | null }>,
  expectedExisting: number,
): Promise<WriteOutcome> {
  const { data: cleared, error: delErr } = await sb
    .from('business_position_responsibilities').delete().eq('position_id', positionId).select('id');
  if (delErr) return refusal(delErr);
  if ((cleared ?? []).length !== expectedExisting) {
    return {
      applied: false,
      reason: expectedExisting === 0
        // Zero expected and rows came back: someone else edited this position since it loaded.
        ? 'Someone else changed this position while you had it open. Reload and try again.'
        : REFUSED,
    };
  }

  // Nothing ticked is a legitimate state — a position being drafted. The clear above is already
  // proven, so there is nothing left to assert and an empty insert would return zero rows and be
  // misread as a refusal by the exact-count check below.
  if (picks.length === 0) return { applied: true, reason: null };

  const { data, error } = await sb
    .from('business_position_responsibilities')
    .insert(picks.map((p) => ({
      business_id:       businessId,
      position_id:       positionId,
      responsibility_id: p.responsibilityId,
      frequency:         p.frequency,
    })))
    .select('id');
  if (error) return refusal(error);
  if ((data ?? []).length !== picks.length) {
    return {
      applied: false,
      // The clear already landed. Saying so is the difference between a person who re-saves and a
      // person who closes the tab believing their picks are intact.
      reason: `${REFUSED} The previous selections were cleared first, so re-save to restore them.`,
    };
  }
  return { applied: true, reason: null };
}
