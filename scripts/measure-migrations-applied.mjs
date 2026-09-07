/**
 * ── rf-applied — READ-ONLY probe: which 2026-09 migrations are ACTUALLY applied ─────
 *
 * PURPOSE:      Settle the migration record from the LIVE CATALOG rather than from a
 *               status label. Three labels have now been wrong in the same direction
 *               (20260831d, 20260902, and the block reconciled this session), so a
 *               document is not evidence. Each migration is probed by an object it
 *               CREATES — a column, a table, a function.
 *
 * DEPENDENCIES: SUPABASE_URL + SUPABASE_SERVICE_KEY from .env.local (root or cultivar-os);
 *               @supabase/supabase-js. Run from a tree where node_modules resolves.
 *
 * OUTPUTS:      A per-migration APPLIED / NOT APPLIED table on stdout. WRITES NOTHING —
 *               every call is a bounded .select().limit(1).
 *
 * 🔴 WHY THERE IS NO `head: true` HERE, AND IT IS THE POINT OF THE FILE:
 *    the first draft used `.select('*', { head: true, count: 'exact' })` and its NEGATIVE
 *    CONTROL PASSED — a table that cannot exist returned **HTTP 204 with error: null**,
 *    so every migration read as APPLIED including the ones that are not. A head-only
 *    probe CANNOT DISAGREE ([[R-33]]). `.limit(1)` returns PGRST205 for a missing table
 *    and 42703 for a missing column, and the controls below prove it every run.
 *
 * Run: node scripts/rf-applied.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
for (const p of ['/Users/terrenceobrien/Desktop/trace-platform/.env.local',
                 '/Users/terrenceobrien/Desktop/trace-platform/packages/cultivar-os/.env.local']) {
  let t = ''; try { t = readFileSync(p, 'utf8'); } catch { continue; }
  for (const line of t.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    const v = m && m[2].replace(/^["']|["']$/g, '');
    if (m && v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.log('🔴 NO CREDENTIALS — cannot measure. Report as UNVERIFIED, never as applied.');
  process.exit(1);
}
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
console.log('URL:', process.env.SUPABASE_URL, '\n');

const probe = async (table, cols) => {
  const { error } = await db.from(table).select(cols).limit(1);
  return error ? { ok: false, note: `${error.code} ${(error.message || '').slice(0, 70)}` }
               : { ok: true, note: `${table}.${cols} readable` };
};

console.log('--- CONTROLS (both must REFUSE, or every verdict below is meaningless) ---');
const c1 = await probe('a_table_that_cannot_exist_rf', '*');
const c2 = await probe('customers', 'a_col_that_cannot_exist_rf');
console.log(c1.ok ? '🔴 TABLE CONTROL PASSED — STOP' : `✅ table control refused:  ${c1.note}`);
console.log(c2.ok ? '🔴 COLUMN CONTROL PASSED — STOP' : `✅ column control refused: ${c2.note}`);
if (c1.ok || c2.ok) process.exit(1);

const PROBES = [
  ['20260902_business_qbo_writes_switch.sql',        'businesses',         'id,qbo_writes_enabled'],
  ['20260902_receipt_line_edit_and_vendor_pref.sql', 'vendor_preferences', 'id'],
  ['20260902_vendor_identity_and_preference.sql',    'vendors',            'id'],
  ['20260902b_vendor_preferences_join_on_vid.sql',   'vendor_preferences', 'id,vendor_id'],
  ['20260903_inventory_retire_lifecycle.sql',        'business_inventory', 'id,retired_at,retired_reason'],
  ['20260903b_display_standards.sql',                'business_display_standards', 'id'],
  ['20260903c_receipts_receipt_number.sql',          'receipts',           'id,receipt_number'],
  ['20260904_receipts_receipt_number_original.sql',  'receipts',           'id,receipt_number_original'],
  ['20260905_production_planning.sql',               'production_plans',   'id'],
  ['20260905_production_planning.sql (lines)',       'production_plan_lines', 'id'],
  ['20260905_production_planning.sql (opscfg)',      'business_operations_config', 'id'],
  ['20260906_inventory_import_run_provenance.sql',   'business_inventory', 'id,import_run_id'],
  ['20260906b_customers_import_run.sql',             'customers',          'id,import_run_id'],
  ['20260907_customers_last_name_nullable.sql',      'customers',          'id,last_name'],
];
console.log('\n--- MIGRATIONS (from the catalog, not from a label) ---');
for (const [name, table, cols] of PROBES) {
  const r = await probe(table, cols);
  console.log(`${r.ok ? '✅ APPLIED    ' : '⛔ NOT APPLIED'}  ${name.padEnd(50)} ${r.note}`);
}

// 20260904b creates a FUNCTION, which no table probe can see. Named, not guessed at.
console.log('\n--- NOT PROBEABLE BY A TABLE READ (reported UNVERIFIED, never assumed) ---');
console.log('   20260904b_reset_invitation_expiry.sql — CREATE OR REPLACE FUNCTION only.');
console.log('   A function is invisible to a .select(); calling it would WRITE. UNVERIFIED.');
