// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the model behind the invoice grid on the accounting read — what is capped, what is
//   searchable, what turns red, and the sentence the screen says about the set it is showing.
//   Pure: no React, no DOM, no clock, no network. The component renders it; this file decides it.
// DEPENDENCIES: ./invoiceList (QboInvoiceRow, invoiceRowsForDisplay) — nothing else.
// OUTPUTS: INVOICE_RENDER_CEILING · buildInvoiceGrid · InvoiceGridModel · InvoiceFlag
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 WHY THIS IS A MODULE AND NOT THREE EXPRESSIONS INSIDE A COMPONENT.
// ══════════════════════════════════════════════════════════════════════════════════════════
// The defect this file exists to make impossible cannot be seen by looking at the screen — the
// page looks completely normal while it is wrong — so it has to be provable by a probe, and a
// probe cannot reach an expression buried in JSX. Every claim the grid makes about its own
// completeness is decided here, where a test can provoke the case that only occurs at a scale
// nobody has in front of them.
//
// ⚠️ AND THE DIVERGENCE CAP CANNOT HELP HERE. `verify-ui-standard-divergence.mjs` scans
// `packages/cultivar-os/src`; this file and its consumer both live in `packages/shared`, so the
// conversion to the shared grid is invisible to `npm run verify` in BOTH directions — it is not
// measured as a divergence now and will not be credited as converged later. Nothing mechanical
// will catch a regression on this surface. The probes below and the owner-test cards are the
// only guard, and they are written on that assumption (tech-debt #156's neighbourhood).
// ─────────────────────────────────────────────────────────────────────────────
import { invoiceRowsForDisplay, type QboInvoiceRow } from './invoiceList';

/**
 * 🔴 HOW MANY ROWS THE GRID WILL PUT IN THE DOM, AND WHY IT IS THIS NUMBER RATHER THAN 100.
 *
 * The predecessor cap was **100**, and at LAWNS's live 1,480 invoices it was a WRONG ANSWER
 * rather than a slow one. `<DataSheet>`'s search (G6) filters CLIENT-SIDE over the rows it was
 * handed, so a grid handed the newest 100 answers *"when did I last invoice the Trevino job"*
 * with **nothing found, for an invoice that exists** — and nothing on the page looks unusual.
 * That is [[R-75]]: *"a search that cannot see the whole set says so"*, and the strongest way to
 * satisfy it is not a better label, it is TO LET THE SEARCH SEE THE WHOLE SET.
 *
 * ⚠️ WHICH COSTS NOTHING HERE, AND THAT IS THE WHOLE ARGUMENT. The browser has already parsed
 * every invoice — `QboBooksReader` builds the rows from the capture it holds in memory to feed
 * the findings engine. Handing 1,480 of them to the grid instead of 100 adds no request, no
 * field and no round trip. The receipts case was different in kind: there the rows were not in
 * hand and fetching them would have weakened a structural guard.
 *
 * THE CEILING IS STILL REAL, and it is set where the filed grid standard says the technique
 * runs out: G7 is met by a bounded scroll box rather than row virtualization, which the standard
 * itself scopes as *"fine at 111 rows and into the low thousands; if a grid ever holds tens of
 * thousands, virtualization becomes the next rung."* 5,000 is inside that sentence and roughly
 * 3.4x LAWNS's present books, so it is a ceiling nobody reaches by growing — only by being a
 * materially bigger business, which is the case that should be re-decided rather than absorbed.
 *
 * 🔴 AND WHEN IT IS REACHED THE GRID SAYS SO IN THE SEARCH BOX, not merely in prose above the
 * table. A caption a reader passed on the way in does not travel with the wrong answer they get
 * four minutes later.
 */
export const INVOICE_RENDER_CEILING = 5000;

/** Why a row is marked. `null` for the overwhelming majority — a flag is an exception. */
export type InvoiceFlag =
  | 'duplicate-number'
  | 'duplicate-customer-same-day'
  | 'unreadable'
  | null;

export interface InvoiceGridRow {
  row: QboInvoiceRow;
  flag: InvoiceFlag;
}

export interface InvoiceGridModel {
  /** The rows the grid renders, newest document-date first (G9). */
  rows: InvoiceGridRow[];
  /** Every invoice parsed, whether rendered or not. The denominator for every sentence below. */
  total: number;
  /** True when `total` exceeded the ceiling and rows were dropped. */
  capped: boolean;
  /**
   * 🔴 WHAT THE SEARCH BOX SAYS ABOUT THE SET IT CAN SEE. Never empty, never optimistic.
   * Placed on the SEARCH control rather than only in the caption: the failure is a confident
   * absence returned to a query, and it must be answerable at the moment of the query.
   */
  searchScope: string;
  /** The caption above the table: what is shown, out of what, and what is deliberately absent. */
  caption: string;
  /** Rows carrying a flag, for the banner. Counted over EVERY parsed invoice, not the page. */
  flaggedCount: number;
}

/** `YYYY-MM-DD` → the day, for same-day duplicate detection. Null dates never pair. */
const dayOf = (r: QboInvoiceRow): string | null => r.txnDate;

/**
 * Build the whole model in one pass.
 *
 * 🔴 THE FLAGS ARE COMPUTED OVER EVERY PARSED INVOICE, NOT OVER THE RENDERED PAGE. A duplicate
 * is a fact about their books; if one twin is above the ceiling and the other below it, the one
 * on screen is still a duplicate and must still be red. Computing flags over the visible slice
 * would make the marking depend on where the ceiling happened to fall — the same class of defect
 * as the search, and quieter.
 *
 * ⚠️ RED IS RESERVED FOR WHAT SHE CAN ACT ON. David: *"duplicate invoice numbers, duplicate
 * customers, and anything we could not read. NOTHING ELSE GOES RED."* An unusual amount, a
 * missing ship date, an old invoice — all true, none actionable at this table, none red. The
 * findings panel below is where non-actionable observations belong.
 */
export function buildInvoiceGrid(
  invoices: QboInvoiceRow[],
  ceiling: number = INVOICE_RENDER_CEILING,
): InvoiceGridModel {
  const total = invoices.length;

  // ── ① the two duplicate shapes, over the FULL set ──────────────────────────────────
  const byNumber = new Map<string, number>();
  for (const inv of invoices) {
    if (inv.docNumber) byNumber.set(inv.docNumber, (byNumber.get(inv.docNumber) ?? 0) + 1);
  }
  // A customer billed twice on one day. NOT "a customer who appears twice" — a repeat customer
  // is a good outcome, and flagging one would put a red row beside their best relationships.
  const byCustomerDay = new Map<string, number>();
  for (const inv of invoices) {
    const d = dayOf(inv);
    if (inv.customerId && d) {
      const k = `${inv.customerId} ${d}`;
      byCustomerDay.set(k, (byCustomerDay.get(k) ?? 0) + 1);
    }
  }

  const flagFor = (inv: QboInvoiceRow): InvoiceFlag => {
    // ⚠️ ORDER IS A DECISION. "We could not read this" outranks both duplicate shapes: a row we
    // failed to parse is a row whose duplicate status is unknown, and reporting it as a
    // duplicate would be asserting something about bytes we could not read (D-9 on a negative).
    if (inv.docNumber === null || inv.totalAmt === null) return 'unreadable';
    if ((byNumber.get(inv.docNumber) ?? 0) > 1) return 'duplicate-number';
    const d = dayOf(inv);
    if (inv.customerId && d && (byCustomerDay.get(`${inv.customerId} ${d}`) ?? 0) > 1) {
      return 'duplicate-customer-same-day';
    }
    return null;
  };

  const flaggedCount = invoices.reduce((n, inv) => n + (flagFor(inv) === null ? 0 : 1), 0);

  // ── ② order and cap. The ordering is G9's and lives in ONE place, `invoiceRowsForDisplay`:
  //    most recent DOCUMENT date first, undated rows last and saying so, stable tie-break. A
  //    second sort written here would be a second representation of one rule (STD-011).
  const ordered = invoiceRowsForDisplay(invoices, Math.max(0, ceiling));
  const capped = total > ceiling;

  // ── ③ the two sentences ────────────────────────────────────────────────────────────
  const n = (x: number) => x.toLocaleString();
  const searchScope = capped
    // 🔴 THE HONEST FORM OF A PARTIAL ANSWER, ON THE CONTROL THAT PRODUCES IT. It names the
    // slice AND the whole, so a reader who finds nothing knows immediately whether they have
    // asked a question this box could answer.
    ? `Searching the ${n(ordered.length)} most recent of ${n(total)} invoices — older ones are not on this page and will not be found here.`
    : `Searching all ${n(total)} invoices.`;

  const caption = capped
    ? `Showing the ${n(ordered.length)} most recent of ${n(total)} invoices, newest first.`
    : `Showing all ${n(total)} invoices, newest first.`;

  return {
    rows: ordered.map(row => ({ row, flag: flagFor(row) })),
    total, capped, searchScope, caption, flaggedCount,
  };
}

/**
 * What a row matches a search against.
 *
 * 🔴 NO BUYER NAME, AND IT CANNOT ACQUIRE ONE. `QboInvoiceRow` has no customer-name field —
 * `invoiceList` reads `CustomerRef.value` and never `.name` — so [[R-77]] holds structurally
 * here rather than by this function staying careful. What IS searchable is what the ruling
 * permits and what recognition actually runs on: her invoice numbers and her item names.
 */
export function invoiceSearchText(r: QboInvoiceRow): string {
  return [
    r.docNumber ?? '',
    r.txnDate ?? '',
    r.totalAmt === null ? '' : String(r.totalAmt),
    ...r.lines.map(l => l.itemName ?? ''),
  ].join(' ');
}
