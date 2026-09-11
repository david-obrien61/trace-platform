// ============================================================
// stopLoad — WHAT A STOP'S CARD SAYS ABOUT WHAT IS ON ITS ORDER, IN EVERY STATE IT CAN BE IN.
//
// PURPOSE:      A stop on /delivery-schedule gave the crew a name, an address and a button — and
//               nothing about what was being delivered (David, 2026-09-09 09:42,
//               DeliveryDayIssue9Sep0943hrsL.pdf). The lines were on the linked order all along;
//               nothing rendered them. This module decides what the card says for a stop whose
//               order has lines · has none · could not be read · is withheld from this viewer ·
//               does not exist — as VALUES, because a render condition inside a .tsx cannot be
//               asserted (tech-debt #134).
//
//               🔴 THE HEADING IS "ON THIS ORDER", NEVER "LOAD" — DAVID'S RULING R-144, 2026-09-11.
//               Nothing stored says whether a line is a good or a fee. A line copied from an invoice
//               carries `sku` + `description` text and NO link to the QuickBooks item — and the item
//               is where the classification already lives: its income account splits LAWNS's 685
//               items 564 · 73 · 8 · 2 · 38 (the 2026-09-09 census). What is missing is the LINK from
//               `order_items` to that item (tech-debt #139). Filtering on the words "Trip Charge" is
//               the rule that breaks on customer two, so every line is shown, a line copied from an
//               invoice says so, and the filter is its own build.
//
//               ✅ A LINE ANCHORED TO A LOT IS NOT A FEE, BY CONSTRUCTION: checkout writes the trip
//               charge and every add-on to `order_service_selections`, never to `order_items`
//               (`submit.ts` §8/§9). So the "copied from the invoice" note is raised only by lines
//               with no lot — every line of a QuickBooks or photographed invoice ([[R-21]]) and no
//               line of a checkout order.
//
// DEPENDENCIES: ./orderItemName (the ONE line-name resolver, §6 r8). Otherwise pure.
// OUTPUTS:      StopOrderItem · StopLoad · loadLineFrom · stopLoadModel · LOAD_COPY
//
// AC-1: no vertical noun. A line is a line and a stop is a stop.
// ============================================================

import { orderItemName, type OrderItemAnchorFields } from './orderItemName';

/** One `order_items` row as the stop read returns it. */
export interface StopOrderItem extends OrderItemAnchorFields {
  order_id: string;
  quantity: number;
}

/** One line as the card renders it. Shape-compatible with the shared OrderLineList. */
interface LoadLine {
  quantity: number;
  description: string;
  sku: string | null;
  /** True when the line names a lot — it came through checkout, where a fee never becomes a line. */
  anchored: boolean;
}

export type StopLoad =
  | { state: 'no_order' }
  | { state: 'withheld' }
  | { state: 'unread' }
  | { state: 'no_lines' }
  | { state: 'lines'; lines: LoadLine[]; unanchoredCount: number };

export function loadLineFrom(item: StopOrderItem): LoadLine {
  const name = orderItemName(item);
  // A lot's NAME carries no size ("Monterrey Oak"); its size is its own column, so it is appended. A
  // document's description already carries its size ("Monterrey Oak - 45 gallon") and is never
  // appended to. Only a lot that actually NAMED the line lends its size — otherwise a description
  // would be followed by a size from a lot it did not come from.
  const size = item.business_inventory?.size?.trim();
  const description = item.business_inventory?.name && size ? `${name} — ${size}` : name;
  return {
    quantity: item.quantity,
    description,
    sku: item.sku?.trim() || null,
    anchored: !!item.business_inventory_id,
  };
}

interface StopLoadInput {
  orderId: string | null;
  /** The viewer holds `order_items:read`. */
  canReadLines: boolean;
  /** The lines query ran and did not error. */
  linesRead: boolean;
  items: StopOrderItem[];
}

export function stopLoadModel(x: StopLoadInput): StopLoad {
  // The ORDER of these is the point — each is a more fundamental fact than the one after it.
  //  · A stop with no order has nothing to withhold and nothing to fail to read.
  //  · A viewer without the permission must never be told the order is EMPTY: RLS hands them zero
  //    rows, which is exactly what "No items recorded" would then assert — a fact about the VIEWER
  //    reported as a fact about the BUSINESS (six-state ruling 2026-07-30: withheld data announces
  //    its redaction).
  //  · A failed read is not an empty order (D-9 / A9 — absent is not empty).
  if (!x.orderId) return { state: 'no_order' };
  if (!x.canReadLines) return { state: 'withheld' };
  if (!x.linesRead) return { state: 'unread' };
  if (x.items.length === 0) return { state: 'no_lines' };
  const lines = x.items.map(loadLineFrom);
  return { state: 'lines', lines, unanchoredCount: lines.filter(l => !l.anchored).length };
}

/** Every sentence the load block can say, in ONE place (STD-011). None of them is a blank. */
export const LOAD_COPY = {
  heading: (n: number) => `On this order · ${n} line${n === 1 ? '' : 's'}`,
  unanchoredNote:
    'Copied from the invoice, so any trip charge, fee or discount on it is listed too — nothing yet marks which lines go on the truck.',
  no_order: 'No order is linked to this stop, so nothing records what goes on the truck.',
  no_lines: 'No items recorded on this order.',
  unread: 'Couldn’t read what’s on this order. Reload to try again.',
} as const;
