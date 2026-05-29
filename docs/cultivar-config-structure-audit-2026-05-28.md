# Cultivar OS — Per-Customer Config Structure Audit
**Date:** 2026-05-28  
**Author:** Claude Code (read-only audit — no code changes, no commits)  
**Purpose:** Map what already exists before designing a per-customer, per-capability configuration model.

---

## AREA 1 — TENANT ROW (`nurseries` table)

### TypeScript type (`types/nursery.ts`)

The declared `Nursery` interface has 10 fields:

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | PK |
| `name` | `string` | READ: Dashboard, generate-posts |
| `address` | `string \| null` | READ: useNursery (`select *`) — but NO component uses it |
| `phone` | `string \| null` | READ: useNursery only — no component renders it |
| `email` | `string \| null` | READ: useNursery only — no component renders it |
| `website` | `string \| null` | READ: useNursery only — no component renders it |
| `logo_url` | `string \| null` | READ: useNursery only — no component renders it |
| `qb_realm_id` | `string \| null` | READ: useModules (QB tile active state), invoice/cultivar.ts |
| `tax_rate` | `number` | READ: invoice/cultivar.ts fetches it but uses `order.tax_amount` instead — dead read |
| `created_at` | `string` | — |

### Columns that EXIST in the database but are NOT in the TypeScript type

These are read or written by server-side API handlers directly but missing from `Nursery`:

| Column | Where READ | Where WRITTEN |
|---|---|---|
| `qb_access_token` | `api/qbo/invoice/cultivar.ts` → `refreshQBToken()` | `api/qbo/callback.ts` |
| `qb_refresh_token` | `shared/src/quickbooks/refresh.ts` | `api/qbo/callback.ts` |
| `qb_token_expires_at` | `shared/src/quickbooks/refresh.ts` | `api/qbo/callback.ts`, migration 20260523 |
| `qb_needs_reconnect` | `Dashboard.tsx` (`select('name, qb_needs_reconnect')`) | `api/qbo/callback.ts`, `refresh.ts` |

`Dashboard.tsx` reads `qb_needs_reconnect` via an ad-hoc `select('name, qb_needs_reconnect')` query that bypasses the `useNursery` hook entirely. The `Nursery` type never exposes this field.

### Column that appears in CLAUDE.md plans but does NOT exist in code or type

| Column | Status |
|---|---|
| `owner_id` | Mentioned in CLAUDE.md post-demo tasks; CLAUDE.md says it is "currently NULL." Never read or written anywhere in code. Migration for it does not exist. |

### Identity / config fields that are ABSENT entirely

Fields a real multi-tenant nursery row should carry that are not present:

| Missing Field | Why It Matters |
|---|---|
| `default_install_price` | Explicitly planned in CLAUDE.md post-demo tasks. Currently `install_price` is per-plant in the `plants` table. No nursery-level default. |
| `brand_color` | The app hardcodes `#27500A` everywhere. No per-customer brand color. |
| `state` (nursery's state) | Customer inserts default to `state: 'TX'`; there is no nursery.state to derive the default from. |
| `subscription_plan` | `useModules.ts:100` hardcodes `const nurseryPlan = 'starter'`. No subscription field exists. |
| `timezone` | All date logic (`todayStart()`, `weekStart()`) runs in server/browser local time. No nursery-level timezone. |

### Summary

The `Nursery` type represents only the customer-facing identity half of the row. The QB credential columns are a second, undeclared half that only server-side code sees. Five fields that should be on the row (install_price_default, brand_color, state, subscription_plan, timezone) don't exist yet.

`tax_rate` deserves a separate callout: it IS in the DB and IS fetched in `invoice/cultivar.ts`, but the fetch result is never used for computation — the tax has already been computed and stored in `orders.tax_amount` when the invoice builder runs. Every actual tax calculation in the system uses the hardcoded `0.0825` constant (see Area 2).

---

## AREA 2 — HARDCODED VALUES THAT SHOULD BE CONFIG

### Nursery name / identity strings

| File | Line | Hardcoded Value | Config Field That Should Replace It |
|---|---|---|---|
| `src/pages/PlantProfile.tsx` | 108 | `"LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336"` | `nursery.name`, `nursery.address` (city + state), `nursery.phone` |
| `src/components/checkout/TransportToggle.tsx` | 17, 22 | `"LAWNS delivers"` / `"LAWNS delivers & installs"` | `nursery.name` (short form prefix) |
| `src/pages/CartReview.tsx` | 154 | `"✓ LAWNS handling transport"` | `nursery.name` |
| `src/pages/Confirmation.tsx` | 113 | `"LAWNS handling delivery/install"` | `nursery.name` |
| `src/pages/CustomerCapture.tsx` | 250 | `"…special offers from LAWNS Tree Farm"` | `nursery.name` |
| `src/types/order.ts` | 52 | `'LAWNS staff transport'` (in `buildTransportNote()`) | `nursery.name` |
| `api/orders/submit.ts` | 13 | `'LAWNS staff transport'` (duplicate `buildTransportNote`) | `nursery.name` |
| `api/qbo/invoice/cultivar.ts` | 208 | `'LAWNS Tree Farm staff transport'` (QB line description) | `nursery.name` |
| `api/social/generate-posts.ts` | 82 | `?? 'LAWNS Tree Farm'` (fallback if nursery lookup fails) | Safe minor fallback; low priority |

> Note: `buildTransportNote()` is duplicated — once in `src/types/order.ts` (frontend, unused in production flow) and once inline in `api/orders/submit.ts` (the actual server path). The frontend copy references LAWNS by name; the server copy also does.

### Tax rate

The field `tax_rate` exists in the `nurseries` table and is in the `Nursery` type, but it is never used for computation. Every actual tax calculation uses a hardcoded constant.

| File | Line | Hardcoded Value | Config Field That Should Replace It |
|---|---|---|---|
| `src/lib/constants.ts` | 1 | `export const TAX_RATE = 0.0825` | `nurseries.tax_rate` |
| `api/orders/submit.ts` | 3 | `const TAX_RATE = 0.0825` (server-side duplicate) | `nurseries.tax_rate` |
| `src/pages/CartReview.tsx` | 165 | `"Tax (8.25%)"` (display label) | Formatted from `nurseries.tax_rate` |
| `src/pages/Confirmation.tsx` | 156 | `"Tax (8.25%)"` (display label) | Formatted from `nurseries.tax_rate` |
| `api/qbo/invoice/cultivar.ts` | 220 | `'Texas Sales Tax (8.25%)'` (QB line description) | Formatted from `nurseries.tax_rate` |

Three separate files carry the same `0.0825` literal. If a future nursery is in a different tax jurisdiction, all three must be updated, and the DB column is silently ignored.

### Netting price fallback

| File | Line | Hardcoded Value | Config Field That Should Replace It |
|---|---|---|---|
| `src/pages/AddOns.tsx` | 39 | `?? 10` (netting price fallback) | `addons.price_per_plant` (the netting addon row in DB) |
| `src/pages/CartReview.tsx` | 28 | `?? 10` (same fallback) | Same |
| `src/pages/Confirmation.tsx` | 67 | `?? 10` (same fallback) | Same |

These fallbacks exist because the netting addon may not have loaded from the DB yet. The fallback value is $10, which matches the current seed data. If the netting price changes in the DB, the fallback stays stale.

### Leakage average value

| File | Line | Hardcoded Value | Config Field That Should Replace It |
|---|---|---|---|
| `src/pages/Dashboard.tsx` | 12 | `const LEAKAGE_AVG_VALUE = 28` | `nurseries` config field, or a vertical-level default |

The comment on this line reads: `// Configurable — will move to verticalConfig post-demo`. The value drives the "estimated missed revenue" display on the dashboard. Different nurseries would have different average add-on values.

### Subscription plan

| File | Line | Hardcoded Value | Config Field That Should Replace It |
|---|---|---|---|
| `src/hooks/useModules.ts` | 100 | `const nurseryPlan = 'starter'` | `nurseries.subscription_plan` |

This controls which modules are locked (growth-tier only). With plan always `'starter'`, all tier-gating is permanently locked regardless of what a real customer has paid for.

### Geographic defaults

| File | Line | Hardcoded Value | Config Field That Should Replace It |
|---|---|---|---|
| `api/orders/submit.ts` | 53, 68 | `state: customer.state ?? 'TX'` | Default derived from `nurseries.state` |

### Demo page (acceptable as-is)

`src/pages/DemoQBInvoice.tsx` contains full LAWNS identity hardcoded: name, address (400 Honeycomb Mesa, Leander TX 78641), phone (512) 450-3336. This is a demo-only fallback page, not a production flow, so it is low priority. Noted for completeness.

---

## AREA 3 — BLOTATO / SOCIAL CONNECTION

### a) API Key Storage

The `BLOTATO_API_KEY` is a **single shared Vercel environment variable** — one key for the entire TRACE platform, not per-customer. Read only in `api/social/publish.ts:46`.

No per-customer Blotato API key exists anywhere. Every publish call from any nursery uses TRACE's own Blotato account as the posting vehicle.

### b) Social Account IDs

Per-customer social account IDs ARE persisted, but only partially:

- `blotato_account_id` (string) — stored in `nursery_modules.config.blotato_account_id` via the Social Setup wizard (`api/social/enable.ts`)
- `platforms` (string[]) — stored in `nursery_modules.config.platforms` (e.g. `['instagram', 'facebook']`)

What is NOT stored: platform-specific IDs (Instagram page ID, Facebook page ID, etc.). Blotato resolves these internally from `accountId`. This is by design given the Blotato API shape.

**Critical gap:** `generate-posts.ts` ignores `config.platforms` entirely. Every generated post is hardcoded to `platform: 'instagram'` regardless of which platforms the customer configured in the setup wizard. The platforms array is stored but never read by the generation or publish path.

### c) End-to-End Publish Path

```
Order checkout complete (useSubmitOrder.ts)
  │
  ├─► [non-blocking fire-and-forget]
  │     POST /api/social/generate-posts
  │       ├─ Guards: module enabled+configured in nursery_modules
  │       ├─ Fetches nursery.name for AI context
  │       ├─ Calls Claude API (claude-sonnet-4-6)
  │       ├─ Parses 3 posts: educational, customer_story, seasonal
  │       └─ Inserts to social_drafts → status='draft', platform='instagram'
  │          (on failure: inserts status='failed' row)
  │
Dashboard loads (Dashboard.tsx)
  │
  └─► loadSocialDrafts()
        SELECT from social_drafts WHERE status='draft'
        Renders each draft with "Publish" button
          │
          └─► User clicks "Publish"
                POST /api/social/publish { draft_id }
                  ├─ Reads social_drafts row
                  ├─ Reads nursery_modules.config.blotato_account_id
                  ├─ Reads BLOTATO_API_KEY from env
                  └─ POSTs to https://backend.blotato.com/v2/posts
                       On success: status='published', removed from dashboard
                       On failure: status='failed'
```

### d) CRITICAL SAFETY CHECK — Auto-Publish Risk

**GREEN — no auto-publish path exists.**

The `useSubmitOrder.ts` fire-and-forget call invokes `generate-posts` only. That endpoint writes to `social_drafts` with `status='draft'` and STOPS. It has no reference to and makes no call to `/api/social/publish`.

The publish endpoint is only reachable via:
1. Authenticated user on the `/dashboard` route
2. Explicit button click on a specific draft card
3. The `handlePublish(draftId)` function in `Dashboard.tsx` which POSTs to `/api/social/publish`

No automated, scheduled, or order-triggered path calls publish. The human approval gate (dashboard "Publish" button) is the only bridge between draft and live post.

### e) Demo vs. Real-Customer Posting Distinction

**No distinction exists in code today.**

The only guard is whether `nursery_modules.enabled && configured` is true. If the demo nursery (DEMO_NURSERY_ID) has social_media enabled and `blotato_account_id` configured, test orders during the demo WILL generate real draft posts into `social_drafts`. If someone then clicks "Publish" on those drafts, they will hit real social accounts via Blotato.

No sandbox flag, no demo-mode guard, no test/staging account concept exists in the social pipeline.

---

## AREA 4 — SETTINGS UI

**No Settings page exists. No `/settings` route. No Settings component.**

The router (`src/router.tsx`) has these routes:
- `/plant/:tagId` — public (PlantProfile)
- `/plant/:tagId/addons` — public (AddOns)
- `/checkout/customer`, `/checkout/review`, `/checkout/confirm` — public
- `/login`, `/signup`, `/privacy`, `/terms` — public
- `/dashboard` — private (Dashboard)
- `/social/setup` — private (SocialSetup)
- `/demo/quickbooks-invoice` — no-auth demo page

The ONLY config-editing UI in the entire app is `/social/setup` → `SocialSetup.tsx`, which edits exactly two things: `blotato_account_id` and `platforms[]` in `nursery_modules.config` for the social_media module.

Everything else — tax rate, install price, nursery name/address/phone, netting price, leakage avg value, QB connection, subscription plan — is either hardcoded in source or only changeable via direct DB access.

---

## AREA 5 — MODULE → CONFIG LINKAGE

**The pattern exists and is live for one module (social_media). Foundation is real.**

### What exists

The `nursery_modules` table has a `config JSONB` column. The `ModuleData` TypeScript interface in `useModules.ts` includes:

```typescript
config: Record<string, unknown> | null;
```

This config is:
- Written by `api/social/enable.ts`: `config: { blotato_account_id: string, platforms: string[] }`
- Read by `api/social/publish.ts`: `config.blotato_account_id`
- Loaded into the frontend by `useModules()` and available on every `ModuleData` object

The upsert pattern in `enable.ts` (`onConflict: 'nursery_id,module_key'`) is the intended write path.

### Current state per module

| Module Key | `nursery_modules` Row | Config Used | Config Contents |
|---|---|---|---|
| `qr_checkout` | Row exists (seeded) | No | null |
| `qb_invoicing` | Row exists (seeded) | **No** — QB tokens live in `nurseries` table directly | null |
| `online_shop` | Row exists (seeded) | No | null |
| `social_media` | Row exists (seeded + configured via wizard) | **Yes** | `{ blotato_account_id, platforms }` |
| `followup_engine` | Row exists (seeded) | No | null |
| `delivery_routing` | Row exists (seeded) | No | null |
| `contractor_tiers` | Row exists (seeded) | No | null |
| `seasonal_module` | Row exists (seeded) | No | null |
| `business_insights` | Row exists (seeded) | No | null |
| `inventory_intake` | Row exists (seeded) | No | null |

### Notable inconsistency: QB module config

QuickBooks credentials (`qb_access_token`, `qb_refresh_token`, `qb_token_expires_at`, `qb_realm_id`, `qb_needs_reconnect`) are stored directly in the `nurseries` table, NOT in `nursery_modules.config`. This is the one module that breaks the pattern. The QB tile's active/available state is determined by whether `nurseries.qb_realm_id` is set (checked in `useModules.ts:127-129`), not by `nursery_modules.enabled + configured`.

If the config block pattern were applied consistently, QB config would live in `nursery_modules.config` for the `qb_invoicing` module key, keeping credential storage uniform.

### What the pattern lacks

The config system has no schema validation — `Record<string, unknown>` means any shape is accepted. There is no version field, no migration path for config shape changes, and no UI pattern for reading back the current config value (the setup wizard is write-only — it doesn't populate the Blotato account ID field if you re-visit `/social/setup`).

---

## SUMMARY TABLE

| Area | Finding | Severity for Multi-Tenant |
|---|---|---|
| Nursery type incomplete | 4 QB columns exist in DB, absent from TypeScript type | Medium — server-only code works; typing is just loose |
| Nursery type unused fields | `address`, `phone`, `email`, `website`, `logo_url` all fetched but never rendered | High — these are the fields that fix the PlantProfile footer hardcode |
| `tax_rate` dead read | Fetched in invoice builder, but `order.tax_amount` is used instead | High — a second nursery with a different tax rate would silently use the wrong rate |
| Missing nursery fields | `owner_id`, `brand_color`, `state`, `subscription_plan`, `timezone`, `default_install_price` absent | Medium-High for next customer |
| Hardcoded LAWNS strings | 9 locations in src/, 4 in api/ — name appears in transport labels, confirmations, QB lines | **Critical** before second nursery customer |
| Hardcoded tax rate | 3 separate `0.0825` literals; DB field exists but is never used for computation | **Critical** for any non-TX or different-rate nursery |
| Hardcoded netting fallback `$10` | 3 locations; stale if DB price changes | Low — fallback only, DB price wins when loaded |
| Leakage avg value `$28` | Hardcoded in Dashboard | Medium — affects dashboard accuracy |
| Subscription plan `'starter'` | Hardcoded in useModules | Medium — all growth-tier modules permanently locked |
| BLOTATO_API_KEY is shared/global | One TRACE key for all customers | **Architecture decision needed** — acceptable for Phase 0, must be resolved before multi-tenant launch |
| Social platform selection ignored | Wizard stores `platforms[]`, but generate-posts always emits `instagram` | Medium — affects customers who set up non-Instagram platforms |
| No demo/real posting distinction | Social drafts use real accounts when module is configured | Low risk now (human approval gate is solid), but worth noting |
| Settings UI absent | Zero settings editing UI except social setup wizard | High — no nursery can self-configure anything |
| Module config pattern is live | `nursery_modules.config` JSONB works end-to-end for social_media | Positive — foundation exists |
| QB breaks module config pattern | QB credentials in `nurseries` table, not `nursery_modules.config` | Medium — inconsistency to resolve before more modules need credential storage |

---

*Read-only audit. No code changes made. No files committed.*  
*Next step: design session to define the config model using these findings as input.*
