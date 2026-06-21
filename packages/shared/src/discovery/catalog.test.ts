/**
 * ── DISCOVERY CATALOG-EXTRACTION — adversarial tests · capability 1.3 · 2026-06-21 ──
 *
 * Proves the D-9 honesty contract WITHOUT a live AI call: fetch + AI gateway are
 * injected. Each test asserts the real mapping refuses the failure mode a naïve
 * extractor would commit (silent coercion, fabricated price/qty, dropped flags,
 * lost dedup).
 *
 * Run (no test runner installed — pure TS, esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/discovery/catalog.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import {
  discoverCatalogLinks, categoryHintFromUrl, mapRawToCatalogItem,
  extractCatalog, fetchCatalogPages, type CatalogPage,
} from './catalog';
import { catalogItemToInventoryRow } from './populate';
import { classifyCategory } from './seed';
import type { WebsiteContent } from './adapters/website';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const PAGE = (over: Partial<CatalogPage> = {}): CatalogPage =>
  ({ url: 'https://x.com/product-category/vitex/', categoryHint: 'Vitex', text: 'irrelevant', error: null, ...over });

// ── 1. mapRawToCatalogItem — clean high-confidence item is NOT flagged ────────────
{
  const item = mapRawToCatalogItem(
    { variety: 'Shoal Creek Vitex', botanical: "Vitex agnus-castus 'Shoal Creek'", category: 'Vitex', confidence: 'high' },
    PAGE());
  ok(item !== null, '1: a real variety maps to an item');
  ok(item?.flagged === false, '1: clean high-confidence item is NOT flagged');
  ok(item?.botanical === "Vitex agnus-castus 'Shoal Creek'", '1: botanical name preserved');
}

// ── 2. low confidence → FLAGGED, never silently confident ─────────────────────────
{
  const item = mapRawToCatalogItem({ variety: 'Mystery Shrub', category: 'Vitex', confidence: 'low' }, PAGE());
  ok(item?.flagged === true, '2: low-confidence item is flagged');
  ok(/low extraction confidence/i.test(item?.flagReason ?? ''), '2: flag reason names the low confidence');
}

// ── 3. no category the model can stand behind → FLAGGED (not guessed) ──────────────
{
  // page has no category hint either, so neither model nor page supplies one
  const item = mapRawToCatalogItem({ variety: 'Some Tree', category: null, confidence: 'high' }, PAGE({ categoryHint: null }));
  ok(item?.category === null, '3: unknown category stays null — never guessed');
  ok(item?.flagged === true, '3: missing category is flagged');
  ok(/category/i.test(item?.flagReason ?? ''), '3: flag reason names the missing category');
}

// ── 4. page category hint backfills a model that omitted category (high conf, NOT flagged) ─
{
  const item = mapRawToCatalogItem({ variety: 'Flip Side Vitex', category: null, confidence: 'high' }, PAGE());
  ok(item?.category === 'Vitex', "4: page's own category signal backfills a missing model category");
  ok(item?.flagged === false, '4: with a category from the page, a confident item is not flagged');
}

// ── 5. empty variety is dropped — never fabricated into a row ──────────────────────
{
  ok(mapRawToCatalogItem({ variety: '', category: 'Vitex', confidence: 'high' }, PAGE()) === null, '5a: empty variety → dropped');
  ok(mapRawToCatalogItem({ category: 'Vitex', confidence: 'high' }, PAGE()) === null, '5b: missing variety → dropped');
}

// ── 6. inventory row: price UNKNOWN (null + 'UNKNOWN'), qty 0, never fabricated ────
{
  const item = mapRawToCatalogItem({ variety: 'Texas Live Oak', botanical: 'Quercus virginiana', category: 'Oak', confidence: 'high' }, PAGE({ categoryHint: 'Oak', url: 'https://x.com/product-category/oak/' }))!;
  const row = catalogItemToInventoryRow(item, 'biz-1', 0);
  ok(row.unit_cost === null, '6: unit_cost is null (UNKNOWN), never 0 — the site has no prices');
  ok(row.cost_confidence === 'UNKNOWN', "6: cost_confidence is 'UNKNOWN'");
  ok(row.qty === 0, '6: qty is 0 — stock count never fabricated');
  ok(row.status === 'available', '6: confident item gets status available');
  ok(row.sku.startsWith('DISC-'), '6: sku carries the DISC- marker for idempotent clear');
}

// ── 7. flagged item → status 'review' + reason in notes (visible on dashboard) ────
{
  const item = mapRawToCatalogItem({ variety: 'Unsure Plant', category: null, confidence: 'low' }, PAGE({ categoryHint: null }))!;
  const row = catalogItemToInventoryRow(item, 'biz-1', 1);
  ok(row.status === 'review', "7: flagged item gets status 'review' (distinct dashboard badge)");
  ok(/FLAGGED/.test(row.notes), '7: the flag is written into notes, visibly, not hidden');
}

// ── 8. extractCatalog — dedup by variety keeps the HIGHEST confidence instance ────
(async () => {
  const pages = [PAGE({ url: 'https://x.com/product-category/oak/', categoryHint: 'Oak', text: 'a' })];
  // the model returns the same variety twice at different confidence + one empty + one real
  const res = await extractCatalog(pages, {
    apiKey: 'test',
    _execute: async () => ([
      { variety: 'Bur Oak', category: 'Oak', confidence: 'low' },
      { variety: 'Bur Oak', category: 'Oak', confidence: 'high' },   // dup, higher conf
      { variety: '', category: 'Oak', confidence: 'high' },          // junk → dropped
      { variety: 'Chinquapin Oak', category: 'Oak', confidence: 'high' },
    ]),
  });
  ok(res.items.length === 2, '8: dedup collapses the duplicate variety (2 distinct kept)');
  const bur = res.items.find(i => i.variety === 'Bur Oak');
  ok(bur?.confidence === 'high', '8: dedup keeps the HIGHEST-confidence instance');
  ok(res.rawItemCount === 4, '8: rawItemCount counts everything the model returned (pre-dedup)');
  ok(res.highConfidence === 2, '8: highConfidence counts only confident, non-flagged items');
})();

// ── 9. extractCatalog — a batch that throws never sinks the whole catalog ──────────
(async () => {
  const pages = [PAGE({ text: 'p1' })];
  const res = await extractCatalog(pages, { apiKey: 'test', _execute: async () => { throw new Error('AI down'); } });
  ok(res.items.length === 0, '9: an AI error yields an empty (honest) catalog, not a crash');
})();

// ── 10. discoverCatalogLinks — finds /product-category/, skips feeds/assets/off-site ─
{
  const html = `
    <a href="/product-category/vitex/">Vitex</a>
    <a href="/product-category/oak/">Oak</a>
    <a href="/feed/">feed</a>
    <a href="/wp-json/">api</a>
    <a href="https://facebook.com/lawns">fb</a>
    <a href="/about/">about</a>
    <a href="/shop/">shop</a>
    <a href="/wp-content/uploads/x.png">img</a>`;
  const links = discoverCatalogLinks(html, 'https://lawnstrees.com/');
  ok(links.some(l => l.endsWith('/product-category/vitex/')), '10: discovers category links');
  ok(links.some(l => l.endsWith('/shop/')), '10: discovers the shop page');
  ok(!links.some(l => /facebook|feed|wp-json|\.png/.test(l)), '10: skips off-site, feeds, api, assets');
}

// ── 11. categoryHintFromUrl — slug → human label, generic slugs → null ────────────
{
  ok(categoryHintFromUrl('https://x.com/product-category/crape-myrtle/') === 'Crape Myrtle', '11: slug → Title Case label');
  ok(categoryHintFromUrl('https://x.com/shop/') === null, '11: generic /shop/ → null (no false category)');
}

// ── 12. seed.ts D-9 — unknown category is FLAGGED 'uncategorized', NEVER 'addon' ───
{
  ok(classifyCategory('transport').category === 'transport', '12: a valid category is preserved');
  ok(classifyCategory('transport').flagged === false, '12: a valid category is not flagged');
  const unknown = classifyCategory('weird-made-up-thing');
  ok(unknown.category === 'uncategorized', "12: unknown category → 'uncategorized', NEVER silent 'addon'");
  ok(unknown.flagged === true, '12: unknown category is flagged for review');
  ok(classifyCategory(null).category === 'uncategorized', '12: null category → uncategorized + flagged');
}

// ── 13. fetchCatalogPages — degrades to the entry page when no catalog links exist ─
(async () => {
  const entryHtml = '<html><a href="/contact/">contact</a></html>';   // no catalog links
  const content = (url: string): Promise<WebsiteContent> =>
    Promise.resolve({ url, title: 't', description: '', text: 'We sell Live Oaks and Red Maples.', fetchedAt: 'now', error: null });
  const pages = await fetchCatalogPages('https://x.com', {
    _rawFetch: async () => entryHtml,
    _fetchContent: content,
  });
  ok(pages.length === 1 && pages[0].text.includes('Live Oaks'), '13: no catalog links → falls back to entry page text');
})();

// ── results ───────────────────────────────────────────────────────────────────
setTimeout(() => {
  console.log(`\ncatalog.test.ts — ${passed} passed, ${failed} failed`);
  if (failed) { console.error('\nFAILURES:\n - ' + failures.join('\n - ')); process.exit(1); }
}, 100);
