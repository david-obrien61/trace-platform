#!/usr/bin/env node
/**
 * verify-unit-projection.mjs — THE UNIT COLUMNS ARE A PROJECTION OF `size`, NOT A PARALLEL TRUTH.
 *
 * PURPOSE:      `business_inventory.unit_kind / unit_value / unit_value_max / unit_name /
 *               unit_parsed_from` are DERIVED from `size` by exactly one function. This cap asserts
 *               the four properties that keep that true across artifacts nothing else compares:
 *                 A · ONE DERIVE      — every write of a unit column comes from unitColumnsFor /
 *                                       withUnitColumns. No second place computes a unit.
 *                 B · NEVER EDITABLE  — no grid column, no editable cell, no form field renders one.
 *                 C · TS ↔ SQL AGREE  — the closed taxonomy in TypeScript and the NAMED CHECK
 *                                       constraint in the migration hold the SAME five values, and
 *                                       UNIT_COLUMNS names exactly the columns the migration adds.
 *                 D · THE GUARD EXISTS — the migration ships the BEFORE-write trigger that NULLs
 *                                       the projection when `size` moves, and the trigger holds NO
 *                                       PARSER (a PL/pgSQL parser would be the second
 *                                       materialisation this whole shape exists to prevent).
 *
 * DEPENDENCIES: read as TEXT — packages/shared/src/inventory/unitOfMeasure.ts,
 *               supabase/migrations/20260830_inventory_unit_of_measure.sql, and the repo's own
 *               source tree. No import, no transpile, no database. Runs in plain node in CI.
 * OUTPUTS:      exit 0 = the four properties hold. exit 1 = the offending file/line, named.
 *
 * ── WHY THIS EXISTS, AND WHY IT IS BUILT IN THE SAME PASS AS THE COLUMNS ────────────────────────
 * David's rule when he approved the build: *"THE UNIT COLUMNS ARE A PARSE OF `size`. THEY ARE NEVER
 * A PARALLEL TRUTH… A CHECK ASSERTS THAT RE-PARSING `size` REPRODUCES THEM. Build that check in this
 * pass, not later."* The reason is on the tech-debt log: **#71 — one `status` column, two authors.**
 * D-42's qty-derive silently reverts D-52's manual `archived`, the reverting author wins, and
 * nothing says so. That is what a derived column becomes the moment a second writer appears, and a
 * second writer appears because nothing was watching.
 *
 * A rule with no guard is a rule waiting to be broken by someone who knows it — including its
 * author (RULINGS.md, 2026-07-29: four self-catches in 24 hours, three by the author of the rule).
 *
 * ⚠️ WHAT THIS CAP CANNOT SEE, STATED SO ITS GREEN IS NOT READ AS MORE THAN IT IS: it reads the
 * REPO, never the catalog. It cannot tell whether 20260830 is applied, and it cannot compare a
 * stored unit column to a live `size`. That live re-parse is
 * the backfill script's `--verify` mode, which needs a service credential and is
 * David's to run. A cap silent about its own blind spot is the #164 shape.
 *
 * STORY: user_stories.md → *A quantity that means something*. Ledger #234.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const RED = '\x1b[31m', GRN = '\x1b[32m', DIM = '\x1b[2m', O = '\x1b[0m', BLD = '\x1b[1m';

const PARSER    = 'packages/shared/src/inventory/unitOfMeasure.ts';
const MIGRATION = 'supabase/migrations/20260830_inventory_unit_of_measure.sql';

const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const problems = [];
const fail = (probe, where, how) => problems.push({ probe, where, how });

// ── source walk ────────────────────────────────────────────────────────────────────────────────
const SKIP_DIR = new Set(['node_modules', 'dist', '.git', 'build', 'coverage']);
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIR.has(name)) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|mjs|js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}
const FILES = walk(join(ROOT, 'packages'))
  .concat(walk(join(ROOT, 'scripts')))
  .concat(walk(join(ROOT, 'api')))
  .map((p) => ({ path: relative(ROOT, p), src: readFileSync(p, 'utf8') }));

/** Strip line + block comments so a column named in PROSE is never mistaken for a write. That
 *  distinction is the whole difference between this cap and a grep: these files DOCUMENT the rule
 *  at length, and a cap that cannot tell explanation from code would fail on its own documentation. */
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const UNIT_COLS = ['unit_kind', 'unit_value', 'unit_value_max', 'unit_name', 'unit_parsed_from'];
const COL_RE = new RegExp(`\\b(${UNIT_COLS.join('|')})\\b`);

// The files ALLOWED to name a unit column in code, each with the reason it is allowed. Anything
// else naming one is either a second derive or an editable surface — the two failure modes.
const ALLOWED = new Map([
  [PARSER,                                                'the ONE derive'],
  ['packages/shared/src/inventory/unitOfMeasure.test.ts',  'its test'],
  ['packages/shared/src/inventory/index.ts',               'the barrel re-export'],
  ['scripts/verify-unit-projection.mjs',                   'this cap'],
  ['scripts/backfill-inventory-units.ts',                  'the backfill — reads the derive, writes what it returns'],
  ['packages/shared/src/components/datasheet/systemManagedFields.ts', 'the lock registry (declares them non-editable)'],
]);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// A · ONE DERIVE — nothing outside the allow-list may name a unit column in code.
// ══════════════════════════════════════════════════════════════════════════════════════════════
for (const { path, src } of FILES) {
  if (ALLOWED.has(path)) continue;
  const code = stripComments(src);
  if (!COL_RE.test(code)) continue;
  const line = code.split('\n').findIndex((l) => COL_RE.test(l)) + 1;
  fail('A', `${path}:${line}`,
    'names a unit_* column in code. Every write comes from withUnitColumns()/unitColumnsFor(); a second site computing or setting one is a parallel truth (tech-debt #71).');
}

// A2 — EVERY WRITE SITE derives, not merely every writing FILE.
//
// 🔴 BOTH HALVES OF THIS PROBE WERE FOUND BY MUTATING IT, and they are worth recording because the
// first version looked completely reasonable:
//   (i)  it tested for the bare identifier, so deleting the CALL and leaving the `import` line
//        passed clean — the cap was asserting that a file still knows the function's NAME.
//   (ii) it tested PER FILE, so `inventoryEdit.ts` — which has TWO write paths,
//        persistInventoryPatch and insertInventory — still passed with one of them stripped.
// A cap that cannot fail is worse than no cap, because it is read as evidence. Count the CALLS,
// per site, with imports stripped.
const WRITERS = [
  ['packages/cultivar-os/src/components/inventory/inventoryEdit.ts', 'withUnitColumns', 2, 'persistInventoryPatch + insertInventory'],
  ['packages/cultivar-os/src/pages/importWrites.ts',                 'unitColumnsFor',  1, 'the import CREATE path (the RPC sets size and knows no units)'],
  ['packages/shared/src/discovery/populate.ts',                      'unitColumnsFor',  1, 'catalogItemToInventoryRow (the discovery scrape)'],
];
for (const [path, fn, min, sites] of WRITERS) {
  const code = stripComments(read(path)).replace(/^\s*import\b[^;]*;/gm, '');
  const calls = (code.match(new RegExp(`\\b${fn}\\s*\\(`, 'g')) ?? []).length;
  if (calls < min)
    fail('A2', path, `writes business_inventory.size at ${min} site(s) — ${sites} — but CALLS ${fn}() only ${calls} time(s). A write site without the derive lands rows that are unparsed forever.`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// B · NEVER EDITABLE — no grid column, cell or form field may render a unit column.
//     The allow-list above already removes every legitimate mention, so ANY editable-looking
//     construct here is a real one. Checked as a distinct probe so its failure message is the
//     right one: this is not "a second derive", it is "an owner can now type into a projection".
// ══════════════════════════════════════════════════════════════════════════════════════════════
const EDITABLE = /(onCommit|<TextCell|<NumberCell|<AmountCell|key:\s*['"]unit_|field:\s*['"]unit_|name=['"]unit_)/;
for (const { path, src } of FILES) {
  if (path === PARSER || path.endsWith('.test.ts') || path.startsWith('scripts/')) continue;
  for (const [i, l] of stripComments(src).split('\n').entries()) {
    if (COL_RE.test(l) && EDITABLE.test(l))
      fail('B', `${path}:${i + 1}`, 'renders a unit_* column as an EDITABLE control. The projection is system-managed — never a field, never a cell.');
  }
}

// B2 — the lock registry must claim all five, so the day one IS rendered it locks with a reason
// (CLAUDE.md §6 r13) rather than appearing as a mystery-greyed cell.
const REGISTRY = 'packages/shared/src/components/datasheet/systemManagedFields.ts';
const regSrc = read(REGISTRY);
for (const c of UNIT_COLS) {
  if (!new RegExp(`^\\s*${c}:\\s*\\{`, 'm').test(regSrc))
    fail('B2', REGISTRY, `${c} is not in SYSTEM_MANAGED_FIELDS — a grid that shows it would offer an edit the platform will overwrite.`);
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// C · TS ↔ SQL AGREE — the taxonomy and the column list are stated in two artifacts, so they are
//     exactly the pair that drifts. This is the probe that would have caught tech-debt #91
//     (two platform CHECK constraints, neither a subset of the other, `email` producible by nothing).
// ══════════════════════════════════════════════════════════════════════════════════════════════
const parserSrc = read(PARSER);
const mig = read(MIGRATION);

const tsKinds = [...(parserSrc.match(/export const UNIT_KINDS[^=]*=\s*\[([^\]]+)\]/)?.[1] ?? '')
  .matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();
const sqlKinds = [...(mig.match(/unit_kind IN \(([^)]+)\)/)?.[1] ?? '')
  .matchAll(/'([a-z]+)'/g)].map((m) => m[1]).sort();

if (tsKinds.length !== 5) fail('C', PARSER, `UNIT_KINDS should hold the five closed kinds, found ${tsKinds.length}: ${tsKinds.join(',') || '(none parsed)'}`);
if (sqlKinds.length !== 5) fail('C', MIGRATION, `the unit_kind CHECK should list the five closed kinds, found ${sqlKinds.length}: ${sqlKinds.join(',') || '(none parsed)'}`);
if (tsKinds.join(',') !== sqlKinds.join(','))
  fail('C', `${PARSER} ↔ ${MIGRATION}`, `the taxonomy DISAGREES — TS has [${tsKinds}], the DB CHECK has [${sqlKinds}]. A kind the DB refuses is a write that fails at runtime; a kind the DB allows and TS never produces is a value nothing can make (#91's exact shape).`);

const tsCols = [...(parserSrc.match(/export const UNIT_COLUMNS\s*=\s*\[([^\]]+)\]/)?.[1] ?? '')
  .matchAll(/'([a-z_]+)'/g)].map((m) => m[1]).sort();
const sqlCols = [...mig.matchAll(/ADD COLUMN IF NOT EXISTS\s+(unit_[a-z_]+)/g)].map((m) => m[1]).sort();
if (tsCols.join(',') !== sqlCols.join(','))
  fail('C2', `${PARSER} ↔ ${MIGRATION}`, `UNIT_COLUMNS [${tsCols}] does not match the columns the migration adds [${sqlCols}].`);

// C3 — the CHECK constraints are NAMED, never inline. tech-debt #91's finding: an inline CHECK is
// auto-named by Postgres, its name is never typed, and a `conname` grep can therefore never find
// it — which is how ~129 of them became invisible to the #23 sweep.
for (const name of ['business_inventory_unit_kind_check', 'business_inventory_unit_projection_check']) {
  if (!mig.includes(`ADD  CONSTRAINT ${name}`) && !mig.includes(`ADD CONSTRAINT ${name}`))
    fail('C3', MIGRATION, `${name} is not added as a NAMED constraint — an inline CHECK cannot be found by name later (#91).`);
}

// C4 — `size` itself gains NO constraint. The whole design rests on size staying free text: the
// owner's vocabulary is theirs (D-23), and a CHECK on it would reject a grower's real label.
if (/CHECK\s*\([^)]*\bsize\b[^)]*\)/.test(mig.replace(/unit_parsed_from IS NOT DISTINCT FROM size/g, '')))
  fail('C4', MIGRATION, 'a CHECK constraint references `size` beyond the projection invariant — size must remain free text (D-23).');

// ══════════════════════════════════════════════════════════════════════════════════════════════
// D · THE GUARD EXISTS, AND IT HOLDS NO PARSER.
// ══════════════════════════════════════════════════════════════════════════════════════════════
if (!/CREATE TRIGGER business_inventory_unit_projection\s+BEFORE INSERT OR UPDATE ON business_inventory/.test(mig))
  fail('D', MIGRATION, 'the BEFORE INSERT OR UPDATE guard is missing — without it a size change leaves a STALE unit, and the projection becomes a parallel truth.');

const guardBody = mig.match(/business_inventory_unit_projection_guard\(\)[\s\S]*?END \$\$;/)?.[0] ?? '';
for (const c of UNIT_COLS) {
  if (!new RegExp(`NEW\\.${c}\\s*:=\\s*NULL`).test(guardBody))
    fail('D2', MIGRATION, `the guard does not NULL ${c} — a partially-cleared projection is worse than none: it still claims to describe the row.`);
}
// 🔴 The guard must NOT learn what a gallon is. A parser in PL/pgSQL is a SECOND implementation of
// the parse rule, which is the exact defect the projection shape exists to prevent.
if (/\b(gallon|yard|quart|lb\b|scoop|bucket|regexp_|~\s*')/i.test(guardBody))
  fail('D3', MIGRATION, 'the guard appears to contain PARSING logic. It must know only that parsed_from ≠ size means "let go" — the ONE parse rule lives in TypeScript.');

// ══════════════════════════════════════════════════════════════════════════════════════════════
if (problems.length === 0) {
  console.log(`${BLD}UNIT PROJECTION${O} ${DIM}— the unit columns are a parse of \`size\`, never a parallel truth${O}`);
  console.log(`  ${GRN}✓${O} A  one derive — ${FILES.length} source files scanned; only ${ALLOWED.size} may name a unit column, and all 3 wired writers still call it`);
  console.log(`  ${GRN}✓${O} B  never editable — no grid column, cell or form field renders one; all 5 declared in SYSTEM_MANAGED_FIELDS`);
  console.log(`  ${GRN}✓${O} C  TS ↔ SQL agree — taxonomy [${tsKinds.join('|')}] identical in both; ${tsCols.length} columns matched; both CHECKs NAMED; \`size\` unconstrained`);
  console.log(`  ${GRN}✓${O} D  the guard ships, NULLs all 5, and holds no parser`);
  console.log(`  ${DIM}↳ BLIND SPOT: this reads the repo, not the catalog. The LIVE re-parse is \`npm run units:backfill -- --verify\` (needs a service key).${O}`);
  process.exit(0);
}

console.error(`\n${RED}✗ unit-projection — ${problems.length} violation(s):${O}`);
for (const p of problems) console.error(`  ${RED}[${p.probe}]${O} ${p.where}\n      ${DIM}${p.how}${O}`);
console.error(`\n${DIM}The unit columns are DERIVED from \`size\` and are never independently editable. Fix the write, not this cap.${O}`);
process.exit(1);
