# QR Lifecycle-History + Stock-Line Purchase — Read-Only Recon

**Date:** 2026-07-07
**Type:** READ-ONLY recon. Nothing changed. Measures the code against the SETTLED June 5 / June 13 design — does NOT re-litigate it.
**Author:** Thunder (Claude Code)
**For:** Lightning

---

## The yardstick (settled June 5 + June 13 — not re-decided here)

- Three layers: **ITEM** (variety, category tag) → **SIZE CLASS** (grower's per-category size list) → **STOCK LINE** (item+size+price+qty+cost+current stage).
- Lifecycle **STAGES** are configurable per category; stage progression is a **TRACKED, DATED EVENT** (with cost + value change), NOT a static field. For LAWNS the stages ARE the size classes (acorn→seedling→1gal→3gal→5gal→15gal→30gal→45gal); a tree advancing sizes is a dated event.
- History attaches to the **VARIETY/LOT, NOT the individual organism.** June 13: *"LAWNS tracks lot-level history, not individual organisms; the lot is the SKU."*
- QR references a **TYPE (variety), then size is added** — NOT unique-per-pot identity (that idea was explicitly abandoned as infeasible).
- Display: a **vertical timeline** on the variety/plant profile — each stage dated with cost-in, showing **accumulated cost basis vs sale price** (the "margin story Excel can't tell").
- **OPTIONAL by design:** capability exists for all; data accumulates only for growers who log progressions.

---

## VERDICT

**The code is DRIFTED from the design.** The June 13 untangle *started* the correction (moved stock to `business_inventory`) but stopped halfway — **purchase-resolution and lifecycle-history are still anchored to per-specimen `cultivar_plants`**, the model the design abandoned. One root cause feeds every symptom below.

---

## R1 — Is the lifecycle-history capability built?

**Partially — right mechanism, wrong anchor, no cost dimension.**

**BUILT:**
- **`plant_events` table exists.** Columns: `id`, `plant_id` (FK→`cultivar_plants`), `business_id`, `event_type` (10-value enum incl. `repotted` = "Moved up a container"), `from_container`, `to_container`, `notes`, `employee_id`, `occurred_at`. RLS owner-only + `anon_select_plant_events` for QR read (`supabase/migrations/20260528_per_tenant_rls_isolation.sql:51`; business_id added `supabase/migrations/20260529_businesses_c_add_business_id.sql:36`).
- **Timeline view exists.** `packages/cultivar-os/src/components/plant/PlantTimeline.tsx` renders the vertical dated event log with container transitions (`1 gallon → 3 gallon`, line 82), fed by `usePlant` (`packages/cultivar-os/src/hooks/usePlant.ts:78`), mounted on `packages/cultivar-os/src/pages/PlantProfile.tsx:56`.

**Where it MISSES the design (two gaps):**
1. **Anchored per-specimen, not per-lot.** Events key on `plant_id` (a `cultivar_plants` row); the header literally reads *"This plant's journey"* (`PlantTimeline.tsx:40`). Design = **"the lot is the SKU; lot-level history."** History hangs on the wrong object.
2. **No cost dimension — the "margin story" is absent.** `plant_events` carries `from_container`/`to_container`/`notes`/`occurred_at` but **no cost-in, value-change, or qty-at-stage field.** The design's whole payoff — *accumulated cost basis vs sale price* — cannot be rendered; the schema doesn't hold the numbers.

**Data on tenant f7ec5d67:** Not live-queryable without keys, but structurally: `plant_events` only populates for minted `cultivar_plants` rows (the handful of demo `SCV-*` plants). The real 114-row catalog on `f7ec5d67` was populated via `discovery/populate` → **`business_inventory` only, zero `cultivar_plants`** (per the 2026-06-21 WAVE 2 handoff). So the timeline is **empty for the entire real catalog** — same root cause as R2.

---

## R2 — How does QR-purchase resolve today?

**Off `cultivar_plants` (per-specimen). This is drift, not a decision.**

- **`usePlant`** queries `cultivar_plants` only: `.from('cultivar_plants').select('*, business_inventory(...)').ilike('tag_id', tagId).single()` → returns **"Plant not found"** if no row (`usePlant.ts:64-75`; error state `PlantProfile.tsx:28`). No fallback.
- **The whole checkout is anchored on `cultivar_plants`:** server price fetch joins `cultivar_plants → business_inventory` (`packages/cultivar-os/api/orders/submit.ts:87-92`); `order_items.plant_id` = `plant.id` (FK→`cultivar_plants`, `submit.ts:153`); leakage flag reads `plant.current_container` (`submit.ts:114`). Only the stock decrement was moved — `submit.ts:227`: *"Stock state lives on business_inventory, not cultivar_plants (identity-only after untangle)."*
- **Count resolves differently** — off the stock line, `cultivar_plants` optional: L1 `tag_id` → L2 `sku` → L4 name-token → L5 size-picker, all on `business_inventory` (`packages/cultivar-os/src/pages/InventoryCount.tsx:209-330`).

**Deliberate or drift? Drift — a pre-decision artifact.** `PlantProfile`/`usePlant` were built May 18, *before* both the June 13 lot-level decision and `supabase/migrations/20260613_cultivar_plants_untangle.sql` (which declared `cultivar_plants` "identity-only"). The untangle half-finished: it moved *stock* to `business_inventory` but left *identity + price + purchase* routing through `cultivar_plants`.

---

## R3 — Can purchase resolve off the stock line?

**Yes — matches the design and David's instinct.** Nothing in the sell-from-lot case genuinely needs a per-specimen row: qty, price, size, and status all live on `business_inventory`; history *should* be lot-level. `cultivar_plants` only earns its keep for true per-organism tagging — the idea the design abandoned. Three touch-points:

1. **`usePlant`** — add the count ladder as a fallback: `cultivar_plants` miss → resolve `business_inventory` by sku/tag/name (+ size-picker), synthesize a plant-shaped object (name, size, `unit_cost`, `qty`, `status`). **This is a semantic-dup of `InventoryCount`'s resolver → extract ONE shared resolver** (CLAUDE.md §6 rule 8).
2. **`submit.ts`** — fetch price off `business_inventory` directly (already reads `unit_cost` through the join); take size/container from `business_inventory.size` not `plant.current_container` (leakage flag).
3. **`order_items` schema (the sticky bit).** `order_items.plant_id` is an FK → `cultivar_plants` (`20260613_cultivar_plants_untangle.sql:111`), and the table is **live-only, not in version control** (tech-debt #39). Two options:
   - **(a) design-aligned:** add nullable `order_items.business_inventory_id`, make `plant_id` nullable → an order line references the stock line. **Migration; David applies.**
   - **(b) cheap/expedient:** mint a `cultivar_plants` identity row on-demand at purchase → keeps the FK, no schema change, but re-introduces the per-specimen rows the design abandoned.

---

## R4 — Reconcile + fix shape

**Drifted.** Design = lot-level, variety+size, stock-line purchase, cost-basis timeline. Code = per-specimen `cultivar_plants` purchase + per-specimen (`plant_id`) history with no cost fields. Every symptom shares **one root: the model is anchored on `cultivar_plants` where the design says `business_inventory` stock line.** The June 13 untangle began the swap and stopped at stock.

**Fix options (scoped, not decided):**

- **(a) Purchase-off-stock-line** — `usePlant` fallback ladder + `submit.ts` price off `business_inventory` + `order_items` schema (option 3a or 3b). Unblocks selling the **real 114-row catalog** (today it returns "Plant not found"). Migration: yes (`order_items`). No new function.
- **(b) Lifecycle-history to lot-level + cost basis** — re-anchor events to the `business_inventory` stock line (variety+size lot) instead of `plant_id`; add `cost_in` / `value` / `qty_at_stage` columns so the timeline shows accumulated cost basis vs sale price. Re-point `PlantTimeline` to read lot events — the timeline UI is ~80% reusable. Migration: yes.
- **(c) How they relate** — same anchor-swap (`cultivar_plants` → stock line). Do (a) and (b) off **one re-anchor**: (a) makes the real catalog sellable, (b) turns the empty timeline into the margin story.

**Flags:**
- **Migrations (David applies):** both fixes need one — (a) `order_items`, (b) events re-anchor + cost columns. `order_items` is live-only (tech-debt #39), so its migration must be authored from the live schema first.
- **Function ceiling (12/12):** **no pressure** — both fixes edit existing surfaces (`usePlant` is client, `submit.ts` exists, events read is client). No new `api/` file.

---

## Evidence index (file:line)

| Claim | Location |
|---|---|
| `plant_events` table + RLS | `supabase/migrations/20260528_per_tenant_rls_isolation.sql:51`; `20260529_businesses_c_add_business_id.sql:36` |
| Timeline view (per-specimen framing) | `packages/cultivar-os/src/components/plant/PlantTimeline.tsx:40,82` |
| Timeline fetch (keyed on `plant_id`) | `packages/cultivar-os/src/hooks/usePlant.ts:78-82` |
| Purchase resolves `cultivar_plants` only, `.single()` | `packages/cultivar-os/src/hooks/usePlant.ts:64-75` |
| "Plant not found" — no fallback | `packages/cultivar-os/src/pages/PlantProfile.tsx:28-40` |
| Checkout price via `cultivar_plants→business_inventory` | `packages/cultivar-os/api/orders/submit.ts:87-92` |
| `order_items.plant_id` = `plant.id` (FK→cultivar_plants) | `packages/cultivar-os/api/orders/submit.ts:153` |
| Untangle: "identity-only after untangle" | `packages/cultivar-os/api/orders/submit.ts:227` |
| `order_items.plant_id` FK auto-followed rename | `supabase/migrations/20260613_cultivar_plants_untangle.sql:111` |
| Count resolves off `business_inventory` ladder | `packages/cultivar-os/src/pages/InventoryCount.tsx:209-330` |

*Read-only recon. Measured against the design; did not re-decide it.*
