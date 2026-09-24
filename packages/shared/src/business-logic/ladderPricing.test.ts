/**
 * ── ladderPricing — a service priced per container size, and the refusal to invent a price ─────
 *
 * WHAT THIS GUARDS. David ruled 2026-09-23 that install is priced BY CONTAINER SIZE, seeded from
 * what LAWNS actually bills, and — clause (c) — that *"A RUNG WITH NO PRICE: offer install and
 * REQUIRE A TYPED AMOUNT with a reason — never $0, never a guess, never refused."* Three of those
 * four words are prohibitions, so most of this file is negative: it asserts what must NOT come out.
 *
 * 🔴 THE FIXTURE IS LAWNS'S LIVE LADDER AND LAWNS'S LIVE SIZES, MEASURED 2026-09-23, NOT INVENTED.
 * The nine rungs are the nine rows in `container_ladder`; the seeded prices are the billed medians
 * `20260923e_container_ladder_install_price.sql` writes; the sizes fed in are the actual spellings
 * in `business_inventory.size` ("15 gallon" 140 rows · "15 Gallon" 75 · "1G" 15 · "5 gal" 10 …).
 * A fixture of tidy invented strings would prove the function works on tidy invented strings.
 *
 * Run: node scripts/run-tests.mjs ladderPricing
 */
import {
  priceLinesFromLadder, usesLadderPricing, LADDER_PRICE_SOURCE,
  ladderPriceKindFor, LADDER_PRICE_KINDS,
} from './ladderPricing';
import type { Ladder, Rung } from '../inventory/containerLadder';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg); console.error('   ✗ ' + msg);
}

const rung = (
  label: string, sortOrder: number, volumeGallons: number | null,
  installPrice: number | null, aliases: string[] = [], active = true,
  pytPrice: number | null = null,
): Rung => ({
  label, aliases, sortOrder, volumeGallons,
  handlingMinutes: null, handlingBecause: 'not timed',
  installTPostsPerTree: 0, installTPostsBecause: 'LAWNS, David 2026-09-12',
  caliperMinInches: null, caliperMaxInches: null, caliperBecause: 'not set',
  installPrice,
  installPriceBecause: installPrice == null ? 'Not priced. Lauren\'s sheet covers 15/30/45/65/95 only.' : 'LAWNS billed median, measured 2026-09-23.',
  // ledger #399 — PYT is a LAST parameter with a null default, so every existing call above keeps
  // its meaning and the PYT ladder is, as live, entirely unpriced unless a case says otherwise.
  pytPrice,
  pytPriceBecause: pytPrice == null
    ? 'Not set. LAWNS has invoiced five Plant Your Tree lines ever and every one is a tree the customer already owned.'
    : 'set by hand for this case',
  active,
} as Rung);

// LAWNS's live ladder + the seed the migration writes. slip / 4 in / 3-5 / 200 carry NO price.
const LADDER: Ladder = [
  rung('slip',     10, null, null, ['slips', 'cutting', 'cuttings']),
  rung('4 in',     20, null, null, ['4"', '4 inch', '4in']),
  rung('3/5 gal',  30, 4,    null, ['#3/5', '3/5 Gallon']),
  rung('15 gal',   40, 15,   204),
  rung('30 gal',   50, 30,   425),
  rung('45 gal',   60, 45,   450),
  rung('65 gal',   70, 65,   650),
  rung('95/100',   80, 95,   800, ['95 gal', '100 gal', '95 gallon', '100 gallon']),
  rung('200 gal',  90, 200,  null),
];

// ── §A — THE SPELLINGS LAWNS ACTUALLY STORES ALL LAND ON THE RIGHT RUNG ──────────────────────
// 🔴 This is the claim that makes the ladder the right home: no special case, no normalisation
// table, no size parsed here. `resolveRung` tries label → alias → number, and the number comes
// from the parser. "1G" resolving is the tell — nobody declared that spelling anywhere.
{
  const spellings = [
    ['15 gallon', 204], ['15 Gallon', 204], ['15 gal', 204], ['15', 204],
    ['30 gallon', 425], ['30 Gallon', 425],
    ['45 gallon', 450], ['45 Gallon', 450],
    ['65 gallon', 650], ['95 gallon', 800], ['95 Gallon', 800],
    ['100 gal', 800],   // 🔴 by ALIAS — volume_gallons is 95, so a numeric join would MISS this
  ] as const;
  for (const [size, expected] of spellings) {
    const p = priceLinesFromLadder(LADDER, [{ size, quantity: 1 }]);
    ok(p.lines[0].unitPrice === expected, `§A "${size}" prices at $${expected} (got ${String(p.lines[0].unitPrice)})`);
  }
  ok(priceLinesFromLadder(LADDER, [{ size: '100 gal', quantity: 1 }]).lines[0].rungLabel === '95/100',
    '§A 🔴 "100 gal" lands on the 95/100 rung BY ALIAS — matching on volume_gallons alone would have missed it');
}

// ── §B — THE ARITHMETIC ACROSS A REAL MULTI-LINE CART ────────────────────────────────────────
{
  const p = priceLinesFromLadder(LADDER, [
    { size: '15 gallon', quantity: 3, name: 'Wax Myrtle' },   // 3 × 204 = 612
    { size: '45 Gallon', quantity: 2, name: 'Shumard Red Oak' }, // 2 × 450 = 900
  ]);
  ok(p.lines[0].lineTotal === 612 && p.lines[1].lineTotal === 900, '§B each line is unit × qty');
  ok(p.pricedTotal === 1512, '§B the total is the sum — 3×$204 + 2×$450 = $1,512');
  ok(p.allPriced && p.linesNeedingAmount === 0, '§B nothing is owed when every rung carries a price');
  ok(p.quantityNeedingAmount === 0, '§B and no units are waiting on a typed amount');
}

// ── §C — 🔴 A RUNG WITH NO PRICE: NOT SET, NOT ZERO, NOT REFUSED (ruling (c)) ─────────────────
{
  const p = priceLinesFromLadder(LADDER, [{ size: '200 gal', quantity: 1, name: 'Live Oak' }]);
  const l = p.lines[0];
  ok(l.needsAmount === true, '§C a rung with no price asks for an amount');
  ok(l.unitPrice === null && l.lineTotal === null, '§C 🔴 and it is NULL — never 0, which would read as a free install');
  ok(l.rungLabel === '200 gal', '§C the rung is still identified — the size resolved, the price did not');
  ok(/200 gal/.test(l.reason) && /reason/i.test(l.reason), '§C the reason NAMES the rung and says a reason is required');
  ok(p.pricedTotal === 0 && p.linesNeedingAmount === 1,
    '§C 🔴 pricedTotal is 0 because NOTHING is priced — it is a sum of nothing, not a price of zero');
  ok(p.allPriced === false, '§C the order is not fully priced, and says so');
}

// ── §D — 🔴 A MIXED CART IS THE COMMON CASE AND MUST NOT BE ROUNDED OFF EITHER WAY ───────────
// Measured 2026-09-23: 364 of LAWNS's 632 live lots sit on a priced rung and 268 do not. So the
// ordinary order has both. The priced part must still be priced; the rest must still be owed.
{
  const p = priceLinesFromLadder(LADDER, [
    { size: '30 gallon', quantity: 2 },  // 850
    // 🔴 '7 gallon', NOT '3 gallon', AND THE CORRECTION IS WORTH RECORDING. A first draft used
    // "3 gallon" as the off-ladder case and it RESOLVED: the `3/5 gal` rung's label parses as a
    // RANGE, so `numericKeysOf` gives it BOTH 3 and 5 and a 3-gallon lot lands on it (R-157 §4 —
    // "the rung claims 3 and 5 … Terry's position, not an inference"). The same mistake was in
    // the 2026-09-23 recon, which counted off-ladder lots with a SQL join on `volume_gallons`
    // and so reported 3- and 5-gallon lots as unmatched. Joining on the number is exactly what
    // the resolver exists to stop anyone doing. 7 gal is genuinely on no rung.
    { size: '7 gallon',  quantity: 5 },  // off the ladder entirely
    { size: '200 gal',   quantity: 1 },  // on the ladder, unpriced
  ]);
  ok(p.pricedTotal === 850, '§D the priced line still totals $850');
  ok(p.linesNeedingAmount === 2, '§D both unpriced lines are owed — the off-ladder one and the unpriced rung');
  ok(p.quantityNeedingAmount === 6, '§D and it is 6 UNITS owed, not 2 — the typed amount has to cover trees, not rows');
  ok(p.lines[1].rungLabel === null && p.lines[2].rungLabel === '200 gal',
    '§D 🔴 the two refusals are DIFFERENT facts: one reached no rung, the other reached one with no price');
}

// ── §E — 🔴 THE FOUR REFUSAL REASONS ARE THE RESOLVER'S OWN, NOT REWRITTEN HERE ───────────────
// R-157: *"no size parsed outside the resolver."* If this module wrote its own sentences there
// would be two vocabularies for one fact. These assert the resolver's wording reaches the caller.
{
  const blank  = priceLinesFromLadder(LADDER, [{ size: null, quantity: 1 }]).lines[0];
  const off    = priceLinesFromLadder(LADDER, [{ size: '7 gallon', quantity: 1 }]).lines[0];
  const weird  = priceLinesFromLadder(LADDER, [{ size: 'zzzz', quantity: 1 }]).lines[0];
  ok(blank.needsAmount && /No size recorded/i.test(blank.reason), '§E no size ⇒ the resolver\'s "No size recorded" reaches the line');
  ok(off.needsAmount && /not one of this nursery's container sizes/i.test(off.reason), '§E a real size we do not stock says exactly that');
  ok(weird.needsAmount && /could not read/i.test(weird.reason), '§E an unreadable size is a THIRD, different sentence');
  ok(blank.reason !== off.reason && off.reason !== weird.reason,
    '§E 🔴 all three differ — collapsing them into "no price" is the lie A9 forbids');
}

// ── §F — 🔴 A RETIRED RUNG STILL PRICES (R-133: retire never means delete) ────────────────────
{
  const retired: Ladder = LADDER.map(r => r.label === '65 gal' ? { ...r, active: false } : r);
  const p = priceLinesFromLadder(retired, [{ size: '65 gallon', quantity: 1 }]);
  ok(p.lines[0].unitPrice === 650 && !p.lines[0].needsAmount,
    '§F a retired rung still prices — a past lot points at it, and retiring a size must not break a sale');
}

// ── §G — THE OPT-IN. A service prices from the ladder only if it SAYS so. ─────────────────────
// 🔴 The named negative control is Test Dave's live `Placement Service`: staff, per_unit, per
// plant, $225 — the exact shape LAWNS's install takes. Inferring from shape would re-price it.
{
  ok(usesLadderPricing({ price_source: LADDER_PRICE_SOURCE }), '§G a row that says container_ladder uses the ladder');
  ok(!usesLadderPricing({ price_source: 'fixed' }), '§G a fixed row does not');
  ok(!usesLadderPricing({}), '§G 🔴 a row with NO price_source does not — every row before 2026-09-23, unchanged');
  ok(!usesLadderPricing(null) && !usesLadderPricing(undefined), '§G and a missing offering is not a ladder-priced one');
}

// ── §H — NEGATIVE CONTROLS ON THE NUMBERS THEMSELVES ─────────────────────────────────────────
{
  const zero = priceLinesFromLadder(LADDER, [{ size: '15 gallon', quantity: 0 }]);
  ok(zero.lines[0].lineTotal === 0 && !zero.lines[0].needsAmount,
    '§H a zero quantity is a zero LINE TOTAL, not a missing price — quantity is the cart\'s business');
  ok(priceLinesFromLadder(LADDER, []).pricedTotal === 0 && priceLinesFromLadder(LADDER, []).allPriced,
    '§H an empty cart is fully priced at $0 — vacuously, and without asking for an amount');
  const money = priceLinesFromLadder([rung('x', 1, 1, 33.335)], [{ size: 'x', quantity: 3 }]);
  ok(money.lines[0].unitPrice === 33.34 && money.lines[0].lineTotal === 100.01,
    '§H money is rounded to cents at both the unit and the line, so a total cannot carry a fraction of a cent');
  ok(priceLinesFromLadder([], [{ size: '15 gallon', quantity: 1 }]).linesNeedingAmount === 1,
    '§H 🔴 an EMPTY ladder prices nothing and asks — it does not fall back to some default price');
}

// ── §J — PLANT YOUR TREE: THE SAME MODULE, A DIFFERENT RUNG FIELD (ledger #399) ──────────────
// 🔴 WHAT THIS SECTION IS REALLY GUARDING IS THAT THERE IS NO SECOND MODULE. David ruled on
// 2026-09-23, about search: *"inventory already has the filter type function, why not reuse that
// like we should."* A `plantingPricing.ts` would have been the same mistake one file over, so the
// service is a PARAMETER — and these probes prove the parameter actually reaches the price.
{
  // A ladder where install and planting DISAGREE at every rung. If the kind were ignored — the
  // shape a copy-paste would produce — every assertion below would read the install number.
  const BOTH: Ladder = [
    rung('15 gal', 40, 15, 204, [], true, 90),
    rung('30 gal', 50, 30, 425, [], true, null),   // priced to install, NOT to plant
    rung('45 gal', 60, 45, 450, [], true, 150),
  ];

  const plant = priceLinesFromLadder(BOTH, [{ size: '15 gal', quantity: 2, name: 'Their olive' }], 'planting');
  ok(plant.lines[0].unitPrice === 90 && plant.lines[0].lineTotal === 180,
    '🔴 §J the planting kind reads pytPrice (90), NOT installPrice (204) — the parameter reaches the money');
  const inst = priceLinesFromLadder(BOTH, [{ size: '15 gal', quantity: 2 }], 'install');
  ok(inst.lines[0].unitPrice === 204,
    '§J …and the install kind is unchanged by any of this');
  ok(priceLinesFromLadder(BOTH, [{ size: '15 gal', quantity: 2 }]).lines[0].unitPrice === 204,
    '🔴 §J the DEFAULT is still install — every caller written before #399 keeps its exact meaning');

  // A rung priced for install and not for planting: the planting line must ASK, not borrow.
  const borrow = priceLinesFromLadder(BOTH, [{ size: '30 gal', quantity: 1, name: 'Their maple' }], 'planting');
  ok(borrow.lines[0].unitPrice === null && borrow.lines[0].needsAmount,
    '🔴 §J a rung with an install price but NO planting price asks — it never borrows the install figure');
  ok(/Plant Your Tree price is set for 30 gal/.test(borrow.lines[0].reason),
    `§J …and it names the rung and the service, so the person reading can fix it — "${borrow.lines[0].reason}"`);

  // 🔴 THE UNKNOWN SIZE — DAVID'S ACTUAL SENTENCE, 2026-09-24. For a tree LAWNS did not sell, the
  // customer often does not know their own pot. That is a PLAN, not a data-entry failure, and the
  // two must not read the same.
  const unknown = priceLinesFromLadder(BOTH, [{ size: null, quantity: 1, name: 'Their olive' }], 'planting');
  ok(unknown.lines[0].needsAmount && unknown.lines[0].unitPrice === null && unknown.lines[0].lineTotal === null,
    '§J an unknown size is unpriced — never 0, which would be a free planting');
  ok(/confirmed on install day/i.test(unknown.lines[0].reason),
    `§J 🔴 …and it says the size is confirmed on the install day — "${unknown.lines[0].reason}"`);
  const unknownInstall = priceLinesFromLadder(BOTH, [{ size: null, quantity: 1 }], 'install');
  ok(!/confirmed on install day/i.test(unknownInstall.lines[0].reason),
    '🔴 §J the INSTALL says something different for the same missing size — the two kinds do not share one sentence');
  ok(unknownInstall.lines[0].reason.length > 0 && unknown.lines[0].reason.includes(unknownInstall.lines[0].reason),
    '§J …and planting WRAPS the resolver\'s own words rather than replacing them, so the reason is not lost');

  // A mixed cart: the priced part is charged, the rest is owed. Nothing is silently dropped.
  const mixed = priceLinesFromLadder(BOTH, [
    { size: '15 gal', quantity: 1, name: 'Theirs A' },
    { size: '45 gal', quantity: 2, name: 'Theirs B' },
    { size: null,     quantity: 1, name: 'Theirs C' },
  ], 'planting');
  ok(mixed.pricedTotal === 390 && mixed.linesNeedingAmount === 1 && mixed.quantityNeedingAmount === 1,
    `§J a mixed cart charges what it can (90 + 300 = ${mixed.pricedTotal}) and counts what it cannot (${mixed.linesNeedingAmount})`);
  ok(!mixed.allPriced, '§J …and it does not claim to be fully priced');
}

// ── §K — `blocksOrder` IS A RULING, AND IT IS DECLARED IN EXACTLY ONE PLACE ──────────────────
// 🔴 THE TWO SERVICES DIVERGE HERE AND NOWHERE ELSE, WHICH IS WHY IT IS A TABLE AND NOT AN `if`
// IN TWO FILES. Install: *"never $0, never a guess, never refused"* (David, 2026-09-23 (c)) — the
// order stops until someone types an amount. Planting: *"'I don't know' → the installer identifies
// it on the install day and LAWNS AMENDS the order"* (David, 2026-09-24) — the order goes.
// CartReview's Send guard and submit.ts's 422 both read this; if it were written out at each site
// they could disagree, and the disagreement would be a sale silently blocked or silently free.
{
  ok(LADDER_PRICE_KINDS.install.blocksOrder === true,
    '🔴 §K an unpriced INSTALL blocks the order — David 2026-09-23 (c), "never a guess"');
  ok(LADDER_PRICE_KINDS.planting.blocksOrder === false,
    '🔴 §K an unpriced PLANTING does NOT block — David 2026-09-24, it is amended on the install day');
  ok(LADDER_PRICE_KINDS.install.price === 'installPrice' && LADDER_PRICE_KINDS.planting.price === 'pytPrice',
    '§K each kind names the rung field it reads, so adding a third service is a row here and no new module');
  ok(LADDER_PRICE_KINDS.install.because === 'installPriceBecause' && LADDER_PRICE_KINDS.planting.because === 'pytPriceBecause',
    '§K …and the reason field travels with it, so a price can never be shown without its provenance');
  const kinds = Object.keys(LADDER_PRICE_KINDS);
  ok(kinds.length === 2 && kinds.includes('install') && kinds.includes('planting'),
    `§K the table holds exactly the two services that exist today (${kinds.join(', ')}) — a third would need its own probes`);
}

// ── §L — WHICH SERVICE IS WHICH ─────────────────────────────────────────────────────────────
// ⚠️ THE HONEST LIMIT, SAID RATHER THAN HIDDEN: this reads the offering's NAME, because
// `service_offerings` has no column saying which ladder price a row reads. That is a real weakness
// — renaming the row in Settings changes the price it reads — and it is recorded in the close-out
// rather than left for someone to find. The alternative was a migration adding a `ladder_price_kind`
// column, which is the right answer and is a decision for David, not a default taken here.
{
  ok(ladderPriceKindFor({ name: 'Plant Your Tree' }) === 'planting', '§L the PYT row prices by the planting rung');
  ok(ladderPriceKindFor({ name: 'plant your tree' }) === 'planting', '§L …case does not matter');
  ok(ladderPriceKindFor({ name: 'Installation' }) === 'install', '§L the install row prices by the install rung');
  ok(ladderPriceKindFor({ name: 'Tailgate Delivery' }) === 'install',
    '🔴 §L anything else falls back to INSTALL, the blocking kind — an unknown service must not become the one that can be free');
  ok(ladderPriceKindFor(null) === 'install' && ladderPriceKindFor({}) === 'install',
    '§L a missing name falls back the same way');
}

console.log(`\n  ladderPricing: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
