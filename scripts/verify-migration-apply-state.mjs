#!/usr/bin/env node
/**
 * -- MIGRATION APPLY-STATE -- DERIVED, NEVER READ OFF A LABEL -------------------------
 *
 * PURPOSE:      Answer "which migrations are actually in the database" by DERIVING it. Nothing records
 *               it: David applies migrations by hand in the SQL editor, so Supabase's own
 *               `supabase_migrations.schema_migrations` does not exist on this project (measured
 *               2026-09-11), and a handful of files carry an apply annotation while most do not.
 *
 *               STAGE 1 (offline, cannot rot): parse the corpus, then RESOLVE ITS HISTORY — every
 *                        create, removal, rename and re-shape in order — into one expectation per object.
 *               STAGE 2 (network): observe the live database and compare.
 *                        --catalog  the read-only PAT (`supabase_read_only_user`) reads the system catalogs,
 *                                   so EVERY object kind is checkable: tables, columns, policies, functions,
 *                                   indexes, triggers, constraints, nullability, comments, privileges.
 *                        --probe    no PAT: the ANON key over PostgREST, tables and columns only.
 *               --sql       print the catalog observation query instead of running it.
 *               --self-test offline: crafted histories and observations, each shown refusing, plus the
 *                           real-corpus cases that were once reported wrongly. Wired into `npm run verify`.
 *
 * DEPENDENCIES: scripts/lib/migrationParse.mjs · scripts/lib/migrationHistory.mjs · supabase/migrations/
 *               migration-data-checks.json (how each data-only backfill's effect is observed)
 *               --catalog: SUPABASE_PAT in the environment (scripts/lib/pgQuery.mjs, read-only role)
 *               --probe:   packages/cultivar-os/.env.local (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
 * OUTPUTS:      per-file verdict + the object that decided it; exit 2 when a red-first control fails
 *               (nothing below it is a result), exit 1 when --self-test fails, else 0 — this is a report.
 *
 * 🔴 WHAT CHANGED 2026-09-11, AND WHY THE OLD OUTPUT MUST NOT BE READ RAW. The previous version judged each
 *    file alone. Its catalog step reported 10 files as FAIL and **none of the 10 was missing**: 155 `DROP
 *    POLICY` statements, 3 table renames, a non-`public` schema and a same-day ordering it treated as
 *    alphabetical all read as "not applied". A check that cries wolf is disabled within a week — which is
 *    R-33's cost paid in the other direction. Each of those blind spots now has a --self-test probe.
 *    ⚠️ The old header also promised the run "FAILS when the unresolved population exceeds its declared
 *    ceiling in migration-apply-baseline.json". **That file never existed and no code ever read it.** A
 *    guarantee stated in a header and implemented nowhere is removed rather than left to be believed.
 *
 * VERDICTS (per file):
 *   APPLIED          what it created is there (or a later change it made is in effect)
 *   NOT_APPLIED      what it created is not there, and nothing in the corpus explains why
 *   MIXED            some of it is there and some is not, unexplained — a file cannot half-run: read it
 *   SUPERSEDED       everything it did was later replaced on purpose; the database cannot say if it ran
 *   INCONCLUSIVE     present, but every object it asserts is also asserted by another file
 *   TABLE_GONE       its objects sit on a table that no longer exists and no migration drops
 *   HOLDS / VIOLATED a data backfill's declared invariant is true / broken today (migration-data-checks.json)
 *   DATA             a data backfill with no declared check (--self-test fails on this, so it should never print)
 *   NOTHING_TO_APPLY the file holds no executable SQL
 *   COULD_NOT_CHECK  this mode cannot observe what it declares
 */
import { readFileSync, existsSync } from 'node:fs';
import { parseCorpus, parseFile } from './lib/migrationParse.mjs';
import { resolveHistory, verdictFor, ON_TABLE } from './lib/migrationHistory.mjs';

const MIGRATIONS = 'supabase/migrations';
const DATA_CHECKS = 'migration-data-checks.json';
const loadDataChecks = () => (existsSync(DATA_CHECKS) ? JSON.parse(readFileSync(DATA_CHECKS, 'utf8')).checks : {});
const ENV_FILE = 'packages/cultivar-os/.env.local';
const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);

// ════════════════════════════════════════════════════════════════════════════════════════
// CLASSIFY — one classifier, whichever mode observed the database
// ════════════════════════════════════════════════════════════════════════════════════════
export function classify(corpus, history, obs) {
  const perFile = new Map(corpus.files.map((f) => [f, []]));
  // How many files assert each identity's state — so presence can be attributed, or honestly not.
  const assertedBy = new Map();
  for (const a of history.assessments) {
    const k = `${a.id}|${a.state}`;
    if (!assertedBy.has(k)) assertedBy.set(k, new Set());
    assertedBy.get(k).add(a.obj.file);
  }
  for (const a of history.assessments) {
    const m = history.identities.get(a.id);
    const o = obs.get(a.id);
    const onTable = m.family === 'index' ? m.indexTable : m.table;
    const onlyAbsent = (states) => !!states && [...states].every((x) => x === 'absent');
    const droppedByCorpus = onTable ? onlyAbsent(history.tableFinal(m.schema, onTable)) : false;
    let v = verdictFor(a, o?.observed ?? null, o?.tblExists ?? null, droppedByCorpus);
    // Nullability and comments sit on a COLUMN. When the catalog returns nothing because the column itself
    // is gone, that is not "could not check": either the corpus drops the column (SUPERSEDED) or nothing does.
    if (v === 'COULD_NOT_CHECK' && (m.family === 'nullability' || m.family === 'comment') && o) {
      v = onlyAbsent(history.columnFinal(m.schema, m.table, m.name)) ? 'SUPERSEDED'
        : (o.tblExists === false && !droppedByCorpus ? 'TABLE_GONE_OUTSIDE_MIGRATIONS' : 'COLUMN_GONE_OUTSIDE_MIGRATIONS');
    }
    perFile.get(a.obj.file).push({ a, v, shared: (assertedBy.get(`${a.id}|${a.state}`)?.size ?? 0) > 1 });
  }
  const verdicts = new Map();
  for (const [file, rows] of perFile) {
    const n = (vv) => rows.filter((r) => vv.includes(r.v)).length;
    const applied = rows.filter((r) => r.v === 'APPLIED' || r.v === 'LATER_CHANGE_NOT_APPLIED');
    let verdict;
    if (corpus.dataOnly.includes(file)) verdict = 'DATA';
    else if (corpus.commentOnly.includes(file)) verdict = 'NOTHING_TO_APPLY';
    else if (n(['MISSING']) && !applied.length) verdict = 'NOT_APPLIED';
    else if (n(['MISSING'])) verdict = 'MIXED';
    else if (applied.length) verdict = applied.every((r) => r.shared) ? 'INCONCLUSIVE' : 'APPLIED';
    else if (n(['TABLE_GONE_OUTSIDE_MIGRATIONS', 'COLUMN_GONE_OUTSIDE_MIGRATIONS'])) verdict = 'TABLE_GONE';
    else if (n(['SUPERSEDED', 'CONSISTENT']) && !n(['COULD_NOT_CHECK'])) verdict = 'SUPERSEDED';
    else verdict = 'COULD_NOT_CHECK';
    verdicts.set(file, { verdict, rows });
  }
  return verdicts;
}

// ════════════════════════════════════════════════════════════════════════════════════════
// OBSERVE (catalog) — one query, every identity, plus red-first controls in the same VALUES
// ════════════════════════════════════════════════════════════════════════════════════════
const CONTROLS = [
  { key: '__control:table_present', family: 'table', schema: 'public', table: null, name: 'receipts', expect: 'present' },
  { key: '__control:table_absent', family: 'table', schema: 'public', table: null, name: 'zzz_no_such_table', expect: 'absent' },
  { key: '__control:policy_absent', family: 'policy', schema: 'public', table: 'receipts', name: 'zzz_no_such_policy', expect: 'absent' },
  { key: '__control:function_dropped', family: 'function', schema: 'public', table: null, name: 'has_permission_exact', expect: 'absent' },
  { key: '__control:function_present', family: 'function', schema: 'public', table: null, name: 'has_permission', expect: 'present' },
  { key: '__control:nullable', family: 'nullability', schema: 'public', table: 'customers', name: 'last_name', expect: 'nullable' },
  { key: '__control:priv_revoked', family: 'tablepriv', schema: 'public', table: 'audit_log', name: 'TRUNCATE:anon', priv: 'TRUNCATE', role: 'anon', expect: 'revoked' },
  { key: '__control:priv_granted', family: 'tablepriv', schema: 'public', table: 'receipts', name: 'SELECT:authenticated', priv: 'SELECT', role: 'authenticated', expect: 'granted' },
];

export function observationSql(identities) {
  const rows = [...identities].map(([key, m]) => `  (${[key, m.family, m.schema, m.family === 'index' ? m.indexTable : m.table, m.name, m.priv, m.role, m.owner].map(q).join(', ')})`);
  for (const c of CONTROLS) rows.push(`  (${[c.key, c.family, c.schema, c.table, c.name, c.priv, c.role, null].map(q).join(', ')})`);
  const ex = (sub) => `CASE WHEN EXISTS (${sub}) THEN 'present' ELSE 'absent' END`;
  const rel = `pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = i.sch AND c.relname = i.tbl`;
  const roleOid = (col) => `CASE WHEN ${col} = 'public' THEN 0::oid ELSE (SELECT oid FROM pg_roles WHERE rolname = ${col}) END`;
  return `-- MIGRATION APPLY-STATE — CATALOG OBSERVATION. READ-ONLY: system catalogs only, no customer row.
-- Generated by: node scripts/verify-migration-apply-state.mjs --sql   (verdicts are computed by the script)
WITH ids(key, family, sch, tbl, nm, priv, rl, own) AS (VALUES
${rows.join(',\n')}
)
SELECT i.key,
  CASE i.family
    WHEN 'table'       THEN ${ex(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = i.sch AND c.relname = i.nm AND c.relkind IN ('r','p')`)}
    WHEN 'view'        THEN ${ex(`SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = i.sch AND c.relname = i.nm AND c.relkind IN ('v','m')`)}
    WHEN 'column'      THEN ${ex(`SELECT 1 FROM ${rel} JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = i.nm AND a.attnum > 0 AND NOT a.attisdropped`.replace(' WHERE n.nspname = i.sch AND c.relname = i.tbl JOIN', ' JOIN') + ` WHERE n.nspname = i.sch AND c.relname = i.tbl`)}
    WHEN 'nullability' THEN (SELECT CASE WHEN a.attnotnull THEN 'notnull' ELSE 'nullable' END FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = i.nm AND a.attnum > 0 AND NOT a.attisdropped WHERE n.nspname = i.sch AND c.relname = i.tbl)
    WHEN 'policy'      THEN ${ex(`SELECT 1 FROM pg_policies p WHERE p.schemaname = i.sch AND p.tablename = i.tbl AND p.policyname = i.nm`)}
    WHEN 'trigger'     THEN ${ex(`SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = i.sch AND c.relname = i.tbl AND t.tgname = i.nm AND NOT t.tgisinternal`)}
    WHEN 'index'       THEN ${ex(`SELECT 1 FROM pg_indexes x WHERE x.schemaname = i.sch AND x.indexname = i.nm`)}
    WHEN 'function'    THEN ${ex(`SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = i.sch AND p.proname = i.nm`)}
    WHEN 'constraint'  THEN ${ex(`SELECT 1 FROM pg_constraint co JOIN pg_class c ON c.oid = co.conrelid JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = i.sch AND c.relname = i.tbl AND co.conname = i.nm`)}
    WHEN 'comment'     THEN (SELECT CASE WHEN col_description(c.oid, a.attnum) IS NOT NULL THEN 'present' ELSE 'absent' END FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = i.nm WHERE n.nspname = i.sch AND c.relname = i.tbl)
    WHEN 'tablepriv'   THEN (SELECT CASE WHEN EXISTS (SELECT 1 FROM aclexplode(c.relacl) x WHERE x.grantee = ${roleOid('i.rl')} AND x.privilege_type = i.priv) THEN 'granted' ELSE 'revoked' END FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = i.sch AND c.relname = i.tbl AND c.relkind IN ('r','p'))
    WHEN 'alltablespriv' THEN CASE WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace, aclexplode(c.relacl) x WHERE n.nspname = i.sch AND c.relkind IN ('r','p') AND x.grantee = ${roleOid('i.rl')} AND x.privilege_type = i.priv) THEN 'granted' ELSE 'revoked' END
    WHEN 'defaultpriv' THEN CASE WHEN EXISTS (SELECT 1 FROM pg_default_acl d JOIN pg_namespace n ON n.oid = d.defaclnamespace, aclexplode(d.defaclacl) x WHERE n.nspname = i.sch AND d.defaclobjtype = 'r' AND d.defaclrole = (SELECT oid FROM pg_roles WHERE rolname = i.own) AND x.grantee = ${roleOid('i.rl')} AND x.privilege_type = i.priv) THEN 'granted' ELSE 'revoked' END
  END AS observed,
  CASE WHEN i.tbl IS NULL THEN NULL ELSE EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = i.sch AND c.relname = i.tbl AND c.relkind IN ('r','p','v','m','f')) END AS tbl_exists
FROM ids i;`;
}

async function observeCatalog(history) {
  if (!process.env.SUPABASE_PAT) {
    console.log('\nCOULD NOT CHECK -- SUPABASE_PAT is not in the environment. Nothing below is a result.');
    console.log('  (a session runs: set -a; . ./.env.local; set +a; node scripts/verify-migration-apply-state.mjs --catalog)');
    process.exit(2);
  }
  const { sql } = await import('./lib/pgQuery.mjs');
  const rows = await sql(observationSql(history.identities));
  const obs = new Map(rows.map((r) => [r.key, { observed: r.observed, tblExists: r.tbl_exists }]));
  console.log('\n-- RED-FIRST -- every control must answer as expected before any verdict is trusted --');
  let ok = true;
  for (const c of CONTROLS) {
    const got = obs.get(c.key)?.observed ?? null;
    const pass = got === c.expect;
    ok = ok && pass;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${c.family} ${c.table ? c.table + '.' : ''}${c.name} -> ${got} (expected ${c.expect})`);
  }
  if (!ok) { console.log('  FAIL: the observation cannot tell its states apart. Every verdict below would be void.'); process.exit(2); }
  return obs;
}

// ════════════════════════════════════════════════════════════════════════════════════════
// OBSERVE (anon) — tables and columns only, over PostgREST
// ════════════════════════════════════════════════════════════════════════════════════════
function readEnv() {
  if (!existsSync(ENV_FILE)) return null;
  const out = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  if (!out.VITE_SUPABASE_URL || !out.VITE_SUPABASE_ANON_KEY) return null;
  return { url: out.VITE_SUPABASE_URL, key: out.VITE_SUPABASE_ANON_KEY };
}
async function probe(env, table, column) {
  const url = `${env.url}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(column || '*')}&limit=0`;
  let res;
  try { res = await fetch(url, { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` } }); } catch { return null; }
  if (res.status === 200) return 'present';
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON */ }
  if (body.code === '42703' || body.code === 'PGRST205' || body.code === '42P01') return 'absent';
  return null;
}
/** The data-backfill checks, one query. Each declared `sql` is a scalar boolean expression. */
async function observeData(checks) {
  const runnable = Object.entries(checks).filter(([, c]) => c.sql);
  if (!runnable.length) return new Map();
  const { sql } = await import('./lib/pgQuery.mjs');
  const rows = await sql(runnable.map(([f, c]) => `SELECT ${q(f)} AS file, ${c.sql} AS ok`).join('\nUNION ALL\n'));
  return new Map(rows.map((r) => [r.file, r.ok]));
}
/** Replace the generic DATA verdict with what each file's declared check observed. */
export function applyDataChecks(verdicts, checks, dataObs) {
  for (const [file, v] of verdicts) {
    if (v.verdict !== 'DATA') continue;
    const c = checks[file];
    if (!c || !dataObs) continue;
    const ok = dataObs.get(file);
    if (c.kind === 'superseded') { v.verdict = 'SUPERSEDED'; v.dataNote = `rewritten since by: ${c.superseded_by.join(', ')}`; continue; }
    if (ok === null || ok === undefined) { v.verdict = 'COULD_NOT_CHECK'; v.dataNote = 'the declared check returned nothing'; continue; }
    if (c.kind === 'evidence') { v.verdict = ok ? 'APPLIED' : 'NOT_APPLIED'; v.dataNote = `${ok ? 'found' : 'NOT found'}: ${c.means}`; }
    else if (c.kind === 'invariant') { v.verdict = ok ? 'HOLDS' : 'VIOLATED'; v.dataNote = `${ok ? 'holds' : 'BROKEN'}: ${c.means}`; }
    else if (c.kind === 'unverifiable') { v.verdict = ok ? 'COULD_NOT_CHECK' : 'STALE_DECLARATION'; v.dataNote = ok ? c.reason : `the reason no longer holds (${c.reason}) — re-derive this entry in ${DATA_CHECKS}`; }
  }
  return verdicts;
}

async function observeAnon(history) {
  const env = readEnv();
  if (!env) { console.log(`\nCOULD NOT CHECK -- no anon key at ${ENV_FILE}. Nothing below is a result.`); process.exit(2); }
  console.log('\n-- RED-FIRST (anon) --');
  const controls = [['receipts', 'id', 'present'], ['receipts', 'zzz_no_such_column', 'absent'], ['zzz_no_such_table', 'id', 'absent']];
  for (const [t, c, e] of controls) {
    const got = await probe(env, t, c);
    console.log(`  ${got === e ? 'PASS' : 'FAIL'}  ${t}.${c} -> ${got} (expected ${e})`);
    if (got !== e) process.exit(2);
  }
  const obs = new Map();
  const tableState = new Map();
  const want = [...history.identities].filter(([, m]) => m.schema === 'public' && (m.family === 'table' || m.family === 'column'));
  for (const [, m] of want) { const t = m.family === 'table' ? m.name : m.table; if (!tableState.has(t)) tableState.set(t, await probe(env, t, null)); }
  for (const [key, m] of want) {
    if (m.family === 'table') { obs.set(key, { observed: tableState.get(m.name), tblExists: null }); continue; }
    const tExists = tableState.get(m.table);
    obs.set(key, { observed: tExists === 'present' ? await probe(env, m.table, m.name) : (tExists === 'absent' ? 'absent' : null), tblExists: tExists === null ? null : tExists === 'present' });
  }
  return obs;
}

// ════════════════════════════════════════════════════════════════════════════════════════
// SELF-TEST — offline. Every probe is shown both ways; the real-corpus cases are the ones once wrong.
// ════════════════════════════════════════════════════════════════════════════════════════
function selfTest() {
  let failed = 0;
  const check = (label, got, want) => {
    const pass = JSON.stringify(got) === JSON.stringify(want);
    if (!pass) failed++;
    console.log(`  ${pass ? 'ok  ' : 'FAIL'} ${label}${pass ? '' : ` — got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`}`);
  };
  const corpusOf = (files) => {
    const objects = []; const names = Object.keys(files).sort();
    for (const f of names) objects.push(...parseFile(files[f], f).objects);
    return { files: names, objects, dataOnly: [], commentOnly: [] };
  };
  const roleOf = (h, file, kind, name) => h.assessments.find((a) => a.obj.file === file && a.obj.kind === kind && a.obj.name === name);
  const obsOf = (entries) => new Map(Object.entries(entries).map(([k, v]) => [k, typeof v === 'string' ? { observed: v, tblExists: true } : v]));

  console.log('\n-- SELF-TEST · PARSER --');
  const p = (sql) => parseFile(sql, 'f.sql').objects.map((o) => `${o.kind}:${o.schema}.${o.table ?? '-'}.${o.name}${o.to ? '>' + o.to : ''}`);
  check('DROP POLICY is parsed (155 were invisible)', p('DROP POLICY IF EXISTS p1 ON public.t1;'), ['drop_policy:public.t1.p1']);
  check('storage schema is KEPT, not folded into public', p('CREATE POLICY rs ON storage.objects FOR ALL USING (true);'), ['policy:storage.objects.rs']);
  check('table rename is parsed', p('ALTER TABLE plants RENAME TO cultivar_plants;'), ['rename_table:public.plants.plants>cultivar_plants']);
  check('REVOKE ON TABLES inside DEFAULT PRIVILEGES is not a table named "tables"',
    p('ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE TRUNCATE ON TABLES FROM anon;'), ['revoke_default:public.-.postgres>TRUNCATE:anon']);
  check('REVOKE ON FUNCTION is not a table privilege', p('REVOKE ALL ON FUNCTION public.f(uuid) FROM anon;'), []);
  check('nullability change is parsed', p('ALTER TABLE public.customers ALTER COLUMN last_name DROP NOT NULL;'), ['nullable:public.customers.last_name']);

  console.log('\n-- SELF-TEST · HISTORY + VERDICT (crafted) --');
  {
    const h = resolveHistory(corpusOf({ '20260101_a.sql': 'DROP POLICY IF EXISTS p ON t; CREATE POLICY p ON t USING (true);' }).objects);
    check('same-file DROP IF EXISTS then CREATE resolves to present', roleOf(h, '20260101_a.sql', 'policy', 'p').role, 'final');
  }
  {
    const c = corpusOf({ '20260101_a.sql': 'CREATE POLICY p ON t USING (true);', '20260201_b.sql': 'DROP POLICY p ON t;' });
    const h = resolveHistory(c.objects); const a = roleOf(h, '20260101_a.sql', 'policy', 'p');
    check('a later-DATE drop overrides the create', a.role, 'overridden');
    check('…and absence then reads SUPERSEDED, not missing', verdictFor(a, 'absent', true, false), 'SUPERSEDED');
    check('…and presence reads LATER_CHANGE_NOT_APPLIED (the dropper did not run)', verdictFor(a, 'present', true, false), 'LATER_CHANGE_NOT_APPLIED');
    const v = classify(c, h, obsOf({ 'policy|public.t.p': 'present' }));
    check('…and the dropping FILE is the one reported NOT_APPLIED', v.get('20260201_b.sql').verdict, 'NOT_APPLIED');
  }
  {
    const h = resolveHistory(corpusOf({ '20260727_rbac_resource_action_flip.sql': 'CREATE POLICY bpc ON t USING (true);', '20260727_rbac_flip_corrections.sql': 'DROP POLICY IF EXISTS bpc ON t;' }).objects);
    const a = roleOf(h, '20260727_rbac_resource_action_flip.sql', 'policy', 'bpc');
    check('SAME-DAY create + drop is NOT ordered alphabetically (the bpc_member_insert error)', a.role, 'same_day');
    check('…absent is CONSISTENT', verdictFor(a, 'absent', true, false), 'CONSISTENT');
    check('…present is CONSISTENT too — the database, not the filename, says which ran last', verdictFor(a, 'present', true, false), 'CONSISTENT');
  }
  {
    const h = resolveHistory(corpusOf({ '20260101_a.sql': 'CREATE POLICY ap ON plants USING (true);', '20260301_b.sql': 'ALTER TABLE plants RENAME TO cultivar_plants;' }).objects);
    check('a policy follows its table through a later rename', roleOf(h, '20260101_a.sql', 'policy', 'ap').id, 'policy|public.cultivar_plants.ap');
  }
  {
    const c = corpusOf({ '20260101_a.sql': 'CREATE POLICY p ON t USING (true);', '20260301_b.sql': 'DROP TABLE t;' });
    const h = resolveHistory(c.objects);
    check('DROP TABLE removes the policies on it (cascade)', roleOf(h, '20260101_a.sql', 'policy', 'p').role, 'overridden');
  }
  {
    const c = corpusOf({ '20260101_a.sql': 'CREATE POLICY p ON gone USING (true);' });
    const h = resolveHistory(c.objects); const a = roleOf(h, '20260101_a.sql', 'policy', 'p');
    check('policy absent + its table absent + no migration drops it → TABLE_GONE (nursery_modules)', verdictFor(a, 'absent', false, false), 'TABLE_GONE_OUTSIDE_MIGRATIONS');
    // 🔴 NEGATIVE CONTROL — the check must still be able to say MISSING, or it has become a rubber stamp.
    check('🔴 NEGATIVE CONTROL: policy absent + its table PRESENT → MISSING', verdictFor(a, 'absent', true, false), 'MISSING');
    check('🔴 NEGATIVE CONTROL: that file reads NOT_APPLIED', classify(c, h, obsOf({ 'policy|public.gone.p': 'absent' })).get('20260101_a.sql').verdict, 'NOT_APPLIED');
  }
  {
    // The 20260528 false MIXED: a preamble DROP whose state matches a LATER file's final word.
    const c = corpusOf({ '20260101_a.sql': 'DROP POLICY IF EXISTS p ON t; CREATE POLICY p ON t USING (true);', '20260301_b.sql': 'DROP TABLE t;' });
    const h = resolveHistory(c.objects);
    check('a same-file preamble DROP is not the file\'s effect, even when a later file also removes it',
      h.assessments.filter((a) => a.obj.file === '20260101_a.sql').map((a) => a.obj.kind), ['policy']);
    check('…so with the later drop not run, that file reads APPLIED, not MIXED',
      classify(c, h, obsOf({ 'policy|public.t.p': 'present', 'table|public.t': 'present' })).get('20260101_a.sql').verdict, 'APPLIED');
  }
  {
    const c = corpusOf({ '20260101_a.sql': 'ALTER TABLE t ALTER COLUMN c DROP NOT NULL;', '20260301_b.sql': 'ALTER TABLE t DROP COLUMN c;' });
    const h = resolveHistory(c.objects);
    check('nullability of a column a later migration drops → SUPERSEDED, not COULD_NOT_CHECK',
      classify(c, h, obsOf({ 'nullability|public.t.c': { observed: null, tblExists: true }, 'column|public.t.c': 'absent' })).get('20260101_a.sql').verdict, 'SUPERSEDED');
    const c2 = corpusOf({ '20260101_a.sql': 'ALTER TABLE t ALTER COLUMN c DROP NOT NULL;' });
    check('…and of a column NOTHING drops → reported gone outside migrations',
      classify(c2, resolveHistory(c2.objects), obsOf({ 'nullability|public.t.c': { observed: null, tblExists: true } })).get('20260101_a.sql').verdict, 'TABLE_GONE');
  }
  {
    const h = resolveHistory(corpusOf({ '20260101_a.sql': 'REVOKE TRUNCATE ON public.t FROM anon;', '20260301_b.sql': 'GRANT TRUNCATE ON public.t TO anon;' }).objects);
    check('a later GRANT overrides an earlier REVOKE', roleOf(h, '20260101_a.sql', 'revoke_table', 'TRUNCATE:anon').role, 'overridden');
  }

  console.log('\n-- SELF-TEST · REAL CORPUS (each of these was once reported wrongly) --');
  const real = resolveHistory(parseCorpus(MIGRATIONS).objects);
  const r = (file, kind, name) => real.assessments.find((a) => a.obj.file === file && a.obj.kind === kind && a.obj.name === name);
  check('bpc_member_insert is same-day, not "not applied"', r('20260727_rbac_resource_action_flip.sql', 'policy', 'bpc_member_insert')?.role, 'same_day');
  check('anon_select_plants lives on cultivar_plants', r('20260528_per_tenant_rls_isolation.sql', 'policy', 'anon_select_plants')?.id, 'policy|public.cultivar_plants.anon_select_plants');
  check('receipts_storage_delete lives in schema storage', r('20260613_receipts_storage_rls.sql', 'policy', 'receipts_storage_delete')?.id, 'policy|storage.objects.receipts_storage_delete');
  check('campaign_tone_samples resolves to business_voice_samples', r('20260529_campaigns.sql', 'table', 'campaign_tone_samples')?.id, 'table|public.business_voice_samples');
  check('business_assets resolves to cost_objects', r('20260612_business_assets_inventory_pmi_service.sql', 'table', 'business_assets')?.id, 'table|public.cost_objects');
  check('social_drafts.order_id is overridden by 20260608', r('20260522_social_drafts_add_order_post_type.sql', 'column', 'order_id')?.by, ['20260608_social_drafts_subject_ref.sql']);
  check('nursery_modules_business_owner is expected present (the only DROP of its table is commented out)', r('20260529_businesses_d_update_rls.sql', 'policy', 'nursery_modules_business_owner')?.role, 'final');
  check('20260528\'s preamble DROP of authenticated_select_nurseries is not assessed as its effect',
    real.assessments.some((a) => a.obj.file === '20260528_per_tenant_rls_isolation.sql' && a.obj.kind === 'drop_policy' && a.obj.name === 'authenticated_select_nurseries'), false);

  console.log('\n-- SELF-TEST · DATA-BACKFILL DECLARATIONS (both directions, so the list cannot rot) --');
  const corpusNow = parseCorpus(MIGRATIONS); const checks = loadDataChecks();
  check('every data-only migration has a declared check', corpusNow.dataOnly.filter((f) => !checks[f]), []);
  check('no declaration names a file that is not data-only (stale entry)', Object.keys(checks).filter((f) => !corpusNow.dataOnly.includes(f)), []);
  check('every superseded_by names a migration that exists', Object.values(checks).flatMap((c) => c.superseded_by || []).filter((f) => !corpusNow.files.includes(f)), []);
  check('every non-superseded entry carries a check query', Object.entries(checks).filter(([, c]) => c.kind !== 'superseded' && !c.sql).map(([f]) => f), []);
  {
    const v = new Map([['x.sql', { verdict: 'DATA', rows: [] }], ['y.sql', { verdict: 'DATA', rows: [] }], ['z.sql', { verdict: 'DATA', rows: [] }]]);
    applyDataChecks(v, { 'x.sql': { kind: 'evidence', means: 'm', sql: 's' }, 'y.sql': { kind: 'invariant', means: 'm', sql: 's' }, 'z.sql': { kind: 'unverifiable', reason: 'r', sql: 's' } },
      new Map([['x.sql', false], ['y.sql', false], ['z.sql', false]]));
    // 🔴 NEGATIVE CONTROLS — a declared check that observes FALSE must say so, in each kind.
    check('🔴 evidence not found → NOT_APPLIED', v.get('x.sql').verdict, 'NOT_APPLIED');
    check('🔴 invariant broken → VIOLATED', v.get('y.sql').verdict, 'VIOLATED');
    check('🔴 unverifiable reason no longer true → STALE_DECLARATION', v.get('z.sql').verdict, 'STALE_DECLARATION');
  }

  console.log(`\n${failed === 0 ? 'SELF-TEST PASSED' : `SELF-TEST FAILED — ${failed} probe(s)`}`);
  process.exit(failed === 0 ? 0 : 1);
}

// ════════════════════════════════════════════════════════════════════════════════════════
// REPORT
// ════════════════════════════════════════════════════════════════════════════════════════
function report(corpus, verdicts, mode) {
  const ORDER = ['NOT_APPLIED', 'VIOLATED', 'STALE_DECLARATION', 'MIXED', 'TABLE_GONE', 'DATA', 'NOTHING_TO_APPLY', 'COULD_NOT_CHECK', 'INCONCLUSIVE', 'SUPERSEDED', 'HOLDS', 'APPLIED'];
  const by = Object.fromEntries(ORDER.map((k) => [k, []]));
  for (const [file, v] of verdicts) by[v.verdict].push([file, v]);
  const label = (x) => {
    const o = x.a.obj; const sch = o.schema !== 'public' ? `${o.schema}.` : '';
    const where = ['table', 'drop_table', 'drop_view', 'function', 'drop_function', 'revoke_all_tables', 'revoke_default'].includes(o.kind) || !o.table ? '' : `${o.table}.`;
    return `${o.kind.replace('_', ' ')} ${sch}${where}${o.name}`;
  };
  const detail = {
    NOT_APPLIED: (v) => `missing: ${v.rows.filter((x) => x.v === 'MISSING').map(label).join(' · ')}`,
    MIXED: (v) => `MISSING: ${v.rows.filter((x) => x.v === 'MISSING').map(label).join(' · ')}\n      present: ${v.rows.filter((x) => x.v === 'APPLIED').length} object(s)`,
    TABLE_GONE: (v) => `gone, and no migration removes it: ${v.rows.filter((x) => /_GONE_OUTSIDE_MIGRATIONS$/.test(x.v)).map(label).join(' · ')}`,
    DATA: () => 'a data backfill — verify by reading the rows it changed',
    NOTHING_TO_APPLY: () => 'no executable SQL in the file',
    COULD_NOT_CHECK: (v) => `${mode === 'anon' ? 'this mode sees tables and columns only — run --catalog' : 'unobservable'} (${v.rows.length} object(s))`,
    SUPERSEDED: (v) => `replaced by: ${[...new Set(v.rows.flatMap((x) => x.a.by))].join(', ') || 'same-day files (order not provable)'}`,
  };
  console.log('\n== VERDICTS ==');
  for (const k of ORDER) {
    if (!by[k].length || (k === 'APPLIED' && !has('--verbose') && !by[k].some(([, v]) => v.dataNote))) continue;
    if (k === 'APPLIED' && !has('--verbose')) { const dataApplied = by[k].filter(([, v]) => v.dataNote); console.log(`\n-- APPLIED (data backfills with evidence; ${by[k].length - dataApplied.length} more with --verbose) --`); for (const [file, v] of dataApplied) console.log(`  ${file}\n      ${v.dataNote}`); continue; }
    console.log(`\n-- ${k} -- ${by[k].length} file(s) --`);
    for (const [file, v] of by[k]) {
      const d = v.dataNote || (detail[k] ? detail[k](v) : '');
      console.log(`  ${file}${d ? `\n      ${d}` : ''}`);
    }
  }
  // Object-level findings a file's overall verdict can outvote — reported on their own so none is hidden.
  // A file that NEVER RAN has no "removed" objects — its tables were never created, and its own verdict
  // already says so. Listing them here claimed 27 hand-drops that never happened (measured 2026-09-11).
  const gone = [...verdicts].flatMap(([file, v]) => ['TABLE_GONE', 'NOT_APPLIED'].includes(v.verdict) ? [] : v.rows.filter((x) => /_GONE_OUTSIDE_MIGRATIONS$/.test(x.v)).map((x) => [file, x]));
  if (gone.length) {
    console.log(`\n-- REMOVED OUTSIDE ANY MIGRATION -- ${gone.length} object(s) (its table or column is gone and no migration removes it; dropped by hand?) --`);
    for (const [file, x] of gone) console.log(`  ${label(x)}  (created ${file})`);
  }
  const laterNotApplied = [...verdicts.values()].flatMap((v) => v.rows.filter((x) => x.v === 'LATER_CHANGE_NOT_APPLIED'));
  if (laterNotApplied.length) {
    console.log(`\n-- A LATER CHANGE IS NOT IN EFFECT -- ${laterNotApplied.length} object(s) (the file named after "by" did not run) --`);
    for (const x of laterNotApplied) console.log(`  ${label(x)}  (created ${x.a.obj.file}; by ${x.a.by.join(', ')})`);
  }
  console.log('\n== POPULATIONS ==');
  console.log('  ' + ORDER.map((k) => `${k} ${by[k].length}`).join(' · ') + `  (of ${corpus.files.length} files; mode: ${mode})`);
  if (!has('--verbose')) console.log('  (APPLIED files listed with --verbose)');
}

async function main() {
  if (has('--self-test')) return selfTest();
  const corpus = parseCorpus(MIGRATIONS);
  const history = resolveHistory(corpus.objects);
  console.log('== MIGRATION APPLY-STATE ==');
  console.log(`STAGE 1 -- ${corpus.files.length} files · ${corpus.objects.length} statements · ${history.identities.size} objects tracked through their history`);
  if (corpus.unreadable.length) {
    console.log(`  ${corpus.unreadable.length} file(s) build an object name dynamically -- NOT parsed, reported:`);
    for (const u of corpus.unreadable) console.log(`    . ${u.file} (${u.dynamic})`);
  }
  if (has('--sql')) { console.log('\n' + observationSql(history.identities)); return; }
  let obs; let mode;
  if (has('--catalog')) { obs = await observeCatalog(history); mode = 'catalog'; }
  else if (has('--probe')) { obs = await observeAnon(history); mode = 'anon'; }
  else { console.log('\n(offline parse only -- pass --catalog, --probe, --sql or --self-test)'); return; }
  const verdicts = classify(corpus, history, obs);
  if (mode === 'catalog') applyDataChecks(verdicts, loadDataChecks(), await observeData(loadDataChecks()));
  report(corpus, verdicts, mode);
}

main();
