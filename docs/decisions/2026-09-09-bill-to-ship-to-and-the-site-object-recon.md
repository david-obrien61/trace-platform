# BILL-TO / SHIP-TO AND THE SITE OBJECT — STAGE 0 RECON

**Date:** 2026-09-09 · **Bar:** RECON / READ-ONLY · **Branch:** `main` · **Base SHA:** `f5f40e3`
**Type:** RECON. **Nothing was written under `packages/`, `api/` or `supabase/`. No migration, no code, no branch, no permission string, no `api/` function.** This file is the only artefact.

**Provenance marks are load-bearing.** `[MEASURED]` was proven against the live database or LAWNS's own
QuickBooks capture. `[STATED]` is what a file says about itself. `[INFERRED]` has not been checked and must
not be promoted to fact. ([[R-26]])

**What was opened.** The live cultivar-os database via the service key in `packages/cultivar-os/.env.local`
(HTTP 200, 55 tables enumerated from the PostgREST schema); LAWNS's complete QuickBooks captures
`qbo-customers-9341455222430707-2026-09-07T17-19-19-106Z.json` (1,953 of 1,953, `complete: true`) and
`qbo-invoices-9341455222430707-2026-09-04T17-19-23-405Z.json` (1,481 of 1,481, `complete: true`); fifteen
migrations; and every read/write site of an address column under `packages/`, `api/` and `scripts/`.

---

## 0 · THREE PREMISE CORRECTIONS, AND EACH ONE CHANGES THE ANSWER

### ① THE SHIP-TO ALREADY REACHES THE DELIVERY ROW, AND ALWAYS HAS

The prompt asks for *"the exact line where the customer-create call is assembled without it."* **That line
does not exist.** `ReceiptKeeper.tsx:743-746` assembles the delivery block **ship-to first, bill-to as
fallback**, and `customers/create.ts:111-114` writes it onto the row. **The `ocr_raw` recovery path is
unnecessary.** [MEASURED] — full chain in §G2.

### ② `customers` IS NOT OWNER-ONLY

Since `20260727_rbac_resource_action_flip.sql:172-179` it carries three member policies — SELECT / INSERT /
UPDATE, each `is_active_member(business_id) AND has_permission(business_id, 'customers:<verb>')`. DELETE
stays owner-only by ruling (R2 — *"a column is not a tombstone"*). [STATED — the repo; apply-state unverified, see §LIMITS]

### ③ 🔴 A STORY COVERS THIS, IT IS OWNER-PROVEN, AND IT RULES AGAINST A SITE OBJECT

`user_stories.md:1680` — *"The repeat customer — same contractor, three job sites"*, `ARC: delivery`,
OWNER-PROVEN 2026-07-03:

> "Dave's Tree Service orders three loads in one week, shipping to three different job sites… TRACE sees one
> billing identity (name + billing address), not three new customers, and lands three DELIVERIES under the
> one CUSTOMER… **Because identity lives on the customer and destination on the delivery, fixing the name
> once reflects everywhere.**"

**This is #286's shape again — the archived story board holding the answer the recon was commissioned to
find.** The recon's own opening read reported no story covered the site question; the story gate found one,
owner-proven, ruling the opposite way.

---

## G1 · THE LIVE SHAPE

🔴 **`customers` HAS NO `CREATE TABLE` ANYWHERE IN `supabase/migrations`.** `20260907b:16-18` states it —
*"live-only schema… no repo-parsing cap can see its constraints"* (tech-debt #39). So the table below is read
from the **live PostgREST schema**, not from a migration.

### `customers` — every address-related column [MEASURED, live schema]

| column | type | null | default | created by |
|---|---|---|---|---|
| `address_line1` | text | YES | — | **live-only, no migration exists** |
| `city` | text | YES | — | live-only |
| `state` | text | YES | **`'TX'`** | live-only; `NOT NULL` dropped by `20260907b:52` |
| `zip` | text | YES | — | live-only |
| `billing_line1` | text | YES | — | `20260713_customers_party_record.sql:60` |
| `billing_line2` | text | YES | — | same, `:61` |
| `billing_city` | text | YES | — | same, `:62` |
| `billing_state` | text | YES | — | same, `:63` |
| `billing_zip` | text | YES | — | same, `:64` |

The party-record migration states the model in its own header (`:20-26`): *"BILLING address = stable COLUMNS
on the customer… **SHIPPING is deliberately NOT on the customer record** — a customer does not 'have a
shipping address'; an ORDER does. Ship-to is entered per-order and snapshotted onto the delivery row."*

🔴 **`state DEFAULT 'TX'` IS A LIVE AC-1 LEAK WITH NO REGISTER ENTRY.** A hardcoded jurisdiction sitting in
shared schema. The second copy is `state: state.trim() || 'TX'` at `CustomerCapture.tsx:274`. Neither is in
`docs/decisions/HARDCODED-REGISTER.md`. **Flagged, not filed** — filing a register item inside a read-only
recon is the drift the gate exists to catch.

### `deliveries` — created whole by `20260620_deliveries.sql:27-40`

All four address columns `text NULL`: `address_line1`, `city`, `state`, `zip`. Later additions: `service_type`
(20260620b) · **`order_id`** (`20260827_history_orders.sql:108`) · `qb_invoice_id` (20260831) · the
fulfilment/review columns (20260831d).

### 🔴 THERE IS NO COORDINATE COLUMN ANYWHERE

**Zero `lat` / `lng` / `latitude` / `longitude` / `geography` / `geometry` columns across all 55 live tables.**
[MEASURED — every column name in the PostgREST definition set, pattern-matched.] Independently confirmed by
`docs/decisions/2026-08-24-route-proximity-opportunities-parked-spec.md:88`. The geocoder at
`DeliveryRoute.tsx:187-203` resolves every stop in the browser and **discards the coordinates**.

`billing_line2` is populated on **0 of 1,972** LAWNS rows. [MEASURED]

---

## G2 · WHERE AN OCR-INVOICE DELIVERY GETS ITS ADDRESS — THE FULL CHAIN

| # | file:line | what happens |
|---|---|---|
| 1 | `packages/cultivar-os/api/receipts/ocr.ts:126-127` | `INVOICE_PROMPT` asks for **both** `bill_to` and `ship_to`; `:146` rules *"bill_to is the customer's billing address; ship_to is the delivery address — keep them separate even if identical"* |
| 2 | `ReceiptKeeper.tsx:395-396` | both blocks land in state as `billLine1…` / `shipLine1…` |
| 3 | `ReceiptKeeper.tsx:668` | the `receipts` INSERT — **carries no ship-to column**; the only survivor is `ocr_raw` |
| 4 | 🔴 **`ReceiptKeeper.tsx:743-746`** | **the ship-to reaches the delivery here**: `line1: invoice.shipLine1.trim() \|\| invoice.billLine1.trim()` |
| 5 | `ReceiptKeeper.tsx:761` | ONE `POST /api/customers/create` carrying `customer` **and** `delivery` |
| 6 | 🔴 **`customers/create.ts:111-114`** | **the address lands on the row**: `address_line1: addr.line1 \|\| null` |
| 7 | `customers/create.ts:184-188` | the only `receipts` SELECT in the repo — reads `ocr_raw` for the **history order's money**, not for an address |

**[MEASURED] 56 delivery rows platform-wide, 0 blank `address_line1`, 0 null `customer_id`.** LAWNS holds 38
(19 `ocr-invoice` + 19 `qbo-shipdate`); the remaining 18 sit in the two test tenants.

### ⚠️ THE BUG ADJACENT TO IT, ON THE CUSTOMER SIDE — AND IT IS THE ONE WORTH FIXING

`ReceiptKeeper.tsx:731` sets the **customer's** `address_line1` to `billLine1 || shipLine1` — **the reverse
fallback**. When an invoice prints no bill-to, the job site is written as the billing address. And
`customerUpsert.ts:229-241` then uses that very column as **half the organization dedup key**:

```
const nameKey = normalizeMatchKey(customer.first_name);    // org name lives in first_name
const billKey = normalizeMatchKey(customer.address_line1); // BILLING address
```

🔴 **So a contractor billed to one office and shipped to three sites, on bill-to-less invoices, mints THREE
CUSTOMER ROWS — the exact defect the "three job sites" story was owner-proven to have closed.** It is latent
today only because most of their invoices carry a bill-to. This is D-47 / tech-debt #53's scar (*"Dave's Tree
Svs → 3 duplicates, nine real invoices cross-billed"*) reachable by a different route.

### THE SECOND DOOR IS ALREADY BUILT AND IS BETTER

The 19 `qbo-shipdate` stops arrive through `shipmentIngest.ts:255-345`, a complete ship-to classifier whose
own header (`:257-260`) states the design:

> "🔴 THE STREET COMES FROM `ShipAddr` AND ONLY FROM `ShipAddr`. `BillAddr` is where the bill goes… a
> contractor's ship-to varies per JOB SITE while their billing address does not."

It turns Intuit's free-form block into `{addressLine1, city, state, zip, phone, nameLine}` **or a named
refusal** (six of them), and uses `BillAddr` only to supply a *missing town*. **Any build below reuses this
rather than parsing an address again.**

---

## G3 · THE IMPORT'S RECONCILE BRANCH — CONFIRMED, AND THE POPULATION IS 100%

**Three columns. Named as a constant, asserted by test.** `customerImportWriter.ts:175`:

```ts
export const CUSTOMER_RECONCILE_COLUMNS = ['tax_exempt', 'tax_exempt_reason', 'tax_exempt_cert_ref'] as const;
```

The UPDATE at `:322-331` writes exactly those. **No address field of either set.** The reason is written down
at `:66-70` and it is a good one:

> "⚠️ NAME, EMAIL, PHONE AND ADDRESS ARE NOT TOUCHED ON AN EXISTING ROW. Those may have been curated locally
> — corrected by Lauren, filled from a delivery, fixed after a bounced email — and QuickBooks is not
> automatically the better copy."

The INSERT path (`:194-201`) writes canonical **and** mirror together (D-41).

### [MEASURED] live, and sharper than the prompt estimated

| | |
|---|---|
| LAWNS customers | **1,972** |
| carrying `import_run_id` (import-created) | 1,936 |
| **pre-existing** (no `import_run_id`) | **36** |
| of those, carrying a `qb_customer_id` | **19** |
| 🔴 **of those 19, holding NO address at all** (`billing_line1` and `address_line1` both null) | **19 — all of them** |

**Those 19 are exactly the 19 customers with a `qbo-shipdate` stop on the calendar.** [MEASURED — joined
`deliveries` → `customers` for the whole tenant.]

🔴 **So the hypothesis is right and the population is total: every stop on the shipdate calendar belongs to an
address-less customer. The stop carries the address; the person does not.** Per-stop across all 38 LAWNS
deliveries: **18 match** the customer's billing address, **1 genuinely differs**, **19 have no customer
address to compare against**.

---

## G4 · THE PUSH DOES NOT CARRY A SHIP-TO

`packages/cultivar-os/api/qbo/invoice/cultivar.ts:948-959` — the entire invoice payload is:

```
Line · TxnTaxDetail · CustomerRef · TxnDate · DueDate · BillEmail · CustomerMemo · PrivateNote
```

**No `ShipAddr`. No `ShipDate`.** The only address pushed is `BillAddr`, and it goes on the **customer**
upsert at `:249` via `billAddrFrom()` (`:118-131`), billing-first with legacy fallback.

✅ **The prompt's conclusion holds exactly: a delivery site chosen in Cultivar never appears on the document
the customer receives, and the ship-to on their 1,481 existing invoices came from QuickBooks alone.**

---

## G5 · WHAT IS ACTUALLY IN THEIR QUICKBOOKS

[MEASURED against the captures named at the top — not against Intuit.]

| | count |
|---|---|
| customers in the capture | 1,953 |
| with a real `BillAddr` (≥1 non-empty field) | **1,459** |
| with a real `ShipAddr` | **763** |
| whose `ShipAddr` is an **id-only husk** (`{"Id":"4"}`) | **1,190** |
| `ShipAddr` **identical** to `BillAddr` | **750** |
| 🔴 `ShipAddr` **distinct** from `BillAddr` | **12** |
| `ShipAddr` only, no `BillAddr` | 1 |
| neither | 493 |
| **`Lat` / `Long` on any `BillAddr` or `ShipAddr`** | **0 / 0** |
| **`ParentRef`** | **0** |
| **`Job: true`** | **0** — the key is on every record and its only value is `false` |
| **`BillWithParent: true`** | **0** |
| **`IsProject: true`** | **0** |

🔴 **THEY DO NOT USE SUB-CUSTOMERS OR JOBS. NOT SPARSELY — NOT AT ALL.** The site structure does **not**
already exist in their books, so there is nothing to read rather than invent. Invoice `ShipAddr` carries no
`Lat`/`Long` either (0 of 1,481).

### The Franklin invoice, found and confirmed on both sides

Customer `100000281`, **Richard Franklin**:

```
BillAddr  1402 CR 2109,     Lometa, TX 78653
ShipAddr  602 Hereford Loop, Hutto,  TX 78634
```

**It is also the one live LAWNS delivery row whose address genuinely differs from its customer's billing
address** (`Richard [ocr-invoice] SHIP: 602 Hereford Loop · BILL: 1402 CR 2109`), so the books and the
platform corroborate each other on the same record. ⚠️ *Side note: 78653 is Manor's ZIP, not Lometa's — their
own record is internally inconsistent.*

---

## G6 · SIZING THE MANY SIDE — AND IT IS NEARLY EMPTY

**Two normalisers, because the naive one lies.** A verbatim-line comparison finds 60 customers with 2+
ship-tos; **most are formatting variance of one address** — City of Lakeway's four are all
`CITY OF LAKEWAY, TX 78734` with different line breaks; AGAVE LD LLC's four are all `501 County Road 107`.
Keying on the **street line only**, phone lines and name lines dropped:

| distinct physical ship-tos | 0 | 1 | 2 | 3 | 4+ |
|---|---|---|---|---|---|
| **All** (1,100 customers with ≥1 invoice) | 494 | **597** | 7 | 1 | 1 |
| **Organizations** (120) | 69 | 51 | 2 | 0 | 1 |
| **Persons** (980) | 425 | 546 | 5 | 1 | 0 |

**9 customers of 1,100 have 2+ — and 2 of the 9 are typos** (`1832` vs `8132 MAZARRO DRIVE`; `508 NITTA CV`
vs `508 NITTO CV`).

### 🔴 SEVEN REAL MULTI-SITE CUSTOMERS. 0.6%. THIRTY-TWO INVOICES OF 1,481.

| customer | type | sites |
|---|---|---|
| ATX Property Management | organization | 4 |
| Robert Leeper | person | 3 |
| Texas Land Products | organization | 2 |
| Pivot Garden Design | organization | 2 |
| Gaye Kriegel · Drue Prossner · Manny Flores | person | 2 each |

Person/org uses the repo's own `classifyCustomer` (`qboCustomerAdapter.ts:169`) — 1,439 persons / 514 orgs
over 1,953, matching the live table's 1,457 / 515.

### 🔴 BUT THE ONE-SITE-THAT-DIFFERS CASE IS EIGHT TIMES BIGGER, AND IT IS THE FINDING THAT MATTERS

Comparing **each invoice's** ship-to street to **that customer's own** billing street:

> **41 of 820 comparable invoices differ — 5.0%.**
> (646 invoices carry no readable ship-to street; 15 customers carry no billing street.)

Texas Land Products (Rector Loop → Gregg Manor Rd, four times) · Trey Gilleland (CR 321 → Lexington St,
twice) · Anne Katenholz (San Diego CA → Sunset Valley TX) · Henry Stanaland · Tom Wood · Gaye Kriegel · ATX.

🔴 **THE SHAPE OF THEIR BUSINESS IS ONE BILL-TO AND ONE SHIP-TO THAT ARE USUALLY THE SAME AND SOMETIMES ARE
NOT — NOT A CLIENT → PROPERTY TREE.** Stated plainly because the prompt asked for it plainly: almost every
customer has exactly one.

---

## G7 · BLAST RADIUS

### DECIDERS — these change what happens

| site | reads | decides |
|---|---|---|
| **`customerUpsert.ts:229-241`** | `customers.address_line1` | 🔴 **ORG IDENTITY** — half the dedup key. **The load-bearing constraint on every option below** |
| `submit.ts:279-282` | `billing_*` → legacy | where the truck goes for a **checkout** order |
| `customers/create.ts:111-114` | request body | where the truck goes for an **OCR** order |
| `shipmentIngest.ts:255-345` | invoice `ShipAddr` | where the truck goes for an **imported** stop; refuses rather than guesses |
| `qbo/invoice/cultivar.ts:118-131` | `billing_*` → legacy | the `BillAddr` on the customer's **real invoice** |
| `DeliveryRoute.tsx:39-46` + `:469-471` | `billing_* ?? legacy` | the **geocode target, pin order**, and via `routeHandoff` the **URL, SMS and clipboard** |
| `CustomerCapture.tsx:106-107` | `service_offerings.requires_address` | whether checkout **demands** an address at all |
| `customerImportWriter.ts:194-201` | adapter | canonical + mirror on INSERT |

### DISPLAY ONLY

`OrderDetail.tsx:316-317` · `Customers.tsx:56` + `customerFieldRegistry.ts` (the grid/editor, 11 sites) ·
`CustomerSearch.tsx:78` · `CustomerDetail.tsx:36` · `DeliverySchedule.tsx:89-91` ·
`OperationsCalendar.tsx:269` · `CartReview.tsx:614-616` · `ScanOrder.tsx:87-88` (via `customerOrderInput`).

### THREE HAZARDS FOUND IN THE SWEEP — none of them the question that was asked

1. 🔴 **`DeliveryRoute` reads the delivery's own address BY ACCIDENT OF KEY ABSENCE.** In `?date=` mode it maps
   the delivery row's address into a **synthetic `customers` object** (`:415-423`) and then calls
   `fullAddress()`, which is `billing_line1 ?? address_line1`. **It reads the snapshot only because
   `billing_line1` is `undefined` on that synthetic object.** Add that key — for a phone, a name, anything —
   and the customer's billing address silently overrides the delivery's own snapshot **on the route the
   driver receives**. The comment at `:394` asserts the invariant; nothing enforces it. **This is #286's
   defect class one layer down** — a correct handoff that is correct for a reason nobody wrote a test for.
2. ⚠️ **The route's address override is `useState` only** (`:353-354`). A typed correction on the route page
   drives the truck once and evaporates on refresh.
3. ⚠️ **`DeliverySchedule.tsx:170` selects EIGHT customer address columns that nothing on that page reads** —
   its `fullAddress()` takes the delivery row only. Dead columns in a live query.

---

## G8 · CHECKOUT TODAY

**Yes, `submit.ts` creates the row** — `scheduleCheckoutDelivery` at `:250-320`, inserted at `:300` with R-12
row-count proof.

**The address is COPIED FROM THE CUSTOMER. Neither typed nor chosen.** `:270-282`:

```ts
const pick = (canonical, legacy) => { for (const v of [canonical, legacy]) if (…) return v.trim(); return null; };
address_line1: pick(c.billing_line1, c.address_line1),
```

And on the screen before it, `CustomerCapture.tsx:93-96` offers **one** address, labelled as the customer's,
which becomes billing **and** destination at once. **There is no ship-to field, no "same as delivery"
checkbox, and no path by which they can differ.** `user_stories.md:524` already says so in the story's own
`NEEDS:` — *"whether the ship-to should ever differ from the customer's billing address at checkout — today
it cannot."*

### The two `source='checkout'` rows with NULL `order_id`, explained

They are in the **test tenant `f7ec5d67`, not LAWNS** — both dated 2026-09-04, both to `770 Co(unty) Road
284, Liberty Hill`, carrying `CLV-20260825-2879` and `CLV-20260825-3037` in `notes`.

`submit.ts:206-209` says why:

> "🔴 NO NATURAL KEY — KNOWN, ACCEPTED, AND NOT SOLVED HERE. **`deliveries` has no `order_id` column** and
> this build adds none… `notes` carries the invoice number so a human can trace a stop back to its order;
> that is a breadcrumb, not a key."

🔴 **IT WAS TRUE WHEN WRITTEN (2026-08-25) AND STOPPED BEING TRUE TWO DAYS LATER.** `deliveries.order_id` was
added by `20260827_history_orders.sql:108`, and nobody went back. **[[R-26]] inside the same file that names
the gap.** Meanwhile the *OCR* door **does** link it, at `customers/create.ts:242-247`, with a row-count
check and an explicit comment about why a silent zero-row link is unacceptable.

---

## G9 · ANTI-REBUILD (STANDING INSTRUCTION 1)

All 55 live tables enumerated. **`sites`, `properties`, `locations`, `job_sites`, `customer_addresses` — ALL
ABSENT.** [MEASURED]

| candidate | what it actually is | verdict |
|---|---|---|
| `nursery_profiles` | `id, business_id, default_install_price, created_at` | **not a site** |
| `plant_events` | `plant_id, event_type, from_container, to_container…` | **not a site** |
| `cost_objects.location` | free text on an asset / cost node | **not a site** |
| `business_inventory.location` | free text; **null on all 1,000 sampled LAWNS rows** | **not a site** |
| `business_pricing_config.config.locations` | 🔴 **their own PRODUCTION sites** — LAWNS holds one: `{id:"default", kind:"base", name:"Primary", labor, overheadPerUnit}` | **cost-basis, not a customer property** |
| `20260905_production_planning.sql` | `business_operations_config` · `production_plans` · `production_plan_lines` | growing plans. **No address, no site, no customer.** Still unapplied |
| `vendors.address_*` | a **supplier's** address, own prefix convention | precedent for column naming only |

🔴 **The one thing that nearly models it, and it is very good: `packages/shared/src/quickbooks/shipmentIngest.ts`**
— see §G2. Reuse it; do not write a second address parser.

⚠️ **`customer_addresses` IS ALREADY A NAMED, DEFERRED DECISION IN TWO PLACES.**
`20260713_customers_party_record.sql:27-30` — *"The saved ship-to address book (a `customer_addresses` table
an order-time picker reads) is the L2 hook — a DEFERRED follow-up, NOT built. L1→L2 is additive."*
And `user_stories.md:1630-1636` carries it as **`STATUS: scoped-out`**, reasoned from D-40 (Texas is
origin-based; the platform never computes a jurisdiction rate). **Option B below is not a new idea. It is a
scoped-out one, and reviving it is a status flip David owns.**

---

## G10 · RLS

### Current state — from `20260727_rbac_resource_action_flip.sql:172-179` [STATED, apply-state unverified]

```
customers_business_owner   ALL      owner_id = auth.uid()
customers_member_select    SELECT   is_active_member(business_id) AND has_permission(business_id,'customers:read')
customers_member_insert    INSERT   …                                                        'customers:create'
customers_member_update    UPDATE   …                                                        'customers:update'
```

`deliveries` was narrowed in the same migration (`:212-224`) from a bare `deliveries_member_all` carrying
**no permission string** to a verb split on `deliveries:read` / `:update` / etc.

### What a site table's policies would be — modelled on `customers`, not invented

```sql
ALTER TABLE public.customer_sites ENABLE ROW LEVEL SECURITY;

CREATE POLICY customer_sites_business_owner ON public.customer_sites FOR ALL
  USING      (EXISTS (SELECT 1 FROM public.businesses b
                       WHERE b.id = customer_sites.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b
                       WHERE b.id = customer_sites.business_id AND b.owner_id = auth.uid()));

CREATE POLICY customer_sites_member_select ON public.customer_sites FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id,'customers:read'));

CREATE POLICY customer_sites_member_insert ON public.customer_sites FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id,'customers:create'));

CREATE POLICY customer_sites_member_update ON public.customer_sites FOR UPDATE TO authenticated
  USING      (public.is_active_member(business_id) AND public.has_permission(business_id,'customers:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id,'customers:update'));

-- NO DELETE POLICY: R2 — a site is RETIRED, never deleted. Owner-only, like customers.
```

🔴 **REUSE `customers:*`. DO NOT MINT `sites:*`.** A site is not a capability — it is a field of the customer
relationship, and the 2026-07-31 ruling (*"a permission gates a CAPABILITY, not a field"*, tech-debt #84) is
directly on point. Minting four strings would also require a manifest flip **and** a funnel
re-materialisation, per R-22's *"a manifest flip alone changes nothing… the client offering controls the
database refuses."*

### ⚠️ ON DEFECT ① — I COULD NOT VERIFY IT, AND I WILL NOT PRETEND OTHERWISE

I read the current `has_permission_for` body at `20260730c:34-58` — alias-aware, no owner branch,
`SET search_path=''` — and searched `RULINGS.md`, `CLOSE-OUT-LEDGER.md` and `docs/tech-debt-log.md` for a
documented defect against it. **I found none matching.**

🔴 **Whatever the defect is, it does not change the answer, and that is the useful part.** Because the
policies above reuse `customers:*` — the exact strings already gating the roster Lauren uses every day — a
site table **inherits whatever `has_permission` does, correctly or not, and can be neither more nor less
broken than the roster beside it.** A NEW string would have been newly exposed to the defect; an existing one
is not. **The defect is therefore a reason to reuse, not a reason to wait.**

---

## G11 · STORY GATE (§9)

🔴 **MATCH — and the matching story is OWNER-PROVEN and rules against a site object.** `user_stories.md:1680`,
quoted in full in §0③ above. Its `PIECES:` are `org_dedup, person_org_classifier, customer_one_source`;
`MAPS-TO: 3.7, 3.5`; grounded on `b33786c`, OWNER-PROVEN 2026-07-03.

⚠️ **CONFLICT with anything that moves DESTINATION off the delivery row.** Option C in particular contradicts
a sentence a live owner-prove blessed, so under the §9 gate it is a **STOP-and-surface**, not a build.

⚠️ **TWO OPEN SUB-STORIES NAME THIS EXACT QUESTION AND ARE OWED TO DAVID, NOT TO THUNDER.**
`user_stories.md:524` — *"whether the ship-to should ever differ from the customer's billing address at
checkout — today it cannot, and the 'conditional-address-on-delivery' sub-story owed by the In-store purchase
workflow story is the same question from the other side."* And `:608` lists `conditional-address-on-delivery`
among the owed sub-stories.

⚠️ **`customer_addresses` sits on the board as `STATUS: scoped-out`** (`:1630`).

**NO STORY WAS WRITTEN.** A MATCH exists at the identity level; a sub-story is **owed** for the
ship-to-differs case. Three prior artefacts already frame it and **David owns the framing** — inventing one
inside a read-only recon is exactly the re-derivation the gate exists to prevent.

---

# OPTIONS LADDER

**Every option obeys the governing rule** — the delivery row keeps its own snapshot, and editing anything
upstream never rewrites a past stop. **That rule is already how the platform works today**; none of these
introduce it.

---

## A · DELIVERY-ROW ONLY. NO NEW TABLE.

**What.** Add a ship-to to the checkout step, gated on the `requires_address` seam that **already exists** at
`CustomerCapture.tsx:106-107`. The form shows the customer's bill-to with a **"deliver to this address"
checkbox, checked by default**; unchecking reveals four fields. `submit.ts` writes what the form gives it
instead of always `pick(c.billing_*, c.legacy)`. Fix the `ReceiptKeeper.tsx:731` reverse fallback so a job
site can never become an org's billing address (§G2). Set `deliveries.order_id` on the checkout path — the
column has existed since 20260827. Add `ShipAddr` to the invoice payload, sourced from the delivery row.

**Cost.** ~1 day. **Zero migrations. Zero new `api/` functions** — `find api -name '*.ts' | wc -l` = **12 of
12** on Hobby, where function #13 fails the deploy *silently*. **No new permission string.** Touches
`CustomerCapture.tsx`, `submit.ts`, `cultivar.ts`, and one line of `ReceiptKeeper.tsx`.

**Forecloses.** Nothing. Every column it writes already exists; **B is purely additive on top of it.**

**Leaves unsolved.** A repeat customer re-types a site they used last month. Nothing accumulates. No service
history by place. **For the seven customers in §G6 who genuinely have more than one site this is real
friction** — and for the other 1,093 it is one checkbox they never uncheck.

---

## B · A SITE RECORD, WITH THE DELIVERY SNAPSHOTTING IT.

**What.** A `customer_sites` table — `id, business_id, customer_id, label, line1, line2, city, state, zip,
notes, is_active, created_at, updated_at` — plus the RLS in §G10. Checkout offers **bill-to · a saved site ·
a new one**. Saving a new one is a **side effect of the order, not a second form**. The delivery **still
writes its own four columns**; the site is a **picker**, never a foreign key the delivery resolves at read
time. Backfill is bounded and checkable: the 12 customers whose QuickBooks `ShipAddr` differs from their
`BillAddr` (§G5) and the 7 multi-site customers (§G6).

**Cost.** ~3 days. **One migration** — new table, four policies, a `(business_id, customer_id)` index. No new
function. No new permission string. New picker UI on two surfaces (checkout, customer detail).

**Forecloses.** Effectively nothing, but it binds you to a name and a shape. It also **inverts a scoped-out
board row** (`user_stories.md:1630`) — a status flip David makes, not one a build makes quietly.

**Leaves unsolved.** The site is a convenience, not a subject — no warranty clock, no history, nothing hangs
off it. And it builds a many-side that **0.6% of their customers use**, on the strength of 32 invoices in
1,481.

---

## C · B PLUS SERVICE HISTORY ON THE SITE.

**What.** B, and then `deliveries`, `orders`, warranty records and future fertiliser rounds hang off
`customer_sites.id`. The property becomes the subject: *what has been planted here, what is under warranty,
what is due.* This is the Jobber / ServiceTitan / Aspire client → property → job model in full.

**Cost.** ~2 weeks minimum. A migration adding `site_id` to `deliveries` **and** `orders`; a backfill decision
for 56 existing deliveries and 1,481 imported invoices; a new detail surface; and a **resolution rule for
every past record that has no site — which is all of them.**

**Forecloses.** 🔴 **It contradicts an owner-proven story in writing** — *"identity lives on the customer and
destination on the delivery"* — so under the §9 gate it is a `CONFLICT` that must **STOP and surface** before
any spec exists. It also creates the second-truth risk **R-27** names: a site row and a delivery snapshot
that can disagree, with nothing saying which is right. Handled correctly (snapshot always wins) that is fine;
handled by convention it is **tech-debt #71's shape** — one field, two authors, the reverting one wins, and
nothing says so.

**Leaves unsolved.** Nothing about addresses. It solves a *different* problem — *what is planted in a
customer's ground* — which `e609f96`'s own recon already examined and concluded **R-37 forbids minting from
history**.

---

# 🔴 RECOMMENDATION — **A, NOW. B WHEN A CUSTOMER ASKS FOR IT, AND THE TRIGGER IS MEASURABLE.**

**Three measurements decide this, and they point the same way.**

**① THE MANY SIDE IS NOT THERE.** Seven customers of 1,100 have more than one physical ship-to — **0.6%, 32
invoices of 1,481**, across fourteen months of real trading. LAWNS uses **zero** sub-customers and **zero**
jobs in QuickBooks, on 1,953 records. The industry convention is right for Jobber's customers; **it is not
right for these books.** The honest reading of *"if almost every customer has exactly one, say so plainly"*
is: **almost every customer has exactly one.**

**② WHAT IS ACTUALLY BROKEN IS ONE-TO-ONE.** 41 of 820 comparable invoices — **5.0%** — ship to a street that
is not the billing street. Richard Franklin is one of them, and he is the single live LAWNS delivery whose
address diverges. **That is eight times the multi-site case, and A fixes all of it.** A site table fixes the
0.6% and adds **nothing** to the 5.0% that A does not already deliver.

**③ THE PIECES A NEEDS ARE ALREADY BUILT.** `requires_address` already gates the address requirement.
`shipmentIngest` already parses a ship-to properly, with refusals. The delivery row already holds and keeps
its own snapshot. **Not one migration and not one function slot** — which matters at 12 of 12 on Hobby.

**A's three defects are all live today and none of them needs a table:** the reversed fallback at
`ReceiptKeeper.tsx:731` that can put a job site into an organization's identity key; the missing `order_id`
on checkout stops; the missing `ShipAddr` on the push. **Fixing those is worth more next Tuesday than a table
nobody has asked for.**

### The trigger for B, written down so it is not a judgement call later

> **Build B when the count of LAWNS customers holding two or more DISTINCT delivery addresses passes ~25, or
> when a contractor complains about re-typing a site.** Both are one query away.
> **Today it is seven, and four of the seven are homeowners who moved.**

---

# HONEST LIMITS — WHAT I COULD NOT OPEN

- 🔴 **`customers` has no `CREATE TABLE` in the repo**, so §G1's types and defaults come from the **live
  PostgREST OpenAPI spec**, not from a catalog query. `information_schema` and `pg_catalog` are unreachable
  through PostgREST (`scripts/verify-migration.mjs:8-11` states this). **`NOT NULL` and `DEFAULT` are
  therefore inferred from the spec's `required` array and `default` field.** To PROVE them:
  `SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
   WHERE table_name IN ('customers','deliveries') ORDER BY table_name, ordinal_position;`
- 🔴 **I COULD NOT VERIFY THE RLS POLICIES ARE APPLIED.** §G10's "current state" is **what the repo says**,
  not what the database does. `pg_policies` is unreachable from here, and
  `docs/audits/migration-apply-state-stage3.sql` is a **generated query, untracked, and never run**.
- ⚠️ **I could not identify defect ①** in `has_permission`. I gave the reasoning that makes the answer
  independent of it rather than guessing at its content.
- ⚠️ **§G6's normalisation is a judgement, and both results are shown** — naive (60 customers) and
  street-only (9, of which 2 are typos) — so the effect of the rule is visible. A different rule gives a
  different number; **the order of magnitude is stable.**
- ⚠️ **465 vs the prompt's 464** phone-shaped `address_line1` values. My regex is one row more permissive.
  Not a disagreement about the finding.
- ⚠️ **The captures are 2026-09-04 and 2026-09-07, not today.** The customer count moved 1,946 → 1,953 in
  three days.
- ⚠️ **Nothing here was seen in a browser.** Every claim is from code, migrations, the live tables, or the
  captures.

---

# CORRECTIONS TO STANDING RECORDS, FOUND IN PASSING

- ✅ **`#286(c)` IS WRONG ABOUT `SUPABASE_URL`.** It warns the var is unset in
  `packages/cultivar-os/.env.local` and that a script must fall back to `VITE_SUPABASE_URL`. **It is set — 40
  chars — beside a 219-char `SUPABASE_SERVICE_KEY`.** [MEASURED] Only the two ROOT files are empty. No
  fallback is needed; scripts reading that file work as written.
- ✅ **`#283(d)` on LAWNS's pricing config is EXPLAINED, NOT DRIFT.** That entry records LAWNS's config as
  `{taxRate}` only. It now holds `discountTypes` (Military · Contractor CD10% / CD15%), `margin`, `locations`
  and `denominators`, `updated_at 2026-09-08T21:12`. **David and Lauren changed it during testing.** Recorded
  here so the next reader of #283(d) does not re-open it as a defect — **and so the re-run exposure #283(d)
  warned about is now a LIVE question for LAWNS rather than a hypothetical one** (tech-debt #222).
- ⚠️ **`docs/inventory-functions.md`, `docs/inventory-env.md` and `docs/inventory-ai.md` all read
  `Last updated: 2026-06-13`** — nearly three months stale, and #286(c) claims to have updated the env one.
  Flagged per the session-open gate. **This recon did not rely on any of them.**
- ⚠️ **`docs/audits/migration-apply-state-stage3.sql` is still untracked** in `git status`, as it was at
  session open on 2026-09-08.

---

# WHAT IS OWED, AND BY WHOM

| # | owed | owner |
|---|---|---|
| 1 | **A sub-story for the ship-to-differs-from-bill-to case** — three prior artefacts frame it (`user_stories.md:524`, `:608`, `:1630`); the framing is a ruling, not a build decision | **David** |
| 2 | **Ruling: A, B or C** — this document recommends **A now, B on a measured trigger** | **David** |
| 3 | `customers.state DEFAULT 'TX'` + `CustomerCapture.tsx:274` → a `HARDCODED-REGISTER.md` entry (AC-1) | next build that touches either |
| 4 | `deliveries.order_id` unset on the checkout path, and the stale comment at `submit.ts:206-209` that says the column does not exist | folds into **A** |
| 5 | `ReceiptKeeper.tsx:731`'s reverse fallback → an org's identity key can take a job site | folds into **A** |
| 6 | `DeliveryRoute.tsx:415-423` — the synthetic-`customers` hazard (§G7 #1); a test that fails when `billing_line1` is added to that object | its own small guard |
| 7 | `DeliverySchedule.tsx:170` selects eight customer address columns nothing reads | tidy-when-touched |
| 8 | **Catalog verification of §G1 and §G10** — the two queries in HONEST LIMITS, run in the SQL editor | **David** |

---

*TRACE Enterprises · Built with CAI · Stage 0 recon, read-only, 2026-09-09*
