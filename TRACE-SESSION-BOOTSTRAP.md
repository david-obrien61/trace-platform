# TRACE — SESSION BOOTSTRAP (paste this FIRST in any new chat)

> **What this is:** the single front-door doc — and the CANONICAL status front-page. Paste this at the start of every new Lightning (Claude-in-chat) session to get current in ~90 seconds. It is the MAP, not the territory — deep detail lives in the reference library (§7) and the feeder docs each ⚡ line links to. Structure is FIXED; only the values change. Update at session-end (see END-OF-SESSION PROTOCOL doc + CLAUDE.md §9).
>
> **Last updated:** 2026-06-25 (⚡ ACTIVE STATUS + 📋 24-CAPABILITY BOARD added — this is now the canonical status front-page; feeder docs point up to it. Seeded from the 4 demo-fixes batch + OCR-into-inventory reuse-verify + CAPABILITY-PACKAGE-GROUNDTRUTH reconciled to today.)

---

## ⚡ ACTIVE STATUS — open this FIRST (in-flight + demo-critical only)

> One screen. Statuses + pointers ONLY — never inline depth (depth lives in the linked feeders).
> Legend: 🔴 not-started / fake / broken · 🟡 in-flight (built-not-wired OR wired-not-proven) · 🟢 live + proven (demoable). States stack.
> LIFECYCLE: when an item is 🟢-proven AND no longer demo-active it ARCHIVES to §A (bottom). The active list stays one screen because DONE leaves.
> Line shape: `[●] Item · state · priority · reuse · deps · → pointer`

**— DEMO-BLOCKERS (in-flight) —**
- 🟡 **Discovery: fail-loud + persistence** (FIX 1) · wired, owner-proof owed · DEMO · reuse: discovery engine (real) · deps: ANTHROPIC_KEY[live] · → `DiscoveryGlimpse.tsx`, commit `c8094e1`
- 🟡 **Onboarding address round-trip** (FIX 2) · wired, owner-proof owed · DEMO · reuse: businesses.address · deps: signup→wizard · → `OnboardingWizard.tsx`, commit `2c7bf08`
- 🟡 **OCR → inventory intake** (NEXT build) · reuse-and-wire (~70% reuse) · DEMO · reuse: `api/receipts/ocr.ts`(100%, shape:invoice), mobile capture+compress(100%) · deps: line-items→`business_inventory` mapper[M] · → `docs/decisions/OCR-into-inventory-reuse-verify.md`
- 🟡 **1.3 Catalog-populate (real LAWNS varieties)** · built, migration-gated, owner-proof owed · DEMO · reuse: discovery engine + sandbox `clear()` · deps: `business_discovery_profiles`[applied] · → `discovery/catalog.ts`, built-inventory 1.3
- 🟡 **1.2 Sandbox seeder (alive dashboard)** · built, owner-proof owed · DEMO · reuse: target tables exist · deps: none · → `scripts/seed-sandbox.mjs`
- 🟡 **Person-spine CP1/CP2** (global people + person_id overlay) · wired, migration STAGED, owner-apply owed · DEMO-adjacent · reuse: business_members · deps: full-nuke wipe · → built-inventory Person-Spine, commits `8eda8e3`/`c1f8be3`

**— POLISH (demo-facing, smaller) —**
- 🟡 **Leakage calc relabel → estimate** (FIX 3) · wired, owner-proof owed (visual) · POLISH · reuse: n/a (wording) · → `OnboardingWizard.tsx` LeakagePath, commit `0a18ca1`
- 🟡 **Delivery route round-trip anchor** (FIX 4) · wired, owner-proof owed · POLISH · reuse: `DeliveryRoute.buildMapsUrl` · deps: businesses.address · seam: one-way/custom-end + stop-order optimize (deferred) · → commit `769933f`
- 🟡 **1.1 Recognition discrepancy-compare** · built, owner-proof owed · POLISH · reuse: website-read + AI gateway · → `discovery/compare.ts`

**— LIVE SPINE (demoable today) —**
- 🟢 **Demo spine: QR checkout · netting/compliance · leakage · insights · QB invoice · inventory · PMI · delivery loop** (8 live caps) · live · DEMO · → §📋 board (2.1/2.2/3.1/3.5/3.6/4.1/5.1/5.2) · `verify-universals` matrix exit 0
- 🟡 **Owner-proof-owed deploy bundle** (Part-A render-wall · write-wall Gate-3b · tile registry · vertical field · identity header) · built, ONE deploy + two-JWT session closes all · INFRA · → `docs/CLOSE-OUT-LEDGER.md` "OWNER-PROOF OWED"

---

## 📋 24-CAPABILITY BOARD — the full platform map (L1–L5)

> Grouped by layer (fixed grouping). Each cap: `[●] id name · reuse/Ignition tag · → feeder`. Reconciled to today's code from `docs/CAPABILITY-PACKAGE-GROUNDTRUTH.md` (2026-06-19 baseline 7 live/8 partial/9 net-new).
> **Today: 8 live · 9 partial · 8 net-new** — moved since baseline: 3.5 partial→🟢 (delivery loop closed 06-20); 1.2 + 1.3 net-new→🟡 (built 06-19/06-21, owner-proof owed).

| ● | Cap | State / note | → feeder |
|---|---|---|---|
| 🟡 | **0.1** Vertical-as-pointer | partial — `business_type`+registry vertical field live; typed `VerticalConfig.ts` still [M] | GROUNDTRUTH 0.1 |
| 🟡 | **1.1** Recognition + discrepancy | recognition live; discrepancy-compare built 06-19, owner-proof owed | `discovery/compare.ts` |
| 🟡 | **1.2** Sandbox (alive dashboard) | built 06-19, owner-proof owed | `scripts/seed-sandbox.mjs` |
| 🟡 | **1.3** Clear→real catalog-populate (D-9) | built 06-21 (114 real LAWNS varieties), migration-gated | `discovery/catalog.ts` |
| 🟡 | **1.4** AI-assisted questions→config | partial — scaffolding only; answer-capture/setup-write [M] | GROUNDTRUTH 1.4 |
| 🟡 | **1.5** Handshake (one auth, two products) | one auth live; `business_discovery_profiles` applied; Person-spine 06-25 advances identity | GROUNDTRUTH 1.5 |
| 🟢 | **2.1** Cart / QR checkout (no money) | live | built-inventory 2.1 |
| 🟢 | **2.2** Compliance / netting (TX Ch.725) | live, persisted + immutable | `order_compliance_records` |
| 🟡 | **2.3** Walk-and-count inventory | reuse-and-wire — OCR-into-inventory scoped today (NEXT build) | OCR reuse-verify doc |
| 🟢 | **3.1** Leakage / missed-upsell visibility | live | Dashboard leakage tile |
| 🟡 | **3.2** Suggestion engine (at-sale upsell) | partial — declarative trigger only; engine [M] | GROUNDTRUTH 3.2 |
| 🔴 | **3.3** Post-sale service engine | net-new — dead schema scaffolding (`timing`/`recurrence_days` cols exist, no firing) | GROUNDTRUTH 3.3 |
| 🔴 | **3.4** Scheduling (self-book + calendar) | net-new — no calendar/booking table | GROUNDTRUTH 3.4 |
| 🟢 | **3.5** Routing / delivery | live — delivery loop closed 06-20; round-trip anchor 06-25; optimize deferred | `DeliveryRoute.tsx` |
| 🟢 | **3.6** Insights / analytics dashboard | live | `api/dashboard.ts` |
| 🟢 | **4.1** QuickBooks (invoice/refresh/source) | live (500 fix `14a9a82`); reconnect owner-proof caveat | `api/qbo/*` |
| 🔴 | **4.2** Reconciliation double-whammy | net-new — double-blocked on 4.1 live + 2.3 count | GROUNDTRUTH 4.2 |
| 🟡 | **4.3** Social media (gen + publish) | partial — generation live; publisher (Blotato) removed by design | `social/generate-posts.ts` |
| 🟢 | **5.1** Inventory management | live (create+read; no inline edit) | `BusinessInventory.tsx` |
| 🟢 | **5.2** Equipment PMI | live — **proven-in-Ignition, already extracted** | `shared/modules/PMI.tsx` |
| 🔴 | **5.3** Water system | net-new | — |
| 🔴 | **5.4** Greenhouse | net-new | — |
| 🔴 | **5.5** Seasonal | net-new (tile stub) | GROUNDTRUTH 5.5 |
| 🔴 | **5.6** Online shop | net-new (coming-soon stub); may reuse 2.1 checkout | GROUNDTRUTH 5.6 |
| 🔴 | **5.7** Contractors portal | net-new (tile stub) | GROUNDTRUTH 5.7 |

---

## 0. STANDING INSTRUCTIONS TO LIGHTNING (read first, every time)

1. **CHECK-BEFORE-BUILD GATE (anti-rebuild rule — the most important one).** Before designing or proposing a build of ANY capability, assume it MAY ALREADY EXIST — especially in **Ignition** (the mature reference vertical). Check §4 (What's Built) and the built-inventory. If it might exist, say so and propose a read-only audit FIRST. Do NOT design from scratch something that may already be built. *This rule exists because RBAC, the admin console, and auth were each designed/built more than once for lack of this check.*

2. **EXECUTE WHEN DIRECTED — don't ask "want me to?"** When David says "do it," "capture," "go," or has clearly directed — execute. Asking permission after a clear direction is a named failure mode. (Partnership doctrine §4, §9.)

3. **OPERATE AS LIGHTNING.** Composite voice (Doug=verification, Darren=directness, Binder=synthesis, Scott=dry edge). Calibrated pushback, not deferential, not contrarian. Push back with specific reasoning; receive correction without defensiveness. Full doctrine in `lightning-david-partnership.md`.

4. **CONTEXT DOES NOT PERSIST between sessions.** This is structural and won't change. The fix is THIS doc being current — not hoping Lightning remembers. The end-of-session protocol keeps it current so re-establishing context is one paste, not an hour of screenshots.

5. **Lightning ≠ Thunder.** Lightning (this chat) = strategy, diagnosis, writing prompts, capturing decisions; never edits the repo. Thunder (Claude Code in VS Code) = all repo/code/doc execution. Humor and exploration happen with Lightning; Thunder gets clean, literal, labeled instructions.

---

## 1. WHO

- **David O'Brien (Col Bender)** — solo founder, TRACE Enterprises. 40 yrs military/federal knowledge-management background. Away from hands-on code ~20 yrs; uses Claude as primary dev/strategy partner. Operating philosophy: "if I make you successful, then I'm ultimately successful." Non-extractive, family-owned by design (origin: NATO system dismantled after leadership change).
- **Family/team:** Andrew (full-stack dev, lives with David), Connor (infra/Kubernetes), Erin (ER nurse, potential healthcare vertical; on LAWNS as STAFF), Regina (wife, OLH program director, KINNA anchor pilot).
- **Two-Claude model:** **Lightning** = this chat (strategy/diagnosis/prompts). **Thunder** = Claude Code (execution against repo).

---

## 2. WHAT TRACE IS

A composable AI operating system for owner-operated small businesses. **One codebase, one deployment, infinite verticals.** Each vertical = a configured instance of the same shared platform. Unit of value = the **CAPABILITY** (atomic, vertical-agnostic), bundled into verticals. Three value buckets: CONNECT (adapter to what they have), FILL THE GAP (what they lack), SURFACE THE BETWEEN (cross-tile AI). Pitch: *"We don't replace your systems. We connect them, surface what matters, and fill the gaps you couldn't fill yourself."*

**Architecture constants (non-negotiable):**
- **AC-1:** variation lives in DATA not schema — no vertical nouns (nursery/shop/lawns) in shared tables, columns, RLS, routes, identifiers. Vertical identity = a `business_type` VALUE only.
- **AC-2:** RLS membership-scoped to `business_id` by default.
- **AC-3:** tenant isolation absolute.
- **AC-4:** settle once, encode as variable, stop relitigating.

---

## 3. VERTICALS & INFRA

| Vertical | What | Status | Supabase project | URL |
|---|---|---|---|---|
| **Ignition OS** | auto/diesel shop | MOST MATURE — the reference vertical (~47 commits). Much of the shared spine was built here first. | `ufsgqckbxdtwviqjjtos` | ignition-os.vercel.app |
| **Cultivar OS** | nurseries | Active demo target (LAWNS) | `bgobkjcopcxusjsetfob` | cultivar-os.vercel.app |
| **KINNA-OS** | nonprofits | Aug 1 2026 hard deadline (OLH Back-to-School) | (TBD) | — |
| CoolRunnings | home automation | local-first, Home Assistant | — | — |

- **Repo:** github.com/david-obrien61/trace-platform (private monorepo). `packages/shared/`, `packages/ignition-os/`, `packages/cultivar-os/`, etc.
- **Stack:** React + Vite + TypeScript · Supabase · Vercel.
- **business_type discriminators:** Cultivar=`'nursery'`, Ignition=`'shop'`.
- **Key IDs:** LAWNS business_id `a1b2c3d4-0000-0000-0000-000000000001`; JB Auto (Ignition test) `fb18f55e-ecb7-40a8-8616-a3c38ab11b93`.
- **⚠️ Two separate Supabase projects — never modify Ignition's from Cultivar code.**

---

## 4. WHAT'S BUILT (the anti-rebuild inventory — CHECK THIS BEFORE PROPOSING ANY BUILD)

> This section is the front-line defense against rebuilding. If a capability is listed here as built in a vertical, the job is PROMOTE/CONSUME, not rebuild. Deep detail → built-inventory.md / PLATFORM_AUDIT.md.

**Built in IGNITION (the mature vertical — most "do we have this?" answers are YES here):**
- **FULL RBAC ADMIN CONSOLE** ("ADMIN | COMMAND CENTER") — confirmed live 2026-06-04. Four tabs: TEAM (join code/QR, teams/grouping, invite), STAFF (member mgmt, invite, PIN reset), ROLES, SHOP SETTINGS. **ROLES tab:** system roles (ADMIN=14 perms, TECH=5, CUSTOMER=3, marked SYSTEM ROLE) + **ADD CUSTOM ROLE** (custom roles by name); permissions grouped by category (MODULES/FINANCIAL/ADMIN/TECH OPS/CUSTOMER), per-permission toggles, role→tile mapping, SAVE ROLE DEFINITIONS. **SHOP SETTINGS:** business profile + SYSTEM POLICY (Price Audit Mode, Bay Custody Tracking, **Auto-Lock Screen after 10 min** = device-session timeout, DOT Mandated Shop) + DANGER ZONE (Restart Onboarding, Simulate Trial Day, Factory Reset). → **This is near-complete RBAC + admin. Job = extract to shared, vertical-skin. NOT design, NOT rebuild.**
- **Returning-owner email/password sign-in** — built + verified live this session (SIGNIN step → `signInWithPassword`). Was missing; now works.
- **DataBridge.js** — local-first / "sometimes-connected" sync engine (localStorage → Supabase sync). Works. → **PROMOTE to shared, do NOT deprecate** (all verticals need offline sync; LAWNS-manager-in-nursery-house case).
- **Tile system** (shared already): `packages/shared/src/components/tiles/`.
- **AIEngine, QR print, OwnerSignup factory, notifications** — in shared (carry vertical-noun leaks; see naming audit).

**Built in CULTIVAR:**
- QR checkout flow (QR→profile→add-ons→capture→cart→confirm→QB invoice) — verified.
- QuickBooks invoicing — real/working (production Intuit approval). *(Ignition has a QB stub, NOT built out.)*
- `business_modules` table (migrated 2026-06-04) — connector/capability model. **Ignition does NOT have this table yet (prerequisite for shared-capability transfer).**
- Working `/login` + PrivateRoute (returning owner can sign in).
- Discovery engine (discovery.builtwithcai.com).

**Designed/specced this session (NOT yet built — post-demo):**
- **Shared Identity & Access capability** — `SPEC-identity-and-access-2026-06-04.md`. Two layers: Identity (Supabase email/pw) + Device-session (per-member PIN on registered device). Includes `member_devices`, bcrypt PINs, both reset flows, owner self-recovery, RBAC (already built in Ignition — promote), Lexicon layer, role-levels.
- Addendum: `ADDENDUM-rbac-and-localsync-2026-06-04.md` (RBAC detail, Lexicon `db_name`-vs-display, role hierarchy, promote-DataBridge).

---

## 5. WHAT'S DECIDED (canonical — don't relitigate, per AC-4)

- **Demo PUSHED** to land the shared Identity & Access capability polished (same call as SM — don't demo smoke).
- **Build shared, once.** Stop copy-to-vertical. Verticals CONSUME `packages/shared`; never reimplement. (RBAC, auth, DataBridge/offline-sync, SM, QB all = "promote from Ignition / build in shared," not copy.)
- **bcrypt migration path:** hash-on-next-successful-login (transparent), force-reset stragglers after a window.
- **Identity-table reconciliation** is the FIRST step of the I&A build: canonical `businesses` (retire/`view` `shops`), canonical `business_members` (retire `shop_members`), recreate `member_devices`+`pin_resets` `business_id`-scoped.
- **Lexicon principle:** system keys off `db_name` ALWAYS; display label is per-business config, NEVER load-bearing.
- **Roles:** People→Roles→Tiles (role implies permissions; don't store per-member arrays). Role levels (jr/sr) are distinct roles w/ bigger tile sets. Lexicon skins role display.
- **`1234` plaintext PIN seen in DB was hand-entered by David debugging** — NOT a code bug. (Verify normal write-path hashes correctly.)
- **Lean Cost + Failure Isolation:** free tiers by default; paid deps must justify or be cut (Blotato: cut). Platform limits (Vercel 12-fn cap) NEVER override failure isolation — cascade is the signal to pay, not to corrupt architecture. Organize api/ by capability, not count. Full principle → PLATFORM_STRATEGY.md § Design Principles.
- **Cost-to-serve must be codified before pricing any AI capability.** Pricing on free-tier cost is a margin trap (founding rates are permanent). Haiku where it suffices, cache system prompts, batch non-real-time. Usage volumes = David's domain truth. Full framework → `docs/strategy/cost-to-serve-framework.md`.

---

## 6. IN FLIGHT / TOP OF MIND (update every session)

- **Immediate priority:** LAWNS Cultivar demo (Leander, TX) — Lauren Bishop is the real buyer; Regina-drove-40-min-on-backroads is the emotional anchor.
- **Just committed (2026-06-04):** `docs/specs/SPEC-identity-and-access-2026-06-04.md`, `docs/audits/live-testing-findings-2026-06-04.md`. AUTH_DEBUG + SM_DEBUG gated false. Ignition blast-radius audit complete (shop_members 16 refs, shops 15, member_devices 10 [missing], pin_resets 3 [missing] — 100% Ignition).
- **Addendum committed:** `docs/specs/SPEC-identity-and-access-addendum-2026-06-04.md` — fold into main spec next session.
- **Next build session (rested, post-demo, maybe w/ Andrew):** Identity & Access — start with identity-table reconciliation per blast-radius map. RBAC = audit Ignition's existing console + promote to shared (verify: roles backed by table vs jsonb? per-business or global?).
- **HIGHEST-LEVERAGE META-TASK:** complete, honest capability inventory of Ignition into built-inventory.md, so "we already built this" is READ, not rediscovered. This is the anti-rebuild + anti-context-loss safeguard.

---

## 7. WHERE THE DEEP DETAIL LIVES (the reference library — consult, don't paste)

| Need | Doc |
|---|---|
| Working relationship / voice / failure modes | `lightning-david-partnership.md` |
| Session handoff state, infra specifics, active tasks, NON-NEGOTIABLE rules | `CLAUDE.md` |
| Strategy / demo / revenue / philosophy | `MASTER_BRIEF.md` |
| Architecture / where things should live | `PLATFORM_STRATEGY.md` |
| What's actually built in code (ground truth on conflicts) | `PLATFORM_AUDIT.md` |
| Capability inventory | `built-inventory.md` |
| Vertical-noun / naming leaks | `platform-naming-vertical-leak-audit-2026-06-03.md` |
| Onboarding/auth findings | `onboarding-flow-findings-2026-06-03.md` |
| This session's findings | `docs/audits/live-testing-findings-2026-06-04.md` |
| Identity & Access spec (+ addendum) | `docs/specs/SPEC-identity-and-access-2026-06-04.md` |
| Running strategic thinking | `THOUGHTS.md` (tail last ~300 lines) |
| Cost-to-serve + defensible pricing framework | `docs/strategy/cost-to-serve-framework.md` |
| AI Gateway spec (unified routing, cost control, insight capture) | `docs/specs/SPEC-ai-gateway-2026-06-05.md` |

**Conflict rule:** for what's *built*, PLATFORM_AUDIT.md wins. For *strategy*, MASTER_BRIEF. For *architecture*, PLATFORM_STRATEGY. This bootstrap is the map; those are the territory.

---

## §A. ✅ DONE / ARCHIVED (graduated out of ⚡ ACTIVE STATUS)

> 🟢-proven items that are no longer demo-active land here so the active list stays one screen.
> Keep one line each (state + date + pointer); full detail in the feeders / CLOSE-OUT-LEDGER.

- *(none yet — the first ⚡ items archive here when David owner-proves them post-deploy.)*

---

*Paste this first. Then state the session goal. Lightning: confirm you've read §0 + ⚡ ACTIVE STATUS, then engage. Don't re-ask for context this doc already provides.*
