#!/usr/bin/env node
/**
 * backfill-financial-permissions.mjs — Phase 1 backfill (decision 2026-06-21).
 *
 * PURPOSE: grant every CURRENT business_members row its role's financial-permission
 *   defaults BEFORE any enforcement turns on, so no existing user loses access when
 *   the wall (Phases 2-4) flips on. ADDITIVE-ONLY (union) — never removes a permission.
 *   Idempotent: a member that already has its grants is left untouched.
 *
 * SOURCE OF TRUTH for the role→grants map: packages/shared/src/auth/financialPermissions.ts
 *   (FINANCIAL_ROLE_DEFAULTS). The map below is a MIRROR — keep in sync. The companion
 *   verify-financial-permissions.mjs independently asserts the live result matches the
 *   decision record, so drift between this mirror and the canonical source is caught.
 *
 * DEPENDENCIES: @supabase/supabase-js + SUPABASE_SERVICE_KEY (DML, RLS-bypassing, no PAT).
 * OUTPUTS: per-member diff; updates business_members.permissions when --apply is passed.
 *
 * Usage (from repo root):
 *   node scripts/backfill-financial-permissions.mjs            # DRY-RUN (default; no writes)
 *   node scripts/backfill-financial-permissions.mjs --apply    # writes the union
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── canonical role → financial grants (MIRROR of FINANCIAL_ROLE_DEFAULTS) ──────
const VIEW_COSTS = 'view_costs';
const VIEW_PRICING_CONFIG = 'view_pricing_config';
const VIEW_WAGES = 'view_wages';
const VIEW_MARGIN = 'view_margin';
const ALL_FINANCIAL = [VIEW_WAGES, VIEW_PRICING_CONFIG, VIEW_COSTS, VIEW_MARGIN];
const FINANCIAL_ROLE_DEFAULTS = {
  OWNER: [VIEW_WAGES, VIEW_PRICING_CONFIG, VIEW_COSTS, VIEW_MARGIN],
  MANAGER: [VIEW_COSTS, VIEW_MARGIN],
  STAFF: [],
};
const financialDefaultsForRole = (role) => FINANCIAL_ROLE_DEFAULTS[role] ?? []; // DEFAULT-DENY

// ── env ───────────────────────────────────────────────────────────────────────
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const loadEnv = (p) => {
  try {
    return Object.fromEntries(
      readFileSync(p, 'utf8').split('\n')
        .filter((l) => l.includes('=') && !l.startsWith('#'))
        .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
    );
  } catch { return {}; }
};
const env = { ...loadEnv(join(repoRoot, '.env.local')), ...loadEnv(join(repoRoot, 'packages/cultivar-os/.env.local')) };
const URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY;
if (!URL || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const APPLY = process.argv.includes('--apply');
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// ── run ─────────────────────────────────────────────────────────────────────
const { data: members, error } = await sb
  .from('business_members')
  .select('id, business_id, name, role, active, permissions')
  .order('created_at', { ascending: true });
if (error) { console.error('read failed:', error.message); process.exit(1); }

console.log(`[backfill] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} members=${members.length}`);
console.log(`[backfill] financial vocabulary: ${JSON.stringify(ALL_FINANCIAL)}`);
let changed = 0;
for (const m of members) {
  const existing = Array.isArray(m.permissions) ? m.permissions : [];
  const grants = financialDefaultsForRole(m.role);
  const toAdd = grants.filter((g) => !existing.includes(g));
  const tag = `${m.business_id.slice(0, 8)}/${m.role}/${m.active ? 'active' : 'inactive'} ${JSON.stringify(m.name)}`;
  if (toAdd.length === 0) {
    console.log(`  = ${tag} — already has its ${grants.length} grant(s); no change`);
    continue;
  }
  const next = [...existing, ...toAdd]; // UNION — additive only, removes nothing
  console.log(`  + ${tag} — adding ${JSON.stringify(toAdd)}`);
  changed++;
  if (APPLY) {
    const { error: uerr } = await sb.from('business_members').update({ permissions: next }).eq('id', m.id);
    if (uerr) { console.error(`    update failed: ${uerr.message}`); process.exit(1); }
  }
}
console.log(`[backfill] ${APPLY ? 'APPLIED to' : 'DRY-RUN would change'} ${changed} member(s). Additive union — no permission removed.`);
if (!APPLY && changed > 0) console.log('[backfill] re-run with --apply to write.');
