/**
 * ── BACKFILL: 3 mangled ORG customers · THUNDER · 2026-07-02 ─────────────────────
 *
 * PURPOSE   Fix the 3 organization customers that the OCR whitespace-split mangled into
 *           first/last AND wrongly inserted into the `people` spine. Persons are already
 *           correct and are NEVER touched — this targets ONLY the 3 known org rows by their
 *           exact current (first_name, last_name) within business f7ec5d67….
 *
 *           customers-side (this script, --apply):
 *             - first_name := rejoin (first + ' ' + last)   e.g. "Cedar" + "Park HOA" → "Cedar Park HOA"
 *             - last_name  := ''                            (an org has no last name)
 *             - customer_type := 'organization'
 *           people-side (HARD STOP — SQL shown, NEVER run by this script):
 *             - DELETE the 3 wrongly-created people rows. The customers.person_id FK is
 *               ON DELETE SET NULL, so deleting the person AUTO-detaches the customer link —
 *               one DELETE both removes the bogus person AND nulls person_id. David runs this
 *               in the SQL editor after reviewing the reference scan below.
 *
 * USAGE     node scripts/backfill-customer-types.mjs            # --plan (read-only, default)
 *           node scripts/backfill-customer-types.mjs --apply    # customers-side UPDATE only
 *
 * DEPENDENCIES packages/cultivar-os/.env.local (SUPABASE_URL + SUPABASE_SERVICE_KEY).
 * SAFETY    --plan changes nothing. --apply updates ONLY the 3 matched org customer rows.
 *           The people DELETE is never executed here (spine data + FKs — David-approved).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync(new URL('../packages/cultivar-os/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const sb = createClient(env.SUPABASE_URL || env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_KEY);

const BUSINESS = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
const APPLY = process.argv.includes('--apply');

// The 3 orgs identified by the diagnostic, matched by EXACT current name so no person is touched.
const ORGS = [
  { first_name: 'The',      last_name: 'Bradt Residence' },
  { first_name: 'Cedar',    last_name: 'Park HOA' },
  { first_name: 'Hillside', last_name: 'Landscapes (contractor)' },
];

const rejoin = (f, l) => `${(f || '').trim()} ${(l || '').trim()}`.trim();

async function main() {
  console.log(`\n=== backfill-customer-types (${APPLY ? 'APPLY customers-side' : 'PLAN (read-only)'}) — business ${BUSINESS} ===\n`);

  const targets = [];
  for (const org of ORGS) {
    // No customer_type in the select — --plan runs BEFORE the migration applies the column.
    const { data, error } = await sb.from('customers')
      .select('id, first_name, last_name, person_id, source')
      .eq('business_id', BUSINESS)
      .eq('first_name', org.first_name)
      .eq('last_name', org.last_name);
    if (error) { console.error('lookup error:', error.message); process.exit(1); }
    if (!data || data.length === 0) { console.log(`  · not found (already backfilled?): "${rejoin(org.first_name, org.last_name)}"`); continue; }
    for (const row of data) targets.push(row);
  }

  if (targets.length === 0) { console.log('\nNo mangled org rows found — nothing to do (idempotent).\n'); return; }

  const personIds = [];
  for (const t of targets) {
    const newName = rejoin(t.first_name, t.last_name);
    console.log(`  customer ${t.id}`);
    console.log(`    now:  first="${t.first_name}" last="${t.last_name}" person_id=${t.person_id ?? '(none)'} source=${t.source}`);
    console.log(`    →     first="${newName}" last="" type=organization person_id=(detached on people DELETE)`);
    if (t.person_id) personIds.push(t.person_id);
  }

  // Reference scan: is each org's person_id referenced anywhere ELSE? (Deleting a shared
  // person would SET NULL on other rows too — must be clean before the HARD-STOP delete.)
  console.log('\n--- people reference scan (must be clean before deleting) ---');
  for (const pid of personIds) {
    const { data: person } = await sb.from('people').select('id, first_name, last_name, full_name, auth_user_id').eq('id', pid).maybeSingle();
    const others = {};
    for (const [tbl, col] of [['customers', 'person_id'], ['business_members', 'person_id'], ['labor_resources', 'person_id'], ['invitations', 'person_id']]) {
      const { data: refs } = await sb.from(tbl).select('id').eq(col, pid);
      const n = (refs || []).length;
      if (n > 0) others[tbl] = n;
    }
    const custRefs = others.customers ?? 0; // includes the org customer itself (expect 1)
    const external = { ...others, customers: Math.max(0, custRefs - 1) };
    const extTotal = Object.values(external).reduce((a, b) => a + b, 0);
    console.log(`  person ${pid}: ${person ? `"${person.full_name ?? rejoin(person.first_name, person.last_name)}" auth_user_id=${person.auth_user_id ?? 'null'}` : '(MISSING)'}`);
    console.log(`    refs beyond this org customer: ${extTotal === 0 ? 'NONE ✓ (safe to delete)' : JSON.stringify(external) + '  ⚠️ SHARED — do NOT delete without review'}`);
  }

  if (APPLY) {
    console.log('\n--- APPLYING customers-side backfill (org rows only) ---');
    for (const t of targets) {
      const newName = rejoin(t.first_name, t.last_name);
      const { error } = await sb.from('customers')
        .update({ first_name: newName, last_name: '', customer_type: 'organization' })
        .eq('id', t.id).eq('business_id', BUSINESS);
      if (error) { console.error(`  ✗ ${t.id}: ${error.message}`); process.exit(1); }
      console.log(`  ✓ ${t.id} → first="${newName}" last="" type=organization`);
    }
    console.log('\ncustomers-side done. person_id still linked until the people DELETE below is run.');
  } else {
    console.log('\n(PLAN only — no writes. Re-run with --apply to perform the customers-side backfill.)');
  }

  // HARD STOP: the people-row removal. Shown, never executed here. FK ON DELETE SET NULL
  // means this single DELETE also detaches person_id on the 3 org customers.
  console.log('\n=== HARD STOP — people-row removal (David runs in SQL editor after approving the scan above) ===');
  console.log('-- Deleting these people rows auto-nulls customers.person_id (FK ON DELETE SET NULL):');
  console.log(`DELETE FROM people WHERE id IN (\n  ${personIds.map(id => `'${id}'`).join(',\n  ')}\n);`);
  console.log('\n-- Verify after: expect 0 people rows + the 3 org customers show person_id = NULL:');
  console.log(`SELECT id FROM people WHERE id IN (${personIds.map(id => `'${id}'`).join(', ')});`);
  console.log(`SELECT first_name, last_name, customer_type, person_id FROM customers`);
  console.log(`  WHERE business_id = '${BUSINESS}' AND customer_type = 'organization';\n`);
}

main().catch(e => { console.error(e); process.exit(1); });
