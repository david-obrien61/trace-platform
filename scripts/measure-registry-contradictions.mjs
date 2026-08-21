#!/usr/bin/env node
/**
 * measure-registry-contradictions.mjs — COUNT THE CLASS. FIX NOTHING.
 *
 * PURPOSE:      Measure ONE uncovered class: A REGISTRY ROW CAN BE INTERNALLY VALID AND STILL BE
 *               FALSE ABOUT THE WORLD. `verify-tile-fields` asserts each row is COMPLETE and VALID
 *               against its own schema, and that catalog↔tile pairs exist in both directions. It has
 *               NO assertion comparing one row against ANOTHER ROW DESCRIBING THE SAME THING, and
 *               none comparing a declared `section` against an actual `route`. Two instances were
 *               found by looking at phone screenshots. Two found by accident is an UNMEASURED class,
 *               not a small one (David's ruling, ledger #174) — the fix for two is two edits, the fix
 *               for thirty is a derivation, and nobody has the number. This gets the number.
 * DEPENDENCIES: packages/cultivar-os/src/registry/tileRegistry.ts (read + EVALUATED, see below);
 *               node_modules/.bin/esbuild (already a repo dependency — `verify:write-wall` uses the
 *               same bundle-and-run shape).
 * OUTPUTS:      Q1 contradicting capability pairs · Q2 section/route disagreements · Q3 modules
 *               paired to a tile nobody draws. Human-readable to stdout; `--json` for the report.
 *               Exit 0 ALWAYS when the probes pass — a count is not a verdict.
 *
 * ⚠️ THIS IS A ONE-OFF MEASUREMENT, NOT A CAP. It is deliberately NOT chained into `npm run verify`.
 * Minting a cap before David rules would answer the ruling with a constant, which is the thing this
 * measurement exists to avoid. If a cap is ever wanted here, it is a separate build with its own
 * red-first probes and its own baseline.
 *
 * ── WHY EVALUATE, NOT TEXT-PARSE (the method decision, stated because it is the load-bearing one) ──
 * `verify-tile-fields` parses the registry as TEXT because it must run in plain node and the registry
 * imports lucide-react. Its walker is proven and its own header records what parsing this file wrong
 * costs: on 2026-08-01 a parser anchored on `indexOf('[')` matched THE EMPTY PAIR IN THE TYPE
 * ANNOTATION (`TileEntry[] = [`), read ZERO rows, and returned green over a registry it had never
 * opened — caught only because nine probes went 0-for-9.
 *
 * That parser is NOT exported (only `scan` is) and the module has no `import.meta.main` guard, so
 * importing it would execute its probes, its scan and its `process.exit`. Reusing it therefore means
 * EDITING A LIVE CAP mid-measurement, which is out of scope. The alternative — copying the walker —
 * is a FORK of the one piece of code whose failure mode is documented above (§6 r8, rule of three).
 *
 * So this takes the third road: esbuild-bundle the registry with lucide-react ALIASED TO A STUB, then
 * import it and read the REAL objects. This is not a second parser — there is no parser. It calls the
 * REAL `dashboardTiles()` and the REAL `navRoute()`, so RENDERABLE and route-resolution are not
 * re-implemented and cannot drift from the code they describe. Comments are removed by the compiler,
 * so a commented-out row is unreachable BY CONSTRUCTION rather than by a strip step that must be
 * remembered (probe P8 proves it anyway — a construction nobody tested is a claim).
 *
 * The cost is honest and stated: evaluation cannot see a row the TYPE SYSTEM would reject, because
 * types are erased. That is `verify-tile-fields`' job and it already does it. The two methods are
 * complementary, and P1 below cross-checks this one against an INDEPENDENT text count so a silent
 * zero-row read — the exact 2026-08-01 defect — fails loudly instead of measuring nothing.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REGISTRY = 'packages/cultivar-os/src/registry/tileRegistry.ts';
const ESBUILD = join(ROOT, 'node_modules/.bin/esbuild');

const RED = '\x1b[31m', GRN = '\x1b[32m', YEL = '\x1b[33m', CYA = '\x1b[36m', DIM = '\x1b[2m', BLD = '\x1b[1m', O = '\x1b[0m';

// ════════════════════════════════════════════════════════════════════════════════════════════════
// LOAD — bundle the registry and read the real objects out of it.
// ════════════════════════════════════════════════════════════════════════════════════════════════

/**
 * The lucide stub. The registry's icons are React components used ONLY as values; nothing here
 * renders. A Proxy answers every named import with the same inert component, so adding an icon to
 * the registry needs no edit here (the same derive-don't-declare rule the registry caps follow).
 */
const LUCIDE_STUB =
  "module.exports = new Proxy({}, { get: (_t, p) => (p === '__esModule' ? false : function Icon() { return null; }) });\n";

let SCRATCH = null;
function scratchDir() {
  if (!SCRATCH) {
    SCRATCH = join(tmpdir(), `trace-regmeasure-${process.pid}`);
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, 'lucide-stub.cjs'), LUCIDE_STUB);
  }
  return SCRATCH;
}
function cleanup() {
  if (SCRATCH) { try { rmSync(SCRATCH, { recursive: true, force: true }); } catch { /* best effort */ } SCRATCH = null; }
}

/** Bundle `srcPath` and import it. Returns the live module namespace. */
async function loadRegistry(srcPath, tag = 'reg') {
  const dir = scratchDir();
  // A UNIQUE outfile per load: node caches ES modules by URL, so reusing one path would silently
  // return the FIRST version on every subsequent load — which would make every planted-bad probe
  // pass by measuring the unplanted file. (The failure would look exactly like a working probe.)
  const out = join(dir, `${tag}-${loadRegistry.n = (loadRegistry.n ?? 0) + 1}.mjs`);
  execFileSync(ESBUILD, [
    srcPath, '--bundle', '--platform=node', '--format=esm',
    `--alias:lucide-react=${join(dir, 'lucide-stub.cjs')}`,
    `--outfile=${out}`,
  ], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'] });
  return import(`file://${out}`);
}

// ── the independent row count (P1's other half) ─────────────────────────────────────────────────
// A SECOND METHOD, deliberately not sharing a line of code with the loader: strip comments, take the
// TILE_REGISTRY array body, count `{ key:` openers. If the two methods disagree, one of them is
// wrong and the measurement is void — which is the check the 2026-08-01 parser did not have.
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
}

function independentRowCount(src) {
  const clean = stripComments(src);
  const start = clean.indexOf('export const TILE_REGISTRY');
  if (start < 0) return null;
  // Anchor on `=`, NOT on the first `[` — `TileEntry[] = [` puts an empty pair in the way. This is
  // the 2026-08-01 defect verbatim, and it is written out because the independent check is worthless
  // if it reproduces the bug it is checking for.
  const eq = clean.indexOf('=', start);
  const open = clean.indexOf('[', eq);
  let depth = 0, end = open;
  for (let p = open; p < clean.length; p++) {
    if (clean[p] === '[') depth++;
    else if (clean[p] === ']') { depth--; if (depth === 0) { end = p; break; } }
  }
  return [...clean.slice(open + 1, end).matchAll(/\{\s*key\s*:/g)].length;
}

/** The declared union members, read from the source unions — reported, never used as a filter. */
function unionsFromSource(src) {
  const clean = stripComments(src);
  const out = {};
  for (const [field, type] of Object.entries({ kind: 'TileKind', placement: 'TilePlacement', status: 'TileStatus', vertical: 'TileVertical', section: 'NavSection' })) {
    const m = clean.match(new RegExp(`export type ${type}\\s*=([^;]+);`));
    if (m) out[field] = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// THE QUERIES — every input derived from the loaded module. Nothing about the registry is typed here.
// ════════════════════════════════════════════════════════════════════════════════════════════════

const ABSENT = '—';
const show = (v) => (v === undefined || v === null || v === '' ? ABSENT : String(v));

/**
 * RENDERABLE, derived and not assumed: `dashboardTiles()` is the ONLY renderer that exists.
 * `dashboardReadouts()` and `tilesForPlacement()` have ZERO CALLERS (ledger #185 assertion 3);
 * `dashboardTilesForVerticals` is a vertical FILTER over `dashboardTiles()`, not a second renderer.
 * The zero-caller claim is re-verified independently by the caller of this script — it is not
 * inherited from the ledger.
 */
function renderableKeys(mod) {
  return new Set(mod.dashboardTiles().map((t) => t.key));
}

/** QUERY 1 — every pair of tiles sharing a `required_permission` whose `status` values DIFFER. */
function q1ContradictingPairs(mod) {
  const drawn = renderableKeys(mod);
  const byPerm = new Map();
  for (const t of mod.TILE_REGISTRY) {
    if (!byPerm.has(t.required_permission)) byPerm.set(t.required_permission, []);
    byPerm.get(t.required_permission).push(t);
  }
  const desc = (t) => ({
    key: t.key, status: t.status, placement: t.placement,
    route: show(t.route), module_key: show(t.module_key), renderable: drawn.has(t.key),
  });
  const pairs = [];
  for (const [perm, tiles] of byPerm) {
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        if (tiles[i].status !== tiles[j].status) pairs.push({ permission: perm, a: desc(tiles[i]), b: desc(tiles[j]) });
      }
    }
  }
  return pairs.sort((x, y) => x.permission.localeCompare(y.permission) || x.a.key.localeCompare(y.a.key));
}

/**
 * QUERY 2 — for every NAV_IA node carrying both a `section` and a resolved `route`: does the route's
 * FIRST PATH SEGMENT match the first path segment of its own section root's route?
 *
 * Route resolution goes through the REAL `navRoute()`, so a node carrying `tileKey` instead of
 * `route` resolves exactly as the nav and breadcrumb do (inline route wins; else the tile's route;
 * else null). `null` = a non-linking heading and is EXCLUDED — it makes no URL claim to contradict.
 * A section root compared against itself trivially matches and is kept in the denominator, so the
 * ratio is over the whole IA rather than a subset chosen after seeing the answer.
 */
function q2SectionRouteDisagreement(mod) {
  const seg1 = (r) => (r || '').split('/').filter(Boolean)[0] ?? '';
  const rootBySection = new Map();
  for (const n of mod.navSections()) rootBySection.set(n.section, { key: n.key, route: mod.navRoute(n) });

  const rows = [];
  for (const n of mod.NAV_IA) {
    const route = mod.navRoute(n);
    if (route === null || route === undefined) continue;              // non-linking heading
    const root = rootBySection.get(n.section);
    const resolvedVia = n.route !== undefined ? 'inline route' : n.tileKey ? `tile '${n.tileKey}'` : 'none';
    rows.push({
      key: n.key, section: n.section, isRoot: n.parent === null,
      sectionRootKey: root?.key ?? ABSENT, sectionRootRoute: show(root?.route), route, resolvedVia,
      match: !!root && seg1(route) === seg1(root.route),
    });
  }
  return { evaluated: rows, mismatches: rows.filter((r) => !r.match) };
}

/**
 * QUERY 3 — a `module_key` paired to a tile NO renderer draws, where some OTHER tile sharing that
 * tile's `required_permission` either IS drawn or has a route. That sibling is the reason the
 * capability looks reachable while the module's own tile cannot report its state.
 */
function q3ModuleOnUndrawnTile(mod) {
  const drawn = renderableKeys(mod);
  const out = [];
  for (const t of mod.TILE_REGISTRY) {
    if (!t.module_key || drawn.has(t.key)) continue;
    const siblings = mod.TILE_REGISTRY.filter(
      (o) => o.key !== t.key && o.required_permission === t.required_permission && (drawn.has(o.key) || o.route),
    );
    if (!siblings.length) continue;
    out.push({
      module_key: t.module_key,
      undrawn: { key: t.key, status: t.status, placement: t.placement, kind: t.kind, route: show(t.route) },
      siblings: siblings.map((o) => ({ key: o.key, status: o.status, placement: o.placement, route: show(o.route), renderable: drawn.has(o.key) })),
      permission: t.required_permission,
    });
  }
  return out;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// PROBES — the script does not get to report a number until it has proven it can find one.
// ════════════════════════════════════════════════════════════════════════════════════════════════

const FIXTURE_HEAD = `
export type TileKind = 'destination' | 'readout';
export type TilePlacement = 'dashboard' | 'settings' | 'admin' | 'TBD';
export type TileStatus = 'live' | 'planned';
export type TileVertical = 'general' | 'cultivar';
export type NavSection = 'dashboard' | 'admin';
export interface TileEntry { key: string; label: string; group: string; vertical: TileVertical; kind: TileKind; placement: TilePlacement; required_permission: string; status: TileStatus; depends_on: string | null; icon: unknown; color: string; bg: string; route?: string; module_key?: string; note?: string; }
export interface NavNode { key: string; section: NavSection; parent: string | null; tileKey?: string; label?: string; route?: string | null; required_permission?: string; }
`;
const FIXTURE_TAIL = `
export function tileByKey(key: string) { return TILE_REGISTRY.find((t) => t.key === key); }
export function dashboardTiles() { return TILE_REGISTRY.filter((t) => t.placement === 'dashboard' && t.kind !== 'readout'); }
export function navSections() { return NAV_IA.filter((n) => n.parent === null); }
export function navRoute(node: NavNode) { if (node.route !== undefined) return node.route; if (node.tileKey) return tileByKey(node.tileKey)?.route ?? null; return null; }
`;
const fixture = (tiles, nav) =>
  `${FIXTURE_HEAD}export const TILE_REGISTRY: TileEntry[] = [\n${tiles}\n];\nexport const NAV_IA: NavNode[] = [\n${nav}\n];\n${FIXTURE_TAIL}`;

const tile = (o) => `  { key: '${o.key}', label: '${o.key}', group: 'g', vertical: 'general', kind: '${o.kind ?? 'destination'}', placement: '${o.placement ?? 'dashboard'}', required_permission: '${o.perm}', status: '${o.status}', depends_on: null, icon: null, color: '#fff', bg: '#000'${o.route ? `, route: '${o.route}'` : ''}${o.module_key ? `, module_key: '${o.module_key}'` : ''} },`;

async function loadFixture(text, tag) {
  const p = join(scratchDir(), `${tag}.ts`);
  writeFileSync(p, text);
  return loadRegistry(p, tag);
}

async function runProbes(realSrc, realMod) {
  const P = [];
  const ok = (name, pass, detail) => P.push({ name, pass, detail });

  // ── P1 · ROW-COUNT ASSERTION (both numbers printed on every run by main) ──────────────────────
  const evaluated = realMod.TILE_REGISTRY.length;
  const textual = independentRowCount(realSrc);
  ok('P1 row-count · evaluated == independent text count',
    evaluated === textual && evaluated > 0, `evaluated=${evaluated} text=${textual}`);

  // ── P2 · PLANTED-GOOD: the discounts / contractor_tiers pair MUST appear ──────────────────────
  const pairs = q1ContradictingPairs(realMod);
  const known1 = pairs.some((p) => [p.a.key, p.b.key].sort().join('+') === 'contractor_tiers+discounts');
  ok('P2 planted-good · Q1 reports the discounts/contractor_tiers pair', known1,
    known1 ? "found on 'pricing_recipe:update'" : 'NOT FOUND — the script is wrong, not the registry');

  // ── P3 · PLANTED-GOOD: the nav_accounting section/route mismatch MUST appear ──────────────────
  const q2 = q2SectionRouteDisagreement(realMod);
  const known2 = q2.mismatches.some((m) => m.key === 'nav_accounting');
  ok('P3 planted-good · Q2 reports the nav_accounting mismatch', known2,
    known2 ? "section 'admin' (/admin) vs route /settings/accounting" : 'NOT FOUND — the script is wrong');

  // ── P4 · PLANTED-GOOD: Q3 must report at least one instance if one exists ─────────────────────
  const q3 = q3ModuleOnUndrawnTile(realMod);
  const known3 = q3.some((i) => i.module_key === 'contractor_tiers');
  ok('P4 planted-good · Q3 reports contractor_tiers on an undrawn tile', known3,
    known3 ? `${q3.length} instance(s), contractor_tiers among them` : `${q3.length} instance(s), contractor_tiers ABSENT`);

  // ── P5 · PLANTED-BAD (Q1): a synthetic contradicting pair is DETECTED AND NAMED ───────────────
  const m5 = await loadFixture(fixture(
    [tile({ key: 'synth_live', perm: 'synth:perm', status: 'live', route: '/synth' }),
     tile({ key: 'synth_planned', perm: 'synth:perm', status: 'planned', placement: 'settings' })].join('\n'),
    `  { key: 'sec_dashboard', section: 'dashboard', parent: null, label: 'D', route: '/dashboard' },`), 'p5');
  const p5 = q1ContradictingPairs(m5);
  const p5named = p5.length === 1 && [p5[0].a.key, p5[0].b.key].sort().join('+') === 'synth_live+synth_planned';
  ok('P5 planted-bad · a synthetic Q1 pair is detected and NAMED by key', p5named,
    p5named ? 'synth_live × synth_planned' : `got ${p5.length} pair(s)`);

  // ── P6 · PLANTED-BAD (Q2): a synthetic section/route mismatch is DETECTED AND NAMED ───────────
  const m6 = await loadFixture(fixture(
    tile({ key: 'anything', perm: 'p:read', status: 'live', route: '/elsewhere' }),
    [`  { key: 'sec_admin', section: 'admin', parent: null, label: 'A', route: '/admin' },`,
     `  { key: 'nav_wrong', section: 'admin', parent: 'sec_admin', label: 'W', route: '/somewhere-else' },`,
     `  { key: 'nav_right', section: 'admin', parent: 'sec_admin', label: 'R', route: '/admin/ok' },`].join('\n')), 'p6');
  const p6 = q2SectionRouteDisagreement(m6);
  const p6named = p6.mismatches.length === 1 && p6.mismatches[0].key === 'nav_wrong';
  ok('P6 planted-bad · a synthetic Q2 mismatch is detected and NAMED by key', p6named,
    p6named ? 'nav_wrong caught; nav_right and sec_admin correctly clean' : `got [${p6.mismatches.map((m) => m.key).join(',')}]`);

  // ── P7 · NEGATIVE CONTROL: a clean fixture yields ZERO on all three queries ───────────────────
  // Without this, P5/P6 are satisfied by a script that reports everything as a violation.
  const m7 = await loadFixture(fixture(
    [tile({ key: 'a', perm: 'x:read', status: 'live', route: '/a' }),
     tile({ key: 'b', perm: 'y:read', status: 'live', route: '/b', module_key: 'mk_b' })].join('\n'),
    [`  { key: 'sec_dashboard', section: 'dashboard', parent: null, label: 'D', route: '/dashboard' },`,
     `  { key: 'nav_ok', section: 'dashboard', parent: 'sec_dashboard', label: 'K', route: '/dashboard/ok' },`].join('\n')), 'p7');
  const clean = q1ContradictingPairs(m7).length === 0 && q2SectionRouteDisagreement(m7).mismatches.length === 0 && q3ModuleOnUndrawnTile(m7).length === 0;
  ok('P7 negative control · a clean fixture reports 0 / 0 / 0', clean,
    clean ? 'no false positives' : `Q1=${q1ContradictingPairs(m7).length} Q2=${q2SectionRouteDisagreement(m7).mismatches.length} Q3=${q3ModuleOnUndrawnTile(m7).length}`);

  // ── P8 · A COMMENTED-OUT ROW IS NOT COUNTED, by either method ─────────────────────────────────
  const commented = fixture(
    [tile({ key: 'real', perm: 'x:read', status: 'live', route: '/r' }),
     `  // ${tile({ key: 'ghost', perm: 'x:read', status: 'planned' }).trim()}`,
     `  /* ${tile({ key: 'ghost_block', perm: 'x:read', status: 'planned' }).trim()} */`].join('\n'),
    `  { key: 'sec_dashboard', section: 'dashboard', parent: null, label: 'D', route: '/dashboard' },`);
  const m8 = await loadFixture(commented, 'p8');
  const p8 = m8.TILE_REGISTRY.length === 1 && independentRowCount(commented) === 1 && q1ContradictingPairs(m8).length === 0;
  ok('P8 comments · a commented-out row is invisible to BOTH methods and mints no pair', p8,
    `evaluated=${m8.TILE_REGISTRY.length} text=${independentRowCount(commented)} pairs=${q1ContradictingPairs(m8).length}`);

  // ── P9 · Q2 resolves a tileKey node through the tile, not by guessing ─────────────────────────
  const m9 = await loadFixture(fixture(
    tile({ key: 'tk', perm: 'p:read', status: 'live', route: '/way-over-here' }),
    [`  { key: 'sec_admin', section: 'admin', parent: null, label: 'A', route: '/admin' },`,
     `  { key: 'nav_via_tile', section: 'admin', parent: 'sec_admin', tileKey: 'tk' },`].join('\n')), 'p9');
  const p9row = q2SectionRouteDisagreement(m9).mismatches.find((m) => m.key === 'nav_via_tile');
  const p9 = !!p9row && p9row.route === '/way-over-here' && p9row.resolvedVia === "tile 'tk'";
  ok('P9 tileKey resolution · a node with no inline route resolves through its tile', p9,
    p9 ? "route /way-over-here via tile 'tk'" : 'tileKey node not resolved');

  // ── P10 · a non-linking heading (route: null) is EXCLUDED, not counted as a mismatch ──────────
  const m10 = await loadFixture(fixture(
    tile({ key: 'z', perm: 'p:read', status: 'live', route: '/z' }),
    [`  { key: 'sec_admin', section: 'admin', parent: null, label: 'A', route: '/admin' },`,
     `  { key: 'nav_heading', section: 'admin', parent: 'sec_admin', label: 'H', route: null },`].join('\n')), 'p10');
  const q2b = q2SectionRouteDisagreement(m10);
  const p10 = !q2b.evaluated.some((r) => r.key === 'nav_heading') && q2b.mismatches.length === 0;
  ok('P10 heading · route:null makes no URL claim and is excluded from the denominator', p10,
    p10 ? 'excluded' : 'a non-linking heading was scored');

  // ── P11 · Q3 requires a QUALIFYING SIBLING — an undrawn module tile alone is not an instance ──
  const m11 = await loadFixture(fixture(
    tile({ key: 'lonely', perm: 'lonely:read', status: 'planned', placement: 'settings', module_key: 'mk_lonely' }),
    `  { key: 'sec_dashboard', section: 'dashboard', parent: null, label: 'D', route: '/dashboard' },`), 'p11');
  const p11 = q3ModuleOnUndrawnTile(m11).length === 0;
  ok('P11 Q3 sibling clause · an undrawn module tile with NO sibling is not an instance', p11,
    p11 ? 'correctly not reported' : 'reported without a sibling — the clause is not enforced');

  // ── P12 · the loader is not returning a cached module ─────────────────────────────────────────
  // Two loads of DIFFERENT fixtures must differ. If node handed back the first module both times,
  // every planted-bad probe above would be measuring the wrong file while appearing to pass.
  const m12 = await loadFixture(fixture(
    [tile({ key: 'only_one', perm: 'q:read', status: 'live', route: '/1' })].join('\n'),
    `  { key: 'sec_dashboard', section: 'dashboard', parent: null, label: 'D', route: '/dashboard' },`), 'p12');
  const p12 = m12.TILE_REGISTRY.length === 1 && m5.TILE_REGISTRY.length === 2 && realMod.TILE_REGISTRY.length === evaluated;
  ok('P12 module cache · distinct fixtures load distinctly (no stale-module false pass)', p12,
    `p12=${m12.TILE_REGISTRY.length} p5=${m5.TILE_REGISTRY.length} real=${realMod.TILE_REGISTRY.length}`);

  return P;
}

// ════════════════════════════════════════════════════════════════════════════════════════════════
// MAIN
// ════════════════════════════════════════════════════════════════════════════════════════════════

async function main() {
  const asJson = process.argv.includes('--json');
  const srcPath = join(ROOT, REGISTRY);
  const src = readFileSync(srcPath, 'utf8');
  const mod = await loadRegistry(srcPath, 'real');

  const evaluated = mod.TILE_REGISTRY.length;
  const textual = independentRowCount(src);

  const probes = await runProbes(src, mod);
  const failed = probes.filter((p) => !p.pass);

  const q1 = q1ContradictingPairs(mod);
  const q2 = q2SectionRouteDisagreement(mod);
  const q3 = q3ModuleOnUndrawnTile(mod);
  const unions = unionsFromSource(src);

  if (asJson) {
    process.stdout.write(JSON.stringify({
      rowCount: { evaluated, textual, agree: evaluated === textual },
      probes, unions,
      navNodes: mod.NAV_IA.length, catalog: mod.MODULE_CATALOG?.length ?? null,
      renderable: [...renderableKeys(mod)],
      q1, q2, q3,
    }, null, 2) + '\n');
    cleanup();
    process.exit(failed.length ? 1 : 0);
  }

  // ── the row-count assertion prints FIRST, on every run, pass or fail ──────────────────────────
  console.log(`\n${BLD}registry contradiction measurement${O} ${DIM}— COUNT ONLY, no cap, not in \`npm run verify\`${O}`);
  console.log(`${DIM}corpus:${O} ${REGISTRY}`);
  const agree = evaluated === textual;
  console.log(`${agree ? GRN + '✓' : RED + '✗'}${O} ROW COUNT — evaluated ${BLD}${evaluated}${O} · independent text count ${BLD}${textual}${O} ${agree ? DIM + '(agree)' + O : RED + '(DISAGREE — measurement void)' + O}`);

  console.log(`\n${BLD}probes${O}`);
  for (const p of probes) console.log(`  ${p.pass ? GRN + '✓' : RED + '✗'}${O} ${p.name} ${DIM}— ${p.detail}${O}`);
  if (failed.length) {
    console.error(`\n${RED}PROBES FAILED (${failed.length}) — every count below is worthless. A zero from an unproven script is worth nothing.${O}`);
    cleanup();
    process.exit(1);
  }

  console.log(`\n${BLD}${CYA}THE COUNTS${O}`);
  console.log(`  Q1 contradicting capability pairs ....... ${BLD}${q1.length}${O}`);
  console.log(`  Q2 section/route disagreements .......... ${BLD}${q2.mismatches.length}${O} ${DIM}of ${q2.evaluated.length} routed nav nodes${O}`);
  console.log(`  Q3 module-on-a-tile-nobody-draws ........ ${BLD}${q3.length}${O}`);

  console.log(`\n${BLD}Q1 — CONTRADICTING CAPABILITY PAIRS${O} ${DIM}(same required_permission, different status)${O}`);
  for (const p of q1) {
    console.log(`  ${YEL}${p.permission}${O}`);
    for (const t of [p.a, p.b]) {
      console.log(`    ${t.key.padEnd(20)} status=${t.status.padEnd(8)} placement=${t.placement.padEnd(9)} route=${t.route.padEnd(22)} module_key=${t.module_key.padEnd(18)} renderable=${t.renderable ? GRN + 'yes' + O : RED + 'no' + O}`);
    }
  }

  console.log(`\n${BLD}Q2 — SECTION / ROUTE DISAGREEMENT${O} ${DIM}(route's first segment vs its section root's first segment)${O}`);
  const bySec = {};
  for (const r of q2.evaluated) (bySec[r.section] ??= { total: 0, bad: 0 }).total++;
  for (const r of q2.mismatches) bySec[r.section].bad++;
  for (const [s, v] of Object.entries(bySec)) console.log(`  ${DIM}section '${s}': ${v.bad}/${v.total} disagree${O}`);
  for (const m of q2.mismatches) {
    console.log(`    ${m.key.padEnd(24)} section=${m.section.padEnd(10)} root=${m.sectionRootKey}(${m.sectionRootRoute})  ${RED}route=${m.route}${O} ${DIM}via ${m.resolvedVia}${O}`);
  }

  console.log(`\n${BLD}Q3 — MODULE PAIRED TO A TILE NOBODY DRAWS${O}`);
  for (const i of q3) {
    console.log(`  ${YEL}${i.module_key}${O} ${DIM}on${O} ${i.undrawn.key} ${DIM}(${i.undrawn.status}, placement=${i.undrawn.placement}, kind=${i.undrawn.kind}, route=${i.undrawn.route}) — shares '${i.permission}' with:${O}`);
    for (const s of i.siblings) console.log(`      ${s.key.padEnd(20)} status=${s.status.padEnd(8)} placement=${s.placement.padEnd(9)} route=${s.route.padEnd(16)} drawn=${s.renderable ? GRN + 'yes' + O : 'no'}`);
  }

  console.log(`\n${DIM}declared unions (reported, not used as a filter): ${Object.entries(unions).map(([k, v]) => `${k}=${v.length}`).join(' · ')}${O}`);
  console.log(`${DIM}NAV_IA nodes: ${mod.NAV_IA.length} · MODULE_CATALOG: ${mod.MODULE_CATALOG?.length ?? '?'} · renderable tiles: ${renderableKeys(mod).size}${O}`);
  console.log(`\n${DIM}This is a MEASUREMENT. It proposes nothing and rules nothing. David rules.${O}\n`);

  cleanup();
  process.exit(0);
}

main().catch((e) => { cleanup(); console.error(`${RED}measurement failed:${O} ${e?.stack || e}`); process.exit(1); });
