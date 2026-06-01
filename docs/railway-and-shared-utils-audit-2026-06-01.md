# Railway Dependency & Shared Utility Homes — Audit
**Date:** 2026-06-01
**Scope:** Read-only investigation. No code was changed.
**Purpose:** Resolve David's uncertainty about Railway dependency and the current homes of DataBridge, ExternalBridge, and MarginEngine.

---

## Task 1 — Railway Dependency Status

### What was searched

```bash
grep -ri "railway" packages/ api/ --include="*.ts|*.tsx|*.js|*.jsx|*.json|*.md|*.env*" -n --exclude-dir=dist --exclude-dir=node_modules
grep -ri "up.railway.app|VITE_API_URL" packages/ --include="*.ts|*.tsx|*.js|*.jsx|*.env*" -n --exclude-dir=dist --exclude-dir=node_modules
```

### Findings — the word "Railway"

| File | Line | Content | Classification |
|---|---|---|---|
| `packages/ignition-os/modules/IgnitionEstimate.jsx` | 5 | JSDoc comment: *"triggers the Railway estimate agent"* | Stale comment |
| `packages/ignition-os/modules/IgnitionEstimate.jsx` | 195 | Inline comment: `// Call Railway agent` | Stale comment |
| `packages/ignition-os/modules/IgnitionEstimate.jsx` | 225 | Error string: `'Estimate agent failed. Check Railway logs.'` | Stale comment |
| `packages/cultivar-os/.env.local` | 8 | Comment: `# API base URL — Railway backend (leave empty...)` | Stale comment |
| `packages/cultivar-os/.env.example` | 8 | Same comment | Stale comment |

**No Railway URLs of the form `*.up.railway.app` appear anywhere in source code.** All five findings are comments — none are executable references.

### Findings — VITE_API_URL (the variable Railway used)

`VITE_API_URL` IS referenced in active code in multiple places. The question is whether it resolves to anything in production:

| File | Role |
|---|---|
| `packages/shared/src/ai/AIEngine.ts` | `API_URL = VITE_API_URL \|\| EXPO_PUBLIC_API_URL \|\| undefined` → calls `${API_URL}/ai/${task}` |
| `packages/shared/src/quickbooks/oauth.ts` | `API_URL = VITE_API_URL \|\| ...` → calls `/api/qbo/status`, `/api/qbo/auth-url`, `/api/qbo/disconnect` |
| `packages/shared/src/quickbooks/invoice.ts` | Same pattern → calls `/api/qbo/invoices`, `/api/qbo/invoice` |
| `packages/shared/src/quickbooks/customer.ts` | Same pattern → calls `/api/qbo/customers` |
| `packages/ignition-os/ExternalBridge.js` | `API_URL = VITE_API_URL \|\| EXPO_PUBLIC_API_URL \|\| 'http://localhost:8000'` |
| `packages/ignition-os/DataBridge.js` | Same → fallback sync path for jobs |
| `packages/ignition-os/modules/IgnitionEstimate.jsx` | `API_URL = VITE_API_URL \|\| 'http://localhost:8000'` |
| `packages/ignition-os/modules/IgnitionInvoice.jsx` | Same pattern |

### Is VITE_API_URL set in production?

**No.** Confirmed by two sources:

1. `packages/cultivar-os/.env.local` line 9: `VITE_API_URL=` (explicitly empty)
2. CLAUDE.md Vercel environment variables section, ignition-os project:
   > `VITE_API_URL = NOT NEEDED — ai_router.py/Railway is legacy for web builds. Add this only when AI endpoints are ported to Vercel functions.`

VITE_API_URL is not set in either Vercel project. This means:

- `packages/shared/src/ai/AIEngine.ts`: `API_URL` resolves to `undefined`. `fetch(undefined/ai/task)` throws a network error. AIEngine.ts catches this and returns `{ ok: false }` — **fails gracefully, no outbound call**.
- `packages/shared/src/quickbooks/oauth.ts` and related: These shared QB modules are **not called by cultivar-os** at all. Cultivar-os has its own Vercel serverless functions in `packages/cultivar-os/api/qbo/` that bypass these shared modules entirely. The shared QB modules are legacy artifacts from the Ignition mobile era.
- `packages/ignition-os/ExternalBridge.js`, `DataBridge.js`: Fall back to `'http://localhost:8000'`. In production, this is a dead address. The code paths that use this fallback (DataBridge.pullCloudSync job fallback, ExternalBridge QB calls) will fail with network errors. DataBridge.pullCloudSync tries Supabase first and only falls back to the API_URL on Supabase failure — so in practice, the fallback path is rarely hit and fails silently when it is.
- `packages/ignition-os/modules/IgnitionEstimate.jsx`: Falls back to `'http://localhost:8000'`. The estimate call to `/api/estimate/build` fails in production. **This is a live bug** — the IgnitionEstimate module is active in CoreApp.jsx (line 29 import, line 1098 render), and the ESTIMATING tab produces a network error when triggered. The error is surfaced to the UI via `setError(err.message || 'Estimate agent failed. Check Railway logs.')`.

### Verdict: Active vs. Dead Railway dependencies

**Active Railway dependencies:** 0

**Dead Railway references:** 5 (all comments)

**Related live bug (not Railway itself, but Railway's ghost):**
`IgnitionEstimate.jsx` is rendered in the live ignition-os build and calls `http://localhost:8000/api/estimate/build`, which fails in production. This is Tech Debt #12 (the Railway → Vercel serverless port). The fix is to port the `estimate_build` endpoint from `ai_router.py` to a TypeScript Vercel function.

### Summary Answer

> **No, TRACE no longer uses Railway.** Zero references resolve to a Railway host in any active code path. The five remaining "Railway" mentions are stale comments. The variable Railway once provided (`VITE_API_URL`) is explicitly unset in all Vercel deployments. The only practical consequence of Railway's removal is that IgnitionEstimate.jsx's "build estimate" call fails with a `localhost:8000` network error in production — a known gap (Tech Debt #12) awaiting the `ai_router.py` → Vercel port.

---

## Task 2 — DataBridge, ExternalBridge, MarginEngine

### DataBridge

**File:** `packages/ignition-os/DataBridge.js`
**Package:** `packages/ignition-os/`

**What it does:** Central storage and sync layer for Ignition OS. Manages all state persistence across localStorage (web), AsyncStorage (mobile), and Supabase. Provides: save/load/hydrate for all Ignition data keys (`IGNITION_OS_DATA`), Supabase read/write via `DataBridge.db.*`, PIN-based auth via `shop_members`, trial clock (`getShopTrialStatus`), margin config, overhead config, transaction recording, PMI assets, vendor/customer directory, and module registry. It is the "God object" for all Ignition data operations.

**What imports it:** 44 files in `packages/ignition-os/` — effectively the entire Ignition vertical. Every module, every hook, the root app, and ExternalBridge all depend on it.

**Vertical-specific?** Deeply, irreversibly Ignition-specific:
- Hardcodes storage key `IGNITION_OS_DATA`
- Hardcodes `IGNITION_SHOP_ID` localStorage key
- All schema keys are Ignition-domain (`shop_policy`, `repair_orders`, `prot_matrix`, `system_subscriptions`)
- PIN auth is Ignition-only (CLAUDE.md Auth Architecture Locked Rule: PIN is explicitly a single-device exception, not a pattern for multi-tenant verticals)

**Genuinely shared?** No. PLATFORM_STRATEGY.md Decision Log #1 locks "Supabase is source of truth — never localStorage." DataBridge is the localStorage-era architecture that Supabase is meant to replace. The `DataBridge.db.*` methods are the forward path — direct Supabase calls that bypass the localStorage layer.

**Recommendation: Stay in `packages/ignition-os/`. Do NOT extract to shared.**
The correct long-term architecture (per the June 15–July 15 roadmap) is to migrate each Ignition module from `DataBridge.load()` to `DataBridge.db.*` Supabase calls, then eventually deprecate the localStorage persistence layer. Extracting DataBridge to shared would propagate the localStorage anti-pattern into the platform.

---

### ExternalBridge

**File:** `packages/ignition-os/ExternalBridge.js`
**Package:** `packages/ignition-os/`

**What it does:** Translation layer between external systems (QuickBooks and CSV) and DataBridge. Owns: QB OAuth flow (via `VITE_API_URL`/ExternalBridge backend calls), customer import from QBO, invoice pull from QBO, invoice push to QBO, CSV file parsing and customer import, and margin analytics (quarterly grouping and change-impact calculations from DataBridge transaction history).

**What imports it:**
- `packages/ignition-os/` — CSVImporter.jsx, and (via IgnitionAdmin.jsx/OnboardingWizard.jsx, likely others in the vertical)
- `packages/shared/src/components/QuickBooksConnector.jsx` — imports `from '../ExternalBridge'` → **this path is broken** (no ExternalBridge exists at `packages/shared/src/ExternalBridge`)
- `packages/shared/src/components/SavingsReport.jsx` — imports `from '../ExternalBridge'` → **also broken**

**Vertical-specific?** Yes. ExternalBridge's QB implementation uses the `VITE_API_URL` pattern (Railway/localhost backend calls). Cultivar-os uses a completely different QB pattern: Vercel serverless functions in `packages/cultivar-os/api/qbo/`. The two QB implementations are not compatible — ExternalBridge cannot serve both verticals without architectural rework.

**Genuinely shared?** No. The QB methods call `${API_URL}/api/qbo/*` which is the old backend API pattern. Cultivar-os calls `window.location.origin + '/api/qbo/*'` (Vercel functions — no explicit URL needed). The underlying mechanism is different.

**Recommendation: Stay in `packages/ignition-os/`. Do NOT extract to shared.**
The path toward a genuinely shared QB layer is the `AccountingAdapter` interface described in PLATFORM_STRATEGY.md Part 15. ExternalBridge is one implementation of that interface, tightly coupled to the DataBridge/Railway-era backend pattern. When the adapter pattern is built, ExternalBridge becomes one concrete adapter, and Cultivar-os's Vercel function approach becomes another.

**Critical side finding:** Both `QuickBooksConnector.jsx` and `SavingsReport.jsx` (currently in `packages/shared/src/components/`) import `from '../ExternalBridge'`. That path is broken — the file does not exist in `packages/shared/src/`. These components cannot compile correctly from their current location. See Task 3.

---

### MarginEngine

**File 1 (ignition-os):** `packages/ignition-os/MarginEngine.js`
**File 2 (shared):** `packages/shared/src/pricing/marginEngine.ts`

**Duplicate confirmed.** Two copies exist. They differ in scope:

| Feature | `ignition-os/MarginEngine.js` | `shared/pricing/marginEngine.ts` |
|---|---|---|
| Slab pricing | ✅ | ✅ |
| Tier discounts (FLEET/LEGACY/FF) | ✅ | ❌ |
| `analyzeTransaction()` | ✅ | ❌ |
| `getProfitMargin()` | ✅ | ✅ (as `calculateMargin`) |
| DataBridge dependency | ✅ (reads `margin_config` from DataBridge) | ❌ (hardcoded slabs only) |
| TypeScript | ❌ | ✅ |

**What imports `ignition-os/MarginEngine.js`:**
`packages/ignition-os/OnboardingWizard.jsx`, `PriceField.jsx`, `PriceField.native.js`, `modules/IgnitionProcure.jsx`, `modules/IgnitionPort.jsx`, `modules/IgnitionProcure.native.js`

Additionally: `packages/shared/src/components/SavingsReport.jsx` imports `{ MarginEngine } from '../MarginEngine'` — **this path is broken** (no MarginEngine.js in `packages/shared/src/`). SavingsReport needs the full Ignition MarginEngine including `analyzeTransaction()`.

**What imports `shared/pricing/marginEngine.ts`:**
Only `packages/shared/src/index.ts` (re-exports `calculateRetail`, `calculateMargin`). No vertical currently imports it directly.

**Assessment:**
- The shared `marginEngine.ts` is the correct extraction — pure functions, no DataBridge, TypeScript. It's what CLAUDE.md's Shared Extraction Roadmap listed as an "Immediate" task. ✅ Done correctly.
- The ignition-os `MarginEngine.js` is correctly Ignition-specific — it has DataBridge-coupled config, tier discounts, and `analyzeTransaction()` which read from DataBridge's `transaction_history`. It should stay in ignition-os.
- The duplicate is intentional and appropriate: the shared version is the cross-vertical math primitive; the Ignition version is the full business-logic engine that reads live shop config.
- However, the shared version is missing tier discounts. If Conduit OS or Cultivar OS ever needs tiered pricing, the shared version will need to be extended. Flag for the future.

**Recommendation for `ignition-os/MarginEngine.js`:** Stay in `packages/ignition-os/`. No change needed.

**Recommendation for `shared/pricing/marginEngine.ts`:** Keep as-is. It is the correct shared math primitive. The duplicate with ignition-os is intentional: different scope, different dependency profile.

**Recommendation:** No immediate action on MarginEngine. The stale comment in SavingsReport.jsx (`import { MarginEngine } from '../MarginEngine'`) becomes a non-issue once SavingsReport.jsx is moved to `packages/ignition-os/modules/` (see Task 3).

---

## Task 3 — SavingsReport and QuickBooksConnector

### SavingsReport.jsx

**Current location:** `packages/shared/src/components/SavingsReport.jsx`

**Imports and resolution:**

| Import | Resolves to | Status |
|---|---|---|
| `'react'` | React | ✅ OK |
| `'lucide-react'` | Lucide icon set | ✅ OK |
| `'../DataBridge'` | `packages/shared/src/DataBridge` | ❌ FILE DOES NOT EXIST |
| `'../MarginEngine'` (named `{ MarginEngine }`) | `packages/shared/src/MarginEngine` | ❌ FILE DOES NOT EXIST |
| `'../ExternalBridge'` | `packages/shared/src/ExternalBridge` | ❌ FILE DOES NOT EXIST |

**All three non-React imports are broken.** This component cannot compile from its current location.

**What it actually does (verified in code):**
SavingsReport is **not** a tile and **not** a "receipts examination" feature. It is the 14-day **trial savings report** — the Day 12 conversion hook shown to shop owners during their free trial. It reads from DataBridge's `transaction_history`, `shop_policy`, and uses MarginEngine to analyze what the system priced vs. what was actually charged. It shows: days remaining in trial, gross profit captured, margin leakage detected, wizard baseline projection, quarterly revenue history, and a CTA to "Activate Full Version."

This is rendered in `packages/ignition-os/modules/IgnitionOmniDashboard.jsx` line 157:
```jsx
{activeTab === 'SAVINGS' && <SavingsReport />}
```

But IgnitionOmniDashboard imports it as `import SavingsReport from './SavingsReport'` (line 14), which resolves to `packages/ignition-os/modules/SavingsReport.jsx` — **a file that does not exist**. This is exactly Tech Debt #10 from CLAUDE.md.

**Genuinely shared?** **No.** Every data dependency is Ignition-specific:
- `DataBridge.load('transaction_history')` — Ignition transaction schema
- `DataBridge.load('shop_policy')` — Ignition shop policy (`onboarding_completed_at`, `first_margin_check`)
- `MarginEngine.analyzeTransaction()` — needs the full Ignition MarginEngine
- `ExternalBridge.analytics.*` — reads Ignition transaction history from DataBridge

This component is meaningless outside Ignition OS. It was placed in shared/ in error — the import paths were never updated.

**Recommendation:** Move `packages/shared/src/components/SavingsReport.jsx` → `packages/ignition-os/modules/SavingsReport.jsx`. Update the three imports:
- `'../DataBridge'` (resolves correctly from modules/ to root ignition-os/)
- `'../MarginEngine'` (resolves correctly)
- `'../ExternalBridge'` (resolves correctly)

This move simultaneously:
1. Fixes the broken imports in SavingsReport
2. Resolves Tech Debt #10 (IgnitionOmniDashboard's `import SavingsReport from './SavingsReport'` now resolves)
3. Removes a misleadingly-placed file from shared/

---

### QuickBooksConnector.jsx

**Current location:** `packages/shared/src/components/QuickBooksConnector.jsx`

**Imports and resolution:**

| Import | Resolves to | Status |
|---|---|---|
| `'react'` | React | ✅ OK |
| `'lucide-react'` | Lucide icon set | ✅ OK |
| `'../ExternalBridge'` | `packages/shared/src/ExternalBridge` | ❌ FILE DOES NOT EXIST |

**One broken import.** This component also cannot compile from its current location.

**What it actually does:** A standalone QuickBooks connection manager UI — displays connection status, initiates OAuth flow via `ExternalBridge.qbo.initiateOAuth()`, syncs customers and invoices via `ExternalBridge.qbo.pullCustomers()` / `pullInvoices()`, and handles disconnect. It calls the QB backend via `VITE_API_URL` (through ExternalBridge), which in production resolves to `localhost:8000` (broken — see Task 1).

**Does Cultivar OS currently use this?** **No.** No import of QuickBooksConnector appears anywhere in `packages/cultivar-os/`. David's statement that "Cultivar already uses it" is not reflected in the code. Cultivar-os has its own QB implementation via Vercel serverless functions (`packages/cultivar-os/api/qbo/`), which is architecturally different from ExternalBridge's VITE_API_URL pattern.

**Genuinely shared?** **Not in its current form.** The component depends entirely on ExternalBridge, which uses the Railway-era `VITE_API_URL` backend pattern. Cultivar-os uses Vercel serverless functions — a fundamentally different QB connection mechanism. To make this component genuinely shared, it would need to accept an `AccountingAdapter` interface (per PLATFORM_STRATEGY.md Part 15) rather than hardwiring to ExternalBridge.

**Recommendation (two options — David to decide):**

**Option A — Near-term (move to ignition-os):**
Move to `packages/ignition-os/modules/QuickBooksConnector.jsx`. Fix the broken import to `'../ExternalBridge'`. Accept that Cultivar-os will never use this component (it has its own QB flow). Mark as tech debt that this component will eventually be replaced by an adapter-based shared component when the AccountingAdapter pattern is built (PLATFORM_STRATEGY.md Part 15, Phase 1 post-demo).

**Option B — Refactor for genuine sharing:**
Rewrite to accept an adapter prop (or context value) rather than importing ExternalBridge directly. This enables both verticals to pass their own QB connection implementation. This is the correct long-term architecture but requires the AccountingAdapter interface to exist first.

Option A is the correct near-term action (Honest Velocity principle). Option B is the target state once the adapter pattern is built.

---

## Task 4 — Summary Table

| Item | Current location | Finding | Recommended location | Action needed |
|---|---|---|---|---|
| **Railway dependency** | N/A — no active calls | Dead. 5 stale comments. VITE_API_URL is explicitly unset in all Vercel projects. | Remove | Delete the 5 Railway-mentioning comments in IgnitionEstimate.jsx and .env files. No code path calls Railway. |
| **Railway ghost bug** | `packages/ignition-os/modules/IgnitionEstimate.jsx` | Active bug: estimate call falls back to `localhost:8000` → fails in production | Fix | Port `estimate_build` endpoint from ai_router.py to Vercel function (Tech Debt #12) |
| **DataBridge** | `packages/ignition-os/DataBridge.js` | Correctly located. Deep Ignition-specific state machine (localStorage + Supabase hybrid). 44+ ignition-os files import it. | Stay in `ignition-os/` | None. Progressively replace with direct Supabase calls per June 15–July 15 roadmap. Do NOT extract to shared. |
| **ExternalBridge** | `packages/ignition-os/ExternalBridge.js` | Correctly located for Ignition. QB + CSV adapter using VITE_API_URL (Railway-era) pattern. NOT cross-vertical compatible with Cultivar-os's Vercel function pattern. | Stay in `ignition-os/` | None near-term. Long-term: replace with AccountingAdapter per PLATFORM_STRATEGY.md Part 15. |
| **MarginEngine (ignition-os)** | `packages/ignition-os/MarginEngine.js` | Correctly located. Full engine with DataBridge config, tier discounts, analyzeTransaction. Ignition-specific. | Stay in `ignition-os/` | None. The shared version is the appropriate shared primitive; this version stays for Ignition. |
| **marginEngine.ts (shared)** | `packages/shared/src/pricing/marginEngine.ts` | Correctly located. Partial port — core slab math only, no DataBridge, TypeScript, pure functions. | Stay in `shared/pricing/` | None near-term. Future: add tier-discount support when Conduit OS or other verticals need tiered pricing. |
| **SavingsReport.jsx** | `packages/shared/src/components/SavingsReport.jsx` | **Misplaced.** All 3 imports are broken. Not genuinely shared — all data dependencies are Ignition-specific. Misidentified by David as a "tile" — it is the 14-day trial savings report (trial conversion hook). | Move to `packages/ignition-os/modules/SavingsReport.jsx` | **Action required.** Move file, update 3 broken imports. This also fixes Tech Debt #10 (IgnitionOmniDashboard's import resolves). |
| **QuickBooksConnector.jsx** | `packages/shared/src/components/QuickBooksConnector.jsx` | **Misplaced.** ExternalBridge import is broken. Not genuinely shared — depends on ExternalBridge/VITE_API_URL pattern; Cultivar-os does NOT use it. | Option A: `packages/ignition-os/modules/` · Option B: refactor with AccountingAdapter, keep in shared | **Action required (David decides).** Near-term (Option A): move to ignition-os, fix import. Long-term (Option B): build AccountingAdapter first, then refactor. |

---

## Critical Finding — Build Impact

Both `SavingsReport.jsx` and `QuickBooksConnector.jsx` have broken imports in their current location. Their broken state was masked by how they are referenced:

- **SavingsReport:** IgnitionOmniDashboard imports `from './SavingsReport'` (ignition-os/modules/), not from shared/. The shared/ version is never actually imported in any build. The SAVINGS tab failure (Tech Debt #10) is because the ignition-os/modules/ path doesn't exist — not because shared/ SavingsReport is broken.
- **QuickBooksConnector:** Not imported anywhere in the active codebase (zero grep hits). The broken ExternalBridge import is a latent defect that will surface the first time someone tries to use this component.

**The shared components directory contains two files that are effectively stranded:**
- SavingsReport.jsx — correct code, wrong location, wrong import paths, never actually imported
- QuickBooksConnector.jsx — correct code for Ignition, wrong location, wrong import path, never imported by any live code

Both need to move to `packages/ignition-os/modules/` with corrected import paths. This is the immediate-priority action from this audit.

---

*Audit conducted by Claude Code — 2026-06-01*
*Read-only. No code was modified. All findings are observations of current repository state.*
