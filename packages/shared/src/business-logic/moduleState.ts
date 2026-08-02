/**
 * MODULE: moduleState — THE ONE WRITER of `business_modules`.
 *
 * PURPOSE:      Every write to per-tenant module enablement/config goes through
 *               `set_business_module_state()`. The table has no client write policy at all after
 *               20260801 (SELECT-only), so this is not a convention — it is the only door.
 * DEPENDENCIES: the `set_business_module_state` RPC (20260801 + 20260801b).
 * OUTPUTS:      { applied, reason, error } — `applied:false` with a `reason` is an AUTHORITY
 *               REFUSAL, not a crash, and the caller must surface it rather than swallow it.
 *
 * ── TWO GATES, BECAUSE THEY ARE TWO ACTS (ruling 2026-08-01) ────────────────────────────────────
 *   · `config` / `configured`  → `settings:update`     — the manager configures.
 *   · `enabled`                → `subscription:update` — the owner subscribes; it changes the bill.
 * The enablement gate fires only on an ACTUAL CHANGE, so passing `enabled: true` for a module that
 * is already on is not a spend and needs no spend authority.
 *
 * ── THE PRE-MIGRATION FALLBACK IS GONE, AS ITS OWN HEADER PROMISED (2026-08-01, ledger #181) ────
 * It said: *"DELETED in the commit that confirms both migrations are applied — it is a bridge, and
 * a bridge nobody removes becomes a second writer, which is the thing this file exists to prevent."*
 * 20260801 and 20260801b are both APPLIED AND PROVEN (member_select FOR SELECT only · a manager's
 * direct UPDATE affects 0 rows · V3d proved the config/enablement split), so the bridge is removed
 * in the commit that had the standing to remove it.
 *
 * ⚠️ IT WAS NOT DEAD CODE — it was a SECOND WRITE PATH sitting behind a condition that could still
 * fire. `isMissingFunction` also matched the generic `does not exist`, so a transient schema-cache
 * miss would have routed a write around the RPC and its two authority gates entirely, into an
 * upsert that RLS now discards silently. Keeping a bridge "just in case" past its own condition is
 * how a table ends up with two writers and one of them unaudited.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * 🔴 THE READ CONTRACT, IN ONE PLACE — the columns every reader of `business_modules` selects, and
 * the shape they come back as. Extracted 2026-08-02 (6) when the field-lists ratchet caught the
 * marketplace hand-writing a SECOND copy of the same four columns.
 *
 * The cap was right and declaring it would have been the wrong answer: `config` is where the trial
 * pair lives, and **a reader that quietly stops selecting it renders a live trial and an untouched
 * module as the same pixel** — which is exactly the defect of 2026-08-02 (1), where `useModules`
 * SELECTED `config` and then dropped it. Two hand-written lists is how the second reader forgets a
 * column the first one needs. One list, imported by both.
 */
export const BUSINESS_MODULE_COLUMNS = 'module_key, enabled, configured, config';

/** One tenant's row for one module, as `BUSINESS_MODULE_COLUMNS` returns it. */
export interface BusinessModuleRow {
  module_key: string;
  enabled: boolean;
  configured: boolean;
  /** Holds the trial pair `(trial_started_at, trial_days)`. Read it with `trialDaysRemaining`. */
  config: Record<string, unknown> | null;
}

export interface ModuleStatePatch {
  /** Enablement — REQUIRES `subscription:update` when it actually changes the stored value. */
  enabled?: boolean;
  /** Setup-complete flag — requires `settings:update`. */
  configured?: boolean;
  /** MERGED over the existing config, never replacing it — requires `settings:update`. */
  config?: Record<string, unknown>;
}

export interface ModuleStateResult {
  applied: boolean;
  /** Present when the server REFUSED (authority or validation). Surface it; do not swallow it. */
  reason: string | null;
  error: { message: string } | null;
}

export async function setBusinessModuleState(
  supabase: SupabaseClient,
  businessId: string,
  moduleKey: string,
  patch: ModuleStatePatch,
  actorUserId: string | null,
): Promise<ModuleStateResult> {
  const { data, error } = await supabase.rpc('set_business_module_state', {
    p_business_id:   businessId,
    p_module_key:    moduleKey,
    p_enabled:       patch.enabled     ?? null,
    p_configured:    patch.configured  ?? null,
    p_config_patch:  patch.config      ?? null,
    p_actor_user_id: actorUserId,
  });

  // An RPC error is now just an error. There is no other door: the table has no client write
  // policy, so a failure here means the write did NOT happen, and reporting it as such is the
  // whole contract.
  if (error) return { applied: false, reason: null, error };

  // The RPC RETURNS TABLE(...) — PostgREST hands back an array of one row.
  const r = Array.isArray(data) ? data[0] : data;
  const applied = Boolean(r?.applied);
  const reason = (r?.reason as string | null) ?? null;
  console.log('[TRACE:MODULES] set_business_module_state', {
    moduleKey, applied, reason,
    enabled_before: r?.enabled_before, enabled_after: r?.enabled_after, was_insert: r?.was_insert,
  });
  return { applied, reason, error: null };
}
