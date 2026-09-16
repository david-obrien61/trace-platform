# RECON — `business_inventory` cannot tell a plant from a material

**Date:** 2026-09-16 (verified via `date`) · **Ledger:** #340 · **Tech-debt:** #307 · **Type:** recon + filing, **nothing built, nothing written to the database**
**Tenant measured:** LAWNS (`ed2e5933-45dc-4b9b-a331-ddfd125e7a74`), read-only, via the management-API catalog path with `read_only: true`.

---

## 1. HAVE — what exists to tell a plant from a material

**Nothing.** The live column list of `business_inventory` (33 columns, read from `information_schema`, not from migrations) has no category, type, kind or plant flag. The candidates, each checked:

| Candidate | Why it does not answer the question |
|---|---|
| `attributes -> 'QB type'` | Present on the **447 retired** rows only (`Non-inventory` 397 · `Service` 48). **0 of 647 live rows carry it** — the current import does not keep it. And a QuickBooks item type says nothing about plant-ness anyway. |
| `unit_kind` | A projection of the SIZE TEXT. `Container` sized "45-gallon empty used bucket" reads `container`, value 45. |
| `cultivar_plants.inventory_id` | Links **0** live rows. |
| `variant_group`, `price_basis` | Set on nearly every row with the same value; they distinguish nothing. |
| `category` | Exists on `receipts` and `service_offerings` only. |

**The same shape as [[R-118]]** — `item_type` (`purchased` · `grown` · `manufactured`), ruled 2026-09-05 and never built: a fact about WHAT A ROW IS, which every consumer currently re-guesses from text.

## 2. The uppot plan's refusals, split

The planner's own `classifyLot` replayed against the 647 live rows and the live ladder: **178 refused** (David's screen read 162; the ladder was edited at 08:30 CDT 2026-09-16, after that screen — the 162 is not reproducible).

| Refusal | Plant | Not a plant | Unclear |
|---|---|---|---|
| no size read (111) | 25 | **84** | 2 |
| size read, not a rung (67) | **62** | 5 | — |
| **Total** | **87** | **89** | 2 |

- The **84** are fertiliser, compost, rock, sod, bubblers, rope, tarp — and **fees, services, deposits, discounts, hours, a late fee and a gift certificate**.
- The **5** are the three `Tree Staking Kit` rows (`[2/3/4 T-Posts]`), `T-Posts` (5.5 feet tall) and `Compost - Back Bastrop Mix` (1 Yard).
- The **62** are real plants on sizes LAWNS runs under another spelling (7 gallon ×21, 1 gallon ×15, 1G ×9, 2 gallon/2G ×7, 10 gallon ×2) or on sizes that are not container sizes (three boxes, `2"`, `10 ft tall`, `10/15 gallon`, `300gal`).
- **Unclear (2):** `Arizona Cypress Blue Ice Replacement` and `Muskogee Crape Myrtle, 65 Gallon (20% off) + Installation & Warranty` — a plant bundled with a service.

⚠️ The plant / not-plant tagging is **a human reading of the names** — there is no column to derive it from, which is the finding.

## 3. The other direction — non-plants the plan and the load list ACCEPT

**3 of the 469 plannable rows are empty pots**, and nothing but their size text says so:

| name | size | sell_price |
|---|---|---|
| `Containers` | 15 gallon | $3 |
| `Containers` | 30 Gallon | $10 |
| `Container` | 45-gallon empty used bucket | $20 |

**Measured through the real function, not inferred:** `resolveLoadItem` (`packages/cultivar-os/src/lib/loadList.ts:273`) classifies all three as **`tree`** — the one kind that *"earns a bill of materials"* (its own comment, `:153`). So an order for an empty bucket would print stakes, mix and a bubbler on the yard sheet. `Tree Staking Kit` resolves `other_goods`, correctly.

## 4. The seed put stock on fees

All 647 live rows came from ONE import run (`eab7fbd2-04cd-45e5-b771-cbb07f662f6f`) and carry **qty 10** (one carries 8). The import wrote them at qty 0 (`itemImportWriter.ts` `rowForItem`: *"`qty: 0` IS NOT A PLACEHOLDER, IT IS THE TRUTH"*); David's 2026-09-09 query set them to 10, scoped to the run id — correctly avoiding LAWNS's own rows, but catching fees with the plants. **Non-plants carrying stock: 92** (the 89 refused + the 3 pots). Plants: 553. Unclear: 2. 647 total.

🔴 **Why it matters beyond the plan:** before the seed, `classifyLot`'s first check (*nothing on hand*) refused every fee silently and correctly. The seed turned `Military Discount 5%`, `Trip Charge` and `Hours` into stocked lots, which is why they now surface as size problems.

## 5. A scoped reversal — WRITTEN, NOT RUN

**Confirmed clean for the 92, measured, not assumed** (read-only preflight, 2026-09-16):

| check | result |
|---|---|
| rows in scope | **92** (= 89 + 3, no plant row caught by a name) |
| rows not currently at 10 | 0 |
| `business_inventory_ledger` rows | **0** |
| `order_items` referencing them | 0 |
| `inventory_counts` | 0 |
| `production_plan_lines` (source or target) | 0 |
| rows where `unit_parsed_from IS DISTINCT FROM size` (the only trigger that could rewrite anything on UPDATE) | **0** |

Triggers on the table, from `pg_trigger`: `business_inventory_unit_projection` (inert — the row above) and `business_inventory_updated_at` (bumps `updated_at`; that is the only side effect, and the seed already bumped it once). **No trigger derives `status` from `qty`**: all 647 read `available`, which is what the import wrote at qty 0, so reversing leaves `status` exactly as the import left it.

Because neither the seed nor this reversal writes a ledger row, **the reversal RESTORES agreement rather than breaking it**: today those 92 lots have book 10 and a ledger replay of 0.

⚠️ **THE WHOLE-RUN REVERSAL IS NOT CLEAN, AND THE REASON IS ONE ROW.** `Desert Willow` (30 Gallon, a plant) carries qty 8 and ONE real ledger row: a `sale` of −2 on 2026-09-09 20:26 UTC, order `6a60a0ca-dedf-4c1d-a58c-804bf1e64c79`, one `order_items` line (2 × $900). Putting it back to 0 would leave a replay of −2. It is a plant, so it is outside the 92.

```sql
-- PLANT-VS-MATERIAL: reverse the 2026-09-09 opening stock on the 92 NON-PLANT rows only.
-- NOT RUN. Run as postgres in the SQL editor. Refuses unless the preflight still holds.
BEGIN;

CREATE TEMP TABLE scope ON COMMIT DROP AS
SELECT id FROM business_inventory
WHERE business_id   = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
  AND import_run_id = 'eab7fbd2-04cd-45e5-b771-cbb07f662f6f'
  AND retired_at IS NULL
  AND qty = 10
  AND name IN (
  '1 Yard Scoop: Fertile Compost Mix - Proprietary Blend',
  '1 Yard Scoop: Regular Compost Mix - w/o Fertilizer',
  '1.5lb Bottle: Schultz 20-20-20 Liquid Fertilizer',
  '1/2 Yard Scoop: Fertile Compost Mix - Proprietary Blend',
  '1/2 Yard Scoop: Regular Compost Mix - w/o Fertilizer',
  '15gal Bucket: Fertile Compost Mix - Proprietary Blend',
  '15gal Bucket: Regular Compost Mix - w/o Fertilizer',
  '30gal Bucket: Fertile Compost Mix - Proprietary Blend',
  '30gal Bucket: Regular Compost Mix - w/o Fertilizer',
  '3lb Bag: Fertilome 20-20-20 Water Soluble Fertilizer',
  '40lb Bag: Gardenline Lawn & Garden 19-5-9 Fertilizer',
  '45gal Bucket: Fertile Compost Mix - Proprietary Blend',
  '45gal Bucket: Regular Compost Mix - w/o Fertilizer',
  '4lb Bottle: Nutri-Star Granular Crape Myrtle Food',
  '5/8" flat Rope by the roll',
  '50lb Bag Of Osmocote 19-5-9 Premium Granular Fertilizer',
  '50lb Bag: Bumper Crop General Purpose 12-24-12 Fertilizer',
  '50lb Bag: Micromax Granular Micronutrients',
  '50lb Bag: Osmocote Blend 21-4-8',
  '5lb Bottle: Schultz 20-20-20 Liquid Fertilizer',
  '95 gallon container of compost',
  'Adjustable Tree Bubbler',
  'Augur Holes, and install water monitor pipe',
  'Backyard Delivery [WILL DROP IN THE BACKYARD, OR ANYWHERE ELSE ON THE PROPERTY]',
  'Bag Of Landscaper''s Pride Black Organic Humus Compost',
  'Balance Correction',
  'Bank Deposit/Customer Overpayment Refund',
  'Bermuda sod by the pallet, 450 sq. ft',
  'Brazos River Rock',
  'Brown Patch / Take all Patch treatment 4# p 1000 Heritage G',
  'Chainlock',
  'Compost - Back Bastrop Mix',
  'Container',
  'Containers',
  'Contractor Discount 15% off',
  'Contractor Discount, 10%',
  'Credit',
  'Custom Amount',
  'Customer Discount',
  'Decomposed Granite',
  'Deer Fencing',
  'Deliver, Install and Warranty listed plants',
  'Deposit',
  'Existing tree removal',
  'Extended warranty',
  'Extra charge',
  'Family Discount',
  'Fertilizer-1',
  'Furnish, Deliver, Install and Warranty listed Trees',
  'Gallons Diesel',
  'Gift Certificate',
  'Ground Cloth',
  'HYIS',
  'Hose Tree Bubbler',
  'Hours',
  'Install your Tree',
  'Kubota Hours',
  'Labor Hours',
  'Late fee',
  'Military Discount -10%',
  'Military Discount 5%',
  'Move Tree',
  'Plant Your Tree',
  'Prepared Enriched Planting Mix by the yard',
  'Remove your existing Tree',
  'Replant your existing tree straight',
  'Sales',
  'Scoop of Mulch',
  'Services',
  'Sprinkler repair',
  'Stump Removal',
  'Supervisor Hours',
  'T-Post',
  'T-Posts',
  'TREE REPLACEMENT',
  'Tailgate Delivery [WILL ONLY DROP ITEMS OFF ON THE SIDE OF CURB, OR ON THE DRIVEWAY]',
  'Tree Bubbler',
  'Tree Replacement',
  'Tree Staking Kit',
  'Tree Tarp',
  'Tree Trimming by Quote',
  'Tree installation without warranty [Customer has opted out of the warranty — tree(s) will not be insured or covered if anything were to happen to it/them]',
  'Tree removal and disposal',
  'Tree removal and replant',
  'Trip Charge',
  'Trunk Protection',
  'Water Hose Bubbler',
  'plastic by the piece');

DO $$
DECLARE n int; l int; o int;
BEGIN
  SELECT count(*) INTO n FROM scope;
  SELECT count(*) INTO l FROM business_inventory_ledger WHERE inventory_id IN (SELECT id FROM scope);
  SELECT count(*) INTO o FROM order_items WHERE business_inventory_id IN (SELECT id FROM scope);
  IF n <> 92 OR l <> 0 OR o <> 0 THEN
    RAISE EXCEPTION 'preflight changed: rows=% ledger=% order_items=% — expected 92/0/0', n, l, o;
  END IF;
END $$;

UPDATE business_inventory SET qty = 0 WHERE id IN (SELECT id FROM scope);
-- expect: UPDATE 92

SELECT qty, status, count(*) FROM business_inventory
WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND retired_at IS NULL
GROUP BY 1, 2 ORDER BY 1;
-- expect: 0/available 92 · 8/available 1 · 10/available 554

COMMIT;
```

⚠️ The scope is a **hand-written name list** because there is nothing else to scope on. That is the finding restated, not a workaround to keep.

## 6. NEED / WANT — options (three-lens, §9 item 10)

- **NEED (cheapest):** one nullable column on `business_inventory` saying what a row IS, read by the three consumers that currently guess — the uppot plan (`classifyLot`), the load list (`resolveLoadItem`) and the opening-stock seed. A null must render as *"not stated"*, never be defaulted to plant (A9).
- **MIDDLE:** fold it into [[R-118]]'s `item_type` — but `purchased · grown · manufactured` is ORIGIN, and plant-vs-material is a different axis: a purchased tree is a plant, a manufactured bubbler is not. **One column cannot carry both without losing one.**
- **WANT:** a kind the import proposes and the owner confirms, carrying fees/services OUT of `business_inventory` altogether (they are `service_offerings`-shaped, and tech-debt #139 / [[R-144]] already record that fee lines are listed, not classified).

**None taken.** The axis, the vocabulary and whether fees belong in this table at all are David's.
