// variantGroup — the ONE variant_group slug convention, shared across every path that
// keys a business_inventory row into a size-family group.
//
// PURPOSE:      Two paths write business_inventory.variant_group and they MUST agree, or a
//               scan-created row and a manually-added size of the SAME variety land in
//               DIFFERENT groups and the size-picker never fires (STD-011 — one canonical
//               representation of the fact "which size-family is this"):
//                 • D-45 count-promote (InventoryCount) — historically had a LOCAL slugify.
//                 • Manual "+ Add size" (InventoryEditor) — this build.
//               Both now derive the group key from the variety NAME through THIS one function,
//               so variantGroupSlug("Shoal Creek Vitex") === the QR slug "shoal-creek-vitex"
//               === whatever either path computes. Same input → same group, by construction.
// DEPENDENCIES: none.
// OUTPUTS:      variantGroupSlug(name) → a product-slug (lowercase, non-alphanumeric → hyphen,
//               trimmed), matching the QR product-slug shape (canonicalName resolves the two
//               to the same token set). Falls back to 'variety' for an all-symbol name so the
//               group is never an empty string.
// NOTE:         This is the hyphen-joined SLUG form (a stable group KEY), distinct from
//               canonicalNameKey's space-joined sorted-token form (a resolution key). The
//               slug is what the QR carries and what the group column stores; keep them one.

/** The canonical variant_group slug for a variety name. Lowercase, non-alphanumeric → hyphen,
 *  edge hyphens trimmed; empty result falls back to 'variety' (never a blank group). */
export function variantGroupSlug(name: string): string {
  return (name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'variety';
}

// ── SKU lineage — the ONE parent-SKU + per-size-suffix convention (STD-011) ───────────────────
// A size-sibling's SKU is the parent's SKU plus a compact size suffix (WooCommerce's parent-SKU +
// per-variation-SKU convention — LAWNS runs WooCommerce, and the DISC-#### SKUs are scraped from it;
// the fixture data already uses it: FIXTURE-PS-15G / FIXTURE-PS-07G / FIXTURE-PS-30G). Homed next to
// variantGroupSlug so the manual "+ Add size" path and any future scan/import path derive the SAME
// suffix from the SAME size string — one convention, never re-spelled.

/** Normalize a size label into a compact SKU suffix token.
 *  "45 gal"→"45G", "30 gal"→"30G", "7 gal"→"07G" (gallon numbers zero-padded to 2 to match
 *  FIXTURE-PS-07G), "4\""→"4IN", "quart"→"QT", "flat"→"FLAT". Unknown → compact UPPERCASE alnum.
 *  Blank size → '' (nothing to suffix). */
export function skuSizeSuffix(size: string): string {
  const s = (size ?? '').trim().toLowerCase();
  if (!s) return '';
  // Inches: 4", 4 in, 4 inch, 4-inch
  const inch = s.match(/(\d+(?:\.\d+)?)\s*(?:"|in\b|inch(?:es)?\b)/);
  if (inch) return `${inch[1].replace(/\./g, '')}IN`;
  // Quart(s)
  if (/\bq(?:ua)?rts?\b|\bqt\b/.test(s)) return 'QT';
  // Flat(s)
  if (/\bflats?\b/.test(s)) return 'FLAT';
  // Gallons: "45 gal", "45gal", "45 g", "45g", "#45" → zero-pad to 2 digits (matches FIXTURE-PS-07G).
  const gal = s.match(/(\d+)\s*(?:gal(?:lon)?s?|g)\b/) ?? s.match(/^#?(\d+)$/);
  if (gal) return `${gal[1].padStart(2, '0')}G`;
  // Fallback: compact alphanumeric, uppercase (never blank for a non-blank size).
  return s.replace(/[^a-z0-9]+/gi, '').toUpperCase();
}

/** Suggested SKU for a size-sibling: parent SKU + '-' + the size suffix (e.g. DISC-1001 + "45 gal" →
 *  "DISC-1001-45G"). Returns null when the parent has NO SKU (D-9 — never fabricate a base) or the
 *  size is blank (nothing to suffix yet). Idempotent — never double-appends an already-present suffix.
 *
 *  ⚠️ `parentSku` MUST be the family's BASE SKU, not whichever row the caller happens to be holding.
 *  This function cannot tell the difference: given a derived sibling it will happily suffix it again
 *  (DISC-1003-30G + "45 gal" → DISC-1003-30G-45G — live, 2026-07-16). The idempotence guard below
 *  only catches re-appending the SAME suffix. Resolve the base with baseSkuOf first, or call
 *  suggestSiblingSku, which does it for you. */
export function deriveSiblingSku(parentSku: string | null | undefined, size: string | null | undefined): string | null {
  const base = (parentSku ?? '').trim();
  const suffix = skuSizeSuffix((size ?? '').trim());
  if (!base || !suffix) return null;
  return base.toUpperCase().endsWith(`-${suffix}`) ? base : `${base}-${suffix}`;
}

/**
 * The family's BASE SKU — the lineage root every size-sibling's SKU derives from.
 *
 * THE ONE base-resolution rule (STD-011). Homed here beside deriveSiblingSku (moved from
 * countPromote.ts, where it was reachable only by the count path) because SKU lineage is a
 * SKU fact, not a counting fact — the manual "+ Add size" editor needs the identical rule and
 * has no business importing the count's promote decision to get it.
 *
 * Shortest non-blank SKU wins: within ONE variety's family a derived sibling SKU is always its
 * base plus a suffix ("DISC-1001" → "DISC-1001-30G"), so the base is always the shortest. This
 * reaches PAST a sku-null sibling and past an already-compounded one — given the live Alley Cat
 * family [DISC-1003, DISC-1003-30G, DISC-1003-30G-45G] it returns DISC-1003.
 * Returns null when no sibling carries a SKU — D-9 omit-not-fake: never invent a base.
 */
export function baseSkuOf(siblings: Array<{ sku: string | null }>): string | null {
  const skus = siblings.map(s => (s.sku ?? '').trim()).filter(Boolean);
  if (skus.length === 0) return null;
  return skus.reduce((a, b) => (b.length < a.length ? b : a));
}

/**
 * The SKU to suggest for a NEW size added to an existing variety family: the family's base SKU +
 * the size suffix. THE ONE call every sibling-minting path makes (STD-011) — the count's promote
 * and the manual "+ Add size" editor, so the two can never derive a SKU by different rules.
 *
 * SCAR (live, 2026-07-16): the editor passed the CLICKED ROW's SKU as the base, so adding a size
 * from the DISC-1003-30G row minted **DISC-1003-30G-45G**, and the next one would have been
 * DISC-1003-30G-45G-15G. The count path called the same deriveSiblingSku minutes later and got
 * DISC-1003-60G right — from this very family — because it resolved the base first. Base +
 * suffix, never suffix-of-suffix (the WooCommerce parent-SKU convention, ledger #127).
 *
 * @param family the variety's existing rows (any order — the base is derived, never positional)
 */
export function suggestSiblingSku(family: Array<{ sku: string | null }>, size: string | null | undefined): string | null {
  return deriveSiblingSku(baseSkuOf(family), size);
}
