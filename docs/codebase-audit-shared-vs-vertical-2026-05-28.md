# TRACE Codebase Audit — Shared vs Vertical
# Generated: 2026-05-28 from file-by-file source inspection
# Scope: packages/shared/src/ · packages/cultivar-os/ · packages/ignition-os/ · CAI/ cross-reference

---

## How to read this document

**Verdict codes:**

| Code | Meaning |
|---|---|
| `SHARED ✅` | Correctly in packages/shared/src/ — do not move |
| `KEEP VERTICAL` | Vertical-specific — correct location, do not move |
| `EXTRACT` | In one vertical, needs to move to shared — needed by 2+ verticals |
| `DEAD CODE ❌` | No active caller — delete |
| `DUPLICATE ❌` | Exact copy of something already in shared — delete the copy |
| `MISPLACED ❌` | In the wrong package or has the wrong file extension — relocate |
| `STUB ⚠️` | File exists but contains no implementation — mark or build |

**Status codes:** ✅ Built and wired · 🟡 Built, not wired · ❌ Dead / Stub / Missing

---

## Critical Findings (Read First)

### Finding 1 — Three exact duplicate files in cultivar-os
`packages/cultivar-os/src/lib/shared/` is an accidental shadow of `packages/shared/src/`. Three files are character-for-character identical to their counterparts in packages/shared/ and are never imported from there instead.

- `cultivar-os/src/lib/shared/quickbooks/invoice.ts` = `shared/src/quickbooks/invoice.ts`
- `cultivar-os/src/lib/shared/quickbooks/oauth.ts` = `shared/src/quickbooks/oauth.ts`
- `cultivar-os/src/lib/shared/supabase/auth.ts` = `shared/src/supabase/auth.ts`

These create silent drift risk: if shared/src/ is updated, the cultivar-os shadow copy falls out of sync with no warning. **Delete all three. Import from `@trace/shared`.**

### Finding 2 — Python dead code in cultivar-os/api/
Three FastAPI files exist in the Vercel functions directory. They are from an earlier architecture where Cultivar OS was going to use Railway (like Ignition). The active backend is TypeScript serverless functions. These Python files are never called.

- `packages/cultivar-os/api/main.py`
- `packages/cultivar-os/api/routers/orders.py`
- `packages/cultivar-os/api/routers/quickbooks.py`

**Delete all three.** They create confusion about which backend is authoritative.

### Finding 3 — ai_router.py in packages/shared/src/ai/
A Python FastAPI file at `packages/shared/src/ai/ai_router.py`. This is the same file as `CAI/ai_router.py` but placed inside a TypeScript package's src/ directory. Vite never compiles it. It is never imported. It belongs in the Railway backend deployment (CAI/), not in the shared TypeScript package.

**Delete from packages/shared/src/ai/. The authoritative copy stays in CAI/ai_router.py.**

### Finding 4 — TechKeypad.jsx in packages/shared/src/components/
Header explicitly states: "PLATFORM: Mobile (React Native). PURPOSE: PIN-based lock screen. DEPENDENCIES: react-native, lucide-react-native, expo-haptics." This is a React Native component in a web-first TypeScript shared package. It will never compile for web.

**Move to packages/ignition-os/modules/TechKeypad.native.js (already exists there). Delete from shared.**

### Finding 5 — marginEngine.ts in packages/shared/src/pricing/ is a stub
File contents: one comment pointing to IgnitionMobile/CodeBaseB/MarginEngine.js, then `export {};`. The real margin engine is `packages/ignition-os/MarginEngine.js` — a fully implemented slab pricing engine with tier discounts (FLEET, FF, LEGACY), editable configuration, and a retail price calculator.

**The shared/src/pricing/marginEngine.ts file needs to be built by porting ignition-os/MarginEngine.js to TypeScript. Until then it is a stub that will silently import as an empty object.**

### Finding 6 — Nine mobile-only .jsx files in packages/ignition-os/modules/
These files have `.jsx` extension but their headers say "PLATFORM: Mobile (React Native)" and they import from `react-native`. The `.native.js` counterpart already exists alongside each one. The `.jsx` versions are either: (a) wrongly named — should be `.native.js`; or (b) dead orphans superseded by the `.native.js` file.

Files affected:
- `IgnitionVIN.jsx` → should be `.native.js`
- `IgnitionQueue.jsx` → should be `.native.js`
- `IgnitionVoice.jsx` → should be `.native.js`
- `IgnitionVendor.jsx` → should be `.native.js`
- `TriageOptimizer.jsx` → should be `.native.js`
- `PartsList.jsx` → should be `.native.js`
- `InventoryAI.jsx` → should be `.native.js`
- `ToolChecklist.jsx` → should be `.native.js`
- `CustomerEstimate.jsx` → should be `.native.js`

**Rename all nine to `.native.js`. Vite will ignore them during the web build.**

---

## Part 1: packages/shared/src/

### AI

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `ai/AIEngine.ts` | Unified AI router — 13 tasks across Claude, Gemini, OpenAI. Tier gating. Convenience wrappers. | ✅ Built | `SHARED ✅` |
| `ai/ai_router.py` | FastAPI AI backend — copy of CAI/ai_router.py placed in wrong directory | ❌ Never compiled | `MISPLACED ❌` → delete, keep CAI/ai_router.py |

### Auth

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `auth/configureAuth.tsx` | Auth factory — returns useSession, PrivateRoute, AuthProvider for email or PIN strategy | ✅ Built | `SHARED ✅` |
| `auth/index.ts` | Export barrel | ✅ | `SHARED ✅` |

### Components

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `components/Badge.tsx` | Status badge chip | ✅ | `SHARED ✅` |
| `components/Button.tsx` | Primary/secondary button | ✅ | `SHARED ✅` |
| `components/Card.tsx` | Content card wrapper | ✅ | `SHARED ✅` |
| `components/LockedOverlay.tsx` | Trial-expired blur overlay for locked modules | ✅ | `SHARED ✅` |
| `components/QuickBooksConnector.jsx` | QB connection manager UI — handles OAuth, status display, sync, disconnect. Used in Onboarding Wizard and OMNI Settings. | ✅ Web React DOM | `SHARED ✅` (rename to .tsx) |
| `components/SavingsReport.jsx` | 14-day trial savings report — conversion hook showing dollar value of TRACE OS to a skeptical owner. Uses wizard data day 1; improves with real history. | ✅ Web React DOM | `SHARED ✅` (rename to .tsx) |
| `components/TechKeypad.jsx` | PIN lock screen — React Native component placed in wrong package | ❌ React Native in TS package | `MISPLACED ❌` → delete, already exists at ignition-os/modules/TechKeypad.native.js |
| `components/tiles/Tile.tsx` | Single tile (active/available/locked states, count badge) | ✅ | `SHARED ✅` |
| `components/tiles/TileGrid.tsx` | Tile grid layout wrapper | ✅ | `SHARED ✅` |

### Notifications

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `notifications/campaigns/index.ts` | Campaign sender — sends one template to a recipient list with throttle + TCPA compliance | ✅ | `SHARED ✅` |
| `notifications/index.ts` | Export barrel | ✅ | `SHARED ✅` |
| `notifications/queue.ts` | In-memory retry queue with exponential backoff. Swap for Redis/Supabase without changing caller API. | ✅ | `SHARED ✅` |
| `notifications/send.ts` | Core notification delivery engine — Resend (email) + Twilio (SMS), TCPA opt-in enforcement, demo mode (logs without sending if keys absent) | 🟡 Built, not confirmed wired | `SHARED ✅` |
| `notifications/templates/assessment.ts` | Assessment vertical templates | ✅ | `SHARED ✅` |
| `notifications/templates/base.ts` | Base template interface | ✅ | `SHARED ✅` |
| `notifications/templates/cultivar.ts` | Cultivar OS notification templates (5 templates: order_confirmation, netting_waiver_reminder, care_tips_30d, seasonal_offer, delivery_scheduled) | ✅ | `SHARED ✅` |
| `notifications/templates/ignition.ts` | Ignition OS notification templates | ✅ | `SHARED ✅` |
| `notifications/templates/index.ts` | Template registry | ✅ | `SHARED ✅` |
| `notifications/types.ts` | NotificationPayload, NotificationResult, etc. | ✅ | `SHARED ✅` |

### Pricing

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `pricing/marginEngine.ts` | Slab pricing calculator | ❌ STUB — exports `{}` only | `STUB ⚠️` → port ignition-os/MarginEngine.js to TypeScript here |

### QR

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `qr/generate.ts` | QR code generation → PNG data URL | ✅ | `SHARED ✅` |
| `qr/print.ts` | QR label print utility (with optional nursery name + label text) | ✅ | `SHARED ✅` |

### QuickBooks

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `quickbooks/customer.ts` | QB customer sync — pull customers, map to TRACE Customer type | ✅ | `SHARED ✅` |
| `quickbooks/invoice.ts` | QB invoice sync — pull, map, push, toQboInvoice | ✅ | `SHARED ✅` |
| `quickbooks/oauth.ts` | QB OAuth 2.0 flow (frontend) — initiateOAuth popup, poll status, saveConnection. **Known issue: IGNITION_OS_DATA hardcoded as STORAGE_KEY.** | 🟡 Wired but has hardcode | `SHARED ✅` (fix STORAGE_KEY before second vertical) |
| `quickbooks/refresh.ts` | Proactive server-side token refresh — refreshes if missing or within 10 min of expiry, writes back to nurseries row, sets qb_needs_reconnect if dead | ✅ | `SHARED ✅` |

### Supabase

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `supabase/auth.ts` | PIN auth + trial clock — hashPin, authenticate, autoEnrollDevice, logout, getTrialStatus (14-day platform), checkTrialStatus (30-day per-module) | ✅ | `SHARED ✅` |
| `supabase/client.ts` | Supabase client singleton (env-aware) | ✅ | `SHARED ✅` |
| `supabase/types.ts` | Shared Supabase row types — tables that exist in every vertical (SubscriptionTier, AIUsageLog, NotificationLog, GrowthGoal, etc.) | ✅ | `SHARED ✅` |

---

## Part 2: packages/cultivar-os/src/

### App Shell

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `App.tsx` | Root React component + router provider | ✅ | `KEEP VERTICAL` |
| `main.tsx` | Vite entry point | ✅ | `KEEP VERTICAL` |
| `router.tsx` | Route definitions | ✅ | `KEEP VERTICAL` |
| `styles/globals.css` | Global CSS (Tailwind base + custom props) | ✅ | `KEEP VERTICAL` |

### Components — Checkout

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `components/checkout/AddonCard.tsx` | Addon option card with toggle and price | ✅ | `EXTRACT` — generic addon selection pattern needed by Conduit, KINNA-OS → `shared/src/components/checkout/AddonCard.tsx` |
| `components/checkout/NettingPrompt.tsx` | Urgency-copy prompt for netting add-on — red border, pre-checked, loss-framing language (Regina Rule) | ✅ | `KEEP VERTICAL` — content is nursery-specific; extract urgency-prompt shell separately if other verticals need it |
| `components/checkout/QtySelector.tsx` | Numeric quantity selector clamped to [1, max] | ✅ | `EXTRACT` — needed everywhere there's a quantity → `shared/src/components/forms/QtySelector.tsx` |
| `components/checkout/TransportToggle.tsx` | 3-option toggle: self / delivery / installation | ✅ | `KEEP VERTICAL` — options are nursery-specific; extract a generic OptionToggle shell if needed |

### Components — Layout

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `components/layout/NavBar.tsx` | Top navigation bar (green brand, sign-out) | ✅ | `KEEP VERTICAL` |
| `components/layout/PrivateRoute.tsx` | Auth-gated route — redirects to /login if not authenticated | ✅ | `DUPLICATE ❌` — identical behavior provided by `configureAuth.tsx` in shared. Verify import source then delete. |

### Components — Plant

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `components/plant/PlantCard.tsx` | Plant thumbnail card | ✅ | `KEEP VERTICAL` |
| `components/plant/PlantHero.tsx` | Plant detail hero section | ✅ | `KEEP VERTICAL` |
| `components/plant/PlantTimeline.tsx` | Visual timeline of plant life events | ✅ | `EXTRACT PATTERN` — same shape as vehicle job history, asset service log. Build `shared/src/components/AssetTimeline.tsx` parameterized by event type. |

### Context

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `context/NurseryProvider.tsx` | Resolves auth.uid() → nursery row. Exposes useNursery() context. Shows "Account not linked" error for unmatched users. | ✅ | `EXTRACT PATTERN` → `shared/src/context/TenantProvider.tsx`. **This is the most important extraction.** Every vertical needs auth → tenant resolution. The pattern is identical; only the table name (nurseries vs shops) differs. |

### Hooks

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `hooks/useAddons.ts` | Fetches available addons for a nursery + plant from Supabase | ✅ | `KEEP VERTICAL` |
| `hooks/useAuth.ts` | Supabase auth state hook | 🟡 | `DUPLICATE ❌` — check if this wraps configureAuth or duplicates its logic. If duplicating, delete and use configureAuth's useSession. |
| `hooks/useCart.ts` | Zustand cart state | ✅ | `KEEP VERTICAL` |
| `hooks/useModules.ts` | Fetches enabled modules for a nursery from nursery_modules table. Applies tier gating. | ✅ | `EXTRACT` — every vertical needs this exact hook against its own modules table. The current version has `nurseryPlan = 'starter'` hardcoded at line 100 (the Stripe seam). → `shared/src/hooks/useModules.ts` parameterized by tenant_id and table name. |
| `hooks/useNursery.ts` | Returns current nursery from NurseryProvider context | ✅ | `EXTRACT PATTERN` → becomes `useTenant()` after TenantProvider extraction |
| `hooks/usePlant.ts` | Fetches plant by SKU from Supabase | ✅ | `KEEP VERTICAL` |
| `hooks/useSubmitOrder.ts` | Orchestrates order submit: API call → QB invoice → notification → social post generation | ✅ | `KEEP VERTICAL` — nursery-specific orchestration |

### Lib

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `lib/auth.ts` | Supabase auth setup and helper functions | 🟡 | **Verify:** if this wraps configureAuth it is `KEEP VERTICAL`. If it re-implements auth logic it is `DUPLICATE ❌`. |
| `lib/constants.ts` | App constants: DEMO_NURSERY_ID, TAX_RATE, MODULE_META (display names, icons, descriptions for each tile) | ✅ | `KEEP VERTICAL` — vertical-specific constants |
| `lib/supabase.ts` | Supabase client re-import | 🟡 | `DUPLICATE ❌` — almost certainly just re-exports from shared/src/supabase/client. Verify then delete. |
| `lib/shared/quickbooks/invoice.ts` | QB invoice sync | ❌ Exact duplicate of shared | `DUPLICATE ❌` → delete, import from @trace/shared |
| `lib/shared/quickbooks/oauth.ts` | QB OAuth flow | ❌ Exact duplicate of shared | `DUPLICATE ❌` → delete, import from @trace/shared |
| `lib/shared/supabase/auth.ts` | PIN auth + trial clock | ❌ Exact duplicate of shared | `DUPLICATE ❌` → delete, import from @trace/shared |

### Pages

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `pages/AddOns.tsx` | Add-ons selection screen | ✅ | `KEEP VERTICAL` |
| `pages/CartReview.tsx` | Order review and submit | ✅ | `KEEP VERTICAL` |
| `pages/Confirmation.tsx` | Order confirmation — invoice link, scan another | ✅ | `KEEP VERTICAL` |
| `pages/CustomerCapture.tsx` | Customer info form (name, phone, email) | ✅ | `KEEP VERTICAL` |
| `pages/Dashboard.tsx` | Owner dashboard — metrics, tile grid, social drafts panel, QB reconnect banner | ✅ | `KEEP VERTICAL` — but extract MetricsBar + LeakageAlert as shared components |
| `pages/DemoQBInvoice.tsx` | Demo QB invoice preview page (fallback when no real invoice URL) | ✅ | `KEEP VERTICAL` |
| `pages/Login.tsx` | Email/password login form | ✅ | `KEEP VERTICAL` |
| `pages/PlantProfile.tsx` | Plant detail page — hero, timeline, QR, add to cart | ✅ | `KEEP VERTICAL` |
| `pages/Privacy.tsx` | Privacy policy | ✅ | `KEEP VERTICAL` |
| `pages/SignUp.tsx` | Account registration | ✅ | `KEEP VERTICAL` |
| `pages/SocialSetup.tsx` | Social media module setup wizard | ✅ | `KEEP VERTICAL` |
| `pages/Terms.tsx` | Terms of service | ✅ | `KEEP VERTICAL` |

### Types

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `types/customer.ts` | Customer row type | ✅ | `EXTRACT` → move to `packages/shared/src/supabase/types.ts`. Customers table is vertical-agnostic (name, phone, email, opt-ins). |
| `types/nursery.ts` | Nursery row type | ✅ | `KEEP VERTICAL` — nursery-specific fields |
| `types/order.ts` | Order row type | ✅ | `EXTRACT PATTERN` — the Order shape (id, tenant_id, customer_id, total, tax, status, leakage_flag) is the same in every vertical. Move base type to shared, extend in vertical. |
| `types/plant.ts` | Plant row type (nursery asset) | ✅ | `KEEP VERTICAL` |

---

## Part 3: packages/cultivar-os/api/

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `dashboard.ts` | Dashboard metrics endpoint — plants_tracked, inventory_value, today_sales, installs_this_week, leakage_count, qb_needs_reconnect | ✅ | `KEEP VERTICAL` — parameterize and extract the query pattern as shared template before second vertical |
| `main.py` | FastAPI app — Railway backend (superseded by Vercel serverless) | ❌ Dead | `DEAD CODE ❌` → delete |
| `orders/submit.ts` | Order creation — customer dedup, order + items + addons insert, leakage flag, plant status → reserved | ✅ | `KEEP VERTICAL` |
| `qbo/auth-url.ts` | QB OAuth URL generator | ✅ | `KEEP VERTICAL` |
| `qbo/callback.ts` | QB OAuth callback — stores tokens + expires_at in nurseries row | ✅ | `KEEP VERTICAL` |
| `qbo/invoice/cultivar.ts` | QB invoice creation — calls refreshQBToken, builds QB line items, pushes to QBO API | ✅ | `KEEP VERTICAL` |
| `qbo/status.ts` | QB connection status check | ✅ | `KEEP VERTICAL` |
| `routers/orders.py` | FastAPI orders router (Railway — dead) | ❌ Dead | `DEAD CODE ❌` → delete |
| `routers/quickbooks.py` | FastAPI QB router (Railway — dead) | ❌ Dead | `DEAD CODE ❌` → delete |
| `social/enable.ts` | Enables social module — upserts nursery_modules with Blotato account ID | ✅ | `KEEP VERTICAL` |
| `social/generate-posts.ts` | AI post generation — Claude Sonnet with prompt caching, 3 posts per order, writes to social_drafts | ✅ | `KEEP VERTICAL` — Blotato integration and nursery context are cultivar-specific |
| `social/publish.ts` | Blotato publish — reads draft, posts to Blotato v2 API, updates status | ✅ | `KEEP VERTICAL` |

---

## Part 4: packages/ignition-os/

### Core Files

| File | Purpose | Platform | Status | Verdict |
|---|---|---|---|---|
| `App.js` | Entry point — mounts EnrollmentCatch → CoreApp | Universal | ✅ | `KEEP VERTICAL` |
| `CoreApp.jsx` | Master controller — subscription gating, trial blur state, module routing | Web | ✅ | `EXTRACT PATTERN` — the subscription gate + blur wrapper logic belongs in `shared/src/billing/AppShell.tsx`. Every vertical needs this. |
| `DataBridge.js` | localStorage/Supabase sync layer — all shop state, trial clocks, module config, profiles | Universal | ✅ | `KEEP VERTICAL` — intentionally Ignition-specific. Cultivar OS uses Supabase directly. Do not merge. |
| `EnrollmentCatch.jsx` | Security agreement + digital signature (react-signature-canvas). Gating screen before first access. | Web | ✅ | `EXTRACT PATTERN` — any vertical needing a legal agreement before first use needs this shell. Extract WaiverGate to shared. |
| `EnrollmentCatch.native.js` | Same, mobile | Mobile | ✅ | `KEEP VERTICAL` |
| `ErrorBoundary.jsx` | React error boundary | Web | ✅ | `EXTRACT` → `shared/src/components/ErrorBoundary.tsx`. Every React app needs one. |
| `ExternalBridge.js` | Translation layer between external systems (QB, CSV) and DataBridge. Owns OAuth state, format mapping, sync tracking. | Universal | ✅ | `EXTRACT PATTERN` → `shared/src/integrations/`. The namespace pattern (.qbo, .csv, .telematics) is the right architecture for an integration registry. Extract the shape; Ignition specifics stay. |
| `IgnitionCore.js` | Web router + session guard — idle lockout timer, module rendering | Web | ✅ | `KEEP VERTICAL` |
| `IgnitionCore.native.js` | Same, mobile | Mobile | ✅ | `KEEP VERTICAL` |
| `MarginEngine.js` | Slab pricing calculator — fully implemented with editable slab tiers, tier discounts (FLEET/FF/LEGACY), retail price rounding | Universal | ✅ | `EXTRACT` → build `shared/src/pricing/marginEngine.ts` from this (currently a stub). Used by IgnitionProcure, PriceField — will be needed by Conduit OS and anywhere pricing is enforced. |
| `OnboardingWizard.jsx` | First-run 3-path wizard — proves dollar value in 30 min before asking for commitment | Web | ✅ | `EXTRACT PATTERN` → `shared/src/onboarding/WizardShell.tsx`. The 5-step shell (Welcome → Setup → Path → PathExperience → TeamQR) is universal. Each vertical provides its own path implementations. |
| `PriceField.js` | Price input with margin enforcement + leakage detection | Universal | ✅ | `EXTRACT` → `shared/src/components/forms/PriceField.tsx`. Any vertical with pricing needs a margin-enforcing input. |
| `PriceField.jsx` | Same, web version | Web | ✅ | `EXTRACT` (same as above — both versions go to shared) |
| `PriceField.native.js` | Same, mobile | Mobile | ✅ | `KEEP VERTICAL` until mobile build resumes |
| `supabase.js` | Re-exports `supabase` from `packages/shared/src/supabase/client` | ✅ | `KEEP` — correct bridge pattern |

### Ignition OS Hooks

| File | Purpose | Platform | Status | Verdict |
|---|---|---|---|---|
| `hooks/useDataBridge.js` | React hook wrapping DataBridge state | Universal | ✅ | `KEEP VERTICAL` |
| `hooks/useIgnitionCipher.js` | DTC code cipher logic | ✅ | `KEEP VERTICAL` — auto-specific |
| `hooks/useIgnitionVoice.js` | Voice recording + submission to AI transcription | ✅ | `KEEP VERTICAL` — wraps AIEngine voice task |
| `hooks/usePowerSense.js` | Web Battery API — detects if iPad is plugged in to determine toolbox mode vs mobile mode | Web | ✅ | `KEEP VERTICAL` — shop-floor iPad use case specific to auto |

### Ignition OS Modules — Web (React DOM)

These 22 files use `className`, `lucide-react` (not `-native`), and standard DOM React. They are web components.

| File | Purpose | Status | Verdict |
|---|---|---|---|
| `modules/AdminSubscription.jsx` | Module marketplace — owner views all modules, starts trials, sees pricing. Default umbrella price $299/mo. | ✅ | `EXTRACT PATTERN` → `shared/src/billing/ModuleMarketplace.tsx`. Every vertical needs a module on/off screen. |
| `modules/CSVImporter.jsx` | CSV data import wizard — drag, map columns, import | ✅ | `EXTRACT` → `shared/src/data/CSVImporter.tsx`. Every vertical will need data migration at onboarding. |
| `modules/CustomerApproval.jsx` | (No header — likely approval workflow) | 🟡 | Verify purpose then assess. Likely companion to CustomerApprovalPortal. |
| `modules/CustomerApprovalPortal.jsx` | Customer-facing estimate approval with line items and digital signature. Reads from Supabase, writes customer_authorizations. | ✅ | `EXTRACT PATTERN` → `shared/src/components/CustomerApprovalPortal.tsx`. Cultivar OS will need a version (customer reviews order, signs). Conduit OS will need one (customer approves repair quote). |
| `modules/IgnitionAdmin.jsx` | Staff management, role editor, shop settings. ADMIN-gated. | ✅ | `EXTRACT PATTERN` → `shared/src/settings/AdminShell.tsx`. Every vertical needs staff management and settings. |
| `modules/IgnitionAudit.jsx` | AI invoice photo audit — Claude vision flags uncaptured charges, fluids, consumables. concept_aliases table for cross-shop learning. | ✅ | `KEEP VERTICAL` — auto-specific use case |
| `modules/IgnitionCipher.jsx` | DTC code lookup with AI explanation | ✅ | `KEEP VERTICAL` — auto-specific |
| `modules/IgnitionCompliance.jsx` | 24-point DOT safety inspection form | ✅ | `KEEP VERTICAL` — auto regulatory |
| `modules/IgnitionCRM.jsx` | Customer directory — Fleet/Friends & Family/Standard tiers, search | ✅ | `EXTRACT PATTERN` → `shared/src/components/CustomerDirectory.tsx`. Cultivar OS and every other vertical need a customer list with search. |
| `modules/IgnitionEstimate.jsx` | Service writer estimate review station — reads jobs, triggers Railway AI agent, shows editable line items, sends to customer | ✅ | `KEEP VERTICAL` — auto-specific orchestration |
| `modules/IgnitionEval.jsx` | Tech evaluation station — Zone 2. Creates evaluations, DTC codes, eval_photos, labor_entries in Supabase. | ✅ | `KEEP VERTICAL` — auto workflow step |
| `modules/IgnitionFlux.jsx` | Job queue/workflow management — status state machine, job cards | ✅ | `EXTRACT PATTERN` → `shared/src/components/WorkQueue.tsx`. Every service vertical needs a queue view. Conduit OS: job queue. KINNA-OS: intake queue. |
| `modules/IgnitionHandover.jsx` | Job suspension protocol modal — safety flags, status notes | ✅ | `KEEP VERTICAL` — auto-specific |
| `modules/IgnitionHub.jsx` | Live dispatch/logistics map — fleet positions, job assignments | ✅ | `KEEP VERTICAL` — auto-specific |
| `modules/IgnitionIntake.jsx` | Customer + vehicle + job intake form — 3-phase commit | ✅ | `KEEP VERTICAL` — auto-specific |
| `modules/IgnitionInvoice.jsx` | Invoice creation UI | ✅ | `KEEP VERTICAL` |
| `modules/IgnitionKosk.jsx` | Tech kiosk — high-contrast shop-floor UI with voice, barcode, clock-in | ✅ | `EXTRACT PATTERN` → `shared/src/components/KioskMode.tsx`. Any vertical with floor staff needs a simplified touch UI. |
| `modules/IgnitionOmni.jsx` | OMNI overview — shop-wide metrics, leakage demo data | ✅ | `EXTRACT PATTERN` — generalize as vertical dashboard metrics view |
| `modules/IgnitionOmniDashboard.jsx` | OMNI mission control — detailed telemetry, 14-day savings report, SavingsReport component | ✅ | `EXTRACT PATTERN` → the owner mission control pattern is universal. Build `shared/src/components/OwnerDashboard.tsx`. |
| `modules/IgnitionPort.jsx` | Customer portal — estimate viewing + digital signature | ✅ | `EXTRACT PATTERN` → `shared/src/components/CustomerPortal.tsx`. Cultivar: customer views order summary. Conduit: customer views repair quote. |
| `modules/IgnitionProc.jsx` | Parts procurement + vendor directory | ✅ | `KEEP VERTICAL` — auto-specific |
| `modules/IgnitionProcure.jsx` | Procurement input form with margin enforcement via MarginEngine | ✅ | `KEEP VERTICAL` — auto-specific |
| `modules/IgnitionProt.jsx` | Financial settings — margin slabs, labor rates, overhead | ✅ | `EXTRACT PATTERN` → `shared/src/settings/PricingSettings.tsx`. Any vertical with margin enforcement needs this UI. |
| `modules/IgnitionStok.jsx` | Inventory management — DTC-linked, bin locations | ✅ | `EXTRACT PATTERN` → `shared/src/components/Inventory.tsx`. Every vertical needs inventory tracking. Auto has parts; Cultivar has plants/supplies; Conduit has materials. |
| `modules/IgnitionTools.jsx` | Tool tracking + PMI schedules (overdue/due-soon/ok badges) | ✅ | `EXTRACT PATTERN` → `shared/src/components/AssetPMI.tsx`. PMI on physical assets (tools, equipment, vehicles) is universal. |
| `modules/PredictiveKey.jsx` | AI-powered predictive PMI — inspection logs, AI schedule via Claude Haiku, ROI tracking | ✅ | `KEEP VERTICAL` for now — auto-specific asset types; extract AI PMI pattern later |
| `modules/SlideToComplete.jsx` | Slide-to-confirm gesture widget for critical task confirmation | ✅ | `EXTRACT` → `shared/src/components/SlideToComplete.tsx`. Universal high-consequence confirmation UX. |

### Ignition OS Modules — Mobile (React Native) with WRONG EXTENSION

These 9 files have `.jsx` extension but are React Native. They should be renamed `.native.js`. Their web equivalents either already exist as separate `.jsx` files (without Native imports) or need to be built.

| File | Platform Header Says | Rename To |
|---|---|---|
| `modules/CustomerEstimate.jsx` | Mobile (React Native) | `CustomerEstimate.native.js` |
| `modules/IgnitionVIN.jsx` | Mobile (React Native) | `IgnitionVIN.native.js` |
| `modules/IgnitionQueue.jsx` | Mobile (React Native) | `IgnitionQueue.native.js` |
| `modules/IgnitionVoice.jsx` | Mobile (React Native) | `IgnitionVoice.native.js` |
| `modules/IgnitionVendor.jsx` | Mobile (React Native) | `IgnitionVendor.native.js` |
| `modules/InventoryAI.jsx` | Mobile (React Native) | `InventoryAI.native.js` |
| `modules/PartsList.jsx` | Mobile (React Native) | `PartsList.native.js` |
| `modules/ToolChecklist.jsx` | Mobile (React Native) | `ToolChecklist.native.js` |
| `modules/TriageOptimizer.jsx` | Mobile (React Native) | `TriageOptimizer.native.js` |

---

## Part 5: CAI/ files NOT yet in packages/

These are in CAI/ (read-only reference) but have no equivalent in trace-platform/packages/. They need to be ported before the features that depend on them can be built.

| CAI File | Purpose | Needed By | Priority |
|---|---|---|---|
| `ai_router.py` | FastAPI AI backend — 13 endpoints across Claude, Gemini, OpenAI | Ignition OS web build (all AI features) | HIGH — before any Ignition OS AI feature |
| `shop_estimate.py` | Railway FastAPI app entry point — mounts ai_router | Ignition OS web build | HIGH — deploy target for ai_router.py |
| `monitor.py` | Process monitor | Railway deployment | MEDIUM |
| `modules/TechKeypad.jsx` | PIN keypad web version (NOT the native one in shared) | Ignition web build — tech login | HIGH |
| `docs/pricing_sheet.html` | Official printable pricing doc | Reference only | Already catalogued |
| `docs/conduit_os_expansion.html` | Conduit OS feature expansion plan | Pre-Conduit build session | MEDIUM |
| `docs/security_architecture.html` | Security architecture doc | Audit/compliance | MEDIUM |
| `supabase.js` | Supabase client for CAI context | Already replaced by packages/shared | IGNORE |

---

## Summary Tables

### Delete Now (No Risk)

| File | Reason |
|---|---|
| `packages/shared/src/ai/ai_router.py` | Python file in TS package, never compiled |
| `packages/shared/src/components/TechKeypad.jsx` | React Native in web package, already in ignition-os |
| `packages/cultivar-os/src/lib/shared/quickbooks/invoice.ts` | Exact duplicate of packages/shared |
| `packages/cultivar-os/src/lib/shared/quickbooks/oauth.ts` | Exact duplicate of packages/shared |
| `packages/cultivar-os/src/lib/shared/supabase/auth.ts` | Exact duplicate of packages/shared |
| `packages/cultivar-os/api/main.py` | Dead code — Railway backend superseded |
| `packages/cultivar-os/api/routers/orders.py` | Dead code — Railway backend superseded |
| `packages/cultivar-os/api/routers/quickbooks.py` | Dead code — Railway backend superseded |

### Rename (Extension Fix)

All 9 mobile-only `.jsx` files in `packages/ignition-os/modules/` → rename to `.native.js`:
`CustomerEstimate · IgnitionVIN · IgnitionQueue · IgnitionVoice · IgnitionVendor · InventoryAI · PartsList · ToolChecklist · TriageOptimizer`

### Extract to shared/ (Before Conduit OS)

Ordered by impact across verticals:

| Priority | What to Extract | From | To |
|---|---|---|---|
| 1 | `NurseryProvider.tsx` → `TenantProvider` | cultivar-os | `shared/src/context/TenantProvider.tsx` |
| 2 | `useModules.ts` | cultivar-os | `shared/src/hooks/useModules.ts` |
| 3 | `OnboardingWizard` shell | ignition-os | `shared/src/onboarding/WizardShell.tsx` |
| 4 | `MarginEngine.js` | ignition-os | `shared/src/pricing/marginEngine.ts` (replace stub) |
| 5 | `CoreApp` subscription gate + blur | ignition-os | `shared/src/billing/AppShell.tsx` |
| 6 | `IgnitionFlux` → WorkQueue | ignition-os | `shared/src/components/WorkQueue.tsx` |
| 7 | `PlantTimeline` → AssetTimeline | cultivar-os | `shared/src/components/AssetTimeline.tsx` |
| 8 | `IgnitionCRM` → CustomerDirectory | ignition-os | `shared/src/components/CustomerDirectory.tsx` |
| 9 | `CustomerApprovalPortal` | ignition-os | `shared/src/components/CustomerApprovalPortal.tsx` |
| 10 | `IgnitionPort` → CustomerPortal | ignition-os | `shared/src/components/CustomerPortal.tsx` |
| 11 | `SlideToComplete` | ignition-os | `shared/src/components/SlideToComplete.tsx` |
| 12 | `ErrorBoundary` | ignition-os | `shared/src/components/ErrorBoundary.tsx` |
| 13 | `QtySelector` | cultivar-os | `shared/src/components/forms/QtySelector.tsx` |
| 14 | `PriceField` | ignition-os | `shared/src/components/forms/PriceField.tsx` |
| 15 | `IgnitionAdmin` shell | ignition-os | `shared/src/settings/AdminShell.tsx` |
| 16 | `AdminSubscription` marketplace | ignition-os | `shared/src/billing/ModuleMarketplace.tsx` |
| 17 | `IgnitionProt` pricing settings | ignition-os | `shared/src/settings/PricingSettings.tsx` |
| 18 | `IgnitionStok` → Inventory | ignition-os | `shared/src/components/Inventory.tsx` |
| 19 | `IgnitionTools` → AssetPMI | ignition-os | `shared/src/components/AssetPMI.tsx` |
| 20 | `CSVImporter` | ignition-os | `shared/src/data/CSVImporter.tsx` |
| 21 | Customer type | cultivar-os | `shared/src/supabase/types.ts` |
| 22 | Order base type | cultivar-os | `shared/src/supabase/types.ts` |
| 23 | Dashboard metrics API pattern | cultivar-os api | `shared/src/api/dashboardTemplate.ts` |

### Fix Before Second Vertical

| Issue | File | Fix |
|---|---|---|
| IGNITION_OS_DATA hardcoded as localStorage key | `shared/src/quickbooks/oauth.ts` | Make STORAGE_KEY a parameter or env var |
| `marginEngine.ts` is a stub | `shared/src/pricing/marginEngine.ts` | Port `ignition-os/MarginEngine.js` to TypeScript |
| Duplicate `PrivateRoute` | `cultivar-os/src/components/layout/PrivateRoute.tsx` | Verify callers use configureAuth version, then delete |
| Duplicate `useAuth.ts` | `cultivar-os/src/hooks/useAuth.ts` | Verify if wrapping or duplicating. Delete if duplicating. |
| Duplicate `lib/supabase.ts` | `cultivar-os/src/lib/supabase.ts` | Verify callers, replace with `@trace/shared/supabase/client`, delete |

---

*TRACE Enterprises · Codebase Audit · 2026-05-28*
*Source: file-by-file inspection of packages/shared/src, packages/cultivar-os, packages/ignition-os, and CAI/ cross-reference*
