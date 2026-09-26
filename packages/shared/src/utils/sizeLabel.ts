// ============================================================
// sizeLabel — THE ONE WAY A CONTAINER SIZE IS RENDERED, AND THE ONE WAY ITS ABSENCE IS.
//
// PURPOSE:      tech-debt #339 / backlog Y12: there was no size-DISPLAY standard. `normalizeSize` is
//               for COMPARING two spellings; `foldLabel` and `resolveRung` are for placing a size on
//               the ladder. **Nothing decided what a screen prints** — so each screen decided for
//               itself, and they did not agree.
//
// 🔴 MEASURED BEFORE THIS WAS WRITTEN (2026-09-26, `packages/cultivar-os/src/**/*.tsx`): SEVEN
//    DIFFERENT FALLBACKS FOR A MISSING SIZE.
//      `size ?? ''`                 ×9   ← a lot with no size renders as NOTHING, on nine surfaces
//      `size ?? null`               ×2
//      `size ?? container`          ×2   ← borrows a different field
//      `size ?? '—'`                ×2
//      `size ?? 'this size'`        ×1
//      `size ?? 'no size recorded'` ×1   ← the only one that says anything
//      `size ?? '(no size…'`        ×1
//
// 🔴 **NINE SURFACES PRINT BLANK, AND BLANK IS THE ONE ANSWER THAT LIES.** David, 2026-09-12, about
//    the load list: *"Blank is indistinguishable from zero, and a yard person cannot tell the
//    difference between 'no T-posts needed' and 'we could not work it out.'"* A blank size cell reads
//    as *"this lot has no size"* when it means *"nobody recorded one"* — and two of LAWNS's nine rungs
//    genuinely have no volume, so both states exist and must not look alike. This is D-9 / A9 applied
//    to one cell.
//
// 🔴 IT DOES NOT NORMALISE THE SPELLING, AND THAT IS DELIBERATE (D-23). The source wrote `#30`,
//    `30 Gallon`, `30 gal`; **`normalizeSize` exists to COMPARE those, never to rewrite what a person
//    typed.** `formatSize` trims and collapses whitespace and otherwise prints what is there. A
//    caller that wants one canonical spelling on screen wants the LADDER's rung label, which is a
//    different question with a different answer (`resolveRung`).
//
// DEPENDENCIES: none. PURE — no db, no clock, no DOM, no env, and no size vocabulary of its own.
// OUTPUTS:      SizeAbsence · SIZE_ABSENT · formatSize · sizeIsRecorded.
// AC-1: no vertical noun. A size is a size.
// ============================================================

/** How a caller wants the ABSENCE of a size rendered. There is no option for "blank". */
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
 * value reaches a screen and renders as blank while every check says it is present.
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
