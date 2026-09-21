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

// ═════════════════════════════════════════════════════════════════════════════════════════════
// THE WRITER. Everything above is pure; everything below takes a client and is the only part
// that touches a database.
// ═════════════════════════════════════════════════════════════════════════════════════════════

/** Orders written per round trip. 1,472 orders is not one statement, and it is not 1,472 either. */
export const LOAD_CHUNK = 50;

export interface HistoryLoadState {
  /** The LOAD's run id, DERIVED from the data rather than passed in — see below. */
  runId: string | null;
  customerIdByQbId: Map<string, string>;
  existingQbInvoiceIds: Set<string>;
  excludedDocNumbers: Set<string>;
  /** How the exclusion set was arrived at, so the screen can SAY it rather than assert it. */
  excludedFrom: number;
}

/**
 * Read what the tenant already holds. Three reads, no writes.
 *
 * 🔴 THE RUN ID IS DERIVED, NOT ACCEPTED FROM THE CALLER. "One tenant load, one id" (R-165) is
 * only true if the history attaches to the SAME run the customers and products came in under, and
 * a run id typed into a request is a run id that can be wrong — silently, and in the one way that
 * breaks the undo. So it is read off `customers`: the id the most of them carry. A tenant with no
 * imported customers has no load, and this returns null rather than inventing one.
 */
export async function readHistoryLoadState(db: any, businessId: string): Promise<HistoryLoadState> {
  const page = async (table: string, select: string, filter: (q: any) => any) => {
    const rows: any[] = [];
    for (let from = 0; ; from += 1000) {
      let q = db.from(table).select(select).eq('business_id', businessId).range(from, from + 999);
      q = filter(q);
      const { data, error } = await q;
      if (error) throw new Error(`Could not read ${table}: ${error.message}`);
      rows.push(...(data ?? []));
      if ((data ?? []).length < 1000) break;
    }
    return rows;
  };

  const customers = await page('customers', 'id, qb_customer_id, import_run_id',
    (q: any) => q.not('qb_customer_id', 'is', null));
  const customerIdByQbId = new Map<string, string>();
  const runTally = new Map<string, number>();
  for (const c of customers) {
    customerIdByQbId.set(String(c.qb_customer_id), String(c.id));
    if (c.import_run_id) runTally.set(String(c.import_run_id), (runTally.get(String(c.import_run_id)) ?? 0) + 1);
  }
  let runId: string | null = null, best = 0;
  for (const [id, n] of runTally) if (n > best) { best = n; runId = id; }

  const orders = await page('orders', 'qb_invoice_id, source_document_number, order_kind', (q: any) => q);
  const existingQbInvoiceIds = new Set<string>();
  const excludedDocNumbers = new Set<string>();
  let excludedFrom = 0;
  for (const o of orders) {
    if (o.qb_invoice_id) { existingQbInvoiceIds.add(String(o.qb_invoice_id)); continue; }
    // 🔴 NO `qb_invoice_id` AND `order_kind = 'history'` = CAPTURED BY HAND (OCR or the backfill).
    // The unique index cannot see these, so the document number is the only thing standing
    // between Lauren's photographed invoice and a second copy of the same sale.
    if (o.order_kind === 'history' && o.source_document_number) {
      excludedDocNumbers.add(String(o.source_document_number));
      excludedFrom++;
    }
  }
  return { runId, customerIdByQbId, existingQbInvoiceIds, excludedDocNumbers, excludedFrom };
}

export interface HistoryLoadResult {
  ok: boolean;
  blocker: string | null;
  runId: string | null;
  invoicesRead: number;
  ordersWritten: number;
  linesWritten: number;
  skipCounts: Record<SkipReason, number>;
  runningTotalsDropped: number;
  /** Chunks completed. A partial run says how far it got instead of just failing. */
  chunksDone: number;
  chunksTotal: number;
}

/**
 * Write the plan, in chunks.
 *
 * 🔴 A PARTIAL RUN IS SAFE AND SAYS SO. Each chunk is its own round trip, and an order that landed
 * carries its `qb_invoice_id`, so a re-run reads it back as `already-ordered` and skips it. There
 * is no compensating delete and none is needed: the unique index makes the second pass a no-op
 * over what the first pass wrote. What a caller must NOT do is treat a failure as "nothing
 * happened" — hence `ordersWritten` and `chunksDone` on the failure path too.
 *
 * ⚠️ LINES ARE WRITTEN PER ORDER, AFTER ITS ORDER ROW, because `order_items.order_id` is NOT NULL
 * and the id is only known once the order is in. A line insert that fails leaves an order with
 * fewer lines than the invoice — visible as a total that disagrees with its lines, which is why
 * the result reports both counts rather than one.
 */
export async function commitHistoryLoad(
  db: any, businessId: string, invoices: Array<Record<string, unknown>>,
  opts: { chunkSize?: number; dryRun?: boolean } = {},
): Promise<HistoryLoadResult> {
  const chunkSize = opts.chunkSize ?? LOAD_CHUNK;
  const state = await readHistoryLoadState(db, businessId);
  const base = {
    ok: false, blocker: null as string | null, runId: state.runId,
    invoicesRead: invoices.length, ordersWritten: 0, linesWritten: 0,
    skipCounts: { 'already-ordered': 0, 'captured-by-hand': 0, 'no-customer': 0 } as Record<SkipReason, number>,
    runningTotalsDropped: 0, chunksDone: 0, chunksTotal: 0,
  };
  if (!state.runId) {
    return { ...base, blocker:
      'This business has no imported customers, so there is no load for the history to belong to. '
      + 'Import the books first — history carries the load\'s own run id (R-165).' };
  }

  const plan = planHistoryLoad({
    invoices, businessId, runId: state.runId,
    customerIdByQbId: state.customerIdByQbId,
    existingQbInvoiceIds: state.existingQbInvoiceIds,
    excludedDocNumbers: state.excludedDocNumbers,
  });
  const chunksTotal = Math.ceil(plan.planned.length / chunkSize);
  const out = { ...base, skipCounts: plan.skipCounts,
    runningTotalsDropped: plan.runningTotalsDropped, chunksTotal };

  if (opts.dryRun) return { ...out, ok: true };

  for (let i = 0; i < plan.planned.length; i += chunkSize) {
    const chunk = plan.planned.slice(i, i + chunkSize);
    const { data: wrote, error: oErr } = await db.from('orders')
      .insert(chunk.map(p => ({ ...p.draft.order, import_run_id: state.runId })))
      .select('id, qb_invoice_id');
    if (oErr) return { ...out, blocker: `Order chunk ${out.chunksDone + 1} failed: ${oErr.message}` };

    const idByInvoice = new Map<string, string>();
    for (const r of (wrote ?? [])) idByInvoice.set(String(r.qb_invoice_id), String(r.id));
    out.ordersWritten += (wrote ?? []).length;

    const lines: any[] = [];
    for (const p of chunk) {
      const orderId = idByInvoice.get(p.invoiceId);
      if (!orderId) continue;                        // the insert did not return it — reported by count
      for (const l of p.draft.items) {
        lines.push({
          order_id: orderId, quantity: l.quantity, unit_price: l.unitPrice, subtotal: l.subtotal,
          description: l.description, sku: l.sku, qbo_item_id: l.qboItemId,
          business_inventory_id: l.businessInventoryId,   // null — D-52, at the write
        });
      }
    }
    if (lines.length) {
      const { data: wroteLines, error: lErr } = await db.from('order_items').insert(lines).select('id');
      if (lErr) return { ...out, blocker: `Line chunk ${out.chunksDone + 1} failed: ${lErr.message}` };
      out.linesWritten += (wroteLines ?? []).length;
    }
    out.chunksDone++;
  }
  console.log('[TRACE:HISTORYLOAD] load complete', {
    businessId, runId: state.runId, invoicesRead: out.invoicesRead,
    ordersWritten: out.ordersWritten, linesWritten: out.linesWritten, skips: out.skipCounts,
  });
  return { ...out, ok: true };
}
