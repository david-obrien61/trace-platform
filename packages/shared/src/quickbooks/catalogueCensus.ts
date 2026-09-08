// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: two facts about a product list that only make sense once you know WHAT EACH ROW IS —
//   ① how many sizes we could not read, counted over the rows a size could actually be fixed on,
//   and ② how many rows would occupy the same catalogue shelf. Both read the classification axis
//   the services review established (R-112): the owner's own income account, never Intuit's `Type`.
// DEPENDENCIES: ./itemList (QboItemRow) · ./qboItemAdapter (adaptQboItems · SizeState) ·
//   ../business-logic/serviceReview (classifyDestination · DESTINATIONS).
//   Pure: no db, no network, no clock, no DOM.
// OUTPUTS: SizeReadabilitySplit · CollisionCensus · censusSizeReadability · censusCollisions.
// STORY: *David rehearses the import on a saved copy* (`user_stories.md`, ARC: ocr-doc-routing).
//
// ══════════════════════════════════════════════════════════════════════════════════════════
// 🔴 THE 33 UNREADABLE SIZES ARE 15, AND THE OTHER 18 ARE NOT A SMALLER PROBLEM — THEY ARE NOT
//    THIS PROBLEM AT ALL.
// ══════════════════════════════════════════════════════════════════════════════════════════
// MEASURED by a prior session against LAWNS's complete 685-item capture [STATED — this build could
// not re-measure; `SUPABASE_SERVICE_KEY` is empty and no capture file lives in this repository]:
// of the 33 items whose size could not be read, **15 are PRODUCTS · 10 are SERVICES · 6 are
// DISCOUNTS · 2 are NOT A SALE.**
//
// **A discount has no size. Neither does a trip charge, and neither does a refund.** Reporting 33
// asks an owner to go and fix eighteen rows that are already correct — and, worse, it makes the
// only number that proves this product works impossible to produce: **the 33 → 13 loop cannot work
// until the denominator only contains rows that can actually be fixed**, because a floor of 18
// unfixable rows means the count never falls to zero and the owner concludes the tool is wrong.
//
// So the finding reports **the products**, and NAMES the rest as not applicable with the reason.
//
// ⚠️ THIS IS NOT A CONTRADICTION OF THE `33` ON THE CATALOGUE IMPORT SCREEN, AND NEITHER NUMBER
// SHOULD BE "FIXED" TO MATCH THE OTHER. That screen answers *"of the rows this import is about to
// create, how many carry a size we could not read"* — and the import today filters only
// `Type: 'Category'`, so its population genuinely is all 647 sellable rows (#283 reported the
// change and deliberately did not build it). This module answers a different question over a
// different population. Two questions, two denominators, both stated.
// ─────────────────────────────────────────────────────────────────────────────
import type { QboItemRow } from './itemList';
import { adaptQboItems, type SizeState } from './qboItemAdapter';
import { classifyDestination, DESTINATIONS, type Destination } from '../business-logic/serviceReview';

export interface SizeReadabilitySplit {
  /** Rows a size could be fixed on: what the finding reports. */
  productsUnreadable: number;
  /** The product population those sit in — the denominator. */
  products: number;
  /** Unreadable rows that are not products, by destination. Named, never folded into the total. */
  notApplicable: Record<Exclude<Destination, 'product'>, number>;
  /** The sum of `notApplicable` — the 18. */
  notApplicableTotal: number;
  /** Everything the size read could not interpret, whatever it turned out to be — the 33. Carried
   *  so a reader can see the two figures side by side rather than wondering what happened to it. */
  unreadableAcrossEverything: number;
  /** Product rows whose size was read, and product rows that state no size. Same population. */
  productsSized: number;
  productsNotStated: number;
}

export interface CollisionCensus {
  /** Groups of rows that would occupy one catalogue shelf. */
  groups: number;
  /** Rows sitting in one — 2 for a pair, not 1. */
  rowsInvolved: number;
  /** Groups whose members do not all publish the same price. The sharp case. */
  groupsWithPriceDifference: number;
  /** The widest gap in the worst group, and the sentence that names it. */
  worstGap: number;
  worstReason: string | null;
  /** The population: rows an invoice line can point at. */
  sellable: number;
}

/** The destination of one raw QuickBooks item, on the income-account axis (R-112). */
function destinationOf(row: QboItemRow): Destination {
  return classifyDestination({
    id: row.id, name: row.name, description: row.description,
    unitPrice: row.unitPrice, type: row.type, incomeAccountName: row.incomeAccount,
  }).destination;
}

/**
 * Split the unreadable sizes by what the row actually is.
 *
 * ⚠️ THE SIZE STATE COMES FROM `adaptQboItems` AND IS NOT RE-DERIVED HERE. That module owns the
 * position-only size read and its three states; a second reading of the same descriptions would be
 * the same operation in two places (§6 r8), and the copy that drifts is never the one you are
 * looking at.
 */
export function censusSizeReadability(rows: QboItemRow[]): SizeReadabilitySplit {
  const adapted = adaptQboItems(rows);
  const stateById = new Map<string, SizeState>();
  for (const a of adapted.items) stateById.set(a.qboId, a.sizeState);

  const notApplicable: Record<Exclude<Destination, 'product'>, number> = {
    [DESTINATIONS.service]: 0, [DESTINATIONS.discount]: 0,
    [DESTINATIONS.notASale]: 0, [DESTINATIONS.folder]: 0,
  };
  let productsUnreadable = 0, products = 0, unreadableAcrossEverything = 0;
  let productsSized = 0, productsNotStated = 0;

  for (const row of rows) {
    const dest = destinationOf(row);
    // A folder has no size state at all — `adaptQboItems` never adapts one — so it contributes to
    // neither total. Reading `undefined` as unreadable would count the filing cabinet.
    const state = stateById.get(row.id);
    if (dest === DESTINATIONS.product) {
      products++;
      if (state === 'could_not_read') productsUnreadable++;
      else if (state === 'sized') productsSized++;
      else if (state === 'not_stated') productsNotStated++;
    } else if (state === 'could_not_read') {
      notApplicable[dest as Exclude<Destination, 'product'>]++;
    }
    if (state === 'could_not_read') unreadableAcrossEverything++;
  }

  return {
    productsUnreadable, products, notApplicable,
    notApplicableTotal: (Object.values(notApplicable) as number[]).reduce((a, b) => a + b, 0),
    unreadableAcrossEverything, productsSized, productsNotStated,
  };
}

/**
 * Rows that would occupy the same catalogue shelf.
 *
 * 🔴 THE ONE COLLISION DEFINITION, REACHED THROUGH THE ADAPTER RATHER THAN RE-KEYED HERE. It is
 * `findShapeCollisions` — the same rule the `/inventory` grid marks with (R-101) — so the report an
 * owner reads and the screen it sends her to cannot disagree about what a duplicate is. That
 * disagreement is exactly what this file's dependency chain was built to end: the adapter found
 * eleven and the grid showed none of them for two independent reasons, both measured.
 */
export function censusCollisions(rows: QboItemRow[]): CollisionCensus {
  const adapted = adaptQboItems(rows);
  const c = adapted.collisions;
  // 🔴 THE WORST GROUP IS THE FIRST ONE, BECAUSE `findShapeCollisions` ALREADY ORDERS BY MONEY AT
  // STAKE — and a `reduce` here re-deriving the same maximum was the same OPERATION in two places
  // (§6 r8). It was caught by its own mutant surviving: swapping the reduce for `c[0]` changed
  // nothing, which is the tell that one of the two was doing no work. The shared sort is the one
  // the `/inventory` grid also depends on (R-101 ①), and it is asserted in `shapeCollision.test.ts`
  // §B — so this reads the ordering rather than re-implementing it, and there is exactly one place
  // for "which collision matters most" to be decided.
  const worst = c.length > 0 ? c[0] : null;
  return {
    groups: c.length,
    rowsInvolved: adapted.counts.collidingItems,
    groupsWithPriceDifference: adapted.counts.collisionsWithPriceDifference,
    worstGap: worst?.moneyAtStake ?? 0,
    worstReason: worst?.reason ?? null,
    sellable: adapted.counts.sellable,
  };
}
