#!/usr/bin/env node
/**
 * Service-key proof for the EXTRACTED customer find-or-create (Wave 2).
 * Exercises the SAME findOrCreateCustomer the cart (submit.ts) and the new OCR-invoice
 * endpoint both call — so this proves both paths at once:
 *   1. OCR-invoice create   → source='ocr-invoice', created:true
 *   2. dedup-by-email       → second call same email → created:false (no duplicate row)
 *   3. cart path (qr-scan)  → same email, source='qr-scan' → still dedups (created:false),
 *                             source NOT overwritten (provenance preserved)
 *   4. email-less create    → no email → created:true, NOT collapsed onto #1
 * Creates only __PROOF rows and deletes them at the end (real customer data untouched).
 * Requires packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { findOrCreateCustomer } from '/tmp/customerUpsert.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const env = Object.fromEntries(
  readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8')
    .split('\n').filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

const BIZ = '45830ba7-9961-403f-b048-77f022fb48dc'; // TRACE Enterprises
const EMAIL = `__proof_ocr_${Date.now()}@example.com`;
const ids = new Set();
let pass = true;
const check = (label, ok, detail = '') => { console.log(`  ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ' :: ' + detail : ''}`); if (!ok) pass = false; };

async function main() {
  console.log('verify-customer-upsert — business', BIZ, '\n');

  // 1. OCR-invoice create
  const r1 = await findOrCreateCustomer(sb, BIZ, { first_name: '__PROOF Ada', last_name: 'Lovelace', email: EMAIL, phone: '512-555-0101', address_line1: '1 Bill St', city: 'Leander', state: 'TX', zip: '78641' }, 'ocr-invoice');
  ids.add(r1.customerId);
  check('OCR-invoice create → created:true', r1.created === true, `id=${r1.customerId.slice(0,8)}`);
  const { data: row1 } = await sb.from('customers').select('source,first_name').eq('id', r1.customerId).single();
  check("source tagged 'ocr-invoice'", row1?.source === 'ocr-invoice', `source=${row1?.source}`);

  // 2. dedup-by-email — same email again → no new row
  const r2 = await findOrCreateCustomer(sb, BIZ, { first_name: '__PROOF Ada B', email: EMAIL }, 'ocr-invoice');
  check('dedup-by-email → created:false (same id)', r2.created === false && r2.customerId === r1.customerId);

  // 3. cart path (qr-scan) same email → still dedups; source provenance preserved
  const r3 = await findOrCreateCustomer(sb, BIZ, { first_name: '__PROOF Ada', last_name: 'Lovelace', email: EMAIL }, 'qr-scan');
  check('cart (qr-scan) same email → created:false (cart path still resolves customers)', r3.created === false && r3.customerId === r1.customerId);
  const { data: row3 } = await sb.from('customers').select('source').eq('id', r1.customerId).single();
  check("update does NOT overwrite source (still 'ocr-invoice')", row3?.source === 'ocr-invoice', `source=${row3?.source}`);

  // 4. email-less create → new row, NOT collapsed onto #1
  const r4 = await findOrCreateCustomer(sb, BIZ, { first_name: '__PROOF NoEmail', last_name: null, email: null }, 'ocr-invoice');
  ids.add(r4.customerId);
  check('email-less create → created:true, distinct id', r4.created === true && r4.customerId !== r1.customerId);

  // cleanup
  const { error: delErr } = await sb.from('customers').delete().in('id', [...ids]);
  check('cleanup — __PROOF rows deleted', !delErr, delErr?.message ?? `${ids.size} removed`);

  console.log('\n' + (pass ? '✅ ALL PASS' : '❌ FAILURES ABOVE'));
  process.exit(pass ? 0 : 1);
}
main().catch(e => { console.error('ERROR', e.message); process.exit(1); });
