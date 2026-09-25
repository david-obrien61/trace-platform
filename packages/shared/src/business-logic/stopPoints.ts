// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Put a delivery stop on the map — resolve each stop to a coordinate from the
//               customer's located addresses, and name the ones that cannot be placed.
// DEPENDENCIES: customerAddressFields (normalizeAddressPart) · deliveryRings (Point).
// OUTPUTS:      resolveStopPoints()
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 A STOP HAS NO COORDINATE OF ITS OWN TODAY, AND THAT IS MEASURED, NOT ASSUMED
// ═════════════════════════════════════════════════════════════════════════════
// `deliveries.latitude/longitude/coordinate_set_at` exist ONLY in `20260923d`, which is WRITTEN
// AND NOT APPLIED, and nothing in the codebase reads or writes them — a grep for
// `coordinate_set_at` across `packages/` returns nothing. `stopRead` does not select them. So a
// stop fed straight to anything expecting a location would be unplaceable, every time.
//
// This resolves a stop through its CUSTOMER instead: the customer's located addresses, preferring
// the one whose street line matches what the stop says. That is available today, on the 208
// addresses the bulk run reached.
//
// ⚠️ IT ANSWERS "WHERE IS THIS CUSTOMER NOW", NOT "WHERE DID THIS STOP GO", AND THE DIFFERENCE
// MATTERS FOR EXACTLY ONE PURPOSE. For planning a day that has not happened, the customer's
// current address IS the right answer. For HISTORY — what a past delivery cost, where it actually
// went — it is not, and `20260923d` exists precisely so a stop keeps the coordinate it had on the
// day. Nothing here may be used to answer a question about the past.
//
// 🔴 A MATCH ON THE STREET LINE, THEN THE ONLY ONE, THEN NOTHING. It never picks "an address this
// customer has" when they have several and none matches: a contractor with three job sites would
// otherwise get their Leander pin used for a Dripping Springs stop, and the plan would be wrong
// in a way that looks perfectly reasonable on screen.
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeAddressPart } from './customerAddressFields';
import type { Point } from './deliveryRings';

/**
 * The three fields this needs off a stop, and NOTHING else.
 *
 * ⚠️ NO `[k: string]: unknown` INDEX SIGNATURE, and that is not tidiness — with one, a real
 * `StopRow` does not satisfy this type at all (TypeScript will not assign an interface without an
 * index signature to one that has it), so the convenience of "any other field is fine" costs you
 * the ability to pass the actual row. The generic parameter already carries the caller's full
 * type through to the result.
 */
export interface StopLike {
  id: string;
  customer_id?: string | null;
  address_line1?: string | null;
}

export interface AddressLike {
  customerId: string | null;
  line1: string | null;
  latitude: number;
  longitude: number;
}

export type StopPlacementBasis = 'street-match' | 'only-address' | 'none';

export interface PlacedStop<T extends StopLike> {
  stop: T;
  point: Point;
  /** How we decided — shown, because "matched the street" and "their only address" differ. */
  basis: Exclude<StopPlacementBasis, 'none'>;
}

export interface StopPlacement<T extends StopLike> {
  placed: PlacedStop<T>[];
  /** 🔴 Named, never guessed at, and never quietly given somebody else's pin. */
  unplaceable: { stop: T; why: string }[];
}

export function resolveStopPoints<T extends StopLike>(
  stops: readonly T[],
  addresses: readonly AddressLike[],
): StopPlacement<T> {
  const byCustomer = new Map<string, AddressLike[]>();
  for (const a of addresses) {
    if (!a.customerId) continue;
    const list = byCustomer.get(a.customerId) ?? [];
    list.push(a);
    byCustomer.set(a.customerId, list);
  }

  const placed: PlacedStop<T>[] = [];
  const unplaceable: { stop: T; why: string }[] = [];

  for (const stop of stops) {
    const cid = stop.customer_id ?? null;
    if (!cid) { unplaceable.push({ stop, why: 'no customer on this stop' }); continue; }
    const mine = byCustomer.get(cid) ?? [];
    if (mine.length === 0) { unplaceable.push({ stop, why: "this customer's address hasn't been located yet" }); continue; }

    const want = normalizeAddressPart(stop.address_line1 ?? '');
    const match = want ? mine.find(a => normalizeAddressPart(a.line1 ?? '') === want) : undefined;
    if (match) { placed.push({ stop, point: { latitude: match.latitude, longitude: match.longitude }, basis: 'street-match' }); continue; }
    if (mine.length === 1) { placed.push({ stop, point: { latitude: mine[0].latitude, longitude: mine[0].longitude }, basis: 'only-address' }); continue; }
    // 🔴 SEVERAL ADDRESSES AND NONE MATCHES — refused by name. Picking one would give a
    // contractor's Leander pin to a Dripping Springs stop, and the plan would look fine.
    unplaceable.push({ stop, why: `this customer has ${mine.length} located addresses and none matches this stop's street` });
  }
  return { placed, unplaceable };
}
