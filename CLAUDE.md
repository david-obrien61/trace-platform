# CLAUDE.md — TRACE Platform
# Multi-AI Handoff Workflow — Claude Code reads this every session
# Last updated: 2026-07-16 (**APOSTROPHE ELIDE in `nameTokenSet` — tech-debt #55 CLOSED; ledger #132; implements D-45, NO new decision; BUILDER-COMPLETE, owner-proof owed; ZERO migration, ZERO api-fn (12/12).** `nameTokenSet` treated the apostrophe as a token BOUNDARY and the 1-char filter — which exists to kill the botanical hybrid marker `x` — ate the orphan: `Basham's` → {basham} vs its own WP slug's {bashams} ⇒ **false-UNKNOWN at scan**; `Hearts A'fire` → {hearts,fire}, the `a` eaten outright. **4 of 6 apostrophe varieties were unscannable in LIVE data.** It hid because **WRAPPING quotes survive either way** (`'Sierra'`→{sierra} — the quotes sit at word boundaries) and the whole D-45/D-46 arc was owner-proven on `'Sierra' Mexican Red Oak`: the one case anybody eyeballs works. Already flagged in prose at `personName.ts:27-30` during D-47 and correctly deferred — this is that build. FIX: ELIDE the apostrophe **BEFORE** the boundary split (**order IS the fix** — split first and `A'fire`→`a`+`fire`→the `a` is eaten); 5 codepoints (U+0027/U+2019/U+02BC/U+0060/U+00B4); the 1-char filter STAYS. §6 r16 deviation stated: Lucene STRIPS the possessive, we ELIDE — the target is a WordPress `sanitize_title` slug (`bashams-party-pink`), so stripping would still miss. RED-first: 21/4-fail → 34/0-pass, no existing assertion adjusted. **Blast radius probed LIVE read-only BEFORE the fix (116 rows, not 111): exactly 4 token sets change · 0 un-grouped · 0 re-grouped · populate.ts 4 FIXED/0 BROKEN · 0 bad merges** — no working grouping moved. `personName.ts` untouched, stays separate (two facts, two rules). PRIOR: 2026-07-16 (**SERVICE PRICE OVERRIDE IS A DISCOUNT — D-48 (proposed), the fix for the QBO `6070` invoice rejection; ledger #131; BUILDER-COMPLETE, owner-proof owed; ZERO migration, ZERO api-fn (12/12).** An owner override wrote `netTotal 1000` against `retailTotal 1575` leaving `discountAmt 0` — the line CONTRADICTED ITSELF, and **QuickBooks was the FIRST check anywhere in the chain that multiplied rate × qty**, rejecting the invoice. Silent because every TRACE surface rendered a correct-looking total: **no TRACE surface checks that a LINE is internally consistent** — every check looked at aggregates ACROSS lines while the defect lived WITHIN one. **An invariant only verified in a migration is not enforced** (D-43's verify passed only because no override existed yet). Fix: baseline PRESERVED + concession rides `discountAmt`; invariant THROWS at compute time; reason REQUIRED (UI+server+spine, no migration — the column existed); `discountTotal` → goods-only + new `serviceAdjustmentTotal`; QBO gets retail + the SAME negative-Amount discount line; QBO failures report honestly. Supersedes D-39's "leakage ≠ discount" service branch. Moves no money. 138/138 tests, RED-first.) PRIOR: 2026-07-16 (THUNDER QBO CUSTOMER IDENTITY — the three-way rule; D-47 committed `f7669c3`; **STD-019 ACTIVATED** (v2.4); CLOSES tech-debt #53, records #54/#55; ledger #130). Latest handoff state lives in §3 below; full history in the archive.
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
9. **Commit → push are ONE action (standing rule, David 2026-07-08).** Every `git commit` is IMMEDIATELY followed by `git push` to origin — never leave a commit sitting unpushed. The default is commit-and-push together; only skip the push if David explicitly says "hold" (or "commit only / don't push"). This makes "commit" mean "commit + push" everywhere in this doc (rule 8 above, §9 close-out, every build handoff). See [[feedback-always-push]].

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

## 1.6. BUILD-SPEC PRE-FLIGHT GATE (binding — folds into STEP 0)

Before ANY build spec is fired, reconcile it against these 10 items, **scoped to the files the
build touches** (reconcile what you touch, not the whole platform). The rule is **fix-all-in-one-pass**
— a gap found in a touched surface is fixed in THIS build, not deferred to a gap board. **Not
reconciled = not ready to fire.** This gate is part of STEP 0: a spec that hasn't cleared all 10 for
its touched surface is an incomplete spec.

1. **STORY** — the build CITES the `user_stories.md` story it satisfies (+ the flow-spec section if one holds the deep behavior). No matching story → create one first; conflict with a written story → STOP and surface. (§9 story-reconciliation gate)
2. **HARDCODED REGISTER** — check `docs/decisions/HARDCODED-REGISTER.md`: does a touched file own an OPEN item? Fix it this pass or document-with-reason. Introduce NO new hardcoded tenant/vertical literal (name/address/price/phone/tier/category — AC-1). A touched capability's register items get cleared, or its tile stays amber (see §6 rule 12).
3. **VALIDATION** — every user input AND every external/AI/OCR output is validated before write/display: required fields, type/range, **$0/null refusal**, and an honest "unknown/Not set" rather than a fabricated value (D-9 Surface Honesty).
4. **CRUD-WITH-PERMISSIONS** — any create/edit/delete surface is permission-gated (owner/manager/staff via the primitives `is_active_member` / `has_permission`), **enforced server-side, not merely hidden in the UI**; read scope and write scope agree; AC-3 `business_id`-scoped.
5. **UI / MODALS** — modals centered, sheets consistent, ≥48px touch targets; loading / empty / error states all present; no dead affordance (a control that looks editable MUST persist).
6. **AC-1..4** — no vertical noun in shared code/schema (AC-1); RLS scoped to `business_id` membership (AC-2); tenant isolation absolute — never a wrong-tenant record (AC-3); structure shared, only tokens/vocabulary vary per vertical (AC-4).
7. **12-FN CEILING** — no new `api/` file unless a slot is genuinely free; ride an existing endpoint (`action` / `shape` / param). Minting function #13 is a **STOP-and-surface** event, never silent. (§6 rule 11)
8. **REUSE, DON'T FORK** — the same OPERATION exists in exactly one place (rule of three); reuse the shared fn/component, never drift a near-duplicate copy. (§6 rule 8)
9. **TRACE STAYS ON** — the build ships `[TRACE:area]` instrumentation ON by default (STD-003), and does NOT comment out or delete any standing `[TRACE:*]` until the feature is OWNER-PROVEN. (§9 gate 9)
10. **MONEY-SAFETY ON MUTATIONS** — any mutation touching price / qty / inventory / invoice recomputes SERVER-AUTHORITATIVELY (tamper defense), re-reserves or releases inventory to match, and SURFACES (never silently mismatches) a now-stale invoice or total.

**"Not reconciled = not ready to fire."** If any item is unresolved for the touched surface, the spec
isn't ready — reconcile it (or record an explicit documented-with-reason deviation) before building.

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
| `~/Desktop/CAI-archive/` | `david-obrien61/CAI` | Ignition OS (original) | **Archive — RENAMED from `CAI` (archived, NOT deleted; a search for `CAI/` returns nothing because of the rename).** Reference-only: the historical original to consult **only if** the live donor below is missing something. **The LIVE Ignition donor is `trace-platform/packages/ignition-os/`** (files already copied + rewritten there — web-ported inline styles + instrumentation; confirmed a superset of the archive, e.g. PMI/`PredictiveKey.jsx` 710 vs 537 lines). Use the shared package as the donor; treat `CAI-archive` as historical original + `ai_router.py` reference until Railway is decommissioned. |
| `~/Desktop/CoolRunning/` | `david-obrien61/CoolRunning` | CoolRunnings (home automation) | Active — separate vertical, separate repo |
| `~/Desktop/IgnitionMobile/` | `david-obrien61/ignition` *(archived)* | Ignition OS mobile prototype | **Archive** — GitHub repo is archived. Rename desktop folder to `IgnitionMobile-archive`. Keep for migration reference until ignition-os web build is complete. |
| `~/Desktop/Cultivar-os/` | *(none — no git)* | — | **Empty folder** — safe to delete. Real Cultivar OS is in `trace-platform/packages/cultivar-os/`. |
| `~/Desktop/trace-assessment-app/` | *(none — no git)* | CoolRunnings assessment tool | Standalone app, no git. Contains `src/lib/AIEngine.js` (Claude Vision, device identification — different from Ignition AIEngine). |
| `~/Desktop/CoolRunning/` | `david-obrien61/CoolRunning` | CoolRunnings | See above. |

**Rule:** `trace-platform/` is the only folder that deploys to Vercel. All Cultivar OS work goes here. All Ignition OS work goes here — migration is complete as of 2026-05-28. **Ignition is donor-reference-only, not a peer system to maintain.** Live work is trace-platform / Cultivar (Supabase `bgobkjcopcxusjsetfob`). Live Ignition **donor code** = `packages/ignition-os/`. Live Ignition **data** (if ever needed) = Ignition Supabase project `ufsgqckbxdtwviqjjtos` (anon-key only locally; temp service key on request). `CAI-archive/` (renamed from `CAI`, not deleted) is the historical original, reference-only.

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

Active open items: #2 (QB hardcode), #3 (social in cultivar), #4 (nursery footer), #8 (RLS unverified), #10 (SavingsReport missing), #12 (Ignition AI dark / Railway kill path), #13 (stub duplication), #16 (MarginEngine orphaned — A callers + plants.cost_price), #17 (dead migration), #18 (pin_hash unverified), #19 (instagram fallback), #20 (platform union), #21 (orphaned campaigns files), #22 (platform_check migration — David must apply), #23 (STD-008 inverse sweep pending), #24 (opaque names), #25 (6 AI features dark), #26 (orphaned DataBridge keys), #27 (10 tables no migrations), #28 (pilot_all RLS open), #29 (receipts naming), #30 (voice-samples RLS scope), #31 (catalog-verify process), #32 (cultivar_plants anon read open), #33 (widget-header backfill), #34 ✅ resolved 2026-06-19 (qbo/status+auth-url 500 → router.ts:15 import depth 4x→3x, commit 14a9a82; esbuild-proven) · #35 ✅ resolved 2026-06-15 (nursery_profiles 406 → maybeSingle) · #36 (/assets + /pmi nav-dead) · #37 (PMI UI polish pass) · #38 (frictionless multi-channel cost capture — NEXT MAJOR BUILD after Core-2b; capture≠classification, hard-blocked on Core-2b sameCost dedup) · #39 (live schema not in version control — orders/customers/order_items + qb/leakage/netting cols live-only) · #40 (built-inventory flag correction — 5.1 inventory / 5.2 PMI are resolved, not ⚪) · #41 (Vercel Hobby 12-function ceiling — `api/` at limit; new functions silently fail deploy; mitigated by folding deliveries→customers; upgrade to Pro before next module wave) · #55 ✅ resolved 2026-07-16 (canonicalName APOSTROPHE DEFECT — possessive varieties FALSE-UNKNOWN on scan; **4 of 6 apostrophe varieties were BROKEN in live data**: Basham's Party Pink Crape Myrtle · Evey's Pride Mimosa · Summer's Tower Redbud · Hearts A'fire Redbud, all `variant_group` NULL, never counted. Wrapping quotes survived (`'Sierra'`→{sierra}) — which is why it hid — but possessives didn't (`Basham's`→{basham} vs slug {bashams} — the 1-char filter ate the `s`). FIXED by the elide-don't-split rule `personName.ts` proved in D-47, applied BEFORE the boundary split (order IS the fix); 5 apostrophe codepoints handled; RED-first per STD-002 (21/4 fail → 34/0 pass); blast radius probed live read-only = 4 token sets change, 0 groupings moved. Ledger #132, owner-proof owed) · #54 🟡 (qb_customer_id collision guard is code-level/TOCTOU — durable form is a partial unique index `(business_id, qb_customer_id) WHERE NOT NULL`; a MIGRATION; theoretical at zero links, needed before real billing volume) · #53 ✅ resolved 2026-07-16 (QBO customer find-or-create matched on EMAIL ALONE → cross-billed NINE real invoices to "Andrew O'Brien" over two months; fixed by the D-47 three-way rule — match on the field QBO guarantees unique (DisplayName), two fields must concur, ambiguity → CREATE/SURFACE never a guessed link, stored links verified-before-use; blast radius ZERO; owner-proof owed) · #42 ✅ resolved 2026-06-21 (seed.ts D-9 silent coercion — `classifyCategory` flags unknown instead of masquerading as 'addon'; price 0 → explicit flagged non-null placeholder; residual: nullable price needs a `service_offerings` ALTER)

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

### 2026-07-16 — THUNDER APOSTROPHE ELIDE in `nameTokenSet` (tech-debt #55): the possessive false-UNKNOWN — 4 of 6 apostrophe varieties were silently unscannable in LIVE data; the 1-char filter that kills the botanical hybrid `x` was eating the possessive `s`; implements D-45 (NO new decision); BUILDER-COMPLETE, owner-proof owed; ZERO migration, ZERO api-fn (12/12)

**Type:** App code — 3 files (`packages/shared/src/utils/canonicalName.ts` the fix · `.../canonicalName.test.ts` +13 assertions · `packages/cultivar-os/src/pages/InventoryCount.tsx` `[TRACE:RESOLVE]` token-set trail). **NO migration**, **ZERO new `api/` file** (12/12). `[TRACE:RESOLVE]`/`[TRACE:COUNT]` ON (extended, nothing silenced). `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 248 / knip 10·14·15 == baseline); `build:cultivar` clean 2350 modules. Tests: **canonicalName 34/34** (was 21) · **customerIdentity 22/22** (D-47 unregressed) · **catalog-variants 31/31** (the `populate.ts` consumer). Ledger row #132. **CLOSES tech-debt #55.**

**THE DEFECT (live, not theorized):** `nameTokenSet` treated the apostrophe as a token BOUNDARY, and the 1-char filter — which exists to kill the botanical hybrid marker `x` — then ate the orphaned fragment: `"Basham's Party Pink Crape Myrtle"` → `{basham,party,pink,crape,myrtle}` while its own WordPress slug `bashams-party-pink-crape-myrtle` → `{bashams,…}` ⇒ **NO MATCH → false-UNKNOWN at scan**. `"Hearts A'fire Redbud"` → `{hearts,fire}` — the `a` eaten outright. **Four of six apostrophe varieties in the live catalog were unscannable, all `variant_group` NULL, never counted.** This is precisely the class `canonicalName` exists to fix.

**WHY IT HID (the lesson):** **WRAPPING quotes survive either way** — `'Sierra'` → `{sierra}`, because the quotes sit at word boundaries whether you split on them or elide them. The entire D-45/D-46 size-variant arc was owner-proven on **`'Sierra' Mexican Red Oak`**, which has no possessive. **The one case anybody eyeballs works.** The defect was also already WRITTEN DOWN — `personName.ts:27-30` flagged it in prose during D-47 ("a QR slug `baileys-red-twig-dogwood` will not match a catalog `Bailey's Red Twig Dogwood`") and correctly deferred it as owner-proven territory needing its own provable build. This is that build.

**THE FIX — ORDER OF OPERATIONS IS THE FIX:** ELIDE the apostrophe **BEFORE** the non-alnum boundary split. Split first and `A'fire` → `a` + `fire` → the 1-char filter eats the `a` → `{fire}`. Verified explicitly and asserted (`nameTokenSet("Hearts A'fire").has('afire')`). **Codepoints handled: U+0027 `'` · U+2019 `’` (what most CMSs emit) · U+02BC `ʼ` · U+0060 `` ` `` · U+00B4 `´`** — live data carries only U+0027 today (probed), but the scrape source is WordPress, and a curly-apostrophe miss is the same bug wearing a different codepoint. **The 1-char filter STAYS** — its hybrid-`x` reason still holds; eliding merely stops feeding it orphans it was never meant to eat (asserted: `!nameTokenSet("Acer x 'Autumn Blaze'").has('x')`).

**§6 r16 — THE STANDARD, STATED, WITH ITS ONE DELIBERATE DEVIATION:** the established pattern (Lucene ASCIIFoldingFilter + WordDelimiterGraphFilter; Postgres `unaccent`) is fold → ELIDE intra-word punctuation → split on true word boundaries → drop stop-tokens. **The standard never splits on an apostrophe.** DEVIATION: Lucene **STRIPS** the English possessive (`Basham's` → `basham`); we **ELIDE** it (`Basham's` → `bashams`). REASON: our comparison target is a WordPress `sanitize_title` slug, which elides the apostrophe and emits `bashams-party-pink` — **stripping would yield `{basham}` and STILL miss.** Elide matches the source convention, and is the shape `personName.ts` already proved in D-47.

**STD-002 — RED FIRST, BOTH ARTIFACTS CAPTURED:** four failing assertions added BEFORE any source change → **`canonicalName: 21 passed, 4 failed` (exit 1)**, each of the four named varieties failing. Then the fix → **`canonicalName: 34 passed, 0 failed` (exit 0)**. **No existing assertion was adjusted to make the fix pass** — all 21 pre-existing stayed green throughout.

**⚠️ BLAST RADIUS — PROBED LIVE, READ-ONLY, BEFORE TOUCHING SOURCE (STD-001).** `populate.ts` is a WRITE path (`canonicalNameKey(v.slug) === canonicalNameKey(item.variety)` decides which rows GROUP at import), so a changed key was the real risk. Probed against the **REAL catalog — 116 rows, NOT the 111 the prompt assumed** (flagged): **exactly 4 token sets change** (only the four broken varieties, no others) · **L4 pairwise: 0 un-grouped, 0 re-grouped** · **populate.ts import: 4 FIXED, 0 BROKEN** · **0 groups merging distinct varieties**. **No currently-working grouping moves ⇒ no STOP condition.** The only changes are broken→fixed, which is the build's intent. Re-verified against the **REAL shipped function** afterward (not just the probe's re-implementation).

**STD-017 — EVERY SURFACE ENUMERATED, all true (the fix is in the ONE shared fn, so they inherit):** (a) `InventoryCount.tsx` handleScan L4 (`stockLineResolver.ts:112-119`) ✅ · (b) the typed no-QR resolve-before-create path (same `resolveStockLine`) ✅ · (c) `stockLineResolver` L5 size-picker gate (`detectSizeCollision`) ✅ unaffected — the four are one row each, so L4 returns `matches.length===1` and resolves directly · (d) `populate.ts:203-206` WRITE path ✅ proven 4-fixed/0-broken · (e) `searchStockLines:172-179` ✅ (already worked via the substring branch; the token branch now agrees) · (f) `canonicalName.test.ts` ✅ 21/21 pre-existing green.

**CONSTRAINTS HELD:** AC-1 (no vertical noun — the resolver names only `business_inventory`) · AC-3 (probe + all reads tenant-scoped) · §6 r8 (ONE tokenizer, ONE equality engine `tokenSetsEqual` — no fork) · §6 r11 (12/12 api-fn, none minted) · STD-001 (read-only proof first) · STD-002 (RED→GREEN artifacts) · STD-003 (`[TRACE:*]` extended, nothing commented out) · STD-011 · STD-017 · D-9.

**`[TRACE:RESOLVE]` EXTENDED (the diagnostic that was missing):** the L4 **hit** now logs `key:` (the normalized token set the equality actually compared), and — the valuable one — the **MISS** now logs `[TRACE:RESOLVE] L4 MISS — no name-token match for <tag> key: <key> (tokens: [...])`. A false-UNKNOWN is exactly the #55 class: the tag was RIGHT and the key silently disagreed by one eaten character. That trail is what makes the next one visible instead of a shrug.

**OWNER-PROVEN owed (David, live):** **(1)** Scan each of the four → resolves at L4 to the right row, NOT UNKNOWN — **Basham's Party Pink Crape Myrtle → `91be4388-6932-4aba-b859-c4f95ed76dfd`** (DISC-1009) · **Evey's Pride Mimosa → `970aa781-49ae-4184-afe7-15268d7a3138`** (DISC-1070) · **Summer's Tower Redbud → `076a20a1-f1b9-40bd-9de8-7580468d586f`** (DISC-1099) · **Hearts A'fire Redbud → `518dd451-faf7-4214-837e-a46afd3785d8`** (DISC-1091). **(2)** `[TRACE:RESOLVE] L4 name-token` shows a **`key:`** field (e.g. `key: bashams crape myrtle party pink`). **(3)** `'Sierra' Mexican Red Oak` UNREGRESSED — both sizes resolve, still share `variant_group=sierra-mexican-red-oak`, size-picker still fires. **(4)** The other 112 rows scan exactly as before. `[TRACE:*]` stays ON until owner-proven. ⚠️ **DEPLOYED bar FIRST (§9 — committed ≠ live):** the signal ONLY this build emits is the **`key:` field on `[TRACE:RESOLVE]`**; the OLD line has no `key:`. **If a variety still scans UNKNOWN or `key:` is absent, you are testing OLD code — hard-refresh, confirm the Vercel deploy is READY and the bundle hash changed, and do NOT declare pass/fail** (the #128/#129 stale-cached-bundle scar).

**FLAGGED FOR DAVID (named, NOT built):** **(a)** **`variant_group` backfill for the four is a SEPARATE D-45 concern — deliberately not built, no SQL written this pass.** All four are `variant_group` NULL, but the scan **RESOLVES without it** (one row per variety → `matches.length===1` → resolved via name); the group only matters when a 2nd size is added to one of them (then `detectSizeCollision` needs it). Not a blocker for the owner-prove. **(b)** **`personName.ts` vs `nameTokenSet` — both now elide apostrophes; surfaced under §6 r10, NOT merged.** This is NOT two representations of one fact (STD-011): "same PERSON?" and "same PLANT?" are two different facts with different rules — `personName` drops no botanical connectors (`var`/`ssp`/`subsp`/`cv`) and its 1-char filter means "a middle initial is not identity," not "kill the hybrid `x`". D-47 already recorded this reasoning; they legitimately share only the ONE equality engine `tokenSetsEqual`, which both already reuse. **(c)** The live catalog is **116 rows, not the 111** the prompt cited — worth reconciling wherever 111 is written down. **(d)** `nameTokenSet` also turns an HTML numeric entity (`&#039;`) into a stray numeric token via the existing `&`→space rule — **NOT present in live data** (probed all 116 names: only U+0027, zero entities), so deliberately not handled; it would be speculative work (§6 r10 over-engineering trap).

### 2026-07-16 — THUNDER SERVICE PRICE OVERRIDE **IS A DISCOUNT** (D-48 proposed): the fix for the QBO `6070` invoice rejection — the D-43 invariant was SPECCED but never ENFORCED at compute time, so an override wrote a line that contradicted itself; QBO was the FIRST check anywhere that multiplied rate × qty; BUILDER-COMPLETE, owner-proof owed; ZERO migration, ZERO api-fn (12/12)

**Type:** App code — 1 shared spine (`packages/shared/src/business-logic/tierPricing.ts` + its `.test.ts`) + 6 cultivar (`api/orders/submit.ts` · `api/qbo/invoice/cultivar.ts` · `src/pages/CartReview.tsx` · `src/pages/Confirmation.tsx` · `src/pages/OrderDetail.tsx` · `src/components/checkout/OrderTotals.tsx` · `src/hooks/useSubmitOrder.ts`). **NO migration** (`override_reason` already existed on BOTH `order_service_selections` and `order_items` since `20260708_service_override_leakage.sql:27,36`, applied — submit already WROTE it; it was simply never REQUIRED). **ZERO new `api/` file** (12/12). `[TRACE:PRICE]`/`[TRACE:LEAKAGE]`/`[TRACE:QBO]` ON (every line now logs `invariantOk`). `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 248 / knip 10·14·15 == baseline); `build:cultivar` clean 2350 modules; esbuild OK both endpoints; **138/138 tier-pricing tests** (was 84; +54, **RED-first per STD-002**). Decision **D-48 (proposed)** (`docs/decisions/2026-07-16-service-price-override-is-a-discount-D48.md`). Ledger row #131.

**THE SCAR (proven live, CLV-20260716-1156 — do NOT re-derive):** `[TRACE:PRICE]` Placement Service = `retailUnit 225 · qty 7 · retailTotal 1575 · discountPct 0 · discountAmt 0 · netTotal 1000`. **`1575 − 0 ≠ 1000` — the line CONTRADICTED ITSELF.** The override wrote `netTotal` and left `discountAmt` at zero, so the record said in one breath both "7 × $225 with nothing off" and "this costs $1000." **QBO was the FIRST thing downstream that multiplied**: it got `UnitPrice 225 × Qty 7 = 1575`, saw `Amount 1000`, and REJECTED the invoice — `6070 "Amount is not equal to UnitPrice * Qty. Supplied value:1,000"` (reproduced on 2 pushes, 16:57 + 17:19; **the invoice does not exist in QuickBooks**).

**WHY NOTHING CAUGHT IT (the lesson):** every TRACE surface rendered $1000 and reconciled cleanly (Subtotal $2020 · Tax 7.6% $153.52 · Total $2173.52 — all arithmetically correct). The *totals* were right. **No TRACE surface checks that a LINE is internally consistent** — every check we had looked at *aggregates ACROSS* lines, and a sum of nets is right regardless of whether each line's own arithmetic holds. The defect lived in a relationship *within* one line. **ROOT: D-43 SPECCED the invariant (`retail_total − discount_amt === net_total`) and verified it in a MIGRATION — which passed ONLY because no override existed yet.** Nothing enforced it where lines are BORN. **An invariant that is only verified in a migration is not enforced.**

**BUILT (David's ruling — an override IS a discount; SUPERSEDES D-39's "leakage ≠ discount" service branch):**
- **(1) OVERRIDE-AS-DISCOUNT** — the retail baseline (`retailUnit`/`qty`/`retailTotal`) is **PRESERVED** (what makes the giveaway visible AND what lets QBO multiply and agree); the concession lands in `discountAmt 575` / `discountPct 36.51` (**convention stated:** `round2(discountAmt / retailTotal × 100)`). The tier still NEVER touches a service.
- **(2) THE INVARIANT IS ENFORCED AT COMPUTE TIME AND *THROWS*** — asserted on every line inside `computeOrderPricing` with a half-cent tolerance (`round2` of a float difference leaves dust: `0.3 − round2(0.3−0.1) ≠ 0.1`). Unfireable by construction → it is the guard against the NEXT branch that forgets. Throwing is right: a self-contradictory money line is a programming error, and refusing an order beats billing an incoherent one.
- **(3) UPWARD override = a NEGATIVE discount (surcharge) — ALLOWED** (decided + stated). Refusing would **REGRESS an ability the owner has today** (the code caps nothing — an upward override already charges more) and it's legitimate (rocky site → extra labour). Stays consistent (`1575 − (−425) = 2000`), pushes a POSITIVE "price adjusted" line, no branch. `discountPct` honest-negative — a real number, not nonsense; **never rendered as "% off"** (neutral "price adjusted" wording reads correctly both ways; CartReview's old `Math.max(0, …)` rendered *nothing* for a surcharge — now fixed).
- **(4) ⚠️ `discountTotal` RESTRICTED TO GOODS-ONLY + NEW `serviceAdjustmentTotal` — the structural trap the spec did NOT anticipate.** `discountTotal`'s contract already SAID "Σ discountAmt (goods only)" but it summed **every** line and merely got away with it *because services were hardcoded to `discountAmt: 0`*. The moment a service override became a discount, the $575 would have leaked into the roll-up Review/Confirmation render as **"<tier> — N% off"** against `goodsRetailSubtotal` → "Contractor tier 1 — 10% off −$714.60" on a customer whose tier discount was $139.60. **Two proven surfaces would have started lying, and the totals would still have summed correctly.** STD-011: a tier discount and an owner concession are two DIFFERENT facts (different authority, label, audit trail) — *one representation of two facts* is the same disease inverted.
- **(5) REASON REQUIRED (STD-013, reusing D-40's exemption shape — no second mechanism):** UI (`saveEditor` blocks Apply; labelled `Reason *` + a surfaced error, not a silent no-op — §6 r15/M2) **and** server (`applyOverride` REFUSES, logs, charges the **BASELINE** — refusal charges MORE, the money-safe direction) **and** spine (`computeOrderPricing` enforces it independently, so the gates agree *by construction*). **NO MIGRATION** — the column existed and was written; it was never *required*. David applied a $575 giveaway with the field **blank** and it went through.
- **(6) THE QBO LINE** — an overridden service pushes at its **RETAIL baseline** (`225 × 7 = 1575`, internally consistent → accepted) + the concession on the **SAME** negative-Amount mechanism as the tier discount, described `"Placement Service — price adjusted (reason: loyal contractor)"`. **STD-011:** extracted ONE `discountLine()` helper used by BOTH the goods tier discount (D-43) and the service override — no forked second discount path. **GATED** on an override applying → a normal order pushes **byte-identical** (zero regression; `unit_price_at_time × quantity === subtotal` holds for every non-overridden row since flat services store qty 1). NEW **reconcile check**: the assembled lines must SUM to the order total or the push is REFUSED — so a discount line can never double-count against an already-netted line, and TRACE never sends an amount it didn't charge.
- **(7) CONFIRMATION REPORTED THE FAILURE HONESTLY (D-9)** — the push hard-failed (400) and the page rendered *"⏱ Invoice will sync to QuickBooks shortly — Connect QuickBooks from the owner dashboard."* Wrong twice: QBO **was** connected (it minted customer 84 seconds earlier), and nothing would **ever** sync. **The cause was structural: the type was `'success' | 'pending'` — there was NO failed state to render**, so every failure fell into a bucket that promised a sync. Now THREE honest states (`QbSyncStatus`): `success` · `not_connected` (**503 only** — the connect prompt is right *here and only here*) · `failed` (400/409/500/throw — say so, name the reason, give the action). Scoped by `ownerView`: owner sees the real error + next step; the customer sees a true neutral state ("Order confirmed — invoice to follow") with **no internals and no owner instruction** — which the old copy was handing to customers on the public QR path.

**⚠️ CAUGHT DURING THE BUILD (surfaced, fixed same pass):** `CartReview` fed `overrideTotal` **without** `overrideReason` — under the new reason rule the Review preview would have REFUSED the override and shown **$1575** while submit charged **$1000**: the exact **STD-012 Review-vs-submit divergence**, re-created by the fix for a different bug.

**RECORDED — THE TEST THAT BLESSED THE BUG:** `tierPricing.test.ts` test 16 asserted, verbatim, `ok(p.lines[1].netTotal === 1000 && p.lines[1].discountAmt === 0, 'override $1000 charged, discountAmt 0 (leakage ≠ discount)')`. **The defect was TESTED IN and blessed** — that is why it survived a green suite: the suite asked whether the override *replaced the charge* (it did) and never whether the LINE *still added up* (it didn't). A test can only catch what it asserts. Rewritten to assert the invariant, with that history in the file.

**CONSTRAINTS HELD:** STD-012 + persistence clause (ONE canonical computation; every surface renders the stored breakdown) · STD-013 · STD-011 (ONE `discountLine()`; ONE reason mechanism; two facts kept in two representations) · STD-017 (Review · Confirmation · order-detail · QBO all show the override + reason) · STD-002 (RED-first) · D-9 · D-43 (its invariant, now enforced) · AC-3 · §6 r11 (12/12). **This fix MOVES NO MONEY** — the scar order still totals **$2173.52** to the penny.

**OWNER-PROVEN owed (David, live — re-run the CLV-20260716-1156 shape: Vitex 30 ×4 $496 · 'Sierra' Mexican Red Oak 15 ×3 $399 · Delivery $125 · Placement ×7 baseline $1575):** **(1)** override Placement to $1000 **WITHOUT a reason → BLOCKED**. **(2)** add "loyal contractor" → applies. **(3)** `[TRACE:PRICE]` Placement line = `retailUnit 225, qty 7, retailTotal 1575, discountAmt 575, netTotal 1000, invariantOk true`. **(4)** Review/Confirmation/order-detail all show the override AND its reason; Subtotal **$2020.00** · Tax (7.60%) **$153.52** · Total **$2173.52**. **(5) THE PUSH SUCCEEDS — no 6070**; the real QBO invoice shows `Placement Service 7 × $225.00 = $1,575.00` + a **−$575.00** line naming the reason; **QBO total $2,173.52 === TRACE's total**. **(6) NEGATIVE:** force a QBO failure → Confirmation says it **FAILED with the reason**, NOT "will sync shortly" and NOT the connect prompt. `[TRACE:*]` stays ON until owner-proven. **COMMITTED + PUSHED `5f16c42`** — Vercel builds from it; app-code-only, no migration gate. ⚠️ **DEPLOYED bar FIRST (§9 — committed ≠ live):** the signals ONLY this build emits are **`invariantOk`** on every `[TRACE:PRICE]` line and **`[TRACE:QBO] service price-override line (D-48)`**. **If the Placement line still logs `discountAmt: 0`, or the push still 6070s, you are testing OLD code — confirm the Vercel deploy is READY and do NOT declare pass/fail** (this bit us 3× on 2026-07-03 and again at ledger #128/#129, where a stale cached bundle was mistaken for a live regression).

**FLAGGED FOR DAVID (named, NOT built):** **(a)** **`apply_discount` is DECLARED but NOT the gate** (`actionPermissions.ts:55`) — the override rides `manage_orders` + the server owner/manager token gate, which its own comment documents as deliberate; STD-013's "grantable named permission" is satisfied in substance. NOT wired this pass: OWNER/MANAGER default to both (zero observable change for LAWNS today = zero value now), while changing *who may override* in the commit that changes *what an override means* would make a failed owner-prove ambiguous between two causes (non-zero risk now). §6 r10 surfaced, already documented-with-reason. **(b)** **Goods overrides don't exist yet** — service-only by contract, the goods branch ignores `overrideTotal`, `serviceOverrides` is keyed by *offering* id, `canOverride` reaches only `ServiceRow` → **no stacking question today, nothing guessed**. The 20260708 migration schema-readied `order_items`; **when a plant-line override is built it WILL be a stacking question** (the tier discount already occupies a goods line's `discountAmt`) — David decides then. **(c)** **"Open item #4" could NOT be confirmed** — no `#4` matching "placement/planting labor edit" exists: tech-debt #4 = the PlantProfile **nursery-footer hardcode**; CLAUDE.md's Open-Arch table has **no #4** (runs 1, 2, 3, **5**…); the unnumbered §4 POST-DEMO install-price items are about a *stored default*, not an *order-time* override. **Nothing was marked closed on a guess** — this build closes the price-override defect only and does NOT touch the service **qty**-edit path (`serviceQuantities`). If the "#4" you meant is on a board I haven't found, point me at it.

### 2026-07-16 — THUNDER QBO CUSTOMER IDENTITY: the THREE-WAY rule replaces the email-only match — the fix for the cross-identity billing scar (NINE real invoices billed to the wrong person over two months); D-47 committed `f7669c3`; **STD-019 ACTIVATED** (v2.4); CLOSES tech-debt #53, records #54/#55; BUILDER-COMPLETE, owner-proof owed; ZERO migration, ZERO api-fn (12/12)

**Type:** App code — 3 NEW (`packages/shared/src/utils/personName.ts` person-name canonical key · `packages/shared/src/quickbooks/customerIdentity.ts` the ONE pure decision fn · `.../customerIdentity.test.ts` 22 assertions) + 2 EDIT (`packages/cultivar-os/api/qbo/invoice/cultivar.ts` matcher + stored-link verification + collision guard + 6240 surfacing + BillAddr + 409 · `packages/shared/src/index.ts` barrel). **NO migration** (blast radius ZERO), **ZERO new `api/` file** (12/12). `[TRACE:QBO]` ON (extended: logs the three-way decision + which rule fired). `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 248 / knip 10·14·15 == baseline); esbuild OK; `build:cultivar` clean 6.0s; **22/22 identity tests** + **21/21 canonicalName regression** green. Decision **D-47 (proposed)** (`docs/decisions/2026-07-16-qbo-customer-identity-resolution-D47.md`). Ledger row #130.

**THE SCAR (proven live — NOT theorized):** TRACE "TERRENCE OBRIEN" / david_obrien2016@outlook.com bound to QBO customer **81 = "Andrew O'Brien"**. **NINE real invoices** (2026-05-22 ×4, 05-23, 05-27, 05-29, 07-15) were billed to Andrew for sales that never happened — **two months of silent cross-identity billing**. Silent because **every TRACE surface showed the correct customer throughout**; the defect existed only in QuickBooks and surfaced only when David opened it and read the name. No amount of testing TRACE's own surfaces would have caught it — it lived at the boundary, the one place TRACE never looked back at.

**ROOT ASYMMETRY (the lesson):** **QBO enforces `DisplayName` UNIQUE. QBO does NOT enforce unique email.** TRACE matched on the ONE field QBO permits to collide (families share an email — literally the case here; an office shares one across staff) and ignored the ONE it guarantees. Email is not an identity key in QuickBooks; we were reading the wrong column.

**RECON ANSWERED THE READBACK QUESTION FIRST (it could have made the build smaller — it didn't):** **no readback exists.** Nothing reads QBO customers into `customers`; the only `select * from Customer` in live code IS the push path. The three readback-looking artifacts (`pullQBOCustomers`, `ExternalBridge.qbo.pullCustomers`, `QuickBooksConnector.jsx`) are dead Railway-era code calling an endpoint deleted at `7388c7b`, and even alive they merged into localStorage and never wrote `qb_customer_id`. **So the matcher is LOAD-BEARING** (without it, any party predating TRACE — LAWNS has QBO customers older than TRACE — would 6240 on every push) → **fix it, don't delete it.**

**BUILT (the three-way rule — ambiguity NEVER auto-links):** query QBO by **email AND `DisplayName`** (the field QBO actually guarantees unique) and resolve the **union** through ONE pure shared rule `resolveQboCustomerMatch`: email+name concur on ONE record → **LINK**; **email-YES/name-NO → CREATE** (← the Terrence rule, never link); name-YES/email-no → **SURFACE**; neither → **CREATE**; email→A but name→B → **SURFACE**; several match both → **SURFACE** (never the arbitrary `[0]` pick — that pick IS the scar). **STORED LINKS VERIFIED BEFORE BILLING** — a stored `qb_customer_id` is a **CACHE, not a fact**: fetch the QBO record, re-check the name, drift/unreadable → **REFUSE the push + flag**. That check is what would have caught this on **invoice #1 instead of #9** — the sticky never-re-verified link is what turned one bad match into nine. **COLLISION GUARD** (two TRACE customers may never share a `qb_customer_id`, business_id-scoped — AC-3). **QBO 6240 duplicate-DisplayName SURFACES**; the silent email-as-DisplayName junk-record fallback is **RETIRED** (it routed around a collision by manufacturing a badly-named record and hiding the collision from the owner). Ambiguity → **409 `qb_customer_identity_conflict`** with owner-actionable prose, not a generic 500 (a real ambiguity is not a server fault — it is a decision only the owner can make; §6 r6 governs order PLACEMENT, and the order is already placed and safe). CREATE builds `BillAddr` from the D-41 `billing_*` (legacy `address_*` fallback; all-empty → omit, D-9). **Separation:** the DECISION is pure and lives in `shared` (testable without QBO); the IO stays in the endpoint (STD-011 — ONE resolution path).

**⚠️ REASONED DIVERGENCE — SURFACED, NOT SILENT (§6 r10):** the build prompt assumed the **#61 L4 token-set resolver could be reused** for name comparison ("case-fold, strip punctuation/apostrophes"). **It CANNOT** — verified empirically: `nameTokenSet("O'Brien") → {brien}` (the apostrophe splits it, then the 1-char filter — which exists to kill the botanical hybrid marker `x` — drops the `o`) vs `nameTokenSet("OBrien") → {obrien}` ⇒ **"TERRENCE OBRIEN" vs "Terrence O'Brien" = NO MATCH**, the very case the prompt named. Built a separate **`personName.ts`** that **ELIDES** the intra-word apostrophe and **REUSES the one equality engine** (`tokenSetsEqual`) — justified because "same PERSON?" and "same PLANT?" are two different facts with different normalization rules (STD-011 forbids two representations of ONE fact; it does not force two facts through one rule). **`nameTokenSet` NOT modified** (D-45/D-46 owner-proven territory).

**BLAST RADIUS PROBED LIVE = ZERO** (read-only, 2026-07-16): **0 customers carry a `qb_customer_id`**; no collisions; 16 customers, 0 sharing an email; TERRENCE (`dd7e2201…`) `qb_customer_id = NULL` (David cleared it 2026-07-15). **Remediation is zero rows.** Note **why clearing the link works NOW and did not before:** under the OLD logic clearing it just regenerated the same bad link on the next push (email still hit Andrew, name still ignored) — **that trap is what this fix removes.**

**CONSTRAINTS HELD:** **D-9 applied to IDENTITY** (never guess a person; ambiguity → CREATE or SURFACE; an **EMPTY name never matches** — two blanks both reduce to the empty set and set-equality would call that a match; absence is not agreement) · STD-011 (ONE resolution path; reuses `tokenSetsEqual`) · STD-013 (refusal logged with the record) · D-37 (QBO still owns the invoice/customer record — unchanged) · STD-017 (the fix is on the **REAL push**, not the preview — `DemoQBInvoice` renders order data and resolves no identity, so it is not a surface of this capability) · AC-3 · §6 r11 (12/12).

**OWNER-PROVEN owed (David, live):** **(1)** Push an invoice for TERRENCE (qb_customer_id NULL, email collides with Andrew's 81) → `[TRACE:QBO] cust DECISION` shows `action:'create'`, rule `email-YES/name-NO → CREATE`, emailHits `81:Andrew O'Brien` → a **NEW** QBO "TERRENCE OBRIEN" is created; **the invoice bills TERRENCE, not Andrew**; `customers.qb_customer_id` = the NEW id (not 81). **(2)** Push a 2nd invoice for Terrence → `cust — STORED link VERIFIED (name still agrees)` → bills Terrence. **(3)** Push for a customer with no QBO presence → CREATE, links cleanly. **(4) NEGATIVE (the invoice-#1 catch):** point a TRACE customer's `qb_customer_id` at a QBO customer with a different name → the push **REFUSES** (409) + `⚠ STORED LINK NAME DRIFT` — does NOT bill the wrong person. `[TRACE:QBO]` stays ON until owner-proven. **COMMITTED + PUSHED `f7669c3` (STD-019 activation `c2cbc8a`; `97606e8..c2cbc8a` on main) — Vercel builds from it; app-code-only, no migration gate.** ⚠️ **DEPLOYED bar FIRST (§9 — committed ≠ live):** the signal ONLY this build emits is **`[TRACE:QBO] cust DECISION`** with a `rule:` field; the OLD signal is **`cust SELECTED … rule:'first-hit of the email-only query (index [0]); NO name verification before reuse'`**. **If you still see the OLD line, you are testing OLD code — confirm the Vercel deploy is READY and do NOT declare pass/fail** (this bit us 3× on 2026-07-03 and again at ledger #128/#129, where a stale cached bundle was mistaken for a live regression).

**FLAGGED FOR DAVID (named, not built):** **(a)** race-proof collision guard = partial unique index `UNIQUE (business_id, qb_customer_id) WHERE qb_customer_id IS NOT NULL` — the guard is read-then-write, proportionate at a single-owner nursery's volume but not race-proof; it's a **migration**, deliberately not taken at zero blast radius. **(b) 🔴 plant-resolver apostrophe bug → tech-debt #55, CONFIRMED IN LIVE DATA (4 of 6 apostrophe varieties BROKEN):** Basham's Party Pink Crape Myrtle · Evey's Pride Mimosa · Summer's Tower Redbud · Hearts A'fire Redbud — all `variant_group` NULL, never counted. **Wrapping quotes survive** (`'Sierra'`→{sierra} — the quotes sit at word boundaries either way, which is why it hid: the case anybody eyeballs works); **possessives don't** (`Basham's`→{basham} vs slug {bashams} — the apostrophe splits the word and the 1-char filter eats the orphaned `s`) → false UNKNOWN at scan, the exact class `canonicalName` exists to fix. Same elide-don't-split fix `personName.ts` just proved; D-45 defect, separate build (red-test the four varieties FIRST per STD-002 — proven scan territory). **(c)** BENCH-C review of `[TRACE:QBO]` PII (names/emails in the operator-only Vercel log — pre-existing since 97606e8, flagged not silently widened). **(d)** delete the dead readback code (the 2026-06-01 QBO audit already says DELETE). **(e)** a real QBO readback so the owner links deliberately. **(f) ✅ STD-019 ACTIVATED** (David's go, 2026-07-16 — STANDARDS.md **v2.4**): *external identity binds on the field the external system GUARANTEES unique; ambiguity never auto-links; **a stored link is a CACHE, not a FACT — verify before use***. Generalizes to any external identity binding (Stripe/BENCH-A, supplier catalogs), not just QBO. **DAVID'S OWN BOOKKEEPING (NOT a platform action): nine invoices in TRACE Enterprises' real QBO are billed to Andrew O'Brien for sales that never happened — his call to void.**

### 2026-07-15 — THUNDER POST-CHECKOUT DISPLAY PARITY (STD-017 scar #2): order-detail + QBO brought onto the canonical D-39/D-40 show-the-work structure from the D-43 STORED breakdown — six display fixes in ONE pass, ONE new shared `OrderTotals` presenter + the ONE shared `describeTaxLine`; BUILDER-COMPLETE, owner-proof owed; implements D-39/D-40/D-43 + STD-017 (NO new decision); ZERO migration, ZERO api-fn (12/12)

**Type:** App code — 1 NEW (`packages/cultivar-os/src/components/checkout/OrderTotals.tsx` — the ONE canonical totals-structure presenter) + 5 EDIT (`pages/OrderDetail.tsx` totals block → OrderTotals, size-not-SKU sub-label, tax-exempt cols added to the read · `pages/Confirmation.tsx` → OrderTotals, render all services incl. $0 · `pages/DemoQBInvoice.tsx` QBO-preview three-state tax line · `pages/CartReview.tsx` zero → "$0.00" not em-dash · `pages/AddOns.tsx` tier-discount note). **NO migration** (all cols exist), **ZERO new `api/` file** (12/12 — display-only, no new server work; the REAL QBO push `cultivar.ts` already rendered the exemption reason, left as-is). `[TRACE:PRICE]`/`[TRACE:TAX]` ON. `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 248 / knip 10·14·15 == baseline); `build:cultivar` clean 2350 modules. Ledger row #128.

**WHY (STD-017 — a fix is complete only when true on EVERY surface):** David's full-surface owner test on **CLV-20260715-2764** (john smith, Contractor tier 1 10% off, tax-exempt agricultural) proved the MONEY correct on all five surfaces ($2,775.50; discount −$119.50) — but order-detail and QBO had DRIFTED from the D-39/D-40 display STRUCTURE that Review/Confirm render. Classic STD-017 (this is its scar #2, the same shape as the QBO-discount scar #1): built + proven on the checkout surfaces, false on the post-checkout ones.

**SIX FIXES (all render the SAME structure from the SAME stored fact — STD-012 persistence clause, no surface recomputes):**
- **(1) order-detail totals were arithmetically misleading** — `Subtotal $2,775.50` + `Add-ons $1,700` ≠ `Total $2,775.50` (the "Add-ons" aggregate double-read against a subtotal that already contained the services). Replaced with the NEW shared **`<OrderTotals>`**: goods subtotal (retail) → discount −N% → goods after → each SERVICE (not discounted) → subtotal (after discount) → three-state tax → total; **the "Add-ons" line is DELETED**. The lines now SUM to the total.
- **(2) tax-exemption reason MISSING** — order-detail showed a bare "Tax $0.00"; the QBO **preview** (`DemoQBInvoice`) had a HARDCODED "Sales Tax 1 $0.00" row. Both now render the D-40 three-state via the SHARED **`describeTaxLine`** from the persisted `tax_exempt_applied/reason/cert_ref` → "Tax exempt — Agricultural exemption $0.00" (D-40: never $0.00-as-no-tax with no reason). The **real** QBO push (`cultivar.ts:322-345`) ALREADY rendered the reason via the shared `taxExemptionLabel` — verified, left unchanged (server money code, correct).
- **(3) Confirm silently dropped $0.00 service lines** (filtered `netTotal>0`) → now renders EVERY selected service incl. the $0 Deer bundle (matches Review/QBO/order-detail).
- **(4) zero rendered three ways** (Review "—" em-dash; others "$0.00") → ONE convention **"$0.00"** everywhere (em-dash reads as "unknown", a different meaning).
- **(5) order-detail sub-label mixed SKU and size** (internal DISC- id on one line, size on the other) → **SIZE** consistently (matches Review + QBO; the DISC- prefix is our discovery-scrape id, not owner-facing).
- **(6) addons page showed the pre-discount total with no tier mention** → a parallel note **"Your <tier> discount applies at checkout"** when a discounting tier is attached (copy only — the computation stays at Review; a retail customer sees nothing new).

**CONSTRAINTS HELD:** STD-017 (all five surfaces now render the same structure) · STD-012 + persistence clause (post-transaction surfaces RENDER the D-43 stored breakdown + D-40 stored taxStatus; NO recompute) · STD-011 (ONE totals presenter `OrderTotals`, ONE tax presenter `describeTaxLine` — no per-surface fork) · D-9 (historical/null-breakdown orders render net-only, no fabricated discount line, no crash) · AC-3 (business_id-scoped reads). NO migration, 12/12 api-fn held.

**OWNER-PROVEN owed (David, live — re-run CLV-20260715-2764 or an equivalent contractor+exempt order):** (1) order-detail totals read Goods subtotal $1,195 → Discount 10% −$119.50 → Goods after $1,075.50 → Delivery $125 → Placement $1,575 → Subtotal $2,775.50 → Tax exempt — Agricultural exemption $0.00 → Total $2,775.50, lines SUM to total, no "Add-ons"; (2) order-detail + QBO (preview AND real push) show the exemption reason, not a bare/silent $0.00; (3) Confirm lists ALL THREE services incl. the $0 Deer bundle; (4) zero = "$0.00" everywhere; (5) order-detail sub-labels show SIZE on both lines; (6) addons notes the contractor discount, a RETAIL customer sees no note; (7) a NON-exempt contractor order taxes on the DISCOUNTED subtotal, "Tax (X%)" identical on all five (the taxed state — still unproven, David's exempt test proved only the exempt state); (8) a historical/pre-D-43 order renders net-only, no crash. `[TRACE:*]` stays ON until owner-proven. **UNCOMMITTED — app-code-only, ready to commit (no migration gate).** **Flagged for David (data vs display, NO fix this pass):** Placement Service categorized `transport` = **DATA** (`service_offerings.category='transport'` on that row — should be a labor/service value; it also drives the netting/discount seams, so correct with care); the orphaned "Staff transport" under the Deer line = **DISPLAY** (it's `order.transport_note`, a derived `buildTransportNote` label rendered as a note, NOT an `order_service_selections` orphan).

### 2026-07-15 — THUNDER D-46 OWNER-PROVE FOLLOW-ON: three defects fixed live-testing D-46 in ONE pass (implements D-46 + STD-011, NO new decision) — (1) SKU EDIT-PERSIST BUG, (2) add-size SKU LINEAGE (base + size suffix), (3) engine-level LEFT-PINNED row actions; BUILDER-COMPLETE, owner-proof owed; ZERO migration, ZERO new api-fn (12/12)

**Type:** App code — 2 shared (`packages/shared/src/inventory/variantGroup.ts` NEW `skuSizeSuffix` + `deriveSiblingSku` · barrel export) + 3 cultivar (`components/inventory/InventoryEditor.tsx` persist-bug fix + add-size SKU derivation + uniqueness guard · `components/datasheet/DataSheet.tsx` NEW `rowActions` left-pinned column · `pages/BusinessInventory.tsx` + `pages/Customers.tsx` moved onto `rowActions`). **NO migration** (sku column exists), **ZERO new `api/` file** (12/12 — all client RLS writes). `[TRACE:INVENTORY]` + `[TRACE:datasheet]` ON. `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 249→**248 ↓ baseline re-locked** / knip 10·14·15 == baseline); `build:cultivar` clean; SKU-suffix logic unit-checked (11 cases green). Ledger row #127.

**CONTEXT:** David owner-proved D-46 (`1530f31`) live — add-size + variant_group inheritance + group-aware rename all WORK (two 'Sierra' Mexican Red Oak rows share `variant_group` `sierra-mexican-red-oak`). Live testing surfaced three follow-on defects.

**FIXED:**
- **(1) SKU edit did NOT persist (capture-persist break).** The `InventoryEditor` text fields (`sku`/`size`/`variant_group`/`location` + notes) were CONTROLLED in EDIT mode (`value` + `onChange` writing every keystroke into `draft`), so by blur time `draft.sku` already equalled the typed value and `saveText`'s `value === draft[field]` guard SHORT-CIRCUITED → nothing written. **FIX:** edit-mode inputs are now UNCONTROLLED (`defaultValue` + `onBlur`, no `onChange`) — mirroring the name/price/qty fields that never had the bug; create-mode stays controlled for the buffered insert. Also fixed the same latent bug on size/variant_group/location/notes edits. `[TRACE:INVENTORY] patch` now shows the sku write. SKU is editable + persists in BOTH create and edit.
- **(2) Add-size SKU LINEAGE (base + size suffix).** NEW shared helpers next to `variantGroupSlug` (STD-011 — one convention, manual + future scan/import): `skuSizeSuffix` (`"45 gal"→45G`, `"7 gal"→07G` matching FIXTURE-PS-07G, `4"→4IN`, `quart→QT`, `flat→FLAT`) and `deriveSiblingSku` (DISC-1001 + "45 gal" → **DISC-1001-45G**, WooCommerce parent+variation convention). "+ Add size" PRE-FILLS the sibling SKU from the size until the owner hand-edits (`skuTouched`); the **parent's SKU is left UNCHANGED** (may be referenced in QBO); **blank when the parent has no SKU** (D-9, never fabricate a base). An `existingSkus` guard BLOCKS a colliding SKU on create/edit — never a silent duplicate (a SKU identifies one sellable unit).
- **(3) Engine-level LEFT-PINNED row actions.** NEW `rowActions` prop on the SHARED `<DataSheet>` renders Edit/Add-size/Delete in a LEFT-PINNED column reserved right after the frozen identifier run (its own track + freeze-edge). Fixed in the ENGINE (STD-011), so inventory AND customers moved onto it; assets (no actions) unaffected. Actions stay reachable regardless of horizontal scroll.

**CONSTRAINTS HELD:** STD-011 (ONE shared SKU-suffix helper; engine-level pinning, not per-consumer) · STD-017 (SKU fix verified typed→persisted→read on the grid) · D-9 (no fabricated SKU when the parent has none) · AC-3 (business_id-scoped) · §6 r11 (12/12 api-fn). No pricing/tax/money logic touched.

**OWNER-PROVEN owed (David, live under RLS):** (1) edit a row's SKU → saves + shows on the grid (bug gone). (2) "+ Add size" on 'Sierra' Mexican Red Oak (DISC-1001) → sibling SKU pre-fills **DISC-1001-45G** (editable), parent DISC-1001 UNCHANGED, name + variant_group still inherit. (3) add-size on a NO-SKU parent → sibling SKU blank, not invented. (4) row actions (Edit / + Add size / Delete) visible at the LEFT next to the name without scrolling right — on inventory AND customers/assets. (5) both 'Sierra' sizes still pickable at checkout (D-46 grouping intact). `[TRACE:INVENTORY]` stays ON until owner-proven. **UNCOMMITTED — app-code-only, ready to commit (no migration gate).**

### 2026-07-14 — THUNDER COMPLETE INVENTORY CRUD (D-46 proposed): the manual-entry half — ONE `InventoryEditor` (create|edit, retires the flat Add form), from-the-row "+ Add size" that auto-groups the parent (size-picker fires by construction), group-aware rename, reference-aware soft/hard delete; NEW STD-018 (full entry surface); BUILDER-COMPLETE, owner-proof owed; ZERO migration, ZERO new api-fn (12/12)

**Type:** App code — 3 NEW (`packages/shared/src/inventory/variantGroup.ts` `variantGroupSlug` + barrel · `packages/cultivar-os/src/components/inventory/inventoryEdit.ts` insert/patch/rename/delete helper · `.../inventory/InventoryEditor.tsx` the ONE editor) + 2 EDIT (`pages/BusinessInventory.tsx` retire flat form + wire editor + row actions + group-aware inline rename + reorder_point column + 'archived' status + deploy-safe FULL→CORE load · `pages/InventoryCount.tsx` use the shared slug). **NO migration** (status has no CHECK → 'archived' is an AC-1 string value; reorder_point written deploy-window-safe as its D-42 migration is gated), **ZERO new `api/` file** (12/12 — all writes are client RLS insert/update/delete). `[TRACE:INVENTORY]` ON. `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 249→**248 ↓** / knip 10·14·15 == baseline); `build:cultivar` clean 2349 modules 8.0s. Decision **D-46 (proposed)** (`docs/decisions/2026-07-14-complete-inventory-crud-D46.md`). NEW **STD-018 (proposed)** (entry-completeness). Ledger row #126.

**WHY (entry-completeness, not a feature):** the recon found inventory CRUD ~65% — Create built THREE ways (Add-Item form / D-45 scan-promote / discovery CSV), **Update partial** (no clean per-size edit surface, no add-size affordance), **Delete essentially MISSING**. The platform-wide pattern: Create+Read got built everywhere, Update+Delete were skipped and rediscovered at use (David hit it needing to add a 45-gal size to his Vitex row). This closes inventory CRUD COMPLETELY.

**BUILT (D-46):**
- **ONE editor (STD-011, mirroring #119):** `InventoryEditor` mode `create|edit`, sections Identity · Size & grouping · Pricing · Stock · Notes. CREATE buffers → ONE insert (name + sell_price>0 required, D-35); EDIT auto-saves per field. The old flat Add-Item sheet is RETIRED. `BusinessInventory` gains per-row **Edit** / **+ Add size** / **Delete** actions.
- **Add-size FROM-THE-ROW (the Update gap):** "+ Add size" opens the editor seeded with the parent's name (inherited, read-only) + `variant_group`. If the parent's group is NULL it derives a slug from the name (`variantGroupSlug`) and **backfills the PARENT to that group on save** — so parent + new sibling share ONE group and `detectSizeCollision` fires by construction (never half-grouped). This is David's exact scar: his Vitex row's `variant_group` is null.
- **Group-aware rename:** renaming a variety that has size-siblings renames the WHOLE group (`renameVariety`) so the name-equality the picker needs (`resolveStockLine` L4) survives — chosen over block/warn.
- **Reference-aware DELETE:** both FKs (`order_items.business_inventory_id`, `cultivar_plants.inventory_id`) are `ON DELETE SET NULL`, so referenced → **SOFT** `status='archived'` (history/provenance intact); never-referenced → **HARD** delete. Confirm-first; `[TRACE:INVENTORY]` logs mode + ref counts.
- **Coexists with D-45 (shared slug):** `InventoryCount`'s local `slugify` was extracted to `packages/shared/src/inventory/variantGroup.ts` and BOTH paths now key `variant_group` through `variantGroupSlug(name)` — a scan-promoted row and a hand-added size of the same variety land in the SAME group (STD-011). `variantGroupSlug("Shoal Creek Vitex") === "shoal-creek-vitex" ===` the QR slug.

**CONSTRAINTS HELD:** STD-011 (ONE editor, ONE slug, ONE write helper `inventoryEdit.ts`) · STD-017 (grid + picker agree — both read `business_inventory`) · STD-013 (delete confirm + actor trace) · AC-1 (size/variant_group/status are DATA; shared resolver stays agnostic) · AC-3 (business_id-scoped) · D-9 (never fabricate a price/size). NEW **STD-018** proposed: a capability ships its FULL entry surface — C+R+U+D (+ scan/OCR/import as the workflow needs), Update & Delete enumerated at BUILD time not discovered at USE.

**OWNER-PROVEN owed (David, live under RLS):** (1) "+ Add size" on the existing Shoal Creek Vitex row → editor opens with name + variant_group inherited → enter "45 gal" + price → saves a SECOND Vitex row, same group, and the parent's null variant_group is now set. (2) Add an order → BOTH Vitex sizes are pickable at their prices (picker fires). (3) grid shows both sizes with their group. (4) Create a brand-new item via the editor → same form, empty → saves. (5) Edit any row's price/qty/size via the editor → persists, grid + picker reflect it. (6) delete a never-sold size → removed; delete a size WITH order history → archived, history intact, no FK breakage. (7) Add + Edit are visibly the SAME form. (8) Scan the Vitex QR (D-45 path) → the promote lands in the SAME variant_group the manual add-size used. `[TRACE:INVENTORY]` stays ON until owner-proven. **UNCOMMITTED — app-code-only, ready to commit (no migration gate).** **Follow-ups NAMED (not built):** (a) an `'archived'` row still resolves in the picker (`resolveStockLine` doesn't filter status) — making archived non-sellable is a shared-module change, deferred; (b) `serial_number`/`received_at`/`description` remain inline-only on the grid (deliberate, outside the editor's field set).

### 2026-07-13 — THUNDER INVENTORY DECREMENT-ON-PAID (D-42 proposed, the Amazon model): built the missing per-unit stock depletion — atomic RPC decrement at order-paid (submit.ts §11), status derives from qty, whole lifecycle coherent, oversell surfaced — replaces the whole-lot 'reserved' flip; BUILDER-COMPLETE, ONE additive migration GATED, owner-proof owed; ZERO new api-fn (12/12)

**Type:** App code — `api/orders/submit.ts` (resolve loop + §11 decrement + handleUpdate/handleDelete/handleStatus adjust) + ONE GATED additive migration `20260713_inventory_decrement_and_reorder.sql` (`reorder_point` stub column + `adjust_inventory_qty` RPC — David applies as postgres). **ZERO new `api/` file** (the RPC is a Postgres FUNCTION, NOT a Vercel serverless fn — does not count against the 12/12 ceiling; §6 r11). `[TRACE:INVENTORY]` ON. `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 249 / knip 10·14·15 == baseline); submit.ts esbuild bundles clean. Decision **D-42 (proposed)** (`docs/decisions/2026-07-13-inventory-decrement-on-paid-D42.md`). Ledger row #120.

**THE RECON VERDICT (settled, stated back at STEP 0):** a qty decrement NEVER existed. The order path only did a **coarse whole-lot status flip to `'reserved'`** at §11 (targeting `rl.plant.inventory_id` only) — under D-34 (the LOT is the SKU, qty is the COUNT) that marked all 45 of a 45-lot reserved when 1 sold, and the lot then vanished from the status-filtered dashboard `available_count` (`dashboard.ts:32-34`) → that vanishing is what *looked* like depletion. Real reconciliation (counted vs expected = last count − sold) REQUIRES real per-unit qty depletion.

**THE MODEL (David, the Amazon standard):** decrement `qty` at ORDER-PAID/CONFIRMED (checkout complete + invoice generated — the current §11 point), NOT at delivery. Delivery is a separate later event that does NOT touch qty (stock committed at payment). Mirrors Amazon: pay → inventory committed/decremented → ships → arrives.

**BUILT:**
- **ONE atomic RPC** `public.adjust_inventory_qty(p_lot_id, p_business_id, p_delta)` (in the gated migration) — a **single guarded UPDATE** (`WHERE … AND qty + p_delta >= 0`), so it is **concurrency-safe** (row-level lock is implicit — two concurrent orders on one lot serialize; no JS read-modify-write that races and loses a unit) and can NEVER drive qty negative (that's the oversell guard). **Status DERIVES from the new qty** inside the RPC: `qty>0 → 'available'`, `qty<=0 → 'depleted'` (the existing datasheet vocabulary — NOT a new `sold_out` synonym, STD-011); a manual `'damaged'`/`'returned'` classification is PRESERVED (only sale-relevant statuses auto-toggle). `SECURITY DEFINER` / `search_path=''` / **EXECUTE granted to `service_role` ONLY** (the RPC trusts its `p_business_id` arg → server-only; granting to `authenticated` would let any user mutate another tenant's stock — AC-3). Returns `{new_qty, new_status, applied, reason}` for `[TRACE:INVENTORY]` + oversell surfacing.
- **§11 (create/paid) — DECREMENT, not reserve:** the whole-lot `'reserved'` flip loop is replaced by a per-unit atomic decrement (`−rl.quantity`) targeting the **RECONCILED anchor** `rl.stockLineId ?? rl.plant.inventory_id` (was `rl.plant.inventory_id`-only → could silently no-op on a stock-line line carrying `stockLineId` without `inventory_id`; now matches the line's write-anchor, submit.ts:575).
- **Whole lifecycle coherent through the SAME signed-delta RPC** (couldn't leave the other paths status-flipping — that would silently lose stock and break the reconciliation this build enables): **`handleUpdate`** adjusts each lot by `+(oldQty − newQty)` (reduce/remove restores, increase decrements further), summed per lot; **`handleDelete`** restores `+quantity` per lot (guarded — a `'cancelled'` order already restored, don't double-restore); **`handleStatus` cancel** restores `+quantity` on the transition INTO cancelled (un-cancel does NOT auto-re-decrement — R-STATUS preserved). Old `setLotStatus` whole-lot-flip helper REMOVED (fully unused).
- **OVERSELL surfaced, never silent (D-9):** a **pre-flight** check in the resolve loop (reads the lot's `qty` alongside `status`) refuses the WHOLE order with **`INSUFFICIENT_STOCK`** 400 before any write when a line exceeds on-hand; the §11 RPC guard is the authoritative backstop for the rare concurrent-depletion race (`[TRACE:INVENTORY] OVERSELL REFUSED`, never a negative qty).
- **`reorder_point int` stub** (nullable, additive) — the SLOT for the NEXT build (reorder/low-stock threshold), no threshold logic this pass; homed now so the decrement build + reorder build share the schema.

**DEPLOY-WINDOW SAFE:** `adjustLotQty` degrades gracefully if the RPC isn't applied yet (missing-function `PGRST202`/`42883` → logs "decrement deferred (migration pending)", non-fatal → checkout still completes). Deploy code FIRST, then David applies the migration.

**CONSTRAINTS HELD:** STD-011 (qty = the ONE canonical on-hand fact; status derives) · STD-012 (server-authoritative, atomic — one computation) · AC-3 (RPC business_id-scoped, service_role-only EXECUTE) · D-34 (lot=SKU) · §6 r11 (Postgres RPC ≠ Vercel fn, 12/12 held). Money/pricing/tax logic UNTOUCHED (this is stock-count only).

**OWNER-PROVEN owed (David, after applying `20260713_inventory_decrement_and_reorder.sql` as postgres + catalog-verify (A)-(E)):** **(1)** note a multi-count lot's qty (Vitex 45) → place a PAID order for 3 → qty 45→42 (per-unit, the raw qty column on `/inventory` actually moves). **(2)** dashboard `available_count` drops by 3, not 45. **(3)** sell a lot to 0 → status flips `depleted`, drops off the sellable list. **(4)** two near-concurrent orders on the same lot → no lost unit (atomic). **(5)** schedule the delivery for that order → qty does NOT change again (delivery ≠ decrement). **(6)** order more than available → refused (`INSUFFICIENT_STOCK`), qty not driven negative. Also: delete/cancel an order → stock restored; edit qty down → stock returns. `[TRACE:INVENTORY]` stays ON until owner-proven. **UNBLOCKS reconciliation** (4.2 — counted vs expected = last count − sold; was gated on real depletion). **NEXT build:** reorder-threshold on the `reorder_point` stub. **Code committed + pushed `3de3b84`; the migration `20260713_inventory_decrement_and_reorder.sql` is still GATED — David applies as postgres, then catalog-verifies (A)-(E).**

### 2026-07-13 — THUNDER STD-011 UI unification: Add + Edit customer render the SAME `CustomerPartyEditor` (create + edit modes); the old flat Add form RETIRED — implements D-41 + STD-011, NO new decision; BUILDER-COMPLETE, owner-proof owed; NO migration, ZERO new api-fn (12/12)

**Type:** App code — `customerEdit.ts` (new shared `insertCustomer`, BENCH-C-masked) + `CustomerPartyEditor.tsx` (new `mode:'create'|'edit'`) + `Customers.tsx` (retire the old flat Add form; unified `editor` state) + `CustomerFields.tsx` (drop the now-dead `EMPTY_CUSTOMER_FORM`). **NO migration** (D-41 cols exist), **NO new `api/` file** (create rides a client owner-RLS insert; 12/12). `[TRACE:customers]` ON (masked). `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 249 / knip 10·14·15 == baseline); `build:cultivar` clean 6.9s. Implements **D-41 + STD-011** (no new decision). Ledger row #119.

**THE VIOLATION (STD-011 on a UI surface):** "Add Customer" was the OLD flat 8-field form (`CustomerFields` + a direct `handleSubmit` insert in `Customers.tsx`) while "Edit customer" was the NEW grouped `CustomerPartyEditor` (15 fields, D-41). Two canonical representations of ONE entity — a field added to one drifts from the other.

**FIX (ONE entity, ONE form):** `CustomerPartyEditor` gained **`mode: 'create' | 'edit'`**. **CREATE** starts empty, buffers all fields locally, and does ONE **INSERT** on a "Save Customer" button (new shared `insertCustomer` in `customerEdit.ts` — owner-only RLS, `tax_id`/`credit_limit` VALUE-MASKED via the same `SENSITIVE_CUSTOMER_FIELDS` source, STD-011). **EDIT** is unchanged (per-field auto-save). **The ONLY differences are title / empty-vs-populated / insert-vs-update — everything else is the identical component.** Required-first_name + exempt-requires-reason validation apply in BOTH modes. The **old flat Add form is RETIRED** (`handleSubmit`/`set`/`showForm`/the Add sheet deleted; dead `EMPTY_CUSTOMER_FORM` removed). The roster's "+ Add Customer" opens create; name/tax/Edit open edit (unified `editor` state).

**NO-REGRESSION BRIDGE (surfaced, then handled):** the OLD Add wrote the legacy unprefixed `address_*` — which checkout/delivery/order-detail READ today — while the grouped editor writes `billing_*` (D-41 follow-up (b) territory, nothing consumes it yet). Switching Add straight onto the grouped editor would have left manually-added customers with an empty consumed address at checkout. FIX: the shared editor now **mirrors Billing → the legacy `address_*` on save (both create and edit)**, keeping the consumed field populated (and fixing the latent D-41 edit-address gap) until follow-up (b) repoints readers to `billing_*` and drops the mirror.

**SCOPE HELD:** `CustomerFields` + `CustomerEditModal` (the delivery-card in-context quick edit) LEFT as the deliberate lightweight contextual subset (still reuses the shared `customerEdit` rules — no drift of the dangerous kind). **Flagged for David:** it's technically a third customer surface; a future unify (delivery card opens the grouped editor) is optional, not done here.

**OWNER-PROVEN owed (David, live under RLS):** (1) "+ Add Customer" → the grouped editor opens EMPTY with all sections, identical layout to Edit. (2) fill + Save → inserts → appears in roster. (3) edit an existing customer → SAME form, populated. (4) Add and Edit are visibly the SAME form. (5) setting exempt in EITHER mode requires a reason; `tax_id`/`credit_limit` log "changed" (masked). (6) a manually-added customer's billing address also lands in the consumed `address_*` (shows at checkout). **UNCOMMITTED — app-code-only, ready to commit (no migration gate).**

### 2026-07-13 — THUNDER CUSTOMER / PARTY RECORD → standard entity-completeness (D-41 proposed): ONE additive migration brings `customers` to the complete standard party record + a grouped `CustomerPartyEditor`, so fields stop being added reactively — ALSO closes the D-40 tax owner-prove blocker (exemption now UI-editable); BUILDER-COMPLETE, migration GATED, owner-proof owed; ZERO new api-fn (12/12)

**Type:** App code — `customerEdit.ts` (extend the text-field union + BENCH-C masking + new `persistCustomerPatch`) + NEW `CustomerPartyEditor.tsx` (grouped editor) + `Customers.tsx` (lean roster + open editor) + `CustomerEditModal.tsx` (2-line index-cast fix from the widened union) + ONE GATED migration `20260713_customers_party_record.sql` (David applies as postgres — schema-verification gate OWED, verify (A)-(F) embedded). **NO new `api/` file** (12/12). `[TRACE:customers]` ON. `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 249 / knip 10·14·15 == baseline); `build:cultivar` clean 7.1s. Decision **D-41 (proposed)** (`docs/decisions/2026-07-13-customer-party-record.md`, confirm the DECISIONS.md head then assign). Ledger row #118.

**WHY (entity-completeness, not a feature):** `customers` had been growing REACTIVELY — one column at a time each time a build hit a wall (`customer_type` 20260702, the `tax_exempt` trio D-40). This pass brings it to the complete industry-standard party/customer record in ONE migration so fields stop being bolted on. It also closes the D-40 owner-prove blocker: with `tax_id`+`tax_exempt_expires` present and a grouped editor built, the tax-exemption set is now UI-editable (was SQL-only).

**MIGRATION (gated, additive, ZERO destruction) — 15 cols:** identity `organization_name`/`display_name`; **billing** `billing_line1/line2/city/state/zip`; tax `tax_id`/`tax_exempt_expires`/`tax_exempt_cert_doc_url` (STD-010 ingest SLOT — no upload built); terms `payment_terms`/`credit_limit`; lifecycle `status` (NOT NULL DEFAULT 'active') / `updated_at` (NOT NULL DEFAULT now() + trigger reusing the **canonical `set_updated_at_generic()`** — STD-011) / `notes`. Existing unprefixed `address_line1/*` LEFT UNTOUCHED.

**ADDRESS MODEL (approved L1):** BILLING = columns on the customer. **SHIPPING is NOT a customer attribute** — a customer does not "have a shipping address"; an ORDER does. Ship-to is entered per-order and snapshotted onto the `deliveries` row (already carries its own address_*, 20260620). NO `shipping_*` on customers. The saved multi-site ship-to address book (`customer_addresses`) is the **deferred L2 hook** (L1→L2 additive).

**STANDARDS:** AC-1 (`payment_terms`/`status` are string VALUES, NO CHECK — mirrors customer_type/price_tier) · RLS inherits (`customers_business_owner` + `customers_member`) — NO new policy (AC-3, D-40 precedent) · **STD-011** (canonical updated-at fn; ONE PII-masking source) · **STD-014** (status/updated_at defaults are universal, not fabricated per-tenant values) · **BENCH-C (PII, David's go)** — `tax_id`/`credit_limit` VALUE-MASKED in `[TRACE:customers]` (log "changed", never the EIN/figure). BENCH-G (immutable exemption-history audit) NOT triggered by current-state columns — remains the named future hardening.

**UI:** the ~18-field set moved OFF the hand-declared grid into a NEW grouped `CustomerPartyEditor` modal (Identity · Contact · Billing · Tax · Commercial terms · Status), opened per-row from the roster (name click or Edit button); auto-save (shared coerce/persist, no drift). Tax section: exempt toggle reveals reason/cert/expiry and **cannot save exempt without a reason** (mirrors D-40's server refusal) + a disabled "Attach cert doc (coming soon)" STD-010 slot. The **roster is now LEAN** — name/type/tier/tax badge/status/Edit. Deploy-window-safe load (FULL→CORE fallback on 42703/PGRST204).

**OWNER-PROVEN owed (David):** **(0)** apply `20260713_customers_party_record.sql` as postgres + catalog-verify (A)-(F). **(1)** open a customer (name/Edit) → the grouped editor shows all sections; edit + save persists (Identity/Contact/Billing/Terms/Status). **(2)** tax: toggle exempt OFF → reason/cert/expiry hide; ON → they appear, saving exempt with a blank reason is BLOCKED; save persists `tax_id` + exemption. **(3)** mark **john smith** exempt via the UI (not SQL) → an order for him renders "Tax exempt — [reason] · cert" (= the D-40 tax owner-prove, now UI-driven). **(4)** roster shows the lean set. **(5)** `[TRACE:customers]` on save shows `tax_id`/`credit_limit` as "changed" (masked), other fields normal. **(6)** status=inactive soft-deactivates. **UNCOMMITTED — David applies the gated migration, then commits.** **Follow-ups NAMED (not built):** (a) org-name backfill out of first_name; (b) unprefixed address_* → billing cleanup; (c) cert-doc ingest via STD-010; (d) L2 `customer_addresses` ship-to address book.

### 2026-07-13 — THUNDER D-40 TAX AS A SPINE CAPABILITY (Level 1): per-tenant rate (redlined when unset) + taxability on the D-39 line-kind seam + party exemption (customers) + per-order override (orders) + gated/logged apply_tax_exempt/apply_discount — BUILDER-COMPLETE, TWO migrations gated, owner-proof owed; ZERO new api-fn (12/12)

**Type:** App code — spine `tierPricing.ts` + new shared `taxExemption.ts` + `actionPermissions.ts`/`roles.ts` (perms) + `submit.ts` (create + `handleUpdate` fold) + `useSubmitOrder.ts` + `CartReview.tsx` + `Confirmation.tsx` + email `cultivar.ts` + QBO `invoice/cultivar.ts` + `Settings.tsx` (rate capture) + `Customers.tsx` (exemption editor) + `ScanOrder.tsx`/`CustomerCapture.tsx`/`types/customer.ts` (carry exemption) + `constants.ts` (kill `TAX_RATE`). **TWO GATED migrations** `20260713_customers_tax_exemption.sql` + `20260713_orders_tax_exemption.sql` (additive nullable — David applies as postgres, catalog-verify). **NO new `api/` file** (12/12 — rides submit + config accessors + Settings/customers writes). `[TRACE:TAX]` ON. `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 249 / knip 10·14·15 == baseline); `build:cultivar` clean (2344 modules); submit + QBO esbuild OK; **tierPricing tests 84/84** (+25). Decision **D-40** (`docs/decisions/2026-07-13-tax-as-spine-capability-D40.md`, graduated from the DRAFT). Register **T1–T3 CLEARED**. Ledger row #117.

**WHAT (builds the approved D-40 — extends D-37 money boundary; tax is a CHARGE computation, still never payment processing):**
- **SPINE (`tierPricing.ts`):** `computeOrderPricing(lines, tier, taxRate: number|null, exemption?)` → new outputs `taxStatus` (`not_identified`|`taxed`|`exempt`) + `taxExemptReason`/`taxExemptCertRef`. Per-line **`taxable?`** rides the **D-39 goods/service line-kind seam** (default undefined = TRUE for every line = today's behavior → **no silent total shift**; AC-4 — discount AND tax read the seam). **`taxableSubtotal = Σ netTotal WHERE line.taxable`**. **Rounding STATED once:** `tax = round2(taxableSubtotal × rate)`. New **`resolveTaxRate(config)` seam** — Level-1 returns `config.taxRate` (absent → null = "not identified"); the ONE place Level-2 address/jurisdiction/tax-API attaches (`_order` param reserved; the per-line `taxable` flag is the sibling hook). State logic: valid exemption (exempt **AND** a recorded reason) → exempt tax 0 (no silent removal); else rate null → not_identified tax 0; else taxed.
- **NEW `taxExemption.ts`:** reason codes (`resale`/`nonprofit`/`government`/`agricultural`/`other` — `other` needs free text; AC-1 string values) + **`describeTaxLine`** (the ONE three-state presenter used by Review/Confirmation/email — consistent wording) + `TX_COMPTROLLER_RATE_LOCATOR_URL`.
- **PERMISSIONS (matched pair):** `apply_tax_exempt` + `apply_discount` in `actionPermissions.ts` (default OWNER+MANAGER, STAFF none) + cultivar `roles.ts`. A legal exemption (cert) and a commercial discount are delegated/audited separately.
- **REPOINT (kill every literal):** submit **create** reads `resolveTaxRate` (not `businesses.tax_rate`; `TAX_RATE_FALLBACK` deleted) + reads the customer's PERSISTENT exemption (`select('*')`, deploy-safe) + honors a per-order OVERRIDE **ONLY** on a token-verified owner/manager+`apply_tax_exempt` path (anon/staff IGNORED, `[TRACE:TAX]` logs the refusal — tamper defense) + persists `orders.tax_exempt_*` (deploy-window-safe insert-retry) + returns `taxStatus`; submit **`handleUpdate`** off-seam `subtotal × rate` **FOLDED back through `computeOrderPricing`** (closes the #107/#114 roster-edit drift; re-applies the order's persisted exemption so an exempt order stays exempt across edits). CartReview / Confirmation / QBO / email all render the three states from ONE output; the hardcoded email **`Tax (8.25%)` DIES**; `constants.ts TAX_RATE` retired; QBO derives % from amount/subtotal + renders a `$0` exempt line.
- **CAPTURE:** Settings rate → `config.taxRate` via `mergePricingConfig` (**stops the blank→0.0825 coercion** — blank = unset = redline) + TX Comptroller locator helper link; `/customers` per-row **exemption editor** (reason REQUIRED to mark exempt; carried on `CustomerInput` for the Review preview via ScanOrder/CustomerCapture, both deploy-window-safe reads); CartReview **per-order exemption override** (reason REQUIRED).

**CONSTRAINTS HELD:** AC-1 (rate = per-tenant data; reason codes = string values; every 8.25%/0.0825 literal dies) · AC-3 (exemption business-scoped on `customers`; anon can never self-exempt) · **AC-4 (ONE computation, ONE line-kind seam read by discount AND tax, ONE tax state emitted, every surface renders it)** · D-9 (unset rate = LOUD redline, exempt = requires reason — never a silent $0/removal) · server-authoritative + tamper-defended unchanged · 12/12 api-fn. **Level 2 DEFERRED but HOOKED** at `resolveTaxRate` + `taxable` (no jurisdiction logic built).

**OWNER-PROVEN owed (David):** **(0)** apply both `20260713_*` migrations as postgres + catalog-verify (A)-(D) each. **(1)** a tenant with NO rate set → Review/Confirmation/QBO/email all show **"⚠ Tax: not identified"**, total "(tax not included)", NO fabricated 8.25%. **(2)** set the rate in Settings (Comptroller helper visible) → taxes at that rate on the discounted taxable subtotal; all four surfaces agree to the penny. **(3)** mark a `/customers` customer tax-exempt (reason agricultural + cert — reason REQUIRED to save) → their order shows **"Tax exempt — Agricultural exemption · cert …  $0.00"** on all surfaces. **(4)** per-order override at Review (reason required) → exempt this order, actor logged in `orders.tax_exempt_by`. **(5)** a STAFF/anon exemption attempt → server refuses, `[TRACE:TAX]` logs it, tax charged. **(6)** roster-edit an order → tax matches `computeOrderPricing` (no off-seam drift); an exempt order stays exempt. `[TRACE:TAX]` stays ON until owner-proven. **UNCOMMITTED — David applies the two gated migrations, then commits.** **⚠️ GOTCHA (binding):** the Level-1 rate is the per-tenant ORIGIN rate (TX is origin-based for in-state sellers — one rate at the seller's location is LEGALLY CORRECT, not a simplification). Do NOT add customer-address / destination-jurisdiction resolution to the in-state path — that's destination-based, WRONG for in-state TX sales, and is Level-2 ONLY (it attaches at the `resolveTaxRate(config, _order)` seam + the per-line `taxable` flag; the platform NEVER computes a jurisdiction rate — the owner enters theirs via the Comptroller locator). **Follow-up NAMED (not built):** (a) immutable compliance-record row for exemption audit at volume; (b) sibling notification templates threading tax state; (c) Level-2 tax-API at the `resolveTaxRate` seam.

### 2026-07-13 — THUNDER AC-1 FIX: shared cultivar NOTIFICATION TEMPLATES were tenant-hardcoded (LAWNS) on a customer-facing surface → genericized to active-business token (omit-not-fake); DEPLOYED, owner-proof owed; ZERO schema/migration/api-fn

**Type:** App code — 5 files (`packages/shared/src/notifications/types.ts` + `.../index.ts` + `.../templates/cultivar.ts` + `packages/cultivar-os/src/hooks/useSubmitOrder.ts` + `pages/CartReview.tsx`). **NO schema, NO migration, NO new `api/` file** (12/12). `[TRACE:*]` untouched (unchanged). `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 249 / knip 10·14·15); build:cultivar clean 7.4s. Register **H12–H17** CLEARED. Ledger row #116.

**THE DEFECT (AC-1, customer-facing):** an order-confirmation email for active business "Test Dave's Tree Nest" (f7ec5d67…) rendered subject **"Your LAWNS Tree Farm order is confirmed"**. RECON verdict (prior session): classification (a) HARDCODE — the shared `packages/shared/src/notifications/templates/cultivar.ts` was fully LAWNS-hardcoded (`BASE` chrome consts logoText/footerName/footerAddress + order_confirmation subject/body/text + netting_waiver + delivery_scheduled + care_tips_30d + seasonal_offer + phone `(512) 450-3336` throughout). **NOT** a cross-tenant DB read (no AC-3 leak) — a static literal in a SHARED module (AC-1). The #97 checkout sweep (register H1–H8) cleared UI surfaces but never scoped the email/SMS templates → this whole file was missed.

**FIX (whole-file genericization):** NEW `NotifyBusiness` token in `notifications/types.ts` (name/address/phone/email, exported from the barrel); a `chrome(d.business)` helper replaces the `BASE` const (per-tenant header logo + footer from the active business); `business?: NotifyBusiness` added to all 5 customer-facing template data interfaces; EVERY LAWNS/phone/address literal replaced with `d.business?.*` tokens. **OMIT-NOT-FAKE (D-9):** a missing field renders NOTHING (the phone line / reschedule clause render only when `d.business?.phone` is set; an absent business name → base.ts platform default, never a wrong tenant — the exact defect being fixed). **Caller:** `useSubmitOrder` gained `business` on `SubmitPayload` + threads it into the order_confirmation `data`; `CartReview` passes the active `useBusinessContext().business` identity (business_id-scoped — AC-3) — the same pattern that cleared H2/H3/H4. `send.ts`/`queue.ts` UNCHANGED (they forward `payload.data` to the template fns — no name resolution belongs in the transport). `owner_leakage_alert` (internal owner SMS) + `silent_partner_analysis` (deliberately TRACE-branded, sent by the platform) carry no tenant literal → untouched. **grep LAWNS/phone/address in cultivar.ts = 0.**

**CONSTRAINTS HELD:** AC-1 (this IS the correction — no tenant literal remains in the shared module) · AC-3 (business identity resolved from the active business_id-scoped context only, never another business's row) · omit-not-fake. Scope discipline: cultivar notification templates + the one caller only — did NOT touch pricing/discount, the submit write path (#115), or other verticals' templates.

**OWNER-PROVEN owed (David, live on main → Vercel READY):** submit an order as **Test Dave's Tree Nest** → the confirmation email subject reads **"Your Test Dave's Tree Nest order is confirmed — CLV-…"**, NOT LAWNS; body + SMS + footer chrome show Test Dave's Tree Nest identity (or omit cleanly if a field is unset), NO "LAWNS" anywhere; a reminder / delivery_scheduled notification likewise renders the active business. (Optional data-side: `businesses.name` for f7ec5d67 = "Test Dave's Tree Nest"; order/customer rows hold no LAWNS field — confirms the string was purely the code literal.)

### 2026-07-13 — THUNDER FIX: `order_service_selections.is_manual_override` NOT-NULL 500 on a service PRICE OVERRIDE — pre-existing latent bug (NOT a D-39 regression); DEPLOYED, owner-proof owed; ZERO migration/api-fn

**Type:** App code — ONE file (`api/orders/submit.ts`). **NO schema, NO migration** (the column already has the needed default), **NO new `api/` file** (12/12). `[TRACE:LEAKAGE]` extended (per-row `is_manual_override` on the write), ON. `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 249 / knip 10·14·15); build:cultivar clean (7.2s); submit esbuild OK. Ledger row #115.

**THE FAILURE (live 500, hard-blocked the money-bar owner-prove):** submit returned 500 on any order carrying a manual service price override (Placement $2025→$1000): Postgres `null value in column "is_manual_override" of relation "order_service_selections" violates not-null constraint`. Both pay-online and pay-at-office hit the same `/api/orders/submit`.

**ROOT CAUSE (recon + `git blame`):** `overrideCols` ([submit.ts:367-370](packages/cultivar-os/api/orders/submit.ts#L367-L370)) set `is_manual_override` ONLY on the overridden row and returned `{}` for the others. `order_service_selections` is inserted as a BATCH; **PostgREST unions the column set across the batch**, so once ANY row carries `is_manual_override`, the rows that omit it are inserted with an explicit **NULL** — the column's `DEFAULT false` (migration 20260708) only applies when the column is absent from the WHOLE batch. So a pure non-override order omitted it on every row → default applied → OK (Friday's proven order); an order with ONE override injected the column → the non-override rows NULL-violated → 500. **NOT a D-39 regression** — this region was last touched by `1c13d46` (2026-07-08 leakage build); D-39 (`8f53698`) never touched `order_service_selections`/`overrideCols`. It surfaced now only because the 20260708 migration is applied AND a service override was exercised for the first time. **D-39's owner-prove status (#114) stays honest — unaffected.**

**FIX:** `overrideCols` returns `{ is_manual_override: false }` for non-override rows — truthful per-row (true on the overridden line, false on the others) AND every batch row now carries the key, so PostgREST can't NULL-violate. The column already has `DEFAULT false` → **no migration needed**. Discount/pricing logic UNTOUCHED (write-constraint fix only). New `[TRACE:LEAKAGE]` logs the per-row `is_manual_override` + override count on the write. `order_items` is unaffected (its insert never spreads the override cols → column absent from that batch → default applies). Deploy-window fallback (strip-and-retry on 42703/PGRST204) preserved.

**OWNER-PROVEN owed (David, live on main → Vercel READY):** re-run the order that 500'd — Vitex ×4, Oak ×5, Delivery, Placement Service WITH the $2025→$1000 override → **submit returns 200** (no constraint violation), order completes, Confirmation + QBO generate; the `order_service_selections` rows show Placement `is_manual_override=true`, others `false` (Supabase or the `[TRACE:LEAKAGE]` line). This UN-BLOCKS the #114 money-bar owner-prove. **Separate note for David (NOT fixed here):** on the failed run Review also showed retail + old "tier applies at checkout" copy on the customer-SEARCH attach path (invokedTier null) — re-observe the discount after submit is un-blocked; if still missing on the search-attach path, that's the next prompt (E1 display may not be taking on that path).

### 2026-07-13 — THUNDER D-39 Review-surface FIX: tier resolves authoritatively on Review + show-the-work grouped display on both surfaces — closes money-bar MUST-FIX #1 (Review computation miss) + #2 (show-the-work); DEPLOYED, owner-proof owed; ZERO schema/migration/api-fn

**Type:** App code — 7 files (`types/customer.ts` · `pages/ScanOrder.tsx` · `pages/CustomerCapture.tsx` · `pages/CartReview.tsx` · `pages/Confirmation.tsx` · `api/orders/submit.ts` · `hooks/useSubmitOrder.ts`). **NO schema, NO migration, NO new `api/` file** (12/12 held — E2 rides the EXISTING submit response). `[TRACE:PRICE]` ON (Review render path + submit + CustomerCapture tier-lookup). `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 249 / knip 10·14·15 == baseline); build:cultivar clean (7.3s); submit esbuild OK; tierPricing tests **59/59**. Implements D-39 (no new decision) + §6 r16 industry-standard basis. Spec: `docs/specs/discount-show-the-work-presentation.md` (BUILT). Ledger row #114.

**MUST-FIX #1 (RESOLVED) — Review computation miss.** The #113 owner-prove FAILED on Review: it showed **$1,646.48** (discount NOT applied — tax on the full $1,521) while QBO/submit were correct at **$1,495.37**. ROOT CAUSE (recon, `file:line`): `CartReview` calls `computeOrderPricing` but fed it `resolvedTier = orderTier ?? RETAIL_FLOOR`, and the `orderTier` client snapshot is **null** whenever the customer is entered at the CustomerCapture step — `orderTier` is written ONLY by ScanOrder's `attachCustomer`, cleared by `setItem`, and races the async config load. submit was unaffected (re-resolves the tier SERVER-SIDE from `customers.price_tier`). **FIX E1:** Review now resolves the tier the SAME way submit does — `invokedTier ?? customer.price_tier` against the fetched config (`readPricingConfig`+`resolveTier`), NOT the snapshot. The customer's `price_tier` is carried on the client (`CustomerInput.price_tier`), set by ScanOrder attach (`customerToInput`) OR a **business-scoped email lookup in CustomerCapture** (mirrors submit's dedup identity→tier); `orderTier` remains a fast-path only while config loads. Kills all three null-triggers. submit stays the tamper-defended final authority, unchanged.

**MUST-FIX #2 (RESOLVED) — show-the-work grouped display, both surfaces.** **FIX E2:** submit RETURNS its authoritative per-line breakdown (`pricing.lines` + goodsRetailSubtotal + discountTotal + discountLabel) in the EXISTING `res.json` (no new endpoint); `useSubmitOrder` threads it (`OrderBreakdown`); **Confirmation renders THAT** (not the Review client preview) → receipt === QBO by construction. Grouped-only display on Review AND Confirmation (§6 r16 standard): goods at FULL retail → ONE labeled discount line on the goods subtotal (`<tier> — N% off −$X`) → goods-after → SERVICES "· not discounted" → discounted subtotal → tax → total. Discount scaffolding renders only when discountTotal>0 (retail customer stays clean). Removed the per-line discount sub-note (grouped-only, David's call).

**CONSTRAINTS HELD:** AC-1 (generic goods/service line kinds) · AC-3 (business-scoped reads) · **AC-4 (one authoritative tier resolution, both surfaces)** · server-authoritative + tamper-defended UNCHANGED · stale-client-BASE seam out of scope (separate). **Out of scope (carried):** `submit.ts handleUpdate` (roster edit) still baseline-only, not tier/basis-aware (from #107).

**OWNER-PROVEN owed (David, live on main → Vercel READY):** re-run the contractor order (Vitex 3×$124, Live Oak 30gal 8×$128, Delivery $125, tier Contractor 1·10%), **entering the customer at CustomerCapture** (the broken path) → Review shows retail lines → "Contractor tier 1 — 10% off −$139.60" → goods after $1,256.40 → Delivery $125 (no discount) → subtotal $1,381.40 → tax $113.97 → **total $1,495.37**; **Review === Confirmation === QBO** (the $1,646.48 is gone); a retail customer sees no discount line; deselect a service → recomputes, discount still only on goods. `[TRACE:PRICE]` stays ON until owner-proven.

> Session history dated **2026-07-10 and older** (and all earlier arcs) is archived at [docs/handoff-archive.md](docs/handoff-archive.md) — NOT loaded at session start. CLAUDE.md §3 retains only the most-recent date-block as current state; trim older entries here to the archive each session (see the CONTEXT BUDGET CHECK, §top). Canonical "is X closed / owner-proof owed" state lives in `docs/CLOSE-OUT-LEDGER.md`, `docs/DECISIONS-INDEX.md`, and `docs/built-inventory.md`.

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
8. **Semantic-dup check (binding, before writing logic):** before writing a new operation, check whether the same OPERATION already exists elsewhere — **even if the code differs**. Same intent in 2+ places → extract ONE shared function (rule of three). Report consolidations in the handoff. This catches drifted-equivalent logic that literal-duplication scripts miss — e.g. the 3 phone writers (`normalizePhone`, 2026-06-24) each trimmed inline differently until consolidated. ESLint/knip cannot see this class; only a human/AI semantic read can.
9. **Quality gate (binding):** every build runs `npm run verify` (tsc + eslint + knip + verify-universals, baseline-and-ratchet against `quality-baseline.json`). **BUILDER-COMPLETE = `npm run verify` passes with ZERO NET-NEW violations.** Baseline numbers are debt — they shrink, never grow. When you fix violations and a metric drops, run `npm run quality:baseline` and commit the smaller numbers to lock the win. The gate fails on net-new only; it does NOT block on pre-existing baseline debt. (Tooling: `eslint.config.mjs`, `knip.json`, `scripts/quality-gate.mjs`. Scope is bug-classes only — dead code, unused vars, floating/misused promises, stale-closure deps; NOT style. Knip dead-code detection covers the maintained app surface — cultivar-os/trace-app; `shared` is treated as an all-entry deep-import library and `ignition-os` is frozen donor code, both out of knip scope.)
10. **Standard-by-value rule (binding):** Default to the established/industry-standard pattern WHEN it earns its value for our scope — i.e. it catches a bug class we actually hit, or enables a capability our scope actually needs, at a cost proportional to that value. Examples of standards we ADOPTED on value: three-entity identity (Person/Org/Membership), tenant-scoped RLS, ESLint + dead-code gates (caught real bugs this build). Examples we SKIPPED on value-for-scope (documented): full WCAG/508 for a known able user base, jscpd literal-duplication, Prettier retrofit, npm-audit-as-gate, 100% test coverage.

   Diverge in EITHER direction only by explicit, recorded decision:
   - Diverging BELOW the standard (doing less than the textbook) → record what standard, why the lighter form suffices, the cost accepted, and the trigger to converge back.
   - Diverging ABOVE the need (adopting a standard our scope doesn't justify) → equally a divergence; "it's the standard" is NEVER sufficient justification on its own. Value-for-our-scope is.

   Thunder must flag BOTH cases proactively:
   - "This differs from the known-correct/standard pattern" (so we don't drift silently into debt).
   - "This standard may not be worth it for our scope" (so we don't waste work doing things by the book that buy us nothing — the over-engineering trap).

   No silent divergence. No standard adopted purely for its own sake. No "fix it later" without a written decision. When Thunder finds itself building something that differs from the standard, it stops and surfaces the divergence for an explicit call rather than shipping the expedient version unremarked.

11. **FUNCTION THRIFT — the Vercel Hobby 12-function ceiling (binding, STOP-and-surface):** the deployed backend is the repo-root `api/` directory (per §2 "api/ at repo root" — 12 shim files re-exporting `packages/cultivar-os/api/*`), and Vercel Hobby caps a deployment at **12 serverless functions**. We are at **12 of 12 — zero headroom.** A 13th function does NOT error loudly; it makes the whole deploy **fail silently** and Vercel keeps serving the last-good bundle (this bit us on 2026-06-20 — the deliveries endpoint was function #13, so every deploy silently failed and prod served stale code until `api/deliveries/create` was folded into `api/customers/create`). Therefore:
    - **Reuse-before-mint:** any new keyed/server-side work MUST ride an existing endpoint before a new `api/` function is created. The established consolidation seams: `receipts/ocr.ts` `shape` param (ANY image→AI operation), `discovery/ingest.ts` `action=` branches (identity/analysis/compare/populate/cost-apply/seed), `customers/create.ts` optional `delivery` block, `qbo-connector.ts` `?_route=` (auth-url/callback/status). Add a branch/param to one of these, don't add a file.
    - **Minting function #13 is a STOP-AND-SURFACE event, never silent:** if a build genuinely cannot ride an existing endpoint, Thunder HALTS and surfaces it to David as an explicit decision — **reuse / consolidate an existing pair / upgrade to Vercel Pro** — with the current slot count. Never silently create `api/` file #13 (= silent deploy failure at the ceiling).
    - Evidence (12/12 slot inventory + what consumes each, tied to capability 3.5): **`docs/decisions/2026-06-20-vercel-function-ceiling-mitigation.md`**; tracked as tech-debt #41.

12. **GREEN MEANS NO-KNOWN-DEBT — hardcoded debt caps a tile at amber (binding).** A hardcoded tenant/vertical/business literal that should be data (name, address, price, phone, tier/category label, stub/demo surface — an AC-1 leak) is logged in **`docs/decisions/HARDCODED-REGISTER.md`**, tagged by its OWNING CAPABILITY. **A capability with ANY OPEN register item is CAPPED AT AMBER on the status board — it cannot render green until every one of its items is CLEARED (fixed → reads from data) or DOCUMENTED-WITH-REASON (a generic platform default / demo-only surface, kept deliberately).** So **🟢 = done AND no open hardcoded debt**; a tile carrying register items shows 🟡 + its debt count until cleared. When you touch a surface that owns a register item, fix it in that pass (§1.6 gate item 2). This gives the anti-hardcoding rule teeth: a flagged fake is REMOVED or REASONED before its build ships, not aged on a gap board (the QB stub, flagged in as-built §6 and never removed, is why this rule exists). The board legend + the `status.html` renderer enforce the amber cap; see TRACE-SESSION-BOOTSTRAP.md → 📋 24-CAPABILITY BOARD legend.

13. **PLATFORM UI — SYSTEM-MANAGED FIELDS DISPLAY LOCKED-WITH-EXPLANATION (binding, Surface-Honesty for editability).** A field the PLATFORM sets and the user never edits (timestamps `created_at`/`updated_at`, provenance `receipt_id`/`source`/`qb_customer_id`, identity/scope `id`/`business_id`, and any future computed field) MUST display with a clickable LOCK affordance whose popover explains WHAT sets it and WHY it isn't editable — so a non-editable field reads as "system-managed, with a reason," NEVER as a silently-greyed/absent HIDDEN edit function. This is D-9 applied to editability: locked-with-explanation, not mystery-locked. The set is a **single canonical registry** — `packages/cultivar-os/src/components/datasheet/systemManagedFields.ts` (`SYSTEM_MANAGED_FIELDS` + `lockInfoFor()`) — the SOLE source for "which fields lock"; the shared `<DataSheet>` reads it and every consumer (inventory/assets/customers) inherits. Derived-WITH-override fields (`cost_confidence`, `estimated_value_confidence` — derived by default but manually overridable on the reconcile grids) are DELIBERATELY excluded (they ARE editable there); a surface that shows them read-only force-locks per-column via `systemManaged:true`. Add a genuinely system-write-only field ONCE to the registry → every grid that shows it locks it.

14. **PLATFORM UI — DATASHEET HORIZONTAL SCROLL IS ALWAYS REACHABLE + FROZEN COLUMN RESERVES A TRACK (binding grid standard).** The shared `<DataSheet>` grid renders in a **bounded scroll box** (its own `overflow:auto` + `maxHeight`) so BOTH scrollbars live on the box, not the page — the horizontal scrollbar sits at the bottom of the VIEWPORT-BOUNDED box, reachable WITHOUT scrolling past every row (the defect this fixes: a wide 111-row grid forced a scroll to the bottom to find the h-scrollbar). Paired with a **sticky header row** (`position:sticky; top:0`, stays visible on vertical scroll) and a **frozen identifier column** (the leading `frozen:true` column(s) pin `position:sticky; left:…` so you never lose which row you're on). **FROZEN-COLUMN STANDARD (corrects the #104/#105 overlap where the frozen Name column covered SKU):** a frozen column occupies a **RESERVED TRACK** — its `frozenWidth` is the ACTUAL border-box width (incl. cell padding) applied as `width`+`minWidth` on the frozen th/td, so the `left` offsets accumulate EXACTLY, the scrolling region begins at the last frozen column's right edge, and scrolling columns lay out BESIDE the pinned block (hidden behind its opaque bg + a crisp 1px freeze line, never messily overlapping). `frozenWidth` is REQUIRED on every frozen column (≥ its content width; defaults to 160). The prior bug (David's own diagnosis): `frozenWidth` only fed the left-offset math and never SIZED the cell → the pinned column had no deterministic width → scrolling columns passed under it on scroll. The grid also bleeds flush to the card edges (negative side margin cancels the card's 1.25rem padding) to reclaim the left gutter the frozen column needs. Fixed in `DataSheet.tsx` → inventory/assets/customers inherit; each config sets its identifier column `frozen:true`+`frozenWidth` (a leading flag-icon column is also frozen with its own `frozenWidth`). The `maxHeight` offset (`calc(100vh - 280px)`) leaves room for the AppLayout chrome so the box bottom stays on-screen — tune if chrome height changes.

15. **PLATFORM UI — EVERY CONTROL IS MEASURED AGAINST THE UI CONTROL STANDARDS SPEC (binding, the umbrella rule).** `docs/standards/ui-control-standards.md` is the **bar** — the industry-standard behavior every platform control (data grid, modal/dialog, field display) MUST implement — and it is BINDING. Rules 13 (system-managed field lock) and 14 (grid scroll/sticky/frozen) are two clauses OF this spec (grid standards G1–G8, field standards F1–F3); the spec also sets the **modal standard**: M1 centered on every viewport (convention A "always center" — the shared `sheetStyles.modal` + the own-copy sheets, none left as an un-decided bottom-sheet), M2 required-field validation surfaced (never silent — the FIX 5 pattern), and the next-rung gaps M3 escape-to-close / M4 defined backdrop behavior / M5 focus-trap (KNOWN, tracked, not silently assumed done). A new grid, modal, or form is checked against this spec in its build (folds into §1.6 gate item 5). A control below the bar is a KNOWN amber/red row on the rendered compliance board **`/ui-standards.html`** (a self-contained pure board beside `status.html`/`stories.html`, seeded from the spec) — reconciled or explicitly deferred, NEVER a silent gap. Fix a standard in the SHARED control (`DataSheet.tsx` / `systemManagedFields.ts` / `sheetStyles.modal`) so all consumers inherit — never a per-consumer copy. This supersedes the ad-hoc modal-centering / scroll-defect findings with ONE standard + a visible board.

16. **INDUSTRY-STANDARD-FIRST for UI & display (binding).** Before implementing any UI or display element (control, grid, modal, form, chart, layout, interaction), FIRST identify the established industry-standard pattern for that element and state it. Measure the implementation against that standard. Then DECIDE deliberately: implement the standard, adapt it, or deviate — but a deviation must be a stated choice with a reason (the need differs, the standard is unwieldy here, a lighter pattern fits), never an accident of not knowing the standard. The standard is the informed starting point and the reference we measure against; the decision stays David's. This is "standard-by-value" (cf. §6 r10 for tech choices) applied to UI/display, and it is the general process behind r15 (which names the concrete platform-control spec/board this discipline has already produced). Every UI/display build spec opens by naming the standard it builds to; if it deviates, it says why. Rationale: prevents reinventing a worse version of a solved pattern by accident, while preserving deliberate divergence where our need genuinely differs.

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

**STANDING INSTRUCTION (owner, do NOT cross without David):** TRACE instrumentation `[TRACE:*]` is ON by OWNER instruction — do NOT comment out or delete any emit until David explicitly lifts it. This OVERRIDES the STD-003 post-OWNER-PROVEN comment-out default. Applies to `[TRACE:COST]`, `[TRACE:SEAM]`, `[TRACE:opcosts]`, `[TRACE:PROJECTLENS]`, `[TRACE:ROLECFG]`, `[TRACE:HEADER]`, `[TRACE:NAV]`, `[TRACE:customers]`, and any new area.

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

**STANDING INSTRUCTION (close-out ledger, binding):** `docs/CLOSE-OUT-LEDGER.md` is the SINGLE close-out record. Every build/recon prompt ends by **updating its row there** (bar: BUILDER-COMPLETE vs OWNER-PROVEN · SHA · owner-proof status), not just its own `built-inventory.md` line. `built-inventory.md` answers "was X built?"; the close-out ledger answers "is X closed, and if not, what exact live test closes it?" A deliverable whose ledger row is missing or stale is an INCOMPLETE task — same force as the schema-verification and built-inventory gates. This is the process fix that stops owner-proof-owed tabs from re-accumulating.

**STANDING INSTRUCTION (status front-page, binding):** `TRACE-SESSION-BOOTSTRAP.md` → ⚡ ACTIVE STATUS is THE canonical status front-page; all other status docs (PLATFORM_STATE, built-inventory, customer-onboarding-capability_v1, CAPABILITY-PACKAGE-GROUNDTRUTH) are FEEDERS it links to. At the end of EVERY build / query / recon, update the affected item's line in ⚡ ACTIVE STATUS (and the 📋 24-CAPABILITY BOARD if a capability changed): color (🔴/🟡/🟢) + wired/live/proven + priority + reuse/deps/file-or-doc pointer. Archive 🟢-proven, no-longer-demo-active items to §A (DONE/ARCHIVED) so the active list stays one screen. The active list is **statuses + pointers ONLY — never inline depth** (depth lives in the feeders). A session that changed an item's state but didn't update its ⚡ line is an INCOMPLETE task — same force as the built-inventory and close-out-ledger gates. (`status.html`, beside the bootstrap, is a PURE VISUAL RENDERER of these sections — it parses the .md live at open-time and holds no data of its own, so it needs NO maintenance and there is NO "regenerate html" step: keeping the .md current per this rule keeps the board current.)

**STANDING INSTRUCTION (owner, binding — enforced like the TRACE-stays-on rule):** On EVERY BUILDER-COMPLETE, updating `docs/built-inventory.md` to reflect what shipped is a REQUIRED closing task, NOT optional. `built-inventory.md` is the running source-of-truth ledger and MUST NOT drift behind the code. The session write-back MUST state, in its own line, what was added/changed in the ledger (capability entries touched + `Last updated:` bumped to today). A BUILDER-COMPLETE deliverable whose ledger entry is missing or stale is an INCOMPLETE task — same force as the schema-verification gate above, the widget-header gate (step 8), the STD-003 gate (step 9), and the three-lens gate (step 10). This fires whether or not a prompt remembers to ask. Ledger drift is tech-debt #39's class (ledger/schema divergence) — do not add to it. **Reconciliation gate:** the standing statement of force for this rule lives in `docs/operating-doctrine/end-of-session-protocol.md` → **GATE — BUILT-INVENTORY RECONCILIATION** — for every capability touched: (a) it has a body entry reflecting CURRENT state with `Last updated:` = today, (b) the entry matches the code and **audit wins on conflict** (describe what IS), (c) a capability built with NO body entry = DRIFT → create it before close. A close-out is not complete until built-inventory reconciles.

**STANDING INSTRUCTION (owner-proven reconcile gate — sibling of the reconciliation gate above, same force):** the reconciliation gate above fires on BUILDER-COMPLETE; this one fires on OWNER-PROVEN. **When David reports an OWNER-PROVEN (single or batch), the FIRST action that session is to flip the status marks for those capabilities from 🟡→🟢 across ALL canonical surfaces** (⚡ ACTIVE STATUS · 📋 24-board · `built-inventory.md` · 🧵 ARC-MAP · any mapped `user_story`), bump `Last updated:` to today, and state in the write-back which caps flipped. **A stale 🟡 on an owner-proven capability is DRIFT (tech-debt #39 class) — same force as the BUILDER-COMPLETE reconciliation gate.** (Proposed operating-principle id: OP-11 — confirm the DECISIONS.md OP sequence before assigning.) Full statement of force: `docs/operating-doctrine/end-of-session-protocol.md` → GATE — BUILT-INVENTORY RECONCILIATION.

**STANDING INSTRUCTION (decisions-index sync + drift check, binding — same force as the reconciliation gates above):** `docs/DECISIONS-INDEX.md` is the SINGLE decisions index and the SOLE data source for the 📇 Decisions panel on `status.html` (a pure renderer — parses the .md live at open-time, holds no decision data; NEVER hand-edit the panel, edit the index). Every close-out does BOTH: **(a) SYNC** — if the session settled, deferred, superseded, or drifted any decision, update its row + Status cell in `DECISIONS-INDEX.md` (and add a new row for a net-new decision) so the panel re-renders current; bump its `Last updated:`. **(b) DRIFT CHECK** — check the session's work against the index and update the top **`> Drift watch (DATE):`** blockquote to exactly one of: `✅ No drift — abided by #X/#Y …` OR `⚠️ DRIFT — went outside #Z: [what/why]`. State the same confirm/flag in the write-back. status.html renders that line as a banner (green = clean, red ⚠️ = drift) and colors any OPEN/DRIFTED row red/amber automatically, so drift is VISIBLE without hunting. A close-out that changed a decision's state but left the index or the drift line stale is an INCOMPLETE task (tech-debt #39 class — ledger/decision divergence). status.html is a hand-authored pure renderer with no build step, so there is nothing to regenerate — keeping `DECISIONS-INDEX.md` current keeps the panel current.

**STANDING INSTRUCTION (story locations — the artifact-type rule, binding):** there are three story-shaped surfaces and they are NOT interchangeable — know which is which before writing or citing a story.
- **`user_stories.md` (repo root) is THE STORY BOARD and the single source of truth for stories.** `stories.html` renders it (a PURE RENDERER — parses the .md live at open-time, holds no data, is NEVER edited; delete the .md and it shows "no data," never a stale board). **A new user story goes HERE** as a `###` block using the EXACT tag schema: `STATUS:` (`written` | `needs-input` | `needs-sub-stories` | `gap`) · `SCOPE:` (`north-star` | `platform` | `vertical:cultivar|coolrunnings|kinna|ignition`, primary first) · `BUILD:` *(optional — `active` | `in-build` | `archived`, default `active`)* · `ARC:` (one of the 8: `front-door` · `ocr-doc-routing` · `cost-to-produce` · `suggestion` · `delivery` · `discovery` · `identity-roles-sec` · `asset-inventory-pmi`) · `MAPS-TO:` (status-board capability id(s) e.g. `2.3, 5.1`, or `—` for a gap) · `PIECES:` · `NEEDS:` — placed under its `## ARC:` section (or `## NEEDED` if cross-cutting). Format-example tags inside the header blockquote are quoted prose, not parsed stories.
- **`docs/user-stories/` holds LONG-FORM FLOW SPECS** (design intent — e.g. `cultivar-flows-and-contractor-program-2026-06-03.md`). This is a DIFFERENT artifact type: NOT board-tagged, NOT parsed by `stories.html`. A board card LINKS OUT to a flow-spec section for deep behavioral detail; **the flow spec never lives on the board, and it is revised IN PLACE, never forked** (the doc says so itself). Reach for it when a story needs the detailed flow behind it — not when adding a story to the queue.
- **`CULTIVAR_OS_USER_STORIES_AND_DEMO.md` (repo root) is the LEGACY demo-script archive** (old `AS A / WHEN / I WANT / SO THAT` prose). Standalone, NOT a board feed. Name-collision risk with `user_stories.md` is noted — do NOT treat it as the board. Cite: story-location recon (2026-07-08).

**STANDING INSTRUCTION (story reconciliation gate — every build traces to a story, binding — same force as the schema/built-inventory/close-out gates):** a build spec whose behavior cites no upstream story is the SMELL that behavior is being RE-DERIVED (proven by the transport/netting regression — the multi-item rewrite re-derived a workflow that already had a proven spec; see `docs/decisions/2026-07-08-as-built-purchase-workflow.md`). Therefore, **before any build spec is written, the intended build is bounced against `user_stories.md`:**
- **MATCH** → CITE the story in the build spec, build to it.
- **NO MATCH** → a story must be CREATED (David dictates → Lightning specs → written to the board with the tag schema) BEFORE the build spec.
- **CONFLICT** (intent contradicts a written story) → **STOP**, surface to David, resolve before building.
- **IN CODE BUT NOT ON THE BOARD** → flag it, write the story so it's captured (this is the `gap`/as-built case).
- **UNCLEAR** → surface to David: "a story needs creating here."
Then: **every build spec CITES the story it satisfies AND the flow-spec section** (if one holds the deep behavior). A build spec that cites no upstream story/spec = re-derivation risk → do not proceed on it silently. **If no build spec exists for a settled story, it gets MOCKED first** — Thunder extracts current state from code into a factual as-built file; Lightning renders it visually for David — BEFORE the build. The story-check is folded into the STEP 0 gate (§10).

**Quick reference — mandatory close sequence:**
1. Update Handoff (Part 3) + Active Tasks (Part 4) + Off Limits (Part 7)
2. Confirm no hardcoded URLs or keys
3. `git add CLAUDE.md && git commit && git push`
4. Tailwind drift check · Documentation propagation check · Factual correction capture
5. Runbook if env/infra work · AC compliance check · STANDARDS compliance check
6. Gap graduation sweep · PLATFORM_STATE.md level changes
7. **Update BUILT-INVENTORY.md (REQUIRED on every BUILDER-COMPLETE — see the STANDING INSTRUCTION above)** — bump `Last updated:` to today + add/update every capability changed this session, and STATE in the write-back what ledger entries were touched. **Verify line 4 date = today before committing.** Not optional; ledger must not drift behind code (tech-debt #39 class). (Full protocol: step 17 in docs/end-of-session-protocol.md)
7b. **Update the ⚡ ACTIVE STATUS front-page (REQUIRED — see the STANDING INSTRUCTION above):** in `TRACE-SESSION-BOOTSTRAP.md`, update the affected item's line (color + wired/live/proven + priority + reuse/deps/pointer), touch the 📋 24-CAPABILITY BOARD if a capability changed, and archive 🟢-proven non-active items to §A. Statuses + pointers only — never inline depth. This is the canonical status doc; the others are feeders.
7c. **Sync `docs/DECISIONS-INDEX.md` + drift check (REQUIRED — see the STANDING INSTRUCTION above):** update any decision row/Status the session changed (or add a net-new decision), and set the top `> Drift watch (DATE):` blockquote to `✅ No drift — abided by …` or `⚠️ DRIFT — went outside #Z: [what/why]`. The 📇 Decisions panel on `status.html` renders both live — no regeneration step. Confirm/flag the same in the write-back.
8. **Widget-header gate (binding):** every new/modified widget·tile·component·module·page·endpoint carries a HEADER (PURPOSE · DEPENDENCIES · OUTPUTS) AND is listed in BUILT-INVENTORY.md — a built artifact without a header is an incomplete task. (Doctrine: partnership doc §15; full gate: protocol Step 10 + Step 17.)
9. **STD-003 instrumentation gate (binding):** every build that adds/changes a capability ships TRACE instrumentation (`[TRACE:area]`) **ON BY DEFAULT** — actively emitting, NOT wrapped behind a false flag, NOT default-silent, NOT deleted. It stays ON until the feature is **OWNER-PROVEN** by David through the actual UI under real RLS (see the two-bar rule below). A build that strips, omits, or pre-silences debug before owner-proof is an **INCOMPLETE task** — same force as the header gate. Only AFTER owner-proof does debug get **COMMENTED OUT** (not deleted) — dormant, re-enabled by uncommenting next time the code is touched. "On by birth, commented out by earning it." This gate fires whether or not a prompt remembers to ask: if a build prompt omits STD-003, the prompt is itself incomplete and Thunder adds the instrumentation anyway. (Doctrine: STANDARDS.md STD-003; partnership doc §16; DECISIONS.md OP-4.)

   **The completion bars — state which one a deliverable is at (four; the fourth is DORMANT until the first paying customer):**
   - **BUILDER-COMPLETE (Thunder):** code works, builds pass, `npm run verify` exit 0 zero net-new, committed.
   - **DEPLOYED (Thunder):** pushed to origin AND Vercel-deployed AND the new-code signal is visible in-app. **The check: "What new signal does ONLY this build emit, and do I see it?"** — a new message, a new `[TRACE:*]` emit, a new bundle hash. **If you still see the OLD signal, you are testing OLD code — STOP, confirm the deploy, and do NOT declare pass/fail.** Committed ≠ live.
   - **OWNER-PROVEN (David):** David has used the feature through the ACTUAL UI, under REAL permissions (RLS), via the `[TRACE:*]` trail, and confirmed it does what it should.
   - **DEPLOY TO LIVE (David — DORMANT until the first paying customer):** after OWNER-PROVEN. Once a paying customer exists, development runs run-and-gun against a REFERENCE environment (a disposable duplicate holding no paying-customer data — break it freely). **BUILDER-COMPLETE, DEPLOYED, and OWNER-PROVEN all occur ON REFERENCE.** Only after a change is OWNER-PROVEN on reference is it PROMOTED to production. **There is no paying customer today, so this bar is DORMANT — the current single-environment loop is unchanged. The three bars above are NOT replaced; this one is appended.** The velocity of run-and-gun is preserved; the new ceremony applies ONLY at the live boundary, where slowness is cheap and mistakes are expensive. (Promotion discipline: DECISIONS.md OP-12 — reference-proven artifacts promoted verbatim, schema byte-identical, no hand-edits at the boundary.)
   - Instrumentation stays ON across all bars. **Thunder reporting "builder-complete" does NOT authorize removing debug — only owner-proof does.** Builder verification ≠ deploy ≠ owner verification: a service-key round-trip can pass while the RLS/UI path still fails (Cost-to-Produce, 2026-06-14 — round-trip green, UI-save-under-RLS unproven), AND testing an un-deployed bundle produces phantom bugs (bit 3× on 2026-07-03 — map cached bundle, dedup unpushed, dedup tested-before-deploy). Thunder must state which bar each deliverable is at.
10. **Three-lens recon gate (binding) — fires at RECON time, not close:** every verify-before-build / decision recon ("LOOK") reports in THREE LENSES — **HAVE** (current state, `file:line`), **NEED** (irreducible minimum to meet the requirement, no preference), **WANT** (desired end-state / clean architecture, labeled as want) — and presents OPTIONS spanning NEED→WANT (cheapest-meets-need → fullest-meets-want), NOT one pre-collapsed recommendation. A recon without the three lenses is an **INCOMPLETE task** — same force as the header (item 8) and STD-003 (item 9) gates, and fires whether or not a prompt asks. (Doctrine: partnership doc §17; DECISIONS.md OP-8; proven by the asset-node schema A/B test, exemplar `docs/cost-to-produce/ASSET-NODE-SCHEMA-DECISION-3LENS.md`.)
11. **Quality gate (binding):** `npm run verify` (tsc + eslint + knip + verify-universals, ratcheted against `quality-baseline.json`) must pass with **zero NET-NEW** violations before a build is BUILDER-COMPLETE. Fail-on-new only — pre-existing baseline debt does not block. If you fixed violations and a metric dropped, run `npm run quality:baseline` and commit the lower numbers (lock the win; never let the baseline grow casually). Out of scope this gate (separate value-review): jscpd, Prettier, npm-audit, a test suite. (Tooling installed 2026-06-24; doctrine: §6 rules 8–9.)

---

## 10. SESSION STARTER

Paste this at the start of every Claude Code session:

```
Read CLAUDE.md before we begin.
Open TRACE-SESSION-BOOTSTRAP.md → ⚡ ACTIVE STATUS FIRST — the canonical status front-page (in-flight + demo-critical, one screen). Then PLATFORM_STATE.md / built-inventory for depth (they are feeders).

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
8. **Story reconciliation (binding gate — every build traces to a story):** which story on `user_stories.md` does this build satisfy, and has its flow-spec section (in `docs/user-stories/`) been read? Bounce the intended build against the board: MATCH → cite it; NO MATCH → a story is created first; CONFLICT → STOP and surface; IN-CODE-NOT-ON-BOARD → flag + write the story; UNCLEAR → surface to David. A build spec that cites no upstream story/spec is re-derivation — do not start on it (§9 story-reconciliation gate; story-location rule; `docs/decisions/2026-07-08-as-built-purchase-workflow.md`).

Do not start until you confirm all eight.
Do not touch ignition-os, old Supabase project,
or QB oauth.ts.
```

---

*TRACE Enterprises · Built with CAI*
*cultivar-os.vercel.app · builtwithcai.com*
*(512) 456-3632 · david@trace-enterprises.com*
*Update this file every session. No exceptions.*
