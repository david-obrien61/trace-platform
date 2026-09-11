# RECON — `orders.install_date` is never set · `business_inventory.location` already exists

**Date:** 2026-09-11 · **Type:** READ ONLY — no build, no migration, no branch · **Ledger:** #299 · **Tech-debt filed:** #267–#269 · **Ruling filed:** R-143
**Came from:** David's empty-column sweep (2026-09-11): *built and unpopulated looks identical to never built.*
**Method:** every live read ran as `supabase_read_only_user` (confirmed by `SELECT current_user`), against
the system catalogs **and** the rows, across all tenants. Two local QuickBooks captures, both complete:
`qbo-invoices-9341455222430707-2026-09-10T15-19-05-341Z.json` (**1,496 of 1,496**) and
`qbo-items-9341455222430707-2026-09-10T15-18-19-698Z.json` (**673 of 673**).
**Provenance marks:** `[MEASURED]` was run and seen · `[REPO]` is a file:line · `[INFERRED]` has not been
checked and must not be promoted to fact.

**Story gate (§9):** Part A → *"The stop is done — one tap, and a moved stop says where it went"* and
*"The calendar holds what actually happened"* (`warranty_window_read`) — MATCH. Part B → **NO MATCH**: no
story on `user_stories.md` mentions a zone. R-135 is a ruling, not a story. A story is owed before any
zone build.

---

## PART A — `orders.install_date` IS NEVER SET

### Measured

| | LAWNS | Test Dave's Tree Nest | Test David's new Business | **All** |
|---|---|---|---|---|
| orders | 40 | 35 | 1 | **76** |
| `orders.install_date` non-null | 0 | 0 | 0 | **0** |
| `orders.delivery_date` non-null | 35 | 19 | 0 | **54** |
| `transport_method` install / delivery / self | 14 / 24 / 2 | 21 / 7 / 7 | 0 / 0 / 1 | 35 / 31 / 10 |

`deliveries`: **57 rows, 54 dated, `started_at` 1, `completed_at` 0, `status` = `scheduled` on all 57.**
The one started stop is `57c31e32` (2026-08-29, planting, started 2026-09-04 21:50, never finished).

### A1 — What writes `install_date`? **Nothing, and nothing ever did.**

- **Live catalog `[MEASURED]`:** `orders.install_date` is `date`, nullable, no default, no comment. **Zero**
  constraints, indexes, functions, views or policies reference it.
- **Repo `[REPO]`:** one occurrence in all of `packages/`, `api/`, `supabase/`, `scripts/` —
  `packages/cultivar-os/src/types/order.ts:32`, `install_date: string | null;`. No migration creates it
  (`orders` has no `CREATE TABLE` in the corpus — tech-debt #39's class).
- **History `[MEASURED]` (`git log -S install_date --all`):** five commits, and **not one writes it.** It was
  born in the original brief's `orders` DDL (`eaccd19`, 2026-05-18, `CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md:342`),
  copied into the TypeScript type the same day (`1afa09a`), and listed as a column in a doc (`aeb838f`).
  **Never wired, so never unwired.** Nothing records what it was meant for.

### A2 — What reads it? **Nothing. It renders nothing.**

The only declaration sits on the `Order` interface (`types/order.ts:22-41`), and **nothing imports `Order`.**
The three files that import from `types/order` take `CartItem` and `ServiceSelection` only
(`useCart.ts:3`, `netting.ts:19`, `useSubmitOrder.ts:6`). No select names it, so no screen shows a blank or
a dash for it, and no calculation reads the null.

### A3 — The checkout path, traced from the button

1. **`CustomerCapture.tsx:458-472`** renders ONE field, labelled **"Delivery date"**, with the hint *"When is
   this going out?"* It appears when `deliveryRequired && can('orders:create')` (`:148-149`) — **for a delivery
   order and an install order alike. There is no install date field.**
2. `:286` puts it in the cart (`setDeliveryDate`); `CartReview.tsx:315` passes it to `useSubmitOrder`.
3. **`api/orders/submit.ts:888-903`** writes it to **`orders.delivery_date`**.
4. **`submit.ts:1183` → `scheduleCheckoutDelivery` (`:246-332`)** inserts a `deliveries` row with **the same
   value** in `delivery_date` (`:278`) and `service_type` from `deliveryServiceType` (`:228-230`):
   *"`install` → `planting` — delivery + planting — an install job"*.
5. **The "Mark done" tap** (`DeliverySchedule.tsx:274-287`, patch at `deliveryFulfilment.ts:142-147`)
   writes `deliveries.status='fulfilled'`, `started_at`, `completed_at`. **It never touches `orders`.**

So checkout writes the date twice (order and stop, once each), and no path writes `install_date`.

🔴 **THE TWO DATES THAT DO EXIST ALREADY DISAGREE.** Of **39** stops linked to an order: **26 agree, 10
differ, 3 have no order date** `[MEASURED]`. All 10 are LAWNS:
- **3 `ocr-invoice` planting stops** sit **+1, +19 and +21 days** after their order's date.
- **7 `qbo-shipdate` stops** sit **−7 to +9 days** from theirs.

The mechanism is in the code. An order edit writes only `orders.delivery_date` (`submit.ts:1492-1496`), and
moving a stop on the schedule writes only `deliveries.delivery_date` (`DeliverySchedule.tsx:~368`).
**For the QuickBooks stops, the capture says which copy is stale:** the invoice's current `ShipDate` equals
the stop's date on **18 of 19** and the order's date on **13 of 19** `[MEASURED]`. This is tech-debt #108's
drift, measured, **before** anyone adds a third date.

### A4 — THE WARRANTY CLOCK: **no warranty code exists**

Every `warrant` hit in code, and what it is:
- `cultivar_plants.warranty_months` — `integer NOT NULL DEFAULT 12` — on a table holding **0 rows**
  `[MEASURED]`. It is rendered as a static stat, `` `${plant.warranty_months} months` ``
  (`PlantHero.tsx:79`), not as a clock.
- `ReceiptKeeper.tsx:73` — `/install|warrant|plant/` over line text, to infer `service_type='planting'`.
- QuickBooks line classifiers (`invoiceOrderLines.ts`, `invoiceList.ts`, `serviceReview.ts`) — none computes a date.

**No reader takes any of the three candidates.** `warranty_window_read` is a PIECE of a story
(`user_stories.md:620`), not code. **R-37** (2026-09-01) is OPEN with *"no `planted_by_lawns` or
`warranty_expires` column is minted on the strength of history."*

🔴 **The ruling as the prompt states it is in no file.** *"The clock is the DONE TAP on an install;
placement ⇒ warranty, delivery alone ⇒ none"* was searched across `RULINGS.md`, `DECISIONS*.md`,
`user_stories.md`, `docs/decisions/`, the handoff archive and the ledger. **Not found.** The filed 2026-09-01
ruling is R-37: *"The date is the `ShipDate`, because that date carries the warranty clock."* The two
**do not conflict** if read as history → `ShipDate` (no tap existed then) and new work → the done tap.

| Candidate | Populated | Writer exists? | What it measures |
|---|---|---|---|
| `orders.install_date` | **0** | **no** | nothing, ever |
| `orders.delivery_date` | 54 | yes (checkout, order edit) | when it was BOOKED to go out, on the order — and stale on 10 of 36 |
| `deliveries.completed_at` | **0** | **yes** (the done tap) | when the stop was actually DONE |

**My read on "redundant or load-bearing":** under the ruling as stated, the clock source is
**`deliveries.completed_at` on a stop whose `service_type = 'planting'`.** That column has a writer, it is
per stop, and it is the only one of the three that records the act rather than the plan. A staged job
(drop on Saturday, plant on Tuesday) is already expressible as two stops under one `order_id`, each with its
own `service_type` and `completed_at`. **So `install_date` is REDUNDANT** — a third store for a date whose
two existing stores already disagree.

🔴 **TWO THINGS STAND BETWEEN THAT SOURCE AND A REAL CLOCK, AND NEITHER IS A COLUMN:**
1. **Nobody has ever tapped done.** `completed_at` is 0 of 57 on every tenant.
2. **A QuickBooks-ingested stop can never be a planting stop.** All 19 LAWNS `qbo-shipdate` stops carry
   `service_type` NULL and `transport_method='delivery'`. **7 of those 19 invoices carry install wording**
   `[MEASURED]`, and 15 carry a `TC` trip-charge line. Under *"delivery alone ⇒ none"* those 7 installs
   would never start a warranty. **This is a recorded choice, not an accident:**
   `historyOrderWriter.ts:324` reads *"NOT INFERRED, AND THAT IS DAVID'S CALL RATHER THAN A GAP"*, and
   `deliveryIngestWriter.ts:340` gives the reason. The consequence for the warranty was not written next to it.

⚠️ **And the warranty LENGTH has two values:** R-37 says LAWNS warrant **six months**;
`cultivar_plants.warranty_months` defaults every row to **12**. The table is empty, so nothing is wrong yet.

### A5 — Are delivery and install the same day? Lightning's read, tested

**What the data supports:**
- **The books hold ONE date per invoice** besides `TxnDate` and `DueDate`: `ShipDate`, on **607 of 1,496**.
  There is **no custom field** (0 defined) and **no install date anywhere in a QuickBooks invoice.**
- **Install and a delivery charge travel together.** 648 invoices carry install wording (item name or
  description); **429 of them (66%)** also carry a `TC`, tailgate or "deliver" line, and 401 carry `TC`
  specifically. Lightning's **413 of 617 (67%)** is the same proportion from a different classifier —
  **not reproduced exactly.** Install wording sits almost entirely in the description (*"(Install &
  Warranty)"*); an item NAMED for install occurs on only 8 invoices.
- **The app has never held a staged job:** 0 orders have more than one stop `[MEASURED]`.

**What it does NOT support:** that the two happen on the same day. The books have **nowhere to record a
second date**, so the absence of one is not evidence. The only live gap between a booked date and a
planting stop's date is the 3 LAWNS stops moved +1 to +21 days — consistent with rescheduling, and just as
consistent with staging. **Lauren is the only source for "same day".**

### Part A — options for `install_date` (David's call)

| | What | Cost | Leaves |
|---|---|---|---|
| **A-1 NEED** | Leave it | nothing | a dead column that reads as "built", which is what put it in this sweep |
| **A-2** | Retire it: delete the type field; drop the column by a migration David applies | small | nothing to mislead — but `orders` has no `CREATE` migration, so the DROP is the first migration to describe the column at all |
| **A-3 WANT-if-staged** | Wire it at checkout as a second date field | a second field Lauren fills, and a third store for the date | a divergence #108 already shows happening with two |

**Recommendation: A-2, but only after David confirms the clock source is the planting stop's
`completed_at`.** If he instead wants the order to carry the date, `install_date` is the wrong place:
the stop already carries it.

---

## PART B — `business_inventory.location` ALREADY EXISTS AND IS EMPTY

### B1 — Shape `[MEASURED]`

| Column | Type | Null | Default | CHECK / FK / index / unique | Comment | Rows non-null |
|---|---|---|---|---|---|---|
| `business_inventory.location` | `text` | yes | — | **none** | — | **0 of 1,225** (LAWNS 1,094 · Test Dave 130 · Test new 1) |
| `cost_objects.location` | `text` | yes | — | **none** | — | **0** |
| `cultivar_plants.location_zone` | `text` | yes | — | **none** | — | **0 — the table holds 0 rows** |

**Three free-text place names, no structure, no link to anything.** Two are the same idea: a place on the
property, typed by hand. `location` is on stock (`20260612_business_assets_inventory_pmi_service.sql:106`,
in the base `CREATE`). `location` is on equipment (`20260612_business_assets_inventory_cost_confidence.sql:33`,
added to `business_assets` before its rename to `cost_objects`; the placeholder reads *"e.g. Barn, Lot B, Site 3"*).
The third is narrower. `location_zone` is a per-tagged-plant nursery block — *"a nursery block, not an address"*
(`2026-09-08-what-is-planted-in-a-customers-ground-recon.md:58`). The corpus mentions it only in a comment
(`20260613_cultivar_plants_untangle.sql:100`).

⚠️ **A false friend:** `business_inventory.attributes` carries a key named **`Zone`** on 2 rows (Test Dave's
Tree Nest, from a grower price list). `20260723_inventory_import_columns.sql` lists *"Sun, Height, Spread, Zone"*
among descriptive columns the platform never operates on. It is a **plant descriptor** `[INFERRED —
hardiness]`, not a watering zone. Do not join on it.

🔴 **The fact that decides B4: `business_inventory` is ONE ROW PER QUICKBOOKS ITEM.** The live unique index
`business_inventory_business_qb_item_uidx ON (business_id, qb_item_id)` enforces it, with **0** duplicates.
**Any single column on that row can name exactly one zone per item.**

### B2 — Writers and readers `[REPO]`

- **`business_inventory.location`:**
  - Written by `InventoryEditor.tsx:196` (inline save) and `:304` (create, placeholder *"e.g. Shed A,
    Greenhouse 2"*), by `BusinessInventory.tsx:233/457` (grid text cell), and by `scripts/seed-uppot-harness.mjs:110`.
  - Read by `BusinessInventory.tsx:106/456/485` (select, column, search) and by the uppot plan read
    (`uppotPlanFields.ts:22` → `uppotPlanRead.ts:101`), which carries it into moves (`productionMath.ts:470`).
  - **`sequenceRuns` (`productionMath.ts:298`) already treats it as a BLOCK.** It sorts runs by block within
    a rung and reports blocks revisited across rungs. **No page calls `sequenceRuns`** (only the index
    export and its test).
  - **It is wired, editable in two places, and has never been filled.**
- **`cost_objects.location`:** `BusinessAssets.tsx:124` (select), `:239` (grid), `:286` and `:379` (create form).
- **`cultivar_plants.location_zone`:** declared in `types/plant.ts:20`, set to null by `stockLinePlant.ts:30`,
  written `Row A…` only by `scripts/seed-sandbox.mjs:99`. **No screen renders it.**

### B3 — Is there any zone table? **No. Here is what exists instead.**

Live sweep of every relation in every non-system schema, for `zone | panel | irrigat | valve | station |
block | bench | row(s) | bed(s) | section | site | location | plot | yard | emitter | water`: **no table,
view or materialised view matches** `[MEASURED]`.

Column sweep of `public`: only the three columns above, plus `website` on three tables (a match on "site").
No `business_modules.config` mentions zone, irrigation, valve or emitter. No inventory `notes` or
`description` does. No repo code does.

**The only digital holder of the zones** is `packages/cultivar-os/public/tools/zone-walk.html` (ledger
#298). Its `PANELS` seed holds per-zone run minutes and panel A descriptions from the panel sheets
photographed 2026-09-09. It loops 22 zones per panel. Captured data lives in the walker's browser
(`localStorage` key `lawns-zone-walk-v1`) until **Export**.

### B4 — `location`, or `zone_id` beside it? Three lenses

**HAVE:**
- An empty, unstructured `location` on a one-row-per-item table.
- R-135, which names *"`business_inventory.zone`"*.
- Tech-debt #266 (#298), which already says a zone holds many lots and a lot can sit in several zones.

**NEED:**
1. *"Go to zone B5 through B10 and recount"* is a **range filter.** It needs panel and number as ordered
   values. As text, `'B10' < 'B5'`.
2. The zone's own facts (run minutes, emitter, valve status) need a home.
3. *"Not too hard on bookkeeping"* means a zone must never touch qty, cost or the ledger.
4. One store per fact.

**WANT:** one zone record that the count screen, the operations calendar (R-134's zone checks) and
equipment can all point at.

| Option | What | 1 range | 2 zone facts | 3 bookkeeping | 4 one store | Many zones per item |
|---|---|---|---|---|---|---|
| **O1 (cheapest)** | Type `B5` into the existing `location` | ✗ text | ✗ | ✓ | ✓ | ✗ |
| **O2 (Lightning's)** | Zone table + `zone_id` **beside** `location` | ✓ | ✓ | ✓ | **✗ — two answers to "where is it"** | ✗ |
| **O2′** | Zone table + `zone_id` **replacing** `location` | ✓ | ✓ | ✓ | ✓ | ✗ |
| **O3 (fullest)** | Zone table + an item↔zone link (`zone_id`, `inventory_id`, `qty_approx`, `observed_at`, `source`); `location` retired | ✓ | ✓ | ✓ — `qty_approx` is observation, never on-hand | ✓ | ✓ |

**RECOMMENDATION — not `zone_id` beside `location`, and not `location` as is:**
1. **Build the zone record first.** Every option except O1 needs it, and the capture's zone facts need it
   whichever way the item link goes.
2. **Retire `location` in the same pass.** It holds 0 rows on every tenant, so this is the cheapest it will
   ever be. Three readers repoint: the grid column, the editor, and the uppot read.
3. **Choose the item link by the walk data, not by preference.** The export answers it. **If no `item_id`
   appears in more than one zone, take O2′** (one column, simplest bookkeeping). **If any does, take O3** —
   because the unique `(business_id, qb_item_id)` index means a column on the item can name ONE zone,
   and the second zone would be silently lost.
   ⚠️ **`[INFERRED]`** — on a 20-acre, 88-zone farm, a variety sitting in two zones is likely. That is
   exactly why the recommendation measures it instead of assuming it.

⚠️ **AC-1 on the name:** name the table for the PLACE (a zone), not the vertical (`irrigation_*`). Watering
facts are columns where something will compute on them (run minutes), and D-24's attribute bag otherwise.
The name is David's call.

### B5 — The intake path: what landing the export would take

**The real shape, verified at `zone-walk.html:311-322`:** `{captured_at, tenant, zones:[{zone, panel,
zone_number, run_minutes, status, emitter_type, emitter_rate, emitter_count, notes, plants:[{label,
qty_approx, item_id, sku, matched}]}]}`. It matches the prompt, with two things to know:
- **`run_minutes` is not typed by the walker.** It is copied from the seeded panel sheet (`PANELS[p].run[n-1]`).
- 🔴 **`sku` is not a QuickBooks SKU.** For item 46 it reads `"Nutri-Star Granular Bottle"`, which is a
  name. QuickBooks `Sku` is present on **1 of 673** items. **Resolve on `item_id` only.**
- `matched` is exact label equality against the tool's seeded list, so a hand-typed label arrives
  `matched:false, item_id:null`.

**Resolution `[MEASURED]`:** **635 of 673** export ids resolve to a live LAWNS `business_inventory` row by
`qb_item_id`, all `available`. **The 38 that do not are all `Category`** (not stock). Twelve live QuickBooks
rows are absent from the 09-10 export. ⚠️ The 136 **Service** items are also inventory rows, so an importer
must refuse a plant resolving to a Service row.

**What it needs:**
- A zone table: `business_id`, `panel`, `zone_number`, label, `run_minutes`, `status`, `emitter_type`,
  `emitter_rate`, `emitter_count`, `notes`, source/captured-at. RLS on `business_id` membership (AC-2).
- The item↔zone link (O3) or `zone_id` (O2′).
- A home for unmatched labels. The precedent is `inventory_counts.item_label` + `was_unknown`.
- A permission string for writing zones — **unminted, David's call.**

**Does anything already accept a shape like it? No.** Nothing in the repo reads `zone_number`,
`qty_approx` or `emitter_*`. The two near-misses are both wrong homes:
- 🔴 **`inventory_count_sessions` / `inventory_counts`** have the right skeleton (a session, then per-item
  rows with `item_label` and `was_unknown`) and **no scope column**. **Do NOT route `qty_approx` through
  them: counting applies itself to on-hand at capture** (tech-debt #67, `InventoryCount.tsx:438`). An
  approximate zone tally would overwrite `qty` on up to 635 rows. That is the bookkeeping David asked not
  to disturb.
- **`business_inventory.attributes`** (D-24 bag) — a zone is filtered and joined, which makes it spine.

**Path:** LAWNS is read-only to Thunder, so the first load is SQL or a script David runs. An in-app importer
would have to ride an existing endpoint (api/ 12 of 12, Hobby).

---

## WHAT I AM NOT SURE OF — named, not buried

1. **What `install_date` was meant for.** It arrives uncommented in the original brief; no document says.
2. **The warranty ruling's exact words.** Quoted from the prompt only — not found in any file.
3. **Whether delivery and install are the same day at LAWNS.** The books cannot say, and the app has
   never held a second stop per order. Lauren is the source.
4. **Lightning's 413 of 617** — not reproduced. My classifier gives 429 of 648 (same ~66%).
5. **Whether one QuickBooks item sits in more than one zone** — the walk will measure it; B4's recommendation depends on it.
6. **Which run wrote the 7 stale QuickBooks order dates.** The capture shows the order is the stale copy
   on at least 5; I did not trace which ingest run set which.
7. **What the `Zone` attribute key on Test Dave's rows means** — inferred as a plant descriptor, not checked.

---

## VERIFY IT YOURSELF — David · Supabase SQL editor · all tenants · read-only (changes nothing)

**Card 1 — the three dates (Part A)**
```sql
SELECT b.name,
       count(*)                AS orders,
       count(o.install_date)   AS install_date_set,
       count(o.delivery_date)  AS delivery_date_set
  FROM orders o LEFT JOIN businesses b ON b.id = o.business_id
 GROUP BY 1 ORDER BY 2 DESC;
-- EXPECT: install_date_set = 0 on every row; delivery_date_set totals 54

SELECT count(*) AS stops, count(delivery_date) AS dated,
       count(started_at) AS started, count(completed_at) AS completed
  FROM deliveries;
-- EXPECT: 57 · 54 · 1 · 0
```

**Card 2 — the two date copies disagree (Part A)**
```sql
SELECT d.source, d.service_type, o.delivery_date AS order_date, d.delivery_date AS stop_date,
       d.delivery_date - o.delivery_date AS days_apart
  FROM deliveries d JOIN orders o ON o.id = d.order_id
 WHERE o.delivery_date IS DISTINCT FROM d.delivery_date
 ORDER BY 1, 3;
-- EXPECT: 10 rows with both dates set (3 ocr-invoice planting, 7 qbo-shipdate) plus 3 with no order date
```

**Card 3 — the empty place columns and the one-row-per-item index (Part B)**
```sql
SELECT 'business_inventory.location' AS col, count(location) FROM business_inventory
UNION ALL SELECT 'cost_objects.location', count(location) FROM cost_objects
UNION ALL SELECT 'cultivar_plants.location_zone', count(location_zone) FROM cultivar_plants;
-- EXPECT: 0 · 0 · 0

SELECT indexname, indexdef FROM pg_indexes
 WHERE schemaname = 'public' AND tablename = 'business_inventory' AND indexdef ILIKE '%UNIQUE%';
-- EXPECT: the primary key, and business_inventory_business_qb_item_uidx ON (business_id, qb_item_id)
```
