// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove /inventory's search finds a row by the code the grid SHOWS — the regression
//   David hit on build 9b2b30b, 2026-09-22 13:10: the SKU column read `CSCM3UP`, he typed
//   `CSCM3UP`, and the roster returned nothing.
// DEPENDENCIES: INVENTORY_SEARCH (the screen's own spec) · searchSpec (pure) · the grid source,
//   read as text for the fetched-column assertions (a select inside a .tsx is unreachable to this
//   harness — tech-debt #134, the same reason receiptsList.test.ts reads its grid).
// OUTPUTS: assertions only.
//
// 🔴 EVERY FIXTURE IS A REAL LAWNS ROW SHAPE, READ LIVE 2026-09-22: `sku` NULL, the code in
// `qb_item_name`. Measured population: 1,079 rows, 1 with a sku, 632 with a qb_item_name.
// A fixture with a populated `sku` would pass against the broken code and prove nothing.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INVENTORY_SEARCH, INVENTORY_SEARCH_PLACEHOLDER } from '../pages/inventorySearchSpec';
import { searchHaystack, searchedColumns, searchPlaceholderFor } from '@trace/shared/components/datasheet/searchSpec';

const GRID = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/pages/BusinessInventory.tsx'), 'utf8');

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

const hay = (r: Record<string, unknown>) => searchHaystack(INVENTORY_SEARCH, r as never).toLowerCase();
const finds = (r: Record<string, unknown>, typed: string) => hay(r).includes(typed.toLowerCase());

// ── §A · 🔴 DAVID'S EXACT CASE — the three codes he typed, in their real stored shape ─────────
const CSCM3UP = { name: 'Colorama Scarlet Crape Myrtle (UNDER PRODUCTION)', sku: null, qb_item_name: 'CSCM3UP', size: '3 gallon', location: null, variant_group: null, serial_number: null, notes: null };
const AP45    = { name: 'Afgan Black Pine', sku: null, qb_item_name: 'AP45', size: '45 Gallon', location: null, variant_group: null, serial_number: null, notes: null };
const NZCM    = { name: 'Natchez Crape Myrtle (UNDER PRODUCTION)', sku: null, qb_item_name: 'NZCM95UP', size: '95 Gallon', location: null, variant_group: null, serial_number: null, notes: null };

ok(finds(CSCM3UP, 'CSCM3UP'), '🔴 A1 TYPING THE CODE THE GRID SHOWS FINDS THE ROW — CSCM3UP. This is the regression: the SKU column renders itemIdentifier (sku ?? qb_item_name) while the search read `sku`, which is NULL on 1,078 of 1,079 live rows');
ok(finds(AP45, 'AP45'), 'A2 …AP45');
ok(finds(NZCM, 'NZCM95UP'), 'A3 …NZCM95UP');
ok(finds(CSCM3UP, 'cscm3up'), 'A4 …and lowercase finds it too — the box does not care about case');

// ── §B · the fields David said used to work, and the ones that always did ────────────────────
ok(finds(AP45, '45 Gallon'), 'B1 size still matches — "45 Gallon"');
ok(finds(CSCM3UP, 'Crape Myrtle'), 'B2 name still matches');
ok(finds({ ...AP45, location: 'Back 40' }, 'Back 40'), 'B3 location still matches');
ok(finds({ ...AP45, notes: 'holding for Terry' }, 'holding for Terry'), 'B4 notes still match');

// ── §C · a row WITH a real sku still searches by it (the fix must not trade one for the other) ─
ok(finds({ ...AP45, sku: 'LEGACY-1', qb_item_name: 'AP45' }, 'LEGACY-1'),
   '🔴 C1 A ROW THAT HAS A REAL SKU IS STILL FOUND BY IT — the identifier prefers `sku`, so fixing the fallback must not lose the primary');

// ── §D · A9 — absent is not empty ─────────────────────────────────────────────────────────────
const EMPTY = { name: null, sku: null, qb_item_name: null, size: null, location: null, variant_group: null, serial_number: null, notes: null };
ok(hay(EMPTY) === '', 'D1 a row with nothing known contributes an EMPTY haystack');
ok(!hay(EMPTY).includes('null') && !hay(EMPTY).includes('undefined'),
   '🔴 D2 …and never the literal "null"/"undefined" — otherwise searching "null" matches every row that is MISSING a value, an absence rendered as a fact (A9)');

// ── §E · 🔴 THE PLACEHOLDER IS GENERATED, SO IT CANNOT DISAGREE WITH THE BEHAVIOUR ───────────
ok(INVENTORY_SEARCH_PLACEHOLDER === searchPlaceholderFor(INVENTORY_SEARCH),
   'E1 the screen uses the DERIVED placeholder, not a typed one');
ok(/SKU/i.test(INVENTORY_SEARCH_PLACEHOLDER),
   'E2 …and it still promises SKU, because the search still delivers it');
ok(!GRID.includes('searchPlaceholder="'),
   '🔴 E3 THE GRID CONTAINS NO HAND-TYPED PLACEHOLDER STRING — the old one ("Search name, SKU, size, location…") was true when written and went false when the DISPLAY moved to a computed value. A generated promise cannot rot that way');
{
  // Every label the placeholder names must be a label the spec actually searches.
  const named = INVENTORY_SEARCH_PLACEHOLDER.replace(/^Search /, '').replace(/ \+ \d+ more$/, '').split(', ');
  const labels = INVENTORY_SEARCH.map(f => f.label);
  ok(named.every(n => labels.includes(n)),
     `E4 every field the placeholder names is one the search reads (named: ${named.join('|')})`);
}

// ── §F · 🔴 A SEARCHED COLUMN THAT IS NOT FETCHED MATCHES NOTHING, JUST AS SILENTLY ──────────
{
  const declared = searchedColumns(INVENTORY_SEARCH);
  const m = GRID.match(/const BASE_COLS = '([^']+)'/);
  ok(!!m, 'F1 BASE_COLS is readable from the grid source');
  const fetched = new Set((m?.[1] ?? '').split(',').map(s => s.trim()));
  const missing = declared.filter(c => !fetched.has(c));
  ok(missing.length === 0,
     `🔴 F2 EVERY COLUMN THE SEARCH DEPENDS ON IS IN THE SELECT — missing: ${missing.join(', ') || 'none'}. This is the other half of the family: a field that is searched but never fetched returns no match and says nothing about why (the customers roster shipped exactly that against dropped address columns, ledger #335)`);
  ok(declared.includes('sku') && declared.includes('qb_item_name'),
     'F3 …and the identifier declares BOTH its columns, which no check could infer from a computed getter');
}

console.log(`\ninventorySearch — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
