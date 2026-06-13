# Serverless Functions Inventory — TRACE Platform (cultivar-os)
# Last updated: 2026-06-13
# Canonical source for "what functions exist, what they call, and are they deployed"
# Rule: update this file any session that adds, removes, or materially changes a function.

---

## COUNT: 13 of 12 Vercel Hobby limit — ⚠️ OVER LIMIT

Vercel Hobby cap = 12 functions. Current deployed count = 13.
**David must either (a) upgrade cultivar-os project to Pro or (b) remove one function before
the next deploy will succeed.** `api/pmi/suggest.ts` was the 13th (added 2026-06-13).
See PLATFORM_STATE.md "Vercel functions (12 + 1 pending)" row for context.

---

## Architecture pattern

Root `api/` files are thin re-export shims (1 line each): `export { default } from '../packages/cultivar-os/api/…'`.
All implementation lives in `packages/cultivar-os/api/`. Vercel picks up the root shims.
`api/services/` directory exists but is **empty** — leftover after `customer-match.ts` deletion (2026-06-11).

---

## DEPLOYED (13 root shims → Vercel functions)

| # | Route | File (implementation) | Purpose | Calls | Env vars needed |
|---|---|---|---|---|---|
| 1 | `GET /api/dashboard` | `api/dashboard.ts` | Owner dashboard metrics (orders, plants, business row) | Supabase | SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 2 | `POST /api/orders/submit` | `api/orders/submit.ts` | Order submit → Supabase write → QB invoice → notification fire-and-forget | Supabase, QB invoice, shared notifications | SUPABASE_URL, SUPABASE_SERVICE_KEY, QBO_* |
| 3 | `GET /api/qbo/auth-url` | `api/qbo/auth-url.ts` | QBO OAuth step 1 — generate authorization URL | QuickBooks OAuth | QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI |
| 4 | `GET /api/qbo/callback` | `api/qbo/callback.ts` | QBO OAuth step 2 — exchange code for tokens, store in businesses.accounting_* | QuickBooks OAuth, Supabase | QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, QBO_ENVIRONMENT, SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 5 | `POST /api/qbo/invoice/cultivar` | `api/qbo/invoice/cultivar.ts` | Create QB invoice from a cultivar-os order; refreshes token if needed | QuickBooks API, Supabase | QBO_ENVIRONMENT, SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 6 | `GET /api/qbo/status` | `api/qbo/status.ts` | QBO connection status check; proactive token refresh via shared refreshQBToken() | Supabase, shared quickbooks/refresh.ts | SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 7 | `POST /api/social/enable` | `api/social/enable.ts` | Enable social module for a business (writes advert_channels config) | Supabase | SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 8 | `POST /api/social/generate-posts` | `api/social/generate-posts.ts` | Generate social media drafts; routes through shared social/generate.ts → ai/execute.ts | Claude Sonnet 4.6 (via ANTHROPIC_API_KEY), Supabase | ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 9 | `GET+POST /api/members/invite` | `api/members/invite.ts` | Team invitation: GET=preview by token, POST=accept (create Supabase user + member row) | Supabase SERVICE_KEY (auth.admin) | SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 10 | `POST /api/discovery/ingest` | `api/discovery/ingest.ts` | Discovery intake: scrape website + 3-stage AI pipeline (identity → analysis → synthesis) + seed service_offerings + send silent-partner email | Claude Haiku 4.5 + Sonnet 4.6 (via ANTHROPIC_API_KEY), Supabase, shared notifications | ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 11 | `POST /api/campaigns` | `api/campaigns.ts` | Multi-channel campaign post generation (SMS/email/social); routes through shared campaigns/generate.ts → ai/execute.ts | Claude Sonnet 4.6 (via ANTHROPIC_API_KEY), Supabase | ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 12 | `POST /api/receipts/ocr` | `api/receipts/ocr.ts` | Receipt OCR with dual-provider chain; Gemini 2.5 Flash primary (vision, REST), Claude Haiku 4.5 fallback (vision, SDK); model overridable via platform_config table or env | Gemini REST API, Anthropic SDK, Supabase | GEMINI_API_KEY, ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY; optional: OCR_PRIMARY_MODEL, OCR_FALLBACK_MODEL |
| 13 | `POST /api/pmi/suggest` | `api/pmi/suggest.ts` | PMI task schedule AI suggest for an asset; returns `{tasks:[{name,interval}]}`; direct Anthropic call (not via execute.ts) | Claude Sonnet 4.6 (via ANTHROPIC_API_KEY) | ANTHROPIC_API_KEY, SUPABASE_URL (validated on req), SUPABASE_SERVICE_KEY |

**⚠️ Function 13 (`pmi/suggest`) was the tipping point — deploy blocked until Hobby → Pro or one function removed.**

---

## FILE-ONLY (in packages/cultivar-os/api/ — NO root shim — NOT deployed)

| File | Purpose | Note |
|---|---|---|
| `packages/cultivar-os/api/members/accept-invite.ts` | POST-only accept handler | ⚠️ possibly unused — `invite.ts` already handles POST. Verify before removing. |
| `packages/cultivar-os/api/members/preview-invite.ts` | GET-only preview handler | ⚠️ possibly unused — `invite.ts` already handles GET. Verify before removing. |

---

## Deleted functions (historical — do NOT recreate without context)

| Route | Deleted | Reason |
|---|---|---|
| `api/social/publish.ts` | 2026-06-08 (commit 35913b2) | Blotato removed — misrepresented capability; auto-publish seam inert until a vetted publisher adapter is chosen |
| `packages/cultivar-os/api/campaigns/generate.ts` | 2026-06-11 | Dead code — no root shim, superseded |
| `packages/cultivar-os/api/campaigns/publish-post.ts` | 2026-06-11 | Dead code — no root shim, superseded |
| `packages/cultivar-os/api/services/customer-match.ts` | 2026-06-11 | Dead code — Settings.tsx:266 has dead fetch() to `/api/services/customer-match` (will 404) |
