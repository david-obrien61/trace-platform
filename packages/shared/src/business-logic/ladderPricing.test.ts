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
  ladderBlocksOrder, ladderUnpricedWords,
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
): Rung => ({
  label, aliases, sortOrder, volumeGallons,
  handlingMinutes: null, handlingBecause: 'not timed',
  installTPostsPerTree: 0, installTPostsBecause: 'LAWNS, David 2026-09-12',
  caliperMinInches: null, caliperMaxInches: null, caliperBecause: 'not set',
  installPrice,
  installPriceBecause: installPrice == null ? 'Not priced. Lauren\'s sheet covers 15/30/45/65/95 only.' : 'LAWNS billed median, measured 2026-09-23.',
  // ledger #399 — PYT is a LAST parameter with a null default, so every existing call above keeps
  // its meaning and the PYT ladder is, as live, entirely unpriced unless a case says otherwise.
  // the shapes did not sufficiently overlap — which was it telling me the fixture was missing two
  // real fields. A cast would have silenced the one thing standing between a fixture and the type
  // it claims to be (tech-debt #138's class: a double more forgiving than the real system).
  growMonths: null, growBecause: 'not set',
  holdMonths: null, holdBecause: 'not set',
  sellability: 'sold', sellabilityBecause: 'not set',
  active,
});

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

// ── §J — ONE PRICE COLUMN FOR EVERY LADDER-PRICED SERVICE (ledger #404) ─────────────────────
// 🔴 DAVID'S CORRECTION OF 2026-09-24: *"PLANT YOUR TREE uses the INSTALL LADDER'S PRICES per
// container size… 15 gal → the install from ladder."* #399 had given it a SECOND column and seeded
// none of it, so switching its `price_source` would have made every Plant Your Tree line unpriced.
// These probes assert the correction rather than describing it.
{
  const LAD: Ladder = [
    rung('15 gal', 40, 15, 204),
    rung('30 gal', 50, 30, null),   // a rung the install ladder itself does not price
    rung('45 gal', 60, 45, 450),
  ];
  const ADDON = { category: 'addon' };        // Plant Your Tree
  const TRANSPORT = { category: 'transport' };// Installation

  const pyt = priceLinesFromLadder(LAD, [{ size: '15 gal', quantity: 2, name: 'Their olive' }], ADDON);
  ok(pyt.lines[0].unitPrice === 204 && pyt.lines[0].lineTotal === 408,
    '🔴 §J Plant Your Tree takes the INSTALL price off the rung — 15 gal → 204, ×2 = 408');
  const inst = priceLinesFromLadder(LAD, [{ size: '15 gal', quantity: 2 }], TRANSPORT);
  ok(inst.lines[0].unitPrice === 204,
    '§J …and install reads the same number, because there is only one');
  ok(priceLinesFromLadder(LAD, [{ size: '15 gal', quantity: 2 }]).lines[0].unitPrice === 204,
    '§J …and so does a caller that names no service at all');

  // 🔴 THE NEGATIVE CONTROL THAT WOULD HAVE CAUGHT #399's DEFECT. A ladder where the install price
  // exists proves nothing on its own; what proves the correction is that NOTHING reads a second
  // column any more. `pyt_price` is not on `Rung` and cannot be.
  ok(!('pytPrice' in (LAD[0] as unknown as Record<string, unknown>)),
    '🔴 §J the Rung carries NO second price field — the one #399 added is gone from the type');

  const unpriced = priceLinesFromLadder(LAD, [{ size: '30 gal', quantity: 1, name: 'Their maple' }], ADDON);
  ok(unpriced.lines[0].unitPrice === null && unpriced.lines[0].needsAmount,
    '§J a rung the ladder does not price asks, for an addon as for an install — never 0');
}

// ── §K — WHETHER AN UNPRICED LINE STOPS THE SALE IS DECIDED BY `category`, NEVER BY THE NAME ──
// 🔴 THIS IS THE ONE JUDGEMENT IN THE MODULE RATHER THAN A QUOTED RULING, AND IT IS ASSERTED HERE
// SO IT IS VISIBLE. The two behaviours are David's, a day apart: an unpriced INSTALL refuses
// (2026-09-23 (c), *"never $0, never a guess, never refused"*), an unpriced PLANT YOUR TREE does
// not (2026-09-24, *"the installer identifies it on the install day and LAWNS AMENDS the order"*).
// With the name-match retired, `category` is the only existing column that separates them.
{
  ok(ladderBlocksOrder({ category: 'transport' }) === true,
    '🔴 §K a TRANSPORT row blocks — it is part of how the order is fulfilled, so an order that cannot price it cannot go');
  ok(ladderBlocksOrder({ category: 'addon' }) === false,
    '🔴 §K an ADDON does not — an extra nobody has priced yet can be added later, by amendment');
  ok(ladderBlocksOrder(null) === true && ladderBlocksOrder({}) === true,
    '🔴 §K AN OFFERING WITH NO CATEGORY BLOCKS, and the direction is the whole point: refusal charges MORE, never less (§1.6 gate 10). A missing column can then only ever stop a sale until somebody types a number — it can never put a silently free line on an invoice.');
  ok(ladderBlocksOrder({ category: 'maintenance' }) === true && ladderBlocksOrder({ category: 'Addon' }) === true,
    '§K …and so does any other category, including a near-miss on the spelling — `category` is CHECK-constrained, so `Addon` is a bug rather than a spelling to tolerate');
}

// ── §L — THE TWO SENTENCES, AND WHY THEY DIFFER ─────────────────────────────────────────────
{
  const LAD: Ladder = [rung('15 gal', 40, 15, 204)];
  const addon = priceLinesFromLadder(LAD, [{ size: null, quantity: 1, name: 'Their olive' }], { category: 'addon' });
  const transport = priceLinesFromLadder(LAD, [{ size: null, quantity: 1 }], { category: 'transport' });
  ok(/confirmed on install day/i.test(addon.lines[0].reason),
    `🔴 §L for a tree the CUSTOMER OWNS an unknown size is a PLAN — "${addon.lines[0].reason}"`);
  ok(!/confirmed on install day/i.test(transport.lines[0].reason),
    '🔴 §L for a tree the business is DELIVERING it is a GAP — the two must not read the same');
  ok(addon.lines[0].reason.includes(transport.lines[0].reason),
    '§L …and the addon WRAPS the resolver\'s own words rather than replacing them, so nothing is lost');
  ok(addon.lines[0].unitPrice === null && addon.lines[0].lineTotal === null,
    '§L both are unpriced — never 0, which would read as free');

  const w = ladderUnpricedWords({ category: 'addon' });
  ok(/amend the order/i.test(w.unpriced('15 gal')),
    '§L the addon\'s unpriced-rung sentence names the WAY OUT, not just the absence');
  ok(/with a reason/i.test(ladderUnpricedWords({ category: 'transport' }).unpriced('15 gal')),
    '§L the transport one asks for an amount AND a reason (STD-013)');
}

console.log(`\n  ladderPricing: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
