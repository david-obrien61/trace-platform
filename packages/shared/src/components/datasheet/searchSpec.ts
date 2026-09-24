// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      ONE declaration of what a grid's search searches — used to build the haystack
//               AND to write the placeholder AND to say which columns must be fetched. Three
//               facts that must agree, derived from one list instead of typed three times.
// DEPENDENCIES: none — pure. No React, no database.
// OUTPUTS:      SearchField · searchHaystack() · searchPlaceholderFor() · searchedColumns() ·
//               SPELLING_FOLD · foldForSearch() · matchesSearch() · matchesHaystack().
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 THE DEFECT THIS EXISTS TO MAKE IMPOSSIBLE, MEASURED ON LAUREN'S SCREEN
// ═════════════════════════════════════════════════════════════════════════════
// `/inventory` said **"Search name, SKU, size, location…"** and searched `r.sku` — while the SKU
// column RENDERED `itemIdentifier(r)`, which is `sku ?? qb_item_name`. Live on LAWNS,
// 2026-09-22: **`sku` is null on 1,078 of 1,079 rows and 632 carry the code in `qb_item_name`.**
// So the grid displayed `CSCM3UP`, David typed `CSCM3UP`, and the search looked at a null column
// and returned nothing. **The screen showed a value its own search could not see.**
//
// Note what was NOT wrong, because it is what makes this class hard to spot: the field was
// FETCHED (`sku` is in the select), the search function was correct, and the placeholder was
// true when it was written. The DISPLAY moved to a computed value (ledger #357, `a041e305`,
// 2026-09-20) and the search stayed on the raw column. Nothing failed; it just stopped matching.
//
// So a field here declares THREE things together:
//   · `label`   — what the placeholder calls it, so the promise is generated, never typed
//   · `get`     — the value actually searched, which may be COMPUTED exactly as the cell renders it
//   · `columns` — the database columns `get` depends on, so a check can prove they are fetched
//
// ⚠️ `columns` IS NOT DECORATION AND IT IS NOT DERIVABLE. A computed getter can read two columns
// (`sku` and `qb_item_name`) and a check has no way to know that from the function body. It is
// declared, and `verify:search-fields` fails the build when a declared column is missing from the
// screen's select — which is the other half of this defect's family (a searched field that was
// never fetched matches nothing, just as silently).
// ─────────────────────────────────────────────────────────────────────────────

export interface SearchField<T> {
  /** What the placeholder calls this — "name", "SKU or code", "size". */
  label: string;
  /** The database columns `get` reads. Declared, because a computed getter hides them. */
  columns: readonly string[];
  /** The value searched for one row — computed the same way the cell renders it. */
  get: (row: T) => unknown;
}

/**
 * The string `DataSheet` runs `.includes()` against for one row.
 *
 * 🔴 A9 — ABSENT IS NOT EMPTY. A null, undefined, blank or non-string value contributes NOTHING.
 * It must never contribute the literal `"undefined"` or `"null"`: a search for "null" would then
 * match every row that is MISSING a value, which renders an absence as a fact.
 */
export function searchHaystack<T>(fields: readonly SearchField<T>[], row: T): string {
  const parts: string[] = [];
  for (const f of fields) {
    const v = f.get(row);
    if (typeof v === 'string' && v.trim() !== '') parts.push(v);
    else if (typeof v === 'number' && Number.isFinite(v)) parts.push(String(v));
  }
  return parts.join(' ');
}

/** Every column the search depends on, de-duplicated — what the screen's select MUST contain. */
export function searchedColumns<T>(fields: readonly SearchField<T>[]): string[] {
  return [...new Set(fields.flatMap(f => f.columns))].sort();
}

/**
 * The placeholder, GENERATED from the labels.
 *
 * 🔴 IT NAMES EVERY FIELD OR SAYS HOW MANY IT DID NOT NAME. A placeholder is a claim about what
 * typing here will match (§6 r18), and "name, SKU, size, location…" was read — correctly — as
 * "these four and probably more of the same". A trailing ellipsis that hides four more fields is
 * a sometimes-true claim; a count is a true one. Over `maxChars` it becomes
 * "Search name, SKU or code, size + 4 more", which is short AND honest.
 */
export function searchPlaceholderFor<T>(fields: readonly SearchField<T>[], maxChars = 52): string {
  const labels = fields.map(f => f.label);
  const full = `Search ${labels.join(', ')}`;
  if (full.length <= maxChars || labels.length <= 1) return full;
  // Keep naming fields while they fit, then say plainly how many are left.
  for (let keep = labels.length - 1; keep >= 1; keep--) {
    const text = `Search ${labels.slice(0, keep).join(', ')} + ${labels.length - keep} more`;
    if (text.length <= maxChars) return text;
  }
  return `Search ${labels.length} fields`;
}

// ═════════════════════════════════════════════════════════════════════════════
// 🔴 THE MATCHER — ONE RULE, EVERY SURFACE (ledger #388, David's ruling 2026-09-23)
// ═════════════════════════════════════════════════════════════════════════════
// David: *"inventory already has the filter type function, why not reuse that like we should."*
// **A second copy IS the defect**: checkout's `searchStockLines` read `sku`, populated on **1 of
// 632** live LAWNS rows, while the code lives in `qb_item_name` on **632 of 632** — #384's fix
// never reaching that surface. Two searches means two behaviours from one promise.
//
// 🔴 THE EXTRACTION TAKES THE BETTER OF EACH, BECAUSE NEITHER SIDE WAS STRICTLY BETTER — and this
// is the finding that stopped it being a copy-paste. The ROSTER had the declared fields, the
// derived placeholder and the computed getters; its matcher was a plain
// `haystack.toLowerCase().includes(q)`. CHECKOUT had a WEAKER field set and a STRONGER matcher —
// **token-subset**, so "shoal creek" matches "Shoal Creek Vitex" and so does "creek shoal".
// Adopting the roster's matcher wholesale would have made the roster's fields available at
// checkout while silently REMOVING multi-word matching. Both are kept here.
//
// THREE RULES, TRIED IN ORDER, ANY ONE HITS:
//   1. SUBSTRING on the folded haystack — "CLCC4" finds "CLCC45", which is how a person types a code
//   2. TOKEN SUBSET — every token of the term appears in the row's tokens, order-insensitive
//   3. …both over FOLDED text, so "Center" finds "Centre"

/**
 * The SEARCH-ONLY spelling fold.
 *
 * 🔴 IT IS NOT `canonicalNameKey`, AND IT MUST NEVER BECOME PART OF IT. `canonicalNameKey` is the
 * D-45/D-46 **scan-resolution equality key** — it decides which catalogue row a scanned QR
 * resolves to. Its own header says stemming is *"intentionally NOT applied here … to hold ~0
 * false-merges."* Folding spellings into that key would change resolution on a money path.
 * MEASURED 2026-09-23: `canonicalNameKey('Cherry Laurel Centre Court')` = `centre cherry court
 * laurel` and `…('… Center Court')` = `center cherry court laurel` — **not equal, and they stay
 * not equal.** This fold lives here, is applied at QUERY AND INDEX time for SEARCH ONLY, and
 * nothing on the resolution path imports it.
 *
 * WHY A DECLARED TABLE RATHER THAN AN ALGORITHM: a stemmer or an edit-distance would also fold
 * things nobody asked it to. LAWNS's catalogue says "Cherry Laurel **Centre** Court" and Lauren
 * types "Center" — a real, named, two-word problem (David: *"She will not adapt and should not
 * have to."*). A short list is auditable; a distance threshold is a promise nobody can check.
 */
export const SPELLING_FOLD: ReadonlyArray<readonly [string, string]> = [
  ['centre', 'center'],
  ['colour', 'color'],
  ['grey',   'gray'],
  ['mould',  'mold'],
  ['theatre', 'theater'],
  ['fibre',  'fiber'],
];

/** Lowercase, fold the declared spellings, and collapse whitespace. Applied to BOTH sides. */
export function foldForSearch(raw: string | null | undefined): string {
  let t = (raw ?? '').toLowerCase();
  for (const [from, to] of SPELLING_FOLD) {
    // Whole-word only. Substring folding would rewrite the inside of unrelated words.
    t = t.replace(new RegExp(`\\b${from}\\b`, 'g'), to);
  }
  return t.replace(/\s+/g, ' ').trim();
}

/** The term's identity tokens — the same shape `nameTokenSet` produces, over folded text.
 *  ⚠️ Deliberately NOT importing `nameTokenSet`: that function is on the resolution path and
 *  drops botanical connectors and 1-char tokens for reasons that belong to EQUALITY, not to
 *  search. A single typed character must still filter. */
function searchTokens(text: string): string[] {
  return foldForSearch(text).split(/[^a-z0-9]+/).filter(Boolean);
}

/**
 * Does this row match the term? ONE rule, used by every surface that searches rows.
 *
 * An empty term matches everything — the caller decides whether to show all rows or none, and
 * "no filter" is not the same question as "no matches".
 */
export function matchesSearch<T>(fields: readonly SearchField<T>[], row: T, term: string): boolean {
  return matchesHaystack(searchHaystack(fields, row), term);
}

/**
 * The same rule over a haystack a caller has already built.
 *
 * 🔴 IT EXISTS SO `DataSheet` CAN USE THE ONE MATCHER WITHOUT EVERY CONSUMER CHANGING. `DataSheet`
 * takes a `searchText: (r) => string` prop rather than the field list, so it holds the haystack and
 * not the fields. Routing it through here means **every grid in the platform gains the spelling
 * fold and token-subset matching at once** — and there is still exactly ONE implementation of the
 * rule, which is the whole point of the ruling.
 */
export function matchesHaystack(haystackRaw: string, term: string): boolean {
  const t = foldForSearch(term);
  if (t === '') return true;
  const hay = foldForSearch(haystackRaw);
  if (hay.includes(t)) return true;                    // 1. substring — how a code is typed
  const termTokens = searchTokens(term);
  if (termTokens.length === 0) return false;
  const hayTokens = new Set(searchTokens(haystackRaw));
  return termTokens.every(tok => hayTokens.has(tok));  // 2. token subset — multi-word, any order
}
