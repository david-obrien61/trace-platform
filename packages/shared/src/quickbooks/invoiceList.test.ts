/**
 * ── invoiceList — what the customer's own history says, without saying who ────────────
 *
 * The invoice read is the one the item and customer reads were a detour around: an invoice
 * carries the items, the quantities, the prices and the buyer on ONE record, so it is the only
 * place in the books that can answer *"how many trees did we plant last year"*.
 *
 * 🔴 §B IS FIRST AMONG EQUALS. Every other number here is meaningless without the SPAN it
 * covers, and the span is computed from a date STRING — never a `Date`, because
 * `new Date('2025-01-01').getMonth()` is December 2024 west of Greenwich and a seasonality
 * curve built that way is plausible and wrong.
 *
 * 🔴 §G IS THE ONE THAT WOULD BE SERIOUS TO FAIL. R-24 clause (c) says nothing personal reaches
 * a log, and R-24's own GUARD cell records that NO CAP ASSERTS IT. This section is that cap for
 * this file: a customer name and a street address are put INTO the fixture, and the entire
 * serialised output of both the parse and the summary is searched for them.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/invoiceList.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  parseInvoiceList, summariseInvoices, DISCOUNT_ITEM_NAMES, BUNDLE_ITEM_NAMES,
  TOP_ITEM_LIMIT,
} from './invoiceList';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ─── fixtures, shaped like Intuit's real bodies ──────────────────────────────
function body(invoices: unknown[]): string {
  return JSON.stringify({ QueryResponse: { Invoice: invoices, startPosition: 1 }, time: 'x' });
}
function sale(name: string, id: string, qty: number | null, amount: number) {
  return {
    Amount: amount, DetailType: 'SalesItemLineDetail',
    SalesItemLineDetail: { ItemRef: { value: id, name }, ...(qty === null ? {} : { Qty: qty }) },
  };
}
/**
 * A discount taken as a service ITEM line.
 *
 * ✏️ CORRECTED 2026-09-07. This helper's third argument used to be called `base` and was written
 * into **`Qty`** — encoding a claim from a comment in `invoiceList.ts` that a discount line's Qty
 * is the dollar base. **MEASURED against LAWNS's export: `Qty` is 1 on all 21 such lines.** So the
 * fixtures agreed with the code because both believed the same false thing, and 83 green
 * assertions sat over a screen rendering `$182.50` as `18250%`. The base is now where it really
 * lives — on the OTHER lines of the invoice — and `qty` defaults to what her books actually hold.
 */
function discount(name: string, id: string, qty: number | null, amount: number) {
  return {
    Amount: amount, DetailType: 'SalesItemLineDetail',
    SalesItemLineDetail: { ItemRef: { value: id, name }, ...(qty === null ? {} : { Qty: qty }) },
  };
}
/** A NATIVE QuickBooks discount line — the rate is STATED and the amount is POSITIVE. */
function nativeDiscount(amount: number, pct: number | null) {
  return {
    Amount: amount, DetailType: 'DiscountLineDetail',
    DiscountLineDetail: pct === null
      ? { PercentBased: false, DiscountAccountRef: { value: '92', name: 'Discounts given' } }
      : { PercentBased: true, DiscountPercent: pct, DiscountAccountRef: { value: '92', name: 'Discounts given' } },
  };
}
function subTotal(amount: number) {
  return { Amount: amount, DetailType: 'SubTotalLineDetail', SubTotalLineDetail: {} };
}
function note(text: string) {
  return { Amount: 0, DetailType: 'DescriptionOnly', Description: text };
}
function invoice(o: {
  id: string; date?: string | null; doc?: string; total?: number;
  customer?: { value: string; name: string } | null; lines?: unknown[];
}) {
  return {
    Id: o.id,
    ...(o.doc ? { DocNumber: o.doc } : {}),
    ...(o.date === undefined ? { TxnDate: '2025-09-14' } : o.date === null ? {} : { TxnDate: o.date }),
    ...(o.total === undefined ? {} : { TotalAmt: o.total }),
    ...(o.customer === undefined ? { CustomerRef: { value: '58', name: 'Acme Landscaping' } }
      : o.customer === null ? {} : { CustomerRef: o.customer }),
    Line: o.lines ?? [],
  };
}

// ══ §A THE PARSE — SHAPE, AND EMPTY IS NOT UNREADABLE ═══════════════════════
{
  const p = parseInvoiceList(body([
    invoice({ id: '101', doc: '1001', date: '2025-09-14', total: 1200,
      lines: [sale('Shumard Oak', '19', 2, 900), sale('Placement Service', '27', 2, 300)] }),
  ]));
  ok(p.ok === true && p.invoices.length === 1, 'a one-invoice page parses to one invoice');
  const inv = p.invoices[0];
  ok(inv.id === '101' && inv.docNumber === '1001', 'the id and the document number are carried');
  ok(inv.txnDate === '2025-09-14', 'the transaction date is carried as the STRING Intuit sent');
  ok(inv.totalAmt === 1200, 'the invoice total is carried');
  ok(inv.customerId === '58', 'the customer is carried as an ID');
  ok(inv.lines.length === 2, 'both lines are carried');
  ok(inv.lines[0].itemId === '19' && inv.lines[0].itemName === 'Shumard Oak' && inv.lines[0].qty === 2,
    'the ItemRef is read out of the detail block — id, name and Qty');
  ok(inv.lines[0].amount === 900, 'and the line amount');

  ok(parseInvoiceList(JSON.stringify({ QueryResponse: {} })).ok === true,
    'a company with no invoices is a TRUE empty answer — Intuit omits the key rather than sending []');
  ok(parseInvoiceList(JSON.stringify({ QueryResponse: {} })).invoices.length === 0, 'and it holds zero invoices');
  const bad = parseInvoiceList('<html>502 Bad Gateway</html>');
  ok(bad.ok === false && bad.parseError !== null,
    '🔴 an unreadable body is NOT a successful read of zero invoices, and it says it could not be read (D-9 / A9)');
  ok(parseInvoiceList(JSON.stringify({ QueryResponse: {} })).ok !== bad.ok,
    '🔴 the two are distinguishable at the top level — collapsing them ends the pagination walk as if the history were finished');

  const noId = parseInvoiceList(body([{ TxnDate: '2025-01-01', Line: [] }]));
  ok(noId.ok === true && noId.invoices.length === 0, 'an invoice with no Id is dropped rather than rendered as a usable record');

  const noLines = parseInvoiceList(body([invoice({ id: '9', lines: undefined })]));
  ok(noLines.invoices[0].lines.length === 0, 'an invoice with no Line array parses to zero lines, not a crash');
  const weirdLines = parseInvoiceList(body([{ Id: '9', TxnDate: '2025-01-01', Line: 'nope' }]));
  ok(weirdLines.invoices[0].lines.length === 0, 'a Line that is not an array is zero lines, not a coerced string');

  // The detail block is read BY ITS DETAIL TYPE, so an unfamiliar block is read the same way.
  const grouped = parseInvoiceList(body([invoice({ id: '9', lines: [
    { Amount: 50, DetailType: 'GroupLineDetail', GroupLineDetail: { ItemRef: { value: '77', name: 'Spring Bundle' }, Qty: 4 } },
  ] })]));
  ok(grouped.invoices[0].lines[0].itemId === '77' && grouped.invoices[0].lines[0].qty === 4,
    '🔴 the ItemRef is read from the block NAMED BY DetailType — hardcoding SalesItemLineDetail would report "no item" for every other line type');
}

// ══ §B THE DATE RANGE — THE FIRST THING THIS READ MUST REPORT ═══════════════
{
  const p = parseInvoiceList(body([
    invoice({ id: '1', date: '2025-08-23' }),
    invoice({ id: '2', date: '2026-03-02' }),
    invoice({ id: '3', date: '2025-11-30' }),
  ]));
  const s = summariseInvoices(p.invoices);
  ok(s.dateRange.earliest === '2025-08-23', 'the earliest TxnDate is reported');
  ok(s.dateRange.latest === '2026-03-02', 'and the latest');
  ok(s.dateRange.dated === 3 && s.dateRange.undated === 0, 'all three are dated');
  ok(s.dateRange.monthsSpanned === 8, 'the span is 8 months — Aug 2025 through Mar 2026 inclusive');

  // 🔴 THE TIMEZONE DEFECT, ASSERTED. Every one of these is the FIRST of a month.
  const firsts = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', date: '2025-01-01' }), invoice({ id: '2', date: '2025-06-01' }),
  ])).invoices);
  ok(firsts.byMonth[0].month === '2025-01' && firsts.byMonth[0].invoices === 1,
    '🔴 an invoice dated the 1st of January stays in JANUARY — `new Date("2025-01-01").getMonth()` is DECEMBER west of Greenwich, and a curve built that way moves every first-of-month back a month and looks plausible');
  ok(firsts.byYear.length === 1 && firsts.byYear[0].year === '2025' && firsts.byYear[0].invoices === 2,
    'and the year tally agrees');

  // The gap months must be PRESENT as zeros — a month with no sales is the seasonality answer.
  // Looked up rather than indexed: a mutant that DROPS the gap months must be reported as a
  // counted failure, not kill the harness on `undefined.month` and print no summary at all.
  ok(firsts.byMonth.length === 6, 'January to June inclusive is six months');
  ok(firsts.byMonth.length === firsts.dateRange.monthsSpanned,
    'the month rows and the reported span agree — one number cannot claim a span the other does not cover');
  const april = firsts.byMonth.find(m => m.month === '2025-04');
  ok(april !== undefined && april.invoices === 0,
    '🔴 a month with NO invoices is a ZERO ROW, not a missing one — the empty months ARE the seasonality curve, and omitting them draws a flat line through the off-season');
  ok(firsts.byMonth.every((m, i, a) => i === 0 || m.month > a[i - 1].month), 'the months come back in order');

  const yearEnd = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', date: '2025-12-15' }), invoice({ id: '2', date: '2026-01-04' }),
  ])).invoices);
  ok(yearEnd.byMonth.length === 2 && yearEnd.byMonth[1].month === '2026-01',
    'the month walk rolls over a year boundary rather than counting to month 13');

  const undated = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', date: '2025-08-23' }), invoice({ id: '2', date: null }),
    invoice({ id: '3', date: 'last tuesday' }), invoice({ id: '4', date: '2025-13-01' }),
  ])).invoices);
  ok(undated.dateRange.dated === 1 && undated.dateRange.undated === 3,
    '🔴 an invoice with no readable date is COUNTED as undated, never dropped and never given a date — three different unreadable shapes, all reported');
  ok(undated.dateRange.earliest === '2025-08-23',
    'and the undated ones do not contaminate the range');

  const none = summariseInvoices([]);
  ok(none.dateRange.earliest === null && none.dateRange.latest === null && none.byMonth.length === 0,
    'an empty history reports NO range rather than a fabricated one');
  ok(none.invoices === 0 && none.totalQtySold === 0, 'and zero everywhere else');
}

// ══ §C LINES — THE DETAIL-TYPE TALLY COVERS 100% OF THEM ════════════════════
{
  const s = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', lines: [
      sale('Shumard Oak', '19', 2, 900),
      note('planting notes'),
      subTotal(900),
      { Amount: 74.25, DetailType: 'SomeFutureLineDetail', SomeFutureLineDetail: {} },
    ] }),
  ])).invoices);
  ok(s.linesTotal === 4, 'every line is counted');
  ok(s.byDetailType.reduce((n, d) => n + d.lines, 0) === s.linesTotal,
    '🔴 THE DETAIL-TYPE TALLY COVERS EVERY LINE. A line type this file does not interpret is VISIBLE in the tally rather than silently absent from the totals (R-19: a list that claims to cover a record must cover it)');
  ok(s.byDetailType.some(d => d.detailType === 'SomeFutureLineDetail'),
    'including a type nobody has seen before — it is reported under its own name, not bucketed into "other"');
  ok(s.linesWithItemRef === 1, 'only the sale line carries an ItemRef');
  ok(s.linesWithItemRef < s.linesTotal,
    'and lines-with-an-item is reported SEPARATELY from lines-total, because the gap is the point');

  const noType = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', lines: [{ Amount: 10 }] }),
  ])).invoices);
  ok(noType.byDetailType[0].detailType === '(no DetailType)',
    'a line with no DetailType is labelled as having none — never a blank string that reads as a rendering bug');
}

// ══ §D WHAT SOLD — AND WHY A DISCOUNT LINE IS NOT IN IT ═════════════════════
{
  const s = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', lines: [sale('Shumard Oak', '19', 3, 1350), sale('Cedar Elm', '21', 1, 400)] }),
    invoice({ id: '2', lines: [sale('Shumard Oak', '19', 5, 2250), discount('CD10%', '90', 2600, -260)] }),
  ])).invoices);

  ok(s.topItemsByQty[0].itemName === 'Shumard Oak' && s.topItemsByQty[0].qty === 8,
    'quantities add across invoices — 3 + 5 Shumard oaks, which is the number Terry has never been able to ask for');
  ok(s.topItemsByQty[0].lines === 2 && s.topItemsByQty[0].amount === 3600, 'with its line count and its money');
  ok(s.topItemsByQty[1].itemName === 'Cedar Elm', 'and the list is ordered by quantity, biggest first');
  ok(s.distinctItemsSold === 2, 'two distinct items sold');

  // 🔴 THE UNIT-CONFUSION DEFECT. On these books a discount line's Qty is a DOLLAR BASE.
  ok(!s.topItemsByQty.some(i => i.itemName === 'CD10%'),
    '🔴 A DISCOUNT LINE IS NOT IN "WHAT SOLD". Its Qty is the DOLLAR BASE the percentage was taken from — leaving it in puts CD10% at the top of the list with a quantity of 2,600, a units column silently holding dollars');
  ok(s.totalQtySold === 9,
    '🔴 and the total quantity is 9 trees, not 2,609 — the single number most likely to be quoted out of this read');
  ok(s.topItemsByQty.length <= TOP_ITEM_LIMIT, 'the top list is capped');

  const many = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', lines: Array.from({ length: TOP_ITEM_LIMIT + 12 }, (_, i) => sale(`Item ${i}`, String(i), i + 1, 10)) }),
  ])).invoices);
  ok(many.topItemsByQty.length === TOP_ITEM_LIMIT, 'a catalog larger than the cap is truncated to the cap');
  ok(many.distinctItemsSold === TOP_ITEM_LIMIT + 12,
    '🔴 but the DISTINCT COUNT is the real number, so the capped table cannot be read as the whole catalog');

  const noQty = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', lines: [sale('Shumard Oak', '19', null, 450)] }),
  ])).invoices);
  ok(noQty.topItemsByQty[0].qty === 0 && noQty.topItemsByQty[0].amount === 450,
    'a line with no Qty contributes its money and no quantity — never a fabricated 1');

  const idOne = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', lines: [sale('Services', '1', 1, 100), sale('Services', '1', 1, 50), sale('Shumard Oak', '19', 1, 400)] }),
  ])).invoices);
  ok(idOne.linesOnItemId1 === 2,
    '🔴 lines booking against item `1` are counted — that is the generic bucket the twelve hardcoded literals point at');
}

// ══ §E THE $0 BUNDLE ITEMS — COUNTED, NOT ASSUMED ═══════════════════════════
{
  const s = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', lines: [sale('Shumard Oak', '19', 2, 900), sale('DIW', '55', 2, 0)] }),
    invoice({ id: '2', lines: [sale('FDIW', '56', 1, 0), sale('DIW', '55', 1, 125)] }),
  ])).invoices);

  const diw = s.bundleItems.find(b => b.itemName === 'DIW');
  ok(diw !== undefined && diw.lines === 2, 'DIW lines are tallied');
  ok(diw?.zeroAmount === 1 && diw?.nonZeroAmount === 1,
    '🔴 WHETHER THEY ARE REALLY $0 IS COUNTED, NOT ASSUMED. "the $0 bundle items" is a claim about their books; a bundle line carrying $125 is a different finding and must not be averaged away');
  ok(s.bundleItems.some(b => b.itemName === 'FDIW'), 'FDIW is tallied too');
  ok(BUNDLE_ITEM_NAMES.length === 2, 'the bundle list is the two names David gave');

  const lower = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', lines: [sale('diw', '55', 1, 0)] }),
  ])).invoices);
  ok(lower.bundleItems.length === 1,
    'matching is case-insensitive — a vocabulary comparison that depends on their casing is the class normalizeSize was written for');

  ok(s.topItemsByQty.some(i => i.itemName === 'DIW'),
    'a bundle line is ALSO a sold line: it carries a real quantity (how many trees got the work), so it stays in the item tally as well');
}

// ══ §F THE DISCOUNTS — TWO POPULATIONS, AND ONLY ONE OF THEM STATES ITS RATE ═══════════════
{
  // 🔴 THE 100× PROBE. $120 off an invoice carrying $1,200 of other lines is 10%. The shipped
  // version divided by `Qty` — which is 1 — and printed 12000%. Nothing else in this § matters
  // as much as this one assertion.
  const s = summariseInvoices(parseInvoiceList(body([
    invoice({ id: 'A', doc: '2001', lines: [
      sale('Shumard Oak', '19', 2, 900), sale('Placement Service', '27', 2, 300),
      subTotal(1200), discount('CD10%', '90', 1, -120),
    ] }),
    invoice({ id: 'B', doc: '2002', lines: [
      sale('Shumard Oak', '19', 2, 900), sale('Placement Service', '27', 2, 300),
      discount('CD10%', '90', 1, -90),
    ] }),
  ])).invoices);

  const cd = s.discounts.byName.find(d => d.itemName === 'CD10%');
  ok(cd !== undefined && cd.lines === 2, 'both CD10% lines are tallied under one name');
  ok(cd?.percents.some(p => p.pct === 10),
    '🔴 INVOICE A: $120 off $1,200 of other lines is 10%. NOT 12000% — the derived rate is a RATIO');
  ok(cd?.percents.some(p => p.pct === 7.5),
    '🔴 INVOICE B: $90 off the same $1,200 is 7.5% — the discount covered the trees and not the ' +
    'placement, and the derived rate reads low BECAUSE it did. That is the tree-only case, visible ' +
    'for real instead of inferred from a Qty that never held a base');
  ok(cd?.withBase === 2 && cd?.baseTotal === 2400,
    'both bases are the $1,200 of other charged lines — DOLLARS, where this field used to hold a count of Qty values');
  ok(cd?.examples[0].base === 1200 && cd?.examples[0].amount === -120 && cd?.examples[0].derivedPct === 10,
    'and the working travels with the row so the arithmetic is checkable');

  // 🔴 THE SUBTOTAL LINE MUST NOT DOUBLE THE BASE. Invoice A has one; the base is still 1200.
  ok(cd?.examples[0].base === 1200,
    "🔴 Intuit's SubTotalLineDetail carries the running total; counting it as a charge would double " +
    'invoice A to $2,400 and halve the derived rate to 5%');

  // Money in cents — the float comparison that would report a mismatch on an invoice that agrees.
  const pennies = summariseInvoices(parseInvoiceList(body([
    invoice({ id: 'C', lines: [sale('Oak', '19', 1, 450.10), sale('Elm', '21', 1, 225.05), discount('CD15%', '91', 1, -101.27)] }),
  ])).invoices);
  ok(pennies.discounts.byName[0].examples[0].base === 675.15,
    '🔴 the base is summed in CENTS: 450.10 + 225.05 is 675.1500000000001 in floating point, and a ' +
    'dollar sum would put float dust into a number rendered as money');

  const noBase = summariseInvoices(parseInvoiceList(body([
    invoice({ id: 'D', lines: [discount('MD10', '92', null, -40)] }),
  ])).invoices);
  ok(noBase.discounts.byName[0].withBase === 0 && noBase.discounts.byName[0].percents.length === 0,
    'a discount on an invoice with nothing else on it yields NO rate — never a division by zero, never 0%');
  ok(noBase.discounts.byName[0].examples[0].base === null, 'and the example says so rather than showing 0');

  // A $0 discount line is COUNTED and yields no rate — a giveaway is not a discount.
  const zero = summariseInvoices(parseInvoiceList(body([
    invoice({ id: 'E', lines: [sale('Oak', '19', 1, 500), discount('MD10', '92', 1, 0)] }),
  ])).invoices);
  ok(zero.discounts.byName[0].zeroAmountLines === 1 && zero.discounts.byName[0].percents.length === 0,
    'a $0 discount line is counted but rated at nothing — counting it as 0% would drag a clean rate into disagreement');
}

// ══ §F2 🔴 THE NATIVE DISCOUNT LINE — WHERE THESE BOOKS ACTUALLY DISCOUNT ═══════════════════
{
  // MEASURED on LAWNS: 67 native lines against 21 item lines. They have no `ItemRef`, so the old
  // code saw them only as an unnamed count — and CD10%/CD15%, which exist ONLY here, were invisible.
  const s = summariseInvoices(parseInvoiceList(body([
    invoice({ id: 'A', date: '2025-01-11', customer: { value: 'c1', name: 'A' },
      lines: [sale('Oak', '19', 1, 1000), nativeDiscount(100, 10)] }),
    invoice({ id: 'B', date: '2026-08-15', customer: { value: 'c2', name: 'B' },
      lines: [sale('Oak', '19', 1, 2000), nativeDiscount(200, 10)] }),
    invoice({ id: 'C', date: '2026-02-06', customer: { value: 'c3', name: 'C' },
      lines: [sale('Oak', '19', 1, 4000), nativeDiscount(600, 15)] }),
    invoice({ id: 'D', date: '2026-04-25', customer: { value: 'c4', name: 'D' },
      lines: [sale('Oak', '19', 1, 500), nativeDiscount(250, null)] }),
  ])).invoices);

  const ten = s.discounts.byRate.find(r => r.pct === 10);
  ok(ten?.lines === 2 && ten?.amountTotal === 300, '🔴 the rate is READ, not derived — 10% twice, $300');
  ok(ten?.customers === 2 && ten?.first === '2025-01-11' && ten?.last === '2026-08-15',
    'with the customers it reached and the span it covers');
  ok(s.discounts.byRate[0].pct === 15,
    '🔴 ordered by MONEY — $600 at 15% leads $300 at 10%. On the real books the rarest rate is the biggest');
  ok(s.discounts.fixedDollar.lines === 1 && s.discounts.fixedDollar.amountTotal === 250,
    '🔴 a fixed-dollar discount is reported as MONEY and never converted — the line does not say what it was a percentage of');
  ok(!s.discounts.byRate.some(r => r.pct === 0), 'and it is not smuggled in as a 0% rate');
  ok(s.discounts.byName.length === 0, 'a native line carries no name, so it enters no named tally');
  ok(!s.discounts.unnamedDiscountLines.some(u => /DiscountLineDetail/.test(u.itemName)),
    '🔴 and it is no longer dumped into `unnamedDiscountLines` as a bare count — 67 of LAWNS\'s 88 ' +
    'discount lines used to land there, unread');

  // A native amount is POSITIVE on real books, so it was being ADDED to the derivation base.
  const infl = summariseInvoices(parseInvoiceList(body([
    invoice({ id: 'E', lines: [sale('Oak', '19', 1, 1000), nativeDiscount(100, 10), discount('FD10', '93', 1, -100)] }),
  ])).invoices);
  ok(infl.discounts.byName[0].percents[0].pct === 10,
    '🔴 a POSITIVE native amount does not inflate the base — $100 off $1,000 is 10%, not 9.09%');
}

// ══ §F3 THE NAMED LIST CANNOT SILENTLY UNDER-COVER ═════════════════════════════════════════
{
  // 🔴 THE NAMED LIST CANNOT SILENTLY UNDER-COVER.
  const unnamed = summariseInvoices(parseInvoiceList(body([
    invoice({ id: 'E', lines: [
      sale('Oak', '19', 1, 400),
      { Amount: -25, DetailType: 'SalesItemLineDetail', SalesItemLineDetail: { ItemRef: { value: '93', name: 'Senior Discount' }, Qty: 250 } },
      { Amount: -10, DetailType: 'DiscountLineDetail', DiscountLineDetail: { PercentBased: false } },
    ] }),
  ])).invoices);
  ok(unnamed.discounts.unnamedDiscountLines.length === 1,
    '🔴 A DISCOUNT-SHAPED LINE THAT IS NOT ON DAVID\'S LIST IS REPORTED AS ITS OWN ROW. The seven names are a hand-kept list, and a hand-kept list that cannot report its own under-coverage is the R-19 defect');
  ok(unnamed.discounts.unnamedDiscountLines.some(u => u.itemName === 'Senior Discount'),
    'caught by name and by its negative amount');
  // ✏️ 2026-09-07 — a native `DiscountLineDetail` is no longer an "unnamed" line. It is READ now:
  // percent-based ones land in `byRate`, and this one, which states no percent, lands in
  // `fixedDollar`. It used to be a bare count in the unnamed list, which is where all 67 of
  // LAWNS's real discounts were sitting.
  ok(unnamed.discounts.fixedDollar.lines === 1 && unnamed.discounts.fixedDollar.amountTotal === 10,
    '🔴 the native line is READ as a fixed-dollar discount rather than counted as an unnamed one');
  ok(!unnamed.topItemsByQty.some(i => i.itemName === 'Senior Discount'),
    '🔴 and it is kept OUT of "what sold" — a negative line in the sales tally silently reduces a quantity');
  ok(unnamed.topItemsByQty.length === 1 && unnamed.totalQtySold === 1, 'only the oak sold');

  ok(DISCOUNT_ITEM_NAMES.length === 7, 'the seven discount names David gave are all present');
  const lower2 = summariseInvoices(parseInvoiceList(body([
    invoice({ id: 'F', lines: [sale('Oak', '19', 1, 400), discount('military discount', '94', 400, -20)] }),
  ])).invoices);
  ok(lower2.discounts.byName.length === 1 && lower2.discounts.unnamedDiscountLines.length === 0,
    'discount names match case-insensitively — "military discount" is the same item as "Military Discount"');
}

// ══ §G 🔴 NOTHING PERSONAL SURVIVES THE PARSE (R-24 clauses b and c) ════════
{
  const NAME = 'Regina Thornbury';
  const ADDR = '400 Honeycomb Mesa';
  const raw = body([
    invoice({ id: '1', date: '2025-08-23', customer: { value: '58', name: NAME }, lines: [
      sale('Shumard Oak', '19', 2, 900),
      note(`Deliver to ${NAME} at ${ADDR}`),
    ] }),
  ]);
  ok(raw.includes(NAME) && raw.includes(ADDR), 'the fixture really does carry a name and an address (otherwise this section proves nothing)');

  const parsed = parseInvoiceList(raw);
  const serialisedParse = JSON.stringify(parsed);
  ok(!serialisedParse.includes(NAME),
    '🔴 THE CUSTOMER NAME IS NOWHERE IN THE PARSED OUTPUT. `QboInvoiceRow` has a customerId and NO name field, so there is no path by which a person\'s name reaches the summary, the screen or a log line — even if a future caller tries');
  ok(!serialisedParse.includes(ADDR) && !serialisedParse.includes('Deliver to'),
    '🔴 AND THE FREE-TEXT DESCRIPTION IS NOT CARRIED EITHER — a line note on a real invoice routinely holds a name, an address, or a remark about someone\'s property');
  ok(parsed.invoices[0].customerId === '58', 'the ID is carried, because counting distinct buyers needs it and an ID is not a person');

  const serialisedSummary = JSON.stringify(summariseInvoices(parsed.invoices));
  ok(!serialisedSummary.includes(NAME) && !serialisedSummary.includes(ADDR),
    '🔴 and the SUMMARY — the thing that actually reaches the screen and the trace line — carries neither');
  ok(serialisedSummary.includes('Shumard Oak'),
    'while an ITEM name IS carried: a product is not a person, and the item names are the whole point of the read');

  const s = summariseInvoices(parsed.invoices);
  ok(s.distinctCustomers === 1, 'distinct buyers are counted from the ids');

  const multi = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', customer: { value: '58', name: 'A' } }),
    invoice({ id: '2', customer: { value: '58', name: 'A' } }),
    invoice({ id: '3', customer: { value: '77', name: 'B' } }),
    invoice({ id: '4', customer: null }),
  ])).invoices);
  ok(multi.distinctCustomers === 2, 'two distinct customers across four invoices');
  ok(multi.invoicesWithoutCustomer === 1,
    'and an invoice with no CustomerRef is COUNTED as having none rather than quietly joining a bucket');
}

// ══ §H MONEY AND TOTALS ═════════════════════════════════════════════════════
{
  const s = summariseInvoices(parseInvoiceList(body([
    invoice({ id: '1', total: 920.13 }), invoice({ id: '2', total: 1500 }), invoice({ id: '3' }),
  ])).invoices);
  ok(Math.round(s.amountTotal * 100) === 242013, 'invoice totals add up');
  ok(s.invoices === 3, 'and an invoice with no TotalAmt is still an invoice — it contributes nothing to the money and is not dropped');
}

console.log(`\ninvoiceList: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
