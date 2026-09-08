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
import { evaluateBooks, BOOKS_RULES, FINDING_TIERS, SHAPES, RETIRED_RULE_IDS, FINDING_ROW_LIMIT } from './booksFindings';
import type { QboInvoiceRow } from './invoiceList';
import type { QboItemRow } from './itemList';
import type { CustomerBreakdown, QboCustomerRow } from './customerList';

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
  ({ detailType: 'SalesItemLineDetail', itemId, itemName, qty, amount, unitPrice, discountInDescription,
     percentBased: null as boolean | null, discountPercent: null as number | null,
     // Added 2026-09-08 with the services review — the parser now also carries whether the line's
     // wording said the price included planting, the line's own income account, and the size read
     // out of the description. None of them is read by `booksFindings`; they are here so a fixture
     // is a whole line rather than a subset that happens to compile.
     installInDescription: false, itemAccountName: null as string | null,
     sizeFromDescription: null as string | null,
     // Added 2026-09-08 with the giveaway census. A fixture that omits a field the parser always
     // writes is a fixture that cannot provoke the rule reading it — #182's shape, in miniature.
     replacementInDescription: false });
const inv = (id: string, docNumber: string | null, lines: ReturnType<typeof line>[],
             o: Partial<QboInvoiceRow> = {}): QboInvoiceRow =>
  ({ id, docNumber, txnDate: '2026-05-01', totalAmt: 100, balance: 0, dueDate: null,
     customerId: 'c1', lines, ...o });

const CUSTOMERS: CustomerBreakdown = {
  total: 1927, withEmail: 900, withPhone: 1200, withAddress: 1500, withCompanyName: 300,
  withNoContactAtAll: 110, inactive: 12,
  byEmail: { sharedValues: 30, recordsInvolved: 72, largestCluster: 4 },
  byPhone: { sharedValues: 20, recordsInvolved: 51, largestCluster: 3 },
  census: {
    reach: { withBoth: 800, withEither: 1300, withNeither: 627, emailOnly: 100, phoneOnly: 400,
             withAddressLine1: 1400, withPostalCode: 1100, addressWithoutPostalCode: 300, withoutAddress: 527 },
    names: { givenNameOnly: 69, companyEqualsGivenName: 31, pureOrganisations: 47, noNameAtAll: 5 },
    paperwork: { nonTaxable: 27, withExemptionReason: 27, withResaleNumber: 9, withCustomerType: 34, withNotes: 9 },
  },
};

/** A whole customer RECORD, for the rules that need rows rather than counts. */
const cust = (id: string, displayName: string, o: Partial<QboCustomerRow> = {}): QboCustomerRow => ({
  id, displayName, email: null, phone: null, address: null, companyName: null, active: true,
  givenName: null, familyName: null, addressLine1: null, postalCode: null,
  taxable: true, taxExemptionReason: null, resaleNum: null, customerType: null, hasNotes: false, ...o,
});

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
  // 🔴 THE CENSUS IS ZEROED TOO, AND LEAVING IT POPULATED WAS ITSELF A FINDING. A breakdown that
  // says `total: 0` while its census says *27 customers are not charged sales tax* is not an empty
  // read, it is an incoherent one — and a rule reading the census would have measured against a
  // population that does not exist. An empty walk must be empty in every field a rule can reach.
  const EMPTY_CENSUS: CustomerBreakdown['census'] = {
    reach: { withBoth: 0, withEither: 0, withNeither: 0, emailOnly: 0, phoneOnly: 0,
             withAddressLine1: 0, withPostalCode: 0, addressWithoutPostalCode: 0, withoutAddress: 0 },
    names: { givenNameOnly: 0, companyEqualsGivenName: 0, pureOrganisations: 0, noNameAtAll: 0 },
    paperwork: { nonTaxable: 0, withExemptionReason: 0, withResaleNumber: 0, withCustomerType: 0, withNotes: 0 },
  };
  const empty = evaluateBooks({ items: [], invoices: [], customerRows: [], customers: { ...CUSTOMERS, total: 0, withNoContactAtAll: 0, census: EMPTY_CENSUS, byEmail: { sharedValues: 0, recordsInvolved: 0, largestCluster: 0 }, byPhone: { sharedValues: 0, recordsInvolved: 0, largestCluster: 0 } } });
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

  const custRule = find(invoicesOnly, 'contact-reach');
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
    // The duplicate rule reads ROWS, not the breakdown — see its own comment. Without them it
    // reports itself uncomputed and asks nothing, so the "exactly two" assertion below would pass
    // for the wrong reason. Two records sharing an email is the smallest input that makes it fire.
    customerRows: [cust('c1', 'Ann Spannaus', { email: 'a@x.com' }),
                   cust('c2', 'A Spannaus',   { email: 'A@X.com' })],
    // ✏️ CORRECTED TWICE, 2026-09-06 then 2026-09-07. The first fixture used `belowSubtotal`, the
    // second `noBase` — and BOTH were verdicts derived from a base that was never read (`Qty`,
    // which is 1). The rule now fires on a RATE QuickBooks stated that no product names, so the
    // fixture states one: 20%, with no 20% item in the list above.
    discounts: { byName: [], unnamedDiscountLines: [],
      byRate: [{ pct: 20, lines: 3, amountTotal: 900, customers: 2, first: '2025-11-09', last: '2026-03-13' }],
      fixedDollar: { lines: 0, amountTotal: 0, examples: [] } } as never,
  });
  const asking = fs.filter(f => f.needsAnswer !== null);
  ok(asking.length === 2,
    '🔴 EXACTLY TWO FINDINGS ASK A QUESTION — the duplicate customers and the broken discounts. Everything else is something she is TOLD. A screen that asks twelve questions gets none of them answered');
  ok(asking.every(f => f.needsAnswer!.options.length >= 2),
    'and each offers real choices rather than a single "OK"');
  ok(asking.every(f => f.measured),
    'a finding that could not be measured never asks a question about it');
}

// ══ §J 🔴 THE CUSTOMER NUMBERS THEMSELVES — AND THE TWO RULES THAT USED TO GET THEM WRONG ══
//
// Both of the rules that stood here read a breakdown somebody else computed, so it was tempting to
// assert only that they RAN. Two mutants proved that is not enough: one summed the two duplicate
// tallies (double-counting the very records it is about) and one derived unreachable customers by
// subtracting an OVERLAPPING coverage count. Both produce a plausible larger number on a screen
// nobody can check by eye.
//
// 🔴 BOTH RULES ARE NOW RETIRED, AND THE REASON IS THE SAME CLASS ONE LEVEL UP: the arithmetic was
// only ever as good as what the rule was HANDED. `max(byEmail, byPhone)` is not a union and cannot
// be made into one from two counts, however carefully it is asserted.
{
  const fs = evaluateBooks({ customers: CUSTOMERS, items: [item('1', 'T', { unitPrice: 1 })],
                             invoices: [inv('i1', '1', [line('1', 'T', 1, 1)])] });

  // 🔴 THE FOUR IDS ARE WRITTEN OUT HERE, NOT READ FROM THE EXPORT — AND MUTANT N11 IS WHY.
  // The loop below iterates `RETIRED_RULE_IDS`, so a change to that array changes the POPULATION
  // the probe walks: renaming an entry made the whole check vacuous while every assertion still
  // passed. That is #182's shape exactly — a probe that reports a count it never states an
  // expectation for — and the fix is a literal expectation the mutant cannot move.
  const RETIRED_EXPECTED = [
    'duplicate-invoice-numbers', 'invoices-without-delivery-date',
    'possible-duplicate-customers', 'customers-with-no-contact',
  ];
  ok(RETIRED_EXPECTED.every(id => (RETIRED_RULE_IDS as readonly string[]).includes(id))
     && RETIRED_RULE_IDS.length === RETIRED_EXPECTED.length,
    '🔴 THE RETIRED LIST IS EXACTLY THESE FOUR IDS, ASSERTED LITERALLY. Reading the list from the export and then looping over it means the export defines its own test — rename an entry and the probe walks a different population and still goes green');
  for (const dead of [...RETIRED_EXPECTED, ...RETIRED_RULE_IDS]) {
    ok(find(fs, dead) === undefined,
      `🔴 THE RETIRED RULE \`${dead}\` IS GONE AND MAY NEVER COME BACK UNDER ITS OWN ID. Stored results are compared on (rule_id, rule_version); an id that has meant two things makes every comparison across it a lie`);
    ok(!BOOKS_RULES.some(r => r.id === dead),
      `and \`${dead}\` is absent from BOOKS_RULES itself, not merely filtered out of one run`);
  }

  // ── the union, which is the whole reason `max()` had to go ──
  //
  // 🔴 THIS IS THE CASE `max()` CANNOT SEE AND NO ASSERTION ABOUT `max()` COULD HAVE CAUGHT.
  // Two records share an email; two DIFFERENT records share a phone; nobody shares both. The
  // email tally is 2 and the phone tally is 2, so `max()` reports 2 — and the true answer is 4.
  const rows = [
    cust('c1', 'Ann Spannaus',   { email: 'a@x.com' }),
    cust('c2', 'A Spannaus',     { email: 'A@X.com' }),          // same email, different casing
    cust('c3', 'Zach Mcgrath',   { phone: '(512) 456-3632' }),
    cust('c4', 'Zack Mcgrath',   { phone: '512-456-3632' }),     // same phone, different format
    cust('c5', 'Sarah Wilson'),                                   // same NAME, no email, no phone
    cust('c6', 'Sarah Wilson'),
    cust('c7', 'Nicholas Servin'),                                // one letter apart — NOT matched
    cust('c8', 'Nicolas Servin'),
    cust('c9', 'Somebody Else',  { email: 'unique@x.com', phone: '5551234567' }),
  ];
  const withRows = evaluateBooks({ customers: { ...CUSTOMERS, total: rows.length }, customerRows: rows });
  const dup = find(withRows, 'customers-entered-more-than-once');
  ok(dup?.population.matched === 6,
    '🔴 THE UNION IS 6, NOT max(2, 2) = 2. Two records share an email, two DIFFERENT records share a phone, two more share only a name — `max()` reports the largest single axis and silently discards every record the other axes found. That is the defect that reported 52 where the answer was 72');
  ok(dup?.population.of === rows.length, 'against the full customer population, not the matched set');
  ok(dup?.rowsTotal === 6 && (dup?.rows?.length ?? 0) === 6,
    'and the RECORDS come back, not just a count — a union cannot be computed from tallies, which is why this rule takes rows at all');
  ok(new Set(dup?.rows?.map(r => r.group)).size === 3,
    'the six records arrive as THREE groups — an owner deciding whether to merge needs the cluster, not six unrelated rows');
  ok(dup?.rows?.some(r => /email/.test(r.note ?? '')) === true
     && dup?.rows?.some(r => /phone/.test(r.note ?? '')) === true
     && dup?.rows?.some(r => /name/.test(r.note ?? '')) === true,
    '🔴 AND EVERY GROUP SAYS WHICH AXIS FOUND IT. A merge decision made without knowing whether the evidence was an email or a spelling is a merge made blind');
  ok(!dup?.rows?.some(r => /Nicolas|Nicholas/.test(r.label)),
    '🔴 `Nicholas` AND `Nicolas` ARE NOT MATCHED, AND THAT IS THE DECLARED LIMIT RATHER THAN A BUG. `personNamesMatch` is exact token-set equality; a one-letter difference is a different token. Widening it to edit distance would also merge `Sarah` with `Sara`, and a wrong merge is not fixable');

  // ── the rule REFUSES the weaker answer rather than falling back to it ──
  const noRows = evaluateBooks({ customers: CUSTOMERS });
  const refused = find(noRows, 'customers-entered-more-than-once');
  ok(refused?.measured === false && /cannot be worked out from a count/.test(refused.notMeasured ?? ''),
    '🔴 WITH COUNTS BUT NO ROWS IT REPORTS ITSELF UNCOMPUTED. The breakdown is right there and using it would produce a plausible, smaller, wrong number with nothing on screen to say anything had been substituted');

  // ── the tax paperwork: three fields, and only one of them is evidence ──
  //
  // 🔴 THE FIXTURE IS BUILT SO THE TWO SUBTRACTIONS DISAGREE, WHICH IS THE ONLY WAY THIS PROBE
  // MEANS ANYTHING. 27 exempt, 27 with a REASON, 9 with a RESALE NUMBER: subtracting the reason
  // gives 0 and subtracting the number gives 18. A fixture where the two agree would pass under
  // either arithmetic and would be asserting nothing (mutant N20).
  const tax = find(fs, 'tax-exemption-without-evidence');
  ok(tax?.population.matched === 18 && tax.population.of === 27,
    '🔴 EVIDENCE IS THE RESALE NUMBER, NOT THE REASON. A reason is a note somebody typed; a resale number is the document a tax auditor accepts, and 18 of these 27 exemptions rest on the first');
  ok(tax?.blocks.join(' ') === 'Proving a sales-tax exemption at audit',
    'and what it switches off is named as a capability');

  // ── reach, worded as a capability ──
  const contact = find(fs, 'contact-reach');
  ok(contact?.population.matched === CUSTOMERS.census.reach.withNeither,
    'the contact finding counts the records with NEITHER an email nor a phone — not `total - withEmail`, which calls every phone-only customer unreachable');
  ok(/can be reached/.test(contact?.sentence ?? '')
     && contact!.sentence.indexOf(String(CUSTOMERS.census.reach.withEither.toLocaleString()))
        < contact!.sentence.indexOf('switched off'),
    '🔴 THE SENTENCE LEADS WITH HOW MANY CAN BE REACHED. David: "THE HEADLINE IS 1,828 REACHABLE, NOT 125 UNREACHABLE." Same numbers, opposite meaning — the order of the clauses IS the finding');
  ok(contact?.blocks.join(' ') === 'Campaigns Review requests',
    '🔴 AND `blocks` NAMES CAPABILITIES, NEVER FAULTS — "Campaigns", not "125 customers have no contact details". The sentence already says what is true; this says what the business cannot do');

  const addr = find(fs, 'address-reach');
  ok(addr?.population.matched === CUSTOMERS.census.reach.withoutAddress,
    'the address finding is about a DIFFERENT capability and has its own count — routing needs a line, pricing by distance needs a postcode');
  ok(/postcode/.test(addr?.sentence ?? ''),
    'and it names both rungs, because an address with no postcode can be driven to and not measured');

  // ── a clean finding blocks nothing ──
  const reachable = { ...CUSTOMERS, census: { ...CUSTOMERS.census,
    reach: { ...CUSTOMERS.census.reach, withNeither: 0, withEither: CUSTOMERS.total } } };
  const cleanContact = find(evaluateBooks({ customers: reachable }), 'contact-reach');
  ok(cleanContact?.clean === true && cleanContact.measured === true,
    '🔴 A RULE THAT RAN AND FOUND NOTHING IS `clean`, NOT MERELY `matched: 0`. A rule that could not run also has matched 0, and calling that clean lets an empty read certify a business');
  ok(cleanContact?.blocks.length === 0,
    '🔴 AND A CLEAN FINDING BLOCKS NOTHING. "Campaigns · Review requests" printed beside "every record has an email or a phone" says the opposite of the sentence, in the half a reader skims');
  // 🔴 THE OTHER DIRECTION, AND MUTANT N6 IS WHY IT IS HERE. Asserting only that a clean finding
  // is `clean` passes on `clean: true` for EVERYTHING — the whole review rendering under "we
  // checked and found nothing wrong", including the findings that found something.
  ok(contact?.clean === false && contact.measured === true,
    '🔴 A MEASURED FINDING THAT FOUND SOMETHING IS NOT CLEAN. Without this, `clean: true` everywhere passes every other assertion in this file and renders the entire review as a clean bill of health');
  ok(evaluateBooks({}).every(f => f.clean === false),
    '🔴 AND NOTHING IS CLEAN WHEN NOTHING WAS READ. A rule that could not run also matched zero, and calling that clean lets an empty read certify a business — the same conflation `measured` exists to refuse, arriving through a second field');
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
    discounts: { byName: [{ itemName: 'CD10%', lines: 4, zeroAmountLines: 0, withBase: 4, baseTotal: 1000,
                            amountTotal: -100, examples: [], percents: [{ pct: 10, lines: 4 }], mostRecent: '2026-08-19' }],
                 // 10% is PUBLISHED by the item below, so nothing here is an unnamed rate — the
                 // finding measures at zero, which is what M14 needs (measured, no money attached).
                 byRate: [{ pct: 10, lines: 4, amountTotal: 100, customers: 4, first: '2026-01-01', last: '2026-08-19' }],
                 fixedDollar: { lines: 0, amountTotal: 0, examples: [] },
                 unnamedDiscountLines: [] },
    items: [item('1', 'Widget'), item('3', 'CD10%', { unitPrice: -0.1 })],
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

// ══ M-DISC ✏️ THE DISCOUNT RULE, REWRITTEN ON A BASE THAT IS ACTUALLY READ ═══════════════════
// 🔴 THIS RULE HAS NOW BEEN WRONG TWICE, AND THE SECOND TIME IS THE INSTRUCTIVE ONE. It first
// fired on `verdicts.belowSubtotal`; on 2026-09-06 that was reworded to fire on `noBase` instead,
// on the reasoning that a base below the subtotal is tree-only discounting working correctly.
// **Both versions rested on a base that was never read.** `Qty` on a discount line is 1 — measured,
// all 21 of LAWNS's — so every verdict was a comparison of $1.00 against an invoice subtotal, and
// `excludedFromBase` came back EMPTY on every row, which was the tell nobody read.
//
// The rule now measures something QuickBooks STATES: a discount rate used on invoices that no
// item in the product list names. No base, no inference, nothing to get wrong.
{
  const base = { customers: CUSTOMERS, invoices: [inv('i1', '1001', [line('1', 'Widget', 10, 10)])] };
  const rate = (pct: number, lines = 2, amountTotal = 500) =>
    ({ pct, lines, amountTotal, customers: 2, first: '2025-11-09', last: '2026-03-13' });
  const findingFor = (byRate: ReturnType<typeof rate>[], items: QboItemRow[], fixedLines = 0) =>
    evaluateBooks({ ...base, items,
      discounts: { byName: [], unnamedDiscountLines: [], byRate,
        fixedDollar: { lines: fixedLines, amountTotal: fixedLines * 200, examples: [] } } as never })
      .find(f => f.id === 'discounts-that-do-not-work');

  const CD10 = item('3', 'CD10%', { unitPrice: -0.1 });
  const CD15 = item('4', 'CD15%', { unitPrice: -0.15 });

  // ① A NAMED RATE IS NOT A FINDING.
  const named = findingFor([rate(10)], [CD10]);
  ok(named?.population.matched === 0,
    '🔴 a 10% discount is NOT flagged when an item publishes 10% — it has a name, and that is the whole test');
  ok(named?.needsAnswer === null, 'and it asks her nothing');
  ok(named?.value === null, 'and carries no money — "nothing to report" is not "$0 at stake"');

  // ② AN UNNAMED RATE IS. This is LAWNS's $15,173 at 20%.
  const unnamed = findingFor([rate(20, 4, 15173)], [CD10, CD15]);
  ok(unnamed?.population.matched === 1, '🔴 a 20% rate nothing publishes IS flagged');
  ok(unnamed?.value === 15173, 'carrying the real money, not a count');
  ok(/20%/.test(unnamed?.sentence ?? '') && /\$15,173/.test(unnamed?.sentence ?? ''),
    'and the sentence names the rate and the amount, so she can act on it');
  ok(unnamed?.needsAnswer !== null, 'this one DOES ask her, because there is something to decide');

  // ③ MIXED — the separation is real, not "any rate with an odd number".
  const mixed = findingFor([rate(10), rate(20, 4, 15173)], [CD10]);
  ok(mixed?.population.matched === 1 && mixed?.population.of === 2,
    '🔴 exactly ONE of two rates is flagged — the named one is excluded by NAME, not by size');
  ok(!/10%/.test((mixed?.sentence ?? '').split('—')[0]),
    'and the named rate does not appear in the list of unnamed ones');

  // ④ FIXED-DOLLAR IS REPORTED AS MONEY AND NEVER AS A PERCENT.
  const fixed = findingFor([rate(10)], [CD10], 6);
  ok(/flat amount rather than a percentage/.test(fixed?.sentence ?? ''),
    '🔴 fixed-dollar discounts are named as flat amounts');
  ok(/does not say what they were a percentage of/.test(fixed?.sentence ?? ''),
    'and the sentence says WHY they are not converted — the invoice does not state a base');
  ok(!/%/.test((fixed?.sentence ?? '').split('flat amount')[1] ?? ''),
    'and no percent sign follows them');

  // ⑤ 🔴 THE 100× GUARD, AT THE RULE, WITH A FIXTURE THAT CAN ACTUALLY TELL THE TWO APART.
  //    A −$25 flat item would read as "2500%" without the guard — but no invoice can grant 2500%,
  //    so a 20% fixture passes either way and proves nothing (it survived a mutant, measured).
  //    The one case where the guard CHANGES the answer is a flat item whose dollar amount, times
  //    100, lands on a rate somebody really granted: a **$1** item and a **100%** discount. That is
  //    a real pairing — a tree given away at 100% off, and a $1 line item.
  const flat = findingFor([rate(100, 1, 650)], [item('9', 'Flat $1', { unitPrice: -1 })]);
  ok(flat?.population.matched === 1,
    '🔴 a −$1 FLAT item does NOT publish a 100% rate, so the 100%-off discount is still correctly ' +
    'reported as unnamed. Without the `< 1` guard it would be "named" by a dollar amount');
  ok(findingFor([rate(100, 1, 650)], [item('9', 'Half', { unitPrice: -0.5 })])?.population.matched === 1,
    'and a genuine 50% item does not name a 100% rate either — the negative control on the same fixture');
  ok(findingFor([rate(50, 1, 650)], [item('9', 'Half', { unitPrice: -0.5 })])?.population.matched === 0,
    '…while a −0.5 item DOES name a 50% rate, so the guard is not simply refusing everything');

  // ⑥ NEGATIVE CONTROL — the rule can return NOTHING AT ALL, not merely zero.
  ok(findingFor([], [CD10]) === undefined || findingFor([], [CD10])?.measured === false,
    'a business with no discount lines at all is not measured — absent is not the same as clean');
}

// ══ §P 🔴 THE FIVE PROPERTIES — VERSION · ROWS · WINDOW · BLOCKS · CLEAN ═══════════════════
//
// These are what make a SECOND run of this review mean anything. Without them the review is a
// snapshot that can only be read, never compared — and *"33 last month, 13 today"* is the single
// number that proves this product does something. Each one is probed for the way it silently
// stops working, not for the way it works.
{
  const ids = BOOKS_RULES.map(r => r.id);
  ok(new Set(ids).size === ids.length,
    '🔴 EVERY RULE ID IS UNIQUE. Two rules sharing an id makes `(rule_id, rule_version)` ambiguous, and a stored comparison across it silently pairs the wrong two results');
  ok(BOOKS_RULES.every(r => Number.isInteger(r.version) && r.version >= 1),
    'and every rule declares a whole version — a rule with no version cannot be compared across runs at all');
  // 🔴 AND THE VERSION REACHES THE FINDING, ASSERTED BY VALUE. Mutant N19 dropped it to 0 on the
  // way out and every other assertion here passed — the rules had versions, the findings did not,
  // and a stored result would have been keyed to a question nobody could identify.
  {
    const versions = new Map(BOOKS_RULES.map(r => [r.id, r.version]));
    const all = evaluateBooks({ items: [], customers: CUSTOMERS, invoices: [] });
    ok(all.length > 0 && all.every(f => f.version === versions.get(f.id)),
      '🔴 EVERY FINDING CARRIES ITS OWN RULE\'S VERSION, not a constant and not a zero. `(rule_id, rule_version)` is the comparison key, and a run stored under the wrong half of it can never be paired with anything');
    ok(all.every(f => f.version >= 1),
      'and no finding leaves with version 0 — a value no rule declares, which is what a dropped field looks like');
  }

  const fs = evaluateBooks({
    customers: CUSTOMERS,
    items: [item('1', 'Tree 15 gal', { unitPrice: 10 })],
    invoices: [inv('i1', '1', [line('1', 'Tree 15 gal', 10, 10)], { txnDate: '2025-04-30' }),
               inv('i2', '2', [line('1', 'Tree 15 gal', 10, 10)], { txnDate: '2026-09-03', customerId: 'c2' })],
  });

  // ── WINDOW: computed from the walk, never typed ──
  const sold = find(fs, 'never-sold');
  ok(sold?.window?.from === '2025-04-30' && sold.window.to === '2026-09-03',
    '🔴 THE WINDOW IS THE WALK\'S OWN EXTENT — the earliest and latest transaction dates actually present. Not the read date, not a range somebody wrote down, and not today');
  const custDup = find(fs, 'customer-types-nothing-uses');
  ok(custDup?.window === null,
    'and a rule that never reads the invoice walk carries NO window — a duplicate customer is a duplicate whatever the dates say, and putting a period on it implies the finding expires');
  const unrunnable = find(evaluateBooks({ invoices: [inv('i1', '1', [line('1', 'T', 1, 1)], { txnDate: '2025-04-30' })] }), 'never-sold');
  ok(unrunnable?.measured === false && unrunnable.window?.from === '2025-04-30',
    '🔴 AND A RULE THAT COULD NOT RUN STILL CARRIES THE WINDOW. "We could not work this out" is also a statement about a period, and a reader deserves to know which one');
  ok(evaluateBooks({ invoices: [] }).every(f => f.window === null),
    'an invoice walk with no dated rows produces no window at all rather than a fabricated one');

  // ── the wording that the window exists to police ──
  const noPurchase = find(evaluateBooks({
    customers: { ...CUSTOMERS, total: 3 },
    invoices: [inv('i1', '1', [line('1', 'T', 1, 1)], { customerId: 'c1' })],
  }), 'customers-with-no-purchase-in-the-period');
  ok(/period we read/.test(noPurchase?.sentence ?? '')
     && /not the same as never having bought/.test(noPurchase?.sentence ?? '')
     && !/have never bought|never bought from you/.test(noPurchase?.sentence ?? ''),
    '🔴 THE SENTENCE SAYS "IN THE PERIOD WE READ" AND NEVER "NEVER BOUGHT". A customer who bought the month before the window opened is indistinguishable here from one who never bought, and only one of those two claims is true');

  // ── ROWS: capped by the runner, and the cap declares itself ──
  const many = Array.from({ length: FINDING_ROW_LIMIT + 40 }, (_, i) =>
    cust(`c${i}`, 'Same Person'));            // one enormous name-axis cluster
  const capped = find(evaluateBooks({ customers: { ...CUSTOMERS, total: many.length }, customerRows: many }),
                      'customers-entered-more-than-once');
  ok((capped?.rows?.length ?? 0) === FINDING_ROW_LIMIT,
    '🔴 THE ROW CAP IS ENFORCED BY THE RUNNER, NOT BY THE RULE. A limit that lives in the caller is a limit one future caller forgets, and the failure mode is 1,900 real people painted onto a screen');
  ok(capped?.rowsTotal === many.length,
    '🔴 AND WHAT THE CAP REMOVED STAYS VISIBLE. A truncated list presented as a whole one is the invoice-grid defect — "nothing found" for a record that exists — arriving on a different screen');
  ok(find(fs, 'income-accounts-in-use')?.rows === null,
    'a rule with no records worth looking at returns null rather than an empty array — "there are none to show" and "we did not collect any" are different answers');
}

// ══ §Q 🔴 GIVEN AWAY, AND RECORDED MORE THAN ONE WAY ══════════════════════════════════════
//
// The finding is not that they give trees away — that is a policy. It is that the SAME decision is
// written down three different ways, so no report anybody runs can ever total it.
{
  const items = [
    item('w', 'WARRANTY',        { unitPrice: 0,   purchaseCost: null }),
    item('t', 'Lacey Oak 45',    { unitPrice: 1250, purchaseCost: 400 }),
    item('c', 'BPJ30REP',        { unitPrice: 900,  purchaseCost: 300 }),
  ];
  const free = (id: string, name: string, replacementWording: boolean) =>
    ({ ...line(id, name, 0, 0), replacementInDescription: replacementWording });
  const invoices = [
    inv('i1', '1', [line('t', 'Lacey Oak 45', 1250, 1250), free('w', 'WARRANTY', false)], { txnDate: '2025-04-30' }),
    inv('i2', '2', [free('t', 'Lacey Oak 45', true)],  { txnDate: '2026-01-05' }),   // wording only
    inv('i3', '3', [free('c', 'BPJ30REP', false)],     { txnDate: '2026-07-23' }),   // nothing says it
  ];
  const f = find(evaluateBooks({ items, invoices }), 'given-away-and-recorded-more-than-one-way');
  ok(f?.population.matched === 3,
    'the three $0 lines are counted, and the paid line is not');
  ok(f?.population.of === 4,
    '🔴 THE DENOMINATOR IS EVERY INVOICE LINE. The first draft returned `of: 1` so the clean sentence would render — which would have let an invoice walk with NO LINES AT ALL report "nothing was given away", a pass over an empty set');
  ok(/3 different ways/.test(f?.sentence ?? ''),
    '🔴 AND THE COUNT OF WAYS IS THE FINDING. One way is a policy; three ways is why nothing can add them up');
  ok(/no report you or your accountant can run will ever add them up/.test(f?.sentence ?? ''),
    'the sentence says what the disorder COSTS her, in a sentence an owner would say');
  ok(f?.value === null && /cannot tell you what that cost you/.test(f?.sentence ?? ''),
    '🔴 IT REFUSES TO PUT A NUMBER ON IT. One line uses an item with no recorded cost, so no total is stated — a partial cost total is not a smaller truth, it is a different number wearing the same label');
  ok(!/1,?250|2,?150/.test(f?.sentence ?? ''),
    '🔴 AND THE RETAIL TOTAL NEVER REACHES THE PAGE. Valuing a warranty replacement at its selling price overstates it by the whole markup — the overstatement Lauren already caught once');
  ok(/could not read at all/.test(f?.sentence ?? '') && /fifth way/.test(f?.sentence ?? ''),
    '🔴 THE LINE NOTHING EXPLAINS IS NAMED, NOT DROPPED. A $0 line whose item code says nothing and whose wording says nothing is exactly where a fourth or fifth way of recording this would hide, and the sentence asks for it');

  // cost is stated only when EVERY line's item carries one
  const costed = [item('w', 'WARRANTY tree', { unitPrice: 500, purchaseCost: 150 })];
  const costedInv = [inv('i1', '1', [{ ...line('w', 'WARRANTY tree', 0, 0), replacementInDescription: false }], { txnDate: '2026-01-01' })];
  const g = find(evaluateBooks({ items: costed, invoices: costedInv }), 'given-away-and-recorded-more-than-one-way');
  ok(g?.value === 150 && /\$150/.test(g?.sentence ?? '') && /your cost, not what you would have sold them for/.test(g?.sentence ?? ''),
    '🔴 WITH FULL COST COVERAGE IT STATES THE COST AND SAYS WHICH FIGURE IT IS. $150, not the $500 it would have sold for');

  // negative control: nothing free at all is a CLEAN finding, not a silence
  const clean = find(evaluateBooks({
    items: [item('t', 'Tree', { unitPrice: 10, purchaseCost: 3 })],
    invoices: [inv('i1', '1', [line('t', 'Tree', 10, 10)])],
  }), 'given-away-and-recorded-more-than-one-way');
  ok(clean?.measured === true && clean.clean === true && /Nothing in your invoice history was charged at zero/.test(clean.sentence),
    '🔴 A BUSINESS THAT GIVES NOTHING AWAY GETS A CLEAN RESULT SAID OUT LOUD, not a silence. On a page about what a business cannot measure, an absent line reads as "we did not look"');
}

// ══ §R 🔴 THE SAME DOCUMENT TWICE — FOUR FIELDS, NOT ONE ══════════════════════════════════
{
  const L = [line('1', 'Tree', 100, 100)];
  // 🔴 THREE RENUMBERED RECORDS AGAINST A PAIR OF REAL ONES, AND THE ASYMMETRY IS DELIBERATE.
  // A first draft used two of each: the real finding was 2 records and the renumbered group was
  // also 2, so a rule that reported `repeatedNumberGroups * 2` gave the same answer as the correct
  // one and mutant N12 survived. Any fixture where the two arithmetics agree is a fixture that
  // asserts nothing about which one is running.
  const invoices = [
    // Same customer, same day, same lines, same total — DIFFERENT numbers. A real finding.
    inv('a1', '5120', L, { txnDate: '2025-10-01', totalAmt: 100 }),
    inv('a2', '5121', L, { txnDate: '2025-10-01', totalAmt: 100 }),
    // SAME NUMBER, different totals — the renumbering. Must NOT be reported. THREE of them.
    inv('b1', '4000', L, { txnDate: '2025-11-01', totalAmt: 100, customerId: 'c9' }),
    inv('b2', '4000', [line('1', 'Tree', 250, 250)], { txnDate: '2025-11-02', totalAmt: 250, customerId: 'c9' }),
    inv('b3', '4001', [line('1', 'Tree', 300, 300)], { txnDate: '2025-11-03', totalAmt: 300, customerId: 'c9' }),
    inv('b4', '4001', [line('1', 'Tree', 400, 400)], { txnDate: '2025-11-04', totalAmt: 400, customerId: 'c9' }),
    inv('b5', '4002', [line('1', 'Tree', 500, 500)], { txnDate: '2025-11-05', totalAmt: 500, customerId: 'c9' }),
    inv('b6', '4002', [line('1', 'Tree', 600, 600)], { txnDate: '2025-11-06', totalAmt: 600, customerId: 'c9' }),
  ];
  const f = find(evaluateBooks({ invoices }), 'same-document-recorded-twice');
  ok(f?.population.matched === 2,
    '🔴 ONLY THE PAIR WHERE ALL FOUR AGREE IS REPORTED — customer, date, line items, total. The reused NUMBER is not a finding');
  ok(f?.rows?.length === 2 && f.rows.every(r => /Invoice 512/.test(r.label)),
    'and the rows carry the invoice NUMBER, which is what lets an owner find the record — and no customer, in any form (R-77)');
  ok(/3 invoice numbers are used more than once/.test(f?.sentence ?? '')
     && /not one of those pairs charges the same amount/.test(f?.sentence ?? ''),
    '🔴 THE RETIRED QUESTION IS ANSWERED OUT LOUD RATHER THAN SILENTLY DROPPED. A reader shown "44 invoices share a number" last month would otherwise conclude we stopped looking — and WHY we stopped is the useful half');
  ok(!f?.rows?.some(r => /4000/.test(r.label)),
    'the renumbered pair reaches no row');

  // a difference in ONE of the four is enough to say nothing
  const oneOff = [inv('a1', '1', L, { txnDate: '2025-10-01', totalAmt: 100 }),
                  inv('a2', '2', L, { txnDate: '2025-10-02', totalAmt: 100 })];
  const g = find(evaluateBooks({ invoices: oneOff }), 'same-document-recorded-twice');
  ok(g?.clean === true && /No two invoices/.test(g?.sentence ?? ''),
    '🔴 A DIFFERENT DAY IS ENOUGH TO REPORT NOTHING — and reporting nothing is said out loud, because a clean result here is the finding that the old rule was noise');

  // an invoice with no customer or no date cannot be compared, and says so
  const partial = [inv('a1', '1', L, { customerId: null }), inv('a2', '2', L, { txnDate: null })];
  const h = find(evaluateBooks({ invoices: partial }), 'same-document-recorded-twice');
  ok(h?.measured === false,
    'and when NOTHING is comparable the rule reports itself uncomputed rather than clean — "we could not look" is not "we found nothing"');
}

// ══ §S 🔴 A COLLECTION IS NOT A MISSING DELIVERY DATE ═════════════════════════════════════
{
  const carriage = { ...line('d', 'Delivery', 125, 125), itemAccountName: 'Delivery Income' };
  const planted  = { ...line('t', 'Tree', 900, 900), installInDescription: true };
  const bare     = line('t', 'Tree', 900, 900);
  const invoices = [
    inv('i1', '1', [bare],     { totalAmt: 900 }),   // collected, no date  → NOT a gap
    inv('i2', '2', [carriage], { totalAmt: 125 }),   // delivered, no date  → the finding
    inv('i3', '3', [planted],  { totalAmt: 900 }),   // planted,   no date  → the finding
    inv('i4', '4', [carriage], { totalAmt: 125 }),   // delivered, HAS date
  ];
  const shipDates = new Map<string, string | null>([
    ['i1', null], ['i2', null], ['i3', null], ['i4', '2026-01-02'],
  ]);
  const f = find(evaluateBooks({ invoices, shipDates }), 'dispatched-with-no-date');
  ok(f?.population.matched === 2,
    '🔴 ONLY THE TWO THAT LEFT THE YARD ARE THE FINDING. The old rule counted all three and told an owner that most of her history was broken when it was right');
  ok(/is an order nobody delivered/.test(f?.sentence ?? '') && /\$900/.test(f?.sentence ?? ''),
    'and the collections are named, with what they are worth, so "most of your history is fine" carries a figure');
  ok(/no delivery charge, no planting/.test(f?.sentence ?? ''),
    '🔴 THE PREDICATE IS IN THE SENTENCE. The whole finding is the separation; a reader who cannot see how the two were told apart has a number to trust rather than one to check');
  ok(/That is at least/.test(f?.sentence ?? ''),
    'and it declares the one direction it can be wrong in — a delivery made as a favour, nothing charged, reads here as a collection');
  // ⚠️ A `|| true` ASSERTION STOOD HERE AND IS DELETED RATHER THAN REPAIRED. It read
  //    `ok(x === false || true, …)` and could not fail under any input — §6 r19 in its purest
  //    form, written by the same hand that was writing the rule it was meant to guard. The two
  //    money figures ARE asserted, separately and by value, in the clauses above and below.

  // 🔴 THE PLANTED LINE IS THE SECOND CLAUSE AND IT IS NOT REDUNDANT — these books weld the
  // planting into the tree's price, so 909 planted lines carry no carriage line at all.
  const plantedOnly = find(evaluateBooks({
    invoices: [inv('i3', '3', [planted], { totalAmt: 900 })],
    shipDates: new Map<string, string | null>([['i3', null]]),
  }), 'dispatched-with-no-date');
  ok(plantedOnly?.population.matched === 1,
    '🔴 A PLANTED TREE LEFT THE YARD EVEN WITH NO DELIVERY CHARGE ON THE INVOICE. Reading only the carriage account would call every one of them a collection');

  // an invoice the dispatch walk never covered is EXCLUDED, not counted as undated
  const uncovered = find(evaluateBooks({
    invoices: [inv('i1', '1', [carriage]), inv('i9', '9', [carriage])],
    shipDates: new Map<string, string | null>([['i1', null]]),
  }), 'dispatched-with-no-date');
  ok(uncovered?.population.of === 1,
    'an invoice outside the dispatch walk is not in the denominator — "we did not look" and "there is nothing there" are the two answers a reader cannot tell apart');
}

// ══ §T 🔴 THE 33 UNREADABLE SIZES ARE 15 ══════════════════════════════════════════════════
//
// A discount has no size. Neither does a trip charge or a refund. Reporting all of them together
// makes the one number that proves this product works impossible to produce, because the count can
// never fall to zero.
{
  const STOCK = 'Sales of Nursery Stock';
  const items = [
    // 🔴 EVERY NON-PRODUCT HERE CARRIES AN UNREADABLE SIZE TOO, AND THAT IS THE POINT OF THE
    // FIXTURE. A first draft used rows whose sizes were simply absent, so the split "passed" while
    // the product count was ZERO — a probe that never reached the thing it was written to defend
    // (#182). `45 Grade` is the real shape: something size-SHAPED where a size sits.
    item('p1', 'AP47',  { type: 'NonInventory', incomeAccount: STOCK, description: 'Afgan Black Pine, 45 Grade', unitPrice: 400 }),
    item('p2', 'AP46',  { type: 'NonInventory', incomeAccount: STOCK, description: 'Afgan Black Pine, 45 Gallon', unitPrice: 400 }),
    item('s1', 'TC',    { type: 'Service', incomeAccount: 'Delivery Income', description: 'Trip Charge, 2 Grade', unitPrice: 125 }),
    item('d1', 'CD10%', { type: 'Service', incomeAccount: 'Discounts given', description: 'Contractor Discount, 10%', unitPrice: -0.1 }),
    item('n1', 'Refund',{ type: 'Service', incomeAccount: 'Refund', description: 'Overpayment Refund, 3 Grade', unitPrice: 0 }),
  ];
  const f = find(evaluateBooks({ items }), 'sizes-we-could-not-read');
  ok(f?.population.matched === 1,
    '🔴 ONE PRODUCT IS REPORTED, OUT OF FOUR ROWS THAT ALL CARRY AN UNREADABLE SIZE. Without this the split could report zero and every other assertion here would still pass');
  ok(f?.population.of === 2,
    '🔴 THE DENOMINATOR IS THE PRODUCTS. A discount, a trip charge and a refund are not rows a size can be fixed on, and leaving them in means the count never reaches zero and the owner concludes the tool is broken');
  ok(/not counted above/.test(f?.sentence ?? '') && /a discount has no size/.test(f?.sentence ?? ''),
    '🔴 AND THE OTHERS ARE NAMED AS NOT-APPLICABLE WITH THE REASON, not silently dropped. A number that shrank with no explanation is a number nobody trusts');
  ok(/There is nothing to fix on/.test(f?.sentence ?? ''),
    'the sentence says outright that those rows need no work');
}

// ══ §U 🔴 TWO ROWS ON ONE SHELF — THE SAME RULE THE GRID MARKS WITH ═══════════════════════
{
  const items = [
    item('1', 'Lacey Oak 45G',      { unitPrice: 375,  description: 'Lacey Oak, 45 Gallon' }),
    item('2', 'Lacey Oak 45',       { unitPrice: 1250, description: 'Lacey Oak, 45 gallon' }),
    item('3', 'Cedar Elm 15 Gallon',{ unitPrice: 200,  description: 'Cedar Elm, 15 Gallon' }),
  ];
  const f = find(evaluateBooks({ items }), 'products-that-share-a-shelf');
  ok(f?.population.matched === 2,
    '🔴 `45G` AND `45 gallon` ARE ONE SHELF. The parsed size, not the size text — a key over the raw string misses exactly the pairs that have a spelling difference AND a price gap, which is the combination that costs money');
  ok(/\$875 apart/.test(f?.sentence ?? ''),
    'and the widest price gap is named, because "$875" is a reason to look and "two duplicates" is not');
  ok(f?.value === null,
    '🔴 THE GAP IS NOT A MONEY-AT-STAKE FIGURE. It is the difference between two prices; rendering it as "$875 at stake" would put a number on the page that nobody lost');
  const cleanItems = [item('1', 'Lacey Oak 45G', { unitPrice: 375, description: 'Lacey Oak, 45 Gallon' })];
  ok(find(evaluateBooks({ items: cleanItems }), 'products-that-share-a-shelf')?.clean === true,
    'and a catalogue with no collisions says so out loud');
}

console.log(`\n  booksFindings — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
