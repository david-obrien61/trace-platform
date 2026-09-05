// ============================================================
// productionHold — THE HOLD IS DERIVED FROM THE PLAN, EXACTLY AS COMMITTED IS DERIVED FROM ORDERS
//
// PURPOSE:      Stock claimed by an open production plan is not for sale. This module derives that
//               claim. It is the THIRD number in the availability model, and it is deliberately
//               built as the mirror image of `inventoryStates.fetchCommittedByLot` so that the two
//               read the same way at a call site.
//
// 🔴 DERIVED, NEVER A COLUMN — RULED BY DAVID 2026-09-05 (R-84), AND THE FILE HAD ALREADY SAID IT.
//   `inventoryStates.ts` states the rule for the number next door: *"STD-011 is the reason
//   committed/available are derived and not columns: on-hand is ONE number, and a stored
//   `committed` would be a second representation of the open orders that WILL drift from them.
//   The orders ARE the commitment; we read them."* The plan IS the hold, and we read it.
//   R-27 is the general form: *"A DERIVED COLUMN IS A PROJECTION OF ITS SOURCE OR IT IS A SECOND
//   TRUTH, AND THERE IS NO THIRD OPTION."* A `business_inventory.held_qty` column would be a
//   number that can disagree with the plan that created it, and tech-debt #71 is that defect
//   already live on `status` — two authors, the reverting one wins, and nothing says so.
//
// 🔴 A LINE HOLDS STOCK WHILE ITS PLAN IS OPEN, AND THE HOLD IS THE UNFINISHED REMAINDER.
//   `qty_planned − qty_completed`. Once a batch completes, those trees have physically moved — the
//   ledger rows are written and on-hand has changed — so continuing to hold them would subtract
//   them twice. That is precisely why `holdsCommitment` excludes `fulfilled` next door, and the
//   reasoning is worth stating in both places rather than cross-referenced: *"the units physically
//   LEFT… so counting them as committed would subtract them twice."*
//
// 🔴 THE OPEN SET IS DERIVED BY EXCLUSION, and the direction is deliberate — the same choice
//   `holdsCommitment` makes and for the same reason. A new plan state (`paused`, `approved`) is far
//   more likely than a new terminal one, so exclusion makes the SAFE assumption automatically: a
//   status nobody has classified holds its stock rather than silently releasing it. Fail toward not
//   overselling.
//
// DEPENDENCIES: none beyond the db handle it is given. No import from `cultivar-os` — this is
//               shared, and the boundary is a convention nothing enforces (tech-debt #156), so it
//               is kept by hand here.
// OUTPUTS:      HeldByLot · PLAN_STATUSES · holdsStock · fetchHeldByLot · availableFrom3 ·
//               availabilityLabel3.
// AC-1:         generic. Nothing here knows what is being grown.
// STORY:        user_stories.md → *The growing ladder — potted, waiting, ready, and up a size*.
// ============================================================

/** Lot id → units held by open production plans. An absent key is zero held. */
export type HeldByLot = Map<string, number>;

/** The plan lifecycle. Terminal states are the two that release stock. */
export const PLAN_STATUSES = ['draft', 'open', 'completed', 'cancelled'] as const;
export type PlanStatus = (typeof PLAN_STATUSES)[number];

/**
 * Does a plan in this status HOLD stock?
 *
 * TRUE for `draft` and `open`. FALSE for `completed` (the trees moved; on-hand already changed, so
 * holding them again subtracts twice) and `cancelled` (the claim was released; on-hand never moved).
 *
 * ⚠️ `draft` HOLDS, and that is a decision rather than an oversight. A draft is a manager part-way
 * through deciding, and the alternative — a draft that holds nothing — means the stock he is
 * planning around can be sold out from under him between opening the screen and committing it. The
 * cost of the other error is a lot that reads unavailable while somebody thinks about it, which is
 * visible and reversible. Fail toward not overselling.
 */
export function holdsStock(status: string | null | undefined): boolean {
  return status !== 'completed' && status !== 'cancelled';
}

/**
 * Read HELD per lot: the sum of unfinished quantity on open plan lines.
 *
 * ONE query for the whole business, not per-lot — the callers (the inventory grid, the checkout
 * pre-flight) need many lots at once, and N+1 on the checkout path is the wrong shape.
 *
 * Returns an EMPTY map on error and SAYS SO LOUDLY. Rationale, and it is the same trade
 * `fetchCommittedByLot` makes: an empty map degrades availability to on-hand-minus-committed — the
 * pre-hold behaviour — which is the honest, safe failure. Throwing would block checkout on a read
 * that is an over-sell REFINEMENT, which §6 r6 forbids (integration failure never blocks an order).
 * ⚠️ The degradation is SURFACED rather than silent, because a read that fails and returns a
 * fallback has manufactured a fact — `ui-control-standards.md` §6/R1, binding since 2026-08-23.
 */
export async function fetchHeldByLot(db: any, businessId: string): Promise<HeldByLot> {
  const held: HeldByLot = new Map();
  const openStatuses = (PLAN_STATUSES as readonly string[]).filter(holdsStock);

  const { data, error } = await db
    .from('production_plan_lines')
    .select('qty_planned, qty_completed, source_inventory_id, production_plans!inner(status, business_id)')
    .eq('production_plans.business_id', businessId)
    .in('production_plans.status', openStatuses);

  if (error) {
    console.log('[TRACE:UPPOT] held read FAILED — availability degrades to on-hand − committed (surfaced, not silent)', {
      businessId, code: (error as any)?.code, error: (error as any)?.message,
    });
    return held;
  }

  for (const row of (data ?? []) as Array<{ qty_planned: number; qty_completed: number | null; source_inventory_id: string | null }>) {
    if (!row.source_inventory_id) continue;
    const remaining = Number(row.qty_planned ?? 0) - Number(row.qty_completed ?? 0);
    if (!Number.isFinite(remaining) || remaining <= 0) continue;
    held.set(row.source_inventory_id, (held.get(row.source_inventory_id) ?? 0) + remaining);
  }

  console.log('[TRACE:UPPOT] held derived from open plans', {
    businessId, openStatuses, lotsHeld: held.size,
    totalUnitsHeld: [...held.values()].reduce((a, b) => a + b, 0),
  });
  return held;
}

/**
 * available = on-hand − committed − held, floored at 0.
 *
 * Never returns a negative: a negative available is a data problem to SURFACE, never a number to
 * render at a customer. The caller logs it — same contract as `availableFrom` next door.
 */
export function availableFrom3(onHand: number, committed: number, held: number): number {
  return Math.max(0, Number(onHand ?? 0) - Number(committed ?? 0) - Number(held ?? 0));
}

/**
 * The availability sentence when three claims are in play, in ONE place.
 *
 * Names EVERY non-zero claim. A bare "0 available" against a lot the owner can SEE holding 220
 * reads as a bug rather than a rule, which is the reason the two-number version says both — and a
 * hold is the claim a person is least likely to guess, because production took it rather than a
 * customer.
 */
export function availabilityLabel3(
  onHand: number | null | undefined, committed: number, held: number,
): string {
  if (onHand == null) return '';
  const n = Number(onHand);
  const avail = availableFrom3(n, committed, held);
  const parts: string[] = [`${n} on hand`];
  if (committed > 0) parts.push(`${committed} committed`);
  if (held > 0) parts.push(`${held} held for uppotting`);
  return parts.length === 1 ? `${avail} available` : `${avail} available (${parts.join(', ')})`;
}
