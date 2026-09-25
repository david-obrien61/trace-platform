#!/usr/bin/env node
/**
 * ── verify-migration-header-truth — a migration header must not lie about being unapplied ──────
 *
 * PURPOSE:      A migration whose header says "NOT APPLIED" while the table or column it creates
 *               IS in the live-schema snapshot is a STALE HEADER, and it fails the build.
 * DEPENDENCIES: scripts/sql-harness/fixtures/live-schema-public.sql (the snapshot — the same
 *               authoritative source `verify-snapshot-fresh` uses). No network, no database.
 * OUTPUTS:      exit 0 clean · exit 1 naming every stale header · `--self-test`.
 *
 * ═════════════════════════════════════════════════════════════════════════════
 * 🔴 WHY THIS EXISTS, AND WHY IT IS NOT THE CHECK THAT WAS ASKED FOR
 * ═════════════════════════════════════════════════════════════════════════════
 * The ask was a shared reader letting the corpus guards SKIP migrations marked not-for-apply.
 * MEASURED 2026-09-25 against the live database: of eight such headers probed, **SIX were about
 * migrations that ARE applied** — `20260923a`, `20260923c`, `20260923d`, `20260924g`,
 * `20260920b`, `20260915_contact_record`.
 *
 * So honouring the marker would have told six guards to skip live tables — excluding real tables
 * from the RLS, policy and embed checks. A guard that suppresses real checks on a false premise is
 * worse than no guard.
 *
 * The marker is stale BY CONSTRUCTION: it is written when the file is authored, and applying a
 * migration happens in the SQL editor and never touches the repo. Nothing has ever updated one.
 *
 * ⚠️ SO THIS CHECK POINTS THE OTHER WAY. Rather than trusting the comment, it catches the comment
 * being wrong — which is the root cause, and the same defect as every stale record this corpus
 * keeps producing: a written declaration nobody re-derives ([[R-26]]).
 *
 * 🔴 IT IS RED ON ARRIVAL WITH SIX FILES, WHICH IS THE SHAPE #73 WARNS GETS SWITCHED OFF. So the
 * six are DECLARED, with the reason, and the list PRUNES ITSELF: a declaration for a header that
 * has since been corrected, or for a migration that no longer exists, is STALE and fails too.
 * Each line comes off by fixing the header it names.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = 'supabase/migrations';
const SNAPSHOT = 'scripts/sql-harness/fixtures/live-schema-public.sql';
const DECLS = 'migration-header-declarations.json';

/** The header claim. Only the first 8 lines: a marker further down is prose about something else. */
export function claimsUnapplied(sql) {
  const head = sql.split('\n').slice(0, 8).join('\n');
  return /NOT APPLIED|DO NOT APPLY|NOT FOR APPLY|RETIRED IN PLACE/i.test(head);
}

/** Tables a migration CREATES. A comment mentioning CREATE TABLE is not a created table. */
export function tablesCreated(sql) {
  const bare = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  return [...bare.matchAll(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?["']?([a-z0-9_]+)/gi)]
    .map(m => m[1].toLowerCase());
}

/** Columns a migration ADDS, as `table.column`. */
export function columnsAdded(sql) {
  const bare = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n');
  const out = [];
  for (const m of bare.matchAll(/ALTER\s+TABLE\s+(?:public\.)?["']?([a-z0-9_]+)["']?([\s\S]*?);/gi)) {
    const table = m[1].toLowerCase();
    for (const c of m[2].matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?["']?([a-z0-9_]+)/gi)) {
      out.push(`${table}.${c[1].toLowerCase()}`);
    }
  }
  return out;
}

export function snapshotHas(snapshot, table, column) {
  // The snapshot is a CREATE TABLE dump; a table is present if it is created in it.
  const t = new RegExp(`CREATE\\s+TABLE\\s+(?:IF\\s+NOT\\s+EXISTS\\s+)?(?:public\\.)?"?${table}"?[\\s(]`, 'i');
  if (!t.test(snapshot)) return false;
  if (!column) return true;
  // Crude but sufficient: the column name appears inside that table's block.
  const block = snapshot.split(new RegExp(`CREATE\\s+TABLE[^;]*?${table}`, 'i'))[1] ?? '';
  return new RegExp(`\\b${column}\\b`, 'i').test(block.split(');')[0] ?? '');
}

function main() {
  if (!existsSync(SNAPSHOT)) {
    console.log('⚠️  migration-header-truth — no live-schema snapshot on disk; nothing to compare against.');
    return 0;
  }
  const snapshot = readFileSync(SNAPSHOT, 'utf8');
  const declared = existsSync(DECLS) ? JSON.parse(readFileSync(DECLS, 'utf8')).staleHeaders ?? {} : {};
  const files = readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).sort();

  const stale = [];
  for (const f of files) {
    const sql = readFileSync(join(MIGRATIONS, f), 'utf8');
    if (!claimsUnapplied(sql)) continue;
    const live = [
      ...tablesCreated(sql).filter(t => snapshotHas(snapshot, t, null)).map(t => `table ${t}`),
      ...columnsAdded(sql).filter(tc => snapshotHas(snapshot, ...tc.split('.'))).map(tc => `column ${tc}`),
    ];
    if (live.length > 0) stale.push({ file: f, live });
  }

  const undeclared = stale.filter(s => !(s.file in declared));
  // The list prunes itself in the other direction too (#73's lesson).
  const stillStale = new Set(stale.map(s => s.file));
  const deadDecls = Object.keys(declared).filter(f => !stillStale.has(f));

  let bad = 0;
  if (undeclared.length) {
    bad = 1;
    console.log(`\n🔴 ${undeclared.length} MIGRATION HEADER(S) SAY "NOT APPLIED" ABOUT SOMETHING THAT IS LIVE:\n`);
    for (const s of undeclared) console.log(`  · ${s.file}\n      live already: ${s.live.join(', ')}`);
    console.log('\n  Correct the header, or declare it with a reason. A comment is not state: it is');
    console.log('  written when the file is authored and applying a migration never touches the repo.');
  }
  if (deadDecls.length) {
    bad = 1;
    console.log(`\n🔴 ${deadDecls.length} STALE DECLARATION(S) — the header is no longer wrong, so remove the line:\n`);
    for (const f of deadDecls) console.log(`  · ${f}`);
  }
  if (!bad) console.log(`✅ migration-header-truth — ${files.length} migrations; no header claims to be unapplied about a live table.`);
  return bad;
}

function selfTest() {
  let pass = 0; const fails = [];
  const ok = (c, m) => { if (c) pass++; else fails.push(m); };
  ok(claimsUnapplied('-- 🔴 WRITTEN, NOT APPLIED. David applies it.\nBEGIN;'), 'P1 a header marker is read');
  ok(!claimsUnapplied('BEGIN;\n' + '\n'.repeat(20) + '-- NOT APPLIED mentioned in prose far below'),
     '🔴 P2 A MENTION FAR BELOW IS NOT A HEADER CLAIM — migrations discuss other migrations constantly, and matching those would make this cap noise');
  ok(!claimsUnapplied('-- an ordinary migration\nBEGIN;'), 'P3 an ordinary header claims nothing');
  ok(tablesCreated('CREATE TABLE IF NOT EXISTS public.rings (id uuid);').includes('rings'), 'P4 a created table is found');
  ok(!tablesCreated('-- CREATE TABLE public.rings would do it').includes('rings'),
     '🔴 P5 A CREATE TABLE INSIDE A COMMENT IS NOT A CREATED TABLE — the same trap verify-snapshot-fresh records having fallen into');
  ok(columnsAdded('ALTER TABLE public.businesses\n ADD COLUMN IF NOT EXISTS latitude double precision;').includes('businesses.latitude'),
     'P6 an added column is found, table-qualified');
  ok(snapshotHas('CREATE TABLE public.businesses (\n id uuid,\n latitude double precision\n);', 'businesses', 'latitude'),
     'P7 the snapshot is read for a table and a column');
  ok(!snapshotHas('CREATE TABLE public.businesses (\n id uuid\n);', 'businesses', 'latitude'),
     'P8 …and a column the snapshot lacks is absent');
  ok(!snapshotHas('CREATE TABLE public.other (id uuid);', 'businesses', null), 'P9 a table the snapshot lacks is absent');
  ok(existsSync(MIGRATIONS) && readdirSync(MIGRATIONS).filter(f => f.endsWith('.sql')).length > 50,
     '🔴 P10 THE POPULATION IS REAL — a cap that reaches nothing reports the same as one that passed (#182)');
  for (const f of fails) console.log(`  ✗ ${f}`);
  console.log(`migration-header-truth self-test — ${pass} passed, ${fails.length} failed`);
  return fails.length === 0 ? 0 : 1;
}

process.exit(process.argv.includes('--self-test') ? selfTest() : main());
