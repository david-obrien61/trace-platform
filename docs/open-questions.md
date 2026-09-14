# OPEN QUESTIONS — everything waiting on David, in one place

**Last updated: 2026-09-14** (ledger #321 — the production stamp **owner-proof READ LIVE**, `· prod` on `cultivar-os.app`; tech-debt **#294a** separated out with a **proposed check**; **#280 ①** sharpened after this session's own unpushed merge. Ledger #320 — the §3 entry gate, and 🔴 **the register's own blind spot named**: it is fed by §3's *FLAGGED FOR DAVID*, and fifteen close-out rows never wrote a §3 entry at all, #302 — the row that created this file — among them. The counts below are still measured 2026-09-11 and say so)
**Scope:** every question the platform cannot answer for itself, across all seven places they currently live.

> 🔴 **THIS FILE IS AN INDEX, NEVER A SECOND COPY.** Each entry gives the question, enough of its own
> words to be actionable, and **the file that OWNS it**. The owning file stays authoritative: answer a
> question there, and update the one line here. **A second full copy of a question is STD-011** — two
> representations of one fact, and the copy is always the one that goes stale. That is precisely the
> defect this repo has logged eleven times in three days ([[R-26]]).
>
> ⚠️ **WHY IT EXISTS ANYWAY:** the questions are real and they are scattered across **seven homes** —
> `RULINGS.md`'s OWED table, CLAUDE.md §3's *FLAGGED FOR DAVID*, CLAUDE.md's *Open Architecture
> Decisions*, CLAUDE.md §4's pending data task, the close-out ledger's Blocker column,
> `tech-debt-log.md`, and `DECISIONS-INDEX.md`. **No single surface has ever shown David how many
> there are.** This one does, and it holds counts and pointers only.

---

## THE COUNT, MEASURED 2026-09-11

| Home | Open items | What lives there |
|---|---|---|
| `docs/RULINGS.md` → **OWED** section (line 248+) | 🔴 **65** | Questions only David can answer. 90 rows total; **24 already answered and kept for the trail**, 2 header rows. |
| `docs/RULINGS.md` → main table, `OPEN` state | 🟡 **35** | Rulings David has MADE that are **not yet built**. Not questions — work. |
| `docs/RULINGS.md` → main table, `PARTIAL` | 🟡 **16** | Ruled and half-built. |
| CLAUDE.md §3 — *FLAGGED FOR DAVID* | 🔴 **11** | The three newest sessions' questions (#299 · #300 · #301). Scrolls out at N=3 — **this is the only place they survive it.** 🔴 **AND 2026-09-14 NAMES THE HOLE UNDER IT: an entry that is never WRITTEN never feeds this file either. Fifteen rows, #302 among them. Asserted now — `verify:handoff-retention` check 5, ledger #320.** |
| CLAUDE.md — *Open Architecture Decisions* | 🟡 **4** | Rows 3, 5, 6, 9. Long-dormant. |
| CLAUDE.md §4 — *PENDING DATA TASK* | 🔴 **2** | Work only David can do (LAWNS is read-only to Thunder). |
| `docs/tech-debt-log.md` + CLAUDE.md tech-debt line | 🟡 **~36 mentions** | Items whose fix is explicitly *"David's call"*. |
| `docs/DECISIONS-INDEX.md` | 🟡 **26** | Rows marked OPEN. |

🔴 **The honest headline: 65 questions are sitting in the OWED queue, and the newest three sessions
added 11 more that nothing but §3 was holding.**

---

## 🔴 THE SHORT LIST — what is BLOCKING work right now

These are the ones where a build is stopped, not merely slower. Each is quoted from its owner.

**1 · `20260905_production_planning` — APPLY OR RETIRE?**
*"It creates `business_operations_config`, `production_plans`, `production_plan_lines`, and **shipped
code already reads and writes all three** (Settings → Operations, the Uppot plan page,
`productionHold.ts`)."* Until you answer, **Settings → Operations cannot save and the Uppot plan page
cannot commit, on every tenant.** → `RULINGS.md` OWED · tech-debt **#253**

**2 · WHO MAY SEE THE EQUIPMENT LIST WITHOUT SEEING WHAT IT COST?**
*"Equipment lives in `cost_objects` (confidential, gated on `costs:read`); maintaining it is `pmi:*`.
So someone who holds `pmi:*` and not `costs:read` gets a locked screen with nothing to maintain."*
**Joel is in exactly that state today** — `/pmi` shows him nothing. → `RULINGS.md` OWED · tech-debt **#262**

**3 · HOW DOES FOLLOW-UP GET TURNED ON?** Catalog 30-day clock, by hand in SQL, or core.
`followup_engine` is a `planned` tile and `/subscription` offers **no Turn on**, so the review ask
**cannot fire on any tenant** whatever link you enter. → CLAUDE.md §3 #300 · tech-debt **#270**

**4 · LAWNS'S THREE SERVICE ROWS — you write them, Thunder cannot.**
Trip charge (533 lines, $40,760) · Tailgate Delivery (127 lines, $18,990) · self-collect (no line).
All four rows read `category='addon'` today. 🔴 **Blocked on tech-debt #251** — checkout offers one
staff/flat row, so trip charge and tailgate would hide one of the two. → CLAUDE.md §4

**5 · THE 8-HOUR RULE — WHAT EXACTLY WAS RULED?**
*"The backlog lists 'Crew capacity / the 8-hour rule — ruled, not built' and gives no wording. A
ruling cannot be numbered without its words."* → `RULINGS.md` OWED

**6 · THE YARD-WORKER PERMISSION SET — confirm or amend.** Proposed `inventory:read`,
`deliveries:read`, `deliveries:update`, `pmi:read`, `pmi:update`; excluded `inventory:reconcile`,
every `costs:*`, `pricing_recipe:*`, `settings:*`. ⚠️ As proposed it collides with question 2.
→ `RULINGS.md` OWED

**7 · THE COARSE SPLIT — A or B?** `businesses_owner_update` guards the profile fields **and**
`owner_id` / `qbo_writes_enabled` on one policy, and RLS has no column-level restriction.
→ `RULINGS.md` OWED

---

## THE THREE NEWEST SESSIONS' QUESTIONS (§3 holds these for three sessions only)

> ⚠️ **#299's block is now one session PAST the §3 window** — it was archived verbatim by close-out #303, so these lines are the only thing still pointing at it. That is exactly what this register is for.

**#321 — the production stamp**
- 🟢 **OWNER-PROVEN 2026-09-14 — David's live run: *"the foot of the screen reads · prod"*.** `production-stamp` board CARD 1 `covered`, 1 of 5. 🔴 **The board had to be CREATED to receive the flip — an OP-14 gap in #321, which changed a surface on every screen and made no card for it.** ⚠️ **CARDS 2–4 still `owed`** (the preview chip, the promoted-branch chip, the broken-screen case). Owner: `docs/owner-tests/production-stamp-full-surface-test.md`.
- 🔴 **OPEN — PRODUCTION IS STAMPED POSITIVELY, AND THAT IS A DELIBERATE DEVIATION FROM THE INDUSTRY STANDARD (§6 r16).** The standard env badge shows **nothing** in production. I show `prod`, because a blank production is indistinguishable from a bundle built before the feature existed (A9 *absent is not empty*). **Cost: one more token on every screen, for every user, forever.** Owner: `src/lib/deployStamp.ts`.
- 🔴 **OPEN — `prod⚠ <branch>` IS A JUDGEMENT MADE WITHOUT ASKING.** A production deploy built from a non-`main` branch shouts. Legal (someone promoted a branch), and I decided it is worth seeing. **Say so if you would rather it stayed quiet.** Owner: `src/lib/deployStamp.ts`.
- 🟡 **OPEN — tech-debt #280 IS 🟡 PARTIAL, NOT RESOLVED.** ② is now **OBSERVABLE by a human**; **no cap asserts it** and the close-out gates still accept *"pushed"*. ① (`merge-base --is-ancestor`) is satisfied for #320 **by the merge, not by a gate** — **asserting it is cheap and still owed.** Owner: `docs/tech-debt-log.md` → **#280**.

**#294a / #280 ① — the two the last pass left sharpened**
- 🔬 **PROPOSED, NOT BUILT (your scope) — a check refusing a ledger row whose cell count EXCEEDS the header.** A shell pipe inside backticks splits a row and GFM discards the overflow silently; **#320 raised this defect's rate by making the row the home for close-out narrative.** Live: #279 · #299 · #311 · #317. Full proposal (counting rule, one-direction argument, 8 probes, red-first expectation, cost) in `docs/tech-debt-log.md` → **#294a**. **Your call whether it gets built.**
- 🔴 **OPEN — #280 ① IS STILL OWED AND IS THREE LINES: `git fetch` then `git merge-base --is-ancestor <sha> origin/main`.** ⚠️ **`origin/main`, never local `main`** — local `main` is exactly what was wrong when this session reported #320 merged while `origin/main` had not moved. **No gate we own caught it**, including the one built the same session. Owner: `docs/tech-debt-log.md` → **#280**.

**#320 — the §3 entry gate, and the §3 entry trim**
- 🔴 **OPEN — DECLARE OR BACKFILL? I DECLARED, AND THIS IS THE CALL TO OVERRULE.** Fifteen close-out rows have no §3 entry (**#253 · #255 · #256 · #264 · #270 · #271 · #291 · #302 · #304 · #308 · #310 · #311 · #313 · #316 · #317**). Backfilling means composing a handoff narrative for sessions nobody was in and dating it as though written then — **manufacturing a record rather than recovering one** ([[R-26]]). Every row is COMPLETE in the ledger, so nothing is lost by declaring. ⚠️ **What IS lost is those fifteen sessions' `FLAGGED FOR DAVID` items — and that loss already happened.** Owner: `handoff-entry-declarations.json`.
- 🔴 **OPEN — ONE THING WAS KEPT IN §3 DELIBERATELY:** the trailing narrative sentence inside each `###` heading line. The heading is ONE authored paragraph (headline + punchline); splitting it means editing prose rather than moving whole units. **Cost, measured: 2,385 of the 8,755 chars §3 still holds.** Say the word and it moves to the ledger row too. Owner: CLAUDE.md §3 preamble.
- 🔴 **OPEN AND UNCHANGED SINCE 2026-07-16 — OP-13's OWN PROPOSED AMENDMENT: the budget measures the WRONG QUANTITY.** This edit is its second piece of evidence: **−14KB against −27 lines.** CLAUDE.md is **651 lines**, still over its ~600 line budget, while the real saving was in bytes. **Switch the budget to `wc -c`?** Owner: CLAUDE.md §4 → *Docs — Doc Reorg*.
- 🟡 **OPEN — `docs/CLOSE-OUT-LEDGER.md` row #318 is MALFORMED**: 6 columns where the header declares 7 (Work item and Deliverable merged). Renders fine, lies about nothing, read by nothing mechanical. Repairing another row's shape inside this pass was declined as drift. Owner: `docs/CLOSE-OUT-LEDGER.md`.
- ✅ **ANSWERED BY INSTRUCTION — N=3 STAYS.** The register survives the rotation, so raising N buys nothing and costs the budget. Not changed.

**#314 — the sweep's blind spot, closed; and a gap in clause (4)**
- ✅ **ANSWERED BY BUILD — tech-debt #286 is RESOLVED.** Two populations: NEXT FREE from every ref, collisions by per-id inheritance at `merge-base(HEAD, ref)`. **Proven by making it fail from `main`** — old script exit 0, new exit 1, same tree, same id. 9/9 mutants.
- 🔴 **OPEN — a ONE-LINE MERGE DECISION.** The bootstrap's cached *"next free is #310 / tech-debt #286 / R-150"* numbers are **DELETED** on `fix/id-sweep-next-free-population` (the command is the answer) and **CORRECTED-WITH-A-CAVEAT** on `main`. Both defensible; the cached-next-free item's own text argues for deletion while its fix kept the numbers. Owner: `TRACE-SESSION-BOOTSTRAP.md` line 85.
- 🔴 **OPEN — R-148 clause (4) HAS NO PROVISION FOR THE LATER CLAIM HAVING ALREADY MERGED.** Live today on tech-debt `#286`: the EARLIER claim by 30 minutes was the UNMERGED one, so "the later claim renumbers" pointed at a row already on `main`. It resolved itself before it needed answering — **the gap in the clause did not.** The cap names the fact and deliberately does not rule on it. Owner: `docs/RULINGS.md` → **R-148**.
- ✅ **ANSWERED BY MEASUREMENT, NOTHING OWED — #310.** `feat/channel-vocabulary` claimed it at **15:25:51**, the zone-walk session at **15:35:58** (10m07s later); **that session renumbered itself to `#311` at 15:39:01** and orphaned its three `#310` commits. **#310 is channel-vocabulary's. Nothing moved, nothing to move.** Same for `R-150` (channel-vocabulary moved to R-152/R-153) and tech-debt `#286` (ledger #308 moved to `#289`).

**#312 — the card flips, the leak-clause split, and the sweep's blind spot**
- 🔴 **OPEN — tech-debt #286, and it reopens a question you thought you closed yesterday.** `verify-id-sweep` reported **`NEXT FREE: #310`** while `origin` held `reserve(#310)` AND `reserve(#311)` + a filed `#311` row: `sameLineage()` excludes every branch cut from current `main`, so **run from `main` the gate hands a careful session a taken id.** The fix is small (split the populations; name the ref holding the highest id) and was **deliberately not taken inside a card-flip pass.** **Until it lands, a sweep run from `main` is not evidence.** Owner: `docs/tech-debt-log.md` → **#286**.
- 🔴 **OPEN — `#310` is a live DOUBLE claim.** `feat/channel-vocabulary` reserved it and so did an unreachable local commit; R-148 clause (4) says the later renumbers, and **neither is Thunder's to move.** Owner: `docs/CLOSE-OUT-LEDGER.md`.
- ⚠️ **NOT A QUESTION, A RECORD: `deliveries.address_line2` is no longer forbidden by any board.** The ship-to CARD 3 clause was split on your instruction; the dropped half is a note and **tech-debt #279 is its only owner.** When you decide ① (`deliveries` gains the column) or ② (the importer folds Line2 into Line1), **#279 is the row that closes and no card needs changing** — which is the point of moving it out of one. Owner: `docs/tech-debt-log.md` → **#279**.
- ⚠️ **AWAITING YOUR RUN, not your answer:** campaign **CARD 3** (runnable now — its SQL needed no repair, both defects were fixed in `efc02f8` itself) · ship-to **CARD 4 on the delivery SCHEDULE**, not `/orders/:id` · breakpoint **CARD 2**, the only card that asks you to decide rather than observe.
- ✅ **ANSWERED BY MEASUREMENT, NOTHING OWED:** *did the 2026-09-09 card reconciliation run?* **Yes — `ac6d0ce`, merged to `main`, 32 → 51 covered over 598 cards on 31 boards, and it refused three flips with stated reasons.** Nothing to re-send.

**#309 — the id-claim rule, minted and guarded**
- ✅ **ANSWERED — you minted it.** `R-148` + `R-149` are rulings; both mechanisms are built and in `npm run verify`.
- 🔴 **OPEN, and it is the one the rule does not cover:** R-148 clauses **(1)**, **(3)**, **(5)** are **convention — no cap reads a prompt or an author's intent.** Is that acceptable, or does clause (1) (*Lightning never writes an id into a prompt*) need a mechanism of its own?
- 🔴 **OPEN — `#304` is dangling on `main` right now.** `eb4aad6 fix(#304)` merged; main carries no `#304` row. It resolves when `recon/campaigns-2026-09-12` merges — **or it needs a `withdrawn` row under R-148 clause (3), NEVER LEAVE A GAP.** Your call which.
- ⚠️ **RESERVED, NOT ANSWERED: how `RULINGS.md` is FOUND rather than searched.** §10 step 10 now says grep-and-declare-your-terms, which matches practice — but **the rule sat findable-only-by-the-already-informed for ten days**, and that is a retrieval problem no wording fixes.

**#307 — §6 r7, CARD 1, and the id-claim rule**
- ✅ **ANSWERED — §6 r7.** Neither option offered: *"the tile grid was designed phone-first and carried over to desktop; the 768px claim dates from the phone design and was never revisited when it moved."* Rewritten to describe; behaviour untouched. **The desktop grid layout is still yours, explicitly reserved in the rule's text.**
- ✅ **ANSWERED — CARD 1 covered**, 2026-09-12, build `13d64aa`. **CARD 2 is next and it is a decision, not an observation.**
- 🔴 **OPEN — tech-debt #284, and it is yours twice over.** ① **Mint the id-claim rule or don't** — it has sat at `RULINGS.md:272` unnumbered since 2026-09-02, **telling its own reader it is only a proposal**, while six collisions happened in 24 hours. ② **Choose between (or take both of) the two PROPOSED mechanisms** — the all-branches reservation sweep as a close-out gate, and a ledger-id duplicate clause in `verify-id-citations.mjs`. **Neither is built. (A) prevents; (B) only catches what already landed in one tree — it would have caught NONE of the six.**
- ⚠️ **§10 step 10 still says `RULINGS.md` is read IN FULL every session.** It is 342 lines / **425KB** and is now grepped. That sentence and the practice disagree, and the id rule is what fell through the gap.

**#305 — the breakpoint vocabulary (one device detector, four axes)**
- ✅ **ANSWERED 2026-09-12 — tech-debt #283 (filed as #281, renumbered).** §6 r7 was a BINDING RULE wrong in both of its claims. It reads *"Tile grid: desktop/tablet only (768px+)"*; the grid breaks at **640 and 1024** and renders **4 columns on a phone**. **Which did you mean — stale prose, or an intent the code never implemented?** It is not cosmetic: **the next mobile pass reads that rule to learn what the dashboard does on a phone**, and today it answers wrongly and confidently. Thunder did not edit it — rewriting one of nineteen binding rules in your doc inside a hook refactor is the drift the gates exist to catch.
- 🔴 **THE BEHAVIOURAL MOBILE STORY IS OWED BY YOU.** Lauren reviews the schedule on desktop because the phone calendar truncates, re-runs the day on her phone because the send-to button lives there, then hands the crew printed orders. **That narrative is yours to dictate**; Thunder wrote only the as-built vocabulary line (the IN-CODE-NOT-ON-THE-BOARD case).
- ⚠️ **Board CARD 2 is a judgement call, not a pass/fail** — the Operations calendar now shows arrows at tablet width (below **1024px**) instead of the dropdown (below 767px). The old number cited the tile grid for a breakpoint the tile grid has never had. **If you prefer the old feel, say so — it is a one-word revert.**
- **Does the container axis stay a seam?** `useContainer()` can return `native`/`installed` and **neither can occur** — no wrap, and **no web-app manifest**, so the app cannot be installed. Adding a manifest is a decision nobody has made.

**#303 — the ship-to address book (`customer_addresses`)**
- 🔴 **A STORY IS OWED BY YOU, and Thunder did not write one.** `user_stories.md:1630` carries `customer_addresses` as `STATUS: scoped-out`; **this build inverts that row**, which is a status flip you make. `:524` and `:608` name the owed `conditional-address-on-delivery` sub-story.
- 🔴 **Apply `20260911b_customer_addresses.sql`** — written, not applied. **Board CARD 2 is only runnable BEFORE you apply it**; everything else waits on it.
- **`line2` exists and no surface writes it** (tech-debt #279). When the Line2 importer fix (#254) lands: does `deliveries` gain an `address_line2`, or does the importer fold Line2 into Line1 on the way in? Neither was this build's call.
- ⚠️ **You overrode a written trigger and it is recorded, not hidden** — the 2026-09-09 recon said *build the book when the count passes ~25*; it is 17 raw / 5 clean. Nothing needs answering here; it is logged so nobody later reads the trigger and calls it drift.

**#299 — install date + inventory location (recon)**
- Retire `orders.install_date` once you confirm the warranty clock reads the planting stop's `completed_at`? It is **0 of 76, with no writer in any commit.**
- **R-143 is filed on the prompt's words** — strike it to OWED if that was a paraphrase rather than your ruling.
- Infer `planting` on QuickBooks stops, or let Lauren mark it? **7 of 19 ingested LAWNS stops are installs typed as delivery**, so they would never start a warranty (tech-debt #268).
- Zones need a story before any build — the walk tool exports for `business_inventory.zone` and *"the irrigation zone records"*, and **neither exists** (tech-debt #266).

**#300 — the Google review ask**
- How Follow-Up gets turned on (question 3 above).
- **Does a SKIP start the 180-day window?** Today it does.
- The one-day grace for a late done-tap is **Thunder's number, not yours** — confirm or set it.

**#301 — one stop, three screens**
- Run the stop board's **CARD 1** first; it is read-only SQL.
- Route board **CARDS 1, 2 and 7** are back to `owed` — the stop list feeding the Maps link was rebuilt.
- The select strings were **not probed against live PostgREST** (the anon key on disk is rejected); stop **CARD 2** is that proof.
- Retire or convert the legacy `/deliveries` order list? **27 Test Dave's orders have no stop** (tech-debt #277).

---

## LONG-DORMANT (CLAUDE.md → Open Architecture Decisions)

| # | Question | Deferred since |
|---|---|---|
| 3 | KINNA-OS production app domain — `kinna-os.app`, `.com`, or a `builtwithcai.com` subdomain | 2026-05-26 |
| 5 | PLATFORM_STRATEGY.md metadata claims to be authoritative — soften or remove | 2026-05-26 |
| 6 | PANTRY_OS.md rename, *if* the file is ever re-created | 2026-05-26 |
| 9 | Family-member role descriptions — each person reviews their own paragraph | 2026-05-27 |

---

## HOW THIS FILE STAYS TRUE

1. **Answer a question in its OWNING file first** — `RULINGS.md`, CLAUDE.md §3, the tech-debt log —
   then update its line here. Never the reverse.
2. **A close-out that adds a FLAGGED FOR DAVID item adds a line here too**, because §3 drops it after
   three sessions and **this file is what survives N=3**.
3. **Counts are re-measured, never carried forward.** The commands are recorded so the next session
   re-derives rather than trusts:
   ```bash
   sed -n '248,$p' docs/RULINGS.md | grep '^| ' | grep -vc '^| ✅\|^|---\|^| Question\|^| # '   # OWED still open
   grep -c '| \*\*OPEN\*\*' docs/RULINGS.md                                                      # ruled, not built
   grep -c 'OPEN' docs/DECISIONS-INDEX.md
   ```
4. ⚠️ **A question that has been answered is marked ANSWERED and KEPT**, the way `RULINGS.md` keeps
   its 24 — deleting it erases the trail of what was decided and when.
