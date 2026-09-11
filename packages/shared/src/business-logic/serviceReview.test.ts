/**
 * ── serviceReview — a suggested price is a MAJORITY of real lines, a $0 service is never ──────
 *    written, and a tree is never offered as a service.
 *
 * 🔴 §A IS THE PROBE THAT COULD HAVE DISAGREED, AND IT IS BUILT THE WAY #280 SAID TO BUILD ONE.
 * That defect survived 96 green assertions because every fixture wrote the base into the field the
 * code read it from: the test and the code believed the same false thing and agreed perfectly. So
 * no fixture here states a verdict, a rate, or a unit. Each one states LINES — what was charged,
 * how many times, at what `Qty` — and the verdict is whatever the module reads out of them.
 *
 * The specific shape §A guards: **an item charged $50 nineteen times out of eighty-three is NOT a
 * $50 service**, and an item charged $50 four times out of seven IS. The two differ only in the
 * proportion, so a module that reported "the most common price" without asking whether it was a
 * majority would pass on one and fail the other — it cannot pass both by accident.
 *
 * The four things that can hurt a real business, each with its own §:
 *   ① A PRICE ON A CHECKOUT MENU THAT HER BOOKS NEVER SUPPORTED (§A, §B).
 *   ② A $0 PRICE ON A LIVE SERVICE — which reads to a customer as FREE (§E).
 *   ③ A TREE OFFERED AS A SERVICE, or a DISCOUNT offered as one at a negative price (§C).
 *   ④ A SECOND PASS EATING THE FIRST PASS'S WORK (§F).
 *
 * Run:
 *   node scripts/run-tests.mjs serviceReview
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseItemList } from '../quickbooks/itemList';
import { parseInvoiceList, mentionsInstall, INSTALL_WORDING } from '../quickbooks/invoiceList';
import {
  buildServiceReview, buildServiceRows, classifyDestination, readPriceEvidence, readUnitEvidence,
  buildPlacementLadder, suggestCategory, readServiceEvidence,
  SERVICE_OFFERING_SELECT, toExistingOffering,
  DESTINATIONS, SERVICE_REFUSALS, PRICE_MAJORITY, MIN_AGREEING_LINES,
  UNIT_ORDER_SHARE, UNIT_PLANT_SHARE, SERVICE_CATEGORIES, PRICE_UNITS,
  type ServiceItemFact, type ServiceLineTally, type AcceptedService, type ExistingOffering,
} from './serviceReview';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

// ── fixtures ─────────────────────────────────────────────────────────────────────────────────
// 🔴 A TALLY IS BUILT FROM LINES, NEVER FROM A VERDICT. `lines()` takes the actual charges —
// `[50,50,50,65]` means four lines, three at $50 — and derives every count from them. No fixture
// may hand the module a share, a majority, or a unit; those are the answers under test.
function lines(charges: number[], qtys?: number[]): Pick<ServiceLineTally, 'lines' | 'zeroLines' | 'prices' | 'qtyOneLines'> {
  const priced = charges.filter(c => c > 0);
  const m = new Map<number, number>();
  for (const c of priced) m.set(c, (m.get(c) ?? 0) + 1);
  const q = qtys ?? charges.map(() => 1);
  return {
    lines: charges.length,
    zeroLines: charges.length - priced.length,
    prices: [...m.entries()].map(([price, n]) => ({ price, lines: n })),
    qtyOneLines: q.filter(x => x === 1).length,
  };
}
function tally(itemId: string, charges: number[], qtys?: number[], extra: Partial<ServiceLineTally> = {}): ServiceLineTally {
  return {
    itemId, invoices: charges.length, amountTotal: charges.reduce((a, b) => a + b, 0),
    customers: charges.length, first: '2025-01-01', last: '2026-01-01',
    ...lines(charges, qtys), ...extra,
  };
}
function item(id: string, name: string, account: string | null, unitPrice: number | null = null,
              description: string | null = null, type = 'Service'): ServiceItemFact {
  return { id, name, description, unitPrice, type, incomeAccountName: account };
}
const LABOUR = 'Landscaping/Installation Services';
const STOCK  = 'Sales of Nursery Stock';
const GOODS  = 'Sales of Product Income';
const CARRY  = 'Delivery Income';

function review(items: ServiceItemFact[], tallies: ServiceLineTally[], opts: {
  existing?: ExistingOffering[]; site?: string[];
} = {}) {
  return buildServiceReview({
    items, tallies, existing: opts.existing ?? [], placement: [], siteServices: opts.site ?? [],
  });
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §A — THE PROBE THAT COULD HAVE DISAGREED. Two services differing ONLY in proportion.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // Shaped on the two real cases, measured from LAWNS's 1,481-invoice capture:
  //   trunk protection — $10 on 4 of 7 priced lines (57%)  → a price
  //   tree removal     — $50 on 19 of 83 priced lines (23%) → a spread
  const majority = tally('tp', [10, 10, 10, 10, 25, 40, 75]);
  const spread   = tally('tr', [
    ...Array(19).fill(50), ...Array(16).fill(75), ...Array(14).fill(100),
    ...Array(12).fill(150), ...Array(11).fill(200), ...Array(11).fill(300),
  ]);

  const a = readPriceEvidence(majority);
  const b = readPriceEvidence(spread);

  ok(a.confidence === 'sure' && a.price === 10,
    '🔴 $10 on 4 of 7 priced lines is a PRICE — more often than not, so it is what she charges');
  ok(b.confidence === 'cannot-tell' && b.price === null,
    '🔴 $50 on 19 of 83 is NOT a price — a plurality is not a majority, and no number is suggested');
  ok(b.mostCommon === 50,
    '…and the most-used figure is still SHOWN, because she may recognise it; it is just not suggested');

  // The half that makes this a test rather than a restatement: both have the SAME most-common
  // price and the SAME shape of evidence. Only the proportion differs. A module that reported
  // `prices[0].price` — the obvious wrong implementation — passes the first and fails the second.
  ok(a.mostCommon !== null && b.mostCommon !== null && a.distinctPrices > 1 && b.distinctPrices > 1,
    'both rows have a most-common price and a spread around it — only the PROPORTION differs');
  ok(a.agreeing / a.pricedLines > PRICE_MAJORITY && b.agreeing / b.pricedLines <= PRICE_MAJORITY,
    'and the working printed on screen is the share itself, not a rating we invented');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §B — A SINGLE SALE IS 100% AGREEMENT AND MUST NOT OUTRANK A SERVICE BILLED EIGHTY TIMES.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const once  = readPriceEvidence(tally('ogm', [1250]));
  const twice = readPriceEvidence(tally('x', [400, 400]));
  const thrice = readPriceEvidence(tally('y', [400, 400, 400]));
  ok(once.confidence === 'cannot-tell',
    '🔴 one sale at $1,250 is 100% agreement and is NOT a price — one observation is not a distribution');
  ok(twice.confidence === 'cannot-tell', 'two agreeing lines can be a coincidence — still refused');
  ok(thrice.confidence === 'sure' && thrice.price === 400,
    `three agreeing lines is a price (MIN_AGREEING_LINES = ${MIN_AGREEING_LINES})`);
  ok(once.refusal === SERVICE_REFUSALS.noInvoicePrice && readPriceEvidence(tally('z', [1, 2, 3, 4])).refusal === SERVICE_REFUSALS.pricesDisagree,
    '🔴 "not watched enough" and "she negotiates" are DIFFERENT refusals and the screen says which');

  // 🔴 MOST-USED, NOT CHEAPEST. The fixture puts the frequent price ABOVE the rare one on purpose:
  // ordering these by value instead of by frequency would suggest $20 — a price she charged twice
  // — for a service she charges $90 for six times out of eight.
  const dear = readPriceEvidence(tally('d', [90, 90, 90, 90, 90, 90, 20, 20]));
  ok(dear.price === 90 && dear.mostCommon === 90,
    '🔴 the suggestion is the price charged MOST OFTEN, never the smallest one on the list');

  // …and the mirror, so neither ordering can pass by luck: here the frequent price is the LOWER.
  const cheap = readPriceEvidence(tally('c', [20, 20, 20, 20, 20, 20, 90, 90]));
  ok(cheap.price === 20, 'and when the frequent price is the low one, that is the suggestion too');

  // 🔴 A LIST PRICE IS NOT EVIDENCE OF WHAT SHE CHARGES. `Bblr` publishes $65 and no invoice has
  // ever used it; suggesting it would put her catalogue's aspiration on a customer's bill.
  const nb = readPriceEvidence(null);
  ok(nb.confidence === 'never-billed' && nb.price === null && nb.refusal === SERVICE_REFUSALS.neverBilled,
    '🔴 never billed ⇒ NO price and NO confidence — a published list price is not a measurement');
  ok(nb.pricedLines === 0 && nb.mostCommon === null, '…and nothing about it reads as measured');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §C — CLASSIFICATION. The income account is the axis, and it is HER word, not our guess.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const tree = classifyDestination(item('76', 'Lacey Oak 45G', STOCK, 375, 'Lacey Oak 45 Gallon'));
  ok(tree.destination === DESTINATIONS.product,
    '🔴 an item QuickBooks types `Service` and books to nursery stock is a TREE — never a service');
  ok(tree.contested === true && /nursery stock/i.test(tree.reason),
    '…and the row says WHY, quoting her own account name back to her');

  const disc = classifyDestination(item('3', 'CD10%', 'Discounts given', -0.1, 'Contractor Discount, 10%'));
  ok(disc.destination === DESTINATIONS.discount,
    '🔴 a discount item never reaches this screen — a −$0.10 checkout row is the defect the import ships today');

  // The one that needs BOTH clauses: MD10 carries UnitPrice 0, so a negative-price rule alone
  // misses it; its NAME and its ACCOUNT both say discount.
  ok(classifyDestination(item('7', 'MD10', 'Discounts given', 0, 'Military Discount  -10%')).destination === DESTINATIONS.discount,
    '🔴 MD10 is priced ZERO and is still a discount — caught by name and account, not by sign');

  // 🔴 THE ACCOUNT CLAUSE DOES ITS OWN WORK. `Credit` says nothing in its name and carries a $0
  // price, so `isDiscountItem` cannot see it — her books file it under "Discounts given" and that
  // is the only thing that keeps it off a checkout menu.
  const credit = classifyDestination(item('116', 'Credit', 'Discounts given', 0, null));
  ok(credit.destination === DESTINATIONS.discount,
    '🔴 a discount whose NAME says nothing is caught by the ACCOUNT — the name test alone would ship it as a service');
  ok(classifyDestination(item('116', 'Credit', 'Some Other Account', 0, null)).destination !== DESTINATIONS.discount,
    '…and with any other account the SAME item is not a discount, which proves the clause is load-bearing');

  // 🔴 AN ACCOUNT THAT SETTLES NOTHING MUST NOT READ AS SETTLED. This is the difference between
  // "your books say this is work" and "your books do not say", and only the second one must leave
  // the box empty — a pre-tick here is us answering a question she never was asked.
  const vague = classifyDestination(item('210', 'xtra', 'Add-On / Change Order Income', 100, 'Extra charge'));
  ok(vague.destination === DESTINATIONS.service && vague.contested === true,
    '🔴 an account that names neither work nor stock leaves the row CONTESTED — never silently ticked');
  const none = classifyDestination(item('900', 'Thing', null, 10));
  ok(none.contested === true && /no income account/i.test(none.reason),
    'and an item with no account at all says exactly that, rather than being filed by guesswork');

  ok(classifyDestination(item('1000', 'Overpayment Refund', 'Refund', 0)).destination === DESTINATIONS.notASale,
    'a refund account is bookkeeping, not something she sells');
  ok(classifyDestination(item('186', 'TC', CARRY, 50, 'Trip Charge')).destination === DESTINATIONS.service,
    'delivery income is work she does');
  ok(classifyDestination(item('119', 'DF', LABOUR, 75, 'Deer Fencing')).contested === false,
    'an installation account settles it outright — nothing contested, so it can be pre-ticked');

  const goods = classifyDestination(item('185', 'TB', GOODS, 65, 'Tree Bubbler'));
  ok(goods.destination === DESTINATIONS.service && goods.contested === true,
    '🔴 product income holds bags AND bubblers — her books do not settle it, so the row is never pre-ticked');

  ok(classifyDestination(item('900', 'Mulch', null, 5, null, 'NonInventory')).destination === DESTINATIONS.product,
    'a NonInventory item is the catalogue import’s population and this screen does not touch it');

  // The account is matched by NAME, never by id — an id is a tenant literal and would be wrong at
  // the next customer. Proven by classifying with a different vocabulary, no ids anywhere.
  ok(classifyDestination(item('x', 'Fit', 'Installation Revenue', 10)).destination === DESTINATIONS.service,
    'a different business writing "Installation Revenue" classifies correctly — no id, no literal');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §D — THE UNIT IS READ FROM `Qty`, AND THE MIDDLE IS UNKNOWN RATHER THAN A COIN-FLIP.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // Trip charge, as measured: Qty = 1 on 516 of 523.
  const perOrder = readUnitEvidence(tally('tc', Array(20).fill(50), [...Array(19).fill(1), 2]));
  ok(perOrder.unit === 'order' && perOrder.priceType === 'flat',
    `🔴 Qty = 1 on ${Math.round(UNIT_ORDER_SHARE * 100)}%+ of lines means charged ONCE PER ORDER`);

  // Tree bubbler, as measured: Qty = 1 on 26 of 81, running 2·3·4·5·6.
  const perPlant = readUnitEvidence(tally('tb', Array(10).fill(65), [1, 1, 1, 2, 3, 3, 4, 5, 6, 2]));
  ok(perPlant.unit === 'plant' && perPlant.priceType === 'per_unit',
    '🔴 a Qty that varies with the number of trees means charged PER PLANT');

  const middle = readUnitEvidence(tally('tsk', Array(10).fill(40), [1, 1, 1, 1, 1, 1, 1, 2, 2, 4]));
  ok(middle.unknown && middle.unit === null,
    `🔴 between ${UNIT_PLANT_SHARE * 100}% and ${UNIT_ORDER_SHARE * 100}% we do NOT claim to know — she picks, and a silent pick would write a rule her books contradict`);
  ok(readUnitEvidence(null).unknown, 'never billed ⇒ no unit claim at all');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §E — THE WRITE. $0 IS REFUSED, AND SO IS A CATEGORY THE DATABASE WOULD REFUSE.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const B = 'biz-1';
  // A transport fixture CARRIES A MODE (R-120). Without one, every refusal below would be refused by
  // the mode clause first, and a mutant deleting the clause each probe is really about would survive.
  const good: AcceptedService = { name: 'Trip charge', description: null, category: 'transport', priceUnit: 'order', price: 50, sortOrder: 0, transportMode: 'staff' };

  const r = buildServiceRows({ accepted: [good], businessId: B, existing: [] });
  ok(r.ok === true && r.rows.length === 1, 'a priced, categorised service writes one row');
  if (r.ok) {
    ok(r.rows[0].price === 50 && r.rows[0].is_active === true,
      'and it lands ACTIVE with the price she agreed to — not parked at zero and switched off');
    ok(r.rows[0].price_type === 'flat' && r.rows[0].price_unit === 'order',
      '🔴 `price_type` is DERIVED from `price_unit` so the two columns cannot disagree');
    ok(r.rows[0].business_id === B, 'scoped to the business — AC-3');
  }

  // 🔴 `price_type` IS DERIVED, AND THE PROBE ASSERTS BOTH BRANCHES. Asserting only the `flat`
  // one would pass a mutant that hardcodes `flat` — and checkout would then charge a per-plant
  // service once, for an order of forty trees.
  const perPlant = buildServiceRows({
    accepted: [{ ...good, name: 'Bubbler', category: 'addon', priceUnit: 'plant', price: 65 }],
    businessId: B, existing: [],
  });
  ok(perPlant.ok === true && perPlant.rows[0].price_type === 'per_unit' && perPlant.rows[0].price_unit === 'plant',
    '🔴 a PER-PLANT service writes `per_unit` — the branch a hardcoded `flat` would silently lose');

  const nameless = buildServiceRows({ accepted: [{ ...good, name: '   ' }], businessId: B, existing: [] });
  ok(nameless.ok === false,
    '🔴 a blank name is refused — a nameless row on a checkout menu is one nobody can find to fix');

  const free = buildServiceRows({ accepted: [{ ...good, price: 0 }], businessId: B, existing: [] });
  ok(free.ok === false && /free/i.test((free as { reason: string }).reason),
    '🔴 $0 IS REFUSED AND THE REASON NAMES THE CONSEQUENCE — a $0 service reads to a customer as free');

  const neg = buildServiceRows({ accepted: [{ ...good, price: -5 }], businessId: B, existing: [] });
  ok(neg.ok === false, 'a negative price is refused too — that is what a discount item would become');

  const badCat = buildServiceRows({ accepted: [{ ...good, category: 'uncategorized' }], businessId: B, existing: [] });
  ok(badCat.ok === false,
    '🔴 `uncategorized` is refused HERE because Postgres refuses it THERE — the CHECK holds five values');
  ok(!(SERVICE_CATEGORIES as readonly string[]).includes('uncategorized'),
    '…and the five are the five the migration declares, not a list typed twice');

  const badUnit = buildServiceRows({ accepted: [{ ...good, priceUnit: 'tree' }], businessId: B, existing: [] });
  ok(badUnit.ok === false, 'a price_unit outside the CHECK is refused before it reaches the database');
  ok(PRICE_UNITS.length === 4 && SERVICE_CATEGORIES.length === 5, 'the two vocabularies match the migration');

  ok(buildServiceRows({ accepted: [], businessId: B, existing: [] }).ok === false,
    'nothing ticked ⇒ nothing written, and it says so rather than reporting a silent success');
  ok(buildServiceRows({ accepted: [good], businessId: '', existing: [] }).ok === false,
    'no business ⇒ refuse; an unscoped insert is the one that lands on the wrong tenant');

  const dupe = buildServiceRows({ accepted: [good, { ...good, sortOrder: 1 }], businessId: B, existing: [] });
  ok(dupe.ok === false, 'two rows with one name are refused as a set — never half-written');

  // 🔴 THE REFUSAL IS ALL-OR-NOTHING. A good row beside a bad one writes NEITHER, because a
  // partial write leaves her looking at a screen that says one thing and a menu that says another.
  const mixed = buildServiceRows({ accepted: [good, { ...good, name: 'Bubbler', price: 0 }], businessId: B, existing: [] });
  ok(mixed.ok === false, '🔴 one unpriced row refuses the whole press — never a partial write');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §E2 — R-120: A TRANSPORT SERVICE THAT DOES NOT SAY WHO TRANSPORTS IS REFUSED, BY NAME.
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2026-09-09: this writer set `category='transport'` and never `transport_mode`, and LAWNS's Trip
// Charge did not appear on an order at all. The REFUSAL is asserted first — a writer only ever seen
// accepting is not a proven guard — then the acceptance, with every column it writes checked.
{
  const B = 'biz-1';
  const bare: AcceptedService = { name: 'Trip charge', description: null, category: 'transport', priceUnit: 'order', price: 50, sortOrder: 0 };

  const noMode = buildServiceRows({ accepted: [bare], businessId: B, existing: [] });
  ok(noMode.ok === false, '🔴 R-120: a transport service with NO mode is refused — the 2026-09-09 row cannot be written again');
  ok(noMode.ok === false && /Trip charge/.test(noMode.reason) && /who transports/i.test(noMode.reason),
    '…and the refusal NAMES the row and says what is missing, rather than a generic "invalid"');
  for (const junk of [null, '', 'truck', 'Staff']) {
    const r = buildServiceRows({ accepted: [{ ...bare, transportMode: junk }], businessId: B, existing: [] });
    ok(r.ok === false, `a mode of ${JSON.stringify(junk)} is not a mode — the CHECK holds exactly 'self' and 'staff'`);
  }

  const staff = buildServiceRows({ accepted: [{ ...bare, transportMode: 'staff' }], businessId: B, existing: [] });
  ok(staff.ok === true, 'the same row WITH a mode is accepted — the guard refuses the gap, never the option');
  if (staff.ok) {
    ok(staff.rows[0].transport_mode === 'staff', '🔴 `transport_mode` is WRITTEN — the column this writer never set');
    ok(staff.rows[0].requires_address === true, 'staff transport defaults to NEEDING an address (Test Dave\'s two staff rows, measured)');
    ok(staff.rows[0].trigger_transport_mode === null, '`trigger_transport_mode` stays NULL — it is an add-on column');
  }
  const self = buildServiceRows({ accepted: [{ ...bare, name: 'Collect', price: 1, transportMode: 'self' }], businessId: B, existing: [] });
  ok(self.ok === true && self.rows[0].transport_mode === 'self' && self.rows[0].requires_address === false,
    'self transport defaults to NO address (Test Dave\'s Self Pickup, measured)');

  // ⚠️ A DEFAULT, NOT A LOCK — a staff drop to a site with no street address is a real case.
  const override = buildServiceRows({ accepted: [{ ...bare, transportMode: 'staff', requiresAddress: false }], businessId: B, existing: [] });
  ok(override.ok === true && override.rows[0].requires_address === false,
    '⚠️ an explicit "no address" on a staff service is KEPT — the mode sets a default, never a lock');

  const addon = buildServiceRows({ accepted: [{ ...bare, name: 'Bubbler', category: 'addon', priceUnit: 'plant', transportMode: 'staff', requiresAddress: true }], businessId: B, existing: [] });
  ok(addon.ok === true && addon.rows[0].transport_mode === null && addon.rows[0].requires_address === false,
    'a mode typed against an ADD-ON is not written — transport_mode means nothing off a transport row');

  const mixed = buildServiceRows({ accepted: [{ ...bare, name: 'Bubbler', category: 'addon', priceUnit: 'plant', price: 65 }, bare], businessId: B, existing: [] });
  ok(mixed.ok === false, '🔴 one mode-less transport row refuses the WHOLE press — all-or-nothing holds for this clause too');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §F — RE-RUNNABLE. A SECOND PASS ADDING ONE SERVICE LEAVES THE FIRST PASS INTACT.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const items = [
    item('186', 'TC', CARRY, 50, 'Trip Charge'),
    item('185', 'TB', GOODS, 65, 'Tree Bubbler'),
  ];
  const tallies = [tally('186', Array(8).fill(50)), tally('185', Array(8).fill(65), Array(8).fill(3))];

  const first = review(items, tallies);
  ok(first.sure.some(r => r.name === 'TC'), 'pass one offers the trip charge');

  // She accepts ONLY the trip charge. That row is now on her menu.
  const wrote = buildServiceRows({
    accepted: [{ name: 'TC', description: 'Trip Charge', category: 'transport', priceUnit: 'order', price: 50, sortOrder: 0, transportMode: 'staff' }],
    businessId: 'biz-1', existing: [],
  });
  ok(wrote.ok === true, 'pass one writes it');
  const afterFirst: ExistingOffering[] = [{ id: 'a', name: 'TC', price: 50, priceUnit: 'order', isActive: true }];

  // Pass two, same books.
  const second = review(items, tallies, { existing: afterFirst });
  ok(!second.sure.some(r => r.name === 'TC') && !second.needsHer.some(r => r.name === 'TC'),
    '🔴 pass two does NOT re-offer what pass one wrote — no duplicate row, no second price');
  ok(second.alreadyOffered.includes('TC'),
    '…and it says so on screen rather than silently omitting the row, which would read as data loss');
  ok(second.sure.concat(second.needsHer).some(r => r.name === 'TB'),
    'and the service she did NOT take is still on offer');

  // 🔴 A ROW HER BOOKS COULD NOT CLASSIFY SINKS BELOW THE ONES THEY COULD, EVEN WHEN IT CARRIES
  // MORE MONEY. The bubbler ($17,410, product-income account) would otherwise head a list above
  // the deer fencing her books plainly call installation work — and the top of the list is what
  // an owner reads as "these are your services".
  const ordered = review(
    [item('185', 'TB', GOODS, 65, 'Tree Bubbler'), item('119', 'DF', LABOUR, 75, 'Deer Fencing')],
    [tally('185', Array(8).fill(65)), tally('119', Array(4).fill(75))],
  );
  ok(ordered.sure[0].name === 'DF' && ordered.sure[1].name === 'TB',
    '🔴 the settled row leads the contested one even though the contested one carries 4× the money');

  // The write itself refuses the name rather than overwriting it — the load-bearing half.
  const again = buildServiceRows({
    accepted: [{ name: 'TC', description: null, category: 'transport', priceUnit: 'order', price: 999, sortOrder: 0, transportMode: 'staff' }],
    businessId: 'biz-1', existing: afterFirst,
  });
  ok(again.ok === false && /already/i.test((again as { reason: string }).reason),
    '🔴 EVEN IF THE ROW REACHED THE WRITE, IT IS REFUSED — pass one’s $50 cannot be overwritten with $999');

  // …and a case-different name is the same name. A duplicate that differs only in case is the
  // one that gets through every guard keyed on exact equality.
  const cased = buildServiceRows({
    accepted: [{ name: 'tc', description: null, category: 'transport', priceUnit: 'order', price: 999, sortOrder: 0, transportMode: 'staff' }],
    businessId: 'biz-1', existing: afterFirst,
  });
  ok(cased.ok === false, '"tc" and "TC" are one service — the guard is case-insensitive');

  const secondWrite = buildServiceRows({
    accepted: [{ name: 'TB', description: 'Tree Bubbler', category: 'addon', priceUnit: 'plant', price: 65, sortOrder: 1 }],
    businessId: 'biz-1', existing: afterFirst,
  });
  ok(secondWrite.ok === true && secondWrite.rows.length === 1,
    '🔴 pass two writes exactly ONE new row — the first pass is untouched because this writer only INSERTS');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §G — WHAT IS NEVER SUGGESTED, AND THE REASON IS ON THE ROW.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // Warranty replacement, as measured: 19 invoices, every line $0.
  const warranty = item('207', 'WARRANTY', 'COGS – Warranty Work', 0, 'TREE REPLACEMENT');
  const wTally = tally('207', Array(19).fill(0), Array(19).fill(1));
  // A bundle, as measured: 22 lines, 21 distinct prices.
  const bundle = item('121', 'DIW', CARRY, 0, 'Deliver, Install and Warranty listed plants');
  const bTally = tally('121', [600, 600, 450, 250, 1200, 2092, 3400, 875, 1500, 990, 2400]);

  const r = review([warranty, bundle], [wTally, bTally]);
  const w = r.notSuggesting.find(x => x.name === 'WARRANTY');
  const b = r.notSuggesting.find(x => x.name === 'DIW');
  ok(w !== undefined && w.blockers.includes(SERVICE_REFUSALS.everyLineFree),
    '🔴 nineteen invoices at $0 is what her warranty COSTS her — counted, never priced');
  ok(w !== undefined && w.invoices === 19,
    '…and the count is still shown, because that number is the thing worth knowing');
  ok(b !== undefined && b.blockers.includes(SERVICE_REFUSALS.bundle),
    '🔴 a price that almost never repeats is a negotiated figure, not a rate');
  ok(r.sure.length === 0 && r.needsHer.length === 0, 'neither reaches a section she can tick');

  // The bundle test is MEASURED, not a name lookup — it must fire on a business that never heard
  // of DIW. This is the clause that makes the screen work unedited for the next customer.
  const unnamed = review(
    [item('999', 'Package deal', CARRY, 0, 'Everything in')],
    [tally('999', [600, 450, 250, 1200, 2092, 3400, 875, 1500])],
  );
  ok(unnamed.notSuggesting.some(x => x.name === 'Package deal' && x.bundle),
    '🔴 a bundle nobody named is still caught — by its prices, which is what makes this portable');

  // 🔴 THREE DIFFERENT FIGURES IS NOT A PATTERN, IT IS THREE JOBS. `Backyard Delivery` — $150,
  // $125, $65 on three invoices — must land where she can TYPE a price, not where we tell her it
  // cannot have one. This is the second correction the real capture forced.
  const thin = review(
    [item('1006', 'Backyard Delivery', 'Income', 125, 'Backyard Delivery')],
    [tally('1006', [150, 125, 65])],
  );
  ok(!thin.notSuggesting.some(x => x.name === 'Backyard Delivery'),
    '🔴 three different charges do NOT make a bundle — she gets a price box, not a refusal');
  ok(thin.needsHer.some(x => x.name === 'Backyard Delivery'), '…and it lands where she can price it');

  // 🔴 AND THE MIRROR: a service she prices job by job across MANY jobs is still hers to price.
  // Tree removal — 85 invoices, $50 on 19 of 83 lines — is not a bundle; it is a spread, and a
  // rule keyed on "the top price holds less than a quarter" would take it off her menu entirely.
  const spread = review(
    [item('16', 'TR', LABOUR, 100, 'Existing tree removal')],
    [tally('16', [...Array(19).fill(50), ...Array(16).fill(75), ...Array(14).fill(100),
                  ...Array(12).fill(150), ...Array(11).fill(200), ...Array(11).fill(300)])],
  );
  ok(!spread.notSuggesting.some(x => x.name === 'TR') && spread.needsHer.some(x => x.name === 'TR'),
    '🔴 a price repeated nineteen times is a price she has not SETTLED — never one she cannot have');

  // 🔴 THE NAMED FALLBACK EARNS ITS PLACE ON THE CASE THE MEASUREMENT CANNOT SEE. `FDIW` is her
  // second bundle and it has NEVER been billed, so there are no prices to measure — the only
  // thing that keeps it off the menu is the name. Without this the constant would be decoration.
  const neverBilledBundle = review([item('129', 'FDIW', CARRY, 0, 'Furnish, Deliver, Install and Warranty')], []);
  ok(neverBilledBundle.notSuggesting.some(x => x.name === 'FDIW' && x.bundle),
    '🔴 a bundle with NO invoice lines is caught by name — the measurement has nothing to look at');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §H — THE PLACEMENT LADDER. Measured from the plant lines; a thin rung is dropped, not printed.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const obs = [
    // a 30-gallon oak: bare $350 four times, installed $760 four times → premium $410
    ...Array(4).fill(0).map(() => ({ itemId: 'oak30', size: '30 gal', unitPrice: 350, installed: false })),
    ...Array(4).fill(0).map(() => ({ itemId: 'oak30', size: '30 gal', unitPrice: 760, installed: true })),
    // a 15-gallon redbud: bare $225, installed $447 → premium $222
    ...Array(3).fill(0).map(() => ({ itemId: 'rb15', size: '15', unitPrice: 225, installed: false })),
    ...Array(3).fill(0).map(() => ({ itemId: 'rb15', size: '15', unitPrice: 447, installed: true })),
    // a 95-gallon pine sold installed ONCE — one observation, no rung
    { itemId: 'pine95', size: '95 Gallon', unitPrice: 1000, installed: false },
    { itemId: 'pine95', size: '95 Gallon', unitPrice: 1800, installed: true },
  ];
  const l = buildPlacementLadder(obs);
  const by = new Map(l.rungs.map(r => [r.size, r]));
  // 🔴 THE FIXTURE WRITES THE SIZE THREE DIFFERENT WAYS ON PURPOSE — `30 gal`, `15`, `95 Gallon`.
  // Run against her real books the first draft printed `15 gallon` and `15 Gallon` as two rungs
  // with two different premiums. A ladder keyed on the raw string is a ladder that splits one
  // pot in half, so the fold is what is under test here, not the arithmetic.
  ok(by.get('30 Gallon')?.premium === 410, 'the 30-gallon rung is the measured difference, not an average of prices');
  ok(by.get('15 Gallon')?.premium === 222, 'and the 15-gallon rung is its own arithmetic');
  ok(l.rungs.length === 2 && by.size === 2,
    '🔴 three spellings, two rungs — `30 gal` and `15` fold to the same vocabulary the catalogue uses');
  ok(!by.has('95 Gallon'),
    `🔴 a rung evidenced ONCE is dropped, not printed thin beside one evidenced ${by.get('30 Gallon')?.installedLines} times`);
  ok(l.rungs[0].size === '15 Gallon' && l.rungs[1].size === '30 Gallon', 'and they read smallest pot first');

  // A size fragment that is not a CONTAINER size is dropped rather than printed as a rung — a
  // ladder is read as *what installing this pot costs*, and a row nobody can point at a pot for
  // makes the real rows beside it less believable. Both cases below are real strings from her
  // own descriptions, and they must be treated differently:
  const rung = (size: string) => buildPlacementLadder([
    ...Array(3).fill(0).map(() => ({ itemId: 'p', size, unitPrice: 500, installed: false })),
    ...Array(3).fill(0).map(() => ({ itemId: 'p', size, unitPrice: 900, installed: true })),
  ]).rungs;
  ok(rung('24 inch box').length === 0,
    '🔴 `24 inch box` is not a gallon and is NOT forced into one — dropped, per normalizeSize\'s own scope rule');
  ok(rung('65 Gallon + Installation')[0]?.size === '65 Gallon',
    '…but `65 Gallon + Installation` IS a 65-gallon pot, and folds in beside the others rather than standing alone');
  ok(l.itemsSoldBothWays === 3, 'the population is items sold BOTH ways — the only comparable pair');
  ok(l.medianRatio !== null && l.medianRatio > 1.8 && l.medianRatio < 2.2,
    'installed costs about double, which is the claim the screen makes and the number it prints');

  // A tree sold ONLY installed contributes nothing — there is no bare price to subtract.
  const oneWay = buildPlacementLadder([
    { itemId: 'x', size: '45 gallon', unitPrice: 900, installed: true },
    { itemId: 'x', size: '45 gallon', unitPrice: 900, installed: true },
  ]);
  ok(oneWay.rungs.length === 0 && oneWay.itemsSoldBothWays === 0,
    '🔴 sold only installed ⇒ NO rung — a premium cannot be measured against a price that does not exist');
  ok(buildPlacementLadder([]).medianRatio === null,
    'no observations ⇒ no ratio at all, rather than a confident-looking NaN or 1');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §J — THE WEBSITE REPORTS THE TEST WE RAN, NOT A CONCLUSION ABOUT HER BUSINESS.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // 🔴 THIS IS THE PROBE THAT KILLED TWO CLAIMS, AND IT IS BUILT FROM THE TWO REAL CASES.
  // `DF`'s description reads "Deer Fencing"; her site advertises "deer protection". They are the
  // same service and NO substring test can see that. A screen that printed "your website does not
  // mention it" would be telling a business something false about its own marketing.
  const items = [item('119', 'DF', LABOUR, 75, 'Deer Fencing')];
  const tallies = [tally('119', [75, 75, 75, 100])];
  const r = review(items, tallies, { site: ['deer protection', 'tree selection consultation'] });

  ok(r.siteServices.length === 2, 'every service her site names is listed — nothing is filtered out');
  ok(r.siteServices.every(s => !('price' in s)),
    '🔴 no site row carries a price, ever — a website states none and inventing one is fabrication');

  const deer = r.siteServices.find(s => s.name === 'deer protection')!;
  ok(deer.matchedItem === false,
    '🔴 the words "deer protection" appear in NO item — which is TRUE, and is all we may say');
  ok(r.sure.some(x => x.name === 'DF'),
    '…and `DF` is on the screen as a priced service at the same time, so the two never contradict');

  // The reverse case: wording that DOES match must not be reported as missing.
  const r2 = review([item('185', 'Tree Bubbler', GOODS, 65, 'Adjustable Tree Bubbler')], [],
    { site: ['tree bubbler'] });
  ok(r2.siteServices[0].matchedItem === true, 'wording that matches is reported as matched');

  ok(review(items, tallies, { site: [] }).siteServices.length === 0,
    '🔴 no website read ⇒ NO site rows at all — an empty list must not imply we looked and found nothing');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §K — THE CENSUS. This is the number the import button should be printing.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const items = [
    item('1', 'Oak 45', STOCK, 1250, 'Live Oak 45 Gallon', 'NonInventory'),
    item('2', 'Lacey Oak 45G', STOCK, 375, 'Lacey Oak 45 Gallon'),           // Service typed, a tree
    item('3', 'CD10%', 'Discounts given', -0.1, 'Contractor Discount, 10%'),  // a discount
    item('4', 'TC', CARRY, 50, 'Trip Charge'),                                // a service
    item('5', 'Late fee', 'Late Fee Income', 0, null),                        // not a sale
    item('6', 'Oak', null, null, null, 'Category'),                           // a folder
  ];
  const c = review(items, []).census;
  ok(c.products === 2,
    '🔴 the tree typed `Service` counts as a PRODUCT — this is the +147 the import button is over by');
  ok(c.folders === 1,
    '🔴 and a FOLDER is neither — counting it as a product is how "685" first became "647"');
  ok(c.services === 1 && c.discounts === 1 && c.notASale === 1,
    'and each of the other three destinations gets exactly one');
  ok(c.products + c.services + c.discounts + c.notASale + c.folders === c.total,
    '🔴 the five destinations PARTITION the list — nothing is counted twice and nothing is dropped');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §L — ABSENCE. Nothing read ⇒ nothing claimed.
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const empty = review([], []);
  ok(empty.sure.length === 0 && empty.needsHer.length === 0 && empty.notSuggesting.length === 0,
    'no items ⇒ no suggestions');
  ok(empty.ladder.rungs.length === 0 && empty.ladder.medianRatio === null,
    'and no ladder — absent, not zero (A9)');
  ok(empty.census.total === 0 && empty.census.services === 0, 'and a census of nothing');

  // An item in her list that no invoice ever touched: shown with its LIST price, never suggested.
  const nb = review([item('104', 'Bblr', STOCK, 65, 'Adjustable Tree Bubbler')], []);
  ok(nb.sure.length === 0, 'a list price alone is not evidence of what she charges');
  const routed = nb.routedElsewhere.find(r => r.name === 'Bblr');
  ok(routed !== undefined && routed.listPrice === 65,
    '…and its list price is still shown, so she can see what her own books publish');

  ok(suggestCategory(item('x', 'Y', 'Delivery Income', 1)) === 'transport'
     && suggestCategory(item('x', 'Y', 'Some Other Account', 1)) === null,
    '🔴 a category is SUGGESTED from her account or left blank — never coerced to a default');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §M — THE READ ITSELF. Every § above this one hands the module a tally somebody typed.
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THIS SECTION EXISTS BECAUSE SIXTEEN MUTANTS SURVIVED THE FIRST RUN AND FIVE OF THEM WERE
// HERE. `installInDescription: false` — deleting the whole placement ladder — passed every one of
// the assertions above, because those assertions built their observations by hand and never asked
// the parser for one. **The probes could not reach the thing** (tech-debt #182), which is the
// quieter sibling of a probe that cannot fail. So this § starts from an Intuit-shaped BODY.
{
  const body = (lines: Record<string, unknown>[]) => JSON.stringify({
    QueryResponse: { Invoice: [{
      Id: '1', DocNumber: '100', TxnDate: '2026-01-01', TotalAmt: 0,
      CustomerRef: { value: 'c1', name: 'Someone' }, Line: lines,
    }] },
  });
  const sale = (itemId: string, desc: string, unitPrice: number, qty: number, account: string) => ({
    DetailType: 'SalesItemLineDetail', Description: desc, Amount: unitPrice * qty,
    SalesItemLineDetail: {
      ItemRef: { value: itemId, name: itemId }, UnitPrice: unitPrice, Qty: qty,
      ItemAccountRef: { value: '94', name: account },
    },
  });

  const parsed = parseInvoiceList(body([
    sale('749', 'Live Oak - 45 Gallon (Install & Warranty)', 900, 1, 'Sales of Nursery Stock'),
    sale('749', 'Live Oak - 45 Gallon', 450, 1, 'Sales of Nursery Stock'),
  ])).invoices;

  const l0 = parsed[0].lines[0], l1 = parsed[0].lines[1];
  ok(l0.installInDescription === true && l1.installInDescription === false,
    '🔴 the PARSER decides which line was planted — the ladder has no other source, and reading it wrong is silent');
  ok(l0.itemAccountName === 'Sales of Nursery Stock',
    '🔴 the line carries its OWN income account — the classification axis, read from the record rather than the item');
  ok(l0.sizeFromDescription === '45 Gallon' && l1.sizeFromDescription === '45 Gallon',
    'and the SIZE, so the premium lands on a rung');
  ok(!('description' in l0), 'and NO free text survives the parse — R-24, the same rule the discount flag follows');

  // 🔴 `warranty` ALONE MUST NOT COUNT. A warranty is sold on collected trees too, so counting it
  // marks bare sales as planted and CRUSHES the measured premium toward zero — a wrong number
  // that reads as "placement is worth nothing", which is the opposite of what these books say.
  ok(mentionsInstall('Live Oak - 45 Gallon (Warranty)') === false,
    '🔴 a WARRANTY is not a planting — it is sold on trees the customer collected');
  ok(mentionsInstall('Live Oak (Install & Warranty)') === true, '…but install-and-warranty is');
  ok(mentionsInstall('Deliver, Install and Warranty listed plants') === true, 'and so is the bundle wording');
  ok(mentionsInstall('Planted 3 Live Oaks') === true && mentionsInstall('DIW') === true, 'and both of the other two forms');
  ok(mentionsInstall(null) === false && mentionsInstall('') === false, 'and absent prose asserts nothing');
  ok(INSTALL_WORDING.test('installation') && !INSTALL_WORDING.test('instal'),
    'the wording is whole-word — "instal" is not a claim about anything');

  // ── the evidence extractor, end to end ────────────────────────────────────────────────────
  const ev = readServiceEvidence(parsed);
  ok(ev.placement.length === 2 && ev.placement.filter(o => o.installed).length === 1,
    '🔴 both plant lines reach the ladder and exactly ONE is planted');
  const ladder = buildPlacementLadder(ev.placement);
  ok(ladder.rungs.length === 0, 'one line each way is not three — no rung is printed from it');
  ok(ladder.itemsSoldBothWays === 1 && ladder.medianRatio === 2,
    '…but the ratio IS measurable from one pair, and it reads 2× exactly');

  // 🔴 Qty ABSENT IS ONE OF THE THING. Intuit omits `Qty` on a single-unit line, and reading an
  // absent field as "not one" turns every per-order service into a per-plant one.
  const noQty = parseInvoiceList(JSON.stringify({ QueryResponse: { Invoice: [{
    Id: '2', TxnDate: '2026-01-02', CustomerRef: { value: 'c2' }, Line: [
      { DetailType: 'SalesItemLineDetail', Description: 'Trip Charge', Amount: 50,
        SalesItemLineDetail: { ItemRef: { value: '186' }, UnitPrice: 50,
                               ItemAccountRef: { value: '93', name: 'Delivery Income' } } },
    ] } ] } })).invoices;
  const t = readServiceEvidence(noQty).tallies.find(x => x.itemId === '186')!;
  ok(t.qtyOneLines === 1, '🔴 an ABSENT Qty counts as one — Intuit omits it on a single-unit line');
  ok(t.prices[0].price === 50 && t.zeroLines === 0, 'and the price is the stated UnitPrice, not amount ÷ qty');

  // A line with NO unit price is not a $0 line. Absent is not empty (D-9 / A9).
  const noPrice = parseInvoiceList(JSON.stringify({ QueryResponse: { Invoice: [{
    Id: '3', TxnDate: '2026-01-03', CustomerRef: { value: 'c3' }, Line: [
      { DetailType: 'SalesItemLineDetail', Description: 'A note', Amount: 0,
        SalesItemLineDetail: { ItemRef: { value: '9' } } },
    ] } ] } })).invoices;
  const t2 = readServiceEvidence(noPrice).tallies.find(x => x.itemId === '9')!;
  ok(t2.prices.length === 0 && t2.zeroLines === 1,
    'a line with no stated price is counted apart, never averaged in as $0');
  ok(readPriceEvidence(t2).confidence === 'free', '…and one such line alone cannot be priced');

  // A line whose account is NOT plant stock must never reach the ladder — a trip charge has no
  // "installed" price to compare against, and pooling it would invent a rung out of carriage.
  const carriage = parseInvoiceList(body([
    { DetailType: 'SalesItemLineDetail', Description: 'Trip Charge — installation day', Amount: 50,
      SalesItemLineDetail: { ItemRef: { value: '186' }, UnitPrice: 50, Qty: 1,
                             ItemAccountRef: { value: '93', name: 'Delivery Income' } } },
  ] as Record<string, unknown>[])).invoices;
  ok(readServiceEvidence(carriage).placement.length === 0,
    '🔴 a delivery line saying "installation day" is NOT a plant — the ladder reads the ACCOUNT, not the prose');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §N — THE DECLARED LISTS ARE PROVEN AGAINST THE MIGRATION, NOT TRUSTED. [[#179]]
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 `VENDORS_SELECT` NAMED TEN COLUMNS WHILE ITS MIGRATION CREATED FOURTEEN, AND THE FOUR MISSING
// WERE THE ADDRESS. Nothing we own could have caught it: a column with no reader and no writer is
// invisible to tsc, eslint, knip and every probe. So the three vocabularies this module declares —
// the select, the category CHECK and the price_unit CHECK — are parsed OUT OF THE MIGRATION here
// and compared, in both directions.
{
  // Read from the repo root, the way every other migration-parsing probe in this repo does —
  // `import.meta.url` does not survive the CJS bundle the runner produces.
  const sql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260529_businesses_f_service_offerings.sql'), 'utf8');
  const between = (start: string, end: string) => {
    const a = sql.indexOf(start); const b = sql.indexOf(end, a);
    return a < 0 || b < 0 ? '' : sql.slice(a, b);
  };
  const valuesOf = (col: string): string[] => {
    const m = sql.match(new RegExp(`${col}\\s+text[^\\n]*\\n?[^\\n]*CHECK\\s*\\(\\s*${col}\\s+IN\\s*\\(([^)]*)\\)`, 'i'));
    return m ? m[1].split(',').map(v => v.trim().replace(/^'|'$/g, '')).filter(Boolean) : [];
  };

  // ── the CHECK vocabularies, both directions ───────────────────────────────────────────────
  const cats = valuesOf('category');
  ok(cats.length === 5, `the migration's category CHECK holds five values (parsed ${cats.length})`);
  ok(cats.every(c => (SERVICE_CATEGORIES as readonly string[]).includes(c)),
    '🔴 every value the DATABASE accepts is offered — a missing one is a service she cannot classify');
  ok(SERVICE_CATEGORIES.every(c => cats.includes(c)),
    '🔴 and every value we offer is one the DATABASE accepts — the other direction, which is the one `uncategorized` fails');
  ok(!cats.includes('uncategorized'),
    '🔴 `uncategorized` is NOT in the CHECK — which is why `seedServiceOfferings` silently drops its batch (tech-debt #217)');

  const units = valuesOf('price_unit');
  ok(units.length === 4 && units.every(u => (PRICE_UNITS as readonly string[]).includes(u))
     && PRICE_UNITS.every(u => units.includes(u)),
    '🔴 the price_unit vocabulary matches the migration in BOTH directions');

  // ── the SELECT projection: every column named must exist in the CREATE TABLE ──────────────
  const create = between('CREATE TABLE IF NOT EXISTS service_offerings', 'ALTER TABLE service_offerings');
  ok(create.length > 0, 'the CREATE TABLE block is found — if it is not, nothing below asserts anything');
  const selected = SERVICE_OFFERING_SELECT.split(',').map(c => c.trim());
  ok(selected.length === 5, 'the projection names five columns');
  for (const col of selected) {
    ok(new RegExp(`(^|\\n)\\s+${col}\\s`, 'i').test(create),
      `🔴 \`${col}\` is a real column on service_offerings — proven against the migration, not assumed`);
  }
  ok(!selected.includes('*'), 'and it is a projection, never a star — the record shape belongs to the editor');

  // The reader is one function, so a column added to the list without a field to put it in fails here.
  const shaped = toExistingOffering({ id: 'x', name: 'TC', price: 50, price_unit: 'order', is_active: true });
  ok(shaped.id === 'x' && shaped.name === 'TC' && shaped.price === 50
     && shaped.priceUnit === 'order' && shaped.isActive === true,
    'the ONE reader maps every selected column — three call sites, one shape');
  const missing = toExistingOffering({ id: 'y' });
  ok(missing.price === null && missing.priceUnit === null && missing.isActive === false,
    '🔴 an absent price reads as NULL, never as $0 — absent is not empty (A9)');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// §O — THE FIELD THE ENDPOINT ACTUALLY RETURNS. [[#182]] AGAIN, AND IT REACHED A CUSTOMER SCREEN.
// ══════════════════════════════════════════════════════════════════════════════════════════════
// 🔴 EVERY § ABOVE HANDS `classifyDestination` AN OBJECT THIS FILE BUILT. Not one of them asked
// `/api/qbo/items` what its rows are shaped like — so when the screen read `i.incomeAccountName`
// and the endpoint returns `i.incomeAccount`, **125 green assertions and 48 caught mutants had
// nothing to say about it.** The account was `undefined` on all 685 of LAWNS's items, the
// classification axis was dead, and the screen offered her own trees back to her as services.
// The probes could not reach the seam; mutant C1 guards the module, and the module was fine.
//
// This § starts from an Intuit body, runs it through the REAL parser, and asserts on the field
// name the parser actually produces — so a rename on either side fails here instead of on screen.
{
  const body = JSON.stringify({ QueryResponse: { Item: [
    { Id: '76',  Name: 'Lacey Oak 45G', Description: 'Lacey Oak 45 Gallon', Type: 'Service',
      UnitPrice: 375, IncomeAccountRef: { value: '94', name: 'Sales of Nursery Stock' } },
    { Id: '186', Name: 'TC', Description: 'Trip Charge', Type: 'Service',
      UnitPrice: 50, IncomeAccountRef: { value: '93', name: 'Delivery Income' } },
    { Id: '1116', Name: 'Late fee', Type: 'Service',
      UnitPrice: 0, IncomeAccountRef: { value: '118', name: 'Late Fee Income' } },
  ] } });
  const parsed = parseItemList(body).items;
  ok(parsed.length === 3, 'the parser reads the three rows');

  // 🔴 THE ASSERTION THAT WOULD HAVE CAUGHT IT: the account arrives under the name the ENDPOINT
  // uses, and `incomeAccountName` is NOT that name. Both directions, so a rename either way fails.
  const first = parsed[0] as unknown as Record<string, unknown>;
  ok(first.incomeAccount === 'Sales of Nursery Stock',
    '🔴 the endpoint returns the account as `incomeAccount` — this is the field a caller must read');
  ok(!('incomeAccountName' in first),
    '🔴 and it does NOT return `incomeAccountName` — the name the screen read for a day');

  // The mapping the screen performs, written the way the screen writes it, then classified.
  const mapped: ServiceItemFact[] = parsed.map(i => ({
    id: i.id, name: i.name, description: i.description,
    unitPrice: i.unitPrice, type: i.type,
    incomeAccountName: (i as unknown as { incomeAccount: string | null }).incomeAccount ?? null,
  }));
  ok(mapped.every(m => m.incomeAccountName !== null),
    '🔴 EVERY mapped row carries an account — a null here is the defect, and it was null on 685 of 685');

  const d = mapped.map(classifyDestination);
  ok(d[0].destination === DESTINATIONS.product,
    '🔴 the tree routes to PRODUCTS through the real parser — not just through a hand-built fixture');
  ok(d[1].destination === DESTINATIONS.service, 'the trip charge routes to SERVICES');
  ok(d[2].destination === DESTINATIONS.notASale, '🔴 the late fee routes to BOOKKEEPING — the counter that read 0');

  const census = buildServiceReview({ items: mapped, tallies: [], existing: [], placement: [], siteServices: [] }).census;
  ok(census.products === 1 && census.services === 1 && census.notASale === 1,
    '🔴 and the CENSUS is right end to end — the line that printed "0 are bookkeeping" above two bookkeeping rows');
}

console.log(`\n  serviceReview — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
