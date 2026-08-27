// ============================================================
// historyOrder — the ONE definition of "a captured document becomes an order"
// ============================================================
// PURPOSE:      Turn a captured source document (a customer invoice photographed and OCR'd)
//               into an `orders` row + `order_items` rows, WITHOUT that order behaving like a
//               sale this platform made. Used by BOTH writers: the backfill script (existing
//               documents) and the OCR door (every document from now on).
// DEPENDENCIES: none — pure. No db handle, no network, no env. Both callers own their transport.
// OUTPUTS:      HISTORY_ORDER_KIND · HISTORY_ORDER_STATUS · decodeCapturedDocument ·
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
//    (2) STATUS IS 'fulfilled'. `holdsCommitment()` is false only for 'fulfilled' and
//        'cancelled', and 'fulfilled' is the semantically true one: the plants left.
//        ⚠️ Do NOT substitute 'invoiced' as a third escape. It is live on real rows, is written
//        ONLY by the QuickBooks push, and is ABSENT from ORDER_STATUSES — it begins counting as
//        an open status the day that enum is ratified (R-STATUS, orderStatus.ts:7-8).
//
//    Both, not either. Belt and braces, because each alone is one edit away from failing.

/** The discriminator value. NULL on an ordinary checkout order; this on a transcribed one. */
export const HISTORY_ORDER_KIND = 'history';

/** See invariant (2) above. Not a default — a requirement. */
export const HISTORY_ORDER_STATUS = 'fulfilled';

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
      status: HISTORY_ORDER_STATUS,
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
