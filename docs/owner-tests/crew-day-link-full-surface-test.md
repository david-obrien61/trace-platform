# OWNER TEST — THE CREW DAY LINK (no login, one day)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** Anything else is **not production**, and the SHA being
> right does not rescue it: an amber **`PREVIEW <branch>`** chip, an amber **`prod⚠ <branch>`**
> (production, but built from a branch), **`env?`** (target unknown), or **`local`**. **If the chip is
> amber, stop.** *(GATE 0 · OP-15 · ledger #321.)*
> ⚠️ **The crew page (`/crew`) shows the same stamp at the foot.** Check it on the phone too.

**Capability:** 3.5 (delivery / routing) · 3.4 (scheduling)
**Story:** `user_stories.md` → *Lauren does the job twice, every delivery day* (PIECES `crew_route_send`, `crew_day_link`)
**Build:** ledger **#347** · branch `feat/crew-day-link` · migration `20260917c_crew_day_link.sql`
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 7 covered** (7 `owed`).
**Proof behind the cards (builder, not owner):** `npm run verify:writer-registry` drives all six paths and seven security guards through the real endpoint on the live schema; 17 of 17 deliberate breaks were caught (`scripts/sql-harness/crew-day-link-347.mutants.py`).

> 🔴 **WHO CAN RUN WHAT, AND ON WHICH TENANT.**
> **All cards: your own login, on Test Dave's Tree Nest, plus your phone.** No console is needed on the phone.
> **Never on LAWNS until Saturday:** a tap on LAWNS stamps a real customer's job.
> **Run CARD 0 first** — it is the SQL check that the database update is in, and it writes nothing.
> **Before CARD A:** Test Dave's needs at least one stop scheduled for **today or tomorrow**. If it has none, schedule one from an invoice capture or the order screen, then come back.

---

## CARD 0 — the database update is in
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
In the Supabase **SQL editor**, paste and run:

```sql
SELECT p.proname,
       has_function_privilege('anon', p.oid, 'EXECUTE')          AS anon,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS logged_in,
       has_function_privilege('service_role', p.oid, 'EXECUTE')  AS server
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace
   AND p.proname IN ('crew_day_read', 'crew_stop_act', 'create_crew_day_link', 'revoke_crew_day_link')
 ORDER BY 1;
```

**PASS:** the results grid shows four rows: `create_crew_day_link` and `revoke_crew_day_link` read `false · true · true`; `crew_day_read` and `crew_stop_act` read `false · false · true`.
**FAIL:** fewer than four rows (the update is not applied), or `crew_day_read` / `crew_stop_act` shows `true` under anon or logged_in.

---

## CARD A — make today's link, open it on your phone, enter a name
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
1. On your computer, sign in, open **Delivery → Schedule** on Test Dave's.
2. On today's (or tomorrow's) day heading, tap **Crew link**. A panel opens: *Crew link for this day*.
3. Tap **Make link**. A green box appears with the link and **Copy link** (and **Share…** on a phone).
4. Tap **Copy link**, paste it into a text to yourself, and open it on your phone.
5. The phone asks **Who is using this phone?** Type a name (e.g. *Dave test*) and tap **Continue**.

**PASS:** on the schedule, the panel reads **Link is on · made … · works until … 6:00 AM**; on the phone, the page shows the business name, the day, **Dave test · not you?**, and one card per stop with **STOP 1**, the address, **Open in Maps**, the customer name and phone, **ON THIS ORDER** with quantities and items, and **Start** / **Done** buttons.
**FAIL:** the panel shows an error, the phone page says the link does not work, a stop from another day appears, or a stop card is missing its address or items.

---

## CARD B — Start and Done a stop; the schedule shows the times and the name
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
1. On the phone page from CARD A, on STOP 1, tap **Start**. Wait at least a minute.
2. Tap **Done**.
3. On your computer, refresh **Delivery → Schedule** and find that stop.

**PASS:** on the phone, STOP 1's top line reads **DONE <time> · Dave test** and an **Undo Done** button appears; on the schedule, that stop card shows the green **Done** chip and a grey box **From the crew link** with **Started <time> · Dave test** and **Done <time> · Dave test · review ask held, not sent**; the order screen for that stop still shows the order as not fulfilled.
**FAIL:** the schedule shows no crew box or the wrong name, the order moved to fulfilled, a review prompt appeared anywhere, or the customer received anything.

---

## CARD B2 — an accidental Done is undone from the phone, and a note is kept
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
1. On the phone, on the stop from CARD B, tap **Undo Done**.
2. Tap **Add a note**, type *gate was locked*, tap **Save note**.
3. Refresh the schedule on your computer.

**PASS:** on the phone, the stop's top line reads **STARTED <time>** again with **Done** showing, and **CREW NOTES** lists *gate was locked* with your name; on the schedule, the crew box shows **Started**, no Done line, and **Note <time> · Dave test: gate was locked**, and the status chip is back to scheduled.
**FAIL:** Undo does nothing or errors, the schedule still shows Done, or the note is missing from either screen.

---

## CARD C — the page shows no prices
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
1. On the phone page, scroll through every stop.
2. Compare with the same order on the computer (**Orders → the order**), which does show prices.

**PASS:** no dollar amount, price, total, discount or tax appears anywhere on the phone page — only quantities and item names under **ON THIS ORDER**.
**FAIL:** any `$`, price, total, subtotal or discount appears on the phone page.

---

## CARD D — turn the link off; the page says to ask for a new link
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
1. On the schedule, open **Crew link** for the same day and tap **Turn off link**.
2. On the phone, tap **Refresh** (or reload the page).
3. Back on the schedule, tap **Make a new link** and open the new link on the phone.

**PASS:** after step 2 the phone shows **Link not working — This link has been turned off. Ask Lauren for today's link.** and no stops; the panel reads **No link for this day** after step 1; the new link from step 3 opens the day again, and the old link still shows the turned-off message.
**FAIL:** the old link still shows stops after it was turned off, or the new link does not open.

---

## CARD E — a link for another day shows nothing from today
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
1. On the schedule, pick a **different** day that has at least one stop (tomorrow, say) and tap **Crew link → Make link** there.
2. Open that link on the phone.

**PASS:** the phone page's heading names **that other day**, and every stop shown is one of that day's stops on the schedule — none of today's stops appears, and today's stop from CARD B is not listed.
**FAIL:** any of today's stops appears on the other day's link.

---

## WHAT THIS BOARD DOES NOT COVER
- **Expiry at 6:00 AM the next day** — proven by the builder test `crew.expired`, not by a card: waiting overnight is not a useful owner test. If you want to see it, open Monday a link made for Saturday.
- **The rate limit** (60 calls a minute per phone) — builder test `crew.rate-limit`.
- **Spanish** — the page is English only. The language story (*Give it to me in my language*) applies and is not built here.
