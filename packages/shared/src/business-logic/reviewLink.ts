/**
 * ── reviewLink — the business's own "ask for reviews" link, and a Save that spans several tables ──
 *
 * PURPOSE      The pure rules the Business Profile Save rests on, extracted so they can be ASSERTED —
 *              a render condition or a message branch inside a `.tsx` cannot be (tech-debt #134):
 *                ① where the link lives, and whether a typed value is a usable one
 *                ② whether an edit to the field is a WRITE at all (`reviewLinkEdit`)
 *                ③ how a Save touching more than one table tells the owner what happened (`saveReport`)
 *
 * DEPENDENCIES none — pure.
 *
 * OUTPUTS      REVIEW_LINK_MODULE_KEY · readReviewLink · isUsableReviewUrl · reviewLinkEdit ·
 *              REVIEW_LINK_NOT_A_URL · REVIEW_LINK_NOT_LOADED · saveReport · SavePart
 *
 * 🔴 ONE STORE, NOT A NEW COLUMN. The link has lived in `business_modules.config.review_url` for the
 *    Follow-Up module since 2026-08-31 (ledger #247), and the crew's delivery screen reads it from
 *    there. On 2026-09-11 (ledger #300) the INPUT moved to Business Profile — where an owner looks for
 *    a fact set once, beside the name and phone — and the VALUE deliberately did not move. A
 *    `businesses.review_url` column would be a second store of one fact (STD-011), and a migration
 *    David would have to apply for a change that needs none.
 */

/** The module whose config holds the link. The crew screen, Business Profile and the module's own
 *  settings card all read THIS name — three sites, one spelling. */
export const REVIEW_LINK_MODULE_KEY = 'followup_engine';

/** The stored link out of a module config blob. Unknown keys are ignored; absent/blank/non-string → null. */
export function readReviewLink(config: Record<string, unknown> | null | undefined): string | null {
  const v = (config ?? {})['review_url'];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

/**
 * A review link must be an absolute http(s) URL — and that is ALL it must be.
 *
 * 🔴 WE DO NOT CHECK THAT IT IS A GOOGLE ADDRESS. Google has handed out several shapes over the years
 *    (`g.page/r/…/review`, `search.google.com/local/writereview?placeid=…`, `maps.app.goo.gl/…`) and a
 *    business may use a short link of its own. Refusing a shape we do not recognise would be us
 *    inventing a rule Google does not have — and the owner would have no way past it. `javascript:`
 *    and friends ARE refused: this string is rendered into a QR a customer scans.
 */
export function isUsableReviewUrl(url: string | null | undefined): boolean {
  const s = String(url ?? '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

export const REVIEW_LINK_NOT_A_URL =
  'it isn’t a web address — copy the whole link from Google, starting with https://';
export const REVIEW_LINK_NOT_LOADED =
  'the saved link hadn’t loaded yet, so it was left as it was';

export type ReviewLinkEdit =
  | { kind: 'unchanged' }
  | { kind: 'set'; url: string }
  | { kind: 'clear' }
  | { kind: 'refused'; reason: string };

/**
 * Is what the owner typed a write, and if so, which one?
 *
 * `loaded` is the stored link as READ — `''` when none is set — and `null` when the read has not
 * landed (or failed). The two must not be confused:
 *   · 🔴 NOT LOADED + BLANK FIELD → UNCHANGED, never CLEAR. The field is blank because nothing arrived,
 *     not because the owner emptied it; clearing would delete a link nobody touched.
 *   · NOT LOADED + TYPED VALUE → REFUSED, with a reason. Writing it would overwrite a value we never
 *     saw; staying silent would let "Saved" describe a write that did not happen.
 */
export function reviewLinkEdit(loaded: string | null, typed: string): ReviewLinkEdit {
  const t = String(typed ?? '').trim();
  if (loaded === null) return t === '' ? { kind: 'unchanged' } : { kind: 'refused', reason: REVIEW_LINK_NOT_LOADED };
  if (t === loaded.trim()) return { kind: 'unchanged' };
  if (t === '') return { kind: 'clear' };
  if (!isUsableReviewUrl(t)) return { kind: 'refused', reason: REVIEW_LINK_NOT_A_URL };
  return { kind: 'set', url: t };
}

export interface SavePart {
  /** What the owner calls this half, as it reads in a sentence: "your business details". */
  label: string;
  outcome: 'written' | 'unchanged' | 'refused';
  /** Why it was refused, in words. Ignored unless `outcome === 'refused'`. */
  reason?: string | null;
}

/**
 * ONE sentence for a Save that wrote to several tables with no transaction across them.
 *
 * 🔴 PER TABLE, NEVER ONE VERDICT FOR SEVERAL WRITES (the 2026-09-10 profile-save defect: the identity
 *    write succeeded, the pricing write was refused, and one message described the whole Save by its
 *    failing half). And the rule in the other direction, which the two-table version broke: 🔴 AN
 *    UNCHANGED PART IS NEVER CALLED SAVED. The previous branch told an owner *"The tax rate was
 *    saved"* when the tax rate had not been written at all, because nothing had changed — a surface
 *    asserting what it did not get from the operation (R-110).
 *
 * A message beginning `Error` renders red; any refusal produces one, including a partial Save — part
 * of it DID land and cannot be rolled back, and green would read as "all of it".
 */
export function saveReport(parts: readonly SavePart[]): string {
  const refused = parts.filter(p => p.outcome === 'refused');
  if (refused.length === 0) return 'Saved';
  const why = refused
    .map(p => `${p.label} — ${String(p.reason ?? '').trim().replace(/[.\s]+$/, '') || 'no reason was given'}`)
    .join('; ');
  const written = parts.filter(p => p.outcome === 'written');
  if (written.length === 0) return `Error: nothing was saved. Not saved: ${why}.`;
  return `Error: only part of this was saved. Saved: ${written.map(p => p.label).join(', ')}. Not saved: ${why}.`;
}
