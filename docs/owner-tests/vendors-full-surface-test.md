# OWNER TEST — VENDOR IDENTITY AND THE PREFERRED VENDOR

**Capability:** vendor identity + preference (`/vendors`, and the vendor question on `/receipts`)
**Ledger:** #259 · **#273** (the record editor, E7/R-83) · **Branch:** `main` · **Rulings:** R-83 (a per-record control lives where the record is opened) · R-64 (quality preference) · R-65 (consolidation) · D-47 (identity) · R-50 · R-54
**Last updated:** 2026-09-04
**Proven:** 0 of 18 · **Owed:** 17 · **needs-test:** 1

> 🔴 **CARDS 1, 2, 5, 6 AND 7 WERE FLIPPED `covered` → `owed` ON 2026-09-04 — none of them had ever been proven, so nothing green was lost, but they are listed here because the SURFACE THEY DESCRIBED NO LONGER EXISTS.** Under E7 the preference control and its note left the row and moved into a modal. A card describing the old inline editor would have walked David through steps that cannot be performed. Their original wording is preserved inline under each card as **WAS**, because the prior text is evidence about what the surface used to assert (OP-14 cl.3).

> Thunder never marks a card `covered`. Only David's live run does, with a date.

---

## GATE 0 — IS THE THING YOU ARE TESTING ACTUALLY LIVE? (OP-15)

**Before reading any screen:**

1. **Confirm the Vercel deploy for THIS SHA is READY** — not a different push's Ready. A failed build is SILENT and serves the last-good bundle.
2. **Check the SHA stamp** — `?debug=1` → DebugPanel footer. Does the app say the SHA you pushed?
3. 🔴 **THE MIGRATIONS MUST BE APPLIED, IN ORDER, AND NONE OF THEM IS APPLIED TODAY:**
   1. `20260902_vendor_identity_and_preference.sql` (creates `vendors`, `vendor_aliases`, `receipts.vendor_id`)
   2. `20260902_receipt_line_edit_and_vendor_preference.sql` (the other session's — creates `vendor_preferences`)
   3. `20260902b_vendor_preferences_join_on_vendor_id.sql` (the consolidation)
   4. 🔴 **NEW — `20260904_receipts_receipt_number_original.sql`** (adds `receipts.receipt_number_original`). **CARDS 16–18 CANNOT PASS WITHOUT IT**, and the capture will not break without it either: the save retries once without both document-number columns and shows an amber notice saying the number was read but not stored. If you see that notice, this migration is the reason.

   **File 3 REFUSES with a named error if 1 or 2 is missing** — it pre-flights rather than trusting the order. If you see that error, apply the missing one and re-run; it is the guard working, not a fault.

**If the SHA is not live or the migrations are not applied, every observation below is fiction.**

---

## THE TENANT QUESTION — READ THIS BEFORE PICKING WHERE TO TEST

🔴 **Measured live 2026-09-02, and it corrects the build spec's own framing.** The spec says *"Lauren — a manager, not an owner."* She is not a manager:

| Business | `businesses.owner_id` | Members |
|---|---|---|
| **LAWNS Tree Farm** `ed2e5933` | David `98f4e56b` | **Lauren Bishop — role OWNER, active, user_id `790b31d2` (NOT owner_id)** · joel joiner — MANAGER, **active=false** · David — OWNER |
| **Test Dave's Tree Nest** `f7ec5d67` | David `95c1b2e9` | **test obrien — MANAGER, active=true** · user obrien — STAFF · Harness STAFF |

So:
- **The owner-side cards run at LAWNS.** Lauren holds OWNER role there by David's own 2026-08-28 ruling, so she both reads *and* sets the preference.
- 🔴 **The MANAGER-side cards (5, 6) must run at `f7ec5d67`** — `test obrien` is the only active manager in the database. Running them at LAWNS as Lauren proves nothing, because she is an owner there.

---

## CARDS

### CARD 1 — the list exists, and both vendors appear
**STATUS:** owed · **DEVICE:** desktop · 📄 **PRINT-PROVABLE** (shares one print with CARDS 8, 9)
**TENANT:** LAWNS `ed2e5933` · **ACTOR:** David or Lauren (owner)
**MUST BE TRUE FIRST:** GATE 0 passed. At least one vendor exists, or you are deliberately proving the empty state.
1. Open **`/vendors`**.
2. Expect the heading **Vendors** and a subhead that matches reality (see CARD 8).
3. Expect an **Add vendor** button at the top right of the card, beside the heading.
4. With no vendors yet, expect exactly: *"No vendors yet. One is recorded the first time you capture a document from them — or add one here."*
5. Each vendor row shows its **name**, and — where the columns are filled — labelled **Contact**, **Address** and **Also bills as** blocks, then an **Edit vendor** button.
**FAIL LOOKS LIKE:** a blank card; a spinner that never resolves; a row with no **Edit vendor** button; the old empty-state sentence with no *"or add one here"* (that means you are on a pre-#273 bundle — go back to GATE 0).
**THIS CARD CANNOT PROVE:** that the Address block shows real data. `vendors` held **1 row with 0 of 11 non-key columns filled** on 2026-09-04, so the Address block will be absent until CARD 13 or CARD 15 puts something there.
> **WAS (2026-09-03, never proven):** step 3 read *"No vendors yet. One is recorded the first time you capture a document from them."* — the sentence changed when the manual add path landed, and there was no Add button or Edit button to look for.

### CARD 2 — 🔴 A CAPTURED DOCUMENT CREATES A VENDOR **AND KEEPS WHAT THE PAGE SAID ABOUT THEM**
**STATUS:** owed · **DEVICE:** phone (provable without a console) · 🔧 **NEEDS SETUP** (a real purchase invoice with a letterhead)
**TENANT:** either · **ACTOR:** any active member
**MUST BE TRUE FIRST:** GATE 0 passed. Use a vendor you have **never** captured before, on a document whose letterhead carries an address and a phone. The bwi invoice does.
1. Capture that document.
2. Save.
3. Open **`/vendors`**. The vendor is there, **named exactly as you typed it**.
4. 🔴 **Expect a Contact and/or Address block on that row, filled from the letterhead** — not an empty row with only a name.
5. Open it with **Edit vendor** and read the fields. Anything the page printed should be sitting in the form, ready to correct.
**FAIL LOOKS LIKE:** the vendor row shows a name and nothing else, on a document that visibly carries an address and phone. That is the extract-and-discard defect this card exists to catch — the reader read it and the writer threw it away.
**THIS CARD CANNOT PROVE:** that the OCR reads the letterhead *correctly*. It proves the value is **kept**. A wrong-but-present address is a CARD 13 fix (open the modal and correct it), not a failure of this card.
⚠️ **If the vendor already existed, this card proves nothing** — contact is populated **on create only**, deliberately, so a second document never overwrites something the owner typed by hand.
> **WAS (2026-09-03, never proven):** three steps ending at *"The vendor is there, named exactly as you typed it."* It asserted nothing about the eleven other columns, because at the time the capture wrote only `business_id` and `name`.

### CARD 3 — 🔴 THE UNIT QUESTION IS ASKED ONCE (acceptance 5)
**STATUS:** owed · **DEVICE:** phone
1. Capture a receipt and type the vendor as **`Sudderth Brothers`** (the shorthand). LAWNS already holds `Sudderth Brothers Contracting, Inc.`
2. 🔴 **Expect a question under the vendor field: *"Is 'Sudderth Brothers' the same vendor as Sudderth Brothers Contracting, Inc.?"*** with two buttons and a line saying why it is asking.
3. **It must ASK. If it silently linked, or silently created a second vendor, that is a FAIL** — the whole build is the difference between asking and assuming.
4. Tap **Same as Sudderth Brothers Contracting, Inc.** and save.
5. **Capture a second receipt, same shorthand.** 🔴 **This time NO question appears** — it resolves silently.
6. Confirm on `/vendors` that there is still **one** Sudderth vendor, now showing `Sudderth Brothers` under **Also bills as**.

### CARD 4 — declining creates a separate vendor
**STATUS:** owed · **DEVICE:** phone
1. Repeat CARD 3 step 1 with a fresh shorthand.
2. Tap **A different vendor**, save.
3. `/vendors` shows **two** rows. Nothing was merged.

### CARD 5 — 🔴 A MANAGER SEES THE MARK AND THE REASON (acceptance 2)
**STATUS:** owed · **DEVICE:** desktop
🔴 **RUN THIS ON TEST DAVE'S TREE NEST (`f7ec5d67`) AS `test obrien`. NOT ON LAWNS.**
**Running it on LAWNS gives a FALSE PASS.** Lauren holds `role = OWNER` there (David's 2026-08-28 ruling), so she is not a manager and would see the control she is
supposed to be denied. `joel joiner` is MANAGER at LAWNS but `active = false`, so he cannot sign in either.
**`test obrien` at `f7ec5d67` is the only active manager in the entire database** — measured 2026-09-02 across 3 businesses / 8 member rows.
**MUST BE TRUE FIRST:** GATE 0 passed. A vendor at `f7ec5d67` is already marked preferred **with a note** (do that as owner first — CARD 13).
1. As an OWNER at `f7ec5d67`, mark a vendor preferred with a note.
2. **Sign in as `test obrien` (MANAGER).** Open **`/vendors`**.
3. **Expect: the vendor list loads and the PREFERRED chip is visible on that row.**
4. 🔴 **THE NOTE IS NOT ON THE LIST ANY MORE — THAT IS CORRECT, NOT A FAIL.** Click **Edit vendor** on that row.
5. In the modal, scroll to **Preference**. Expect a bordered read-only block reading **"Marked preferred by the owner"**, the note itself beneath it, and: *"The preferred vendor is set by the owner. You can see the mark and the reason, and they cannot be changed from your account. Everything else on this form you can edit."*
6. 🔴 **Expect NO checkbox and NO note textarea** in that block.
7. Confirm the rest of the form IS editable for her — change the phone, press **Save changes**, and expect it to save.
**FAIL LOOKS LIKE:** an empty vendor list (she inherited a gate she must not have); the note missing entirely from the modal (she has lost the thing the screen exists to give her); a *checkbox* she can tick; or step 7 refusing — a manager may edit every field except the preference pair.
**THIS CARD CANNOT PROVE:** that the server would refuse her. Hiding a control is not enforcement — **CARD 6 is the one that proves it, by attempting the write.**
> **WAS (2026-09-03, never proven):** step 3 read *"the PREFERRED mark is visible, and the note is readable"* on the LIST, and step 4 looked for the absence of a **Mark preferred** button on the row. Both describe the inline editor E7 removed. The note is now one click away rather than on the row — a real change in what one glance buys, taken deliberately (David, 2026-09-04: *"the control and the note go in the modal, together"*).

### CARD 6 — 🔴 A MANAGER CANNOT SET IT, PROVEN BY ATTEMPTING (acceptance 3)
**STATUS:** needs-test — **and the reason is stated rather than hidden.** The UI does not offer the control to a manager, so this cannot be proven through the UI alone; proving it needs a direct write, which is a console/SQL step and this card is therefore not `DEVICE: phone`.
🔴 **RUN THIS ON TEST DAVE'S TREE NEST (`f7ec5d67`) AS `test obrien`. NOT ON LAWNS.**
**On LAWNS this card CANNOT FAIL and therefore proves nothing** — Lauren is an OWNER there, so the write she attempts is one she is entitled to make and it will
succeed correctly. A green tick from LAWNS would assert a refusal nobody ever provoked (R-33: a check that cannot disagree is not a check).
**TENANT:** Test Dave's `f7ec5d67` · **ACTOR:** `test obrien` (MANAGER) · 🔧 **NEEDS SETUP** (browser console, real manager session)
**MUST BE TRUE FIRST:** GATE 0 passed. CARD 5 has been run, so you know the UI withholds the control — this card proves the SERVER withholds it too.
⚠️ **THE CONTROL MOVED IN #273 AND THIS CARD DID NOT CHANGE, WHICH IS THE POINT.** The attempt below never went through the UI, so relocating the UI cannot affect it. If this card had been written against the button, it would have needed rewriting — and a security proof that has to be rewritten every time a control moves is a security proof nobody re-runs.
**How to actually prove it** (the SQL editor runs as `postgres`, where `auth.uid()` is NULL and the guard deliberately permits the write — so it must be the browser console in a real manager session):
```js
await supabase.from('vendors').update({ preferred: true }).eq('id', '<a vendor id>')
```
🔴 **Expect an error, code `42501`, message containing `vendor preference is owner-only`.**
**A success here is a security defect, not a pass.** Hiding the button is not enforcement — the trigger is.

### CARD 7 — 🔴 THE NOTE IS THE ASSET, AND IT LIVES WITH THE CONTROL
**STATUS:** owed · **DEVICE:** desktop · 🖱 **NEEDS INTERACTION**
**TENANT:** either · **ACTOR:** owner (David, or Lauren at LAWNS)
**MUST BE TRUE FIRST:** GATE 0 passed. At least one vendor exists.
1. Open **`/vendors`**, pick a vendor, press **Edit vendor**.
2. Scroll to **Preference**. Tick **"This is my preferred vendor"**.
3. In **"Why is this vendor preferred?"** type a real reason — e.g. *"Stock quality is better, even though the price is higher."*
4. Press **Save changes**. The modal closes and the list reloads.
5. 🔴 **Expect a small green `PREFERRED` chip on that row — and NO note text on the list.** The reason lives in the modal now.
5b. 🔴 **Now try to CLICK the chip itself.** Expect **nothing to happen** — no modal, no cursor change to a pointer when you hover it, no highlight. It states a fact; it is not a control. **A chip that looks pressable and does nothing is a dead affordance, and it is the defect E7 would otherwise trade for the one it fixes.** (The **Edit vendor** button is the control. Asserted mechanically too — `vendorEdit.test.ts` §E, mutant M2.)
6. Re-open **Edit vendor** on the same row. **Expect the tick still on and your exact sentence still in the box.**
7. Now untick **"This is my preferred vendor"** and press **Save changes**. Re-open it: 🔴 **the note must be GONE as well as the tick** — a reason explaining a preference that no longer exists would come back with the mark if it were kept.
**FAIL LOOKS LIKE:** the note surviving after the mark is cleared (step 7); the chip appearing with no way to see the reason; your sentence not coming back in step 6 (it saved the tick and dropped the text — the two are written together or not at all).
**THIS CARD CANNOT PROVE:** that a manager sees the note — that is CARD 5.
> **WAS (2026-09-03, never proven):** *"open /vendors, choose a vendor, tap **Mark preferred**… Expect the note displayed WITH the mark on the card — not behind a hover, not behind a click."* 🔴 **Its step 5 also asserted *"Marked preferred, but no reason was recorded."* on the list, and THAT SENTENCE STILL EXISTS — it moved to the manager's read-only block in the modal (CARD 5, step 5). It is not on the list any more.** The old text is kept because it records what the surface used to claim, and because the honest-absence sentence it was protecting is still worth proving.

### CARD 8 — the heading is a true claim in every state (§6 r18)
**STATUS:** owed · **DEVICE:** desktop
Read the subhead in each state and confirm it is *true*, not approximately true:

| State | Expected subhead |
|---|---|
| no vendors | "No vendors yet. One is recorded the first time you capture a document from them." |
| vendors, none preferred, **as owner** | "N vendors. None is marked preferred **yet**." |
| vendors, none preferred, **as manager** | "N vendors. None is marked preferred." — 🔴 **no "yet"**, because "yet" invites an action she may not take |
| exactly one preferred | "N vendors. **\<name\>** is marked preferred." |
| several preferred | "N vendors. **M are** marked preferred." — it must NOT name one of them |

### CARD 9 — 🔴 THE PREFERRED VENDOR IS NOT SORTED TO THE TOP (acceptance 1)
**STATUS:** owed · **DEVICE:** desktop
1. Have at least two vendors, one preferred, whose names sort so the preferred one is NOT first alphabetically.
2. Open `/vendors`.
3. 🔴 **Expect ALPHABETICAL order — the preferred vendor stays where its name puts it.**
4. **If preferred rows float to the top, that is a FAIL.** A sort is the quiet form of a filter, and on the day the preferred vendor is out of stock the other row is the answer.

### CARD 10 — 🔴 THE CAPTURED STRING IS UNTOUCHED (acceptance 4, R-50)
**STATUS:** owed · **DEVICE:** desktop
1. Open `/receipts`.
2. **Every pre-existing receipt still shows its vendor string exactly as captured** — `LAWNS Tree Farm, LLC.`, `bwi`, `Bailey Bark Materials, Inc.`, `Sudderth Brothers Contracting, Inc.`
3. Nothing shows a resolved name in place of what the document said. Nothing shows a document type.

### CARD 11 — an unanswered question never costs you a document
**STATUS:** owed · **DEVICE:** phone
1. Capture a receipt that triggers the question (CARD 3 step 1).
2. **Answer nothing.** Save.
3. 🔴 **The receipt saves.** It appears on `/receipts` with its vendor string.
4. The vendor is simply not linked yet — which is the same state every receipt captured before this build is in.

### CARD 12 — tenant isolation (AC-3)
**STATUS:** owed · **DEVICE:** desktop
1. `LAWNS Tree Farm, LLC.` exists as a vendor string in **all three** tenants (measured 2026-09-02).
2. Create a vendor by that name at `f7ec5d67`.
3. Switch to LAWNS `ed2e5933`. 🔴 **The vendor list must NOT show the other tenant's row**, and marking one preferred in one tenant must not mark it in the other.

### CARD 13 — 🔴 A VENDOR CAN BE EDITED AT ALL (the gap this build closed)
**STATUS:** owed · **DEVICE:** desktop · 🖱 **NEEDS INTERACTION**
**TENANT:** Test Dave's `f7ec5d67` (it holds the only vendor, `bwi`) · **ACTOR:** owner
**MUST BE TRUE FIRST:** GATE 0 passed. Measured 2026-09-04: `bwi` had **0 of 11** non-key columns filled, so every field below starts blank.
1. Open **`/vendors`** → **Edit vendor** on `bwi`.
2. Expect a **centred** modal titled **Edit bwi**, with the line *"Nothing is saved until you press Save. Cancel discards everything you have typed."*
3. Expect four labelled groups — **Identity · Contact · Address · Notes** — then **Preference**.
4. Fill in: Email `orders@bwi.com` · Phone `(512) 555-0100` · **Our account number with them** `SLAW040` · Street `1200 Industrial Blvd` · City `Leander` · State `TX` · ZIP `78641` · Website `bwi.com` · a line of Notes.
5. Press **Save changes**.
6. 🔴 **The list now shows a Contact block and an Address block on the bwi row.**
7. Re-open **Edit vendor**. 🔴 **Every one of the eight values you typed is still there.**
**FAIL LOOKS LIKE:** any field coming back blank in step 7 — in particular **any of the four address fields**, which is exactly the shape of tech-debt #179 (the select named 10 columns while the table had 14, so an address could be written and never read back). A "Saved" message followed by empty address fields is that defect returning.
**THIS CARD CANNOT PROVE:** that a *manager* can do this. CARD 5 step 7 covers that.

### CARD 14 — 🔴 CANCEL DISCARDS, AND A NO-OP SAVE SAYS SO
**STATUS:** owed · **DEVICE:** desktop · 🖱 **NEEDS INTERACTION**
**TENANT:** either · **ACTOR:** owner · **MUST BE TRUE FIRST:** CARD 13 has saved some values.
1. **Edit vendor** → change the phone to something obviously wrong → press **Cancel**.
2. Re-open. 🔴 **The old phone is back.** Nothing was written.
3. **Edit vendor** → change nothing at all → press **Save changes**.
4. 🔴 **Expect: "Nothing on this vendor was different, so nothing was saved."** — stated, not a silent close and not a cheerful "Saved".
5. **Edit vendor** → clear the **Vendor name** entirely → press **Save changes**.
6. 🔴 **Expect the save to be BLOCKED**, a red-bordered name field, and *"A vendor needs a name. It is the only field that is required."*
**FAIL LOOKS LIKE:** Cancel keeping the change (that is the "Cancel means commit everything so far" defect the one-Save model exists to remove); a no-op Save reporting success; or a blank name saving.
**THIS CARD CANNOT PROVE:** that the *server* would reject a blank name. It would — `name` is `NOT NULL` — but this card proves the surface refuses first, so nobody meets that as a raw Postgres error.

### CARD 15 — the duplicate-name refusal is a sentence, not an error code
**STATUS:** owed · **DEVICE:** desktop · 🖱 **NEEDS INTERACTION**
**TENANT:** either · **ACTOR:** owner · **MUST BE TRUE FIRST:** at least one vendor exists; note its exact name.
1. Press **Add vendor**.
2. Type the **exact name of a vendor that already exists in this tenant**.
3. Press **Save vendor**.
4. 🔴 **Expect: "You already have a vendor with that name. Vendor names are unique, so give this one a name that tells them apart — or edit the existing row instead."**
**FAIL LOOKS LIKE:** a raw Postgres string (`duplicate key value violates unique constraint "vendors_business_name_uidx"`), a bare `23505`, or — worst — a **second row appearing** in the list, which would mean the unique index is missing.
**THIS CARD CANNOT PROVE:** case-and-spacing behaviour. The index folds on `lower(btrim(name))`, so `  BWI  ` also collides; try it as a bonus step if you like.

### CARD 16 — 🔴 THE INVOICE NUMBER IS REVIEWABLE **BEFORE** IT IS SAVED
**STATUS:** owed · **DEVICE:** phone (provable without a console) · 🔧 **NEEDS SETUP** (`20260904` applied — GATE 0 item 4)
**TENANT:** Test Dave's `f7ec5d67` · **ACTOR:** any active member
**MUST BE TRUE FIRST:** GATE 0 passed **including migration 4**. Use a document with a printed invoice number — the bwi invoice carries **19893519**.
1. Capture that document and reach the confirm screen.
2. 🔴 **Expect a field labelled "Invoice / receipt number", between Date and the line items, already containing `19893519`.**
3. Expect **no notice** beneath it. The normal case is silent.
4. Save. Open **`/receipts`** and confirm the number appears on that row.
**FAIL LOOKS LIKE:** no such field (you are on a pre-#273 bundle); the field present but **empty** on a document that plainly prints a number; or an amber notice saying the number *"could not be stored"* — that last one means migration 4 is not applied, and it is the system telling the truth rather than a defect.
**THIS CARD CANNOT PROVE:** that the number is unique or deduplicated. **Nothing dedupes on it yet** — the partial unique index is still blocked by tech-debt #143's two live duplicate pairs.
📄 Shares one capture with CARDS 17 and 18 — do all three in one pass.

### CARD 17 — 🔴 A NUMBER **YOU** TYPED IS VISIBLY YOURS
**STATUS:** owed · **DEVICE:** phone · 🔧 **NEEDS SETUP** (same capture as CARD 16)
**TENANT:** Test Dave's `f7ec5d67` · **ACTOR:** any active member
1. On the confirm screen from CARD 16, **clear the number field completely**.
2. 🔴 **Expect an amber notice: "A number was read from this page (19893519) and has been cleared. It will be saved without one."**
3. Now type a **different** number, e.g. `19893520`.
4. 🔴 **Expect an amber notice: "Read from the page as 19893519. Your correction will be recorded as yours."**
5. Restore `19893519` exactly. 🔴 **The notice disappears.**
**FAIL LOOKS LIKE:** no notice at any step (the surface cannot tell your assertion from the document's); the same notice for both the cleared and the corrected case; or a notice still showing at step 5.
**THIS CARD CANNOT PROVE:** the third state — a number typed where the reader found **none**. That needs a document with no printed number: **CARD 18**.

### CARD 18 — 🔴 THE TYPED FALLBACK, WHERE THE READER FOUND NOTHING
**STATUS:** owed · **DEVICE:** phone · 🔧 **NEEDS SETUP** (a document with NO printed number — a fuel or store receipt is ideal)
**TENANT:** Test Dave's `f7ec5d67` · **ACTOR:** any active member
**MUST BE TRUE FIRST:** GATE 0 including migration 4.
1. Capture a document that prints **no** invoice or transaction number.
2. On the confirm screen the number field should be **empty**, with the placeholder *"Not printed on this document"* and the notice *"No document number was found on this page, and none was entered."*
3. Type a number off the paperwork yourself — say `LAWNS-0001`.
4. 🔴 **Expect: "This number was not read from the page — you entered it. It will be recorded as yours."**
5. Save.
**FAIL LOOKS LIKE:** the field being absent or read-only; no notice at step 4; or a notice claiming the number was *read* from the page.
🔴 **THIS IS THE CASE THAT CANNOT BE RECOVERED LATER**, and the reason a column was added rather than the value being inferred: the evidence for *"we read nothing"* is an **absence**, and an absence cannot be reconstructed from a value that is present.
**THIS CARD CANNOT PROVE:** what the stored row looks like. To see that, run in the SQL editor:
```sql
SELECT vendor, receipt_number, receipt_number_original FROM receipts ORDER BY created_at DESC LIMIT 3;
```
🔴 **Expect `receipt_number_original` to be NULL on the row from this card while `receipt_number` holds `LAWNS-0001`** — that pair IS the evidence. On CARD 16's row the two must be **equal**.

---

## WHAT THIS BUILD DOES NOT CLAIM

- **It does not fix double-counting.** The seam now compares an id where one exists, but `cost_objects.receipt_id` is 0 of 5 and `business_inventory.receipt_id` is 0 of 447 (tech-debt #144) — the seam is fed by nothing on the live path. This is a correct mechanism on a path that is not yet travelled.
- **It does not repair the two duplicate receipt pairs** (tech-debt #143, $1,283.88 overstated). Vendor identity makes them more visible, not fixed.
- **It does not resolve any pre-existing receipt.** Re-measured 2026-09-04: `receipts` holds **39 rows**, `vendor_id` populated on **1** — the one captured since the chain was applied. The other 38 stay NULL. ⚠️ **Anything in an older document quoting 36 or 37 is two moves stale** (R-26's shape — this table has moved twice while records described it as fixed).
- 🔴 **It does not backfill `receipt_number_original`.** All 39 rows keep it NULL, including the one row that already carries a `receipt_number`. Writing that number into the original column would ASSERT the reader read it — true in that one instance, unverifiable in general, and a backfill that is right by luck teaches the next reader the column is trustworthy when it was guessed.
- 🔴 **It does not dedupe on the invoice number.** The field is now captured, reviewable and attributed, but the partial unique index on `(business_id, vendor_id, receipt_number)` still cannot land until tech-debt #143's two live duplicate pairs are settled. **Evidence was added; a constraint was not.**
- **It does not audit any other record list against E7.** `/vendors` is the surface that provoked the clause and the only one that meets it. Every other list is UNAUDITED — not found wanting, not looked at.
- 🔴 **`vendors` HAS NO HOME FOR THE BILLING-UNIT ANSWER, AND THAT IS OWED BY RULING — NOT AN OVERSIGHT.** R-65 names it in its own words: *"`vendors` also has no home
  for the billing-unit answer yet — `preferred`/`preference_note` answer a different question."* **They are two different questions about the same vendor:** *is Sudderth
  the vendor I prefer?* (this build, R-64's quality half) and *when Sudderth bills me, is 20.72 yards or tons?* (R-64's billing half, answered on `/receipts/:id` and stored
  in `vendor_preferences`). **Collapsing them onto one flag would make `preferred` mean two things**, and `preference_kind` exists in the other session's table precisely so
  the axis can grow. This build gives that table a real `vendor_id`, a `vendor_preferences_resolved` view and a per-row link function — **a join, not an answer.**
  ⚠️ **Whether the billing unit eventually moves onto `vendors` as a column, or stays a `preference_kind` row, is David's call and nobody should infer it from this build.**
