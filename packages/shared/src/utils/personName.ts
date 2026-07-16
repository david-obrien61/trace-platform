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
