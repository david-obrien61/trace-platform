# THE FOUR THINGS THE SERVICES REVIEW WAS ASKED TO REPORT AND NOT BUILD

**Filed 2026-09-08 · ledger #283 · branch `thunder/services-review`**
**Measured against LAWNS's complete captures:** `qbo-items-9341455222430707-2026-09-04` (685 of 685,
`complete: true`) and `qbo-invoices-…-2026-09-04` (1,481 of 1,481, `complete: true`). Every figure
below is `[MEASURED]` from those two files unless it says otherwise.

> ⚠️ **ONE THING I COULD NOT MEASURE, AND IT AFFECTS ITEM ③.** `SUPABASE_SERVICE_KEY` is EMPTY in
> `.env.local` and `.env.prod.local` (two characters — an empty quoted string), so **no live
> database read was possible this session.** This is tech-debt **#183**'s blocker recurring. Every
> statement about the live contents of `service_offerings` below is `[STATED]` — from the build
> prompt — and is marked as such. Nothing about the live rows is asserted as measured.

---

## ① WHAT DOES THE ITEM IMPORT NEED SO THE BUTTON READS 500 PRODUCTS, NOT 647?

**The change is four lines, and the number it should print is not 500.**

`qboItemAdapter.ts:272` is the whole of it:

```ts
if ((row.type ?? '').toLowerCase() === 'category') { categories++; continue; }
```

`Type: 'Category'` is filtered and **nothing else is**, so `sellable` is `685 − 38 = 647` and every
one of the 147 `Type: 'Service'` items becomes a `business_inventory` row —
`itemImportWriter.ts:250` writing `sell_price: item.unitPrice` with no sign or shape check.
`Military Discount 5%` lands as a scannable product priced **−$0.05**; `Tree Replacement` lands free.

### 🔴 THE PROMPT'S NUMBER IS WRONG, AND THE REASON IS WORTH MORE THAN THE FIX

The prompt says the button should read **500** — i.e. the `NonInventory` count. **[MEASURED]: the
honest number is 564.** Of the 147 items QuickBooks types `Service`:

| Income account | Items | What they actually are |
|---|---:|---|
| `Sales of Nursery Stock` | **64** | 🔴 **TREES.** `Lacey Oak 45G`, `Shumard Red Oak 45`, `Hightower Yaupon Holly` at five sizes, `Mexican Sycamore 65 gallon` at $1,750. |
| `Sales of Product Income` | **35** | Compost, fertiliser bags, containers, tarps — **and** the tree bubbler and the staking kits. |
| `Landscaping/Installation Services` | **22** | The real services: deer fencing, trunk protection, tree removal, labour hours. |
| `Discounts given` | **8** | The /discounts population. |
| `Delivery Income` | **6** | Trip charge, tailgate delivery, DIW, FDIW — **and `NZCM30`, a Natchez Crape Myrtle**, misfiled. |
| `Income` | **7** | `Backyard Delivery` ($125), a crape myrtle bundle, and four catch-alls. |
| Refund · Late Fee · Warranty COGS · Services · Add-On | **5** | One each. |

So `Type: 'Service'` is **not a proxy for "a service"** — 64 of the 147 are plants and 35 are goods.
**Filtering on `Type` alone would move 99 real products out of the catalogue.** The classification
that works is the one this build already implements and proves: **the income account, which is HER
word for what the money is, matched by NAME and never by id** (an id is a tenant literal). The split
it produces, on the same capture:

> **564 products · 73 services · 8 discounts · 2 bookkeeping · 38 folders = 685.**

### THE CHANGE, NOT MADE

1. `AdaptedItem` gains `incomeAccountName` (already parsed by `parseItemList`; `qboItemAdapter` drops it).
2. `adaptQboItems` calls `classifyDestination` — **exported, tested, 48 mutants** — and keeps only
   `destination === 'product'`.
3. `AdaptedItemList.counts` gains the other four counts, so the screen can print the full census
   rather than one number.
4. `QboCatalogueImport.tsx` prints the split instead of `sellable`.

**Not made in this pass, deliberately.** The import is a WRITE path that has already run against
LAWNS (447 rows, then 647), and re-shaping what it writes inside a review build is the scope creep
that makes a diff unreviewable. It also needs its own owner-test: the 64 misfiled trees are exactly
the rows `retire-and-replace` (R-70) is about, and moving them is a data question, not a filter.

---

## ② DOES `service_offerings` CARRY A UNIT CONCEPT?

**Yes — two columns, and they already say everything the prompt's two examples need.**

`20260529_businesses_f_service_offerings.sql:25-30`:

```sql
price_type text NOT NULL DEFAULT 'per_unit' CHECK (price_type IN ('flat', 'per_unit')),
price_unit text NOT NULL DEFAULT 'plant'    CHECK (price_unit IN ('order', 'plant', 'vehicle', 'visit')),
```

Trip charge is `flat` / `order`; tree bubbler is `per_unit` / `plant`. Both are representable today,
and this build **measures which is which from `Qty` rather than assuming** —
`[MEASURED]`: trip charge carries `Qty = 1` on **516 of 523 lines (99%)**; the tree bubbler on
**26 of 81 (32%)**, running 2·3·4·5·6.

### 🔴 THE T-POST EXAMPLE IS NOT THE GAP, AND THE CORRECTION MATTERS

The prompt gives *"T-post staking is $40 AND $50 by size"* as evidence that a by-size concept has no
home. `[MEASURED]`: **there is no such service.** There are **three separate items**, each with its
own name and its own published price:

| Item | Description | List | Billed | Prices charged |
|---|---|---:|---:|---|
| `TSK2` | Tree Staking Kit — [2 T-Posts] | $40 | 6 invoices | $40 × 6 |
| `TSK3` | Tree Staking Kit — [3 T-Posts] | $45 | 3 invoices | $45 × 2, $40 × 1 |
| `TSK4` | Tree Staking Kit — [4 T-Posts] | $50 | 5 invoices | $50 × 4, $0 × 1 |

Three items, three flat prices, and the size is **in the name**. Nothing is missing. ⚠️ The prompt's
*"11 invoices, $40 AND $50, every time"* is `TSK2 + TSK4` and **omits `TSK3` entirely** — the middle
rung, whose own list price its invoices disagree with once.

### 🔴 THE REAL GAP IS THE PLACEMENT LADDER, AND IT IS ONE COLUMN

`price` is a single `numeric(10,2)`. The ladder this build measures needs **six prices for one
service**:

> 7 gal $101 · 15 gal $214 · 30 gal $418 · 45 gal $529 · 65 gal $650 · 95 gal $906
> *(and 200 gal $1,829, on 9 lines from one plant)*

`service_offerings` cannot hold that. The three shapes available, none chosen here:

| | Shape | Cost | What it gives up |
|---|---|---|---|
| a | **Six rows**, one per pot size, `flat`/`plant` | zero migration, ships today | six rows a customer must not be shown at once; the checkout has to pick by the plant's size, and nothing joins them |
| b | **A `price_by_size jsonb` column** | one `ALTER`, additive, no rewrite | a second pricing vocabulary beside `price`; two writers of one number unless `price` becomes the fallback |
| c | **A `service_offering_prices` child table** keyed `(offering_id, size)` | a migration + a join on every checkout read | the fullest answer, and the only one that survives *"per size AND per tier AND per season"* |

**This is David's call and I did not make it.** (a) is the only one that needs no migration, and it
is also the one that will be regretted first.

---

## ③ WHAT HAPPENS TO THE ONE EXISTING ROW WHEN THE LADDER IS ACCEPTED?

**Nothing. The ladder is not accepted — it is reported, and the button below it does not write it.**

`[STATED]` (from the prompt; **not measured** — see the service-key note above): `service_offerings`
holds one row at LAWNS, *"tree placement"*, at $125 a plant.

Three facts about the code as shipped:

1. **The ladder section carries no checkbox and no price box.** It renders above the write control
   and the amber line under it says so: *"this is a suggestion, and it is not saved by the button
   below… whatever you have there now stays exactly as it is until you change it."*
2. **`buildServiceRows` only ever INSERTs**, and it **refuses a name already on the menu**
   (case-insensitively, re-read immediately before the write). So even a row named `tree placement`
   arriving from a suggestion cannot overwrite the existing one — the whole press is refused with
   the reason, and she is pointed at the editor one card below.
3. **The existing row is therefore untouched in every path.** Mutants `W3` and `W4` are the guards;
   both are caught.

⚠️ **What this leaves open, stated rather than solved:** if `[STATED]` is right, LAWNS's placement is
priced at **$125 flat against a measured ladder running $214–$906**, i.e. roughly **$300 a plant
under on anything 30 gallon and up**. This build puts that number in front of her with its evidence
and refuses to change it for her. Acting on it needs ②'s decision first.

---

## ④ 🔴 A SERVICE ACCEPTED HERE AND THE SAME QUICKBOOKS ITEM IMPORTED AS A PRODUCT

**Nothing prevents it. Nothing can even detect it. And the reason is one missing column.**

- `business_inventory` carries `qb_item_id`, and `20260906c_qb_identity_unique_indexes.sql:77` puts a
  unique index on `(business_id, qb_item_id)` — so **within the catalogue** one QuickBooks item can
  only ever be one row.
- **`service_offerings` carries no QuickBooks reference of any kind.** `[MEASURED]` against the
  migration corpus: `business_id · name · description · category · timing · price_type · price_unit ·
  price · transport_mode · trigger_transport_mode · recurrence_days · requires_address ·
  pre_selected · is_active · sort_order · created_at`, plus `compliance_title · compliance_body ·
  service_note` from migration G. No `qb_item_id`, and the CHECK/column set has never been altered
  since 2026-05-29.

So today: accept `Tree Bubbler` here → one `service_offerings` row. Run the catalogue import → item
`185` also lands in `business_inventory` as a **product priced $65 with a scannable SKU**. Two live
records for one item, **each unaware of the other**, and the same $65 can be added to an order twice
by two different mechanisms. The unique index does not fire — it is scoped to one table.

⚠️ **It is not hypothetical and it is not rare.** Of the 73 items this screen classifies as services,
**35 sit on `Sales of Product Income`** — precisely the ones the catalogue import is most confident
about. The bubbler is the clearest case: her books call it a product, this screen offers it as a
service, and **both are defensible**, which is exactly why both will happen.

### THE FIX, NOT MADE (it is a migration, and David applies all SQL)

1. `ALTER TABLE service_offerings ADD COLUMN qb_item_id text;`
2. A partial unique index `(business_id, qb_item_id) WHERE qb_item_id IS NOT NULL` — the same shape
   as `20260906c`. ⚠️ **#54/#58's blocker applies: it cannot land until the live rows are known
   clean**, and this session could not read them.
3. The review writes `qb_item_id` on accept (it already holds Intuit's id on every row — `ServiceRow.id`).
4. `adaptQboItems` excludes any id already present in `service_offerings` for that business, and
   **reports the exclusion** rather than dropping it silently.

**Filed as tech-debt #219.** Until then the collision is real, and the honest mitigation is ① —
routing the 147 correctly means the import stops offering to create most of these as products in the
first place.

---

## A FIFTH THING, NOT ASKED FOR, FOUND ON THE WAY

🔴 **`seedServiceOfferings` WRITES A CATEGORY THE DATABASE REFUSES, AND SWALLOWS THE ERROR.**
`discovery/seed.ts:20` returns `category: 'uncategorized'` for anything it does not recognise — a
deliberate D-9 honesty fix, documented as such in its own comment. **The CHECK on
`service_offerings.category` holds five values and `uncategorized` is not one of them**, and the
constraint has never been altered. So the INSERT is rejected by Postgres, and the sole caller
(`api/discovery/ingest.ts:191`) logs it as `seed (non-fatal)` and continues.

**A D-9 fix that the schema refuses is not a fix; it is a silent drop.** Filed as tech-debt **#217**.
`buildServiceRows` refuses the same value before it reaches the database, and mutant **W5** guards it.
