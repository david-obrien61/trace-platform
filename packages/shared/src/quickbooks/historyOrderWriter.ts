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

/**
 * 🔴 AN ORDER THIS BUSINESS ALREADY HOLDS FOR THIS INVOICE, WHICH THE KEY COULD NOT SEE.
 * Reported ALWAYS — on the preview before anything is written and in the commit's own result —
 * because the one thing that must never happen here is a quiet reconciliation.
 */
export interface PriorOrderFinding {
  deliveryId: string;
  invoiceId: string;
  docNumber: string | null;
  deliveryDate: string | null;
  /** `same-invoice` is the only one that writes anything, and all it writes is the id. */
  kind: 'same-invoice' | 'probable' | 'ambiguous';
  orderId: string | null;
  rule: string;
  evidence: string;
  /** Commit only: did the id actually land on the existing order? */
  idRecorded?: boolean;
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
  /** 🔴 Invoices this business already has an order for, under a different name. NEVER silent. */
  priorOrders: PriorOrderFinding[];
  /** Commit only. */
  ordersWritten: number;
  /** Commit only: existing orders that had this invoice's id RECORDED on them. Never more. */
  idsRecorded: number;
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
  /** Orders carrying NO `qb_invoice_id` — invisible to the key, and the duplication hazard. */
  priors: PriorOrder[];
}> {
  const { data: delRows, error: delErr } = await db
    .from('deliveries')
    .select('id, customer_id, delivery_date, service_type, status, qb_invoice_id, order_id')
    .eq('business_id', businessId)
    .not('qb_invoice_id', 'is', null);
  if (delErr) throw new Error(`Could not read this business's QuickBooks stops: ${delErr.message}`);

  // 🔴 EVERY ORDER, NOT ONLY THE ONES CARRYING AN INVOICE ID — because the ones WITHOUT one are
  // exactly the ones the idempotency key is blind to, and they are the ones that would be
  // duplicated. One read, both purposes: the ids build the key's map, the rest become the
  // candidate set for the prior-order guard.
  const { data: ordRows, error: ordErr } = await db
    .from('orders')
    .select('id, qb_invoice_id, customer_id, sale_date, total_amount, source_document_number, order_kind')
    .eq('business_id', businessId);
  if (ordErr) throw new Error(`Could not read this business's existing orders: ${ordErr.message}`);

  const orderIdByInvoice = new Map<string, string>();
  const priors: PriorOrder[] = [];
  type OrderRow = PriorOrder & { qb_invoice_id: string | null };
  for (const o of (ordRows ?? []) as OrderRow[]) {
    if (o.qb_invoice_id) { orderIdByInvoice.set(String(o.qb_invoice_id), o.id); continue; }
    priors.push({
      id: o.id, customer_id: o.customer_id, sale_date: o.sale_date,
      total_amount: o.total_amount, source_document_number: o.source_document_number,
      order_kind: o.order_kind,
    });
  }
  return { stops: (delRows ?? []) as StopNeedingOrder[], orderIdByInvoice, priors };
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


// ─── 🔴 THE PRIOR-ORDER GUARD — the key is BLIND to the orders that matter most ──────────
//
// 🔴 THE NINE OCR HISTORY ORDERS AT LAWNS CARRY NO `qb_invoice_id`. They were transcribed from
//   PHOTOGRAPHS of paper invoices, so nothing in that path ever held an Intuit id. The
//   idempotency key therefore CANNOT SEE THEM, and an ingest keyed only on that column would
//   create a SECOND order for every sale that was already captured — a duplicate sale in the
//   seller's own revenue reporting, silent and permanent.
//
//   ⚠️ THIS IS THE THIRY SHAPE AT NINE TIMES THE SIZE. The delivery ingest hit the identical
//   defect one day earlier: Thiry's stop was entered BY HAND, so it carried no `qb_invoice_id`
//   and the key could not see it either. The answer there was a second guard keyed on the
//   CUSTOMER rather than on the id. The answer here is the same in shape and stricter in
//   substance, because an order carries money and a stop does not.
//
// 🔴 AND IT IS NOT THEORETICAL. Seven of the eighteen future-dated invoices in the 2026-08-29
//   capture carry a `TxnDate` of 26 or 27 August — the exact window the nine OCR orders were
//   captured in. Six of them share ONE date, 2026-08-27. A date-and-amount guess across six
//   same-day invoices is precisely where a careless match cross-links the wrong pair.
//
// 🔴 THE PRIMARY KEY IS THEIR OWN DOCUMENT NUMBER, NOT AN INFERENCE. `orders.source_document_
//   number` holds "the number printed on the SOURCE DOCUMENT — for a history order that is
//   LAWNS's own QuickBooks number" (20260827_history_orders.sql), which is the SAME string
//   Intuit returns as `Invoice.DocNumber`. A match on it is an IDENTITY, not a guess.
//
//   The three fields David named — customer, date, amount — are then CORROBORATION rather than
//   the key, and that ordering is [[D-47]]'s three-way rule, whose scar is #53: matching on one
//   field the external system permits to collide cross-billed nine real invoices.
//
// 🔴 ONLY AN IDENTITY BACKFILLS. Everything else STOPS AND REPORTS.
//     · document number matches AND all three corroborate  → SAME INVOICE. Record the id on the
//       existing order, create nothing, and join the stop to it.
//     · document number matches but a field DISAGREES      → REPORT. Same document, different
//       money is a thing to look at, not a thing to reconcile.
//     · no document number, but ≥2 of the three agree      → REPORT. However strong, it is an
//       inference, and an inference that writes an id is permanent: the key would skip that
//       order forever, rightly or wrongly.
//     · more than one candidate either way                 → REPORT. Never pick.
//   A reported invoice costs David a minute. A duplicate sale is silent and lives in their books.

/** An order this tenant already holds that carries NO Intuit invoice id — invisible to the key. */
export interface PriorOrder {
  id: string;
  customer_id: string | null;
  sale_date: string | null;
  total_amount: number | null;
  source_document_number: string | null;
  order_kind: string | null;
}

export type PriorOrderMatch =
  /** Nothing this tenant holds looks like this invoice. Create the order. */
  | { kind: 'none' }
  /** Provably the same sale. Record the id on the existing order; create nothing. */
  | { kind: 'same-invoice'; orderId: string; rule: string; evidence: string }
  /** Looks like the same sale but is not proven. Create nothing, and say why. */
  | { kind: 'probable'; orderId: string; rule: string; evidence: string }
  /** More than one candidate. Create nothing, and never pick. */
  | { kind: 'ambiguous'; rule: string; evidence: string };

/** Document numbers are compared as the strings a human types: trimmed, case- and space-blind. */
function normalizeDocNumber(v: string | null | undefined): string | null {
  const s = String(v ?? '').trim().toLowerCase().replace(/\s+/g, '');
  return s === '' ? null : s;
}

/** Money is compared in CENTS. `4864.21 !== 4864.209999` is a floating-point fact, not a
 *  business one, and it would turn an identity into a "probable" on some invoices and not others. */
function cents(v: number | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

/** Which of David's three fields agree, which differ, and which could not be compared.
 *  🔴 A NULL ON EITHER SIDE IS `unknown`, NEVER `agrees` — an absent field must not corroborate
 *  anything (A9: absent is not empty). Two orders that both lack a sale_date have not matched
 *  on date; they have simply failed to disagree. */
function corroborate(
  prior: PriorOrder,
  invoice: { customerId: string | null; saleDate: string | null; total: number | null },
): { agreed: string[]; differed: string[]; unknown: string[] } {
  const agreed: string[] = [], differed: string[] = [], unknown: string[] = [];
  const cmp = (name: string, a: unknown, b: unknown) => {
    if (a === null || a === undefined || b === null || b === undefined) unknown.push(name);
    else if (a === b) agreed.push(name);
    else differed.push(name);
  };
  cmp('customer', prior.customer_id, invoice.customerId);
  cmp('date',     prior.sale_date,   invoice.saleDate);
  cmp('amount',   cents(prior.total_amount), cents(invoice.total));
  return { agreed, differed, unknown };
}

function describe(prior: PriorOrder, c: ReturnType<typeof corroborate>): string {
  const bits: string[] = [];
  if (c.agreed.length)   bits.push(`${c.agreed.join(', ')} agree`);
  if (c.differed.length) bits.push(`${c.differed.join(', ')} DIFFER`);
  if (c.unknown.length)  bits.push(`${c.unknown.join(', ')} not recorded on the existing order`);
  const kind = prior.order_kind === 'history' ? 'a captured-invoice order' : 'a checkout order';
  return `${kind} (${prior.source_document_number ? `doc #${prior.source_document_number}` : 'no document number'}, ${prior.sale_date ?? 'no sale date'}, $${Number(prior.total_amount ?? 0).toFixed(2)}) — ${bits.join(' · ') || 'nothing comparable'}`;
}

/**
 * Does this tenant ALREADY hold an order for this invoice, under a different name?
 *
 * `priors` must be the orders carrying NO `qb_invoice_id` — the ones the key cannot see. An order
 * that already has one was handled by the key and must not be reconsidered here.
 */
export function matchPriorHistoryOrder(
  invoice: { docNumber: string | null; customerId: string | null; saleDate: string | null; total: number | null },
  priors: PriorOrder[],
): PriorOrderMatch {
  // ── ① THEIR OWN DOCUMENT NUMBER. An identity, not a guess. ──────────────────
  const doc = normalizeDocNumber(invoice.docNumber);
  if (doc) {
    const byDoc = priors.filter(p => normalizeDocNumber(p.source_document_number) === doc);
    if (byDoc.length > 1) {
      return {
        kind: 'ambiguous',
        rule: 'document number matches more than one existing order → REPORT',
        evidence: `${byDoc.length} orders this business already holds carry document number ${invoice.docNumber}. TRACE will not guess which one this invoice is.`,
      };
    }
    if (byDoc.length === 1) {
      const p = byDoc[0];
      const c = corroborate(p, invoice);
      if (c.differed.length === 0) {
        return {
          kind: 'same-invoice',
          orderId: p.id,
          rule: 'document number matches, and customer, date and amount corroborate → SAME SALE',
          evidence: describe(p, c),
        };
      }
      // 🔴 A CONTRADICTION IS NOT A WEAK MATCH, IT IS A REASON TO STOP. Same printed number and
      // different money means one of the two records is wrong, and writing an id would freeze
      // that disagreement in place where the key will skip it forever.
      return {
        kind: 'probable',
        orderId: p.id,
        rule: 'document number matches but a field DISAGREES → REPORT, never reconcile',
        evidence: describe(p, c),
      };
    }
  }

  // ── ② DAVID'S THREE FIELDS, WITH NO DOCUMENT NUMBER TO ANCHOR THEM. ────────
  // Two of three is enough to STOP. It is deliberately a low bar: this is a set of nine orders,
  // a false stop costs one line on a screen, and the failure it prevents is a duplicate sale.
  const scored = priors
    .map(p => ({ p, c: corroborate(p, invoice) }))
    .filter(x => x.c.agreed.length >= 2 && x.c.differed.length <= 1);
  if (scored.length > 1) {
    return {
      kind: 'ambiguous',
      rule: 'more than one existing order looks like this sale → REPORT',
      evidence: `${scored.length} orders this business already holds match on at least two of customer, date and amount. TRACE will not guess which one this invoice is, and will not create a second.`,
    };
  }
  if (scored.length === 1) {
    return {
      kind: 'probable',
      orderId: scored[0].p.id,
      rule: 'no document number to match on, but customer/date/amount line up → REPORT',
      evidence: describe(scored[0].p, scored[0].c),
    };
  }
  return { kind: 'none' };
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
    : { stops: [] as StopNeedingOrder[], orderIdByInvoice: new Map<string, string>(), priors: [] as PriorOrder[] };

  const byInvoiceId = new Map(shipments.map(s => [s.id, s]));
  const planned: PlannedOrder[] = [];
  const refusals: OrderRefusal[] = [];
  const alreadyOrdered: AlreadyOrdered[] = [];
  const priorOrders: PriorOrderFinding[] = [];
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

    // 🔴 THE PRIOR-ORDER GUARD. Runs on a plan that is otherwise READY TO WRITE, which is the
    // correct place for it: the money and the customer are resolved, so the guard compares the
    // order that WOULD be created against the orders that already exist.
    const prior = matchPriorHistoryOrder(
      {
        docNumber: byInvoiceId.get(invoiceId)?.docNumber ?? null,
        customerId: stop.customer_id,
        saleDate: outcome.draft.order.sale_date,
        total: outcome.draft.order.total_amount,
      },
      state.priors,
    );
    if (prior.kind !== 'none') {
      priorOrders.push({
        deliveryId: stop.id, invoiceId,
        docNumber: byInvoiceId.get(invoiceId)?.docNumber ?? null,
        deliveryDate: stop.delivery_date,
        kind: prior.kind,
        orderId: 'orderId' in prior ? prior.orderId : null,
        rule: prior.rule, evidence: prior.evidence,
      });
      // NOTHING is planned for it either way. `same-invoice` records an id on the order that
      // already exists; the other two write nothing at all. Neither creates a second sale.
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
    // 🔴 The three the key could not see, counted separately — a run that quietly created nine
    // duplicate sales would look identical to a clean one without these.
    priorSameInvoice: priorOrders.filter(p => p.kind === 'same-invoice').length,
    priorProbable:    priorOrders.filter(p => p.kind === 'probable').length,
    priorAmbiguous:   priorOrders.filter(p => p.kind === 'ambiguous').length,
    priorsConsidered: state.priors.length,
  });

  return {
    ok: hasColumn,
    blocker: hasColumn ? null
      : `The migration ${ORDER_UIDX_MIGRATION} has not been applied yet. Until it is, this pass cannot recognise an invoice that already has an order, and running it twice would give every stop a second one. Apply it in the Supabase SQL editor, then run this again.`,
    qbStops: state.stops.length,
    alreadyOrdered, planned, refusals, priorOrders,
    ordersWritten: 0, idsRecorded: 0, lineItemsWritten: 0, deliveriesLinked: 0, errors: [],
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
  const byInvoiceIdForIds = byInvoiceId;
  const plannedIds = new Set(report.planned.map(p => p.deliveryId));
  const errors: OrderIngestReport['errors'] = [];
  let ordersWritten = 0, lineItemsWritten = 0, deliveriesLinked = 0, idsRecorded = 0;
  const priorOrders: PriorOrderFinding[] = report.priorOrders.map(p => ({ ...p }));

  // ── 🔴 THE ID-RECORDING PASS. Runs FIRST, and it is the only write in this file that touches
  // an order somebody else created. It writes TWO COLUMNS — `qb_invoice_id` and `qb_doc_number` —
  // and nothing else: not the money, not the status, not the dates, not a single line. The
  // existing order is the record of that sale and stays exactly as it was captured.
  //
  // Only a `same-invoice` verdict reaches here: their own document number matched AND customer,
  // date and amount all corroborated. `probable` and `ambiguous` write NOTHING and are reported.
  //
  // ⚠️ WHAT THIS ACHIEVES IS PERMANENCE. Once the id is on the row, the ordinary key sees it and
  // every future run skips this invoice for the right reason instead of re-deriving the match.
  for (const finding of priorOrders) {
    if (finding.kind !== 'same-invoice' || !finding.orderId) continue;
    const invoice = byInvoiceIdForIds.get(finding.invoiceId);
    const { data, error } = await db.from('orders')
      .update({ qb_invoice_id: finding.invoiceId, qb_doc_number: invoice?.docNumber ?? null })
      .eq('id', finding.orderId).eq('business_id', businessId).is('qb_invoice_id', null)
      .select('id');
    // A8, INSPECTED ON THE LINE AFTER THE WRITE. Zero rows means the `qb_invoice_id IS NULL`
    // guard did not hold — benign (another run got there first), but it is NOT a recording THIS
    // run performed, and counting it as one would report work that did not happen. PostgREST
    // returns no error for a zero-row UPDATE, so without this the two are indistinguishable.
    const landed = !error && (data ?? []).length === 1;
    if (error) {
      console.log('[TRACE:QBORDERS] recording the invoice id on an existing order FAILED', { orderId: finding.orderId, invoiceId: finding.invoiceId, message: error.message });
      errors.push({ deliveryId: finding.deliveryId, invoiceId: finding.invoiceId, step: 'record-invoice-id', message: error.message });
      finding.idRecorded = false;
      continue;
    }
    finding.idRecorded = landed;
    if (landed) { idsRecorded++; state.orderIdByInvoice.set(finding.invoiceId, finding.orderId); }
    else console.log('[TRACE:QBORDERS] the existing order already carried an invoice id — nothing recorded', { orderId: finding.orderId, invoiceId: finding.invoiceId });
  }

  // 🔴 AND THE STOP IS JOINED TO THE ORDER THAT ALREADY EXISTED. Its load was always there; the
  // stop simply had no way to point at it. Guarded `order_id IS NULL` so a stop that already has
  // one is untouched.
  for (const finding of priorOrders) {
    if (finding.kind !== 'same-invoice' || !finding.orderId || finding.idRecorded === false) continue;
    const { data, error } = await db.from('deliveries')
      .update({ order_id: finding.orderId })
      .eq('id', finding.deliveryId).eq('business_id', businessId).is('order_id', null).select('id');
    if (error) { errors.push({ deliveryId: finding.deliveryId, invoiceId: finding.invoiceId, step: 'link-prior', message: error.message }); continue; }
    if ((data ?? []).length === 1) deliveriesLinked++;
  }

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
    businessId, ordersWritten, idsRecorded, lineItemsWritten, deliveriesLinked,
    alreadyOrdered: report.alreadyOrdered.length, refusals: report.refusals.length,
    priorSameInvoice: priorOrders.filter(p => p.kind === 'same-invoice').length,
    priorLeftForDavid: priorOrders.filter(p => p.kind !== 'same-invoice').length,
    errors: errors.length,
    availabilityUnchanged,
    orderKind: HISTORY_ORDER_KIND,
  });
  if (!availabilityUnchanged) {
    console.log('[TRACE:QBORDERS] 🔴 AVAILABLE-TO-SELL MOVED — a history order is not permitted to do this', { businessId });
  }

  return {
    ...report, ordersWritten, idsRecorded, lineItemsWritten, deliveriesLinked, errors, priorOrders,
    availabilityBefore, availabilityAfter, availabilityUnchanged,
  };
}

/** Σ of a plan's line amounts, for a screen that wants one number. Exported so the UI does not
 *  hand-roll a second reduce over the same field (§6 r8, in miniature). */
export function plannedLoadTotal(planned: PlannedOrder[]): number {
  return round2(planned.reduce((a, p) => a + p.total, 0));
}
