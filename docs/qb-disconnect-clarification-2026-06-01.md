# QB Disconnect/Reconnect Behavior — Clarification Audit
**Date:** 2026-06-01
**Author:** Claude Code audit
**Status:** Read-only. No code changed.
**Context:** The 2026-06-01 QB integration audit stated "QB disconnect has no endpoint and no UI button in Cultivar." David indicated he has used a disconnect/reconnect flow. This document resolves the discrepancy.

---

## All QB-Related UI Elements in Cultivar

### Element 1 — "Connect QuickBooks" button (Dashboard)

| Attribute | Value |
|---|---|
| **Label** | `Connect QuickBooks` (in-progress: `Opening QuickBooks…`) |
| **File** | `packages/cultivar-os/src/pages/Dashboard.tsx:461` |
| **Shown when** | `!qbConnected` (local React state initialized from `/api/qbo/status` check on load) |
| **onClick** | `handleConnect()` — Dashboard.tsx:224 |

What `handleConnect()` does:
1. Opens a popup window (`window.open('', 'qb-connect', ...)`)
2. Fetches `/api/qbo/auth-url?business_id=X` (Vercel serverless) → gets Intuit OAuth URL
3. Navigates the popup to that URL → user sees Intuit consent screen
4. Polls `checkQbStatus()` every 2 seconds (calls `/api/qbo/status?business_id=X`)
5. When `connected: true` is returned: sets `qbConnected(true)`, `qbCompany(name)`, calls `loadMetrics()`

Does it write to the businesses table? No — the write happens in `callback.ts` when Intuit redirects back. The frontend only reads the result.

---

### Element 2 — "Disconnect" button (Dashboard)

| Attribute | Value |
|---|---|
| **Label** | `Disconnect` |
| **File** | `packages/cultivar-os/src/pages/Dashboard.tsx:494` |
| **Shown when** | `qbConnected === true` (same local state as above) |
| **onClick** | `() => { setQbConnected(false); setQbCompany(''); }` — Dashboard.tsx:491 |

**This is a UI-only action.** The onClick handler sets two local React state variables and does nothing else:
- No API call
- No database write
- No nulling of `accounting_*` columns in the `businesses` table
- No token revocation with Intuit

Effect: the QB section UI switches from "connected" (green checkmark + company name + Disconnect) back to "not connected" (Connect QuickBooks button). On the next page load, `checkQbStatus()` runs automatically (Dashboard.tsx:317) and calls `/api/qbo/status?business_id=X`, which reads `accounting_company_id` from the businesses table. Since nothing in the businesses table changed, `connected: true` is returned, and QB immediately shows as connected again.

**The "Disconnect" button provides no persistent disconnect.** It is cosmetically functional for the duration of the current session only.

---

### Element 3 — "Connect QuickBooks" link (Settings)

| Attribute | Value |
|---|---|
| **Label** | `Connect QuickBooks` (styled as a green block link) |
| **File** | `packages/shared/src/pages/Settings.tsx:367` |
| **Shown when** | `!accountingConnected` — derived from `!!business?.accounting_company_id` (Settings.tsx:291) |
| **href** | `accountingConnectUrl` = `/api/qbo/auth-url?business_id=X` (passed as prop from cultivar-os/pages/Settings.tsx:107) |

Opens the Intuit OAuth URL directly (not in a popup). Runs the full OAuth flow. Callback.ts writes new tokens to businesses. Functionally identical to Dashboard's "Connect QuickBooks" button, but navigates the full tab rather than using a popup.

---

### Element 4 — "Reconnect" link (Settings — connected state)

| Attribute | Value |
|---|---|
| **Label** | `Reconnect` |
| **File** | `packages/shared/src/pages/Settings.tsx:356` |
| **Shown when** | `accountingConnected === true` AND `accountingConnectUrl` is defined |
| **href** | `accountingConnectUrl` = `/api/qbo/auth-url?business_id=X` |

Runs the full OAuth flow again. `callback.ts` overwrites the existing tokens in businesses with fresh ones. This IS a true reconnect at the database layer — new `accounting_token`, `accounting_refresh_token`, `accounting_token_expires_at`, and `accounting_needs_reconnect: false` are written.

Also conditionally shows a sub-label when `business?.accounting_needs_reconnect === true`:
```
"⚠ Reconnection needed" (Settings.tsx:351, amber text)
```

---

### Element 5 — "⚠ QuickBooks needs reconnection" amber banner (Dashboard)

| Attribute | Value |
|---|---|
| **Label** | `⚠ QuickBooks needs reconnection` / `Invoices are paused. Reconnect from the QuickBooks tile above.` |
| **File** | `packages/cultivar-os/src/pages/Dashboard.tsx:596–610` |
| **Shown when** | `accountingNeedsReconnect === true`, read from `businesses.accounting_needs_reconnect` on load |
| **Action** | None — informational text only. Points user to the QB tile section above (the "Connect QuickBooks" button). |

This flag is set to `true` by `refreshQBToken()` in `packages/shared/src/quickbooks/refresh.ts` when a token refresh fails (i.e., the refresh token is expired or revoked by Intuit).

---

## Questions Answered

### 1. Is there a button labeled "Disconnect" or similar in Cultivar's QB UI?

**Yes.** Dashboard.tsx:494 renders a button with the label `Disconnect`. The original audit statement was wrong on this point — the button exists.

---

### 2. What does clicking "Disconnect" actually do?

It executes `setQbConnected(false); setQbCompany('')` and nothing else (Dashboard.tsx:491). This updates two React state variables in the Dashboard component. No API is called, no database write occurs. The `businesses` table — specifically all `accounting_*` columns — is completely untouched.

On the next page load or navigation to Dashboard, `checkQbStatus()` runs, reads the businesses table, finds `accounting_company_id` still present, and restores `qbConnected(true)`. The QB section reverts to "connected" state automatically.

**From the user's perspective:** QB appears disconnected for the current session. From the database's perspective: QB was never disconnected.

---

### 3. If a user clicks "Connect QuickBooks" when already connected, what happens?

The OAuth flow runs again. Intuit will present the consent screen (or may auto-authorize if the same account is still in session). `callback.ts` executes and **overwrites** the existing token set in businesses with fresh tokens. No rejection, no duplicate-connection check, no "already connected" prompt.

This is the mechanism behind the reconnect flow David has used: click "Disconnect" (hides the connected UI in this session) → "Connect QuickBooks" appears → click it → OAuth runs → fresh tokens written to DB → QB shows as connected with new token.

From the database, what actually happened was: overwrite, not disconnect + reconnect. The access was never revoked.

---

### 4. What happens when QB tokens expire?

Three-layer handling:

**Layer 1 — Proactive refresh (normal path):** `refreshQBToken()` in `packages/shared/src/quickbooks/refresh.ts` is called at the start of every invoice creation. If the token is within 10 minutes of expiry (or already expired), it uses the `refresh_token` grant to get a new access token from Intuit and writes it to businesses. The invoice creation proceeds without user action.

**Layer 2 — Refresh token expired:** If the refresh token itself is dead (Intuit invalidated it, or 100-day limit exceeded), `refreshQBToken()` sets `businesses.accounting_needs_reconnect = true` and returns null. The invoice handler returns a 503. Orders still complete; invoicing is paused.

**Layer 3 — User-visible reconnect prompt:** Dashboard reads `accounting_needs_reconnect` on load and renders the amber banner ("Invoices are paused. Reconnect from the QuickBooks tile above.") and Settings shows "⚠ Reconnection needed" sub-label. User clicks the Connect/Reconnect path → full OAuth → fresh tokens overwrite old ones → `accounting_needs_reconnect` set back to false by callback.ts.

There is no silent failure path that permanently blocks invoicing without surfacing to the user. The amber banner is the safety valve.

---

### 5. Is there any code path that nulls out the accounting_* columns in the businesses table?

**No.** Searched all files in `packages/cultivar-os/` for: `disconnect`, `accounting_token`, `accounting_company_id`, `null`. No code sets any `accounting_*` column to NULL. The only writes to `accounting_*` columns are:
- `callback.ts` — on successful OAuth: sets all columns to real values
- `refresh.ts` — on successful token refresh: overwrites `accounting_token`, `accounting_refresh_token`, `accounting_token_expires_at`; sets `accounting_needs_reconnect: false`
- `refresh.ts` — on failed refresh: sets only `accounting_needs_reconnect: true`

**Privacy.tsx compliance discrepancy:** `packages/cultivar-os/src/pages/Privacy.tsx:93` states: *"QuickBooks tokens are deleted immediately on disconnect."* This is inaccurate. Tokens are never deleted. Clicking "Disconnect" only clears React state. A reconnect overwrites the token columns with new values. Tokens are not nulled, revoked with Intuit, or deleted from the database at any point in the current implementation. This discrepancy between the privacy policy and the code behavior should be resolved — either implement real token deletion or update the Privacy.tsx language to say tokens are overwritten on reconnect rather than deleted on disconnect.

---

## Conclusion

The original audit statement — "QB disconnect has no endpoint and no UI button in Cultivar" — was **partially wrong and partially correct**.

**Wrong:** There IS a "Disconnect" button (Dashboard.tsx:494). The button exists and was the mechanism David used.

**Correct:** There is no endpoint. Clicking "Disconnect" calls no API, writes nothing to the database, and has no persistent effect. The tokens remain intact in the `businesses` table.

**The actual disconnect/reconnect behavior David experienced:** Click "Disconnect" (hides the connected UI) → "Connect QuickBooks" appears → click it → Intuit OAuth flow → `callback.ts` overwrites the existing tokens with fresh ones. From the user's perspective this is a disconnect and reconnect. From the database's perspective it is a single token overwrite — the connection was never broken.

**The reconnect banner flow** (for truly expired refresh tokens) is a separate, fully functional path: `refreshQBToken()` sets `accounting_needs_reconnect: true` → amber banner appears → user runs OAuth → fresh tokens overwrite.

**Action required (post-demo):** The "Disconnect" button needs a real implementation — a Vercel serverless endpoint that nulls out `accounting_*` columns and (optionally) calls Intuit's token revocation endpoint. Until then, Privacy.tsx's statement about immediate token deletion on disconnect is a compliance-relevant inaccuracy.

---

*Read-only audit — no code changed. All line numbers reference codebase state as of 2026-06-01.*
