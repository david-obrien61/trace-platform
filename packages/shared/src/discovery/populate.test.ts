/**
 * ── POPULATE data-quality: dup-size detection (ledger #73 CASE 5) ────────────────
 *
 * Proves findDuplicateSizeGroups SURFACES a (variant_group, size) collision without
 * deduping or dropping (refuse-to-guess stays correct; the gap was that it was SILENT).
 * Built from real catalogItemToInventoryRow rows so the shape matches what populate writes.
 *
 * Run (no test runner — pure TS, esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/discovery/populate.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { findDuplicateSizeGroups, catalogItemToInventoryRow } from './populate';
import { mapRawToCatalogItem, type CatalogPage } from './catalog';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const PAGE: CatalogPage = { url: 'https://x.com/product-category/vitex/', categoryHint: 'Vitex', text: 'x', error: null };
const item = (variety: string) => mapRawToCatalogItem({ variety, category: 'Vitex', confidence: 'high' }, PAGE)!;

// helper: build a size row exactly as populate's row-expansion does
let idx = 0;
const sizeRow = (it: ReturnType<typeof item>, size: string, vg: string | null) =>
  catalogItemToInventoryRow(it, 'biz-1', idx++, size, vg);
const parentRow = (it: ReturnType<typeof item>) => catalogItemToInventoryRow(it, 'biz-1', idx++);

// ── 1. clean: same group, DISTINCT sizes → NO finding (the normal Vitex case) ──
{
  const v = item('Shoal Creek Vitex');
  const rows = ['5 Gallon', '15 Gallon', '30 Gallon', '45 Gallon'].map(s => sizeRow(v, s, 'shoal-creek-vitex'));
  ok(findDuplicateSizeGroups(rows).length === 0, '1: same group + distinct sizes → no dup finding');
}

// ── 2. dup: same group + SAME size across two rows → ONE finding, count 2 ──
{
  const v = item('Shoal Creek Vitex');
  const rows = [sizeRow(v, '15 Gallon', 'shoal-creek-vitex'), sizeRow(v, '15 Gallon', 'shoal-creek-vitex')];
  const found = findDuplicateSizeGroups(rows);
  ok(found.length === 1, '2: dup-size in group → exactly one finding');
  ok(found[0]?.count === 2, '2: finding count = 2 (both rows surfaced)');
  ok(found[0]?.variantGroup === 'shoal-creek-vitex' && found[0]?.size === '15 Gallon', '2: finding carries the colliding variant_group + size');
  ok(rows.length === 2, '2: detection does NOT drop a row (both still present — surface, do not dedupe)');
}

// ── 3. two VARIETIES sharing one sourceSlug with overlapping size → flagged ──
//     (the realistic populate-produced dup: bySlugKey binds both to one product slug)
{
  const a = item('Shoal Creek Vitex'); const b = item('Shoal Creek  Vitex'); // near-identical names
  const rows = [sizeRow(a, '15 Gallon', 'shoal-creek-vitex'), sizeRow(b, '15 Gallon', 'shoal-creek-vitex')];
  const found = findDuplicateSizeGroups(rows);
  ok(found.length === 1 && found[0].count === 2, '3: two varieties on one slug + same size → flagged');
}

// ── 4. NULL / parent rows never participate ──
{
  const v = item('Bur Oak');
  const rows = [parentRow(v), parentRow(item('Live Oak'))]; // no size/variant_group
  ok(findDuplicateSizeGroups(rows).length === 0, '4: parent rows (no size/variant_group) never flagged');
}

// ── 5. case-insensitive size match ("15 Gallon" vs "15 gallon") → flagged ──
{
  const v = item('Shoal Creek Vitex');
  const rows = [sizeRow(v, '15 Gallon', 'g1'), sizeRow(v, '15 gallon', 'g1')];
  ok(findDuplicateSizeGroups(rows).length === 1, '5: size match is case-insensitive (mirrors extractSizeVariants dedupe key)');
}

// ── 6. different variant_group + same size → NOT flagged (cross-group is legit) ──
{
  const v = item('Shoal Creek Vitex');
  const rows = [sizeRow(v, '15 Gallon', 'g1'), sizeRow(v, '15 Gallon', 'g2')];
  ok(findDuplicateSizeGroups(rows).length === 0, '6: same size in DIFFERENT groups → not a dup (collision is per-group)');
}

setTimeout(() => {
  console.log(`\npopulate.test.ts — ${passed} passed, ${failed} failed`);
  if (failed) { console.error('\nFAILURES:\n - ' + failures.join('\n - ')); process.exit(1); }
}, 100);
