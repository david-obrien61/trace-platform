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
 * ── WHY THE PRE-MIGRATION FALLBACK EXISTS, and when it dies ─────────────────────────────────────
 * 20260801/20260801b are GATED — written, not yet applied. Without a fallback, this file would
 * break every module write the moment it deploys and stay broken until David runs the SQL, and
 * Vercel deploys on push. So a missing RPC falls back to the direct upsert that works TODAY. This
 * is the same shape `financialDataAccess` already uses for the pre/post-migration pricing tables,
 * and it is DELETED in the commit that confirms both migrations are applied — it is a bridge, and a
 * bridge nobody removes becomes a second writer, which is the thing this file exists to prevent.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

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

/** PostgREST's shapes for "that function isn't there" — the pre-migration signal. */
function isMissingFunction(error: unknown): boolean {
  if (!error) return false;
  const e = error as { code?: string; message?: string };
  const code = String(e.code ?? '');
  const msg = String(e.message ?? '').toLowerCase();
  return (
    code === 'PGRST202' ||           // PostgREST: function not found in the schema cache
    code === '42883' ||              // undefined_function
    msg.includes('could not find the function') ||
    msg.includes('does not exist')
  );
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

  if (error && isMissingFunction(error)) {
    // ── PRE-MIGRATION BRIDGE (see the header). Direct upsert, the behaviour that exists today.
    console.log('[TRACE:MODULES] RPC absent — pre-migration direct upsert', { moduleKey });
    const row: Record<string, unknown> = { business_id: businessId, module_key: moduleKey };
    if (patch.enabled    !== undefined) row.enabled    = patch.enabled;
    if (patch.configured !== undefined) row.configured = patch.configured;
    if (patch.config     !== undefined) row.config     = patch.config;
    // 🔴 `.select()` IS LOAD-BEARING, NOT A CONVENIENCE (A8). A PostgREST write filtered out by RLS
    // returns NO ERROR AND ZERO ROWS — so without this the bridge would report success on a write
    // that never happened. That is the precise failure mode this bridge exists during: if the
    // migration HAS been applied and the RPC lookup failed for some other reason, the table has no
    // client write policy at all and the upsert is silently discarded.
    const up = await supabase.from('business_modules')
      .upsert(row, { onConflict: 'business_id,module_key' })
      .select('module_key');
    if (up.error) return { applied: false, reason: null, error: up.error };
    if (!up.data || up.data.length === 0) {
      return { applied: false, reason: null,
               error: { message: 'module write affected zero rows — the write was refused, not applied' } };
    }
    return { applied: true, reason: null, error: null };
  }
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
