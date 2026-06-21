#!/usr/bin/env node
/**
 * verify-financial-wall.mjs — Phase 2 SCHEMA-VERIFICATION GATE (§9).
 *
 * Run AFTER applying supabase/migrations/20260621_financial_wall_phase2.sql.
 * Hits the LIVE CATALOG (information_schema / pg_catalog) via the Management API —
 * NOT the builder's memory. Plus a service-key DATA-MOVE check (RLS-bypassing) proving
 * the sensitive values were copied to the gated child and cleared from the legacy home.
 * (The RLS WALL itself — a low-role session refused — is the SEPARATE Gate 2 proof in
 * verify-financial-wall-rls.mjs, which needs a member session.)
 *
 * CATALOG mode (the real gate):  SUPABASE_PAT=sbp_xxx node scripts/verify-financial-wall.mjs
 * DATA-MOVE mode (service key):   node scripts/verify-financial-wall.mjs
 *
 * Requires: packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const PROJECT_REF = 'bgobkjcopcxusjsetfob';
const MGMT_API = 'https://api.supabase.com/v1';
const env = Object.fromEntries(
  readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_KEY;
const PAT = process.env.SUPABASE_PAT;

let passed = 0, failed = 0;
const pass = (l, d = '') => { passed++; console.log(`  ✅ ${l}${d ? ' — ' + d : ''}`); };
const fail = (l, d = '') => { failed++; console.error(`  ❌ FAIL: ${l}${d ? ' — ' + d : ''}`); };

async function execSQL(sql) {
  const res = await fetch(`${MGMT_API}/projects/${PROJECT_REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const body = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(JSON.stringify(body));
  return body;
}

async function catalogGate() {
  console.log('\n=== CATALOG GATE (PAT) — Phase 2 financial wall ===\n');

  // (A) labor_resource_wages columns
  const lrwCols = (await execSQL(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='labor_resource_wages' ORDER BY 1;`,
  )).map((r) => r.column_name);
  const expectLrw = ['base_wage','bill_rate','burden','business_id','cost_rate','created_at','pass_through_expenses','rate','resource_id','updated_at'];
  ok(arrEq(lrwCols, expectLrw), '(A) labor_resource_wages columns', JSON.stringify(lrwCols));

  // (B) labor_resource_wages RLS + policies + permission predicate
  const lrwRls = (await execSQL(`SELECT relrowsecurity FROM pg_class WHERE relname='labor_resource_wages';`))[0]?.relrowsecurity;
  ok(lrwRls === true, '(B1) labor_resource_wages RLS enabled');
  const lrwPol = (await execSQL(`SELECT policyname, qual FROM pg_policies WHERE schemaname='public' AND tablename='labor_resource_wages' ORDER BY 1;`));
  ok(lrwPol.some((p) => p.policyname === 'lrw_owner_all') && lrwPol.some((p) => p.policyname === 'lrw_member_view_wages'),
    '(B2) policies lrw_owner_all + lrw_member_view_wages', lrwPol.map((p) => p.policyname).join(','));
  ok(lrwPol.some((p) => p.policyname === 'lrw_member_view_wages' && /view_wages/.test(p.qual ?? '')),
    '(B3) member policy references view_wages');

  // (C) FK resource_id → labor_resources ON DELETE CASCADE
  const lrwFk = (await execSQL(
    `SELECT confdeltype, confrelid::regclass::text AS ref FROM pg_constraint WHERE conrelid='labor_resource_wages'::regclass AND contype='f' AND conkey = ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='labor_resource_wages'::regclass AND attname='resource_id')];`,
  ))[0];
  ok(lrwFk?.ref === 'labor_resources' && lrwFk?.confdeltype === 'c', '(C) resource_id FK → labor_resources ON DELETE CASCADE', JSON.stringify(lrwFk));

  // (D) business_pricing_config columns
  const bpcCols = (await execSQL(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='business_pricing_config' ORDER BY 1;`,
  )).map((r) => r.column_name);
  ok(arrEq(bpcCols, ['business_id','config','created_at','updated_at']), '(D) business_pricing_config columns', JSON.stringify(bpcCols));

  // (E) business_pricing_config RLS + policies + predicate
  const bpcRls = (await execSQL(`SELECT relrowsecurity FROM pg_class WHERE relname='business_pricing_config';`))[0]?.relrowsecurity;
  ok(bpcRls === true, '(E1) business_pricing_config RLS enabled');
  const bpcPol = (await execSQL(`SELECT policyname, qual FROM pg_policies WHERE schemaname='public' AND tablename='business_pricing_config' ORDER BY 1;`));
  ok(bpcPol.some((p) => p.policyname === 'bpc_owner_all') && bpcPol.some((p) => p.policyname === 'bpc_member_view_pricing'),
    '(E2) policies bpc_owner_all + bpc_member_view_pricing', bpcPol.map((p) => p.policyname).join(','));
  ok(bpcPol.some((p) => p.policyname === 'bpc_member_view_pricing' && /view_pricing_config/.test(p.qual ?? '')),
    '(E3) member policy references view_pricing_config');

  // (F) DATA MOVED — base wage cols all NULL; every labor row has a wage child; cost_to_produce config '{}'; each such business has a pricing-config row.
  const baseNonNull = (await execSQL(
    `SELECT COUNT(*)::int AS n FROM labor_resources WHERE base_wage IS NOT NULL OR burden IS NOT NULL OR cost_rate IS NOT NULL OR bill_rate IS NOT NULL OR rate IS NOT NULL OR pass_through_expenses IS NOT NULL;`,
  ))[0].n;
  ok(baseNonNull === 0, '(F1) labor_resources wage columns all NULL (value moved to child)', `non-null rows=${baseNonNull}`);
  const orphanLabor = (await execSQL(
    `SELECT COUNT(*)::int AS n FROM labor_resources lr LEFT JOIN labor_resource_wages w ON w.resource_id=lr.id WHERE w.resource_id IS NULL;`,
  ))[0].n;
  ok(orphanLabor === 0, '(F2) every labor_resources row has a wage child row', `orphans=${orphanLabor}`);
  const dirtyCfg = (await execSQL(
    `SELECT COUNT(*)::int AS n FROM business_modules WHERE module_key='cost_to_produce' AND config <> '{}'::jsonb;`,
  ))[0].n;
  ok(dirtyCfg === 0, "(F3) business_modules cost_to_produce config cleared to '{}'", `dirty rows=${dirtyCfg}`);
  const missingPricing = (await execSQL(
    `SELECT COUNT(*)::int AS n FROM business_modules bm WHERE bm.module_key='cost_to_produce' AND NOT EXISTS (SELECT 1 FROM business_pricing_config p WHERE p.business_id=bm.business_id);`,
  ))[0].n;
  ok(missingPricing === 0, '(F4) each cost_to_produce business has a business_pricing_config row', `missing=${missingPricing}`);
}

function ok(cond, label, detail = '') { cond ? pass(label, detail) : fail(label, detail); }
function arrEq(a, b) { return a.length === b.length && a.every((x, i) => x === b[i]); }

async function dataMoveRoundTrip() {
  console.log('\n=== DATA-MOVE round-trip (service key, RLS-bypassing) ===\n');
  const sb = createClient(URL, SERVICE_KEY, { auth: { persistSession: false } });
  const lrw = await sb.from('labor_resource_wages').select('resource_id,base_wage').limit(1000);
  if (lrw.error) { fail('labor_resource_wages readable', lrw.error.message); }
  else { pass('labor_resource_wages readable', `${lrw.data.length} wage child rows`); }
  const bpc = await sb.from('business_pricing_config').select('business_id').limit(1000);
  if (bpc.error) { fail('business_pricing_config readable', bpc.error.message); }
  else { pass('business_pricing_config readable', `${bpc.data.length} pricing rows`); }
  const base = await sb.from('labor_resources').select('id,base_wage,cost_rate').limit(1000);
  if (!base.error) {
    const leaks = (base.data ?? []).filter((r) => r.base_wage != null || r.cost_rate != null).length;
    ok(leaks === 0, 'labor_resources base wage columns cleared (service-key view)', `non-null=${leaks}`);
  }
}

if (!URL || !SERVICE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
if (PAT) { await catalogGate(); } else { console.log('(no SUPABASE_PAT — skipping catalog gate; running data-move round-trip only)'); }
await dataMoveRoundTrip();
console.log(`\n=== RESULT: ${passed} pass / ${failed} fail ===`);
process.exit(failed === 0 ? 0 : 1);
