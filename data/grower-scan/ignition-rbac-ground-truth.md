# Ignition RBAC — Ground Truth (READ-ONLY recon)

**Date:** 2026-06-21 · **Mode:** Verify-first recon, READ-ONLY (no code/schema/build/design)
**Scope:** What Ignition's role/permission code ACTUALLY does today — roles, grants, real-vs-decorative enforcement.
**Authority:** the repo, not recollection. All claims carry `file:line`. Inferred intent is labeled.
**Why:** Ignition is the reference/most-mature RBAC vertical. Cultivar's financial-permission wall is the
first slice of a platform permission taxonomy; the question is whether Ignition is a wired template or
also partly decorative (Cultivar recon found 7 of 8 strings gated nothing). **Answer below: partly decorative.**

---

## TL;DR (the headline findings)

1. **There is no single clean 4-role model in code.** David recalls owner/manager/tech/front-office. The code's
   canonical role keys are **ADMIN / TECH / SERVICE / CUSTOMER** (+ a `DEVELOPER` seed, + an `OWNER` alias that
   exists in display only). "Manager"/"Owner" are **not** role keys — `ADMIN` is the admin role; "A. MANAGER" is a
   seed-profile *name* whose role is `ADMIN`.
2. **The JoinFlow staff picker offers only TWO roles** — Technician + Front Office (`SERVICE`) — not four
   (CoreApp.jsx:228-231).
3. **19-string permission catalog, categorized into 5 groups** (IgnitionAdmin.jsx:27-47). Clean and declarative.
4. **Enforcement IS real at the render layer** — `AccessGatekeeper` (CoreApp.jsx:459) is a genuine chokepoint that
   returns "Access Denied". This is **further than Cultivar's render-only-but-dead state for the module-view perms.**
5. **BUT 8 of 19 permission strings are DECORATIVE** — all the Financial / Tech-Ops / Customer *action* permissions
   gate nothing. Only the 11 `view_*` module perms + `manage_users` are consulted. **Same dead-string class as
   Cultivar's 7.**
6. **Two role→permission maps exist and DISAGREE** (`getSystemRoles()` vs `ROLE_PRESETS`), and there is an active
   **format collision bug** (TD#28): the staff-management UI writes capability-strings, the gatekeeper expects
   role-badge keys → real `shop_members` users get **Access Denied** for everything.
7. **A self-grant escape hatch** ("Request Manager Override", CoreApp.jsx:~490) lets ANY denied user bypass ANY
   gate for the session — no manager actually authenticates.
8. **No role-based enforcement at the DATA layer.** RLS is by shop ownership only; role/permission lives in a jsonb
   column read client-side. Ignition is **not** further along than Cultivar at the data layer.

---

## 1. ROLE DEFINITIONS — the actual roles

Roles are scattered across **seven** surfaces that do not fully agree:

| # | Surface | `file:line` | Roles named | Notes |
|---|---------|-------------|-------------|-------|
| 1 | JoinFlow role picker (`ROLES`) | CoreApp.jsx:228-231 | `TECH` (Technician), `SERVICE` (Front Office) | **Only 2 roles** offered to staff self-enrolling |
| 2 | `getSystemRoles()` fallback map | DataBridge.js:1114-1116 | `ADMIN`, `TECH`, `CUSTOMER` | **3 keys** — the expansion map AccessGatekeeper uses |
| 3 | `ROLE_PRESETS` (admin UI) | IgnitionAdmin.jsx:51-56 | `ADMIN`, `TECH`, `SERVICE`, `CUSTOMER` | **4 keys** — used to assign perms to members |
| 4 | Seed profiles `getProfiles()` | DataBridge.js:830, 833 | `ADMIN` ("A. MANAGER"), `DEVELOPER` ("L. PILOT") | PIN 1111 / 3333 dev seeds |
| 5 | `roleColor()` display switch | IgnitionAdmin.jsx:173-178 | `ADMIN`/`OWNER`, `TECH`/`TECHNICIAN`, `SERVICE`, `DEVELOPER` | Cosmetic only; recognizes aliases |
| 6 | Owner creation (onboarding) | OnboardingWizard.jsx:173 | owner row gets `permissions: ['ADMIN','TECH','PRICING_AUTHORITY']` | Owner = ADMIN+TECH badge, no distinct "OWNER" key |
| 7 | `recreate_shop_members` migration comment | 20260603_recreate_shop_members.sql:10 | `'ADMIN'`, `'TECH'`, `'VIEW_ALL'` | Comment lists a `VIEW_ALL` role that exists **nowhere in code** |

**Reconciliation (inferred):** the *real* canonical role set the code operates on is **ADMIN / TECH / SERVICE /
CUSTOMER**, plus a `DEVELOPER` dev-seed. David's "owner/manager/tech/front-office" maps as:
owner → `ADMIN` (no separate OWNER key; `OWNER` is only a display alias), manager → also `ADMIN` (only the seed
*name* says "MANAGER"), tech → `TECH`, front-office → `SERVICE`. **There is no manager-vs-owner distinction in the
permission system** — both collapse to `ADMIN`.

### Custom-role machinery (real, and runtime-extensible)
`RolesTab` (IgnitionAdmin.jsx:1371-1402) is a live editor of the role→permission map:
- `togglePerm(roleName, permId)` (1376) edits any role's grant set.
- `addRole()` (1387) creates a custom role — name is `.toUpperCase()`'d, rejects duplicates.
- `removeRole()` (1393) — refuses to delete `ADMIN`/`TECH`/`CUSTOMER` (the three "system" roles; note `SERVICE` is
  **not** protected here even though it's a preset).
- `save()` (1397-1401) persists to **`system_config.roles` in localStorage** via `DataBridge.save` — **not the DB.**
- `getSystemRoles()` (DataBridge.js:1106) reads `system_config.roles` if present, else the hardcoded fallback.

⇒ The map is editable and roles are addable, but **per-device localStorage**, never synced to a tenant DB record.

### Sub-roles (job titles within a role)
`SUB_ROLES` (IgnitionAdmin.jsx:58-63): `TECH` → `SR_TECH`, `BAY_TECH`, `APPRENTICE`; `SERVICE` → `ADVISOR`,
`CASHIER`; `ADMIN`/`CUSTOMER` → none. Stored as `sub_role` on the member; **display/labeling only — gates nothing.**

---

## 2. PERMISSION CATALOG — every permission string

Canonical catalog: `ALL_PERMISSIONS` (IgnitionAdmin.jsx:27-47) — **19 strings, 5 groups** (`PERM_GROUPS`, :49):

**Group: Modules (11)**
| string | label | `file:line` |
|---|---|---|
| `view_omni` | View OMNI (Command) | IgnitionAdmin.jsx:28 |
| `view_hub` | View HUB (Dispatch) | :29 |
| `view_flux` | View FLUX (Workflow) | :30 |
| `view_cipher` | View CIPHER (DTC) | :31 |
| `view_stok` | View STOK (Inventory) | :32 |
| `view_proc` | View PROC (Vendors) | :33 |
| `view_prot` | View PROT (Margins) | :34 |
| `view_port` | View PORT (Estimates) | :35 |
| `view_crm` | View CRM (Clients) | :36 |
| `view_predictive` | View PREDICTIVE | :37 |
| `view_marketplace` | View Marketplace | :38 |

**Group: Financial (3)** — `PRICING_AUTHORITY` (:39), `edit_margins` (:40), `approve_payroll` (:41)
**Group: Admin (1)** — `manage_users` (:42)
**Group: Tech Ops (2)** — `scan_parts` (:43), `update_flux` (:44)
**Group: Customer (2)** — `sign_estimates` (:45), `pay_invoice` (:46)

**Orphan string not in the catalog:** `view_kosk` appears only in `getSystemRoles()` TECH (DataBridge.js:1115).
It is not in `ALL_PERMISSIONS`, not gated anywhere → dead.

**Also present but a different axis (not in the catalog):** `ADMIN`, `TECH`, `PRICING_AUTHORITY` appear as
**role-badge** strings inside seed/owner `permissions` arrays (DataBridge.js:830,833; OnboardingWizard.jsx:173).
These collide with the capability-string format — see §4.

---

## 3. ROLE → PERMISSION MAP — the actual grants (verbatim)

⚠️ **Two authoritative maps exist and DISAGREE.** Both are reproduced verbatim.

### Map A — `getSystemRoles()` fallback (DataBridge.js:1114-1116) — *consumed by AccessGatekeeper*
```
ADMIN:    view_omni, view_hub, view_flux, view_predictive, view_cipher, view_stok,
          view_proc, view_prot, view_port, view_crm, view_marketplace,
          edit_margins, manage_users, approve_payroll            (14)
TECH:     view_kosk, view_cipher, view_hub, scan_parts, update_flux   (5)
CUSTOMER: view_port, sign_estimates, pay_invoice                  (3)
```
(no `SERVICE` key; ADMIN here lacks `PRICING_AUTHORITY`, `scan_parts`, `update_flux`.)

### Map B — `ROLE_PRESETS` (IgnitionAdmin.jsx:51-56) — *consumed by the staff-management UI to assign grants*
```
ADMIN:    view_omni, view_hub, view_flux, view_predictive, view_cipher, view_stok,
          view_proc, view_prot, view_port, view_crm, view_marketplace,
          edit_margins, PRICING_AUTHORITY, manage_users, approve_payroll,
          scan_parts, update_flux                                 (17)
TECH:     view_hub, view_flux, view_cipher, view_stok, scan_parts, update_flux   (6)
SERVICE:  view_port, view_crm, view_cipher, view_stok, sign_estimates            (5)
CUSTOMER: view_port, sign_estimates, pay_invoice                  (3)
```

### Map C — JoinFlow `defaultPerms` (CoreApp.jsx:252-256) — *consumed on staff self-enroll*
```
TECH:     view_hub, view_flux, view_cipher, view_stok, scan_parts, update_flux   (6)  [== Map B TECH]
SERVICE:  view_port, view_crm, view_cipher, view_stok, sign_estimates            (5)  [== Map B SERVICE]
```

**The disagreements (important):**
- **ADMIN:** Map A = 14, Map B = 17. Map B grants `PRICING_AUTHORITY`, `scan_parts`, `update_flux`; Map A does not.
- **TECH:** Map A has `view_kosk` (dead) and **lacks** `view_flux` + `view_stok`; Maps B/C have `view_flux` +
  `view_stok` and **no** `view_kosk`. So a TECH assigned via the admin UI (Map B) can `view_flux`/`view_stok`, but
  the **expansion the gatekeeper uses (Map A) doesn't grant those** — compounding the format bug in §4.
- **SERVICE:** exists in B/C only; absent from Map A. A `SERVICE` member's role badge can't be expanded by
  `getSystemRoles()` at all.

### Tech vs Front-Office responsibility line (precise, from Map B / Map C)
- **TECH (shop-floor):** `view_hub` (Dispatch), `view_flux` (Workflow), `view_cipher` (DTC diagnostics),
  `view_stok` (Inventory), `scan_parts`, `update_flux` (advance job status). → dispatch, workflow, diagnostics,
  inventory, parts scanning, job progression. **No** customer/CRM, **no** estimate signing, **no** financials.
- **SERVICE / Front Office (customer-facing):** `view_port` (Estimates), `view_crm` (Clients), `view_cipher` (DTC),
  `view_stok` (Inventory), `sign_estimates`. → estimates, client records, signing. **No** dispatch/workflow,
  **no** `scan_parts`/`update_flux` (no shop-floor job control).
- **Overlap:** `view_cipher`, `view_stok`. **Tech-only:** `view_hub`, `view_flux`, `scan_parts`, `update_flux`.
  **Front-office-only:** `view_port`, `view_crm`, `sign_estimates`.

### Role → TILE mapping
There is **no role→tile gate.** Tiles come from one flat registry `DASH_APPS` (CoreApp.jsx:53-72, 19 entries) and
`NAV_ITEMS` (:74-82). Every role sees the same dashboard grid; access is decided **per-module at render** by
`AccessGatekeeper` (§4), not by filtering the tile list. (A locked tile renders, then the module body is gated.)
Note the dashboard *subscription* lock is separate and admin-bypassed: `isAdmin = permissions.includes('ADMIN')`
greys non-subscribed tiles (CoreApp.jsx:1096), unrelated to RBAC.

---

## 4. ENFORCEMENT REALITY — wired vs decorative (the critical layer)

### The chokepoint
`AccessGatekeeper` (CoreApp.jsx:459-489) **is a real render gate** — returns an "Access Denied" screen when the user
lacks clearance. Logic (CoreApp.jsx:466-468):
```
rolesRegistry    = DataBridge.getSystemRoles()                         // Map A
userCapabilities = currentUser.permissions.flatMap(role => rolesRegistry[role] || [])
hasAccess        = requiredPermissions.some(rp => userCapabilities.includes(rp)) || overrideActive
```
It is the **only** generalized gate, used **15×** wrapping module renders (CoreApp.jsx:1028-1178). A second,
**inline** gate exists in `IgnitionAdmin` itself (IgnitionAdmin.jsx:1630):
`isAdmin = currentUser?.permissions?.includes('ADMIN') || currentUser?.permissions?.includes('manage_users')`
— note this is a **direct `.includes()`** (no expansion), i.e. **different semantics** from the gatekeeper.

So enforcement is **mostly a chokepoint** (`AccessGatekeeper`) **with one scattered inline check** (IgnitionAdmin).

### Per-string verdict
| permission | ENFORCED? | gate location / "no consumer" |
|---|---|---|
| `view_flux` | **ENFORCED** | AccessGatekeeper CoreApp.jsx:1028, 1051, 1123 |
| `view_port` | **ENFORCED** | CoreApp.jsx:1041, 1046, 1061 |
| `view_omni` | **ENFORCED** | CoreApp.jsx:1056, 1168 |
| `view_hub` | **ENFORCED** | CoreApp.jsx:1066 |
| `view_proc` | **ENFORCED** | CoreApp.jsx:1071 |
| `view_crm` | **ENFORCED** | CoreApp.jsx:1078 |
| `view_predictive` | **ENFORCED** | CoreApp.jsx:1130 |
| `view_cipher` | **ENFORCED** | CoreApp.jsx:1137 |
| `view_stok` | **ENFORCED** | CoreApp.jsx:1144 |
| `view_prot` | **ENFORCED** | CoreApp.jsx:1151 |
| `view_marketplace` | **ENFORCED** | CoreApp.jsx:1163 |
| `manage_users` | **ENFORCED** | AccessGatekeeper CoreApp.jsx:1173, 1178 + inline IgnitionAdmin.jsx:1630 |
| `PRICING_AUTHORITY` | **DECORATIVE** | catalog/seed/preset only — no `requiredPermissions` consumes it |
| `edit_margins` | **DECORATIVE** | map + catalog only — no consumer found |
| `approve_payroll` | **DECORATIVE** | map + catalog only — no consumer found |
| `scan_parts` | **DECORATIVE** | granted to TECH; no gate consults it |
| `update_flux` | **DECORATIVE** | granted to TECH; no gate (distinct from the enforced `view_flux`) |
| `sign_estimates` | **DECORATIVE** | granted to SERVICE/CUSTOMER; no gate |
| `pay_invoice` | **DECORATIVE** | CUSTOMER; no gate |
| `view_kosk` | **DECORATIVE** | orphan; in Map A TECH only; not even in the catalog |

**Tally: 12 ENFORCED (11 `view_*` + `manage_users`), 8 DECORATIVE.** Every **Financial, Tech-Ops, and Customer**
permission — i.e. every *action* (as opposed to *module-view*) permission — gates nothing. **This is the same
failure mode as Cultivar's 7 dead strings:** the system gates *which screens you can open*, never *what you can do
once inside* (you cannot scan a part vs not, sign an estimate vs not, edit pricing vs not — those are ungated).

**Also note — ungated modules:** several `DASH_APPS` render with **no** AccessGatekeeper at all (INTAKE, ESTIMATES,
EVAL, INVOICE, COMPLIANCE, AUDIT are not in the wrapped set CoreApp.jsx:1028-1178; one render is explicitly open,
`requiredPermissions={[]}`, CoreApp.jsx:1158). Those screens are reachable by any authenticated user regardless of
permission.

### The format-collision bug (TD#28) — enforcement is partly self-defeating
`AccessGatekeeper` expects `currentUser.permissions` to be **role-badge keys** (`ADMIN`/`TECH`/`CUSTOMER`) that it
expands through Map A. But the **staff-management UI and JoinFlow write capability-strings** directly
(`view_hub`, …) into `shop_members.permissions` (IgnitionAdmin.jsx:225, 393; CoreApp.jsx:258). Then
`flatMap(role => rolesRegistry[role] || [])` looks up `rolesRegistry['view_hub']` → `undefined` → `[]` for every
entry → `userCapabilities = []` → **hasAccess=false → Access Denied for everything.** This is flagged live by the
`[TRACE:AUTH]` instrumentation at CoreApp.jsx:469-474, DataBridge.js:835, 1109, 1117, IgnitionAdmin.jsx:388.
⇒ Only the **two hardcoded SEED profiles** (PIN 1111/3333, whose `permissions` are role-badges
`["ADMIN","TECH","PRICING_AUTHORITY"]`) actually pass the gatekeeper. **Real shop members are locked out** unless
they use the override below. **The gate is real, but the data feeding it is in the wrong format — so in practice
it denies the very users it was built for.**

### The escape hatch
On any "Access Denied", the user can click **"Request Manager Override"** → on tap it calls
`DataBridge.smartSync('MANAGER_OVERRIDE_GRANTED', …)`, sets `overrideActive=true`, and `alert('Manager Override
Granted')` (CoreApp.jsx ~488-495). **No manager actually authenticates** — there is no second-party scan/PIN check;
it is a self-service grant for the session. ⇒ **Every gate is bypassable by the blocked user themselves.**

### Data-layer reality
**No role-based RLS anywhere.** `shop_members` RLS is ownership-scoped + open-read:
- original `pilot_all_members` `FOR ALL USING (true)` (supabase_team_system_migration.sql) — fully open;
- recreate `shop_owner_all` `FOR ALL USING (EXISTS … businesses.owner_id = auth.uid())` +
  `shop_member_self_select` `FOR SELECT USING (true)` (20260603_recreate_shop_members.sql:60-79).

Role/permission is a **jsonb column read client-side**; no policy consults `role` or `permissions`. PIN auth means
`auth.uid()` is null during the challenge (migration comment, :77-79), so RLS *can't* be role-aware as designed.
The entire permission model lives in **localStorage `current_user`** (`DataBridge.load('current_user')`,
CoreApp.jsx:460) — editable client-side. ⇒ **Render/client-only, same posture as Cultivar; not further along at the
data layer.** What Ignition has *more* of than Cultivar is the **catalog + admin assignment UI + a working render
chokepoint**, not deeper (DB-level) enforcement.

---

## 5. PORTABILITY READ (findings for David to design against — NOT a recommendation)

**HAVE (real and reusable as the platform taxonomy template):**
- **The categorized permission catalog** `ALL_PERMISSIONS` {id, label, group} with 5 groups (IgnitionAdmin.jsx:27-49)
  — clean, declarative, the strongest reusable artifact. This is the shape a platform-wide taxonomy wants.
- **`ROLE_PRESETS` as seed defaults + per-member `togglePerm` override** (IgnitionAdmin.jsx:51-56, 206-211) — a sound
  "pick a role, then fine-tune grants" model.
- **`AccessGatekeeper` as a single render chokepoint** (CoreApp.jsx:459) — the right *pattern* (one component wraps
  protected renders) — *if* fed a single consistent permission format.
- **Sub-roles** (job titles within a role) — a real concept worth keeping, currently display-only.

**Decorative / do NOT carry forward as-is:**
- **The 8 dead strings** (`PRICING_AUTHORITY`, `edit_margins`, `approve_payroll`, `scan_parts`, `update_flux`,
  `sign_estimates`, `pay_invoice`, `view_kosk`) — porting them reproduces Cultivar's dead-string problem. They only
  become real alongside the action-level gates they imply.
- **The dual disagreeing maps + the role-badge↔capability-string format collision** (Map A vs Map B; TD#28) — an
  active bug, not a template. A platform model needs ONE format and ONE map.
- **The "Manager Override" self-grant** (CoreApp.jsx:~490) — a bypass of the whole system; security hole, not a pattern.
- **localStorage-only role persistence + role-blind RLS** — not multi-tenant-safe. Ignition enforces nothing at the
  data layer; the platform wall (the thing Cultivar's financial-permission work is reaching for) is **not present**
  in Ignition to copy.

**NEED vs WANT (observation, for David — not design):** the irreducible NEED a platform taxonomy must add over what
Ignition HAS is (a) one canonical role→permission format and map, and (b) enforcement at the data layer (RLS/API),
since Ignition is render-only and client-editable. The WANT layer Ignition already sketches well — the catalog,
groups, presets, per-member override, sub-roles — is reusable structure. **Ignition is a good catalog/UI template
and a cautionary tale on enforcement; it is not a data-layer enforcement template.**

---

## Files read
- `packages/ignition-os/CoreApp.jsx` (JoinFlow, AccessGatekeeper, gates, DASH_APPS, override)
- `packages/ignition-os/DataBridge.js` (`getSystemRoles`, seed profiles, authenticate)
- `packages/ignition-os/modules/IgnitionAdmin.jsx` (catalog, presets, sub-roles, RolesTab, self-gate)
- `packages/ignition-os/OnboardingWizard.jsx:173` (owner creation)
- `packages/ignition-os/supabase/migrations/supabase_team_system_migration.sql` (original shop_members RLS)
- `packages/ignition-os/supabase/migrations/20260603_recreate_shop_members.sql` (current RLS + role comment)

*READ-ONLY recon. No code, schema, build, or design produced. ENFORCED/DECORATIVE labels are grep-verified;
role-reconciliation and NEED/WANT framing are labeled inferred.*
