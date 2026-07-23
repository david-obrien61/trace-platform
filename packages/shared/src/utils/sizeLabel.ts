// ============================================================
// sizeLabel — the ONE canonical SIZE vocabulary (STD-011), the sibling of canonicalName's
// nameTokenSet. A grower writes the same container size six ways ("30", "30 gal", "30gal", "30G",
// "#30", "30-gallon") and the catalog stores whatever it was first given; so any code that decides
// "is this the same size?" must fold those forms to ONE value FIRST — exactly as nameTokenSet folds
// name spellings before comparison. There is ONE definition of that fold, here, and every size
// comparison in the platform (the count promote's UPDATE-vs-CREATE, the import matcher, the L5
// size-picker's distinctness test) imports it. A second copy is how a size vocabulary drifts — the
// shape of the `reserved` survival after D-52 (§6 rule 8, semantic-dup).
//
// FAITHFUL-BEFORE-CONNECTED (D-23) — WHY THIS IS COMPARISON-ONLY, NEVER A WRITE:
//   normalizeSize is used to COMPARE two sizes, never to rewrite the size a grower stored. The
//   owner's "30 gal" stays "30 gal" on their row; we only fold it to a canonical form in memory to
//   ask whether it means the same as a catalog "30". Rewriting stored values would be the platform
//   deciding it knows the owner's vocabulary better than the owner — the exact thing D-23 forbids.
//
// THE DEFECT THIS CLOSES (live 2026-07-23, ledger #150 · tech-debt #56): the catalog held Shoal
// Creek Vitex at size "30" (a bare trade number) while a CSV said "30 gal" and Basham's child row
// said "30 gal" — compared as exact strings, "30" ≠ "30 gal", so the import CREATED a duplicate lot
// instead of resolving to the existing one. Size was the one attribute never given nameTokenSet's
// treatment (D-45 did it for names, nobody did it for sizes).
//
// SCOPE OF THE FOLD (ANSI Z60.1 — "gallon" is a container-class trade label): the gallon family
// collapses to one form "N Gallon". A BARE trade number is read as gallon-class (a nursery catalog's
// "30" is a 30-gallon container) — but ONLY a bare INTEGER: a bare decimal ("1.5", "2.5") is far more
// likely a caliper inch than a fractional gallon, so it is passed through untouched. Anything with a
// non-gallon unit (caliper `"`, height `ft`) is NOT a gallon and passes through trimmed — size spans
// measurement systems across growers, and we never force a value into a gallon it isn't.
// OUTPUTS: normalizeSize · sameSizeLabel.
// ============================================================

/**
 * Canonical TRADE-size string for COMPARISON. The gallon family — "5 gal" / "5-gallon" / "5gal" /
 * "5G" / "#5" / bare "5" — folds to one form "5 Gallon". A bare decimal or any non-gallon unit is
 * passed through trimmed (never forced into a gallon it isn't). NEVER write the result back to a
 * grower's row (D-23) — this is a comparison key only.
 */
export function normalizeSize(raw: string | null | undefined): string {
  const t = (raw ?? '').trim();
  if (t === '') return '';
  const s = t.toLowerCase().replace(/\s+/g, ' ');
  const gal =
    s.match(/(\d+(?:\.\d+)?)\s*-?\s*gal(?:lon)?s?\b/) ||   // 5 gallon / 5-gallon / 5gal / 5 gals
    s.match(/(\d+(?:\.\d+)?)\s*g\b/) ||                    // 5g / 5 g
    s.match(/^#\s*(\d+(?:\.\d+)?)\b/) ||                   // #5  (container-number = gallon-class)
    s.match(/^(\d+)$/);                                    // bare INTEGER = gallon-class container
  if (gal) return `${gal[1].replace(/\.0+$/, '')} Gallon`;
  return t.replace(/\s+/g, ' ');
}

/**
 * Do two size labels denote the SAME size? Folds both through normalizeSize, then compares
 * case-insensitively. `sameSizeLabel(null, null)` is true (both "no size") — load-bearing at the
 * count promote's stub branch, so keep it. The ONE size-equality test the platform shares.
 */
export function sameSizeLabel(a: string | null | undefined, b: string | null | undefined): boolean {
  return normalizeSize(a).toLowerCase() === normalizeSize(b).toLowerCase();
}
