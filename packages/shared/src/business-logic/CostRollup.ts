/**
 * ── DUAL-EDGE COST ROLLUP (shared, general) · THUNDER Core-2b SUB-2 · 2026-06-15 ──
 *
 * PURPOSE
 *   Compute a node's ACCUMULATED cost by traversing the cost-object graph across BOTH
 *   edge tables (D-4 — two edge tables, rollup traverses BOTH):
 *     • cost_object_edges        — STRUCTURAL. containment (child ⊂ parent, full cost
 *                                  rolls up) + contribution (one asset → many products,
 *                                  shared). Allocation primitive: use_fraction (§5.2/§5.5/§5.7).
 *     • cost_object_assignments  — TEMPORAL. asset → project, time-bounded. An asset reused
 *                                  across SEQUENTIAL projects allocates by ASSIGNMENT PERIOD
 *                                  (§5.9). conversion_cost lands on the RECEIVING project.
 *
 *   The rollup is a SOURCE into the count-once seam, NOT a bypass: it gathers the attributed
 *   cost EVENTS for a node, then runs them THROUGH enforceCountOnce() (CountOnceSeam) so
 *   capex stays OUT of the ÷N monthly pool and duplicates collapse via sameCost(). The seam
 *   stays the single reconciliation gate (§14); this module only decides WHICH events, at
 *   WHAT fraction, attribute to a node.
 *
 * ALLOCATION MODEL (the two axes, deliberately distinct):
 *   • STRUCTURAL fraction = edge.use_fraction. A child's attributed cost × use_fraction
 *     crosses into the parent (carve-out / multi-location share). The remainder stays
 *     where it was (personal / another parent) and never enters THIS node's rollup.
 *   • TEMPORAL share      = period_i / asset_life. The asset's own cost is spread across the
 *     projects it served, by the fraction of its LIFE each assignment covered. Life is
 *     [earliest assignment start … asOf]. Time covered by NO assignment is IDLE — it is NOT
 *     attributed to any project; that remainder is held by the domain (§5.9 fallback-to-
 *     domain, OP-6) and SURFACED as idle capital, never silently dropped or dumped on one
 *     project. Dividing by LIFE (not by assigned-time) is what makes idle visible — the
 *     differentiator insight "you have $X of capital sitting idle between projects" (§5.9).
 *
 * HONEST UNDER INCOMPLETE DATA (OP-5 / OP-6):
 *   • UNKNOWN amount → scaling null stays null; the seam surfaces it in unknownLines, never 0.
 *   • UNCONFIRMED realization → surfaced in unconfirmedLines, never counted as $0-installed.
 *   • UNCONFIRMED ALLOCATION → basis_confidence (ESTIMATED/UNKNOWN) on an edge/assignment is
 *     a SEPARATE axis from the dollar's amountConfidence (§5.9). The $ figure may be CONFIRMED
 *     while the SPLIT is a guess — flagged in unconfirmedAllocations, the cost still counted.
 *   • Open assignment (end_at null) → allocated to asOf (last-known), flagged. No blocking
 *     demand for data entry (OP-6 tier c).
 *
 * SCOPE (SUB-2): pure traversal + seam feed. Reads graph rows passed in — NO DB, NO Supabase,
 *   NO React. The migration that defines these tables (20260615_cost_objects_rename_and_node_
 *   schema.sql) is gated/unapplied; this is proven in ISOLATION against the corpus fixture,
 *   matching the Core-2a spike pattern. Wiring the tile to read real rows is SUB-3.
 *
 * KNOWN OPEN SEAM (flagged, not closed — §5.2/§14): a DAG diamond (one node reaching the
 *   target by two distinct paths) attributes via BOTH paths. For a single target's downward
 *   cone that is usually CORRECT (each contribution edge is a real share); but a true double-
 *   count (same cost, same fraction, two paths) is surfaced as a flag, not silently merged —
 *   the seam's amount-based dedup cannot catch fraction-scaled copies. Path-cycle guard
 *   prevents infinite recursion.
 *
 * INSTRUMENTATION (STD-003): rollup() emits one `[TRACE:ROLLUP]` line per call — ON BY
 *   DEFAULT, unconditional. Matches the [TRACE:SEAM]/[TRACE:COST] uppercase-area convention.
 *   Commented out only after David owner-proves the tile through the real UI under RLS.
 *
 * OUTPUTS
 *   - CostObjectEdgeRow / CostObjectAssignmentRow — minimal projections of the two edge tables.
 *   - CostGraph                — { nodes, edges, assignments, asOf } the rollup runs over.
 *   - rollup(targetId, graph)  → NodeRollup: seam result + accumulated cost + contribution
 *                                provenance + flagged unconfirmed allocations + idle capital.
 */

import {
  enforceCountOnce,
  fromCostObject,
  type AmountConfidence,
  type CostEvent,
  type CostObjectNodeRow,
  type SeamResult,
} from './CountOnceSeam';

// ── Graph row projections (mirror cost_object_edges / cost_object_assignments) ───────

export interface CostObjectEdgeRow {
  id: string;
  parent_id: string;   // RECEIVES cost
  child_id: string;    // CONTRIBUTES cost
  edge_type: 'containment' | 'contribution';
  use_fraction: number;                 // 0 < f <= 1 (share of child cost crossing to parent)
  basis_confidence?: AmountConfidence | null;
}

export interface CostObjectAssignmentRow {
  id: string;
  asset_id: string;
  project_id: string;
  start_at: string;                     // ISO yyyy-mm-dd
  end_at?: string | null;               // null = open (currently assigned)
  conversion_cost?: number | null;      // §5.9 cost event on repurpose → receiving project
  basis_confidence?: AmountConfidence | null;
}

export interface CostGraph {
  nodes: CostObjectNodeRow[];
  edges: CostObjectEdgeRow[];
  assignments: CostObjectAssignmentRow[];
  /** "now" for open-period (end_at null) math — passed in (Date.now() is unavailable here). */
  asOf: string;
}

// ── Rollup output ────────────────────────────────────────────────────────────────────

export interface Contribution {
  fromId: string;
  via: 'self' | 'containment' | 'contribution' | 'assignment';
  /** structural use_fraction, or temporal period-share, or 1 for self. */
  fraction: number;
  basisConfidence: AmountConfidence | null;
  /** scaled events this contribution adds to the target. */
  events: CostEvent[];
}

export interface IdleCapital {
  assetId: string;
  label: string;
  idleFraction: number;             // fraction of the asset's life with no assignment
  idleCostKnown: number | null;     // asset known cost × idleFraction (null if asset cost UNKNOWN)
}

export interface NodeRollup {
  nodeId: string;
  label: string;
  nodeType: CostObjectNodeRow['node_type'];
  /** the count-once reconciliation of every attributed event (capex vs pool, dedup, residue). */
  seam: SeamResult;
  accumulatedKnown: number;         // seam.capexKnown + seam.poolKnownMonthly
  capexKnown: number;
  poolKnownMonthly: number;         // the monthly-breakdown figure (recurring attributed to node)
  contributions: Contribution[];    // provenance: who contributed what, how
  /** allocations whose SPLIT (not dollar) is unconfirmed — §5.9 basis_confidence axis. */
  unconfirmedAllocations: Array<{ via: string; fromId: string; basisConfidence: AmountConfidence }>;
  /** idle capital surfaced (asset life not attributed to any project — held by domain). */
  idle: IdleCapital[];
  flags: string[];                  // honest notes (open period, multi-path, cycle, missing node)
}

// ── helpers ────────────────────────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function days(a: string, b: string): number {
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.max(0, (db - da) / 86_400_000);
}

const WEAK: AmountConfidence[] = ['ESTIMATED', 'UNKNOWN'];

/** Scale a cost event's amount by a fraction. null stays null (UNKNOWN never becomes 0). */
function scaleEvent(e: CostEvent, fraction: number, tag: string): CostEvent {
  return {
    ...e,
    id: `${e.id}@${tag}`,
    amount: e.amount == null ? null : round2(e.amount * fraction),
    source: `${e.source}|×${fraction}`,
  };
}

// ── rollup() — traverse BOTH edge tables, feed the seam ──────────────────────────────

/**
 * Accumulated cost of `targetId`, traversing structural edges (use_fraction) AND temporal
 * assignments (period-share, §5.9), reconciled THROUGH the count-once seam.
 */
export function rollup(targetId: string, graph: CostGraph): NodeRollup {
  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const target = nodeById.get(targetId);
  if (!target) {
    throw new Error(`rollup: node ${targetId} not in graph`);
  }

  const contributions: Contribution[] = [];
  const unconfirmedAllocations: NodeRollup['unconfirmedAllocations'] = [];
  const idle: IdleCapital[] = [];
  const flags: string[] = [];

  /**
   * Gather the attributed events for `nodeId`, scaling by the accumulated `pathFraction`.
   * `path` is the set of node ids on the current branch (cycle guard). `tag` keeps scaled
   * ids unique per path so the seam does not treat path-copies as the same event by id.
   */
  function gather(nodeId: string, pathFraction: number, path: Set<string>, tag: string): CostEvent[] {
    const node = nodeById.get(nodeId);
    if (!node) {
      flags.push(`referenced node ${nodeId} is missing from the graph — skipped (cost not counted)`);
      return [];
    }
    if (path.has(nodeId)) {
      flags.push(`cycle detected at ${nodeId} — branch cut to prevent infinite rollup`);
      return [];
    }
    const branch = new Set(path).add(nodeId);
    const out: CostEvent[] = [];

    // (1) the node's OWN cost events (acquisition + any node-level conversion_cost).
    //     A PROJECT/PRODUCT has no acquisition_cost concept — its null-amount own event is
    //     N/A, NOT an honest UNKNOWN, so drop it (only an ASSET's null cost is a real
    //     unknown that must surface, e.g. the HP ProDesk). §5.4 "not every asset has a receipt".
    const own = fromCostObject(node)
      .filter((e) => !(e.amount == null && node.node_type !== 'ASSET'))
      .map((e) => (pathFraction === 1 ? e : scaleEvent(e, pathFraction, tag)));
    out.push(...own);
    if (nodeId === targetId) {
      contributions.push({ fromId: nodeId, via: 'self', fraction: 1, basisConfidence: null, events: own });
    }

    // (2) STRUCTURAL children — edges where this node RECEIVES (parent_id == nodeId).
    for (const edge of graph.edges.filter((e) => e.parent_id === nodeId)) {
      const childTag = `${tag}/${edge.id}`;
      const childEvents = gather(edge.child_id, pathFraction * edge.use_fraction, branch, childTag);
      out.push(...childEvents);
      contributions.push({
        fromId: edge.child_id,
        via: edge.edge_type,
        fraction: edge.use_fraction,
        basisConfidence: edge.basis_confidence ?? null,
        events: childEvents,
      });
      if (edge.basis_confidence && WEAK.includes(edge.basis_confidence)) {
        unconfirmedAllocations.push({ via: edge.edge_type, fromId: edge.child_id, basisConfidence: edge.basis_confidence });
      }
    }

    // (3) TEMPORAL assignments — this node is a PROJECT receiving asset cost by period-share.
    for (const asg of graph.assignments.filter((a) => a.project_id === nodeId)) {
      const asset = nodeById.get(asg.asset_id);
      if (!asset) {
        flags.push(`assignment ${asg.id} references missing asset ${asg.asset_id} — skipped`);
        continue;
      }
      const { share, open } = periodShare(asg, graph);
      if (open) flags.push(`assignment ${asg.id} (${asset.label} → ${node.label}) is OPEN — allocated to asOf ${graph.asOf}`);

      // asset's OWN cost (acquisition only — node conversion stays with the asset), period-shared.
      const assetTag = `${tag}/asg-${asg.id}`;
      const assetOwn = fromCostObject(asset).map((e) => scaleEvent(e, pathFraction * share, assetTag));
      out.push(...assetOwn);

      // conversion_cost is a §5.9 cost event on the RECEIVING project — NOT period-shared.
      const convEvents: CostEvent[] = [];
      if (asg.conversion_cost != null) {
        convEvents.push({
          id: `conv-${asg.id}@${tag}`,
          label: `${asset.label} → ${node.label} (conversion)`,
          amount: pathFraction === 1 ? asg.conversion_cost : round2(asg.conversion_cost * pathFraction),
          bucket: 'CAPEX',
          amountConfidence: 'ESTIMATED',
          substantiation: 'OWNER_ASSERTED',
          realization: 'REALIZED',
          source: `cost_object_assignments:${asg.id}#conversion`,
        });
      }
      out.push(...convEvents);

      contributions.push({
        fromId: asg.asset_id,
        via: 'assignment',
        fraction: round2(share),
        basisConfidence: asg.basis_confidence ?? null,
        events: [...assetOwn, ...convEvents],
      });
      if (asg.basis_confidence && WEAK.includes(asg.basis_confidence)) {
        unconfirmedAllocations.push({ via: 'assignment', fromId: asg.asset_id, basisConfidence: asg.basis_confidence });
      }

      // surface idle capital for this asset (life not covered by any assignment).
      const idleFraction = assetIdleFraction(asg.asset_id, graph);
      if (idleFraction > 0.0001 && !idle.some((i) => i.assetId === asg.asset_id)) {
        const acq = asset.acquisition_cost;
        idle.push({
          assetId: asg.asset_id,
          label: asset.label,
          idleFraction: round2(idleFraction),
          idleCostKnown: acq == null ? null : round2(acq * idleFraction),
        });
      }
    }

    return out;
  }

  const events = gather(targetId, 1, new Set<string>(), 't');
  const seam = enforceCountOnce(events);

  const result: NodeRollup = {
    nodeId: target.id,
    label: target.label,
    nodeType: target.node_type,
    seam,
    accumulatedKnown: round2(seam.capexKnown + seam.poolKnownMonthly),
    capexKnown: seam.capexKnown,
    poolKnownMonthly: seam.poolKnownMonthly,
    contributions,
    unconfirmedAllocations,
    idle,
    flags,
  };

  // [TRACE:ROLLUP] (STD-003, on by birth, unconditional). Matches [TRACE:SEAM] convention.
  console.log('[TRACE:ROLLUP] rollup', {
    node: target.id,
    type: target.node_type,
    accumulatedKnown: result.accumulatedKnown,
    capexKnown: result.capexKnown,
    poolKnownMonthly: result.poolKnownMonthly,
    contributions: contributions.length,
    unknown: seam.unknownLines.length,
    unconfirmed: seam.unconfirmedLines.length,
    unconfirmedAllocations: unconfirmedAllocations.length,
    idle: idle.length,
    flags: flags.length,
  });

  return result;
}

/**
 * Temporal share of an asset's cost that goes to ONE assignment: period_i / asset_life.
 * Life = [earliest start across the asset's assignments … asOf]. Open period ends at asOf.
 */
function periodShare(asg: CostObjectAssignmentRow, graph: CostGraph): { share: number; open: boolean } {
  const life = assetLifeDays(asg.asset_id, graph);
  if (life <= 0) return { share: 0, open: asg.end_at == null };
  const open = asg.end_at == null;
  const end = open ? graph.asOf : asg.end_at!;
  const dur = days(asg.start_at, end);
  return { share: dur / life, open };
}

function assetLifeDays(assetId: string, graph: CostGraph): number {
  const asgs = graph.assignments.filter((a) => a.asset_id === assetId);
  if (asgs.length === 0) return 0;
  const earliest = asgs.reduce((m, a) => (Date.parse(a.start_at) < Date.parse(m) ? a.start_at : m), asgs[0].start_at);
  return days(earliest, graph.asOf);
}

/** Fraction of the asset's life covered by NO assignment (idle / held by domain, §5.9). */
function assetIdleFraction(assetId: string, graph: CostGraph): number {
  const life = assetLifeDays(assetId, graph);
  if (life <= 0) return 0;
  const asgs = graph.assignments.filter((a) => a.asset_id === assetId);
  let assigned = 0;
  for (const a of asgs) {
    const end = a.end_at == null ? graph.asOf : a.end_at;
    assigned += days(a.start_at, end);
  }
  // assignments are assumed non-overlapping (sequential reuse, §5.9); clamp for safety.
  return Math.max(0, Math.min(1, (life - assigned) / life));
}
