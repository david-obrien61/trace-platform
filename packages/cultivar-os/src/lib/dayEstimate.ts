// ============================================================
// dayEstimate — reading the capacity estimate's inputs, and SNAPSHOTTING it (ledger #375)
//
// PURPOSE:      The arithmetic is in `capacityEstimate.ts` and is pure. This is the part that
//               touches the world: where the inputs come from, and writing the snapshot David
//               asked for — *"at route save AND when day inputs change: append-only, never
//               rewritten when a setting changes."*
//
// 🔴 TREES ARE COUNTED ONCE, BY THE LOAD MODEL. `buildLoadList` already resolves every line to a
//    tree on a container-ladder rung, and the load sheet is the surface people check that count
//    against. Counting trees a second time here would be two answers to one question (§6 r8 /
//    STD-011), and the copy that drifts is the one nobody prints.
// 🔴 THE SNAPSHOT CARRIES ITS SETTINGS, NOT A POINTER TO THEM. That is what makes it a record.
//    Change X tomorrow and yesterday's row still says what yesterday was measured against.
//
// DEPENDENCIES: ./capacityEstimate (pure) · ./loadList (the day's trees) · a Supabase client.
// OUTPUTS:      inputsFromLoadModel · settingsFromConfig · snapshotEstimate · recordTeamChoice
// ⚠️ A `readLatestEstimate` was written here and DELETED before commit: nothing called it. The
//    panel already holds the id of the snapshot it just wrote, so a re-read was a function
//    existing on the assumption a future screen would want it — which is the placeholder §6 r2
//    forbids, and knip counted it. It is three lines to write again when a caller exists.
// AC-1: no vertical noun.
// ============================================================
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LoadListModel } from './loadList';
import { estimateDay, type CapacityEstimate, type CapacityInputs, type CapacitySettings } from './capacityEstimate';

const TRACE_CAPACITY = true; // [TRACE:CAPACITY] STD-003 — ON until David owner-proves

type Result<T> = { ok: true; value: T } | { ok: false; code: string; message: string };

/**
 * The day's inputs, taken from the load model and the saved route.
 *
 * ⚠️ `gallons` is NULL when ANY tree's size could not be read — not a partial sum. A partial total
 * presented as a total is the defect D-9 exists for; "not known" is the honest answer and the
 * estimate prints it that way.
 */
export function inputsFromLoadModel(
  model: LoadListModel, route: { minutes: number | null; miles: number | null } | null,
): CapacityInputs {
  const anyUnknown = model.trees.some(t => t.gallons == null) || model.noVolumeTrees.length > 0;
  const gallons = anyUnknown ? null : model.trees.reduce((n, t) => n + (t.gallons ?? 0) * t.quantity, 0);
  return {
    stops: model.stopCount,
    trees: model.treeCount,
    gallons,
    driveMinutes: route?.minutes ?? null,
    miles: route?.miles ?? null,
  };
}

/** The two per-business figures, out of the Operations config that already exists. */
export function settingsFromConfig(config: Record<string, unknown> | null, defaults: {
  dayHoursBeforeSecondTeam: number; plantingMinutesPerTree: number;
}): CapacitySettings {
  const x = config?.dayHoursBeforeSecondTeam;
  const m = config?.plantingMinutesPerTree;
  const hasX = typeof x === 'number' && x > 0;
  const hasM = typeof m === 'number' && m >= 0;
  return {
    dayHoursBeforeSecondTeam: hasX ? x as number : defaults.dayHoursBeforeSecondTeam,
    plantingMinutesPerTree:   hasM ? m as number : defaults.plantingMinutesPerTree,
    // Only "set" when BOTH came from the nursery. A half-set pair reported as set would let one
    // platform default hide behind one real setting.
    fromSettings: hasX && hasM,
  };
}

/**
 * Write one snapshot. `reason` says why it exists — 'route_save' or 'inputs_changed'.
 *
 * ⚠️ A FAILED SNAPSHOT MUST NEVER BLOCK THE DAY. Routing and planning are the real work; recording
 * an estimate is bookkeeping beside it. The caller surfaces the refusal (it is not swallowed) but
 * does not stop on it — §6 r6's rule, that an integration failure never blocks an order, applied
 * to our own table.
 */
export async function snapshotEstimate(
  db: SupabaseClient, businessId: string, serviceDate: string, teamId: string | null,
  reason: 'route_save' | 'inputs_changed',
  inputs: CapacityInputs, settings: CapacitySettings,
): Promise<Result<{ id: string; estimate: CapacityEstimate }>> {
  const estimate = estimateDay(inputs, settings);
  const { data, error } = await db.from('delivery_day_estimates').insert({
    business_id: businessId, service_date: serviceDate, team_id: teamId, reason,
    stops: inputs.stops, trees: inputs.trees, gallons: inputs.gallons,
    drive_minutes: inputs.driveMinutes, miles: inputs.miles,
    threshold_hours: settings.dayHoursBeforeSecondTeam,
    planting_minutes_per_tree: settings.plantingMinutesPerTree,
    settings_were_set: settings.fromSettings,
    total_hours: estimate.totalHours, drive_known: estimate.driveKnown,
    suggested_teams: estimate.suggestedTeams, working: estimate.working,
  }).select('id').single();
  if (error) {
    const code = (error as { code?: string }).code ?? 'error';
    if (TRACE_CAPACITY) console.log('[TRACE:CAPACITY] snapshot failed', { code, message: error.message });
    if (code === '42P01' || code === 'PGRST205') {
      return { ok: false, code: 'needs_migration', message: 'The day estimate needs the database update (20260922c) — it has not been applied yet.' };
    }
    return { ok: false, code, message: error.message };
  }
  if (TRACE_CAPACITY) console.log('[TRACE:CAPACITY] snapshot', {
    serviceDate, teamId, reason, hours: estimate.totalHours,
    driveKnown: estimate.driveKnown, suggested: estimate.suggestedTeams, threshold: estimate.thresholdHours,
  });
  return { ok: true, value: { id: (data as { id: string }).id, estimate } };
}

/**
 * Record what the person decided.
 *
 * 🔴 IT DOES NOT OVERWRITE THE SUGGESTION. David: *"Lauren decides — if she says one team, that
 *    stands."* Both numbers stay side by side, because where the rule and the person DISAGREED is
 *    exactly the evidence anyone tuning X would need, and overwriting would erase it. The database
 *    enforces this too (20260922c's trigger), so no writer can forget.
 */
export async function recordTeamChoice(
  db: SupabaseClient, estimateId: string, chosenTeams: number,
): Promise<Result<{ chosenTeams: number }>> {
  // 🔴 `.select('id')` IS LOAD-BEARING, NOT DECORATION (A8). Under RLS an UPDATE that matches no
  // row is a SUCCESS with zero rows — no error, nothing changed. Without reading a row back, a
  // refusal and a recorded decision are indistinguishable, and this function would tell Lauren her
  // choice was kept when the database had declined it. Caught by `verify:zero-row-writes`, which
  // refused the first version of this call outright.
  const { data, error } = await db.from('delivery_day_estimates')
    .update({ chosen_teams: chosenTeams, chosen_at: new Date().toISOString() })
    .eq('id', estimateId)
    .select('id');
  if (error) {
    if (TRACE_CAPACITY) console.log('[TRACE:CAPACITY] choice refused', { code: (error as { code?: string }).code, message: error.message });
    return { ok: false, code: (error as { code?: string }).code ?? 'error', message: error.message };
  }
  if (!data || (data as unknown[]).length === 0) {
    if (TRACE_CAPACITY) console.log('[TRACE:CAPACITY] choice changed NO row', { estimateId });
    return { ok: false, code: 'not_recorded',
      message: 'That choice was not recorded — the estimate could not be found, or your login may not change deliveries.' };
  }
  if (TRACE_CAPACITY) console.log('[TRACE:CAPACITY] choice recorded', { estimateId, chosenTeams });
  return { ok: true, value: { chosenTeams } };
}
