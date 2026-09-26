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

// ════════════════════════════════════════════════════════════════════════════════════════════
// THE DISPLAY HALF — added 2026-09-26 (ledger #420, tech-debt #339). The fold above is for
// COMPARING; these two are for RENDERING, and nothing above them changes.
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 WHY THEY BELONG IN THIS FILE RATHER THAN A NEW ONE: this module's own header already says it is
// "the ONE canonical SIZE vocabulary (STD-011)" and that a second copy is how a size vocabulary
// drifts. A separate display module would be that second copy. **`normalizeSize` decides whether two
// sizes are the same; `formatSize` decides what one of them looks like on a screen — and they must
// not disagree about what "no size" is.**
//
// 🔴 MEASURED BEFORE THESE WERE WRITTEN (2026-09-26, `packages/cultivar-os/src/**/*.tsx`): SEVEN
//    different fallbacks for a missing size.
//      `size ?? ''`                 ×9   ← a lot with no size renders as NOTHING, on nine surfaces
//      `size ?? null`               ×2
//      `size ?? container`          ×2   ← borrows a different field
//      `size ?? '—'`                ×2
//      `size ?? 'this size'`        ×1
//      `size ?? 'no size recorded'` ×1   ← the only one that said anything
//      `size ?? '(no size…'`        ×1
//
// 🔴 **NINE SURFACES PRINT BLANK, AND BLANK IS THE ONE ANSWER THAT LIES.** David, 2026-09-12, about
//    the load list: *"Blank is indistinguishable from zero, and a yard person cannot tell the
//    difference between 'no T-posts needed' and 'we could not work it out.'"* A blank size cell reads
//    as *"this lot has no size"* when it means *"nobody recorded one"* — and **both states genuinely
//    exist**, because `slip` and `4 in` have no volume on LAWNS's ladder. D-9 / A9 in one cell.
//
// ⚠️ **`formatSize` DOES NOT FOLD.** D-23 applies to it exactly as the header says it applies to
//    `normalizeSize`: `#30`, `30 Gallon` and `30 gal` each print AS WRITTEN. A caller that wants one
//    canonical spelling on screen wants the LADDER's rung label (`resolveRung`), which is a different
//    question with a different answer.

/** How a caller wants the ABSENCE of a size rendered. There is deliberately no option for blank. */
export type SizeAbsence =
  /** A dense grid cell: short, but still not empty. */
  | 'dash'
  /** A sentence, for anywhere a person is deciding something. The default. */
  | 'sentence';

/** The two absence renderings, in one place so no screen invents a third. */
export const SIZE_ABSENT: Readonly<Record<SizeAbsence, string>> = Object.freeze({
  dash: '—',
  sentence: 'no size recorded',
});

/**
 * Is a size actually recorded? One predicate, so a caller never re-guesses with `!!size`.
 *
 * ⚠️ A STRING OF SPACES IS NOT A RECORDED SIZE. `!!' '` is true, which is exactly how a whitespace-only
 * value passes every check and then renders blank.
 */
export function sizeIsRecorded(size: string | null | undefined): boolean {
  return typeof size === 'string' && size.trim() !== '';
}

/**
 * What a screen prints for a container size. **It never returns an empty string.**
 *
 * `absent` chooses how the absence reads; the default is the sentence, because the short form is only
 * right where a column heading already supplies the context.
 */
export function formatSize(
  size: string | null | undefined,
  absent: SizeAbsence = 'sentence',
): string {
  if (!sizeIsRecorded(size)) return SIZE_ABSENT[absent];
  // Collapse the whitespace a CSV or an invoice line brings with it — `'30  gal '` and `'30 gal'` are
  // the same thing typed twice, and neither is a different SIZE.
  return (size as string).trim().replace(/\s+/g, ' ');
}
