// ============================================================
// reconcileMath — the count-vs-book DECISION, pure and in ONE place (D-50 reconcile reader).
// PURPOSE:  A physical count is an OBSERVATION. Reconciling it against the book is arithmetic
//           plus a human's account of the gap. This module owns BOTH and performs NO IO — the
//           page does the RPC calls this returns. Extracted pure for the same reason
//           countPromote.ts was (D-49): the arithmetic that decides what gets written to an
//           APPEND-ONLY log must be testable without a database, because a wrong row cannot
//           be retracted.
// DEPENDENCIES: none. No React, no supabase, no business context.
// OUTPUTS:  ReconcileMode · reconcileRow() (the math + evidence) · buildWritePlan() (the
//           ordered RPC steps an Accept performs).
// AC-1:     generic — no vertical noun. This is the platform reconcile model.
//
// ── THE TWO CORRECTIONS THIS MODULE MAKES TO THE BUILD SPEC (2026-07-21) ────────────────────
//
// (A) EXPECTED IS A FULL REPLAY, NOT "PRIOR COUNT MINUS SALES".
//     The spec said `expected = prior-count-onhand − SUM(sale events since)`. The ledger records
//     EVERY movement — receive · dead · loss · found · adjust · delete_tombstone · rescan_clear —
//     not only sales. Subtracting sales alone makes any non-sale movement in the window surface as
//     a residual: a +10 receive becomes a −10 gap the owner is asked to explain as shrinkage that
//     never happened. That is D-9 inverted — it mis-attributes a REAL movement rather than
//     fabricating one, and it asks a human to account for the system's own arithmetic error.
//     The correct replay sums ALL deltas in the window. D-50 LAYER 1 owner-proved
//     `qty == SUM(delta)` with ZERO drift (V3(b), 126/126 lots), so that replay lands on book
//     on-hand by construction — which is why `expected` and `bookOnHand` normally agree.
//     We compute BOTH anyway and compare (`bookAgreesWithReplay`): where they disagree, the
//     ledger's own guarantee has broken, and that is a fact to SURFACE, not to average away.
//     The modes therefore differ in EVIDENCE and ATTRIBUTION, never in arithmetic.
//
// (B) ATTRIBUTION SPLITS THE DELTA — IT DOES NOT ADD A SECOND ONE.
//     The spec said Accept writes `count_reconcile` for the on-hand change AND each attributed
//     portion writes its own `dead`/`loss` adjust. Both RPCs MOVE QTY (`count_reconcile_inventory`
//     sets on-hand to counted and absorbs the whole delta; `adjust_inventory_manual` then moves it
//     AGAIN). Run in sequence they decrement twice — inventing shrinkage in a log that cannot be
//     retracted. So the delta is SPLIT: each attributed cause writes its own qty-moving event, and
//     the UNEXPLAINED remainder lands on the closing `count_reconcile`. The steps sum to exactly
//     `counted − book`, every cause gets its own permanent dated line (which is what D-50's story
//     asks for — "4 dead, 3 unexplained loss"), and the closing event is still the human's
//     "I physically verified this number" stamp.
// ============================================================

/** No prior count on this lot → the count IS the truth, there is no window to explain. */
export type ReconcileMode = 'baseline' | 'delta';

/** A ledger row as this screen reads it. Base-table columns ONLY — deliberately NOT
 *  `aggregate_type`/`event_type`, which live in the still-GATED 20260720_ledger_event_store
 *  migration. Reading a column that may not exist live would break the page on a deploy the
 *  owner has not applied yet; `kind` is the same fact and has been live since LAYER 1. */
export interface LedgerMovement {
  id: string;
  kind: string;
  delta: number;
  occurred_at: string;
  reason: string | null;
  source_type: string | null;
  source_id: string | null;
  actor_user_id: string | null;
}

export interface PriorCount {
  counted_qty: number;
  counted_at: string;
}

/** Net movement per kind, for the evidence strip ("3 sold since last count"). */
export interface MovementSummary {
  kind: string;
  net: number;      // signed
  events: number;
}

interface ReconcileInput {
  bookOnHand: number;
  committed: number;
  prior: PriorCount | null;
  /** Ledger rows with occurred_at > prior.counted_at. Empty in baseline mode. */
  movementsSincePrior: LedgerMovement[];
  /** null = the owner has not entered a count yet. */
  counted: number | null;
}

export interface ReconcileResult {
  mode: ReconcileMode;
  available: number;
  /** What the book says should be on hand. See correction (A). */
  expected: number;
  /** counted − expected. null until a count is entered. */
  residual: number | null;
  /** prior_counted + SUM(all deltas in window). null in baseline mode (no window to replay). */
  replayExpected: number | null;
  /** false = the ledger's `qty == SUM(delta)` guarantee has broken for this lot. Surface it. */
  bookAgreesWithReplay: boolean;
  evidence: MovementSummary[];
  varianceFlag: boolean;
  /** A nonzero residual in DELTA mode wants a human account. Baseline never does — there is no
   *  history to explain a first count against (correction: the spec's own "informational, no
   *  attribution required" for baseline, made explicit as a flag the UI reads). */
  attributionRequired: boolean;
}

// ── Variance thresholds ─────────────────────────────────────────────────────────────────────
// JUDGEMENT CALL, flagged for David (§6 r10 — a number we chose, not one a standard gave us).
// The catch this must not miss is "13 counted against 30 expected": a proportion, not a count.
// A pure ratio alone flags noise on tiny lots (1 of 2 = 50%); a pure absolute alone misses a
// 43% hole on a 30-lot. So: BOTH must trip, with an absolute ceiling that always trips because
// 50 units missing is worth a look regardless of lot size.
const VARIANCE_MIN_UNITS = 5;
const VARIANCE_RATIO = 0.2;
const VARIANCE_ALWAYS_UNITS = 50;

export function isVariance(residual: number, expected: number): boolean {
  const mag = Math.abs(residual);
  if (mag >= VARIANCE_ALWAYS_UNITS) return true;
  if (mag < VARIANCE_MIN_UNITS) return false;
  return mag / Math.max(expected, 1) >= VARIANCE_RATIO;
}

// AVAILABLE has exactly ONE definition, in inventoryStates (D-52 / §6 r8). It is imported here,
// never re-exported: a re-export would be a second door onto one fact, and the next caller would
// have two places to import it from — which is how two definitions eventually appear.
import { availableFrom as available } from './inventoryStates';

/**
 * Does this ledger row record a CHANGE, or assert a POSITION?
 *
 * `opening_balance` asserts a position — "this lot stood at N when the ledger adopted it". It is
 * NOT a movement, and replaying it on top of a prior count adds the entire stock a second time.
 *
 * ── THE LIVE DEFECT THIS FIXES (2026-07-22, lot 3ec53db3 Shoal Creek Vitex 45) ──────────────
 * The screen read "the ledger replays to 120 but the book says 60" against a true replay of 58.
 * It looked like an exact doubling, and the reported hypothesis was that the replay summed both
 * the base table and the D-51 read-view. It did not — there is ONE read, of the base table.
 *
 * The real cause is that the D-50 genesis backfill dates every opening_balance at `now()` —
 * MIGRATION-APPLY TIME (`20260720_inventory_movement_ledger.sql:360`), not the lot's origin. So
 * for any lot last counted BEFORE 2026-07-20, the genesis row falls INSIDE the since-that-count
 * window and gets replayed as if the stock had just arrived:
 *
 *     prior count 60  +  genesis opening_balance +60  =  120   vs book 60
 *
 * It reads as a clean 2× only because genesis `delta = bi.qty` = current on-hand, which for a lot
 * untouched since its last count IS `prior.counted_qty`. Two different numbers that happen to be
 * equal — which is exactly how a doubling illusion is manufactured out of a single read.
 *
 * Excluding it is correct in EVERY case, not a patch for the synthetic date: a genesis row older
 * than the window is already excluded by date, and a lot born AFTER adoption gets a ZERO-delta
 * opening_balance (`:798`; a promoted lot with real stock is written as `count_reconcile`, `:584`).
 * So this never discards a real quantity — it only stops a starting position being counted as a change.
 */
export function isMovement(kind: string): boolean {
  return kind !== 'opening_balance';
}

export function summarizeMovements(movements: LedgerMovement[]): MovementSummary[] {
  const byKind = new Map<string, MovementSummary>();
  for (const m of movements) {
    const cur = byKind.get(m.kind) ?? { kind: m.kind, net: 0, events: 0 };
    cur.net += Number(m.delta ?? 0);
    cur.events += 1;
    byKind.set(m.kind, cur);
  }
  // Largest absolute movement first — the owner reads the biggest cause, not the alphabet.
  return [...byKind.values()].sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

export function reconcileRow(input: ReconcileInput): ReconcileResult {
  const { bookOnHand, committed, prior, movementsSincePrior, counted } = input;
  const mode: ReconcileMode = prior ? 'delta' : 'baseline';

  // ONE filter, applied ONCE, feeding BOTH the arithmetic and the evidence strip — so the number
  // the owner is asked to explain and the movements they are shown as the explanation can never
  // disagree about what counts as a movement (STD-011).
  const moves = movementsSincePrior.filter(m => isMovement(m.kind));

  const evidence = mode === 'delta' ? summarizeMovements(moves) : [];
  const netSincePrior = moves.reduce((s, m) => s + Number(m.delta ?? 0), 0);
  const replayExpected = prior ? prior.counted_qty + netSincePrior : null;

  // Book is authoritative for `expected` — it is the number the rest of the app transacts
  // against. The replay is the CHECK on it, not a competing answer (correction A).
  const expected = bookOnHand;
  const bookAgreesWithReplay = replayExpected === null || replayExpected === bookOnHand;

  const residual = counted === null ? null : counted - expected;
  const varianceFlag = residual !== null && isVariance(residual, expected);

  return {
    mode,
    available: available(bookOnHand, committed),
    expected,
    residual,
    replayExpected,
    bookAgreesWithReplay,
    evidence,
    varianceFlag,
    attributionRequired: mode === 'delta' && residual !== null && residual !== 0,
  };
}

// ── THE WRITE PLAN ──────────────────────────────────────────────────────────────────────────

/** `miscount` is deliberately NOT here: "the book was wrong, nothing physically happened" is
 *  exactly what a `count_reconcile` row already means. Giving it its own adjust event would
 *  write a second row asserting a movement that did not occur. It is the REMAINDER. */
export type AttributionKind = 'dead' | 'loss' | 'found';

/** qty is an UNSIGNED magnitude; the sign comes from the kind. A UI that let the owner type
 *  "-4 dead" would make two ways to say one thing, and they would eventually disagree. */
export interface Attribution {
  kind: AttributionKind;
  qty: number;
}

interface WritePlanStep {
  rpc: 'adjust_inventory_manual' | 'count_reconcile_inventory';
  /** The ledger `kind` this step writes. */
  kind: string;
  /** ABSOLUTE target on-hand for this step — both RPCs take absolute qty and derive the delta
   *  themselves under a FOR UPDATE lock. We never pass a delta. */
  newQty: number;
  /** The delta we EXPECT (for the trail + the confirm copy). The RPC's own computed delta wins;
   *  a disagreement means a concurrent movement landed, which the closing step absorbs. */
  delta: number;
  reason: string;
}

type WritePlan =
  | { ok: true; steps: WritePlanStep[] }
  | { ok: false; error: string };

function signOf(kind: AttributionKind): 1 | -1 {
  return kind === 'found' ? 1 : -1;
}

/**
 * Build the ordered RPC steps an Accept performs.
 *
 * ORDER IS LOAD-BEARING, twice over:
 *   1. POSITIVE (`found`) adjustments run FIRST. `adjust_inventory_manual` RAISEs on a negative
 *      target, so applying a −6 `dead` before a +4 `found` on a lot of 3 would abort the plan
 *      halfway — leaving PART of the attribution written to an append-only log with no way to
 *      finish it. Front-loading the credits keeps every intermediate target ≥ 0 where it can.
 *   2. The `count_reconcile` runs LAST and lands ABSOLUTELY on `counted`. That makes the plan
 *      self-correcting: if a sale lands mid-plan, the closing step still ends on the number the
 *      human physically observed, and the drift is absorbed into that one row's delta rather
 *      than silently lost. The final on-hand is ALWAYS `counted`.
 *
 * The steps' deltas sum to exactly `counted − bookOnHand` (see the test file).
 */
export function buildWritePlan(args: {
  bookOnHand: number;
  counted: number;
  attributions: Attribution[];
  mode: ReconcileMode;
  /** The owner's free-text note, if any. */
  note?: string | null;
}): WritePlan {
  const { bookOnHand, counted, attributions, mode, note } = args;

  if (!Number.isInteger(counted) || counted < 0) {
    return { ok: false, error: 'Enter a whole number of 0 or more — a count asserts physical truth.' };
  }
  for (const a of attributions) {
    if (!Number.isInteger(a.qty) || a.qty <= 0) {
      return { ok: false, error: `"${a.kind}" needs a whole number above 0 — leave it blank if it is not the cause.` };
    }
  }

  // Credits before debits (see ORDER, note 1).
  const ordered = [...attributions].sort((x, y) => signOf(y.kind) - signOf(x.kind));

  const steps: WritePlanStep[] = [];
  let running = bookOnHand;

  for (const a of ordered) {
    const delta = signOf(a.kind) * a.qty;
    const target = running + delta;
    if (target < 0) {
      return {
        ok: false,
        error: `${a.qty} ${a.kind} is more than the ${running} this lot has on hand — on-hand cannot go below zero.`,
      };
    }
    steps.push({
      rpc: 'adjust_inventory_manual',
      kind: a.kind,
      newQty: target,
      delta,
      reason: note ? `${a.kind} at reconcile — ${note}` : `${a.kind} at reconcile`,
    });
    running = target;
  }

  // The closing stamp. ALWAYS written, even at zero delta: "counted, and it agreed" is the fact
  // that closes a reconcile window, and §7b of the ledger migration records it deliberately.
  const closingDelta = counted - running;
  const baseReason = mode === 'baseline' ? 'baseline' : 'count_reconcile';
  steps.push({
    rpc: 'count_reconcile_inventory',
    kind: 'count_reconcile',
    newQty: counted,
    delta: closingDelta,
    reason: note ? `${baseReason} — ${note}` : baseReason,
  });

  return { ok: true, steps };
}

/** Sum of a plan's expected deltas. Exists so the UI can state the net move before the owner
 *  commits, and so the test can assert the plan is arithmetically closed. */
export function planNetDelta(steps: WritePlanStep[]): number {
  return steps.reduce((s, st) => s + st.delta, 0);
}
