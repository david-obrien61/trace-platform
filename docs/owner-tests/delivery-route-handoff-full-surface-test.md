# OWNER TEST — WHAT THE DRIVER RECEIVES IS WHAT THE MANAGER SAW

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** 3.5 (delivery / routing) · 3.6
**Story:** `user_stories.md` → *What the driver receives is what the manager saw* (PIECES `handoff_order_parity`, `one_derived_route_url`, `stop_count_parity`)
**Surface:** `/deliveries` — and, for every card below, **the artefact that leaves it**.
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 8 covered** (7 `owed` · 1 `needs-test`) — ✏️ **#301 (2026-09-11) flipped CARDS 1, 2 and 7 back to `owed`: the stop list that feeds the route on `/deliveries?date=` was rebuilt as the shared stop card.** Before that — **CARDS 1, 2 and 7 proven live 2026-09-09 on LAWNS, build `f5f40e3`, the first run in this feature's history.** **CARD 2 is `covered` WITH A NAMED LIMIT** (Cultivar on the phone, Google's render on desktop — the mobile half is unevidenced). CARD 8 carries a partial desktop finding and a rewritten method; it stays `needs-test`.
⚠️ **THE ROUTE COULD NOT BE BUILT UNTIL TWO LIVE ADDRESSES WERE CORRECTED** — see CARD 2 and tech-debt #226/#227.
**DEVICE:** CARDS 1–3 and 5–6 are `DEVICE: desktop` (Lauren builds the route at a desk). **CARD 4 is `DEVICE: phone` and is the one that matters most** — it reads what actually landed on the installer's handset, and it is provable **without a console**.

---

## 🔴 WHY THIS BOARD EXISTS, AND WHY EVERY CARD READS THE ARTEFACT AND NOT THE SCREEN

Reported live by David and Lauren, 2026-09-08: the route optimised, the screen showed a changed
stop order, and the link handed to Google Maps carried the stops **in the order they were rung up**.

⚠️ **A BOARD ALREADY CLAIMED TO COVER THIS, AND ITS CLAIM IS WHY NOBODY LOOKED.** The archived story
*"Route the day's deliveries"* is marked **OWNER-PROVEN 2026-07-03** and says the stops are reordered
shortest-path *"so **the pins, the on-card list, and the route all agree**."* All three of those are
on Lauren's screen. The Google Maps link appears in that story only as a **degradation fallback**.
So the handoff was proven as a fallback and used as the product.

**Therefore: no card below passes by looking at `/deliveries`.** Every one of them opens, reads, or
receives the thing that leaves. A card that can be satisfied from the route screen would repeat the
error that produced this board.

---

## CARD 1 — the link carries the order the screen shows
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** — (was covered 2026-09-09, David, live, LAWNS)

✏️ **FLIPPED `covered` → `owed` 2026-09-11 (ledger #301, OP-14 clause 3).** The handoff derivation is
unchanged, but the stop list that FEEDS it on `/deliveries?date=` was rebuilt: stops are now read
through `readStops` and rendered as the shared `<StopCard>`, and their address is the stop's own
ship-to via `shipToLine` rather than a synthetic customer object. A green check on a moved surface
asserts a proof nobody performed. The 2026-09-09 run below stays as the record of what passed then.

✅ **COVERED — David, live, 2026-09-09, LAWNS, build `f5f40e3`. THE FIRST RUN IN THIS FEATURE'S
HISTORY.** Saturday 09-12, **8 stops**. Google's own panel returned:

`400 Honey Comb Mesa → 348 Blue Oasis Ln → 2020 Saco St → 3809 Alpine Rdg Cv → 602 Hereford Lp →
405 Captain Grumbles Dr → 104 Longwedge Ln → 321 Logan Ranch Rd → 280 Whitney Woods Cir →
400 Honey Comb Mesa`

— **identical to the on-screen optimised list, in order, round trip.** Independent corroboration:
**Google 2h 22m against Cultivar's 2h 21m.** The reported defect — the link carrying rung-up order —
is dead.

⚠️ **TWO LIMITS RECORDED, because the card is only worth what its conditions were:**
① **it required two address corrections first** — the route could not be built until they were made,
so this is a proof of the handoff, not of address quality; ② **Google's render was read on DESKTOP.**

✏️ **I FILED THIS RUN ON CARD 1 ALONE AND DAVID OVERRODE IT — CORRECTED 2026-09-09.** My call was
that a desktop read could not touch CARD 2. **Cultivar's screen was on the PHONE**; only Google's own
render was read on desktop. **CARD 2 is now `covered` with its unevidenced half named on the card.**
Both cards are satisfied by this one run — CARD 1 is the desktop link, CARD 2 is what the driver
receives — and they are recorded separately because they assert different things.


1. Open `/deliveries`. Select **4 or more** stops at spread-out addresses — you want a set whose
   shortest-path order is genuinely different from the list order. *(The list is newest-order-first,
   so picking four customers in different directions is usually enough.)*
2. Press **Route N Stops** and wait for the map to draw a road-following line. The summary must read
   `… miles · … drive · optimized order` — if it does not, Directions did not resolve and this card
   cannot be run; note that and stop.
3. **Write down the numbered list, top to bottom, by customer name.**
4. Press **Open in Google Maps**.

**PASS:** the destinations in Google Maps appear in **exactly** the order you wrote down in step 3.
**FAIL:** any difference in order — including one pair swapped. 🔴 **This is the reported defect. If
this card fails, nothing else on this board matters.**

---

## CARD 2 — 🔴 the text the installer receives
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** — (was covered 2026-09-09, David, live, LAWNS, passed with one limit)

✏️ **FLIPPED `covered` → `owed` 2026-09-11 (ledger #301, OP-14 clause 3)** — for the same reason as
CARD 1: the stop list that feeds the handoff on `/deliveries?date=` was rebuilt. Re-run it with the
new `stop` board's CARD 6 (a changed ship-to must reach the link).

✅ **COVERED — PASSED WITH A NAMED LIMIT. David, live, 2026-09-09, LAWNS, build `f5f40e3`. THE FIRST
RUN IN THIS FEATURE'S HISTORY, and this is the card the whole build was for.**

**Method:** Saturday **2026-09-12**, 8 stops → **Route this day** → link opened in Google Maps.
Google's own directions panel returned, in this order:

`400 Honey Comb Mesa → 348 Blue Oasis Ln → 2020 Saco St → 3809 Alpine Rdg Cv → 602 Hereford Lp →
405 Captain Grumbles Dr → 104 Longwedge Ln → 321 Logan Ranch Rd → 280 Whitney Woods Cir →
400 Honey Comb Mesa`

**Byte-identical to the on-screen optimised list, round trip from the farm.** Independent
corroboration: **Google 2h 22m against Cultivar's 2h 21m.** The reported defect — the link carrying
the order things were rung up in — is dead.

🔴 **WHICH HALF IS EVIDENCED, AND WHICH IS NOT — STATED RATHER THAN LEFT TO THE TICK:**
✅ **Cultivar's screen was read ON A PHONE.** ❌ **Google's own render was read on DESKTOP.**
So the **order parity** is proven and the **mobile waypoint behaviour is not** — and mobile is where
the documented cap drops from 9 to 3 (CARD 8, tech-debt #223). At 8 stops nothing truncated on
desktop; whether the same link truncates when Google opens it in a phone browser is **the open half**,
and it is the same question CARD 8 asks.

⚠️ **SECOND LIMIT: THE RUN REQUIRED TWO ADDRESS CORRECTIONS BEFORE IT COULD BE BUILT AT ALL** —
`321 Logan Randy Rd` → `321 Logan Ranch Rd` and `104 Long Wedge Lane` → `104 Longwedge Ln`. **Either
one alone blocked the whole route.** This is a proof of the handoff, not of address quality — and the
defects that fell out of it are tech-debt **#226** and **#227**.


**This is the card the whole build is for.** Lauren texts the route; nobody has ever checked what
arrives.

1. With the route from CARD 1 still on screen, press **Text Route to Driver**.
2. Send it to **your own phone**, not the installer's.
3. On the phone, open the message and **tap the link**.

**PASS:** the stops in Google Maps are in the same order as the list you wrote down in CARD 1 step 3,
**and** the number in the message text — *"Today's delivery route (N stops)"* — equals the number of
customer stops in that link.
**FAIL:** a different order, or a count that does not match the stops in the link.

⚠️ **Do not skip the tap.** Reading the URL text in the message body is not the test — the test is
what Google Maps shows when it opens.

---

## CARD 3 — Copy gives the same route as the button
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

1. Same route on screen. Press **Copy Route Link**.
2. Paste it into a new browser tab.

**PASS:** identical destination order to CARD 1 and CARD 2 — three artefacts, one route.
**FAIL:** any of the three differs from the others.

---

## CARD 4 — 🔴 the count and the link agree when an address is missing
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

This is the second defect, and it needs a deliberately messy selection.

1. On `/deliveries`, select **5 orders**, of which **2 have no address** (they show an
   *"Enter delivery address…"* box rather than a pin and a street).
2. Leave those two boxes **empty**. Press **Route N Stops**.
3. Read the header: **`Route ready — N stops`**.
4. Press **Text Route to Driver** and read the message body.
5. Open the link and count the customer destinations (ignore the farm at each end).

**PASS:** all three numbers are **3** — the header, the text, and the destinations in the link.
**FAIL:** any of them reads **5**. 🔴 **Before this build the text said 5 above a three-stop link.**

---

## CARD 5 — changing the selection retracts the route completely
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

1. Build a route. Confirm the card, map and buttons are showing.
2. Tick **one more** order in the list above.

**PASS:** the route card disappears and the **Route N Stops** button returns. Pressing it rebuilds,
and the new route includes the stop you just added.
**FAIL:** the route card stays, or the buttons remain and still open the previous route — a link
that outlives the selection it was built from is the same defect wearing a different coat.

3. Repeat with **Rebuild Route**, and again by **typing into an empty address box** on a selected
   order. All three must retract the route the same way.

---

## CARD 6 — an un-optimised route is still a working route
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —

The optimiser is allowed to fail; the handoff is not allowed to disappear with it.

1. Build a route with **one** stop selected (too few points for Directions to optimise).

**PASS:** no `optimized order` line appears — the summary is honest about not having optimised — and
**Open in Google Maps**, **Text**, and **Copy** all still work and carry that one stop, bookended by
the farm.
**FAIL:** a missing or dead link, or an `optimized order` claim on a route that was not optimised.

---

## CARD 7 — the farm is at both ends
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** — (was covered 2026-09-09, David, live, LAWNS)

✏️ **FLIPPED `covered` → `owed` 2026-09-11 (ledger #301, OP-14 clause 3)** — the stop list feeding the
route on `/deliveries?date=` was rebuilt; see CARD 1. Settled by the same re-run.

✅ **COVERED — David, live, 2026-09-09, LAWNS, build `f5f40e3`.** The same Google panel read
**`400 Honey Comb Mesa` first and last** — the driver leaves the farm and returns to it. Settled by
the CARD 1 run; recorded separately because it is a separate assertion.


1. Open any built route's Google Maps link.

**PASS:** the first and last destinations are both **400 Honeycomb Mesa, Leander** — the driver
leaves from the farm and comes back to it.
**FAIL:** the route starts at the driver's current location, or ends at the last customer.

---

## CARD 8 — ⚠️ the waypoint cap on a long day
**STATUS:** needs-test · **DEVICE:** phone · **LAST-PROVEN:** —

> ⚠️ **PARTIALLY ANSWERED 2026-09-09 — AND IT STAYS `needs-test`, BECAUSE WHAT WAS MEASURED IS NOT
> WHAT THIS CARD ASKS.** On the 8-stop Saturday route, **Google accepted 10 waypoints (origin + 8 +
> destination) with no truncation and no cap warning.**
>
> 🔴 **THAT DOES NOT TEST THE CAP, AND SAYING SO IS THE POINT.** Eight intermediate stops is **below**
> Google's documented desktop cap of 9, and it was read **on desktop**. This card is `DEVICE: phone`,
> where the documented cap is **3**. The run is real evidence that nothing truncates at 8 on desktop;
> it is not evidence about the surface Lauren actually texts to.
>
> 🔴 **THE METHOD IS REWRITTEN, ON DAVID'S INSTRUCTION, BECAUSE THE OLD ONE COULD NOT BE RUN.** It
> said "build a 12-stop route" — **no LAWNS day has 10 or more stops** (measured: 1–14 per day, mean
> 3.6, but the 14 is not a single deliverable day), and the only way to manufacture one on LAWNS is to
> **re-date live delivery rows, which is forbidden.** Instead, do **either**:
> **(a)** select stops across **multiple days** in one route build — the selection is not date-bound; **or**
> **(b)** seed 12 stops on **Test Dave's** and build the route there.
> Then text it, **open it on a phone**, and count the destinations that actually arrive.

🔴 **DELIBERATELY NOT TESTED HERE, AND THE REASON IS THE POINT.** Google's documented URL form caps
waypoints at **9 (desktop) / 3 (mobile browser)** and **ignores the excess silently**. We emit an
undocumented path form whose cap is unknown. **Measured from LAWNS's own invoice export 2026-09-08:
stops per delivery day run 1–14, mean 3.6 — 69 of 167 days (41%) exceed 3 and 7 of 167 (4%) exceed
9.** Lauren texts this link to a phone.

That is **truncation, not mis-ordering** — a driver receiving a partial route with nothing telling
him so, which is worse than the wrong order — and it is **a separate decision David has not made**
(`docs/decisions/2026-09-08-maps-url-waypoint-cap-report.md`). Marked `needs-test` rather than
written as a passing card, because a card that quietly tested 3 stops would report green on the one
question this build did not answer.

**When it is decided,** this card becomes: build a **12-stop** route, text it, open it on a phone,
and count the destinations that actually arrive.
