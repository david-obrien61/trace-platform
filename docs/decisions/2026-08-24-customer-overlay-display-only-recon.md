# RECON — THE CUSTOMER OVERLAY ON THE DELIVERY MAP (DISPLAY-ONLY). LOOK ONLY.

**Date:** 2026-08-24 · **Branch:** `main` · **HEAD at start:** `aaf741c` · **Type:** RECON, read-only.
**No app code, no schema, no migration, no policy, no permission string, no cap.**
**Zero diff under `packages/` · `api/` · `supabase/`.** `npm run verify` exit 0, zero net-new (5 / 247 / 10 / 12 / 15).
**GATE 0 NOT APPLICABLE — nothing ships.** All `[TRACE:*]` untouched and ON.

---

## 0. THE SCOPE DAVID RULED — QUOTED, NOT PARAPHRASED

> "i only want the display on the map with the icons. this map should display all customers, then filter by
> date purchased, (date), that will give a range. need is their customer list to test against. will need that
> imported into test david before we can verify the test accuracy. but we can build the customer overlay which
> is just an overlay list all customer, filter on bought only, delivered only, planted those are the three
> current filters along with date"

**This ANSWERS the `NEEDS:` line at `user_stories.md:231` and NARROWS the story.** Passive readout, not a
suggested add-stop. CUSTOMER overlay, not a SERVICE overlay. Display and filter — **no distance math, no
proximity scoring, no radius.** No proximity was reconned; no distance query was costed.

🔴 **AND THE FIRST CONSEQUENCE IS THAT IT RETIRES TWO ITEMS FROM A LIST WRITTEN THIS MORNING.**
`docs/decisions/2026-08-24-route-proximity-opportunities-parked-spec.md` §5 — captured today at `ebdb186` —
lists what is owed *in order*: (1) David's scoping call, (2) **a migration persisting coordinates on
`customers`**, (3) the proximity read + scoring. **David has now made (1), and it deletes (2) and (3) from
this build's path rather than sequencing them.** That owed-list was written for the PROXIMITY capability. The
display-only capability is a different, much smaller thing, and R3 below is the proof.

---

## 1. THE THREE LENSES

### HAVE
A working, single-purpose map. `RouteMap` (`packages/cultivar-os/src/pages/DeliveryRoute.tsx:152`) geocodes an
ordered stop list in the browser, asks Directions for a driving route, draws numbered pins, and **discards
every coordinate**. It is the only map in the repository. Customer addresses live in structured columns with
no coordinates anywhere. Order facts sufficient to derive *bought / delivered / planted* exist — in two
different tables, with one of the three meaning something narrower than it sounds.

### NEED (irreducible minimum to meet what David asked for)
Customer pins on the existing map, three status filters, a date range. That requires: a customer read (exists),
an order-fact roll-up per customer (exists, two sources), an address→pin step (exists, transiently), and a
marker layer the existing map does not have. **It does not require a migration, a backfill, a new `api/`
function, or a permission string.**

### WANT (labelled as want)
Persisted, precision-tagged coordinates on `customers`, so filtering and panning never re-geocode, quota is a
one-time cost, an uncertain pin stays uncertain across sessions, and anything proximity-shaped later has
something to measure against. **This is the right destination and it is outside what David ruled.**

---

## R1 — CAN THE THREE STATUS FILTERS BE DERIVED FROM DATA THAT EXISTS TODAY?

**Verified against source, not confirmed against the suspicion. Two of the three suspicions did not survive.**

### BOUGHT — ✅ YES, cleanly.
`orders.customer_id` is a direct FK; the per-customer order read already exists at
[CustomerDetail.tsx:87-95](../../packages/cultivar-os/src/pages/CustomerDetail.tsx#L87-L95). "An order exists
for the customer" is exactly right. (Excluding `status='cancelled'` is a judgement — the delivery-route query
already does it, [DeliveryRoute.tsx:437](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L437).)

### DELIVERED — ⚠️ DERIVABLE, BUT THE PROPOSED PREDICATE UNDER-COUNTS, AND THE WORD MEANS SOMETHING WEAKER THAN IT SOUNDS.

**The suspicion was `orders.transport_method='delivery'`. That is a strict subset of what was meant.**

The column's CHECK is `['self','delivery','install']`
([20260715_orders_status_drop_check.sql:46](../../supabase/migrations/20260715_orders_status_drop_check.sql#L46)),
and the value is DERIVED at write time by `deriveTransportMethod`
([submit.ts:166-172](../../packages/cultivar-os/api/orders/submit.ts#L166-L172)):

| branch | writes | meaning |
|---|---|---|
| `transport_mode === 'self'` | `'self'` | customer hauls it — **not delivered** |
| planting selected | `'install'` | **delivered AND planted** |
| fused per-plant staff row | `'install'` | **delivered AND planted** (legacy shape) |
| otherwise | `'delivery'` | **delivered, not planted** |

🔴 **So `'delivery'` means *delivered WITHOUT planting*. An `install` order is also a delivered order.**
Filtering `= 'delivery'` silently omits exactly the planted population. The honest predicate is
`transport_method IN ('delivery','install')`.

⚠️ **This is a live inconsistency, not just a note for this build:** the delivery route's own stop query is
`.eq('transport_method', 'delivery')`
([DeliveryRoute.tsx:436](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L436)) — **so an order that
LAWNS is delivering AND planting does not appear on the delivery route today.** Found while answering this
question, out of this build's scope, **named not fixed.**

🔴 **And the deeper half: "delivered" is INTENT AT SALE, never an event.**
- `deliveries.status` defaults `'scheduled'`
  ([20260620_deliveries.sql:35](../../supabase/migrations/20260620_deliveries.sql#L35), AC-4, no CHECK) and the
  migration's own header names the intended vocabulary *"scheduled → out_for_delivery → delivered"*. **The
  string `'delivered'` does not appear anywhere in `packages/cultivar-os` or `packages/shared`.** Nothing ever
  advances it. Every delivery row in the platform reads `scheduled` forever.
- `orders.status` is `pending | confirmed | fulfilled | cancelled`
  ([orderStatus.ts:14](../../packages/cultivar-os/src/lib/orderStatus.ts#L14)) and the file's own header says
  the set is **RATIFICATION-PENDING** (R-STATUS, still OWED — `RULINGS.md:178`). `fulfilled` is order-wide, not
  delivery-specific.

**So a "delivered" filter can honestly mean *sold as a delivery*. It cannot mean *the truck arrived*, and the
label must not imply that it does** (§6 r18 — a header is a claim).

### PLANTED — ✅ DERIVABLE, BUT NOT THE WAY SUSPECTED, AND IT LIVES IN TWO DISJOINT PLACES.

🔴 **The suspected `service_type='planting'` inference from the invoice/delivery loop does not exist on the
order path.** `service_offerings` carries `category` / `timing` / `price_type` / `price_unit` /
`transport_mode` ([20260529_businesses_f_service_offerings.sql:18-38](../../supabase/migrations/20260529_businesses_f_service_offerings.sql#L18-L38))
and **has no `service_type` column at all**. `transport.ts` classifies services **by SHAPE, never by name** —
its own header says so ([transport.ts:9-12](../../packages/cultivar-os/src/lib/transport.ts#L9-L12)). There is
no planting flag to read on an order.

**① The order-path predicate is `orders.transport_method = 'install'`** — and the platform already uses it that
way: [Dashboard.tsx:195](../../packages/cultivar-os/src/pages/Dashboard.tsx#L195) is
`.eq('transport_method', 'install')`.

**② A SECOND, DISJOINT SOURCE EXISTS AND IS EASY TO MISS.** `deliveries.service_type` **is** real —
`'planting' | 'delivery_only'`, AC-4 no CHECK
([20260620_deliveries_service_type.sql:22](../../supabase/migrations/20260620_deliveries_service_type.sql#L22)) —
and it is rendered as a badge at
[DeliverySchedule.tsx:273-280](../../packages/cultivar-os/src/pages/DeliverySchedule.tsx#L273-L280).
🔴 **But its ONLY writer is [api/customers/create.ts:119](../../packages/cultivar-os/api/customers/create.ts#L119)
— the OCR-invoice → "Schedule delivery" path.** A checkout order never writes it; an OCR-scheduled delivery
never writes `orders`.

**So the platform holds two populations of planted work, in two tables, with two different columns, and
nothing joins them.** `deliveries.customer_id` and `orders.customer_id` both point at `customers`; there is no
`order_id` on `deliveries` and no delivery reference on `orders`. A "planted" filter that reads only one source
is wrong for whichever population it omits — and which one that is depends on how LAWNS actually works.

### MUTUALLY EXCLUSIVE? — 🔴 NO, IN THREE SEPARATE WAYS. THIS CHANGES THE UI.

1. **Per order:** `install` ⊇ delivered. A planted order **is** a delivered order. The sets nest.
2. **Per customer:** three orders across three years can be one self-haul, one delivery, one install. The
   customer is all three at once.
3. **Cross-table:** the same customer can hold an `orders` row and an unrelated `deliveries` row.

⚠️ **David's phrasing — *"bought only, delivered only, planted"* — reads as a single-select radio, and the data
cannot honour that.** Either the filters are **additive checkboxes** (a customer shows if they match ANY
checked filter, or ALL — itself a choice), or "only" has to mean something explicit and narrow
(*delivered and never planted*), which is a different and more surprising question. **This is a design
decision the data forces, and it is flagged rather than resolved here.**

---

## R2 — DATE PURCHASED: WHICH COLUMN, ONE DATE OR MANY?

**The column is `orders.created_at`.** It is the only purchase date on the platform — read at
[Orders.tsx:50](../../packages/cultivar-os/src/pages/Orders.tsx#L50) and
[CustomerDetail.tsx:90](../../packages/cultivar-os/src/pages/CustomerDetail.tsx#L90), both ordered descending.
There is no `purchased_at`, no `sold_at`, no `order_date`.

⚠️ **`customers.created_at` is a DIFFERENT date and is the trap.** It is when the customer ROW was made, and it
is what the roster sorts by ([Customers.tsx:128](../../packages/cultivar-os/src/pages/Customers.tsx#L128)).
Filtering on it answers *"when did we meet them"*, not *"when did they buy"* — and for a customer captured at
checkout the two coincide, which is exactly what would make the bug invisible in testing.

### 🔴 "DATE PURCHASED" IS NOT UNAMBIGUOUS. IT IS A CHOICE DAVID HAS TO MAKE.

A customer with three orders has three `created_at` values. Three readings, all legitimate, all producing a
**different set of pins from the same date range**:

| reading | predicate | the question it answers |
|---|---|---|
| **ANY-IN-RANGE** | `EXISTS (order WHERE created_at BETWEEN a AND b)` | *"who bought from us in spring"* |
| **LATEST** | `MAX(created_at) BETWEEN a AND b` | *"who hasn't bought since X"* — the lapsed-customer read |
| **EARLIEST** | `MIN(created_at) BETWEEN a AND b` | *"who became a customer that season"* — acquisition |

✏️ **RECOMMENDATION, offered not taken: ANY-IN-RANGE as the default**, because it is the only one that never
surprises — a customer who bought inside the window appears, full stop. **But whichever is chosen must be
stated on the screen**, not implied by a label reading "date purchased". Two of the three readings are
genuinely useful to Lauren and they are not the same feature.

⚠️ **A third date exists and may be the one Lauren actually means for the delivered filter:**
`deliveries.delivery_date` ([20260620_deliveries.sql:32](../../supabase/migrations/20260620_deliveries.sql#L32)),
which is when the truck was scheduled to go — not when the money changed hands.

---

## R3 — 🔴 CAN CUSTOMER PINS RIDE THE EXISTING TRANSIENT GEOCODER? THE LOAD-BEARING QUESTION.

### (a) Exactly how the geocoding is invoked

`geocode()` is a **closure defined inside `RouteMap`'s effect**
([DeliveryRoute.tsx:189-195](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L189-L195)), over a
`Geocoder` constructed three lines above at `:187` from `maps.importLibrary('geocoding')`. It takes a plain
address **string** and resolves `results[0].geometry.location`.

**It is not exported, it is not a module-level helper, and there is nothing like it in `packages/shared`.**
So: the **CALL** generalises trivially — the Geocoder accepts any address string and knows nothing about
deliveries. The **CODE** does not generalise at all: there is nothing to import, and every caller would either
re-implement it or the function would have to be lifted out. That lift is small and is real work.

### (b) Batched? Rate-limited? Quota-bounded?

**Not batched — one call per address, all fired at once.**
[`:203`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L203):
`const located = await Promise.all(points.map(async p => ({ ...p, loc: await geocode(p.address) })))`.
N addresses ⇒ **N concurrent Geocoding requests**.

🔴 **No rate limit, no concurrency cap, no debounce, no retry, no backoff — anywhere in the file.** And the
status check is `if (gcStatus === 'OK' && results && results[0])` ([`:191`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L191)),
so **`OVER_QUERY_LIMIT` is not handled**: a throttled response falls into the identical `else` branch as a
genuine address miss.

The only bounds that exist anywhere near this are **row limits on the queries that feed it**, and none of them
is a geocoding limit: `.limit(50)` on the dated-deliveries mode
([`:400`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L400)), `.limit(30)` on the cart-order mode
([`:439`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L439)), and the `wpCount <= 25` **Directions**
skip ([`:229`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L229)) which does not gate geocoding at all.
**A customer roster is bounded by none of them.**

⚠️ **Related and worth one line: `VITE_GOOGLE_MAPS_API_KEY` is NOT listed in `docs/inventory-env.md`** — the
doc CLAUDE.md §2 calls **canonical and a superset**. That file lists 28 variables and this is not one of them,
though the key is named in four other docs. **The map's own key is missing from the platform's canonical env
inventory. Named, not fixed** — it is a doc gap, not this build's subject.

### (c) What happens today when a stop address fails to geocode

🔴 **SILENT DROP.** `resolve(null)` ([`:192`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L192)) →
`const good = located.filter(p => p.loc)` ([`:206`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L206))
→ the point never enters the marker loop or `bounds`. **Not an error. Not a wrong place. Simply absent.**

The only signal is `console.warn('[TRACE:MAP] geocode miss', { address, gcStatus })`
([`:193`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L193)) — a console line, which is not a surface.
The error overlay fires **only when EVERY point misses**
([`:207-213`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L207-L213)). A partial miss renders a map
that **looks complete and is not** — no banner, no count, nothing on screen. (`[TRACE:MAP] rendered` at
[`:296`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L296) does carry
`missed: located.length - good.length` — again, console only.)

**This is the six-state ruling's own class arriving on the map: a surface asserting completeness over an
incomplete set.** It is a pre-existing defect on the route, and it is **strictly worse on a customer overlay**,
for the reason in R5.

### 🔴 THE ANSWER: **NO. A DISPLAY-ONLY CUSTOMER OVERLAY DOES NOT REQUIRE PERSISTED `lat`/`lng`.**

**The reasoning is that the overlay is structurally the same problem the map already solves.** Both are *"a
list of address strings that must become pins on a map already on the screen."* Nothing about a customer
address makes it less geocodable than a delivery address — **they are literally the same columns**: the
existing stop list reads `customers.billing_line1 / billing_city / billing_state / billing_zip` with the legacy
fallback, via `fullAddress()` ([`:33-40`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L33-L40)) over
the join at [`:431`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L431). The map has **no
persisted-coordinate dependency today**, and requiring one for the overlay would make the overlay more
dependent than the feature it sits on.

**So this build drops a migration, a backfill, and the address-quality trap — as the prompt anticipated.**

⚠️ **BUT "NO" ANSWERS THE QUESTION ASKED; IT IS NOT A CLAIM THAT IT SCALES. THE CEILING IS REAL AND KNOWABLE:**

- Geocoding cost is **per call, per render**. The route geocodes ≤31 points once per built route. An
  *all customers* overlay geocodes **the whole roster**.
- 🔴 **And because `geocode()` lives INSIDE the effect keyed `[apiKey, origin, stops]`
  ([`:313`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L313)), any change that alters the marker
  set re-runs the ENTIRE init — re-geocoding every customer AND every route stop, and re-requesting
  Directions.** Ten filter taps over a 200-customer roster is 2,000+ unthrottled geocodes in one session,
  against a status code the code does not handle.
- **The failure mode of hitting that ceiling is exactly (c): customers silently missing, with the map looking
  complete.** On a passive readout whose entire job is *"these are my customers"*, a silently short list is the
  worst available failure.

✏️ **The cheapest correct answer to that is NOT persistence — it is a per-session in-memory cache keyed on the
address string.** No migration, no backfill, no address-quality ruling, and it turns *N per filter tap* into
*N once per page load*. That is what Options 2–4 below carry.

---

## R4 — WHERE WOULD THE OVERLAY LIVE, AND WHAT IS ALREADY THERE?

### RouteMap assumes ONE ordered stop list, and it is not a component you can hand a layer to.

`function RouteMap({ apiKey, origin, stops, onResult })` —
[DeliveryRoute.tsx:152](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L152). **Module-local, no
`export`**; its only consumer is [`:683`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L683). A grep
for `google.maps|importLibrary|Marker` across `packages/shared/src` and `packages/cultivar-os/src` returns
**this file alone — it is the only map in the repository.**

Its structure, and why that matters:
- Markers are constructed **inline inside the effect**
  ([`:275-280`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L275-L280)), numbered `1..N` off
  `orderedStops`. **There is no marker registry, no layer concept, and no marker cleanup** — the effect's
  teardown only sets `cancelled = true` ([`:314`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L314)).
- Every marker is pushed into a single `bounds` that then drives `map.fitBounds(bounds, 48)`
  ([`:290`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L290)).

🔴 **Two consequences that size this build honestly:**

1. **Adding customer pins means either a new prop that re-runs the whole init on every filter change (the
   R3 ceiling), or splitting `RouteMap` so route-render and marker-layers are separate effects.** The second is
   the correct shape and it is **a refactor of the one working map in the product, days before the LAWNS
   demo.** That is the real cost here, and it is named rather than buried in an estimate.
2. **`fitBounds` currently frames the ROUTE.** Adding every customer to `bounds` zooms out to the whole service
   area and makes the route unreadable. **Whichever option is taken must decide what the map frames** — and
   that is a product decision, not an implementation detail.

### Filter / chip UI — CORE MANDATE rule 1 checked FIRST, and the honest answer is: nothing in `packages/shared/` fits.

`ls packages/shared/src/components/` → `AppHeader` · `Badge` · `Button` · `Card` · `CostToProduceSettings` ·
`FieldError` · `FormField` · `LockedOverlay` · `ProgressBar` · `QuickBooksConnector` · `SavingsReport` ·
`Skeleton` · `SurfaceState` · `auth/` · `team/` · `tiles/`. **No filter, no chip, no toolbar, no date control.**

What DOES exist, and what each is actually good for:

| thing | where | verdict |
|---|---|---|
| `StatusFilterConfig` — the platform's ONE built filter | [DataSheet.tsx:52-56](../../packages/cultivar-os/src/components/datasheet/DataSheet.tsx#L52-L56), rendered [`:271-275`](../../packages/cultivar-os/src/components/datasheet/DataSheet.tsx#L271-L275) | **Right PATTERN, wrong COMPONENT.** A single-select `<select>` with an "All" option + a global search. `DataSheet` is a **grid engine** — its own header: *"Renders the page chrome, the toolbar, and the table"* — and it is **single-select**, which R1 proves these filters are not. |
| Size chips | [InventoryCount.tsx:1022-1024](../../packages/cultivar-os/src/pages/InventoryCount.tsx#L1022-L1024) (`S.chipRow`/`S.chip`/`S.chipActive`) | Closest **visual** match to what David described, and it is the **phone-first** one. But it is a single-select size picker, styles only, local to the file. |
| `PermChip` | [MemberConsole.tsx:41,66](../../packages/shared/src/components/team/MemberConsole.tsx#L41) | A permission **grant catalog** — a different semantic entirely. Not a filter. |

🔴 **ZERO date-range filters exist anywhere in the platform.** All eleven `type="date"` sites are single-value
**form fields**: `DeliverySchedule.tsx:306`, `CustomerCapture.tsx:419`, `OrderDetail.tsx:375`,
`CustomerPartyEditor.tsx:309`, `PMI.tsx:685`, `ReceiptKeeper` ×4, and `Campaigns.tsx:153,157` — which is a
start/end **pair on a create form**, not a range filter over a result set. **A from/to range control is net-new
UI on this platform.**

✏️ **§6 r16 (industry-standard-first for UI) applies and is stated rather than skipped:** the standard for
*"several non-exclusive status filters plus a date range over a map"* is a **multi-select filter bar with a
date-range picker**. **The platform has neither half.** Building it is a deliberate, recorded first — not an
accident of not knowing the standard.

---

## R5 — THE ADDRESS-QUALITY EXPOSURE

### Column shape — ✅ THE BEST NEWS IN THIS RECON. Separate columns, never a blob.

`customers` carries **two generations of address, both structured**:

- **CANONICAL** (gated, [20260713_customers_party_record.sql:52-56](../../supabase/migrations/20260713_customers_party_record.sql#L52-L56)):
  `billing_line1` · `billing_line2` · `billing_city` · `billing_state` · `billing_zip`.
- **LEGACY unprefixed**: `address_line1` · `city` · `state` · `zip` — **deliberately left untouched** by that
  migration ([`:26-27`](../../supabase/migrations/20260713_customers_party_record.sql#L26)), still read by
  delivery and order surfaces.
- The mirror pairs are **declared, not inferred** —
  [customerFieldRegistry.ts:79-84](../../packages/cultivar-os/src/components/customers/customerFieldRegistry.ts#L79-L84)
  + `CUSTOMER_BILLING_MIRROR`. The read order is **canonical-first, legacy-fallback**
  ([`fullAddress`, DeliveryRoute.tsx:33-40](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L33-L40)); the
  D-41 comment there records that the invoice printed the curated address while these surfaces showed the stale one.
- **No `shipping_*` on the customer, by design** — ship-to is an ORDER fact snapshotted onto `deliveries`
  ([20260713…:19-23](../../supabase/migrations/20260713_customers_party_record.sql#L19-L23)).
- 🔴 **No `lat`, `lng`, `latitude`, `longitude`, `geography` or PostGIS in ANY migration** — grep across the
  whole corpus returns zero. The only coordinates in the platform are `RhythmLogger`'s device telemetry
  ([RhythmLogger.tsx:115-116](../../packages/cultivar-os/src/components/RhythmLogger.tsx#L115-L116)), unrelated.

### How many rows would geocode ambiguously — 🔴 I CANNOT SAY, AND SAYING SO IS THE POINT.

Per the 2026-08-22 ruling (`RULINGS.md:174` — *a claim about the database is sourced from the catalog or it is
not made*), and because this machine has **no `psql`, no `supabase` CLI and no catalog access**, no count is
offered. **The QUERY is the deliverable instead** — read-only, and it partitions on exactly what makes a
geocode ambiguous:

```sql
SELECT
  count(*) FILTER (WHERE coalesce(billing_line1, address_line1) IS NULL
                      OR btrim(coalesce(billing_line1, address_line1)) = '')    AS no_street,
  count(*) FILTER (WHERE btrim(coalesce(billing_line1, address_line1)) <> ''
                      AND coalesce(billing_city, city) IS NULL
                      AND coalesce(billing_zip,  zip)  IS NULL)                 AS street_only_AMBIGUOUS,
  count(*) FILTER (WHERE coalesce(billing_city, city) IS NOT NULL
                      AND coalesce(billing_zip,  zip)  IS NULL)                 AS city_no_zip,
  count(*) FILTER (WHERE coalesce(billing_zip,  zip)  IS NOT NULL)              AS has_zip,
  count(*)                                                                       AS total
FROM customers
WHERE business_id = '<BIZ>';
```

`street_only_AMBIGUOUS` is the San-Marcos shape. `has_zip` is the population that will place well.

### ✏️ ONE CORRECTION TO THE PREMISE — AND IT MAKES THE ANSWER WORSE, NOT BETTER.

The prompt reads the 2026-06-25 recon as *"the San Marcos mis-geocode: a bare street line with no city/state/zip
snapped to the wrong town."* **That runs together two of that document's three separate defects.**
(`docs/decisions/2026-06-25-address-spine-defect-recon.md` — and today's parked spec §5 compresses them the
same way, in one sentence, which is likely where the reading came from.)

- **Defect 2 is the bare street line — and it was `businesses.address = "770 Co Rd 284"`, the ROUTE ORIGIN.**
  Not a customer address.
- **Defect 3 IS the San Marcos one, and the customer address was COMPLETE AND CORRECT.** Verified by
  service-key SELECT: `"1208 Ranch Road 12, Wimberley, TX 78676"`. The doc's own verdict:
  *"This is a geocoding-precision issue, not a stored-data or passed-string bug."* Ranch Road 12 spans
  San Marcos ↔ Wimberley, and Google snapped it.

### 🔴 SO, PLAINLY: HOW BAD IS THIS?

**The exposure is not *"incomplete addresses geocode badly"*, which data hygiene fixes. It is that a COMPLETE,
CORRECT rural Texas address can be placed in the wrong town — and nothing in the code can tell.** The geocoder
returns `OK`. `results[0].geometry.location` is a real coordinate. The pin is drawn with full confidence.

**No confidence signal is read anywhere.** `results[0].partial_match`, `location_type` (`ROOFTOP` vs
`RANGE_INTERPOLATED` vs `APPROXIMATE`) and `types` are all on the response and **all discarded** at
[`:191`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L191).

**And it is worse on an overlay than on a route.** On a route the driver holds the address on the stop card and
notices — the map is an aid to a list she already trusts. **On a passive overlay the pin IS the claim, and
nobody cross-checks a dot.** LAWNS is in Leander selling into the Hill Country, which is precisely where
ranch-road and rural-route ambiguity lives.

Mitigations are cheap and **none is built**: read `partial_match`/`location_type` and render an uncertain pin
differently; refuse a pin for a customer with no ZIP and say so in the not-placed count; always carry the
address text on the pin so a human can catch it. **A confidently-placed wrong pin is worse than no pin — and
today the code has no way to be less than confident.**

---

## R6 — ⚠️ THE TILE-TRIAL COLLISION: **CORRECTED AGAINST SOURCE, NOT CONFIRMED.**

The prior session's reading is right about the tile and about the clock, and **wrong about the consequence.**

✅ **Confirmed from source:**
- `user_stories.md:240` names the tile home: *"`opportunities` (dashboard tile, PLANNED/unbuilt in
  `tileRegistry.ts` — no route/component yet)"*.
- The registry entry is [tileRegistry.ts:259](../../packages/cultivar-os/src/registry/tileRegistry.ts#L259):
  `key:'opportunities'` · `vertical:'general'` · `group:'planned'` · `kind:'destination'` ·
  `placement:'dashboard'` · `required_permission:'orders:read'` · `status:'planned'` ·
  `depends_on:'services'` · `note:'Regina surfacing; permission PROVISIONAL'`. **No `route`, no component.**
- **The clock-starter reading is accurate.** `start_module_trial` is the sole writer of the trial pair
  ([20260801c:207](../../supabase/migrations/20260801c_module_seed_and_trial_clock.sql#L207)), reached from
  `seed_business_modules` ([`:460`](../../supabase/migrations/20260801c_module_seed_and_trial_clock.sql#L460)) at
  tenant creation via `seedBusinessModules`
  ([OwnerSignup.tsx:395](../../packages/shared/src/auth/OwnerSignup.tsx#L395)) — plus, as of the still-**GATED
  and unapplied** `20260802c`, from `set_business_module_state`. `RULINGS.md:162` is the standing OWED row and
  it states this correctly.

🔴 **BUT `opportunities` HAS NO `module_key` — AND ITS TWO IMMEDIATE NEIGHBOURS DO.**
`followup_engine` ([`:261`](../../packages/cultivar-os/src/registry/tileRegistry.ts#L261)) carries
`module_key:'followup_engine'`; `business_insights` ([`:263`](../../packages/cultivar-os/src/registry/tileRegistry.ts#L263))
carries `module_key:'business_insights'`. **`opportunities` carries none.** And `MODULE_CATALOG`
([tileRegistry.ts:384-400](../../packages/cultivar-os/src/registry/tileRegistry.ts#L384-L400)) holds **eleven
entries and `opportunities` is not one of them.**

### **So: would this overlay shipping land in the clock-starter gap? NO — there is no clock to start.**

No catalog row ⇒ no price, no `trial_days`, no `business_modules` row, nothing for `start_module_trial` to write.

🔴 **It lands in a DIFFERENT and already-ruled gap one layer up: the 7-of-14 shape (`RULINGS.md:69`)** — a
capability that ships live with **no catalog entry at all** is revenue the platform structurally cannot
collect. **And that same ruling names the trap in advance:** ***"DO NOT FIX BY ADDING A `module_key`"*** —
because doing so flips a live tile to *"set up"*, the dead-affordance class.

⚠️ **The caps confirm the asymmetry rather than catching it.** `verify-tile-fields` assertion 2 rejects a
**catalog entry with no tile**; **nothing rejects a tile with no catalog entry** — the tree carries 48 registry
rows against 11 catalog entries. This session's own `capA` run prints `opportunities` by name among the six
planned tiles gating on a live string, and passes.

**NAMED. DELIBERATELY NOT SOLVED**, per the prompt.

---

## R7 — FUNCTION COUNT

`api/` holds **exactly 12 function files**, confirmed by `find`, not assumed:

`campaigns.ts` · `customers/create.ts` · `dashboard.ts` · `discovery/ingest.ts` · `members/invite.ts` ·
`orders/submit.ts` · `pmi/suggest.ts` · `qbo-connector.ts` · `qbo/invoice/cultivar.ts` · `receipts/ocr.ts` ·
`social/enable.ts` · `social/generate-posts.ts`. **12/12 — zero headroom.** (`api/qbo/.DS_Store` is not a function.)

**No option here needs a keyed server call:**
- The customer read is a plain RLS-scoped client SELECT — the pattern exists at
  [Customers.tsx:128](../../packages/cultivar-os/src/pages/Customers.tsx#L128).
- The order read is a plain RLS-scoped client SELECT under `orders_member_select`, gated on `view_orders`
  ([20260724_manager_visibility_gaps.sql:64-69](../../supabase/migrations/20260724_manager_visibility_gaps.sql#L64-L69)).
- Geocoding is client-side Maps JS with **zero Vercel functions** — `RouteMap`'s own header says so
  ([`:135`](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L135)).

**Nothing below mints, rides, or touches an `api/` file. 12/12 held, no §6 r11 event.**

---

## R8 — OPTIONS, NEED → WANT. NOT COLLAPSED.

**Every option is client-side. Every one is ZERO migrations and ZERO new `api/` functions — stated explicitly,
per the prompt.** Two constraints bound all four and belong to the ground, not to a choice: **R5** (a confident
wrong pin) and **R6** (no catalog row). Prompt counts are the shape of the work, not a schedule.

### OPTION 1 — THE CHEAPEST HONEST VERSION: the overlay against Test Dave's EXISTING customers.
**What:** a toggle on `/delivery-route` that reads the tenant's customer roster (the existing `Customers.tsx:128`
query) plus a per-customer order-fact roll-up, geocodes them through the lifted `geocode()`, and drops a
visually distinct marker per customer. Three status controls and a from/to date pair, applied **in memory to the
already-geocoded set** so filtering never re-geocodes.
**Migrations: 0. Functions: 0 (12/12 held). Permission strings: 0. Prompts: ~2 — plus the R4 marker-layer work,
which is the bulk of it.**
**Does NOT solve:** address quality (R5) — pins can be confidently wrong. "Delivered" still means *sold as a
delivery* (R1). The `deliveries.service_type` planted population is still invisible. It picks one R2 date
reading and must say which on screen. `fitBounds` framing must be decided.

### OPTION 2 — OPTION 1 + AN HONEST GEOCODE READOUT.
**Adds:** a per-session address→coordinate cache (kills the R3 re-geocode ceiling); a **visible count of
customers not placed, and why** (no address / geocode failed) instead of the current silent drop; and
`partial_match` / `location_type` read off the response so an uncertain pin **renders differently and says so**.
**Migrations: 0. Functions: 0. Prompts: ~3.**
**Why this is the one that meets the standing rulings:** a readout whose entire claim is *"these are my
customers"* must not quietly show fewer than it has — the six-state ruling and A9/D-9 (*absent is not empty*)
both land here. ✅ **And it fixes the SAME silent drop for the existing route stops — one build, two surfaces.**
**Does NOT solve:** the cache dies with the tab. No catalog row (R6). Accuracy still unverifiable without
LAWNS's real list (R9).

### OPTION 3 — OPTION 2 + HONEST FILTER SEMANTICS.
**Adds:** filters that are **additive rather than a single-select radio** (R1 proves a customer can be all
three); "delivered" labelled for what it actually is; `transport_method IN ('delivery','install')` rather than
the under-counting `= 'delivery'`; the `deliveries.service_type='planting'` population **unioned in** so
OCR-scheduled plantings are not invisible; and the chosen R2 date reading **named on the screen**.
**Migrations: 0. Functions: 0. Prompts: ~4.**
**Does NOT solve:** address quality is unchanged. It does **not** build a `deliveries`↔`orders` link — it unions
two populations at read time and says so on the surface.

### OPTION 4 — THE WANT: persisted coordinates on `customers`.
**Adds:** `lat` / `lng` / `geocoded_at` / `geocode_precision`; geocode-on-save; a one-time backfill.
**Migrations: 1 (+ a backfill). Functions: 0. Prompts: ~4–6.**
**What it buys:** filtering and panning never re-geocode; quota becomes a one-time cost; precision persists so
an uncertain pin **stays** uncertain across sessions; and it is the prerequisite for anything proximity-shaped
later — it is item 2 of the parked spec's owed list.
⚠️ **FLAGGED NOT RECOMMENDED NOW — on scope, not on merit.** David ruled display-and-filter, and R3's answer is
that display-only does not need it. It also forces the address-quality decision (*what do you store for a
customer whose address is ambiguous?*), which is **a ruling, not a build**. ✅ **It is the right destination and
the wrong week** — and `customers` has **no `CREATE TABLE` migration at all** (tech-debt #39), which that
migration would have to reckon with first.

---

## R9 — THE IMPORT, SEPARATELY

**There is no customer import path today. It is net-new.** The platform's one CSV importer is inventory-only:
[InventoryImport.tsx](../../packages/cultivar-os/src/pages/InventoryImport.tsx) is the single surface (a grep
for `parseCsv|importPlan` across `packages/cultivar-os/src` returns it alone), its spine is a **closed
five-field set** — `'sku' | 'name' | 'size' | 'qty' | 'sell_price'`
([columnMap.ts:37-38](../../packages/shared/src/import/columnMap.ts#L37-L38)) — and its plan resolves against
`business_inventory` ([InventoryImport.tsx:146-147](../../packages/cultivar-os/src/pages/InventoryImport.tsx#L146-L147)).
Nothing in it can address a `customers` row. The only customer-writing paths are one-at-a-time:
`customerUpsert.ts` (checkout / `CustomerCapture`) and `CustomerPartyEditor` (the roster form). QuickBooks moves
customers **outward only** — [cultivar.ts:207,256](../../packages/cultivar-os/api/qbo/invoice/cultivar.ts#L207)
writes `qb_customer_id` back **after** pushing a customer to Intuit; there is no pull. ⚠️ And the nearest thing
that *looks* like a pull is dead: `packages/shared/src/quickbooks/customer.ts` is Ignition donor code by its own
header (*"Extracted from CAI/ExternalBridge.js"*), returns a `vehicles` array, points at `API_URL` defaulting to
`http://localhost:8000`, and its only consumer is
[QuickBooksConnector.jsx:66](../../packages/shared/src/components/QuickBooksConnector.jsx#L66) — which has
**zero consumers in cultivar-os** and imports `../ExternalBridge`, **a file that does not exist in
`packages/shared/src`.** It would not run. **Designing the import is deliberately not done here.**

---

## FLAGGED FOR DAVID — the short list

1. 🔴 **R3 is NO — display-only needs no persisted coordinates**, which retires items 2 and 3 of the parked
   spec's owed list for THIS build. The real cost is elsewhere: **`RouteMap` has no marker-layer concept**, and
   giving it one is a refactor of the only working map, days before LAWNS (R4).
2. 🔴 **"Delivered only" cannot mean the truck arrived.** Nothing ever writes `'delivered'`; every delivery row
   reads `scheduled` forever. And `= 'delivery'` **under-counts** — it excludes `install`, which is also delivered.
3. 🔴 **The three filters are not mutually exclusive, in three separate ways** — which makes a single-select
   radio the wrong control, and that is a design decision the data forces.
4. 🔴 **"Date purchased" is a choice, not a column** — any-in-range / latest / earliest give different pin sets.
5. 🔴 **A complete, correct rural address can still place in the wrong town, and the code reads no confidence
   signal at all.** On an overlay the pin IS the claim. Worse here than on a route.
6. ⚠️ **A pre-existing silent drop found while answering R3:** a stop that fails to geocode vanishes with no
   surface signal, and the map looks complete. Fixing it in Option 2 fixes the route too.
7. ⚠️ **An order that LAWNS delivers AND plants does not appear on the delivery route today**
   (`DeliveryRoute.tsx:436`). Out of scope. Named, not fixed.
8. ⚠️ **R6 corrected:** `opportunities` has no `module_key`, so this would NOT land in the trial-clock gap —
   it lands in the 7-of-14 uncollectable-revenue shape instead, and that ruling says *do not fix it by adding a
   `module_key`*. Named, not solved.
9. ⚠️ **`VITE_GOOGLE_MAPS_API_KEY` is missing from `docs/inventory-env.md`**, the doc CLAUDE.md calls canonical
   and a superset. Doc gap, named not fixed.
10. ✅ **12/12 `api/` held by every option. Zero migrations on Options 1–3.**
