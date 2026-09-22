// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      ONE declaration of what a grid's search searches — used to build the haystack
//               AND to write the placeholder AND to say which columns must be fetched. Three
//               facts that must agree, derived from one list instead of typed three times.
// DEPENDENCIES: none — pure. No React, no database.
// OUTPUTS:      SearchField · searchHaystack() · searchPlaceholderFor() · searchedColumns().
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
