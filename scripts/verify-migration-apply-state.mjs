#!/usr/bin/env node
/**
 * -- MIGRATION APPLY-STATE -- DERIVED, NEVER READ OFF A LABEL -------------------------
 *
 * PURPOSE:      Answer "which migrations are actually in the database" by DERIVING it, because
 *               the repository holds no register. 125 files; seven carry an apply annotation and
 *               118 do not, including every migration the running app plainly depends on. The
 *               annotation is a habit some sessions kept, not a record.
 *
 *               STAGE 1 (offline, cannot rot): parse the corpus into the EXPECTED OBJECT LIST.
 *               STAGE 2 (network, anon key):   probe each table/column and report THREE states.
 *
 * DEPENDENCIES: scripts/lib/migrationParse.mjs . supabase/migrations/ . for --probe only:
 *               packages/cultivar-os/.env.local (VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY)
 *               and NETWORK. The parse half needs none of these.
 * OUTPUTS:      per-file APPLIED / NOT APPLIED / COULD NOT CHECK with the object that decided
 *               it, plus the populations. Exit 1 on an unseen corpus or a failed red-first.
 *
 * THE ANON KEY IS ENOUGH, AND NO ROW IS EVER RETURNED. `?select=<column>&limit=0` asks
 * PostgREST to resolve the name and return nothing:
 *     200 + []          -> the object EXISTS; RLS hid the rows (or there are none)
 *     400 + 42703       -> the COLUMN was never created
 *     404 + PGRST205    -> the TABLE was never created
 *     401/403           -> COULD NOT CHECK -- not evidence of absence
 * Telling the two kinds of empty apart is the whole exercise, so both answers are exercised by
 * the red-first block below before any result is trusted.
 *
 * WHAT THIS CANNOT SEE, and why that must be LOUD rather than green (R-33 -- a check that
 * cannot disagree is not a check): a POLICY, FUNCTION, INDEX, TRIGGER or CONSTRAINT is not
 * reachable over PostgREST at all. Those land in COULD NOT CHECK by construction. If they were
 * to read as clean, this script would manufacture a confident wrong answer, which is worse than
 * the nothing we had -- so the run FAILS when the unresolved population exceeds its declared
 * ceiling in migration-apply-baseline.json.
 */
import { readFileSync, existsSync } from 'node:fs';
import { parseCorpus } from './lib/migrationParse.mjs';

const MIGRATIONS = 'supabase/migrations';
const ENV_FILE = 'packages/cultivar-os/.env.local';
const args = process.argv.slice(2);
const has = (f) => args.includes(f);

/** Object kinds PostgREST can resolve. Everything else is COULD NOT CHECK by construction. */
const PROBEABLE = new Set(['table', 'column', 'drop_table', 'drop_column']);
/** Kinds whose expectation is ABSENCE -- a drop that has run leaves nothing behind. */
const INVERTED = new Set(['drop_table', 'drop_column']);

function readEnv() {
  if (!existsSync(ENV_FILE)) return null;
  const out = {};
  for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  const url = out.VITE_SUPABASE_URL;
  const key = out.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key, ref: (url.match(/https:\/\/([a-z0-9]+)\./) || [])[1] || 'UNKNOWN' };
}

/** One PostgREST name-resolution request. Returns PRESENT | ABSENT | COULD_NOT_CHECK. */
async function probe(env, table, column) {
  const url = `${env.url}/rest/v1/${encodeURIComponent(table)}?select=${encodeURIComponent(column || '*')}&limit=0`;
  let res;
  try {
    res = await fetch(url, { headers: { apikey: env.key, Authorization: `Bearer ${env.key}` } });
  } catch (e) {
    return { state: 'COULD_NOT_CHECK', why: `network: ${e.message}` };
  }
  if (res.status === 200) return { state: 'PRESENT', why: 'resolved, no rows returned' };
  let body = {};
  try { body = await res.json(); } catch { /* non-JSON body */ }
  if (body.code === '42703') return { state: 'ABSENT', why: 'column does not exist' };
  if (body.code === 'PGRST205' || body.code === '42P01') return { state: 'ABSENT', why: 'table does not exist' };
  return { state: 'COULD_NOT_CHECK', why: `HTTP ${res.status} ${body.code || ''}`.trim() };
}

/** RED-FIRST. A probe that has not been shown to answer BOTH ways has proven nothing. */
async function redFirst(env) {
  const cases = [
    { table: 'receipts', column: 'id', expect: 'PRESENT', note: 'a column that exists' },
    { table: 'receipts', column: 'zzz_no_such_column', expect: 'ABSENT', note: 'a column that cannot' },
    { table: 'zzz_no_such_table', column: 'id', expect: 'ABSENT', note: 'a table that cannot' },
  ];
  let ok = true;
  console.log('\n-- RED-FIRST -- the probe must answer BOTH ways before any result is trusted --');
  for (const c of cases) {
    const r = await probe(env, c.table, c.column);
    const pass = r.state === c.expect;
    ok = ok && pass;
    console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${c.table}.${c.column} -> ${r.state} (${r.why}) -- expected ${c.expect}, ${c.note}`);
  }
  if (!ok) console.log('  FAIL: the probe cannot tell the two kinds of empty apart. Every result below is void.');
  return ok;
}

/**
 * STAGE 3 -- the one paste-able query for what PostgREST cannot see.
 * Targeted at the UNRESOLVED files only, never a catalog dump. It emits the expected objects as
 * a VALUES list and LEFT JOINs the catalogs, so every line states PASS or FAIL for itself.
 */
function emitCatalogSql(corpus, unresolvedFiles) {
  const CATALOG = new Set(['policy', 'function', 'index', 'trigger', 'constraint', 'table', 'drop_view']);

  // How many DIFFERENT files declare this same object name? Computed over the WHOLE corpus,
  // because a CREATE OR REPLACE FUNCTION re-declared by four migrations is present in the catalog
  // once whichever of them ran. Existence proves SOMETHING created it, never WHICH file -- so a
  // re-declared name is reported INCONCLUSIVE rather than PASS. Dropping this distinction is how
  // a check reads green over a file it never actually reached.
  const claimants = new Map();
  for (const o of corpus.objects) {
    if (!CATALOG.has(o.kind)) continue;
    const k = `${o.kind}|${o.name}`;
    if (!claimants.has(k)) claimants.set(k, new Set());
    claimants.get(k).add(o.file);
  }

  const seen = new Set();
  const rows = [];
  const noObject = [];
  for (const file of unresolvedFiles) {
    const objs = corpus.objects.filter((o) => o.file === file && CATALOG.has(o.kind));
    if (objs.length === 0) { noObject.push(file); continue; }
    for (const o of objs) {
      // Dedupe WITHIN a file only. Deduping across files silently deleted 5 whole files from an
      // earlier draft of this query, which would have read as settled without ever being asked.
      const k = `${file}|${o.kind}|${o.name}|${o.table || ''}`;
      if (seen.has(k)) continue;
      seen.add(k);
      const q = (v) => (v === null || v === undefined ? 'NULL' : `'${String(v).replace(/'/g, "''")}'`);
      rows.push(`  (${q(file)}, ${q(o.kind)}, ${q(o.name)}, ${q(o.table)}, ${claimants.get(`${o.kind}|${o.name}`).size})`);
    }
  }

  console.log('\n\n== STAGE 3 -- PASTE INTO THE SUPABASE SQL EDITOR ==');
  console.log(`-- project ref: bgobkjcopcxusjsetfob (cultivar-os). ${rows.length} objects across`);
  console.log(`-- ${unresolvedFiles.length - noObject.length} of the ${unresolvedFiles.length} unresolved files. READ-ONLY: catalogs only, no customer row.`);
  console.log(`
WITH expected(file, kind, name, tbl, claimants) AS (VALUES
${rows.join(',\n')}
),
found AS (
  SELECT e.*,
    CASE e.kind
      WHEN 'policy'     THEN EXISTS (SELECT 1 FROM pg_policies p
                                      WHERE p.schemaname = 'public' AND p.policyname = e.name
                                        AND p.tablename = e.tbl)
      WHEN 'function'   THEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                                      WHERE n.nspname = 'public' AND p.proname = e.name)
      WHEN 'index'      THEN EXISTS (SELECT 1 FROM pg_indexes i
                                      WHERE i.schemaname = 'public' AND i.indexname = e.name)
      WHEN 'trigger'    THEN EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                                      JOIN pg_namespace n ON n.oid = c.relnamespace
                                      WHERE n.nspname = 'public' AND t.tgname = e.name AND NOT t.tgisinternal)
      WHEN 'constraint' THEN EXISTS (SELECT 1 FROM pg_constraint co JOIN pg_namespace n ON n.oid = co.connamespace
                                      WHERE n.nspname = 'public' AND co.conname = e.name)
      WHEN 'table'      THEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                                      WHERE n.nspname = 'public' AND c.relname = e.name AND c.relkind IN ('r','p'))
      WHEN 'drop_view'  THEN NOT EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                                      WHERE n.nspname = 'public' AND c.relname = e.name AND c.relkind = 'v')
      ELSE NULL
    END AS ran
  FROM expected e
)
SELECT file,
       count(*)                                                  AS expected,
       count(*) FILTER (WHERE ran)                               AS present,
       count(*) FILTER (WHERE ran AND claimants > 1)              AS shared_names,
       CASE
         WHEN bool_or(ran IS NULL)                        THEN 'COULD NOT CHECK -- unhandled kind'
         WHEN bool_and(NOT ran)                           THEN 'FAIL -- NOT APPLIED'
         WHEN bool_or(NOT ran)                            THEN 'FAIL -- MIXED, read missing'
         WHEN bool_and(claimants > 1)                     THEN 'INCONCLUSIVE -- every name it declares is also declared by another migration, so presence cannot attribute it to THIS file'
         ELSE                                                  'PASS -- APPLIED'
       END                                                       AS verdict,
       coalesce(string_agg(kind || ' ' || name, ', ' ORDER BY name)
                FILTER (WHERE NOT ran), '')                      AS missing
FROM found
GROUP BY file
ORDER BY verdict, file;
`);
  console.log('-- 🔴 THE THIRD CATEGORY THIS QUERY CANNOT SETTLE EITHER, NAMED RATHER THAN OMITTED.');
  console.log(`-- ${noObject.length} unresolved migrations declare NO catalog object at all: their whole effect is a`);
  console.log('-- data backfill (UPDATE/INSERT/DELETE), a GRANT/REVOKE, a COMMENT, an ALTER COLUMN');
  console.log('-- nullability change or a DROP CONSTRAINT. Apply-state for these is knowable only from');
  console.log('-- the ROWS or from privilege/constraint catalogs -- neither of which this exercise reads.');
  console.log('-- They stay COULD NOT CHECK after Stage 3, and that is the honest answer, not a gap:');
  for (const f of noObject) console.log(`--   . ${f}`);
}

async function main() {
  const corpus = parseCorpus(MIGRATIONS);
  const probeable = corpus.objects.filter((o) => PROBEABLE.has(o.kind));
  const unprobeable = corpus.objects.filter((o) => !PROBEABLE.has(o.kind));

  console.log('== MIGRATION APPLY-STATE ==');
  console.log(`STAGE 1 -- corpus parsed OFFLINE: ${corpus.files.length} files, ${corpus.objects.length} objects.`);
  const byKind = {};
  for (const o of corpus.objects) byKind[o.kind] = (byKind[o.kind] || 0) + 1;
  console.log('  ' + Object.entries(byKind).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join('  '));
  console.log(`  probeable over PostgREST: ${probeable.length} . unprobeable by construction: ${unprobeable.length}`);
  if (corpus.empty.length) {
    console.log(`  ${corpus.empty.length} files declare NO tracked object (data-only, GRANT/REVOKE, COMMENT,`);
    console.log('  ALTER COLUMN or DROP CONSTRAINT -- each read and confirmed, not assumed):');
    for (const f of corpus.empty) console.log(`    . ${f}`);
  }
  if (corpus.unreadable.length) {
    console.log(`  ${corpus.unreadable.length} file(s) build an object name dynamically -- NOT parsed, reported:`);
    for (const u of corpus.unreadable) console.log(`    . ${u.file} (${u.dynamic})`);
  }

  if (!has('--probe')) { console.log('\n(offline parse only -- pass --probe for STAGE 2)'); return; }

  const env = readEnv();
  if (!env) { console.log('\nCOULD NOT CHECK -- no anon key at ' + ENV_FILE + '. Nothing below is a result.'); process.exit(1); }
  console.log(`\nSTAGE 2 -- probing project ref ${env.ref} (${env.url}) with the ANON key. No service key, no rows.`);

  if (!(await redFirst(env))) process.exit(1);

  // Probe distinct (table, column) pairs once; many migrations touch the same object.
  const wanted = new Map();
  const keyOf = (o) => `${o.table} ${o.kind === 'table' || o.kind === 'drop_table' ? '' : o.name}`;
  for (const o of probeable) {
    const key = keyOf(o);
    if (!wanted.has(key)) wanted.set(key, { table: o.table, column: o.kind === 'table' || o.kind === 'drop_table' ? null : o.name });
    // Probe the TABLE for every column too, even one whose table the corpus never creates.
    // Without this, a column on a pre-migration-era table (nursery_modules, plants) whose table
    // is gone reads as a missing COLUMN -- a different and wrong finding. The distinction has to
    // be reachable or the verdict is decided by which table happens to have a CREATE in the corpus.
    if (o.table && !wanted.has(`${o.table} `)) wanted.set(`${o.table} `, { table: o.table, column: null });
  }
  const results = new Map();
  const pending = [...wanted.entries()];
  const WORKERS = 6;
  await Promise.all(Array.from({ length: WORKERS }, async () => {
    while (pending.length) {
      const [key, w] = pending.shift();
      results.set(key, await probe(env, w.table, w.column));
    }
  }));

  // A column on a table that does not exist is not independently ABSENT -- it inherits.
  const tableState = new Map();
  for (const [key, r] of results) { const [t, c] = key.split(' '); if (!c) tableState.set(t, r.state); }

  const perFile = new Map();
  for (const f of corpus.files) perFile.set(f, { present: [], absent: [], unchecked: [], unprobeable: 0 });
  for (const o of unprobeable) perFile.get(o.file).unprobeable++;
  for (const o of probeable) {
    const r = results.get(keyOf(o));
    const bucket = perFile.get(o.file);
    const label = `${o.kind} ${o.table}${o.kind.endsWith('column') ? '.' + o.name : ''}`;
    if (r.state === 'COULD_NOT_CHECK') { bucket.unchecked.push(`${label} -- ${r.why}`); continue; }
    if (o.kind.endsWith('column') && tableState.get(o.table) === 'ABSENT') {
      // Both directions are unresolvable, and for OPPOSITE reasons worth stating separately.
      bucket.unchecked.push(o.kind === 'column'
        ? `${label} -- its TABLE does not exist, so the column cannot be probed independently`
        : `${label} -- its TABLE does not exist, so the column's absence proves the DROP ran only if the table was there to drop from`);
      continue;
    }
    // A drop has RUN when the object is gone; a create has RUN when it is there.
    const ran = INVERTED.has(o.kind) ? r.state === 'ABSENT' : r.state === 'PRESENT';
    (ran ? bucket.present : bucket.absent).push(label);
  }

  const applied = [], notApplied = [], mixed = [], cantCheck = [];
  for (const [file, b] of perFile) {
    if (b.present.length && !b.absent.length) applied.push([file, b]);
    else if (b.absent.length && !b.present.length) notApplied.push([file, b]);
    else if (b.absent.length && b.present.length) mixed.push([file, b]);
    else cantCheck.push([file, b]);
  }

  const show = (title, rows, detail) => {
    console.log(`\n-- ${title} -- ${rows.length} file(s) --`);
    for (const [file, b] of rows) console.log(`  ${file}${detail ? `\n      ${detail(b)}` : ''}`);
  };
  show('APPLIED -- every probeable object it declares is in the database', applied,
    (b) => `proof: ${b.present[0]}${b.present.length > 1 ? ` (+${b.present.length - 1} more)` : ''}${b.unprobeable ? ` . ${b.unprobeable} unprobeable object(s) NOT covered by this verdict` : ''}`);
  show('NOT APPLIED -- every probeable object it declares is missing', notApplied,
    (b) => `missing: ${b.absent.join(' . ')}`);
  show('MIXED -- some objects present, some missing. A file cannot half-run: read each one', mixed,
    (b) => `present: ${b.present.join(' . ')}\n      MISSING: ${b.absent.join(' . ')}`);
  show('COULD NOT CHECK -- nothing in the file is reachable over PostgREST', cantCheck,
    (b) => `${b.unprobeable} unprobeable object(s)${b.unchecked.length ? ` . ${b.unchecked.length} blocked probe(s)` : ''}`);

  if (has('--sql')) emitCatalogSql(corpus, cantCheck.map(([f]) => f));

  const uncheckedObjects = unprobeable.length + [...perFile.values()].reduce((n, b) => n + b.unchecked.length, 0);
  console.log('\n== POPULATIONS ==');
  console.log(`  APPLIED ${applied.length} . NOT APPLIED ${notApplied.length} . MIXED ${mixed.length} . COULD NOT CHECK ${cantCheck.length}  (of ${corpus.files.length} files)`);
  console.log(`  objects: ${probeable.length} probeable, ${uncheckedObjects} unresolved (policy/function/index/trigger/constraint -- not reachable over PostgREST)`);
  console.log(`  project probed: ${env.ref}`);
}

main();
