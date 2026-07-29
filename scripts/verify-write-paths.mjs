#!/usr/bin/env node
// ============================================================
// verify-write-paths — MORE THAN ONE WRITE PATH TO A TABLE FAILS THE BUILD UNLESS DECLARED
// PURPOSE:      Nothing in the build loop ever asked "does this record already have a write path?"
//               Generating a new component is cheaper than finding and reusing the existing one —
//               reuse requires reading and understanding what is there first — so write paths to a
//               table accumulate, each locally sensible, each shipped in a session that could not
//               see the others. `customers` reached five in app code alone. This cap asks the
//               question mechanically.
// THE RULE:     One write path per table is correct. An intentional second path is DECLARED in
//               ALLOWED_DIVERGENCE with its reason — declared, not discovered.
// TWO VERDICTS, REPORTED TOGETHER (deliberate):
//               · GOAL   — one path per table. Informational. The 17 known failures stay VISIBLE
//                          so they cannot quietly become invisible debt.
//               · RATCHET — the build-failing assertion: no NEW undeclared path versus
//                          `write-paths-baseline.json`. Same zero-net-new shape `npm run verify`
//                          already uses for tsc/eslint/knip. WHY: a gate that blocks every build
//                          gets worked around, and a worked-around gate is worse than none. This
//                          makes surface EIGHT impossible tomorrow without waiting for the seven.
// UNIT:         A PATH IS A FILE, not a call site. `inventoryEdit.ts` writes business_inventory at
//               five call sites and is ONE path — one module, one field list (§6 r8 / STD-011).
// FLOOR, NOT TOTAL: this cap reads SOURCE. An RPC's target table lives in the DATABASE, so ~11 RPC
//               writers and 12 dynamic table names are REPORTED and not judged. Every count here is
//               a FLOOR. The rpc→table map is the cap's own next build — it is owed.
// DEPENDENCIES: none (node stdlib only).
// OUTPUTS:      exit 0 = no new undeclared path. exit 1 = a new path (named). exit 2 = the cap's
//               own probes failed, so it refuses to report at all.
// USAGE:        npm run verify:write-paths          — assert
//               npm run write-paths:baseline        — re-record the baseline (lock a win)
// ============================================================
import { readdirSync, readFileSync, writeFileSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const BASELINE_FILE = join(ROOT, 'write-paths-baseline.json');
const UPDATE = process.argv.includes('--update');

// ── CORPUS (named, per STD-021) ──────────────────────────────────────────────
const SCAN_ROOTS = [
  'packages/cultivar-os/src', 'packages/cultivar-os/api',
  'packages/shared/src', 'packages/trace-app/src', 'api', 'scripts',
];
// ignition-os is FROZEN donor code (CLAUDE.md §2) — excluded deliberately, not by oversight.
const EXCLUDE_DIRS = new Set(['node_modules', 'dist', 'build', '.git', 'fixtures']);
// This file's own planted probes contain literal `.from('widgets').insert(...)`; scanning itself
// would report `widgets`/`gears` as real tables. Self-excluded — stated, not silent.
const EXCLUDE_FILE = /(\.(test|spec)\.[tj]sx?|verify-write-paths\.mjs)$/;
const SOURCE_EXT   = /\.(ts|tsx|js|jsx|mjs)$/;

// `scripts/` is one-off TOOLING — seeds, backfills, verifiers: run by hand, never deployed, and
// legitimately touching many tables at once. REPORTED, never asserted. A cap that silently narrows
// its own scope reads as "covered everything" when it did not.
const isTooling = p => p.startsWith('scripts/');

// ── DECLARED DIVERGENCE — an intentional second path, WITH ITS REASON ────────
// table -> { reason, paths: [...] }. Declaring is not a blanket exemption: a path that appears and
// is not declared still fails, so the list records decisions made rather than pre-authorizing the next.
const ALLOWED_DIVERGENCE = {
  // Empty by design. Every entry must be a decision David made, not a convenience the builder
  // granted itself. The 17 known multi-path tables are held by the BASELINE, not by declarations —
  // the baseline says "known today", a declaration says "correct forever". They are different claims.
};

// ── ANALYZER (pure) ──────────────────────────────────────────────────────────
const WRITE_VERBS = ['insert', 'update', 'upsert', 'delete'];

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map(l => { const t = l.trimStart(); return t.startsWith('//') || t.startsWith('*') ? '' : l; })
    .join('\n');
}

export function analyze(files) {
  const tables = new Map(), rpcs = new Map(), dynamic = [];
  for (const { path, content } of files) {
    const src = stripComments(content);
    const fromRe = /\.from\(\s*(['"`])([^'"`]+)\1\s*\)/g;
    let m;
    while ((m = fromRe.exec(src)) !== null) {
      const table = m[2];
      // Window bounded by the end of THIS statement, so a later statement's write on another table
      // is never attributed here.
      const rest = src.slice(m.index);
      const semi = rest.indexOf(';');
      const win  = semi === -1 ? rest.slice(0, 400) : rest.slice(0, semi);
      const verbs = WRITE_VERBS.filter(v => win.includes(`.${v}(`));
      if (verbs.length === 0) continue;
      if (!tables.has(table)) tables.set(table, new Map());
      const byPath = tables.get(table);
      if (!byPath.has(path)) byPath.set(path, new Set());
      verbs.forEach(v => byPath.get(path).add(v));
    }
    const dynRe = /\.from\(\s*([A-Za-z_$][\w$.]*)\s*\)/g;
    while ((m = dynRe.exec(src)) !== null) dynamic.push({ path, expr: m[1] });
    const rpcRe = /\.rpc\(\s*(['"`])([^'"`]+)\1/g;
    while ((m = rpcRe.exec(src)) !== null) {
      if (!rpcs.has(m[2])) rpcs.set(m[2], new Set());
      rpcs.get(m[2]).add(path);
    }
  }
  return { tables, rpcs, dynamic };
}

// ── JUDGE (pure — separate from observation so both verdicts are testable) ───
export function judge(tables, { baseline = {}, allowed = ALLOWED_DIVERGENCE } = {}) {
  const rows = [];
  for (const [table, byPathAll] of tables) {
    const appPaths = [...byPathAll.keys()].filter(p => !isTooling(p)).sort();
    const tooling  = [...byPathAll.keys()].filter(isTooling).sort();
    const declared = allowed[table];
    const known    = new Set([...(baseline[table] ?? []), ...(declared?.paths ?? [])]);

    // GOAL verdict — one path, or every path declared. Informational.
    let goal, goalNote = '';
    if (appPaths.length <= 1) goal = 'PASS';
    else if (declared && appPaths.every(p => declared.paths.includes(p))) { goal = 'PASS'; goalNote = `declared: ${declared.reason}`; }
    else { goal = 'FAIL'; goalNote = declared ? 'declared, but undeclared path(s) present' : 'more than one write path, none declared'; }

    // RATCHET verdict — the build-failing one. A NEW path is one neither baselined nor declared.
    const isNewTable = !(table in baseline) && !declared;
    const newPaths = appPaths.filter(p => !known.has(p));
    // A brand-new table with a single path is fine — that is a normal first build.
    const ratchetFail = isNewTable ? appPaths.length > 1 : newPaths.length > 0;
    const removed = [...(baseline[table] ?? [])].filter(p => !appPaths.includes(p));

    rows.push({ table, appPaths, tooling, goal, goalNote, newPaths, removed, ratchetFail, isNewTable });
  }
  rows.sort((a, b) => b.appPaths.length - a.appPaths.length || a.table.localeCompare(b.table));
  return rows;
}

// ── PROBES (STD-022 — planted, BOTH directions, before the real scan) ────────
function runProbes() {
  const f = (path, content) => ({ path, content });
  const R = [];
  const check = (name, expect, got) => R.push({ name, expect, got, ok: got === expect });
  const goalOf  = (files, table, opts) => { const r = judge(analyze(files).tables, opts).find(x => x.table === table); return r ? r.goal : 'ABSENT'; };
  const ratchOf = (files, table, opts) => { const r = judge(analyze(files).tables, opts).find(x => x.table === table); return r ? (r.ratchetFail ? 'NEW' : 'OK') : 'ABSENT'; };

  // -- detection --
  check('P1 two undeclared paths → GOAL FAIL', 'FAIL',
    goalOf([f('a.ts', `supabase.from('w').insert(x);`), f('b.ts', `supabase.from('w').update(y);`)], 'w'));
  check('P2 one path, many call sites → GOAL PASS', 'PASS',
    goalOf([f('a.ts', `supabase.from('w').insert(x);\nsupabase.from('w').update(y);\nsupabase.from('w').delete();`)], 'w'));
  check('P3 reads only → not a write path at all', 'ABSENT',
    goalOf([f('a.ts', `supabase.from('w').select('id');`), f('b.ts', `supabase.from('w').select('*');`)], 'w'));
  check('P4 a comment describing a write is NOT a write', 'PASS',
    goalOf([f('a.ts', `// supabase.from('w').update(z);\nsupabase.from('w').insert(x);`), f('b.ts', `/* .from('w').delete() */ const q=1;`)], 'w'));
  check('P5 a later statement is not attributed to an earlier read', 'ABSENT',
    goalOf([f('a.ts', `supabase.from('w').select('id');\nsupabase.from('g').update(y);`)], 'w'));
  check('P8 one APP path + tooling paths → GOAL PASS', 'PASS',
    goalOf([f('packages/x/a.ts', `supabase.from('w').update(y);`), f('scripts/seed.mjs', `supabase.from('w').insert(x);`)], 'w'));
  check('P9 two APP paths still FAIL when tooling also writes', 'FAIL',
    goalOf([f('packages/x/a.ts', `supabase.from('w').update(y);`), f('packages/x/b.ts', `supabase.from('w').insert(x);`), f('scripts/s.mjs', `supabase.from('w').insert(x);`)], 'w'));

  // -- declaration --
  const dec = { w: { reason: 'probe', paths: ['a.ts', 'b.ts'] } };
  check('P6 two DECLARED paths → GOAL PASS', 'PASS',
    goalOf([f('a.ts', `supabase.from('w').insert(x);`), f('b.ts', `supabase.from('w').update(y);`)], 'w', { allowed: dec }));
  check('P7 a NEW path beside a declaration → GOAL FAIL', 'FAIL',
    goalOf([f('a.ts', `supabase.from('w').insert(x);`), f('b.ts', `supabase.from('w').update(y);`), f('c.ts', `supabase.from('w').delete();`)], 'w', { allowed: dec }));

  // -- RATCHET, both directions --
  const base = { w: ['a.ts', 'b.ts'] };
  check('R1 a NEW path not in baseline → RATCHET NEW', 'NEW',
    ratchOf([f('a.ts', `supabase.from('w').insert(x);`), f('b.ts', `supabase.from('w').update(y);`), f('c.ts', `supabase.from('w').delete();`)], 'w', { baseline: base }));
  check('R2 exactly the baseline paths → RATCHET OK', 'OK',
    ratchOf([f('a.ts', `supabase.from('w').insert(x);`), f('b.ts', `supabase.from('w').update(y);`)], 'w', { baseline: base }));
  check('R3 FEWER than baseline (a fix landed) → RATCHET OK', 'OK',
    ratchOf([f('a.ts', `supabase.from('w').insert(x);`)], 'w', { baseline: base }));
  check('R4 a NEW TABLE born with two paths → RATCHET NEW', 'NEW',
    ratchOf([f('a.ts', `supabase.from('fresh').insert(x);`), f('b.ts', `supabase.from('fresh').update(y);`)], 'fresh', { baseline: base }));
  check('R5 a NEW TABLE with one path → RATCHET OK', 'OK',
    ratchOf([f('a.ts', `supabase.from('fresh').insert(x);`)], 'fresh', { baseline: base }));
  check('R6 a new path that IS declared → RATCHET OK', 'OK',
    ratchOf([f('a.ts', `supabase.from('w').insert(x);`), f('b.ts', `supabase.from('w').update(y);`), f('c.ts', `supabase.from('w').delete();`)],
      'w', { baseline: base, allowed: { w: { reason: 'probe', paths: ['c.ts'] } } }));
  return R;
}

// ── FILE WALK ────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  let entries; try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (EXCLUDE_DIRS.has(e)) continue;
    const full = join(dir, e);
    let st; try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(e) && !EXCLUDE_FILE.test(e)) out.push(full);
  }
  return out;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
const B = '\x1b[1m', D = '\x1b[2m', RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', O = '\x1b[0m';
console.log(`\n${B}WRITE-PATH CAP — more than one write path to a table fails unless declared${O}\n`);

const probes = runProbes();
const bad = probes.filter(p => !p.ok);
console.log(`${B}PROBES (STD-022 — planted, both directions)${O}`);
for (const p of probes) console.log(`  ${p.ok ? GRN + 'ok  ' + O : RED + 'BAD ' + O} ${p.name}${p.ok ? '' : `  ${RED}(expected ${p.expect}, got ${p.got})${O}`}`);
if (bad.length) { console.error(`\n${RED}${B}✗ THE CAP'S OWN PROBES FAILED — refusing to report a scan from a checker that does not work.${O}\n`); process.exit(2); }

const files = SCAN_ROOTS.flatMap(r => walk(join(ROOT, r))).map(f => ({ path: relative(ROOT, f), content: readFileSync(f, 'utf8') }));
const { tables, rpcs, dynamic } = analyze(files);
const baselineDoc = existsSync(BASELINE_FILE) ? JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) : null;
const rows = judge(tables, { baseline: baselineDoc?.tables ?? {} });

if (UPDATE) {
  const out = { _comment: 'Known write paths as of the stamp below. RATCHET baseline — the build fails on any NEW undeclared path, not on these. Shrink it; never grow it casually. Regenerate: npm run write-paths:baseline', stamped: new Date().toISOString().slice(0, 10), tables: {} };
  for (const r of rows) if (r.appPaths.length > 0) out.tables[r.table] = r.appPaths;
  writeFileSync(BASELINE_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`\n${GRN}${B}✓ baseline written${O} — ${Object.keys(out.tables).length} tables, ${Object.values(out.tables).flat().length} paths → write-paths-baseline.json\n`);
  process.exit(0);
}

console.log(`\n${B}SCANNED${O} ${files.length} source files · ${D}corpus: ${SCAN_ROOTS.join(' · ')} — ignition-os excluded (frozen donor)${O}`);
console.log(`${B}BASELINE${O} ${baselineDoc ? `${Object.keys(baselineDoc.tables).length} tables, stamped ${baselineDoc.stamped}` : `${YEL}none — run npm run write-paths:baseline${O}`}\n`);

const goalFails = rows.filter(r => r.goal === 'FAIL');
const ratchetFails = rows.filter(r => r.ratchetFail);

console.log(`${B}APP WRITE PATHS BY TABLE${O}  ${D}(GOAL = one path · RATCHET = no NEW path vs baseline)${O}`);
for (const r of rows) {
  if (!r.appPaths.length) continue;
  const g = r.goal === 'FAIL' ? `${RED}GOAL:FAIL${O}` : `${GRN}GOAL:PASS${O}`;
  const t = r.ratchetFail ? `${RED}${B}RATCHET:NEW${O}` : `${GRN}RATCHET:OK${O}`;
  console.log(`\n  ${g} ${t}  ${B}${r.table}${O} — ${r.appPaths.length} app path${r.appPaths.length === 1 ? '' : 's'}${r.goalNote ? ` ${D}(${r.goalNote})${O}` : ''}`);
  for (const p of r.appPaths) {
    const isNew = r.newPaths.includes(p);
    console.log(`         ${isNew ? RED + '+NEW' + O : D + '   ·' + O} ${p} ${D}[${[...tables.get(r.table).get(p)].sort().join(',')}]${O}`);
  }
  if (r.removed.length) console.log(`         ${GRN}−gone${O} ${D}${r.removed.join(', ')} — run npm run write-paths:baseline to lock the win${O}`);
  if (r.tooling.length) console.log(`         ${D}+ ${r.tooling.length} tooling path(s): ${r.tooling.join(', ')}${O}`);
}

const toolingOnly = rows.filter(r => !r.appPaths.length);
if (toolingOnly.length) {
  console.log(`\n${B}${YEL}TOOLING-ONLY TABLES (reported, NOT asserted)${O}`);
  for (const r of toolingOnly) console.log(`  ${r.table} ${D}← ${r.tooling.join(', ')}${O}`);
}

if (rpcs.size) {
  console.log(`\n${B}${YEL}ADVISORY — RPC CALLERS (NOT ASSERTED — every count above is a FLOOR)${O}`);
  console.log(`${D}This cap reads SOURCE. Which table an RPC writes lives in the database. The rpc→table map${O}`);
  console.log(`${D}is the cap's own next build and is OWED; until it exists these are reported, not judged.${O}`);
  for (const [n, p] of [...rpcs].sort()) console.log(`  ${n} ${D}← ${[...p].sort().join(', ')}${O}`);
}
if (dynamic.length) {
  console.log(`\n${B}${YEL}ADVISORY — DYNAMIC TABLE NAMES (NOT RESOLVED)${O}`);
  for (const u of [...new Set(dynamic.map(d => `${d.expr} ← ${d.path}`))]) console.log(`  ${D}${u}${O}`);
}

console.log(`\n${B}SUMMARY${O}  goal: ${goalFails.length} table(s) with >1 undeclared path ${D}(known debt — 17 failures = 17 DECISIONS owed, not 17 builds)${O}`);
if (ratchetFails.length) {
  console.error(`\n${RED}${B}✗ RATCHET — ${ratchetFails.length} table(s) gained a NEW undeclared write path:${O}`);
  for (const r of ratchetFails) console.error(`   ${RED}${r.table}${O}: ${r.isNewTable ? `new table born with ${r.appPaths.length} paths` : r.newPaths.join(', ')}`);
  console.error(`${D}Reuse the existing path, or declare it in ALLOWED_DIVERGENCE with its reason.${O}\n`);
  process.exit(1);
}
console.log(`${GRN}${B}✓ RATCHET CLEAN — no table gained a write path.${O}\n`);
