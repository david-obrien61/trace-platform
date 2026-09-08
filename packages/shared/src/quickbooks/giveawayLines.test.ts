/**
 * ── giveawayLines — what they give away, and the four ways they write it down ─────────────
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST. Three ways this census can produce a number that reads as an
 * answer and is not one:
 *   §A  the population widens to include notes and subtotals, inflating a count nobody decided
 *   §B  the shapes collapse, so "recorded three ways" — the whole finding — becomes "recorded"
 *   §C  a RETAIL total escapes as though it were a cost, overstating by the entire markup
 * The third one has already happened once in this product's history, and Lauren caught it.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/giveawayLines.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { censusGiveawayLines, GIVEAWAY_SHAPES } from './giveawayLines';
import type { QboItemRow } from './itemList';
import type { QboInvoiceRow, QboInvoiceLine } from './invoiceList';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const item = (id: string, name: string, o: Partial<QboItemRow> = {}): QboItemRow => ({
  id, name, type: 'Inventory', incomeAccount: 'Sales of Nursery Stock', active: true,
  unitPrice: null, purchaseCost: null, sku: null, description: null, fullyQualifiedName: null, ...o,
});
const line = (o: Partial<QboInvoiceLine> = {}): QboInvoiceLine => ({
  detailType: 'SalesItemLineDetail', itemId: null, itemName: null, qty: 1, amount: 0, unitPrice: 0,
  discountInDescription: false, percentBased: null, discountPercent: null,
  installInDescription: false, itemAccountName: null, sizeFromDescription: null,
  replacementInDescription: false, ...o,
});
const inv = (id: string, lines: QboInvoiceLine[], txnDate = '2026-01-01'): QboInvoiceRow =>
  ({ id, docNumber: id, txnDate, totalAmt: 0, balance: 0, dueDate: null, customerId: 'c1', lines });

// ══ §A 🔴 THE POPULATION IS $0 GOODS LINES — NOT EVERY $0 LINE ═════════════════════════════
{
  const items = [item('t', 'Tree', { unitPrice: 500, purchaseCost: 150 })];
  const invoices = [inv('i1', [
    line({ itemId: 't', itemName: 'Tree', amount: 0 }),                                  // a giveaway
    line({ detailType: 'DescriptionOnly', itemId: null, amount: 0, unitPrice: null }),   // a NOTE
    line({ detailType: 'SubTotalLineDetail', itemId: null, amount: 0, unitPrice: null }),// a subtotal
    line({ itemId: 't', itemName: 'Tree', amount: 500, unitPrice: 500 }),                // a sale
  ])];
  const c = censusGiveawayLines(invoices, items);
  ok(c.lines === 1,
    '🔴 A NOTE AND A SUBTOTAL ARE $0 AND ARE NOT GIVEAWAYS. Counting them would inflate the finding with lines nobody decided anything about — the same filter `pricedLines` applies from the other direction');
  ok(c.invoices === 1 && c.distinctItems === 1, 'and it counts the invoices and items behind them');

  // A NULL amount is not a zero amount.
  const unread = censusGiveawayLines([inv('i2', [line({ itemId: 't', itemName: 'Tree', amount: null })])], items);
  ok(unread.lines === 0,
    '🔴 A LINE WHOSE AMOUNT WE COULD NOT READ IS NOT A LINE THAT WAS FREE. Asserting somebody gave something away is a claim, and an unreadable field is not evidence for it (D-9 / A9)');
}

// ══ §B 🔴 THE NUMBER OF WAYS IS THE FINDING ════════════════════════════════════════════════
//
// One way of recording a giveaway is a policy. Three ways is why no report anybody runs can total
// them — and 26 of LAWNS's 49 are the third kind, invisible to anything that reads the item.
{
  const items = [
    item('w', 'WARRANTY'),
    item('t', 'Lacey Oak 45', { unitPrice: 1250, purchaseCost: 400 }),
    item('c', 'BPJ30REP',     { unitPrice: 900,  purchaseCost: 300 }),
    item('r', 'Tree Replacement'),
  ];
  const invoices = [inv('i1', [
    line({ itemId: 'w', itemName: 'WARRANTY' }),                                     // item names it
    line({ itemId: 'r', itemName: 'Tree Replacement' }),                             // item names it
    line({ itemId: 't', itemName: 'Lacey Oak 45', replacementInDescription: true }),  // wording only
    line({ itemId: 'c', itemName: 'BPJ30REP' }),                                     // nothing names it
    // 🔴 BOTH SIGNALS AT ONCE, AND THIS ROW IS THE ONLY THING THAT ASSERTS THE ORDER OF THE TWO
    // CHECKS. Without it, swapping "item first" for "wording first" changes nothing on any fixture
    // and the mutant survives — every other row here has exactly one signal, so the order is
    // invisible. The ITEM must win: it is the only shape a report reading the catalogue could ever
    // total, and reclassifying it as wording-only collapses the finding.
    line({ itemId: 'w', itemName: 'WARRANTY', replacementInDescription: true }),
  ])];
  const c = censusGiveawayLines(invoices, items);
  ok(c.byShape['item-names-it'] === 3,
    '🔴 THE ITEM WINS WHEN BOTH THE ITEM AND THE WORDING SAY SO. Three lines are named by their item — including the one whose description ALSO says it — because the item is the only shape a report reading the catalogue could ever total');
  ok(c.byShape['wording-names-it'] === 1,
    '🔴 THE ONE WHERE ONLY THE WORDING SAYS SO — the shape that is invisible to any rule reading the catalogue, and 26 of LAWNS\'s 49');
  ok(c.byShape['nothing-names-it'] === 1,
    '🔴 AND THE ONE NOTHING EXPLAINS IS COUNTED, NEVER DROPPED. A coded item name is where a fourth or fifth way of recording this hides, and reading `…REP` as "replacement" would work on these rows and be a rule nobody agreed to (R-50)');
  ok(c.byShape['item-names-it'] + c.byShape['wording-names-it'] + c.byShape['nothing-names-it'] === c.lines,
    'the three shapes sum to the population — a line is classified exactly once, so nothing can fall between them');
  ok(c.shapesInUse === 3, 'and three of them are actually in use, which is the finding');
  ok(Object.keys(GIVEAWAY_SHAPES).length === 3, 'the vocabulary has one home');
  ok(c.first === '2026-01-01' && c.last === '2026-01-01', 'the period is measured from the rows');

  // the ITEM's own description counts as the item naming it — an item can be coded and described
  const described = censusGiveawayLines(
    [inv('i1', [line({ itemId: 'x', itemName: 'BPJ30REP' })])],
    [item('x', 'BPJ30REP', { description: 'Brodie Juniper 30 Gallon — warranty replacement' })]);
  ok(described.byShape['item-names-it'] === 1,
    'an item whose DESCRIPTION says warranty is named by its item, even when its name is a code');
}

// ══ §C 🔴 AT COST OR NOT AT ALL — THE OVERSTATEMENT LAUREN ALREADY CAUGHT ONCE ═════════════
{
  const full = censusGiveawayLines(
    [inv('i1', [line({ itemId: 't', itemName: 'Tree' }), line({ itemId: 'u', itemName: 'Shrub' })])],
    [item('t', 'Tree',  { unitPrice: 500, purchaseCost: 150 }),
     item('u', 'Shrub', { unitPrice: 200, purchaseCost: 60 })]);
  ok(full.costTotal === 210,
    '🔴 WITH EVERY ITEM CARRYING A COST, THE TOTAL IS THE COST — $210, not the $700 they would have sold for');
  ok(full.retailTotalNotToBeQuoted === 700,
    'the retail figure is CARRIED so the size of the overstatement is visible, and its field name says it may never be quoted');
  ok(full.linesWithoutCost === 0, 'and nothing was uncovered');

  const partial = censusGiveawayLines(
    [inv('i1', [line({ itemId: 't', itemName: 'Tree' }), line({ itemId: 'w', itemName: 'WARRANTY' })])],
    [item('t', 'Tree', { unitPrice: 500, purchaseCost: 150 }), item('w', 'WARRANTY')]);
  ok(partial.costTotal === null,
    '🔴 ONE LINE WITHOUT A RECORDED COST REFUSES THE WHOLE TOTAL. A partial cost total is not a smaller truth — it is a different number wearing the same label, and once it is on the page nobody knows which lines it covers');
  ok(partial.linesWithoutCost === 1,
    'and the reason is reported, so the refusal is actionable rather than merely honest');

  const zeroCost = censusGiveawayLines(
    [inv('i1', [line({ itemId: 't', itemName: 'Tree' })])],
    [item('t', 'Tree', { unitPrice: 500, purchaseCost: 0 })]);
  ok(zeroCost.costTotal === null && zeroCost.linesWithoutCost === 1,
    '🔴 A COST OF ZERO IS "NOT RECORDED", NOT "FREE". An item nobody filled in and an item that genuinely costs nothing are indistinguishable here, and reading the first as the second understates the total — the same error pointing the other way');
}

// ══ §D NEGATIVE CONTROL — a business that gives nothing away ═══════════════════════════════
{
  const c = censusGiveawayLines(
    [inv('i1', [line({ itemId: 't', itemName: 'Tree', amount: 500, unitPrice: 500 })])],
    [item('t', 'Tree', { unitPrice: 500, purchaseCost: 150 })]);
  ok(c.lines === 0 && c.shapesInUse === 0 && c.costTotal === null && c.retailTotalNotToBeQuoted === null,
    'nothing free means nothing counted, no shapes in use, and no money stated — the census can return empty, which is what makes a non-empty one mean something');
  ok(censusGiveawayLines([], []).lines === 0, 'and an empty walk produces an empty census rather than throwing');
}

console.log(`\n  giveawayLines — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
