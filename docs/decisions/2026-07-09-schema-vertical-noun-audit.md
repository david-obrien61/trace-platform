# Schema-Wide Vertical-Noun Audit — Bug Board

**Date:** 2026-07-09
**Type:** READ-ONLY recon. No code, no migration, no rename. Inventory + classify only.
**Scope:** the SCHEMA — every `supabase/migrations/*.sql` + the live table/column/constraint/RLS/index/FK names. (App-code `plant*` vocab was covered separately in [2026-07-09-plant-references-ac1-audit.md](./2026-07-09-plant-references-ac1-audit.md); this doc is the SCHEMA layer and adds the **non-plant** verticals — ignition/vehicle/shop, coolrunnings/device, kinna/pantry.)
**Provenance of the ask:** `order_items.plant_id` (dropped D-36, [20260709](../../supabase/migrations/20260709_drop_order_items_plant_id.sql)) proved a vertical noun can ride a shared table silently until a bug surfaces it. This sweeps for EVERY such rider.

---

## Classification key (same buckets as the plant audit)

- **A — HANGING CHAFF (true AC-1 violation):** a vertical noun on a **SHARED surface** (`business_/platform_/order_/customer_/service_/member_`-prefixed table or column, an un-prefixed shared-spine table like `orders`/`customers`, a shared RLS policy/index/constraint). Breaks cross-vertical reuse. **Fix → make generic or drop.**
- **B — LEGITIMATELY VERTICAL (fine as-is):** a vertical noun living on its own correctly-prefixed vertical table (`cultivar_*`). AC-1 only forbids vertical nouns on SHARED surfaces. **No action.**
- **C — AMBIGUOUS / DAVID DECIDES:** a shared reader reaching into a vertical concept, an **enum bundling all verticals' values** (the `price_unit` archetype), an un-prefixed table that *should* be prefixed, or naming-lag. Flagged with tradeoff.

Each open item also tagged **VESTIGIAL** (null/unused → droppable like `plant_id`) or **LOAD-BEARING** (actively used → needs a generic redesign, not a drop) per R5.

---

## R1 — TABLE CENSUS (SHARED vs VERTICAL)

⚠️ Several shared-spine tables are **live-only** (not in any migration — tech-debt #39): `orders`, `order_items`, `customers`, `cultivar_plants`, `plant_events`, `addons`, `losses`, `nurseries`, `modules`. Their columns are ALTERed by migrations but never CREATEd there. These un-prefixed, live-only shared surfaces are the **highest-risk** hiding spots — exactly where `plant_id` and `shop_id` sat.

### SHARED (correctly prefixed, or shared spine)
`businesses` · `business_members` · `business_modules` · `business_inventory` · `business_pmi_schedule` · `business_service_log` · `business_pricing_config` · `business_discovery_profiles` · `business_accounting_secrets` · `business_voice_samples` · `business_assets`→renamed **`cost_objects`** · `cost_object_edges` · `cost_object_assignments` · `labor_resources` · `labor_resource_wages` · `platform_config` · `service_offerings` · `opportunity_items` · `order_items` · `order_service_selections` · `order_compliance_records` · `order_addons` · **`orders`** ⚠un-prefixed · **`customers`** ⚠un-prefixed · `receipts` · `campaigns` · `campaign_posts` · `campaign_tone_samples` · `deliveries` · `inventory_count_sessions` · `inventory_counts` · `member_devices` · `member_device_handoffs` · `invitations` · `people` · `role_definitions` · `audit_log` · `social_drafts` · `advert_channels_config` · **`addons`** ⚠legacy shared · **`losses`** ⚠legacy · **`modules`** ⚠un-prefixed platform catalog

### VERTICAL (cultivar)
`cultivar_plants` ✅ correctly prefixed · `plant_events` ⚠ NOT prefixed · `nursery_profiles` ⚠ "nursery" noun · `nurseries` ⚠ legacy vertical business table · `nursery_modules` ⚠ legacy, DROP gated

### VERTICAL (ignition / coolrunnings / kinna / conduit)
**None on this schema.** Ignition's own tables (`shop_members`, `shop_invites`, vehicle/VIN tables, etc.) live in a **separate Supabase project** (`ufsgqckbxdtwviqjjtos`, off-limits — CLAUDE.md §2/§7). CoolRunnings + KINNA have no tables here. ⟹ any ignition/coolrunnings/kinna noun found on THIS schema is a leak, not a home.

---

## R2 — THE VERTICAL-NOUN SWEEP (shared surfaces only)

### 🔴 BUCKET A — HANGING CHAFF (OPEN)

| # | Item | Surface | Vertical / noun | What it's doing | R5 |
|---|------|---------|-----------------|-----------------|-----|
| **A1** | **`customers.shop_id`** — made nullable [20260521_make_shop_id_nullable.sql:3](../../supabase/migrations/20260521_make_shop_id_nullable.sql#L3) ("cultivar-os customers have no shop_id (Ignition OS concept)") | Column on the **shared, un-prefixed `customers` spine** | **Ignition** — `shop` | An Ignition-vertical FK/column bolted onto the shared `customers` table. Was `NOT NULL`; relaxed to nullable for cultivar rather than removed. **Never dropped.** This is the **exact `plant_id` pattern, one vertical over** — see R4. | **VESTIGIAL** — cultivar never writes it; Ignition uses its own project. Droppable like `plant_id`. **HIGHEST-RISK OPEN ITEM.** |
| **A2** | **`service_offerings.price_unit` DEFAULT `'plant'`** — [20260529_businesses_f_service_offerings.sql:29](../../supabase/migrations/20260529_businesses_f_service_offerings.sql#L29) | Column DEFAULT on the **shared `service_offerings`** table | **Cultivar** — `plant` | A shared table **defaults every new service's billing unit to the cultivar noun `'plant'`**. An ignition/pantry service inherits a plant unit unless overridden. (The DEFAULT is the clear-A; the CHECK enum is the C decision below — see C1.) | **LOAD-BEARING** — drives per-unit pricing. Needs a neutral default (e.g. `'unit'`/`'order'`), not a drop. **HIGH.** |

### ✅ BUCKET A — ALREADY CLEARED (precedent — cite when clearing A1/A2)

| Item | Surface | Resolution |
|------|---------|-----------|
| `order_items.plant_id` (FK→`cultivar_plants`) | shared `order_items` spine | **DROPPED** D-36 [20260709](../../supabase/migrations/20260709_drop_order_items_plant_id.sql). The bug that started this. |
| `social_drafts.plant_id` + `social_drafts.order_id` | shared `social_drafts` | **DROPPED** [20260608_social_drafts_subject_ref.sql:41-46](../../supabase/migrations/20260608_social_drafts_subject_ref.sql#L41) — replaced by generic `subject_type`(free-text, NO CHECK)/`subject_id`. **The reference template for A1.** |
| `plants/plant_events/orders/... .nursery_id` | multiple shared tables | **DROPPED** [20260529_businesses_e_cleanup.sql:9-15](../../supabase/migrations/20260529_businesses_e_cleanup.sql#L9) + [20260613_cultivar_plants_untangle.sql:59](../../supabase/migrations/20260613_cultivar_plants_untangle.sql#L59) — the `nursery_id` → `business_id` de-noun. |

### 🟡 BUCKET C — AMBIGUOUS / DAVID DECIDES

| # | Item | Surface | Tradeoff | R5 |
|---|------|---------|----------|-----|
| **C1** | **`service_offerings.price_unit` CHECK `IN ('order','plant','vehicle','visit')`** — [20260529_businesses_f_service_offerings.sql:30](../../supabase/migrations/20260529_businesses_f_service_offerings.sql#L30) | CHECK constraint on shared `service_offerings` | **The `price_unit` archetype.** A shared constraint that **hardcodes BOTH cultivar (`'plant'`) and ignition (`'vehicle'`) nouns** — adding a vertical's unit needs a migration. The platform's OWN discipline already rejects this: [20260608_social_drafts_subject_ref.sql:30-31](../../supabase/migrations/20260608_social_drafts_subject_ref.sql#L30) made `subject_type` free-text with the note *"enumerating vertical nouns in a DB constraint is its own AC-1 leak."* `price_unit` predates that rule and contradicts it. **David:** drop the CHECK → free-text (app-validated) like `subject_type`, or keep the enum and accept per-vertical migrations. | **LOAD-BEARING** — the enum values are read by pricing. Redesign (drop CHECK), not drop-column. **HIGH — tied to A2.** |
| **C2** | **`nurseries` table** (+ its RLS `authenticated_select_nurseries` [20260528:24](../../supabase/migrations/20260528_per_tenant_rls_isolation.sql#L24)) | A whole vertical-named table, **still live** (holds the LAWNS demo row, `VITE_DEMO_NURSERY_ID`) | The pre-multitenant business table, **superseded by `businesses`** but never retired. A vertical noun standing in for the shared business entity. | **LOAD-BEARING (legacy)** — demo still reads it. Migrate-off + drop, not a rename. **MEDIUM.** |
| **C3** | **`nursery_profiles` table** (+ `nursery_profiles_business_id_key`, `nursery_profiles_owner` policy) — [20260624](../../supabase/migrations/20260624_nursery_profiles_business_id_unique.sql) | Vertical profile table, **not** `cultivar_`-prefixed, "nursery" (retired vocab) | Cultivar-onboarding profile data. Correctly vertical in PURPOSE, but named with the retired `nursery` noun instead of the `cultivar_` convention. Un-prefixed → a shared reader can't tell it's vertical. | **LOAD-BEARING** — written by OnboardingWizard finalize. Cosmetic rename (`cultivar_profiles`) or accept. **LOW.** |
| **C4** | **`plant_events` table** (+ `plant_events_business_owner`, `anon_select_plant_events` policies) — [20260528:51-66](../../supabase/migrations/20260528_per_tenant_rls_isolation.sql#L51) | Cultivar specimen event-log, **missing the `cultivar_` prefix its sibling got** | `cultivar_plants` was renamed from `plants` in 2026-06-13 to mark it vertical; its sibling `plant_events` (and FK `plant_events.plant_id`) did NOT get the prefix. Not a shared leak (it's a cultivar table) — a **naming-consistency lag**. | **LOAD-BEARING** — active table. Cosmetic (`cultivar_plant_events`) or accept the lag. **LOW.** |
| **C5** | RLS policy-name lag on cultivar tables: `plants_business_owner`, `plants_select_public`, `anon_select_plants`, `authenticated_select_plants` — [20260613_cultivar_plants_untangle.sql:28,50](../../supabase/migrations/20260613_cultivar_plants_untangle.sql#L28), [20260528:37-46](../../supabase/migrations/20260528_per_tenant_rls_isolation.sql#L37) | Policy identifiers on `cultivar_plants` | Policies still carry the bare `plants` name after the table gained the `cultivar_` prefix. Sit on a cultivar table → not a shared leak. Cosmetic. | **LOAD-BEARING** (live policies) but naming-only. Rename on next touch. **LOW.** |
| **C6** | **`nursery_modules` table** (+ `nursery_modules_business_owner`, `nursery_modules_business_module_key`) — [20260522](../../supabase/migrations/20260522_rls_modules_nursery_modules.sql) | Legacy per-tenant module-activation table | A "nursery" noun table that is really the shared per-tenant modules table. **Superseded by `business_modules`** ([20260604](../../supabase/migrations/20260604_business_modules.sql)); the DROP is GATED/pending (CLAUDE.md IN-FLIGHT). | **VESTIGIAL** — data migrated to `business_modules`; drop is the pending step. **LOW (already staged).** |

### 🟢 BUCKET B — LEGITIMATELY VERTICAL / NOT-A-LEAK (no action)

| Item | Why it's fine |
|------|---------------|
| `cultivar_plants` table + `cultivar_plants_owner_select`/`cultivar_plants_owner_all` policies — [20260613_cultivar_plants_untangle.sql](../../supabase/migrations/20260613_cultivar_plants_untangle.sql) | Correctly `cultivar_`-prefixed, correctly vertical-identity-only (renamed FROM `plants` precisely to mark it). The model of a clean vertical table. |
| `member_devices` (`device_label`, `device_fingerprint`, `credential_id`) + `member_device_handoffs` — [20260602:127](../../supabase/migrations/20260602_shared_members_a_create_tables.sql#L127), [20260706](../../supabase/migrations/20260706_member_device_handoffs.sql) | The `device` hits are **auth devices** (a member's phone for PIN/WebAuthn unlock), **NOT** CoolRunnings home-automation devices. A shared auth concept, ported from Ignition's `member_devices` but **de-nouned to generic** (`member_`, not `shop_`). Extraction success story. |
| `business_members.pin_hash` — [20260603](../../supabase/migrations/20260603_business_members_add_pin_hash.sql) | Ported from Ignition `shop_members` PIN, but generalized onto the shared `business_members`. Shared now. |
| `cost_objects.node_type` CHECK `('ASSET','PROJECT','PRODUCT')`, `cost_confidence`, `substantiation`, `recovery_basis` enums | Generic classification VALUES, no vertical noun. AC-1-clean by construction (self-documented [20260615:8](../../supabase/migrations/20260615_cost_objects_rename_and_node_schema.sql#L8) "no vertical nouns"). |

---

## R3 — SORT SUMMARY (bug-board checklist)

- [ ] **A1 — `customers.shop_id`** · A · VESTIGIAL · **HIGH** — Ignition noun on shared spine, droppable (see A `order_items.plant_id` precedent). *The undiscovered `plant_id` twin.*
- [ ] **A2 — `service_offerings.price_unit` DEFAULT `'plant'`** · A · LOAD-BEARING · **HIGH** — neutral default needed.
- [ ] **C1 — `service_offerings.price_unit` CHECK enum** · C→A · LOAD-BEARING · **HIGH** — free-text like `subject_type`, or accept per-vertical migrations. (A2+C1 are one column, fix together.)
- [ ] **C2 — `nurseries` table** · C · LOAD-BEARING (legacy) · **MEDIUM** — superseded by `businesses`, still live for demo.
- [ ] **C3 — `nursery_profiles` table name** · C · LOAD-BEARING · **LOW** — retired-vocab rename, or accept.
- [ ] **C4 — `plant_events` table name** · C · LOAD-BEARING · **LOW** — prefix lag vs `cultivar_plants`.
- [ ] **C5 — `plants_*` RLS policy names** · C · naming-only · **LOW.**
- [ ] **C6 — `nursery_modules` table** · C · VESTIGIAL · **LOW** — DROP already gated/pending.
- [x] `order_items.plant_id`, `social_drafts.plant_id/order_id`, `*.nursery_id` — **CLEARED** (precedents).

---

## R4 — THE IGNITION CHECK (explicit)

**Ignition is NOT clean — it left the same class of chaff `plant_id` did, and it went undiscovered for the same reason.**

- **`customers.shop_id` (A1)** is the headline: an Ignition-vertical column (`shop`) sitting **vestigial-nullable on the shared `customers` spine** since 2026-05-21, never dropped — structurally identical to `order_items.plant_id`. It survived because, like `plant_id`, it's an un-written column on an un-prefixed live-only table where nothing forces it into view.
- **`service_offerings.price_unit`'s `'vehicle'` enum value (C1)** is the second Ignition leak — a forward-looking ignition noun baked into a shared CHECK constraint alongside cultivar's `'plant'`.
- **Why no ignition TABLE leaked:** Ignition's own tables live in a separate Supabase project (off-limits), so they physically can't appear on this schema as tables. The leaks are the two SCALARS above (a column + an enum value).
- **The extraction that went RIGHT:** the `member_*` / `business_members` tables were ported FROM Ignition's `shop_*` tables but **renamed generic** during the port — proof the de-noun discipline works when applied at extraction time. `customers.shop_id` is the one that slipped through because it was relaxed-in-place instead of ported-and-renamed.

**CoolRunnings / KINNA / Conduit:** swept clean — **zero** device/sensor/automation/pantry/meal/kin/hvac nouns on any shared surface (the `device` hits are all the shared auth `member_devices`). No tables, no columns, no enums.

---

## R5 — VESTIGIAL vs LOAD-BEARING, RANKED BY RISK

Risk = (shared-surface? un-prefixed spine?) × (load-bearing needs redesign vs vestigial droppable). Highest first:

1. **A1 `customers.shop_id`** — shared un-prefixed spine + VESTIGIAL → **highest-risk OPEN item**, but the *cheapest* fix (a `DROP COLUMN`, mirroring `plant_id`/`social_drafts.plant_id`). Confirm live nullity/emptiness first (defensive, like the D-36 pre-flight count).
2. **A2 + C1 `service_offerings.price_unit`** — shared table + LOAD-BEARING → highest EFFORT (neutral default + drop-the-CHECK-to-free-text redesign, coordinated with the app-code `price_unit` type in [serviceOfferingEnums.ts](../../packages/shared/src/business-logic/serviceOfferingEnums.ts) flagged in the plant audit). Not droppable — it's actively priced against.
3. **C2 `nurseries`** — whole legacy table, LOAD-BEARING for the demo → migrate-off then drop. Medium effort, medium risk (demo-coupled).
4. **C3/C4/C5 naming lags** (`nursery_profiles`, `plant_events`, `plants_*` policies) — LOAD-BEARING but cosmetic; zero functional risk, rename-on-touch.
5. **C6 `nursery_modules`** — VESTIGIAL, drop already gated; lowest risk (staged).

---

*READ-ONLY audit. No migrations proposed. Next step is David's: sort A1/A2/C1–C6 onto the bug board and sequence the clears — A1 first (cheap + high-risk, exact `plant_id` template).*
