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
}

/** One invoice. 🔴 `customerId` and NO customer name — see the file header. */
export interface QboInvoiceRow {
  id: string;
  docNumber: string | null;
  /** Intuit's `YYYY-MM-DD`, kept as the STRING it arrived as — see `monthOf`. */
  txnDate: string | null;
  totalAmt: number | null;
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
  if ((line.detailType ?? '') === 'DiscountLineDetail') return true;
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
      };
    });

    invoices.push({
      id,
      docNumber: str(inv?.DocNumber),
      txnDate: str(inv?.TxnDate),
      totalAmt: num(inv?.TotalAmt),
      // 🔴 THE ID ONLY. `CustomerRef.name` is read nowhere in this file.
      customerId: str(custRef?.value),
      lines,
    });
  }
  return { ok: true, invoices, parseError: null };
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
  base: number | null;
  subtotal: number;
  gap: number | null;
}

export interface DiscountNameTally {
  itemName: string;
  lines: number;
  /** How many of those lines carried a readable Qty to use as the base. */
  withBase: number;
  baseTotal: number;
  amountTotal: number;
  /** 🔴 THE ANSWER. What the base was measured against, counted four ways. */
  verdicts: { equalsSubtotal: number; belowSubtotal: number; aboveSubtotal: number; noBase: number };
  /** When the base was BELOW the invoice subtotal, the items whose amount accounts for the gap. */
  excludedFromBase: { itemName: string; times: number }[];
  /** A handful of real invoices so the counts above are checkable rather than asserted. */
  examples: DiscountExample[];
}

export interface DiscountBreakdown {
  byName: DiscountNameTally[];
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
    let subtotalCents = 0;
    for (const l of inv.lines) {
      if (isAnyDiscount(l)) continue;
      if ((l.detailType ?? '') === 'SubTotalLineDetail') continue;
      const c = cents(l.amount);
      if (c !== null && c > 0) subtotalCents += c;
    }

    for (const l of inv.lines) {
      linesTotal++;
      const dt = l.detailType ?? '(no DetailType)';
      detailTypes.set(dt, (detailTypes.get(dt) ?? 0) + 1);
      if (l.itemId !== null) linesWithItemRef++;
      if (l.itemId === '1') linesOnItemId1++;

      const nameKey = (l.itemName ?? '').trim().toLowerCase();

      if (isNamedDiscount(l)) {
        const row = discountTally.get(nameKey) ?? {
          itemName: l.itemName ?? '(unnamed)', lines: 0, withBase: 0, baseTotal: 0, amountTotal: 0,
          verdicts: { equalsSubtotal: 0, belowSubtotal: 0, aboveSubtotal: 0, noBase: 0 },
          excludedFromBase: [], examples: [],
        };
        row.lines++;
        if (l.amount !== null) row.amountTotal += l.amount;

        const base = l.qty;
        const baseCents = cents(base);
        if (base === null || baseCents === null) {
          row.verdicts.noBase++;
        } else {
          row.withBase++;
          row.baseTotal += base;
          if (baseCents === subtotalCents) row.verdicts.equalsSubtotal++;
          else if (baseCents < subtotalCents) {
            row.verdicts.belowSubtotal++;
            // 🔴 WHAT WAS LEFT OUT. When the base is short of the invoice subtotal, a single
            // line whose amount equals the gap names what the discount did NOT apply to — which
            // is the actual question: is placement inside the discounted base or outside it?
            const gapCents = subtotalCents - baseCents;
            for (const other of inv.lines) {
              if (other === l || isAnyDiscount(other)) continue;
              if ((other.detailType ?? '') === 'SubTotalLineDetail') continue;
              if (cents(other.amount) === gapCents) {
                const label = other.itemName ?? `(${other.detailType ?? 'no DetailType'} line)`;
                const hit = row.excludedFromBase.find(e => e.itemName === label);
                if (hit) hit.times++; else row.excludedFromBase.push({ itemName: label, times: 1 });
                break;
              }
            }
          } else row.verdicts.aboveSubtotal++;
        }

        if (row.examples.length < DISCOUNT_EXAMPLE_LIMIT) {
          row.examples.push({
            docNumber: inv.docNumber,
            base,
            subtotal: subtotalCents / 100,
            gap: baseCents === null ? null : (subtotalCents - baseCents) / 100,
          });
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

  for (const row of discountTally.values()) {
    row.excludedFromBase.sort((a, b) => b.times - a.times || a.itemName.localeCompare(b.itemName));
  }

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
      byName: [...discountTally.values()].sort((a, b) => b.lines - a.lines || a.itemName.localeCompare(b.itemName)),
      unnamedDiscountLines: [...unnamedDiscounts.entries()]
        .map(([itemName, lines]) => ({ itemName, lines }))
        .sort((a, b) => b.lines - a.lines || a.itemName.localeCompare(b.itemName)),
    },
  };
}
