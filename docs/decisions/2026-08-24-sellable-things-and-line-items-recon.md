# RECON — Where sellable things live, and where our line items live

**Date:** 2026-08-24 · **Type:** READ-ONLY RECON (LOOK ONLY — nothing under `packages/` `api/` `supabase/` changed)
**Asked by:** David — *"how many tarps did we sell… it is a line item on the receipt why is this hard?"* ·
*"how many happy hoses did we purchase and when"* · *"we generate the invoices how do we store them? only in QB?"*
**Governs Part B:** **D-37** (money boundary — `docs/decisions/2026-07-10-money-boundary.md`).
**The test applied throughout:** *can the database answer "how many X did we sell/buy, and when", directly?* Yes or no, per thing.

---

## 🔴 THE HEADLINE, BEFORE ANYTHING ELSE

**The premise behind the question is wrong in the direction that matters, and the correction is good news.**
David asked why a line item is hard to query. **On the SELL side it is not hard and it is not JSON: there is a
real relational line-item table — `order_items` — one row per thing sold, carrying `quantity`, `unit_price`,
`subtotal`, and a foreign key to the catalog row.** Services get their own rows in `order_service_selections`
with the same shape. QuickBooks is **downstream of** that table, not the home of it.

**The gap is REAL but it is on the other side of the building.** *"How many happy hoses did we buy, and when"*
is **not answerable**, and not because of a storage format — **because no purchase-line concept exists at all.**
The receipt path is the sharpest instance: **the OCR already asks the model for `quantity` and `sku` per line,
and the save throws both away** before writing.

**So: one half is built and queryable. The other half is absent. They are not the same problem and they do not
have the same fix.**

---

# PART A · WHAT CAN BE SOLD, AND WHERE IS IT LISTED

## A1 — the catalogs that exist

### 🔴 `business_inventory` — **GENERIC, not plant-shaped. This is the deciding answer for tarp and fertilizer.**

`supabase/migrations/20260612_business_assets_inventory_pmi_service.sql:95-111` (CREATE TABLE).

**The complete NOT NULL set is six columns, and four of them are bookkeeping:**

| column | constraint |
|---|---|
| `id` | PK, default `gen_random_uuid()` |
| `business_id` | **NOT NULL** FK→`businesses(id)` |
| `name` | **NOT NULL** |
| `qty` | **NOT NULL DEFAULT 0** |
| `status` | **NOT NULL DEFAULT 'available'** |
| `created_at` / `updated_at` | **NOT NULL DEFAULT now()** |

**Everything else is nullable**: `sku`, `description`, `unit_cost`, `serial_number`, `location`, `received_at`,
`photo_url`, `notes`. Added later, **all nullable**: `receipt_id` + `cost_confidence`
(`20260612_business_assets_inventory_cost_confidence.sql:55-59`), `size` + `variant_group`
(`20260628_inventory_size_variants.sql:20-22`), `sell_price` (`20260707_business_inventory_sell_price.sql:21-22`),
`price_basis` + `attributes` (`20260723_inventory_import_columns.sql:42-44`), `reorder_point`
(`20260713_inventory_decrement_and_reorder.sql:41-42`).

**CHECK constraints on the table: exactly ONE**, and it is not about plants —
`cost_confidence IN ('CONFIRMED','DERIVED','ESTIMATED','UNKNOWN')`
(`20260612_business_assets_inventory_cost_confidence.sql:58-59`).

> **🔴 VERDICT: a row is `business_id` + `name` + a number. Variety, size and grade are NOT required — `size` and
> `variant_group` are nullable columns added 16 days after the table. `INSERT INTO business_inventory
> (business_id, name, qty, sell_price) VALUES (…, 'Blue Poly Tarp 10x12', 40, 18.00)` is a legal, complete,
> sellable row.** The table's own header calls it *"Stock items at SKU+qty grain"* (`:91-92`), not a plant table.

**⚠️ THE COST OF THAT GENEROSITY, STATED HONESTLY: there is NO product-kind column.** No `type`, no `category`,
no `kind` — nothing on the row says *tarp* rather than *tree*. So a tarp fits, but **the only handle for
"which rows are tarps" is `name` text-matching.** That is a finding, not a fix, and it is picked up in C1(i).

**⚠️ ONE STALE SOURCE NAMED SO IT IS NOT CITED LATER:** `docs/decisions/2026-07-07-live-schema-map.md:24,44`
asserts *"There is NO price, sell_price, retail_price… column on this table"*. **That was true when written and
is false now** — `sell_price` landed the same day in `20260707_business_inventory_sell_price.sql`. The map is
accurate on shape and useful for the live column list; **do not cite its money claims.**

### `service_offerings` — the catalog of things that are DONE rather than handed over

`supabase/migrations/20260529_businesses_f_service_offerings.sql:10-54`. **The enums, verbatim from source:**

```sql
category   text NOT NULL CHECK (category   IN ('transport', 'addon', 'maintenance', 'inspection', 'subscription'))   -- :17-18
timing     text NOT NULL DEFAULT 'at_checkout'
                          CHECK (timing    IN ('at_checkout', 'post_purchase', 'recurring'))                          -- :21-22
price_type text NOT NULL DEFAULT 'per_unit'
                          CHECK (price_type IN ('flat', 'per_unit'))                                                  -- :25-26
price_unit text NOT NULL DEFAULT 'plant'
                          CHECK (price_unit IN ('order', 'plant', 'vehicle', 'visit'))                                -- :29-30
```

Also: `price numeric(10,2) NOT NULL DEFAULT 0` (`:32`), `transport_mode` / `trigger_transport_mode`
CHECK `IN ('self','staff')` (`:37,:40`), `recurrence_days`, `requires_address`, `pre_selected`, `is_active`,
`sort_order`. The file's own header states the intent: *"Every service a business offers at any point in the
customer journey lives here… Works identically for nurseries, HVAC shops, auto shops"* (`:4-7`).

### Anything else that lists a sellable thing

| surface | holds | can it anchor a sale? |
|---|---|---|
| `cultivar_plants` | per-SPECIMEN plant rows (tag_id, species) | **NO — not directly.** `order_items.plant_id` was **DROPPED** (`20260709_drop_order_items_plant_id.sql:41-42`, AC-1). A specimen reaches an order only through its lot (`cultivar_plants.inventory_id`). |
| `opportunity_items` | `20260529_businesses_b_opportunity_items.sql:4` | superseded — migration F's header says it replaces *"the rigid transport_method enum + addons table + opportunity_items"* (`:2-3`). |
| `addons` / `order_addons` | legacy | superseded; **one reader left**, a fallback in `api/qbo/invoice/cultivar.ts:393-395` for historical orders. |
| `business_assets` | the business's OWN equipment (PMI/maintenance) | not a sales catalog. |

> **🔴 So there are exactly TWO live sellable catalogs: `business_inventory` (goods) and `service_offerings`
> (services) — and `business_inventory` is the SOLE anchor for a goods line.**

## A2 — placing the four

| thing | home TODAY? | evidence |
|---|---|---|
| **tarp** | **NO row exists that I can see, but the SHAPE holds it with nothing added.** A tarp is a good: `business_inventory` needs only `name` + `qty` + `sell_price`. | `20260612…pmi_service.sql:95-111` (nullable everything else) · `20260707_business_inventory_sell_price.sql:21` |
| **fertilizer** | **NO row exists that I can see, and unusually it has TWO legal homes** — a GOOD in `business_inventory` (a bag sold off the shelf), or an `addon` `service_offering` (applied at planting, `price_unit:'plant'`). **These are different rows in different tables producing different line rows, and nothing today picks between them.** | same as above · `20260529…f_service_offerings.sql:17-18` |
| **delivery** | ✅ **YES — BUILT AND SEEDED.** `'We deliver'`, category `transport`, `transport_mode:'staff'`, `requires_address:true`, price `0.00`. | `20260529_businesses_f_service_offerings.sql:104` |
| **install** | ✅ **YES — BUILT AND SEEDED.** `'We deliver and plant'`, category `transport`, `price_type:'per_unit'`, `price_unit:'plant'`, **`225.00`**. | `20260529_businesses_f_service_offerings.sql:115` |

*(Also seeded: `'Pick up myself'` `:93` and the `'Travel netting'` addon at `10.00`/plant `:127`.)*

⚠️ **A CLAIM I AM DELIBERATELY NOT MAKING: whether any tarp or fertilizer ROW exists in the live catalog.**
This machine has no catalog access, and the 2026-08-22 ruling says a database claim is sourced from the catalog
or not made. **What I can prove from source is the SHAPE, and the shape imposes no obstacle.** *No home was
designed here — the two above already existed.*

## A3 — can a customer buy a non-plant good today, end to end?

### ✅ **YES, MECHANICALLY — and the walk breaks in COSMETICS and in ONE money rule, never in structure.**

| step | what happens to a tarp row | file:line |
|---|---|---|
| **find it** | `searchStockLines` selects from `business_inventory` with **no shape filter** — substring on `name`/`sku`, or token-subset. A tarp is found by typing "tarp". | `packages/shared/src/inventory/stockLineResolver.ts:278-311` |
| **may it be sold?** | `checkSellable` tests **condition → price → quantity**. **Nothing about plants.** A named, priced, in-stock tarp passes. | `packages/cultivar-os/src/lib/inventoryStates.ts:169-201` |
| **into the cart** | `synthesizePlant` wraps ANY `business_inventory` row into the `Plant` shape the cart expects. | `packages/cultivar-os/src/lib/stockLinePlant.ts:21-47` |
| **price it** | `resolveItemForServer` reads `sell_price` server-side by `business_inventory_id`, `business_id`-scoped. | `packages/cultivar-os/api/orders/submit.ts:70-89` |
| **write the line** | one `order_items` row: `quantity`, `unit_price`, `subtotal`, `business_inventory_id`. | `packages/cultivar-os/api/orders/submit.ts:751-775` |
| **stock decrement** | `adjust_inventory_qty` — generic, qty-based. | `packages/cultivar-os/api/orders/submit.ts:104-119` |

**Where it actually breaks:**

1. ⚠️ **A MONEY RULE, AND IT IS THE ONE THAT MATTERS.** Every `per_unit`/`'plant'` service multiplies by
   `itemCount` = **the sum of ALL cart-line quantities** (`submit.ts:218`), with **no notion of which lines are
   plants**. Buying **1 tree + 2 tarps** with self-transport bills **netting ×3 = $30**, and "Delivery + planting"
   bills **planting ×3 = $675**. **Mitigated, not silent:** `qtyFor` honors an owner-confirmed override
   (`serviceQuantities`) first (`submit.ts:490-494`), so the register can correct it — *if the seller notices.*
2. 🟡 **The word "tree" is written into the row's own object.** `synthesizePlant` hardcodes
   `plant_type: 'tree'` (`stockLinePlant.ts:31`), commented as a *"synthetic default"*.
3. 🟡 **The order screen labels the section "Plants".** a `Plants (N)` card title
   (`packages/cultivar-os/src/pages/OrderDetail.tsx:324`) — a tarp appears under a heading that denies it,
   which is **§6 r18's class** (a header is a claim that must hold for every row beneath it).

> **Nothing here needs a new table for a tarp to be sold and counted. It needs vocabulary, and one attach rule
> that knows a tarp is not a plant.**

---

# PART B · 🔴 WHERE DO OUR OWN INVOICE LINE ITEMS LIVE

## B1 — what is written to OUR database at checkout

**Three tables, in one submit, in this order:**

| # | table | columns carrying the money/detail | write |
|---|---|---|---|
| 1 | **`orders`** | `business_id`, `customer_id`, `transport_method`, `transport_note`, `netting_declined`, **`subtotal`**, **`tax_amount`**, **`total_amount`**, `addons_amount`, `leakage_flag`, **`notes`** *(← the invoice number)*, `status` | `submit.ts:685-698` → insert `:717-722` |
| 2 | **`order_items`** — **THE GOODS LINES** | `order_id`, **`quantity`**, **`unit_price`** (net), **`subtotal`** (net), **`business_inventory_id`** (FK→catalog), + D-43 provenance **`retail_unit`**, **`discount_pct`**, **`discount_amt`** | `submit.ts:751-775` |
| 3 | **`order_service_selections`** — **THE SERVICE LINES** | `order_id`, **`service_offering_id`** (FK→catalog), **`quantity`**, **`unit_price_at_time`**, **`subtotal`**, + override/leakage cols | `submit.ts:788-848` |

Both line tables snapshot price at time of sale — `order_service_selections.unit_price_at_time` is commented
*"snapshot: price won't change historical records"* (`20260529…f_service_offerings.sql:71`).

**Edits go through the same tables** (`submit.ts:1230-1246`), and cancellation deletes the lines
(`submit.ts:1333`) — so the line rows stay the single account of what was sold.

## B2 — 🔴 IS THERE A LINE-ITEM TABLE AT ALL?

### ✅ **YES. TWO OF THEM. One row per thing sold, with quantity and price, foreign-keyed to the catalog.**

- **`order_items`** — goods. `quantity` · `unit_price` · `subtotal` · `business_inventory_id`.
- **`order_service_selections`** — services. `quantity` · `unit_price_at_time` · `subtotal` · `service_offering_id`.

**It is NOT a total with the detail elsewhere. It is NOT a text field. It is NOT an attributes blob. It is NOT
only in QuickBooks.** `orders` carries totals *as well*, but they are a summary **over** stored lines, not
instead of them.

**The detail got MORE structured over time, not less — D-43 exists precisely because it wasn't structured enough:**
`20260713_order_items_line_breakdown.sql:8-27` records that submit *"COMPUTES the full per-line breakdown then
DISCARDS it, persisting only the net"*, and the fix was **more columns**, on the stated principle
*"an invoice stores its own lines — you don't recompute an invoice every time you view it"* (`:24-25`).

**⚠️ TWO CAVEATS, BOTH REAL, NEITHER FATAL:**
1. **`order_items` and `orders` have NO CREATE-TABLE migration** — the tech-debt **#39** class, live-only,
   authored-from-a-live-map (`20260707_order_items_stock_line_anchor.sql:12-17`). **The columns are proven by
   the four ALTERs against them and by the code that reads them; the table's origin is not in git.**
2. **`order_items` has no `created_at` of its own** — a date comes from **`orders.created_at`**, which is
   **sourced from code, not from the catalog**: four live surfaces read it and one **sorts on it**
   (`Orders.tsx:50,59`, `OrderDetail.tsx:80`, `api/dashboard.ts:40,52`) — a column that did not exist would
   `42703` there. `order_service_selections` carries its own `created_at NOT NULL DEFAULT now()`
   (`20260529…f_service_offerings.sql:73`).

## B3 — 🔴 IF QUICKBOOKS WERE DISCONNECTED TOMORROW, COULD WE ANSWER "HOW MANY TARPS DID WE SELL IN JUNE"?

### ✅ **YES — from `order_items` joined to `business_inventory` (name) and `orders` (date), with no QuickBooks involvement whatsoever, PROVIDED the tarp was sold as a catalog row. QuickBooks holds a COPY, never the original.**

## B4 — what QuickBooks actually sends and stores

**Direction of travel: OUR DATABASE → QUICKBOOKS. One way, for the lines.**

`pushQboInvoice` (`api/qbo/invoice/cultivar.ts:335`) **reads** `orders` (`:368`), `order_items` **including the
D-43 breakdown** (`:381-384`), `order_service_selections` (`:386-389`), and the legacy `order_addons` fallback
(`:391-394`) — then **builds** the QB lines from them (`:408-440`). **Every figure on a QuickBooks invoice is
assembled from our own rows.** There is no path that reads lines back.

**What comes back and is persisted here: two pointers and nothing else** (`:660-668`):
```
orders.qb_invoice_id   ← qbInvoice.Id
orders.qb_invoice_url  ← the deep link
```
Plus `customers.qb_customer_id` as an identity cache (`:207`, `:256`) — and the code treats even that as
*"a CACHE, not a fact: VERIFY it before billing it"* (`:399-401`, D-47).

**⚠️ There is also a reconcile guard that refuses to push a disagreeing invoice** — *"Invoice does not
reconcile: the QuickBooks lines sum to $X but this order charged…"* (`:634`).

### D-37 verdict: ✅ **CONSISTENT, AND THE DETAIL HAS *NOT* ENDED UP ON THE FAR SIDE.**

D-37 scopes IN *"charge computation on originated orders"* and OUT *"payment processing, collection,
reconciliation"* (`docs/decisions/2026-07-10-money-boundary.md:43-45`). **What I found matches exactly:** we
compute and store every line and total; we push a representation; we keep an id and a URL. **Nothing pulls
payment status, no `paid` flag, no remittance, no balance is read back.** The invoice NUMBER is generated here
too (`orders.notes`, `submit.ts:696`; `invoiceNumber` `cultivar.ts:375`).

**Answering David's third question directly — *"we generate the invoices, how do we store them? only in QB?"*:**
**The invoice's CONTENT is stored here in full** (lines, quantities, unit prices, discounts, tax, total) — and
`DemoQBInvoice.tsx:65-77` proves it by **re-rendering an invoice from our own rows**. **What lives only in
QuickBooks is the RENDERED DOCUMENT and the money lifecycle after it** (numbering as QB knows it, delivery,
payment, credit notes) — **which is the boundary D-37 chose on purpose, not an accident.**

## B5 — THE PURCHASE SIDE

### 🔴 **NO. There is no purchase-line concept in Cultivar. Not a purchase order, not a receipt line row, not a goods-received row.**

A grep for `purchase_order` / `goods_received` / `purchase_line` / `bill_line` across
`supabase/migrations/`, `packages/cultivar-os/src`, and `packages/shared/src` returns **zero hits**.

The only inbound-cost link that exists is a **pointer, not a line**: `business_inventory.receipt_id` FK→`receipts(id)`
(`20260612_business_assets_inventory_cost_confidence.sql:56-57`) — it attributes **a cost to a lot**, and carries
**no quantity, no purchase date of its own, no per-item purchase row**.

*(Noted and moved past per instruction: `purchase_orders` exists in the IGNITION project only, is not in git —
CLAUDE.md tech-debt #27. Not reached for, not examined.)*

## B6 — 🔴 THE OCR RECEIPT PATH: IT EXTRACTS STRUCTURED LINES, THEN DROPS THE FIELDS THAT WOULD ANSWER THE QUESTION

**What it writes:** an **extraction blob, not line rows** — `receipts.line_items jsonb`
(`20260613_receipts_add_line_items.sql:12`), whose own header says *"This is v1 data capture only — no per-line
classification UI is built here. Stored as raw JSONB; a future analytics surface can read and aggregate it"* (`:9-10`).

### 🔴 **THE FINDING: THE QUANTITY IS ASKED FOR AND THEN THROWN AWAY.**

| stage | shape | file:line |
|---|---|---|
| the OCR **prompt asks for it** | `{"description", "sku", "quantity", "unit_price", "amount"}` — *"include sku, quantity, unit_price only if printed"* | `api/receipts/ocr.ts:64, 94, 108` |
| the client **types it correctly** | `line_items?: Array<{ description; amount; sku?; quantity?; unit_price? }>` | `ReceiptKeeper.tsx:93` |
| 🔴 **the editable state NARROWS it** | `const ocrLines: Array<{ description: string; amount: number }> = data.parsed?.line_items ?? []` — **`sku`, `quantity` and `unit_price` are dropped right here** | **`ReceiptKeeper.tsx:259-264`** |
| 🔴 **the save writes the narrowed pair** | `.map(item => ({ description, amount }))` → `line_items:` | **`ReceiptKeeper.tsx:422-425, 449`** |

**⚠️ AND THE PART THAT CHANGES WHAT THE FIX COSTS — THE DATA IS NOT DESTROYED, IT IS MISFILED.** The same insert
also writes **`line_items_original`** (`ReceiptKeeper.tsx:450`, column at
`20260614_receipts_reconciliation.sql:31`) = the **raw pre-edit OCR array**, which **does carry `quantity`,
`sku` and `unit_price` when the receipt printed them** — and `ocr_raw` holds the provider payload
(`ReceiptKeeper.tsx:443`). **So the quantity is likely sitting in the database right now, in a column whose
stated job is a before/after audit snapshot, that nothing queries as data.**

> **So yes — this is the case the prompt anticipated: structured lines produced and then discarded. With one
> correction that matters: the OWNER-CONFIRMED copy loses them, the ARCHIVAL copy keeps them. Nothing reads
> either as inventory.**

---

# PART C · THE HONEST ANSWER TO "WHY IS THIS HARD"

## C1 — the four questions

| # | question | answerable TODAY? | the single missing piece |
|---|---|---|---|
| **i** | **how many tarps did we sell in June** | 🟡 **YES — structurally. `order_items.quantity` joined to `business_inventory.name` and `orders.created_at`.** | **Nothing structural. Two soft pieces: a tarp must BE a catalog row, and "tarps" can only be matched on `name` text — there is no product-kind column** (A1). |
| **ii** | **how many happy hoses did we buy, and when** | 🔴 **NO.** | **There is no purchase line, anywhere.** `receipts.line_items` holds `{description, amount}` with **no quantity** (B6) — and no table records goods received. |
| **iii** | **which customers bought fertilizer** | ✅ **YES.** `orders.customer_id` → `order_items.business_inventory_id` (a fertilizer GOOD) or `order_service_selections.service_offering_id` (a fertilizer ADDON). | **Nothing missing — but the answer depends on which of the two homes fertilizer was given** (A2), and nothing picks. |
| **iv** | **what did we charge for install last quarter** | ✅ **YES — this one is fully built and seeded.** `SUM(subtotal)` on `order_service_selections` where `service_offering_id` = *'We deliver and plant'*, by its own `created_at`. | **Nothing.** The offering exists (`…f_service_offerings.sql:115`), the line rows exist, the date exists. |

## C2 — is the gap ONE thing or several?

### **SEVERAL — but far fewer than the question implies, and they are LOPSIDED: the sell side is essentially done and the buy side is missing entirely.**

In the order they would have to be built:

1. 🔴 **A PURCHASE LINE. This is the only genuine structural absence, and it blocks ii outright.** Nothing
   records *N units of a thing came in on a date at a price*. Everything else on this list is smaller.
2. 🔴 **STOP DISCARDING THE QUANTITY THE OCR ALREADY RETURNS** (`ReceiptKeeper.tsx:259`). This is **upstream
   of #1 and independent of it** — the capture is already paid for; today it is narrowed away in one
   assignment. **A purchase line built on top of a quantity-less capture would be an empty table.**
3. 🟡 **A PRODUCT-KIND HANDLE ON `business_inventory`.** Needed to ask *"tarps"* rather than *"rows whose name
   contains 'tarp'"* — and needed before #4 can decide anything.
4. 🟡 **AN ATTACH RULE THAT KNOWS A TARP IS NOT A PLANT** (`submit.ts:218` `itemCount`). This is the one item
   on the list that is a **live money hazard**, not a reporting gap (A3). It depends on #3.
5. 🟢 **VOCABULARY** — `plant_type: 'tree'` (`stockLinePlant.ts:31`) and the `"Plants (N)"` header
   (`OrderDetail.tsx:324`). Cosmetic, §6 r18's class, cheapest thing here.

> **The one-sentence answer to *"why is this hard?"* — for what we SELL it is not hard and it never was; the
> line-item table has been there since D-34/D-43 and QuickBooks reads FROM it. For what we BUY it is hard for a
> real reason: we never built a place to put it, and the receipt path currently deletes the number that would
> have gone there.**

---

## Three lenses (§9 gate 10)

- **HAVE** — two sellable catalogs (`business_inventory` generic, `service_offerings` enumerated), two
  relational line-item tables with quantity and price, a one-way push to QBO storing only two pointers back,
  and an OCR that extracts per-line quantity into an unqueried archival column.
- **NEED** (irreducible, no preference) — for ii: **a per-line purchase record carrying quantity**, fed by
  **not narrowing the OCR result**. Nothing else on C1 is blocked.
- **WANT** (labeled as want) — a product-kind field, an attach rule that reads it, and matching vocabulary,
  so the platform can distinguish goods it sells from plants it grows without text-matching a name.

⚠️ **STATED DEVIATION (§6 r10 — no silent divergence):** gate 10 normally requires **OPTIONS spanning
NEED→WANT**. This recon's own scope bar says *"Do NOT propose options in Parts A or B — those are findings
only"* and *"Do NOT design a goods model, a line-item table, or a purchase path."* **I honored the prompt and
present no options; the lenses above carry NEED and WANT without collapsing to a recommendation.** Options are
owed at the moment David asks for a build, not here.

## Constraints held

**LOOK ONLY** — zero changes under `packages/`, `api/`, `supabase/` (proven by `git diff --stat` at close).
No code, no schema, no migration, no policy, no cap, no new permission string, no api function (12/12 untouched).
No owner-test card marked `covered`. Ignition noted and not touched. No estimate given for anything not opened.
Every claim carries `file:line`; every database-state claim is either sourced from a migration in git or
explicitly declined.
