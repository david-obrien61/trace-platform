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

// ════════════════════════════════════════════════════════════════════════════════════════════
// SELLABILITY — the ONE predicate (STD-011 / §6 r8)
// ════════════════════════════════════════════════════════════════════════════════════════════
// WHY THIS EXISTS: "can this be sold?" was answered independently at three surfaces, in three
// different ways, and they disagreed in the way that matters — the checkout picker would ADD a
// lot with 0 available and the refusal arrived FIVE SCREENS LATER at review. PlantProfile
// checked `status === 'available'` and ignored price and committed; the scan picker checked
// NOTHING; only the server checked AVAILABLE. Three answers to one question.
//
// THE VERDICT CARRIES ITS OWN SENTENCE, deliberately. If this returned a bare boolean, every
// call site would write its own "why not" copy and they would drift — which is exactly how a
// lot came to read "29 available" on one screen and "AVAILABLE 0" on another. One function
// decides AND explains, so the reason the owner reads is the reason the code applied.
//
// THE SERVER GUARD IN submit.ts STAYS. This is a UI cap, and a UI cap is a courtesy — it stops
// a dead-end five screens early. It is NOT the authority: a client can be stale, offline, or
// bypassed, and the authoritative refusal remains server-side (defence in depth, not either/or).

/** Conditions a HUMAN asserts about a lot. These are the only values the status control offers. */
export const MANUAL_CONDITION_STATUSES = ['damaged', 'returned', 'archived'] as const;

/** Values DERIVED from qty (D-42: qty > 0 → available, else depleted). Never manually settable:
 *  the next qty write recomputes them, so offering them as a choice is a control that appears to
 *  do something and does not (D-9 — no fake surface). `reserved` is DELIBERATELY ABSENT: D-52
 *  replaced whole-lot reservation with a derived QUANTITY, so a lot-wide 'reserved' status is a
 *  vestige that only invites the confusion it looks like it resolves. */
export const DERIVED_STATUSES = ['available', 'depleted'] as const;

/** The status a lot's qty implies (D-42). Used to CLEAR a manual condition flag back to derived. */
export function deriveStatus(onHand: number): 'available' | 'depleted' {
  return Number(onHand ?? 0) > 0 ? 'available' : 'depleted';
}

export function isManualCondition(status: string | null | undefined): boolean {
  return (MANUAL_CONDITION_STATUSES as readonly string[]).includes(String(status ?? ''));
}

interface SellabilityInput {
  onHand: number | null | undefined;
  /** Units on open orders. Pass 0 where it genuinely cannot be derived — and SAY SO at that
   *  surface rather than letting a 0 read as "nothing is committed" (see PlantProfile / #66). */
  committed: number;
  status: string | null | undefined;
  sellPrice: number | null | undefined;
}

type SellableVerdict =
  | { sellable: true;  available: number; reason: null }
  | { sellable: false; available: number; reason: 'condition' | 'no_price' | 'none_available'; detail: string };

/**
 * Can this lot be sold RIGHT NOW, and if not, what does the person in front of it need to hear?
 *
 * Order of checks is the order of usefulness, not of cost: a DAMAGED lot is not a quantity
 * problem, so saying "0 available" about it would be true and useless. Condition first, then
 * price (a $0 lot is a setup gap, not a stock gap), then quantity.
 */
export function checkSellable(x: SellabilityInput): SellableVerdict {
  const onHand = Number(x.onHand ?? 0);
  const available = availableFrom(onHand, x.committed);

  if (isManualCondition(x.status)) {
    const word = String(x.status);
    return {
      sellable: false, available, reason: 'condition',
      detail: word === 'archived'
        ? 'Archived — this lot has been retired from the catalog.'
        : `Marked ${word} — clear the condition in Inventory before selling it.`,
    };
  }

  const price = Number(x.sellPrice ?? 0);
  if (!Number.isFinite(price) || price <= 0) {
    return {
      sellable: false, available, reason: 'no_price',
      detail: 'No price set — set it in Inventory before this can be sold.',
    };
  }

  if (available <= 0) {
    return {
      sellable: false, available, reason: 'none_available',
      detail: x.committed > 0
        ? `None available to sell (${onHand} on hand, ${x.committed} committed to open orders).`
        : 'None in stock.',
    };
  }

  return { sellable: true, available, reason: null };
}

/**
 * The availability sentence, in ONE place.
 *
 * Names BOTH numbers whenever units are committed — a bare "0 available" against a lot the owner
 * can SEE holding 29 reads as a bug, not a rule. Same reason D-52's server refusal names both.
 */
export function availabilityLabel(onHand: number | null | undefined, committed: number): string {
  if (onHand == null) return '';
  const n = Number(onHand);
  const avail = availableFrom(n, committed);
  return committed > 0
    ? `${avail} available (${n} on hand, ${committed} committed)`
    : `${avail} available`;
}

// ── The status CONTROL, defined once (BUILD 3) ───────────────────────────────────────────────
// Two surfaces edit status (the grid cell and the InventoryEditor sheet). They get their options,
// their displayed value, and their save-resolution from HERE, so they cannot offer different
// vocabularies — which is how 'reserved' survived in one list after D-52 retired the concept.

/** Sentinel VALUE for "no manual condition — let qty derive it". Never persisted: it resolves to
 *  the derived status on save. A sentinel rather than '' because an empty <option> reads as a
 *  missing choice, and this is a real, meaningful selection. */
const STATUS_DERIVED = '__derived__';

/** What the control should show as selected for a row. A derived status is not a "choice" the
 *  owner made, so it renders as the derived option, not as itself. */
export function statusSelectValue(status: string | null | undefined): string {
  return isManualCondition(status) ? String(status) : STATUS_DERIVED;
}

/** The options, with the DERIVED one labelled by what qty actually implies — so the owner reads
 *  the true current state ("available (derived from qty)") instead of an opaque placeholder. */
export function statusSelectOptions(onHand: number): Array<{ value: string; label: string }> {
  return [
    { value: STATUS_DERIVED, label: `${deriveStatus(onHand)} (derived from qty)` },
    ...MANUAL_CONDITION_STATUSES.map(s => ({ value: s, label: s })),
  ];
}

/** What to PERSIST for a selection. Choosing the derived option writes the value qty implies —
 *  which is what clears a condition flag, and is also exactly what the next qty write would set. */
export function resolveStatusSelection(selected: string, onHand: number): string {
  return selected === STATUS_DERIVED ? deriveStatus(onHand) : selected;
}

/** Status values that can legitimately EXIST on a row — for FILTER lists, which must offer what
 *  the data contains (including derived values), not what the editor may set. */
export const ALL_STATUS_VALUES = [...DERIVED_STATUSES, ...MANUAL_CONDITION_STATUSES] as const;
