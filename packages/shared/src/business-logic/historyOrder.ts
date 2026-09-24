// ============================================================
// historyOrder — the ONE definition of "a captured document becomes an order"
// ============================================================
// PURPOSE:      Turn a captured source document into an `orders` row + `order_items` rows,
//               WITHOUT that order behaving like a sale this platform made. THREE writers now:
//               the backfill script (existing documents), the OCR door (a photographed invoice),
//               and — since 2026-08-31 — the QuickBooks door (the seller's own invoice, read
//               straight out of their books over the API, with no photograph in between).
//
// ⚠️ THE THIRD DOOR IS WHY `receiptId` IS NULLABLE AND WHY `lines` MAY BE SUPPLIED. Both are
//    documented at their own declarations. What did NOT move is either invariant below — a
//    door that reached them differently would be the drift this file exists to prevent.
// DEPENDENCIES: none — pure. No db handle, no network, no env. Both callers own their transport.
// OUTPUTS:      HISTORY_ORDER_KIND · historyOrderStatus / isDeliveryComplete · decodeCapturedDocument ·
//               transportMethodForService · historyOrderLines · HistoryOrderLine · buildHistoryOrder.
// ============================================================
//
// 🔴 WHY THIS FILE EXISTS AT ALL — §6 r8. Two writers need the same OPERATION, and the rule is
//    that the same operation lives in exactly one place even when the code would differ. The
//    backfill talks SQL, the endpoint talks supabase-js; what they SHARE is the derivation and,
//    far more importantly, THE TWO INVARIANTS BELOW. A second hand-rolled copy is how one of
//    them quietly loses an invariant six months from now.
//
// 🔴 THE TWO INVARIANTS. A history order is already paid, already in the seller's own
//    QuickBooks, and its stock left the property before this platform existed. So:
//
//    (1) `business_inventory_id` IS NULL ON EVERY LINE. Not "usually null" — null, always, and
//        the type says so (`businessInventoryId: null`). These are SKUs transcribed off a piece
//        of paper; they are not lots this platform ever held, so a link would be a claim we
//        cannot support (A9). It is also load-bearing: D-52 derives COMMITTED stock by joining
//        order_items → orders and summing quantity, so a lot id here would silently reduce what
//        the business can sell — no decrement, no ledger row, nothing to reverse and nothing to
//        notice (inventoryStates.ts:82-109; the loop skips a null lot at :99).
//
//    (2) STATUS FOLLOWS THE DELIVERY — 'fulfilled' once it is complete, 'invoiced' until then.
//        ⚠️ CORRECTED 2026-08-27: this used to say "status IS 'fulfilled'", chosen because
//        `holdsCommitment()` excludes only 'fulfilled' and 'cancelled'. That was a mechanical
//        reason, not a true one, and it put eight orders in a state their own delivery rows
//        contradicted.
//        ⚠️ RENAMED 2026-08-28 (R-STATUS RATIFIED): the not-yet-delivered value was 'confirmed'
//        and is now 'invoiced'. This is a VOCABULARY change, not a behavioural one — 'confirmed'
//        held a commitment and 'invoiced' holds a commitment, so nothing about reserved stock
//        moves. The old header warned "do not substitute 'invoiced', it is absent from
//        ORDER_STATUSES and begins counting as open the day that enum is ratified." That day is
//        today, and the warning has been answered rather than ignored: 'invoiced' is now IN the
//        enum, it counts as open, and that is correct for a sale awaiting delivery. What has NOT
//        changed is the danger it named — invariant (1) is still load-bearing ALONE, because an
//        open status plus a lot id would silently reduce what the business can sell.
//
//    Both, not either. Belt and braces, because each alone is one edit away from failing.

/** The discriminator value. NULL on an ordinary checkout order; this on a transcribed one. */
export const HISTORY_ORDER_KIND = 'history';

/**
 * 🔴 STATUS FOLLOWS THE DELIVERY. IT IS NOT A CONSTANT, AND IT USED TO BE — THAT WAS THE DEFECT.
 *
 * The first version of this module hardcoded `'fulfilled'` for every history order, and the reason
 * was MECHANICAL rather than true: `holdsCommitment()` excludes exactly two statuses, `fulfilled`
 * and `cancelled`, so `fulfilled` was picked to keep the order out of the committed-stock join.
 * Nobody checked whether it was a true statement about the world. It was not. Eight orders shipped
 * reading `fulfilled` while their own delivery rows read `scheduled` — four of them for a Saturday
 * that had not happened yet, one for a date three weeks out. **The data contradicted itself, and
 * the contradiction was visible on one screen.**
 *
 * The rule now:
 *   delivery complete            → 'fulfilled'   (the plants actually left)
 *   delivery scheduled / pending → 'invoiced'    (a real, paid sale that has not been delivered)
 *   no delivery row at all       → 'invoiced'    (see the note below — we cannot assert delivery)
 *
 * 🔴 AND THE THING TO BE CAREFUL ABOUT, STATED WHERE THE CHANGE IS: `invoiced` DOES HOLD A
 * COMMITMENT in the D-52 derivation — exactly as its predecessor `confirmed` did, which is why the
 * 2026-08-28 vocabulary change moved no stock. It is safe here for exactly ONE reason —
 * `business_inventory_id` is null on every history line — which means that invariant has stopped
 * being belt-and-braces and is now the ONLY thing holding the line. It is typed as the literal
 * `null` on HistoryOrderLine so that setting a lot id is a COMPILE error, and
 * `historyOrder.test.ts` §A asserts it from both directions. Do not weaken either without
 * re-proving available-to-sell across every lot.
 */
export const HISTORY_ORDER_STATUS_DELIVERED = 'fulfilled';
export const HISTORY_ORDER_STATUS_PENDING   = 'invoiced';

/**
 * Which delivery states mean the goods have actually gone.
 *
 * ⚠️ MEASURED, NOT ASSUMED: as of 2026-08-27 `deliveries.status` has exactly ONE value across every
 * tenant — `'scheduled'` — and NO code path anywhere writes another (the column is `NOT NULL DEFAULT
 * 'scheduled'` with no CHECK, and the only writes are the two INSERTs). So there is no way, today,
 * to mark a delivery complete, and this list is currently unreachable. It is written anyway, with
 * the likely vocabulary, so that the day a "mark delivered" control ships the order status follows
 * automatically instead of needing this rule rediscovered.
 */
const DELIVERY_COMPLETE = ['complete', 'completed', 'delivered', 'fulfilled', 'done'];

export function isDeliveryComplete(deliveryStatus: string | null | undefined): boolean {
  return !!deliveryStatus && DELIVERY_COMPLETE.includes(String(deliveryStatus).trim().toLowerCase());
}

/**
 * The status a history order should carry, given its delivery.
 *
 * `null`/absent delivery → 'invoiced', deliberately. A captured invoice with no delivery row is
 * most likely a walk-in whose customer already drove away — but "most likely" is not knowledge, and
 * 'fulfilled' is the STRONGER claim of the two. We record the weaker one rather than assert a
 * departure nobody witnessed (A9). Flagged for David: if a no-delivery capture should read
 * 'fulfilled', that is a one-line change here and it belongs to him, not to this file.
 */
export function historyOrderStatus(deliveryStatus: string | null | undefined): string {
  return isDeliveryComplete(deliveryStatus) ? HISTORY_ORDER_STATUS_DELIVERED : HISTORY_ORDER_STATUS_PENDING;
}

/** What a decoded source document yields. Every field is optional because OCR is not a schema. */
export interface CapturedDocument {
  sourceDocumentNumber: string | null;
  subtotal: number | null;
  tax: number | null;
  customerName: string | null;
  deliveryDate: string | null;
}

/**
 * `ocr_raw` is the RAW PROVIDER ENVELOPE, not a decoded object — its top-level keys are
 * `candidates` / `responseId` / `modelVersion` / `usageMetadata`, and the payload is a JSON
 * STRING inside `candidates[0].content.parts[0].text`. So this is a two-step decode, not a
 * field read, and it is the one genuinely brittle input in the whole path: a provider that
 * changes its envelope, or the Claude OCR fallback (which discards rawText), yields null here.
 *
 * Returning null is the honest answer and every caller must handle it — NEVER substitute zeros
 * for a document we could not read (D-9: a fabricated 0.00 tax is worse than an admitted gap).
 */
export function decodeCapturedDocument(ocrRaw: any): CapturedDocument | null {
  const text = ocrRaw?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') return null;
  const match = text.match(/\{[\s\S]*\}/);
  let parsed: any;
  try { parsed = JSON.parse(match ? match[0] : text); } catch { return null; }
  if (!parsed || typeof parsed !== 'object') return null;
  const n = (v: any) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));
  return {
    sourceDocumentNumber: parsed.receipt_number != null ? String(parsed.receipt_number) : null,
    subtotal:     n(parsed.subtotal),
    tax:          n(parsed.tax),
    customerName: parsed.customer_name ? String(parsed.customer_name) : null,
    deliveryDate: parsed.delivery_date ? String(parsed.delivery_date) : null,
  };
}

/**
 * `transport_method` is NOT NULL with NO DEFAULT, so a history order must supply one, and the
 * delivery already records what physically happened. 'planting' means the business puts it in
 * the ground — which is exactly what 'install' has always meant on this table.
 * A delivery we cannot classify falls back to 'delivery', the weaker claim of the two.
 */
export function transportMethodForService(serviceType: string | null | undefined): string {
  if (serviceType === 'planting') return 'install';
  if (serviceType === 'delivery' || serviceType === 'delivery_only') return 'delivery';
  return 'delivery';
}

export interface HistoryOrderLine {
  quantity: number;
  unitPrice: number;
  subtotal: number;
  description: string | null;
  sku: string | null;
  /**
   * The QuickBooks `Item.Id` this line is for — `Invoice.Line[].<DetailType>.ItemRef.value`.
   *
   * 🔴 THIS IS NOT A SECOND `businessInventoryId`, AND THE DIFFERENCE IS THE WHOLE DESIGN.
   * `businessInventoryId` is an INTERNAL row id and is typed `null` below so that setting one is
   * a compile error (invariant 1 — a lot id on a captured line silently reduces sellable stock,
   * because committed stock is DERIVED, D-52). This is the SELLER'S OWN id for the item, and it
   * is a VALUE joined to `business_inventory.qb_item_id` at read time — never a foreign key.
   * Because both sides are QuickBooks ids, the join survives a wipe-and-reload of the catalogue
   * with no re-attachment pass, which is why nothing here waits on `20260916b`'s open ruling.
   *
   * NULL on a line transcribed from a PHOTOGRAPH — an OCR capture has no QuickBooks id to read.
   */
  qboItemId: string | null;
  /** Invariant (1). Typed as the literal `null` so a future edit setting a lot id fails to compile. */
  businessInventoryId: null;
}

/**
 * DOES THE DOCUMENT FOOT? Σ(line amounts) vs the document's own subtotal.
 *
 * 🔴 THIS IS THE SAME ARITHMETIC `buildHistoryOrder` ALREADY DID AND NOBODY COULD SEE.
 * `arithmeticBalances` has been computed since this file was written, and the OCR door
 * reacted to it with `console.warn('recorded AS PRINTED, not corrected')` — a server log,
 * on a screen Lauren does not have. The check was correct, wired to nothing, and two orders
 * went out short: LaPrime 8 trees, Duy Le one. Exported here so the DOOR can reach the
 * verdict BEFORE it schedules a stop, rather than discovering it after.
 *
 * Tolerance is half a cent, matching `arithmeticBalances` — these are numeric(10,2) columns
 * and a float comparison at full precision would call an exact match a mismatch.
 *
 * `missing` is POSITIVE when the lines fall short of the subtotal (money the document says
 * is there and the lines do not account for — the LaPrime shape) and NEGATIVE when the lines
 * exceed it (the LEANDER shape, a vendor invoice captured as a sale). Both are held; only
 * the sign tells the reader which mistake they are looking at.
 */
/**
 * THE SENTENCE LAUREN READS. One definition, used by the capture response and the order page,
 * so the two can never say different things about the same document.
 *
 * Reads the SIGN rather than hiding it: money the lines fall short of, versus lines that
 * exceed the document — the second is usually a vendor invoice captured as a sale.
 */
export function footingMessage(missing: number): string {
  const amt = Math.abs(missing).toFixed(2);
  return missing > 0
    ? `Lines don't add up — $${amt} missing. Check the invoice.`
    : `Lines don't add up — $${amt} more than the invoice total. Check the invoice.`;
}

export function documentFooting(documentLines: any, subtotal: number): {
  balances: boolean; lineSum: number; missing: number;
} {
  const lineSum = round2(historyOrderLines(documentLines).reduce((t, l) => t + l.subtotal, 0));
  const sub = round2(Number(subtotal) || 0);
  return { balances: Math.abs(lineSum - sub) < 0.005, lineSum, missing: round2(sub - lineSum) };
}

/** One transcribed line → one order_items row. Quantity floors at 1: order_items.quantity is
 *  NOT NULL and a zero-quantity sold line is not a thing a document can mean. */
export function historyOrderLines(documentLines: any): HistoryOrderLine[] {
  if (!Array.isArray(documentLines)) return [];
  return documentLines.map((l: any) => ({
    quantity:   Math.max(1, parseInt(l?.quantity ?? 1, 10) || 1),
    unitPrice:  Number(l?.unit_price ?? 0),
    subtotal:   Number(l?.amount ?? 0),
    description: l?.description != null ? String(l.description) : null,
    sku:         l?.sku != null ? String(l.sku) : null,
    // A photographed invoice carries no QuickBooks Item.Id — there is nothing to read one from.
    // NULL is the honest value here, not a gap: these lines join the catalogue by nothing.
    qboItemId:   null,
    businessInventoryId: null,
  }));
}

export interface HistoryOrderInput {
  businessId: string;
  customerId: string;
  /**
   * The captured document this order came off — or `null` when there is no document to point at.
   *
   * ⚠️ NULLABLE SINCE 2026-08-31, AND THE REASON IS A SECOND DOOR RATHER THAN A RELAXATION.
   * A history order originally always came from a PHOTOGRAPHED invoice, so a `receipts` row
   * always existed. The QuickBooks door reads the seller's own invoice straight out of their
   * books: there is no photograph, no OCR and no receipt row, and inventing one to satisfy a
   * type would be a fabricated record of a scan nobody performed (A9). The column is nullable
   * in the schema (`20260827_history_orders.sql` — `ADD COLUMN receipt_id uuid REFERENCES
   * receipts(id) ON DELETE SET NULL`), so the type now says what the table has always said.
   * The provenance is not lost — it moves to `qbInvoiceId`, which is a stronger key than a
   * photograph because it is the id the customer's own accounting system assigned.
   */
  receiptId: string | null;
  /** The document's own date — receipts.date, a first-class typed column. NOT created_at. */
  documentDate: string | null;
  /** receipts.amount — the total actually invoiced. */
  documentTotal: number;
  /**
   * THE LINES THE DOCUMENT IS AGREED TO CARRY — for the OCR door, `receipts.line_items`.
   *
   * 🔴 RENAMED FROM `lineItemsOriginal` ON 2026-09-23 (ledger #395) BECAUSE THE NAME CAUSED
   * A LIVE DEFECT. `api/customers/create.ts` read it as "pass `line_items_original`" and did
   * exactly that — and `line_items_original` is the WRITE-ONCE OCR SNAPSHOT (`20260902`'s
   * trigger: *"it is the record of what the OCR read"*). Lauren's corrections live in
   * `line_items`. So every line she fixed at capture was discarded when the order was built:
   * Lindsey LaPrime lost 8 trees ($2,000) from a load list for the next morning, and Duy Le
   * lost one ($450). **53 of 145 LAWNS receipts have a corrected set longer than the snapshot.**
   *
   * The evidence column is still written once and never read here. The CORRECTED document is
   * what gets posted; the original is kept untouched as evidence. That is the industry shape
   * and it is now what the parameter name says.
   */
  documentLines: any;
  decoded: CapturedDocument | null;
  deliveryDate?: string | null;
  /** QuickBooks Invoice.ShipDate — when the goods went out, as the owner's books record it.
   *  🔴 DISTINCT FROM deliveryDate, which is a PLANNING field the schedule and route read. Writing
   *  a historical ShipDate into that would put finished invoices on Lauren's schedule as scheduled
   *  days (ledger #392). NULL = the books carried none, never "it shipped today". */
  shipDate?: string | null;
  serviceType?: string | null;
  /** The delivery row's own status. Drives the order status — see historyOrderStatus. */
  deliveryStatus?: string | null;
  /**
   * Lines ALREADY BUILT by the caller, used INSTEAD of decoding `documentLines`.
   *
   * The OCR door hands over a blob it wants transcribed; the QuickBooks door hands over lines
   * it has already classified against Intuit's own vocabulary (`invoiceOrderLines.ts` — which
   * construct is a note, which is a running total, which is a give-away that is still a tree).
   * That classification cannot be expressed as an OCR blob and must not be re-derived here.
   * What is NOT delegated is the invariant: the lines are typed `HistoryOrderLine`, so their
   * lot id is the literal `null` whichever door built them.
   */
  lines?: HistoryOrderLine[];
  /** Free text carried onto the order. The QuickBooks door puts the invoice's `DescriptionOnly`
   *  lines here — they are things a person wrote, and they are not things to load. */
  notes?: string | null;
  /** Intuit's INTERNAL transaction id. The idempotency key: an invoice that already has an
   *  order gets nothing. Distinct from `qbDocNumber`, the number a customer can quote. */
  qbInvoiceId?: string | null;
  /** QuickBooks' human-readable invoice number (`DocNumber`). */
  qbDocNumber?: string | null;
}

export interface HistoryOrderDraft {
  order: {
    business_id: string;
    customer_id: string;
    transport_method: string;
    status: string;
    order_kind: string;
    source_document_number: string | null;
    sale_date: string | null;
    receipt_id: string | null;
    qb_invoice_id: string | null;
    qb_doc_number: string | null;
    notes: string | null;
    delivery_date: string | null;
    ship_date: string | null;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    addons_amount: number;
    netting_declined: boolean;
    leakage_flag: boolean;
  };
  items: HistoryOrderLine[];
  /** How subtotal/tax were arrived at — 'document' (decoded) or 'derived' (from lines + total). */
  moneySource: 'document' | 'derived';
  /** Σ line amounts === subtotal AND subtotal + tax === total. Callers decide what to do. */
  arithmeticBalances: boolean;
  lineSum: number;
}

/**
 * Build the draft. Deliberately returns data rather than writing: the backfill writes it as SQL,
 * the endpoint writes it with supabase-js, and neither transport belongs in here.
 *
 * MONEY: prefer the DOCUMENT's own subtotal/tax. When the envelope will not decode, DERIVE them
 * — subtotal = Σ line amounts, tax = total − subtotal — and say so via `moneySource`. That is
 * arithmetic over data we actually hold, not a guess, and it beats writing 0.00 tax (which would
 * be a fabricated figure on a money field). `arithmeticBalances` is reported, never silently
 * corrected: on a captured document the DOCUMENT is the authority, so a document that does not
 * balance is a fact to surface, not an error to repair.
 *
 * STATUS comes from `historyOrderStatus(deliveryStatus)`, never from a constant — see the note on
 * that function for why, and for what invariant (1) is now carrying alone.
 *
 * `leakage_flag` is false because the column is NOT NULL boolean and false is its default — but
 * read that as UNEVALUATED, not as "no leakage". Leakage is computed at checkout from resolved
 * catalog lines and container sizes (submit.ts:796), neither of which a transcribed line has.
 * Any surface that COUNTS leakage must exclude history orders rather than let a false read as a
 * clean bill of health (see the dashboard add-on banner).
 */
export function buildHistoryOrder(input: HistoryOrderInput): HistoryOrderDraft {
  // Pre-built lines win when the caller supplied them; the OCR door supplies none and
  // falls through to the transcription path exactly as before.
  const items = input.lines ?? historyOrderLines(input.documentLines);
  const lineSum = round2(items.reduce((a, l) => a + l.subtotal, 0));
  const total = Number(input.documentTotal ?? 0);

  const hasDocMoney = input.decoded?.subtotal !== null && input.decoded?.subtotal !== undefined;
  const subtotal = hasDocMoney ? round2(input.decoded!.subtotal as number) : lineSum;
  const tax = hasDocMoney && input.decoded?.tax !== null && input.decoded?.tax !== undefined
    ? round2(input.decoded.tax as number)
    : round2(total - subtotal);

  return {
    order: {
      business_id: input.businessId,
      customer_id: input.customerId,
      transport_method: transportMethodForService(input.serviceType),
      status: historyOrderStatus(input.deliveryStatus),
      order_kind: HISTORY_ORDER_KIND,
      source_document_number: input.decoded?.sourceDocumentNumber ?? null,
      sale_date: input.documentDate ?? null,
      receipt_id: input.receiptId,
      qb_invoice_id: input.qbInvoiceId ?? null,
      qb_doc_number: input.qbDocNumber ?? null,
      notes: input.notes ?? null,
      delivery_date: input.deliveryDate ?? null,
      ship_date: input.shipDate ?? null,
      subtotal,
      tax_amount: tax,
      total_amount: round2(total),
      addons_amount: 0,
      netting_declined: false,
      leakage_flag: false,
    },
    items,
    moneySource: hasDocMoney ? 'document' : 'derived',
    arithmeticBalances: Math.abs(lineSum - subtotal) < 0.005 && Math.abs(subtotal + tax - total) < 0.005,
    lineSum,
  };
}

function round2(n: number): number { return Math.round((Number(n) || 0) * 100) / 100; }
