#!/usr/bin/env node
// ============================================================
// verify-write-paths — MORE THAN ONE WRITE PATH TO A TABLE FAILS THE BUILD UNLESS DECLARED
// PURPOSE:      Nothing in the build loop ever asked "does this record already have a write path?"
//               Generating a new component is cheaper than finding and reusing the existing one —
//               reuse requires reading and understanding what is there first — so write paths to a
//               table accumulate, each locally sensible, each shipped in a session that could not
//               see the others. `customers` reached SEVEN. This cap asks the question mechanically.
// THE RULE:     One write path per table is correct. More than one FAILS, naming every path. An
//               intentional second path is DECLARED in ALLOWED_DIVERGENCE with its reason —
//               declared, not discovered. Declaring is not a blanket exemption: a NEW path that is
//               not in the declared set still fails, so the list cannot silently absorb drift.
// UNIT:         A PATH IS A FILE, not a call site. `inventoryEdit.ts` writes business_inventory at
//               five call sites and is ONE path — one module, one field list. That is the shape
//               this cap is protecting (§6 r8 rule-of-three / STD-011).
// DEPENDENCIES: none (node stdlib only). Reads repo SOURCE — it cannot see the live catalog, so
//               an RPC's target table is not knowable here (see the ADVISORY section).
// OUTPUTS:      exit 0 = every table has one path or a satisfied declaration. exit 1 = a violation,
//               with every offending table, its path count, and each path listed.
// PROBES:       STD-022 — self-tests run BEFORE the real scan, in BOTH directions (a planted
//               two-path table must FAIL; one path and declared-two must PASS; a new path beside a
//               declaration must FAIL). If a probe misbehaves the cap refuses to report at all: a
//               checker that has never been seen failing is not evidence of anything.
// ============================================================
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();

// ── CORPUS (named, per STD-021) ──────────────────────────────────────────────
const SCAN_ROOTS = [
  'packages/cultivar-os/src',
  'packages/cultivar-os/api',
  'packages/shared/src',
  'packages/trace-app/src',
  'api',
  'scripts',
];
// ignition-os is FROZEN donor code (CLAUDE.md §2) — excluded deliberately, not by oversight.
const EXCLUDE_DIRS  = new Set(['node_modules', 'dist', 'build', '.git', 'fixtures']);
// This file's own planted probes contain literal `.from('widgets').insert(...)` strings; scanning
// itself would report `widgets`/`gears` as real tables. Self-excluded — stated, not silent.
const EXCLUDE_FILE  = /(\.(test|spec)\.[tj]sx?|verify-write-paths\.mjs)$/;
const SOURCE_EXT    = /\.(ts|tsx|js|jsx|mjs)$/;

// ── DECLARED DIVERGENCE — an intentional second path, WITH ITS REASON ────────
// Shape: table -> { reason, paths: [repo-relative file, ...] }
// A table passes when its OBSERVED path set is a subset of its DECLARED set. A path that appears
// and is not declared fails even when the table is listed — the list records decisions already
// made, it does not pre-authorize the next one.
const ALLOWED_DIVERGENCE = {
  // (empty on the first run — every entry here must be a decision David made, not a
  //  convenience the builder granted itself. See the first-run report.)
};

// ── ANALYZER (pure over [{path, content}] so the probes can drive it) ────────
const WRITE_VERBS = ['insert', 'update', 'upsert', 'delete'];

/** Strip comments so a header describing a write is not counted as one. Conservative: block
 *  comments, and lines whose first non-space char begins a line comment or continues a banner.
 *  String literals containing "//" (URLs) are left alone by only cutting FULL comment lines. */
function stripComments(src) {
  const noBlocks = src.replace(/\/\*[\s\S]*?\*\//g, '');
  return noBlocks
    .split('\n')
    .map(l => {
      const t = l.trimStart();
      return t.startsWith('//') || t.startsWith('*') ? '' : l;
    })
    .join('\n');
}

export function analyze(files) {
  const tables  = new Map(); // table -> Map(path -> Set(verb))
  const rpcs    = new Map(); // rpcName -> Set(path)
  const dynamic = [];        // { path, expr } — from(<non-literal>)

  for (const { path, content } of files) {
    const src = stripComments(content);

    // ---- supabase-js: .from('<table>') … .insert/.update/.upsert/.delete( ----
    const fromRe = /\.from\(\s*(['"`])([^'"`]+)\1\s*\)/g;
    let m;
    while ((m = fromRe.exec(src)) !== null) {
      const table = m[2];
      // Window = from the match to the end of THIS statement, so a later statement's write on a
      // different table is never attributed here.
      const rest = src.slice(m.index);
      const semi = rest.indexOf(';');
      const win  = semi === -1 ? rest.slice(0, 400) : rest.slice(0, semi);
      const verbs = WRITE_VERBS.filter(v => win.includes(`.${v}(`));
      if (verbs.length === 0) continue; // a read — not a write path
      if (!tables.has(table)) tables.set(table, new Map());
      const byPath = tables.get(table);
      if (!byPath.has(path)) byPath.set(path, new Set());
      verbs.forEach(v => byPath.get(path).add(v));
    }

    // ---- dynamic table names: .from(SOME_CONST) — cannot be resolved statically ----
    const dynRe = /\.from\(\s*([A-Za-z_$][\w$.]*)\s*\)/g;
    while ((m = dynRe.exec(src)) !== null) dynamic.push({ path, expr: m[1] });

    // ---- RPC calls (advisory — target table not knowable from source) ----
    const rpcRe = /\.rpc\(\s*(['"`])([^'"`]+)\1/g;
    while ((m = rpcRe.exec(src)) !== null) {
      const name = m[2];
      if (!rpcs.has(name)) rpcs.set(name, new Set());
      rpcs.get(name).add(path);
    }
  }

  // ---- verdict per table ----
  // ASSERTED on APP paths only. `scripts/` is one-off TOOLING — seeds, backfills, verifiers — run
  // by hand, never deployed, and legitimately touching many tables at once. Counting them would
  // make every table fail for a reason that is not the defect this cap exists for. They are
  // REPORTED in their own section rather than dropped: a cap that silently narrows its own scope
  // reads as "covered everything" when it did not.
  const isTooling = p => p.startsWith('scripts/');
  const rows = [];
  for (const [table, byPathAll] of tables) {
    const byPath   = new Map([...byPathAll].filter(([p]) => !isTooling(p)));
    const tooling  = [...byPathAll.keys()].filter(isTooling).sort();
    if (byPath.size === 0 && tooling.length === 0) continue;
    const paths    = [...byPath.keys()].sort();
    const declared = ALLOWED_DIVERGENCE[table];
    let status, note = '';
    if (paths.length <= 1) {
      status = 'PASS';
    } else if (!declared) {
      status = 'FAIL';
      note   = 'more than one write path, none declared';
    } else {
      const undeclared = paths.filter(p => !declared.paths.includes(p));
      if (undeclared.length === 0) {
        status = 'PASS';
        note   = `declared: ${declared.reason}`;
      } else {
        status = 'FAIL';
        note   = `declared, but NEW undeclared path(s): ${undeclared.join(', ')}`;
      }
    }
    rows.push({ table, paths, verbs: byPath, status, note, tooling });
  }
  rows.sort((a, b) => b.paths.length - a.paths.length || a.table.localeCompare(b.table));
  return { rows, rpcs, dynamic };
}

// ── PROBES (STD-022 — both directions, before the real scan) ─────────────────
function runProbes() {
  const f = (path, content) => ({ path, content });
  const probes = [
    {
      name: 'P1 two undeclared paths → FAIL',
      files: [f('a.ts', `supabase.from('widgets').insert(x);`), f('b.ts', `supabase.from('widgets').update(y);`)],
      table: 'widgets', expect: 'FAIL',
    },
    {
      name: 'P2 one path, many call sites → PASS',
      files: [f('a.ts', `supabase.from('widgets').insert(x);\nsupabase.from('widgets').update(y);\nsupabase.from('widgets').delete();`)],
      table: 'widgets', expect: 'PASS',
    },
    {
      name: 'P3 reads only → not a write path at all',
      files: [f('a.ts', `supabase.from('widgets').select('id');`), f('b.ts', `supabase.from('widgets').select('*');`)],
      table: 'widgets', expect: 'ABSENT',
    },
    {
      name: 'P4 a comment describing a write is NOT a write',
      files: [f('a.ts', `// supabase.from('widgets').update(z);\nsupabase.from('widgets').insert(x);`), f('b.ts', `/* .from('widgets').delete() */ const q = 1;`)],
      table: 'widgets', expect: 'PASS',
    },
    {
      name: 'P5 a later statement is not attributed to an earlier read',
      files: [f('a.ts', `supabase.from('widgets').select('id');\nsupabase.from('gears').update(y);`)],
      table: 'widgets', expect: 'ABSENT',
    },
    {
      name: 'P8 one APP path + many scripts/ tooling paths → PASS (tooling is not asserted)',
      files: [
        f('packages/x/a.ts', `supabase.from('widgets').update(y);`),
        f('scripts/seed.mjs', `supabase.from('widgets').insert(x);`),
        f('scripts/verify.mjs', `supabase.from('widgets').delete();`),
      ],
      table: 'widgets', expect: 'PASS',
    },
    {
      name: 'P9 TWO app paths still FAIL even when tooling also writes',
      files: [
        f('packages/x/a.ts', `supabase.from('widgets').update(y);`),
        f('packages/x/b.ts', `supabase.from('widgets').insert(x);`),
        f('scripts/seed.mjs', `supabase.from('widgets').insert(x);`),
      ],
      table: 'widgets', expect: 'FAIL',
    },
  ];

  const results = [];
  for (const p of probes) {
    const { rows } = analyze(p.files);
    const row = rows.find(r => r.table === p.table);
    const got = row ? row.status : 'ABSENT';
    results.push({ name: p.name, expect: p.expect, got, ok: got === p.expect });
  }

  // P6/P7 exercise the DECLARATION branch, which needs a temporary declaration.
  const saved = { ...ALLOWED_DIVERGENCE };
  ALLOWED_DIVERGENCE['widgets'] = { reason: 'probe', paths: ['a.ts', 'b.ts'] };
  {
    const { rows } = analyze([
      { path: 'a.ts', content: `supabase.from('widgets').insert(x);` },
      { path: 'b.ts', content: `supabase.from('widgets').update(y);` },
    ]);
    const got = rows.find(r => r.table === 'widgets').status;
    results.push({ name: 'P6 two DECLARED paths → PASS', expect: 'PASS', got, ok: got === 'PASS' });
  }
  {
    const { rows } = analyze([
      { path: 'a.ts', content: `supabase.from('widgets').insert(x);` },
      { path: 'b.ts', content: `supabase.from('widgets').update(y);` },
      { path: 'c.ts', content: `supabase.from('widgets').delete();` },
    ]);
    const got = rows.find(r => r.table === 'widgets').status;
    results.push({ name: 'P7 a NEW path beside a declaration → FAIL', expect: 'FAIL', got, ok: got === 'FAIL' });
  }
  Object.keys(ALLOWED_DIVERGENCE).forEach(k => delete ALLOWED_DIVERGENCE[k]);
  Object.assign(ALLOWED_DIVERGENCE, saved);

  return results;
}

// ── FILE WALK ────────────────────────────────────────────────────────────────
function walk(dir, out = []) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const e of entries) {
    if (EXCLUDE_DIRS.has(e)) continue;
    const full = join(dir, e);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) walk(full, out);
    else if (SOURCE_EXT.test(e) && !EXCLUDE_FILE.test(e)) out.push(full);
  }
  return out;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
const BOLD = '\x1b[1m', DIM = '\x1b[2m', RED = '\x1b[31m', GREEN = '\x1b[32m', YEL = '\x1b[33m', OFF = '\x1b[0m';

console.log(`\n${BOLD}WRITE-PATH CAP — more than one write path to a table fails unless declared${OFF}\n`);

// 1. Probes first. A cap that has not been seen failing is not evidence.
const probeResults = runProbes();
const probeBad = probeResults.filter(p => !p.ok);
console.log(`${BOLD}PROBES (STD-022 — planted, both directions)${OFF}`);
for (const p of probeResults) {
  console.log(`  ${p.ok ? GREEN + 'ok  ' + OFF : RED + 'BAD ' + OFF} ${p.name}${p.ok ? '' : `  ${RED}(expected ${p.expect}, got ${p.got})${OFF}`}`);
}
if (probeBad.length > 0) {
  console.error(`\n${RED}${BOLD}✗ THE CAP'S OWN PROBES FAILED — refusing to report a scan from a checker that does not work.${OFF}\n`);
  process.exit(2);
}

// 2. The real scan.
const files = SCAN_ROOTS.flatMap(r => walk(join(ROOT, r)))
  .map(f => ({ path: relative(ROOT, f), content: readFileSync(f, 'utf8') }));

const { rows, rpcs, dynamic } = analyze(files);

console.log(`\n${BOLD}SCANNED${OFF} ${files.length} source files across ${SCAN_ROOTS.length} roots`);
console.log(`${DIM}corpus: ${SCAN_ROOTS.join(' · ')} — ignition-os excluded (frozen donor), *.test.* excluded${OFF}\n`);

console.log(`${BOLD}APP WRITE PATHS BY TABLE${OFF}  ${DIM}(asserted — scripts/ tooling is reported separately below)${OFF}`);
const fails = rows.filter(r => r.status === 'FAIL');
for (const r of rows) {
  if (r.paths.length === 0) continue; // tooling-only table — listed in the tooling section
  const tag = r.status === 'FAIL' ? `${RED}FAIL${OFF}` : `${GREEN}PASS${OFF}`;
  console.log(`\n  ${tag}  ${BOLD}${r.table}${OFF} — ${r.paths.length} app path${r.paths.length === 1 ? '' : 's'}${r.note ? ` ${DIM}(${r.note})${OFF}` : ''}`);
  for (const p of r.paths) {
    console.log(`         ${DIM}·${OFF} ${p} ${DIM}[${[...r.verbs.get(p)].sort().join(',')}]${OFF}`);
  }
  if (r.tooling.length > 0) console.log(`         ${DIM}+ ${r.tooling.length} tooling path(s): ${r.tooling.join(', ')}${OFF}`);
}

const toolingOnly = rows.filter(r => r.paths.length === 0);
if (toolingOnly.length > 0) {
  console.log(`\n${BOLD}${YEL}TOOLING-ONLY TABLES (reported, NOT asserted)${OFF}`);
  console.log(`${DIM}Written only by scripts/ — seeds, backfills, verifiers. No app path exists.${OFF}`);
  for (const r of toolingOnly) console.log(`  ${r.table} ${DIM}← ${r.tooling.join(', ')}${OFF}`);
}

if (rpcs.size > 0) {
  console.log(`\n${BOLD}${YEL}ADVISORY — RPC CALLERS (NOT ASSERTED)${OFF}`);
  console.log(`${DIM}This cap reads SOURCE. Which table an RPC writes lives in the database, so it cannot be`);
  console.log(`resolved here. These are REPORTED, not judged — an rpc→table map is owed before they can be.${OFF}`);
  for (const [name, paths] of [...rpcs].sort()) {
    console.log(`  ${name} ${DIM}← ${[...paths].sort().join(', ')}${OFF}`);
  }
}

if (dynamic.length > 0) {
  const uniq = [...new Set(dynamic.map(d => `${d.expr} ← ${d.path}`))];
  console.log(`\n${BOLD}${YEL}ADVISORY — DYNAMIC TABLE NAMES (NOT RESOLVED)${OFF}`);
  for (const u of uniq) console.log(`  ${DIM}${u}${OFF}`);
}

console.log('');
if (fails.length > 0) {
  console.error(`${RED}${BOLD}✗ ${fails.length} table(s) with more than one undeclared write path: ${fails.map(f => f.table).join(', ')}${OFF}`);
  console.error(`${DIM}Fix = collapse to one module, or declare the divergence WITH ITS REASON in ALLOWED_DIVERGENCE.${OFF}\n`);
  process.exit(1);
}
console.log(`${GREEN}${BOLD}✓ every table has exactly one write path, or a satisfied declaration.${OFF}\n`);
