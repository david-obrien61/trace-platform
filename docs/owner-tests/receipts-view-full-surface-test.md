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
**Board: 0 of 19 covered** (**18 `owed`** · 1 `needs-test`) — 🔴 **EVERY CARD FLIPPED `covered` → `owed` ON 2026-09-03 BECAUSE THE SURFACE WAS REPLACED, NOT BECAUSE ANY PROOF WAS BAD.** `/receipts` moved from a bespoke card stack onto **`<DataSheet>` with `renderExpand`** — one row per receipt, the chain in a disclosure drawer (David's ruling). **Every card below was written against a card stack that no longer exists**, and OP-14 clause 3 is explicit: *changing a surface flips `covered` → `owed`* — a green check on a moved surface asserts a proof nobody performed. **Each card's 2026-09-02 evidence is PRESERVED VERBATIM in its own body**; nothing is overwritten. ⚠️ **THE RE-PROOF IS CHEAPER THAN THE FLIP LOOKS: seven of these still settle from ONE print of `/receipts`** — take the print and 1, 2, 3, 4, 5, 7 and 11 go together.
🔴 **CARD 8 is `covered` with its FAILURE preserved** — it failed, #257 fixed it, and the failure is not overwritten.
📄 **NINE OF THESE WERE PROVEN FROM PRINTED PDFs OF `/receipts`, NOT FROM LIVE INTERACTION.** **CARDS 1, 2, 3, 4, 5, 7 and 11 are all provable from ONE print of `/receipts`** — take the print, and those seven settle together. ⚠️ **CARD 1 is owed again and rides that same print** — one new print of `/receipts` re-settles it, so the re-proof costs nothing beyond taking the print. CARD 6 (a capture with no reload) and CARD 9 (three loads at three times) need interaction; CARD 10 needs an account that does not exist.
🆕 **CARDS 15–17 ADDED 2026-09-03 (#270) — the invoice number and the unit.** CARD 15 (number stored) and CARD 17 (unit read off the invoice) **share ONE capture and ONE query** — do them together. 🔴 **CARD 15 needs `20260903c` APPLIED; CARD 17 does not** (the unit fields ride inside the existing `line_items` jsonb, so no column is involved). ⚠️ **CARD 16 has a CLOSING WINDOW** — it tests the gap between the deploy and the apply, and applying the migration makes it unrunnable by design: mark it `superseded`, never `failed`.
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

1. Above the capture zone there is a **GRID** headed **Receipts captured** — a table with column headers, a search box and a filter, **not the stack of cards it was before 2026-09-03**.
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
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** — (reset 2026-09-03, the grid move)
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
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** — (reset 2026-09-03, the grid move)
**PROVEN 2026-09-02 on build `7952cb1`** — bwi 07-29 **$1,283.88 twice**, at its own two capture times; Bailey Bark 07-07 **$2,316.03 twice**. **Neither pair is labelled a duplicate**, which is what this card asserts. Evidence: the same printed PDF as CARD 1.
Find **bwi · 2026-07-29 · $1,283.88**. Then find **Bailey Bark Materials, Inc. · 2026-07-07 · $2,316.03**.

**PASS:** each appears **twice**, at its own capture time, and neither row is labelled a duplicate,
an error, or anything else.
🔴 **The point is that you can SEE them.** Deciding what to do about them is yours; the screen's job
was to stop hiding them.
**FAIL:** either pair shows once (the read is collapsing rows), or the screen labels them.

---

## CARD 4 — 🔴 the two bwi orders both appear, against their own receipts
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** — (reset 2026-09-03, the grid move)
**PROVEN 2026-09-02 on build `7952cb1`** — each bwi row shows exactly one order, `history · Invoiced · #19837964`, each with a delivery reading **No date set**. Evidence: the same printed PDF as CARD 1.
On each of the two bwi 2026-07-29 rows, look at **What it became**.

**PASS:** **each** of the two rows shows **one order** — both reading `history` · `Invoiced` ·
**#19837964** — and under each order, one delivery reading **No date set**.
🔴 **One vendor invoice, captured twice, showing two orders is the thing you need to be able to see.**
Two orders carrying the same document number is a fact about the data, not a rendering fault.
**FAIL:** only one of the two rows shows an order, or the orders do not appear at all.

---

## CARD 5 — the receipts that produced nothing say so, with no verdict attached
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** — (reset 2026-09-03, the grid move)
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
**STATUS:** owed · **DEVICE:** phone · **PROOF:** 🖱 NEEDS INTERACTION · **LAST-PROVEN:** — (reset 2026-09-03, the grid move)
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
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** — (reset 2026-09-03, the grid move)
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
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 🖱 NEEDS INTERACTION · **LAST-PROVEN:** — (reset 2026-09-03, the grid move)
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
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 🖱 NEEDS INTERACTION · **LAST-PROVEN:** — (reset 2026-09-03, the grid move)
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
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** — (reset 2026-09-03, the grid move)
**PROVEN 2026-09-02 on build `7952cb1`** — **both** bwi deliveries read **No date set**, in words, in the date position. Evidence: the same printed PDF as CARD 1.
On either bwi 2026-07-29 row, look at the delivery under the order.

**PASS:** it reads **No date set** — in words, in the same place a date would be.
🔴 **Two of the eleven ocr-invoice deliveries carry `delivery_date` NULL, and both of them are these.**
A blank there is a stop that looks scheduled and is not.
**FAIL:** the date position is empty, or shows a placeholder like `—` that could be read as a date
the screen failed to load.

---

## CARD 12 — 🔴 the grid sorts, and it sorts on the VALUE not the label (G4)
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 🖱 NEEDS INTERACTION · **LAST-PROVEN:** —

This clause was recorded **`owed`** on this surface for two days — the old card stack had no sort
control of any kind — and it arrives with the shared grid rather than being built here.

Open `/receipts` as the owner.

1. Click the **Amount** header. Click it again to reverse.
2. Click the **Date** header. Click **Vendor**, **What it became**, **Banked verdict**, **Captured**.

**PASS:** every one of those headers reorders the rows, and an arrow shows which way.
🔴 **THE SHARP CHECK, AND IT IS THE ONLY STEP HERE THAT CAN FAIL QUIETLY: sort by Amount descending
and confirm `$1,283.88` sits ABOVE `$920.13`.** Sorted as text — which is what sorting the printed
label does — nine hundred sorts above twelve hundred and **the page looks completely normal.**
**FAIL:** a header does nothing when clicked (a dead control) · no arrow · **or $920.13 above
$1,283.88 on a descending Amount sort.**

---

## CARD 13 — search reaches into the closed drawer (G6)
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 🖱 NEEDS INTERACTION · **LAST-PROVEN:** —

Also `owed` until the grid landed. 🔴 **A disclosure grid hides most of its own text by default, so
a search that reads only the visible row answers "not found" about data sitting one click away** —
a read-honesty failure wearing a search box.

Open `/receipts` as the owner.

1. Type **`19837964`** into the search box — an order document number that appears **only inside a
   collapsed drawer**, nowhere on any summary row.
2. Clear it. Open the **outcomes** filter and choose **No order recorded**.
3. Choose **Produced an order**.

**PASS:** step 1 narrows the grid to the receipt(s) carrying that order **without you having
expanded anything.** Step 2 shows **exactly the six receipts** that produced nothing. Step 3 shows
the rest, and 6 + (step 3's count) equals the total.
**FAIL:** step 1 finds nothing · the filter offers only one option (a control that cannot do
anything) · or the two filter halves do not add up to the whole.

---

## CARD 14 — one receipt is still ONE row (the clause the withdrawn reason got right)
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE · **LAST-PROVEN:** —

🔴 **THIS IS THE CARD THAT GUARDS THE ONE TRUE HALF OF THE REASON THAT WAS WITHDRAWN.** The old
comment claimed a grid could only render a receipt's chain by exploding one receipt into several
rows. That claim was false — `renderExpand` had existed for two months — **but the requirement
underneath it was real and still binds: a receipt appears ONCE.** Two LAWNS receipts are duplicate
captures of one invoice (tech-debt #143); if the grid split rows by order they would read as four,
which is exactly the confusion this screen exists to remove.

Open `/receipts` as the owner.

1. Count the rows. Compare against the count line above the grid.
2. Find the two **bwi 2026-07-29** rows. Expand each with the toggle at the end of its row.
3. Collapse them again.

**PASS:** **17 rows for 17 receipts** — every receipt on exactly one row, no receipt appearing twice
because it has an order. Each drawer opens **beneath its own row** and holds that receipt's order
and delivery. Collapsing restores the row count exactly.
**FAIL:** more rows than receipts · a receipt appearing on two rows · a drawer opening under the
wrong row · or the row count not returning after collapse.

---

## CARD 15 — 🔴 the invoice number is stored, and it is ON THE SCREEN
**STATUS:** owed · **DEVICE:** phone (capture) then desktop (the grid) · **PROOF:** 📄 PRINT-PROVABLE (after one capture) · **LAST-PROVEN:** —

✅ **UPDATED 2026-09-03 — THE GRID COLUMN LANDED** once David confirmed `20260903c` applied
(A: one row · B: no rows · C: 37 total / 0 populated · D: RLS true, **five** policies). The column
is **`Invoice #`, between Vendor and Date, default-visible**, so this card no longer needs the SQL
editor — though the query below still settles it if you prefer.

**TENANT:** LAWNS (`ed2e5933-45dc-4b9b-a331-ddfd125e7a74`) — or `Test Dave's`, either is fine.
**ACTOR:** the owner.

**WHAT MUST BE TRUE FIRST — BOTH, OR THIS CARD PROVES NOTHING:**
1. **`20260903c_receipts_receipt_number.sql` HAS BEEN APPLIED.** Confirm with the check query in
   that file: `SELECT column_name FROM information_schema.columns WHERE table_name='receipts' AND
   column_name='receipt_number';` → **exactly one row**. Zero rows means not applied — **stop, this
   card cannot run**, and what you would be testing is CARD 16 instead.
2. **The SHA at the foot of the screen is `681194c` or later** (GATE 0). The new OCR prompt and the
   writer both ship in that range; on an older bundle the number is never read in the first place.

**SHARES ITS WORK WITH CARD 17** — one capture and one query settle both. Do them together.

**Use a document that HAS a printed number.** A bwi invoice does (top right). A Sudderth ticket may
not — do not use one, or the card proves nothing through no fault of the code.

1. On the phone, open `/receipts` and capture the invoice as normal.
2. Confirm and save it. The confirmation screen appears.
3. 🔴 **There must be NO amber notice about the invoice number.** If you see *"the receipt was saved,
   but its invoice number could not be stored"*, the migration is NOT applied — go to CARD 16.
4. On the desktop open `/receipts`. There is an **`Invoice #`** column between **Vendor** and
   **Date**. Find the row you just captured.
5. *(Optional, same answer from the database)* in the SQL editor:
   `SELECT vendor, date, receipt_number, created_at FROM receipts ORDER BY created_at DESC LIMIT 3;`

**PASS:** the row you just captured shows **the number printed on the document, character for
character**, in a monospace cell. 🔴 **AND EVERY ROW CAPTURED BEFORE TODAY READS `No number
captured` — IN WORDS, NOT A DASH AND NOT A BLANK.** That is the pass condition, not a gap: nothing
was backfilled, and the sentence says *we never stored one*, which is all we know. We cannot see
whether those older documents carried a number, so a cell claiming *"None"* would be asserting
something nobody checked (D-9 / A9).
⚠️ **Sorting by `Invoice #` must NOT scatter the `No number captured` rows among the real numbers** —
they cluster at one end, because the column sorts on the stored value and not on the words shown.

**FAIL:** the new row reads `No number captured` (read but not written) · it shows a number that is
not the one on the paper (the OCR misread it — a real failure, but of the parser, not the column) ·
**an older row shows a value**, which would mean something backfilled them and nobody authorised it ·
🔴 **or an empty cell / a `—` anywhere in the column**, which is the absence-as-a-dash defect this
build exists to avoid.

🔴 **WHAT THIS CARD CANNOT PROVE:** that the number is CORRECTABLE. The ruling is that
`receipt_number` is editable — a document fact the OCR can misread, not platform provenance — but
**no surface exposes it for editing yet.** The grid column and the edit affordance are both owed.
This card proves the value is captured and stored, and nothing about fixing a wrong one.
It also cannot prove dedup: the unique index that tech-debt #143 needs is deliberately NOT in this
migration, because it would reject the two duplicate LAWNS captures that are still live.

---

## CARD 16 — ⚠️ the capture still works when the migration ISN'T applied, and says why
**STATUS:** owed · **DEVICE:** phone · **PROOF:** 🖱 NEEDS INTERACTION · **LAST-PROVEN:** —

**TENANT:** any. **ACTOR:** the owner.

🔴 **THIS CARD HAS A CLOSING WINDOW AND IT CLOSES WHEN YOU APPLY THE MIGRATION.** It tests the
behaviour in the gap between the deploy and the apply. **Once `20260903c` is applied this card is
no longer runnable**, and that is expected — mark it `superseded`, not `failed`. If you have already
applied the migration, skip it; there is nothing here to catch afterwards.

**WHAT MUST BE TRUE FIRST:** `20260903c` is **NOT** yet applied (the column query above returns
**zero** rows) and the SHA is `681194c` or later.

**WHY IT EXISTS:** measured against the live database, an INSERT carrying `receipt_number` while the
column is missing is refused **whole** — `PGRST204`, at the schema cache, before the database is
reached. Not a dropped field: **the entire save fails.** Without the guard this build shipped, every
capture in that window would have died on *"Failed to save receipt"*.

1. On the phone, capture any receipt that has a printed invoice number.
2. Confirm and save.

**PASS:** **the receipt SAVES.** The confirmation screen appears with the receipt id, AND an amber
notice reads *"The receipt was saved, but its invoice number (…) could not be stored — that column
is not live on this database yet."* The receipt then appears in the list below like any other.

**FAIL:** 🔴 **the save fails with "Failed to save receipt"** — the guard did not fire and captures
are broken until the migration is applied · **or** the receipt saves with **no notice at all**,
which is worse than it looks: the number was read and thrown away silently, which is exactly the
defect #257 fixed for quantity, unit price and SKU.

🔴 **WHAT THIS CARD CANNOT PROVE:** that the retry is narrow. It fires only on `PGRST204` and only
when a number was actually read — an FK violation, an RLS refusal or a dropped connection still
fail loudly and are still reported. Proving THAT needs a forced error, which this card does not do.

---

## CARD 17 — 🔴 the unit comes off the invoice, both places it is printed
**STATUS:** owed · **DEVICE:** phone (capture) then desktop (the query) · **PROOF:** 🔧 NEEDS SETUP · **LAST-PROVEN:** —

**TENANT:** LAWNS. **ACTOR:** the owner. **SHARES ITS CAPTURE WITH CARD 15.**

**WHAT MUST BE TRUE FIRST:** the SHA is `681194c` or later. **No migration is needed for this card** —
the unit fields ride inside the existing `line_items` jsonb, so this half works whether or not
`20260903c` has been applied.

🔴 **USE A bwi INVOICE.** It is the document this was built from and it states the unit **twice**:
a `BG`/`BN` code in its own column beside each quantity, and the unit restated inside the
description — *"4.4 cf"*, *"50 lb"*, *"40 lb"*, *"(12 Pack)"*. A vendor that prints neither cannot
fail this card meaningfully.

1. Capture the bwi invoice on the phone and save it.
2. On the desktop, in the SQL editor, run:
   `SELECT vendor, jsonb_pretty(line_items) FROM receipts ORDER BY created_at DESC LIMIT 1;`

**PASS:** every line object carries **`uom`**, **`pack_size`** and **`pack_unit`** as keys, and on
the lines where the invoice prints them they hold real values — `"uom": "BG"` or `"BN"`, and for a
*"50 lb"* description `"pack_size": 50` with `"pack_unit": "lb"`. A line where the document is
genuinely silent shows them as `null`, which is a pass: **null means the paper did not say.**

**FAIL:** the three keys are **absent entirely** (the new prompt did not reach this capture — check
the SHA) · `uom` is null on a line whose row plainly shows `BG` on the paper · `pack_size` holds the
*price* or the *quantity* rather than the pack size · or `pack_unit` holds description text with no
number in front of it (*"Osmocote"* rather than *"lb"*).

🔴 **WHAT THIS CARD CANNOT PROVE — AND IT IS THE THING THE FEATURE IS FOR:** that the
vendor-preference screen **stops asking**. Reading the unit and *using* it to suppress *"when bwi
bills you, is it by the yard or the ton?"* are two different builds; only the first shipped. The
screen may still ask. That is the next piece of work, not a failure of this card.
It also cannot prove any DERIVED figure — *"(12 Pack)"* at $25.71 being $2.14 a roll is arithmetic
on these values that nothing computes yet, deliberately.

---

## CARD 18 — 🔴 the drawer shows what was ON the document, and says which figures nobody confirmed
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 📄 PRINT-PROVABLE (one print, drawer open) · **LAST-PROVEN:** —

**TENANT:** LAWNS (`ed2e5933-…`). **ACTOR:** the owner.
**WHAT MUST BE TRUE FIRST:** the SHA at the foot of the screen is the one carrying #270's drawer.
**No migration needed.**

**RIDES THE SAME PRINT AS CARD 14** (one receipt = one row). Open a drawer, take one print, and
both settle.

**USE the bwi 2026-07-29 receipt** — it has real lines with quantities and rates on the paper.

1. On `/receipts`, expand the **bwi 2026-07-29** row.
2. A section headed **What was on the document** appears ABOVE *"What the platform banked at save
   time"*, with a table: **# · Description · Qty · Rate · Amount**.
3. Read the amber sentence directly above that table.
4. Compare the **Qty** and **Rate** cells against the paper invoice.

**PASS:** the lines are there with **quantity and rate**, matching the document. 🔴 **AND the amber
sentence names them:** *"The quantity and rate shown here came from the reader's original scan of
this document. The saved copy never carried them, so nobody has confirmed these figures — read them
as what the scan said, not as settled."* The Qty and Rate values render in **amber, not plain black**,
because they are the scan's reading and not a saved value.
Any tax line the platform added reads *"Added by the platform from the tax the reader found — it was
not a line on the document."*

**FAIL:** the drawer shows only the banked verdict and the order chain, with no lines (the fetch did
not fire — check the console for `[TRACE:receipts-list] drawer lines read`) · quantity and rate are
**blank** on every line (the drawer read only the saved copy, which carries neither) · 🔴 **the amber
sentence is ABSENT while amber values are on screen** — that is the exact defect this card exists to
catch, unconfirmed figures presented as settled · **or** a tax line reads *"Not among the lines the
reader read"*, which accuses you of adding a line the platform added.

🔴 **WHAT THIS CARD CANNOT PROVE:**
- **That the figures are RIGHT.** It proves we show the scan's reading and label it as such. Whether
  the OCR read the paper correctly is a different question and this card does not ask it.
- **That the caveat ever goes away.** It is computed — it disappears when a capture lands whose
  saved copy carries the five keys. **No such row exists yet** (#257's writer fix merged after the
  newest capture), so today the sentence appears on every receipt. Proving it *disappears* needs a
  fresh capture on the fixed writer, which is CARD 17's capture — worth checking there once.
- **Tenant isolation.** The read is scoped on `business_id` and a probe asserts it, but proving a
  cross-tenant refusal needs a second tenant's receipt id and a console. Not provable from here.

---

## CARD 19 — 🔴 G10: the toggle leads, the row opens it, and INLINE EDIT STILL WORKS
**STATUS:** owed · **DEVICE:** desktop · **PROOF:** 🖱 NEEDS INTERACTION · **LAST-PROVEN:** —

**TENANT:** LAWNS. **ACTOR:** the owner.
**WHAT MUST BE TRUE FIRST:** the SHA carries #270's G10 change. **No migration needed.**

🔴 **THIS CARD IS NOT ABOUT `/receipts`. IT IS ABOUT THE SHARED GRID ENGINE, WHICH HAS EIGHT
CONSUMERS.** The change moved the disclosure toggle to a leading pinned column and made the ROW a
click target, in `DataSheet.tsx` — so `/inventory`, `/assets`, `/customers`, the reconcile and
import grids all took the change whether or not anyone looked at them. **Steps 4-6 are the ones
that matter; steps 1-3 are the easy half.**

**PART A — the disclosure (on `/receipts`)**
1. The **first column** of the grid is a narrow track holding a **`+`** on each row — to the LEFT of
   Vendor, and it stays put when you scroll sideways.
2. Click the **`+`** on any row. It becomes a **`−`**, the drawer opens beneath that row.
3. Click anywhere else on a *different* row — on the date, the amount, empty space in a cell —
   **not** on a link. That row's drawer opens too.

**PART B — 🔴 THE REGRESSION HALF. Do not skip it; this is the half that can be broken invisibly.**
4. Go to **`/inventory`**. Click into an editable cell (a name, a price, a quantity) and type.
   **The cell must take focus and accept the text.**
5. Still on `/inventory`, expand a row with the leading `+`, then click into an editable cell on
   that same row.
6. Back on `/receipts`, click the **vendor name** on any row.

**PASS:** A: the toggle is leading and pinned, `+`/`−` (not a chevron), and clicking the row body
opens the drawer. B: **step 4 and 5 — the cell takes focus and your typing lands, and the drawer
does NOT open or close while you are editing.** Step 6 — the vendor link **navigates to
`/receipts/:id`** and does not merely toggle a drawer.

**FAIL:** 🔴 **the biggest one is step 4/5: a cell that will not take focus, or a drawer that
opens/closes every time you click into a cell.** That means the row handler is swallowing clicks it
was written to ignore, and it breaks editing across six grids at once — a grid that still LOOKS
completely correct while its inputs have stopped working. Also failing: the toggle is still at the
far right · the pinned block overlaps or hides the Vendor column when you scroll sideways (the
#104/#105 defect returning) · step 6 toggles the drawer instead of navigating · the drawer opens
and instantly closes on one click of `+`.

🔴 **WHAT THIS CARD CANNOT PROVE:** it exercises **two** of the eight consumers. `/assets`,
`/customers`, `/inventory/reconcile`, `/inventory/import` and the two editor components took the
same engine change and **are not covered here** — if you have a minute on any of them, clicking one
editable cell is the whole test. The probes behind this card read `DataSheet.tsx` as **source text**
(a render condition inside a `.tsx` is unreachable to our harness, tech-debt #134), so they prove
the code SAYS the right thing — **only this card proves a browser DID it.**
