# CLAUDE.md — TRACE Platform
# Multi-AI Handoff Workflow — Claude Code reads this every session
# Last updated: 2026-07-16 — the four ways a working variety got broken through the UI (ledger #135, SHA 313de44). See §3 for the current handoff; `docs/handoff-archive.md` for full history.
# ⚠️ THIS LINE IS A POINTER, NEVER A SUMMARY (OP-13 / STD-011) — the narrative lives in §3 and ONLY in §3. Do not restate it here.
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

Active open items: #2 (QB hardcode), #3 (social in cultivar), #4 (nursery footer), #8 (RLS unverified), #10 (SavingsReport missing), #12 (Ignition AI dark / Railway kill path), #13 (stub duplication), #16 (MarginEngine orphaned — A callers + plants.cost_price), #17 (dead migration), #18 (pin_hash unverified), #19 (instagram fallback), #20 (platform union), #21 (orphaned campaigns files), #22 (platform_check migration — David must apply), #23 (STD-008 inverse sweep pending), #24 (opaque names), #25 (6 AI features dark), #26 (orphaned DataBridge keys), #27 (10 tables no migrations), #28 (pilot_all RLS open), #29 (receipts naming), #30 (voice-samples RLS scope), #31 (catalog-verify process), #32 (cultivar_plants anon read open), #33 (widget-header backfill), #57 ✅ resolved 2026-07-16 (COUNTING A VARIETY MADE IT UNSCANNABLE — the count-promote created a 2nd row beside a size-less scraped parent (114→118 on four scans) and the re-scan then went UNKNOWN; **103 of 112 scraped rows are stubs**, every one a landmine awaiting its first count. #55 made the branch reachable for the first time. FIXED by D-49's ONE invariant — any path that mints a sibling leaves the family picker-ready by construction: a counted STUB is FILLED in place (D-34 — no size + no stock ≠ a lot), an UNGROUPED NON-STUB creates a real sibling AND auto-groups the parent (D-46's rule #126 reaching the path that skipped it). Decision extracted PURE to `countPromote.ts`; RED-first 24/16-fail → 40/0; `detectSizeCollision` untouched. Ledger #133, owner-proof owed) · #59 🟡 NEW 2026-07-16 (`TRACE-SESSION-BOOTSTRAP.md`'s header carries the **STD-011 duplicate-header disease AND IS LOADED EVERY SESSION** — §10's Session Starter opens it FIRST, so its `Last updated:` prose block is a per-session token tax exactly like CLAUDE.md line 3 was. **OP-13's own triage put it with the ledger/DECISIONS-INDEX as "not loaded every session" — that was WRONG for this one**; the triage stands for the other two. The header-is-a-POINTER clause should extend to it — David's call. Ledger #135) · #58 🟡 NEW 2026-07-16 (**the DB-level guard for the (variant_group, size) pair** — the durable form of ledger #135's defect 2: a partial unique index `(business_id, variant_group, size) WHERE variant_group IS NOT NULL AND size IS NOT NULL`. This is **ledger #74's deferred option C**. It is a MIGRATION and **it would REJECT the live Acoma dup, so it cannot land until the data is clean** (i.e. after the regenerated remediation). The code guard `findSizeTwin` is proportionate at a single-owner nursery's volume. **Sibling of #54** — the `qb_customer_id` partial unique index, named-not-taken on the same reasoning) · #56 🟡 (SIZE VOCABULARY not normalized on the count path — **the last live defect of the D-49/#135 family**; `findSizeTwin`/`sameSizeLabel` are exact equality and the catalog carries SIX spellings of THREE sizes (`15`/`30`/`45`/`5 gal`/`30 gal`/`45 gal`), incl. on **'Sierra', a DEMO variety**. Unlike #135's four, it can **MERGE existing rows** → needs a read-only blast-radius probe first — `'Sierra'` is live with `["15","30 gal"]`, so counting "15 gal" against the "15" row mints a THIRD row: two spellings of one physical size, on-hand split across both. D-45 did this for NAMES, nobody did it for SIZES. The next defect in the D-49 family — its own blast radius: unlike D-49 it can MERGE existing rows) · #34 ✅ resolved 2026-06-19 (qbo/status+auth-url 500 → router.ts:15 import depth 4x→3x, commit 14a9a82; esbuild-proven) · #35 ✅ resolved 2026-06-15 (nursery_profiles 406 → maybeSingle) · #36 (/assets + /pmi nav-dead) · #37 (PMI UI polish pass) · #38 (frictionless multi-channel cost capture — NEXT MAJOR BUILD after Core-2b; capture≠classification, hard-blocked on Core-2b sameCost dedup) · #39 (live schema not in version control — orders/customers/order_items + qb/leakage/netting cols live-only) · #40 (built-inventory flag correction — 5.1 inventory / 5.2 PMI are resolved, not ⚪) · #41 (Vercel Hobby 12-function ceiling — `api/` at limit; new functions silently fail deploy; mitigated by folding deliveries→customers; upgrade to Pro before next module wave) · #55 ✅ resolved 2026-07-16 (canonicalName APOSTROPHE DEFECT — possessive varieties FALSE-UNKNOWN on scan; **4 of 6 apostrophe varieties were BROKEN in live data**: Basham's Party Pink Crape Myrtle · Evey's Pride Mimosa · Summer's Tower Redbud · Hearts A'fire Redbud, all `variant_group` NULL, never counted. Wrapping quotes survived (`'Sierra'`→{sierra}) — which is why it hid — but possessives didn't (`Basham's`→{basham} vs slug {bashams} — the 1-char filter ate the `s`). FIXED by the elide-don't-split rule `personName.ts` proved in D-47, applied BEFORE the boundary split (order IS the fix); 5 apostrophe codepoints handled; RED-first per STD-002 (21/4 fail → 34/0 pass); blast radius probed live read-only = 4 token sets change, 0 groupings moved. Ledger #132, owner-proof owed) · #54 🟡 (qb_customer_id collision guard is code-level/TOCTOU — durable form is a partial unique index `(business_id, qb_customer_id) WHERE NOT NULL`; a MIGRATION; theoretical at zero links, needed before real billing volume) · #53 ✅ resolved 2026-07-16 (QBO customer find-or-create matched on EMAIL ALONE → cross-billed NINE real invoices to "Andrew O'Brien" over two months; fixed by the D-47 three-way rule — match on the field QBO guarantees unique (DisplayName), two fields must concur, ambiguity → CREATE/SURFACE never a guessed link, stored links verified-before-use; blast radius ZERO; owner-proof owed) · #42 ✅ resolved 2026-06-21 (seed.ts D-9 silent coercion — `classifyCategory` flags unknown instead of masquerading as 'addon'; price 0 → explicit flagged non-null placeholder; residual: nullable price needs a `service_offerings` ALTER)

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

### 2026-07-16 — THUNDER THE FOUR WAYS A WORKING VARIETY GOT BROKEN THROUGH THE UI (ledger #135): D-49's invariant was right; three other mint paths didn't obey it and D-49's own create branch left half of it to a sheet that didn't argue — all four minted LIVE, through the UI, in the hour after D-49 was owner-proven; ledger #74's CASE 5 is now CONFIRMED-LIVE, not theoretical; BUILDER-COMPLETE, owner-proof owed; ZERO migration, ZERO api-fn (12/12); SHA `313de44`

**Type:** App code — 4 NEW (`packages/shared/src/components/FieldError.tsx` the FIX 5 pattern extracted · `packages/shared/src/discovery/dupSize.test.ts` 22 · `packages/cultivar-os/src/components/datasheet/flagCounts.ts` + `.test.ts` 12) + 8 EDIT (`shared/inventory/variantGroup.ts` `baseSkuOf` rehomed + `suggestSiblingSku` · `shared/inventory/countPromote.ts` the `refuse` action · `shared/inventory/countPromote.test.ts` 52 · `shared/inventory/index.ts` · `shared/inventory/stockLineResolver.ts` miss carries candidates · `shared/discovery/dupSize.ts` `sizeGroupKey` + `findSizeTwin` · `shared/pages/Settings.tsx` + `cultivar/pages/Discounts.tsx` repointed onto the shared FIX 5 · `cultivar/components/inventory/InventoryEditor.tsx` · `cultivar/pages/InventoryCount.tsx` · `cultivar/pages/BusinessInventory.tsx` · `cultivar/components/datasheet/DataSheet.tsx`) + 1 BANNER-MARKED STALE (`docs/decisions/2026-07-16-d49-stub-fold-remediation.sql`). **NO migration** (every column exists — these are validation and derivation fixes; none was needed, none taken). **ZERO new `api/` file** (12/12, counted). `[TRACE:INVENTORY]`/`[TRACE:COUNT]`/`[TRACE:RESOLVE]`/`[TRACE:invsheet]` ON — **net +2 emits, none silenced**. `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 248 / knip 10·14·15 == baseline); `build:cultivar` clean 2353 modules 6.33s. **Full suite 16/16 green, zero regressions.** Ledger row #135. **NO new decision** — implements D-49 + D-46 + STD-011.

**THE INVARIANT — ONE statement, FOUR instances (this is why it is one build and not four):** *any path that mints or fills a row in a variety family leaves that family PICKER-READY BY CONSTRUCTION — every row grouped, every size non-empty and distinct, SKU derived from the family's BASE.* D-49 proved it on the count path and **the count path is now the reference implementation**. Three other paths did not obey it. **Every one of these four was minted live, through the UI, in the hour after D-49 was owner-proven** — not theorized.

**DEFECT 1 — SIZE REQUIRED (🔴 the one that broke a clean variety with no warning).** David counted Alley Cat, left the size box EMPTY, entered 60, and it **SAVED**: `promote — created {variant_group:'alley-cat-redbud-espalier', size: null, qty: 60}` beside 15/30/45 → re-scan **UNKNOWN**. **Clean at 16:59, broken at 17:03, by the branch that was supposed to be the fix.** The sheet said "Pick an existing size or type a new one", the field was optional, the save button did not argue. FIX: the refusal lives in **`resolveCountTarget`** and **the sheet ASKS THAT SAME FUNCTION** — so the UI gate and the write gate are ONE rule that cannot drift, rather than two rules that look alike until one changes (D-48's shape; §1.6 item 3 — validated before the WRITE, not merely hidden in the UI). Refusal red-borders the size field and SAYS WHY (FIX 5); **never a greyed button with no reason**.

**⚠️ IT REFUSES *BEFORE* THE EXACT-MATCH BRANCH — and that ordering IS the fix, plus the ugliest finding of the session.** A blank size **MATCHES** a size-less row (`sameSizeLabel(null,null)` is true), so a **stub counted with no size took a plain `update`**: qty landed on a row that still had no size, turning a harmless placeholder into a **size-LESS LOT** — the Basham's shape, minted one branch over. **D-49's own test suite asserted that as CORRECT** (`'stub counted with NO size → plain update'`). **The defect was tested IN and blessed — the D-48 scar, verbatim, in the suite written to prevent this exact family of bug.** Refusing after (0) would have fixed `create` and left `update` live. Corrected, and flagged as a correction — **not a test adjusted to make a fix pass** (the 36 that passed in RED stayed green throughout).

**DEFECT 2 — DUP-SIZE GUARD (mints CASE 5).** Live and **still in the data**: `DISC-1002` and `DISC-1002-15G`, **same group, same size**. That is **ledger #73/#74's *same-group-same-size* dead end, carried as THEORETICAL since 2026-06-30 — minted through the UI in under a minute.** **It is now CONFIRMED-LIVE.** ROOT: D-46's editor enforces **SKU** uniqueness (`DISC-1002-15G` is unique → guard passed) and never checked **SIZE** uniqueness within the group. **Two different facts, only one guarded** — a SKU identifies one sellable UNIT, a `(variant_group, size)` pair identifies one VARIANT; WooCommerce and Shopify both refuse a duplicate option combination *independently* of SKU (§6 r16). FIX: new shared **`findSizeTwin`** sits **beside** `findDuplicateSizeGroups` on **ONE key** — same fact, opposite moment (the detector surfaces a collision that exists; the guard refuses to mint one), so the two can never disagree about what "the same size in the same group" means. It **names the twin and its SKU and offers to edit that row** — never a bare refusal.

**DEFECT 3 — SKU BASE (lineage compounded).** Live: **`DISC-1003-30G-45G`**. "+ Add size" from the `DISC-1003-30G` row handed **that** row's SKU to `deriveSiblingSku`; the next would have been `DISC-1003-30G-45G-15G`. **THE HELPER IS NOT THE BUG — THE CALLER IS**, and the proof is in David's own trail: the **count path called the SAME helper minutes later, on this SAME family** (which already contained the compounded SKU) and produced **`DISC-1003-60G` correctly** — because it resolved the base first. **Base resolution worked in one place and the other place didn't use it.** RECON ANSWER: the rule **was already a named shared function** — `baseSkuOf` (shortest non-blank SKU; a derived sibling is always base+suffix, so the base is always shortest) — but it was homed in `countPromote.ts`, which the editor has no business importing. **MOVED to `variantGroup.ts` beside `deriveSiblingSku` (SKU lineage is a SKU fact, not a counting fact)**; both minting paths now make the identical **`suggestSiblingSku(family, size)`** call. `deriveSiblingSku`'s idempotence guard only ever caught re-appending the *same* suffix — documented at the helper, since it cannot detect a wrong base.

**DEFECT 4 — BANNER SCOPED TO THE VIEW (Surface Honesty inverted).** Filtered to "alley": **4 clean rows, zero collisions**, and a red banner reading *"2 size collisions … Edit the size or variant group on a flagged row to fix it."* That was **Acoma's** collision, elsewhere, **rendered over four clean rows, instructing him to edit a flagged row when none was on screen**. **D-9 INVERTED: it does not fabricate a value, it MIS-ATTRIBUTES a real one** — the number was true, the place was a lie. FIX: `inView` and `elsewhere` are now **two separate honest facts**; the copy never lets one masquerade as the other, and a filtered-clean screen gets *"N flagged rows **elsewhere** … nothing on this screen is affected."* **The row FLAG stays catalog-wide on purpose** — a collision is a fact about the data, so a row must not stop being flagged because its twin scrolled out of view; only the COUNT is view-scoped, and **that distinction is the whole fix**. FOLD-IN: the copy said "2 collisions" while the trace said `Array(1)` — **ONE collision, TWO rows**; copy and trace now count the **same noun** and both are named. The rule was extracted **pure** (`flagCounts.ts`) because it was **unreachable inside a `useMemo`** — the D-49 lesson, one layer up.

**RECON CHANGED THE BUILD IN THREE PLACES (stated, because two of them contradict the prompt's own lean — as it invited):**
- **(a) The UNKNOWN sheet is NOT "a different surface with no family to break."** It runs **resolve-before-create**, so a typed name can land **INSIDE an existing family**; and on a genuinely new variety it **always** sets `groupKey = slugify(name)` — **every row it mints is in a family by construction**. Same family, same blast radius. Size is required there too, and `Size (optional)` → `Size *`. *"Skip & flag"* (record-only, no promote) correctly needs no size — nothing is written for a size to describe.
- **(b) ⚠️ THE PROMPT'S QUOTED TRACE IS NOT WHAT THE CODE EMITS.** `(ungrouped siblings)` is a **hardcoded literal** that fires on *every* ambiguous miss. **Alley Cat's four rows were ALL grouped** — the cause was a blank size — so the emit **named the wrong cause, confidently**, and *"blank size on 1 row"* was a **human inference, not the trace's output**. So `[TRACE:RESOLVE]` told **two** lies, not one: the false `MISS` after `AMBIGUOUS`, **and** a fabricated cause. FIX: **ONE emit per miss**, which **SHOWS the candidates** `{size, group, sku}` rather than asserting a cause — the blank size becomes *visible* **without re-spelling `detectSizeCollision`'s predicate anywhere** (a second copy of that rule, written only to explain the first, is exactly what drifts — STD-011). The resolver's ambiguous miss now carries `candidates` (additive).
- **(c) The size-required rule is NOT unconditional in the EDITOR, and that is the invariant stated exactly, not a convenience conditional.** A row **in a variety group** must have a non-empty distinct size; a row with **no group** is a standalone item (netting, a tool) and legitimately needs none. "+ Add size" always joins a family, so it is always covered. On the COUNT path it *is* effectively unconditional, because the count always assigns a group.

**STD-002 — RED FIRST, ALL THREE ARTIFACTS, AGAINST THE REAL DEFECTS.** Following D-49's proven shape, the **CURRENT SHIPPED RULES WERE PORTED VERBATIM INTO THE NEW PURE MODULES FIRST** so the failures were against the real thing and not a strawman: `suggestSiblingSku` seeded from the clicked row · `findSizeTwin` returned null always (the editor's actual behavior: no size guard at all) · `partitionFlagged` counted over ALL rows. **RED: countPromote 36/16-fail · dupSize 16/6-fail · flagCounts 6/6-fail → GREEN: 52/0 · 22/0 · 12/0.** Full suite **16/16, zero regressions** (canonicalName 34/34, catalog-variants 31/31, customerIdentity 22/22, tierPricing 138/138, populate 9/9).

**⚠️ ONE OF MY OWN RED CHECKS FAILED LEGITIMATELY — and it found a real defect I hadn't been sent for.** I asserted the dup key could not be forged; it could. `sizeGroupKey('a||b','c')` and `sizeGroupKey('a','b||c')` **both** produced `a||b||c`, while the code carried the comment *"'||' separator → no cross-pair key collision"* — **false since #74**, and `variant_group` is **owner-editable free text on the grid**, so it is reachable, not hypothetical. Consequence is mild (a false collision FLAG, never a wrong write) but **a key that can be forged is not a key**. Now a JSON pair — **the comment describes what the code does**.

**`detectSizeCollision` NOT TOUCHED.** It refused to guess on a blank size and on a mixed group and was **RIGHT both times** — that refusal is D-9 working and **it is what surfaced all of this**. We fixed the paths that CREATE the states it refuses; we did not loosen the refusal.

**§6 r8 CONSOLIDATION (reported per the rule):** the **FIX 5 pattern extracted to ONE home** (`shared/components/FieldError.tsx`). The rule of three was **already exceeded**: `errBorder` in **3 byte-identical copies**, `FieldError` in **2**, plus **4 hand-inlined copies** of its `<p>` body — and **Discounts' own comment pointed at Settings as "the reference" while holding a copy** (the copies knew they were copies). All four consumers repointed. Also: `BusinessInventory`'s local `dupKey` retired onto `sizeGroupKey`; `InventoryCount`'s `existingSkus` prop replaced by ONE `peers` prop from which the editor derives **both** guards — **a caller can no longer supply one guard's data and forget the other's, which is precisely how the size guard came to be missing while the SKU guard shipped**.

**CONSTRAINTS HELD:** STD-011 (ONE key `sizeGroupKey` · ONE base rule `baseSkuOf` · ONE dup fact, two moments · ONE validation pattern · ONE size rule serving create AND per-field edit) · STD-002 (RED→GREEN, all three) · STD-017 (all 7 surfaces enumerated; **the EDIT path is a surface and got the same guard** — blanking a grouped row's size, or editing a size onto its twin, breaks the family exactly as create does) · STD-018 · D-9 (no fabricated SKU/base; omit-not-fake) · D-34 (the lot IS the SKU; size is the distinguishing attribute) · AC-1 (size stays a free-text VALUE — no CHECK, no enum) · AC-3 (all reads/writes `business_id`-scoped) · §6 r11 (12/12, counted, none minted) · §6 r16 (the standard named: a variant is identified by its option-value combination; every commerce platform refuses an empty required option value and a duplicate combination). **BENCH: no trigger fires** (no payments/PII/webhooks/AI-calls/invoices/compliance-actions — roster matched, reported per §6 r10).

**DEPLOYED-BAR SIGNAL (§9 — committed ≠ live):** the signal **ONLY this build emits** is **a blank-size save being BLOCKED with a red-bordered size field and a visible reason**, and `[TRACE:INVENTORY] promote — REFUSED at the sheet: size-required`. **If a blank-size save still SUCCEEDS, you are testing OLD code — hard-refresh, confirm the Vercel deploy is READY and the bundle hash changed, and do NOT declare pass/fail** (the #128/#129 stale-cached-bundle scar).

**OWNER-PROVEN owed (David, live):** **(1)** Count a variety, leave size **BLANK** → **BLOCKED with a visible reason**, no row written, re-scan still resolves. **(2)** Count a variety, type a **NEW** size → creates, SKU `DISC-####-NNG` **from the PARENT base**, re-scan → picker fires with all sizes. **(3)** "+ Add size" with a size **already in the group** → **BLOCKED, names that row and offers to edit it**. **(4)** "+ Add size" from a **SUFFIXED sibling** (`DISC-1003-30G`) → mints `DISC-1003-NNG`, **NOT** `DISC-1003-30G-NNG`. **(5)** Filter `/inventory` to a clean variety → **no "collisions here" banner** (an *"elsewhere"* note is correct and expected while Acoma's twin is still in the data); filter to **Acoma** → banner fires and names the right rows. **(6)** An **AMBIGUOUS** resolve does **NOT** also emit a false `MISS` — one emit, listing the candidates. `[TRACE:*]` stays ON until owner-proven.

**⚠️ THE #133 FOLD SQL IS STALE — DO NOT APPLY IT, AND DO NOT ASK DAVID TO.** It was written against **118** rows; David's catalog is at **123** and its row count **moved eight times** during the owner-prove. Its scope has also **GROWN**: the remediation now owes the four orphan pairs **PLUS Acoma's CASE-5 twin PLUS `DISC-1003-30G-45G`**. **It gets REGENERATED against a SETTLED catalog AFTER these fixes are owner-proven** — applying a hard-coded-id DELETE against a moving catalog is exactly the scar its own guards were built to avoid. I **banner-marked the file itself ⛔ STALE / DO NOT APPLY** rather than only writing it here: a file that says "apply me" when it must not be applied is the same dead-affordance class this entire build is about. Its **G1-G5 guard structure and its ORDERING lesson** (repoint `inventory_counts` BEFORE the fold — the FK is `ON DELETE SET NULL`, so deleting first silently orphans the count rather than erroring) are the **template** the regenerated version is built from. **The 103 stubs and the ungrouped rows get NO SQL** — they are not broken; the code fix makes their first count correct.

**⚠️ OP-13's FIRST LIVE TEST — IT PASSED, AND IT EXPOSED ITS OWN LIMIT. Measured, not computed (I do not get to make this claim by arithmetic — the D-49 lesson bit that entry twice).** The gate **fired at step 0 without a prompt reminding it to**, which is the only property that matters for a rule that must survive being forgotten: 3 in §3 + 1 new = 4 → **1 archived (`e6211927…` in and out, byte-identical) + 3 kept**; archive **179 → 180**; line 3 still a pointer. **BUT: CLAUDE.md went 736 → 753 lines / 118,939 chars — it GREW, on the session that archived an entry.** Per-section, measured: **§3 91 → 104 (+13)** *despite* losing an entry, because **N=3 caps the COUNT of entries and nothing caps their SIZE** — mine is simply longer than the one it displaced. And the **Tech Debt Log grew 1,468 characters while adding ~0 LINES** (it is one physical line). **That is the line-3 finding happening AGAIN, in the very write-back that proposes fixing it** — the metric is blind to exactly the growth that is occurring. So: **the retention rule works and is not sufficient**; the honest reading is that OP-13 bounds the handoff's *shape*, and the remaining growth is prose in §-blocks the line count cannot see. **This is the concrete case for the char-budget amendment (d) below, and it is evidence, not an argument.**

**FLAGGED FOR DAVID (named, NOT built):** **(a) tech-debt #56 — size VOCABULARY**, the next defect in this family and now the *only* live one: `sameSizeLabel`/`findSizeTwin` are exact string equality and the catalog carries **six spellings of three sizes** (`15`,`30`,`45`,`5 gal`,`30 gal`,`45 gal`), including on **'Sierra', a DEMO variety**. Counting "15 gal" against a "15" chip mints a THIRD row. D-45 did resolve-before-create for NAMES; nobody did it for SIZES. **Its own build — unlike these four it can MERGE existing rows, so it needs a read-only blast-radius probe first.** **(b) tech-debt #58 (NEW) — the DB-level guard**: the durable form of defect 2 is a partial unique index `(business_id, variant_group, size) WHERE both NOT NULL`. That is ledger #74's deferred option C. **It would REJECT the live Acoma dup, so it cannot land until the data is clean.** Sibling of **#54** (the `qb_customer_id` partial unique index — named, not taken, same reasoning): the code guard is proportionate at a single-owner nursery's volume. **(c) tech-debt #59 (NEW) — `TRACE-SESSION-BOOTSTRAP.md`'s header carries the STD-011 duplicate-header disease AND IS LOADED EVERY SESSION** (§10 Session Starter opens it FIRST). **My own OP-13 triage put it with the ledger and DECISIONS-INDEX as "not loaded every session" — that was WRONG for this one**, and it is a per-session token tax exactly like line 3 was. The ledger/DECISIONS-INDEX triage stands. **(d) THE ~600-LINE BUDGET MEASURES THE WRONG QUANTITY** — my own OP-13 finding proved it: line 3 was **ONE line and ~1,400 tokens**. Lines are a bad proxy the moment prose enters the file. **Proposed OP-13 amendment: switch the budget to CHARACTERS (`wc -c` — as cheap as `wc -l`, doesn't lie about prose). David rules.** **(e)** `findDuplicateSizeGroups` is **still blind to blank-size rows** ([dupSize.ts:44](packages/shared/src/discovery/dupSize.ts#L44)) — reported, **deliberately not widened**; asserted as a KNOWN BLIND SPOT in the new suite so it is visible rather than assumed handled. Widening it would make a landmine visible on the grid BEFORE it blows. **(f)** The count's `create` branch **regroups blank-group rows including a blank-SIZE one**, which would put an unpickable row *into* a group — **unreachable today** (a stub is always alone in its family, and post-fix nothing can mint a size-less row), so **deliberately NOT guarded** per §6 r10's over-engineering trap. If #56's merge work touches this, revisit. **(g)** A **legacy size-less row with qty>0** (Alley Cat's, which David deleted by hand) can no longer be created but also cannot be *healed* by the count — it would be refused. **No live instance exists**; the regenerated remediation is where it belongs.

### 2026-07-16 — THUNDER §3 HANDOFF RETENTION (N=3): the trim PLUS the rule that makes it self-maintaining — the close-out protocol was manufacturing bloat faster than any trim removed it; OP-13 (proposed); 907 → 736 lines, 12 entries moved VERBATIM, ZERO lost; DOCS-ONLY — zero code/schema/migration/api-fn (12/12)

**Type:** Docs/process only — 5 files (`docs/operating-doctrine/end-of-session-protocol.md` NEW gate · `CLAUDE.md` line-3 header + §9 standing instruction + close-step 0 + §3 trim + §4 tick · `docs/handoff-archive.md` +12 entries · `docs/DECISIONS.md` OP-13 · `docs/DECISIONS-INDEX.md` OP row + drift line) + ledger #134 + bootstrap CAPTURE INDEX row. **ZERO app code, ZERO schema, ZERO migration, ZERO api-fn (12/12 untouched), ZERO `[TRACE:*]`** — no `.ts`/`.tsx` opened. `npm run verify` NOT run (no code changed; the gate is code-scoped). Decision **OP-13 (proposed)** — number **CONFIRMED, not guessed**: OP-1…OP-12 exist in `DECISIONS.md` headings AND the `DECISIONS-INDEX` table, so OP-13 is next. **BENCH: no trigger fires** (no payments/PII/webhooks/AI-calls/invoices/compliance-actions — roster matched, reported per §6 r10).

**THE PROBLEM — measured, not asserted.** CLAUDE.md was trimmed to 746 lines and measured **907** today: **+100 in one session**, and **+44 more on a build whose write-back was deliberately kept minimal** (that session resisted inventing a §4 task and it grew anyway). **Trimming to 600 buys about five sessions.** The close-out protocol — six standing instructions each demanding a write-back — manufactures the bloat faster than any trim removes it. **So a trim is a payment against a recurring cost, and the deliverable is NOT a trim: it is a trim PLUS a retention rule.** This is **AC-4** applied to the handoff (settle once, encode as a variable, stop re-deciding every session) and a partial delivery of §4 Housekeeping's existing unchecked *"Lean CLAUDE.md to rules + state + pointers only."*

**THE RULE (written BEFORE the trim, so the trim is its FIRST application, not a one-off):** **§3 holds the most recent THREE entries. At every close-out, BEFORE the new entry is written, any entry beyond the newest three is MOVED — verbatim, not summarized — to `docs/handoff-archive.md`, newest-first, under a dated provenance comment.** Nothing deleted, nothing condensed; append-and-preserve. **A close-out that writes a §3 entry without archiving the overflow is an INCOMPLETE task — same force as the built-inventory, close-out-ledger, and ⚡ ACTIVE STATUS gates.** Homed exactly as those siblings are: statement of force = `docs/operating-doctrine/end-of-session-protocol.md` → **GATE — CLAUDE.md §3 HANDOFF RETENTION** (matching the BUILT-INVENTORY gate's shape); pointer = a §9 STANDING INSTRUCTION; execution = **close-sequence step 0**.

**⚠️ STEP 0, NOT STEP 1 — a deliberate call, stated.** The rule fires BEFORE the handoff write, so it is numbered **0**. Inserting it as "1" would have renumbered steps 1–11, and **§1.6 item 9 cites "§9 gate 9"** while steps 10/11 cite "item 8"/"item 9" — renumbering would have silently broken four live cross-references to fix a formatting preference. Step 0 is both semantically correct and cross-reference-safe.

**KILLED THE DUPLICATE HEADER (STD-011 — and the finding the line-count metric HIDES).** Line 3's `# Last updated:` was a **~600-word prose block restating the newest §3 entry verbatim** — a SECOND representation of one fact, exactly the disease STD-011 names. **It is ONE physical line, so removing it saves ~1 line but ~1,400 tokens on every session load.** That is the honest catch: **line count is a PROXY, and the single worst offender was invisible to it.** Replaced with a one-line pointer + a standing warning line (`⚠️ THIS LINE IS A POINTER, NEVER A SUMMARY`) so it cannot regrow — the rule's second clause.

**APPLIED — NOTHING LOST, PROVEN BY SHA NOT BY ASSERTION.** 12 entries (D-48 `2026-07-16` → D-39 `2026-07-13`) moved to the archive. **Verified: the 201-line block extracted from CLAUDE.md hashed `564f09d6…`; the block removed hashed `564f09d6…`; `diff` = empty ⇒ byte-identical.** Entry arithmetic: **14 in §3 → 12 archived + 2 kept + 1 new = 3 in §3; 14 preserved, 0 lost.** Archive **167 → 179** entries (7,501 → 7,704 lines), newest-first, chronologically continuous (its newest was `2026-07-10`; §3's oldest was `2026-07-13` — **no gap, no overlap**). §3 now holds: this entry · **D-49** · **#55 apostrophe elide**.

**⚠️ THE RESULT, REPORTED HONESTLY — N=3 DOES NOT HIT 600.** **907 → 736 lines (−171). That is 136 OVER the ~600 budget, and it is a MISS.** N=3 was David's call and **no N was improvised to hit the number** — tuning the variable to flatter the metric would defeat the point of encoding it. **(⚠️ Own scar, same session, TWICE: this entry first stated **711** from arithmetic → the file measured **732**; corrected to 732 → the file then measured **736** (the §4 edit landed after the read). **Two consecutive predicted counts, both wrong.** The D-49 lesson — *"trust the catalog, never the arithmetic written down"* — bit the very entry that cites it, and bit it again on the correction. The rule is not "compute carefully," it is **measure last and quote the measurement**; every figure here is now `wc -l` output taken after the final edit.)** The residual is **structural, not handoff**: §3 is now **91 lines of 736**; the weight is §2's infra tables (~155), §6's ten coding rules (~45), §9's standing instructions (~55). **This gate stops the GROWTH; it does not by itself close the budget** — the rest is the separate, still-open §4 item *"Lean CLAUDE.md to rules + state + pointers only,"* which stays open and un-ticked apart from the one sub-item this closes. **The self-maintaining property is the win, not the number:** §3 can no longer grow past 3 entries, and the header can no longer regrow into a summary.

**CONSTRAINTS HELD:** **STD-005** (decisions recorded verbatim, not paraphrased — this is why the move is a byte-identical `diff`, not a re-write; and the stale §3 footer blockquote, which still described the retired "retains only the most-recent date-block" practice, was REPLACED cleanly rather than left contradicting the new rule) · **STD-011** (the header duplicate killed; one fact, one home) · **AC-4** (settle once, encode as N=3) · **§6 r10** (standard-by-value: a retention-N is the established doc-rotation pattern; adopted at the cheapest form that meets the need — no tooling, no automation, no lint rule, because the gate rides the close-out ritual that already exists) · **§1.6** — most items **N/A and stated as such** (2 hardcoded-register / 3 validation / 4 CRUD-permissions / 5 UI-modals / 6 AC-1..4 / 7 12-fn / 10 money-safety all N/A: no code, no schema, no UI, no endpoint, no money path); **applicable:** 1 STORY (docs/process infra — no user story required, same class as ledger #38/#46/#50, stated at STEP 0), 8 REUSE (the gate reuses the existing BUILT-INVENTORY gate shape + the §9 standing-instruction pattern — no new mechanism invented), 9 TRACE-STAYS-ON (nothing silenced; no `[TRACE:*]` touched).

**NO OWNER-PROVE OWED — and the reason is the point.** This is process scaffold, not a capability: there is no UI, no RLS path, no live behavior to exercise. **It proves itself on the NEXT close-out** — if the next session archives its overflow and leaves line 3 a pointer, the rule works; if §3 shows a 4th entry, the gate failed and that is visible at a glance. **The gate is its own test.**

**FLAGGED FOR DAVID (named, NOT built — all deliberately out of this bounded pass):** **(a) 🔴 `GEMINI.md` DOES NOT EXIST** — CLAUDE.md's line-4/header instruction *"Update GEMINI.md with the same changes if Gemini is in use"* points at a **dead file**. Not silently synced, not silently deleted; David decides whether to retire the instruction. **(b) THE SAME DISEASE IS IN THREE MORE HEADERS** — `docs/CLOSE-OUT-LEDGER.md`, `TRACE-SESSION-BOOTSTRAP.md`, and `docs/DECISIONS-INDEX.md` each open with a giant `Last updated:` prose block restating their newest row (the ledger's is ~400 words). **Same STD-011 violation, same token cost, same fix** — but they are NOT loaded every session, so the cost is far lower and it was out of scope here. The header-is-a-pointer clause could extend to them on David's call. **(c) OP-11 has no CAPTURE INDEX row** (OP-1/4/5/6/7/8/9/10/12 do; OP-2/3/11 don't) — noticed while adding OP-13's row, left alone as scope. **(d)** The §4 Doc Reorg block's other three items (PLATFORM_STRATEGY as sole architecture home · BUILT-INVENTORY pointers-not-inlines · single-source the philosophy block) remain **un-ticked and untouched** — the reorg is a separate build and stays there.

### 2026-07-16 — THUNDER D-49 THE COUNT FILLS THE STUB (tech-debt #57): counting a variety made it PERMANENTLY UNSCANNABLE — the #55 fix made a D-45 branch reachable that had never fired; ONE invariant, TWO branches; 103 of 112 scraped rows were landmines; BUILDER-COMPLETE, owner-proof owed; ZERO schema migration, ZERO api-fn (12/12), ONE gated data SQL

**Type:** App code — 2 NEW (`packages/shared/src/inventory/countPromote.ts` the PURE promote decision · `.../countPromote.test.ts` 40 assertions) + 2 EDIT (`packages/shared/src/inventory/index.ts` barrel · `packages/cultivar-os/src/pages/InventoryCount.tsx` repointed onto the decision + `filled`/`created` trail + SKU lineage + uniqueness guard) + 1 GATED SQL (`docs/decisions/2026-07-16-d49-stub-fold-remediation.sql` — data remediation, **NOT a schema migration**, David applies as postgres). **NO schema change** (size/variant_group/sku all exist — confirmed, none needed), **ZERO new `api/` file** (12/12, counted). `[TRACE:INVENTORY]`/`[TRACE:COUNT]`/`[TRACE:RESOLVE]` ON (extended, nothing silenced). `npm run verify` **exit 0 zero NET-NEW** (tsc 5 / eslint 248 / knip 10·14·15 == baseline); `build:cultivar` clean 7.34s. Tests: **countPromote 40/40** (new) · **canonicalName 34/34** (#55 unregressed) · **catalog-variants 31/31** · **populate 9/9**. Decision **D-49 (proposed)** (`docs/decisions/2026-07-16-count-fills-the-stub-D49.md`). Ledger row #133. **CLOSES tech-debt #57; RECORDS #56.**

**THE DEFECT (live, David's own trail — do NOT re-derive):** `[TRACE:RESOLVE] L4 name-token — bashams-party-pink-crape-myrtle → Basham's Party Pink Crape Myrtle ... siblings: 1` immediately followed by `[TRACE:INVENTORY] promote — created {size: '30 gal', qty: 25, rowId: e92aedb2-…}`. **It resolved to the existing row and then created a second one.** Inventory **114 → 118** on four scans. The RE-SCAN then returned **UNKNOWN** — two token-equal rows, one grouped + one not, one sized + one not → `detectSizeCollision` correctly refuses to guess. **NET: counting a variety makes it permanently unscannable**, self-inflicting, once per variety, on the walk-and-count loop the whole capability exists for.

**WHY IT FIRED NOW (the lesson):** **#55 made this branch REACHABLE for the first time.** Before the apostrophe elide those four varieties never resolved at L4 at all — they went straight to UNKNOWN and never reached the promote. **Fixing the resolver handed a working scan to a promote that had never been exercised on a size-less parent. A fix that unblocks a path is a fix that exposes that path's first real test.**

**THE ROOT:** `populate.ts` mints the scraped catalog under the D-9 honesty contract — `qty: 0` (never fabricate stock), `unit_cost: null`, and **no size at all** — because scrape-reads-variations was never built. **MEASURED LIVE (David, read-only): 119 rows · 103 stubs · 112 DISC- · 103 DISC- stubs · 5 ungrouped-sized. 108 of 119 rows would break on first count.** D-45's `(variety × size)` predicate never anticipated a size-**less** parent because nothing could resolve to one.

**WHY NOTHING CAUGHT IT:** the suite was green (catalog-variants 31/31, populate 9/9). **The promote decision lived inline in a React component's async handler — unreachable by any test.** And the grid's own dup detector `findDuplicateSizeGroups` is **BLIND to this class**: it skips any row with a blank size ([dupSize.ts:44](packages/shared/src/discovery/dupSize.ts#L44)), and the parent's size is blank — so the one surface built to surface this damage could not see it.

**THE FIX — ONE INVARIANT, STATED ONCE, GOVERNING BOTH BRANCHES:** *any path that mints a size-sibling must leave the family in a state where the size-picker fires **BY CONSTRUCTION** — a non-blank `variant_group` on EVERY row, a distinct non-empty size on EVERY row, and SKU lineage from the family's base.* That is exactly `detectSizeCollision`'s contract; violating it is not cosmetic — it is the UNKNOWN.
- **(1) STUB → FILL IN PLACE** (qty 0 + no size + no group). **D-49 ENFORCES D-34, it does not bend it:** the lot IS the SKU and qty is the COUNT, so a row with no size AND no stock AND no size-family **cannot be a lot** — there is nothing for it to be the lot OF. It is a variety list wearing a stock-line's clothes. If the stub cannot be a lot, the first real lot must BECOME it. The filled row keeps its `DISC-####` SKU + scrape lineage.
- **(2) UNGROUPED NON-STUB → CREATE **AND AUTO-GROUP THE PARENT** in the same pass** (5 live rows, e.g. Flip Side Vitex DISC-1104 qty 10 size 45 group NULL). **This is D-46's own rule (#126 — "auto-groups the parent if its group was null so the size-picker fires by construction") finally reaching the SECOND path that mints siblings** — `commitCount` backfilled `variant_group` on the **MATCH branch only**. Not a new rule; a convention that existed on one path and not the other (STD-011) — **the same disease as D-49's own root**.

**CREATE IS NOT THE DEFECT — CREATE-WHILE-LEAVING-THE-PARENT-UNGROUPED IS.** Proven by live data, not reasoning: `'Sierra' Mexican Red Oak` (groups BOTH set, sizes `["15","30 gal"]`, skus `[DISC-1001, NULL]`) and `Arizona Cypress Blue Ice` (`["15","30"]`, `[DISC-1005, NULL]`) were **minted by this SAME count-promote CREATE** — their siblings' `sku NULL` is that path's fingerprint — and **BOTH WORK**, because their parents already carried a group.

**STD-002 — RED FIRST, BOTH ARTIFACTS, HONEST:** to get a RED against the REAL defect (not a strawman) the CURRENT shipped logic was first ported verbatim into the new pure module → **`countPromote: 24 passed, 16 failed` (exit 1)**, every one of the four varieties failing `RE-SCAN RESOLVES`. Then the fix → **`40 passed, 0 failed` (exit 0)**. **No existing assertion was adjusted** — the 24 that passed in RED stayed green throughout. **The `'Sierra' UNREGRESSED` control PASSES EVEN IN RED** — it is a real control, not a rubber stamp.

**`detectSizeCollision` NOT TOUCHED** — refusing to guess between two same-name rows is **correct** and is what stopped a bad merge. The fix stops MANUFACTURING the ambiguous pair; it does not loosen the gate that catches it. The re-scan assertions call the **REAL shipped `detectSizeCollision`** against the simulated post-write family (the #55 lesson: verify against the real function, never the test's own copy).

**SKU LINEAGE (STD-011 drift, fixed this pass):** D-46 built `deriveSiblingSku` (#127) but **`InventoryCount` never imported it** — two paths minted a sibling, one derived the SKU, which is why David's four counted rows have no SKU. Repointed onto the SHARED helper. New `baseSkuOf` = **shortest non-blank SKU** in the family (a derived sibling is always its base + a suffix, so the base is always shortest — reaches past a sku-null sibling: `'Sierra'`'s 3rd size derives `DISC-1001-45G`, not from the NULL). Blank when no sibling has one (D-9 — never fabricate a base). **Uniqueness: a colliding derived SKU is OMITTED + logged loudly, never blocks the count** — the SKU is a convenience, the count is the point, and refusing a save mid-lot-walk is disproportionate; never a silent duplicate.

**⚠️ THE LIVE PROBE WAS BLOCKED — AND THAT WAS SURFACED, NOT GUESSED (STD-001).** `SUPABASE_SERVICE_KEY=""` is **empty in every local env file**; anon is correctly RLS-blocked on `business_inventory` (0 rows). **This is the #129 scar verbatim** ("the first diagnosis was WRONG — it trusted the stale live-schema-map because the service key pulled empty"). Thunder **refused to write the DELETE against unverified ids** and David ran the read-only query. **He was right to be asked: the prompt said 114→118, the catalog said 119→115** (a Vitex 45 gal added via D-46 after the prompt was written) — and the prompt's "~113 stubs" was an inference; **the measured number is 103**. Third consecutive time a prompt's row count was wrong (111→116 on #55). **Trust the catalog, never the arithmetic written down.**

**DATA REMEDIATION — ONE GATED SQL, 8 rows, 4 folds.** FOLD the child INTO the parent (the parent holds the SKU + the sell_price slot + the 2026-06-26 scrape lineage), do NOT delete the count. **ORDER IS LOAD-BEARING:** `inventory_counts.inventory_id` is **ON DELETE SET NULL** — delete the child first and the record of the count David just did silently loses its subject (no error, just an orphan). So: **REPOINT `inventory_counts` child→parent FIRST, then fold, then delete.** One transaction; **five guards (G1-G5)** abort the whole thing — wrong row count, ANY `order_items` reference (**proven zero, not assumed** — the FK is SET NULL, so a delete would silently blank a sales line rather than error), a parent that is no longer a stub, a child that is not the count-created sibling, a parent/child name mismatch. **Every value is COPIED FROM THE CHILD ROW, never retyped from a prompt.** `status` deliberately untouched (mirrors the code's `fill` branch exactly; a scrape-flagged `'review'` parent stays `'review'` — surfaced in the pre-flight, not silently "fixed"). **Expected 119 → 115 — but PART 0c/2E read the count from the catalog; do not trust the arithmetic.** **PART 3 is FENCED + commented-out + INDEPENDENT:** the SKU backfill for the two REAL size-siblings (`'Sierra'` 30 gal → `DISC-1001-30G`, `Arizona` 30 → `DISC-1005-30G`) — **DO NOT FOLD THEM, they are genuine second sizes under grouped parents and they work today**; matched BY PREDICATE (their ids weren't in the live read). Apply or skip; PART 1 neither depends on it nor is depended on.

**SCOPE HELD — the 103 stubs + 5 ungrouped rows get NO SQL.** They are not broken; the code fix makes their first count correct. Remediating them would be writing to 108 rows to fix nothing.

**CONSTRAINTS HELD:** STD-011 (ONE stub predicate `isVarietyStub` — never re-spelled inline; ONE `deriveSiblingSku`; ONE `sameSizeLabel` — the local `sameSize` copy RETIRED) · STD-002 (RED→GREEN artifacts) · STD-017 (all 6 surfaces enumerated; the fix is in the ONE shared decision so all inherit) · STD-018 · D-9 (no fabricated SKU/price/base) · AC-1 (stub-ness derived from DATA — no CHECK, no enum) · AC-3 (tenant-scoped; the SQL guards on `business_id`) · §6 r8 · §6 r11 (12/12 api-fn, counted, none minted).

**OWNER-PROVEN owed (David, live):** **(0)** apply `2026-07-16-d49-stub-fold-remediation.sql` as postgres — PART 0 read-only FIRST, then PART 1, then PART 2 verify (A–E). **(1)** Count a STUB variety (any of the 103) → **ONE row**, filled, **SKU intact**, `[TRACE:INVENTORY] promote — filled` in the trail. **(2) RE-SCAN the same slug → RESOLVES** (the defect that motivated D-49 — it must NOT go UNKNOWN). **(3)** Add a SECOND size to it → a real sibling, SKU `DISC-####-NNG`, **size-picker fires with both**. **(4)** Count a second size on an UNGROUPED-SIZED row (Flip Side Vitex DISC-1104) → sibling created AND `promote — auto-grouped parent` in the trail → re-scan fires the picker. **(5)** `'Sierra' Mexican Red Oak` **UNREGRESSED** — both sizes resolve, picker still fires. **(6)** Vitex control unchanged. `[TRACE:*]` stays ON until owner-proven. ⚠️ **DEPLOYED bar FIRST (§9 — committed ≠ live):** the signal **ONLY this build emits is `[TRACE:INVENTORY] promote — filled`**. **If a stub count still logs `promote — created`, you are testing OLD code — hard-refresh, confirm the Vercel deploy is READY and the bundle hash changed, and do NOT declare pass/fail** (the #128/#129 stale-cached-bundle scar).

**FLAGGED FOR DAVID (named, NOT built):** **(a)** **tech-debt #56 — SIZE VOCABULARY, the next defect in this family** (David's own catch): `sameSizeLabel` is exact string equality and the catalog **already** carries mixed vocabulary (`'Sierra'` live with `["15","30 gal"]`) → counting "15 gal" against a "15" row mints a THIRD row, splitting on-hand across two spellings of one physical size. D-45 did this for NAMES; nobody did it for SIZES; `normalizeSize` exists in the scrape parser, not on the count path — **the same one-path-not-the-other disease as D-49's own root**. Its own build: unlike D-49 it can **MERGE** existing rows, so it needs a read-only blast-radius probe first. **(b)** `findDuplicateSizeGroups` is blind to the mixed-group/missing-size class — widening it would make a landmine visible on the grid BEFORE it blows. **(c)** `populate.ts` still mints size-less stubs; the durable fix is scrape-reads-variations (a WRITE path over the whole catalog — its own build). **(d) ⚠️ `.env.prod.local` points `VITE_SUPABASE_URL` at `ufsgqckbxdtwviqjjtos`** — the OLD Ignition project (§7 **Off Limits**). Any local script run against that file targets the wrong project; it is inert **only because the project is now ENOTFOUND**. `.env.vercel.pulled` carries the correct `bgobkjcopcxusjsetfob`. **David decides** — but a §7-off-limits project as a local default is a loaded gun. **(e) row-count discrepancy:** the #55 probe read **116** this morning; the app's `[TRACE:invsheet] load ok` reported **114** at the same point. A 2-row gap — likely `BusinessInventory` filtering a status the probe doesn't. **A probe and a page that disagree on row count will produce a false alarm on the next sweep.** **(f)** ledger #74's dup-size dead-end: **the DESTINATION is now CONFIRMED LIVE, but CASE 5 itself is not** — #74's case is *same group, same size* (fails the all-distinct check); this was *mixed group, missing size* (fails the group-shared + size-present checks). **Same dead end, different gate, different road.** #74 called it theoretical; it isn't — it just arrived by a road nobody was watching.

> **§3 RETENTION — N=3 (binding; OP-13).** §3 holds the **most recent THREE entries**, no more. At every close-out, **BEFORE** writing the new entry, move every entry beyond the newest three — **verbatim, never summarized** — to [docs/handoff-archive.md](docs/handoff-archive.md) (newest-first, under a dated provenance comment). The new entry is #1. Nothing is deleted or condensed; the archive is append-and-preserve and is **NOT loaded at session start** — it holds the full history (180 entries as of 2026-07-16). Verification is arithmetic: **entries-in == entries-out**. Canonical "is X closed / owner-proof owed" state does NOT live here — it lives in `docs/CLOSE-OUT-LEDGER.md`, `docs/DECISIONS-INDEX.md`, and `docs/built-inventory.md`, each with its own gate. §3 is the narrative of the last three sessions; it was never the system of record. Full statement of force: `docs/operating-doctrine/end-of-session-protocol.md` → **GATE — CLAUDE.md §3 HANDOFF RETENTION**; close sequence step 0 (§9).

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
- [~] Lean CLAUDE.md to rules + state + pointers only — no architecture prose duplicated here
      **PARTIAL 2026-07-16 (ledger #134, OP-13) — the two self-maintaining sub-items are DONE; the rest stays open:**
      - [x] **§3 HANDOFF is state, retained at N=3** — overflow moves verbatim to `docs/handoff-archive.md` every close-out (binding gate, §9 step 0). §3 can no longer grow past 3 entries.
      - [x] **Line-3 header is a POINTER, not a summary** — the ~600-word prose block restating §3 (a STD-011 duplicate costing ~1,400 tokens/session while hiding from the line count as ONE physical line) is dead and gated against regrowth.
      - [ ] **STILL OPEN — the structural residual.** 907 → 736 (OP-13); the weight is §2's infra tables (~155 — Supabase/Vercel/env/domain/folder-map detail that belongs in a pointed-to doc), §6's coding rules (~45), §9's standing instructions (~55). This is prose that should be POINTERS. Its own build.
      - [ ] **PROPOSED OP-13 AMENDMENT (2026-07-16, ledger #135) — the budget measures the WRONG QUANTITY.** OP-13's own finding proves it: line 3 was **ONE line and ~1,400 tokens**, i.e. the single worst offender was **invisible to the metric**. Lines are a bad proxy for context cost the moment prose enters the file. **Switch the budget to CHARACTERS (`wc -c` — as cheap as `wc -l`, and it doesn't lie about prose).** David rules.
      - [ ] **`TRACE-SESSION-BOOTSTRAP.md` has the same duplicate-header disease and IS loaded every session** (§10 opens it FIRST) — tech-debt #59. OP-13's triage wrongly grouped it with the not-loaded-every-session docs.
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

**STANDING INSTRUCTION (owner, do NOT cross without David):** TRACE instrumentation `[TRACE:*]` is ON by OWNER instruction — do NOT comment out or delete any emit until David explicitly lifts it. This OVERRIDES the STD-003 post-OWNER-PROVEN comment-out default. Applies to `[TRACE:COST]`, `[TRACE:SEAM]`, `[TRACE:opcosts]`, `[TRACE:PROJECTLENS]`, `[TRACE:ROLECFG]`, `[TRACE:HEADER]`, `[TRACE:NAV]`, `[TRACE:customers]`, **`[TRACE:INVENTORY]` / `[TRACE:COUNT]` / `[TRACE:RESOLVE]`** (the walk-and-count + resolver trail — load-bearing for the D-45/D-46/D-49 owner-proves; `promote — filled|created|auto-grouped parent` is the D-49 DEPLOYED-bar signal), and any new area.

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

**STANDING INSTRUCTION (§3 HANDOFF retention — N=3, binding — same force as the reconciliation gates above):** **§3 HANDOFF holds the most recent THREE session entries.** At every close-out, BEFORE writing the new entry, any entry beyond the newest three is **MOVED — verbatim, not summarized — to `docs/handoff-archive.md`**, newest-first, under a dated provenance comment. Nothing is deleted; nothing is condensed; the archive is append-and-preserve and is NOT loaded at session start. The new entry counts as **entry #1** — the rule applies to itself. Verification is arithmetic: **entries-in == entries-out**, stated in the write-back. **Second clause: CLAUDE.md's line-3 `# Last updated:` header is a ONE-LINE POINTER (date + short title + "see §3") — NEVER a summary of the newest entry.** A prose header restating §3 is a second representation of one fact (**STD-011**), and being a single physical line it hides from the line-count metric while costing ~1,400 tokens on every session load. **A close-out that writes a §3 entry without archiving the overflow — or that regrows the header into a summary — is an INCOMPLETE task**, same force as the built-inventory, close-out-ledger, and ⚡ ACTIVE STATUS gates. WHY: CLAUDE.md is loaded EVERY session, so its size is a tax paid before any work begins; measured 2026-07-16 it was **907 lines** against its own ~600 budget, having grown ~100 in ONE session — **the close-out protocol manufactures bloat faster than any trim removes it**, so a trim without a retention rule buys ~5 sessions. This is AC-4 applied to the handoff: settle once, encode as a variable (N=3), stop re-deciding. **N=3 alone does NOT close the ~600 budget** (it lands ~700); the residual is the separate, still-open §4 item *"Lean CLAUDE.md to rules + state + pointers only."* Do not tune N to hit a number — N is David's call. Full statement of force: `docs/operating-doctrine/end-of-session-protocol.md` → **GATE — CLAUDE.md §3 HANDOFF RETENTION**. (Operating principle: **OP-13**.)

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
0. **ARCHIVE THE §3 OVERFLOW — BEFORE step 1 (N=3; see the STANDING INSTRUCTION above).** Move every §3 entry beyond the newest three — **verbatim** — to `docs/handoff-archive.md`, newest-first, under a dated provenance comment. Then write this session's entry; it is #1. Confirm **entries-in == entries-out** in the write-back, and confirm line 3 is still a one-line POINTER, not a summary. (Numbered 0 because it fires BEFORE the handoff write — the steps below keep their existing numbers, which other gates cross-reference.)
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
