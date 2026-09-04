# TRACE — SESSION BOOTSTRAP (paste this FIRST in any new chat)

> **What this is:** the single front-door doc — and the CANONICAL status front-page. Paste this at the start of every new Lightning (Claude-in-chat) session to get current in ~90 seconds. It is the MAP, not the territory — deep detail lives in the reference library (§7) and the feeder docs each ⚡ line links to. Structure is FIXED; only the values change. Update at session-end (see END-OF-SESSION PROTOCOL doc + CLAUDE.md §9).
>
> **Last updated:** 2026-08-24 (**#207 — 🔧 BUILD: THE SWALLOWED STORAGE FAILURE. A LOCAL WRITE THAT DID NOT PERSIST STOPS REPORTING SUCCESS.** 🔴 **`store.ts` discarded a quota / disabled-storage exception, so `enqueue()` returned normally over a queue that had not grown — under a banner reading *"counts are saved on this phone and will sync when you're back in signal."*** 🔴 **AND THE HALF THE RECON DID NOT HAVE, MEASURED BY COUNTING DATABASE CALLS: THE ONLINE PATH WAS WORSE — it returned `applied`, the strongest claim the engine can make, with `drain applied:0 failed:0 remaining:0` and the database called ZERO times.** Success inferred from an ABSENCE (A9/D-9 on the write path; R-12's class on the client side of the wire). ✅ **`save()` STILL NEVER THROWS — the exception is RETURNED** as `StoreWriteResult`, R-11's union discipline applied to the write side, with `quota` and `unavailable` kept distinct because they need different actions. ✅ **AN UP-FRONT WRITE-THEN-READ-BACK PROBE warns BEFORE the walk** — *the difference between losing one entry and losing an afternoon* — and reads back deliberately, because a Private tab can ACCEPT `setItem` and persist nothing. ✅ **AFTER: offline → `failed` naming STORAGE; online → `applied` with the database called ONCE, so the claim is TRUE.** ⚠️ **IndexedDB NOT taken — OWED as S-A, with its data answer written down.** **GATE 0 PROVEN BY WATCHING THE TRANSITION `680b00d` → `4056de8`.** NO schema, NO migration, NO cap.) — PRIOR: 2026-08-23 (15) (**#206 — 🔧 BUILD: THE SCANNER STOPS BLAMING THE TAG FOR A DEAD ZONE — R-11's FIRST INSTANCE.** 🔴 **`stockLineResolver`'s three reads discarded the Supabase `error` and substituted `(rows ?? [])`, so a network failure returned the BYTE-IDENTICAL value a genuinely absent tag returns — and the app told Lauren, by name, in a modal, to *check the tag*.** ✅ **THE FIX IS A TYPE, NOT A DISCIPLINE: new `ReadResult<T>` = `{ok:true;value}` | `{ok:false;error}` — `.value` is unreachable without handling the failure, so `tsc` refuses the careless caller.** **PROVEN BY THE CHANGE: the signature flip produced 36 NET-NEW `tsc` ERRORS, one per site that had been ignoring a failure, across ALL 5 call sites in 3 files** — the thing a returnable `{data,error}` demonstrably cannot do. ✅ **`isConnectivityError` MOVED (not copied) to `utils/supabaseError` — one predicate, two consumers (§6 r8).** 🔴 ***"Check the tag"* can no longer appear on a connectivity failure, on any of the three screens** — checkout gets its own `'unreachable'` phase, the count sheet swaps its heading and **keeps typed entry open**, the QR profile stops saying *Plant not found*. ⚠️ **AND BEYOND COPY: resolve-before-create now REFUSES on a failed read instead of falling through to *genuine NEW variety*** — an unreadable catalog looked identical to an empty one and the answer was *create it*. ✅ **The undocumented 24-hour QR read cache is DECLARED, not removed.** **GATE 0 PROVEN FROM THE DEPLOYED BUNDLE (`3d0944b`) — new copy present AND old copy survived.** ⚠️ **R-11's 30-site build STAYS OWED.** NO schema, NO migration, NO cap.)
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

### 🔴 THE GRID ENGINE IS PLATFORM CODE NOW (2026-09-03, ledger #272)

- 🟢 **DONE, ZERO BEHAVIOUR CHANGE — no owner-proof owed.** `<DataSheet>` + its unit moved `packages/cultivar-os/src/components/datasheet/` → **`packages/shared/src/components/datasheet/`**, verbatim (`020793b`). **37 changed lines in the engine, every one a comment** — proven by filtering the rename-detected diff, not asserted. → `packages/shared/src/components/datasheet/DataSheet.tsx` · ledger **#272**
- 🔴 **THE ASSUMED COUPLING DID NOT EXIST.** Entire transitive closure = `react` + `lucide-react` + two zero-import siblings. No supabase, no business context, no permission hook, no router. **8 consumers, one import line each.**
- 🔴 **THE PROMOTION TRIGGER IN ITS OWN HEADER HAD ALREADY FIRED AND NOBODY RE-READ IT** — it said *"when a real second-vertical consumer appears"*, and the consumer was `QboBooksReader` **inside `shared` itself**. [[R-26]]'s class.
- ⚠️ **`datasheet/` DIRECTORY NAME IS LOAD-BEARING — DO NOT RENAME.** `usesSharedGrid` matches that path fragment; renaming silently converts all 8 consumers into undeclared bespoke surfaces. Carrier paths in `ui-control-standards.md:18-19` move WITH the file or the engine is measured as a divergence from itself.
- 🔴 **TWO DECISIONS LEFT OPEN, BOTH DAVID'S:** ① **widening the divergence cap's `SCAN_ROOT`** — deliberately NOT done; it re-baselines `undeclared_bespoke_surfaces:23` into an unknown, and the honest reading is MORE unaudited surfaces. ② **how a shared component learns which vertical it renders in** — tech-debt #157's real blocker, unanswered.
- ⚠️ **OWED, NOT DONE:** `QboBooksReader` is **still a plain table** — the reach is real now, so that is a CHOICE rather than a limit. Converting it is its own build against G1–G7 with its own cards.
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


### 🔴 MIGRATIONS — WHAT DAVID CAN APPLY, IN ORDER (measured 2026-09-03, ledger #262)

**What is visible in a `main` checkout, dated 2026-09:** exactly three, and **all three belong to
`thunder/vendor-identity`** (merged). Reported here, not coordinated across the branch — [[R-62]];
David relays.

| # | File | State | Apply |
|---|---|---|---|
| 1 | `20260902_receipt_line_edit_and_vendor_preference.sql` | ✅ **APPLIED 2026-09-02**, catalog-confirmed | done |
| 2 | `20260902_vendor_identity_and_preference.sql` | ✅ **APPLIED 2026-09-03**, catalog-confirmed | done |
| 3 | `20260902b_vendor_preferences_join_on_vendor_id.sql` | ✅ **APPLIED 2026-09-03**, catalog-confirmed | done |
| 4 | `20260904_receipts_receipt_number_original.sql` | ✅ **APPLIED 2026-09-04** (#273); `with_original` 0 = the pass, nothing backfilled | done — CARDS 16-18 unblocked |

**WHY THAT ORDER, from the files rather than from habit:** #3 opens with a `DO $preflight$` block
that requires **both** `vendors` (created by #2) and `vendor_preferences` (created by #1). Paste #3
first and it stops with a **named refusal**, not a crash:
`consolidation pre-flight FAILED — 'vendors' does not exist. Apply 20260902_vendor_identity_and_preference.sql first.`
🔴 **That refusal is the feature working.** Expect it if the order slips; it is better evidence than
a row count, because it names the missing prerequisite instead of leaving a bare `42P01`.

**WHAT EACH UNBLOCKS:** #2 creates `vendors` + `vendor_aliases` and adds `receipts.vendor_id` — the
consolidated vendor store ([[R-65]]) the receipt detail view resolves against. #3 adds
`vendor_preferences.vendor_id`, the `vendor_preferences_resolved` view and `link_vendor_preference`,
which is what lets the billing-unit answer be read through the vendor rather than through a
name-key. Together they close tech-debt **#151** (two stores answering one question).

**🔴 DID APPLYING #1 BEFORE #2 CAUSE A PROBLEM? NO — AND HERE IS THE MEASUREMENT, NOT A REASSURANCE.**
`20260902_vendor_identity_and_preference.sql` contains **zero occurrences of the string
`vendor_preferences`** (grepped, whole file). The two touch **disjoint objects**: #1 creates
`vendor_preferences` and the receipt-line guards; #2 creates `vendors`, `vendor_aliases` and
`receipts.vendor_id`. Neither alters the other's tables, so there is no ordering between them.
⚠️ **THE FAILURE THAT WOULD HAVE MATTERED, AND WHY IT DOES NOT APPLY:** if #2 had *also* created
`vendor_preferences`, its `CREATE TABLE IF NOT EXISTS` would have **silently skipped** the existing
one and left a table with #1's shape under #2's assumptions — a silent wrong-shape, not an error.
It does not name the table at all, so that cannot happen.
⚠️ **THIS IS MEASURED FROM THE FILES, NOT FROM THE LIVE CATALOG — I have no database access.**
Prove it in the SQL editor before trusting it:
```sql
SELECT table_name, count(*) AS cols
  FROM information_schema.columns
 WHERE table_schema='public' AND table_name IN ('vendor_preferences','vendors','vendor_aliases')
 GROUP BY table_name ORDER BY table_name;
```
**A pass looks like:** `vendor_preferences` present **now**; `vendors` and `vendor_aliases`
**absent until #2 runs**, present after. If `vendors` already exists before you run #2, stop — the
order assumption is wrong and #2 needs re-reading.

### ✅ THE THREE TRAPPED MIGRATIONS ARE ON `main` — MERGED 2026-09-03 (`d6d4f0f`)

**`thunder/qbo-review-test-mode` is MERGED.** All six 2026-09 migrations now render in
`supabase/migrations/` on a `main` checkout, confirmed by name after the merge:

| File | State | Notes |
|---|---|---|
| `20260902_receipt_line_edit_and_vendor_preference.sql` | ✅ applied 2026-09-02 | — |
| `20260902_vendor_identity_and_preference.sql` | ✅ applied (#263) | vendor chain step 1 |
| `20260902b_vendor_preferences_join_on_vendor_id.sql` | ✅ applied (#263) | vendor chain step 3 |
| **`20260902_business_qbo_writes_switch.sql`** | ⏳ **NOT APPLIED — APPLY FIRST** | 🔴 until it lands **every order is written as a test order** |
| **`20260903_inventory_retire_lifecycle.sql`** | ⏳ not applied | unblocks owner-test **CARD 21** |
| **`20260903b_display_standards.sql`** | ⏳ not applied | unblocks owner-test **CARD 22** (the card with the stop) |

🔴 **APPLY ORDER: the writes switch FIRST, then `20260903b`, then `20260903`.** The writes switch is
the only one that is actively wrong today; the other two are independent of each other and of it
(different tables, no shared objects), so their order between themselves does not matter — but
**CARD 22 runs before CARD 21**, so applying `20260903b` first keeps the card order and the apply
order the same and removes a chance to mix them up.

⚠️ **CAN THEY BE PASTED TWICE? MEASURED PER FILE, NOT ASSUMED.**
- **`20260902_business_qbo_writes_switch.sql` — YES, safe.** One `ADD COLUMN IF NOT EXISTS` and
  nothing else: no policy, no table, no index, no trigger.
- **`20260903_inventory_retire_lifecycle.sql` — YES, safe.** Two `ADD COLUMN IF NOT EXISTS` and one
  `CREATE INDEX IF NOT EXISTS`.
- 🔴 **`20260903b_display_standards.sql` — NO.** It has **2 `CREATE POLICY` and 0 `DROP POLICY IF
  EXISTS`**, so a second paste errors **`42710` and rolls back the whole thing**. Harmless but
  alarming, and it is **the same shape that bit the vendor chain** (7 policies, no drops). If you
  see `42710` on a re-paste, it already applied — go straight to the verification queries.


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
