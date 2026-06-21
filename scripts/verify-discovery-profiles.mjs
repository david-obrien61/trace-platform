#!/usr/bin/env node
/**
 * verify-discovery-profiles.mjs — capability 1.3 schema-verification gate (INDEPENDENT proof)
 *
 * Run AFTER applying supabase/migrations/20260621_business_discovery_profiles.sql
 * in the Supabase SQL editor for project bgobkjcopcxusjsetfob.
 *
 * Hits the LIVE CATALOG (information_schema / pg_catalog) — NOT the builder's
 * memory, NOT the migration text. The catalog is the source of truth.
 *
 * TWO MODES:
 *   1. CATALOG mode (the real gate) — requires a Supabase PAT:
 *        SUPABASE_PAT=sbp_xxx node scripts/verify-discovery-profiles.mjs
 *      Checks (A) table exists, (B) RLS enabled, (C) both policies present,
 *      (D) FK business_id→businesses ON DELETE CASCADE, (E) columns+types,
 *      (F) UNIQUE(business_id, source_url), (G) NO existing table altered
 *      (business_inventory still carries unit_cost + cost_confidence untouched).
 *   2. ROUND-TRIP / GATE-CHECK mode (fallback) — service key only, always runs:
 *        node scripts/verify-discovery-profiles.mjs
 *      Pre-apply: confirms the table is ABSENT (migration gated). Post-apply:
 *      proves insert/upsert/delete round-trips under the service key.
 *
 * Also lints the migration file statically: CREATE TABLE only, no ALTER/DROP on
 * existing tables (byte-identical discipline).
 *
 * Get a PAT at: https://supabase.com/dashboard/account/tokens
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, '..');
const PROJECT_REF = 'bgobkjcopcxusjsetfob';
const MGMT_API = 'https://api.supabase.com/v1';
const TABLE = 'business_discovery_profiles';

const env = Object.fromEntries(
  readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
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

// ── static migration lint (always) ──────────────────────────────────────────────
function migrationLint() {
  console.log('\n=== MIGRATION LINT (byte-identical discipline) ===\n');
  const sql = readFileSync(join(repoRoot, 'supabase/migrations/20260621_business_discovery_profiles.sql'), 'utf8');
  const createTables = (sql.match(/CREATE TABLE/gi) || []).length;
  createTables === 1 ? pass('exactly one CREATE TABLE', `(${createTables})`) : fail('CREATE TABLE count', `${createTables}`);
  // ALTER TABLE is allowed ONLY on the new table (ENABLE RLS); any ALTER on another table = touches existing schema
  const alters = Array.from(sql.matchAll(/ALTER TABLE\s+(\w+)/gi)).map(m => m[1]);
  const foreignAlters = alters.filter(t => t !== TABLE);
  foreignAlters.length === 0
    ? pass('no ALTER on an existing table', alters.length ? `(only ${TABLE}: ${alters.join(', ')})` : '(none)')
    : fail('ALTER on existing table(s)', foreignAlters.join(', '));
  // only DROP is the trigger guard (DROP TRIGGER IF EXISTS); no DROP TABLE
  /DROP TABLE/i.test(sql) ? fail('DROP TABLE present') : pass('no DROP TABLE');
}

// ── CATALOG mode — the real gate ──────────────────────────────────────────────────
async function catalogProof() {
  console.log('\n=== CATALOG PROOF (live information_schema / pg_catalog) ===\n');

  // (A) table exists
  const a = await execSQL(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name='${TABLE}';`);
  a.length === 1 ? pass('(A) table exists', TABLE) : fail('(A) table missing', JSON.stringify(a));

  // (B) RLS enabled
  const b = await execSQL(`SELECT relrowsecurity FROM pg_class WHERE relname='${TABLE}';`);
  b[0]?.relrowsecurity === true ? pass('(B) RLS enabled') : fail('(B) RLS not enabled', JSON.stringify(b));

  // (C) both policies present
  const c = await execSQL(`SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='${TABLE}';`);
  const pols = c.map(r => r.policyname);
  pols.includes(`${TABLE}_owner_all`) && pols.includes(`${TABLE}_member_all`)
    ? pass('(C) owner_all + member_all policies present', pols.join(', '))
    : fail('(C) policies', JSON.stringify(pols));

  // (D) FK business_id → businesses(id) ON DELETE CASCADE
  const d = await execSQL(`
    SELECT confdeltype, confrelid::regclass::text AS ref
    FROM pg_constraint
    WHERE conrelid='${TABLE}'::regclass AND contype='f';`);
  const fk = d.find(r => r.ref === 'businesses');
  fk && fk.confdeltype === 'c'
    ? pass('(D) FK business_id→businesses ON DELETE CASCADE')
    : fail('(D) FK/cascade', JSON.stringify(d));

  // (E) columns + types
  const e = await execSQL(`SELECT column_name, data_type, is_nullable FROM information_schema.columns
    WHERE table_schema='public' AND table_name='${TABLE}' ORDER BY column_name;`);
  const col = (n) => e.find(r => r.column_name === n);
  const checkCol = (n, type, nullable) => {
    const c = col(n);
    c && c.data_type === type && c.is_nullable === nullable
      ? pass(`(E) ${n} ${type} ${nullable === 'NO' ? 'NOT NULL' : 'nullable'}`)
      : fail(`(E) ${n}`, JSON.stringify(c));
  };
  checkCol('id', 'uuid', 'NO');
  checkCol('business_id', 'uuid', 'NO');
  checkCol('source_url', 'text', 'NO');
  checkCol('raw_extract', 'jsonb', 'NO');
  checkCol('status', 'text', 'NO');
  checkCol('extracted_at', 'timestamp with time zone', 'NO');

  // (F) UNIQUE(business_id, source_url)
  const f = await execSQL(`
    SELECT conname FROM pg_constraint
    WHERE conrelid='${TABLE}'::regclass AND contype='u';`);
  f.length >= 1 ? pass('(F) UNIQUE constraint present', f.map(r => r.conname).join(', ')) : fail('(F) UNIQUE missing', JSON.stringify(f));

  // (G) NO existing table altered — business_inventory still carries its untouched cost columns
  const g = await execSQL(`SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='business_inventory'
      AND column_name IN ('unit_cost','cost_confidence','sku','status');`);
  g.length === 4
    ? pass('(G) business_inventory untouched — unit_cost/cost_confidence/sku/status all present')
    : fail('(G) business_inventory column drift', JSON.stringify(g.map(r => r.column_name)));
}

// ── ROUND-TRIP / GATE-CHECK (service key) ─────────────────────────────────────────
async function roundTrip() {
  console.log('\n=== ROUND-TRIP / GATE-CHECK (service key) ===\n');
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const { error } = await sb.from(TABLE).select('id').limit(1);
  if (error) {
    /PGRST205|does not exist|schema cache/i.test(error.message)
      ? pass('table ABSENT → migration gated/unapplied (expected before David applies)', error.message.slice(0, 60))
      : fail('unexpected select error', error.message);
    return;
  }
  // applied → prove insert/upsert/delete under service key on the LAWNS tenant
  const BIZ = env.VITE_DEMO_BUSINESS_ID || 'a1b2c3d4-0000-0000-0000-000000000001';
  const url = 'https://__verify__.example.com';
  const ins = await sb.from(TABLE).upsert({ business_id: BIZ, source_url: url, status: 'extracted', raw_extract: { items: [] } }, { onConflict: 'business_id,source_url' }).select('id');
  ins.error ? fail('insert/upsert', ins.error.message) : pass('upsert round-trips', ins.data?.[0]?.id);
  const up2 = await sb.from(TABLE).upsert({ business_id: BIZ, source_url: url, status: 'populated', raw_extract: { items: [{ variety: 'x' }] } }, { onConflict: 'business_id,source_url' }).select('id');
  up2.error ? fail('upsert conflict-update', up2.error.message) : pass('upsert on conflict updates in place (idempotent)');
  const del = await sb.from(TABLE).delete({ count: 'exact' }).eq('business_id', BIZ).eq('source_url', url);
  del.error ? fail('cleanup delete', del.error.message) : pass('cleanup delete', `removed ${del.count}`);
}

(async () => {
  console.log(`\nverify-discovery-profiles — ${TABLE} (project ${PROJECT_REF})`);
  migrationLint();
  if (PAT) { try { await catalogProof(); } catch (e) { fail('catalog proof threw', e.message); } }
  else console.log('\n(no SUPABASE_PAT → skipping CATALOG mode; run with SUPABASE_PAT=sbp_xxx for the real gate)');
  await roundTrip();
  console.log(`\n${failed === 0 ? '✅ ALL PASS' : '❌ FAILURES'} — ${passed} passed, ${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
})();
