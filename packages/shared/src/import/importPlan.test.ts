/**
 * ── importPlan — row resolution → plan · CSV catalog import · 2026-07-23 ──
 *
 * RED-first. Every fixture row is a case, and each asserts the INVARIANT of its verdict, never a
 * pinned snapshot count (the standing lesson — a pinned fixture manufactures false FAILs). The
 * synthetic catalog mirrors the fixture's named varieties so the live owner-test resolves the
 * same rows against LAWNS's real catalog.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/import/importPlan.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { resolveImportPlan, projectRows, parseQty, parsePrice, type MappedRow } from './importPlan';
import { parseCsv } from './parseCsv';
import { mapColumns } from './columnMap';
import type { StockLineRow } from '../inventory/stockLineResolver';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const lot = (p: Partial<StockLineRow> & { id: string; name: string }): StockLineRow => ({
  sku: null, qty: 0, size: null, variant_group: null, sell_price: null, price_basis: null, attributes: null, ...p,
});

// ── The synthetic catalog (mirrors the fixture's varieties) ─────────────────────
const CATALOG: StockLineRow[] = [
  lot({ id: 'b1', name: "Basham's Party Pink Crape Myrtle", qty: 5, size: '30 gal', variant_group: 'bashams' }),
  lot({ id: 'h1', name: "Hearts A'fire Redbud", qty: 8, size: '15 gal', variant_group: 'heartsafire' }),
  lot({ id: 's15', name: "'Sierra' Mexican Red Oak", qty: 10, size: '15 gal', variant_group: 'sierra', sku: 'SMR-15' }),
  lot({ id: 's30', name: "'Sierra' Mexican Red Oak", qty: 20, size: '30 gal', variant_group: 'sierra', sku: 'SMR-30' }),
  lot({ id: 'a1', name: 'Alley Cat', qty: 5, size: '15 gal', variant_group: 'alleycat' }),
  lot({ id: 'a2', name: 'Alley Cat', qty: 6, size: '30 gal', variant_group: 'alleycat' }),
  lot({ id: 'a3', name: 'Alley Cat', qty: 7, size: '45 gal', variant_group: 'alleycat' }),
  lot({ id: 'sh1', name: 'Shoal Creek Vitex', qty: 12, size: '30 gal', variant_group: 'shoalcreek' }),
  lot({ id: 'st1', name: 'Retama', qty: 0, size: null, variant_group: null }),   // a scraped STUB
];
const COUNTED = new Set<string>(['sh1']);   // Shoal Creek was physically counted

const mr = (p: Partial<MappedRow> & { rowIndex: number; name: string | null }): MappedRow => ({
  size: null, qty: null, sku: null, sellPrice: null, priceBasis: null, attributes: {}, ...p,
});

const ROWS: MappedRow[] = [
  mr({ rowIndex: 1, name: "Basham's Party Pink Crape Myrtle", size: '30 gal', qty: 12, sku: 'DISC-1101', sellPrice: 189, priceBasis: 'per tree' }),
  mr({ rowIndex: 2, name: "Hearts A'fire Redbud", size: '15 gal', qty: 8, sellPrice: 95 }),
  mr({ rowIndex: 3, name: "'Sierra' Mexican Red Oak", size: '45 gal', qty: 5, sku: 'DISC-1104', sellPrice: null }), // $0.00 → null
  mr({ rowIndex: 4, name: 'Alley Cat', size: null, qty: 20 }),                                                      // blank size, multi-size family
  mr({ rowIndex: 5, name: '  Shoal Creek Vitex  ', size: '30 gal', qty: 99, sellPrice: 75 }),                       // counted lot, qty disagrees
  mr({ rowIndex: 6, name: 'Texas Mountain Laurel', size: '15 gal', qty: null, sellPrice: null }),                   // new, blank price + missing qty
  mr({ rowIndex: 7, name: 'Montezuma Cypress', size: '15 gal', qty: 30, sellPrice: 65 }),                           // new, clean
  mr({ rowIndex: 8, name: 'Retama', size: '15 gal', qty: 25, sellPrice: 40 }),                                      // fills the stub
  mr({ rowIndex: 9, name: null }),                                                                                  // no name
];

const plan = resolveImportPlan({ rows: ROWS, catalog: CATALOG, countedLotIds: COUNTED });
const at = (i: number) => plan.rows.find(r => r.rowIndex === i)!;

// ── D-9 price/qty parsing ────────────────────────────────────────────────────────
ok(parsePrice('$0.00') === null, '$0.00 → UNKNOWN (null), never 0 (D-9, card 10)');
ok(parsePrice('') === null, 'blank price → UNKNOWN (null), never 0 (D-9, card 10)');
ok(parsePrice('$189.00') === 189, '$189.00 parses to 189');
ok(parsePrice('1,200.50') === 1200.5, 'thousands separators parse');
ok(parseQty('') === null, 'blank qty → UNKNOWN (null), never 0 (D-9)');
ok(parseQty('12') === 12, '12 → 12');
ok(parseQty('12.5') === null, 'a non-integer qty is not silently floored — unknown');

// ── UPDATE — a clean name+size match (cards: resolve on first pass) ──────────────
ok(at(1).verdict === 'UPDATE' && at(1).lotId === 'b1', 'row 1 → UPDATE b1 (possessive name resolved, card 7)');
ok(at(1).patch.sell_price === 189, 'row 1 sets the price');
ok(at(1).qtyChanges === true && at(1).qtyTo === 12 && at(1).qtyFrom === 5, 'row 1 carries the qty move 5 → 12');
ok(at(2).verdict === 'UPDATE' && at(2).lotId === 'h1', 'row 2 → UPDATE h1 (apostrophe name resolved, card 7)');
ok(at(2).qtyChanges === false, 'row 2 qty 8 == book 8 → no movement, only a price patch');

// ── CREATE — a new size sibling; $0.00 leaves it unpriced (cards 7, 10) ──────────
ok(at(3).verdict === 'CREATE' && at(3).create?.size === '45 gal', 'row 3 → CREATE the 45 gal Sierra sibling (name resolved, card 7)');
ok(at(3).create?.variantGroup === 'sierra', 'row 3 create inherits the family group');
ok(!('sell_price' in at(3).patch), 'row 3 ($0.00) writes NO price — the lot lands unpriced, not sellable (card 10)');

// ── AMBIGUOUS — blank size in a multi-size family names its candidates (card 8) ──
ok(at(4).verdict === 'AMBIGUOUS', 'row 4 (Alley Cat, no size) → AMBIGUOUS, not a guess (card 8)');
ok((at(4).candidates ?? []).map(c => c.size).join(',') === '15 gal,30 gal,45 gal', 'row 4 names the candidate sizes (card 8)');

// ── 🔴 CONFLICT — a counted lot is not overwritten by default (card 9) ───────────
ok(at(5).verdict === 'CONFLICT' && at(5).lotId === 'sh1', 'row 5 → CONFLICT (Shoal Creek was counted; padded name still resolved, card 9)');
ok(at(5).qtyFrom === 12 && at(5).qtyTo === 99, 'row 5 shows the counted 12 vs the CSV 99 (card 9)');

// ── CREATE with unknown price + missing qty (cards 10) ──────────────────────────
ok(at(6).verdict === 'CREATE', 'row 6 (new variety) → CREATE');
ok(!('sell_price' in at(6).patch), 'row 6 (blank price) lands unpriced — not sellable (card 10)');
ok(at(6).qtyChanges === false, 'row 6 (missing qty) makes NO qty movement — blank ≠ 0 (D-9)');
ok(at(7).verdict === 'CREATE' && at(7).create?.size === '15 gal', 'row 7 → clean CREATE with price + stock');

// ── FILL — a scraped stub gets its first size + stock (D-49 branch 1) ────────────
ok(at(8).verdict === 'FILL' && at(8).lotId === 'st1', 'row 8 → FILL the Retama stub in place (D-49)');
ok(at(8).patch.size === '15 gal', 'row 8 fill sets the stub size');
ok(at(8).qtyTo === 25, 'row 8 carries the stub stock 0 → 25');

// ── REFUSED — no name ────────────────────────────────────────────────────────────
ok(at(9).verdict === 'REFUSED', 'row 9 (no name) → REFUSED, never written');

// ── the tally is complete + honest ──────────────────────────────────────────────
const total = Object.values(plan.counts).reduce((a, b) => a + b, 0);
ok(total === ROWS.length, 'every row gets exactly one verdict (counts sum to the row total)');
ok(plan.counts.CONFLICT === 1 && plan.counts.AMBIGUOUS === 1 && plan.counts.REFUSED === 1, 'one each of the HELD verdicts');

// ── projectRows end-to-end through parseCsv + mapColumns (card 11 parse) ────────
{
  const csv = 'Item #,Botanical Name,Cont.,Ready,Retail\r\nDISC-9,"Vitex, Shoal","15 gal",7,$50.00\r\n';
  const { headers, rows } = parseCsv(csv);
  const cols = mapColumns(headers, headers.map((_, i) => rows.map(r => r[i])))
    .map(m => m.header === 'Ready' ? { ...m, proposed: false } : m);   // owner confirms the L3 qty
  const mapped = projectRows(rows, cols, 'per tree');
  ok(mapped[0].name === 'Vitex, Shoal', 'a quoted embedded comma survives into the mapped name (card 11)');
  ok(mapped[0].qty === 7, 'confirmed L3 Ready projects to qty 7');
  ok(mapped[0].sellPrice === 50, '$50.00 projects to 50');
  ok(mapped[0].priceBasis === 'per tree', 'the file-level basis is stamped on the row');
  ok(!('Retail' in mapped[0].attributes) && Object.keys(mapped[0].attributes).length === 0, 'mapped spine columns do NOT leak into the attribute bag');
}

console.log(`\nimportPlan — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
