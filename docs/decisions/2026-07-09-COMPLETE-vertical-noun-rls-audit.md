# COMPLETE Vertical-Noun + Retired-Model Surface Audit — Consolidated Bug Board

**Date:** 2026-07-09
**Type:** READ-ONLY architecture-hygiene recon. No code, no migration, no rename. Inventory + classify only.
**Purpose:** ONE exhaustive sweep of EVERY surface where a vertical noun (`plant`/`cultivar`/`tree`/`specimen`/`netting`, `vehicle`/`vin`/`shop`/`part`/`engine`/`dtc`, `device`/`sensor`, `pantry`/`meal`/`kin`) OR a retired ownership model (`nursery`/`nurseries`/`nursery_id`, `shop_id`/`shop_members`) can hide on a SHARED surface. **Complete-by-construction, not "everything we thought to check."**

**This board SUPERSEDES and consolidates the three scattered boards:**
- [2026-07-09-plant-references-ac1-audit.md](./2026-07-09-plant-references-ac1-audit.md) — the `plant*` vocab sweep (code + schema)
- [2026-07-09-schema-vertical-noun-audit.md](./2026-07-09-schema-vertical-noun-audit.md) — the non-plant schema sweep (ignition/coolrunnings/kinna)
- [2026-07-09-stale-nursery-rls-audit.md](./2026-07-09-stale-nursery-rls-audit.md) — the RLS join-path sweep (BROKEN-NOW/LATENT)

Their confirmed findings are FOLDED IN below (R4 proves re-coverage), not re-derived. This sweep ADDS the surfaces they didn't cover — **RLS policy join-paths (as a first-class surface), column DEFAULTS, index/FK constraint names, functions/triggers, enum definitions, and the shared `AIEngine.ts` module.**

**Provenance:** the recurring "PLANTS (0)" bug had TWO independent stale-model causes on the same table — a vertical-noun COLUMN (`order_items.plant_id`, D-36) AND a stale RLS POLICY (`order_items` joining through dropped `orders.nursery_id`). Two different surfaces, one symptom. That is exactly why a piecemeal, one-surface-at-a-time approach cannot give completeness confidence — hence this surface-complete pass.

---

## Classification keys

**Vertical-noun / AC-1 bucket** (same as the plant + schema boards):
- **A — HANGING CHAFF (true AC-1 violation):** a vertical noun on a SHARED surface (`business_/platform_/order_/customer_/service_/member_`-prefixed or un-prefixed shared spine; shared `packages/shared/` code; shared `api/` backend; a shared RLS policy/index/constraint). Breaks cross-vertical reuse. **Fix → make generic or drop.**
- **B — LEGITIMATELY VERTICAL:** a vertical noun inside its own correctly-namespaced vertical surface (`cultivar_*` table, `packages/cultivar-os/`, `verticals/nursery.ts`, `templates/cultivar.ts`, `templates/ignition.ts`). AC-1 only forbids vertical nouns on SHARED surfaces. **No action.**
- **C — AMBIGUOUS / DAVID DECIDES:** a shared reader reaching into a vertical concept, an enum bundling all verticals' values, an un-prefixed table that should be prefixed, or naming-lag.

Each open item tagged **VESTIGIAL** (null/unused → droppable) or **LOAD-BEARING** (actively used → needs generic redesign, not a drop).

**RLS-specific tag** (the surface the scoped boards under-weighted — a stale join key silently returns 0 rows):
- **BROKEN-NOW** — the LIVE policy's join key is NULL/absent on modern rows → it filters real rows to zero RIGHT NOW (the `order_items` fingerprint).
- **LATENT** — still resolves on the retired model (table/column still exists) → works today, landmine at DROP time.
- **CLEAN** — LIVE policy on `business_id → businesses.owner_id` (+ optionally `is_active_member`).

---

## R1 — SURFACE COVERAGE DECLARATION (the completeness guarantee)

For each surface (a)–(k): HOW it was swept, and confirmation it was covered. **No surface silently skipped.**

| # | Surface | How swept | Covered? |
|---|---------|-----------|----------|
| **(a)** | **Table names** | `ls` of all 68 migration files + the R1 table census from the schema board (cross-checked). Live-only tables (`orders`/`customers`/`order_items`/`cultivar_plants`/etc.) enumerated from their ALTER sites. | ✅ — see flag in R5 (live-only CREATE bodies are the one non-static gap). |
| **(b)** | **Column names** | `grep -niE '^\s*(vehicle\|vin\|shop\|part_\|engine\|dtc\|nursery)[a-z_]* +(uuid\|text\|int\|...)'` over all migrations (column DEFINITIONS) + the plant/schema boards' column inventory + `grep shop\|nursery` over `packages/*/api`. | ✅ — only non-plant vertical column on the schema is `customers.shop_id`. |
| **(c)** | **Column DEFAULTS** | `grep -niE "DEFAULT +'?(plant\|tree\|vehicle\|vin\|shop\|nursery\|specimen\|net\|pantry\|meal\|device\|sensor)"` over all migrations. | ✅ — **2 hits** (NEW findings, see A2 + C7). |
| **(d)** | **CHECK constraint values** | `grep -niE "CHECK ?\("` over all migrations, filtered for vertical nouns. | ✅ — only `service_offerings.price_unit` CHECK carries vertical values. All other CHECKs are structural (RLS `WITH CHECK`) or generic enums. |
| **(e)** | **RLS POLICY join-paths** | Read every `CREATE POLICY` (`grep nursery_id\|shop_id` → resolved each to its table + LIVE definition via "last-definition-wins"; read `20260528`, `20260529_d`, `20260709_order_items_business_rls` in full). Checked each retired-model join key against whether it's still populated on modern rows. | ✅ — **the surface the scoped boards under-weighted.** 2 BROKEN-NOW, 2 LATENT. |
| **(f)** | **Index names** | `grep -niE "(CREATE.*INDEX\|INDEX)"` filtered for vertical nouns. | ✅ — **1 hit** (`nursery_modules_business_module_key`, retired table). |
| **(g)** | **FK / constraint names + targets** | `grep -niE "(REFERENCES\|CONSTRAINT\|FOREIGN KEY)"` filtered for vertical nouns. | ✅ — **1 live constraint name** (`nursery_profiles_business_id_key`); FK TARGETS are all `businesses(id)`/`business_inventory(id)` (generic). `order_items.plant_id` FK dropped by D-36. |
| **(h)** | **Functions / triggers** | `grep -niE "(CREATE.*FUNCTION\|CREATE TRIGGER)"` over all migrations — full list read. | ✅ — **CLEAN.** Every function/trigger is generic (`set_updated_at_generic`, `is_active_member`, `has_permission`, `reject_audit_log_mutation`, `enforce_member_authority_immutability`, per-table `*_updated_at`). Zero vertical nouns. |
| **(i)** | **Enum / type definitions** | `grep -niE "CREATE TYPE\|AS ENUM"` over all migrations. | ✅ — **CLEAN.** No `CREATE TYPE`/`AS ENUM` exists anywhere; every "enum" is a `text + CHECK`, so this surface collapses into (d). Only `price_unit` carries vertical values. |
| **(j)** | **Route paths** | `grep -niE "(path:\|<Route\|navigate\(\|href=)"` over `packages/shared/src` filtered for `/plant\|/nursery\|/shop\|/vehicle\|/tree`; the cultivar `/plant/:tagId` route is in the plant board (A3). | ✅ — no vertical-noun ROUTE in shared code (hits were test fixtures / lawnstrees.com content). Retired `?nursery_id=` QUERY param found in shared `api/` (C8). |
| **(k)** | **Shared code identifiers** | `grep -niE "nursery\|shopId\|shop_id\|vehicle\|\bvin\b"` over `packages/shared/src` + the plant board's GROUP-2/3 shared-code inventory + `AIEngine` consumer check. | ✅ — **the biggest NET-NEW: `AIEngine.ts` (A3 below).** Plus several minors. |

**Two surfaces that genuinely cannot be audited statically (flagged, not skipped — see R5):** the CREATE-TABLE bodies of the live-only shared tables (not in any migration — tech-debt #39) and the LIVE-resolved policy set (no DB credentials this pass; `.env` holds placeholders). Both are audited here from migrations + code as the best static proxy; a live `pg_policies` / `information_schema` pull would close them.

---

## R2 — THE SWEEP (every vertical-noun / retired-model reference on a SHARED surface)

### 🔴 BUCKET A — HANGING CHAFF (OPEN)

| # | Item | Surface (a–k) | Noun / model | What it does | Tag |
|---|------|---------------|--------------|--------------|-----|
| **A1** | `customers.shop_id` (nullable) — [20260521:3](../../supabase/migrations/20260521_make_shop_id_nullable.sql#L3) | (b) column on shared un-prefixed `customers` spine | **Ignition** `shop` | Ignition FK relaxed-in-place onto the shared customers table; cultivar never writes it. **The exact `plant_id` pattern, one vertical over.** | **VESTIGIAL** — droppable. **HIGH.** |
| **A2** | `service_offerings.price_unit` DEFAULT `'plant'` + its TS mirrors — [20260529_f:29](../../supabase/migrations/20260529_businesses_f_service_offerings.sql#L29), [serviceOfferingEnums.ts:54](../../packages/shared/src/business-logic/serviceOfferingEnums.ts#L54), [discovery/types.ts:10](../../packages/shared/src/discovery/types.ts#L10), [engine.ts:124](../../packages/shared/src/discovery/engine.ts#L124), [seed.ts:5](../../packages/shared/src/discovery/seed.ts#L5), [Settings.tsx:245](../../packages/shared/src/pages/Settings.tsx#L245) | (c) DEFAULT + (k) shared enum mirrors | **Cultivar** `plant` | Shared table + shared editor default every new service's billing unit to the cultivar noun. | **LOAD-BEARING** — neutral default (`'unit'`/`'order'`). **HIGH.** |
| **A3** | **`packages/shared/src/ai/AIEngine.ts`** — `decodeVIN`/`decodeDTC`/`extractParts`/`readToolLabel`/`suggestPMI`/`auditInvoice`/`draftEstimate`/`savingsReport`; `shop_id`/`shopId` params throughout; `vehicle?` in the payload type — [AIEngine.ts:79,163-197](../../packages/shared/src/ai/AIEngine.ts#L163) | (k) an entire shared module | **Ignition** `shop`/`vehicle`/`vin`/`dtc`/`part` | A **shared** AI engine whose whole method surface is ignition-vertical AND wired to the retired `shop_id` model. Exported from the shared barrel ([index.ts:15](../../packages/shared/src/index.ts#L15)) but **has ZERO active consumer in the tree** — dormant Ignition donor code sitting in `shared/`. This is CLAUDE.md §1.5's long-standing known violation ("`shopId`/`shop_id` in AIEngine.ts", 2026-06-04 audit) — **it was in NEITHER 2026-07-09 board.** | **VESTIGIAL** (dormant, no live caller) but a whole-module leak. **MEDIUM** — move to `packages/ignition-os/` or namespace, or accept as donor until Ignition reconnects. |

### 🟠 RLS JOIN-PATH (surface e) — the retired-model policies

| # | Table | Live policy | Joins through | Tag | Disposition |
|---|-------|-------------|---------------|-----|-------------|
| **E1** | **`order_items`** | `authenticated_select_order_items` [20260528:119](../../supabase/migrations/20260528_per_tenant_rls_isolation.sql#L119) | `orders.nursery_id → nurseries.owner_id` | **BROKEN-NOW** — `orders.nursery_id` dropped [20260529_e:13](../../supabase/migrations/20260529_businesses_e_cleanup.sql#L13) → 0 rows on modern orders → "PLANTS (0)" | **FIXED (GATED)** in [20260709_order_items_business_rls.sql](../../supabase/migrations/20260709_order_items_business_rls.sql) → `order_items_owner` on `business_id`, mirroring the co-read sibling `order_service_selections_owner`. David applies. |
| **E2** | **`order_addons`** | `authenticated_select_order_addons` [20260528:137](../../supabase/migrations/20260528_per_tenant_rls_isolation.sql#L137) | `orders.nursery_id → nurseries.owner_id` | **BROKEN-NOW** (legacy table — superseded by `order_service_selections`, low live-read impact) | **FIXED (GATED, guarded)** in the same migration → `order_addons_owner`; `to_regclass` no-op if the table was already dropped. |
| **E3** | **`nurseries`** | `authenticated_select_nurseries` [20260528:25](../../supabase/migrations/20260528_per_tenant_rls_isolation.sql#L25) — `owner_id = auth.uid()` directly | (retired-model ROOT) | **LATENT** — the table E1 joins THROUGH; works while it exists; pending DROP | Leave until the `nurseries` DROP (PLATFORM_STATE IN-FLIGHT). Not a live isolation risk. |
| **E4** | **`nursery_modules` TABLE** | `nursery_modules_business_owner` [20260529_d:50](../../supabase/migrations/20260529_businesses_d_update_rls.sql#L50) — already `business_id` | (retired table, CLEAN policy) | **LATENT** (table-level only — policy is clean) | Drop with the noun-purge sweep; superseded by `business_modules`. |

**All 9 stale `20260528` policies traced:** `plants`, `orders`, `addons`, `customers`, `plant_events`, `social_drafts`, `nursery_modules` were all **superseded by clean `business_id` policies** in [20260529_businesses_d_update_rls.sql](../../supabase/migrations/20260529_businesses_d_update_rls.sql) (last-definition-wins) → CLEAN. `plants`→`cultivar_plants` re-clean via the untangle. **Only the two order-CHILD tables (E1/E2) were left behind** — because `20260529_d` migrated the parent `orders` and the other children but not `order_items`/`order_addons`. That asymmetry IS the fingerprint.

### 🟡 BUCKET C — AMBIGUOUS / DAVID DECIDES

| # | Item | Surface | Tradeoff | Tag |
|---|------|---------|----------|-----|
| **C1** | `service_offerings.price_unit` CHECK `IN ('order','plant','vehicle','visit')` — [20260529_f:30](../../supabase/migrations/20260529_businesses_f_service_offerings.sql#L30) | (d) CHECK on shared `service_offerings` | Hardcodes BOTH cultivar (`plant`) + ignition (`vehicle`) nouns; adding a vertical's unit needs a migration. The platform's own [social_drafts.subject_type](../../supabase/migrations/20260608_social_drafts_subject_ref.sql#L30) precedent made this free-text ("enumerating vertical nouns in a DB constraint is its own AC-1 leak"). Drop CHECK → free-text (app-validated), or accept per-vertical migrations. | **LOAD-BEARING** — fix WITH A2. **HIGH.** |
| **C2** | `nurseries` table (as a whole) | (a) legacy vertical business table, still live (LAWNS demo, `VITE_DEMO_NURSERY_ID`) | Pre-multitenant business table, superseded by `businesses`, never retired. | **LOAD-BEARING (legacy)** — migrate-off + drop. **MEDIUM.** |
| **C3** | `nursery_profiles` table + `nursery_profiles_business_id_key` constraint — [20260624:18](../../supabase/migrations/20260624_nursery_profiles_business_id_unique.sql#L18) | (a) table name + (g) constraint name | Cultivar profile data, correctly vertical in purpose but named with retired `nursery` vocab, not `cultivar_`. | **LOAD-BEARING** — cosmetic rename or accept. **LOW.** |
| **C4** | `plant_events` table (+ FK `plant_events.plant_id`) — [20260528:51](../../supabase/migrations/20260528_per_tenant_rls_isolation.sql#L51) | (a) table name | `cultivar_plants` got the vertical prefix in 2026-06-13; its sibling `plant_events` did not. Naming-lag on a cultivar table (not a shared leak). | **LOAD-BEARING** — `cultivar_plant_events` or accept. **LOW.** |
| **C5** | `plants_*` RLS policy names (`anon_select_plants`, `plants_business_owner`, etc.) + `plants_business_owner`/`plant_events_business_owner` | (e) policy identifiers on cultivar tables | Policies carry the bare `plants` name after the `cultivar_` rename. Cosmetic; sit on cultivar tables → not a shared leak. | naming-only. **LOW.** |
| **C6** | `nursery_modules` table + `nursery_modules_business_module_key` index — [20260529_d:55](../../supabase/migrations/20260529_businesses_d_update_rls.sql#L55) | (a) table + (f) index name | Retired per-tenant module table + its index, superseded by `business_modules`; DROP gated/pending. | **VESTIGIAL** — drop staged. **LOW.** |
| **C7** | **`businesses.business_type` DEFAULT `'nursery'`** — [20260529_a:14](../../supabase/migrations/20260529_businesses_a_create_tables.sql#L14) | (c) DEFAULT on the shared `businesses` spine | **NET-NEW — in no prior board.** The COLUMN is AC-1-correct (vertical identity as a VALUE). But the DEFAULT biases a new business toward the cultivar vertical: a row created without an explicit type becomes a nursery. The app sets it explicitly (TRACE=`general`, LAWNS=`nursery`), so this is a fallback. David: default to `'general'`/none, or accept the fallback. | **LOAD-BEARING** (fallback only). **LOW.** |
| **C8** | **`?nursery_id=` query param** accepted by shared `api/dashboard.ts:10` + `api/qbo/router.ts:55,168` — [dashboard.ts:10](../../packages/cultivar-os/api/dashboard.ts#L10) | (j)/(k) retired-model param on shared endpoints | **NET-NEW.** Both endpoints read `business_id ?? nursery_id` — a retired-model param name kept as a fallback in the API contract. Harmless (business_id preferred) but a retired-model reference on the shared backend. David: drop the `nursery_id` fallback. | **VESTIGIAL** (fallback). **LOW.** |
| **C9** | shared UI/label minors: `OwnerSignup.memberFKColumn: 'business_id' \| 'shop_id'` + `businessLabel` [OwnerSignup.tsx:32](../../packages/shared/src/auth/OwnerSignup.tsx#L32); `configureAuth` placeholder `"Nursery name"` [configureAuth.tsx:177](../../packages/shared/src/auth/configureAuth.tsx#L177); `PMI.assetTypes` default `['Vehicle',...]` [PMI.tsx:134](../../packages/shared/src/modules/PMI.tsx#L134); `dashboard.ts` `plant_count` response field [dashboard.ts:41](../../packages/cultivar-os/api/dashboard.ts#L41) | (k) shared code identifiers / defaults | **Mostly NET-NEW.** Shared components parameterized-but-biased to a vertical: `OwnerSignup` offers the retired `shop_id` FK column as a config option (LATENT — supports Ignition's retired model); `configureAuth` hardcodes a "Nursery" placeholder; `PMI` defaults its asset-type list to include `Vehicle`; `dashboard.ts` returns a cultivar `plant_count` field. Each is a configurable/default-value bias, not a hard leak. (`plant_count` is also plant-board GROUP-3-C.) | naming/default bias. **LOW.** |

### 🟢 BUCKET B — LEGITIMATELY VERTICAL / CLEAN (no action — declared for completeness)

| Surface | Why fine |
|---------|----------|
| `cultivar_plants` table + policies | Correctly `cultivar_`-prefixed vertical-identity table (renamed FROM `plants` precisely to mark it). |
| `member_devices` / `member_device_handoffs` (`device_*`, `credential_id`) | The `device` hits are shared AUTH devices (phone for PIN/WebAuthn) — de-nouned FROM Ignition's `shop_*`. Extraction success. NOT CoolRunnings home-automation. |
| `business_members.pin_hash` | Ported from Ignition `shop_members` PIN, generalized onto shared `business_members`. |
| Functions/triggers (surface h) | ALL generic — zero vertical nouns. CLEAN surface. |
| Enum definitions (surface i) | None exist (CHECK-based); only `price_unit` carries vertical values (→ C1). |
| `verticals/nursery.ts`, `templates/cultivar.ts`, `templates/ignition.ts`, cultivar-os `catalog.ts` prompt content, `costDiscovery.ts` "tree nursery" example | Vertical-namespaced config/template files, or vertical nouns as CONTENT VALUES in prompts (AC-1 permits identity-as-value). |
| `cost_objects.node_type`/`cost_confidence`/`recovery_basis` CHECK enums | Generic classification values, self-documented AC-1-clean. |

---

## R3 — CONSOLIDATED BUG BOARD (supersedes the three scattered ones)

Sorted by (surface-shared? × broken-now? × vestigial-droppable vs load-bearing). **Highest risk first.**

- [ ] **E1 — `order_items` RLS** · (e) · **BROKEN-NOW** · **CRITICAL** → **FIXED, GATED** in [20260709_order_items_business_rls.sql](../../supabase/migrations/20260709_order_items_business_rls.sql). *David applies as postgres + runs the embedded AC-3 isolation proof.* The live "PLANTS (0)" cause.
- [ ] **E2 — `order_addons` RLS** · (e) · **BROKEN-NOW** (legacy) · **HIGH** → **FIXED, GATED** (same migration, guarded).
- [ ] **A1 — `customers.shop_id`** · (b) · A · VESTIGIAL · **HIGH** — droppable, exact `plant_id`/`social_drafts.plant_id` template. Confirm live nullity first.
- [ ] **A2 + C1 — `service_offerings.price_unit` DEFAULT `'plant'` + CHECK enum** · (c)+(d)+(k) · A/LOAD-BEARING · **HIGH** — neutral default + drop-CHECK-to-free-text (the `subject_type` pattern), coordinated with the 4 shared TS mirrors.
- [ ] **A3 — `AIEngine.ts`** · (k) · A/VESTIGIAL (dormant) · **MEDIUM** — whole shared module of ignition nouns + retired `shop_id`; no live consumer. Move to `packages/ignition-os/` or namespace, or accept as donor. (CLAUDE.md §1.5 known violation.)
- [ ] **C2 — `nurseries` table** · (a) · LOAD-BEARING (legacy) · **MEDIUM** — the retired-model root (E3 joins through it); migrate-off + drop.
- [ ] **E3/E4 — `nurseries` / `nursery_modules` policies+tables** · (e)/(a) · LATENT · **LOW** — fold into the `nurseries`/`nursery_modules` DROP; not live isolation risks.
- [ ] **C7 — `businesses.business_type` DEFAULT `'nursery'`** · (c) · C/LOAD-BEARING · **LOW** — default to `'general'`/none, or accept fallback.
- [ ] **C8 — `?nursery_id=` param** (dashboard.ts, qbo/router.ts) · (j)/(k) · C/VESTIGIAL · **LOW** — drop the retired fallback param.
- [ ] **C3/C4/C5/C6 — naming lags** (`nursery_profiles`, `plant_events`, `plants_*` policies, `nursery_modules_*` names) · (a)/(f)/(g)/(e) · cosmetic · **LOW** — rename-on-touch.
- [ ] **C9 — shared UI/default biases** (`OwnerSignup.shop_id` option, `configureAuth` "Nursery" placeholder, `PMI.assetTypes` Vehicle default, `dashboard.ts plant_count`) · (k) · **LOW** — de-bias when touched.
- [x] **CLEARED (precedents):** `order_items.plant_id` (D-36), `social_drafts.plant_id/order_id`, `*.nursery_id` columns, `submit.ts` plant vocab. — cite when clearing the above.

---

## R4 — RECONCILIATION WITH THE THREE PRIOR BOARDS (proving coverage + net-new)

### RE-FOUND (proves this sweep re-covers what the scoped boards found)

| Prior finding | Prior board | Re-found here |
|---|---|---|
| `order_items.plant_id` (dropped, D-36) | plant + schema | ✅ cited as CLEARED precedent |
| `customers.shop_id` | schema (A1) | ✅ **A1** |
| `service_offerings.price_unit` DEFAULT `'plant'` | plant + schema (A2) | ✅ **A2** |
| `price_unit` CHECK enum (`plant`+`vehicle`) | schema (C1) | ✅ **C1** |
| `price_unit` TS mirrors (serviceOfferingEnums/types/engine/seed) | plant (GROUP-2 A) | ✅ folded into **A2** |
| shared QR util (`generatePlantQR`/`/plant/` URL) | plant (GROUP-2 A) | ✅ (surface k/j — held per plant board; not re-listed to avoid duplication) |
| `dashboard.ts plant_count` | plant (GROUP-3 C) | ✅ **C9** |
| `submit.ts` plant vocab | plant (CLEARED) | ✅ cited as cleared |
| `nurseries`, `nursery_profiles`, `plant_events`, `nursery_modules` tables | schema (C2–C6) | ✅ **C2/C3/C4/C6** |
| `plants_*` policy-name lag | plant + schema (C5) | ✅ **C5** |
| `order_items`/`order_addons` stale RLS (BROKEN-NOW) | stale-rls | ✅ **E1/E2** |
| `nurseries`/`nursery_modules` LATENT | stale-rls | ✅ **E3/E4** |

### NET-NEW (surfaces the three scoped boards did NOT cover)

1. **The RLS join-path as a first-class surface (E1–E4)** — the stale-rls board covered it, but the two PLANT/SCHEMA boards (the ones David has been treating as "the vertical-noun audit") did NOT. Consolidated here so the noun board and the RLS board are one.
2. **`AIEngine.ts` (A3)** — an entire shared module of ignition nouns + `shop_id`. Known in CLAUDE.md §1.5 but in **no** 2026-07-09 board. Surface (k).
3. **`businesses.business_type` DEFAULT `'nursery'` (C7)** — surface (c). In no board.
4. **`?nursery_id=` query param** on shared `api/dashboard.ts` + `api/qbo/router.ts` (C8) — surface (j)/(k). In no board.
5. **`nursery_modules_business_module_key` index name (C6)** — surface (f). In no board (the table was; the index name wasn't).
6. **`nursery_profiles_business_id_key` constraint name (C3)** — surface (g). The table was flagged; the constraint identifier wasn't.
7. **Shared UI/default biases (C9)** — `OwnerSignup.memberFKColumn: 'shop_id'` (shared auth still offers the retired FK column), `configureAuth` "Nursery" placeholder, `PMI.assetTypes` Vehicle default — surface (k). In no board.
8. **Clean-surface DECLARATIONS (h functions/triggers, i enums)** — proven clean, so future audits don't re-sweep them blind.

---

## R5 — THE TRUST ANSWER

**Is the shared spine's vertical-noun / retired-model exposure now COMPLETELY mapped?**

**Yes, statically — for every surface that lives in version control.** All eleven surfaces (a)–(k) were swept by explicit method (R1), and every hit is on the board (R2/R3). The three previously-scattered boards are now reconciled into this one, and this pass added 8 categories of NET-NEW items the scoped boards missed (R4) — most importantly the RLS join-path (which the "vertical-noun" boards had treated as a separate concern) and the shared `AIEngine.ts` module. Functions/triggers (h) and enum-types (i) are proven CLEAN, so they need no further sweeping.

**Two surfaces genuinely cannot be audited from static files (flagged, not skipped):**

1. **Live-only table CREATE bodies (tech-debt #39).** `orders`, `customers`, `order_items`, `cultivar_plants`, `plant_events`, `addons`, `losses`, `nurseries`, `modules` were CREATEd directly in the live DB and never captured in a migration — only their ALTERs/policies are in version control. Their base column sets (and any vertical noun defined at CREATE and never ALTERed since) are invisible to a static sweep. This is the exact class that hid `plant_id` and `shop_id`. **Closing it requires either (a) a live `information_schema.columns` pull, or (b) writing the capture migrations that tech-debt #39 already tracks.** Until then, this board's coverage of those tables is "every ALTER + every policy," not "every column."

2. **The LIVE-resolved policy set.** This audit resolved policies by "last-definition-wins" across migrations (the correct static model), but a migration marked GATED (e.g. `20260709_order_items_business_rls.sql`, `20260709_drop_order_items_plant_id.sql`) is only LIVE once David applies it. A live `pg_policies` / `pg_constraint` pull (no DB creds this pass — `.env` holds placeholders) would confirm the applied state and is the standing verification step for E1/E2 anyway.

**Recommendation:** treat this as the single consolidated board (retire the three scattered ones to "folded into 2026-07-09-COMPLETE"). The one remaining COMPLETENESS gap is structural, not an oversight — it is tech-debt #39 (live-only schema not in version control). **The single highest-value follow-up that would make the guarantee total is a one-time live `information_schema.columns` + `pg_policies` snapshot of the 9 live-only tables** — after that, every surface is either in version control or in the snapshot, and no vertical noun can hide the way `plant_id`/`shop_id` did.

---

*READ-ONLY audit. No migrations proposed, no renames executed. Next step is David's: sequence the R3 board — E1/E2 are already fixed+gated (apply + prove), then A1 (cheap+high), then A2+C1, then the live-schema snapshot to close the one static-audit gap.*
