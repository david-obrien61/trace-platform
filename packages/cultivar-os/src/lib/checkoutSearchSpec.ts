// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      What CHECKOUT's item entry searches, and what each row says about itself
//               once found. Declared here so a test can reach it (tech-debt #134) and so the
//               placeholder is GENERATED from the labels (R-170), never typed beside them.
//
// 🔴 IT DECLARES FIELDS; IT DOES NOT IMPLEMENT A SEARCH. David's ruling, 2026-09-23:
//               *"inventory already has the filter type function, why not reuse that like we
//               should."* The matching rule lives in `@trace/shared/components/datasheet/searchSpec`
//               and is the SAME one `/inventory` uses. A second implementation is the defect:
//               checkout's old `searchStockLines` read `sku`, **populated on 1 of 632 live LAWNS
//               rows**, while the code lives in `qb_item_name` on **632 of 632** — #384's fix
//               never reaching this surface.
//
// 🔴 A SUBSET OF THE ROSTER'S FIELDS, AND THE OMISSIONS ARE THE DECISION. The roster searches
//               seven fields including `location`, `variant_group`, `serial_number` and `notes`.
//               At a counter those produce surprising hits: typing a plant name matches a row
//               because that word appears in somebody's note. Checkout searches the three a
//               person at a till actually means — **name, SKU or code, size** (David's ruling).
//
// DEPENDENCIES: shared searchSpec (pure) · itemIdentifier (the SAME function the SKU cell renders).
// OUTPUTS:      CHECKOUT_ITEM_SEARCH · CHECKOUT_SEARCH_PLACEHOLDER · CheckoutSearchRow.
// ─────────────────────────────────────────────────────────────────────────────
import { itemIdentifier } from '@trace/shared/quickbooks/itemIdentifier';
import { searchPlaceholderFor, type SearchField } from '@trace/shared/components/datasheet/searchSpec';

/** The row shape checkout's search reads — a subset of a `business_inventory` row, by key. */
export interface CheckoutSearchRow {
  name?: string | null;
  sku?: string | null;
  qb_item_name?: string | null;
  size?: string | null;
}

export const CHECKOUT_ITEM_SEARCH: readonly SearchField<CheckoutSearchRow>[] = [
  { label: 'name', columns: ['name'], get: r => r.name },
  // The SAME computed getter the roster uses and the SKU cell renders — `sku ?? qb_item_name`.
  // Reading `r.sku` here is the whole defect: live on LAWNS it is null on 631 of 632 live rows.
  { label: 'SKU or code', columns: ['sku', 'qb_item_name'], get: r => itemIdentifier(r) },
  { label: 'size', columns: ['size'], get: r => r.size },
];

/** Generated from the labels above — never typed (R-170). */
export const CHECKOUT_SEARCH_PLACEHOLDER = searchPlaceholderFor(CHECKOUT_ITEM_SEARCH);
