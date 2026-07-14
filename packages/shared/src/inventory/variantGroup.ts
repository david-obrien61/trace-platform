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
