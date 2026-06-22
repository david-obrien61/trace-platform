#!/usr/bin/env node
/**
 * verify-financial-wall-rls-auto.mjs — GATE 2 low-role proof, SELF-CONTAINED.
 *
 * Proves the wall AT THE DATA LAYER under REAL RLS without any external credentials:
 *   1. (admin) create a throwaway auth user + an ACTIVE business_members row with NO
 *      financial permissions, in a business that has wages + pricing config.
 *   2. Sign in as that member with the ANON key (real RLS, exactly like the app) and
 *      issue DIRECT queries — must be REFUSED: labor_resource_wages → 0 rows,
 *      labor_resources base wages → NULL, business_pricing_config → 0 rows, legacy
 *      business_modules cost_to_produce config → empty.
 *   3. Flip the SAME member's permissions to grant the four perms → the SAME anon
 *      session now READS wages + pricing (RLS re-evaluates live) — proves the wall is
 *      PERMISSION-KEYED, both directions, not a blanket deny.
 *   4. Clean up (delete member row + auth user) in finally.
 *
 * Run AFTER applying 20260621_financial_wall_phase2.sql:
 *   node scripts/verify-financial-wall-rls-auto.mjs
 * Requires packages/cultivar-os/.env.local (SUPABASE_URL + SERVICE_KEY + ANON_KEY).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
const ANON = env.VITE_SUPABASE_ANON_KEY;
if (!URL || !SERVICE_KEY || !ANON) { console.error('Missing URL / SERVICE_KEY / ANON_KEY'); process.exit(1); }

let passed = 0, failed = 0;
const ok = (c, m, d = '') => { (c ? passed++ : failed++); console.log(`  ${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };

const admin = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
const stamp = Date.now();
const email = `wall-test-${stamp}@example.com`;
const password = `Wall!test-${stamp}`;
let userId = null;
let memberId = null;
let businessId = null;

try {
  // pick a business that actually has wages AND pricing config (so deny vs allow is observable)
  const { data: bpc } = await admin.from('business_pricing_config').select('business_id').limit(50);
  const { data: lrw } = await admin.from('labor_resource_wages').select('business_id').limit(200);
  const wageBiz = new Set((lrw ?? []).map((r) => r.business_id));
  businessId = (bpc ?? []).map((r) => r.business_id).find((id) => wageBiz.has(id)) ?? (bpc ?? [])[0]?.business_id;
  if (!businessId) { console.error('No business has pricing config — apply the migration first.'); process.exit(1); }
  console.log(`Using business ${businessId.slice(0, 8)} (has wages+pricing).`);

  // 1. create throwaway user + no-perm membership
  const { data: created, error: cErr } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (cErr) throw new Error(`createUser: ${cErr.message}`);
  userId = created.user.id;
  const { data: m, error: mErr } = await admin.from('business_members')
    .insert({ business_id: businessId, user_id: userId, name: 'Wall Test (auto)', role: 'STAFF', active: true, permissions: [] })
    .select('id').single();
  if (mErr) throw new Error(`member insert: ${mErr.message}`);
  memberId = m.id;

  // 2. sign in as the no-perm member (anon → real RLS)
  const member = createClient(URL, ANON, { auth: { persistSession: false } });
  const { error: sErr } = await member.auth.signInWithPassword({ email, password });
  if (sErr) throw new Error(`member sign-in: ${sErr.message}`);

  console.log('\n=== NO-PERM member — must be REFUSED at the data layer ===');
  const w0 = await member.from('labor_resource_wages').select('resource_id,base_wage,cost_rate').eq('business_id', businessId);
  ok(!w0.error && (w0.data ?? []).length === 0, 'labor_resource_wages → 0 rows (view_wages denied)', `rows=${(w0.data ?? []).length}${w0.error ? ' err=' + w0.error.message : ''}`);
  const b0 = await member.from('labor_resources').select('id,base_wage,cost_rate,bill_rate,rate').eq('business_id', businessId);
  const leaked = (b0.data ?? []).filter((r) => r.base_wage != null || r.cost_rate != null || r.bill_rate != null || r.rate != null);
  ok(!b0.error && leaked.length === 0, 'labor_resources base wages → NULL (value moved off member-readable table)', `leaked=${leaked.length}`);
  const p0 = await member.from('business_pricing_config').select('business_id,config').eq('business_id', businessId);
  ok(!p0.error && (p0.data ?? []).length === 0, 'business_pricing_config → 0 rows (view_pricing_config denied)', `rows=${(p0.data ?? []).length}`);
  const lc0 = await member.from('business_modules').select('config').eq('business_id', businessId).eq('module_key', 'cost_to_produce');
  const dirty = (lc0.data ?? []).filter((r) => r.config && Object.keys(r.config).length > 0);
  ok(!lc0.error && dirty.length === 0, 'legacy business_modules cost_to_produce config empty (recipe not leaked)', `non-empty=${dirty.length}`);

  // 3. grant the four perms to the SAME member → SAME session must now READ (RLS re-evaluates live)
  const { error: gErr } = await admin.from('business_members')
    .update({ permissions: ['view_wages', 'view_pricing_config', 'view_costs', 'view_margin'] })
    .eq('id', memberId);
  if (gErr) throw new Error(`grant: ${gErr.message}`);

  console.log('\n=== SAME member, perms GRANTED — wall opens (permission-keyed, not blanket) ===');
  const w1 = await member.from('labor_resource_wages').select('resource_id,base_wage').eq('business_id', businessId);
  ok(!w1.error && (w1.data ?? []).length > 0, 'labor_resource_wages → rows visible after view_wages granted', `rows=${(w1.data ?? []).length}`);
  const p1 = await member.from('business_pricing_config').select('business_id,config').eq('business_id', businessId);
  ok(!p1.error && (p1.data ?? []).length > 0, 'business_pricing_config → row visible after view_pricing_config granted', `rows=${(p1.data ?? []).length}`);
} finally {
  // 4. cleanup (best-effort)
  if (memberId) await admin.from('business_members').delete().eq('id', memberId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log('\n(cleaned up throwaway member + user)');
}

console.log(`\n=== RESULT: ${passed} pass / ${failed} fail ===`);
console.log('GATE 2 = low-role session refused at the data layer (rows absent / value NULL), proven on the response; access appears only when the permission is granted.');
process.exit(failed === 0 ? 0 : 1);
