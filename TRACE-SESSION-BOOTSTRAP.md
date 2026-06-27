# TRACE — SESSION BOOTSTRAP (paste this FIRST in any new chat)

> **What this is:** the single front-door doc — and the CANONICAL status front-page. Paste this at the start of every new Lightning (Claude-in-chat) session to get current in ~90 seconds. It is the MAP, not the territory — deep detail lives in the reference library (§7) and the feeder docs each ⚡ line links to. Structure is FIXED; only the values change. Update at session-end (see END-OF-SESSION PROTOCOL doc + CLAUDE.md §9).
>
> **Last updated:** 2026-06-27 (GROWER-RESOLVE L4 — name token-set EQUALITY [ledger #61, `6e75b66`, BUILDER-COMPLETE, phone owner-proof owed]: the EQUALITY-FIRST cut of recon #59 — fixes the LAWNS walk-and-count FALSE-UNKNOWN. NEW shared `packages/shared/src/utils/canonicalName.ts` [+barrel] = the ONE canonical-key normalizer voice/typed/QR share [`nameTokenSet`/`canonicalNameKey`/`tokenSetsEqual`] wired as **L4** in `InventoryCount.handleScan` after L1 tag_id/L2 sku, before UNKNOWN [scan-slug tokens == catalog NAME tokens, order-insensitive → 1 match resolves (`vitex-shoal-creek` ↔ "Shoal Creek Vitex"), >1 → UNKNOWN never auto-pick = the NEED_CLARIFICATION seam]; ROOT CAUSE = discovery writes synthetic `DISC-####` sku + no `cultivar_plants` row so the name's WORDS were never compared; EQUALITY-ONLY [zero false-match]; L3 stored-slug + L5 guarded-subset + L6 stemmed DEFERRED with the seam at L4 [FAST-FOLLOW = guarded-fuzzy + picker UI]; new `[TRACE:RESOLVE]` ON; NO schema/migration/auth/RLS; 21/21 unit; `npm run verify` exit 0 zero NET-NEW; ⚡ cap-2.3 + 🧵 ARC MAP arc-8 + 📋 2.3 updated. Prior: SOMETIMES-CONNECTED SYNC + OFFLINE WALK-AND-COUNT [ledger #57, `73d49a0`, BUILDER-COMPLETE, phone owner-proof owed]: NEW shared `packages/shared/src/sync/` [namespaced store + typed offline-op queue + write-through-or-enqueue + reconnect drain, idempotent via clientId=insert-PK — the minimum slice from recon #55, NOT a move of `DataBridge.js` (44 Ignition imports untouched)]; all 5 `InventoryCount.tsx` writes routed through it → dead-zone Save no longer fails [offline=queued, reconnect=drains, online=applied]; identity-stamp [userId+clientTs per op, count START guarded auth+online]; same-lot-twice-this-session Save SURFACES a conflict [Keep-first/Keep-new, never silent overwrite]; I&A heavy-sync NOT built [identity-stamp only]; `npm run verify` exit 0 zero NET-NEW, build clean 2230 modules; `[TRACE:SYNC]` added + `[TRACE:COUNT]` ON; ⚡ cap-2.3 + 🧵 ARC MAP arc-8 + 📋 2.3 + DataBridge cold-start note updated. Prior: WALK-AND-COUNT inventory loop BUILT [cap 2.3, ledger #54]: scan→resolve→qty→save→next→complete — new `QrScanner` [jsQR live decode + URL-strip + manual fallback] + `InventoryCount` page [`/inventory/count`] + "Start count" on `/inventory`; SETS `business_inventory.qty` AND records each count to the GATED `20260626_inventory_count_sessions` migration [handed to David, NOT applied]; UNKNOWN scan handled; RECONCILIATION DEFERRED [record model leaves room]; `[TRACE:COUNT]` ON; verify-first homed in `docs/decisions/walk-and-count-inventory-verify-first.md`; BUILDER-COMPLETE, owner-proof owed; ⚡ ACTIVE STATUS cap-2.3 + 🧵 ARC MAP arc 8 updated. Prior: DESIGN-LAW CAPTURE — banked **D-21** [screen real estate is sacred; direct access over scroll — the platform-wide design law, canonical home for direct-access-over-scroll] + **D-22** [Admin = business-entity config; Settings = user-self — the nav gating axis], both from ledger #51's two flagged principles; CAPTURE INDEX gained D-21/D-22 rows; docs-only, no code/schema/`[TRACE:*]`. Prior: ARC-MAP FLIP — front-door arc PROMOTED synchronously + AUTH-FREE [ledger #47]: validate/conflict 🟡→🟢 [`compareEnteredVsSite`+address WIRED into the reveal], seed 🟡→🟢 [`populateCatalog` as `action=populate`], alive-dashboard 🔴→🟡; delivery DEMO-bookend 🔴→🟡; + ⚡ front-door line added. Prior: TWO new map-level sections added: **🧵 ARC MAP** (8 arcs — front-door / OCR-doc-routing / cost-to-produce / suggestion / delivery / discovery / identity-roles-security / asset-inventory-PMI — modeled as FLOWS not tiles; every piece-status verified file:line this pass, with per-arc LANDMINE + OFF-COURSE/EXTRA lanes) and **📚 CAPTURE INDEX** (single retrieval table of every D-/OP-/doctrine/recon, swept from the actual docs — pointer-only). Maintenance loop wired as step 6 of operating-doctrine/end-of-session-protocol.md so both stay self-maintaining. Existing COLD-START / OPERATING FACTS / ⚡ ACTIVE STATUS / 📋 24-board / §7b / §A all intact. Prior: Lightning load-menu added (§7b: subject → verified .md files to drag) + COLD-START ritual at top + two standing WORKFLOW rules banked (prompt format = one copy-paste block · humor = Cleese/Fawlty/Python deadpan, full mode earned). Prior: VERIFY-BEFORE-BUILD as the top-level standing principle in ⚡ OPERATING FACTS — cross-refs §0 #1, CLAUDE.md §10 #6, DECISIONS.md OP-8, no duplicate copies; ⚡ OPERATING FACTS constants block at top; ⚡ ACTIVE STATUS + 📋 24-CAPABILITY BOARD = canonical status front-page; feeder docs point up to it.)

> **COLD-START (how to get Lightning current fast):** Paste TWO things at session start —
> (1) this file (TRACE-SESSION-BOOTSTRAP.md), and (2) the current HANDOFF — which lives in
> **CLAUDE.md Part 3 (HANDOFF)**, rewritten every session as the "what were we mid-sentence on"
> record. *(There is no `docs/handoffs/` folder — the canonical session handoff is CLAUDE.md
> Part 3; `docs/handoff-archive.md` holds older rolled-off entries.)* Then state the session goal.
> If the goal touches a specific subsystem, ALSO drag over the .md files listed for that subject
> in the LIGHTNING LOAD-MENU (§7b). Lightning can read past CONVERSATIONS on its own (just ask:
> "pull up where we left off on X") but CANNOT open repo files — those must be pasted/dragged.
> Conversations = what we said; docs = what's written in the repo.

---

## ⚡ OPERATING FACTS — the constants (rarely change)

> Stable project constants Lightning otherwise re-derives or guesses at session-start. NOT task-state (that lives in ⚡ ACTIVE STATUS below, which changes every close). Pointers over detail. Inclusion test: *true across sessions AND Lightning gets it wrong without it.* If a value changes session-to-session it does NOT belong here.

**VERIFY-BEFORE-BUILD (always, no exceptions)** — the standing principle above all build work.
> Before building ANYTHING, look at what already exists first — read the code, the tables, the existing capability. Never build from memory, assumption, or "I think we have X." Every build/recon starts by confirming current state against the repo (file:line evidence), THEN scoping the delta. This prevents: rebuilding what exists, drift, wrong-target edits, and scope creep. The pattern is always: (1) what do we have, (2) what's the real delta, (3) build only the delta. A recon or a verify-first pass is NOT overhead — it's the cheapest insurance against the most expensive mistakes. When in doubt, read before you write.
>
> Reinforced by (point here, don't duplicate): **§0 #1 CHECK-BEFORE-BUILD GATE** (the anti-rebuild special case — assume it may already exist, esp. in Ignition) · **CLAUDE.md §10 Session Starter #6** (verify-before-build: check built-inventory + grep before NEW capability) · **DECISIONS.md OP-8** (HAVE/NEED/WANT three-lens recon — how a verify-first LOOK reports, bound as a recon gate in CLAUDE.md §9 #10). This bootstrap line is the canonical top-level statement of the principle; those are its enforcement points.

**DEPLOY / ENV**
- Deploy = **merge to `main` → Vercel auto-deploys from main**. No per-branch previews — to test a branch, merge it first. Merge-to-main is **David's explicit go**, not automatic.
- Vercel plan: **Hobby — 12 serverless-function ceiling** (`api/` is AT the cap; a 13th function silently fails the deploy → consolidate or upgrade to Pro — tech-debt #41). Supabase: **free tier**. Both → Pro at the first-paying-customer launch gate (PLATFORM_STATE ⛔).
- Live prod env keys (cultivar `bgobkjcopcxusjsetfob`, names only — already set, don't re-suggest creating): `VITE_SUPABASE_URL`/`ANON_KEY`, `SUPABASE_URL`/`SERVICE_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, `QBO_CLIENT_ID`/`SECRET`/`REDIRECT_URI`/`ENVIRONMENT`, `OCR_PRIMARY_MODEL`/`FALLBACK_MODEL`, `BLOTATO_API_KEY`, `VITE_DEMO_BUSINESS_ID`, `VITE_TAX_RATE`, `VITE_APP_URL`. Full list → `docs/inventory-env.md`.

**DATA / RISK**
- **ZERO real users — the DB is ALL TEST DATA** until David explicitly says otherwise. No production-data risk; changes can be **bold**. ONE exception: **RLS / tenant-isolation is sacred** (the security architecture ships to real nurseries). Posture: **data bold, security careful**.

**WORKFLOW**
- Lightning writes prompts (never touches the repo) · Thunder executes · **David applies ALL SQL as `postgres`** and owner-proves live. Two bars: **BUILDER-COMPLETE** (committed, verify green) ≠ **OWNER-PROVEN** (David live-confirms via the TRACE trail).
- **Prompt authorship:** Lightning writes ALL Thunder prompts (full context + verify-first + standing rules baked in). David relays them verbatim and decides/owner-proves — **David does NOT compose Thunder instructions from scratch** (avoids underspecified/iffy instructions). Path when David needs Thunder to do something: **David tells Lightning the goal → Lightning writes the prompt → David relays it.**
- **Prompt format:** Lightning delivers every Thunder task as ONE clean copy-paste block (so David uses the copy icon and pastes verbatim) — never a goal for David to assemble, never split across prose.
- **Humor (working method):** the register is John Cleese / Fawlty Towers / Monty Python deadpan, and full "Cleese mode" is EARNED — fired only on a NAMED, proven problem, never on a hope (premature celebration = smoke). Deadpan-precise with codename whimsy by default. (Full doctrine: `docs/operating-doctrine/lightning-david-partnership.md`.)
- **ALL `[TRACE:*]` emits stay ON** until David explicitly lifts them.

**IDENTITY / CONSTANTS**
- Supabase: cultivar (active) **`bgobkjcopcxusjsetfob`** · Ignition (do-not-touch from cultivar code) `ufsgqckbxdtwviqjjtos`.
- David: `david_obrien2016@outlook.com` · user_id `98f4e56b-cd27-4099-a9d8-5c8cbb63d00f`. TRACE business_id **`45830ba7…` [confirm full UUID]**. LAWNS (demo) business_id `a1b2c3d4-0000-0000-0000-000000000001`.
- Architecture Constants **AC-1..AC-4** + naming (`platform_`/`business_`, no vertical nouns in shared schema) → detail in **PLATFORM_STRATEGY.md** (named here, not inlined).
- Demo target **LAWNS** (Leander, TX). **Terry** = owner (tech-shy, approval gatekeeper) · **Lauren Bishop** = manager (the real economic buyer). Demo date **[confirm with David — TBD]**.

**DON'T-RE-LITIGATE** (pointers, not detail → `DECISIONS.md`)
- `person_id` = **overlay, never the auth principal** (RLS stays on `auth.uid()`). · Standard-by-value rule (CLAUDE.md §6 r10). · Semantic-dup / rule-of-three (§6.8). · "Contractor" = **customer tier**, not an entity.

---

## ⚡ ACTIVE STATUS — open this FIRST (in-flight + demo-critical only)

> One screen. Statuses + pointers ONLY — never inline depth (depth lives in the linked feeders).
> Legend: 🔴 not-started / fake / broken · 🟡 in-flight (built-not-wired OR wired-not-proven) · 🟢 live + proven (demoable). States stack.
> LIFECYCLE: when an item is 🟢-proven AND no longer demo-active it ARCHIVES to §A (bottom). The active list stays one screen because DONE leaves.
> Line shape: `[●] Item · state · priority · reuse · deps · → pointer`

**— DEMO-BLOCKERS (in-flight) —**
- 🟡 **Front-door PROMOTION: reveal-conflict + catalog-seed + 4 bug-fixes** (ledger #47) · BUILDER-COMPLETE, owner-proof owed (1 deploy), AUTH-FREE · DEMO · wired: `compareEnteredVsSite`+address into the reveal (owner-RLS write-back) · `populateCatalog` as `action=populate` · demo-route bookend · `businesses.tax_rate` (display+invoice) · shared `useQboConnect` (fixes Settings) · → `DiscoveryGlimpse.tsx` / `api/discovery/ingest.ts` / `useQboConnect.ts`, `npm run verify` exit 0 (eslint 267→266)
- 🟡 **Discovery: fail-loud + persistence** (FIX 1) · wired, owner-proof owed · DEMO · reuse: discovery engine (real) · deps: ANTHROPIC_KEY[live] · → `DiscoveryGlimpse.tsx`, commit `c8094e1`
- 🟡 **Onboarding address round-trip** (FIX 2) · wired, owner-proof owed · DEMO · reuse: businesses.address · deps: signup→wizard · → `OnboardingWizard.tsx`, commit `2c7bf08`
- 🟡 **Walk-and-count inventory loop + OFFLINE sync + RESOLVE L4** (ledger #54 + **#57** + **#61**) · BUILDER-COMPLETE, migration-apply + phone owner-proof owed · DEMO · **#61 resolve L4 (`6e75b66`): NEW shared `canonicalName.ts` token-set key wired as L4 in `handleScan` (after tag_id/sku, before UNKNOWN) → fixes the LAWNS FALSE-UNKNOWN (`vitex-shoal-creek` ↔ "Shoal Creek Vitex" resolves); EQUALITY-ONLY, >1 candidate→UNKNOWN; FAST-FOLLOW = guarded-fuzzy L5/L6 + NEED_CLARIFICATION picker; `[TRACE:RESOLVE]` ON; no schema** · scan→qty→save→next→complete; new `QrScanner`(jsQR)+`InventoryCount`(`/inventory/count`); SETS `business_inventory.qty` + records to GATED `20260626` count tables; UNKNOWN handled; RECONCILE deferred · **#57: sometimes-connected** — all 5 writes route through NEW shared `packages/shared/src/sync/` [namespaced store + offline-op queue + write-through-or-enqueue + reconnect drain, idempotent via clientId]; dead-zone Save no longer fails [offline=queued, online=applied]; identity-stamp (userId+clientTs on every op; start guarded auth+online); same-lot-twice SURFACES a conflict (Keep-first/Keep-new, no silent overwrite); `DataBridge.js` untouched · deps: David applies `20260626_inventory_count_sessions.sql` as postgres + phone owner-proof (airplane-mode count→reconnect drain→recount conflict) · → `walk-and-count-inventory-verify-first.md` · `2026-06-26-databridge-promotion-recon.md`
- 🟡 **OCR → inventory intake** (NEXT build — sibling of walk-and-count) · reuse-and-wire (~70% reuse) · DEMO · reuse: `api/receipts/ocr.ts`(100%, shape:invoice), mobile capture+compress(100%) · deps: line-items→`business_inventory` mapper[M] · → `docs/decisions/OCR-into-inventory-reuse-verify.md`
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
- 🟡 **Field-debug capture** (ledger #60) · BUILDER-COMPLETE, phone owner-proof owed · TOOLING (the instrument for debugging the demo fixes) · console-interceptor → localStorage ring buffer (survives reload/crash) → `?debug=1` 🐞 panel: Share/Download/Copy the `[TRACE:*]` trail as a `.txt` to Lightning; zero per-site edits; decoupled from PWA · deps: none (works in a mobile tab) · → `packages/shared/src/debug/captureBuffer.ts`, `2026-06-27-wrap-and-capture.md`
- 🔴 **PWA wrap** (recommended LAST, not built) · recon-only · thin ~3-4h additive (manifest+icons+apple-meta+app-shell SW), no native shell · sequencing: AFTER resolver+session fixes (SW interacts with the offline/session surface) · → `2026-06-27-wrap-and-capture.md`

---

## 🧵 ARC MAP — the platform as FLOWS, not tiles (integration / drift / landmines live here)

> The 24-board below tracks flat TILES. This tracks ARCS — the end-to-end flows that thread through many tiles. A spine can be all-green at the piece level and still be INCOHERENT end-to-end (a built piece wired to nothing, an absent middle). That gap — and every auth/irreversible LANDMINE — is invisible on the flat board; it lives here.
> Per-piece legend: 🟢 built+proven · 🟡 built-not-wired / not-proven · 🔴 net-new / absent · ⚪ conversation-only / unverified.
> **Every status below traces to a file:line or doc section (verified this pass, not from memory).** Maintain via the end-of-session loop (operating-doctrine/end-of-session-protocol.md step 6).

### 1. FRONT-DOOR ARC — register → invite → scrape-while-away → return → reveal → validate/conflict → seed → vertical → alive dashboard
- **SPINE:** register 🔴 → invite 🔴 → scrape-while-away 🔴 → return 🔴 → reveal 🟡 → validate/conflict 🟢(entered incl. **address**)/🔴(addr→Google) → seed 🟢(catalog) → vertical 🟡 → alive-dashboard 🟡
- **STATUS per piece:** register=🔴 (no minimal screen; entry IS full `OwnerSignup`) · invite=🔴 (only a TEAM-MEMBER invite, `acceptInvitation.ts:53`; no prospect token) · scrape-while-away=🔴 (everything synchronous in-request, `ingest.ts`) · return=🔴 · reveal=🟡 (`DiscoveryGlimpse.tsx` "Here's what we found" — built + now CARRIES the conflict + seed; still a synchronous *signup vertical step*, not a standalone entry) · validate/conflict=🟢 **WIRED 2026-06-26 (ledger #47)** — `compareEnteredVsSite` gained an `address` field (`compare.ts:36-46`) + is now called from `api/discovery/ingest.ts` normal flow (returns `discrepancies`), rendered as a hedged conflict in the reveal with owner-RLS "Use site value" write-back; 🔴 address→Google fork still absent (no geocoder, DEFERRED) · seed=🟢 **WIRED 2026-06-26** — `populateCatalog` runs as `action=populate` on the same ingest fn, fired foreground from the reveal ("Added N items") · vertical=🟡 · alive-dashboard=🟡 (catalog now seeds on signup via the reveal; was 🔴 `populateCatalog` CLI-only — owner-proof owed)
- **ARC STATUS:** 🟡 **the SYNCHRONOUS reveal arc is now coherent** (reveal → address-conflict → catalog-seed → alive dashboard, all auth-free, ledger #47, owner-proof owed on one deploy); the async invite / scrape-while-away / return-later choreography is still **entirely absent** (DEFERRED — 🔴, forces the auth landmine).
- **HOME DOC(S):** `docs/decisions/2026-06-26-front-door-arc-recon.md` (ledger #45) · **ledger #47 (sync promotion built)** · `DISCOVERY_MODULE_BRIEF.md` · `docs/CONCEPT-customer-url-integration-and-autopopulate.md`
- **LANDMINE:** 🚨 **AUTH.** The full async arc inverts today's account→business→scrape order (scrape must run *before* account) → forces the auth-principal reconciliation (`OwnerSignup.tsx:397` signUp, businesses-insert-needs-`owner_id` `:282`, a new pre-auth→`owner_id` claim/merge). The **synchronous reveal + bug-fixes** (compare+address, catalog-populate, QBO/tax/bookend/naming) promoted **auth-free 2026-06-26 (ledger #47)** — boundary never crossed. The Google/address geocode branch + the async arc remain the only auth-/key-gated work.
- **OFF-COURSE / EXTRA:** ⚪ async-invite choreography + ⚪ structured-query architecture (vertical-assembles-the-call) are **conversation-only — owed a doc home** (flagged in the front-door recon, not yet captured).

### 2. OCR / DOCUMENT-ROUTING ARC — capture → extract (one engine) → infer type → confirm → fan-out to many destinations
- **SPINE:** capture 🟢 → extract 🟢 → infer-type 🟡 → confirm 🟢 → fan-out{ receipts/cost 🟢·🔴 · invoice→delivery 🟢 · invoice→inventory 🔴 · leakage 🔴 · audit 🔴 · cross-vertical 🔴 }
- **STATUS per piece:** capture=🟢 (`ReceiptKeeper.tsx:204` + `imageCompression`) · extract=🟢 ONE engine `api/receipts/ocr.ts:309-313` Gemini→Claude, **`shape:'receipt'|'invoice'` param** `:281` · infer-type=🟡 (shape HARD-PINNED `'invoice'` `ReceiptKeeper.tsx:33`; receipt-vs-invoice is a post-OCR *label* `:288-289`, nothing auto-routes the extraction) · confirm=🟢 (`:944-994` + line-item grid) · receipts-write=🟢 (`:422`) but **cost_object spawn=🔴** (dead-ends at `receipts`) · invoice→delivery=🟢 (`api/customers/create.ts:94-101`, consolidated) · invoice→inventory=🔴 net-new (`line_items` extracted but no `business_inventory` mapper) · leakage=🔴 ("coming" stub `:989-992`) · audit=🔴 (table exists, **no app writer**) · cross-vertical=🔴 (cultivar-local; Ignition uses a separate remote engine)
- **ARC STATUS:** 🟡 coherent capture→extract→infer→confirm + TWO live fan-outs (receipts, delivery); **dead-ends after** — inventory scoped-not-built, leakage/audit/cross-vertical absent.
- **HOME DOC(S):** `docs/decisions/OCR-router-spine-recon.md` · `docs/decisions/OCR-into-inventory-reuse-verify.md`
- **LANDMINE:** `api/receipts/ocr.ts` is the credential-bearing seam (Gemini/Anthropic keys, server-only) — a secrets seam, not an irreversible-write seam. No Off-Limits.
- **OFF-COURSE / EXTRA:** receipt→cost_object writer (recon'd, banked) · invoice→inventory build (~70% reuse, the NEXT demo build) · per-receipt deep-link not built.

### 3. COST-TO-PRODUCE ARC — recurring/operating costs → labor → margin → compute → (forward-run) suggestion engine
- **SPINE:** recurring/operating 🟢 → labor 🟢 → margin 🟢 → compute 🟢 → forward-run-suggestion ⚪
- **STATUS per piece:** recurring/operating=🟢 owner-proven (`OperatingCosts.tsx:131`, sole `cost_objects node_type=COST` writer, 2026-06-18) · labor=🟢 owner-proven (D-12, `CostToProduceSettings.tsx` Block 2 + `labor_resources`) · margin=🟢 (`CostToProduce.ts:326` → shared `MarginEngine`) · compute=🟢 owner-proven (`analyze()` ÷N D-16 Model-B `:430-451` + by-project `ProjectCostTree`/`CostRollup.ts`) · forward-run suggestion=⚪ **conversation-only, confirmed ABSENT** (no code; `MASTER_BRIEF.md:368` "cost-to-produce run FORWARD")
- **ARC STATUS:** ✅ coherent + owner-proven for the BACKWARD question (capture→labor→margin→compute→by-project); the FORWARD suggestion engine is doctrine-only.
- **HOME DOC(S):** `DECISIONS.md` (D-8..D-19) · `docs/DECISION-*.md` (cost docs) · `MASTER_BRIEF.md` PART 4 (forward-run)
- **LANDMINE:** 🔒 the **cost wall** — `view_costs` RLS ENFORCED at the data layer (`20260622_oauth_secrets_relocation_and_cost_wall.sql:142-153`; `has_permission`); a Staff session reads `200 []`. Any cost surface must respect it.
- **OFF-COURSE / EXTRA:** unified margin store + cost/margin history (D-13, DEFERRED) · nested projects + BI what-if/blocker wedge (DEFERRED).

### 4. SUGGESTION / SURFACING ARC — pattern-surfacing from owned data (the Regina Principle, product north star)
- **SPINE:** Tier-1 offerings→buyers ⚪ → Tier-2 latent service lines ⚪ → capacity gate (Path A slack / Path B ROI) ⚪ → routing-as-slack-readout ⚪ → map-as-visualizer ⚪
- **STATUS per piece:** ALL ⚪ conversation-only. Grep of `packages/` for a surfacing/suggestion/capacity engine = **zero implementation**. The only artifact is ONE forward-declared tile `tileRegistry.ts:187` (`opportunities`, `status:'planned'`, `depends_on:'services'`) — registry entry, no logic.
- **ARC STATUS:** ⚪ entirely conversation-only doctrine; **NO engine built**. Hard-blocked: it hangs on a **services data model that does not exist yet** (`MASTER_BRIEF.md:366`).
- **HOME DOC(S):** `MASTER_BRIEF.md` PART 4 (`:312-410`) · `DECISIONS.md` OP-9 (Regina Principle) + D-19 (opportunity-cost layer)
- **LANDMINE:** none. (Dependency, not landmine: services unmodeled = the spine this whole arc needs.)
- **OFF-COURSE / EXTRA:** the **services data model** (JOB-like service object, D-19) is the missing spine · three suggestion types (`MASTER_BRIEF.md:403`) · social-intelligence + PMI surfaces are the same engine pointed elsewhere (`:478`, `:488`).

### 5. DELIVERY / ROUTING ARC — schedule → day-group → select stops → bookend (business→stops→business) → Google Maps handoff
- **SPINE:** schedule 🟢 → day-group 🟢 → select-stops 🟢 → bookend 🟢(real)/🟡(demo builder, WIRED 2026-06-26) → Maps-handoff 🟢 · [geocoding 🔴]
- **STATUS per piece:** schedule=🟢 (OCR-invoice `customers/create.ts:94-101` + cart `orders`) · day-group=🟢 (`DeliverySchedule.tsx:94-106`) · select-stops=🟢 ("Route this day" `:152-166`) · bookend(real)=🟢 origin=`businesses.address` round-trip unshift+push (`DeliveryRoute.tsx:80-82,181-191`; **1-stop OWNER-PROVEN 2026-06-26 ledger #42, multi-stop owed** — only 1 live delivery, no seeder) · bookend(DEMO/onboarding builder)=🟡 **WIRED 2026-06-26 (ledger #47)** — `OnboardingWizard.DeliveryWizardPath.buildRoute` now bookends business→stops→business via `nurseryInfo.address` (mirrors the live seam); BUILDER-COMPLETE, owner-proof owed · Maps-handoff=🟢 (`DeliveryRoute.tsx:37-40` `buildMapsUrl`) · geocoding=🔴 absent (no geocoder, no Maps key — Google geocodes the raw strings)
- **ARC STATUS:** 🟢 coherent real path (schedule→day-group→select→bookend→Maps); live **multi-stop** bookend is owner-proof-owed; the DEMO onboarding route builder now ALSO bookends (ledger #47, owner-proof owed).
- **HOME DOC(S):** `docs/built-inventory.md` (delivery loop) · `docs/decisions/2026-06-25-routing-seeder-seam-recon.md` · `docs/decisions/2026-06-25-address-spine-defect-recon.md`
- **LANDMINE:** none irreversible (read-only of `deliveries`/`orders` + a Maps URL handoff). Net-new geocoder = mis-geocode risk (Wimberley→San Marcos), a build risk not a code landmine.
- **OFF-COURSE / EXTRA:** geo-seeder (3–4 verified nearby stops from the business address — recon'd, **hard-gated on a geocoder + key**) · routing-as-capacity-readout (the link into ARC 4).

### 6. DISCOVERY ARC — website read → two-pass (Haiku identity / Sonnet analysis) → synthesis email → seed.ts → catalog-populate
- **SPINE:** website-read 🟢 → two-pass 🟢 → synthesis-email 🟢 → seed.ts 🟡 → catalog-populate 🟡
- **STATUS per piece:** website-read=🟢 (`adapters/website.ts:87` GET + `stripHtml` + `/about` fallback) · two-pass=🟢 (`engine.ts:24` Haiku identity / `:72` Sonnet analysis) · synthesis-email=🟢 **code DOES send** (`synthesis.ts:19` → `ingest.ts:186` → `send.ts:55` Resend; v0 "SHIPPED" corroborated) · seed.ts=🟡 built but conditional (fires only when `businessId` in ingest body, **not wired to signup** — v2 gap, `ingest.ts:169`) · catalog-populate=🟡 built, **CLI-only** (`populate.ts:128` ← `scripts/populate-catalog.ts`; profile-persist depends on the gated `20260621` migration)
- **ARC STATUS:** 🟡 coherent pipeline but spans two surfaces — the ingest endpoint drives read/two-pass/synthesis/send/conditional-seed (live); catalog-populate is CLI-only and seed isn't wired to signup. (This arc is the substrate the FRONT-DOOR arc consumes.)
- **HOME DOC(S):** `DISCOVERY_MODULE_BRIEF.md` · `docs/DISCOVERY-ONBOARDING-CONCEPT-COMPILED.md`
- **LANDMINE:** none irreversible. Gap: discovery writes nothing durable to the DB (in-memory one request, v2-horizon, `DISCOVERY_MODULE_BRIEF.md:171`).
- **OFF-COURSE / EXTRA:** discovery persistence (v2) · recognition-moment **status contradiction** (committed in `CONCEPT-customer-url…:108-113` vs "do not build" in `THOUGHTS.md:15` — David reconciles).

### 7. IDENTITY / ROLES / SECURITY ARC — auth principal → membership resolution → role/permission chokepoint → RLS wall → audit (status from ledger + migration file:line; not re-swept this pass)
- **SPINE:** auth-principal 🟢 → membership-resolution 🟢 → role/permission chokepoint 🟢 → RLS wall 🟢 → role-config console 🟡 → audit-log 🟢(spine)/🔴(first writer)
- **STATUS per piece:** auth-principal=🟢 (`auth.uid()`, Off-Limits) · membership-resolution=🟢 (`BusinessProvider.tsx`; `is_active_member()` canonical RLS, ledger #3 owner-proven) · chokepoint+permissions=🟢 (`can()` + financial-permission backfill, ledger #2) · RLS cost/write wall=🟢 read-wall owner-proven / write-wall built (ledger #4/#5) · role-config console=🟡 `/roles` BUILDER-COMPLETE, owner-proof owed (ledger #16/#16B) · audit-log=🟢 spine OWNER-PROVEN (ledger #19) but 🔴 **first writer NOT built** (#19B, factory-reset audit row)
- **ARC STATUS:** 🟢 the security wall is real and largely owner-proven; the audit *spine* exists but **nothing writes to it yet** (#19B owed) and the role console is deploy-owner-proof-owed.
- **HOME DOC(S):** `docs/CLOSE-OUT-LEDGER.md` rows #2/#3/#4/#5/#16/#19 · `PLATFORM_STRATEGY.md` (AC-2/AC-3)
- **LANDMINE:** 🚨 RLS / tenant-isolation is **sacred** (ships to real nurseries — "data bold, security careful"); `oauth.ts` + PIN-auth are Off-Limits.
- **OFF-COURSE / EXTRA:** Person-spine CP1/CP2 (`person_id` overlay, migration STAGED — see ⚡ ACTIVE STATUS) · audit first-writer (#19B, UNBLOCKED).

### 8. ASSET / INVENTORY / PMI ARC — assets → inventory → walk-and-count → preventive-maintenance schedule → service log (status from ledger + handoff file:line)
- **SPINE:** assets 🟢 → inventory 🟢 → walk-and-count 🟡 → PMI schedule 🟡 → service log 🟢 → (forward) reconciliation 🔴 · PMI↔Delivery ⚪
- **STATUS per piece:** assets=🟢 (`BusinessAssets.tsx` editable assign+categorize, handoff 2026-06-18) · inventory=🟢 (`BusinessInventory` / `/inventory`, live) · walk-and-count=🟡 LOOP BUILT scan→qty→save→next→complete (`InventoryCount`+`QrScanner`/jsQR, `/inventory/count`; SETS qty + records to GATED `20260626` count tables; ledger #54) BUILDER-COMPLETE, migration-apply + phone owner-proof owed · **walk-and-count RESOLVE=🟡 L4 token-set EQUALITY WIRED 2026-06-27 (ledger #61, `6e75b66`)** — fixes the LAWNS FALSE-UNKNOWN: NEW shared `packages/shared/src/utils/canonicalName.ts` [`nameTokenSet`/`canonicalNameKey`/`tokenSetsEqual`, barrel-exported = the ONE canonical key voice/typed/QR share] wired as L4 in `InventoryCount.handleScan` after tag_id/sku, before UNKNOWN [scan-slug tokens == catalog NAME tokens, order-insensitive; 1 match resolves, >1 → UNKNOWN never auto-pick = NEED_CLARIFICATION seam]; `vitex-shoal-creek` ↔ "Shoal Creek Vitex" now resolves; EQUALITY-ONLY [no false-match risk]; L3 stored-slug + L5 guarded-subset + L6 stemmed DEFERRED, seam at L4 [FAST-FOLLOW = guarded-fuzzy + picker UI]; `[TRACE:RESOLVE]` ON; NO schema/migration; 21/21 unit; BUILDER-COMPLETE, phone owner-proof owed · **walk-and-count OFFLINE=🟡 WIRED 2026-06-26 (ledger #57)** — all 5 count writes route through NEW shared `packages/shared/src/sync/` [namespaced store + typed offline-op queue + write-through-or-enqueue + reconnect drain, idempotent via clientId=insert-PK]; dead-zone Save held+synced-on-reconnect (the `:181` abort is gone); identity-stamp (userId+clientTs per op, start guarded auth+online); same-lot-twice SURFACES a conflict (Keep-first/Keep-new, no silent overwrite); `DataBridge.js` untouched [44 Ignition imports, donor-reference] — its persistence half lifted+de-keyed, the sync-on-reconnect half it never finished now built; I&A heavy-sync DEFERRED (identity-stamp only); BUILDER-COMPLETE, phone owner-proof owed · PMI schedule=🟡 accept-flow + `interval_days` fix BUILDER-COMPLETE owner-proof owed (ledger #22, `pmiInterval.ts`) · service log=🟢 (`business_service_log`) · reconciliation (counted-vs-expected, sold/dead/missing)=🔴 DEFERRED, record model leaves room (`inventory_counts`) · `override_maintenance` permission=🟡 DECLARED, mechanism deferred (ledger #22B) · PMI↔Delivery coupling=⚪ conversation-only
- **ARC STATUS:** 🟡 the asset/inventory/PMI spine is built and mostly live; walk-and-count loop (now offline-capable via the shared sync slice, #57) + PMI accept-flow are owner-proof-owed; reconciliation, predictive/override + PMI↔Delivery layers are deferred.
- **HOME DOC(S):** `docs/CLOSE-OUT-LEDGER.md` rows #20/#22/#22B · `data/grower-scan/pmi-recon-ignition-cultivar.md` · `docs/CONCEPT-pmi-operational-intelligence.md`
- **LANDMINE:** none irreversible (membership-scoped RLS, AC-2).
- **OFF-COURSE / EXTRA:** PMI operational-intelligence surface (the surfacing engine pointed at equipment — ARC 4 family) · `override_maintenance` mechanism (defer/reason-required write + audit), gated on PMI↔Delivery.

---

## 📚 CAPTURE INDEX — the single retrieval point (so nothing is re-derived or re-captured)

> One row per captured decision/doctrine/concept. **The POINTER is the point — not the content** (one fact, one home; this references it). Read this index → know what exists and where, instead of re-deriving. Swept from the actual docs this pass (file:line / section). Maintain via the end-of-session loop (step 6): a capture without an index row is **not done**.
> ⚠️ **CONVERSATION-ONLY (owed a doc home — listed here so they're not lost, but they have no canonical doc yet):** async-invite-gated front-door choreography · structured-query architecture (vertical-assembles-the-call). Both flagged in the front-door recon; do NOT re-derive — capture them to a doc when built.

**DECISIONS.md — operating (OP-) + product (D-) decisions** *(canonical short entries; several D- have a fuller home doc, noted in the cost-docs block)*
| ID | HOME (file:line) | WHAT IT SAYS | ARC |
|---|---|---|---|
| OP-1 | DECISIONS.md:99 | Crush competition by ANY *ethical* means within the covenant — ethics is the method | platform-wide |
| OP-4 | DECISIONS.md:133 | STD-003: `[TRACE:*]` ON by default, off only after OWNER-PROVEN; two bars (builder vs owner) | platform/arch |
| OP-5 | DECISIONS.md:153 | Good-enough model + AI-as-equalizer; never demand labor the owner won't give | platform-wide |
| OP-6 | DECISIONS.md:169 | Graceful degradation — three owner-fidelity tiers (maintain / confirm / infer) | platform-wide |
| OP-7 | DECISIONS.md:186 | AI infers → proposes → owner one-tap confirms (expensive records) | suggestion |
| OP-8 | DECISIONS.md:205 | HAVE / NEED / WANT three-lens recon standard | working-method |
| OP-9 | DECISIONS.md:228 | The Regina Principle — move "noticing what to do" off the owner onto the tool | suggestion |
| D-1 | DECISIONS.md:256 | Cost-object schema = rename-in-place to ONE FK-able node table | cost-to-produce |
| D-2 | DECISIONS.md:267 | PMI/service-log child column stays `asset_id` | asset/pmi |
| D-3 | DECISIONS.md:277 | `parent_id` ON DELETE SET NULL — orphan-to-root, never cascade-destroy | cost-to-produce |
| D-4 | DECISIONS.md:286 | Two edge tables: structural (use_fraction) vs temporal (assignments) | cost-to-produce |
| D-5 | DECISIONS.md:298 | Cost event is truth; receipt is signal + substantiation marker (two axes) | cost / OCR |
| D-6 | DECISIONS.md:340 | Capture everything, surface the decision-changing few | suggestion |
| D-7 | DECISIONS.md:359 | A card is not the unit of truth (no business-vs-personal proxy) | cost-to-produce |
| D-8 | DECISIONS.md:377 | Cost shape: RECURRING-FIXED (÷N pool) vs PER-OCCASION | cost-to-produce |
| D-9 | DECISIONS.md:395 | Honesty contract: KNOW / THINK / REASON / NEED-CLARIFICATION | cost / multiple |
| D-10 | DECISIONS.md:425 | Cost-to-Produce primary lens is BY PROJECT, not flat pool | cost-to-produce |
| D-11 | DECISIONS.md:466 | Cost category = Schedule C / QBO chart-of-accounts (don't invent) | cost-to-produce |
| D-12 | DECISIONS.md:479 | Labor model: robust schema now, UI incremental, intelligence deferred | cost-to-produce |
| D-13 | DECISIONS.md:491 | Unified margin store + cost/margin history — DEFERRED | cost-to-produce |
| D-14 | DECISIONS.md:505 | Attribution follows consumption; shared cost by use-fraction carve-out | cost / platform |
| D-15 | DECISIONS.md:525 | Cost object = COMPRESSED industry-standard record (the 20%) | cost-to-produce |
| D-16 | DECISIONS.md:545 | Pricing Model B: cost-to-serve ÷ N ÷ (1−margin) + separate payback line | cost-to-produce |
| D-17 | DECISIONS.md:565 | One pricing engine, four display surfaces, three audiences | cost / discovery |
| D-18 | DECISIONS.md:587 | Platform overhead HAND-allocated; platform = computed remainder | cost / platform |
| D-19 | DECISIONS.md:616 | A priced service carries THREE cost layers; the hidden third = OPPORTUNITY COST | cost / suggestion |
| D-20 | DECISIONS.md (D-20) | Geocoder needs ZERO new functions — two keys, fold into `ingest.ts`, stand up at front-door re-staging | front-door / discovery |
| D-21 | DECISIONS.md (D-21) | DESIGN LAW — screen real estate is sacred; direct access over scroll (density default; 4 rules); canonical home for direct-access-over-scroll | cross-cutting / UX |
| D-22 | DECISIONS.md (D-22) | Admin = business-entity config; Settings = user-self — the nav gating axis (sibling to D-21) | cross-cutting / UX |

**MASTER_BRIEF.md PART 4 — surfacing / Regina captures** *(arc = suggestion/surfacing unless noted)*
| NAME | HOME | WHAT IT SAYS | ARC |
|---|---|---|---|
| Regina Principle (engine thesis) | MASTER_BRIEF.md:312 | The surfacing engine = reason-to-exist: right action visible at the right moment | suggestion |
| Regina anchor story | MASTER_BRIEF.md:327 | One reminder → one visit → 3 stacked services → trust → repeat | suggestion |
| Warranty/courtesy split (planted vs purchased) | MASTER_BRIEF.md:339-340 | Planted-by-us = warranty touch (may say "warranty"); purchased-only = addon (must not) | suggestion |
| "Did-we-plant-it" flag (claim-governor) | MASTER_BRIEF.md:346 | One boolean decides which principle fires + what copy may claim | suggestion |
| Customer-photo-in channel | MASTER_BRIEF.md:350-355 | Customer snaps tree → remote check / care advice; 5th image→AI-extract primitive | suggestion / OCR |
| 2×2 touch matrix | MASTER_BRIEF.md:357-362 | plant-vs-purchase × remote-vs-in-person = 4 cells, one engine | suggestion |
| Services as the spine | MASTER_BRIEF.md:366 | Surfacing needs a services model; service = JOB-like vs product-only | suggestion / asset |
| Suggestion engine = cost-to-produce run FORWARD | MASTER_BRIEF.md:368 | Same engine, forward: "what would a new service cost + would it pencil?" | suggestion / cost |
| Capacity gate (responsible-adult rule) | MASTER_BRIEF.md:370-373 | Path A slack = upside / Path B maxed = investment decision (ROI) | suggestion / delivery |
| Routing IS the capacity readout | MASTER_BRIEF.md:375 | Schedule density = utilization; route = logistics + opportunity + slack gauge | delivery / suggestion |
| Lauren's fertilizer — 2nd anchor (risk-flip) | MASTER_BRIEF.md:378 | 30% yes ≠ 70% failure; platform shows the risk profile, owner decides | suggestion |
| Map IS the demo | MASTER_BRIEF.md:382-385 | Map = SHOWING (not telling) the owner she's standing in an opportunity | delivery / suggestion |
| Build sequence: list, then map | MASTER_BRIEF.md:397 | List-surfacing first (no geo) proves the thesis cheaply; map is the north-star lens | suggestion |
| Three suggestion types | MASTER_BRIEF.md:403 | Immediate add-ons / scheduled services / reorder reminders | suggestion |

**DISCOVERY / FRONT-DOOR captures**
| NAME | HOME | WHAT IT SAYS | ARC |
|---|---|---|---|
| No-pressure front door | DISCOVERY_MODULE_BRIEF.md:28 | builtwithcai.com = pain-point-first demonstration, not a pitch | front-door |
| Honest friction at the account gate | DISCOVERY_MODULE_BRIEF.md:50 | Minimal account gate filters browsers + becomes the platform account | front-door / identity |
| Silent Partner Analysis (the output) | DISCOVERY_MODULE_BRIEF.md:69 | The synthesized analysis email reflecting the prospect's specific pain | discovery |
| One Auth, Two Products | DISCOVERY_MODULE_BRIEF.md:117 | The discovery account IS the vertical-OS Supabase auth account | identity / front-door |
| seed.ts (profile → service_offerings) | DISCOVERY_MODULE_BRIEF.md:146,169 | Discovery profile seeds offerings; in-memory via ingest when businessId passed | discovery |
| Build phasing v0→v1→v2 | DISCOVERY_MODULE_BRIEF.md:163-190 | v0 website+email (shipped) → v1 voice → v2 gated surface + one-auth | discovery / front-door |
| Discovery persistence = v2 gap | DISCOVERY_MODULE_BRIEF.md:171 | ingest writes nothing to DB (one request); persistence is v2, not debt | discovery |
| Customer-URL integration + autopopulate | docs/CONCEPT-customer-url-integration-and-autopopulate.md | Recognition moment + one-click autopopulate IS the discovery arc (reuse) | front-door / discovery |
| Discovery/onboarding/front-door COMPILED | docs/DISCOVERY-ONBOARDING-CONCEPT-COMPILED.md | Compiled superset incl. "dashboard-cannot-be-empty" + front-door | front-door / discovery |
| Front-door arc TRUE MAP | docs/decisions/2026-06-26-front-door-arc-recon.md | The verified map + the auth landmine (promote once, not patch) | front-door |

**docs/decisions/*.md — dated recons**
| NAME | HOME | WHAT IT SAYS | ARC |
|---|---|---|---|
| Grower import + mobile roles | docs/decisions/2026-06-21-grower-import-and-mobile-roles.md | Locked design: grower CSV import, margin referee, role×device visibility | discovery / identity |
| Role-based financial permissions | docs/decisions/2026-06-21-role-financial-permissions.md | Sign-off: roles gate cost/wage/pricing data | identity/roles |
| Address-spine defect recon | docs/decisions/2026-06-25-address-spine-defect-recon.md | Delivery URL = single-waypoint no anchor; customer addr mis-geocoded | delivery |
| Routing-seeder seam recon | docs/decisions/2026-06-25-routing-seeder-seam-recon.md | Seams a geo-seeder would ride; NO geocoder/key exists (net-new) | delivery / discovery |
| OCR router + spine recon | docs/decisions/OCR-router-spine-recon.md | ONE capture+extract engine → many destinations; extract spine once | OCR |
| OCR → inventory reuse-verify | docs/decisions/OCR-into-inventory-reuse-verify.md | image→OCR→business_inventory = ~70% reuse-and-wire, not net-new | OCR / inventory |

**docs/DECISION-*.md — full cost/pricing home docs** *(fuller depth behind the DECISIONS.md short entries above)*
| NAME | HOME | SERVES | ARC |
|---|---|---|---|
| Pricing model (D-16) | docs/DECISION-pricing-model.md | Model B: cost-to-serve + payback line | cost-to-produce |
| Pricing display surfaces (D-17) | docs/DECISION-pricing-display-surfaces.md | 4 surfaces / 3 audiences; prospects never see owner economics | cost / discovery |
| Cost object model-of-record (D-15) | docs/DECISION-cost-object-model-of-record.md | The compressed industry-standard cost record | cost-to-produce |
| Labor cost model (D-12) | docs/DECISION-labor-cost-model.md | Fully-burdened rate, cost-vs-bill, employee-vs-contractor | cost-to-produce |
| Cost category dimension (D-11) | docs/DECISION-cost-category-dimension.md | Adopt Schedule C / QBO taxonomy | cost-to-produce |
| Cost attribution + shared cost (D-14) | docs/DECISION-cost-attribution-and-shared-cost.md | Attribution by consumption; shared cost by use-fraction | cost / platform |
| Platform overhead carve-out (D-18) | docs/DECISION-platform-overhead-carveout.md | Hand-allocated overhead; platform = remainder, guarded 100% | cost / platform |
| Unified margin store + history (D-13) | docs/DECISION-unified-margin-store-and-history.md | Unify margin storage + add history (deferred) | cost-to-produce |
| Project-lens UI (D-10) | docs/DECISION-project-lens-ui-design.md | By-project cost lens UI | cost-to-produce |
| Cost accounting model | docs/DECISION-small-business-cost-accounting-model.md | project × nature × shape (absorbs unified-cost-model-option2) | cost-to-produce |
| Nested projects + BI what-if | docs/DECISION-nested-projects-and-BI-whatif-blocker.md | Nesting (near) vs BI what-if wedge (later) | cost / platform |
| Cost-to-produce by-project lens (D-10 concept) | docs/CONCEPT-cost-to-produce-by-project-lens.md | Primary lens is BY PROJECT not flat pool | cost-to-produce |
| PMI operational intelligence | docs/CONCEPT-pmi-operational-intelligence.md | Surfacing engine pointed at equipment | asset/pmi / suggestion |
| Social scheduling + measurement | docs/CONCEPT-social-scheduling-and-measurement.md | Social-intelligence scheduling + measurement surface | suggestion |
| Andrew decision-state | docs/ANDREW-decision-state.md | Settled-vs-open state for the asset/inventory build | asset/inventory |

**Operating doctrine (working-method)**
| NAME | HOME | WHAT IT SAYS | ARC |
|---|---|---|---|
| Lightning–David partnership | docs/operating-doctrine/lightning-david-partnership.md | The working-relationship doctrine (gates, two-bar, verify-first, headers) | working-method |
| End-of-session protocol | docs/operating-doctrine/end-of-session-protocol.md | The ritual that keeps THIS bootstrap current (incl. ARC MAP + CAPTURE INDEX) | working-method |

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
| 🟡 | **2.3** Walk-and-count inventory | LOOP BUILT (scan→qty→save→next→complete, `InventoryCount`+`QrScanner`/jsQR) + OFFLINE-CAPABLE (ledger #57 — shared `sync/`: dead-zone Save queues + drains, identity-stamp, double-count surfacing) + **RESOLVE L4 token-set EQUALITY (ledger #61 — shared `canonicalName.ts`, fixes the LAWNS FALSE-UNKNOWN; EQUALITY-only, guarded-fuzzy L5/L6 = fast-follow)**, BUILDER-COMPLETE, migration gated + phone owner-proof owed; OCR-intake sibling still NEXT | ledger #54 · #57 · #61 · `walk-and-count-inventory-verify-first.md` · `2026-06-26-grower-resolve-design.md` |
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
- **DataBridge.js** — local-first persistence (localStorage). → **PROMOTED (min slice) 2026-06-26 (ledger #57):** the persistence half is lifted+de-keyed into NEW shared `packages/shared/src/sync/` and the sync-on-reconnect half it never actually finished (write-only queue, no drain — recon #55) is now BUILT there; `DataBridge.js` itself is LEFT IN PLACE as donor-reference (44 Ignition imports — do NOT move/deprecate). First consumer = the walk-and-count loop (LAWNS back-acre dead zones). Full multi-vertical bus + I&A offline-sync still DEFERRED.
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

## 7b. LIGHTNING LOAD-MENU (drag these by subject — Lightning can't open repo files)

> Cold-start by subject: name today's subsystem, drag over the .md files in its row. §7 is the *reference library* (what each doc is); this is the *load-by-task index* (what to paste for a given job). All paths verified present at write-time (2026-06-25).

| SUBJECT | DRAG THESE .md FILES (verified paths) |
|---|---|
| **Discovery** | `DISCOVERY_MODULE_BRIEF.md` · `docs/DISCOVERY-ONBOARDING-CONCEPT-COMPILED.md` · `docs/built-inventory.md` (Discovery Module section) · `data/grower-scan/role-and-discovery-recon.md` |
| **OCR / document routing** | `docs/decisions/OCR-router-spine-recon.md` · `docs/decisions/OCR-into-inventory-reuse-verify.md` · `docs/built-inventory.md` (Receipt Keeper / OCR entries) |
| **Address / delivery / geo-seeder** | `docs/decisions/2026-06-25-address-spine-defect-recon.md` · `docs/decisions/2026-06-25-routing-seeder-seam-recon.md` |
| **Cost / margin / cost-to-produce** | `docs/strategy/cost-to-serve-framework.md` · `docs/cost-to-produce/COST-TO-PRODUCE-DESIGN.md` · `docs/built-inventory.md` (Cost-to-Produce / Cost-Discovery entries) · `docs/DECISIONS.md` |
| **Identity / roles / security** | `docs/specs/SPEC-identity-and-access-2026-06-04.md` · `docs/specs/SPEC-identity-and-access-addendum-2026-06-04.md` · `data/grower-scan/cost-wall-leak-scope.md` · `data/grower-scan/role-machine-and-signing-recon.md` · `docs/built-inventory.md` (RLS / security entries) |
| **Architecture / where-things-live** | `PLATFORM_STRATEGY.md` · `data/grower-scan/dual-inventory-cultivar-ignition.md` |
| **Working method / voice / humor** | `docs/operating-doctrine/lightning-david-partnership.md` |

Lightning can't open these — drag the rows matching today's subject. When a new subject-area doc is written, add it here (same discipline as the §7 reference library): verify the path exists before listing it, and never list a file that isn't there.

---

## §A. ✅ DONE / ARCHIVED (graduated out of ⚡ ACTIVE STATUS)

> 🟢-proven items that are no longer demo-active land here so the active list stays one screen.
> Keep one line each (state + date + pointer); full detail in the feeders / CLOSE-OUT-LEDGER.

- *(none yet — the first ⚡ items archive here when David owner-proves them post-deploy.)*

---

*Paste this first. Then state the session goal. Lightning: confirm you've read §0 + ⚡ ACTIVE STATUS, then engage. Don't re-ask for context this doc already provides.*
