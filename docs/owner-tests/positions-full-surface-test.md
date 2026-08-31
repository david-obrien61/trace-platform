# OWNER TEST — POSITIONS (know what my job is)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance. Match it to `git log --oneline origin/main -1` — **not to a SHA written in this
> file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the
> stamp. *(GATE 0 · OP-15 · paid for twice on 2026-08-31: once hunting a defect in code that
> was never deployed, once by a pinned SHA going stale on the very next commit.)*

**Capability:** — (no 24-board capability exists for this surface yet; that is DERIVED, not omitted)
**Story:** `user_stories.md` → *Know what my job is — a position gets a description before a person gets the job*
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 12 covered** (11 `owed` · **1 `needs-test`** — CARD 8, and it names why).
⚠️ **CARD 9 was RUN on 2026-08-31 and is recorded as NOT RUN rather than failed** — the SHA under test did not contain the feature (see GATE 0). An observation against the wrong bundle is not a fail, it is fiction; recording it as a fail would have sent the next session hunting a defect that was not there.
⚠️ **No card was flipped `covered` → `owed` by the 2026-08-31 starting-points build, and that is arithmetic rather than luck: none of the twelve was covered to begin with.** CARDS 1, 2 and 7 were REWRITTEN because their surfaces moved; CARDS 9–12 are new.
**DEVICE: desktop** — the picker is a long tick-list and the description is a printed page. Neither is lot work.

---

## ⛔ GATE 0 — DO THIS BEFORE READING ANY SCREEN (OP-15)

A failed Vercel build is **SILENT** — the last-good bundle keeps serving — and **Vercel deploys the TREE, not the COMMIT**. If the SHA under test is not live, every observation below is fiction.

1. 🔴 **READ THE STAMP AT THE FOOT OF THE SCREEN** — `built <time> · <sha>`. **That is what is actually running in your browser.** One glance. It answers the question on its own in the overwhelming majority of cases, and it is the only step that reads the ARTEFACT rather than a record about the artefact.
2. Hard-refresh, and read it again — if it changed, you were on a cached bundle.
3. **Only if the stamp is not what you expect:** `git log -1 --format=%h`, and check the Vercel deployment for *that exact SHA* reads READY (not a different push's Ready). 🔴 **Check the branch is MERGED — `git log --oneline origin/main -1`.** Vercel deploys `main`; a branch push deploys nothing at all.

⚠️ **THE ORDER IS THE POINT AND IT WAS WRONG HERE UNTIL 2026-08-31.** This gate used to open with `git log` and a dashboard round-trip and put the stamp THIRD — so the cheapest, most direct check sat behind two slower ones that answer a *different* question (*"what did I intend?"* rather than *"what am I looking at?"*). **David had the stamp on every PDF he printed that week and never used it.** A check nobody reaches is not a check.

If the stamp is not the SHA you mean to test, **STOP**. Do not record a pass or a fail.

✅ **THE CODE FOR EVERY CARD BELOW LANDED AT `ce09942`** — #241 + #242, merged to `main` on 2026-08-31 and **verified live from the artefact**: `cultivar-os.app` served bundle `/assets/index-Cu2Ia3V_.js` containing `ce09942`, with `14ea7d0` gone.

🔴 **BUT DO NOT MATCH THE STAMP TO `ce09942` — MATCH IT TO `origin/main`, AND HERE IS WHY, BECAUSE IT BIT WITHIN THE HOUR.** **Vercel deploys the TREE, not the COMMIT**, so *every* push to `main` rebuilds the bundle — **including a docs-only push that changes no code at all.** The close-out commit for this very build moved the stamp off `ce09942` minutes after it was verified. ✏️ **So a board that pins an exact SHA rots on the next commit of any kind, and a tester matching against a rotted pin would "fail" GATE 0 on a perfectly good build** — which is the same false-negative that wasted 2026-08-31, wearing the opposite costume.

**THE CHECK THAT DOES NOT ROT:** run `git log --oneline origin/main -1` and confirm **the stamp matches THAT**, and that `ce09942` is an ancestor of it (`git merge-base --is-ancestor ce09942 origin/main && echo carries-the-feature`). **If the stamp reads `14ea7d0` or `3bb36ff`, you are on #240 and no card below CARD 8 can pass.**

⚠️ **THIS GATE HAS ALREADY BEEN PAID FOR ONCE ON THIS BOARD.** On 2026-08-31 CARD 9 was run and reported *"the chooser never appears"* — **because the branch had never been merged and `main` did not contain `positionStartingPoints.ts` at all.** Everything observed was #240 behaving exactly as #240 behaves, and the evidence offered that the build WAS deployed — *"About the business is populated"* — **was #240's placeholder rendering in an empty field, i.e. a second symptom of the same absence.** 🔴 **A defect was used as proof there was no defect, and one glance at the stamp would have ended it.** This is OP-15 / #60 in its purest form: a branch push deploys nothing, and the app looks completely normal while serving the old code.

---

## ⛔ GATE 0b — ✅ APPLIED AND VERIFIED. THIS GATE IS CLOSED.

✅ **`20260831_business_positions.sql` was applied by David on 2026-08-31 and verified FROM THE CATALOG, not from the builder's memory.** Every card below is runnable.

- **RLS ON** for all three tables — `business_context` · `business_positions` · `business_position_responsibilities`.
- **SIX POLICIES** — one member `SELECT` and one `settings:update` write per table.
- 🔴 **V3 PASSES — exactly three write policies, and all three name `settings:update`.** Not fewer, so **no over-wide policy slipped in** (tech-debt #124's class). This is the one that mattered most.
- ✅ **V4 RETURNS NO ROWS** — no `anon` TRUNCATE/REFERENCES. The §6 r17 table-editor fingerprint is absent, checked rather than assumed.
- 🔴 **V5 PASSES — the role floor is UNTOUCHED: OWNER 57 · MANAGER 25 · STAFF 10.** *The scope bar held as an assertion rather than as a claim* — this build created no role and granted nothing, and the catalog says so.
- **One trigger, `set_updated_at_generic`** — the standard one. Neither table minted its own.

---

## CARD 1 — The context form asks for THREE things, and shows back the two it already knows
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Open `/admin/positions` as **David (OWNER) on Test Dave's Tree Nest** — 🔴 **not LAWNS.**

- The green **"Already on file — you will not be asked for these"** panel appears, and it states the weekly rhythm and the headcount.
- 🔴 **There is NO field anywhere on the page asking what days you are closed, and none asking how many people you have.** That absence is the card. If either appears, the build has asked an owner to retype what the platform already stores.
- The form has exactly three boxes: what the business does · who it sells to · what it is known for.
- Fill all three, Save. It reports **Saved.** Reload — the values are still there.

⚠️ **Read the grey text in the empty boxes.** Each begins **"For example: …"**. 🔴 **None of them may describe YOUR business.** #240 shipped `"grows and sells shade trees on forty acres in Leander"` here and David read it as a value on screen — it was grey placeholder text in an empty box, carrying a number nothing measured supports. A placeholder only renders when the field is EMPTY, so one that reads like a value says a blank field is filled.

⚠️ **Test Dave's has no proposal on file, so all three boxes start EMPTY with no proposed card. That is the pass** — a business we have read nothing about must never be shown another business's facts. CARD 11 is where the proposal itself is tested, and it needs LAWNS.

⚠️ Test Dave's may have no `business_operating_days` rows. If so the panel says so in a sentence ("No weekly pattern recorded yet…") rather than showing an empty space — **that is the pass**, not a defect.

---

## CARD 2 — Building a position, and the frequency that is not stored when it is the default
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Still as **OWNER on Test Dave's**.

- Type `Operations Manager`, press **Add**. You land on the builder.
- 🔴 **The starting-point chooser is there before the list** — see CARD 9. For THIS card, take **Start blank**, so the tick-by-hand path is what gets proven.
- Areas render as **collapsed headings**. **Nursery areas (Growing · Plant health & compliance) appear only if this tenant's `business_type` resolves to the cultivar vertical.** If Test Dave's is a nursery you see ten areas; if not, eight. Either is correct — **note which you saw**, it is the evidence for CARD 6.
- Open two or three areas and tick six or seven things a real operations manager does. Change the frequency on one of them.
- The running total at the top tracks every tick, and **Save is in that bar** — you never scroll to the bottom to find it.
- Fill **"What doing this well looks like here."** Write a real sentence in your own voice, not a placeholder — CARD 5 is about whether it lands.
- **Save.** It reports **Saved.** Reload — every tick, the changed frequency, and the sentence survive.

---

## CARD 3 — The three marks, in consequences and never in permission strings
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

🔴 **This is the card that decides whether the inversion actually happened.** On the builder, scroll to the **People** and **Orders & money** areas.

- **"Set someone's pay rate"** and **"Approve hours or time worked"** carry a **Sensitive** mark whose text is about **what it exposes** — payroll, what every person is paid.
- **"Assign or change someone's role"**, **"See who has access"**, **"Remove someone's access"** and **"Invite someone into the system"** carry **Cannot be delegated**.
- Under **Oversight & system**, **"Manage the subscription and billing"** carries it too, and so does **"Connect or manage the accounting system"** — that last one is easy to miss and it is deliberate.
- 🔴 **READ EVERY MARK ON THE PAGE. NOT ONE OF THEM MAY CONTAIN A STRING LIKE `wages:read` OR `team:update`.** If a colon-shaped identifier appears anywhere in a mark, the feature has become the harder question again and the build has failed its own premise.

---

## CARD 4 — A responsibility the software cannot do is ticked anyway, and prints normally
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

- Find **"Uppot or graduate a lot and record it"** (nursery tenants) or **"Record what happened on the job and what was needed"** (any tenant).
- It shows **"Your business does this. The software cannot represent it yet."** and it is **still tickable**.
- Tick it. Save. Open **View the description**.
- 🔴 **On the printed page it appears exactly like every other line — no asterisk, no "coming soon", no note.** The description says what the JOB is, not what the app covers. **If the printed page carries any hint that TRACE cannot do it, that is the defect.**

---

## CARD 5 🔴 — THE ACCEPTANCE BAR: would you hand this to someone on Monday?
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

**This card is a judgement, not a checklist, and it is the only one that can fail the whole build.**

Open the description. Read it as if you were the person receiving it.

- Does the opening paragraph describe **this business**, or could it be any business with the nouns swapped?
- Does the week-rhythm line read like something a person wrote?
- Does your own sentence at the bottom land, or does it look stranded under a heading?
- Is the list of responsibilities in an order that makes sense — the everyday work first, the once-a-year work last?

🔴 **If it reads like a template with the blanks filled in, SAY SO AND FAIL THE CARD.** That is not a polish note. A generated document that reads as filler teaches the person the feature is decoration, and that is harder to undo than not shipping it. **Naming exactly which sentence sounds generated is worth more than a pass.**

⚠️ **Compare it against the four you hand-wrote.** Those are the specification. Where the generated one is thinner, that difference is the build's actual backlog.

---

## CARD 6 — Print it
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

- Click **Print or save as PDF**.
- The green bar, the buttons and any warning banner are **gone** from the print preview. The sheet is not.
- An area heading is never orphaned at the foot of a page with its list on the next.
- Save it as a PDF. Open the PDF. **It is the document, not a screenshot of an app.**

---

## CARD 7 🔴 — A STAFF MEMBER CANNOT CHANGE ANY OF IT, AND THE REFUSAL IS VISIBLE
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

🔴 **This is the wall, asserted in the negative — and a wall you cannot see is a wall nobody checks.**

Sign in as a **STAFF** member of Test Dave's (staff hold `settings:read`, not `settings:update`).

- `/admin/positions` **opens.** It does not 404 and does not redirect — a staff member reading their own position description is the entire point of writing one.
- The three context boxes are **disabled**, and a line says changing them needs the settings permission.
- There is **no** "Add" box for a new position.
- 🔴 **No "Use this" button appears beside any proposed context value** — a staff member cannot fill a field they cannot save.
- Open a position: **the starting-point chooser does not appear at all** (it is an edit affordance, and offering it to someone who cannot save is a dead affordance).
- Every tick is **disabled**, the frequency dropdowns are disabled, the note is disabled, and there is **no Save and no Delete** — including in the sticky bar, which shows the running total and nothing else.
- **View the description** still works and prints.

🔴 **Now the part that matters most.** If any control is somehow reachable, use it and watch what happens. **A save that reports success while nothing changed is the worst possible outcome** — worse than an error — because that is #238's silent degradation. The store asserts an exact row count on every write specifically so this cannot happen; **this card is the proof it holds through the real UI under real RLS.**

---

## CARD 8 — Two people editing the same position at once
STATUS: needs-test · DEVICE: desktop · LAST-PROVEN: —

**Why `needs-test` and not `owed`:** the guard exists — `setPositionResponsibilities` asserts the delete affected exactly the number of rows the screen loaded, so a concurrent edit is detected and reported ("Someone else changed this position while you had it open"). **But it cannot be exercised without two simultaneous sessions on one tenant**, and this build did not stand that up. Recording the hole rather than implying coverage (D-9 applied to our own confidence).

⚠️ **The related known limit, so a tester does not file it as a new defect:** replacing a position's ticks is **two statements and the sequence is not atomic** — tech-debt **#130**. If the second step is refused, the message says the previous selections were cleared and to re-save. That is mitigated, not fixed; the durable form is one RPC and it is a migration.

---

## CARD 9 🔴 — NEVER A BLANK PAGE: the starting points, and the count on each button
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

🔴 **This is the card the 2026-08-31 build exists for.** The first live run created "Production Manager", met 93 rows with nothing selected, ticked nothing, and produced a document reading *"Nothing has been ticked for this position yet · 0 responsibilities."* — truthful and useless.

As **OWNER on Test Dave's**, create a position and stop before ticking anything.

- Above the list: **"Start from a set"**, with seven choices — Production manager · Sales manager · External sales · Crew member / driver · Bookkeeper · Owner · Start blank.
- 🔴 **Each one carries its own count on the button** — "Production manager, 34 to start". ⚠️ **If Test Dave's is NOT a nursery the numbers are SMALLER** (production manager drops to 19, because the growing and plant-health rows do not exist for that tenant). **Note which you saw** — a set that showed 34 on a non-nursery would mean the vertical filter is not being applied to the sets.
- Press **Production manager**. The list fills. The running total reads the same number the button did.

🔴 **THE SETS ARE THE 2026-08-29 WORKBOOK'S MEMBERSHIP AS OF #243 — THE COUNTS DID NOT MOVE (34/27/9/8/10) BUT WHAT EACH ONE TICKS DID.** ✏️ **UPDATED #245: BOOKKEEPER IS NOW `11 to start`, NOT 10.** David added `MON-10` (*pay a contractor or vendor*) after the workbook left it in no set at all — *no set at all cannot be true, somebody pays vendors in every business.* 🔴 **If that button still reads `10 to start`, you are on a bundle from before the merge — stop and re-read the stamp.** Two spot-checks worth more than the totals:
- Apply **Bookkeeper**. *"Connect or manage the accounting system"* is ticked **AND marked "Cannot be delegated."** 🔴 **That pairing is the feature, not a bug** — at LAWNS the bookkeeper does that job and the platform reserves the permission to the account holder. Both are true, and the description states the JOB (R-30). If it is missing, a rule has been reinstated that the workbook overturned.
- Apply **Crew member / driver**. *"Ask a customer for a review after a job"* is in it. **Nobody derives that from a job title** — it is there because the person standing in front of the customer after the install is the one who asks.

✅ **AND THE TWO OPEN QUESTIONS THIS CARD USED TO CARRY ARE NOW ANSWERED (2026-08-31, ledger #245) — READ THE ANSWERS, THEY ARE NOT WHAT THE QUESTIONS ASSUMED.** **(1) The Crew set still does NOT include *"Walk the lot and count stock"*, and that is CORRECT** — the crew set is **DRIVERS**, and walking the lot to count is a **YARD** job. 🔴 **The gap is a missing POSITION, not a missing row**, and there is now a probe (F14) that FAILS the build if anyone adds `INV-01` to the drivers, because it is the tempting wrong fix and no count check would have noticed it. **(2) *"Pay a contractor or vendor"* is now in the BOOKKEEPER set** — the workbook had it in no set at all because at LAWNS only the owner does it, which conflated a position TEMPLATE with a LAWNS SNAPSHOT. The row is in the template and the observation survives it. 🔴 **AND THE REAL FINDING, WHICH IS ABOUT THE SETS THEMSELVES: THREE POSITIONS AT LAWNS ARE NOT IN ANY SET** — **the yard hand** (whose job `INV-01` actually is), **on-site maintenance — Cuto, who lives on site and does not speak English**, and **whatever customer two turns out to have.** They are declared in `MISSING_STARTING_POINTS` and **filed as a gap story, not built.** ⚠️ **So when you read this chooser, read it as a SAMPLE: it holds the people David met.** If a position you know is missing, that is this card's most valuable output — say which one.
- 🔴 **Now the part that is easy to skip: change something.** Untick two rows, tick one the set missed. **Save.** Reload. Your edit survived — the set is a starting point, not a template that reasserts itself.

⚠️ **IF THE CHOOSER IS NOT THERE, DO NOT GUESS — THE APP NOW TELLS YOU WHY.** Open the console and read `[TRACE:POSITIONS] builder-loaded`; its `chooser` field carries one of **five reasons**: `loading` · `no-position` · `read-only` (you are not `settings:update`) · `blank-chosen` (you pressed Start blank) · `already-ticked`. **`nothing-ticked` means it decided to SHOW it** — if you see that and no chooser is on screen, that is a genuine render defect and it is the one thing no test can reach. Anything else names the state, and `read-only` on an OWNER session means the business context has not resolved.

🔴 **THE REOPEN PATH IS PART OF THIS CARD, and #241 never considered it separately.** Leave a position saved at ZERO ticks, navigate away, and come back to it. **The chooser must be offered again.** A saved position sitting at zero is where every abandoned position lands, and it is the state that most needs the offer.

🔴 **AND THE NEGATIVE, WHICH IS THE DESIGN DECISION:** with something already ticked, go back into the position. **The chooser is GONE.** That is deliberate — applying a set REPLACES the ticks, and offering that beside work already done is one tap from destroying it. If the chooser is still offered over a position that has ticks, **fail the card**.

⚠️ **Type `Yard Manager` as a title on a new position. NOTHING is pre-selected and no set is auto-applied.** "Production Manager", "Operations Manager", "Yard Manager" and "Nursery Manager" are the same job and a title match would be right sometimes and **wrong silently** — writing a job description off a string match is worse than an extra tap. If the app ever guesses from the title, that is a defect.

---

## CARD 10 — Ten headings, not ninety-three lines — and nothing is hidden
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

David's own words about the first run: *"even though I understand it, it could be confusing."*

- On a fresh position the ten areas are **collapsed**. You scan ten headings, not 93 lines.
- Each heading carries its own count — **"Inventory · 7 of 10 ticked"**, and **"0 of 10"** when nothing is.
- Apply a starting point: **exactly the areas that set touched are OPEN, and the rest stay shut.**
- Re-open a saved position: the areas it has ticks in are open. Same rule, so returning and applying a set land in the same place.
- The running total at the top reads **"34 ticked"** and follows every change.

🔴 **THE ONE THING THAT MUST NOT HAPPEN: an unticked responsibility must still be reachable.** Open an area you ticked nothing in — **every row is there.** Part of the value of this screen is reading a responsibility and realising *nobody does this*. **Collapsed is fine. Filtered away is a failure** — if any unticked row cannot be reached, fail the card.

---

## CARD 11 🔴 — PROPOSED, NOT ASSUMED: the seeded context, and where it says it came from
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

🔴 **RUN THIS ONE ON LAWNS**, because it is the only tenant with a proposal on file. Nothing here writes anything until you press Save twice over, so it is safe on the real business.

Open `/admin/positions` as **OWNER on LAWNS**, with the three context boxes **empty**.

- Under each empty box: a dashed card headed **"Proposed — not saved"**, the proposed sentence, and **"Read from your own website — About"** (or the equivalent) beside it.
- The intro line says **"We read lawnstrees.com and have proposed some of it below."**
- 🔴 **Read the three proposals as facts about your business, not as copy.** Are they right? ⚠️ **The founding year is the one to look at: their About page says 1985 and their own site's structured data says 1984.** Whichever is right, **fix it in the box** — that single edit is the whole mechanism working, and it is exactly why a found fact is offered rather than stored.
- Press **Use this** on one. The text lands in the box **and the proposed card disappears** — there is now a value, so the proposal has been used or rejected and continuing to show it would be arguing with you.
- 🔴 **Do NOT press Save yet. Reload the page.** The box is **empty again** and the proposal is back. **That is the card:** until you save, nothing we proposed exists anywhere. A fact we found is not a fact you have agreed to.
- Now **Use this** on all three, edit them into your own words, **Save**. Reload — your version is there, with no trace of ours.

⚠️ **Check the proposals for marketing prose.** Their site also says *"When Quality Counts, You Can Count On Us!"* and *"Rooted in Austin, Growing With You"*. **Neither may appear in any proposed value** — real operating facts sit beside slogans on every small-business site, and a slogan on a document handed to a new employee is the failure this guards against.

---

## CARD 12 — An empty description does not offer itself as a document
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

The other half of the first run's finding: the document was truthful and useless, and **a sheet that renders like a document invites being printed like one.**

As **OWNER on Test Dave's**, create a position, tick **nothing**, and open **View the description**.

- 🔴 **There is no sheet.** No header, no subtitle, no blank page with a footer under it.
- Instead: **"<title> has nothing on it yet"**, a sentence saying what a description is for, and a **"Pick a starting point"** button that takes you back to the builder.
- 🔴 **"Print or save as PDF" is DISABLED, and a line beside it says why** — *"Nothing to print yet — tick what this job is responsible for first."* It is not hidden: a control that vanishes teaches nothing, and a greyed control with no reason is a mystery. **If Print is enabled here, or if it is simply gone, fail the card.**
- Now tick **one** thing, save, and reopen the description. **The sheet is back and Print is live.** One responsibility is a thin description, not a non-document — and the amber *"thinner than it needs to be"* banner is what handles thin.

⚠️ The amber banner and this empty state are **mutually exclusive by construction** — a page saying *"this will print but it is thin"* beside a page saying *"there is nothing to print"* would be saying two things at once (§6 r18). If you ever see both, that is the defect.
