# TRACE — SESSION BOOTSTRAP (paste this FIRST in any new chat)

> **What this is:** the single front-door doc — and the CANONICAL status front-page. Paste this at the start of every new Lightning (Claude-in-chat) session to get current in ~90 seconds. It is the MAP, not the territory — deep detail lives in the reference library (§7) and the feeder docs each ⚡ line links to. Structure is FIXED; only the values change. Update at session-end (see END-OF-SESSION PROTOCOL doc + CLAUDE.md §9).
>
> **Last updated:** 2026-08-24 (**#207 — 🔧 BUILD: THE SWALLOWED STORAGE FAILURE. A LOCAL WRITE THAT DID NOT PERSIST STOPS REPORTING SUCCESS.** 🔴 **`store.ts` discarded a quota / disabled-storage exception, so `enqueue()` returned normally over a queue that had not grown — under a banner reading *"counts are saved on this phone and will sync when you're back in signal."*** 🔴 **AND THE HALF THE RECON DID NOT HAVE, MEASURED BY COUNTING DATABASE CALLS: THE ONLINE PATH WAS WORSE — it returned `applied`, the strongest claim the engine can make, with `drain applied:0 failed:0 remaining:0` and the database called ZERO times.** Success inferred from an ABSENCE (A9/D-9 on the write path; R-12's class on the client side of the wire). ✅ **`save()` STILL NEVER THROWS — the exception is RETURNED** as `StoreWriteResult`, R-11's union discipline applied to the write side, with `quota` and `unavailable` kept distinct because they need different actions. ✅ **AN UP-FRONT WRITE-THEN-READ-BACK PROBE warns BEFORE the walk** — *the difference between losing one entry and losing an afternoon* — and reads back deliberately, because a Private tab can ACCEPT `setItem` and persist nothing. ✅ **AFTER: offline → `failed` naming STORAGE; online → `applied` with the database called ONCE, so the claim is TRUE.** ⚠️ **IndexedDB NOT taken — OWED as S-A, with its data answer written down.** **GATE 0 PROVEN BY WATCHING THE TRANSITION `680b00d` → `4056de8`.** NO schema, NO migration, NO cap.) — PRIOR: 2026-08-23 (15) (**#206 — 🔧 BUILD: THE SCANNER STOPS BLAMING THE TAG FOR A DEAD ZONE — R-11's FIRST INSTANCE.** 🔴 **`stockLineResolver`'s three reads discarded the Supabase `error` and substituted `(rows ?? [])`, so a network failure returned the BYTE-IDENTICAL value a genuinely absent tag returns — and the app told Lauren, by name, in a modal, to *check the tag*.** ✅ **THE FIX IS A TYPE, NOT A DISCIPLINE: new `ReadResult<T>` = `{ok:true;value}` | `{ok:false;error}` — `.value` is unreachable without handling the failure, so `tsc` refuses the careless caller.** **PROVEN BY THE CHANGE: the signature flip produced 36 NET-NEW `tsc` ERRORS, one per site that had been ignoring a failure, across ALL 5 call sites in 3 files** — the thing a returnable `{data,error}` demonstrably cannot do. ✅ **`isConnectivityError` MOVED (not copied) to `utils/supabaseError` — one predicate, two consumers (§6 r8).** 🔴 ***"Check the tag"* can no longer appear on a connectivity failure, on any of the three screens** — checkout gets its own `'unreachable'` phase, the count sheet swaps its heading and **keeps typed entry open**, the QR profile stops saying *Plant not found*. ⚠️ **AND BEYOND COPY: resolve-before-create now REFUSES on a failed read instead of falling through to *genuine NEW variety*** — an unreadable catalog looked identical to an empty one and the answer was *create it*. ✅ **The undocumented 24-hour QR read cache is DECLARED, not removed.** **GATE 0 PROVEN FROM THE DEPLOYED BUNDLE (`3d0944b`) — new copy present AND old copy survived.** ⚠️ **R-11's 30-site build STAYS OWED.** NO schema, NO migration, NO cap.)
- 🟡 **ROUTE HANDOFF — WHAT THE DRIVER RECEIVES IS WHAT THE MANAGER SAW, ledger #286, R-116** · 🔴 **the optimised order never reached the link: `routeUrl` was frozen in `buildRoute()` eight lines before the optimised answer was cleared, and the source array was `created_at DESC` — the newest sale rung up was the first stop driven** · **the split fell along the line between who could SEE it and who GOT it** (pins ✅ · on-card list ✅ · link/SMS/clipboard 🔴), which is why it lived 14 months · ✅ **Google was innocent — no `optimize` parameter exists; it rendered our list faithfully** · **FIX: `routeUrl` is no longer state** — one derivation from `displayStops` (`packages/cultivar-os/src/lib/routeHandoff.ts`) feeds all four consumers, David's option B over A · the SMS count read `selectedOrders.length` and said *"(5 stops)"* above a 3-stop link · **44 probes · 20 mutants, 20 caught** incl. S1 (the defect restored) and S8 (reach, not subject) · ✏️ **the story gate found the CAUSE: the archived route story is OWNER-PROVEN and claims *"the pins, the on-card list, and the route all agree"* — all three on her screen** · ⚠️ **waypoint cap REPORTED not built (R-117, #223): 41% of LAWNS's days exceed Google's documented mobile cap of 3 and our form's real cap is UNKNOWN** · **board 0 of 8 — CARD 2 (text it, TAP it on a phone) has never been run in this feature's history** · **BUILDER-COMPLETE, owner-proof owed**
- 🟢 **SELECT-POLICY CAP — `npm run verify:select-policies`, CHAINED into `npm run verify`** · every live table needs RLS **and** a policy that can actually SELECT, **or a declared reason** in `select-policy-declarations.json` · tables DERIVED from the migration corpus, never a hardcoded list · **the declaration list itself fails the build when it goes stale** (#73's lesson) · 17 probes both directions · RED-FIRST on the real corpus (exit 1, 2 undeclared, both then verified deliberate) · **closes Open Architecture Decision #11, whose own trigger fired 3× with nothing behind it** · ledger #178
- 🟢 **DECISION REGISTER RECONCILED** · **D-55** (tier math = percent-off-baseline) numbered at last — it had three docs and no address · **D-37/D-38/D-39 rows added** after `DECISIONS.md` jumped D-36 → D-40 for three weeks · six CLAUDE.md open-decision rows CLOSED (5 principle names settled-by-usage · #10 data-values · #11 by build) · **`RULINGS.md` +4 rows, +2 OWED** (geofence radius/accuracy · the US-C hand-off mechanism) · ledger #178
- 🟢 **RATCHET BASELINES KEYED ON `file::binding#table.verb`** (`scripts/lib/siteKey.mjs`, shared by zero-row-writes + field-lists + the shape capA already used) · comments/imports/blank lines no longer re-key a site · **a genuinely new site still fails** · `--dump` gives a count-identity proof for the next key change for free
- 🟢 **`planned` PERMISSION STATUS — BUILDS 1 + 2 DONE** · manifest chip (dashed amber, non-grantable) + tile path (amber SOON, renders regardless of `can()`) + **`<BeingBuilt>` mounted at last** · capA assertions 5 + 6 · **requirement hook still NOT built** (`onPlannedSelect` is a declared seam) · **cards 12 · 18 · 19 · 20, board 0 of 20 — card 20 is runnable ONLY as STAFF**
- 🟢 **capA ASSERTION 5 — THE A7 CLIENT-GATE SWEEP** · every literal permission string in `packages/*/src` outside the model FAILS the build · **the class is MEASURED: 4 strings / 5 sites** · 2 live defects fixed (`costs:read` · `inventory:import_price`), **2 DECLARED awaiting your rulings #87/#88** (`view_dashboard` fallback · `reports:read`) · cards 16–17, board 0 of 17
- 🟢 **capA ASSERTION 4 — THE GRANT SET BASELINE, `npm run verify:authority` / `authority:baseline`** · 41 sites · a widening fails the build, which is the direction nobody reports · **2 live legacy-string gates found on run 1, declared KNOWN-BAD not fixed (#85/#86 — `view_costs` maps to EIGHT successors, David's call)** · blind spot PRINTED: 6 dynamic sites, default bundles not tenant arrays
- 🟡 **CHECKOUT DELIVERY DATE — the string is `orders:create`, ledgers #172/#173** · two wrong strings first (`deliveries:create` LOSSY, `orders:update` right-for-the-wrong-reason) · **a permission gates a CAPABILITY, not a FIELD** · **STAFF get the field** · ✅ `submit.ts` needs nothing (#84 closed by ruling) · **board 0 of 15**, card 15 runs as MANAGER **and** STAFF
- 🟡 **CHECKOUT DELIVERY DATE — the string is `orders:update`, ledger #172** · was `deliveries:create` (Phase 2, LOSSY: manager lost the field) · **wrong on the merits** — the field writes `orders.delivery_date`, never the `deliveries` table · ⚠️ **CLIENT-GATE ONLY, `submit.ts` guards nothing here (#84)** · caught by **owner-test card 6**, not by a cap · **board 0 of 15** (`docs/owner-tests/authority-model-full-surface-test.md` card 15, MANAGER `df7723be` never owner)
- 🟢 **ARCHITECTURAL STANDARD A1–A9 — `docs/standards/platform-architecture-standard.md`** · the platform had 24 VERIFICATION standards and none said how to BUILD a surface · **3 enforced (A2/A4/A8), A1/A3/A5/A6/A9 REVIEW-ONLY and labelled PLACEHOLDERS FOR CAPS** · audit: 33 entities, 80 write paths, 17 violate A2 — **17 DECISIONS owed, not 17 builds** · ledger **#169**
- 🟢 **FOUR CAPS CHAINED into `npm run verify`** · `verify:write-paths` · `verify:zero-row-writes` (A8) · `verify:field-lists` (A4) · `verify:universals` · all ratcheted against baselines, all STD-024-run FAILING first · **80 A8 sites + 17 write-path declarations held by baselines, not silent**
- 🟡 **CUSTOMERS AT ITS END STATE — phases A–D DONE, owner-prove OWED** · 1 surface · 1 commit model · 2 declared projections · A8 on every write site · **3 write paths (the stated floor)** · **board 0 of 8** (`customer-edit-surface-full-surface-test.md`) · **card 7 needs a STAFF session + a MANAGER positive control** · ledger #169
- 🔴 **NEXT, DEMO-PATH ORDER:** `business_inventory` (6 paths, 5 RPC — a helper-and-RPC question, NOT a form merge) → `deliveries` → orders → **then `cost_objects`** (6 paths, NO write module, worst on the board, buyer never opens it) · **A5's next row is `/checkout/*`** (9 components, zero shared imports, first thing a buyer sees)
- 🟢 **WRITE-PATH CAP — `npm run verify:write-paths`, CHAINED into `npm run verify`** · builder-complete + live · 37 probes · one write path per table or a declaration; **GOAL keeps the 17 known failures visible, RATCHET fails only on a NEW path** · baseline `write-paths-baseline.json` (33 tables / 80 paths) · ledger **#167** · tech-debt **#76** (rpc→table map: one hop folded, two named)
- 🔴 **TWO TABLES NOTHING IN SOURCE REVEALED** · `audit_log` (every writer an RPC) + **`business_inventory_ledger`** (written by `emit_inventory_movement`, which nobody calls) · the ledger's 5 paths are ONE writer on an append-only table (#70) — **a DECLARATION, never a merge** · assume a third exists · ledger #167
- 🟡 **CUSTOMERS MERGE — phase A DONE (field registry), B/C/D owed** · the ONE form was **writing nothing** in edit mode; fixed · tax folded in; cert-upload shell REMOVED (ruled out) · **board 0 of 7** (`customer-edit-surface-full-surface-test.md`) · **card 7 `needs-test` — E5 unfixed, a ruling David owes** · phase D **UNGATED** by the 20260729 backfill · ledger **#168**
- 🟡 **QBO BUY-SIDE PUSH — NAMED GAP, own build slot** · the receipt's DATA is as stranded as its image; nothing reaches QuickBooks · **(1) `Purchase`/`Bill` push is the real one, (2) `Attachable` needs a transaction to point at** · `user_stories.md` → ARC: ocr-doc-routing
> **📇 DECISIONS INDEX — READ FIRST:** before re-deriving any settled design question, open
> **[docs/DECISIONS-INDEX.md](docs/DECISIONS-INDEX.md)** — the ONE map of every decision-bearing
> doc (size/lot/QR model · cost-to-produce · pricing · identity/nav · D-1…D-33 · OP-1…OP-15 ·
> AC-1…AC-5) with each decision's home + status. Find the home, then ask David to paste the right
> doc rather than re-reasoning from scratch. It also flags the genuinely-OPEN items (sell-price
> storage, lifecycle-event grain, purchase-off-stock-line drift).

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

**STRUCTURE-LAST (the structure tax is paid by the MACHINE, not the human)** — the standing platform principle behind every capture, schema, and onboarding surface.
> Take input however it arrives (voice, photo, typed, scraped site, QB export); structure emerges on READ. The grower's "structured mess" already IS structure, just latent — the system pays the structure tax in the backend (cheap), never the human up front (the wall that kept them out). Economic spine: arbitrage falling machine-structuring cost against flat human-structuring cost — what incumbents can't follow. Field-confirmed: ~88% of growers have NO per-item structure (Barryhill: "no inventory system," stock tracked in heads) → drive the cost-of-feeding-the-system to zero; the work they already do (the count) builds the catalog. Re-test on drift: does a surface ask the owner to structure their world before it helps? Push the structuring into the backend. **Canonical: DECISIONS.md OP-10** (+ small-grower expression); product home `NORTH-STAR.md`. Companions: OP-5 anti-Nelson, D-23 faithful/connected, D-24 rigid-spine/flexible-edge, D-26 dual lexicon.

**DEPLOY / ENV**
- Deploy = **merge to `main` → Vercel auto-deploys from main**. No per-branch previews — to test a branch, merge it first. Merge-to-main is **David's explicit go**, not automatic.
- Vercel plan: **Hobby — 12 serverless-function ceiling, and this is a HARD LIMIT, not a discipline** (`api/` is AT the cap, 12/12; a 13th function silently fails the deploy and Vercel keeps serving the last-good bundle). **Upgrading to Pro is David's billing decision, never a builder's move mid-build — minting #13 is a STOP-and-surface event (§6 r11).** ⚠️ Confirmed 2026-08-30 after two working notes were found claiming or implying the ceiling had been lifted; both corrected — tech-debt #41. Supabase: **free tier**. Both → Pro at the first-paying-customer launch gate (PLATFORM_STATE ⛔).
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
- David: `david_obrien2016@outlook.com` · user_id `98f4e56b-cd27-4099-a9d8-5c8cbb63d00f`. TRACE business_id **`45830ba7…` [confirm full UUID]**. **LAWNS Tree Farm, LLC business_id `ed2e5933-45dc-4b9b-a331-ddfd125e7a74`** ⚠️ **CORRECTED 2026-08-30** — this line read `a1b2c3d4-0000-0000-0000-000000000001`, a PLACEHOLDER that was never a real tenant (R-26 instance 12, ledger #235).
- Architecture Constants **AC-1..AC-4** + naming (`platform_`/`business_`, no vertical nouns in shared schema) → detail in **PLATFORM_STRATEGY.md** (named here, not inlined).
- Demo target **LAWNS** (Leander, TX). **Terry** = owner (tech-shy, approval gatekeeper) · **Lauren Bishop** = manager (the real economic buyer). Demo date **[confirm with David — TBD]**.

**DON'T-RE-LITIGATE** (pointers, not detail → `DECISIONS.md`)
- `person_id` = **overlay, never the auth principal** (RLS stays on `auth.uid()`). · Standard-by-value rule (CLAUDE.md §6 r10). · Semantic-dup / rule-of-three (§6.8). · "Contractor" = **customer tier**, not an entity.

---

## ⚡ ACTIVE STATUS — open this FIRST (in-flight + demo-critical only)

### 🔴 LAUREN CAN DO HER WORK — THE 49 RAW `owner_id` POLICIES, TRIAGED (2026-09-10, ledger #289)

- 🟡 **BUILDER-COMPLETE on `main` · TWO MIGRATIONS WRITTEN, NEITHER APPLIED · 12 owner-test cards, 0 COVERED** · `verify` exit 0 ZERO NET-NEW, unpiped · **91/91 files, 4976 assertions** · **16 mutants, 16 caught** · NEW cap **capR2** with an 11-probe `--self-test` · **api/ 12/12 · TWO new permission strings, backfilled in the same transaction** → `docs/owner-tests/owner-id-policy-repoint-full-surface-test.md`
- 🔴 **DISPOSITION OF ALL 49: 28 REPOINTED (2 of them SPLIT PER VERB) · 10 DROPPED · 8 KEPT RAW *with the comment none of them had* · 3 UNTOUCHED** (tables pending DROP). Row-by-row source: `docs/decisions/2026-09-10-owner-id-repoint-plan.md`; **capR2 fails the build if that table and the migration disagree in either direction** (#179's lesson).
- 🔴 **TEN COULD NOT BE REPOINTED AND THE REASON IS DELETE.** They are `FOR ALL` on tables already carrying a complete per-verb member set (`business_inventory` 4, `receipts` 4, `cost_objects` 4). **A `FOR ALL` gated on ONE string grants EVERY verb on that string**, so repointing at `costs:update` would let an update-string holder DELETE. On those ten the repoint **is** the drop, each naming the siblings that preserve access.
- 🔴 **FOUR THE TRIAGE CALLED WORK ARE THE AUTHORITY STORE.** `bm_owner_all` / `rd_owner_write` / `inv_owner_all` — 20260828's own header already ruled it: the permission trigger is `BEFORE UPDATE` ONLY, so **a member INSERT on `business_members` is a permission-granting side door with no funnel.** And `team:update` is `declared-unwired`, so the repoint would have admitted **NOBODY**. Plus `service_offerings_owner`, where V6 forbids a member DELETE (R2).
- 🔴 **THE ACCEPTANCE QUERY WAS RUN RED BEFORE THE FIX** — `dead_permission_policies 31 · surviving_dropped 10`, every row `gate = raw owner_id`. **`joel_refusals = 12` before AND after: a gate that has only ever admitted is not a proven gate.** `docs/decisions/2026-09-10-owner-id-repoint-acceptance.sql`.
- 🔴 **THE `nursery_profiles` FALSE EMPTY IS PROVEN BEHAVIOURALLY (#236):** service key sees 1 row, an OWNER-role member sees **0 with no error**. Seeded first, so a zero cannot be an empty table. **LAWNS has a row** — her blank install-price field is a live false empty. Fix = the repoint **plus** a `_member_select` on `settings:read`.
- ✅ **`get_my_permissions` CAPTURED (`20260910c`) AND DELIBERATELY UNWIRED.** Measured under real claims: **Lauren 57 / `is_account_holder=FALSE` · David 57 / TRUE** — identical arrays, different boolean. Joel 25/false. Anon `[]`. **AC-3 holds:** Lauren asking about a tenant she is not in gets `[]`.
- ⚠️ **FILED:** **#237** (`get_my_permissions` carries the postgres default ACL — a convention gap, **not** a hole; measured) · **#238** (the client computes **58** while arrays hold **57** — the `owner-only` sentinel exists in no array; **blocked on David's self-removal ruling**) · **#239** (8 of the 10 undocumented policies still uncaptured) · **#240** (`SET LOCAL role authenticated` **has never worked here**) · **#241** (🔴 the dual-RLS cap encodes the model this triage retires **and keeps passing**, because `tableHasOwnerPolicy` is a corpus grep with no drop-tracking).
- 🔴 **RUN CARD 1 *BEFORE* YOU APPLY** — it is the acceptance query reading RED, i.e. you watching the check fail. Then apply `20260910b` (**SQL editor, never the table editor**; §0 refuses unless the literal merge is in), then **CARD 2**. **If `joel_refusals` comes back 0, stop.**

### 🔴 THE TAX-RATE WIPE ON COST-TO-PRODUCE SAVE — REAL, REPRODUCED, NOT REACHABLE BY LAUREN (2026-09-09, ledger #287)

- 🟡 **BUILDER-COMPLETE on `main` · 6 owner-test cards, 0 COVERED** · `verify` exit 0 ZERO NET-NEW · **90/90 files, 4926 assertions** · **14 mutants, 14 caught** · **26 live RLS assertions** · **NO MIGRATION · api/ 12/12 · no new permission string** → `docs/owner-tests/pricing-config-integrity-full-surface-test.md`
- 🔴 **`business_pricing_config.config` IS ONE JSONB COLUMN WITH FOUR OWNERS AND EVERY WRITER REPLACES THE WHOLE THING.** The cost panel named the three keys it would **PRESERVE**; `taxRate` and `production` were on no list. **FIX = the inversion:** a screen names the keys it **OWNS** and carries every other top-level key through — owned keys replaced **wholesale** so a deleted location stays deleted. Owned set is `Object.keys(EMPTY_COST_CONFIG)`, **derived, never typed out** (#179's lesson).
- ⚠️ **TWO PROMPT PREMISES CORRECTED BY MEASUREMENT, NOT ARGUMENT.** ① **Lauren cannot reach it** — no `pricing_recipe:*` in her live array; her Save returns `new row violates row-level security policy`. ② **The panel does not load her real numbers** — the read is RLS-filtered to no-row-no-error and it renders `EMPTY_COST_CONFIG` as if it were her data (on a tenant storing `unitLabel:'tree'` her screen says `unit`).
- 🔴 **THE WIPE IS REAL AND WAS REPRODUCED** on the `EMPTY_COST_CONFIG` fallback path. On a parseable config the rate survived **by accident** — `parseConfig` is a **cast, not a strip** — and the comment above the preserve list claimed the opposite. **LAWNS is not on that path today; one parsing change would put it there.**
- 🔴 **NEW CLASS CAP `npm run verify:pricing-writers`** — DERIVES every whole-column writer from the corpus (**#73's lesson**), fails the build if one enumerates what it preserves. **Red-first against the pre-fix file**, and carries a **`--self-test` proving each check can refuse** (§6 r19).
- ⚠️ **3 of 14 mutants survived the first run**, one aimed at the guard itself. **All three fixed in the harness, never by weakening a mutant.** ✏️ And `verify` caught two type errors **38 green probes structurally could not see** — the suite greps text, esbuild does not type-check.
- ⚠️ **FILED:** **#231** (🔴 the panel is rendered with **no permission gate** while its sibling gets `canReadMoney` — a manager sees fabricated defaults presented as her data; **not fixed, it changes what a customer sees in demo week, David's call**) · **#232** (🟡 **`pricing_recipe:update` admits NOBODY** — every writer upserts, `bpc_member_insert` was dropped on purpose, so only `businesses.owner_id` can save the cost panel **or `/discounts`**; #85/#86's class one layer down).
- 🔴 **RUN CARD 1 — IT NEEDS NO CONSOLE AND IT IS THE WHOLE DEFECT.** Test Dave's: note the tax rate → edit the Cost-to-Produce card → Save → **reload** → read it again. Then **CARD 3** (remove an N-list number, Save, reload, confirm it stays gone — the overcorrection check). **CARD 5 repeats it on LAWNS, only after Card 1 passes.**


### 🔴 SERVICES REVIEW — 147 ITEMS CALLED PRODUCTS, AND A LADDER INSIDE THE TREE PRICE (2026-09-08, ledger #283)

- 🟡 **BUILDER-COMPLETE · `dc162bc` on `thunder/services-review` — NOT MERGED, NOTHING DEPLOYED · 18 owner-test cards, 0 COVERED** · `verify` exit 0 ZERO NET-NEW · **87/87 files, 4821 assertions** · **48 mutants, 48 caught** · **NO MIGRATION · api/ 12/12 · no new permission string** → `docs/owner-tests/services-review-full-surface-test.md`
- 🔴 **THE IMPORT BUTTON SAYS "647 PRODUCTS" AND THE HONEST NUMBER IS 564, NOT 500.** `qboItemAdapter` filters `Type:'Category'` and nothing else. MEASURED on LAWNS's complete 685-item capture: **564 products · 73 services · 8 discounts · 2 bookkeeping · 38 folders** — because **64 of the 147 `Type:'Service'` items are TREES** on `Sales of Nursery Stock` and 35 are goods. **Filtering on `Type` alone would move 99 real products OUT of the catalogue.** Reported, not built (tech-debt **#221**).
- 🔴 **THE AXIS WAS IN HER BOOKS ALL ALONG: `IncomeAccountRef.name`** — matched by NAME, never by id, so it works unedited at the next customer (**R-112**). Where the account does not settle it (Product Income holds bags **and** the bubbler) the row is CONTESTED and **never pre-ticked**.
- 🔴 **PLACEMENT IS NOT A LINE ON ANY INVOICE** — the ladder is measured as the difference between the same plant sold planted and bare: **193 plants both ways, 909 planted lines, median ratio 2.00 exactly.** 7gal $101 · 15gal $214 · 30gal $418 · 45gal $529 · 65gal $650 · 95gal $906. **REPORTED — the button does not write it**, because `service_offerings.price` is one column (tech-debt **#220**, three shapes named, David's call).
- 🔴 **A $0 SERVICE IS REFUSED AND REFUSES THE WHOLE PRESS** (**R-113**) — `price` is NOT NULL, so the only honest options are a real price or NO ROW. `seedServiceOfferings` takes the third and writes `0` with `is_active:false`.
- ⚠️ **RUNNING IT AGAINST THE REAL CAPTURE KILLED TWO CLAIMS THAT WERE FALSE ON SCREEN** — *"backyard placement is never billed"* (it is, three times) and *"your website does not mention deer protection"* (about `DF`, *Deer Fencing*). **A shorthand code and a marketing phrase are the same service and no substring test can see that.** The website is now a checklist that makes no claim (**R-115**, superseding **R-102**).
- 🔴 **16 OF 48 MUTANTS SURVIVED THE FIRST RUN AND FIVE WERE THE PARSER** — `installInDescription:false`, which deletes the entire ladder, **passed every assertion** because every observation was hand-built. **The probes could not reach the thing** (#182). Harness fixed, never a mutant weakened.
- ⚠️ **FILED:** **#217** (`seedServiceOfferings` writes a category Postgres REFUSES, caller swallows it) · **#218** (a third `service_offerings` write file) · **#219** (one QuickBooks item can become a service AND a product; **nothing can detect it** — no `qb_item_id` on the table) · **#220** (the ladder has nowhere to live) · **#221** (the 147) · **#222** (🔴 on `/discounts`, the **FIRST** accept silently retires every legacy `pricingTiers` tier; LAWNS not exposed, **Test Dave's unchecked**).
- 🔴 **NO LIVE DB READ WAS POSSIBLE — `SUPABASE_SERVICE_KEY` is EMPTY in both env files** (#183's blocker recurring). Everything about live `service_offerings`, including the $125 placement price, is **STATED, not measured**.

### 🔴 REPORT FIDELITY — FIVE SURFACES ASSERTED WHAT THEY NEVER MEASURED (2026-09-07, ledger #282)

- 🟡 **BUILDER-COMPLETE · MERGED TO `main` 2026-09-08 (`592a039`) AND DEPLOYED — stamp confirmed against the live bundle · 11 owner-test cards, 0 COVERED** (10 `owed` · 1 `needs-test`) · `verify` exit 0 ZERO NET-NEW · **86/86 files, 4696 assertions** · **13 mutants, 13 caught, 0 survived** · **NO MIGRATION · api/ 12/12 · no new permission string** → `docs/owner-tests/report-fidelity-full-surface-test.md`
- 🔴 **THE BUTTON THE CUSTOMER PRESSES QUOTED $974.25 ON AN $876.83 ORDER.** Review resolved the tier from an **EMAIL lookup**; `submit.ts:451` resolves it from the customer **ROW by id**. LAWNS's one contractor has **`email = NULL`** (measured), so Review priced at retail. ✏️ **A RECURRENCE — the July handover carried it as must-fix #1**, and the first patch fixed the config half then re-derived the tier from the weakest key available instead of the one already in hand. Now `fetchAttachedCustomerTier`, by id, beside `fetchTaxRate`. **The covering copy is DELETED: Review IS checkout.**
- 🔴 **"INVOICE SENT TO <email>" WAS NEVER TRUE IN ANY STATE.** Unconditional, and rendered directly above a badge reading *"invoice NOT sent to QuickBooks"*. ⚠️ **A premise corrected: a Resend sender DOES exist** — but nothing in checkout invokes it for the customer, no key is set, and **the push sets `BillEmail` and never calls QuickBooks' send endpoint.**
- 🔴 **`1000 of 1000` OVER 1,964 ROWS — THE LIST REPORTED ITS OWN CAP AS THE TRUTH.** `/inventory` was honest in the same session (`647 of 647`) **only because 647 is under the cap.** Read now pages with `count:'exact'`; the pill arithmetic left the JSX into `countPill.ts` (tech-debt #134's shape). **CARD 9 is the non-regression: inventory must still read `647 of 647 items`.**
- ⚠️ **ONE OF THE FIVE IS NOT FIXED, AND THE STATED DIAGNOSIS WAS WRONG.** The undo surface already read `deleted` off the real type; every link verified and each carries the right number, so the **0-over-1,934 mechanism is unexplained (tech-debt #213)**. What shipped: the surface can no longer print a number it was not given, and the post-delete **re-read** is on screen beside the tally.
- ✅ **39 PEOPLE RENDERED "Terry null" — ONE helper, twelve call sites**, plus a corpus probe against the thirteenth. Template literals stringify NULL; JSX does not, which is why it looked intermittent.
- 🔴 **MY OWN MUTANT CAUGHT MY OWN PROBE:** A1 — the shipped defect itself — **survived the first run**, because the assertion checked that the tokens appeared in the file and the mutant leaves them all there. Harness fixed, not the mutant.
- ⚠️ **FILED:** tech-debt **#213** (the unreproduced undo) · **#214** (the customer-import double's `range()` is a **no-op**, so nothing tests paging — the mechanism behind ④, one table over) · **#215** (the divergence cap counts a checkout page as a record list; **NOT** silenced with a false declaration) · **#216** (a Supabase **`head:true` probe returns 204/`error:null` on a missing table** — it cannot disagree, and it made a whole migration census read as APPLIED).

### 🔴 THE GRID STANDARD — G11: ACTIONS · NAME · DATA (2026-09-07, ledger #281)

- 🟡 **BUILDER-COMPLETE · 4 owner-test cards, ✅ 1 COVERED (2026-09-07)** · `verify` exit 0 ZERO NET-NEW · **85/85 files, 4654 assertions** · **22 mutants, 22 caught, 0 survived** · **NO MIGRATION · api/ 12/12 · no new permission string** · `build:cultivar` 7.09s.
- 🔴 **FOUR GRIDS, THREE COLUMN ORDERS, AND NONE OF THEM A DECISION.** The engine pinned the actions track *after* each config's frozen run, so `/customers` rendered NAME · ACTIONS and `/inventory` ACTIONS · NAME — the shape fell out of wherever that run happened to end. Filed as clause **G11** in `docs/standards/ui-control-standards.md`; the position is now a property of the CONFIG (`identifier: true`) and no consumer chooses.
- ✅ **OWNER-PROVEN 2026-09-07 (card ②) — AND IT FOUND A SILENT G3 FAILURE ON THE REFERENCE GRID.** `/inventory`'s `Name` carried `frozen: true` **and was not pinned** — `Needs a look` sat ahead of it and only a CONTIGUOUS leading run pins. Discoverable only by scrolling right on a twenty-column screen.
- 🔴 **THE RULE LEFT THE `.tsx`** — `columnOrder.ts`'s `planTracks()`, 40 lines with 22 probes behind it. It was three `let`s between two JSX blocks (tech-debt #134's shape), so *"what order does this render in"* could only be answered by opening the app. **Mutant S5 guards the guard.**
- 🔴 **THE INLINE-EDIT FLASH WAS WORSE THAN REPORTED ([[R-109]]): `persistInventoryPatch` HAD NO AFFECTED-ROW CHECK AT ALL.** A row-level RLS refusal is zero rows with NO error, so the full refetch was the only thing that ever contradicted a refused write. `/assets` had the same gap and was **fixed in the same pass**; `renameVariety`'s single path had it while its group path did not.
- ✅ **THE DOC-FIRST ORDER WAS ENFORCED MECHANICALLY, NOT REMEMBERED** — adding G11 to the standard **invalidated both live divergence declarations and failed the build by name** until they were re-answered.
- 🔴 **A CAP PUNISHED THE FIX A THIRD TIME AND WAS TAUGHT, NOT WAIVED.** `verify-zero-row-writes` is now **binding-aware** about the shared `writeLanded` (Z20–Z20f, Z21–Z21b); **8 sites left the baseline**, incl. `customerUpsert::filled` — the retry the cap's own header named as its blind spot.
- ⚠️ **VENDORS + PMI REPORTED, NOT BUILT** (David's instruction) → `docs/decisions/2026-09-07-vendors-pmi-card-lists-report.md`. **Vendors is one unblocked build; PMI is BLOCKED on tech-debt #157** (it lives in `shared`, Ignition renders it, `sheetStyles` carries 7 cultivar-green literals).
- ✏️ **[[R-101]]'s grid row said "OPEN — nothing built" while `67ab644` had shipped it.** Corrected. ✅ **tech-debt #212 ACCEPTED by David 2026-09-07** — *"the right trade against the flash."* Closed as a decision; the behaviour stands and the card records it so a stale `Committed` is not "fixed" back.
- 🔴 **STILL OWED — THE THREE REMAINING CARDS, AND THE MEMBER ONE MATTERS MOST:** sign in as a member who cannot edit, try a cell on `/inventory` and a field on `/assets`, and confirm the error says **not saved** while the cell keeps the **OLD** value. That is the card that proves the fix is safe rather than fast. Not one assertion in this build opened a browser.

### 🔴 DISCOUNTS — CORRECTED: THE PERCENTS WERE DOLLAR AMOUNTS (2026-09-07, ledger #280)

- 🟡 **BUILDER-COMPLETE · 25 owner-test cards, 0 COVERED** · `verify` exit 0 ZERO NET-NEW · **82/82 files, 4581 assertions** · **46 mutants, 46 caught** · **NO MIGRATION · api/ 12/12 · no new permission string**. Board: [discount-config](docs/owner-tests/discount-config-full-surface-test.md).
- 🔴 **`2f94fbb` RENDERED `$182.50` AS `18250%`.** The rate was divided by `Qty` — which is **1** on all 21 of LAWNS's discount item lines. A comment in `invoiceList.ts` declared `Qty` to be the dollar base, in two places, and **I quoted it as my justification while writing the code that depended on it** ([[R-26]], tech-debt **#211**). **"0 we're sure about" was an artifact of the arithmetic.**
- 🔴 **MY 96 GREEN ASSERTIONS SHARED THE DEFECT'S PREMISE** — every fixture passed the base *as Qty*, so code and test agreed perfectly. **A fixture that encodes the assumption is not a test of it.** David's specification is now §A: **$50 off $500 reads 10%, explicitly not 5000%** — amount and rate differ by exactly 100×.
- 🔴 **AND `CD10%`/`CD15%` WERE NOT ON THE SCREEN AT ALL** — two of the three tiers [[R-105]] ruled to seed, absent, because rows were built from the invoice tally and those items have never been used as item LINES. **The axis is now the PRODUCT LIST**, the only source that carries a name.
- 🔴 **THE POPULATION WAS WRONG TOO: 67 native `DiscountLineDetail` lines against 21 item lines**, and the 67 were counted as "unnamed" while carrying `PercentBased`/`DiscountPercent` outright. Reading them turns up **$15,173 at 20%, $650 at 25%, $250 at 50% — rates NOTHING in her product list names**, the largest money on the page.
- ⚠️ **A NATIVE LINE CARRIES NO NAME** (all 67 point at `92 · Discounts given`) **while three items publish 10% and two publish 5%** — so a rate corroborates and can never attribute. Every shared rate says so; CD15%, the one rate nothing else publishes, does not.
- ✏️ **[[R-107]] MINTED · [[R-106]] SUPERSEDED WITHIN A DAY.** Yesterday's rewording was right about the outcome and wrong about the reason: no base was being read at all, `belowSubtotal` was "$1.00 < $3,650" on 19 of 21 lines, and `excludedFromBase` was empty on every row.
- 🔴 **THE TEST RUNNER WAS REPORTING ✅ ON A FILE THAT WOULD NOT COMPILE** — `esbuild | node` returns the LAST status, and esbuild's error goes to stderr, so node ran an empty program. Fixed with `set -o pipefail`; **a missing summary is now a failure**; proven red-first (tech-debt **#210**, #186's family).
- ⚠️ **DAVID'S NINE HAND-CHECKED ROWS AND THE WHOLE CENSUS REPRODUCE.** One difference stated, not adopted: **63 distinct customers across the 67 lines (57 percent-based), where his note says 61.**
- 🔴 **RUN CARD 23 FIRST — ten seconds:** no percent on the page may exceed 100, and the largest should be **15%**.

### ⚠️ DISCOUNTS — THE ORIGINAL BUILD (2026-09-07, ledger #279) — **its arithmetic was WRONG; see #280 above**

- 🟡 **BUILDER-COMPLETE · 22 owner-test cards, 0 COVERED** (21 `owed` · 1 `needs-test`) · ✅ **NO MIGRATION** — every key is jsonb on `business_pricing_config`, which exists · **api/ 12/12, nothing minted** (rides `/api/qbo/invoices` + `/api/qbo/items`) · **no new permission string** · `verify` exit 0 ZERO NET-NEW · **82/82 files, 4554 assertions** · **33 mutants, 33 caught**. Surface: [`DiscountReview.tsx`](packages/cultivar-os/src/components/discounts/DiscountReview.tsx) on **`/discounts`**, above the editor. Logic: [`discountReview.ts`](packages/shared/src/business-logic/discountReview.ts). Board: [discount-config](docs/owner-tests/discount-config-full-surface-test.md).
- 🔴 **NOT ONE NUMBER ON THE SCREEN IS TYPED INTO THE REPO.** The percent is measured `|amount| ÷ base` per invoice line; the counts, last-used dates and Intuit item ids come from the same read. `summariseInvoices` already had the tally and `DISCOUNT_ITEM_NAMES` already had all three names — so no tenant literal reached `shared`, and it works unedited for the next customer.
- 🔴 **THE RATE IS A DISTRIBUTION, NEVER AN AVERAGE — and the quiet failure is the weighted one.** On a 10%×4 + 40%×1 tally the unweighted mean is 16% (visibly wrong) but Σamount ÷ Σbase is **10.68%**, which rounds to the clean rate and makes the outlier vanish. A name whose rates disagree is **REFUSED, carrying no number at all.**
- 🔴 **THE WRITE REFUSES WHEN THE CONFIG CANNOT BE READ.** `mergePricingConfig` FAILS OPEN — `data:null` with no error makes `current` `{}` and the write replaces the whole record, which at LAWNS deletes `taxRate: 0.0825` and charges $0 tax under a redline thereafter. The patch never carries `taxRate` (asserted on **key absence**, not a null value); plumbing is filled **only where absent**; the result is confirmed by **read-back**, because `writePricingConfig` upserts without `.select()`.
- ✏️ **LANDS [[R-103]], AND BOTH ITS MECHANISM CLAUSES WERE SUPERSEDED BY THE PROMPT ([[R-105]]) — recorded on both rows.** A screen, not a script (*"she has to see what she is agreeing to"*); no operand reversal, because `EMPTY_COST_CONFIG` has no `taxRate`. R-103's finding stands: `seedPricingConfig`'s `ignoreDuplicates: true` is a permanent no-op on an existing tenant that returns `error: null`.
- ⚠️ **A PROMPT PREMISE DOES NOT HOLD AND IS REPORTED:** *"all 1,964 customers"* — **LAWNS holds 30, and 30 of 30 are `retail`.** Neither import has run (0 of 447 inventory rows carry a `qb_item_id`). The argument is untouched; the count is post-import.
- 🔴 **FIVE OF 33 MUTANTS SURVIVED THE FIRST RUN, ALL FIVE PROBE GAPS** — a sort order that was also insertion order, no assertion that her hand-typed tiers survive the write, a case check neutralised at one fixture ordering, and two guards no parsed fixture can reach. Fixed in the harness. **One of the new probes then found a real defect in code written minutes earlier:** a legacy `pricingTiers` business would have been re-offered every tier it already has.
- 🔴 **FILED NOT FIXED, DAVID'S INSTRUCTION — tech-debt #208:** one press of Save on the Cost-to-Produce panel deletes LAWNS's 8.25% (its preserve-list names three keys; `taxRate` is not one, and both controls are on the same `/settings` page). **This build shrinks the blast radius and does not close it.**
- ⚠️ **OPEN / DAVID'S CALL:** ① **CARD 12 before anything else** — read `config->'taxRate'` in SQL either side of the write · ② **CARD 17 passes by showing you something bad** (`cd10%` vs `CD10%` → full price, no warning) · ③ **one deviation from R-106's letter**, `aboveSubtotal` kept and worded separately — yours to overrule · ④ `OWNER_STATED_TIERS` is on the **HARDCODED-REGISTER as D1**, capping this capability at amber · ⑤ **no capture replay** (tech-debt #209) — it needs a live QuickBooks connection to demo · ⑥ **story gate OPEN** (the contractor-pricing story's `NEEDS:` asks where the set-% control lives; this build does not answer it).

### 🔴 THE QUICKBOOKS CUSTOMER IMPORT — 1,946 PEOPLE, AND THE 27 WHO MUST NOT BE TAXED (2026-09-06, ledger #278)

- 🟡 **BUILDER-COMPLETE · `2429b46` · 17 owner-test cards, 0 COVERED** (15 `owed` · 2 `needs-test`) · ✅ **NO MIGRATION — every column already existed** (`tax_exempt` · `tax_exempt_reason` · `tax_exempt_cert_ref` · `display_name` · `organization_name` · `billing_*`, verified against the live catalog). Board: `docs/owner-tests/qb-customer-import-full-surface-test.md`.
- 🔴 **THE EXEMPT FLAG IS ON THE CUSTOMER RECORD, NOT THE INVOICES — R-100.** `Taxable` on all 1,946, `false` on exactly 27, every one carrying a reason id; **no third cell in the crosstab.** The 21 derivable from invoices are a strict subset. **The six only the record shows have never been BILLED exempt** — Austin Outdoor Design · Craig · Leaf Tree Services · Paul's Lawn & Landscape · Silver Drop Irrigation · The Austin Groundskeeper. Import from invoices and those six are charged tax on their next sale.
- 🔴 **THE FOUR SEMANTIC LABELS NEEDED NO INVOICE JOIN.** All nine invoice labels are IDENTICAL to that customer's own `ResaleNum` — QuickBooks echoes the field. `GOVT` · `School` · `Ag` · `City Of Liberty` read back; the ten permit numbers are carried in `tax_exempt_cert_ref` and **never rendered as a reason**. The split is on FORM (a letter, or none), not a hardcoded list of this realm's four.
- 🔴 **THE UPSERT TRAP THAT WOULD HAVE DELETED REAL CUSTOMERS.** One blind `upsert` stamps `import_run_id` onto all 19 pre-existing QuickBooks-linked rows, and an undo keyed on it then removes customers with their orders. **Partitioned instead** — new ids INSERTed with the run id, existing ids taking a narrow three-column exemption UPDATE that never mentions it (probe asserts key ABSENCE, not a null).
- 🔴 **NOT `findOrCreateCustomer` — R-93's ARGUMENT ON ANOTHER TABLE.** It creates a `people` row per person and `people` has **no `import_run_id`** (probed live: 9 columns), so 1,946 records would mint ~1,900 person rows **nothing can undo**. Declared in `verify-write-paths.mjs`.
- ⚠️ **`verify-zero-row-writes` CAUGHT THE RECONCILE UPDATE AND WAS RIGHT** — a silently refused exemption leaves a church marked taxable. **Fixed, not declared:** exactly one row, or the run stops.
- ✅ **THE UNDO IS WIRED — R-104.** David answered R2/A3's FK condition from `pg_constraint`: `orders_customer_id_fkey` is **ON DELETE RESTRICT**, so a customer carrying orders cannot be deleted at all. **A bulk DELETE is ONE statement**, so the undo reads who carries orders first, deletes the rest, and **retries a refused chunk row by row** — one blocked customer cannot take the run down. Blocked rows are named **with their order count**. **No `customers:delete` verb minted.**
- 🔴 **AND MY FIRST DRAFT OF THAT UNDO CARRIED #277's LIVE DEFECT, CAUGHT BY READING THEIR FIX (`e04a697`) RATHER THAN BY MY OWN TESTS.** Gated on `QBO_PUSH_HOLD` alone — but there are **TWO** switches and the owner's is `businesses.qbo_writes_enabled`, which at LAWNS is `false`. An env-only gate computes *"writes are on"* there and **refuses the undo in exactly the state it exists to serve.** Now `pushPermitted`, AND-ed, with a **failed read CLOSING** the undo and saying *"we could not check"* — worded differently from *"you are live"*.
- ✅ **LAWNS IS SAFE TO IMPORT ONTO — Tuesday is ONE import, not two.** Measured: **0 of the 19 QuickBooks-linked customers are exempt in QuickBooks** and all 19 already hold `false / null / null`, so the exemption reconcile is a **no-op** there; only `updated_at` moves. The 31 existing orders and 31 deliveries point at pre-existing customers, outside the undo's scope by construction.
- ⚠️ **NOT BUILT AND SAID SO:** **there is no screen** (nor has #277 one — checked, not assumed) · **no merge** — the 72 are flagged and shown, never merged · **terms and discounts deliberately skipped** (`SalesTermRef` is on 2 of 1,946) · **the undo does NOT reverse the exemption reconcile** — undo means un-create, never byte-for-byte restore (CARD 21) · **tech-debt #200**: the undo gate is now written twice, deliberately, and it is stated rather than left to be found.
- 🔴 **OPEN, DAVID'S CALL:** ① the **story gate is open**, same gap as #277 · ② **`customer_type` is a stated rule, not a QuickBooks fact** — ~559 of 1,946 land as organizations and only David's eye can check it · ③ **tech-debt #200** — one exported `undoIsOpen`, next time either undo is touched.

### 🔴 THE QUICKBOOKS CATALOGUE IMPORT — SHE IMPORTS, LOOKS, WIPES, RELOADS (2026-09-06, ledger #277)

- 🟡 **BUILDER-COMPLETE · 23 owner-test cards, 0 COVERED** (21 `owed` · 2 `needs-test`) · ✅ **ALL THREE MIGRATIONS APPLIED + CATALOG-VERIFIED 2026-09-06** (`20260906` · `20260906b` · `20260906c` — 447 rows / 30 customers, **zero stamped**; both unique indexes NON-PARTIAL; **R-93 confirmed in the catalog: two triggers, neither emitting a ledger row**) · **api/ 12/12, nothing minted · NO new permission string** · `npm run verify` **exit 0, ZERO NET-NEW** · **79/79 files, 4254 assertions** · **40 mutants, 40 caught, 0 survived** → `docs/owner-tests/qb-catalogue-import-full-surface-test.md`
- 🔴 **THE JOIN FIELD WAS NEVER `Sku` — IT IS ON 2 OF 685.** `Description` is on 632 and carries the product's real name and size (`AP45` → *"Afgan Black Pine, 45 Gallon"*). **R-70, `retireAndReplace.ts` and `itemList.ts` all said otherwise** and are corrected (**R-98**). The identity is `Item.Id`, 685 of 685.
- 🔴 **`NZCM30` WAS 1 OF 12, AND 7 OF THE 12 DISAGREE ON PRICE.** The create loop's first-writer-wins kept the **cheaper** row every time — Lacey Oak 45 Gallon **$1,250 vs $375**, Shumard Red Oak 45 gallon **$1,250 vs $500** — with no finding, no count and nothing on screen. Every sellable item now gets a row and each collision names both prices (**R-96**).
- 🔴 **IT MUST NOT RIDE `importWrites.ts` (R-93), AND §6 r8 SAYS IT SHOULD.** That path creates through `count_promote_create_inventory`, which emits an **immutable `opening_balance` ledger row** — 647 a run — and **the undo could never be complete.** A plain INSERT emits none. **In test mode the import writes NO ledger rows.**
- 🔴 **`retired_at` HAD NO READER AND HAD SHIPPED THREE DAYS EARLIER.** Retiring LAWNS's 447 rows would have left all 447 on Lauren's grid — **1,094 rows.** `onlyLiveInventory` now guards eight surfaces, with a corpus cap asserting **both** directions (every read filtered or declared in place; no declaration stale).
- 🔴 **THE UNDO REFUSES WHILE QUICKBOOKS WRITES ARE ON** — the existing `QBO_PUSH_HOLD`, one control not two — and **proves it landed by RE-READING** what still carries the run id, because a refused delete returns no error and zero rows. Receipts (111) and deliveries (31) asserted before AND after; **13 of those deliveries are scheduled after today**, not 3.
- ⚠️ **NOT BUILT AND SAID SO:** **there is no screen** — the three endpoints are driven by console/`curl` and every card says how · the **customer merge is deliberately OUT** (pending `customer_qb_links`; one local customer can map to two QuickBooks ids) · front-loaded sizes (`"50lb Bag: Micromax…"`, ~30 rows) read `not_stated` and the decision is David's (tech-debt **#193**, CARD 21).
- ✅ **READER-SIDE FILTER CONFIRMED LIVE 2026-09-06, END TO END, TENANT RESTORED.** On Test Dave's: retire one row → the app's own query returns **129 where the unfiltered one returns 130** → un-retire by `retired_by_run_id` → **back to 130, zero rows carrying the probe run id.** Not a code read: an observed hide and an observed restore.
- ✅ **#193 ANSWERED (R-99): a weight IS a size — `50lb`, not `each`.** David's reason is the recipe builder (*"25 lb of Osmocote, bought as a 50 lb bag"*), and his claim that the ladder never sees a bag is **VERIFIED IN CODE** (`productionMath.ts:88` `rungKey` returns null off `container`; `:108` refuses with *"…is weight, not a container size"*). **21 of the 111 would gain a size** — 9 weight · 7 container · 4 volume · 1 length. **NOT BUILT: the front-loaded read**, and it carries one unsettled sub-question (the packaging noun — `1/2 Yard Scoop` truncates to `1/2 Yard` under a naive split).
- 🔴 **OPEN, DAVID'S CALL:** ① the **story gate is open** and I did not close it by inventing one — `user_stories.md` has no heading for importing a product list · ② **the packaging noun in R-99's residual** — is the size `50lb` with *Bag* dropped, or `50lb Bag` (which `parseUnitOfMeasure` refuses)?
- ⚠️ **FILED, NOT FIXED:** tech-debt **#192** (`soft_delete_inventory` writes `status='deleted'`, absent from `ALL_STATUS_VALUES`; **5 live rows**, and it corrects a prompt premise) · **#193** · **#194** (`submit.ts` by-id reads unfiltered, declared + owed) · 🔴 **#195 — tech-debt #186–#191 are cited in CLAUDE.md and DO NOT EXIST in `docs/tech-debt-log.md`**, found while claiming an id.
- ⚠️ **SIX `inventory` CARDS FLIPPED `covered` → `owed`** — their read query moved. Prior wording preserved inline; nothing observable changes at LAWNS today.

### 🔴 UPPOT PLANNING — THE SPLIT SHIPS, AND THE HOLD IS THE PLAN (2026-09-05, ledger #276)

- 🟡 **BUILDER-COMPLETE · 21 owner-test cards, 0 COVERED** (19 `owed` · 2 `needs-test`) · ⛔ **MIGRATION `supabase/migrations/20260905_production_planning.sql` NOT APPLIED — CARDS 8–17 BLOCKED** · `api/` 12/12 · NO new permission string · `npm run verify` exit 0 zero net-new · **76/76 files, 4022 assertions** · **40/40 mutants caught** · → `docs/owner-tests/uppot-planning-full-surface-test.md`
- 🔴 **THE HOLD IS DERIVED, NOT A COLUMN.** `held_for_uppot` = the sum of unfinished quantity on open plan lines, exactly as committed stock is a sum over open orders. **`business_inventory` gains nothing**, and the migration's VERIFY (D) asserts it. R-84 / R-27.
- 🔴 **BATCH SIZE IS THE LEVER, NOT CREW SIZE.** Labour is **60 min setup a run + 3 min a pot**, which reconciles David's two figures (3 was handling; 6 was the job at a 20-pot batch). The same 1,245-pot plan is **187 crew-hours or 73**. Every split costs one extra setup and the screen prices it.
- 🔴 **THE POT CASCADE SAVES 708 POTS OF 1,328** on the workbook's own ten varieties — same work, same trees, same window. Down the ladder, block breaks the tie, **and every block revisit is named with its cost** rather than resolved silently.
- 🔴 **CANNOT BE DEMONSTRATED ON LAWNS, MEASURED:** 447 lots, **2 with a count and each holds ONE TREE**. Seed Test Dave's (`scripts/seed-uppot-harness.mjs` — it refuses to run against LAWNS) then `npm run units:backfill`.
- ⚠️ **NOT BUILT AND SAID SO:** batch completion (schema + rules + tests ship, **no button**) · the two seven-day flags (computed and tested, **rendered nowhere**) · the graduation movement · the audit row · sales-a-month (stage ④), so every *Keep* figure is 0 until typed.
- 🔴 **OPEN, DAVID'S CALL:** ① **where the seven-day OPEN flag lives** — he asked for the owner's surface, and `isOwner` in an authority position is forbidden by capA while §3 forbids a new string; the one string that both excludes the manager and honestly describes the capability is **`audit_log:read`**, and it is a PRESENTATION gate, not a protection. ② the four-way-split **story is owed** — the ladder story covers the dates, nothing covers the split.
- ⚠️ **FILED, NOT FIXED:** tech-debt **#190** (the unit-projection cap cannot tell a reader from a writer) · **#191** (the divergence cap counts a settings form as a record list).
- ⚠️ **PROMPT PREMISE THAT DID NOT HOLD:** §0 said the three workbook defects were already fixed in the file and N4 named a new cascade sheet — **the workbook on disk is byte-identical to yesterday's**, nine sheets, all three defects still present. Did not block; the prompt states each fix in one sentence and the build followed the prompt.

### 🔴 THE ACCOUNTING READ HAS A DISPLAY — AND THE REHEARSAL PATH WAS DARK (2026-09-04, ledger #275)

- 🟡 **BUILDER-COMPLETE · 18 owner-test cards, 0 COVERED** (16 `owed` · 2 `needs-test`) · **NO migration · api/ 12/12 · NO new permission string** · `npm run verify` **exit 0, zero net-new**. → `docs/owner-tests/quickbooks-books-read-full-surface-test.md`
- 🔴 **THE ONE-LINE DEFECT: `projectCapture` DROPPED `capture`.** A saved read rendered **no invoice table**, and **13 of 16 findings** — every money rule — said *"could not work this out"* over a file holding every invoice they needed. **The probe file and the mutation harness over that module could not have failed: no assertion ever read the field.** The shape witness enumerated the keys that DIFFER between entities, and `capture` is common to all three.
- 🔴 **THE 100-ROW CAP WAS A WRONG ANSWER, NOT A SLOW ONE** — a search for a real 2024 invoice reported *nothing found* against 1,480 books, with nothing on the page looking unusual. Ceiling now **5,000** (`invoiceGrid.ts`), so LAWNS is **not capped and the search is exact**; the capped case is **PROVOKED in a probe** and mutation-proven rather than observed at a scale where it cannot occur.
- 🔴 **THE CUSTOMER REPORT STOPPED TALKING TO US** — every *"Re-measured 3 September"* line and its working notes are gone, and the page dates itself by **when the books were READ**, not by when the button was pressed. The drift record stays on the SCREEN panel David reads.
- 🔴 **OFF A NON-OWNER'S PAGE ENTIRELY:** both ingest panels, the TEST FACILITY (also **recoloured off amber** — it was byte-identical to the test-mode banner), and the pre-read findings section (measured: **16 rules, 0 measured, 16 quoting 29-Aug figures** incl. `$614,053`, shown before anybody pressed anything).
- ⚠️ **NOTHING MECHANICAL GUARDS THIS SURFACE** — the divergence cap scans `packages/cultivar-os/src` only, so this component was never measured as bespoke and is not credited as converged. **Probes + mutants + cards are the entire guard.** tech-debt **#187**.
- 🔴 **OPEN, DAVID'S CALL:** ① **where the ingest panels should LIVE** — `/admin` is `settings:read`, which the **manager floor holds**, so moving them there changes the address and not the reach; ② **three clauses drafted unnumbered** in `docs/standards/OWED-CLAUSES.md` (test-facility placement · pre-first-run state · owner-tool placement), NOT filed, per David's *"do not wait"*; ③ **the SHA to match is `1f039b4`** — the first build carrying the invoice table AND the narration.
- ⚠️ **FILED, NOT FIXED:** tech-debt **#186** (the test runner reported **72 of 74 files** on a busy tree and still said *All test files pass*) · **#187** · **#188** (a comment claims STAFF holds `settings:read`; it does not) · **#189** (the authority cap sees `{isOwner && (` but not `if (!isOwner) return null`).

### 🔴 THE GRID ENGINE IS PLATFORM CODE NOW (2026-09-03, ledger #272)

- 🟢 **DONE, ZERO BEHAVIOUR CHANGE — no owner-proof owed.** `<DataSheet>` + its unit moved `packages/cultivar-os/src/components/datasheet/` → **`packages/shared/src/components/datasheet/`**, verbatim (`020793b`). **37 changed lines in the engine, every one a comment** — proven by filtering the rename-detected diff, not asserted. → `packages/shared/src/components/datasheet/DataSheet.tsx` · ledger **#272**
- 🔴 **THE ASSUMED COUPLING DID NOT EXIST.** Entire transitive closure = `react` + `lucide-react` + two zero-import siblings. No supabase, no business context, no permission hook, no router. **8 consumers, one import line each.**
- 🔴 **THE PROMOTION TRIGGER IN ITS OWN HEADER HAD ALREADY FIRED AND NOBODY RE-READ IT** — it said *"when a real second-vertical consumer appears"*, and the consumer was `QboBooksReader` **inside `shared` itself**. [[R-26]]'s class.
- ⚠️ **`datasheet/` DIRECTORY NAME IS LOAD-BEARING — DO NOT RENAME.** `usesSharedGrid` matches that path fragment; renaming silently converts all 8 consumers into undeclared bespoke surfaces. Carrier paths in `ui-control-standards.md:18-19` move WITH the file or the engine is measured as a divergence from itself.
- 🔴 **TWO DECISIONS LEFT OPEN, BOTH DAVID'S:** ① **widening the divergence cap's `SCAN_ROOT`** — deliberately NOT done; it re-baselines `undeclared_bespoke_surfaces:23` into an unknown, and the honest reading is MORE unaudited surfaces. ② **how a shared component learns which vertical it renders in** — tech-debt #157's real blocker, unanswered.
- ✅ **CLOSED BY #275 (2026-09-04): `QboBooksReader` IS THE GRID NOW.** This line read *"OWED, NOT DONE — still a plain table; the reach is real now, so that is a CHOICE rather than a limit."* It was, and the choice was taken. See the #275 block below.
- ⚠️ **FILED, NOT FIXED:** tech-debt **#156** (the `shared → cultivar-os` boundary is enforced by **nothing** — tsconfig/eslint/package.json/knip/vite all checked) · **#157** (`tokens.ts` palette, ZERO importers, vs **42 cultivar literals across 21 files** in `shared`) · AC-1 leak `populate.ts:77` → CLAUDE.md §1.5.

### 🔴 `/receipts` IS A GRID NOW (2026-09-03, ledger #269)

- 🟡 **BUILDER-COMPLETE, OWNER-PROOF OWED.** `<DataSheet>` + `renderExpand` — one row per receipt, the chain in the drawer. **G4 sort · G6 search + outcome filter · G7 density came from the engine; none was built.** → `ReceiptsList.tsx` · `receiptsList.ts` · 134 probes, 4 proven red first.
- 🔴 **THE BOARD IS 0 OF 14 COVERED (13 `owed` · 1 `needs-test`)** — all 9 covered cards flipped because the surface they described no longer exists (OP-14 cl.3); each keeps its 09-02 evidence. ⚠️ **Seven still settle from ONE print of `/receipts`.** **Sharpest new step (CARD 12): sort Amount descending — `$1,283.88` must sit ABOVE `$920.13`.** Sorted as text it does not, and the page looks normal.
- ✅ **THE DIVERGENCE CAP NAMED THE CONVERGED FILE ITSELF** — self-pruning firing on the good outcome. Declaration **moved to `converged`, not deleted.**
- 🔴 **TWO SHARED-CONTROL QUESTIONS OWED DOC-FIRST (R-74), NOT DECIDED IN A SURFACE:** ① the expand toggle is **trailing + chevron**, not a leading plus/minus — a `DataSheet.tsx` change for every consumer. ② the count pill **cannot name a server-side cap** (*"100 of 100"* for a tenant holding 236).
- ⚠️ **COLUMN DEFAULTS ARE AN UNVERIFIED PREMISE** — David's set relayed by a peer session; flagged in the file, one word flips it. **LINES needs `line_items` in the select, which the file's invariant forbids — David's call, not settled.**

> 🟡 **Team invitations — RESET INVITE + expiry as a displayed state** · BUILDER-COMPLETE, on `main` · **owner-proof OWED (board 0 of 16)** · ⛔ **`20260904b_reset_invitation_expiry.sql` NOT APPLIED — cards 11/12/13/16 blocked on it** · an expired invite is now VISIBLE and RECOVERABLE with the SAME token (no resend had ever existed in 1,061 commits) · E7 places the control on the person's page · rode along: `armPinReset` E5 fix + Reset PIN locked-with-explanation · ⚠️ tech-debt **#183** do-not-re-invite (orphan row) · **#184** do-not-wire `expireInvitations` · ledger #274 · `docs/owner-tests/owner-role-authority-full-surface-test.md`
> 🟡 **Vendors — identity + the preferred vendor + THE RECORD EDITOR** · BUILDER-COMPLETE, on `main` · **owner-proof OWED — 18 cards, 0 covered, 1 `needs-test`** (was 12; **CARDS 1/2/5/6/7 flipped `covered`→`owed`** — none was ever proven, but each described the inline row editor **E7/R-83** removed) · **verify exit 0 zero net-new · 72/72 files · 3710 assertions · vendorEdit 70 probes · 9/9 mutants** · ✅ **ALL FOUR MIGRATIONS APPLIED** — CARDS 16-18 unblocked · 🔴 **the applied column immediately exposed a defect on LAWNS live data and it is fixed**: a NULL original would have read as *she typed it* for a number the reader actually read (`Bailey Bark` $2180.79 / 595431, 595431 present in its `ocr_raw`); `''` is now the sentinel, NULL yields `unknown` · ⚠️ **the reason is BACK on the list, read-only under the chip** (David reversed same-day; E7 provides for it) · ⚠️ **CARD 5 + CARD 6 must run at `f7ec5d67` as `test obrien`** — Lauren holds role OWNER at LAWNS so she is not a manager there, and joel joiner is `active=false` · → `docs/owner-tests/vendors-full-surface-test.md` · ledger **#259**, **#273** · [[R-83]] · tech-debt **#179**/**#180**/**#181**

> 🔴 **BRANCH / WORKTREE STATE IS MEASURED, NEVER REMEMBERED — run these two, do not read them off a prose line (added 2026-09-02).**
> ```
> git worktree list                 # what is actually checked out right now
> git branch --merged main          # what is already IN main — the only answer to "is it merged?"
> git merge-base --is-ancestor <sha> main && echo in-main
> ```
> **Measured 2026-09-02 (#259 — RE-MEASURED AGAIN; the 18:37 reading below was already stale, which is the third time this block has proved its own point):** `main` = **`62d3d34`** · **4 worktrees** — primary + `thunder/receipt-detail-view` (`00b23536`) + `thunder/qbo-review-test-mode` (`a528e4bf`) + `thunder/vendor-identity` (`d967011d`) · 🔴 **`thunder/qbo-review-test-mode` held 12 commits and was LOCAL-ONLY at 16:32** — no remote ref contained its tip; **push it from its own session** · `thunder/vendor-identity` pushed · `origin/assets` still unowned, remote-only since 2026-06-28. ✏️ **Re-run the commands. Do not read this sentence.** (#259)
> ✏️ **WHY THIS BLOCK IS HERE.** On 2026-09-02 a build prompt opened on *"ten worktrees are live"* and *"`thunder/receipts-view` is NOT MERGED"*. Two worktrees were live and the branch had merged the previous morning. Neither number was invented — both were **true when written into §3 narrative on 2026-09-01** and neither was re-measured. This file is the one every session starts from, so a stale count here becomes the next prompt's premise. **A branch state is a fact about the repo, and the repo will answer in under a second.** [[R-26]].

### 🔴 UI STANDARD — THE STANDARD OUTRANKS THE PROMPT (2026-09-03, ledger #265, R-73 · R-74)

- 🟡 **`/receipts` SORT CHANGED — G9, BUILDER-COMPLETE, OWNER-PROOF OWED.** Ordered by **`receipts.date`, the date on the document**, not `created_at`. On LAWNS's rows they disagree (07-02 captured after 07-29), so **the visible row order moves**. → `receiptsList.ts` · `ReceiptsList.tsx` · probe `E7` proven red against the old sort.
- 🔴 **`receipts-view` CARD 1 flipped `covered` → `owed`** (OP-14 cl.3) — board now **9 covered · 1 owed · 1 needs-test**. **The discriminating step: bwi 07-29 must appear ABOVE bwi 07-02.** Rides the same one print of `/receipts` as six other cards.
- 🟢 **DIVERGENCE CAP LIVE** — `npm run verify:ui-divergence`. A bespoke record-list surface declares its divergence **clause by clause**; the clause list is **derived from `ui-control-standards.md`**, so adding a clause invalidates every declaration until re-answered. Proven red 7 ways. → `scripts/verify-ui-standard-divergence.mjs` · `docs/decisions/ui-standard-divergences.json`
- 🔴 **`ui-standards.html` RENDERS 3 OF THE STANDARD'S 6 SECTIONS — its own build, David authorises.** 11 clauses defined and rendered nowhere (`G9, F4, E1–E6, S1, R1, R2`); **E1 (*one record, one edit surface*) is the clause that answers modal-vs-route and is not on the board a prompt-writer would check.** Ratcheted at 11; when the reader lands it goes to 0 and the cap locks it.
- ⚠️ **23 bespoke surfaces are UNDECLARED AND UNAUDITED** — not found wanting, not looked at. Next sweep. ⚠️ **G9 unaudited against `DataSheet`'s consumers** (inventory / assets / customers).
- ✅ **THREE STALE RECORDS CORRECTED:** tech-debt **#145** (said *"no `/receipts/:id`"* while the route was shipped, boarded and wired) · `ProjectCostDrillIn.tsx:28` (same claim, **170 lines above the code that uses the route**) · `ui-control-standards.md` §6 (read `DRAFT — DAVID RULES` eleven days after the ruling that settled it). ✏️ **`built-inventory.md` had #145 right the whole time; the two records a prompt-writer reads did not.**
- 🔴 **THE FIRST DECLARATION'S REASON WAS FALSE WHEN IT WAS WRITTEN — CORRECTED (#266 · [[R-75]] · tech-debt #153/#154).** `<DataSheet>` has carried **`renderExpand`** (*"Optional per-row detail drawer"*, `DataSheet.tsx:81-82`) since **2026-07-01, `e3e6796`**; the `ReceiptsList` comment saying a grid *"can only render the chain by truncating it or by exploding one receipt into several rows"* was written **2026-09-01, `ab617b2`** — two months later. **Not a gap in the widget; an unchecked claim about our own widget** ([[R-26]]; second instance this week after tech-debt **#61**). Corrected in **all three** places it lived: the declaration's `reason`/`note` **+ a new `premise_withdrawn` block naming G1/G2/G3/G5 as downstream and re-answerable**, the `ReceiptsList.tsx` header, and the report (**annotated in place, original text preserved**). ✅ **`G4`/`G6`/`G7` `owed` and the `23 UNAUDITED` baseline are UNTOUCHED — they remain the cap's real finding.** 🔴 **DAVID ACTION ①: the card-vs-grid shape for `/receipts` is now an OPEN question** — the premise for the card is withdrawn; the choice is not thereby decided either way. 🔴 **DAVID ACTION ②: write the R-38 amendment in your own words and number it** — drafted **UNNUMBERED** in the `RULINGS.md` register with its evidence (**R-38's test catches 3 of 10 cost-on-goods lines in our own corpus and misclassifies 7**); **R-38 stands as filed until you do, and must not be built on.** ⚠️ **The receipts prompt is HELD for re-issue amended** — §1(c) done at #257/#258, the sort bullet done by G9, the *"modal obeys M1–M5"* clause **withdrawn** (it made one receipts modal answer a platform-wide question, which clause 5 forbids in terms). ⚠️ **AND THE MODAL IS NOT A MOUNTING:** `ReceiptDetail.tsx:141` is monolithic with no extracted editor, so **E1 cannot be satisfied by mounting anything that exists** — **extracting the editor IS the work** and must be scoped as such.
- 📄 **The report: `docs/decisions/2026-09-03-ui-standard-divergence-report.md`** — filed as a document, not reported in chat (#264's own finding).


### 🔴 MIGRATIONS — DERIVED FROM THE CATALOG, NOT FROM A LABEL (re-measured 2026-09-07, ledger #282)

🔴 **THE OLD BLOCK WAS WRONG ON THREE FILES IN THE SAME DIRECTION, AND THAT IS WHY THIS ONE IS
DERIVED.** It carried `20260902_business_qbo_writes_switch.sql` as ⏳ **NOT APPLIED — APPLY FIRST**
with the warning *"until it lands every order is written as a test order"*; it is **applied, and
has been since 2026-09-04** (owner-verified). `20260903_inventory_retire_lifecycle.sql` and
`20260903b_display_standards.sql` carried the same stale ⏳ and are **both applied**.
**THIS IS THE THIRD INSTANCE** — `20260831d` and `20260902` were also filed GATED / NOT APPLIED
while already in the database. **A LABEL IS NOT EVIDENCE.** Every row below was probed against the
live catalog by an object the migration CREATES.

**Re-measure at any time — it writes nothing:** `node scripts/measure-migrations-applied.mjs`
**Re-paste safety, per file, from the SQL:** `node scripts/measure-migration-repaste-safety.mjs`

| File | State (catalog-probed 2026-09-07) | Safe to paste twice? |
|---|---|---|
| `20260902_business_qbo_writes_switch.sql` | ✅ **APPLIED** — `businesses.qbo_writes_enabled` readable | ✅ yes — one `ADD COLUMN IF NOT EXISTS` |
| `20260902_receipt_line_edit_and_vendor_preference.sql` | ✅ APPLIED — `vendor_preferences` present | 🔴 **NO** — 4 `CREATE POLICY`, 0 drops |
| `20260902_vendor_identity_and_preference.sql` | ✅ APPLIED — `vendors` present | 🔴 **NO** — 7 `CREATE POLICY`, 0 drops |
| `20260902b_vendor_preferences_join_on_vendor_id.sql` | ✅ APPLIED — `vendor_preferences.vendor_id` readable | ✅ yes |
| `20260903_inventory_retire_lifecycle.sql` | ✅ **APPLIED** — `business_inventory.retired_at` readable | ✅ yes |
| `20260903b_display_standards.sql` | ✅ **APPLIED** — `business_display_standards` present | 🔴 **NO** — 2 `CREATE POLICY`, 0 drops |
| `20260903c_receipts_receipt_number.sql` | ✅ APPLIED — `receipts.receipt_number` readable | ✅ yes |
| `20260904_receipts_receipt_number_original.sql` | ✅ APPLIED | ✅ yes |
| `20260904b_reset_invitation_expiry.sql` | ⚠️ **UNVERIFIED** — creates only a FUNCTION | ✅ yes — `CREATE OR REPLACE` |
| `20260905_production_planning.sql` | ⛔ **NOT APPLIED** — all three tables absent | 🔴 **NO** — 12 `CREATE POLICY`, 0 drops |
| `20260906_inventory_import_run_provenance.sql` | ✅ APPLIED | ✅ yes |
| `20260906b_customers_import_run.sql` | ✅ APPLIED | ✅ yes |
| `20260906c_qb_identity_unique_indexes.sql` | ✅ APPLIED (#277, catalog-verified) | ✅ yes |
| `20260907_customers_last_name_nullable.sql` | ✅ **APPLIED 2026-09-07** (owner) | ✅ yes |
| `20260907b_customers_nullable_sweep.sql` | ✅ **APPLIED 2026-09-07** (owner) | ✅ yes |

🔴 **ONE MIGRATION IS OUTSTANDING: `20260905_production_planning.sql`** — all three of its tables
(`production_plans`, `production_plan_lines`, `business_operations_config`) return **PGRST205,
absent**. It blocks uppot-planning owner-test **CARDS 8–17** (ledger #276). ⚠️ **It is NOT
re-paste safe** — 12 `CREATE POLICY` with no `DROP POLICY IF EXISTS`, so a second paste errors
`42710` and rolls the whole thing back. That is the vendor-chain shape again, and **it was never
recorded anywhere before this pass** because the old block only measured three files.

⚠️ **`20260904b_reset_invitation_expiry.sql` IS REPORTED UNVERIFIED, NOT ASSUMED.** It creates a
function and nothing else; a function is invisible to a `.select()`, and calling it would WRITE.
Reported as unknown rather than promoted to applied — which is the discipline the three wrong
labels above existed for lack of.

🔴 **THE PROBE ITSELF HAD TO BE FIXED BEFORE IT COULD BE BELIEVED, AND THIS IS REUSABLE:** the
first draft used `.select('*', { head: true, count: 'exact' })` and **its negative control PASSED**
— a table that cannot exist returns **HTTP 204 with `error: null`**, so every migration read as
APPLIED, including the one that is not. A head-only existence probe **cannot disagree** ([[R-33]]).
`.limit(1)` returns `PGRST205` for a missing table and `42703` for a missing column, and both
controls are asserted on every run.

**HOW TO CONFIRM IN THE SQL EDITOR** (the catalog, not the client):
```sql
SELECT table_name, count(*) AS cols
  FROM information_schema.columns
 WHERE table_schema='public'
   AND table_name IN ('production_plans','production_plan_lines','business_operations_config')
 GROUP BY table_name ORDER BY table_name;
```
**A pass looks like:** three rows AFTER `20260905` is applied; **zero rows before it** — which is
what it returns today.

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
- **STATUS per piece:** capture=🟢 (`ReceiptKeeper.tsx:204` + `imageCompression`) · **entry-doors=🟢 TWO** (the Receipts tile/nav AND — ledger #85 — a persistent owner-gated "Capture invoice" launcher on BOTH delivery surfaces → `navigate('/receipts',{state:{from:'route'}})`; ONE pipeline, two doors; observable via `[TRACE:ROUTER] entered-from:route|direct`; 🟢 OWNER-PROVEN 2026-07-06, commit `134bacd`) · extract=🟢 ONE engine `api/receipts/ocr.ts:309-313` Gemini→Claude, **`shape:'receipt'|'invoice'` param** `:281` · infer-type=🟡 (shape HARD-PINNED `'invoice'` `ReceiptKeeper.tsx:33`; receipt-vs-invoice is a post-OCR *label* `:288-289`, nothing auto-routes the extraction) · confirm=🟢 (`:944-994` + line-item grid) · receipts-write=🟢 (`:422`) but **cost_object spawn=🔴** (dead-ends at `receipts`) · invoice→delivery=🟢 (`api/customers/create.ts:94-101`, consolidated) · invoice→inventory=🔴 net-new (`line_items` extracted but no `business_inventory` mapper) · leakage=🔴 ("coming" stub `:989-992`) · audit=🔴 (table exists, **no app writer**) · cross-vertical=🔴 (cultivar-local; Ignition uses a separate remote engine)
- **ARC STATUS:** 🟡 coherent capture→extract→infer→confirm + TWO live fan-outs (receipts, delivery); **dead-ends after** — inventory scoped-not-built, leakage/audit/cross-vertical absent.
- **HOME DOC(S):** `docs/decisions/OCR-router-spine-recon.md` · `docs/decisions/OCR-into-inventory-reuse-verify.md`
- **LANDMINE:** `api/receipts/ocr.ts` is the credential-bearing seam (Gemini/Anthropic keys, server-only) — a secrets seam, not an irreversible-write seam. No Off-Limits.
- **OFF-COURSE / EXTRA:** receipt→cost_object writer (recon'd, banked) · invoice→inventory build (~70% reuse, the NEXT demo build) · per-receipt deep-link not built · 🐞 **DISCOUNT-LINE bug (recon-first, master bank #64):** parser models "DISCOUNT EACH" as standalone negative line items + drops qty/unit-price ("2 @ 6.28") → a false "$3.06 below total / tax-tip?" warning on a receipt that actually reconciles; OCR read fine, the LINE-ITEM MODEL is wrong (needs qty + unit_price + per_unit_discount + extended net; discount = cost-to-produce signal). LOOK before fixing (OCR adapter vs line-item type). → CLOSE-OUT-LEDGER GENUINELY OPEN.

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
- **SECOND DOOR (ledger #85, 🟢 OWNER-PROVEN 2026-07-06, commit `134bacd`):** a persistent owner-gated "Capture invoice" launcher sits in the header of BOTH `/delivery-schedule` (DeliverySchedule) AND `/deliveries` (DeliveryRoute) → `navigate('/receipts',{state:{from:'route'}})` = the arc-2 invoice OCR→infer→route pipeline, only the entry point moved (schedule a delivery from where you manage deliveries). David proved it live — button renders on both surfaces (mobile + desktop), both doors open the existing flow. ZERO new Vercel fns (12/12 held); return already clean (ReceiptKeeper done-screen "View scheduled deliveries →" re-buckets the new stop); shared `CaptureInvoiceLauncher.tsx`; `[TRACE:ROUTER] entered-from:route`.
- **SPINE:** schedule 🟢 (2 doors — OCR-invoice AND the #85 route-surface launcher) → day-group 🟢 → date-EDIT 🟢(move to a working day, OWNER-PROVEN 2026-07-03 ledger #79) → select-stops 🟢 → bookend 🟢(real)/🟡(demo builder, WIRED 2026-06-26) → Maps-handoff 🟢 · [embedded Maps JS map + geocoding 🟢 OWNER-PROVEN 2026-07-03 ledger #78] · [real DRIVING route 🟢 OWNER-PROVEN 2026-07-03 ledger #80 (Enhancement 1): Directions API road-following line + shortest-path stop optimization + miles/drive-time; graceful fallback to the straight polyline; ZERO new Vercel fns]
- **STATUS per piece:** schedule=🟢 (OCR-invoice `customers/create.ts:94-101` + cart `orders`) · day-group=🟢 (`DeliverySchedule.tsx:94-106`) · date-EDIT=🟢 OWNER-PROVEN 2026-07-03 (ledger #79) — inline `<input type="date">` per card → client-side RLS UPDATE `delivery_date` (`deliveries_*_all` FOR ALL, business_id-scoped; no endpoint/migration/dep) → re-groups by day; data KEPT; moves an invoice-scheduled Sunday to a working day; `[TRACE:DELIVERY]` ON; owner-proof owed · select-stops=🟢 ("Route this day" `:152-166`) · bookend(real)=🟢 origin=`businesses.address` round-trip unshift+push (`DeliveryRoute.tsx:80-82,181-191`; **1-stop OWNER-PROVEN 2026-06-26 ledger #42, multi-stop owed** — only 1 live delivery, no seeder) · bookend(DEMO/onboarding builder)=🟡 **WIRED 2026-06-26 (ledger #47)** — `OnboardingWizard.DeliveryWizardPath.buildRoute` now bookends business→stops→business via `nurseryInfo.address` (mirrors the live seam); BUILDER-COMPLETE, owner-proof owed · Maps-handoff=🟢 (`DeliveryRoute.tsx:37-40` `buildMapsUrl`, always-present fallback) · embedded-map+geocoding=🟢 OWNER-PROVEN 2026-07-03 (ledger #78) — client-side `loadGoogleMaps` + `RouteMap` reads `import.meta.env.VITE_GOOGLE_MAPS_API_KEY` → geocodes origin+stops → numbered pins in route order + polyline; ZERO new Vercel fns; graceful fallback to the handoff card; **GATING: David renames `GOOGLE_MAPS_API_KEY`→`VITE_GOOGLE_MAPS_API_KEY` in Vercel + redeploys + enables Geocoding API** (Vite hides the unprefixed name); `[TRACE:MAP]` ON; owner-proof owed · driving-route=🟢 OWNER-PROVEN 2026-07-03 (ledger #80, Enhancement 1) — `RouteMap` swaps the straight `Polyline` for `DirectionsService`+`DirectionsRenderer(suppressMarkers:true)` = road-following route via the **Directions API** (enabled on the `VITE_` key), round-trip ⌂→stops→⌂, `optimizeWaypoints:true` reorders stops shortest-path → markers renumbered + list/count reordered to match, `legs[]`→miles/drive-time on the card; graceful fallback to the straight polyline/URL card; ZERO new Vercel fns; Directions API over Routes API (standard-by-value); `[TRACE:MAP]` extended; owner-proof owed · Enhancement 2 (clickable pins → InfoWindow) RECON'd, NOT built
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
- **OFF-COURSE / EXTRA:** discovery persistence (v2) · recognition-moment **status contradiction** (committed in `CONCEPT-customer-url…:108-113` vs "do not build" in `THOUGHTS.md:15` — David reconciles) · **DISCOVERY Option A — gap-vs-decision fix (SCOPED, post-demo, NOT built):** engine ASSERTS "you could add X" instead of ASKING "deliberate, or opportunity?" (violates [[D-32]], misfires on the LAWNS fertilizer example); fix rides the existing identity-conflict confirm/correct mechanic (`compare.ts` + `DiscoveryGlimpse.tsx:180,386-434`). Recon + fix shape: `data/grower-scan/discovery-engine-vs-design-recon.md` · [[D-33]] · tech-debt #51. **Also flagged:** `nursery.ts` pain-points are roadmap-derived not grounded; grower-scan research grounds the catalog-populate path (a separate improvement).

### 7. IDENTITY / ROLES / SECURITY ARC — auth principal → membership resolution → role/permission chokepoint → RLS wall → audit (status from ledger + migration file:line; not re-swept this pass)
- **SPINE:** auth-principal 🟢 → membership-resolution 🟢 → role/permission chokepoint 🟢 → **route-entry guard 🟢(`PermissionRoute`, OWNER-PROVEN 2026-07-06, tech-debt #50 CLOSED)** → RLS wall 🟢 → member/role/device console 🟢(`/team` OWNER-PROVEN 2026-07-06) → PIN self-change + reset 🟢 → device handoff + self-management 🟢(OWNER-PROVEN 2026-07-06/07) → biometric face-enroll 🟡(migration APPLIED, build owed) → audit-log 🟢(spine)/🔴(first writer)
- **STATUS per piece:** auth-principal=🟢 (`auth.uid()`, Off-Limits) · membership-resolution=🟢 (`BusinessProvider.tsx`; `is_active_member()` canonical RLS, ledger #3 owner-proven) · chokepoint+permissions=🟢 (`can()` + financial-permission backfill, ledger #2) · RLS cost/write wall=🟢 read-wall owner-proven / write-wall built (ledger #4/#5) · **member/role/device console=🟢 OWNER-PROVEN 2026-07-06 (ledger #86, `6913329`)** — the agnostic shared `MemberConsole` at `/team` (SUPERSEDES the deleted `/roles` RoleConfig): Users (invite + PRESELECTED per-member role, Staff refused from `/team`) · Roles (visibility-axis, floor seeded via `seed-role-floor.mjs`) · Devices (real `member_devices` lock-out/re-enable OWNER-PROVEN) · **per-user detail view + PIN-reset loop=🟢 OWNER-PROVEN (ledger #87, `5ab0c50`)** — owner-arm → member `/reset-pin` → set new PIN; SMS path stubbed (Twilio = banked David-action) · **email read-only login-cred + owner-manages-member-phone=🟢 OWNER-PROVEN (ledger #88, `ed1a3f8`)** — email not self-editable (UI + writer both blocked), owner sets member phone that persists · **route-entry guard=🟢 OWNER-PROVEN 2026-07-06 (ledger #89, `0c9e68d`)** — shared `PermissionRoute` wraps every gated route keyed on the registry `required_permission`; Staff refused at `/campaigns`+`/settings` by URL (mobile+desktop); dashboard campaign card removed → **tech-debt #50 RESOLVED** · **PIN self-change=🟢 OWNER-PROVEN (ledger #90(1), `25be6f7`)** — member changes own PIN from Your Profile (`changeOwnPin`, reuses `setOwnPin`/`hashPin`); **Settings QR invite=🟢 (#90(3))** · **self-device-handoff via QR=🟢 OWNER-PROVEN 2026-07-06/07 (ledger #91, `f83c937`)** — migration `20260706_member_device_handoffs` applied+verified A–D; add own device by scanning, no typing; single-use+TTL; mint-for-self-only RLS · **self-service device management=🟢 OWNER-PROVEN 2026-07-07 (ledger #92, `d794bad`)** — member sees + removes own devices from Profile, current-device guarded, no ghost devices; owner sees all via `/team` · **biometric face-enroll=🟡 migration APPLIED, BUILD OWED** — `20260706_member_devices_webauthn_credential` applied+verified (0 enrolled); persist-credential + set `biometric_enrolled` + Profile "Enable face unlock" control not yet built · **capR nav-integrity guard=🟢 live in `npm run verify`** (private-route↔nav orphan check, green) · audit-log=🟢 spine OWNER-PROVEN (ledger #19) but 🔴 **first writer NOT built** (#19B, factory-reset audit row)
- **ARC STATUS:** 🟢 the security wall is real and largely owner-proven; the member/role/device console + PIN-reset + email-cred lock are all OWNER-PROVEN 2026-07-06; **route-entry permission enforcement is OWNER-PROVEN 2026-07-06 (`PermissionRoute` wraps every gated route — Staff refused at `/campaigns`+`/settings` by URL mobile+desktop; dashboard campaign card removed) → tech-debt #50 RESOLVED** (the nav-only gating gap is closed as a CLASS); PIN self-change + self-device-handoff-via-QR + self-service device management are all OWNER-PROVEN 2026-07-06/07 (#89/#90/#91/#92). **OWED:** biometric face-enroll BUILD (migration `20260706_member_devices_webauthn_credential` APPLIED+verified, 0 enrolled; persist-credential + Profile control not yet built) · audit *spine* exists but **nothing writes to it yet** (#19B owed).
- **HOME DOC(S):** `docs/CLOSE-OUT-LEDGER.md` rows #2/#3/#4/#5/#16/#19 · `PLATFORM_STRATEGY.md` (AC-2/AC-3)
- **LANDMINE:** 🚨 RLS / tenant-isolation is **sacred** (ships to real nurseries — "data bold, security careful"); `oauth.ts` + PIN-auth are Off-Limits.
- **OFF-COURSE / EXTRA:** Person-spine CP1/CP2 (`person_id` overlay, migration STAGED — see ⚡ ACTIVE STATUS) · audit first-writer (#19B, UNBLOCKED) · ✅ **Campaign-Scheduler route-security bug RESOLVED + OWNER-PROVEN 2026-07-06 (tech-debt #50 — route-entry `PermissionRoute` closes the CLASS; #89, `0c9e68d`)** · **BIOMETRIC face-enroll BUILD owed** (migration `20260706_member_devices_webauthn_credential` APPLIED+verified, 0 enrolled; persist WebAuthn credential + set `biometric_enrolled` + Profile "Enable face unlock" control not yet built — queued next) · **David-action: provision SMS (Twilio ~$5–15/mo + A2P registration)** to light up the PIN-reset SMS-coded-link path (stubbed today) + notifications · **PWA-wrapper DECISION recorded: PWA now / Capacitor post-demo** (per the Aug-4 constraint; build not started — see 🔴 PWA wrap in ⚡ ACTIVE STATUS) · **pending CLAUDE.md addition (David-flagged): Thunder must EXECUTE its own migration verification queries before presenting them** (the polname/comment typo incident) · honest-debt: `/settings/all` Team tab still hosts a working invite → slim to a pointer at the `/team` console (ledger #86 follow-up) · **flag for a later look: phone-field discrepancy** — owner-set phone on `/team` vs empty on `/profile` self-view (do the two surfaces read the same `business_members.phone`?).

### 8. ASSET / INVENTORY / PMI ARC — assets → inventory → walk-and-count → preventive-maintenance schedule → service log (status from ledger + handoff file:line)
- **SPINE:** discovery-catalog 🟢 (+ size variants 🟡) → assets 🟢 → inventory 🟢 → walk-and-count 🟡 → PMI schedule 🟡 → service log 🟢 → (forward) reconciliation 🔴 · PMI↔Delivery ⚪
- **SIZE VARIANTS=🟡 BUILT catalog-side 2026-06-28 (ledger #62, `9f1063e`)** — discovery now captures WooCommerce size variants: `extractSizeVariants(rawHtml)` [deterministic, no AI — `data-product_variations` JSON + size `<select>` fallback, `normalizeSize` gallon canon] via a bounded `/product/<slug>` crawl (`fetchProductVariants`); `populate.ts` writes ONE `business_inventory` row per (variety × size), `variant_group`=parent slug, matched to the variety by `canonicalNameKey` (the L4 key); GATED migration `20260628_inventory_size_variants.sql` [`size`+`variant_group` text, David applies as postgres]; deploy-window safe; 31/0 unit (5/15/30/45 on LAWNS Vitex); BUILDER-COMPLETE, owner-proof owed after apply. **COUNT-SIDE size-picker = 🟢 OWNER-PROVEN 2026-06-30 (ledger #72, `InventoryCount.tsx`):** the L5 NEED_CLARIFICATION seam (the `:263` comment reserved it) surfaces a SIZE-PICKER when L4 token-set equality returns >1 row sharing ONE non-null `variant_group` with distinct sizes — pick → count routes to that exact per-size `business_inventory` row (pure `detectSizeCollision`; genuinely-ambiguous still → UNKNOWN; #61 single-match untouched). PROVEN David iPhone, emit-level trail `trace-capture-1782840727687` (per pick scan → L5 NEED_CLARIFICATION → collision matchCount:3 sizes:7/15/30 → chosen → correct per-size lot → save; routing verified by UUID 7gal→ede2aca2/15gal→b4c4429b/30gal→0adb74b8, DB matches 20/16/30, #61 Vitex unregressed same session); fixtures torn down via `--clear` (4 removed, 111 intact); reversible seed round-trip 9/9; `npm run verify` zero NET-NEW. **⇒ per-size catalog population (`populate.ts`) is now UNBLOCKED.**
- **STATUS per piece:** assets=🟢 (`BusinessAssets.tsx` editable assign+categorize, handoff 2026-06-18) · **asset-CAPTURE=🟡 BUILT 2026-07-01 (ledger #76): two-door (camera + MULTI-import) snap/import → compress → Vision `shape:'asset'` seam (0 new Vercel fns) → real `cost_objects` ASSET row (`estimated_value` @ESTIMATED, owner-edit→CONFIRMED) via shared `SyncEngine`; no-signal → compressed blob held in NEW shared IndexedDB `assets/assetBlobStore.ts` (#57 is string-only) + drain-on-reconnect; `AssetCapture.tsx` `/assets/capture` + Capture button; GATED migration `20260701_cost_objects_estimated_value.sql` (David applies as postgres, gate OWED); `origin/assets` recommended RETIRED (rebuild-not-refactor); BUILDER-COMPLETE, owner-proof owed** · inventory=🟢 (`BusinessInventory` / `/inventory`, live) · walk-and-count=🟡 LOOP BUILT scan→qty→save→next→complete (`InventoryCount`+`QrScanner`/jsQR, `/inventory/count`; SETS qty + records to GATED `20260626` count tables; ledger #54) BUILDER-COMPLETE, migration-apply + phone owner-proof owed · **walk-and-count RESOLVE=🟡 L4 token-set EQUALITY WIRED 2026-06-27 (ledger #61, `6e75b66`)** — fixes the LAWNS FALSE-UNKNOWN: NEW shared `packages/shared/src/utils/canonicalName.ts` [`nameTokenSet`/`canonicalNameKey`/`tokenSetsEqual`, barrel-exported = the ONE canonical key voice/typed/QR share] wired as L4 in `InventoryCount.handleScan` after tag_id/sku, before UNKNOWN [scan-slug tokens == catalog NAME tokens, order-insensitive; 1 match resolves, >1 → UNKNOWN never auto-pick = NEED_CLARIFICATION seam]; `vitex-shoal-creek` ↔ "Shoal Creek Vitex" now resolves; EQUALITY-ONLY [no false-match risk]; L3 stored-slug + L5 guarded-subset + L6 stemmed DEFERRED, seam at L4 [FAST-FOLLOW = guarded-fuzzy + picker UI]; `[TRACE:RESOLVE]` ON; NO schema/migration; 21/21 unit; **🟢 OWNER-PROVEN 2026-06-29 (David, iPhone — Shoal Creek Vitex → L4 → DISC-1105 → count wrote 45; the LAWNS demo-blocker FALSE-UNKNOWN is DEAD)** · **walk-and-count OFFLINE=🟡 WIRED 2026-06-26 (ledger #57)** — all 5 count writes route through NEW shared `packages/shared/src/sync/` [namespaced store + typed offline-op queue + write-through-or-enqueue + reconnect drain, idempotent via clientId=insert-PK]; dead-zone Save held+synced-on-reconnect (the `:181` abort is gone); identity-stamp (userId+clientTs per op, start guarded auth+online); same-lot-twice SURFACES a conflict (Keep-first/Keep-new, no silent overwrite); `DataBridge.js` untouched [44 Ignition imports, donor-reference] — its persistence half lifted+de-keyed, the sync-on-reconnect half it never finished now built; I&A heavy-sync DEFERRED (identity-stamp only); BUILDER-COMPLETE, phone owner-proof owed · PMI schedule=🟡 accept-flow + `interval_days` fix BUILDER-COMPLETE owner-proof owed (ledger #22, `pmiInterval.ts`) · service log=🟢 (`business_service_log`) · reconciliation (counted-vs-expected, sold/dead/missing)=🔴 DEFERRED, record model leaves room (`inventory_counts`) · `override_maintenance` permission=🟡 DECLARED, mechanism deferred (ledger #22B) · PMI↔Delivery coupling=⚪ conversation-only
- **ARC STATUS:** 🟡 the asset/inventory/PMI spine is built and mostly live; walk-and-count loop (now offline-capable via the shared sync slice, #57) + PMI accept-flow are owner-proof-owed; reconciliation, predictive/override + PMI↔Delivery layers are deferred.
- **HOME DOC(S):** `docs/CLOSE-OUT-LEDGER.md` rows #20/#22/#22B · `data/grower-scan/pmi-recon-ignition-cultivar.md` · `docs/CONCEPT-pmi-operational-intelligence.md`
- **LANDMINE:** none irreversible (membership-scoped RLS, AC-2).
- **OFF-COURSE / EXTRA:** PMI operational-intelligence surface (the surfacing engine pointed at equipment — ARC 4 family) · `override_maintenance` mechanism (defer/reason-required write + audit), gated on PMI↔Delivery.
- **FIELD FINDINGS (master bank #64 + Barryhill field bank #66, recorded — see CLOSE-OUT-LEDGER GENUINELY OPEN):** ✅ **size-variant SEQUENCING LANDMINE — RESOLVED + 🟢 OWNER-PROVEN at the count side 2026-06-30 (ledger #72, `InventoryCount.tsx`):** the count-side size-picker (the L5 NEED_CLARIFICATION seam) is PROVEN — a same-name multi-size scan surfaces a SIZE-PICKER (pure `detectSizeCollision`: ONE non-null shared `variant_group` + distinct sizes → pick → count routes to that exact per-size `business_inventory` row), instead of regressing to `InventoryCount.tsx:263` AMBIGUOUS→UNKNOWN; #61 single-match (Vitex→DISC-1105→count-45) unregressed same session; David iPhone, emit-level trail `trace-capture-1782840727687`, routing verified by UUID (7gal→ede2aca2/15gal→b4c4429b/30gal→0adb74b8, DB matches 20/16/30); fixtures torn down via `--clear` (4 removed, 111 intact). **Migration `20260628` stays APPLIED + verified (cols live, EMPTY). NOW: per-size catalog population (`populate.ts`) is UNBLOCKED.** · ✅ **A/B RESOLVED** — A offline-login fix DONE + 🟢 OWNER-PROVEN (#67/#68); ⇒ B count-side size-picker is the gating next-build · ✅ **reconciliation rhythm is PER-CATEGORY — CONFIRMED** (field-validated, Barryhill/Trinten: seasonal fast/markdown · trees slow/appreciate · tropicals inverse — `docs/domain/field-notes-barryhill-2026-06.md` §5, ontology §3) · ✅ **buyer-per-category — field-confirmed** (inventory cognition distributed per-category across the buyers' heads, "they know without checking a table"; may scope roles + the count tool — field notes §1) · ✅ **no-system grower = field-confirmed the ~88% case** (Barryhill: no inventory system, stock in heads, POS sales-only doesn't decrement = the reconciliation hole; count builds the catalog — user_stories asset-inventory-pmi, field notes §2/§3) · ⚪ **suggest-LESS doctrine field-validated** (a savvy operator runs lean, sees overextension as the industry's disease — field notes §7).
- **THE GROWER WITHOUT A SYSTEM (the ~88% case, [[OP-10]] structure-last):** confirmed at Barryhill (no inventory system, stock in heads, QR not set up) → the walk-and-count loop's UNKNOWN/name branch is the *exception* for LAWNS but the *normal path* here; the count BUILDS the catalog (`catalog_accrete` + fast name-pick + voice). Stories: `user_stories.md` asset-inventory-pmi (2 new, master bank #64).

---

## 📚 CAPTURE INDEX — the single retrieval point (so nothing is re-derived or re-captured)

> One row per captured decision/doctrine/concept. **The POINTER is the point — not the content** (one fact, one home; this references it). Read this index → know what exists and where, instead of re-deriving. Swept from the actual docs this pass (file:line / section). Maintain via the end-of-session loop (step 6): a capture without an index row is **not done**.
> ⚠️ **CONVERSATION-ONLY (owed a doc home — listed here so they're not lost, but they have no canonical doc yet):** async-invite-gated front-door choreography · structured-query architecture (vertical-assembles-the-call). Both flagged in the front-door recon; do NOT re-derive — capture them to a doc when built.

**DECISIONS.md — operating (OP-) + product (D-) decisions** *(canonical short entries; several D- have a fuller home doc, noted in the cost-docs block)*
| ID | HOME (file:line) | WHAT IT SAYS | ARC |
|---|---|---|---|
| OP-1 | DECISIONS.md:99 | Crush competition by ANY *ethical* means within the covenant — ethics is the method | platform-wide |
| OP-2 | DECISIONS.md (OP-2) | Composite working register — Lightning's voice: Doug (verification) / Darren (directness) / Binder (synthesis) / Scott Morrison (dry edge); "the conversation is the corrector, not either party" → `docs/operating-doctrine/lightning-david-partnership.md` §2–§4 | working-method |
| OP-3 | DECISIONS.md (OP-3) | "This isn't working" reconsider-framework — five hard triggers + one soft; decision points, not failure points. ⚠️ Criteria are PERSONAL-SENSITIVE and live OUTSIDE the repo (`decisions/PERSONAL-FINANCIAL.local.md`); the framework only is in DECISIONS.md OP-3 | working-method |
| OP-4 | DECISIONS.md:133 | STD-003: `[TRACE:*]` ON by default, off only after OWNER-PROVEN; two bars (builder vs owner) | platform/arch |
| OP-5 | DECISIONS.md:153 | Good-enough model + AI-as-equalizer; never demand labor the owner won't give | platform-wide |
| OP-6 | DECISIONS.md:169 | Graceful degradation — three owner-fidelity tiers (maintain / confirm / infer) | platform-wide |
| OP-7 | DECISIONS.md:186 | AI infers → proposes → owner one-tap confirms (expensive records) | suggestion |
| OP-8 | DECISIONS.md:205 | HAVE / NEED / WANT three-lens recon standard | working-method |
| OP-9 | DECISIONS.md:228 | The Regina Principle — move "noticing what to do" off the owner onto the tool | suggestion |
| OP-10 | DECISIONS.md (OP-10) | Structure-Last — the structure tax is paid by the MACHINE, not the human (+ small-grower expression, ~88% no-structure) | platform-wide |
| OP-11 | DECISIONS.md (OP-11) | Reconcile on both bars — an OWNER-PROVEN report triggers the FIRST-action flip 🟡→🟢 across ALL canonical surfaces (⚡ ACTIVE STATUS · 24-board · `built-inventory.md` · ARC-MAP · mapped `user_story`); a stale 🟡 on a proven capability is DRIFT (tech-debt #39 class) | working-method |
| OP-12 | DECISIONS.md (OP-12) | Reference-first promotion — code/schema reaches LIVE only by promoting a reference-proven artifact (schema byte-identical, no hand-edits); the 4th completion bar (DEPLOY TO LIVE). DORMANT until 1st paying customer | working-method |
| OP-13 | DECISIONS.md (OP-13) | Retention over trimming — CLAUDE.md §3 holds **N=3** entries; overflow moves VERBATIM to `handoff-archive.md` BEFORE the new entry (skipping it = INCOMPLETE close, same force as the reconcile gates); the line-3 header is a POINTER, never a summary (STD-011 — it hid ~1,400 tokens/session inside ONE physical line). Gate: `end-of-session-protocol.md`; exec: CLAUDE.md §9 step 0 | working-method |
| OP-14 | DECISIONS.md (OP-14) | A surface without a test is a claim — owner-test coverage gate; Thunder writes the check and sets `owed`, only David's live run flips `covered`; a moved surface flips `covered`→`owed`. Home: `end-of-session-protocol.md` → GATE — OWNER-TEST COVERAGE | working-method |
| OP-15 | DECISIONS.md (OP-15) | Owner-prove STEP ZERO — confirm the deploy for THIS SHA is READY before any observation is evidence (a failed deploy serves the old bundle; Vercel deploys the TREE not the COMMIT). Homed as a GATE 0 block at the TOP of every owner-test board where **DAVID stands** (row-19B: a rule filed only in a protocol doc is a note, and notes don't act). SHA-stamp mechanical form OPEN — David rules after recon | working-method || D-1 | DECISIONS.md:256 | Cost-object schema = rename-in-place to ONE FK-able node table | cost-to-produce |
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
| D-23 | DECISIONS.md (D-23) | FAITHFUL vs CONNECTED — one source, two renders, default faithful (never call their data disorganized) | product / cross-grower |
| D-24 | DECISIONS.md (D-24) | RIGID SPINE / FLEXIBLE EDGE — per-field rule: operate-on-it → column, describe → JSONB blob (bag UNBUILT) | architecture |
| D-25 | DECISIONS.md (D-25) | INTELLIGENCE TIERS — Tier-0 world knowledge (ZIP→zone→season) = day-one value before owner data exists | product / discovery |
| D-26 | DECISIONS.md (D-26) | DUAL LEXICON (Happy Hose) — speak the trade's words + the owner's, translate; canonical = join key (SINGLE-SOURCE) | product / cross-grower |
| D-27 | DECISIONS.md (D-27) | Residence Product ("Kitchen Loop") = a residence-SCOPED VIEW of the one shared engine — entry-point pointer, not a separate app | product / residence |
| D-28 | DECISIONS.md (D-28) | API NEUTRALITY — use any API that makes the answer more honest/effortless; refuse any whose price of admission is bias | architecture / all-arcs |
| D-29 | DECISIONS.md (D-29) | OFFLINE / LOCAL-FIRST capture is platform-wide on an HONEST GRADIENT — capture always works, parsing populates on sync | architecture / platform |
| D-30 | DECISIONS.md (D-30) | Shared-device auth — three flavors, face-SWAP preferred, face-RECOGNITION do-not-build | identity / device |
| D-31 | DECISIONS.md (D-31) | Platform DB + spine-first — one platform database (80/20); Ignition retires onto the shared spine | architecture / platform |
| D-32 | DECISIONS.md (D-32) | Discovery — not every absence is an opportunity (gap vs deliberate business decision) | discovery |
| D-33 | DECISIONS.md (D-33) | Discovery FIX — Option A gap-vs-decision (scoped, NOT built, post-demo) | discovery |
| D-34 | DECISIONS.md (D-34) | The LOT is the SKU — lot-level history; `cultivar_plants` is identity-only | inventory |
| D-35 | DECISIONS.md (D-35) | Sell price is STORED on the stock line (`business_inventory.sell_price`); engine suggests, doesn't govern | inventory / cost |
| D-36 | DECISIONS.md (D-36) | `order_items` is AC-1-clean — `business_inventory_id` is the SOLE line anchor (`plant_id` DROPPED) | inventory / money |
| D-40 | DECISIONS.md (D-40) | Tax is a computed line on the shared money boundary (rate-source · taxability seam · party exemption · audited authority) | money / tax |

**DECISIONS homed in `docs/decisions/` (D-42+ — NOT yet folded into DECISIONS.md)** *(canonical decisions whose home is a dated file; flagged for a fold-into-DECISIONS.md pass — see tech-debt #63)*
| ID | HOME | WHAT IT SAYS | ARC |
|---|---|---|---|
| D-42 | docs/decisions/2026-07-13-inventory-decrement-on-paid-D42.md | Inventory decrement-on-PAID (the Amazon model) — stock drops when the order is paid, not at cart | inventory / money |
| D-43 | docs/decisions/2026-07-13-order-line-breakdown-persisted-D43.md | An order PERSISTS its own line breakdown (frozen-at-charge, show-the-work) | money |
| D-45 | docs/decisions/2026-07-14-count-promote-D45.md | Count-commit PROMOTES size + qty into a `variant_group`-keyed `business_inventory` row | inventory |
| D-46 | docs/decisions/2026-07-14-complete-inventory-crud-D46.md | Complete inventory CRUD — ONE editor, from-the-row add-size, reference-aware delete | inventory |
| D-47 | docs/decisions/2026-07-16-qbo-customer-identity-resolution-D47.md | QBO customer identity — the three-way rule (query email AND DisplayName; ambiguity never auto-links); = STD-019 | identity / money |
| D-48 | docs/decisions/2026-07-16-service-price-override-is-a-discount-D48.md | A service price OVERRIDE is a DISCOUNT — retail baseline preserved; the concession rides the line's `discountAmt` | money / cost |
| D-49 | docs/decisions/2026-07-16-count-fills-the-stub-D49.md | A scraped stub is a VARIETY PLACEHOLDER, not a stock line; the first count FILLS it | inventory |

**NORTH STAR + domain knowledge base** *(the master bank, 27–29 June — ledger #64)*
| NAME | HOME | WHAT IT SAYS | ARC |
|---|---|---|---|
| THE NORTH STAR | `NORTH-STAR.md` | Top-of-hierarchy (above PLATFORM_STRATEGY + MASTER_BRIEF): spotlight brain · catch the threads · four shapes · the TIMING LAYER (net-new) · two-tier trust architecture (web now / local-LLM premium) · the test for every build | platform-wide / north-star |
| Domain knowledge base — MAP | `docs/domain/README.md` | 9-section index w/ depth tags + the before-any-domain-build rule; what each section grounds | domain / all-arcs |
| Domain ontology | `docs/domain/ontology.md` | Canonical trade reference: size/ANSI-Z60.1 · naming/token-set · category/seasonal-vs-specimen · TX sourcing map | domain / inventory |
| Field notes — Barryhill / Trinten | `docs/domain/field-notes-barryhill-2026-06.md` | Primary-source grower testimony: buyer-per-category cognition · no-system + sales-only POS (the reconciliation hole) · per-category rhythm CONFIRMED · pot-size vernacular · suggest-LESS field-validated · warm interview contact | domain / inventory |

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

> ⚠️ **THE NAME SAYS 24. THE BOARD HOLDS 26 ROWS. COUNTED 2026-09-03, NOT ASSERTED** (`grep -cE '^\| *[🟢🟡🔴] *\| *\*\*[0-9]+\.[0-9]+\*\*'` over this section): **0.1 · 1.1–1.5 · 2.1–2.3 · 3.1–3.7 · 4.1–4.3 · 5.1–5.7 = 26.** `0.1` is the L0 foundation and is broken out by convention, leaving **25 L1–L5 capabilities under a name that says 24** — so the board has gained exactly one row since it was named, and the name never moved. `docs/CAPABILITY-PACKAGE-GROUNDTRUTH.md:9` carries the same note one generation stale (*"enumerates 25 rows … The 24 are L1–L5"*) — true when written, off by one now.
>
> 🔴 **THE HEADING STRING IS DELIBERATELY NOT RENAMED, AND THAT IS THE POINT.** `status.html:261` parses `/^##\s*📋\s*24-CAPABILITY BOARD/i` and `:471` falls back to *"No 📋 24-CAPABILITY BOARD section found."* **Renaming this heading to fix the count would silently blank the panel** — which is precisely the format-vs-reader mismatch that left 19 of 20 owner-test boards unrendered for seven weeks. **A heading a renderer parses is an interface, not a label.** The rename rides the reader build (§3 of that scope), where both sides move together. Ledger #261.

> Grouped by layer (fixed grouping). Each cap: `[●] id name · reuse/Ignition tag · → feeder`. Reconciled to today's code from `docs/CAPABILITY-PACKAGE-GROUNDTRUTH.md` (2026-06-19 baseline 7 live/8 partial/9 net-new).
> **Today: 8 live · 10 partial · 8 net-new** — moved since baseline: 3.5 partial→🟢 (delivery loop closed 06-20); 1.2 + 1.3 net-new→🟡 (built 06-19/06-21, owner-proof owed); **NEW 3.7 Customer management 🟢 (OWNER-PROVEN 2026-07-03)**; **2.1 QR Checkout 🟡→🟢 (2026-07-08 — all 8 hardcoded-register items CLEARED: QB preview order-backed, receipt/footer/opt-in/labels/placeholders read from data; + attributed price-override leakage; owner-proof owed).**
>
> **⛔ HARDCODED-DEBT RULE (binding — CLAUDE.md §6 rule 12):** 🟢 = done AND no open hardcoded debt. A capability with ANY open item in [`docs/decisions/HARDCODED-REGISTER.md`](../docs/decisions/HARDCODED-REGISTER.md) is **CAPPED AT AMBER** and shows its debt count (`⛔ hardcoded-debt: N`) until every item is cleared (reads from data) or documented-with-reason. The `status.html` renderer enforces this — a row marked `⛔ hardcoded-debt: N` renders amber even if its dot is green.

| ● | Cap | State / note | → feeder |
|---|---|---|---|
| 🟡 | **0.1** Vertical-as-pointer | partial — `business_type`+registry vertical field live; typed `VerticalConfig.ts` still [M] | GROUNDTRUTH 0.1 |
| 🟡 | **1.1** Recognition + discrepancy | recognition live; discrepancy-compare built 06-19, owner-proof owed | `discovery/compare.ts` |
| 🟡 | **1.2** Sandbox (alive dashboard) | built 06-19, owner-proof owed | `scripts/seed-sandbox.mjs` |
| 🟡 | **1.3** Clear→real catalog-populate (D-9) | built 06-21 (114 real LAWNS varieties), migration-gated | `discovery/catalog.ts` |
| 🟡 | **1.4** AI-assisted questions→config | partial — scaffolding only; answer-capture/setup-write [M] | GROUNDTRUTH 1.4 |
| 🟡 | **1.5** Handshake (one auth, two products) | one auth live; `business_discovery_profiles` applied; Person-spine 06-25 advances identity | GROUNDTRUTH 1.5 |
| 🟢 | **2.1** Cart / QR checkout (no money) | live capability, hardcoded-debt CLEARED 2026-07-08 (all 8 register items fixed — QB preview order-backed via `orderItemName.ts`, receipt/footer/opt-in/labels/placeholders read from data; + attributed price-override leakage); owner-proof owed | built-inventory 2.1 · HARDCODED-REGISTER.md |
| 🟢 | **2.2** Compliance / netting (TX Ch.725) | live, persisted + immutable | `order_compliance_records` |
| 🟡 | **2.3** Walk-and-count inventory | LOOP BUILT (scan→qty→save→next→complete, `InventoryCount`+`QrScanner`/jsQR) + OFFLINE-CAPABLE (ledger #57 — shared `sync/`: dead-zone Save queues + drains, identity-stamp, double-count surfacing) + **RESOLVE L4 token-set EQUALITY (ledger #61 — shared `canonicalName.ts`, fixes the LAWNS FALSE-UNKNOWN; EQUALITY-only, guarded-fuzzy L5/L6 = fast-follow)** + **SIZE VARIANTS captured catalog-side (ledger #62, `9f1063e` — `extractSizeVariants` deterministic, one `business_inventory` row per variety×size, `variant_group`=slug; migration `20260628` APPLIED) + COUNT-SIDE SIZE-PICKER 🟢 OWNER-PROVEN 2026-06-30 (ledger #72, `InventoryCount.tsx` — L5 NEED_CLARIFICATION seam: same-name multi-size scan → size-picker → routes to that per-size row; pure `detectSizeCollision`; #61 single-match untouched; David iPhone trail `trace-capture-1782840727687`, routing verified by UUID, fixtures `--clear`'d; seed round-trip 9/9; ⇒ per-size population (`populate.ts`) UNBLOCKED)**; OCR-intake sibling still NEXT. **+ RECONCILE SURFACE 🟢 OWNER-PROVEN 2026-07-22** (ledger #145 — a count becomes stamped, dated, attributed truth on the append-only ledger; the #146 replay fix proven alongside it). **STAYS 🟡:** tech-debt **#56** (size vocabulary — six spellings of three sizes, and unlike its siblings it can MERGE existing rows) and **#67** (blind capture — the count applies at capture, so the desk review of that same walk is 0 by construction). | ledger #54 · #57 · #61 · #62 · #72 · `walk-and-count-inventory-verify-first.md` · `2026-06-27-discovery-size-variants.md` |
| 🟢 | **3.1** Leakage / missed-upsell visibility | live | Dashboard leakage tile |
| 🟡 | **3.2** Suggestion engine (at-sale upsell) | L4 companion offer (netting) LIVE + OWNER-PROVEN at checkout via `service_offerings`/`trigger_transport_mode` (`AddOns.tsx:39`); L5 general suggestion engine [M] (arbitrary triggers, forward-run from cost-to-produce, D-19) | GROUNDTRUTH 3.2 |
| 🔴 | **3.3** Post-sale service engine | net-new — dead schema scaffolding (`timing`/`recurrence_days` cols exist, no firing) | GROUNDTRUTH 3.3 |
| 🔴 | **3.4** Scheduling (self-book + calendar) | net-new — no calendar/booking table | GROUNDTRUTH 3.4 |
| 🟢 | **3.5** Routing / delivery | live — delivery loop closed 06-20; round-trip anchor 06-25; **embedded map + geocoded pins (#78), real driving route + shortest-path optimize (#80), date-edit (#79) all OWNER-PROVEN 2026-07-03; capture-invoice launcher second door (#85, `134bacd`) OWNER-PROVEN 2026-07-06** | `DeliveryRoute.tsx` |
| 🟢 | **3.6** Insights / analytics dashboard | live | `api/dashboard.ts` |
| 🟢 | **3.7** Customer management (roster · edit · dedup · person/org) | live — /customers roster (3rd DataSheet consumer) + in-context edit modal + person/org classifier (customer_type) + org-dedup (name+billing → reuse id + add delivery, never split ship-to); OWNER-PROVEN 2026-07-03 (roster/modal/classifier + dedup both cases); tier column now INLINE-EDITABLE + contractor/tier pricing mechanism+config built 2026-07-09 (D-35 AC-4 closed, owner-proof owed) | Customers.tsx · CustomerEditModal.tsx · customerUpsert.ts · tierPricing.ts |
| 🟢 | **4.1** QuickBooks (invoice/refresh/source) | live (500 fix `14a9a82`); reconnect owner-proof caveat | `api/qbo/*` |
| 🟡 | **4.2** Reconciliation double-whammy | **THE ARITHMETIC IS BUILT AND 🟢 OWNER-PROVEN 2026-07-22** — `/inventory/reconcile` (ledger #145) replays the ledger window and nets sales automatically: proven live at counted 38 vs book 40 surfacing only the **−2** residual, and at **−17** splitting into `dead −4 + loss −3 + count_reconcile −10` (not −24). D-42's "sold" input landed and D-52 re-dated it to true departure. **STAYS 🟡, NOT 🟢, for one honest reason:** the count-then-review LOOP is not closed — `InventoryCount.tsx:438` applies the count **at capture**, so a desk reconcile *of that same walk* reads residual **0 by construction** (tech-debt **#67**, David's open build input), and session scoping (**#68**) is unbuilt. Per-lot reconcile across the catalog: proven. The walk-as-a-unit review the story describes: not yet. | GROUNDTRUTH 4.2 · D-42 · D-50 · #67/#68 |
| 🟡 | **4.3** Social media (gen + publish) | partial — generation live; publisher (Blotato) removed by design | `social/generate-posts.ts` |
| 🟢 | **5.1** Inventory management | live (create+read+**EDIT** — datasheet v1, ledger #75; sort/filter/hide-cols + inline edit, owner-proof owed desktop) | `BusinessInventory.tsx` |
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
- 🔴 **KEY IDS — THE THREE CULTIVAR TENANTS, NAMED TOGETHER SO THE PAIR CANNOT BE CONFUSED AGAIN (corrected + consolidated 2026-08-30, R-26 instance 12, ledger #235):**
  - **LAWNS Tree Farm, LLC — `ed2e5933-45dc-4b9b-a331-ddfd125e7a74`** · THE REAL CUSTOMER. Members on `@lawnstrees.com`; QuickBooks realm `9341455222430707`; Saturday 2026-08-29's seven installs. ⚠️ This line previously read `a1b2c3d4-0000-0000-0000-000000000001` — a placeholder that was never a real tenant.
  - **Test Dave's Tree Nest — `f7ec5d67-a9ef-4cb0-b807-438d67687d1b`** · THE TEST TENANT. Members `dave_obrian`, `test.obrien`, `user.obrien`. ⚠️ `docs/audits/social-campaign-path-recon-2026-08-22.md:17` called this id **LAWNS** — corrected 2026-08-30. **Destructive and exploratory work goes here, never on LAWNS.**
  - **Test David's new Business — `06065fe7-95cd-4698-a969-d93769e70921`** · ✅ **INTENTIONAL, NOT DEBRIS.** Tenants cannot be deleted, so David is **repurposing it as a general-purpose tenant for his own use.** A doc calling it stray is the next R-26 instance; it is recorded here as deliberate.
  - JB Auto (Ignition test) `fb18f55e-ecb7-40a8-8616-a3c38ab11b93`.
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
| **The WHY above everything — what TRACE is ultimately for (TOP OF HIERARCHY)** | **`NORTH-STAR.md`** (sits ABOVE MASTER_BRIEF + PLATFORM_STRATEGY — they serve it) |
| Domain truth (size/naming/category/sourcing) — keeps builds domain-correct + the product credible | `docs/domain/README.md` (MAP) + `docs/domain/ontology.md` |
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

**Conflict rule:** for the *WHY / what we're ultimately for*, `NORTH-STAR.md` is the top of the hierarchy (MASTER_BRIEF + PLATFORM_STRATEGY serve it). For what's *built*, PLATFORM_AUDIT.md wins. For *strategy*, MASTER_BRIEF. For *architecture*, PLATFORM_STRATEGY. For *domain truth*, `docs/domain/`. This bootstrap is the map; those are the territory.

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
