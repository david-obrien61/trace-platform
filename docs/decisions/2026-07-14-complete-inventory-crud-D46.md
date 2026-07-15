# D-46 (proposed) — Complete inventory CRUD: ONE editor, from-the-row add-size, reference-aware delete

**Date:** 2026-07-14
**Status:** proposed (confirm the DECISIONS.md head, then assign D-46)
**Bar:** BUILDER-COMPLETE — `npm run verify` exit 0 zero net-new; `build:cultivar` clean (2349 modules). Owner-proof owed. NO migration, ZERO new api-fn (12/12).
**Ledger:** row #126

---

## Context — why

The entry-completeness recon found inventory CRUD at ~65%: **Create** worked three ways
(Add Item form / D-45 scan-promote / discovery CSV), **Update** was partial (no clean per-size
qty/price edit surface, no "add another size" affordance), **Delete** was essentially **missing**.
This is the platform-wide pattern the STD-018 proposal names: Create+Read got built everywhere,
Update+Delete were consistently skipped and rediscovered at use. This build closes inventory CRUD
**completely** — Create, Read, Update, Delete — not piecemeal.

The triggering scar: David has a "Shoal Creek Vitex" row with `variant_group = NULL`. He wanted to
add a 45-gal size and have both sizes become selectable at checkout — but there was no add-size
affordance, and even manual entry of a second row would have left the two rows in different (or no)
groups, so the size-picker (`detectSizeCollision`) never fired.

## Decision

### 1. ONE inventory editor (STD-011, mirroring the #119 CustomerPartyEditor)
A single grouped `InventoryEditor` with `mode: 'create' | 'edit'`. Sections: Identity (name, sku) ·
Size & grouping (size, variant_group) · Pricing (sell_price, unit_cost) · Stock (qty, reorder_point,
status) · Notes (location, notes). The **only** differences between create and edit are (a) title,
(b) empty-vs-populated initial values, (c) insert-vs-per-field-save. The old flat Add-Item sheet on
`BusinessInventory.tsx` is **retired** — there is ONE inventory form after this. Required on create:
name, and sell_price > 0 (D-35 — nothing born unsellable).

### 2. Add-size is FROM-THE-ROW (the Update gap)
A "+ Add size" action on an existing row opens the SAME editor in create mode, **seeded** with that
row's name (inherited, read-only) and its `variant_group`. The owner enters size + sell_price
(+ optional cost/qty). **Critical:** if the parent's `variant_group` is NULL, the action derives a
group slug from the parent's name (`variantGroupSlug`) and **backfills the parent to that group on
save**, so parent and new sibling share ONE group. Result: two rows, same name, same variant_group,
distinct sizes → the size-picker fires **by construction** (never half-grouped, never orphaned).

### 3. Update — the full owner-editable set
Per-row "Edit" opens the editor for name / sku / size / variant_group / sell_price / unit_cost / qty /
reorder_point / status / notes. The datasheet keeps its fast inline cell edits (the grid IS the read
surface). **Renaming is group-aware** (`renameVariety`): renaming a variety that has size-siblings
(shared non-null variant_group) renames the WHOLE group, so the name-equality the size-picker requires
(`resolveStockLine` L4) survives. An ungrouped row renames alone. (Chosen behavior: rename-the-group,
not block/warn — it keeps the sizes linked with no owner friction.)

### 4. Delete — reference-aware policy (the missing operation)
Per-row delete, confirm-first. The policy is decided by REFERENCE, because both FKs
(`order_items.business_inventory_id`, `cultivar_plants.inventory_id`) are `ON DELETE SET NULL`:
- **Referenced** by an order line or a specimen → **SOFT** delete (`status = 'archived'`), so order
  history / provenance survive (a hard delete would silently null the anchor on historical orders).
- **Never referenced** → **HARD** delete (safe — nothing points at it).
`status` is plain `text` with no CHECK, so `'archived'` is an AC-1 string value needing **no migration**.
Deleting the last size of a variety is allowed; deleting one of several leaves the group with its
remaining siblings. `[TRACE:INVENTORY]` logs the mode + reference counts.

### 5. Read — the grid shows the grouping
The datasheet surfaces size + variant_group + qty + sell_price (+ reorder point) so the grid and the
order picker agree on the grouping (STD-017 all-surfaces — both read `business_inventory`).

## Coexistence with D-45 (shared slug — STD-011)
D-45's scan-count promote and this manual CRUD both write `business_inventory.variant_group` with the
**same** slug convention: the local `slugify` in `InventoryCount.tsx` was extracted to
`packages/shared/src/inventory/variantGroup.ts` (`variantGroupSlug`) and both paths now derive the
group key from the variety name through that ONE function. So a scan-promoted row and a hand-added
size of the same variety land in the SAME group. `variantGroupSlug("Shoal Creek Vitex")` ===
`"shoal-creek-vitex"` === the QR product-slug, so the two paths converge by construction.

## Constraints held
STD-011 (ONE editor create|edit, ONE slug convention, ONE write helper `inventoryEdit.ts`) ·
STD-017 (grid AND picker agree — both read `business_inventory`) · STD-013 (delete confirm + actor
trace) · AC-1 (size/variant_group/status are DATA, no vertical nouns; shared resolver stays agnostic) ·
AC-3 (business_id-scoped) · D-9 (never fabricate a price/size; unset renders blank/flagged) ·
`reorder_point` written deploy-window-safe (its D-42 migration is gated). NO migration; NO new api-fn.

## Files
- **NEW** `packages/shared/src/inventory/variantGroup.ts` (`variantGroupSlug`) + barrel export.
- **NEW** `packages/cultivar-os/src/components/inventory/inventoryEdit.ts` (insert / patch / group-aware
  rename / reference-aware delete; deploy-window-safe for reorder_point).
- **NEW** `packages/cultivar-os/src/components/inventory/InventoryEditor.tsx` (the ONE editor).
- **EDIT** `packages/cultivar-os/src/pages/BusinessInventory.tsx` (retire flat form; wire editor
  create/edit/add-size; row actions Edit / +Add size / Delete; group-aware inline rename;
  reorder_point column; 'archived' status; deploy-safe FULL→CORE load).
- **EDIT** `packages/cultivar-os/src/pages/InventoryCount.tsx` (use the shared `variantGroupSlug`).

## Owner-prove owed (David, live under RLS)
1. "+ Add size" on the existing Shoal Creek Vitex row → editor opens with name + variant_group
   inherited → enter "45 gal" + price → saves a SECOND Vitex row, same group, and the parent's null
   variant_group is now set too.
2. Add an order → BOTH Vitex sizes appear as pickable options at their prices (picker fires).
3. The inventory grid shows both sizes under the variety with their group.
4. Create a brand-new item via the editor (create mode) → same form, empty → saves.
5. Edit any row's price/qty/size via the editor → persists, grid + picker reflect it.
6. Delete a size never sold → removed. Delete a size WITH order history → archived, history intact,
   no FK breakage.
7. Add + Edit are visibly the SAME form (only title + empty/filled differ).
8. Scan the Vitex QR (D-45 path) → the promote lands in the SAME variant_group the manual add-size used.

## Flagged follow-ups (named, not built)
- An `'archived'` row still RESOLVES in the order picker (`resolveStockLine` does not filter status).
  The owner-prove does not require archived-to-vanish; making archived non-sellable is a shared-module
  change touching both the count and purchase paths and is deferred (surface-honesty: stated, not
  silently assumed).
- The editor covers the gate's named field set; `serial_number` / `received_at` / `description` remain
  inline-only on the grid (deliberate — not in the editor's scope).

---

## FOLLOW-ON — 2026-07-15 (owner-prove defects, ledger #127; implements D-46 + STD-011, NO new decision)

David owner-proved D-46 live (`1530f31`). The add-size + variant_group inheritance + group-aware
rename all WORK (verified: two 'Sierra' Mexican Red Oak rows share `variant_group` `sierra-mexican-red-oak`).
Live testing surfaced three follow-on defects, fixed in one pass:

### Defect 1 — SKU edit did not persist (capture-persist break, STD-017 corollary)
`InventoryEditor`'s generic `textInput` fields (`sku`/`size`/`variant_group`/`location`) and the notes
textarea were CONTROLLED in **both** modes — `value` + an `onChange` that wrote every keystroke into
`draft`. In EDIT mode the field also had `onBlur → saveText`, and `saveText` guards with
`if (value === (draft[field] ?? null)) return;`. Because `onChange` had already written the typed value
into `draft`, by blur time `draft.sku` equalled the typed value → the guard short-circuited → **nothing
was ever written to `business_inventory.sku`**. The name/price/qty fields never had the bug because they
are uncontrolled in edit mode (`defaultValue`, no `onChange`).
**Fix:** make edit-mode inputs UNCONTROLLED (`defaultValue` + `onBlur`, no `onChange`) — create-mode
stays controlled so the buffered insert sees every keystroke. `[TRACE:INVENTORY] patch` now shows the
`sku` write. This latently affected size/variant_group/location/notes edits too — all fixed by the same
change.

### Defect 2 — "+ Add size" lost SKU lineage → now pre-fills base + size suffix
Add-size inherited name + variant_group but left the sibling's SKU blank. NEW shared helpers homed next
to `variantGroupSlug` (STD-011 — one convention for the manual add-size path and any future scan/import):
- `skuSizeSuffix(size)` — compact suffix (`"45 gal"→45G`, `"7 gal"→07G` matching FIXTURE-PS-07G, `"4\""→4IN`,
  `"quart"→QT`, `"flat"→FLAT`).
- `deriveSiblingSku(parentSku, size)` — `parentSku + '-' + suffix` (DISC-1001 + "45 gal" → **DISC-1001-45G**),
  matching the WooCommerce parent-SKU + per-variation-SKU convention LAWNS runs. Returns **null** when the
  parent has no SKU (D-9 — never fabricate a base) or the size is blank; idempotent.
The add-size SKU field auto-derives from the size until the owner hand-edits it (`skuTouched`), is fully
editable, and **the parent's existing SKU is left UNCHANGED** (it may already be referenced in QBO). A
`existingSkus` uniqueness guard blocks a create/edit whose SKU collides with another row — never a silent
duplicate (a SKU identifies one sellable unit).

### Defect 3 — row actions were far-right; now engine-level LEFT-PINNED
The shared `<DataSheet>` gained a `rowActions` prop that renders Edit / + Add size / Delete in a
LEFT-PINNED column reserved immediately after the frozen identifier run (its own reserved track, shares
the freeze-edge affordance) — so actions stay reachable regardless of horizontal scroll. Fixed in the
ENGINE (STD-011), so inventory AND customers moved onto it; assets (no row actions) is unaffected.

**Verification:** `npm run verify` exit 0 zero net-new (eslint 249→**248**, baseline re-locked);
`build:cultivar` clean; `skuSizeSuffix`/`deriveSiblingSku` unit-checked (11 cases green, incl. the
DISC-1001-45G owner-prove case). NO migration, ZERO new api-fn (12/12). `[TRACE:INVENTORY]` +
`[TRACE:datasheet]` ON.
