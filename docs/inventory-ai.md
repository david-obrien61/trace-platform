# AI Routes & Models Inventory — TRACE Platform
# Last updated: 2026-06-13
# Canonical source for "what AI features exist, what model they use, and do they work"
# Rule: update this file any session that adds, changes, or verifies an AI feature.

---

## Provider architecture

**Gateway:** All Cultivar OS AI calls go through Vercel serverless functions — no client-side AI keys.
**Default flow (post-2026-06-05):** shared `ai/execute.ts` reads capability config from
`shared/ai/capabilities.ts`, makes Anthropic API calls, emits `[TRACE:ai]` logs when `AI_DEBUG=true`.
**Exception:** `api/receipts/ocr.ts` uses its own dual-provider chain (Gemini first, Anthropic fallback)
and does NOT go through `ai/execute.ts` — vision pipeline is a direct SDK/REST call.
**Exception:** `api/pmi/suggest.ts` calls Anthropic directly (text-only, no execute.ts wrapper).
**Deprecated path:** Old Railway/Python `VITE_API_URL` → `AIEngine.ts` path is DARK and DEPRECATED.
Do not route new features through it. See TD#25.

---

## ACTIVE AI FEATURES

### WORKS

| Feature | Endpoint | Flow | Model(s) | Status | Evidence |
|---|---|---|---|---|---|
| **Receipt Keeper OCR** | `api/receipts/ocr.ts` | Image → Gemini 2.5 Flash (primary, vision, REST API) → Claude Haiku 4.5-20251001 (fallback, vision, @anthropic-ai/sdk) → structured line items | Gemini `gemini-2.5-flash` primary; `claude-haiku-4-5-20251001` fallback; both overridable via platform_config table or env | **WORKS** | Live test 2026-06-11, McCoy's printed receipt, provider=gemini, ~$0.0001/call. HANDWRITTEN receipts unreliable (REQ-2). |
| **Social draft generator** | `api/social/generate-posts.ts` | POST → shared `social/generate.ts` → `ai/execute.ts` → Anthropic | `claude-sonnet-4-6` | **WORKS** | 2 rows confirmed in social_drafts 2026-06-08 via REST API |

### WIRED (build verified, not yet confirmed live in production)

| Feature | Endpoint | Flow | Model(s) | Status | Notes |
|---|---|---|---|---|---|
| **Discovery — identity stage** | `api/discovery/ingest.ts` | Website scrape → `shared/discovery/engine.ts:runIdentity()` → `ai/execute.ts` | `claude-haiku-4-5-20251001` | WIRED | Fast/cheap first pass; extracts business identity fields |
| **Discovery — analysis stage** | `api/discovery/ingest.ts` | After identity → `runAnalysis()` → `ai/execute.ts` | `claude-sonnet-4-6` | WIRED | Silent-partner analysis (pain/opportunity/referral) |
| **Discovery — synthesis stage** | `api/discovery/ingest.ts` | After analysis → `shared/discovery/synthesis.ts:runSynthesis()` → `ai/execute.ts` | `claude-sonnet-4-6` | WIRED | Assembles full SilentPartnerAnalysis, sends notification email |
| **Campaign post generator** | `api/campaigns.ts` | POST → shared `campaigns/generate.ts` → `ai/execute.ts` | `claude-sonnet-4-6` | WIRED | Multi-channel (SMS/email/social); → needs David operational verify (advert_channels migration pending) |
| **PMI schedule suggest** | `api/pmi/suggest.ts` | POST → direct Anthropic call (text-only, not via execute.ts) | `claude-sonnet-4-6` | WIRED | Returns `{tasks:[{name,interval}]}`; 3–8 tasks; ⚠️ 13th Vercel function — deploy blocked by Hobby limit |

---

## DEPRECATED / DARK

| Feature | Path | Model config | Status | Action |
|---|---|---|---|---|
| **Ignition AI features (6 modules)** | `shared/ai/AIEngine.ts` → `VITE_API_URL` → Railway Python | Haiku for invoice_audit/dtc_decode/estimate_draft/compliance_check/customer_summary; Sonnet for predictive_analysis/savings_report | **DARK** — `VITE_API_URL` unset in all Vercel deploys; every call returns `{ok:false}` silently | TD#25: port dtc_decode + estimate_draft to Vercel functions first, then kill Railway. Do NOT reuse AIEngine.ts for new Cultivar features. |

---

## Capability registry (shared/ai/capabilities.ts) — quick reference

| Key | Model | MaxTokens | Purpose |
|---|---|---|---|
| `discovery_identity` | `claude-haiku-4-5-20251001` | 1000 | Discovery first-pass identity extraction |
| `discovery_analysis` | `claude-sonnet-4-6` | 2000 | Discovery pain/opportunity analysis |
| `discovery_synthesis` | `claude-sonnet-4-6` | 2000 | Discovery full synthesis report |
| `campaign_generate` | `claude-sonnet-4-6` | 3000 | Campaign post generation |
| `social_generate` | `claude-sonnet-4-6` | 800 | Social media draft generation |

Per-business model overrides possible: `ai/execute.ts` checks `business_modules.config.model` before falling back to capability default.
