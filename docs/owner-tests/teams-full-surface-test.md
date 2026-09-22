# OWNER TEST — TEAMS (who goes out, and which team takes a stop)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** An amber **`PREVIEW <branch>`**, **`prod⚠ <branch>`**,
> **`env?`** or **`local`** is not production, and the SHA being right does not rescue it.
> *(GATE 0 · OP-15 · ledger #321.)*

**Capability:** 3.5 (delivery / routing) · 3.4 (scheduling)
**Story:** `user_stories.md` → *Lauren does the job twice, every delivery day*
**Build:** ledger **#362** · branch `feat/teams` · migration `20260921a_teams.sql` (APPLIED 2026-09-21)
**Tech debt this closes the first piece of:** **#345** — Saturday 2026-09-19, when routing Team 1's
four stops wiped Team 2's order, because the day had one route and the platform had no teams.
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 1 of 14 covered** (CARD 0 — David's own `20260921a` V-block, 2026-09-21). **CARDS 1–13 owed.** ✏️ **2026-09-22 (ledger #375): THE DAY'S CAPACITY ESTIMATE — CARDS 6–9.** The day suggests one team or two, shows its working, and Lauren overrides it; the estimate is SNAPSHOT append-only with the settings it used. ✅ **`20260922c` IS APPLIED, and its append-only guarantee is PROVEN ON LIVE** — David ran the probe: rewrite refused, choice recorded once, second choice refused, delete refused. ✏️ **2026-09-22 (ledger #376): THE SCHEDULE SPLIT BY TEAM — CARDS 10–13.** Each team's stops under their own heading with a **Route this team** button; a teamless section is SHOWN but gets no button, because routing it is what [[R-169]] refuses. 🔴 **CARD 13 and CARD 9 are the two that protect everyone else:** an unsplit day must look exactly as it always did, and an unrouted day must read as a FLOOR rather than as zero drive time.
**Proof behind the cards (builder, not owner):** `npm run verify:writer-registry` drives all **five**
paths and **nine** guards through the real entry points on the live schema, RLS on; deliberate breaks
are caught by `scripts/sql-harness/teams-362.mutants.py`.

> 🔴 **WHO CAN RUN WHAT, AND ON WHICH TENANT.**
> **All cards: your own login, on Test Dave's Tree Nest.** CARD 1 is desktop; CARD 4 is worth doing on the phone.
> **Not on LAWNS yet.** Setting a team on a LAWNS stop is harmless — it moves no job and tells no crew
> anything — but leave it until the route half (piece 2) is in, so the list Lauren builds is the one she keeps.

---

## CARD 0 — the database update is in
**STATUS:** covered · **DEVICE:** desktop · **LAST-PROVEN:** 2026-09-21 (David — the `20260921a` V-block, whose V3 IS this check; re-read live by Thunder the same hour)
✅ Already run on apply: `save_team` and `assign_stops_team` → `anon false · logged_in true`;
`teams` and `team_members` → `rls true, 1 policy` each; `deliveries.team_id` present.
**No need to run it again.**

---

## CARD 1 — Lauren builds the team list
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

1. Open **cultivar-os.app**, sign in, and check the stamp at the foot (GATE 0 above).
2. Top-left menu → **Settings** → **All business settings**.
3. Scroll to the card headed **TEAMS**. Under the heading it reads:
   *"The crews who go out. Members are names — they do not need a login. This is not the same as the
   people with accounts above."*
4. Press **Add a team**.
5. In **Team name** type `Team 1`.
6. In **Who is on it — one name per line** type `Mauro`, press Enter, type `Jose`.
   Under the box it now reads **"Names, not logins — 2 people."**
7. Press **Save team**.

**PASS:**
- A green line reads **"Team 1 saved — 2 people."**
- The card now lists **Team 1**, with **2 people** on the right, and **Mauro · Jose** underneath.
- **Edit** and **Retire** sit under it.

**FAIL and what it means:** a red line reading *"Teams need the database update (20260921a)"* means the
code is live and the migration is not — tell Thunder, do not retry.

---

## CARD 2 — the same name twice is refused, and the list does not quietly change
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

1. Same card. Press **Add a team**.
2. Type `team 1` (lower case, and the spacing does not matter) and press **Save team**.

**PASS:** a red line reads **"There is already a team with that name."** and the list still shows
**exactly one** Team 1, with Mauro · Jose unchanged.

3. Now press **Add a team** again, type `Team 2`, put `Hector` on it, and **Save team**.

**PASS:** two teams are listed, Team 1 and Team 2.

---

## CARD 3 — editing replaces the people, and does not add to them
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

1. On **Team 1**, press **Edit**.
2. Delete `Jose` from the box, leaving only `Mauro`. Add a new line: `Luis`.
3. Press **Save team**.

**PASS:** Team 1 now reads **Mauro · Luis** and **2 people**. 🔴 **Jose is GONE, not kept** — the list
you typed is the list, which is why there is no × beside each name to forget to press.

---

## CARD 4 — a stop carries its team
**STATUS:** owed · **DEVICE:** phone or desktop · **LAST-PROVEN:** —

1. Top-left menu → **Deliveries** (the schedule).
2. Find any day with a stop on it. On the stop's card, under the customer's name, there is a small
   **people icon** and a dropdown reading **No team**.
3. Choose **Team 1**.

**PASS:**
- The dropdown shows **Team 1** and the icon turns green.
- **Reload the page.** It still reads **Team 1** — that is what proves it was written, not just shown.
- Open the same stop from **Orders → that order**, and from **Route** for that day: all three read
  **Team 1**. (One read feeds all three screens, so if they ever disagree, tell Thunder.)

4. Set it back to **No team**.

**PASS:** it reads **No team** — in words, not a blank box. An unassigned stop is a real state and
says so.

---

## CARD 5 — a retired team leaves the pickers and stays on its history
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

1. Set **Team 2** on some stop (as in CARD 4), and note which stop.
2. Settings → **All business settings** → **TEAMS** → on **Team 2**, press **Retire**.

**PASS:**
- A line reads **"Team 2 retired — the stops it already has keep it."**
- Team 2 moves down under a **Retired** heading with a **Bring back** button.
- Under it: *"A retired team stays on the stops it already has, so last Saturday still says who did it."*

3. Go back to the schedule and open **a different** stop's team dropdown.

**PASS:** **Team 2 is not on the list** — you cannot put new work on a retired crew.

4. Open the stop from step 1.

**PASS:** it still reads **Team 2 (retired)**. 🔴 **This is the point of the card:** history is not
rewritten by a decision made afterwards.

5. Press **Bring back** on Team 2, and confirm it is offered on the dropdown again.

---

# THE SCHEDULE SPLIT BY TEAM (ledger #376, teams piece 5 — David, 2026-09-21)

## CARD 10 — 🔴 THE SCHEDULE SHOWS EACH TEAM'S STOPS UNDER ITS OWN HEADING
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
COVERS: ledger #376 — the schedule split by team
SIGNAL: `[TRACE:DELIVERY] route team — <date> <teamId> N stops` when the button is pressed

On **Test Dave's**, a day whose stops are split across **Team 1** and **Team 2**.
1. Open the delivery schedule.
**PASS:** under that day, the stops appear under **one heading per team** — the team's name and its
stop count — and each team's own stops sit beneath it.
**PASS:** the stop counts add up to the day's stops. **No stop is under two headings, and none has
vanished.** This is the same partition the load sheet uses, so the screen and the paper agree.
**🔴 FAIL if** a stop appears twice, or is missing from every section.

## CARD 11 — 🔴 "ROUTE THIS TEAM" HANDS THE ROUTE PAGE A SET IT CAN ACTUALLY ROUTE
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
COVERS: ledger #376 + [[R-169]] — one team at a time
SIGNAL: the route page header reads *"Routing <team> — one team at a time."*

Press **Route this team** on Team 1's heading.
**PASS:** the route page opens with **only Team 1's stops preselected**, and says which team it is
routing.
**🔴 FAIL if** it opens the whole day, or opens a set spanning two teams — R-169 refuses that, so
the button would be handing the page a set that must fail.

## CARD 12 — A SECTION WITH NO TEAM IS SHOWN, AND IS NOT OFFERED A ROUTE BUTTON
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
COVERS: ledger #376 — D-9, and no dead affordance
SIGNAL: —

Leave one stop unassigned to any team.
**PASS:** a section carries it, headed **"No team"**, with the note *"Not assigned to a team yet —
give these to a team before routing."* and **no Route this team button**.
**🔴 FAIL if** the unassigned stop is missing from the schedule entirely.
**🔴 FAIL if** it DOES get a Route button — routing a teamless set is precisely what R-169 refuses,
so the control would exist only to fail (§1.6 item 5: no dead affordance).

## CARD 13 — A DAY NOBODY HAS SPLIT LOOKS EXACTLY AS IT ALWAYS DID
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
COVERS: ledger #376 — the unsplit day is untouched
SIGNAL: —

Open a day where **no stop carries a team**.
**PASS:** a **flat list of stop cards**, exactly as before — no headings, no counts, no "No team"
caption, and the day's own **Route this day** button unchanged.
**🔴 FAIL if** a single-crew day grows a "No team" heading. A nursery that does not use teams must
not be told about them.
# THE DAY'S CAPACITY ESTIMATE (ledger #375, teams piece 2.5 — David, 2026-09-21)

⚠️ **All four cards need migration `20260921e_day_capacity_estimates.sql` applied first.** It is
WRITTEN and HELD; its V-blocks were run in PGlite but **David applies it.** Until then the panel
still shows the estimate and its working — only the **snapshot** is refused, and it says so.

## CARD 6 — 🔴 THE ESTIMATE SUGGESTS, AND IT SHOWS ITS WORKING
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
COVERS: ledger #375 — suggest one team until the day exceeds X hours
SIGNAL: `[TRACE:CAPACITY] snapshot { hours, suggested, threshold }`

On **Test Dave's**, open a delivery day with stops on it → **Route**.
**PASS:** a panel reads *"This day looks like N h — within/longer than X h, so one/two teams are
suggested."* Open **How this was worked out**: it lists **stops, trees, container gallons, planting
time, drive time, miles, the estimated day, and the X it was measured against** — and every line
says where its number came from.
**PASS:** the trees figure **matches the load list for the same day**. They are the same count from
the same function; if they disagree, that is the defect.
**🔴 FAIL if** any line shows a number with no explanation, or if gallons change the hours — gallons
are shown as a load signal and are deliberately **not** multiplied into time.

## CARD 7 — 🔴 LAUREN DECIDES, AND HER CHOICE IS RECORDED BESIDE THE SUGGESTION
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
COVERS: ledger #375 — *"if she says one team, that stands"*
SIGNAL: `[TRACE:CAPACITY] choice recorded { chosenTeams }`

On a day the estimate says needs **two** teams, press **One team**.
**PASS:** the button takes, and the panel says *"Your choice is recorded — the suggestion was 2."*
**PASS (the part that matters):** run this SQL and see **both numbers on one row** —
```sql
SELECT service_date, suggested_teams, chosen_teams, total_hours, threshold_hours
  FROM public.delivery_day_estimates ORDER BY created_at DESC LIMIT 5;
```
**🔴 FAIL if** `suggested_teams` changed to match her choice. The disagreement between the rule and
the person is the only evidence the rule was ever wrong — it must survive.

## CARD 8 — 🔴 A SNAPSHOT IS NOT REWRITTEN WHEN A SETTING CHANGES
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
COVERS: ledger #375 — append-only, carries the settings it used
SIGNAL: —

1. Note the newest row's `threshold_hours` from the SQL in CARD 7.
2. Settings → Operations → change **Second team above** from 7 to 9, Save.
3. Re-run the SQL.
**PASS:** the OLD row still reads **7**. A NEW estimate (after re-opening the route page) reads 9.
**🔴 FAIL if** the old row now reads 9 — history that moves under you is not a record, and the whole
point of the snapshot is gone.
4. Belt and braces, paste this — **it must RAISE**, not succeed:
```sql
UPDATE public.delivery_day_estimates SET total_hours = 99
 WHERE id = (SELECT id FROM public.delivery_day_estimates ORDER BY created_at DESC LIMIT 1);
```

## CARD 9 — AN UNROUTED DAY SAYS IT IS A FLOOR, NOT AN ESTIMATE
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
COVERS: ledger #375 — unknown drive time is not zero drive time (D-9 / A9)
SIGNAL: `[TRACE:CAPACITY] snapshot { driveKnown: false }`

Open a day that has **not been routed yet**.
**PASS:** drive time reads **"not known"** (never `0 h`), the headline says **"at least"**, and a
note says the real day is longer.
**🔴 FAIL if** an unrouted day shows `0 h` drive and therefore looks SHORTER than a routed one —
that would suppress the two-team suggestion on exactly the days that most need it.
