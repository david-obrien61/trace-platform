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
//           LADDER_PRICE_SOURCE · usesLadderPricing · LadderPriceKind · LADDER_PRICE_KINDS ·
//           ladderPriceKindFor.
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

/** Which per-rung price a service reads. Add a service here, not a new module. */
export type LadderPriceKind = 'install' | 'planting';

/**
 * What each priceable service reads off the rung, and what it does when the rung is empty.
 *
 * 🔴 `blocksOrder` IS THE ONE PLACE THE TWO SERVICES GENUINELY DIVERGE, AND IT IS DECLARED RATHER
 * THAN CODED AT EACH CALL SITE. Install REFUSES to be sold without an amount — David's ruling (c),
 * 2026-09-23: *"never $0, never a guess, never refused"*, so the counter must type one before the
 * order can go. Plant Your Tree does the opposite, by David's ruling of 2026-09-24: *"'I don't
 * know' → the installer identifies it on the install day and LAWNS AMENDS the order to add the
 * charge."* **An unpriced planting line must NOT stop the sale.** Two call sites read this
 * (CartReview's Send guard and `submit.ts`'s server-side recompute); hardcoding it in each is
 * exactly how they come to disagree.
 */
export const LADDER_PRICE_KINDS: Record<LadderPriceKind, {
  /** The Rung field holding the price. */
  price: 'installPrice' | 'pytPrice';
  /** The Rung field saying where that price came from. */
  because: 'installPriceBecause' | 'pytPriceBecause';
  /** Does an owed amount stop the order being sent? */
  blocksOrder: boolean;
  /** What the line says when its size reached a rung that carries no price. */
  unpriced: (rungLabel: string) => string;
  /** What the line says when the size reached NO rung, appended to the resolver's own sentence. */
  unplaceable: (resolverDetail: string) => string;
}> = {
  install: {
    price: 'installPrice',
    because: 'installPriceBecause',
    blocksOrder: true,
    // Names the rung, because the fix is one number on one row of the ladder and the person
    // reading this is the person who can set it.
    unpriced: (label) => `No price is set for ${label}. Type the amount for this line, with a reason.`,
    unplaceable: (detail) => detail,
  },
  planting: {
    price: 'pytPrice',
    because: 'pytPriceBecause',
    // 🔴 FALSE, AND IT IS A RULING, NOT A PREFERENCE. See the note on this table.
    blocksOrder: false,
    unpriced: (label) => `No Plant Your Tree price is set for ${label}. Type the amount, or leave it for the install day and amend the order then.`,
    // 🔴 THE WORDS DAVID ASKED FOR, VERBATIM IN SPIRIT: the size is not missing, it is NOT YET
    // KNOWN — the customer does not know what their own tree is potted in and the installer will
    // say on the day. "No size recorded" would read as a data-entry failure; this is a plan.
    unplaceable: (detail) => `Size to be confirmed on install day — priced then, by amendment. (${detail})`,
  },
};

/** The kind a service offering prices by. Today it is its name; when a column exists, that. */
export function ladderPriceKindFor(offering: { name?: string | null } | null | undefined): LadderPriceKind {
  return /plant your tree/i.test(offering?.name ?? '') ? 'planting' : 'install';
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
  kind: LadderPriceKind = 'install',
): LadderPricing {
  const spec = LADDER_PRICE_KINDS[kind];
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
        reason: spec.unplaceable(res.detail),
      };
    }

    const rung = res.rung;
    const price = rung[spec.price];
    if (price == null) {
      return {
        ...base,
        rungLabel: rung.label,
        unitPrice: null,
        lineTotal: null,
        needsAmount: true,
        reason: spec.unpriced(rung.label),
      };
    }

    const unit = Number(price);
    return {
      ...base,
      rungLabel: rung.label,
      unitPrice: round2(unit),
      lineTotal: round2(unit * qty),
      needsAmount: false,
      reason: `${rung.label} — ${rung[spec.because]}`,
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
