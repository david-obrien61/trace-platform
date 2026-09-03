# OWNER TEST — VENDOR IDENTITY AND THE PREFERRED VENDOR

**Capability:** vendor identity + preference (`/vendors`, and the vendor question on `/receipts`)
**Ledger:** #259 · **Branch:** `thunder/vendor-identity` · **Rulings:** R-64 (implemented here for the quality preference) · R-65 (consolidation) · D-47 (identity) · R-50 · R-54
**Last updated:** 2026-09-03
**Proven:** 0 of 12 · **Owed:** 11 · **needs-test:** 1

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
**STATUS:** owed · **DEVICE:** desktop
1. Open `/vendors`.
2. Expect the heading **Vendors** and a subhead that matches reality (see CARD 8).
3. With no vendors captured yet, expect *"No vendors yet. One is recorded the first time you capture a document from them."* — **not a blank card, not a spinner that never resolves.**

### CARD 2 — a captured receipt creates a vendor
**STATUS:** owed · **DEVICE:** phone (provable without a console)
1. Capture a receipt from a vendor you have never captured before.
2. Save.
3. Open `/vendors`. **The vendor is there, named exactly as you typed it.**

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
1. As an OWNER at `f7ec5d67`, mark a vendor preferred with a note.
2. **Sign in as `test obrien` (MANAGER).** Open `/vendors`.
3. **Expect: the vendor list loads, the PREFERRED mark is visible, and the note is readable.**
4. 🔴 **Expect NO "Mark preferred" button.** In its place: *"The preferred vendor is set by the owner. You can see the mark and the reason, and they cannot be changed from your account."*
5. **A blank where the note should be is a FAIL. An empty list is a FAIL** — that would mean the surface inherited a gate it must not have.

### CARD 6 — 🔴 A MANAGER CANNOT SET IT, PROVEN BY ATTEMPTING (acceptance 3)
**STATUS:** needs-test — **and the reason is stated rather than hidden.** The UI does not offer the control to a manager, so this cannot be proven through the UI alone; proving it needs a direct write, which is a console/SQL step and this card is therefore not `DEVICE: phone`.
🔴 **RUN THIS ON TEST DAVE'S TREE NEST (`f7ec5d67`) AS `test obrien`. NOT ON LAWNS.**
**On LAWNS this card CANNOT FAIL and therefore proves nothing** — Lauren is an OWNER there, so the write she attempts is one she is entitled to make and it will
succeed correctly. A green tick from LAWNS would assert a refusal nobody ever provoked (R-33: a check that cannot disagree is not a check).
**How to actually prove it** (the SQL editor runs as `postgres`, where `auth.uid()` is NULL and the guard deliberately permits the write — so it must be the browser console in a real manager session):
```js
await supabase.from('vendors').update({ preferred: true }).eq('id', '<a vendor id>')
```
🔴 **Expect an error, code `42501`, message containing `vendor preference is owner-only`.**
**A success here is a security defect, not a pass.** Hiding the button is not enforcement — the trigger is.

### CARD 7 — 🔴 THE NOTE IS THE ASSET
**STATUS:** owed · **DEVICE:** desktop
1. As an owner, open `/vendors`, choose a vendor, tap **Mark preferred**.
2. Type a real reason — e.g. *"Stock quality is better, even though the price is higher."*
3. Save.
4. **Expect the note displayed WITH the mark on the card — not behind a hover, not behind a click.**
5. Mark a vendor preferred and leave the note EMPTY. **Expect *"Marked preferred, but no reason was recorded."*** — an honest absence, never a blank.

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

---

## WHAT THIS BUILD DOES NOT CLAIM

- **It does not fix double-counting.** The seam now compares an id where one exists, but `cost_objects.receipt_id` is 0 of 5 and `business_inventory.receipt_id` is 0 of 447 (tech-debt #144) — the seam is fed by nothing on the live path. This is a correct mechanism on a path that is not yet travelled.
- **It does not repair the two duplicate receipt pairs** (tech-debt #143, $1,283.88 overstated). Vendor identity makes them more visible, not fixed.
- **It does not resolve any pre-existing receipt.** `receipts.vendor_id` is NULL on all 36 rows and stays that way — R-50 forbids retro-classifying a stored row.
- 🔴 **`vendors` HAS NO HOME FOR THE BILLING-UNIT ANSWER, AND THAT IS OWED BY RULING — NOT AN OVERSIGHT.** R-65 names it in its own words: *"`vendors` also has no home
  for the billing-unit answer yet — `preferred`/`preference_note` answer a different question."* **They are two different questions about the same vendor:** *is Sudderth
  the vendor I prefer?* (this build, R-64's quality half) and *when Sudderth bills me, is 20.72 yards or tons?* (R-64's billing half, answered on `/receipts/:id` and stored
  in `vendor_preferences`). **Collapsing them onto one flag would make `preferred` mean two things**, and `preference_kind` exists in the other session's table precisely so
  the axis can grow. This build gives that table a real `vendor_id`, a `vendor_preferences_resolved` view and a per-row link function — **a join, not an answer.**
  ⚠️ **Whether the billing unit eventually moves onto `vendors` as a column, or stays a `preference_kind` row, is David's call and nobody should infer it from this build.**
