# OPEN QUESTIONS — everything waiting on David, in one place

**Last updated: 2026-09-17** (ledger #347 — the crew day link; built, not merged, migration not applied. Prior: ledger #345 — the writer registry; contacts registered; not merged. Prior: ledger #342 — during testing nothing writes the record; practice orders go with their import; migrations written, none applied. All blocks below, newest first.) · **also** ledger #335 second pass — CARD 4 then merge; the three migrations go on first; a new question on retiring seeded addresses; the contact writer has no caller. Prior: ledger #341 — the preview read now asks QuickBooks for inactive records and five transaction types; step ② is a press on the merged build. All blocks below, newest first.)
**Last updated: 2026-09-17** (ledger #343 — the container ladder is the one source for sizes; apply its migration BEFORE merging. Previous: ledger #341 — the preview read now asks QuickBooks for inactive records and five transaction types; step ② is a press on the merged build. All blocks below, newest first.)
**Last updated: 2026-09-17** (ledger #350 — the load list prints an allow-list, NOT merged. Before that: ledger #343 — the container ladder is the one source for sizes; apply its migration BEFORE merging. Previous: ledger #341 — the preview read now asks QuickBooks for inactive records and five transaction types; step ② is a press on the merged build. All blocks below, newest first.)
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

**1 · `20260905_production_planning` — ✅ ANSWERED 2026-09-15. NOT A QUESTION ANY MORE, AND IT WAS
NEVER THE BLOCKER IT CLAIMED TO BE.**
🔴 **THE CLAIM IS STRUCK: David ran it live on `c99a4c5` — he changed values in Settings → Operations
and they PERSISTED ACROSS A RELOAD.** A value that survives a reload was written to and read back from
`business_operations_config` under real RLS. **The table exists and the save path works.** 🔴 **And the refutation was ALREADY ON `main`:** `docs/recon/2026-09-12-one-fact-many-homes.md`
(committed 2026-09-12) carries the catalog read for all three tables — `rls=true`, 4 policies each —
and says *"All three exist … it is describing yesterday."* **This file and that one have contradicted
each other on `main` for three days.**
⚠️ **STILL GENUINELY UNPROVEN, and it is a CARD not a blocker: nobody has driven an Uppot plan COMMIT
end to end.** Unproven is not broken — and the difference is the whole point of this correction.
🔴 **This was the #1 item on this list for four days and it was false**, gating tech-debt **#299**,
which is now unblocked. → tech-debt **#253** ✅ RESOLVED

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

**#351 — the route order is saved (build, NOT MERGED, `20260917e` NOT APPLIED)**
- ✅ **ANSWERED 2026-09-18 — APPLIED, RATIFIED, and the wording ruled:** Lauren's screen *"Not routed yet — press Route this day."*; crew and sheet keep the text-order sentence. Owner: ledger #351.
- 🔴 **OPEN — CARDS G AND H** (H on LAWNS, Saturday only). Owner: `crew-day-link-full-surface-test.md`.
- ✅ **ANSWERED — ROUTE ORDER IS A GO-LIVE FEATURE, NOT A 🟡** (David, 2026-09-17). tech-debt #320 resolved by [[R-163]].

**#347 — the crew day link, Saturday 2026-09-19 LAWNS pilot (build, NOT MERGED, migration NOT APPLIED)**
- 🔴 **OPEN — APPLY `20260917c` AND RUN THE CARDS.** The ladder gate is satisfied and `origin/main` is merged in; apply the migration (one paste), run the V-block, then CARD 0 and CARDS A–F. Owner: ledger #347.
- 🟡 **OPEN — STOP ORDER.** The page lists stops in schedule order; no route order is saved. Lean: save the sequence when Lauren routes a day. Owner: tech-debt #320.
- ✅ **ANSWERED 2026-09-17 — [[R-161]]: ONE COMPLETION WRITER, TWO DOORS.** Both hold the review ask, both undo. Built the same day; tech-debt #321 closed.
- ✅ **ANSWERED 2026-09-17 — YES to tap-to-call**, number still readable as text. Built.
- ✅ **ANSWERED 2026-09-17 — ENGLISH ACCEPTED FOR THE PILOT**, wording cut to a few words. 🟡 **Spanish is now the next step against R-151** — owner: tech-debt #325 (the string layer first, then a two-word switch on the page; where a language lives for a person with no login is David's call).
- 🟡 **OPEN — CLAUDE.md IS OVER ITS BUDGET AND THREE INVENTORY DOCS ARE STALE.** 678 lines vs ~600; `inventory-functions/env/ai` read 2026-06-13. David: after Saturday. Owner: tech-debt #324.
**#346 — no phone note is lost when the old street column is dropped (migrations written, NOT APPLIED)**
- ✅ **ANSWERED 2026-09-17 — APPLIED** (`20260917a` then `20260915b`; CARD 6 covered). ✅ **MERGED** (`0ff9499`). 🔴 **OPEN — GO-LIVE RELOAD before 12:00 Friday** (checklist in `docs/go-live/`). Owner: ledger #346.
- 🟡 **OPEN — `5fa0c32e`'s main phone value holds the number and words** — a cleanup for Lauren (the words are now also a note). Owner: ledger #346.

**#345 — the writer registry; a typed phone is never dropped (build, NOT MERGED)**
- ✅ **ANSWERED 2026-09-17 — MERGED** (`9d9214b`, production the same minute). Owner: ledger #345.
- 🔴 **OPEN — A CAPTURE FOR A CUSTOMER WITH NO PERSON LINK MAKES A DUPLICATE.** Lean: match on phone or street + ZIP, then ask; never email alone. Owner: tech-debt #314.
- 🟡 **OPEN — THE ROUTE PLANNER'S ADDRESS BOX IS NEVER SAVED.** Lean: save as a ship-to through contactWriter; at minimum label it "not saved". Owner: tech-debt #316.
- 🟡 **OPEN — STAFF AT CHECKOUT.** Lean: staff may ADD a phone/email; only `customers:update` may Make main or Remove. Owner: tech-debt #317.
- 🟡 **OPEN — THE QUICKBOOKS IMPORT KEEPS AN EXISTING CUSTOMER'S CONTACT DETAILS AS THEY ARE.** Lean: keep the MAIN value; ADD a different QuickBooks value as additional through contactWriter. Confirm → RULINGS + registered path. Owner: tech-debt #318.
- 🔴 **GO-LIVE — FINISHING A STOP DOES NOT FULFIL ITS ORDER** (automatic SPM consumption depends on it). Owner: tech-debt #319.
- 🟡 **OPEN — WHICH DOMAIN IS REGISTERED NEXT.** Proposed: orders → delivery stops → stock movements. Owner: `writer-registry.json` → `proposed`.

**#350 — the load list prints an allow-list (build, NOT MERGED)**
- ✅ **ANSWERED 2026-09-17 — MERGED for tonight's LAWNS demo.**
- ✅ **ANSWERED 2026-09-17 — YES, ANYTHING PHYSICAL PRINTS.** *"…in its own section, Also on the truck, with quantity and name, not counted as trees and not in the mix or post totals."* Money lines never print.
- ✅ **ANSWERED 2026-09-17 — KEEP IT PRINTING.** David: *"that section is for lines we cannot read, not for fees. Your call was right."*
- 🟡 **OPEN — WHEN THE PER-ITEM LABEL EXISTS**, the name list is deleted and the label read (*"we will have these labeled in the future in our system"*). Owner: `NON_LOAD_LINES`.
- ⚠️ **NOT A QUESTION — THE 81 ROWS ON `/settings/services` ARE NOT THERE.** LAWNS has four `service_offerings` rows, without Trunk Protection or Deer Fencing; the match list is measured from the order lines instead.
- 🟡 **OPEN — HOW SHOULD A BILLED MATERIAL BE COMPARED WITH THE COMPUTED ONE?** The billed `Tree Bubbler` is the one physical thing kept off the sheet (bubblers are computed per tree), and nothing compares the two. Filed on your instruction. Owner: tech-debt **#326**.

**#343 — the container ladder is the one source for sizes (build + migration WRITTEN, not applied)**
- ✅ **ANSWERED 2026-09-17 — APPLIED (V1–V4 pass) AND MERGED (`56107ee`).** WAS: 🔴 **OPEN — APPLY `supabase/migrations/20260916_container_ladder_install_t_posts.sql` (✏️ 2026-09-17: it now also adds `is_large` and the read-only `get_planting_materials`; a byte-identical copy is in David's checkout), RUN V1–V4, THEN MERGE — NEVER THE OTHER WAY ROUND. Target: live by Friday 2026-09-18.** The ladder read asks for the new column; merged first, every ladder read fails. SQL editor, `postgres`, then V1–V4. Owner: the migration file.
- 🔴 **OPEN — CONFIRM THE SWITCH TO `is_large`.** ✏️ 2026-09-17: prepared, LAWNS 30 gal and above; nothing reads it yet. WAS: **WHICH SIZES ARE "LARGE" FOR THE LEAKAGE FLAG?** `submit.ts` `LARGE_CONTAINERS` is the last hardcoded size list; it misses 65 and 200 gal and names a 60 nobody sells. Options: sizes that take install T-posts · a flag on each size · (a volume threshold is ruled out). Owner: tech-debt #310.
- ✅ **ANSWERED 2026-09-17 — YES, READ-ONLY** (built: `get_planting_materials`; live once applied and merged). WAS: 🟡 **OPEN — MAY STAFF READ THE FOUR PLANTING FIGURES?** They sit behind `settings:read`; a staff login's load list prints the standard figures and says so. Nothing wrong today — no business has saved one. Owner: tech-debt #309.
- 🟡 **OPEN — THE SIZES OFF THE LADDER AT LAWNS (1, 2, 7, 10, 300 gal): A SIZE EACH, OR ROWS TO CORRECT?** The load list and import preview now name them; Settings → Container sizes can add one without SQL. Owner: the #326 block below.
- 🟡 **OPEN — WHICH STOPS NEED DEER FENCE?** Nothing stored says. ✏️ 2026-09-17 (David): the rule prints ONCE at the top; no stop is listed as unresolved. The in-total arithmetic is built for the day a stop can say so. Owner: `loadList.ts` `LoadStopInput.deerFence`.
- ⚠️ **FLAGGED — R-155's 2026-09-14 QUOTE IS UNVERIFIED.** It is recorded as yours; you have since called the 1.0 Lightning's. Confirm or disown. Owner: `docs/RULINGS.md` R-155.
- ✏️ **DISCLOSED — MY 2026-09-16 RECON CALLED `20260914_container_ladder.sql` NOT APPLIED FROM FOUR FILES, WITHOUT READING THE DATABASE.** It was applied. All four lines are corrected.
- ✅ **ANSWERED BY THIS BUILD (pending merge) — "NO SCREEN EDITS THE LADDER"** (the #326 block below): Settings → Container sizes.

**#342 — during testing nothing writes the record; practice orders go with their import (build + migrations written, none applied)**
- ✅ **ANSWERED 2026-09-16 — THE DISCOVERY FILE WAS RUN** (read-only, by Thunder). 7c found zero seed rows, so `20260916_rehearsal_cleanup_lawns.sql` is **not applied** and removed; the targeted `20260916e` replaces it. Owner: ledger #342 row.
- 🔴 **OPEN — ORDER `6a60a0ca` IS HELD.** What removes it, and its four ledger rows, waits on discovery 2a–2c and 7. Owner: ledger #342 Blocker.
- 🟡 **OPEN — RULING ③: SNAPSHOT-AND-REATTACH OR KEEP-AND-REUSE?** The draft is `20260916b` (raises on apply). Owner: that file's header.
- 🟡 **OPEN — WHO WRITES THE OPENING LINE AT SWITCH-ON?** Nothing does. Owner: tech-debt **#308**.
- 🟡 **OPEN — RATIFY FIVE DECLARED WRITE PATHS** (the one-unit undo on orders, order_items, deliveries, compliance records, service selections; the test-mode seed on business_inventory). Owner: `scripts/verify-write-paths.mjs`.
- 🟡 **OPEN — SHOULD AN OPEN TEST ORDER STILL LOWER *AVAILABLE*?** `fetchCommittedByLot` does not filter `order_kind`. Owner: `packages/cultivar-os/src/lib/inventoryStates.ts`.
- 🟡 **OPEN — SIX NON-ORDER LEDGER WRITERS STILL WRITE IN TEST MODE** (desk edit/delete, count walk, reconcile, CSV import, discovery re-scan, d52 script). Reported, unchanged. Owner: ledger #342 §1g.
- 🟡 **OPEN — PGlite AS A DEV DEPENDENCY**, so SQL functions run inside `verify`? Owner: `scripts/sql-harness/rehearsal-342.pglite.mjs` header.
- ✏️ **CORRECTION TO CARRY — #337's GATE 2 WAS NEVER MERGED; `main` SAID IT WAS.** Owner: tech-debt **#304**.
- ✏️ **DISCLOSED — YOUR UNCOMMITTED REVERSAL MIGRATION WAS NOT READ**; the cleanup matches it structurally.

**#335 — the contact record: the customer as one identity with lists of phones, emails and addresses (build · HELD for CARD 4)**
- 🔴 **OPEN — CARD 4, THEN THE MERGE.** The branch is held until CARD 4 shows the database trigger fills the customer's phone from the list. **The three migrations are applied BEFORE the merge, in this order:** ① `20260915_backfill_legacy_customer_address.sql` → ② `20260915_contact_record.sql` → ③ `20260915b_drop_legacy_customer_address.sql`. None is applied (measured live 2026-09-16). ② reads only `billing_*`, so a value still in the old columns when ② runs never reaches the list and ③ destroys it — hence ① first. → CLAUDE.md §3 #335
- 🔴 **OPEN — YOUR CALL BEFORE THE MERGE: MAY THE IMPORT RETIRE A SEEDED ADDRESS?** **464 LAWNS customers have their phone number as their billing street** (measured live — not 5). ② copies that into a default "Billing" row. When QuickBooks now resolves a real street, the import marks that seeded row inactive (never deletes it) and makes the real street the default. Rows you or Lauren typed, and rows an earlier import wrote, are never touched. The alternative keeps the phone as the default street for all 464. → tech-debt **#306**
- 🔴 **OPEN — WHO WIRES THE IMPORT TO THE CONTACT WRITER?** Nothing calls it today, so CARDS 7, 8, 9, 12 and the LAWNS import cannot be run through any screen. #306's fix is proven by tests only. → ledger #335
- ✅ **ANSWERED BY MEASUREMENT, NOT BY CHOICE — HOW THE IMPORT SKIPS A NUMBER IT ALREADY HAS (#306).** The instruction was `onConflict` naming the real unique key. Measured on a real Postgres engine: that is refused on every call (42P10), because every unique key here is partial; the old write raised 23505 on a re-import. The writer now reads first and inserts only what is new; the indexes stay as the backstop. → tech-debt **#306**
- 🟡 **OPEN — tech-debt #305:** the legacy-address guard is blind to a DISAGREEING pair (one Test Dave's row, ruled harmless). → tech-debt **#305**

**#341 — the preview read asks QuickBooks for inactive records and five transaction types (build + projection)**
- 🔴 **OPEN — PRESS PREVIEW YOUR BOOKS ON THE MERGED BUILD.** That press is step ②. Nothing local could run it: the root `.env.local` holds empty strings, a deny rule refused `packages/cultivar-os/.env.local`, and LAWNS's expired token meant any pull would write a rotated one. Then books-read CARDS 19 and 20. Owner: `docs/owner-tests/quickbooks-books-read-full-surface-test.md`.
- 🟡 **OPEN — WHAT DOES A REFUND OR CREDIT MEMO DO TO A FINDING?** They are now read and sized. Nothing nets them against the sale they reverse, so the $8,183.70 cancelled order still counts as revenue. A ruling, not a read change. Owner: `docs/recon/2026-09-16-qb-completeness.md` §1 ②.
- 🟡 **OPEN — ARE *Tree Replacement* (`196`) AND *Tree Warranty Replacement* (`207`) ONE SERVICE?** Both are active and $0. The rename took them out of the collision rule's reach. Lauren's call. Owner: `docs/recon/2026-09-16-inactive-items-diff.md` §4.
- ✏️ **CORRECTION TO CARRY — THE REPORT SHE ACTED ON WAS NOT BUILT FROM 09-10.** That file already had zero collisions; 09-04 is the before-picture. Owner: `docs/recon/2026-09-16-inactive-items-diff.md` §1.
- ✏️ **DISCLOSED — ONE `awk` READ VALUE LENGTHS (NOT VALUES) FROM THE DENIED ENV FILE** before the deny rule fired.

**#339 — the register-block cap: §3b's clause is now a check (tooling)**
- 🔴 **OPEN — TRANSCRIBE `#306` AND `#318`, OR LEAVE THEM?** Both were filed after this register existed and **no block was ever written for either**. Their FLAGGED FOR DAVID items survive only in their archived §3 entries, which are not loaded at session open. They are declared so the cap can ship, and **the cap prints them on every run**.
- 🟡 **OPEN — BUILD A STRUCTURAL CHECK FOR A TRUNCATED §3 ENTRY?** `#336`'s entry lost its Type line and FLAGGED section to a body swap in my #326 merge, and **no cap we own could see it**. "Every entry carries exactly one `**Type:**` line" would have caught it; the archive's older entries need measuring first.
- 🟡 **OPEN — BACK-FILL THE 41 PRE-REGISTER ROWS?** Declared as history: the register was seeded from RULINGS OWED plus 11 §3 items, never per row.
- ✏️ **DISCLOSED — THE LOSS WAS FOUR DAYS AFTER THE REGISTER, NOT THREE** (`ece2d1a` 2026-09-11 → 2026-09-15).

**#338 — the archive duplicate check compares headings, not whole text (tooling)**
- 🔴 **OPEN — SHALL I BUILD THE GUARD FOR §3b's OWN CLAUSE?** *"A close-out that adds a `FLAGGED FOR DAVID` item adds a line to `docs/open-questions.md` too"* is **asserted by nothing**, and that is exactly how `#331` and `#333` lost their blocks silently tonight. Shape: every ledger row whose §3 entry carries `FLAGGED FOR DAVID` owes a register block, with a declaration file for exceptions. **NOT BUILT — it is a new cap, and `#325`'s hook header forbids growing the hook.** Same family as `#280` ②.
- 🟡 **OPEN — DECLARATION OR HARDCODED SKIP FOR THE 2026-06-09 IGNITION PAIR?** I declared it (a JSON file that **rots loudly** if the pair stops being duplicated). A hardcoded skip is one line and teaches nobody. Your call to overrule.
- 🟡 **OPEN — NOTHING CHECKS §3 ITSELF FOR A DUPLICATE HEADING**, only the archive. Narrow (§3 is capped at 3, and check 2 covers §3-vs-archive) but real and unasserted.
- ✏️ **NOT A QUESTION, A CORRECTION TO CARRY: MY 2026-09-15 MERGE REPORT WAS WRONG TWICE.** It said the checker missed **three** duplicates — it missed **two** (`#333`'s was byte-identical and `check 3` caught it) — and it named **trailing whitespace** as the cause, which `norm()` already collapses. The real cause is a **TRUNCATED** copy whose body is a strict prefix of the original's.
- ✏️ **DISCLOSED — ONLY ONE OF THE THREE "STALE POINTERS" WAS STALE.** `CLAUDE.md` line 3 and `built-inventory.md` already named `#333`.

**#336 / #332 — main goes green: the missing `#332` close-out row, filed not withdrawn (docs only)**
- ✅ **NOT A QUESTION — THE DECISION IS MADE AND RECORDED SO IT IS NOT RE-LITIGATED: `#332` IS FILED, NOT WITHDRAWN.** The work is real and is on `main` (`889b740` + `ecfb376`); a withdrawal under [[R-148]] clause (3) would have recorded that nothing happened in front of two commits where it did. **Overrule it and the row deletes cleanly** — nothing depends on it but the cap.
- 🔴 **OPEN — 29 OLDER SUBJECT CLAIMS HAVE NO LEDGER ROW AND I DELIBERATELY DID NOT FILE THEM.** `#79 · #81 · #82 · #121 · #141 · #142 · #143 · #148 · #149 · #150 · #152 · #153 · #155 · #170 · #171 · #232`–`#238 · #240`–`#244 · #285 · #288`. They are baselined, named on every run, and every one is this same defect predating the cap. **Your call: leave them baselined as visible debt, or have a session reconstruct them from the commits.** My recommendation is LEAVE THEM — 29 retroactive rows written by someone who did none of the work is a worse artefact than the gap.
- 🟡 **OPEN — NOTHING CATCHES A SESSION THAT CLOSES OUT WITHOUT FILING ITS ROW, AT THE MOMENT IT HAPPENS.** Clause D catches the id **on the next run, on someone else's branch** — which is how this one surfaced, and it cost a red `main` that blocked two builds. **The pre-commit hook (#325) runs `verify-handoff-retention` only, and #325's header explicitly forbids adding a second check to it** (0.21s is the design; a slow hook gets disabled). **A real gap, and the fix is a decision about where the check belongs, not code.**
- ✏️ **DISCLOSED, NOT A QUESTION — THE `#332` ROW IS MINE AND THE WORK IS NOT.** I did not run that session's verify, drive its surfaces, or re-measure its claims. The row records what its commits and its own corrected documents say, and states that in its own text.
- ✏️ **DISCLOSED — TWO STALE LINES IN *THIS FILE* WERE CORRECTED IN THE SAME PASS** (the `#303` block below): `20260911b` read *"written, not applied"* three days after it was applied, and the story citation read `:1630` where the row is at **`:1862`**. **#332's own rule obliges the correction in the pass that finds it; reporting it and moving on is what #332 was filed about.**

**#333 — the opening stock seed and the rule behind it (build)**
- 🔴 **OPEN, AND IT IS THE ONE THAT DECIDES A CONTRACT: SHOULD SEEDING BE UNDOABLE?** It is not today, and the reason is structural rather than an omission — a seeded lot has ledger history, and **a lot with ledger history cannot be deleted** (the FK is `ON DELETE SET NULL`, SET NULL is an UPDATE, and the append-only trigger refuses UPDATEs with no exemption; *observed live*, `20260720…:136-151`). So the catalogue undo **refuses on exactly the rows the seed touched**, and because it deletes `customers` FIRST it would stop half-way. Three options are written out and none taken: **(a)** *the seed ends the rehearsal* — a sentence, already on the panel; **(b)** the undo TOMBSTONES instead of deleting (`soft_delete_inventory` exists; it changes what *"undo"* means); **(c)** exempt the referential cascade from the trigger — **a migration, and it is tech-debt #79's open question**, which also blocks the OP-12 reference-environment teardown. ⚠️ **What is owed FIRST is a measurement, not a ruling: owner-test CARD 13** records which of two things actually happens — a visible refusal, or a reported success with the rows still there. Owner: tech-debt **#304**.
- 🟡 **OPEN — 50 IS A NUMBER WE CHOSE (§6 r10).** The cap is the mechanism, not a safety rail: with no ceiling somebody types 500, nothing ever runs out, nobody ever counts. **50 is high enough not to obstruct a demonstration and low enough that an ordinary week reaches it** — but it is a judgement, not a figure a standard gave us. Owner: `packages/shared/src/quickbooks/openingStock.ts` → `SEED_CAP`.
- 🟡 **OPEN — ONE RULE'S `population.noun` LABELS ITS VALUE RATHER THAN ITS POPULATION, AND IT IS THE ONLY ONE.** `noun: 'units a month for a typical item'` is your own word and in the STORED row it is exactly right — `value 4.2` sits directly beside it and cannot be misread. **But the books review screen renders `matched` of `of` `noun`**, which will read oddly for this rule alone. The fix is one field split in two; nothing this build ships renders it that way (the seed screen reads `sentence`). **Not decided silently.** Owner: `booksFindings.ts` → the `opening-stock-suggestion` rule.
- 🟡 **OPEN — SHOULD THE SEED BE OFFERED PER-CATEGORY RATHER THAN CATALOGUE-WIDE?** It seeds every empty, history-free product at ONE number today. A nursery's trees and its bags of fertiliser do not move at comparable rates, and the measurement already knows the spread (p25/p75). **Deliberately not built**: a per-category number is a second decision surface, and one number is what makes the first press possible. Owner: `OpeningStockSeed.tsx`.
- ✏️ **DISCLOSED, NOT A QUESTION — THE CAP IS ENFORCED IN THE SCREEN, NOT IN THE DATABASE.** There is no `api/` function for this (12 of 12 — §6 r11), so the seed drives the same RPCs the desk grid drives under the same RLS. **A caller invoking `adjust_inventory_manual` directly is bound by the permission the RPC checks, not by `SEED_CAP`.** Stated in `seedRefusal`'s own header rather than implied.
- ✏️ **DISCLOSED — TWO MUTANTS SURVIVED AS *EQUIVALENT*, AND THE REASON IS WORTH CARRYING.** *"A real count beats a placeholder"* is held by **two clauses that protect each other**, so breaking either alone changes nothing observable and each read as an untested guarantee. **Redundant defences make a real guarantee untestable one clause at a time** — a reader scoring per-clause coverage would call this uncovered. The mutant is now compound and catches it. Owner: `scripts/mutants-opening-stock.mjs`.

**#331 — the address import fix, part ① (per-record shape)**
- 🔴 **OPEN, AND IT IS THE ONE DECISION THIS BUILD REFUSED TO MAKE FOR YOU: 5 CUSTOMERS HAVE A REAL STREET WE DID NOT TAKE.** Their `BillAddr.Line2` holds the street, but `Line1` holds a **second, different** phone number from their `PrimaryPhone` — and `customers` has ONE phone column. **Either they keep a phone in the street column, or they get their street and lose a number.** A second phone column is a migration, which this pass was told not to make. Measured at **5** on the 2026-09-10 capture; surfaced as `phoneWouldBeLost` on every import preview and as owner-test **CARD 25**.
- 🟡 **OPEN — SHOULD THE CLASSIFIER BE WIDENED FOR THE 6 "PHONE WITH EXTRA TEXT" RECORDS?** `"(512) 555-0166 (cell 555-0167)"` and `"Contact <name> (817)555-0199"` classify as `other`, `other` is never a verdict, and their real streets in `Line2` are **left unrecovered on purpose**. Widening `classifyValueShape` also changes what the #322 preview panel reports, so it is one decision across two surfaces. Probe **N10 asserts the limit**, so it breaks loudly rather than drifting.
- ✏️ **NOT A QUESTION, A CORRECTION TO THE PROMPT'S OWN FIGURES:** it measured `Line1` street **971** · phone **485**, `Line2` street **462**→**465**; the shipped classifier says **962 · 484 · 462**. Nothing is missing — the difference lands in the `other`/`postcode`/`wordlike` cells a three-way summary has no column for, and every column sums to 1,959.
- ⚠️ **DISCLOSED, NOT A QUESTION:** `ShipAddr` (223 routable, ignored), the review surface and geocoding were all **out of scope by instruction** and are untouched. Geocoding especially — a geocoded phone number produces a plausible coordinate in the wrong place.

**#330 — the grow-ladder literature recon (research, report only)**
- 🔴 **NOT A QUESTION, A CORRECTION YOU SHOULD CARRY: `ANSI Z60.1` IS SUPERSEDED.** The current standard is **`ANSI Z60.2-2025`**, approved 17 April 2025 — a **new base number**, not a new edition. Anything in the corpus citing "Z60.1" is citing a retired designation. Owner: `docs/research/2026-09-15-industry-grow-ladder-literature.md` §①.
- 🔴 **OPEN — SIX NUMBERS ONLY TERRY CAN SUPPLY, EACH SEARCHED FOR AND ABSENT FROM THE PUBLISHED RECORD:** survival at each graduation · where in the cycle his losses fall · time-in-rung for HIS species in Leander · rooting % for crape myrtle / juniper / cherry laurel · what his `30` and `200` containers actually hold in cubic inches · **his held-back rate.** **The first real up-pot run supplies four; two are a conversation and a tape measure.** Owner: §⑧.
- 🔴 **OPEN — AND IT BLOCKS STORING ANY SURVIVAL FIGURE: A GRADUATION HAS THREE OUTCOMES, NOT TWO.** Promoted · **held back** · culled — and **two of the four published cull reasons are size failures on a LIVING plant**, not deaths. A single `lost` event cannot express that, and **cost-per-surviving-plant is wrong under either mis-mapping.** ⚠️ `plant_events['lost']` is the successor shape CLAUDE.md §2 names for the retired `losses` table; **check it against this before building.** Owner: §③ / §⑧.
- 🟡 **OPEN — HOW DOES A RUNG WITH NO ANSI CLASS GET MODELLED?** **Two of LAWNS's eleven have none** — a true 30-gal and a true 200-gal land in gaps between classes, and `#30`/`#200` appear **zero times in either edition.** The class must be **nullable** with an honest `unclassified` state (D-9 / A9). Owner: §① / §⑧.
- 🟡 **OPEN — "LINER" IS A ROLE, NOT A RUNG.** The same #5 juniper is finished stock or a bump-up liner depending only on intent. **Modelling it as a rung value repeats tech-debt #252's shape.** Owner: §⑥.
- 🟡 **OPEN — DO WE ADOPT ANSI's `C1T2` HISTORY CODE INSTEAD OF INVENTING ONE?** Propagation type plus years per stage, four characters, industry-read, and **age derives from it rather than being stored.** Owner: §④ (ANSI §6.1.1.1).
- ✏️ **DISCLOSED, NOT A QUESTION — ONE CITATION IS KNOWN-UNREAD:** the **2014 edition returns HTTP 403** and was not read, so the 2004→2025 comparison spans 21 years with the middle unexamined. #1–#95/100 are identical at both ends so the risk is low, **but it is unverified rather than verified**, and §⑦ says so.
- ✏️ **DISCLOSED — THE #325 HOOK'S RESERVED-ROW EXEMPTION KEYS ON CELL-1 SHAPE, NOT ON THE WORD.** A reservation written `| **#330** | ⏳ **RESERVED …**` is **refused**; it must be `| ⏳ **#330 — RESERVED …**`. Correct by design, but **CLAUDE.md §9 only says *"a `⏳ RESERVED` row is a claim"***, so the load-bearing detail is undocumented. Owner: `scripts/verify-handoff-retention.mjs:191`.

**#329 — two BOM rulings (R-155 one mix ratio · R-156 the ring function)**
- ✅ **ANSWERED IN-SESSION 2026-09-14 — the √ fit.** *"Through"* both anchors needs `d = a√g + b`; no single-coefficient `d = k√g` hits both (k from 15 → 12.58 ft at 95; k from 95 → 4.77 ft at 15). **You confirmed the through-both reading.** Recorded because **no owner-test on real LAWNS sizes can tell the readings apart** — both are exact at 15 and 95. Owns: `docs/RULINGS.md` R-156.
- 🔴 **OPEN — BUILD THE INSTALL COST MODEL IN THE REPO. ✏️ RE-SCOPED 2026-09-15: I had this as *"find the model and remove its mulch line"* and David corrected it.** There is no model here and there never was — the artefact is a **Python script run in a chat on 2026-09-11** (`install-cost-model.json`, never committed), and **its mulch line, its ring FIVE-ROW LOOKUP and `MULCH_YD = BARK_YD ("TO CONFIRM")` are Lightning's inventions, not LAWNS's facts.** Build it reading `business_operations_config`, no mulch line, the ring as [[R-156]]'s total function, and **no number carried across without a `basis.ts` provenance mark** — a `"TO CONFIRM"` equality is exactly what that type system refuses. ⚠️ **Nothing a customer is charged depends on it today, because it does not exist.** ✅ **NO LONGER BLOCKED — #253 is RESOLVED (2026-09-15, David's live run): `business_operations_config` exists and saves.** This build can start. Owns: `docs/tech-debt-log.md` #299.
- 🔴 **OPEN — THE RENUMBER IS THE CALL TO OVERRULE, AND IT HAPPENED TWICE.** The load-list branch's tech-debt `#290`/`#291`/`#292` collided with three different items on `main`; the first renumber landed on `#295`–`#298`, **which `origin/fix/price-unit-ac1-and-four-findings` had reserved 71 seconds earlier**. Final: **#290→#299 · #291→#300 · #292→#301**, plus my **#302**/**#303**. **My ledger id moved with them: #328 → #329.** Owns: `docs/tech-debt-log.md`.
- ✅ **RESOLVED AT MERGE 2026-09-15 — THE COLLISION IS CLEARED AND THE RENUMBER WENT THE OTHER WAY.** This line read *“NOT MINE TO MOVE — `R-155` IS ALSO CLAIMED BY `origin/feat/container-ladder` (#326), 28 MINUTES LATER, so [[R-148]] clause (4) puts the renumber on them”*. 🔴 **The 28-minute figure paired two different things:** it measured `18:06:37 − 17:38:00`, i.e. the ladder's RULING commit against THIS branch's LEDGER-ID reservation — not against an R-155 claim. **This branch has no commit at 17:38:00 at all** (its commits jump 2026-09-12T18:18:28 to 2026-09-14T18:31:14) and **its first R-155 claim is `bad0e56` at 18:31:32**, which is **LATER** than the ladder's `4b0aec1` at 18:06:37 and its reservation `5d5a05c` at 16:18:20. ⚠️ **David was shown the measurement and RULED ANYWAY that the ladder moves**; it was renumbered **R-155 → R-157** in `0bfe1c0` (12 citations, 8 files) by another session, since `feat/container-ladder`'s own session had ended. **This branch keeps `R-155` + `R-156`, `verify-id-sweep` is green both ways, and the merge is this commit.**
- 🟡 **OPEN — SHOULD THE DUPLICATE CHECK SEE BOTH ROW FORMATS?** I fixed the NEXT-FREE arithmetic (it was handing out taken ids) and **deliberately did not widen clause A**: a `## #N` heading and a `| N |` table row sharing one id still passes. The cap's own comment records the opposite intent, and a cap red on arrival against 270 rows is one people switch off (#73). **Measure the live duplicate count first, then widen or declare.** Owns: `docs/tech-debt-log.md` #303.
- 🟡 **OPEN — TEN COPIES OF THE COMMENT-STRIPPER, EIGHT WITH NO REACH CONTROL.** Not urgent, none known broken; a stripper that quietly stops working turns every negative probe downstream of it green. Owns: `docs/tech-debt-log.md` #302.
- ✏️ **DISCLOSED, NOT A QUESTION:** this branch was **rebased onto `origin/main` mid-build**. It was cut from `origin/feat/delivery-day-load-list` (unmerged, your hold) because `BOM_RULES` exists nowhere else, and that branch was 2 days stale — archiving §3 from it would have produced three byte-identical duplicates, auto-merged with no conflict, which is the defect #325's hook exists to catch.
- ✏️ **DISCLOSED:** ledger row **#315** is declared in `handoff-entry-declarations.json` as carrying no §3 entry. **It was invisible to the 2026-09-14 sweep because that sweep read `main` and its branch is unmerged** — the gate finds these only when a branch arrives, which is what happened on the rebase.
**#328 — `price_unit` is a shape, not a closed list (migration WRITTEN, not applied)**
- 🔴 **BLOCKING — YOU APPLY THE MIGRATION AND §9's SCHEMA VERIFICATION GATE IS OWED UNTIL YOU DO.** `supabase/migrations/20260914_price_unit_shape_not_enum.sql`, in the **SQL editor, never the table editor** (§6 r17). Five verification queries sit at its foot; **paste ③ (every live value + counts) and ④ (`'household'` now inserts, wrapped in `BEGIN`/`ROLLBACK`) back** and the ledger row gets filled. ⚠️ **⑤ matters as much as ④** — four probes that must STILL FAIL, because a constraint that accepts everything is not a constraint. Owner: the migration file.
- 🔴 **OPEN — I WENT BEYOND WHAT YOU APPROVED AND THIS IS THE CALL TO OVERRULE.** You approved the CHECK and the DEFAULT. **I also changed six code-side refusals**, because the migration alone does not deliver the reason you gave: `seed.ts` would still have silently rewritten `'household'` to `'order'`, and a `foodbank.ts` would have been a **compile error before it was ever a database one**. Each is small and listed in ledger #328; **any comes out on your word.** Owner: `docs/CLOSE-OUT-LEDGER.md` #328.
- 🟡 **OPEN — DO YOU WANT [[R-152]]'s LOOKUP TABLE INSTEAD?** You ruled exactly this class for channel names: *"one list… Adding a channel becomes a row, and drift becomes structurally impossible rather than a discipline."* **I did not take it**, because R-152's driver was **drift between two constraints that disagreed** and `price_unit` has one constraint and no drift — so a lookup table buys **curation, not correctness**. It is tech-debt **#298**'s option 3. Owner: the migration header.
- 🟡 **OPEN — THE PICKER STILL OFFERS “per plant” TO EVERY VERTICAL (tech-debt #298).** The refusal is gone; the affordance is not. A vertical can supply its own unit through `discovery/verticals/`, **but an owner cannot type one.** Out of scope on your *"not now"* — three fixes are costed in #298.
- 🟡 **OPEN — DROP THE DEFAULT, OR REPOINT IT?** I dropped it outright: `price_unit` stays NOT NULL, so an omitted unit now **fails loudly** rather than silently becoming a grower's unit (D-9). **Measured first — nothing in the repo relies on the default.** One line if you would rather it degraded quietly. Owner: the migration §C.
- 🔴 **NOT A QUESTION, A TIMER: tech-debt #297 IS FREE TO FIX ONLY WHILE `20260905_production_planning` STAYS UNAPPLIED (#253).** Grower units (`tradeGallonFactor`, `trueGallonsPerCubicYard`) are keys on an **exported shared interface**. No live row exists to migrate today. **That changes the moment you apply #253's migration.** ➕ **AMENDED 2026-09-14: `trueGallonsPerCubicYard` now has a SECOND HOME at a different precision** — `productionConfig.ts:126` `201.974` vs `loadList.ts:42` `46656 / 231`. **Folded into #297 on your instruction, not filed separately.** ⚠️ The arithmetic gap is negligible (~1.3e-7); the drift is the point. **Whoever fixes #297 folds both homes into one derived definition.**
- ⚠️ **NOT A QUESTION, A HEADS-UP: another session is building the BOM** (`origin/fix/bom-one-mix-ratio-and-ring-function`, which also claimed #328 71 seconds after this branch and renumbers under R-148 (4)). **Recon #327 Finding 6 §5 says a BOM should be born in `shared` with its `unit` NOT enumerating a vertical's vocabulary** — the defect #328 just fixed. Worth making sure they have read it.
**#327 — recon: what is in cultivar that belongs in shared (report only)**
- 🔴 **OPEN — SHOULD THE SEVEN FINDINGS GET TECH-DEBT IDS?** I filed none, because the prompt said *report only*. ⚠️ **The cost is real: a finding that is not in the log is one nothing will resurface.** **Four are NOT previously filed** — `serviceReview.ts:156` `ACCOUNT_STOCK = /nursery\s+stock\|plant\s+sales/i`, `:407` `/^\d+ Gallon$/`, `:78` `UNIT_PLANT_SHARE`, and `productionConfig.ts:56,58`'s gallon keys. Owner: `docs/recon/2026-09-14-cultivar-to-shared-boundary.md`.
- 🔴 **OPEN — WIDEN `service_offerings.price_unit`'s CHECK AND DROP `DEFAULT 'plant'`?** `CHECK (price_unit IN ('order','plant','vehicle','visit')) DEFAULT 'plant'` puts a grower's noun in a platform constraint, **and it is load-bearing in cart math** (`netting.ts:37`, `transport.ts:41,43`). 🔴 **The only finding in the report that gets more expensive with time, because it is schema with live rows.** ⚠️ Widening never rejects an existing row — **cheap today.** ⚠️ **The hard part is not the migration:** `netting.ts` must learn to multiply by *the line-item count* with `plant` as one label for it. Owner: same doc, Finding 1.
- 🔴 **OPEN — PERSIST THE GEOCODER'S COORDINATES?** `DeliveryRoute.tsx:211` geocodes every stop; `:408/:417/:428` are its only DB calls and **all three are READS**. **Route geometry is discarded on every delivery day — the only finding with a running cost rather than refactor risk.** ⚠️ **Needs `customer_addresses`' schema read first; I did not query the live database.** Owner: same doc, Finding 4 §3.
- 🟡 **OPEN — RENAME `production/`'s GALLON KEYS WHILE IT IS STILL FREE?** `tradeGallonFactor` / `trueGallonsPerCubicYard` are grower units on an **exported shared interface**. 🔴 **Free only because tech-debt #253 is still true — `20260905_production_planning` is NOT APPLIED, so there is no live row to migrate. That will change.** Owner: same doc, Finding 6.
- 🟡 **OPEN — ANSWER GOOGLE-vs-SELF-HOSTED ROUTING BEFORE moving the delivery libs.** `routeHandoff.ts:73,88` builds Google Directions URLs; moving that page to `shared` makes the lock-in platform-wide. Owner: same doc, Finding 4 §4.
- ✏️ **NOT A QUESTION — TWO CORRECTIONS THIS RECON OWES.** **tech-debt #16's *"MarginEngine orphaned"* is STALE** (real import, `CostToProduce.ts:41`, five consumers; ⚠️ its `plants.cost_price` half NOT verified). **`productionConfig.ts:43`'s own AC-1 claim is 80% true** — the `uppot` half holds, the gallon keys do not.
- ⚠️ **NOT A QUESTION — A RECOMMENDATION AGAINST WORK.** Do **not** start a general move-surfaces-to-shared campaign. 32-of-33 tiles being `general` makes it look obvious; it touches ~7,700 LOC of working owner-proven surfaces and **the receipts move alone flips 12 proven owner-test cards to `owed`.** The correct trigger is a commissioned second vertical.
**#326 — the container ladder (BUILT, R-157)**
- ✅ **ANSWERED 2026-09-16 — THE MIGRATION IS APPLIED.** David applied `supabase/migrations/20260914_container_ladder.sql` on 2026-09-16 and ran its verify block: V1 — 12 columns (id, business_id, label, aliases, sort_order, volume_gallons, handling_minutes, handling_because, active, retired_at, created_at, updated_at) · V2 — RLS on, exactly three policies: container_ladder_member_select (r), container_ladder_settings_insert (a), container_ladder_settings_update (w), no delete · V3 — nine LAWNS rungs: slip (no volume) · 4 in (no volume) · 3/5 gal (4; aliases "#3/5", "3/5 Gallon") · 15 · 30 · 45 · 65 · 95/100 (95; aliases "95 gal", "100 gal", "95 gallon", "100 gallon") · 200 · V4 — a second "15 GAL" refused by container_ladder_business_label_key. The catalog check (`verify-migration-apply-state.mjs --catalog`) lists it APPLIED. **CARDS 22–27 are unblocked.** ✏️ Corrected by ledger #343 — this line said NOT APPLIED after it had run (the #336 class). WAS: 🔴 **BLOCKING — THE MIGRATION IS NOT APPLIED.** **CARDS 22–27 cannot run until it is.** Apply as `postgres` in the **SQL EDITOR, never the dashboard table editor** — §6 r17 is load-bearing here because it CREATES a table (the table editor's `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, and RLS cannot filter TRUNCATE). V1–V5 are at the foot of the file. Owner: the migration.
- 🔴 **OPEN — THE 121 OFF-LADDER ROWS, ONE DECISION PER SIZE.** Live at LAWNS: `3 gal` (53) · `5 gal` (34) · `1 gal` (24) · `7 gal` (21) · `2 gal` (7) · `10 gal` (2) · `300 gal` (1). For each: **a rung that belongs on the ladder, or rows that need correcting?** They are LISTED on the plan screen and deliberately NOT seeded as rungs — **seeding them would answer this by writing it into the database.** ⚠️ `3 gal`/`5 gal` fold onto the `3/5 gal` rung by derived key and may not appear. Owner: `docs/recon/2026-09-14-container-ladder-recon.md` §4.
- 🔴 **OPEN — THREE LIVE ROWS CARRY A STALE PROJECTION AND NOTHING WILL CATCH IT.** The `20/24/36 inch box` rows (Texas Mountain Laurel) read `unit_kind='length'` in the database; the parser now says `container`. **The DB trigger cannot have caught it — the PARSER moved, not the size.** Fix is `npm run units:backfill`; **I did not run it because it writes to LAWNS.** Owner: tech-debt, and the backfill script.
- ✅ **ANSWERED BY LEDGER #343 (pending merge) — Settings → Container sizes.** WAS: 🟡 **OPEN — NO SCREEN EDITS THE LADDER.** The table, the policies and the reader exist; **adding a rung today is SQL.** The editing surface is the obvious next build and was deliberately not started. Owner: `containerLadderRead.ts` / a Settings panel.
- 🟡 **OPEN — NO RUNG SETS A HANDLING FIGURE**, so every rung falls back to the yard-wide rate. The column and the basis-carrying accessor exist; the numbers are Terry's to give. ✅ **Not a ruling question: per-rung minutes does NOT move R-89** — checked against its text, it kills the flat CONFLATED rate (mutant P1) and `setup + n × handling` is untouched. **My earlier flag was wrong and is withdrawn.** Owner: `docs/RULINGS.md` R-89 / R-157.
- ⚠️ **NOT A QUESTION — A DIVERGENCE YOU RULED, RECORDED SO NOBODY "FIXES" IT BACK.** The prompt cited ledger #310 as precedent, but `channels` is **GLOBAL, with no `business_id` and no write policy at all** (*"adding a channel is a migration"*). This ladder is **per-tenant and writable on `settings:update`**, on your ruling.
- ⚠️ **NOT A QUESTION — A TEST ASSERTION REVERSED ON YOUR INSTRUCTION.** §D asserted *"a lot counted AT zero is a real answer and is planned"*; *"cannot be planned whatever its size"* flips it. The old expectation is recorded in the test, not deleted.
- ✏️ **THREE CITATIONS CORRECTED, NOT QUESTIONS:** tech-debt **#253** and the uppot board's **migration gate** both asserted a live tenant-wide outage — **all three production-planning tables EXIST, full shape, 0 rows**. And tech-debt **#292** is the `set -o pipefail` item, **not** the load list — **no load-list item exists in the log and no load-list surface exists in the code**, though the 9-tree count was exactly right.


**#325 — the pre-commit hook (one check)**
- 🔴 **NOT A QUESTION, A STANDING LIMIT YOU SHOULD KNOW: THE HOOK IS NOT ENFORCEMENT.** `git commit --no-verify` fires no hook at all and the broken state commits cleanly — **measured, not asserted**. No server-side check, no CI, no audit notices. A fresh clone that never runs `npm install` has no hook either. **It catches the accident; it stops nobody who means it.**
- 🟡 **OPEN — SHOULD IT USE husky INSTEAD?** §6 r10 divergence, stated: husky is the industry standard and was not used, because it is a dependency plus a directory to do what one line of `core.hooksPath` does. **Your call; nothing breaks either way.**
- 🟡 **OPEN — SHOULD ANYTHING ELSE EVER GO IN THIS HOOK?** My answer in the header is **no**: 0.21s is the design, and a hook that runs the whole gate is a hook people disable. **Recorded as a decision so the next session does not quietly add a second check.**
- ✏️ **DISCLOSED, NOT A QUESTION:** worktrees share `.git/config`, so `core.hooksPath=.githooks` is **already set in `~/Desktop/trace-platform/.git/config`**. Harmless until this merges (no `.githooks/` on `main` → nothing fires), correct after. `npm run hooks:status` says which state you are in.

**#324 — the worktree rule (tech-debt #282 resolved)**
- 🔴 **OPEN — PLACEMENT IS MINE AND THIS IS THE CALL TO OVERRULE.** The rule went to **CLAUDE.md §6 r20** (full text), with **R-154** as an index line and **§10 item 11** as a one-line pointer. §9 was rejected deliberately: it fires at CLOSE-OUT while #282 fires at the COMMIT INSTANT, and a worktree must exist before work starts. Owner: `CLAUDE.md` §6 r20.
- ✅ **ANSWERED BY INSTRUCTION 2026-09-14 — KEEP IT.** David, merging this branch: *"Keep §10 item 11."* The one-line worktree pointer in the SESSION STARTER **stays**, and `Do not start until you confirm all eleven` with it. ✏️ **The flag was right to raise it** — item 11 was scope the prompt did not ask for, and a rule filed only in §6 is a rule the session-open checklist never surfaces (the OP-15 / row-19B lesson: a rule filed where the actor is not standing is a note, and notes do not act).
- 🔴 **OPEN — SHOULD THE RULE GET A CAP AT ALL?** It is unguarded by design and says so. A cap asserting the cause must know which checkout is the shared one — per-machine state (`.claude/` is gitignored for that reason). #282's `git branch --show-current` at the commit instant catches the SYMPTOM only. **Whether that is good enough is yours.** Owner: `docs/tech-debt-log.md` #282.
- 🟡 **OPEN — #281 AND #280 ARE NOT CLOSED BY THIS.** The rule resolves the commit instant only; build start (#281) and close-out (#280) remain. Owner: `docs/tech-debt-log.md`.

**#322 — the import preview's two field checks**
- 🔴 **OPEN AND IT IS THE GO-LIVE BLOCKER'S NEXT STEP — MAY THE IMPORT SEED `customer_addresses` FROM `ShipAddr`?** 223 LAWNS customers carry a routable ship-to that has never come across. The destination EXISTS and is empty. **`20260911b` §4 declares NO BACKFILL deliberately** — AGAVE LD LLC's four spellings of one yard would become four curated sites and the drift would be permanent — and **`customerAddresses.test.ts` §F fails the build the day anything seeds that table.** So this is not a coding gap, it is your ruling. The check REPORTS them and imports nothing. **OWNER: `supabase/migrations/20260911b_customer_addresses.sql` §4.**
- 🔴 **OPEN — YOUR THREE MEASURED FIGURES DO NOT ADD UP AND I DID NOT PICK ONE: 486 + 1,473 = 1,959, against a capture of 1,946.** Either the 1,473 uses a different denominator (records with no `BillAddr` at all?) or one figure is off by ~13. **CARD 35 asks you to write down what the live check says** — the first reading taken by something that will re-take it. **OWNER: `docs/owner-tests/qb-catalogue-import-full-surface-test.md` CARD 35.**
- 🟡 **OPEN — SHOULD THE CHECKS GATE THE IMPORT, OR ONLY INFORM IT?** Today Import stays enabled with 486 phone numbers in the street column. My reasoning: that is a go-live blocker for DELIVERY, not a reason to refuse a customer list that is three-quarters correct. **One line in `canImport` if you disagree. OWNER: CARD 37.**
- 🟡 **OPEN — HOW IS THE `Line1`/`Line2` REMAP ACTUALLY DONE?** Not "read Line2": the naive swap gives the 1,473 whose Line1 is a real street their suite number and the 28 with no Line2 a NULL. It has to be **per-record and shape-driven**, which is now measurable but not decided. **OWNER: tech-debt #254, still OPEN.**
- 🟡 **OPEN — MASKED EXAMPLES COST LEGIBILITY.** Letters → `x`, digits past the third → `•`. `(512) •••-••••` proves the classifier; `400 xxxxxxxxx xxxx` tells you little. R-23 says this screen never paints ~1,900 real people — say so if you want fuller examples on your own tenant.
- ✏️ **RESOLVED BY THE MERGE, AND IT DID NOT HAPPEN THE WAY I PREDICTED — WORTH READING.** I flagged that #321 and #322 would **CONFLICT** in `handoff-archive.md` because both archived #314. **They did not conflict. Git AUTO-MERGED them** — the two insertions landed at different offsets under different provenance comments — and produced **TWO BYTE-IDENTICAL COPIES of #314**. 🔴 **The silent outcome is the worse one:** a conflict stops a human; a duplicate breaks the archive's `entries-in == entries-out` arithmetic with nothing on screen to say so. Deduped to one at merge time, with both moves recorded in a single provenance comment. ⚠️ **AND THE MERGE ITSELF ARCHIVED A THIRD ENTRY NEITHER SESSION COULD HAVE:** both branches left §3 holding three, keeping both new entries makes four, so **N=3 rotated #318 out at merge time**. Tech-debt **#282** — two sessions, one §3 window.

**#321 — the production stamp**
- 🟢 **OWNER-PROVEN 2026-09-14 — David's live run: *"the foot of the screen reads · prod"*.** `production-stamp` board CARD 1 `covered`, 1 of 5. 🔴 **The board had to be CREATED to receive the flip — an OP-14 gap in #321, which changed a surface on every screen and made no card for it.** ⚠️ **CARDS 2–4 still `owed`** (the preview chip, the promoted-branch chip, the broken-screen case). Owner: `docs/owner-tests/production-stamp-full-surface-test.md`.
- 🔴 **OPEN — PRODUCTION IS STAMPED POSITIVELY, AND THAT IS A DELIBERATE DEVIATION FROM THE INDUSTRY STANDARD (§6 r16).** The standard env badge shows **nothing** in production. I show `prod`, because a blank production is indistinguishable from a bundle built before the feature existed (A9 *absent is not empty*). **Cost: one more token on every screen, for every user, forever.** Owner: `src/lib/deployStamp.ts`.
- 🔴 **OPEN — `prod⚠ <branch>` IS A JUDGEMENT MADE WITHOUT ASKING.** A production deploy built from a non-`main` branch shouts. Legal (someone promoted a branch), and I decided it is worth seeing. **Say so if you would rather it stayed quiet.** Owner: `src/lib/deployStamp.ts`.
- 🟡 **OPEN — tech-debt #280 IS 🟡 PARTIAL, NOT RESOLVED.** ② is now **OBSERVABLE by a human**; **no cap asserts it** and the close-out gates still accept *"pushed"*. ① (`merge-base --is-ancestor`) is satisfied for #320 **by the merge, not by a gate** — **asserting it is cheap and still owed.** Owner: `docs/tech-debt-log.md` → **#280**.

**#323 — the two assertions, built**
- ✅ **ANSWERED BY BUILD — #280 ① is asserted** (`verify-main-ancestry`, in `npm run verify`), **proven red with a real commit on local `main`**. ⚠️ **Clause A asserts `main` ONLY**, and **clause B is "at least one" not "all"** — measured: "all" reports 8 rebase artefacts, none a defect.
- ✅ **ANSWERED BY BUILD — #294a is asserted** (`verify-id-citations` clause E), **red-first naming exactly the four predicted**, then repaired. **`#311` needed a judgement: which cell to merge** — I merged the renumber note into the SHA cell because it realigns every column. **Say so if you would rather it went elsewhere.**
- 🔴 **STILL OPEN — #280 ② is unchanged and #280 stays 🟡 PARTIAL.** Nothing we own reads Vercel; ② is observable from the app (#321) and asserted by nothing. Owner: `docs/tech-debt-log.md` → **#280**.
- 🔴 **LIVE `#323` COLLISION — another session (`docs/worktree-rule-and-282-close`, working tech-debt #282) claimed it 1m19s later.** R-148 clause (4): they renumber. **Not mine to move, and `npm run verify` is red until they do.**

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
- 🔴 **A STORY IS OWED BY YOU, and Thunder did not write one.** ✏️ **CORRECTED 2026-09-15 (ledger #336) — THE LINE NUMBER WAS WRONG AND POINTED AT AN UNRELATED STORY.** It read `user_stories.md:1630`; **`:1630` is *"David can't see what is still open…"*, `STATUS: written`, nothing to do with addresses.** The row meant is **`user_stories.md:1862` — *"Level-2 address-based tax API / saved ship-to address book (SCOPED-OUT)"***, and **#335's contact record inverts it further.** `:524` and `:608` name the owed `conditional-address-on-delivery` sub-story. **See the #336 block above for what the row says now.**
- ✅ **APPLIED — `20260911b_customer_addresses.sql` ran on 2026-09-12 and was CATALOG-VERIFIED** (`built-inventory.md`: RLS on · 14 columns · three policies naming `customers:*` · two UNIQUE partial indexes · 0 rows; board CARDS 1 and 3 `covered`, ledger #312). ✏️ **CORRECTED 2026-09-15 (ledger #336) — THIS LINE READ *"written, not applied"* FOR THREE DAYS AFTER IT WAS APPLIED**, while `built-inventory.md` recorded the catalog verification. **The same defect ledger #332 was filed about, one line over in the register that exists to prevent it** — corrected in the pass that found it rather than reported, which is #332's own rule. ⚠️ **Board CARD 2 was the only card runnable BEFORE the apply and that window has closed.**
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
