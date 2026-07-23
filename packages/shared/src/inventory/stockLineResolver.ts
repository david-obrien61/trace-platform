// stockLineResolver — resolve a scanned/typed identifier to a business_inventory
// STOCK LINE (the lot), generically, across verticals.
//
// PURPOSE:      D-34 ("the lot is the SKU") anchors purchase + count to the
//               business_inventory stock line, NOT a per-specimen row. Two surfaces
//               need the same resolution ladder over business_inventory — the walk-and-
//               count loop (InventoryCount) and the purchase path (usePlant). This is the
//               ONE shared core they both call (CLAUDE.md §6 rule 8, semantic-dup): given
//               a scan slug / sku / name (+ optional size), resolve to a business_inventory
//               row via SKU exact → NAME token-set equality → SIZE-picker on a multi-size
//               collision. The most-specific vertical lane (a cultivar_plants tag_id) stays
//               in each caller — this module is AGNOSTIC (AC-1): it names no vertical table,
//               only the shared business_-prefixed catalog.
// DEPENDENCIES: business_inventory (business_id-scoped read — AC-3), and the canonical
//               token-set key (@trace/shared/utils/canonicalName). No vertical coupling.
// OUTPUTS:      resolveStockLine → a discriminated result (resolved | collision | miss).
//               detectSizeCollision → the L5 NEED_CLARIFICATION discriminator (moved here
//               from InventoryCount so both callers share one definition, not a drifted copy).
//
// LADDER (most-specific → least, mirrors the grower-resolve design 2026-06-26):
//   L2  business_inventory.sku exact (ilike)
//   L4  NAME token-set EQUALITY (order-insensitive; fixes the discovery-catalog case where
//       a QR slug "vitex-shoal-creek" and the row "Shoal Creek Vitex" share only the words)
//   L5  SIZE-picker: when L4 returns >1 rows that are the SAME variety in different sizes
//       (one shared non-null variant_group, each a distinct size) → surface a choice; a
//       genuinely ambiguous >1 (mixed/empty variant_group) → miss (surface-don't-presume).
//   The caller's L1 (a vertical tag lane) runs BEFORE this and is not this module's concern.

import type { SupabaseClient } from '@supabase/supabase-js';
import { nameTokenSet, tokenSetsEqual } from '../utils/canonicalName';
import { normalizeSize } from '../utils/sizeLabel';

// A resolved business_inventory row. The core identity fields are always selected; the
// pricing/status fields are present only when the caller requests the extended column set
// (STOCK_LINE_COLUMNS) — so a count (which needs only identity) keeps a minimal, migration-
// independent query, while a purchase (which needs sell_price) asks for the full row.
export interface StockLineRow {
  id: string;
  name: string;
  sku: string | null;
  qty: number | null;
  size: string | null;
  variant_group: string | null;
  // extended (present iff selected via STOCK_LINE_COLUMNS)
  sell_price?: number | null;
  unit_cost?: number | null;
  status?: string | null;
  received_at?: string | null;
  description?: string | null;
  // import-extended (present iff selected via STOCK_LINE_IMPORT_COLUMNS) — 20260723 columns.
  price_basis?: string | null;
  attributes?: Record<string, string> | null;
}

// The minimal identity SELECT — byte-identical to InventoryCount's proven L4 query, so
// consuming this resolver does NOT change the count flow's query shape (#72 no-regress).
export const STOCK_LINE_IDENTITY_COLUMNS = 'id, name, sku, qty, size, variant_group';

// The extended SELECT — identity + the fields a purchase-path synthesis needs. Requires the
// sell_price column (migration 20260707_business_inventory_sell_price) to be applied.
export const STOCK_LINE_COLUMNS =
  'id, name, sku, qty, size, variant_group, sell_price, unit_cost, status, received_at, description';

// The import SELECT — identity + the pricing/attribute fields the CSV importer reconciles a row
// against (so an UPDATE merges into an existing attribute bag rather than clobbering it). Requires
// the 20260723 columns (price_basis, attributes) applied.
export const STOCK_LINE_IMPORT_COLUMNS =
  'id, name, sku, qty, size, variant_group, status, sell_price, price_basis, attributes';

export type StockLineResolution =
  | { kind: 'resolved'; via: 'sku' | 'name'; row: StockLineRow }
  | { kind: 'collision'; variety: string; variantGroup: string; candidates: StockLineRow[] }
  /** `candidates` is carried on an AMBIGUOUS miss so the caller's trace can SHOW the rows that
   *  defeated the size-picker instead of asserting a cause. The emit used to append a hardcoded
   *  "(ungrouped siblings)" to every ambiguous miss — for Alley Cat, whose four rows were all
   *  grouped and one of which had a blank size, that parenthetical was simply FALSE, and the
   *  correct diagnosis had to be reached by hand. Printing {group, size} per candidate makes the
   *  cause VISIBLE without re-spelling detectSizeCollision's predicate anywhere (STD-011 — a
   *  second copy of that rule, written to explain the first, is exactly what drifts). */
  | { kind: 'miss'; reason: 'no_match' | 'ambiguous'; ambiguousCount?: number; candidates?: StockLineRow[] };

/**
 * L5 NEED_CLARIFICATION discriminator: are these >1 token-equal matches the SAME variety in
 * different SIZES (→ size-picker), or a genuinely ambiguous collision (→ miss)?
 * Size collision ⟺ every match shares the SAME non-null variant_group AND each carries a
 * DISTINCT non-empty size. Any mixed/missing variant_group, any missing/duplicate size →
 * NOT a size collision (surface-don't-presume). Moved verbatim from InventoryCount so the
 * two callers share ONE definition.
 */
export function detectSizeCollision(
  matches: Array<{ size: string | null; variant_group: string | null }>,
): boolean {
  if (matches.length < 2) return false;
  const group = matches[0].variant_group;
  if (group == null || group.trim() === '') return false;             // group must be set…
  if (!matches.every(m => m.variant_group === group)) return false;   // …and shared by all
  // Sizes are folded through the ONE shared vocabulary (normalizeSize) before the distinctness
  // test, so "15" and "15 gal" are ONE size, not two — a family carrying both spellings of one
  // physical size is a DUP (not a clean picker), and detectSizeCollision correctly declines it.
  const sizes = matches.map(m => normalizeSize(m.size).toLowerCase());
  if (sizes.some(s => s === '')) return false;                        // every row needs a size
  return new Set(sizes).size === matches.length;                      // all distinct (normalized)
}

/**
 * THE PURE LADDER — resolve an identifier against an ALREADY-FETCHED catalog, no DB, no async.
 * SKU exact → NAME token-set equality → SIZE-picker, identical in behaviour to resolveStockLine's
 * L2/L4/L5 (which now delegates here).
 *
 * WHY THIS EXISTS (STD-011 — the prompt's "reuse the resolver, do not fork a second matcher"):
 * the CSV catalog import must resolve a whole file of rows against the tenant's catalog in the
 * BROWSER, with no per-row round-trip and no service key — a pure decision over an in-memory
 * array, the reconcileMath.ts shape. It cannot call resolveStockLine (that reads the DB). So the
 * decision is extracted here ONCE and both callers share it: resolveStockLine fetches then
 * delegates; the importer fetches the catalog once and delegates per row. There is one matcher.
 *
 * @param catalog     the tenant's business_inventory rows (business_id-scoping is the caller's
 *                    job — this function names no tenant and reads no DB; AC-1/AC-3).
 * @param identifier  a SKU, a scanned slug, or a name.
 */
export function resolveAgainstCatalog(
  catalog: StockLineRow[],
  identifier: string,
): StockLineResolution {
  const id = (identifier ?? '').trim();
  if (!id) return { kind: 'miss', reason: 'no_match' };

  // L2 — SKU exact (case-insensitive, trimmed). In-memory equivalent of the .ilike() query.
  const idLower = id.toLowerCase();
  const skuHit = catalog.find(r => (r.sku ?? '').trim().toLowerCase() === idLower);
  if (skuHit) return { kind: 'resolved', via: 'sku', row: skuHit };

  // L4 — NAME token-set equality.
  const scannedKey = nameTokenSet(id);
  if (scannedKey.size > 0) {
    const matches = catalog.filter(row => tokenSetsEqual(nameTokenSet(row.name), scannedKey));

    if (matches.length === 1) return { kind: 'resolved', via: 'name', row: matches[0] };
    if (matches.length > 1) {
      // L5 — SAME variety, different sizes → size-picker.
      if (detectSizeCollision(matches)) {
        const candidates = [...matches].sort((a, b) =>
          (a.size ?? '').trim().localeCompare((b.size ?? '').trim(), undefined, { numeric: true }));
        return {
          kind: 'collision',
          variety: matches[0].name,
          variantGroup: matches[0].variant_group as string,
          candidates,
        };
      }
      // Genuinely ambiguous (mixed/empty variant_group, or a missing/duplicate size) — do NOT
      // auto-pick. The candidates ride along so the caller can show WHY, not guess why.
      return { kind: 'miss', reason: 'ambiguous', ambiguousCount: matches.length, candidates: matches };
    }
  }

  return { kind: 'miss', reason: 'no_match' };
}

/**
 * Resolve an identifier to a business_inventory stock line via SKU → NAME → SIZE-picker.
 * business_id-scoped (AC-3). Vertical-agnostic (AC-1) — names only business_inventory.
 *
 * @param columns  the SELECT column set. Default = identity-only (migration-independent,
 *                 count flow); pass STOCK_LINE_COLUMNS for the purchase-path synthesis.
 */
export async function resolveStockLine(
  supabase: SupabaseClient,
  businessId: string,
  identifier: string,
  opts?: { columns?: string },
): Promise<StockLineResolution> {
  const columns = opts?.columns ?? STOCK_LINE_IDENTITY_COLUMNS;
  const id = identifier.trim();
  if (!id) return { kind: 'miss', reason: 'no_match' };

  // L2 — SKU exact as a TARGETED query, unchanged: preserves the count flow's proven query shape
  // (#72 no-regress) and returns without fetching the whole tenant on a SKU hit.
  const { data: lot } = await supabase
    .from('business_inventory')
    .select(columns)
    .eq('business_id', businessId)
    .ilike('sku', id)
    .maybeSingle();
  if (lot) return { kind: 'resolved', via: 'sku', row: lot as unknown as StockLineRow };

  // L4/L5 — fetch the tenant's rows and delegate the token-equality + size-collision decision to
  // the ONE pure ladder (STD-011). The ladder re-runs an in-memory SKU pass which necessarily
  // misses here (the targeted query above already missed), so the result is identical to the
  // former inline logic — with the sole marginal difference that a SKU differing only in
  // whitespace, which .ilike would miss, now matches; that is a strict improvement, not a regress.
  const { data: rows } = await supabase
    .from('business_inventory')
    .select(columns)
    .eq('business_id', businessId);
  return resolveAgainstCatalog((rows ?? []) as unknown as StockLineRow[], id);
}

/**
 * SEARCH the tenant's stock lines by a PARTIAL identifier — a substring of the SKU or name,
 * or a token subset of the name. Unlike resolveStockLine (which requires an exact SKU match
 * or a full name token-set EQUALITY, correct for a scanned QR that carries the whole slug),
 * this powers the manual "Look up" field where a human types "vitex" / "shoal" / "SCV" and
 * expects the matching lot(s) back, not a dead-end "not recognized".
 *
 * Match rule (any one hits): the trimmed term is a case-insensitive substring of `sku` or
 * `name`, OR every token of the term appears in the row's name token set (partial multi-word,
 * e.g. "shoal creek" ⊆ "Shoal Creek Vitex"). business_id-scoped (AC-3), vertical-agnostic
 * (AC-1). Returns up to `limit` rows sorted by name (numeric-aware). An empty term → [].
 */
export async function searchStockLines(
  supabase: SupabaseClient,
  businessId: string,
  term: string,
  opts?: { columns?: string; limit?: number },
): Promise<StockLineRow[]> {
  const columns = opts?.columns ?? STOCK_LINE_IDENTITY_COLUMNS;
  const limit   = opts?.limit ?? 25;
  const t = term.trim().toLowerCase();
  if (!t) return [];

  const { data: rows } = await supabase
    .from('business_inventory')
    .select(columns)
    .eq('business_id', businessId);

  const termTokens = nameTokenSet(t);
  const matches = ((rows ?? []) as unknown as StockLineRow[]).filter((row) => {
    const name = (row.name ?? '').toLowerCase();
    const sku  = (row.sku ?? '').toLowerCase();
    if (name.includes(t) || (sku && sku.includes(t))) return true;      // substring on name/sku
    if (termTokens.size === 0) return false;
    const nameTokens = nameTokenSet(row.name);                          // token subset (multi-word)
    for (const tok of termTokens) if (!nameTokens.has(tok)) return false;
    return true;
  });

  return matches
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? '', undefined, { numeric: true }))
    .slice(0, limit);
}
