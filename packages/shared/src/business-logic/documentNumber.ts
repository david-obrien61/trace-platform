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
  | 'typed';     // NOT read — a person supplied it entirely

export interface DocumentNumberVerdict {
  provenance: DocumentNumberProvenance;
  /** A sentence for the person at the screen. Empty for 'read' — the normal case needs no notice. */
  notice: string;
  /** True when the stored value is a person's assertion rather than the document's. */
  isHumanSupplied: boolean;
}

/**
 * @param original what the reader READ at capture, banked once and never overwritten.
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
  const o = (original ?? '').trim();
  const c = (current ?? '').trim();

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
