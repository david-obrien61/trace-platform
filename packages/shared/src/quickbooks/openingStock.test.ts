/**
 * ── openingStock — the starting number, and the three ways it could lie ───────────────────
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST. Not the median — a sort and an index. What is under test is
 * whether a PLACEHOLDER can be mistaken for a COUNT, and there are exactly four ways it can:
 *   §A  the rate is computed over a denominator that makes it look smaller than it is
 *   §B  a business with no sales history gets a suggestion anyway, and it looks measured
 *   §C  the cap can be walked past, so the seed stops ever running out and nobody ever counts
 *   §D  the seed overwrites a REAL number — a lot that already holds stock, or one whose zero
 *       was measured (it sold out) rather than unknown
 * Every one of those produces a fuller, more confident, more useful-looking screen than the
 * truth, which is why none would be noticed by looking at it.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/openingStock.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  measureOpeningStock, suggestOpeningStock, seedRefusal, planOpeningStockSeed,
  SEED_CAP, SEED_MIN, SEED_LEDGER_KIND,
} from './openingStock';
import type { SeedCandidate } from './openingStock';
import type { QboInvoiceRow, QboInvoiceLine } from './invoiceList';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

// ── fixtures ─────────────────────────────────────────────────────────────────
const line = (o: Partial<QboInvoiceLine> = {}): QboInvoiceLine => ({
  detailType: 'SalesItemLineDetail', itemId: 'i1', itemName: 'Shumard Oak 45',
  qty: 1, amount: 100, unitPrice: 100,
  discountInDescription: false, percentBased: null, discountPercent: null,
  installInDescription: false, itemAccountName: 'Sales of Nursery Stock',
  sizeFromDescription: null, ...o,
});
const inv = (txnDate: string | null, lines: QboInvoiceLine[]): QboInvoiceRow => ({
  id: `inv-${txnDate ?? 'none'}-${Math.random().toString(36).slice(2, 8)}`,
  docNumber: null, txnDate, totalAmt: 100, balance: 0, dueDate: null,
  customerId: 'c1', lines,
});

console.log('\n── §A  THE RATE, AND ITS DENOMINATOR ──────────────────────────────────────');

// One item, 12 units, sold across Jan..Apr (4 months inclusive) → 3 a month.
{
  const m = measureOpeningStock([
    inv('2025-01-15', [line({ qty: 3 })]),
    inv('2025-02-15', [line({ qty: 3 })]),
    inv('2025-03-15', [line({ qty: 3 })]),
    inv('2025-04-15', [line({ qty: 3 })]),
  ]);
  ok(m !== null, 'A1  four dated invoices with priced goods lines produce a measurement');
  ok(m?.median === 3, `A1b 12 units over 4 months is 3 a month, not ${m?.median}`);
  ok(m?.months === 4, 'A1c the business-wide window is 4 months, inclusive of both ends');
  ok(m?.items === 1, 'A1d one distinct item');
}

// 🔴 THE DENOMINATOR DEFECT. An item first sold in the LAST month has ONE month of history, not
// the business's whole fourteen. Dividing by the whole window reports it moving a fraction of
// what it moves, and the median drifts down with every product the business ever adds.
{
  const m = measureOpeningStock([
    inv('2025-01-15', [line({ itemId: 'old', qty: 1 })]),
    inv('2025-12-15', [line({ itemId: 'old', qty: 1 })]),
    inv('2025-12-20', [line({ itemId: 'new', qty: 10 })]),
  ]);
  ok(m!.months === 12, 'A2  the business window is 12 months');
  // 🔴 THE DISCRIMINATOR. Under the WRONG (whole-window) denominator the new item reads
  // 10 ÷ 12 = 0.83 and the old one 2 ÷ 12 = 0.17, so the median would be about 0.5. Under the
  // correct per-item denominator it is (10 + 0.17) ÷ 2 ≈ 5.1. The two answers are an order of
  // magnitude apart, which is the point: a probe that could not tell them apart would pass on
  // the defect (§6 r19).
  ok(m!.median > 4, `A2b 🔴 THE NEW ITEM MOVES 10 A MONTH, NOT 0.83 — its window starts at ITS OWN first sale, not the company's. A whole-window denominator would put this median near 0.5; got ${m!.median}`);
  ok(m!.p75 > 7, `A2c and the busier quarter reflects it (got ${m!.p75})`);
}

// An undated invoice contributes to no month and is not an error, a zero, or a silent drop.
{
  const m = measureOpeningStock([
    inv('2025-01-15', [line({ qty: 4 })]),
    inv(null,         [line({ qty: 400 })]),
  ]);
  ok(m?.median === 4, `A3  an undated invoice carries no timing and cannot move a RATE (got ${m?.median})`);
}

// The goods filter: a discount line, a description-only note and a subtotal are not sales.
{
  const m = measureOpeningStock([
    inv('2025-01-15', [
      line({ qty: 2 }),
      line({ detailType: 'DiscountLineDetail', itemId: 'disc', itemName: 'CD10%', qty: 1, amount: -50, unitPrice: null }),
      line({ detailType: 'DescriptionOnly', itemId: null, itemName: null, qty: 99, amount: 0, unitPrice: null }),
    ]),
  ]);
  ok(m?.items === 1, `A4  only the goods line counts — a discount and a note are not sales (got ${m?.items} items)`);
}

// A goods line naming no item is COUNTED and REPORTED, never silently dropped.
{
  const m = measureOpeningStock([
    inv('2025-01-15', [line({ qty: 2 }), line({ itemId: null, qty: 7 })]),
  ]);
  ok(m?.unattributableLines === 1, `A5  a priced line with no itemId is reported as unattributable (got ${m?.unattributableLines})`);
  ok(m?.items === 1, 'A5b and is not counted as an item');
}

// 🔴 ITEMS ARE KEYED ON id, NEVER ON NAME — R-40's reasoning. Two products can share a
// description, and merging them averages two different things with nothing looking wrong.
{
  const m = measureOpeningStock([
    inv('2025-01-15', [line({ itemId: 'a', itemName: 'Hand Tie Tape', qty: 2 })]),
    inv('2025-01-16', [line({ itemId: 'b', itemName: 'Hand Tie Tape', qty: 40 })]),
  ]);
  ok(m?.items === 2, `A6  two ids sharing one name are TWO products (got ${m?.items})`);
}

// The spread is reported, because a median with no spread hides a long tail.
{
  const m = measureOpeningStock([
    inv('2025-01-15', [line({ itemId: 'a', qty: 1 }), line({ itemId: 'b', qty: 5 }),
                       line({ itemId: 'c', qty: 9 }), line({ itemId: 'd', qty: 100 })]),
  ]);
  ok(m!.p25 < m!.median && m!.median < m!.p75, `A7  p25 < median < p75 on a spread catalogue (${m!.p25}/${m!.median}/${m!.p75})`);
}

console.log('── §B  NO HISTORY IS AN ANSWER, NOT A FAILURE ────────────────────────────');

ok(measureOpeningStock([]) === null, 'B1  🔴 no invoices at all → null. NOT zero, NOT a default: "we did not look" is a different answer from "nothing moves"');
ok(measureOpeningStock([inv(null, [line({ qty: 5 })])]) === null, 'B2  invoices with no readable date → null (a rate needs a month)');
ok(measureOpeningStock([inv('2025-01-15', [])]) === null, 'B3  dated invoices with no goods lines → null');
ok(measureOpeningStock([inv('2025-01-15', [line({ qty: 0 })])]) === null, 'B4  a goods line with no quantity states a charge, not a count → null');
ok(suggestOpeningStock(null) === null, 'B5  🔴 NO MEASUREMENT PRODUCES NO SUGGESTION. A suggestion invented from nothing is the one thing that would look measured and not be');

console.log('── §C  THE CAP, AND WHY IT IS THE MECHANISM ──────────────────────────────');

ok(seedRefusal(SEED_CAP) === null, `C1  ${SEED_CAP} is allowed`);
ok(seedRefusal(SEED_CAP + 1) !== null, `C2  🔴 ${SEED_CAP + 1} IS REFUSED. With no ceiling somebody types 500 to stop the blocking — and then nothing ever blocks, nobody ever counts, and the placeholder becomes the permanent answer`);
ok(seedRefusal(500) !== null, 'C2b 500 — the number the ruling names — is refused');
ok((seedRefusal(SEED_CAP + 1) ?? '').includes('count'), 'C2c and the refusal gives the REASON, not just a limit');
ok(seedRefusal(0) !== null, 'C3  zero is refused — it is the state they are already in, written down');
ok(seedRefusal(-4) !== null, 'C4  a negative is refused');
ok(seedRefusal(2.5) !== null, 'C5  a fraction is refused — units are whole things');
ok(seedRefusal(SEED_MIN) === null, `C6  ${SEED_MIN} is allowed`);
ok(planOpeningStockSeed([{ id: 'l1', name: 'Oak', qty: 0, hasHistory: false }], 999, 'live').ok === false,
   'C7  🔴 THE PLAN REFUSES TOO, not only the input box. A cap enforced in one place is a cap enforced nowhere');

// The suggestion is LOW by construction, and never above the cap however busy the business.
{
  const busy = measureOpeningStock([inv('2025-01-15', [line({ qty: 4000 })])]);
  ok(suggestOpeningStock(busy) === SEED_CAP, `C8  a business moving 4,000 a month is still capped at ${SEED_CAP}`);
  const quiet = measureOpeningStock([
    inv('2025-01-15', [line({ qty: 1 })]), inv('2025-12-15', [line({ qty: 1 })]),
  ]);
  ok(suggestOpeningStock(quiet) === SEED_MIN, 'C9  a catalogue that barely moves floors at 1, never 0');
}

console.log('── §D  THE SEED NEVER OVERWRITES A REAL NUMBER ───────────────────────────');

{
  const cands: SeedCandidate[] = [
    { id: 'empty',   name: 'Shumard Oak 45', qty: 0,  hasHistory: false },
    { id: 'stocked', name: 'Cedar Elm 30',   qty: 12, hasHistory: false },
    { id: 'soldout', name: 'Vitex 15',       qty: 0,  hasHistory: true  },
  ];
  const plan = planOpeningStockSeed(cands, 5, 'live');
  ok(plan.ok === true, 'D1  a mixed catalogue produces a plan');
  if (plan.ok) {
    ok(plan.steps.length === 1 && plan.steps[0].lotId === 'empty',
       `D2  🔴 ONLY THE UNTOUCHED, EMPTY LOT IS SEEDED (got ${plan.steps.map(s => s.lotId).join(',')})`);
    ok(plan.skipped.withStock === 1,
       'D3  a lot already holding stock is SKIPPED — seeding it would overwrite a real number with a placeholder');
    ok(plan.skipped.withHistory === 1,
       'D4  🔴 A LOT WITH LEDGER HISTORY IS SKIPPED. Its zero was MEASURED — it sold out — and replacing a measured zero with a placeholder erases the only true quantity on the row');
    ok(plan.skipped.withStock + plan.skipped.withHistory === 2,
       'D5  and both exclusions are COUNTED, so the screen can say why 1 of 3 was touched instead of quietly doing 1 of 3');
    ok(plan.steps[0].kind === SEED_LEDGER_KIND,
       'D6  🔴 THE STEP WRITES ITS OWN LEDGER KIND, never opening_balance — an opening_balance asserts a position the business KNEW');
    ok(plan.steps[0].newQty === 5,
       'D7  the step carries an ABSOLUTE target qty — both RPCs derive their own delta under a lock');
    ok(plan.steps[0].reason.length > 0,
       'D8  and a reason, written at the moment of the choice (D-50: a reason cannot be backfilled)');
  }
}

{
  const none = planOpeningStockSeed([{ id: 'x', name: 'X', qty: 3, hasHistory: false }], 5, 'live');
  ok(none.ok === false, 'D9  nothing to seed is a refusal with a sentence, not an empty success');
}

// NEGATIVE CONTROL — changing the POPULATION, not the subject (tech-debt #182's own prescription).
// If §D's assertions passed because the planner returns everything regardless, this catches it.
{
  const all = planOpeningStockSeed([
    { id: 'a', name: 'A', qty: 0, hasHistory: false },
    { id: 'b', name: 'B', qty: 0, hasHistory: false },
  ], 5, 'live');
  ok(all.ok === true && all.steps.length === 2,
     'D10 NEGATIVE CONTROL — two genuinely empty lots produce TWO steps, so §D2 measured a filter and not an empty planner');
}

console.log('── §E  THE MEASUREMENT AND THE SUGGESTION AGREE ──────────────────────────');

// atOrBelowSuggestion is computed inside the measurement from an inline copy of the suggestion
// formula. If the two ever drift, this is what says so (§6 r8).
{
  const m = measureOpeningStock([
    inv('2025-01-15', [line({ itemId: 'a', qty: 1 }), line({ itemId: 'b', qty: 2 }),
                       line({ itemId: 'c', qty: 3 }), line({ itemId: 'd', qty: 40 })]),
  ]);
  const s = suggestOpeningStock(m)!;
  const expected = [1, 2, 3, 40].filter(r => r <= s).length;
  ok(m!.atOrBelowSuggestion === expected,
     `E1  the measurement's own at-or-below count agrees with suggestOpeningStock (${m!.atOrBelowSuggestion} vs ${expected})`);
  ok(m!.atOrBelowSuggestion <= m!.items, 'E2  and it can never exceed the population');
}


// ── §J · #352 — A STARTING NUMBER GOES TO THINGS YOU SELL, AND TO NOTHING ELSE ───────────────
// Twice in a row a reload seeded trip charges, labour, discounts and bookkeeping lines at 10,
// and twice a hand-written migration took it back off. These probes are the reason it cannot
// happen a third time. The rule is the Services review's own: INCOME ACCOUNT FIRST, TYPE SECOND.
{
  const tree = (o: Partial<SeedCandidate>): SeedCandidate => ({
    id: 't', name: 'Shumard Red Oak 45', qty: 0, hasHistory: false, imported: true,
    qbType: 'NonInventory', qbIncomeAccount: 'Sales of Nursery Stock', description: null, sellPrice: 500, ...o,
  });
  const plan = planOpeningStockSeed([
    tree({ id: 'tree' }),
    // A real plant that QuickBooks types as a Service — 91 of LAWNS's 134 Service rows are these.
    tree({ id: 'service-typed-tree', name: 'Little Gem Magnolia 45', qbType: 'Service' }),
    tree({ id: 'trip',   name: 'Trip Charge',        qbType: 'Service', qbIncomeAccount: 'Landscaping/Installation Services', sellPrice: 50 }),
    tree({ id: 'labour', name: 'Labor Hours',        qbType: 'Service', qbIncomeAccount: 'Landscaping/Installation Services', sellPrice: 25 }),
    tree({ id: 'disc',   name: 'Family Discount',    qbType: 'Service', qbIncomeAccount: 'Discounts given', sellPrice: -0.1 }),
    tree({ id: 'book',   name: 'Bank Deposit/Customer Overpayment Refund', qbType: 'Service', qbIncomeAccount: 'Refunds', sellPrice: 0 }),
    tree({ id: 'growing', name: 'Dynamite Crape Myrtle (UNDER PRODUCTION) - 3 Gallon', sellPrice: 1.95 }),
  ], 10, 'test');
  ok(plan.ok === true, 'J1  the plan is produced');
  if (plan.ok) {
    const ids = plan.steps.map(s => s.lotId).sort().join(',');
    ok(ids === 'service-typed-tree,tree',
       `J2  🔴 ONLY THE TWO REAL PLANTS ARE SEEDED (got ${ids || '(none)'})`);
    ok(plan.skipped.notAProduct === 4,
       `J3  the trip charge, the labour, the discount and the bookkeeping row are ALL skipped (${plan.skipped.notAProduct})`);
    ok(plan.skipped.underProduction === 1,
       `J4  a row marked (UNDER PRODUCTION) is skipped — booked to Nursery Stock, so the account rule alone would have seeded it (${plan.skipped.underProduction})`);
    ok(plan.steps.some(s => s.lotId === 'service-typed-tree'),
       'J5  🔴 A TREE QUICKBOOKS CALLS A "Service" IS STILL SEEDED — type alone would withhold stock from 91 of LAWNS\'s plants, which is why the ACCOUNT leads');
  }
}
{
  // 🔴 THE GUARD THAT STOPS THE RULE EATING THE CATALOGUE. Every row imported before 20260920b
  // has NULL for both fields, and classifyDestination reads a missing account as "not a product".
  // Applied blind, the first run after this build would have seeded NOTHING.
  const noBooks: SeedCandidate[] = [
    { id: 'a', name: 'Cedar Elm 30', qty: 0, hasHistory: false, imported: true },
    { id: 'b', name: 'Vitex 15',     qty: 0, hasHistory: false, imported: true, qbType: null, qbIncomeAccount: '   ' },
  ];
  const plan = planOpeningStockSeed(noBooks, 10, 'test');
  ok(plan.ok === true && plan.ok && plan.steps.length === 2,
     `J6  🔴 WITH NO BOOKS DATA THE OLD BEHAVIOUR STANDS — silence is not evidence that a row is not a product (${plan.ok ? plan.steps.length : 'refused'} of 2)`);
  ok(plan.ok && plan.skipped.notAProduct === 0, 'J7  …and nothing is counted as excluded by a rule that never ran');
}
{
  // The marker is the owner's own convention in the NAME, so its spellings are what matter.
  const rows = (name: string): SeedCandidate[] => [{ id: 'x', name, qty: 0, hasHistory: false, imported: true }];
  for (const n of ['Tree (UNDER PRODUCTION) - 3 Gallon', 'Tree (under production)', 'Tree (Under  Production) ST']) {
    const plan = planOpeningStockSeed(rows(n), 10, 'test');
    ok(plan.ok === false || plan.steps.length === 0, `J8  "${n}" is recognised as still growing`);
  }
  const plan = planOpeningStockSeed(rows('Production Crape Myrtle 15'), 10, 'test');
  ok(plan.ok === true && plan.steps.length === 1,
     'J9  🔴 NEGATIVE CONTROL — a name merely containing "production" is NOT skipped, or the marker would eat real products');
}


// ── §K · DAVID'S TWO RULINGS OF 2026-09-22 ───────────────────────────────────────────────────
{
  const row = (o: Partial<SeedCandidate>): SeedCandidate => ({
    id: 'x', name: 'Thing', qty: 0, hasHistory: false, imported: true,
    qbType: 'Service', qbIncomeAccount: 'Sales of Product Income', description: null, sellPrice: 20, ...o,
  });
  const plan = planOpeningStockSeed([
    row({ id: 'compost', name: '30gal Bucket: Fertile Compost Mix' }),
    row({ id: 'bubbler', name: 'Tree Bubbler', sellPrice: 65 }),
    row({ id: 'staking', name: 'Tree Staking Kit', qbType: 'NonInventory', sellPrice: 40 }),
    // Still not stock: the account says work, not goods.
    row({ id: 'trip', name: 'Trip Charge', qbIncomeAccount: 'Landscaping/Installation Services', sellPrice: 50 }),
  ], 10, 'test');
  ok(plan.ok === true, 'K1  the plan is produced');
  if (plan.ok) {
    const ids = plan.steps.map(s => s.lotId).sort().join(',');
    ok(ids === 'bubbler,compost,staking',
       `K2  🔴 A GOODS ACCOUNT IS STOCK FOR THE SEED (David, 2026-09-22) — compost, bubblers and staking kits get a number even though the services review calls that account ambiguous (got ${ids || '(none)'})`);
    ok(plan.skipped.notAProduct === 1,
       `K3  …and the trip charge is still skipped: its account books WORK, which is not ambiguous at all (${plan.skipped.notAProduct})`);
  }
}
{
  // 🔴 THE OWNER'S OVERRIDE BEATS HER OWN BOOKS, because it is her correcting them.
  const tree = (o: Partial<SeedCandidate>): SeedCandidate => ({
    id: 't', name: 'Shumard Red Oak 45', qty: 0, hasHistory: false, imported: true,
    qbType: 'NonInventory', qbIncomeAccount: 'Sales of Nursery Stock', description: null, sellPrice: 500, ...o,
  });
  const plan = planOpeningStockSeed([
    tree({ id: 'real-tree' }),
    tree({ id: 'gift',    name: 'Gift Certificate', sellPrice: 0, notStockOverride: true }),
    tree({ id: 'deposit', name: 'Deposit',          sellPrice: 0, notStockOverride: true }),
  ], 10, 'test');
  ok(plan.ok === true && plan.ok && plan.steps.length === 1 && plan.steps[0].lotId === 'real-tree',
     'K4  🔴 A ROW THE OWNER MARKED "not stock" IS SKIPPED EVEN THOUGH HER BOOKS FILE IT UNDER NURSERY STOCK — the four LAWNS rows are misbooked, and the override is how she says so');
  ok(plan.ok && plan.skipped.markedNotStock === 2,
     `K5  …counted under their OWN reason, not folded into "not a product", so the screen can say which is which (${plan.ok ? plan.skipped.markedNotStock : 'n/a'})`);
  ok(plan.ok && plan.skipped.notAProduct === 0,
     'K6  🔴 NEGATIVE CONTROL — the books rule did not also claim them; one row is skipped once, for one stated reason');
}


{
  // 🔴 THE NAME MUST NOT BEAT THE ACCOUNT (David's rule, applied where it was being contradicted).
  const r = (o: Partial<SeedCandidate>): SeedCandidate => ({
    id: 'x', name: 'Thing', qty: 0, hasHistory: false, imported: true,
    qbType: 'NonInventory', qbIncomeAccount: 'Sales of Nursery Stock', description: null, sellPrice: 250, ...o,
  });
  const plan = planOpeningStockSeed([
    r({ id: 'dlo200', name: 'Discounted Live Oak', sellPrice: 200 }),
    r({ id: 'dlo300', name: 'Discounted Live Oak', sellPrice: 300 }),
    r({ id: 'family', name: 'Family Discount', sellPrice: -0.1 }),
    r({ id: 'freebie', name: 'Customer Discount', sellPrice: 0 }),
  ], 10, 'test');
  ok(plan.ok === true, 'K7  the plan is produced');
  if (plan.ok) {
    const ids = plan.steps.map(s => s.lotId).sort().join(',');
    ok(ids === 'dlo200,dlo300',
       `K8  🔴 THREE REAL TREES CALLED "Discounted Live Oak" ARE STOCK — $200–$300 booked to Sales of Nursery Stock; reading the NAME first would leave them at zero (got ${ids || '(none)'})`);
    ok(plan.skipped.notAProduct === 2,
       `K9  …and a REAL discount, priced 0 or below, is still skipped — the price is what tells them apart (${plan.skipped.notAProduct})`);
  }
}

console.log(`\n${passed} passed / ${failed} failed\n`);
if (failed > 0) process.exit(1);
