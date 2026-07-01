/**
 * ── DISCOVERY CATALOG-POPULATE (capability 1.3) ────────────────────────────────
 *
 * PURPOSE: The populate flow proper. Given a business + its live website:
 *   fetch the site → extract their real catalog (catalog.ts) → CLEAR the sandbox
 *   (and any prior discovery rows) → write THEIR real varieties into
 *   business_inventory, D-9-flagged → persist the extraction profile as the
 *   honesty/audit trail. Replaces generic sample data with the owner's own stock.
 *
 * DEPENDENCIES:
 *   - fetchCatalogPages + extractCatalog (catalog.ts) — the live-site read + AI cut.
 *   - business_inventory (live, tenant-scoped) — the populate target. unit_cost is
 *     nullable + carries the cost_confidence enum, so "price UNKNOWN, never 0" is
 *     represented honestly (null + 'UNKNOWN').
 *   - business_discovery_profiles (gated migration 20260621) — stores raw_extract.
 *
 * CLEAR semantics (idempotent, re-runnable — reuses the proven sandbox markers
 *   from scripts/seed-sandbox.mjs, plus this module's own discovery markers):
 *     SANDBOX (1.2):   business_inventory.sku LIKE 'SMPL-%' / notes '[SANDBOX]%',
 *                      cultivar_plants.tag_id LIKE 'SMPL-%', orders/customers markers.
 *     DISCOVERY (1.3): business_inventory.sku LIKE 'DISC-%' / notes '[DISCOVERY]%'.
 *   A populate run clears BOTH before writing — so clear→populate→clear leaves no
 *   orphans, exactly the seed-sandbox.mjs discipline David owner-proved.
 *
 * HONESTY (D-9):
 *   - unit_cost = null, cost_confidence = 'UNKNOWN' for EVERY item (the site has no
 *     prices — we refuse to write 0, which reads as "free").
 *   - qty = 0 — we do not fabricate stock counts (the walk-count's job).
 *   - status = 'available' for confident items; 'review' for FLAGGED items, so the
 *     dashboard's status badge visibly separates "sure" from "verify me".
 *   - cultivar_plants is deliberately NOT populated: those are per-specimen (QR)
 *     identities and no per-specimen data exists on a bare-domain QR — writing them
 *     would be fabrication.
 *
 * DATA QUALITY (dup-size, ledger #73 stress battery CASE 5): two rows sharing one
 *   variant_group AND the same size make a variety SILENTLY uncountable-by-scan at count
 *   time (detectSizeCollision's all-distinct check fails → UNKNOWN, indistinguishable from
 *   a never-seen item). We do NOT dedupe or auto-pick (refuse-to-guess stays correct) — we
 *   DETECT the (variant_group, size) collision at WRITE time and SURFACE it: a
 *   [TRACE:POPULATE] data-quality warning + PopulateResult.dataQuality.dupSizeGroups +
 *   raw_extract.counts.dupSizeGroups, so the owner sees it in the populate report before it
 *   ever reaches a count. Both rows are still written (surface, don't silently drop).
 *
 * Instrumentation: emits [TRACE:POPULATE] (extract counts, clear, populate, persist).
 *   ON by default per the standing owner instruction.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  fetchCatalogPages, extractCatalog, fetchProductVariants,
  type CatalogItem, type CatalogExtract, type CrawlOpts, type ProductVariants,
} from './catalog';
import { canonicalNameKey } from '../utils/canonicalName';
import type { WebsiteContent } from './adapters/website';
// Data-quality dup-size detection lives in a zero-dep leaf so client surfaces can reuse it
// without pulling populate.ts's transitive @anthropic-ai/sdk import (ledger #74 CASE-5).
import { findDuplicateSizeGroups, type DupSizeGroup } from './dupSize';

const DISC_SKU_PREFIX = 'DISC-';
const DISC_NOTE_TAG   = '[DISCOVERY]';

// ── Clear (idempotent) ─────────────────────────────────────────────────────────

/** Remove the 1.2 sandbox sample rows for this business. Mirrors seed-sandbox.mjs
 *  clear() semantics byte-for-byte (same marker predicates, same FK-safe order). */
export async function clearSandbox(businessId: string, supabase: SupabaseClient): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};
  let r;
  r = await supabase.from('orders').delete({ count: 'exact' }).eq('business_id', businessId).like('notes', '[SANDBOX]%');
  counts.orders = r.count ?? 0;
  r = await supabase.from('cultivar_plants').delete({ count: 'exact' }).eq('business_id', businessId).like('tag_id', 'SMPL-%');
  counts.cultivar_plants = r.count ?? 0;
  r = await supabase.from('business_inventory').delete({ count: 'exact' }).eq('business_id', businessId).like('sku', 'SMPL-%');
  counts.business_inventory = r.count ?? 0;
  r = await supabase.from('customers').delete({ count: 'exact' }).eq('business_id', businessId).eq('source', 'sandbox');
  counts.customers = r.count ?? 0;
  return counts;
}

/** Remove THIS module's discovery-populated rows for this business. */
export async function clearDiscovery(businessId: string, supabase: SupabaseClient): Promise<number> {
  const r = await supabase
    .from('business_inventory')
    .delete({ count: 'exact' })
    .eq('business_id', businessId)
    .like('sku', `${DISC_SKU_PREFIX}%`);
  return r.count ?? 0;
}

// ── Row mapping (D-9) ───────────────────────────────────────────────────────────

/** Map an extracted catalog item to a business_inventory row. Pure + testable.
 *  Encodes the honesty contract: UNKNOWN cost, no fabricated qty, flagged→'review'.
 *  When `size`/`variantGroup` are supplied (B-clean size variants), the row carries the
 *  size dimension and the parent-plant grouping; when they are NOT supplied the size
 *  columns are OMITTED entirely (a parent row — and a clean insert pre-migration). */
export function catalogItemToInventoryRow(
  item: CatalogItem, businessId: string, index: number,
  size?: string | null, variantGroup?: string | null,
) {
  const descParts = [item.botanical, item.category].filter(Boolean);
  const noteParts = [
    `${DISC_NOTE_TAG} from ${item.sourceUrl}`,
    `confidence: ${item.confidence}`,
    item.category ? `category: ${item.category}` : null,
  ].filter(Boolean);
  if (size) noteParts.push(`size: ${size}`);
  if (item.flagged) noteParts.push(`${DISC_NOTE_TAG}:FLAGGED ${item.flagReason ?? 'needs review'}`);

  const row: {
    business_id: string; sku: string; name: string; description: string | null;
    qty: number; unit_cost: null; cost_confidence: string; status: string; notes: string;
    size?: string | null; variant_group?: string | null;
  } = {
    business_id:     businessId,
    sku:             `${DISC_SKU_PREFIX}${String(1001 + index)}`,
    name:            item.variety,
    description:     descParts.join(" · ") || null,
    qty:             0,                                   // never fabricate stock
    unit_cost:       null,                               // site has no prices → UNKNOWN, never 0
    cost_confidence: 'UNKNOWN',                          // the cost axis: we genuinely don't know
    status:          item.flagged ? 'review' : 'available',
    notes:           noteParts.join(' · '),
  };
  // Only attach the size columns when this is a size-variant row, so a parent row (and
  // a pre-migration insert) carries no size/variant_group keys at all.
  if (size !== undefined)         row.size = size;
  if (variantGroup !== undefined) row.variant_group = variantGroup;
  return row;
}

// ── Data-quality: dup-size detection (ledger #73 CASE 5) ─────────────────────────
// Moved to the zero-dep leaf ./dupSize (ledger #74 CASE-5) so the inventory datasheet can reuse
// it client-side without the AI-SDK bundle cost. Re-exported here for existing callers + tests.
export { findDuplicateSizeGroups } from './dupSize';
export type { DupSizeGroup } from './dupSize';

// ── Populate (orchestration) ────────────────────────────────────────────────────

export interface PopulateOpts {
  apiKey: string;
  maxPages?: number;
  /** Injectable for tests/proofs. */
  _execute?:      (capabilityKey: string, opts: any) => Promise<any>;
  _rawFetch?:     (url: string) => Promise<string>;
  _fetchContent?: (url: string) => Promise<WebsiteContent>;
}

export interface PopulateResult {
  businessId:    string;
  sourceUrl:     string;
  extract:       CatalogExtract;
  cleared:       { sandbox: Record<string, number>; discovery: number };
  inserted:      number;
  flaggedInserted: number;
  /** Data-quality findings surfaced (not acted on) — see findDuplicateSizeGroups. */
  dataQuality:   { dupSizeGroups: DupSizeGroup[] };
  status:        string;
  error:         string | null;
}

/**
 * populateCatalog — the 1.3 flow end to end.
 * fetch live site → extract catalog → clear sandbox + prior discovery → insert
 * the real varieties (D-9 flagged) → persist the profile. Idempotent: a re-run
 * clears its own prior rows first, so clear→populate→clear leaves no orphans.
 */
export async function populateCatalog(
  businessId: string,
  sourceUrl: string,
  supabase: SupabaseClient,
  opts: PopulateOpts,
): Promise<PopulateResult> {
  console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'populate:start', businessId, sourceUrl, ts: new Date().toISOString() }));

  const crawlOpts: CrawlOpts = { maxPages: opts.maxPages, _rawFetch: opts._rawFetch, _fetchContent: opts._fetchContent };
  const pages   = await fetchCatalogPages(sourceUrl, crawlOpts);
  const extract = await extractCatalog(pages, { apiKey: opts.apiKey, _execute: opts._execute });

  // Honest stop: nothing extracted → make NO changes, surface why.
  if (extract.items.length === 0) {
    console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'populate:empty', businessId, sourceUrl }));
    return {
      businessId, sourceUrl, extract,
      cleared: { sandbox: {}, discovery: 0 }, inserted: 0, flaggedInserted: 0,
      dataQuality: { dupSizeGroups: [] },
      status: 'extracted-empty',
      error: pages.length === 0 ? 'could not read any catalog pages from the site' : 'no varieties found on the site',
    };
  }

  // ── Enrich with SIZE variants (B-clean) — bounded product-page crawl, deterministic ──
  // The catalog extractor found the VARIETIES (parents); this reads each variable
  // product's SIZE options off its product page (no AI) and matches them to a variety by
  // the same name token-set key the resolver uses (the slug ↔ variety common name).
  let variants: ProductVariants[] = [];
  try {
    variants = await fetchProductVariants(sourceUrl, { maxProducts: opts.maxPages, _rawFetch: opts._rawFetch });
  } catch (err: any) {
    console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'variants:error', error: err?.message ?? String(err) }));
  }
  const bySlugKey = new Map<string, ProductVariants>();
  for (const v of variants) bySlugKey.set(canonicalNameKey(v.slug), v);
  let itemsWithVariants = 0, totalSizeRows = 0;
  for (const item of extract.items) {
    const v = bySlugKey.get(canonicalNameKey(item.variety));
    if (v && v.sizes.length) {
      item.sizes = v.sizes;
      item.sourceSlug = v.slug;
      itemsWithVariants++;
      totalSizeRows += v.sizes.length;
    }
  }
  console.log(JSON.stringify({
    tag: '[TRACE:POPULATE]', phase: 'variants:matched',
    variableProducts: variants.length, varietiesMatched: itemsWithVariants, sizeRows: totalSizeRows,
  }));

  // Clear sandbox + any prior discovery rows (idempotent re-populate).
  const sandboxCleared   = await clearSandbox(businessId, supabase);
  const discoveryCleared = await clearDiscovery(businessId, supabase);
  console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'populate:cleared', sandbox: sandboxCleared, discovery: discoveryCleared }));

  // Build rows: ONE row per (variety × size) where the product has size variants;
  // otherwise one parent row (size NULL), exactly as before.
  let skuIdx = 0;
  const rows: ReturnType<typeof catalogItemToInventoryRow>[] = [];
  for (const item of extract.items) {
    if (item.sizes && item.sizes.length) {
      for (const size of item.sizes) rows.push(catalogItemToInventoryRow(item, businessId, skuIdx++, size, item.sourceSlug ?? null));
    } else {
      rows.push(catalogItemToInventoryRow(item, businessId, skuIdx++));
    }
  }

  // Data-quality (ledger #73 CASE 5): detect (variant_group, size) collisions BEFORE the
  // insert and SURFACE them. We do NOT dedupe or drop — both rows are still written; the
  // owner sees the finding in the populate report and resolves the dup, so a variety never
  // becomes silently uncountable-by-scan at count time.
  const dupSizeGroups = findDuplicateSizeGroups(rows);
  if (dupSizeGroups.length) {
    console.log(JSON.stringify({
      tag: '[TRACE:POPULATE]', phase: 'data-quality:dup-size', businessId,
      groups: dupSizeGroups.length, detail: dupSizeGroups,
    }));
  }

  let { error: insErr } = await supabase.from('business_inventory').insert(rows);

  // Deploy-window safety: if size/variant_group are not applied yet, the per-size insert
  // fails on the unknown column → collapse to ONE parent row per variety (no size cols)
  // so populate still succeeds before the migration lands (mirrors the deliveries pattern).
  let degradedNoSizes = false;
  if (insErr && (insErr.code === 'PGRST204' || /\b(size|variant_group)\b|column/i.test(insErr.message))) {
    degradedNoSizes = true;
    console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'variants:columns-absent', note: 'size/variant_group not applied yet — writing parent rows only', error: insErr.message }));
    const parentRows = extract.items.map((item, i) => catalogItemToInventoryRow(item, businessId, i));
    ({ error: insErr } = await supabase.from('business_inventory').insert(parentRows));
  }
  if (insErr) {
    console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'populate:insert-error', error: insErr.message }));
    return {
      businessId, sourceUrl, extract,
      cleared: { sandbox: sandboxCleared, discovery: discoveryCleared },
      inserted: 0, flaggedInserted: 0,
      dataQuality: { dupSizeGroups: degradedNoSizes ? [] : dupSizeGroups },
      status: 'insert-failed', error: insErr.message,
    };
  }
  const writtenRows     = degradedNoSizes ? extract.items.length : rows.length;
  const flaggedInserted = degradedNoSizes
    ? extract.items.filter(i => i.flagged).length
    : rows.filter(r => r.status === 'review').length;

  // Persist the extraction profile (the honesty/audit trail) — upsert on (business, url).
  const profile = {
    business_id: businessId,
    source_url:  sourceUrl,
    status:      'populated',
    extracted_at: new Date().toISOString(),
    raw_extract: {
      items: extract.items,
      counts: {
        pagesFetched:   extract.pagesFetched,
        rawItemCount:   extract.rawItemCount,
        deduped:        extract.items.length,
        highConfidence: extract.highConfidence,
        flagged:        extract.flaggedCount,
        inserted:       writtenRows,
        sizeRows:       degradedNoSizes ? 0 : totalSizeRows,
        varietiesWithSizes: degradedNoSizes ? 0 : itemsWithVariants,
        dupSizeGroups:  degradedNoSizes ? 0 : dupSizeGroups.length,
      },
    },
  };
  const { error: profErr } = await supabase
    .from('business_discovery_profiles')
    .upsert(profile, { onConflict: 'business_id,source_url' });
  if (profErr) {
    // Inventory already written — surface the profile-persist failure but don't fail the populate.
    console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'populate:profile-error', error: profErr.message }));
  }

  console.log(JSON.stringify({
    tag: '[TRACE:POPULATE]', phase: 'populate:done',
    inserted: writtenRows, sizeRows: degradedNoSizes ? 0 : totalSizeRows,
    flaggedInserted, high: extract.highConfidence,
    dupSizeGroups: degradedNoSizes ? 0 : dupSizeGroups.length,
    degradedNoSizes, profilePersisted: !profErr,
  }));

  return {
    businessId, sourceUrl, extract,
    cleared: { sandbox: sandboxCleared, discovery: discoveryCleared },
    inserted: writtenRows, flaggedInserted,
    dataQuality: { dupSizeGroups: degradedNoSizes ? [] : dupSizeGroups },
    status: degradedNoSizes
      ? (profErr ? 'populated-no-sizes-no-profile' : 'populated-no-sizes')
      : (profErr ? 'populated-no-profile' : 'populated'),
    error: null,
  };
}
