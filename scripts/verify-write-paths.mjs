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
// Every entry is a decision David made, not a convenience the builder granted itself. The other
// known multi-path tables are held by the BASELINE, not by declarations — the baseline says
// "known today", a declaration says "correct forever". They are different claims.
const ALLOWED_DIVERGENCE = {
  // APPROVED 2026-07-29 (David) after inspection: no column overlap, and the state upsert was
  // proven non-clobbering (PostgREST builds ON CONFLICT DO UPDATE SET from the supplied columns
  // only, so minting a state on a row holding live tokens leaves the tokens untouched).
  'business_accounting_secrets': {
    reason: 'Two disjoint concerns on one table: secrets.ts owns the QB credential columns, '
          + 'qbo/router.ts owns the OAuth handshake state (mint + single-use claim). '
          + 'No column overlap; the state upsert does not touch tokens.',
    paths: ['packages/cultivar-os/api/qbo/router.ts',
            'packages/shared/src/quickbooks/secrets.ts'],
  },
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

// ── RPC → TABLE MAP (tech-debt #76) ──────────────────────────────────────────
// An RPC's target table lives in the DATABASE, which a source-reading cap cannot see. It CAN see
// the migrations that created the function, and those are in version control. So: parse
// CREATE FUNCTION bodies, extract what each one writes, and fold every `.rpc('name')` caller into
// that table's path count. Later migrations win — a function can be replaced.
//
// THREE GAPS, PRINTED ON EVERY RUN RATHER THAN ABSORBED:
//  (1) a function created OUTSIDE the migration path is invisible here (CLAUDE.md §6 r17's class);
//  (2) dynamic SQL (EXECUTE ...) inside a body cannot be resolved statically;
//  (3) a function that writes by CALLING another function is not followed (transitive writes).
function stripSql(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').map(l => l.replace(/--.*$/, '')).join('\n');
}

export function buildRpcTableMap(migrations) {
  const map = new Map();      // fn -> { writes:Set<table>, dynamic:boolean, source:string }
  for (const { path, content } of migrations) {  // caller passes these in filename order
    const src = stripSql(content);
    const fnRe = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:public\.)?"?([a-zA-Z_][\w]*)"?\s*\(/gi;
    let m;
    while ((m = fnRe.exec(src)) !== null) {
      const fn = m[1];
      // Body is dollar-quoted: find the opening tag after the signature, then its match.
      const after = src.slice(m.index);
      const tagM = after.match(/\$([a-zA-Z_]*)\$/);
      if (!tagM) continue;
      const tag = tagM[0];
      const bodyStart = after.indexOf(tag) + tag.length;
      const bodyEnd = after.indexOf(tag, bodyStart);
      if (bodyEnd === -1) continue;
      // Strip single-quoted SQL literals ('' escapes an inner quote) BEFORE scanning. Without this,
      // `'settings:update permission required'::text` yielded a table called `permission`.
      // NOTE: deliberately NOT filtered against a CREATE TABLE allowlist — `customers`/`orders`/
      // `order_items` have no migrations at all (tech-debt #39), so an allowlist would drop real
      // tables and trade a visible false positive for an invisible false negative.
      const body = after.slice(bodyStart, bodyEnd).replace(/'(?:[^']|'')*'/g, "''");

      const writes = new Set();
      for (const re of [
        /\bINSERT\s+INTO\s+(?:public\.)?"?([a-zA-Z_][\w]*)"?/gi,
        // NOT `…"?(\w+)"?\s+SET` — a table ALIAS sits between them (`UPDATE public.business_inventory bi
        // SET …`), and requiring SET made `adjust_inventory_qty` read as READ-ONLY: a false negative
        // that renders a written table CLEAN, which is the exact defect class this cap exists for.
        // `(?<!\bFOR\s)` excludes `SELECT … FOR UPDATE`, which is a lock, not a write.
        /(?<!\bFOR\s)\bUPDATE\s+(?:ONLY\s+)?(?:public\.)?"?([a-zA-Z_][\w]*)"?/gi,
        /\bDELETE\s+FROM\s+(?:public\.)?"?([a-zA-Z_][\w]*)"?/gi,
      ]) { let w; while ((w = re.exec(body)) !== null) writes.add(w[1]); }

      map.set(fn, { writes, dynamic: /\bEXECUTE\b/i.test(body), source: path, body }); // later wins
    }
  }
  // SECOND PASS — gap (3) made CONCRETE. A function that writes by CALLING another function is not
  // followed, but we can at least NAME the chain instead of describing the gap in the abstract:
  // for each function, record which OTHER mapped functions its body invokes. Only mapped names are
  // considered, so built-ins (coalesce/now/jsonb_build_object) never appear.
  for (const [, def] of map) {
    def.calls = new Set();
    for (const other of map.keys()) {
      if (other === def.name) continue;
      if (new RegExp(`\\b${other}\\s*\\(`, 'i').test(def.body)) def.calls.add(other);
    }
  }
  for (const [fn, def] of map) def.name = fn;
  return map;
}

/** Provenance of a table's discovery: was it visible in SOURCE at all, or ONLY through an RPC? */
export function provenanceOf(byPath) {
  let src = false, rpc = false;
  for (const verbs of byPath.values()) {
    for (const v of verbs) (String(v).startsWith('rpc:') ? (rpc = true) : (src = true));
  }
  return src && rpc ? 'both' : rpc ? 'rpc-only' : 'source';
}

/** Fold RPC callers into the observed table→path map. Returns the RPC provenance for reporting. */
export function foldRpcWriters(tables, rpcs, rpcMap) {
  const folded = [];   // { fn, table, callers[] }
  const unknown = [];  // rpc names with no definition in migrations
  const dynamic = [];  // rpc names whose body uses EXECUTE
  for (const [fn, callers] of rpcs) {
    const def = rpcMap.get(fn);
    if (!def) { unknown.push({ fn, callers: [...callers] }); continue; }
    if (def.dynamic) dynamic.push({ fn, callers: [...callers] });
    if (def.writes.size === 0) continue; // a read-only function: its caller is not a write path
    for (const table of def.writes) {
      if (!tables.has(table)) tables.set(table, new Map());
      const byPath = tables.get(table);
      for (const c of callers) {
        if (!byPath.has(c)) byPath.set(c, new Set());
        byPath.get(c).add(`rpc:${fn}`);
      }
      folded.push({ fn, table, callers: [...callers] });
    }
  }
  return { folded, unknown, dynamic };
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

  // -- RPC → TABLE MAP (tech-debt #76), both directions --
  const mig = (path, content) => ({ path, content });
  const MIGS = [
    mig('001.sql', `CREATE OR REPLACE FUNCTION public.writes_w() RETURNS void AS $$ BEGIN UPDATE w SET a=1 WHERE id=2; END; $$ LANGUAGE plpgsql;`),
    mig('002.sql', `CREATE FUNCTION reads_only() RETURNS int AS $$ SELECT count(*) FROM w; $$ LANGUAGE sql;`),
    mig('003.sql', `CREATE FUNCTION dyn_writer() RETURNS void AS $$ BEGIN EXECUTE 'INSERT INTO ' || t; END; $$ LANGUAGE plpgsql;`),
    mig('004.sql', `CREATE FUNCTION multi() RETURNS void AS $$ BEGIN INSERT INTO w(a) VALUES(1); DELETE FROM g WHERE id=1; END; $$ LANGUAGE plpgsql;`),
    // The live shape that produced a FALSE NEGATIVE on 2026-07-29: a table ALIAS between the table
    // name and SET, with SET on the next line. Requiring `\s+SET` made adjust_inventory_qty read as
    // read-only and left business_inventory looking clean.
    mig('005.sql', `CREATE FUNCTION aliased() RETURNS void AS $$ BEGIN\n  UPDATE public.w bi\n     SET qty = bi.qty + 1\n   WHERE bi.id = 1;\nEND; $$ LANGUAGE plpgsql;`),
    mig('006.sql', `CREATE FUNCTION locks_only() RETURNS int AS $$ BEGIN\n  SELECT id FROM w WHERE id=1 FOR UPDATE;\n  RETURN 1;\nEND; $$ LANGUAGE plpgsql;`),
    // A STRING LITERAL mentioning an update is not a write — the second false positive of 2026-07-29
    // ('settings:update permission required' yielded a phantom table called `permission`).
    mig('007.sql', `CREATE FUNCTION only_talks() RETURNS void AS $$ BEGIN\n  RAISE NOTICE 'settings:update permission required';\nEND; $$ LANGUAGE plpgsql;`),
  ];
  const RPCMAP = buildRpcTableMap(MIGS);
  check('M1 CREATE FUNCTION body parsed — UPDATE target found', 'true', String(RPCMAP.get('writes_w')?.writes.has('w')));
  check('M2 a SELECT-only function writes nothing', '0', String(RPCMAP.get('reads_only')?.writes.size));
  check('M3 EXECUTE in a body is flagged dynamic', 'true', String(RPCMAP.get('dyn_writer')?.dynamic));
  check('M4 a body with INSERT + DELETE yields BOTH tables', 'g,w',
    [...(RPCMAP.get('multi')?.writes ?? [])].sort().join(','));
  check('M4b 🔴 an UPDATE with a table ALIAS is still a write (the 2026-07-29 false negative)', 'true',
    String(RPCMAP.get('aliased')?.writes.has('w')));
  check('M4c SELECT … FOR UPDATE is a LOCK, not a write', '0',
    String(RPCMAP.get('locks_only')?.writes.size));
  check('M4d 🔴 an UPDATE inside a STRING LITERAL is not a write (the phantom `permission` table)', '0',
    String(RPCMAP.get('only_talks')?.writes.size));
  {
    // An rpc CALLER becomes a write path to the function's target table.
    const { tables: T, rpcs: RP } = analyze([f('packages/x/caller.ts', `await supabase.rpc('writes_w', {});`)]);
    foldRpcWriters(T, RP, RPCMAP);
    check('M5 an RPC caller becomes a write path to the target table', 'PASS',
      judge(T, {}).find(r => r.table === 'w')?.goal ?? 'ABSENT');
    check('M5b …and the path is the CALLING FILE', 'packages/x/caller.ts',
      judge(T, {}).find(r => r.table === 'w')?.appPaths.join(',') ?? 'ABSENT');
  }
  {
    // The case that matters: a table reading CLEAN at 1 source path, failing once RPCs count.
    const { tables: T, rpcs: RP } = analyze([
      f('packages/x/helper.ts', `supabase.from('w').update(y);`),
      f('packages/x/other.ts', `await supabase.rpc('writes_w', {});`),
    ]);
    check('M6 BEFORE the fold: looks like a clean single path', 'PASS', judge(T, {}).find(r => r.table === 'w').goal);
    foldRpcWriters(T, RP, RPCMAP);
    check('M6b AFTER the fold: the hidden RPC writer FAILS it', 'FAIL', judge(T, {}).find(r => r.table === 'w').goal);
  }
  {
    const { tables: T, rpcs: RP } = analyze([f('packages/x/c.ts', `await supabase.rpc('reads_only', {});`)]);
    foldRpcWriters(T, RP, RPCMAP);
    check('M7 a READ-only RPC does not make its caller a write path', 'ABSENT',
      judge(T, {}).find(r => r.table === 'w')?.goal ?? 'ABSENT');
  }
  {
    const { tables: T, rpcs: RP } = analyze([f('packages/x/c.ts', `await supabase.rpc('not_in_migrations', {});`)]);
    const { unknown } = foldRpcWriters(T, RP, RPCMAP);
    check('M8 an RPC with no migration definition is REPORTED, not silently dropped', 'not_in_migrations',
      unknown.map(u => u.fn).join(','));
  }
  // -- PROVENANCE: is a table visible in SOURCE at all, or ONLY through an RPC? (the audit_log case) --
  {
    const { tables: T, rpcs: RP } = analyze([f('packages/x/c.ts', `await supabase.rpc('writes_w', {});`)]);
    foldRpcWriters(T, RP, RPCMAP);
    check('PR1 a table written ONLY via RPC is flagged rpc-only', 'rpc-only', provenanceOf(T.get('w')));
  }
  {
    const { tables: T, rpcs: RP } = analyze([
      f('packages/x/h.ts', `supabase.from('w').update(y);`),
      f('packages/x/c.ts', `await supabase.rpc('writes_w', {});`),
    ]);
    foldRpcWriters(T, RP, RPCMAP);
    check('PR2 a table written in source AND via RPC is flagged both', 'both', provenanceOf(T.get('w')));
  }
  {
    const { tables: T } = analyze([f('packages/x/h.ts', `supabase.from('w').update(y);`)]);
    check('PR3 a table written only in source is flagged source', 'source', provenanceOf(T.get('w')));
  }
  // -- GAP 3 instantiated: the call graph names the chain rather than describing it --
  {
    const M = buildRpcTableMap([
      mig('010.sql', `CREATE FUNCTION inner_w() RETURNS void AS $$ BEGIN INSERT INTO hidden_t(a) VALUES(1); END; $$ LANGUAGE plpgsql;`),
      mig('011.sql', `CREATE FUNCTION outer_w() RETURNS void AS $$ BEGIN PERFORM inner_w(); END; $$ LANGUAGE plpgsql;`),
    ]);
    check('G3 a function calling another mapped writer records the CHAIN', 'inner_w',
      [...(M.get('outer_w')?.calls ?? [])].join(','));
    check('G3b …and the hidden table is nameable from it', 'hidden_t',
      [...(M.get('inner_w')?.writes ?? [])].join(','));
    check('G3c …while the outer function alone shows NO writes (why the gap is real)', '0',
      String(M.get('outer_w')?.writes.size));
  }
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

// tech-debt #76 — resolve RPC callers to the tables their functions write, from the migrations.
const MIG_DIR = join(ROOT, 'supabase/migrations');
const migrations = (existsSync(MIG_DIR) ? readdirSync(MIG_DIR).filter(f => f.endsWith('.sql')).sort() : [])
  .map(f => ({ path: `supabase/migrations/${f}`, content: readFileSync(join(MIG_DIR, f), 'utf8') }));
const rpcMap = buildRpcTableMap(migrations);
const rpcFold = foldRpcWriters(tables, rpcs, rpcMap);
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

if (rpcMap.size) {
  console.log(`\n${B}RPC → TABLE MAP${O}  ${D}(${rpcMap.size} functions parsed from ${migrations.length} migrations — tech-debt #76)${O}`);
  if (rpcFold.folded.length) {
    console.log(`  ${B}RESOLVED — these callers ARE write paths and are counted above:${O}`);
    for (const { fn, table, callers } of rpcFold.folded) console.log(`    ${fn} → ${B}${table}${O} ${D}← ${callers.join(', ')}${O}`);
  }
  const readOnly = [...rpcs.keys()].filter(n => rpcMap.get(n) && rpcMap.get(n).writes.size === 0);
  if (readOnly.length) console.log(`  ${D}read-only (caller is NOT a write path): ${readOnly.sort().join(', ')}${O}`);
}
// ── WHICH GAP MIGHT BE HIDING A TABLE — instantiated, never abstract ─────────
// `audit_log` went 0 → 3 the moment RPCs were resolved: a table NOTHING in source revealed. So the
// gaps are only useful if they name the specific thing that could still be hiding one.
const rpcOnly = rows.filter(r => r.appPaths.length && provenanceOf(tables.get(r.table)) === 'rpc-only');
if (rpcOnly.length) {
  console.log(`\n${B}${YEL}🔴 RPC-ONLY TABLES — no source file reveals these exist${O}`);
  console.log(`${D}Found ONLY by resolving an RPC. Source-only analysis was blind to the table itself, so${O}`);
  console.log(`${D}anything else touching it is invisible too. This is the audit_log case (0 → 3).${O}`);
  for (const r of rpcOnly) console.log(`  ${B}${r.table}${O} ${D}— ${r.appPaths.length} path(s), all via RPC${O}`);
}

console.log(`\n${B}${YEL}KNOWN GAPS — named where they bite, not described in the abstract${O}`);
// gap 1
if (rpcFold.unknown.length) {
  console.log(`  ${YEL}(1) COULD BE HIDING A TABLE${O} — called in source, no definition in migrations:`);
  for (const { fn, callers } of rpcFold.unknown) console.log(`      ${B}${fn}${O} ${D}← ${callers.join(', ')}${O}`);
} else {
  console.log(`  ${D}(1) a function created outside the migration path would be invisible — none called in source today${O}`);
}
// gap 2
if (rpcFold.dynamic.length) {
  console.log(`  ${YEL}(2) COULD BE HIDING A TABLE${O} — body uses EXECUTE, targets unresolvable:`);
  for (const { fn, callers } of rpcFold.dynamic) console.log(`      ${B}${fn}${O} ${D}← ${callers.join(', ')}${O}`);
} else {
  console.log(`  ${D}(2) dynamic SQL (EXECUTE) is unresolvable — no called function uses it today${O}`);
}
// gap 3 — instantiated from the call graph
const transitive = [];
for (const [fn, callers] of rpcs) {
  const def = rpcMap.get(fn);
  if (!def) continue;
  for (const callee of def.calls ?? []) {
    const cd = rpcMap.get(callee);
    if (!cd) continue;
    const unattributed = [...cd.writes].filter(t => !def.writes.has(t));
    if (unattributed.length) transitive.push({ fn, callee, tables: unattributed, callers: [...callers] });
  }
}
if (transitive.length) {
  console.log(`  ${YEL}(3) COULD BE HIDING A TABLE${O} — a called function writes via ANOTHER function (not followed):`);
  for (const t of transitive) console.log(`      ${B}${t.fn}${O} → calls ${B}${t.callee}${O} which writes ${YEL}${t.tables.join(', ')}${O} ${D}← ${t.callers.join(', ')}${O}`);
} else {
  console.log(`  ${D}(3) transitive writes are not followed — no called function invokes another mapped writer today${O}`);
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
