# Lot-Population Preconditions — RECON ARTIFACT

> **Type:** Read-only recon. This LOOK *sizes* the first Cost-to-Produce build
> (lot population + first MarginEngine caller); it does NOT design or start it.
> Created 2026-06-13 (THUNDER RECORD session). Evidence is file:line.
> Context: `cultivar_plants` is live + catalog-VERIFIED (untangle C1–C5 + cleanup
> V1–V3 all PASS — see `docs/verification/20260613_cultivar_plants_verification.md`).
> All existing `cultivar_plants` rows have `inventory_id = NULL` → QR checkout shows
> "unavailable" until lots are populated and linked.

---

## Unknown 1 — LOT DATA SOURCE: wiring job or UI-build?

**Verdict: FOUND — lot *row creation* already exists (WIRING). The only net-new piece is the LINK.**

- **A `/inventory` form already INSERTs `business_inventory` rows.**
  `packages/cultivar-os/src/pages/BusinessInventory.tsx:168` —
  `await supabase.from('business_inventory').insert(payload)`.
  The form (`handleSubmit`, lines 137–184) captures: `business_id` (from
  `useBusinessContext()`), `name`, `qty`, `status`, `cost_confidence`, and optional
  `sku`, `location`, `serial_number`, `notes`, `received_at`, `unit_cost`.
  `receipt_id` is intentionally absent (`BusinessInventory.tsx:155` — "linked by
  receipt flow later"). List view + load at `BusinessInventory.tsx:119–131`.
  This page is WIRED in PLATFORM_STATE (`business_inventory table` row).

- **Other live readers of `business_inventory`** (confirms the table is in use, not dead):
  `api/dashboard.ts:22`, `src/pages/Dashboard.tsx:137` (inventory value/count tile),
  `api/orders/submit.ts:245` (reserve-on-order UPDATE).

- **The gap — nothing sets `cultivar_plants.inventory_id`.** No INSERT/UPDATE anywhere
  writes the FK that links an identity row (a tag) to its lot row. The `/inventory`
  form creates the lot; there is no surface that says "tag SCV-0031 belongs to lot X".

- **Row count:** NOT reachable from here (no live DB query in this read-only LOOK).
  Believed empty/sparse for LAWNS per the untangle handoff (inventory_id NULL on all
  rows). David can confirm in the SQL editor if needed.

**→ Sizing:** Lot population is **mostly WIRING** (the row-creation UI exists). The single
net-new build artifact is the **link step** — a small UI or batch action that sets
`cultivar_plants.inventory_id` per tag (e.g. a picker on the plant/inventory page, or a
seed/UPDATE for LAWNS SKUs). No new table, no new ingest flow required.

---

## Unknown 2 — CARDINALITY: does the FK support the settled mapping?

**Verdict: FOUND — yes, cleanly. Many identity rows → one qty-of-SKU lot (many-to-one).**

- **FK direction:** `cultivar_plants.inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL`
  — `supabase/migrations/20260613_cultivar_plants_untangle.sql:55` (nullable;
  catalog-confirmed C4/C5).

- **Lot grain:** `business_inventory` carries `qty int NOT NULL DEFAULT 0` and
  `unit_cost numeric(10,2)` — `supabase/migrations/20260612_business_assets_inventory_pmi_service.sql:103–104`.
  One row = a qty-of-SKU lot.

- **Cardinality:** `inventory_id` is a single FK column on `cultivar_plants`, so MANY
  `cultivar_plants` rows (one per physical tag) can point at ONE `business_inventory`
  row (the lot). This is the settled model: lot = qty-of-SKU inventory row;
  `cultivar_plants` = per-tag identity for plants drawn from that lot.

- **`ON DELETE SET NULL`** means deleting a lot orphans the identity rows safely
  (inventory_id → NULL, plant shows "unavailable") rather than cascading away the tags.
  Correct behavior for this seam.

**→ Sizing:** The FK as built **supports lot population cleanly** — it does not fight the
mapping. No schema change needed; population is purely data + the link step from Unknown 1.

---

## Unknown 3 — MARGINENGINE CONFIG: existing or net-new for a Cultivar caller?

**Verdict: PARTIAL — cost input is solved; the config object `{slabs[], pricingTiers[], overheadPerUnit}` is NET-NEW for Cultivar.**

- **Cost input — SOLVED.** `business_inventory.unit_cost` is the per-unit cost the engine
  needs (`BusinessInventory.tsx:124` reads it; base migration line 104 defines it).

- **Engine signature.** Shared `packages/shared/src/business-logic/MarginEngine.ts`:
  `calculateRetail(vendorCost, config: MarginEngineConfig = DEFAULT_MARGIN_CONFIG, tierName?)`
  (line 120–122). `MarginEngineConfig = { slabs[], pricingTiers[], overheadPerUnit }`
  (lines 36–44). A default config exists — `DEFAULT_MARGIN_CONFIG` (lines 68–82) — but it
  is explicitly the **Ignition OS baseline** ("Preserves exact Ignition behavior", line 65):
  4 slabs (Consumables/Mid-Range/Heavy/Major) + tiers STANDARD/FLEET/LEGACY/FF.
  Those tier names and markup slabs are Ignition's, not a nursery's.

- **Ignition reference pattern — where callers get config.** Ignition callers invoke
  `MarginEngine.calculateRetail(cost)` with NO config arg
  (`PriceField.jsx:34`, `IgnitionProcure.jsx:62`, `IgnitionPort.jsx:37/53/376`,
  `OnboardingWizard.jsx:368`). The JS engine fills config from **DataBridge localStorage**:
  `MarginEngine.getConfig()` → `DataBridge.load('margin_config')` falling back to
  `DEFAULT_MARGIN_CONFIG` (`packages/ignition-os/MarginEngine.js:42–45`). The upstream
  writer is `IgnitionProt.handleSave` → DataBridge `margin_config`/`overhead_config`
  (`IgnitionProt.jsx:92`). So Ignition's config source = client-side localStorage, per-device.

- **Cultivar has NO equivalent config source.** Grep for `business_modules` + `config` in
  Cultivar src/api returned ZERO hits — `business_modules.config` is not used to carry
  pricing config. There is no Cultivar table, constants file, or DataBridge analog feeding
  `{slabs, pricingTiers, overheadPerUnit}`. The shared engine's `DEFAULT_MARGIN_CONFIG` is
  Ignition-flavored, so a Cultivar caller relying on the default would inherit auto-shop
  slabs/tiers — wrong for a nursery.

**→ Sizing:** The first Cultivar MarginEngine caller needs a **net-new config source**.
Options (decision deferred to build): (a) a Cultivar constants file passing an explicit
`MarginEngineConfig`; (b) a row in an existing config table; (c) `business_modules.config`
JSON (currently unused for this). Cost flows in from `business_inventory.unit_cost`; only
the config object is the gap.

---

## BOTTOM LINE

1. **Wiring or UI-build?** → **WIRING**, mostly. Lot rows are already created by the live
   `/inventory` form (`BusinessInventory.tsx:168`). The single net-new piece is a small
   **link step** that sets `cultivar_plants.inventory_id` per tag.
2. **Does the FK support it?** → **YES, cleanly.** `inventory_id → business_inventory(id)
   ON DELETE SET NULL`; many tags → one qty-of-SKU lot (many-to-one). No schema change.
3. **Config existing or net-new?** → **NET-NEW for Cultivar.** Cost input is solved
   (`business_inventory.unit_cost`); the `{slabs[], pricingTiers[], overheadPerUnit}` config
   object has no Cultivar source (Ignition's lives in DataBridge localStorage;
   `business_modules.config` is unused). Pick a config source at build time.
