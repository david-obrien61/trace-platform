# CLAUDE.md — TRACE Platform
# Multi-AI Handoff Workflow — Claude Code reads this every session
# Last updated: May 29, 2026
# Current AI: Claude Code

> CRITICAL: Read this entire file before touching any code.
> Update the Handoff section (Part 3) before ending every session.
> Update GEMINI.md with the same changes if Gemini is in use.

---

## Scope & Hierarchy

This document owns session-by-session handoff state, current infrastructure specifics, and the active task list. Read this first at the start of every Claude Code session.

When this doc conflicts with another:
- For strategy, demo plan, or revenue questions, see MASTER_BRIEF.md
- For architecture or where things should live, see PLATFORM_STRATEGY.md
- For what's actually built in code, see TRACE_PLATFORM_AUDIT.md
- For the discovery module, see DISCOVERY_MODULE_BRIEF.md (created Session 1b)
- For reuse ratio figures, see TRACE_PLATFORM_AUDIT.md "Reuse ratio — corrected ground truth (2026-05-28)"; the 68/78/80% figures cited in prior sessions are retired.

Update the handoff section at the end of every session.

---

## 1. CORE MANDATE

You are building the TRACE platform — a composable AI operating
system for owner-operated small businesses. One codebase. One
deployment. Infinite verticals. Each vertical is a configured
instance of the same shared platform.

**CRITICAL RULES — NON-NEGOTIABLE:**

1. Before writing ANY new module, check packages/shared/src/ first
2. If it exists in shared → import and configure. Never rebuild.
3. If it needs to be shared → build it IN shared/ first, then import
4. Never hardcode a vertical name inside a shared module
5. Never duplicate auth, QB, QR, notifications, or UI primitives
6. packages/ignition-os is now an active build target — treat it like cultivar-os
7. Never end a session without updating this Handoff section
8. Commit after every completed task

---

## 2. STATUS & ARCHITECTURE

### Key Contacts

**LAWNS Tree Farm (Leander, TX)** — Cultivar OS prospect, prototype demo customer
- Terry: owner, 65, retiring soon, tech-shy, approval gatekeeper
- Lauren Bishop: manager, the real operational buyer, the champion who feels the pain
- "Layna" was a miscommunication and is not a real contact. Do not reintroduce.

**Operation Liberty Hill (Liberty Hill, TX)** — KINNA-OS anchor pilot customer
- Regina O'Brien: Program Director, anchor pilot user. Holds active job offer; planning graceful exit. David's wife.
- Hard target: Back to School distribution, Saturday August 1, 2026

- **Current phase:** Phase 0 — Cultivar OS demo prep
- **Demo meeting:** Next week — LAWNS Tree Farm LLC, Leander TX
- **Key contacts:** Terry (owner), Lauren (manager)
- **Active vertical:** cultivar-os
- **Tech stack:** React + Vite + TypeScript · Supabase · Vercel
- **Source of truth:** Supabase PostgreSQL (NEW project)
- **Repo:** github.com/david-obrien61/trace-platform (private)
- **Frontend deploy:** Vercel → cultivar-os.vercel.app
- **Backend:** Vercel serverless functions (api/ at repo root)
- **Railway:** Ignition OS only — do NOT use for cultivar-os

### Supabase Projects — TWO SEPARATE PROJECTS

```
cultivar-os (NEW — active):
  Project ref: bgobkjcopcxusjsetfob
  URL: https://bgobkjcopcxusjsetfob.supabase.co
  Tables: nurseries, plants, plant_events, orders,
          order_items, order_addons, addons, losses,
          customers, social_drafts, modules,
          nursery_modules
  Auth: email/password, email confirmation OFF

ignition-os (OLD — do not touch):
  Project ref: ufsgqckbxdtwviqjjtos
  Contains: all Ignition OS tables
  Status: active for Ignition OS dry run
  RULE: never modify from cultivar-os code
```

### Vercel Environment Variables

**cultivar-os project** (bgobkjcopcxusjsetfob Supabase):
```
VITE_SUPABASE_URL      = https://bgobkjcopcxusjsetfob.supabase.co
VITE_SUPABASE_ANON_KEY = eyJhbGc... (new project anon key)
SUPABASE_SERVICE_KEY   = eyJhbGc... (new project service key)
SUPABASE_URL           = https://bgobkjcopcxusjsetfob.supabase.co
QBO_CLIENT_ID          = set ✅
QBO_CLIENT_SECRET      = set ✅
QBO_REDIRECT_URI       = https://cultivar-os.vercel.app/api/qbo/callback
QBO_ENVIRONMENT        = production    # Updated 2026-05-22 when Cultivar-OS received Intuit production approval (see MASTER_BRIEF Part 11). CLAUDE.md was not updated at the time; Session K audit on 2026-05-27 surfaced the stale doc by checking Vercel dashboard directly.
BLOTATO_API_KEY        = blt_Wq7URDauPd5CdJzJfvRWgJSGrBdjZYIuOXNLb/ePic8=
VITE_DEMO_NURSERY_ID   = a1b2c3d4-0000-0000-0000-000000000001
VITE_DEMO_BUSINESS_ID  = a1b2c3d4-0000-0000-0000-000000000001    # Added 2026-05-29
VITE_TAX_RATE          = 0.0825
```

**ignition-os project** (ufsgqckbxdtwviqjjtos Supabase — separate Vercel project, NEW):
```
VITE_SUPABASE_URL      = https://ufsgqckbxdtwviqjjtos.supabase.co
VITE_SUPABASE_ANON_KEY = (from Supabase dashboard — ufsgqckbxdtwviqjjtos → Settings → API)
VITE_API_URL           = NOT NEEDED — ai_router.py/Railway is legacy for web builds.
                         Add this only when AI endpoints are ported to Vercel functions.
```
Build command (in Vercel dashboard, overrides vercel.json): `npm run build:ignition`
Output directory: `packages/ignition-os/dist`

### Key Data — Demo

```
Demo URL:      cultivar-os.vercel.app/plant/SCV-0031
Demo nursery:  LAWNS Tree Farm, LLC
Nursery ID:    a1b2c3d4-0000-0000-0000-000000000001
Test login:    david_obrien2016@outlook.com
Netting price: $10/tree
Tax rate:      8.25% (Texas)
Invoice:       #3648.380 — $920.13 PAID (bring printed copy)
Meeting:       Next week — 400 Honeycomb Mesa, Leander TX 78641
Close target:  $149/mo founding rate — locked forever
TRACE phone:   (512) 456-3632
TRACE email:   david@trace-enterprises.com
```

### Registered Domains (as of 2026-05-26)

All domains registered at GoDaddy under David's account.

| Domain | Protection | Status / Use |
|---|---|---|
| trace-enterprises.com | None | Parent company domain |
| builtwithcai.com | Full Protection | Methodology brand; hosts discovery.builtwithcai.com (planned subdomain) |
| cultivar-os.com | None | Cultivar OS (nursery vertical) — currently forwards to cultivar-os.app |
| cultivar-os.app | None | Cultivar OS production app (live) |
| ignition-os.com | Full Protection | Ignition OS (diesel/auto vertical) |
| ignition-os.app | None | Ignition OS (alternate TLD) |
| conduit-os.com | None | Conduit OS (HVAC/electrical vertical) |
| conduit-os.app | None | Conduit OS (alternate TLD) |
| kinna-os.com | None | KINNA-OS (faith-based and direct-service nonprofit vertical) |
| kinna-os.app | None | KINNA-OS (alternate TLD) |

**WHOIS privacy status:** Domains marked "None" do NOT have WHOIS privacy enabled, meaning David's registration address is publicly queryable. Plan: defer privacy upgrades to the Cloudflare transfer window opening July 1-2, 2026, which provides free WHOIS privacy as a benefit of the transfer. Current annual cost of GoDaddy WHOIS privacy across the unprotected domains would be approximately $13/yr each.

**Open: which domain hosts the KINNA-OS production app when Phase 1 ships.** Options include kinna-os.app (matches Cultivar's pattern), kinna-os.com (matches Ignition's pattern), or a subdomain of builtwithcai.com (matches the discovery surface pattern). Decision deferred to pre-build.

---

### Desktop Folder → GitHub Repo Map (verified 2026-05-28)

> Before starting any build session, confirm which desktop folder maps to the target vertical.
> Do not edit a folder that is not linked to the active GitHub repo.

| Desktop Folder | GitHub Repo | Deployed Vertical | Status |
|---|---|---|---|
| `~/Desktop/trace-platform/` | `david-obrien61/trace-platform` | Cultivar OS (active) · ignition-os (planned) | **Active — primary monorepo** |
| `~/Desktop/CAI/` | `david-obrien61/CAI` | Ignition OS (original) | **Archive (2026-05-28)** — Ignition OS web build is now live in `trace-platform/packages/ignition-os/`. CAI/ is read-only. Keep for `ai_router.py` reference only until Railway is decommissioned. |
| `~/Desktop/CoolRunning/` | `david-obrien61/CoolRunning` | CoolRunnings (home automation) | Active — separate vertical, separate repo |
| `~/Desktop/IgnitionMobile/` | `david-obrien61/ignition` *(archived)* | Ignition OS mobile prototype | **Archive** — GitHub repo is archived. Rename desktop folder to `IgnitionMobile-archive`. Keep for migration reference until ignition-os web build is complete. |
| `~/Desktop/Cultivar-os/` | *(none — no git)* | — | **Empty folder** — safe to delete. Real Cultivar OS is in `trace-platform/packages/cultivar-os/`. |
| `~/Desktop/trace-assessment-app/` | *(none — no git)* | CoolRunnings assessment tool | Standalone app, no git. Contains `src/lib/AIEngine.js` (Claude Vision, device identification — different from Ignition AIEngine). |
| `~/Desktop/CoolRunning/` | `david-obrien61/CoolRunning` | CoolRunnings | See above. |

**Rule:** `trace-platform/` is the only folder that deploys to Vercel. All Cultivar OS work goes here. All Ignition OS work goes here — migration is complete as of 2026-05-28. CAI/ is archive.

---

### Auth Architecture — Locked Rule (2026-05-28)

**Auth: PIN/face are unlock gestures layered on top of a real Supabase session (`auth.uid()` must be non-null) — never a replacement. Tenant isolation and RLS depend on this. Do not introduce PIN-only auth for any vertical handling multi-tenant customer data.**

Context: Cultivar OS uses email/password → Supabase Auth → `auth.uid()` → `nurseries.owner_id` lookup (via `NurseryProvider`). The Ignition OS PIN model is explicitly local-first and intentionally bypasses Supabase Auth — it is a separate, known exception for that vertical's single-device use case, not a pattern to reuse in multi-tenant contexts.

---

## Open Architecture Decisions

Decisions that have been deferred but must be resolved before specific build milestones. Update this list when decisions are made or new ones are deferred.

| # | Decision | Deferred From | Resolve Before | Notes |
|---|---|---|---|---|
| 1 | "Surface Honesty" principle name | 2026-05-26 (Session 1b) | 60 days of use, then review | Substance is locked; only the name is provisional |
| 2 | "Honest Friction" principle name | 2026-05-26 (Session 1b) | 60 days of use, then review | Substance is locked; only the name is provisional |
| 3 | KINNA-OS production app domain | 2026-05-26 | KINNA-OS Phase 1 build | Options: kinna-os.app, kinna-os.com, subdomain of builtwithcai.com |
| 5 | PLATFORM_STRATEGY.md file metadata claiming to be authoritative | 2026-05-26 (Session 1a noticed-but-not-touched) | Next PLATFORM_STRATEGY edit pass | Mildly inconsistent with the new Scope & Hierarchy preamble; soften or remove |
| 6 | PANTRY_OS.md file rename (if file is re-created) | 2026-05-26 | If/when a Pantry OS-named file is re-created in the repo | File was not found in the repo at Session 1a, but the question of its potential return is logged |
| 7 | "Honest Velocity" principle name | 2026-05-27 (Brand framing session) | 60 days of use, then review | Substance is locked; only the name is provisional. Joins Surface Honesty and Honest Friction as a coherent family of design principles. |
| 8 | "Epistemic Humility" principle name | 2026-05-27 (Brand framing session) | 60 days of use, then review | Substance is locked; only the name is provisional. Fourth design principle. |
| 9 | Family-member role descriptions in canonical docs | 2026-05-27 (Brand framing session) | Before any public-facing copy uses them | Andrew, Connor, Erin, Regina each get to review and edit their own paragraph in the TRACE — Who We Are block. David sends each their section. |
| 10 | Surface Honesty principle scope — does it cover data values, not just UI elements? | 2026-05-27 (Session K audit findings + nurseries row placeholder data discovery) | Within 30 days of use of the principle | Tonight's work revealed the data layer was lying (fake "Layna" email, 555-prefix fake phone, wrong address) while the UI hardcoded over it with correct values. The principle as committed addresses UI surfaces; the actual failure mode crossed layers. Likely outcome: extend the principle wording in PLATFORM_STRATEGY.md to explicitly cover all data values the system displays, not only UI elements. |
| 11 | Missing-SELECT-RLS-policy pattern — needs systemic prevention | 2026-05-27 (third occurrence of the same root cause: modules May 22, nursery_modules May 22, orders May 27) | Within 30 days OR before any new table is added to Cultivar OS | Three separate instances of the same bug indicate a process gap. Options: (a) Add a checklist item to migration templates requiring a SELECT policy. (b) Build a Claude Code audit that scans schema for tables-without-SELECT-policies and reports them. (c) Add to the standards seed list as STD-NNN "Every table needs RLS policies." Likely outcome: a combination — the standard plus the audit. Worth a focused session post-LAWNS. |
| 12 | "Honest Debt" principle name | 2026-05-28 | 60 days of use, then review | Substance is locked; only the name is provisional. Fifth design principle in PLATFORM_STRATEGY.md. |

---

## Tech Debt Log

Intentional workarounds that violate architectural intent for a real-world reason. Each entry documents the workaround, the correct architecture, and what triggers the repair. Tech debt is acknowledged here so it doesn't become silent debt.

This log is created and maintained per the Honest Friction principle (see PLATFORM_STRATEGY.md Design Principles).

| # | Workaround | Introduced | Correct Architecture | Trigger for Repair |
|---|---|---|---|---|
| 1 | 🟢 Cultivar OS dashboard tiles — handleNavigate() was an empty stub. Fixed 2026-05-29: qr_checkout → /orders, qb_invoicing → scroll to #qb-section, social_media → /social/setup, delivery → /deliveries. All active tiles now navigate correctly. | Resolved 2026-05-29 | n/a | — |
| 2 | QB integration is hardcoded with `IGNITION_OS_DATA` reference | Pre-2026-05-23 (per Session 1a audit findings) | AccountingAdapter interface per PLATFORM_STRATEGY.md target architecture; vertical-agnostic | When second vertical (KINNA-OS Phase 1) needs QB or alternative accounting connector |
| 3 | Social module lives in cultivar-os/api/, not packages/shared/ | Pre-2026-05-23 (per audit findings, Cultivar-only by accident) | Per PLATFORM_STRATEGY.md target: extract to packages/shared/src/social/ | Before Conduit OS or KINNA-OS need social composer |
| 4 | Hardcoded nursery footer in PlantProfile.tsx line 108 — `LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336` — bypasses the nurseries table row that contains the same data | Pre-2026-05-27 (surfaced by Session K subsystem audit) | Component should read from the nursery object loaded via existing hooks; eliminate the literal string | Before next nursery customer onboarding (would display LAWNS data for the wrong nursery) |
| 7 | orders table had no SELECT RLS policy from May 17 (table creation) until May 27. Dashboard read path uses anon key (subject to RLS); write path uses service key (bypasses RLS). Result: orders saved successfully but were invisible to the dashboard's Today's Sales, Installs, and Leakage metric tiles. Same root cause as modules/nursery_modules bug fixed May 22. | 2026-05-17 (orders table creation) through 2026-05-27 (fix) | Every Supabase table read from the frontend needs at least one SELECT policy for the authenticated role. Currently loose (USING true); will be tightened to owner_id join post-demo per existing pattern. Migration: 20260527_orders_authenticated_select_policy.sql. | Resolved 2026-05-27 (policy applied manually for demo Supabase project; migration committed for future projects). |
| 8 | 🟡 nurseries, plants, plant_events, addons — RLS policies exist on these tables (migrations were run) but authenticated SELECT has never been explicitly confirmed via a frontend read in the bgobkjcopcxusjsetfob project. They work in practice for the demo flow, but "it worked once" is not VERIFIED. Same root cause pattern as #7 has struck three times already. | Pre-2026-05-22 (tables predate project separation; RLS migrations ported but not spot-checked post-move) | Each table needs a confirmed authenticated SELECT verified by watching the frontend read succeed after login — not just a migration in the log. Owner: David. | Before next vertical ships OR on next RLS-related change, whichever comes first. Resolve to 🟢 (spot-check passes) or promote to 🔴 (document the gap and add SELECT policies). |
| 9 | 🟢 `packages/shared/src/ai/AIEngine.ts` EXISTS and is fully implemented. 3 modules in packages/ignition-os/ already import from `@trace/shared/ai/AIEngine` (IgnitionAudit, IgnitionCipher, PredictiveKey). AIEngine.call() fails gracefully — returns `{ ok: false }` on network error, never throws. AI features are non-blocking. | Resolved 2026-05-28 | AI features go live when Vercel serverless functions replace ai_router.py. No Railway dependency. | See Tech Debt #13. |
| 10 | 🟡 `packages/ignition-os/modules/SavingsReport.jsx` is MISSING from the monorepo. The module ID `savings_report` is fully implemented in `AIEngine.ts` → `ai_router.py` (calls Claude Sonnet, analyzes shop job/margin data, returns flagged jobs + recoverable revenue). The React component that displays the output was not migrated from CAI. `IgnitionOmniDashboard.jsx` renders `<SavingsReport />` in the SAVINGS tab — that tab is broken until this component exists. | 2026-05-28 (discovered during web build attempt) | Build `packages/ignition-os/modules/SavingsReport.jsx` — React component that calls `AIEngine.savingsReport(shopId, tier)` and renders the result. The API contract is defined. This is display work, not AI work. | Before next Ignition OS demo or dry run. |
| 11 | 🟢 Ignition OS web build COMPLETE. `packages/ignition-os/` is confirmed canonical source (diff with CAI/ was zero for all business logic). Build infrastructure added: `package.json`, `vite.config.js`, `index.html`, `main.jsx`, `stubs/` (5 files), `IgnitionVIN.jsx` web stub, `PriceField.js` re-export fix. Build verified: 1825 modules, zero errors. `CAI/` is now archive. Vercel project setup instructions documented in Section 2 above. | Resolved 2026-05-28 | n/a | — |

| 12 | 🟡 `CAI/ai_router.py` (Railway FastAPI) was built to keep AI provider keys out of the React Native bundle. Now that Ignition OS is a Vercel web app, this is unnecessary — Vercel serverless functions hold keys server-side, same pattern cultivar-os uses for Claude calls today. Railway is still running but is legacy for the web build. AIEngine.ts currently points to `VITE_API_URL` which is unset in the ignition-os Vercel project — AI features fail gracefully. | 2026-05-28 (decision made) | Port the 11 `ai_router.py` endpoints to TypeScript Vercel functions under `packages/ignition-os/api/`. Then decommission Railway. Exception: `voice_transcribe` sends audio files — Vercel's 4.5MB payload limit needs evaluation before porting that one endpoint. | Before activating AI features in ignition-os web. |
| 13 | 🟡 Vite build aliases for `react-native`, expo packages, and `lucide-react-native` exist in both `CAI/vite.config.js` AND `packages/ignition-os/vite.config.js` — duplicated. The stubs in `CAI/stubs/` and `packages/ignition-os/stubs/` are identical files in two places. | 2026-05-28 | Extract stubs to `packages/shared/stubs/` and reference from both vite configs. Low priority — only matters if stubs need to change. | If stubs ever need updating, deduplicate first. |
| 14 | 🟡 Tailwind CSS is loaded via CDN script tag in `packages/ignition-os/index.html` (`<script src="https://cdn.tailwindcss.com">`). No build dependency, no config, no purging — every Ignition module uses `className="..."` Tailwind utilities (~1923 lines across 27 files + 196 in CoreApp). Cultivar OS uses inline styles only. Shared modules use inline styles (required for Cultivar compat). Result: two styling systems that cannot share UI components without a rewrite. | 2026-05-29 (identified) | Remove CDN script tag + convert all Tailwind classNames to inline styles in Ignition OS modules. ~2100 lines of rework. | When an Ignition module is extracted to `packages/shared/` — convert at that time, not before. Never add new Tailwind `className` usage to any file. |

---

## Shared Extraction Roadmap

Audit completed 2026-05-29. Full findings live in session context. Canonical priority order:

**Immediate (LOW complexity, do next available session):**
- `MarginEngine.js` → `packages/shared/src/business-logic/MarginEngine.ts` (copy-paste ready, no deps)
- `statusColors` utility → `packages/shared/src/utils/statusColors.ts`
- `FormField` component → `packages/shared/src/components/FormField.tsx`
- `ProgressBar` component → `packages/shared/src/components/ProgressBar.tsx`
- `dateHelpers` → `packages/shared/src/utils/dateHelpers.ts`
- `formatCurrency` → `packages/shared/src/utils/formatCurrency.ts`
- `Skeleton` → `packages/shared/src/components/Skeleton.tsx`

**Before KINNA-OS Phase 1 (MEDIUM complexity, required):**
- Trial/Subscription clock → `packages/shared/src/hooks/useTrialStatus.ts` + `TrialProvider.tsx`
- Leakage detector → `packages/shared/src/business-logic/LeakageDetector.ts`
- Module activation hook → `packages/shared/src/hooks/useModuleState.ts`
- OnboardingWizard shell → `packages/shared/src/components/OnboardingShell.tsx`

**Do NOT extract yet:**
- `DataBridge.js` — monolith, too coupled to Ignition mobile/local-first. Extract pieces as needed.
- QB invoice pattern — wait until KINNA-OS accounting requirements are clear.
- CSV importer, hardware registry — Ignition-specific, no cross-vertical need yet.

**Initial entries above are seeded from the Session 1a audit findings and the button audit folded into TRACE_PLATFORM_AUDIT.md in this session (1b). Future entries are added by Claude Code or David whenever Honest Friction surfaces a workaround that is intentionally executed against architectural intent.**

---

## 3. HANDOFF

> Rewritten at the end of every session.
> The next Claude Code session reads this first.

### 2026-05-29 — Ignition OS multi-tenant conversion + Campaign Scheduler

**What was built:**

Ignition OS — multi-tenant BusinessProvider conversion:
- `packages/ignition-os/supabase/migrations/20260529_ignition_businesses.sql` — businesses table, owner_id on shops, business_id on all operational tables, RLS via businesses chain. **Applied ✅ 2026-05-29 (ufsgqckbxdtwviqjjtos)**
- `packages/ignition-os/modules/OnboardingWizard.jsx` — new (was imported but missing). Owner email/password signup → creates businesses + shops rows (shared UUID), seeds DataBridge, marks onboarding complete.
- `packages/ignition-os/main.jsx` — wraps CoreApp in `<BusinessProvider businessType="shop">`
- `packages/ignition-os/CoreApp.jsx` — imports useBusinessContext; adds ownerBusinessId sync effect (new device: auth.uid() → businessId → DataBridge); fixes OnboardingWizard import path to `./modules/OnboardingWizard`

Campaign Scheduler (shared feature, cultivar-only for now):
- `supabase/migrations/20260529_campaigns.sql` — campaigns, campaign_posts, campaign_tone_samples tables + RLS + LAWNS seed data. **Pending: David must run in bgobkjcopcxusjsetfob**
- `packages/shared/src/campaigns/types.ts` + `generate.ts` — shared campaign post generation (claude-sonnet-4-6, tone samples as few-shot examples)
- `packages/cultivar-os/api/campaigns/generate.ts` + `publish-post.ts` — Vercel handlers
- `packages/cultivar-os/src/pages/Campaigns.tsx` + `CampaignDetail.tsx` — full UI
- Dashboard: "Campaign Scheduler" card with green border when drafts pending
- Router: /campaigns + /campaigns/:id behind PrivateRoute
- Tone learning: publish-post auto-saves (original, edited) pairs → feeds future generation

Discovery module fixes:
- synthesis.ts: CRITICAL pain point instruction + two-pass JSON extraction + max_tokens 2000
- DiscoveryInspect.tsx: amber "You told us" echo card at top of results
- website.ts: full Chrome/Mac browser headers, 15s timeout, 429 retry + /about + /about-us fallback

**Build status:** cultivar 2166 modules ✅ · ignition 1828 modules ✅

**⚠️ David — still pending:**
1. ~~Run `supabase/migrations/20260529_campaigns.sql` in bgobkjcopcxusjsetfob~~ ✅ Applied 2026-05-29
2. ~~Add `VITE_DEMO_BUSINESS_ID = a1b2c3d4-0000-0000-0000-000000000001` to Vercel cultivar-os env vars~~ ✅ Added 2026-05-29

**Ignition OS is now correctly structured:**
- owner: email/password Supabase auth → businesses table → businessId
- staff: PIN via DataBridge (unchanged, still works)
- businesses.id = shops.id (same UUID, DataBridge queries shops by ID seamlessly)
- New shop owners: OnboardingWizard creates both rows, seeds DataBridge, marks complete

---

### 2026-05-29 — businesses migration + BusinessProvider + Settings page (multi-tenant Phase 1)

**Decisions made:**
- `businesses` replaces `nurseries` as the universal tenant anchor. `nurseries.id = businesses.id` — same UUID, safe backfill.
- `opportunity_items` table replaces hardcoded `netting_price` field with a generic per-business add-on catalog.
- `nursery_profiles` holds thin vertical-specific config (default_install_price).
- QB token columns generalized: `qb_*` → `accounting_type/token/refresh_token/token_expires_at/needs_reconnect/company_id`.
- `BusinessProvider` lives in `packages/shared/src/context/` — replaces NurseryProvider. NurseryProvider.tsx is now a re-export shim.
- Settings page lives in `packages/shared/src/pages/Settings.tsx` — vertical-specific config injected via `verticalSection` prop.

**What was built:**

SQL Migrations (to run manually in Supabase SQL editor, bgobkjcopcxusjsetfob):
- `supabase/migrations/20260529_businesses_a_create_tables.sql` — creates businesses, nursery_profiles tables + RLS
- `supabase/migrations/20260529_businesses_b_opportunity_items.sql` — creates opportunity_items + RLS
- `supabase/migrations/20260529_businesses_c_add_business_id.sql` — backfills business_id on all operational tables, inserts LAWNS row into businesses, seeds netting as opportunity_item
- `supabase/migrations/20260529_businesses_d_update_rls.sql` — replaces all RLS policies to use business_id; adds UNIQUE(business_id, module_key) on nursery_modules
- `supabase/migrations/20260529_businesses_e_cleanup.sql` — drops nursery_id columns (run ONLY after smoke test passes)

Shared code (new files):
- `packages/shared/src/context/BusinessProvider.tsx` — auth.uid() → businesses table → businessId
- `packages/shared/src/context/index.ts` — exports BusinessProvider, useBusinessContext, Business type
- `packages/shared/src/pages/Settings.tsx` — Business Profile + Accounting + Sales Prompts + verticalSection injection

Cultivar OS updates (all 31+ consumer files):
- `packages/cultivar-os/src/App.tsx` — BusinessProvider businessType="nursery"
- `packages/cultivar-os/src/context/NurseryProvider.tsx` — thin re-export shim
- `packages/cultivar-os/src/hooks/useBusiness.ts` — new hook, queries businesses table
- `packages/cultivar-os/src/pages/Settings.tsx` — wrapper with NurserySection (default_install_price → nursery_profiles)
- All pages/hooks: useNursery() → useBusinessContext(), nurseryId → businessId, nursery_id → business_id queries
- All API handlers: business_id everywhere, businesses table, accounting_* columns

**⚠️ David — pending manual steps (run in this order):**
1. Run migration A in Supabase SQL editor (bgobkjcopcxusjsetfob): `20260529_businesses_a_create_tables.sql`
2. Run migration B: `20260529_businesses_b_opportunity_items.sql`
3. Run migration C: `20260529_businesses_c_add_business_id.sql` — backfills LAWNS data
4. Run migration D: `20260529_businesses_d_update_rls.sql` — brief downtime OK
5. In Vercel cultivar-os project settings → Environment Variables: add `VITE_DEMO_BUSINESS_ID = a1b2c3d4-0000-0000-0000-000000000001`
6. Deploy (git push → auto-deploys via Vercel GitHub integration)
7. Smoke test: login → dashboard loads → QR checkout → QB invoice → orders visible → /settings shows LAWNS data
8. If smoke test passes, run migration E: `20260529_businesses_e_cleanup.sql` (drops nursery_id columns)

**Build status:** Clean — 2163 modules, zero TS errors ✅

**Last files edited this session:**
  supabase/migrations/20260529_businesses_a_create_tables.sql (new)
  supabase/migrations/20260529_businesses_b_opportunity_items.sql (new)
  supabase/migrations/20260529_businesses_c_add_business_id.sql (new)
  supabase/migrations/20260529_businesses_d_update_rls.sql (new — unique index added)
  supabase/migrations/20260529_businesses_e_cleanup.sql (new)
  packages/shared/src/context/BusinessProvider.tsx (new)
  packages/shared/src/context/index.ts (new)
  packages/shared/src/pages/Settings.tsx (new)
  packages/shared/src/quickbooks/refresh.ts (updated — businesses table, accounting_* columns)
  packages/cultivar-os/src/App.tsx (BusinessProvider)
  packages/cultivar-os/src/context/NurseryProvider.tsx (re-export shim)
  packages/cultivar-os/src/types/nursery.ts (Business type export added)
  packages/cultivar-os/src/types/plant.ts (business_id field added)
  packages/cultivar-os/src/hooks/useBusiness.ts (new)
  packages/cultivar-os/src/hooks/useModules.ts (businessId param)
  packages/cultivar-os/src/hooks/useAddons.ts (businessId param)
  packages/cultivar-os/src/hooks/useSubmitOrder.ts (businessId in payload)
  packages/cultivar-os/src/hooks/usePlant.ts (business_id query)
  packages/cultivar-os/src/pages/Settings.tsx (new — wrapper with NurserySection)
  packages/cultivar-os/src/pages/Dashboard.tsx (businessId, Settings button in header)
  packages/cultivar-os/src/pages/SocialSetup.tsx (businessId)
  packages/cultivar-os/src/pages/DeliveryRoute.tsx (businessId)
  packages/cultivar-os/src/pages/Orders.tsx (businessId)
  packages/cultivar-os/src/pages/OnboardingWizard.tsx (writes to businesses + nursery_profiles)
  packages/cultivar-os/src/pages/AddOns.tsx (business_id)
  packages/cultivar-os/src/pages/CartReview.tsx (businessId)
  packages/cultivar-os/src/router.tsx (/settings route added)
  packages/cultivar-os/api/orders/submit.ts (business_id)
  packages/cultivar-os/api/qbo/callback.ts (businesses table, accounting_* columns)
  packages/cultivar-os/api/qbo/auth-url.ts (business_id param)
  packages/cultivar-os/api/qbo/invoice/cultivar.ts (businesses table, dynamic tax_rate + name)
  packages/cultivar-os/api/qbo/status.ts (business_id, businesses table)
  packages/cultivar-os/api/social/generate-posts.ts (business_id)
  packages/cultivar-os/api/social/publish.ts (business_id)
  packages/cultivar-os/api/social/enable.ts (business_id)
  packages/cultivar-os/api/dashboard.ts (business_id, businesses table)

---

### 2026-05-29 — OnboardingWizard, Delivery Routing, Dead Tile Fix

**What was built:**
- `packages/cultivar-os/src/pages/Orders.tsx` (new)
  Last 50 orders, green/red border by leakage_flag, transport icons, customer + amount.
- `packages/cultivar-os/src/pages/OnboardingWizard.tsx` (new)
  5-step first-run experience: WELCOME → NURSERY_SETUP → CHOOSE_PATH → PATH_EXPERIENCE → DONE
  4 paths — LEAKAGE (leakage calculator, annual missed add-on revenue), CHECKOUT (4-slide
  visual walkthrough), SETUP (QB teaser), DELIVERY (demo stops → Google Maps route → SMS).
  finalize() inserts a nurseries row (owner_id = auth.uid()) — **resolves Gap A**.
- `packages/cultivar-os/src/pages/DeliveryRoute.tsx` (new)
  Live at /deliveries. Pulls all pending delivery orders joined with customer addresses.
  Checkbox selection per stop, inline address entry for missing addresses, numbered stops,
  generates Google Maps multi-stop URL. Actions: Open in Maps, Text to Driver (native SMS),
  Copy Route Link.
- `packages/cultivar-os/src/pages/Dashboard.tsx` — handleNavigate fixed (Tech Debt #1 resolved)
  qr_checkout → /orders, qb_invoicing → scroll to #qb-section, social_media → /social/setup,
  delivery → /deliveries. Dead tiles are now live.
- `packages/cultivar-os/src/router.tsx` — added /orders, /deliveries, /onboarding routes
- Dashboard now redirects to /onboarding (replace: true) when nursery resolves with no row,
  instead of showing an error wall.

**Commits this session:**
- ce5745b — Dead tile fix (Orders page + handleNavigate)
- 0720ba8 — OnboardingWizard (4 paths, Gap A resolved)
- 0d09963 — DeliveryRoute + 4th wizard path (DELIVERY)

**All deployed to cultivar-os.vercel.app ✅**

**Tech Debt #1 resolved:** Dashboard tiles no longer flash-and-nothing.
  QR Checkout → /orders ✅, QB → scroll to section ✅, Social → /social/setup ✅, Delivery → /deliveries ✅

**Gap A resolved:** New signups auto-redirect to /onboarding. OnboardingWizard.finalize()
creates the nurseries row. No more "Account not linked" error wall for fresh accounts.

**Open gap (delivery feature):**
  Delivery orders use customer.address_line1 as the delivery address. If a customer didn't
  enter an address at checkout, the route page shows an inline override field (local state only).
  To persist delivery addresses: add delivery_address text column to orders + capture at checkout
  for transport_method = 'delivery'. No migration written yet — defer to post-demo.
  delivery_date column also deferred (orders currently have no scheduled delivery date).

**Last files edited:**
  packages/cultivar-os/src/pages/Orders.tsx (new)
  packages/cultivar-os/src/pages/OnboardingWizard.tsx (new)
  packages/cultivar-os/src/pages/DeliveryRoute.tsx (new)
  packages/cultivar-os/src/pages/Dashboard.tsx (handleNavigate + /onboarding redirect)
  packages/cultivar-os/src/router.tsx (/orders, /deliveries, /onboarding routes)
**Build status:** Clean — 2160 modules, zero TS errors

---

### 2026-05-28 (continued) — Ignition OS web build + Vercel automation

**Decisions made this session:**
- `CAI/` is now archive. `packages/ignition-os/` is the canonical Ignition OS source. Do not edit CAI/.
- `ai_router.py` / Railway is legacy for the web build. AI features will be ported to Vercel serverless
  functions (TypeScript) when needed. Do not set `VITE_API_URL` in the ignition-os Vercel project.
- Vercel GitHub integration is the deployment path going forward. `npx vercel --prod` is retired.
- Both Vercel projects (cultivar-os, ignition-os) deploy from `david-obrien61/trace-platform` on push to main.

**What was built:**
- `packages/ignition-os/` build infrastructure:
  - `package.json` (@trace/ignition-os, web deps only — no expo/react-native packages)
  - `vite.config.js` (react-native-web alias, expo stubs, lucide-react-native → lucide-react, @trace/shared alias)
  - `index.html`, `main.jsx`
  - `stubs/` — empty.js, asyncStorage.js, haptics.js, camera.js, audio.js
  - `modules/IgnitionVIN.jsx` — web stub (camera scanning is mobile-only)
  - `PriceField.js` — re-exports from PriceField.jsx (was empty file, shadowed the component)
- `CAI/` build also restored (same fix pattern) — working but archive
- Root `package.json`: added `build:cultivar` and `build:ignition` scripts
- Root `vercel.json`: build command updated to `npm run build:cultivar`
- Build verified: packages/ignition-os/ — 1825 modules, zero errors
- 14 Ignition OS SQL migrations copied to `packages/ignition-os/supabase/migrations/`
- 9 mobile-only .jsx files renamed to `-delete.jsx` in packages/ignition-os/modules/

**Vercel setup still needed (David):**
- cultivar-os Vercel project → Settings → Git → connect `david-obrien61/trace-platform`, branch `main`
- Create new ignition-os Vercel project → Import same repo → override:
  - Build Command: `npm run build:ignition`
  - Output Directory: `packages/ignition-os/dist`
  - Env vars: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (see Section 2 above)

**Next AI session for ignition-os:**
Port `ai_router.py` endpoints to TypeScript Vercel functions under `packages/ignition-os/api/`.
Start with `dtc_decode` and `estimate_draft` (highest-value, text-only — no vision complexity).

---

### 2026-05-28 — Tenant isolation leak: diagnosis and fix

**Root cause confirmed:** The committed production code hardcoded `DEMO_NURSERY_ID`
(`a1b2c3d4-0000-0000-0000-000000000001`) in 4 frontend files. Every authenticated user —
regardless of identity — was resolved to the LAWNS nursery. Triggered when trace_ent@outlook.com
(no nursery row) logged in and saw LAWNS data ($6,161, 9 plants).

**Files fixed:**
- `packages/cultivar-os/src/context/NurseryProvider.tsx` (NEW)
  Auth-to-nursery resolution: `owner_id = auth.uid()` → explicit error state on 0 rows.
  No fallback. Loud "Account not linked" UI for unmatched users.
- `packages/cultivar-os/src/pages/Dashboard.tsx`
  Removed `DEMO_NURSERY_ID`. Uses `useNursery()` context. Guards: `if (!nurseryId) return`
  in useEffect; `if (nurseryError || !nurseryId)` renders error screen before any data query.
- `packages/cultivar-os/src/pages/SocialSetup.tsx` — uses `useNursery()` context
- `packages/cultivar-os/src/hooks/useSubmitOrder.ts` — `nurseryId` now required in payload
- `packages/cultivar-os/src/hooks/useAddons.ts` — `nurseryId` now a function argument
- `packages/cultivar-os/src/pages/CartReview.tsx` — passes `plant.nursery_id` to submit
- `packages/cultivar-os/src/pages/AddOns.tsx` — passes `item.plant.nursery_id` to useAddons

**RLS migration also committed:**
`supabase/migrations/20260528_per_tenant_rls_isolation.sql`
Replaces all `USING(true)` policies with `owner_id`-scoped expressions on all Cultivar OS
tenant tables. Run manually in Supabase SQL editor before next cross-tenant onboarding.

**Open gap (not fixed here — Gap A):**
Signup does not create a nursery row for new users. New accounts correctly see a "no nursery"
error state after this fix. Nursery creation flow is BUILD-NEW (dedicated session needed).
Until built: manually insert a nurseries row with `owner_id` = new user's UID.

**Deploy status:** NOT YET DEPLOYED. Run `npx vercel --prod` from repo root to ship.

**Last files edited:**
packages/cultivar-os/src/context/NurseryProvider.tsx (new)
packages/cultivar-os/src/pages/Dashboard.tsx
packages/cultivar-os/src/pages/SocialSetup.tsx
packages/cultivar-os/src/hooks/useSubmitOrder.ts
packages/cultivar-os/src/hooks/useAddons.ts
packages/cultivar-os/src/pages/CartReview.tsx
packages/cultivar-os/src/pages/AddOns.tsx
supabase/migrations/20260528_per_tenant_rls_isolation.sql
**Build status:** Not verified locally — deploy to Vercel to confirm.

---

- **Completed this session (prior — May 21-22):** Major infrastructure work May 21-22:
  - Supabase project separation COMPLETE
    cultivar-os now on separate project bgobkjco
    ignition-os project untouched
  - All compliance fixes Groups 1-4 complete
  - Shared auth: configureAuth() factory built
    packages/shared/src/auth/configureAuth.tsx
    Email strategy for cultivar-os
    PIN strategy for ignition-os
  - Tile system extracted from CAI/Ignition OS
    packages/shared/src/components/tiles/TileGrid.tsx
    packages/shared/src/components/tiles/Tile.tsx
    3 states: active / available / locked
  - useModules.ts built — reads from Supabase
  - Dashboard tile grid live and verified on device
  - modules table seeded (10 modules)
  - nursery_modules seeded for LAWNS
  - QB reconnected to new project ✅
  - End-to-end checkout verified on new project ✅
  - QB invoice creation verified ✅
  - Blotato account created, API key in Vercel ✅
  - social_drafts table created ✅

- **Completed this session (May 22 continued):**
  - QB OAuth audit complete — no Grove-OS hardcoding found,
    sandbox→production is env var only (flip QBO_ENVIRONMENT,
    swap client ID/secret). One cosmetic: 'QuickBooks Sandbox'
    fallback string in callback.ts — non-blocking.
  - /privacy page live: cultivar-os.vercel.app/privacy ✅
  - /terms page live: cultivar-os.vercel.app/terms ✅
    Required for Intuit production app approval.
    Both use #27500A / #EAF3DE branding, mention QB integration,
    data storage (Supabase), user rights, contact email.
  - QR Checkout tile state bug FIXED ✅
    Root cause: modules + nursery_modules tables had RLS
    enabled but no SELECT policy for authenticated role.
    Frontend queries returned [] silently.
    Fix: migration 20260522_rls_modules_nursery_modules.sql
    — added authenticated_select_modules and
    authenticated_select_nursery_modules policies.
    No code changes — useModules.ts logic was correct.

- **Completed this session (May 22 — Social Media module COMPLETE):**
  - Social Media module STEPS 1-3 COMPLETE ✅
  - STEP 1: Enable → wizard ✅
    SocialSetup.tsx — platform checkboxes (Instagram, Facebook,
    TikTok, Twitter/X) + Blotato Account ID input
    api/social/enable.ts — upserts nursery_modules enabled+configured
    Social tile: Enable → /social/setup → save → tile goes active
  - STEP 2: Post generation on order complete ✅
    api/social/generate-posts.ts — claude-sonnet-4-6
    System prompt cached via cache_control ephemeral
    Generates 3 posts: educational, customer_story, seasonal
    Writes to social_drafts (status='pending')
    On API failure: writes status='failed', never blocks order
    Guards ANTHROPIC_API_KEY missing — returns ok:false silently
    useSubmitOrder.ts — fire-and-forget after QB call
  - STEP 3: Dashboard pending count badge ✅
    Tile.tsx — amber notification badge (top-left) when count > 0
    Dashboard.tsx — pendingSocialCount state, loadSocialCount(),
    count prop wired to Social tile
    RLS migration: supabase/migrations/20260522_social_drafts_rls.sql
  - STEP 4 (Publish flow): ON HOLD — Blotato API structure confirmed
    POST https://backend.blotato.com/v2/posts
    Header: blotato-api-key: KEY
    Payload: {post: {accountId, content: {text, platform},
             target: {targetType}}}
    Do NOT build until David approves
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅

- **Completed this session (May 22 — social_drafts bug fix):**
  - Root cause diagnosed: generate-posts.ts inserted `generated_at`
    (column doesn't exist), `order_id` (didn't exist), `post_type`
    (didn't exist). Postgres rejected every insert silently.
  - Migration written: 20260522_social_drafts_add_order_post_type.sql
    Adds order_id uuid REFERENCES orders(id) ON DELETE SET NULL
    Adds post_type text CHECK IN ('educational','customer_story','seasonal')
    ⚠️ MUST be run manually in Supabase SQL editor — see pending steps
  - generate-posts.ts fixed:
    Removed generated_at from both inserts (success + failure paths)
    created_at is auto-populated by Supabase — never set manually
    order_id and post_type now correctly included in both inserts
  - No generated_at references remain anywhere in codebase
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅

- **Completed this session (May 22 — social_drafts status constraint fix):**
  - Bug: inserts failing with social_drafts_status_check constraint violation
    Root cause: code inserted status='pending' but social_drafts table
    CHECK constraint only allows 'draft' (not 'pending') as initial state
  - generate-posts.ts fixed: status 'pending' → 'draft' in success inserts
  - Dashboard.tsx fixed: badge count query updated to match
  - social_drafts status lifecycle: 'draft' → 'published' | 'failed'
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅

- **Completed this session (May 22 — Social Media STEP 4 — Blotato publish flow):**
  - STEP 4 COMPLETE ✅
  - api/social/publish.ts — new endpoint
    Accepts: draft_id
    Reads social_drafts row (content, platform)
    Reads nursery_modules.config.blotato_account_id
    POSTs to https://backend.blotato.com/v2/posts
    Header: blotato-api-key (from BLOTATO_API_KEY env var)
    Payload: {post:{accountId, content:{text,mediaUrls:[],platform},
              target:{targetType}}} — platform=targetType='instagram'
    On success: updates status='published', returns postSubmissionId
    On failure: updates status='failed', returns ok:false reason
    Never throws — always 200
  - api/social/publish.ts (root re-export) — wires Vercel routing
  - Dashboard.tsx refactored:
    pendingSocialCount + loadSocialCount() → socialDrafts[] + loadSocialDrafts()
    Single query for both badge count and panel content
    Social Drafts panel: appears below tile grid when drafts exist
    Each draft: post_type chip (Educational/Customer Story/Seasonal)
    Content preview (3-line clamp) + Publish button
    handlePublish(): calls /api/social/publish, removes from list on success
    publishingId state: disables button + shows 'Posting…' during in-flight
    Badge auto-decrements as drafts are published (derived from array length)
  - Blotato API confirmed at help.blotato.com/api/llm.md:
    platform and targetType must match exactly
    Instagram requires no extra fields (no pageId, no privacyLevel)
    Response: { postSubmissionId: uuid }
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅

- **Current tile states:**
  - QR Checkout: active ✅
  - QuickBooks: active ✅
  - Social Media: available → becomes active after setup wizard ✅
  - Online Shop: available
  - Follow-Up: available
  - Delivery: available
  - Contractors/Seasonal/Insights/Inventory: locked

- **Next tasks in order:**
  1. Online Shop (/shop):
     All available plants, filterable
     Same checkout flow
     Delivery radius check at address entry
  3. Mobile responsive fix:
     Tile grid tablet/desktop only (768px+)
     Mobile: core metrics + bottom nav only

- **Completed this session (May 22 — publish status='failed' constraint fix):**
  - Root cause: social_drafts CHECK constraint only allowed 'draft'+'published',
    not 'failed'. Supabase JS returns { error } silently (no throw), so all
    status='failed' writes in publish.ts were dropped without logging.
  - Migration written: supabase/migrations/20260522_social_drafts_add_failed_status.sql
    DROP CONSTRAINT + ADD CONSTRAINT with ('draft','published','failed')
    ⚠️ MUST be run manually in Supabase SQL editor — see pending steps
  - publish.ts: added error logging on all 5 status update calls
    (was: silently ignored; now: logs constraint violations to Vercel logs)
  - Deployed: cultivar-os.vercel.app ✅

- **Last files edited:**
  packages/cultivar-os/api/social/publish.ts (error logging on status updates)
  supabase/migrations/20260522_social_drafts_add_failed_status.sql (new)
- **Last command run:** npx vercel --prod from repo root — deployed ✅
  NOTE: always deploy from repo root (/trace-platform/), not from
  packages/cultivar-os/ — the @trace/shared alias breaks otherwise
- **Build status:** Clean — 2156 modules, zero TS errors

- **Blockers / Notes:**
  - social_drafts schema migration (order_id + post_type columns) NOT yet
    applied in Supabase — generate-posts inserts will fail until David runs it
  - social_drafts status constraint migration NOT yet applied —
    status='failed' writes will still fail until David runs it (see pending steps)
  - ANTHROPIC_API_KEY confirmed in Vercel ✅
  - BLOTATO_API_KEY in Vercel ✅
  - QB tokens stored in nursery.qb_access_token on new project ✅
  - social_drafts status lifecycle: 'draft' → 'published' | 'failed'

- **⚠️ Pending manual steps (David):**
  - ⚠️ BLOCKER #1: Run in Supabase SQL editor (bgobkjcopcxusjsetfob):
    supabase/migrations/20260522_social_drafts_add_order_post_type.sql
    SQL:
      ALTER TABLE social_drafts
        ADD COLUMN order_id  uuid REFERENCES orders(id) ON DELETE SET NULL,
        ADD COLUMN post_type text CHECK (post_type IN ('educational','customer_story','seasonal'));
    THEN test: place order at cultivar-os.vercel.app/plant/SCV-0031
    THEN query:
      SELECT id, post_type, status, content FROM social_drafts ORDER BY created_at DESC LIMIT 10;
    Expect 3 rows: educational, customer_story, seasonal — all status='draft'
  - ⚠️ BLOCKER #2: Run in Supabase SQL editor (bgobkjcopcxusjsetfob):
    supabase/migrations/20260522_social_drafts_add_failed_status.sql
    SQL:
      ALTER TABLE social_drafts DROP CONSTRAINT IF EXISTS social_drafts_status_check;
      ALTER TABLE social_drafts ADD CONSTRAINT social_drafts_status_check
        CHECK (status IN ('draft', 'published', 'failed'));
    Required for publish errors to be recorded — without this, failed
    publishes stay as status='draft' and Lauren can't see what needs attention.
  - Print QR tags: SCV-0031, NCM-0042, MS30-001
  - Print invoice #3648.380
  - Print FOUNDING_CUSTOMER_AGREEMENT.md
  - Print ROI one-pager (to be written)
  - Full demo run-through timed — Sunday
  - Practice Regina story out loud 3 times

- **Completed this session (May 23 — QB token refresh):**
  - QB token refresh COMPLETE ✅ — demo-critical, blocks invoice creation after 60 min
  - Migration: supabase/migrations/20260523_qb_token_expires_at.sql APPLIED ✅
    ALTER TABLE nurseries
      ADD COLUMN qb_token_expires_at timestamptz,
      ADD COLUMN qb_needs_reconnect  boolean NOT NULL DEFAULT false;
  - packages/shared/src/quickbooks/refresh.ts — new server-side shared utility
    refreshQBToken(nurseryId, tokens) — proactive check: refreshes if missing
    or within 10 min of expiry. Writes new token + expires_at back to nurseries.
    Sets qb_needs_reconnect=true and returns null if refresh token is dead.
  - packages/cultivar-os/api/qbo/callback.ts updated:
    Now stamps qb_token_expires_at + qb_needs_reconnect=false on every connect.
    Ensures tokens are always tracked from first OAuth handshake.
  - packages/cultivar-os/api/qbo/invoice/cultivar.ts updated:
    Imports refreshQBToken from shared. Calls it proactively at handler start.
    Returns 503 { error: 'qb_token_expired' } if refresh fails (non-blocking —
    useSubmitOrder.ts catches this; order completes, invoice skipped).
    Removed doRefresh() function and both reactive 401 retry blocks.
    Removed now-unused QBO_CLIENT_ID / QBO_CLIENT_SECRET / QBO_TOKEN_URL constants.
  - packages/cultivar-os/src/pages/Dashboard.tsx updated:
    Reads qb_needs_reconnect from nurseries row in loadMetrics().
    Shows amber warning banner above tile grid when true:
    "QuickBooks needs reconnection — reconnect from the QuickBooks tile above."
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅ (Vercel compiled all 9 API routes cleanly)

- **Completed this session (May 23 — install price bug fix):**
  - Bug: transport='install' never added install_price to cart total
    Root cause: all four calculation points (CartReview, submit API,
    useSubmitOrder email calc, QB invoice builder) ignored install_price.
  - Fix applied across 4 files, no migration needed:
    CartReview.tsx: isInstall + installAmount = install_price × qty;
      added "✓ Installation service · N plant(s)  $225.00" OrderLine;
      plain delivery still shows "✓ LAWNS handling transport — " with dash
    api/orders/submit.ts: installAmount folded into addonsAmount;
      correct subtotal/tax/total written to DB; leakageFlag
      correctly false when install selected (addonsAmount > 0)
    useSubmitOrder.ts: installAmount included in email addonsTotal
    api/qbo/invoice/cultivar.ts: transport='install' → priced QB line
      "Installation service · N plant(s)" at install_price per plant;
      transport='delivery' → keeps existing $0 "LAWNS staff transport" line
  - install_price read from plants.install_price (already in Plant type)
  - SCV-0031 install_price = $225.00 (set in seed data)
  - Build clean: 2156 modules, zero TypeScript errors ✅
  - Deployed: cultivar-os.vercel.app ✅

- **Last files edited:**
  packages/cultivar-os/src/pages/CartReview.tsx
  packages/cultivar-os/api/orders/submit.ts
  packages/cultivar-os/src/hooks/useSubmitOrder.ts
  packages/cultivar-os/api/qbo/invoice/cultivar.ts
- **Last command run:** npx vercel --prod from repo root — deployed ✅
  NOTE: always deploy from repo root (/trace-platform/), not from
  packages/cultivar-os/ — the @trace/shared alias breaks otherwise
- **Build status:** Clean — 2156 modules, zero TS errors

- **Completed this session (May 23 — platform audit):**
  - TRACE_PLATFORM_AUDIT.md written to repo root ✅
    Full 15-area comparison: ignition-os vs cultivar-os vs shared
    Top 10 extract-to-shared priorities identified before Conduit OS
    Full connector inventory + gap-filler registry
    Open questions for Conduit OS documented
    Key finding: OnboardingWizard shell + trial clock + abstract asset model
    are the three most critical extractions before building a third vertical
  - No code changes — audit only

- **Last files edited:**
  supabase/migrations/20260523_qb_token_expires_at.sql (new — applied ✅)
  packages/shared/src/quickbooks/refresh.ts (new)
  packages/cultivar-os/api/qbo/callback.ts (qb_token_expires_at + qb_needs_reconnect)
  packages/cultivar-os/api/qbo/invoice/cultivar.ts (proactive refresh, removed doRefresh)
  packages/cultivar-os/src/pages/Dashboard.tsx (amber reconnect banner)
  CLAUDE.md (this update)
- **Last command run:** npx vercel --prod from repo root — deployed ✅
  NOTE: always deploy from repo root (/trace-platform/), not from
  packages/cultivar-os/ — the @trace/shared alias breaks otherwise
- **Build status:** Clean — 2156 modules, zero TS errors

- **Session ended by:** Claude Code — May 23, 2026

### 2026-05-26 — Session 1a: Doc reconciliation foundation

Completed:
- PART 1: Scope & Hierarchy preambles added to MASTER_BRIEF, PLATFORM_STRATEGY, AUDIT, CLAUDE
- PART 2: Identical TRACE Philosophy paragraph synced across MASTER_BRIEF, PLATFORM_STRATEGY, AUDIT
- PART 3: Pantry OS → KINNA-OS rename across all docs + KINNA-OS identity section added to MASTER_BRIEF
- PART 4: Layna references corrected (now Terry/Lauren) + Key Contacts section in CLAUDE.md
- PART 5: Current Customer State section in MASTER_BRIEF capturing LAWNS, OLH, Ignition OS

Not in this session (Session 1b):
- DISCOVERY_MODULE_BRIEF.md creation
- Surface Honesty principle in PLATFORM_STRATEGY
- Button audit findings fold-in to TRACE_PLATFORM_AUDIT
- BUTTON_AUDIT_DEMO.md → docs/audits/ relocation as dated artifact
- PANTRY_OS.md file rename (confirmed not needed — file does not exist in repo)

Noticed but not touched (log only):
- PLATFORM_STRATEGY.md metadata line "Status: Authoritative — supersedes scattered references
  in all other briefs" is mildly inconsistent with the new four-doc hierarchy. Not load-bearing;
  consider removing or softening in Session 1b.
- "clients" table name in KINNA-OS schema (PLATFORM_STRATEGY.md) directly contradicts the KINNA
  philosophy — people are kinna, not clients. Consider renaming clients → kinna or another option
  in Session 1b. Requires architecture discussion.
- "### KINNA-OS — Food Pantry/Nonprofit" section subtitle in PLATFORM_STRATEGY.md is now
  inaccurate — the vertical covers pastoral care, financial assistance, clothing, dreams, and more
  beyond food. Consider updating subtitle to "Faith-Based and Direct-Service Nonprofits" or
  similar in Session 1b.

Next session: Session 1b (net-new content + button audit + discovery brief).

### 2026-05-26 — Session 1b: Net-New Content Reconciliation

Completed:
- PART 1: DISCOVERY_MODULE_BRIEF.md created (placeholder; detailed UX, question schema, and full build plan deferred to dedicated session)
- PART 2: Surface Honesty AND Honest Friction principles added to PLATFORM_STRATEGY.md (both names provisional)
- PART 3: BUTTON_AUDIT_DEMO findings folded into TRACE_PLATFORM_AUDIT.md as UI Surface State section
- PART 4: BUTTON_AUDIT_DEMO.md relocated to docs/audits/2026-05-25_BUTTON_AUDIT_DEMO.md as dated artifact
- PART 5: KINNA-OS schema clients → people with rationale note
- PART 6: Domain inventory added to CLAUDE.md infrastructure section
- PART 7: Open Architecture Decisions + Tech Debt Log sections added to CLAUDE.md

Decisions locked:
- KINNA-OS approved by Regina O'Brien on 2026-05-26 (name and definition both)
- KINNA-OS person-record table named `people` (not `clients`, not `kinna`, not `kinna_customer`)
- Surface Honesty principle (provisional name) is in force; existing dead-button states are technical debt
- Honest Friction principle (provisional name) is in force; this session enforced it on itself
- Discovery v0 timing: three weeks from 2026-05-26 (pre-Aug-1), scope is Layers 1+4 plus /admin transcript review
- Discovery brief is a placeholder; dedicated session needed for detailed UX, question bank, build plan beyond v0

Noticed but not touched (log only):
- PLATFORM_STRATEGY.md verticalConfig (Part 5) still has `itemLabel: 'Client'`, `itemLabelPlural: 'Clients'`, and `trialReportFocus: 'clients_served_and_units_distributed'` for kinna-os — these are config strings, not table names; flagged per David's instruction, not changed here
- BUTTON_AUDIT_DEMO.md was untracked in git (never previously committed), so PART 4 used `mv` + `git add` rather than `git mv` — functionally equivalent; noted for the record

Next session: TBD. Likely candidates: task inventory + master list, LAWNS prototype Terry-readiness polish, KINNA-OS Phase 1 scoping, or the dedicated discovery session.

### 2026-05-27 — Brand framing update (doc-only session)

Completed:
- MASTER_BRIEF.md: "TRACE Philosophy" block replaced with "TRACE — Who We Are" (family architecture, built with CAI as craft signature, silent partner philosophy as primary)
- MASTER_BRIEF.md: "What We Are" subsection updated to match new framing
- MASTER_BRIEF.md: PART 1.5 — THE OPERATING MODEL added (Velocity as Evidence, Geographic Freedom, Resilience)
- MASTER_BRIEF.md: Changelog entry added; version bumped to v3
- PLATFORM_STRATEGY.md: Same "TRACE — Who We Are" block synced
- PLATFORM_STRATEGY.md: PART 1 paragraph updated (beachhead now nursery vertical, Built with CAI as craft signature)
- PLATFORM_STRATEGY.md: `### KINNA-OS — Food Pantry/Nonprofit` → `### KINNA-OS — Faith-Based and Direct-Service Nonprofits` (resolves Open Architecture Decision #4)
- DISCOVERY_MODULE_BRIEF.md: Same "TRACE — Who We Are" block synced (replaces the "Inherited from…" placeholder reference)
- CLAUDE.md Open Architecture Decisions: Item #4 resolved and removed; item #7 added (family member sign-off on role descriptions pending)

Decisions locked:
- "TRACE — Who We Are" is the canonical name for the philosophy/identity block across all docs, replacing "TRACE Philosophy"
- Built with CAI is positioned as craft signature, not the company name — TRACE is the company
- Silent partner framing is the primary commercial pitch positioning
- Family architecture (Terrence, Regina, Andrew, Connor, Erin) is in the canonical docs
- KINNA-OS subtitle in PLATFORM_STRATEGY.md is now "Faith-Based and Direct-Service Nonprofits" — decision #4 resolved

Pending:
- Family member personal sign-off on their individual descriptions in "TRACE — Who We Are" before any external publication (tracked as Open Architecture Decision #7)

### 2026-05-27 — Session K / Session I / Session L: Subsystem audit, founding timeline, MASTER_BRIEF corrections, LAWNS data ingestion

Completed:
- Session K (pre-LAWNS subsystem verification audit) completed; report at docs/pre-lawns-subsystem-audit-2026-05-27.md. GO-WITH-CAVEATS verdict. HIGH-3 finding (QB sandbox) overturned by Vercel inspection — env is production. Customer dedup confirmed working (TRACE_PLATFORM_AUDIT.md line 135 is stale and should be refreshed).
- Session I (founding timeline audit) completed; report at docs/trace-founding-timeline-2026-05-27.md. Earliest verifiable TRACE timestamp: GitHub account creation April 11, 2026. Cultivar OS feature-complete in 5 calendar days (May 18 first commit → May 22-23 demo-hardened). Ignition OS status corrected to "feature-complete, development paused."
- Session L (MASTER_BRIEF factual corrections) completed; velocity numbers, Ignition status, founding doc reference all updated.
- Nurseries row for LAWNS populated with real data sourced from LAWNS website ingestion (lawnstrees.com). Placeholder values (fake phone, fake Layna email, wrong address) replaced. Address corrected from "Honey Comb Mesa" to "Honeycomb Mesa" matching the LAWNS site spelling. Website populated. Email remains null pending direct input from Lauren or Terry during onboarding.
- LAWNS website ingest JSON saved to docs/customer-ingests/lawns-ingest-2026-05-27.json — captures full structured data plus stale-content observations (October 2025 most recent news post, 2024 year references, 2019 copyright) to inform onboarding conversation.
- Dry-run demo of Cultivar OS surfaced a HIGH-risk demo bug: dashboard "Today's Sales" tile showed 0 after a successful test order. Investigation (docs/dashboard-today-sales-investigation-2026-05-27.md) identified missing SELECT RLS policy on orders table — same pattern as the May 22 modules/nursery_modules fix. Applied policy manually in Supabase SQL editor; committed migration file 20260527_orders_authenticated_select_policy.sql for future projects. Verified fix on both demo machines.

---

## 4. ACTIVE TASKS

### ✅ DEMO CRITICAL — ALL COMPLETE

- [x] US-001: QR scan → plant profile ✅
- [x] US-002: Growth timeline ✅
- [x] US-003: Quantity selector ✅
- [x] US-004: Netting prompt (red border, pre-checked) ✅
- [x] US-006: Cart review (8.25% tax) ✅
- [x] US-007: Customer capture ✅
- [x] US-008: QB invoice auto-creation ✅
- [x] US-009: Confirmation screen ✅
- [x] US-010: Leakage flag ✅
- [x] US-011: Owner dashboard ✅
- [x] US-012: Leakage alert tile ✅
- [x] Supabase project separation ✅
- [x] Tile system live on device ✅
- [ ] QR codes printed: SCV-0031, NCM-0042, MS30-001
- [ ] Full demo run-through timed under 5 min
- [ ] Mobile tested — all screens

### 🔴 BUILDING THIS WEEK (before meeting)

- [x] Fix QR Checkout tile state bug ✅ (RLS migration May 22)
- [x] Social Media module Steps 1-3 ✅ (wizard, post gen, count badge)
- [x] Social Media Step 4 — Blotato publish flow ✅
- [x] QB token refresh — proactive, never blocks orders ✅ (May 23)
- [x] Dead tile navigation fix ✅ (handleNavigate — May 29)
- [x] Delivery routing MVP ✅ (/deliveries page + 4th wizard path — May 29)
- [x] OnboardingWizard (4-path first-run experience) ✅ (May 29)
- [ ] Online Shop (/shop page)
- [ ] Customer follow-up engine
- [ ] Mobile responsive fix (tile grid desktop only)

### 🟢 POST-DEMO (Phase 1 — after signing)

- [ ] Settings page: Lauren can set default install price at nursery level
      (nurseries.default_install_price column + /settings UI)
      Install price currently hardcoded per plant in seed data at $225
- [ ] Per-plant install price override on plant detail page
      (plants.install_price editable in plant profile UI)
- [ ] Tighten nursery_modules RLS policy — replace
      authenticated_select_nursery_modules with owner_id join:
      EXISTS (SELECT 1 FROM nurseries WHERE id = nursery_id
        AND owner_id = auth.uid())
      Requires: populate nurseries.owner_id first
- [ ] Populate nurseries.owner_id for LAWNS row
      (currently NULL — blocks owner-scoped RLS)
- [ ] Contractor tier management
- [ ] Seasonal perishable module
- [ ] Business insights tile
- [ ] Measure & photo intake
- [ ] configureAuth() vertical wrapper
- [ ] verticalConfig.ts master switch
- [ ] Separate Supabase project for ignition-os
- [ ] SOS amendment filed
- [ ] builtwithcai.com product page live
- [ ] Calendly booking link set up

---

## 5. WHAT'S BUILT — SHARED MODULES

```
packages/shared/src/
  auth/
    configureAuth.tsx    ✅ factory — email + PIN strategies
    index.ts             ✅
  components/
    Button.tsx           ✅
    Card.tsx             ✅
    Badge.tsx            ✅
    LockedOverlay.tsx    ✅
    tiles/
      TileGrid.tsx       ✅ extracted from CAI
      Tile.tsx           ✅ 3 states
  notifications/
    send.ts              ✅
    queue.ts             ✅ sendSilently
    templates/
      cultivar.ts        ✅ order_confirmation
  qr/
    generate.ts          ✅
    print.ts             ✅
  supabase/
    client.ts            ✅
    auth.ts              ✅ (PIN — ignition-os)
    types.ts             ✅
  quickbooks/
    oauth.ts             ✅ (known: IGNITION_OS_DATA hardcoded — browser-side only)
    refresh.ts           ✅ refreshQBToken() — server-side, proactive token refresh
    invoice.ts           ✅
    customer.ts          ✅
```

---

## 6. STRICT CODING GUIDELINES

1. Never edit existing migrations — append only
2. No placeholder code — fully functional or documented
3. UI system:
   - Primary: #27500A (forest green)
   - Background: #EAF3DE (sage)
   - Netting prompt: #A32D2D border, amber bg
   - Buttons: 48px min height, full-width mobile
   - No web fonts, no animations
4. Never hardcode URLs, keys, or localhost
5. Database writes: always handle errors
6. Integration failure never blocks an order
7. Tile grid: desktop/tablet only (768px+)

---

## 7. OFF LIMITS THIS SESSION

- packages/ignition-os/ — DO NOT MODIFY
- packages/shared/src/quickbooks/oauth.ts
  (IGNITION_OS_DATA hardcoding — post-demo fix)
- packages/shared/src/supabase/auth.ts
  (PIN auth — post-demo refactor)
- Old Supabase project ufsgqckbxdtwviqjjtos
  — never reference in cultivar-os code
- Any already-run Supabase migrations
- nursery_modules RLS policy authenticated_select_nursery_modules
  (intentionally loose — allows any authenticated user to read;
  tighten to owner_id join post-demo once nurseries.owner_id
  is populated. See Part 4 post-demo tasks.)

---

## 8. APP PHILOSOPHY

Golden Rule: If it takes more steps than writing on paper,
nursery staff won't use it.

The Regina Rule: Every add-on that can only be applied at
planting time must have urgency copy. The system closes
the gap that cost Regina a 40-minute drive home.

Lauren's ROI: 29 hours/month in manual work eliminated.
$149/month cost. Net benefit: $1,906/month month 1.

---

## 9. END-OF-SESSION PROTOCOL

MANDATORY before ending every session:

1. Update Part 3 (Handoff) in CLAUDE.md
2. Update Part 4 (Active Tasks) — check completed
3. Update Part 7 (Off Limits) — clear old, add current
4. Confirm no hardcoded URLs or keys in new code
5. git add CLAUDE.md
6. git commit -m "Update CLAUDE.md — [date] [what was built]"
7. git push
8. Write 3-sentence plain English summary

---

## 10. SESSION STARTER

Paste this at the start of every Claude Code session:

```
Read CLAUDE.md before we begin.

Current session: [describe task]
Today's goal: [specific deliverable]

Before writing any code confirm:
1. What was completed last session (from Handoff)
2. What shared modules this session needs
3. Those modules exist in packages/shared/src/

Do not start until you confirm all three.
Do not touch ignition-os, old Supabase project,
or QB oauth.ts.
```

---

*TRACE Enterprises · Built with CAI*
*cultivar-os.vercel.app · builtwithcai.com*
*(512) 456-3632 · david@trace-enterprises.com*
*Update this file every session. No exceptions.*
