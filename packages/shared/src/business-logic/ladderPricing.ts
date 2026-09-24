// ============================================================
// ladderPricing — price a per-unit service from the CONTAINER LADDER, one rung per line.
//
// PURPOSE:  A service whose `price_source` is `'container_ladder'` does not have a price; its
//           RUNGS do. This turns (ladder, cart lines) into a per-line price, a total, and — for
//           every line whose rung carries no price — an honest refusal to invent one.
//
// WHY IT EXISTS (David, 2026-09-23): *"Lauren prices install BY CONTAINER SIZE — her sheet:
//           15 gal $150 · 30 $300 · 45 $450 · 65 $600 · 95 $900. So build a PER-SIZE INSTALL
//           PRICE TABLE, tenant-editable."* And: *"Don't tailor to LAWNS: a new tenant answers
//           'how do you price install?' — per size / flat / percentage of plants. Same code."*
//           Nothing in this file knows what an install is, or a tree, or a nursery. It prices a
//           service per unit from a ladder of sizes. (AC-1.)
//
// 🔴 IT NEVER INVENTS A PRICE, AND THAT IS THE WHOLE DESIGN. David's ruling (c), 2026-09-23:
//           *"A RUNG WITH NO PRICE: offer install and REQUIRE A TYPED AMOUNT with a reason —
//           never $0, never a guess, never refused."* Three outcomes, never a fourth:
//             · the rung carries a price      → the line is priced
//             · the rung carries none         → `needsAmount`, naming the rung
//             · the size lands on no rung     → `needsAmount`, carrying the RESOLVER's own reason
//           A 0 is never returned as a price. `lineTotal: null` is not the same fact as 0 and the
//           type keeps them apart (A9 — absent is not empty).
//
// 🔴 `needsAmount` DOES NOT BUILD A SECOND TYPED-AMOUNT MECHANISM — IT TURNS THE SHIPPED ONE FROM
//           OPTIONAL INTO REQUIRED (§6 r8). The platform already has exactly one way for a person
//           to put their own number on a service line: the price override on CartReview, gated by
//           `order_discount:apply`, requiring a reason, re-enforced server-side in `applyOverride`
//           (STD-013 — a reasonless override is REFUSED and the baseline charged), and recorded as
//           attributed leakage on `order_service_selections` (D-48). Building a parallel "type the
//           install price here" field would be a second writer of one fact. So this module reports
//           that an amount is OWED; the existing override is how it is given.
//
// 🔴 NO SIZE IS PARSED HERE. Every size question goes through `resolveRung` — David, 2026-09-16
//           (R-157): *"No second list of sizes, no size thresholds, no size parsed outside the
//           resolver."* This module calls the resolver and reads the rung. That is why a lot
//           spelled "15 Gallon", "15 gal" or "1G" needs no special case anywhere in here.
//
// DEPENDENCIES: ../inventory/containerLadder (Ladder, Rung, resolveRung). Pure — no database, no
//           clock, no I/O, so the CLIENT preview and the SERVER's authoritative recompute can call
//           the identical function over the identical inputs and cannot drift (D-39 / STD-012).
// OUTPUTS:  LadderPriceableLine · LadderPricedLine · LadderPricing · priceLinesFromLadder ·
//           LADDER_PRICE_SOURCE · usesLadderPricing · ladderBlocksOrder · ladderUnpricedWords.
//
// 🔴 IT PRICES TWO SERVICES AND IT IS STILL ONE MODULE — ledger #399, and the reason is #388's
//           lesson paid forward. `Plant Your Tree` prices by container size exactly as install
//           does (David, 2026-09-24), and the tempting move was a `plantingPricing.ts` beside
//           this one. **A second copy IS the defect** (R-175): checkout and the roster each had
//           their own search until one of them silently stopped matching. So the SERVICE is a
//           parameter — which rung field to read, and what to say when it is empty — and there
//           remains exactly one implementation of *price a line from its rung*.
// ============================================================
import { resolveRung, type Ladder } from '../inventory/containerLadder';

/** The `service_offerings.price_source` value that means "read the price off the rung". */
export const LADDER_PRICE_SOURCE = 'container_ladder';

/** Does this offering price itself from the ladder? Anything else is its own scalar `price`. */
export function usesLadderPricing(offering: { price_source?: string | null } | null | undefined): boolean {
  return offering?.price_source === LADDER_PRICE_SOURCE;
}

/**
 * How a ladder-priced service behaves when a rung carries no price.
 *
 * 🔴 EVERY LADDER-PRICED SERVICE READS `installPrice`. THERE IS NO SECOND PRICE COLUMN, AND THAT IS
 * DAVID'S CORRECTION OF 2026-09-24: *"PLANT YOUR TREE uses the INSTALL LADDER'S PRICES per
 * container size… 15 gal → the install from ladder."* An earlier draft (#399) gave Plant Your Tree
 * its own `pyt_price` column and seeded none of it, which would have made **every** Plant Your Tree
 * line unpriced the moment its `price_source` was switched. `pyt_price` still exists on the table —
 * a migration is never edited (§6 r1) — and is documented there as NOT USED.
 *
 * 🔴 AND THE PRICE IS CHOSEN BY `price_source`, NEVER BY THE SERVICE'S NAME. The earlier draft
 * matched `/plant your tree/i`, which meant **renaming the row in Settings would have changed what
 * it charged**. That weakness was filed against #399's own close-out; this removes it rather than
 * documenting it again.
 *
 * ⚠️ SO ONE THING IS STILL PER-SERVICE, AND IT IS A RULING RATHER THAN A PREFERENCE: whether an
 * unpriced line STOPS THE SALE.
 *   · INSTALL refuses — David, 2026-09-23 (c): *"never $0, never a guess, never refused."*
 *   · PLANT YOUR TREE does not — David, 2026-09-24: *"'I don't know' → the installer identifies it
 *     on the install day and LAWNS AMENDS the order to add the charge."*
 *
 * 🔴 WITH THE NAME GONE, THE ONLY EXISTING COLUMN THAT SEPARATES THEM IS `category`, AND THIS IS
 * THE ONE JUDGEMENT IN THIS FILE RATHER THAN A QUOTED RULING. Installation is `transport`; Plant
 * Your Tree is `addon`. The reading: **an addon is an EXTRA, and an extra nobody has priced yet can
 * be added later; anything else is part of how the order is fulfilled, and an order that cannot
 * price that cannot go.**
 *
 * 🔴 IT IS WRITTEN AS *"BLOCK UNLESS `addon`"*, NOT *"BLOCK IF `transport`"*, AND A TEST MADE ME
 * CHANGE IT. The first draft was the second form, which made an offering with NO category
 * non-blocking — and §C, a probe written for #386 and untouched since, went red because the
 * unpriced line stopped asking for a reason. That was the test telling me the DEFAULT was on the
 * wrong side: an unknown category taking the non-blocking path can put a silently free line on an
 * invoice, while an unknown category taking the blocking path can only ever refuse a sale until
 * somebody types a number. **Refusal charges MORE, never less** (§1.6 gate 10) — so blocking is the
 * default and NOT blocking is the explicit, categorised exception.
 *
 * ⚠️ If a tenant ever needs a blocking addon or a non-blocking transport, this is where a real
 * `blocks_when_unpriced` column belongs, and that is David's call rather than a default taken here.
 */
export function ladderBlocksOrder(
  offering: { category?: string | null } | null | undefined,
): boolean {
  return (offering?.category ?? '') !== 'addon';
}

/**
 * The words a line shows when the ladder cannot price it.
 *
 * Two sentences, and the difference is not decoration: for a tree the business is DELIVERING, a
 * missing size is a gap somebody must fill before the order can go. For a tree THE CUSTOMER ALREADY
 * OWNS, it is a plan — they do not know what their own pot is, and the installer will say on the
 * day. "No size recorded" would read as a data-entry failure; the other reads as what happens next.
 */
export function ladderUnpricedWords(
  offering: { category?: string | null } | null | undefined,
): { unpriced: (rungLabel: string) => string; unplaceable: (resolverDetail: string) => string } {
  return ladderBlocksOrder(offering)
    ? {
        // Names the rung, because the fix is one number on one row of the ladder and the person
        // reading this is the person who can set it.
        unpriced: (label) => `No price is set for ${label}. Type the amount for this line, with a reason.`,
        // The resolver's four reasons are already written for a person; repeating them in different
        // words would be two sentences for one fact, and the copy that drifts.
        unplaceable: (detail) => detail,
      }
    : {
        unpriced: (label) => `No price is set for ${label}. Type the amount, or leave it for the install day and amend the order then.`,
        unplaceable: (detail) => `Size to be confirmed on install day — priced then, by amendment. (${detail})`,
      };
}

/** One cart line, reduced to the only two things pricing-by-size needs. */
export interface LadderPriceableLine {
  /** The line's container size, EXACTLY as stored — never re-spelled (D-23 / R-50). */
  size: string | null;
  /** How many units of it. */
  quantity: number;
  /** For the screen: what the customer is buying, so a refusal can name the row. */
  name?: string;
}

/** What one line costs, or why it cannot be said yet. */
export interface LadderPricedLine {
  name: string | null;
  size: string | null;
  quantity: number;
  /** The rung this size landed on, or null when it landed on none. */
  rungLabel: string | null;
  /** Price for ONE unit. `null` ⇒ not set — NEVER 0, which would read as free. */
  unitPrice: number | null;
  /** unitPrice × quantity, or null when there is no unit price. */
  lineTotal: number | null;
  /** True ⇒ this line cannot be priced from the ladder and someone must type an amount. */
  needsAmount: boolean;
  /**
   * Why, in the words a person should read. For an unpriced rung this says which rung. For a size
   * that reached no rung it is the RESOLVER'S OWN sentence, which already distinguishes "no size
   * recorded" from "reads as a size we do not stock" from "sold by weight, not by container".
   */
  reason: string;
}

/** The whole service's price across the cart. */
export interface LadderPricing {
  lines: LadderPricedLine[];
  /** The sum of the lines that HAVE a price. Never includes a guess for the ones that do not. */
  pricedTotal: number;
  /** How many lines are waiting on a typed amount. 0 ⇒ the ladder priced the whole order. */
  linesNeedingAmount: number;
  /** Convenience: nothing is owed. */
  allPriced: boolean;
  /** Units on the lines that need an amount — what the typed figure has to cover. */
  quantityNeedingAmount: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Price every line from the ladder.
 *
 * ⚠️ A RETIRED RUNG STILL PRICES, and that is deliberate: `resolveRung` ignores `active` because a
 * past lot still points at its rung (R-133 — retire never means delete). A rung is removed from
 * what is OFFERED, not from what can be read. Refusing to price a line because its size was
 * retired last week would turn a catalogue decision into a checkout failure.
 *
 * ⚠️ A ZERO OR NEGATIVE QUANTITY YIELDS A ZERO LINE TOTAL, NOT A REFUSAL. Quantity is the cart's
 * business and is validated where the cart is built; this function's subject is the price.
 */
export function priceLinesFromLadder(
  ladder: Ladder,
  lines: readonly LadderPriceableLine[],
  /** The service being priced — read for its WORDS only; every service reads the same price. */
  offering?: { category?: string | null } | null,
): LadderPricing {
  const words = ladderUnpricedWords(offering);
  const priced: LadderPricedLine[] = lines.map((l) => {
    const qty = Number(l.quantity) || 0;
    const base = { name: l.name ?? null, size: l.size ?? null, quantity: qty };

    const res = resolveRung(ladder, l.size);
    if (!res.ok) {
      // The resolver's four reasons are already written for a person; install repeats them
      // unchanged rather than saying one fact in two sentences. Planting WRAPS them, because for
      // a tree we did not sell an unknown size is a plan for the install day, not a data gap.
      return {
        ...base, rungLabel: null, unitPrice: null, lineTotal: null, needsAmount: true,
        reason: words.unplaceable(res.detail),
      };
    }

    const rung = res.rung;
    // ONE price column for every ladder-priced service — David, 2026-09-24.
    const price = rung.installPrice;
    if (price == null) {
      return {
        ...base,
        rungLabel: rung.label,
        unitPrice: null,
        lineTotal: null,
        needsAmount: true,
        reason: words.unpriced(rung.label),
      };
    }

    const unit = Number(price);
    return {
      ...base,
      rungLabel: rung.label,
      unitPrice: round2(unit),
      lineTotal: round2(unit * qty),
      needsAmount: false,
      reason: `${rung.label} — ${rung.installPriceBecause}`,
    };
  });

  const pricedTotal = round2(
    priced.reduce((sum, l) => sum + (l.lineTotal ?? 0), 0),
  );
  const owed = priced.filter((l) => l.needsAmount);

  return {
    lines: priced,
    pricedTotal,
    linesNeedingAmount: owed.length,
    allPriced: owed.length === 0,
    quantityNeedingAmount: owed.reduce((sum, l) => sum + l.quantity, 0),
  };
}
