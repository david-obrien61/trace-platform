// ============================================================
// receiptsList — the READ side of Receipt Keeper: what was captured, what the platform
//   BANKED about it at save time, and what it became downstream.
//
// PURPOSE:      Seventeen receipts have been captured at LAWNS and NOTHING has ever rendered
//               them. Six reconciliation columns (`reconcile_status`, `reconcile_delta`,
//               `reconcile_overridden_at`, `accept_vs_edit`, `amount_original`,
//               `header_amount_edited`) have been WRITE-ONLY since 2026-06-14 — banked at the
//               moment of save and never read back by anything. This module is their first
//               reader, plus the `receipt → order → delivery` chain that says what a capture
//               turned into.
//
// 🔴 THREE THINGS THIS MODULE DELIBERATELY DOES NOT DO, each because it was ruled out rather
//    than forgotten:
//
//   ① IT DOES NOT RE-EVALUATE. `computeReconcile` is NOT run over a stored row. The verdict on
//      screen is the one the platform banked at save time, displayed as banked. Re-deriving it
//      here would produce a SECOND verdict over the same row with no way to tell which one the
//      owner actually saw — and `line_items` is not even SELECTED (see RECEIPTS_SELECT), so the
//      inputs a re-evaluation would need are not in hand. Falsifying the banked verdict is a
//      separate, deliberate piece of work.
//
//      The one arithmetic here is RECONSTRUCTION, not derivation: `reconcile_delta` was DEFINED
//      at write time as `lineSum − amount` (20260614_receipts_reconciliation.sql:51-55), so
//      `lineSum = amount + delta` recovers the banked figure exactly. No new fact is computed.
//
//   ② IT DOES NOT ADJUDICATE. A receipt that produced no order says exactly that and stops.
//      It is not "missing", "orphaned", "unlinked" or "an error" — six of LAWNS's seventeen
//      receipts read as vendor PURCHASE invoices, which correctly should not become customer
//      orders, and that reading is a READ rather than an established fact. The screen shows
//      what became of a capture, or that nothing did, and the person decides what it means.
//
//   ③ IT DOES NOT DERIVE A DOCUMENT TYPE. The `receipts` table carries no origin/shape/source
//      column — MEASURED against the live table 2026-09-01, 21 columns examined, none of
//      `origin`/`shape`/`source`/`doc_type`/`document_type`/`kind` present; and no migration
//      adds one (only 20260612_receipts.sql, 20260613_receipts_add_line_items.sql and
//      20260614_receipts_reconciliation.sql touch the table). So the table holds LAWNS's OWN
//      sales invoices (vendor reads `LAWNS Tree Farm, LLC.`, 9 rows) and its SUPPLIERS' invoices
//      (bwi ×4, Bailey Bark ×3, Sudderth ×1) with nothing distinguishing them. The vendor string
//      is displayed EXACTLY AS STORED and no type is inferred from it: reading "the vendor is the
//      tenant, therefore this is a sales invoice" happens to work on these seventeen rows and is
//      not a rule. David's 2026-07-07 ruling — "one pipeline, two doors", the LAUNCHER pinning
//      the document shape — is the capture-side build that makes the distinction a stored fact.
//
// DEPENDENCIES: `../utils/receiptReconciliation` (the severity colours and prose already written
//               for exactly this readout — §6 r8, reuse not a second copy) · `./orderStatus`
//               (`orderStatusMeta`) · `./deliveryFulfilment` (`deliveryStatusMeta`). Both
//               labellers already own the "render an unknown status under its own raw name"
//               fallback; a fourth copy of it here would be the drift STD-011 describes.
//               Otherwise pure — no React, no Supabase, no DOM, no clock. A render condition
//               inside a `.tsx` cannot be asserted (tech-debt #134), so every decision lives here.
//
// OUTPUTS:      RECEIPTS_SELECT · RECEIPTS_PAGE_LIMIT · receiptSortKey · compareReceiptsForDisplay ·
//               receiptRowModel · receiptListModel ·
//               countLabel · bankedVerdict · captureOutcome.
// ============================================================

import {
  fmt,
  reconcileReadoutStyle,
  reconcileReadoutText,
  type ReconcileResult,
} from '../utils/receiptReconciliation';
import { orderStatusMeta } from './orderStatus';
import { deliveryStatusMeta } from './deliveryFulfilment';
import type { CSSProperties } from 'react';

// ════════════════════════════════════════════════════════════════════════════════════════════
// §1 THE READ
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * How many rows one page of the list holds.
 *
 * 🔴 THE CAP IS NEVER SILENT. `countLabel` renders "Showing N of M" and names the cap whenever
 * the read was capped. A `.limit()` sitting under a bare count label is already a live defect on
 * two other screens (`Orders.tsx`'s `.limit(50)` under "recent checkouts"); this is not a third.
 */
export const RECEIPTS_PAGE_LIMIT = 100;

/**
 * The PostgREST projection. Exported because two probes assert on it directly:
 *
 *  · the `orders(...)` and `deliveries(...)` embeds MUST be present — without them every row
 *    reads "no order recorded", which is a confident false statement rather than a blank;
 *  · `line_items` MUST NOT be present — its absence is what makes re-evaluation (①) impossible
 *    rather than merely discouraged.
 *
 * The embeds need no `!fk` hint: `orders.receipt_id` is the ONLY foreign key between `orders` and
 * `receipts` (20260827_history_orders.sql:77) and `deliveries.order_id` the only one between
 * `deliveries` and `orders` (20260827_history_orders.sql:90-91), so the relationship is
 * unambiguous in both directions. Verified against the live database 2026-09-01: the nested
 * embed returns all 17 LAWNS receipts with their orders and deliveries attached.
 */
export const RECEIPTS_SELECT = `
  id, vendor, date, amount, category, created_at, status,
  reconcile_status, reconcile_delta, reconcile_overridden_at,
  accept_vs_edit, amount_original, header_amount_edited,
  orders (
    id, order_kind, status, total_amount, sale_date, source_document_number,
    deliveries ( id, delivery_date, status, service_type, source )
  )
`;

// ── Row shapes as PostgREST returns them ────────────────────────────────────────────────────
// `numeric` columns arrive as JSON numbers, but the string form is accepted too rather than
// assumed away: a coercion that silently turns an unparseable value into 0 is the D-9 failure
// this whole surface exists to stop.

export interface RawDeliveryRow {
  id: string;
  delivery_date: string | null;
  status: string | null;
  service_type: string | null;
  source: string | null;
}

export interface RawOrderRow {
  id: string;
  order_kind: string | null;
  status: string | null;
  total_amount: number | string | null;
  sale_date: string | null;
  source_document_number: string | null;
  deliveries?: RawDeliveryRow[] | null;
}

export interface RawReceiptRow {
  id: string;
  vendor: string | null;
  date: string | null;
  amount: number | string | null;
  category: string | null;
  created_at: string | null;
  status: string | null;
  reconcile_status: string | null;
  reconcile_delta: number | string | null;
  reconcile_overridden_at: string | null;
  accept_vs_edit: string | null;
  amount_original: number | string | null;
  header_amount_edited: boolean | null;
  orders?: RawOrderRow[] | null;
}

/** Absent stays absent. `null` in, `null` out — never 0, never NaN dressed as a figure (D-9). */
function toNum(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/** A money figure, or an honest statement that there isn't one. */
function money(v: number | string | null | undefined): string | null {
  const n = toNum(v);
  return n === null ? null : fmt.format(n);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §2 THE BANKED VERDICT — the six write-only columns, read back
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * The stored vocabulary is NOT the in-flight vocabulary, and the difference is load-bearing.
 *
 * `computeReconcile` returns `large_mismatch` — a fact about the numbers. The column stores
 * `large_mismatch_overridden` — that fact PLUS what the owner then did about it
 * (20260614_receipts_reconciliation.sql:41-46). Mapping the second onto the first recovers the
 * severity for `reconcileReadoutStyle`; the override half is surfaced separately as its own
 * note, because folding it into a colour would lose it.
 *
 * `no_lines` is deliberately absent: it is an in-flight state and the column stores NULL for it.
 */
const STORED_STATUS_TO_SEVERITY: Record<string, ReconcileResult['status']> = {
  match: 'match',
  small_gap: 'small_gap',
  large_mismatch_overridden: 'large_mismatch',
};

export interface BankedVerdict {
  /** null when nothing was banked — the caller renders the `notes` and no readout. */
  readout: { style: CSSProperties; text: string } | null;
  /** Everything the readout cannot carry: the override, the OCR snapshot, the edit flag. */
  notes: string[];
}

/**
 * Read back what the platform banked at save time. Displays; never recomputes (see ① above).
 */
export function bankedVerdict(row: RawReceiptRow): BankedVerdict {
  const notes: string[] = [];

  // ── the readout ───────────────────────────────────────────────────────────────────────────
  const stored = row.reconcile_status;
  const severity = stored ? STORED_STATUS_TO_SEVERITY[stored] : undefined;
  const total = toNum(row.amount);
  const delta = toNum(row.reconcile_delta);

  let readout: BankedVerdict['readout'] = null;
  if (!stored) {
    // Not a blank. A row that was never reconciled says so — the alternative is a reader
    // assuming "no readout" means "nothing was wrong" (D-9 / A9: absent is not empty).
    notes.push('No reconciliation was recorded for this capture.');
  } else if (!severity) {
    // A value the vocabulary does not know renders under its own raw name rather than being
    // forced into a bucket — the same fallback orderStatusMeta and deliveryStatusMeta already own.
    notes.push(`Reconciliation recorded as "${stored}" — a status this screen does not recognise.`);
  } else if (total === null || delta === null) {
    // The verdict exists but its arithmetic does not. Saying so beats printing $0.00, which
    // would read as a real figure.
    notes.push(
      `Reconciliation recorded as "${stored}", but ${total === null ? 'the total' : 'the delta'} was not stored — the figures cannot be shown.`,
    );
  } else {
    // RECONSTRUCTION, not derivation: delta was written as lineSum − amount, so lineSum is
    // recovered exactly from the two banked numbers.
    const banked: ReconcileResult = {
      status: severity,
      lineSum: total + delta,
      total,
      delta,
      gapNote: null,
    };
    readout = { style: reconcileReadoutStyle(severity), text: reconcileReadoutText(banked) };
  }

  // ── the override ──────────────────────────────────────────────────────────────────────────
  if (stored === 'large_mismatch_overridden') {
    notes.push(
      row.reconcile_overridden_at
        ? `Owner was shown the conflict and saved anyway — ${row.reconcile_overridden_at}.`
        : 'Owner overrode a large mismatch, but no override timestamp was stored.',
    );
  }

  // ── the OCR snapshot ──────────────────────────────────────────────────────────────────────
  const original = toNum(row.amount_original);
  if (original === null) {
    notes.push('No OCR total was snapshotted for this capture.');
  } else if (total === null) {
    notes.push(`OCR read ${fmt.format(original)}; no saved total was recorded.`);
  } else if (Math.abs(original - total) < 0.005) {
    notes.push(`OCR read ${fmt.format(original)} — the saved total is unchanged.`);
  } else {
    notes.push(`OCR read ${fmt.format(original)} → saved ${fmt.format(total)}.`);
  }

  // ── accept vs edit ────────────────────────────────────────────────────────────────────────
  // 🔴 THE OPEN QUESTION FROM #252 IS ANSWERED, AND THE OLD SENTENCE WAS FALSE. It read "Owner
  // changed something before saving." on 35 of 36 rows. MEASURED 2026-09-02, field by field,
  // against the OCR's own parsed output (population 35 rows whose parsed JSON is recoverable):
  //
  //     vendor differs    0        amount differs    3        category differs  2
  //     date differs     29   ← the CODE normalises "06/22/2026" to ISO, then compares the
  //                             normalised value against the raw one and calls that an edit
  //     lines differ     30   ← the CODE injects its own `Tax` line, then counts the line it
  //                             added as a line the owner added
  //
  // Both large counts are SELF-INFLICTED by the save path (`detectAcceptVsEdit` compares
  // `fields.date`, already run through `toISODate`, against the raw `p.date`; and
  // `countEditedLineItems` compares the tax-injected array against the un-injected snapshot).
  // The flag measures our own formatting, not the owner's intent — so the screen was quietly
  // accusing Lauren of an edit she did not make, on nearly every row she ever captured.
  //
  // What the flag can HONESTLY support is stated instead, and only from this row's own columns:
  // `header_amount_edited` is the one half of it that is a real, isolated fact.
  if (row.accept_vs_edit === 'edited') {
    if (row.header_amount_edited === false) {
      notes.push(
        'Flagged as edited, but the total was not changed — the flag also counts the platform\u2019s own '
        + 'date reformatting and the tax line it adds, so it does not establish that anyone edited anything.',
      );
    } else if (row.header_amount_edited === true) {
      notes.push('Flagged as edited, and the total field itself was changed.');
    } else {
      notes.push(
        'Flagged as edited. What changed was not recorded, and the flag also counts the platform\u2019s own '
        + 'reformatting — so it does not establish that anyone edited anything.',
      );
    }
  } else if (row.accept_vs_edit === 'accepted_as_is') {
    notes.push('Saved exactly as read.');
  } else {
    notes.push('Whether the owner edited before saving was not recorded.');
  }

  // (the `header_amount_edited === true` case is stated by the branch above — saying it twice
  //  would be one fact in two places, and the second copy is the one that drifts: STD-011)

  return { readout, notes };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §3 WHAT IT BECAME — receipt → order → delivery
// ════════════════════════════════════════════════════════════════════════════════════════════

export interface OutcomeDelivery {
  id: string;
  dateText: string;
  status: { label: string; color: string; bg: string };
  serviceText: string;
  sourceText: string;
}

export interface OutcomeOrder {
  id: string;
  kindText: string;
  status: { label: string; color: string; bg: string };
  totalText: string;
  saleDateText: string;
  docNumberText: string;
  deliveries: OutcomeDelivery[];
  /** Set when the order carries no delivery row. A statement of fact, not a verdict. */
  deliveryNote: string | null;
}

export interface CaptureOutcome {
  orders: OutcomeOrder[];
  /** Set when nothing references this receipt. A statement of fact, not a verdict. */
  note: string | null;
  /**
   * More than one order points at this ONE receipt. Surfaced so it can be seen; NOT labelled a
   * duplicate, NOT repaired. (LAWNS's two known duplicate captures are two RECEIPTS with one
   * order each, which this screen shows as two rows — measured 2026-09-01: 0 of 17 receipts
   * carry more than one order. The flag is here because the shape is reachable, not because it
   * is currently occupied.)
   */
  multipleOrders: boolean;
}

function outcomeDelivery(d: RawDeliveryRow): OutcomeDelivery {
  return {
    id: d.id,
    // A stop with no date is the thing worth seeing, so it is named rather than left blank —
    // both of LAWNS's duplicate-capture deliveries carry delivery_date NULL (measured 2026-09-01).
    dateText: d.delivery_date ?? 'No date set',
    status: deliveryStatusMeta(d.status),
    serviceText: d.service_type ?? 'No service type',
    sourceText: d.source ?? 'No source recorded',
  };
}

function outcomeOrder(o: RawOrderRow): OutcomeOrder {
  const deliveries = (o.deliveries ?? []).map(outcomeDelivery);
  return {
    id: o.id,
    // NULL order_kind means an ordinary checkout order — the migration says so explicitly
    // (20260827_history_orders.sql:37-38, "NULL means an ordinary checkout order"). That is a
    // DECLARED meaning being displayed, not a guess about an absent value.
    kindText: o.order_kind ?? 'Checkout order',
    status: orderStatusMeta(o.status),
    totalText: money(o.total_amount) ?? 'No total recorded',
    saleDateText: o.sale_date ?? 'No sale date recorded',
    docNumberText: o.source_document_number ?? 'No document number',
    deliveries,
    deliveryNote: deliveries.length === 0 ? 'No delivery recorded for this order.' : null,
  };
}

/**
 * What this capture became. Says what exists; where nothing exists, says that nothing exists,
 * and attaches no verdict to the absence (② above).
 */
export function captureOutcome(row: RawReceiptRow): CaptureOutcome {
  const orders = (row.orders ?? []).map(outcomeOrder);
  return {
    orders,
    note: orders.length === 0 ? 'No order recorded for this receipt.' : null,
    multipleOrders: orders.length > 1,
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §4 THE ROW, AND THE COUNT
// ════════════════════════════════════════════════════════════════════════════════════════════

export interface ReceiptRowModel {
  id: string;
  /** EXACTLY as stored. No inferred document type, no icon standing in for one (③ above). */
  vendorText: string;
  dateText: string;
  amountText: string;
  categoryText: string;
  capturedAtText: string;
  statusText: string;
  verdict: BankedVerdict;
  outcome: CaptureOutcome;
}

export function receiptRowModel(row: RawReceiptRow): ReceiptRowModel {
  return {
    id: row.id,
    vendorText: row.vendor ?? 'No vendor recorded',
    dateText: row.date ?? 'No date recorded',
    amountText: money(row.amount) ?? 'No amount recorded',
    categoryText: row.category ?? 'No category',
    capturedAtText: row.created_at ?? 'No capture time recorded',
    statusText: row.status ?? 'No status',
    verdict: bankedVerdict(row),
    outcome: captureOutcome(row),
  };
}

/**
 * 🔴 THE COUNT IS HONEST OR IT IS NOT SHOWN.
 *
 * Three cases, and the middle one is the whole point:
 *  · uncapped        → "17 receipts"
 *  · capped          → "Showing 100 of 236 receipts — capped at 100" (names the cap, not just N)
 *  · total unknown   → "Showing 100 receipts — the total was not counted"
 *
 * The third exists because PostgREST returns `count: null` when the count cannot be taken, and a
 * screen that then prints a bare "100" is asserting a total nobody measured. Saying the total is
 * unknown is worse-looking and true; that is the trade this platform has already made twice.
 */
export function countLabel(shown: number, total: number | null, limit = RECEIPTS_PAGE_LIMIT): string {
  const noun = (n: number) => (n === 1 ? 'receipt' : 'receipts');
  if (total === null) {
    return shown >= limit
      ? `Showing ${shown} ${noun(shown)} — the total was not counted, and this page is capped at ${limit}`
      : `Showing ${shown} ${noun(shown)} — the total was not counted`;
  }
  if (shown < total) {
    // The cap is named only when the page actually hit it. If fewer than `limit` rows came back
    // yet the total is higher, something OTHER than the cap shortened the read, and blaming the
    // cap would be a confident wrong explanation.
    return shown >= limit
      ? `Showing ${shown} of ${total} ${noun(total)} — capped at ${limit}`
      : `Showing ${shown} of ${total} ${noun(total)}`;
  }
  return `${total} ${noun(total)}`;
}

export interface ReceiptListModel {
  rows: ReceiptRowModel[];
  countText: string;
  capped: boolean;
  /** Nothing captured yet — distinct from a failed read, which the caller renders separately. */
  emptyNote: string | null;
}

/**
 * 🔴 G9 — THE SORT KEY IS THE DOCUMENT'S OWN DATE, NOT THE ROW'S CAPTURE TIMESTAMP.
 *
 * David's ruling, 2026-09-03, and recorded at `docs/standards/ui-control-standards.md` G9:
 * *"DEFAULT SORT IS THE MOST RECENT RECORD DATE FIRST: the date the document or event itself
 * carries, NOT the row's creation timestamp."*
 *
 * ⚠️ THE TWO DISAGREE ON THE LIVE DATA, WHICH IS WHY THIS IS A BEHAVIOUR CHANGE AND NOT A
 * TIDY-UP. `receipts.date` is what the paper says; `created_at` is when somebody photographed
 * it. LAWNS captured the **2026-07-02** bwi invoice AFTER the **2026-07-29** one, so the previous
 * `created_at` order put July 2nd above July 29th — a list of invoices that contradicted the
 * invoices.
 *
 * A ROW WITH NO DOCUMENT DATE IS POSITIONED BY ITS CAPTURE DAY AND SAYS SO ON ITS FACE. The
 * fallback buys a POSITION, never a displayed value: `dateText` still reads "No date recorded"
 * (D-9 / A9 — absent is not empty). The alternative considered and rejected was sending undated
 * rows to the bottom: the row whose date OCR failed is the one most needing attention, and the
 * reason this list exists at all is that captures were invisible. Burying them rebuilds the
 * defect.
 *
 * The key is sliced to 10 characters so the two scales are comparable at all: `date` is
 * `YYYY-MM-DD` and `created_at` is a full ISO timestamp, and comparing them raw would rank a
 * dated row against a timestamped one by string length rather than by time.
 *
 * The order is computed HERE and asserted by a probe rather than trusted to the query, because a
 * `.order()` in a `.tsx` cannot be asserted (tech-debt #134) and this one is now a ruling.
 */
export function receiptSortKey(row: Pick<RawReceiptRow, 'date' | 'created_at'>): string {
  return String(row.date ?? row.created_at ?? '').slice(0, 10);
}

/**
 * Descending by document date, tie-broken by capture time — two receipts dated the same day are
 * ordered by which was captured later, which is the only further fact the row carries.
 */
export function compareReceiptsForDisplay(
  a: Pick<RawReceiptRow, 'date' | 'created_at'>,
  b: Pick<RawReceiptRow, 'date' | 'created_at'>,
): number {
  const byDate = receiptSortKey(b).localeCompare(receiptSortKey(a));
  if (byDate !== 0) return byDate;
  return String(b.created_at ?? '').localeCompare(String(a.created_at ?? ''));
}

export function receiptListModel(
  raw: RawReceiptRow[],
  total: number | null,
  limit = RECEIPTS_PAGE_LIMIT,
): ReceiptListModel {
  const sorted = [...raw].sort(compareReceiptsForDisplay);
  return {
    rows: sorted.map(receiptRowModel),
    countText: countLabel(sorted.length, total, limit),
    capped: total !== null ? sorted.length < total : sorted.length >= limit,
    emptyNote: sorted.length === 0 ? 'No receipts captured yet.' : null,
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §5 WHEN THE LIST IS ON SCREEN
// ════════════════════════════════════════════════════════════════════════════════════════════

/**
 * The list renders ABOVE the capture zone — David's ruling — but not while the capture wizard is
 * mid-flow.
 *
 * The wizard is untouched by this build; this is a statement about the LIST, not about the
 * wizard. At `ocr_running` / `confirm` / `saving` the wizard owns the screen: putting a hundred
 * receipt cards above a form somebody is actively filling would push that form below the fold —
 * on a phone, by twenty screens — and capture is the proven flow that this surface must not
 * degrade. At `idle` and `error` the list is what the page is for, and at `done` it is how a
 * just-saved capture is seen to have landed.
 *
 * It lives here rather than as a condition inside the `.tsx` because a render condition in a
 * component cannot be asserted (tech-debt #134), and this one is a decision, not a layout detail.
 */
const LIST_VISIBLE_STEPS = ['idle', 'error', 'done'] as const;

export function listVisibleForStep(step: string): boolean {
  return (LIST_VISIBLE_STEPS as readonly string[]).includes(step);
}
