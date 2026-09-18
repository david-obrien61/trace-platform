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
**Board: 7 of 11 covered** (0, 0b, A, B, B2, C, H). **D, E, F, G owed — David: not before Saturday.** (CARD 0b — David, 2026-09-17 · 10 `owed`). ✏️ **CARDS G and H added 2026-09-18 (ledger #351, [[R-163]])** — the saved route order; H is on LAWNS, Saturday 2026-09-19 only, by David's approval. ✏️ **CARDS 0b and F added 2026-09-17** — David asked for the office door to be proven FIRST, before the crew cards, because Mark done is an existing feature that this build changed. ✏️ **CARD F added the same day** — David ruled ([[R-161]]) that the office's own **Mark done** must behave like the crew's: it HOLDS the review ask and can be undone. One writer, two doors.
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
**STATUS:** covered · **DEVICE:** desktop · **LAST-PROVEN:** 2026-09-17 (David — the `20260917c` V-block, whose V3 IS this check)
✅ David ran V3 on apply: create/revoke → anon f · authed t · service t; the five crew functions → anon f · authed f · service t. Re-read live by Thunder the same hour (all nine functions, incl. `stop_act` and `stop_progress_apply`). **No need to run it again.**
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

## CARD 0b — the office door still works, and it behaves the new way
**STATUS:** covered · **DEVICE:** desktop · **LAST-PROVEN:** 2026-09-17 (David · Test Dave's · `05f3061 · prod`)

✅ **RUN AND PASSED 2026-09-17.** The Wed Sep 2 stop (LEANDER AREA WHLS NRSY SPLY): **Start 2:34 PM → Mark done 2:37 PM, NO review prompt at any point.** The grey box read *"From the crew link · Started 2:34 PM · David OBrian · Done 2:37 PM · David OBrian · review ask held, not sent"*, with **3 min on site** beside the Done chip and the amber *"order is still open — stock has not been taken out yet"*. **Undo done** returned the stop and **kept the Started line**.

✏️ **IT CORRECTED THIS CARD'S OWN PREDICTION, and that is why step 7 now reads as it does.** The card said **Start this stop** comes back after an undo. It does not: an undo keeps a REAL start time and only clears one the writer invented for a done-without-start, so what comes back is **Mark done**. David saw `Mark done`; the card had said `Start this stop`. The behaviour was right and the card was wrong.

**Login:** your own (owner). **Device:** computer. **Tenant:** Test Dave's Tree Nest. **Writes:** yes — it marks one real stop done, then undoes it.

1. Open **https://cultivar-os.app** and sign in. → the dashboard, a grid of coloured tiles.
2. Look at the very bottom of the page. → small grey text **`built <time> · <sha> · prod`**. The SHA must be the one you mean to test and the last token must be **prod**; otherwise stop.
3. Look at the top bar. → it must name **Test Dave's Tree Nest**. If it names LAWNS, stop and switch tenants first.
4. Click the **hamburger menu** (three lines, top left). → a drawer: Dashboard · Delivery · Operating Costs · Social · PMI · Orders …
5. Click **Delivery**. → a page headed **Operations calendar**, with **‹** / **›** arrows, a **This week** button, and four weeks of day cells.
   ⚠️ **The menu item opens the CALENDAR, not a list of stops.** The day-by-day list is a drill-in that appears only after you click a day.
6. Click **‹** once (left of the week heading). → the heading reads **Four weeks · 4 weeks back** and the grid covers mid-August to mid-September. *(Every Test Dave's stop is in the past, which is why you go back.)*
7. Click the cell for the day holding a stop that is **not** done (Wed 2, September, for the original run). → the cell takes a green border and the page scrolls to a section headed with that date and **N stop(s) on this day**.
   *Control missing:* no cell or no stop → you are in the wrong four weeks. Click **This week**, then **‹** once.
8. On the stop card, find the full-width outlined button reading **Start this stop** (below the **On this order · N lines** block). Click it. → it becomes a green full-width **Mark done**.
   *Control missing:* a green **Done** chip instead means this stop is already done — use another stop, or run step 10 first to reopen it.
9. Wait about a minute (so the stamps differ), then click **Mark done**. → the buttons are replaced by a green **Done** chip; beside it **N min on site**; and a grey box headed **From the crew link** with **Started <time> · <your name>** and **Done <time> · <your name> · review ask held, not sent**. An amber line may read *"Marked done. The order is still open — stock has not been taken out yet"* — that is expected (tech-debt #319).
10. **Watch the whole screen through steps 8–9 for a review prompt** (a sheet offering a QR code). → there must be **none**.
11. Look right of the **Done** chip. → red text **Undo done**.
    *Control missing:* the stop was `fulfilled` before this build (no recorded "who"), so it is deliberately not reopenable — use a stop you marked done yourself.
12. Click **Undo done**. → the chip returns to **Scheduled**, the **Done** line leaves the grey box, the **Started** line stays, and the control reads **Mark done** (see the correction above).

**PASS:** no review prompt at any point; after step 9 the stop reads **Done** with the grey **From the crew link** box naming you, both times, and **review ask held, not sent**; after step 12 it is **Scheduled** again with its Started line kept. The customer receives nothing.
**FAIL:** a review prompt opens (the ask was spent — the whole point of the change); **Mark done** says *"Marking stops done needs the database update (20260917c) — it has not been applied yet"* (the code is live against a database without the migration — stop); no **Undo done** on a stop you just marked done; **Undo done** errors; or the grey box names nobody.

---

## CARD A — make today's link, open it on your phone, enter a name
**STATUS:** covered · **DEVICE:** phone · **LAST-PROVEN:** 2026-09-17 (David · Test Dave's · `05f3061 · prod`)
✅ **PASSED:** the link opened with no login, asked the name once and remembered it; both stops showed address, Maps, Call where there is a number and "No phone on file" where there is not, the office note, item lists with quantities and the honest empty messages, Start / Done / Note, and **no prices anywhere**. ✏️ One wrong prediction in this card, corrected: the john smith stop has NO linked order, so it reads *"No order is linked to this stop"*, not *"no items listed"*. **And it exposed the regression David then ruled on — the page said "scheduled order, not a planned route" → [[R-163]], ledger #351.**
1. On your computer, sign in, open **Delivery → Schedule** on Test Dave's.
2. On today's (or tomorrow's) day heading, tap **Crew link**. A panel opens: *Crew link for this day*.
3. Tap **Make link**. A green box appears with the link and **Copy link** (and **Share…** on a phone).
4. Tap **Copy link**, paste it into a text to yourself, and open it on your phone.
5. The phone asks **Your name?** Type a name (e.g. *Dave test*) and tap **OK**.

**PASS:** on the schedule, the panel reads **Link is on · made … · works until … 6:00 AM**; on the phone, the page shows the business name, the day, **Dave test · not you?**, and one card per stop with **STOP 1**, the address, a **Maps** button, the customer's name, their number as readable text with a **Call** button under it, **ON THIS ORDER** with quantities and items, and **Start** / **Done** buttons. Tapping **Call** opens your phone's dialler with that number (hang up — this is Test Dave's synthetic data, but check the number matches).
**FAIL:** the panel shows an error, the phone page says the link does not work, a stop from another day appears, or a stop card is missing its address or items.

---

## CARD B — Start and Done a stop; the schedule shows the times and the name
**STATUS:** covered · **DEVICE:** phone · **LAST-PROVEN:** 2026-09-18 (David · Test Dave's · crew link on the phone)
✅ **PASSED — THROUGH THE CREW LINK THIS TIME** (the tap log confirms: device `f18d48bd`, no `app-session`). Stop 3, David Smith, 770 County Road 284: **Started 11:12 → Done 11:15 → Note 11:16 "Some texts"**, all from the phone; Lauren's schedule showed all three with the name and times, **"review ask held, not sent"**, **3 min on site**. The LEANDER stop showed the amber *"order is still open"* line. ⚠️ The phone was still typed as **"Mauro"**, so the three taps read "Mauro" — the same device `20260918b` marked as David's test device, so they are attributable from the record; David is changing the typed name to "David test".
⚠️ **2026-09-18 10:50–10:51, reported as CARD B — BUT THE TAP LOG SHOWS BOTH TAPS CAME THROUGH THE OFFICE DOOR** (the schedule's Start this stop / Mark done: `device_id = app-session`, no crew link, recorded as the member name *David OBrian*). That re-proves the office path (CARD 0b's) — held ask, order not fulfilled — but **not this card, whose point is the PHONE → Lauren's schedule path the driver uses.** Stays `owed` until a tap made on the crew link appears on the schedule under the name typed on the phone.
1. On the phone page from CARD A, on STOP 1, tap **Start**. Wait at least a minute.
2. Tap **Done**.
3. On your computer, refresh **Delivery → Schedule** and find that stop.

**PASS:** on the phone, STOP 1's top line reads **DONE <time> · Dave test** and an **Undo** button appears; on the schedule, that stop card shows the green **Done** chip and a grey box **From the crew link** with **Started <time> · Dave test** and **Done <time> · Dave test · review ask held, not sent**; the order screen for that stop still shows the order as not fulfilled.
**FAIL:** the schedule shows no crew box or the wrong name, the order moved to fulfilled, a review prompt appeared anywhere, or the customer received anything.

---

## CARD B2 — an accidental Done is undone from the phone, and a note is kept
**STATUS:** covered · **DEVICE:** phone · **LAST-PROVEN:** 2026-09-18 (David) + 2026-09-17 (Lauren)
✅ **ASSEMBLED FROM TWO LIVE RUNS — said, so it can be challenged.** The **note** half: David, 2026-09-18 11:16, *"Some texts"* from the phone, shown on Lauren's schedule with name and time. The **undo** half: Lauren, 2026-09-17 15:55:23, **Undo from the crew link on LAWNS** reopened the Sappal stop (tap log: `undo_done`, crew link) — and the office Undo is CARD 0b. ⚠️ No single run did phone-Undo-then-Note on one stop; if David wants that exact sequence proven, it is 2 minutes on Test Dave's.
1. On the phone, on the stop from CARD B, tap **Undo**.
2. Tap **Note**, type *gate was locked*, tap **Save**.
3. Refresh the schedule on your computer.

**PASS:** on the phone, the stop's top line reads **STARTED <time>** again with **Done** showing, and **CREW NOTES** lists *gate was locked* with your name; on the schedule, the crew box shows **Started**, no Done line, and **Note <time> · Dave test: gate was locked**, and the status chip is back to scheduled.
**FAIL:** Undo does nothing or errors, the schedule still shows Done, or the note is missing from either screen.

---

## CARD C — the page shows no prices
**STATUS:** covered · **DEVICE:** phone · **LAST-PROVEN:** 2026-09-18 (David · Test Dave's · `0bcb467 · prod`)
✅ **PASSED:** no prices anywhere on the phone page.
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

## CARD G — the route order is saved and every surface follows it (Test Dave's)
**STATUS:** owed · **DEVICE:** desktop + phone · **LAST-PROVEN:** —
**Build:** ledger #351 · [[R-163]]. **Needs:** `20260917e` applied and #351 merged. **Tenant:** Test Dave's. **Writes:** the route columns on today's two stops.
⚠️ **Test Dave's addresses are partly synthetic** (*1234 no name lane*). If Google cannot place them, the optimiser does not run, **nothing is saved, and that is the correct result** — then CARD H on LAWNS is the proof of the saved order. Steps 4–5 tell you which happened.

1. **Hamburger menu → Delivery → the TODAY cell (Fri 18)**. → *Friday, Sep 18, 2026 · 2 stops* — and after **· 2 stops** the heading now also reads **· Not routed yet — press Route this day.** *(Lauren's screen names the action; the phone and the printed sheet say to follow her text — David, 2026-09-18.)*
2. In that heading row click **Route this day**. → the route page; both stops listed, each with a **green ticked box** top-left and a green number under it.
3. Click the green **Route 2 Stops** button at the bottom. → a map, then **Route ready — 2 stops**.
4. Read the lines under **Route ready**. → **either** (a) **N miles · N drive · optimized order** followed by a green **Saved — 2 stops in this order · route order · planned <time>. The crew's phone, the schedule and the day sheet now follow it.** — **or** (b) neither line: Google could not route these addresses, nothing was saved.
5. **If (b):** stop here — go to CARD H. **If (a):** write down which address the numbered list puts **first**.
6. **Back → Delivery → Fri 18**. → the heading now reads **· route order · planned <time>**, and the two cards are in the **same order as the numbered list**.
7. On the phone, open today's crew link and tap **Refresh**. → under the date: **2 stops · route order · planned <time>**, and **STOP 1** is the address you wrote down.
8. **Hamburger menu → Delivery → Load list**, set the date box to **09/18/2026**. → *Load list — Friday, September 18, 2026*, the line **route order · planned <time>**, and the stops in the same order.

**PASS (a):** the route page said **Saved**, and the schedule, the phone and the load list all show **the same first stop** and **route order · planned <time>**.
**PASS (b):** no **Saved** line; the schedule still says **Not routed yet — press Route this day.**, and the phone and the load list still say **Not the planned route — follow the order in Lauren's text.** No surface claims a plan that was not made.
**FAIL:** a surface shows a different order from the route page; a surface says **route order · planned** when the route page never said **Saved**; or the route page shows *"Saving the route order needs the database update (20260917e)"* (the migration is not applied — stop).

---

## CARD H — 🔴 LAWNS, SATURDAY 2026-09-19 ONLY: Lauren's real day, routed, saved and re-routed
**STATUS:** covered · **DEVICE:** desktop + phone · **LAST-PROVEN:** 2026-09-18 (David, alone — read-only)
✅ **PASSED, READ-ONLY, RUN BY DAVID HIMSELF — NOT in front of Lauren** (a first report said otherwise; David corrected it the same hour, and nothing on this board ever recorded the wrong version). No Route was pressed. **The schedule, the load list and the phone all showed Lauren's eight stops in the same saved order, each with "route order · planned"; and David compared that order against the same eight addresses in Google Maps — they matched.** ✅ **AND THE BOX-FOLLOWS-STOP FIX (option A, `429223b`, live in `3cd3ac9`) CONFIRMED ON SCREEN BY DAVID:** LAWNS Sat 19 → Freehill is clean — no *"Started 10:10 AM · Mauro"* beside a stop that is not started. ⚠️ Not reported in this run: the mix figure on the sheet (the load list window's check).
🔴 **2026-09-18 09:57:52 — LAUREN ROUTED SATURDAY HERSELF, three minutes after production flipped to `8a4af05`.** Eight stops (an eighth, *Angela Garzon*, was captured at 09:56), positions 1–8, `routed_by` = Lauren Bishop, one `route.saved` audit row (8 stops, 0 dropped) — measured live. **The save has therefore worked on real addresses, by the real user.** ⚠️ **SO THIS CARD IS NOW READ-ONLY: run steps 1, 2, 6, 7 and 8 only (see the ranked list), and DO NOT run steps 3–5 or 9–12** — pressing Route again, or re-routing, would REPLACE Lauren's own plan and re-stamp it as yours on the eve of the pilot. Re-routing is proven by `route.save` (replace, re-stamp, dropped stop) and needs no live repeat.
**APPROVED BY DAVID, 2026-09-17: testing on LAWNS, on Saturday 2026-09-19's stops ONLY** — Lauren's own day, seven stops, real addresses. **The only write is the route order on those seven stops, and re-routing replaces it.** Do not route, move or mark any other LAWNS date. This is also the plan the driver will follow on Saturday — so finish with all seven selected.

1. Switch to **LAWNS Tree Farm** for this card only. Footer must read **… · prod**.
2. **Hamburger menu → Delivery**. If Saturday is not visible, click **This week**. Click the **Sat 19** cell. → *Saturday, Sep 19, 2026 · 7 stops on this day*, heading ending **· Not routed yet — press Route this day.**
3. In the day heading row click **Route this day**. → the route page, **seven** stops, each with a green ticked box.
   *Fewer than seven ticked?* A stop with no address cannot be ticked — note which, and continue.
4. Click **Route 7 Stops**. → map, **Route ready — 7 stops**, **N miles · N drive · optimized order**, and the green **Saved — 7 stops in this order · route order · planned <time>. The crew's phone, the schedule and the day sheet now follow it.**
   *No **Saved** line:* Google could not route the day — stop and tell me which line appeared instead.
5. Write down the **first three names** of the numbered list.
6. **Back → Delivery → Sat 19**. → heading **· 7 stops · route order · planned <time>**, cards in the order you wrote down.
7. **Hamburger menu → Delivery → Load list**, date **09/19/2026**. → **route order · planned <time>** under the heading, stops in the same order. *(The 7 yards of special mix is unchanged — this build does not touch the materials.)*
8. On the schedule, **Sat 19 → Crew link → Make link → Copy link**; open it on your phone. → **7 stops · route order · planned <time>**, STOP 1–3 are your three names.
   ⚠️ This makes Saturday's real link. If you want Lauren to send a fresh one Saturday morning, **Make a new link** then kills this one — the saved order is unaffected.
9. **Re-route (replaces the plan):** back on the route page, **untick** the green box on any **one** stop. → the route clears.
10. Click **Route 6 Stops**. → **Saved — 6 stops in this order · route order · planned <a later time>**.
11. On the phone tap **Refresh**. → the planned time moved to the new one, six stops in the new order, and the unticked stop listed **last** (it is still Saturday's stop, just not in the plan).
12. **Put the real plan back:** tick that stop again → **Route 7 Stops** → **Saved — 7 stops …**. → the phone, after **Refresh**, shows all seven in plan order.

**PASS:** the route page said **Saved**; the schedule, the load list and the phone all show the **same seven in the same order** with **route order · planned <time>**; re-routing replaced the order and moved the time; and the final state is all seven planned.
**FAIL:** any surface disagrees on the order; the time does not move on a re-route; a stop dropped from the plan keeps a number; or anything on a LAWNS date other than Saturday changed.

---

## THE NOTE DAVID FORWARDS TO LAUREN (not a card — kept here so it is not only in a chat)

> For Saturday, run the paper day sheet exactly as you always do — the printed orders are still the crew's copy for the load. The only new thing: on the delivery schedule, on Saturday's heading, tap **Crew link**, then **Make link**, then **Copy link**, and paste it into the same text you already send the driver. He opens it on his phone — no login, no app, no password — types his name once, and then has the day's stops with the addresses, a Maps button, the customer's name and number (with a Call button), and what's on each order. No prices are on it. As he works he taps **Start** and **Done** on each stop, and can add a note ("gate was locked") that you'll see on your schedule with his name and the time.
>
> **Send it on Saturday morning, not the night before** — a link covers that one day and stops working at 6 am Sunday.
> **Anyone who has the link can use it** until then, so send it to the driver and nobody else; if you want it dead sooner, tap **Turn off link**.
> **The link is shown only once.** If you lose it, tap **Make a new link** and re-send — that makes a new one and kills the old one, so the driver needs the new text.
> **The load list now prints the right amount of special mix — read the figure off the printed sheet on Saturday morning, not from this note.** The old page printed half of what was needed. (It changes whenever a stop is added: with the eighth stop captured Friday morning it went from 7 yards to **9 yards**.)
> If anything about the link misbehaves, ignore it and carry on with the paper; nothing about Saturday depends on it.

🔴 **CORRECTED 2026-09-18 ~10:05 — THE 7 YARDS BELOW WENT STALE WITHIN A DAY, AND THE NOTE NO LONGER CARRIES A NUMBER.** An eighth Saturday stop was captured at 09:56 (Angela Garzon — **2 × Natchez Crape Myrtle, 95 gallon**, +190 container gallons): 675 + 190 = 865 → ×2 = 1,730 gal ÷ 201.974 = 8.57 → **9 yards**. A figure copied into a message is a second home for a fact the sheet recomputes (STD-011), and it was wrong by the next morning. **The sheet is the answer; the note now says so.** The original arithmetic is kept below because it was right for seven stops.
⚠️ **The 7 yards WAS checked, not repeated (for seven stops):** Saturday's 7 LAWNS stops carry **27 trees — 14 × 15 gal, 8 × 30 gal, 5 × 45 gal = 675 container gallons**. At the corrected ratio (2 container volumes of mix per tree, [[R-155]] as amended 2026-09-15/16) that is 1,350 gallons ÷ 201.974 = 6.68, printed **7 yards** (rounded up to the next half yard, *"err large, do not skimp"*). At the old 1.0 ratio it was 3.34 → **3½**. The mix ratio is configuration now; LAWNS has no override, so the default of 2 applies.

---

## WHAT THIS BOARD DOES NOT COVER
- **Expiry at 6:00 AM the next day** — proven by the builder test `crew.expired`, not by a card: waiting overnight is not a useful owner test. If you want to see it, open Monday a link made for Saturday.
- **The rate limit** (60 calls a minute per phone) — builder test `crew.rate-limit`.
- **Spanish** — the page is English only, by David's call for the pilot; the crew wording was cut to a few words per control. Filed as the next step against [[R-151]]: tech-debt **#325**.
- **A stop completed before this build** (an imported history stop, [[R-37]]) — neither door will reopen it, and it says why. Proven by `office.undo-done` and `crew.undo-done`, not by a card: making one would mean marking a real imported stop.
