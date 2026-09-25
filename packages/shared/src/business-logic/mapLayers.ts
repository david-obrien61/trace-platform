// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      The arithmetic behind the Map page's layers — which customers a date filter
//               admits, and which customers lie within X miles of a drawn route.
// DEPENDENCIES: business-logic/deliveryRings (distanceMiles — ONE distance function, not two).
// OUTPUTS:      purchaseCutoff() · WINDOW_PRESETS · distanceToPathMiles() · customersNearPath()
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 PROXIMITY IS WANTED NOW, AND IT WAS EXPLICITLY NOT WANTED BEFORE
// ═════════════════════════════════════════════════════════════════════════════
// David, 2026-08-24: *"i only want the display on the map with the icons"* — dots and filters, no
// distance math and no radius. David, 2026-09-25: *"over lay route delivery route (so we can see
// customers along the route or within x miles)"*. **That is a REVERSAL, and it is recorded here
// rather than quietly implemented**, because a reader who finds this file and remembers the 08-24
// ruling should see that it was superseded on purpose and by whom — not conclude that somebody
// built the thing that had been refused.
//
// ── ⚠️ THE MILES HERE ARE STRAIGHT-LINE, AND THAT IS A REAL LIMIT, NOT A DETAIL ──────────────
// "Within 2 miles of the route" means 2 miles as the crow flies from the driven LINE. A customer
// 1.5 straight-line miles away across a river with no bridge is not a 5-minute detour, and this
// cannot tell you that. The screen says "straight-line", the same as every other distance surface
// in the platform (`deliveryRings.ts` sets that rule). Road-network isochrones are a different
// API and a different decision.
//
// ── ⚠️ AND THE PROJECTION IS AN APPROXIMATION, STATED ─────────────────────────────────────────
// Distance from a POINT to a LINE on a sphere has no cheap exact form. This projects to a local
// flat plane centred on the segment (equirectangular, latitude-corrected) and does plane geometry
// there. Over the tens of miles a delivery route spans in Williamson County the error is far
// under a tenth of a mile — immaterial against a 2-mile filter whose own input is a round number
// somebody typed. It would NOT be acceptable for a continental route, and that is why it is
// written down instead of assumed.
// ─────────────────────────────────────────────────────────────────────────────
import { distanceMiles, type Point } from './deliveryRings';

// ── § the date window ───────────────────────────────────────────────────────────────────────

export type WindowPreset = '3m' | '6m' | '12m' | '24m' | 'all' | 'custom';

/** The presets David named, in the order he named them, newest window first. */
export const WINDOW_PRESETS: { value: WindowPreset; label: string }[] = [
  { value: '3m',  label: 'Last 3 months' },
  { value: '6m',  label: 'Last 6 months' },
  { value: '12m', label: 'Last 12 months' },
  { value: '24m', label: 'Last 2 years' },
  { value: 'all', label: 'All time' },
  { value: 'custom', label: 'From / to…' },
];

const MONTHS: Record<string, number> = { '3m': 3, '6m': 6, '12m': 12, '24m': 24 };

/**
 * The earliest purchase date a preset admits. `null` means NO lower bound (all time / custom).
 *
 * 🔴 IT SUBTRACTS MONTHS, NOT DAYS. "Six months" from 31 August is 28 February, not "183 days
 * ago" — and a customer whose last purchase falls in the two-day gap between those answers is a
 * customer who appears or vanishes depending on which arithmetic was used. Months is what a
 * person means by "the last six months", so months is what this does.
 */
export function purchaseCutoff(preset: WindowPreset, now: Date): Date | null {
  const months = MONTHS[preset];
  if (months === undefined) return null;
  // 🔴 `setMonth` ROLLS OVER, AND THE TEST CAUGHT ME USING IT BARE. Six months back from 31
  // August is 31 February, which JavaScript silently turns into **3 March** — so "the last six
  // months" would have quietly excluded everyone who bought on 1, 2 or 3 March while the screen
  // said six months. The window came out SHORTER than the words on the button, at every month
  // end, which is precisely when a person runs a report.
  // The day is clamped to the last day the target month actually has: 31 August → 28 February.
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() - months;
  const daysInTarget = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    y, m, Math.min(now.getUTCDate(), daysInTarget),
    now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds(),
  ));
}

// ── § distance from a point to the driven line ──────────────────────────────────────────────

const MILES_PER_DEGREE_LAT = 69.0546;

/**
 * Straight-line miles from a point to the NEAREST part of a path (a route drawn as a series of
 * points). Returns null when there is nothing to measure against.
 *
 * ⚠️ IT MEASURES TO THE LINE, NOT TO THE STOPS. Measuring to the stops would answer a different
 * and much less useful question: a customer halfway between two stops is beside the road the
 * truck drives and could be five miles from either stop.
 */
export function distanceToPathMiles(p: Point, path: readonly Point[]): number | null {
  if (path.length === 0) return null;
  if (path.length === 1) return distanceMiles(p, path[0]);
  let best = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const d = pointToSegmentMiles(p, path[i], path[i + 1]);
    if (d < best) best = d;
  }
  return Number.isFinite(best) ? best : null;
}

/** Point-to-segment, on a local flat plane. See the header for why this approximation is fair. */
function pointToSegmentMiles(p: Point, a: Point, b: Point): number {
  // Longitude degrees shrink towards the poles; correct at the segment's own latitude.
  const latRef = (a.latitude + b.latitude) / 2;
  const kx = MILES_PER_DEGREE_LAT * Math.cos((latRef * Math.PI) / 180);
  const ky = MILES_PER_DEGREE_LAT;
  const ax = a.longitude * kx, ay = a.latitude * ky;
  const bx = b.longitude * kx, by = b.latitude * ky;
  const px = p.longitude * kx, py = p.latitude * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  // A zero-length segment (the same point twice — routes do contain these) is just a point.
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  // How far along the segment the nearest point lies, clamped to the segment's ENDS — without
  // the clamp this would measure to the infinite line and report a customer as "near the route"
  // because they are near where the road WOULD go if it carried on past the last stop.
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// ── § who is near the route ─────────────────────────────────────────────────────────────────

export interface MapCustomer {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  [k: string]: unknown;
}

export interface NearRouteRow<T extends MapCustomer> { customer: T; miles: number }

export interface NearRouteResult<T extends MapCustomer> {
  /** Inside the corridor, NEAREST FIRST — the order a person would work the list in. */
  rows: NearRouteRow<T>[];
  /** 🔴 Counted, never placed. Customers with no coordinate cannot be near or far. */
  unlocated: number;
  /** Located, but outside the corridor. Reported so the list's size can be read honestly. */
  outside: number;
  message: string;
}

/**
 * The customers within `withinMiles` of the drawn route.
 *
 * 🔴 AN UNLOCATED CUSTOMER IS NOT A FAR ONE. They are counted separately and named on screen,
 * because "nobody lives near this route" and "we don't know where 900 of your customers are" are
 * opposite conclusions that an omitted row makes look identical (tech-debt #186's class).
 */
export function customersNearPath<T extends MapCustomer>(
  customers: readonly T[],
  path: readonly Point[],
  withinMiles: number,
): NearRouteResult<T> {
  const rows: NearRouteRow<T>[] = [];
  let unlocated = 0, outside = 0;
  for (const c of customers) {
    if (typeof c.latitude !== 'number' || typeof c.longitude !== 'number') { unlocated++; continue; }
    const miles = distanceToPathMiles({ latitude: c.latitude, longitude: c.longitude }, path);
    if (miles === null) { unlocated++; continue; }
    if (miles <= withinMiles) rows.push({ customer: c, miles });
    else outside++;
  }
  rows.sort((x, y) => x.miles - y.miles);

  const parts: string[] = [];
  if (path.length === 0) parts.push('No route drawn yet — pick a date and a crew');
  else parts.push(`${rows.length} customer${rows.length === 1 ? '' : 's'} within ${withinMiles} straight-line mile${withinMiles === 1 ? '' : 's'} of this route`);
  if (unlocated > 0) parts.push(`${unlocated} can't be placed yet`);
  return { rows, unlocated, outside, message: parts.join(' · ') };
}

// ═════════════════════════════════════════════════════════════════════════════
// WHO IS A DOT, AND WHAT COLOUR — the three statuses David named
// ═════════════════════════════════════════════════════════════════════════════
// David, 2026-08-24: *"filter on bought only, delivered only, planted those are the three current
// filters along with date."*
//
// 🔴 TWO OF THE THREE ARE FACTS AND THE THIRD IS A DERIVATION, AND THE SCREEN MUST SAY SO.
// `bought` is an order. `delivered` is a fulfilled delivery row. **`planted` is not stored
// anywhere in this platform** — there is no `planted_at`, no install-completion table, no
// per-tree planting record, and `orders.install_date` has never been written by anything. So
// `planted` is INFERRED here as *a completed delivery that was sold as planting work*, and it is
// labelled inferred wherever it is shown. Presenting a derivation as a record is how a map comes
// to be believed more than it has earned.
//
// ⚠️ `transport_method = 'install'` IS AN INTENT, NOT AN OUTCOME — it means *we sold an install*.
// That is why it is ANDed with completion rather than used alone: an install sold and not yet
// done is a customer who is waiting, not a customer whose trees are in the ground.

export type PurchaseStatus = 'bought' | 'delivered' | 'planted';

export interface OrderFact {
  customer_id: string | null;
  /** The invoice's own date, on imported/history orders. NULL on everything from checkout. */
  sale_date?: string | null;
  created_at?: string | null;
  status?: string | null;
  transport_method?: string | null;
  order_kind?: string | null;
}

export interface DeliveryFact {
  customer_id: string | null;
  status?: string | null;
  completed_at?: string | null;
  service_type?: string | null;
}

export interface CustomerSummary {
  customerId: string;
  /** EVERY purchase date, not only the newest — see `dotPasses` for why that matters. */
  purchases: string[];
  lastPurchase: string | null;
  orderCount: number;
  bought: boolean;
  delivered: boolean;
  /** 🔴 INFERRED. See the block above. */
  planted: boolean;
}

/** A completed delivery, by either signal. Mirrors `isDeliveryFulfilled` — the same five words. */
const DELIVERY_DONE = new Set(['fulfilled', 'delivered', 'complete', 'completed', 'done']);
function deliveryIsDone(d: DeliveryFact): boolean {
  if (d.completed_at) return true;
  return DELIVERY_DONE.has((d.status ?? '').toLowerCase());
}

/**
 * Roll a business's orders and deliveries up per customer.
 *
 * 🔴 `sale_date` FIRST, THEN `created_at` — and both are kept in play because neither is always
 * there. An order imported from QuickBooks carries the invoice's own date; an order rung up at
 * the counter carries only when the row was made. Using `created_at` alone would date every
 * historical invoice to the day it was imported, which would put two years of LAWNS's history on
 * one afternoon in September.
 *
 * ⚠️ CANCELLED AND TEST ORDERS ARE NOT PURCHASES. A cancelled order on the map is a customer who
 * did not buy, and a test order is not a customer at all.
 */
export function summariseCustomers(
  orders: readonly OrderFact[],
  deliveries: readonly DeliveryFact[],
): Map<string, CustomerSummary> {
  const out = new Map<string, CustomerSummary>();
  const get = (id: string): CustomerSummary => {
    let s = out.get(id);
    if (!s) { s = { customerId: id, purchases: [], lastPurchase: null, orderCount: 0, bought: false, delivered: false, planted: false }; out.set(id, s); }
    return s;
  };
  // Which customers were sold planting work — needed to infer `planted` when the delivery row
  // itself does not say (`service_type` is set on some stops and not others).
  const soldInstall = new Set<string>();

  for (const o of orders) {
    if (!o.customer_id) continue;
    if ((o.status ?? '').toLowerCase() === 'cancelled') continue;
    if ((o.order_kind ?? '') === 'test') continue;
    const when = o.sale_date ?? o.created_at ?? null;
    const s = get(o.customer_id);
    s.orderCount++;
    s.bought = true;
    if (when) {
      s.purchases.push(when);
      if (s.lastPurchase === null || when > s.lastPurchase) s.lastPurchase = when;
    }
    if ((o.transport_method ?? '') === 'install') soldInstall.add(o.customer_id);
  }

  for (const d of deliveries) {
    if (!d.customer_id) continue;
    if (!deliveryIsDone(d)) continue;
    const s = get(d.customer_id);
    s.delivered = true;
    if ((d.service_type ?? '') === 'planting' || soldInstall.has(d.customer_id)) s.planted = true;
  }
  return out;
}

export interface DotFilter {
  window: WindowPreset;
  /** Only read when `window === 'custom'`. ISO dates. */
  from?: string | null;
  to?: string | null;
  /** Empty means EVERY status — a filter nobody has touched hides nothing. */
  statuses: readonly PurchaseStatus[];
}

/**
 * Does this customer belong on the map under this filter?
 *
 * 🔴 IT ASKS WHETHER **ANY** PURCHASE FALLS IN THE WINDOW, NOT WHETHER THE LAST ONE DOES, and the
 * two are different questions. Somebody who bought in March and again last week belongs on both
 * the 3-month map and the 12-month map; reading only the newest purchase would answer *"who has
 * bought recently"* when the question behind the map is *"who could I ring"*. A from–to range
 * only makes sense read this way at all. ⚠️ **Recorded in the morning file as David's to overrule.**
 *
 * ⚠️ STATUSES ARE OR-ed, NOT AND-ed. Ticking "delivered" and "planted" means *either*, because a
 * person ticking two boxes on a map is widening what they can see, not narrowing it to the
 * intersection. Every planted customer is also delivered, so AND would make "planted" the only
 * thing either box could ever mean.
 */
export function dotPasses(s: CustomerSummary, f: DotFilter, now: Date): boolean {
  if (f.statuses.length > 0) {
    const anyStatus = f.statuses.some(st =>
      (st === 'bought' && s.bought) || (st === 'delivered' && s.delivered) || (st === 'planted' && s.planted));
    if (!anyStatus) return false;
  }
  if (f.window === 'all') return s.bought;
  if (f.window === 'custom') {
    const from = f.from ?? null, to = f.to ?? null;
    if (!from && !to) return s.bought;
    return s.purchases.some(p => (!from || p >= from) && (!to || p <= to));
  }
  const cutoff = purchaseCutoff(f.window, now);
  if (cutoff === null) return s.bought;
  const iso = cutoff.toISOString();
  return s.purchases.some(p => p >= iso.slice(0, 10) || p >= iso);
}
