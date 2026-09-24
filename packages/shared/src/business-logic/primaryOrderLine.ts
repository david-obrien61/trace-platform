// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: pick the line that SUMMARISES an order — the first thing sold, not the
//   first row stored. One definition, used by the orders list and by any datasheet
//   column that shows "what was this order for".
// DEPENDENCIES: none — pure.
// OUTPUTS: primaryOrderLine.
//
// 🔴 WHY: the orders list read `order_items[0]` and printed it. On a LAWNS invoice the
// discount and the trip charge are ordinary lines, and they frequently come FIRST — so
// Lindsey LaPrime's order read "8× Customer Discount" and Duy Le's "1× Customer Discount
// 15%". The order was right; the summary described the wrong row. Ledger #403.
//
// ⚠️ IT IS A PREFERENCE, NOT A FILTER. An order that is ONLY a discount or only a trip
// charge still has to summarise as something, so this falls back to the first line rather
// than rendering "No items" over an order that plainly has some.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Descriptions that name MONEY MOVED or a SERVICE, rather than a thing loaded onto a truck.
 *
 * 🔴 ANCHORED TO THE WHOLE DESCRIPTION, AND THAT IS NOT FUSSINESS. A loose `/install/` or
 * `/delivery/` would skip LAWNS's real product lines: Marci & Thomas Wong's trees are
 * described "Texas Red Oak - 30 Gallon (Install & Warranty)". Matching a substring would
 * summarise that order as a discount — the exact defect, produced by the fix for it.
 * So a service is recognised only when the description IS the service.
 */
const SERVICE_LINE = [
  /^(customer\s+)?discount\b.*$/i,        // "Customer Discount", "Customer Discount 15%"
  /^.*\btrip\s*charge$/i,
  /^tax$/i,
  /^(backyard|tailgate|curbside)?\s*delivery$/i,
  /^.*\bfee$/i,                            // credit card fee, delivery fee
  /^service\s*charge$/i,
];
const SERVICE_SKU = /^(tc|customer\s*discount)$/i;

export interface SummarisableLine {
  description?: string | null;
  sku?: string | null;
  quantity?: number | null;
  unit_price?: number | string | null;
}

/**
 * The line that best answers "what was this order for?".
 *
 * Prefers the first line that is a PRODUCT: a non-negative unit price and a description that
 * is not a discount, charge or tax. Falls back to the first line, then to null for an order
 * with no lines at all — an empty order is a real state and must not be disguised.
 */
export function primaryOrderLine<T extends SummarisableLine>(lines: T[] | null | undefined): T | null {
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const product = lines.find(l => {
    const price = Number(l?.unit_price ?? 0);
    if (price < 0) return false;                       // a discount, whatever it is called
    const desc = String(l?.description ?? '').trim();
    const sku  = String(l?.sku ?? '').trim();
    if (SERVICE_SKU.test(sku)) return false;
    return !SERVICE_LINE.some(re => re.test(desc));
  });
  return product ?? lines[0];
}
