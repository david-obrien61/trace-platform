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
// ⚠️ THE TWO `DISC-` ROWS ARE THE LIVE DEFECT, REPRODUCED (D-47 / STD-019, 2026-07-23).
// Our `business_inventory.sku` holds INTERNAL discovery-scrape ids ("DISC- is a scrape id, not
// owner-facing" — ledger #128). The fixture's grower rows carry item numbers DISC-1101 / DISC-1104
// that COLLIDE with two UNRELATED catalog rows (Texas Redbud / Flip Side Vitex). The old SKU-exact
// fast path SOURCED the match on that field and cross-wrote price+attributes onto the wrong plants.
// These rows were ABSENT from the prior catalog, which is exactly why the green test hid the bug.
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
  // ⛔ the collision rows — our sku field holds DISC- ids for UNRELATED varieties:
  lot({ id: 'txr', name: 'Texas Redbud', qty: 3, size: null, variant_group: null, sku: 'DISC-1101' }),
  lot({ id: 'flip', name: 'Flip Side Vitex', qty: 4, size: '45 gal', variant_group: 'flipside', sku: 'DISC-1104' }),
  // 📏 a lot whose size is stored as a BARE trade number "30" — a CSV "30 gal" must resolve HERE:
  lot({ id: 'crm', name: 'Red Crape Myrtle', qty: 22, size: '30', variant_group: 'redcrape' }),
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
  mr({ rowIndex: 10, name: "'Sierra' Mexican Red Oak", size: '15 gal', qty: 10, sku: 'SMR-15', sellPrice: 120 }),  // item # AGREES → corroboration
  mr({ rowIndex: 11, name: 'Red Crape Myrtle', size: '30 gal', qty: 50, sellPrice: 80 }),                          // CSV "30 gal" vs catalog "30" → same lot
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

// ── 🔴 D-47 — a FOREIGN item # NEVER SOURCES a match; name + size decide, disagreement surfaced ──
// row 1 item # DISC-1101 collides with an UNRELATED catalog row (Texas Redbud, id 'txr'). The old
// SKU-exact fast path bound row 1 → txr and cross-wrote price/attributes onto it. It must NOT.
ok(at(1).lotId !== 'txr', 'row 1 does NOT bind to Texas Redbud via the colliding item # DISC-1101 (D-47)');
ok(at(1).lotId === 'b1', 'row 1 resolves to Basham\'s by NAME + SIZE, not the foreign item # (D-47)');
ok(at(1).foreignIdConflict === true, 'row 1 SURFACES the item-# disagreement (does not silently proceed)');
ok(/Texas Redbud/.test(at(1).foreignIdNote ?? ''), 'row 1 note NAMES the different plant the item # points at');
ok(/name \+ size/i.test(at(1).reason), 'row 1 reason states WHICH RULE fired — name + size (point 4)');
// row 3 item # DISC-1104 collides with Flip Side Vitex (id 'flip', size 45). Old path bound it there.
ok(at(3).lotId !== 'flip' && at(3).create?.size === '45 gal', 'row 3 does NOT bind to Flip Side Vitex via DISC-1104 — CREATEs the Sierra sibling (D-47)');
ok(at(3).foreignIdConflict === true && /Flip Side Vitex/.test(at(3).foreignIdNote ?? ''), 'row 3 surfaces the DISC-1104 disagreement');

// ── CORROBORATION — item # that agrees with the name+size match is a POSITIVE confirmation ──
// row 10: 'Sierra' 15 gal with item # SMR-15 (== the sku ALREADY on s15). Same lot → confirms.
ok(at(10).verdict === 'UPDATE' && at(10).lotId === 's15', 'row 10 → UPDATE s15 by name + size');
ok(at(10).foreignIdConflict !== true, 'row 10 item # SMR-15 AGREES with the name+size match — no conflict');
ok(/also matches our SKU/i.test(at(10).foreignIdNote ?? '') && !/confirm/i.test(at(10).foreignIdNote ?? ''),
   'row 10 note states the OBSERVATION ("also matches our SKU"), NOT the conclusion ("confirms") — David 2026-07-23');

// ── 🔴 SIZE NORMALIZATION — a size in a different format than the catalog stores resolves to the SAME lot ──
// row 11 is 'Red Crape Myrtle · "30 gal"'; the catalog stores that lot's size as the bare "30". Exact
// string compare CREATEs a duplicate; the shared normalizeSize folds both → ONE lot (tech-debt #56).
ok(at(11).verdict === 'UPDATE' && at(11).lotId === 'crm', 'row 11 → UPDATE crm: CSV "30 gal" resolves to catalog "30" via normalizeSize (NOT a duplicate CREATE)');
ok(at(11).qtyFrom === 22 && at(11).qtyTo === 50, 'row 11 carries the qty move 22 → 50 onto the existing lot');

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
  ok(!('Retail' in mapped[0].attributes), 'a real spine column (Retail/price) does NOT leak into the attribute bag');
  // D-47 / point 3 — the grower's item # is RETAINED as a descriptive attribute under its own header
  // ("Item #"), verbatim, AND carried on `sku` for the cross-check — never written as our sku.
  ok(mapped[0].sku === 'DISC-9', 'the foreign item # is carried on `sku` for the corroborate/conflict cross-check');
  ok(mapped[0].attributes['Item #'] === 'DISC-9', 'the foreign item # is KEPT as a note under its own header (point 3)');
}

console.log(`\nimportPlan — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
