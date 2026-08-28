// ============================================================
// historyOrder — the ONE definition of "a captured document becomes an order"
// ============================================================
// PURPOSE:      Turn a captured source document (a customer invoice photographed and OCR'd)
//               into an `orders` row + `order_items` rows, WITHOUT that order behaving like a
//               sale this platform made. Used by BOTH writers: the backfill script (existing
//               documents) and the OCR door (every document from now on).
// DEPENDENCIES: none — pure. No db handle, no network, no env. Both callers own their transport.
// OUTPUTS:      HISTORY_ORDER_KIND · historyOrderStatus / isDeliveryComplete · decodeCapturedDocument ·
//               transportMethodForService · buildHistoryOrder.
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
  /** Invariant (1). Typed as the literal `null` so a future edit setting a lot id fails to compile. */
  businessInventoryId: null;
}

/** One transcribed line → one order_items row. Quantity floors at 1: order_items.quantity is
 *  NOT NULL and a zero-quantity sold line is not a thing a document can mean. */
export function historyOrderLines(lineItemsOriginal: any): HistoryOrderLine[] {
  if (!Array.isArray(lineItemsOriginal)) return [];
  return lineItemsOriginal.map((l: any) => ({
    quantity:   Math.max(1, parseInt(l?.quantity ?? 1, 10) || 1),
    unitPrice:  Number(l?.unit_price ?? 0),
    subtotal:   Number(l?.amount ?? 0),
    description: l?.description != null ? String(l.description) : null,
    sku:         l?.sku != null ? String(l.sku) : null,
    businessInventoryId: null,
  }));
}

export interface HistoryOrderInput {
  businessId: string;
  customerId: string;
  receiptId: string;
  /** The document's own date — receipts.date, a first-class typed column. NOT created_at. */
  documentDate: string | null;
  /** receipts.amount — the total actually invoiced. */
  documentTotal: number;
  lineItemsOriginal: any;
  decoded: CapturedDocument | null;
  deliveryDate?: string | null;
  serviceType?: string | null;
  /** The delivery row's own status. Drives the order status — see historyOrderStatus. */
  deliveryStatus?: string | null;
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
    receipt_id: string;
    delivery_date: string | null;
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
  const items = historyOrderLines(input.lineItemsOriginal);
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
      delivery_date: input.deliveryDate ?? null,
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
