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

/** THE ONE (variant_group, size) identity key (STD-011). Null when the row cannot participate in a
 *  collision at all — a blank group or a blank size. Every surface that asks "is this pair taken?"
 *  spells the key HERE and nowhere else: the post-hoc detector (findDuplicateSizeGroups), the
 *  pre-hoc guard (findSizeTwin), and the grid's per-row flag all read it, so a key change can never
 *  make the detector and the guard disagree about what "the same size in the same group" means.
 *  Case/whitespace-insensitive — size is a free label.
 *
 *  The key is a JSON pair, not a '||'-joined string. The old form carried the comment "'||' separator
 *  → no cross-pair key collision", which was simply FALSE: group "a||b" + size "c" and group "a" +
 *  size "b||c" both produced "a||b||c". variant_group is owner-editable free text on the grid, so
 *  that is reachable, not hypothetical. JSON escaping makes the pair genuinely unambiguous — the
 *  comment now describes what the code does. (Consequence is mild — a false collision FLAG, never a
 *  wrong write — but a key that can be forged is not a key.) */
export function sizeGroupKey(variantGroup: string | null | undefined, size: string | null | undefined): string | null {
  const vg = (variantGroup ?? '').trim();
  const sz = (size ?? '').trim();
  if (!vg || !sz) return null;
  return JSON.stringify([vg, sz.toLowerCase()]);
}

/** A row as the pre-hoc guard needs it — identity + the pair. */
export interface SizeTwinCandidate extends DupSizeCandidate {
  id:   string;
  sku?: string | null;
}

/**
 * THE PRE-HOC GUARD: is (variantGroup, size) ALREADY taken by another row? Returns that row (so the
 * caller can name it and offer to edit it) or null when the pair is free. `excludeId` skips the row
 * being edited so re-saving its own size never false-collides.
 *
 * The sibling of findDuplicateSizeGroups: same fact, same key, opposite moment. The detector
 * surfaces a collision that already exists; this REFUSES to mint one. Both were needed — D-46's
 * editor enforced SKU uniqueness and never checked SIZE uniqueness within the group, so
 * "+ Add size" on Acoma Crape Myrtle with size "15" passed the SKU guard (DISC-1002-15G is unique)
 * and minted a second size-15 row beside DISC-1002 — ledger #73/#74's CASE 5, carried as
 * THEORETICAL since 2026-06-30, minted through the UI in under a minute on 2026-07-16.
 *
 * A SKU identifies one sellable unit; a (group, size) pair identifies one VARIANT. Two different
 * facts — guarding one is not guarding the other (WooCommerce/Shopify both refuse a duplicate
 * option combination independently of SKU).
 *
 * KNOWN LIMIT, RECORDED NOT FIXED (tech-debt #56): the match is exact after trim/case-fold, so
 * "15 gal" does not collide with "15" — two spellings of one physical size still slip through.
 * That is the size-VOCABULARY defect, its own build with its own blast radius (it can MERGE live
 * rows). Exact-match refusal is the NEED here, and it catches the live Acoma case.
 */
export function findSizeTwin<T extends SizeTwinCandidate>(
  rows: T[],
  pair: { variantGroup: string | null | undefined; size: string | null | undefined; excludeId?: string },
): T | null {
  const key = sizeGroupKey(pair.variantGroup, pair.size);
  if (key == null) return null;   // no group or no size → not a DUPLICATE (a different gate refuses it)
  return rows.find(r => r.id !== pair.excludeId && sizeGroupKey(r.variant_group, r.size) === key) ?? null;
}

/** Find (variant_group, size) duplicates among inventory rows. Pure + testable.
 *  Only rows with a non-blank variant_group AND a non-blank size participate (a parent
 *  row — size/variant_group absent — can never collide; see sizeGroupKey). Size match is
 *  case-insensitive (mirrors extractSizeVariants' own dedupe key) so "15 Gallon" / "15 gallon"
 *  still flag. Does NOT mutate or drop anything — detection only. */
export function findDuplicateSizeGroups(rows: DupSizeCandidate[]): DupSizeGroup[] {
  const groups = new Map<string, { variantGroup: string; size: string; varieties: string[] }>();
  for (const r of rows) {
    const key = sizeGroupKey(r.variant_group, r.size);
    if (key == null) continue;
    const g = groups.get(key) ?? { variantGroup: String(r.variant_group).trim(), size: (r.size ?? '').trim(), varieties: [] };
    g.varieties.push(r.name);
    groups.set(key, g);
  }
  return [...groups.values()]
    .filter(g => g.varieties.length > 1)
    .map(g => ({ variantGroup: g.variantGroup, size: g.size, count: g.varieties.length, varieties: g.varieties }));
}
