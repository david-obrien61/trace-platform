# CLAUDE.md — TRACE Platform
# Multi-AI Handoff Workflow — Claude Code reads this every session
# Last updated: 2026-06-12 (THUNDER Cost-to-Produce design doc written: docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md — spine, fork, 4 feeds, 5 pillars, two-tier model, audit conflict log, build sequence; no code/schema/migrations)
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
```

**Rules:**
- **Date ≠ memory/currentDate** → update `~/.claude/projects/-Users-terrenceobrien-Desktop-trace-platform/memory/` before proceeding — stale dates corrupt commit messages and handoff entries.
- **PLATFORM_STATE.md missing** → do NOT write any code; report to David before proceeding.
- **`??` files in git status** → report them to David; sort before starting code work.
- **Reread ⛔ LAUNCH GATES** in PLATFORM_STATE.md every session — never cross a gate without David's explicit direction.

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
  Tables: nurseries, plants, plant_events, orders,
          order_items, order_addons, addons, losses,
          customers, social_drafts, modules,
          nursery_modules
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

| 12 | 🟡 `CAI/ai_router.py` (Railway FastAPI) was built to keep AI provider keys out of the React Native bundle. Now that Ignition OS is a Vercel web app, this is unnecessary — Vercel serverless functions hold keys server-side, same pattern cultivar-os uses for Claude calls today. Railway is still running but is legacy for the web build. AIEngine.ts currently points to `VITE_API_URL` which is unset in the ignition-os Vercel project — **EVERY AIENGINE CALL IN IGNITION VERCEL PRODUCTION RETURNS `{ ok: false }`. Ignition AI is DARK in production (Audit 2, 2026-06-06).** Railway receives zero web-build traffic → safe to kill clean. **Agreed kill path (v7 §15):** retire orphaned tasks (`invoice_scan`, `vin_decode`) — do NOT port them; port real tasks (`dtc_decode`, `estimate_draft` first — text-only, highest value); evaluate `voice_transcribe` (4.5MB Vercel limit) before deciding port vs. retire. Kill Railway after confirmed tasks are live. Receipt Keeper is Vercel-native from birth — adds zero Railway debt. | 2026-05-28 (decision made); DARK-in-prod finding confirmed Audit 2, 2026-06-06 | Port real ai_router.py endpoints to TypeScript Vercel functions under `packages/ignition-os/api/`. Retire orphaned tasks. Decommission Railway. | Before activating AI features in ignition-os web. |
| 13 | 🟡 Vite build aliases for `react-native`, expo packages, and `lucide-react-native` exist in both `CAI/vite.config.js` AND `packages/ignition-os/vite.config.js` — duplicated. The stubs in `CAI/stubs/` and `packages/ignition-os/stubs/` are identical files in two places. | 2026-05-28 | Extract stubs to `packages/shared/stubs/` and reference from both vite configs. Low priority — only matters if stubs need to change. | If stubs ever need updating, deduplicate first. |
| 15 | 🟢 **RESOLVED 2026-06-08 (commit `444fbb1`).** ~~HONEST-DEBT: `businesses.accounting_needs_reconnect` reads `false` while the QB token is expired. The flag only flipped on a 401 during an active invoice call — meaning a dead connection stayed silent until something failed mid-use.~~ **Fix applied:** (1) `qbo/status.ts` — on every dashboard load, fetches `accounting_token_expires_at`; if token is missing or expired, calls `refreshQBToken()`; if refresh succeeds → `needsReconnect: false` (silent, no banner); if refresh fails → `needsReconnect: true` (DB updated, banner fires). (2) `Dashboard.tsx loadMetrics()` — also selects `accounting_token_expires_at`; client-side derives early estimate (`expiresMs < Date.now()`) so banner appears immediately without waiting for status check. (3) `checkQbStatus()` — always applies the server's authoritative `needsReconnect` result, clearing banner if silent refresh succeeded. STD-007 added to STANDARDS.md as the class-of-bug record. | Audit 6, 2026-06-06 | ✅ RESOLVED 2026-06-08 | — |
| 16 | 🟡 **B barrel swap DONE 2026-06-11.** ~~TECH-DEBT: `packages/shared/src/business-logic/marginEngine.ts` is a ~17-line stub that silently underdelivers.~~ **Canonical engine built 2026-06-10 (THUNDER · Build 1):** `packages/shared/src/business-logic/MarginEngine.ts`. 4-slab + tier discounts + `overheadPerUnit`. All 5 old implementations marked 🔴 DEPRECATED. **B barrel swap done 2026-06-11:** `packages/shared/src/pricing/marginEngine.ts` (broken stub, broken rounding) DELETED. `shared/src/index.ts` now exports canonical engine. Migration checklist: `docs/audits/margin-engine-migration-checklist-2026-06-10.md`. **Engine remains ORPHANED** — STD-001 investigation confirmed Cultivar has ZERO pricing/margin callers (B2C retail model: prices stored as final values in DB; no cost-to-retail engine in use). **Remaining work:** A callers (Ignition import-path swaps, no price change). Cost-to-Produce tile = first Cultivar caller (needs `plants.cost_price` DB column). C/D callers (after accepted price change). | Stub introduced pre-2026-05-29; overhead orphaned confirmed Audit 4, 2026-06-06; engine built 2026-06-10; B swap 2026-06-11 | A callers next (Ignition). Cost-to-Produce tile = first Cultivar caller. Overhead wire: IgnitionProt → DataBridge `margin_config.overheadPerUnit`. | A callers unblock after Ignition next-session. Cost-to-Produce tile unblocks after `plants.cost_price` schema added. |
| 17 | 🟡 **STD-008 SWEEP — `20260523_qb_token_expires_at.sql` (DEAD MIGRATION):** Adds `qb_token_expires_at` and `qb_needs_reconnect` to the OLD `nurseries` table, which was superseded by the `businesses` table (May-29 migration). Zero code reads these columns in any current file. The equivalent columns on `businesses` (`accounting_token_expires_at`, `accounting_needs_reconnect`) were added by the May-29 migration and are in use. The nurseries-table additions are dead code in the DB. STD-008 sweep finding 2026-06-08. | STD-008 sweep 2026-06-08 | No code fix needed — nurseries columns are dead. If the nurseries table is ever retired, drop them in that cleanup migration. | When the nurseries table is formally retired (post-demo cleanup pass). |
| 18 | 🟡 **STD-008 SWEEP — `20260603_business_members_add_pin_hash.sql` (UNVERIFIED LIVE APPLICATION):** The migration adds `pin_hash text` to `business_members` in bgobkjcopcxusjsetfob. `OwnerSignup.tsx:301` inserts `pin_hash` on every signup. The June-3 handoff required David to apply this migration manually; `test-member-login.mjs` passed (29/29) the same session, suggesting it was applied. However, the application was never confirmed via an `information_schema.columns` query (STD-008 did not exist at the time). If `pin_hash` is missing from the live DB, new signups silently fail to store the PIN hash. STD-008 sweep finding 2026-06-08. | STD-008 sweep 2026-06-08 | Verify: run `SELECT column_name FROM information_schema.columns WHERE table_name = 'business_members'` in Supabase SQL editor — confirm `pin_hash` is present. Mark 🟢 if confirmed. | Next signup-flow session or before onboarding Erin. |
| 19 | 🟡 **STD-009 SWEEP — `packages/shared/src/campaigns/generate.ts:129` HARDCODED CHANNEL FALLBACK:** The PostDraft mapping has `channel: p.channel ?? p.platform ?? enabledChannels[0]?.name ?? 'instagram'`. The `?? 'instagram'` final fallback hardcodes a channel name into the output-assembly path. If the AI returns a post without a `channel` field AND `p.platform` is also absent, the post is silently assigned to 'instagram' regardless of which channels were requested. STD-009 sweep finding 2026-06-08. | STD-009 sweep 2026-06-08 | Fix: replace `?? 'instagram'` with `?? enabledChannels[0]?.name ?? null` — derive from the enabled channels list, not a hardcoded name. Alternatively, filter out posts with no channel field and log a warning. | Before a business with Instagram disabled runs campaigns — the 'instagram' fallback could send their content to the wrong channel identity. |
| 20 | 🟡 **STD-009 SWEEP — `packages/shared/src/campaigns/types.ts:18` INCOMPLETE PLATFORM UNION:** `CampaignPost.platform` is typed as `'instagram' \| 'facebook' \| 'sms' \| 'email'` — missing `'tiktok'` and `'twitter'`. The campaign generator now produces posts for those channels. Downstream TypeScript consumers of `CampaignPost` that switch on `platform` will have exhaustive-check gaps for tiktok and twitter. STD-009 sweep finding 2026-06-08. | STD-009 sweep 2026-06-08 | Widen to `string` (preferred — AC-1: no enumerated vertical nouns in shared types) or add `\| 'tiktok' \| 'twitter'` to the union and accept the maintenance burden. 'string' is cleaner since advert_channels is open-ended. | Before next TypeScript strict mode pass or when tiktok/twitter channels go live for a customer. |
| 21 | 🟡 **STD-009 SWEEP — `packages/cultivar-os/api/campaigns/publish-post.ts` ORPHANED FILE:** This file was superseded when the campaigns API was consolidated into `packages/cultivar-os/api/campaigns.ts` (action-routed handler). The orphaned file contains SMS-specific branching on `post.platform === 'sms'` that is dead code — no caller routes to this endpoint. It is not a Vercel function (Vercel routes from `api/campaigns.ts` at the root). Safe to delete in a cleanup session. STD-009 sweep finding 2026-06-08. | STD-009 sweep 2026-06-08 | Delete `packages/cultivar-os/api/campaigns/publish-post.ts`. Also delete `packages/cultivar-os/api/campaigns/generate.ts` (also orphaned — same consolidation). The `api/campaigns/` subdirectory can be removed entirely. | Next cleanup pass (low priority — dead code, no execution risk). |
| 22 | 🟡 **STD-008 INVERSE SWEEP — `social_drafts_platform_check` (RESOLVED THIS SESSION — PENDING VERIFICATION):** Hand-applied CHECK constraint existed in live DB with no committed migration. Allowed list was `(instagram, facebook, tiktok, twitter)` — no 'sms'. When SMS enabled in advert_channels, `generate-posts.ts` batch-inserted all channels atomically; the sms row triggered the constraint violation; PostgREST rolled back ALL rows including instagram + tiktok. Zero rows written per generation run. Confirmed 2026-06-09 via live probe. Fix: `supabase/migrations/20260609_social_drafts_platform_check.sql` — drops hand-applied constraint, recreates including 'sms', brings it under migration control. STD-008 extended to cover both directions (v1.4). ⚠️ David must apply migration and run VERIFICATION QUERY. | STD-008 inverse sweep 2026-06-09 | Migration written — David applies to bgobkjcopcxusjsetfob + runs verification query. Mark 🟢 after constraint shows 5 values in pg_get_constraintdef result. | Apply before next social-posts generation attempt with SMS enabled. |
| 23 | 🟡 **STD-008 INVERSE SWEEP — FULL SWEEP PENDING:** Sweep SQL written at `docs/audits/std008-inverse-sweep-2026-06-09.sql`. PostgREST cannot query `information_schema` or `pg_constraint` directly — sweep must be run manually in Supabase SQL editor. The sweep covers 4 queries: (1) CHECK constraints, (2) triggers, (3) RLS policies, (4) non-pkey indexes. Pre-migration-era tables (nurseries, plants, plant_events, addons, losses, social_drafts) may have additional hand-applied objects beyond the confirmed platform_check. Policies for orders, business_modules, businesses ARE documented in committed migrations (DROP IF EXISTS pattern in 2026-05-28/29/06-04 migrations). Known documented triggers: `trg_business_members_updated_at`, `business_modules_updated_at`. STD-008 inverse sweep finding 2026-06-09. | STD-008 inverse sweep 2026-06-09 | David runs `docs/audits/std008-inverse-sweep-2026-06-09.sql` in Supabase SQL editor; audits results against `grep -r <name> supabase/migrations/`; logs any undocumented findings to new Tech Debt entries. Mark 🟢 when sweep complete and all findings logged. | Before next migration session touching a pre-migration-era table (nurseries, plants, addons, losses). |
| 24 | 🟡 **STD-010 NAMING DEBT — IGNITION MODULE NAMES (13 candidates):** Reality audit 2026-06-09 found 13 opaque module identifiers in Ignition OS. A second developer joining this project cannot determine what these modules do from their names. Full meanings: `FLUX` = RO Queue/Workflow Board · `CIPHER` (file IgnitionCipher.jsx) = DTC Fault Code Decoder · `CODE` (CoreApp UI label for same) = DTC Decoder · `STOK` = Parts Inventory · `PROT` = Margin & Pricing Configuration · `PROC` = Vendor Directory · `HUB` = Fleet Dispatch Board · `PORT` = Customer Estimate Portal · `KOSK` = Technician Floor Station · `OMNI` = Shop Command Dashboard · `PRED` = AI Preventive Maintenance Scheduler · `AUDIT` = AI Invoice Leakage Scanner · **WORST COLLISION:** `hooks/useIgnitionCipher.js` = Legacy PIN Auth Hook — same "CIPHER" opaque name as `IgnitionCipher.jsx` (DTC decoder), completely different function. STD-010 audit 2026-06-09. | STD-010 audit 2026-06-09 | Rename files and update CoreApp routing labels to decoded names. Coordinate with Tailwind conversion sessions (post-August). Do NOT rename during active demo period. WORST COLLISION (`useIgnitionCipher`) should be resolved first — it is orphaned so the rename is low-risk. | Before onboarding a second Ignition developer. |
| 25 | 🟡 **IGNITION DARK INVENTORY — 6 AI FEATURES DEAD IN PRODUCTION:** Root cause: `VITE_API_URL` not set in ignition-os Vercel project → every `AIEngine.call()` returns `{ ok: false }` silently. Railway still running, zero Vercel traffic. Impacts: (1) **AI estimate skeleton** (`IgnitionEstimate.jsx POST /api/estimate/build`) — techs build estimates fully manually; no AI pre-fill. (2) **Auto-PO generation** (`IgnitionEstimate.jsx POST /api/jobs/${id}/generate-pos`) — no POs auto-generated after customer authorization. (3) **DTC AI decode** (`IgnitionCipher.jsx AIEngine.decodeDTC()`) — only 3 hardcoded codes work (3216/3251/157); all others silently return nothing. (4) **Invoice leakage scan** (`IgnitionAudit.jsx AIEngine.auditInvoice()`) — entire module unusable. (5) **PMI AI scheduling** (`PredictiveKey.jsx AIEngine.*`) — AI schedule generation dead; only manual asset entry works. (6) **QB OAuth** (`ExternalBridge.js ${API_URL}/api/qbo/auth-url`) — QB is fully dark + Ignition OS has NO api/qbo/* Vercel functions (unlike Cultivar). Agreed kill path (v7 §15): retire orphaned tasks (invoice_scan/vin_decode); port real tasks (dtc_decode + estimate_draft first); kill Railway after. | STD-010 audit 2026-06-09 | Port `dtc_decode` + `estimate_draft` to Vercel functions under `packages/ignition-os/api/`. These are text-only, no vision complexity. Port completes Railway kill path. | Before next Ignition OS demo or before claiming any AI feature works in Ignition. |
| 26 | 🟡 **IGNITION ORPHANED DATABRIDGE KEYS:** Reality audit 2026-06-09 found 4 orphaned DataBridge keys. (1) **`inventory_items` (orphaned read):** `IgnitionOmni` reads this for the inventory value stat tile. `IgnitionStok` reads from Supabase `inventory` table — not DataBridge. No module writes `inventory_items`. Inventory value tile always shows $0. (2) **`fleet_units` (orphaned read):** `IgnitionHub` reads via `DataBridge.getFleetUnits()`. `DataBridge.saveFleetUnit()` exists but no module in the web build calls it with real data. Hub shows empty GPS grid. (3) **`labor_guide` (orphaned read):** `DataBridge.getLaborGuide()` always returns hardcoded defaults. No module has ever written a real labor guide. (4) **`margin_change_log` (orphaned write):** `DataBridge.setMarginConfig()` writes every margin config change to this key. No module reads or displays it — the audit log is silently accumulating, invisible. Additional: `pending_users` — written by IgnitionOmni legacy staff enrollment; only `EnrollmentCatch` reads it via an orphaned flow. | STD-010 audit 2026-06-09 | (1) Fix `inventory_items`: either write from IgnitionStok to DataBridge as well (sync) or point IgnitionOmni to Supabase `inventory` for the stat. (2) `fleet_units`/`labor_guide`: either remove the reads or build real writers. (3) `margin_change_log`: build a display in IgnitionProt settings panel. | Before next Ignition telemetry/stats session. |
| 27 | 🟡 **IGNITION STD-008 INVERSE GAP — 10 TABLES, NO COMMITTED MIGRATIONS:** Reality audit 2026-06-09 found 10 Supabase tables referenced in production code with zero committed migration files in `packages/ignition-os/supabase/migrations/`. These tables either exist as hand-applied schema in `ufsgqckbxdtwviqjjtos` (STD-008 inverse gap — undocumented live objects) or do not exist at all. Tables: `dtc_codes`, `eval_photos`, `tools`, `tool_signout_log`, `repair_logs`, `customer_authorizations`, `concept_aliases`, `purchase_orders`, `pmi_schedules`, `ai_usage`, `feature_events`, `error_events`. Additionally, 3 tables are DROPPED with NO recreate migration: `pin_resets` (CoreApp ForgotPinFlow), `shop_invites` (CoreApp JoinFlow), `member_devices` (IgnitionAdmin Devices tab, DataBridge.autoEnrollDevice). These features COMPILE AND ROUTE but fail at runtime (table not found). Sweep required: David must run a schema query in `ufsgqckbxdtwviqjjtos` Supabase SQL editor to find which of the 10 tables actually exist as hand-applied objects. STD-008 applies to both Supabase projects. | STD-010 audit 2026-06-09 | (1) Run `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1;` in ufsgqckbxdtwviqjjtos to discover which tables exist. (2) For each existing-but-undocumented table: write a migration using `CREATE TABLE IF NOT EXISTS` to bring it under version control. (3) For the 3 dropped tables: write recreate migrations or remove the dead code paths. | Before next Ignition build session that adds a new table or modifies schema. |
| 28 | 🟡 **SECURITY DEBT — IGNITION pilot_all RLS: ALL TABLES WIDE OPEN.** `supabase_rls_pilot.sql` sets `USING(true) WITH CHECK(true)` on 7 original tables (shops, users, jobs, purchase_orders, tools, pmi_schedules, ai_usage). `supabase_job_lifecycle_migration.sql` adds `pilot_all_*` policies to all workflow tables (bays, customers, customer_vehicles, evaluations, dtc_codes, eval_photos, estimates, estimate_line_items, customer_authorizations, labor_entries, repair_logs, invoices, invoice_line_items). That is 19+ tables with zero row-level isolation. Only exception: `shop_members` recreated 2026-06-03 with real scoped model (`shop_owner_all`: EXISTS businesses.owner_id=auth.uid(); `shop_member_self_select`: open for PIN lookup). Any Supabase-auth'd session can read/write any Ignition row. Permission enforcement is CLIENT-SIDE ONLY via `session.allowed.includes('x')` checks in CoreApp.jsx. The pilot_all comment in the migration says "When Supabase Auth is wired, replace with: using (shop_id = auth.uid())" — the path is documented but not built. ALSO: there are TWO role namespaces that partially conflict: (1) `shop_members` canonical roles: TECH/SERVICE/ADMIN. (2) Test profiles use role-badge format: "ADMIN"/"TECH"/"PRICING_AUTHORITY" as permission strings, passed to `DataBridge.getSystemRoles()` for expansion. Members created via JoinFlow/IgnitionAdmin store capability strings ("view_hub","scan_parts") — these two formats are incompatible with each other in the `userCapabilities` expansion path. Shared fix built this session: `packages/shared/src/auth/permissions.ts` — `can()`, `hasRole()`, `canAccessModule()`, `expandRoles()`, `deriveAllowed()`. These are drop-in replacements for the inline checks; callers are NOT migrated yet. | THUNDER · BUILD 2 discovery, 2026-06-10 | (1) Replace pilot_all policies with shop_id-scoped policies (`USING(EXISTS (SELECT 1 FROM businesses WHERE id=shop_id AND owner_id=auth.uid()))`). (2) Unify role/permission format — adopt capability-string format (view_*) everywhere, retire role-badge format in DataBridge test profiles. (3) Migrate CoreApp.jsx permission checks to shared `can()` / `canAccessModule()`. | Before multi-shop Ignition launch or any customer other than the pilot shop. |
| 14 | 🟢 **RESOLVED 2026-06-10 (THUNDER · Tailwind pass).** ~~Tailwind CSS via CDN in `packages/ignition-os/index.html`. 34 files with 2,474 className= lines.~~ **Fix applied:** All 34 files converted to inline `style={{}}` + `ign-*` custom CSS classes. `ignition-theme.css` handles all pseudo-states (hover/focus/active/disabled) and animations. CDN script tag removed from `index.html`. One commit per file. Both builds verified: ignition 1838 ✅ · cultivar 2176 ✅. Non-1:1 report in `docs/tailwind-conversion-progress.md`. `STYLE_DEBUG = false` STD-003 guard added to every converted file. **Policy remains: NO new Tailwind anywhere.** Inline styles via `style={{ ... }}` are canonical. Shared design token file: `packages/shared/src/design-system/tokens.ts`. | 2026-05-29 (identified) → 2026-05-31 (deprecated) → 2026-06-10 (RESOLVED) | ✅ RESOLVED 2026-06-10 | `docs/tailwind-conversion-progress.md` |

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

### 2026-06-12 — THUNDER Cost-to-Produce design doc

**Type:** Design capture only. Zero code changes, zero migrations, zero schema changes.

**Session mandate:** THUNDER · WRITE COST-TO-PRODUCE DESIGN DOC — capture the fully resolved
architecture for Cost-to-Produce as a single authoritative design document. No build.

**Deliverable:** `docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md`

**What's in the doc (14 sections):**
- Spine: accumulate honestly → emit `cost: number` → divide → surface confidence → never rule on tax/legal
- Core boundary: capture/surface/model; never take tax or legal position. Every cost line carries cash timing.
- The fork: accumulator (upstream, event-sourced) → period pool (downstream, snapshot ÷ denominator). One-directional. No reverse writes.
- Four cost feeds: Receipt Keeper [WORKS], Recurring [DESIGN], Labor + imputed [DESIGN], Asset Manager (Andrew's [BUILT, separate repo]; shared promote-and-consolidate [DESIGN])
- Cost-object node model: ASSET | PROJECT | PRODUCT as `node_type` discriminator on one `cost_objects` table (AC-1). Containment edges (tree) + contribution edges (DAG for shared costs). COUNT-ONCE rule. PROJECT→PRODUCT conversion lifecycle (CoolRunnings worked case). Shared-cost allocation: owner assigns basis, TRACE does arithmetic, labels it MODEL not FACT.
- Five pillars (all [DESIGN]): cash-today vs accrual; cost-of-capital; estimate→actual variance + bias learning; confidence-mix rollups (confirmed/derived/estimated/UNKNOWN — never silently zero); payback/break-even clock (F&F hole + discount leakage)
- Denominator: per `business_type` config (item | customer-month | billable-hour). TRACE self-pricing = sensitivity CURVE at N=1,5,20,100.
- AI cost: `ai_usage_log` shared table [DESIGN]; `ocr_raw` / receipts provider columns [WORKS]; Tier 2 routing intelligence [DESIGN]
- MarginEngine: BUILT (canonical, 2026-06-10), ORPHANED for Cultivar. `overheadPerUnit` is the absorption hook. `plants.cost_price` column is the first-caller blocker.
- Two-tier model: Core = "What did I spend?" (WORKS — Receipt Keeper v1); Pro = "What does it cost me to MAKE this?" (DESIGN — entire intelligence layer). Trial: 2 weeks all-on → Core stays. Fractal rule. Anti-exploitation stance. TRACE eats own cooking (CUSTOMER-ZERO).
- Surface constraint: `/costs` owns Cost-to-Produce. Dashboard.tsx gets ONE read-only tile max. (Dashboard.tsx: 936 lines, 27 commits/90d, named highest collision risk in code-health audit.)
- Audit conflict log: 4 entries (asset manager, MarginEngine staleness, ai_usage_log, plants.cost_price) — all resolved consistently with audit-wins rule.
- Honest inventory: 15 items that do NOT exist yet (code/schema/migration) vs 3 that are built.
- Build sequencing: 14-step logical dependency order (not committed sprint plan).

**AC compliance:** No AC issues — session did not touch shared schema, RLS, or shared identifiers.

**STANDARDS compliance:**
- STD-001: ✅ Read-only diagnosis throughout. Checked PLATFORM_AUDIT, PLATFORM_STATE, built-inventory before writing.
- STD-002 through STD-010: N/A — design-capture session; no code written, no bug fix, no migration, no integration surface touched.

**Factual corrections captured:** None surfaced. PLATFORM_AUDIT §3 staleness on MarginEngine (was "17-line stub", now canonical BUILT) was already documented in PLATFORM_STATE.md. No new corrections.

**No runbook needed** — pure design-capture session.

**Documentation propagation check:** No customer-facing feature built. No Help.tsx, onboarding, or error message changes. No `// FLAG:` fulfillments. `docs/built-inventory.md` not updated (no state changed — all items in this doc are DESIGN; the only WORKS items already have correct state in built-inventory). Explicit: no customer-facing documentation propagation needed for this session.

**Gap graduation sweep:** No gap graduations this session.

**PLATFORM_STATE.md level changes:** None — design session only. No new files wired, no builds confirmed, no migrations applied.

---

### 2026-06-11 — THUNDER doc-sync + date-drift sweep

**Type:** Docs-only. Zero code changes, zero migrations, zero schema changes, zero API changes.

**Session mandate:** THUNDER · DOC-SYNC + DATE-DRIFT SWEEP — correct systematic forward-date drift across canonical docs; sync Receipt Keeper v1 WORKS state into docs that hadn't been updated; add OCR COMMODITY strategic conclusion.

---

**DATE DRIFT CORRECTED (all → 2026-06-11):**

| File | Drift found | Count |
|---|---|---|
| `CLAUDE.md` | `2026-06-15` in handoff section heading | 1 |
| `PLATFORM_STRATEGY.md` | `2026-06-12` in header + changelog + 4 decision footers | 7 |
| `PLATFORM_STATE.md` | `2026-06-12` in Build/Vercel/TRIAGE rows; `2026-06-14` in receipts HANDOFF refs | 5 |
| `STANDARDS.md` | `2026-06-12` in v1.7 changelog + BENCH-E scar text | 3 |
| `MASTER_BRIEF.md` | `2026-06-13` in header + Part 16 header + D-003/D-004/D-005/D-008 text; `2026-06-12` in D-005/D-008 | 9 |

Migration filenames (`20260612_*`, `20260613_*`, `20260614_*`) intentionally left unchanged per task constraint — cosmetic, do not rename committed files.

---

**CONTENT SYNC APPLIED:**

**PLATFORM_STATE.md:**
- `receipts table` row: updated "pending migrations — David must apply" → "All 5 migrations applied 2026-06-11 (confirmed live test)" — corrects inconsistency with Receipt Keeper v1 WORKS row which already stated "Migrations all applied."
- `receipts reconciliation migration`: EXISTS → WORKS; evidence updated to reflect applied + live test confirmation.
- `platform_config migration`: EXISTS → WORKS; evidence updated.

**MASTER_BRIEF.md Part 16:**
- D-004 v1 state: Updated from "Not yet built" to "BUILT — computeReconcile() MATCH_TOLERANCE $0.02, ConflictDialog, reconcile_overridden_at, confirmed McCoy's 2026-06-11."
- D-008 current state: Note added that BENCH-E Rule 7 (model names externalized) also completed 2026-06-11, partially fulfilling Pass 2.
- Open Threads 1 + 2: Marked RESOLVED (Gemini 2.5 Flash live test at McCoy's resolved both).
- **D-009 added:** OCR IS COMMODITY — App Store + Nanonets + QBO-no-reader-API confirm OCR is infrastructure, not moat. Moat is Cost-to-Produce/margin. Gemini Flash + Claude Haiku cover it at sub-penny cost. No specialist OCR vendor needed or desirable.

**docs/built-inventory.md:**
- Receipt / Expense Storage section: status `❌ NOT BUILT` → `✅ BUILT (receipts + bucket, Receipt Keeper v1 WORKS)`. Updated "what exists" and "what is not yet built" breakdown.
- Gaps table: Receipt storage row moved to resolved; expenses/cost_profile remain in gaps.
- Gemini vision pipeline gap: RESOLVED 2026-06-11 (Receipt Keeper v1 confirmed first Vercel → Gemini vision pipeline); Ignition VIN OCR noted still unresolved.

**DEFERRED/OPEN (honestly noted, not resolved this session):**
- ReceiptKeeper.tsx module reorg: confirmed happened (receiptReconciliation.ts, imageCompression.ts, LineItemGrid.tsx, ConflictDialog.tsx all exist). Actual main file is 727 lines (task said ~790 — minor discrepancy; 727 is verified current).
- docs-at-root vs docs/ path references reconciliation: still pending.
- Code-health audit: not yet scheduled.

---

**AC compliance (step 13):** No AC issues — session did not touch shared schema, RLS, or shared identifiers.

**STANDARDS compliance (step 14):**
- STD-001: ✅ Read-only diagnosis throughout before every doc edit. Grepped files before editing to confirm exact text.
- STD-002: N/A — no bug fix.
- STD-003: N/A — no instrumentation.
- STD-004: N/A — no business-scoped feature shipped.
- STD-005: ✅ D-004 v1 state struck through as stale and replaced with correct state. No decisions reversed — corrections only.
- STD-006: ✅ No vertical nouns introduced.
- STD-007: N/A — no integration status surfaces touched.
- STD-008: N/A — no new migrations written.
- STD-009: N/A — no generation path changes.
- STD-010: N/A — no new opaque names.
- **BENCH-E: ✅ Preserved** — no provider chain changes.

**Factual corrections captured (step 11):**
- PLATFORM_STRATEGY.md, PLATFORM_STATE.md, STANDARDS.md, MASTER_BRIEF.md all claimed future-dated work that actually happened 2026-06-11. Corrected across all five docs.
- MASTER_BRIEF.md D-004 claimed reconciliation engine "not yet built" — contradicted by PLATFORM_STATE.md evidence. Corrected.
- PLATFORM_STATE.md receipts/platform_config migration rows said "David must apply" — contradicted by Receipt Keeper v1 WORKS row saying "all 5 migrations confirmed applied." Corrected.

**Gap graduation sweep (step 15):** No gaps past horizon. No graduations this session.

**PLATFORM_STATE.md level changes (step 16):**
- `receipts reconciliation migration`: EXISTS → WORKS (evidence: applied 2026-06-11, reconcile_status write proven by green "Lines = Total" in McCoy's live test)
- `platform_config migration`: EXISTS → WORKS (evidence: applied 2026-06-11, getOcrModels() DB read proven by provider=gemini in McCoy's live test)

**No runbook needed** — pure docs session.

**Documentation propagation check (step 10):**
1. `Help.tsx` — no new customer-facing features. No propagation needed.
2. Onboarding — unchanged.
3. `docs/built-inventory.md` ✅ updated — Receipt Keeper v1 WORKS status propagated.
4. No `// FLAG:` placeholders fulfilled (REQ-1 + REQ-2 remain open — consent surface not built yet).
5. No new error messages.

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
- [ ] Merge built-inventory + audit findings into one current-state doc; retire the precedence rule
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

**FILE SIZE & ORGANIZATION CHECK (before editing any file):**

Before adding to or editing a file, note its current line count. If the file exceeds ~800 lines OR is clearly handling multiple distinct concerns, **STOP and ASK David**:

> "This file is [N] lines and handles [concerns A, B, C] — should we reorganize it into smaller modules before adding more, or edit in place for now?"

Rules:
- Line count is a **trigger to ask**, not an automatic action. Do NOT silently refactor a large file mid-task — surface it and let David decide: split-first / edit-then-split / leave it.
- The real concern is whether a file does too many jobs to reason about and edit cleanly. A cohesive large file may be fine; a small file doing six unrelated jobs is not. The check is to prompt the judgment, which is David's to make.
- Context-thrash guard: reading an oversized file whole on every edit overflows the session context. Prefer viewing only the relevant range (use `offset` + `limit` on Read); flag files that are too big to work with cleanly.

This check applies at the moment of opening a file to edit it — not retrospectively at session end.

---

MANDATORY before ending every session:

1. Update Part 3 (Handoff) in CLAUDE.md
2. Update Part 4 (Active Tasks) — check completed
3. Update Part 7 (Off Limits) — clear old, add current
4. Confirm no hardcoded URLs or keys in new code
5. git add CLAUDE.md
6. git commit -m "Update CLAUDE.md — [date] [what was built]"
7. git push
8. Write 3-sentence plain English summary
9. **Tailwind drift check** — run:
   ```
   git diff --name-only $SESSION_START_COMMIT HEAD -- 'packages/**/*.tsx' 'packages/**/*.jsx' | xargs grep -l 'className=' 2>/dev/null
   ```
   For each file in the output:
   - If in `packages/ignition-os/`: pre-existing Tailwind is expected (deprecated, scheduled for conversion post-August)
   - If in `packages/shared/src/components/SavingsReport.jsx` or `QuickBooksConnector.jsx`: same — pre-existing, scheduled
   - If in any other file or package: `className=` with Tailwind utility classes is a policy violation
   If new Tailwind is found outside the pre-existing Ignition/shared files, EITHER convert to inline styles before committing OR document explicitly in the commit message and add to `docs/tailwind-conversion-progress.md`

10. **Documentation propagation check** — For any session that built, modified, or removed a customer-facing widget, page, or feature, answer all five questions before closing:

   1. Does the customer-facing FAQ (`packages/cultivar-os/src/pages/Help.tsx`, and any equivalent in other verticals) need a new Q&A or an update to an existing one?
   2. Does the onboarding flow (signup, post-signup welcome, first-run experience) reference this widget or feature, and is that reference accurate?
   3. Does `docs/built-inventory.md` reflect this widget or feature's current state?
   4. Are there any `// FLAG:` placeholders in customer-facing content (Help.tsx uses this convention) that this session's work now fulfills? If so, replace the placeholder with real content and remove the FLAG comment.
   5. Does any error message, validation message, or in-app help text need to be added or updated because of this change?

   **If yes to any of the above:** propose and make the updates as part of this session's commit. Do not defer documentation updates to a separate task. Propagation is part of the work, not separate from it.

   **If no to all:** state explicitly in the session summary: "No customer-facing documentation propagation needed for this session."

   This step is mandatory. The session is not considered complete until it has been answered explicitly — either with updates made, or with a stated "no" and brief reasoning.

   *Rationale: customer-facing documentation drifts the moment new functionality ships without a corresponding docs update. The cost of catching this at session end is minutes. The cost of catching it three months later is rebuilding the docs from scratch.*

11. **Factual correction capture** — For any session that surfaced a factual correction — meaning either David or Claude was confidently wrong about something concrete that the codebase, the docs, or an audit revealed differently — the correction must be captured before the session ends.

   Triggers for this step:
   - An audit (read-only investigation) revealed something different from what was previously asserted
   - Claude Code (during normal work) discovered a file in a different state than expected
   - David said "I think X works this way" and Claude verified it works differently
   - A user-facing description in any doc was found to be inaccurate after checking the code
   - Tech Debt entries were found to be already-fixed or no-longer-relevant

   When triggered:
   1. Identify the specific wrong claim (quote it if possible)
   2. Identify what's actually true (cite the file/line that proves it)
   3. Update the source-of-truth document for that fact (`docs/built-inventory.md`, `PLATFORM_STRATEGY.md`, `CLAUDE.md`, or the specific doc holding the wrong claim)
   4. Append a brief entry to `THOUGHTS.md` noting the correction with the date — this prevents re-derivation

   If multiple corrections surfaced in one session, batch them into one `THOUGHTS.md` entry rather than separate entries.

   This step is mandatory. The session is not considered complete until either:
   - A correction was captured and documentation updated, OR
   - The session explicitly states "no factual corrections surfaced in this session"

   *Rationale: Memory drifts. Both human and AI memory. Conversations build confident assertions on previously-held information. When an audit corrects the information, the correction must propagate to docs or the next conversation will re-assert the wrong information. The audit catches it once; the documentation update prevents catching it again.*

12. **Runbook capture for setup operations** — For any session that performed environment setup, deployment configuration, repository migration, package installation sequences, database migrations, infrastructure changes, or any multi-step manual-feeling configuration: produce a runbook document at the end of the session.

   The runbook lives in `docs/runbooks/` (create if it doesn't exist). Filename: `{operation-name}-{YYYY-MM-DD}.md`.

   The runbook captures:
   - What was being done and why
   - The sequence of steps actually taken
   - What to verify at each step
   - What failed and how it was resolved
   - How a future person (David, Andrew, Connor, future Claude) could replicate this
   - What gotchas to watch for

   The runbook is for **replay, not narrative**. Write it as if the next person doing this for a different reason needs to follow it successfully.

   If the session was purely code changes (no environment/deployment/infrastructure work), state "No runbook needed — pure code session" and skip.

   This step is mandatory for setup operations and the session is not complete until either a runbook exists or the no-runbook-needed declaration is made.

13. **Architecture-constants compliance check** — Before closing, confirm:
   - No new vertical nouns were introduced in `packages/shared/**` or any DB migration serving multiple verticals (AC-1).
   - Any RLS policy deviation has a WHY documented inline AND an entry in the PLATFORM_STRATEGY.md Exception Log (AC-2).
   - No cross-vertical data path was opened without an explicit isolation check (AC-3).
   - Any new per-vertical variable is a token or vocabulary item, not a structural deviation (AC-4).

   If a violation was introduced intentionally (time-pressure workaround), add it to the Known Open Violations list in CLAUDE.md §1.5 with a remediation trigger.

   If the session did not touch shared schema, shared code, or RLS policies, state: "No AC compliance issues — session did not touch shared schema, RLS, or shared identifiers."

   This step is mandatory. The session is not complete until the compliance check is answered explicitly.

14. **STANDARDS compliance check** — Before closing, answer for this session:

   **STD-001 (Prove Before You Act):** Did any data change, destructive action, or fix happen before read-only diagnosis confirmed the root cause? If yes, document what was assumed vs. what was proved.

   **STD-002 (Red-Test-First):** For any bug fix applied this session — was the broken state made visible (trace, failing test, or query showing bad data) BEFORE the fix was applied? Include before/after artifact reference in the Handoff.

   **STD-003 (Instrumentation Preserved):** Were any `[SM-TRACE]`-style logs added this session? If yes:
   - Are they prefixed consistently?
   - If the fix is verified this session: are they gated behind `const <PREFIX>_DEBUG = false`?
   - If the fix is NOT yet verified: are the flag name and file paths noted in the Handoff for the next session?

   **STD-004 (Tenant Isolation Bar):** Did any feature touching business-scoped data ship this session? If yes: is a two-email isolation proof included in the Handoff?

   **STD-005 (Verbatim Decisions):** Were any decisions reversed or updated? If yes: was the prior text explicitly struck through or replaced (not just supplemented)?

   **STD-006 (Vertical-Agnostic):** Covered by AC-1 / Step 13. State: "No vertical nouns introduced in shared code" or document the exception.

   **STD-007 (Derived Connection State):** Did any session work touch a surface that displays integration status (QB, Blotato, any OAuth token)? If yes: confirm it derives state proactively from an expiry timestamp, not from a cached boolean.

   **STD-008 (Committed Migration ≠ Applied Migration):** Did any session work apply a DB migration? If yes:
   - Was the migration applied to the live DB this session?
   - Was an `information_schema.columns` verification query run after applying?
   - Is the live schema confirmation logged in the Handoff?
   State one of: "Migration applied and verified — live schema confirmed [columns listed]" or "Migration written; David must apply; verification query included in migration file."

   If the session did not trigger a given standard, state that explicitly. Do not skip silently.

   This step is mandatory. The session is not complete until every applicable standard is checked explicitly.

   Full standard text lives in STANDARDS.md.

---

**GAP vs DEBT ROUTING** — route by meaning, not by bucket:
- **TECH DEBT** (Tech Debt Log, standard-ID): built WRONG. Shortcut, hardcode, compromise that works but isn't right. (e.g. hardcoded STORAGE_KEY.)
- **NAMED GAP** (built-inventory `remaining:`): built as a LABELED, HONEST shell, intended to fill on a stated horizon. (e.g. service_offerings seed as 'suggested', no confirm-to-active UI yet.) A 'suggested'/hollow-but-labeled thing is a gap, NOT debt — it's working-as-designed at this phase.

A labeled gap is roadmap. Tech debt is a defect. Don't file roadmap as defects (floods the debt log) or defects as roadmap (hides them).

**GAP GRADUATION** — each built-inventory `remaining:` gap carries a stated horizon (now / next / later, or a date). A gap that is 30+ days PAST ITS STATED HORIZON has stopped being roadmap and is now a defect-in-practice — graduate it to the Tech Debt Log with a standard-ID, and remove it from `remaining:`. (30 days past horizon, NOT 30 days from creation — an honestly-deferred 'later' gap is on schedule, not stale.)

15. **Gap graduation sweep** — scan all `remaining:` gaps in `docs/built-inventory.md`; graduate any that are 30+ days past their stated horizon to the Tech Debt Log (with a standard-ID) and remove from `remaining:`. If no gaps are past horizon, state explicitly: "No gap graduations this session."

16. **PLATFORM_STATE.md update** — After any session that changes the level of a tracked item (a new file added, a caller wired, a build confirmed, a migration applied, an orphaned file deleted), update the relevant row in `PLATFORM_STATE.md`:
    - Advance the level only when you have evidence (WIRED → WORKS requires a test result, confirmed-live use, or build-verified runtime path — not just "it should work").
    - Move anything to "⚠️ NOT YET VERIFIED" if evidence is lost or stale.
    - Never mark David's operational checks done on his behalf.
    - Add new items to the appropriate section with all required columns (LEVEL + LOCATION + EVIDENCE).
    If no items changed level this session, state explicitly: "No PLATFORM_STATE.md level changes this session."

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

Do not start until you confirm all three.
Do not touch ignition-os, old Supabase project,
or QB oauth.ts.
```

---

*TRACE Enterprises · Built with CAI*
*cultivar-os.vercel.app · builtwithcai.com*
*(512) 456-3632 · david@trace-enterprises.com*
*Update this file every session. No exceptions.*
