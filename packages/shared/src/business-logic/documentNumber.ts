/**
 * ── documentNumber — is this number the paper's, or the person's? ───────────────────────────────
 *
 * PURPOSE
 *   A document number that was READ off a page and one that a person TYPED are different kinds of
 *   evidence, and a stored string cannot tell you which it is. Banking what the reader read (the
 *   `*_original` shape `line_items_original` already uses) makes the difference recoverable; this
 *   module is the one place that INTERPRETS the pair, so no surface re-derives the rule.
 *
 *   🔴 THE ASYMMETRY IS THE WHOLE REASON THE ORIGINAL HAS TO BE BANKED. The interesting case is
 *   the one where the reader found NOTHING and a person supplied a number. The evidence for that
 *   is an ABSENCE, and an absence cannot be reconstructed later from a value that is present —
 *   which is why "compare it against the raw text" is not an available shortcut.
 *
 * DEPENDENCIES
 *   None. Pure. No vertical noun anywhere (AC-1) — every vertical that captures a document has
 *   exactly this question about it.
 *
 * OUTPUTS
 *   DocumentNumberProvenance + describeDocumentNumber.
 */

export type DocumentNumberProvenance =
  | 'absent'     // nothing read, nothing supplied — an honest blank
  | 'read'       // read off the document and left alone
  | 'corrected'  // read off the document, then changed by a person
  | 'typed'      // NOT read — a person supplied it entirely
  | 'unknown';   // 🔴 nothing was ever BANKED for this row. See the sentinel note below.

export interface DocumentNumberVerdict {
  provenance: DocumentNumberProvenance;
  /** A sentence for the person at the screen. Empty for 'read' — the normal case needs no notice. */
  notice: string;
  /** True when the stored value is a person's assertion rather than the document's. */
  isHumanSupplied: boolean;
}

/**
 * 🔴 THE SENTINEL, AND IT WAS FOUND BY LIVE DATA WITHIN HOURS OF SHIPPING (2026-09-04).
 *
 *   The first version had NULL doing two jobs, and they are not the same fact:
 *     · "the reader read nothing"        → a number present must then be TYPED by a person
 *     · "nothing was ever banked here"   → we know nothing about where the number came from
 *
 *   Every row captured before this column existed is the SECOND case, and so is any capture from
 *   a browser tab still running a pre-deploy bundle — which is not hypothetical: **measured on
 *   LAWNS at 2026-09-04T16:03Z, `Bailey Bark Materials, Inc.` $2180.79 carried
 *   `receipt_number = 595431` with `receipt_number_original = NULL`, and 595431 IS PRESENT IN
 *   THAT ROW'S `ocr_raw`.** The reader read it. The first rule would have told an owner she typed
 *   a number she never touched — [[R-79]]'s class exactly: a false claim about our OWN read,
 *   which is worse than a missing finding because it ASSERTS rather than omits.
 *
 *   So: **`''` (empty string) is the sentinel for "the reader read nothing"**, written
 *   deliberately at capture. **NULL means "not banked" and yields `unknown`** — an honest refusal
 *   to characterise, never an accusation.
 *
 * @param original what the reader READ at capture: a string, `''` if it read nothing, or NULL/
 *                 undefined if nothing was banked for this row at all.
 * @param current  what will be stored — the same value, or one a person edited.
 *
 * ⚠️ COMPARISON IS ON THE TRIMMED STRING AND IS OTHERWISE EXACT. It deliberately does NOT fold
 * case or strip punctuation: `19893519` and `19893519 ` are the same number typed twice, but
 * `INV-4021` and `inv4021` are two different assertions about what is printed, and calling them
 * equal would silently reclassify a correction as a read.
 */
export function describeDocumentNumber(
  original: string | null | undefined,
  current: string | null | undefined,
): DocumentNumberVerdict {
  // 🔴 NULL/undefined is NOT '' here, and the whole correction lives in this distinction.
  const banked = original !== null && original !== undefined;
  const o = (original ?? '').trim();
  const c = (current ?? '').trim();

  if (!banked) {
    return {
      provenance: 'unknown',
      // It ANNOUNCES the gap rather than filling it (D-9). An owner reading a receipt captured
      // before this column existed is told we cannot say, not told she typed something.
      notice: c === ''
        ? ''
        : 'This number was captured before we started recording where document numbers come from, so we cannot say whether it was read from the page or entered by hand.',
      isHumanSupplied: false,
    };
  }

  if (c === '') {
    return {
      provenance: 'absent',
      // An absence ANNOUNCES itself rather than rendering as a blank that could mean anything
      // (D-9 / A9). "We read one and you cleared it" is a different fact from "there was none".
      notice: o === ''
        ? 'No document number was found on this page, and none was entered.'
        : `A number was read from this page (${o}) and has been cleared. It will be saved without one.`,
      isHumanSupplied: false,
    };
  }
  if (o === '') {
    return {
      provenance: 'typed',
      notice: 'This number was not read from the page — you entered it. It will be recorded as yours.',
      isHumanSupplied: true,
    };
  }
  if (o === c) {
    return { provenance: 'read', notice: '', isHumanSupplied: false };
  }
  return {
    provenance: 'corrected',
    notice: `Read from the page as ${o}. Your correction will be recorded as yours.`,
    isHumanSupplied: true,
  };
}
