/**
 * ── catalogueCensus — the 33 that are 15, and the shelf two rows share ────────────────────
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST. One thing, and it is not arithmetic: whether the DENOMINATOR can
 * silently go back to containing rows nobody can fix. A discount has no size. If it is counted,
 * the number never reaches zero, the owner concludes the tool is broken, and the one measurement
 * that proves this product does something — *33 last month, 13 today* — becomes impossible to make.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/catalogueCensus.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { censusSizeReadability, censusCollisions } from './catalogueCensus';
import type { QboItemRow } from './itemList';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

const STOCK = 'Sales of Nursery Stock';
const item = (id: string, name: string, o: Partial<QboItemRow> = {}): QboItemRow => ({
  id, name, type: 'NonInventory', incomeAccount: STOCK, active: true,
  unitPrice: 100, purchaseCost: null, sku: null, description: null, fullyQualifiedName: null, ...o,
});

// ══ §A 🔴 THE DENOMINATOR ONLY CONTAINS ROWS A SIZE CAN BE FIXED ON ════════════════════════
{
  const rows = [
    // products. `45 Grade` is the real shape of an unreadable size: something size-SHAPED sitting
    // where a size sits, which `parseUnitOfMeasure` refuses — the state that makes `unreadSizeText`
    // actionable rather than merely honest.
    item('p1', 'AP47', { description: 'Afgan Black Pine, 45 Grade' }),       // could not read
    item('p2', 'AP46', { description: 'Afgan Black Pine, 45 Gallon' }),      // sized
    item('p3', 'DF',   { description: 'Deer Fencing' }),                     // states no size
    // NOT products — every one of them on the owner's own income-account axis (R-112). Each
    // carries something UNREADABLE in the size position, because a row with a readable size would
    // prove nothing about the split: the whole question is which unreadable rows are counted.
    item('s1', 'TC',     { type: 'Service', incomeAccount: 'Delivery Income',  description: 'Trip Charge, 2 Grade' }),
    item('d1', 'CD10%',  { type: 'Service', incomeAccount: 'Discounts given',  description: 'Contractor Discount, 10%', unitPrice: -0.1 }),
    item('n1', 'Refund', { type: 'Service', incomeAccount: 'Refund',           description: 'Overpayment Refund, 3 Grade', unitPrice: 0 }),
    item('f1', 'Oak',    { type: 'Category', description: 'Oak folder, 9 Grade' }),
  ];
  const c = censusSizeReadability(rows);
  ok(c.products === 3,
    '🔴 THE PRODUCT POPULATION IS THREE. The trip charge, the discount, the refund and the folder are not rows a size can be fixed on');
  ok(c.productsUnreadable === 1, 'and exactly one of them carries something in the size position we could not read');
  ok(c.productsSized === 1 && c.productsNotStated === 1,
    'a size we READ and a product that STATES no size are different states and are counted separately — "Deer Fencing" has no size and that is correct');
  ok(c.notApplicableTotal === c.unreadableAcrossEverything - c.productsUnreadable,
    '🔴 THE TWO FIGURES RECONCILE BY CONSTRUCTION. Whatever the split is, the not-applicable rows plus the product rows equal the old undifferentiated total — so nobody has to wonder where the difference went');
  ok(c.unreadableAcrossEverything > c.productsUnreadable,
    'and the undifferentiated total is genuinely larger, which is the whole reason the split exists');
  ok(c.notApplicable.discount >= 1 && c.notApplicable.service >= 1 && c.notApplicable['not-a-sale'] >= 1,
    'each non-product kind is named separately rather than lumped into "other" — an owner told "18 rows are not applicable" wants to know which');

  // 🔴 A FOLDER IS IN NEITHER TOTAL. `adaptQboItems` never adapts one, so it has no size state at
  // all — reading `undefined` as unreadable would count the filing cabinet.
  ok(c.notApplicable.folder === 0,
    'a Category folder contributes to neither figure — it is not a thing anybody sells and not a row a size belongs on');
}

// ══ §B 🔴 A CATALOGUE OF NOTHING BUT DISCOUNTS HAS NO PRODUCTS TO REPORT ═══════════════════
//
// The failure this guards is the one that reads as success: a split that "works" by putting
// everything into the product bucket when the classifier cannot decide.
{
  const c = censusSizeReadability([
    item('d1', 'CD10%', { type: 'Service', incomeAccount: 'Discounts given', description: 'Contractor Discount, 10%', unitPrice: -0.1 }),
    item('d2', 'MD10',  { type: 'Service', incomeAccount: 'Discounts given', description: 'Military Discount, -10%',  unitPrice: -0.1 }),
  ]);
  ok(c.products === 0,
    'a list of nothing but discounts has NO products — and the rule reading this reports itself not-measured rather than "0 of 0 products are unreadable", which would certify a catalogue nobody looked at');
}

// ══ §C 🔴 TWO ROWS ON ONE SHELF — THE PARSED SIZE, NOT THE SIZE TEXT ═══════════════════════
{
  const rows = [
    item('1', 'Lacey Oak 45G',       { unitPrice: 375,  description: 'Lacey Oak, 45 Gallon' }),
    item('2', 'Lacey Oak 45',        { unitPrice: 1250, description: 'Lacey Oak, 45 gallon' }),
    item('3', 'Skyward Holly 30',    { unitPrice: 60,   description: 'Skyward Holly, 30 Gallon' }),
    item('4', 'Skyward Holly 30gal', { unitPrice: 65,   description: 'Skyward Holly, 30 gal' }),
    item('5', 'Cedar Elm 15',        { unitPrice: 200,  description: 'Cedar Elm, 15 Gallon' }),
  ];
  const c = censusCollisions(rows);
  ok(c.groups === 2 && c.rowsInvolved === 4,
    '🔴 `45G` AND `45 gallon` ARE ONE SHELF, AND SO ARE `30 Gallon` AND `30 gal`. A key over the raw size text finds neither — and those are exactly the pairs with a spelling difference AND a price gap, which is the combination that costs money');
  ok(c.groupsWithPriceDifference === 2, 'both disagree about price, which is the sharp case');
  ok(c.worstGap === 875,
    'and the widest gap is the sort key — $875 between $375 and $1,250 is a reason to look, "two duplicates" is not');
  ok((c.worstReason ?? '').length > 0, 'with a sentence that names the product and both prices');
  ok(c.sellable === 5, 'the denominator is the rows an invoice line can point at');

  const clean = censusCollisions([item('1', 'Lacey Oak 45G', { description: 'Lacey Oak, 45 Gallon' })]);
  ok(clean.groups === 0 && clean.rowsInvolved === 0 && clean.worstGap === 0 && clean.worstReason === null,
    'a catalogue with no collisions reports none, with no fabricated worst case — the detector can find nothing, which is what makes a finding mean something');
}

// ══ §D NEGATIVE CONTROL ════════════════════════════════════════════════════════════════════
{
  ok(censusSizeReadability([]).products === 0 && censusCollisions([]).sellable === 0,
    'an empty catalogue produces an empty census rather than throwing');
}

console.log(`\n  catalogueCensus — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
