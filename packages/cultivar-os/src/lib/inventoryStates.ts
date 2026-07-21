// ============================================================
// inventoryStates — the D-52 three-number inventory model, in ONE place.
// PURPOSE:  Inventory has THREE states (the unanimous industry standard — Shopify, Oracle,
//           Microsoft Dynamics, ERPAG, Sellbrite; ADOPTED not invented, per §6 r10/r16):
//             ON-HAND   = business_inventory.qty. Units physically on the property,
//                         INCLUDING units sold but not yet delivered. The ONLY stored number.
//             COMMITTED = units attached to a placed-but-unfulfilled order. Physically here,
//                         but spoken for. DERIVED — a SUM over open order lines. Never stored.
//             AVAILABLE = on-hand − committed. What a NEW order can actually take. DERIVED.
//           STD-011 is the reason committed/available are derived and not columns: on-hand is
//           ONE number, and a stored `committed` would be a second representation of the open
//           orders that WILL drift from them. The orders ARE the commitment; we read them.
// DEPENDENCIES: ./orderStatus (ORDER_STATUSES — the lifecycle this keys off).
// OUTPUTS:  movesOnHand, availableFrom, fetchCommittedByLot, CommittedByLot.
//           (holdsCommitment is deliberately module-internal — see its note.)
// SCOPE:    pure predicates + ONE read query. It NEVER writes and never mutates qty — the only
//           on-hand writer remains the adjust_inventory_qty RPC (D-42 §11 / D-50 LAYER 1).
// AC-1:     generic — no vertical noun; this is the platform inventory model, not a nursery one.
// ============================================================
import { ORDER_STATUSES } from './orderStatus';

/** Lot id → committed (reserved) unit count. Absent key = zero committed. */
export type CommittedByLot = Map<string, number>;

/**
 * Does an order in this status HOLD a commitment against stock?
 *
 * TRUE for the open states (`pending`, `confirmed`): the units are spoken for but still on the
 * property. FALSE for `fulfilled` (the units physically LEFT — they are out of on-hand entirely,
 * so counting them as committed would subtract them twice) and for `cancelled` (the commitment
 * was released; on-hand never moved).
 *
 * Derived by EXCLUSION from ORDER_STATUSES rather than an allow-list, and that direction is
 * deliberate: R-STATUS is an OPEN decision (David ratifies the set — orderStatus.ts:7-8). A new
 * open state (`packed`, `ready`, …) is far more likely than a new terminal one, so exclusion makes
 * the safe assumption automatically — a new status defaults to HOLDING its commitment (stock
 * protected) rather than silently releasing it (stock oversold). Fail toward not overselling.
 */
// NOT exported: nothing outside this module needs to ask the question directly — callers want
// COMMITTED (the number), which fetchCommittedByLot already derives using this. Exporting it
// anyway would invite a second, hand-rolled definition of "open" at a call site, which is the
// drift this file exists to prevent. Promote it to an export when a real consumer appears.
function holdsCommitment(status: string | null | undefined): boolean {
  return status !== 'fulfilled' && status !== 'cancelled';
}

/**
 * Does the transition INTO this status move physical on-hand?
 *
 * Exactly one status does: `fulfilled`. This is D-52's core correction to D-42 — the plant leaves
 * the property when it is delivered or driven away, NOT when the order is placed. Every on-hand
 * mutation on the order path keys off this predicate, so there is ONE answer to "did this order's
 * stock physically move?" instead of four call sites each assuming it independently (which is
 * exactly the bug D-42's checkout-decrement left behind in the restore paths).
 */
export function movesOnHand(status: string | null | undefined): boolean {
  return status === 'fulfilled';
}

/** available = on-hand − committed, floored at 0. Never returns a negative: a negative available
 *  is a data problem to SURFACE (the caller logs it), never a number to render at a customer. */
export function availableFrom(onHand: number, committed: number): number {
  return Math.max(0, Number(onHand ?? 0) - Number(committed ?? 0));
}

/**
 * Read COMMITTED per lot: the SUM of open (unfulfilled, uncancelled) order-line quantities.
 *
 * ONE query for the whole business, not per-lot — the caller (checkout pre-flight, inventory grid)
 * needs many lots at once, and N+1 lot queries on the checkout path is the wrong shape. The join
 * filters on the ORDER's status, so a line is committed only while its order is open.
 *
 * Returns an EMPTY map on error rather than throwing, and says so loudly in the trail. Rationale:
 * an empty map degrades AVAILABLE to ON-HAND — the pre-D-52 behavior — which is the honest, safe
 * failure. Throwing here would block checkout entirely on a read that is an over-sell REFINEMENT,
 * violating §6 r6 (integration failure never blocks an order). The degradation is SURFACED, never
 * silent, so a persistent read failure shows up as a trail line rather than as mystery overselling.
 */
export async function fetchCommittedByLot(
  db: any, businessId: string,
): Promise<CommittedByLot> {
  const committed: CommittedByLot = new Map();
  const openStatuses = (ORDER_STATUSES as readonly string[]).filter(holdsCommitment);

  const { data, error } = await db
    .from('order_items')
    .select('quantity, business_inventory_id, orders!inner(status, business_id)')
    .eq('orders.business_id', businessId)
    .in('orders.status', openStatuses);

  if (error) {
    console.log('[TRACE:INVENTORY] committed read FAILED — available degrades to on-hand (surfaced, not silent)', {
      businessId, code: (error as any)?.code, error: (error as any)?.message,
    });
    return committed;
  }

  for (const row of (data ?? []) as Array<{ quantity: number; business_inventory_id: string | null }>) {
    if (!row.business_inventory_id) continue;
    const q = Number(row.quantity ?? 0);
    if (!Number.isFinite(q) || q <= 0) continue;
    committed.set(row.business_inventory_id, (committed.get(row.business_inventory_id) ?? 0) + q);
  }

  console.log('[TRACE:INVENTORY] committed derived from open orders', {
    businessId, openStatuses, lotsCommitted: committed.size,
    totalUnitsCommitted: [...committed.values()].reduce((a, b) => a + b, 0),
  });
  return committed;
}
