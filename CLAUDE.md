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

Active open items: #2 (QB hardcode), #3 (social in cultivar), #4 (nursery footer), #8 (RLS unverified), #10 (SavingsReport missing), #12 (Ignition AI dark / Railway kill path), #13 (stub duplication), #16 (MarginEngine orphaned — A callers + plants.cost_price), #17 (dead migration), #18 (pin_hash unverified), #19 (instagram fallback), #20 (platform union), #21 (orphaned campaigns files), #22 (platform_check migration — David must apply), #23 (STD-008 inverse sweep pending), #24 (opaque names), #25 (6 AI features dark), #26 (orphaned DataBridge keys), #27 (10 tables no migrations), #28 (pilot_all RLS open), #29 (receipts naming), #30 (voice-samples RLS scope), #31 (catalog-verify process), #32 (cultivar_plants anon read open)

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

### 2026-06-13 — THUNDER FINISH: cultivar_plants policy cleanup — drop redundant public-read, scope owner write (AC-3)

**Type:** RLS-policy-only migration. Zero code. Zero shared-module edits. Zero new pages/functions/env. Closes the cultivar_plants thread.

**Session mandate:** Close the policy chaff left by the untangle. The untangle migration was RUN; catalog checks C1/C2/C4/C5 came back CLEAN, but C3 surfaced FOUR policies on `cultivar_plants` — two redundant/over-broad leftovers carried over from the old `plants` table.

**STEP 0 GATE confirmed:** Last handoff: THUNDER UNTANGLE (plants → cultivar_plants). No shared modules touched (this is a single-table RLS migration). Off Limits (Part 7) clear — oauth.ts, auth.ts, old project, run migrations all untouched.

**The four policies C3 found (confirmed via qual):**
- `anon_select_plants` — anon · SELECT · `USING(true)` → **KEEP** (QR scan resolves a scanned tag; page is unauthenticated)
- `cultivar_plants_owner_select` — authenticated · SELECT · owner-or-member scoped → **KEEP**
- `plants_business_owner` — public · ALL · `business_id IN (owner's businesses)` → **REPLACE** (the ONLY policy granting owner WRITE; can't just drop)
- `plants_select_public` — public · SELECT · `USING(true)` → **DROP** (redundant with anon_select_plants)

**Migration `supabase/migrations/20260613_cultivar_plants_policy_cleanup.sql`:**
1. `DROP POLICY plants_select_public` — redundant public read.
2. `CREATE POLICY cultivar_plants_owner_all` (authenticated, FOR ALL, owner-via-businesses.owner_id OR active business_members; USING + WITH CHECK both the membership predicate) → then `DROP POLICY plants_business_owner` (the public/ALL leftover it replaces). Net: owner/member keep scoped write; the public write-hole shape is gone.
3. `anon_select_plants` + `cultivar_plants_owner_select` left untouched.

**Two catches that shaped the migration:**
1. `plants_business_owner` was the ONLY WRITE grant (SELECT policies don't write) — so it was REPLACED, not dropped, or owners lose write to their own plants.
2. The real scan→checkout is SERVER-MEDIATED (QBO creds can't live in an anon browser), so blanket public read (`USING true`) is NOT load-bearing for checkout. `anon_select_plants` stays only so the public plant page can resolve a scanned tag.

**VERIFY (catalog-backed — David runs in bgobkjcopcxusjsetfob SQL editor; queries embedded as comments in the migration, not graded here):**
- V1: exactly THREE policies remain — anon_select_plants (anon/SELECT), cultivar_plants_owner_select (auth/SELECT), cultivar_plants_owner_all (auth/ALL). `plants_business_owner` + `plants_select_public` GONE.
- V2: zero public/ALL policies (write-hole shape eliminated).
- V3: RLS still enabled (`relrowsecurity = true`).

**AC compliance:** AC-3 ✅ — tenant isolation: write scoped to owning business (owner_id) or active member; public write-hole removed. AC-1 ✅ — no vertical nouns; `cultivar_` prefix marks the vertical identity join.

**Verification doc:** `docs/verification/20260613_cultivar_plants_verification.md` — Part A records the untangle C-checks (C1/C2/C4/C5 PASS, C3 = the 4 policies). Part B records V1–V3 as PENDING David's apply (two-half protocol, Tech Debt #31). PLATFORM_STATE reflects the split.

**Tech Debt #32 logged:** `anon_select_plants` USING(true) exposes ALL plant-identity rows to anon, not just a scanned one. Acceptable (non-sensitive identity + server-mediated checkout) — **do not act, David's call.**

**No code changes → no build run (RLS-only migration). No new env vars, functions, or pages.**

**PLATFORM_STATE.md level changes:**
- `cultivar_plants table`: WIRED → **WIRED (untangle catalog-confirmed; policy cleanup pending David apply)**. Cited cleanup migration + verification doc. Flips to verified once David runs cleanup + pastes V1–V3.

**Scope boundary (NOT done — separate, sequenced, gated on LAWNS yes):** lot population, accrual ladder, scan→QBO connector (QBO invoice path already built; this is a CONNECTOR build "if LAWNS says yes"), MarginEngine caller.

**⚠️ HOUSEKEEPING — TOP next-session item:** CLAUDE.md is ~860 lines, well over the 600-line context budget. **Archive older handoff entries (the pre-UNTANGLE 2026-06-13 set: VALIDATE-THEN-CLOSE, VOICE-SCHEMA, INVENTORIES, PMI, AC-5) to `docs/handoff-archive.md`** to keep session context load manageable. Deliberately NOT done in this commit to keep it scoped to the RLS change (commit message is `fix(rls):`). Do it first thing next session.

**Next steps for David:**
1. **Run `20260613_cultivar_plants_policy_cleanup.sql`** in bgobkjcopcxusjsetfob SQL editor — drops `plants_select_public`, replaces `plants_business_owner` with `cultivar_plants_owner_all`.
2. **Run V1–V3** (embedded in the migration) and paste results into `docs/verification/20260613_cultivar_plants_verification.md` Part B → then PLATFORM_STATE flips to verified.
3. ⚠️ **CARRY-FORWARD — still unrun: `20260613_business_service_log_result.sql`** (PMI log result field) — run in bgobkjcopcxusjsetfob; PMI log result INSERT errors without it.
4. ✅ (carry-forward) `20260613_cultivar_plants_untangle.sql` — confirmed RUN (C1/C2/C4/C5 clean).
5. **Lot population** (next build step, gated separately) — INSERT business_inventory rows for LAWNS SKUs, UPDATE cultivar_plants.inventory_id, restoring QR checkout.

---

### 2026-06-13 — THUNDER UNTANGLE: plants → cultivar_plants (identity-only, FK to business_inventory)

**Type:** Schema migration + code repoint. Zero new pages. Zero shared-module edits. Zero env/infra changes.

**Session mandate:** Untangle the `plants` table from double-duty (identity + stock facts) into a pure vertical identity join table (`cultivar_plants`). Stock facts (status, price, arrived_at) now live exclusively on `business_inventory`. QR scan flow updated to read stock from `business_inventory` via `inventory_id` FK.

**STEP 0 GATE confirmed:** Last handoff: business_voice_samples VALIDATE-THEN-CLOSE. No shared modules touched. Off Limits clear.

**What was done:**

- **Migration** `supabase/migrations/20260613_cultivar_plants_untangle.sql`:
  - `ALTER TABLE plants RENAME TO cultivar_plants` (Postgres auto-updates FK from order_items.plant_id)
  - `ADD COLUMN inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL` (nullable — lot population is sequenced separately)
  - `DROP COLUMN nursery_id` (AC-1 violation)
  - `DROP COLUMN status, arrived_at, base_price, install_price` (stock facts → belong on business_inventory)
  - RLS: `authenticated_select_plants` dropped (referenced dropped nursery_id) → `cultivar_plants_owner_select` created (business_id + membership-scoped, matches business_assets/business_inventory pattern)
  - Verification query block (C1–C6) embedded in migration file for David to run post-apply

- **Type** `packages/cultivar-os/src/types/plant.ts`:
  - `Plant` interface: removed `status`, `arrived_at`, `base_price`, `install_price`, `nursery_id?`; added `inventory_id: string | null` + `business_inventory?: PlantInventory | null`
  - New `PlantInventory` interface: `{ id, qty, unit_cost, status, received_at }`
  - `PlantEvent`: removed `nursery_id?` (AC-1 cleanup in the type)

- **Hook** `packages/cultivar-os/src/hooks/usePlant.ts`:
  - Query changed: `from('plants').select('*')` → `from('cultivar_plants').select('*, business_inventory ( id, qty, unit_cost, status, received_at )')` (PostgREST FK join via inventory_id)
  - Third count query REMOVED — `availableCount` now comes from `plant.business_inventory?.qty ?? 1`

- **Code repoint — 17 files (zero references to old table name / dropped fields):**
  - `PlantHero.tsx`: `arrived_at` → `business_inventory?.received_at`; `status` → `business_inventory?.status`; `base_price` → `business_inventory?.unit_cost`; `install_price` → removed
  - `PlantCard.tsx`: `base_price`, `status` → `business_inventory?.unit_cost`, `business_inventory?.status`
  - `PlantProfile.tsx`: `isUnavailable` uses `!inv || inv.status !== 'available'`; price uses `unitCost * qty`
  - `AddOns.tsx`, `CartReview.tsx`, `Confirmation.tsx`, `useSubmitOrder.ts`: `plant.base_price` → `plant.business_inventory?.unit_cost ?? 0`
  - `api/dashboard.ts` (API): `from('plants').select('base_price, status')` → `from('cultivar_plants')` count + `from('business_inventory').select('qty, unit_cost, status')` for value/count
  - `src/pages/Dashboard.tsx` (client): same — `plants` → `business_inventory` for inventory tile
  - `api/orders/submit.ts`: price line uses `business_inventory?.unit_cost ?? 0`; reserve step: `from('plants').update({ status: 'reserved' })` → `from('business_inventory').update({ status: 'reserved' }).eq('id', plant.inventory_id)` (no-op if inventory_id null)
  - `api/qbo/invoice/cultivar.ts`: `select('*, plants(*)')` → `cultivar_plants(*)`; `item.plants` → `item.cultivar_plants`; `install_price` → `0` (install pricing moves to service_offerings)
  - `api/social/generate-posts.ts`: `plants(common_name, species)` → `cultivar_plants(common_name, species)`; `i.plants?.` → `i.cultivar_plants?.`
  - `Orders.tsx`, `DeliveryRoute.tsx`: inline type + select string + accessor all updated to `cultivar_plants`

- **Stale artifact** `docs/cost-to-produce/INVENTORY-SHAPE-VERIFY.md`: correction note appended — "DE-FACTO-INVENTORY untangle" premise is now resolved; the FK exists; stock-grain separation is complete.

**Build:** `npm run build:cultivar` ✅ 2187 modules, 0 errors (same count)
**Grep proof:** `from('plants')` — 0 hits. `plant.base_price` / `plant.install_price` / `plant.arrived_at` — 0 hits.

**AC compliance:**
- AC-1 ✅ — `cultivar_` prefix marks vertical identity join; no vertical nouns in shared identifiers; `nursery_id` dropped
- AC-2 ✅ — `cultivar_plants_owner_select` uses business_id membership scope (owner + member paths)

**⚠️ David must run `20260613_cultivar_plants_untangle.sql`** in bgobkjcopcxusjsetfob SQL editor before deploying. Until applied: `cultivar_plants` table doesn't exist → QR scan 404s.

**⚠️ inventory_id is NULL on all existing cultivar_plants rows after migration.** QR scan will fetch identity correctly, but the plant profile will show "Availability not set up yet" / checkout blocked until lot population runs (sequenced separately — next build step).

**No new Vercel env vars. No new Vercel functions. No new pages.**

**PLATFORM_STATE.md level changes:**
- Added: `cultivar_plants table` → WIRED (migration written, code repointed, build clean; David must apply migration; inventory_id null until lot population)
- Updated NOT YET VERIFIED: nurseries/plants/plant_events/addons RLS row → now `cultivar_plants` policy updated (business_id scope); others still not frontend-confirmed
- Updated: `CLAUDE.md §2` table list: `plants` → `cultivar_plants`

**Next steps for David:**
1. ✅ (carry-forward) **Run `20260613_business_service_log_result.sql`** in bgobkjcopcxusjsetfob — required before PMI log result field works
2. ✅ (carry-forward) Navigate to `/pmi`, add asset, log service — verify INSERTs succeed
3. ✅ (carry-forward) Click "Suggest Schedule" — verify AI returns tasks list
4. **NEW: Run `20260613_cultivar_plants_untangle.sql`** in bgobkjcopcxusjsetfob SQL editor — renames plants → cultivar_plants, drops stock-fact cols, adds inventory_id FK, updates RLS
5. **After migration: run C1–C6 verification queries** (embedded in migration file comments) — report back for catalog proof
6. **Next session: Lot population** — INSERT business_inventory rows for LAWNS SKUs (Shumard Red Oak, Cedar Elm, Live Oak, etc.), then UPDATE cultivar_plants.inventory_id to link each tag_id row to its lot row. This restores QR checkout flow.

---

### 2026-06-13 — THUNDER VALIDATE-THEN-CLOSE: business_voice_samples catalog proof persisted + PLATFORM_STATE WIRED

**Type:** Docs-only close-out. No code, no schema, no migrations, no shared-module edits.

**Session mandate:** Confirm the catalog verification (C1–C6) from the VOICE-SCHEMA session was actually done & passed, persist the proof into the repo so it outlives the chat, then record WIRED in PLATFORM_STATE against the persisted proof.

**STAGE A gate result:** A1 PASS (3/3 JS-client checks pass — table queryable, old table gone, anon blocked). A2 NOT FOUND (C1–C6 results existed only in chat, not in repo). Gate decision: STAGE A INCOMPLETE — proceeded to STAGE B per protocol (persist first, then record).

**What was done:**
- Created `docs/verification/20260613_business_voice_samples_verification.md` — C1–C6 verdicts recorded verbatim (all PASS). This is now the durable proof in the repo.
- `PLATFORM_STATE.md` line 103 updated: `WIRED` → **`WIRED (verified 2026-06-13, catalog-confirmed)`**. ⚠️ warning removed (migration confirmed applied). Proof path cited.
- `docs/built-inventory.md` schema line updated: `campaign_tone_samples` → `business_voice_samples`, date bumped to 2026-06-13.
- `docs/tech-debt-log.md` entries #30 and #31 added (RLS scope inconsistency; PostgREST catalog doctrine).

**AC compliance:** N/A — docs-only session. No schema, no shared identifiers.
**No new Vercel env vars. No new functions. No migrations.**

**PLATFORM_STATE.md level changes:**
- `business_voice_samples table`: WIRED → **WIRED (verified 2026-06-13, catalog-confirmed)**. Proof: `docs/verification/20260613_business_voice_samples_verification.md`.

**Voice thread closed.** Schema VERIFIED and proof in repo. Campaigns repointed. Social read-back deferred. Returning to Cost-to-Produce.

**Next steps for David:**
1. ✅ (carry-forward) **Run `20260613_business_service_log_result.sql`** in bgobkjcopcxusjsetfob — required before PMI log result field works
2. ✅ (carry-forward) Navigate to `/pmi`, add asset, log service — verify INSERTs succeed
3. ✅ (carry-forward) Click "Suggest Schedule" — verify AI returns tasks list
4. ✅ (carry-forward) **`20260613_business_voice_samples.sql`** — confirmed APPLIED (VERIFIED). No action needed.
5. **Next session: Cost-to-Produce** — BusinessAssets + BusinessInventory live INSERTs + receipt routing seam. Confirm whether `docs/cost-to-produce/COST-DATA-DISCOVERY.md` ran & reported.

---

### 2026-06-13 — THUNDER VOICE-SCHEMA: rename campaign_tone_samples → business_voice_samples + source column

**Type:** Schema rename + one new column + campaigns repoint. Zero new pages. Zero router changes. No env/infra changes.

**Session mandate:** Cheap-now irreversible schema move — generalize the voice store away from campaigns before it holds real learned voice. Social read-back explicitly deferred. Return to Cost-to-Produce after this.

**What was done:**
- Migration `supabase/migrations/20260613_business_voice_samples.sql` written:
  - `ALTER TABLE campaign_tone_samples RENAME TO business_voice_samples` (rows + UUIDs ride along)
  - RLS policy renamed `tone_samples_owner` → `business_voice_samples_owner`
  - `source text NOT NULL` added with temporary DEFAULT `'campaign_generate'` → backfilled → DEFAULT dropped (explicit-on-insert required)
  - `COMMENT ON COLUMN` documents convention: source values are capability keys from `shared/src/ai/capabilities.ts`
- `packages/cultivar-os/api/campaigns.ts` repointed:
  - READ site (line 66): `campaign_tone_samples` → `business_voice_samples` (filter: `business_id` only — already pooled)
  - WRITE site (line 155): `campaign_tone_samples` → `business_voice_samples` + `source: 'campaign_generate'` added
- Build: `npm run build:cultivar` ✅ 2187 modules, 0 errors (unchanged count)
- Social NOT touched — `social/generate.ts` has zero voice-sample references (grep confirmed)
- Deferred work documented in `docs/ai-gateway/VOICE-LOOP-PRECONDITIONS.md` DEFERRED section

**AC compliance:** AC-1 ✅ — `business_` prefix, no vertical noun, business_id-scoped. AC-2 ✅ — existing RLS policy followed through table rename.

**⚠️ David must run `20260613_business_voice_samples.sql`** in bgobkjcopcxusjsetfob SQL editor before `business_voice_samples` exists. Until then, campaigns write/read will 404.

**PLATFORM_STATE.md level changes:**
- Added row: `business_voice_samples table` → WIRED (pending David running migration)
- Updated: `Social campaign generator` row — notes added re: reads/writes to `business_voice_samples`

**No new Vercel env vars. No new Vercel functions. No new pages.**

**Voice thread parked.** Schema locked, campaigns repointed. Returning to Cost-to-Produce.

**Next steps for David:**
1. ✅ (carry-forward) **Run `20260613_business_service_log_result.sql`** in bgobkjcopcxusjsetfob — required before PMI log result field works
2. ✅ (carry-forward) Navigate to `/pmi`, add asset, log service — verify INSERTs succeed
3. ✅ (carry-forward) Click "Suggest Schedule" — verify AI returns tasks list
4. **NEW: Run `20260613_business_voice_samples.sql`** in bgobkjcopcxusjsetfob — renames `campaign_tone_samples` → `business_voice_samples`, adds `source` column
5. After migration: use Campaigns → edit a generated post → verify pair saved to `business_voice_samples` with `source='campaign_generate'`
6. Next session: **Cost-to-Produce** — BusinessAssets + BusinessInventory live INSERTs + receipt routing seam

---

### 2026-06-13 — THUNDER INVENTORIES: standing inventory docs created + protocol wired

**Type:** Docs-only session. No code, no schema, no migrations. Zero code changes.

**What was done:**
- Created `docs/inventory-functions.md` — 13 deployed functions enumerated (count, Hobby limit status, purpose/calls/env vars per function, 2 FILE-ONLY undeployed files flagged, deleted function history).
- Created `docs/inventory-env.md` — all Vercel env vars cataloged: 14 confirmed live, 2 orphaned (BLOTATO_API_KEY + VITE_APP_URL — no code refs), 8 referenced-in-code but not confirmed in Vercel.
- Created `docs/inventory-ai.md` — AI architecture documented: WORKS (Receipt Keeper OCR + social generate), WIRED (discovery 3-stage + campaigns + PMI suggest), DEPRECATED (AIEngine/Railway path). Capability registry quick-ref included.
- Reconciled DB table situation: **PLATFORM_STATE.md is canonical for table state.** CLAUDE.md §2 table list was missing `businesses`, `business_members`, `platform_config` — those 3 added to list with ⚠️ note. `nursery_modules` pending DROP flagged.
- Wired all three inventory docs into: CLAUDE.md §2 health check (check 6), CLAUDE.md §10 Session Starter (check 5), docs/end-of-session-protocol.md (step 18).

**Flags for David (enumeration, not cleanup — nothing deleted):**
- ⚠️ `api/services/` directory in root api/ is **empty** — leftover after `customer-match.ts` deletion. Safe to remove when convenient.
- ⚠️ `BLOTATO_API_KEY` set in Vercel but **zero code references** — orphaned after social/publish.ts deletion (2026-06-08). Safe to remove from Vercel after confirming no other use.
- ⚠️ `VITE_APP_URL` set in Vercel but **zero code references** — possibly orphaned. Confirm before removing.
- ⚠️ `packages/cultivar-os/api/members/accept-invite.ts` and `preview-invite.ts` — **no root shims, NOT deployed**. Logic appears duplicated in deployed `invite.ts`. Verify then remove if truly redundant.
- ⚠️ 13 of 12 Vercel Hobby functions — **deploy blocked** until David upgrades to Pro or removes one function.

**No PLATFORM_STATE.md level changes this session.** (docs-only)
**No BUILT-INVENTORY.md changes this session.** (docs-only)
**No AC compliance issues** — session did not touch shared schema, RLS, or shared identifiers.
**No runbook needed** — pure docs session.

---

### 2026-06-13 — THUNDER PMI: rewire shared PMI module + AI suggest endpoint

**Type:** Module rewire + new Vercel API endpoint + migration. Zero new pages. Zero router changes. No env/infra changes.

**Session mandate:** THUNDER · rewire `packages/shared/src/modules/PMI.tsx` off dead `pmi_assets`/`pmi_service_logs` onto 3 live Supabase tables (`business_assets`, `business_pmi_schedule`, `business_service_log`); port task checklist + inspection result enum from `PredictiveKey.jsx`; add `barcode_id` to asset form; wire AI schedule suggest via new Vercel function using proven receipts/ocr.ts gateway pattern.

**PRE-BUILD VERIFY completed:**
- `barcode_id text` confirmed in base migration (20260612, line 36) — no ALTER needed
- `business_pmi_schedule.tasks jsonb DEFAULT '[]'` confirmed — tasks column exists
- `business_service_log` has NO `result` column — new migration required (20260613)
- `last_service_at` is on `business_pmi_schedule`, NOT `business_assets`
- Receipt Keeper gateway pattern confirmed at `packages/cultivar-os/api/receipts/ocr.ts`

**TASK 1 — Migration** (`supabase/migrations/20260613_business_service_log_result.sql`):
- `ALTER TABLE business_service_log ADD COLUMN IF NOT EXISTS result text CHECK (result IN ('PASS', 'NEEDS_ATTENTION', 'FAIL'))`
- ⚠️ **David must run this in Supabase SQL editor BEFORE using the log service form** — result field INSERT will error without it

**TASK 2 — PMI.tsx rewire** (`packages/shared/src/modules/PMI.tsx`):
- `loadAssets()`: two-query (business_assets .neq RETIRED + business_pmi_schedule by asset_id IDs), merged client-side into `PMIAsset[]`. `getPMIStatus()`/`daysUntilDue()` unchanged.
- `handleAddAsset()`: INSERT business_assets (with barcode_id); if interval set, INSERT business_pmi_schedule. barcode_id field added to form.
- `handleLogService()`: INSERT business_service_log (result nullable — PASS/NEEDS_ATTENTION/FAIL); UPDATE business_pmi_schedule.last_service_at via schedule_id.
- Task checklist: `business_pmi_schedule.tasks` jsonb `[{name, interval}]`. Per-task card in log form. `openLogForm()` seeds logTasks from selected.tasks.
- Inspection result: 3-button PASS/NEEDS_ATTENTION/FAIL picker in log form. `RESULT_STYLE` constant for badge colors.
- `handleSuggestSchedule()`: POST `/api/pmi/suggest` → UPSERT business_pmi_schedule.tasks. "Suggest Schedule" button in detail view.
- AC-1 ✅: no vertical nouns anywhere in rewired code. businessId from useBusinessContext(), never hardcoded.

**TASK 3 — api/pmi/suggest.ts** (`packages/cultivar-os/api/pmi/suggest.ts` + root shim `api/pmi/suggest.ts`):
- Claude Sonnet 4.6, text-only (no vision stage), `ANTHROPIC_API_KEY` server-side only
- Input: `{businessId, name, asset_type, make, model, year}`. Output: `{ok: true, tasks: [{name, interval}]}`
- `ANTHROPIC_API_KEY` already set in Vercel cultivar-os project — no new env var needed
- ⚠️ **13th Vercel function — exceeds Hobby limit (cap = 12)**. Vercel will refuse deploy until David either (a) upgrades to Pro or (b) removes one existing function. See PLATFORM_STATE.md Vercel functions row.

**Build:** `npm run build:cultivar` — ✅ clean (2187 modules, 0 errors)
**Grep proof:** ZERO references to `pmi_assets` or `pmi_service_logs` in shared/, cultivar-os/, api/ directories.

**AC compliance:** AC-1 ✅ — `business_` prefix only; no vertical nouns. businessId from session.

**STANDARDS compliance:**
- STD-001: ✅ WIRED — INSERT path wired and build-verified; live data not yet confirmed by David in browser.
- STD-005 (AI calls): `api/pmi/suggest.ts` uses `ANTHROPIC_API_KEY` server-side only, never exposed to client. ✅

**No new Vercel env vars needed.** `ANTHROPIC_API_KEY` already set.

**Documentation propagation check:** No Help.tsx update needed (PMI is internal owner tool). No onboarding path touches this page.

**Gap graduation sweep:** PMI module BROKEN→WIRED. business_pmi_schedule EXISTS→WIRED. business_service_log EXISTS→WIRED. PMI page BROKEN→WIRED.

**PLATFORM_STATE.md level changes:**
- Modules · PMI.tsx: BROKEN → WIRED
- PMI page: BROKEN → WIRED
- business_pmi_schedule table: EXISTS → WIRED
- business_service_log table: EXISTS → WIRED
- Vercel functions: updated to flag 13th function + limit breach

**Next steps for David:**
1. **Run `20260613_business_service_log_result.sql`** in Supabase SQL editor (bgobkjcopcxusjsetfob) — required before log result field works
2. Navigate to `/pmi`, add an asset, set a maintenance schedule, log a service — verify all INSERTs succeed
3. Click "Suggest Schedule" on an asset — verify AI returns tasks list
4. ~~**Resolve Vercel 13-function limit**~~ ✅ resolved same day — QBO consolidated 13→11 (THUNDER AC-5 session below)

---

### 2026-06-13 — THUNDER AC-5: write constant + consolidate QBO behind one router

**Type:** Docs (PART 1) + refactor (PART 2). Zero new pages. Zero schema changes. Zero env/infra changes.

**Session mandate:** THUNDER · write AC-5 (one-integration-one-router) as architecture constant; then execute to it by consolidating `api/qbo/auth-url.ts`, `api/qbo/callback.ts`, `api/qbo/status.ts` into one connector (`api/qbo-connector.ts`). Clear the Vercel Hobby deploy gate (13→11 functions). Unblock AI-router build for next session.

**PART 1 — AC-5 written (commit b4450c9):**
- `PLATFORM_STRATEGY.md` — AC-5 appended after AC-4, before Exception Log: one integration = one connector = one router; endpoints are internal routes (path/method dispatch); consolidate-when-touched; cross-integration routers forbidden (Alan Effect); accepted deviations logged in `decisions/override-log.md`.
- `CLAUDE.md §1.5` — one-line enforcement hook added: AC-5 check triggers on any connector/third-party-integration work.

**PART 2 — QBO consolidated (commit fcdfa97):**
- Created `packages/cultivar-os/api/qbo/router.ts` — single AC-5 connector with `handleAuthUrl()`, `handleCallback()`, `handleStatus()` dispatched by `req.query._route`. Shared `supabase()` factory, shared QB constants. Zero logic change.
- Created `api/qbo-connector.ts` — single root shim (replaces 3 shims).
- Deleted: `api/qbo/auth-url.ts`, `api/qbo/callback.ts`, `api/qbo/status.ts` (root shims) + `packages/cultivar-os/api/qbo/auth-url.ts`, `packages/cultivar-os/api/qbo/callback.ts`, `packages/cultivar-os/api/qbo/status.ts` (implementations).
- Updated `vercel.json`: three specific rewrites added before SPA catch-all:
  - `/api/qbo/auth-url` → `/api/qbo-connector?_route=auth-url`
  - `/api/qbo/callback` → `/api/qbo-connector?_route=callback`
  - `/api/qbo/status` → `/api/qbo-connector?_route=status`
- All three public paths preserved byte-exactly. `/api/qbo/callback` = Intuit-registered URI unchanged.

**VERIFY-FIRST result (Parable 3 — irreversible-external):**
- Registered URI: `https://cultivar-os.vercel.app/api/qbo/callback` (from `QBO_REDIRECT_URI` env var)
- Preserved via vercel.json rewrite source: `/api/qbo/callback` — byte-identical ✅

**Invoice call (reported as required):** `api/qbo/invoice/cultivar.ts` left separate. Different caller (orders/submit flow vs. OAuth lifecycle), different failure domain. 13→11 matches expected without including it.

**Frontend changes:** Zero. Settings.tsx:541, shared oauth.ts:60/72, QuickBooksConnector.jsx:18 all reference the same public paths — preserved via rewrites. OFF LIMITS oauth.ts not touched.

**Build:** `npm run build:cultivar` — ✅ clean (2187 modules, 0 errors — same as last session).
**Function count:** 13 → 11. Vercel Hobby cap = 12. Deploy gate cleared with 1 slot headroom.
**AC-5 compliance:** One QBO connector (`router.ts`), one Vercel function (`qbo-connector.ts`), internal path dispatch — ✅ satisfied.
**CLAUDE.md flag:** 636 lines (just over 600-line context budget threshold) — note for David; trim handoff history to `docs/handoff-archive.md` when convenient.

**No new env vars needed.** No schema changes. No migrations.
**No runbook needed** — pure refactor; Vercel routing change is git-snapshotted.

**PLATFORM_STATE.md level changes:**
- Vercel functions: "12 + 1 pending / OVER LIMIT" → "11 of 12 / 1 slot headroom / deploy unblocked"

**docs/inventory-functions.md updated:** Function count header updated (13→11), table collapsed (rows 3+4+6 → row 3 = qbo-connector), deleted-functions table updated with three QBO files + reason.

**Next steps for David:**
1. ✅ (carry-forward from PMI session) **Run `20260613_business_service_log_result.sql`** in Supabase SQL editor (bgobkjcopcxusjsetfob) — required before PMI log result field works
2. ✅ (carry-forward) Navigate to `/pmi`, add asset, log service — verify INSERTs succeed
3. ✅ (carry-forward) Click "Suggest Schedule" — verify AI returns tasks list
4. **Next session: AI-router BUILD** — ordered-provider failover in `executeCapability`, route `/api/pmi/suggest` through it, build `ai_usage` table + INSERT. Deploy gate now cleared (11 functions, 1 slot headroom).
5. No Vercel project upgrade needed — QBO consolidation cleared the gate within Hobby plan.

---

> Older session history (all entries before this one) archived at [docs/handoff-archive.md](docs/handoff-archive.md) — NOT loaded at session start.

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

**Quick reference — mandatory close sequence:**
1. Update Handoff (Part 3) + Active Tasks (Part 4) + Off Limits (Part 7)
2. Confirm no hardcoded URLs or keys
3. `git add CLAUDE.md && git commit && git push`
4. Tailwind drift check · Documentation propagation check · Factual correction capture
5. Runbook if env/infra work · AC compliance check · STANDARDS compliance check
6. Gap graduation sweep · PLATFORM_STATE.md level changes
7. **Update BUILT-INVENTORY.md** — bump `Last updated:` to today + add/update every capability changed this session. **Verify line 4 date = today before committing.** (Full protocol: step 17 in docs/end-of-session-protocol.md)

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

Do not start until you confirm all five.
Do not touch ignition-os, old Supabase project,
or QB oauth.ts.
```

---

*TRACE Enterprises · Built with CAI*
*cultivar-os.vercel.app · builtwithcai.com*
*(512) 456-3632 · david@trace-enterprises.com*
*Update this file every session. No exceptions.*
