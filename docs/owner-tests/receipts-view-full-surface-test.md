# OWNER TEST — THE RECEIPTS VIEW: WHAT WAS CAPTURED, WHAT WAS BANKED, WHAT IT BECAME

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** ⚠️ **NONE — and that is a finding, not an omission here.** The Receipt Keeper surface
carries **no id on the 24-capability board** (3.1 is *Leakage / missed-upsell*; 4.2 is
*Reconciliation*, which is `/inventory/reconcile`). Checked against the board this session. The
capture half has shipped since 2026-06-11 and has never had a row. Flagged for David; not minted here.
Joins only: **3.5** delivery and the orders roster.
**Story:** `user_stories.md` → *I captured a receipt — show me it landed, and show me what it turned into*
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 11 covered** (11 `owed` · 0 `needs-test`).
**DEVICE:** CARDS 1–5 and 7–11 are `DEVICE: desktop` — this is a reconcile surface, and reconcile is desktop (capture=mobile / reconcile=desktop). **CARD 6 is `DEVICE: phone`** and is provable **without a console**.

> ⛔ **NO MIGRATION GATE.** This build applies none. It adds no table, no column, no policy, no
> `api/` function (12/12 untouched) and no permission. `/receipts` already gates on `costs:read`
> and `receipts` already carries dual owner+member RLS on `business_id`
> (`20260612_receipts.sql:31-63`). If a card below fails, it is the code, not an unapplied migration.

> 🔴 **AND IT WRITES NOTHING.** Not one insert, update, upsert or delete. The two duplicate
> captures and the six receipts that produced no order are **SURFACED, NOT REPAIRED** — repairing
> live customer data is your call and is not a step inside a view build. CARD 9 is the card that
> proves it.

---

## CARD 1 — the receipts are on screen at all, newest first
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Open `/receipts` as the owner.

1. Above the capture zone there is a card headed **Receipts captured**.
2. The rows read, top to bottom, newest capture first.
3. Each row carries **vendor · date · amount · category · when it was captured**.

**PASS:** the list is there and the newest capture is at the top.
🔴 **This is the whole build.** Seventeen receipts have existed and nothing has ever rendered them; on
1 September eight were captured in one afternoon and nobody could see them.
**FAIL:** no list, or the oldest capture is first.

---

## CARD 2 — the six write-only columns finally have a reader
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
On any row, look at **What the platform banked at save time**.

1. A coloured readout — green for `match` — reading *"✓ Lines: $X = Total: $Y"*.
2. Under it, in plain sentences: what OCR read versus what was saved, and whether the owner changed
   anything before saving.

**PASS:** every row shows a banked verdict, and the figures are the receipt's own.
🔴 **`reconcile_status`, `reconcile_delta`, `reconcile_overridden_at`, `accept_vs_edit`,
`amount_original` and `header_amount_edited` have been WRITE-ONLY since 14 June.** This card is the
first time anything has read them back.
⚠️ **Expect every row to say the owner changed something before saving** — that is 17/17 live, and
**why** is an OPEN question this screen does not answer. It makes it visible; it does not explain it.
**FAIL:** the verdict block is missing, or a row shows `$0.00` where a figure was not stored.

---

## CARD 3 — both duplicate captures appear as two rows, and the screen does not call them duplicates
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Find **bwi · 2026-07-29 · $1,283.88**. Then find **Bailey Bark Materials, Inc. · 2026-07-07 · $2,316.03**.

**PASS:** each appears **twice**, at its own capture time, and neither row is labelled a duplicate,
an error, or anything else.
🔴 **The point is that you can SEE them.** Deciding what to do about them is yours; the screen's job
was to stop hiding them.
**FAIL:** either pair shows once (the read is collapsing rows), or the screen labels them.

---

## CARD 4 — 🔴 the two bwi orders both appear, against their own receipts
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
On each of the two bwi 2026-07-29 rows, look at **What it became**.

**PASS:** **each** of the two rows shows **one order** — both reading `history` · `Invoiced` ·
**#19837964** — and under each order, one delivery reading **No date set**.
🔴 **One vendor invoice, captured twice, showing two orders is the thing you need to be able to see.**
Two orders carrying the same document number is a fact about the data, not a rendering fault.
**FAIL:** only one of the two rows shows an order, or the orders do not appear at all.

---

## CARD 5 — the receipts that produced nothing say so, with no verdict attached
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Six rows produced no order: **bwi 2026-07-22 $1,098.86** · **bwi 2026-07-02 $1,356.31** ·
**Sudderth Brothers 2026-08-20 $1,301.98** · **Bailey Bark 2026-04-28 $2,394.92** · and **both**
Bailey Bark 2026-07-07 rows.

**PASS:** each reads exactly **"No order recorded for this receipt."** — and **nothing else.**
🔴 **Read the sentence, not just its presence.** It must not say *missing*, *orphaned*, *unlinked*,
*error*, or *should have*. Six of these read as vendor PURCHASE invoices, which correctly should not
become customer orders — **but that is a reading, and the screen is not allowed to hold it.**
**FAIL:** any word that decides something. A blank where the sentence should be is also a fail: an
absence a reader has to interpret is the defect, not the fix.

---

## CARD 6 — the capture wizard is untouched, and a new capture appears in the list
**STATUS:** owed · **DEVICE:** phone · **LAST-PROVEN:** —
On a phone, at `/receipts`:

1. The list is above; **📷 Take Photo** is below it, unchanged.
2. Capture a receipt and run it all the way through to **Save**.
3. When the confirmation appears, **scroll up.**

**PASS:** the capture flow behaves exactly as it did before, and the receipt you just saved is the
**top row** of the list without reloading the page.
**FAIL:** any change to the capture flow, or the new receipt is absent until a manual reload.

---

## CARD 7 — the count is honest
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Read the line under **Receipts captured**.

**PASS:** with fewer than 100 receipts it reads a plain **"N receipts"**, and N equals the number of
rows you can count on the screen.
🔴 **If it ever reads "Showing N of M", M is the real total and the sentence names the cap.** A
number under a count label that quietly hides rows is a live defect on two other screens; this is
not a third.
**FAIL:** a count that does not match the rows, or a count with no rows behind it.

---

## CARD 8 — the list steps aside while you are filling the confirm form
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Start a capture and get as far as the **confirm** screen (vendor / date / total / line items).

**PASS:** the receipts list is **not** on screen — the form is at the top of the page where it has
always been.
**FAIL:** you have to scroll past the list to reach the fields. The list is an addition; it may not
push the proven flow below the fold.

---

## CARD 9 — 🔴 nothing was written
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Before opening `/receipts`, note the receipt count and the order count on `/orders`. Open
`/receipts`, scroll the whole list, reload it three times. Go back.

**PASS:** both counts are **identical**, the two duplicate pairs are **still both there**, and no
receipt has changed its amount, its vendor or its verdict.
🔴 **A read surface that repairs anything on open is the worst version of this build**, because the
repair happens to live customer data on a screen nobody asked to write.
**FAIL:** any count moves, any duplicate disappears, any figure changes.

---

## CARD 10 — the door is the one that was already there
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Sign in as a member **without** `costs:read` (a STAFF session on Test Dave's) and go to `/receipts`.

**PASS:** the page refuses the way it always has — the permission route renders and says so. The
receipts list never appears, and no row, count or vendor name leaks onto the screen behind the refusal.
**FAIL:** the list renders, or the refusal changed shape. No permission was minted for this build; if
the door behaves differently, something was minted by accident.

---

## CARD 11 — a delivery with no date says it has no date
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
On either bwi 2026-07-29 row, look at the delivery under the order.

**PASS:** it reads **No date set** — in words, in the same place a date would be.
🔴 **Two of the eleven ocr-invoice deliveries carry `delivery_date` NULL, and both of them are these.**
A blank there is a stop that looks scheduled and is not.
**FAIL:** the date position is empty, or shows a placeholder like `—` that could be read as a date
the screen failed to load.
