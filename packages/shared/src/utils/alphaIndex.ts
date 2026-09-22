// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Put a long list under an A–Z index — which letter a displayed name files under,
//               and how many names each letter holds. LAWNS's roster is 2,005 customers; the
//               screen opened NEWEST FIRST, so finding "Highland Homes" meant scrolling 2,005
//               rows or knowing to type it.
// DEPENDENCIES: none — pure, no React, no database. The grid and its probes both read it.
// OUTPUTS:      ALPHA_KEYS · OTHER_KEY · alphaKeyFor() · countByAlphaKey().
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 IT FILES BY WHAT THE EYE SEES, NOT BY WHAT THE RECORD HOLDS.
// ═════════════════════════════════════════════════════════════════════════════
// The key is taken from the DISPLAYED name, exactly as rendered. Two consequences, both chosen:
//
//   · A PERSON FILES UNDER THEIR FIRST NAME. "Aaron Harlan" is under A, not H. A surname sort
//     would be the library convention, and it is wrong here for a measured reason: **522 of
//     LAWNS's 2,005 customers are ORGANIZATIONS with no surname at all** (measured live
//     2026-09-22), and 39 people carry a first name only. A list that sorts some rows by a word
//     the reader cannot see, and the rest by the word they can, reads as unsorted — which is
//     precisely the complaint that started this. WYSIWYG beats correct-but-invisible.
//   · A LEADING ARTICLE IS NOT STRIPPED. "The Oaks" files under T. Same rule: the reader's eye
//     starts at the first character, so the index must too.
//
// ⚠️ IF A SURNAME INDEX IS EVER WANTED, IT IS A DIFFERENT FEATURE and needs the displayed name
// to change with it ("Harlan, Aaron"), or the list will look broken again. Do not quietly swap
// the key underneath this one.
//
// ACCENTS FOLD, so "Ángel" is under A rather than off the end of the alphabet — the fold is a
// LOOKUP KEY and is never written back anywhere (D-23). Anything that does not fold to A–Z —
// a digit, "＆", an empty name — files under `#`, which is a real bucket and not a silent drop.
// ─────────────────────────────────────────────────────────────────────────────

/** A–Z, in order. */
export const ALPHA_LETTERS: readonly string[] =
  Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i));

/** Everything that is not a letter — digits, symbols, and a name nobody has filled in. */
export const OTHER_KEY = '#';

/** Every bucket the index can offer, in the order a strip renders them. */
export const ALPHA_KEYS: readonly string[] = [...ALPHA_LETTERS, OTHER_KEY];

/**
 * The bucket a displayed name files under: 'A'–'Z', or '#'.
 *
 * Null, empty and whitespace-only all answer '#'. That is deliberate — an unnamed record is a
 * real state and it gets a real bucket, rather than vanishing from every letter (D-9: absent is
 * not empty). LAWNS has none today; the roster will have one the first time somebody saves a
 * customer with only a phone number.
 */
export function alphaKeyFor(name: string | null | undefined): string {
  const s = (name ?? '').trim();
  if (!s) return OTHER_KEY;
  // NFD splits an accented letter into base + combining mark; dropping the marks leaves the base.
  const first = s.normalize('NFD').replace(/[̀-ͯ]/g, '').charAt(0).toUpperCase();
  return first >= 'A' && first <= 'Z' ? first : OTHER_KEY;
}

/**
 * How many rows sit under each bucket. EVERY key is present, including the ones holding zero.
 *
 * 🔴 THE ZEROS ARE THE POINT. A strip that renders only the letters in use looks like a complete
 * alphabet with letters missing, and a letter that is present but empty is a control that does
 * nothing when pressed — a dead affordance (§1.6 item 5). The caller needs the zero to render
 * that letter as unavailable, so the strip says "nobody here" instead of shrugging.
 */
export function countByAlphaKey<T>(rows: readonly T[], nameOf: (row: T) => string | null | undefined): Map<string, number> {
  const counts = new Map<string, number>();
  for (const k of ALPHA_KEYS) counts.set(k, 0);
  for (const r of rows) {
    const k = alphaKeyFor(nameOf(r));
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}
