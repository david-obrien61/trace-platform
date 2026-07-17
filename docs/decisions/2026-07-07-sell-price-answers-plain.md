# The Three Answers, Plain — sell price, broken sale, count-size bug

**Date:** 2026-07-07 · READ-ONLY recon (nothing in the database was changed).
**Full detail + per-column schema + ERD:** [2026-07-07-live-schema-map.md](2026-07-07-live-schema-map.md)

---

## 1. Where do I enter a sell price? — **You can't. It doesn't exist.**

There is **no sell-price / retail-price field anywhere** and **no screen to enter one**.

- `business_inventory` has exactly one money column — **`unit_cost`** (what you *paid*) — and it is **NULL on all 111 rows**.
- No `sell_price`, `retail_price`, `list_price`, or `price` column exists on `business_inventory`, `cultivar_plants`, or `orders`.
- The **only** table with a real, enterable sell `price` is **`service_offerings.price`** — and that's for **services/add-ons only** (netting, warranty visits, install), **not plants/trees**.

**What it would take:** either populate `business_inventory.unit_cost` and add a margin markup at checkout, or add a real `sell_price` column + a UI field to set it and make the cart read it. Neither exists today.

---

## 2. Why the sale won't complete — **the cart reads `unit_cost`, which is $0**

The pricing pipeline is **broken at two links**:

```
receipt → business_inventory.unit_cost  +  margin (Cost-to-Produce) → sell price → cart
             ▲ NULL (never populated)         ✗ never called by checkout
```

- **`unit_cost` is never populated** — discovery created the 111 rows as cost `UNKNOWN`; no receipt has been applied → NULL.
- **The margin engine is not wired to checkout** — `MarginEngine.calculateRetail()` works, but it is called **only** by the Cost-to-Produce *analysis* screen (`CostToProduce.tsx`). Checkout reads `unit_cost` raw, with no markup.

**Result:** `PlantProfile.tsx:44` and `CartReview.tsx:57` both do `unit_cost ?? 0` → **customer sees $0.00**. Order writes `order_items.unit_price = 0` and `orders.total_amount = 0`, with **no warning and no block**. That's why a "sale" goes through but isn't a real sale.

**Contractor / price-tier discount:** `customers.price_tier` exists (value "retail") but is **display-only** — no code applies any discount at checkout.

---

## 3. Why counting "Vitex 45 gal" makes no sized row — **size is a throwaway label, and there are no sized rows to attach to**

Live `inventory_counts` shows your three sized scans logged `was_unknown=true`, `inventory_id=null`, with "45 gal" surviving only in the `item_label` text field.

| plant_tag_id | item_label | qty | was_unknown | inventory_id |
|---|---|---|---|---|
| vitex-shoal-creek | **45** | 15 | **true** | **null** |
| vitex-shoal-creek | Vitex shoal creek 45 gal | 2 | **true** | **null** |
| null | Shoal Creek Vitex (SKU DISC-1105) | 45 | false | dfe50b45… |

**Root cause chain:**
1. **`cultivar_plants` is empty (0 rows)** → scanning the QR tag `vitex-shoal-creek` resolves to nothing.
2. SKU fallback fails (`DISC-1105` ≠ `vitex-shoal-creek`) → falls to **UNKNOWN**.
3. **The size-picker can't fire** — it needs ≥2 rows sharing a `variant_group`, each with a distinct `size`. But **0 of 111 rows have any size** (per-size catalog population was gated and never run). There's one sizeless "Shoal Creek Vitex" row → no siblings → no picker.
4. **The count code never writes size.** `commitCount()` (`InventoryCount.tsx:371-395`) only does `UPDATE business_inventory SET qty` + inserts an `inventory_counts` record. **No path — known or unknown — ever creates or updates a sized row.**

**One line:** *size is treated as per-count text, not catalog identity — and the sized rows it would attach to were never created.*

---

## Bonus flag — you may be switched between two businesses

Your inventory + counts live under business **`f7ec5d67…`** ("Test Dave's Tree Nest"), but customer **Marcus Webb** lives under a *different* business **`ed2e5933…`**, and `service_offerings` under others again. If you're switched between businesses, data legitimately won't line up across screens.

---

## Bottom line — two independent gaps, both real

1. **No price to sell at** — `unit_cost` NULL + no sell-price field + margin engine not wired → cart is $0.
2. **Inventory identity is thin** — empty `cultivar_plants` (no QR resolution) + no sized rows → scans fall to UNKNOWN.

Nothing was changed by this recon. This is the map; the fixes are separate decisions.
