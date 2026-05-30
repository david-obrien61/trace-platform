# TRACE Platform — Session Summary (2026-05-29/30)

## Context

This document summarizes two consecutive Claude Code sessions on the TRACE platform monorepo (`github.com/david-obrien61/trace-platform`). The platform is a composable AI operating system for owner-operated small businesses. Two active verticals: **Cultivar OS** (nursery/garden center, demo-ready) and **Ignition OS** (diesel/auto shop, in build). Shared code lives in `packages/shared/`.

---

## What Was Accomplished

### 1. Ignition OS — Legacy `nurseries` Cleanup (ufsgqckbxdtwviqjjtos Supabase)

The old Ignition OS Supabase project (separate from Cultivar's) had leftover `nurseries` table data from a prior session that was blocking user deletion. Walked through a full cascading delete in dependency order:

```
plant_events → order_addons → order_items → orders → customers
→ addons → plants → nurseries → auth.users
```

Two FK constraint errors were hit and resolved in sequence. The ufsgqckbxdtwviqjjtos project is now clean — no legacy nursery rows.

---

### 2. Ignition OS — OnboardingWizard Smoke Test ✅

The new `OnboardingWizard.jsx` (created prior session) was verified end-to-end:

- Steps: WELCOME → SHOP → ACCOUNT → PIN → DONE
- `finalize()` creates: `auth.users` (Supabase signup) → `businesses` row → `shops` row (same UUID) → `shop_members` (ADMIN, pin_hash) → `DataBridge.setShopId/setShopName` → saves `current_user` session
- PIN hashing: `SHA-256(${shopId}:${pin})` — matches `DataBridge.hashPin()` exactly
- Demo shop "JB Auto" created successfully, PIN verified, dashboard launched

**Two bugs fixed in CoreApp.jsx:**
- `IdentityMatrix` was rejecting PINs longer than 4 digits: `pin.length !== 4` → `pin.length < 4 || pin.length > 6`
- After wizard completion, `shopReady` was staying `false` because the ownerBusinessId sync effect was short-circuiting: added explicit `setShopReady(true)` + session restore in `onComplete` handler

---

### 3. Ignition OS — `useEffect` Crash Fixes

Inventory tab (`IgnitionStok.jsx`) and Audit tab (`IgnitionAudit.jsx`) were both crashing with "useEffect is not defined." Root cause: `useEffect` used in the component body but not included in the React import destructure. Fixed both files. Audited all 27 Ignition modules — only these two had the issue.

---

### 4. PMI Module — Built in `packages/shared/`

A Preventive Maintenance & Inspection (PMI) module was built as a shared component usable by all verticals.

**Database migration:** `supabase/migrations/20260529_pmi_shared.sql`
- `pmi_assets` table: `business_id`, name, asset_type, make, model, serial_number, year, `pmi_interval_days`, `last_service_at`, notes, `is_active`
- `pmi_service_logs` table: `asset_id`, `business_id`, service_type, performed_by, notes, cost, `performed_at`
- RLS on both via `business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())`
- Must run AFTER businesses migration A

**Shared component:** `packages/shared/src/modules/PMI.tsx`
- Props: `{ businessId, assetLabel, assetTypes[], serviceTypes[] }` — fully configurable per vertical
- Status logic: OVERDUE / DUE_SOON (within 30 days) / OK / NONE based on `pmi_interval_days + last_service_at`
- Two views: asset list with status badges, and asset detail with service history + log form
- All inline styles (no Tailwind — compatible with both verticals)

**Cultivar OS integration:**
- `packages/cultivar-os/src/pages/PMI.tsx` — wraps shared PMI with cultivar asset/service types (Tractor, Truck, Trailer, Loader, Sprayer, Mower, Chainsaw, etc.)
- Route `/pmi` added behind `PrivateRoute` in router
- `assetLabel="Equipment"` for nursery context

---

### 5. Tailwind Tech Debt — Documented and Contained

Resolved the "do we keep Tailwind?" question. Decision: **no big-bang rewrite, controlled exit.**

- Ignition OS uses Tailwind via CDN script tag in `index.html` (~1923 className lines across 27 modules)
- Cultivar OS uses inline styles only
- Shared modules must use inline styles (required for Cultivar compat)
- Documented as **Tech Debt #14** in `CLAUDE.md`: convert each Ignition module to inline styles when it moves to `packages/shared/`, never before
- Rule added: never add new `className`/Tailwind usage to any file going forward
- Comment added to `packages/ignition-os/index.html` documenting the debt inline

---

### 6. Canonical Platform Vocabulary — Written into PLATFORM_STRATEGY.md

To stop naming drift across verticals (Ignition calls it "Hub", Cultivar calls it "Dashboard", etc.), a canonical vocabulary table was written into `PLATFORM_STRATEGY.md` as **PART 11**.

Three tables:

**Module Names** — one name per feature concept across all verticals:

| Canonical Name | Ignition Current | Cultivar Current | Status |
|---|---|---|---|
| Market | IgnitionHub (tile grid) | Dashboard (partial) | Adopt in both |
| PMI | — (new) | — (new) | In shared ✅ |
| Audit | IgnitionAudit | — | Ignition only |
| Admin | IgnitionAdmin | Settings | Converge |
| Assets | IgnitionStok | — | Ignition only |
| Orders | IgnitionPort | Orders | Cultivar done |
| Team | IgnitionCipher | — | Ignition only |
| Campaigns | — | Campaigns | Cultivar done |
| Delivery | IgnitionHub (route) | DeliveryRoute | Shared pending |

**Shared Data Concepts** — canonical table/column names:

| Term | Definition |
|---|---|
| `business_id` | Universal tenant FK on all operational tables |
| `businesses` | Universal tenant table (replaces nurseries, shops root) |
| `service_offerings` | Replaces transport_method enum + addons + opportunity_items |
| `pmi_assets` | Equipment/asset registry |
| `pmi_service_logs` | Service history |
| `opportunity_items` | Per-business upsell catalog |
| `leakage_flag` | Boolean on orders when revenue opportunity declined |

**Code Identifiers** — canonical names in source code:

| Use | Canonical |
|---|---|
| Tenant ID variable | `businessId` |
| Context hook | `useBusinessContext()` |
| Provider component | `BusinessProvider` |
| Demo env var | `VITE_DEMO_BUSINESS_ID` |
| Accounting token | `accounting_type`, `accounting_token` |

---

### 7. Shared Extraction Roadmap — Audited and Documented

A cross-vertical audit found 18 extraction candidates. The roadmap was documented in `CLAUDE.md` under "Shared Extraction Roadmap" with three tiers:

**Immediate (LOW complexity):** MarginEngine, statusColors, FormField, ProgressBar, dateHelpers, formatCurrency, Skeleton

**Before KINNA-OS Phase 1 (MEDIUM):** Trial/subscription clock, Leakage detector, Module activation hook, OnboardingWizard shell

**Do NOT extract yet:** DataBridge (too coupled to Ignition local-first), QB invoice pattern (wait for KINNA-OS accounting requirements), CSV importer and hardware registry (Ignition-specific, no cross-vertical need)

---

### 8. 7 Shared Utilities Built and Shipped ✅

All 7 "Immediate" extractions from the roadmap were implemented this session:

**`packages/shared/src/pricing/marginEngine.ts`**
- `calculateRetail(cost)` — slab pricing: ≤$50 → 4×, ≤$200 → 2×, ≤$1000 → 1.5×, >$1000 → 1.25×, rounds to nearest .99
- `calculateMargin(cost, retail)` — margin percentage
- Ported from `IgnitionMobile/CodeBaseB/MarginEngine.js`

**`packages/shared/src/utils/formatCurrency.ts`**
- `formatDollars(n)` — `$1,234` (whole dollars, dashboard tiles)
- `formatMoney(n)` — `$12.34` (two decimals, line items)
- `formatMoneyOrDash(n)` — returns `—` for null/undefined

**`packages/shared/src/utils/dateHelpers.ts`**
- `formatDateShort(iso)` — "May 29" (omits year if current year)
- `formatDateTimeShort(iso)` — "May 29, 3:45 PM"
- `todayRange()` — `{ start, end }` ISO strings for Supabase `.gte/.lte` queries
- `daysBetween(from, to)` — positive = future

**`packages/shared/src/utils/statusColors.ts`**
- `STATUS_COLORS` — ok / warning / critical / inactive / info tokens (bg, text, border)
- `PMI_STATUS_COLORS` — OVERDUE / DUE_SOON / OK / NONE aliases
- `ORDER_STATUS_COLORS` — leakage / clean aliases

**`packages/shared/src/components/FormField.tsx`**
- Label + required marker + error message + hint text wrapper
- Shared `inputStyle` and `inputErrorStyle` constants for `<input>/<select>/<textarea>`
- Inline styles only

**`packages/shared/src/components/ProgressBar.tsx`**
- Configurable fill color, track color, height
- `role="progressbar"` + `aria-valuenow/min/max` for accessibility
- Smooth CSS transition on value change

**`packages/shared/src/components/Skeleton.tsx`**
- Pulsing skeleton block (CSS keyframe injected once into `<head>`)
- `SkeletonCard` convenience variant for card-shaped placeholders

All 7 exported from `packages/shared/src/index.ts`. Both builds verified clean: **cultivar 2168 modules ✅, ignition 1823 modules ✅**. Committed and pushed (`d78b570`).

---

## Current State

### What's Working
- Cultivar OS: full demo flow — QR scan → checkout → QB invoice → dashboard metrics → orders → delivery routing → social drafts → campaigns
- Ignition OS: OnboardingWizard smoke-tested ✅, all 27 modules loading without crashes, build clean
- Shared: BusinessProvider, PMI module, 7 new utilities, all properly exported

### Critical Blockers (David must run manually)

Cultivar OS is **broken in production** until these SQL migrations run in `bgobkjcopcxusjsetfob`:

1. `20260529_businesses_a_create_tables.sql` — creates `businesses`, `nursery_profiles`
2. `20260529_businesses_b_opportunity_items.sql` — creates `opportunity_items`
3. `20260529_businesses_c_add_business_id.sql` — backfills `business_id`, inserts LAWNS row
4. `20260529_businesses_d_update_rls.sql` — replaces all RLS policies
5. `20260529_businesses_f_service_offerings.sql`
6. `20260529_businesses_g_compliance_and_customer_match.sql`
7. `20260529_pmi_shared.sql` — after A, creates PMI tables
8. `20260529_businesses_e_cleanup.sql` — **hold until smoke test passes**

Without migrations A–D, `BusinessProvider` returns `no_business` for all users and the app redirects everyone to `/onboarding`.

### Next Build Priorities
1. Online Shop (`/shop`) — all available plants, filterable, same checkout flow
2. PMI tile on Cultivar OS Dashboard tile grid (route exists at `/pmi`, no tile yet)
3. 4 pre-KINNA-OS extractions (trial clock, leakage detector, module activation hook, OnboardingWizard shell)
4. Market naming decision (canonical label for the module activation tile grid — deferred)

---

## Key Files Added This Session

```
packages/shared/src/pricing/marginEngine.ts          (implemented)
packages/shared/src/utils/formatCurrency.ts          (new)
packages/shared/src/utils/dateHelpers.ts             (new)
packages/shared/src/utils/statusColors.ts            (new)
packages/shared/src/components/FormField.tsx         (new)
packages/shared/src/components/ProgressBar.tsx       (new)
packages/shared/src/components/Skeleton.tsx          (new)
packages/shared/src/index.ts                         (updated — all new exports)
packages/shared/src/modules/PMI.tsx                  (prior work, noted)
packages/cultivar-os/src/pages/PMI.tsx               (prior work, noted)
supabase/migrations/20260529_pmi_shared.sql          (pending David run)
PLATFORM_STRATEGY.md                                 (PART 11 — vocabulary)
CLAUDE.md                                            (Tech Debt #14, extraction roadmap)
packages/ignition-os/index.html                      (Tech Debt #14 comment)
packages/ignition-os/CoreApp.jsx                     (PIN length fix, onComplete fix)
packages/ignition-os/modules/IgnitionStok.jsx        (useEffect import fix)
packages/ignition-os/modules/IgnitionAudit.jsx       (useEffect import fix)
```
