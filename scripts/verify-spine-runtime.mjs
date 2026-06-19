/**
 * WAVE 0 TASK 0B — verify the live demo spine is runtime-real, not just code-real.
 *
 * Service-key probe (bypasses RLS — proves SCHEMA + data path; David owner-proves RLS/render).
 * For each spine surface: select the EXACT columns the code reads/writes. A missing table or
 * column surfaces as a Supabase error → proves the write would have failed at runtime.
 *
 * Requires packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY).
 * Read-only: SELECT with limit. No writes, no deletes.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync(new URL('../packages/cultivar-os/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const URL_ = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const KEY  = env.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
const sb = createClient(URL_, KEY);

const DEMO = 'a1b2c3d4-0000-0000-0000-000000000001';

// surface label → [table, columns the spine code touches, optional tenant filter]
const PROBES = [
  ['2.1 cart — cultivar_plants',        'cultivar_plants',          'id,common_name,species,current_container', false],
  ['2.1 cart — business_inventory',     'business_inventory',       'id,status,unit_cost,business_id',          true],
  ['2.2 netting — orders write cols',   'orders',                   'id,transport_note,netting_declined,leakage_flag,status,qb_invoice_id,qb_invoice_url', true],
  ['2.2 netting — order_items',         'order_items',              'id,order_id',                              false],
  ['2.2 netting — order_service_selections', 'order_service_selections', 'id,order_id',                       false],
  ['2.2 netting — order_compliance_records', 'order_compliance_records', 'id',                                false],
  ['2.x customers — qb_customer_id',    'customers',                'id,qb_customer_id,business_id',            true],
  ['3.1 leakage_flag on orders',        'orders',                   'id,leakage_flag',                          true],
  ['3.6 dashboard — businesses',        'businesses',               'id,name',                                  false],
  ['5.1 inventory — business_inventory','business_inventory',       'id,status,business_id',                    true],
  ['5.2 PMI — business_pmi_schedule',   'business_pmi_schedule',    'id,business_id',                           true],
];

let pass = 0, fail = 0;
console.log('=== WAVE 0 / 0B — live spine runtime probe (service-key, read-only) ===\n');
for (const [label, table, cols, tenant] of PROBES) {
  let q = sb.from(table).select(cols).limit(3);
  if (tenant) q = q.eq('business_id', DEMO);
  const { data, error } = await q;
  if (error) {
    fail++;
    console.log(`  ✗ ${label.padEnd(42)} → ${table}: ${error.code || ''} ${error.message}`);
  } else {
    pass++;
    console.log(`  ✓ ${label.padEnd(42)} → ${table}: cols OK, ${data.length} row(s)${tenant ? ` for demo tenant` : ''}`);
  }
}
console.log(`\n=== ${pass} pass / ${fail} fail ===`);
process.exit(fail ? 1 : 0);
