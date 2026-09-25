# CHECKOUT ADDRESS CHECK — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** An amber `PREVIEW <branch>`, `prod⚠ <branch>`, `env?`
> or `local` chip means **this is not production** and the SHA being right does not rescue it.

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live).
>
> **This file is the ONLY source of truth for the address-check owner tests.** It is STANDING — run
> it after any change to `addressStep.ts`, `geocodeResult.ts`, `geocodeFreshness.ts`,
> `AddressInput.tsx`, the `customers/create` geocode proxy, or the charge suppression in
> `orders/submit.ts`.

**Purpose:** prove the one thing the whole build rests on — **`status: OK` from Google does not mean
the address exists.** The verdict is decided by `location_type`, and the check finds addresses that
**cannot be placed**, never addresses that are "correct": *415 Main* typed for *451 Main* comes back
a confident ROOFTOP pin on the neighbour's house, and nothing here will ever catch that.

**Board: 0 of 14 covered** (0 `covered` · 14 `owed`) — every card is written and none has been run.
🔴 **Thunder never sets `covered` (OP-14).** These flip only on David's live run.

**The order matters.** CARD 1 is the regression Lauren would hate and must be run first: if a
homeowner with a good saved address is asked *anything*, the rest of the board is beside the point.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Only David sets this. |
| `STATUS: owed` | 🟡 Written but not run since the surface changed. **Not proven.** |
| `DEVICE:` | `phone` (capture) · `desktop` (reconcile/admin) · `either`. |
| `COVERS:` | The ledger row / ruling this check defends. |

---

### CARD 1 — 🔴 a homeowner with a good saved address is asked NOTHING
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: ledger #386 · David 2026-09-24 ("never two questions for one address")

Pick a customer whose delivery address you have used before and who has a coordinate on file
(one of the ones the geocode run located). Start a checkout, add a tree, choose delivery.

**PASS:** the address appears, you press on, and **no extra question, banner, spinner or
confirmation appears anywhere.** The checkout feels exactly as it did last week.
**FAIL:** anything extra at all — including a flicker of "checking…". This is the regression the
build is most likely to have introduced, which is why it is card 1.

*Why it is silent: a saved address that was FOUND and is less than 30 days old is not sent to
Google at all. Freshness is checked BEFORE the call, not after.*

---

### CARD 2 — a good new address is checked silently
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: R-180 (ROOFTOP → found, silent)

New customer. Type a **real, ordinary Leander or Georgetown street address** in full — one you know
exists, with the house number. Do not pick from the suggestion list; type it and move on.

**PASS:** it saves, and **you are asked nothing.** The delivery is priced normally.
**FAIL:** any question about an address you know is fine.

---

### CARD 3 — a near-miss asks ONCE, and shows you both
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: David's ruling 2026-09-24 (RANGE_INTERPOLATED requires confirmation)

Type a real street with a **house number that does not exist on it** — a number far past the end of
the street. Google will place it between two houses (RANGE_INTERPOLATED) or correct it.

**PASS:** **exactly one** question appears, showing **what you typed** and **what Google says**, with
**neither one pre-chosen**. You pick one, and that is the end of it — no second question.
**FAIL:** two questions · a pre-selected answer · Google's version saved without you choosing.

*"A tap is cheap; a wrong pin sends a truck to the wrong place" — David, 2026-09-24.*

---

### CARD 4 — 🔴 the typo test, BOTH WAYS — this is the honest limit of the whole feature
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: R-180 · the measured table

**(a)** Type a real address with a **misspelt street name** — enough that Google has to guess.
**PASS (a):** either it asks you to confirm the correction, or it cannot place it. Never silent.

**(b)** 🔴 **Now type a real address with the WRONG HOUSE NUMBER on a real street — say 415 where the
customer is at 451.**
**PASS (b):** **it saves silently and prices normally, with no question at all.**

**That is a PASS, and it is the most important line on this board.** 415 is a real house. Google
returns a confident ROOFTOP pin on it. Nothing in this build can tell that from the right answer,
because there is nothing wrong with the address — it is simply someone else's. **This check finds
addresses that cannot be PLACED. It does not find addresses that are WRONG, and it never will.**
If you expected (b) to be caught, the feature has been oversold to you and this card is where you
find that out.

---

### CARD 5 — nonsense is SAVED, marked unverified, and never priced
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: Rule 24 · 2026-09-18 (surfaced, never priced, never guessed)

Type an address that cannot exist — `qqqq zzz` — and continue.

**PASS:** it **saves anyway**, says in words that it could not be found, is marked unverified, and
**the delivery charge is not applied**. The order still goes through.
**FAIL:** the save is blocked (Liberty Hill is 35% new streets — blocking would stop real work) ·
a delivery charge appears anyway · it is silently dropped.

---

### CARD 6 — 🔴 the charge suppression holds even if the screen is lied to
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: §1.6 item 10 (money-safety: server-authoritative)

Place an order to the unplaceable address from CARD 5 and submit it. Then open the order.

**PASS:** there is **no transport/trip charge line** on the saved order, and the total matches.
**FAIL:** a charge appears on the stored order even though the screen showed none.

*The server does its own geocode at submit and decides the charge itself. It does not trust a flag
the browser sent — an earlier draft did, and a browser flag is not tamper-defended.*

---

### CARD 7 — autocomplete offers real addresses
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: ledger #386 · location bias

In any address field, type **`153 Twin Cr`** and stop.

**PASS:** a list of real, complete addresses appears and one of them can be picked.
**FAIL:** no list at all, or a list you cannot pick from.

**PASS:** **`153 Twin Creekview Ln, Georgetown`** is the FIRST suggestion.

⚠️ **LOCATION BIAS IS NOT WIRED YET AND THIS CARD STILL PASSES WITHOUT IT.** `CustomerCapture` sets
the bias centre to `null` until the yard's own coordinate is stored. Re-measured 2026-09-24 against
the real depot: unbiased and biased BOTH put Twin Creekview first. Bias changes ranks 2–5 from
scattered (Jonestown PA, Comanche, Del Valle) to Central Texas (Manchaca, Dripping Springs, Burnet)
— a shorter list of plausible neighbours, so a smaller chance of a mis-tap.

✏️ **A CORRECTION TO THIS CARD'S FIRST DRAFT.** It said unbiased returns *Apex, North Carolina* and
told you not to expect the right town. That figure did not reproduce when measured again with the
region filter the proxy actually sends. It had been written into the code comment, this card and
two reports without anyone re-deriving it — [[R-26]], inside the build that exists to stop exactly
that.

🔴 **WHAT HAS NOT CHANGED: autocomplete does not catch everything.** Type **`Long Wed`** (for
Longwedge). Measured the same day, biased on the yard: it returns Sullivan ME, Wedowee AL,
Salisbury NC — nothing in Texas at all. **A list that looks confident can still hold nothing you
want.** That is why the ③ check exists behind it.

---

### CARD 8 — typing over a picked address forgets where it was
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: the regex defect found 2026-09-24

Pick an address from the suggestion list. Then, **without clearing the field**, type a different
street over it and save.

**PASS:** the new address is treated as typed — it is checked, or asked about, or saved unverified.
**FAIL:** it saves instantly as though located. That would mean it kept the **coordinate of the
address you replaced**, and the truck goes to the old place.

*The previous per-screen version of this guard never fired: it matched `onChange={(e) =>` while the
real file wrote `onChange={e =>`. The shared field removes the whole class.*

---

### CARD 9 — it still works when Google does not
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: Rule 24

Turn the wifi off mid-checkout (or use a device with no signal), then type an address.

**PASS:** the field keeps working as a plain text box, **says out loud** that suggestions are
unavailable, and the order can still be completed.
**FAIL:** entry is blocked · it spins forever · **it goes quiet with no message** — a field that
silently stops suggesting looks like a field with nothing to suggest, and the person types on
believing they saw every option.

---

### CARD 10 — the stop remembers where it was
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's stops ruling · 20260923d

Take a delivery order to a good, real address and submit it. Then open that stop on the delivery
schedule (or ask David to read the row).

**PASS:** the stop carries a latitude and longitude, set at the moment the order was taken.
**FAIL:** the coordinate is empty on a stop whose address was found.

*Found 2026-09-24, at the merge boundary: the server was already geocoding this address to decide
whether the delivery could be charged, kept only the yes/no, and threw the coordinate away.
`deliveries.latitude` had been live since 20260923d with nothing writing to it. Every unit test
passed, because each tested a function on its own and none asked whether its answer was used.*

---

### CARD 11 — 🔴 "Use what I typed" is always there
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: David 2026-09-24, guard 1

Type **`101 Crupp`** into a delivery address. This is a REAL LAWNS stop — 101 Crupp Avenue,
Liberty Hill.

**PASS:** a suggestion list appears AND, at the bottom of it, **`Use what I typed — 101 Crupp`**.
Tap that; the address is kept as you typed it and goes through the ③ check.
**FAIL:** the only way forward is to pick one of Google's suggestions.

🔴 **WHY THIS IS THE MOST IMPORTANT CARD ON THE BOARD.** Measured 2026-09-24: with the service
area restricted, that query returns **exactly one** suggestion — *101 Crupp Ct, **Austin*** — and
the real Liberty Hill street is **not in the list at all**. Restricting removes the wrong answers;
it does not produce the right one. Without this escape the counter is a dead end for every new
street in Lauren's own town, which is a third of it.

---

### CARD 12 — picking another town asks first
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: David 2026-09-24, guard 2

Type the street **and the town**: `101 Crupp`, town **Liberty Hill**. Then tap the suggestion
**`101 Crupp Ct, Austin, TX`**.

**PASS:** one question — *"You typed Liberty Hill; this suggestion is in Austin."* — with **Use
it** and **Keep what I typed**, neither pre-chosen. Nothing is saved until you choose.
**FAIL:** it is taken silently. That address is real, confident, and **34 miles the wrong way**,
and a picked suggestion is stored as located with no second check.

---

### CARD 13 — the same pick in the SAME town asks nothing
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: guard 2, the negative control

Type `153 Twin Cr` with town **Georgetown**, and tap `153 Twin Creekview Ln, Georgetown, TX`.

**PASS:** it is taken **silently** — no question.
**FAIL:** a question. A guard that fires on the ordinary case gets switched off within a day, and
then it is not watching CARD 12 either.

⚠️ Also check: type a street with **no town at all** and pick a suggestion. **No question** —
someone who has not said where they mean has not been contradicted.

---

### CARD 14 — a ship-to is fenced; a vendor is not
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: David 2026-09-24, guard 3

**(a) DELIVERY address** — type `153 Twin Cr`.
**PASS (a):** every suggestion is Central Texas. Measured restricted: Georgetown, Dripping
Springs, Burnet, Georgetown, Dripping Springs. **No Pennsylvania.** (Unrestricted it offers
*Jonestown, PA*.)

**(b) VENDOR address** (Settings → Vendors) — type an out-of-state street you know, e.g.
`100 Main St, Nashville`.
**PASS (b):** it is offered. A vendor can be anywhere — a tenant buys out of state, and fencing
that would make correct addresses impossible to enter rather than merely rank them low.

⚠️ **UNTIL YOUR RINGS EXIST THERE IS NO FENCE, AND THE FIELD SAYS SO RATHER THAN PRETENDING.**
The boundary is the outer ring plus a margin; with no rings it seeds from the farthest located
past delivery. Measured 2026-09-24: **0 of 66 stops and 0 of 1,497 addresses carry a coordinate**,
so neither source exists yet and a delivery field currently behaves like (b). It switches on when
the rings land or the bulk geocode runs. **No radius is ever invented** — a made-up fence refuses
real customers silently, which is worse than ranking badly.

---
