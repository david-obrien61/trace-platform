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
**Story:** `user_stories.md` → *Lauren does the job twice, every delivery day* (PIECES `crew_route_send`, `crew_day_link`) · the tap: *The stop is done — one tap* (`fulfilment_tap`)
**Ruling:** [[R-161]] — one completion writer, two doors; the review ask is HELD, never spent
**Build:** ledger **#347** · branch `feat/crew-day-link` · migration `20260917c_crew_day_link.sql`
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 9 covered** (9 `owed`). ✏️ **CARDS 0b and F added 2026-09-17** — David asked for the office door to be proven FIRST, before the crew cards, because Mark done is an existing feature that this build changed. ✏️ **CARD F added the same day** — David ruled ([[R-161]]) that the office's own **Mark done** must behave like the crew's: it HOLDS the review ask and can be undone. One writer, two doors.
**Proof behind the cards (builder, not owner):** `npm run verify:writer-registry` drives all **nine** paths and **eight** guards through the real entry points on the live schema; **22 of 22** deliberate breaks were caught (`scripts/sql-harness/crew-day-link-347.mutants.py`).

> 🔴 **WHO CAN RUN WHAT, AND ON WHICH TENANT.**
> **All cards: your own login, on Test Dave's Tree Nest, plus your phone.** No console is needed on the phone.
> **Never on LAWNS until Saturday:** a tap on LAWNS stamps a real customer's job.
> **Run CARD 0 first** — it is the SQL check that the database update is in, and it writes nothing.
>
> ✅ **DONE, IN THAT ORDER: David applied `20260917c` on 2026-09-17 and the V-block came back clean
> (independently re-read live before the merge); the code merged after. The paragraph below is kept
> because it is the reason the order was reversed.**
>
> 🔴 **APPLY THE MIGRATION BEFORE THIS CODE IS MERGED TO `main`, not after.** Marking a stop done is an
> EXISTING feature, and under [[R-161]] it now goes through `stop_act` — a function that only exists once
> `20260917c` is applied. Between a merge and an apply, **Mark done on the schedule would refuse**; it says
> *"needs the database update (20260917c)"* rather than failing mysteriously, but it is still a working
> feature stopped for that window. Same care `20260916_container_ladder_install_t_posts.sql` asked for in its
> own header. **Order: apply → merge → CARD 0.**
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
   AND p.proname IN ('crew_day_read', 'crew_stop_act', 'stop_progress_apply', 'stop_act',
                     'create_crew_day_link', 'revoke_crew_day_link')
 ORDER BY 1;
```

**PASS:** the results grid shows **six** rows.
- `create_crew_day_link`, `revoke_crew_day_link` and `stop_act` (the office door) read `false · true · true` — a logged-in person may call them, the public key may not.
- `crew_day_read` and `crew_stop_act` read `false · false · true` — only the server, because the token is checked inside them.
- `stop_progress_apply` (the one completion writer) reads `false · false · true` as well: nobody calls it directly, only the two doors above.

**FAIL:** fewer than six rows (the update is not applied), or any `true` in the **anon** column, or `crew_day_read` / `crew_stop_act` / `stop_progress_apply` showing `true` under logged_in.

---

## CARD 0b — 🔴 the office door still works, and it behaves the new way
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
David asked for this card BEFORE the crew cards, and it is the right order: **Mark done is an existing feature**, and [[R-161]] changed how it works. Run it on **Test Dave's** delivery schedule, on a stop you do not mind moving.
1. Open **Delivery → Schedule**. Pick a stop that is **not** done. Tap **Start this stop**, then **Mark done**.
2. Watch the screen for a review prompt. **There must not be one.**
3. The card shows the green **Done** chip with a red **Undo done** beside it. Tap **Undo done**.

**PASS:** no review prompt at any point; after step 1 the card reads **Done** and a grey box appears — **From the crew link — Started <time> · <your member name>** and **Done <time> · <your member name> · review ask held, not sent**; after step 3 the chip is back to **Scheduled** and the Done line is gone from that box. The customer receives nothing.
**FAIL:** a review prompt opens (the ask was spent); **Mark done** errors — if it says *"needs the database update (20260917c)"* then the migration was not applied, so stop and apply it; there is no **Undo done** control; or the grey box names nobody.
⚠️ **On a stop that was already `fulfilled` before today** (the QuickBooks history import), there is deliberately **no Undo done** control — neither door will reopen it, so none is offered.

---

## CARD A — make today's link, open it on your phone, enter a name
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
1. On your computer, sign in, open **Delivery → Schedule** on Test Dave's.
2. On today's (or tomorrow's) day heading, tap **Crew link**. A panel opens: *Crew link for this day*.
3. Tap **Make link**. A green box appears with the link and **Copy link** (and **Share…** on a phone).
4. Tap **Copy link**, paste it into a text to yourself, and open it on your phone.
5. The phone asks **Your name?** Type a name (e.g. *Dave test*) and tap **OK**.

**PASS:** on the schedule, the panel reads **Link is on · made … · works until … 6:00 AM**; on the phone, the page shows the business name, the day, **Dave test · not you?**, and one card per stop with **STOP 1**, the address, a **Maps** button, the customer's name, their number as readable text with a **Call** button under it, **ON THIS ORDER** with quantities and items, and **Start** / **Done** buttons. Tapping **Call** opens your phone's dialler with that number (hang up — this is Test Dave's synthetic data, but check the number matches).
**FAIL:** the panel shows an error, the phone page says the link does not work, a stop from another day appears, or a stop card is missing its address or items.

---

## CARD B — Start and Done a stop; the schedule shows the times and the name
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
1. On the phone page from CARD A, on STOP 1, tap **Start**. Wait at least a minute.
2. Tap **Done**.
3. On your computer, refresh **Delivery → Schedule** and find that stop.

**PASS:** on the phone, STOP 1's top line reads **DONE <time> · Dave test** and an **Undo** button appears; on the schedule, that stop card shows the green **Done** chip and a grey box **From the crew link** with **Started <time> · Dave test** and **Done <time> · Dave test · review ask held, not sent**; the order screen for that stop still shows the order as not fulfilled.
**FAIL:** the schedule shows no crew box or the wrong name, the order moved to fulfilled, a review prompt appeared anywhere, or the customer received anything.

---

## CARD B2 — an accidental Done is undone from the phone, and a note is kept
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
1. On the phone, on the stop from CARD B, tap **Undo**.
2. Tap **Note**, type *gate was locked*, tap **Save**.
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

## CARD F — 🔴 the office's own Mark done behaves the same: it holds the ask, and it can be undone
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
David's ruling [[R-161]]. On your computer, on **Test Dave's**, open **Delivery → Schedule** and pick a stop that is **not** done (use a different stop from CARD B).
1. On the stop card, tap **Start this stop**, then tap **Mark done**.
2. Watch for a review prompt. **There must not be one.**
3. The card now shows the green **Done** chip and, beside it, a red **Undo done** control. Tap it.
4. Open the same stop's card again and tap **Mark done** once more.

**PASS:** no review prompt appears at any point; after step 1 the card shows **Done** plus **From the crew link — Started … Done … · <your member name> · review ask held, not sent**; after step 3 the chip is back to **Scheduled** and the crew box no longer shows a Done line; step 4 marks it done again. The customer receives nothing at any point.
**FAIL:** a review prompt opens (the ask was spent), there is no **Undo done** control, Undo errors, or the stop's crew box names nobody.

---

## THE NOTE DAVID FORWARDS TO LAUREN (not a card — kept here so it is not only in a chat)

> For Saturday, run the paper day sheet exactly as you always do — the printed orders are still the crew's copy for the load. The only new thing: on the delivery schedule, on Saturday's heading, tap **Crew link**, then **Make link**, then **Copy link**, and paste it into the same text you already send the driver. He opens it on his phone — no login, no app, no password — types his name once, and then has the day's stops with the addresses, a Maps button, the customer's name and number (with a Call button), and what's on each order. No prices are on it. As he works he taps **Start** and **Done** on each stop, and can add a note ("gate was locked") that you'll see on your schedule with his name and the time.
>
> **Send it on Saturday morning, not the night before** — a link covers that one day and stops working at 6 am Sunday.
> **Anyone who has the link can use it** until then, so send it to the driver and nobody else; if you want it dead sooner, tap **Turn off link**.
> **The link is shown only once.** If you lose it, tap **Make a new link** and re-send — that makes a new one and kills the old one, so the driver needs the new text.
> **The load list now prints the right amount of special mix.** For Saturday that is **7 yards**, where the old page said 3½ — the old figure was half what it should have been.
> If anything about the link misbehaves, ignore it and carry on with the paper; nothing about Saturday depends on it.

⚠️ **The 7 yards is checked, not repeated:** Saturday's 7 LAWNS stops carry **27 trees — 14 × 15 gal, 8 × 30 gal, 5 × 45 gal = 675 container gallons**. At the corrected ratio (2 container volumes of mix per tree, [[R-155]] as amended 2026-09-15/16) that is 1,350 gallons ÷ 201.974 = 6.68, printed **7 yards** (rounded up to the next half yard, *"err large, do not skimp"*). At the old 1.0 ratio it was 3.34 → **3½**. The mix ratio is configuration now; LAWNS has no override, so the default of 2 applies.

---

## WHAT THIS BOARD DOES NOT COVER
- **Expiry at 6:00 AM the next day** — proven by the builder test `crew.expired`, not by a card: waiting overnight is not a useful owner test. If you want to see it, open Monday a link made for Saturday.
- **The rate limit** (60 calls a minute per phone) — builder test `crew.rate-limit`.
- **Spanish** — the page is English only, by David's call for the pilot; the crew wording was cut to a few words per control. Filed as the next step against [[R-151]]: tech-debt **#325**.
- **A stop completed before this build** (an imported history stop, [[R-37]]) — neither door will reopen it, and it says why. Proven by `office.undo-done` and `crew.undo-done`, not by a card: making one would mean marking a real imported stop.
