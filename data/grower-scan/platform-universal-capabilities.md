# THUNDER RECON — Platform-Universal Capability Catalog

**Date:** 2026-06-22 · **Type:** Verify-first recon, READ-ONLY (no code/schema/build/design)
**Question:** Which capabilities are genuinely cross-cutting (platform-universal), and for each — is it PRESENT / PARTIAL / MISSING per vertical, with `file:line`? The point is to enumerate the universal parts ONCE so a solved-in-one-vertical capability stops being rediscovered/rebuilt per vertical.
**Authority:** the repo, not recollection. Every cell carries `file:line` or an explicit "absent" note. Inferred intent is labeled.
**Off-Limits honored:** read-only; `oauth.ts` / `auth.ts` / old project untouched; `[TRACE:*]` stays ON. No fix proposed.

**Builds on (does not re-derive):** `ignition-rbac-ground-truth.md`, `role-enforcement-ground-truth.md`, `cost-wall-leak-scope.md`, `member-rls-consistency-audit.md`, `staff-resolve-bug.md`. This doc is the cross-vertical roll-up; those carry the per-table / per-string detail.

**Capability = the contract, NOT the chrome.** A vertical may render its own UI; what's scored is whether the capability exists and is fed by shared context.

---

## VERTICAL SCOPE (what's a real build target today)

| Vertical | Status | In this matrix? |
|---|---|---|
| **cultivar-os** | Active (demo vertical), email/Supabase-auth, shared `business_members` spine | ✅ scored |
| **ignition-os** | Active build target, PIN/local-first + DataBridge/localStorage, `shop_members` | ✅ scored |
| **KINNA-OS** | Phase 1 not built (anchor pilot Aug 1, 2026) | ⚪ not built — N/A |
| **Conduit OS** | Planned vertical, no app code | ⚪ not built — N/A |
| **CoolRunnings** | Separate repo / home-automation; appears as a *project* inside TRACE cost data, not a TRACE vertical app | ⚪ out of scope (separate repo) |

Only **Ignition** and **Cultivar** have running app code, so the matrix scores those two. KINNA/Conduit are the *reason* this catalog exists: each MISSING/PARTIAL below is something a new vertical would otherwise rediscover.

---

## THE MATRIX (capability × vertical × verdict × file:line)

Legend: ✅ PRESENT (capability exists, fed by real/shared context) · 🟡 PARTIAL (exists but scoped, decorative, or render-only) · 🔴 MISSING (absent).

| # | Universal capability | Cultivar | Ignition | Promote/implement candidate? |
|---|---|---|---|---|
| 1 | Persistent identity indicator (user + role + active business) on **every** page | 🟡 PARTIAL — dashboard-only | ✅ PRESENT — global header | **YES** — promote Ignition's pattern to Cultivar (+ platform) |
| 2 | Financial/cost data gated by permission on **every read path** (RLS + service-key routes) | 🟡 PARTIAL — route-gate only, no data-layer gate (fix gated, unapplied) | 🔴 MISSING — render-only, client-editable | **YES** — both; data-layer wall is net-new platform-wide |
| 3 | Dual RLS (owner + active-member via `is_active_member`) on every tenant table | 🟡 PARTIAL — most tables, 1 leak + owner-only gaps | 🔴 MISSING — ownership-only, role-blind, `USING(true)` legacy | **YES** — canonicalize + extend |
| 4 | Honesty/confidence surfacing (CONFIRMED/DERIVED/ESTIMATED/UNKNOWN, never silent $0) | ✅ PRESENT — end-to-end, shared engine | 🔴 MISSING — no confidence vocabulary at all | **YES** — promote shared engine to a platform contract |
| 5 | External-connector honesty state ("QuickBooks needs reconnection") surfaced | ✅ PRESENT (QBO) / 🔴 MISSING (Blotato) | 🟡 PARTIAL — schema defined, surfacing unconfirmed | **YES** — Blotato + Ignition surfacing |
| 6 | Tenant isolation proven (cross-tenant read returns 0) | ✅ PRESENT — per-tenant RLS, no `USING(true)` on sensitive tables | 🟡 PARTIAL — `pilot_all` `USING(true)` legacy + role-blind | **YES** — Ignition isolation hardening |

**Headline:** Of six universal capabilities, **zero are PRESENT in both verticals.** Each is solved (or partly solved) in exactly one vertical and missing/partial in the other — the precise "rebuilt per vertical" failure the catalog is meant to stop. The two strongest reusable artifacts are **Ignition's identity header** (capability 1) and **Cultivar's shared confidence engine** (capability 4); each should be promoted to the *other* vertical, not re-invented.

---

## CAPABILITY 1 — Persistent identity indicator

**Contract:** every page shows *who is acting* (user), *as what* (role), *in which business* (active tenant) — not just the dashboard.

### Cultivar — 🟡 PARTIAL (dashboard-only)
- Identity is rendered **inside the Dashboard page only**: `Dashboard.tsx:450-461` shows `businessName` (from `useBusinessContext()`), `{isOwner ? 'Owner Dashboard' : 'Dashboard'}`, and `user?.email`. Data source `Dashboard.tsx:82-83` (`auth.useSession()` + `useBusinessContext()`).
- **No global header.** A `NavBar` component exists (`packages/cultivar-os/src/components/layout/NavBar.tsx:9-41`) but is **unused / imported nowhere**. `PrivateRoute` checks auth and renders `<Outlet/>` with no chrome. On `/orders`, `/settings`, `/costs`, `/receipts`, etc. there is **no** user/role/business indicator — the user must return to `/dashboard` to confirm context.
- `BusinessProvider` (shared) wraps the app and exposes context, but renders only a **business-picker modal** when 2+ businesses exist — not a persistent indicator.

### Ignition — ✅ PRESENT (global, every page)
- **"Identity Matrix" header** rendered in the top-level `CoreApp` render whenever `currentUser` exists: `CoreApp.jsx:937-945` shows the literal `Identity Matrix` label + `{currentUser.name}` + a lock/logout button.
- **`ShopBanner`** (`CoreApp.jsx:514-522`, mounted `:949`) shows the active shop name on every page — global layout, not per-page.
- **Active-job context** (`CoreApp.jsx:924-926`) shows the current asset/job on every page.
- Mounted in `CoreApp`'s top-level render tree (`:911-949`), above the viewport — persists across all module renders.

**Verdict:** Ignition is the template; Cultivar shows identity only on the dashboard. **Promote-or-implement: build a shared persistent identity bar fed by `BusinessProvider` (user/role/business already in context) and mount it in a global Cultivar layout.** Caveat from capability 4's recon: Cultivar's indicator currently shows email, not name + role badge — promote the *fuller* Ignition contract.

---

## CAPABILITY 2 — Financial/cost data gated by permission on every read path

**Contract:** cost/wage/pricing data is refused at the **data layer** (RLS + any service-key route) for a member lacking the financial permission — not merely hidden in React.

### Cultivar — 🟡 PARTIAL
- **Permission vocabulary exists** (net-new this month): `packages/shared/src/auth/financialPermissions.ts:22-30` defines `view_costs` (shaping), `view_wages` (hard wall), `view_pricing_config` (hard wall), `view_margin`.
- **Route-layer gate is wired:** all five cost surfaces sit behind `<PermissionRoute permission={VIEW_COSTS}>` (`router.tsx:82-88`); `PermissionRoute.tsx:15-19` redirects when `can(VIEW_COSTS)` is false.
- **BUT the data-layer gate for `view_costs` was never built** (`cost-wall-leak-scope.md` §⚠ premise correction). Cost tables carry membership-only member RLS — a Staff JWT calling PostgREST directly gets all rows. Gate 3 proved it RED: Staff session (perms `["view_dashboard","qr_checkout","view_orders"]`) reached `/costs`, `cost_objects: 21` returned. **6 tables need a `view_costs` data gate + 1 (`labor_resources`) needs `view_wages`** (`cost-wall-leak-scope.md` §1).
- **Wages + pricing-config ARE data-layer gated** — fused policies `lrw_member_view_wages` / `bpc_member_view_pricing` (`20260621_financial_wall_phase2.sql:75-83, 129-137`). So the hard-wall slice is real; the `view_costs` shaping slice is not.
- **API layer: zero permission checks** — every `api/` endpoint uses the service key and trusts RLS for tenancy; none inspect `role`/`permissions` (`role-enforcement-ground-truth.md` §3.4). `Dashboard.tsx:142` issues an ungated `business_inventory` SELECT returning `unit_cost` to any member.
- A fix migration (`20260622_oauth_secrets_relocation_and_cost_wall.sql`) is **written + GATED, not applied** (see handoff). Until applied, this stays PARTIAL.

### Ignition — 🔴 MISSING
- All financial enforcement is **render-only and client-editable.** `AccessGatekeeper` (`CoreApp.jsx:459-489`) is a real render chokepoint, but the financial permission strings are **decorative**: `PRICING_AUTHORITY`, `edit_margins`, `approve_payroll`, `view_prot` (margins) gate nothing (`ignition-rbac-ground-truth.md` §4 per-string verdict — 8 of 19 strings dead, all the *action*/financial ones).
- **No role-based RLS anywhere** — `shop_members` is ownership-scoped + open-read (`20260603_recreate_shop_members.sql:60-79`); role/permissions live in a jsonb column read client-side from `localStorage current_user` (`CoreApp.jsx:460`).
- A "Request Manager Override" self-grant (`CoreApp.jsx:~490`) lets any blocked user bypass any gate for the session.

**Verdict:** **Promote-or-implement: a platform `has_permission()` SECURITY DEFINER helper + data-layer financial gates.** Cultivar has the vocabulary and the route gate but not the data wall; Ignition has neither at the data layer. The `has_permission()` helper (mirrors `is_active_member` + `permissions ? p_perm`) is net-new platform-wide (`cost-wall-leak-scope.md` §2).

---

## CAPABILITY 3 — Dual RLS (owner + active-member) on every tenant table

**Contract:** every tenant table has both an owner policy and an active-member policy, the member half filtered by a single canonical `is_active_member(business_id)` predicate (`… AND active = true`).

### Cultivar — 🟡 PARTIAL
- **13 member-scoped tables already encode the same semantic**, spelled two ways: Form A `EXISTS(… active = true)` (11 tables) + Form B `IN(… active = true)` (`business_modules`, `storage.objects`) — `member-rls-consistency-audit.md` §2. A canonical `is_active_member()` helper is feasible and recursion-safe (and is the only safe way to give `businesses` a member-read policy — §4).
- **🔴 One real leak:** `member_devices.md_self` (`20260602_shared_members_a_create_tables.sql:154-158`) omits `AND active = true` — a deactivated member keeps access to their own device rows (self-scoped, not cross-tenant).
- **Owner-only gap (over-restriction, fails closed):** `businesses` + every pre-2026-06 operational table (`orders`, `customers`, `plants`, `addons`, `plant_events`, `social_drafts`, `order_items`, `order_service_selections`, `order_compliance_records`, `nursery_profiles`, `pmi_assets/logs`) have **no member policy** — a Staff member is blocked at RLS even holding `view_orders` (`member-rls-consistency-audit.md` §3, owner-only class). This is the staff-resolve bug's root cause (`staff-resolve-bug.md`).
- A canonical migration (`20260622_is_active_member_canonical_rls.sql`) is **written + GATED, not applied** — it would standardize all 13 onto `is_active_member`, fix `md_self`, and add `businesses` member-read.

### Ignition — 🔴 MISSING
- `shop_members` RLS is **ownership-scoped only**, with a legacy fully-open `pilot_all_members FOR ALL USING (true)` (`supabase_team_system_migration.sql`) + `shop_member_self_select FOR SELECT USING (true)` (`20260603_recreate_shop_members.sql:60-79`). **No active-member predicate, no `is_active_member` equivalent.** Role/permission is never consulted by a policy (`ignition-rbac-ground-truth.md` §4 data-layer reality).
- PIN auth means `auth.uid()` is null during the challenge → RLS can't be member-aware as designed.

**Verdict:** **Promote-or-implement: one shared SECURITY DEFINER `is_active_member()` as the platform membership predicate**, then standardize both verticals onto it (Cultivar's 13 tables + the owner-only gaps; Ignition has no member-RLS to standardize and would need it built). Cultivar is close; Ignition is absent at the data layer.

---

## CAPABILITY 4 — Honesty/confidence surfacing (never silent $0)

**Contract:** values are tagged with confidence (CONFIRMED/DERIVED/ESTIMATED/UNKNOWN) and shown as such; unknown is never silently coerced to $0 or a fabricated value (D-9 Surface Honesty).

### Cultivar — ✅ PRESENT (end-to-end, in shared)
- **Enum defined in shared:** `CostConfidence = 'CONFIRMED' | 'DERIVED' | 'ESTIMATED' | 'UNKNOWN'` (`packages/shared/src/business-logic/CostToProduce.ts:48`); mirrored as `AmountConfidence` (`CountOnceSeam.ts:75`). Second axis `Substantiation` = `SUBSTANTIATED | OWNER_ASSERTED` (`CountOnceSeam.ts:77-78`). Third axis `RecoveryBasis` (`CountOnceSeam.ts:96`).
- **Rendered as badges across surfaces:** `CostToProduce.tsx:237-262` (floor vs estimated vs unknown worklist), `BusinessAssets.tsx:391-400` + color-coding `:121-124`, `BusinessInventory.tsx:85-88, 250-254`, `ProjectCostTree.tsx:543-546` + unknown pill `:405`, `OperatingCosts.tsx:117-120`.
- **"Never $0" enforced in code:** `CostToProduce.ts:33-34, 58-59` ("null = UNKNOWN amount. NEVER coerce null → 0"); the accumulate path collects unknowns separately, never summed (`CostToProduce.ts:248-250`); `ProjectCostTree.tsx:103-112` makes `amount == null` the single load-bearing "unknown" test; on-screen statement "shown as unknown, never counted as $0" (`CostToProduce.tsx:259`). Discovery extraction carries the same contract (`shared/src/discovery/catalog.ts:21-31, 49-58` — low-confidence/no-category items flagged, price stays null never 0).

### Ignition — 🔴 MISSING
- **No confidence vocabulary anywhere.** Only `UNKNOWN` occurrence is a role fallback string `user_role: user.role || 'UNKNOWN'` (`DataBridge.js:495`) — not a data-confidence enum. No badges, no unknown-cost lists, no "never $0" rule. (Compliance module tracks PASS/FAIL audit status `IgnitionCompliance.jsx:39-40` — a different axis, not amount confidence.)

**Verdict:** The shared engine (`CostToProduce.ts`, `CountOnceSeam.ts`, `discovery/catalog.ts`) is the strongest reusable artifact in the platform — **but it's imported only by Cultivar.** **Promote-or-implement: register the confidence vocabulary + "never silent $0" as a platform contract** so Ignition (and KINNA/Conduit) inherit it rather than shipping opaque numbers.

---

## CAPABILITY 5 — External-connector honesty state surfaced

**Contract:** a connector's broken/stale/disconnected state ("QuickBooks needs reconnection") is surfaced to the user, not silently failed.

### Cultivar
- **QBO — ✅ PRESENT.** State columns on `businesses`: `accounting_needs_reconnect`, `accounting_token_expires_at`, `accounting_company_id`, `accounting_type`. Proactive refresh writes state back on failure: `shared/src/quickbooks/refresh.ts:50` sets `accounting_needs_reconnect = true` on OAuth failure, `:65` clears it on success. Surfaced in UI: `Settings.tsx:350-351` ("⚠ Reconnection needed") + reconnect link `:356-357`; `Dashboard.tsx:173-179` belt-and-suspenders derive (DB flag OR local token-expiry), `:748-763` full-width amber banner "QuickBooks needs reconnection — Invoices are paused"; QB tile `:591-648` connected/not-connected + error display `:614-617`. Failures are surfaced, not silent.
- **Blotato (social) — 🔴 MISSING.** No connection-state column anywhere (`blotato_account_id` / status absent — `business_modules.config` holds only channel enablement). `SocialSetup.tsx` shows channel toggles only, no connection status / reconnect prompt. `api/social/generate-posts.ts` checks the Claude API key + module-enabled, **never a Blotato credential** — if Blotato is down/disconnected, posts fail with no user-visible state. (The publish half of the social loop is architecturally silent.)

### Ignition — 🟡 PARTIAL
- Schema **defines** connector state: `DataBridge.js:130-132` `external_connections.quickbooks = { connected, realmId, companyName, connectedAt, lastSync }` + `csv.{lastImport, recordsImported}`. **But UI surfacing is unconfirmed** in this read — the shape exists; no consumer rendering "needs reconnection" was located. Treat as PARTIAL (tracked-not-surfaced until proven).

**Verdict:** Cultivar's QBO connector-honesty is the template (proactive refresh + state write-back + prominent banner). **Promote-or-implement: (a) extend the same pattern to Blotato in Cultivar; (b) confirm/implement surfacing for Ignition's `external_connections`.** The reusable contract = "every connector tracks a needs-attention flag AND surfaces it."

---

## CAPABILITY 6 — Tenant isolation proven (cross-tenant read returns 0)

**Contract:** a query under tenant A's session never returns tenant B's rows.

### Cultivar — ✅ PRESENT
- Sensitive tables have per-tenant RLS with **no `USING(true)` backdoor** (`role-enforcement-ground-truth.md` §3.2). The only anon-readable surface is the deliberate public-checkout set (`orders`, `customers`, `order_items`, `cultivar_plants`, `business_inventory` via the inventory read) — a pre-existing demo/checkout decision (tech-debt #28/#32 class), not an isolation hole. Tenant isolation is described as "a hard boundary and not what's broken" — the role layer *inside* a tenant is the gap (capabilities 2/3), isolation itself holds. (AC-3 absolute-isolation is the architecture constant.)

### Ignition — 🟡 PARTIAL
- Legacy `pilot_all_members FOR ALL USING (true)` (`supabase_team_system_migration.sql`) is fully open; the recreate adds `shop_owner_all` (ownership-scoped) but also `shop_member_self_select FOR SELECT USING (true)` (`20260603_recreate_shop_members.sql:60-79`). With PIN auth, `auth.uid()` is null during challenge so ownership RLS can't bind as designed; the model leans on client-side `shopId` (DataBridge/localStorage) for separation rather than DB-enforced isolation. Not proven cross-tenant-safe at the DB the way Cultivar is.

**Verdict:** **Promote-or-implement: an automated cross-tenant-returns-0 test** (the prompt's stated downstream goal — a "verify-universals test"). Cultivar would pass on sensitive tables today; Ignition's `USING(true)` legacy + PIN/`auth.uid()`-null posture needs hardening before it could.

---

## ADDITIONAL CROSS-CUTTING CANDIDATES SURFACED (beyond the 6 seeded)

The recon turned up three more capabilities that are clearly platform-universal and worth registering:

| # | Candidate capability | State | Evidence |
|---|---|---|---|
| 7 | **One canonical permission format + map** (not two disagreeing maps + a format collision) | 🔴 broken in Ignition, 🟡 scattered in Cultivar | Ignition: Map A (`DataBridge.js:1114-1116`) vs Map B (`IgnitionAdmin.jsx:51-56`) disagree; role-badge↔capability-string collision = real members get Access-Denied-for-everything (TD#28, `ignition-rbac-ground-truth.md` §4). Cultivar: scattered inline `.includes()`, unused `can()`/`checkPermission()` helpers (`role-enforcement-ground-truth.md` §1.4). **No single permission chokepoint exists in either vertical.** |
| 8 | **OAuth/connector secrets isolated from member reach** | 🟡 being hardened (Cultivar), 🔴 localStorage (Ignition) | Cultivar: `businesses_member_select` currently exposes `accounting_token`/`accounting_refresh_token` to active members; relocation to owner-only `business_accounting_secrets` is **written + GATED** (`cost-wall-leak-scope.md` §side-finding; handoff 2026-06-22 Part 1). Ignition: tokens implied client-side via DataBridge. A platform "secrets never member-readable" contract is net-new. |
| 9 | **Permissions stored on a shared spine table** (`business_members.permissions` jsonb) | ✅ shared (Cultivar) / 🔴 separate (Ignition) | Cultivar: `business_members.permissions jsonb` (`20260602_shared_members_a_create_tables.sql:35`), one shared spine. Ignition: `shop_members` + `localStorage current_user`, **not** on the shared spine. Storage is shared in name only — Ignition doesn't use it. |

These overlap capabilities 2–3 but are distinct contracts; flag for the same promote-or-implement list.

---

## PROMOTE-OR-IMPLEMENT LIST (every PARTIAL/MISSING, consolidated — NO fix proposed)

The source list for a future "verify-universals" test. Each line = a capability that one vertical solved and another rediscovers.

1. **Identity bar → Cultivar (cap 1):** promote Ignition's persistent header (user+role+business, every page) into a shared global Cultivar layout, fed by `BusinessProvider`.
2. **`view_costs` data-layer gate → Cultivar (cap 2):** build `has_permission()` + gate the 6 cost tables + `labor_resources` (migration written, gated, unapplied).
3. **Financial enforcement at the data layer → Ignition (cap 2):** Ignition has none; render-only + decorative strings + self-grant override.
4. **Canonical `is_active_member()` → both (cap 3):** standardize Cultivar's 13 tables + fix `md_self` + add `businesses`/operational member-read (migration written, gated); build member-RLS for Ignition (absent).
5. **Confidence engine → Ignition + platform contract (cap 4):** promote the shared `CostToProduce`/`CountOnceSeam`/`catalog` honesty vocabulary so Ignition (and KINNA/Conduit) inherit "never silent $0."
6. **Connector-honesty → Blotato + Ignition (cap 5):** extend Cultivar's QBO needs-reconnect pattern to Blotato; confirm/implement Ignition `external_connections` surfacing.
7. **Cross-tenant-returns-0 test → both (cap 6):** automate it; harden Ignition's `USING(true)` legacy + PIN/`auth.uid()`-null posture.
8. **One permission format + chokepoint → both (cap 7):** retire Ignition's dual maps / format collision / override; centralize Cultivar's scattered `.includes()` onto the unused `can()` helper.
9. **Secrets-never-member-readable → both (cap 8):** land the Cultivar `business_accounting_secrets` relocation (gated); define the platform contract.
10. **Permissions truly on the shared spine → Ignition (cap 9):** Ignition reads `localStorage`, not `business_members` — move it onto the shared spine to make the platform taxonomy real.

---

## CLOSE
READ-ONLY recon. No code, schema, policy, or build produced. One doc emitted (`data/grower-scan/platform-universal-capabilities.md`). No `built-inventory.md` change (recon, nothing built). `[TRACE:*]` stays ON. Off-Limits honored.

**Deliverable:** the capability × vertical × PRESENT/PARTIAL/MISSING matrix (6 seeded + 3 surfaced), every cell `file:line`-grounded, with a consolidated promote-or-implement list as the source for a verify-universals test. **Bottom line: not one of the six universal capabilities is PRESENT in both verticals** — each is solved in one and rediscovered in the other, which is exactly the rebuild-per-vertical cost this catalog exists to stop. No fix proposed — David scopes the build.
