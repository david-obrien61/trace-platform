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

/**
 * 🔴 THE COLUMN LIST IS THE SOURCE AND THE SELECT IS DERIVED FROM IT (#179).
 * A ring read that types its own column list is a list that can silently disagree with the table —
 * which is exactly how `VENDORS_SELECT` came to name ten columns while its migration created
 * fourteen, and the four it missed were the address. One list, imported everywhere.
 */
export const DELIVERY_RING_COLUMNS = 'id, business_id, outer_radius_miles, charge, origin_note, active';

/**
 * THE YARD — the three columns every ring measurement starts from, on the `businesses` row.
 *
 * 🔴 THE DEPOT IS THE BUSINESS-PROFILE ADDRESS AND THERE IS NO SEPARATE SETTING (David,
 * 2026-09-24: *"one fact, one place"*). So this names columns on `businesses`, not on a depot
 * table that deliberately does not exist.
 * ⚠️ `geocode_status` IS IN THE LIST BECAUSE THE COORDINATE ALONE CANNOT BE TRUSTED. A row can
 * hold a stale or `confirm`-era latitude; only `found` means someone placed it. A read that took
 * the two numbers and skipped the verdict would measure rings from a pin nobody agreed to.
 * Same rule as DELIVERY_RING_COLUMNS above (#179): the list is the source, the select derives.
 */
export const BUSINESS_DEPOT_COLUMNS = 'latitude, longitude, geocode_status';

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
  /**
   * WHICH ring, counting from the yard — 1 is the innermost ACTIVE ring. Null when `ring` is null.
   *
   * 🔴 IT IS A POSITION, NOT AN IDENTITY, AND IT IS DERIVED EVERY TIME. Nothing stores it. Retire
   * the 10-mile ring and yesterday's "ring 4" becomes ring 3, because the owner's own list is what
   * the number counts — the same reason the bands are derived from the order rather than stored as
   * pairs. A stored ordinal would survive the edit that invalidated it.
   */
  ordinal: number | null;
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
    return { ring: null, ordinal: null, miles: null, message: "we don't know where this address is yet — check it" };
  }
  const active = orderedRings(rings);
  for (let i = 0; i < active.length; i++) {
    const r = active[i];
    if (miles <= r.outer_radius_miles) {
      return { ring: r, ordinal: i + 1, miles, message: `${miles.toFixed(1)} straight-line miles — inside your ${r.outer_radius_miles}-mile ring` };
    }
  }
  return { ring: null, ordinal: null, miles, message: `${miles.toFixed(1)} straight-line miles — outside your delivery rings, set a charge` };
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

// ═════════════════════════════════════════════════════════════════════════════
// THE TRIP CHARGE — what checkout bills for a delivery, once rings exist
// ═════════════════════════════════════════════════════════════════════════════
// David, 2026-09-23: *"the checkout Trip Charge reads the ring"*, and *"beyond the last ring →
// shown, not priced"*.
//
// 🔴 THREE OUTCOMES, AND THEY ARE NOT THE SAME THING. Collapsing any two of them is how a screen
// comes to state a number it cannot justify:
//   · a located address inside a ring          → that ring's charge
//   · a located address BEYOND the last ring   → NO charge, and a sentence. The owner has not
//     priced that distance; inventing one would read as a quote.
//   · NO RINGS CONFIGURED AT ALL               → this is NOT "beyond the last ring". The tenant
//     has not set up rings, so the flat offering that has always been charged still applies and
//     nothing changes. Treating an unconfigured tenant as "outside the area" would silently strip
//     every delivery charge LAWNS bills today.

export type TripChargeSource = 'ring' | 'flat-no-rings' | 'outside-rings' | 'unlocated';

export interface TripCharge {
  /** What to bill. Null means DO NOT BILL — and the reason is in `why`. */
  amount: number | null;
  source: TripChargeSource;
  /** What the screen says. Always present; a null amount is never silent. */
  why: string;
  /**
   * THE SHORT FORM FOR THE CHARGE LINE — `ring 4 — 30.4 mi`. Null for every source but `ring`.
   *
   * 🔴 IT IS A SECOND RENDERING OF `why`, NOT A SECOND FACT. Both are built from the one verdict
   * in the one place below, so they cannot disagree (STD-011's actual concern is two AUTHORS, not
   * two lengths). The line under a charge has room for six words; `why` is the sentence, this is
   * the chip that fits beside the money.
   *
   * ⚠️ THE CHIP SAYS `mi` AND THE SENTENCE SAYS `straight-line miles`, DELIBERATELY. The file
   * header requires every surface to say straight-line, and the chip is never shown alone — it
   * sits above `why`, which carries the word. A chip that tried to carry it would not fit, and a
   * chip that dropped the sentence would be the promise this file forbids.
   */
  label: string | null;
}

/**
 * Decide the trip charge.
 *
 * ⚠️ `flatAmount` IS WHAT THE TENANT ALREADY CHARGES (the `service_offerings` row). It is passed
 * in, never assumed, and it is what keeps this safe to ship BEFORE any ring exists.
 */
export function tripChargeFor(x: {
  depot: Point | null;
  address: Point | null;
  rings: readonly DeliveryRing[];
  /** The existing flat transport charge, used only when no rings are configured. */
  flatAmount: number | null;
  /** False when the address could not be placed — it is never priced (2026-09-18). */
  located: boolean;
}): TripCharge {
  const active = orderedRings(x.rings);

  if (active.length === 0) {
    return { amount: x.flatAmount, source: 'flat-no-rings', label: null,
      why: 'No delivery rings set up yet — your usual delivery charge applies.' };
  }
  // 🔴 UNPLACEABLE IS NEVER PRICED, and it is checked AFTER the no-rings case on purpose: a tenant
  // with no rings bills their flat rate as they always have, whether or not we could place the
  // pin. Ring pricing is what needs a location; a flat rate never did.
  if (!x.located) {
    return { amount: null, source: 'unlocated', label: null,
      why: "We can't place this address, so the delivery can't be priced by distance. Saved and flagged." };
  }
  const v = ringFor(x.depot, x.address, active);
  if (v.ring) {
    return { amount: v.ring.charge, source: 'ring',
      label: `ring ${v.ordinal} — ${v.miles?.toFixed(1)} mi`,
      why: `${v.miles?.toFixed(1)} straight-line miles — inside your ${v.ring.outer_radius_miles}-mile ring.` };
  }
  return { amount: null, source: 'outside-rings', label: null,
    why: 'Outside your delivery rings — set a charge.' };
}
