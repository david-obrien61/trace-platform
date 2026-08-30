// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      the QUICKBOOKS INVOICE VOCABULARY, in one place — which construct a line is,
//               and where the Item id on a revenue line comes from. This is the module that
//               replaces the twelve hardcoded `ItemRef: { value: '1', name: 'Services' }`
//               literals in `api/qbo/invoice/cultivar.ts` with ONE rule, stated once.
// DEPENDENCIES: none. Pure. No db, no fetch, no clock, no Intuit call.
// OUTPUTS:      QBO_DETAIL_TYPE · isDocumentationAmount · descriptionOnlyLine · discountLine
//               · txnTaxDetail · signedLineAmount · qboItemMappingOf · resolveQboItemRef
//               · salesItemLine.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE ONE RULE THIS MODULE EXISTS TO STATE
// ═══════════════════════════════════════════════════════════════════════════════════════════
//   A $0 LINE IS A DOCUMENTATION LINE — `DescriptionOnly`, and it carries NO ItemRef at all.
//   A LINE CARRYING MONEY IS REVENUE — it MUST resolve a real Intuit Item Id, or the push
//   REFUSES.
//
// That single sentence decomposes all twelve literals, and it is why this is not twelve
// separate fixes. Five of the twelve were $0 notes (netting declined · $0 transport · legacy
// netting declined · staff transport · the tax-exemption note) that were pointed at a REVENUE
// item — so a note that a customer DECLINED something rendered in the books as a service SALE
// of $0. One was a discount, one was sales tax, and neither is a sale of anything.
//
// ⚠️ THE $0 RULE IS A CLASSIFIER, NOT A CONVENIENCE. It is applied to lines whose amount is
//    zero BY CONSTRUCTION today but need not always be — the legacy installation line is $0
//    only because install pricing moved to `service_offerings` and was never re-wired. When
//    such a line acquires a price it becomes revenue and falls into the refusal path
//    automatically, rather than quietly booking against whatever id was last hardcoded.
//
// ═══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE ID IS AN INTUIT `Id`. IT IS NOT A SKU, AND IT IS NOT A NAME.
// ═══════════════════════════════════════════════════════════════════════════════════════════
// `ItemRef.value` takes the Item's Intuit `Id` — the primary key in the customer's own books
// (`Item.Id`, the field `itemList.ts` parses as `QboItemRow.id`). A SKU is a DIFFERENT field
// (`Item.Sku`) which our read does not even retain, and `business_inventory.sku` is TRACE's
// OWN generated identifier (`variantGroup.ts` → `deriveSiblingSku`) that Intuit has never
// seen. Storing a SKU where an Id belongs would resolve to nothing, or worse, to something.
//
// ⚠️ THIS MODULE CONSUMES THE MAPPING. IT DOES NOT CREATE IT. `qboItemMappingOf` reads
//    `qbo_item_id` off whatever row backs the line and returns null when it is absent — which
//    today is ALWAYS, because no such column exists yet. That is not a placeholder; it is the
//    honest state, and it makes every revenue line refuse until the mapping pass populates it.
//    The refusal IS the feature: a default is how `'1'`/`'Services'` happened.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Intuit's own line-type vocabulary. Named once so the WRITER (this module) and the READER
 * (`invoiceList.ts`, which classifies the same strings coming back) cannot drift — two
 * spellings of one fact is the STD-011 defect, and the copy that drifts is never the one you
 * are looking at.
 */
export const QBO_DETAIL_TYPE = {
  sales:       'SalesItemLineDetail',
  discount:    'DiscountLineDetail',
  description: 'DescriptionOnly',
} as const;

/** A QuickBooks invoice line, in the three shapes this platform emits. */
export type QboLine = Record<string, unknown>;

/** The Intuit reference a revenue line points at. `value` is an Item **Id**. */
export interface QboItemRef { value: string; name?: string }

/**
 * What a Cultivar row must carry for a revenue line to be pushable.
 *
 * 🔴 THIS IS THE CONTRACT THE MAPPING PASS MUST SATISFY, and it is deliberately the smallest
 * one that works: ONE required field holding Intuit's `Id`. `qboItemName` is a convenience
 * echo for the payload's human-readable half and is never required, never authoritative, and
 * never used to resolve anything — if it drifts from the customer's books, nothing breaks.
 */
export interface QboItemMapping {
  /** Intuit `Item.Id`. The value `ItemRef.value` takes. NEVER a SKU, NEVER a name. */
  qboItemId: string;
  /** Intuit `Item.Name`, cached for readability only. Optional, non-authoritative. */
  qboItemName?: string | null;
}

/**
 * Read the QuickBooks mapping off a backing row (a `business_inventory` lot, a
 * `service_offerings` row, an `addons` row). Returns null when the row does not carry one —
 * which is every row today, because the column does not exist yet.
 *
 * ⚠️ TOLERATES THE COLUMN'S ABSENCE ON PURPOSE. A PostgREST select cannot name a column that
 *    does not exist without failing the WHOLE query, so the select stays as it is until the
 *    mapping pass adds the column; this reader simply finds nothing. The moment the column
 *    exists and is selected, this resolves — with no change here and none at the call sites.
 *
 * ⚠️ A BLANK STRING IS NOT AN ID. An empty/whitespace `qbo_item_id` is an unmapped row that
 *    happens to have been written to, and it must refuse exactly like a null one — otherwise
 *    `ItemRef: { value: '' }` reaches a customer's books.
 */
export function qboItemMappingOf(row: unknown): QboItemMapping | null {
  if (!row || typeof row !== 'object') return null;
  const r = row as Record<string, unknown>;
  const raw = r.qbo_item_id;
  if (raw === null || raw === undefined) return null;
  const id = String(raw).trim();
  if (id === '') return null;
  const nameRaw = r.qbo_item_name;
  const name = nameRaw === null || nameRaw === undefined ? null : String(nameRaw).trim() || null;
  return { qboItemId: id, qboItemName: name };
}

/** Why a revenue line could not be pushed — carried to the owner verbatim, never swallowed. */
export interface QboUnmappedLine {
  /** What the line was selling, as the customer would read it. */
  label: string;
  /** Which table owes the mapping — so the fix is a place, not a hunt. */
  source: 'business_inventory' | 'service_offerings' | 'addons' | 'none';
  /** The money that would have booked against a guessed item had we guessed. */
  amount: number;
}

export type QboItemRefResult =
  | { ok: true;  itemRef: QboItemRef }
  | { ok: false; unmapped: QboUnmappedLine };

/**
 * Resolve the ItemRef for ONE revenue line, or refuse.
 *
 * 🔴 THERE IS NO FALLBACK BRANCH IN THIS FUNCTION AND THAT IS THE POINT. A default is how
 * every tree at a nursery came to book against a generic income item that already held
 * $41,667 on the customer's P&L. An unmapped line is a question for a human, not a value to
 * pick — so it returns a refusal that NAMES the line, the table that owes the mapping, and
 * the money at stake.
 */
export function resolveQboItemRef(args: {
  label: string;
  source: QboUnmappedLine['source'];
  amount: number;
  mapping: QboItemMapping | null;
}): QboItemRefResult {
  const { label, source, amount, mapping } = args;
  if (!mapping) return { ok: false, unmapped: { label, source, amount } };
  return {
    ok: true,
    itemRef: mapping.qboItemName
      ? { value: mapping.qboItemId, name: mapping.qboItemName }
      : { value: mapping.qboItemId },
  };
}

/**
 * Is this amount a documentation line rather than a sale? Tolerant of float dust and of the
 * null/undefined an unpriced legacy row carries.
 */
export function isDocumentationAmount(amount: unknown): boolean {
  const n = Number(amount);
  return !Number.isFinite(n) || Math.abs(n) < 0.005;
}

/**
 * A $0 note. Carries NO ItemRef — a note is not a sale, and pointing one at a revenue item is
 * what made "netting DECLINED by customer" look like a $0 service sold.
 *
 * ✅ THIS MATCHES THE CUSTOMER'S OWN PRACTICE RATHER THAN IMPOSING OURS — LAWNS's books
 * already carry 194 `DescriptionOnly` lines across their history.
 *
 * ⚠️ `Amount: 0` is sent although Intuit marks Amount unused for this type. It is a standard
 *    Line field, it keeps the reconcile arithmetic uniform across all three shapes, and a 0 it
 *    ignores is cheaper than a missing field it might not.
 */
export function descriptionOnlyLine(description: string): QboLine {
  return {
    Description: description,
    Amount: 0,
    DetailType: QBO_DETAIL_TYPE.description,
    DescriptionLineDetail: {},
  };
}

/**
 * A reduction, as QuickBooks' OWN construct.
 *
 * ✅ AGAIN THEIR PRACTICE, NOT OURS: LAWNS use the native discount line 66 times for $31,985
 * — three times more than their discount ITEMS (21).
 *
 * 🔴 `Amount` IS POSITIVE HERE AND QUICKBOOKS SUBTRACTS IT. This inverts the sign convention
 * of the negative-`SalesItemLine` it replaces, which is precisely why `signedLineAmount`
 * exists: a reconcile that naively sums `Amount` would count a discount as revenue and be
 * wrong by twice the discount.
 *
 * 🔴 `PercentBased: false` IS LOAD-BEARING, NOT A DETAIL. The percent form discounts the
 * subtotal of everything above it — which would sweep in the SERVICE lines, and D-39 rules
 * that services are not discounted. The fixed-amount form takes the dollar figure already
 * stored on the order and touches nothing else.
 *
 * ⚠️ NO `DiscountAccountRef` IS SENT, DELIBERATELY. We hold no account id; QuickBooks falls
 *    back to the company's own default discount account. Inventing an id here would be the
 *    exact mistake this build is undoing, one field to the left.
 *
 * @param amount the reduction as a POSITIVE number. Callers must route a NEGATIVE amount
 *        (an owner override ABOVE baseline) to a revenue line instead — an upcharge is a sale,
 *        not a discount, and QuickBooks has no construct for a negative discount.
 */
export function discountLine(description: string, amount: number): QboLine {
  return {
    Description: description,
    Amount: Math.round(Math.abs(amount) * 100) / 100,
    DetailType: QBO_DETAIL_TYPE.discount,
    DiscountLineDetail: { PercentBased: false },
  };
}

/**
 * A revenue line. The only shape that carries an ItemRef, and it takes an ALREADY-RESOLVED
 * one — so there is no path from this module to a line with a guessed item on it.
 */
export function salesItemLine(args: {
  description: string;
  amount: number;
  unitPrice: number;
  qty: number;
  itemRef: QboItemRef;
}): QboLine {
  return {
    Description: args.description,
    Amount: args.amount,
    DetailType: QBO_DETAIL_TYPE.sales,
    SalesItemLineDetail: { UnitPrice: args.unitPrice, Qty: args.qty, ItemRef: args.itemRef },
  };
}

/**
 * Sales tax as QuickBooks' OWN construct, off the line list entirely.
 *
 * 🔴 WHY THIS IS ARGUABLY THE WORST OF THE TWELVE. Tax pushed as a `SalesItemLine` against a
 * revenue item BOOKS THE TAX AS REVENUE — it inflates the P&L by the tax amount and puts
 * money the business is holding for the state into its own income. LAWNS's P&L already
 * carries $85,281 of sales tax; the goods line merely misfiles revenue, this one INVENTS it.
 *
 * ⚠️ `TotalTax` ONLY — NO `TaxLine`, NO `TaxRateRef`. A TaxLine wants a tax-rate Id we do not
 *    hold, and this build does not fabricate ids. `TotalTax` alone is the manual-override form
 *    and is the honest minimum. What it CANNOT do is tell QuickBooks which jurisdiction the
 *    tax belongs to — flagged, not hidden: if the company runs Automated Sales Tax, QuickBooks
 *    may recompute rather than accept this figure, and the first live push is what settles it.
 *
 * Returns null for a zero/absent tax, so an untaxed or exempt order carries no tax object at
 * all rather than an explicit zero (D-9: omit, do not fake).
 */
export function txnTaxDetail(taxAmount: unknown): { TotalTax: number } | null {
  const n = Number(taxAmount);
  if (!Number.isFinite(n) || n <= 0) return null;
  return { TotalTax: Math.round(n * 100) / 100 };
}

/**
 * The amount a line contributes to the invoice total, SIGNED by its construct.
 *
 * 🔴 THIS EXISTS BECAUSE THE DISCOUNT SIGN FLIPPED. Under the old negative-`SalesItemLine`
 * representation a reconcile could sum `Amount` naively. A native discount line carries a
 * POSITIVE amount that QuickBooks SUBTRACTS, so the same naive sum is now wrong by twice the
 * discount — and it would be wrong in the direction that says the invoice reconciles when it
 * does not.
 */
export function signedLineAmount(line: QboLine): number {
  const amount = Number((line as { Amount?: unknown }).Amount ?? 0);
  if (!Number.isFinite(amount)) return 0;
  return line.DetailType === QBO_DETAIL_TYPE.discount ? -amount : amount;
}
