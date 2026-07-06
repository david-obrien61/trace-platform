# THUNDER RECON — Role-config + Discovery engine (verify-first, READ-ONLY)

**Date:** 2026-06-21
**Nature:** Verify-first recon. READ-ONLY — no code, schema, migrations, or build. Two-bar/RLS gates N/A (nothing built).
**Repo is authority.** Every finding below is grounded in live repo `file:line` evidence; where recall and code disagreed, the code won.
**Decides:** whether two pending builds (mobile role→field visibility; cost-discovery-on-Opus) are "small/additive" or "bigger than they look."

---

## BOTTOM LINE (both forks, one glance)

| Fork | Question it gates | World we're in | SIZE READ |
|---|---|---|---|
| **A — Role→FIELD visibility** | Mobile-roles build (Lauren adds a field to her own view) | **Config does NOT exist** (only role→TILE). Identity is **shared-spine**; enforcement is **render-only, no RLS by role.** | **Additive schema (small), but the REAL cost is two new layers that don't exist: an owner-facing config UI + role-aware RLS. Bigger than a column.** |
| **B — Cost-discovery-on-Opus** | Item 4 (cost question flow → `business_inventory` cost + confidence) | Discovery is **LIVE**, multi-capability, already routes per-capability models. It is **hard-wired AWAY from cost** (cost_confidence locked to `'UNKNOWN'` by construction). | **Mostly WIRING + ~one new extraction capability. No schema change, no new table, routing already works. ~275 LOC. Small-to-moderate.** |

**One-line each:**
- **Fork A is the bigger of the two** — not because the schema is hard (it's a column), but because the two things that make it *real* (an owner UI to edit it, and a data-layer wall that actually refuses to send hidden fields) are both **net-new and currently absent**. Today's role system hides tiles in the browser; it does not hide fields, and it does not hide anything at the data layer.
- **Fork B is the smaller of the two** — the engine, the model-routing, the honesty framework, and the write target all already exist. What's missing is a cost-estimation prompt/capability and the wiring to aim it at the cost columns (which exist and are currently pinned to UNKNOWN on purpose).

---

# FORK A — ROLE → FIELD VISIBILITY CONFIG

> Gates the mobile-roles build. The design session assumed a role→field config exists or is close. **It does not.**

## A1 — Does a role→FIELD visibility config exist, or only role→TILE?

**FINDING: Only role→TILE / role→TASK. No per-field visibility config exists anywhere** (searched Cultivar, Ignition, shared, and all migrations for `field_visibility`, `canViewField`, `per_field`, `mobile_visible`, `can_view` — zero hits).

What exists is **role → permission-string array**, where every permission is a **task/feature name**, never a field name:

- **Storage (shared spine):** `business_members.permissions` is a JSONB array; `business_members.role` is free-form text.
  `supabase/migrations/20260602_shared_members_a_create_tables.sql:32,35`
  ```sql
  role text not null,                         -- "vertical defines role semantics… free-form string, not enum"
  permissions jsonb not null default '[]'::jsonb
  ```
- **Cultivar role→permission map (hardcoded TS, no UI):** `packages/cultivar-os/src/auth/roles.ts:26-51`
  ```ts
  export const DEFAULT_PERMISSIONS: Record<CultivarRole, string[]> = {
    OWNER:   ['view_dashboard','qr_checkout','view_orders','manage_deliveries','manage_customers','manage_campaigns','view_reports','manage_settings'],
    MANAGER: ['view_dashboard','qr_checkout','view_orders','manage_deliveries','manage_customers','manage_campaigns','view_reports'],
    STAFF:   ['view_dashboard','qr_checkout','view_orders'],
  };
  ```
- **Ignition role→permission map (hardcoded JS):** `packages/ignition-os/CoreApp.jsx` (~860–870) — `TECH`/`SERVICE` get arrays like `['view_hub','view_flux',…]`.
- **Shared framework:** `packages/shared/src/auth/permissions.ts:44-67` — `PermissionPolicy = { roles: Record<string,string[]> }` and `can()` just does `session.permissions.includes(id)`. **No field-level concept in the type.**

**World we're in:** the unit of access is a *task name* (`manage_settings`, `view_orders`), not a *field name* (`netting_price`, `cost`). A mobile field-visibility build cannot extend an existing field config — **there is none to extend.**

## A2 — Owner-editable through a real UI, or seed/admin/DB-only?

**FINDING: NOT owner-editable. There is no permission/role-config UI at all.** An owner can *invite* a member and pick a *pre-defined* role, but cannot customize what any role can see.

- `packages/cultivar-os/src/pages/Settings.tsx:120-476` — team section shows member list + invite form. The invite assigns `permissions: DEFAULT_PERMISSIONS[inviteRole]` (`:181`) — the default is applied silently, never surfaced or editable.
- No `/permissions`, `/role-config`, or `*RoleConfig*`/`*Permission*` editor component exists (searched).
- Ignition: roles/permissions are baked into the join-flow code (`CoreApp.jsx`), written to DataBridge/localStorage; no edit surface.

**World we're in:** "Lauren adds a field to her own mobile view" has **no surface to do it through today.** That surface is net-new.

## A3 — PROMOTION STATE (the key fork): shared-spine or Ignition-local?

**FINDING: SPLIT-BRAIN. Identity/role storage is SHARED (promoted to `business_members`, usable by Cultivar). Enforcement is still render-only and Ignition-LOCAL in spirit (no RLS, no data-layer wall).**

- **Shared (promoted):** `business_members {role, permissions}` lives in the Cultivar Supabase project (`bgobkjcopcxusjsetfob`), with RLS, since 2026-06-02. Cultivar reads it via `packages/shared/src/auth/members.ts`. So the *who-has-what-role* spine IS shared.
- **NOT promoted:** Ignition still uses its PIN/DataBridge/localStorage model on the old project (`ufsgqckbxdtwviqjjtos`) — it does **not** consume `business_members` yet.
- **Enforcement is render-only everywhere** (see A5) — no policy reads `role`/`permissions`.

**World we're in — and what it means for size:**
- The *config storage* lives in the right place already (shared `business_members`), so **a "mobile-visible" flag does NOT require a promote-to-shared project first.** That's the good news, and it's the answer the design session needed: **we are in the shared-spine world for storage.**
- BUT enforcement being render-only (A5) means the build's hard part is not storage. It's building the *wall* that doesn't exist yet.

## A4 — Can the model carry a per-role-per-field "mobile-visible" flag ADDITIVELY?

**FINDING: YES — schema-wise this is ADDITIVE (small). `business_members` is text + JSONB and append-only migrations make it trivial.** The current shape does **not** force a restructure.

Options (cheapest-meets-need → fullest):
- **NEED (cheapest):** add a `field_visibility jsonb` column to `business_members` (or a `business`-level role-config blob), shape e.g. `{ "netting_price": ["MANAGER","OWNER"], "cost": ["OWNER"] }`. One migration, one column.
- **WANT (cleaner):** a small `role_field_visibility` table keyed `(business_id, role, field_key, surface)` — normalized, queryable, RLS-friendly. Still additive; no existing table changes shape.

**Size read (schema only): SMALL / additive.** No rename, no normalization of existing data, no destructive change.

**Caveat that makes the *build* bigger than the column:** a flag is inert without (1) a reader that gates fields by it and (2) ideally a data-layer enforcer. Those are A2 (UI) and A5 (RLS) — both net-new.

## A5 — Enforcement at the DATA layer (RLS/API refuses to SEND) or only at RENDER?

**FINDING: RENDER LAYER ONLY. Zero RLS or API gating by role. RLS is tenant-scoped (`business_id`), never role-scoped.**

- RLS policies check only tenancy, never role:
  `supabase/migrations/20260602_shared_members_a_create_tables.sql:47-61` — `bm_owner_all` uses `business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())`; `bm_self_select` uses `user_id = auth.uid()`. **No `role`/`permissions` in any USING/WITH CHECK clause** — and this pattern holds across the migration set.
- Cultivar gates in React only: `packages/cultivar-os/src/pages/Settings.tsx:480` — `const canManageSettings = isOwner || (userPermissions ?? []).includes('manage_settings'); if (!canManageSettings) return <AccessDenied/>;`. The DB still allows the query; the browser hides the page.
- API routes (e.g. `api/members/invite.ts`, `api/customers/create.ts`) gate by tenancy/RLS, not by role — a STAFF token hitting the API directly receives the same columns a MANAGER would.

**World we're in:** today the "wall" is a browser render check. **The design intent ("mobile field-hiding must be focus-only; the real wall is the data-layer ceiling") is NOT met today for ANY field.** Making the ceiling real means adding role-aware SELECT policies (or column-filtering at the API), which is the same gap for every field — not specific to mobile.

## FORK A — three-lens size read

- **HAVE:** shared `business_members {role, permissions}` (text+jsonb, RLS by tenant), hardcoded role→task maps (`roles.ts`, `CoreApp.jsx`), render-only enforcement, invite-only UI. No field config, no field UI, no role-aware RLS.
- **NEED (to ship mobile role→field hiding as *focus-only*, render-layer):** 1 additive column/table for `field_visibility` + a reader in the mobile render path + a minimal owner UI to toggle fields per role. **Small-to-moderate.** This matches the design-session "small" intuition **only if "focus-only" is acceptable** and the wall stays render-level.
- **WANT (the stated intent — the wall is the data-layer ceiling):** all of NEED **plus** role-aware RLS/API column-gating so hidden fields are never sent. **That is the big, currently-absent piece** — net-new role-scoped policies across the tables in question, and it's a platform-wide enforcement change, not a mobile feature. **Restructure-of-enforcement, not of schema.**

**Verdict for sequencing:** the *flag* is additive/small. The *build* is "small" only at focus-only altitude; "make the wall real" is a separate, larger, platform-level enforcement build that does not exist in any form today.

---

# FORK B — DISCOVERY ENGINE + AI ROUTING

> Gates cost-discovery / item 4.

## B1 — What IS the discovery engine today?

**FINDING: A LIVE, multi-capability engine** (not a scaffold) in `packages/shared/src/discovery/` (6 modules) + endpoint `packages/cultivar-os/api/discovery/ingest.ts`.

- `engine.ts` — two-pass identity (Haiku) + analysis (Sonnet).
- `catalog.ts` — website crawl → variety extraction → dedup/flag (Haiku, capability `discovery_catalog`).
- `populate.ts` — orchestrates catalog → `business_inventory` write + honesty flagging.
- `compare.ts` — entered-vs-site discrepancy detection (Sonnet, `discovery_compare`).
- `synthesis.ts` / `seed.ts` — email synthesis; service-offering seeding (orphaned/read-only, tech-debt #21).

**What it populates today:**
- `business_inventory` (LIVE, capability 1.3): `name`/`description`/`sku` (`DISC-` prefix)/`qty=0`/`unit_cost=null`/**`cost_confidence='UNKNOWN'`**/`status`/`notes`. `populate.ts:78-98`.
- `business_discovery_profiles` (audit table, gated migration `20260621`): `business_id`/`source_url`/`status`/`raw_extract` jsonb/`extracted_at`. `populate.ts:170-189`.

**World we're in:** the engine is real and already writes to the very table cost would live in (`business_inventory`) — but it writes cost as a deliberate `UNKNOWN` blank.

## B2 — Can it be AIMED AT COST?

**FINDING: NOT today — it is hard-wired AWAY from cost by construction.** The catalog extractor is explicitly forbidden to emit prices, and the inventory writer pins `cost_confidence='UNKNOWN'`, `unit_cost=null` unconditionally (the D-9 honesty gate: refuse to write `0`, which reads as "free").

- `catalog.ts:203-234` (`CATALOG_SYSTEM` prompt): *"Never report a price, a quantity, or a stock number…"*
- `catalog.ts:280-301` (`mapRawToCatalogItem`): `const unit_cost = null; const cost_confidence = 'UNKNOWN';`
- `engine.ts` identity/analysis return business identity/services/`pricingVisible` (a boolean) — **no cost fields**; `compare.ts:36-46` checks identity fields only.

**World we're in:** cost is not a target the engine is wired to — it's a target the engine is *deliberately blank on*. Aiming at cost = a new extraction intent, not a re-pointing of an existing one. (The columns themselves — `business_inventory.unit_cost`, `cost_confidence` — already exist, D-5/`20260612`, so the *write target* is ready.)

## B3 — AIEngine routing: can a feature be routed to a specific model (Opus)?

**FINDING: YES — routing is per-capability, with a per-business override. Model choice is NOT global-only.**

Two systems exist; discovery uses the modern one:
- **TRACE (modern, used by discovery):** `packages/shared/src/ai/capabilities.ts:11-19` maps each capability → `{provider, model, maxTokens}`:
  ```ts
  discovery_identity: { model: 'claude-haiku-4-5-20251001', … },
  discovery_analysis: { model: 'claude-sonnet-4-6', … },
  discovery_compare:  { model: 'claude-sonnet-4-6', … },
  discovery_catalog:  { model: 'claude-haiku-4-5-20251001', … },
  ```
  Selection logic `packages/shared/src/ai/execute.ts:26-50`: looks up `CAPABILITIES[key]`, then checks `business_modules.config.model` for a **per-business override**, else falls back to the capability default. `[TRACE:ai]` logs `capability`/`model`/`source`.
- **Ignition AIEngine (legacy, NOT used by discovery):** `packages/shared/src/ai/AIEngine.ts:33-58` — hardcoded `TASK_ROUTING` (vin_decode→gemini, dtc_decode→haiku…) through a FastAPI backend; per-call `_override_model` but no stored per-business config.

**How a model is selected today:** per-capability default in `CAPABILITIES`, overridable per-business via a `business_modules` row `config: { model: "<id>" }`. **Routing Opus to a cost capability is a one-line registry entry** (use the current Opus id `claude-opus-4-8`, not the legacy `claude-opus-4-1-*` an agent guessed — verify against the project's model constants before wiring).

## B4 — GAP STATEMENT: what's missing for cost-discovery-on-Opus — wiring or new capability?

**FINDING: Mostly WIRING + one new extraction capability. No schema change, no new table, routing already works.**

| # | Piece | Wiring vs New | Size |
|---|---|---|---|
| 1 | `discovery_cost_estimate` entry in `CAPABILITIES` → model `claude-opus-4-8` | WIRING (config) | ~5 LOC |
| 2 | `discovery/cost.ts` — `estimateCatalogCost()` extraction prompt + D-9 honesty gates (mirror `catalog.ts`) | **NEW CAPABILITY** | ~150 LOC |
| 3 | Carry cost on `CatalogItem` (or a parallel return) | WIRING | ~20 LOC |
| 4 | `catalogItemToInventoryRow()` accept + write `unit_cost`/`cost_confidence` (instead of hardcoded UNKNOWN) | SMALL WIRING | small |
| 5 | `populateCatalog()` orchestration: run cost pass after `extractCatalog()` | SMALL WIRING | small |
| 6 | (optional) endpoint flag `?include-cost=true` on `ingest.ts` | WIRING | small |

**Already exists (no build):** per-capability + per-business model routing; the capability registry; the D-9 honesty framework (confidence threshold, flag, never fabricate); the write target (`business_inventory.unit_cost` + `cost_confidence`, columns live); the populate flow (crawl→extract→clear→insert→profile-persist).

**Missing (name only, not building):** a **cost-estimation capability** (prompt + logic) and the **orchestration** to run it against the cost columns (which are currently pinned to `UNKNOWN` on purpose).

**SIZE READ: small-to-moderate (~275 LOC), additive.** The honesty contract (D-9) is the design risk, not the plumbing: an AI *estimating* cost must write `ESTIMATED`/`DERIVED` confidence honestly and never masquerade a guess as `CONFIRMED` — that's a prompt/gate-design problem, not a wiring problem.

---

## CROSS-FORK NOTE FOR SEQUENCING

- **Fork B (cost-discovery-on-Opus) is the cheaper, lower-risk build** — the spine, routing, and target all exist; it's additive wiring plus one honest extraction capability.
- **Fork A (mobile role→field) is the heavier build, and the heaviness is hidden.** The flag is a column; the *value* of the feature depends on two layers that don't exist: an owner-facing role-config UI (A2) and a data-layer wall (A5). If "focus-only / render-level" is acceptable for v1, Fork A is moderate. If the stated intent ("the real wall is the ceiling, data-layer") must hold, Fork A grows a platform-wide RLS/role-enforcement sub-build that touches every gated table — **bigger than it looks.**

---

*Recon only. No code, schema, migration, or build produced. No built-inventory change (nothing built). READ-ONLY honored throughout — where a test would have required mutating state, the finding was read from source instead.*
