/**
 * ── PROVE: extractSizeVariants against the REAL LAWNS Vitex product page ──────────
 *
 * PURPOSE:      Verification artifact (NOT a capability). Proves the DETERMINISTIC,
 *               no-AI size-variant parser returns the grower's exact published sizes on
 *               real WooCommerce markup — the canonical acceptance case from
 *               docs/decisions/2026-06-27-discovery-size-variants.md:
 *                 https://lawnstrees.com/product/shoal-creek-vitex/ → 5 / 15 / 30 / 45 Gallon.
 * DEPENDENCIES: extractSizeVariants/productSlugFromUrl/mapRawToCatalogItem (discovery/catalog.ts),
 *               catalogItemToInventoryRow (discovery/populate.ts), and — by DEFAULT — the pinned
 *               offline fixture packages/shared/src/discovery/__fixtures__/lawns-vitex-real.html.
 * OUTPUTS:      [TRACE:POPULATE] prove:parse (source path + sizes + variant_group), a DRY-RUN
 *               table of the rows populate.ts WOULD write (nothing is written to any catalog),
 *               and 10 assertions. Exit non-zero on any miss.
 *
 * HARD SCOPE: one variety, one product page. No crawl, no multi-page fan-out.
 *
 * Run (default — OFFLINE, deterministic, no network):
 *   node_modules/.bin/esbuild scripts/prove-vitex-variants.ts --bundle --platform=node --format=cjs | node
 * Run against the live site (network):  ... | node - --live
 */

import { readFileSync } from 'fs';
import {
  extractSizeVariants, productSlugFromUrl,
  mapRawToCatalogItem, type CatalogPage,
} from '../packages/shared/src/discovery/catalog';
import { catalogItemToInventoryRow } from '../packages/shared/src/discovery/populate';

const PRODUCT_URL = 'https://lawnstrees.com/product/shoal-creek-vitex/';
// Resolved from repo-root cwd (the documented run location) so the bundle-to-stdin run finds it.
const FIXTURE = `${process.cwd()}/packages/shared/src/discovery/__fixtures__/lawns-vitex-real.html`;
const EXPECTED = ['5 Gallon', '15 Gallon', '30 Gallon', '45 Gallon'];
const LIVE = process.argv.includes('--live');
const eq = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

async function loadHtml(): Promise<{ html: string; source: string }> {
  if (LIVE) {
    const res = await fetch(PRODUCT_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { html: await res.text(), source: `LIVE ${PRODUCT_URL}` };
  }
  return { html: readFileSync(FIXTURE, 'utf8'), source: 'OFFLINE fixture lawns-vitex-real.html' };
}

void (async () => {
  const { html: rawHtml, source } = await loadHtml();

  // Which source path will fire? (JSON primary is tried first; non-empty JSON wins.)
  const jsonM = rawHtml.match(/data-product_variations\s*=\s*"([^"]*)"/i);
  let jsonNonEmpty = false;
  if (jsonM) {
    try {
      const parsed = JSON.parse(jsonM[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&'));
      jsonNonEmpty = Array.isArray(parsed) && parsed.length > 0;
    } catch { jsonNonEmpty = false; }
  }
  const sourcePath = jsonNonEmpty ? 'JSON (data-product_variations — primary)'
                                  : 'SELECT option-labels (fallback)';

  // ── THE PROOF: run the real parser on the real (pinned) page ────────────────────
  const sizes = extractSizeVariants(rawHtml);
  const slug = productSlugFromUrl(PRODUCT_URL);

  console.log(JSON.stringify({
    tag: '[TRACE:POPULATE]', phase: 'prove:parse',
    fixture: source, htmlBytes: rawHtml.length,
    sourcePath, hasJsonAttr: !!jsonM, jsonNonEmpty,
    matchCount: sizes.length, sizes, slug, variant_group: slug,
  }));

  // ── DRY-RUN: the rows populate.ts WOULD write (NOT written — no DB call) ─────────
  const PAGE: CatalogPage = {
    url: 'https://lawnstrees.com/product-category/vitex/',
    categoryHint: 'Vitex', text: 'proof', error: null,
  };
  const item = mapRawToCatalogItem({ variety: 'Shoal Creek Vitex', category: 'Vitex', confidence: 'high' }, PAGE)!;
  item.sizes = sizes;
  item.sourceSlug = slug;

  let skuIdx = 0;
  const rows = sizes.map(s => catalogItemToInventoryRow(item, 'DRY-RUN-FIXTURE-BIZ', skuIdx++, s, item.sourceSlug ?? null));

  console.log('\n── DRY-RUN rows populate.ts WOULD write (NOT written) ────────────────');
  console.table(rows.map(r => ({
    name: r.name, size: r.size, variant_group: r.variant_group,
    sku: r.sku, qty: r.qty, unit_cost: r.unit_cost, cost_confidence: r.cost_confidence,
  })));

  // ── ASSERTIONS ─────────────────────────────────────────────────────────────────
  let pass = 0, fail = 0; const fails: string[] = [];
  const ok = (c: boolean, m: string) => c ? pass++ : (fail++, fails.push(m), console.error('   ✗ ' + m));

  ok(eq(sizes, EXPECTED), `parser returns exactly ${JSON.stringify(EXPECTED)} in order (got ${JSON.stringify(sizes)})`);
  ok(sizes.length === 4, 'exactly 4 sizes — no invented sizes, no duplicates');
  ok(sizes.every(s => /^\d+ Gallon$/.test(s)), 'each size is the grower text canonicalized ("N Gallon") — no enum coercion');
  ok(jsonNonEmpty, 'source path was the JSON primary (data-product_variations), not the fallback');
  ok(rows.length === 4, '4 sizes → 4 dry-run rows (one per Vitex × size)');
  ok(rows.every(r => r.variant_group === 'shoal-creek-vitex'), 'every row variant_group = parent slug');
  ok(eq(rows.map(r => r.size), EXPECTED), 'each row carries its own published size');
  ok(rows.every(r => r.name === 'Shoal Creek Vitex'), 'name stays the variety (size is its own column)');
  ok(new Set(rows.map(r => r.sku)).size === 4, 'each size row gets a distinct sku');
  ok(rows.every(r => r.qty === 0 && r.unit_cost === null && r.cost_confidence === 'UNKNOWN'), 'honesty contract per size (qty 0, cost UNKNOWN)');

  console.log(`\nprove-vitex-variants (${LIVE ? 'live' : 'offline'}) — ${pass} passed, ${fail} failed`);
  if (fail) { console.error('\nFAILURES:\n - ' + fails.join('\n - ')); process.exit(1); }
})();
