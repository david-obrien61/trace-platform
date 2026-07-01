// ============================================================
// dupSize — pure (variant_group, size) duplicate detector (Cultivar OS shared)
// PURPOSE:      Detect a (variant_group, size) COLLISION among inventory rows — ≥2 rows that
//               share one variant_group AND the same size. At count time these make a variety
//               SILENTLY uncountable-by-scan (detectSizeCollision needs DISTINCT sizes per group,
//               so a dup collapses to UNKNOWN — the schema stress-battery CASE 5, ledger #73/#74).
//               DETECTION ONLY — never dedupes, auto-picks, or mutates. The fix is a human editing
//               the size/variant_group cell to disambiguate.
// DEPENDENCIES: NONE (zero-dep leaf). Extracted from populate.ts so a CLIENT surface (the inventory
//               datasheet) can reuse it WITHOUT dragging populate.ts's transitive @anthropic-ai/sdk
//               import into the browser bundle. populate.ts re-exports these for its own callers.
// OUTPUTS:      findDuplicateSizeGroups(rows) → DupSizeGroup[] (one per colliding (variant_group,size)).
// CALLERS:      populate.ts (surfaces dups at import WRITE time) + BusinessInventory.tsx (surfaces
//               dups as an inline amber flag at the reconcile surface, ledger #74 CASE-5 loop close).
// ============================================================

/** A (variant_group, size) collision: ≥2 rows that share one variant_group AND the same
 *  size. At count time these make the variety uncountable-by-scan (silent UNKNOWN). */
export interface DupSizeGroup {
  variantGroup: string;
  size:         string;
  count:        number;
  varieties:    string[];   // the names of the colliding rows (usually one variety, ≥2 rows)
}

/** The structural minimum findDuplicateSizeGroups reads. Both a freshly-built catalog row
 *  (catalogItemToInventoryRow's return) and a live business_inventory grid row satisfy it. */
export interface DupSizeCandidate {
  name:          string;
  size?:         string | null;
  variant_group?: string | null;
}

/** Find (variant_group, size) duplicates among inventory rows. Pure + testable.
 *  Only rows with a non-blank variant_group AND a non-blank size participate (a parent
 *  row — size/variant_group absent — can never collide). Size match is case-insensitive
 *  (mirrors extractSizeVariants' own dedupe key) so "15 Gallon" / "15 gallon" still flag.
 *  Does NOT mutate or drop anything — detection only. */
export function findDuplicateSizeGroups(rows: DupSizeCandidate[]): DupSizeGroup[] {
  const groups = new Map<string, { variantGroup: string; size: string; varieties: string[] }>();
  for (const r of rows) {
    const vg   = r.variant_group;
    const size = (r.size ?? '').trim();
    if (vg == null || String(vg).trim() === '' || size === '') continue;
    const key = `${vg}||${size.toLowerCase()}`;   // '||' separator → no cross-pair key collision
    const g = groups.get(key) ?? { variantGroup: vg, size, varieties: [] };
    g.varieties.push(r.name);
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter(g => g.varieties.length > 1)
    .map(g => ({ variantGroup: g.variantGroup, size: g.size, count: g.varieties.length, varieties: g.varieties }));
}
