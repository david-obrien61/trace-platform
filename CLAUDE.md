# CLAUDE.md — TRACE Platform
# Multi-AI Handoff Workflow — Claude Code reads this every session
# Last updated: 2026-08-23 (12) — docs: seven rulings, the stale row swept, CLAUDE.md compressed (see §3)
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
cultivar-os (NEW — active):    ref bgobkjcopcxusjsetfob   https://bgobkjcopcxusjsetfob.supabase.co
ignition-os (OLD — DO NOT TOUCH): ref ufsgqckbxdtwviqjjtos   — never modify from cultivar-os code
```

**Tables: the inline list is GONE — it declared itself stale and it was.** Canonical per-table state (LEVEL + LOCATION + EVIDENCE): **PLATFORM_STATE.md**. Still true and worth carrying: `nursery_modules` exists pending DROP, and `nurseries` + `losses` are the pre-`businesses` generation — both EMPTY, both pending DROP via GATED `20260727d_drop_losses_and_nurseries.sql` (ledger #162); `losses` keys on `nursery_id`, and its successor shape is `plant_events['lost']`.

⚠️ **AUTH: email/password, email confirmation OFF — and this is a LAUNCH GATE, not a setting.** Outbound mail does not work (Supabase default SMTP rate-limited / undelivered), so confirmation was disabled pre-2026-06-11 and **account creation works ONLY because it is off.** Fix SMTP (Resend/SendGrid/Postmark) FIRST, **then** re-enable confirmation — they are COUPLED, and turning confirmation on with broken mail means signup cannot complete. Same trigger as the abuse guards: first paying customer / public self-serve. See **PLATFORM_STATE.md LAUNCH GATES**.

### Vercel Environment Variables

🔴 **CANONICAL: [docs/inventory-env.md](docs/inventory-env.md)** — its own header says so (*"Canonical source for what env vars exist, where they're used, and which environments they belong to"*), and it is a **superset** of the block that used to sit here: all 16 vars, plus `VITE_APP_URL` / `VITE_MARKETING_URL` which this file never listed. Verified 2026-08-23. A second copy here is STD-011, and it is the copy that drifts — `QBO_ENVIRONMENT` went stale here for five days in May and was caught only by checking the Vercel dashboard directly.

**Ignition build settings** (Vercel dashboard, overrides `vercel.json`): build `npm run build:ignition`, output `packages/ignition-os/dist`.
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

Ten domains at GoDaddy under David's account (trace-enterprises · builtwithcai · cultivar-os .com/.app · ignition-os .com/.app · conduit-os .com/.app · kinna-os .com/.app). **Live production app: `cultivar-os.app`.** Only builtwithcai.com and ignition-os.com carry WHOIS privacy; the rest were deferred to the Cloudflare transfer window (free privacy on transfer).

**Full table + WHOIS status + the open KINNA-OS domain question:** `docs/handoff-archive.md` → *§2 Registered Domains — MOVED FROM CLAUDE.md 2026-08-23*.
### Desktop Folder → GitHub Repo Map (verified 2026-05-28)

**THE RULE (this is the load-bearing part, and it stays here):** `trace-platform/` is the **only** folder that deploys to Vercel — all Cultivar OS and all Ignition OS work goes here. **Ignition is donor-reference-only, not a peer system to maintain:** the live donor is `packages/ignition-os/`; `~/Desktop/CAI-archive/` (renamed from `CAI`, archived not deleted) is the historical original, reference-only. Before starting a build session, confirm which desktop folder maps to the target vertical.

**The full seven-row folder→repo table** (CoolRunning, IgnitionMobile, the empty `Cultivar-os/`, trace-assessment-app): `docs/handoff-archive.md` → *§2 Desktop Folder → GitHub Repo Map — MOVED FROM CLAUDE.md 2026-08-23*.
### Auth Architecture — Locked Rule (2026-05-28)

**Auth: PIN/face are unlock gestures layered on top of a real Supabase session (`auth.uid()` must be non-null) — never a replacement. Tenant isolation and RLS depend on this. Do not introduce PIN-only auth for any vertical handling multi-tenant customer data.**

Context: Cultivar OS uses email/password → Supabase Auth → `auth.uid()` → `nurseries.owner_id` lookup (via `NurseryProvider`). The Ignition OS PIN model is explicitly local-first and intentionally bypasses Supabase Auth — it is a separate, known exception for that vertical's single-device use case, not a pattern to reuse in multi-tenant contexts.

---

## Open Architecture Decisions

Decisions that have been deferred but must be resolved before specific build milestones. Update this list when decisions are made or new ones are deferred.

| # | Decision | Deferred From | Resolve Before | Notes |
|---|---|---|---|---|
| 1·2·7·8·12 | ✅ **CLOSED 2026-08-01 — the five principle-name rows (Surface Honesty · Honest Friction · Honest Velocity · Epistemic Humility · Honest Debt), all SETTLED BY USAGE.** Prose removed 2026-08-23 per STD-011: five closed rows in a twelve-row table teach a reader to skim it. | — | — | Canonical: [docs/DECISIONS-INDEX.md](docs/DECISIONS-INDEX.md) |
| 3 | KINNA-OS production app domain | 2026-05-26 | KINNA-OS Phase 1 build | Options: kinna-os.app, kinna-os.com, subdomain of builtwithcai.com |
| 5 | PLATFORM_STRATEGY.md file metadata claiming to be authoritative | 2026-05-26 (Session 1a noticed-but-not-touched) | Next PLATFORM_STRATEGY edit pass | Mildly inconsistent with the new Scope & Hierarchy preamble; soften or remove |
| 6 | PANTRY_OS.md file rename (if file is re-created) | 2026-05-26 | If/when a Pantry OS-named file is re-created in the repo | File was not found in the repo at Session 1a, but the question of its potential return is logged |
| 9 | Family-member role descriptions in canonical docs | 2026-05-27 (Brand framing session) | Before any public-facing copy uses them | Andrew, Connor, Erin, Regina each get to review and edit their own paragraph in the TRACE — Who We Are block. David sends each their section. |
| 10 | ✅ **DECIDED 2026-08-01 — YES: Surface Honesty covers DATA VALUES, not only UI elements.** | 2026-05-27 (Session K audit findings + nurseries row placeholder data discovery) | ~~Within 30 days~~ — **answered by practice, ~5 weeks past its own deadline** | **CLOSED — and it was answered IN CODE before anyone read this row, which is the finding.** The scope question was settled three times over by builds that never cited it: **(1) A9 — "absent is not empty"**, the platform-architecture-standard clause that a missing value must not render as a present one; **(2) PMI's `"equipment list hidden — cost-basis access required"`** — a withheld LIST that names why it is withheld instead of showing an empty list; **(3) `api/dashboard.ts:72-73`** — `today_revenue` and `inventory_value` returned as **`null` rather than `0`** for a caller without `costs:read`, with the reason recorded at the line: *"a redaction must not read as a real figure (D-9)."* All three are data-layer, none is a UI element, and the 2026-07-30 six-surface-states ruling then generalised it (*withheld data ANNOUNCES its redaction; never an empty list, never a zero*). **The original failure mode — the data layer lying while the UI hardcoded over it with correct values — is exactly what these forbid.** ⚠️ Residual, small and named: PLATFORM_STRATEGY.md's wording of the principle still says "surfaces"; the practice is broader than the sentence. |
| 11 | ✅ **DECIDED 2026-08-01 — THE ANSWER IS A CAP, AND HERE IT IS: `scripts/verify-select-policies.mjs`, wired into `npm run verify`.** | 2026-05-27 (third occurrence of the same root cause: modules May 22, nursery_modules May 22, orders May 27) | ~~Within 30 days OR before any new table is added~~ — 🔴 **THE TRIGGER FIRED AT LEAST THREE TIMES AND NOTHING FIRED WITH IT** (`people` 2026-06-25, the ledger tables 2026-07-20, and others). **A deadline written where nothing watches it is not a deadline** — which is why the answer was never "decide something," it was always "build the check." | **CLOSED BY BUILD, not by ruling.** Option (b) taken and made build-failing rather than reporting: **every live table in the migration corpus must have RLS ENABLED and at least one SELECT-capable policy** (`FOR SELECT`, `FOR ALL`, or no `FOR` clause — Postgres defaults to ALL), **or be DECLARED in `select-policy-declarations.json` with a reason.** Deny-all is fail-closed and legitimate for server-only reference data; it is not a legitimate ACCIDENT, and the declaration is what tells those apart. **DERIVED from the corpus, never a hardcoded table list** (#73's lesson), and 🔴 **the declaration list ASSERTS ITSELF in the other direction — a declaration for a table that no longer exists, or that has since gained a policy, is STALE and FAILS THE BUILD**, so it cannot rot into the unread noise `OWNER_ONLY_PENDING` became. **17 probes both directions (STD-022)** incl. the three real defect shapes (no policies at all · only INSERT/UPDATE policies · the SELECT policy dropped later) and the negative controls (`FOR ALL` counts · a bare policy counts · a dropped table is not evaluated). **RED-FIRST against the real corpus: exit 1, 2 undeclared tables named** — `platform_config` and `permission_aliases`, both then verified deliberate against their own migrations and declared. Options (a)/(c) NOT taken and the reason is recorded: a checklist and a standard are both things a human must remember, and #11's own history is three occurrences of a human not remembering. |

---

## Tech Debt Log

Full log (entries #1–#28): **[docs/tech-debt-log.md](docs/tech-debt-log.md)**

Quick-reference status: 🟢 = resolved · 🟡 = open · (#) = entry number

Active open items: **#78 (✅ resolved 2026-08-01 — ratchet caps re-keyed on `file::binding#table.verb`; counts proven identical before re-locking. → **ledger #177**)** · **#89 (✅ resolved 2026-07-31 — `useModules` filtered `can()` before reading `status`; `<BeingBuilt>` mounted. → **ledger #176**)** · **#90 (NEW 2026-07-31 — 🟡 **REMOVE `team:create/update/delete`** rather than leave them mis-described: team changes go through the funnel, which is owner-only by design and enforced by a trigger — that is *"never"*, not *"unbuilt"*. **BLOCKED** on the applied-migration reconciliation: capQ's retained `migration ⊆ manifest` direction fails when a string leaves BOTH manifest sets, and `20260727_rbac_resource_action_flip.sql` cannot be edited (§6 r1). Ledger #175)** · **#87 (2026-07-31 — 🟡 `navPermission()` falls back to **`view_dashboard`**, retired into the `member` sentinel. **UNREACHABLE TODAY (0 of 26 nav nodes)** — a landmine, not a live defect: the next node added without a `tileKey` or its own permission goes invisible to everyone including the owner. DECLARED in `authority-grants-baseline.json`, prints RED every capA run. Fall back to `member`, or delete the fallback and make the field required? Ledger #174)** · **#88  by MINTING `reports:read` as the NEW `planned` status — the string was gating a tile without existing in ANY manifest. Ledger #175)** · **#85/#86 (✅ resolved 2026-07-31 — two legacy-string client gates that admitted NOBODY (`view_costs` → `costs:read`, `import_pricing` → `inventory:import_price`). → **ledger #174**)** · **#84  BY RULING, NOT BY BUILD (✅ resolved 2026-07-31 BY RULING, not by build — a permission gates a CAPABILITY, not a field. → **ledger #173**)** · **#75 (NEW 2026-07-28 — 🟡 **A DEVICE CHECK THAT DISABLES ITSELF ON ERROR** — `[TRACE:DEVICE] device read failed` FAILS OPEN, observed live in the MANAGER session on `11c2e48`. A security-shaped check whose error path is "allow" is not a check, and the failure is INVISIBLE (a trace log is not a surfaced error) — the #158 class again. Logged as OBSERVED, not investigated: what is owed first is which call fails and whether the guarded surface is one where fail-open is a deliberate recorded choice. **Convenience → fine; authorisation → security defect.**)** · **#74 (✅ resolved 2026-07-28 — a Save that changed nothing keeps its audit row as `no_change`; compared as SETS. → **ledger #163 · STD-023**)** · **#73 (NEW 2026-07-28 —`verify-universals.mjs`'s `OWNER_ONLY_PENDING` is a HARDCODED gap list and SIX of its nine tables now carry member policies in repo migrations (`orders`/`order_items`/`order_service_selections`/`order_compliance_records`/`customers` via `20260724`, `social_drafts` via `20260727g`); only `plant_events`/`addons`/`nursery_profiles` are still real. **Stale noise, NOT a false green** — the cap passes on its real assertion — but a gap list that only grows stops being read, and it prints on every `npm run verify`. Fix = DERIVE it from the policies the script already parses (STD-011); tech-debt #63's class. Surfaced not fixed — rewriting a checker inside a table-DROP pass is the drift the gate exists to catch)** · **#71 (NEW 2026-07-22 — one `status` column, two authors: D-42's qty-derive overwrites D-52's tombstone; a deleted lot reads `depleted`, a manual `archived` is reverted, and the grid still offers Delete on a tombstoned lot surfacing raw `already_deleted`. Durable fix = lifecycle state in its own field — a MIGRATION. Logged not fixed, per David)** · **#72 (NEW 2026-07-22 — the `sale` ledger row's `reason` is NULL while every neighbouring kind explains itself; carry the order number at the emit sites next time the order path is touched)** · #2 (QB hardcode), #3 (social in cultivar), #4 (nursery footer), #8 (RLS unverified), #10 (SavingsReport missing), #12 (Ignition AI dark / Railway kill path), #13 (stub duplication), #16 (MarginEngine orphaned — A callers + plants.cost_price), #17 (dead migration), #18 (pin_hash unverified), #19 (instagram fallback), #20 (platform union), #21 (orphaned campaigns files), **#22 (✅ resolved 2026-08-22 — the migration WAS applied and the row read "David must apply" for 74 days: the STD-008 inverse's third form, migration-applied-but-recorded-as-pending. → **recon 2026-08-22**)** · **#91 (NEW 2026-08-22 — 🔴 **THE TWO PLATFORM CHECKS DISAGREE AND ARE NOT A SUBSET EITHER WAY.** `social_drafts` takes 5 (`…tiktok, twitter, sms`), `campaign_posts` takes 4 (`…sms, email`) — `email` is a value NOTHING can produce, `tiktok`/`twitter` are values the ONLY config UI offers. ⚠️ **PREMISE CORRECTED: `campaign_posts_platform_check` IS in version control** — `20260529_campaigns.sql:26-27`, declared INLINE, so Postgres auto-names it and the NAME is never typed; a name-grep could never find it. **~129 inline CHECKs share that property**, which is what #23's sweep must match on DEFINITION not `conname`. Blast radius total not partial: one atomic multi-row insert + an already-committed campaign row = **a campaign with zero posts**, two live)** · **#23 🔴 ESCALATED 2026-08-22 (two instances on adjacent tables in ONE evening = an unmeasured class per #174; sweep written 2026-06-09, never run, and 08-22 changed what it must do — match on DEFINITION, both directions)**,  #24 (opaque names), #25 (6 AI features dark), #26 (orphaned DataBridge keys), #27 (10 tables no migrations — IGNITION only; `losses` is NOT this entry, see #39), #28 (pilot_all RLS open), #29 (receipts naming), #30 (voice-samples RLS scope), #31 (catalog-verify process), #32 (cultivar_plants anon read open), #33 (widget-header backfill), #57 (✅ resolved 2026-07-16 — counting a variety made it unscannable; fixed by D-49's one invariant in `countPromote.ts`. → **ledger #133**) · #59 🟡 NEW 2026-07-16 (`TRACE-SESSION-BOOTSTRAP.md`'s header carries the **STD-011 duplicate-header disease AND IS LOADED EVERY SESSION** — §10's Session Starter opens it FIRST, so its `Last updated:` prose block is a per-session token tax exactly like CLAUDE.md line 3 was. **OP-13's own triage put it with the ledger/DECISIONS-INDEX as "not loaded every session" — that was WRONG for this one**; the triage stands for the other two. The header-is-a-POINTER clause should extend to it — David's call. Ledger #135) · #58 🟡 NEW 2026-07-16 (**the DB-level guard for the (variant_group, size) pair** — the durable form of ledger #135's defect 2: a partial unique index `(business_id, variant_group, size) WHERE variant_group IS NOT NULL AND size IS NOT NULL`. This is **ledger #74's deferred option C**. It is a MIGRATION and **it would REJECT the live Acoma dup, so it cannot land until the data is clean** (i.e. after the regenerated remediation). The code guard `findSizeTwin` is proportionate at a single-owner nursery's volume. **Sibling of #54** — the `qb_customer_id` partial unique index, named-not-taken on the same reasoning) · #56 (✅ resolved 2026-07-23 — size vocabulary normalized before COMPARISON via the one shared `normalizeSize`. → **ledger #150** ⚠️ residual: existing same-size-different-spelling rows still need a MERGE) — original defect was: (SIZE VOCABULARY not normalized on the count path — **the last live defect of the D-49/#135 family**; `findSizeTwin`/`sameSizeLabel` are exact equality and the catalog carries SIX spellings of THREE sizes (`15`/`30`/`45`/`5 gal`/`30 gal`/`45 gal`), incl. on **'Sierra', a DEMO variety**. Unlike #135's four, it can **MERGE existing rows** → needs a read-only blast-radius probe first — `'Sierra'` is live with `["15","30 gal"]`, so counting "15 gal" against the "15" row mints a THIRD row: two spellings of one physical size, on-hand split across both. D-45 did this for NAMES, nobody did it for SIZES. The next defect in the D-49 family — its own blast radius: unlike D-49 it can MERGE existing rows) · #34 (✅ resolved 2026-06-19 — `router.ts:15` import depth. → **commit 14a9a82**) · #35 (✅ resolved 2026-06-15 — `nursery_profiles` 406 → `maybeSingle`) · #36 (/assets + /pmi nav-dead) · #37 (PMI UI polish pass) · #38 (frictionless multi-channel cost capture — NEXT MAJOR BUILD after Core-2b; capture≠classification, hard-blocked on Core-2b sameCost dedup) · #39 (live schema not in version control — orders/customers/order_items + qb/leakage/netting cols live-only; **🟡 RE-SCOPED 2026-07-28: `losses` leaves this class by DELETION, not by capture** — GATED `20260727d`, ledger #162. A legitimate way off the list but a DISTINCT one, and the blind spot it created is exactly what BLOCKED 27d: no migration ⇒ a source grep could not see `losses_nursery_id_fkey`, so the check had to be `pg_constraint`-based. `nurseries` leaves the same way) · #40 (built-inventory flag correction — 5.1 inventory / 5.2 PMI are resolved, not ⚪) · #41 (Vercel Hobby 12-function ceiling — `api/` at limit; new functions silently fail deploy; mitigated by folding deliveries→customers; upgrade to Pro before next module wave) · #55 (✅ resolved 2026-07-16 — `canonicalName` apostrophe defect; 4 of 6 possessive varieties were broken in live data. → **archive #132**) · #54 🟡 (qb_customer_id collision guard is code-level/TOCTOU — durable form is a partial unique index `(business_id, qb_customer_id) WHERE NOT NULL`; a MIGRATION; theoretical at zero links, needed before real billing volume) · #53 (✅ resolved 2026-07-16 — QBO matched on EMAIL ALONE and cross-billed nine real invoices; fixed by the D-47 three-way rule. → **archive #131**) · #42 (✅ resolved 2026-06-21 — `seed.ts` D-9 silent coercion) · #60 🟡 NEW 2026-07-17 (**DEPLOY-VERIFICATION GAP — Vercel deploys the TREE not the COMMIT, and nothing between push and test confirms the build SUCCEEDED.** `313de44` (#135) never deployed — its Vercel build FAILED after clone — and #135 went live ~20h later only as a side effect of pushing the #137 markdown (`77ffd8e` carries it; merge-base CONFIRMED). One layer deeper than #128/#129: "the bundle can't be stale if it was never built." **✅ RULE RATIFIED 2026-07-17 → OP-15** (owner-prove STEP ZERO = confirm the deploy for THIS SHA is READY, before hard-refresh; homed PRIMARY on the owner-test board's GATE 0 where David stands, per row-19B). **Mechanical SHA-STAMP SHIPPED 2026-07-20 (ledger #141) — BUILDER-COMPLETE, owner-prove OWED, so this row stays 🟡:** vite `define` → `__COMMIT_SHA__` (7 chars, `'dev'` off-Vercel) → DebugPanel footer; GATE 0 ① is now "does the app say the SHA I pushed?" **Closes only on David's live match** — a stamp nobody has read is a claim, and a wrong one would silently un-verify every future GATE 0) · #61 🟡 NEW 2026-07-17 (**`countPromote.ts:24` comment is FALSE** — asserts scrape-reads-variations "never built"; `fetchProductVariants`/`extractSizeVariants` EXIST + wired (added 06-28/06-30). A comment contradicting its repo fed two days of wrong reasoning. Comment-only fix) · #62 🟡 NEW 2026-07-17 (**DataSheet viewport standard DRIFTED, one item both halves** — h-scrollbar anchored to table-content bottom not a fixed-height viewport (123 rows down at 123 rows); AND sell-price/conf columns past the RIGHT fold, the sell-decision column cut off on the "board 5.1 reconcile surface." A set convention drifted, not a missing pixel; inventory is the first DataSheet consumer long enough to surface it. Recon: is the viewport in `DataSheet.tsx` or per-page — do assets/customers pin while inventory doesn't?) · #70 🟡 NEW 2026-07-22 (**GENESIS `opening_balance` ROWS CARRY A SYNTHETIC `occurred_at`** — the D-50 backfill dates them at MIGRATION-APPLY TIME (`20260720…:360`, `now()`), not the lot's origin, so ~126 rows carry a timestamp describing *when we adopted the ledger*, not when anything happened. Produced the 2026-07-22 reconcile defect: for a lot last counted before 2026-07-20 the genesis row fell INSIDE the window and replayed as fresh arrival (prior 60 + genesis 60 = 120 vs book 60 — an apparent *exact doubling* from ONE read). **FIXED at the consumer** (`isMovement()` excludes position-assertions — independently correct, not a date patch) **but the hazard is in the DATA** for the next time-windowed reader. Re-dating is **REJECTED** — an UPDATE on an append-only table whose trigger rejects even `postgres`. Ledger #146) · #67 🟡 NEW 2026-07-21 (**BLIND CAPTURE IS THE MISSING HALF OF RECONCILE — and it is one of the D-50 story's own two OPEN build inputs.** `InventoryCount.tsx:438` calls `count_reconcile_inventory` **at capture**, so the phone count APPLIES ITSELF: by the time the desk reconcile screen opens, book == counted and the residual is **0 by construction**. The new DELTA mode is real for movements landing **after** a count, but it is **not** the count-then-review loop the story describes (*"the owner reviews the walk as a unit"*). `blind_capture_mode` — phone records to `inventory_counts` WITHOUT moving qty, desk becomes the applier — is named in that story's `PIECES:` and left as **BUILD INPUT (2), explicitly owed to David**. A CAPTURE-path change, deliberately not taken in the reconcile build. Ledger #145) · #68 🟡 NEW 2026-07-21 (**RECONCILE IS NOT SESSION-SCOPED — the spec asked and it is honestly not built.** Works per-lot across the catalog instead. Blocked by #67 (a session view would render a screen of "agrees — done" proving nothing) AND `inventory_count_sessions.status` already has ONE owner in `InventoryCount.tsx` — a second writer of one lifecycle field is the STD-011 drift we keep paying for. Lands WITH blind capture, as one build. Ledger #145) · #69 🟡 NEW 2026-07-21 (**A MULTI-STEP ACCEPT CAN PARTIALLY LAND, AND APPEND-ONLY MEANS NO ROLLBACK.** An attributed reconcile issues 2-4 sequential RPCs; each is atomic, **the sequence is not**. Mitigated not fixed: the UI names the step it stopped at and says earlier rows are already permanent, and the closing step lands ABSOLUTELY on `counted` so a *successful* run self-corrects against concurrent sales. Durable fix = ONE RPC taking the whole plan as `jsonb` in one plpgsql transaction — a MIGRATION. Sibling in shape to #54/#58. Ledger #145) · #63 🟡 NEW 2026-07-17 (**THE CAPTURE INDEX HAS NO GATE** — every other canonical surface has a reconciliation gate; the 📚 retrieval index is maintained by a step-6 REMINDER, and a reminder rots (row-19B). Found because David asked Lightning its humor style and it said "not encoded anywhere" — it was OP-2, canonical since 2026-06-03, absent only for lack of an index row. Sweep filled 21 missing rows (0 stale). Through-line: **the artifact does not carry its own provenance.** NOT an OP — named, numbered, left to earn a gate)

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
### 2026-08-23 (12) — THUNDER **DOCS: SEVEN RULINGS RECORDED, THE STALE ROW REMOVED AND ITS CLASS SWEPT, AND CLAUDE.md FINALLY UNDER ITS OWN BUDGET — 713 → 592.** Seven rulings David made this session are filed as RULED rows (R-1…R-7): **core cannot be switched off** (derived from `billing`, the field that already decides `enabledByDefault`) · **the disabled/lapsed tile IS the fuzz** · **the route renders the fuzz and does not block** · **marketplace scope is a SET and promotion to core is a FIELD CHANGE** · **the SERVER resolves price and the client displays it** · **a late discount recomputes the TAX with it** · **prefer ATTRIBUTION over APPROVAL.** ✅ **R-5 DISSOLVES C-A; R-2/R-3/R-4 answer M-C/M-D/M-E.** **DOCS ONLY** — no app code, no schema, no migration, no cap; **zero diff under `packages/`/`api/`/`supabase/`**; `stories.html` untouched; 91 stories unchanged. `npm run verify` exit 0 ZERO NET-NEW (5 / 247 / 10 / 12 / 15) · api/ **12/12** · **GATE 0 NOT APPLICABLE — nothing ships, so there is no bundle to prove** · all `[TRACE:*]` ON.

**Type:** Docs + close-out. Docs: ledger **#203** · `RULINGS.md` (**7 RULED + 2 NEW OWED, C-A flipped**) · `user_stories.md` (ONE `Reason:` amended) · ⚡ ACTIVE STATUS · `built-inventory.md` · DECISIONS-INDEX drift · this §3 + line 3. **§3 RETENTION: 1 archived verbatim (2026-08-23 (9) #200), 1 written — entries-in == entries-out, §3 back to 3** (archive 233 → 234, plus the three §4 compression blocks). ✏️ **CLAUDE.md read IN FULL (current bytes, not the stale snapshot) and `docs/RULINGS.md` read IN FULL.**

**🔴 THE TWO RULINGS THAT CARRY THE MOST WEIGHT, BECAUSE BOTH ARE SECURITY BOUNDARIES WEARING UI CLOTHES.** **R-2: FUZZ IS NOT A CSS BLUR OVER REAL DATA.** The aggregate is computed **SERVER-SIDE** and delivered as one number; **the detail never reaches the browser.** A blur over a full payload is **#81 with a filter on it** — one devtools line reads straight through it — and, filed with the ruling: **a CSS fuzz would pass every cap we own today**, because capA reads gates and the defect lives in selects. **R-5: COST IS AN INPUT TO PRICE RESOLUTION, NEVER AN OUTPUT OF THE API.** A seller on a wholesale, contractor or at-cost tier sees **a resolved price** and never learns it is cost. ✅ **This DISSOLVES C-A rather than answering it** — the Review-shows-retail/submit-charges-cost divergence was never really about the wall, it was about two callers of one pure function getting different inputs, and R-5 removes the second caller. ⚠️ **The #202 conditional narrowing is deliberately UNCHANGED** because `CartReview.tsx:182` computes price client-side today; when resolution moves, checkout stops receiving cost **for everyone including the owner** and the conditional becomes unconditional. It is a way-station, and it is now recorded as one.

**🔴 THE SWEEP FOUND SEVEN, NOT ONE — AND TWO HAD BEEN FOUND BY ACCIDENT, WHICH IS #174's WHOLE POINT.** The named stale row (**#85/#86-original**, *"TWO LIVE LEGACY-STRING CLIENT GATES THAT ADMIT NOBODY … DECLARED KNOWN-BAD, NOT ACCEPTED"*) sat directly beside its own **`#85/#86 ✅ resolved 2026-07-31`** twin — and Lightning read the stale one on 2026-08-21 and ran a whole role-planning conversation on it. Rather than fix the one instance, the **whole 23,266-character string was parsed**: **five superseded rows sitting beside their own resolved twins** (`#78-superseded`, `#89-old`, `#84-original`, `#85/#86-original`, `#87/#88-original`) **and two exact duplicates** (`#90` and `#87` each appearing twice, one a shorter restatement of the other). **45 → 38 segments; 23,266 → 14,530 chars; ZERO open rows lost, checked arithmetically in both directions** — every open label still present, and the twelve resolved rows compressed to one-line pointers at their ledger rows. ✏️ **A method note worth keeping: the first compression pass overran a segment boundary on unbalanced parens, and it was caught by diffing the segment labels before and after rather than by reading the result.**

**FLAGGED FOR DAVID:** **(a)** 🔴 **TWO REFINEMENTS FOUND *INSIDE* YOUR OWN RULINGS AND WRITTEN TO OWED RATHER THAN DECIDED. F-A:** R-2 says selecting a fuzzed tile **requests payment** — correct for a lapsed `add_on`, but **a `core_optional` is $0 and *nothing expires because there is nothing to expire*** (your 2026-08-02 ruling), so "requests payment" prompts a payment of nothing; its honest action is *"turn it back on"*. **Same visual state, different action, decided by `billing` — the same field R-1 already uses.** **F-B:** R-7's cost-benefit rests on a control you named yourself — **the tier list IS the control**, so a seller can only give away a percentage Lauren already sanctioned. **A free-form amount removes that control entirely and leaves attribution doing all the work**, which is a different bargain: same string, its own string, or should not exist. **(b)** 🔴 **R-7's GUARD DOES NOT EXIST, and the ruling depends on it: the lost-money report.** *"A report surfaces a discount of $XX, Lauren investigates"* — nothing surfaces it today. **Attribution without the report is just permission**, so the report is not a nice-to-have downstream of R-7, it is the half that makes R-7 safe. **(c)** ✅ **R-7 CHECKED BOTH DIRECTIONS AGAINST *"SURFACE, DON'T DECIDE"* AND THE CONCLUSION IS SIBLING, NOT INSTANCE** — as you asked, and the same shape as the outbound-initiation rule. **(a) surface-not-decide perfectly and still gate:** TRACE recommends a discount, decides nothing, and still makes Lauren wait for Terry — the sale is lost with the principle intact. **(b) prefer-attribution and still decide:** every seller discounts freely while TRACE refuses to offer a tier it disagrees with. **Each is reachable while the other is violated; the shared parent is *the owner is the authority, TRACE is the instrument*.** **(d)** 🔴 **A DEFECT FOUND OUTSIDE SCOPE, REPORTED AND ONLY POINTER-FIXED: §5 "WHAT'S BUILT — SHARED MODULES" LISTED 9 OF THE 25 DIRECTORIES IN `packages/shared/src/`** — omitting `inventory/`, `business-logic/`, `discovery/`, `import/`, `context/` and twelve more. **It is the file CORE MANDATE rule 1 sends you to for *"does it already exist in shared?"*, and it answered that wrongly and confidently** — anyone trusting it would conclude `stockLineResolver` did not exist and rebuild it, which is the exact failure rule 1 exists to prevent. Replaced by a pointer to `ls packages/shared/src/` + `built-inventory.md`; the stale listing is archived verbatim **with its staleness recorded on it**. **(e)** ✅ **THE COMPRESSION LOST NOTHING: every removed line is recoverable and each was checked, not assumed.** Env vars → `docs/inventory-env.md`, **verified a SUPERSET** (all 16 vars plus two this file never listed) rather than merely a duplicate · the Supabase table list → PLATFORM_STATE.md, and it **declared itself stale in its own text** · five closed principle-name rows → DECISIONS-INDEX (12 hits confirmed) · **the three blocks with NO home — Registered Domains, the Desktop Folder Map, §5 — were archived VERBATIM before removal.** The load-bearing halves stayed: the SMTP/confirmation LAUNCH GATE, the `trace-platform`-is-the-only-deploying-folder rule, §6 rules 1–18, §9 steps 0–12, §10's nine confirms — all verified present after the edit. **(f)** **CLAUDE.md is 592 lines, UNDER its own ~600 budget for the first time in four sessions** — and the debt string alone shed ~8,700 characters (~2,200 tokens per session) **while costing zero lines, which is the OP-13 amendment's argument in one number: the budget measures the wrong quantity.**

### 2026-08-23 (11) — THUNDER **BUILD: #81 MINIMUM. THE COST BASIS NO LONGER ARRIVES ON AN ORDINARY SCREEN — AND #81 IS STILL OPEN, WHICH IS THE HALF THAT MATTERS MOST TO SAY.** Three call sites, no more: `usePlant.ts:146` (the D-34 stock-line FALLBACK — the lane every discovery-seeded and CSV-imported lot takes, i.e. LAWNS's actual catalog) and `ScanOrder.tsx:277`/`:311` (scan + manual lookup) passed `STOCK_LINE_COLUMNS` — which names `unit_cost` — **unconditionally**, so opening a plant or scanning a tag put the owner's cost basis in the response with nobody trying. 🔴 **`ScanOrder` is gated on `orders:create`, which STAFF hold**, and `usePlant` was **half-fixed**: the specimen read at `:102-105` was narrowed on 2026-07-30 and its sibling 33 lines below was not. All three now call the NEW shared **`stockLineColumnsFor(canViewCosts)`**. **NO schema, NO migration, NO policy, NO new permission string, NO cap.** `npm run verify` exit 0 ZERO NET-NEW (5 / 247 / 10 / 12 / 15) · 27/27 test files · 1050 assertions · api/ **12/12** · all `[TRACE:*]` ON. ✅ **GATE 0 PROVEN FROM THE DEPLOYED BUNDLE (`e572eef`), NOT THE DASHBOARD — and the TRANSITION was observed, not a single lucky read:** the first fetch served the OLD bundle still stamped `a02f850`, the second served `index-ZLejCloX.js` stamped `e572eef`. 🔴 **The derivation then proved itself in production: the WIDE list ships as a literal and the NARROW list does NOT** — it is computed at runtime, so **exactly one column list exists in the deployed artifact**, and the A4/#168 divergence this build was shaped to avoid is structurally impossible there.

**Type:** Build + close-out. Docs: ledger **#202** · `RULINGS.md` (C-A updated with a live consequence; **C-A…C-E all remain OWED**) · ⚡ ACTIVE STATUS · `built-inventory.md` (header + a new body entry) · DECISIONS-INDEX drift · owner-test cards 22–25 · this §3 + line 3. **§3 RETENTION: 1 archived verbatim (2026-08-23 (8) #199), 1 written — entries-in == entries-out, §3 back to 3** (archive 232 → 233). ✏️ **CLAUDE.md read IN FULL and `docs/RULINGS.md` read IN FULL (164 lines / 123KB, eight chunks incl. the whole OWED table).**

**🔴 THE PROMPT'S CENTRAL PREMISE WAS FALSE AGAINST THE TREE, AND CORRECTING IT IS THE BUILD'S MAIN DECISION.** The prompt states the three callers *"merely RECEIVE cost, so narrowing them changes no behaviour"* and instructs an **unconditional** narrowing, explicitly forbidding a `canViewCosts` ternary. ✅ **The first half checks out and I verified it rather than trusting it: `grep unit_cost ScanOrder.tsx` returns no code read.** 🔴 **The conclusion does not follow, because the value does not stop at that file: `synthesizePlant:39` copies `unit_cost` onto the cart line and `CartReview.tsx:182` feeds it to `computeOrderPricing`, and `at_cost` is live and configurable (`Discounts.tsx:252`).** So an unconditional narrowing would have made **the OWNER'S OWN** `at_cost` Review show retail while `submit.ts:394` — service key, RLS-bypassed — charged cost: the exact divergence `tierPricing.ts:239-243` names two lines above the function, introduced for the one person who is supposed to see cost. ✏️ **The fix is therefore conditional on the session, which is what the recon's own MINIMUM specified** (*"the same `canViewCosts` ternary already sitting 33 lines above it — copied, not invented"*), **and it satisfies the prompt's actual requirement, which was never the ternary but the sentence under it: THE COLUMN MUST NOT BE IN THE RESPONSE.** A column-list ternary removes it from the REQUEST; that is the opposite of the #85/#86 shape the prompt was warning against (a UI gate over a payload that still carries the value). **The OWNER's payload is byte-for-byte what it was before this build.**

**✅ THE NARROW LIST IS DERIVED, AND THE DERIVATION IS PROVEN RATHER THAN ASSERTED.** `STOCK_LINE_CONFIDENTIAL_COLUMNS = ['unit_cost']` names the confidential field **exactly once**; `STOCK_LINE_COLUMNS_NO_COST` is `STOCK_LINE_COLUMNS` **minus** that set through a pure `withoutColumns()`. 🔴 **The load-bearing proof: a column was PLANTED into the wide list and it reached BOTH shapes with no second edit** — which is the only way to show there is no second hand-typed list — then the file was restored **byte-identical** (`diff -q` clean, zero residue). **7 derivation probes green**, including **`sell_price` SURVIVES the subtraction** (retail is not confidential — D-35) and the identity columns survive, so the resolver's ladder (SKU → name token-equality → size-picker) is untouched. **RED-FIRST (STD-024):** before, all three sites send a list naming `unit_cost`; after, the non-holder list is **11 → 10 columns, exactly `unit_cost` removed, every other column preserved in order**. **The resolver's DEFAULT was not changed** (§6 r8) — the wide shape stays reachable for the sites that legitimately need cost.

**FLAGGED FOR DAVID:** **(a)** 🔴 **#81 IS NOT CLOSED AND I HAVE NOT MARKED IT SO.** RLS on `business_inventory` is ROW-level, so a devtools one-liner still returns the costs, **`inventory-read-model.rls.mjs` card N-7 stays RED**, and the class's other two members are untouched — `business_service_log.cost` on `pmi:read` (**C-D**) and the grower's WHOLESALE column written verbatim into `business_inventory.attributes` (**C-E**). **This removes the exposure that happens to someone not trying; only COHERENT stops someone trying.** **(b)** 🔴 **C-A NOW HAS A LIVE CONSEQUENCE AND IT SHIPPED WITH THIS BUILD, stated rather than buried:** an `at_cost` line reviewed by a session **without** `costs:read` now degrades neutral to retail on Review while the server charges cost. It fires on `at_cost` tiers only, fails toward charging the customer *less* than displayed, is **inherent to any cost wall rather than to this build**, and is **unruled**. It is on **owner-test card 24** as a known-and-unruled note so a tester does not file it as a defect. **(c)** ⚠️ **NO CAP AND NO TEST WAS WRITTEN, DELIBERATELY.** A probe asserting `unit_cost` is absent from a string would assert a **CONFIGURATION, not a behaviour** (STD-025), and the cap question is **C-B** — a ruling David owes. Writing it would have answered his question with a constant. **(d)** ⚠️ **capA: my new `ScanOrder.tsx::canViewCosts` site is DECLARED with its reason (42 sites). I did NOT blanket re-baseline** — capA also reports **two pre-existing undeclared sites, `Subscription.tsx::mayEnable` and `router.tsx::route:subscription:read`, which were already unrecorded at my baseline** (the 08-02 marketplace build). Absorbing them silently would record someone else's change with an empty `why`, which is the *"probably right and undeclared"* state assertion 4 exists to end. **They are left exactly as found and named here.** **(e)** 🔴 **THE STALE DEBT ROW IS NAMED, NOT FIXED, PER STEP 4:** CLAUDE.md's debt string still carries `#85/#86-original (NEW … KNOWN-BAD, NOT ACCEPTED)` adjacent to `#85/#86 ✅ resolved 2026-07-31`, and the superseded row reads exactly like a live one — it is what produced the prompt's stale second-half premise last session. **tech-debt #22's class; David decides whether a doc edit rides along.** **(f)** ⚠️ **A live payload capture was NOT reachable — `.env.local` is sandbox-denied**, so the before/after evidence is the exact SELECT string each site sends (which is what determines the payload), not a network trace. **Card 25 is the live proof and it is David's to run.** **(g)** ✅ **`git log`/`git status` re-run at write-up — the tree carries only this build's files; HEAD was `a02f850` at STEP 0, one commit past the `90ff6a5` the prompt cites (that is the commit that CREATED the recon, not HEAD).** **(h)** **CLAUDE.md is ~707 lines against its own ~600 budget** — the §4 residual OP-13 says N=3 alone does not close.

### 2026-08-23 (10) — THUNDER **RECON: THE TILE ROUND TRIP. THE ANSWER IS NO, AND THE REASON IS THE NARROWEST ONE AVAILABLE — THERE IS NO OFF PATH ANYWHERE IN THE PRODUCT, WHILE EVERYTHING BEHIND THE BUTTON IS ALREADY BUILT AND CORRECT.** David's acceptance test — *select tiles, add to a business, have them display, deselect them and have them disappear, then re-enable them* — has ON proven live and 🔴 **nothing has ever run it backwards, because nothing CAN.** `Subscription.tsx` holds exactly ONE mutation function, `enable(m)` (`:181`), hardcoding `{enabled:true, trialDays}` (`:192-195`); the **Active** section (`:346-402`) renders a card with an icon, a price and a trial line and **no button of any kind**; and **every `setBusinessModuleState` call site platform-wide passes `true` or omits enablement** (`api/social/enable.ts:50`, `financialDataAccess.ts:244,251`) — **ZERO callers pass `false`.** ⚠️ **The server's own copy already describes the missing feature:** the refusal string at `20260802c:127` reads *"enabling **or disabling** a module changes what this business pays."* **RECON ONLY. NOTHING BUILT** — no app code, no schema, no migration, no policy, no cap. ONE document: `docs/audits/tile-round-trip-recon-2026-08-23.md` (440 lines). `npm run verify` exit 0 ZERO NET-NEW (5 / 247 / 10 / 12 / 15) · api/ **12/12** · **zero diff under `packages/`/`api/`/`supabase/`** · GATE 0 **NOT APPLICABLE** (nothing ships) · all `[TRACE:*]` ON.

**Type:** Recon + estimate + close-out. Docs: ledger **#201** · `RULINGS.md` (**FIVE NEW OWED rows M-A…M-E**) · ⚡ ACTIVE STATUS · `built-inventory.md` · DECISIONS-INDEX drift · this §3 + line 3. **§3 RETENTION: 1 archived verbatim (2026-08-23 (7) #198), 1 written — entries-in == entries-out, §3 back to 3** (archive 231 → 232). ✏️ **CLAUDE.md read IN FULL and `docs/RULINGS.md` read IN FULL (159 lines, four chunks incl. the whole OWED table).**

**✅ THE DATA PROMISE — THE ACTUAL SUBJECT OF DAVID'S REQUIREMENT — IS SAFE BY CONSTRUCTION, AND THAT IS A STRONGER PROOF THAN A TABLE-BY-TABLE CHECK.** The disable path is **one `UPDATE` against one table**: `20260802c:133-140` sets `enabled := false`, leaves `configured` alone (`COALESCE(NULL, configured)`) and merges `config || '{}'::jsonb`, **a no-op. There is no `DELETE` anywhere in the function.** Its complete write set is `business_modules` + `audit_log`, corroborated independently by `write-paths-baseline.json:75-78`. **It cannot reach a module's data because it names no other table** — which holds for tables nobody thought to enumerate. **Q6** — the seeder is `ON CONFLICT DO NOTHING` (`20260801c:424-429`) and ✅ **`Subscription.tsx:132`'s seed-if-absent was CHECKED not assumed: it fires on a MISSING row, and a disabled module still has one.** **Q7** — the clock neither restarts nor re-terms (`20260801c:275-283`, `restart_refused`), so **both of David's stated requirements are already met.** 🔴 **THE TRAP THE BUILD MUST NOT WALK INTO, and it is why the flag shape is the only workable one: if disable were implemented as a DELETE of the row, the marketplace's own seed-if-absent would RE-CREATE it on the very next page load — and with `trial_started_at` gone, `start_module_trial` would start a FRESH 30-day clock. Delete-as-disable is self-reversing AND re-clocking, against machinery already shipped.**

**🔴 THE DISPLAY PROMISE IS BROKEN TWICE, AND DAVID ASKED FOR BOTH HALVES.** **Q3** — `useModules.ts:122-125` falls a disabled module to **`'available'`**, the *same* state as one nobody ever turned on; and `Tile.tsx` gives `available` full colour (`:93`), opacity 1 (`:95`), `role="button"` (`:71-73`) and — unlike `active` (green dot `:129`), `planned` (SOON `:143`) and `locked` (red lock `:153`) — **no badge at all.** **So the entire visible consequence of turning a module off is an 11-pixel green dot disappearing.** **Q4** — `Dashboard.tsx:344-350`'s `openTile` navigates for **both** states and does not distinguish them, so **tapping a disabled module's tile walks straight into the feature**; and `router.tsx` declares **48 routes** in which a grep for `business_modules|module_key|useModules|enabled` returns **ZERO** — `/delivery-schedule` is gated at `:149` on `deliveries:read`, a PERMISSION. **A business with Delivery off gets the delivery schedule, working, saying nothing.** ⚠️ **Not a one-line gate, which is why it is COHERENT and not MINIMUM:** `router.tsx` has no access to the enablement overlay — `useModules` fetches it, the router does not.

**✅ THE EXTRA-TILES HALF CAME BACK BETTER THAN FEARED, AND THE REASON MATTERS MORE THAN THE ANSWER.** **Q8/Q9** — the dashboard IS vertical-scoped (`useModules.ts:88-89` → `dashboardTilesForVerticals`), the marketplace is NOT and **structurally cannot be: `MODULE_CATALOG` (`tileRegistry.ts:384-400`) has no `vertical` field at all** — the axis lives on `TILE_REGISTRY` and the marketplace reads the catalog. 🔴 **But it does not bite, because the partition is nearly empty: 32 of 33 tiles are `vertical:'general'`, counted.** The one exception, `seasonal_module` (`:239`), is `planned` AND `placement:'settings'`, and per RULINGS #138/#139 `tilesForPlacement()` has **ZERO CALLERS**. **So `general` and `nursery` render the IDENTICAL grid, and a consulting business CAN add Delivery today** (`delivery` is `vertical:'general'`, `:143`). ✏️ **David's guiding principle holds — by the emptiness of the partition rather than by the machinery, and those are different situations.** **Q10** — the rehome changes **zero tiles, zero data, zero RLS** (**no policy anywhere references `business_type`**; every migration hit is a long-applied one-shot seed) and is **fully reversible** — one free-text column with **no CHECK constraint** (`20260529_businesses_a:14`) and a resolver that fails SAFE to `['general']`. The only effects are cosmetic: the Discounts *suggestion chips* (`Discounts.tsx:75`) and two legacy onboarding queries. **Q11** — ✅ **the growth path is CLEAN: one `business_type` hit across all of `shared/inventory` + `shared/business-logic`, and it is a COMMENT in `taxExemption.ts:6` saying the module is deliberately generic.** The only vertical residue is NAMING (`cultivar_plants`, the label "Plants tracked"), already on the Noun Purge.

**FLAGGED FOR DAVID:** **(a)** 🔴 **FIVE RULINGS OWED (M-A…M-E), and M-B is the gate that fires: `user_stories.md:1052` — "Connector-management CONSOLE — full UI" — is `STATUS: scoped-out`, its reason reading *"a full connector-management console is post-demo, not a gap."* David's requirement IS that console, so per §9 this is CONFLICT → STOP and surface; only David may flip a scoped-out row.** ⚠️ **And a surface was already built against it: `Subscription.tsx` (527 lines, 2026-08-02) is a partial console with no story — `IN CODE BUT NOT ON THE BOARD`.** **(b)** 🔴 **M-A is the one MINIMUM cannot ship without, and the answer is none of the three David offered: the clock never PAUSED.** The term is neither lost nor refreshed — ✅ both stated requirements met — but a module switched off for a month burns a month. ✏️ **RECOMMEND leaving the mechanism and fixing the COPY** (*"Turned off — its trial still ends [date]"*), because pausing needs accumulated-enabled-days, a THIRD field, and the 2026-08-01 pair ruling says the terms are the pair. **(c)** ✅ **Q12 — the cap is an ASSERTION, not a script, and that is the finding: `verify-write-paths.mjs` ALREADY parses `CREATE FUNCTION` bodies into `RPCMAP`** (its own probes `:424-447` cover the alias case, the `FOR UPDATE`-is-a-lock case and the write-inside-a-string-literal case). The assertion is *`set_business_module_state`'s write set must equal exactly `{business_modules, audit_log}`, with no DELETE target*. ⚠️ **What it CANNOT prove is said plainly: it cannot prove the round trip WORKS — that half is owner-test only,** a `DEVICE: desktop` card provable **without a console**. **(d)** 🔴 **One data-shape hazard the module table makes visible: `social_media`'s own configuration lives INSIDE `business_modules.config`** (`SocialSetup.tsx:61-66` reads `advert_channels`/`cadence`) **— the same jsonb the disable path writes, alongside the trial pair. It survives only because `config || '{}'` is a no-op; a disable that "cleans up" config would destroy the channel selection and the trial terms in one statement,** the second of which is a ruling violation arriving through a tidy-up. **(e)** ⚠️ **`BusinessProvider.tsx:440-448`/`:484-517` carry the vertical fence COMMENTED OUT (`[TEMP — OPEN ACCESS]`) — which is why a rehome cannot strand David out of his own business list. Named as luck from a switched-off control, not as design.** **(f)** ✅ **The `git log`/`git status` re-run at write-up was CLEAN — HEAD still `90ff6a5`, tree carrying only the new doc; the stale-snapshot catch of 2026-08-23 (7) did not recur, and I checked rather than assumed.** **(g)** ✏️ **RULINGS:147 was not exercised and the reason is worth recording: this recon needed no catalog claim.** Every finding is sourced from repo `.sql` function bodies and app code, so the sandbox boundary that limited the last two recons **was not reached rather than worked around.** **(h)** **SCOPES: MINIMUM ~2 prompts / 0 migrations / 1 ruling — and its honest residual is that it proves the DATA promise and leaves the DISPLAY promise unmet · COHERENT ~5–6 / 0 / +2 · COMPLETE ~9–10 / 0 / +1.** **(i)** **CLAUDE.md is 713 lines against its own ~600 budget** — the §4 residual OP-13 says N=3 alone does not close.

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

🔴 **The inline listing is GONE because it was WRONG in the direction that matters.** It named 9 directories; `packages/shared/src/` has **25** — it omitted `inventory/`, `business-logic/`, `discovery/`, `import/`, `context/` and twelve more, i.e. exactly where recent builds live. CORE MANDATE rule 1 sends you here to answer *"does it already exist in shared?"*, and a stale list answers that question **wrongly and confidently**.

**Answer it from the source, not from this file:**
- **What exists:** `ls packages/shared/src/` — the tree is the truth, and it cannot go stale.
- **What it does / is it wired:** [docs/built-inventory.md](docs/built-inventory.md) (the running ledger, gated by §9) · PLATFORM_STATE.md for LEVEL + LOCATION + EVIDENCE.
- **The retired listing**, verbatim with its own staleness noted: `docs/handoff-archive.md` → *§5 WHAT'S BUILT — MOVED FROM CLAUDE.md 2026-08-23*.
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

17. **CREATE TABLES THROUGH MIGRATIONS, NOT THE DASHBOARD TABLE EDITOR (binding workflow constraint, David 2026-07-28; scope corrected same day by the V4 probe).** A table created in the dashboard **table editor** is created by **`supabase_admin`**, whose default ACL on `public` grants **TRUNCATE and REFERENCES to `anon`** — and **that default ACL cannot be altered by us: Supabase owns the role and the `ALTER DEFAULT PRIVILEGES` against it is DENIED.** The migration path runs as `postgres`, whose default ACL was corrected (`20260728b`). So the same table gets different privileges depending on which window it was typed into, and the table-editor one arrives with a privilege **RLS cannot filter** (TRUNCATE is outside row-level security entirely). It looks identical to every other table. **⚠️ THE SQL EDITOR IS NOT THE GAP — proven, not assumed:** the V4 probe was created through the SQL editor and inherited the **postgres** default (five privileges, no TRUNCATE, no REFERENCES). Two surfaces are colloquially "the dashboard"; only the table editor re-grants. The broader phrasing would have banned a safe path and taught a rule the next probe visibly contradicts — which is how a correct rule gets discarded wholesale. **Detection (the privilege is the fingerprint):** a `public` table carrying TRUNCATE/REFERENCES for `anon`, owner `supabase_admin`, was created outside the migration path — query in `supabase/migrations/20260728b_default_privileges_truncate_references.sql` (read `pg_class.relacl` via `aclexplode`, **never `information_schema.role_table_grants`**, which returns zero rows on a database full of violations when the querying role isn't a member of the grantee). Its automated home is **OWED** — the schema-snapshot checker (ledger #159b) does not exist, and `verify-universals.mjs` cannot host it (it reads repo `.sql`, not the catalog). **An external control exists but is NOT a substitute:** Supabase's SQL editor warns before a `CREATE TABLE` without RLS ("Clients using anon or authenticated keys may be able to access public.<table>") — dismissible, on one surface only, and about RLS rather than the privilege layer. Homed HERE, not only in the migration, because a rule filed where the actor isn't standing is a note, and notes don't act (the OP-15 / row-19B lesson). Ledger **#160b**.

18. **SECTION HEADERS ARE CLAIMS — a header's assertion must hold for EVERY row the section can currently contain (binding; `ui-control-standards.md` §5/S1).** A header is not decoration, it is an assertion the reader applies to everything beneath it, and one contradicting row makes the page say two things at once. **Both directions are the same lie:** *"nothing to do"* above a row that has something to do (the Contractors card, 2026-08-02 — a green check meaning DONE beside a `Turn on` button), and *"turn one on"* said to someone who may not, or when nothing is left to turn on (the Available header, read as a MANAGER, found by sweeping for the first). So: enumerate the row states a section can hold and check the header against each; make a sometimes-true claim CONDITIONAL rather than approximate; keep headers permission-aware wherever they name an action; and 🔴 **never let a per-row glyph restate what the header already said** — the header carries the shared fact, the glyph must carry what distinguishes THIS row, or it is a second representation of one fact (STD-011) and the redundant copy is the one that drifts. Review-only: no cap reads prose. This is the six-state ruling's class (*a control saying one thing while the state says another*) arriving in COPY, and it surfaced inside the first surface built under that ruling.

    ✏️ **NUMBERED 18 BY APPENDING, NOT INSERTED AT 16.** The first draft slotted this in at 16 and pushed the table-editor rule 17 → 18 — which silently broke `docs/RULINGS.md:68`, a live citation of *"CLAUDE.md §6 r17"*. **Caught by grepping for the reference before committing, not by review.** Same call as §9 step 12 and OP-13's step 0: rules are APPENDED because other documents cite them by number, and renumbering to satisfy a reading order breaks references to fix a preference.

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

9. **RULINGS (binding gate — read `docs/RULINGS.md` IN FULL, every session, before any build):** one line
   per ruling David has made, newest first, each marked IMPLEMENTED / PARTIAL / OPEN / OWED with the
   cap that guards it. It is deliberately short enough that reading it is free. **A build that
   contradicts an IMPLEMENTED ruling STOPS and surfaces; a build that lands an OPEN one flips its
   line in the same commit.** WHY: four rulings evaporated between the session that made them and
   the session that built against them (2026-07-30) — not disputed, forgotten, because they lived
   only in §3 prose that scrolled out at N=3. The OWED table is David's queue; do not silently
   answer one of those questions by picking a default in code.

Do not start until you confirm all nine.
Do not touch ignition-os, old Supabase project,
or QB oauth.ts.
```

---

*TRACE Enterprises · Built with CAI*
*cultivar-os.vercel.app · builtwithcai.com*
*(512) 456-3632 · david@trace-enterprises.com*
*Update this file every session. No exceptions.*
