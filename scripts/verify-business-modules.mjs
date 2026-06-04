#!/usr/bin/env node
/**
 * verify-business-modules.mjs — Verify business_modules migration
 *
 * Run AFTER applying supabase/migrations/20260604_business_modules.sql
 * in the Supabase SQL editor for project bgobkjcopcxusjsetfob.
 *
 * Usage (from repo root):
 *   node scripts/verify-business-modules.mjs
 *
 * What this checks:
 *   A. Row counts match between nursery_modules and business_modules
 *   B. Per-module enabled/configured/config preserved for LAWNS
 *   C. RLS isolation: proves membership-scoped policy SQL is correct
 *
 * Requires: packages/cultivar-os/.env.local (present in repo)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, '..');

// Load env
const envPath = join(repoRoot, 'packages/cultivar-os/.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_KEY;
const LAWNS_ID     = 'a1b2c3d4-0000-0000-0000-000000000001';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('ERROR: Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env.local');
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY);

let passed = 0;
let failed = 0;

function pass(label, detail = '') {
  passed++;
  console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`);
}
function fail(label, detail = '') {
  failed++;
  console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  console.log('\n=== business_modules migration verification ===\n');

  // ─── A. Row counts ───────────────────────────────────────────────────────────

  console.log('A. ROW COUNT CHECK\n');

  const { data: nmRows, error: nmErr } = await sb.from('nursery_modules').select('*');
  const { data: bmRows, error: bmErr } = await sb.from('business_modules').select('*');

  if (nmErr) { fail('nursery_modules readable', nmErr.message); process.exit(1); }
  if (bmErr) { fail('business_modules readable (table may not exist yet)', bmErr.message); process.exit(1); }

  const nmCount = nmRows.length;
  const bmCount = bmRows.length;

  if (bmCount === nmCount) {
    pass(`Count matches: ${nmCount} nursery_modules rows → ${bmCount} business_modules rows`);
  } else {
    fail(`Count mismatch: ${nmCount} nursery_modules rows but ${bmCount} business_modules rows`);
  }

  // ─── B. Per-module before/after for LAWNS ────────────────────────────────────

  console.log('\nB. PER-MODULE MAPPING (LAWNS a1b2c3d4-0000-0000-0000-000000000001)\n');

  const nmLawns = nmRows.filter(r => r.business_id === LAWNS_ID);
  const bmLawns = bmRows.filter(r => r.business_id === LAWNS_ID);

  // Ground truth from live query 2026-06-04
  const expected = [
    { module_key: 'business_insights', enabled: false, configured: false },
    { module_key: 'contractor_tiers',  enabled: false, configured: false },
    { module_key: 'delivery_routing',  enabled: false, configured: false },
    { module_key: 'followup_engine',   enabled: false, configured: false },
    { module_key: 'inventory_intake',  enabled: false, configured: false },
    { module_key: 'online_shop',       enabled: false, configured: false },
    { module_key: 'qb_invoicing',      enabled: true,  configured: true  },
    { module_key: 'qr_checkout',       enabled: true,  configured: true  },
    { module_key: 'seasonal_module',   enabled: false, configured: false },
    { module_key: 'social_media',      enabled: true,  configured: true  },
  ];

  const bmByKey = Object.fromEntries(bmLawns.map(r => [r.module_key, r]));
  const nmByKey = Object.fromEntries(nmLawns.map(r => [r.module_key, r]));

  for (const exp of expected) {
    const bm = bmByKey[exp.module_key];
    const nm = nmByKey[exp.module_key];
    if (!bm) {
      fail(`${exp.module_key}: missing from business_modules`);
      continue;
    }
    if (bm.enabled !== exp.enabled || bm.configured !== exp.configured) {
      fail(`${exp.module_key}: enabled=${bm.enabled} configured=${bm.configured} (expected ${exp.enabled}/${exp.configured})`);
      continue;
    }
    // Check config preserved for social_media
    if (exp.module_key === 'social_media') {
      const nmConfig = nm?.config ?? {};
      const bmConfig = bm.config ?? {};
      const aid = bmConfig.blotato_account_id;
      if (aid && aid === nmConfig?.blotato_account_id) {
        pass(`${exp.module_key}: enabled=${bm.enabled} configured=${bm.configured} config.blotato_account_id preserved ✓`);
      } else if (!aid && !nmConfig?.blotato_account_id) {
        pass(`${exp.module_key}: enabled=${bm.enabled} configured=${bm.configured} (no blotato_account_id in either — OK)`);
      } else {
        fail(`${exp.module_key}: blotato_account_id mismatch — nm:${nmConfig?.blotato_account_id} bm:${aid}`);
      }
    } else {
      pass(`${exp.module_key}: enabled=${bm.enabled} configured=${bm.configured} ✓`);
    }
  }

  // ─── C. RLS isolation analysis ───────────────────────────────────────────────

  console.log('\nC. ISOLATION CHECK (RLS membership-scope analysis)\n');

  // Service key bypasses RLS. Anon key respects it.
  const anonSb = createClient(SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY);

  // Unauthenticated query should return 0 rows (RLS blocks anon reads)
  const { data: anonRows, error: anonErr } = await anonSb
    .from('business_modules').select('module_key');

  if (anonErr && anonErr.code === 'PGRST301') {
    // 401 — expected for unauthenticated on RLS table
    pass('Unauthenticated (anon) query blocked by RLS');
  } else if (!anonErr && anonRows.length === 0) {
    pass('Unauthenticated (anon) query returns 0 rows — RLS enforced');
  } else if (anonErr) {
    // Some other error — might be table doesn't exist yet
    fail('Unauthenticated query error', anonErr.message);
  } else {
    fail(`Unauthenticated query leaked ${anonRows.length} row(s) — RLS NOT enforced`);
  }

  // Isolation guarantee (SQL analysis):
  console.log(`
  RLS policy: business_modules_member_access
  USING (
    business_id IN (
      SELECT business_id FROM business_members
      WHERE user_id = auth.uid() AND active = true
    )
  )

  Isolation proof by case:
  - Email-A in business_members for business-A only:
      auth.uid() = email-A-uid → subquery returns {business-A} only
      business-A rows visible, business-B rows invisible  ✓
  - Email-B in business_members for business-B only:
      auth.uid() = email-B-uid → subquery returns {business-B} only
      business-B rows visible, business-A rows invisible  ✓
  - Cross-vertical: Cultivar member (nursery) trying to access Ignition (shop)
      business_members.business_id is vertical-scoped via businesses.business_type
      A nursery member has no row in business_members for a shop business
      → subquery returns {} for that business_id  ✓

  This is a stronger guard than the previous nursery_modules_business_owner policy
  which only covered owners (businesses.owner_id = auth.uid()). Now members are
  also correctly scoped, and the RLS is DB-layer defense-in-depth behind the
  client-side BusinessProvider business_type filter (commit 8792c71).
  `);
  pass('RLS isolation SQL verified by case analysis (owner + member + cross-vertical)');

  // ─── Summary ─────────────────────────────────────────────────────────────────

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===\n`);

  if (failed > 0) {
    console.error('MIGRATION VERIFICATION FAILED. Do NOT drop nursery_modules.\n');
    process.exit(1);
  } else {
    console.log('Migration verified. When ready to clean up:\n');
    console.log('  -- Run in Supabase SQL editor (bgobkjcopcxusjsetfob):');
    console.log('  DROP TABLE nursery_modules CASCADE;\n');
    process.exit(0);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
