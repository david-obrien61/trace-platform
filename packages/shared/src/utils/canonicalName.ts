// canonicalName — ONE canonical token-set key for resolving a scanned identifier
// (QR product-slug / typed code / name) to a catalog row by NAME, across growers
// whose identifier formats never agree.
//
// PURPOSE:      A scanned QR slug ("vitex-shoal-creek") and the catalog row that
//               holds the same plant ("Shoal Creek Vitex") share NO characters except
//               the WORDS of the name — different word order, different punctuation,
//               different separators. This produces the canonical key both sides
//               reduce to: a normalized SET of name tokens. {vitex,shoal,creek} ==
//               {shoal,creek,vitex}. Order-insensitive, punctuation-insensitive.
//               Designed as the ONE key voice/typed/QR all resolve through (grower-
//               resolve design, docs/decisions/2026-06-26-grower-resolve-design.md §4).
//               This is the EQUALITY base; guarded subset/superset + stemming are a
//               deferred fast-follow (recon §5 L5/L6).
// DEPENDENCIES: none.
// OUTPUTS:      nameTokenSet → a Set of normalized tokens; canonicalNameKey → the
//               stable sorted-string form (for indexing/logging); tokenSetsEqual →
//               order-insensitive set equality.

// Botanical connector words that carry no identity (recon §4 step 4). 'x' (hybrid
// marker) is a 1-char token and is dropped by the length filter below.
const BOTANICAL_CONNECTORS = new Set(['var', 'ssp', 'subsp', 'cv']);

/**
 * Normalize a raw identifier (slug or name) to a SET of identity tokens.
 *   1. lowercase
 *   2. &/&amp; → space (and drop the stray 'amp' entity leak that slugs carry)
 *   3. any non-alphanumeric → token boundary (handles ®™℠, quotes, hyphens, parens)
 *   4. drop 1-char tokens and botanical connectors (var/ssp/subsp/cv)
 *   5. result = a Set (deduped)
 * Stemming (plural/possessive) is intentionally NOT applied here — that is the
 * deferred L6 fuzzy layer, kept out of the equality key to hold ~0 false-merges.
 */
export function nameTokenSet(raw: string | null | undefined): Set<string> {
  if (raw == null) return new Set();
  const cleaned = String(raw)
    .toLowerCase()
    .replace(/&amp;|&/g, ' ')        // entity + ampersand → space
    .replace(/[^a-z0-9]+/g, ' ');    // every non-alphanumeric → boundary
  const tokens = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .filter(t => t !== 'amp')              // slug entity-leak artifact
    .filter(t => t.length > 1)             // drop 1-char tokens (incl. hybrid 'x')
    .filter(t => !BOTANICAL_CONNECTORS.has(t));
  return new Set(tokens);
}

/** Stable string form of the canonical key — sorted tokens joined by a space.
 *  Useful as an index key or in a log line; two inputs with the same key are
 *  token-set-equal by construction. */
export function canonicalNameKey(raw: string | null | undefined): string {
  return [...nameTokenSet(raw)].sort().join(' ');
}

/** Order-insensitive set equality. */
export function tokenSetsEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const t of a) if (!b.has(t)) return false;
  return true;
}
