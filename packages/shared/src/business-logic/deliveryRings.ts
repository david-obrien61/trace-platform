// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      The delivery rings — which ring an address falls in, what that ring charges,
//               and what the history PROPOSES when a tenant has no rings yet.
// DEPENDENCIES: none. Pure arithmetic and pure decisions; the map draws what this returns.
// OUTPUTS:      ringFor() · proposeRingsFromCharges() · distanceMiles() · ringSummary().
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 BEYOND THE LAST RING: SHOW, DON'T PRICE (David, 2026-09-23)
// ═════════════════════════════════════════════════════════════════════════════
// There is no "everywhere else" ring and no default charge. An address outside every ring
// returns `{ ring: null }` and the screen says *"outside your delivery rings — set a charge"*.
// Inventing a number for a place the owner has not priced is precisely the guess 2026-09-18
// forbids, and it is worse here than elsewhere because it would look like a quote.
//
// ── 🔴 THESE ARE STRAIGHT-LINE MILES AND EVERY SURFACE MUST SAY SO ──────────────────────────
// `distanceMiles` is a great-circle distance: the crow's flight from the depot, not the road.
// A truck drives further than this, always — around a lake, down a county road, onto the one
// bridge. Calling it "miles" on a screen without the word "straight-line" would be a promise
// the number cannot keep, and a trip charge derived from it would under-price every awkward
// address in the county. Road distance is a different API and a different decision; until it is
// taken, the honest surface names what it measured.
//
// ── ⚠️ WHAT A "LOADED MILE" MEANS IS AN OPEN QUESTION, AND THIS FILE DOES NOT ANSWER IT ─────
// `docs/RULINGS.md` carries *"the definition of a loaded mile"* and *"ring radii"* in the OWED
// queue — David's, unanswered. $3.50 is his rate (2026-09-12); whether it is charged on the
// miles out or on the round trip is NOT settled. So `chargeAt` takes the trip basis as an
// ARGUMENT and the widget shows BOTH figures side by side, which is what David asked for. A
// default picked here would answer his question in code, which step 10 forbids by name.
// ─────────────────────────────────────────────────────────────────────────────

export interface DeliveryRing {
  id?: string;
  outer_radius_miles: number;
  charge: number;
  origin_note?: string | null;
  active?: boolean;
}

export interface Point { latitude: number; longitude: number }

const EARTH_MILES = 3958.7613;
const rad = (d: number) => (d * Math.PI) / 180;

/**
 * Great-circle distance in miles. 🔴 STRAIGHT-LINE — see the header. Returns null when either
 * point is missing, because "0 miles" and "we don't know" must never be the same value.
 */
export function distanceMiles(a: Point | null | undefined, b: Point | null | undefined): number | null {
  if (!a || !b) return null;
  if (!Number.isFinite(a.latitude) || !Number.isFinite(a.longitude)) return null;
  if (!Number.isFinite(b.latitude) || !Number.isFinite(b.longitude)) return null;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_MILES * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The active rings, smallest first. Bands are DERIVED from this order — never stored as pairs. */
export function orderedRings(rings: readonly DeliveryRing[]): DeliveryRing[] {
  return rings.filter(r => r.active !== false).sort((x, y) => x.outer_radius_miles - y.outer_radius_miles);
}

export interface RingVerdict {
  /** The ring this address falls in, or null when it is beyond the last one. */
  ring: DeliveryRing | null;
  /** Straight-line miles from the depot, or null when the address has no coordinate. */
  miles: number | null;
  /** What the screen says. Never a number when `ring` is null. */
  message: string;
}

/**
 * Which ring is this address in?
 *
 * 🔴 AN ADDRESS WITH NO COORDINATE IS NOT "OUTSIDE" — IT IS UNKNOWN, AND THEY READ DIFFERENTLY.
 * "Outside your rings" tells the owner to set a charge for a place they can see. "We don't know
 * where this is" tells them to check the address. Collapsing the two would send someone hunting
 * for a ring when the real problem is a typo.
 */
export function ringFor(
  depot: Point | null | undefined,
  address: Point | null | undefined,
  rings: readonly DeliveryRing[],
): RingVerdict {
  const miles = distanceMiles(depot, address);
  if (miles === null) {
    return { ring: null, miles: null, message: "we don't know where this address is yet — check it" };
  }
  for (const r of orderedRings(rings)) {
    if (miles <= r.outer_radius_miles) {
      return { ring: r, miles, message: `${miles.toFixed(1)} straight-line miles — inside your ${r.outer_radius_miles}-mile ring` };
    }
  }
  return { ring: null, miles, message: `${miles.toFixed(1)} straight-line miles — outside your delivery rings, set a charge` };
}

/**
 * What a ring charges, and what the rate implies at both readings of a loaded mile.
 * ⚠️ The basis is the CALLER's, not this file's — see the header. Nothing is defaulted.
 */
export function impliedMiles(charge: number, ratePerMile: number, basis: 'one-way' | 'round-trip'): number | null {
  if (!Number.isFinite(charge) || !Number.isFinite(ratePerMile) || ratePerMile <= 0) return null;
  const loaded = charge / ratePerMile;
  return basis === 'round-trip' ? loaded / 2 : loaded;
}

export interface ChargeObservation { charge: number }
export interface ProposedRing { outer_radius_miles: number; charge: number; origin_note: string; invoices: number }

/**
 * Propose rings from what the tenant ACTUALLY CHARGED — the seed the widget offers.
 *
 * 🔴 A PROPOSAL IS NOT A DECISION, AND THE `origin_note` IS WHAT KEEPS THEM APART. Every ring
 * this returns carries "seeded from N invoices" so the owner reads a history, not a ruling.
 * Nothing here is written; the widget shows these and a person saves them.
 *
 * ⚠️ IT DERIVES THE RADIUS FROM A CHARGE, WHICH ASSUMES THE RATE HELD. Deriving it from the
 * DISTANCE measures what actually happened, and that needs the bulk geocode to have run. Until
 * it has, the note must say which of the two this came from — arithmetic dressed as history is
 * the lie this whole build exists to prevent.
 */
export function proposeRingsFromCharges(
  observations: readonly ChargeObservation[],
  ratePerMile: number,
  basis: 'one-way' | 'round-trip',
  minInvoices = 5,
): ProposedRing[] {
  const counts = new Map<number, number>();
  for (const o of observations) {
    if (!Number.isFinite(o.charge) || o.charge <= 0) continue;
    counts.set(o.charge, (counts.get(o.charge) ?? 0) + 1);
  }
  const out: ProposedRing[] = [];
  for (const [charge, invoices] of counts) {
    if (invoices < minInvoices) continue;      // one odd invoice is not a delivery area
    const miles = impliedMiles(charge, ratePerMile, basis);
    if (miles === null || miles <= 0) continue;
    out.push({
      outer_radius_miles: Math.round(miles * 10) / 10,
      charge,
      origin_note: `seeded from ${invoices} invoice${invoices === 1 ? '' : 's'} — from the CHARGE, not a measured distance`,
      invoices,
    });
  }
  return out.sort((a, b) => a.outer_radius_miles - b.outer_radius_miles);
}

// ═════════════════════════════════════════════════════════════════════════════
// THE SERVICE AREA — what a DELIVERY address field is allowed to offer
// ═════════════════════════════════════════════════════════════════════════════
// David, 2026-09-24: *"shouldn't the radius map be the boundary so PA and WV don't show up?"*
// Yes — for a SHIP-TO. Measured that day, typing `101 Crupp` (a real Liberty Hill delivery)
// offered Austin TX, two West Virginia streets and two Kentucky ones. None of those is a place
// LAWNS delivers to, and the right answer was not in the list at all.
//
// 🔴 RESTRICTION IS FOR DELIVERY ADDRESSES ONLY. A billing address, a contact's address and a
// vendor's address can legitimately be anywhere — a tenant buys from out of state. Restricting
// those would be a worse defect than the one it fixes, because it would make correct addresses
// impossible to enter rather than merely rank them low.
//
// 🔴 AND THE RADIUS IS NEVER INVENTED. It comes from the tenant's own outer ring, or from their
// own delivery history, or it does not exist and the field falls back to BIAS. A made-up boundary
// would silently refuse real customers — the opposite failure, and a harder one to notice.

export type ServiceAreaSource = 'ring' | 'seeded' | 'none';

export interface ServiceArea {
  /** Miles from the depot, or null when there is nothing honest to say. */
  radiusMiles: number | null;
  source: ServiceAreaSource;
  /** Where the number came from, in words, for the screen. */
  note: string;
}

/**
 * Resolve the area a delivery address field may offer from, in order of authority.
 *
 * ① THE OUTER RING — the owner said where they deliver. Nothing beats that.
 * ② SEEDED FROM HISTORY — the farthest place they have actually delivered, plus a margin, marked
 *    as seeded so a proposal never reads as a decision.
 * ③ NOTHING — and the field uses BIAS instead. 🔴 Measured 2026-09-24: LAWNS has 0 of 66 stops
 *    and 0 of 1,497 addresses carrying a coordinate, so ② is not computable yet and today the
 *    honest answer really is ③. It becomes computable when the bulk geocode runs.
 *
 * ⚠️ THE MARGIN IS THE CALLER'S, not a constant here. A boundary drawn exactly at the farthest
 * past delivery refuses the next customer one street beyond it — the first person to live further
 * out than anyone so far is a SALE, not an error.
 */
export function resolveServiceArea(x: {
  rings: readonly DeliveryRing[];
  /** Straight-line miles to each located past delivery. Empty until the geocode has run. */
  deliveredMiles?: readonly number[];
  marginMiles: number;
}): ServiceArea {
  const ordered = orderedRings(x.rings);
  if (ordered.length > 0) {
    const outer = ordered[ordered.length - 1].outer_radius_miles;
    return {
      radiusMiles: outer + x.marginMiles,
      source: 'ring',
      note: `your ${outer}-mile delivery area, plus ${x.marginMiles} miles`,
    };
  }
  const real = (x.deliveredMiles ?? []).filter(m => Number.isFinite(m) && m > 0);
  if (real.length > 0) {
    const farthest = Math.max(...real);
    return {
      radiusMiles: Math.round((farthest + x.marginMiles) * 10) / 10,
      source: 'seeded',
      note: `seeded from ${real.length} past deliver${real.length === 1 ? 'y' : 'ies'} — farthest ${farthest.toFixed(1)} miles, plus ${x.marginMiles}`,
    };
  }
  return {
    radiusMiles: null,
    source: 'none',
    // Said plainly, because a field that quietly stops restricting looks like one that is.
    note: 'no delivery area set yet — suggestions are ranked near you, not limited',
  };
}
