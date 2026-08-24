# PARKED SPEC — ROUTE-PROXIMITY SERVICE OPPORTUNITIES ("customers along this route")

**Date captured to the repo:** 2026-08-24 · **SHA:** `ebdb186` · **Type:** CAPTURE of a parked capability spec.
**No app code, no schema, no migration, no policy, no permission string, no cap. Nothing under `packages/`, `api/` or `supabase/` changes.**

**WHY THIS FILE EXISTS.** The most detailed specification of this capability lived in exactly ONE place on
David's machine — Claude Code's memory directory, `~/.claude/.../memory/project-proximity-opportunities.md`,
written **2026-05-29** — which is **outside version control**. A machine-wide search on 2026-08-24 found no
other copy: not in the repo, not in `docs/`, not in any other project folder. 🔴 **Its origin session
transcript (`6c29da11-748e-46fa-9158-5e7197c2d8ef`) is GONE from `~/.claude/projects/`, so the memory file
was the sole surviving artifact of the architecture conversation that produced it.**
`user_stories.md:239` CITES it as a grounding source — a board story pointing at a document no reader of the
repo could open. That is tech-debt **#63**'s class (*the artifact does not carry its own provenance*).
This file ends that: the substance is now in git, diffable and backed up.

---

## 1. WHERE IT LIVES NOW — the search result, stated plainly

| Location | In git? | Role |
|---|---|---|
| `~/.claude/projects/-Users-terrenceobrien-Desktop-trace-platform/memory/project-proximity-opportunities.md` | ❌ no | ORIGINAL, 1,613 bytes, 2026-05-29 |
| `…/memory/MEMORY.md:10` | ❌ no | one-line index pointer |
| `user_stories.md:231-240` | ✅ yes | the board story, one paragraph, cites the memory |
| **`docs/decisions/2026-08-24-route-proximity-opportunities-parked-spec.md`** | ✅ **yes** | **this file — the durable copy** |

The memory file is NOT deleted. It stays as the working note; this is the version-controlled record.

---

## 2. THE SPEC — reproduced VERBATIM from the memory file, not summarized

> During delivery routing (DeliveryRoute.tsx), query past customers within X miles of route stops. AI scores
> each by: warranty period active, services declined at checkout, large container purchase, time since last
> order. Lauren gets a notification: "You're 0.4 miles from Sarah K. (3 Bald Cypress, May 27, netting
> declined). Want to text her?"
>
> **Triggers:**
> - Customer within ~2 miles of a delivery stop
> - Warranty period active (within 6 months of purchase)
> - High-value purchase (15+ gal containers)
> - Declined a service at checkout (leakage_flag=true)
> - 30/60/90 day post-purchase anniversary
>
> **Data needed:** customers.address_line1/city/state/zip → geocoded lat/lng (or use Google Maps Distance
> Matrix API). Store geocoded coordinates on customers table as lat/lng columns.
>
> **AI role:** Given customer history + new service offerings, generate personalized outreach message.
> "Hi Sarah — you picked up 3 Bald Cypress in May. We're delivering nearby today. Want us to swing by and
> check on them?"
>
> **How to apply:** Build after delivery routing is fully tested. Requires geocoding customers (Google Maps
> API or similar) or using address string matching. Architecture session before build.
>
> Related: [[project-service-offerings]], [[project-partner-referral-network]]

---

## 3. THE BOARD STORY IT GROUNDS — `user_stories.md:231`

*"See the opportunity along the route — service overlay on the map"*

```
STATUS: needs-input          ARC: delivery       MAPS-TO: 3.5, 3.2
PIECES: service_overlay, proximity_opportunity
NEEDS: David to scope what the overlay surfaces — past customers near today's
       stops (warranty / upsell / inspection) vs due-services vs both — and
       whether it's a passive readout or a suggested add-stop.
```

**TILE HOME:** `opportunities` (surface-while-driving-past) + `followup_engine` (the outreach leg) —
both `status: 'planned'`, no route or component, `tileRegistry.ts:259-262`.

---

## 4. AS-BUILT STATE — measured 2026-08-24, and it CORRECTS the memory note's premise

The memory note (2026-05-29) and the `2026-06-25-routing-seeder-seam-recon.md` finding (*"GEOCODE PRESENCE
— is any geocoding present? NO"*) are both **now partially stale**. What changed: `DeliveryRoute` gained a
real Google Maps integration. What did NOT change: nothing is ever persisted.

| Piece | State | Evidence |
|---|---|---|
| Route builder | BUILT | `DeliveryRoute.tsx:467-500` — `buildRoute()`, stops = orders/deliveries ALREADY selected |
| Map render | BUILT | `DeliveryRoute.tsx:150-260` — `RouteMap`, Directions API, numbered pins |
| Stop sources | BUILT | `:391` `deliveries` (?date=) · `:429` `orders` where `transport_method='delivery'` |
| **A geocoder** | ✅ **NOW EXISTS** | `DeliveryRoute.tsx:187-203`, Maps JS `importLibrary('geocoding')`, key `VITE_GOOGLE_MAPS_API_KEY` |
| **Persisted customer coordinates** | 🔴 **ABSENT** | ZERO `lat`/`lng`/`latitude`/`longitude`/`geography` columns in ALL of `supabase/migrations/` |
| Proximity query | 🔴 **ABSENT** | nothing queries customers by distance to a route or stop |
| Offer/campaign tied to a customer | 🔴 **ABSENT** | no table keys an offering or campaign to a `customer_id` |

🔴 **THE PRECISE GAP, AND IT IS NARROWER THAN THE MEMORY NOTE ASSUMED.** `RouteMap` geocodes each stop
address **transiently, in the browser, to draw the polyline — then discards the coordinates.** A geocoder
and a funded key are no longer the blocker. The blocker is that **no coordinate is ever written down**, so
there is nothing to measure a distance against.

**Two other things the memory note could not have known:**
- `service_offerings` (`20260529_businesses_f_service_offerings.sql:10`) already carries `category` including
  `maintenance`/`inspection` and `timing` including `post_purchase`/`recurring`. **Fertilizer fits its shape
  with zero migration** — what it lacks is any link to a customer.
- `campaigns.target_category` (`20260529_campaigns.sql:12`) is a **product** category, not an audience.

---

## 5. WHAT IS OWED, IN ORDER

1. 🔴 **DAVID'S SCOPING CALL — the story's own `NEEDS:` line.** Past customers near today's stops vs
   due-services vs both; passive readout vs suggested add-stop. **This is the block. It is not engineering.**
2. **A migration: persist coordinates on `customers`** (lat/lng columns + geocode-at-capture).
   ⚠️ **The data-quality trap is already documented** — `2026-06-25-address-spine-defect-recon.md`:
   `businesses.address` was a bare street line with no city/state/zip, and Google snapped an ambiguous valid
   address to the wrong town (the San Marcos mis-geocode). **Any stored coordinate must be geocode-VERIFIED,
   not merely plausible.** ⚠️ Note `customers` has **no `CREATE TABLE` migration at all** — tech-debt #39's
   live-schema-only class — so the migration must reckon with that first.
3. **The proximity read + scoring**, then the overlay, then the outreach leg.
4. ⚠️ **FUNCTION THRIFT (§6 r11) — `api/` is at 12 of 12, ZERO headroom.** A proximity query MUST ride an
   existing endpoint (`dashboard.ts` is the natural seam). **Minting #13 is a silent deploy failure**, not an
   error — STOP-and-surface, never silent.

---

## 6. THE PROCESS FINDING, WORTH MORE THAN THE CAPABILITY

**A board story cited a source that only one machine could open, and the conversation that produced it has
since been deleted.** The story survived; its substance survived only by luck. Anything the board cites as
`_Grounded:_` must resolve to something in the repo — a memory note is a working aid, never a citation
target. Related, unfixed: nothing sweeps `user_stories.md` groundings for reachability.

_Related: `project-service-offerings`, `project-partner-referral-network` (both also memory-only)._
