/**
 * ── invoiceOrderLines — what each construct on a QuickBooks invoice IS ──────────────────
 *
 * 🔴 §C IS THE SECTION THIS FILE EXISTS FOR. The tempting rule is "$0 means it is a note", and
 * it is WRONG on this customer's real books: invoice #3648.563 is a $0.00 invoice with a real
 * ship date carrying TWO REAL TREES — warranty replacements the customer already paid for once.
 * A $0-means-note rule drops both, the 21 September day sheet reads empty, and a crew arrives
 * with an empty trailer. Every probe in §C is derived from that invoice's actual shape.
 *
 * 🔴 §D IS THE DOUBLING TEST. Intuit emits exactly ONE SubTotalLineDetail per invoice carrying
 * the invoice's own subtotal as its Amount (1,469 of 1,469 in the 2026-08-29 raw capture).
 * Counting it as a line doubles the order.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/invoiceOrderLines.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseInvoiceOrderLines, invoiceLineRole, buildInvoiceOrderContent,
  QBO_SUBTOTAL_DETAIL_TYPE,
} from './invoiceOrderLines';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── fixtures shaped exactly like Intuit's real bodies ────────────────────────
const sales = (name: string, desc: string, qty: number | null, unit: number | null, amt: number) => ({
  Id: '1', DetailType: 'SalesItemLineDetail', Amount: amt, Description: desc,
  SalesItemLineDetail: { ItemRef: { value: '99', name }, ...(qty !== null ? { Qty: qty } : {}), ...(unit !== null ? { UnitPrice: unit } : {}) },
});
const note = (desc: string, amount?: number) => ({
  Id: '2', DetailType: 'DescriptionOnly', Description: desc, ...(amount !== undefined ? { Amount: amount } : {}),
});
const subtotal = (amt: number) => ({ Id: '3', DetailType: QBO_SUBTOTAL_DETAIL_TYPE, Amount: amt, SubTotalLineDetail: {} });
const discount = (amt: number) => ({
  Id: '4', DetailType: 'DiscountLineDetail', Amount: amt, Description: 'CD10%',
  DiscountLineDetail: { PercentBased: true, DiscountPercent: 10 },
});

const src = (lines: any[]) => parseInvoiceOrderLines({ Line: lines });

// ══ §A THE PARSE ═══════════════════════════════════════════════════════════
{
  const [l] = src([sales('Oak:MO95', 'Monterrey Oak - 95 gallon', 1, 2125, 2125)]);
  ok(l.itemName === 'Oak:MO95', 'A1 the fully-qualified item name is kept — sub-item structure intact');
  ok(l.itemId === '99',        'A2 the Intuit item Id is read from inside the detail block');
  ok(l.description === 'Monterrey Oak - 95 gallon', 'A3 the description survives — it is the whole point of a day sheet');
  ok(l.qty === 1 && l.unitPrice === 2125 && l.amount === 2125, 'A4 qty, unit price and amount all read');

  // The detail block is read BY ITS OWN KEY, so a construct this file has never seen still
  // yields its item instead of arriving as "no item".
  const [g] = src([{ Id: '9', DetailType: 'GroupLineDetail', Amount: 10, GroupLineDetail: { ItemRef: { value: '7', name: 'Bundle' }, Qty: 2 } }]);
  ok(g.itemName === 'Bundle' && g.qty === 2, 'A5 an unfamiliar DetailType is read by its own key, not by guessing SalesItemLineDetail');

  ok(src([]).length === 0, 'A6 an invoice with no lines yields no lines');
  ok(parseInvoiceOrderLines(null).length === 0, 'A6b a missing invoice yields no lines, never a throw');
  ok(parseInvoiceOrderLines({ Line: 'nope' } as any).length === 0, 'A6c a non-array Line yields no lines');

  const [blank] = src([{ Id: '1', DetailType: 'SalesItemLineDetail', Amount: 5, Description: '   ', SalesItemLineDetail: {} }]);
  ok(blank.description === null && blank.itemName === null, 'A7 a whitespace-only description is null, not a blank string that renders as a load');
}

// ══ §B THE ROLES ═══════════════════════════════════════════════════════════
{
  const r = (l: any) => invoiceLineRole(src([l])[0]);
  ok(r(sales('Oak:MO95', 'Oak', 1, 100, 100)) === 'goods',          'B1 a sold item is goods');
  ok(r(note('1st Stop')) === 'note',                                 'B2 a DescriptionOnly line is a note');
  ok(r(subtotal(4493.5)) === 'running-total',                        'B3 SubTotalLineDetail is the running total');
  ok(r(discount(-120)) === 'discount',                               'B4 Intuit\'s own discount construct is a discount');
  ok(r({ Id: '5', DetailType: 'SalesItemLineDetail', Amount: -50, SalesItemLineDetail: {} }) === 'discount',
     'B5 ANY negative amount is a discount, whatever construct carries it');
  ok(r(sales('TC', 'Trip Charge', 1, 150, 150)) === 'goods',
     'B6 a trip charge is a LINE — it carries money and the subtotal depends on it (what a DAY SHEET shows is a separate question)');
}

// ══ §C 🔴 A $0 LINE IS NOT AUTOMATICALLY A NOTE — INVOICE #3648.563 ════════
{
  // The real thing: total $0.00, real ship date 2026-09-21, two warranty replacements.
  const real = src([
    sales('BPJ30REP', 'Blue Point Juniper (Replacement)', 1, 0, 0),
    sales('Cypress:AZBI45', 'Arizona Cypress Blue Ice (Replacement)', 1, 0, 0),
    subtotal(0),
  ]);
  ok(invoiceLineRole(real[0]) === 'goods' && invoiceLineRole(real[1]) === 'goods',
     'C1 🔴 a $0 SalesItemLineDetail is GOODS — these are two real trees on a real truck');

  const content = buildInvoiceOrderContent({ lines: real, totalTax: 0, totalAmt: 0 });
  ok(content.lines.length === 2, 'C2 🔴 BOTH replacement trees reach the order — a $0-means-note rule would have sent an empty trailer');
  ok(content.lines.every(l => l.quantity === 1), 'C3 each carries a real quantity');
  ok(content.subtotal === 0 && content.tax === 0, 'C4 a $0 invoice is $0 — not a refusal, not a fabricated figure');

  // The negative control: a $0 line that IS a note, on the same invoice shape.
  const mixed = buildInvoiceOrderContent({
    lines: src([sales('BPJ30REP', 'Replacement', 1, 0, 0), note('*Will Pay Other Half Before Planting*'), subtotal(0)]),
    totalTax: 0, totalAmt: 0,
  });
  ok(mixed.lines.length === 1 && mixed.notes.length === 1,
     'C5 the negative control — a $0 GOODS line and a $0 NOTE on one invoice separate correctly, so C2 is not passing by accident');
  ok(mixed.notes[0] === '*Will Pay Other Half Before Planting*', 'C6 the note text is kept — it is something a person wrote');

  // 🔴 THE MONEY GUARD. Zero of these exist in 1,469 invoices; Intuit permits them anyway.
  const moneyNote = buildInvoiceOrderContent({ lines: src([note('Deposit applied', 500), subtotal(500)]), totalTax: 0, totalAmt: 500 });
  ok(moneyNote.lines.length === 1 && moneyNote.notes.length === 0,
     'C7 🔴 a DescriptionOnly line CARRYING MONEY is kept as a line — dropping money is the failure nobody notices');
  ok(moneyNote.counts.notesKeptForMoney === 1, 'C8 and it is COUNTED, so the run can say it happened rather than hide it');
}

// ══ §D 🔴 THE RUNNING TOTAL IS NEVER A LINE ════════════════════════════════
{
  // #3648.632's real shape, reduced: lines sum to 4493.50 and the subtotal line says the same.
  const c = buildInvoiceOrderContent({
    lines: src([
      sales('Oak:MO95', 'Monterrey Oak - 95 gallon', 1, 2125, 2125),
      sales('Yucca:RY3', 'Red Yucca - 3 Gallon', 6, 20, 120),
      sales('TC', 'Trip Charge', 1, 150, 150),
      subtotal(2395),
    ]),
    totalTax: 197.59, totalAmt: 2592.59,
  });
  ok(c.lines.length === 3, 'D1 🔴 three lines, not four — the running total did not become a line');
  ok(c.subtotal === 2395, 'D2 the subtotal comes from the invoice\'s own running-total line');
  ok(c.subtotalSource === 'running-total-line', 'D3 and it SAYS where it came from');
  ok(c.lines.reduce((a, l) => a + l.subtotal, 0) === 2395,
     'D4 🔴 the lines add to the subtotal — counting the running total would have made it 4790, doubling the order');
  ok(c.counts.runningTotal === 1 && c.counts.goods === 3, 'D5 the counts report what was seen');

  // No running-total line at all → summed, and it says so rather than reporting a false source.
  const summed = buildInvoiceOrderContent({ lines: src([sales('A', 'a', 1, 10, 10), sales('B', 'b', 1, 5, 5)]), totalTax: null, totalAmt: 16.24 });
  ok(summed.subtotal === 15 && summed.subtotalSource === 'sum-of-lines', 'D6 with no running-total line the subtotal is summed and labelled');
  ok(summed.tax === 1.24 && summed.taxSource === 'derived', 'D7 tax with no TxnTaxDetail is DERIVED as total − subtotal and labelled derived, never a fabricated 0.00');

  // A second running-total line is IGNORED, not summed — summing would double the subtotal.
  const twice = buildInvoiceOrderContent({ lines: src([sales('A', 'a', 1, 10, 10), subtotal(10), subtotal(10)]), totalTax: 0, totalAmt: 10 });
  ok(twice.subtotal === 10 && twice.counts.runningTotal === 2,
     'D8 a second running total is ignored rather than added — and the count still reports both were seen');
}

// ══ §E MONEY FROM THE DOCUMENT ═════════════════════════════════════════════
{
  // #3648.632 verbatim: 4493.50 + 370.71 = 4864.21.
  const c = buildInvoiceOrderContent({ lines: src([sales('X', 'x', 1, 4493.5, 4493.5), subtotal(4493.5)]), totalTax: 370.71, totalAmt: 4864.21 });
  ok(c.tax === 370.71 && c.taxSource === 'document', 'E1 TxnTaxDetail.TotalTax is READ, not derived — a real field beats arithmetic');
  ok(Math.abs(c.subtotal + c.tax - 4864.21) < 0.005, 'E2 and the three numbers reconcile to the invoice total');

  // A flat fee with no Qty and no UnitPrice — LAWNS's "Late fee" line, verbatim.
  const fee = buildInvoiceOrderContent({ lines: src([{ Id: '1', DetailType: 'SalesItemLineDetail', Amount: 0, Description: 'Flat fee - Applied on Aug 28, 2026', SalesItemLineDetail: { ItemRef: { value: '5', name: 'Late fee' } } }]), totalTax: 0, totalAmt: 0 });
  ok(fee.lines[0].quantity === 1, 'E3 a line with no Qty floors at 1 — order_items.quantity is NOT NULL');
  ok(fee.lines[0].sku === 'Late fee', 'E4 and it keeps the item name it had');

  // A line with a quantity and an amount but no stated unit price.
  const derivedUnit = buildInvoiceOrderContent({ lines: src([{ Id: '1', DetailType: 'SalesItemLineDetail', Amount: 300, Description: 'd', SalesItemLineDetail: { ItemRef: { value: '5', name: 'X' }, Qty: 4 } }]), totalTax: 0, totalAmt: 300 });
  ok(derivedUnit.lines[0].unitPrice === 75,
     'E5 an absent UnitPrice is DIVIDED out of the amount — storing $0.00 beside a real $300 line would be a fabricated figure on a money field (D-9)');
  ok(derivedUnit.lines[0].subtotal === 300, 'E5b and the stored line total is always the document\'s own Amount, so nothing can drift from it');
}

// ══ §F 🔴 NO LINE EVER CARRIES A LOT ID ════════════════════════════════════
{
  const c = buildInvoiceOrderContent({
    lines: src([sales('Oak:MO95', 'Oak', 1, 100, 100), discount(-10), note('n'), subtotal(90)]),
    totalTax: 0, totalAmt: 90,
  });
  ok(c.lines.length === 2, 'F1 goods and discount are both lines; the note and the running total are not');
  ok(c.lines.every(l => l.businessInventoryId === null),
     'F2 🔴 every line carries a NULL lot id — R-21, and the only thing standing between a history order and available-to-sell');
  // Both directions: the type says null, and so does the runtime value, on every construct.
  ok(c.lines.filter(l => l.businessInventoryId !== null).length === 0,
     'F3 asserted from the other side too — zero lines carry one');
  ok(c.counts.discount === 1 && c.counts.note === 1 && c.counts.goods === 1,
     'F4 the counts distinguish all three, so a run can report what it did with each kind');
}

// ══ §G SOURCE PROBES — the claims in the header must stay true ═════════════
{
  const src2 = readFileSync(join(process.cwd(), 'packages/shared/src/quickbooks/invoiceOrderLines.ts'), 'utf8');
  ok(/from '\.\/invoiceLineShapes'/.test(src2),
     'G1 the Intuit vocabulary is IMPORTED, never re-spelled — two spellings of one string is STD-011');
  // ⚠️ WRITTEN WRONG THE FIRST TIME AND THE TEST CAUGHT ITS OWN AUTHOR. The first form was
  // `businessInventoryId:\s*(?!null)`, which passes trivially: `\s*` backtracks to the empty
  // string, and the lookahead then examines a SPACE rather than the word. It reported a failure
  // on correct code. The lookahead must own the whitespace.
  ok(!/businessInventoryId:(?!\s*null)/.test(src2),
     'G2 no assignment of anything but null to businessInventoryId survives in this file');
  // The negative control — the probe must be able to FAIL, or it is R-33's un-failable check.
  ok(/businessInventoryId:(?!\s*null)/.test('  businessInventoryId: lotId,'),
     'G2b and the probe DOES fire on a real violation — proven, not assumed');
  // The classifier's order is the safety argument, so assert the running total is tested FIRST.
  const body = src2.slice(src2.indexOf('export function invoiceLineRole'));
  ok(body.indexOf('QBO_SUBTOTAL_DETAIL_TYPE') < body.indexOf('QBO_DETAIL_TYPE.description'),
     'G3 the running total is recognised BEFORE anything else — it can never be mistaken for a line');
}

console.log(`\n  invoiceOrderLines — ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:'); failures.forEach(f => console.error('  ✗ ' + f)); process.exit(1); }
