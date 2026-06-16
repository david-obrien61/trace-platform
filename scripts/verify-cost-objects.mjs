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
 *      Runs queries (A)-(F) from the migration footer via the Management API.
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
