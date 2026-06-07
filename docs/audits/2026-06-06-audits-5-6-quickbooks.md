# TRACE Platform — Consolidated Audit Report: Audits 5–6 (QuickBooks + Railway)
# Date: 2026-06-06 | Scope: Read-only code inspection (QB API + Railway architecture)
# Status: COMPLETE — findings drive the build sequence in Platform Vision Capture v7 §15
# Source: Two consolidated audit reports received 2026-06-06, recorded here verbatim as the source record.

---

## Audit 5 — Railway architecture and kill path

### 5a — Railway is safe to kill

**Finding:** Railway is load-bearing only for already-broken things. Specifically:
- All 15 AIEngine tasks route to Railway via `VITE_API_URL`
- `VITE_API_URL` is **NOT SET** in the ignition-os Vercel project
- Therefore every AIEngine call in Ignition Vercel prod returns `{ ok: false }` — Railway is receiving zero real production traffic from the web build

Railway continues to run but is receiving no load from the web app. The cost of keeping Railway running is real; the benefit is zero. **Killing Railway is a cleanup with no production impact on the web build.**

### 5b — Tasks to retire (not port)

**Finding:** Several Railway tasks have no callers and are candidates for retirement rather than migration to Vercel:

| Task | Status | Decision |
|---|---|---|
| `invoice_scan` | ZERO callers in codebase | RETIRE — orphaned, never wired |
| `vin_decode` | Caller exists in IgnitionVIN.jsx but that file is a web stub (alert() only) | RETIRE — the UI is a placeholder; the task has no real usage |
| `voice_transcribe` | Potentially active (Ignition mobile had voice intake) | EVALUATE before retire — Vercel 4.5MB payload limit; audio files may exceed it |

**Tasks worth porting (real callers, real value):**
| Task | Caller | Value |
|---|---|---|
| `dtc_decode` | DTC Cipher module | High — core Ignition AI capability |
| `estimate_draft` | Estimator module | High — core Ignition AI capability |
| `invoice_audit` | IgnitionAudit module | Medium — leakage tool (outgoing invoices); real implementation |
| `pmi_suggest` | PMI module | Medium — maintenance scheduling |
| `savings_report` | SavingsReport (display component missing) | Medium — port after SavingsReport.jsx exists |

### 5c — Kill sequence (agreed, not yet executed)

1. Confirm Railway is receiving zero web-build traffic (Vercel logs show zero `VITE_API_URL` calls)
2. Retire `invoice_scan` and `vin_decode` from the routing table (remove from `AIEngine.ts` + `ai_router.py`)
3. Port `dtc_decode` and `estimate_draft` first (text-only, no vision complexity, highest value)
4. Evaluate `voice_transcribe` payload size before deciding port vs. retire
5. Decommission Railway after all real tasks are ported and confirmed live

**Receipt Keeper note:** Receipt Keeper is designed as a Vercel-native serverless function from day one. It creates zero Railway debt.

---

## Audit 6 — QuickBooks API surface and capabilities

### 6a — QB OCR is NOT API-accessible

**Finding:** QuickBooks has a receipt OCR feature visible in the mobile app (snap a receipt → QB reads the fields). This feature is **NOT exposed via the QuickBooks API**. It is internal mobile-app ML with no API hook.

**Implication:** "Let QB do the OCR" was a considered approach that would have saved building an OCR layer. It is dead. TRACE must build its own OCR.

**Receipt Keeper OCR decision (confirmed):** TRACE builds the OCR using **Gemini Flash** — the same vision model available in `IgnitionAudit` via `compressImage()`. The pipeline is: camera/file → compress image → Gemini Flash vision → structured line items → owner confirm → write to local `receipts` table.

`compressImage()` from `invoice_audit` is promotable — it is a standalone image resize utility with no Railway coupling. Promote it as part of the Receipt Keeper build.

### 6b — What QB CAN do (confirmed API capabilities)

The current OAuth scope (`com.intuit.quickbooks.accounting`) covers all of the following:

| Capability | API endpoint | Notes |
|---|---|---|
| Write expense to QB | `POST /v3/company/{realmId}/purchase` (Purchase) or `/bill` (Bill) | Creates a payable record in QB |
| Archive receipt image on QB record | `POST /v3/company/{realmId}/attachable` | Attaches the original receipt image to the Purchase/Bill record |
| Vendor lookup | `GET /v3/company/{realmId}/vendor` | Find or create vendor before writing expense |
| Vendor create | `POST /v3/company/{realmId}/vendor` | Create new vendor if not found |
| Chart of Accounts query | `GET /v3/company/{realmId}/account` | Pull the business's REAL expense categories — use the accountant's actual buckets, don't invent categories |
| Purchase / Bill query | `GET /v3/company/{realmId}/purchase` | Read already-entered expenses (read-only, no update) |

**What is NOT in current code:** The current QB integration (in `packages/cultivar-os/api/qbo/`) covers **receivables only**:
- `invoice/cultivar.ts` — creates QB invoice (a receivable, money coming IN)
- `customer.ts` — creates/finds QB customer
- `callback.ts`, `auth-url.ts`, `status.ts` — OAuth flow
- `refresh.ts` — token refresh

**Payables (expenses going OUT) are NOT wired today.** The API capability exists; TRACE just hasn't built the write-expense path yet. This is Receipt Keeper v2 scope.

### 6c — QB bank feed is NOT API-accessible

**Finding:** QuickBooks "For Review" (the bank feed reconciliation screen) is **UI-only**. There is no API endpoint that exposes the bank feed, pending transactions, or bank-imported data. The QuickBooks API documentation confirms this is intentionally closed.

**Implication:** Cross-card reconciliation (business expenses on the personal card, personal expenses mixed into business accounts) **must be built by TRACE**. TRACE will accept bank CSV exports from the user, parse and categorize them, and reconcile against the receipts table.

**Sensitivity note:** Bank transaction data is the highest-sensitivity data class on the platform. Cross-card reconciliation carries maximum-sensitivity consent requirements (per-tile scoped consent, opt-in, explicitly permissioned). The agreement + tamper-evident proof-log must be ironclad before this feature ships.

### 6d — QB is append-only, not two-way sync

**Finding:** The QuickBooks API **cannot update already-entered transactions**. Once a Purchase or Bill is written to QB, it cannot be updated via API — only via the QB UI (manually). This means:
- TRACE write-to-QB is one-directional: TRACE → QB
- If an owner corrects a receipt in TRACE after writing to QB, the QB record does not update automatically
- TRACE is an **append target** for QB, not a two-way sync partner

**Implication for UX:** The confirm-before-commit step in Receipt Keeper is not just good practice — it is the only correction opportunity before the record becomes immutable in QB. "Submit what THEY submitted" is a hard constraint, not a preference.

### 6e — David's QB connection status (benign)

**Finding:** David's QuickBooks connection in the cultivar-os Vercel project is **currently expired** (token lapsed approximately May 29, 2026). The expiration is benign:
- This is David's OWN live QB account used to test the invoice creation flow
- The connection went stale during other work (no invoice calls were being made)
- No customer data is at risk; no customer is using this connection
- The `qb_needs_reconnect` column in `businesses` currently reads `false` — this is the HONEST-DEBT item (see §6f)

**Resolution:** David reconnects when next testing the invoice flow (navigate Vercel prod → Dashboard → QB tile → reconnect). Local dev reconnect won't work — production creds are in Vercel env vars, not local `.env.local` (which has sandbox creds only).

### 6f — HONEST-DEBT: the lying reconnect flag

**Finding:** `businesses.accounting_needs_reconnect` reads `false` while David's QB token is expired. The flag only flips to `true` when a 401 response occurs during an active invoice call. A **dead connection stays silent** — no banner, no warning — until something fails mid-use (e.g., a customer checkout triggers an invoice call that 401s).

**Why this is a Surface Honesty failure:** The dashboard QB tile displays "Connected" or shows no warning while the connection is broken. The business owner believes their QB is live. The first signal they receive that it isn't is a failed invoice during a customer sale — the worst possible moment.

**Fix (not yet built):** Proactive dead-connection detection. On dashboard load (or at a low-frequency background interval), verify the token is not expired by checking `accounting_token_expires_at` against now. If expired, set `accounting_needs_reconnect = true` and display the amber reconnect banner immediately — before the owner tries to use QB.

**Priority:** Before any real customer relies on QB integration. David's expired connection is low urgency (he knows about it); a customer's expired connection with no warning is a credibility failure.

**Verdict:** HONEST-DEBT (new Tech Debt entry). Record as #15.

### 6g — Dog-food starts clean and capture-forward

**Finding and decision:** David's QB has years of existing data. The temptation is to reconcile or import it. The correct approach is:
- **Do not reconstruct backward** — reconciling historical QB data is expensive and error-prone
- **Start clean, capture forward** — Receipt Keeper v1 captures from the moment it's activated
- The value of the platform accumulates over time as a side-effect of operating, not as a one-time import

**Same principle applies to the roaming/travel phase:** capture costs as they occur; don't try to reconstruct the past.

---

## Summary table

| Finding | Status | Severity | Action |
|---|---|---|---|
| QB OCR not API-accessible (mobile-app-only) | Architecture decision | High | TRACE builds OCR (Gemini Flash). Receipt Keeper is NET-NEW. |
| QB write-expense (payables) capability confirmed | Available, not wired | Medium | Receipt Keeper v2 wires this |
| QB Attachable (archive receipt image on QB record) | Available, not wired | Medium | Receipt Keeper v2 wires this |
| QB CoA query (use real accountant categories) | Available, not wired | Medium | Wire in Receipt Keeper v2 |
| QB bank feed "For Review" not API-accessible | Architecture decision | High | Cross-card reconciliation = build by TRACE; max-sensitivity consent |
| QB is append-only, not two-way sync | Architecture constraint | Medium | Confirm-before-commit is a hard requirement, not a preference |
| David's QB connection expired (benign) | Known, low urgency | Low | David reconnects when next testing invoices |
| `accounting_needs_reconnect` lies (reads false while expired) | HONEST-DEBT #15 | High | Proactive expiry check before any real customer relies on QB |
| Dog-food starts clean, capture-forward | Decision | Low | Record and hold |
| Railway safe to kill (zero web-build traffic) | Architecture decision | High | Kill sequence in §15 of v7; parallel with builds |
| `invoice_scan` orphaned (zero callers) | Record | Medium | Retire; do not port |
| `vin_decode` / VIN OCR placeholder | NOT BUILT | Medium | Retire placeholder; build real pipeline only when needed |

---

*TRACE Enterprises · Audit record · Read-only findings · 2026-06-06*
*Findings are complete as received. This document is the source record. Do not patch — add a dated addendum if a finding is later contradicted.*
