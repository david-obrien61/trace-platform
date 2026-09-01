// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: give the ingested delivery stops their LOAD. For every stop this tenant already
//   has that came from a QuickBooks invoice and has no order behind it, build that invoice's
//   history order and its lines, write them, and join the stop to them. Reads first, plans
//   everything, and writes only on an explicit commit.
// DEPENDENCIES: ./invoiceOrderLines (what each invoice line IS) · ./shipmentIngest
//   (QboShipmentRow — the SAME parse the delivery ingest already ran) ·
//   ../business-logic/historyOrder (the ONE definition of a captured sale) · a supabase
//   client passed in. No client constructed here.
// OUTPUTS: readOrderIngestState · previewOrderIngest · commitOrderIngest · OrderIngestReport ·
//   availabilityFingerprint · ORDER_INGEST_SOURCE.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 WHAT THIS FILE WRITES, EXHAUSTIVELY: `orders`, `order_items`, and `deliveries.order_id`.
//   THAT IS THE WHOLE LIST. NO `business_inventory`. NO lot, no cost, no catalogue row, no
//   ledger row, and nothing at all is sent to Intuit. `historyOrderWriter.test.ts` §E asserts
//   it against a recording client rather than trusting this paragraph — a comment claiming a
//   boundary is a comment, and [[R-26]] has fourteen instances of one being false the day it
//   was written.
//
// 🔴 `deliveries.order_id` IS THE ONLY COLUMN THIS FILE EVER UPDATES ON A DELIVERY, and the
//   update is guarded `order_id IS NULL`. The stop's DATE, ADDRESS and CUSTOMER are Lauren's
//   and are not this file's business: the 2026-08-31 ruling is that Cultivar owns the delivery
//   date and QuickBooks owns the money, so a pass that reached for a date here would be the
//   sync that ruling exists to forbid. Setting the join is not a correction to her record; it
//   is the record finally being able to say what is on the truck.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 `business_inventory_id` IS NULL ON EVERY LINE, AND AVAILABLE-TO-SELL IS PROVEN, NOT ARGUED.
//
//   Committed stock is DERIVED, not stored (D-52): `available = on-hand − committed`, where
//   committed is a live join over open order lines. So these orders need no decrement to do
//   damage — merely existing in an open status with a lot id on a line silently reduces what
//   LAWNS can sell, with no ledger row, nothing to reverse and nothing on any screen.
//   [[R-21]]: whether an order holds stock is decided by its ORIGIN, not by its status.
//
//   THREE independent guards, all taken:
//     ① the TYPE — `HistoryOrderLine.businessInventoryId` is the literal `null`, so setting a
//       lot id is a COMPILE error rather than a code review.
//     ② the PAYLOAD — the commit refuses to write any line whose lot id is not null, and says
//       which invoice. A guard that only exists in a type cannot see a hand-built object.
//     ③ the ARITHMETIC — an availability FINGERPRINT is taken before the first write and again
//       after the last, and the report carries both. If they differ the run says so in the
//       loudest field it has. **CARD 8's own language: prove it, do not argue it.**
//
// 🔴 AND ③ IS DELIBERATELY BROADER THAN THE BUSINESS RULE, WHICH IS WHY IT IS NOT A SECOND
//   COPY OF IT (§6 r8). `inventoryStates.fetchCommittedByLot` answers *"what can I sell?"* and
//   filters to the open statuses. This fingerprint answers a different question — *"did any
//   number on this table move while I wrote?"* — and so filters by NOTHING: every order line
//   of every status, summed per lot. It is strictly stronger, it cannot miss a movement the
//   business rule would see, and it cannot drift from `holdsCommitment` because it never tries
//   to reproduce it. A near-duplicate of the business rule is what §6 r8 forbids; a
//   deliberately different and broader probe is not one.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 IDEMPOTENCY IS `orders.qb_invoice_id`, AND THE UNIQUE INDEX IS A HARD PRECONDITION.
//   An invoice that already has an order gets NOTHING — not an update, not a second order.
//   Without the index the key is only a convention, and a convention run twice gives LAWNS
//   thirty-eight orders. So the commit REFUSES and names the migration, exactly as the
//   delivery ingest does, rather than writing rows it cannot recognise on the next pass.
//
//   ⚠️ THE INDEX IS NOT PARTIAL, AND THAT IS THE LESSON OF THE DAY BEFORE THIS BUILD. The
//   delivery ingest's first index carried `WHERE qb_invoice_id IS NOT NULL`; Postgres infers a
//   partial index only when `ON CONFLICT` repeats the predicate, which PostgREST's column-list
//   `onConflict` cannot express — so the ingest failed on all 19 rows live, past 87 green
//   assertions. `20260831c` creates this one with NO predicate for that reason, and the test
//   double models the index rather than stamping any string ([[R-33]]).
// ══════════════════════════════════════════════════════════════════════════════
import {
  buildInvoiceOrderContent, type InvoiceOrderContent,
} from './invoiceOrderLines';
import type { QboShipmentRow } from './shipmentIngest';
import {
  buildHistoryOrder, HISTORY_ORDER_KIND, type HistoryOrderDraft,
} from '../business-logic/historyOrder';

/** `deliveries.source` the delivery ingest stamped. Only stops it wrote are candidates here. */
export const ORDER_INGEST_SOURCE = 'qbo-shipdate';

/** The migration this pass cannot run without, named so a refusal is actionable. */
export const ORDER_UIDX_MIGRATION = '20260831c_orders_qb_invoice_uidx.sql';

// ─── the delivery rows this pass is about ────────────────────────────────────

/** A stop already on the calendar, read ONLY to decide whether it needs an order. */
export interface StopNeedingOrder {
  id: string;
  customer_id: string | null;
  delivery_date: string | null;
  service_type: string | null;
  status: string | null;
  qb_invoice_id: string | null;
  order_id: string | null;
}

/** One stop as the operator reads it on the preview, before anything is written. */
export interface PlannedOrder {
  deliveryId: string;
  invoiceId: string;
  docNumber: string | null;
  deliveryDate: string | null;
  /** What the order will say the sale happened on — the invoice's own `TxnDate`. */
  saleDate: string | null;
  status: string;
  transportMethod: string;
  lineCount: number;
  /** Every line, so eighteen stops can be READ rather than trusted. */
  lines: { quantity: number; unitPrice: number; subtotal: number; description: string | null; sku: string | null }[];
  notes: string[];
  subtotal: number;
  tax: number;
  total: number;
  /** Σ line amounts === subtotal AND subtotal + tax === total. Reported, never corrected. */
  arithmeticBalances: boolean;
  lineSum: number;
  subtotalSource: InvoiceOrderContent['subtotalSource'];
  taxSource: InvoiceOrderContent['taxSource'];
  counts: InvoiceOrderContent['counts'];
}

/** A stop that will NOT get an order, and the reason in words an owner can act on. */
export interface OrderRefusal {
  deliveryId: string;
  invoiceId: string | null;
  docNumber: string | null;
  deliveryDate: string | null;
  reason: string;
}

/** A stop already joined to an order — reported so "nothing happened" is legible, never silent. */
export interface AlreadyOrdered {
  deliveryId: string;
  invoiceId: string;
  docNumber: string | null;
  /** Set when the invoice's order exists but the STOP was never joined to it — the repair case. */
  linkRepaired: boolean;
}

/** Per-lot `(on-hand, every order line summed)`. See the header — deliberately unfiltered. */
export type AvailabilityFingerprint = string;

export interface OrderIngestReport {
  ok: boolean;
  /** Set when the whole pass refuses. The missing unique index is the only current case. */
  blocker: string | null;
  /** Stops on the calendar that came from a QuickBooks invoice. The denominator. */
  qbStops: number;
  /** Those that already have an order — skipped, and the whole point of the key. */
  alreadyOrdered: AlreadyOrdered[];
  planned: PlannedOrder[];
  refusals: OrderRefusal[];
  /** Commit only. */
  ordersWritten: number;
  lineItemsWritten: number;
  deliveriesLinked: number;
  errors: { deliveryId: string; invoiceId: string | null; step: string; message: string }[];
  /** 🔴 The proof. Identical strings = not one lot's arithmetic moved. */
  availabilityBefore: AvailabilityFingerprint | null;
  availabilityAfter: AvailabilityFingerprint | null;
  availabilityUnchanged: boolean | null;
  /** Lines carrying a lot id. MUST be 0 — the run refuses before writing if it is not. */
  linesCarryingLot: number;
}

const round2 = (n: number) => Math.round((Number(n) || 0) * 100) / 100;

/**
 * Does `orders.qb_invoice_id` exist yet?
 *
 * Asked by SELECTING the column rather than by reading a catalog view, because the write runs
 * under the service key through PostgREST and PostgREST is what would reject it. Testing the
 * thing that will actually fail beats testing a proxy for it (the delivery ingest's own call).
 */
export async function qbInvoiceIdOnOrders(db: any): Promise<boolean> {
  const { error } = await db.from('orders').select('qb_invoice_id').limit(1);
  if (!error) return true;
  const s = `${error.code} ${error.message}`;
  if (/42703|PGRST204|PGRST200/.test(s) || /qb_invoice_id/i.test(s)) return false;
  // Any OTHER error is not an answer to this question — never report "absent" for a network
  // blip and then refuse with the wrong reason (D-9: an unknown must not read as a known).
  throw new Error(`Could not determine whether orders.qb_invoice_id exists: ${error.message}`);
}

/**
 * 🔴 THE FINGERPRINT. Every lot's on-hand, beside the sum of EVERY order line pointing at it
 * regardless of order status. See the file header for why the absence of a status filter is
 * the point rather than an omission.
 *
 * A read failure THROWS rather than returning an empty fingerprint. An empty one would compare
 * equal to another empty one and report "availability unchanged" over a proof that never ran —
 * a green check nobody performed, which is the exact class the owner-test gate exists for.
 */
export async function availabilityFingerprint(db: any, businessId: string): Promise<AvailabilityFingerprint> {
  const { data: lots, error: lotErr } = await db
    .from('business_inventory').select('id, qty').eq('business_id', businessId);
  if (lotErr) throw new Error(`Could not read this business's lots for the availability proof: ${lotErr.message}`);

  const { data: claimed, error: claimErr } = await db
    .from('order_items')
    .select('quantity, business_inventory_id, orders!inner(business_id)')
    .eq('orders.business_id', businessId);
  if (claimErr) throw new Error(`Could not read the order lines for the availability proof: ${claimErr.message}`);

  const perLot = new Map<string, number>();
  for (const row of (claimed ?? []) as { quantity: number; business_inventory_id: string | null }[]) {
    if (!row.business_inventory_id) continue;
    const q = Number(row.quantity ?? 0);
    if (!Number.isFinite(q)) continue;
    perLot.set(row.business_inventory_id, (perLot.get(row.business_inventory_id) ?? 0) + q);
  }
  return ((lots ?? []) as { id: string; qty: number | null }[])
    .map(l => `${l.id}:${Number(l.qty ?? 0)}:${perLot.get(l.id) ?? 0}`)
    .sort()
    .join('|');
}

/** The tenant's current state: the QuickBooks stops, and which invoices already have orders. */
export async function readOrderIngestState(db: any, businessId: string): Promise<{
  stops: StopNeedingOrder[];
  orderIdByInvoice: Map<string, string>;
}> {
  const { data: delRows, error: delErr } = await db
    .from('deliveries')
    .select('id, customer_id, delivery_date, service_type, status, qb_invoice_id, order_id')
    .eq('business_id', businessId)
    .not('qb_invoice_id', 'is', null);
  if (delErr) throw new Error(`Could not read this business's QuickBooks stops: ${delErr.message}`);

  const { data: ordRows, error: ordErr } = await db
    .from('orders').select('id, qb_invoice_id')
    .eq('business_id', businessId).not('qb_invoice_id', 'is', null);
  if (ordErr) throw new Error(`Could not read the orders already linked to a QuickBooks invoice: ${ordErr.message}`);

  const orderIdByInvoice = new Map<string, string>();
  for (const o of (ordRows ?? []) as { id: string; qb_invoice_id: string | null }[]) {
    if (o.qb_invoice_id) orderIdByInvoice.set(String(o.qb_invoice_id), o.id);
  }
  return { stops: (delRows ?? []) as StopNeedingOrder[], orderIdByInvoice };
}

/**
 * The draft for one stop, or the reason there is none. Pure given its inputs — the writer calls
 * it, and so does the preview, so a commit can never plan differently from what was read.
 */
export function planOrderForStop(
  stop: StopNeedingOrder, invoice: QboShipmentRow | undefined, businessId: string,
): { draft: HistoryOrderDraft; planned: PlannedOrder } | { refusal: string } {
  if (!invoice) {
    return { refusal: `QuickBooks invoice ${stop.qb_invoice_id} is no longer in the books, so there is nothing to put on this stop.` };
  }
  if (!stop.customer_id) {
    return { refusal: 'This stop has no customer on it, so an order would have nobody to belong to.' };
  }
  const content = buildInvoiceOrderContent({
    lines: invoice.lines, totalTax: invoice.totalTax, totalAmt: invoice.totalAmt,
  });
  if (content.lines.length === 0) {
    // Not an error and not silently skipped: an invoice of pure notes is a real thing, and a
    // zero-line order would be a sale record asserting nothing was sold.
    return { refusal: `Invoice ${invoice.docNumber ? `#${invoice.docNumber}` : stop.qb_invoice_id} has no billable lines — only notes and its own running total — so there is nothing to load.` };
  }

  const draft = buildHistoryOrder({
    businessId,
    customerId: stop.customer_id,
    // 🔴 NO RECEIPT. This invoice was read out of the seller's own books over the API; nobody
    // photographed anything, and minting a `receipts` row would record a scan that never
    // happened. The provenance lives in `qb_invoice_id`, which is a stronger key than a photo.
    receiptId: null,
    // WHEN THE SALE HAPPENED — the invoice's own TxnDate, never today and never created_at.
    // Backfilling nineteen sales in one afternoon must not report as that afternoon's revenue.
    documentDate: invoice.txnDate,
    documentTotal: Number(invoice.totalAmt ?? 0),
    lineItemsOriginal: null,
    lines: content.lines,
    decoded: {
      sourceDocumentNumber: invoice.docNumber,
      subtotal: content.subtotal,
      tax: content.tax,
      customerName: invoice.customerName,
      deliveryDate: stop.delivery_date,
    },
    notes: content.notes.length ? content.notes.join(' · ') : null,
    qbInvoiceId: invoice.id,
    qbDocNumber: invoice.docNumber,
    deliveryDate: stop.delivery_date ?? null,
    // ⚠️ NOT INFERRED, AND THAT IS DAVID'S CALL RATHER THAN A GAP. `deliveries.service_type` is
    // NULL on every ingested stop because an invoice does not state whether a stop is a planting
    // or a drop-off. It is passed through as whatever the stop holds, so the day a service type
    // is set the transport method follows automatically. `transportMethodForService(null)`
    // returns 'delivery' — the WEAKER of the two claims, deliberately.
    serviceType: stop.service_type,
    // The order's status FOLLOWS THE STOP. Every ingested stop reads 'scheduled' today, so these
    // land 'invoiced' — a real, paid sale that has not been delivered — never 'fulfilled'.
    deliveryStatus: stop.status,
  });

  return {
    draft,
    planned: {
      deliveryId: stop.id,
      invoiceId: invoice.id,
      docNumber: invoice.docNumber,
      deliveryDate: stop.delivery_date,
      saleDate: draft.order.sale_date,
      status: draft.order.status,
      transportMethod: draft.order.transport_method,
      lineCount: draft.items.length,
      lines: draft.items.map(l => ({
        quantity: l.quantity, unitPrice: l.unitPrice, subtotal: l.subtotal,
        description: l.description, sku: l.sku,
      })),
      notes: content.notes,
      subtotal: draft.order.subtotal,
      tax: draft.order.tax_amount,
      total: draft.order.total_amount,
      arithmeticBalances: draft.arithmeticBalances,
      lineSum: draft.lineSum,
      subtotalSource: content.subtotalSource,
      taxSource: content.taxSource,
      counts: content.counts,
    },
  };
}

/**
 * PLAN ONLY. Reads; writes nothing; returns exactly what a commit would do.
 *
 * The commit re-runs this planner against a fresh read rather than trusting a plan the browser
 * handed back — a plan that travelled through a client is a plan a client could edit, and the
 * money on it becomes a sale record in the seller's own reporting.
 */
export async function previewOrderIngest(
  db: any, businessId: string, shipments: QboShipmentRow[],
): Promise<OrderIngestReport> {
  const hasColumn = await qbInvoiceIdOnOrders(db);
  const state = hasColumn
    ? await readOrderIngestState(db, businessId)
    : { stops: [] as StopNeedingOrder[], orderIdByInvoice: new Map<string, string>() };

  const byInvoiceId = new Map(shipments.map(s => [s.id, s]));
  const planned: PlannedOrder[] = [];
  const refusals: OrderRefusal[] = [];
  const alreadyOrdered: AlreadyOrdered[] = [];
  let linesCarryingLot = 0;

  for (const stop of state.stops) {
    const invoiceId = String(stop.qb_invoice_id);
    const existingOrder = state.orderIdByInvoice.get(invoiceId);
    if (existingOrder) {
      // 🔴 THE KEY DOING ITS JOB. The invoice already has an order and gets NOTHING — no second
      // order, no update. The only thing that can still be owed is the JOIN, when a previous run
      // wrote the order and then failed before linking the stop (per-row isolation makes that a
      // real state rather than a hypothetical one).
      alreadyOrdered.push({
        deliveryId: stop.id, invoiceId,
        docNumber: byInvoiceId.get(invoiceId)?.docNumber ?? null,
        linkRepaired: !stop.order_id,
      });
      continue;
    }
    if (stop.order_id) {
      // The stop already points at an order that carries no invoice id — a hand-entered stop
      // that was linked by another door. Left completely alone and reported.
      refusals.push({
        deliveryId: stop.id, invoiceId, docNumber: byInvoiceId.get(invoiceId)?.docNumber ?? null,
        deliveryDate: stop.delivery_date,
        reason: 'This stop is already joined to an order that did not come from this invoice. TRACE will not replace it.',
      });
      continue;
    }
    const outcome = planOrderForStop(stop, byInvoiceId.get(invoiceId), businessId);
    if ('refusal' in outcome) {
      refusals.push({
        deliveryId: stop.id, invoiceId, docNumber: byInvoiceId.get(invoiceId)?.docNumber ?? null,
        deliveryDate: stop.delivery_date, reason: outcome.refusal,
      });
      continue;
    }
    linesCarryingLot += outcome.draft.items.filter(l => l.businessInventoryId !== null).length;
    planned.push(outcome.planned);
  }

  console.log('[TRACE:QBORDERS] preview', {
    businessId, hasColumn,
    invoicesInHand: shipments.length,
    qbStops: state.stops.length,
    toWrite: planned.length,
    alreadyOrdered: alreadyOrdered.length,
    linksToRepair: alreadyOrdered.filter(a => a.linkRepaired).length,
    refusals: refusals.length,
    linesToWrite: planned.reduce((a, p) => a + p.lineCount, 0),
    notBalancing: planned.filter(p => !p.arithmeticBalances).length,
    linesCarryingLot,
  });

  return {
    ok: hasColumn,
    blocker: hasColumn ? null
      : `The migration ${ORDER_UIDX_MIGRATION} has not been applied yet. Until it is, this pass cannot recognise an invoice that already has an order, and running it twice would give every stop a second one. Apply it in the Supabase SQL editor, then run this again.`,
    qbStops: state.stops.length,
    alreadyOrdered, planned, refusals,
    ordersWritten: 0, lineItemsWritten: 0, deliveriesLinked: 0, errors: [],
    availabilityBefore: null, availabilityAfter: null, availabilityUnchanged: null,
    linesCarryingLot,
  };
}

/**
 * WRITE. The order, then its lines, then the join — in that order, per stop.
 *
 * 🔴 PER-ROW FAILURE IS ISOLATED AND REPORTED, NEVER FATAL AND NEVER SILENT. Nineteen stops are
 * nineteen independent facts; one unreadable invoice must not cost Lauren the other eighteen.
 * Each failure lands in `errors` with the stop it belongs to ([[R-18]]), and the SECOND run picks
 * up exactly what the first one missed — including an order that landed with no join, which the
 * preview reports as `linkRepaired` rather than as a duplicate.
 */
export async function commitOrderIngest(
  db: any, businessId: string, shipments: QboShipmentRow[],
): Promise<OrderIngestReport> {
  const report = await previewOrderIngest(db, businessId, shipments);
  if (!report.ok) {
    console.log('[TRACE:QBORDERS] commit REFUSED — precondition not met', { businessId, blocker: report.blocker });
    return report;
  }
  // ② THE PAYLOAD GUARD. A type cannot see a hand-built object, and this is the one place where
  // proceeding is worse than stopping: a lot id here silently reduces what the business can sell.
  if (report.linesCarryingLot > 0) {
    console.log('[TRACE:QBORDERS] commit REFUSED — a planned line carries a lot id', { businessId, linesCarryingLot: report.linesCarryingLot });
    return {
      ...report, ok: false,
      blocker: `${report.linesCarryingLot} planned line(s) carry a stock lot id. A history order never holds stock, and writing these would silently reduce what this business can sell. Nothing was written.`,
    };
  }

  const availabilityBefore = await availabilityFingerprint(db, businessId);

  const state = await readOrderIngestState(db, businessId);
  const byInvoiceId = new Map(shipments.map(s => [s.id, s]));
  const plannedIds = new Set(report.planned.map(p => p.deliveryId));
  const errors: OrderIngestReport['errors'] = [];
  let ordersWritten = 0, lineItemsWritten = 0, deliveriesLinked = 0;

  // The repair pass first — a stop whose order already exists and was never joined. Cheap,
  // and it means a half-finished previous run resolves before anything new is written.
  for (const a of report.alreadyOrdered.filter(x => x.linkRepaired)) {
    const orderId = state.orderIdByInvoice.get(a.invoiceId);
    if (!orderId) continue;
    const { data, error } = await db.from('deliveries')
      .update({ order_id: orderId })
      .eq('id', a.deliveryId).eq('business_id', businessId).is('order_id', null).select('id');
    if (error) { errors.push({ deliveryId: a.deliveryId, invoiceId: a.invoiceId, step: 'link-repair', message: error.message }); continue; }
    // A8 — PostgREST reports NO ERROR when an UPDATE matches zero rows, so an unrepaired stop
    // would look exactly like a repaired one. Zero here means the `order_id IS NULL` guard did
    // not hold: another tab joined it a moment ago. Benign, and said out loud rather than
    // counted as a repair that did not happen.
    if ((data ?? []).length === 1) { deliveriesLinked++; continue; }
    console.log('[TRACE:QBORDERS] link repair matched no rows — the stop was joined by someone else between the read and the write', { deliveryId: a.deliveryId, invoiceId: a.invoiceId });
  }

  for (const stop of state.stops) {
    if (!plannedIds.has(stop.id)) continue;                 // obey the plan the operator read
    const invoiceId = String(stop.qb_invoice_id);
    if (state.orderIdByInvoice.has(invoiceId)) continue;    // won by another tab between reads
    const outcome = planOrderForStop(stop, byInvoiceId.get(invoiceId), businessId);
    if ('refusal' in outcome) continue;                     // already reported in `refusals`

    let orderId: string;
    try {
      // 🔴 UPSERT-IGNORE, NOT INSERT. The unique index is the guarantee; this is how the code
      // cooperates with it instead of racing it. A second operator pressing this at the same
      // moment loses the race harmlessly rather than raising a 23505 that reads like a defect.
      const { data, error } = await db.from('orders')
        .upsert(outcome.draft.order, { onConflict: 'business_id,qb_invoice_id', ignoreDuplicates: true })
        .select('id');
      if (error) throw new Error(error.message);
      // R-12 — a write must prove it wrote, and the proof is the COUNT. `ignoreDuplicates`
      // returns ZERO rows on a conflict, which is success rather than failure — but counting a
      // zero as a write would report nineteen orders over a run that created none.
      if ((data ?? []).length !== 1) {
        console.log('[TRACE:QBORDERS] invoice already had an order at write time — the unique index refused a duplicate, which is the index doing its job', { invoiceId });
        continue;
      }
      orderId = (data as { id: string }[])[0].id;
      ordersWritten++;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      console.log('[TRACE:QBORDERS] order insert FAILED — stop skipped, others continue', { deliveryId: stop.id, invoiceId, message });
      errors.push({ deliveryId: stop.id, invoiceId, step: 'order', message });
      continue;
    }

    const { data: wroteLines, error: lineErr } = await db.from('order_items').insert(
      outcome.draft.items.map(l => ({
        order_id: orderId,
        quantity: l.quantity,
        unit_price: l.unitPrice,
        subtotal: l.subtotal,
        description: l.description,
        sku: l.sku,
        business_inventory_id: l.businessInventoryId,   // null — the invariant, at the write
      })),
    ).select('id');
    if (lineErr) {
      // 🔴 A SALE RECORD WITH NO LINES IS WORSE THAN NO SALE RECORD, AND IT IS UNREPAIRABLE BY
      // THE NEXT RUN. The invoice would then HAVE an order, so idempotency correctly skips it
      // forever — and the dashboard reports its revenue with nothing behind it. There is no
      // transaction across two PostgREST calls, so the compensation is explicit: delete the
      // order we created microseconds ago. It has no lines and no stop pointing at it, so the
      // delete restores the exact pre-state and the NEXT run re-plans this invoice as new.
      // Reported either way — the incident is logged whether or not the repair succeeded (R-18).
      console.log('[TRACE:QBORDERS] line insert FAILED — rolling the order back so the next run can retry it', { deliveryId: stop.id, invoiceId, orderId, message: lineErr.message });
      // A8 on the DELETE, and here it matters more than usual: a delete that matches zero rows
      // returns no error, so a failed rollback would report as a clean one and the empty order
      // would sit in the seller's revenue forever, skipped by idempotency on every future run.
      const { data: undone, error: undoErr } = await db.from('orders')
        .delete().eq('id', orderId).eq('business_id', businessId).select('id');
      const rolledBack = !undoErr && (undone ?? []).length === 1;
      if (rolledBack) ordersWritten--;
      errors.push({
        deliveryId: stop.id, invoiceId, step: 'order_items',
        message: rolledBack
          ? `${lineErr.message} — the order was rolled back, so running this again will retry this stop from the start.`
          : `${lineErr.message} — and the empty order could not be removed${undoErr ? ` (${undoErr.message})` : ' (nothing matched)'}. Order ${orderId} has no lines on it; delete it before running this again.`,
      });
      continue;   // no join: a stop must never point at an order that was just withdrawn
    }
    lineItemsWritten += (wroteLines ?? []).length;

    const { data: linked, error: linkErr } = await db.from('deliveries')
      .update({ order_id: orderId })
      .eq('id', stop.id).eq('business_id', businessId).is('order_id', null).select('id');
    if (linkErr) {
      errors.push({ deliveryId: stop.id, invoiceId, step: 'delivery-link', message: linkErr.message });
    } else if ((linked ?? []).length !== 1) {
      // A8 — PostgREST reports NO ERROR when an UPDATE matches zero rows, so an unlinked stop
      // would look exactly like a linked one. The join IS the feature; a silent miss is not one.
      console.log('[TRACE:QBORDERS] delivery link matched no rows — the order exists and the stop does not point at it', { deliveryId: stop.id, invoiceId, orderId });
      errors.push({ deliveryId: stop.id, invoiceId, step: 'delivery-link', message: 'The order was created but the stop was not joined to it. Run this again — the repair pass will finish the join.' });
    } else {
      deliveriesLinked++;
    }
  }

  const availabilityAfter = await availabilityFingerprint(db, businessId);
  const availabilityUnchanged = availabilityBefore === availabilityAfter;

  console.log('[TRACE:QBORDERS] commit COMPLETE', {
    businessId, ordersWritten, lineItemsWritten, deliveriesLinked,
    alreadyOrdered: report.alreadyOrdered.length, refusals: report.refusals.length,
    errors: errors.length,
    availabilityUnchanged,
    orderKind: HISTORY_ORDER_KIND,
  });
  if (!availabilityUnchanged) {
    console.log('[TRACE:QBORDERS] 🔴 AVAILABLE-TO-SELL MOVED — a history order is not permitted to do this', { businessId });
  }

  return {
    ...report, ordersWritten, lineItemsWritten, deliveriesLinked, errors,
    availabilityBefore, availabilityAfter, availabilityUnchanged,
  };
}

/** Σ of a plan's line amounts, for a screen that wants one number. Exported so the UI does not
 *  hand-roll a second reduce over the same field (§6 r8, in miniature). */
export function plannedLoadTotal(planned: PlannedOrder[]): number {
  return round2(planned.reduce((a, p) => a + p.total, 0));
}
