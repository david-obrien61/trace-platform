# THUNDER RECON — Role-enforcement ground truth (verify-first, READ-ONLY, platform-wide)

**Date:** 2026-06-21
**Nature:** Verify-first recon. READ-ONLY — no code, schema, migration, design, or build. Two-bar / RLS gates N/A (nothing built).
**Repo + live migration source are authority.** Every finding is grounded in `file:line`. Where intent is read from how code/UI behaves rather than stated, it is labeled **(inferred)**.
**Decides nothing.** This establishes what is TRUE about role-level data access today so a future "role wall" can be poured once — not over-blocking (breaks working features) nor under-blocking (misses a column and looks solved). It does NOT pick the fix.
**Supersedes scope of:** `role-and-discovery-recon.md` Fork A5 — confirms A5 platform-wide and adds the column-level map A5 did not carry.

---

## BOTTOM LINE (one glance)

| Question | Ground truth |
|---|---|
| **Where does role/permission live?** | `business_members.role` (text) + `business_members.permissions` (jsonb array of **task-name** strings). One shared spine table. Resolved into React context (`userPermissions`/`isOwner`), then checked by scattered `.includes()` — **never at the data layer.** |
| **Is there ANY role-scoped enforcement?** | **NO.** 22+ RLS policies across every migration are **uniformly tenant-scoped** (`business_id` owner-or-active-member). Zero reference `role` or `permissions`. The only render gate that actually fires is `manage_settings` on `/settings` + the dashboard settings button. Every other permission string is a **placeholder** — defined, assigned, never enforced. |
| **What would a data-layer wall protect?** | ~26 role-sensitive columns across 6 tables (cost / margin-inputs / confidence / receipt links / **HR wage+burden+bill-rate** / the entire pricing `config` blob). All currently readable+writable by ANY active member, including STAFF. |
| **What would a sudden wall BREAK?** | 14 unfiltered read sites, **all multi-role** (same SELECT serves owner+manager+staff, sometimes public checkout). A flat role-scoped block on cost columns breaks `/costs`, `/inventory`, `/assets`, the dashboard inventory metric + `/api/dashboard`, and the Settings cost editor — for any non-owner — and can NULL the public checkout subtotal. The build is complete-in-one-pass only if it shapes these, not flat-blocks them. |
| **Mechanisms available** | Two genuine families: (1) **role-aware RLS** reading the JSONB permissions at the DB; (2) **permission-checked render/API gates** keeping RLS tenant-only. Both feasible; both enumerated below. **Not chosen here.** |

**Headline:** The role system today is **render-only and largely aspirational.** Identity/role *storage* is real and shared; *enforcement* is one working render gate plus seven permission strings that gate nothing. There is no data-layer role wall anywhere, and the columns that most need one (cost, pricing config, HR wages) are the ones a seasonal STAFF login can read in full today.

---

## 1. SOURCE OF TRUTH FOR ROLE / PERMISSION

### 1.1 Storage shape — confirmed

`business_members` is the single shared spine (Cultivar Supabase project `bgobkjcopcxusjsetfob`, live since 2026-06-02).

- `role text NOT NULL` — free-form, "vertical defines role semantics… not enum"
  `supabase/migrations/20260602_shared_members_a_create_tables.sql:32-34`
- `permissions jsonb NOT NULL DEFAULT '[]'::jsonb` — "array of permission string IDs; vertical defines what each means"
  `supabase/migrations/20260602_shared_members_a_create_tables.sql:35-36`
- `pin_hash text` (nullable) — SHA-256 of `"{business_id}:{pin}"`, added `20260603_business_members_add_pin_hash.sql:28-29`
- TS shape: `Member { role: Role; permissions: string[] }` — `packages/shared/src/auth/types.ts:7-20`

**The unit of access is a task NAME (`manage_settings`, `view_orders`), never a field name.** There is no `field_visibility`, `can_view_column`, or per-column concept anywhere in schema or code (confirmed by the prior A1/A4 search and re-confirmed here).

### 1.2 Full permission-string set (the entire vocabulary that exists today)

**Cultivar** — `packages/cultivar-os/src/auth/roles.ts:15-51` (8 strings):
`view_dashboard`, `qr_checkout`, `view_orders`, `manage_deliveries`, `manage_customers`, `manage_campaigns`, `view_reports`, `manage_settings`.
Bundles: OWNER = all 8 · MANAGER = all except `manage_settings` · STAFF = `view_dashboard`,`qr_checkout`,`view_orders`.

**Ignition** — `packages/ignition-os/modules/IgnitionAdmin.jsx:28-54` + `CoreApp.jsx:252-255` (catalog of ~22):
view-strings `view_omni`,`view_hub`,`view_flux`,`view_cipher`,`view_stok`,`view_proc`,`view_prot`,`view_port`,`view_crm`,`view_predictive`,`view_marketplace`; action `manage_users`,`scan_parts`,`update_flux`,`sign_estimates`,`pay_invoice`; special `edit_margins`,`PRICING_AUTHORITY`,`approve_payroll`.
Bundles: ADMIN(all) · TECH(`view_hub`,`view_flux`,`view_cipher`,`view_stok`,`scan_parts`,`update_flux`) · SERVICE(`view_port`,`view_crm`,`view_cipher`,`view_stok`,`sign_estimates`) · CUSTOMER(`view_port`,`sign_estimates`,`pay_invoice`).

**Note (inferred):** Ignition carries the only *finance-sensitive* permission strings that exist (`edit_margins`, `PRICING_AUTHORITY`, `view_prot` = margins module) — but Ignition enforcement is local/PIN/DataBridge, not on the shared spine, and even there it is render-only. Cultivar has **no cost/finance permission string at all** — `view_reports` is the closest, and it is unenforced.

### 1.3 How a request resolves "what may this member do"

**Cultivar (the live shared path):**
1. `packages/shared/src/context/BusinessProvider.tsx:232-262` — queries `business_members` by `user_id`, `active=true`, selecting `business_id, role, permissions, businesses(*)`.
2. Exposes `userPermissions` (string[] | null) + `isOwner` on the context — `BusinessProvider.tsx:346-347`.
3. Call sites read context and do an inline `.includes()`.

**Ignition (legacy, separate):** PIN → `shop_members`/DataBridge → `current_user.permissions` in localStorage (`packages/shared/src/supabase/auth.ts:124-155`, `DataBridge.js:807-814`), gated in `CoreApp.jsx` `AccessGatekeeper` (`:467,473-474`).

**Shared pure helpers exist but are essentially unused:**
- `checkPermission(permissions, name)` → `permissions.includes(name)` — `packages/shared/src/auth/members.ts:52`
- `can(session, id)` → `session?.permissions.includes(id) ?? false` — `packages/shared/src/auth/permissions.ts:66`
Both are defined; **neither is called by the live Cultivar gates**, which inline the check instead.

### 1.4 Is resolution consistent or scattered? — SCATTERED

There is **no centralized permission engine.** Three coexisting patterns:
- **Inline `.includes()`** (dominant) — every real gate.
- **Pure helpers** `can()` / `checkPermission()` — defined, not wired in.
- **Ignition `rolesRegistry` expansion** (`CoreApp.jsx:467`) — partially BROKEN: assumes permissions are role-badge names (`ADMIN`), silently yields `[]` when they are capability-strings (`view_*`); a runtime format-sniff (`:473`, `startsWith('view_')`) and a dual-check workaround (`IgnitionAdmin.jsx:1630`, checks both `'ADMIN'` and `'manage_users'`) paper over it.

**Every distinct check site (the complete list):**

| File:line | Gates |
|---|---|
| `cultivar-os/src/pages/Dashboard.tsx:82-83` | `canManageSettings = isOwner \|\| userPermissions.includes('manage_settings')` → settings button + owner-only tiles (`:471,483,495,561`) |
| `cultivar-os/src/pages/Settings.tsx:533-541` | same `canManageSettings`; non-managers redirected to `/dashboard` — **the one fully-enforced gate** |
| `shared/src/auth/members.ts:52` | `checkPermission` helper (unused by live gates) |
| `shared/src/auth/permissions.ts:66` | `can()` helper (unused by live gates) |
| `shared/src/auth/invitations.ts:59` | writes `permissions` on invite |
| `shared/src/context/BusinessProvider.tsx:260` | populates `permissions` into context |
| `shared/src/supabase/auth.ts:147-149` | Ignition `allowed` derivation (strip `view_`) |
| `ignition-os/CoreApp.jsx:117,268,467,473,592,867,1096` | DataBridge fetch + AccessGatekeeper + `ADMIN` gates |
| `ignition-os/DataBridge.js:807` | stores permissions in session |
| `ignition-os/modules/IgnitionAdmin.jsx:209-211,363-365,608,1630` | permission-toggle UI + admin gate |
| `ignition-os/modules/IgnitionTools.jsx:76` | `permissions.includes('ADMIN')` |
| `ignition-os/modules/IgnitionHub.jsx:87` | filter member list by `TECH` |

**Inference flagged:** the React `userPermissions` context is the *only* place a Cultivar permission is consulted; nothing downstream of it (no query, no API, no policy) re-checks. So "consistent" = no — but more importantly, **for cost/inventory/asset data there is no check at all, anywhere.**

---

## 2. SENSITIVE-DATA INVENTORY (the columns a wall would protect)

~26 role-sensitive columns across 6 tables. Every one currently carries **owner_all + member_all** RLS only — i.e., any active member (incl. STAFF) reads and writes them. "Intended readers" below is **(inferred)** from how the UI surfaces the column, not a decision.

| Table | Column(s) | Sensitivity | Intended reader (inferred) | Rendered (file:line) | Page gate today |
|---|---|---|---|---|---|
| `cost_objects` | `acquisition_cost` | CRITICAL (capex spend) | owner | CostToProduce.tsx:107, BusinessAssets.tsx | `/costs`,`/assets` — **none** |
| `cost_objects` | `recurring_amount` | CRITICAL (÷N pricing input) | owner | CostToProduce.tsx, OperatingCosts.tsx | `/costs`,`/operating-costs` — **none** |
| `cost_objects` | `recovery_basis` | CRITICAL (D-16 pricing split) | owner | OperatingCosts.tsx, CostToProduce.tsx | `/operating-costs` — **none** |
| `cost_objects` | `recovery_basis_source` | HIGH (DERIVED/EXPLICIT flag) | owner | OperatingCosts.tsx (badge) | `/operating-costs` — **none** |
| `cost_objects` | `cost_confidence` | HIGH (data-quality signal) | owner | CostToProduce.tsx, ProjectCostTree.tsx | `/costs` — **none** |
| `cost_objects` | `cost_nature` | HIGH (CapEx/COGS/OpEx) | owner | MarginEngine compute | — |
| `cost_objects` | `substantiation` | HIGH (receipt-backed?) | owner | OperatingCosts.tsx, ProjectCostTree.tsx | `/costs` — **none** |
| `cost_objects` | `receipt_id` | HIGH (audit trail) | owner | ProjectCostTree.tsx, ProjectCostDrillIn.tsx | `/costs` — **none** |
| `business_inventory` | `unit_cost` | CRITICAL (COGS) | owner | BusinessInventory.tsx:124, CostToProduce.tsx:80, Dashboard.tsx:142 | `/inventory`,`/costs`,dash — **none** |
| `business_inventory` | `cost_confidence` | HIGH | owner | BusinessInventory.tsx:124 | `/inventory` — **none** |
| `business_inventory` | `receipt_id` | HIGH | owner | stored, not rendered | — |
| `labor_resources` | `base_wage`,`burden`,`cost_rate`,`bill_rate`,`rate` | CRITICAL (**HR — employee/contractor wages**) | owner only | CostToProduceSettings.tsx (Settings labor block) | `/settings` — **UI gate only** |
| `labor_resources` | `pass_through_expenses` | HIGH | owner | CostToProduceSettings.tsx | `/settings` — UI gate only |
| `receipts` | `amount` | HIGH (OCR cost) | owner | ReceiptKeeper.tsx | `/receipts` — **none** |
| `receipts` | `vendor`,`category` | MEDIUM | owner | ReceiptKeeper.tsx | `/receipts` — **none** |
| `business_modules` | `config` (jsonb) | CRITICAL (**entire pricing model** — labor, margin, denominators) | owner | CostToProduceSettings.tsx:79 | `/settings` — UI gate only |
| `cost_object_edges` | `use_fraction`,`basis_confidence` | HIGH/MED (allocation) | owner | rollup, not rendered | — |
| `cost_object_assignments` | `conversion_cost`,`basis_confidence` | HIGH/MED | owner | not rendered | — |

**Sharpest exposure (all inferred-intent vs. actual):**
- **HR wages** (`labor_resources.base_wage/burden/cost_rate/bill_rate`) — the most sensitive data in the system. Protected today *only* because the Settings page hides for non-owners in React; the rows are fully member-readable at the DB.
- **Pricing model** (`business_modules.config`) — the whole cost/margin/denominator strategy in one blob, same UI-only protection.
- **`/costs`, `/inventory`, `/assets`, `/operating-costs`, `/receipts`** render cost columns with **no gate at all** — a STAFF member who types the URL sees everything.

---

## 3. CURRENT ENFORCEMENT MAP (render vs API vs RLS)

### 3.1 RLS — confirms A5 platform-wide: **tenant-scoped only, zero role gates**

Every sensitive table has exactly two policies, both `business_id`-scoped, neither referencing `role`/`permissions`:
- `*_owner_all` → `EXISTS (SELECT 1 FROM businesses WHERE id = <tbl>.business_id AND owner_id = auth.uid())`
- `*_member_all` → `EXISTS (SELECT 1 FROM business_members WHERE business_id = <tbl>.business_id AND user_id = auth.uid() AND active = true)`

Verified across: `business_members` (`20260602…:48-61`), `business_modules` (`20260604…:113-121`), `business_assets`→`cost_objects` (`20260612…:51-83`, `20260615…:~54`), `business_inventory`/`business_pmi_schedule`/`business_service_log` (`20260612…`), `cost_object_edges`/`cost_object_assignments` (`20260615…:152-221`), `deliveries` (`20260620…:46-78`), `business_discovery_profiles` (`20260621…:48-80`). **No USING/WITH CHECK clause anywhere references `role` or `permissions`.**

**A5 is confirmed platform-wide: RLS is uniformly tenant-only. The `business_members.permissions` column is written and read into app context, but NEVER consulted by a policy.**

### 3.2 Tenant isolation (AC-2 / AC-3) — INTACT and separate from this gap

No `USING(true)` backdoor on the sensitive tables. The only anon-readable surface is the public-checkout set (`orders`, `customers`, `order_items`, `cultivar_plants`, and `business_inventory` via the inventory read path) — a deliberate, pre-existing demo/checkout decision (tech-debt #28/#32 class), **not** part of the role gap. **Tenant isolation is a hard boundary and is not what's broken here; the role layer inside a tenant is.**

### 3.3 Render layer — one real gate, seven placeholders

- **Enforced:** `manage_settings` → Settings page redirect (`Settings.tsx:533-541`) + dashboard settings button + owner-only leakage/insights tiles (`Dashboard.tsx:82-83,471…`).
- **Placeholders (defined, assigned, gate nothing):** `view_dashboard`, `qr_checkout`, `view_orders`, `manage_deliveries`, `manage_customers`, `manage_campaigns`, `view_reports`. The corresponding routes (`/orders`, `/deliveries`, `/campaigns`, `/inventory`, `/costs`, `/assets`, `/operating-costs`, `/receipts`) are guarded only by **PrivateRoute = is-authenticated**, never by permission. A STAFF login reaching any of those URLs is served the full page. (`qr_checkout` routes `/plant/*`,`/checkout/*` are outright public.)

### 3.4 API layer — **zero** role/permission checks

Every endpoint under `packages/cultivar-os/api/` uses the service key and trusts RLS to filter by tenancy. None inspect `role`/`permissions`; none even verify `auth.uid()` is a member of the passed `business_id` — they rely on RLS to catch cross-tenant. (`orders/submit.ts`, `members/invite.ts`, `dashboard.ts`, `receipts/ocr.ts`, `discovery/ingest.ts`, `customers/create.ts`, `pmi/suggest.ts`, `social/*`, `qbo/router.ts` all audited.) **Same data shape returned to owner and staff alike.**

---

## 4. BLAST RADIUS (what a data-layer wall would touch)

14 distinct SELECT sites read sensitive cost columns today **with no role filter — all multi-role** (one query serves owner+manager+staff, two also serve public checkout). This is the list that makes a future build complete-in-one-pass instead of a patch-round chase:

| # | Read site | Columns pulled | Serves |
|---|---|---|---|
| 1 | `CostToProduce.tsx:107` | cost_objects: acquisition_cost, recurring_amount, cost_confidence, cost_category, recovery_basis, receipt_id… | all members |
| 2 | `ProjectCostTree.tsx:173` | cost_objects (same set, by-project tree) | all members |
| 3 | `CostToProduce.tsx:80` | business_inventory: name, unit_cost, cost_confidence | all members |
| 4 | `BusinessInventory.tsx:124` | business_inventory: full row incl. unit_cost, cost_confidence | all members |
| 5 | `BusinessAssets.tsx:166` | cost_objects: status, acquisition_cost, cost_confidence | all members |
| 6 | `CostToProduceSettings.tsx:213` | cost_objects: recurring_amount, cost_nature, substantiation, recovery_basis(_source), resource_id… | members (Settings — page-gated) |
| 7 | `CostToProduceSettings.tsx:447` | cost_objects reload (same) | members (Settings — page-gated) |
| 8 | `OperatingCosts.tsx` (load) | cost_objects: recurring_amount, recovery_basis, substantiation, cost_confidence | all members |
| 9 | `Dashboard.tsx:142` | business_inventory: qty, unit_cost (inventory-value metric) | all members |
| 10 | `api/dashboard.ts:22,33` | business_inventory: qty, unit_cost | API → any caller |
| 11 | `api/orders/submit.ts:82,130` | business_inventory: unit_cost (subtotal calc) | **public checkout** |
| 12 | `usePlant` / plant profile path | business_inventory.unit_cost (via join) | **public checkout** |
| 13 | ProjectCostDrillIn.tsx | cost_objects line items incl. receipt_id | all members |
| 14 | labor block in `CostToProduceSettings.tsx` | labor_resources: base_wage, burden, cost_rate, bill_rate, rate | members (Settings — page-gated) |

**Two structural cautions for whoever builds the wall:**
1. **Multi-role shaping, not flat blocking.** A flat role-scoped SELECT-deny on cost columns would, for any non-owner: blank/error `/costs`, `/inventory`, `/assets`, `/operating-costs`; return `undefined` to the dashboard inventory metric and `/api/dashboard`; and break the Settings cost editor. Sites #11–#12 are **public checkout** — they consume `unit_cost` for subtotal math; a wall that hides `unit_cost` from the anon/public path **NULLs order totals**. These sites need role-aware *shaping* (totals-only, or compute server-side and never ship the column), not a blanket deny.
2. **Page-gated ≠ safe-forever.** Sites #6/#7/#14 are protected today only because `/settings` is render-gated. The moment any of those components is reused on a staff-visible surface (e.g. a "view-only cost report"), the unfiltered SELECT is exposed. The protection lives in the page wrapper, not the query.

---

## 5. MECHANISM OPTIONS (enumerated, NOT chosen)

Given the current shape (permissions in JSONB on `business_members`; RLS tenant-only; 14 multi-role unfiltered reads; HR + pricing config the sharpest columns), these are the enforcement families available. **For David / Lightning to decide — no recommendation here.**

### Option A — Role-aware RLS (data-layer wall, the "real ceiling")
Make policies read the JSONB permissions, e.g. a SELECT policy that allows owner OR an active member whose `permissions ? 'view_costs'`. 
- **Requires:** a new permission string (e.g. `view_costs`) seeded into bundles; new/extended policies on each sensitive table; **AND** refactoring the 14 read sites to survive row/column denial (multi-role shaping — totals-only views or server-computed values for checkout #11/#12). Column-level masking is not native to Postgres RLS (it gates rows, not columns) → either split sensitive columns into a gated child table/view, or accept row-level gating + app-side column shaping.
- **Strength:** hidden data is never sent — meets the stated "the wall is the ceiling" intent.
- **Cost:** platform-wide, touches every gated table + all 14 reads; highest blast radius if done without the shaping refactor.

### Option B — Permission-checked render/API gates (RLS stays tenant-only)
Keep RLS as-is; add real permission gates at the page routes (the proven `/settings` pattern) for `/costs`,`/inventory`,`/assets`,`/operating-costs`,`/receipts`, and/or add a permission check inside the API handlers before returning cost columns.
- **Requires:** new permission string + bundle seeding; route-guard wrappers; optionally API-side permission checks (today there are none — §3.4).
- **Strength:** lower blast radius, mirrors the one gate that already works; fast.
- **Limit:** does NOT meet "data-layer ceiling" — a crafted direct query/API call under a valid member session still returns the columns (RLS still allows them). Render/API gates are focus/UX walls, not data walls.

### Option C — Hybrid (both)
Render/API gates for UX + a narrower role-aware RLS (or gated view/child-table) for the few genuinely must-never-leak columns (HR wages `labor_resources.*`, pricing `business_modules.config`), leaving lower-stakes cost columns at render-gate level.
- **Requires:** the union of A's narrow slice + B; plus a decision on which columns are "data-wall" vs "render-wall."
- **Strength:** spends the expensive RLS/view work only where leakage is unacceptable; bounds the blast radius.

**Cross-cutting prerequisites any option shares (findings, not steps):**
- There is **no cost/finance permission string in Cultivar today** — any option needs one minted + seeded into `DEFAULT_PERMISSIONS` and into existing members' rows.
- The **scattered `.includes()` checks + unused `can()/checkPermission()` helpers** mean enforcement has no single chokepoint to extend — a centralizing pass would precede or accompany any wall, or the wall will be N edit sites.
- The **public-checkout cost reads (#11/#12)** must be handled in *every* option — they consume `unit_cost` outside any session and cannot simply be denied.

---

## APPENDIX — what was NOT found (negative results, so the wall isn't built on a false premise)

- No `field_visibility` / `can_view_column` / per-field config — anywhere (schema, code, migrations).
- No role-scoped RLS clause — anywhere.
- No API-layer role/permission check — anywhere.
- No permission/role-config UI — owner can invite + pick a *predefined* role only (`Settings.tsx` team section); cannot customize what a role sees.
- `can()` / `checkPermission()` exist but are **not** wired into the live Cultivar gates.
- Ignition's role expansion (`CoreApp.jsx:467`) is partially broken (role-badge vs capability-string format collision) — relevant if a future wall tries to reuse Ignition's `rolesRegistry` as the model.

---

*Recon only. No code, schema, migration, or build produced. No built-inventory change (nothing built). READ-ONLY honored — every claim read from source; where a check would have required mutating state, it was read, not run. Mechanism options enumerated, not chosen — the fix is David's / Lightning's call.*
