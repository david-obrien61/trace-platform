// ============================================================
// orderItemName — name/tag an order line by its business_inventory lot (ONE definition, roster + detail).
// PURPOSE: an order_items row anchors to its business_inventory stock line (business_inventory_id) —
//   the sole line anchor after the AC-1 vertical noun order_items.plant_id was dropped (20260709,
//   mirrors the social_drafts.plant_id DROP). D-34: the LOT is the SKU, so the lot's name IS the
//   variety name. The resolver keeps a specimen-name fallback (cultivar_plants) for any surface that
//   still supplies one, but the shared order spine no longer joins it. Reused by Orders + OrderDetail
//   + the QB preview + the real QB push so the surfaces cannot drift (CLAUDE.md §6 rule 8).
// DEPENDENCIES: none (pure).
// OUTPUTS: orderItemName, orderItemTag, orderItemAnchor.
// ============================================================

export interface OrderItemAnchorFields {
  business_inventory_id?: string | null;
  cultivar_plants?:  { tag_id?: string | null; common_name?: string | null; species?: string | null } | null;
  business_inventory?: { name?: string | null; size?: string | null; sku?: string | null } | null;
  /** 🔴 THE LINE'S OWN WORDS. A history line has NO lot by invariant — it is a SKU transcribed off a
   *  document for stock that left before this platform existed — so the lot join returns null and a
   *  lot-only resolver has nothing to say. These two columns are populated from the source document
   *  at capture, and they are what makes such a line SELF-DESCRIBING rather than anonymous. */
  description?: string | null;
  sku?: string | null;
}

/** Which anchor named this line — for the [TRACE:ROSTER] trail.
 *  `document` is a real, expected anchor, not a degraded one: it is how EVERY history line names
 *  itself. `unknown` now means what it says — nothing on the row could name it. */
export function orderItemAnchor(item: OrderItemAnchorFields): 'specimen' | 'stock_line' | 'document' | 'unknown' {
  if (item.cultivar_plants) return 'specimen';
  if (item.business_inventory) return 'stock_line';
  if (item.description || item.sku) return 'document';
  return 'unknown';
}

/**
 * Display name: specimen common_name/species WINS; else the stock line's name; else THE LINE'S OWN
 * DESCRIPTION; else an honest statement that nothing named it.
 *
 * 🔴 "Unknown plant" IS GONE AND MUST NOT COME BACK. It was printed whenever the lot join returned
 * null — which is EVERY line of EVERY history order, by invariant — so eight real orders for named,
 * priced, invoiced trees rendered as eight unknowns while `description` sat unread on the same row
 * holding "Mexican Sycamore - 45 gallon". Worse than useless: it is a CONFIDENT LABEL OVER DATA WE
 * HOLD, which is the same defect as the green add-on check and the $0 that was really a failed read
 * (D-9 / A9 — absent is not empty, and neither is un-joined).
 *
 * The last resort says what is actually true — the line matched nothing in the catalog — and it is
 * reachable only when the row genuinely carries no name in any form.
 */
export function orderItemName(item: OrderItemAnchorFields): string {
  const cp = item.cultivar_plants;
  if (cp?.common_name) return cp.common_name;
  if (cp?.species) return cp.species;
  const inv = item.business_inventory;
  if (inv?.name) return inv.name;
  // The lot comes first because it is OUR catalog record; the description is transcribed text. In
  // practice they never compete: a checkout line has a lot and no description, a history line the
  // reverse. Ordered deliberately anyway, so the day one row carries both there is a stated winner.
  if (item.description) return item.description;
  return 'No catalog match';
}

/** Tag/identifier line: specimen tag_id; else the lot's sku, else its size; else THE LINE'S OWN sku
 *  as printed on the source document (MS45, LAO45, CHO95 …); else em-dash.
 *  The document sku is last among the identifiers because it is the SELLER's code on a piece of
 *  paper, not a key into our catalog — but it is a real identifier a person can look up, and an
 *  em-dash where one exists is information thrown away. */
export function orderItemTag(item: OrderItemAnchorFields): string {
  const cp = item.cultivar_plants;
  if (cp?.tag_id) return cp.tag_id;
  const inv = item.business_inventory;
  if (inv?.sku) return inv.sku;
  if (inv?.size) return inv.size;
  if (item.sku) return item.sku;
  return '—';
}
