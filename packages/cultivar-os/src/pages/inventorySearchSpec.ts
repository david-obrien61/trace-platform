// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      What /inventory's search searches — declared ONCE, so the haystack, the
//               placeholder and the fetched-column check all read the same list.
// DEPENDENCIES: searchSpec (pure) · itemIdentifier (the SAME function the SKU cell renders).
// OUTPUTS:      INVENTORY_SEARCH · INVENTORY_SEARCH_PLACEHOLDER.
//
// 🔴 IT IS ITS OWN FILE SO A TEST CAN REACH IT. Living inline in `BusinessInventory.tsx`, the
// search was a decision inside a .tsx — unreachable to the harness (tech-debt #134) — which is
// why a placeholder could promise SKU for two days while the search matched nothing.
// ─────────────────────────────────────────────────────────────────────────────
import { itemIdentifier } from '@trace/shared/quickbooks/itemIdentifier';
import { searchPlaceholderFor, type SearchField } from '@trace/shared/components/datasheet/searchSpec';

/** The row shape the search reads — a subset of the grid's row, by key. */
interface InventorySearchRow {
  name?: string | null;
  sku?: string | null;
  qb_item_name?: string | null;
  size?: string | null;
  location?: string | null;
  variant_group?: string | null;
  serial_number?: string | null;
  notes?: string | null;
}

export const INVENTORY_SEARCH: readonly SearchField<InventorySearchRow>[] = [
  { label: 'name', columns: ['name'], get: r => r.name },
  // 🔴 THE FIX, AND THE WHOLE POINT OF THE SPEC. The cell renders `itemIdentifier(r)` —
  // `sku ?? qb_item_name` — so the search reads THE SAME FUNCTION. Reading `r.sku` here is what
  // broke it: live on LAWNS `sku` is null on 1,078 of 1,079 rows and the code the grid displays
  // lives in `qb_item_name`. Both columns are declared because no check can infer them from a
  // computed getter.
  { label: 'SKU or code', columns: ['sku', 'qb_item_name'], get: r => itemIdentifier(r) },
  { label: 'size', columns: ['size'], get: r => r.size },
  { label: 'location', columns: ['location'], get: r => r.location },
  { label: 'group', columns: ['variant_group'], get: r => r.variant_group },
  { label: 'serial', columns: ['serial_number'], get: r => r.serial_number },
  { label: 'notes', columns: ['notes'], get: r => r.notes },
];

/** Generated from the labels above — never typed. See `searchPlaceholderFor` for why it counts
 *  the fields it cannot name rather than trailing an ellipsis over them. */
export const INVENTORY_SEARCH_PLACEHOLDER = searchPlaceholderFor(INVENTORY_SEARCH);
