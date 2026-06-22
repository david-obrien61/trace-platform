# Role-Machine + Signing Recon (Phase 0 bench stand-up) — READ-ONLY

**Date:** 2026-06-22 · **Author:** Thunder (Prompt 3 of 3, on the Prompts 1+2 baseline)
**Mode:** Read-only recon. The ONLY writes this session were the STEP-0b citation-convention line (`9add1c3`) and this doc.
**Authority:** Repo + live policy SQL are authority. Where code contradicts an assumption, **the code wins — and it is called out explicitly** (3 such corrections below). Ignition OS (`ufsgqckbxdtwviqjjtos`) was read as a **DESIGN DONOR from repo source only** — its live DB was not queried; copy nothing. Cultivar/platform (`bgobkjcopcxusjsetfob`) is the live target.
**Framing:** Role Machine = the standing TEST HARNESS we build first; the built bits (cost wall, write-wall, Part A, costDiscovery) are what it tests against. So this recon answers (i) what Ignition already has to stand the bench up from, and (ii) which built bits need a real role to test them — especially WRITE paths.

**Classification key:** PROVEN / HALF-BUILT (names last-working + first-missing step) / DESIGNED-ONLY / ABSENT.

---

## ⚠️ THREE CODE-WINS CORRECTIONS (read these first)

1. **The anon-key write-wall ALREADY HOLDS structurally — the "operating-cost +cost save is an open write hole" premise is imprecise.** Every cost/wage member RLS policy is `member_all` = **FOR ALL** with `has_permission(...)` in **both `USING` and `WITH CHECK`** (`supabase/migrations/20260622_oauth_secrets_relocation_and_cost_wall.sql:141-212`). WITH CHECK gates INSERT; USING+WITH CHECK gate UPDATE; USING gates DELETE. So a member JWT lacking `view_costs`/`view_wages`/`view_pricing_config` is **refused the WRITE at the data layer**, not just the read. The operating-cost +cost save, BusinessAssets, CostToProduceSettings, and BusinessInventory writes are all anon-key paths → all RLS-gated for writes today. **What is genuinely missing for them is a WRITE-side TAMPER PROOF** (the HAR proved SELECT returns `200 []`; it never tested INSERT/UPDATE refusal) **and render-layer button gates** (defense-in-depth) — NOT the data-layer gate itself. See WRITE-WALL MAP.
2. **The ONE genuinely ungated financial write = the costDiscovery `cost-apply` service-key endpoint.** `packages/cultivar-os/api/discovery/ingest.ts` (action `cost-apply`) calls `applyCostReasoning` with `SUPABASE_SERVICE_KEY` → **bypasses RLS entirely** + has **no caller permission check**. This is the real Gate-3b hole. (D-015 reasoning #3 named it; reasoning #3's "operating-cost" half is what correction #1 revises.)
3. **`packages/shared/src/stripe/{billing,trial}.ts` does NOT exist.** Only `stripe_customer_id`/`stripe_subscription_id` columns appear in `packages/shared/src/supabase/types.ts`. The Prompt-2 built-inventory seed line "Tile Marketplace … Reuses shared `stripe/{billing,trial}.ts`" is aspirational — **the marketplace billing is a BUILD, not a reuse.** (Doc-vs-code fix to make in a future ledger pass; recon is read-only.)

---

## AREA 1 — ROLE / RBAC ENGINE (the bench itself)

### 1.1 Where roles live — **PROVEN (data model) / the 4-role target is DESIGNED-ONLY**
- **Cultivar (live):** `business_members.role` (text, free-form — comment "vertical defines role semantics") + `business_members.permissions` (jsonb array of permission-string IDs), `supabase/migrations/20260602_shared_members_a_create_tables.sql:22-42`. Roles are **hardcoded in TypeScript, not the DB**: `ROLES = ['OWNER','MANAGER','STAFF']` (`packages/cultivar-os/src/auth/roles.ts:24`) with `DEFAULT_PERMISSIONS` per role (`roles.ts:44-78`). **11 permissions** (7 ops + the 4 financial from shared `financialPermissions.ts`).
- **⚠️ Gap vs D-010:** the live set is **3 roles (OWNER/MANAGER/STAFF)**, NOT the doctrine's 5 (OWNER/MANAGER/TECH/SERVICE + customer-is-not-a-role). TECH and SERVICE/front-office are **DESIGNED-ONLY** in Cultivar; STAFF is the current catch-all.
- **Ignition (donor):** `shop_members.role` + `.permissions` (jsonb) + `sub_role` + `pin_hash` + `active` (`packages/ignition-os/supabase/migrations/20260603_recreate_shop_members.sql:28-42`). **4 role presets** ADMIN/TECH/SERVICE/CUSTOMER + **18 permissions** in 4 groups (`IgnitionAdmin.jsx:27-56`).

### 1.2 Three-tier storage — **DESIGNED-ONLY (tiers 2 & 3 have no schema)**
- **Tier 1 (shared system floor):** exists only as hardcoded TS/JS constants in each vertical; **no canonical DB table.** DESIGNED-ONLY as a platform artifact.
- **Tier 2 (per-tenant `(business_id, role_key)` override):** **ABSENT** — no migration, no row type.
- **Tier 3 (per-tenant custom role, clone-and-extend):** **ABSENT** — no schema, no clone UX. Custom roles cannot be created today; invitations (where they exist) assign a system role string only.
- Factory-reset-as-override-delete: not buildable yet (no tier-2 to delete).

### 1.3 Role-config UI — **Cultivar ABSENT · Ignition FULL (donor)**
- **Cultivar:** no role-admin console, no permission picker, no member-invite page (searched `packages/cultivar-os/src/pages/` — no *nvite*/*Role*/*Team* surface). ABSENT.
- **Ignition (donor, the rebuild template):** `IgnitionAdmin.jsx` — `AddStaffModal` (role dropdown + grouped permission checkboxes + apply-preset + PIN, `:196-337`) and `InviteStaffModal` (+ sub_role, team, token, SMS, `:341-600+`). ADMIN-gated. **Edits system roles IN PLACE — the exact pattern D-010 warns against (mutate, not clone)**; no tier-2/3.

### 1.4 READ enforcement — **Cultivar PROVEN (data + render) · Ignition render-only & BROKEN**
- **Cultivar data layer:** RLS via SECURITY-DEFINER primitives `is_active_member(business_id)` + `has_permission(business_id, perm)` (`20260622_is_active_member_canonical_rls.sql`, `20260622_oauth_secrets_relocation_and_cost_wall.sql:112-130`), gating 7 cost/wage tables. Read-wall HAR-proven (Gate 3). **PROVEN.**
- **Cultivar render layer:** `<PermissionRoute permission={VIEW_COSTS}>` (`router.tsx`) + the `can()` chokepoint in `BusinessProvider.tsx:346-353` (`isOwnerActive` short-circuit + `applyFinancialDependencies`). **PROVEN.**
- **Ignition (donor):** render-only AccessGatekeeper (`CoreApp.jsx`), **no RLS**, and **BROKEN** — a role-badge vs capability-string format collision means invited (capability-string) users expand to `[]` → Access Denied (agent-reported via TRACE logs). Do not port the enforcement; port only the console shape.

### 1.5 WRITE enforcement — see the dedicated **WRITE-WALL MAP** below (the Gate-3b worklist). Headline: anon-key writes gated by FOR ALL WITH CHECK (PROVEN-in-policy, write-side NOT tamper-proven); one service-key endpoint ungated.

### 1.6 Cruft to leave behind (Ignition donor) — **confirmed present**
- **Self-grant override:** `CoreApp.jsx:248-292` "Request Manager Override" → a PIN field that is **never validated**; clicking sets `overrideActive=true` → `hasAccess` true. Security theater. LEAVE BEHIND.
- **Dual-permission-map / format collision** (role-badge vs capability-string) — leave behind; Cultivar's single jsonb-array-of-permission-IDs is the clean form.
- **localStorage-cached permissions** — client-mutable; leave behind (Cultivar checks live + RLS).

### 1.7 Promoted or local — **SPLIT**
- **Promoted (shared):** `packages/shared/src/auth/permissions.ts` (`can`/`hasRole`/`expandRoles`/`deriveAllowed`) + `financialPermissions.ts` (the 4 financial constants + `financialDefaultsForRole` + `applyFinancialDependencies` dependency rule view_margin⊆view_costs). 
- **Local (per-vertical, by AC-1):** the role NAME sets + default-permission maps (`roles.ts` for Cultivar, `IgnitionAdmin.jsx` for Ignition). Mechanics shared; vocabularies local. Role Machine = **promote-the-mechanics + Cultivar-native rebuild of the console**, not a port of Ignition's role logic.

---

## AREA 2 — TILE REGISTRY / MODULE ECONOMY

- **2.1 Single registry? NO — three-list drift (PROVEN).** (1) Cultivar hardcoded `MODULE_META`/`MODULE_ORDER` (`packages/cultivar-os/src/hooks/useModules.ts:33-52`); (2) DB `business_modules` + `modules` canon (`20260604_business_modules.sql:21-30`, queried `useModules.ts:90-96`); (3) Ignition `AdminSubscription.jsx:29-40` localStorage subscription map. No `{key,label,group,required_permission}` unified shape; no automated sync. D-012 (single registry) is the fix.
- **2.2 Marketplace / "activate" — HALF-BUILT.** Cultivar: enable→navigate-to-setup, the setup page writes `business_modules.enabled/configured` (`Dashboard.tsx:383-408`, `Tile.tsx`); WORKS for enable, but no trial/marketplace. Ignition (donor): `startTrial()` flips localStorage to PRO + 30-day (`AdminSubscription.jsx:67-79`) — **localStorage only, no DB.** First-missing: a DB trial/subscription model.
- **2.3 Per-tile countdown w/ persisted end-date — HALF-BUILT (Ignition localStorage) / Cultivar ABSENT.** `calculateDaysLeft` reads `trialStartedAt` from DataBridge (`AdminSubscription.jsx:81-87`). **`business_modules` has NO `trial_started_at`/`trial_ends_at`/`tier` columns** → D-013's "stored end-date, not a client timer" needs schema.
- **2.4 Fuzzy/blur on lapse — ABSENT** (no lapse detection or blur anywhere). D-013 greenfield.
- **2.5 Activation authority distinct from visibility — FUSED (ABSENT as a separate axis).** `TileState = active|available|locked` conflates see-vs-can-activate (`useModules.ts`, `Tile.tsx`). D-011's two-axis split is unbuilt.

---

## AREA 3 — STRIPE / BILLING + costDiscovery

- **3.1 `shared/stripe/billing.ts` + `trial.ts` — ABSENT** (verified: `ls packages/shared/src/stripe/` → no such dir; only `supabase/types.ts` carries `stripe_customer_id`/`stripe_subscription_id` columns). See code-wins correction #3. The marketplace money axis is a BUILD.
- **3.2 Billing per-business vs per-module — DESIGNED-ONLY.** `businesses.stripe_*` columns exist; no per-module billing scaffold; no Stripe keys in env (CLAUDE.md). Gap: everything past the schema columns.
- **3.3 costDiscovery — PROVEN HALF-BUILT (banked `219e264`).** `packages/shared/src/discovery/costDiscovery.ts` (engine, 26-test BUILDER-COMPLETE) + `api/discovery/ingest.ts` action `cost-apply` → `applyCostReasoning` writes `business_inventory.unit_cost` via **service key, no caller check**. This IS the write-wall instance to gate in Gate-3b — built-bit-awaiting-test, do not re-discover.

---

## AREA 4 — CUSTOMER + DOCUMENT SIGNING

- **4.1 Customer = ENTITY, not a role — PROVEN.** Cultivar `customers` table (entity; `api/customers/create.ts`, `customerUpsert.ts`); `ROLES` has no CUSTOMER (`roles.ts:24`). Ignition donor has a **vestigial CUSTOMER role** in `ROLE_PRESETS` (`IgnitionAdmin.jsx`) — exactly the "left behind" D-014 calls out.
- **4.2 Operational dependence on customer-as-role — ABSENT in Cultivar** (no kiosk/sign needing a customer member session). Unwind cost ≈ 0 for Cultivar; the only customer-role artifact is donor-side. 
- **4.3 Kiosk / estimate-approval / sign auth path — ABSENT in Cultivar** (no token/link, no signed-doc table; checkout is owner/RLS). Ignition's estimate flow is dead legacy (CAI archive / Railway). D-014's per-doc channel-validated link is **greenfield**.
- **4.4 Channel validation — ABSENT + a real blocker.** No SMS provider; **Supabase email confirmation is OFF because outbound mail is broken** (CLAUDE.md §2 launch gate). D-014's "validate the channel once" is hard-blocked on the SMTP launch gate.
- **4.5 Signing record snapshot/hash — ABSENT (SMOKE-vs-SOLID flag).** No `signatures`/`signed_documents`/`estimate_approvals` table in any migration. `order_compliance_records` captures the *decision* (netting/waiver) — not a signatory identity or a content snapshot/hash. **D-014's "bound record = content snapshot/hash of exactly what was shown" must be architected before any build** — building signing against a live, mutable estimate would be legally undefendable.
- **4.6 Signature capture UX — ABSENT.** 4.7 **Link single-use/expiry — ABSENT** (no link exists). D-014 is entirely greenfield; the discipline (snapshot+hash, proof-proportionate, ESIGN-optional) is the spec, code is zero.

---

## AREA 5 — IDENTITY HEADER + LEXICON

- **5.1 Persistent identity header — Ignition WIRED (donor) · Cultivar ABSENT (= verify-universals cap #1 FAIL).** Ignition `ShopBanner` (`CoreApp.jsx:514-522`) is mounted in the persistent shell across all tabs. Cultivar: `PrivateRoute` → shared `configureAuth.tsx` renders a **bare `<Outlet/>`**; `NavBar.tsx` shows only back-links/`title`, holds no context identity; `BusinessProvider` has identity in context only. **Portable: YES, LOW complexity** — mount a shared `<AppHeader>` reading `useBusinessContext()` in the PrivateRoute layout. This is the concrete close for cap #1.
- **5.2 Lexicon (db_name vs display label) — PARTIAL / DESIGNED-ONLY for the general layer.** Per-vertical role labels exist + are wired (`roles.ts:79-90` `ROLE_LABELS`/`ROLE_DESCRIPTIONS`); but **no shared `VerticalLexicon`** maps a role key (`front_office`) to per-vertical display ("Service Writer"/"Counter"). D-010/D-014's Lexicon display layer is designed-only.

---

## CROSS-CUTTING (answered once) — both ✅, no regression

- **C1 Multi-tenancy join key — PROVEN per-(person, business); NO global owner flag.** `BusinessProvider.tsx:242-269` resolves ALL `business_members` rows for `auth.uid()`; `isOwnerActive` is scoped to the *active* business (`:344`); `can()` reads the active business's permissions (`:346-353`); RLS keys every policy on `is_active_member(business_id)`. No `is_owner` global, no JWT/cookie owner claim. Cross-tenant authority leak risk: none.
- **C2 In-flight authority — PROVEN live-checked; NOT claim-trust.** `has_permission()` is SECURITY DEFINER reading `business_members.permissions` **live at query time** (`20260622_oauth_secrets_relocation_and_cost_wall.sql:112-130`); `BusinessProvider` re-resolves on mount + on `onAuthStateChange`; **no permission is baked into the Supabase JWT** (auth returns id+email only). Answers David's note: we did **not** regress to stale-session claim-trust — grant/revoke is effective live on the next action.

---

## PORT TABLE — Ignition donor assets worth keeping

| Asset (Ignition donor) | Build-state | Shared-or-local | Proposed Cultivar-native target + RLS | Port-or-rebuild |
|---|---|---|---|---|
| `ShopBanner` identity strip (`CoreApp.jsx:514-522`) | WIRED (donor) | local | Shared `<AppHeader>` mounted in PrivateRoute; reads `useBusinessContext()`; no DB write (context only) → no RLS | **Port (shape) → shared** (closes cap #1) |
| Role-admin console `AddStaffModal`/`InviteStaffModal` (`IgnitionAdmin.jsx:196-600`) | WIRED but mutates-in-place (donor) | local | Cultivar role-config UI writing tier-2 override + tier-3 custom rows; RLS owner+`is_active_member` + `manage_settings`/role-admin perm; tenant-private (AC-3) | **Rebuild** (D-010 clone-not-mutate; don't carry the in-place edit) |
| Permission picker (grouped checkboxes, apply-preset) | WIRED (donor) | local | Cultivar picker fed by the single tile registry (`required_permission` auto-listed) | **Rebuild on D-012 registry** |
| `AdminSubscription` trial/marketplace (`AdminSubscription.jsx`) | HALF-BUILT, localStorage (donor) | local | DB-backed `business_modules` + trial columns (end-date persisted); fuzzy-on-lapse; activation-authority perm distinct from visibility | **Rebuild** (D-011/D-013; localStorage→DB) |
| AccessGatekeeper (render-only, broken collision, self-grant override) | BROKEN (donor) | local | — (Cultivar already has RLS + `can()`/PermissionRoute) | **Leave behind** (cruft) |
| `shop_members` schema (role/permissions/sub_role/active) | donor schema | local | Cultivar `business_members` already equivalent (+ canonical `is_active_member`) | **No port** (already have the better form) |

---

## WRITE-WALL MAP — the Gate-3b worklist (corrected by the policy SQL)

**Policy fact (verified, `20260622_oauth_secrets_relocation_and_cost_wall.sql:141-212`):** `cost_objects`, `business_inventory`, `cost_object_edges`, `cost_object_assignments`, `business_service_log`, `receipts` (view_costs); `labor_resources`, `labor_resource_wages` (view_wages); `business_pricing_config` (view_pricing_config) — each member policy is **FOR ALL** with `is_active_member AND has_permission` in **USING and WITH CHECK**. ⇒ INSERT/UPDATE/DELETE by a member lacking the permission is RLS-refused.

| Write path (file:line) | Target | Anon-RLS or service-key | Caller perm check? | RLS write gate (WITH CHECK) | Verdict |
|---|---|---|---|---|---|
| `OperatingCosts.tsx:313 insert` / `:202-204 update` / `:256 delete` | cost_objects (COST) | anon-RLS | none (render: route is PermissionRoute-wrapped, Part A) | `is_active_member AND has_permission('view_costs')` | **GATED at RLS** (write-tamper UNPROVEN) |
| `BusinessAssets.tsx:269 insert` / `:196-198 update` | cost_objects (ASSET) | anon-RLS | none | view_costs | **GATED at RLS** (unproven) |
| `CostToProduceSettings.tsx:395/398/407` | cost_objects (labor) | anon-RLS | none | view_costs | **GATED at RLS** (unproven) |
| `CostToProduceSettings.tsx:408 delete` | labor_resources | anon-RLS | none | view_wages | **GATED at RLS** (unproven) |
| `CostToProduceSettings.tsx:426 writePricingConfig` | business_pricing_config | anon-RLS | none | view_pricing_config | **GATED at RLS** (unproven) |
| `BusinessInventory.tsx:168 insert` | business_inventory | anon-RLS | none | view_costs | **GATED at RLS** (unproven) |
| **`api/discovery/ingest.ts` (cost-apply) → `applyCostReasoning`** | business_inventory.unit_cost | **SERVICE KEY** | **none** | RLS **bypassed** | **🔴 UNGATED — the one real hole** |

**Gate-3b worklist (priority order):**
1. **🔴 HIGH — gate the service-key `cost-apply` endpoint.** Add a caller permission check (resolve the caller's session/membership and require `view_costs` before `applyCostReasoning`), or route the write through the anon/RLS path instead of the service key. This is the only write that actually bypasses the wall. (costDiscovery `219e264`, tech-debt #46, D-015.)
2. **🟡 MED — prove the write side (it's structurally present, never tamper-tested).** A Role-Machine role-driven assertion (or a write-HAR): a no-`view_costs` member's INSERT/UPDATE to cost tables is refused (`42501`/zero rows), the twin of the read-HAR's `200 []`. This flips verify-universals assertion **(h)** from EXPECTED-FAIL to live-assert. (The read-wall was proven; the write-wall WITH CHECK was not.)
3. **🟢 LOW — render-layer button gates (defense-in-depth/UX).** Add `can(VIEW_COSTS)` gating to the +cost/+asset/labor/pricing save surfaces so a no-permission user never sees a control that RLS will reject anyway, and confirm Part A (route gates) is actually deployed. Not the boundary — RLS is.

---

## DAVID'S TRAIL — "looks built" vs "actually reachable / proven now"

- **Cost READ wall:** looks built ✅ and **is** — RLS + render, HAR-proven on SELECT (`200 []`, tamper 3/0). Reachable + proven. *(Read side only.)*
- **Cost WRITE wall:** looks open (per D-015/#46) but the **anon-key write-wall is actually present** in policy (FOR ALL WITH CHECK) — yet **never tamper-proven on writes**, so its true status is *built-but-unproven*. The **service-key `cost-apply` endpoint is genuinely open**. Net: Gate-3b is smaller than feared (1 endpoint to gate + 1 proof to run), not "build the whole write-wall."
- **Phase 3 Part A (route render gates):** committed (`8918fe8`) but **owner-proof owed-after-deploy** — code-present, not confirmed live. Don't count it as the boundary.
- **costDiscovery:** looks built (26 tests) but **HALF-BUILT** — service-key write-wall hole; live proof unrun; not owner-proven. Banked `219e264`.
- **Role engine (3-tier, custom roles, role-config UI):** **DESIGNED-ONLY** in Cultivar (D-010..D-012). The DB stores `role`+`permissions` and READ enforcement is real; everything about *managing* roles (override/custom/console) is unbuilt. Ignition has the console shape to rebuild from (clone-not-mutate).
- **Tile registry / marketplace / trial / fuzzy / activation-authority:** **mostly ABSENT/DESIGNED-ONLY** (three-list drift today; no DB trial columns; no fuzzy; visibility/activation fused; **no `shared/stripe/`**). D-011/D-012/D-013 are greenfield; the built-inventory "reuse stripe" seed is wrong (correction #3).
- **Identity header (cap #1):** ABSENT in Cultivar, donor `ShopBanner` is a clean low-cost port. Concrete, ready.
- **Customer + signing (D-014):** customer-as-entity ✅ correct; everything signing-related is **ABSENT/greenfield**, gated behind the broken-SMTP launch gate; the snapshot/hash discipline must be designed before build (smoke risk).
- **Multi-tenant correctness (C1/C2):** ✅ genuinely sound — per-(person,business) authority, live-checked, no JWT claim-trust. The foundation the Role Machine builds on is solid.

**Bench stand-up, shortest path:** (1) gate the `cost-apply` endpoint + run the write-side tamper proof (closes the real Gate-3b hole and flips assertion (h)); (2) port `ShopBanner`→shared `<AppHeader>` (closes cap #1); (3) build the single tile registry (D-012) — it unlocks the role-config picker and the marketplace at once; (4) add tier-2/tier-3 role schema + Cultivar-native console (rebuild from Ignition, clone-not-mutate). Stripe/trial/fuzzy + signing are later, greenfield, and each has a named gate.

---

*Recon only. Nothing else changed. `[TRACE:*]` stays ON.*
