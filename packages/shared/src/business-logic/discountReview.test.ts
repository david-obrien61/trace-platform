/**
 * ── discountReview — the rate is a RATIO, the name comes from the price card, and the write ──
 *    must not delete the tax rate.
 *
 * 🔴 §A IS THE PROBE THAT SHOULD HAVE EXISTED AND DID NOT. It is David's own specification, and
 * this file is arranged around it: **a fixture where the amount and the correct percent differ by
 * exactly 100×.** A $50 discount on a $500 invoice is 10%; the shipped version printed `5000%`,
 * because it divided by `Qty` — which a comment in `invoiceList.ts` declared to be the dollar
 * base and which is, measured on all 21 of LAWNS's item lines, always **1**. The division did
 * nothing.
 *
 * ⚠️ AND HERE IS WHY 96 GREEN ASSERTIONS DID NOT CATCH IT. Every fixture in the previous version
 * called `disc(name, base, amount)` and passed the base **as Qty**, so the fixture and the code
 * shared the same false premise and agreed with each other perfectly. **The probes asserted the
 * assumption instead of testing it** — the failure this file's own header warned about, one field
 * over. Fixtures here put the base on OTHER LINES of the invoice, which is where it actually
 * lives, and no fixture may state a rate.
 *
 * The three things that can still hurt a real business, each with its own §:
 *   ① A NUMBER RENDERED AS A PERCENT THAT WAS NEVER A RATIO (§A, §B).
 *   ② A WRITE THAT DELETES THE SALES-TAX RATE (§J) — `mergePricingConfig` fails open, so an
 *      unreadable config must REFUSE rather than replace the record.
 *   ③ A SUGGESTION THE OWNER'S OWN EDITOR WOULD REJECT (§O).
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/discountReview.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { parseInvoiceList, summariseInvoices } from '../quickbooks/invoiceList';
import {
  buildDiscountReview, buildAcceptancePatch, suggestTypeName, itemPercentOf, isDiscountItem,
  REVIEW_REFUSALS, PERCENT_CEILING,
  type DiscountItemFact, type AcceptedTier,
} from './discountReview';
import { EMPTY_COST_CONFIG } from './CostToProduce';
import { normalizeDiscountTypes, resolveTier } from './tierPricing';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

// ── Intuit-shaped fixtures ───────────────────────────────────────────────────────────────────
// 🔴 THE BASE IS NEVER PASSED IN. A sale line carries the money; a discount line carries only what
// was taken off. Any rate has to be DERIVED from the other lines — which is the real shape, and
// the reason a 100×-off error cannot hide in these fixtures.
type Line =
  | { kind: 'sale'; name: string; amount: number }
  | { kind: 'item-disc'; name: string; amount: number; qty: number | null }
  | { kind: 'native'; amount: number; percentBased: boolean; pct?: number };

const sale = (name: string, amount: number): Line => ({ kind: 'sale', name, amount });
/** A discount taken as a service ITEM line. `qty` is 1 — what LAWNS's books actually hold. */
const itemDisc = (name: string, amount: number, qty: number | null = 1): Line => ({ kind: 'item-disc', name, amount, qty });
/** A NATIVE QuickBooks discount line: the rate is STATED and the amount is POSITIVE. */
const native = (pct: number, amount: number): Line => ({ kind: 'native', amount, percentBased: true, pct });
const nativeFixed = (amount: number): Line => ({ kind: 'native', amount, percentBased: false });

function body(invoices: { doc: string; date: string | null; cust?: string; lines: Line[] }[]): string {
  return JSON.stringify({
    QueryResponse: {
      Invoice: invoices.map((inv, i) => ({
        Id: String(i + 1), DocNumber: inv.doc, TxnDate: inv.date,
        CustomerRef: { value: inv.cust ?? '7' },
        TotalAmt: inv.lines.reduce((s, l) => s + l.amount, 0),
        Line: inv.lines.map(l => {
          if (l.kind === 'native') {
            return {
              DetailType: 'DiscountLineDetail', Amount: l.amount,
              DiscountLineDetail: l.percentBased
                ? { PercentBased: true, DiscountPercent: l.pct, DiscountAccountRef: { value: '92', name: 'Discounts given' } }
                : { PercentBased: false, DiscountAccountRef: { value: '92', name: 'Discounts given' } },
            };
          }
          return {
            DetailType: 'SalesItemLineDetail', Amount: l.amount,
            SalesItemLineDetail: { ItemRef: { value: '9', name: l.name }, Qty: l.kind === 'item-disc' ? l.qty : 1 },
          };
        }),
      })),
    },
  });
}
const breakdownOf = (raw: string) => summariseInvoices(parseInvoiceList(raw).invoices).discounts;

// The real LAWNS price card, verbatim from the item capture (2026-09-04). Three items publish 10%
// and two publish 5% — which is why matching a native line to a programme by RATE is ambiguous.
const ITEMS: DiscountItemFact[] = [
  { id: '3', name: 'CD10%',               description: 'Contractor Discount, 10%',    unitPrice: -0.1 },
  { id: '4', name: 'CD15%',               description: 'Contractor Discount 15% off', unitPrice: -0.15 },
  { id: '5', name: 'Customer Discount',   description: 'Customer Discount',           unitPrice: -0.1 },
  { id: '6', name: 'FD10',                description: 'Family Discount',             unitPrice: -0.1 },
  { id: '7', name: 'MD10',                description: 'Military Discount  -10%',     unitPrice: 0 },
  { id: '8', name: 'Military Discount',   description: 'Military Discount 5%',        unitPrice: -0.05 },
  { id: '9', name: 'Military Discount 5', description: 'Military Discount 5%',        unitPrice: -0.05 },
];
const CFG = { taxRate: 0.0825 };

// ══ §A 🔴 THE 100× PROBE — DAVID'S OWN SPECIFICATION FOR WHAT WOULD HAVE CAUGHT THIS ═════════
{
  // "$50 off a $500 invoice is 10%; if the code prints 5000% the probe must go red."
  const d = breakdownOf(body([
    { doc: '1', date: '2026-06-01', lines: [sale('Oak', 500), itemDisc('FD10', -50)] },
  ]));
  const row = d.byName.find(r => r.itemName === 'FD10')!;
  ok(row.percents.length === 1, 'one rate is derived');
  ok(row.percents[0].pct === 10,
    '🔴 $50 off a $500 invoice reads 10%. THE ONE ASSERTION THAT WOULD HAVE CAUGHT THE SHIPPED DEFECT');
  ok(row.percents[0].pct !== 5000,
    '🔴 and explicitly NOT 5000% — the amount and the correct rate differ by exactly 100×, so a ' +
    'missing division cannot pass this fixture');
  ok(row.examples[0].base === 500 && row.examples[0].amount === -50,
    'the working travels with it: $50 off a $500 base, so a reader can check the arithmetic');
  ok(row.baseTotal === 500,
    '🔴 `baseTotal` is 500 DOLLARS. It used to hold a COUNT of `Qty` values while being named for money');
  ok(row.withBase === 1, 'one line had a derivable base');
}

// ══ §B THE CEILING — NOTHING RENDERS AS A PERCENT UNLESS IT WAS A RATIO ══════════════════════
{
  ok(PERCENT_CEILING === 100, 'the ceiling is 100 — a discount cannot exceed the whole price');

  // Every number the broken screen printed was above 100, so the cheapest guard is a complete one
  // for that failure. Enforced at the WRITE, the last point before a number becomes a price.
  const over = buildAcceptancePatch({
    accepted: [{ typeName: 'Military', tierName: 'Military Discount', percent: 18250 }], config: CFG,
  });
  ok(over.ok === false, '🔴 18250% is REFUSED at the write, not written');
  if (!over.ok) ok(/not a percentage/.test(over.reason),
    'and the refusal says WHY in those words — a discount cannot exceed 100%');

  ok(itemPercentOf({ id: 'x', name: 'x', description: null, unitPrice: -25 }) === null,
    '🔴 a −$25 FLAT item is not read as "2500% off" — the same 100× family, one field over');
  ok(itemPercentOf({ id: 'x', name: 'x', description: null, unitPrice: -0.05 }) === 5, 'a real fraction reads 5%');
  ok(itemPercentOf({ id: 'x', name: 'x', description: null, unitPrice: 0 }) === null, 'and a $0 item publishes nothing');
}

// ══ §C 🔴 THE NATIVE DISCOUNT LINE — THE RATE IS STATED, SO NOTHING IS DERIVED ════════════════
{
  // MEASURED on LAWNS: 67 native lines against 21 item lines. The shipped code could not see these
  // at all — they have no ItemRef, so `isNamedDiscount` was false and they fell into a bare count.
  const d = breakdownOf(body([
    { doc: '1', date: '2026-01-11', cust: 'a', lines: [sale('Oak', 1000), native(10, 100)] },
    { doc: '2', date: '2026-08-15', cust: 'b', lines: [sale('Oak', 2000), native(10, 200)] },
    { doc: '3', date: '2026-02-06', cust: 'c', lines: [sale('Oak', 4000), native(15, 600)] },
    { doc: '4', date: '2026-04-25', cust: 'd', lines: [sale('Oak', 500),  nativeFixed(250)] },
  ]));
  const ten = d.byRate.find(r => r.pct === 10)!;
  ok(ten.lines === 2 && ten.amountTotal === 300, '10% was granted twice, $300 in total');
  ok(ten.customers === 2, 'across two customers');
  ok(ten.first === '2026-01-11' && ten.last === '2026-08-15', 'with a real date range');
  ok(d.byRate[0].pct === 15,
    '🔴 ordered by MONEY, not by count — $600 at 15% leads $300 at 10%. On the real books the ' +
    'rarest rate is the largest: $15,173 at 20% against $2,906 at 5%');
  ok(d.fixedDollar.lines === 1 && d.fixedDollar.amountTotal === 250,
    '🔴 a FIXED-DOLLAR discount is reported as MONEY and never given a percent — the line does not ' +
    'say what it was a percentage of');
  ok(!d.byRate.some(r => r.pct === 0), 'and it is not smuggled in as a 0% rate either');

  // ⚠️ ONE CUSTOMER, TWO LINES — without this the customer count and the line count are the same
  // number in every fixture, so a mutant that returns one for the other passes green.
  const repeat = breakdownOf(body([
    { doc: '1', date: '2026-01-11', cust: 'same', lines: [sale('Oak', 1000), native(10, 100)] },
    { doc: '2', date: '2026-02-11', cust: 'same', lines: [sale('Oak', 2000), native(10, 200)] },
    { doc: '3', date: '2026-03-11', cust: 'other', lines: [sale('Oak', 500), native(10, 50)] },
  ]));
  const r10 = repeat.byRate.find(r => r.pct === 10)!;
  ok(r10.lines === 3 && r10.customers === 2,
    '🔴 THREE lines to TWO customers — the counts are genuinely different numbers, so "26 customers" ' +
    'can never be a line count wearing the wrong label');

  // A fixed-dollar line carrying a STRAY DiscountPercent must still be read as fixed. `PercentBased`
  // is the flag that decides; the percent field alone must never be enough.
  const stray = summariseInvoices(parseInvoiceList(JSON.stringify({ QueryResponse: { Invoice: [{
    Id: '1', DocNumber: 'x', TxnDate: '2026-01-01', CustomerRef: { value: 'c' },
    Line: [
      { DetailType: 'SalesItemLineDetail', Amount: 1000, SalesItemLineDetail: { ItemRef: { value: '9', name: 'Oak' }, Qty: 1 } },
      { DetailType: 'DiscountLineDetail', Amount: 250, DiscountLineDetail: { PercentBased: false, DiscountPercent: 10 } },
    ],
  }] } })).invoices).discounts;
  ok(stray.fixedDollar.lines === 1 && stray.byRate.length === 0,
    '🔴 `PercentBased: false` WINS over a stray percent — the flag decides, and reading the percent ' +
    'alone would convert a flat $250 into a 10% rate it never was');

  // A native amount is POSITIVE on real books, so it was being ADDED to the subtotal — inflating
  // the very base a discount is measured against, by the discount.
  const infl = breakdownOf(body([
    { doc: '1', date: '2026-01-01', lines: [sale('Oak', 1000), native(10, 100), itemDisc('FD10', -100)] },
  ]));
  ok(infl.byName.find(r => r.itemName === 'FD10')!.percents[0].pct === 10,
    '🔴 a POSITIVE native amount does not inflate the base — $100 off $1,000 is 10%, not 9.09%');
}

// ══ §D THE ROWS COME FROM THE PRICE CARD, WHICH IS WHY CD10% AND CD15% REACH THE SCREEN ══════
{
  // 🔴 THE SECOND HALF OF THE SHIPPED DEFECT. CD10% and CD15% are real items that have NEVER been
  // used as item lines, so a review built from the invoice tally could not see them at all — two
  // of the three David ruled to seed were simply absent from the screen.
  const d = breakdownOf(body([
    { doc: '1', date: '2026-01-11', cust: 'a', lines: [sale('Oak', 1000), native(10, 100)] },
    { doc: '2', date: '2026-02-06', cust: 'b', lines: [sale('Oak', 4000), native(15, 600)] },
    { doc: '3', date: '2026-08-18', cust: 'c', lines: [sale('Oak', 500),  native(5, 25)] },
  ]));
  ok(d.byName.length === 0, "not one item line exists here — exactly LAWNS's shape for CD10% and CD15%");
  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: CFG, statedTiers: [] });
  const names = rev.sure.map(r => r.tierName);
  ok(names.includes('CD10%'), '🔴 CD10% IS OFFERED — from the price card, with no item line anywhere');
  ok(names.includes('CD15%'), '🔴 and so is CD15%');
  ok(rev.sure.find(r => r.tierName === 'CD10%')!.percent === 10, 'CD10% at 10%, read from UnitPrice −0.1');
  ok(rev.sure.find(r => r.tierName === 'CD15%')!.percent === 15, 'CD15% at 15%');
  ok(rev.sure.find(r => r.tierName === 'Military Discount')!.percent === 5, 'and Military Discount at 5%');
  ok(rev.sure.every(r => r.percent !== null && r.percent <= PERCENT_CEILING),
    '🔴 NO SUGGESTED PERCENT EXCEEDS 100 — the acceptance criterion, asserted over every row');
  ok(rev.sure.find(r => r.tierName === 'CD10%')!.typeName === 'Contractor',
    'the type comes from the item description with the noise words dropped');
}

// ══ §E CORROBORATION BY RATE, AND THE AMBIGUITY IT CANNOT RESOLVE ════════════════════════════
{
  const d = breakdownOf(body([
    { doc: '1', date: '2026-01-11', cust: 'a', lines: [sale('Oak', 1000), native(10, 100)] },
    { doc: '2', date: '2026-08-15', cust: 'b', lines: [sale('Oak', 2000), native(10, 200)] },
    { doc: '3', date: '2026-02-06', cust: 'c', lines: [sale('Oak', 4000), native(15, 600)] },
  ]));
  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: CFG, statedTiers: [] });
  const cd10 = rev.sure.find(r => r.tierName === 'CD10%')!;
  ok(cd10.grantedLines === 2 && cd10.grantedAmount === 300, '10% was granted twice for $300 — the usage evidence');
  ok(cd10.sharesRateWith.includes('Customer Discount') && cd10.sharesRateWith.includes('FD10'),
    '🔴 AND THE SCREEN IS TOLD IT CANNOT ATTRIBUTE THEM. Three of her items publish 10%, and a ' +
    'native discount line carries NO name — so "14 lines at 10%" is not evidence for CD10% ' +
    'specifically, and claiming it would be a fabricated attribution');
  const cd15 = rev.sure.find(r => r.tierName === 'CD15%')!;
  ok(cd15.sharesRateWith.length === 0 && cd15.grantedLines === 1,
    'CD15% is the one rate nothing else publishes, so ITS evidence is unambiguous — the negative control');
}

// ══ §F WHAT IS REFUSED, AND WHY ══════════════════════════════════════════════════════════════
{
  const d = breakdownOf(body([
    { doc: '1', date: '2026-03-14', lines: [sale('Oak', 1300), itemDisc('MD10', -130)] },
  ]));
  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: CFG, statedTiers: [] });
  const md10 = rev.needsHer.find(r => r.tierName === 'MD10')!;
  ok(md10 !== undefined, 'MD10 is refused, not suggested');
  ok(md10.refusal === REVIEW_REFUSALS.noPublishedRate,
    '🔴 because the ITEM publishes no rate — UnitPrice 0 — while its description says −10%. ' +
    'Two facts in her books disagreeing, and we do not resolve it on her behalf');
  ok(md10.percent === null, 'so it carries no number rather than the one in the description');
  ok(md10.derived.length === 1 && md10.derived[0].pct === 10,
    'the DERIVED 10% is still shown as evidence — she can accept it by typing it');

  // A derived rate ABOVE the published one is a real anomaly and refuses the suggestion.
  const over = breakdownOf(body([
    { doc: '1', date: '2026-01-01', lines: [sale('Oak', 1000), itemDisc('Military Discount', -50)] },
    { doc: '2', date: '2026-02-01', lines: [sale('Oak', 1000), itemDisc('Military Discount', -200)] },
  ]));
  const mil = buildDiscountReview({ discounts: over, items: ITEMS, config: CFG, statedTiers: [] })
    .needsHer.find(r => r.tierName === 'Military Discount')!;
  ok(mil?.refusal === REVIEW_REFUSALS.ratesDisagree,
    '🔴 a line that gave 20% under a 5% programme REFUSES the suggestion — more was given than the ' +
    'programme says, and that is a question for her, not a number to average');
  ok(mil.derivedAbove === 1 && mil.derivedBelow === 0, 'and the DIRECTION is reported, not just the disagreement');
}

// ══ §G 🔴 A RATE BELOW THE PUBLISHED ONE IS THE TREE-ONLY CASE, AND IT IS NOT AN ERROR ═══════
{
  // $250 off an invoice carrying $2,500 of trees AND $900 of delivery derives to 7.35% under a 10%
  // programme — because the delivery was not discounted. That is the rule working, not a defect.
  const d = breakdownOf(body([
    { doc: '1', date: '2025-02-08', lines: [sale('Oak', 1500), itemDisc('FD10', -150)] },
    { doc: '2', date: '2026-02-03', lines: [sale('Oak', 2500), sale('Tailgate delivery', 900), itemDisc('FD10', -250)] },
  ]));
  const row = d.byName.find(r => r.itemName === 'FD10')!;
  ok(row.percents.some(p => p.pct === 10) && row.percents.some(p => p.pct === 7.35),
    'both rates are derived and both are shown — 10% and 7.35%');
  const fd = buildDiscountReview({ discounts: d, items: ITEMS, config: CFG, statedTiers: [] })
    .sure.find(r => r.tierName === 'FD10')!;
  ok(fd !== undefined && fd.percent === 10,
    '🔴 FD10 is STILL SUGGESTED at its published 10% — a derived rate BELOW the published one is the ' +
    'discount covering part of the invoice, which is exactly what it is supposed to do');
  ok(fd.derivedBelow === 1 && fd.derivedAbove === 0, 'and the below-count is carried so the screen can say so');
  ok(fd.workings.some(w => w.base === 3400 && w.derivedPct === 7.35),
    'the working is on the row — $250 off $3,400 of other lines — so she can see why it reads low');
}

// ══ §H A GIVEAWAY IS NOT A DISCOUNT ══════════════════════════════════════════════════════════
{
  const d = breakdownOf(body([
    { doc: '1', date: '2026-03-21', lines: [sale('Oak', 275), itemDisc('Military Discount', 0)] },
    { doc: '2', date: '2026-08-19', lines: [sale('Oak', 500), itemDisc('Military Discount', -25)] },
    { doc: '3', date: '2026-06-09', lines: [sale('Oak', 650), itemDisc('Military Discount', -32.5)] },
  ]));
  const row = d.byName.find(r => r.itemName === 'Military Discount')!;
  ok(row.lines === 3 && row.zeroAmountLines === 1, 'the $0 line is COUNTED — a fact about how the item is used');
  ok(row.mostRecent === '2026-08-19',
    '🔴 "last used" is the NEWEST date, not the last row read — ordering by time, not by arrival');
  ok(row.percents.length === 1 && row.percents[0].pct === 5 && row.percents[0].lines === 2,
    '🔴 but it yields NO RATE. Counting it as 0% drags a clean 5% item into "rates disagree" and ' +
    'refuses a perfectly good suggestion — which is what the shipped version did');
  const mil = buildDiscountReview({ discounts: d, items: ITEMS, config: CFG, statedTiers: [] })
    .sure.find(r => r.tierName === 'Military Discount')!;
  ok(mil !== undefined && mil.zeroLines === 1, 'so it is suggested, with the $0 count on the row');
  ok(row.examples[0].derivedPct === null && row.examples[0].amount === 0,
    'and the $0 working shows no rate rather than 0%');
}

// ══ §H2 WHICH PRODUCTS COUNT AS DISCOUNTS — AND MD10 IS WHY IT IS NOT JUST "NEGATIVE PRICE" ══
{
  // MEASURED on LAWNS: six discount items carry a negative UnitPrice and a seventh, `MD10`, carries
  // ZERO. Keying only on the price drops a real programme, and dropping it is INVISIBLE — the
  // screen simply never mentions it.
  ok(isDiscountItem({ name: 'MD10', description: 'Military Discount  -10%', unitPrice: 0 }),
    '🔴 MD10 IS a discount item even at $0 — caught by its code pattern, not its price');
  ok(isDiscountItem({ name: 'CD10%', description: 'Contractor Discount, 10%', unitPrice: -0.1 }), 'a negative price qualifies');
  ok(isDiscountItem({ name: 'Customer Discount', description: null, unitPrice: null }), 'and so does the word in the name');
  ok(!isDiscountItem({ name: 'LO45', description: 'Live Oak, 45 Gallon', unitPrice: 1250 }),
    'a tree is not a discount — the negative control');
  ok(!isDiscountItem({ name: 'DIW', description: 'Deliver, install and warranty', unitPrice: 0 }),
    '🔴 nor is a $0 BUNDLE item — the pattern is deliberately narrow, because a product offered as ' +
    'a discount tier is worse than a discount missed');

  // …and the review must actually surface it, not merely classify it.
  const d = breakdownOf(body([{ doc: '1', date: '2026-03-14', lines: [sale('Oak', 1300), itemDisc('MD10', -130)] }]));
  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: CFG, statedTiers: [] });
  ok([...rev.sure, ...rev.needsHer].some(r => r.tierName === 'MD10'),
    '🔴 and MD10 REACHES THE SCREEN — refused rather than suggested, but never silently dropped');
}

// ══ §I RATES HER BOOKS GRANTED THAT NOTHING NAMES ════════════════════════════════════════════
{
  // On LAWNS this is the largest money on the page: $15,173 at 20%, and no item publishes 20%.
  const d = breakdownOf(body([
    { doc: '1', date: '2025-11-09', cust: 'a', lines: [sale('Oak', 50000), native(20, 10000)] },
    { doc: '2', date: '2026-03-13', cust: 'b', lines: [sale('Oak', 25000), native(20, 5000)] },
    { doc: '3', date: '2026-01-11', cust: 'c', lines: [sale('Oak', 1000),  native(10, 100)] },
  ]));
  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: CFG, statedTiers: [] });
  ok(rev.unnamedRates.length === 1 && rev.unnamedRates[0].pct === 20,
    '🔴 20% is reported as a rate NOTHING in her product list names');
  ok(rev.unnamedRates[0].amountTotal === 15000 && rev.unnamedRates[0].customers === 2,
    'with the money and the customer count — the biggest thing on her screen');
  ok(!rev.unnamedRates.some(r => r.pct === 10),
    'and 10% is NOT listed, because three of her items publish it — the negative control');
  ok(!rev.sure.some(r => r.percent === 20),
    '🔴 and nothing invents a tier for it. We will not name a programme she never named');
}

// ══ §J 🔴 THE WRITE THAT MUST NOT DELETE THE SALES-TAX RATE ══════════════════════════════════
{
  const accepted: AcceptedTier[] = [{ typeName: 'Contractor', tierName: 'CD10%', percent: 10 }];

  const refused = buildAcceptancePatch({ accepted, config: null });
  ok(refused.ok === false, '🔴 a NULL config (the RLS-filtered read) REFUSES — it does not write');
  if (!refused.ok) ok(/tax/i.test(refused.reason), 'and the refusal names the tax rate it protected');

  const built = buildAcceptancePatch({ accepted, config: CFG });
  ok(built.ok === true, 'a present config builds a patch');
  if (built.ok) {
    ok(!Object.prototype.hasOwnProperty.call(built.patch, 'taxRate'),
      '🔴 `taxRate` is ABSENT FROM THE PATCH KEYS — not null, not 0.0825, absent');
    const merged = { ...CFG, ...built.patch } as Record<string, unknown>;
    ok(merged.taxRate === 0.0825,
      '🔴 AFTER `{ ...current, ...patch }` THE 8.25% SURVIVES — the live LAWNS row, the real operand order');
    ok(Array.isArray(merged.discountTypes) && merged.margin !== undefined,
      'and the discounts and the plumbing landed in the same single write');
  }
  ok(!Object.prototype.hasOwnProperty.call(EMPTY_COST_CONFIG, 'taxRate'),
    'EMPTY_COST_CONFIG carries no taxRate — the property the disjointness rests on');
}

// ══ §K PLUMBING IS WRITTEN ONLY WHERE IT IS ABSENT ═══════════════════════════════════════════
{
  const accepted: AcceptedTier[] = [{ typeName: 'Contractor', tierName: 'CD10%', percent: 10 }];
  const ownersOwn = { baseline: 0.55, tiers: [{ name: 'mine', marginOverride: 0.55, isDefault: true }] };
  const r = buildAcceptancePatch({ accepted, config: { taxRate: 0.0825, margin: ownersOwn, version: 1 } });
  ok(r.ok === true, 'builds');
  if (r.ok) {
    ok(r.patch.margin === undefined,
      "🔴 an EXISTING margin is NOT in the patch — the owner's 55% is not overwritten by the 40% default");
    ok(r.patch.locations !== undefined, 'but a genuinely absent key IS filled');
    ok(!r.plumbingWritten.includes('margin') && r.plumbingWritten.includes('locations'),
      'and the result reports exactly which keys it filled');
  }
  const bare = buildAcceptancePatch({ accepted, config: CFG });
  if (bare.ok) {
    ok(bare.plumbingWritten.length === Object.keys(EMPTY_COST_CONFIG).length,
      "on LAWNS's one-key row every plumbing key is absent, so every one is filled — in ONE write");
    const loc = (bare.patch.locations as { labor: { rate: number | null; hours: number | null } }[])[0];
    ok(loc.labor.rate === null && loc.labor.hours === null,
      'the labour block arrives EMPTY — null, not 0, because a zero wage is a claim (D-9)');
    ok((bare.patch.margin as { baseline: number }).baseline === 0.40, 'margin baseline is 0.40');
  }
}

// ══ §L WHAT IS ALREADY CONFIGURED IS NEVER RE-OFFERED ════════════════════════════════════════
{
  const d = breakdownOf(body([{ doc: '1', date: '2026-01-11', lines: [sale('Oak', 1000), native(10, 100)] }]));
  const configured = {
    taxRate: 0.0825,
    discountTypes: [{ name: 'Contractor', tiers: [{ name: 'CD10%', basis: 'retail_minus_percent', discountPercent: 10 }] }],
  };
  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: configured, statedTiers: [] });
  ok(rev.alreadyConfigured.includes('CD10%'), 'the configured tier is reported');
  ok(!rev.sure.some(r => r.tierName === 'CD10%'), 'and not offered again');
  ok(rev.sure.some(r => r.tierName === 'CD15%'), 'while the new ones still are');

  // The un-configured business must not read as configured because the reader hands back a seed.
  const seedNames = normalizeDiscountTypes(CFG).flatMap(t => t.tiers.map(x => x.name.toLowerCase()));
  ok(seedNames.includes('contractor'), 'normalizeDiscountTypes DOES return a `contractor` seed tier');
  const bare = buildDiscountReview({
    discounts: d, config: CFG, statedTiers: [],
    items: [...ITEMS, { id: '99', name: 'contractor', description: 'Contractor Discount', unitPrice: -0.1 }],
  });
  ok(bare.alreadyConfigured.length === 0 && bare.sure.some(r => r.tierName === 'contractor'),
    '🔴 an item named `contractor` is STILL OFFERED to a business that configured nothing — the ' +
    'seed cannot suppress a real tier by sharing its name');

  // THE LEGACY BUSINESS: pricingTiers forward-migrate, so they ARE configured and live at checkout.
  const legacy = { taxRate: 0.0825, pricingTiers: [{ name: 'retail', discountPercent: 0, isDefault: true }, { name: 'CD10%', discountPercent: 10 }] };
  ok(normalizeDiscountTypes(legacy).flatMap(t => t.tiers.map(x => x.name)).includes('CD10%'),
    'the legacy key really does forward-migrate — the premise, asserted not assumed');
  ok(buildDiscountReview({ discounts: d, items: ITEMS, config: legacy, statedTiers: [] }).alreadyConfigured.includes('CD10%'),
    '🔴 a tier configured the LEGACY way reads as configured — it is live at checkout, so offering it again is wrong');
}

// ══ §M THE OWNER'S OWN NAMES, MEASURED AGAINST THE BOOKS ═════════════════════════════════════
{
  const d = breakdownOf(body([{ doc: '1', date: '2026-01-11', lines: [sale('Oak', 1000), native(10, 100)] }]));
  const rev = buildDiscountReview({ discounts: d, items: ITEMS, config: CFG, statedTiers: ['Contractor 35%', 'Contractor 25%'] });
  ok(rev.notSuggesting.length === 2, 'both stated tiers are ON the screen, not silently dropped');
  ok(rev.notSuggesting.every(s => s.invoiceLines === 0 && s.existsAsItem === false),
    '🔴 the ABSENCE is measured in both directions — no invoice line AND no item in her books');
  ok(!rev.sure.some(s => s.tierName === 'Contractor 35%'), 'and neither is seeded');
  ok(buildDiscountReview({ discounts: d, items: ITEMS, config: CFG, statedTiers: ['CD10%'] }).notSuggesting[0].existsAsItem === true,
    'a stated tier the books DO evidence reports its evidence rather than a blanket "not found"');
}

// ══ §N THE TYPE SUGGESTION NEVER INVENTS A WORD ══════════════════════════════════════════════
{
  ok(suggestTypeName('Contractor Discount, 10%') === 'Contractor', 'the noise word and the rate are dropped');
  ok(suggestTypeName('Contractor Discount 15% off') === 'Contractor', 'and so is a trailing "off"');
  ok(suggestTypeName('Military Discount 5%') === 'Military', 'a percent token is not a name');
  ok(suggestTypeName('DISCOUNT') === 'DISCOUNT', 'a name that is ONLY the noise word survives untouched');
  ok(suggestTypeName('CD10%') === 'CD10%',
    '🔴 `CD10%` yields `CD10%` — we do NOT know that CD means contractor, and deciding it did would ' +
    'assert a fact about her business from two letters');
  ok(suggestTypeName(null) === '', 'absent stays absent');
}

// ══ §O A SUGGESTION THE OWNER'S OWN EDITOR WOULD REJECT IS NEVER WRITTEN ═════════════════════
{
  ok(buildAcceptancePatch({ accepted: [
    { typeName: 'Contractor', tierName: 'CD10%', percent: 10 },
    { typeName: 'Landscaper', tierName: 'cd10%', percent: 5 },
  ], config: CFG }).ok === false, '🔴 duplicate tier names across DIFFERENT types are refused, case-insensitively');
  ok(buildAcceptancePatch({ accepted: [
    { typeName: 'Contractor', tierName: 'cd10%', percent: 10 },
    { typeName: 'Landscaper', tierName: 'CD10%', percent: 5 },
  ], config: CFG }).ok === false,
    '🔴 and refused in the OTHER order too — the check must fold case on BOTH the lookup and the insert');

  ok(buildAcceptancePatch({ accepted: [{ typeName: 'X', tierName: 'retail', percent: 10 }], config: CFG }).ok === false,
    '"retail" is refused — it is the reserved full-price floor');
  ok(buildAcceptancePatch({ accepted: [{ typeName: 'X', tierName: '  ', percent: 10 }], config: CFG }).ok === false,
    'an unnamed tier is refused');
  ok(buildAcceptancePatch({ accepted: [{ typeName: ' ', tierName: 'CD10%', percent: 10 }], config: CFG }).ok === false,
    'an unnamed TYPE is refused too');
  ok(buildAcceptancePatch({ accepted: [{ typeName: 'X', tierName: 'CD10%', percent: -1 }], config: CFG }).ok === false,
    'a negative percent is refused — a "discount" that charges more is not a discount');
  ok(buildAcceptancePatch({ accepted: [], config: CFG }).ok === false, 'accepting nothing writes nothing');

  const rev = buildDiscountReview({
    discounts: null, config: CFG, statedTiers: [],
    items: [{ id: '50', name: 'Retail', description: 'Retail', unitPrice: -0.1 }],
  });
  ok(rev.needsHer[0]?.refusal === REVIEW_REFUSALS.reservedName,
    'and an ITEM named `retail` is refused by name before it can ever be offered');
}

// ══ §P ACCEPTING A SUGGESTION NEVER DELETES A TIER SHE SET UP HERSELF ════════════════════════
{
  const hers = {
    taxRate: 0.0825,
    discountTypes: [
      { name: 'Landscaper', tiers: [{ name: 'Landscaper tier 1', basis: 'retail_minus_percent', discountPercent: 5 }] },
      { name: 'Contractor', tiers: [{ name: 'Contractor tier 1', basis: 'retail_minus_percent', discountPercent: 12 }] },
    ],
  };
  const built = buildAcceptancePatch({ accepted: [{ typeName: 'Contractor', tierName: 'CD10%', percent: 10 }], config: hers });
  ok(built.ok === true, 'builds');
  if (built.ok) {
    const types = built.patch.discountTypes as { name: string; tiers: { name: string; discountPercent: number }[] }[];
    const all = types.flatMap(t => t.tiers.map(x => x.name));
    ok(all.includes('Landscaper tier 1') && all.includes('Contractor tier 1') && all.length === 3,
      '🔴 her hand-typed tiers SURVIVE — the accepted one is ADDED, making three, not replacing two');
    ok(types.find(t => t.name === 'Contractor')!.tiers.length === 2,
      'and it lands INSIDE the existing Contractor type rather than minting a second of the same name');
    ok(resolveTier('Landscaper tier 1', normalizeDiscountTypes({ ...hers, ...built.patch })).discountPercent === 5,
      'and a customer already tagged `Landscaper tier 1` still resolves to 5% after the write');
  }
}

// ══ §Q THE ROUND TRIP — what is written is what checkout will charge ═════════════════════════
{
  const built = buildAcceptancePatch({ accepted: [{ typeName: 'Contractor', tierName: 'CD10%', percent: 10 }], config: CFG });
  ok(built.ok === true, 'builds');
  if (built.ok) {
    const types = normalizeDiscountTypes({ ...CFG, ...built.patch });
    ok(resolveTier('CD10%', types).discountPercent === 10,
      '🔴 a customer tagged `CD10%` resolves to 10% off — through the SAME reader checkout uses');
    ok(resolveTier('cd10%', types).discountPercent === 0,
      "🔴 AND `cd10%` — one letter's case off — resolves SILENTLY to the retail floor at full price. " +
      'This is why the screen must show the exact string it writes');
    ok(resolveTier('CD10%', types).basis === 'retail_minus_percent', 'the basis keeps D-39 off services');
  }
}

// ══ §R AN EMPTY READ IS NOT AN EMPTY BUSINESS ════════════════════════════════════════════════
{
  const none = buildDiscountReview({ discounts: null, items: [], config: CFG, statedTiers: ['X'] });
  ok(none.sure.length === 0 && none.needsHer.length === 0 && none.unnamedRates.length === 0,
    'no capture ⇒ no suggestions — the screen has nothing to claim and claims nothing');
  ok(none.fixedDollar === null, 'and no fixed-dollar claim either — absent, not zero');
  ok(none.notSuggesting.length === 1, 'a stated tier still renders, honestly reporting zero evidence');
  const noRow = buildDiscountReview({ discounts: null, items: [], config: null, statedTiers: [] });
  ok(noRow.configRowPresent === false && noRow.taxRatePresent === false,
    'a MISSING ROW is distinguishable from a config with no tax rate (A9 — absent is not empty)');
  ok(noRow.plumbingMissing.length === Object.keys(EMPTY_COST_CONFIG).length, 'and every plumbing key reads as missing');

  // An item-line discount on an invoice with nothing else on it: no base, so no rate.
  const solo = breakdownOf(body([{ doc: '1', date: '2026-01-01', lines: [itemDisc('FD10', -50)] }]));
  const row = solo.byName.find(r => r.itemName === 'FD10')!;
  ok(row.lines === 1 && row.withBase === 0 && row.percents.length === 0,
    '🔴 a discount with no other line on the invoice yields NO rate — not Infinity, not 0%');
  ok(row.examples[0].base === null && row.examples[0].derivedPct === null, 'and its working says so');

  // …and a null Qty must be irrelevant now, because Qty is not the base any more.
  const nullQty = breakdownOf(body([{ doc: '1', date: '2026-01-01', lines: [sale('Oak', 500), itemDisc('FD10', -50, null)] }]));
  ok(nullQty.byName[0].percents[0].pct === 10,
    '🔴 a line with NO Qty still derives 10% — the rate no longer depends on a field that never held a base');
}

console.log(`\n  discountReview — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
