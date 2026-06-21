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
 * Instrumentation: emits [TRACE:POPULATE] (extract counts, clear, populate, persist).
 *   ON by default per the standing owner instruction.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchCatalogPages, extractCatalog, type CatalogItem, type CatalogExtract, type CrawlOpts } from './catalog';
import type { WebsiteContent } from './adapters/website';

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
 *  Encodes the honesty contract: UNKNOWN cost, no fabricated qty, flagged→'review'. */
export function catalogItemToInventoryRow(item: CatalogItem, businessId: string, index: number) {
  const descParts = [item.botanical, item.category].filter(Boolean);
  const noteParts = [
    `${DISC_NOTE_TAG} from ${item.sourceUrl}`,
    `confidence: ${item.confidence}`,
    item.category ? `category: ${item.category}` : null,
  ].filter(Boolean);
  if (item.flagged) noteParts.push(`${DISC_NOTE_TAG}:FLAGGED ${item.flagReason ?? 'needs review'}`);

  return {
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
}

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
      status: 'extracted-empty',
      error: pages.length === 0 ? 'could not read any catalog pages from the site' : 'no varieties found on the site',
    };
  }

  // Clear sandbox + any prior discovery rows (idempotent re-populate).
  const sandboxCleared   = await clearSandbox(businessId, supabase);
  const discoveryCleared = await clearDiscovery(businessId, supabase);
  console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'populate:cleared', sandbox: sandboxCleared, discovery: discoveryCleared }));

  // Write the real catalog.
  const rows = extract.items.map((item, i) => catalogItemToInventoryRow(item, businessId, i));
  const { error: insErr } = await supabase.from('business_inventory').insert(rows);
  if (insErr) {
    console.log(JSON.stringify({ tag: '[TRACE:POPULATE]', phase: 'populate:insert-error', error: insErr.message }));
    return {
      businessId, sourceUrl, extract,
      cleared: { sandbox: sandboxCleared, discovery: discoveryCleared },
      inserted: 0, flaggedInserted: 0, status: 'insert-failed', error: insErr.message,
    };
  }
  const flaggedInserted = rows.filter(r => r.status === 'review').length;

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
        inserted:       rows.length,
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
    inserted: rows.length, flaggedInserted, high: extract.highConfidence,
    profilePersisted: !profErr,
  }));

  return {
    businessId, sourceUrl, extract,
    cleared: { sandbox: sandboxCleared, discovery: discoveryCleared },
    inserted: rows.length, flaggedInserted,
    status: profErr ? 'populated-no-profile' : 'populated',
    error: null,
  };
}
