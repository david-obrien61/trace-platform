// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove the display identifier (`sku ?? qb_item_name`) and that the four QuickBooks
//   identity columns reach the insert — ledger #357, David 2026-09-20. §C is the one that
//   matters most: it asserts the values are kept SEPARATE, because a stored merge changes a
//   row's identifier the day a SKU is typed in QuickBooks.
// DEPENDENCIES: itemIdentifier · qboItemAdapter · itemImportWriter · the migration corpus.
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { itemIdentifier, itemIdentifierSource } from './itemIdentifier';
import { adaptQboItems } from './qboItemAdapter';
import { ITEM_IMPORT_INSERT_COLUMNS, rowForItem } from './itemImportWriter';
import type { QboItemRow } from './itemList';

const ROOT = process.cwd();   // the runner bundles this file, so import.meta.dirname is not it
let pass = 0; const fails: string[] = [];
const ok = (c: boolean, m: string) => { if (c) pass++; else fails.push(m); };

const item = (o: Partial<QboItemRow>): QboItemRow => ({
  id: '1', name: 'DLO30', type: 'NonInventory', incomeAccount: 'Sales of Nursery Stock',
  active: true, unitPrice: 200, purchaseCost: null, sku: null,
  description: 'Discounted Live Oak - 30 gallon', fullyQualifiedName: 'Oak:DLO30', ...o,
});

// ── §A · THE FALLBACK ────────────────────────────────────────────────────────────────────────
ok(itemIdentifier({ sku: 'CBBM1Y', qb_item_name: 'BBM1Y' }) === 'CBBM1Y',
   '§A1 a real SKU wins — and the two are genuinely different values on item 1048');
ok(itemIdentifier({ sku: null, qb_item_name: 'DLO30' }) === 'DLO30',
   '§A2 with no SKU, the QuickBooks code is shown — 1,156 of LAWNS\'s 1,157 items take this path');
ok(itemIdentifier({ sku: '   ', qb_item_name: 'DLO30' }) === 'DLO30',
   '§A3 a blank-but-present SKU is not an identifier');
ok(itemIdentifier({}) === null && itemIdentifier({ sku: null, qb_item_name: null }) === null,
   '§A4 neither, or a row that never selected the column → null, an honest absence rather than an empty string (D-9)');
ok(itemIdentifier(null) === null && itemIdentifier(undefined) === null, '§A5 a missing row is null, not a throw');
ok(itemIdentifierSource({ sku: 'X', qb_item_name: 'Y' }) === 'sku'
   && itemIdentifierSource({ sku: null, qb_item_name: 'Y' }) === 'quickbooks-name'
   && itemIdentifierSource({ sku: null, qb_item_name: null }) === null,
   '§A6 the source is reported, so a surface need not call a QuickBooks code a SKU');

// ── §B · THE ADAPTER CARRIES WHAT QUICKBOOKS SAID ────────────────────────────────────────────
{
  const [a] = adaptQboItems([item({})]).items;
  ok(a.qboName === 'DLO30', '§B1 Intuit\'s raw Name is carried');
  ok(a.name === 'Discounted Live Oak', `§B2 …and is NOT what becomes our name — that is read from Description (${a.name})`);
  ok(a.fullyQualifiedName === 'Oak:DLO30', '§B3 the fully-qualified name is carried — what the owner\'s sheets join on');
  ok(a.qboType === 'NonInventory' && a.incomeAccount === 'Sales of Nursery Stock',
     '§B4 type AND income account are carried — the two halves of what a row is');
}
{
  // The row that proves the fallback is needed: no description, so our name falls back to the code.
  const [a] = adaptQboItems([item({ description: null })]).items;
  ok(a.name === 'DLO30' && a.qboName === 'DLO30', '§B5 with no description both read the code, and neither is invented');
}

// ── §C · THE INSERT — SEPARATE COLUMNS, NEVER MERGED ─────────────────────────────────────────
{
  const [a] = adaptQboItems([item({ id: '1048', sku: 'CBBM1Y', name: 'BBM1Y', fullyQualifiedName: 'Fertilizer:BBM1Y',
                                    description: 'Compost - Black Bastrop Mix 1 Yard' })]).items;
  const r = rowForItem('biz', 'run', a);
  ok(r.sku === 'CBBM1Y', '§C1 the SKU lands in sku');
  ok(r.qb_item_name === 'BBM1Y', '§C2 the QuickBooks code lands in qb_item_name');
  ok(r.sku !== r.qb_item_name, '§C3 🔴 THE TWO ARE STORED SEPARATELY — a merged value would change meaning the day a SKU is typed');
  ok(itemIdentifier(r as { sku?: string | null; qb_item_name?: string | null }) === 'CBBM1Y',
     '§C4 …and the identifier is still computed from them on read');
  ok(r.qb_item_fqn === 'Fertilizer:BBM1Y' && r.qb_item_type === 'NonInventory'
     && r.qb_income_account === 'Sales of Nursery Stock', '§C5 fqn, type and income account all land');
}
{
  const [a] = adaptQboItems([item({ sku: null })]).items;
  const r = rowForItem('biz', 'run', a);
  ok(r.sku === null && r.qb_item_name === 'DLO30',
     '§C6 with no SKU the sku column stays NULL — the code is NOT written into it');
}

// ── §D · THE COLUMNS EXIST IN THE MIGRATION CORPUS (#179's class) ────────────────────────────
{
  const mig = readFileSync(join(ROOT, 'supabase/migrations/20260920b_qb_item_identity_columns.sql'), 'utf8');
  const added = [...mig.matchAll(/ADD\s+COLUMN\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)/gi)].map(m => m[1].toLowerCase());
  for (const c of ['qb_item_name', 'qb_item_fqn', 'qb_item_type', 'qb_income_account']) {
    ok(added.includes(c), `§D1 the migration adds ${c}`);
    ok((ITEM_IMPORT_INSERT_COLUMNS as readonly string[]).includes(c), `§D2 …and the writer inserts ${c}`);
  }
  // 🔴 NEGATIVE CONTROL: the parse must be capable of not finding something.
  ok(!added.includes('qb_item_colour'), '§D3 🔴 the migration parse can come back empty-handed');
  ok(!(ITEM_IMPORT_INSERT_COLUMNS as readonly string[]).includes('qb_item_display_identifier'),
     '§D4 🔴 NO merged identifier column exists — the fallback is computed, never stored (David, 2026-09-20)');
}

for (const f of fails) console.log(`  ✗ ${f}`);
// The runner requires this exact spelling; a file with no summary proves nothing and is RED.
console.log(`itemIdentifier — ${pass} passed, ${fails.length} failed`);
if (fails.length > 0) process.exit(1);
