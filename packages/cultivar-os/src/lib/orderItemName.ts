// ============================================================
// orderItemName — name/tag an order line by its D-34 anchor (ONE definition, roster + detail).
// PURPOSE: an order_items row is anchored EITHER to a cultivar_plants specimen (plant_id) OR a
//   business_inventory stock line (business_inventory_id) — never both (submit.ts §8). The roster
//   used to join ONLY cultivar_plants, so every stock-line / scan order rendered "Unknown plant".
//   This resolves the display name with the SAME dual-anchor fallback usePlant uses: specimen
//   WINS (vertical identity), else the stock line's name. Reused by Orders + OrderDetail so the
//   two surfaces cannot drift (CLAUDE.md §6 rule 8).
// DEPENDENCIES: none (pure).
// OUTPUTS: orderItemName, orderItemTag, orderItemAnchor.
// ============================================================

export interface OrderItemAnchorFields {
  plant_id?:              string | null;
  business_inventory_id?: string | null;
  cultivar_plants?:  { tag_id?: string | null; common_name?: string | null; species?: string | null } | null;
  business_inventory?: { name?: string | null; size?: string | null; sku?: string | null } | null;
}

/** Which anchor named this line — for the [TRACE:ROSTER] trail. */
export function orderItemAnchor(item: OrderItemAnchorFields): 'specimen' | 'stock_line' | 'unknown' {
  if (item.cultivar_plants) return 'specimen';
  if (item.business_inventory) return 'stock_line';
  return 'unknown';
}

/** Display name: specimen common_name/species WINS; else the stock line's name; else honest fallback. */
export function orderItemName(item: OrderItemAnchorFields): string {
  const cp = item.cultivar_plants;
  if (cp?.common_name) return cp.common_name;
  if (cp?.species) return cp.species;
  const inv = item.business_inventory;
  if (inv?.name) return inv.name;
  return 'Unknown plant';
}

/** Tag/identifier line: specimen tag_id; else the lot's sku, else its size, else em-dash. */
export function orderItemTag(item: OrderItemAnchorFields): string {
  const cp = item.cultivar_plants;
  if (cp?.tag_id) return cp.tag_id;
  const inv = item.business_inventory;
  if (inv?.sku) return inv.sku;
  if (inv?.size) return inv.size;
  return '—';
}
