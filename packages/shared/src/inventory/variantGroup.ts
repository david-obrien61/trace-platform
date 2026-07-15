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
 *  size is blank (nothing to suffix yet). Idempotent — never double-appends an already-present suffix. */
export function deriveSiblingSku(parentSku: string | null | undefined, size: string | null | undefined): string | null {
  const base = (parentSku ?? '').trim();
  const suffix = skuSizeSuffix((size ?? '').trim());
  if (!base || !suffix) return null;
  return base.toUpperCase().endsWith(`-${suffix}`) ? base : `${base}-${suffix}`;
}
