#!/usr/bin/env node
// ============================================================
// verify-select-policies — EVERY TABLE HAS RLS *AND* A POLICY THAT CAN ACTUALLY SELECT
// PURPOSE:      RLS enabled with NO select-capable policy is DENY-ALL. That is fail-closed, so it
//               is never a leak — but it is invisible, and it has bitten this platform THREE TIMES
//               with the same root cause: `modules` (2026-05-22), `nursery_modules` (2026-05-22),
//               `orders` (2026-05-27). Each time a table was created, RLS was switched on, the
//               SELECT policy was forgotten, and the surface came up empty with no error anywhere.
//
// 🔴 WHY THIS EXISTS AS A CAP AND NOT AS A DECISION (the actual finding):
//               CLAUDE.md's Open Architecture Decisions #11 recorded this exact problem on
//               2026-05-27 and set its own trigger — *"within 30 days OR before any new table is
//               added to Cultivar OS."* THE TRIGGER FIRED AT LEAST THREE TIMES (`people` 2026-06-25,
//               the ledger tables 2026-07-20, and others) AND NOTHING FIRED WITH IT, because the
//               trigger lived in a markdown table nothing reads on a schedule. **A deadline written
//               where nothing watches it is not a deadline.** #11's answer was never "decide
//               something" — it was always "build the check." This is the check.
//
// THE RULE:     Every live table in the migration corpus must have (a) RLS ENABLED and (b) at least
//               one SELECT-capable policy — `FOR SELECT`, `FOR ALL`, or no `FOR` clause (Postgres
//               defaults to ALL) — **or be DECLARED in `select-policy-declarations.json` with a
//               reason.** Deny-all is a legitimate design for server-only reference data; it is not
//               a legitimate ACCIDENT. The declaration is what tells those two apart.
//
// 🔴 THE DECLARATION LIST PRUNES ITSELF — the #73 lesson, built in.
//               `verify-universals`'s `OWNER_ONLY_PENDING` is a HARDCODED gap list that only ever
//               grows; six of its nine entries are now stale and it prints on every run, which is
//               how a gap list stops being read (tech-debt #73). So this cap asserts its OWN
//               declarations in the other direction: a declaration for a table that no longer
//               exists, or that has since GAINED a select-capable policy, is reported as STALE and
//               FAILS THE BUILD. The list cannot rot into noise, because rot is a failure.
//
// SCOPE / STATED LIMITS (a cap that overreaches is worse than one that says what it cannot see):
//               · Reads the REPO migration corpus, not the live catalog. A policy created by hand in
//                 the dashboard is invisible here — which is exactly why §6 r17 exists.
//               · Does NOT evaluate the policy's `TO <role>` or its USING predicate. "A select-capable
//                 policy exists" is not "the right people can read." Depth is cap #2/#3/capP's job;
//                 this cap answers the ONE question those three all presuppose.
//               · Cultivar only. Ignition is single-device PIN/local-first — its permissive RLS is a
//                 documented exception (CLAUDE.md "Auth Architecture — Locked Rule").
// DEPENDENCIES: none (node stdlib only).
// OUTPUTS:      exit 0 = every table covered or declared · 1 = an undeclared table, or a stale
//               declaration · 2 = the cap's own probes failed (it refuses to report).
// USAGE:        npm run verify:select-policies · `--dump` lists every table and its verdict.
// ============================================================
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const MIGRATIONS_DIR = 'supabase/migrations';
const DECL_FILE = join(ROOT, 'select-policy-declarations.json');
const DUMP = process.argv.includes('--dump');

const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', DIM = '\x1b[2m', B = '\x1b[1m', O = '\x1b[0m';

// ── SQL comment stripping ────────────────────────────────────────────────────
// Runs BEFORE any structural match. Not optional: the first draft of this cap reported three
// tables named `at`, `migration`, and `only` — all three were prose inside `--` comments matched by
// a `CREATE TABLE\s+(\w+)` pattern. A detector that reads prose as schema invents tables.
function stripSqlComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map((l) => l.replace(/--.*$/, '')).join('\n');
}

/**
 * Parse a migration corpus into a per-table picture.
 * `files` is [{ name, content }] in APPLY ORDER (filename order = chronological, append-only).
 * Order matters: a policy dropped after its last create is gone; a table dropped is gone.
 */
export function analyze(files) {
  const sql = stripSqlComments(files.map((f) => `\n-- FILE: ${f.name}\n${f.content}`).join('\n'));

  // Tables: CREATE TABLE requires the opening paren, so `CREATE TABLE` in prose cannot mint one.
  const created = new Map();
  for (const m of sql.matchAll(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s*\(/gi)) {
    if (!created.has(m[1])) created.set(m[1], m.index);
  }
  const dropped = new Set();
  for (const m of sql.matchAll(/DROP TABLE\s+(?:IF EXISTS\s+)?(?:public\.)?"?([a-z0-9_]+)"?/gi)) dropped.add(m[1]);

  // RLS enabled (a later DISABLE wins — same last-wins discipline as policies).
  const rlsAt = new Map(), rlsOffAt = new Map();
  for (const m of sql.matchAll(/ALTER TABLE\s+(?:(?:IF EXISTS|ONLY)\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s+ENABLE ROW LEVEL SECURITY/gi)) rlsAt.set(m[1], m.index);
  for (const m of sql.matchAll(/ALTER TABLE\s+(?:(?:IF EXISTS|ONLY)\s+)?(?:public\.)?"?([a-z0-9_]+)"?\s+DISABLE ROW LEVEL SECURITY/gi)) rlsOffAt.set(m[1], m.index);

  // Policies, last-wins per (table, name). The command is read from the segment BEFORE the
  // predicate — a `USING (...)` body can contain the word "for", and matching into it would
  // classify a policy by its own WHERE clause.
  const policyAt = new Map(); // `${table}::${name}` -> { table, name, cmd, at }
  for (const m of sql.matchAll(/CREATE POLICY\s+"?([A-Za-z0-9_]+)"?\s+ON\s+(?:public\.)?"?([a-z0-9_]+)"?([\s\S]*?);/gi)) {
    const [, name, table, rest] = m;
    const head = rest.split(/\bUSING\b|\bWITH\s+CHECK\b/i)[0];
    const forM = head.match(/\bFOR\s+(ALL|SELECT|INSERT|UPDATE|DELETE)\b/i);
    // No FOR clause → Postgres defaults to ALL, which INCLUDES select. Encoded, not assumed.
    policyAt.set(`${table}::${name}`, { table, name, cmd: forM ? forM[1].toUpperCase() : 'ALL', at: m.index });
  }
  for (const m of sql.matchAll(/DROP POLICY\s+(?:IF EXISTS\s+)?"?([A-Za-z0-9_]+)"?\s+ON\s+(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
    const k = `${m[2]}::${m[1]}`;
    const p = policyAt.get(k);
    if (p && m.index > p.at) policyAt.delete(k);   // dropped after its last create → gone
  }

  const tables = [];
  for (const [name] of [...created].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (dropped.has(name)) continue;
    const policies = [...policyAt.values()].filter((p) => p.table === name).map((p) => ({ name: p.name, cmd: p.cmd }));
    const on = rlsAt.has(name);
    const off = rlsOffAt.has(name) && rlsOffAt.get(name) > rlsAt.get(name);
    tables.push({
      name,
      rls: on && !off,
      policies,
      selectable: policies.filter((p) => p.cmd === 'ALL' || p.cmd === 'SELECT').map((p) => p.name),
    });
  }
  return { tables, droppedTables: [...dropped] };
}

/** Split tables into covered / violating, and audit the declaration list in the other direction. */
export function judge({ tables }, declarations) {
  const declared = new Map(Object.entries(declarations ?? {}));
  const violations = [], covered = [], exempt = [];

  for (const t of tables) {
    const problems = [];
    if (!t.rls) problems.push('RLS NOT ENABLED');
    if (!t.selectable.length) {
      problems.push(t.policies.length
        ? `no SELECT-capable policy (has only ${t.policies.map((p) => `${p.name}:${p.cmd}`).join(', ')})`
        : 'NO POLICIES AT ALL — deny-all');
    }
    if (!problems.length) { covered.push(t); continue; }
    if (declared.has(t.name)) { exempt.push({ ...t, reason: declared.get(t.name), problems }); continue; }
    violations.push({ ...t, problems });
  }

  // The other direction — a declaration must still be EARNED. Both stale shapes fail the build.
  const live = new Set(tables.map((t) => t.name));
  const stale = [];
  for (const [name, reason] of declared) {
    if (!live.has(name)) { stale.push({ name, reason, why: 'table no longer exists in the corpus' }); continue; }
    const t = tables.find((x) => x.name === name);
    if (t.rls && t.selectable.length) {
      stale.push({ name, reason, why: `now HAS a select-capable policy (${t.selectable.join(', ')}) — the declaration is spent` });
    }
  }
  return { violations, covered, exempt, stale };
}

// ── PROBES (STD-022 — planted, both directions, BEFORE the scan) ─────────────
function runProbes() {
  const R = [];
  const ck = (n, e, g) => R.push({ name: n, expect: String(e), got: String(g), ok: String(e) === String(g) });
  const A = (sql) => analyze([{ name: '0001.sql', content: sql }]);
  const T = (sql, name = 't') => A(sql).tables.find((x) => x.name === name);
  const V = (sql, decl = {}) => judge(A(sql), decl);
  const ON = 'ALTER TABLE t ENABLE ROW LEVEL SECURITY;';
  const MK = `CREATE TABLE t (id uuid);\n${ON}\n`;

  // ── NEGATIVE: these are CORRECT and must NOT be reported ──
  ck('S1 FOR SELECT is select-capable', 0,
    V(`${MK}CREATE POLICY p ON t FOR SELECT TO authenticated USING (true);`).violations.length);
  ck('S2 FOR ALL is select-capable (ALL includes SELECT)', 0,
    V(`${MK}CREATE POLICY p ON t FOR ALL TO authenticated USING (true);`).violations.length);
  ck('S3 NO `FOR` clause defaults to ALL → select-capable', 0,
    V(`${MK}CREATE POLICY p ON t TO authenticated USING (true);`).violations.length);
  ck('S4 a DROPPED table is not evaluated at all', 0,
    V(`${MK}DROP TABLE t;`).violations.length);
  ck('S5 a policy DROPPED then RE-CREATED still counts (last-wins, not first-seen)', 0,
    V(`${MK}CREATE POLICY p ON t FOR SELECT USING (true);\nDROP POLICY p ON t;\nCREATE POLICY p ON t FOR SELECT USING (true);`).violations.length);
  ck('S6 a DECLARED deny-all table is exempt, not a violation', 0,
    V(`${MK}`, { t: 'server-only reference data' }).violations.length);
  ck('S7 …and it is still REPORTED as exempt, never silently dropped', 1,
    V(`${MK}`, { t: 'server-only reference data' }).exempt.length);
  ck('S8 `CREATE TABLE` inside a comment does not mint a table (the first-draft defect)', 0,
    A(`-- CREATE TABLE ghost (\n/* CREATE TABLE phantom ( */\n${MK}CREATE POLICY p ON t FOR SELECT USING (true);`)
      .tables.filter((x) => x.name !== 't').length);
  ck('S9 the word "for" inside a USING predicate does not set the command', 'SELECT',
    T(`${MK}CREATE POLICY p ON t FOR SELECT USING (note = 'reserved for staff');`).policies[0].cmd);

  // ── POSITIVE: these are the defects, and each must FAIL ──
  ck('S10 🔴 RLS on, NO policies at all → deny-all, reported (the modules/orders defect)', 1,
    V(`${MK}`).violations.length);
  ck('S11 🔴 policies exist but NONE can select → reported (the subtle one)', 1,
    V(`${MK}CREATE POLICY w ON t FOR INSERT WITH CHECK (true);\nCREATE POLICY u ON t FOR UPDATE USING (true);`).violations.length);
  ck('S12 🔴 the only SELECT policy was DROPPED later → reported', 1,
    V(`${MK}CREATE POLICY p ON t FOR SELECT USING (true);\nDROP POLICY p ON t;`).violations.length);
  ck('S13 🔴 a table with a SELECT policy but RLS never enabled → reported', 1,
    V(`CREATE TABLE t (id uuid);\nCREATE POLICY p ON t FOR SELECT USING (true);`).violations.length);
  ck('S14 🔴 RLS ENABLED then DISABLED later → reported (last-wins both ways)', 1,
    V(`${MK}CREATE POLICY p ON t FOR SELECT USING (true);\nALTER TABLE t DISABLE ROW LEVEL SECURITY;`).violations.length);

  // ── THE DECLARATION LIST IS ITSELF ASSERTED (the #73 lesson) ──
  ck('S15 🔴 a declaration for a table that NO LONGER EXISTS is STALE → fails', 1,
    V(`${MK}CREATE POLICY p ON t FOR SELECT USING (true);`, { gone_table: 'reason' }).stale.length);
  ck('S16 🔴 a declaration for a table that has SINCE GAINED a policy is STALE → fails', 1,
    V(`${MK}CREATE POLICY p ON t FOR SELECT USING (true);`, { t: 'was deny-all' }).stale.length);
  ck('S17 a declaration that is still EARNED is not stale', 0,
    V(`${MK}`, { t: 'still deny-all' }).stale.length);

  return R;
}

// ── run ──────────────────────────────────────────────────────────────────────
const probes = runProbes();
const probeFails = probes.filter((p) => !p.ok);
if (probeFails.length) {
  console.error(`\n${RED}${B}✗ THE CAP'S OWN PROBES FAILED — refusing to report.${O}`);
  for (const p of probeFails) console.error(`  ${RED}${p.name}${O}  expected ${p.expect}, got ${p.got}`);
  process.exit(2);
}

const dir = join(ROOT, MIGRATIONS_DIR);
const files = existsSync(dir)
  ? readdirSync(dir).filter((f) => f.endsWith('.sql')).sort().map((f) => ({ name: f, content: readFileSync(join(dir, f), 'utf8') }))
  : [];
const parsed = analyze(files);
const declarations = existsSync(DECL_FILE) ? JSON.parse(readFileSync(DECL_FILE, 'utf8')).declarations ?? {} : {};
const { violations, covered, exempt, stale } = judge(parsed, declarations);

if (DUMP) {
  for (const t of parsed.tables) {
    const verdict = t.selectable.length && t.rls ? 'COVERED' : declarations[t.name] ? 'DECLARED' : 'VIOLATION';
    console.log(`${t.name}\t${verdict}\t${t.rls ? 'rls:on' : 'rls:OFF'}\t${t.selectable.join('|') || '-'}`);
  }
  process.exit(0);
}

console.log(`\n${B}SELECT-POLICY COVERAGE${O} ${DIM}— every table has RLS and a policy that can actually select${O}`);
console.log(`${DIM}  ${MIGRATIONS_DIR} · ${files.length} migrations · ${parsed.tables.length} live tables (${parsed.droppedTables.length} dropped) · ${probes.length} probes passed${O}\n`);
console.log(`  ${GRN}${covered.length} covered${O} · ${YEL}${exempt.length} declared${O} · ${violations.length ? RED : GRN}${violations.length} undeclared${O} · ${stale.length ? RED : GRN}${stale.length} stale declarations${O}\n`);

for (const e of exempt) {
  console.log(`  ${YEL}DECLARED${O}  ${B}${e.name}${O} ${DIM}— ${e.problems.join('; ')}${O}`);
  console.log(`            ${DIM}reason: ${e.reason}${O}`);
}
for (const v of violations) {
  console.log(`  ${RED}${B}UNDECLARED${O}  ${B}${v.name}${O} — ${v.problems.join('; ')}`);
}
for (const s of stale) {
  console.log(`  ${RED}${B}STALE DECL${O}  ${B}${s.name}${O} — ${s.why}`);
}

if (violations.length || stale.length) {
  console.log(`\n${RED}${B}✗ FAIL${O} — ${violations.length} undeclared table(s), ${stale.length} stale declaration(s).`);
  if (violations.length) {
    console.log(`${DIM}  A table with RLS on and no select-capable policy is DENY-ALL: fail-closed, never a leak,${O}`);
    console.log(`${DIM}  and INVISIBLE — the surface comes up empty with no error. Add the SELECT policy, or declare${O}`);
    console.log(`${DIM}  the table in select-policy-declarations.json with the reason it is deliberately closed.${O}`);
  }
  if (stale.length) {
    console.log(`${DIM}  A spent declaration is how a gap list rots into noise (tech-debt #73). Delete the entry.${O}`);
  }
  process.exit(1);
}

console.log(`${GRN}${B}✓ PASS${O} — every live table has RLS and a select-capable policy, or a declared reason.\n`);
process.exit(0);
