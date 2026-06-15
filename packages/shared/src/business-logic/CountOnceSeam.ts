/**
 * ── COUNT-ONCE SLICE SEAM (shared, general) · THUNDER Core-2a SPIKE · 2026-06-15 ──
 *
 * PURPOSE
 *   The accumulator → period-pool slice is the HIGHEST-RISK seam in the whole
 *   cost-to-produce arc (COST-TO-PRODUCE-DESIGN.md §14 SLICE SEAM — "highest-risk
 *   edge in the entire system"). §14 states the no-double-count rule as INTENT
 *   (§3 query-time, §5.4 source-of-truth, §5.2 DAG); it names ONE concrete signal
 *   (`receipt_id`). It does NOT hand us a mechanism. This module IMPLEMENTS the
 *   count-once rule as a query-time reconciliation gate over cost EVENTS.
 *
 *   It enforces exactly the two double-count shapes §14 calls out:
 *     Shape 1 — the same cost present in BOTH the accumulator (cost_objects) AND
 *               the period pool (config.recurring[]) → counted ONCE.
 *     Shape 2 — CAPEX (acquisition_cost / conversion_cost on an ASSET node) leaking
 *               into the ÷N MONTHLY pool as if it were recurring → BARRED from the pool.
 *
 *   It is a SPIKE (Core-2a), proven in ISOLATION against real CoolRunnings data.
 *   It does NOT build the rollup, wire the tile-feed, or read the DB. Pure functions.
 *
 * TWO INDEPENDENT AXES (David, 2026-06-15 — do NOT collapse; Core-2b needs both):
 *   - amountConfidence: CONFIRMED | DERIVED | ESTIMATED | UNKNOWN (sure of the $ figure)
 *   - substantiation:   SUBSTANTIATED (has a receipt/document) | OWNER_ASSERTED (typed,
 *                       no proof). The seam COUNTS owner-asserted cost (surfacing true
 *                       cost-to-operate is the point) AND preserves the flag so a later
 *                       layer can distinguish "counted + substantiated" from
 *                       "counted + at-risk". We make cost visible; we make NO tax /
 *                       deductibility claim (design §1/§2 boundary).
 *
 * EVENT, NOT RECEIPT, IS THE UNIT OF TRUTH (David, 2026-06-15):
 *   sameCost() matches cost EVENTS. receipt_id is ONE high-confidence signal that two
 *   records are the same event — not THE key. Minimal here: match on receipt_id where
 *   both carry one; coarse event-identity fallback (vendor/label + amount + date
 *   proximity) otherwise; FLAG-don't-merge when unsure. Single swappable function.
 *   Full multi-signal reconcile is Core-2b — NOT this spike.
 *
 * GRACEFUL DEGRADATION (OP-5 / OP-6): produces an HONEST number when the owner does
 *   NOTHING. UNKNOWN amounts are surfaced, never zeroed. UNCONFIRMED-realization
 *   ("is this even a cost yet?") is surfaced as uncertainty, never a silent $0 that
 *   reads as "free". Over-correction that silently DROPS a real cost is a failure
 *   (moat-killer) — the seam errs toward surfacing, flagging the ambiguous.
 *
 * DEPENDENCIES
 *   - ./CostToProduce (CostConfidence type only). No DB, no Supabase, no React,
 *     no vertical imports. Pure functions.
 *
 * INSTRUMENTATION (STD-003): enforceCountOnce() emits one `[TRACE:SEAM] reconcile`
 *   line per call — ON BY DEFAULT, unconditional (no env-gate). Matches the existing
 *   `[TRACE:COST]` uppercase-area convention. Stays on until David owner-proves the
 *   seam through the real UI under RLS; only then commented out, not deleted.
 *
 * OUTPUTS
 *   - CostEvent              — the event-granular unit the seam reconciles.
 *   - sameCost(a, b)         — SAME | DIFFERENT | UNSURE event-identity verdict (swappable).
 *   - enforceCountOnce(evts) — SeamResult: capex (separate) + monthly pool + honest
 *                              residue (unknown / unconfirmed / net-zero / possible-dups),
 *                              both axes preserved on every counted event.
 *   - fromCostObject / fromRecurringLine — adapters: cost_objects node / config.recurring
 *                              line → CostEvent (so the seam runs against either source).
 */

import type { CostConfidence } from './CostToProduce';

// ── Axes + event vocab ─────────────────────────────────────────────────────────────

/** How sure of the DOLLAR figure (mirrors cost_objects.cost_confidence CHECK). */
export type AmountConfidence = CostConfidence; // CONFIRMED | DERIVED | ESTIMATED | UNKNOWN

/** Independent of amount: is there a receipt/document, or is it typed-from-memory? */
export type Substantiation = 'SUBSTANTIATED' | 'OWNER_ASSERTED';

/** Is this even a cost yet? UNCONFIRMED = status-conflict / planned-or-installed unknown. */
export type Realization = 'REALIZED' | 'UNCONFIRMED';

/** CAPEX never divides into the ÷N monthly pool; MONTHLY_POOL is the denominator feed. */
export type CostBucket = 'CAPEX' | 'MONTHLY_POOL';

/** The unit of truth. A cost EVENT — from a node, a recurring line, or a reversal. */
export interface CostEvent {
  id: string;
  label: string;
  /** null = UNKNOWN amount. NEVER coerce null → 0 (Surface Honesty). Reversals are negative. */
  amount: number | null;
  bucket: CostBucket;
  amountConfidence: AmountConfidence;
  substantiation: Substantiation;
  /** Defaults to REALIZED when omitted. */
  realization?: Realization;
  // ── event-identity signals for sameCost() ──
  receiptId?: string | null;
  vendor?: string | null;
  /** ISO yyyy-mm-dd. */
  date?: string | null;
  /** Links a refund/return event to the id of the purchase it reverses. */
  reversalOf?: string | null;
  /** Provenance, e.g. 'cost_objects:<uuid>' | 'config.recurring'. */
  source: string;
}

// ── sameCost() — event-identity matcher (SWAPPABLE; full reconcile = Core-2b) ───────

export type SameCostVerdict = 'SAME' | 'DIFFERENT' | 'UNSURE';

/** Coarse-match tolerances. Deliberately conservative — over-merge silently drops cost. */
const AMOUNT_TOL = 0.02;        // dollars — same MATCH_TOLERANCE as Receipt Keeper
const DATE_PROX_DAYS = 3;       // event-date proximity window

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase();
}

function daysApart(a: string | null | undefined, b: string | null | undefined): number | null {
  if (!a || !b) return null;
  const da = Date.parse(a);
  const db = Date.parse(b);
  if (Number.isNaN(da) || Number.isNaN(db)) return null;
  return Math.abs(da - db) / 86_400_000;
}

/**
 * Are two events the SAME underlying cost?
 *
 * EVENT, not receipt, is the unit of truth: ONE receipt holds MANY line-item events
 * (NSPanel and meross on the same Amazon order). So receipt_id is a strong SIGNAL, not
 * the identity — equal receipt_id must be CONFIRMED at the line level (amount) before
 * collapsing two events, or two distinct items on one order would be wrongly merged.
 *
 *   1. same receipt_id + amount-close → SAME (same line item / same cost recorded twice).
 *   1b. same receipt_id + amounts differ (both known) → DIFFERENT (distinct line items).
 *   1c. same receipt_id + an amount UNKNOWN → UNSURE (can't confirm at line level).
 *   1d. different receipt_id (both present) → DIFFERENT.
 *   2. no shared receipt → coarse fallback: (vendor OR label) + amount-close + date-close → SAME.
 *   3. partial overlap → UNSURE (flag, do NOT merge — over-correction drops real cost).
 *   4. otherwise → DIFFERENT.
 * Single swappable function: Core-2b replaces the body with full multi-signal reconcile.
 */
export function sameCost(a: CostEvent, b: CostEvent): SameCostVerdict {
  if (a.id === b.id) return 'SAME';

  const bothAmountsKnown = a.amount != null && b.amount != null;
  const amountClose =
    bothAmountsKnown && Math.abs((a.amount as number) - (b.amount as number)) <= AMOUNT_TOL;

  // (1) receipt_id — strong signal, but a receipt is a CONTAINER of line events.
  if (a.receiptId && b.receiptId) {
    if (a.receiptId !== b.receiptId) return 'DIFFERENT';   // (1d)
    if (amountClose) return 'SAME';                         // (1) same receipt, same line
    if (bothAmountsKnown) return 'DIFFERENT';               // (1b) distinct line items
    return 'UNSURE';                                        // (1c) can't confirm at line level
  }

  // (2)/(3) coarse fallback. UNKNOWN amounts can't be amount-matched → never auto-merge.
  const vendorMatch = norm(a.vendor) !== '' && norm(a.vendor) === norm(b.vendor);
  const labelMatch = norm(a.label) !== '' && norm(a.label) === norm(b.label);
  const gap = daysApart(a.date, b.date);
  const dateClose = gap != null && gap <= DATE_PROX_DAYS;

  if (!amountClose) return 'DIFFERENT';                 // amount must line up to even consider
  if ((vendorMatch || labelMatch) && dateClose) return 'SAME';
  if (vendorMatch || labelMatch) return 'UNSURE';       // amount lines up, weak identity → flag
  return 'DIFFERENT';
}

// ── Result shape ────────────────────────────────────────────────────────────────────

const FLOOR_GRADES: AmountConfidence[] = ['CONFIRMED', 'DERIVED'];

export interface CountedEvent {
  id: string;
  label: string;
  amount: number;              // net (reversals applied); only quantified events land here
  bucket: CostBucket;
  amountConfidence: AmountConfidence;
  substantiation: Substantiation;
  source: string;
}

export interface ResidueLine {
  id: string;
  label: string;
  amountConfidence: AmountConfidence;
  substantiation: Substantiation;
  source: string;
  /** For UNCONFIRMED lines: the estimate, if any, carried WITHOUT counting it. */
  estimate?: number | null;
  note?: string;
}

export interface DedupRecord {
  keptId: string;
  droppedId: string;
  verdict: SameCostVerdict;
  amount: number | null;
}

export interface SeamResult {
  // ── CAPEX (one-time capital — NEVER divides into the ÷N monthly pool) ──
  capexFloor: number;          // CONFIRMED + DERIVED
  capexEstimated: number;      // ESTIMATED
  capexKnown: number;          // floor + estimated
  // ── MONTHLY POOL (the ÷N denominator feed) ──
  poolFloorMonthly: number;
  poolEstimatedMonthly: number;
  poolKnownMonthly: number;
  // ── honest residue — surfaced, NEVER zeroed/dropped ──
  unknownLines: ResidueLine[];        // amount UNKNOWN
  unconfirmedLines: ResidueLine[];    // not-yet-a-cost (realization UNCONFIRMED)
  // ── count-once provenance ──
  counted: CountedEvent[];            // every quantified, realized, deduped event (both axes)
  deduped: DedupRecord[];             // SAME pairs collapsed (Shape 1 proof)
  possibleDuplicates: Array<{ a: string; b: string }>; // UNSURE — flagged, NOT merged
  netZeroPairs: Array<{ purchaseId: string; reversalId: string; net: number }>;
  // ── substantiation rollup (the second axis, preserved to output) ──
  substantiatedTotal: number;         // counted $ that has a receipt/document
  ownerAssertedTotal: number;         // counted $ that is at-risk (no proof)
}

// ── enforceCountOnce() — the seam ────────────────────────────────────────────────────

/**
 * Reconcile a flat list of cost EVENTS into a count-once-correct picture.
 * Order of operations matters:
 *   1. Net reversals (purchase + return → net) so a returned item nets to $0 in its bucket.
 *   2. Dedup SAME events (Shape 1) — keep the best-substantiated representative; flag UNSURE.
 *   3. Route: UNKNOWN amount → unknownLines; UNCONFIRMED realization → unconfirmedLines.
 *   4. Bucket the rest: CAPEX stays out of the monthly pool (Shape 2); MONTHLY_POOL feeds ÷N.
 *   5. Preserve BOTH axes on every counted event + roll up substantiated vs owner-asserted.
 */
export function enforceCountOnce(events: CostEvent[]): SeamResult {
  // ── 1. Reversals: pair each refund with the purchase it reverses, net them. ──
  const byId = new Map(events.map((e) => [e.id, e]));
  const netZeroPairs: SeamResult['netZeroPairs'] = [];
  const reversalApplied = new Set<string>(); // ids consumed by netting
  const netAmount = new Map<string, number>(); // eventId → net amount after reversals

  for (const e of events) {
    if (e.reversalOf && byId.has(e.reversalOf) && e.amount != null) {
      const target = byId.get(e.reversalOf)!;
      const base = target.amount ?? 0;
      const net = base + e.amount; // reversal amount is negative
      netAmount.set(target.id, net);
      reversalApplied.add(e.id);   // the reversal event itself is consumed, not double-listed
      netZeroPairs.push({ purchaseId: target.id, reversalId: e.id, net: round2(net) });
    }
  }

  // Working set = original events minus reversal events (folded into their targets).
  const working = events.filter((e) => !reversalApplied.has(e.id));

  // ── 2. Dedup SAME events (Shape 1). ──
  const dropped = new Set<string>();
  const deduped: DedupRecord[] = [];
  const possibleDuplicates: SeamResult['possibleDuplicates'] = [];
  for (let i = 0; i < working.length; i++) {
    const a = working[i];
    if (dropped.has(a.id)) continue;
    for (let j = i + 1; j < working.length; j++) {
      const b = working[j];
      if (dropped.has(b.id)) continue;
      const verdict = sameCost(a, b);
      if (verdict === 'SAME') {
        // Keep the better-substantiated / higher-confidence representative.
        const loser = weaker(a, b);
        const keeper = loser.id === a.id ? b : a;
        dropped.add(loser.id);
        deduped.push({
          keptId: keeper.id,
          droppedId: loser.id,
          verdict,
          amount: loser.amount,
        });
        if (loser.id === a.id) break; // a is gone; move outer loop on
      } else if (verdict === 'UNSURE') {
        possibleDuplicates.push({ a: a.id, b: b.id }); // flag, do NOT drop (over-correction guard)
      }
    }
  }
  const survivors = working.filter((e) => !dropped.has(e.id));

  // ── 3 + 4 + 5. Route survivors. ──
  let capexFloor = 0;
  let capexEstimated = 0;
  let poolFloorMonthly = 0;
  let poolEstimatedMonthly = 0;
  let substantiatedTotal = 0;
  let ownerAssertedTotal = 0;
  const unknownLines: ResidueLine[] = [];
  const unconfirmedLines: ResidueLine[] = [];
  const counted: CountedEvent[] = [];

  for (const e of survivors) {
    const amount = netAmount.has(e.id) ? netAmount.get(e.id)! : e.amount;
    const realization = e.realization ?? 'REALIZED';

    // (3a) Not-yet-a-cost: surface uncertainty, NEVER count as $0-installed.
    if (realization === 'UNCONFIRMED') {
      unconfirmedLines.push({
        id: e.id, label: e.label, amountConfidence: e.amountConfidence,
        substantiation: e.substantiation, source: e.source, estimate: amount,
        note: 'unconfirmed whether this is a cost yet — not counted, not zeroed',
      });
      continue;
    }

    // (3b) UNKNOWN amount: surface as a floor-raiser count, NEVER zeroed.
    if (amount == null || e.amountConfidence === 'UNKNOWN') {
      unknownLines.push({
        id: e.id, label: e.label, amountConfidence: 'UNKNOWN',
        substantiation: e.substantiation, source: e.source, estimate: amount,
      });
      continue;
    }

    // (4) Quantified + realized → count once, in the right bucket.
    counted.push({
      id: e.id, label: e.label, amount: round2(amount), bucket: e.bucket,
      amountConfidence: e.amountConfidence, substantiation: e.substantiation, source: e.source,
    });

    const isFloor = FLOOR_GRADES.includes(e.amountConfidence);
    if (e.bucket === 'CAPEX') {
      if (isFloor) capexFloor += amount;
      else capexEstimated += amount;
    } else {
      if (isFloor) poolFloorMonthly += amount;
      else poolEstimatedMonthly += amount;
    }

    // (5) Second axis: substantiated vs counted-but-at-risk.
    if (e.substantiation === 'SUBSTANTIATED') substantiatedTotal += amount;
    else ownerAssertedTotal += amount;
  }

  const result: SeamResult = {
    capexFloor: round2(capexFloor),
    capexEstimated: round2(capexEstimated),
    capexKnown: round2(capexFloor + capexEstimated),
    poolFloorMonthly: round2(poolFloorMonthly),
    poolEstimatedMonthly: round2(poolEstimatedMonthly),
    poolKnownMonthly: round2(poolFloorMonthly + poolEstimatedMonthly),
    unknownLines,
    unconfirmedLines,
    counted,
    deduped,
    possibleDuplicates,
    netZeroPairs,
    substantiatedTotal: round2(substantiatedTotal),
    ownerAssertedTotal: round2(ownerAssertedTotal),
  };

  // [TRACE:SEAM] (STD-003, on by birth, unconditional — commented out only after David
  // owner-proves the seam through the real UI under RLS). Matches [TRACE:COST] convention.
  console.log('[TRACE:SEAM] reconcile', {
    eventsIn: events.length,
    survivors: survivors.length,
    capexKnown: result.capexKnown,
    poolKnownMonthly: result.poolKnownMonthly,
    unknown: result.unknownLines.length,
    unconfirmed: result.unconfirmedLines.length,
    deduped: result.deduped.length,
    possibleDuplicates: result.possibleDuplicates.length,
    netZeroPairs: result.netZeroPairs.length,
    substantiated: result.substantiatedTotal,
    ownerAsserted: result.ownerAssertedTotal,
  });

  return result;
}

/** Lower substantiation, then lower amount-confidence, then no-receipt = the weaker (dropped) one. */
function weaker(a: CostEvent, b: CostEvent): CostEvent {
  const subRank = (e: CostEvent) => (e.substantiation === 'SUBSTANTIATED' ? 1 : 0);
  const confRank = (e: CostEvent) =>
    ({ CONFIRMED: 3, DERIVED: 2, ESTIMATED: 1, UNKNOWN: 0 }[e.amountConfidence]);
  if (subRank(a) !== subRank(b)) return subRank(a) < subRank(b) ? a : b;
  if (confRank(a) !== confRank(b)) return confRank(a) < confRank(b) ? a : b;
  if (!!a.receiptId !== !!b.receiptId) return a.receiptId ? b : a;
  return b; // arbitrary, stable
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ── Adapters — cost_objects node / config.recurring line → CostEvent ─────────────────

/** Minimal projection of a cost_objects ASSET row (the columns the seam reads). */
export interface CostObjectNodeRow {
  id: string;
  label: string;
  node_type: 'ASSET' | 'PROJECT' | 'PRODUCT';
  domain?: string | null;
  acquisition_cost: number | null;   // null = UNKNOWN, never 0
  conversion_cost?: number | null;   // §5.9 cost event on repurpose
  cost_confidence: AmountConfidence;
  substantiation?: Substantiation;   // defaults OWNER_ASSERTED (no proof unless stated)
  status?: string | null;            // ACTIVE/IDLE/... ; UNCONFIRMED-ish → realization
  realization?: Realization;
  receipt_id?: string | null;
  vendor?: string | null;
  acquired_on?: string | null;
}

/**
 * A cost_objects node → CAPEX event(s). acquisition_cost is the node's capital cost;
 * conversion_cost (if present) is a second capital event. Both are CAPEX — they
 * accumulate on the node and NEVER divide into the monthly pool (Shape 2).
 */
export function fromCostObject(row: CostObjectNodeRow): CostEvent[] {
  const base = {
    bucket: 'CAPEX' as const,
    substantiation: row.substantiation ?? 'OWNER_ASSERTED',
    realization: row.realization ?? 'REALIZED',
    receiptId: row.receipt_id ?? null,
    vendor: row.vendor ?? null,
    date: row.acquired_on ?? null,
    source: `cost_objects:${row.id}`,
  };
  const events: CostEvent[] = [
    {
      ...base,
      id: row.id,
      label: row.label,
      amount: row.acquisition_cost,
      amountConfidence: row.cost_confidence,
    },
  ];
  if (row.conversion_cost != null) {
    events.push({
      ...base,
      id: `${row.id}:conversion`,
      label: `${row.label} (conversion)`,
      amount: row.conversion_cost,
      amountConfidence: row.cost_confidence,
    });
  }
  return events;
}

/** Minimal projection of a config.recurring[] line (period-pool side). */
export interface RecurringLineRow {
  id: string;
  label: string;
  monthlyAmount: number | null;
  confidence: AmountConfidence;
  substantiation?: Substantiation;
  receiptId?: string | null;
  vendor?: string | null;
  date?: string | null;
}

/** A config.recurring[] line → MONTHLY_POOL event (the ÷N denominator feed). */
export function fromRecurringLine(row: RecurringLineRow): CostEvent {
  return {
    id: row.id,
    label: row.label,
    amount: row.monthlyAmount,
    bucket: 'MONTHLY_POOL',
    amountConfidence: row.confidence,
    substantiation: row.substantiation ?? 'OWNER_ASSERTED',
    realization: 'REALIZED',
    receiptId: row.receiptId ?? null,
    vendor: row.vendor ?? null,
    date: row.date ?? null,
    source: 'config.recurring',
  };
}
