# OWNER TEST — UPPOT PLANNING: THE SPLIT, THE HOLD, AND WHAT THE PLAN COSTS

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** Anything else is **not production**, and the SHA being
> right does not rescue it: an amber **`PREVIEW <branch>`** chip, an amber **`prod⚠ <branch>`**
> (production, but built from a branch), **`env?`** (target unknown), or **`local`**. **A preview
> serves the RIGHT CODE at the WRONG TARGET — the stamp's SHA matches and the screen is still not
> evidence.** That is tech-debt **#280 ②**, and ledger **#303** was recorded complete on
> preview-only deploys. **If the chip is amber, stop.** *(ledger #321.)*
> *(GATE 0 · OP-15.)*

**Capability:** ⚠️ **NONE — this surface carries no id on the 24-capability board.** Not minted here.
**Story:** `user_stories.md` → *The growing ladder — potted, waiting, ready, and up a size*
(`STATUS: needs-input`). ⚠️ **THE STORY GATE IS PARTLY OPEN AND IS NOT CLOSED BY THIS BUILD** — see
the note below CARD 21.
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 36 covered** ✏️ **+3 on 2026-09-23 (ledger #391) — CARD 34 a production size reads "not sold at this size", CARD 35 the potting date and its history, CARD 36 the uppot window and its dated history. ⛔ They wait on `20260924a` · `20260924b` · `20260924c` respectively.** ✏️ **+2 on 2026-09-23 (ledger #390) — CARD 32 GROW and HOLD on the ladder, CARD 33 the graduation date on the plan. ⛔ Both wait on `20260923h_container_ladder_grow_and_hold.sql` plus the step-0 SQL.** ✏️ **+1 on 2026-09-18 (ledger #356) — CARD 31, caliper on the ladder. ⛔ Its migration `20260918c_container_ladder_caliper.sql` is NOT APPLIED; CARD 31 and the Container sizes screen wait on it.** (28 `owed` · 2 `needs-test`). ✏️ **+6 on 2026-09-14 (ledger #326) — the container ladder.** ✏️ **+3 on 2026-09-16 (ledger #343) — the Container sizes screen, Planting materials, and the rung starting size; CARD 22 changed and stays owed.**
**TENANT:** every card names its own. Most run at **Test Dave's Tree Nest**
(`f7ec5d67-a9ef-4cb0-b807-438d67687d1b`) — see the seed gate. Three run at **LAWNS**
(`ed2e5933-45dc-4b9b-a331-ddfd125e7a74`) and say so.
**ACTOR:** every card names its own. Most are the **OWNER**; CARDS 18–20 need a **MANAGER** and a
**STAFF** member.
**DEVICE:** all cards `DEVICE: desktop`. This is a planning-and-reconcile surface, and reconcile is
desktop (capture=mobile / reconcile=desktop).

---

> ✏️ **MIGRATION GATE — CORRECTED 2026-09-14 (ledger #326): `20260905_production_planning.sql` IS APPLIED.**
> **MEASURED against the catalog**, not assumed: `to_regclass` returns non-null for all three of
> `business_operations_config`, `production_plans` and `production_plan_lines`, and
> `production_plan_lines` carries its full 19-column shape. **All three are 0 rows — applied, never
> written to.** 🔴 **CARDS 8–17 ARE THEREFORE NO LONGER GATED**, and this block said they were for
> three days. Tech-debt **#253** carried the same false claim and is corrected with it.
> ⚠️ **What follows is the ORIGINAL gate text, preserved so the correction is legible.** Every claim
> in it about the tables NOT existing is now false; the §6 r17 instruction about the SQL editor
> stands and applies to the NEW ladder migration below.
>
> ⛔ ~~**MIGRATION GATE — `supabase/migrations/20260905_production_planning.sql` IS NOT APPLIED.**
> **CARDS 8 THROUGH 17 CANNOT PASS WITHOUT IT.** It creates three tables:
> `business_operations_config`, `production_plans`, `production_plan_lines`.~~
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

---

# THE CONTAINER LADDER — CARDS 22–27 (ledger #326, 2026-09-14)

> ✅ **MIGRATION GATE — `supabase/migrations/20260914_container_ladder.sql` IS APPLIED (David, 2026-09-16).**
> He ran the verify block: V1 — 12 columns (id, business_id, label, aliases, sort_order, volume_gallons, handling_minutes, handling_because, active, retired_at, created_at, updated_at) · V2 — RLS on, exactly three policies: container_ladder_member_select (r), container_ladder_settings_insert (a), container_ladder_settings_update (w), no delete · V3 — nine LAWNS rungs: slip (no volume) · 4 in (no volume) · 3/5 gal (4; aliases "#3/5", "3/5 Gallon") · 15 · 30 · 45 · 65 · 95/100 (95; aliases "95 gal", "100 gal", "95 gallon", "100 gallon") · 200 · V4 — a second "15 GAL" refused by container_ladder_business_label_key. The catalog check lists it APPLIED. **CARDS 22–27 are unblocked.**
> ✏️ Corrected by ledger #343 — this gate said NOT APPLIED after the migration had run (the #336 class).
> The text below is kept for the next tenant: it creates `public.container_ladder` and seeds LAWNS's
> nine rungs (slip · 4" · 3/5 gal · 15 · 30 · 45 · 65 · 95/100 · 200).
>
> Apply it **as `postgres`, in the SQL EDITOR — never the dashboard TABLE EDITOR** (§6 r17: the
> table editor's `supabase_admin` default ACL grants TRUNCATE + REFERENCES to `anon`, and RLS
> cannot filter TRUNCATE). **This migration CREATES A TABLE, so that rule is load-bearing here.**
>
> **Nothing breaks meanwhile and the failure is honest:** with no table the ladder read fails, the
> screen says so in a red banner, and planning falls back to reading sizes as plain numbers —
> exactly as it did before this build. **It does not silently pretend the nursery has no sizes.**
>
> Then run **V1–V5** at the foot of the migration file.

## CARD 22 — the ladder is read, and the picker offers RUNGS instead of a spinner
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. Open the uppot plan screen at **LAWNS**.
2. Find any row whose size is **15 gal** and look at the **target size** cell.

**PASS:** it is a **dropdown**, and opening it offers **30 gal · 45 gal · 65 gal · 95/100 · 200 gal**
— and nothing else.
**PASS also — ✏️ changed 2026-09-16 (ledger #343):** the **In now** cell shows the row's starting volume
from its SIZE (**15**) with the size name **15 gal** beneath it.
**FAIL:** it is still a number box with up/down arrows, or the list offers sizes at or below 15.

🔴 **WHY THIS IS THE HEADLINE CARD.** The control was `<input type="number">` with no `min`, no
`step` and no list. **Getting 15 → 30 was fifteen presses of a spinner, and nothing stopped a plan
landing on 47** — a container nobody sells, which then costs mix, pots and hours against a pot that
does not exist. **Try to type 47. You should not be able to.**

---

## CARD 23 — 🔴 "3/5 Gallon" IS ONE RUNG, AND TWO REAL LAWNS TREES DEPEND ON IT
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. Find **Cedar Elm** and **Native Pecan** — both carry size **`3/5 Gallon`**.

**PASS:** both are in the **GRID**, plannable, showing a target-size dropdown.
**FAIL:** either appears in the refused list saying its size *"names a range … it cannot be planned
until somebody says which it is."*

🔴 **WHY.** Before this build the parser read `3/5` as a RANGE 3→5 and refused it. Terry's position
(R-71 ③) is that **the difference between #3 and #5 is only pot height — it is one bucket**, and the
ladder now says so. These are the two rows David named: `Elm:CE5` and `Pecan:NP5`.

---

## CARD 24 — 🔴 A SIZE THAT READS BUT IS NOT YOURS GETS ITS OWN LIST
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. Scroll to **"lots cannot be planned"**.

**PASS:** a panel reads **"N of those read fine — they are just not one of your container sizes"**,
listing the sizes **grouped, with a count each** — expect **`3 gal` (53) · `5 gal` (34) · `1 gal` (24)
· `7 gal` (21) · `2 gal` (7) · `10 gal` (2) · `300 gal` (1)** or similar.
**FAIL:** these are mixed in with the unreadable-size refusals, or they say *"has not been read as a
unit yet."*

⚠️ **`3 gal` and `5 gal` MAY NOT APPEAR** — they fold onto the `3/5 gal` rung by derived key, which
is correct. **If they are absent, that is a PASS, not a miss.**

🔴 **WHY.** Measured 2026-09-14: **121 live LAWNS rows** carry a size that reads perfectly and is not
one of the nine rungs. Telling their owner the size is *unreadable* sends them to the wrong fix.
**Each entry is one decision — add the rung, or correct the rows — which is why it groups by SIZE
and not by lot.**

---

## CARD 25 — 🔴 NOTHING ON HAND IS THE REASON GIVEN, NOT THE SIZE
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's · **ACTOR:** OWNER · **LAST-PROVEN:** —
📄 PRINT-PROVABLE

1. Open the plan screen at **Test Dave's Tree Nest**.
2. Look at the refused list.

**PASS:** the rows with nothing on hand say **"Nothing on hand — there is nothing to uppot, whatever
its size."**
**FAIL:** they say *"has not been read as a unit yet"* — the old, wrong reason.

🔴 **WHY.** Measured 2026-09-14: **97 of Test Dave's 99 unplannable rows are catalogue rows carrying
no size AND no stock.** David: *"a row with zero on hand cannot be planned whatever its size."*
Telling somebody to fix a size on a row holding nothing sends them to work that changes nothing.
⚠️ **A never-counted row must still say "Never counted — this is not a count of zero"** (CARD 3). If
those two now read the same, that is a FAIL — zero is an answer, null is an unanswered question.

---

## CARD 26 — 🔴 A RETIRED RUNG STILL RESOLVES AND IS NEVER OFFERED
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** OWNER · **LAST-PROVEN:** —

Run this in the SQL editor, then reload the screen:

```sql
-- retire the 65 gallon rung
UPDATE public.container_ladder SET active = false
 WHERE label = '65 gal'
   AND business_id = (SELECT id FROM public.businesses WHERE name = 'LAWNS Tree Farm, LLC');
```

1. Open a **45 gal** row's target dropdown.

**PASS:** it offers **95/100** and **200 gal** — **65 gal is GONE from the list.**
**FAIL:** 65 gal is still offered.

2. Now find a row whose size **is** `65 gal` (44 such rows are live).

**PASS:** it is **still in the grid, still plannable** — it resolved to the retired rung.
**FAIL:** it has moved into the refused list saying its size is not one of your container sizes.

Then put it back:
```sql
UPDATE public.container_ladder SET active = true
 WHERE label = '65 gal'
   AND business_id = (SELECT id FROM public.businesses WHERE name = 'LAWNS Tree Farm, LLC');
```

🔴 **WHY BOTH HALVES.** R-133: retire never means delete. **Resolving and offering are different
questions and only one of them filters** — if a retired rung stopped resolving, every past lot and
past order pointing at it would become unreadable, which is deletion by another name.

---

## CARD 27 — a clashing ladder says so instead of picking one silently
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** OWNER · **LAST-PROVEN:** —

```sql
-- add a 5 gal rung beside the existing 3/5 gal one, which already claims 5
INSERT INTO public.container_ladder (business_id, label, sort_order, volume_gallons)
SELECT id, '5 gal', 35, 5 FROM public.businesses WHERE name = 'LAWNS Tree Farm, LLC';
```

1. Reload the plan screen.

**PASS:** a red banner reads **"Two of your container sizes clash"** and names **`3/5 gal` and
`5 gal` both claim the number 5**.
**FAIL:** no banner, and lots of size `5 gal` quietly land on one of the two.

Then remove it:
```sql
DELETE FROM public.container_ladder
 WHERE label = '5 gal'
   AND business_id = (SELECT id FROM public.businesses WHERE name = 'LAWNS Tree Farm, LLC');
```
⚠️ **That DELETE runs as `postgres` in the SQL editor. The app itself has NO delete policy at all** —
retiring from a screen is an UPDATE, by design.

🔴 **WHY.** Two rungs claiming one number makes which rung a lot lands on **an accident of row
order** — the silent, order-dependent wrong answer the whole ladder exists to remove (R-96's shape:
two things that collide both get flagged).

---

# LEDGER #343 — THE LADDER IS THE ONE SOURCE (2026-09-16)

> ✅ **`20260916_container_ladder_install_t_posts.sql` IS APPLIED** (David, 2026-09-16–17; V1–V4 all pass)
> and the code is **merged `56107ee`**. CARDS 28–30 can run.

## CARD 28 — 🔴 SETTINGS → CONTAINER SIZES: ADD, EDIT, MOVE, RETIRE — AND NEVER DELETE
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** OWNER · **LAST-PROVEN:** —
COVERS: ledger #343 · SIGNAL: `[TRACE:LADDER] add size` / `edit size` / `move size` / `retire/restore size`

1. Open **Admin → Container sizes** (`/settings/container-sizes`).
   **PASS:** nine sizes in order — slip · 4 in · 3/5 gal · 15 gal · 30 gal · 45 gal · 65 gal · 95/100 · 200 gal —
   each showing its volume, handling time and **T-posts at install with where the figure came from**
   (*LAWNS, David 2026-09-12*). There is **no Delete button anywhere**.
2. Press **+ Add a size**.
   **PASS:** the T-posts box already reads **4**, bordered amber, with **"copied — confirm — copied from 200 gal.
   Saving confirms it."** The Add button stays disabled and says **"A size needs a name."**
3. Type name **7 gal**, volume **7**, change posts to **2**, source **Terry, by phone**, press **Add size**.
   **PASS:** a green line says it was added; **7 gal** appears at the END of the list with *2 T-posts at install
   (Terry, by phone)*.
4. Press **↑** on 7 gal until it sits between **3/5 gal** and **15 gal**.
   **PASS:** it moves one place per press and stays there after a reload.
5. Press **Edit** on 7 gal, change volume to **7.5**, Save. **PASS:** the row shows **7.5 gal** after a reload.
6. Try **+ Add a size** with name **15 GAL**. **PASS:** refused in red — *"already a size here … if it is retired,
   bring it back instead."*
7. Press **Retire** on 7 gal. **PASS:** it greys out and reads *retired*; the button now says **Bring back**.
   The uppot picker no longer offers it (CARD 26's check).

**FAIL:** a Delete appears; a copied figure is not marked as copied; a refused save says "Saved".
⚠️ Leave 7 gal RETIRED at the end — or delete it in the SQL editor as `postgres`; the app cannot.

## CARD 29 — SETTINGS → OPERATIONS → PLANTING MATERIALS
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** OWNER · **LAST-PROVEN:** —
COVERS: ledger #343 · SIGNAL: `[TRACE:UPPOT] operations settings saved`

1. Open `/settings/operations`.
   **PASS:** a **Planting materials** group lists, in plain words (no key names):
   *Special mix per gallon of container, when planting (gallons)* **2** · *Rope per T-post (feet)* **4** ·
   *Bubblers per planted tree* **1** · *T-posts on a deer-fenced tree, in total* **4** — each with a provenance line
   (**FACT — LAWNS, David 2026-09-15; corrects an earlier 1.0 that was Lightning's** on the mix).
2. Set the mix to **0** and Save. **PASS:** *"Not saved — … must be more than 0 — a tree is never planted with no mix."*
3. Set it back to **2** and Save. **PASS:** *"Saved."*, and it survives a reload.

**FAIL:** a key name shows; a 0 ratio saves.

## CARD 30 — 🔴 A 3/5 LOT STARTS FROM THE SIZE'S 4 GALLONS, NOT ITS TEXT
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** OWNER · **LAST-PROVEN:** —
COVERS: ledger #343 — the uppot starting size is the rung's volume

1. On the uppot plan, find **Cedar Elm** or **Native Pecan** (size *3/5 Gallon*).
   **PASS:** **In now** reads **4** with **3/5 gal** beneath it (it used to read 3).
2. Pick **15 gal** as the target and look at **Mix yd³**. **PASS:** it is the mix for an **11-gallon** step
   (15 − 4), not a 12-gallon one.
3. A `#3` lot and a `5 gal` lot of the same variety both read **4**.

**FAIL:** In now shows 3 or 5 for a 3/5-size lot.

---

## CARD 31 — 🔴 CALIPER ON THE LADDER: EACH SIZE CARRIES ITS TRUNK CALIPER, READ AT THE NURSERY'S OWN HEIGHT
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** OWNER · **LAST-PROVEN:** —
COVERS: ledger #356 — David, 2026-09-18: *"the trade measure LAWNS buys and sells on, and the real graduation test"*

✅ **APPLIED 2026-09-20 by David — V1–V4 all pass** (three columns with the honest default · the 45 gal max-below-min UPDATE refused by `container_ladder_caliper_range_check` and rolled back · nine rungs with calipers and provenance · `caliperMeasuredAtInches` 12 with its because line). Measured live afterwards: 3/5 1.0 · 15 1.25 · 30 1.5–2.5 · 45 2.5–3.5 · 65 3.5–4.5 · 95/100 4–5 · 200 5+, slip and 4 in not recorded.

🔴 **WHEN A V-BLOCK EXPECTS A REFUSAL, THE ERROR IS THE PASS.** David, 2026-09-20: *"V2's expected-failure line reads as a real error in the SQL editor output… I did [stop there]."* A V-step that ends `-- EXPECT: … violates check constraint …` has PASSED when the SQL editor shows that red error and the transaction rolls back; it has FAILED if the UPDATE succeeds. Read the constraint NAME in the error: it must be the one the step names.

⛔ **THE MIGRATION GATE, for anyone running this on another tenant: `supabase/migrations/20260918c_container_ladder_caliper.sql` must be applied first** (SQL editor, as postgres, whole file), then its V1–V4 pasted back. **Until it is, do not merge `feat/ladder-caliper`** — the ladder reader asks for the new columns, and every ladder read would fail.

1. **Settings → Container sizes.** **PASS:** each size's line ends with its caliper, exactly:
   **3/5 gal — caliper 1 in · 15 gal — caliper 1.25 in · 30 gal — caliper 1.5–2.5 in · 45 gal — caliper 2.5–3.5 in · 65 gal — caliper 3.5–4.5 in · 95/100 — caliper 4–5 in · 200 gal — caliper 5 in and up**, each followed by *(LAWNS, David 2026-09-18 — measured 12 in above the soil line)*. **slip** and **4 in** say **caliper not recorded**.
2. Click **Edit** on **45 gal**. **PASS:** three new boxes — **Smallest caliper (inches) 2.5**, **Largest caliper (inches) 3.5**, **Where the caliper came from**.
3. Type **2** in *Largest*. **PASS:** red text **"The largest caliper is below the smallest."** and **Save size** is greyed. Put **3.5** back and press **Cancel**.
4. **Settings → Operations → Trees.** **PASS:** **Caliper measured at (inches above the soil) — 12**, and beside it **SUGGESTION — ANSI Z60.1 measures at 6 in (12 in once caliper passes 4 in) — set your own; LAWNS measures at 12**.

**FAIL:** any size shows a caliper of 0 · a blank where "not recorded" should be · the height reads 6 for LAWNS · Settings → Container sizes says **Could not read the sizes** (the migration is not applied).

---

## CARD 32 — 🔴 GROW AND HOLD ON THE LADDER: EACH SIZE CARRIES HOW LONG IT TAKES, AND AN UNMEASURED SIZE SAYS SO
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** OWNER · **LAST-PROVEN:** —
COVERS: ledger #390 — David, 2026-09-01: GROW = months from uppotting until SELLABLE on that rung; HOLD = months it then stays before the next uppot. Lauren: *"It takes six to eight months to grow into their pots, and then they can live in their pots for say a year."*

⛔ **MIGRATION GATE — `supabase/migrations/20260923h_container_ladder_grow_and_hold.sql` must be applied first**, then `docs/decisions/2026-09-23-lawns-grow-ladder-step0.sql`. Both in the SQL editor, as `postgres`, whole file. **Until the first is applied every ladder read fails** — the reader asks for the new columns — so do not merge this branch before applying it.

🔴 **WHEN A V-BLOCK EXPECTS A REFUSAL, THE ERROR IS THE PASS** (CARD 31's lesson, David 2026-09-20). V3 in the migration's foot is a deliberate refusal: a red **`violates check constraint "container_ladder_grow_months_check"`** and a rolled-back transaction is a PASS. It has FAILED if the UPDATE succeeds.

1. **Settings → Container sizes.** **PASS:** every size still shows its label, volume, T-posts, caliper and install price exactly as before — nothing moved.
2. Click **Edit** on **15 gal**. **PASS:** two new boxes below the install price — **Months to GROW — potted until sellable** holding **6**, and **Where the grow figure came from** holding *David, 2026-09-18 — a 15 gal is sellable at the uppot-to-15 date plus six months. Terry to confirm or correct.* **Months to HOLD** is **blank**, with placeholder **unknown**.
3. Click **Edit** on **30 gal**. **PASS:** **Months to GROW is BLANK**, placeholder **unknown**, and the note beside it reads *"Blank means nobody has measured it — the plan then says UNKNOWN instead of showing a date built on a guess."* 🔴 **It must NOT read 7.**
4. Still on **30 gal**, type **0** into *Months to GROW*. **PASS:** red text **"A grow of 0 months would make a tree sellable the day it is potted. Leave it blank if nobody has measured it — the schedule then says UNKNOWN."** and **Save size** is greyed. Clear the box and press **Cancel**.
5. Type **9** into *Months to HOLD* on **30 gal**, clear *Where the hold figure came from*, and try to save. **PASS:** red text **"Say where the hold figure came from — even 'not set'."**. Press **Cancel** — do not save.

**FAIL:** any size shows GROW **7** · a blank where **6** should be on the 15 gal · a **0** accepted · Settings → Container sizes says **Could not read the sizes** (the migration is not applied).

---

## CARD 33 — 🔴 THE PLAN SAYS WHEN THE TREES BECOME SELLABLE — AND NAMES THE RUNG WHEN IT CANNOT
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** LAWNS · **ACTOR:** OWNER · **LAST-PROVEN:** —
COVERS: ledger #390 — the graduation date `planLots` has computed on every batch since ledger #276 and which NOTHING has ever rendered. David, 2026-09-23: *"The other eight rungs are UNKNOWN and render as UNKNOWN. Never 7 by default."*

⛔ Needs CARD 32's migration **and** the step-0 SQL applied (the step-0 file sets the uppot window; without it every row reads **no uppot window set**, which is a different and also correct answer).

1. **/inventory/uppot.** **PASS:** the table has a new last column headed **Sellable from**.
2. Find a lot sitting at **3/5 gal** and set **Going to** = **15 gal**, then type a number into **UPPOT NOW**. **PASS:** **Sellable from** shows **a date**, and under it **N trees · 6 mo on 15 gal**. 🔴 The date must be the batch's FINISHING day plus six months, not its start (R-88).
3. Find a lot at **15 gal** and set **Going to** = **30 gal**. **PASS:** **Sellable from** shows, in red, **UNKNOWN — nobody has set GROW on the 30 gal rung**, with **Settings → Container sizes** beneath it. 🔴 **It must NOT show a date.**
4. **PASS:** the **UPPOT NOW**, **Still sellable**, **Mix yd³**, **Hours**, the totals strip and the pot-cascade line are all unchanged from before this build.
5. Go to **Settings → Container sizes**, set **30 gal** GROW to **8** with a reason, save, and return to **/inventory/uppot**. **PASS:** that same row now shows a date and **8 mo on 30 gal**. Set it back to blank afterwards — 🔴 **8 is not Terry's number and must not be left in the database.**

**FAIL:** the column is missing · an unmeasured rung shows a date · a date appears with no trees count · **Sellable from** reads **—** for every row with the window set (that is the old, silent behaviour).

---

## CARD 34 — 🔴 A PRODUCTION SIZE READS "NOT SOLD AT THIS SIZE", NEVER "UNKNOWN"
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's Tree Nest (`f7ec5d67-a9ef-4cb0-b807-438d67687d1b`) · **ACTOR:** OWNER · **LAST-PROVEN:** —
COVERS: ledger #391 — David, 2026-09-23, ruling 4, decided from the customer's contrarian seat: a never-sold rung is a SETTLED fact, not a missing measurement, and calling it UNKNOWN sends somebody to fill in a number that should not exist.

⛔ Needs `20260924b_rung_sellability.sql` applied. CARDS 32–33 (ledger #390) should be proven first — this builds on their column.

1. **Settings → Container sizes → Edit** on any size. **PASS:** a new **Is this size sold?** picker with exactly three choices — *Sold at this size* · *Sold at this size, but rarely* · *Never sold — a production size only* — and a **Why** box beside it. Every existing size reads **Sold**.
2. Choose **Never sold**, leave **Why** empty, press **Save size**. **PASS:** red text **"Say why this size is never sold — it stops the plan ever giving it a sellable date."** and the save is refused.
3. Type a reason (*"production only — stock passes through"*) and save. **PASS:** it saves.
4. **/inventory/uppot.** Put a lot on a plan whose **Going to** is that size. **PASS:** **Sellable from** reads, in **grey**, **not sold at this size (<the size>)** with **a production size — stock passes through it** beneath. 🔴 **It must NOT say UNKNOWN, and there must be NO link to go and set anything** — there is nothing to set.
5. Set that same size's **Months to GROW** to **6** and return. **PASS:** it STILL reads **not sold at this size** — 🔴 the settled fact wins over the measurement. Put the size back to **Sold** afterwards.

**FAIL:** a never-sold size shows UNKNOWN · it shows a date · it offers a "set GROW" link · the picker has two options or free text.

---

## CARD 35 — 🔴 LAWNS SETS ITS OWN POTTING DATE, AND EVERY ENTRY IS KEPT
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's Tree Nest · **ACTOR:** OWNER, then a MANAGER and a STAFF member for step 6 · **LAST-PROVEN:** —
COVERS: ledger #391 — David, 2026-09-23, rulings 1 and 2: the date is ENTERED, never derived; each entry or edit ADDS A ROW; nothing is overwritten; current is the latest.

⛔ Needs `20260924a_rung_entry_dates.sql` applied.

1. **/inventory/uppot.** **PASS:** a new **Potted on** column. Every row reads **not set**, in red, and is clickable.
2. Click **not set** on any lot. **PASS:** a centred sheet opens with the lot's name and size, **Potted on — not recorded**, and the line **No potting date recorded, so there is no sellable date**. Below: **Nobody has recorded a potting date for this block yet.**
3. Enter **2026-06-25**, note *"140 Cedar Creek liners landed"*, press **Add this entry**. **PASS:** *"Recorded. The earlier entries are kept — this is the current one."*, the history shows one row marked **current**, and the readiness line changes.
4. Add a second entry, **2026-07-02**, note *"Joel: it was the week after"*. 🔴 **PASS: the history now shows TWO rows, newest first, 2026-07-02 marked current and 2026-06-25 STILL THERE.** Nothing was overwritten. The **Potted on** column reads **2026-07-02**.
5. Try a date in the future. **PASS:** red **"That date is in the future — a block cannot have been potted tomorrow."** and **Add this entry** stays disabled.
6. 🔴 **Sign in as a STAFF member** (holds `inventory:read`, not `inventory:update`) and open the same sheet. **PASS:** the history and the current date are visible, and instead of the form: **"You can see this date; changing it needs permission to update inventory."** Then as a **MANAGER**: the form is present and an entry saves.

**FAIL:** a correction replaces the earlier entry instead of being added · the column shows a date the sheet disagrees with · a staff member can add an entry · the sheet says "saved" but the history does not grow (that is the RLS-refusal defect the writer exists to catch).

---

## CARD 36 — THE UPPOT WINDOW IS SET IN THE APP, AND EVERY CHANGE IS DATED
**STATUS:** owed · **DEVICE:** desktop · **TENANT:** Test Dave's Tree Nest · **ACTOR:** MANAGER (not the owner — the point is that a manager can do it) · **LAST-PROVEN:** —
COVERS: ledger #391 — David, 2026-09-23, ruling 1: LAWNS sets and adjusts its own dates, and neither the window nor the potting date may be settable only by SQL.

⛔ Needs `20260924c_operations_config_history.sql` applied.
✏️ **THE EDITOR ITSELF IS NOT NEW AND THIS CARD SAYS SO:** Settings → Operations has had **Window opens** / **Window closes** as date inputs since ledger #276. What is new is the dated history and the link from the plan. If step 1 surprises you, that is the finding.

1. **Signed in as a MANAGER**, go to **Settings → Operations**. **PASS:** **Window opens**, **Window closes** and **Last day the seasonal staff are here** are editable date boxes. Set the window to **2026-11-04 → 2026-11-12** and **Save**.
2. **/inventory/uppot**, with a lot on a plan. **PASS:** **Sellable from** now shows dates rather than **no uppot window set**.
3. Go back to Settings → Operations, change **Window closes** to **2026-11-20**, save, and return to the plan. **PASS:** the dates move.
4. 🔴 **The history.** In the SQL editor (this has no screen yet — see the flag): `SELECT config_key, old_value, new_value, changed_at FROM business_operations_config_history WHERE business_id = '<Test Dave''s>' ORDER BY changed_at DESC LIMIT 5;` **PASS:** a row for **windowEnd** showing `"2026-11-12"` → `"2026-11-20"`, and rows for the two keys set in step 1. 🔴 **There must be NO rows for the twenty-odd keys you did not touch.**
5. Press **Save** again without changing anything. **PASS:** re-run the query — **no new rows.**

**FAIL:** the window is not editable by a manager · a save writes a row per key rather than per change · a no-op save writes rows · step 4 returns nothing (the trigger did not fire).
