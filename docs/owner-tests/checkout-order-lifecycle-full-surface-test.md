# OWNER TEST — THE ORDER'S LIFE AT THE COUNTER: LEAVING IT, KEEPING IT, DISCARDING IT

> 🔴 **GATE 0 · BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · <where>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a failed
> or unmerged build looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel deploys
> the TREE and *any* push to `main`, docs included, moves the stamp. *(OP-15.)*
> 🔴 **AND THE LAST TOKEN MUST READ `prod`.** An amber **`PREVIEW <branch>`**, **`prod⚠ <branch>`**,
> **`env?`** or **`local`** is **not production**, and a matching SHA does not rescue it. *(tech-debt #280 ②.)*

**Capability:** 2.1 Cart / QR checkout · **Ledger:** #387 (this board's cards 1–5) · #389 (parked orders, cards to follow)
**Board: 0 of 5 covered** (5 `owed`). Thunder writes the cards and sets `owed`; **only David's live run flips a card to `covered`, with a date.**

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

### CARD 5 — 🔴 THE HONEST LIMIT, SO YOU SEE IT BEFORE LAUREN DOES
`STATUS: owed` · `DEVICE: phone` · `LAST-PROVEN: —`
**WHO:** David · **COVERS:** #387 · names what **#389** must fix

On a **phone**, start an order with two lines. Lock the phone, wait a couple of minutes, unlock, and
return to the browser. Then separately: pull to **refresh** the page.

**PASS *for #387*:** the order may well be **gone** — and that is the honest, expected result of
this build, which persists nothing. **This card is PASS when the loss is what you observe**, because
it tells you exactly how much #389 is worth.
**FAIL:** the app shows a stale order it cannot actually submit, or an error rather than an empty
start. 🔴 **Write down which of the two happened** — locking and refreshing are different evictions
and #389 must survive both. *(Provable without a console.)*
