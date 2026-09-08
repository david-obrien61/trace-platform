// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the INVOICE-SPECIFIC half of the QuickBooks read — the shape of one invoice and its
//   nested lines, and the breakdown that answers the five questions this read exists for:
//   HOW FAR BACK does the history go, WHAT SOLD and in what quantity, how much of it books
//   against the generic item, how much installation is hidden inside a $0 bundle line, and
//   WHAT THE DISCOUNT LINES WERE COMPUTED ON. The entity-agnostic machinery — query building,
//   counting, paging, the walk ceiling, completeness, capture naming, failure classification —
//   lives in ./qboRead and is SHARED with the item and customer reads (§6 r8).
// DEPENDENCIES: ./qboRead (parseRows).
// OUTPUTS: QboInvoiceLine · QboInvoiceRow · ParsedInvoiceList · parseInvoiceList ·
//   DISCOUNT_ITEM_NAMES · BUNDLE_ITEM_NAMES · InvoiceBreakdown · summariseInvoices.
//
// ══════════════════════════════════════════════════════════════════════════════
// 🔴 THIS IS THE READ THE OTHER TWO WERE A DETOUR AROUND. An `Item` row says a thing exists and
//   a `Customer` row says a person exists; neither says what was SOLD. An invoice carries the
//   items, the quantities, the prices and the customer on ONE record, which makes it the only
//   place in the customer's books that can answer *"how many trees did we plant last year"* —
//   a question Terry has never been able to ask his own system.
//
// 🔴 THE FIRST THING IT MUST REPORT IS THE DATE RANGE, BEFORE ANY OTHER NUMBER. Every other
//   figure here is meaningless without the span it covers: "412 Shumard oaks" is a different
//   fact over ten years than over eight months. Their QuickBooks company is roughly a year old
//   and 1,163 of 1,936 customers were created in one bulk migration on 2025-08-23, so the
//   history may simply START there — and if it does, this read must SAY SO plainly rather than
//   let a reader assume the numbers cover a decade.
// ══════════════════════════════════════════════════════════════════════════════
//
// 🔴 NOTHING PERSONAL LIVES IN THIS FILE'S OUTPUT, AND THAT IS STRUCTURAL RATHER THAN CAREFUL.
//   An invoice names the human who bought — `CustomerRef.name` — and this parse DOES NOT CARRY
//   THAT FIELD. `QboInvoiceRow` has a `customerId` and no name, no address, no email, no
//   description text, so there is no path by which a person's name can reach the summary, the
//   screen or a log line even if a future caller tries. `invoiceList.test.ts` §G asserts it by
//   searching the whole serialised output for a name that was present in the input (R-24 b/c).
//
// 🔴 NOTHING HERE PERSISTS AND NOTHING HERE LOGS A BODY (R-23 clauses b and c).
// ─────────────────────────────────────────────────────────────────────────────
import { parseRows } from './qboRead';
import { QBO_DETAIL_TYPE } from './invoiceLineShapes';
import { readProductFromDescription } from './qboItemAdapter';

/**
 * One line of one invoice, reduced to what the questions need.
 *
 * `description` is DELIBERATELY ABSENT. A free-text line on a real invoice routinely carries a
 * customer's name, address or a note about their property, and carrying it would put personal
 * data one `console.log` away from a serverless log for no analytical gain.
 */
export interface QboInvoiceLine {
  /** Intuit's vocabulary: SalesItemLineDetail · DiscountLineDetail · SubTotalLineDetail · … */
  detailType: string | null;
  itemId: string | null;
  itemName: string | null;
  /** On a goods line this is a COUNT. On these books' discount lines it is a DOLLAR BASE. */
  qty: number | null;
  amount: number | null;
  /**
   * WHAT THIS LINE CHARGED PER UNIT — Intuit's `UnitPrice`, inside the detail block.
   *
   * 🔴 IT IS NOT `amount / qty` AND THE DIFFERENCE IS THE WHOLE POINT. Deriving it would be
   * arithmetic over two numbers that are already on the record, and it would silently invent a
   * price on every line where `qty` is null, zero, or not a count of anything.
   *
   * ✏️ **CORRECTED 2026-09-07 — THIS COMMENT SAID `qty` IS THE DOLLAR BASE ON A DISCOUNT LINE,
   * AND IT IS NOT.** MEASURED against LAWNS's 1,481-invoice export: on all 21 discount ITEM
   * lines `Qty` is **1** (or absent) — never a base. Reading it as one turned `|amount| ÷ qty`
   * into `|amount| × 100`, and the review screen printed **$182.50 as "18250%"**. The sentence
   * was in this file, was believed, and steered a build ([[R-26]] in our own corpus). The base
   * for an item-line discount is not stated anywhere on the line; it is DERIVED from the other
   * charged lines on the same invoice, and labelled as derived.
   *
   * ⚠️ NULL IS A REAL AND COMMON ANSWER. A `DescriptionOnly` line has no unit price, a
   * `SubTotalLineDetail` has none, and a goods line can omit it. Every reader below must treat
   * null as "this line does not say", never as zero — a $0.00 price and an absent one are the
   * difference between "they gave it away" and "we do not know" (D-9 / A9).
   */
  unitPrice: number | null;
  /**
   * 🔴 DID THIS LINE'S WORDING ANNOUNCE A DISCOUNT? A BOOLEAN, AND THE PROSE IS NEVER KEPT.
   *
   * A line description is free text an owner typed, and on real books it carries customer
   * names, job notes and site addresses — so `Description` is read once, tested, and dropped.
   * What survives is this flag, which is all any rule needs: the finding is "your discounting
   * is announced in wording instead of recorded as a discount", and that is a COUNT question.
   *
   * ⚠️ THIS IS EVIDENCE OF A MEASUREMENT PROBLEM, NOT A RECLASSIFICATION. Nothing downstream
   * may treat a true here as "this line IS a discount" — R-50. It says the wording mentions
   * one, which is exactly why the money cannot be measured from the discount lines alone.
   */
  discountInDescription: boolean;
  /**
   * 🔴 `DiscountLineDetail.PercentBased` / `DiscountPercent` — THE RATE, STATED BY QUICKBOOKS.
   * `null` on every other line type. When `percentBased` is true, `discountPercent` IS the rate
   * and no arithmetic is involved; when it is false the discount was a FIXED DOLLAR AMOUNT and
   * `discountPercent` is absent — that is a real, different fact and must never be converted
   * into a percentage (MEASURED: 6 of LAWNS's 67).
   */
  percentBased: boolean | null;
  discountPercent: number | null;
  /**
   * 🔴 DID THIS LINE'S PRICE INCLUDE PUTTING THE PLANT IN THE GROUND? A BOOLEAN, PROSE DROPPED.
   * The services review measures the placement premium by comparing the same plant sold with
   * this flag and without it; there is no installation ITEM to tally, because these books weld
   * the work into the tree price. Same read-once-and-discard treatment as
   * `discountInDescription` — see `mentionsInstall`.
   */
  installInDescription: boolean;
  /**
   * The line's own `ItemAccountRef.name` — QuickBooks' word for WHAT THE MONEY IS. Not personal,
   * and it is the axis the services review classifies on: an item Intuit types `Service` while
   * booking it to *Sales of Nursery Stock* is a TREE, and must never reach a services menu.
   */
  itemAccountName: string | null;
  /**
   * The SIZE read out of this line's description, e.g. `45 Gallon` — the plant's own words, and
   * nothing else from the prose. Needed because the placement premium is a LADDER: a 15-gallon
   * redbud and a 95-gallon oak do not carry the same one, and pooling them would print a figure
   * neither of them ever charged.
   */
  sizeFromDescription: string | null;
  /**
   * 🔴 DID THIS LINE'S WORDING SAY IT WAS A WARRANTY OR A REPLACEMENT? A BOOLEAN, PROSE DROPPED.
   *
   * Added 2026-09-08. It exists because a business can give the same thing away four different
   * ways on four different invoices and then hold **no figure at all** for what that costs them:
   * MEASURED on LAWNS's export [STATED — a prior session's figures], 49 lines charged $0, and they
   * are recorded as a `WARRANTY` item (19), as a `Tree Replacement` item (3), under a coded item
   * name that says nothing (1), and **26 as the product itself at $0 with the word only in the
   * description**. Those 26 are invisible to any rule that reads the item.
   *
   * ⚠️ SAME READ-ONCE-AND-DROP TREATMENT as `discountInDescription` and `installInDescription`,
   * and the same R-50 constraint: this says the WORDING mentions it. Nothing downstream may treat
   * a true here as *"this line IS a warranty claim"*.
   */
  replacementInDescription: boolean;
}

/** One invoice. 🔴 `customerId` and NO customer name — see the file header. */
export interface QboInvoiceRow {
  id: string;
  docNumber: string | null;
  /** Intuit's `YYYY-MM-DD`, kept as the STRING it arrived as — see `monthOf`. */
  txnDate: string | null;
  totalAmt: number | null;
  /**
   * 🔴 WHAT IS STILL UNPAID, AND WHEN IT WAS DUE — BOTH ADDED 2026-09-03, BOTH ALWAYS PRESENT.
   * These two were dropped by this parser while `booksFindings`' receivables rule told the owner
   * *"the invoice read does not include how much of each invoice is still unpaid, or when it was
   * due"*. Measured against the 2026-08-29 capture: `Balance` and `DueDate` are on 1,469 of 1,469
   * rows. **The read included them the whole time; WE discarded them, and then blamed their data
   * for it.** A cannot-compute that is false about our own read is worse than a missing finding —
   * it tells an owner their books lack something their books carry.
   *
   * ⚠️ NEITHER IS PERSONAL DATA. A balance and a due date describe the DOCUMENT, not the person,
   * so R-24 clause (b) is untouched by carrying them — `customerId` remains the only reference to
   * a human on this row and there is still no name field anywhere in it.
   */
  balance: number | null;
  /** Intuit's `YYYY-MM-DD`, kept as the STRING it arrived as — same treatment as `txnDate`. */
  dueDate: string | null;
  customerId: string | null;
  lines: QboInvoiceLine[];
}

export interface ParsedInvoiceList {
  ok: boolean;
  invoices: QboInvoiceRow[];
  /** Set when the body could not be read. The body itself is NEVER in here. */
  parseError: string | null;
}

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
 * Money in CENTS, so comparisons are exact.
 *
 * A discount base is compared against a sum of line amounts, and in floating point
 * `450.10 + 225.05 !== 675.15`. Comparing dollars directly would report a mismatch on invoices
 * that agree to the penny — i.e. it would manufacture the very finding this read is here to
 * measure.
 */
function cents(v: number | null): number | null {
  return v === null ? null : Math.round(v * 100);
}

/**
 * The item names these books use for a discount. David's list, from their own catalog.
 *
 * ⚠️ THIS LIST IS NOT ASSUMED TO BE COMPLETE, AND THE SUMMARY SAYS SO. `unnamedDiscountLines`
 * reports every discount-SHAPED line whose item name is not here — so a discount item nobody
 * remembered shows up as its own row instead of being silently counted as a sale. A hand-kept
 * list that cannot report its own under-coverage is the R-19 defect.
 */
export const DISCOUNT_ITEM_NAMES = [
  'CD10%', 'CD15%', 'MD10', 'Military Discount', 'Military Discount 5', 'Customer Discount', 'FD10',
];

/**
 * The $0 bundle items. A line for work that was done and charged for INSIDE the price of the
 * tree above it — which is exactly how installation revenue becomes invisible.
 */
export const BUNDLE_ITEM_NAMES = ['DIW', 'FDIW'];

/**
 * Wording that announces a discount in prose.
 *
 * 🔴 DELIBERATELY NARROW, WHICH IS THE OPPOSITE CALL FROM `isDiscountShaped` BELOW, AND THE
 * REASON IS THE DIRECTION OF THE ERROR. That predicate catches what a NAMED list missed, so a
 * false positive costs one visible row and a false negative hides money — broad wins. This one
 * FEEDS A FINDING that tells an owner their discounting is unmeasurable, so a false positive
 * INFLATES an accusation about their bookkeeping. `off` alone is excluded for exactly that
 * reason: "off-white", "cut off" and "10 ft off the drive" are not discounts.
 */
export const DISCOUNT_WORDING = /discount|%\s*off|\bwaived\b|\bno charge\b|\bcomped\b/i;

/** Does this line's free text announce a discount? The text itself is never returned. */
export function mentionsDiscount(description: string | null | undefined): boolean {
  return typeof description === 'string' && DISCOUNT_WORDING.test(description);
}

/**
 * Wording that says this line's price INCLUDED putting the plant in the ground.
 *
 * 🔴 THIS EXISTS BECAUSE PLACEMENT IS NOT A LINE ON ANY INVOICE. MEASURED on LAWNS's
 * 1,481-invoice export: **976 lines announce it in prose** — *"(Install & Warranty)"*,
 * *"Installation"*, *"Installed"* — and charge ONE figure covering the tree and the work. There
 * is no installation item to tally, so the only way to see what placement is worth is to compare
 * the same plant sold both ways, and the only thing that says which is which is this wording.
 *
 * ⚠️ SAME TREATMENT AS `mentionsDiscount`, AND FOR THE SAME REASON: read once, tested, and the
 * prose DROPPED. What survives is a boolean, which is all the comparison needs (R-24).
 *
 * ⚠️ `warranty` ALONE IS NOT ENOUGH and is deliberately absent. A warranty is sold on trees that
 * were collected, so counting it would mark bare sales as installed and CRUSH the measured
 * premium toward zero — an error that would read as *"placement is worth nothing"*, which is the
 * opposite of what these books say.
 */
export const INSTALL_WORDING = /\binstall(?:ed|ation|s)?\b|\bplanted\b|\bDIW\b|\bFDIW\b/i;

/** Did this line's wording say the price included placement? A BOOLEAN; the prose is not kept. */
export function mentionsInstall(description: string | null | undefined): boolean {
  return typeof description === 'string' && INSTALL_WORDING.test(description);
}

/**
 * Wording that says this line was given under a warranty, or is a replacement for something.
 *
 * 🔴 IT IS NARROW ON PURPOSE, THE SAME CALL AS `DISCOUNT_WORDING` AND FOR THE SAME REASON. This
 * feeds a finding about a business's own record-keeping, so a false positive INFLATES a claim
 * about how disorderly their books are. `\breplace\b` is excluded — *"replace the header"*,
 * *"replace on request"* — and only the noun and the past participle are matched.
 *
 * ⚠️ IT IS NOT PAIRED WITH `install`. `INSTALL_WORDING` deliberately excludes `warranty` because
 * LAWNS sells *"(Install & Warranty)"* on planted trees AND sells a warranty on collected ones, so
 * treating warranty as installation would crush the measured placement premium toward zero. This
 * predicate is the other half of that decision: warranty gets its OWN flag rather than being
 * folded into a neighbour's, so neither reading contaminates the other.
 */
export const REPLACEMENT_WORDING = /\bwarrant(?:y|ies)\b|\breplacements?\b|\breplaced\b/i;

/** Did this line's wording say warranty or replacement? A BOOLEAN; the prose is not kept. */
export function mentionsReplacement(description: string | null | undefined): boolean {
  return typeof description === 'string' && REPLACEMENT_WORDING.test(description);
}

const DISCOUNT_SET = new Set(DISCOUNT_ITEM_NAMES.map(n => n.toLowerCase()));
const BUNDLE_SET   = new Set(BUNDLE_ITEM_NAMES.map(n => n.toLowerCase()));

function isNamedDiscount(line: QboInvoiceLine): boolean {
  return DISCOUNT_SET.has((line.itemName ?? '').trim().toLowerCase());
}

/**
 * Discount-SHAPED without being one of the named items: Intuit's own discount line type, a
 * negative amount, or an item that says "discount" in its name. Broad on purpose — this
 * predicate exists to catch what the named list missed, so a false positive costs one visible
 * row and a false negative costs a silent under-count.
 */
function isDiscountShaped(line: QboInvoiceLine): boolean {
  // The literal lives in ONE place (`invoiceLineShapes.QBO_DETAIL_TYPE`) because this module
  // READS the construct the push WRITES. Two spellings of one Intuit string is STD-011, and
  // the copy that drifts is never the one you are looking at.
  if ((line.detailType ?? '') === QBO_DETAIL_TYPE.discount) return true;
  if ((line.amount ?? 0) < 0) return true;
  return /discount/i.test(line.itemName ?? '');
}

function isAnyDiscount(line: QboInvoiceLine): boolean {
  return isNamedDiscount(line) || isDiscountShaped(line);
}

/**
 * Parse ONE page of Intuit's `{ QueryResponse: { Invoice: [...] } }` body.
 *
 * 🔴 AN EMPTY LIST AND A FAILED PARSE ARE DIFFERENT FACTS (D-9 / A9 — absent is not empty), the
 * same contract as the item and customer parses. A company with no invoices is a TRUE readable
 * answer; a body we could not read must not be able to hide inside it.
 */
export function parseInvoiceList(rawBody: string): ParsedInvoiceList {
  const page = parseRows(rawBody, 'Invoice');
  if (!page.ok) return { ok: false, invoices: [], parseError: page.parseError };

  const invoices: QboInvoiceRow[] = [];
  for (const inv of page.rows) {
    const id = str(inv?.Id);
    // No Id = not addressable, same reasoning as the other two parses.
    if (!id) continue;

    const custRef = (inv?.CustomerRef ?? null) as { value?: unknown } | null;
    const rawLines = Array.isArray(inv?.Line) ? (inv.Line as Record<string, unknown>[]) : [];

    const lines: QboInvoiceLine[] = rawLines.map(l => {
      const detailType = str(l?.DetailType);
      // The ItemRef lives inside the detail block, whose KEY is the detail type itself. Reading
      // it by that key rather than guessing 'SalesItemLineDetail' means a GroupLineDetail or any
      // future block is read the same way instead of coming back as "no item".
      const detail = (detailType ? l?.[detailType] : null) as Record<string, unknown> | null;
      const itemRef = (detail?.ItemRef ?? null) as { value?: unknown; name?: unknown } | null;
      return {
        detailType,
        itemId: str(itemRef?.value),
        itemName: str(itemRef?.name),
        qty: num(detail?.Qty),
        amount: num(l?.Amount),
        // Read by the SAME detail-block key as ItemRef above, for the same reason: a
        // GroupLineDetail or any future block is read the same way instead of coming back
        // empty because the code guessed 'SalesItemLineDetail'.
        unitPrice: num(detail?.UnitPrice),
        // 🔴 THE STATED RATE, READ FROM THE DETAIL BLOCK — added 2026-09-07 after the screen
        // printed dollars with a percent sign. A `DiscountLineDetail` carries its OWN
        // `DiscountPercent` and a `PercentBased` flag, so on that line there is nothing to derive
        // and nothing to get wrong. MEASURED on LAWNS's 1,481-invoice export: **67 such lines,
        // and they are where this business actually takes its discounts** — 5%×28, 10%×14,
        // 15%×13, 20%×4, 25%×1, 50%×1, plus 6 that are fixed-dollar. Read by the same
        // detail-block key as everything else above.
        percentBased: typeof detail?.PercentBased === 'boolean' ? (detail.PercentBased as boolean) : null,
        discountPercent: num(detail?.DiscountPercent),
        // Read, tested, discarded — the string never reaches the returned row. See the field.
        discountInDescription: mentionsDiscount(str(l?.Description)),
        installInDescription: mentionsInstall(str(l?.Description)),
        replacementInDescription: mentionsReplacement(str(l?.Description)),
        itemAccountName: str((detail?.ItemAccountRef as { name?: unknown } | null)?.name),
        // The SIZE only — `readProductFromDescription` returns the plant's own size string and
        // nothing else from the prose, so no free text survives this line (R-24).
        sizeFromDescription: readProductFromDescription(str(l?.Description)).size,
      };
    });

    invoices.push({
      id,
      docNumber: str(inv?.DocNumber),
      txnDate: str(inv?.TxnDate),
      totalAmt: num(inv?.TotalAmt),
      balance: num(inv?.Balance),
      dueDate: str(inv?.DueDate),
      // 🔴 THE ID ONLY. `CustomerRef.name` is read nowhere in this file.
      customerId: str(custRef?.value),
      lines,
    });
  }
  return { ok: true, invoices, parseError: null };
}

/**
 * The invoice rows a screen shows, newest DOCUMENT date first, capped for display.
 *
 * 🔴 G9, AND IT IS THE DOCUMENT'S OWN DATE — NOT AN ARRIVAL ORDER. `ui-control-standards.md`
 * §1 G9: *"DEFAULT SORT IS THE MOST RECENT RECORD DATE FIRST: the date the document or event
 * itself carries, NOT the row's creation timestamp… Where the record's own date is absent, the
 * row falls back… for POSITION and says on its face that it has no date."* QuickBooks returns
 * these in its own order, which is neither.
 *
 * ⚠️ AN UNDATED INVOICE SORTS LAST AND STILL RENDERS "No date recorded". The fallback buys a
 * POSITION and never a displayed value (D-9 / A9) — the caller prints the null, not this order.
 *
 * ⚠️ THE CAP IS A DISPLAY CAP OVER A COMPLETE READ. The walk has already refused anything short
 * of its own pre-counted total (R-24), so nothing here is hiding a truncation; the caller states
 * the cap beside the total so the screen cannot read as the whole list.
 *
 * Pure and total: it never mutates the array it is given.
 */
export function invoiceRowsForDisplay(invoices: QboInvoiceRow[], limit = 100): QboInvoiceRow[] {
  return [...invoices]
    .sort((a, b) => {
      // '' sorts below every real `YYYY-MM-DD`, which puts undated rows last under `desc`.
      const cmp = (b.txnDate ?? '').localeCompare(a.txnDate ?? '');
      // A STABLE TIE-BREAK, so two invoices on one day do not swap places between renders and
      // make the screen look like it is changing under the reader.
      return cmp !== 0 ? cmp : a.id.localeCompare(b.id);
    })
    .slice(0, limit);
}

// ─── the breakdown ───────────────────────────────────────────────────────────

export interface DateRange {
  /** `YYYY-MM-DD`, or null when nothing carried a readable date. */
  earliest: string | null;
  latest: string | null;
  dated: number;
  /** An invoice whose TxnDate was missing or unreadable. Reported, never silently dropped. */
  undated: number;
  /** Whole months from earliest to latest inclusive — the span the other numbers cover. */
  monthsSpanned: number;
}

export interface MonthTally { month: string; invoices: number; }
export interface YearTally  { year: string;  invoices: number; }

export interface ItemQtyTally {
  itemId: string | null;
  itemName: string;
  lines: number;
  qty: number;
  amount: number;
}

export interface BundleItemTally {
  itemName: string;
  lines: number;
  zeroAmount: number;
  nonZeroAmount: number;
  qtyTotal: number;
  amountTotal: number;
}

export interface DiscountExample {
  docNumber: string | null;
  txnDate: string | null;
  /** The discount's own amount, as money. */
  amount: number;
  /** 🔴 DERIVED, NEVER STATED — Σ of the other charged lines on that invoice. `null` when the
   *  invoice had no other charged line, so nothing could be derived. */
  base: number | null;
  /** `amount ÷ base`, or null when the base could not be derived or the amount was $0. */
  derivedPct: number | null;
}

/**
 * 🔴 A RATE QUICKBOOKS STATED ITSELF — the `DiscountLineDetail` population, added 2026-09-07.
 *
 * This is where these books actually take their discounts, and the old code could not see it:
 * MEASURED on LAWNS, **67 native discount lines against 21 item lines**, and a native line
 * carries `PercentBased` + `DiscountPercent`, so **there is no base to find and no arithmetic to
 * get wrong.** It is the primary evidence for what a business discounts at.
 *
 * ⚠️ AND IT CARRIES NO NAME. A `DiscountLineDetail` has no `ItemRef` — all 67 of LAWNS's point at
 * one account, `92 · Discounts given`. So the rate is exact and the PROGRAMME is unknown; a name
 * can only come from the product list, and matching the two by rate is an inference this module
 * does not make. It reports rates; the caller decides what to do about names.
 */
export interface DiscountRateTally {
  /** The stated percent, e.g. 10. */
  pct: number;
  lines: number;
  /** Money discounted at this rate, as a positive amount. */
  amountTotal: number;
  /** Distinct customers who received it. */
  customers: number;
  first: string | null;
  last: string | null;
}

/**
 * Discounts taken as a FIXED DOLLAR AMOUNT (`PercentBased: false`). Reported as dollars and
 * NEVER converted into a percentage — the line does not say what it was a percentage OF, and
 * inventing a base is the whole class of error this file was corrected for.
 */
export interface FixedDollarDiscounts {
  lines: number;
  amountTotal: number;
  examples: { docNumber: string | null; txnDate: string | null; amount: number }[];
}

/**
 * A discount taken as an ITEM LINE — a service item with a negative price, used like any other
 * line. The SECOND population, and the smaller one (21 lines against 67 native ones on LAWNS) —
 * but the only one that carries a NAME, which is why it is kept.
 *
 * 🔴 ITS RATE IS DERIVED AND THE DERIVATION IS A STATED ASSUMPTION, NOT A FACT. The line says
 * what was taken off; it does not say what it was taken off OF. The base here is Σ of the other
 * charged lines on that invoice — which is right when the discount covered the whole invoice and
 * TOO LARGE when it covered only part of it (a discount on the trees but not the delivery reads
 * low). Every consumer must present it as derived, with the working shown, and must never round
 * a derived rate into a clean one.
 */
export interface DiscountNameTally {
  itemName: string;
  lines: number;
  /** Lines carrying no money at all. A giveaway is not a discount, so they yield NO rate — but
   *  they are counted, because "3 of these 9 were $0" is a fact about how the item is used. */
  zeroAmountLines: number;
  /** Lines where a base could be derived (the invoice had other charged lines). */
  withBase: number;
  /** Σ of those DERIVED bases, in dollars. */
  baseTotal: number;
  amountTotal: number;
  /** A handful of real invoices so the counts above are checkable rather than asserted. */
  examples: DiscountExample[];
  /**
   * 🔴 THE PERCENT, DISTRIBUTED — NEVER AVERAGED. `|amount| ÷ base × 100` per line, tallied by
   * value, most-used first. An AVERAGE would report a discount used at 10% forty times and at 40%
   * once as "10.7%", which is a number nobody granted; the distribution says "10% on 40 lines,
   * 40% on 1" and lets a reader see the outlier that an average dissolves. `consistent` is then a
   * FACT about the tally rather than a judgement — one entry means one rate, always.
   *
   * A line with no readable base, a zero base, or no amount contributes NOTHING here (it is
   * already counted in `verdicts.noBase`), so `Σ percents[].lines ≤ lines` and the shortfall is
   * exactly what could not be measured. Rounded to 2dp so float dust cannot split one rate in two.
   */
  percents: { pct: number; lines: number }[];
  /** Intuit's `TxnDate` STRING of the latest invoice carrying this discount — `null` if none
   *  carried a date. Kept as the string it arrived as, the same treatment `txnDate` gets. */
  mostRecent: string | null;
}

export interface DiscountBreakdown {
  /** The ITEM-LINE population — named, rate DERIVED. */
  byName: DiscountNameTally[];
  /** 🔴 The NATIVE population — rate STATED by QuickBooks, no name. The primary evidence. */
  byRate: DiscountRateTally[];
  /** Native discount lines that were a fixed dollar amount. Never converted to a percent. */
  fixedDollar: FixedDollarDiscounts;
  /** 🔴 Discount-shaped lines NOT in the named list — proof the list did not under-cover. */
  unnamedDiscountLines: { itemName: string; lines: number }[];
}

export interface InvoiceBreakdown {
  invoices: number;
  amountTotal: number;
  dateRange: DateRange;
  byYear: YearTally[];
  byMonth: MonthTally[];
  linesTotal: number;
  linesWithItemRef: number;
  /** Covers 100% of lines, so a line type this file does not interpret is VISIBLE, not lost. */
  byDetailType: { detailType: string; lines: number }[];
  distinctCustomers: number;
  invoicesWithoutCustomer: number;
  /** Goods lines only — discount lines are excluded, see `summariseInvoices`. */
  topItemsByQty: ItemQtyTally[];
  distinctItemsSold: number;
  totalQtySold: number;
  bundleItems: BundleItemTally[];
  /** How many lines book against item `1` — the twelve literals' target. */
  linesOnItemId1: number;
  discounts: DiscountBreakdown;
}

/** How many items appear in the top list. Enough to see the shape of a catalog, not a data dump. */
export const TOP_ITEM_LIMIT = 30;
/** Concrete invoices shown per discount item, so a verdict count can be spot-checked. */
export const DISCOUNT_EXAMPLE_LIMIT = 3;

const MONTH_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * `YYYY-MM` from Intuit's date STRING, by slicing — never by constructing a `Date`.
 *
 * 🔴 `new Date('2025-01-01').getMonth()` is DECEMBER 2024 west of Greenwich: the string parses as
 * UTC midnight and then renders in local time. A seasonality curve built that way moves every
 * invoice dated the 1st into the previous month, and it looks entirely plausible.
 */
function monthOf(txnDate: string | null): string | null {
  if (!txnDate) return null;
  const m = MONTH_RE.exec(txnDate.trim());
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return `${m[1]}-${m[2]}`;
}

/** Every month from `first` to `last` inclusive, so a month with NO sales is a visible zero. */
function monthsBetween(first: string, last: string): string[] {
  const out: string[] = [];
  let [y, m] = [Number(first.slice(0, 4)), Number(first.slice(5, 7))];
  const [ly, lm] = [Number(last.slice(0, 4)), Number(last.slice(5, 7))];
  // Bounded so a malformed pair can never spin this forever: 100 years of months.
  for (let guard = 0; guard < 1200; guard++) {
    out.push(`${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`);
    if (y > ly || (y === ly && m >= lm)) break;
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

/**
 * The whole breakdown, computed once so the screen and any later consumer cannot describe the
 * same list differently.
 *
 * 🔴 DISCOUNT LINES ARE EXCLUDED FROM `topItemsByQty`, AND THAT IS NOT TIDINESS. On these books a
 * discount line's `Qty` is the DOLLAR BASE the percentage was taken from, not a count of
 * anything. Leaving them in puts `CD10%` at the top of "what sold" with a quantity in the
 * thousands — a units column silently holding dollars, which is the unit-confusion class that
 * makes a report worse than no report.
 */
export function summariseInvoices(invoices: QboInvoiceRow[]): InvoiceBreakdown {
  // ── dates ──────────────────────────────────────────────────────────────────
  let earliest: string | null = null;
  let latest: string | null = null;
  let dated = 0, undated = 0;
  const monthCounts = new Map<string, number>();
  const yearCounts = new Map<string, number>();

  // ── people, money, lines ───────────────────────────────────────────────────
  const customers = new Set<string>();
  let invoicesWithoutCustomer = 0;
  let amountTotal = 0;
  let linesTotal = 0, linesWithItemRef = 0, linesOnItemId1 = 0;
  const detailTypes = new Map<string, number>();

  const itemTally = new Map<string, ItemQtyTally>();
  const bundleTally = new Map<string, BundleItemTally>();
  const discountTally = new Map<string, DiscountNameTally>();
  const rateTally = new Map<number, { pct: number; lines: number; amountTotal: number; customers: Set<string>; first: string | null; last: string | null }>();
  let fixedDollarLines = 0, fixedDollarTotal = 0;
  const fixedDollarExamples: { docNumber: string | null; txnDate: string | null; amount: number }[] = [];
  const unnamedDiscounts = new Map<string, number>();

  for (const inv of invoices) {
    const month = monthOf(inv.txnDate);
    if (month === null) {
      undated++;
    } else {
      dated++;
      const day = (inv.txnDate ?? '').trim();
      if (earliest === null || day < earliest) earliest = day;
      if (latest === null || day > latest) latest = day;
      monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
      const year = month.slice(0, 4);
      yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
    }

    if (inv.customerId) customers.add(inv.customerId); else invoicesWithoutCustomer++;
    if (inv.totalAmt !== null) amountTotal += inv.totalAmt;

    // The subtotal a discount on THIS invoice would have been taken from, if it covered
    // everything. SubTotalLineDetail is excluded because Intuit emits it as a line carrying the
    // running total — counting it would double every invoice that has one.
    // 🔴 `otherChargedCents` IS THE BASE EVERY DERIVED RATE ON THIS INVOICE USES, and it is
    // computed ONCE per invoice rather than per discount line, so two discounts on one invoice
    // cannot be derived against two different bases.
    //
    // ⚠️ IT EXCLUDES DISCOUNT LINES IN BOTH DIRECTIONS, AND THE SECOND ONE WAS A REAL DEFECT:
    // an item-line discount is NEGATIVE and was already excluded by the `> 0` test, but a native
    // `DiscountLineDetail` amount is **POSITIVE** (measured: 67 of 67 on LAWNS), so it was being
    // ADDED to the subtotal — inflating the base a discount is compared against, by the discount.
    let otherChargedCents = 0;
    for (const l of inv.lines) {
      if (isAnyDiscount(l)) continue;
      if ((l.detailType ?? '') === 'SubTotalLineDetail') continue;
      const c = cents(l.amount);
      if (c !== null && c > 0) otherChargedCents += c;
    }

    for (const l of inv.lines) {
      linesTotal++;
      const dt = l.detailType ?? '(no DetailType)';
      detailTypes.set(dt, (detailTypes.get(dt) ?? 0) + 1);
      if (l.itemId !== null) linesWithItemRef++;
      if (l.itemId === '1') linesOnItemId1++;

      const nameKey = (l.itemName ?? '').trim().toLowerCase();

      // ── ① THE NATIVE DISCOUNT LINE — the rate is STATED, so nothing is derived. ───────────
      // MEASURED on LAWNS: 67 of these against 21 item lines. This is where the business
      // actually discounts, and the old code could not see it — these lines have no `ItemRef`,
      // so `isNamedDiscount` was false and they fell into `unnamedDiscountLines` as a count.
      if ((l.detailType ?? '') === QBO_DETAIL_TYPE.discount) {
        const amt = Math.abs(l.amount ?? 0);
        if (l.percentBased === true && l.discountPercent !== null) {
          const key = l.discountPercent;
          const r = rateTally.get(key) ?? { pct: key, lines: 0, amountTotal: 0, customers: new Set<string>(), first: null as string | null, last: null as string | null };
          r.lines++;
          r.amountTotal += amt;
          if (inv.customerId) r.customers.add(inv.customerId);
          if (inv.txnDate && (r.first === null || inv.txnDate < r.first)) r.first = inv.txnDate;
          if (inv.txnDate && (r.last === null || inv.txnDate > r.last)) r.last = inv.txnDate;
          rateTally.set(key, r);
        } else {
          // 🔴 FIXED DOLLAR. It does not say what it was a percentage OF, so it is reported as
          // money and never converted — inventing a base is the error this file was corrected for.
          fixedDollarLines++;
          fixedDollarTotal += amt;
          if (fixedDollarExamples.length < DISCOUNT_EXAMPLE_LIMIT) {
            fixedDollarExamples.push({ docNumber: inv.docNumber, txnDate: inv.txnDate, amount: amt });
          }
        }
        continue;   // a discount line is not a sale and never enters the item tallies
      }

      // ── ② THE ITEM-LINE DISCOUNT — named, rate DERIVED from the other charged lines. ──────
      if (isNamedDiscount(l)) {
        const row = discountTally.get(nameKey) ?? {
          itemName: l.itemName ?? '(unnamed)', lines: 0, zeroAmountLines: 0, withBase: 0,
          baseTotal: 0, amountTotal: 0, examples: [], percents: [], mostRecent: null,
        };
        row.lines++;
        if (l.amount !== null) row.amountTotal += l.amount;

        // The DATE this discount was last granted. `localeCompare` on Intuit's `YYYY-MM-DD` is a
        // correct ordering without parsing a Date — the same reason `txnDate` is kept as a string
        // everywhere else in this file (a Date would apply a timezone nobody asked for).
        if (inv.txnDate && (row.mostRecent === null || inv.txnDate.localeCompare(row.mostRecent) > 0)) {
          row.mostRecent = inv.txnDate;
        }

        // 🔴 THE BASE IS `otherChargedCents`, NEVER `l.qty`. `Qty` is 1 on every one of these
        // lines — measured, all 21 — and reading it as a base printed $182.50 as "18250%".
        const amt = l.amount ?? 0;
        const base = otherChargedCents > 0 ? otherChargedCents / 100 : null;
        let derivedPct: number | null = null;
        if (amt === 0) {
          // A GIVEAWAY IS NOT A DISCOUNT (the same rule `sold-below-quickbooks-list` applies).
          // It yields no rate; counting it as 0% would drag a clean 5% item into "rates disagree".
          row.zeroAmountLines++;
        } else if (base !== null) {
          row.withBase++;
          row.baseTotal += base;
          derivedPct = Math.round((Math.abs(amt) / base) * 100 * 100) / 100;
          const seen = row.percents.find(x => x.pct === derivedPct);
          if (seen) seen.lines++; else row.percents.push({ pct: derivedPct, lines: 1 });
        }

        if (row.examples.length < DISCOUNT_EXAMPLE_LIMIT) {
          row.examples.push({ docNumber: inv.docNumber, txnDate: inv.txnDate, amount: amt, base, derivedPct });
        }
        discountTally.set(nameKey, row);
        continue;   // a discount line is not a sale and never enters the item tallies
      }

      if (isDiscountShaped(l)) {
        const label = l.itemName ?? `(${l.detailType ?? 'no DetailType'} line)`;
        unnamedDiscounts.set(label, (unnamedDiscounts.get(label) ?? 0) + 1);
        continue;
      }

      if (BUNDLE_SET.has(nameKey)) {
        const row = bundleTally.get(nameKey) ?? {
          itemName: l.itemName ?? '(unnamed)', lines: 0, zeroAmount: 0, nonZeroAmount: 0,
          qtyTotal: 0, amountTotal: 0,
        };
        row.lines++;
        // Whether these really are $0 is a CLAIM about their books, so it is counted rather
        // than assumed — a bundle item carrying money is a different finding entirely.
        if ((cents(l.amount) ?? 0) === 0) row.zeroAmount++; else row.nonZeroAmount++;
        if (l.qty !== null) row.qtyTotal += l.qty;
        if (l.amount !== null) row.amountTotal += l.amount;
        bundleTally.set(nameKey, row);
      }

      // Goods. A line with no ItemRef at all (a DescriptionOnly note) is counted in
      // byDetailType and nowhere else — it did not sell anything.
      if (l.itemId === null && l.itemName === null) continue;
      const key = `${l.itemId ?? '-'}::${nameKey}`;
      const row = itemTally.get(key) ?? {
        itemId: l.itemId, itemName: l.itemName ?? '(unnamed)', lines: 0, qty: 0, amount: 0,
      };
      row.lines++;
      if (l.qty !== null) row.qty += l.qty;
      if (l.amount !== null) row.amount += l.amount;
      itemTally.set(key, row);
    }
  }

  const allItems = [...itemTally.values()];
  const totalQtySold = allItems.reduce((s, i) => s + i.qty, 0);

  const monthsAll = earliest && latest ? monthsBetween(earliest.slice(0, 7), latest.slice(0, 7)) : [];
  const byMonth: MonthTally[] = monthsAll.map(m => ({ month: m, invoices: monthCounts.get(m) ?? 0 }));



  return {
    invoices: invoices.length,
    amountTotal,
    dateRange: { earliest, latest, dated, undated, monthsSpanned: monthsAll.length },
    byYear: [...yearCounts.entries()]
      .map(([year, n]) => ({ year, invoices: n }))
      .sort((a, b) => a.year.localeCompare(b.year)),
    byMonth,
    linesTotal,
    linesWithItemRef,
    byDetailType: [...detailTypes.entries()]
      .map(([detailType, lines]) => ({ detailType, lines }))
      .sort((a, b) => b.lines - a.lines || a.detailType.localeCompare(b.detailType)),
    distinctCustomers: customers.size,
    invoicesWithoutCustomer,
    topItemsByQty: allItems
      .sort((a, b) => b.qty - a.qty || b.amount - a.amount || a.itemName.localeCompare(b.itemName))
      .slice(0, TOP_ITEM_LIMIT),
    distinctItemsSold: allItems.length,
    totalQtySold,
    bundleItems: [...bundleTally.values()].sort((a, b) => b.lines - a.lines),
    linesOnItemId1,
    discounts: {
      byName: [...discountTally.values()]
        .map(r => ({ ...r, percents: [...r.percents].sort((a, b) => b.lines - a.lines || a.pct - b.pct) }))
        .sort((a, b) => b.lines - a.lines || a.itemName.localeCompare(b.itemName)),
      // Ordered by MONEY, not by count — 4 lines at 20% is $15,173 on these books and 28 at 5%
      // is $2,906, so a count ordering would bury the largest thing on the page.
      byRate: [...rateTally.values()]
        .map(r => ({ pct: r.pct, lines: r.lines, amountTotal: Math.round(r.amountTotal * 100) / 100, customers: r.customers.size, first: r.first, last: r.last }))
        .sort((a, b) => b.amountTotal - a.amountTotal || a.pct - b.pct),
      fixedDollar: { lines: fixedDollarLines, amountTotal: Math.round(fixedDollarTotal * 100) / 100, examples: fixedDollarExamples },
      unnamedDiscountLines: [...unnamedDiscounts.entries()]
        .map(([itemName, lines]) => ({ itemName, lines }))
        .sort((a, b) => b.lines - a.lines || a.itemName.localeCompare(b.itemName)),
    },
  };
}
