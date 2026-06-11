# TRACE Built Inventory
# Flat catalog of every major capability built across all TRACE repos
# Read this before starting any build session — the thing you're about to build may already exist
# Last updated: 2026-06-05

**Purpose:** Sessions keep rebuilding things that exist. This document is the single answer to "was X ever built?" Organized by capability, not by file. For file locations, see PLATFORM_AUDIT.md.

> **Audit reconciliation (2026-06-05):** Three stale bootstrap beliefs corrected. (1) AI Engine is already shared, NOT trapped in Ignition — promote already happened; what remains is unifying a split-brain. (2) RBAC is split — identity/invites shared; enforcement still Ignition-side and duplicated. (3) DataBridge footprint confirmed (~45 files, load-bearing) but characterization disputed: this doc says "localStorage-first, intentionally not shared," bootstrap says "offline-sync engine, promote" — unresolved, see NEEDS DAVID'S CALL.
>
> **File-type reality:** Ignition (`packages/ignition-os/`) is entirely `.jsx`/`.js`, ZERO `.ts`. Shared is `.ts`. Audit Ignition with `--include=*.jsx --include=*.js`, never `.ts`. Ignition's `src/` is empty; code lives at package root + `modules/`.

**Column guide:**
- **Vertical** — `ignition` | `cultivar` | `shared` (`shared` = promoted to the platform shared layer; it's a location, not a vertical)
- **Type** — `tile` (customer-facing dashboard tile/module) | `infrastructure` (plumbing: auth, QR, Supabase types, adapters) | `capability` (backend/feature that isn't a tile and isn't pure plumbing)
- Reading the table: `Vertical:shared` = platform baseline. `Vertical:shared AND Type:tile` = every vertical inherits these tiles for free. See "NEEDS DAVID'S CALL" section at bottom for ambiguous entries.

---

## AI Engine

**What:** Unified multi-provider AI router. Single interface for all AI tasks across all verticals.  
**Status:** ✅ Built — TypeScript  
**Vertical:** shared | **Type:** capability  
**Location:** `packages/shared/src/ai/AIEngine.ts`  
**Original source:** `CAI/AIEngine.js` (archive — do not edit)  
**Backend:** `CAI/ai_router.py` (FastAPI, Railway) — **LEGACY for web builds.** AIEngine.call() fails gracefully (`{ ok: false }`) when no backend is reachable. Port to Vercel serverless functions when activating AI features. See Tech Debt #12 in CLAUDE.md.  
**Import:** `import AIEngine from '@trace/shared/ai/AIEngine'`

**13 tasks:**

| Task | Provider | What it does |
|---|---|---|
| `vin_decode` | Gemini 2.0 Flash | Photo → vehicle info |
| `invoice_scan` | Gemini 2.0 Flash | Photo → line items |
| `label_read` | Gemini 2.0 Flash | Tool/fluid label → spec |
| `part_photo_id` | Gemini 2.0 Flash | Part photo → ID + compatibility |
| `invoice_audit` | Claude Sonnet 4.6 | Invoice → uncaptured charges flagged |
| `dtc_decode` | Claude Sonnet 4.6 | DTC codes → plain-language diagnosis |
| `estimate_draft` | Claude Sonnet 4.6 | Job description → draft estimate |
| `compliance_check` | Claude Sonnet 4.6 | Document → DOT/regulatory flags |
| `customer_summary` | Claude Sonnet 4.6 | History array → relationship summary |
| `pmi_suggest` | Claude Sonnet 4.6 | Equipment data → maintenance schedule |
| `predictive_analysis` | Claude Sonnet 4.6 | Job history → risk patterns |
| `savings_report` | Claude Sonnet 4.6 | Shop history → margin recovery report |
| `voice_transcribe` | OpenAI Whisper | Audio → transcript |
| `parts_nlp` | OpenAI GPT-4o | Free-text parts → structured list |
| `intent_classify` | OpenAI GPT-4o | Customer message → intent category |

**Tier gating:**
- TRIAL: all tasks
- STARTER: none (no-AI tier)
- PROFESSIONAL: 12 tasks
- PREMIER: all tasks

`AIEngine.canUse(task, tier)` → boolean. Call before running any task.

**Convenience wrappers:** `decodeVIN`, `decodeDTC`, `transcribeVoice`, `extractParts`, `readToolLabel`, `suggestPMI`, `auditInvoice`, `draftEstimate`, `savingsReport`

**Haiku fallback:** Pass `options.fallback = true` to retry failed Sonnet calls with Haiku.

**Not yet built:** `SavingsReport.jsx` — React display component for `savings_report` output. API is complete; only display work remains.

**✅ Split-brain resolved (2026-06-05):** The four server-side files (`shared/campaigns/generate.ts`, `shared/discovery/engine.ts`, `shared/discovery/synthesis.ts`, `cultivar-os/api/social/generate-posts.ts`) now route through `packages/shared/src/ai/execute.ts` → `CAPABILITIES` registry → Anthropic SDK directly on Vercel (no Railway). This is the new shared AI gateway — separate from AIEngine.ts, which remains the Ignition-specific router for Railway-backed tasks. AIEngine.ts Ignition consumers (`IgnitionAudit.jsx`, `IgnitionCipher.jsx`, `PredictiveKey.jsx`) are unchanged. See `packages/shared/src/ai/` for gateway implementation.

**⚠️ AIEngine is DARK in Ignition production (Audit 2, 2026-06-06):** `VITE_API_URL` is NOT set in the ignition-os Vercel project. Every `AIEngine.call()` in Ignition OS web production returns `{ ok: false }`. Railway is still running but receives zero traffic from the web build. No Ignition AI feature has ever produced real output for a web user. See Tech Debt #12 (expanded) + `docs/audits/2026-06-06-audits-1-4.md` §2a.

**⚠️ `invoice_scan` has ZERO callers (Audit 2, 2026-06-06):** The `invoice_scan` task in the AIEngine routing table is orphaned — no component, hook, or API handler invokes it anywhere. It was never wired. **Do not confuse with `invoice_audit`:** that IS built (two-stage Gemini→Claude on Railway), a leakage tool that reads OUTGOING invoices to flag uncaptured charges. `invoice_scan` → retire. `invoice_audit` → keep in scope for future Ignition (port to Vercel when Railway is killed). See `docs/audits/2026-06-06-audits-1-4.md` §2b.

**⚠️ VIN OCR is a placeholder (Audit 2, 2026-06-06):** The VIN decode feature resolves to `alert('OCR Scanning initializing...')`. No Gemini vision call is ever made. The Gemini vision pipeline has never been proven end-to-end on Vercel — Receipt Keeper v1 will be the first confirmed live Vercel vision pipeline. See `docs/audits/2026-06-06-audits-1-4.md` §2c.

---

## FastAPI AI Backend (ai_router.py) — LEGACY

**What:** FastAPI router that handles all actual AI provider API calls.  
**Status:** ⚠️ Legacy — built for the React Native mobile app where API keys couldn't live in the bundle. Now that Ignition OS is a Vercel web app, keys live in Vercel env vars and functions handle them server-side. Railway is not needed.  
**Vertical:** ignition | **Type:** infrastructure  
**Location:** `CAI/ai_router.py` (archive)  
**Forward path:** Port the 11 endpoints to TypeScript Vercel functions under `packages/ignition-os/api/`. Start with `dtc_decode` and `estimate_draft` (text-only, no vision complexity). See Tech Debt #12 in CLAUDE.md.  
**Exception:** `voice_transcribe` sends audio files — Vercel's 4.5MB payload limit needs evaluation before porting.

**Endpoints:**
- Gemini: `POST /ai/vin_decode`, `/ai/invoice_scan`, `/ai/label_read`, `/ai/part_photo_id`
- Claude: `POST /ai/dtc_decode`, `/ai/estimate_draft`, `/ai/pmi_suggest`, `/ai/invoice_audit`, `/ai/savings_report`
- OpenAI: `POST /ai/voice_transcribe`, `/ai/parts_nlp`, `/ai/intent_classify`

**Cost tracking:** `_log_usage()` writes to `ai_usage` table (includes `cost_usd` per call).  
**Error tracking:** `_log_error()` writes to `error_events` table. Non-fatal — calls never block.

---

## Receipt / Expense Storage

**What:** Tables and storage for vendor receipt capture (`receipts`), structured expense records (`expenses`), and owner-declared allocation inputs for cost calculations (`cost_profile`).
**Status:** ❌ NOT BUILT — confirmed Audit 3, 2026-06-06.
**Vertical:** shared | **Type:** infrastructure

**What exists:** One Supabase storage bucket — `eval-photos` (used by Ignition `invoice_audit` for image uploads — NOT a receipt archive). No `receipts`, `expenses`, or `cost_profile` tables exist anywhere in the codebase or in any migration file.

**Proposed AC-clean schema** (proposal only — no migration written; confirm with Cost-to-Produce tile spec before building):
- `receipts (id, business_id, image_url, vendor, amount, category, line_items jsonb, captured_at, owner_confirmed bool)` — one row per captured vendor receipt; image stored in a `receipts` Supabase bucket (separate from `eval-photos`)
- `expenses (id, business_id, receipt_id, source CHECK IN ('receipt','bank_csv','manual'), amount, category, occurred_at)` — structured expense records from all sources
- `cost_profile (id, business_id, home_office_pct, business_time_pct, labor_rate, fixed_overheads jsonb, asset_amortization jsonb)` — owner-declared allocation inputs (intake interview answers)

All tables anchor to `business_id` — AC-1 ✅, AC-2 via `business_id`-scoped RLS ✅.

**Build path:** Receipt Keeper v1 (local-only) creates `receipts` + Supabase `receipts` bucket. Receipt Keeper v2 + Cost-to-Produce adds `expenses` + `cost_profile`. See `docs/audits/2026-06-06-audits-1-4.md` §3.

⚠️ **PENDING REQUIREMENTS — must implement when consent surface / data-entry activation widget is built:**

**REQ-1 — WIDGET CONSENT-TO-USE (REQUIRED):**
When a customer activates the Receipt Keeper data-entry widget (e.g. opens the file picker / initiates data entry), the widget MUST present an upfront consent-to-use surface BEFORE data entry proceeds — consent to use the tool and how their data is handled. This must appear at the moment of activation, not buried in a settings page or terms link. Do NOT build the activation step without this surface.
Code anchor: `// FLAG: REQ-1` in `packages/cultivar-os/src/pages/ReceiptKeeper.tsx` at the idle step entry point.

**REQ-2 — HANDWRITTEN-RECEIPT KNOWN-LIMITATION DISCLOSURE (REQUIRED):**
That same upfront consent surface MUST state clearly that HANDWRITTEN receipts are a known issue and must be carefully inspected by the user before saving — handwriting capture is unreliable. Do not suppress or minimize this limitation.
Evidence (2026-06-11): a handwritten Schrock's A/C invoice read all line items as $0.00, missed the $395 handwritten total, missed a "pd Venmo" payment annotation, and fell to the Claude Haiku fallback. Printed receipts read cleanly. This is not an edge case — it is a known failure mode.
Code anchor: `// FLAG: REQ-2` in `packages/cultivar-os/src/pages/ReceiptKeeper.tsx` at the idle step entry point.

**Framing discipline:** These are CAPTURE/DISCLOSURE requirements — state the limitation and require human inspection. Do NOT add business advice about how to handle receipts or what to do about the limitation. Consistent with TRACE's capture-not-rule line and the Surface Honesty principle.

---

## Margin Engine (Shared)

**What:** Shared margin calculation engine — 4-slab markup, tier discounts, overhead-per-unit wire, leakage detection.
**Status:** ✅ BUILT — 2026-06-10 (THUNDER · Build 1). Replaces 17-line dead stub.
**Vertical:** shared | **Type:** capability
**Location:** `packages/shared/src/business-logic/MarginEngine.ts` (canonical)
**Barrel:** `packages/shared/src/business-logic/index.ts`

**What the engine has:**
- 4-slab table (Consumables/Mid-Range/Heavy/Major) — matches `MarginEngine.js` (A) exactly
- Tier discounts by name string (AC-1: FLEET/LEGACY/FF are config DATA, not TS identifiers)
- `overheadPerUnit` field wired into loaded cost before slab selection — TD#16 overhead slot
- Charm rounding: `Math.ceil(retail) - 0.01` (matches A; stub used broken `Math.floor+0.99`)
- `analyzeTransaction()` — leakage detection, profit margin %
- Pure functions, no DataBridge, no Supabase, no vertical imports

**Unit check (acceptance criteria):**
- `cost=$6, STANDARD, overheadPerUnit=0` → $23.99 ✓ (matches A)
- `cost=$6, STANDARD, overheadPerUnit=$2` → loaded=$8, $31.99 ✓ (overhead wired)

**Deprecated implementations (all marked 🔴, not deleted):**
- A: `packages/ignition-os/MarginEngine.js` — source of canonical slab logic; marked deprecated; callers migrate import path
- B: `packages/shared/src/pricing/marginEngine.ts` — dead 17-line stub with broken rounding; zero live callers; delete after migrating barrel export
- C: `DataBridge.getActiveMargin()` / `.calculateRetail()` — prot_matrix percent model (DIFFERENT pricing); callers will see price change at migration (accepted)
- D: `IgnitionEstimate.jsx` `markup_percent` — flat percent fallback
- E: `IgnitionOmni.jsx` `shops.margin_config` — display-only storage, not a pricing calc

**Overhead wire status:** Slot built. Source = `DataBridge.overhead_config.monthly` (rent + electric + fuel + insurance + maintenance). Caller must compute `sum(monthly) / avg_monthly_part_count` and write to engine config. Wiring UI (IgnitionProt → DataBridge `margin_config.overheadPerUnit`) is the first step of the Cost-to-Produce tile session.

**Migration checklist:** `docs/audits/margin-engine-migration-checklist-2026-06-10.md` — full caller map, ordered by risk, price-change warnings for C callers.

---

## Subscription Tiers + Pricing

**What:** Pricing tiers and module matrix defining what's included at each tier.  
**Status:** ✅ Documented — `CAI/docs/pricing_sheet.html` (printable, authoritative)  
**Vertical:** ignition | **Type:** infrastructure  
*⚠️ NEEDS DAVID'S CALL — see bottom: pricing tiers are currently Ignition-specific from CAI; whether they apply platform-wide or each vertical has its own tier structure is unresolved.*

| Tier | Price | Users | AI |
|---|---|---|---|
| STARTER | $149/mo | 3 | None |
| PROFESSIONAL | $299/mo | 8 | AI Bundle (12 tasks) |
| PREMIER | $499/mo | Unlimited | Full AI (13 tasks) |
| Trial | Free, 14 days | Unlimited | Full PREMIER access |

**Add-ons:**
- Extra Location: +$99/mo
- 5-User Block: +$49/mo
- SMS: +$29/mo
- API Access: +$99/mo

**Module matrix (PROFESSIONAL tier includes):**
VIN Decode, Scribe AI, DTC Cipher, Parts & Manifest, Procurement, Stock AI, CRM, OMNI Summary

**PREMIER adds:**
Full OMNI, HUB Dispatch, DOT Compliance, Tools+PMI, Predictive Maintenance, Multi-Location, White-Label Portal

**Trial:** 14 days full PREMIER, no card required, hardware kit included.

---

## AdminSubscription / Marketplace UI

**What:** Owner-facing module marketplace. Shows all modules, trial status, pricing. Admin can start trials, see days remaining, configure umbrella subscription price.  
**Status:** ✅ Built (JSX, Ignition OS only — not yet in shared or Cultivar)  
**Vertical:** ignition | **Type:** capability  
*⚠️ NEEDS DAVID'S CALL — see bottom: could be tile (if it appears as a dashboard tile in OmniDashboard) or capability (if it's reached via settings/admin nav).*  
**Location:** `packages/ignition-os/modules/AdminSubscription.jsx`  
**Default umbrella price:** $299/mo (state variable, admin-adjustable in UI)

**Module keys and display names:**
- `FLUX` → Workflow
- `PREDICTIVE` → Predict
- `ESTIMATOR` → Estimator
- `CODE` → DTC Cipher
- `STOK` → Inventory
- `PROT` → Margins
- `HUB` → Dispatch
- `PROC` → Vendors

**Per-module state shape:**
```js
{ active: boolean, tier: 'NONE'|'BASIC'|'PRO', trialActive: boolean, trialStartedAt: ISOString|null }
```

**startTrial():** Sets `active=true`, `tier='PRO'`, `trialActive=true`, `trialStartedAt=now`  
**calculateDaysLeft():** `Math.max(0, 30 - daysSinceStart)` — 30-day module trial window

---

## Trial Clock

**What:** Two-tier trial system — 14-day platform trial and 30-day per-module trial.  
**Status:** ✅ Built (Ignition OS only — not yet extracted to shared or used in Cultivar)  
**Vertical:** ignition | **Type:** infrastructure  

**Two distinct trial concepts:**

1. **Platform trial (14-day):** Full PREMIER access. Set in `OnboardingWizard.finalize()`. Stored in Supabase `shops` table as `trial_started_at` / `trial_ends_at`. After expiry: data blur on all modules.

2. **Per-module trial (30-day):** Each module independently. `calculateDaysLeft()` in `AdminSubscription.jsx`. Stored in `DataBridge` as `modules[MODULE_ID].trialStartedAt`.

**Data blur on expiry:** `filter blur-md pointer-events-none opacity-30` wrapper around module content. Ignition only. Not yet extracted to shared or used in Cultivar.

**Shared type:** `SubscriptionTier` in `packages/shared/src/supabase/types.ts` has `trial_started_at` field — the seam where this plugs in.

---

## DataBridge

**What:** localStorage-first data layer for Ignition OS. Single key `IGNITION_OS_DATA` stores all shop state: profiles, jobs, modules, trial clocks, integrations.  
**Status:** ✅ Built (JavaScript, Ignition OS only — intentionally not shared)  
**Vertical:** ignition | **Type:** infrastructure  
**Location:** `packages/ignition-os/DataBridge.js`

**Key methods:**
- `DataBridge.save(key, value)` — persist to localStorage
- `DataBridge.getProfiles()` — list of shop user profiles
- `DataBridge.checkTrialStatus(moduleId)` — returns `{ isExpired }`
- `DataBridge.get('shop_info')` — shop name, phone, USDOT, etc.
- `DataBridge.get('shop_policy')` — active modules, margin rules, tier

**Important:** `STORAGE_KEY = 'IGNITION_OS_DATA'` is hardcoded in `packages/shared/src/quickbooks/oauth.ts`. This is Tech Debt #2 in CLAUDE.md — OFF LIMITS until post-demo fix.

**Footprint (audit 2026-06-05):** ~45 files reference DataBridge across nearly every Ignition module (`DataBridge.js`, `CoreApp.jsx`, `IgnitionAdmin.jsx`, `IgnitionOmni.jsx`, `IgnitionCRM.jsx`, and many more). Load-bearing. No shared equivalent.

**⚠️ CHARACTERIZATION CONFLICT (unresolved):** This doc says "localStorage-first wrapper, intentionally not shared." The bootstrap spec says "offline-sync engine, promote to shared." These are opposite post-demo jobs. Footprint (~45 files) is confirmed. Function and promote decision are not. A ~30-line read of `DataBridge.js` settles the function question; the promote question is David's. Do not open DataBridge for RBAC extraction or any shared promotion until this is resolved. → **NEEDS DAVID'S CALL.**

---

## Tile System

**What:** 3-state tile grid for module navigation. States: active (works), available (can enable), locked (upgrade required). Supports count badge for notifications.  
**Status:** ✅ Built and live — TypeScript/React  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/components/tiles/TileGrid.tsx` + `Tile.tsx`  
**Used by:** Cultivar OS Dashboard.tsx, Ignition OS AdminSubscription.jsx

**Tile states:**
- `active` — module is enabled and configured. Green dot. onClick routes to module (currently a stub).
- `available` — module can be enabled. Shows "Enable" button. onClick triggers setup flow.
- `locked` — requires tier upgrade. `onClick={undefined}`. LockedOverlay visible.

**Count badge:** `count` prop on Tile. Amber badge top-left. Used by Social Media tile to show pending draft count.

---

## configureAuth Factory

**What:** Vertical-agnostic auth factory. Returns `useSession` hook + `PrivateRoute` + `AuthProvider` configured for either email/password (Cultivar) or PIN/localStorage (Ignition).  
**Status:** ✅ Built — TypeScript  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/auth/configureAuth.tsx`

**Email strategy (Cultivar OS):** Supabase email/password. `auth.uid()` is non-null. Required for RLS to work.  
**PIN strategy (Ignition OS):** localStorage-first. `auth.uid()` is always null. **Do not use in any multi-tenant context.**

---

## Multi-Tenant Auth System (Shared)

**What:** Full invite-based team management for any vertical. Owner invites members by email; member receives a `/join?token=...` link, creates a Supabase account, and is linked to the owner's business.  
**Status:** ✅ Built — TypeScript (merged to main 2026-06-03)  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/auth/`

**Schema (cultivar-os Supabase project — bgobkjcopcxusjsetfob):**
- `business_members` — links `auth.uid()` to a `businesses.id`. Columns: `role`, `permissions` (text[]), `active`, `pin_hash` (added 2026-06-03). RLS: owner full access, member reads own row.
- `invitations` — pending invite tokens. 7-day expiry. `used` flag prevents replay. RLS: owner full access.
- `member_devices` — optional device tracking (denormalized `business_id` for RLS without join).
- **Migration pending (David):** `supabase/migrations/20260603_business_members_add_pin_hash.sql` adds `pin_hash` to business_members in bgobkjcopcxusjsetfob.

**Shared TypeScript modules:**
- `auth/types.ts` — `Member`, `Invitation`, `Role`, `VerticalAdapter`, `AcceptInviteResult`, `InvitePreview`
- `auth/members.ts` — `getMembersByBusiness`, `updateMemberRole`, `removeMember`, `checkPermission(permissions[], name)`
- `auth/invitations.ts` — `createInvitation`, `revokeInvitation`, `getPendingInvitations`, `expireInvitations`
- `auth/acceptInvitation.ts` — `previewInvitation`, `acceptInvitation` (service-key server functions)
- `auth/AcceptInvite.tsx` — React accept-invite page component (inline styles, TRACE green)
- `auth/OwnerSignup.tsx` — Multi-step signup with PIN: Owner Info → PIN Setup → Biometric (optional) → vertical steps. Config-driven. Added 2026-06-03. Updated 2026-06-04: `backgroundColor`, `cardColor`, `examples` fields added to config (removes hardcoded Cultivar sage/white; enables Ignition dark theme).
- `auth/permissions.ts` — Pure permission check helpers (added 2026-06-10, THUNDER · BUILD 2):
  - `can(session, permId)` — null-safe check for a permission string in session.permissions[]
  - `hasRole(session, roleName)` — null-safe session.role equality check
  - `canAccessModule(allowed, moduleKey)` — checks the Ignition-specific `allowed[]` shortlist (derived from view_* permissions by auth.ts authenticate())
  - `expandRoles(policy, roleNames)` — expands role-badge strings → flat union of permission strings; replaces the DataBridge.getSystemRoles() + flatMap pattern in CoreApp.jsx
  - `deriveAllowed(permissions)` — strips 'view_' prefix; matches the derivation in auth.ts and CoreApp.jsx JoinFlow
  - `PermissionPolicy` interface — vertical passes `{ roles: Record<string, string[]> }` as config data (AC-1: role names are string values, not TypeScript identifiers)
  - These are drop-in replacements for inline checks; callers NOT migrated yet (Ignition migration deferred to post-pilot_all fix, TD#28)
- `discovery/DiscoveryGlimpse.tsx` — Client-only React component (VerticalStep). Loads website from businesses table, fires /api/discovery/ingest, shows seed insights while live analysis runs. Import directly (not from barrel) to avoid bundling server-side SDK deps. Added 2026-06-04.
- `auth/index.ts` — barrel export
- `supabase/auth.ts` — `hashPin()`, `authenticate()` (queries shop_members, returns AuthSession with role/permissions/allowed), `authenticateMember()` (queries business_members, returns MemberSession), `getMemberSession()`, `clearMemberSession()`, `getTrialStatus()`.

**Cultivar OS integration:**
- `api/members/preview-invite.ts` / `accept-invite.ts` — Vercel handlers (consolidated into `/api/members/invite` as GET+POST)
- `src/pages/Settings.tsx` TeamSection — invite form, member list, pending invitations, copy-link UI
- `src/router.tsx` — public `/join` route → `AcceptInvite` component
- `src/auth/roles.ts` — OWNER / MANAGER / STAFF role definitions with permission arrays

**Permission model — Cultivar OS (business_members table):**
- `null` permissions = owner (full access implied). `string[]` = member's explicit DB-stored permissions.
- Gate expression: `const canX = isOwner || (userPermissions ?? []).includes('permission_key')`
- MANAGER excludes `manage_settings` by design — cannot reach Settings page

**Permission model — Ignition OS (shop_members table, PILOT phase):**
- Roles: TECH / SERVICE / ADMIN (canonical, from shop_members); SUB_ROLES: SR_TECH/BAY_TECH/APPRENTICE (TECH), ADVISOR/CASHIER (SERVICE)
- `allowed[]` = permissions filtered to view_* → strip prefix. Gate: `session.allowed.includes('flux')` etc.
- Role presets defined in `IgnitionAdmin.jsx:ROLE_PRESETS` (TECH/SERVICE/ADMIN → capability string arrays)
- `DataBridge.getSystemRoles()` uses OLD role-badge format (ADMIN/TECH/CUSTOMER); JoinFlow members use NEW capability-string format — these two formats are incompatible in the `userCapabilities` expansion path
- ⚠️ All enforcement is CLIENT-SIDE ONLY — see Tech Debt #28 (pilot_all wide-open RLS)

**Test coverage:** `scripts/test-member-login.mjs` — 8 sections, 29 assertions against live DB. Verified: owner path, member path, MANAGER permission exclusions, LAWNS-specific invite flow.

---

## BusinessProvider (Shared Context)

**What:** React context that resolves the logged-in user's business and exposes it across the app. Two-path resolution: owner fast-path, member fallback.  
**Status:** ✅ Built — TypeScript  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/context/BusinessProvider.tsx`  
**Exports:** `BusinessProvider`, `useBusinessContext`, `Business`, `BusinessContextValue` (from `packages/shared/src/context/index.ts`)

**Resolution logic:**
1. Owner path (fast): `businesses WHERE owner_id = auth.uid() AND business_type = $type`
2. Member fallback (if owner returns null): `business_members WHERE user_id = auth.uid() AND active = true` with `businesses(*)` PostgREST join, filtered post-fetch to `business_type === businessType`

**Context values:**
- `business: Business | null` — full businesses row
- `businessId: string | null`
- `businessError: string | null` — `'no_business'` when neither path resolves
- `loading: boolean`
- `reload: () => void`
- `userPermissions: string[] | null` — null = owner, string[] = member's DB-stored permissions
- `isOwner: boolean`

**Consumed by:** `packages/cultivar-os/src/App.tsx` (`<BusinessProvider businessType="nursery">`), all Cultivar pages via `useBusinessContext()`.

**Security note (fixed 2026-06-04, commit 8792c71):** Member path filters by `business_type` after fetching — `memberBiz?.business_type === businessType` must match before the member resolution is accepted. This prevents cross-vertical data exposure (audit finding #13). If a user is a member of multiple businesses in the same vertical, `.single()` will fail — acceptable for v1.

---

## QB Token Refresh

**What:** Proactive QuickBooks token refresh. Checks expiry before any invoice call. Refreshes if missing or within 10 min of expiry. Sets `qb_needs_reconnect=true` and returns null if refresh token is dead.  
**Status:** ✅ Built — TypeScript  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/quickbooks/refresh.ts`  
**Used by:** `packages/cultivar-os/api/qbo/invoice/cultivar.ts`

**⚠️ QB integration scope: receivables only (Audit 6, 2026-06-06).** The current QB integration (`api/qbo/`) covers invoices (money IN) and customer lookup/create. Payables (money OUT — expense write, Attachable image archive, Chart of Accounts query, Purchase/Bill write) are confirmed API-capable but NOT yet wired in TRACE code. Payables wire-up = Receipt Keeper v2 scope. See `docs/audits/2026-06-06-audits-5-6-quickbooks.md` §6b.

**✅ RESOLVED 2026-06-08 — proactive expiry surfacing live.** `qbo/status.ts` now checks `accounting_token_expires_at` on every dashboard load; attempts silent `refreshQBToken()` if expired; returns `needsReconnect: true` if refresh fails. `Dashboard.tsx` derives the banner immediately from `accounting_token_expires_at` client-side and applies the authoritative server result from `checkQbStatus()`. A dead/expired connection now announces itself on page load — no mid-use 401 required. STD-007 added as the class-of-bug record.

---

## Notification System

**What:** Provider-agnostic notification sender + queue. Supports Resend (email) and Twilio (SMS).  
**Status:** 🟡 Built but unconfirmed active — env vars not verified  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/notifications/send.ts` + `queue.ts`

**Templates (Cultivar OS):** `packages/shared/src/notifications/templates/cultivar.ts`
- `order_confirmation` — sends after checkout (only one actively wired)
- `netting_waiver_reminder` — template exists, not scheduled
- `care_tips_30d` — template exists, not scheduled
- `seasonal_offer` — template exists, not scheduled
- `delivery_scheduled` — template exists, not wired

**sendSilently():** Fire-and-forget. Used in `useSubmitOrder.ts`. Never blocks order flow.

---

## Social Media Module (shared + Cultivar OS surface)

**What:** Period-based AI social post generator. Aggregates the week's sales into platform-specific captions. Owner edits, copies to clipboard, posts manually.  
**Status:** ✅ Generator moved to shared 2026-06-08 — business_type-parameterized, Sonnet via gateway. Table de-nouned (AC-1). Edit/save widget live.  
**Vertical:** shared (generator) + cultivar (surface) | **Type:** tile  

**Backend:**
- `packages/shared/src/social/generate.ts` — `generateSocialDrafts()` — business_type-parameterized, Sonnet via AI gateway. `BUSINESS_DESCRIPTORS` map: variation is data, not code. `[TRACE:socialdraft]` behind `SOCIALDRAFT_DEBUG`.
- `packages/cultivar-os/api/social/generate-posts.ts` — thin Vercel handler: reads context (orders, plants, config) → calls shared generator → inserts to `social_drafts` with `subject_type='inventory'`, `subject_id=null`.
- `packages/cultivar-os/api/social/enable.ts` — upserts `business_modules` with `{ advert_channels: AdvertChannel[], cadence }`. No blotato_account_id. `advert_channels` is the single source of truth for all channel config (social + SMS).

**social_drafts table (de-nouned 2026-06-08):**
- Columns: `id, business_id, platform, original_text, edited_text, status, subject_type, subject_id, cadence, period_start, period_end, copied_at, post_type, created_at`
- `original_text`: immutable AI proposal. `edited_text`: what owner saved (null until edited).
- `subject_type`/`subject_id`: AC-1 compliant subject ref (value, not column name). Cultivar writes `subject_type='inventory'`, `subject_id=null` for period aggregates.
- Status lifecycle: `draft → edited → approved → copied` (+ `copied_at` timestamp).
- **No** `content`, `order_id`, `plant_id` (all retired 2026-06-08).
- **`social_drafts_platform_check` (2026-06-09):** CHECK constraint now migration-controlled. Hand-applied pre-migration-era; original allowed list was `(instagram, facebook, tiktok, twitter)`. Extended to include `'sms'` by `supabase/migrations/20260609_social_drafts_platform_check.sql`. ⚠️ Migration pending David apply + verify. Without this: SMS-enabled generation runs write zero rows (atomic batch rolls back when sms row violates constraint).

**Dashboard edit/save widget:**
- Generate button → calls `/api/social/generate-posts` → inserts drafts → `loadSocialDrafts()` reloads.
- Draft card: editable textarea (original_text); on blur → `handleSaveEdit()` → writes `edited_text + status='edited'`.
- [Copy] button → copies to clipboard + `status='copied' + copied_at` → removes from queue.
- [Download image] — stub, disabled (seam declared below).
- [Open platform] — links to platform URL.
- Edited drafts show green border + "✓ Edited" chip.

**Voice-delta captured (seam declared):**  
`original_text` vs `edited_text` = the training delta, accumulating now, no consumer yet.  
**remaining:** voice-learning BI — query original vs edited pairs to detect voice patterns. Horizon: v2/later. NOT a defect — data is flowing cleanly; the analysis surface is the unfilled seam.

**Aggregation/cadence generator (seam declared):**  
`cadence` is stored per module config; `period_start`/`period_end` captured per draft. The generator that reads `config.cadence` and auto-triggers a new generation window (preventing per-purchase overwhelm) is the next step.  
**remaining:** cadence-triggered generation — scheduler that fires generate-posts on cadence rhythm. Horizon: Social Rhythm (next social session). NOT a defect — the data model is ready; the trigger is the unfilled seam.

**advert_channels config (2026-06-08):**
`business_modules.config.advert_channels: [{type:'social'|'sms', name:string, enabled:boolean}]` — flat typed list. `generate-posts.ts` reads this and generates ONLY for enabled channels. SMS is a separate entry (`type:'sms'`, always one post, no image prompt). LEXICON RULE: "platform" is reserved for the top-level TRACE substrate; "channel"/"advert_channel" is used inside the product.

**Not built:** image generation. Direct social publishing — Blotato removed 2026-06-08 (misrepresented capability).

**Hidden seams declared (inert, demand-gated, priced — see `api/campaigns.ts` preamble):**
- `auto-publish seam` — wire a vetted publisher adapter at activation. No refactor needed. Gate: demand + pricing.
- `sms-auto-send seam` — TCPA/10DLC/opt-out compliance is real work at activation; adopt provider model. Gate: demand + pricing + provider selection.

---

## QR Checkout Flow (Cultivar OS)

**What:** Complete scan-to-invoice flow. QR scan → plant profile → add-ons → customer capture → cart review → order submit → QB invoice → email confirmation.  
**Status:** ✅ Built and live — end-to-end  
**Vertical:** cultivar | **Type:** tile  
**Route:** `/plant/:sku` → `/plant/:sku/addons` → `/checkout/customer` → `/checkout/review` → `/checkout/confirm`

**Key files:**
- `PlantProfile.tsx` — plant detail, add to cart
- `AddOns.tsx` — transport toggle (self/delivery/install), netting prompt, addon checkboxes
- `CustomerCapture.tsx` — name, phone, email
- `CartReview.tsx` — order summary, submit
- `Confirmation.tsx` — invoice link, scan another
- `api/orders/submit.ts` — writes order + order_items + order_addons, customer dedup by email
- `api/qbo/invoice/cultivar.ts` — creates QB invoice + customer

**Install price:** Captured from `plants.install_price`. QB line item created. Scheduling not built.  
**Leakage flag:** Set in `api/orders/submit.ts` when add-ons declined and transport is self-only.

---

## OwnerSignup (Shared)

**What:** Multi-step shared owner signup component with PIN gesture layer. Step 1: Owner Info (business name, owner name, email, password, phone, address, website). Step 2: PIN setup. Step 3: Biometric registration (optional, skippable). Optional vertical steps array.  
**Status:** ✅ Built 2026-06-03 — shared, consumed by both Cultivar and Ignition  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/auth/OwnerSignup.tsx`

**Config-driven:** Each vertical provides an `OwnerSignupConfig` specifying `memberTable`, `memberFKColumn`, `ownerRole`, `ownerPermissions`, `pinLength`, `backgroundColor`, `cardColor`, `examples` (per-vertical placeholder text), `verticalSteps` (optional post-biometric steps), and an `onSuccess` callback. The vertical's `onSuccess` handles post-signup vertical-specific setup (e.g., Ignition creates the matching `shops` row and seeds DataBridge; Cultivar navigates to /onboarding).

**PIN hash:** SHA-256 of `{businessId}:{pin}` — consistent with `hashPin()` in `packages/shared/src/supabase/auth.ts`.

**Retry-aware:** If "User already registered" → attempts signIn → if no businesses row → continues business creation. Handles orphaned auth users from partial prior signups.

---

## Business Creation Abuse Guards (Shared)

**What:** Three opt-in guards that run at the `createBusinessAndMember()` chokepoint in `OwnerSignup.tsx` before any `businesses` row is inserted. All three ship **OFF by default** (`false`). OFF = clean base case, zero queries, zero effect. ON = fully enforces. No partial state.  
**Status:** ✅ Built 2026-06-11 — wired into OwnerSignup.tsx; all flags OFF  
**Vertical:** shared | **Type:** infrastructure  
**Location:** `packages/shared/src/auth/businessGuards.ts`  
**Entry point:** `runBusinessCreationGuards(userId, supabase)` — runs A → B → C in order; first non-allowed result short-circuits; passes merge `insertPatch` to caller

**Guards:**

| Guard | Flag | Default | Behavior when ON |
|---|---|---|---|
| **GUARD_A** `PER_IDENTITY_FREE_TIER` | `GUARD_A_PER_IDENTITY_FREE_TIER` | `false` | Queries `businesses` for prior rows by this owner. If ≥1 prior business exists → sets `insertPatch: { trial_started_at: null }` — new business skips free trial. First business is unaffected. |
| **GUARD_B** `CREATION_RATE_LIMIT` | `GUARD_B_CREATION_RATE_LIMIT` | `false` | Queries `businesses` for rows created in last 24 h by this owner. If recentCount ≥ 5 → returns `{ allowed: false, error: '…' }` — blocks creation with a user-visible message. |
| **GUARD_C** `SUSPICIOUS_PATTERN_REVIEW` | `GUARD_C_SUSPICIOUS_PATTERN_REVIEW` | `false` | Queries `businesses` for last-24h rows. If count ≥ 10 AND all have `trial_started_at IS NOT NULL` → returns `{ allowed: true, heldForReview: true }`. Creation proceeds but caller receives flag for admin surfacing. ⚠️ Requires `businesses.status` column before activating `insertPatch: { status: 'review_pending' }`. |

**Fail-open discipline:** Guard query errors return `{ allowed: true }` — guard infrastructure failures never block a legitimate business creation.

**Activation discipline (documented in file, not yet activated):**
1. Prove base add-business flow with all three guards OFF (David + second business test, unimpeded).
2. Turn each guard ON one-at-a-time in isolation. David says "proven" → leave ON.
3. GUARD_C prerequisite before activation: `ALTER TABLE businesses ADD COLUMN IF NOT EXISTS status text DEFAULT 'active';` then uncomment `insertPatch` line in `checkGuardC()`.

**⛔ HARD LAUNCH GATE — must be ON-and-tested before public self-serve business creation opens:**
While creation is private/invite-only (David + family), guards may stay OFF — no abuse surface. When self-serve opens, all three guards must be individually activated, tested, and proven by David. This is a **launch prerequisite**, not a suggestion.

**`[TRACE:GUARD_A/B/C]` logs:** fire only when the respective flag is `true`. In default OFF state, zero logs emitted (clean base case per STD-003).

---

## Pain-Point Onboarding Wizard (Ignition OS — NOW ACTIVATED via ?demo=)

**What:** Full 5-step demo-first onboarding wizard. Three pain-point scenarios show dollar value within 30 minutes — no prior data entry required.  
**Status:** ✅ ACTIVATED 2026-06-10 — wired to `?demo=true` and `?demo=quick` URL params in CoreApp  
**Vertical:** ignition | **Type:** capability  
**Location:** `packages/ignition-os/OnboardingWizard.jsx` (root level)

**Steps (STEPS array):**
- `WELCOME` — "Done leaving money on the table" + 3 pain-point teasers
- `SHOP_SETUP` — shop name, owner name, 4-digit PIN (skipped in quickMode)
- `CHOOSE_PATH` — scenario picker (3 choices)
- `PATH_EXPERIENCE` — chosen scenario runs live
- `TEAM_QR` — "Shop is live" — QR code + role picker (Tech/Front Office) + invite link

**Three scenarios in PATH_EXPERIENCE:**
1. **MARGIN** (`MarginPath`) — enter vendor cost + price charged → `MarginEngine.calculateRetail()` → suggested price + "margin leak detected" + annual $ via weekly-parts slider
2. **DIAGNOSE** (`DiagnosePath`) — pick fault code from FAULT_LIBRARY (6 codes) or type own → full estimate (parts + labor + margin) → save as first work order
3. **MIGRATE** (`MigratePath`) — import customers from QuickBooks / CSV / manual entry

**Launch URLs:**
- `?demo=true` — full walkthrough from WELCOME (5 steps, owner enters real shop name + PIN)
- `?demo=quick` — jump to CHOOSE_PATH; pre-filled with "Demo Shop" / PIN 1234 (zero typing required for fast demoing)

**finalize() behavior:** generates new shopId (UUID), seeds DataBridge (localStorage), upserts to Supabase `shops` table, saves owner PIN to `DataBridge.user_profiles`. After `onComplete()` → CoreApp clears URL param + enters main app.

**Margin engine used:** `packages/ignition-os/MarginEngine.js` (FULL engine — 4 slabs, tier discounts, analyzeTransaction). NOT the shared 17-line stub. Demo output is accurate.

**quickMode prop:** `<DemoWizard quickMode={true} />` — skips WELCOME and SHOP_SETUP, initializes `stepIndex=2` (CHOOSE_PATH), pre-fills shopInfo/ownerName/ownerPin defaults.

---

## DemoLaunchButton (shared)

**What:** Neutral shared button component that navigates to `?demo=true` or `?demo=quick`. AC-1 clean — zero vertical nouns, all copy and color are caller-supplied props.  
**Status:** ✅ NEW 2026-06-10  
**Vertical:** shared | **Type:** capability  
**Location:** `packages/shared/src/onboarding/DemoLaunchButton.tsx`

**Props:** `label`, `description`, `quick` (bool), `baseUrl`, `primaryColor`, `style`  
**Usage:** Import as `import { DemoLaunchButton } from '@trace/shared/onboarding'`. Place anywhere — a settings page, admin panel, or landing tile. On click navigates to `baseUrl?demo=true|quick`.

**Seam:** Any vertical that implements a pain-point onboarding wizard and handles `?demo=` in its router can share this button. The button is the shared piece; the wizard content is the vertical's data/config.

---

## OnboardingWizard — Auth Signup (Ignition OS)

**What:** 3-step flow wrapping shared OwnerSignup. Welcome screen (dark Ignition theme) → OwnerSignup (TRACE green theme, full account + PIN setup) → Done screen (dark Ignition theme).  
**Status:** ⚠️ 2026-06-03 — uses shared OwnerSignup. Requires `shop_members` recreation migration in ufsgqckbxdtwviqjjtos (David manual step, unconfirmed). This path is UNREACHABLE when onboardingDone=true in DataBridge; bypassed entirely by ?demo= URL flow.  
**Vertical:** ignition | **Type:** capability  
**Location:** `packages/ignition-os/modules/OnboardingWizard.jsx`

**onSuccess callback:** Creates matching `shops` row (same UUID as `businesses.id`) in ufsgqckbxdtwviqjjtos, seeds DataBridge with shopId + shopName + current_user session, marks onboarding_complete=true.

**Migration required:** `packages/ignition-os/supabase/migrations/20260603_recreate_shop_members.sql` must be applied to ufsgqckbxdtwviqjjtos before new Ignition signups work.

**Extraction target:** `packages/shared/src/onboarding/WizardShell.tsx` (see PLATFORM_AUDIT.md Top 10 #1) — post-August

---

## OnboardingWizard (Cultivar OS)

**What:** 4-path demo experience for new nursery owners. Flow after signup: after OwnerSignup completes → /onboarding → detects existing businesses row → starts at CHOOSE_PATH (skips Welcome + NurserySetup). Legacy path (direct /onboarding without prior signup): starts at WELCOME → NURSERY_SETUP → CHOOSE_PATH → PATH_EXPERIENCE → DONE.  
**Status:** ✅ Updated 2026-06-04 — detects existing business on mount; signup routes here instead of /dashboard  
**Vertical:** cultivar | **Type:** capability  
**Location:** `packages/cultivar-os/src/pages/OnboardingWizard.tsx`  
**Route:** `/onboarding` (private, all new signups redirect here; Dashboard redirects here when no business row)

**4 paths:**
- LEAKAGE — leakage calculator: shows annual missed add-on revenue
- CHECKOUT — 4-slide visual walkthrough of the QR checkout flow
- SETUP — QuickBooks integration teaser
- DELIVERY — demo delivery stops → Google Maps route → SMS driver link

**finalize() behavior:** If business row exists (OwnerSignup path), skips businesses.insert and business_members.insert. Always upserts nursery_profiles. DONE screen uses name loaded from businesses table.

---

## Settings Page (Cultivar OS)

**What:** Owner-facing settings. Business profile, accounting (QB connect/disconnect), sales prompts (netting, install price), and team management.  
**Status:** ✅ Built — TypeScript  
**Vertical:** cultivar | **Type:** capability  
**Location:** `packages/cultivar-os/src/pages/Settings.tsx`  
**Route:** `/settings` (private; members without `manage_settings` are auto-redirected to `/dashboard`)

**Sections:**
- **NurserySection** — nursery name, phone, address, email, website, tax rate. Reads from `businesses` table.
- **AccountingSection** — QuickBooks connect/disconnect button. Shows connection status.
- **SalesPromptsSection** — default install price (`nursery_profiles.default_install_price`), netting prompt toggle.
- **TeamSection** — active member list, pending invitations, invite form (name/email/role), invite link copy button.

**Permission gate:** `canManageSettings = isOwner || userPermissions.includes('manage_settings')`. MANAGER role does not include `manage_settings` by design.

---

## Orders Page (Cultivar OS)

**What:** Last 50 orders with leakage highlighting. Shows transport icon, customer name, amount, leakage flag.  
**Status:** ✅ Built — TypeScript  
**Vertical:** cultivar | **Type:** capability  
**Location:** `packages/cultivar-os/src/pages/Orders.tsx`  
**Route:** `/orders` (private)

**Features:** Green border = no leakage, red border = leakage flagged. Transport icons: 🚗 self / 🚚 delivery / 🌿 install. Queries `orders` joined with `customers`.

---

## Delivery Routing (Cultivar OS)

**What:** Generate a multi-stop delivery route from pending delivery orders. Checkbox selection per stop, inline address override for missing addresses, numbered stops list, Google Maps URL, SMS-to-driver.  
**Status:** ✅ Built — TypeScript  
**Vertical:** cultivar | **Type:** tile  
**Location:** `packages/cultivar-os/src/pages/DeliveryRoute.tsx`  
**Route:** `/deliveries` (private)

**Actions:** Open in Google Maps (multi-stop URL), Text to Driver (native SMS with route link), Copy Route Link.

**Capability gap:** Delivery addresses use `customer.address_line1`. If a customer didn't provide an address at checkout, the page shows an inline override field (local state only — not persisted). Persisted delivery addresses require a `delivery_address` column on `orders` and capture at checkout for `transport_method = 'delivery'`. Migration not yet written.

**Capability gap:** No `delivery_date` on orders. Route shows all pending delivery orders with no scheduled date filtering.

---

## Campaign Scheduler (Cultivar OS)

**What:** Schedule, generate, and track social media campaigns. AI-generated post drafts with tone learning from copied posts. Owner copies text and posts manually — no auto-publish.  
**Status:** ✅ Built — TypeScript (Cultivar OS only). advert_channels router live 2026-06-08. Blotato removed.  
**Vertical:** cultivar | **Type:** tile  
**Location:** `packages/cultivar-os/src/pages/Campaigns.tsx` + `CampaignDetail.tsx`  
**Route:** `/campaigns` + `/campaigns/:id` (private)

**Backend:**
- `packages/cultivar-os/api/campaigns.ts` — combined action handler (action: 'generate' | 'copy-post'). **generate:** reads `business_modules.config.advert_channels`, generates ONLY for enabled channels, derives post count from campaign duration. No hardcoded channel names. **copy-post (handoff model):** copies text, marks status='published' (= owner reviewed, NOT auto-posted), saves edited pairs for tone learning.
- `packages/shared/src/campaigns/generate.ts` — `generateCampaignPosts({ advertChannels, ... })`. `CHANNEL_GUIDANCE` map keyed by channel name. `postsPerChannel()` derives count from campaign days. `ADVERT_DEBUG` gated.

**Handoff controls (CampaignDetail.tsx):**
- [Edit] → inline textarea → save draft edits locally.
- [Copy caption] → clipboard + calls copy-post action → status='published'. SMS label: "Copy text".
- [↓ Image] → stub, disabled (image generation seam).
- [Open ↗] → opens channel URL in new tab (social channels only; no Open for SMS).

**Schema:** `campaigns`, `campaign_posts`, `campaign_tone_samples` tables + RLS. Migration: `supabase/migrations/20260529_campaigns.sql`.
- `campaign_posts.platform` stores the channel name (from `advert_channels[].name`).
- `campaign_tone_samples`: `(business_id, platform, original_text, edited_text)` — accumulates with every copy-post where owner edited.

**Dashboard integration:** "Campaign Scheduler" card shows green border when drafts are pending.

**Hidden seams declared (inert — see `api/campaigns.ts` SEAM DECLARATIONS):**
- `auto-publish seam` — wire adapter here when activated. Gate: demand + pricing.
- `sms-auto-send seam` — TCPA/consent compliance at activation; adopt provider model. Gate: demand + pricing + provider.

**⚠️ David must apply migration:** `supabase/migrations/20260608_advert_channels_config.sql` migrates existing `{ platforms, cadence }` config to `{ advert_channels, cadence }`. Run VERIFICATION query in migration file after applying.

---

## Discovery Module (Cultivar OS — v0)

**What:** Silent partner analysis engine. Fetches a prospect's website, runs a two-pass AI analysis (fast identity extraction + deep profile), and generates a "silent partner" email: what the business is doing well, what could amplify it. David sends the analysis to the prospect; they receive something real and specific regardless of whether they ever sign up.  
**Status:** ✅ v0 built — TypeScript (2026-06-05). See DISCOVERY_MODULE_BRIEF.md for full spec.  
**Vertical:** cultivar (admin surface today; cross-vertical engine) | **Type:** capability  
**Location:** `packages/shared/src/discovery/` + `packages/cultivar-os/api/discovery/ingest.ts` + `packages/cultivar-os/src/pages/DiscoveryInspect.tsx`

**v0 flow (fully operational):**
1. David opens `/discovery/inspect` (internal, URL is the gate — no auth wall)
2. Enters prospect URL, vertical, optional pain point
3. Engine runs: website fetch → Haiku identity pass → Sonnet deep analysis → Sonnet synthesis email
4. David reviews profile + draft email in DiscoveryInspect
5. Enters prospect email → clicks "Send analysis" → Resend delivers the silent partner email

**Engine:**
- `discovery/adapters/website.ts` — fetches URL, extracts text (Chrome headers, fallbacks to /about)
- `discovery/engine.ts` — `runIdentity()` (Haiku, fast), `runAnalysis()` (Sonnet, deep); routes through `packages/shared/src/ai/execute.ts`
- `discovery/synthesis.ts` — `runSynthesis()`: BusinessDiscoveryProfile → SilentPartnerAnalysis; routes through `execute.ts`
- `discovery/seed.ts` — `seedServiceOfferings()`: maps suggestedOfferings → `service_offerings` rows with `is_active=false`; idempotent

**API (cultivar-os):**
- `api/discovery/ingest.ts` — POST `/api/discovery/ingest`
  - Default: fetch → identity → analysis → synthesis → `{ identity, profile, analysis, seeded }`
  - `businessId` in body → seeds service_offerings in-memory immediately after analysis (no DB lookup)
  - `action='send'` in body → delivers analysis email via notifications module (no new Vercel function)

**Admin surface:**
- `pages/DiscoveryInspect.tsx` — form (URL + vertical + pain point) → loading stages → profile display → analysis preview → Copy button + Send section (recipient email input + "Send analysis" button)

**Notification template:**
- `notifications/templates/cultivar.ts` → `silent_partner_analysis` — transactional email, TRACE default branding (not LAWNS). Pre-rendered HTML from synthesis passes through.

**⚠️ Env vars required for live email delivery (not yet set in Vercel):** `RESEND_API_KEY` + `FROM_EMAIL`. Without them, `sendNotification` runs in demo mode: logs the send, returns `{ ok: true, demo: true }` — no actual email delivery.

**remaining:**
- Discovery persistence — NOT built. `seed.ts` wired in-memory via `ingest.ts`; v0 admin sends analysis live with no retained copy. DB persistence (`discovery_sessions`, `business_discovery_profiles`), seed-at-signup via lookup, and retained session copies = v2 (gated surface + one-auth). GAP not debt. Horizon: v2/later.

---

## CoolRunnings

**What:** Separate vertical for homes. Not part of trace-platform monorepo.  
**Status:** Active development, separate repo  
**Vertical:** N/A (separate repo — not in the trace-platform shared layer) | **Type:** N/A  
*⚠️ NEEDS DAVID'S CALL — see bottom: this entry is a reference pointer, not a built capability in this repo. No type classification applies.*  
**Repo:** `david-obrien61/CoolRunning` on GitHub  
**Desktop folder:** `~/Desktop/CoolRunning/`  
**Assessment tool:** `~/Desktop/trace-assessment-app/` — standalone, no git

---

## Repo Map (Desktop → GitHub)

*Reference section — no Vertical/Type classification applies.*

| Desktop Folder | GitHub Repo | What's in it | Status |
|---|---|---|---|
| `~/Desktop/trace-platform/` | `david-obrien61/trace-platform` | Cultivar OS (active) · ignition-os (active — web build complete 2026-05-28) | Active — primary monorepo. Only folder that deploys to Vercel. Both verticals deploy from here. |
| `~/Desktop/CAI/` | `david-obrien61/CAI` | Ignition OS (original JavaScript source) | **Archive (2026-05-28)** — web build migrated to `packages/ignition-os/`. Read-only. Keep for `ai_router.py` reference until Railway is decommissioned. |
| `~/Desktop/CoolRunning/` | `david-obrien61/CoolRunning` | CoolRunnings vertical | Active — separate vertical. |
| `~/Desktop/IgnitionMobile/` | `david-obrien61/ignition` (archived) | Ignition OS mobile prototype | Archive — rename folder to `IgnitionMobile-archive`. |
| `~/Desktop/Cultivar-os/` | (none) | Empty | Safe to delete. |
| `~/Desktop/trace-assessment-app/` | (none) | CoolRunnings assessment tool | Standalone, no git. |

---

## Ignition OS — Workflow Modules (2026-06-09 Reality Audit)

**Audit date:** 2026-06-09 | **Standard:** STD-010 (opaque name = debt; discovered build = catalogue it) | **Scope:** all .jsx/.js in `packages/ignition-os/` (root + modules/ + hooks/) | **Full report:** `docs/audits/ignition-reality-audit-2026-06-09.md`

> **Root-cause notes before the table:**
> - **DARK root cause:** `VITE_API_URL` not set in ignition-os Vercel project → every `AIEngine.call()` returns `{ ok: false }`. Railway running but receives zero Vercel traffic.
> - **BROKEN root cause:** `20260602_ignition_drop_team_tables.sql` dropped `pin_resets`, `shop_invites`, `member_devices`. Only `shop_members` was recreated (`20260603_recreate_shop_members.sql`). The other three tables have no recreate migration.
> - **SPLIT-BRAIN root cause:** `IgnitionIntake` writes customers to Supabase `customers`. `IgnitionCRM` reads from DataBridge `customers_directory`. These are entirely separate stores — intake customers never appear in CRM.

### Module Status Table

| Module / File | STD-010 Decoded Name | Status | Workflow Position |
|---|---|---|---|
| `CoreApp.jsx` | Master Session Controller | WIRED (ForgotPinFlow + JoinFlow sub-flows BROKEN) | Session gate — every module flows through |
| `DataBridge.js` | Local-First Data Layer | WIRED (cloud sync DARK — API_URL unset) | Infrastructure |
| `MarginEngine.js` | Full Pricing Engine | WIRED — 🔴 DEPRECATED 2026-06-10; superseded by `packages/shared/src/business-logic/MarginEngine.ts`. Migrate callers via checklist. | Infrastructure |
| `ExternalBridge.js` | QB OAuth + CSV Import | QB path DARK / CSV WIRED | Support — QB dead; CSV migration works |
| `IgnitionCore.js` | Web Session Guard + Sub-Router | WIRED | Session infrastructure |
| `PriceField.jsx` | Part Pricing Widget | WIRED | Sub-component of IgnitionEstimate (Step 4) |
| `modules/OnboardingWizard.jsx` | Owner Signup Wizard (canonical) | WIRED | Initial setup (first-run) |
| `modules/IgnitionIntake.jsx` | New Repair Order Creation | WIRED | Step 1 — creates the RO |
| `modules/IgnitionFlux.jsx` | RO Queue / Workflow Status Board | WIRED | Step 2 — job queue + routing |
| `modules/IgnitionEval.jsx` | Tech Evaluation Station | WIRED (photo upload: AMBIGUOUS — Supabase storage bucket unconfirmed) | Step 3 — DTC, photos, labor clock |
| `modules/IgnitionCipher.jsx` | DTC Fault Code Decoder | DARK (AI path). Local 3-code lookup (3216/3251/157) works. | Step 3.5 support — DTC decode |
| `modules/IgnitionEstimate.jsx` | Service Writer Estimate Station | DARK (AI skeleton + auto-PO). Manual estimate editing WIRED. | Steps 4–5 — estimate build |
| `modules/IgnitionPort.jsx` | Customer Estimate Portal (DataBridge path) | WIRED (DataBridge-only; parallel to IgnitionEstimate, incompatible data) | Steps 5–6 alternate path |
| `modules/CustomerApprovalPortal.jsx` | Customer Digital Signature Screen | WIRED | Step 6 — customer authorization |
| `modules/IgnitionKosk.jsx` | Technician Floor Station | WIRED | Step 7 — tech repair execution |
| `modules/IgnitionHandover.jsx` | Job Handover Modal | WIRED | Sub-component of IgnitionKosk |
| `modules/SlideToComplete.jsx` | Drag-to-Confirm Widget | WIRED | UI sub-component |
| `modules/IgnitionInvoice.jsx` | Invoice Creation + Payment | WIRED (PDF download stub) | Step 8 — final invoice |
| `modules/IgnitionStok.jsx` | Parts Inventory | WIRED | Support — parts lookup |
| `modules/IgnitionProt.jsx` | Margin & Pricing Configuration | WIRED (DataBridge; overhead captured but `calculateRetail()` ignores it — Tech Debt #16) | Admin config |
| `modules/IgnitionTools.jsx` | Shop Equipment Registry + PMI | WIRED | Shop management |
| `modules/IgnitionOmni.jsx` | Shop Command Dashboard | WIRED (inventory_items stat always $0 — orphaned DataBridge read) | Owner command center |
| `modules/IgnitionOmniDashboard.jsx` | Shop Telemetry Dashboard | SAVINGS tab BROKEN (SavingsReport.jsx missing — Tech Debt #10). LIVE METRICS WIRED. | Executive telemetry |
| `modules/IgnitionAudit.jsx` | AI Invoice Leakage Scanner | DARK (AIEngine.auditInvoice() requires API_URL) | Standalone — invoice analysis |
| `modules/PredictiveKey.jsx` | AI Preventive Maintenance Scheduler | DARK (AI schedule generation). DataBridge asset storage WIRED. | Standalone — PMI |
| `modules/IgnitionCompliance.jsx` | 24-Point DOT Inspection | WIRED (form only). Photo = alert stub. smartSync queued but never sent. | Compliance gate |
| `modules/IgnitionAdmin.jsx` | Staff Management + Shop Settings | WIRED (core). Devices tab + PIN reset: BROKEN (member_devices/pin_resets dropped). | Admin |
| `modules/AdminSubscription.jsx` | Module Subscription Marketplace | WIRED (DataBridge trial management) | Admin — module activation |
| `modules/IgnitionProc.jsx` | Vendor Directory | WIRED (DataBridge). "Initialize PO" button: STUB. | Step 5 support |
| `modules/IgnitionCRM.jsx` | Customer Directory (DataBridge) | WIRED (DataBridge-only). SPLIT-BRAIN from intake Supabase data. | Standalone |
| `modules/CSVImporter.jsx` | Customer Data Migration Tool | WIRED (client-side CSV → DataBridge) | Onboarding / migration |
| `modules/IgnitionHub.jsx` | Fleet Dispatch Board | ORPHANED (DataBridge-only; GPS simulated; fleet_units has no real writer in web build) | Parallel — dispatch |
| `modules/IgnitionProcure.jsx` | Parts Entry for Active Job | ORPHANED (not in CoreApp routing; no caller in web build) | Step 6 — ORPHANED |
| `hooks/useIgnitionVoice.js` | Voice Recognition Hook | WIRED (browser-dependent: Chrome/Safari) | IgnitionKosk sub-feature |
| `hooks/usePowerSense.js` | Battery State Hook | WIRED (Chrome/Edge only) | IgnitionKosk environment detection |
| `OnboardingWizard.jsx` (root) | Pain-Point Demo Wizard (5-step) | ✅ ACTIVATED 2026-06-10 — `?demo=true` (full) or `?demo=quick` (jump to scenario picker). `modules/OnboardingWizard.jsx` = separate auth-based signup. | First-run + demo |
| `EnrollmentCatch.jsx` | Enrollment Token Handler | ORPHANED (legacy DataBridge pending_users pattern) | Staff onboarding — old pattern |
| `hooks/useDataBridge.js` | Legacy State Hook | ORPHANED (pre-DataBridge.js; hardcoded demo job) | Not in active flow |
| `hooks/useIgnitionCipher.js` | Legacy PIN Auth Hook | ORPHANED. **⚠️ NAMING COLLISION** — same name "CIPHER" as IgnitionCipher.jsx (DTC decoder) but completely different function. Hardcoded PINs (1111/1234/2222/3333). | Not in active flow |
| `App.js` | Mobile-Era Entry Point | ORPHANED (main.jsx is web entry) | Not in web flow |
| `modules/IgnitionLegal.js` | Legal Contract Repository | MOBILE-ONLY (React Native imports; no web build) | N/A |
| `modules/CustomerApproval.jsx` | (empty) | DESIGNED-NEVER-BUILT (1-line stub file) | N/A |
| `modules/IgnitionVIN.jsx` | VIN Scanner Web Stub | DESIGNED-NEVER-BUILT (`alert()` stub; no decode; mobile-only feature) | Step 3 sub-tool — STUB |

### Workflow Chain Summary

The RO chain is **mostly operational** end-to-end. Key degradation points:

```
Step 1 (Intake) → ✅ Step 2 (Queue) → ✅ Step 3 (Eval) → ⚠️ DTC decode (3 codes only, rest DARK)
→ Step 4 (Estimate: manual works, AI skeleton DARK, auto-PO DARK)
→ Step 5 (Pricing: PORT path DataBridge, Estimate path Supabase — NOT SYNCHRONIZED)
→ Step 6 (Customer Auth: ✅ digital signature)
→ Step 7 (Kiosk: ✅ labor/repair/custody)
→ Step 8 (Invoice: ✅ Supabase; PDF = stub; QB = DARK + no Vercel functions)
```

**QB note:** Cultivar OS has `api/qbo/*` Vercel functions. Ignition OS has NONE. QB is not just DARK — the server-side functions do not exist for Ignition.

**Two parallel estimate paths (incompatible):** `IgnitionEstimate.jsx` (Supabase `estimates/estimate_line_items`) and `IgnitionPort.jsx` (DataBridge `active_job_context`). The same workflow step has two separate, unsynchronized data stores. Customer authorization via `CustomerApprovalPortal` works from both but writes to `customer_authorizations` (Supabase) in both cases.

### RBAC — 19 Permissions, 4 Role Presets, Client-Side Only

Defined in `IgnitionAdmin.jsx ALL_PERMISSIONS`. Enforced by `CoreApp AccessGatekeeper` which checks DataBridge `current_user.permissions`. No Supabase RLS enforcement. Notable gap: `IgnitionCompliance.jsx` has `requiredPermissions={[]}` in CoreApp routing — any logged-in user (including CUSTOMER role) can access the DOT inspection form.

### DataBridge Orphaned Keys

| Type | Key | Problem |
|---|---|---|
| Orphaned write | `margin_change_log` | Written by `DataBridge.setMarginConfig()`. No module reads or displays it. |
| Orphaned write | `pending_users` | Written by IgnitionOmni legacy staff enrollment. Only `EnrollmentCatch` reads it — via an orphaned flow. |
| Orphaned read | `inventory_items` | IgnitionOmni reads for stats. IgnitionStok reads from Supabase `inventory` — not DataBridge. Inventory value tile = always $0. |
| Orphaned read | `fleet_units` | IgnitionHub reads. No module in web build writes real fleet unit data. Hub shows empty GPS grid. |
| Orphaned read | `labor_guide` | `DataBridge.getLaborGuide()` always returns hardcoded defaults — no module has ever written a real labor guide. |

---

## What Is NOT Yet Built (High-Priority Gaps)

| Capability | Who needs it | Notes |
|---|---|---|
| SavingsReport.jsx | Ignition OS | React display component for `savings_report` task. API complete. Display work only. (Tech Debt #10) |
| Stripe billing | All verticals | Types exist in shared. No Stripe calls anywhere. localStorage placeholder in Ignition. |
| Customer directory | Cultivar OS | `customers` table exists, no browse/search UI. Lauren needs this. |
| Online Shop | Cultivar OS | Tile exists, "Enable" stub. Next roadmap item. |
| Follow-Up engine | Cultivar OS | Tile exists, nothing built. |
| Abstract asset model | Shared | QR→record→event pattern is identical in both verticals. Extract before Conduit OS. |
| Onboarding wizard (shared) | Shared | Two separate OnboardingWizard implementations (Ignition + Cultivar). Extract WizardShell to shared before Conduit OS. |
| Trial clock enforcement | Cultivar OS | Seam exists in useModules.ts line 100 (`nurseryPlan = 'starter'`). No blur, no Stripe. |
| Delivery address persistence | Cultivar OS | DeliveryRoute.tsx shows inline address override but does not persist it. Needs `delivery_address` column on `orders` and capture at checkout for delivery transport. |
| Delivery date scheduling | Cultivar OS | No `delivery_date` on orders. Route shows all pending with no date filtering. |
| Per-plant install price edit | Cultivar OS | `plants.install_price` read-only in UI. No edit surface. Post-demo. |
| ~~Tighten nursery_modules RLS~~ | ~~Cultivar OS~~ | ✅ RESOLVED 2026-06-04: `business_modules` created with membership-scoped RLS (`business_members.user_id = auth.uid() AND active = true`). `authenticated_select_nursery_modules` (loose) retired. |
| Port ai_router.py to Vercel functions | Ignition OS | Railway is legacy for web build. Agreed kill path: retire orphaned tasks (invoice_scan, vin_decode), port real tasks (dtc_decode, estimate_draft first). (Tech Debt #12) |
| Receipt / Expense / Cost-Profile storage | All verticals | `receipts`, `expenses`, `cost_profile` tables do not exist. No migration. Eval-photos bucket is Ignition-specific, not receipt archive. AC-clean schema proposed in Audit 3. Build from scratch. |
| ~~Margin Engine (shared — real)~~ | ~~All verticals~~ | ✅ BUILT 2026-06-10 — `packages/shared/src/business-logic/MarginEngine.ts`. 5 old impls marked 🔴. Callers migrate via checklist. |
| QB payables wiring | Cultivar OS → all | QB can write expenses (Purchase/Bill), archive receipt images (Attachable), query Chart of Accounts. None wired today. Receipt Keeper v2 scope. |
| ~~Proactive QB reconnect detection~~ | ~~Cultivar OS~~ | ✅ RESOLVED 2026-06-08 — `qbo/status.ts` now checks token expiry on load, attempts silent refresh, surfaces banner proactively. Tech Debt #15 closed. STD-007 added. |
| Gemini vision pipeline (proven on Vercel) | Ignition OS, shared | VIN OCR is a placeholder (alert only). No Vercel serverless function has ever called Gemini vision and returned structured output. Receipt Keeper v1 will be the first confirmed pipeline. |

## ✅ Resolved Gaps (previously listed as Not Yet Built)

| Capability | Resolved | How |
|---|---|---|
| Signup → nursery row creation | 2026-05-29 | OnboardingWizard (Cultivar OS) creates `businesses` + `nursery_profiles` rows on finalize(). New accounts redirect to /onboarding. |
| Settings page (Cultivar OS) | 2026-05-29 + 2026-06-02 | Settings.tsx built with NurserySection, AccountingSection, SalesPromptsSection, TeamSection. Permission gate added 2026-06-02. |
| Delivery routing (Cultivar OS) | 2026-05-29 | DeliveryRoute.tsx at /deliveries. Multi-stop Google Maps URL, SMS-to-driver. |
| Multi-tenant member login | 2026-06-02 | BusinessProvider two-path resolution. Members land on Dashboard, not "Account not linked" wall. |
| Cross-vertical member isolation | 2026-06-04 | BusinessProvider member path now filters by `business_type` post-fetch (commit 8792c71). |

---

## 📋 Specifications and User Stories

Working product specifications describing intended behavior. These are design intent, not built features. When a spec is implemented, update this entry and the spec document with implementation notes.

| Document | Covers | Status |
|---|---|---|
| [docs/user-stories/cultivar-flows-and-contractor-program-2026-06-03.md](user-stories/cultivar-flows-and-contractor-program-2026-06-03.md) | Delivery module config, contractor onboarding/tiers, online customer purchase flow, in-person LAWNS QR flow, delivery routing intelligence | 2026-06-03 — working spec, not yet implemented |

---

## 📂 Discovery Documents

Quantitative, citable research artifacts. Used in sales conversations, product development, and investor context.

| Document | Subject | Key finding |
|---|---|---|
| [docs/discovery/conduit-margin-evidence-2026-06-03.md](discovery/conduit-margin-evidence-2026-06-03.md) | Contractor markup analysis — Liberty Hill masonry project (Capital Land Design vs. actual) | 3.3× average materials markup; 57% savings ($2,629 on $4,651 quote); first documented data point for Conduit margin intelligence thesis |
| [docs/discovery/onboarding-flow-findings-2026-06-03.md](discovery/onboarding-flow-findings-2026-06-03.md) | Real user testing of Ignition OS and Cultivar OS new-owner signup flows | Critical: Ignition blocked by missing shop_members table. High: Cultivar TeamSection not visible, signup form missing owner data. Navigation/onboarding shape inconsistencies between verticals. |

---

## ⚠️ NEEDS DAVID'S CALL

Entries where the correct Vertical or Type tag is ambiguous. Best guess noted.

| Entry | Ambiguity | Best guess |
|---|---|---|
| **Subscription Tiers + Pricing** | Currently documented from Ignition/CAI perspective. Question: does the STARTER/PROFESSIONAL/PREMIER tier structure apply platform-wide, or does each vertical have its own pricing model? Cultivar currently uses a flat $149/mo founding rate. | If platform-wide → `Vertical: shared`. If Ignition-only → `Vertical: ignition`. Tagged `ignition` for now. |
| **AdminSubscription / Marketplace UI** | Is this a dashboard tile in the Ignition OmniDashboard tile grid, or is it reached via an admin/settings navigation separate from the tile grid? | If it appears in the tile grid → `Type: tile`. If admin nav → `Type: capability`. Tagged `capability` for now. |
| **CoolRunnings** | This entry is a reference pointer to a separate repo, not a built capability inside trace-platform. No Vertical/Type classification is meaningful. | Could be removed from this inventory (it's not in this repo) or kept as a cross-reference note. Tagged `N/A` for now. |
| **DataBridge — promote or keep local** | This doc says localStorage-first wrapper intentionally not shared. Bootstrap spec says offline-sync engine, promote. These are opposite post-demo jobs. ~45-file footprint confirmed; function and promote decision are not. RBAC enforcement entangled inside DataBridge (grep confirmed co-location). | Read ~30 lines of `DataBridge.js` to settle the function question. David decides promote vs. keep-local. Until resolved: treat as Ignition-only, do not open for RBAC extraction or shared promotion. |

---

*TRACE Enterprises · Built Inventory · Created 2026-05-28 · Audit-reconciled 2026-06-05*  
*Update this document when something new is confirmed built or confirmed missing.*
