/**
 * ── ROUTE HANDOFF — the one route that leaves the building ───────────────────────────────────
 *
 * PURPOSE      Turn the stops a manager is LOOKING AT into the artefacts a driver RECEIVES: the
 *              Google Maps URL, and the SMS body that carries it. One derivation, three consumers
 *              (Open in Google Maps · Text Route to Driver · Copy Route Link). Pure — an array in,
 *              a handoff out; no state, no clock, no supabase.
 * DEPENDENCIES none.
 * OUTPUTS      `RouteHandoff` — `{ url, stopCount, addresses }`. `url` is null when no stop has a
 *              usable address. `stopCount` counts THE STOPS IN THE URL, never the selection.
 *
 * 🔴 WHY THIS EXISTS — AND WHY IT IS A FILE RATHER THAN A FEW LINES OF JSX.
 * Reported live by David and Lauren 2026-09-08: Cultivar optimised the route, showed a changed
 * stop order, and then handed Google Maps the stops IN THE ORDER THEY WERE ENTERED. The cause was
 * structural, not arithmetic. `DeliveryRoute` stored the URL in state and built it inside
 * `buildRoute()` — at a moment when the optimised order did not yet exist, because the optimiser
 * runs asynchronously inside the map component that mounts AFTERWARDS — and nothing ever revisited
 * it. The screen read `routeSummary.orderedStops`; the link read a string frozen eight lines before
 * `setRouteSummary(null)` cleared the very thing it needed.
 *
 * So the defect fell EXACTLY along the line between the person who could see it and the person who
 * received it: pins ✅ optimised, on-card list ✅ optimised, link 🔴 entered, SMS 🔴 entered,
 * clipboard 🔴 entered. Lauren never opened what she sent; the installer had nothing to compare it
 * against. It survived fourteen months that way.
 *
 * ⚠️ WHY DERIVED AND NOT SYNCED (David's ruling, 2026-09-08 — option B, NOT option A):
 *   "Delete `routeUrl` as state and derive it from `displayStops`, so the link is structurally
 *    incapable of disagreeing with the list beside it. NOT option A — recomputing in an effect
 *    leaves two sources of truth, which is the mistake 420e0bc already made once."
 * Recomputing in an effect fixes today's symptom and leaves the next outbound surface free to wire
 * itself to the stale half. Derivation removes the stale half from existence. (§6 r8; STD-011.)
 *
 * 🔴 THE COUNT IS PART OF THE SAME DEFECT, WHICH IS WHY IT IS RETURNED HERE AND NOT COMPUTED BY A
 * CALLER. The SMS read `selectedOrders.length` while the card read the stop list, so selecting five
 * orders where two had no address texted "Today's delivery route (5 stops)" above a link containing
 * three. A count assembled separately from the thing it counts is the same bug in miniature:
 * `stopCount` here is `addresses`' own length, so it cannot drift from the URL beside it.
 *
 * ⚠️ NOT IN SCOPE, AND DELIBERATELY SO — THE WAYPOINT CAP. We emit the UNDOCUMENTED path form
 * `/maps/dir/A/B/C/`. Google's documented `?api=1` form caps waypoints at 9 (desktop) / 3 (mobile
 * browser) and IGNORES the excess silently. Measured from LAWNS's invoice export 2026-09-08: stops
 * per delivery day run 1–14, mean 3.6 — 41% of days exceed 3, 4% exceed 9 — and Lauren texts this
 * link to a phone. That is TRUNCATION, not mis-ordering; a driver would receive a partial route with
 * nothing saying so. It is REPORTED and awaiting David's decision, NOT fixed here: folding a URL-form
 * change into an ordering fix is how the one capability the customer uses daily gets two defects in
 * one diff. See docs/decisions/2026-09-08-maps-url-waypoint-cap-report.md.
 *
 * [TRACE:ROUTE] the caller emits on every derivation (STD-003, ON until owner-proven).
 */

/** A stop as the route screen holds it: what to call it, and where it is. */
export interface HandoffStop {
  label: string;
  address: string;
}

/**
 * Where the route starts and ends. `round_trip` (the default) bookends at the business address;
 * the other two are the declared seam from the original build and are not wired to a control yet.
 */
type EndpointMode = 'round_trip' | 'one_way' | 'custom_end';

interface RouteHandoff {
  /** The Google Maps URL, or null when no stop carries a usable address. */
  url: string | null;
  /** How many CUSTOMER STOPS the URL contains. Never the selection count. */
  stopCount: number;
  /** Every address in the URL, in URL order, origin bookends included. */
  addresses: string[];
}

/**
 * Join addresses into Google's directions path form, in the order given.
 *
 * Google preserves what it is handed — "Waypoints are displayed on the map in the same order they
 * are listed in the URL" (Maps URLs docs) — and offers no `optimize` parameter. So the order in
 * this array IS the order the driver drives. That is the whole reason it must come from the same
 * list the manager read.
 */
export function buildMapsUrl(addresses: string[]): string {
  const stops = addresses.map(a => encodeURIComponent(a)).join('/');
  return `https://www.google.com/maps/dir/${stops}/`;
}

/**
 * Derive the driver-facing route from the stops currently on screen.
 *
 * `stops` MUST be the same array the numbered list renders — optimised when Directions resolved,
 * built order when it did not. Passing anything else reintroduces the defect this file exists for.
 */
export function buildRouteHandoff(
  stops: HandoffStop[],
  origin: string,
  endpointMode: EndpointMode = 'round_trip',
): RouteHandoff {
  // A stop with no address cannot be driven to and must not be counted as though it could —
  // this filter is what keeps `stopCount` honest against a selection that includes blanks.
  const stopAddresses = stops
    .map(s => s.address.trim())
    .filter(a => a.length > 0);

  if (stopAddresses.length === 0) {
    return { url: null, stopCount: 0, addresses: [] };
  }

  const anchor = origin.trim();
  const addresses = [...stopAddresses];
  if (anchor) {
    addresses.unshift(anchor);                                // start at the farm
    if (endpointMode === 'round_trip') addresses.push(anchor); // …and return to it
  }

  return {
    url: buildMapsUrl(addresses),
    stopCount: stopAddresses.length,
    addresses,
  };
}

/**
 * The text Lauren sends the installer. Takes the WHOLE handoff, never a count and a URL separately —
 * the two disagreeing is precisely the defect (a text reading "(5 stops)" above a three-stop link).
 * Returns null when there is no route to send, so a caller cannot text an empty promise.
 */
export function driverSmsBody(handoff: RouteHandoff): string | null {
  if (!handoff.url) return null;
  const n = handoff.stopCount;
  return `Today's delivery route (${n} stop${n !== 1 ? 's' : ''}):\n${handoff.url}`;
}
