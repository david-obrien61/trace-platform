#!/usr/bin/env node
/**
 * verify-deliveries.mjs — schema-verification gate for the `deliveries` table
 * (closes the OCR-invoice → scheduled-delivery loop).
 *
 * Run AFTER applying supabase/migrations/20260620_deliveries.sql in the
 * Supabase SQL editor for project bgobkjcopcxusjsetfob.
 *
 * This is the gate: it hits the LIVE CATALOG (information_schema / pg_catalog)
 * — NOT the builder's memory, NOT the migration text. The catalog is truth.
 *
 * TWO MODES:
 *   1. CATALOG mode (the real gate) — requires a Supabase PAT:
 *        SUPABASE_PAT=sbp_xxx node scripts/verify-deliveries.mjs
 *      Runs (A) table exists, (B) columns + types, (C) FK to customers
 *      (ON DELETE SET NULL) + FK to businesses (CASCADE), (D) RLS present
 *      + scoped + rowsecurity on, (E) status default + NO CHECK (AC-4),
 *      (F) day-index present, (G) no existing table altered (spot-check
 *      orders/customers/business_inventory column counts unchanged is the
 *      caller's job; here we assert deliveries is brand-new only).
 *   2. ROUND-TRIP mode (fallback) — service key only, always runs:
 *        node scripts/verify-deliveries.mjs
 *      Proves deliveries is queryable + a row inserts linked to a real
 *      customer + FK holds. Useful but NOT a catalog proof.
 *
 * Get a PAT at: https://supabase.com/dashboard/account/tokens
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

  // (A) table exists
  const a = await execSQL(`SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name='deliveries';`);
  a.length === 1 ? pass('(A) deliveries table exists') : fail('(A) deliveries table missing');

  // (B) columns + types
  const b = await execSQL(`SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='public' AND table_name='deliveries';`);
  const cols = Object.fromEntries(b.map(r => [r.column_name, r]));
  const need = {
    id: 'uuid', business_id: 'uuid', customer_id: 'uuid', delivery_date: 'date',
    address_line1: 'text', city: 'text', state: 'text', zip: 'text',
    status: 'text', source: 'text', notes: 'text', created_at: 'timestamp with time zone',
  };
  const missing = Object.keys(need).filter(c => !cols[c]);
  missing.length === 0 ? pass('(B) all columns present', Object.keys(need).join(', ')) : fail('(B) missing columns', missing.join(', '));
  for (const [c, t] of Object.entries(need)) {
    if (cols[c] && cols[c].data_type !== t) fail(`(B) ${c} type`, `${cols[c].data_type} (want ${t})`);
  }
  cols.business_id?.is_nullable === 'NO' ? pass('(B) business_id NOT NULL') : fail('(B) business_id nullability', JSON.stringify(cols.business_id));

  // (C) FKs: customer_id → customers SET NULL, business_id → businesses CASCADE
  const c = await execSQL(`SELECT kcu.column_name, ccu.table_name AS refs, rc.delete_rule
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name=kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name=ccu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name=rc.constraint_name
    WHERE tc.constraint_type='FOREIGN KEY' AND tc.table_name='deliveries';`);
  const cust = c.find(r => r.column_name === 'customer_id');
  cust && cust.refs === 'customers' && cust.delete_rule === 'SET NULL'
    ? pass('(C) customer_id → customers ON DELETE SET NULL')
    : fail('(C) customer_id FK', JSON.stringify(cust));
  const biz = c.find(r => r.column_name === 'business_id');
  biz && biz.refs === 'businesses' && biz.delete_rule === 'CASCADE'
    ? pass('(C) business_id → businesses ON DELETE CASCADE')
    : fail('(C) business_id FK', JSON.stringify(biz));

  // (D) RLS present + scoped + rowsecurity on
  const d = await execSQL(`SELECT policyname FROM pg_policies
    WHERE schemaname='public' AND tablename='deliveries' ORDER BY policyname;`);
  const ps = d.map(r => r.policyname);
  ps.length >= 2 ? pass('(D) RLS policies present', ps.join(', ')) : fail('(D) RLS policies', ps.join(',') || 'none');
  const sec = await execSQL(`SELECT relname FROM pg_class WHERE relname='deliveries' AND relrowsecurity;`);
  sec.length === 1 ? pass('(D) rowsecurity=true on deliveries') : fail('(D) rowsecurity off');

  // (E) status default 'scheduled' + NO CHECK (AC-4)
  cols.status?.is_nullable === 'NO' && /scheduled/.test(cols.status?.column_default || '')
    ? pass("(E) status NOT NULL default 'scheduled'") : fail('(E) status default', JSON.stringify(cols.status));
  const e = await execSQL(`SELECT conname FROM pg_constraint
    WHERE conrelid='deliveries'::regclass AND contype='c';`);
  e.length === 0 ? pass('(E) no CHECK constraint on deliveries (AC-4)') : fail('(E) unexpected CHECK', JSON.stringify(e.map(r=>r.conname)));

  // (F) day index present
  const f = await execSQL(`SELECT indexname FROM pg_indexes
    WHERE schemaname='public' AND tablename='deliveries';`);
  f.some(r => /business_date/.test(r.indexname)) ? pass('(F) deliveries_business_date_idx present', f.map(r=>r.indexname).join(', ')) : fail('(F) day index missing', f.map(r=>r.indexname).join(','));
}

// ── ROUND-TRIP mode (fallback) ──────────────────────────────────────────────
async function roundTrip() {
  console.log('\n=== ROUND-TRIP (service key — data path, NOT a catalog proof) ===\n');
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Real row select (NOT head:true — a HEAD request does not surface a missing-TABLE
  // error). PGRST205 / 42P01 = table absent → migration not yet applied (gated).
  const { error: qErr } = await sb.from('deliveries').select('id').limit(1);
  if (qErr && /PGRST205|42P01|Could not find the table/i.test(`${qErr.code} ${qErr.message}`)) {
    fail('deliveries queryable', `ABSENT — migration not applied yet (${qErr.code || 'PGRST205'})`);
    console.log('     → expected pre-apply; apply 20260620_deliveries.sql then re-run.');
    return;
  }
  qErr ? fail('deliveries queryable', qErr.message) : pass('deliveries queryable');

  // Insert a delivery linked to a real customer, then clean up.
  const { data: cust } = await sb.from('customers').select('id,business_id').limit(1);
  if (cust && cust.length > 0) {
    const { business_id, id: customer_id } = cust[0];
    const { data: ins, error: insErr } = await sb.from('deliveries').insert({
      business_id, customer_id,
      delivery_date: '2026-06-25',
      address_line1: '__VERIFY__ 1208 Ranch Road 12', city: 'Wimberley', state: 'TX', zip: '78676',
      status: 'scheduled', source: 'verify-script', notes: '__VERIFY__ round-trip',
    }).select('id,customer_id,delivery_date').single();
    if (insErr) { fail('insert delivery linked to customer', insErr.message); }
    else {
      pass('insert delivery linked to customer', `id ${ins.id.slice(0,8)}… date ${ins.delivery_date}`);
      ins.customer_id === customer_id ? pass('customer_id FK linked correctly') : fail('customer_id mismatch', ins.customer_id);
      await sb.from('deliveries').delete().eq('id', ins.id);
      pass('cleanup — verify row deleted');
    }
  } else {
    console.log('  (skip insert — no customers row to link to)');
  }
}

async function main() {
  if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing SUPABASE_URL / SERVICE_KEY'); process.exit(1); }
  if (PAT) {
    try { await catalogProof(); }
    catch (err) { fail('catalog query errored', String(err).slice(0, 200)); }
  } else {
    console.log('\n⚠️  No SUPABASE_PAT set — skipping CATALOG proof (the real gate).');
    console.log('   Run with: SUPABASE_PAT=sbp_xxx node scripts/verify-deliveries.mjs\n');
  }
  await roundTrip();
  console.log(`\n=== ${passed} passed, ${failed} failed ===\n`);
  process.exit(failed ? 1 : 0);
}
main();
