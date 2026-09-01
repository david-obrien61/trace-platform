# QUICKBOOKS ORDER INGEST (THE LOAD) — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and an
> unmerged branch looks *completely normal* — the app just serves the old bundle. Match it to
> `git log --oneline origin/main -1` — **not to a SHA written in this file**, because Vercel
> deploys the TREE and any push to `main`, docs included, moves the stamp. *(GATE 0 · OP-15.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and
> holds no data of its own).
>
> **This file is the ONLY source of truth for order-ingest owner-tests.** It is STANDING, not
> dated — run it after any change to `invoiceOrderLines.ts`, `historyOrderWriter.ts`, the
> `orders-*` branches of `api/qbo/router.ts`, or `QboOrderIngest.tsx`.

**DEVICE: desktop** — this is a reconcile-shaped act performed at a desk. It reads nineteen
orders and their lines and it is a money screen; it is not a lot task
(`capture=mobile / reconcile=desktop`).

---

## 🔴 GATE 0 — TWO THINGS BEFORE ANY CARD

**① READ THE STAMP** (above). **② THE MIGRATION MUST BE APPLIED.**
`supabase/migrations/20260831c_orders_qb_invoice_uidx.sql`, in the **SQL editor** (not the table
editor — §6 r17). 🔴 **Run its two BEFORE queries first and read the answers** — the second one
must return zero rows, and if it does not, do not apply it: two orders against one invoice is a
defect to look at, not a state to index around. Until it is applied the panel says so **by name**
and the Record button stays disabled; that is CARD 2, and it is the only chance to see the
refusal working.

---

## 🔴 WHY THIS BOARD EXISTS

The delivery ingest put nineteen stops on the calendar and **not one of them says what is on the
truck.** Saturday 5 September shows six stops and nothing tells anyone whether that is a full day
or a light one — which is the question a day sheet exists to answer.

**What this board is actually guarding against is not a missing line. It is a moved number**, and
there are two of them. These are recorded as sales in the seller's own reporting, so: a sale that
quietly holds stock reduces what LAWNS can sell with no ledger row and nothing to reverse
(**CARD 5**), and a sale recorded twice inflates their revenue with nothing to notice
(**CARD 4b**). 🔴 **Those two are the cards to run even if you skip the rest.**

---

## CARD 1 — The plan, and every line is on screen
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Settings → Accounting → **Preview the loads**.

- The line reads **"N stops on your calendar came from a QuickBooks invoice"** — that is the
  denominator, and it should be the number the delivery ingest wrote (19 at the time of writing).
- Each row shows the delivery date, the invoice number, **the date the sale happened** and a line
  count. Click a row: **every line, with its item code, description, quantity and price.**
- **Stock held reads `none` on every row.** That column is the invariant, said per row.
- **Nothing has been written.** Reload: the table is gone, `/orders` is unchanged.

---

## CARD 2 — Before the migration, it refuses and NAMES the blocker
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Do this **before** applying `20260831c`. Press **Preview the loads**.

- An amber panel, not a crash and not a silent empty table.
- It names **`20260831c_orders_qb_invoice_uidx.sql`** in full and says why: without it a second run
  would give every stop a second order.
- **The Record button is disabled.**

🔴 **This is the only card that cannot be re-run casually** — once the index exists, reproducing
this means dropping it. Run it in the right order or accept that it stays owed.

---

## CARD 3 — 🔴 RECORD THE LOADS, THEN LOOK AT A DAY
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Press **Record N loads**.

- The summary reads **N loads · M lines · N stops joined to their order**.
- Go to the **operations calendar** and open **Saturday 5 September**. The stops that were blank
  now have something behind them.
- Open `/orders`. The new orders are there, each dated **when the sale happened** — August dates,
  not today's. 🔴 **If they are all dated today, stop and report it**: nineteen backfilled sales
  reporting as one afternoon's revenue is a confidently wrong number, which is worse than a zero.

---

## CARD 4 — 🔴 THE ORDER COUNT ROSE BY EXACTLY THE NUMBER OF INVOICES, AND BY NOTHING MORE
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Count `/orders` **before** pressing Record, and again after.

- Before: **9** (the history orders from the captured paper invoices, all dated 27 August).
- After: **9 + N**, where N is the number the panel said it would write.
- 🔴 **N is NOT automatically nineteen.** ⚠️ **CORRECTED 2026-09-01, and the correction is the
  point of CARD 4b:** any invoice that already has one of those nine orders behind it is **matched,
  not created**. So the honest expectation is *"nine plus whatever the panel promised"*, and the
  panel's number is the assertion. **If the count is HIGHER than the panel promised, stop** —
  something wrote outside the plan, and a duplicate sale is silent and permanent.
- The nine August orders keep **their same dates, totals and line counts.** The only thing that may
  change on one is that it now carries a QuickBooks invoice number — see CARD 4b.

---

## CARD 4b — 🔴 THE NINE CAPTURED SALES ARE MATCHED, NOT DUPLICATED
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

**Run this BEFORE CARD 4, on the preview, and read it carefully. It is the second most important
card on this board.**

LAWNS holds **nine history orders transcribed from photographs** of paper invoices. None of them
carries a QuickBooks invoice id — nothing in that path ever had one — so **the idempotency key is
blind to all nine**, and a pass keyed only on that column would create a second order for every
sale already captured. 🔴 **This is not theoretical: seven of the eighteen future-dated invoices
carry a `TxnDate` of 26 or 27 August, the exact window those nine were captured in, and six of them
share one date.**

On the preview, above everything else, there is a panel: **"N of these sales are already recorded
here — no second copy was created."**

- Every row names **their own invoice number**, what TRACE found, and what it will do.
- A row reading **"will match, not duplicate"** was matched on the invoice number **and** POSITIVELY
  corroborated by **at least two of** customer, date and amount, with none of the three disagreeing.
  Recording writes **only the invoice number** onto the order that already exists — never its money,
  its status or its lines — and joins the stop to it.
  - ✏️ **THE BAR TIGHTENED 2026-09-01 AND THIS SENTENCE USED TO BE WRONG.** It said "corroborated by
    customer, date and amount", which is what the code *intended*; what the code *did* was accept
    any row where nothing DISAGREED — so an existing order whose customer, date and money were all
    blank corroborated nothing and was written to anyway. **If fewer of your nine now read "will
    match" than you expect, that is this change, and each one says which fields it could not
    compare.** Settle those by hand; do not read a smaller number as a failure.
- 🔴 **A row reading "left for you" is the one to look at.** Either the numbers disagree, or there
  was no invoice number to match on and only customer/date/amount line up. **Nothing at all is
  written for those** — no order, and no id on the existing one.
- 🔴 **Open one "left for you" row's existing order beside its QuickBooks invoice and decide.**
  A wrong match here is permanent and invisible — the key would skip that order forever.

**Then check CARD 4's arithmetic against this panel:** the orders created should be
`(stops from QuickBooks) − (already have one) − (already recorded as a captured sale) − (refusals)`.
If the number is higher than that, stop.

---

## CARD 4c — 🔴 TWO INVOICES MAY NOT BOTH CLAIM ONE EXISTING ORDER
STATUS: needs-test · DEVICE: desktop · LAST-PROVEN: —

**Why this card is `needs-test` rather than a step you can run today, stated plainly: it needs a
state your tenant may not be in, and pretending otherwise would be a green check on an unperformed
proof.** It fires only when TWO QuickBooks invoices share one document number **and** one of your
existing orders carries that same number.

🔴 **This is not hypothetical, it is counted.** LAWNS's own books contain **22 document numbers used
by two different invoices each — 44 invoices**, every pair a different customer and a different
amount (`#3274` is Dyan Bourne at $811.88 **and** Jeffrey Gyurkovic at $4,717.50). **Zero of them
are among the nineteen future-dated stops**, which is why this cannot be provoked on today's ingest
— and **four of them (#5120, #5121, #5124, #5125) sit inside the 564-invoice history import**, which
is why it had to be fixed before that import runs.

**What must happen when it does fire:** both rows read **"left for you"**, naming each other. Neither
writes an id. Neither creates an order.

**What must NOT happen — and what happened before 2026-09-01:** the first invoice the run reached
wrote its id onto that order permanently, the second was silently discarded as an "already recorded"
race, and **the second sale got no order at all.** Which of two real sales the existing order was
declared to be came down to loop order.

**How to provoke it deliberately, if you want to see it work:** in the SQL editor set one existing
order's `source_document_number` to a number two of your invoices share, run the preview (**it writes
nothing**), confirm both rows say "left for you" and name each other, then set it back.

⚠️ **A run where this panel is empty proves nothing about this card** — an empty set is not a pass.

---

## CARD 5 — 🔴 AVAILABLE TO SELL DID NOT MOVE. THIS IS THE CARD THAT MATTERS.
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

**Two proofs, and you should have both.**

**① On the screen.** After Record, a green panel reads *"Available to sell did not move — measured
across every lot, before and after."* The app fingerprints every lot's on-hand and every quantity
claimed against it before the first write and again after the last. **If that panel is red, stop
immediately and report it** — nothing on that screen was supposed to change what the business can
sell.

**② With your own eyes.** Before pressing Record, write down the available-to-sell of **one lot you
recognise** off the inventory grid. Check it after. It must be the same number.

🔴 **Why this is the card, in one sentence:** committed stock is *derived* from open orders, so an
order does not need to decrement anything to do damage — a line pointing at a lot silently reduces
what LAWNS can sell, with no ledger row and nothing to reverse. **The screen's claim is an
argument; your one lot is an observation, and this board does not record arguments as passes.**

---

## CARD 6 — 🔴 RUN IT TWICE
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Press **Preview the loads** again, then **Record** if it offers.

- It should say **N already have one** and plan **zero**.
- **The Record button is disabled** — there is nothing to record.
- `/orders` count is **unchanged**. Nineteen, not thirty-eight.

---

## CARD 7 — The trip charges, the notes, and the $0 invoice
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

These are the three shapes their real invoices carry, and each is on the screen for a reason.

- **A trip charge is a line.** Open a row that had one: `TC · Trip Charge · ×1 · $150`. It carries
  money and the invoice's subtotal depends on it, so the sale would misstate itself without it.
  🔴 **It is not a thing to load, and the day sheet decides that separately** — this pass records
  the sale, not the truck's manifest.
- **A note is not a line.** A row whose invoice carried `1st Stop` or `Morning` shows those under
  **"On the invoice, not on the truck"** — never as a row with a quantity beside it.
- 🔴 **The $0 invoice is the one to look at.** Invoice **#3648.563** totals $0.00 and carries two
  real trees — *Blue Point Juniper (Replacement)* and *Arizona Cypress Blue Ice (Replacement)*,
  warranty replacements the customer already paid for once. **Both must be on its order.** If that
  stop shows no load, a crew arrives on 21 September with an empty trailer.

---

## CARD 8 — 🔴 IT STILL REFUSES TO PUSH TO QUICKBOOKS
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Open one of the new orders and try to send it to QuickBooks.

- It **refuses**, and says why: this sale is already in QuickBooks.
- 🔴 **Nothing new appears in their QuickBooks.** Check the invoice list — same count as before.
  Creating a second invoice for a settled sale, in a real customer's real accounting, under their
  real name, is the worst thing this build could do.

---

## CARD 9 — Other tenants are untouched
STATUS: owed · DEVICE: desktop · LAST-PROVEN: —

Sign in as Test Dave's. Its order count, its deliveries and its inventory are **exactly** as they
were. AC-3 is absolute; this pass reads and writes `business_id`-scoped rows only.

---

## CARD 10 — A stop that already has an order is left alone
STATUS: needs-test · DEVICE: desktop · LAST-PROVEN: —
⚠️ **`needs-test` with a reason, not silence.** LAWNS has no hand-entered stop carrying someone
else's order today, so there is nothing live to point this at. `historyOrderWriter.test.ts` §H4
asserts it from exactly that shape. **Write this card properly the first time such a stop exists**
— the failure it guards is a stop being re-pointed at an order that is not its own.

---

## WHAT THIS BOARD DELIBERATELY DOES NOT COVER

- **The day sheet itself.** This pass records what was sold. **What a day sheet SHOWS** — which
  lines are things to load and which are fees — is a separate read against the item catalogue, and
  it is not built.
- **The material list and the capacity flag.** Both are computed from **container size**, which
  lives in the line description this pass now stores. Neither is built; both were blocked without
  it.
- **`service_type`.** Still NULL on every ingested stop, deliberately. Seven of eighteen invoices
  in the 29 August capture carry *"Install & Warranty"* in a line description and ten carry no
  signal at all — **a guessed crew is worse than an unset field**, and this is David's ruling to
  make, not a default to pick.
- **A discount line.** Their books contain 66 `DiscountLineDetail` lines and 22 negative-amount
  lines, but **none of the eighteen future-dated invoices in the capture carries one**. The code
  path is asserted by test (`invoiceOrderLines.test.ts` §F) and **has never run on live data**.
