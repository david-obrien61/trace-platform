# The optimised route is lost at the handoff — RECON, NO BUILD

**Date:** 2026-09-08 · **Reported live by:** David + Lauren · **Type:** RECON (no code changed)
**Surface:** `packages/cultivar-os/src/pages/DeliveryRoute.tsx` (777 lines, the ONLY live route surface)

---

## VERDICT IN ONE LINE

🔴 **The optimisation and the handoff are two different collections, and only the screen reads the
optimised one.** The Google Maps URL is built at line **496**, inside `buildRoute()`, from the
entered order — **before the optimiser has run at all** — and it is **never rebuilt** when the
optimised order arrives. Google is not re-solving and not overriding us: it is faithfully rendering
exactly the un-optimised list we handed it.

---

## 1. WHERE THE OPTIMISATION RUNS, AND WHAT IT RETURNS

It runs **in the browser, inside the embedded map component**, not in the route builder.

`RouteMap` (`DeliveryRoute.tsx:155-337`) geocodes each address, then asks Google's
`DirectionsService` for a round-trip with `optimizeWaypoints: true` (`:246`) and reads back
Google's answer:

```ts
// :251
const order: number[] = (r.waypoint_order && r.waypoint_order.length) ? r.waypoint_order : wp.map((_, i) => i);
orderedStops = originPt ? order.map(i => wp[i]) : [stopPts[0], ...order.map(i => wp[i]), stopPts[stopPts.length - 1]];
```

**It returns a genuinely ordered array**, not a render-only sort. It is reported up to the parent
at `:301`:

```ts
orderedStops: usedDirections ? orderedStops.map(p => p.stop).filter((s): s is RouteStop => s !== null) : null,
```

`null` when Directions was skipped or failed — an honest "we did not optimise", not a silent
fall-through to entered order dressed as optimised.

**So the optimisation is real, the result is real, and it is a real array.** The defect is entirely
downstream of it.

---

## 2. HOW THE MAPS HANDOFF IS BUILT — AND WHICH COLLECTION IT ITERATES

**It iterates the ORIGINAL list.** `buildRoute()` (`:471-508`):

```ts
const stops = orders.filter(o => selected.has(o.id)).map(o => getAddress(o)).filter(Boolean);
...
const ordered = [...stops];
if (origin) { ordered.unshift(origin); if (endpointMode === 'round_trip') ordered.push(origin); }
setRouteUrl(buildMapsUrl(ordered));                                    // :496
```

and `buildMapsUrl` (`:48-51`) simply joins them in array order:

```ts
const stops = addresses.map(a => encodeURIComponent(a)).join('/');
return `https://www.google.com/maps/dir/${stops}/`;
```

🔴 **THE SEQUENCING MAKES IT UNFIXABLE IN PLACE.** `setRouteUrl` fires at `:496`. Three lines later,
`:504` sets `setRouteSummary(null)` — deliberately clearing the optimised result *"until RouteMap
reports the new Directions result"*. `RouteMap` only mounts **after** this state lands, then
geocodes and calls Google asynchronously. **The URL is constructed at a moment when the optimised
order does not yet exist**, and nothing ever revisits it. The screen reads the fresh value:

```ts
const displayStops = routeSummary?.orderedStops ?? routeStops;         // :530
```

The link reads the stale one (`:725` `href={routeUrl}`). One route, two collections.

🔴 **AND THE ORDER IN THE LINK IS NOT EVEN "ENTERED ORDER" IN ANY MEANINGFUL SENSE.** `orders` is
whatever the query returned: `.order('created_at', { ascending: false })` at `:441` in cart mode —
**newest order placed, first stop driven** — and `ascending: true` at `:403` in scheduled mode. The
driver's sequence is a bookkeeping artefact of when someone rang up a sale.

✏️ **A COMMENT AT `:484` STILL SAYS THE OPTIMISER DOESN'T EXIST**, fourteen months after it shipped:

> `•  stop-order OPTIMIZATION (reorder stops for shortest path) — deferred`

[[R-26]] in its usual form — a written declaration nobody checked against reality. It is a fair
reading of why this was never caught: anyone auditing `buildRoute()` finds a comment telling them
optimisation is out of scope here, and it was true when written.

**Git confirms the split was accidental, not a decision.** `420e0bc` (2026-07-01,
*"real driving route via Directions API — road-following, optimized, distance and time"*) touched
`DeliveryRoute.tsx` and **only** `DeliveryRoute.tsx`, 143 insertions — and its own message names
what it renumbered: *"optimizeWaypoints reorders stops shortest-path and renumbers markers + the
on-card list to match."* **Markers and the on-card list. Not the URL.** A diff of that commit
against `buildMapsUrl`/`setRouteUrl` returns one hit, and it is a context line.

---

## 3. DOES THE URL LET GOOGLE RE-SOLVE? — NO

**Checked against Google's own documentation, not from memory** (`developers.google.com/maps/documentation/urls/get-started`):

> "Waypoints are displayed on the map in the same order they are listed in the URL."

and there is **no `optimize` parameter documented** for the directions action. Our URL carries no
`data=`, no `dir_action`, nothing.

✅ **So the alternative hypothesis is dead: Google is not overriding our sort.** It is showing our
list, in our order, exactly as asked. That matters — it means the fix is entirely ours and needs no
API change, no key change, no new function.

⚠️ **A SECOND, SEPARATE RISK SURFACED WHILE CHECKING THIS. ✏️ IT IS NO LONGER UNMEASURED.** We use the
**undocumented path form** `/maps/dir/A/B/C/`, not the documented `?api=1&origin=…&waypoints=…`
form. The documented form states a cap of **9 waypoints on desktop and 3 on mobile browsers**, and
says excess *"will be ignored"* — silently. The path form's cap is not documented anywhere.
**Lauren texts the link to a driver who opens it on a phone**, which is precisely the platform with
the lowest documented ceiling.

✏️ **MEASURED 2026-09-08 by Lightning from LAWNS's own invoice export** (needed no credential):
stops per delivery day run **1 to 14, mean 3.6** — **69 of 167 days (41%) exceed 3**, and **7 of 167
(4%) exceed 9**. Busiest day: 14. **On four days in ten this is live, not hypothetical.**

🔴 **AND MY STATED REASON FOR NOT MEASURING IT WAS ITSELF FALSE — the finding turned on its author.**
I wrote that `SUPABASE_SERVICE_KEY` was *"empty in both env files."* It is **219 characters and
POPULATED in `packages/cultivar-os/.env.local`** — the file every script reads — and a live REST
read returns **HTTP 200**. Only the two ROOT files are empty. That was the **third occurrence of the
same stale claim in one day**, and it is [[R-26]] pointed at our own tooling: a written declaration
nobody checked, which talked a session out of a measurement it could have taken in thirty seconds.
Corrected at source in `docs/inventory-env.md` (a new file-by-file map) and in CLAUDE.md §3 #283(e).

This remains a *different* defect from the ordering one — truncation, not mis-sorting — and per
David's ruling it is **REPORTED, not folded into this build**.

---

## 4. WHAT THE INSTALLER ACTUALLY RECEIVES — ⚠️ THE ITEM DAVID FLAGGED AS MATTERING MOST

**Answer: it is NOT a third path. It is the second path, re-used verbatim — and that is worse news,
not better.** `textDriver()` (`:518-523`):

```ts
const count = selectedOrders.length;
const body  = `Today's delivery route (${count} stop${count !== 1 ? 's' : ''}):\n${routeUrl}`;
window.open(`sms:?body=${encodeURIComponent(body)}`);
```

`copyLink()` (`:511-516`) writes the same `routeUrl` to the clipboard.

**So the three renderings are two sources, not three:**

| Rendering | Source | Order |
|---|---|---|
| The numbered list on Lauren's screen (`:705`) | `displayStops` → `routeSummary.orderedStops` | ✅ **optimised** |
| The numbered pins on the embedded map (`:280`) | `orderedStops` | ✅ **optimised** |
| **"Open in Google Maps"** (`:725`) | `routeUrl` | 🔴 **entered** |
| **"Text Route to Driver"** (`:522`) | `routeUrl` | 🔴 **entered** |
| **"Copy Route Link"** (`:513`) | `routeUrl` | 🔴 **entered** |

🔴 **THE SPLIT FALLS EXACTLY ALONG THE LINE BETWEEN WHAT LAUREN SEES AND WHAT THE DRIVER GETS.**
Every surface that stays on her screen is right. Every surface that leaves the building is wrong.
That is why this survived — **the person who could see the defect never received the artefact that
carried it**, and the person who received it had nothing to compare it against. David's instinct
that only one of the three had ever been checked is right, and the reason is structural.

✏️ **A SECOND, SMALLER DEFECT IN THE SAME FOUR LINES.** The text says `selectedOrders.length` —
which does **not** filter for a usable address — while the card header says `routeStopCount`
(`:531`, `displayStops.length`), which does. Select five orders where two have no address and the
text reads *"Today's delivery route (5 stops)"* above a link containing three. The count the driver
reads is not the count of stops he was sent.

---

## THREE LENSES (§9 gate 10 / OP-8)

**HAVE** — a working optimiser whose answer reaches two on-screen renderings (`:530`, `:280`) and
none of the three outbound ones (`:725`, `:522`, `:513`); a URL frozen at `:496` before the answer
exists; a stale comment at `:484` asserting the optimiser was never built; a stop sequence
defaulting to `created_at DESC`; a stop count in the SMS that disagrees with the card.

**NEED** (irreducible — no preference) — the outbound URL must be derived from the same collection
the screen reads. Concretely: **rebuild `routeUrl` when `routeSummary.orderedStops` arrives**, and
keep the current value as the floor when it is `null` (Directions skipped/failed), because a route
in entered order is still better than no link. One derived value, three consumers unchanged.

**WANT** (labelled as want) — `routeUrl` stops being state at all and becomes a **derivation** of
`{displayStops, routeOrigin}`, so it is structurally incapable of disagreeing with the list beside
it; the SMS count derives from the same array; `:484`'s comment is corrected; and the handoff is
covered by an owner-test card that compares **the link's stop order against the screen's**, on a
phone, without a console (`DEVICE: phone`, OP-14).

**OPTIONS, NEED → WANT** — the call is David's, and the first two differ in whether the bug can
come back:

- **(A) Cheapest-meets-need.** Recompute `routeUrl` in an effect keyed on `routeSummary`. ~10 lines.
  Fixes all three outbound surfaces at once. 🔴 **Leaves two sources of truth** — the next person to
  add an outbound surface can still wire it to the stale one, which is exactly the mistake `420e0bc`
  made.
- **(B) Derive, don't sync (recommended).** Delete `routeUrl` as state; compute it from
  `displayStops` + `routeOrigin` at the point of use. The screen and the link become **two readings
  of one array**, and the defect class is closed rather than patched. Slightly larger diff, and it
  requires deciding what `!routeUrl` means for the "has a route been built" gate at `:667` — a real
  question, not a formality.
- **(C) B, plus the two adjacent findings.** B + the SMS count + the `:484` comment. Still one build.
- **(D) C, plus the waypoint-cap question.** ⚠️ **Do not bundle this.** It needs a measurement of
  LAWNS's real daily stop count first, and it may force a move to the documented `?api=1` URL form
  — a different change with a different blast radius, on the one capability the customer uses daily.

## WHAT I DID NOT DO

No code changed — this was RECON. No story cited: **no story on `user_stories.md` covers the route
handoff**, and I did not invent one; per the §9 story-reconciliation gate a story is owed before a
build spec is written for this. `docs/owner-tests/` holds three delivery boards
(`checkout-delivery-scheduling`, `delivery-fulfilment`, `qb-delivery-ingest`) and **none of them
covers the Maps handoff** — which is the coverage hole that let this ship.
