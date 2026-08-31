# OWNER TEST — POSITIONS (know what my job is)

**Capability:** — (no 24-board capability exists for this surface yet; that is DERIVED, not omitted)
**Story:** `user_stories.md` → *Know what my job is — a position gets a description before a person gets the job*
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 8 covered** (7 `owed` · **1 `needs-test`** — CARD 8, and it names why).
**DEVICE: desktop** — the picker is a long tick-list and the description is a printed page. Neither is lot work.

---

## ⛔ GATE 0 — DO THIS BEFORE READING ANY SCREEN (OP-15)

A failed Vercel build is **SILENT** — the last-good bundle keeps serving — and **Vercel deploys the TREE, not the COMMIT**. If the SHA under test is not live, every observation below is fiction.

1. `git log -1 --format=%h` on the branch under test.
2. Vercel dashboard: the deployment for **that exact SHA** reads **READY** (not a *different* push's Ready).
3. Confirm the always-visible build stamp at the bottom of the screen shows the same 7-char SHA.
4. Hard-refresh.

If ①–③ do not agree, **STOP**. Do not record a pass or a fail.

---

## ⛔ GATE 0b — THE MIGRATION IS WRITTEN AND NOT APPLIED

🔴 **`supabase/migrations/20260831_business_positions.sql` has NOT been run.** Until it is, all three tables are absent and **every card below fails at the first read** — the page will report a failed read rather than an empty one, which is itself correct behaviour but is not what these cards are testing.

Apply it in the **SQL editor** (§6 r17 — never the table editor), then run its own verification blocks. **V3 and V5 are the two that matter:**

- **V3** — every write policy names `settings:update`. Fewer than 3 rows means a write policy is over-wide (tech-debt #124's class). **STOP if so.**
- **V5** — the OWNER floor still reads **57**. This build must not have touched the authority model, and V5 is the assertion rather than the claim.

---

## CARD 1 — The context form asks for THREE things, and shows back the two it already knows
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Open `/admin/positions` as **David (OWNER) on Test Dave's Tree Nest** — 🔴 **not LAWNS.**

- The green **"Already on file — you will not be asked for these"** panel appears, and it states the weekly rhythm and the headcount.
- 🔴 **There is NO field anywhere on the page asking what days you are closed, and none asking how many people you have.** That absence is the card. If either appears, the build has asked an owner to retype what the platform already stores.
- The form has exactly three boxes: what the business does · who it sells to · what it is known for.
- Fill all three, Save. It reports **Saved.** Reload — the values are still there.

⚠️ Test Dave's may have no `business_operating_days` rows. If so the panel says so in a sentence ("No weekly pattern recorded yet…") rather than showing an empty space — **that is the pass**, not a defect.

---

## CARD 2 — Building a position, and the frequency that is not stored when it is the default
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Still as **OWNER on Test Dave's**.

- Type `Operations Manager`, press **Add**. You land on the builder.
- Areas render as headings. **Nursery areas (Growing · Plant health & compliance) appear only if this tenant's `business_type` resolves to the cultivar vertical.** If Test Dave's is a nursery you see ten areas; if not, eight. Either is correct — **note which you saw**, it is the evidence for CARD 6.
- Tick six or seven things a real operations manager does. Change the frequency on one of them.
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
- Open a position: every tick is **disabled**, the frequency dropdowns are disabled, the note is disabled, and there is **no Save and no Delete**.
- **View the description** still works and prints.

🔴 **Now the part that matters most.** If any control is somehow reachable, use it and watch what happens. **A save that reports success while nothing changed is the worst possible outcome** — worse than an error — because that is #238's silent degradation. The store asserts an exact row count on every write specifically so this cannot happen; **this card is the proof it holds through the real UI under real RLS.**

---

## CARD 8 — Two people editing the same position at once
STATUS: needs-test · DEVICE: desktop · LAST-PROVEN: —

**Why `needs-test` and not `owed`:** the guard exists — `setPositionResponsibilities` asserts the delete affected exactly the number of rows the screen loaded, so a concurrent edit is detected and reported ("Someone else changed this position while you had it open"). **But it cannot be exercised without two simultaneous sessions on one tenant**, and this build did not stand that up. Recording the hole rather than implying coverage (D-9 applied to our own confidence).

⚠️ **The related known limit, so a tester does not file it as a new defect:** replacing a position's ticks is **two statements and the sequence is not atomic** — tech-debt **#130**. If the second step is refused, the message says the previous selections were cleared and to re-save. That is mitigated, not fixed; the durable form is one RPC and it is a migration.
