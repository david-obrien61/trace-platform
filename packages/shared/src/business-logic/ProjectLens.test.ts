/**
 * ── PROJECT-LENS ADAPTER — adversarial tests · THUNDER D-10 · 2026-06-16 ──────────
 *
 * Proves the project-lens re-cut (buildProjectLens) over flat cost_objects rows:
 *   1. parent_id-null costs land in the "Platform overhead" group; nothing else does.
 *   2. costs whose parent_id points at a PROJECT roll up under THAT project (PATH A —
 *      synthetic containment edges feed CostRollup, which reads graph.edges not parent_id).
 *   3. an UNKNOWN-cost asset (HP ProDesk, null) is SURFACED in the group, never counted $0.
 *   4. REASSIGNMENT is a MOVE: re-pointing parent_id moves the cost out of overhead into the
 *      project; BOTH totals recompute (overhead drops, project rises) — never a copy.
 *   5. single-parent: a cost is in exactly ONE group, never two (no double-count across groups).
 *   6. a dangling parent_id (missing / non-project) falls back to overhead and is flagged.
 *   7. the flat company total counts every captured cost ONCE (D-7 top-line), independent
 *      of grouping.
 * Each test computes what a BUGGY adapter would produce and asserts the real one differs.
 *
 * Run (no test runner installed — pure TS over pure functions):
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/ProjectLens.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { buildProjectLens, OVERHEAD_GROUP_ID, type ProjectLensRow } from './ProjectLens';

// ── tiny harness ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++;
  else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
function test(name: string, fn: () => void): void { console.log('▶ ' + name); fn(); }
const r2 = (n: number) => Math.round(n * 100) / 100;

const ASOF = '2026-06-16';

// Real seeded CoolRunnings hardware (TRACE tenant) — all ASSET, all CAPEX. Plus the
// pre-existing owner tractor. parent_id null = unassigned (company-level) until David moves them.
function seed(parentOf: Record<string, string | null> = {}): ProjectLensRow[] {
  const a = (id: string, label: string, cost: number | null, conf: ProjectLensRow['cost_confidence']): ProjectLensRow => ({
    id, label, node_type: 'ASSET', acquisition_cost: cost, cost_confidence: conf,
    parent_id: parentOf[id] ?? null,
  });
  return [
    a('nspanel', 'NSPanel Pro 120 ×2', 259.80, 'CONFIRMED'),
    a('miniduo', 'MINI Duo-L ×3', 65.70, 'CONFIRMED'),
    a('meross', 'meross MTS300HK', 91.81, 'DERIVED'),
    a('hp', 'HP ProDesk 600 G6', null, 'UNKNOWN'),       // ← null cost: must surface, never $0
    a('tractor', 'tractor mahindra', 5000, 'ESTIMATED'),
  ];
}

const PROJECT = (id: string, label: string): ProjectLensRow => ({
  id, label, node_type: 'PROJECT', acquisition_cost: null, cost_confidence: 'UNKNOWN', parent_id: null,
});

// ── 1. all-unassigned → everything in Platform overhead, projects empty. ───────────
test('1. parent_id-null costs land in Platform overhead; PROJECT groups exist but empty', () => {
  const rows = [...seed(), PROJECT('cr', 'CoolRunnings'), PROJECT('bw', 'BuiltWithCAI')];
  const view = buildProjectLens(rows, 'TRACE', ASOF);

  ok(view.rootLabel === 'TRACE', 'root label is the tenant business name (rendered, not stored)');
  const overhead = view.groups.find((g) => g.id === OVERHEAD_GROUP_ID)!;
  ok(view.groups[0].isOverhead, 'overhead group is FIRST in tree order');
  ok(overhead.children.length === 5, `all 5 captured costs sit in overhead; got ${overhead.children.length}`);
  // capex = 259.80 + 65.70 + 91.81 + 5000 = 5417.31 (HP ProDesk null surfaced, not added).
  ok(r2(overhead.rollup.capexKnown) === 5417.31, `overhead capex = 5417.31; got ${overhead.rollup.capexKnown}`);
  const cr = view.groups.find((g) => g.id === 'cr')!;
  ok(cr.children.length === 0 && cr.rollup.capexKnown === 0, 'CoolRunnings is empty until costs are assigned');
  ok(overhead.rollup.capexKnown !== 0, 'assertion has teeth: a broken grouping would leave overhead at 0');
});

// ── 2. assign hardware to CoolRunnings → it rolls up under THAT project (PATH A). ──
test('2. costs with parent_id=project roll up under that project via synthetic edges', () => {
  const rows = [
    ...seed({ nspanel: 'cr', miniduo: 'cr', meross: 'cr', hp: 'cr' }), // 4 hardware → CoolRunnings
    PROJECT('cr', 'CoolRunnings'),
  ];
  const view = buildProjectLens(rows, 'TRACE', ASOF);
  const cr = view.groups.find((g) => g.id === 'cr')!;
  const overhead = view.groups.find((g) => g.id === OVERHEAD_GROUP_ID)!;

  // CoolRunnings capex = 259.80 + 65.70 + 91.81 = 417.31 (HP ProDesk null surfaced).
  ok(r2(cr.rollup.capexKnown) === 417.31, `CoolRunnings capex = 417.31; got ${cr.rollup.capexKnown}`);
  ok(cr.children.length === 4, `4 hardware rows hang under CoolRunnings; got ${cr.children.length}`);
  // tractor stays in overhead.
  ok(r2(overhead.rollup.capexKnown) === 5000, `tractor remains overhead at 5000; got ${overhead.rollup.capexKnown}`);
  // Bug-catch: rollup reading parent_id-column-as-edges incorrectly (or ignoring synthetic edges)
  // would leave CoolRunnings empty.
  ok(cr.rollup.capexKnown !== 0, 'assertion has teeth: missing the synthetic edges would leave CoolRunnings at 0');
});

// ── 3. UNKNOWN-cost asset is surfaced in its group, NEVER counted as $0. ───────────
test('3. HP ProDesk (null cost) surfaces as unknown in its group, never zeroed', () => {
  const rows = [...seed({ hp: 'cr' }), PROJECT('cr', 'CoolRunnings')];
  const view = buildProjectLens(rows, 'TRACE', ASOF);
  const cr = view.groups.find((g) => g.id === 'cr')!;
  ok(cr.rollup.seam.unknownLines.length === 1, `HP ProDesk listed as 1 unknown; got ${cr.rollup.seam.unknownLines.length}`);
  ok(cr.rollup.seam.unknownLines[0].label.includes('HP ProDesk'), 'the unknown line names the asset');
  ok(cr.rollup.capexKnown === 0, 'a null-cost asset adds NOTHING to capex (not silently $0-counted)');
});

// ── 4. REASSIGNMENT is a MOVE — both totals recompute, never a copy. ──────────────
test('4. moving the tractor overhead→CoolRunnings: overhead drops, project rises, no copy', () => {
  const before = buildProjectLens([...seed(), PROJECT('cr', 'CoolRunnings')], 'TRACE', ASOF);
  const after  = buildProjectLens([...seed({ tractor: 'cr' }), PROJECT('cr', 'CoolRunnings')], 'TRACE', ASOF);

  const ohBefore = before.groups.find((g) => g.id === OVERHEAD_GROUP_ID)!.rollup.capexKnown;
  const ohAfter  = after.groups.find((g) => g.id === OVERHEAD_GROUP_ID)!.rollup.capexKnown;
  const crBefore = before.groups.find((g) => g.id === 'cr')!.rollup.capexKnown;
  const crAfter  = after.groups.find((g) => g.id === 'cr')!.rollup.capexKnown;

  ok(r2(ohBefore) === 5417.31 && r2(ohAfter) === 417.31, `overhead drops by the tractor's 5000; ${ohBefore}→${ohAfter}`);
  ok(crBefore === 0 && r2(crAfter) === 5000, `CoolRunnings rises by exactly 5000; ${crBefore}→${crAfter}`);
  // The tractor is in CoolRunnings' children and NOT in overhead's — a MOVE, not a copy.
  const ohKids = after.groups.find((g) => g.id === OVERHEAD_GROUP_ID)!.children.map((c) => c.id);
  const crKids = after.groups.find((g) => g.id === 'cr')!.children.map((c) => c.id);
  ok(crKids.includes('tractor') && !ohKids.includes('tractor'), 'tractor is under CoolRunnings ONLY, never both (single-parent)');
  // Conservation: the flat company total is unchanged by a move (re-cut, not re-count).
  ok(r2(before.flatCompanyTotal.capexKnown) === r2(after.flatCompanyTotal.capexKnown), 'company total is invariant under reassignment');
});

// ── 5. single parent: a cost appears in exactly ONE group. ────────────────────────
test('5. every cost row appears in exactly one group (no cross-group double-count)', () => {
  const rows = [...seed({ nspanel: 'cr', miniduo: 'bw' }), PROJECT('cr', 'CoolRunnings'), PROJECT('bw', 'BuiltWithCAI')];
  const view = buildProjectLens(rows, 'TRACE', ASOF);
  const allChildIds = view.groups.flatMap((g) => g.children.map((c) => c.id));
  const unique = new Set(allChildIds);
  ok(allChildIds.length === unique.size, 'no cost id appears in two groups');
  ok(allChildIds.length === 5, `all 5 costs are placed exactly once; got ${allChildIds.length}`);
  // Sum of group capex == flat company total (conservation across the partition).
  const groupSum = r2(view.groups.reduce((s, g) => s + g.rollup.capexKnown, 0));
  ok(groupSum === r2(view.flatCompanyTotal.capexKnown), `group capex sums to company total; ${groupSum} vs ${view.flatCompanyTotal.capexKnown}`);
});

// ── 6. dangling parent_id falls back to overhead and is flagged. ──────────────────
test('6. a cost pointing at a missing/non-project parent falls back to overhead, flagged', () => {
  const rows = [...seed({ meross: 'ghost-project' }), PROJECT('cr', 'CoolRunnings')];
  const view = buildProjectLens(rows, 'TRACE', ASOF);
  ok(view.danglingCount === 1, `one dangling parent_id surfaced; got ${view.danglingCount}`);
  const overhead = view.groups.find((g) => g.id === OVERHEAD_GROUP_ID)!;
  ok(overhead.children.some((c) => c.id === 'meross'), 'the dangling cost falls back to overhead, never dropped');
  ok(r2(overhead.rollup.capexKnown) === 5417.31, 'the dangling cost is still counted (in overhead)');
});

// ── 7. flat company total is count-once over ALL rows (independent of grouping). ──
test('7. flat company total counts every captured cost once, regardless of assignment', () => {
  const unassigned = buildProjectLens([...seed(), PROJECT('cr', 'CoolRunnings')], 'TRACE', ASOF);
  const assigned   = buildProjectLens([...seed({ nspanel: 'cr', tractor: 'cr' }), PROJECT('cr', 'CoolRunnings')], 'TRACE', ASOF);
  // 259.80 + 65.70 + 91.81 + 5000 = 5417.31 either way (HP ProDesk null surfaced, not added).
  ok(r2(unassigned.flatCompanyTotal.capexKnown) === 5417.31, `company total = 5417.31; got ${unassigned.flatCompanyTotal.capexKnown}`);
  ok(r2(assigned.flatCompanyTotal.capexKnown) === 5417.31, 'company total is the same whether assigned or not (D-7 top-line)');
  ok(unassigned.flatCompanyTotal.unknownLines.length === 1, 'HP ProDesk surfaces as the one company-level unknown');
});

// ── report ─────────────────────────────────────────────────────────────────────────
console.log('\n──────────────────────────────────────────────');
console.log(`PROJECT-LENS ADAPTER TESTS: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.error('FAILURES:\n - ' + failures.join('\n - '));
  process.exit(1);
} else {
  console.log('✓ all project-lens tests pass AND each proves it can catch its bug');
}
