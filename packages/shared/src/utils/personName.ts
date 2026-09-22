/**
 * ── personName — canonical token-set key for a PERSON / party name · 2026-07-16 ──
 *
 * PURPOSE      Decide whether two party names denote the SAME party, for identity
 *              resolution against an external system (D-47 — the QBO customer match).
 *              "TERRENCE OBRIEN" and "Terrence O'Brien" are ONE person; "TERRENCE
 *              OBRIEN" and "Andrew O'Brien" are TWO.
 * DEPENDENCIES ./canonicalName (tokenSetsEqual — the ONE token-set equality engine).
 * OUTPUTS      personNameTokenSet → Set of identity tokens.
 *              personNamesMatch  → order-insensitive, punctuation-insensitive equality.
 *                                  AN EMPTY NAME NEVER MATCHES ANYTHING (see below).
 *
 * WHY THIS IS NOT `nameTokenSet` — a REASONED divergence, not a silent fork (STD-011, §6 r10):
 *   `canonicalName.nameTokenSet` is the PLANT-catalog key (#61 L4). It treats EVERY
 *   non-alphanumeric as a token BOUNDARY and drops 1-char tokens (to kill the botanical
 *   hybrid marker 'x'). That is correct for plants and WRONG for surnames — verified
 *   empirically 2026-07-16:
 *       nameTokenSet("O'Brien") → {brien}    ("o" split off by the apostrophe, then
 *                                             dropped by the 1-char filter)
 *       nameTokenSet("OBrien")  → {obrien}
 *     ⇒ "TERRENCE OBRIEN" vs "Terrence O'Brien"  =  NO MATCH.
 *   A person-name key must ELIDE the intra-word apostrophe (O'Brien → obrien) rather than
 *   split on it. "Is this the same PERSON?" and "is this the same PLANT?" are two different
 *   facts with two different normalization rules, so this is its own function — but it
 *   REUSES the one equality engine (`tokenSetsEqual`) instead of re-implementing it, and the
 *   botanical connectors (var/ssp/subsp/cv) are deliberately NOT applied to people.
 *   (The same apostrophe blind spot is a LATENT bug in the plant resolver — a QR slug
 *   "baileys-red-twig-dogwood" will not match a catalog "Bailey's Red Twig Dogwood".
 *   FLAGGED for David, NOT fixed here: that path is D-45/D-46 owner-proven territory and
 *   changing its key is a separate, provable build.)
 *
 * WHY EMPTY NEVER MATCHES (the identity-safety edge):
 *   Two blank names both reduce to the empty set, and set-equality would call that a MATCH —
 *   which would LINK a nameless TRACE customer onto a nameless QBO record on zero evidence.
 *   D-9 applied to identity: absence of a name is not agreement between names.
 */

import { tokenSetsEqual } from './canonicalName';
import { foldAccents } from './alphaIndex';

/**
 * Normalize a party name to a SET of identity tokens.
 *   1. lowercase
 *   2. ELIDE intra-word apostrophes (' ’ ` ´) — O'Brien → obrien, Dave's → daves
 *   3. every other non-alphanumeric → token boundary
 *   4. drop 1-char tokens — so a middle initial is not identity ("John A. Smith" == "John Smith")
 *   5. result = a Set (deduped, order-insensitive)
 */
export function personNameTokenSet(raw: string | null | undefined): Set<string> {
  if (raw == null) return new Set();
  const cleaned = String(raw)
    .toLowerCase()
    .replace(/&amp;|&/g, ' ')        // entity + ampersand → space
    .replace(/['’`´]/g, '') // ELIDE apostrophes (the person-name rule)
    .replace(/[^a-z0-9]+/g, ' ');    // every other non-alphanumeric → boundary
  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter(t => t !== 'amp')
    .filter(t => t.length > 1);      // middle initials are not identity
  return new Set(tokens);
}

/**
 * Do these two party names denote the same party?
 * Order-insensitive by construction, so QBO's "Smith, John" convention matches TRACE's
 * "John Smith". An EMPTY set on EITHER side is never a match (absence ≠ agreement).
 */
export function personNamesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const sa = personNameTokenSet(a);
  const sb = personNameTokenSet(b);
  if (sa.size === 0 || sb.size === 0) return false; // absence is not agreement (D-9)
  return tokenSetsEqual(sa, sb);
}

// ══════════════════════════════════════════════════════════════════════════════════════════
// DISPLAY — assembling a person's name from its parts, for a SCREEN rather than for matching
// ══════════════════════════════════════════════════════════════════════════════════════════

/**
 * Assemble a person's display name from its parts, dropping the parts that are absent.
 *
 * 🔴 WHY THIS EXISTS: `${first_name} ${last_name}` renders the four characters **"null"** when
 * `last_name` is NULL — JavaScript stringifies null inside a template literal, and NULL is now
 * the TRUE value for a mononym person (`20260907_customers_last_name_nullable`, David's ruling:
 * a company has no family name, and neither does Tina). Measured on the 2026-09-07 import: **39
 * people with one name** rendered as `Terry null`, `Raj null`, `Sample Customer null`. The
 * importer never wrote the string — every one of those was assembled at render time, which is
 * why it survives every undo and returns on every import.
 *
 * ⚠️ JSX `{a} {b}` does NOT have this bug — React renders null as nothing — but it leaves a
 * trailing space and it is a SECOND way of doing one thing. One helper, every call site, so
 * the next person-name render cannot reintroduce it (§6 r8).
 *
 * Returns '' when nothing is known, so a caller can choose its own fallback rather than being
 * handed a fabricated one (D-9: absent is not empty).
 */
export function formatPersonName(
  first: string | null | undefined,
  last: string | null | undefined,
): string {
  return [first, last]
    .map(p => (typeof p === 'string' ? p.trim() : ''))
    .filter(Boolean)
    .join(' ');
}

/**
 * The display name for a customer-shaped record — an ORGANIZATION renders its organization name,
 * a PERSON renders its assembled parts. The one place the person/organization split is decided
 * for display, so a roster, an order screen and a delivery list cannot disagree about what a
 * customer is called.
 *
 * `fallback` is what shows when NOTHING is known. It is a required argument on purpose: an
 * unnamed record is a real state and each surface should say so in its own words ('—', 'Customer',
 * 'Unknown customer') rather than silently inheriting one.
 */
export function customerDisplayName(
  c: {
    customer_type?: string | null;
    organization_name?: string | null;
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null | undefined,
  fallback: string,
): string {
  if (!c) return fallback;
  if (c.customer_type === 'organization') {
    const org = c.organization_name?.trim() || c.display_name?.trim();
    if (org) return org;
  }
  return formatPersonName(c.first_name, c.last_name)
    || c.display_name?.trim()
    || c.organization_name?.trim()
    || fallback;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════
// FILING — WHERE A ROSTER FILES A RECORD, AND WHY THE EYE CAN SEE IT (David's ruling 2026-09-22)
// ═══════════════════════════════════════════════════════════════════════════════════════════
// This is the CONTACTS-APP STANDARD, and it is David's domain call. An earlier pass filed people
// under their FIRST name, on the argument that a list should read the way it is written; he
// reversed it, and the reversal carries the part that makes it work: **the filing token is shown
// in bold**, so a reader who finds "Jim & Virginia Patskowski" under P can see why in the row
// itself. Sorting by a word nobody can see is what makes a list feel broken — showing the word is
// the answer, not abandoning the surname.
//
// THE FOUR RULES, in order:
//   1. A LAST NAME WINS WHEREVER IT IS PRESENT — whatever `customer_type` says. LAWNS's imported
//      rows are not reliably typed (measured 2026-09-22: "Aaron Hunt" is stored as an
//      ORGANIZATION), so trusting the type column here would file real people under their first
//      name at random. A surname present in the record is better evidence than the label on it.
//   2. NO SURNAME → the record files under its own name, with a LEADING ARTICLE IGNORED, so
//      "The Oaks" sits under O with "The" still shown but not counted.
//   3. A ONE-NAME PERSON files under that name — 39 of LAWNS's people carry a first name only.
//   4. Anything that does not fold to A–Z files under '#' (see alphaIndex).
// ═══════════════════════════════════════════════════════════════════════════════════════════

interface FilingParty {
  customer_type?: string | null;
  organization_name?: string | null;
  display_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
}

const LEADING_ARTICLE = /^(the|a|an)\s+/i;

/**
 * 🔴 THE BUSINESS MARKERS — AND THE MEASUREMENT THAT MAKES THEM NECESSARY, NOT A GUESS.
 *
 * `customer_type` CANNOT BE TRUSTED HERE AND THE NUMBERS ARE BRUTAL. Measured live on LAWNS,
 * 2026-09-22: **522 rows are typed `organization` and only 56 of them carry any business marker
 * at all.** A random twenty reads *Tony Matson · John Kraft · Laura McFadden · Barb & Mark
 * Gleinser · Dustin Miller* — people, every one, typed as companies by the QuickBooks import,
 * and **not one of them has a `last_name`**. David's own worked example is one of these rows:
 * "Jim & Virginia Patskowski" is stored as an ORGANIZATION with first_name and last_name both
 * NULL, and it still has to file under P.
 *
 * So a record with no structured surname cannot be filed by its type column, and it cannot be
 * filed under its first word either. It is filed under its LAST WORD — the contacts-app import
 * rule — unless it looks like a business, and this list is what "looks like a business" means.
 *
 * ⚠️ IT IS A HEURISTIC AND IT IS SAID OUT LOUD RATHER THAN BURIED. It will be wrong for a
 * business whose name carries no marker ("Stonehenge") — that row files under its last word.
 * THE REAL FIX IS THE RECORD, NOT THE SORT: give the person a first and last name in the customer
 * editor and rule 1 takes over, exactly and permanently. The heuristic only ever governs rows
 * nobody has typed properly yet.
 */
export const BUSINESS_NAME_MARKERS: readonly string[] = [
  'inc', 'llc', 'ltd', 'co.', 'company', 'corp', 'service', 'services', 'landscap', 'nurser',
  'lawn', 'tree', 'garden', 'design', 'construct', 'builder', 'homes', 'properties', 'group',
  'farm', 'farms', 'ranch', 'supply', 'management', 'maintenance', 'irrigation', 'outdoor',
  'scapes', 'greenhouse', 'sod', 'turf', 'contractor', 'contractors', 'enterprise', 'enterprises',
  'associates', 'partners', 'realty', 'church', 'school', 'city of', 'hoa', 'association',
];

function looksLikeABusiness(name: string): boolean {
  const n = name.toLowerCase();
  return BUSINESS_NAME_MARKERS.some(m => n.includes(m));
}

/** "The Oaks" → "Oaks". Applied ONLY where a record is filed under its own name — a surname is
 *  never an article, so stripping one there could only corrupt a real name. Falls back to the
 *  original when stripping would leave nothing, so "The" alone still files under T. */
function withoutLeadingArticle(s: string): string {
  return s.replace(LEADING_ARTICLE, '').trim() || s.trim();
}

/** The name a record is known by, before any filing decision — the same string the roster shows. */
function ownName(c: FilingParty): string {
  return (c.customer_type === 'organization'
    ? (c.organization_name?.trim() || c.display_name?.trim() || c.first_name?.trim() || '')
    : (c.first_name?.trim() || c.display_name?.trim() || c.organization_name?.trim() || ''));
}

/**
 * The token this record FILES under. Five rules, in order — the first that answers wins:
 *
 *   1. `last_name` is present → THE SURNAME, whatever `customer_type` claims. 1,444 of LAWNS's
 *      2,005 rows answer here, and this is the only rule that is evidence rather than inference.
 *   2. The name starts with an article → the rest of it. "The Tree Place" files under T (Tree).
 *   3. The name looks like a business → THE WHOLE NAME. "A.J. Landscaping" under A, "City of
 *      Lakeway" under C.
 *   4. Otherwise it is a person recorded as one string → ITS LAST WORD. "Jim & Virginia
 *      Patskowski" under P, "Barb & Mark Gleinser" under G. ~466 LAWNS rows land here.
 *   5. Nothing known → '' , which `alphaKeyFor` files under '#'.
 */
export function customerFilingName(c: FilingParty | null | undefined): string {
  if (!c) return '';
  const last = c.last_name?.trim();
  if (last) return last;                                    // 1
  const own = ownName(c);
  if (!own) return '';                                      // 5
  if (LEADING_ARTICLE.test(own)) return withoutLeadingArticle(own);   // 2
  if (looksLikeABusiness(own)) return own;                  // 3
  const words = own.split(/\s+/).filter(Boolean);           // 4
  return words.length > 1 ? words[words.length - 1] : own;
}

/**
 * The displayed name split so a surface can BOLD the filing token: `before` + `filing` + `after`.
 *
 * 🔴 THE BOLD IS NOT DECORATION — IT IS WHAT MAKES A SURNAME SORT LEGIBLE. Without it the roster
 * orders itself by a word the reader has to infer, which is the complaint that started this work.
 * With it, "Jim & Virginia **Patskowski**" filed under P explains itself at a glance.
 *
 * When the filing token cannot be found inside the displayed name — an organization whose
 * `organization_name` differs from what the row displays, say — NOTHING is bolded rather than
 * something arbitrary: a bold run on the wrong word is worse than none, because it asserts a
 * reason that is not the real one.
 */
export function customerFilingParts(
  c: FilingParty | null | undefined,
  fallback: string,
): { before: string; filing: string; after: string } {
  const shown = customerDisplayName(c, fallback);
  const filing = customerFilingName(c);
  if (!filing) return { before: shown, filing: '', after: '' };
  const i = shown.lastIndexOf(filing);
  if (i < 0) return { before: shown, filing: '', after: '' };
  return { before: shown.slice(0, i), filing, after: shown.slice(i + filing.length) };
}

/**
 * The sort key that puts a roster in filing order: the filing token first, then the whole
 * displayed name to break ties.
 *
 * ⚠️ THE TIEBREAK IS LOAD-BEARING, NOT TIDINESS. LAWNS has many rows sharing a surname; with only
 * one term their order is whatever the sort happened to do, and a list that reorders itself
 * between renders for no visible reason is the #377 symptom in a milder form. The separator is
 * the NUL character because it sorts below every printable one, so a short surname can never sort
 * into the middle of a longer one ("Ray" stays clear of "Rayburn").
 */
export function customerFilingSortKey(c: FilingParty | null | undefined, fallback = ''): string {
  // 🔴 FOLDED WITH THE SAME FUNCTION THE BUCKET USES, AND THIS IS A FIX FOR A MEASURED DEFECT.
  // The grid compares sort values with `<` / `>` — plain code-unit order — where every accented
  // character sorts ABOVE 'z' (`'ñunez' < 'zz'` is FALSE, measured). An unfolded key therefore
  // put "Ñuñez" after every Z name while its bucket said N, and the grid, which derives headings
  // from the order actually on screen, would have rendered a SECOND "N" heading at the bottom.
  return foldAccents(`${customerFilingName(c)}\u0000${customerDisplayName(c, fallback)}`).toLowerCase();
}
