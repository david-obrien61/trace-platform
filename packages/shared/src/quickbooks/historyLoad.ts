// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the WHOLE invoice history of a business → history orders and their lines, anchored on
//   the INVOICE rather than on a delivery stop. `historyOrderWriter` answers "which of the stops
//   on the calendar need a load?"; this answers "what has this business ever sold?" — 1,510
//   invoices against 19 stops, so the anchor, the customer resolution and the volume all differ.
// DEPENDENCIES: ./invoiceOrderLines · ../business-logic/historyOrder · ./qboRead (shape only).
//   PURE — no database, no clock, no id generation. The writer is `commitHistoryLoad`.
// OUTPUTS: planHistoryLoad · HistoryLoadPlan · HistoryLoadSkip · PlannedHistoryOrder.
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EVERY ORDER THIS PLANS CARRIES THE LOAD'S OWN `import_run_id` (R-165, as sharpened).
//   ONE TENANT LOAD, ONE ID: the customers, the products and this history all belong to the same
//   run, so `undo_import_run(business, run)` removes the whole load in ONE operation. A run of
//   its own would need a link, a lookup, and a new way for the two to disagree.
//
// 🔴 THREE REASONS AN INVOICE IS SKIPPED, AND THEY ARE NOT THE SAME REASON.
//   ① `already-ordered`  — an order already carries this `qb_invoice_id`. The unique index
//      `uidx_orders_business_qb_invoice` makes this structural; the plan reports it so a re-run
//      says "0 written" as a COUNT rather than by being silent.
//   ② `captured-by-hand` — the DOCUMENT NUMBER matches an order Lauren captured from a
//      PHOTOGRAPH (OCR) or the 2026-08-27 backfill. Those orders carry NO `qb_invoice_id`, so
//      the index cannot see them, and importing the same sale again would DOUBLE it on her
//      books. ⚠️ THIS IS A BLUNT INSTRUMENT AND IT IS LABELLED AS ONE: a document number is an
//      ANCHOR, NOT AN IDENTITY (#250 — LAWNS's own books carry 22 numbers used by two different
//      invoices each). Excluding on it can skip a REAL second sale that happens to share a
//      number. That is the deliberate trade for tonight: a missing sale is visible and
//      recoverable, a double-counted one is neither. #250's matcher replaces this.
//   ③ `no-customer`      — the invoice's `CustomerRef` resolves to no customer row. Reported,
//      never guessed at: an order on the wrong customer is worse than an order not imported.
//
// 🔴 `business_inventory_id` IS NEVER SET, AND THAT IS ENFORCED BY THE TYPE IT BORROWS.
//   Lines come from `buildInvoiceOrderContent`, whose `HistoryOrderLine.businessInventoryId` is
//   the literal `null`. Committed stock is DERIVED (D-52): a lot id on a captured line reduces
//   what the business can sell, with no ledger row and nothing on any screen. The catalogue link
//   is `qbo_item_id`, a VALUE — which is also why it survives a wipe-and-reload untouched.
// ─────────────────────────────────────────────────────────────────────────────
import { parseInvoiceOrderLines, buildInvoiceOrderContent } from './invoiceOrderLines';
import { buildHistoryOrder, type HistoryOrderDraft } from '../business-logic/historyOrder';

export type SkipReason = 'already-ordered' | 'captured-by-hand' | 'no-customer';

export interface HistoryLoadSkip {
  invoiceId: string;
  docNumber: string | null;
  reason: SkipReason;
  /** Enough to act on without opening QuickBooks. */
  detail: string;
}

export interface PlannedHistoryOrder {
  invoiceId: string;
  docNumber: string | null;
  customerId: string;
  draft: HistoryOrderDraft;
}

export interface HistoryLoadPlan {
  runId: string;
  /** Every invoice we were handed. The denominator — a pass over an empty set is not a pass. */
  invoicesRead: number;
  planned: PlannedHistoryOrder[];
  skipped: HistoryLoadSkip[];
  /** Counts by reason, so the screen can say WHY without walking the list. */
  skipCounts: Record<SkipReason, number>;
  /** Lines the plan would write. Not the same as the invoice's `Line[]` — see below. */
  lineCount: number;
  /**
   * `SubTotalLineDetail` entries seen and deliberately NOT stored (David, 2026-09-21).
   * One per invoice, DERIVED, and already on `orders.subtotal`; storing it is a second
   * representation of one fact. **Reported so the gap is never read as a drop** — a line count
   * taken from `order_items` will not match one taken from the capture, by design.
   */
  runningTotalsDropped: number;
}

const str = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/**
 * Plan the load. PURE: hand it the invoices and what the tenant already holds, and it decides.
 *
 * ⚠️ `excludedDocNumbers` IS THE CALLER'S MEASUREMENT, NOT A GUESS MADE HERE. The caller reads
 * the document numbers off history orders that carry NO `qb_invoice_id` — the only orders the
 * unique index cannot protect — and hands them in. Passing an empty set is legitimate (a tenant
 * with no hand-captured invoices) and is NOT treated as "nothing to exclude, so exclude nothing
 * carefully": it is simply an empty set.
 */
export function planHistoryLoad(input: {
  invoices: Array<Record<string, unknown>>;
  /** QuickBooks customer id → our customer row id. */
  customerIdByQbId: Map<string, string>;
  /** `qb_invoice_id` values the tenant already holds — the index's own population. */
  existingQbInvoiceIds: Set<string>;
  /** Document numbers of orders captured by hand, which the index cannot see. */
  excludedDocNumbers: Set<string>;
  businessId: string;
  runId: string;
}): HistoryLoadPlan {
  const { invoices, customerIdByQbId, existingQbInvoiceIds, excludedDocNumbers, businessId, runId } = input;
  const planned: PlannedHistoryOrder[] = [];
  const skipped: HistoryLoadSkip[] = [];
  const skipCounts: Record<SkipReason, number> = {
    'already-ordered': 0, 'captured-by-hand': 0, 'no-customer': 0,
  };
  let lineCount = 0;
  let runningTotalsDropped = 0;

  for (const inv of invoices) {
    const invoiceId = String(inv.Id ?? '');
    const docNumber = str(inv.DocNumber);
    const skip = (reason: SkipReason, detail: string) => {
      skipped.push({ invoiceId, docNumber, reason, detail });
      skipCounts[reason]++;
    };

    if (existingQbInvoiceIds.has(invoiceId)) {
      skip('already-ordered', `invoice ${invoiceId} already has an order — the key held`);
      continue;
    }
    if (docNumber !== null && excludedDocNumbers.has(docNumber)) {
      skip('captured-by-hand',
        `document #${docNumber} matches an order captured by hand (OCR or backfill), which carries `
        + 'no QuickBooks id — importing it would double the sale');
      continue;
    }

    const qbCustomerId = str((inv.CustomerRef as { value?: unknown } | undefined)?.value);
    const customerId = qbCustomerId ? customerIdByQbId.get(qbCustomerId) : undefined;
    if (!customerId) {
      skip('no-customer',
        `no customer row for QuickBooks customer ${qbCustomerId ?? '(none on the invoice)'} — `
        + 'reported rather than guessed; an order on the wrong customer is worse than one not imported');
      continue;
    }

    const content = buildInvoiceOrderContent({
      lines: parseInvoiceOrderLines(inv),
      totalTax: num((inv.TxnTaxDetail as { TotalTax?: unknown } | undefined)?.TotalTax),
      totalAmt: num(inv.TotalAmt),
    });
    runningTotalsDropped += content.counts.runningTotal;

    const draft = buildHistoryOrder({
      businessId,
      customerId,
      receiptId: null,                       // there is no photograph — this came from their books
      documentDate: str(inv.TxnDate),
      documentTotal: num(inv.TotalAmt) ?? 0,
      lineItemsOriginal: null,               // the lines are already classified; do not re-derive
      decoded: null,
      lines: content.lines,
      notes: content.notes.length ? content.notes.join('\n') : null,
      qbInvoiceId: invoiceId,
      qbDocNumber: docNumber,
    });

    lineCount += content.lines.length;
    planned.push({ invoiceId, docNumber, customerId, draft });
  }

  return {
    runId, invoicesRead: invoices.length,
    planned, skipped, skipCounts, lineCount, runningTotalsDropped,
  };
}
