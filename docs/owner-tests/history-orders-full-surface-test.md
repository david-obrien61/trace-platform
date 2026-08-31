# OWNER TEST — HISTORY ORDERS (captured invoices become sales, and the dashboard tells the truth)

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance, no dashboard, no `git log`. *(GATE 0 · OP-15 · paid for on 2026-08-31: a whole
> session was spent hunting a defect in code that was never deployed.)*

**Capability:** 2.3 (OCR doc routing) · 3.5 (delivery) · dashboard readouts
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 10 covered.**

---

## ⛔ GATE 0 — DO THIS BEFORE READING ANY SCREEN (OP-15)

A failed Vercel build is **SILENT** — the last-good bundle keeps serving — and **Vercel deploys the TREE, not the COMMIT**. If the SHA under test is not live, every observation below is fiction.

1. `git log -1 --format=%h` on `main`.
2. Vercel dashboard: the deployment for **that exact SHA** reads **READY** (not a *different* push's Ready).
3. Open the app with `?debug=1` and confirm the **DebugPanel footer shows the same 7-char SHA**.
4. Hard-refresh.

If ①–③ do not agree, **STOP**. Do not record a pass or a fail.

---

## SURFACE: the order roster and detail

### CARD 8 — every line names itself; nothing reads "Unknown plant"
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #224

Open `/orders`. Open **Paul Christ's** order.

- The line reads **"Mexican Sycamore - 45 gallon"** and shows **MS45**.
- **No line anywhere on the screen reads "Unknown plant".**
- Check the roster, the order detail, the customer's order history on `/customers/…`, and the delivery route list — all four resolve the same way.

🔴 **What shipped in `2626e25`:** all eight orders rendered every line as *"Unknown plant"* while `description` sat unread on the same row. A history line carries **no** `business_inventory_id` by invariant — the stock left before this platform existed — so the lot-only resolver got null and printed a confident label over data it had never looked at. **The fix made the line self-describing; it did NOT fake a lot.**

### CARD 9 — statuses agree with their deliveries
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #224

On `/orders`, all eight history orders read **`Invoiced`**, not `Fulfilled`.

⚠️ **The word changed on 2026-08-28 and the rule did not.** R-STATUS was ratified — the vocabulary is now `pending · invoiced · fulfilled · cancelled`, matching QuickBooks — so the not-yet-delivered value that read `Confirmed` when #224 shipped now reads `Invoiced`. Same orders, same rule, same commitment against stock. **If you see `Confirmed` anywhere, the data migration did not run.**

🔴 **Saturday 2026-08-29 has not happened.** Five of these orders are for that day, one is for 09-12, and every delivery row still reads `scheduled`. `fulfilled` was chosen for a mechanical reason — it is one of only two statuses the committed-stock derivation excludes — and nobody checked whether it was true.

⚠️ **Lauren Frazier's 08-26 is `invoiced` too, and that is the rule being followed rather than a miss.** Her delivery row reads `scheduled`; nothing has ever marked a delivery complete in this system. If that install did happen, marking the delivery complete is what should flip the order — not editing the order.

### CARD 10 — a new capture lands `invoiced`, not `fulfilled`
STATUS: owed · LAST-PROVEN: — · DEVICE: phone · COVERS: #224

Scan a customer invoice for a **future** delivery date and schedule it.

- The new order reads **`Invoiced`**.
- Its line shows the description off the document, not "Unknown plant".

🔴 Before this fix the capture path wrote `fulfilled` at the moment of scanning — asserting that trees scheduled for a future Saturday had already left the property. **Ariel Thiry and Sherry Cooper are live proof it happened**: both were captured through the OCR door after `2626e25` shipped and both landed `fulfilled`.

---

## SURFACE: dashboard

### CARD 1 — the two tiles read what actually happened
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #223

Open `/dashboard` as the OWNER.

- **Installs this week** reads **5**.
- **Today's sales** reads **0**, with the sub-line *"No sales dated today"*.

🔴 **$0 is the CORRECT answer and is the whole point of the card.** LAWNS made no sale today; the six captured invoices are dated 08-22 through 08-26. Before this build the same screen would have reported **$14,370.21 of sales today** — six sales made across five earlier days, backfilled in one afternoon, all landing on the day the rows were written. **A confidently wrong number is worse than a zero, because nobody goes looking for it.**

The 5 installs are: Lauren Frazier (08-26) and the four Saturday 08-29 stops — Paul Christ, Ashcraft, Navarrette, Garza. **Josh Phelps must NOT be among them**: his planting is 09-12, and under the old unbounded query it counted as an install done this week.

### CARD 2 — the add-on banner stops certifying a positive it never measured
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #223

Same screen. The add-on panel reads **"4 sales this week — add-ons not assessed"**, in grey, with the explanation that they were captured from an existing invoice.

🔴 **It must NOT show the green check reading *"Every large-container sale included an add-on."*** That sentence was the `else` of a single condition, so it was asserted over any situation nobody enumerated — including a week with **zero sales**, and now a week of sales whose add-ons were never evaluated at all. Leakage is computed at checkout from resolved catalog lines and container sizes; a line transcribed off a photograph has neither, so `leakage_flag = false` on a history order means **unevaluated**, not **clean**.

### CARD 3 — a failed read says so instead of showing a zero
STATUS: needs-test · LAST-PROVEN: — · DEVICE: desktop · COVERS: #223

**REASON it is `needs-test` and not a check you can run today:** provoking a genuine read failure needs either a revoked RLS policy or an offline tab mid-load, and neither is a safe thing to do against a live customer tenant on the day their data landed. The behaviour is unit-tested (`dashboardWindows.test.ts` §C — a failed read outranks every other banner state, including "no sales"), and the honest record is that **nobody has watched it on a screen**.

What it should do when it happens: the tile shows **"Couldn't read"** and the words *"This number is unavailable right now — it is not zero"*, and the add-on panel says *"Add-on check unavailable… This is not a clean bill of health."* Before this build, an RLS refusal, a dropped request and a genuinely empty table all rendered an identical confident **0**.

---

## SURFACE: the OCR door

### CARD 4 — a new captured invoice becomes a sale, and moves no stock
STATUS: owed · LAST-PROVEN: — · DEVICE: phone · COVERS: #223

**Provable without a console** — read `/inventory` before and after.

1. Note the **Available** figure for any lot on `/inventory`.
2. Photograph a real customer invoice through the capture flow. Add the customer; schedule the delivery.
3. Open `/orders`. **One new order appears**, carrying **the number printed on that invoice** (LAWNS's own QuickBooks number, e.g. `3648.xxx`) — **not** a `CLV-…` number.
4. Its date is **the date on the document**, not today.
5. Return to `/inventory`. **Available has not moved.**

🔴 **Step 5 is the card.** A history order needs no decrement to do damage: available-to-sell is *derived* from open orders, so an order in the wrong status carrying a lot id silently reduces what LAWNS can sell, with no ledger row and nothing on any screen to notice.

### CARD 5 — a vendor receipt creates NO order
STATUS: owed · LAST-PROVEN: — · DEVICE: phone · COVERS: #223

Photograph a **vendor** receipt — hose, oil, emitters, anything bought *by* the farm. Confirm it after OCR.

- It saves as a receipt and appears as a cost.
- **No order is created.** `/orders` is unchanged.

*(David is out gathering exactly these today, so this will be exercised for real within days. Note: the McCoy's receipt that used to demonstrate this was removed in Stage 1 as pre-go-live test data — so this card needs a fresh one.)*

---

## SURFACE: QuickBooks

### CARD 6 — a history order cannot reach QuickBooks
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #223

Open any of the six backfilled orders and attempt a **Push to QuickBooks / re-push**.

- It is **refused**, with: *"This sale was captured from an existing invoice (#3648.629) that is already in QuickBooks. Pushing it would create a duplicate."*
- **Nothing appears in LAWNS's QuickBooks** — no invoice **and no new customer**.

🔴 **Why this card exists at all.** Every one of these six invoices has already been issued by LAWNS and already paid by the customer. A push would create a **second invoice for a settled sale, in a real customer's real accounting, under LAWNS's real name** — and there is no undo. Before this build "history orders don't push" was true only by accident (the push runs at the end of checkout, and checkout never makes one), while the manual re-push endpoint would have pushed any order id handed to it.

⚠️ **If no re-push control is visible in the UI, that is the expected finding, not a failure** — no caller exists today. Record it as such and the card stays `owed`.

### CARD 7 — a real checkout still works, and now keeps QuickBooks' invoice number
STATUS: owed · LAST-PROVEN: — · DEVICE: desktop · COVERS: #223

The regression card. Ring up a **normal** sale through `/checkout` and complete it.

- The invoice pushes to QuickBooks exactly as before.
- The confirmation screen shows the QuickBooks invoice number.
- The order carries a **`CLV-…`** number of our own **and** QuickBooks' own `DocNumber`.

🔴 **Two numbering schemes now coexist in one table, and this card proves they did not cross.** Ours lives in `notes`; the seller's lives in `source_document_number`. A checkout order must have the first and not the second; a history order must have the second and not the first.
