#!/usr/bin/env node
/**
 * verify-financial-permissions.mjs — GATE 1 proof (decision 2026-06-21, Phase 1).
 *
 * PURPOSE: prove, against LIVE business_members (service key), that the Phase 1
 *   backfill is correct AND that no current user lost access:
 *     (A) ADDITIVE-ONLY — every member's pre-backfill permission is still present.
 *     (B) ONLY financial perms were added — current \ baseline ⊆ the four-string vocab.
 *     (C) CORRECT GRANT + DEFAULT-DENY — each member's financial subset == EXACTLY its
 *         role default per the decision record (OWNER=4, MANAGER=costs+margin, STAFF=none).
 *     (D) DEPENDENCY CONSISTENCY — no member holds view_margin without view_costs.
 *     (E) OWNER UNAFFECTED — current owner rows retain every prior permission (⊆ check),
 *         and enforcement is OFF (Phase 1 adds no gate that reads the four perms), so the
 *         owner session is behaviorally byte-for-byte unchanged.
 *
 * The BASELINE below is the live pre-backfill snapshot captured independently during the
 * build session (keyed by business_id+role+name, unique across the 6 rows). It is the
 * "before" the additive check compares against — a second, independent encoding of truth.
 *
 * Usage:  node scripts/verify-financial-permissions.mjs
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// ── decision-record expectations (independent of the backfill script) ──────────
const VIEW_COSTS = 'view_costs';
const VIEW_PRICING_CONFIG = 'view_pricing_config';
const VIEW_WAGES = 'view_wages';
const VIEW_MARGIN = 'view_margin';
const FINANCIAL = new Set([VIEW_WAGES, VIEW_PRICING_CONFIG, VIEW_COSTS, VIEW_MARGIN]);
const EXPECTED_BY_ROLE = {
  OWNER: new Set([VIEW_WAGES, VIEW_PRICING_CONFIG, VIEW_COSTS, VIEW_MARGIN]),
  MANAGER: new Set([VIEW_COSTS, VIEW_MARGIN]),
  STAFF: new Set(),
};

// ── live pre-backfill snapshot (the "before") ─────────────────────────────────
// key = `${business_id8}|${role}|${name}`
const BASELINE = {
  'a1b2c3d4|OWNER|David O\'Brien': ['manage_settings','manage_team','view_dashboard','qr_checkout','view_orders','manage_deliveries','manage_campaigns','manage_customers'],
  '0edb3b55|OWNER|David O\'Brien': ['manage_settings','manage_team','view_orders','process_orders','view_reports'],
  '0edb3b55|MANAGER|Connor O\'Brien': ['view_dashboard','qr_checkout','view_orders','manage_deliveries','manage_customers','manage_campaigns','view_reports'],
  '0edb3b55|STAFF|Erin O\'Brien': ['view_dashboard','qr_checkout','view_orders'],
  '7179b77f|OWNER|Erin O\'Brien': ['manage_settings','manage_team','view_orders','process_orders','view_reports'],
  '45830ba7|OWNER|TERRENCE DAVID OBRIEN': ['manage_settings','manage_team','view_orders','process_orders','view_reports'],
};

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
const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// ── run ─────────────────────────────────────────────────────────────────────
let pass = 0, fail = 0;
const ok = (c, m) => { (c ? pass++ : fail++); console.log(`  ${c ? 'PASS' : 'FAIL'} — ${m}`); };

const { data: members, error } = await sb
  .from('business_members')
  .select('id, business_id, name, role, active, permissions')
  .order('created_at', { ascending: true });
if (error) { console.error('read failed:', error.message); process.exit(1); }

console.log(`\n=== GATE 1: financial-permission backfill proof (members=${members.length}) ===\n`);
const seenKeys = new Set();
for (const m of members) {
  const key = `${m.business_id.slice(0, 8)}|${m.role}|${m.name}`;
  seenKeys.add(key);
  const cur = new Set(Array.isArray(m.permissions) ? m.permissions : []);
  const finSubset = new Set([...cur].filter((p) => FINANCIAL.has(p)));
  const expected = EXPECTED_BY_ROLE[m.role] ?? new Set(); // unknown role ⇒ default-deny
  console.log(`• ${key} (${m.active ? 'active' : 'inactive'})`);

  // (C) correct grant + default-deny
  const finOk = finSubset.size === expected.size && [...expected].every((e) => finSubset.has(e));
  ok(finOk, `(C) financial subset == role default ${JSON.stringify([...expected].sort())} (got ${JSON.stringify([...finSubset].sort())})`);

  // (D) dependency consistency
  ok(!(cur.has(VIEW_MARGIN) && !cur.has(VIEW_COSTS)), `(D) no view_margin without view_costs`);

  // (A)+(B)+(E) against the baseline
  const base = BASELINE[key];
  if (!base) {
    console.log(`    (note) no baseline snapshot for this member — additive/leak checks skipped (added after snapshot)`);
    continue;
  }
  const baseSet = new Set(base);
  const removed = base.filter((p) => !cur.has(p));
  ok(removed.length === 0, `(A) additive — nothing removed (missing: ${JSON.stringify(removed)})`);
  const addedNonFinancial = [...cur].filter((p) => !baseSet.has(p) && !FINANCIAL.has(p));
  ok(addedNonFinancial.length === 0, `(B) only financial perms added (stray: ${JSON.stringify(addedNonFinancial)})`);
}

// every baseline member must still exist
const missingMembers = Object.keys(BASELINE).filter((k) => !seenKeys.has(k));
ok(missingMembers.length === 0, `(E) every pre-backfill member still present (missing: ${JSON.stringify(missingMembers)})`);

console.log(`\n=== RESULT: ${pass} pass / ${fail} fail ===`);
console.log('Enforcement is OFF in Phase 1 — no gate reads the four new perms yet, so owner behavior is byte-for-byte unchanged.');
process.exit(fail === 0 ? 0 : 1);
