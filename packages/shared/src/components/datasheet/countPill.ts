/**
 * ── countPill — the grid header's count sentence, as a pure function ────────────────────────
 *
 * PURPOSE:      Decide what the DataSheet header claims about how many rows exist. It is a
 *               CLAIM, not decoration (§6 r18: a header's assertion must hold for every row the
 *               section can contain), and it was previously three interpolations inline in JSX —
 *               so "what does this grid say its total is" could only be answered by opening the
 *               app. That is tech-debt #134's shape and it is why the defect below shipped.
 *
 * DEPENDENCIES: none — pure.
 *
 * OUTPUTS:      countPillText() → the string rendered in the header pill.
 *
 * 🔴 THE DEFECT THIS EXISTS TO MAKE IMPOSSIBLE. The Customers grid read `1000 of 1000` against a
 *    table holding 1,964. PostgREST caps an unbounded `.select()` at 1000 rows, and the header
 *    took its total from `rows.length` — the array it was handed — so the screen did not truncate,
 *    it ASSERTED: the 1,000th customer was the last one that existed as far as the reader could
 *    tell. It was honest on `/inventory` in the same session (`647 of 647`) for exactly one
 *    reason: 647 is under the cap. Every list that can exceed 1000 rows had this latent.
 *
 *    So `total` is a SEPARATE INPUT from the rows in hand. When they differ the sentence says
 *    `showing N of TOTAL`; a consumer that holds everything passes no total and the rows in hand
 *    ARE the total. A grid may only claim what it was actually given (D-9).
 *
 * Run: node scripts/run-tests.mjs   (probes in reportFidelity.test.ts §D)
 */

export interface CountPillInput {
  /** Rows currently VISIBLE after search + status filtering. */
  visible: number;
  /** Rows the grid was HANDED — never assumed to be the whole table. */
  loaded: number;
  /** The table's TRUE count when the consumer paged a bounded read; null = loaded is everything. */
  total?: number | null;
  /** A search string or a non-'all' status is active — the visible count is a subset by choice. */
  filtered: boolean;
  /** "customers" / "items" / "assets". */
  itemNoun: string;
}

export function countPillText({ visible, loaded, total, filtered, itemNoun }: CountPillInput): string {
  const trueTotal = total ?? loaded;
  // 🔴 PARTIAL = the grid holds fewer rows than exist. The word "showing" is load-bearing: it is
  // the difference between reporting a page and asserting a population.
  const partial = total != null && loaded < total;
  if (partial) return `showing ${visible} of ${trueTotal}${filtered ? ' matching' : ` ${itemNoun}`}`;
  return `${visible} of ${trueTotal}${filtered ? ' shown' : ` ${itemNoun}`}`;
}
