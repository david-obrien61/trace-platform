# CLAUDE.md — TRACE Platform
# Multi-AI Handoff Workflow — Claude Code reads this every session
# Last updated: 2026-07-22 — ONE SELLABLE PREDICATE: the picker CAPS, not just displays; status stops offering derived values; `reserved` retired (ledger #147; 7 cards; #66 still open). See §3 for the current handoff; `docs/handoff-archive.md` for full history.
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

Before ANY build spec is fired, reconcile it against these 11 items, **scoped to the files the
build touches** (reconcile what you touch, not the whole platform). The rule is **fix-all-in-one-pass**
— a gap found in a touched surface is fixed in THIS build, not deferred to a gap board. **Not
reconciled = not ready to fire.** This gate is part of STEP 0: a spec that hasn't cleared all 11 for
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
11. **OWNER-TEST COVERAGE (OP-14)** — every surface this build ADDS, CHANGES, or POLISHES has a matching card in its standing test (`docs/owner-tests/<capability>-full-surface-test.md`, rendered by `owner-tests.html`): add it, update it, or mark it `STATUS: needs-test` **with a reason**. **Changing a surface flips its card `covered` → `owed`** (a green check on a moved surface asserts a proof nobody performed). **Thunder never marks a card `covered`** — only David's live run does. A per-build proof is a FILTER (`COVERS: #NNN`), never a second doc. `DEVICE: phone` cards must be provable **without a console**. (§9 standing instruction; full force: `docs/operating-doctrine/end-of-session-protocol.md` → **GATE — OWNER-TEST COVERAGE**.)

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

Active open items: #2 (QB hardcode), #3 (social in cultivar), #4 (nursery footer), #8 (RLS unverified), #10 (SavingsReport missing), #12 (Ignition AI dark / Railway kill path), #13 (stub duplication), #16 (MarginEngine orphaned — A callers + plants.cost_price), #17 (dead migration), #18 (pin_hash unverified), #19 (instagram fallback), #20 (platform union), #21 (orphaned campaigns files), #22 (platform_check migration — David must apply), #23 (STD-008 inverse sweep pending), #24 (opaque names), #25 (6 AI features dark), #26 (orphaned DataBridge keys), #27 (10 tables no migrations), #28 (pilot_all RLS open), #29 (receipts naming), #30 (voice-samples RLS scope), #31 (catalog-verify process), #32 (cultivar_plants anon read open), #33 (widget-header backfill), #57 ✅ resolved 2026-07-16 (COUNTING A VARIETY MADE IT UNSCANNABLE — the count-promote created a 2nd row beside a size-less scraped parent (114→118 on four scans) and the re-scan then went UNKNOWN; **103 of 112 scraped rows are stubs**, every one a landmine awaiting its first count. #55 made the branch reachable for the first time. FIXED by D-49's ONE invariant — any path that mints a sibling leaves the family picker-ready by construction: a counted STUB is FILLED in place (D-34 — no size + no stock ≠ a lot), an UNGROUPED NON-STUB creates a real sibling AND auto-groups the parent (D-46's rule #126 reaching the path that skipped it). Decision extracted PURE to `countPromote.ts`; RED-first 24/16-fail → 40/0; `detectSizeCollision` untouched. Ledger #133, owner-proof owed) · #59 🟡 NEW 2026-07-16 (`TRACE-SESSION-BOOTSTRAP.md`'s header carries the **STD-011 duplicate-header disease AND IS LOADED EVERY SESSION** — §10's Session Starter opens it FIRST, so its `Last updated:` prose block is a per-session token tax exactly like CLAUDE.md line 3 was. **OP-13's own triage put it with the ledger/DECISIONS-INDEX as "not loaded every session" — that was WRONG for this one**; the triage stands for the other two. The header-is-a-POINTER clause should extend to it — David's call. Ledger #135) · #58 🟡 NEW 2026-07-16 (**the DB-level guard for the (variant_group, size) pair** — the durable form of ledger #135's defect 2: a partial unique index `(business_id, variant_group, size) WHERE variant_group IS NOT NULL AND size IS NOT NULL`. This is **ledger #74's deferred option C**. It is a MIGRATION and **it would REJECT the live Acoma dup, so it cannot land until the data is clean** (i.e. after the regenerated remediation). The code guard `findSizeTwin` is proportionate at a single-owner nursery's volume. **Sibling of #54** — the `qb_customer_id` partial unique index, named-not-taken on the same reasoning) · #56 🟡 (SIZE VOCABULARY not normalized on the count path — **the last live defect of the D-49/#135 family**; `findSizeTwin`/`sameSizeLabel` are exact equality and the catalog carries SIX spellings of THREE sizes (`15`/`30`/`45`/`5 gal`/`30 gal`/`45 gal`), incl. on **'Sierra', a DEMO variety**. Unlike #135's four, it can **MERGE existing rows** → needs a read-only blast-radius probe first — `'Sierra'` is live with `["15","30 gal"]`, so counting "15 gal" against the "15" row mints a THIRD row: two spellings of one physical size, on-hand split across both. D-45 did this for NAMES, nobody did it for SIZES. The next defect in the D-49 family — its own blast radius: unlike D-49 it can MERGE existing rows) · #34 ✅ resolved 2026-06-19 (qbo/status+auth-url 500 → router.ts:15 import depth 4x→3x, commit 14a9a82; esbuild-proven) · #35 ✅ resolved 2026-06-15 (nursery_profiles 406 → maybeSingle) · #36 (/assets + /pmi nav-dead) · #37 (PMI UI polish pass) · #38 (frictionless multi-channel cost capture — NEXT MAJOR BUILD after Core-2b; capture≠classification, hard-blocked on Core-2b sameCost dedup) · #39 (live schema not in version control — orders/customers/order_items + qb/leakage/netting cols live-only) · #40 (built-inventory flag correction — 5.1 inventory / 5.2 PMI are resolved, not ⚪) · #41 (Vercel Hobby 12-function ceiling — `api/` at limit; new functions silently fail deploy; mitigated by folding deliveries→customers; upgrade to Pro before next module wave) · #55 ✅ resolved 2026-07-16 (canonicalName APOSTROPHE DEFECT — possessive varieties FALSE-UNKNOWN on scan; **4 of 6 apostrophe varieties were BROKEN in live data**: Basham's Party Pink Crape Myrtle · Evey's Pride Mimosa · Summer's Tower Redbud · Hearts A'fire Redbud, all `variant_group` NULL, never counted. Wrapping quotes survived (`'Sierra'`→{sierra}) — which is why it hid — but possessives didn't (`Basham's`→{basham} vs slug {bashams} — the 1-char filter ate the `s`). FIXED by the elide-don't-split rule `personName.ts` proved in D-47, applied BEFORE the boundary split (order IS the fix); 5 apostrophe codepoints handled; RED-first per STD-002 (21/4 fail → 34/0 pass); blast radius probed live read-only = 4 token sets change, 0 groupings moved. Ledger #132, owner-proof owed) · #54 🟡 (qb_customer_id collision guard is code-level/TOCTOU — durable form is a partial unique index `(business_id, qb_customer_id) WHERE NOT NULL`; a MIGRATION; theoretical at zero links, needed before real billing volume) · #53 ✅ resolved 2026-07-16 (QBO customer find-or-create matched on EMAIL ALONE → cross-billed NINE real invoices to "Andrew O'Brien" over two months; fixed by the D-47 three-way rule — match on the field QBO guarantees unique (DisplayName), two fields must concur, ambiguity → CREATE/SURFACE never a guessed link, stored links verified-before-use; blast radius ZERO; owner-proof owed) · #42 ✅ resolved 2026-06-21 (seed.ts D-9 silent coercion — `classifyCategory` flags unknown instead of masquerading as 'addon'; price 0 → explicit flagged non-null placeholder; residual: nullable price needs a `service_offerings` ALTER) · #60 🟡 NEW 2026-07-17 (**DEPLOY-VERIFICATION GAP — Vercel deploys the TREE not the COMMIT, and nothing between push and test confirms the build SUCCEEDED.** `313de44` (#135) never deployed — its Vercel build FAILED after clone — and #135 went live ~20h later only as a side effect of pushing the #137 markdown (`77ffd8e` carries it; merge-base CONFIRMED). One layer deeper than #128/#129: "the bundle can't be stale if it was never built." **✅ RULE RATIFIED 2026-07-17 → OP-15** (owner-prove STEP ZERO = confirm the deploy for THIS SHA is READY, before hard-refresh; homed PRIMARY on the owner-test board's GATE 0 where David stands, per row-19B). **Mechanical SHA-STAMP SHIPPED 2026-07-20 (ledger #141) — BUILDER-COMPLETE, owner-prove OWED, so this row stays 🟡:** vite `define` → `__COMMIT_SHA__` (7 chars, `'dev'` off-Vercel) → DebugPanel footer; GATE 0 ① is now "does the app say the SHA I pushed?" **Closes only on David's live match** — a stamp nobody has read is a claim, and a wrong one would silently un-verify every future GATE 0) · #61 🟡 NEW 2026-07-17 (**`countPromote.ts:24` comment is FALSE** — asserts scrape-reads-variations "never built"; `fetchProductVariants`/`extractSizeVariants` EXIST + wired (added 06-28/06-30). A comment contradicting its repo fed two days of wrong reasoning. Comment-only fix) · #62 🟡 NEW 2026-07-17 (**DataSheet viewport standard DRIFTED, one item both halves** — h-scrollbar anchored to table-content bottom not a fixed-height viewport (123 rows down at 123 rows); AND sell-price/conf columns past the RIGHT fold, the sell-decision column cut off on the "board 5.1 reconcile surface." A set convention drifted, not a missing pixel; inventory is the first DataSheet consumer long enough to surface it. Recon: is the viewport in `DataSheet.tsx` or per-page — do assets/customers pin while inventory doesn't?) · #70 🟡 NEW 2026-07-22 (**GENESIS `opening_balance` ROWS CARRY A SYNTHETIC `occurred_at`** — the D-50 backfill dates them at MIGRATION-APPLY TIME (`20260720…:360`, `now()`), not the lot's origin, so ~126 rows carry a timestamp describing *when we adopted the ledger*, not when anything happened. Produced the 2026-07-22 reconcile defect: for a lot last counted before 2026-07-20 the genesis row fell INSIDE the window and replayed as fresh arrival (prior 60 + genesis 60 = 120 vs book 60 — an apparent *exact doubling* from ONE read). **FIXED at the consumer** (`isMovement()` excludes position-assertions — independently correct, not a date patch) **but the hazard is in the DATA** for the next time-windowed reader. Re-dating is **REJECTED** — an UPDATE on an append-only table whose trigger rejects even `postgres`. Ledger #146) · #67 🟡 NEW 2026-07-21 (**BLIND CAPTURE IS THE MISSING HALF OF RECONCILE — and it is one of the D-50 story's own two OPEN build inputs.** `InventoryCount.tsx:438` calls `count_reconcile_inventory` **at capture**, so the phone count APPLIES ITSELF: by the time the desk reconcile screen opens, book == counted and the residual is **0 by construction**. The new DELTA mode is real for movements landing **after** a count, but it is **not** the count-then-review loop the story describes (*"the owner reviews the walk as a unit"*). `blind_capture_mode` — phone records to `inventory_counts` WITHOUT moving qty, desk becomes the applier — is named in that story's `PIECES:` and left as **BUILD INPUT (2), explicitly owed to David**. A CAPTURE-path change, deliberately not taken in the reconcile build. Ledger #145) · #68 🟡 NEW 2026-07-21 (**RECONCILE IS NOT SESSION-SCOPED — the spec asked and it is honestly not built.** Works per-lot across the catalog instead. Blocked by #67 (a session view would render a screen of "agrees — done" proving nothing) AND `inventory_count_sessions.status` already has ONE owner in `InventoryCount.tsx` — a second writer of one lifecycle field is the STD-011 drift we keep paying for. Lands WITH blind capture, as one build. Ledger #145) · #69 🟡 NEW 2026-07-21 (**A MULTI-STEP ACCEPT CAN PARTIALLY LAND, AND APPEND-ONLY MEANS NO ROLLBACK.** An attributed reconcile issues 2-4 sequential RPCs; each is atomic, **the sequence is not**. Mitigated not fixed: the UI names the step it stopped at and says earlier rows are already permanent, and the closing step lands ABSOLUTELY on `counted` so a *successful* run self-corrects against concurrent sales. Durable fix = ONE RPC taking the whole plan as `jsonb` in one plpgsql transaction — a MIGRATION. Sibling in shape to #54/#58. Ledger #145) · #63 🟡 NEW 2026-07-17 (**THE CAPTURE INDEX HAS NO GATE** — every other canonical surface has a reconciliation gate; the 📚 retrieval index is maintained by a step-6 REMINDER, and a reminder rots (row-19B). Found because David asked Lightning its humor style and it said "not encoded anywhere" — it was OP-2, canonical since 2026-06-03, absent only for lack of an index row. Sweep filled 21 missing rows (0 stale). Through-line: **the artifact does not carry its own provenance.** NOT an OP — named, numbered, left to earn a gate)

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

### 2026-07-22 — THUNDER ONE SELLABLE PREDICATE: the checkout picker **CAPS** instead of merely displaying the right number, and the status control **stops offering values it does not own**. BUILDER-COMPLETE; owner-prove OWED (7 cards). Zero schema, zero migration, 12/12.

**Type:** App code — **1 EDIT (the new home)** `src/lib/inventoryStates.ts` + **1 NEW test** `src/lib/sellable.test.ts` (**21/0**) + **5 EDIT** (`src/pages/ScanOrder.tsx` · `src/pages/PlantProfile.tsx` · `src/pages/BusinessInventory.tsx` · `src/components/inventory/InventoryEditor.tsx` · `src/pages/InventoryReconcile.tsx` · `src/types/plant.ts`). Docs: ledger **#147** · owner-test board (**NEW `## SURFACE: sellability`, 7 cards — 6 `owed`, 1 `needs-test`**) · `built-inventory.md` · `DECISIONS-INDEX.md` drift line · `TRACE-SESSION-BOOTSTRAP.md` ⚡ · this §3 + line 3. **§3 RETENTION: 1 archived verbatim (D-50 BUILD 2B), 1 written — entries-in == entries-out, §3 back to 3.** **NO new decision** (implements D-42/D-52/D-9). **BENCH: no trigger fires.**

**⚠️ TWO THINGS THE PROMPT ASSUMED THAT DO NOT EXIST — reported rather than invented.** The spec named "the grid 'needs-price'" and "the register" among the inline sellability sites. **Neither is a gate.** "needs-price" appears only as two COMMENTS in `InventoryCount.tsx` and as a display-only string in `CartReview.tsx:360`; the only "register" in the codebase is `tileRegistry.ts`, which is nav/tiles and unrelated. The real inline set was **FOUR** sites: the server guard in `submit.ts` (correct, kept), `PlantProfile.tsx:80` (status-only — no price, no committed), the scan review sheet (**no check at all**), and `CartReview` (display only). Saying so matters because a fabricated fifth site would have been "consolidated" into the predicate and quietly changed behavior nobody asked about.

**THE VERDICT CARRIES ITS OWN SENTENCE, AND THAT IS THE DESIGN.** `checkSellable()` returns not just *whether* but *why*, in the words the owner reads. Had it returned a bare boolean, every call site would have written its own "why not" copy — which is **precisely** how one lot came to read *"29 available"* on the picker and *"AVAILABLE 0"* on the grid. One function decides AND explains, so the reason shown is the reason applied. **Order of checks is order of USEFULNESS, not of cost:** condition → price → quantity. A DAMAGED lot holding 50 is not a quantity problem, so calling it "0 available" would be **true and useless**; it says *"Marked damaged — clear the condition in Inventory before selling it."*

**DISPLAY WAS FIXED LAST BUILD; THIS ONE FIXES THE CAP.** DISC-1105 correctly *showed* "0 available (29 on hand, 57 committed)" and **still added to the cart** — the refusal arriving five screens later at review. Now the Add button is **disabled with the reason shown**, the stepper is hidden when nothing is sellable and **greys at the cap** when something is, and the picker sub-line names the blocking reason so a pick never leads straight into a dead end. **Units already in this cart count as committed** — without that, a 10-lot scanned twice built a 20-line and waited for the server. **The server guard in `submit.ts` is untouched and stays:** a UI cap is a *courtesy* that saves five screens; it is never the authority, because a client can be stale, offline, or bypassed.

**STATUS STOPS PRETENDING.** The old list mixed two incompatible things: DERIVED (`available`/`depleted` — computed from qty per D-42) and MANUAL conditions (`damaged`/`returned`/`archived`). David proved the consequence live — he set `depleted` by hand on a lot holding 29 and it **still sold**, correctly, because the next qty write recomputes it. **A control that appears to do something and does not is a fake surface (D-9).** The dropdown now offers `available (derived from qty)` — labelled with what that row's qty actually implies — plus the three real conditions. **The derived option CLEARS a condition**, so `damaged` is not a one-way door. Both editing surfaces (grid cell + editor sheet) draw options, displayed value, and save-resolution from ONE helper, so they cannot offer different vocabularies — which is how `reserved` survived in one list after D-52 retired the concept.

**`reserved` IS GONE, AND I CHECKED BEFORE REMOVING IT.** Nothing reads `status = 'reserved'` as a condition anywhere — verified across app code, api, and SQL. The only references were a type-union member, two dropdown lists, and the SQL derive-guard `WHEN status IN ('available','depleted','reserved')`, which *permits* overwrite and therefore converts any surviving row on its next qty write. **No migration is needed**, and that is not an assumption: `status` is plain text with **NO CHECK constraint** (AC-1, stated in the migration), so narrowing the vocabulary is a UI change. **⚠️ Worth a live check anyway:** if any row currently holds `'reserved'`, it will show in the grid but sit outside the filter list until its next qty write normalizes it.

**PROOFS.** `npm run verify` exit 0, **zero net-new** (tsc 5/5 · eslint 248 · knip 10/14/15) — red first, correctly: knip flagged 1 export + 2 types as unused, all genuinely module-internal, **made private rather than re-baselined** (the D-52 `holdsCommitment` precedent, third time). `build:cultivar` exit 0. Tests **21/0** new + **55/0** existing.

**FLAGGED FOR DAVID:** **(a)** the 7 cards — sharpest are **DISC-1105 cannot be ADDED**, **a DAMAGED lot is refused everywhere and described as a CONDITION**, **DISC-1104 still sells normally** (a guard that blocks good sales is worse than the bug it fixed), and **the server refusal still fires**. **(b)** **⚠️ #66 REMAINS OPEN and is the one `needs-test` card.** The anon QR page passes `committed: 0` — **not a claim that nothing is committed, an admission that it cannot know** (`order_items` RLS is `authenticated_*`). Copy is softened to **"in stock"** (on-hand — the honest word) and the cap is at on-hand, but a fully-committed lot **will still let an anonymous customer build a cart**; the server refuses at submit, so it is a late-refusal UX gap, not an oversell hole. **PROPOSED, NOT BUILT** (it is a migration and this build ships none): `SECURITY DEFINER public.lot_available(uuid) RETURNS int`, GRANTed to `anon`, returning **only the derived integer** — no order rows, no customer data — closing #66 without widening `order_items` RLS and without a new api function. **Your call.** **(c)** the live `'reserved'` row check above. **(d)** #67 (blind capture) still your open build input; #56/#59/#60/#61/#62/#63/#64/#65/#68/#69/#70 unchanged.

### 2026-07-22 — THUNDER 2B DEFECT FIX: the reconcile replay counted a **POSITION** as a **MOVEMENT**. **The reported diagnosis was wrong, and saying so is the point of this entry.** Also: the checkout picker showed on-hand wearing the word "available". BUILDER-COMPLETE; owner-prove OWED (2 cards). Zero schema, zero migration, 12/12.

**Type:** App code — **3 EDIT** (`src/lib/reconcileMath.ts` · `src/lib/reconcileMath.test.ts` **55/0, 7 new** · `src/pages/ScanOrder.tsx`). Docs: ledger **#146** · owner-test board (**2 NEW cards** under `## SURFACE: reconcile`) · `tech-debt-log.md` **#70 NEW** · `DECISIONS-INDEX.md` drift line · `TRACE-SESSION-BOOTSTRAP.md` ⚡ · this §3 + line 3. **§3 RETENTION: 1 archived verbatim (D-50 LAYER 2A-2), 1 written — entries-in == entries-out, §3 back to 3.** **NO new decision.** **BENCH: no trigger fires.**

**⚠️ THE HYPOTHESIS WAS WRONG, AND THE REAL CAUSE IS MORE INTERESTING.** The prompt's diagnosis — *"the replay sums BOTH the raw table AND the D-51 read-view, so every row is counted once from each source"* — is **not what is happening.** There is exactly **ONE** read, of `business_inventory_ledger`, at `InventoryReconcile.tsx:182`; no view, no union, no join. Reported as instructed rather than forced to fit.

**The actual cause:** the D-50 **genesis backfill dates every `opening_balance` at `now()`** — `20260720_inventory_movement_ledger.sql:360`, i.e. **migration-apply time (2026-07-20), not the lot's origin.** So for any lot last counted BEFORE that date, the genesis row falls **inside** the since-that-count window and is replayed as if the stock had just arrived: `prior 60 + genesis 60 = 120` against a book of 60. **It reads as a clean 2× only because genesis `delta = bi.qty` = current on-hand, which on a lot untouched since its last count IS `prior.counted_qty`.** Two different numbers that happen to be equal — which is precisely how a doubling *illusion* gets manufactured out of a single read, and why "exact doubling ⇒ read twice" was such a reasonable inference. The numbers reconcile exactly: true replay **58** (opening +60, count_reconcile −2), and **120** is `60 + 60`, not `2 × 60`.

**THE FIX IS A DISTINCTION, NOT A DATE PATCH.** `isMovement()` now lives in the PURE module: an `opening_balance` **asserts a position** ("this lot stood at N when the ledger adopted it"); it does not **record a change**. Replaying a position on top of a count that already reflects it adds the entire stock twice. The filter is applied **once**, feeding BOTH the arithmetic and the evidence strip — so the number the owner is asked to explain and the movements shown as its explanation can never disagree (STD-011). **Correct in every case, not just for the synthetic date:** a genesis row older than the window is already date-excluded, and a lot born after adoption gets a ZERO-delta `opening_balance` (`:798`; a promoted lot with real stock is written as `count_reconcile`, `:584`). It never discards a real quantity.

**MUTATION-PROVEN, against the live numbers.** Reverting the filter reproduces the reported figures exactly — replay 120 vs book 60, and the 58 case — failing 5 assertions. The regression test is written from David's own SQL (lot `3ec53db3`, 2 rows, SUM 58), so the check is against the database's answer, not mine.

**SECOND FIX — SAME CLASS, WHICH IS WHY IT SHIPPED HERE.** `ScanOrder.tsx:237,275` read raw `row.qty` and labelled it **"available"**: DISC-1105 printed *"29 available"* while `/inventory` showed **AVAILABLE 0** (29 on hand, 57 committed). Both sites now route through the SAME D-52 derivation the grid and the oversell guard use (`availableFrom` over `fetchCommittedByLot`) — one definition, no drift. **Both numbers are named when units are committed** (*"0 available (29 on hand, 57 committed)"*), for the same reason D-52's refusal copy does: a bare "0 available" against a lot the owner can see holding 29 reads as a bug, not a rule. **A picker that offers stock the server will refuse teaches the owner to distrust the refusal, not the picker.**

**⚠️ A THIRD SITE WAS FOUND AND DELIBERATELY NOT FIXED.** The grep turned up `PlantProfile.tsx:52` — the **anonymous QR page** — also printing `{c.qty} available`. That is **tech-debt #66**, and it is structural: `order_items` RLS is `authenticated_*`, so an anon customer **cannot derive committed**. Applying the same fix would silently return `committed = 0` and render the **identical wrong number while looking corrected** — worse than leaving it, because it would retire the debt without paying it. Still David's call (server-side derived read, minding 12/12 · or soften the copy to "in stock").

**PROOFS.** `npm run verify` exit 0, **zero net-new** (tsc 5/5 · eslint 248 · knip 10/14/15). `build:cultivar` exit 0. Tests **55/0**.

**FLAGGED FOR DAVID:** **(a)** the 2 cards — lot `3ec53db3` must replay to **58** with the mismatch line ABSENT; the DISC-1105 picker must read **0 available (29 on hand, 57 committed)**. **(b)** **#70 NEW** — the genesis rows' synthetic `occurred_at` is fixed at the consumer, but the hazard stays in the DATA for the next time-windowed reader. Re-dating them is **rejected outright**: that is an UPDATE on an append-only table whose trigger rejects it even for `postgres`, and we do not break that guarantee to tidy a timestamp. **(c)** your WRITE-path read was right — one `count_reconcile`, delta −2, qty→58, `SUM(delta)=58`; only the replay DERIVATION was wrong, and baseline mode was never affected. **(d)** #66 above. **(e)** #67 (blind capture) still your open build input; #56/#59/#60/#61/#62/#63/#64/#65/#68/#69 unchanged.

### 2026-07-21 — THUNDER D-50 BUILD 2B: the RECONCILE SCREEN — a physical count becomes STAMPED, DATED, ATTRIBUTED truth on the append-only ledger. **The spec's two central formulas were both wrong; both were corrected and the corrections are mutation-proven.** BUILDER-COMPLETE; owner-prove OWED (9 cards). Zero api-fn (12/12), zero schema, zero migration.

**Type:** App code — **2 NEW** (`packages/cultivar-os/src/pages/InventoryReconcile.tsx` · `src/lib/reconcileMath.ts` — the PURE decision) + **1 NEW test** (`src/lib/reconcileMath.test.ts`, **48/0**) + **3 EDIT** (`src/router.tsx` · `src/registry/tileRegistry.ts` · `src/pages/BusinessInventory.tsx`). Docs: ledger **#145** · `built-inventory.md` (line 4 + NEW capability entry) · owner-test board (**NEW `## SURFACE: reconcile`, 9 cards all `owed`**) · `tech-debt-log.md` **#67 + #68 + #69 NEW** · `DECISIONS-INDEX.md` drift line · `TRACE-SESSION-BOOTSTRAP.md` ⚡ · this §3 + line 3. **§3 RETENTION: 1 archived verbatim (OWNER-GATED DEV SURFACES), 1 written — entries-in == entries-out, §3 back to 3.** **NO new decision** (implements D-50; **R-STATUS and blind-capture deliberately left OPEN**). **BENCH: no trigger fires** (no payments/PII-export/webhooks/AI-calls/compliance-actions — roster matched, reported per §6 r10). **§1.6:** applicable — **1 STORY** ("Reconcile the count against the ledger — leakage becomes arithmetic", ARC asset-inventory-pmi, MAPS-TO 2.3/5.1 — cited; its BUILD INPUT (1) *"where the real actor comes from"* is ANSWERED here (the signed-in desk user), BUILD INPUT (2) *blind capture* is NOT and stays David's), **3 VALIDATION** (negative/fractional counts and zero-qty attributions refused **before** the RPC; the over-attribution refusal NAMES the number it refused against), **4 CRUD-PERMISSIONS** (VIEW_COSTS route gate + `assert_movement_actor` server-side — defence in depth, not one lock), **6 AC-1/3** (no vertical noun; tenant scope untouched), **7 FUNCTION THRIFT** (zero api-fn — RPCs are postgres functions, reads run under existing RLS), **8 REUSE** (reserved/available through the ONE D-52 derivation, imported never re-exported), **9 TRACE STAYS ON** (`[TRACE:RECONCILE]` ON by birth), **11 OWNER-TEST** (9 cards, `owed`).

**⚠️ THE HEADLINE: BOTH OF THE SPEC'S FORMULAS WOULD HAVE WRITTEN FALSE ROWS INTO A LOG THAT CANNOT BE RETRACTED.** **(A) `expected` is a FULL REPLAY, not `prior_count − sales`.** The ledger records every movement — receive · dead · loss · found · adjust · tombstone — not only sales. Subtracting sales alone makes any non-sale movement in the window surface as a residual: a **+10 receive becomes a −10 gap the owner is asked to explain as shrinkage that never happened.** That is D-9 *inverted* — it mis-attributes a REAL movement rather than fabricating one — and it asks a human to account, permanently and by name, for the system's own arithmetic error. **(B) Attribution SPLITS the delta; it does not add a second one.** `count_reconcile_inventory` and `adjust_inventory_manual` **both move qty**. Run in the specified sequence — count_reconcile for the whole change, *then* a dead/loss adjust per cause — they decrement **twice**: book 30, counted 13, attributed 4 dead + 3 lost lands on-hand at **6**, net **−24 instead of −17**. *Seven invented dead plants, unretractable.* Each cause now writes its own qty-moving event and the **unexplained remainder** lands on the closing `count_reconcile`, so the steps sum to exactly `counted − book` and every cause gets the permanent dated line D-50's story literally asks for ("4 dead, 3 unexplained loss"). **Neither correction is a judgement call — each is proven by MUTATION TEST: reverting the code to the spec's version fails the suite (2 tests for A, 6 for B).**

**THE DECISION IS PURE, AND THAT IS THE ARCHITECTURE, NOT A PREFERENCE.** `reconcileMath.ts` performs no IO — mode detection, replay, residual, variance, and the ordered write PLAN are all functions of their inputs, and the page only executes what they return. Extracted pure for the same reason `countPromote.ts` was at D-49: **arithmetic that decides what enters an append-only log must be testable without a database, because a wrong row can only be apologized for with a second row.** Order inside the plan is load-bearing twice: **credits before debits** (a −6 dead before a +4 found on a lot of 3 would RAISE at the RPC and **strand half an attribution permanently**, with no way to finish it), and the **closing step lands ABSOLUTELY on `counted`** so a sale landing mid-plan is absorbed into that one row rather than silently lost. `miscount` is deliberately NOT an attribution kind — "the book was wrong, nothing physically happened" is *exactly* what a `count_reconcile` row already means, so it is the REMAINDER; giving it its own event would assert a movement that did not occur.

**BASELINE HIDES THE COLUMN RATHER THAN EMPTYING IT.** On a fresh tenant every lot is BASELINE and the "Since last count" column **does not exist** — not rendered blank. An empty sold-column on the screen built to prove how easy this is invites "why is this blank?", which is the opposite of the demo's point. It appears automatically the moment any lot has a window. Same reasoning made baseline ask for **no attribution**: there is no history to explain a first count against, so demanding one would be theatre.

**THE QUALITY GATE CAUGHT A REAL GAP I HAD NOT CONSIDERED.** `verify-universals` cap **#r** failed the first run: *"routes reachable but with NO nav entry (URL-only/orphaned): /inventory/reconcile."* The cheap fix was adding it to the EXCEPTIONS list beside `/inventory/count`. That would have been wrong — count is a sub-flow entered mid-task, but **reconcile is a destination the owner goes to deliberately**. It got a real `NAV_IA` node under Inventory, plus a "Reconcile count" button beside "Start count" on the grid. *"A new surface cannot ship without nav"* did its job.

**PROOFS.** `npm run verify` **exit 0, zero net-new** (tsc 5/5 · eslint 248 · knip 10/14/15) — and it went red first, correctly, three times: knip flagged 4 unused exports + 3 unused types in `reconcileMath.ts` (all genuinely module-internal — made private, **not re-baselined**, per the D-52 `holdsCommitment` precedent), eslint caught a floating promise and an async `onClick`, and `#r` caught the orphan route. `build:cultivar` exit 0. Tests **48/0**. Self-caught while writing the Accept sheet: Reserved was derived as `book − available`, which **understates it whenever committed exceeds on-hand** (`availableFrom` floors at 0) — reserved is a read fact, not a subtraction, so it is now passed in.

**FLAGGED FOR DAVID:** **(a)** **⚠️ #67 — BLIND CAPTURE IS THE MISSING HALF AND IT IS YOUR OPEN BUILD INPUT.** `InventoryCount.tsx:438` already calls `count_reconcile_inventory` **at capture**, so a phone count applies itself and a desk reconcile *of that walk* reads residual **0 by construction**. DELTA mode is real and provable for movements landing **after** a count (which is what owner-prove step 2 exercises), but it is **not** the count-then-review loop the story describes. `blind_capture_mode` is named in that story's own `PIECES:` — **does it ship, and is it default-blind?** **(b)** the 9 cards; sharpest are the **RECEIVE** card (a non-sale movement must read residual **0**, never phantom shrinkage) and the **ATTRIBUTION-SPLIT** card (read the "What Accept writes" box *before* confirming: 3 steps, ending on **13**, `SUM(delta) = −17` not −24). Then re-run LAYER 1's **V3(b)** — `qty == SUM(delta)`, 0 rows, with the new reconcile events in the sum. **(c)** **#68 NEW** — session scoping is **not built**, and the spec asked for it: blocked by #67, and `inventory_count_sessions.status` already has one owner (a second writer is the STD-011 drift we keep paying for). **(d)** **#69 NEW** — a multi-step accept can **partially land** (the sequence is not atomic even though each RPC is); mitigated by an honest stop-message naming the step and by the absolute closing step, durable fix is a one-RPC plan = a migration. **(e)** the `was_unknown` queue **READS but offers no Resolve button** — deliberate: a control that looks actionable and isn't is a dead affordance, and the card says so. **(f)** #56/#59/#60/#61/#62/#63/#64/#65/#66 unchanged.

> **§3 RETENTION — N=3 (binding; OP-13).** §3 holds the **most recent THREE entries**, no more. At every close-out, **BEFORE** writing the new entry, move every entry beyond the newest three — **verbatim, never summarized** — to [docs/handoff-archive.md](docs/handoff-archive.md) (newest-first, under a dated provenance comment). The new entry is #1. Nothing is deleted or condensed; the archive is append-and-preserve and is **NOT loaded at session start** — it holds the full history (185 entries as of 2026-07-17). Verification is arithmetic: **entries-in == entries-out**. Canonical "is X closed / owner-proof owed" state does NOT live here — it lives in `docs/CLOSE-OUT-LEDGER.md`, `docs/DECISIONS-INDEX.md`, and `docs/built-inventory.md`, each with its own gate. §3 is the narrative of the last three sessions; it was never the system of record. Full statement of force: `docs/operating-doctrine/end-of-session-protocol.md` → **GATE — CLAUDE.md §3 HANDOFF RETENTION**; close sequence step 0 (§9).

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

**STANDING INSTRUCTION (owner-test coverage — binding, same force as the reconciliation gates above):** **a build that ADDS, CHANGES, or POLISHES a surface must leave that surface with a matching owner-test card** in its capability's STANDING test — `docs/owner-tests/<capability>-full-surface-test.md`, rendered live by **`owner-tests.html`** (a PURE renderer beside `status.html`/`stories.html` — it parses the .md at open-time and holds no data, so there is nothing to regenerate). Add the check, update it, or mark it **`STATUS: needs-test` with a reason** — silence is not an option. **Four clauses:** (1) touch a surface → touch its card; (2) **`needs-test` is an honest answer and renders RED** — writing the test isn't always this build's job, but RECORDING that it's missing always is (D-9 applied to our own confidence; an unrecorded hole is a lie by omission); (3) **changing a surface flips `covered` → `owed`** and resets `LAST-PROVEN` — *a green check on a moved surface is worse than none, because it asserts a proof nobody performed* (the exact shape of D-49's own suite blessing the defect it was written to prevent); (4) **a per-build proof is a FILTER (`COVERS: #NNN`), never a second document** — two docs answering one question drift, and drift is what makes a test unbelievable (STD-011). **Thunder may NEVER mark a card `covered`** — Thunder writes the check and sets `owed`; only David's live run flips it to `covered` with a date. **The builder does not grade their own homework** (this is OP-4's two bars, given a scoreboard). Cards tagged **`DEVICE: phone` must be provable WITHOUT a console** — the capture loop happens in a lot, and a check that needs DevTools never gets run there (capture=mobile/reconcile=desktop, applied to testing). WHY: *"it works"* is a CLAIM until someone drove it through the real UI; nothing made the gap between BUILDER-COMPLETE and OWNER-PROVEN **visible**, so an unproven surface looked exactly like a proven one. Measured the day this was written: **inventory was 19% proven — 5 of 27 checks — with FOUR of eight surfaces shipping NO test at all**, incl. the order-picker READ that D-45 exists for. Nobody hid that; it was never counted. Full statement of force: `docs/operating-doctrine/end-of-session-protocol.md` → **GATE — OWNER-TEST COVERAGE**. (Operating principle: **OP-14**; also §1.6 item 11.)

**STANDING INSTRUCTION (owner-prove STEP ZERO — OP-15, binding — same force as the reconciliation gates above):** **before any owner-prove observation is treated as evidence, confirm the deployment for the EXACT SHA under test is live** — READY, and the SHA that is actually live, not a *different* push's Ready. This is STEP ZERO: **before the hard-refresh, before the bundle-hash check.** A failed deploy is SILENT — Vercel keeps serving the last-good bundle — and **Vercel deploys the TREE, not the COMMIT**, so a doc push can carry unshipped code live and a code push can fail to ship while the dashboard shows the new commit. If the SHA under test is not live, **every observation after that point is fiction.** **WHY it is homed on the BOARD, not only here:** the actor is DAVID at a screen, who does not read this file mid-test — so the PRIMARY home is a **GATE 0 block at the TOP of every `docs/owner-tests/*-full-surface-test.md`** (where he stands), and this §9 instruction is the SECONDARY home so THUNDER carries "confirm Vercel READY for THIS SHA" into every prompt's DEPLOYED-bar section. The proof it needs both: that phrase was already in every Thunder prompt this week and ran for the first time only when a build failure forced it — **#135 (`313de44`) sat dead ~20 hours, live only as a side effect of an unrelated markdown push.** A rule filed only where the actor isn't standing is **row 19B** — a note, and notes don't act. **FLAGGED (David rules after recon): the SHA STAMP** — inject `VERCEL_GIT_COMMIT_SHA` at build (`packages/cultivar-os/vite.config.ts` has no `define` yet) and render it on the existing `DebugPanel` (`?debug=1`), so GATE 0 becomes "does the app say the SHA?" — one glance, no dashboard; ~30 min, zero new api-fn. Full statement of force: `docs/operating-doctrine/end-of-session-protocol.md` → **GATE — DEPLOYED / OWNER-PROVE STEP ZERO**. (Operating principle: **OP-15**.)

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
   - **DEPLOYED (Thunder):** pushed to origin AND Vercel-deployed AND the new-code signal is visible in-app. **STEP ZERO (OP-15): confirm the Vercel deploy for THIS SHA is READY before reading any screen** — a failed build serves the OLD bundle SILENTLY, and Vercel deploys the TREE not the COMMIT (a doc push can carry unshipped code; a code push can fail to ship). If the SHA under test isn't live, every observation is fiction (#60: `313de44` sat dead ~20h, live only via an unrelated markdown push). **Then the check: "What new signal does ONLY this build emit, and do I see it?"** — a new message, a new `[TRACE:*]` emit, a new bundle hash. **If you still see the OLD signal, you are testing OLD code — STOP, confirm the deploy, and do NOT declare pass/fail.** Committed ≠ live.
   - **OWNER-PROVEN (David):** David has used the feature through the ACTUAL UI, under REAL permissions (RLS), via the `[TRACE:*]` trail, and confirmed it does what it should.
   - **DEPLOY TO LIVE (David — DORMANT until the first paying customer):** after OWNER-PROVEN. Once a paying customer exists, development runs run-and-gun against a REFERENCE environment (a disposable duplicate holding no paying-customer data — break it freely). **BUILDER-COMPLETE, DEPLOYED, and OWNER-PROVEN all occur ON REFERENCE.** Only after a change is OWNER-PROVEN on reference is it PROMOTED to production. **There is no paying customer today, so this bar is DORMANT — the current single-environment loop is unchanged. The three bars above are NOT replaced; this one is appended.** The velocity of run-and-gun is preserved; the new ceremony applies ONLY at the live boundary, where slowness is cheap and mistakes are expensive. (Promotion discipline: DECISIONS.md OP-12 — reference-proven artifacts promoted verbatim, schema byte-identical, no hand-edits at the boundary.)
   - Instrumentation stays ON across all bars. **Thunder reporting "builder-complete" does NOT authorize removing debug — only owner-proof does.** Builder verification ≠ deploy ≠ owner verification: a service-key round-trip can pass while the RLS/UI path still fails (Cost-to-Produce, 2026-06-14 — round-trip green, UI-save-under-RLS unproven), AND testing an un-deployed bundle produces phantom bugs (bit 3× on 2026-07-03 — map cached bundle, dedup unpushed, dedup tested-before-deploy). Thunder must state which bar each deliverable is at.
10. **Three-lens recon gate (binding) — fires at RECON time, not close:** every verify-before-build / decision recon ("LOOK") reports in THREE LENSES — **HAVE** (current state, `file:line`), **NEED** (irreducible minimum to meet the requirement, no preference), **WANT** (desired end-state / clean architecture, labeled as want) — and presents OPTIONS spanning NEED→WANT (cheapest-meets-need → fullest-meets-want), NOT one pre-collapsed recommendation. A recon without the three lenses is an **INCOMPLETE task** — same force as the header (item 8) and STD-003 (item 9) gates, and fires whether or not a prompt asks. (Doctrine: partnership doc §17; DECISIONS.md OP-8; proven by the asset-node schema A/B test, exemplar `docs/cost-to-produce/ASSET-NODE-SCHEMA-DECISION-3LENS.md`.)
11. **Quality gate (binding):** `npm run verify` (tsc + eslint + knip + verify-universals, ratcheted against `quality-baseline.json`) must pass with **zero NET-NEW** violations before a build is BUILDER-COMPLETE. Fail-on-new only — pre-existing baseline debt does not block. If you fixed violations and a metric dropped, run `npm run quality:baseline` and commit the lower numbers (lock the win; never let the baseline grow casually). Out of scope this gate (separate value-review): jscpd, Prettier, npm-audit, a test suite. (Tooling installed 2026-06-24; doctrine: §6 rules 8–9.)

12. **Owner-test coverage gate (binding — see the STANDING INSTRUCTION above):** every surface this build added/changed/polished has a card in `docs/owner-tests/<capability>-full-surface-test.md` — added, updated, or marked `STATUS: needs-test` **with a reason**; any surface that MOVED has its card flipped `covered` → `owed` with `LAST-PROVEN` reset. **State in the write-back which cards were added/updated/flipped and what the board's proven count now reads.** Thunder never sets `covered`. (Numbered 12 by APPENDING — steps 1–11 keep their numbers because §1.6 item 9 cites "§9 gate 9" and steps 10/11 cite "item 8"/"item 9"; renumbering would silently break four live cross-references to fix a formatting preference. Same call as OP-13's step 0.)---

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
