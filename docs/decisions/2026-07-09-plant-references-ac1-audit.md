# AC-1 Audit — Every `plant*` Reference, Sorted for Adjudication

**Date:** 2026-07-09 · **Type:** READ-ONLY recon (no code, no migration, no rename this pass)
**Story:** #231 (order display root cause) — the recurring "PLANTS (0)" bug traced to a vertical noun (`plant_id`) sitting on the SHARED order spine.
**Ask:** inventory EVERY `plant*` reference across code + schema, tag each **A / B / C**, so David sorts them onto the bug board and clears bucket-A systematically.

## The AC-1 test used to sort each reference

> **AC-1:** No vertical nouns in shared schema/code. Vertical identity is a *value* (`business_type`), never a table name, column, or identifier.

- **A — GENERIC-MIS-NAMED (true AC-1 violation):** a vertical-neutral thing wearing a `plant` name while living on a **SHARED surface** (`business_/platform_/order_/customer_` table or column, `packages/shared/` code, the shared `api/` backend, a shared RLS policy). These break cross-vertical reuse (parts orders, pantry items). **Fix → make generic.**
- **B — LEGITIMATELY CULTIVAR-SPECIFIC (fine as-is):** genuinely about plants/specimens AND living inside the cultivar vertical's own code (`packages/cultivar-os/`) or on a `cultivar_`-prefixed table. AC-1 only forbids vertical nouns on SHARED surfaces — not inside a vertical's own code. **No action.**
- **C — AMBIGUOUS / DAVID DECIDES:** could go either way — usually a **shared reader reaching into a cultivar concept**, an enum bundling all verticals' nouns, or a naming-consistency lag. Flagged with the tradeoff.

## Scope confirmed by grep

- `packages/ignition-os/` → **0** `plant` references. `coolrunnings`, `kinna` → none. **Every `plant*` leak is confined to `packages/shared/` and `packages/cultivar-os/`** — so AC-1 is not yet leaking into a second vertical's code, but it IS baked into the shared spine those verticals will import.
- **Precedent (already-resolved bucket-A):** `social_drafts.plant_id` was **DROPPED** in [20260608_social_drafts_subject_ref.sql:41-46](../../supabase/migrations/20260608_social_drafts_subject_ref.sql#L41) with the note *"plant_id: AC-1 violation (Cultivar-specific noun)."* This is the exact template for clearing `order_items.plant_id`.

---

## R1 + R2 — THE INVENTORY (every reference, tagged A/B/C)

### GROUP 1 — SHARED SCHEMA (tables / columns / RLS on `order_/business_/service_` surfaces) — the priority zone

| Tag | Reference | What it is | Notes |
|-----|-----------|-----------|-------|
| **A** | `order_items.plant_id` — [20260707_order_items_stock_line_anchor.sql:35](../../supabase/migrations/20260707_order_items_stock_line_anchor.sql#L35), [20260613_cultivar_plants_untangle.sql:20,111](../../supabase/migrations/20260613_cultivar_plants_untangle.sql#L111) | Column (FK→`cultivar_plants`) on the **shared** `order_items` spine table | **THE flagged violation.** A cultivar-specific specimen pointer bolted onto the shared order line. Proven vestigial: every order writes `business_inventory_id` with `plant_id` NULL; a query anchored on `business_inventory_id` resolves every line (name + customer). See R5. |
| **A** | `service_offerings.price_unit` DEFAULT **`'plant'`** + CHECK includes `'plant'` — [20260529_businesses_f_service_offerings.sql:28-30](../../supabase/migrations/20260529_businesses_f_service_offerings.sql#L28) | Column DEFAULT + CHECK constraint on the **shared** `service_offerings` table | A shared table **defaults a new service's unit to the cultivar noun `'plant'`**, and hard-codes `'plant'` as a CHECK member beside `'vehicle'`/`'visit'`. Adding a vertical's unit needs a migration. (Enum-vs-free-text is the C-tagged decision below; the **DEFAULT `'plant'`** is the clear A.) |
| **B** | `cultivar_plants` table + policies `cultivar_plants_owner_select` / `cultivar_plants_owner_all` — [20260613_cultivar_plants_untangle.sql:23-92](../../supabase/migrations/20260613_cultivar_plants_untangle.sql#L23), [20260613_cultivar_plants_policy_cleanup.sql](../../supabase/migrations/20260613_cultivar_plants_policy_cleanup.sql), [20260622_is_active_member_canonical_rls.sql:193-215](../../supabase/migrations/20260622_is_active_member_canonical_rls.sql#L193) | The specimen-identity join table + its RLS | **Correctly prefixed + correctly cultivar-domain** (renamed from `plants`→`cultivar_plants` in 2026-06-13 precisely to mark it vertical-identity-only). Fine. |
| **C** | RLS policy names `anon_select_plants`, `authenticated_select_plants`, `plants_business_owner`, `plants_select_public` — [20260613_cultivar_plants_untangle.sql:28,50](../../supabase/migrations/20260613_cultivar_plants_untangle.sql#L28), [20260528_per_tenant_rls_isolation.sql:37-46](../../supabase/migrations/20260528_per_tenant_rls_isolation.sql#L37), [20260613_cultivar_plants_policy_cleanup.sql:31,65](../../supabase/migrations/20260613_cultivar_plants_policy_cleanup.sql#L31) | Policy identifiers on the (cultivar) `cultivar_plants` table | Policies still carry the bare `plants` name after the table got the `cultivar_` prefix — **naming lag, not a shared-surface leak** (they sit on a cultivar table). Cosmetic; rename on next touch or leave. |
| **B** | `plant_events` table + policies `anon_select_plant_events` / `authenticated_select_plant_events` / `plant_events_business_owner` — [20260528_per_tenant_rls_isolation.sql:51-66](../../supabase/migrations/20260528_per_tenant_rls_isolation.sql#L51), [20260529_businesses_d_update_rls.sql:32-36](../../supabase/migrations/20260529_businesses_d_update_rls.sql#L32) | Cultivar specimen event-log table + RLS | Cultivar-domain specimen journey. Fine **but** flagged **C** for one thing → next row. |
| **C** | `plant_events` / `plant_id` naming vs the `cultivar_plants` prefix | Naming consistency | `cultivar_plants` got the vertical prefix; its sibling `plant_events` and the FK `plant_events.plant_id` did **not**. Not a shared leak (cultivar table), but if the prefix convention is a rule, this is the inconsistency. David: rename to `cultivar_plant_events` or accept the lag. |
| — | `plants`/`plant_events` legacy DDL — [20260529_businesses_c_add_business_id.sql:35-64](../../supabase/migrations/20260529_businesses_c_add_business_id.sql#L35), [20260529_businesses_e_cleanup.sql:9-10](../../supabase/migrations/20260529_businesses_e_cleanup.sql#L9) | Pre-rename migration history | Historical (table has since become `cultivar_plants`). No action — migrations are append-only. |
| — | `social_drafts.plant_id` DROP — [20260608_social_drafts_subject_ref.sql:41-46](../../supabase/migrations/20260608_social_drafts_subject_ref.sql#L41) | **Already-cleared bucket-A** | The precedent. No action; cite it when clearing `order_items.plant_id`. |

### GROUP 2 — SHARED CODE (`packages/shared/`) — cross-vertical surface

| Tag | Reference | What it is | Notes |
|-----|-----------|-----------|-------|
| **A** | `generatePlantQR`, `plantId` param, `/plant/${plantId}` URL — [shared/src/qr/generate.ts:15-34](../../packages/shared/src/qr/generate.ts#L15) | Shared QR generator | A **generic** QR utility (any vertical tags things) named + typed around `plant`. Encodes `/plant/<id>` into the printed code. → generic `generateTagQR`/`tagId`/`/tag/`. **Blast radius: printed QR codes + cultivar route `/plant/:tagId` — see R4.** |
| **A** | `printPlantLabel`, `plantId`, `.plant-id` CSS, `<div class="plant-id">` — [shared/src/qr/print.ts:1-93](../../packages/shared/src/qr/print.ts#L15) | Shared label printer | Same as above — generic label printer wearing `plant`. → `printTagLabel` / `.tag-id`. |
| **A** | `price_unit: 'order' \| 'plant' \| 'vehicle' \| 'visit'` — [shared/src/discovery/types.ts:10](../../packages/shared/src/discovery/types.ts#L10), [shared/src/business-logic/serviceOfferingEnums.ts:54-57](../../packages/shared/src/business-logic/serviceOfferingEnums.ts#L54), [shared/src/discovery/engine.ts:124](../../packages/shared/src/discovery/engine.ts#L124) | Shared enum type + option list | The TS mirror of the shared `price_unit` CHECK. `serviceOfferingEnums.ts` self-describes as "the generic schema enums" yet hardcodes `plant`. Ties to the GROUP-1 `price_unit` decision. |
| **A** | New service defaults `price_unit: 'plant'` — [shared/src/pages/Settings.tsx:231,245,385](../../packages/shared/src/pages/Settings.tsx#L231) | Shared Settings service editor | The **shared** offerings editor seeds every new service's unit to `'plant'` (`useState('plant')`, reset to `'plant'`). Same class as the schema DEFAULT. |
| **C** | `plantCount`/`plantSubtotal`/`plantName` mental model — see GROUP 3 `api/orders/submit.ts` | (backend, listed below) | The shared order writer's internal vocabulary — flagged under GROUP 3. |
| **C** | `populate.ts` deletes `cultivar_plants` directly — [shared/src/discovery/populate.ts:31,71-72](../../packages/shared/src/discovery/populate.ts#L71) | Shared populate engine referencing a cultivar table by name | Non-vertical-namespaced shared code hard-references `cultivar_plants`. Works today (cultivar is the only catalog vertical) but a shared engine naming a cultivar table is the AC-1 smell. David: route through a vertical adapter, or accept until a 2nd catalog vertical exists. |
| **B** | `catalog.ts` — "extract a plant CATALOG", `plants?`/`trees?` URL regexes — [shared/src/discovery/catalog.ts:77,164,206-228,532](../../packages/shared/src/discovery/catalog.ts#L206) | Shared catalog extractor | The engine is generic; `plant`/`tree` appear as **content values** in the extraction prompt + URL-sniffing regexes (matching a nursery site's own words). AC-1 permits vertical identity as a value. Borderline — leans B; the `CATALOG_SYSTEM` prompt is arguably nursery-specific and could move to the vertical config. |
| **B** | `verticals/nursery.ts` — `industryContext`, seed offerings `price_unit:'plant'`, leakage copy — [shared/src/discovery/verticals/nursery.ts:5-39](../../packages/shared/src/discovery/verticals/nursery.ts#L5) | The **nursery vertical config** file | Explicitly namespaced to the vertical (`verticals/nursery.ts`). Plant talk here is correct — this is the "value lives in one declarative place" pattern. Fine. |
| **B** | `notifications/templates/cultivar.ts` — `plantName`, `plantTotal` on order/delivery/checkin/leakage templates — [shared/src/notifications/templates/cultivar.ts:19-226](../../packages/shared/src/notifications/templates/cultivar.ts#L19) | The **cultivar** notification template | Vertical-namespaced template file. Plant fields are appropriate inside it. Fine. |
| **B/C** | `social/generate.ts:8` — `nursery: 'owner-operated plant nursery'` | Vertical context string (a value) | A per-vertical description value. Fine as a value; C only if the map itself should live in vertical config. |
| **C** | `CostToProduce.ts:93,99` — comments "nursery per-plant", denominator example `'plant' (cultivar)` — [shared/src/business-logic/CostToProduce.ts:93](../../packages/shared/src/business-logic/CostToProduce.ts#L93) | Comments + example value in generic cost engine | Comment/example only; the code treats `'plant'` as an opaque denominator string. Harmless. Leave. |
| **B** | `canonicalName.ts:6` / `stockLineResolver.ts:7,11` / `seed.ts:5` (`VALID_PRICE_UNITS` incl `'plant'`) — [shared/src/utils/canonicalName.ts:6](../../packages/shared/src/utils/canonicalName.ts#L6), [shared/src/inventory/stockLineResolver.ts:7](../../packages/shared/src/inventory/stockLineResolver.ts#L7), [shared/src/discovery/seed.ts:5](../../packages/shared/src/discovery/seed.ts#L5) | Comments + a validator set | Mostly comments; `seed.ts` `VALID_PRICE_UNITS` mirrors the enum (rides the `price_unit` decision). Low priority. |

### GROUP 3 — SHARED BACKEND (`api/` — the deployed server, cross-vertical)

| Tag | Reference | What it is | Notes |
|-----|-----------|-----------|-------|
| **C** | `api/dashboard.ts` — reads `cultivar_plants`, returns **`plant_count`** field — [api/dashboard.ts:17-41](../../packages/cultivar-os/api/dashboard.ts#L17) | Shared dashboard endpoint | A shared `api/` endpoint counts `cultivar_plants` and returns `plant_count` in its response contract. **David's own R2-C archetype: the reader is shared, the field is cultivar.** Fix = generic `identity_count`, or accept dashboard.ts as cultivar's endpoint. |
| **C** | `api/orders/submit.ts` — `plant_id`, `plantCount`, `plantSubtotal`, `plantName`, `synthesizePlant`, `deriveTransportMethod` per-plant logic — [api/orders/submit.ts:35-772](../../packages/cultivar-os/api/orders/submit.ts#L35) (≈40 refs) | The shared order-write + CRUD endpoint | The shared order spine is written entirely in plant vocabulary (internal vars + the `order_items.plant_id` write at [:412-414](../../packages/cultivar-os/api/orders/submit.ts#L412)). Internal names aren't an API contract, but they bake a cultivar model into the shared writer. Clears largely as a side-effect of the `order_items.plant_id` verdict + generic renames (`lineCount`/`lineSubtotal`/`itemName`). |
| **B** | `api/qbo/invoice/cultivar.ts` — dual-anchor read `cultivar_plants(*)` + `plant${installQty>1?'s':''}` — [api/qbo/invoice/cultivar.ts:135-263](../../packages/cultivar-os/api/qbo/invoice/cultivar.ts#L135) | The **cultivar** QB invoice builder | File is vertical-namespaced (`invoice/cultivar.ts`). It reads `cultivar_plants` for specimen names via the D-34 dual anchor (already falls back to `business_inventory`). Fine — but its `plant_id` read is a downstream consumer of the GROUP-1 verdict (R4). |
| **B** | `api/social/generate-posts.ts` — `cultivar_plants(common_name, species)`, `plantNames` — [api/social/generate-posts.ts:95-108](../../packages/cultivar-os/api/social/generate-posts.ts#L95) | Social post generator reading specimen names | Reads cultivar names to summarize post subjects; degrades to `'plants and trees'`. Cultivar-flavored but self-contained. Fine. |

### GROUP 4 — CULTIVAR-OS FRONTEND (`packages/cultivar-os/src/`) — a vertical's own code = bucket B by default

All of the following live **inside the cultivar vertical's package**, so AC-1 does not apply. Listed for completeness; **no action** unless noted.

| Tag | Reference | What it is |
|-----|-----------|-----------|
| **B** | `types/plant.ts` — `Plant`, `PlantEvent`, `PlantInventory`, `Addon.price_per_plant`, `ServiceOffering.price_unit` — [types/plant.ts:1-89](../../packages/cultivar-os/src/types/plant.ts) | Cultivar domain types (the local mirror of `cultivar_plants` + `price_unit`) |
| **B** | `components/plant/` — `PlantProfile`, `PlantHero`, `PlantCard`, `PlantTimeline` — [PlantHero.tsx](../../packages/cultivar-os/src/components/plant/PlantHero.tsx), [PlantCard.tsx](../../packages/cultivar-os/src/components/plant/PlantCard.tsx), [PlantTimeline.tsx](../../packages/cultivar-os/src/components/plant/PlantTimeline.tsx) | Cultivar plant-profile UI |
| **B** | `hooks/usePlant.ts` (+ `PlantCache`, `PlantSizeChoice`, `cultivar_plants` reads) — [hooks/usePlant.ts](../../packages/cultivar-os/src/hooks/usePlant.ts) | Cultivar specimen/stock-line resolver hook |
| **B** | `lib/stockLinePlant.ts` (`synthesizePlant`, `anchorKey`), `lib/orderItemName.ts` (dual-anchor, "Unknown plant"), `lib/netting.ts` (`totalPlantCount`, `nettedQuantity`), `lib/scanTag.ts` (`/plant/` URL parse), `lib/transport.ts` — [lib/stockLinePlant.ts](../../packages/cultivar-os/src/lib/stockLinePlant.ts), [lib/orderItemName.ts](../../packages/cultivar-os/src/lib/orderItemName.ts), [lib/netting.ts](../../packages/cultivar-os/src/lib/netting.ts) | Cultivar order/scan libs |
| **B** | `hooks/useCart.ts`, `useSubmitOrder.ts`, `useAddons.ts`, `useServices.ts` — cart lines keyed on `plant` — [hooks/useCart.ts](../../packages/cultivar-os/src/hooks/useCart.ts), [hooks/useSubmitOrder.ts](../../packages/cultivar-os/src/hooks/useSubmitOrder.ts) | Cultivar checkout state |
| **B** | Pages — `PlantProfile`, `ScanOrder`, `AddOns`, `Confirmation`, `OrderDetail`, `DemoQBInvoice`, `DeliveryRoute`, `Dashboard` (`plantCount`), `Settings` (install price per plant), `Terms`/`Privacy` copy, `OnboardingWizard` — [pages/PlantProfile.tsx](../../packages/cultivar-os/src/pages/PlantProfile.tsx), [pages/OrderDetail.tsx:71-249](../../packages/cultivar-os/src/pages/OrderDetail.tsx#L71), [pages/AddOns.tsx](../../packages/cultivar-os/src/pages/AddOns.tsx) | Cultivar screens |
| **B** | `router.tsx` — `/plant/:tagId`, `/plant/:tagId/addons`, `<PlantProfile/>` — [router.tsx:6,87-89](../../packages/cultivar-os/src/router.tsx#L87) | Cultivar routes (the consumer of the shared QR `/plant/` URL — see R4) |
| **B** | `components/checkout/` — `AddonCard` (`price_per_plant`), `NettingPrompt` (`pricePerPlant`), `CompliancePrompt` (`"plant"` unit label), `TransportToggle` (`/plant`) — [components/checkout/AddonCard.tsx:11](../../packages/cultivar-os/src/components/checkout/AddonCard.tsx#L11) | Cultivar checkout components |
| **C** | `registry/tileRegistry.ts:145,64` — tile `metric_plants` "Plants tracked" tagged **`vertical: 'general'`** — [registry/tileRegistry.ts:145](../../packages/cultivar-os/src/registry/tileRegistry.ts#L145) | A cultivar-specific readout tile marked `general`. Minor mislabel — David: retag `vertical:'cultivar'` or accept. |

### GROUP 5 — SCRIPTS / TESTS (non-shipping) — `cultivar_plants` references

`scripts/seed-sandbox.mjs`, `scripts/verify-spine-runtime.mjs`, `scripts/verify-checkout-tamper.mjs`, `scripts/verify-universals.mjs:242`, plus `*.test.ts` fixtures. **B / no-action** — dev tooling against the cultivar table by name. Cited for completeness only. ([scripts/seed-sandbox.mjs:68](../../scripts/seed-sandbox.mjs#L68))

---

## R3 — SHARED-SURFACE VIOLATIONS, RANKED BY BLAST RADIUS (the priority list)

Only bucket-A items on genuinely shared surfaces. Ordered **highest-value / lowest-risk first**:

| # | Violation | Surface | Blast radius | Why this rank |
|---|-----------|---------|--------------|---------------|
| **1** | `order_items.plant_id` | shared `order_items` table | **LOW** — proven vestigial; `business_inventory_id` already carries every line | The flagged bug's root. Removing the *write* is safe today; only specimen-name *readers* need repointing (all already dual-anchor). Best value-to-risk. |
| **2** | `price_unit` DEFAULT `'plant'` (+ enum members) | shared `service_offerings` + shared enums/Settings | **MEDIUM** — CHECK migration + default change + every service create/edit path | A shared table defaulting to a cultivar noun. Enum→free-text (AC-4 pattern) or drop only the DEFAULT. |
| **3** | shared QR util (`generatePlantQR`/`printPlantLabel`/`/plant/` URL/`.plant-id`) | `packages/shared/src/qr/` | **MEDIUM-HIGH** — the URL is encoded into **printed QR codes** + consumed by cultivar's `/plant/:tagId` route + `lib/scanTag.ts` parser | Renaming the function is cheap; changing the `/plant/` URL is not (breaks already-printed labels). Split: rename symbols now, defer/version the URL. |
| **4** | `api/orders/submit.ts` plant vocabulary + `plant_id` write | shared `api/` backend | **HIGH touch / LOW external contract** — ~40 internal refs, no API-contract names | Internal renames (`lineCount`/`lineSubtotal`/`itemName`); the `plant_id` write clears with #1. Do alongside #1. |
| **5** | `api/dashboard.ts` `plant_count` response field | shared `api/` endpoint | **LOW-MEDIUM** — one response field + its Dashboard consumer | Generic `identity_count`, or accept dashboard.ts as cultivar's endpoint. |
| **6** | `discovery/populate.ts` direct `cultivar_plants` reference | shared discovery engine | **LOW** today (cultivar is the only catalog vertical) | Route through a vertical adapter when a 2nd catalog vertical lands; accept until then. |

---

## R4 — BLAST RADIUS DETAIL + SAFE SEQUENCE (bucket-A items)

**#1 `order_items.plant_id`** — what reads it:
- WRITE: [api/orders/submit.ts:412-414](../../packages/cultivar-os/api/orders/submit.ts#L412) (one-of anchor; already writes `business_inventory_id` with `plant_id` null for stock lines — the primary path).
- READ (specimen name only, all dual-anchor with `business_inventory` fallback): [lib/orderItemName.ts:14-39](../../packages/cultivar-os/src/lib/orderItemName.ts#L14), [pages/OrderDetail.tsx:71-124](../../packages/cultivar-os/src/pages/OrderDetail.tsx#L71), [pages/DemoQBInvoice.tsx:63-84](../../packages/cultivar-os/src/pages/DemoQBInvoice.tsx#L63), [api/qbo/invoice/cultivar.ts:142-172](../../packages/cultivar-os/api/qbo/invoice/cultivar.ts#L142), [pages/DeliveryRoute.tsx:24-427](../../packages/cultivar-os/src/pages/DeliveryRoute.tsx#L24).
- Breaks if removed: nothing on the primary (stock-line) path — those already ignore `plant_id`. The specimen-name readers lose the `cultivar_plants` join, so a **true specimen order** (rare/none today) would fall back to the `business_inventory` name. Order CRUD (#100), leakage, contractor tiers, person-spine: **untouched** (none anchor on `plant_id`).
- **Safe sequence:** (a) confirm live: `SELECT count(*) FROM order_items WHERE plant_id IS NOT NULL` — expect ~0; (b) stop writing `plant_id`; (c) repoint the 5 specimen-name readers to `business_inventory_id`-first (they're already fallback-shaped); (d) `DROP COLUMN plant_id` (append-only migration) OR demote to a nullable optional cultivar pointer. Mirror the `social_drafts.plant_id` DROP.

**#2 `price_unit` DEFAULT `'plant'`** — breaks if changed: every service create defaults differently; existing rows unaffected (values already stored). Sequence: drop the DEFAULT (or set none) + widen/remove the CHECK (AC-4 no-CHECK pattern) in one additive migration; update the 3 shared TS defaults ([Settings.tsx:245,385](../../packages/shared/src/pages/Settings.tsx#L245), [serviceOfferingEnums.ts](../../packages/shared/src/business-logic/serviceOfferingEnums.ts)); no data migration.

**#3 shared QR util** — breaks if the `/plant/` URL changes: already-printed QR labels + `router.tsx` `/plant/:tagId` + `lib/scanTag.ts` regex `/\/plant\/([^/?#]+)/`. Sequence: rename the **functions/params/CSS** freely now (internal); keep the **URL path** `/plant/` OR add a generic `/t/<id>` alias route and migrate labels over time. Do NOT change the URL in a way that orphans printed codes.

**#4 `submit.ts` vocabulary** — pure internal renames, no external contract; fold into #1's pass.

**#5 `dashboard.ts plant_count`** — breaks: the Dashboard readout consuming `plant_count`. Sequence: add `identity_count` alongside, migrate the consumer, drop `plant_count`. One endpoint + one page.

---

## R5 — VERDICT (proposed, not executed)

**`order_items.plant_id` specifically:** **REMOVE it from the shared write path.** `business_inventory_id` is proven sufficient (it anchors every live line and resolves name + customer). Two clean end-states for David to pick:
- **(a) DROP the column** (mirrors the already-shipped `social_drafts.plant_id` DROP) — the purest AC-1 result; specimen linkage, if ever needed, moves to a cultivar-side table. **Recommended** — matches precedent, kills the bug class, shrinks the shared spine.
- **(b) DEMOTE to an optional nullable cultivar-specimen pointer** — keep the column, stop treating it as an anchor, document it as a cultivar extension. Lower effort, but leaves a cultivar noun on the shared table (partial AC-1 win).

**Overall pattern:** the audit found **~6 genuine shared-surface (bucket-A) violations** (`order_items.plant_id` · `price_unit` DEFAULT/enum · shared QR util · `submit.ts` vocab · `dashboard.ts plant_count` · `populate.ts` cultivar_plants ref) — the rest of the ~150 `plant*` hits are **correctly inside the cultivar vertical (bucket B)** or cosmetic/comment/naming-lag (**bucket C**). **No plant leak has reached a second vertical.** The spine is close to AC-1-clean; the work is small and bounded.

**Recommended clearing order:** **#1 `order_items.plant_id`** (highest value, proven safe, unblocks the display bug + closes the story) → **#4 `submit.ts`** vocab (same pass) → **#2 `price_unit`** default/enum → **#5 `dashboard.ts`** field → **#3 QR util** symbols (defer URL) → **#6 `populate.ts`** (defer until a 2nd catalog vertical).

---

### Bug-board line items (copy to the board)

- [x] **A** — `order_items.plant_id`: **CLEARED 2026-07-09 (D-36)** — DROPPED via [20260709_drop_order_items_plant_id.sql](../../supabase/migrations/20260709_drop_order_items_plant_id.sql) (gated, David applies as postgres). Chose R5 option (a) DROP (mirrors social_drafts.plant_id). submit.ts stopped writing it (every line anchors business_inventory_id); the 6 specimen readers (orderItemName · OrderDetail · DemoQBInvoice · qbo/invoice/cultivar · DeliveryRoute · Orders roster) repointed to business_inventory_id-first, cultivar_plants embed removed from each. Closes story #231 (the recurring "PLANTS (0)"). *Deploy code first (unread), then apply.*
- [x] **A** — `api/orders/submit.ts` vocab: **CLEARED 2026-07-09** — `plantCount`→`itemCount`, `plantSubtotal`→`linesSubtotal` (avoided collision with the imported `lineSubtotal` fn), local `plantName`→`itemName`; the `plant_id` write cleared with #1. The cultivar notification `plantName:` KEY kept (feeds the cultivar template, bucket-B contract); the specimen create-lane `cultivar_plants` price read kept (reads the specimen table by id, not order_items.plant_id).
- [ ] **A** — `service_offerings.price_unit` DEFAULT `'plant'` + CHECK: drop default / widen enum (AC-4). *HELD (bucket-A #3 per David).*
- [ ] **A** — shared `qr/generate.ts`+`print.ts`: rename `generatePlantQR`/`printPlantLabel`/`plantId`/`.plant-id` → generic; defer `/plant/` URL. *HELD (bucket-A #5 per David).*
- [ ] **A** — `api/dashboard.ts`: `plant_count` → `identity_count` (shared endpoint field).
- [ ] **A/C** — shared `price_unit` TS enums (`types.ts`, `serviceOfferingEnums.ts`, `Settings.tsx`, `seed.ts`): ride the schema decision.
- [ ] **C** — `discovery/populate.ts` direct `cultivar_plants` reference: route via vertical adapter (defer).
- [ ] **C** — `api/dashboard.ts` + `submit.ts`: shared readers reaching into `cultivar_plants` — David's call on adapter-vs-accept.
- [ ] **C** — `plant_events` naming (no `cultivar_` prefix) + `metric_plants` tile tagged `vertical:'general'`: cosmetic consistency.
- [ ] **B** — everything under `packages/cultivar-os/src/**` + `verticals/nursery.ts` + `templates/cultivar.ts`: **no action** (vertical-owned).
