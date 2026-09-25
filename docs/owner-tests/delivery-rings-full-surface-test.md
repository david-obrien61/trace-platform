# DELIVERY RINGS — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** An amber `PREVIEW <branch>`, `prod⚠ <branch>`, `env?`
> or `local` chip means **this is not production** and the SHA being right does not rescue it.

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live).
>
> **This file is the ONLY source of truth for the delivery-ring owner tests.** It is STANDING — run
> it after any change to `deliveryRings.ts`, `ringWriter.ts`, `RingMap.tsx`, the Delivery section
> of `Settings.tsx`, `deliveryRingsRead.ts`, the transport row on `CartReview.tsx`, or the
> `ringPrice` block in `api/orders/submit.ts`.

**Purpose:** prove that a delivery is priced by **where it is going**, and — far more important —
that **nothing is ever priced by guesswork.** Three of these cards exist only to prove a charge
does *not* appear: beyond the last ring, on an address we cannot place, and on a business that has
set no rings at all. The last of those is the one protecting money that is already being taken.

**Board: 0 of 12 covered** (0 `covered` · 12 `owed`) — every card is written and none has been run.
🔴 **Thunder never sets `covered` (OP-14).** These flip only on David's live run.

🔴 **CARD 1 RUNS FIRST AND IT IS THE ONE THAT CAN COST MONEY TODAY.** Every other card describes a
new capability. Card 1 asks whether the delivery charge LAWNS already bills still appears, on a
business whose rings are not set up. If that fails, stop and say so — nothing else matters.

⚠️ **MIGRATION STATE MATTERS ON THIS BOARD.** `20260925e` (Trip Charge → `pricing_basis = 'ring'`)
is **HELD AND UNAPPLIED** as this is written. Cards 1–4 are true either way. Cards 5–9 need either
that file run, or the Services-screen control used by hand (CARD 5 does exactly that, which is why
it comes first among them).

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Only David sets this. |
| `STATUS: owed` | 🟡 Written but not run since the surface changed. **Not proven.** |
| `DEVICE:` | `phone` (capture) · `desktop` (reconcile/admin) · `either`. |
| `COVERS:` | The ledger row / ruling this check defends. |

---

### CARD 1 — 🔴 a business with NO rings still bills its delivery charge, exactly as before
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: ledger #386 · deliveryRings.ts H4 ("no rings is not outside the rings")

On a tenant that has **no delivery rings set up** (Test Dave's, or LAWNS before `20260925d` was
run), take a normal delivery order: add a tree, choose the staff delivery option, enter an address.

**PASS:** the delivery charge on the review screen is **the same number it has always been** — the
price on the service row — and the line beneath it reads *"No delivery rings set up yet — your
usual delivery charge applies."*
**FAIL:** the charge is $0.00, missing, or different from the service row's price.

*Why this is card 1: to a tenant with no rings, EVERY address is outside them. Code that collapsed
"no rings" into "outside the rings" would strip the delivery charge from every order on the day it
shipped, before a single ring existed. This card is that defect's only live tripwire.*

---

### CARD 2 — the ring map opens on the yard, and it is the yard from Business profile
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David 2026-09-24 ("do NOT create a separate depot setting — one fact, one place")

Settings → **Delivery**.

**PASS:** a Google map, centred on **your business address as it is typed in Settings → Business
profile**, with a pin on it. There is **no field anywhere on this screen for entering a depot,
yard or origin address.**
**FAIL:** the map is somewhere else, or the screen asks you where your yard is.

*Change the address in Business profile, come back, and the map centre follows it. If it does not,
the depot has quietly become a second copy of one fact.*

---

### CARD 3 — dragging a ring's edge and typing in the list move together
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #386 · the approved 2026-09-16 demo

With at least two rings on screen: **drag the outer edge of one ring** and watch the list.

**PASS:** the mileage in the list changes **as you drag**, in step. Then type a different mileage
into the list and **the circle on the map resizes to match**, without a save or a reload.
**FAIL:** either one lags, needs a save first, or the two disagree at any moment.

---

### CARD 4 — beyond your last ring is shaded, labelled, and NOT priced
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David 2026-09-23 ("beyond the last ring: show, don't price")

Look at the area outside your largest ring on the map.

**PASS:** it is shaded, and it carries the words **"$3.50–$4.50 per loaded mile, round trip"**.
There is **no charge figure** and no "everywhere else" ring in the list.
**FAIL:** an outer ring appeared with a price on it, or the shaded area names a dollar amount for a
delivery.

*A number invented for a distance you have not priced would read as a quote.*

---

### CARD 5 — 🔴 LAUREN CAN SWITCH TRIP CHARGE TO RING PRICING HERSELF
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David 2026-09-25 (Rule 29 — "a choice on the Services screen so Lauren can change it herself")

Settings → **Services** → press **Edit** on **Trip Charge**.

**PASS:** inside the transport block, below "Requires a destination address", there is a control
reading **"How this one is priced"** with two choices — *Flat — the price above, on every order*
and *By distance — the delivery ring the address lands in*. Choose **By distance**, and the
paragraph beneath changes to describe the rings. Press Save. Re-open Edit: **your choice is still
there.**
**FAIL:** no such control; or it is there and the choice does not survive re-opening (a dead
affordance — §1.6 item 5).

*This is the whole point of the Rule 29 half: the held SQL file sets it once, this control means
the next change never needs a migration or a person who can write one.*

---

### CARD 6 — the choice is PER ROW: Tailgate stays flat while Trip Charge goes on the ring
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David 2026-09-25 ("Tailgate and Backyard stay flat until David rules")

With Trip Charge set to *By distance* (CARD 5), press **Edit** on **Tailgate Delivery**.

**PASS:** Tailgate's own "How this one is priced" reads **Flat**. Changing Trip Charge did not
change it.
**FAIL:** Tailgate also reads *By distance* — the setting has leaked from one row to another and
is business-wide, which is precisely what it must not be.

---

### CARD 7 — 🔴 THE CARD DAVID WROTE: a located Hutto address on Trip Charge shows the ring price
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: David 2026-09-25 (the acceptance card)

On LAWNS with rings seeded (`20260925d`) and Trip Charge on *By distance*: take an order to a
**Hutto** delivery address that the address check can place.

**PASS:** the Trip Charge line shows **$250.00**, the small line under the name reads
**`ring 4 — 22.3 mi`**, and beneath that: *"22.3 straight-line miles — inside your 35.7-mile ring."*
**FAIL:** a different amount, or no ring named.

> ⚠️ **THIS CARD CORRECTS THE PROMPT THAT ASKED FOR IT.** David's card said *"ring 4 — 30.x mi"*.
> The ring (**4**) and the money (**$250**) are right. The **mileage is not 30** — Leander yard to
> Hutto is **22.3 miles straight-line, measured**, and ~30 by **road**. This screen measures the
> crow's flight and says so in the sentence beneath; presenting road miles it has not calculated
> would be a promise the number cannot keep. **Accept 22.3, or road distance becomes a decision**
> (a different Google API, a per-request cost) — David's, and unmade.

---

### CARD 8 — the SAME order with Tailgate shows the flat $50
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: David 2026-09-25 (the acceptance card, second half)

Same customer, same Hutto address, but choose **Tailgate Delivery** instead.

**PASS:** **$50.00**, with the ordinary *per order · ×1* line under it and **no ring named.**
**FAIL:** a ring number appears, or the amount moved with the distance.

*This is the negative control for CARD 7: an order that priced the same way whichever service was
chosen would pass CARD 7 by accident.*

---

### CARD 9 — an address we cannot place is NOT priced, and says why
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: David 2026-09-18 ("unplaceable → no ring charge with the reason shown")

Take a delivery order to a nonsense address (the address check will offer *"Yes, it's correct —
save it anyway"*; take it).

**PASS:** the Trip Charge line shows **$0.00** with the line beneath reading *"We can't place this
address, so the delivery isn't priced here. Saved and flagged."* The order still goes through.
**FAIL:** a charge appears anyway; or $0.00 appears with **no explanation** — a suppressed delivery
is not a free one, and a silent zero says it is.

---

### CARD 10 — beyond every ring: no price, and it asks you for one
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: deliveryRings.ts H2/H3

An order to a real, placeable address well outside your largest ring (Waco, say).

**PASS:** the Trip Charge line shows **$0.00** with *"Outside your delivery rings — set a charge."*
**Adjust price** is offered, and typing an amount with a reason charges it.
**FAIL:** a charge was invented; or the line offers no way to set one.

---

### CARD 11 — 🔴 THE PRICE ON THE SCREEN IS THE PRICE ON THE RECEIPT
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: §1.6 item 10 (money-safety) · D-39

Run CARD 7 through to **Confirm**, then open the order.

**PASS:** the delivery charge on the confirmation and on the order detail is **the same $250** the
review screen showed.
**FAIL:** any difference at all. The review screen and the server compute this from the same pure
function, but the server re-reads the basis, the yard and the rings from the database and
re-geocodes the address — **so a mismatch means one of those reads disagrees with what you set**,
and that is worth stopping for.

---

### CARD 12 — a human override with a reason still stands
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: David 2026-09-25 ("a human override with a reason always stands")

On the CARD 7 order, press **Adjust price** on the Trip Charge line, enter **$180** and a reason.

**PASS:** $180 is charged, the line shows *−$70.00 off $250.00* with your reason, and it survives
to the confirmation.
**FAIL:** the ring price reasserts itself, or the override saves without demanding a reason.

⚠️ **ONE PLACE AN OVERRIDE IS REFUSED, AND IT IS DELIBERATE:** an address we could not place
(CARD 9) cannot be given a charge this way. There the question is not *how much* but *to where*,
and it is still unanswered.
