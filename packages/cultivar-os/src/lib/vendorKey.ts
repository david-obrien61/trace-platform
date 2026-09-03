// ============================================================
// vendorKey — the deterministic fold of a free-text vendor string.
//
// PURPOSE:      "Ask once, keep forever" needs a key, and there is NO VENDOR TABLE — `receipts
//               .vendor` is free text. The stored string is `Sudderth Brothers Contracting, Inc.`
//               and a person says "Sudderth"; keyed on the raw string those are two vendors and
//               the question gets asked twice, which is the failure this fold exists to prevent.
//
//               🔴 IT IS A FOLD, NOT AN IDENTITY. Two genuinely different vendors that fold to
//               one key WOULD collide, and nothing here detects that. This is the cheapest thing
//               that survives the spellings actually present in LAWNS's data (measured 2026-09-02:
//               `LAWNS Tree Farm, LLC.` · `bwi` · `Bailey Bark Materials, Inc.` · `Sudderth
//               Brothers Contracting, Inc.` — 4 distinct vendors across 17 rows, no near-misses),
//               and it is EXPLICITLY the seam a real vendor table replaces. A separate vendor-
//               identity recon is running; when it lands, the re-point joins on this key.
//
// DEPENDENCIES: none. Pure, no I/O, no clock — so a probe can reach every branch.
//
// OUTPUTS:      vendorKey(label) · VENDOR_SUFFIXES
// ============================================================

/**
 * Corporate suffixes stripped before folding. Deliberately SHORT: every entry is a form that
 * appears in real vendor strings and carries no distinguishing information. A longer list starts
 * eating words that DO distinguish ("Materials" is part of Bailey Bark's identity, not noise).
 */
const VENDOR_SUFFIXES = ['inc', 'llc', 'llp', 'ltd', 'co', 'corp', 'company', 'incorporated'];

/**
 * Fold a vendor label to a stable key.
 *
 * Lower-case → strip punctuation → collapse whitespace → drop trailing corporate suffixes.
 * An empty or absent label folds to `''`, which callers must treat as "no vendor", never as a
 * vendor whose name happens to be blank.
 */
export function vendorKey(label: string | null | undefined): string {
  if (label === null || label === undefined) return '';
  const cleaned = label
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()'"]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned === '') return '';

  // Suffixes come off the END only, and repeatedly ("Foo Co, Inc." → "foo"). Stripping them
  // anywhere would turn "Co-op Gardens" into "op gardens".
  let words = cleaned.split(' ');
  while (words.length > 1 && VENDOR_SUFFIXES.includes(words[words.length - 1])) {
    words = words.slice(0, -1);
  }
  return words.join(' ');
}
