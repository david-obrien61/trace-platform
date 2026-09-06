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
import { evaluateBooks, BOOKS_RULES, FINDING_TIERS, SHAPES } from './booksFindings';
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
  unitPrice: null, purchaseCost: null, sku: null, description: null, fullyQualifiedName: null, ...o,
});
const line = (itemId: string | null, itemName: string | null, unitPrice: number | null, amount: number, qty = 1,
              discountInDescription = false) =>
  ({ detailType: 'SalesItemLineDetail', itemId, itemName, qty, amount, unitPrice, discountInDescription });
const inv = (id: string, docNumber: string | null, lines: ReturnType<typeof line>[],
             o: Partial<QboInvoiceRow> = {}): QboInvoiceRow =>
  ({ id, docNumber, txnDate: '2026-05-01', totalAmt: 100, balance: 0, dueDate: null,
     customerId: 'c1', lines, ...o });

const CUSTOMERS: CustomerBreakdown = {
  total: 1927, withEmail: 900, withPhone: 1200, withAddress: 1500, withCompanyName: 300,
  withNoContactAtAll: 110, inactive: 12,
  byEmail: { sharedValues: 30, recordsInvolved: 72, largestCluster: 4 },
  byPhone: { sharedValues: 20, recordsInvolved: 51, largestCluster: 3 },
};

const find = (fs: ReturnType<typeof evaluateBooks>, id: string) => fs.find(f => f.id === id);

// ══ §A THE WITHDRAWN PRICE-CARD RULE, AND ITS HONEST SUCCESSOR ══════════════
//
// 🔴 WHAT THIS SECTION IS REALLY GUARDING. `sold-below-price-card` was WORDED about the
// business's printed price card and COMPUTED against the QuickBooks list price. Those are
// different floors, and the sentence claimed the one it did not use. Over LAWNS's real books it
// produced $1,607,416 — 52% of their revenue — and under money-at-stake ordering that sorts
// FIRST, as the opening line of the document an owner hands their accountant.
//
// So the probe below is not "does the arithmetic work". It is: CAN THE WITHDRAWN RULE COME BACK
// TO LIFE. A future edit that gives it a `run` again would restore the false headline silently,
// and every existing assertion about ordering and populations would keep passing.
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
  const withdrawn = find(evaluateBooks({ items, invoices }), 'sold-below-price-card');
  ok(withdrawn?.measured === false,
    '🔴 THE PRICE-CARD RULE NEVER MEASURES — it is withdrawn, and a probe that only checked the successor would not notice it coming back');
  ok((withdrawn?.notMeasured ?? '').includes('printed price list'),
    'and it says WHY it cannot: we were never given the printed list. A generic "only you can tell us" would send the reader to the wrong question');
  ok(!(withdrawn?.notMeasured ?? '').includes('$'),
    '🔴 AND IT QUOTES NO MONEY FIGURE — the withdrawn number must not survive in the prose of its own withdrawal');

  // ── the successor, which names the floor it actually uses ──────────────────
  const f = find(evaluateBooks({ items, invoices }), 'sold-below-quickbooks-list');
  ok(f?.measured === true && f.population.matched === 1,
    'one sale below the RECORDED price is found');
  ok(f?.population.of === 3,
    '🔴 THE DENOMINATOR EXCLUDES THE UNPRICED ITEM — 3 comparable sales, not 4. An item with no recorded price has no floor, and counting it would make the percentage meaningless');
  ok(/recorded in QuickBooks/.test(f?.sentence ?? ''),
    '🔴 THE SENTENCE NAMES ITS FLOOR. This is the entire defect of the withdrawn rule: it must be impossible to read this as a comparison against a printed card');
  ok(!/price (list|card)/i.test(f?.sentence ?? ''),
    'and it never calls the QuickBooks field a "price list" or a "price card" — those name the document we were never given');

  // 🔴 THE ORDER OF THE CLAUSES IS THE FINDING, NOT ITS PRESENTATION (David, 2026-09-03).
  // Led by the total, an owner reads "$724,273" and hears *"you lost three-quarters of a
  // million dollars"*. Led by the ratio, they read the same numbers as *"we discount by about
  // 13% as a matter of routine"* — which is what the data says. Same figures, opposite meaning,
  // so the order is asserted rather than left to whoever next edits the string.
  const sent = f?.sentence ?? '';
  ok(sent.indexOf('%') < sent.indexOf('$') && sent.indexOf('%') !== -1 && sent.indexOf('$') !== -1,
    '🔴 THE RATIO COMES BEFORE THE TOTAL — the finding leads and the money supports it, never the reverse');
  ok(/^Across /.test(sent),
    'and it opens by naming the span it covers, so no figure in it is read without the period it describes');

  // 🔴 ① A GIVEAWAY IS NOT A DISCOUNT — and this probe had to be REBUILT to mean anything.
  //
  // The first version used a $0 unit price on a $0 amount, which is the shape all 74 real
  // giveaway lines take — and `pricedLines` (amount > 0) had ALREADY removed every one of them
  // before the rule saw it. So the probe passed without ever reaching the guard it named, and
  // the mutation harness proved it: M21 SURVIVED. Both shapes are asserted now.
  //   (a) the REAL shape — excluded upstream, but still COUNTED so `limits` can be true;
  //   (b) the shape that reaches the guard — a $0 unit price on a positive amount.
  const withFree = [...invoices, inv('i5', '1005', [line('1', 'Shumard Oak 30 gal', 0, 0)])];
  const g = find(evaluateBooks({ items, invoices: withFree }), 'sold-below-quickbooks-list');
  ok(g?.population.matched === 1 && g.population.of === 3,
    '🔴 A LINE CHARGED EXACTLY $0 IS NOT COUNTED AS A SALE BELOW LIST — nor in the denominator. Scored, it would contribute the LARGEST possible shortfall (the full list price) for what is a decision to give something away. 74 such lines were live in the real books');
  ok(g?.value === f?.value,
    'and the money at stake does not move when a giveaway is added — proof the exclusion is real and not merely a smaller sentence');
  ok((g?.recommendation?.limits ?? '').includes('1 line that was charged nothing at all'),
    '🔴 AND THE EXCLUSION IS STATED WITH A REAL COUNT. Counting giveaways inside the priced loop gave ZERO — a sentence describing a filter that never fired, which is worse than silence');

  const reachesGuard = [...invoices, inv('i6', '1006', [line('1', 'Shumard Oak 30 gal', 0, 5)])];
  const gg = find(evaluateBooks({ items, invoices: reachesGuard }), 'sold-below-quickbooks-list');
  ok(gg?.population.matched === 1 && gg.population.of === 3,
    '🔴 AND A $0 UNIT PRICE ON A POSITIVE AMOUNT — the shape that actually reaches the in-loop guard — is excluded from both sides too. Without this line the guard is unreachable and asserting on it proves nothing');

  // 🔴 ② PER LINE, NOT PER UNIT — and the same books must not yield two answers.
  const bulk = [inv('i9', '1009', [line('1', 'Shumard Oak 30 gal', 450, 4500, 10)])];
  const h = find(evaluateBooks({ items, invoices: bulk }), 'sold-below-quickbooks-list');
  ok(h?.value === 50,
    '🔴 THE GAP COUNTS ONCE PER SALE, NOT ONCE PER TREE — $50 on a line of ten, not $500. Multiplying by quantity turns deliberate volume pricing into a headline loss, which is what made the withdrawn rule unshippable ($761,504 per line vs $1,657,696 with quantity, on one set of books)');
  ok((h?.sentence ?? '').includes('once per sale'),
    'and the basis is NAMED in the sentence rather than buried in a footnote — the report must pick one and say which');

  // 🔴 THE FAILURE THAT WOULD EMPTY THIS FINDING SILENTLY.
  const noCard = find(evaluateBooks({ items: [item('1', 'Shumard Oak 30 gal')], invoices: [invoices[0]] }), 'sold-below-quickbooks-list');
  ok(noCard?.measured === false,
    '🔴 A CATALOGUE WITH NO PRICES AT ALL REPORTS NOT-MEASURED, NOT "no problems". If a null price were read as a floor of $0.00, every sale on earth is at or above list and this finding reports a clean bill of health over data it never compared');
}

// ══ §A2 RECEIVABLES — the finding whose "we cannot" was false about our own read ══
//
// 🔴 THE ORIGINAL DEFECT WAS NOT A MISSING FEATURE, IT WAS AN ASSERTION. The rule told owners
// *"the invoice read does not include how much of each invoice is still unpaid, or when it was
// due"* while `Balance` and `DueDate` sat on 1,469 of 1,469 rows of the capture. A false
// cannot-compute forecloses the question for every reader who believes it.
{
  const open = (id: string, balance: number, dueDate: string | null) =>
    inv(id, id, [line('1', 'Tree', 100, 100)], { balance, dueDate });
  const invoices = [
    open('a', 500, '2026-01-01'),   // long past due
    open('b', 300, '2026-04-20'),   // 40 days before asOf — past due
    open('c', 200, '2026-05-25'),   //  6 days before asOf — owed, NOT late
    open('d',   0, '2026-01-01'),   // settled — never counted
    open('e', 100, null),           // owed, no due date we can read
    { ...open('f', 0, '2026-01-01'), balance: null },   // balance we could not read at all
  ];
  const f = find(evaluateBooks({ invoices, asOf: '2026-05-31' }), 'overdue-receivables');
  ok(f?.measured === true, '🔴 IT MEASURES. The fields were always in the read; the parser dropped them');
  ok(f?.value === 1100, 'the total owed is every positive balance — $1,100, and the settled invoice is not in it');
  ok((f?.sentence ?? '').includes('not known to be paid'),
    '🔴 AN INVOICE WHOSE BALANCE WE COULD NOT READ IS DECLARED, NOT ABSORBED. Skipping it silently and skipping a SETTLED invoice silently produce the same total and mean opposite things — the mutation harness caught this as an equivalent mutant (M24 survived) precisely because the code could not tell them apart');
  ok((f?.sentence ?? '').includes('$800'),
    '🔴 ONLY WHAT IS MORE THAN 30 DAYS PAST DUE IS LATE — $800, not $1,100. A rule that called every open invoice overdue would be alarming and wrong');
  ok((f?.sentence ?? '').includes('2026-01-01'),
    'the oldest due date is named, because "how long has this been going on" is the question a total cannot answer');
  ok((f?.sentence ?? '').includes('no due date'),
    '🔴 THE UNDATED INVOICE IS DECLARED, NOT DROPPED — it is in the total owed and out of the overdue figure, and the sentence says exactly that. Silently omitting it would understate one number while overstating the reader\'s confidence in both');

  // 🔴 THE CLOCK IS SUPPLIED, NEVER READ — this is what makes the rule probeable at all.
  const noDate = find(evaluateBooks({ invoices }), 'overdue-receivables');
  ok(noDate?.measured === false,
    '🔴 WITHOUT A DATE TO COUNT FROM IT REPORTS UNCOMPUTED rather than quietly substituting today. A finding whose output moves on its own cannot be asserted against');
  ok(!(noDate?.notMeasured ?? '').includes('read does not include'),
    '🔴 AND THE OLD FALSE REASON IS GONE. It blamed the customer\'s books for a field our own parser discarded');

  // A NEGATIVE CONTROL: books where nothing is owed must not report a clean $0 finding.
  const paid = find(evaluateBooks({ invoices: [open('z', 0, '2026-01-01')], asOf: '2026-05-31' }), 'overdue-receivables');
  ok(paid?.measured === false,
    'and a set with no open balance reports not-measured rather than "$0 owed" — a pass over an empty population is a failure (§C)');
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
  const f = find(evaluateBooks({ items, invoices }), 'sold-below-quickbooks-list');
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

  // ⚠️ THE ORDERING RULE CHANGED, AND THIS PROBE GOT STRICTER RATHER THAN LOOSER. It used to
  // assert tier-monotonicity over the WHOLE list. The list is now measured-findings first
  // (money → risk → tidiness) and everything that could NOT be computed last, across all tiers
  // — so a not-measured money rule legitimately sits after a measured tidiness one, and a
  // whole-list tier check would forbid the ruled behaviour. All three properties below are
  // asserted separately so that relaxing any ONE of them still goes red.
  const measured = fs.filter(f => f.measured);
  const unmeasured = fs.filter(f => !f.measured);
  const mTiers = measured.map(f => FINDING_TIERS.indexOf(f.tier));
  ok(mTiers.every((t, i) => i === 0 || mTiers[i - 1] <= t),
    '🔴 AMONG MEASURED FINDINGS TIERS NEVER GO BACKWARDS. Sorted by how wrong they are it reads as an audit of her work; money-first it reads as help');
  ok(fs.findIndex(f => !f.measured) === -1 || measured.length === fs.findIndex(f => !f.measured),
    '🔴 everything that could not be computed comes LAST, in one block — it is the most valuable page in the report and it is not a finding about her money');
  ok(unmeasured.every(f => f.value === null),
    'and nothing unmeasured carries a value, so it can never be ordered as though it had been measured and found worthless');

  // Within a tier, the order is MONEY AT STAKE, computed from their own numbers.
  for (const tier of FINDING_TIERS) {
    const vals = measured.filter(f => f.tier === tier).map(f => (f.value === null ? -Infinity : f.value));
    ok(vals.every((v, i) => i === 0 || vals[i - 1] >= v),
      `🔴 within the ${tier} tier the order is by money at stake, descending — computed, never a number somebody typed`);
  }

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


// ══ §G THE SHAPES — THE PRODUCT IS THE RULE, NOT THE FINDING ═══════════════
{
  const shapes = Object.keys(SHAPES);
  ok(shapes.length === 8, 'there are eight shapes');
  ok(BOOKS_RULES.every(r => shapes.includes(r.shape)),
    'every rule states which shape it is an instance of — a rule that states no shape is a one-off finding wearing a rule\'s clothes');
  const covered = new Set(BOOKS_RULES.map(r => r.shape));
  ok(shapes.every(sh => covered.has(sh)),
    `🔴 all EIGHT shapes have at least one rule — missing: ${shapes.filter(sh => !covered.has(sh)).join(', ') || 'none'}`);

  // 🔴 THE TEST THAT KEEPS THIS PLATFORM-SHAPED. If a rule needs a vertical's vocabulary to be
  // stated, it is one business's finding and customer two gets a worse report, not a better one.
  // Only STATIC text is checked — a sentence built from their own item names legitimately
  // contains their words, and testing those would fail on any real catalogue.
  const VERTICAL = /\b(tree|shrub|plant|nursery|gallon|oak|mulch|garden|landscap|seedling|cultivar)\w*/i;
  const staticText = BOOKS_RULES.map(r => `${r.id} ${r.shape} ${r.quoted} ${r.cannotCompute ?? ''}`);
  const offenders = staticText.filter(t => VERTICAL.test(t));
  ok(offenders.length === 0,
    `🔴 every rule is expressible WITHOUT naming a vertical — offenders: ${offenders.join(' | ') || 'none'}`);
  ok(Object.values(SHAPES).every(label => !VERTICAL.test(label)),
    'and so is every shape label');
}

// ══ §H THE RECOMMENDATION — ALL FOUR PARTS, AND COMPUTED RATHER THAN AUTHORED ══
{
  const items = [item('1', 'Widget', { unitPrice: 100 })];
  const small = evaluateBooks({
    items, customers: CUSTOMERS,
    invoices: [inv('i1', '1001', [line('1', 'Widget', 90, 90)])],
  });
  const rec = small.find(f => f.recommendation !== null)?.recommendation;
  ok(rec !== undefined && rec !== null, '🔴 at least one finding carries a RECOMMENDATION');
  if (rec) {
    ok(typeof rec.statusQuoCost === 'number', 'part 1 — what the status quo costs');
    ok(typeof rec.remedy === 'string' && rec.remedy.length > 0, 'part 2 — the fix');
    ok(typeof rec.remedyCost === 'number', 'part 3 — what the fix costs (zero is a real answer, and it is STATED)');
    ok(typeof rec.paybackMonths === 'number', 'part 4 — the payback');
    ok(typeof rec.limits === 'string' && rec.limits.length > 0,
      '⚠️ and what it does NOT fix — a recommendation that hides its limits gets found out on day two');
  }

  // 🔴 COMPUTED, NOT AUTHORED — proven by CHANGING THE BOOKS AND WATCHING THE NUMBER MOVE. A
  // probe asserting `statusQuoCost === 10` would pass just as happily against a hardcoded 10.
  const bigger = evaluateBooks({
    items, customers: CUSTOMERS,
    invoices: [
      inv('i1', '1001', [line('1', 'Widget', 90, 90)]),
      inv('i2', '1002', [line('1', 'Widget', 50, 150, 3)]),   // 3 units, $50 under a $100 floor
    ],
  });
  const rec2 = bigger.find(f => f.recommendation !== null)?.recommendation;
  ok(rec2 !== undefined && rec2 !== null && rec !== null && rec2.statusQuoCost > rec.statusQuoCost,
    '🔴 a second set of books produces a DIFFERENT status-quo cost — the four parts come from their numbers, not from this file');
  ok(rec2 !== undefined && rec2 !== null && rec2.statusQuoCost === 10 + 50,
    '🔴 and the arithmetic is PER LINE, not per unit: $10 + $50, NOT $10 + (3 x $50). The three-unit line contributes its gap ONCE. This assertion is the per-line ruling expressed as a number, and it is the one that fails first if someone reinstates the quantity multiplier');
}

// ══ §I MONEY AT STAKE ORDERS THE LIST, AND NULL IS NOT ZERO ════════════════
{
  const fs = evaluateBooks({
    items: [item('1', 'Widget', { unitPrice: 100 })], customers: CUSTOMERS,
    invoices: [inv('i1', '1001', [line('1', 'Widget', 40, 40)])],
  });
  const measuredMoney = fs.filter(f => f.measured && f.tier === 'money');
  ok(measuredMoney.some(f => f.value !== null), 'a measured money finding carries a computed value');
  ok(fs.filter(f => !f.measured).every(f => f.value === null && f.recommendation === null),
    '🔴 nothing that could not be computed carries a value or a recommendation');
  // null must not collapse into 0 — otherwise "not a money question" sorts as "worth nothing"
  const withNull = fs.filter(f => f.measured && f.value === null);
  ok(withNull.every(f => f.value === null && (f.value as number | null) !== 0),
    'a finding that is not a money question keeps a NULL value, never a zero that would read as a measurement');
}


// ══ §J DISCOUNTING ANNOUNCED IN WORDING — THE MEASURABILITY FINDING ════════
{
  const items = [item('1', 'Widget', { unitPrice: 100 })];
  const invoices = [
    // two lines whose WORDING announces a discount, and which are not recorded as discounts
    inv('i1', '1001', [line('1', 'Widget', 90, 90, 1, true), line('1', 'Widget', 80, 80, 1, true)]),
    // one properly recorded discount line
    inv('i2', '1002', [line('1', 'Widget', 100, 100), { detailType: 'DiscountLineDetail', itemId: null,
      itemName: 'CD10%', qty: null, amount: -10, unitPrice: null, discountInDescription: false }],
    ),
  ];
  const f = evaluateBooks({ items, invoices, customers: CUSTOMERS }).find(x => x.id === 'discount-in-wording');
  ok(f !== undefined && f.measured, 'the wording rule runs');
  ok(f?.population.matched === 2, 'it counts the two lines that ANNOUNCE a discount');
  ok(f?.population.of === 4, 'out of every line read, not out of the discount lines');
  ok(f?.value === 170, '🔴 the money at stake is what those lines carried ($90 + $80), computed');
  ok(f?.sentence.includes('$170') && f?.sentence.includes('$10'),
    'the sentence carries BOTH numbers — what is invisible, and what is recorded properly');
  ok(!/\bare discounts\b/i.test(f?.sentence ?? ''),
    '🔴 it never says these lines ARE discounts — the wording mentions one, and calling them discounts would be the retro-classification R-50 forbids');
  ok(f?.shape === 'prose-not-a-field', 'and it declares its shape');
}

// ══ §K A RULE THAT CANNOT RUN SAYS WHY IN ITS OWN WORDS ════════════════════
{
  const fs = evaluateBooks({ items: [item('1', 'Widget')], invoices: [inv('i1', '1', [line('1', 'Widget', 5, 5)])],
                             customers: CUSTOMERS });
  // ⚠️ THIS SECTION CHANGED TARGET ON 2026-09-03 AND THE REASON IS THE FINDING. It used to
  // prove that receivables named the FIELDS it lacked — and that reason was false: the fields
  // were in the read all along. The rule now computes, so the surviving unrunnable case is the
  // one where no date was supplied to measure "past due" against.
  const ar = fs.find(f => f.id === 'overdue-receivables');
  ok(ar !== undefined && !ar.measured, 'receivables does not run when nothing is owed and no date was given');
  ok(/date to count from/i.test(ar?.notMeasured ?? ''),
    '🔴 and it names what is genuinely missing — the date — not a generic "only you can tell us", and NOT the old claim that their books lack a balance they carry on every row');
  const trip = fs.find(f => f.id === 'trip-charge-missing');
  ok(trip !== undefined && !trip.measured && (trip.notMeasured ?? '').length > 0,
    'and a rule blocked on POLICY rather than on a field still says so in its own words');
  ok(!/only you can tell us/i.test(ar?.notMeasured ?? ''),
    'blocked-on-a-field and blocked-on-policy are different problems with different next steps');
}


// ══ §L THE FOUR THAT A MUTANT FOUND — EACH NEEDED A FIXTURE THAT COULD TELL THE DIFFERENCE ══
//
// 🔴 ALL FOUR OF THESE SURVIVED A GREEN SUITE. Not because the assertions were wrong, but
// because every fixture above happened to make the correct answer and the mutant's answer
// IDENTICAL — one measured money finding sorts the same either way, a null and a zero tie when
// nothing else is in the tier. The probes below are built specifically so that the two orderings
// DISAGREE. Same lesson as the #248 seam and R-33: an assertion aimed near the property proves
// nothing about the property.
{
  // ── M12: within a tier the order must be MONEY, not the order the rules are written in ──
  // `sold-below-quickbooks-list` is declared EARLY and is worth $10 here; `discount-in-wording` is
  // declared LATE and is worth $500. Declared order and money order therefore disagree, which
  // is the only arrangement that can catch a sort that ignores the money.
  const items = [item('1', 'Widget', { unitPrice: 100 }), item('2', 'Other')];
  const invoices = [
    inv('i1', '1001', [line('1', 'Widget', 90, 90)]),               // $10 under a $100 floor
    inv('i2', '1002', [line('2', 'Other', 500, 500, 1, true)]),     // $500 announced in wording
  ];
  const fs = evaluateBooks({ items, invoices, customers: CUSTOMERS });
  const at = (id: string) => fs.findIndex(f => f.id === id);
  const card = fs.find(f => f.id === 'sold-below-quickbooks-list');
  const word = fs.find(f => f.id === 'discount-in-wording');
  ok(card?.value === 10 && word?.value === 500, 'the two money findings are worth $10 and $500');
  ok(at('discount-in-wording') < at('sold-below-price-card'),
    '🔴 the $500 finding outranks the $10 one even though it is DECLARED LATER — the order is hers, computed from her books, not ours');
}
{
  // ── M14: a NULL value is not a ZERO one ──
  // `discounts-that-do-not-work` is measured with NO money attached (null); `discount-in-wording`
  // is measured at exactly $0. Both are money-tier, and the null one is DECLARED FIRST — so if
  // null collapses to 0 the two tie and the declared order wins, putting the null one first.
  const fs = evaluateBooks({
    items: [item('1', 'Widget')], customers: CUSTOMERS,
    invoices: [inv('i1', '1001', [line('1', 'Widget', 10, 10)])],
    discounts: { byName: [{ itemName: 'CD10%', lines: 4, withBase: 4, baseTotal: 100, amountTotal: 10,
                            verdicts: { equalsSubtotal: 4, belowSubtotal: 0, aboveSubtotal: 0, noBase: 0 },
                            excludedFromBase: [], examples: [] }],
                 unnamedDiscountLines: [] },
  });
  const word = fs.find(f => f.id === 'discount-in-wording');
  const broke = fs.find(f => f.id === 'discounts-that-do-not-work');
  ok(word?.value === 0, 'a business with no discounting-in-wording measures at exactly $0 — measured, not absent');
  ok(broke?.measured === true && broke?.value === null, 'and the broken-discount finding is measured with NO money attached');
  ok(fs.findIndex(f => f.id === 'discount-in-wording') < fs.findIndex(f => f.id === 'discounts-that-do-not-work'),
    '🔴 a measured $0 outranks a NULL — "worth nothing" and "not a money question" are different answers, and only one of them belongs in a money ordering');
}
{
  // ── M19: a line RECORDED as a discount is not a line that merely mentions one ──
  // The formal discount line's own wording also says "discount" — which is entirely normal, and
  // is exactly the case where counting a line twice would inflate the accusation.
  const items = [item('1', 'Widget', { unitPrice: 100 })];
  const invoices = [inv('i1', '1001', [
    line('1', 'Widget', 90, 90, 1, true),
    { detailType: 'DiscountLineDetail', itemId: null, itemName: 'CD10%', qty: null, amount: -10,
      unitPrice: null, discountInDescription: true },
  ])];
  const f = evaluateBooks({ items, invoices, customers: CUSTOMERS }).find(x => x.id === 'discount-in-wording');
  ok(f?.population.matched === 1,
    '🔴 a properly recorded discount line whose wording ALSO says "discount" is counted ONCE, as recorded — not as evidence against them');
}
{
  // ── M20: a catalogue with no formula has not broken one ──
  // Every product priced independently is a legitimate way to run a business. Inventing a
  // "formula" from whatever multiple happens to be most common and then reporting that the
  // sales broke it would be a rule the owner never adopted, held against them.
  const items = [
    item('1', 'A', { unitPrice: 100, purchaseCost: 10 }),   // 10x
    item('2', 'B', { unitPrice: 100, purchaseCost: 25 }),   // 4x
    item('3', 'C', { unitPrice: 100, purchaseCost: 50 }),   // 2x
  ];
  const invoices = [inv('i1', '1001', [line('1', 'A', 100, 100), line('2', 'B', 100, 100), line('3', 'C', 100, 100)])];
  const f = evaluateBooks({ items, invoices, customers: CUSTOMERS }).find(x => x.id === 'markup-formula-not-achieved');
  ok(f !== undefined && f.measured === false,
    '🔴 a catalogue with NO consistent markup reports not-measured — it is not told it broke a formula nobody set');

  // …and the same rule DOES fire when a formula genuinely exists and the sales miss it.
  const consistent = [
    item('1', 'A', { unitPrice: 30, purchaseCost: 10 }), item('2', 'B', { unitPrice: 60, purchaseCost: 20 }),
    item('3', 'C', { unitPrice: 90, purchaseCost: 30 }),
  ];
  const soldLow = [inv('i1', '1001', [line('1', 'A', 20, 20), line('2', 'B', 40, 40), line('3', 'C', 60, 60)])];
  const g = evaluateBooks({ items: consistent, invoices: soldLow, customers: CUSTOMERS })
    .find(x => x.id === 'markup-formula-not-achieved');
  ok(g?.measured === true && g.sentence.includes('3x'),
    'and where the list DOES follow a 3x rule it says so — the negative control, without which the probe above passes on a rule that never fires at all');
  ok(g?.value === 60, 'the gap is computed: 3x on a $60 cost base is $180, and $120 was taken');
}

console.log(`\n  booksFindings — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
