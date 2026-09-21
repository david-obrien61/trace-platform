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
**Build:** ledger **#362** · branch `feat/teams` · migration `20260921a_teams.sql` (APPLIED 2026-09-22)
**Tech debt this closes the first piece of:** **#345** — Saturday 2026-09-19, when routing Team 1's
four stops wiped Team 2's order, because the day had one route and the platform had no teams.
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 1 of 6 covered** (CARD 0 — David's own `20260921a` V-block, 2026-09-22). **CARDS 1–5 owed.**
**Proof behind the cards (builder, not owner):** `npm run verify:writer-registry` drives all **five**
paths and **nine** guards through the real entry points on the live schema, RLS on; deliberate breaks
are caught by `scripts/sql-harness/teams-362.mutants.py`.

> 🔴 **WHO CAN RUN WHAT, AND ON WHICH TENANT.**
> **All cards: your own login, on Test Dave's Tree Nest.** CARD 1 is desktop; CARD 4 is worth doing on the phone.
> **Not on LAWNS yet.** Setting a team on a LAWNS stop is harmless — it moves no job and tells no crew
> anything — but leave it until the route half (piece 2) is in, so the list Lauren builds is the one she keeps.

---

## CARD 0 — the database update is in
**STATUS:** covered · **DEVICE:** desktop · **LAST-PROVEN:** 2026-09-22 (David — the `20260921a` V-block, whose V3 IS this check; re-read live by Thunder the same hour)
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
