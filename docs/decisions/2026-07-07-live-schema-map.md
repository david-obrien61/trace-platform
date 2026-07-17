# Live Schema Map — inventory → price → sale

**Date:** 2026-07-07 · **Type:** READ-ONLY RECON (nothing changed) · **Source:** live DB `bgobkjcopcxusjsetfob` (service-key SELECT), cross-checked against migrations + code
**For:** David — "where does data go, and where do I enter a sell price?"

---

## TL;DR — the three answers you asked for

1. **Where do I enter a SELL PRICE?** → **You can't. There is no sell-price field and no screen to enter one.** The app has exactly one money column on inventory — `business_inventory.unit_cost` (what you *paid*) — and it is `NULL` on all 111 rows. There is **no `sell_price` / `retail_price` column anywhere**, and no form that writes one.

2. **Why can't I complete a sale?** → The cart reads `business_inventory.unit_cost` as the price. It's `NULL` everywhere → **every item shows $0.00**. A sale "completes" but for $0. The cost→margin→price engine (`MarginEngine`) exists but is **not wired to checkout** — it only runs on the Cost-to-Produce analysis screen.

3. **Why doesn't counting "Shoal Creek Vitex 45 gal" create a sized row?** → The count flow **never writes `size` to `business_inventory`** — it only sets `qty` on the one existing (sizeless) row, and logs your typed "45 gal" as a throwaway text label in `inventory_counts.item_label`. There are **0 sized rows** in the catalog (per-size population was never run), and `cultivar_plants` is **empty (0 rows)**, so QR/tag scans of `vitex-shoal-creek` never resolve → they fall to UNKNOWN.

---

# PART 1 — The real schema (from the live database)

Legend: **PK** primary key · **FK→** foreign key · `nullable` · **[live]** columns read from an actual row · **[migration]** columns read from the CREATE TABLE (table empty, or live-only)

## `business_inventory` — the catalog / on-hand table **[live, 111 rows]**
The heart of it. One row per item. **Note: no sell price. `unit_cost` is the only money field, and it's NULL.**

| column | type | notes |
|---|---|---|
| id | uuid | **PK** |
| business_id | uuid | **FK→** businesses.id |
| sku | text | e.g. `DISC-1105` (discovery-imported) |
| name | text | e.g. "Shoal Creek Vitex" |
| description | text | nullable |
| qty | int | on-hand count (this is what a count sets) |
| **unit_cost** | numeric | **nullable — NULL on all rows.** What you PAID. **The cart uses this as the price.** |
| serial_number | text | nullable |
| location | text | nullable |
| status | text | e.g. "available" |
| received_at | timestamptz | nullable |
| photo_url | text | nullable |
| notes | text | e.g. "[DISCOVERY] from https://lawnstrees.com" |
| created_at / updated_at | timestamptz | |
| receipt_id | uuid | **FK→** receipts.id, nullable — links a cost to a receipt |
| cost_confidence | text | UNKNOWN / ESTIMATED / DERIVED / CONFIRMED |
| **size** | text | **nullable — NULL on all 111 rows.** Grower's size (e.g. "45 gal"). |
| **variant_group** | text | **nullable — NULL on all 111 rows.** Groups sibling sizes under one plant. |

**There is NO price, sell_price, retail_price, list_price, or margin column on this table.**

## `inventory_counts` — durable record of each physical count **[live, 9 rows]**
Where a count is *logged*. **This is where your "45 gal" went — as a text label, not as catalog data.**

| column | type | notes |
|---|---|---|
| id | uuid | **PK** |
| session_id | uuid | **FK→** inventory_count_sessions.id (CASCADE) |
| business_id | uuid | **FK→** businesses.id |
| inventory_id | uuid | **FK→** business_inventory.id (SET NULL) — the resolved lot; **NULL = unrecognized** |
| plant_tag_id | text | the scanned tag, if a plant tag resolved it |
| item_label | text | **display name counted — your typed "45" / "Vitex shoal creek 45 gal" lands here** |
| counted_qty | int | the number you counted |
| was_unknown | boolean | **true = scan did not resolve to a known item** |
| raw_scan | text | the raw scanned string (URL/code) for audit |
| counted_at / created_at | timestamptz | |

## `inventory_count_sessions` — one row per counting session **[live, 1 row]**
| column | type | notes |
|---|---|---|
| id | uuid | **PK** |
| business_id | uuid | **FK→** businesses.id |
| status | text | in_progress / completed / abandoned |
| counted_by | uuid | auth.uid() of the counter (not an FK) |
| item_count | int | denormalized count of rows |
| started_at / completed_at / created_at / updated_at | timestamptz | |

## `cultivar_plants` — per-plant IDENTITY (QR tag → plant) **[EMPTY — 0 rows]** **[migration]**
Vertical identity only. **Empty. This is why QR/tag scans never resolve.**

| column | type | notes |
|---|---|---|
| id | uuid | **PK** |
| business_id | uuid | **FK→** businesses.id |
| inventory_id | uuid | **FK→** business_inventory.id (SET NULL) — links a plant to its lot |
| tag_id | text | the QR/scan tag (e.g. would hold "vitex-shoal-creek") |
| species / common_name / plant_type | text | |
| current_container | text | the plant's size/container |
| location_zone / warranty_months / photo_url / notes | mixed | |

## `plant_events` — growth timeline **[EMPTY — 0 rows]**
Timeline events per plant (FK→ the plant). Not part of the sale/price path.

## `orders` — a completed sale **[EMPTY — 0 rows; live-only, no migration (tech-debt #39)]** **[code: submit.ts]**
Written by `api/orders/submit.ts`. Columns it writes:

| column | notes |
|---|---|
| id | **PK** |
| business_id, customer_id | **FK→** businesses / customers |
| transport_method, transport_note | delivery routing + netting note |
| netting_declined | boolean |
| subtotal, tax_amount, total_amount, addons_amount | **money — computed from `unit_cost` (NULL → all $0)** |
| leakage_flag | boolean (large container + no netting/addon) |
| status | 'pending' |
| qb_invoice_id, qb_invoice_url | QuickBooks link |

## `order_items` — line items on an order **[EMPTY — 0 rows; live-only]** **[code: submit.ts]**
| column | notes |
|---|---|
| id | **PK** |
| order_id | **FK→** orders.id |
| plant_id | **FK→** cultivar_plants.id |
| quantity | int |
| **unit_price** | **= `business_inventory.unit_cost` (server re-fetched). No separate sell price.** |
| subtotal | unit_price × quantity |

## `customers` — the customer roster **[live, rows present]**
| column | type | notes |
|---|---|---|
| id | uuid | **PK** |
| business_id | uuid | **FK→** businesses.id |
| person_id | uuid | **FK→** people.id (person spine) |
| first_name / last_name / email / phone / address_line1 / city / state / zip | text | |
| qb_customer_id | text | QuickBooks link, nullable |
| marketing_opt_in | boolean | |
| source | text | e.g. "ocr-invoice" |
| lifetime_value | numeric | |
| **price_tier** | text | **"retail" — EXISTS but never applied at checkout (dormant)** |
| customer_type | text | "person" / etc. |

## `service_offerings` — add-ons / transport / services **[live, rows present]**
| column | type | notes |
|---|---|---|
| id | uuid | **PK** |
| business_id | uuid | **FK→** businesses.id |
| name / description / category | text | category e.g. "inspection", "addon" |
| timing | text | at_checkout / post_purchase / recurring |
| price_type / price_unit | text | flat / per_unit · visit/unit |
| **price** | numeric | **the ONE place a real sell price IS entered — but only for services/add-ons, not plants** |
| transport_mode / trigger_transport_mode | text | drives netting/transport logic |
| recurrence_days / requires_address / pre_selected / is_active / sort_order | mixed | |
| compliance_title / compliance_body / service_note | text | |

## `cost_objects` — cost & asset ledger (Cost-to-Produce) **[live, rows present]**
Assets, recurring costs, labor — the cost side. **Not sell price.** Money columns: `acquisition_cost`, `recurring_amount`, `estimated_value`. Has `cost_confidence`, `cost_category`, `recovery_basis`, `parent_id` (**FK→** self), `receipt_id` (**FK→** receipts), `resource_id` (**FK→** labor_resources). This is the input to `MarginEngine` — but the output never reaches the cart.

## `business_pricing_config` — margin / pricing policy **[EMPTY — 0 rows]** **[migration]**
| column | type | notes |
|---|---|---|
| business_id | uuid | **PK, FK→** businesses.id |
| config | jsonb | margin baseline, tiers, target-customer denominators — **read only by the Cost-to-Produce screen, not checkout** |

## `labor_resources` / `labor_resource_wages` **[EMPTY]**
Labor rates for cost-to-produce. Wages split into a permission-walled child table. Not part of the sale/price path.

---

## FK relationship map (ERD-ready)

```
businesses (tenant root)
  ├──< business_inventory        (business_id)         ← THE CATALOG. has unit_cost (NULL), size (NULL). NO sell price.
  │       ↑ inventory_id
  │       └──< cultivar_plants   (inventory_id, SET NULL)  ← EMPTY. QR identity. tag_id lives here.
  │                 ↑ plant_id
  │                 └──< order_items (plant_id)         ← EMPTY. unit_price := unit_cost.
  │       ↑ inventory_id (SET NULL)
  │       └──< inventory_counts  (inventory_id)         ← counts logged here. size → item_label (text, discarded).
  │                 ↑ session_id
  │                 └── inventory_count_sessions (business_id)
  │       ↑ receipt_id
  │       └── receipts
  ├──< customers                 (business_id, person_id→people)  ← price_tier "retail" (dormant)
  │       ↑ customer_id
  │       └──< orders            (customer_id, business_id)  ← EMPTY. money computed from unit_cost (NULL→$0).
  │                 ↑ order_id
  │                 └──< order_items
  ├──< service_offerings         (business_id)          ← the ONLY table with a real sell `price` (services/add-ons)
  ├──< cost_objects              (business_id, parent_id→self, receipt_id→receipts, resource_id→labor_resources)
  ├──  business_pricing_config   (business_id PK)        ← EMPTY. margin config. Only Cost-to-Produce reads it.
  └──< labor_resources ──< labor_resource_wages
```

> **Data-tenant note (may explain some confusion):** your inventory + counts live under business `f7ec5d67…` ("Test Dave's Tree Nest"), but the customer Marcus Webb lives under a *different* business `ed2e5933…`, and service_offerings under others again. Different tenants → data won't line up across screens if you're switched between businesses.

---

# PART 2 — Where is a SELL PRICE entered + stored?

**Direct answer: there is NO sell-price field for inventory/plants, and NO surface to enter one. It does not exist.**

- **Sell/retail price column?** None. The only money column on `business_inventory` is **`unit_cost`** (what you paid), and it is `NULL` on all 111 rows. No `sell_price`, `retail_price`, `list_price`, or `price` column exists on `business_inventory`, `cultivar_plants`, or `orders`.
- **`unit_cost` — which table.column + what writes it?** `business_inventory.unit_cost`. It's meant to be populated from receipts (Receipt Keeper / OCR / cost-apply) or discovery. Today it's NULL everywhere — the discovery import created the 111 rows with cost `UNKNOWN`, and no receipt has been applied to them.
- **The one place a real sell price IS entered:** `service_offerings.price` — but that's for **services and add-ons** (netting, warranty visits, install), **not for plants/trees**. There is no plant-price equivalent.
- **`customers.price_tier`** exists ("retail") but is **display-only** — no code applies it.

**What would be needed to enter a sell price:** either (a) populate `business_inventory.unit_cost` and add a margin markup at checkout, or (b) add a real `sell_price` column to `business_inventory` plus a UI field to set it, and make the cart read it. Neither exists today.

---

# PART 3 — The pricing pipeline (cost → price)

**Is it wired end-to-end? No. It breaks in two places.**

Intended pipeline:
```
receipt → business_inventory.unit_cost  +  margin/overhead (Cost-to-Produce) → sell price → cart
```

What actually happens:
```
business_inventory.unit_cost (NULL) ──────────────────────────────────→ cart shows $0.00
                          ▲                          MarginEngine ✗ never called by checkout
                          └── receipts never applied → unit_cost stays NULL
```

- **Break #1 — unit_cost is never populated.** Receipt Keeper writes the `receipts` table but does not push a cost onto the inventory rows; discovery created them as `UNKNOWN`. So `unit_cost = NULL`.
- **Break #2 — the margin engine is not connected to checkout.** `MarginEngine.calculateRetail(cost, config)` is real and works, but it is called **only** by the Cost-to-Produce analysis screen (`CostToProduce.tsx`). **Checkout never calls it.** The cart reads `unit_cost` raw, with no markup.

**What the customer actually sees / pays:**
- `PlantProfile.tsx:44` → `const unitCost = inv?.unit_cost ?? 0` → **NULL becomes 0**.
- `CartReview.tsx:57` → `plantSubtotal = (unit_cost ?? 0) * quantity` → **$0.00**.
- `api/orders/submit.ts` → re-fetches `unit_cost` server-side, writes `order_items.unit_price = 0`, `orders.total_amount = 0`.
- **Net effect: the customer can complete an order for $0.00, no warning, no block.** This is why a sale "goes through" but isn't a real sale.

**Contractor / price-tier discount:** **Does not exist as working code.** `customers.price_tier` is a column ("retail") shown in the roster only; `MarginEngine` accepts a `tierName` param but checkout never passes a customer tier and never applies a discount.

---

# PART 4 — The count-size persist bug

**Plain answer: when you count "Shoal Creek Vitex 45 gal," no sized `business_inventory` row results because (a) there are no sized rows to route to, (b) the QR tag can't resolve, and (c) the count flow has no code that ever writes `size` to `business_inventory`. Your "45 gal" is saved only as a text label in `inventory_counts`.**

The live evidence (`inventory_counts`), in order:
| plant_tag_id | item_label | qty | was_unknown | inventory_id |
|---|---|---|---|---|
| vitex-shoal-creek | **45** | 15 | **true** | **null** |
| vitex-shoal-creek | Vitex-shoal-creek | 15 | **true** | **null** |
| vitex-shoal-creek | Vitex shoal creek 45 gal | 2 | **true** | **null** |
| null | Shoal Creek Vitex (SKU DISC-1105) | 45 | false | dfe50b45… |

Your three sized scans all logged **`was_unknown=true`, `inventory_id=null`** — the size "45 gal" survives only in `item_label`.

**Why, step by step:**

1. **`cultivar_plants` is EMPTY (0 rows).** The scan resolver's first step is `cultivar_plants.tag_id` exact match. With an empty table, scanning the QR/URL `vitex-shoal-creek` matches nothing.

2. **SKU fallback fails too.** Step 2 tries `business_inventory.sku` exact. The Shoal Creek Vitex row's SKU is `DISC-1105`, not `vitex-shoal-creek` → no match.

3. **The size-picker can't fire** (feature from ledger #72). It only triggers when a token match returns **≥2 rows sharing one `variant_group`, each with a distinct `size`**. But **0 of 111 rows have any `size`/`variant_group`** — the per-size catalog was never populated (it was deliberately gated on this picker being owner-proven). There's exactly **one** sizeless "Shoal Creek Vitex" row → no siblings → no picker → falls to **UNKNOWN**.

4. **UNKNOWN branch logs but never creates a catalog row.** By design, an unrecognized scan records `inventory_counts` with `was_unknown=true` and does not auto-create/modify `business_inventory`. Your typed "45 gal" goes into `item_label` and stops there.

5. **Even the KNOWN branch never writes size.** `commitCount()` (`InventoryCount.tsx:371-395`) does exactly two things: `UPDATE business_inventory SET qty` on the resolved lot, and insert an `inventory_counts` record. **It never writes `size` or `variant_group`, and never inserts a new sized row.** So there is *no* path in the count flow — known or unknown — that produces a sized `business_inventory` row.

**Root cause in one line:** *size is treated as a per-count text label, not as catalog identity — and the sized catalog rows it would attach to were never created.* To make sized rows appear you need either the gated per-size catalog populate to run, or a new "create this as a sized item" action in the UNKNOWN branch. Neither exists today.

---

## What this means for "I can't complete a sale"

Two independent gaps, both real:
1. **No price to sell at** — `unit_cost` NULL + no sell-price field + margin engine not wired → cart is $0. (Parts 2 & 3)
2. **Inventory identity is thin** — empty `cultivar_plants` (no QR resolution) + no sized rows → scans fall to UNKNOWN. (Part 4)

Nothing was changed by this recon. This document is the map; the fixes are separate decisions.
