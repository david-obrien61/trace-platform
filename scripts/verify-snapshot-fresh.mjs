#!/usr/bin/env node
// ============================================================
// verify-snapshot-fresh — THE LIVE-SCHEMA SNAPSHOT MUST NOT BE BEHIND WHAT IS APPLIED
//
// PURPOSE      `scripts/sql-harness/fixtures/live-schema-public.sql` is the base every writer-registry
//              path test and every §6 r26 hand-off check runs against. When it falls behind the live
//              database, those checks silently test LAST WEEK — and they still go green.
// DEPENDENCIES the snapshot · supabase/migrations/*.sql · snapshot-declarations.json
// OUTPUTS      exit 0, or exit 1 naming the migration whose tables the snapshot does not carry.
//
// 🔴 THE INSTANCE (2026-09-24, ledger #391). The snapshot was generated 2026-09-17 and its
//    `container_ladder` carried the 13-column `20260914` shape — it predated `20260916`, `20260918c`,
//    `20260923e` and `20260923h`, all applied. Nothing said so. A §6 r26 harness written against it
//    was testing a week-old schema while reporting a pass, and the staleness was found only because
//    a probe happened to look at the column list.
//
// 🔴 HOW "APPLIED" IS KNOWN WITHOUT A DATABASE, WHICH IS THE WHOLE TRICK.
//    Nothing records apply-state — David applies by hand — and `npm run verify` has no credentials.
//    So this does NOT compare dates: **the snapshot IS the record of what is applied.** For every
//    migration, the tables it CREATEs must either appear in the snapshot (applied and captured) or
//    be DECLARED as not-yet-applied. A declaration whose tables HAVE since appeared is stale and
//    FAILS — so the list prunes itself and cannot rot into unread noise (tech-debt #73's lesson).
//
// ⚠️ SCOPE, STATED SO NOBODY READS MORE INTO A GREEN THAN IS THERE: this matches `CREATE TABLE`
//    only. A migration that merely ADDs a column to an existing table is invisible to it — the
//    `20260918c` caliper case would NOT have been caught by this check, only by the table-level
//    ones. Widening it to columns means parsing every `ALTER`, which is its own build. Named here
//    rather than implied, because a cap that is quiet about its blind spot is worse than one that
//    has none.
// ============================================================
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const SNAP = 'scripts/sql-harness/fixtures/live-schema-public.sql';
const MIGDIR = 'supabase/migrations';
const DECL = 'snapshot-declarations.json';
const SELF = process.argv.includes('--self-test');

/** Strip `--` line comments and block comments, so PROSE is never parsed as SQL. */
export function stripComments(sql) {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
}

/**
 * Tables a migration creates. `CREATE TABLE [IF NOT EXISTS] public."x"` / `public.x`.
 * ⚠️ COMMENTS ARE STRIPPED FIRST, and that is not tidiness. Run against the raw text this matched
 * SEVEN prose fragments — "no committed CREATE TABLE migration", "CREATE TABLE only", "CREATE TABLE
 * at" — and reported them as missing tables. A cap that is red on arrival for reasons that are not
 * real gets switched off within a week (tech-debt #73), so the false positives had to go before the
 * declarations were seeded, not after.
 */
export function tablesCreatedBy(rawSql) {
  const sql = stripComments(rawSql);
  const out = new Set();
  const re = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi;
  let m; while ((m = re.exec(sql)) !== null) out.add(m[1].toLowerCase());
  return [...out];
}

/** Tables the snapshot carries. */
export function tablesInSnapshot(rawSql) {
  const sql = stripComments(rawSql);
  const out = new Set();
  const re = /CREATE\s+TABLE\s+(?:public\.)?"?([a-z0-9_]+)"?/gi;
  let m; while ((m = re.exec(sql)) !== null) out.add(m[1].toLowerCase());
  return out;
}

/** The verdict, pure so it can be probed without a repo. */
export function evaluate(migrations, snapTables, declared) {
  const missing = [], staleDecl = [];
  for (const { file, creates } of migrations) {
    const absent = creates.filter((t) => !snapTables.has(t));
    if (absent.length && !declared[file]) missing.push({ file, absent });
  }
  for (const file of Object.keys(declared)) {
    const m = migrations.find((x) => x.file === file);
    if (!m) { staleDecl.push({ file, why: 'declared, but no such migration exists' }); continue; }
    const absent = m.creates.filter((t) => !snapTables.has(t));
    if (m.creates.length === 0) { staleDecl.push({ file, why: 'declared, but it creates no table — the declaration asserts nothing' }); continue; }
    if (absent.length === 0) staleDecl.push({ file, why: `declared not-yet-applied, but the snapshot now carries ${m.creates.join(', ')} — it IS applied; remove the declaration` });
  }
  return { missing, staleDecl };
}

if (SELF) {
  let p = 0, f = 0; const ok = (c, m) => { console.log(`  ${c ? 'ok  ' : 'FAIL'} ${m}`); c ? p++ : f++; };
  const migs = [{ file: 'a.sql', creates: ['alpha'] }, { file: 'b.sql', creates: ['beta'] }, { file: 'c.sql', creates: [] }];
  const snap = new Set(['alpha']);

  ok(evaluate(migs, snap, {}).missing.length === 1, 'T1 🔴 a migration whose table the snapshot lacks, undeclared → FAILS');
  ok(evaluate(migs, snap, {}).missing[0].file === 'b.sql', 'T2 …and it is named');
  ok(evaluate(migs, snap, { 'b.sql': 'held for David' }).missing.length === 0, 'T3 declaring it as not-yet-applied clears it');
  ok(evaluate(migs, snap, { 'a.sql': 'held' }).staleDecl.length === 1, '🔴 T4 a declaration for a migration the snapshot NOW carries is STALE and fails — the list prunes itself');
  ok(evaluate(migs, snap, { 'zz.sql': 'held' }).staleDecl.length === 1, 'T5 a declaration for a migration that does not exist is stale');
  ok(evaluate(migs, snap, { 'c.sql': 'held' }).staleDecl.length === 1, 'T6 a declaration on a migration that creates no table asserts nothing, and says so');
  // 🔴 NEGATIVE CONTROL ON THE POPULATION, not the subject (#182). An EMPTY migration list must not
  // read as clean — it must be visible that nothing was examined.
  ok(evaluate([], snap, {}).missing.length === 0 && evaluate([], snap, {}).staleDecl.length === 0,
    'T7 an empty corpus finds nothing (the caller must report the count — see the run banner)');
  ok(tablesCreatedBy('CREATE TABLE IF NOT EXISTS public."production_rung_dates" (').includes('production_rung_dates'),
    'T8 IF NOT EXISTS and quoted identifiers parse');
  ok(tablesCreatedBy('-- CREATE TABLE public.ghost (').length === 0,
    '🔴 T9 a CREATE TABLE inside a COMMENT is NOT a created table — seven prose fragments were matched before this');
  ok(tablesCreatedBy('/* CREATE TABLE public.ghost */ CREATE TABLE public.real (').join() === 'real',
    'T9 …block comments too, and the real statement beside one still parses');
  console.log(`\nverify-snapshot-fresh --self-test — ${p} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
}

if (!existsSync(SNAP)) { console.error(`🔴 snapshot missing: ${SNAP}`); process.exit(1); }
const snapSrc = readFileSync(SNAP, 'utf8');
const generated = (/Generated\s+(\S+)/.exec(snapSrc.split('\n')[0]) ?? [])[1] ?? '(unknown)';
const snapTables = tablesInSnapshot(snapSrc);
const migrations = readdirSync(MIGDIR).filter((f) => f.endsWith('.sql')).sort()
  .map((file) => ({ file, creates: tablesCreatedBy(readFileSync(`${MIGDIR}/${file}`, 'utf8')) }));
const declared = existsSync(DECL) ? JSON.parse(readFileSync(DECL, 'utf8')).notYetApplied ?? {} : {};

const { missing, staleDecl } = evaluate(migrations, snapTables, declared);
const creating = migrations.filter((m) => m.creates.length).length;
console.log(`snapshot-fresh — ${SNAP} generated ${generated}; ${snapTables.size} tables. ${migrations.length} migrations scanned, ${creating} of them create a table; ${Object.keys(declared).length} declared not-yet-applied.`);

for (const m of missing) {
  console.error(`🔴 SNAPSHOT IS BEHIND — ${m.file} creates ${m.absent.join(', ')} and the snapshot does not carry ${m.absent.length > 1 ? 'them' : 'it'}.`);
  console.error(`   If it IS applied: re-run \`SUPABASE_PAT=… node scripts/sql-harness/snapshot-live-schema.mjs\`.`);
  console.error(`   If it is NOT applied yet: add it to ${DECL} → notYetApplied, with the reason.`);
}
for (const d of staleDecl) console.error(`🔴 STALE DECLARATION — ${d.file}: ${d.why}`);

if (missing.length || staleDecl.length) process.exit(1);
console.log('✅ snapshot-fresh — every table any migration creates is either in the snapshot or declared not-yet-applied.');
