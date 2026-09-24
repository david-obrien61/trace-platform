# OWNER TEST — THE ORDER'S LIFE AT THE COUNTER: LEAVING IT, KEEPING IT, DISCARDING IT

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed
> or unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel deploys
> the TREE and *any* push to `main`, docs included, moves the stamp. *(OP-15.)*
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** An amber **`PREVIEW <branch>`**, **`prod⚠ <branch>`**,
> **`env?`** or **`local`** is **not production**, and a matching SHA does not rescue it. *(tech-debt #280 ②.)*

**Capability:** 2.1 Cart / QR checkout · **Ledger:** #387 (this board's cards 1–5) · #389 (parked orders, cards to follow)
**Board: 0 of 7 covered** — 6 `owed`, **1 `needs-test` with its reason (CARD 6: a prerequisite I could not establish — read it before planning that run).** Thunder writes the cards and sets `owed`; **only David's live run flips a card to `covered`, with a date.**

**TENANT:** any. **ACTOR:** whoever rings up an order — no permission is involved; nothing here is gated.

🔴 **THE ROOT THIS BOARD EXISTS FOR, IN DAVID'S WORDS (2026-09-23):** checkout was built **scan-first
for the yard**, and Lauren works **counter-first at a desk**. In the lot, abandoning a scan is the
common act and a fast discard is right. At a counter the order IS the work, and losing it in front of
a customer is the worst thing the screen can do. **Same button, opposite defaults.**

**Story:** ⚠️ **NONE.** `user_stories.md` has no story for parking or abandoning a sale. Recorded OPEN
rather than invented — a story is owed for this surface.

⚠️ **WHAT #387 DOES NOT DO, SO CARD 4 IS NOT MISREAD AS A FAILURE:** it persists nothing. Leaving the
screen keeps the order **in memory**, so back-then-return works *within the same page session*. A
refresh, a new tab, or a phone locking long enough for Safari to evict the tab still loses it.
**Parked orders (ledger #389) is that fix and is a separate build.**

---

### CARD 1 — 🔴 THE BACK ARROW KEEPS THE ORDER
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #387

Start an order at `/checkout/scan` and add **two different items**. Note the tally in the header.
Press the **back arrow** (top left).

**PASS:** you land on `/orders`, **with no dialog**. Navigate back into `/checkout/scan` — **both
lines are still there and the tally still reads 2.**
**FAIL:** the cart is empty when you return. That is the original defect: the arrow was wired to
`clear()`, so pressing it discarded the order silently.

### CARD 2 — DISCARD IS ITS OWN CONTROL, AND IT ASKS
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #387

Same order, two lines (say one item × 3 and one × 4). Press **"Discard this order"** under the cart.

**PASS, all four:** ① a dialog appears; ② it names **both** counts — *"2 items (7 plants)"*; ③ the
**Keep the order** button is the green primary and **Discard 2 items** is the outlined red one —
the safe act has the weight; ④ pressing **Keep the order** returns you to the order **with both
lines intact**.
**FAIL:** no dialog, or it says "Are you sure?" without the counts, or Discard is the primary button.

### CARD 3 — DISCARD ACTUALLY DISCARDS
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #387

Same again, but press **Discard 2 items**.

**PASS:** you land on `/orders`, and returning to `/checkout/scan` shows an **empty** order.
**FAIL:** the lines survive — then the confirm is decoration.

### CARD 4 — AN EMPTY ORDER DOES NOT ASK
`STATUS: owed` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #387

Open `/checkout/scan` and add **nothing**.

**PASS:** there is **no "Discard this order" control at all** — it only exists when there is
something to discard.
**FAIL:** the control is there, or pressing back raises a dialog. 🔴 **A confirm with nothing at
stake is the dialog people learn to dismiss unread, and it is what makes them dismiss the one that
mattered.** This card guards the confirm's credibility, not its presence.

### CARD 5 — 🔴 THE ORDER SURVIVES BOTH EVICTIONS. RUN IT BOTH WAYS.
`STATUS: owed` · `DEVICE: phone` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #389 — [[R-174]] ③–⑥

✏️ **THIS CARD IS REWRITTEN AND ITS EXPECTATION IS NOW THE OPPOSITE OF WHAT IT WAS.** Under #387 it
was PASS when the order was **lost** — that build persisted nothing and the card existed to show you
exactly how much #389 was worth. #389 is that build, so the same steps now expect the order to
**come back**. A green check left on the old wording would have asserted a proof of the opposite fact.

On a **phone**, start an order with two lines. Then do **both**, separately, and **write down which
you did** — locking and refreshing are different evictions and this must survive each:
1. **Lock the phone**, wait a couple of minutes, unlock, return to the browser.
2. **Pull to refresh** the page.

**PASS:** the order is still there **both times** — the same two lines, the same quantities — and you
can carry on and submit it. *(Provable without a console.)*
**FAIL:** it is gone, **or** it comes back and will not submit. A stale order that cannot be sent is
worse than none, because Lauren would find out in front of the customer.
🔴 **AND ONE MORE, WHICH IS THE POINT OF THE WHOLE THING: nothing may delete it on a timer.** Leave
an order parked overnight and open it in the morning. David: *"never expire, surface by age… nothing
deletes a customer's order on a timer."* It is cleared by exactly two things — a successful submit,
and the discard confirm.

### CARD 6 — 🔴 A SECOND BUSINESS IN THE SAME BROWSER DOES NOT SEE THE FIRST ONE'S ORDER
`STATUS: needs-test` · `DEVICE: desktop` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #389 — AC-3 through localStorage

**REASON IT IS `needs-test` AND NOT `owed`: I cannot establish the prerequisite.** This needs a login
that belongs to a **second business** in the same browser profile, and today a user is capped at one
business (`BusinessProvider`, max businesses/user = 1). Recording the hole rather than writing steps
nobody can run.

**WHAT IT WOULD PROVE:** park an order on Test Dave's, sign into another tenant in the same browser,
and the parked order must be **dropped, not resumed**. 🔴 **No RLS policy can see localStorage** —
this is the one tenant boundary the database cannot enforce, which is why `dropIfOtherBusiness` exists
and why it deserves a live proof rather than a unit test.

### CARD 7 — THE ORDER SAYS HOW OLD IT IS, AND THE AGE DOES NOT RESET
`STATUS: owed` · `DEVICE: phone` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #389

Start an order, add one line, wait a few minutes, then **add a second line**.

**PASS:** the order's age still counts from the **first** line, not the second.
🔴 **WHY THIS IS A CARD AND NOT A DETAIL:** re-stamping on every scan would make a two-hour-old order
look new — and the age is the only thing that will ever tell Lauren a parked sale has been forgotten.

start. 🔴 **Write down which of the two happened** — locking and refreshing are different evictions
and #389 must survive both. *(Provable without a console.)*
