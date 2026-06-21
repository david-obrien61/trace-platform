# CLAUDE.md — TRACE Platform
# Multi-AI Handoff Workflow — Claude Code reads this every session
# Last updated: 2026-06-13 (THUNDER VERIFY-GATE: schema verification gate added to end-of-session-protocol.md + CLAUDE.md §9; 4-table catalog-backed verification run against business_assets/business_inventory/business_pmi_schedule/business_service_log)
# Current AI: Claude Code

---

## CONTEXT BUDGET CHECK — run THIS FIRST, before reading anything else

1. **CLAUDE.md size:** If this file exceeds ~600 lines, FLAG to David before proceeding:
   > "CLAUDE.md is [N] lines — it may be filling context on load. Recommend trimming
   > handoff history to docs/handoff-archive.md before we proceed."
   Do NOT silently push on.
2. **Working files:** Before opening any file to read or edit, note its line count first.
   If >~600 lines, read in chunks (`offset`/`limit`) — never load a large file whole.
   Flag files >~800 lines per the file-size rule in §9.
3. **Build logs / install output:** Never dump full output into context. Use targeted reads
   and summarized output only.
4. **Repeated auto-compaction:** If you notice it happening, STOP and tell David which
   file or output is oversized rather than pushing through — thrashing wastes the session.

Context is finite space, not compute. Read narrowly; flag early.

---

## SESSION HEALTH CHECK — run at session open, before any code or docs

```bash
date                          # 1. Verify today's date — update memory/currentDate if stale
git branch --show-current     # 2. Confirm branch (main or feature branch as appropriate)
ls PLATFORM_STATE.md          # 3. Must exist at repo root — if missing, stop and tell David
git status --short            # 4. Flag any ?? untracked files before starting work
head -4 docs/built-inventory.md  # 5. Check 'Last updated:' — if older than latest capability commit, FLAG as stale
head -2 docs/inventory-functions.md docs/inventory-env.md docs/inventory-ai.md  # 6. Check inventory doc dates — FLAG stale if older than latest commit touching their domain
```

**Rules:**
- **Date ≠ memory/currentDate** → update `~/.claude/projects/-Users-terrenceobrien-Desktop-trace-platform/memory/` before proceeding — stale dates corrupt commit messages and handoff entries.
- **PLATFORM_STATE.md missing** → do NOT write any code; report to David before proceeding.
- **`??` files in git status** → report them to David; sort before starting code work.
- **Reread ⛔ LAUNCH GATES** in PLATFORM_STATE.md every session — never cross a gate without David's explicit direction.
- **`built-inventory.md` Last updated older than latest capability commit** → FLAG as stale before using it to answer "was X built?" — re-audit is the cost of a stale index.
- **Inventory docs stale** → any of `docs/inventory-functions.md`, `docs/inventory-env.md`, `docs/inventory-ai.md` older than the latest commit touching its domain → FLAG before answering questions from it.

---

> CRITICAL: Read this entire file before touching any code.
> Update the Handoff section (Part 3) before ending every session.
> Update GEMINI.md with the same changes if Gemini is in use.

---

## Scope & Hierarchy

This document owns session-by-session handoff state, current infrastructure specifics, and the active task list. Read this first at the start of every Claude Code session.

When this doc conflicts with another:
- For verified current state of every platform item (LEVEL + LOCATION + EVIDENCE), see PLATFORM_STATE.md — read this first every session before writing any code
- For strategy, demo plan, or revenue questions, see MASTER_BRIEF.md
- For architecture or where things should live, see PLATFORM_STRATEGY.md
- For what's actually built in code, see PLATFORM_AUDIT.md
- For the discovery module, see DISCOVERY_MODULE_BRIEF.md (created Session 1b)
- For engineering standards (STD-001 through STD-010 + BENCH-A, BENCH-C, BENCH-D), see STANDARDS.md
- For reuse ratio figures, see PLATFORM_AUDIT.md "Reuse ratio — corrected ground truth (2026-05-28)"; the 68/78/80% figures cited in prior sessions are retired.

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

## 1.5. ARCHITECTURE CONSTANTS (Enforcement Hook)

Full text lives ONLY in PLATFORM_STRATEGY.md § Architecture Constants. Check it before any schema, RLS, route, or shared-identifier change. One-line summaries for quick reference:

- **AC-1:** No vertical nouns in shared schema/code. Vertical identity is a value (`business_type`), never a table name, column, or identifier.
- **AC-2:** RLS scoped to `business_id` membership by default. Looser policy requires WHY + Exception Log entry in PLATFORM_STRATEGY.md.
- **AC-3:** Tenant isolation absolute — cross-vertical resolution returns no-access, never a wrong-vertical record.
- **AC-4:** Structural design shared; only tokens (color) and vocabulary vary per vertical.
- **AC-5:** One integration = one connector = one router. Cross-integration routers forbidden (Alan Effect). Consolidate-when-touched for existing violations; log accepted deviations in `decisions/override-log.md`.

**Known open violations (audit 2026-06-04 — tracked in Active Tasks §Noun Purge):**
- AC-1: ~~`nursery_modules`~~ ✅ resolved 2026-06-04 · `nursery_profiles` table name · `nurseryName` in `qr/print.ts` · `shopId`/`shop_id` in `AIEngine.ts`
- AC-2: Some RLS policies are `USING(true)` — documented intentional, post-demo tighten
- AC-4: Cultivar green `#27500A` default in shared UI primitives (post-August 2026)
See `docs/audits/platform-naming-vertical-leak-audit-2026-06-03.md` for full inventory.

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
  Tables: ⚠️ This list is a quick-reference only — it is stale.
          Canonical per-table state (LEVEL + LOCATION + EVIDENCE): PLATFORM_STATE.md.
          Confirmed tables (2026-06-13 audit + THUNDER UNTANGLE):
          nurseries, cultivar_plants, plant_events, orders,
          order_items, order_addons, addons, losses,
          customers, social_drafts, modules,
          business_modules, receipts,
          business_assets, business_inventory,
          business_pmi_schedule, business_service_log,
          businesses, business_members, platform_config
          ⚠️ Diffs vs prior list: businesses/business_members/platform_config were MISSING.
          nursery_modules still EXISTS (pending DROP — see PLATFORM_STATE.md IN-FLIGHT).
  Auth: email/password, email confirmation OFF
  ⚠️ WHY OFF: outbound mail not working (Supabase default SMTP rate-limited /
     unreliable — verification emails were not being delivered). Confirmation
     was disabled pre-2026-06-11 (exact date unknown) so that signup works
     while mail is broken. Account creation currently works ONLY because
     confirmation is off.
  ⚠️ LAUNCH GATE: fix SMTP (Resend/SendGrid/Postmark) → then re-enable
     confirmation. These are COUPLED — turning confirmation on with broken
     mail means signup can't complete. Mail FIRST, then confirmation.
     Tied to same trigger as abuse guards: first paying customer / public
     self-serve. See PLATFORM_STATE.md LAUNCH GATES.

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

Full log (entries #1–#28): **[docs/tech-debt-log.md](docs/tech-debt-log.md)**

Quick-reference status: 🟢 = resolved · 🟡 = open · (#) = entry number

Active open items: #2 (QB hardcode), #3 (social in cultivar), #4 (nursery footer), #8 (RLS unverified), #10 (SavingsReport missing), #12 (Ignition AI dark / Railway kill path), #13 (stub duplication), #16 (MarginEngine orphaned — A callers + plants.cost_price), #17 (dead migration), #18 (pin_hash unverified), #19 (instagram fallback), #20 (platform union), #21 (orphaned campaigns files), #22 (platform_check migration — David must apply), #23 (STD-008 inverse sweep pending), #24 (opaque names), #25 (6 AI features dark), #26 (orphaned DataBridge keys), #27 (10 tables no migrations), #28 (pilot_all RLS open), #29 (receipts naming), #30 (voice-samples RLS scope), #31 (catalog-verify process), #32 (cultivar_plants anon read open), #33 (widget-header backfill), #34 ✅ resolved 2026-06-19 (qbo/status+auth-url 500 → router.ts:15 import depth 4x→3x, commit 14a9a82; esbuild-proven) · #35 ✅ resolved 2026-06-15 (nursery_profiles 406 → maybeSingle) · #36 (/assets + /pmi nav-dead) · #37 (PMI UI polish pass) · #38 (frictionless multi-channel cost capture — NEXT MAJOR BUILD after Core-2b; capture≠classification, hard-blocked on Core-2b sameCost dedup) · #39 (live schema not in version control — orders/customers/order_items + qb/leakage/netting cols live-only) · #40 (built-inventory flag correction — 5.1 inventory / 5.2 PMI are resolved, not ⚪) · #41 (Vercel Hobby 12-function ceiling — `api/` at limit; new functions silently fail deploy; mitigated by folding deliveries→customers; upgrade to Pro before next module wave) · #42 ✅ resolved 2026-06-21 (seed.ts D-9 silent coercion — `classifyCategory` flags unknown instead of masquerading as 'addon'; price 0 → explicit flagged non-null placeholder; residual: nullable price needs a `service_offerings` ALTER)

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

**Initial entries above are seeded from the Session 1a audit findings and the button audit folded into PLATFORM_AUDIT.md in this session (1b). Future entries are added by Claude Code or David whenever Honest Friction surfaces a workaround that is intentionally executed against architectural intent.**

---

## 3. HANDOFF

> Rewritten at the end of every session.
> The next Claude Code session reads this first.

### 2026-06-20 — THUNDER ROOT CAUSE = VERCEL 12-FUNCTION CEILING (silent failed deploy) → consolidated deliveries→customers (≤12) → DEPLOY VERIFIED LIVE IN PROD (owner-proof owed)

**Type:** Diagnosis (live-bundle proof) + endpoint consolidation + 2 function-file deletions + tech-debt #41 + built-inventory. NO schema change (deliveries + service_type already applied/proven). `[TRACE:*]` STAYS ON. Commit **`a6cb831`** (pushed) → **Vercel deploy VERIFIED READY in prod** (not just "dashboard shows commit").

**THE REAL ROOT CAUSE (supersedes the earlier "stale deploy, just redeploy" framing — that was directionally right but missed WHY it wouldn't deploy):** `253cf49` added `api/deliveries/create.ts` as the **13th** serverless function. **Vercel Hobby caps a deployment at 12 functions** → every deploy from `253cf49` on FAILED the build silently, and Vercel kept serving the last-good bundle (`6ae67a6`, Wave-2, 12 functions). **PROVEN, not asserted:** fetched the live `cultivar-os.vercel.app` bundle (`index-CybYTDPV.js`) and grepped — OLD "delivery date on this invoice" copy present, NEW "ship-to address"/`service_type`/`Scheduled Deliveries` ABSENT. That bundle = pre-`253cf49`. (Also found `cultivar-os.app`/`.com` are registrar parking landers — the real surface is `cultivar-os.vercel.app`.) The toggle code was ALWAYS correct (functional since `253cf49`, no "coming" badge); nothing front-end was unwired.

**FIX (Option A — consolidate to ≤12):** folded `api/deliveries/create` INTO `api/customers/create` — ONE "resolve customer (+ optional `delivery` block)" call. Deleted `api/deliveries/create.ts` + root shim. **Function count 13 → 12** (`campaigns, customers/create, dashboard, discovery/ingest, members/invite, orders/submit, pmi/suggest, qbo-connector, qbo/invoice/cultivar, receipts/ocr, social/enable, social/generate-posts`). `ReceiptKeeper.doSave` now makes ONE fetch with an optional `delivery` block. **No-double-create is now STRUCTURAL** (one call → one customer → at most one delivery; the endpoint never resolves a 2nd customer). service_type + migration-window fallback preserved.

**BUILDER-COMPLETE + DEPLOY VERIFIED:** build clean (2203 modules); changed files tsc-clean; consolidated-flow service-key proof **5/5** (call1 creates customer+delivery; call2 reuses SAME customer = no dup; exactly 1 customer row; deliveries linked + service_type=planting; cleanup). **Live-bundle proof AFTER deploy:** new bundle `index-IMtmeNHW.js` serves — `ship-to address on this invoice` =1, `delivery_only` =2, `Scheduled Deliveries` =1, OLD coming copy =**0**. Prod NOW actually has the delivery loop. **Tech-debt #41 logged** (Hobby 12-fn ceiling; new functions silently fail deploy; upgrade to Vercel Pro before Online Shop / Follow-Up Engine).

**OWED — David's OWNER-PROVE on phone (should FINALLY be live — prod has the code now):** snap Marcus Webb invoice → "Schedule delivery" is LIVE (no "coming") → service type inferred + correctable → confirm → Marcus Webb under **Jun 25, 2026** with service_type badge in the day view → "Route this day" plots. Until owner-proven, `[TRACE:DELIVERY]` stays ON.

### 2026-06-20 — THUNDER DELIVERY TOGGLE DIAGNOSIS (= STALE DEPLOY, not unwired) + service_type (planting vs delivery_only) added (BUILDER-COMPLETE, migration GATED, owner-proof owed)

**Type:** Diagnosis + 1 migration (APPLIED + catalog-proven this session) + verify-script extension + 3 code edits (ReceiptKeeper, deliveries/create endpoint, DeliverySchedule) + built-inventory. **MIGRATION `20260620_deliveries_service_type.sql` APPLIED** (David applied + PAT → verify 17/17 → PAT revoked) → schema gate (G) SATISFIED. NO other table touched. `[TRACE:*]` STAYS ON. Commit **`634b990`** (pushed). **Only deploy-confirm + phone owner-proof remain.**

**DIAGNOSIS (owner saw "Schedule delivery — coming" on phone) — it was a STALE DEPLOY, NOT an unwired front-end.** The toggle was ALREADY functional in `253cf49`: `ReceiptKeeper.tsx:988-1003` is a live checkbox with **no "coming" badge** (only "Analyze sale" carries it, line 1008); `doSave` (`:498-532`) calls `/api/deliveries/create` with the resolved customer id. The endpoint + table are live (14/14 last session). ⇒ the phone hit a Vercel bundle predating 253cf49. **A fresh deploy of `main` fixes the "coming" badge.** This commit (634b990) forces that redeploy AND ships the genuinely-new service_type work.

**service_type (the net-new piece):**
- **Schema (APPLIED + PROVEN):** `ALTER TABLE deliveries ADD COLUMN service_type text` (nullable, NO CHECK, AC-4). Append-only. `verify-deliveries.mjs` **17/17 GREEN** incl. **(G)** service_type text/nullable/no-CHECK + round-trip persists `service_type:'planting'`. Marcus Webb e2e **5/5** (inference→no-double-create→delivery svc=planting linked→day view [planting]→cleanup).
- **Inference (`ReceiptKeeper.tsx` `inferServiceType`):** INSTALL/WARRANTY/plant line → `'planting'`, else `'delivery_only'`. Set on OCR from `ocrLines`. Confirm screen shows a correctable `<select>` (when Schedule delivery checked), default = inference (D-9). `[TRACE:DELIVERY] serviceType set`.
- **Endpoint (`packages/cultivar-os/api/deliveries/create.ts`):** writes `service_type`; **migration-window-resilient** — on 42703/PGRST204 (column missing) retries WITHOUT it so delivery creation never breaks before the column applies (honest debt, logged; remove fallback once (G) green).
- **Day view (`DeliverySchedule.tsx`):** service_type badge (planting=blue / delivery_only=green).

**BUILDER-COMPLETE proofs:** `build:cultivar` clean (2203 modules); changed files tsc-clean; regression `verify-customer-upsert.mjs` **7/7 PASS** (no double-create preserved — customer resolved once, that id reused for the delivery; delivery endpoint never creates a customer). "Analyze sale" stays honestly "coming". Migration gated-state confirmed (service_type absent pre-apply).

**DONE THIS SESSION (schema gate (G) closed):** migration applied + `verify-deliveries.mjs` **17/17 GREEN** + Marcus Webb e2e **5/5 GREEN**. PAT revoked.

**OWED — the last two bars (David):** (1) confirm Vercel deployed `main` ≥634b990 — **this is what clears the stale "coming" badge on the phone**; (2) **OWNER-PROVE on phone:** snap Marcus Webb invoice → "Schedule delivery" is LIVE (no "coming") → service type inferred + correctable → confirm → Marcus Webb under **Jun 25, 2026** with service_type badge in the day view → "Route this day" plots. Until owner-proven, `[TRACE:DELIVERY]` stays ON.

### 2026-06-20 — THUNDER DELIVERY LOOP CLOSED: OCR invoice → scheduled delivery → day view → existing route map (BUILDER-COMPLETE, schema GATED, owner-proof owed)

**Type:** 1 migration + 1 verify script + 1 new endpoint (+root shim) + 1 new page + 3 edits (ReceiptKeeper, DeliveryRoute, Dashboard, router) + built-inventory. **MIGRATION APPLIED + CATALOG-PROVEN this session** (David applied + minted PAT → verify 14/14 → PAT revoked) → schema-verification gate SATISFIED. NO existing table altered. `[TRACE:*]` STAYS ON (standing owner instruction — Part 7). Commit **`253cf49`** (code) / **`f141e25`** (handoff), pushed. This flips the OCR-router's "Schedule delivery — coming" badge to FUNCTIONAL — the moment the reader becomes a doer. **Only owner-proof on phone remains.**

**B1 — SCHEMA (APPLIED + CATALOG-PROVEN):** `supabase/migrations/20260620_deliveries.sql` — new `deliveries` table: id, business_id (NOT NULL FK→businesses CASCADE), customer_id (FK→customers **ON DELETE SET NULL**), delivery_date (date), address_line1/city/state/zip (text), status (text **NOT NULL DEFAULT 'scheduled', NO CHECK** per AC-4), source, notes, created_at + `deliveries_business_date_idx (business_id, delivery_date)` + membership-scoped RLS (`deliveries_owner_all` + `deliveries_member_all`, AC-2/AC-3). **Catalog gate `scripts/verify-deliveries.mjs` 14/14 GREEN** (A) table exists, (B) columns+types, (C) FKs (customer SET NULL / business CASCADE), (D) RLS+rowsecurity, (E) status default+NO-CHECK, (F) day index + round-trip insert. David applied in SQL editor + minted PAT → verified → **PAT revoked**.

**B2 — WRITE PATH (OCR → delivery, no double-create):** the router's "Schedule delivery" is now a live checkbox (was disabled/"coming"). In `ReceiptKeeper.tsx` `doSave`, the customer is resolved **ONCE** (`resolvedCustomerId` from `/api/customers/create`) and that exact id is passed to new endpoint **`api/deliveries/create.ts`** (+cultivar impl, service-key) which **never calls findOrCreateCustomer** → one customer, one delivery, linked (no-double-create by construction). Scheduling implies a customer: the checkboxes are coupled (schedule→on forces add-customer; add-customer→off clears schedule). Delivery uses ship-to (falls back bill-to) address + the ISO delivery_date (the cb3d735 date fix). `[TRACE:DELIVERY]` emits create/customer-link/date.

**B3 — DAY VIEW:** `src/pages/DeliverySchedule.tsx` (`/delivery-schedule`) — scheduled deliveries grouped by delivery_date, soonest day forward (undated last; local-midnight parse so the day label never slips a TZ boundary). Each day shows "Thursday, Jun 25, 2026 — N stops" + a **"Route this day →"** button. Reachable from the dashboard: the `delivery_routing` tile was repointed `/deliveries`→`/delivery-schedule` (both handleEnable + handleNavigate). Empty state links to `/receipts`. Legacy cart-order routing still reachable via a footer link.

**B4 — ROUTE (REUSED, not rebuilt):** `DeliveryRoute.tsx` gains a `?date=YYYY-MM-DD` branch — loads the `deliveries` table for that day, maps each row into the existing `DeliveryOrder` shape (delivery address surfaced via the synthetic `customers` object), and builds the route via the **EXISTING `buildMapsUrl` (DeliveryRoute.tsx:37)** + existing route UI/buttons. **The cart-order path (no `date` param) is unchanged** (regression-safe; header/back adapt to date mode). buildMapsUrl confirmed REUSED, not rebuilt.

**SCOPE FENCE held:** NO live tracking, GPS/telematics, dispatch board, route optimization, stop re-sequencing, or add-a-stop. Loop closes at: delivery exists with a date → shows under its day → plots on the existing map.

**BUILDER-COMPLETE proofs:** `build:cultivar` clean (2203 modules, +2); new files (DeliverySchedule, deliveries/create) **tsc-clean** — full tsc shows ONLY pre-existing errors (Confirmation/Orders/SocialSetup + the DeliveryRoute orders-path cast that existed at HEAD line 82), **zero new**. **Regression (e):** `verify-customer-upsert.mjs` **7/7 PASS** — both invoice→customer (ocr-invoice) and cart→customer (qr-scan) paths still create/resolve (findOrCreateCustomer + customers/create untouched). **No-double-create:** guaranteed by construction (customer resolved once → exact id to delivery; delivery endpoint never creates a customer).

**DONE THIS SESSION (schema gate closed):** migration applied + `verify-deliveries.mjs` **14/14 GREEN** + Marcus Webb end-to-end service-key proof **6/6 GREEN** (resolve customer twice → ONE created / second REUSES = no-double-create → exactly 1 row → delivery 2026-06-25 Wimberley linked → day-view groups under Jun 25, 2026 → cleanup). PAT revoked.

**OWED — David's OWNER-PROVE on phone (the last bar):** snap the Marcus Webb invoice → check "Schedule delivery" → confirm → Marcus Webb lands under **Jun 25, 2026** in the day view → "Route this day" plots the stop on the Google Maps URL. Until owner-proven, `[TRACE:DELIVERY]` stays ON.

**NEXT (fast-follow, NOT this build):** add-a-stop / reroute; surface scheduled deliveries + cart-order deliveries in one unified day view; delivery status transitions (out_for_delivery → delivered).

### 2026-06-19 — THUNDER RECON: "scheduling widget" contradiction resolved — NO delivery scheduler exists (read-only)

**Type:** RECON ONLY — read-only, no schema/code/migration/build → schema-verification gate N/A, no BUILT-INVENTORY change. `[TRACE:*]` STAYS ON (standing owner instruction — Part 7). Sole question: David said "we have the scheduling widget in the build"; the capability recon (e508455) flagged scheduling (3.4) NET-NEW + delivery (3.5) partial. Resolved against the code.

**VERDICT — the capability recon is right; there is NO real, writable delivery/appointment scheduler.** What David likely remembers is one of two real-but-different things: the PMI interval-schedule, or the `/deliveries` routing tile. Neither schedules a delivery date; neither is writable as one.

1. **No scheduling/calendar/booking widget for deliveries.** The only "schedule" surfaces: (a) PMI — `business_pmi_schedule` (`interval_days`/`last_service_at`/`tasks[]`, [20260612…:163-172]) + `PMI.tsx:1-9` = preventive-maintenance INTERVAL recurrence, not a date/appointment scheduler; (b) `campaign_posts.scheduled_date` ([20260529_campaigns.sql:28]) = social-post scheduling. No delivery/appointment slot anywhere.
2. **DELIVERY tile = REAL but route-builder only.** `Dashboard.tsx:384` `handleEnable('delivery_routing')` → `/deliveries` → `DeliveryRoute.tsx` (355 lines, real). Reads `orders WHERE transport_method='delivery'` (`:67-78`), builds a Google Maps directions URL (`:37-40`), copy/text. **Writes NOTHING to the DB — no date, no status, no schedule.** Routes existing deliveries; does not schedule them.
3. **No delivery-date/appointment/slot field — live or in migrations.** No `delivery_date`/`scheduled_at`/`appointments`/`service_slots` on `orders`. A `delivery_scheduled` notification template exists (`cultivar.ts:103-131`, fields deliveryDate/deliveryWindow) but is **ORPHANED** — defined, never invoked (same for Ignition `appointment_24h`). Checkout (Confirmation/CartReview/CustomerCapture) writes no scheduled date.
4. **OCR engine BUILT + solid, but RECEIPT-shaped; prompt NOT swappable without a code edit.** `api/receipts/ocr.ts` — Gemini 2.5 Flash→Claude Haiku fallback, STD-010, model swappable via `platform_config`. Schema is a single hardcoded `const PROMPT` (`:53-72`) = vendor/date/amount/subtotal/tax/category/line_items/payment_method/receipt_number. **No shape param, no invoice schema** (customer/ship-to/bill-to/totals/due-date). Invoice extraction = new prompt + parse shape + a select param; provider chain reuses as-is.
5. **OCR dead-ends at `receipts`.** `ReceiptKeeper.tsx:277-297` `doSave` inserts ONE `receipts` row and stops — no order, no delivery, no schedule, no cost_object. Zero write-onward from a captured doc to any action.

**Scoping truth for "capture invoice image → schedule a delivery":** capture+OCR ✅ exists (receipt-shaped) · invoice-shape OCR 🟡 net-new (small, reuses provider chain) · OCR→order/delivery write-onward 🔴 net-new (none exists) · delivery-date scheduler widget+column 🔴 net-new (none exists) · delivery routing ✅ exists (route-builder, writes nothing). Essentially the whole chain after capture is net-new. **Recommended nothing — David scopes the build.**

### 2026-06-21 — THUNDER WAVE 2: capability 1.3 catalog-populate — read live LAWNS site → 114 REAL varieties into inventory, D-9 flagged (BUILDER-COMPLETE; migration + owner-proof owed)

**Type:** 1 gated migration (NEW table) + 4 net-new shared/script files + 1 capability registration + 1 D-9 fix (seed.ts) + tech-debt #42 + built-inventory. **NO existing table altered** (byte-identical: CREATE TABLE only, lint-proven). Schema-verification gate is **OWED** (runs after David applies + mints PAT — the table is STAGED/UNAPPLIED). `[TRACE:*]` STAYS ON (standing owner instruction — Part 7); new area `[TRACE:POPULATE]` emits ON. Commit `__PENDING__`.

**THE WOW (1.3, BUILDER-COMPLETE — proven live against lawnstrees.com):** read their LIVE site → extract their REAL catalog → CLEAR the sandbox → write their actual varieties into `business_inventory`, D-9 honesty-flagged. The existing discovery engine extracts services/identity ONLY — catalog was the gap; this is that cut.

**1 — `business_discovery_profiles` (STAGED MIGRATION `20260621_business_discovery_profiles.sql`, GATED/UNAPPLIED):** id · business_id (FK→businesses ON DELETE CASCADE) · source_url · raw_extract jsonb (the honesty/audit trail: items + per-item confidence + counts) · status · extracted_at + timestamps · UNIQUE(business_id, source_url). RLS owner_all + member_all (AC-2, membership-scoped; AC-3 tenant isolation). **CREATE TABLE only — no ALTER/DROP on any existing table** (lint-proven by `verify-discovery-profiles.mjs` migration-lint). **AWAITS DAVID:** apply in SQL editor → mint short-lived PAT → `SUPABASE_PAT=sbp_xxx node scripts/verify-discovery-profiles.mjs` ((A)-(G): table/RLS/policies/FK-cascade/columns/UNIQUE + business_inventory-untouched) → revoke PAT.

**2 — catalog extraction engine (`packages/shared/src/discovery/catalog.ts`, AI capability `discovery_catalog`=Haiku):** `fetchCatalogPages` (bounded 2-level crawl: entry → hub like `/shop/` → category pages; reuses `fetchWebsiteContent`; generic link heuristics inc. WooCommerce `/product-category/`; degrades to entry page) → `extractCatalog` (per-batch model call → `{variety, botanical, category, confidence}`; dedup by variety, tie-break prefers a SPECIFIC category over a catch-all "All Trees" + an item carrying a botanical). NO prices (site has none), NO fabricated qty, NO invented QR/specimen identity.

**3 — D-9 honesty (the whole contract):** low-confidence OR no-clear-category items are **FLAGGED** (`status='review'`, reason in `notes`) — NEVER silently coerced; **price UNKNOWN** (`unit_cost=null`, `cost_confidence='UNKNOWN'`) never 0; **qty=0**; **`cultivar_plants` deliberately NOT populated** (per-specimen/QR identity doesn't exist — would be fabrication). `/inventory` already renders `status` + `cost_confidence` as distinct badges → flags are VISIBLE. **seed.ts D-9 violation RESOLVED (#42):** `toCategory` unknown→`'addon'` (a lie; no CHECK existed) replaced by `classifyCategory` → unknown becomes flagged `'uncategorized'`; price 0 is now an explicit flagged non-null placeholder (column is NOT NULL) held `is_active=false` so 0 never reads as "free". Residual: nullable price + price_confidence needs a `service_offerings` ALTER (deferred to honor byte-identical rule).

**4 — populate flow (`discovery/populate.ts`) + runner (`scripts/populate-catalog.ts`):** fetch→extract→`clearSandbox` (reuses 1.2 `SMPL-`/`[SANDBOX]` semantics byte-for-byte) + `clearDiscovery` (`DISC-`)→insert→upsert profile. Idempotent (`DISC-` markers). Runner: real model when ANTHROPIC key present, else a labelled deterministic stand-in (no key locally).

**BUILDER-COMPLETE — proofs:** (a) gate-check PASS — migration lint (1 CREATE TABLE, no foreign ALTER, no DROP TABLE) + table confirmed ABSENT/gated. (b) **`catalog.test.ts` 35/35** adversarial (flag low-conf + missing-category, never coerce; price null+UNKNOWN never 0; qty 0; dedup keeps highest-conf + specific category; junk dropped; crawl link discovery; entry-page fallback; seed.ts `classifyCategory` no-'addon'). (c) **LIVE lawnstrees.com (`--verify`, LAWNS tenant a1b2c3d4…0001, service key): 30 pages → 263→**114 real varieties** (Oak/Crape Myrtle/Cypress/Redbud/Vitex…), inserted 114 = DISC count; flag-path DB round-trip → status='review' + UNKNOWN price + visible note; idempotent (clear→0 orphans); real LAWNS rows untouched (0→0→0). (d) `build:cultivar` clean (2203 modules, +4); changed files tsc-clean. Profile-persist no-ops gracefully (table unapplied) — proven post-apply.

**CAVEAT (honest):** the live run used a deterministic extraction STAND-IN (no Anthropic key locally) — real varieties from the real fetched text, but the model itself wasn't run; the AI path's correctness is the 35 unit tests. 0 flagged on clean LAWNS data is honest (WooCommerce data is clean); the flag MECHANISM is unit-proven + the live flag-path DB round-trip proves a flagged row persists/clears.

**NEXT — David's OWNER-PROOF (the last bar):** (1) apply `20260621` migration + PAT-prove + revoke; (2) with the Vercel `ANTHROPIC_API_KEY` set, run `node_modules/.bin/esbuild scripts/populate-catalog.ts --bundle --platform=node --format=cjs --external:@supabase/supabase-js --external:@anthropic-ai/sdk | node - --business=a1b2c3d4-0000-0000-0000-000000000001 --url=lawnstrees.com` → open `/inventory` under RLS → his REAL LAWNS varieties materialize with UNKNOWN-cost badges (+ any flagged showing 'review') → `--clear` removes exactly them, real data untouched. Then WAVE 2 continues (1.4 AI questions / 1.5 handshake persistence — deferred this pass). `[TRACE:POPULATE]` stays ON until owner-proven.

### 2026-06-19 — THUNDER WAVE 0+1: QB 500 ROOT-CAUSE FIXED + live spine verified + discrepancy-compare + sandbox seeder + checkout relabel

**Type:** 1 code fix (QB router) + 1 verify script + tech-debt log + 1 shared capability (+test) + 1 seeder script + 1 wording fix + docs. NO schema, NO migration → schema-verification gate N/A. `[TRACE:*]` STAYS ON (standing owner instruction — Part 7). Commits: `14a9a82` (QB fix), `e678754` (spine verify + tech debt), `4633884` (1A+1C), `ef4b0cd` (1B). All pushed.

**0A — QB 500 FIXED (demo-gating, root cause CONFIRMED):** both `/api/qbo/auth-url` AND `/api/qbo/status` returned `FUNCTION_INVOCATION_FAILED`. Root cause = `packages/cultivar-os/api/qbo/router.ts:15` imported `refreshQBToken` from `../../../../shared/...` (FOUR `../`) → resolves to nonexistent `<repo-root>/shared/`. router.ts is at `api/qbo/` (one folder under `api/`) so correct depth is THREE `../` (proven by same-depth sibling `api/discovery/ingest.ts:2`). The 4× was copied from the one-folder-deeper `api/qbo/invoice/cultivar.ts:2`. Unresolved import crashed the function AT MODULE LOAD → 500 on ALL qbo routes regardless of token state (explains auth-url, which needs no token). **Confirmed WITHOUT Vercel logs** via esbuild: old path fails resolution, new path bundles clean (8.5kb). Fixed (4×→3×, `14a9a82`). This is exactly tech-debt #34's prime suspect — #34 now marked RESOLVED. NOTE: `/api/cost/status` does NOT exist in code — no such endpoint/dir; that 500 mention is independent of this module. **AWAITS DAVID: deploy to Vercel + owner-prove** auth-url returns the connect link (not 500), then Connect flow works.

**0B — live spine VERIFIED runtime-real (`scripts/verify-spine-runtime.mjs`, 11/11 pass, service-key):** every demo-spine table + the EXACT write-path columns are live — orders (transport_note/netting_declined/leakage_flag/status/qb_invoice_id/qb_invoice_url), order_items, order_service_selections, order_compliance_records, customers.qb_customer_id, business_inventory (5.1), business_pmi_schedule (5.2), cultivar_plants, businesses. Nothing runtime-broken at the schema level (the QB path was the only broken piece). One DATA note: `business_inventory` is empty for the demo tenant → 5.1 renders empty (the 1B seeder fixes this). Render/RLS = David owner-proves.

**0C — tech debt logged:** #34 RESOLVED (root cause confirmed + fixed). #39 NEW (LIVE SCHEMA NOT IN VERSION CONTROL — orders/customers/order_items tables + qb/leakage/netting columns exist live-only, absent from all 43 `supabase/migrations/` files; a migration-rebuilt env would not match production; same class as Ignition #27). #40 NEW (built-inventory flag correction — 5.1 inventory / 5.2 PMI are resolved/owner-proven, not ⚪ unbuilt).

**1A — discrepancy-compare (capability 1.1, BUILDER-COMPLETE):** `packages/shared/src/discovery/compare.ts` (+`compare.test.ts` 17/17). `compareEnteredVsSite` interrogates the LIVE site (`fetchWebsiteContent`, no cache; `fetchedAt` proves freshness), extracts site values via new `discovery_compare` AI capability, surfaces hedged discrepancies. D-9: three gates (site states a value / values genuinely differ via `looksSame` / confidence ≥ threshold, default drops `low`); message built by `buildDiscrepancyMessage` — always a QUESTION, never asserts which value is right (hedge = code guarantee). Unreachable site → zero fabricated discrepancies, AI not called. `[TRACE:DISCOVERY]` ON. **Owner-proof:** run with a real entered-vs-site mismatch.

**1B — sandbox seeder (capability 1.2, BUILDER-COMPLETE):** `scripts/seed-sandbox.mjs` — `seed()`/`clear()` per business_id. Branded 7-day sample activity (customers, plants, inventory lots, 12 orders w/ 2 leakage) so a new dashboard is ALIVE on arrival. Marker-based EXACT removal (source='sandbox', SMPL-* prefixes, '[SANDBOX]%' notes). `--verify` proven on demo tenant: seed 6c/5p/5inv/12o → all present → clear → exactly 0 remain → real data (2 customers/1 order) UNTOUCHED. Also lights up empty-5.1 inventory. `[TRACE:SEED]` ON. **Owner-proof:** run without `--verify`, view dashboard, then `--clear`. This is also the reusable `clear()` for the Wave-2 real-populate.

**1C — checkout relabel (DONE, wording only):** `CustomerCapture.tsx:230` "You can pay now or when you get home" → "No payment is taken now — pay in person at the office, or online from the invoice we send." No behavior change (checkout already takes no money; CartReview offers email-invoice vs pay-at-office). `build:cultivar` clean.

**NEXT:** David deploys QB fix + owner-proves auth-url/Connect; David owner-proves 1A (real mismatch) + 1B (seed→view→clear) under RLS. Then WAVE 2 (real-populate reusing the seeder's clear()). Open near-term: tech-debt #39 (write capture migrations for live-only order/customer schema), #36 (/assets + /pmi nav-dead).

### 2026-06-19 — THUNDER D-16 Phase 2b/2c: Model B price split + payback line + overridable recovery_basis + N-list (BUILDER-COMPLETE, owner-proof owed)

**Type:** Code — 2 shared engine files (`CountOnceSeam.ts` + `CostToProduce.ts`) + 1 page (`CostToProduce.tsx`) + 2 edit surfaces (`OperatingCosts.tsx`, `CostToProduceSettings.tsx`) + 1 engine test + 1 proof script + built-inventory. **NO schema, NO migration** — Phase-2a `recovery_basis`/`recovery_basis_source` already LIVE (verified service-key this session: 20 COST_TO_SERVE / 1 PLATFORM_INVESTMENT, all DERIVED — so the 2a "owner-apply OWED" wording below is now SUPERSEDED: the migration IS applied). Schema-verification gate N/A. `[TRACE:*]` STAYS ON (standing owner instruction — Part 7). **Wires the 2a flag into the live price (compute + UI), the work the 2a handoff named NEXT.**

**VERIFY-FIRST (reported before building):** (1) the ÷N divide was `acc.knownMonthly / n` (`CostToProduce.ts`) — summed the WHOLE pool incl. the $11,200 PLATFORM_INVESTMENT owner-labor row, never reading recovery_basis (Model A confirmed). (2) the live `/costs` SELECT omitted `recovery_basis` (same gap the receipt_id fix had) — added. (3) live anchor confirmed: floor **$11,323** · est **$1,607.67** · known **$12,930.67** · capex **$6,917.31** · unknown 2.

**2c — COMPUTE:** the count-once seam partitions the monthly pool by recovery_basis — `enforceCountOnce` emits `poolCostToServeFloorMonthly`/`poolCostToServeKnownMonthly`/`poolInvestmentMonthly` (UNROUNDED accumulators → reconcile to `poolKnownMonthly` by construction); `CostEvent`/`CountedEvent` carry `recoveryBasis` (default COST_TO_SERVE = Model A byte-identical for un-migrated); `fromCostObject` reads `row.recovery_basis`. The engine repoints the ÷N sensitivity to **COST_TO_SERVE ONLY** (`costToServe ÷ N`, price via UNCHANGED `MarginEngine.calculateRetail`), adds `costToServeMonthly`+`platformInvestmentMonthly`+per-N `contributionMonthly`. The page rewrites the footnote + adds a **Payback Card** (investment $/mo · per-N contribution · "covers it / X% of it"). **Honest-totals block UNCHANGED** (it shows total cost truth, not price).

**2b — OVERRIDABLE (derived→explicit loop):** `/operating-costs` (20 recurring COST rows) AND Settings Block-2 LABOR (the Owner-labor PLATFORM_INVESTMENT row lives there — confirmed from code) each gain a per-row recovery-basis control + derived/explicit tag; override writes `recovery_basis_source='EXPLICIT'` immediately under RLS. **N-list (Block 4):** arbitrary list via text buffer, dedupe+sort on blur, one row per value.

**BUILDER-COMPLETE — service-key proofs (live TRACE 45830ba7):**
- Honest-totals UNCHANGED: floor $11,323 · est $1,607.67 · known $12,930.67 · capex $6,917.31 · unknown 2. ✓
- **Split: cost-to-serve $1,730.67 + investment $11,200 = $12,930.67 (`splitReconciles: true`)** — money moved divide→payback, none created/destroyed. ✓
- **Price moved exactly as investment left the divide:** N=20 Model A ~$1,077.56 → **Model B $144.99** (floor $10.99); N=1 $21,551→$2,884.99; N=5 $4,310→$576.99. ✓
- **Override round-trip:** Gemini Advanced COST_TO_SERVE→PLATFORM_INVESTMENT flipped source→EXPLICIT, moved cts −$20 / inv +$20, known conserved → **restored** (TRACE data untouched). ✓
- Tests: `CostToProduce.test.ts` 17→**25** (test 5 = Model B split); CountOnceSeam **62** / CostRollup **21** / ProjectLens **26** unbroken. `build:cultivar` clean (2200 modules); changed files tsc-clean (8 pre-existing Confirmation/Orders/DeliveryRoute/SocialSetup errors unrelated). Proof: `scripts/verify-model-b-split.ts`.

**NEXT — David's OWNER-PROOF (live under RLS):** (1) `/costs` price table reads cost-to-serve ÷ N (N=20 ≈ $145, NOT ~$1,078) + footnote says cost-to-serve + Payback Card shows $11,200/mo separately; honest-totals still $11,323 floor / $12,930.67 known. (2) `/operating-costs` recovery-basis control + derived tag per row; flip one to "investment" → tag "you set this" + /costs price drops further. (3) Settings Block 2: Owner labor shows "investment" + re-classify control. (4) Block 4: type "1, 5, 20, 100, 500, 1000" → blur → six sorted rows. `[TRACE:*]` stays ON. **Phase 2d (deferred):** per-PROJECT N + margin dials; LAWNS per-item feed.

### 2026-06-19 — THUNDER D-16 Phase 2a: recovery_basis flag WRITTEN/GATED + DERIVED backfill + catalog gate (X)-(Z) (schema + proof, NOT applied — owner-apply + owner-proof owed)

**Type:** ONE gated migration + verify-script extension + built-inventory. **NO UI, NO pricing readout, NO dials** (Phase 2a scope). Migration is **STAGED/GATED — NOT applied** → schema-verification gate is OWED (runs after David applies + mints PAT). `git status --short` before: clean. `[TRACE:*]` STAYS ON (standing owner instruction — Part 7). Commit **`779542c`** (migration + `verify-cost-objects.mjs` (X)-(Z) + built-inventory).

**THE FLAG (the D-16-recon's "ONE flag", now written):** `supabase/migrations/20260619_cost_objects_recovery_basis.sql` adds two columns to `cost_objects`, both **text, NULLABLE, NO CHECK** (AC-4 — value-set grows without a migration, cost_source precedent):
- **`recovery_basis`** — `COST_TO_SERVE` (feeds the ÷N per-unit price) | `PLATFORM_INVESTMENT` (feeds the separate payback line — NEVER divided into per-unit price). The Model B split.
- **`recovery_basis_source`** — `DERIVED` (the system's default guess, owner has NOT vetted) | `EXPLICIT` (owner-set). The "derived first, then explicit" honesty axis — surfaces which classifications still run on the guess. ALL backfilled rows = DERIVED.

**THE BACKFILL (in-migration, same transaction, derived-default RULE — a SUGGESTION, 2b makes it owner-overridable):** (a) every row → COST_TO_SERVE / DERIVED; (b) PROMOTE EMPLOYEE owner/founder labor (`cost_category='labor'` AND `resource_id`→`labor_resources.resource_type='EMPLOYEE'`) → PLATFORM_INVESTMENT. **Live TRACE split (45830ba7, 21 rows, verified service-key 2026-06-19): 1 PLATFORM_INVESTMENT** (Owner (labor), the sole EMPLOYEE-resource labor row) **+ 20 COST_TO_SERVE** (Connor/Andrew contract-labor are CONTRACTOR → cost-to-serve; + 10 subs/other COST; 5 ASSET capital; 3 PROJECT buckets). **Documented known limitation (by design, in migration comment + doc):** the labor=investment proxy holds ONLY for a two-person business — a future customer-serving EMPLOYEE would be mis-tagged investment, and owner per-tenant support time is really cost-to-serve; both are corrected in 2b by an EXPLICIT override. The flag exists precisely so it can be corrected.

**BYTE-IDENTICAL GATE (stated, must hold — recovery_basis is a CLASSIFICATION, not an amount):** the live `/costs` tile SELECT + `fromCostObject` never read recovery_basis → after backfill the totals MUST be unchanged. **Live floor captured THIS session as the gating anchor (TRACE 45830ba7, read-only mirror): floor `$11,323`/mo · estimated `$1,607.67`/mo · known `$12,930.67`/mo · capexExcluded `$6,917.31` · unknown 2 · 21 cost_objects.** (Confirms the D-16 floor; the old `$12,239.67` BEFORE-NUMBER anchor is stale — David has since added Connor/Andrew labor.) If ANY of those move after apply, that is a BUG — STOP.

**Proof (catalog gate, OWED — runs post-apply):** `verify-cost-objects.mjs` extended with (X) recovery_basis text/nullable/NO-CHECK, (Y) recovery_basis_source text/nullable/NO-CHECK, (Z) backfill = NO nulls + only the two bases + all DERIVED + every PLATFORM_INVESTMENT row IS EMPLOYEE owner labor + no EMPLOYEE owner-labor row left COST_TO_SERVE. Round-trip selectability check added too. **Pre-apply proof the migration is gated:** ran `node scripts/verify-cost-objects.mjs` (round-trip, no PAT) → recovery_basis columns SELECT-fail (absent) → confirms unapplied.

**SEQUENCE FOR DAVID (the only path that closes Phase 2a):**
1. ✅ Thunder: gated migration + backfill + (X)-(Z) written, committed `779542c`, pushed.
2. **David: apply `20260619_cost_objects_recovery_basis.sql`** in Supabase SQL editor (project bgobkjcopcxusjsetfob).
3. **David: mint a short-lived `SUPABASE_PAT`** (https://supabase.com/dashboard/account/tokens).
4. **Thunder: run** `SUPABASE_PAT=sbp_xxx node scripts/verify-cost-objects.mjs` → (X)-(Z) green + COST_TO_SERVE/PLATFORM_INVESTMENT counts (expect 20 / 1).
5. **David: paste the proof to Lightning** to confirm.
6. **David: REVOKE the PAT immediately** (confirm zero tokens).
7. **David: OWNER-PROVE** — open `/costs`, confirm floor + all totals are byte-identical (floor $11,323/mo, known $12,930.67/mo, capex $6,917.31) — the classification changed nothing.

**NEXT (Phase 2b, when greenlit — NOT this pass):** make recovery_basis owner-overridable (DERIVED→EXPLICIT) in the UI → feed ONLY cost-to-serve rows into the ÷N price pool → compute the payback line from the PLATFORM_INVESTMENT rows → per-project N + margin dials (today both business-level only). LAWNS per-item feed after.

### 2026-06-19 — THUNDER D-16 BANKED (pricing Model B) + verify-first recon: cost-to-serve split NEEDS A FLAG; N + margin EXIST business-level, ABSENT per-project (docs + recon only)

**Type:** ONE decision doc + read-only verify-first recon. NO dial build, NO schema, NO migration, NO code → schema-verification gate N/A, no BUILT-INVENTORY change. `git status --short` before: clean. `[TRACE:*]` STAYS ON (standing owner instruction — Part 7).

**JOB 1 — D-16 ACCEPTED (committed first, `ba26d93`):** `docs/DECISION-pricing-model.md` + `DECISIONS.md` D-16 cross-link (D-15 was last id). **Model B (cost-to-serve + payback), chosen over fully-loaded Model A.** Price = cost-to-serve ÷ N ÷ (1 − margin); founder/platform labor ($11,323/mo floor) is INVESTMENT on a separate **payback line** ("at this price + N, investment recovers in X months"), NEVER divided into per-unit price. Subscription shape (BuiltWithCAI/Cultivar) = N_customers denominator; product shape (LAWNS) = per-item denominator. Same MarginEngine + cost spine; only DENOMINATOR + FEED vary by business shape (AC-1). Model A rejected: dividing the whole floor by N makes low-N unsellable ($11,323÷10≈$1,913/cust) + conflates investment with COGS (root of the untrustworthy old $149). Build dependency: must separate COST-TO-SERVE (marginal/per-tenant) from PLATFORM INVESTMENT (founder labor) per cost object.

**JOB 2 — VERIFY-FIRST recon (the build-shape decider):**
- **Cost-to-serve vs investment → NEEDS A SMALL FLAG (NOT cleanly derivable).** (1) `cost_nature` is too coarse — owner labor is `OPEX` (`seed-owner-labor.mjs:88`), the SAME nature as per-tenant subs (Claude API also OPEX) → OPEX holds both. (2) `cost_category='labor'` + `resource_id→labor_resources(EMPLOYEE,'Owner')` IS a working proxy TODAY (only investment today = owner labor) but conflates "is labor" with "is investment" — breaks on the first customer-serving employee (mis-tagged investment) AND on owner per-tenant support time (really cost-to-serve). (3) The truest signal — `cost_shape='VARIABLE'` (scales-with-N) — is allowed but unbuilt + nothing is tagged it. ⇒ recommend a one-column flag (e.g. `recovery_basis`/`cost_role`: COST_TO_SERVE | PLATFORM_INVESTMENT, AC-1 no-CHECK). **Phase 2 = dials + ONE flag**, not dials-only.
- **N (target customers): EXISTS business-level, ABSENT per-project.** `config.denominators: number[]` — a sensitivity SET `[1,5,20,100]` in `business_modules.config` (`CostToProduceSettings.tsx:630`, Block 4). No per-project N.
- **target margin: EXISTS business-level, ABSENT per-project.** `config.margin.baseline` (fraction 0–0.99) in `business_modules.config` (`CostToProduceSettings.tsx:614`, Block 3) + `config.margin.tiers[]`. The orphaned DB margin store (D-13) stays display-only. No per-project margin.
- **MarginEngine.calculateRetail(vendorCost, config, tierName) → YES, already does Model B's arithmetic.** `CostToProduce.ts:304-305` builds a single-slab config where `multiplier = 1/(1−margin)` ⇒ `retail = cost/(1−margin)`. The ÷N ÷(1−margin) math is ALREADY wired (analyze() runs it per denominator). Phase 2 adds the cost-to-serve FEED (filter pool to cost-to-serve rows) + the payback line (investment ÷ recovered/mo), not new pricing math.

**NEXT (Phase 2, when David greenlights — NOT this pass):** add the cost-to-serve flag (one column, staged verify-first migration) → feed only cost-to-serve rows into the ÷N pool → compute the payback line from the investment rows → per-project N + margin DIALS (today both are business-level only). LAWNS per-item feed after. No code/schema written this pass.

### 2026-06-19 — THUNDER D-14.6 SEVER: estimator Block 1 → read-only scratchpad; /operating-costs is sole recurring writer (BUILDER-COMPLETE, owner-proof owed)

**Type:** Code — 1 shared component (`CostToProduceSettings.tsx`) write-path sever + UI relabel + D-14.6 doc + built-inventory. NO schema, NO migration → schema-verification gate N/A. **NO existing `cost_objects` row created/modified/deleted by the build** (proofs created+deleted only `__PROOF` test rows). `[TRACE:*]` STAYS ON (standing owner instruction — Part 7); the `[TRACE:COST]` save emit was KEPT and now reports `recurring: READ_ONLY (severed)`.

**CONTEXT:** `/operating-costs` was OWNER-PROVEN 2026-06-18 as the recurring-cost home. Until now the estimator's Block 1 ALSO wrote the same recurring `cost_objects` rows → same cost editable from two surfaces with two different save models (estimator batch-Save vs /operating-costs immediate-save). **This pass ended that split.**

**SEVER (Block 1 ONLY):** In `CostToProduceSettings.tsx`, Block 1 "Recurring & operating costs" is now a **READ-ONLY pricing scratchpad** — it DISPLAYS the recurring costs (name · amount+cadence · confidence badge · category · project) and links **"Manage recurring & operating costs →" to `/operating-costs`** (plain `<a>` — shared component stays router-agnostic). It **no longer inserts/updates/deletes `cost_objects`**: removed the recurring write block + `removedIds` delete from `save()`, removed `addRow`/`editRow`/`removeRow`/`newLine`/`removedIds` state, replaced the editable inputs/Add/remove controls with the read-only list. No field that looks editable but doesn't persist; no Block-1 Save that does nothing (the global Save now persists ONLY labor + config).

**UNTOUCHED (verified):** Block 2 **LABOR (D-12)** still writes `labor_resources` + applied-labor `cost_objects` exactly as before (insert/update/delete intact). Blocks 3 (margin) + 4 (target customers) still write `business_modules.config`. `/costs` and `/operating-costs` unchanged — `/operating-costs` remains the SOLE writer of recurring COST rows.

**BUILDER-COMPLETE — proofs (TRACE 45830ba7):** (a) Block 1 no longer writes — structural: recurring INSERT/UPDATE/DELETE removed from `save()` (grep: only labor writes + reads remain), UI controls replaced with read-only display + pointer. (b) **Labor STILL writes** — service-key round-trip of the labor `resPayload`+`costPayload` (insert→edit→cleanup) passes. (c) **/operating-costs STILL writes** — recurring insert→edit→delete round-trip passes. Existing named rows (recurring: Claude Pro/Gemini/TX tax/domains; labor: Owner/Connor/Andrew) **byte-identical untouched**; count 21→21, no `__PROOF` leak. `build:cultivar` clean; `CostToProduceSettings.tsx` tsc-clean.

**NEXT — David's OWNER-PROOF (live `/settings` → Cost-to-Produce under RLS):** Block 1 shows the recurring costs READ-ONLY (no editable fields, no Add/remove) + the "Manage recurring & operating costs →" link → click it lands on `/operating-costs` → add/edit/delete a recurring cost THERE → it reflects on `/costs` and in the Block 1 read-only display → in Settings, edit a LABOR line + Save → it still persists (Block 2 intact) → margin/target Save still works. Then `[TRACE:COST]`/`[TRACE:opcosts]` stay ON (standing).

### 2026-06-18 — THUNDER Operating Costs datasheet built (recurring-cost HOME) — estimator NOT severed (BUILDER-COMPLETE, owner-proof owed)

**Type:** Code — 1 NEW cultivar page + router + 1 entry-point button on `/costs` + D-14.6 doc clause + built-inventory. NO schema, NO migration → schema-verification gate N/A. **NO existing `cost_objects` row created/modified/deleted by the build** (the service-key PROOF created+deleted a `__PROOF` test row only). `[TRACE:*]` STAYS ON (standing owner instruction — Part 7).

**SCOPE CHANGE FROM PROMPT (verify-first STOP → David re-decided):** The prompt asked to SEVER the estimator's `cost_objects` write (CostToProduceSettings Block 1 → pricing scratchpad). **Verify-first surfaced a broken premise (gate #3 STOP, did NOT sever blind):** the prompt assumed the "datasheet/assets" path could hold recurring costs — it CANNOT. `BusinessAssets` (`/assets`) writes `node_type='ASSET'` ONLY (capital); recurring subs (Claude Pro/Gemini/domains/TX tax) are `node_type='COST'` and **`CostToProduceSettings` Block 1 is the ONLY recurring-COST writer in the app** (grep-confirmed). Severing it would strand recurring-cost entry, and "David retires the rows via the datasheet" is impossible (`/assets` filters `node_type='ASSET'`, so COST rows never show there). **David's calls (AskUserQuestion):** (1) **build the recurring home FIRST**, sever later; (2) **keep Block 2 Labor writing** (D-12 intact); (3) home = a **NEW dedicated `/operating-costs` page** (not a section on /assets, not the unified grid).

**BUILT — `packages/cultivar-os/src/pages/OperatingCosts.tsx` (`/operating-costs`):** the datasheet HOME for recurring, NON-LABOR `cost_objects` (`node_type='COST'`), sibling to `/assets` (capital) + `/inventory` (materials). LIST + Add-Cost sheet + per-row inline immediate writes (RLS-scoped, `node_type='COST'` guarded): amount (recurring_amount) · cadence · category (shared `CATEGORY_OPTS`) · project (parent_id) · confidence · remove (hard delete, confirmed). Insert mirrors the estimator's proven recPayload (RECURRING_FIXED / OPEX / MANUAL / OWNER_ASSERTED / acquisition_cost null) → all CHECKs pass. Coherence UNKNOWN⟺no amount. **LABOR EXCLUDED** — `labor`/`contract-labor` filtered on load + never targeted (edits act only on loaded non-labor ids; `CATEGORY_OPTS` omits labor) → labor structurally untouchable here. Router + a "Manage recurring & operating costs →" button on `/costs` (always-available, even pre-config). `[TRACE:opcosts]` ON.

**ESTIMATOR NOT TOUCHED:** CostToProduceSettings Block 1 STILL writes `cost_objects` today (both surfaces write the same rows until the sever). D-14.6 records the decided end-state + the "build home first, then sever" sequencing — written honestly (does NOT claim the estimator is already a scratchpad).

**BUILDER-COMPLETE — service-key proof (TRACE 45830ba7):** (b) INSERT (exact page payload) → all CHECKs satisfied; UPDATE amount·cadence·category·assign-to-CoolRunnings·confidence→UNKNOWN(clears amount) all ok; DELETE → gone; (c) named recurring rows (Claude Pro/Gemini/TX tax/domains) + labor (Owner/Connor/Andrew) **byte-identical untouched**, all 3 labor present; test row cleaned up (21 rows restored, no `__PROOF` leak). Page shows **10 non-labor COST rows**. `/assets` write path UNCHANGED (file not touched). `build:cultivar` clean (2200 modules); new/changed files tsc-clean.

**NEXT — David's OWNER-PROOF (live `/operating-costs` under RLS):** open `/costs` → "Manage recurring & operating costs →" → the 10 recurring rows show (NO Owner/Connor/Andrew labor) → add a cost (e.g. a new sub) → it appears + shows on `/costs` → edit amount/cadence/category/assign-to-project/confidence inline → `/costs` flat + by-project recompute → set a row UNKNOWN → amount clears → remove a test row → gone. **Then (separate follow-up pass): SEVER the estimator** (Block 1 → scratchpad) per D-14.6, once this home is proven. `[TRACE:opcosts]`/`[TRACE:COST]` stay ON.

### 2026-06-18 — THUNDER D-15: Cost Object Model-of-Record captured + live column confirm (RECON + docs only)

**Type:** RECON (live column pull) + docs only. NO schema, NO migration, NO code, NO build → schema-verification gate N/A, no BUILT-INVENTORY change. Two jobs: (1) confirmed the live `cost_objects` column set against the model David authored; (2) committed `docs/DECISION-cost-object-model-of-record.md` (D-15) + cross-linked from `DECISIONS.md` as the next free id. Content was provided verbatim by David (adopt/deviate/add/skip calls already made) — NOT re-decided here. `git status --short` before: clean.

**STANDING INSTRUCTION (carried):** TRACE instrumentation `[TRACE:*]` is ON by OWNER instruction — do NOT comment out or delete any emit until David explicitly lifts it. Overrides the STD-003 post-OWNER-PROVEN comment-out default.

**LIVE COLUMN CONFIRM (service-key `select('*')` on tenant 45830ba7, PAT revoked so catalog gate N/A — column existence proven via the data path):** `cost_objects` has **35 columns**. Every field the D-15 doc NAMES exists and is NOT contradicted: amount (`acquisition_cost` + `recurring_amount`), `name`/`notes`, `node_type` (ASSET/PROJECT/PRODUCT + COST), `receipt_id`, `cost_category`, `parent_id`, `resource_id`, `cost_nature`, `cost_shape`, `cost_confidence`. ⇒ doc written as-given, no field adjusted.

**Two semantic columns the doc does NOT individually name (non-contradicting — surfaced for David, NOT a blocker):** `cost_source` (provenance MANUAL/API… — unified cost model, 20260617) and `substantiation` (SUBSTANTIATED/OWNER_ASSERTED — D-5 axis 2). The remaining unnamed columns are ASSET-node specialization (`asset_type`, `make`, `model`, `serial_number`, `year`, `warranty_months`, `photo_url`, `barcode_id`, `location`, `assigned_to`), node-status (`status`, `project_status`, `product_status`, `domain`), `cadence` (subsumed under shape), and infra (`id`, `business_id`, `is_active`, `created_at`, `updated_at`) — all subsumed by the doc's spine/node-type/context-tag frame. If David wants `cost_source`/`substantiation` named explicitly as ADDED axes, that's a one-line doc edit next session.

### 2026-06-18 — THUNDER D-14 Phase 1.1: drill-in aggregates EXPAND to line items + Other-recurring honesty fix (BUILDER-COMPLETE, owner-proof owed)

**Type:** Code, view-layer ONLY (`ProjectCostDrillIn.tsx` + `ProjectCostTree.tsx`). **NO schema, NO migration, NO new query** (`receipt_id` added to the tree's EXISTING SELECT — +1 column, carried by reference) → schema-verification gate N/A. **BUILDER-COMPLETE (service-key reconciliation proof PASSED both ways), NOT owner-proven.** Extends the Phase 1 drill-in (`68ee49a`).

**What:** the three drill-in aggregates (Labor / Other recurring / Captured capital) are now click-to-EXPAND to their constituent line items (read-only). Each line item: name · amount (`Intl USD`) · confidence badge · `cost_category` · 🧾 receipt link if `receipt_id`. **HONESTY FIX (required, the point of the feature):** "Other recurring" is now a REAL positive group-by of the project's non-labor monthly rows — NOT pool-minus-labor — so a row with null/blank `cost_category` surfaces as its OWN **Uncategorized** line item (amber-flagged, visible, never absorbed into a remainder). A mistagged cost becomes VISIBLE.

**Reconciliation (proven two ways):** Σ line items === each aggregate (by construction), AND labor+other === `poolKnownMonthly` / Σ capital === `capexKnown` (the tree totals). A penny-level divergence (seam-merged dup) is surfaced via `reconcile-drift`, never hidden.

**SCOPE FENCE held:** read-only — NO inline edit, NO reassign, NO project-assignment (that's the separate banked `/assets` write gap). 🟡 honest-debt: per-receipt deep-link `/receipts/:id` does not exist → the receipt link goes to `/receipts` (Receipt Keeper).

**Service-key proof PASSED (`scripts/verify-project-drill-in.ts`, extended, read-only):** ALL groups reconcile both ways on real TRACE tenant `45830ba7…`: **CoolRunnings capital $917.31** → 4 hardware rows itemize+sum (NSPanel Pro $259.80 🧾, MINI Duo-L $65.70 🧾, meross $91.81, HP ProDesk $500.00); **BuiltWithCAI Other $156.67** → 4 real non-labor rows (domains $16.67, Open AI API $30, Infrastructure $0 CONFIRMED, Claude API $110), + Resend/Twilio unknown (no amount, not summed); labor $1,000 = Connor contract-labor. **UNCATEGORIZED SURFACED WIDELY** — nearly every non-labor row is currently untagged (honest visibility, working as intended, NOT a failure). `build:cultivar` clean (2199 modules); `tsc` clean for both files.

**Instrumentation (STD-003):** `[TRACE:PROJECTLENS] drill-in expand` (projectId, aggregate, lineItemCount, anyUncategorized) added; `drill-in open` extended (lineItemCounts, anyUncategorized); `reconcile-drift` now guards pool AND capex. ALL ON BY DEFAULT until owner-proven.

**NEXT — David's OWNER-PROOF (live `/costs` under RLS):** open a project drill-in → expand Labor / Other recurring / Captured capital → line items sum visibly to each aggregate → confirm the Uncategorized rows are the real untagged costs (CoolRunnings hardware, BuiltWithCAI subscriptions). Note: actually CATEGORIZING them is the separate `/assets` write gap, NOT this read-only pass. Then comment out the new `[TRACE:PROJECTLENS]` emits (don't delete). **Phase 2 (deferred):** pricing layer per D-14.

### 2026-06-18 — THUNDER D-14 banked + Phase 1 per-project cost-to-produce DRILL-IN built (BUILDER-COMPLETE, owner-proof owed)

**Type:** Job 1 = doc/decision (committed `96d4ab1`). Job 2 = code (1 new cultivar component + tree wiring + 1 verify script). **NO schema, NO migration** → schema-verification gate N/A. **BUILDER-COMPLETE (service-key reconciliation proof PASSED), NOT owner-proven.**

**JOB 1 — D-14 ACCEPTED (committed first, `96d4ab1`):** `docs/DECISION-cost-attribution-and-shared-cost.md` + `DECISIONS.md` D-14 cross-link (D-13 was the last id; D-14 free). Five sub-decisions: (14.1) attribution follows CONSUMPTION not design intent — vertical-specific until a 2nd adopter, then shared (mirrors the code-sharing rule); (14.2) shared cost flows by cross-branch **use_fraction carve-out** (the [[D-4]] `cost_object_edges.use_fraction` primitive applied platform→vertical), conserved ≤1.0, never multiplied; (14.3) **cost truth ≠ price strategy** from the same data — a vertical's drill-in shows ACTUAL burden (Cultivar is the sole consumer today → its carved share ≈1.0, and the books must SHOW that), while PRICING is its 20% specific + amortized fair share + margin; (14.4) **unrecovered platform investment** (shared incurred − shared recovered) is first-class + surfaced, dilutes as verticals onboard; (14.5) a vertical owns its 20%, carries a fair slice of the 80%. **Deferred (NOT decided):** the platform→vertical use_fraction BASIS (ship as a settable var, default simply); the "full burden vs fair share" side-by-side (BI-adjacent, with D-13); per-project N / margin / platform-share knobs (= Phase 2 schema).

**JOB 2 — Phase 1 drill-in (COST-ONLY, ZERO SCHEMA):** `packages/cultivar-os/src/components/ProjectCostDrillIn.tsx` (NEW, widget-header present) + wiring in `ProjectCostTree.tsx`. Click a project group's new "Cost to produce" button → modal scoping that project's cost in isolation: **2 headline figures taken VERBATIM from the group's existing `rollup`** (`group.rollup.poolKnownMonthly`/`.capexKnown` — the SAME `NodeRollup` the tree renders, NO recompute → reconciles exactly), monthly pool **by category** (Labor `cost_category ∈ {labor,contract-labor}` / Other recurring derived as the remainder so parts always sum to the authoritative pool / Capital shown separately one-time), and the **confidence mix** for that project (floor/estimated/unknown labels). Money via `Intl.NumberFormat USD`. **NO pricing/margin/N — OMITTED, not stubbed** (D-14 + Surface Honesty). Verify-first confirmed `view.groups[i].rollup` is the full NodeRollup + child rows carry `cost_shape`; `cost_category` was NOT being fetched (real column, D-11) → added to the tree SELECT + a widened `LensRowWithCat` type (carried onto `group.children` by reference at runtime).

**RECONCILIATION PROOF PASSED (BUILDER-COMPLETE bar):** `scripts/verify-project-drill-in.ts` (bundle via esbuild → node, service-key, read-only) — **all groups MATCH** on real TRACE tenant `45830ba7…`: Platform overhead $12,124/mo (labor $12,000 + other $124), CoolRunnings $450/mo + $917.31 capex, Farm $6,000 capex, **BuiltWithCAI $1,156.67/mo (labor $1,000 + other $156.67) + 2 unknown (Resend, Twilio)** — drill-in pool/capex == tree pool/capex in every group. `build:cultivar` clean (2199 modules); `tsc` clean for both files.

**Instrumentation (STD-003):** `[TRACE:PROJECTLENS] drill-in open` (projectId, headline figures, category split, confidence mix) + `reconcile-drift` 🟡 warn if the confidence-mix sum diverges from the authoritative pool. **STAYS ON** until owner-proven.

**NEXT — David's OWNER-PROOF (live `/costs` under RLS):** By-project → click "Cost to produce" on BuiltWithCAI (or any project) → headline pool/capital MATCH that group's tree row → Labor/Other split sums to the pool → confidence mix + unknown labels right → NO pricing panel shown. Then comment out the new `[TRACE:PROJECTLENS]` drill-in emits (don't delete). **Phase 2 (deferred):** pricing layer — settable N + margin + cross-branch carve-out for shared cost → fair-share price + unrecovered-investment gap (staged migration, cross-branch-edge verify-first, per D-14).

### 2026-06-18 — THUNDER un-blindfold the count-once seam: feed receipt_id to the live dedup path (BUILDER-COMPLETE, owner-proof owed)

**Type:** Code — 1 cultivar SELECT fix (`CostToProduce.tsx`) + built-inventory. NO schema, NO migration (receipt_id EXISTS on cost_objects — D-5 `20260615_..._substantiation_d5.sql`; recon 55f92fd). NO dedup-logic change — this only DELIVERS the signal the seam was already built to consume. Build clean (2199 modules); `CostToProduce.tsx` tsc-clean. `[TRACE:*]` STAYS ON (standing owner instruction — Part 7).

**THE FIX:** the live `/costs` SELECT (`CostToProduce.tsx:105`) had omitted `receipt_id`, so `enforceCountOnce` ran live (`CostToProduce.ts:278`) but every event arrived with `receiptId=null` → the seam's strongest signal (sameCost receipt-container rules) was dormant on the live tile. Added `receipt_id` to the SELECT + passed it into the `fromCostObject` arg (which already maps `receipt_id → event.receiptId`, `CountOnceSeam.ts:634`). Sibling ProjectCostTree/lens path ALREADY fed it (D-14, last session) — only the flat company tile was blind. Stale comment ("no receipt column yet") corrected.

**BUILDER-COMPLETE — service-key before/after proof (TRACE 45830ba7, real shared seam, mirrors live path):**
- **sameCost(NSPanel $259.80, MINI Duo-L $65.70)** — the seeded pair sharing Amazon receipt 264f9e5f: **BEFORE** (receipt_id stripped) → DISTINCT via signal `amount` ("amounts do not line up"). **AFTER** (receipt_id present) → DISTINCT via signal **`receipt_id`**, bucket KNOW ("same receipt, different line amounts → distinct line items on one order"). Events now carry receiptId 264f9e5f (was null) → seam un-blindfolded end-to-end.
- **NO TOTAL MOVED (byte-identical, justified):** knownMonthly $13,730.67, floorMonthly $12,123, estimatedMonthly $1,607.67, capexExcluded $6,917.31, unknownCount 2 — identical before/after. Reconcile: survivors 16→16, deduped 0→0, possibleDuplicates 0→0. **Why right:** the pair was ALREADY kept DISTINCT (coincidental amount-mismatch); receipt_id changes only WHY (authoritative receipt-container rule), not WHETHER. Correctly **NOT merged** — same receipt + different line amounts = two real line items on one order, not a double-count. Only 2 rows carry receipt_id and they stay distinct ⇒ no total *can* move. (Note: live total is now $13,730.67 not the older $12,279.67 anchor — David has since added Connor/Andrew/other rows via the live labor+recurring model; floor $12,123 matches. The PROOF is the before==after equality, independent of the absolute.)

**OWNER-PROOF owed (David, live `/costs` under RLS):** open `/costs` → the flat company total reads the same as before this change (no surprise move) → the by-project tree/drill-in still reconcile → (optional) check the browser console `[TRACE:SEAM] reconcile` emits with the receipt-bearing events. The number not moving IS the pass; a moved number would need a justified dedup.

**Next (NOT this pass, per scope):** the receipt→cost-object WRITER (Receipt Keeper bridge — one receipt → N cost objects sharing one receipt_id across N projects). That's what makes receipt_id MERGE/DISTINCT fire on real owner-entered data at scale; today only the seeded pair exercises it.

### 2026-06-18 — THUNDER RECON: receipt_id + resource_id as first-class FK seams on cost_objects (read-only — verdict: WIRING, not migration)

**Type:** RECON ONLY. No schema, no migration, no build, no code. Sole question: do `cost_objects.receipt_id` / `resource_id` already exist as FK seams, or need adding? Probed LIVE schema (service-key) + migrations + code reads. `[TRACE:*]` stays ON (standing owner instruction — Part 7).

**VERDICT — NEITHER NEEDS A SCHEMA MIGRATION. Both columns already exist on `cost_objects` as proper FK seams. This is a WIRING JOB, not a migration.**

- **`resource_id` → EXISTS + WIRED.** Column PRESENT; FK → `labor_resources(id) ON DELETE SET NULL` (`20260618_cost_category_and_labor_resources.sql:138`). Populated on all 3 labor cost objects (Owner→dd5bb10d, Connor→b133d567, Andrew→43ad236c). WRITTEN by `CostToProduceSettings` save (`:386`) + READ on load/reload (`:239/:466`) to join `labor_resources` and rebuild the labor entry — full live round-trip. **Labor-only by convention** (no non-labor row carries one; nothing enforces it, nothing else writes it). ⇒ Already a live first-class seam — nothing to do here.

- **`receipt_id` → EXISTS + DORMANT** (structurally complete: column + FK + dedup logic + display reader all present; missing only an app WRITER and a live-path read). Column PRESENT; FK → `receipts(id) ON DELETE SET NULL` (`20260615_cost_objects_substantiation_d5.sql:50` — the D-5 axis; NOTE the `20260612_..._cost_confidence.sql:56` receipt_id is on **`business_inventory`**, a different table). Population: only the SEED script sets it — 2 ASSET rows (NSPanel + MINI Duo-L) share Amazon receipt 264f9e5f. **NO app code writes it** — Receipt Keeper writes `receipts` but spawns NO cost_object (confirmed still true, last session (A)); `BusinessInventory`/`PMI`/`BusinessAssets` all explicitly leave it null ("linked by receipt flow later"). Reads: (a) `ProjectCostTree`/`ProjectCostDrillIn` SELECT it for DISPLAY only (the receipt link); (b) the count-once dedup DOES read it — `fromCostObject` maps `receipt_id→event.receiptId` (`CountOnceSeam.ts:634`) and `sameCost` uses it as its strongest signal (`:267-277`), and the live analyze path calls `enforceCountOnce` (`CostToProduce.ts:278`) — **BUT the live `/costs` page SELECT omits `receipt_id` (`CostToProduce.tsx:105`)**, so the live seam never receives it → the receipt_id MERGE/DISTINCT branch is dormant on the live tile (exercised only in unit tests + the coolrunnings fixture). The seeded pair correctly do NOT merge (same receipt, different line amounts → DISTINCT line items).

**COUNT-ONCE (Q4):** the seam that reads receipt_id is BUILT + unit-tested (CountOnceSeam) and runs live, but is fed events WITHOUT receipt_id today → designed-and-implemented but dormant on the live path for lack of a supplier.

**Q5 (if absent):** N/A — neither column is absent; no FK target, RLS, or column-set assumption to disturb. Wiring receipt_id into a live seam = (1) a WRITER (the receipt→cost-object bridge: one receipt may spawn N cost objects across N projects, all sharing one receipt_id — last session's "next pass") + (2) add `receipt_id` to the live `/costs` page SELECT so `enforceCountOnce` actually sees it. No DDL. **Recommendation withheld per recon scope — read only.**

### 2026-06-18 — THUNDER editable assign + categorize on /assets (BUILDER-COMPLETE, owner-proof owed) + shared Schedule C category de-dup

**Type:** Code only — 1 new shared module + 1 cultivar page rewrite + 1 shared-component de-dup + built-inventory. NO schema, NO migration (every target field — parent_id, cost_category, acquisition_cost, recurring_amount, cadence, cost_confidence — is an EXISTING column; verified before building) → schema-verification gate N/A. EDIT-ONLY pass (no create/split/delete). Build clean (2199 modules, +2); the 3 changed files tsc-clean (pre-existing Confirmation/Orders/etc. errors unrelated).

**STANDING INSTRUCTION (Part 7):** TRACE instrumentation `[TRACE:*]` is ON by OWNER instruction — do NOT comment out or delete any emit (incl. the new `[TRACE:assets] edit`) until David explicitly lifts it. This OVERRIDES the STD-003 post-OWNER-PROVEN comment-out default.

**VERIFY-FIRST (reported before building):**
- **(A) Receipt Keeper → cost object:** Receipt Keeper STOPS at the `receipts` table. `doSave()` (`ReceiptKeeper.tsx:277`) inserts ONE `receipts` row with `line_items` as a JSON column — creates NO `cost_objects` row, no parent_id/cost_category, writes no receipt_id onto any cost object. Cost objects are born on /assets (ASSET), Settings (COST/labor), ProjectsManager (PROJECT), seed scripts. `receipts` = provenance only ⇒ the receipt→cost-object bridge (1 receipt → N cost objects sharing one receipt_id, across N projects) is genuinely the NEXT pass, not built here.
- **(B) RLS (shown, not assumed):** `cost_objects_owner_all` + `cost_objects_member_all` are both `FOR ALL` (covers UPDATE), USING+WITH CHECK scoped to `businesses.owner_id=auth.uid()` / active `business_members` (orig `20260612_business_assets_inventory_pmi_service.sql:51-83`, renamed `20260615_..._rename...:54`). reassign()'s parent_id UPDATE already rides this in prod.
- **Settings already did it:** `CostToProduceSettings.tsx` recurring rows ALREADY edit category(D-11)/project/amount/cadence/confidence via the batch Save (built today, Stage 4). The real gap was /assets (read-only). So this pass = /assets; Settings needed no new capability (its BUILDER-COMPLETE proof = categorize Claude Pro through the existing picker).

**BUILT:**
- `packages/shared/src/business-logic/costCategories.ts` (NEW) — shared `CATEGORY_OPTS` (14 Schedule C values) + `categoryLabel`; exported via `@trace/shared/business-logic`. `CostToProduceSettings.tsx` re-pointed to import it (de-dup — the two pickers can't drift). `ProjectCostDrillIn`'s tiny local `categoryLabel` left as-is (owner-proven, out of scope).
- `BusinessAssets.tsx` — REWRITE: each ASSET row gets 4 inline controls, each an IMMEDIATE write (reassign() pattern, `.eq(node_type,'ASSET')`-guarded, reload after): **project** (parent_id → PROJECT/Company-level), **category** (shared picker), **amount** (acquisition_cost, blur-commit), **confidence** (full set). Coherence enforced (UNKNOWN ⟺ no amount). Add-Asset form (create) untouched. `[TRACE:assets] edit {assetId,field,from→to}` ON.

**BUILDER-COMPLETE — service-key proof (TRACE 45830ba7):** uncategorized (ASSET+COST null cost_category) **15→12** (HP ProDesk + SONOFF MINI Duo-L → `equipment`; Claude Pro → `software-subscriptions`). Flat ASSET capex UNCHANGED $6917.31 (categorize/reassign capex never moves the company total). Reassign recompute: NSPanel $259.80 CoolRunnings→Farm moved BOTH group totals (Cool $917.31→$657.51, Farm $6000→$6259.80), then restored. Categories KEPT (real values).

**OWNER-PROOF owed (David, live /assets under RLS):** open /assets → each row shows project + category + amount + confidence inline → set a category on an uncategorized asset (e.g. tractor, meross) → it persists + the row's "uncategorized" styling clears → assign an asset to a different project → on /costs the by-project tree/drill-in reflects it (capex moves between groups, flat unchanged) → blank an amount → confidence flips UNKNOWN. Then categorize Claude Pro on Settings (already-built picker) → Save → null-category count drops.

**Open items inherited (not this pass):** the banked save-vs-inline consistency — /assets is now INLINE (matches the tree); Settings stays batch-Save. Two models still coexist; David to decide if Settings should go inline too. receipt→cost-object bridge = next pass.

### 2026-06-18 — THUNDER D-13 captured (DEFERRED) + handoff/state synced to current reality (docs + handoff only)

**Type:** Docs/handoff only. No schema, no code, no build → verification gate N/A. Two jobs: (1) committed `docs/DECISION-unified-margin-store-and-history.md` (D-13) + cross-linked from `DECISIONS.md`; (2) synced this Handoff + PLATFORM_STATE.md to where things actually stand. `git status --short` before: only `?? docs/DECISION-unified-margin-store-and-history.md` untracked, nothing else.

**D-13 (DEFERRED — future cross-vertical arc, NOT near-term):** captured from a read-only margin/history verify-first. The shared `MarginEngine.ts` is already a pure shared calculator (both verticals feed it — AC-4 holds for the engine); margin STORAGE is fragmented (Cultivar `config.margin` blob + Ignition's 3 stores, the DB one orphaned/display-only); NO DB-level cost/margin history exists anywhere (last-write-wins). Target = ONE DB-backed RLS margin store the engine reads + a history table with the BI layer — sequenced WITH/AFTER the BI what-if wedge. Real debt, breaks nothing today → deferred.

**DONE / OWNER-PROVEN (current reality):**
- **D-12 LABOR MODEL — OWNER-PROVEN under RLS.** Owner labor migrated into a `cost_object` (floor held **$12,123**); contractor labor works (Connor $1,000/mo, Andrew $450/mo as `contract-labor` with `labor_resources` rows + applied `cost_objects` + `resource_id` links; known moved by exactly the **$1,450** delta, coherent). 4-block Settings reorg live. `config.labor` clear + button relabel done (`fe94ded`). **D-11 cost_category dimension live** + category picker on recurring rows.
- **Stages 1–4 of the D-11/D-12 build all complete**; schema proven (catalog checks Q–W); migrations byte-identical through every gate.

**NOT FULLY CLOSED — D-11/D-12 foundation has small open items (the LABOR MODEL itself IS proven):**
- save-button vs inline-edit consistency (some edits inline, project-assignment needs Save — decide ONE model)
- label the two per-project numbers clearly (one-time capital vs /mo)

**NEAR-TERM BANKED FINDINGS (real, closer to presentable — pick next build from here):**
- **`/assets` page is READ-ONLY with NO project assignment** → assets can't be edited or assigned to a project (real capability gap; relates to Andrew's asset/inventory widget, still pending).
- **PER-PROJECT cost-to-produce drill-in:** select a project (e.g. BuiltWithCAI) → see ITS full cost-to-produce (labor/recurring/capital/margin) in isolation, like the company view scoped to one project (David's ask; lead-in to nesting + BI).

**DEFERRED DECISIONS (future arcs, banked, NOT near-term):**
- **D-13** unified margin store + cost/margin history (cross-vertical, with/after BI) — `docs/DECISION-unified-margin-store-and-history.md`.
- **nested projects** (Farm→meat birds/rabbits/egg birds; LAWNS→greenhouse→inventory) — build when real.
- **BI what-if/blocker** (the wedge — after the spine is rich + populated).

**KNOWN TECH DEBT (not blocking):** `/api/qbo/status` 500 still firing (pre-existing, unrelated to cost model — tech-debt #34).

**STANDING / INSTRUMENTATION (do NOT comment out any):**
- `[TRACE:COST]` / `[TRACE:SEAM]` **STAY ON** — D-11/D-12 is NOT fully closed (open items above).
- `[TRACE:PROJECTLENS]` **STAYS ON** (Andrew asset/inventory widget not yet online + tested).

> Do NOT mark D-11/D-12 "fully owner-proven / closed." The LABOR MODEL is proven; the foundation has the open items listed above.

### 2026-06-18 — THUNDER D-11/D-12 Stages 1-3: category dimension + labor model FOUNDATION + owner labor migrated (OWNER-PROVEN; Stage 4 owed)

**Type:** Schema (Stage 2, catalog-proven) + code (read path + capture mirror) + service-key seed. Staged verify-first, byte-identical proofs at each gate. **Stages 1-3 OWNER-PROVEN by David through live `/costs` under RLS.** Stage 4 (Settings reorg + write-path flip) OWED. Canonical: `docs/DECISION-cost-category-dimension.md` (D-11) + `docs/DECISION-labor-cost-model.md` (D-12).

**Stage 1 (verify-first):** traced labor (config `locations[].labor` {rate:75,hours:160,monthly,CONFIRMED} = $12,000/mo, in floor) → read path (`CostToProduce.tsx`→`accumulate`/`costConfigToEvents`) → write path (`CostToProduceSettings.tsx`). **Locked live anchor (service-key capture, supersedes the stale $12,239.67 snapshots AND the prompt's $12,279.67):** floor **$12,123** / est **$157.67** / known **$12,280.67** / unknown 2 (Twilio, Resend) / capex $6,917.31 / 18 cost_objects. **Found the load-bearing pivot:** the R2 double-count — `CostToProduce.tsx` strips `config.recurring` but RETAINS `config.labor`; migrating labor without a guard → floor jumps to $24,123.

**Stage 2 (schema, commit `e0f0d5f`, catalog-proven Q-W by David in SQL editor):** `cost_objects.cost_category` text nullable NO CHECK (per-business, AC-1) + `labor_resources` table (robust D-12: EMPLOYEE|CONTRACTOR, HOURLY|FLAT_FEE, employee base_wage/burden/cost_rate/bill_rate, contractor rate/pass_through_expenses; RLS owner_all+member_all, AC-2; trigger; index) + `cost_objects.resource_id` FK→labor_resources SET NULL + `cost_objects.labor_hours` numeric nullable NO default. Migration `20260618_cost_category_and_labor_resources.sql`; `verify-cost-objects.mjs` extended with catalog checks (Q)-(W).

**Stage 3 (commit `ce85cee`, BYTE-IDENTICAL proven, then OWNER-PROVEN):** `hasMigratedLabor` R1-safe guard in BOTH the read path (`CostToProduce.tsx`) AND the capture mirror (`capture-cost-before.ts`) — strip `config.labor` IFF a COST row with `cost_category IN ('labor','contract-labor')` (exact lowercase) exists; un-migrated tenants keep config.labor (byte-identical). `seed-owner-labor.mjs` (idempotent, service-key): 1 `labor_resources` "Owner" (EMPLOYEE/HOURLY, base_wage 75, cost_rate 75) + 1 applied-labor cost_object (cost_category='labor', OPEX, RECURRING_FIXED, MONTHLY, recurring_amount 12000, CONFIRMED, parent_id NULL, resource_id, labor_hours 160). **Proofs:** 3a guard-dormant floor $12,123/known $12,280.67; 3b guard-active **STILL** $12,123/$12,280.67 (`LABOR-3a/3b-snapshot.json`) — guard prevented the double-count. `build:cultivar` clean; `CostToProduce.tsx` tsc clean. **David owner-proved live `/costs` under RLS 2026-06-18.**

**STILL OWED — Stage 4:** Settings reorg into 4 distinct blocks (RECURRING & OPERATING / LABOR / MARGIN POLICY / TARGET CUSTOMERS) + contractor entry UI (rate basis hourly|flat + pass-through) + category picker (Schedule C ~15-20, real values only) + **re-point the write path off `config.labor`** (the read guard makes the still-writing `config.labor` harmless — ignored once the cost_object exists — but Stage 4 closes it). Margin engine + P&L block + spreadsheet grid DEFERRED onto the robust schema (no re-migration). `[TRACE:COST]`/`[TRACE:SEAM]` STAY ON until the D-11/D-12 feature is fully owner-proven (Stage 4); `[TRACE:PROJECTLENS]` stays ON (standing).

### 2026-06-18 — THUNDER Housekeeping: handoff CORRECTED + D-12 prompt/labor-addendum committed (docs only)

**Type:** Docs/handoff only. No schema, no code, no build → verification gate N/A. This entry SUPERSEDES the "owner-proof owed" wording in the 2026-06-17 entries below — both proofs are now DONE. Committed today: `docs/THUNDER-PROMPT-D11-D12-category-labor-foundation.md` (new, the D-12 build prompt), `docs/THUNDER-PROMPT-projectlens-ordering-and-unknown-accounting.md` (new), and the 2026-06-18 addendum on `docs/DECISION-labor-cost-model.md` ($12k = single owner-labor estimation line; Ignition is the labor exemplar).

**DONE / OWNER-PROVEN (no longer owed — the 2026-06-17 entries below are history):**
- **Unified cost model — OWNER-PROVEN (Step 8 passed).** Live `/costs` reads **$12,279.67/mo** (floor $12,123 + estimated $156.67); the 8 migrated recurring costs edit/assign/add/delete through the live UI under RLS; UNKNOWN stays unknown (no $0 fabrication).
- **Project-lens — OWNER-PROVEN end to end.** Inline-edit + confidence↔amount coherence (CONFIRMED-but-unknown unreachable); column headers (Cost · Confidence · Project · Amount) with real amounts; group ordering (Overhead pinned top, projects alphabetical, prefix-override via "1."/"A." naming); unknown-accounting honesty (one `isUnknownCost` predicate — top block lists genuine unknown COSTS grouped-by-project-as-label; group pills + top count agree); the 3 small fixes (live top-count via `onChanged`/`reloadKey`, ONE page-controlled resolve modal reachable top-or-bottom, clickable section titles → `/settings` and `/inventory`). Latest capability commit `27d28b4`.
- **Inventory page (`/inventory`) navigable** — David added a test row; shows on dashboard.

**NEXT BUILD (the open work — separate prompt):**
- **D-11 (cost category dimension) + D-12 (labor model FOUNDATION)**, bounded scope, per `docs/THUNDER-PROMPT-D11-D12-category-labor-foundation.md`. Staged verify-first migration. Pulls owner labor ($75×160, a SINGLE owner line) out of config into `cost_objects` byte-identical; adds category (Schedule C) + the robust labor schema; contractor case (Connor/Andrew) usable; Settings reorg into 4 blocks (recurring / labor / margin / target). Margin engine + P&L display + grid DEFERRED onto the robust schema (no future re-migration). Model decision: `docs/DECISION-labor-cost-model.md`.

**STANDING:** `[TRACE:PROJECTLENS]` stays ON until Andrew's asset/inventory widget is online + tested.

### 2026-06-17 — THUNDER Project-Lens small fixes: live top-count + one resolve modal + clickable section titles (BUILDER-COMPLETE, owner-proof owed)

**Type:** Display/input layer ONLY — `ProjectCostTree.tsx` + `CostToProduce.tsx`. Engine/math UNTOUCHED (OWNER-PROVEN). No schema → verification gate N/A. Three independent fixes from David's live owner-proof of the ordering build (3252c1d). The big model work (cost-category dimension, labor model) is SEPARATE — see the two new DECISION docs, NOT in this pass.

- **FIX 1 — page top count no longer stale on resolve.** The page-level "What we know" unquantified count is `analyze()` output (keyed `businessId`) — resolving a cost in the tree's modal updated the bottom (tree) but the top card lagged (3 vs 2) until refresh. `ProjectCostTree` now fires `onChanged` after every write (`reloadAll`); `CostToProduce` bumps a `reloadKey` in the analyze effect deps → top recomputes from the same fresh `cost_objects` immediately, no refresh.
- **FIX 2 — one resolve modal, reachable top OR bottom (also the structural fix for FIX 1).** The resolve modal is now CONTROLLED by the page (`resolveOpen`/`onResolveOpenChange` props; internal-state fallback when omitted). The page-level "N unquantified costs" block is a clickable button opening the SAME modal as the tree's block — one modal, one canonical set, the SAME shared `CostRow` editor (no second editor). Single source ⇒ can't drift.
- **FIX 3 — clickable section titles → edit surface.** "Cost & price by target customers (N)" → `/settings` (CostToProduceSettings: target-N/margin/reference). "Material costs (inventory)" → `/inventory` (existing `BusinessInventory` add/list page — clickable even when empty so David can hand-jam test rows; no new route needed, it already exists). `SectionTitle` gained optional `onClick` (green button + `›` chevron).

**Verified:** `build:cultivar` clean (2197 modules); `tsc` clean for both files. `[TRACE:PROJECTLENS]` STAYS ON (standing decision until Andrew's asset/inventory widget is online); `[TRACE:COST]` emits on page-block resolve-open.

**OWNER-PROOF owed (David, live /costs under RLS):** *FIX 1/2* — click the page-top "unquantified costs" block → it opens the same resolve modal the by-project block opens → resolve an unknown (ESTIMATED + amount) → it drops off the modal AND the top count decrements IMMEDIATELY (no refresh) → top and bottom agree. *FIX 3* — click "Cost & price by target customers" title → lands on Settings (the margin/target-N inputs); click "Material costs (inventory)" title → lands on `/inventory` (blank is fine) → add a hand-jammed test row.

### 2026-06-17 — THUNDER Project-Lens: group ordering + unknown-accounting honesty (BUILDER-COMPLETE, owner-proof owed)

**Type:** Display/input layer ONLY — `ProjectCostTree.tsx` (+ 1-line input filter in `CostToProduce.tsx`). Engine UNTOUCHED (CostRollup/CountOnceSeam/analyze/ProjectLens math). No schema → schema-verification gate N/A. Two fixes, same surface, one owner-proof.

- **FIX 1 — group order:** Overhead (company-level) PINNED to top (base layer, not a project competing alphabetically); projects below, sorted alphanumerically (A-Z, numeric-aware). Owner-controlled order via naming — prefix "1."/"A." = the sort key (no drag-reorder, no order column). Display-only sort over `view.groups`; adapter still returns input order.
- **FIX 2 — one honest definition of "unknown" everywhere** (`isUnknownCost` = ASSET/COST node with genuinely no amount; NEVER a project, NEVER a non-unknown cost). Top block + resolve modal + group pills + root count ALL read this ONE set → can't disagree. Before: analyze card OVER-counted (listed PROJECT nodes as unknown costs) while group pills UNDER-counted (`rollup.seam.unknownLines` dropped COST-typed nulls Resend/Twilio).
  - **(2a)** top block lists genuine unknown COSTS grouped by project-as-LABEL (`"CoolRunnings: HP ProDesk"` / `"Company-level: Resend, Twilio"`) — project = context, never a listed cost; count = real unknowns.
  - **(2b)** group pills count `g.children.filter(isUnknownCost)` (display count, engine untouched) → includes COST-typed nulls, matches the block.
  - **(2c)** click the block → resolve worklist modal: JUST the unknown costs, same 4 columns + the SAME coherent inline editor (extracted the row JSX → shared `CostRow`, used by both tree and modal — one editor). Resolve one → drops off the live set → block + modal shrink.
  - **`CostToProduce.tsx`:** `rollupEvents` now filters to `node_type ASSET|COST` before `fromCostObject` → PROJECT/PRODUCT buckets stop surfacing as phantom unquantified costs in the analyze card. NO dollar change (null bucket = $0; only the unknown count drops); the $12,239.67/mo KNOWN floor anchor is unaffected.

**Verified:** `build:cultivar` clean (2197 modules); `tsc` clean for both files. `[TRACE:PROJECTLENS]` STAYS ON (David's standing decision; + emits on resolve-worklist open). **Note on placement:** the new top block lives at the top of the by-project CARD (where the editor + canonical set live), not the very top of /costs — say the word to relocate it.

**OWNER-PROOF owed (David, live /costs under RLS):** *Ordering* — Overhead first → projects alphabetical (BuiltWithCAI, CoolRunnings, Farm) → rename a project with a "1."/"A." prefix → re-sorts. *Unknown-accounting* — top block lists only unknown COSTS grouped by project-as-label (no project listed as a cost; count = real unknowns) → group pills count the same set (Resend/Twilio included) → click the block → resolve modal lists just the unknowns with the 4 columns → resolve one inline (ESTIMATED + amount) → it drops off, block count shrinks, totals recompute → genuine unknowns still show "unknown".

### 2026-06-17 — THUNDER Project-Lens display fix: full-inline edit + column headers + confidence↔amount coherence (BUILDER-COMPLETE, owner-proof owed)

**Type:** Display/input layer ONLY — `packages/cultivar-os/src/components/ProjectCostTree.tsx`. Engine (CostRollup/CountOnceSeam/analyze/ProjectLens math) UNTOUCHED. Fixes 3 gaps David found in the live by-project tree after owner-proof:
- **(A) column headers** Cost · Confidence · Project · Amount.
- **(B) amount column** now reads the REAL value (`recurring_amount` + cadence suffix $/mo·$/yr for recurring; `acquisition_cost` one-time for capex) and is **inline-editable**. Root cause of "CONFIRMED…unknown": the column read `acquisition_cost` for every row → recurring rows (value in `recurring_amount`) showed "unknown". Fix = the tree now SELECTs + passes `cost_shape`/`cadence`/`recurring_amount` (ProjectLensRow already extends CostObjectNodeRow) so the already-shape-aware `fromCostObject`/`CostRollup` bucket recurring into the pool. NO engine change. Free side effect: group totals + root "Captured" now include recurring (overhead $279.67/mo).
- **(C) confidence↔amount coherence** (D-9 at input — CONFIRMED-but-unknown UNREACHABLE): UNKNOWN ⟺ no amount; →UNKNOWN clears amount; →other grade on an amountless row opens the amount editor first (David's HP ProDesk flow); setting an amount on UNKNOWN bumps to ESTIMATED.

**Verified:** build:cultivar clean (2197); tsc clean for the file. Data-level proof (service-key → buildProjectLens): Claude Pro $100/mo, Claude API $110/mo, domains $200/yr, capex one-time; per-row + group totals correct. **Live pre-existing incoherent row surfaced:** `HP ProDesk 600 G6` = ESTIMATED + no amount (David's earlier edit) — display flags it (shows "unknown"); fix makes it resolvable inline (click amount → enter), never fabricated. `[TRACE:PROJECTLENS]` STAYS ON (David's standing decision until Andrew's asset/inventory add widget is online — do NOT comment out).

**OWNER-PROOF owed (David, live UI under RLS):** open /costs by-project tree → columns labeled → every known cost shows its real amount (Claude Pro $100/mo etc.), no CONFIRMED-but-unknown → edit an amount inline + save → recomputes → set HP ProDesk (or any UNKNOWN) → pick a non-UNKNOWN grade → amount editor opens → enter value → saves coherently → Resend/Twilio still "unknown" → cannot leave a non-UNKNOWN cost with no amount.

### 2026-06-17 — THUNDER Unified Cost Model BUILD steps 0-3: schema delta WRITTEN/GATED + read-path made shape-aware (byte-identical) — STOPPED for backfill confirm

**Type:** Code (1 shared fn + its tests + 1 capture script + verify-script extension) + 1 GATED migration + docs. **STAGED BUILD-GO** — built the SAFE foundation (steps 0-3) per my own verify-first plan; the data-move (steps 4-8) is HELD for David's fresh confirm. Canonical spec: `DECISION-small-business-cost-accounting-model.md` (reshapes Option 2 — adds cost-NATURE). Three orthogonal tags on every cost: **PROJECT** (`parent_id`, built) × **NATURE** (CapEx/COGS/OpEx, NEW) × **SHAPE** (six shapes). Nature = how recovered; shape = how money behaves; node_type = what kind of thing.

**Step 0 — before-number anchor (read-only):** `scripts/capture-cost-before.ts` mirrors the live `/costs` tile EXACTLY (config + inventory + `cost_objects`→`fromCostObject`→`analyze`). Live capture → tenant 45830ba7 (TRACE) **KNOWN $12,239.67/mo** (floor $12,223.00 + est $16.67, unknown=5, capexExcluded $10,417.31 from 7 objects) = the OWNER-PROVEN figure. Snapshot: `docs/cost-to-produce/BEFORE-NUMBER-snapshot.json`. The gate: after the data-move the flat total MUST still equal this per tenant or STOP.

**Step 1 — schema delta APPLIED + CATALOG-PROVEN** (`supabase/migrations/20260617_cost_objects_shape_nature_source.sql`, append-only, applied live by David): `cost_shape`(6,NOT NULL DEFAULT ONE_TIME) · `cadence`(5,nullable) · `recurring_amount numeric(10,2)`(distinct from acquisition_cost) · `cost_nature`(CAPEX|COGS|OPEX,NOT NULL DEFAULT CAPEX) · `cost_source`(NOT NULL DEFAULT MANUAL, NO check — sources grow without migration) · `node_type` widened with `COST`. **SCHEMA-VERIFICATION GATE SATISFIED (§9):** `verify-cost-objects.mjs` (catalog checks (J)-(P)) run with PAT vs live `information_schema`/`pg_catalog` → **32/32 green**; (P) confirms all 7 rows defaulted ONE_TIME/CAPEX/MANUAL. Post-apply re-capture byte-identical ($12,239.67/mo — ADD COLUMN moved no data). Shapes 4-6 carry-cols deferred (honest-debt, no writer).

**Step 2 — `fromCostObject` SHAPE-AWARE** (`CountOnceSeam.ts`, the $0-collapse pivot): RECURRING_FIXED/PER_OCCASION → `MONTHLY_POOL` from `recurring_amount` ÷ cadence-to-monthly; ONE_TIME/absent → CAPEX from `acquisition_cost` (unchanged). **BYTE-IDENTICAL proven** by git-stash before/after capture diff ($12,239.67/mo unchanged) — because no live row carries `cost_shape` until the gated migration applies + the read path selects it. Tests 8a-8e added (CountOnceSeam **50→62**, each catches its bug). Siblings unbroken (CostRollup 21 / CostToProduce 17 / ProjectLens 26). `build:cultivar` clean (2197 modules); `tsc` clean for changed files. `[TRACE:COST]` ON at the analyze() boundary.

**Steps 1, 4, 5 done 2026-06-17.** Step 1: migration applied + 32/32 catalog-proven (David's PAT, since revoked). **Step 4 — backfill APPLIED** (`scripts/backfill-recurring-costs.mjs`, service-key, idempotent): tenant 45830ba7 8 recurring config lines → 8 `cost_objects` rows (node_type COST, nature OPEX, source MANUAL, shape RECURRING_FIXED, cadence←period, recurring_amount←amount with NULL/UNKNOWN preserved, lossless). Labor NOT migrated (R3). **Step 5 — EQUIVALENCE GATE PASSED** (`scripts/verify-backfill-equivalence.ts`): post-flip simulation (config recurring emptied + labor kept + cost_objects fed shape-aware through the seam) == anchor to the cent — floor $12,223.00 · est $16.67 · KNOWN **$12,239.67/mo** · capexExcluded $10,417.31; catalog-count 8==8. Lossless proven. Also fixed a rounding trap: removed per-event `round2` in `fromCostObject`'s recurring branch to mirror the config path's unrounded `toMonthly` (seam round2s the aggregate) — tests still 62 green.

**Step 6 — READ SOURCE FLIPPED 2026-06-17** (`CostToProduce.tsx` + capture mirror): page selects `cost_shape`/`cadence`/`recurring_amount`, feeds RECURRING_FIXED COST rows as the pool, STOPS counting `config.recurring` (labor stays in config — R3) → one source, no R2 double-count. **R1-safe guard:** recurring dropped ONLY when migrated COST rows exist (`hasMigratedRecurring`) — un-migrated tenants keep legacy config path byte-identical. **Live post-flip read PROVEN**: tenant 45830ba7 live KNOWN **$12,239.67/mo == anchor** (`AFTER-FLIP-snapshot.json`, service-key read). build/tsc clean. BUILDER-COMPLETE — live proof is service-key (data+compute); browser RLS owner-proof is step 8.

**Step 7 — WRITE PATH RE-POINTED 2026-06-17** (`CostToProduceSettings.tsx` rewritten): recurring editor reads/writes `cost_objects` (node_type=COST, source=MANUAL) not `config.recurring`. Adds nature picker (default OPEX), shape selector (RECURRING_FIXED/PER_OCCASION only — others withheld, deferred carry-cols = fake surface D-9), cadence, project picker→parent_id (real PROJECT nodes only: CoolRunnings/Farm + None), substantiation. UNKNOWN⇒null. Labor/margin/denoms stay in config (R3); config.recurring preserved untouched. **Truncation-guard preserved in row model:** per-row INSERT/UPDATE-by-id/DELETE-by-id (explicit removals only, `removedIds`) — no bulk overwrite; failed read blocks save. Verified service-key round-trip (all CHECKs + parent_id FK pass, UNKNOWN→null, 8 rows restored). build/tsc clean. BUILDER-COMPLETE.

**NEXT — Step 8 OWNER-PROOF (David, the last bar):** through the LIVE UI under real RLS (logged in as owner, anon key) — (1) `/costs` reads **$12,239.67/mo** (floor $12,223 + est $16.67, capex $10,417.31 excluded); (2) Settings → Cost-to-Produce shows the 8 migrated costs with correct nature/shape/cadence/confidence; (3) edit a cost (e.g. Claude Pro $100→$110) + Save → `/costs` recomputes; (4) assign a cost to CoolRunnings/Farm via the project picker → it appears under that project in the by-project tree; (5) add a new cost + Save → appears; delete it → gone (others untouched); (6) confirm a recurring cost with UNKNOWN stays unknown (no $0). Once proven, comment out `[TRACE:COST]`/`[TRACE:SEAM]` (don't delete). Until then they stay ON. Next layers NAMED not built: API connectors (via `cost_source`) + AI-classify (manual-first).

### 2026-06-16 — THUNDER D-10: Project-Lens BUILT (cost-to-produce BY PROJECT) — BUILDER-COMPLETE, owner-proof owed

**Type:** Code (1 shared adapter + its test + 2 cultivar components + 1 page wire) + built-inventory. No schema touched (reads live `cost_objects`, writes only `parent_id`/`cost_confidence`/PROJECT rows via existing RLS) → schema-verification gate N/A. **BUILDER-COMPLETE, NOT owner-proven.** Gate re-confirmed against the final design before building; David settled all four open questions (wiring=PATH A, placement approved, cadence deferred, owner-proof=two-tenant test).

**What:** the "By project" lens on `/costs` (DECISION-project-lens-ui-design.md). Collapsible tree — tenant business-NAME as visual root (rendered, NOT stored — §2 tenant≠project), `parent_id`-null costs as "Platform overhead", each PROJECT node with its rollup total (capex one-time vs /mo separated, unknowns surfaced never $0). Flat company top-line RETAINED above (D-10: project cut ADDED). Click-to-edit confidence + parent-reassignment (a MOVE, single-parent §3); cadence DEFERRED (no column — would be a fake surface, D-9). Projects manager modal creates/renames/deactivates PROJECT buckets (deactivate re-points children → company-level, never cascade-destroyed).

**PATH A wiring (the load-bearing note):** `CostRollup.rollup()` traverses the `cost_object_edges` *table*, NOT the `cost_objects.parent_id` column — two different mechanisms. The shared `ProjectLens.ts` adapter bridges them: synthesizes containment edges (`use_fraction=1.0`) from `parent_id` at read time, rolls each group up THROUGH `CostRollup` + the count-once seam. Single-parent + fraction 1.0 ⇒ identical number today; composes for free when real edges/assignments rows arrive (AC-4, settle once). Honesty engine (D-9) UNTOUCHED — re-cuts the same honest data.

**Files:** `packages/shared/src/business-logic/ProjectLens.ts` (+ `.test.ts`, exported via index) · `packages/cultivar-os/src/components/ProjectCostTree.tsx` · `…/ProjectsManager.tsx` · `…/pages/CostToProduce.tsx` (renders the tree below the top-line).

**Verified:** `ProjectLens.test.ts` **26/0** (each catches its bug — grouping, overhead bucket, UNKNOWN surfaced never $0, reassignment-as-MOVE recomputes both totals, single-parent no-double-count, dangling-parent fallback+flag, count-once company total). **Bug caught + fixed mid-run:** a PROJECT node's null own cost leaked into the flat total as a phantom unknown → now filtered (mirrors CostRollup gather step 1). Siblings unbroken: CostRollup **21** / CountOnceSeam **50** / CostToProduce **17**. `npm run build:cultivar` **2197 modules** (+3); `tsc --noEmit` clean for all four files (pre-existing `Confirmation.tsx` cart-store errors unrelated). `[TRACE:PROJECTLENS]` ON by default until owner-proof.

**NEXT — David's two-tenant owner-proof (proves lens AND tenant isolation in one pass):** (1) logged into **TRACE** tenant (`45830ba7…`, where seeded hardware lives) — create CoolRunnings + BuiltWithCAI, assign hardware, reassign one cost (e.g. tractor overhead→project) and watch BOTH totals recompute, confirm no double-count + collapse/expand + click-to-edit. (2) logged into **LAWNS** — confirm TRACE's hardware is ABSENT ("right kind of empty" = RLS/AC-3 holds). Build is tenant-agnostic (reads `businessId` from context). `[TRACE:PROJECTLENS]` stays ON until both pass.

### 2026-06-16 — THUNDER Core-1 ACTIVATION: D-5 substantiation ALTER applied + real CoolRunnings seed (LIVE WRITE)

**Type:** Live schema apply + live data seed + doc housekeeping. Migration committed (`4da0b47`); doc + seed this session. **BUILDER-COMPLETE + catalog-PROVEN, NOT owner-proven.**

**Schema (LOOK-confirmed Option 2, then applied):** added the second D-5 axis to live `cost_objects` (bgobkjcopcxusjsetfob) — `substantiation text NOT NULL DEFAULT 'OWNER_ASSERTED' CHECK (IN 'SUBSTANTIATED','OWNER_ASSERTED')` + `receipt_id uuid REFERENCES receipts(id) ON DELETE SET NULL`. Code-matched to `CountOnceSeam.ts` (Substantiation union :78; `fromCostObject` reads both fields independently — not derived). Migration `20260615_cost_objects_substantiation_d5.sql`. **Live state at apply: Core-1 rename was ALREADY applied** (probed: `business_assets` gone PGRST205, `cost_objects`+node/edge present) → ALTER only, no double-apply. `NOT NULL DEFAULT` backfilled the one pre-existing owner-entered row ("tractor mahindra") → default proven on real data. PAT was applied-then-revoked by David (security hygiene after I flagged it in transcript); seeding needs no PAT (DML via service key).

**Verify (INDEPENDENT catalog gate, not builder memory):** `scripts/verify-cost-objects.mjs` **22/22 green** — extended with (G) substantiation type/null/default, (H) CHECK both values, (I) receipt_id FK SET NULL; fixed the old-name round-trip soft-check (head:true masked PGRST205 → real row-select).

**Seed (LIVE, tenant 45830ba7 "TRACE Enterprises", REAL active OWNER membership ba7cf242…cd2db1ecb9ba — NOT fabricated; prereq confirmed membership before write):** real CoolRunnings hardware from `docs/coolrunnings-hardware-spend-2026-06-02.md` as `node_type='ASSET'` — NSPanel Pro 120 ×2 ($259.80 CONFIRMED/SUBSTANTIATED) + MINI Duo-L ×3 ($65.70 CONFIRMED/SUBSTANTIATED) sharing the real Amazon Order #114-2466808 receipt (→ `sameCost` DISTINCT: same receipt, different line amounts), meross MTS300HK ($91.81 DERIVED/OWNER_ASSERTED, no receipt → axis-2), HP ProDesk 600 G6 (cost NULL **not zeroed**, UNKNOWN/OWNER_ASSERTED). Seeded alongside the pre-existing owner tractor. **NEXT (separate): OWNER-PROVE** the seam-fed tile through the live UI under RLS — `[TRACE:*]` stays ON until then.

### 2026-06-15 — THUNDER Core-2b: full sameCost matcher + dual-edge rollup + live-tile seam-feed (BUILD, deploy-safe)

**Type:** Code (3 shared business-logic files + 2 new test files + 1 cultivar tile) + docs. ONE commit (Core-2b unit). No schema touched (read-only of a gated table) → schema-verification gate N/A. **BUILDER-COMPLETE, NOT owner-proven.** Built on `17a468f` (a mid-session built-inventory gap-entry commit that referenced SUB-2's result).

**SUB-1 — full `sameCost`** (`CountOnceSeam.ts`): swapped the Core-2a bare `SAME/DIFFERENT/UNSURE` string for a `CostMatch` — **MERGE | DISTINCT | NEED_CLARIFICATION** + epistemic bucket (D-9) + reasoning + cost SHAPE (D-8 `classifyShape`: explicit `cadence`/pool-provenance OR inferred from date spacing) + suggested disposition (DATA only; accept/reject UI is #38). Canonical car-wash: two $9.99/mo same-merchant → NEED_CLARIFICATION + RECURRING_FIXED + "two subscriptions (two vehicles / business+personal) or one across two periods?" — no under-count, not per-occasion. `enforceCountOnce` maps MERGE→dedup, NEED_CLARIFICATION→flag (rides through on `possibleDuplicates[].match`), DISTINCT→keep.

**SUB-2 — dual-edge rollup** (`CostRollup.ts`, NEW): `rollup(targetId, graph)` traverses BOTH edge tables (D-4) — structural `cost_object_edges` (`use_fraction`, §5.2/5.5/5.7) + temporal `cost_object_assignments` (period-share, conversion-on-receiving, §5.9) — feeding events THROUGH the seam (capex excluded, dedup). Surfaces idle capital + conservation. Rabbit/tractor: $5,000 = rabbit $1,707.55 + chicken $3,000 (+$300 conv) + idle $292.45 = **$4,999.95 ≈ $5,000**. Business-level tile uses FLAT count-once (not rollup-sum — that double-counts parent+child); rollup is the per-node surface.

**SUB-3 — live-tile seam-feed** (`CostToProduce.ts` + cultivar `CostToProduce.tsx`): `accumulate()/analyze()` gained optional `{ rollupEvents }`; when fed real captured `cost_objects`, config + objects go through the ONE seam — CAPEX excluded from ÷N pool, cross-source dups counted once, captured recurring folds in. **DEPLOY-SAFE / DORMANT:** `cost_objects` migration is gated/unapplied → tile fetch relation-errors → `rollupEvents=[]` → byte-identical to the proven config-only path. Lights up only on deliberate migration apply (HELD by David).

**Verified:** 3 suites green (CountOnceSeam **50** / CostRollup **21** / CostToProduce **17**, each catches its bug); `tsc --strict` clean; `npm run build:cultivar` passes (2194 modules). `[TRACE:SEAM]`/`[TRACE:ROLLUP]`/`[TRACE:COST]` ON, unconditional, until owner-proof. **HELD (David, deliberate):** apply migration `20260615` → `verify-cost-objects.mjs` (catalog gate) → seed → owner-prove the live seam-fed tile. Built-inventory updated (Core-2b section + Core-2a sameCost line). Trimmed the two oldest CAPTURE entries → `docs/handoff-archive.md`.

### 2026-06-15 — THUNDER 3-LENS A/B: re-ran the asset-node schema decision through HAVE/NEED/WANT (RECON)

**Type:** Docs only. One commit. READ-ONLY — no schema/code/migration/build → schema-verification gate N/A, no BUILT-INVENTORY change. Sole write: `docs/cost-to-produce/ASSET-NODE-SCHEMA-DECISION-3LENS.md` (separate file so David can diff vs the first run). A/B test of the recon *method* — same question, same data, new three-lens structure.

**Result — same call (C, rename-in-place), richer trade space + firmer reason.** Three lenses surfaced what the flat A/B/C first run missed: **(1) two NEW options** — **D** (minimal: add only `parent_id`+`node_type` in place, defer the rename — but a way-station, and D-then-C pays the 6-site repoint twice) and **E** (view-bridge); **(2) a NEW fact** — grep shows `business_assets` has **no seed/insert path beyond the UI form → ~zero rows**, so B's "data migration" objection collapses (still dominated by C on FK-auto-follow); **(3) a NEW dominance** — **A is dominated by E** (E gives A's "don't touch asset code" win without A's per-asset dual-write), so A retired as runner-up; **(4) the deepest find** — the §5.2 attribution edges are inherently cross-node-type (ASSET→PROJECT→PRODUCT), so they need ONE FK-able id-space → **"one table" moves from tidiness-WANT toward NEED.** That upgrades "why C" from *drift-avoidance* (first run) to a *structural edge-NEED*. **Recommendation C** trades WANT-4/WANT-5 (clean asset `status` + no null-pile) for WANT-1+NEED#3 (unified node table) + WANT-3 (no dual-write); tips to D only if Core-1 weren't already opening this schema — but it is, so fold the rename in now. HAVE re-verified from migration source (not the first-run doc): 20 cols, 2 FK dependents (`business_pmi_schedule`/`business_service_log` `.asset_id`), 6 `.from()` call sites (PMI.tsx ×4, BusinessAssets.tsx ×2), lone `status` conflict, RLS reusable. **A/B verdict: three lenses earned their keep on option-coverage + rationale, not by overturning the call.** David decides A/B/C/D/E — recon only, no migration written. **If three-lens proves itself, encode as a standing recon standard separately (not this run).**

> Older session history (BUILD/DESIGN-CAPTURE/TILE-CLASS/LAYER-DEFS/SWEEP and all earlier entries) archived at [docs/handoff-archive.md](docs/handoff-archive.md) — NOT loaded at session start.

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
- [x] Per-vertical theming in shared OwnerSignup ✅ (backgroundColor/cardColor/examples — June 4)
- [x] New-owner demo path through OnboardingWizard ✅ (signup → /onboarding — June 4)
- [x] DiscoveryGlimpse as verticalStep in Cultivar signup ✅ (June 4)
- [x] Blotato Account ID removed from SocialSetup; fetched server-side ✅ (June 4)
- [x] Ignition sign-in loop fix ✅ (CoreApp.jsx OWNER SYNC — June 4)
- [x] Ignition signup text-on-dark-card contrast ✅ (darkMode config flag — June 4)
- [ ] Blotato /v2/users/me/accounts response shape verification
- [ ] Online Shop (/shop page)
- [ ] Customer follow-up engine
- [ ] Mobile responsive fix (tile grid desktop only)

### 🟡 HOUSEKEEPING (AC-1: variation lives in one declarative place)

One principle applied to three domains — schema, docs, vertical setup — sequenced AFTER
the demo. Together they close the gap between "works now" and "new vertical = one config
file, zero component edits."

**Schema — Noun Purge** (audit #1/#2/#5/#6 in `docs/audits/platform-naming-vertical-leak-audit-2026-06-03.md`)
Do as a set, not piecemeal.
- [x] `nursery_modules` → `business_modules` ✅ 2026-06-04 — migration written, 6 API/hook files repointed, membership-scoped RLS, build clean. ⚠️ David must run migration in Supabase SQL editor before deploying, then run `node scripts/verify-business-modules.mjs` to confirm counts, then `DROP TABLE nursery_modules CASCADE;`
- [ ] `nursery_profiles` → `business_profiles` (migration + update OnboardingWizard + Settings consumers)
- [ ] `AIEngine.ts` — rename `shopId`/`shop_id` → `businessId`/`business_id` across all 9 public methods;
      update 3 Ignition modules that import these (IgnitionAudit, IgnitionCipher, PredictiveKey)
- [ ] `packages/shared/src/qr/print.ts` — rename `nurseryName` → `businessName`, `.nursery` CSS → `.business-name`;
      update one call site in Cultivar PlantProfile

**Docs — Doc Reorg** (single-source every fact; reference, don't copy)
- [ ] Lean CLAUDE.md to rules + state + pointers only — no architecture prose duplicated here
- [ ] PLATFORM_STRATEGY.md is the sole architecture home (already partial — continue)
- [ ] BUILT-INVENTORY.md links to audit docs via POINTERS (capability entry + reference link), never inlines audit content. Keep the index lean and scannable. Audit docs stay separate and authoritative for detail.
- [ ] Single-source the "TRACE — Who We Are" philosophy block across all docs (sync or point; eliminate copies)
- [ ] Enforce chronological THOUGHTS.md + grep-by-date recovery workflow

**Vertical Setup — Vertical Config Extraction** (variable inventory in `docs/audits/vertical-config-variable-inventory-2026-06-03.md`)
Audit half DONE (read-only, 2026-06-04). Refactor half is post-demo.
- [ ] Build `packages/shared/src/config/VerticalConfig.ts` — typed config object per business_type
      (identity, theme, copy, vocabulary, modules, integrations, behavior defaults)
- [ ] Seed config entries for cultivar-os and ignition-os (migrate existing scattered values in)
- [ ] Thread config reads through shared components (OwnerSignup, tiles, discovery, notifications)
- [ ] Success test: new vertical = one config file + zero component edits

### 🟢 POST-DEMO (Phase 1 — after signing)

- [ ] Settings page: Lauren can set default install price at nursery level
      (nurseries.default_install_price column + /settings UI)
      Install price currently hardcoded per plant in seed data at $225
- [ ] Per-plant install price override on plant detail page
      (plants.install_price editable in plant profile UI)
- [x] ~~Tighten nursery_modules RLS~~ — resolved 2026-06-04 via `business_modules` membership-scoped RLS
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

- packages/shared/src/quickbooks/oauth.ts
  (IGNITION_OS_DATA hardcoding — post-demo fix)
- packages/shared/src/supabase/auth.ts
  (PIN auth — post-demo refactor)
- Old Supabase project ufsgqckbxdtwviqjjtos
  — never reference in cultivar-os code (exception: the drop migration
  20260602_ignition_drop_team_tables.sql targets this project intentionally)
- Any already-run Supabase migrations
- ~~nursery_modules RLS policy authenticated_select_nursery_modules~~ — retired 2026-06-04, replaced by business_modules membership-scoped policy
- main branch — multi-tenant-extraction was merged 2026-06-03. All work now goes directly to main or feature branches as appropriate.

**STANDING INSTRUCTION (owner, do NOT cross without David):** TRACE instrumentation `[TRACE:*]` is ON by OWNER instruction — do NOT comment out or delete any emit until David explicitly lifts it. This OVERRIDES the STD-003 post-OWNER-PROVEN comment-out default. Applies to `[TRACE:COST]`, `[TRACE:SEAM]`, `[TRACE:opcosts]`, `[TRACE:PROJECTLENS]`, and any new area.

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

Full protocol (steps 1–16, file-size check, gap/debt routing, gap graduation, schema verification gate):
**[docs/end-of-session-protocol.md](docs/end-of-session-protocol.md)**

**MID-SESSION GATE — SCHEMA VERIFICATION:** Any session that creates or alters a table, column, policy, constraint, FK, or trigger is NOT done until Thunder outputs catalog-backed verification proving the change. Queries hit the live catalog (`information_schema` / `pg_catalog`), NEVER the builder's memory. Structure AND RLS must both be proven. Standard query set in `docs/end-of-session-protocol.md` → SCHEMA VERIFICATION GATE section.

**STANDING INSTRUCTION (owner, binding — enforced like the TRACE-stays-on rule):** On EVERY BUILDER-COMPLETE, updating `docs/built-inventory.md` to reflect what shipped is a REQUIRED closing task, NOT optional. `built-inventory.md` is the running source-of-truth ledger and MUST NOT drift behind the code. The session write-back MUST state, in its own line, what was added/changed in the ledger (capability entries touched + `Last updated:` bumped to today). A BUILDER-COMPLETE deliverable whose ledger entry is missing or stale is an INCOMPLETE task — same force as the schema-verification gate above, the widget-header gate (step 8), the STD-003 gate (step 9), and the three-lens gate (step 10). This fires whether or not a prompt remembers to ask. Ledger drift is tech-debt #39's class (ledger/schema divergence) — do not add to it.

**Quick reference — mandatory close sequence:**
1. Update Handoff (Part 3) + Active Tasks (Part 4) + Off Limits (Part 7)
2. Confirm no hardcoded URLs or keys
3. `git add CLAUDE.md && git commit && git push`
4. Tailwind drift check · Documentation propagation check · Factual correction capture
5. Runbook if env/infra work · AC compliance check · STANDARDS compliance check
6. Gap graduation sweep · PLATFORM_STATE.md level changes
7. **Update BUILT-INVENTORY.md (REQUIRED on every BUILDER-COMPLETE — see the STANDING INSTRUCTION above)** — bump `Last updated:` to today + add/update every capability changed this session, and STATE in the write-back what ledger entries were touched. **Verify line 4 date = today before committing.** Not optional; ledger must not drift behind code (tech-debt #39 class). (Full protocol: step 17 in docs/end-of-session-protocol.md)
8. **Widget-header gate (binding):** every new/modified widget·tile·component·module·page·endpoint carries a HEADER (PURPOSE · DEPENDENCIES · OUTPUTS) AND is listed in BUILT-INVENTORY.md — a built artifact without a header is an incomplete task. (Doctrine: partnership doc §15; full gate: protocol Step 10 + Step 17.)
9. **STD-003 instrumentation gate (binding):** every build that adds/changes a capability ships TRACE instrumentation (`[TRACE:area]`) **ON BY DEFAULT** — actively emitting, NOT wrapped behind a false flag, NOT default-silent, NOT deleted. It stays ON until the feature is **OWNER-PROVEN** by David through the actual UI under real RLS (see the two-bar rule below). A build that strips, omits, or pre-silences debug before owner-proof is an **INCOMPLETE task** — same force as the header gate. Only AFTER owner-proof does debug get **COMMENTED OUT** (not deleted) — dormant, re-enabled by uncommenting next time the code is touched. "On by birth, commented out by earning it." This gate fires whether or not a prompt remembers to ask: if a build prompt omits STD-003, the prompt is itself incomplete and Thunder adds the instrumentation anyway. (Doctrine: STANDARDS.md STD-003; partnership doc §16; DECISIONS.md OP-4.)

   **The two completion bars — state which one a deliverable is at:**
   - **BUILDER-COMPLETE (Thunder):** code works, builds pass, verified against data / service-key round-trip.
   - **OWNER-PROVEN (David):** David has used the feature through the ACTUAL UI, under REAL permissions (RLS), and confirmed it does what it should.
   - Instrumentation stays ON between the two bars. **Thunder reporting "builder-complete" does NOT authorize removing debug — only owner-proof does.** Builder verification ≠ owner verification: a service-key round-trip can pass while the RLS/UI path still fails (demonstrated by the Cost-to-Produce fix, 2026-06-14 — round-trip green, UI-save-under-RLS unproven). Thunder must state which bar each deliverable is at.
10. **Three-lens recon gate (binding) — fires at RECON time, not close:** every verify-before-build / decision recon ("LOOK") reports in THREE LENSES — **HAVE** (current state, `file:line`), **NEED** (irreducible minimum to meet the requirement, no preference), **WANT** (desired end-state / clean architecture, labeled as want) — and presents OPTIONS spanning NEED→WANT (cheapest-meets-need → fullest-meets-want), NOT one pre-collapsed recommendation. A recon without the three lenses is an **INCOMPLETE task** — same force as the header (item 8) and STD-003 (item 9) gates, and fires whether or not a prompt asks. (Doctrine: partnership doc §17; DECISIONS.md OP-8; proven by the asset-node schema A/B test, exemplar `docs/cost-to-produce/ASSET-NODE-SCHEMA-DECISION-3LENS.md`.)

---

## 10. SESSION STARTER

Paste this at the start of every Claude Code session:

```
Read CLAUDE.md before we begin.
Read PLATFORM_STATE.md — verified current state (LEVEL + LOCATION + EVIDENCE).

Current session: [describe task]
Today's goal: [specific deliverable]

Before writing any code confirm:
1. What was completed last session (from Handoff)
2. What shared modules this session needs
3. Those modules exist in packages/shared/src/ AND are at WIRED or WORKS level in PLATFORM_STATE.md
4. `docs/built-inventory.md` `Last updated:` is not older than the latest capability commit — if stale, FLAG before using it to answer "was X built?"
5. `docs/inventory-functions.md`, `docs/inventory-env.md`, `docs/inventory-ai.md` dates — if any is older than the latest commit touching its domain, FLAG as stale before answering "what functions/vars/AI routes do we have?"
6. **Verify-before-build:** before building NEW capability, check BUILT-INVENTORY.md + grep the codebase for existing capability — if it exists, extend/reuse, do NOT rebuild (partnership doc §15).
7. **STD-003 instrumentation (binding gate):** any build that adds/changes a capability ships `[TRACE:area]` instrumentation ON BY DEFAULT (emitting, not flagged-off, not silent, not deleted) and keeps it on until OWNER-PROVEN by David through the real UI under RLS. Omitting/pre-silencing debug = INCOMPLETE. Fires even if this prompt didn't ask. State which bar each deliverable is at: BUILDER-COMPLETE vs OWNER-PROVEN (§9, partnership doc §16, DECISIONS.md OP-4).

Do not start until you confirm all seven.
Do not touch ignition-os, old Supabase project,
or QB oauth.ts.
```

---

*TRACE Enterprises · Built with CAI*
*cultivar-os.vercel.app · builtwithcai.com*
*(512) 456-3632 · david@trace-enterprises.com*
*Update this file every session. No exceptions.*
