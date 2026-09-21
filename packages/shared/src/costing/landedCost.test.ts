/**
 * ── landedCost — what a purchase cost once the freight is on it (ledger #370) ────────
 *
 * 🔴 THE FIXTURES ARE TWO REAL LAWNS RECEIPTS, READ LIVE 2026-09-21, NOT INVENTED:
 *   · Bailey Bark 2026-07-07, header $2,316.03 — ONE goods line and NINE captured elements
 *     (freight ×3, bark ×3, fuel ×3). Deduped they match the header; raw they treble it. This is
 *     the receipt [[R-118]] is about: $13.75 a line, $30.88 landed.
 *   · bwi 2026-09-02, header $647.79 — FOUR goods lines, $16.61 fuel, a $0 tax line. This is where
 *     the two spreads part company.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/costing/landedCost.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import {
  allocateCents, classifyReceiptLine, landedCostForReceipt, reconciliationNote, type ReceiptLineInput,
} from './landedCost';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── the live fixtures ──────────────────────────────────────────────────────────────
const BARK_LINE = { description: 'Bailey Bark Shook Out Brown (Yard)', quantity: 75, amount: 1031.25, unit_price: 13.75 };
const BARK_FREIGHT = { description: 'FREIGHT', quantity: 245, amount: 1127, unit_price: 4.6 };
const BARK_FUEL = { description: 'Fuel Surcharge', quantity: 0.14, amount: 157.78, unit_price: 1127 };
/** As captured: nine elements, three of each. */
const BAILEY_RAW: ReceiptLineInput[] = [
  BARK_FREIGHT, BARK_FUEL, BARK_LINE, { ...BARK_FREIGHT }, { ...BARK_FUEL }, { ...BARK_LINE },
  { ...BARK_FREIGHT }, { ...BARK_LINE }, { ...BARK_FUEL },
];
const BAILEY_HEADER = 2316.03;

const BWI: ReceiptLineInput[] = [
  { description: 'Ferrous Iron Sulfate 20S - 50 lb', quantity: 2, amount: 54.74, unit_price: 27.37 },
  { description: 'Osmocote Blend 21-4-8 (12-14M) - 50 lb', quantity: 4, amount: 272.96, unit_price: 68.24 },
  { description: 'Gardenline Lawn & Garden 19-5-9 Fertilizer - 40 lb', quantity: 2, amount: 50.88, unit_price: 25.44 },
  { description: 'Hi-Yield Iron Plus Soil Acidifier 11-0-0 - 20 lb', quantity: 12, amount: 252.6, unit_price: 21.05 },
  { description: 'FUEL Surcharge', amount: 16.61 },
  { description: 'Tax', amount: 0 },
];
const BWI_HEADER = 647.79;

// ══ §A WHAT A LINE IS ══════════════════════════════════════════════════════════════
{
  ok(classifyReceiptLine(BARK_LINE) === 'goods', 'A1: a material line is goods');
  ok(classifyReceiptLine(BARK_FREIGHT) === 'carrier', '🔴 A2: FREIGHT is carrier — it is spread, never landed onto itself');
  ok(classifyReceiptLine(BARK_FUEL) === 'carrier', '🔴 A3: a fuel surcharge rides with the freight');
  ok(classifyReceiptLine({ description: 'Tax', amount: 0 }) === 'tax', 'A4: tax is its own kind');
  ok(classifyReceiptLine({ description: 'Customer Discount', amount: -202.5 }) === 'adjustment', 'A5: a discount is an adjustment');
  ok(classifyReceiptLine({ description: 'Shook Out Brown', amount: -50 }) === 'adjustment',
    '🔴 A5b: a NEGATIVE amount is an adjustment whatever it is called — a credit is not goods');
  ok(classifyReceiptLine({ description: 'Delivery Charge', amount: 12 }) === 'carrier', 'A6: a delivery charge is carrier');
  ok(classifyReceiptLine({ description: 'Shipping', amount: 1150 }) === 'carrier', 'A7: shipping is carrier');
}

// ══ §E THE ALLOCATION ITSELF — money split into parts that add back ════════════════
{
  ok(allocateCents(1661, [1, 1, 1, 1]).reduce((t, c) => t + c, 0) === 1661,
    '🔴 E1: 16.61 over four equal parts still adds to 16.61 — the cent this module used to lose');
  ok(JSON.stringify(allocateCents(1661, [1, 1, 1, 1])) === JSON.stringify([416, 415, 415, 415]),
    'E2: …and the odd cent goes to ONE line, not to none and not to all');
  ok(allocateCents(1000, [0, 0]).reduce((t, c) => t + c, 0) === 1000,
    '🔴 E3: weights that are all zero still allocate every cent — never a divide by zero');
  ok(allocateCents(0, [3, 1]).every(c => c === 0), 'E4: nothing to allocate allocates nothing');
  ok(allocateCents(100, []).length === 0, 'E5: no lines, no shares');
  const big = allocateCents(999, [7, 3]);
  ok(big.reduce((t, c) => t + c, 0) === 999 && big[0] > big[1], 'E6: weighted parts add back, and weight decides the size');
}

// ══ §B THE HEADER DECIDES — NOT THE DEDUPE ═════════════════════════════════════════
{
  const r = landedCostForReceipt(BAILEY_HEADER, BAILEY_RAW);
  ok(r.ok, 'B0: the Bailey Bark receipt lands');
  if (r.ok) {
    ok(r.reconciledOn === 'deduped' && r.hadRepeatedLines,
      '🔴 B1: the DEDUPED set reconciled, and the answer RECORDS which set it was');
    ok(r.goods.length === 1 && r.goodsTotal === 1031.25, 'B2: one goods line at its captured amount');
    ok(r.carrierTotal === 1284.78, `🔴 B3: freight + fuel counted ONCE = 1284.78 (got ${r.carrierTotal})`);
    ok(r.goods[0].landedUnitEqualPerItem === 30.88 && r.goods[0].landedUnitProRataByValue === 30.88,
      `🔴 B4: the yard lands at $30.88 — R-118's own figure, from the receipt (got ${r.goods[0].landedUnitEqualPerItem})`);
    ok(r.goods[0].lineAmount / 75 === 13.75, 'B5: …against $13.75 on the line — the 55% gap this module exists to close');
    ok(/counted once/.test(reconciliationNote(r)), 'B6: the screen is told the lines repeated and were counted once');
  }

  // 🔴 THE CAUTION, AS ITS OWN CASE (David, 2026-09-21): two identical lines can be REAL. Same lines,
  // a header that matches them IN FULL — the raw set is the right one and the dedupe must not win.
  const twice = landedCostForReceipt(1031.25 * 2, [BARK_LINE, { ...BARK_LINE }]);
  ok(twice.ok, 'B7: a receipt whose header matches the lines IN FULL lands');
  if (twice.ok) {
    ok(twice.reconciledOn === 'raw' && twice.goodsTotal === 2062.5,
      '🔴 B8: …on the RAW set — two identical lines were two purchases, and the dedupe alone would have halved it');
    ok(/separate purchases/.test(reconciliationNote(twice)), 'B9: and it says so in words');
  }

  // Neither set reconciles → a refusal, with both totals shown.
  const broken = landedCostForReceipt(999, BWI);
  ok(!broken.ok && broken.reason === 'does_not_reconcile', '🔴 B10: lines that do not add up to the header REFUSE');
  if (!broken.ok) {
    ok(broken.rawTotal === 647.79 && broken.headerAmount === 999,
      'B11: …and the refusal shows what the lines came to and what the receipt says');
    ok(/do not add up/.test(broken.detail), 'B12: …in a sentence a person can act on');
  }
  ok(!landedCostForReceipt(null, BWI).ok, 'B13: no header is a refusal — there is nothing to check against');
  ok(!landedCostForReceipt(100, []).ok, 'B14: no lines is a refusal');
  const allFreight = landedCostForReceipt(1127, [BARK_FREIGHT]);
  ok(!allFreight.ok && allFreight.reason === 'no_goods',
    '🔴 B15: a receipt that is only freight has nothing to land it onto — refused, never spread over nothing');
}

// ══ §C BOTH SPREADS, EVERY TIME ════════════════════════════════════════════════════
{
  const r = landedCostForReceipt(BWI_HEADER, BWI);
  ok(r.ok, 'C0: the bwi receipt lands');
  if (r.ok) {
    ok(r.reconciledOn === 'raw' && !r.hadRepeatedLines, 'C1: nothing repeated here — the raw set reconciles');
    ok(r.goods.length === 4 && r.goodsTotal === 631.18, `C2: four goods lines totalling 631.18 (got ${r.goodsTotal})`);
    ok(r.carrierTotal === 16.61 && r.taxTotal === 0, 'C3: the fuel surcharge is the carrier; the $0 tax line is tax');

    const osmo = r.goods.find(g => /Osmocote/.test(g.description))!;
    const ferrous = r.goods.find(g => /Ferrous/.test(g.description))!;
    // 16.61 ÷ 4 is 4.1525 — it does NOT divide into cents, so "equal" means equal to the cent and the
    // odd cent is placed deliberately rather than dropped (see allocateCents; §C8 is what caught it).
    const eq = r.goods.map(g => g.shareEqualPerItem).sort();
    ok(eq[eq.length - 1] - eq[0] <= 0.01 && eq.every(v => v >= 4.15 && v <= 4.16),
      `🔴 C4: equal-per-item splits the freight evenly to the cent — 4.15 or 4.16 each (got ${eq.join(', ')})`);
    ok(osmo.shareProRataByValue > osmo.shareEqualPerItem && ferrous.shareProRataByValue < ferrous.shareEqualPerItem,
      '🔴 C5: by value the dear line carries more and the cheap line less — the two spreads genuinely differ');
    ok(osmo.landedUnitEqualPerItem === 69.28 && osmo.landedUnitProRataByValue === 70.04,
      `🔴 C6: Osmocote lands at 69.28 a bag equal-per-item, 70.04 by value (got ${osmo.landedUnitEqualPerItem}/${osmo.landedUnitProRataByValue})`);
    ok(ferrous.landedUnitEqualPerItem === 29.45 && ferrous.landedUnitProRataByValue === 28.09,
      `C7: Ferrous lands at 29.45 / 28.09 (got ${ferrous.landedUnitEqualPerItem}/${ferrous.landedUnitProRataByValue})`);

    const sumEqual = Math.round(r.goods.reduce((t, g) => t + g.shareEqualPerItem, 0) * 100) / 100;
    const sumValue = Math.round(r.goods.reduce((t, g) => t + g.shareProRataByValue, 0) * 100) / 100;
    ok(sumEqual === r.carrierTotal && sumValue === r.carrierTotal,
      `🔴 C8: BOTH spreads give every cent of the freight to the goods — no freight is lost or invented (got ${sumEqual}/${sumValue})`);
    ok(r.goods.every(g => g.landedTotalEqualPerItem > g.lineAmount),
      'C9: every landed total is above its line — freight only ever adds');
  }
}

// ══ §D A UNIT COST NEEDS A QUANTITY ════════════════════════════════════════════════
{
  const r = landedCostForReceipt(116.61, [
    { description: 'Osmocote Blend 21-4-8 (12-14M) - 50 lb', amount: 100 },  // no quantity captured
    { description: 'FUEL Surcharge', amount: 16.61 },
  ]);
  ok(r.ok, 'D0: it still lands');
  if (r.ok) {
    ok(r.goods[0].landedTotalEqualPerItem === 116.61, 'D1: the line total carries the whole freight');
    ok(r.goods[0].landedUnitEqualPerItem === null && r.goods[0].landedUnitProRataByValue === null,
      '🔴 D2: with no quantity there is NO unit cost — null, never a 0 that reads as free');
  }
  const zeroGoods = landedCostForReceipt(16.61, [
    { description: 'Sample bag', quantity: 2, amount: 0 }, { description: 'FUEL Surcharge', amount: 16.61 },
  ]);
  ok(zeroGoods.ok, 'D3: free goods with freight still land');
  if (zeroGoods.ok) {
    ok(zeroGoods.goods[0].shareProRataByValue === 16.61 && zeroGoods.goods[0].shareEqualPerItem === 16.61,
      '🔴 D4: when the goods are worth 0, "by value" has no proportion to use and splits evenly rather than dividing by zero');
  }
}

console.log(`\nlandedCost: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
