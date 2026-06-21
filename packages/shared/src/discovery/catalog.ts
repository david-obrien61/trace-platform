/**
 * ── DISCOVERY CATALOG-EXTRACTION (capability 1.3) ──────────────────────────────
 *
 * PURPOSE: Given a nursery's LIVE website, pull a structured CATALOG — the real
 *   varieties they sell, with their category — so onboarding can populate a new
 *   tenant with THEIR OWN inventory instead of generic sample data. This is the
 *   "catalog-populate wow": their real trees materialize on the dashboard.
 *
 *   The existing discovery engine (engine.ts) extracts SERVICES + identity; it
 *   does NOT extract a catalog. This module is that missing cut.
 *
 * DEPENDENCIES:
 *   - fetchWebsiteContent (adapters/website) — browser-headered live fetch + HTML
 *     strip + 10k cap + honest error handling. Reused per page (each catalog page
 *     is small). The crawler discovers category/catalog page links from the entry
 *     page and fetches each.
 *   - executeCapability('discovery_catalog', …) — the shared AI gateway. The model
 *     reads page text and EXTRACTS { variety, category, confidence } per item. It
 *     never invents prices, quantities, or per-specimen (QR) identity.
 *
 * HONESTY (D-9 — the whole contract):
 *   - Each item carries an extraction confidence (high | medium | low). Clean,
 *     clearly-listed varieties → high; ambiguous mentions → low.
 *   - A LOW-confidence item, or one with no clear category, is FLAGGED — never
 *     silently coerced into a confident-looking row. A half-mapped catalog that
 *     shows a wrong tree as certain is the failure mode we refuse.
 *   - PRICE is never fabricated: the site has no prices, so price stays UNKNOWN
 *     (null), never 0. QUANTITY is never fabricated (that's the walk-count's job).
 *     Per-specimen / QR identity is never invented (no such data exists on a
 *     bare-domain QR).
 *
 * Instrumentation: emits [TRACE:POPULATE] (extract:start / page / extract:done).
 *   ON by default per the standing owner instruction.
 */

import { fetchWebsiteContent, type WebsiteContent } from './adapters/website';
import { executeCapability } from '../ai/execute';

export type CatalogConfidence = 'high' | 'medium' | 'low';

/** One catalog page fetched from the live site, ready for extraction. */
export interface CatalogPage {
  url:          string;
  categoryHint: string | null;   // derived from the URL slug, e.g. "Vitex" from /product-category/vitex/
  text:         string;
  error?:       string | null;
}

/** One extracted catalog item — the model's structured output, post-D-9 mapping. */
export interface CatalogItem {
  variety:    string;            // common name, e.g. "Shoal Creek Vitex"
  botanical:  string | null;     // botanical name if stated, e.g. "Vitex agnus-castus 'Shoal Creek'"
  category:   string | null;     // e.g. "Vitex" — null when the site/model gives no clear category
  confidence: CatalogConfidence;
  flagged:    boolean;           // true → owner must review before trusting (low conf OR no category)
  flagReason: string | null;     // why it was flagged — surfaced to the owner, never hidden
  sourceUrl:  string;            // which page this came from
}

/** Raw shape the model returns — extraction only. */
interface RawCatalogItem {
  variety?:    string;
  botanical?:  string | null;
  category?:   string | null;
  confidence?: string;
}

// ── Crawl ─────────────────────────────────────────────────────────────────────

const DEFAULT_MAX_PAGES = 30;

/** Generic catalog/category link patterns. /product-category/ is WooCommerce (very
 *  common for small-business sites); the rest catch hand-rolled catalog pages. */
const CATALOG_LINK_RE = /\/(product-category|product|shop|catalog|catalogue|plants?|trees?|availability|inventory|nursery-stock)\b/i;

/** Pull candidate catalog-page URLs out of an entry page's raw HTML. */
export function discoverCatalogLinks(html: string, baseUrl: string): string[] {
  const origin = (() => { try { return new URL(baseUrl).origin; } catch { return ''; } })();
  const hrefs = Array.from(html.matchAll(/href=["']([^"']+)["']/gi)).map(m => m[1]);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of hrefs) {
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) continue;
    let abs: string;
    try {
      abs = new URL(raw, baseUrl).href;
    } catch { continue; }
    // same-site only (AC-3 spirit + avoid wandering off to social links)
    if (origin && !abs.startsWith(origin)) continue;
    // skip feeds / api / assets / non-catalog WP plumbing
    if (/\/(feed|wp-json|wp-content|wp-admin|xmlrpc|comments|cart|checkout|my-account|tag)\b/i.test(abs)) continue;
    if (/\.(png|jpe?g|gif|svg|webp|css|js|ico|pdf|xml)(\?|$)/i.test(abs)) continue;
    if (!CATALOG_LINK_RE.test(abs)) continue;
    const norm = abs.replace(/\/$/, '');
    if (seen.has(norm)) continue;
    seen.add(norm);
    out.push(abs);
  }
  return out;
}

/** Derive a human category hint from a catalog URL slug, or null. */
export function categoryHintFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).pathname.split('/').filter(Boolean);
    const i = parts.findIndex(p => /^(product-category|category|categories)$/i.test(p));
    const slug = i >= 0 && parts[i + 1] ? parts[i + 1]
      : (parts.length ? parts[parts.length - 1] : '');
    if (!slug || /^(shop|product|products|catalog|catalogue|plants|trees)$/i.test(slug)) return null;
    return slug.replace(/[-_]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  } catch { return null; }
}

export interface CrawlOpts {
  maxPages?: number;
  /** Injectable for tests/proofs — defaults to a real browser-headered fetch. */
  _rawFetch?:     (url: string) => Promise<string>;
  _fetchContent?: (url: string) => Promise<WebsiteContent>;
}

async function realRawFetch(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

/**
 * fetchCatalogPages — crawl the live site for catalog pages.
 * Fetches the entry page, discovers category/catalog links, fetches each (capped).
 * Degrades honestly: if no catalog links are found, returns just the entry page
 * text so a hand-rolled single-page catalog still extracts.
 */
export async function fetchCatalogPages(baseUrl: string, opts: CrawlOpts = {}): Promise<CatalogPage[]> {
  const maxPages     = opts.maxPages ?? DEFAULT_MAX_PAGES;
  const rawFetch     = opts._rawFetch ?? realRawFetch;
  const fetchContent = opts._fetchContent ?? fetchWebsiteContent;

  let normalized = baseUrl.trim();
  if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;

  console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'crawl:start', url: normalized, ts: new Date().toISOString() }));

  // 1. entry page raw HTML → discover catalog links (level 1)
  let entryHtml = '';
  try {
    entryHtml = await rawFetch(normalized);
  } catch (err: any) {
    console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'crawl:entry-failed', url: normalized, error: err?.message ?? String(err) }));
  }

  let links = entryHtml ? discoverCatalogLinks(entryHtml, normalized) : [];

  // 2. Bounded 2-level expansion — the leaf category pages (which carry the varieties)
  //    often live one click below the entry page, under a hub like /shop/ or a
  //    /product-category/ index. Raw-fetch a few hubs and discover deeper links.
  const HUB_RE = /\/(shop|catalog|catalogue|product-category|plants?|trees?|nursery-stock|availability)\b/i;
  const hubs = links.filter(l => HUB_RE.test(l) && !/\/product-category\/[^/]+\/?$/i.test(l)).slice(0, 5);
  const merged = new Set(links.map(l => l.replace(/\/$/, '')));
  for (const hub of hubs) {
    try {
      const hubHtml = await rawFetch(hub);
      for (const deep of discoverCatalogLinks(hubHtml, hub)) merged.add(deep.replace(/\/$/, ''));
    } catch { /* a dead hub never sinks the crawl */ }
  }
  links = Array.from(merged).map(l => l + '/');

  // Prefer leaf category pages (they carry the varieties); cap the crawl.
  const ordered = [
    ...links.filter(l => /\/product-category\//i.test(l)),
    ...links.filter(l => !/\/product-category\//i.test(l)),
  ].slice(0, maxPages);

  console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'crawl:links', level1: 'expanded', hubs: hubs.length, found: links.length, fetching: ordered.length }));

  // 2. fetch each catalog page's clean text
  const pages: CatalogPage[] = [];
  for (const url of ordered) {
    const content = await fetchContent(url);
    if (content.text && content.text.trim()) {
      pages.push({ url, categoryHint: categoryHintFromUrl(url), text: content.text, error: content.error ?? null });
    }
  }

  // 3. honest degradation — no catalog pages → use the entry page text itself
  if (pages.length === 0) {
    const entry = await fetchContent(normalized);
    if (entry.text && entry.text.trim()) {
      pages.push({ url: normalized, categoryHint: null, text: entry.text, error: entry.error ?? null });
    }
  }

  console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'crawl:done', pages: pages.length }));
  return pages;
}

// ── Extract ─────────────────────────────────────────────────────────────────

const CATALOG_SYSTEM = `You extract a plant CATALOG from a nursery's own website text. You are an extractor, not an inventor.
For each distinct plant variety the page lists, report its common name, its botanical/Latin name if stated, the category it sits under, and how confident you are that this is a real variety the business sells.
RULES:
- Only report varieties the text actually names. Never invent a variety to fill out the list.
- Never report a price, a quantity, or a stock number — those are not your job and the site may not state them.
- If a variety's category is unclear from the text, set "category" to null — do NOT guess a category.
- "confidence": "high" = the variety is clearly listed as a product; "medium" = named but context is thin; "low" = a passing or ambiguous mention you are unsure is a real catalog item.
Return only valid JSON. No markdown fences, no explanation.`;

const CHAR_BUDGET = 11000;   // batch pages up to this combined size per AI call

export function buildCatalogPrompt(pages: CatalogPage[]): string {
  const blocks = pages.map((p, i) =>
    `--- PAGE ${i + 1} ---
URL: ${p.url}
Category (from the page's own section/URL, may be the strongest signal): ${p.categoryHint ?? '(unknown)'}
Text:
${p.text}`).join('\n\n');

  return `Here is text from one or more catalog pages of a nursery's live website.
${blocks}

Extract the plant varieties. Return a JSON array — one object per distinct variety:
[
  { "variety": "common name as the site states it",
    "botanical": "botanical/Latin name if stated, else null",
    "category": "the category/group it belongs to, or null if the text does not make it clear",
    "confidence": "high | medium | low" }
]
If a page is a category page, the items on it almost always belong to that page's category — use that as a strong signal, but set category to null if you genuinely cannot tell.
Return [] for a page that lists no varieties. Never fabricate a variety, a price, or a quantity.`;
}

/** Group pages into batches whose combined text fits the AI char budget. */
function batchPages(pages: CatalogPage[]): CatalogPage[][] {
  const batches: CatalogPage[][] = [];
  let cur: CatalogPage[] = [];
  let size = 0;
  for (const p of pages) {
    const len = p.text.length + 200;
    if (cur.length && size + len > CHAR_BUDGET) { batches.push(cur); cur = []; size = 0; }
    cur.push(p);
    size += len;
  }
  if (cur.length) batches.push(cur);
  return batches;
}

const normVariety = (s: string) => s.toLowerCase().replace(/[\s'".,()]+/g, ' ').trim();
const RANK: Record<CatalogConfidence, number> = { low: 0, medium: 1, high: 2 };

/** A catch-all listing ("All Trees", "Shop", "Products") is a weaker category
 *  signal than a specific one ("Vitex", "Oak") — used only to break dedup ties. */
function isCatchAllCategory(cat: string | null): boolean {
  return !cat || /^(all\b|shop|products?|catalog|catalogue|uncategor)/i.test(cat.trim());
}

/** Decide whether `next` should replace `existing` for the same variety:
 *  higher confidence wins; then a specific category beats a catch-all; then an
 *  item that carries a botanical name beats one that doesn't. */
function preferItem(existing: CatalogItem, next: CatalogItem): boolean {
  if (RANK[next.confidence] !== RANK[existing.confidence]) return RANK[next.confidence] > RANK[existing.confidence];
  const exCatch = isCatchAllCategory(existing.category), nxCatch = isCatchAllCategory(next.category);
  if (exCatch !== nxCatch) return exCatch && !nxCatch;          // prefer the specific category
  if (!!existing.botanical !== !!next.botanical) return !existing.botanical && !!next.botanical;
  return false;
}

function toConfidence(raw: string | undefined): CatalogConfidence {
  return raw === 'high' ? 'high' : raw === 'low' ? 'low' : 'medium';
}

/**
 * mapRawToCatalogItem — the D-9 honesty gate, pure and testable.
 * Decides flagged / flagReason. Never coerces an unknown into a confident row.
 * Returns null for a non-item (empty variety) — we drop, never fabricate.
 */
export function mapRawToCatalogItem(raw: RawCatalogItem, page: CatalogPage): CatalogItem | null {
  const variety = (raw.variety ?? '').toString().trim();
  if (!variety) return null;                                  // no variety → not an item, drop it

  const botanical = (raw.botanical ?? '').toString().trim() || null;
  // Category: prefer the model's, fall back to the page's own category signal.
  const category = ((raw.category ?? '').toString().trim() || page.categoryHint || '') || null;
  const confidence = toConfidence(raw.confidence);

  // D-9: flag when uncertain — low confidence OR no category we can stand behind.
  let flagged = false;
  let flagReason: string | null = null;
  if (confidence === 'low') {
    flagged = true;
    flagReason = 'low extraction confidence — verify this is a variety you sell';
  } else if (!category) {
    flagged = true;
    flagReason = 'category could not be determined — assign one before relying on this';
  }

  return { variety, botanical, category, confidence, flagged, flagReason, sourceUrl: page.url };
}

export interface ExtractOpts {
  apiKey: string;
  /** Injectable for tests/proofs — defaults to the real AI gateway. */
  _execute?: (capabilityKey: string, opts: any) => Promise<any>;
}

export interface CatalogExtract {
  items:           CatalogItem[];
  pagesFetched:    number;
  rawItemCount:    number;     // before dedup
  highConfidence:  number;
  flaggedCount:    number;
}

/**
 * extractCatalog — run the AI extractor over crawled pages, dedup, D-9 map.
 * Dedup is by normalized variety, keeping the highest-confidence instance.
 */
export async function extractCatalog(pages: CatalogPage[], opts: ExtractOpts): Promise<CatalogExtract> {
  const execute = opts._execute ?? executeCapability;
  const batches = batchPages(pages);

  console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'extract:start', pages: pages.length, batches: batches.length }));

  const byVariety = new Map<string, CatalogItem>();
  let rawItemCount = 0;

  for (const batch of batches) {
    let parsed: any;
    try {
      parsed = await execute('discovery_catalog', {
        system: CATALOG_SYSTEM,
        user:   buildCatalogPrompt(batch),
        apiKey: opts.apiKey,
      });
    } catch (err: any) {
      console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'extract:batch-error', error: err?.message ?? String(err) }));
      continue;   // one bad batch never sinks the whole catalog
    }
    const rawItems: RawCatalogItem[] = Array.isArray(parsed) ? parsed : (parsed?.items ?? parsed?.varieties ?? []);

    for (const raw of rawItems) {
      rawItemCount++;
      // attribute the item to its page: single-page batch → that page; multi → best-effort by category match
      const page = batch.length === 1
        ? batch[0]
        : (batch.find(p => p.categoryHint && raw.category && normVariety(p.categoryHint) === normVariety(raw.category)) ?? batch[0]);
      const item = mapRawToCatalogItem(raw, page);
      if (!item) continue;
      const key = normVariety(item.variety);
      const existing = byVariety.get(key);
      if (!existing || preferItem(existing, item)) {
        byVariety.set(key, item);
      }
    }
  }

  const items = Array.from(byVariety.values());
  const extract: CatalogExtract = {
    items,
    pagesFetched:   pages.length,
    rawItemCount,
    highConfidence: items.filter(i => i.confidence === 'high' && !i.flagged).length,
    flaggedCount:   items.filter(i => i.flagged).length,
  };

  console.log(JSON.stringify({
    tag: '[TRACE:POPULATE]', phase: 'extract:done',
    raw: rawItemCount, deduped: items.length,
    high: extract.highConfidence, flagged: extract.flaggedCount,
  }));

  return extract;
}
