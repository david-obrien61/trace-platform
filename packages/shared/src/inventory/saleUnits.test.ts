/**
 * ── saleUnits — one item, held in one unit, sold in several · 2026-09-25 (ledger #409) ─────────
 *
 * RED-first, and the corpus is LAWNS'S OWN, read LIVE on 2026-09-25 — not an invented one. The ten
 * mix rows, their real `qb_item_id`s (no SKUs exist: `sku` is NULL on every one), their real
 * placeholder quantities, and the two families the prompt did not mention.
 *
 * PROBES BOTH DIRECTIONS (STD-022). The positive half proves a sale draws the right base quantity.
 * The negative half is the half that matters here, because every failure mode in this module is a
 * SILENT one: a missing conversion must REFUSE rather than fall back to 1:1 (a 45 gal bucket taking
 * one gallon off the pile), a chain must be caught rather than double-converted, and the five
 * stranded placeholder counts must NEVER be folded into the one figure.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/inventory/saleUnits.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import {
  drawForSale, chainProblem, onHandInBase, inDisplayUnit, proposeSaleUnits,
  SALE_UNIT_COLUMNS, SALE_UNIT_SELECT, type SaleUnit,
} from './saleUnits';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

/** True gallons in a cubic yard — the caller's figure, passed in, never a constant in the module. */
const GPY = 46656 / 231;   // 201.974025974…

/** LAWNS's Fertile family, LIVE 2026-09-25. The pile is held in GALLONS; qb 52 is the base. */
const LAWNS: SaleUnit[] = [
  { saleQbItemId: '52', baseQbItemId: '52', baseQuantity: GPY,       baseUnit: 'gal', because: '1 Yard Scoop — the base item sold as itself' },
  { saleQbItemId: '51', baseQbItemId: '52', baseQuantity: GPY / 2,   baseUnit: 'gal', because: '1/2 Yard Scoop' },
  { saleQbItemId: '40', baseQbItemId: '52', baseQuantity: 15,        baseUnit: 'gal', because: '15gal Bucket' },
  { saleQbItemId: '41', baseQbItemId: '52', baseQuantity: 30,        baseUnit: 'gal', because: '30gal Bucket' },
  { saleQbItemId: '42', baseQbItemId: '52', baseQuantity: 45,        baseUnit: 'gal', because: '45gal Bucket' },
];

// ══════════════════════════════════════════════════════════════════════════════════════════════
// A · A SALE DRAWS THE BASE — every unit, one arithmetic
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const yard = drawForSale('52', 1, LAWNS);
  ok(yard.ok && Math.abs(yard.baseQuantity - GPY) < 1e-9 && yard.isBaseItself,
    'A1 one 1 Yard Scoop draws one yard of gallons off the base, and is flagged as the base itself');

  const half = drawForSale('51', 1, LAWNS);
  ok(half.ok && Math.abs(half.baseQuantity - GPY / 2) < 1e-9 && !half.isBaseItself,
    'A2 one 1/2 Yard Scoop draws half a yard of gallons — the quantity an integer yd column cannot hold');

  const b45 = drawForSale('42', 2, LAWNS);
  ok(b45.ok && b45.baseQuantity === 90 && b45.baseQbItemId === '52',
    'A3 two 45gal Buckets draw 90 gallons off item 52 — not off a bucket row of their own');

  const three = drawForSale('40', 3, LAWNS);
  ok(three.ok && three.baseQuantity === 45, 'A4 three 15gal Buckets draw 45 gallons (the quantity multiplies)');

  ok(LAWNS.every(u => drawForSale(u.saleQbItemId, 1, LAWNS).ok),
    'A5 every one of LAWNS\'s five Fertile sale units resolves — none is left unconfigured');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// B · THE REFUSALS — the whole point of the module, because every alternative is silent
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // 🔴 THE DEFECT THIS EXISTS TO PREVENT: a 1:1 fallback takes ONE gallon off the pile for a
  //    45-gallon bucket. Wrong by 45×, and nothing on any screen would say so.
  const missing = drawForSale('42', 1, LAWNS.filter(u => u.saleQbItemId !== '42'));
  ok(!missing.ok && /not set up as a sale unit/.test(missing.reason) && /42/.test(missing.reason),
    'B1 a sale item with NO conversion is REFUSED and the refusal names the item — never a 1:1 guess');

  ok(!drawForSale(null, 1, LAWNS).ok, 'B2 a line with no QuickBooks item is refused');
  ok(!drawForSale('52', 0, LAWNS).ok, 'B3 a quantity of zero is refused');
  ok(!drawForSale('52', -1, LAWNS).ok, 'B4 a negative quantity is refused');
  ok(!drawForSale('52', NaN, LAWNS).ok, 'B5 NaN is refused rather than producing NaN gallons');

  const zero = drawForSale('99', 1, [{ saleQbItemId: '99', baseQbItemId: '52', baseQuantity: 0, baseUnit: 'gal', because: 'x' }]);
  ok(!zero.ok && /cannot be used/.test(zero.reason),
    'B6 a conversion of 0 is refused — a sale unit worth nothing would draw nothing for ever, silently');

  ok(drawForSale('54', 1, LAWNS).ok === false,
    'B7 the REGULAR family (qb 54, bought not blended) does not resolve against the Fertile base — two families, not one');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// C · THE CHAIN — one level only
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  ok(chainProblem(LAWNS) === null,
    'C1 NEGATIVE CONTROL: LAWNS\'s real config is one level (four units plus the base as itself) and is accepted');

  const chained: SaleUnit[] = [
    { saleQbItemId: '51', baseQbItemId: '52', baseQuantity: 0.5, baseUnit: 'yd', because: 'half of the scoop' },
    { saleQbItemId: '52', baseQbItemId: '99', baseQuantity: GPY, baseUnit: 'gal', because: 'the scoop off the pile' },
  ];
  const problem = chainProblem(chained);
  ok(problem !== null && /converted twice/.test(problem as string) && /51/.test(problem as string),
    'C2 a chain (51 → 52 → 99) is CAUGHT and the message names the item and the hazard');

  ok(chainProblem([LAWNS[0]]) === null,
    'C3 NEGATIVE CONTROL: a base item that is a sale unit OF ITSELF is not a chain — that is the ordinary case');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// D · ONE FIGURE — and the five placeholder counts it must NOT swallow
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  // LAWNS's live rows, 2026-09-25. Every `qty_basis` is 'placeholder', so `counted` is false on all.
  const rows = [
    { qbItemId: '52', qty: 1010, name: '1 Yard Scoop: Fertile Compost Mix - Proprietary Blend', counted: true },
    { qbItemId: '51', qty: 10,   name: '1/2 Yard Scoop: Fertile Compost Mix - Proprietary Blend', counted: false },
    { qbItemId: '40', qty: 10,   name: '15gal Bucket: Fertile Compost Mix - Proprietary Blend', counted: false },
    { qbItemId: '41', qty: 10,   name: '30gal Bucket: Fertile Compost Mix - Proprietary Blend', counted: false },
    { qbItemId: '42', qty: 10,   name: '45gal Bucket: Fertile Compost Mix - Proprietary Blend', counted: false },
  ];
  const oh = onHandInBase('52', rows);
  ok(oh.baseQuantity === 1010, 'D1 the one figure is the BASE row\'s quantity — 1010 gallons');
  ok(oh.strandedSaleRows.length === 4,
    'D2 the four other rows are reported as STRANDED, not merged — their counts are somebody\'s, and folding them in would invent a total nobody measured');
  ok(oh.strandedSaleRows.every(r => r.name.length > 0 && r.qty === 10),
    'D3 each stranded row carries its name and its own quantity, so a person can decide what to do with it');
  ok(oh.countedRows === 1 && oh.uncountedRows === 0, 'D4 the figure reports what it rests on');

  // 🔴 NULL IS NOT ZERO. A base item with no row at all must not read as an empty pile.
  const none = onHandInBase('52', rows.filter(r => r.qbItemId !== '52'));
  ok(none.baseQuantity === null,
    'D5 a base item with NO stock row returns null, never 0 — absent is not empty (D-9 / A9)');

  const uncounted = onHandInBase('52', [{ qbItemId: '52', qty: 1010, name: 'x', counted: false }]);
  ok(uncounted.uncountedRows === 1 && uncounted.countedRows === 0,
    'D6 a placeholder figure is reported as uncounted — LIVE 2026-09-25 all ten LAWNS mix rows are placeholders');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// E · THE DISPLAY UNIT — held in gallons, read in yards
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const five = inDisplayUnit(1010, 'gal', 'yd', GPY);
  ok(five.value !== null && Math.abs(five.value - 5) < 0.001 && /5 yd/.test(five.text) && /1010 gal/.test(five.text),
    'E1 1010 gallons reads as 5 yd and SHOWS the gallons too, so the stocking unit is never hidden');

  ok(inDisplayUnit(null, 'gal', 'yd', GPY).value === null,
    'E2 a null figure stays null through the conversion — it does not become 0 yd');

  const sameUnit = inDisplayUnit(5, 'yd', 'yd', GPY);
  ok(sameUnit.value === 5 && sameUnit.text === '5 yd', 'E3 no conversion when the units already agree');

  ok(inDisplayUnit(1010, 'gal', 'yd', 0).value === null,
    'E4 a missing gallons-per-yard factor REFUSES rather than dividing by zero into Infinity');

  ok(inDisplayUnit(100, 'lb', 'yd', GPY).value === null,
    'E5 a base held in pounds is not silently turned into yards');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// F · THE PROPOSER — read from the names, never written, and the unreadable ones still listed
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  const rows = [
    { qbItemId: '52', name: '1 Yard Scoop: Fertile Compost Mix - Proprietary Blend' },
    { qbItemId: '51', name: '1/2 Yard Scoop: Fertile Compost Mix - Proprietary Blend' },
    { qbItemId: '40', name: '15gal Bucket: Fertile Compost Mix - Proprietary Blend' },
    { qbItemId: '42', name: '45gal Bucket: Fertile Compost Mix - Proprietary Blend' },
    { qbItemId: '77', name: 'Fertile Compost Mix - Proprietary Blend' },   // no size in the name
  ];
  const p = proposeSaleUnits(rows, 'gal', GPY);
  ok(p.length === 5, 'F1 every row is listed, including the one that cannot be read');

  const yard = p.find(x => x.saleQbItemId === '52');
  ok(yard != null && yard.baseQuantity !== null && Math.abs((yard.baseQuantity as number) - GPY) < 0.01,
    'F2 "1 Yard Scoop: …" proposes one yard of gallons — the size is at the FRONT of the name and IS read (tech-debt #193 does not bite here; measured)');

  const half = p.find(x => x.saleQbItemId === '51');
  ok(half != null && half.baseQuantity !== null && Math.abs((half.baseQuantity as number) - GPY / 2) < 0.01,
    'F3 "1/2 Yard Scoop: …" proposes half a yard of gallons');

  const b15 = p.find(x => x.saleQbItemId === '40');
  ok(b15 != null && b15.baseQuantity === 15, 'F4 "15gal Bucket: …" proposes 15 gallons');

  const bad = p.find(x => x.saleQbItemId === '77');
  ok(bad != null && bad.unreadable && bad.baseQuantity === null && /by hand/.test(bad.because),
    'F5 a name with no volume is LISTED as unreadable with null, and says a person must set it — a silent omission would make an unconfigured unit look like one nobody sells');

  ok(p.every(x => x.because.trim().length > 0),
    'F6 every proposal carries its reason in words — a conversion nobody can explain is one nobody should trust');

  const inYards = proposeSaleUnits([{ qbItemId: '40', name: '15gal Bucket' }], 'yd', GPY);
  ok(inYards[0].baseQuantity !== null && Math.abs((inYards[0].baseQuantity as number) - 15 / GPY) < 1e-5,
    'F7 a base held in yards gets the proposal in yards — the module does not assume gallons');
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// G · THE COLUMN LIST IS THE SOURCE (#179's lesson)
// ══════════════════════════════════════════════════════════════════════════════════════════════
{
  ok(SALE_UNIT_SELECT === SALE_UNIT_COLUMNS.join(', '),
    'G1 the select is DERIVED from the column list, so the two cannot drift');
  ok(SALE_UNIT_COLUMNS.length === 5 && SALE_UNIT_COLUMNS.includes('base_quantity'),
    'G2 the column list names the five columns the migration creates');
}

console.log(`\nsaleUnits: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.map(f => '  ✗ ' + f).join('\n')); process.exit(1); }
