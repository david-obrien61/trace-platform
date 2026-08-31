# OWNER TEST — POSITIONS (know what my job is)

**Capability:** — (no 24-board capability exists for this surface yet; that is DERIVED, not omitted)
**Story:** `user_stories.md` → *Know what my job is — a position gets a description before a person gets the job*
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 12 covered** (11 `owed` · **1 `needs-test`** — CARD 8, and it names why).
⚠️ **No card was flipped `covered` → `owed` by the 2026-08-31 starting-points build, and that is arithmetic rather than luck: none of the twelve was covered to begin with.** CARDS 1, 2 and 7 were REWRITTEN because their surfaces moved; CARDS 9–12 are new.
**DEVICE: desktop** — the picker is a long tick-list and the description is a printed page. Neither is lot work.

---

## ⛔ GATE 0 — DO THIS BEFORE READING ANY SCREEN (OP-15)

A failed Vercel build is **SILENT** — the last-good bundle keeps serving — and **Vercel deploys the TREE, not the COMMIT**. If the SHA under test is not live, every observation below is fiction.

1. `git log -1 --format=%h` on the branch under test.
2. Vercel dashboard: the deployment for **that exact SHA** reads **READY** (not a *different* push's Ready).
3. Confirm the always-visible build stamp at the bottom of the screen shows the same 7-char SHA.
4. Hard-refresh.

If ①–③ do not agree, **STOP**. Do not record a pass or a fail.

🔴 **THE SHA UNDER TEST IS THE MERGE OF `thunder/position-starters` TO `main`** — the starting-points build, 2026-08-31. Testing the BRANCH would test code Vercel never built; `main` is what deploys. *(The previous SHA on this board, `3bb36ff`, was #240's merge; every card below has moved since.)*

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
- 🔴 **Now the part that is easy to skip: change something.** Untick two rows, tick one the set missed. **Save.** Reload. Your edit survived — the set is a starting point, not a template that reasserts itself.

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
