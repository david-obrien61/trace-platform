/**
 * ── booksFindings — twelve questions about somebody else's books ──────────────────
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST. Not the arithmetic — most of these rules are a Map and a
 * filter. What is under test is whether the SET of findings can lie to a reader, and there are
 * exactly four ways it can:
 *   §C  a rule reports a clean result over a population it never had (a pass over an empty set)
 *   §D  a rule that could not run disappears from the list instead of saying so
 *   §E  the order stops being money → risk → tidiness and becomes worst-first, i.e. an audit
 *   §F  a finding renders without its denominator, so "22" reads as a verdict
 * Every one of those produces a SHORTER, CLEANER, MORE CONFIDENT screen than the truth, which
 * is why none of them would be noticed by looking at it.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/booksFindings.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { evaluateBooks, BOOKS_RULES, FINDING_TIERS } from './booksFindings';
import type { QboInvoiceRow } from './invoiceList';
import type { QboItemRow } from './itemList';
import type { CustomerBreakdown } from './customerList';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const item = (id: string, name: string, o: Partial<QboItemRow> = {}): QboItemRow => ({
  id, name, type: 'Inventory', incomeAccount: 'Sales of Nursery Stock', active: true,
  unitPrice: null, purchaseCost: null, sku: null, ...o,
});
const line = (itemId: string | null, itemName: string | null, unitPrice: number | null, amount: number, qty = 1) =>
  ({ detailType: 'SalesItemLineDetail', itemId, itemName, qty, amount, unitPrice });
const inv = (id: string, docNumber: string | null, lines: ReturnType<typeof line>[]): QboInvoiceRow =>
  ({ id, docNumber, txnDate: '2026-05-01', totalAmt: 100, customerId: 'c1', lines });

const CUSTOMERS: CustomerBreakdown = {
  total: 1927, withEmail: 900, withPhone: 1200, withAddress: 1500, withCompanyName: 300,
  withNoContactAtAll: 110, inactive: 12,
  byEmail: { sharedValues: 30, recordsInvolved: 72, largestCluster: 4 },
  byPhone: { sharedValues: 20, recordsInvolved: 51, largestCluster: 3 },
};

const find = (fs: ReturnType<typeof evaluateBooks>, id: string) => fs.find(f => f.id === id);

// ══ §A THE PRICE-CARD RULE — the one the parser widening exists for ═════════
{
  const items = [item('1', 'Shumard Oak 30 gal', { unitPrice: 500 }),
                 item('2', 'Cedar Elm 15 gal',   { unitPrice: 200 }),
                 item('3', 'Consulting',         { unitPrice: null })];
  const invoices = [
    inv('i1', '1001', [line('1', 'Shumard Oak 30 gal', 450, 450)]),   // below list
    inv('i2', '1002', [line('1', 'Shumard Oak 30 gal', 500, 500)]),   // at list
    inv('i3', '1003', [line('2', 'Cedar Elm 15 gal',   250, 250)]),   // above list
    inv('i4', '1004', [line('3', 'Consulting',         999, 999)]),   // NO published price
  ];
  const f = find(evaluateBooks({ items, invoices }), 'sold-below-price-card');
  ok(f?.measured === true && f.population.matched === 1,
    'one sale below the published price is found');
  ok(f?.population.of === 3,
    '🔴 THE DENOMINATOR EXCLUDES THE UNPRICED ITEM — 3 comparable sales, not 4. An item with no published price has no floor, and counting it would make the percentage meaningless');

  // 🔴 THE FAILURE THAT WOULD EMPTY THIS FINDING SILENTLY.
  const noCard = find(evaluateBooks({ items: [item('1', 'Shumard Oak 30 gal')], invoices: [invoices[0]] }), 'sold-below-price-card');
  ok(noCard?.measured === false,
    '🔴 A CATALOGUE WITH NO PRICES AT ALL REPORTS NOT-MEASURED, NOT "no problems". If a null price were read as a floor of $0.00, every sale on earth is at or above list and this finding reports a clean bill of health over data it never compared');
}

// ══ §B PRICED LINES — what counts as a sale at a price ══════════════════════
{
  const items = [item('1', 'Tree', { unitPrice: 100 })];
  const invoices = [inv('i1', '1', [
    line('1', 'Tree', 90, 90),
    line(null, 'A note about the driveway', null, 0),        // DescriptionOnly
    { detailType: 'DiscountLineDetail', itemId: 'd', itemName: 'CD10%', qty: 900, amount: -90, unitPrice: null },
    { detailType: 'SubTotalLineDetail', itemId: null, itemName: null, qty: null, amount: 90, unitPrice: null },
  ])];
  const f = find(evaluateBooks({ items, invoices }), 'sold-below-price-card');
  ok(f?.population.of === 1,
    '🔴 A NOTE, A DISCOUNT AND A SUBTOTAL ARE NOT SALES AT A PRICE. All three have no unit price; treating them as $0 sales would manufacture three below-list findings out of one invoice');

  const varied = find(evaluateBooks({ invoices }), 'sold-at-more-than-one-price');
  ok(varied?.population.of === 1, 'and the same filter governs the price-variation count');
}

// ══ §C 🔴 A PASS OVER AN EMPTY SET IS A FAILURE ════════════════════════════
{
  const empty = evaluateBooks({ items: [], invoices: [], customers: { ...CUSTOMERS, total: 0, withNoContactAtAll: 0, byEmail: { sharedValues: 0, recordsInvolved: 0, largestCluster: 0 }, byPhone: { sharedValues: 0, recordsInvolved: 0, largestCluster: 0 } } });
  ok(empty.every(f => f.measured === false),
    '🔴 EVERY RULE OVER EMPTY WALKS REPORTS NOT-MEASURED. Not one returns a clean result — a read that found nothing because there was nothing to read must never certify a business');
  ok(empty.every(f => f.notMeasured !== null && f.notMeasured.length > 0),
    'and each says WHY in words, rather than rendering as a blank row');
  ok(empty.every(f => f.sentence === ''),
    'an unmeasured finding carries NO sentence at all — a sentence with a zero in it is the fabricated value D-9 forbids');
}

// ══ §D 🔴 AN UNRUNNABLE RULE STAYS ON THE LIST ═════════════════════════════
{
  const invoicesOnly = evaluateBooks({ invoices: [inv('i1', '1', [line('1', 'Tree', 10, 10)])] });
  ok(invoicesOnly.length === BOOKS_RULES.length,
    '🔴 THE COMPLETE RULE SET COMES BACK EVERY TIME. Filtering the unmeasurable ones out gives a shorter, cleaner list that quietly asserts everything worth checking was checked — and a rule the reader cannot see is a rule the reader assumes passed');

  const priceCard = find(invoicesOnly, 'sold-below-price-card');
  ok(priceCard?.measured === false && /products & services/.test(priceCard.notMeasured ?? ''),
    '🔴 AND IT NAMES THE MISSING WALK IN THE OWNER\'S WORDS (R-24 — three separate reads, and a rule may not pretend one covers another)');
  ok(/have not been read yet|has not been read yet/.test(priceCard?.notMeasured ?? ''),
    'so the reader knows what to DO about it, not merely that something is absent');

  const custRule = find(invoicesOnly, 'customers-with-no-contact');
  ok(custRule?.measured === false && /customer list/.test(custRule.notMeasured ?? ''),
    'a customer rule with no customer walk says so too');

  // 🔴 ADDED AFTER MUTANT M4 SURVIVED. §C proved the EMPTY-POPULATION branch carries no
  // sentence; nothing proved it of the MISSING-WALK branch, and there are three separate
  // branches that can produce an unmeasured finding. A guarantee proven for one input and
  // assumed for the other two is the seam-blindness R-33 is about — the same shape that let a
  // coercion mutant survive on the receipts view because every probe short-circuited earlier.
  ok(invoicesOnly.filter(f => !f.measured).every(f => f.sentence === ''),
    '🔴 NO UNMEASURED FINDING CARRIES A SENTENCE, ON ANY OF THE THREE BRANCHES. "Nothing found." over a walk nobody read is the fabricated value D-9 forbids, and it is the most reassuring sentence on the page');
}

// ══ §E 🔴 THE ORDER IS MONEY → RISK → TIDINESS, NEVER WORST-FIRST ══════════
{
  const items = [item('1', 'Tree', { unitPrice: 100 })];
  const invoices = [
    inv('i1', '1001', [line('1', 'Tree', 90, 90)]),
    inv('i2', '1001', [line('1', 'Tree', 90, 90)]),   // duplicate number — a RISK finding
  ];
  const fs = evaluateBooks({ items, invoices, customers: CUSTOMERS });
  const tiers = fs.map(f => FINDING_TIERS.indexOf(f.tier));
  ok(tiers.every((t, i) => i === 0 || tiers[i - 1] <= t),
    '🔴 TIERS NEVER GO BACKWARDS. Twelve things wrong with her books sorted by how wrong they are reads as an audit; sorted by what they are worth to her it reads as help');

  // The sort must NOT be by size. Prove it with a tidiness finding that dwarfs every money one.
  const big = find(fs, 'sold-at-more-than-one-price');
  const money = fs.filter(f => f.tier === 'money');
  ok(money.length > 0 && fs.indexOf(money[0]) < fs.indexOf(big as never),
    'and a large tidiness finding never outranks a small money one — the sort key is the TIER, not the count');
}

// ══ §F EVERY MEASURED FINDING CARRIES ITS DENOMINATOR AND ITS QUOTE ════════
{
  const items = [item('1', 'Tree', { unitPrice: 100 })];
  const invoices = [inv('i1', '1001', [line('1', 'Tree', 90, 90)]), inv('i2', '1001', [line('1', 'Tree', 90, 90)])];
  const fs = evaluateBooks({ items, invoices, customers: CUSTOMERS });
  const measured = fs.filter(f => f.measured);
  ok(measured.length > 0, 'the fixture measures something — otherwise this section proves nothing');
  ok(measured.every(f => f.population.of > 0 && f.population.noun.length > 0),
    '🔴 EVERY MEASURED FINDING NAMES ITS POPULATION AND WHAT IS IN IT. "22 of 1,469 invoices", never "22"');
  ok(fs.every(f => typeof f.quoted === 'string' && f.quoted.length > 0),
    'and every finding — measured or not — carries the 29 August figure beside it, so the drift is visible rather than the stale number being forgotten');
  ok(BOOKS_RULES.every(r => typeof r.quoted === 'string'),
    '🔴 `quoted` IS A STRING, NOT A NUMBER. It is a QUOTE from a four-day-old analysis and it must never be arithmetically compared with a measurement as though they were the same kind of thing (R-26)');
}

// ══ §G NOTHING HERE CAN BLOCK, AND NOTHING HERE NAMES A PERSON ═════════════
{
  const fs = evaluateBooks({ customers: CUSTOMERS, invoices: [inv('i1', '1', [line('1', 'Tree', 10, 10)])], items: [item('1', 'Tree')] });
  const serialised = JSON.stringify(fs);
  ok(!/blocking|severity|blocker|mustFix/i.test(serialised) && !/blocking/i.test(JSON.stringify(BOOKS_RULES.map(r => r.id))),
    '🔴 NO FINDING CARRIES A BLOCKING OR SEVERITY FIELD. There is nothing a caller could threshold on — if a finding could stop the import, Lauren is stuck and phones David, and the build has failed however good the finding was');
  ok(!/UnitPrice|DocNumber|ShipDate|order_kind|qbo_/.test(serialised.replace(/"id":"[^"]*"/g, '')),
    'and no sentence contains a field name — these are read by a nursery owner, not by a programmer');
}

// ══ §H THE TWO THAT NEED AN ANSWER, AND ONLY THOSE TWO ════════════════════
{
  const fs = evaluateBooks({
    customers: CUSTOMERS, items: [item('1', 'Tree', { unitPrice: 10 })],
    invoices: [inv('i1', '1', [line('1', 'Tree', 10, 10)])],
    discounts: { byName: [{ itemName: 'MD10', lines: 3, withBase: 3, baseTotal: 100, amountTotal: -10,
      verdicts: { equalsSubtotal: 0, belowSubtotal: 3, aboveSubtotal: 0, noBase: 0 },
      excludedFromBase: [], examples: [] }], unnamedDiscountLines: [] } as never,
  });
  const asking = fs.filter(f => f.needsAnswer !== null);
  ok(asking.length === 2,
    '🔴 EXACTLY TWO FINDINGS ASK A QUESTION — the duplicate customers and the broken discounts. Everything else is something she is TOLD. A screen that asks twelve questions gets none of them answered');
  ok(asking.every(f => f.needsAnswer!.options.length >= 2),
    'and each offers real choices rather than a single "OK"');
  ok(asking.every(f => f.measured),
    'a finding that could not be measured never asks a question about it');
}

// ══ §J 🔴 THE CUSTOMER NUMBERS THEMSELVES — added after M7 and M8 survived ══
// Both rules read a breakdown somebody else computed, so it is tempting to assert only that
// they RAN. Two mutants proved that is not enough: one summed the two duplicate tallies
// (double-counting the very records it is about) and one derived unreachable customers by
// subtracting an OVERLAPPING coverage count. Both produce a plausible larger number on a
// screen nobody can check by eye, against a QUOTED figure four days stale — so a reader would
// have read the gap as drift in the data rather than a defect in the arithmetic.
{
  const fs = evaluateBooks({ customers: CUSTOMERS, items: [item('1', 'T', { unitPrice: 1 })],
                             invoices: [inv('i1', '1', [line('1', 'T', 1, 1)])] });

  const dup = find(fs, 'possible-duplicate-customers');
  ok(dup?.population.matched === 72,
    '🔴 THE DUPLICATE COUNT IS max(byEmail, byPhone) = 72, NOT the sum. A customer entered twice usually shares BOTH an email and a phone, so adding the two tallies counts those records twice and reports roughly double');
  ok(dup?.population.of === 1927, 'against the full customer population, not the matched set');
  ok(/At least/.test(dup?.sentence ?? ''),
    'and the sentence says "at least" — the two tallies overlap by an amount this read cannot see, so a confident total would be a claim the data does not support');

  const contact = find(fs, 'customers-with-no-contact');
  ok(contact?.population.matched === 110,
    '🔴 UNREACHABLE CUSTOMERS COMES FROM `withNoContactAtAll` (110), NOT `total - withEmail` (1,027). The three coverage counts OVERLAP: subtracting one of them calls every customer who has a phone but no email unreachable');
}

// ══ §K 🔴 A CATEGORY IS A FOLDER, NOT UNSOLD STOCK — added after M10 survived ══
{
  const items = [
    item('1', 'Trees', { type: 'Category' }),      // a FOLDER — can never be an invoice line
    item('2', 'Shumard Oak'),                      // sold below
    item('3', 'Cedar Elm'),                        // never sold
  ];
  const invoices = [inv('i1', '1', [line('2', 'Shumard Oak', 10, 10)])];
  const f = find(evaluateBooks({ items, invoices }), 'never-sold');
  ok(f?.population.matched === 1 && f.population.of === 2,
    '🔴 THE CATEGORY IS IN NEITHER HALF. A Category cannot appear on an invoice line at all, so counting it as never-sold is counting a filing cabinet as unsold stock — and it inflates BOTH numbers, which is why the ratio looks reasonable while both figures are wrong');
}

// ══ §I THE THREE THAT CANNOT BE COMPUTED SAY SO ═══════════════════════════
{
  const fs = evaluateBooks({ items: [item('1', 'Tree', { unitPrice: 1 })], customers: CUSTOMERS,
                             invoices: [inv('i1', '1', [line('1', 'Tree', 1, 1)])] });
  const trip = find(fs, 'trip-charge-missing');
  ok(trip !== undefined && trip.measured === false && /only you can tell us/.test(trip.notMeasured ?? ''),
    '🔴 TRIP-CHARGE COVERAGE IS UNCOMPUTED AND SAYS SO. Inferring which item means "trip charge" from its name would work on today\'s rows and be a rule nobody agreed to (R-50)');
  ok(find(fs, 'discount-never-applied')?.measured === false,
    'and discount eligibility is a POLICY about their business, not a pattern in their data');
  ok(trip!.quoted.includes('40'),
    'both still carry their quoted figure — an uncomputed finding is still worth showing, with the number somebody once reported');
}

console.log(`\n  booksFindings — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
