# Multi-Tenant Infrastructure Audit — TRACE Platform
**Date:** 2026-05-28
**Scope:** `packages/ignition-os/` · `packages/shared/src/` · `packages/cultivar-os/`
**Auditor:** Claude Code
**Context:** "Verify-Before-Build" — mapping what exists before any de-hardcoding work on Cultivar OS.
**Status:** READ-ONLY. No changes made, no commits made.

---

## Executive Summary

| Domain | Current state | Adopt vs Build |
|--------|--------------|----------------|
| Tenant resolution (Ignition) | localStorage + `shop_id` via DataBridge | N/A — works for Ignition |
| Tenant resolution (Cultivar) | Hardcoded `DEMO_NURSERY_ID` constant everywhere | **Build** — no mechanism maps auth user → nursery |
| Multi-tenant queries (Cultivar) | Every query uses `DEMO_NURSERY_ID` | **Build** — replace with auth-derived nursery_id |
| Role-based access (Ignition) | Complete: ADMIN/TECH/CUSTOMER roles + permission array in `shop_members` | **Adopt + extend** — Ignition-local, not in shared |
| Role-based access (Cultivar) | None — `defaultRole: 'owner'` only, every logged-in user identical | **Build** — derive from Ignition model |
| Multi-location | Schema sketch in DataBridge. Not implemented anywhere. Not in shared. | **Build from scratch** when needed |
| `shared/src/supabase/auth.ts` | Mid-extraction — PIN auth only, partially generalized, imported by neither vertical directly | **Finish extraction** before Ignition OS reactivation |

**Bottom line:** Cultivar has no working multi-tenancy. A second nursery customer would log in and see LAWNS Tree Farm's data. The gap is not large in concept — it requires populating `nurseries.owner_id`, a context provider that fetches the tenant row after login, and replacing ~10–15 `DEMO_NURSERY_ID` references — but it must be intentionally built. Nothing in shared or Ignition does this automatically.

---

## 1. Tenant Model

### 1a. Ignition OS — How Tenancy Is Resolved

**Tenant unit:** `shop_id` (UUID, one row per shop in a `shops` table).

**Runtime resolution path:**

1. **Onboarding** (`OnboardingWizard.jsx:87–148`): On first run, `finalize()` generates a UUID, writes it to Supabase `shops` table, and calls `DataBridge.setShopId(shopId)`.
2. **`DataBridge.setShopId()`** (`DataBridge.js:176–184`): Writes to `memoryStore._shopId` AND `localStorage.setItem('IGNITION_SHOP_ID', id)`. Both in-memory and persistent.
3. **`DataBridge.getShopId()`** (`DataBridge.js:170–175`): Reads `memoryStore._shopId` first (fastest), falls back to `localStorage.getItem('IGNITION_SHOP_ID')`.
4. **Every DB query** uses `DataBridge.db.*` methods, which call `DataBridge.getShopId()` internally. Example from `DataBridge.js:263`:
   ```js
   getAll: async () => supabase.from('jobs').select('*').eq('shop_id', DataBridge.getShopId())...
   ```
5. **PIN auth** (`DataBridge.authenticate`, line 741): reads `shopId = DataBridge.getShopId()` to scope the `shop_members` lookup. Shop ID is resolved from localStorage, not from the authenticated user — it is always the shop that was set up on this device.

**Tables scoped by `shop_id`:** `jobs`, `shops`, `users`, `shop_members`, `member_devices`, `shop_invites`, `teams`, `purchase_orders`, `tools`, `pmi_schedules`, `customers`, `customer_vehicles`, `estimates`, `estimate_line_items`, `labor_entries`, `invoices`, `invoice_line_items`, `ai_usage`, `feature_events`, `error_events`, and all other tables in the 29-table schema.

**Key property:** Ignition's tenant resolution is LOCAL-FIRST. The `shop_id` is stored in localStorage by the device that ran onboarding. All data access is scoped by that ID. `auth.uid()` is always null because Ignition never calls `supabase.auth.signIn*()` — PIN auth bypasses Supabase Auth entirely.

**Files:** `DataBridge.js` (storage/resolution/queries), `OnboardingWizard.jsx` (tenant creation), `IgnitionCore.js` (session gate), all `packages/ignition-os/modules/*.jsx` (all read via DataBridge).

---

### 1b. Shared — What Tenant/Auth Infrastructure Exists

**`packages/shared/src/supabase/auth.ts`** — PIN auth extraction.

This is a TypeScript extraction of DataBridge's PIN auth functions. It was extracted but never imported by either vertical. Key observations:

- Functions: `hashPin`, `authenticate`, `autoEnrollDevice`, `getCurrentUser`, `logout`, `getTrialStatus`, `checkModuleTrialStatus`, `simulateTrialDay`
- Uses `entityId` parameter (slightly more generic than DataBridge's `shopId`) but the generalization is incomplete:
  - `STORAGE_KEY = 'IGNITION_OS_DATA'` is hardcoded — not parameterizable per vertical
  - `AuthSession` interface has field `shop_id: string` — Ignition-specific naming
  - `autoEnrollDevice` inserts `shop_id: entityId` into the `member_devices` table — uses the DB column name specific to Ignition's schema
- This module is useful for PIN-auth verticals (Ignition OS) but needs finishing before it can be cleanly adopted.

**`packages/shared/src/auth/configureAuth.tsx`** — the auth factory.

This IS used by Cultivar. Key observations:

- `configureAuth({ strategy: 'email', vertical: 'cultivar-os', tenantTable: 'nurseries', defaultRole: 'owner', ... })` is called in `packages/cultivar-os/src/lib/auth.ts:3`.
- The `buildEmailAuth` strategy:
  - `signIn`: calls `supabase.auth.signInWithPassword` — correctly uses Supabase Auth
  - `useSession`: reads `supabase.auth.getSession()` — session is tied to the authenticated Supabase user, NOT a hardcoded ID
  - `user` in the session: `{ id: raw.user.id, email: raw.user.email, role: config.defaultRole }` — returns user.id from Supabase Auth
  - `SignUp` component: inserts into `config.tenantTable` (i.e., `nurseries`) with `owner_id: data.user!.id` — this is the RIGHT pattern
- The PIN strategy calls `pinAuthenticate(tenantId, pin)` from `shared/src/supabase/auth.ts` — it is used this way.

**The critical gap in `configureAuth`'s email strategy:** The session object only contains `user.id` (Supabase Auth UID). It does NOT look up which nursery row belongs to that user. The nursery_id — the actual operational tenant — is not in the session.

**`packages/shared/src/supabase/types.ts`** — shared row types.

Uses `tenant_id` as the generic column name in cross-vertical tables (NotificationLog, SubscriptionTier, GrowthGoal, Vendor, AIUsageLog). These are design-intent types; none of these shared tables exist in any active Supabase project yet. Note: `VerticalId` type still lists `'pantry-os'` (stale — should be `'kinna-os'`).

---

### 1c. Cultivar OS — How Tenancy Is Resolved

**Short answer: It doesn't. A hardcoded constant stands in for all tenant resolution.**

The resolution path from login → "which nursery am I":

1. `packages/cultivar-os/src/lib/constants.ts:3`:
   ```ts
   export const DEMO_NURSERY_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
   ```

2. Login succeeds via `supabase.auth.signInWithPassword`. The session contains `user.id` (Supabase Auth UID). Nobody reads this to find a nursery.

3. Every component and hook that needs a nursery ID imports `DEMO_NURSERY_ID` directly:
   - `Dashboard.tsx:6` — imports and uses at lines 98, 111, 116, 125, 132, 138, 167
   - `useModules.ts:66` — parameter, but the only call site passes `DEMO_NURSERY_ID`
   - `useNursery.ts:3,6` — default parameter is `DEMO_NURSERY_ID`
   - `api/dashboard.ts:10` — `const nurseryId = (req.query.nursery_id as string) || 'a1b2c3d4-0000-0000-0000-000000000001'`

4. **The `nurseries.owner_id` column is NULL for all rows.** CLAUDE.md post-demo tasks explicitly list "Populate nurseries.owner_id for LAWNS row (currently NULL — blocks owner-scoped RLS)". Without this populated, even if the auth → nursery lookup existed, it would return nothing.

**What Cultivar does import from shared:** `configureAuth` (correctly — email strategy). The session returned by `auth.useSession()` has `user.id` (Supabase UID). But the leap from `user.id` → `nursery_id` is never made.

**Extra finding: duplicate/ghost auth file.** `packages/cultivar-os/src/lib/shared/supabase/auth.ts` is a byte-for-byte copy of `packages/shared/src/supabase/auth.ts`, nested inside Cultivar's source tree. It imports from `./client` (a relative path to a file that doesn't exist in that location). This is a path-confused artifact of the extraction — it was physically copied into Cultivar rather than imported via `@trace/shared`. It is unused by any Cultivar component. It still uses `STORAGE_KEY = 'IGNITION_OS_DATA'`, which would be wrong for Cultivar in any case.

---

## 2. The Gap — Adopt vs Build

For a second nursery customer to sign up and see only their own data:

### What Already Exists to Adopt

| Item | Location | Completeness |
|------|----------|-------------|
| Email auth login flow | `configureAuth` email strategy | ✅ Complete — already used by Cultivar |
| `SignUp` component inserting into `nurseries` with `owner_id` | `configureAuth.tsx:128` | ✅ Present — but never actually run (all nurseries are seeded, not signed up) |
| `nurseries` table with `owner_id` column | Supabase schema | ⚠️ Column exists but is NULL for all rows |
| `nursery_id` on all key tables (orders, plants, customers, etc.) | Cultivar schema | ✅ Present — all data is already scoped by nursery_id |
| Hooks accepting `nurseryId` as a parameter | `useNursery`, `useModules` | ✅ Present — the plumbing is parameterized, just always gets DEMO_NURSERY_ID |

### What Must Be Built

| Item | Description | Difficulty |
|------|-------------|-----------|
| Populate `nurseries.owner_id` | One SQL UPDATE for LAWNS, then enforce on insert going forward | Trivial |
| Auth context with tenant resolution | After login, fetch the nursery row where `owner_id = auth.uid()`. Store `nursery_id` in React context. | Small — ~50 lines |
| Replace `DEMO_NURSERY_ID` callers | Dashboard.tsx, useModules call site, useNursery call site, api/dashboard.ts fallback | Mechanical — ~10–15 locations |
| Extend `configureAuth` email session | Return `tenant_id` (nursery_id) alongside user in `UseSessionResult` — requires a DB lookup post-login | Medium — needs a post-login hook |
| API layer nursery_id validation | Serverless functions accept `nursery_id` as a param but don't verify the caller owns that nursery. Needs: verify `nurseries.owner_id = auth.uid()` before acting. | Medium — needed for true security |

**Architectural recommendation:** A `NurseryProvider` React context that (a) reads the authenticated user's ID from `auth.useSession()`, (b) queries `nurseries` where `owner_id = user.id`, and (c) exposes `nursery_id` to the component tree. All hooks and pages read `nursery_id` from context instead of importing `DEMO_NURSERY_ID`. This is roughly 60 lines of new code plus mechanical replacement of the constant.

---

## 3. Multi-Location

### What Ignition Built

DataBridge's `SCHEMA` definition (`DataBridge.js:72–97`) sketches a multi-location model:

```js
shop_info: {
  name: 'string',
  is_multi_location: 'boolean',
  global_contact: { phone, email, address, usdot },
  locations: [{
    id: 'string',
    label: 'string',
    phone: 'string',
    email: 'string',
    address: 'string',
    is_primary: 'boolean'
  }]
}
```

`OnboardingWizard.jsx:109` sets `is_multi_location: false` on shop creation.

**Status:** Schema-only. This is a localStorage shape definition, not a Supabase table. No `locations` table exists in the Ignition Supabase schema. No UI module implements multi-location selection, switching, or scoping. The data model was never built beyond the schema comment.

### What Cultivar Has

Nothing. The nurseries table has one row per nursery. LAWNS Tree Farm has a single row. No `locations` table, no location-switching UI.

### Verdict

Multi-location is **not built anywhere, not in shared**. Both verticals would need it built from scratch when required. For LAWNS, this would mean a `nursery_locations` table with a foreign key to `nurseries.id`, plus location-level scoping for orders/plants/customers. This is post-Phase-1 scope.

---

## 4. Role-Based Access

### Ignition — What Exists

**Role model (Ignition-local):**

- `DataBridge.getSystemRoles()` (`DataBridge.js:1057–1068`) defines three canonical roles:
  ```
  ADMIN:    [view_omni, view_hub, view_flux, view_predictive, view_cipher,
             view_stok, view_proc, view_prot, view_port, view_crm,
             view_marketplace, edit_margins, manage_users, approve_payroll]
  TECH:     [view_kosk, view_cipher, view_hub, scan_parts, update_flux]
  CUSTOMER: [view_port, sign_estimates, pay_invoice]
  ```
- `shop_members` table: stores `role`, `sub_role`, `permissions[]` (array) per member
- `DataBridge.authenticate()` returns: `{ role, sub_role, permissions[], allowed[] }` where `allowed` is `permissions.filter(p => p.startsWith('view_')).map(p => p.replace('view_', ''))`
- `IgnitionCore.js:143–158`: Role-based routing — `permissions.includes('ADMIN')` → IgnitionOmni, `permissions.includes('TECH')` → IgnitionKosk, `permissions.includes('CUSTOMER')` → IgnitionPort
- Default seed profiles in `DataBridge.getProfiles()` (lines 784–788): ADMIN/TECHNICIAN/SERVICE/DEVELOPER hard-coded as fallback

**Assessment:** The Ignition role model is feature-complete and working. It is entirely Ignition-local — the definitions, the DB schema, the routing logic, and the session shape all live in DataBridge/IgnitionCore. Nothing has been extracted to shared.

### Cultivar — What Exists

- `configureAuth({ defaultRole: 'owner' })` — every authenticated user gets the role `'owner'`, period.
- Session user: `{ id: user.id, email: user.email, role: 'owner' }`
- No permission array. No sub-role. No role-based routing.
- `PrivateRoute` in Cultivar: simply checks `session` is truthy — authenticated vs not. No role check.
- Effectively, Cultivar has only one access level: "logged in owner."

### Verdict

Cultivar has **no role model** beyond authenticated/unauthenticated. This is acceptable for Phase 0 (single-owner demo). For Phase 1 (Lauren as manager + seasonal staff), roles need to be built. The correct path is:

1. **Adopt Ignition's permission-array pattern** — it's clean and proven
2. **Extract to shared** — define the role/permission types in `packages/shared/src/auth/` 
3. **Add a `nursery_members` table** for Cultivar (analogous to `shop_members` in Ignition)
4. **Update `configureAuth` email strategy** to support role/permission lookup alongside tenant lookup

This is a Phase 1 task, not Phase 0.

---

## 5. The Drift — `shared/src/supabase/auth.ts`

### What It Is

A TypeScript transcription of `DataBridge.authenticate()`, `autoEnrollDevice()`, `hashPin()`, `getTrialStatus()`, and `checkModuleTrialStatus()`. Extracted in the shared module infrastructure work (May 21–22). The comment at the top of the file reads: "Extracted from CAI/DataBridge.js — universal (web + mobile)."

### Who Imports It

**Only one caller:** `packages/shared/src/auth/configureAuth.tsx:4`:
```ts
import { authenticate as pinAuthenticate } from '../supabase/auth';
```

The PIN strategy in `configureAuth` calls `pinAuthenticate(tenantId, pin)`. But:
- Ignition OS never uses `configureAuth` — IgnitionCore calls `DataBridge.authenticate(pin)` directly
- Cultivar uses `configureAuth` with `strategy: 'email'`, not `'pin'`

So `shared/src/supabase/auth.ts` is reachable in theory (via `configureAuth` PIN path) but neither production vertical uses it in practice.

### What's Incomplete

| Issue | Impact |
|-------|--------|
| `STORAGE_KEY = 'IGNITION_OS_DATA'` hardcoded | If a PIN-strategy vertical (e.g., a future Ignition vertical) uses `configureAuth`, it would read/write from `IGNITION_OS_DATA` even if it's a different vertical. Use `storageKeyFor(config.vertical)` from configureAuth instead. |
| `AuthSession.shop_id` field name | Should be `tenant_id` or `entity_id` for shared use. Currently reads wrong semantically for a nursery. |
| `autoEnrollDevice` inserts `shop_id: entityId` | The `member_devices` table has a `shop_id` column (Ignition-specific). A nursery-based vertical would have a `nursery_id` column. The INSERT would fail if the column doesn't exist. |
| `simulateTrialDay` reads/writes `shop_info` key | Ignition-specific key name. |

### Is It Complete Enough to Be the Foundation?

**For PIN verticals via `configureAuth`:** Almost. The PIN auth logic itself is correct and would work if the storage key and session field names were parameterized. The `autoEnrollDevice` function has the hardest coupling — it writes to a DB column name that is Ignition-specific.

**For email verticals (Cultivar):** Not applicable. Cultivar's auth goes through Supabase Auth, not through PIN hashing. The gap for Cultivar is not in this file; it's the missing auth-user → nursery_id join.

### Path Forward

**"Finish the extraction" for PIN verticals:**
- Parameterize `STORAGE_KEY` — accept or derive it per vertical
- Rename `AuthSession.shop_id` → `AuthSession.entity_id` (or accept a field name config)
- Parameterize the `shop_id` column name in `autoEnrollDevice` (or split device enrollment into a vertical-specific responsibility)

**"Build new capability" for email verticals:**
- A `resolveEmailTenant(userId, tenantTable)` utility that queries the tenant table for `owner_id = userId` and returns the tenant_id. This doesn't exist anywhere — it must be added to `configureAuth`'s email strategy.

---

## 6. Incidental Findings

### Finding A — Ghost auth file in cultivar-os

`packages/cultivar-os/src/lib/shared/supabase/auth.ts` is a copy of `packages/shared/src/supabase/auth.ts` nested inside the cultivar-os source tree. It imports from `./client` (a relative path that doesn't exist at that location). It is referenced by no Cultivar component. It still uses `STORAGE_KEY = 'IGNITION_OS_DATA'`. It should be deleted — it is dead code that will mislead future readers into thinking Cultivar uses PIN auth.

### Finding B — `shared/src/supabase/types.ts` lists stale vertical ID

`VerticalId` union type at line 76 includes `'pantry-os'` and `'coolrunnings'`. `'pantry-os'` was renamed to `'kinna-os'` in Session 1b. `'coolrunnings'` is unknown. Update to reflect current verticals.

### Finding C — `api/dashboard.ts` hardcodes the LAWNS nursery_id as a fallback

`packages/cultivar-os/api/dashboard.ts:10`:
```ts
const nurseryId = (req.query.nursery_id as string) || 'a1b2c3d4-0000-0000-0000-000000000001';
```

The fallback is the LAWNS seed ID. When the multi-tenant work is done and the frontend passes a real nursery_id, this fallback becomes a silent failure mode — a missing param returns LAWNS data instead of an error. Change the fallback to `null` and return 400 when no nursery_id is provided.

### Finding D — No `configureAuth` usage in Ignition

Ignition OS imports nothing from `@trace/shared`. All auth, storage, and query logic runs through DataBridge. When Ignition OS is reactivated and the shared extraction is finished, the migration path is:
1. Import `configureAuth({ strategy: 'pin', vertical: 'ignition-os', tenantTable: 'shops', ... })` in a new `ignition-os/lib/auth.ts`
2. Delete the inline PIN auth from DataBridge.js
3. Resolve Finding A in the RLS audit (missing `supabase.js`)

This is non-trivial refactor work but it is the right target architecture per PLATFORM_STRATEGY.md.

---

## 7. Adopt-vs-Build Decision Table

| Capability | Adopt from Ignition | Adopt from shared | Build new | Notes |
|-----------|---------------------|-------------------|-----------|-------|
| Email login | — | ✅ `configureAuth` email | — | Already in place |
| PIN login | ⚠️ Pattern exists | ⚠️ Partial extraction | — | shared/auth.ts needs finishing |
| Tenant resolution (email, Cultivar) | — | ⚠️ configureAuth has the shape | ✅ `NurseryProvider` context | Missing: auth.uid() → nursery_id lookup |
| Tenant resolution (PIN, Ignition) | ✅ DataBridge pattern | ⚠️ shared/auth.ts almost complete | — | Just finish the extraction |
| Tenant-scoped DB queries | ✅ DataBridge.db.* pattern | — | ✅ Replace DEMO_NURSERY_ID | Mechanical replacement |
| Role-based access | ✅ shop_members + permission arrays | — | ✅ nursery_members table | Phase 1 task |
| Role-based routing | ✅ IgnitionCore.js routing pattern | — | ✅ Implement for Cultivar | Phase 1 task |
| Multi-location | — | — | ✅ From scratch | No vertical has this built |
| Trial clock | ✅ DataBridge.getShopTrialStatus() | ✅ shared/auth.ts getTrialStatus() | — | Already extracted, needs wiring |
| Device enrollment | ✅ DataBridge.autoEnrollDevice() | ⚠️ shared/auth.ts autoEnrollDevice() | — | Column name coupling to Ignition schema |

---

## 8. Recommended Build Sequence (Pre-KINNA)

Before building a third vertical, these items should be resolved in this order:

**Step 1 — Immediate (before demo follow-up):** Populate `nurseries.owner_id` for the LAWNS row. One SQL UPDATE. Unblocks all multi-tenant work.

**Step 2 — Post-demo, pre-second-customer:** Build `NurseryProvider` context that resolves `nursery_id` from `auth.uid()`. Replace all `DEMO_NURSERY_ID` imports. Update `api/dashboard.ts` fallback to 400. This is the minimum viable multi-tenancy: a second nursery can sign up and see only their data.

**Step 3 — Before Ignition OS dry run reactivation:** Finish `shared/src/supabase/auth.ts` extraction (parameterize storage key, rename `shop_id` field, resolve `autoEnrollDevice` column-name coupling). Wire Ignition to import from `configureAuth` instead of DataBridge inline copies.

**Step 4 — Before KINNA Phase 1:** Extract the role/permission model from Ignition to shared. Define `people_members` table (KINNA) or `nursery_members` table (Cultivar) following the `shop_members` pattern. Update `configureAuth` to support role lookup alongside tenant lookup.

**Step 5 — Before any multi-location customer:** Design and build `nursery_locations` / `shop_locations` pattern from scratch. Neither vertical has this.

---

*TRACE Enterprises · Built with CAI*
*Read-only audit — no code changed, no commits made.*
