// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: the ONE place the catalogue's display identifier is decided — `sku ?? qb_item_name`,
//   computed on read and never stored merged (David, 2026-09-20, ledger #357). QuickBooks holds
//   a SKU on 1 of LAWNS's 1,157 items; the code the owner actually types is Intuit's `Name`
//   (`DLO30`), and where both exist they DIFFER (item 1048: `CBBM1Y` vs `BBM1Y`). Storing the
//   fallback would change a row's identifier the day a SKU is typed in QuickBooks, so both
//   values are kept raw and the choice is made here, once.
// DEPENDENCIES: none. Pure: no db, no network, no env, no clock, no DOM.
// OUTPUTS: itemIdentifier · itemIdentifierSource · ItemIdentity.
// ─────────────────────────────────────────────────────────────────────────────

/** The two raw columns, exactly as `business_inventory` holds them. Both are OPTIONAL as well as
 *  nullable: a caller's row type may not select `qb_item_name` at all, and a helper that forces
 *  every caller to cast is a helper people work around. */
export interface ItemIdentity {
  sku?: string | null;
  qb_item_name?: string | null;
}

const clean = (v: string | null | undefined): string | null => {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
};

/**
 * What to SHOW as the row's identifier: the SKU when QuickBooks holds one, otherwise the
 * QuickBooks item code. `null` when the row has neither — an honest absence, never `''` or a
 * guessed value (D-9 / A9: absent is not empty).
 */
export function itemIdentifier(row: ItemIdentity | null | undefined): string | null {
  if (!row) return null;
  return clean(row.sku) ?? clean(row.qb_item_name);
}

/**
 * WHERE that identifier came from, so a surface can say so rather than implying every value is
 * a SKU. A QuickBooks item code shown under a header reading "SKU" is a small lie, and this is
 * what lets a caller avoid telling it.
 */
export function itemIdentifierSource(row: ItemIdentity | null | undefined): 'sku' | 'quickbooks-name' | null {
  if (!row) return null;
  if (clean(row.sku) !== null) return 'sku';
  if (clean(row.qb_item_name) !== null) return 'quickbooks-name';
  return null;
}
