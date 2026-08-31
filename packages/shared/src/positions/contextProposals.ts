// ============================================================
// contextProposals — WHAT WE THINK THE BUSINESS IS, OFFERED AND NEVER ASSUMED
//
// PURPOSE:      "About the business" should not be a blank page either. A proposal fills the
//               three context fields with something the owner CORRECTS, which is a far easier act
//               than composing three sentences from nothing.
// DEPENDENCIES: none. Pure data + one host resolver, so the picker imports it without a cycle.
// OUTPUTS:      `proposedContextFor(website)` → `ProposedContext | null`.
//
// ── 🔴 EVERY PROPOSED FIELD IS PROPOSED UNTIL CONFIRMED, AND THE MECHANISM IS THE DATABASE ──
// A fact we found is not a fact they have agreed to, and the difference has to be VISIBLE. The
// cheapest way to make it visible is also the strongest: **a proposal is never written anywhere.**
// It is offered beside the empty field with its source named; "Use this" fills the box; the owner
// still has to read it and press Save. Two deliberate acts, and until the second one happens
// `business_context` holds NOTHING — so there is no stored value that could be mistaken for the
// owner's own words, and no `*_is_proposed` column to keep in step with reality.
// ⚠️ That is deliberately NOT a schema change. A `proposed` flag on the row would be a second
// truth about the same value (R-27), and the first time a save missed it the page would present
// our guess as their sentence.
//
// ── 🔴 NEVER FEED THE PAGE TO A GENERATOR ──────────────────────────────────────────────────
// Real operating facts sit beside marketing prose on any small-business site — lawnstrees.com
// carries "When Quality Counts, You Can Count On Us!" in its own schema.org description and
// "Rooted in Austin, Growing With You" in its copy — and prose in means prose out on a document
// someone hands to a new employee. So this file holds STRUCTURED FIELDS an owner corrects, never
// a page, never a paste, and no model is called to produce one.
//
// ── ⚠️ THIS IS A HARDCODED TENANT LITERAL AND IT IS REGISTERED AS ONE (§6 r12) ─────────────
// The LAWNS entry below is one tenant's facts in platform code. It is logged in
// `docs/decisions/HARDCODED-REGISTER.md` against the positions capability, and the exit is named
// there and here: **`runIdentity` (discovery/engine.ts) ALREADY EXTRACTS EXACTLY THESE FIELDS
// from a live site** — businessName, location, yearsInBusiness, servicesFound, tone — and is
// already wired at `api/discovery/ingest.ts:176`. What is missing is not an AI route; it is the
// mapping from a `BusinessIdentity` to these three sentences, plus persisting it. When that
// lands, this constant is DELETED rather than extended. It is keyed on the site it was read from
// so the two paths produce the same shape and the swap is a substitution, not a rewrite.
// ============================================================

/** One proposed value and where it came from. The source is shown beside the value, always. */
export interface ProposedField {
  readonly value: string;
  /** Owner-facing provenance. Says what was read, never how. Never a URL alone. */
  readonly source: string;
}

export interface ProposedContext {
  /** The site these were read from, shown once above the three fields. */
  readonly sourceLabel: string;
  readonly whatWeDo:   ProposedField | null;
  readonly whoWeServe: ProposedField | null;
  readonly knownFor:   ProposedField | null;
}

const SITE = 'your own website';

/**
 * Keyed by BARE HOST, because that is the identifier the business itself supplies
 * (`businesses.website`) and the one the crawl will key on when it replaces this. Keying on
 * `business_id` would be a tenant uuid in shared code with no path to generalise.
 */
const PROPOSALS: Record<string, ProposedContext> = {
  // ── LAWNS Tree Farm, LLC — read from lawnstrees.com, not crawled. ──
  // ⚠️ THE FOUNDING YEAR IS CONTESTED BY THE SITE ITSELF and is left in DELIBERATELY, because a
  // contested fact is exactly what a PROPOSAL is for. Their About copy says 1985; their
  // schema.org Organization block says `"foundingDate":"1984-01-01"` (measured in the captured
  // page at `discovery/__fixtures__/lawns-vitex-real.html:46`). One edit by Lauren settles it —
  // which is the mechanism working, not a defect in it. Do NOT "fix" this by picking one.
  // ⚠️ "more than forty VARIETIES OF TREE" — the noun is load-bearing and was made explicit after
  // #240's placeholder ("forty ACRES in Leander", a number nothing measured supports) was read as
  // real data on screen. Two different forties next to each other in one card is how that happens.
  'lawnstrees.com': {
    sourceLabel: 'lawnstrees.com',
    whatWeDo: {
      value: 'has grown trees in Leander since 1985 — we start them from acorns, seeds or seedlings, and grow more than forty varieties of tree on site',
      source: `${SITE} — About`,
    },
    whoWeServe: {
      value: 'nurseries, re-wholesalers and landscapers, and now homeowners direct — around Leander, Cedar Park, Austin, Round Rock, Liberty Hill, Georgetown, Hutto, Pflugerville, Lago Vista, Jonestown and Lakeway',
      source: `${SITE} — who we sell to, and the service area`,
    },
    knownFor: {
      value: 'contract-growing large numbers of a specific plant for landscape projects around Austin',
      source: `${SITE} — contract growing`,
    },
  },
};

/**
 * `https://www.LawnsTrees.com/about/` → `lawnstrees.com`. Returns null for anything that is not a
 * host we can read, rather than guessing — a wrong match here would propose one business's facts
 * on another business's page, which is the only genuinely dangerous failure this file has.
 */
export function hostOf(website: string | null | undefined): string | null {
  const raw = (website ?? '').trim();
  if (!raw) return null;
  const host = raw
    .replace(/^[a-z]+:\/\//i, '')
    .split('/')[0]
    .split('?')[0]
    .split('@').pop() ?? '';
  const bare = host.toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '');
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(bare) ? bare : null;
}

/**
 * The proposal for this business's website, or null.
 *
 * 🔴 NULL IS THE COMMON CASE AND IT IS THE CORRECT ONE. A business we have read nothing about
 * gets three empty boxes and no card — never an invented sentence, and never another tenant's.
 */
export function proposedContextFor(website: string | null | undefined): ProposedContext | null {
  const host = hostOf(website);
  return host ? (PROPOSALS[host] ?? null) : null;
}
