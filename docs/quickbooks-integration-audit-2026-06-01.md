# QuickBooks Integration Audit
**Date:** 2026-06-01
**Author:** Claude Code audit
**Status:** Read-only. No code changed.
**Context:** Yesterday's audit determined that QuickBooksConnector.jsx in packages/shared/src/components/ is broken (imports ExternalBridge — path doesn't exist in shared/). David confirmed Cultivar has a working QB connection validated against his real QB account. This audit documents exactly how that connection works, why it works while Ignition's doesn't, and what the canonical TRACE QB pattern should be going forward.

---

## Section 1: Cultivar QB File Inventory

All QB-related files found in packages/cultivar-os/ and the shared layer it uses:

| File | Role | Supabase tables | Env vars |
|---|---|---|---|
| `packages/cultivar-os/api/qbo/auth-url.ts` | Vercel serverless. Builds Intuit OAuth URL. Returns `{ url }` to frontend. | — | `QBO_CLIENT_ID`, `QBO_REDIRECT_URI` |
| `packages/cultivar-os/api/qbo/callback.ts` | Vercel serverless. Receives OAuth code from Intuit. Exchanges for tokens. Writes token set to DB. Returns HTML auto-close page. | `businesses` (write: accounting_*) | `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET` |
| `packages/cultivar-os/api/qbo/status.ts` | Vercel serverless. Reads connected state. Returns `{ connected, realmId, companyName }`. | `businesses` (read: accounting_company_id, name) | `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| `packages/cultivar-os/api/qbo/invoice/cultivar.ts` | Vercel serverless. Creates QB invoice after order. Find-or-create QB customer. Build line items. Update order with invoice URL. | `businesses` (read: accounting_*), `orders` (read/write), `order_addons`, `service_offerings` | `QBO_ENVIRONMENT`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| `packages/shared/src/quickbooks/refresh.ts` | Shared utility. Proactive token refresh (within 10 min of expiry or missing). Updates businesses on success; sets accounting_needs_reconnect on failure. | `businesses` (write: accounting_token, accounting_refresh_token, accounting_token_expires_at, accounting_needs_reconnect) | `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| `packages/cultivar-os/src/hooks/useSubmitOrder.ts` | Frontend. Non-blocking QB call after order saved. POST `/api/qbo/invoice/cultivar`. Never blocks order on failure. | — (delegates to API) | — |
| `packages/cultivar-os/src/pages/Settings.tsx` | Thin wrapper. Passes `accountingConnectUrl = /api/qbo/auth-url?business_id=${businessId}` to shared Settings. | — | — |
| `packages/shared/src/pages/Settings.tsx` | Full Settings UI. Accounting section checks `business.accounting_company_id` for connected state. Shows Connect link or connected state with optional Reconnect. | `businesses` (read via BusinessProvider) | — |
| `packages/cultivar-os/src/pages/Dashboard.tsx` | Reads `accounting_needs_reconnect` from businesses. Shows amber banner when true. Triggers reconnect via `/api/qbo/auth-url` popup inline on Dashboard. | `businesses` (read) | — |

**Root api/ vs packages/cultivar-os/api/ — resolved.** Yesterday's diff showed these directories contain different files. Investigation confirms: `api/qbo/auth-url.ts` and `api/qbo/callback.ts` at repo root are single-line re-exports:

```typescript
// api/qbo/auth-url.ts
export { default } from '../../packages/cultivar-os/api/qbo/auth-url';
```

Vercel resolves the re-export at build time. The canonical implementation lives in `packages/cultivar-os/api/qbo/`. The root `api/` files are routing shims — they exist so Vercel can discover all API routes from a single directory. This is the correct structure.

---

## Section 2: Cultivar QB Workflow End-to-End

### Step 1 — User clicks "Connect QuickBooks"

`packages/shared/src/pages/Settings.tsx` renders the accounting section. When `business.accounting_company_id` is null (not connected), it shows a "Connect QuickBooks" anchor pointing to the `accountingConnectUrl` prop.

`packages/cultivar-os/src/pages/Settings.tsx` passes:
```typescript
accountingConnectUrl={`/api/qbo/auth-url?business_id=${businessId}`}
```

The Settings page opens this URL in a popup (600×700). `packages/cultivar-os/api/qbo/auth-url.ts` executes on Vercel. It reads `QBO_CLIENT_ID` and `QBO_REDIRECT_URI` from server-side env (never in the client bundle). It generates a random state token formatted as `${businessId}__${randomHex}` and builds the Intuit OAuth URL. Returns `{ url }`.

### Step 2 — User authorizes in Intuit

User sees Intuit's consent screen. They authorize. Intuit redirects to:
```
https://cultivar-os.vercel.app/api/qbo/callback?code=...&state=...&realmId=...
```

This matches `QBO_REDIRECT_URI` set in the Vercel project env vars.

### Step 3 — Token exchange and storage

`packages/cultivar-os/api/qbo/callback.ts` executes on Vercel:

1. Parses `code`, `state`, `realmId` from query params
2. Extracts `businessId` from state (`state.split('__')[0]`)
3. Exchanges code for tokens via POST to `https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer` using HTTP Basic auth (`QBO_CLIENT_ID:QBO_CLIENT_SECRET`)
4. Fetches company name from QB API using the new access token
5. Writes to `businesses` table:

```typescript
{
  accounting_type: 'quickbooks',
  accounting_token: tokens.access_token,
  accounting_refresh_token: tokens.refresh_token,
  accounting_company_id: realmId,
  accounting_token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
  accounting_needs_reconnect: false,
}
```

6. Returns an HTML page that displays "QuickBooks Connected!" and auto-closes the popup after 1800ms via `setTimeout(() => window.close(), 1800)`.

The popup closing is detectable by the parent window — Settings.tsx polls or listens for focus events to refresh the accounting status display.

### Step 4 — Invoice creation on order complete

`packages/cultivar-os/src/hooks/useSubmitOrder.ts` fires after the order is saved to Supabase. QB call is non-blocking:

```typescript
try {
  const qbRes = await fetch('/api/qbo/invoice/cultivar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ order_id: orderId, business_id: businessId }),
  });
  // extract qbInvoiceId, qbInvoiceNumber, qbInvoiceUrl if ok
} catch (qbErr) {
  console.warn('[QB] invoice call threw:', qbErr);
  // order never blocked
}
```

`packages/cultivar-os/api/qbo/invoice/cultivar.ts` (330 lines) executes:

1. Reads `accounting_token`, `accounting_refresh_token`, `accounting_company_id`, `accounting_token_expires_at` from businesses
2. Calls `refreshQBToken(businessId, tokens)` from `packages/shared/src/quickbooks/refresh.ts` — proactively refreshes if within 10 min of expiry
3. If refresh returns null (dead refresh token): returns 503 `{ error: 'qb_token_expired' }` — order stays complete, invoice skipped
4. Calls QB API directly: `findOrCreateQBCustomer()` queries QB by email, creates if not found
5. Builds invoice lines. Prefers `service_offerings` join; falls back to `order_addons` (legacy)
6. Creates invoice on QB via POST `https://quickbooks.api.intuit.com/v3/company/${realmId}/invoice`
7. Writes `qb_invoice_id`, `qb_invoice_url`, `status='invoiced'` back to the orders row

### Step 5 — Token refresh

`packages/shared/src/quickbooks/refresh.ts` — `refreshQBToken(businessId, tokens)`:

- Called proactively at the start of every QB API call (invoice creation)
- Checks: if `token_expires_at` is null OR within 10 minutes of now → refresh
- If current token is still valid: returns it immediately (no network call)
- If refresh needed: POST to Intuit token URL with `grant_type=refresh_token`
- On success: writes new token set to businesses, returns new access token
- On failure (refresh token dead/revoked): sets `accounting_needs_reconnect: true` in businesses, returns null

### Step 6 — Reconnect prompt

`packages/cultivar-os/src/pages/Dashboard.tsx` reads `accounting_needs_reconnect` from the businesses row in `loadMetrics()`. When true, renders an amber banner above the tile grid:

> "QuickBooks needs reconnection — reconnect from the QuickBooks tile above."

The dashboard also has an inline reconnect path: clicking the QB tile triggers `initiateQBConnect()` which calls `/api/qbo/auth-url?business_id=X` and opens the popup — same OAuth flow as the initial connection.

### Step 7 — Disconnect

No explicit disconnect endpoint or UI is currently implemented in Cultivar. Disconnect would require:
1. A DELETE or PATCH endpoint that nulls out `accounting_*` columns in businesses
2. A "Disconnect" button in Settings.tsx accounting section

This is post-demo scope.

---

## Section 3: Legacy QB Code in packages/shared/

Three files in `packages/shared/src/quickbooks/` are Railway-era artifacts extracted from CAI/ExternalBridge.js. None are used by Cultivar. All use `VITE_API_URL` with a `localhost:8000` fallback.

### `packages/shared/src/quickbooks/oauth.ts`

- Manages QB connection state in `localStorage['IGNITION_OS_DATA']`
- `initiateOAuth()`: opens popup → polls `${VITE_API_URL}/api/qbo/status` every 2 seconds → saves to localStorage on success
- `disconnectQBO()`: POST `${VITE_API_URL}/api/qbo/disconnect` → clears localStorage
- **Status:** Broken. `VITE_API_URL` unset in Vercel projects → falls back to `localhost:8000` → network error in production. Not used by Cultivar at all.

### `packages/shared/src/quickbooks/invoice.ts`

- `pullQBOInvoices(days)`: GET `${VITE_API_URL}/api/qbo/invoices?days=N` → maps response to `QBOInvoice[]`
- `pushQBOInvoice(invoice)`: POST `${VITE_API_URL}/api/qbo/invoice` → returns QB response
- `mapQBOInvoice(raw)`: maps raw QB invoice to shared schema
- `toQBOInvoicePayload(invoice)`: builds QB-compatible invoice payload
- **Status:** Broken (VITE_API_URL). Not used by Cultivar. The invoice creation Cultivar actually uses is in `packages/cultivar-os/api/qbo/invoice/cultivar.ts` — a Vercel serverless function that calls QB directly.

### `packages/shared/src/quickbooks/customer.ts`

- `pullQBOCustomers()`: GET `${VITE_API_URL}/api/qbo/customers` → maps response to `QBOCustomer[]`
- `mapQBOCustomer(raw)`: maps raw QB customer to shared schema
- **Status:** Broken (VITE_API_URL). Not used by Cultivar. Customer find/create in Cultivar is done inline in `invoice/cultivar.ts` via direct QB API calls.

**Summary:** These three files are dead code. They were extracted from Ignition's ExternalBridge.js and placed in shared/ speculatively. They have never worked in the Vercel context and Cultivar doesn't import them.

---

## Section 4: Ignition's QB Approach (Comparison)

Ignition's QB integration was built for the CAI/React Native era when `ai_router.py` (Railway FastAPI) was the backend. The pattern:

1. `QuickBooksConnector.jsx` (currently in `packages/shared/src/components/`, broken) — Ignition UI component that imported `ExternalBridge` and `DataBridge`. These imports resolve to non-existent paths in shared/. ExternalBridge.js lives only in `~/Desktop/CAI/`.

2. `ExternalBridge.js` (CAI/ only — archive) — The Ignition QB adapter. Had `qbo.authenticate()`, `qbo.pullCustomers()`, `qbo.pullInvoices()`, `qbo.pushInvoice()`. All called `${VITE_API_URL}/api/qbo/*`. At runtime pointed to Railway.

3. Railway FastAPI (`ai_router.py`) — Held the actual QB client credentials server-side. Had `/api/qbo/auth-url`, `/api/qbo/callback`, `/api/qbo/status`, `/api/qbo/invoice` endpoints. Stored QB tokens in Supabase (ufsgqckbxdtwviqjjtos — Ignition's project).

**Why it's broken now:** `VITE_API_URL` is explicitly unset in the ignition-os Vercel project (per CLAUDE.md). `oauth.ts` and all ExternalBridge QB calls fall back to `localhost:8000`. Railway is legacy and is not running for the web build. The QB connection cannot initiate.

**Why Cultivar works and Ignition doesn't:** Cultivar moved QB credentials to Vercel env vars and eliminated the intermediate server (Railway). The OAuth callback, token exchange, and QB API calls all happen in Vercel serverless functions — the same runtime that serves the app. No Railway, no localhost, no `VITE_API_URL`.

---

## Section 5: Canonical TRACE QB Pattern — Recommendation

**Option A (Cultivar's Vercel serverless pattern) is the canonical TRACE QB integration pattern.**

### Why

| Factor | Cultivar (Vercel) | Ignition legacy (Railway) |
|---|---|---|
| Currently working in production | ✅ Yes — validated against real QB account | ❌ No — VITE_API_URL unset, localhost:8000 fallback |
| Server infrastructure to operate | None — Vercel serverless is automatic | Railway process, scaling, uptime monitoring |
| Credentials in client bundle | ❌ Never — server-side Vercel env vars | ❌ Never — Railway held them, but Railway is gone |
| Token storage | ✅ Supabase businesses table — multi-tenant, persistent | localStorage (oauth.ts) — single device, volatile |
| Multi-tenant support | ✅ business_id scopes every operation | ❌ No — single-shop localStorage model |
| Self-serve (customer connects own QB) | ✅ Popup flow, no David involvement | ❌ Would require Railway to be running |
| Extends to new verticals | ✅ New vertical copies 4 serverless functions | ❌ Would require Railway porting + VITE_API_URL setup |
| Shared refresh utility | ✅ packages/shared/src/quickbooks/refresh.ts | ❌ Would need new implementation |

The Cultivar pattern wins on every dimension. It is simpler, already running, and designed for the multi-tenant self-serve model TRACE is building toward.

### What "canonical" means in practice

Every future vertical that needs QuickBooks:

1. Creates four Vercel serverless functions under `packages/<vertical>/api/qbo/`:
   - `auth-url.ts` — identical to Cultivar's (no vertical-specific logic; copy verbatim)
   - `callback.ts` — identical to Cultivar's (writes to businesses table; copy verbatim)
   - `status.ts` — identical to Cultivar's (reads businesses table; copy verbatim)
   - `invoice/<vertical>.ts` — vertical-specific (line item construction differs per domain)

2. Reuses `packages/shared/src/quickbooks/refresh.ts` without modification.

3. Reuses the accounting section in `packages/shared/src/pages/Settings.tsx` by passing `accountingConnectUrl` prop — no new accounting UI to write.

4. Adds `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENVIRONMENT` to the vertical's Vercel project. These can be the same app credentials across verticals if using one Intuit developer app, or separate if verticals need separate Intuit apps.

**Effort to add QB to a new vertical:** ~2–3 hours. Auth-url/callback/status are copy-paste. The invoice handler needs vertical-specific line item logic (the only domain-specific piece).

### Migrating Ignition to the canonical pattern

Required changes:

1. Create `packages/ignition-os/api/qbo/auth-url.ts` — copy from Cultivar, change no logic
2. Create `packages/ignition-os/api/qbo/callback.ts` — copy from Cultivar, change no logic
3. Create `packages/ignition-os/api/qbo/status.ts` — copy from Cultivar, change no logic
4. Create `packages/ignition-os/api/qbo/invoice/ignition.ts` — port the Ignition QB invoice logic from `ExternalBridge.js` (CAI/) using the Cultivar structure as a template
5. Add `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, `QBO_REDIRECT_URI`, `QBO_ENVIRONMENT` to ignition-os Vercel project
6. Update `QBO_REDIRECT_URI` in Intuit developer portal to add ignition-os callback URL
7. Delete or move `packages/shared/src/components/QuickBooksConnector.jsx` (broken — see Section 6)
8. Update Ignition's QB UI to use shared Settings.tsx accounting section instead of QuickBooksConnector.jsx

**Effort estimate:** 4–6 hours. The pattern is proven; the work is mechanical porting.

**Timing:** Post-August. Ignition has no demo or customer requiring QB before then. The broken state (QB features non-functional) is acceptable until the migration is prioritized.

---

## Section 6: Dead Code Inventory

### Move now (blocks Tech Debt #10 resolution)

| File | Action | Why | When |
|---|---|---|---|
| `packages/shared/src/components/SavingsReport.jsx` | MOVE to `packages/ignition-os/modules/SavingsReport.jsx`, fix imports | Broken imports in shared/; IgnitionOmniDashboard.jsx imports `'./SavingsReport'` which doesn't exist → SAVINGS tab broken | Before next Ignition dry run (per Tech Debt #10) |

### Move or delete post-August (non-blocking)

| File | Action | Why | When |
|---|---|---|---|
| `packages/shared/src/components/QuickBooksConnector.jsx` | MOVE to `packages/ignition-os/modules/QuickBooksConnector.jsx` + fix imports (remove ExternalBridge/DataBridge deps, wire to Vercel function pattern) OR DELETE and use shared Settings.tsx accounting section | Broken imports in shared/; Ignition-specific; ExternalBridge doesn't exist in shared/ | When Ignition QB is migrated to Vercel pattern (post-August) |
| `packages/shared/src/quickbooks/oauth.ts` | DELETE | Railway-era. VITE_API_URL + localStorage. Never used by Cultivar. Ignition should not use this pattern after migration. | After Ignition QB migration |
| `packages/shared/src/quickbooks/invoice.ts` | DELETE | Railway-era. VITE_API_URL. Cultivar's invoice logic lives in api/qbo/invoice/cultivar.ts. | After Ignition QB migration |
| `packages/shared/src/quickbooks/customer.ts` | DELETE | Railway-era. VITE_API_URL. Customer find/create is inline in invoice handlers. | After Ignition QB migration |

### Keep as-is

| File | Why keep |
|---|---|
| `packages/shared/src/quickbooks/refresh.ts` | Genuinely shared. Used by Cultivar invoice handler today. Any future vertical's invoice handler will use it. Do not touch. |
| Root `api/qbo/auth-url.ts`, `api/qbo/callback.ts` | One-liner re-exports needed for Vercel routing. Keep until there's a reason to restructure. |

---

## Section 7: Summary

**How Cultivar's QB connection works:** Four Vercel serverless functions under `packages/cultivar-os/api/qbo/`. OAuth popup opens → Intuit redirects to Vercel callback → token set written to `businesses` table → invoice created server-side after each order using `refreshQBToken()` from shared layer → `accounting_needs_reconnect` flag surfaces in Dashboard banner when refresh fails.

**Why it works and Ignition's doesn't:** Cultivar moved QB credentials to Vercel server-side env vars and eliminated Railway. Ignition's QB path still expects `VITE_API_URL` to point to a running Railway server — which doesn't exist for the web build.

**Canonical pattern:** Cultivar's Vercel serverless pattern. Four small functions per vertical (three are copy-paste; one is vertical-specific invoice logic). Shared refresh utility. Shared Settings UI.

**Dead code:** Three legacy QB files in `packages/shared/src/quickbooks/` (oauth.ts, invoice.ts, customer.ts) are Railway-era artifacts that don't work in Vercel and are unused by Cultivar. Delete after Ignition migration. `QuickBooksConnector.jsx` in shared/src/components/ belongs in ignition-os with fixed imports.

**Missing feature:** QB disconnect is not implemented in Cultivar. No endpoint, no UI button. Post-demo scope.

---

*Read-only audit — no code changed. All analysis is based on current codebase state as of 2026-06-01.*
*To migrate Ignition to the canonical pattern, begin at Section 5 "Migrating Ignition." Start with auth-url.ts and callback.ts (pure copy-paste), then tackle invoice/ignition.ts (the domain-specific piece).*
