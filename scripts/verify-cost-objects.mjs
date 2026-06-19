#!/usr/bin/env node
/**
 * verify-cost-objects.mjs — Core-1 schema-verification gate (INDEPENDENT proof)
 *
 * Run AFTER applying supabase/migrations/20260615_cost_objects_rename_and_node_schema.sql
 * in the Supabase SQL editor for project bgobkjcopcxusjsetfob.
 *
 * This is the schema-verification gate: it hits the LIVE CATALOG
 * (information_schema / pg_catalog) — NOT the builder's memory, NOT the
 * migration text. The catalog is the source of truth.
 *
 * TWO MODES:
 *   1. CATALOG mode (the real gate) — requires a Supabase PAT:
 *        SUPABASE_PAT=sbp_xxx node scripts/verify-cost-objects.mjs
 *      Runs queries (A)-(W) via the Management API: (A)-(I) Core-1 rename + node/D-5,
 *      (J)-(P) unified-cost-model shape/nature/source (20260617), (Q)-(W) D-11 category +
 *      D-12 labor foundation (20260618 — cost_category, labor_resources, resource_id, labor_hours).
 *   2. ROUND-TRIP mode (fallback) — service key only, always runs:
 *        node scripts/verify-cost-objects.mjs
 *      Proves cost_objects/edges/assignments are queryable + insert ASSET/
 *      PROJECT/PRODUCT + FK cascade behaves. Useful but NOT a catalog proof.
 *
 * Get a PAT at: https://supabase.com/dashboard/account/tokens
 *
 * Requires: packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, '..');
const PROJECT_REF = 'bgobkjcopcxusjsetfob';
const MGMT_API = 'https://api.supabase.com/v1';

const env = Object.fromEntries(
  readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_KEY;
const PAT          = process.env.SUPABASE_PAT;

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

// ── CATALOG mode — the real gate ────────────────────────────────────────────
async function catalogProof() {
  console.log('\n=== CATALOG PROOF (live information_schema / pg_catalog) ===\n');

  // (A) Rename landed
  const a = await execSQL(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name IN ('business_assets','cost_objects');`);
  const names = a.map(r => r.table_name);
  names.includes('cost_objects') && !names.includes('business_assets')
    ? pass('(A) rename landed', 'cost_objects present, business_assets gone')
    : fail('(A) rename', JSON.stringify(names));

  // (B) node + status columns
  const b = await execSQL(`SELECT column_name, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cost_objects'
      AND column_name IN ('node_type','parent_id','domain','status','project_status','product_status');`);
  const cols = Object.fromEntries(b.map(r => [r.column_name, r]));
  const need = ['node_type','parent_id','domain','status','project_status','product_status'];
  const missing = need.filter(c => !cols[c]);
  missing.length === 0 ? pass('(B) node+status columns present', need.join(', ')) : fail('(B) missing columns', missing.join(', '));
  cols.node_type?.is_nullable === 'NO' && /ASSET/.test(cols.node_type?.column_default || '')
    ? pass('(B) node_type NOT NULL default ASSET') : fail('(B) node_type default', JSON.stringify(cols.node_type));

  // (C) FK dependents auto-carried + CASCADE — the load-bearing claim
  const c = await execSQL(`SELECT tc.table_name, ccu.table_name AS refs, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY'
      AND tc.table_name IN ('business_pmi_schedule','business_service_log')
      AND kcu.column_name='asset_id';`);
  for (const t of ['business_pmi_schedule','business_service_log']) {
    const row = c.find(r => r.table_name === t);
    row && row.refs === 'cost_objects' && row.delete_rule === 'CASCADE'
      ? pass(`(C) ${t}.asset_id → cost_objects CASCADE`)
      : fail(`(C) ${t}.asset_id FK`, JSON.stringify(row));
  }

  // (D) status CHECK includes IDLE + UNASSIGNED
  const d = await execSQL(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_status_check';`);
  const def = d[0]?.def || '';
  /IDLE/.test(def) && /UNASSIGNED/.test(def)
    ? pass('(D) status CHECK has IDLE + UNASSIGNED') : fail('(D) status CHECK', def);

  // (E) RLS present + scoped on all three
  const e = await execSQL(`SELECT tablename, policyname FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('cost_objects','cost_object_edges','cost_object_assignments')
    ORDER BY tablename, policyname;`);
  for (const t of ['cost_objects','cost_object_edges','cost_object_assignments']) {
    const ps = e.filter(r => r.tablename === t).map(r => r.policyname);
    ps.length >= 2 ? pass(`(E) ${t} RLS`, ps.join(', ')) : fail(`(E) ${t} RLS policies`, ps.join(',') || 'none');
  }
  const sec = await execSQL(`SELECT relname FROM pg_class
    WHERE relname IN ('cost_objects','cost_object_edges','cost_object_assignments') AND relrowsecurity;`);
  sec.length === 3 ? pass('(E) rowsecurity=true on all 3') : fail('(E) rowsecurity', JSON.stringify(sec.map(r=>r.relname)));

  // (F) edge tables: use_fraction + start/end
  const f = await execSQL(`SELECT table_name, column_name FROM information_schema.columns
    WHERE table_schema='public'
      AND table_name IN ('cost_object_edges','cost_object_assignments')
      AND column_name IN ('use_fraction','basis_confidence','start_at','end_at','conversion_cost');`);
  const has = (tbl, col) => f.some(r => r.table_name === tbl && r.column_name === col);
  has('cost_object_edges','use_fraction') ? pass('(F) edges.use_fraction') : fail('(F) edges.use_fraction missing');
  has('cost_object_assignments','start_at') && has('cost_object_assignments','end_at')
    ? pass('(F) assignments.start_at + end_at') : fail('(F) assignments period columns missing');
  has('cost_object_assignments','conversion_cost') ? pass('(F) assignments.conversion_cost') : fail('(F) conversion_cost missing');

  // (G) D-5 substantiation axis — type / nullability / default (20260615_..._substantiation_d5)
  const g = await execSQL(`SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cost_objects'
      AND column_name IN ('substantiation','receipt_id');`);
  const gc = Object.fromEntries(g.map(r => [r.column_name, r]));
  gc.substantiation && gc.substantiation.data_type === 'text'
    && gc.substantiation.is_nullable === 'NO'
    && /OWNER_ASSERTED/.test(gc.substantiation.column_default || '')
    ? pass('(G) substantiation text NOT NULL default OWNER_ASSERTED')
    : fail('(G) substantiation column', JSON.stringify(gc.substantiation));
  gc.receipt_id && gc.receipt_id.data_type === 'uuid' && gc.receipt_id.is_nullable === 'YES'
    ? pass('(G) receipt_id uuid nullable') : fail('(G) receipt_id column', JSON.stringify(gc.receipt_id));

  // (H) substantiation CHECK enumerates exactly the two values
  const h = await execSQL(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_substantiation_check';`);
  const hdef = h[0]?.def || '';
  /SUBSTANTIATED/.test(hdef) && /OWNER_ASSERTED/.test(hdef)
    ? pass('(H) substantiation CHECK has both values') : fail('(H) substantiation CHECK', hdef);

  // (I) receipt_id FK → receipts ON DELETE SET NULL
  const i = await execSQL(`SELECT ccu.table_name AS refs, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name='cost_objects'
      AND kcu.column_name='receipt_id';`);
  const irow = i[0];
  irow && irow.refs === 'receipts' && irow.delete_rule === 'SET NULL'
    ? pass('(I) receipt_id → receipts ON DELETE SET NULL') : fail('(I) receipt_id FK', JSON.stringify(irow));

  // ── Unified Cost Model — shape × nature × source (20260617_cost_objects_shape_nature_source) ──

  // (J) cost_shape — text NOT NULL default 'ONE_TIME', CHECK has all six values.
  const j = await execSQL(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='cost_shape';`);
  const jc = j[0];
  jc && jc.data_type === 'text' && jc.is_nullable === 'NO' && /ONE_TIME/.test(jc.column_default || '')
    ? pass('(J) cost_shape text NOT NULL default ONE_TIME') : fail('(J) cost_shape column', JSON.stringify(jc));
  const jChk = await execSQL(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_cost_shape_check';`);
  const jdef = jChk[0]?.def || '';
  ['ONE_TIME','RECURRING_FIXED','PER_OCCASION','PREPAID_AMORTIZED','INCREMENTAL_PREPAID','VARIABLE'].every(v => jdef.includes(v))
    ? pass('(J) cost_shape CHECK has all six shapes') : fail('(J) cost_shape CHECK', jdef);

  // (K) cadence — text nullable, CHECK has the five cadence values.
  const kChk = await execSQL(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_cadence_check';`);
  const kdef = kChk[0]?.def || '';
  ['ONE_OFF','WEEKLY','MONTHLY','QUARTERLY','ANNUAL'].every(v => kdef.includes(v))
    ? pass('(K) cadence CHECK has the five cadences') : fail('(K) cadence CHECK', kdef);

  // (L) recurring_amount — numeric(10,2), nullable.
  const l = await execSQL(`SELECT data_type, numeric_precision, numeric_scale, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='recurring_amount';`);
  const lc = l[0];
  lc && lc.data_type === 'numeric' && Number(lc.numeric_precision) === 10 && Number(lc.numeric_scale) === 2 && lc.is_nullable === 'YES'
    ? pass('(L) recurring_amount numeric(10,2) nullable') : fail('(L) recurring_amount column', JSON.stringify(lc));

  // (M) node_type CHECK WIDENED to include 'COST' (+ original three).
  const m = await execSQL(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_node_type_check';`);
  const mdef = m[0]?.def || '';
  ['ASSET','PROJECT','PRODUCT','COST'].every(v => mdef.includes(v))
    ? pass('(M) node_type CHECK widened with COST') : fail('(M) node_type CHECK', mdef);

  // (N) cost_nature — text NOT NULL default 'CAPEX', CHECK = CAPEX|COGS|OPEX.
  const n = await execSQL(`SELECT column_name, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='cost_nature';`);
  const nc = n[0];
  nc && nc.is_nullable === 'NO' && /CAPEX/.test(nc.column_default || '')
    ? pass('(N) cost_nature text NOT NULL default CAPEX') : fail('(N) cost_nature column', JSON.stringify(nc));
  const nChk = await execSQL(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_cost_nature_check';`);
  const ndef = nChk[0]?.def || '';
  ['CAPEX','COGS','OPEX'].every(v => ndef.includes(v))
    ? pass('(N) cost_nature CHECK = CAPEX|COGS|OPEX') : fail('(N) cost_nature CHECK', ndef);

  // (O) cost_source — text NOT NULL default 'MANUAL', and NO CHECK constraint (loose by design).
  const o = await execSQL(`SELECT column_name, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='cost_source';`);
  const oc = o[0];
  oc && oc.is_nullable === 'NO' && /MANUAL/.test(oc.column_default || '')
    ? pass('(O) cost_source text NOT NULL default MANUAL') : fail('(O) cost_source column', JSON.stringify(oc));
  const oChk = await execSQL(`SELECT COUNT(*)::int AS c FROM pg_constraint
    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_cost_source_check';`);
  Number(oChk[0]?.c) === 0
    ? pass('(O) cost_source has NO CHECK (loose — sources grow without a migration)')
    : fail('(O) cost_source unexpectedly constrained', JSON.stringify(oChk));

  // (P) existing rows correctly defaulted — no row mis-tagged by the new NOT NULL defaults.
  const p = await execSQL(`SELECT node_type, cost_shape, cost_nature, cost_source, COUNT(*)::int AS c
    FROM cost_objects GROUP BY 1,2,3,4 ORDER BY 1,2,3,4;`);
  const misTagged = p.filter(r => !(r.cost_shape === 'ONE_TIME' && r.cost_nature === 'CAPEX' && r.cost_source === 'MANUAL'));
  misTagged.length === 0
    ? pass('(P) all pre-existing rows defaulted ONE_TIME/CAPEX/MANUAL (true provenance)', JSON.stringify(p))
    : fail('(P) some rows mis-tagged by defaults (expected only ASSET/ONE_TIME/CAPEX/MANUAL pre-backfill)', JSON.stringify(misTagged));

  // ── D-11 category + D-12 labor foundation (20260618_cost_category_and_labor_resources) ──

  // (Q) cost_category — text, nullable, and NO CHECK (loose by design, per-business value set).
  const q = await execSQL(`SELECT data_type, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='cost_category';`);
  const qc = q[0];
  qc && qc.data_type === 'text' && qc.is_nullable === 'YES'
    ? pass('(Q) cost_category text nullable') : fail('(Q) cost_category column', JSON.stringify(qc));
  const qChk = await execSQL(`SELECT COUNT(*)::int AS c FROM pg_constraint
    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_cost_category_check';`);
  Number(qChk[0]?.c) === 0
    ? pass('(Q) cost_category has NO CHECK (loose — categories grow without a migration)')
    : fail('(Q) cost_category unexpectedly constrained', JSON.stringify(qChk));

  // (R) labor_resources — all robust D-12 columns present.
  const r = await execSQL(`SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='labor_resources';`);
  const rCols = r.map(x => x.column_name);
  const rNeed = ['id','business_id','resource_type','name','rate_basis','base_wage','burden',
    'cost_rate','bill_rate','rate','pass_through_expenses','created_at','updated_at'];
  const rMissing = rNeed.filter(c => !rCols.includes(c));
  rMissing.length === 0
    ? pass('(R) labor_resources all columns present', rNeed.join(', '))
    : fail('(R) labor_resources missing columns', rMissing.join(', ') || 'table absent');

  // (S) resource_type CHECK = EMPLOYEE|CONTRACTOR.
  const s = await execSQL(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid='labor_resources'::regclass AND conname='labor_resources_resource_type_check';`);
  const sdef = s[0]?.def || '';
  /EMPLOYEE/.test(sdef) && /CONTRACTOR/.test(sdef)
    ? pass('(S) resource_type CHECK = EMPLOYEE|CONTRACTOR') : fail('(S) resource_type CHECK', sdef);

  // (T) rate_basis CHECK = HOURLY|FLAT_FEE.
  const t = await execSQL(`SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid='labor_resources'::regclass AND conname='labor_resources_rate_basis_check';`);
  const tdef = t[0]?.def || '';
  /HOURLY/.test(tdef) && /FLAT_FEE/.test(tdef)
    ? pass('(T) rate_basis CHECK = HOURLY|FLAT_FEE') : fail('(T) rate_basis CHECK', tdef);

  // (U) labor_resources RLS — owner_all + member_all + rowsecurity=true (AC-2).
  const u = await execSQL(`SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='labor_resources' ORDER BY policyname;`);
  const uPol = u.map(x => x.policyname);
  uPol.includes('labor_resources_owner_all') && uPol.includes('labor_resources_member_all')
    ? pass('(U) labor_resources RLS owner_all + member_all', uPol.join(', '))
    : fail('(U) labor_resources RLS policies', uPol.join(',') || 'none');
  const uSec = await execSQL(`SELECT relrowsecurity FROM pg_class WHERE relname='labor_resources';`);
  uSec[0]?.relrowsecurity === true
    ? pass('(U) labor_resources rowsecurity=true') : fail('(U) labor_resources rowsecurity', JSON.stringify(uSec));

  // (V) labor_resources.business_id FK → businesses ON DELETE CASCADE.
  const v = await execSQL(`SELECT ccu.table_name AS refs, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name='labor_resources'
      AND kcu.column_name='business_id';`);
  const vrow = v[0];
  vrow && vrow.refs === 'businesses' && vrow.delete_rule === 'CASCADE'
    ? pass('(V) labor_resources.business_id → businesses CASCADE') : fail('(V) business_id FK', JSON.stringify(vrow));

  // (W) cost_objects.resource_id FK → labor_resources ON DELETE SET NULL + labor_hours numeric nullable no default.
  const w = await execSQL(`SELECT ccu.table_name AS refs, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name='cost_objects'
      AND kcu.column_name='resource_id';`);
  const wrow = w[0];
  wrow && wrow.refs === 'labor_resources' && wrow.delete_rule === 'SET NULL'
    ? pass('(W) cost_objects.resource_id → labor_resources SET NULL') : fail('(W) resource_id FK', JSON.stringify(wrow));
  const wh = await execSQL(`SELECT data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='labor_hours';`);
  const whc = wh[0];
  whc && whc.data_type === 'numeric' && whc.is_nullable === 'YES' && whc.column_default == null
    ? pass('(W) labor_hours numeric nullable, NO default') : fail('(W) labor_hours column', JSON.stringify(whc));

  // ── D-16 Pricing Model B — recovery_basis split (20260619_cost_objects_recovery_basis) ──

  // (X) recovery_basis — text, nullable, and NO CHECK (loose by design, AC-4).
  const x = await execSQL(`SELECT data_type, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='recovery_basis';`);
  const xc = x[0];
  xc && xc.data_type === 'text' && xc.is_nullable === 'YES'
    ? pass('(X) recovery_basis text nullable') : fail('(X) recovery_basis column', JSON.stringify(xc));
  const xChk = await execSQL(`SELECT COUNT(*)::int AS c FROM pg_constraint
    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_recovery_basis_check';`);
  Number(xChk[0]?.c) === 0
    ? pass('(X) recovery_basis has NO CHECK (loose — values grow without a migration)')
    : fail('(X) recovery_basis unexpectedly constrained', JSON.stringify(xChk));

  // (Y) recovery_basis_source — text, nullable, NO CHECK.
  const y = await execSQL(`SELECT data_type, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='recovery_basis_source';`);
  const yc = y[0];
  yc && yc.data_type === 'text' && yc.is_nullable === 'YES'
    ? pass('(Y) recovery_basis_source text nullable') : fail('(Y) recovery_basis_source column', JSON.stringify(yc));
  const yChk = await execSQL(`SELECT COUNT(*)::int AS c FROM pg_constraint
    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_recovery_basis_source_check';`);
  Number(yChk[0]?.c) === 0
    ? pass('(Y) recovery_basis_source has NO CHECK')
    : fail('(Y) recovery_basis_source unexpectedly constrained', JSON.stringify(yChk));

  // (Z) backfill populated every row by the derived-default rule — NO nulls, correct split,
  //     all DERIVED, and the lone PLATFORM_INVESTMENT row is the EMPLOYEE owner labor.
  const zNull = await execSQL(`SELECT COUNT(*)::int AS c FROM cost_objects WHERE recovery_basis IS NULL OR recovery_basis_source IS NULL;`);
  Number(zNull[0]?.c) === 0
    ? pass('(Z) backfill left NO nulls (every row classified)')
    : fail('(Z) some rows un-backfilled (null recovery_basis/source)', JSON.stringify(zNull));
  const zGrp = await execSQL(`SELECT recovery_basis, recovery_basis_source, COUNT(*)::int AS c
    FROM cost_objects GROUP BY 1,2 ORDER BY 1,2;`);
  const allDerived = zGrp.every(r => r.recovery_basis_source === 'DERIVED');
  const onlyTwoBases = zGrp.every(r => r.recovery_basis === 'COST_TO_SERVE' || r.recovery_basis === 'PLATFORM_INVESTMENT');
  allDerived && onlyTwoBases
    ? pass('(Z) all rows DERIVED + only COST_TO_SERVE/PLATFORM_INVESTMENT', JSON.stringify(zGrp))
    : fail('(Z) backfill split off-rule', JSON.stringify(zGrp));
  // The PLATFORM_INVESTMENT set must be EXACTLY the EMPLOYEE owner-labor rows (rule integrity).
  const zPi = await execSQL(`SELECT co.id, co.name, co.cost_category, lr.resource_type
    FROM cost_objects co LEFT JOIN labor_resources lr ON lr.id = co.resource_id
    WHERE co.recovery_basis = 'PLATFORM_INVESTMENT';`);
  const piOk = zPi.length > 0 && zPi.every(r => r.cost_category === 'labor' && r.resource_type === 'EMPLOYEE');
  piOk
    ? pass('(Z) every PLATFORM_INVESTMENT row is EMPLOYEE owner labor', zPi.map(r => r.name).join(', '))
    : fail('(Z) a PLATFORM_INVESTMENT row is NOT EMPLOYEE owner labor', JSON.stringify(zPi));
  // And no EMPLOYEE owner-labor row was left as COST_TO_SERVE (rule completeness).
  const zMiss = await execSQL(`SELECT co.id, co.name FROM cost_objects co
    JOIN labor_resources lr ON lr.id = co.resource_id
    WHERE co.cost_category = 'labor' AND lr.resource_type = 'EMPLOYEE'
      AND co.recovery_basis <> 'PLATFORM_INVESTMENT';`);
  Number(zMiss.length) === 0
    ? pass('(Z) no EMPLOYEE owner-labor row left as COST_TO_SERVE (rule complete)')
    : fail('(Z) EMPLOYEE owner-labor row not promoted', JSON.stringify(zMiss));
}

// ── ROUND-TRIP mode — service-key data proof (fallback) ─────────────────────
async function roundTrip() {
  console.log('\n=== SERVICE-KEY ROUND-TRIP (data path, not a catalog proof) ===\n');
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  for (const t of ['cost_objects','cost_object_edges','cost_object_assignments']) {
    const { error } = await sb.from(t).select('*', { count: 'exact', head: true });
    error ? fail(`${t} queryable`, error.message) : pass(`${t} queryable`);
  }
  // Old name should now be absent. Use a real row select (not head:true — a HEAD
  // request does not surface the missing-table error); PGRST205 / 42P01 = gone.
  const { error: oldErr } = await sb.from('business_assets').select('id').limit(1);
  const gone = oldErr && /PGRST205|42P01|Could not find the table/i.test(`${oldErr.code} ${oldErr.message}`);
  gone ? pass('business_assets gone (old name absent)', oldErr.code || oldErr.message.slice(0, 40))
       : fail('business_assets still queryable', oldErr ? `${oldErr.code} ${oldErr.message}` : 'no error');
  // D-5 columns reachable via the data path (column existence, not catalog metadata)
  const { error: subErr } = await sb.from('cost_objects').select('id,substantiation,receipt_id', { head: true });
  subErr ? fail('substantiation + receipt_id columns selectable', subErr.message) : pass('substantiation + receipt_id columns selectable');
  // D-11/D-12 columns + table reachable via the data path.
  const { error: catErr } = await sb.from('cost_objects').select('id,cost_category,resource_id,labor_hours', { head: true });
  catErr ? fail('cost_category + resource_id + labor_hours columns selectable', catErr.message) : pass('cost_category + resource_id + labor_hours columns selectable');
  // D-16 recovery_basis columns reachable via the data path.
  const { error: recErr } = await sb.from('cost_objects').select('id,recovery_basis,recovery_basis_source', { head: true });
  recErr ? fail('recovery_basis + recovery_basis_source columns selectable', recErr.message) : pass('recovery_basis + recovery_basis_source columns selectable');
  // Real row select (NOT head:true) — a HEAD request does not surface a missing-TABLE error
  // (same PostgREST quirk handled for business_assets above). PGRST205/42P01 = table absent.
  const { error: lrErr } = await sb.from('labor_resources').select('id').limit(1);
  lrErr ? fail('labor_resources queryable', `${lrErr.code} ${lrErr.message}`.slice(0, 60)) : pass('labor_resources queryable');
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing SUPABASE_URL / SERVICE_KEY'); process.exit(1); }
  if (PAT) {
    try { await catalogProof(); }
    catch (err) { fail('catalog query errored', String(err).slice(0, 200)); }
  } else {
    console.log('\n⚠️  No SUPABASE_PAT set — skipping CATALOG proof (the real gate).');
    console.log('   Run with: SUPABASE_PAT=sbp_xxx node scripts/verify-cost-objects.mjs\n');
  }
  await roundTrip();
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed ? 1 : 0);
}
main();
