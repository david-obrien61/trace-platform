# RECON: size-variant build state (ledger #62) — execution vs. stale data

**Date:** 2026-07-07 · **Author:** Thunder · **Type:** READ-ONLY recon (verify execution state). **Changed NOTHING.** The size-variant *design* is settled (docs/decisions/2026-06-27-discovery-size-variants.md) and is **not** re-litigated here — this verifies whether the settled build was executed, and why David's live data lacks sizes/prices/plants.

**Method:** read the migration + code + decision doc; git-timed the build commit; and probed the LIVE DB (project `bgobkjcopcxusjsetfob`, service key, read-only SELECT only). Temp probe scripts removed after use.

---

## VERDICT (up front)

Ledger **#62 was fully built AND its migration is applied.** David's data is thin because it is **STALE** — the demo tenant was catalog-populated **two days before** the size build shipped, by the pre-#62 (parent-only) populate. Nothing is broken or unbuilt. The fix is a **data re-populate**, not a build.

| Symptom (David's live data) | Cause | Fix |
|---|---|---|
| Vitex rows have **no size** | Rows written 2026‑06‑26 by pre‑#62 populate (parent‑only); build landed 2026‑06‑28 → **STALE** | Re-run populate (idempotent clear→rewrite) |
| **unit_cost NULL** | **BY DESIGN** — site has no prices; populate writes `null`/`UNKNOWN` (D‑9 honesty). Prices are never scraped. | Manual price entry, or a new pricing-capture build |
| **0 cultivar_plants** | **BY DESIGN** — populate deliberately never mints per-specimen QR identities | Separate (unbuilt) plant-minting step |

---

## R1 — Was the migration applied? ✅ YES (columns live)

- Migration [`20260628_inventory_size_variants.sql`](../../supabase/migrations/20260628_inventory_size_variants.sql) adds `size text` + `variant_group text` (both nullable, **no CHECK** — AC‑1) + index `business_inventory_variant_group_idx`.
- **Live probe (read-only):** `SELECT id, size, variant_group FROM business_inventory` **succeeds** → columns EXIST. `scripts/seed-size-variants.mjs`'s own header confirms: *"cols from migration 20260628 must be applied — **they are.**"*
- David's Vitex rows are **exist-but-null** (parent rows never expanded) — NOT missing columns.
- **Platform-wide: 0 rows carry a non-null `size`; 0 carry a `variant_group`.** The feature has never written real data on any tenant.

## R2 — Adapter + extractor built? ✅ YES — #62 fully executed

Entire build shipped in **one commit `9f1063e`** ("feat(discovery): capture WooCommerce size variants into the catalog (B-clean, ledger #62)"), **2026‑06‑28 13:05 CDT**.

- **`extractSizeVariants(rawHtml)` — EXISTS**, [`catalog.ts:436`](../../packages/shared/src/discovery/catalog.ts#L436). Deterministic, no AI: `data-product_variations` JSON primary → `<select>` option-label fallback → normalize + dedup, order preserved.
- **Adapter now RETAINS raw HTML** (the pre-#62 pipe discarded it): `fetchProductVariants` [`catalog.ts:513`](../../packages/shared/src/discovery/catalog.ts#L513) does a bounded 2nd-pass crawl that descends to `/product/<slug>` pages and reads raw HTML. Kept INDEPENDENT of the proven variety-extraction path (`fetchCatalogPages`), which is untouched.
- **`populate.ts` writes per-size rows**: [`populate.ts:196-234`](../../packages/shared/src/discovery/populate.ts#L196) matches variants→varieties by name key and emits **one `business_inventory` row per (variety × size)**; `catalogItemToInventoryRow` [`:97`](../../packages/shared/src/discovery/populate.ts#L97) carries `size` + `variant_group`. Deploy-window fallback [`:254`](../../packages/shared/src/discovery/populate.ts#L254) collapses to parent rows if the columns are absent.
- **Proof artifact**: [`scripts/prove-vitex-variants.ts`](../../scripts/prove-vitex-variants.ts) — 10 assertions against the real LAWNS Shoal Creek Vitex page (offline fixture) → exactly `['5 Gallon','15 Gallon','30 Gallon','45 Gallon']`, 4 rows, `variant_group = shoal-creek-vitex`, each `qty 0 / unit_cost null / UNKNOWN`.
- Also present: `normalizeSize`, `productSlugFromUrl`, `findDuplicateSizeGroups`/`dupSize.ts` (ledger #73 CASE‑5 dup-size data-quality surfacing), and the count-side `detectSizeCollision` size-picker ([`InventoryCount.tsx`](../../packages/cultivar-os/src/pages/InventoryCount.tsx), ledger #72, OWNER-PROVEN).

**Verdict: BUILT (fully) — not partial, not never-built.**

## R3 — Why David's data is thin → STALE (all three symptoms explained)

Tenant `f7ec5d67-a9ef-4cb0-b807-438d67687d1b` ("Test Dave's Tree Nest"): **111 parent-only `DISC-` inventory rows**, every one `size null` / `variant_group null` / `unit_cost null` / `cost_confidence UNKNOWN`; **0 `cultivar_plants`**.

- **Smoking gun — the discovery profile.** `business_discovery_profiles` for this tenant: `source_url = https://lawnstrees.com/`, `status = populated`, **`extracted_at = 2026-06-26T17:32:18Z`**, and `raw_extract.counts = {deduped:111, flagged:0, inserted:111, pagesFetched:30, rawItemCount:138, highConfidence:111}` — **none** of the size keys (`sizeRows`, `varietiesWithSizes`, `dupSizeGroups`) that the #62 populate always emits. → written by the **pre-#62 populate**, **~2 days before** the build (2026‑06‑28). **STALE, not never-built.**
- **unit_cost NULL is BY DESIGN.** The catalog prompt is explicitly told *"Never report a price"* ([`catalog.ts:208`](../../packages/shared/src/discovery/catalog.ts#L208)); populate always writes `unit_cost = null, cost_confidence = 'UNKNOWN'` ([`populate.ts:120`](../../packages/shared/src/discovery/populate.ts#L120)) — the D‑9 "price UNKNOWN, never 0" contract. **Prices are never scraped**; pricing is a separate manual/owner step (as services were). Re-populate will NOT add prices.
- **cultivar_plants empty is BY DESIGN.** populate **deliberately never** mints plants ([`populate.ts:30-33`](../../packages/shared/src/discovery/populate.ts#L30)) — per-specimen QR identities can't be scraped; writing them would be fabrication. The `cultivar_plants.inventory_id` FK **column exists** (probe SELECTable) but the table is **empty for this tenant**.

## R4 — Shortest path to sized + priced + scannable demo data

**The size gate is CLEARED.** The #70/#72 landmine ("don't populate per-size rows until the count-side size-picker is owner-proven, else multi-size scans regress to UNKNOWN") no longer applies — the picker is **OWNER-PROVEN** (ledger #72, `7b36cfc`). Per-size population is unblocked. Three independent pieces, in order:

1. **SIZED — re-run populate for this tenant (fixes R3 entirely; no code/schema).**
   Run [`scripts/populate-catalog.ts`](../../scripts/populate-catalog.ts) against `lawnstrees.com` for `ed2e5933-45dc-4b9b-a331-ddfd125e7a74` ⚠️ **(CORRECTED 2026-08-30 — this said `f7ec5d67…`, which is TEST DAVE'S TREE NEST. Running it as written would have populated LAWNS's real website catalogue into the TEST tenant. R-26 instance 12, ledger #235.)** with `ANTHROPIC_API_KEY` + service key (David runs). populate is idempotent: it **clears the 111 stale `DISC-` rows** and rewrites them, expanding variable products to per-size rows (Vitex → 4 rows: 5/15/30/45 gal). *Caveat: the AI variety pass needs the Anthropic key; the deterministic size crawl needs none.*

2. **SCANNABLE — already works for the COUNT demo; plants only needed for the CUSTOMER QR.**
   The walk-and-count scan resolves **directly off `business_inventory`** (L1 `cultivar_plants.tag_id` → **L2 `sku`** → L4 name-token → **L5 size-picker** → UNKNOWN). Once sized rows exist, scanning a multi-size Vitex fires the size-picker with **no `cultivar_plants` required**. Only the customer-facing `/plant/:tagId` profile needs minted plants — a **separate, unbuilt step** (mint `cultivar_plants`, link via `inventory_id`), not part of populate.

3. **PRICED — not achievable by scraping; manual entry or a new build.**
   No code captures prices today (by design). Options: hand-enter `unit_cost` via the inventory datasheet for the demo varieties, **or** scope a new pricing-capture capability. **Decision for David:** does the demo need real prices, or can it honestly show UNKNOWN?

**One line:** the size model is real, live, and proven; the demo tenant just holds a pre-feature snapshot. Re-populate → sized + scannable-for-count; prices and customer-QR plants are separate, deliberately-unbuilt steps.

---

## Evidence index

- Migration: `supabase/migrations/20260628_inventory_size_variants.sql`
- Build commit: `9f1063e` (2026‑06‑28 13:05 CDT), ledger #62
- Code: `packages/shared/src/discovery/catalog.ts` (`extractSizeVariants` :436, `fetchProductVariants` :513), `packages/shared/src/discovery/populate.ts` (per-size expansion :196-234), `packages/shared/src/discovery/dupSize.ts`
- Proof: `scripts/prove-vitex-variants.ts` (10 assertions vs real Vitex page)
- Count-side: `packages/cultivar-os/src/pages/InventoryCount.tsx` (`detectSizeCollision`, size-picker — ledger #72 OWNER-PROVEN)
- Live DB (read-only, 2026‑07‑07): tenant `f7ec5d67-a9ef-4cb0-b807-438d67687d1b` — 111 `DISC-` rows all size/variant_group/unit_cost NULL; 0 rows platform-wide with size; 0 cultivar_plants; discovery profile `extracted_at 2026-06-26` with pre-#62 counts shape.
