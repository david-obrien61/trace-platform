// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: separate the invoices that have no dispatch date because NOTHING WAS DISPATCHED from
//   the ones that have no dispatch date and should. The first group is not missing data — it is a
//   correct record of a customer collecting their own order — and reporting the two as one number
//   tells an owner that most of their history is broken when most of it is right.
// DEPENDENCIES: ./invoiceList (QboInvoiceRow) · ../business-logic/serviceReview (isCarriageAccount).
//   Pure: no db, no network, no clock, no DOM.
// OUTPUTS: DispatchCensus · invoiceLeftTheYard · censusDispatchDates.
// STORY: *David rehearses the import on a saved copy* (`user_stories.md`, ARC: ocr-doc-routing).
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE PREDICATE IS STATED ON THE FINDING, BECAUSE THE PREDICATE *IS* THE FINDING.
// ══════════════════════════════════════════════════════════════════════════════════════════
// **An invoice left the yard when at least one of its lines was booked to a CARRIAGE account, or
// when at least one line's wording says the price included planting it.** Anything else is a
// collection, and on a collection there is nothing to put a dispatch date on.
//
// [STATED — measured by a prior session against the 2026-09-03 capture; this build could not
// re-measure, `SUPABASE_SERVICE_KEY` is empty and no capture file lives in this repository]:
// **of 888 invoices with no dispatch date, 639 are collections carrying $722,526, and 249 are
// genuinely undated.** The rule this replaces reported all 888 under *"there is no way to tell
// when the job actually happened"*, which was true of 249 of them.
//
// ⚠️ WHY THE ACCOUNT AND NOT THE ITEM NAME. `ItemAccountRef.name` is the owner's own word for what
// the money is (R-112); an item's NAME is the shorthand an office types. `trip-charge-missing`
// refuses to compute for exactly this reason — it cannot be told WHICH item means "trip charge" —
// and inferring it here from names would be the same retro-classification (R-50) arriving as a
// helpful default. The account axis needs no such guess.
//
// ⚠️ AND THE PREDICATE CAN BE WRONG IN ONE DIRECTION, WHICH IS DECLARED RATHER THAN HIDDEN. A
// delivery made with no carriage charged and no wording — a favour, a load thrown on an existing
// run — reads here as a collection. So `dispatchedWithoutDate` is a FLOOR, and the sentence says
// so. The opposite error is not possible: a carriage line is evidence a truck moved.
// ─────────────────────────────────────────────────────────────────────────────
import type { QboInvoiceRow } from './invoiceList';
import { isCarriageAccount } from '../business-logic/serviceReview';

export interface DispatchCensus {
  /** Invoices the dispatch walk covered — the denominator, and never `invoices.length`. */
  seen: number;
  /** Of those, how many record a dispatch date. */
  withDate: number;
  /** No date, and nothing on the invoice says anything left the yard. Not a gap. */
  collectedWithoutDate: number;
  /** What those collections are worth, so *"most of your history is fine"* carries a figure. */
  collectedAmount: number;
  /** No date, and something DID leave the yard. This is the finding. */
  dispatchedWithoutDate: number;
  dispatchedAmount: number;
}

/**
 * Did anything leave the yard on this invoice? Carriage booked, or planting announced.
 *
 * ⚠️ `installInDescription` IS THE SECOND CLAUSE AND IT IS NOT REDUNDANT. These books weld the
 * planting into the tree's price — there is no installation item to book to an account — so 909
 * planted lines carry no carriage line at all. Reading only the account would call every one of
 * them a collection.
 */
export function invoiceLeftTheYard(inv: QboInvoiceRow): boolean {
  return inv.lines.some(l => isCarriageAccount(l.itemAccountName) || l.installInDescription);
}

/**
 * @param shipDates invoice id → its dispatch date (or null). Absent from the map = the dispatch
 *   walk did not cover this invoice, and it is EXCLUDED rather than counted as undated — "we did
 *   not look" and "there is nothing there" are the two answers a reader cannot tell apart (D-9).
 */
export function censusDispatchDates(
  invoices: QboInvoiceRow[],
  shipDates: Map<string, string | null>,
): DispatchCensus {
  let seen = 0, withDate = 0;
  let collectedWithoutDate = 0, collectedAmount = 0;
  let dispatchedWithoutDate = 0, dispatchedAmount = 0;

  for (const inv of invoices) {
    if (!shipDates.has(inv.id)) continue;
    seen++;
    if (shipDates.get(inv.id)) { withDate++; continue; }
    // A null total is not a zero total; it contributes to the COUNT and not to the money, which is
    // the same treatment the receivables rule gives an unreadable balance.
    const amount = inv.totalAmt ?? 0;
    if (invoiceLeftTheYard(inv)) { dispatchedWithoutDate++; dispatchedAmount += amount; }
    else { collectedWithoutDate++; collectedAmount += amount; }
  }

  return { seen, withDate, collectedWithoutDate, collectedAmount, dispatchedWithoutDate, dispatchedAmount };
}
