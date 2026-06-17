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
 *   records are the same event — not THE key.
 *   Core-2a shipped a minimal body (receipt_id + coarse fallback). Core-2b (THUNDER ·
 *   2026-06-15) upgrades it IN PLACE to the full multi-signal matcher: three honest
 *   outcomes — MERGE | DISTINCT | NEED_CLARIFICATION — each carrying its epistemic bucket
 *   (D-9: KNOW/THINK/REASON/NEED-CLARIFICATION) + reasoning, plus the cost SHAPE
 *   (D-8: RECURRING_FIXED | PER_OCCASION). NEED_CLARIFICATION carries a SUGGESTED
 *   DISPOSITION (proposed home + question + candidates + reasoning) as DATA, phrased so
 *   acceptance is cheap. It does NOT build the accept/reject/edit workflow, the
 *   counting-on-acceptance wiring, or any UI — all downstream (#38). Still the single
 *   swappable function: only enforceCountOnce() consumes it.
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
 *   - sameCost(a, b)         — CostMatch: MERGE | DISTINCT | NEED_CLARIFICATION + bucket +
 *                              reasoning + cost shape (+ suggested disposition) (swappable).
 *   - classifyShape(e)       — D-8 cost shape of one event (RECURRING_FIXED | PER_OCCASION).
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

/**
 * Cost SHAPE (D-8 — usage-coupling). RECURRING_FIXED = a subscription billed on a
 * cadence REGARDLESS of use (gym, car-wash plan, SaaS seat). PER_OCCASION = a cost tied
 * to a discrete usage event (a single wash, a one-off part). UNKNOWN_SHAPE = not yet
 * determinable from the signals present. The shape decides whether two same-merchant
 * same-amount charges are two billings of one plan, two separate plans, or two washes.
 */
export type CostShape = 'RECURRING_FIXED' | 'PER_OCCASION' | 'UNKNOWN_SHAPE';

/**
 * Billing cadence hint, when known (from a subscription record / owner statement).
 * Absent cadence does NOT mean one-off — shape is then inferred from date spacing.
 */
export type Cadence = 'ONE_OFF' | 'WEEKLY' | 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

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
  /** Known billing cadence (D-8 shape hint). Absent → shape inferred from date spacing. */
  cadence?: Cadence | null;
  /** Provenance, e.g. 'cost_objects:<uuid>' | 'config.recurring'. */
  source: string;
}

// ── sameCost() — full multi-signal event matcher (Core-2b; honest outcomes) ─────────

/**
 * Three honest outcomes (Core-2b, replacing Core-2a's SAME/DIFFERENT/UNSURE):
 *   MERGE              — same event, corroborating signal → count once.
 *   DISTINCT           — different events → count both (incl. same merchant + amount on
 *                        DIFFERENT occasions — the under-count trap).
 *   NEED_CLARIFICATION — data-unresolvable; carries a suggested disposition so acceptance
 *                        is cheap (D-9). Treated downstream as flag-don't-merge (no under-count).
 */
export type MatchOutcome = 'MERGE' | 'DISTINCT' | 'NEED_CLARIFICATION';

/**
 * Epistemic bucket the verdict rides in (D-9 honesty contract).
 *   KNOW              — the data proves it (e.g. different receipt ids; same receipt + amount).
 *   REASON            — a defensible deduction from partial signals (e.g. amounts don't line up).
 *   THINK             — a best-guess inference (used inside a suggested disposition).
 *   NEED_CLARIFICATION— data cannot resolve it; the owner must decide.
 */
export type EpistemicBucket = 'KNOW' | 'THINK' | 'REASON' | 'NEED_CLARIFICATION';

/**
 * A proposed resolution for a NEED_CLARIFICATION, phrased to make acceptance cheap (D-9).
 * DATA ONLY — SUB-1 does not build the accept/reject/edit workflow (downstream, #38).
 */
export interface SuggestedDisposition {
  /** The home we propose if the owner just taps "yes" — the cheap-to-accept default. */
  proposed: MatchOutcome;
  /** Phrased so a tap confirms it; never a bare "is this a duplicate?". */
  question: string;
  /** The candidate interpretations the owner is choosing between. */
  candidates: string[];
  /** Why we propose what we propose (THINK-level). */
  reasoning: string;
}

/** The full verdict: outcome + epistemic bucket + reasoning + cost shape (+ suggestion). */
export interface CostMatch {
  outcome: MatchOutcome;
  bucket: EpistemicBucket;
  reasoning: string;
  /** D-8 cost shape of the relationship (recurring-fixed vs per-occasion). */
  shape: CostShape;
  /** The signal that drove the verdict — 'receipt_id' | 'amount' | 'merchant+amount+date' | 'merchant+amount+cadence'. */
  matchedOn: string;
  /** Present iff outcome === NEED_CLARIFICATION. */
  suggestion?: SuggestedDisposition;
}

/** Coarse-match tolerances. Deliberately conservative — over-merge silently drops cost. */
const AMOUNT_TOL = 0.02;        // dollars — same MATCH_TOLERANCE as Receipt Keeper
const DATE_PROX_DAYS = 3;       // same-purchase proximity window (card line vs its receipt)

/** Period windows (days) used to INFER a recurring cadence from date spacing. */
const PERIOD_WINDOWS: Array<{ cadence: Cadence; lo: number; hi: number }> = [
  { cadence: 'WEEKLY', lo: 6, hi: 8 },
  { cadence: 'MONTHLY', lo: 27, hi: 32 },
  { cadence: 'QUARTERLY', lo: 86, hi: 95 },
  { cadence: 'ANNUAL', lo: 358, hi: 372 },
];
const RECURRING_CADENCES: Cadence[] = ['WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL'];

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

/** Does a day-gap land in a recognized billing window? Returns the cadence or null. */
function gapToCadence(gap: number | null): Cadence | null {
  if (gap == null) return null;
  for (const w of PERIOD_WINDOWS) if (gap >= w.lo && gap <= w.hi) return w.cadence;
  return null;
}

/**
 * D-8 shape of a SINGLE event, from explicit cadence or its pool provenance.
 * UNKNOWN_SHAPE when nothing on the event itself reveals it (the pair matcher can still
 * infer a recurring shape from spacing — see sameCost).
 */
export function classifyShape(e: CostEvent): CostShape {
  if (e.cadence === 'ONE_OFF') return 'PER_OCCASION';
  if (e.cadence && RECURRING_CADENCES.includes(e.cadence)) return 'RECURRING_FIXED';
  if (e.bucket === 'MONTHLY_POOL') return 'RECURRING_FIXED'; // came from config.recurring[]
  return 'UNKNOWN_SHAPE';
}

/** Shape of the RELATIONSHIP between two events (explicit cadence wins; else infer from spacing). */
function shapeOfPair(a: CostEvent, b: CostEvent, gap: number | null): CostShape {
  const sa = classifyShape(a);
  const sb = classifyShape(b);
  if (sa === 'RECURRING_FIXED' || sb === 'RECURRING_FIXED') return 'RECURRING_FIXED';
  if (gapToCadence(gap)) return 'RECURRING_FIXED'; // periodic spacing → inferred subscription cadence
  if (sa === 'PER_OCCASION' && sb === 'PER_OCCASION') return 'PER_OCCASION';
  return 'UNKNOWN_SHAPE';
}

const merge = (reasoning: string, bucket: EpistemicBucket, shape: CostShape, matchedOn: string): CostMatch =>
  ({ outcome: 'MERGE', bucket, reasoning, shape, matchedOn });
const distinct = (reasoning: string, bucket: EpistemicBucket, shape: CostShape, matchedOn: string): CostMatch =>
  ({ outcome: 'DISTINCT', bucket, reasoning, shape, matchedOn });
const needClarification = (
  reasoning: string, shape: CostShape, matchedOn: string, suggestion: SuggestedDisposition,
): CostMatch => ({ outcome: 'NEED_CLARIFICATION', bucket: 'NEED_CLARIFICATION', reasoning, shape, matchedOn, suggestion });

/**
 * Are two events the SAME underlying cost? Returns an honest, reasoned verdict (D-9) with
 * the cost shape (D-8). EVENT — not receipt — is the unit of truth: ONE receipt holds MANY
 * line-item events (NSPanel and meross on one Amazon order), so receipt_id is a strong
 * SIGNAL, confirmed at the line level (amount) before collapsing.
 *
 * Decision order:
 *   1. receipt_id present on both → container rules (KNOW): different receipt → DISTINCT;
 *      same receipt + amount-close → MERGE; same receipt + amounts differ → DISTINCT (line
 *      items); same receipt + an amount unknown → NEED_CLARIFICATION.
 *   2. no shared receipt, amounts don't line up → DISTINCT (REASON).
 *   3. amounts line up + merchant/label match:
 *        a. RECURRING_FIXED shape (explicit cadence OR periodic spacing) → NEED_CLARIFICATION
 *           (one subscription across periods, or N separate subscriptions? — the under-count
 *           trap; never merge, never treat as per-occasion).
 *        b. within a few days → MERGE (one purchase corroborated by two records, e.g. card
 *           line + email receipt) (REASON).
 *        c. otherwise (irregular spacing) → NEED_CLARIFICATION (repeat purchase or dup record?).
 *   4. amounts line up but no merchant/label in common → NEED_CLARIFICATION (too weak to merge).
 */
export function sameCost(a: CostEvent, b: CostEvent): CostMatch {
  const gap = daysApart(a.date, b.date);
  const shape = shapeOfPair(a, b, gap);

  if (a.id === b.id) return merge('same event id', 'KNOW', shape, 'id');

  const bothAmountsKnown = a.amount != null && b.amount != null;
  const amountClose =
    bothAmountsKnown && Math.abs((a.amount as number) - (b.amount as number)) <= AMOUNT_TOL;

  // (1) receipt_id — strong signal, but a receipt is a CONTAINER of line events.
  if (a.receiptId && b.receiptId) {
    if (a.receiptId !== b.receiptId)
      return distinct('different receipt ids → different purchases', 'KNOW', shape, 'receipt_id');
    if (amountClose)
      return merge('same receipt + matching line amount → one line item recorded twice', 'KNOW', shape, 'receipt_id');
    if (bothAmountsKnown)
      return distinct('same receipt, different line amounts → distinct line items on one order', 'KNOW', shape, 'receipt_id');
    // same order, an amount UNKNOWN → can't confirm at the line level.
    return needClarification(
      'same order, but one amount is unknown — cannot confirm these are the same line item',
      shape, 'receipt_id',
      {
        proposed: 'DISTINCT',
        question: `Two charges on the same order (${a.label} / ${b.label}) — are these the same item recorded twice, or two different items?`,
        candidates: ['Same item, recorded twice (merge)', 'Two different items on one order (keep both)'],
        reasoning: 'Same receipt id but one line amount is unknown; default to keeping both so a real second cost is not silently dropped.',
      },
    );
  }

  // (2) no shared receipt — amounts must line up to even be considered the same cost.
  if (!amountClose)
    return distinct('amounts do not line up → different cost events', bothAmountsKnown ? 'KNOW' : 'REASON', shape, 'amount');

  // (3) amounts line up. Need a merchant/label identity signal too.
  const vendorMatch = norm(a.vendor) !== '' && norm(a.vendor) === norm(b.vendor);
  const labelMatch = norm(a.label) !== '' && norm(a.label) === norm(b.label);
  const identityMatch = vendorMatch || labelMatch;
  const who = norm(a.vendor) || norm(a.label) || 'this merchant';

  if (identityMatch) {
    // (3a) RECURRING_FIXED shape: same merchant + identical fixed amount on a cadence.
    //      The under-count trap — do NOT merge, do NOT treat as per-occasion. Ask.
    if (shape === 'RECURRING_FIXED') {
      const inferred = a.cadence ?? b.cadence ?? gapToCadence(gap) ?? 'MONTHLY';
      return needClarification(
        `same merchant + identical fixed amount on a ${inferred.toLowerCase()} cadence: a fixed recurring subscription billed regardless of use — could be one subscription across two periods, or two separate subscriptions on one card`,
        'RECURRING_FIXED', 'merchant+amount+cadence',
        {
          proposed: 'DISTINCT', // keep both → surfaces the full recurring cost; owner can collapse
          question: `Two ${who} charges of the same fixed amount — two separate subscriptions (e.g. two vehicles, or one business + one personal), or the same subscription seen across two billing periods?`,
          candidates: [
            'Two separate subscriptions (count both — e.g. two vehicles)',
            'One subscription, two billing periods (same recurring cost)',
          ],
          reasoning: 'A fixed amount billed on a regular cadence regardless of use is a recurring-fixed subscription. Whether it is one plan or several cannot be told from the charges alone; default to keeping both so the recurring cost is not under-counted.',
        },
      );
    }
    // (3b) same merchant + matching amount within a few days → one purchase, two records.
    if (gap != null && gap <= DATE_PROX_DAYS)
      return merge(
        'same merchant + matching amount within a few days → one purchase corroborated by two records (e.g. card line + email receipt)',
        'REASON', shape, 'merchant+amount+date',
      );
    // (3c) matches on merchant + amount but spacing is neither tight nor cleanly periodic.
    return needClarification(
      'same merchant and amount but the dates are neither close (one purchase) nor cleanly periodic (a subscription) — a repeat purchase or a duplicate record?',
      shape, 'merchant+amount',
      {
        proposed: 'DISTINCT',
        question: `Two ${who} charges of the same amount on different dates — a repeat purchase, or the same purchase recorded twice?`,
        candidates: ['Repeat purchase (keep both)', 'Duplicate record of one purchase (merge)'],
        reasoning: 'Identical amount and merchant but irregular spacing; default to keeping both so a real repeat cost is not silently dropped.',
      },
    );
  }

  // (4) amounts match but no merchant/label in common → too weak to merge on amount alone.
  return needClarification(
    'amounts match but nothing else (no shared merchant or label) — too weak a signal to merge',
    shape, 'amount',
    {
      proposed: 'DISTINCT',
      question: `Two unrelated-looking charges of the same amount (${a.label} / ${b.label}) — the same cost recorded twice, or a coincidence?`,
      candidates: ['Same cost, recorded twice (merge)', 'Two different costs that happen to match (keep both)'],
      reasoning: 'Only the amount matches; with no merchant or label in common this is most likely a coincidence — default to keeping both.',
    },
  );
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
  verdict: MatchOutcome;
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
  deduped: DedupRecord[];             // MERGE pairs collapsed (Shape 1 proof)
  // NEED_CLARIFICATION — flagged, NOT merged. Carries the full match (incl. suggested
  // disposition) so the downstream accept/reject workflow (#38) needs no recomputation.
  possibleDuplicates: Array<{ a: string; b: string; match?: CostMatch }>;
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
      const match = sameCost(a, b);
      if (match.outcome === 'MERGE') {
        // Keep the better-substantiated / higher-confidence representative.
        const loser = weaker(a, b);
        const keeper = loser.id === a.id ? b : a;
        dropped.add(loser.id);
        deduped.push({
          keptId: keeper.id,
          droppedId: loser.id,
          verdict: match.outcome,
          amount: loser.amount,
        });
        if (loser.id === a.id) break; // a is gone; move outer loop on
      } else if (match.outcome === 'NEED_CLARIFICATION') {
        // flag + carry the suggestion, do NOT drop (over-correction guard / under-count guard).
        possibleDuplicates.push({ a: a.id, b: b.id, match });
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
  node_type: 'ASSET' | 'PROJECT' | 'PRODUCT' | 'COST';
  domain?: string | null;
  acquisition_cost: number | null;   // null = UNKNOWN, never 0
  conversion_cost?: number | null;   // §5.9 cost event on repurpose
  cost_confidence: AmountConfidence;
  substantiation?: Substantiation;   // defaults OWNER_ASSERTED (no proof unless stated)
  status?: string | null;            // ASSET-only lifecycle (ACTIVE/IDLE/...); §5.9 separate columns
  project_status?: string | null;    // PROJECT-only (open/closed/converted) — migration 20260615
  product_status?: string | null;    // PRODUCT-only (active/retired) — migration 20260615
  realization?: Realization;
  receipt_id?: string | null;
  vendor?: string | null;
  acquired_on?: string | null;
  // ── Unified-cost-model fields (migration 20260617). Optional: ABSENT on every row
  //    until the migration is applied AND the read path selects them — so the default
  //    branch below (no shape) is byte-for-byte the prior CAPEX-only behavior. ──
  /** The six shapes (how money behaves). Absent/ONE_TIME → CAPEX; recurring → MONTHLY_POOL. */
  cost_shape?: CostShape | 'ONE_TIME' | 'PREPAID_AMORTIZED' | 'INCREMENTAL_PREPAID' | 'VARIABLE' | null;
  /** Billing cadence for recurring shapes. Used to normalize recurring_amount → monthly. */
  cadence?: Cadence | null;
  /** Per-cadence charge for recurring shapes — DISTINCT from acquisition_cost (capex). */
  recurring_amount?: number | null;
}

/** Recurring shapes feed the ÷N MONTHLY_POOL; everything else accumulates as CAPEX. */
const RECURRING_SHAPES = new Set(['RECURRING_FIXED', 'PER_OCCASION']);

/** Per-period charge → monthly. ONE_OFF/absent passes through (treated as already-monthly). */
function cadenceToMonthly(amount: number, cadence: Cadence | null | undefined): number {
  switch (cadence) {
    case 'WEEKLY':    return amount * 52 / 12;
    case 'QUARTERLY': return amount / 3;
    case 'ANNUAL':    return amount / 12;
    case 'MONTHLY':
    case 'ONE_OFF':
    default:          return amount; // MONTHLY (or unknown cadence) is already a monthly figure
  }
}

/**
 * A cost_objects node → CostEvent(s), SHAPE-AWARE (migration 20260617).
 *
 *   • RECURRING_FIXED / PER_OCCASION → ONE MONTHLY_POOL event from recurring_amount,
 *     normalized to monthly by cadence. This is the period-pool feed (÷N denominator).
 *   • ONE_TIME / PREPAID_AMORTIZED / INCREMENTAL_PREPAID / VARIABLE / absent → CAPEX
 *     from acquisition_cost (+ conversion_cost) exactly as before. Capex never divides
 *     into the monthly pool (Shape 2).
 *
 * BYTE-IDENTICAL GUARANTEE: until the 20260617 migration is applied AND the read path
 * selects cost_shape, every row arrives with cost_shape ABSENT → the CAPEX branch →
 * identical to the prior implementation. The recurring branch is dormant until then.
 */
export function fromCostObject(row: CostObjectNodeRow): CostEvent[] {
  const base = {
    substantiation: row.substantiation ?? 'OWNER_ASSERTED',
    realization: row.realization ?? 'REALIZED',
    receiptId: row.receipt_id ?? null,
    vendor: row.vendor ?? null,
    date: row.acquired_on ?? null,
    source: `cost_objects:${row.id}`,
  };

  // ── Recurring shapes → the monthly pool (the $0-collapse pivot: a migrated
  //    recurring cost must feed ÷N, not CAPEX). recurring_amount, NOT acquisition_cost. ──
  if (row.cost_shape && RECURRING_SHAPES.has(row.cost_shape)) {
    const monthly = row.recurring_amount == null
      ? null // UNKNOWN amount — never coerced to 0 (Surface Honesty)
      // Unrounded — mirrors the config path's toMonthly (CostToProduce.ts); the seam
      // round2s the aggregate (poolEstimatedMonthly), so per-event rounding here would
      // risk diverging from the config-derived before-number. Equivalence by construction.
      : cadenceToMonthly(row.recurring_amount, row.cadence);
    return [{
      ...base,
      id: row.id,
      label: row.label,
      amount: monthly,
      bucket: 'MONTHLY_POOL',
      amountConfidence: row.cost_confidence,
      cadence: row.cadence ?? null,
    }];
  }

  // ── Default: CAPEX (one-time capital). Unchanged from the prior implementation. ──
  const capexBase = { ...base, bucket: 'CAPEX' as const };
  const events: CostEvent[] = [
    {
      ...capexBase,
      id: row.id,
      label: row.label,
      amount: row.acquisition_cost,
      amountConfidence: row.cost_confidence,
    },
  ];
  if (row.conversion_cost != null) {
    events.push({
      ...capexBase,
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
