# Environment Variables Inventory — TRACE Platform (cultivar-os)
# Last updated: 2026-06-13
# Canonical source for "what env vars exist, where they're used, and which environments they belong to"
# NEVER stores values — names and presence only.
# Rule: update this file any session that adds, removes, or reclassifies an env var.

---

## Source of truth

Vercel dashboard → cultivar-os project → Settings → Environment Variables.
This doc reconciles CLAUDE.md §2 "Vercel Environment Variables" (partial/possibly stale) with
what's confirmed live in Vercel (from David's screenshots 2026-06-12) and what's referenced in
code. CLAUDE.md §2 block is now stale — it points here.

---

## CONFIRMED LIVE IN VERCEL (from David's screenshots 2026-06-12)

| Name | Environments | Purpose | Used by |
|---|---|---|---|
| `VITE_SUPABASE_URL` | Dev / Preview / Prod | Supabase project URL (bgobkjcopcxusjsetfob) — frontend | shared/supabase/client.ts, api functions (fallback) |
| `VITE_SUPABASE_ANON_KEY` | Dev / Preview / Prod | Supabase anonymous key — frontend | shared/supabase/client.ts |
| `SUPABASE_URL` | Dev / Preview / Prod | Supabase project URL — server-side (api functions) | All api functions |
| `SUPABASE_SERVICE_KEY` | Dev / Preview / Prod | Supabase service role key (bypasses RLS) — server-side only | All api functions that write or admin-query |
| `ANTHROPIC_API_KEY` | Dev / Preview / Prod | Anthropic API key for Claude calls — server-side only | api/campaigns, api/discovery/ingest, api/pmi/suggest, api/receipts/ocr (fallback), api/social/generate-posts |
| `GEMINI_API_KEY` | Dev / Preview / Prod | Google Gemini API key — server-side only | api/receipts/ocr (primary) |
| `QBO_CLIENT_ID` | Dev / Preview / Prod | QuickBooks OAuth app client ID | api/qbo/auth-url, api/qbo/callback |
| `QBO_CLIENT_SECRET` | Dev / Preview / Prod | QuickBooks OAuth app client secret | api/qbo/auth-url, api/qbo/callback |
| `QBO_REDIRECT_URI` | Dev / Preview / Prod | QuickBooks OAuth redirect URI (`https://cultivar-os.vercel.app/api/qbo/callback`) | api/qbo/auth-url, api/qbo/callback |
| `QBO_ENVIRONMENT` | Dev / Preview / Prod | `production` (updated 2026-05-22 post Intuit production approval) | api/qbo/callback, api/qbo/invoice/cultivar |
| `VITE_DEMO_NURSERY_ID` | Dev / Preview / Prod | Demo nursery UUID (a1b2c3d4-0000-0000-0000-000000000001) — frontend | Cultivar-os frontend pages |
| `VITE_DEMO_BUSINESS_ID` | Dev / Preview / Prod | Demo business UUID (same as DEMO_NURSERY_ID) — frontend. Added 2026-05-29 | Cultivar-os frontend pages |
| `VITE_TAX_RATE` | Dev / Preview / Prod | Texas sales tax rate (`0.0825`) | orders/submit.ts (hardcoded fallback), frontend cart |
| `VITE_APP_URL` | Dev / Preview / Prod | App base URL — confirmed in Vercel screenshots | ⚠️ zero code references found (grep 2026-06-13); possibly orphaned |

---

## ORPHANED IN VERCEL — set but no code references

| Name | Last used | Note |
|---|---|---|
| `BLOTATO_API_KEY` | ~2026-06-08 (before removal) | ⚠️ Blotato removed from codebase (commit 35913b2, 2026-06-08) — `api/social/publish.ts` deleted; zero code references found (grep 2026-06-13). Safe to remove from Vercel after confirming no other reference. |
| `VITE_APP_URL` | Unknown | ⚠️ No code reference found. May have been for a redirect or onboarding URL. Confirm before removing. |

---

## REFERENCED IN CODE — not confirmed in Vercel (check dashboard before assuming present)

| Name | Required / Optional | Purpose | Used by |
|---|---|---|---|
| `RESEND_API_KEY` | Optional | Resend email provider — enables email notifications | shared/notifications/send.ts:126 |
| `TWILIO_ACCOUNT_SID` | Optional | Twilio — enables SMS notifications | shared/notifications/send.ts:127 |
| `TWILIO_AUTH_TOKEN` | Optional | Twilio credential | shared/notifications/send.ts |
| `TWILIO_FROM_NUMBER` | Optional | Twilio originating number | shared/notifications/send.ts |
| `FROM_EMAIL` | Optional | Sender address for notification emails | shared/notifications/send.ts |
| `AI_DEBUG` | Optional | Set `true` to emit `[TRACE:ai]` request/response logs | shared/ai/execute.ts:51 |
| `OCR_PRIMARY_MODEL` | Optional override | Override default OCR primary model (default: `gemini-2.5-flash`) | api/receipts/ocr.ts:111 |
| `OCR_FALLBACK_MODEL` | Optional override | Override default OCR fallback model (default: `claude-haiku-4-5-20251001`) | api/receipts/ocr.ts:112 |

> **Note on notifications:** Email notifications work via direct SMTP config in Supabase, not necessarily
> via RESEND_API_KEY in Vercel. Check which path is active before adding Twilio/Resend vars.

---

## LEGACY — Ignition mobile (not for cultivar-os Vercel project)

| Name | Context |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Ignition mobile (Expo) — referenced in shared/supabase/client.ts as Expo fallback |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Ignition mobile (Expo) — same pattern |
| `EXPO_PUBLIC_API_URL` / `VITE_API_URL` | Legacy Railway/Python path — DEPRECATED. Dark in all Vercel deploys. Do not reuse. |
| `VITE_MARKETING_URL` | Ignition OS CoreApp.jsx only — not in cultivar-os |
