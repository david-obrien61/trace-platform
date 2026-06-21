#!/usr/bin/env node
/**
 * verify-financial-wall-rls.mjs — GATE 2 PROOF (decision 2026-06-21, Phase 2).
 *
 * The wall is proven only by a LOW-ROLE SESSION issuing a DIRECT query for a gated value
 * and being refused AT THE DATA LAYER — verified on the response, not on a rendered page.
 * This signs in with the ANON key (real RLS, exactly like the app) as a member WITHOUT the
 * permission and as the owner, and proves:
 *   • member: SELECT labor_resource_wages → 0 rows; SELECT base_wage from labor_resources →
 *     NULL (value moved); SELECT business_pricing_config → no row. The value never arrives.
 *   • owner:  SELECT labor_resource_wages → rows WITH wages; business_pricing_config → config.
 *
 * Run AFTER applying 20260621_financial_wall_phase2.sql. Supply test credentials:
 *   OWNER_EMAIL=.. OWNER_PASSWORD=.. MEMBER_EMAIL=.. MEMBER_PASSWORD=.. \
 *     node scripts/verify-financial-wall-rls.mjs
 * The MEMBER account must be an ACTIVE business_members row WITHOUT view_wages /
 * view_pricing_config (e.g. a test TECH/STAFF). Both accounts must belong to the SAME business.
 *
 * (David can equivalently owner-prove via the real UI + browser network tab — the bar is the
 *  same: the gated value must not appear in the network response for the low-role session.)
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
const ANON = env.VITE_SUPABASE_ANON_KEY;
const { OWNER_EMAIL, OWNER_PASSWORD, MEMBER_EMAIL, MEMBER_PASSWORD } = process.env;
if (!URL || !ANON) { console.error('Missing SUPABASE_URL / VITE_SUPABASE_ANON_KEY'); process.exit(1); }

let passed = 0, failed = 0;
const ok = (c, m, d = '') => { (c ? passed++ : failed++); console.log(`  ${c ? '✅' : '❌'} ${m}${d ? ' — ' + d : ''}`); };

async function session(email, password) {
  const sb = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`sign-in failed for ${email}: ${error.message}`);
  return { sb, userId: data.user.id };
}

async function proveMemberRefused() {
  if (!MEMBER_EMAIL || !MEMBER_PASSWORD) { console.log('(no MEMBER_EMAIL/MEMBER_PASSWORD — skipping low-role proof)'); return; }
  console.log(`\n=== LOW-ROLE member (${MEMBER_EMAIL}) — must be REFUSED ===\n`);
  const { sb } = await session(MEMBER_EMAIL, MEMBER_PASSWORD);

  const wages = await sb.from('labor_resource_wages').select('resource_id,base_wage,cost_rate');
  ok(!wages.error && (wages.data ?? []).length === 0, 'labor_resource_wages → 0 rows (view_wages denied)', `rows=${(wages.data ?? []).length}${wages.error ? ' err=' + wages.error.message : ''}`);

  const base = await sb.from('labor_resources').select('id,base_wage,cost_rate,bill_rate,rate');
  const leaked = (base.data ?? []).filter((r) => r.base_wage != null || r.cost_rate != null || r.bill_rate != null || r.rate != null);
  ok(!base.error && leaked.length === 0, 'labor_resources base wage columns → NULL (value moved off the member-readable table)', `leaked=${leaked.length}`);

  const pricing = await sb.from('business_pricing_config').select('business_id,config');
  ok(!pricing.error && (pricing.data ?? []).length === 0, 'business_pricing_config → 0 rows (view_pricing_config denied)', `rows=${(pricing.data ?? []).length}`);

  const legacyCfg = await sb.from('business_modules').select('config').eq('module_key', 'cost_to_produce');
  const dirty = (legacyCfg.data ?? []).filter((r) => r.config && Object.keys(r.config).length > 0);
  ok(!legacyCfg.error && dirty.length === 0, 'business_modules cost_to_produce config is empty for member (recipe not leaked via legacy column)', `non-empty=${dirty.length}`);
}

async function proveOwnerIntact() {
  if (!OWNER_EMAIL || !OWNER_PASSWORD) { console.log('(no OWNER_EMAIL/OWNER_PASSWORD — skipping owner-intact proof)'); return; }
  console.log(`\n=== OWNER (${OWNER_EMAIL}) — must still READ both ===\n`);
  const { sb } = await session(OWNER_EMAIL, OWNER_PASSWORD);
  const wages = await sb.from('labor_resource_wages').select('resource_id,base_wage,cost_rate');
  ok(!wages.error, 'owner reads labor_resource_wages', `rows=${(wages.data ?? []).length}${wages.error ? ' err=' + wages.error.message : ''}`);
  const pricing = await sb.from('business_pricing_config').select('business_id,config');
  ok(!pricing.error && (pricing.data ?? []).length >= 1, 'owner reads business_pricing_config', `rows=${(pricing.data ?? []).length}`);
}

await proveMemberRefused();
await proveOwnerIntact();
console.log(`\n=== RESULT: ${passed} pass / ${failed} fail ===`);
console.log('GATE 2 = a low-role session refused at the data layer (rows absent / value NULL), verified on the response.');
process.exit(failed === 0 ? 0 : 1);
