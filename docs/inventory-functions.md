# Serverless Functions Inventory — TRACE Platform (cultivar-os)
# Last updated: 2026-06-13
# Canonical source for "what functions exist, what they call, and are they deployed"
# Rule: update this file any session that adds, removes, or materially changes a function.

---

## COUNT: 11 of 12 Vercel Hobby limit — ✅ 1 SLOT HEADROOM

Vercel Hobby cap = 12 functions. Current deployed count = 11.
QBO consolidation (2026-06-13, commit fcdfa97) collapsed auth-url + callback + status into
one connector (api/qbo-connector.ts). 13 → 11. Deploy unblocked. AI-router build now cleared.

---

## Architecture pattern

Root `api/` files are thin re-export shims (1 line each): `export { default } from '../packages/cultivar-os/api/…'`.
All implementation lives in `packages/cultivar-os/api/`. Vercel picks up the root shims.
`api/services/` directory exists but is **empty** — leftover after `customer-match.ts` deletion (2026-06-11).

**QBO routing note (AC-5):** Three public paths are preserved via vercel.json rewrites:
`/api/qbo/auth-url`, `/api/qbo/callback`, `/api/qbo/status` all rewrite to
`/api/qbo-connector?_route=<auth-url|callback|status>`. Internal dispatch in router.ts.

---

## DEPLOYED (11 root shims → Vercel functions)

| # | Route | File (implementation) | Purpose | Calls | Env vars needed |
|---|---|---|---|---|---|
| 1 | `GET /api/dashboard` | `api/dashboard.ts` | Owner dashboard metrics (orders, plants, business row) | Supabase | SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 2 | `POST /api/orders/submit` | `api/orders/submit.ts` | Order submit → Supabase write → QB invoice → notification fire-and-forget | Supabase, QB invoice, shared notifications | SUPABASE_URL, SUPABASE_SERVICE_KEY, QBO_* |
| 3 | `GET /api/qbo/auth-url` → `GET /api/qbo/callback` → `GET /api/qbo/status` | `api/qbo-connector.ts` → `packages/cultivar-os/api/qbo/router.ts` | **AC-5 QBO connector** — all three OAuth paths dispatch internally by `_route` param. auth-url: generate OAuth URL. callback: exchange code → store tokens (Intuit-registered path — must not change). status: proactive token refresh via refreshQBToken(). | QuickBooks OAuth, Supabase, shared quickbooks/refresh.ts | QBO_CLIENT_ID, QBO_CLIENT_SECRET, QBO_REDIRECT_URI, QBO_ENVIRONMENT, SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 4 | `POST /api/qbo/invoice/cultivar` | `api/qbo/invoice/cultivar.ts` | Create QB invoice from a cultivar-os order; refreshes token if needed | QuickBooks API, Supabase | QBO_ENVIRONMENT, SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 5 | `POST /api/social/enable` | `api/social/enable.ts` | Enable social module for a business (writes advert_channels config) | Supabase | SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 6 | `POST /api/social/generate-posts` | `api/social/generate-posts.ts` | Generate social media drafts; routes through shared social/generate.ts → ai/execute.ts | Claude Sonnet 4.6 (via ANTHROPIC_API_KEY), Supabase | ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 7 | `GET+POST /api/members/invite` | `api/members/invite.ts` | Team invitation: GET=preview by token, POST=accept (create Supabase user + member row) | Supabase SERVICE_KEY (auth.admin) | SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 8 | `POST /api/discovery/ingest` | `api/discovery/ingest.ts` | Discovery intake: scrape website + 3-stage AI pipeline (identity → analysis → synthesis) + seed service_offerings + send silent-partner email | Claude Haiku 4.5 + Sonnet 4.6 (via ANTHROPIC_API_KEY), Supabase, shared notifications | ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 9 | `POST /api/campaigns` | `api/campaigns.ts` | Multi-channel campaign post generation (SMS/email/social); routes through shared campaigns/generate.ts → ai/execute.ts | Claude Sonnet 4.6 (via ANTHROPIC_API_KEY), Supabase | ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY |
| 10 | `POST /api/receipts/ocr` | `api/receipts/ocr.ts` | Receipt OCR with dual-provider chain; Gemini 2.5 Flash primary (vision, REST), Claude Haiku 4.5 fallback (vision, SDK); model overridable via platform_config table or env | Gemini REST API, Anthropic SDK, Supabase | GEMINI_API_KEY, ANTHROPIC_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY; optional: OCR_PRIMARY_MODEL, OCR_FALLBACK_MODEL |
| 11 | `POST /api/pmi/suggest` | `api/pmi/suggest.ts` | PMI task schedule AI suggest for an asset; returns `{tasks:[{name,interval}]}`; direct Anthropic call (not via execute.ts) | Claude Sonnet 4.6 (via ANTHROPIC_API_KEY) | ANTHROPIC_API_KEY, SUPABASE_URL (validated on req), SUPABASE_SERVICE_KEY |

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
| `api/qbo/auth-url.ts` (root shim) + `packages/cultivar-os/api/qbo/auth-url.ts` | 2026-06-13 (commit fcdfa97) | Consolidated into qbo-connector.ts per AC-5; public path preserved via vercel.json rewrite |
| `api/qbo/callback.ts` (root shim) + `packages/cultivar-os/api/qbo/callback.ts` | 2026-06-13 (commit fcdfa97) | Same — callback path byte-identical, registered Intuit URI unchanged |
| `api/qbo/status.ts` (root shim) + `packages/cultivar-os/api/qbo/status.ts` | 2026-06-13 (commit fcdfa97) | Same |
| `api/social/publish.ts` | 2026-06-08 (commit 35913b2) | Blotato removed — misrepresented capability; auto-publish seam inert until a vetted publisher adapter is chosen |
| `packages/cultivar-os/api/campaigns/generate.ts` | 2026-06-11 | Dead code — no root shim, superseded |
| `packages/cultivar-os/api/campaigns/publish-post.ts` | 2026-06-11 | Dead code — no root shim, superseded |
| `packages/cultivar-os/api/services/customer-match.ts` | 2026-06-11 | Dead code — Settings.tsx:266 has dead fetch() to `/api/services/customer-match` (will 404) |
