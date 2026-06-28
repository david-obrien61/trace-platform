/**
 * ── SIZE-VARIANT CAPTURE — adversarial tests · B-clean (ledger #62) · 2026-06-28 ──
 *
 * Proves the DETERMINISTIC (no-AI) capture of WooCommerce size variants:
 *   extractSizeVariants (JSON-attr primary + <select> fallback), normalizeSize (trade
 *   gallon canonicalization), productSlugFromUrl, the bounded product crawl
 *   (fetchProductVariants, injected fetch), and the per-(variety × size) row expansion.
 * Must yield 5/15/30/45 Gallon on the LAWNS Shoal Creek Vitex page shape.
 *
 * Run (no test runner — pure TS, esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/discovery/catalog-variants.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import {
  extractSizeVariants, normalizeSize, productSlugFromUrl, fetchProductVariants,
  mapRawToCatalogItem, type CatalogPage,
} from './catalog';
import { catalogItemToInventoryRow } from './populate';
import { canonicalNameKey } from '../utils/canonicalName';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

const FOUR = ['5 Gallon', '15 Gallon', '30 Gallon', '45 Gallon'];

// The LAWNS Vitex variations-JSON attribute exactly as WooCommerce emits it: the value
// is HTML-entity-escaped (&quot;), one object per size, attribute key attribute_pa_tree-size.
const VITEX_JSON_HTML =
  `<form class="variations_form cart" data-product_variations="[` +
  `{&quot;attributes&quot;:{&quot;attribute_pa_tree-size&quot;:&quot;5-gallon&quot;},&quot;display_price&quot;:0},` +
  `{&quot;attributes&quot;:{&quot;attribute_pa_tree-size&quot;:&quot;15-gallon&quot;}},` +
  `{&quot;attributes&quot;:{&quot;attribute_pa_tree-size&quot;:&quot;30-gallon&quot;}},` +
  `{&quot;attributes&quot;:{&quot;attribute_pa_tree-size&quot;:&quot;45-gallon&quot;}}]">` +
  `<h1 class="product_title entry-title">Shoal Creek Vitex (Vitex agnus-castus &#8216;Shoal Creek&#8217;)</h1>` +
  `</form>`;

// Older theme: no variations JSON, sizes only in the <select> options (the fallback path).
const VITEX_SELECT_HTML =
  `<h1 class="product_title">Shoal Creek Vitex</h1>` +
  `<select id="pa_tree-size" name="attribute_pa_tree-size">` +
  `<option value="">Choose an option</option>` +
  `<option value="5-gallon">5 Gallon</option>` +
  `<option value="15-gallon">15 Gallon</option>` +
  `<option value="30-gallon">30 Gallon</option>` +
  `<option value="45-gallon">45 Gallon</option>` +
  `</select>`;

// ── 1. extractSizeVariants — JSON-attr PRIMARY yields 5/15/30/45 (the owner-prove shape) ─
{
  ok(eq(extractSizeVariants(VITEX_JSON_HTML), FOUR), '1: JSON variations attr → [5,15,30,45] Gallon, in order');
}

// ── 2. extractSizeVariants — <select> FALLBACK yields the same, skips the placeholder ────
{
  const sizes = extractSizeVariants(VITEX_SELECT_HTML);
  ok(eq(sizes, FOUR), '2: select fallback → [5,15,30,45] Gallon');
  ok(!sizes.includes('Choose An Option') && sizes.length === 4, '2: the empty-value placeholder is skipped');
}

// ── 3. simple product (no variations) → [] — never fabricate a size ───────────────────
{
  ok(eq(extractSizeVariants('<p>A lovely simple product, no variations.</p>'), []), '3: no variation data → [] (no fabricated size)');
  ok(eq(extractSizeVariants('<form data-product_variations="false"></form>'), []), '3: WooCommerce "false" variations → []');
}

// ── 4. normalizeSize — the gallon family collapses to ONE canonical form ──────────────
{
  for (const raw of ['15 Gallon', '15 gallon', '15-gallon', '15 gal', '15gal', '15G', '15 g', '#15'])
    ok(normalizeSize(raw) === '15 Gallon', `4: "${raw}" → "15 Gallon"`);
  ok(normalizeSize('5.0-gallon') === '5 Gallon', '4: "5.0-gallon" → "5 Gallon" (trailing .0 trimmed)');
  // non-gallon size systems are kept as text, never coerced into a gallon they are not
  ok(normalizeSize('2 inch caliper') === '2 inch caliper', '4: caliper passes through (not a gallon)');
  ok(normalizeSize('6 ft') === '6 ft', '4: height passes through');
}

// ── 5. extractSizeVariants — de-dupes, preserves first-seen order ─────────────────────
{
  const dupHtml =
    `<select name="attribute_pa_size">` +
    `<option value="a">15 Gallon</option><option value="b">#15</option><option value="c">5 gal</option></select>`;
  ok(eq(extractSizeVariants(dupHtml), ['15 Gallon', '5 Gallon']), '5: "15 Gallon" and "#15" collapse; order preserved');
}

// ── 6. productSlugFromUrl ─────────────────────────────────────────────────────────────
{
  ok(productSlugFromUrl('https://lawnstrees.com/product/shoal-creek-vitex/') === 'shoal-creek-vitex', '6: /product/<slug>/ → slug');
  ok(productSlugFromUrl('https://lawnstrees.com/product-category/vitex/') === null, '6: a category URL is not a product slug');
}

// ── 7. slug ↔ variety match via the SAME canonical key the resolver uses ──────────────
{
  ok(canonicalNameKey('shoal-creek-vitex') === canonicalNameKey('Shoal Creek Vitex'),
     '7: product slug and variety common-name reduce to the same token-set key');
}

// ── 8. fetchProductVariants — bounded crawl finds the product page + reads its sizes ──
void (async () => {
  const site: Record<string, string> = {
    'https://lawnstrees.com/': `<a href="/product-category/vitex/">Vitex</a><a href="/shop/">Shop</a>`,
    'https://lawnstrees.com/product-category/vitex/': `<a href="/product/shoal-creek-vitex/">Shoal Creek Vitex</a>`,
    'https://lawnstrees.com/shop/': `<a href="/product/texas-red-oak/">Texas Red Oak</a>`,
    'https://lawnstrees.com/product/shoal-creek-vitex/': VITEX_JSON_HTML,
    'https://lawnstrees.com/product/texas-red-oak/': `<p>simple product, no variations</p>`,
  };
  const rawFetch = (u: string): Promise<string> =>
    Promise.resolve(site[u] ?? site[u.endsWith('/') ? u.slice(0, -1) : u + '/'] ?? '');

  const variants = await fetchProductVariants('https://lawnstrees.com', { _rawFetch: rawFetch });
  ok(variants.length === 1, '8: one VARIABLE product captured (the simple red-oak yields no rows)');
  const vitex = variants[0];
  ok(vitex?.slug === 'shoal-creek-vitex', '8: slug captured from the product URL');
  ok(eq(vitex?.sizes, FOUR), '8: its 4 sizes captured deterministically');
})();

// ── 9. row expansion — ONE row per (variety × size), variant_group = slug ─────────────
{
  const PAGE: CatalogPage = { url: 'https://x.com/product-category/vitex/', categoryHint: 'Vitex', text: 'x', error: null };
  const item = mapRawToCatalogItem({ variety: 'Shoal Creek Vitex', category: 'Vitex', confidence: 'high' }, PAGE)!;
  item.sizes = FOUR;
  item.sourceSlug = 'shoal-creek-vitex';

  let idx = 0;
  const rows = item.sizes.map(s => catalogItemToInventoryRow(item, 'biz-1', idx++, s, item.sourceSlug ?? null));
  ok(rows.length === 4, '9: 4 sizes → 4 inventory rows');
  ok(rows.every(r => r.variant_group === 'shoal-creek-vitex'), '9: every size row carries variant_group = parent slug');
  ok(eq(rows.map(r => r.size), FOUR), '9: each row carries its own size');
  ok(rows.every(r => r.name === 'Shoal Creek Vitex'), '9: name stays the variety (size is its own column) → resolver still matches the parent');
  ok(new Set(rows.map(r => r.sku)).size === 4, '9: each size row gets a distinct DISC- sku');
  ok(rows.every(r => r.qty === 0 && r.unit_cost === null && r.cost_confidence === 'UNKNOWN'), '9: honesty contract intact per size (qty 0, cost UNKNOWN)');
}

// ── 10. parent row (no size args) OMITS the size columns — clean pre-migration insert ──
{
  const PAGE: CatalogPage = { url: 'https://x.com/product-category/oak/', categoryHint: 'Oak', text: 'x', error: null };
  const item = mapRawToCatalogItem({ variety: 'Bur Oak', category: 'Oak', confidence: 'high' }, PAGE)!;
  const parent = catalogItemToInventoryRow(item, 'biz-1', 0);
  ok(!('size' in parent), '10: a parent row has NO size key (omitted, not null) → inserts before the migration applies');
  ok(!('variant_group' in parent), '10: a parent row has NO variant_group key');
}

// ── results ───────────────────────────────────────────────────────────────────
setTimeout(() => {
  console.log(`\ncatalog-variants.test.ts — ${passed} passed, ${failed} failed`);
  if (failed) { console.error('\nFAILURES:\n - ' + failures.join('\n - ')); process.exit(1); }
}, 100);
