/**
 * ── snapshot-customers-columns — the column list `customers` has no migration for ──
 *
 * PURPOSE:      `customers` is LIVE-ONLY SCHEMA (tech-debt #39): there is NO `CREATE TABLE
 *               customers` anywhere in the migration corpus, and 10 of the 23 columns the
 *               customer import writes — including `qb_customer_id`, `source`, `first_name`,
 *               `email`, `phone` and the four legacy address fields — appear in no migration at
 *               all. So the catalogue import's fix for tech-debt #203 (parse the table's columns
 *               out of the corpus and assert the insert list is a subset) CANNOT be reused here:
 *               run against `customers` it would report ten real columns as unknown.
 *
 *               This writes the missing half — a COMMITTED SNAPSHOT of the live column list, with
 *               its provenance — so `customerImport.test.ts` §M can make the same assertion
 *               offline and deterministically.
 * DEPENDENCIES: SUPABASE_URL + SUPABASE_SERVICE_KEY from .env.local. Writes ONE file.
 * OUTPUTS:      docs/schema-snapshots/customers-columns.json
 *
 * 🔴 A SNAPSHOT IS A DECLARATION, AND A DECLARATION NOBODY RE-DERIVES IS TECH-DEBT #73's CLASS.
 *    That is why §M does not trust it alone: it also parses every `ALTER TABLE customers ADD
 *    COLUMN` in the corpus and asserts THOSE are a subset of the snapshot. A migration that adds
 *    a column without a refresh therefore FAILS THE BUILD, in the direction that matters. The
 *    snapshot can still go stale about columns added outside the corpus — which is exactly the
 *    schema-snapshot checker owed since tech-debt #92, and this is a one-table down payment on it.
 *
 * ⚠️ IT IS NOT IN `npm run verify` AND MUST NOT BE. The 2026-08-02 ruling: a gate needing a live
 *    database "must stay offline and deterministic… a gate that fails for reasons unrelated to the
 *    change gets worked around." This REFRESHES the committed artifact; the probe reads the file.
 *
 * Run: node scripts/snapshot-customers-columns.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, writeFileSync } from 'node:fs';

const ROOT = new URL('..', import.meta.url).pathname;
for (const rel of ['.env.local', 'packages/cultivar-os/.env.local']) {
  let text = '';
  try { text = readFileSync(ROOT + rel, 'utf8'); } catch { continue; }
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    const v = m && m[2].replace(/^["']|["']$/g, '');
    if (m && v && !process.env[m[1]]) process.env[m[1]] = v;
  }
}
const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const db = createClient(url, key);
// One row is enough to enumerate the columns PostgREST exposes, and it is the same surface the
// writer actually inserts through — which is the surface that matters. A column the API cannot
// see is a column the writer cannot write, whatever the catalog says.
const { data, error } = await db.from('customers').select('*').limit(1);
if (error) { console.error('read failed:', error.message); process.exit(1); }
if (!data || data.length === 0) { console.error('🔴 customers returned no rows — a snapshot cannot be taken from an empty table. Refusing rather than writing an empty column list.'); process.exit(1); }

const columns = Object.keys(data[0]).sort();
const out = {
  table: 'customers',
  columns,
  taken_at: new Date().toISOString(),
  source: 'live PostgREST projection (SELECT * LIMIT 1) — customers has NO CREATE TABLE in the '
        + 'migration corpus (tech-debt #39), so the corpus cannot answer this question',
  refresh_with: 'node scripts/snapshot-customers-columns.mjs',
  guarded_by: 'packages/shared/src/quickbooks/customerImport.test.ts §M — asserts the import\'s '
            + 'insert list is a subset of this, AND that every ALTER TABLE customers ADD COLUMN in '
            + 'the corpus is a subset of this (so a migration without a refresh fails the build)',
};
writeFileSync(ROOT + 'docs/schema-snapshots/customers-columns.json', JSON.stringify(out, null, 2) + '\n');
console.log(`wrote docs/schema-snapshots/customers-columns.json — ${columns.length} columns`);
