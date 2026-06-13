#!/usr/bin/env node
/**
 * verify-migration.mjs
 *
 * Schema Verification Gate — JS-client half.
 * Verifies: target table queryable (reports row count), optional old table gone,
 *           anon/unauthenticated query returns 0 rows or is blocked (RLS in effect).
 *
 * Catalog checks (RLS enabled flag, column types, DEFAULT, FK, CHECK constraints,
 * column comments) require information_schema / pg_catalog and CANNOT run here
 * (PostgREST blocks them). Use David's SQL-editor queries for those.
 *
 * Usage:
 *   node scripts/verify-migration.mjs <table_name> [old_table_name]
 *
 * Examples:
 *   node scripts/verify-migration.mjs business_voice_samples campaign_tone_samples
 *   node scripts/verify-migration.mjs business_assets
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, '..');

const [, , tableName, oldTableName] = process.argv;

if (!tableName) {
  console.error('Usage: node scripts/verify-migration.mjs <table_name> [old_table_name]');
  process.exit(1);
}

const envPath = join(repoRoot, 'packages/cultivar-os/.env.local');
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const SUPABASE_URL = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const SERVICE_KEY  = env.SUPABASE_SERVICE_KEY;
const ANON_KEY     = env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
  console.error('ERROR: Missing SUPABASE_URL / SUPABASE_SERVICE_KEY / VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const sb     = createClient(SUPABASE_URL, SERVICE_KEY);
const sbAnon = createClient(SUPABASE_URL, ANON_KEY);

let passed = 0;
let failed = 0;

function pass(label, detail = '') {
  passed++;
  console.log(`  ✅ ${label}${detail ? ' — ' + detail : ''}`);
}
function fail(label, detail = '') {
  failed++;
  console.error(`  ❌ FAIL: ${label}${detail ? ' — ' + detail : ''}`);
}
function info(label, detail = '') {
  console.log(`  ℹ️  ${label}${detail ? ' — ' + detail : ''}`);
}

async function main() {
  console.log(`\n=== verify-migration: ${tableName} ===`);
  if (oldTableName) console.log(`=== old table check: ${oldTableName} ===`);
  console.log('');

  // ─── CHECK 1 — Target table exists and is queryable ──────────────────────────
  console.log(`CHECK 1: ${tableName} EXISTS and is queryable\n`);

  const { data: rows, error: rowsErr } = await sb
    .from(tableName)
    .select('*');

  if (rowsErr) {
    fail(`${tableName} is NOT queryable`, rowsErr.message);
    console.error('\nCannot continue — migration may not have run. Exiting.\n');
    process.exit(1);
  }
  pass(`${tableName} is queryable (${rows.length} rows)`);

  // ─── CHECK 2 — Old table gone (only if old_table_name provided) ──────────────
  if (oldTableName) {
    console.log(`\nCHECK 2: Old table ${oldTableName} DOES NOT EXIST\n`);

    const { data: oldRows, error: oldErr } = await sb
      .from(oldTableName)
      .select('id')
      .limit(1);

    if (oldErr) {
      const isGone = oldErr.code === 'PGRST200' ||
                     oldErr.message?.includes('does not exist') ||
                     oldErr.message?.includes('relation') ||
                     oldErr.message?.includes('42P01');
      if (isGone) {
        pass(`${oldTableName} does NOT exist`, `error: "${oldErr.message}"`);
      } else {
        info(`${oldTableName} query returned an unexpected error`, oldErr.message);
        info('Could be a permission error rather than table-not-found — verify in SQL editor');
      }
    } else {
      fail(`${oldTableName} STILL EXISTS and is queryable`, `${oldRows?.length ?? '?'} rows returned`);
    }
  }

  // ─── CHECK 3 — RLS: anon access blocked ──────────────────────────────────────
  console.log(`\nCHECK 3: RLS blocks unauthenticated access to ${tableName}\n`);

  const { data: anonRows, error: anonErr } = await sbAnon
    .from(tableName)
    .select('id')
    .limit(10);

  if (anonErr) {
    pass('Anon (unauthenticated) query blocked by RLS', `error code: ${anonErr.code}`);
  } else if (anonRows.length === 0) {
    pass('Anon (unauthenticated) query returns 0 rows — RLS enforced');
  } else {
    fail(`Anon query leaked ${anonRows.length} row(s) — RLS NOT enforced or policy missing`);
  }

  // ─── CHECK 4 — Exact row count ────────────────────────────────────────────────
  console.log(`\nCHECK 4: Row count for ${tableName}\n`);

  const { count, error: countErr } = await sb
    .from(tableName)
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    fail('Could not get row count', countErr.message);
  } else {
    pass(`Row count: ${count}`);
  }

  // ─── SUMMARY ─────────────────────────────────────────────────────────────────
  console.log(`\n=== JS-CLIENT RESULT: ${passed} passed, ${failed} failed ===\n`);

  // ─── CATALOG CHECKS — must run in Supabase SQL editor ────────────────────────
  const t = tableName;
  console.log('='.repeat(72));
  console.log('CATALOG CHECKS — run these in the Supabase SQL editor');
  console.log('Project: bgobkjcopcxusjsetfob');
  console.log('='.repeat(72));
  console.log(`
-- C1: Table exists in catalog + old name gone
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('${t}'${oldTableName ? `, '${oldTableName}'` : ''})
ORDER BY table_name;
-- EXPECTED: exactly 1 row → ${t} | public${oldTableName ? `\n-- FAIL if: ${oldTableName} appears` : ''}

-- C2: RLS enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = '${t}'
  AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- EXPECTED: relrowsecurity = true

-- C3: Policies attached + scoped
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policies
WHERE tablename = '${t}'
  AND schemaname = 'public';
-- EXPECTED: ≥1 policy row, using_expr references business_id

-- C4: Columns (structure check)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = '${t}'
ORDER BY ordinal_position;
-- EXPECTED: all expected columns present, types correct, no unexpected NULLable

-- C5: Foreign keys intact
SELECT conname, conrelid::regclass AS tbl, confrelid::regclass AS references_table
FROM pg_constraint
WHERE contype = 'f' AND conrelid = '${t}'::regclass;
-- EXPECTED: FK columns match original + no orphaned / missing constraints

-- C6: CHECK constraints
SELECT conname, pg_get_constraintdef(oid)
FROM pg_constraint
WHERE contype = 'c' AND conrelid = '${t}'::regclass;
-- EXPECTED: any CHECK constraints match migration definition
`);
  console.log('='.repeat(72));
  console.log('Run all six catalog queries above and compare to EXPECTED output.');
  console.log('If all match, migration is CLEAN. Persist results to docs/verification/.');
  console.log('='.repeat(72) + '\n');

  if (failed > 0) {
    console.error('JS-CLIENT CHECKS HAVE FAILURES — do not mark migration verified.\n');
    process.exit(1);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
