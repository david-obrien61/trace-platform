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
**Board: 9 of 11 covered** (**1 `owed`** · 1 `needs-test`) — flipped 2026-09-03 from David's live run of 2026-09-02 on build `7952cb1` (ledger #261), then 🔴 **CARD 1 flipped BACK `covered` → `owed` the same day when G9 moved the sort off `created_at` onto the document date.** The 09-02 proof cited capture timestamps and its step read *"newest capture first"*; that ordering no longer exists. **This is OP-14 clause 3 working as intended, not a regression in the record** — a green check on a moved surface asserts a proof nobody performed.
🔴 **CARD 8 is `covered` with its FAILURE preserved** — it failed, #257 fixed it, and the failure is not overwritten.
📄 **NINE OF THESE WERE PROVEN FROM PRINTED PDFs OF `/receipts`, NOT FROM LIVE INTERACTION.** **CARDS 1, 2, 3, 4, 5, 7 and 11 are all provable from ONE print of `/receipts`** — take the print, and those seven settle together. ⚠️ **CARD 1 is owed again and rides that same print** — one new print of `/receipts` re-settles it, so the re-proof costs nothing beyond taking the print. CARD 6 (a capture with no reload) and CARD 9 (three loads at three times) need interaction; CARD 10 needs an account that does not exist.
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

## CARD 1 — the receipts are on screen at all, newest DOCUMENT DATE first
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** — (reset 2026-09-03)

🔴 **FLIPPED `covered` → `owed` 2026-09-03 BECAUSE THE SURFACE MOVED UNDER THE PROOF, NOT BECAUSE
THE PROOF WAS BAD.** OP-14 clause 3: *changing a surface flips `covered` → `owed`* — a green check
on a moved surface asserts a proof nobody performed.

**WHAT THE PRIOR RUN ACTUALLY PROVED, PRESERVED VERBATIM:** *"PROVEN 2026-09-02 on build `7952cb1`
— 17 rows, newest first: 15:51:49 at the top down to 08-26 20:50, **no inversions**. Evidence: a
printed PDF of `/receipts`."* ⚠️ **READ THE EVIDENCE: `15:51:49` AND `08-26 20:50` ARE CAPTURE
TIMESTAMPS, and step 2 read *"newest CAPTURE first"*.** That run proved capture order — correctly,
against the build it was run on — and capture order is exactly what **G9** has now replaced. The
proof is not wrong; it is a proof of the previous behaviour.

**WHAT CHANGED:** the list is now ordered by **`receipts.date`, the date on the document**, with
capture time as the tiebreak only (David's G9 ruling, 2026-09-03). On LAWNS's own rows these
disagree — the **2026-07-02** bwi invoice was captured AFTER the **2026-07-29** one — so **the
visible row order changes**, which is the whole point of re-running this card rather than assuming
it still passes.

Open `/receipts` as the owner.

1. Above the capture zone there is a card headed **Receipts captured**.
2. 🔴 The rows read, top to bottom, **newest date ON THE DOCUMENT first** — the `date` column shown
   in each row, NOT the `captured` timestamp beside it.
3. Each row carries **vendor · date · amount · category · when it was captured**.
4. 🔴 **THE DISCRIMINATING CHECK — do this one specifically, it is the only step that can tell the
   two orders apart.** Find the **bwi 2026-07-29** row and the **bwi 2026-07-02** row. **07-29 must
   appear ABOVE 07-02.** Their `captured` timestamps run the OTHER way, so if 07-02 is on top the
   list is still on capture order and the change did not land.

**PASS:** the list is there, the newest **document date** is at the top, and 2026-07-29 sits above
2026-07-02.
🔴 **This is the whole build.** Seventeen receipts have existed and nothing has ever rendered them; on
1 September eight were captured in one afternoon and nobody could see them.
**FAIL:** no list · the oldest date is first · **or 07-02 appears above 07-29** (capture order,
unchanged) · or a row with no date shows a date anyway.

---

## CARD 2 — the six write-only columns finally have a reader
**STATUS:** covered · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** 2026-09-02
**PROVEN 2026-09-02 on build `7952cb1`** — every row shows `✓ Lines: $X = Total: $Y` plus the OCR sentences; **no `$0.00` where a figure was stored**. Evidence: the same printed PDF as CARD 1.
On any row, look at **What the platform banked at save time**.

1. A coloured readout — green for `match` — reading *"✓ Lines: $X = Total: $Y"*.
2. Under it, in plain sentences: what OCR read versus what was saved, and what the edit flag can
   honestly support.

**PASS:** every row shows a banked verdict, and the figures are the receipt's own.
🔴 **`reconcile_status`, `reconcile_delta`, `reconcile_overridden_at`, `accept_vs_edit`,
`amount_original` and `header_amount_edited` have been WRITE-ONLY since 14 June.** This card is the
first time anything has read them back.
🔴 **UPDATED 2026-09-02 (ledger #257) — THE EXPECTED SENTENCE CHANGED, AND THE OLD ONE IS NOW A FAIL.**
This card used to say *"expect every row to say the owner changed something before saving"* and to
call **why** an open question. It is no longer open: measured field by field against the reader's own
parsed output (population 35) — **vendor differs 0 · amount 3 · category 2 · date 29 · lines 30**,
and the two large counts are **the platform's own doing** (the code normalises `06/22/2026` to ISO
and compares the normalised value against the raw one; and it injects its own `Tax` line and then
counts the line it added). `header_amount_edited` is **false on 36 of 36 AS MEASURED 2026-09-02**.
⚠️ **Re-measured 2026-09-03 the corpus is 37, not 36** (`Test Dave's Tree Nest` 18 · **LAWNS 17,
unchanged** · `Test David's new Business` 2). Seeing 37 rows is not this card failing — the claim is
the ratio, and the denominator is a snapshot of a corpus Lauren is still uploading to. Ledger #263.
⚠️ **So the row must NOT read *"Owner changed something before saving."*** It should say it is flagged
as edited **but the total was not changed**, and that the flag also counts the platform's own
reformatting. ⚠️ **The FLAG itself is still computed wrongly at write time — tech-debt #148, deliberately
deferred.** This card checks the sentence, not the column.
**FAIL:** the verdict block is missing, or a row shows `$0.00` where a figure was not stored.

---

## CARD 3 — both duplicate captures appear as two rows, and the screen does not call them duplicates
**STATUS:** covered · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** 2026-09-02
**PROVEN 2026-09-02 on build `7952cb1`** — bwi 07-29 **$1,283.88 twice**, at its own two capture times; Bailey Bark 07-07 **$2,316.03 twice**. **Neither pair is labelled a duplicate**, which is what this card asserts. Evidence: the same printed PDF as CARD 1.
Find **bwi · 2026-07-29 · $1,283.88**. Then find **Bailey Bark Materials, Inc. · 2026-07-07 · $2,316.03**.

**PASS:** each appears **twice**, at its own capture time, and neither row is labelled a duplicate,
an error, or anything else.
🔴 **The point is that you can SEE them.** Deciding what to do about them is yours; the screen's job
was to stop hiding them.
**FAIL:** either pair shows once (the read is collapsing rows), or the screen labels them.

---

## CARD 4 — 🔴 the two bwi orders both appear, against their own receipts
**STATUS:** covered · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** 2026-09-02
**PROVEN 2026-09-02 on build `7952cb1`** — each bwi row shows exactly one order, `history · Invoiced · #19837964`, each with a delivery reading **No date set**. Evidence: the same printed PDF as CARD 1.
On each of the two bwi 2026-07-29 rows, look at **What it became**.

**PASS:** **each** of the two rows shows **one order** — both reading `history` · `Invoiced` ·
**#19837964** — and under each order, one delivery reading **No date set**.
🔴 **One vendor invoice, captured twice, showing two orders is the thing you need to be able to see.**
Two orders carrying the same document number is a fact about the data, not a rendering fault.
**FAIL:** only one of the two rows shows an order, or the orders do not appear at all.

---

## CARD 5 — the receipts that produced nothing say so, with no verdict attached
**STATUS:** covered · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** 2026-09-02
**PROVEN 2026-09-02 on build `7952cb1`** — all six named rows read exactly *"No order recorded for this receipt."* **and nothing else** — no verdict attached. Evidence: the same printed PDF as CARD 1.
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
**STATUS:** covered · **DEVICE:** phone · **PROOF:** 🖱 NEEDS INTERACTION · **LAST-PROVEN:** 2026-09-02
**PROVEN 2026-09-02 on build `7952cb1`** — a new capture **rose to the top without a reload**. 🖱 Not print-provable: the evidence *is* the absence of a reload, which a printed page cannot show.
On a phone, at `/receipts`:

1. The list is above; **📷 Take Photo** is below it, unchanged.
2. Capture a receipt and run it all the way through to **Save**.
3. When the confirmation appears, **scroll up.**

**PASS:** the capture flow behaves exactly as it did before, and the receipt you just saved is the
**top row** of the list without reloading the page.
**FAIL:** any change to the capture flow, or the new receipt is absent until a manual reload.

---

## CARD 7 — the count is honest
**STATUS:** covered · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** 2026-09-02
**PROVEN 2026-09-02 on build `7952cb1`** — the header reads a plain **"17 receipts"**, matching the **17 rows counted on the same page**. Evidence: the same printed PDF as CARD 1 — the count and the rows it counts are both in the one print, which is what makes this card provable on paper at all.
Read the line under **Receipts captured**.

**PASS:** with fewer than 100 receipts it reads a plain **"N receipts"**, and N equals the number of
rows you can count on the screen.
🔴 **If it ever reads "Showing N of M", M is the real total and the sentence names the cap.** A
number under a count label that quietly hides rows is a live defect on two other screens; this is
not a third.
**FAIL:** a count that does not match the rows, or a count with no rows behind it.

---

## CARD 8 — the list steps aside while you are filling the confirm form
**STATUS:** covered · **DEVICE:** desktop · **PROOF:** 🖱 NEEDS INTERACTION · **LAST-PROVEN:** 2026-09-02
🔴 **THIS CARD FAILED FIRST, AND THE FAILURE IS KEPT — it is a better record than a green check.**
**FAILED 2026-09-02 on build `7952cb1`:** the receipts list was on screen while the confirm form was
up, **pushing the proven capture flow below the fold** — exactly the FAIL this card describes.
✅ **FIXED by #257** — `listVisibleForStep('confirm')` returns false, shipped with a **negative
probe** so the list cannot silently come back. The fix is in `main` (`32d5297` merge, `62d3d34` tip).
⚠️ **RE-PROOF IS OWED ON THE FIXED BUILD.** `covered` here records the card was RUN and the loop
closed; the fix itself has not been driven through the UI since it landed. 🖱 Not print-provable —
the assertion is about what is on screen *during* a form step.
Start a capture and get as far as the **confirm** screen (vendor / date / total / line items).

**PASS:** the receipts list is **not** on screen — the form is at the top of the page where it has
always been.
**FAIL:** you have to scroll past the list to reach the fields. The list is an addition; it may not
push the proven flow below the fold.

---

## CARD 9 — 🔴 nothing was written
**STATUS:** covered · **DEVICE:** desktop · **PROOF:** 🖱 NEEDS INTERACTION · **LAST-PROVEN:** 2026-09-02
**PROVEN 2026-09-02 on build `7952cb1`** — orders **30 before and 30 after**; receipts **17 across three loads at 14:11, 16:18 and 16:52**; **both duplicate pairs intact**; no figure moved. 🖱 Not print-provable from one print: the assertion is that three loads at three times agree, so it needs three prints or three live reads.
Before opening `/receipts`, note the receipt count and the order count on `/orders`. Open
`/receipts`, scroll the whole list, reload it three times. Go back.

**PASS:** both counts are **identical**, the two duplicate pairs are **still both there**, and no
receipt has changed its amount, its vendor or its verdict.
🔴 **A read surface that repairs anything on open is the worst version of this build**, because the
repair happens to live customer data on a screen nobody asked to write.
**FAIL:** any count moves, any duplicate disappears, any figure changes.

---

## CARD 10 — the door is the one that was already there
**STATUS:** needs-test · **DEVICE:** desktop · **PROOF:** 🔧 NEEDS SETUP · **LAST-PROVEN:** —
🔧 **REASON IT CANNOT BE RUN: the account does not exist.** There is **no staff session without
`costs:read` on `Test Dave's Tree Nest`**. This card needs the same account as Joel's
production-manager role. Recorded as `needs-test` rather than left `owed`, because `owed` says
*nobody has run it yet* and the truth is *nobody can run it yet* (OP-14 clause 2: an unrecorded
hole is a lie by omission).
Sign in as a member **without** `costs:read` (a STAFF session on Test Dave's) and go to `/receipts`.

**PASS:** the page refuses the way it always has — the permission route renders and says so. The
receipts list never appears, and no row, count or vendor name leaks onto the screen behind the refusal.
**FAIL:** the list renders, or the refusal changed shape. No permission was minted for this build; if
the door behaves differently, something was minted by accident.

---

## CARD 11 — a delivery with no date says it has no date
**STATUS:** covered · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** 2026-09-02
**PROVEN 2026-09-02 on build `7952cb1`** — **both** bwi deliveries read **No date set**, in words, in the date position. Evidence: the same printed PDF as CARD 1.
On either bwi 2026-07-29 row, look at the delivery under the order.

**PASS:** it reads **No date set** — in words, in the same place a date would be.
🔴 **Two of the eleven ocr-invoice deliveries carry `delivery_date` NULL, and both of them are these.**
A blank there is a stop that looks scheduled and is not.
**FAIL:** the date position is empty, or shows a placeholder like `—` that could be read as a date
the screen failed to load.
