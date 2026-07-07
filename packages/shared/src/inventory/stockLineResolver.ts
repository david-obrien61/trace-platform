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
}

// The minimal identity SELECT — byte-identical to InventoryCount's proven L4 query, so
// consuming this resolver does NOT change the count flow's query shape (#72 no-regress).
export const STOCK_LINE_IDENTITY_COLUMNS = 'id, name, sku, qty, size, variant_group';

// The extended SELECT — identity + the fields a purchase-path synthesis needs. Requires the
// sell_price column (migration 20260707_business_inventory_sell_price) to be applied.
export const STOCK_LINE_COLUMNS =
  'id, name, sku, qty, size, variant_group, sell_price, unit_cost, status, received_at, description';

export type StockLineResolution =
  | { kind: 'resolved'; via: 'sku' | 'name'; row: StockLineRow }
  | { kind: 'collision'; variety: string; variantGroup: string; candidates: StockLineRow[] }
  | { kind: 'miss'; reason: 'no_match' | 'ambiguous'; ambiguousCount?: number };

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
  const sizes = matches.map(m => (m.size ?? '').trim());
  if (sizes.some(s => s === '')) return false;                        // every row needs a size
  return new Set(sizes).size === matches.length;                      // all distinct
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

  // L2 — SKU exact.
  const { data: lot } = await supabase
    .from('business_inventory')
    .select(columns)
    .eq('business_id', businessId)
    .ilike('sku', id)
    .maybeSingle();
  if (lot) return { kind: 'resolved', via: 'sku', row: lot as unknown as StockLineRow };

  // L4 — NAME token-set equality (fetch the tenant's rows, filter by canonical key).
  const scannedKey = nameTokenSet(id);
  if (scannedKey.size > 0) {
    const { data: rows } = await supabase
      .from('business_inventory')
      .select(columns)
      .eq('business_id', businessId);
    const matches = ((rows ?? []) as unknown as StockLineRow[]).filter(row =>
      tokenSetsEqual(nameTokenSet(row.name), scannedKey));

    if (matches.length === 1) {
      return { kind: 'resolved', via: 'name', row: matches[0] };
    }
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
      // Genuinely ambiguous (mixed/empty variant_group) — do NOT auto-pick.
      return { kind: 'miss', reason: 'ambiguous', ambiguousCount: matches.length };
    }
  }

  return { kind: 'miss', reason: 'no_match' };
}
