/**
 * ── PROJECT-LENS ADAPTER (shared, general) · THUNDER D-10 · 2026-06-16 ──────────────
 *
 * PURPOSE
 *   Re-cut the SAME honest cost data BY PROJECT (D-10). Groups flat cost_objects rows
 *   under the PROJECT they belong to (or company-level "Platform overhead"), and computes
 *   each group's total THROUGH the existing CostRollup engine + count-once seam — no new
 *   math, no schema change. The tree this feeds is the project-lens (DECISION-project-
 *   lens-ui-design.md): tenant business-NAME as visual root, parent_id-null costs as
 *   "Platform overhead", PROJECT nodes with rollup totals.
 *
 * THE parent_id ↔ cost_object_edges DISTINCTION (the load-bearing wiring note):
 *   The DESIGN attaches a cost to a project via the cost_objects.parent_id SELF-FK
 *   (single-parent, §3 of the design). But CostRollup.rollup() traverses the
 *   cost_object_edges TABLE (graph.edges), NOT the parent_id column — they are two
 *   different mechanisms. So this adapter SYNTHESIZES, at read time, a containment edge
 *   (use_fraction = 1.0) for every parent_id link, feeds them into an in-memory CostGraph,
 *   and calls rollup() per group. PATH A (settled with David, 2026-06-16):
 *     • keeps the design's "recompute THROUGH CostRollup" promise, and
 *     • composes for FREE when real cost_object_edges / cost_object_assignments rows arrive
 *       (shared costs, asset reuse, idle capital) — they just add to the same graph.
 *   Single-parent + use_fraction 1.0 means the number is IDENTICAL to a direct seam group
 *   today; PATH A costs nothing now and is future-proof (AC-4, settle once).
 *
 * TENANT vs PROJECT (the crux — DECISION §2):
 *   The COMPANY/LLC is the TENANT (business_id, RLS scope) — NEVER a cost_objects row,
 *   NEVER a parent_id. The tree's visual ROOT is the tenant's business NAME, passed in as
 *   `rootLabel` and rendered, NOT stored. A virtual in-memory root node ('__root__') is
 *   synthesized ONLY to compute the overhead group through the same rollup() path; it is
 *   never persisted. parent_id-null costs hang under it as "Platform overhead".
 *
 * SINGLE PARENT (DECISION §3):
 *   A cost's home is exactly ONE project OR the company — never two. parent_id pointing at
 *   a PROJECT → that project group. parent_id null (or dangling / pointing at a non-project)
 *   → company-level overhead. Single parent = no DAG diamond for entered data.
 *
 * UNTOUCHED (D-9): the honesty engine is owner-proven and unchanged — capex excluded from
 *   the ÷N pool, unknowns surfaced never zeroed, duplicates flagged + counted once. This
 *   module only decides WHICH group a row rolls into; rollup()/enforceCountOnce() do the math.
 *
 * SCOPE: pure. Reads rows passed in — NO DB, NO Supabase, NO React. The cultivar tree
 *   component fetches the rows and renders the groups; this is the testable seam between.
 *
 * OUTPUTS
 *   - ProjectLensRow   — a cost_objects row projection carrying parent_id.
 *   - ProjectGroup     — one group (a PROJECT, or the overhead bucket) + its NodeRollup.
 *   - ProjectLensView  — rootLabel + ordered groups (overhead first) + flat company total
 *                        (count-once over ALL captured rows — the D-7 top-line cut) + flags.
 */

import { rollup, type CostGraph, type CostObjectEdgeRow, type NodeRollup } from './CostRollup';
import {
  enforceCountOnce,
  fromCostObject,
  type CostObjectNodeRow,
  type SeamResult,
} from './CountOnceSeam';

/** Sentinel id for the in-memory virtual root (company-level overhead group). Never stored. */
export const OVERHEAD_GROUP_ID = '__overhead__';
const VIRTUAL_ROOT_ID = '__root__';

/** A cost_objects row as the lens reads it (the seam projection + the parent_id self-FK). */
export interface ProjectLensRow extends CostObjectNodeRow {
  parent_id: string | null;
}

/** One group in the tree: a PROJECT node, or the company-level overhead bucket. */
export interface ProjectGroup {
  /** project id, or OVERHEAD_GROUP_ID for the company-level bucket. */
  id: string;
  /** project name, or "Platform overhead". */
  label: string;
  isOverhead: boolean;
  /** computed THROUGH CostRollup (synthetic containment edges) → seam-reconciled total. */
  rollup: NodeRollup;
  /** the direct cost rows under this group (the tree's child rows; PROJECT nodes excluded). */
  children: ProjectLensRow[];
}

export interface ProjectLensView {
  /** the tenant's business NAME — the visual root, rendered NOT stored (DECISION §2). */
  rootLabel: string;
  /** overhead bucket FIRST (DECISION §1 tree order), then one group per PROJECT. */
  groups: ProjectGroup[];
  /** count-once over EVERY captured cost row — the flat company total (D-7 top-line cut). */
  flatCompanyTotal: SeamResult;
  /** rows whose parent_id dangled (pointed at a missing / non-project node) — surfaced. */
  danglingCount: number;
  /** honest notes bubbled up from every group's rollup (open period / multi-path / cycle). */
  flags: string[];
}

/**
 * Build the project-lens view from flat cost_objects rows.
 *
 * @param rows     ALL cost_objects rows for the tenant (every node_type). PROJECT nodes are
 *                 the group buckets; non-PROJECT rows are the costs that hang under them.
 * @param rootLabel the tenant's business name (the visual root — NOT a stored node).
 * @param asOf     "now" for open-period math (Date.now() is unavailable in shared code).
 */
export function buildProjectLens(rows: ProjectLensRow[], rootLabel: string, asOf: string): ProjectLensView {
  const projects = rows.filter((r) => r.node_type === 'PROJECT');
  const costRows = rows.filter((r) => r.node_type !== 'PROJECT');
  const projectIds = new Set(projects.map((p) => p.id));

  // Classify every cost row into a group target: its parent PROJECT, or overhead.
  // Single-parent (DECISION §3): parent_id at a real PROJECT → that project; else overhead.
  let danglingCount = 0;
  const groupOf = (row: ProjectLensRow): string => {
    if (row.parent_id == null) return VIRTUAL_ROOT_ID; // company-level overhead
    if (projectIds.has(row.parent_id)) return row.parent_id;
    danglingCount++; // parent_id pointed at a missing / non-project node — fall back to overhead, flagged
    return VIRTUAL_ROOT_ID;
  };

  // Synthesize containment edges (use_fraction 1.0) from parent_id — PATH A. This is what
  // lets rollup() (which reads graph.edges, not parent_id) attribute the cost to the group.
  const edges: CostObjectEdgeRow[] = costRows.map((row, i) => ({
    id: `synthetic-parent-${i}`,
    parent_id: groupOf(row), // RECEIVES the cost (project id or virtual root)
    child_id: row.id, // CONTRIBUTES the cost
    edge_type: 'containment',
    use_fraction: 1.0,
    basis_confidence: null,
  }));

  // Virtual root node — in-memory ONLY, so the overhead group rolls up through the SAME
  // rollup() path as projects. node_type PROJECT so its own null-amount event is dropped
  // (a non-ASSET null cost is N/A, not an honest UNKNOWN — CostRollup gather step 1).
  const virtualRoot: ProjectLensRow = {
    id: VIRTUAL_ROOT_ID,
    label: rootLabel,
    node_type: 'PROJECT',
    acquisition_cost: null,
    cost_confidence: 'UNKNOWN',
    parent_id: null,
  };

  const graph: CostGraph = {
    nodes: [virtualRoot, ...rows],
    edges,
    assignments: [], // real temporal assignments compose in here for free when captured (PATH A)
    asOf,
  };

  const flags: string[] = [];

  // Overhead bucket FIRST (tree order), computed through rollup over the virtual root.
  const overheadRollup = rollup(VIRTUAL_ROOT_ID, graph);
  flags.push(...overheadRollup.flags);
  const overheadGroup: ProjectGroup = {
    id: OVERHEAD_GROUP_ID,
    label: 'Platform overhead',
    isOverhead: true,
    rollup: overheadRollup,
    children: costRows.filter((r) => groupOfPure(r, projectIds) === VIRTUAL_ROOT_ID),
  };

  // One group per PROJECT, in input order.
  const projectGroups: ProjectGroup[] = projects.map((p) => {
    const r = rollup(p.id, graph);
    flags.push(...r.flags);
    return {
      id: p.id,
      label: p.label,
      isOverhead: false,
      rollup: r,
      children: costRows.filter((c) => c.parent_id === p.id),
    };
  });

  // Flat company total — count-once over every captured COST row's events (D-7 top-line cut,
  // distinct from the rollup-sum which is the per-node cut). This is the honest sum of all
  // captured costs; it does NOT double-count parent+child because the seam dedups by event.
  // PROJECT/PRODUCT nodes are buckets, not costs — and a non-ASSET node's null own cost is
  // N/A, not an honest UNKNOWN (mirrors CostRollup gather step 1), so it must NOT surface as
  // a phantom unknown line. Filter to cost rows, dropping null-amount non-ASSET events.
  const flatCompanyTotal = enforceCountOnce(
    costRows.flatMap((r) => fromCostObject(r).filter((e) => !(e.amount == null && r.node_type !== 'ASSET'))),
  );

  return {
    rootLabel,
    groups: [overheadGroup, ...projectGroups],
    flatCompanyTotal,
    danglingCount,
    flags,
  };
}

/** Pure classifier (no danglingCount side effect) for building each group's child list. */
function groupOfPure(row: ProjectLensRow, projectIds: Set<string>): string {
  if (row.parent_id == null) return VIRTUAL_ROOT_ID;
  if (projectIds.has(row.parent_id)) return row.parent_id;
  return VIRTUAL_ROOT_ID;
}
