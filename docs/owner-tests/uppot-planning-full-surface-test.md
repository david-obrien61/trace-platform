# OWNER TEST — UPPOT PLANNING: THE SPLIT, THE HOLD, AND WHAT THE PLAN COSTS

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** ⚠️ **NONE — this surface carries no id on the 24-capability board.** Not minted here.
**Story:** `user_stories.md` → *The growing ladder — potted, waiting, ready, and up a size*
(`STATUS: needs-input`). ⚠️ **THE STORY GATE IS PARTLY OPEN AND IS NOT CLOSED BY THIS BUILD** — see
the note below CARD 21.
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 21 covered** (19 `owed` · 2 `needs-test`).
**TENANT:** every card names its own. Most run at **Test Dave's Tree Nest**
(`f7ec5d67-a9ef-4cb0-b807-438d67687d1b`) — see the seed gate. Three run at **LAWNS**
(`ed2e5933-45dc-4b9b-a331-ddfd125e7a74`) and say so.
**ACTOR:** every card names its own. Most are the **OWNER**; CARDS 18–20 need a **MANAGER** and a
**STAFF** member.
**DEVICE:** all cards `DEVICE: desktop`. This is a planning-and-reconcile surface, and reconcile is
desktop (capture=mobile / reconcile=desktop).

---

> ⛔ **MIGRATION GATE — `supabase/migrations/20260905_production_planning.sql` IS NOT APPLIED.**
> **CARDS 8 THROUGH 17 CANNOT PASS WITHOUT IT.** It creates three tables:
> `business_operations_config`, `production_plans`, `production_plan_lines`.
>
> **Nothing breaks meanwhile, and the failure is honest rather than silent:** CARDS 1–7 (the
> calculator, which writes nothing) pass without it, Settings → Operations shows its defaults and
> refuses to save with a red message naming the missing table, and **Commit the plan** returns a
> red line saying the plan was not saved and that nothing is held.
>
> Apply it **as `postgres`, in the SQL EDITOR — never the dashboard TABLE EDITOR** (§6 r17: the
> table editor's `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, and RLS
> cannot filter TRUNCATE). This migration CREATES TABLES, so that rule is load-bearing here.
>
> **Then run VERIFY (A)–(H) at the foot of the migration file.** Three of them matter most:
> - **(D)** — `business_inventory` gained **NO** column. Expect **zero rows**. A row here means a
>   `held_qty` got in and the hold is no longer derived.
> - **(F)** — the **cross-tenant probe**, run **IMPERSONATED, not as `postgres`** (as `postgres`
>   RLS does not apply and it returns every tenant's rows, which looks like a failure and is not).
>   Expect **zero rows**.
> - **(G)** — the backdate CHECK must **REFUSE** the first insert and **ACCEPT** the second. A
>   guard nobody has watched refuse is a claim, not a guard.

> 🔴 **SEED GATE — MOST CARDS NEED TEST DAVE'S SEEDED, AND HERE IS WHY.**
> Measured live at LAWNS on 2026-09-05: **447 lots, 2 with a real count, and each of those two
> holds ONE TREE.** The smallest variety in your own workbook is 70 on hand. So the split run
> against LAWNS returns a delta of zero on every row and the screen is **correctly, uselessly
> empty**. The model cannot be demonstrated there.
>
> ```
> node scripts/seed-uppot-harness.mjs            # writes 18 tagged rows at Test Dave's
> npm run units:backfill                          # parses `size` into the unit projection
> ```
> The seed **refuses to run against LAWNS** — it asserts the business name before writing a row.
> Remove it afterwards with `node scripts/seed-uppot-harness.mjs --remove`.
>
> ⚠️ **RUN THE BACKFILL SECOND, AND LOOK AT THE SCREEN IN BETWEEN — that is CARD 4.** Before it,
> every seeded row refuses as *"has not been read as a unit yet"*, which is the honest state and is
> worth seeing once.

---

## CARD 1 — the screen opens and says what it is looking at
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. Sign in as the owner and go to **Inventory → Uppot plan** (`/inventory/uppot`).
   *(It is a nav entry, not a URL you have to know — that is the point of CARD 2.)*
2. Read the sage band under the heading.

**PASS:** it names a POPULATION — *"18 lots in the catalogue"* — and, if any are uncounted, says
**how many have never been counted** and that *"that is not a count of zero"*.
**FAIL:** the band is missing, or it prints a count with no denominator, or it says "0 lots" while
the catalogue plainly has rows.

---

## CARD 2 — it is reachable without knowing the URL
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. From the dashboard, use only the nav — do not type a URL.
2. Find **Inventory**, then **Uppot plan** beneath it.

**PASS:** you reach the screen through the nav rail, and the breadcrumb reads Dashboard / Inventory / Uppot plan.
**FAIL:** the entry is absent and the only way in is the address bar.
*(This card exists because the nav-integrity cap caught exactly that on the first run.)*

---

## CARD 3 — a lot with no count is REFUSED, not planned as zero
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. Scroll to **"lots cannot be planned"** below the grid.
2. Find **Cedar Elm**, **Chinquapin Oak** and **Possumhaw Holly**.

**PASS:** all three are listed, and each says **"Never counted — this is not a count of zero."**
**FAIL:** any of them appears in the GRID with a quantity of 0, or with a delta.

🔴 **WHY THIS IS THE CARD THAT MATTERS MOST AT LAWNS.** 445 of LAWNS's 447 rows are exactly this
case. If uncounted reads as zero, the whole 447-row screen becomes a wall of zeros that looks like
an answer.

---

## CARD 4 — an unparsed size refuses, and says so honestly
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

Run this **after the seed and BEFORE `npm run units:backfill`.**

1. Open the plan screen.

**PASS:** every seeded row is in the refused list saying its size **"has not been read as a unit
yet"**, and NONE of them silently plans.
**FAIL:** rows plan anyway, or the refusal says something else.

2. Now run `npm run units:backfill` and reload.

**PASS:** the rows move OUT of the refused list and into the grid.
**FAIL:** they stay refused after the backfill.

---

## CARD 5 — 🔴 THREE SPELLINGS OF THIRTY ARE ONE RUNG
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

The seed deliberately writes `"30 gallon"`, `"30 Gallon"` and `"30G"` on different varieties.

1. Look at the **In now** column for **Joan Lionetti** (30 gallon), **Lacey Oak** (30 Gallon) and
   **Eagleston Holly**'s 30-gallon row (30G).

**PASS:** all three read **30** in the *In now* column, whatever the *size* text beneath the name says.
**FAIL:** any of them shows the raw string, or is treated as a different size from the others.

🔴 **THE STAKE, MEASURED AT LAWNS:** 447 rows carry **46 distinct spellings** of `size` which fold
to **13 numbers**. Six spellings of thirty account for exactly the 90 rows at unit value 30. Group
on the string and one rung splits six ways.

---

## CARD 6 — 🔴 A RANGE IS SHOWN AND REFUSED, NEVER GIVEN AN END
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. Find **Mexican Buckeye** — its size is `10/15 gallon`.

**PASS:** it is in the refused list, and the sentence **names BOTH ends** — *"names a range (10–15).
It has no single size, so it cannot be planned until somebody says which it is."*
**FAIL:** it appears in the grid as a 10 or as a 15, or the message names only one end.

*(Four such rows are live at LAWNS today.)*

---

## CARD 7 — the four-way split, and the arithmetic you already had
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. On **Joan Lionetti Texas Live Oak** (220 on hand), type **45** into *Going to*.
2. Read across: **Keep**, **Cushion**, **Could pot**, **UPPOT NOW**.

**PASS:** *Keep* = sales-a-month × cover months, *Cushion* = 10% of on-hand, *Could pot* = on hand
minus both, and *UPPOT NOW* defaults to the whole of *Could pot*.
**FAIL:** any of the four is blank, or *UPPOT NOW* starts at zero.

3. Look at the check band at the top of the screen.

**PASS:** it reads **"Mix to fill a 15-gallon pot: $7.85 — you had $7.85"** with a tick.
**FAIL:** it is missing, or the 15-gallon figure is not $7.85.

⚠️ **THE 30-GALLON ROW WILL READ `$15.70 — you had $15.71 (+0.01)` AND THAT IS A PASS.** The cent
is in the original arithmetic, not ours: $151 a yard reproduces $7.85 exactly and $15.70004 at
thirty. The tolerance is one cent, declared in code, and **the screen still prints the cent rather
than absorbing it**. A zero-tolerance check would have shipped red on day one against the exact
configuration you ruled, and a false red on the one indicator built to tell you the model works
would teach you to ignore it.

---

## CARD 8 — 🔴 BATCH SIZE IS THE LEVER, AND THE SCREEN PROVES IT
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. With a plan on screen, note **Crew hours** in the right-hand panel.
2. Change **Pots per run** from 40 to **10**. Note the hours.
3. Change it to **120**. Note the hours.

**PASS:** the hours change substantially — smaller runs cost more per pot — and the line under the
box reads *"At 10 pots a run that is 9.0 minutes a pot"* and *"at 120… 3.5 minutes a pot"*.
**FAIL:** the hours do not move, or the per-pot figure stays the same at every batch size.

🔴 **THIS IS THE WHOLE OF THE SETUP-PLUS-HANDLING FINDING IN ONE INTERACTION.** A flat 3-minutes-a-pot
model gives the identical number at both, and the lever you actually control becomes invisible.

---

## CARD 9 — every number says what it is worth
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. Read the right-hand panel under **Crew hours**.

**PASS:** it carries a small word — **GUESS** — and a sentence naming the assumption, e.g.
*"234 pots at batches of 40, at 6 productive hours a day."*
**FAIL:** a bare number with no basis line, or **Crew hours** labelled **FACT**.

🔴 **CREW HOURS MUST READ `GUESS`, NOT `SUGGESTION`.** The pot count is a fact and the rate is a
suggestion, but productive-hours-a-day is a guess — and a total is only as good as its worst input.
Labelling it anything better is the laundering that makes the first correction feel like a betrayal.

---

## CARD 10 — the pot cascade, and the money in the sequence
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. Set targets on several varieties across different rungs (3→15, 15→30, 30→45).
2. Read the **Pots** block in the right-hand panel.

**PASS:** it names a down-the-ladder buy figure, a worst-order figure, and **the difference as pots
saved by sequence alone** — *"same work, same trees, same window."* The table lists each size with
Need / Freed / Reuse / Buy, **largest size first**.
**FAIL:** the rungs are listed smallest-first, or *Buy* at the top rung is anything other than the
full *Need* (nothing above the highest rung is being emptied).

---

## CARD 11 — the window, and the crew that will actually be there
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE · **needs the migration** (Settings must save)

1. Go to **Settings → Operations**. Set **Window opens** 2026-11-14, **Window closes** 2027-02-14,
   **Last day the seasonal staff are here** 2026-11-26. Save.
2. Return to the plan.

**PASS:** the panel says **two people**, and gives the reason — *"the seasonal staff leave on
2026-11-26 and the window runs past it."*
**FAIL:** it says four people.

3. Now set **Window closes** to 2026-11-20 and reload the plan.

**PASS:** a red block appears saying the plan runs past the window, naming the last completion date
AND the window end — **before you commit anything**.
**FAIL:** no warning, or it appears only after committing.

---

## CARD 12 — a manager's typed number is respected, and a capped one says so
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. On a row whose *Could pot* is 144, type **50** into **UPPOT NOW**.

**PASS:** *Still sellable* rises by the difference, and the totals, mix, pots and hours all move together.
**FAIL:** any of them keeps the old figure.

2. Now type **900** into the same cell.

**PASS:** a small red line under the cell reads **"capped at 144"**.
**FAIL:** it silently accepts 900, or silently shows 144 with no note that your number was not used.

---

## CARD 13 — 🔴 COMMITTING HOLDS THE STOCK, AND THE SCREEN SAYS SO IN TREES
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
🖱 NEEDS INTERACTION · **needs the migration**

1. Build a plan of a few hundred trees.
2. Type a sentence into **Why this plan?**
3. Press **Commit the plan — hold N trees**.

**PASS:** a green line reports the plan committed, names the number of trees and the number of
batches, and says they **"are now held for uppotting and are no longer offered for sale."**
**FAIL:** it reports success with no number, or it reports success and the next card fails.

---

## CARD 14 — 🔴 THE HELD STOCK IS GONE FROM WHAT YOU CAN SELL, AND THE SENTENCE NAMES WHY
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
🖱 NEEDS INTERACTION · **needs the migration**

Immediately after CARD 13.

1. Go to **Inventory** and find a lot you just held.

**PASS:** its availability is lower by exactly the number you held, and the sentence names the
hold — *"… on hand, … held for uppotting"* — rather than just showing a smaller number.
**FAIL:** availability is unchanged, or it dropped with no explanation of where the trees went.

🔴 **THE SENTENCE IS THE CARD.** A lot that reads "36 available" when you can SEE 220 standing there
reads as a bug. The hold is the one claim nobody would guess, because production took it rather
than a customer.

---

## CARD 15 — 🔴 NOTHING WROTE A `held_qty` ANYWHERE
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER (SQL editor) · **LAST-PROVEN:** —
📄 PRINT-PROVABLE · **needs the migration**

In the SQL editor, after CARD 13:

```sql
SELECT column_name FROM information_schema.columns
WHERE table_name = 'business_inventory'
  AND column_name IN ('held_qty','held_for_uppot','uppot_hold','production_hold');
```

**PASS:** **zero rows**, while CARD 14 has just shown the hold working.
**FAIL:** any row. The hold has become a stored number that can drift from the plan that made it.

---

## CARD 16 — cancelling a plan gives the trees back
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER (SQL editor) · **LAST-PROVEN:** —
🖱 NEEDS INTERACTION · **needs the migration**

1. Note a held lot's availability.
2. In the SQL editor: `UPDATE production_plans SET status = 'cancelled' WHERE id = '<the plan id>';`
3. Reload Inventory.

**PASS:** availability returns to its pre-commit figure, and the hold sentence no longer mentions uppotting.
**FAIL:** the stock stays held.

*(There is deliberately no UI cancel button yet — that is named in the not-covered list.)*

---

## CARD 17 — Settings → Operations saves, and refuses honestly when it cannot
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
🖱 NEEDS INTERACTION · **needs the migration**

1. Go to **Settings → Operations**. Change **Minutes to handle one pot** from 3 to 4.

**PASS:** the Save button becomes active only once something changed, and the copy says
**"Changes save when you press Save, not as you type."**
**FAIL:** the value writes as you type, or Save is active before you touch anything.

2. Press Save, then reload the page.

**PASS:** the 4 is still there, and the message says plans already committed keep the numbers they
were built with.
**FAIL:** it reverts to 3, or it reported success and did not persist.

---

## CARD 18 — 🔴 THE MANAGER CAN PLAN AND COMMIT
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** **MANAGER** · **LAST-PROVEN:** —
🖱 NEEDS INTERACTION · **needs the migration**

Sign in as the MANAGER account at LAWNS (the third `business_members` row).

**PASS:** `/inventory/uppot` opens, the grid renders, and **Commit the plan** is a live green button.
**FAIL:** the route bounces to the dashboard, or Commit is locked.

*(Measured 2026-09-05: MANAGER holds `inventory:read`, `inventory:create`, `inventory:update`. This
is the production manager's screen and it must work for him without a new permission.)*

---

## CARD 19 — 🔴 THE MANAGER SEES THE MIX COST AND NOT THE WAGES
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** **MANAGER** · **LAST-PROVEN:** —
📄 PRINT-PROVABLE · **needs the migration**

Still as the MANAGER.

1. On the plan, read **Mix cost** in the totals panel.

**PASS:** a real dollar figure with a basis line beneath it.
**FAIL:** it reads `—`, or `$0.00`.

2. Read the note at the foot of the panel.

**PASS:** it says labour rates and pot prices are **withheld** and that this is *"a redaction, not a zero."*
**FAIL:** a labour rate is visible, or a withheld figure renders as **$0.00**.

🔴 **$0.00 IS THE FAILURE THAT LOOKS LIKE A PASS.** A redaction rendered as a real figure makes
every cost on the screen wrong and confident.

---

## CARD 20 — 🔴 STAFF MAY LOOK AND MAY NOT HOLD
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** **STAFF** · **LAST-PROVEN:** —
🖱 NEEDS INTERACTION · **needs the migration**

⚠️ **NEEDS A STAFF MEMBER WHO DOES NOT EXIST AT LAWNS TODAY** — LAWNS has two OWNERs and one
MANAGER. Create one at Test Dave's, or run this impersonated in the SQL editor.

1. As STAFF, open `/inventory/uppot`.

**PASS:** the screen opens and the plan is fully readable.
**FAIL:** the route bounces.

2. Look at the Commit button.

**PASS:** it is disabled **with a sentence** — *"You can look at this plan and you cannot commit
it. Holding stock takes it off the market…"* — not simply missing.
**FAIL:** the button is absent with no explanation, or it is live.

3. Force the write in the SQL editor, impersonated as the staff user:
```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub":"<the staff user_id>"}';
INSERT INTO production_plans (business_id, name, status) VALUES ('<tenant>', 'x', 'open');
RESET ROLE;
```
**PASS:** the insert is **REFUSED** by policy.
**FAIL:** it succeeds. The button was the only lock, which is not a lock.

---

## CARD 21 — a failed commit leaves nothing half-held
**STATUS:** needs-test · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —

**REASON IT IS `needs-test`:** provoking a partial write means making the LINE insert fail while the
PLAN insert succeeds, and there is no supported way to do that from the UI. It is covered by
`productionPlan.test.ts` and by mutants at the unit level, and the row-count check that drives it
was caught as unchecked by `verify-zero-row-writes` and fixed. **What a live proof would need:**
temporarily revoking insert on `production_plan_lines` while leaving it on `production_plans`.
Recording the hole rather than pretending the code path is proven.

---

## NOT COVERED BY ANY CARD — stated so it is not mistaken for done

- 🔴 **BATCH COMPLETION IS NOT BUILT.** `production_plan_lines` carries `completed_date`,
  `completed_by`, `qty_completed` and `backdate_reason`, the rules are written and tested
  (`validateCompletion`), and **there is no button.** A batch is completed in SQL today. The ledger
  rows and the audit row that ride on completion are therefore **not built either** — this build
  ships the hold, not the movement.
- 🔴 **THE SEVEN-DAY FLAGS ARE COMPUTED AND NOT RENDERED.** `flagsFor` is written, tested and
  mutant-proven; no screen calls it, because the surface it belongs on is the OWNER's and that
  placement is an open question (see the ledger row).
- **No UI cancel** for a committed plan — CARD 16 uses SQL.
- **No sales-a-month.** Every *Keep* figure computes from a null sales rate today, so it is zero
  until somebody types one. That is stage ④ and is not built.
- **G1/G3/G4/G5 on the grid** — no sticky header, no frozen column, no sort, no search. Declared in
  `docs/decisions/ui-standard-divergences.json` and honest at 18 rows; real at 447.
- **E4 on Settings → Operations** — the dirty check reads the on-screen copy, not the persisted
  value, so re-typing the same number still enables Save. Over-saves rather than under-saves.

> ⚠️ **THE STORY GATE IS PARTLY OPEN, AND IT IS NOT CLOSED BY INVENTING A STORY.**
> *The growing ladder* covers the ladder, the intervals and the dates, and it states the very gap
> this build closes: *"Today the platform would call an under-production block available, because
> anything on hand and uncommitted computes as sellable."* Its `NEEDS:` line asks David to rule
> **"whether up-potting is modelled as a transformation or as a movement out and in"** — which his
> 2026-09-05 prompt answers (movement out and in). **What no story covers is the four-way split
> itself** — must-keep, cushion, delta, uppot-now. That half is owed and is David's to dictate.
