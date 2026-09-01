// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: one QuickBooks invoice → the LINES OF A HISTORY ORDER. Reads the nested `Line[]`
//   the invoice walk already returns, decides what KIND of construct each line is, and hands
//   back order lines, the operator notes that are not lines, and the document's own money.
//   Pure: no db, no fetch, no clock, no Intuit call.
// DEPENDENCIES: ./invoiceLineShapes (QBO_DETAIL_TYPE — the ONE spelling of Intuit's vocabulary)
//   · ../business-logic/historyOrder (HistoryOrderLine — the type whose null lot id is the
//   whole safety argument, imported rather than re-declared).
// OUTPUTS: QboRawLine · QboOrderSourceLine · InvoiceLineRole · parseInvoiceOrderLines ·
//   invoiceLineRole · buildInvoiceOrderContent · InvoiceOrderContent.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 THIS IS THE READ SIDE OF `invoiceLineShapes.ts`, AND THE PAIRING IS DELIBERATE.
//   That module states what shape this platform WRITES into a customer's books ([[R-28]]:
//   a $0 line is a note and carries no item; a line carrying money must name a real item).
//   This module reads the same vocabulary coming back the other way, from books we did not
//   write. One spelling of `DescriptionOnly` and `DiscountLineDetail` serves both, because
//   two spellings of one Intuit string is STD-011 and the copy that drifts is never the one
//   you are looking at.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 THE DISCRIMINATOR IS `DetailType`, NOT THE AMOUNT — AND THAT IS MEASURED, NOT REASONED.
//
//   The tempting rule is "$0 means it is a note". It is wrong on this customer's real books
//   and it would have put trees on the ground with nothing on the truck:
//
//     invoice #3648.563 — TOTAL $0.00, a real ship date, a real address, and TWO REAL TREES:
//       "Blue Point Juniper (Replacement)"  $0
//       "Arizona Cypress Blue Ice (Replacement)"  $0
//
//   Those are replacements under warranty. They are $0 because the customer already paid for
//   them once, and they are the entire load of that stop. A $0-means-note rule drops both,
//   the day sheet for 21 September reads empty, and a crew arrives with an empty trailer.
//
//   So the classification is STRUCTURAL. `DescriptionOnly` is Intuit's own construct for
//   "text, no item, no money" — 194 of them across 1,469 invoices and **not one carries a
//   non-zero Amount** (measured 2026-08-31 against the 2026-08-29 raw capture). That is the
//   note. A `SalesItemLineDetail` at $0 is a thing that was given away, and it is a line.
//
// 🔴 AND THE MONEY GUARD RUNS ANYWAY, BECAUSE INTUIT PERMITS WHAT THESE BOOKS DO NOT CONTAIN.
//   A `DescriptionOnly` line carrying a non-zero Amount is NOT dropped — it becomes an order
//   line and is reported. Dropping money silently is the failure that cannot be noticed; an
//   unexpected line on a screen costs someone a second look. The corpus has zero of these
//   today, which is exactly why the guard is written now rather than after one appears.
//
// 🔴 THE RUNNING TOTAL IS NOT A LINE AND MUST NEVER BECOME ONE. Intuit emits exactly ONE
//   `SubTotalLineDetail` per invoice carrying the invoice's own subtotal as its `Amount`
//   (1,469 of 1,469 invoices carry exactly one — measured, not assumed). Counting it as a
//   line DOUBLES the order. `invoiceList.ts` already learned this on the analytical side and
//   its §E test says so; this is the same fact on the order side, keyed off the same constant.
// ══════════════════════════════════════════════════════════════════════════════
import { QBO_DETAIL_TYPE } from './invoiceLineShapes';
import type { HistoryOrderLine } from '../business-logic/historyOrder';

/** An invoice line exactly as Intuit sends it. Unopened — every read of it is below. */
export type QboRawLine = Record<string, unknown>;

/**
 * One invoice line, reduced to what an ORDER LINE needs.
 *
 * 🔴 `description` IS PRESENT HERE AND IS DELIBERATELY ABSENT FROM `invoiceList.QboInvoiceLine`.
 * That module's own header states the reason — a free-text line routinely carries a customer's
 * name or a note about their property, and that read's product is a SUMMARY that reaches a
 * screen and a serverless log. This read's product is a DAY SHEET: "Monterrey Oak - 95 gallon"
 * is the whole point, and an order line with no description is a row nobody can load a truck
 * from. Same divergence, same reasoning, as `QboShipmentRow` carrying an address.
 */
export interface QboOrderSourceLine {
  detailType: string | null;
  itemId: string | null;
  /** The item's fully-qualified name in the customer's own books, e.g. `Oak:MO95`. */
  itemName: string | null;
  description: string | null;
  qty: number | null;
  unitPrice: number | null;
  amount: number | null;
}

/**
 * What KIND of construct a line is.
 *   goods         — a real line on the order. Includes $0 give-aways and warranty replacements.
 *   discount      — money coming OFF. Still a line: the subtotal depends on it.
 *   note          — `DescriptionOnly`. Text a person typed; it is not something to load.
 *   running-total — `SubTotalLineDetail`. Intuit's own running total. NEVER a line.
 */
export type InvoiceLineRole = 'goods' | 'discount' | 'note' | 'running-total';

/** Intuit's running-total construct. READ-ONLY: this platform never emits one, which is why
 *  it is not in `QBO_DETAIL_TYPE` (a map of what we WRITE) and is named here instead. */
export const QBO_SUBTOTAL_DETAIL_TYPE = 'SubTotalLineDetail';

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * Intuit's `Line[]` → our line shape.
 *
 * The detail block's KEY is the detail type itself, so it is read BY that key rather than by
 * guessing `SalesItemLineDetail` — a `GroupLineDetail`, or any construct Intuit adds later,
 * is then read the same way instead of arriving as "no item". `invoiceList.ts` made this call
 * first and it is the same call here (§6 r8).
 */
export function parseInvoiceOrderLines(rawInvoice: Record<string, unknown> | null | undefined): QboOrderSourceLine[] {
  const raw = Array.isArray(rawInvoice?.Line) ? (rawInvoice!.Line as QboRawLine[]) : [];
  return raw.map(l => {
    const detailType = str(l?.DetailType);
    const detail = (detailType ? l?.[detailType] : null) as Record<string, unknown> | null;
    const itemRef = (detail?.ItemRef ?? null) as { value?: unknown; name?: unknown } | null;
    return {
      detailType,
      itemId:      str(itemRef?.value),
      itemName:    str(itemRef?.name),
      description: str(l?.Description),
      qty:         num(detail?.Qty),
      unitPrice:   num(detail?.UnitPrice),
      amount:      num(l?.Amount),
    };
  });
}

/**
 * The classification. Structural, in this order, and the order is the safety argument:
 *
 *   ① the running total, recognised exactly — it can never be mistaken for a line.
 *   ② a NOTE, but ONLY when it carries no money. A `DescriptionOnly` line with a non-zero
 *      Amount falls THROUGH to goods, because dropping money is the failure nobody notices.
 *   ③ a discount — Intuit's native construct, or any negative amount.
 *   ④ everything else is goods, INCLUDING a $0 `SalesItemLineDetail` (the warranty
 *      replacement — see the file header; this is the branch that keeps two real trees on
 *      the 21 September truck).
 */
export function invoiceLineRole(line: QboOrderSourceLine): InvoiceLineRole {
  const dt = line.detailType ?? '';
  if (dt === QBO_SUBTOTAL_DETAIL_TYPE) return 'running-total';
  const amount = line.amount ?? 0;
  if (dt === QBO_DETAIL_TYPE.description && amount === 0) return 'note';
  if (dt === QBO_DETAIL_TYPE.discount) return 'discount';
  if (amount < 0) return 'discount';
  return 'goods';
}

/** How many lines of each kind an invoice held — so a run can SAY what it did with each,
 *  rather than a person having to diff the order against the invoice to find out. */
export interface LineRoleCounts {
  goods: number;
  discount: number;
  note: number;
  runningTotal: number;
  /** `DescriptionOnly` lines that carried money and were therefore kept. Expected: zero. */
  notesKeptForMoney: number;
}

export interface InvoiceOrderContent {
  /** Every line that belongs on the order — goods and discounts, never the running total. */
  lines: HistoryOrderLine[];
  /** The `DescriptionOnly` text, in document order. These are NOT lines; they become notes. */
  notes: string[];
  /** The invoice's own subtotal, and where it came from. */
  subtotal: number;
  subtotalSource: 'running-total-line' | 'sum-of-lines';
  /** `TxnTaxDetail.TotalTax` when the invoice carried one, else derived as total − subtotal. */
  tax: number;
  taxSource: 'document' | 'derived';
  counts: LineRoleCounts;
}

function round2(n: number): number { return Math.round((Number(n) || 0) * 100) / 100; }

/**
 * One invoice's lines and money, ready for `buildHistoryOrder`.
 *
 * 🔴 `businessInventoryId` IS `null` ON EVERY LINE AND THE TYPE IS WHAT ENFORCES IT.
 * `HistoryOrderLine` types the field as the literal `null`, so setting a lot id here is a
 * COMPILE error rather than a code review. [[R-21]]: whether an order holds stock is decided
 * by its ORIGIN, and this origin is a document. These SKUs are the seller's own item codes in
 * the seller's own books; they are not lots this platform has ever held. It is also
 * load-bearing rather than merely honest — D-52 derives COMMITTED stock by joining
 * `order_items` to open orders, so a future-dated line pointing at a lot would silently
 * reduce what LAWNS can sell, with no ledger row and nothing to reverse.
 *
 * 🔴 THE UNIT PRICE IS READ, AND DERIVED ONLY WHERE THE DOCUMENT DID NOT STATE ONE. A line
 * with a quantity and an amount but no `UnitPrice` (a flat fee is the shape that does this)
 * would otherwise store $0.00 against a real amount — a fabricated figure on a money field,
 * which is the exact thing D-9 forbids. Dividing is arithmetic over data we hold. The line's
 * stored `subtotal` is always the document's own `Amount`, so no total can drift from it.
 */
export function buildInvoiceOrderContent(input: {
  lines: QboOrderSourceLine[];
  /** `TxnTaxDetail.TotalTax`, or null when the invoice carried none. */
  totalTax: number | null;
  /** `TotalAmt` — used only to DERIVE tax when the document did not state it. */
  totalAmt: number | null;
}): InvoiceOrderContent {
  const lines: HistoryOrderLine[] = [];
  const notes: string[] = [];
  const counts: LineRoleCounts = { goods: 0, discount: 0, note: 0, runningTotal: 0, notesKeptForMoney: 0 };
  let runningTotal: number | null = null;

  for (const l of input.lines) {
    const role = invoiceLineRole(l);
    if (role === 'running-total') {
      counts.runningTotal++;
      // The FIRST one wins and a second is ignored rather than summed. Intuit emits exactly one
      // per invoice (1,469 of 1,469); summing two would be a silent doubling of the subtotal.
      if (runningTotal === null) runningTotal = l.amount ?? 0;
      continue;
    }
    if (role === 'note') {
      counts.note++;
      if (l.description) notes.push(l.description);
      continue;
    }
    if (role === 'discount') counts.discount++; else counts.goods++;
    if ((l.detailType ?? '') === QBO_DETAIL_TYPE.description) counts.notesKeptForMoney++;

    const amount = round2(l.amount ?? 0);
    // NOT NULL on order_items, and a zero-quantity sold line is not a thing a document means.
    const quantity = Math.max(1, Math.round(l.qty ?? 1) || 1);
    const unitPrice = l.unitPrice !== null && l.unitPrice !== undefined
      ? round2(l.unitPrice)
      : round2(quantity > 0 ? amount / quantity : amount);

    lines.push({
      quantity,
      unitPrice,
      subtotal: amount,
      description: l.description,
      // The item's own name in the customer's books — `Oak:MO95`, sub-item structure intact.
      // `order_items.sku` is declared free text and says so: "the SELLER's code on a piece of
      // paper, not a key into business_inventory". Flattening `Oak:MO95` to `MO95` would throw
      // away the categorisation Terry maintains and that Jobber tells its users to destroy.
      sku: l.itemName,
      businessInventoryId: null,
    });
  }

  const lineSum = round2(lines.reduce((a, l) => a + l.subtotal, 0));
  const subtotal = runningTotal !== null ? round2(runningTotal) : lineSum;
  const subtotalSource: InvoiceOrderContent['subtotalSource'] =
    runningTotal !== null ? 'running-total-line' : 'sum-of-lines';

  const hasDocTax = input.totalTax !== null && input.totalTax !== undefined;
  const tax = hasDocTax ? round2(input.totalTax as number) : round2((input.totalAmt ?? 0) - subtotal);

  return {
    lines, notes, subtotal, subtotalSource,
    tax, taxSource: hasDocTax ? 'document' : 'derived',
    counts,
  };
}
