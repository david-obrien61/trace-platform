# What is planted in a customer's ground — RECON AND SIZING, NO BUILD

**Date:** 2026-09-08 · **Type:** RECON (no code changed, no migration written, no screen touched)
**Asked by:** David · **Measured against:** the LIVE `bgobkjcopcxusjsetfob` database via `SUPABASE_SERVICE_KEY`,
and the repo at `ddbac45`.

> **Provenance marks are load-bearing.** `[MEASURED]` = I ran the query or the parser and read the
> result. `[REPO]` = read out of a file, quoted. `[DERIVED]` = reasoned, not checked. Nothing here
> is promoted from `[DERIVED]` to fact.

---

## ⚠️ TWO CORRECTIONS TO THE PROMPT'S PREMISES, BEFORE ANYTHING ELSE

**① `SUPABASE_SERVICE_KEY` works, and #283 was right that it was empty — about a different file.**
The root `.env.local` carries `SUPABASE_SERVICE_KEY=""` (2 characters, an empty quoted string).
`packages/cultivar-os/.env.local` carries the real 219-character key. `[MEASURED]` A loader that
reads the root file second gets the empty one and reports a working key as absent. Everything in
this document is measured against the live database; tech-debt **#183**'s blocker is a load-order
defect, not a missing secret.

**② Tech-debt #121 is not what the prompt says, and this changes the sizing.** The prompt says
*"nothing in the system can mark a delivery complete — `scheduled` is the only value that exists and
`fulfilled` is unreachable."* `[REPO]` **The control is BUILT and SHIPPED**:
[DeliverySchedule.tsx:275-291](packages/cultivar-os/src/pages/DeliverySchedule.tsx#L275-L291) writes
`status='fulfilled'` + `started_at`/`completed_at` as an RLS UPDATE with `.select('id')` evidence.
`[MEASURED]` **And `20260831d` HAS been applied** — `started_at`, `completed_at`, `review_asked_at`,
`review_ask_outcome` all exist on the live `deliveries` table, which #121's row still calls "GATED
and UNAPPLIED". The true state is: **built, deployed, never used.** Of LAWNS's 38 deliveries,
**38 read `scheduled`, 1 has a `started_at`, 0 have a `completed_at`.** `[MEASURED]`

So #121 is not a build. It is an owner-proof and a habit. **Prerequisite (c) costs hours, not days.**

---

## VERDICT IN ONE LINE

🔴 **There is no object for a plant that has left the farm, there is no object for the PLACE it went,
and R-37 — a ruling David made on 2026-09-01 — expressly forbids minting one from history. That
conflict is this recon's headline and it has to be ruled before anything is scoped.**

---

# 1 · WHAT ALREADY EXISTS

## 1.1 The two candidate tables are a FARM-SIDE specimen model, and neither points at a customer

| | `cultivar_plants` | `plant_events` |
|---|---|---|
| Live rows, all tenants | **0** `[MEASURED]` | **0** `[MEASURED]` |
| Columns | `tag_id · species · common_name · plant_type · current_container · location_zone · warranty_months · photo_url · notes · business_id · inventory_id` | `plant_id → cultivar_plants.id · event_type · from_container · to_container · notes · employee_id · occurred_at · business_id` |
| Points at | `business_inventory` (a lot **on the farm**) | a `cultivar_plants` specimen |
| Points at a customer / order / address | **No column.** `[MEASURED]` | **No column.** `[MEASURED]` |
| RLS | `plant_events_business_owner FOR ALL USING (business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid()))` — **owner-only, not member-scoped** `[REPO]` `20260529_businesses_d_update_rls.sql:36` | same |

**Is `plant_events` "it"? No — it is the wrong end of the pipe.** Its FK anchor is a farm lot; its
vocabulary is `from_container` → `to_container`, i.e. **uppotting**. It models a plant *growing in
our rows*, not a plant *standing in someone's yard*. `location_zone` is a nursery block, not an
address. It has genuinely useful columns for our purpose — `warranty_months` is already there — but
adopting it means adding a customer, a site, an order line and a different lifecycle to a table
whose every existing column is about the farm.

**The "hard trigger" is a written precondition, not a database trigger.** `[MEASURED]` — a grep of
the whole migration corpus for `CREATE TRIGGER … plant_events` returns **zero**. What
`20260727c:58-62` says is: *"BEFORE THE FIRST plant_events ROW IS WRITTEN, a public PROVENANCE VIEW
must exist (id, plant_id, occurred_at, event_type only — no employee_id, no notes) with anon SELECT
on the VIEW, and `usePlant` repointed to it."* `[REPO]` The reason: `/plant/:tagId` is a **public**
route and `plant_events` lost its `anon` policy, so the first row written makes the public growth
timeline (US-002) render nothing, **silently**. That precondition is real, it is unbuilt, and **it
applies to any build that writes the first row into that table.** It is a ~2-hour view + repoint,
not a blocker — but it must not be discovered afterwards.

## 1.2 The other tables named, each answered

| Table | Live rows | What it actually is |
|---|---|---|
| `addons` | **0** all tenants `[MEASURED]` | Superseded by `service_offerings`. `order_addons` also **0**. |
| `deliveries` | 56 all / **38 LAWNS** `[MEASURED]` | 🔴 **The closest thing to a site record that exists** — see §2. |
| `order_service_selections` | 72 all / **0 on LAWNS orders** `[MEASURED]` | The per-order record that a service was bought. **Empty for LAWNS**, because all 37 LAWNS orders are `order_kind='history'` and the history writer does not write service selections. |
| `order_compliance_records` | **0** `[MEASURED]` | The netting-decline liability record. Unrelated. |
| `losses` | **0**, keys on `nursery_id`, pending DROP `[MEASURED]` | Dead. Its successor shape is `plant_events['lost']` per CLAUDE.md §2 — worth knowing when we choose a lifecycle vocabulary (§4). |
| `opportunity_items` | **0** `[MEASURED]` | Empty everywhere. |

## 1.3 🔴 THE SHAPE WE WANT ALREADY EXISTS — AIMED AT THE WRONG OWNER

This is the most important "does it already exist" answer, and it is not one of the tables the
prompt named.

`cost_objects` + `business_pmi_schedule` + `business_service_log` is **a physical object, on a
recurring service schedule, with a service history** — which is exactly the shape a planted tree
needs.

```
cost_objects           node_type (ASSET|PROJECT|PRODUCT|COST) · parent_id (containment tree)
                       name · make · model · serial_number · barcode_id · year
                       status · location · warranty_months · photo_url · is_active · notes
business_pmi_schedule  asset_id → cost_objects.id · interval_days · tasks jsonb
                       overrides jsonb · last_service_at
business_service_log   asset_id → cost_objects.id · service_type · performed_by
                       performed_at · cost · receipt_id · result · notes
```

`[MEASURED]` Live: **11 `cost_objects`** (6 LAWNS — *tractor, backhoe attachment, carhauler
trailer, 2-yard mixer, generator, electric car*), **3 PMI schedules** (one LAWNS, 30-day interval,
`last_service_at` NULL), **0 service-log rows.**

`node_type` is a **value**, not a table name, so extending it is AC-1-clean by construction. But
every row today is **equipment LAWNS owns**, and the tree in Terry's customer's yard is **not
LAWNS's asset** — it has been sold. Putting it in the cost tree puts customer property on the
business's balance sheet and into `parent_id` roll-ups that feed cost-to-produce. **That is a
semantic decision, not a schema one, and it is David's.** It is presented as a real option in §5
because the alternative is building a second copy of a schedule-plus-service-log we already have.

## 1.4 `customers` — DOES A FIELD ALREADY IDENTIFY A SERVICE SUBSCRIPTION?

**No.** `[MEASURED]` — the live column list is 38 columns, and the four that could plausibly carry it
are all doing something else:

| Column | Live values on LAWNS's 1,972 customers |
|---|---|
| `status` | `active` = **1,972**. One value, universal. It is an ACCOUNT state, and it has never been anything but `active`. |
| `customer_type` | `person` = 1,457 · `organization` = 515. A party-shape discriminator. |
| `price_tier` | `retail` = 1,971 · `CD10%` = 1. Pricing, not service. |
| `source` | `quickbooks-customers` = 949 · `ocr-invoice` = 28 · `qbo-shipdate` = 17 · `qr-scan` = 5 · `manual` = 1 *(across all tenants)*. Import provenance. |
| `payment_terms` | **NULL on all 1,972.** |
| `notes` | filled on **8 of 1,972.** |

There is **no subscription column, no service-plan column, no recurring flag, and no join table
from a customer to a service.** `service_offerings.timing` has a `recurring` concept
(`recurrence_days`) but **every one of the 23 live rows is `timing='at_checkout'`** `[MEASURED]` —
nothing recurring has ever been configured, on any tenant.

**Answered with a query, as asked: no field on `customers` identifies a service subscription.**

---

# 2 · SITE, NOT CUSTOMER — IS THAT EXPRESSIBLE TODAY?

## 2.1 The direct answer

**No site object exists.** `[MEASURED]` — of 55 live tables, exactly **five** carry an address, and
none of them is a place:

| Table | Address columns | What it means |
|---|---|---|
| `businesses` | `address` (one text blob) | our own shop |
| `nurseries` | `address` (one text blob) | dead generation, pending DROP |
| `vendors` | `address_line1 · address_city · address_state · address_zip` | who we buy from |
| `customers` | `address_line1 · city · state · zip` **and** `billing_line1 · billing_line2 · billing_city · billing_state · billing_zip` | the buyer |
| `deliveries` | `address_line1 · city · state · zip` | 🔴 **the only per-EVENT address in the system** |

## 2.2 🔴 THE "SHIP-TO" SLOT ON `customers` IS A COPY OF THE BILLING ADDRESS, MEASURED

It looks like a second address. It is not.

`[MEASURED]` on LAWNS's 1,972 customers:
- `address_line1` filled: **1,455**
- `billing_line1` filled: **1,455**
- rows where the two **differ**: **0**

The importer wrote one address into both slots. **The apparent shipping address on `customers` is
the billing address wearing a different column name.** Anything built on it would be building on a
duplicate.

## 2.3 🔴 AND HALF THE ADDRESSES ARE NOT ADDRESSES

This is the number that decides whether a site can be derived from `customers` at all. `[MEASURED]`
on the same 1,972 rows:

| | count | of 1,972 |
|---|---|---|
| No `address_line1` at all | **517** | 26% |
| `address_line1` is a **PHONE NUMBER** (`^\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$`) | **464** | 24% |
| `address_line1` contains no digit at all (*"Point Venture Park", "Hero Way West", "Old Alton Rd & Teasley", "East Austin"*) | 4 | — |
| **Street-shaped `address_line1`** | **≈987** | **50%** |
| Has an address but **no `state`** | 347 | — |
| Has an address but **no `zip`** | 336 | — |

**One customer row in two carries something a truck could drive to.** A planted record hung off
`customers.address_line1` would be wrong or absent for half the book — and *wrong* is the dangerous
half, because a phone number in a street field renders as an address and reads as one.

Both of the prompt's live cases confirm the shape, and one of them is worse than reported:

**Richard Franklin** `[MEASURED]` — **exists TWICE**, and the QuickBooks-sourced row
(`qb_customer_id=100000281`) has `address_line1 = "(254) 319-2192"`. The other row
(`f5bf7e78…`, no `qb_customer_id`, from OCR) carries the real street, `1402 CR 2109, Lometa TX
78653`. So the customer whose billing and shipping are 60 miles apart is **two rows, one of which
has a phone number where the street goes** — and neither row knows about Hutto.

**Tree Amigos LLC** `[MEASURED]` — `507add50…`, `organization`, `qb_customer_id=1136`, address
`1612 Plateau Ridge, Cedar Park`, `state` NULL, `zip` NULL. Every tree they bought is standing in
somebody else's yard, and the only address the platform holds for them is their own office.

## 2.4 🔴 `deliveries` IS ALREADY THE SITE — IT JUST DOESN'T KNOW IT

`deliveries` carries a **per-event** `address_line1/city/state/zip` that is independent of the
customer's. `[MEASURED]` on LAWNS's 38: **38 have an `address_line1`**, 37 have city+state+zip, 36
distinct addresses over 38 stops, 36 distinct customers. Zero customers currently have more than one
distinct delivery address — **but that is a population artefact, not a finding**: there are only 38
stops. Tree Amigos's 86 trees are not among them.

`shipmentIngest.ts` is the parse that fills it, and it is good work: **each line is classified by
its own SHAPE, never by position** `[REPO]`, and ambiguity ends as `blocked` with the raw lines
attached rather than as a guess. That is exactly the discipline a site record needs.

⚠️ **But it only looks forward.** `selectFutureShipments()`
([shipmentIngest.ts:403-407](packages/shared/src/quickbooks/shipmentIngest.ts#L403-L407)) filters
`isOnOrAfter(r.shipDate, today)`. `[REPO]` It is a **scheduling feed**. A history backfill needs the
opposite filter over the same parse — which is one predicate, not a new parser.

## 2.5 WHAT A SITE WOULD HAVE TO BE

Derived from what the data actually supports:

1. **Identity is the normalised address, not the customer.** Two customers at one address is real
   and measured — 14 addresses are held by more than one customer row, 33 rows involved; the top
   one (`400 honeycomb mesa | leander`) is held by **6**. `[MEASURED]`
2. **The customer→site link is many-to-many and is a ROLE, not ownership.** Tree Amigos *bought for*
   a site; the homeowner *lives at* it. A single `site.customer_id` re-creates the bug.
3. **It must tolerate an unknown address**, because half the book has none. A site whose address is
   `null` and whose only identity is "the place invoice 3648.666 shipped to" is honest; a site
   silently created at the billing address is a lie that routes a truck.
4. **It is derived from `deliveries`, not from `customers`** — that is the only column set in the
   system that was ever populated with where something went.
5. **No geocode.** As instructed: a site needs an address, not coordinates. The enrichment attaches
   later, to a stable site id.

---

# 3 · THE BACKFILL AS A COMPUTATION — AND WHERE IT IS LOSSY

## 3.1 The four questions, answered in order

### (a) *Is the tree name and size reachable from `order_items.description`, or only from `receipts.line_items_original`?*

**From `description`. `receipts` is not the source and cannot be.** `[MEASURED]`

- LAWNS `order_items`: **127 rows**, 126 on history orders.
- `business_inventory_id` NULL: **126 of 126** — by design (`20260827_history_orders.sql`).
- **`description` filled: 126 of 126.**
- `sku` filled: 115 of 126 (`CHO95`, `Oak:MO45`, `Holly:EH45TF` — QuickBooks item names, sub-item
  structure intact).
- LAWNS `receipts`: 118 rows, 115 with `line_items_original`, 443 original lines — but these are
  **PURCHASE** documents (vendor invoices *to* LAWNS: *"Services Devin — Texas Materials Ticket
  #126179163"*). Only **9 of 37** LAWNS orders carry a `receipt_id` at all. `receipts` is the wrong
  table for this question.

### (b) 🔴 *What is the real ceiling against live data?*

I ran the **shipped** parser — `readProductFromDescription`, the one `invoiceList.ts:317` uses — over
all 126 live descriptions. `[MEASURED]`

| outcome | lines |
|---|---|
| `sized` | **61** |
| `not_stated` | 51 |
| `could_not_read` | 14 |

**48%.** And the failures are not random — **the parser is TAIL-ANCHORED** (`readProductFromDescription`
walks back from the END of the string and stops at the first size-shaped token). Catalogue
descriptions put the size last. **Invoice line descriptions do not**:

```
Eagleston Holly (Tree Form) - 30 Gallon (Sale) Install & Warranty     → not_stated
Chinkapin Oak - 45 gallon (Buy One Get One Half Off) Install & Warranty → not_stated
Improved Brown Turkey Fig - 15G Install & Warranty                    → could_not_read
```

A ~15-line suffix strip (`Install & Warranty`, `(Sale)`, `(Bogo)`, `(NN% Off)`, `(Buy One …)`)
lifts it to **68 of 126**. `[MEASURED]` The 58 that remain unsized are almost entirely **not trees**
— *Trip Charge · Tree Bubbler · Trunk Protection · FUEL Surcharge · Morning Delivery · Tailgate
Delivery · Customer Discount · Military Discount 5% · Flat fee · CREDIT CARD FEE · materials tickets*
— plus two genuine misses (`Monterrey Oak - 45 gallon (15% Off Fall Sale)`, a promo phrase the strip
does not know) and two lines that truly state no size (`Blue Point Juniper (Replacement)`).

**So the honest ceiling on tree lines is high — near-total after a suffix strip — and the 48%
headline is measuring fees and discounts as failures.**

### 3.2 🔴 A NEW DEFECT, IN SHIPPED CODE, FOUND BY THIS MEASUREMENT — TECH-DEBT #223

`invoiceList.ts` already carries **both** halves of what a planted record needs, and one of them is
broken on exactly the population it exists for.

```ts
// invoiceList.ts:313, :317   [REPO]
installInDescription: mentionsInstall(str(l?.Description)),
sizeFromDescription:  readProductFromDescription(str(l?.Description)).size,
```

`mentionsInstall` is the planted flag — `[REPO]` its own comment records **976 lines announce
install in prose** across LAWNS's 1,481-invoice export. `sizeFromDescription` is the size beside it,
and it is the **tail-anchored** parser.

`[MEASURED]` on the 126 live lines:

| | |
|---|---|
| Lines where `mentionsInstall === true` | **20** |
| …of which `sizeFromDescription` returns a size | **11** |
| …of which `sizeFromDescription` returns **NULL** | **9 (45%)** |

🔴 **And the loss is SYSTEMATIC, not random: all nine carry a PROMOTION.** `(Sale)`, `(15% Off)`,
`(Bogo)`, `(Buy One Get One Half Off)`, `(15% Fall Sale)`. The promo phrase sits between the size and
the `Install & Warranty` suffix, so the tail-walk finds the suffix, declines, and stops.

**The consequence reaches a number David has already been given.** #283's placement ladder
(7gal $101 · 15gal $214 · 30gal $418 · 45gal $529 · 65gal $650 · 95gal $906, median ratio 2.00 over
909 planted lines) is computed by comparing the same plant sold planted against bare, **split by
`sizeFromDescription`**. If ~45% of planted lines lose their size and **the ones lost are the
discounted ones**, the planted side of every rung is measured on the full-price sales. That biases
the premium **upward**, and it is invisible because the dropped lines simply never enter a bucket.

⚠️ **I have not re-derived the ladder** — that needs the QuickBooks capture, not the 38 live orders,
and re-running a shipped measurement is a build, not a recon. **What is measured is the parser's
behaviour on real line text, and that the bias has a direction.** Filed as **#223**, and it is worth
fixing before the ladder is quoted to Terry.

### (c) *Does the units backfill reach these rows, or only `business_inventory`?*

**Only `business_inventory`. `[MEASURED]` across all 55 live tables:**

- `size` exists on **`business_inventory` and nowhere else.**
- `unit_kind · unit_value · unit_value_max · unit_name · unit_parsed_from` exist on
  **`business_inventory` and nowhere else.**
- `order_items` has **no size column, no unit column, and no link to a catalogue row.**

On LAWNS's 1,094 inventory rows the projection is healthy: `size` set on 983, parser ran on **983 of
983**, `unit_kind` resolved on **983** — `container` 973 · `length` 6 · `each` 3 · `volume` 1.
`[MEASURED]` The backfill works. **It just cannot see a sold line.**

### 3.3 🔴 AND THE JOIN BACK TO THE CATALOGUE IS DEAD BY EVERY KEY

This is the structural finding, and it is the one that decides the shape of the object.

`[MEASURED]`

| key | state |
|---|---|
| `business_inventory.sku` | set on **2 of 1,094** rows — the QuickBooks items carry `Sku` on 2 of 685 (R-98), so the import wrote none |
| `order_items.sku` | set on **115 of 126** — QuickBooks item *names* (`Oak:MO45`) |
| **`order_items.sku` → `business_inventory.sku` matches** | **0 of 126** |
| `business_inventory.qb_item_id` | set on **647** rows — Intuit's `Item.Id`, the real identity |
| `order_items.qb_item_id` | **column does not exist** |

`[REPO]` And the key **is read and thrown away**:

```ts
// invoiceOrderLines.ts:117-120  — the identity is parsed
const itemRef = (detail?.ItemRef ?? null) as { value?: unknown; name?: unknown } | null;
itemId: str(itemRef?.value),

// invoiceOrderLines.ts:241, :242 — and the write keeps the NAME and drops the ID
sku: l.itemName,
businessInventoryId: null,
```

The comment at `:238-240` explains keeping the name (it preserves Terry's `Oak:` categorisation, and
`order_items.sku` is declared free text) — **that reasoning is right and the id should have been kept
too.** They are not alternatives.

**This is the same shape as the geocoder in `DeliveryRoute.tsx` that computes coordinates and
discards them.** One nullable column and one line at the write would make every sold line point at
its catalogue row, and through it at `size`, `unit_kind`, `unit_value` — **the entire units
projection, for free, on every planted tree.** Without it, species and size must be re-parsed out of
prose forever, at the ceiling measured in (b).

## 3.4 ⚠️ THE TWO POPULATION FIGURES DISAGREE, AND I AM NOT RECONCILING THEM

The prompt and the repo describe different passes over the same books. Both are David's own
measurements; I could reach neither source this session (the QuickBooks capture is not in the repo
and I made no Intuit call).

| | prompt (this session's export pass) | repo `[REPO]` |
|---|---|---|
| invoices | 260 | **1,469** total / **1,481** export / **564** carrying a `ShipDate` |
| customers | 237 | up to **489** resolutions |
| trees | 1,300 | **1,565** item lines |
| container gallons | 39,352 | — |
| size readable | **260 of 678 delivered** | — |
| planted signal | — | **976 lines** with install wording; **163 of 1,469** invoices carrying literal `(Install & Warranty)`; **0 of 124** `Tailgate Delivery` invoices |

`[DERIVED]` The likeliest reading is that 260/678 is a *delivered-invoice* subset and 1,469 is the
whole company file — but **that is a guess and it is marked as one.** The sizing in §5 uses the repo
numbers, because they are the ones with a written derivation attached.

## 3.5 WHAT THE DERIVATION ACTUALLY LOOKS LIKE AGAINST LIVE TABLES

**It does not, yet — and that is the answer.** `[MEASURED]` LAWNS holds **38 orders** and **126 order
lines** live, against 564–1,469 invoices in QuickBooks. The history import
(`ship_date_as_delivery_date`, `history_order_per_invoice`, `customer_create_or_match`,
`chunked_resumable_import`, `bounded_delivery_read`, `warranty_window_read`, `past_stop_is_fulfilled`)
is **an existing, ruled, unbuilt story** — `user_stories.md` → *"The calendar holds what actually
happened — fourteen months of it, imported once"*, `MAPS-TO: 3.4, 3.5, 2.1`. **One of its seven
pieces is built** (`bounded_delivery_read`, ledger #251).

**So the backfill is not a computation we design. It is a computation David already ruled, and the
planted record is a consumer of it.** Sequencing matters more than sizing here.

---

# 4 · STATUS — WHAT LIFECYCLE, AND WHAT TO REUSE

## 4.1 🔴 THE CONFLICT THAT HAS TO BE RULED FIRST (§9 story-reconciliation gate: CONFLICT → STOP AND SURFACE)

**R-37, David, 2026-09-01** `[REPO]`, quoted rather than cited:

> *"AND THE SYSTEM NARROWS RATHER THAN ADJUDICATES: it computes the window and surfaces the
> candidate set; it does **not** assert that a given tree is covered, and **no `planted_by_lawns` or
> `warranty_expires` column is minted on the strength of history.**"*

And the story it governs, in its own words:

> *"It must NOT assert that a given tree is covered, because whether LAWNS *planted* it is not
> reliably knowable from this data — `(Install & Warranty)` is typed by hand into a line
> description… A candidate set is a large improvement on a paper hunt; a confident wrong coverage
> answer is worse than none."*

**A `planted_trees` table backfilled from invoice history is precisely the thing R-37 declines.** It
is a stored assertion that this tree is in this ground, derived from hand-typed prose.

⚠️ **It also names a second deferral that this build would collide with:** `Tailgate Delivery` is a
measured install signal (**0 of 124** tailgate invoices carry install wording, against 163 of 1,345)
and R-37 **defers it to its own build** — *"no `planted_by_lawns` column, no coverage boolean,
nothing derived on the strength of history inside an import."*

**This is not a reason not to build it. It is a reason David has to say which of three things he
means**, and the answer changes the object:

- **(i) R-37 stands.** The planted record is written only **going forward**, at fulfilment. History
  stays a *candidate set* computed on read, asserting nothing. Smallest, safest, and Terry's
  fertiliser round has almost no data for a year.
- **(ii) R-37 is amended for a record that carries its own doubt.** History is written, and **every
  row states how it was derived and how confident that is** — `source: 'invoice-prose' | 'fulfilment'`
  plus a confidence, rendered on every screen. This is the `cost_confidence` /
  `estimated_value_confidence` pattern already live in `cost_objects`, applied to provenance. It
  satisfies R-37's *intent* (never a confident wrong answer) without its *letter*.
- **(iii) R-37 is lifted.** History is written as fact. Fastest to a usable fertiliser list,
  and it is the option R-37 was written to prevent.

**My read: (ii).** It is the only one that gives Terry a list this season while keeping the promise
R-37 actually makes. But it is an amendment to a ruling, and that is David's alone.

## 4.2 WHAT STATES A PLANTED TREE NEEDS

Derived from LAWNS's own live data, not invented `[MEASURED]` / `[REPO]`:

| state | evidence it is real |
|---|---|
| **standing** | the default |
| **replaced-under-warranty** | 🔴 **live in the data**: `Blue Point Juniper (Replacement)`, `Arizona Cypress Blue Ice (Replacement)` — 2 of 126 lines, sku `BPJ30REP`. `[MEASURED]` And `user_stories.md:377` `[REPO]`: invoice **#3648.563** totals **$0.00**, carries a real ship date and address, and holds **two real trees — warranty replacements the customer already paid for once.** A replacement is a *new* planted row **and** a terminal state on the old one; the pair must stay linked or the warranty clock restarts invisibly. |
| **dead / removed** | `Existing tree removal` is a live line. `[MEASURED]` |
| **sold with the house** | no data, but it is why the record hangs off the SITE — the tree stays, the customer changes. §2.5 clause 2. |
| **unknown** | the honest default for every backfilled row under §4.1 (ii). |

## 4.3 IS THERE A LIFECYCLE TO REUSE? — FOUR CANDIDATES, THREE REJECTED

**① `soft_delete_inventory`'s tombstone — REJECT, and it is a warning not a model.**
`[REPO]` Tech-debt **#192**: the RPC writes `status='deleted'`, which is **not in
`ALL_STATUS_VALUES`** (`available · depleted · damaged · returned · archived`), and 5 rows carry it
live. `[MEASURED]` LAWNS's `business_inventory.status` today: `available` 648 · `depleted` 444 ·
`archived` 2. Tech-debt **#71** is the deeper one: **one `status` column with two authors** — D-42's
qty-derive overwrites D-52's tombstone, so a deleted lot reads `depleted` and a manual `archived`
reverts. **Copying this is copying a known defect.** Its own fix is *"lifecycle state in its own
field"* — which is the lesson to take, not the shape.

**② `retired_at` / `retired_reason` — REUSE THE PATTERN, NOT THE COLUMNS.**
`[REPO]` `20260903_inventory_retire_lifecycle.sql`: *"Retirement is HIDING, never deletion."*
`[MEASURED]` 447 of 1,094 LAWNS rows retired, 647 live. **A nullable terminal timestamp + a reason
in the owner's words, separate from the operational status field** is exactly right for a planted
tree — it survives #71's two-authors problem by not sharing a column with anything derived.

**③ `business_inventory_ledger` — REUSE THE SHAPE, DO NOT WRITE INTO IT.**
`[MEASURED]` LAWNS: 465 rows — `opening_balance` 446 · `order_fulfilled` 5 · `count_reconcile` 3 ·
`adjust` 2 · `delete_tombstone` 2 · `order_cancelled` 2 · `order_deleted` 2 · `sale` 1 ·
`order_created` 1 · `order_committed` 1. Append-only with a trigger that rejects UPDATE **even for
`postgres`** `[REPO]` (tech-debt #70). It is scoped to *stock on the farm* (`inventory_id` FK), so a
planted tree's history does not belong in it. ⚠️ **But #70 is the trap to avoid**: its D-50 backfill
stamped ~126 genesis rows with `occurred_at = now()` at migration time, which then replayed as fresh
arrivals in a time-windowed read. **A backfilled planted row dated at import time would do the same
thing to the fertiliser round and the warranty clock** — the date must be the `ShipDate` or the row
must say it has none.

**④ `plant_events` — REUSE THE VOCABULARY IDEA, ON A NEW ANCHOR.**
An append-only event stream keyed to a specimen is the right model for *planted → inspected →
fertilised → replaced → removed*. The table itself is farm-anchored and owner-only (§1.1). The
`losses` shape (`plant_id · reason · estimated_value · occurred_at`) is the death event, already
designed, on a table pending DROP — worth reading before inventing one.

**Recommended lifecycle**, assembled from what is proven here rather than designed fresh:
a **`status`** in its own field with a closed vocabulary (`standing · replaced · removed · unknown`),
a **`retired_at`/`retired_reason`** pair for the terminal fact, a **`replaced_by` self-FK** so the
warranty clock is traceable across a replacement, and an **append-only event stream** for the service
history. Nothing derived shares a column with anything stored — #71's whole lesson.

---

# 5 · THE NUMBER

**Estimates are `[DERIVED]`.** They assume this project's shape: measured-first, red-first probes,
mutants, a cap where a cap is possible, owner-test cards, and `npm run verify` green with zero
net-new. They do **not** include owner-proof time.

## 5.0 What must be answered before any of it is scoped

| # | question | blocks |
|---|---|---|
| **Q-A** | **R-37: (i), (ii) or (iii)?** (§4.1) | **(a) and (b) entirely.** Under (i) there is no backfill. |
| **Q-B** | Extend `cost_objects` with a `PLANTED` `node_type`, or a new table? (§1.3) | (a)'s shape and (d)'s cost |
| **Q-C** | Is a **site** its own object now, or does the planted row carry a denormalised address until a second site appears? | (a)'s shape |
| **Q-D** | The `plant_events` public-provenance-view precondition (§1.1) — does it apply if we anchor elsewhere? | (a), ~2h if yes |

## (a) The object itself and its policies

**2–3 days.**

- One migration: the planted table (or the `cost_objects` extension), the site table if Q-C says so,
  `business_id`-scoped RLS on the `is_active_member` / `has_permission` primitives (AC-2), a
  permission string, the closed status vocabulary as a **named** CHECK (tech-debt #91's lesson).
- ⚠️ **AC-1 is the live risk.** A table named for trees is a vertical noun in shared schema. The
  clean form is a **value** — `node_type='PLANTED'` on `cost_objects`, or a neutrally-named table
  whose vertical identity is a column. §1.5 already carries one live AC-1 violation in
  `populate.ts:77`; this build must not add the second.
- ⚠️ **The `20260905_production_planning.sql` precedent** — `[MEASURED]` all three of its tables are
  **absent from the live database** and it is **not re-paste safe** (12 `CREATE POLICY`, 0 drops).
  This migration ships idempotent from line one.
- **Depends on:** Q-A, Q-B, Q-C, Q-D. **Blocked by nothing else.**

## (b) The backfill from history

**Under R-37 (i): does not exist.**
**Under (ii) or (iii): 3–5 days — and only ~1 of those is the planted record.**

The other 2–4 days are the **history import itself**, which is a ruled, unbuilt, 7-piece story with
1 piece done (§3.5). **Do not price the backfill without it; it is the backfill.**

Within that:
- Suffix-strip the size parser and fix **#223** (§3.2) — **half a day**, and it should happen
  regardless of Q-A because the ladder already depends on it.
- Carry `ItemRef.value` through to `order_items` (§3.3) — **half a day**, one nullable column, one
  line at the write, one backfill. 🔴 **Highest value-per-hour item in this document.** It turns
  every sold line into a pointer at `size`/`unit_kind`/`unit_value` and retires the prose parse for
  everything imported after it.
- Invert `selectFutureShipments` for a past window (§2.4) — **hours**, one predicate.
- **Depends on:** (a), Q-A. **Blocked by** the history import story being sequenced.

## (c) Writing a row at fulfilment, going forward

**1–1.5 days.** 🔴 **And #121 is NOT the blocker the prompt expects.**

The mark-complete write already exists, already has evidence-checking, and already sets
`completed_at` (§⚠️② above). The planted write hangs off
[DeliverySchedule.tsx:280](packages/cultivar-os/src/pages/DeliverySchedule.tsx#L280), in the same
transaction as the `fulfilled` update.

**#121's real cost is not code.** It is: **0 of 38 LAWNS deliveries have ever been completed.**
`[MEASURED]` Until the crew taps the button, (c) writes nothing on any real job — so (c) is
**hours of build and a habit change**, and the habit is the expensive half.

⚠️ One genuine gap remains inside #121 and it touches this: **a RESCHEDULE cannot say where it went
or why** — the `why` vocabulary is **owed by David**. `[REPO]` A planted record written on
completion inherits that hole.

- **Depends on:** (a). **Blocked by:** nothing. **Needs from David:** the reschedule vocabulary
  (small), and the crew habit (not a build).

## (d) The first consumer — the fertiliser round's material roll-up

**2–3 days if it reads a planted record. Days-to-weeks if it must also do (i)'s read-time derivation.**

- Group planted rows by species × container size → material quantities. **The unit projection
  already does the arithmetic** if (b)'s item-id carry-through lands; without it, this re-parses
  prose and inherits the §3.1(b) ceiling.
- ⚠️ **The size vocabulary must be normalised before grouping.** `[MEASURED]` LAWNS's live catalogue
  holds **60 distinct raw size labels collapsing to 24** through the shared `normalizeSize` —
  `15 Gallon ← 10/15 gallon | 15 gallon | 15g | 15 Gallon | 15G | 15 Gallons | 15 gal`. Use the one
  shared function; a second spelling comparison is tech-debt **#56**'s defect at a new address, which
  #283 already hit once this month.
  🔴 **And two normalisations are wrong in a way that matters here**: `10/15 gallon → 15 Gallon` and
  `3/5 Gallon → 5 Gallon` **silently discard the other end of a range** (tech-debt **#125**), and
  `45-gallon empty used bucket → 45 Gallon` **normalises a BUCKET into a tree size.** A fertiliser
  mix computed over those is wrong by a real margin.
- **Depends on:** (a) + one of (b)/(c) having produced rows. **Blocked by:** Q-A — under (i) there is
  no historical population to roll up for roughly a year.

## Explicitly NOT blockers — checked, each one

| named in the prompt | verdict |
|---|---|
| **defect ①** (the optimised route lost at the handoff, `DeliveryRoute.tsx:496`) | **Not a dependency.** `[REPO]` It is a Google Maps URL built before the optimiser runs, on the routing surface. A planted record neither reads nor writes it. |
| **geo/address enrichment** | **Not a dependency, as instructed.** A site needs an address; it does not need a geocode to exist. |
| **the three dead service KINDs** (`maintenance`, `inspection`, `subscription`) | **Not folded in.** `[MEASURED]` `service_offerings.category` live: `addon` 10 · `transport` 5 · `inspection` 4 · `subscription` 4 — and **all 23 rows are `timing='at_checkout'`**, none recurring. The 8 inspection/subscription rows belong to Test Dave's and Test David's; **LAWNS has 4 offerings** (`tree placement` $125/plant, `Tree Tarp` $35/order, `Tree Bubbler` $65/plant, `Trip Charge` $50/order — the last created **today at 20:39** by the services review). ⚠️ **The dependency is real and it is (d)'s, not (a)'s**: Terry cannot *sell* a fertiliser round until a recurring service KIND renders somewhere. |
| **tech-debt #121** | **Prerequisite of (c), and it is hours not days** — see §⚠️② and (c). |

## The staging I would recommend

| | | |
|---|---|---|
| **0** | **David rules Q-A** (§4.1) | everything downstream changes shape |
| **1** | **#223** (the install-line size blind spot) + **the `ItemRef.value` carry-through** | **≈1 day, no schema decision needed, and both pay for themselves immediately.** #223 corrects a number already quoted; the item-id makes every later step cheaper. **Do this whatever Q-A says.** |
| **2** | **(a)** the object | 2–3 days |
| **3** | **(c)** write-at-fulfilment | 1–1.5 days — starts producing real rows on the next real job |
| **4** | **(b)** the backfill, inside the ruled history-import story | 3–5 days, Q-A-dependent |
| **5** | **(d)** the fertiliser roll-up | 2–3 days |

---

# APPENDIX — WHAT I COULD NOT MEASURE

- **Anything in LAWNS's QuickBooks.** No Intuit call was made. Every invoice-population figure
  (260 / 678 / 1,469 / 564 / 976 / 163 / 124) is quoted from the prompt or the repo, attributed, and
  **not independently verified.** §3.4 states the discrepancy rather than resolving it.
- **The placement ladder re-derived under a fixed parser.** §3.2 measures the parser's behaviour on
  real line text and the **direction** of the bias. It does not restate the rungs.
- **`pg_policies` / `information_schema` directly.** PostgREST exposes tables, not the catalog. RLS
  claims here are read from migration files `[REPO]`; column and row facts are `[MEASURED]` live.
- **How many QuickBooks invoices carry a `ShipAddr`** — the site-derivation ceiling. It needs the
  capture or a live call.

---

# NEW TECH-DEBT FILED BY THIS RECON

- **#223** 🔴 `sizeFromDescription` is tail-anchored and **returns NULL on 9 of 20 live planted
  lines (45%)** — and **every one of the nine carries a promotion**, so the loss is biased toward
  discounted sales. It feeds #283's placement ladder, which is therefore measured on full-price
  planted lines. `invoiceList.ts:317` → `readProductFromDescription`. **Measured, not inferred.**
- **#224** 🟡 `invoiceOrderLines.ts:120` parses `ItemRef.value` and `:242` drops it — **0 of 126
  sold lines can reach their catalogue row by any key** (`order_items.sku` → `business_inventory.sku`
  matches 0; `business_inventory.sku` is set on 2 of 1,094). The geocoder-discards-coordinates shape.
- **#225** 🟡 `customers.address_line1` **is a verbatim copy of `billing_line1` on all 1,455 rows
  that have one** (0 differ), and **464 of them are a PHONE NUMBER**. Any consumer reading it as a
  ship-to address is reading billing, and one time in three is reading a phone number as a street.
- **#226** 🟡 Tech-debt **#121's own row is stale in the direction that hides work already done**:
  it says `20260831d` is *"GATED and UNAPPLIED"*; the four columns are live. The remaining gap is
  usage (0 of 38 completed) and the reschedule `why` vocabulary, not the migration.
- **#227** 🟡 `SUPABASE_SERVICE_KEY` is set in `packages/cultivar-os/.env.local` (219 chars) and set
  to `""` in the repo-root `.env.local`. A loader reading root-last reports a working key as absent
  — the blocker recorded against **#183** and repeated in **#283(e)**.
