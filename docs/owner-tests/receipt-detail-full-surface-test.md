# OWNER TEST — THE RECEIPT DETAIL VIEW: EVERY LINE, THE TAX, AND THE OWNER'S PENCIL

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> Match it to `git log --oneline origin/main -1` — **not to a SHA written in this file**, because
> Vercel deploys the TREE and *any* push to `main`, docs included, moves the stamp.
> *(GATE 0 · OP-15.)*

**Capability:** ⚠️ **NONE — unchanged from #252 and still a finding.** The Receipt Keeper surface
carries **no id on the 24-capability board**. Flagged twice now; not minted here.
**Story:** `user_stories.md` → *Snap a document, and it goes where it belongs* (the *"she keeps the
paper, and what the reader made of it"* clause — **corrected this session**, see CARD 12).
**Standing test.** Thunder writes the cards and sets `owed`. **Only David's live run flips a card to `covered`, with a date.**
**Board: 0 of 12 covered** (11 `owed` · 1 `needs-test`).
**DEVICE:** all cards `DEVICE: desktop` — this is a reconcile-and-correct surface, and reconcile is desktop (capture=mobile / reconcile=desktop).

> ✅ **MIGRATION GATE — CLEARED 2026-09-03. CARDS 6–11 ARE NO LONGER BLOCKED.**
> `supabase/migrations/20260902_receipt_line_edit_and_vendor_preference.sql` **is APPLIED.**
> David ran it and returned the catalog verification (A)–(F): `edit_receipt_line_items` and
> `guard_receipt_snapshot_and_lines` both `prosecdef=true`, both **owned by `postgres`**;
> `trg_receipts_snapshot_and_line_guard` `tgenabled='O'`; `vendor_preferences` `relrowsecurity=true`
> with its four policies (`member_insert a` · `member_select r` · `member_update w` · `owner_all *`)
> and both indexes incl. `vendor_preferences_one_per_vendor_kind_uidx`.
>
> 🔴 **AND THE WRITE-ONCE GUARD WAS PROVEN BY BEING REFUSED — TWICE, AS `postgres`, FROM THE SQL EDITOR:**
> ```
> ERROR: 42501: receipts.line_items_original is write-once:
>        it is the record of what the OCR read
> CONTEXT: PL/pgSQL function public.guard_receipt_snapshot_and_lines() line 9
> ```
> **That is not a UI check, and not a policy a caller with the right permission can slip past. It
> refuses everybody, the superuser included.** A refusal that names its own reason in plain words is
> the evidence — and it is the negative control this guard could not have passed by accident
> ([[R-33]]). **Recorded OWNER-PROVEN at the schema layer**; the CARDS below still owe the UI run.
>
> ✏️ **ORIGINAL GATE TEXT, PRESERVED** (do not delete a claim that was once true): *"THIS ONE DOES
> NOT WORK WITHOUT IT … Un-applied, the read cards (1–5) still pass and every edit card fails with
> 'Could not find the function' — which would read as a code defect and is not one."* That warning
> was correct and is now HISTORY. Ledger #261.

> ⚠️ **WHAT THIS BUILD DOES NOT TOUCH.** No `api/` function (12/12 untouched), no new permission
> string, and **not one row of live receipt data is modified except by you, deliberately, on
> CARD 6.** The two duplicate captures and the six receipts with no order are still surfaced and
> still unrepaired — that is tech-debt #143/#144 and remains your call.

---

## CARD 1 — a receipt opens at all
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Open `/receipts` as the owner and click **Sudderth Brothers Contracting, Inc.** (or *Open this receipt ›*).

1. The URL becomes `/receipts/<id>`.
2. The page shows the vendor, the date, the category and **$1,301.98**.

**PASS:** the receipt opens on its own page.
**FAIL:** the click does nothing, or you land back on the list.

---

## CARD 2 — 🔴 THE CARD THIS BUILD EXISTS FOR: all three lines, with the quantity and the rate
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
On the Sudderth receipt, look at **Lines**.

1. **Three** rows are listed.
2. The first shows **20.72** under Quantity and **$35.00** under Rate, amount **$725.20**.
3. The second shows **21.31** and **$25.00**, amount **$532.75**.
4. The third is the **CREDIT CARD FEE**, quantity 1, rate $44.03, amount **$44.03**.

**PASS:** the quantities and the rates are on the screen.
🔴 **This is the whole point.** From the list this receipt is *"$1,301.98 of Services"*. These four
numbers are what let Lauren say what the material was and whether 20.72 is yards or tons.
⚠️ **Quantity and Rate will each carry a small amber note reading _"reader read 20.72 — the saved
copy never carried it"_.** That is CORRECT and is CARD 3.
**FAIL:** the quantity or rate columns are empty, or only the description and amount appear.

---

## CARD 3 — the amber note tells the truth about whose omission it was
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Still on Sudderth. Read the banner above the table and the amber notes in the Quantity/Rate cells.

1. A banner says the receipt was captured **before the platform kept quantities and rates on the
   saved copy — it dropped them on save**.
2. The cell notes read **"reader read … — the saved copy never carried it"**.

**PASS:** the wording puts the omission on the PLATFORM.
🔴 **Read the sentence, do not just check it is there.** It must NOT say the value was *changed*,
*removed*, or *deleted* — nobody edited these. The save path threw them away, on 171 of 171 stored
lines. A note implying Lauren deleted a quantity is a fail even though a note is present.
**FAIL:** the note says changed/removed/deleted, or there is no note and the columns are simply blank.

---

## CARD 4 — the tax, and the honest absence of a subtotal
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Look at **What the reader recorded for this document** on Sudderth, then on a **bwi** receipt.

1. On **Sudderth** both Subtotal and Tax read *"No subtotal was printed on this document."* /
   *"No tax was printed…"* — Sudderth is a services invoice and printed neither.
2. On a **bwi** receipt a real Tax figure appears, and a **Tax** line appears in the table below it.
3. The bwi Tax line carries the note **"Added by the platform from the tax the reader found."**

**PASS:** figures where they exist, a sentence where they do not.
🔴 **Neither field may show `$0.00`.** There is no `subtotal` or `tax` column on `receipts` at all
(21 columns, measured) — a zero here would be a fabricated measurement, the same class as `0 min on
site`. **A blank is equally a fail:** an absence a reader must interpret is the defect.
**FAIL:** a `$0.00`, an empty box, or the Tax line attributed to the owner.

---

## CARD 5 — the document is on the page, and it is a PDF
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
Scroll to **The document** on Sudderth, then open any **jpg** capture.

1. Sudderth renders an embedded **PDF** you can read, plus an *Open the PDF* button.
2. A jpg capture renders as an **image**.

**PASS:** you can read the actual paper in both cases.
🔴 **8 of 36 captures are PDFs, Sudderth among them.** An `<img>` pointed at a PDF renders nothing
and reports nothing — an empty frame here is a fail, not a slow load.
**FAIL:** a broken image icon, an empty frame, or a download that never opens.

---

## CARD 6 — 🔴 THE OWNER CORRECTS A LINE, AND THE ORIGINAL SURVIVES IT
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
As the **owner**, on any receipt, press **Correct a line**.

1. The cells become editable. Change one **description** slightly (add a word — do NOT change any
   amount yet). Press **Save changes**.
2. A green message names how many values changed.
3. The cell now shows your new text **and an amber note reading "reader read <the old text>"**.
4. Reload the page. Both are still there.

5. 🔴 **AND LOOK AT THE QUANTITY COLUMN.** On a receipt captured before today (Sudderth, bwi, Bailey
   Bark — all of them), the quantity and rate must **still show the reader's values**. They must not
   have gone blank, and they must not now read as *changed*.

**PASS:** the edit persists, what the OCR read is still displayed beside it, and the untouched
columns are unharmed.
🔴 **STEP 5 IS THE SUBTLE ONE.** The saved copy on those rows never carried a quantity, so the edit
form seeds it from what the reader read. Without that, changing a description and pressing Save
would blank the rate — turning *"the platform never saved this"* into *"the owner deleted this"*,
which is the exact accusation CARD 3 exists to prevent, arriving through the save path instead.
🔴 **Then prove the snapshot is untouched** — in the SQL editor:
```sql
SELECT line_items_original FROM receipts WHERE id = '<the receipt you edited>';
```
It must be **byte-identical to before your edit**, still carrying all five keys.
**FAIL:** the original changes, or the amber "reader read" note does not appear.

---

## CARD 7 — the edit is in the audit trail, with who and what
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
After CARD 6, in the SQL editor:
```sql
SELECT actor_user_id, action, target_id, detail, outcome, created_at
FROM audit_log WHERE action = 'receipt.line_items_edited' ORDER BY created_at DESC LIMIT 1;
```

1. `actor_user_id` is **your** user id; `target_id` is the receipt you edited.
2. `detail -> 'changes'` names the **line index, the field, and the from and to values**.
3. `outcome` is `success`.

**PASS:** who, when, which field, from what to what, on which receipt — all present.
⚠️ **Then prove it cannot be rewritten:** `UPDATE audit_log SET outcome='denied' WHERE …` must
**ERROR**. (That is `audit_log`'s standing guarantee, not this build's — but this build's row is
worthless without it.)
**FAIL:** no row, a row with an empty `changes`, or the UPDATE succeeding.

---

## CARD 8 — 🔴 A MANAGER CANNOT, AND IT IS PROVEN BY ATTEMPTING IT
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
🔴 **Use the MANAGER on `Test Dave's Tree Nest`** — measured 2026-09-02 to hold **all four
`costs:*` verbs** (`costs:create`, `costs:read`, `costs:update`, `costs:delete`).

1. Signed in as that manager, open a receipt in **that** business. The lines are visible, and the
   page says *"Only the business owner can change these lines."* There is **no Correct a line button**.
2. Now defeat the UI, because a hidden button is not a gate. In the SQL editor **as that manager's
   session**, or via the API:
   ```sql
   SELECT edit_receipt_line_items('<a receipt id in that business>',
                                  '[{"description":"x","amount":1}]'::jsonb);
   ```
3. It must **ERROR: only the business owner may edit receipt line items**.
4. 🔴 **AND CHECK THAT NO `audit_log` ROW APPEARS FOR IT.** This step was written the other way
   round — *"an `audit_log` row appears with `action='receipt.line_edit_denied'`"* — and it was
   **wrong, and would have failed**. The refusal cannot audit itself: the RPC has no enclosing
   `EXCEPTION` block, so the `RAISE` aborts the transaction and any INSERT above it is rolled back
   with everything else. The doomed INSERT has been removed rather than left to look like a record
   that exists. The gap is **tech-debt #150**, and this step now proves the gap is where we say it
   is instead of asserting a row that cannot be there.
   ```sql
   SELECT count(*) FROM audit_log WHERE action = 'receipt.line_edit_denied';   -- expect 0
   ```

**PASS:** the attempt is refused **by the database**, and no phantom record of the refusal exists.
🔴 **WHY THIS PARTICULAR MANAGER AND NOT ANY MANAGER.** A manager holding no `costs:*` would be
refused by the **read** long before reaching the guard — the test would pass with the guard
**deleted**, which is the false green this whole card exists to avoid (R-33). Before this build,
that manager could update any receipt row in that business: `receipts_member_update` gates on
`costs:update` and nothing narrowed it to the owner.
**FAIL:** the RPC succeeds, or fails with a *permission denied for table* error instead of the
owner message (that would mean the read wall stopped you, not the owner guard).

---

## CARD 9 — an edit that breaks the arithmetic says so instead of re-stamping `match`
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
As the owner, press **Correct a line** and change one **amount** by a large sum (e.g. $725.20 → $25.20).

1. The verdict panel switches from *"What the platform banked"* to **"If you save this"**.
2. It turns red and says the lines no longer add up to the saved total, and that saving records
   that you were shown this.
3. The button reads **Save anyway**, not *Save changes*.
4. Save it. Reload. The banked verdict now reads as an **overridden mismatch**, NOT as a match.

**PASS:** the broken total is announced before and after saving.
🔴 **The specific failure this catches:** silently re-stamping `match` on a receipt whose lines no
longer reconcile. Put the amount back afterwards.
**FAIL:** it saves quietly, or the verdict still reads green/`match`.

---

## CARD 10 — a blank is an answer, and it does not become $0.00
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
As the owner, press **Correct a line** and **clear one line's Amount entirely** (leave it empty).

1. The preview does **not** show a green match. It says a line has no amount, so the lines cannot
   be checked against the total, and it **will save as unreconciled rather than as a match**.
2. Save. Reload. The banked verdict reads that no reconciliation was recorded — **not** `match`,
   and **not** a $0.00 line.

**PASS:** the unknown stays unknown and the receipt reports incomplete.
🔴 Restore the amount afterwards. **The point:** a blank summed as zero would reconcile perfectly
and be completely false.
**FAIL:** the empty cell reconciles as though the line were free, or shows $0.00.

---

## CARD 11 — the vendor is asked once, and the answer shows up on the NEXT invoice
**STATUS:** owed · **DEVICE:** desktop · **LAST-PROVEN:** —
🔴 **Use `bwi`, not Sudderth** — there is only **one** Sudderth receipt at LAWNS, so it cannot
demonstrate "next invoice". **bwi has 4**; Bailey Bark has 3.

1. Open a **bwi** receipt. A card reads **"When bwi bills you, is it by the —"** with
   **the yard · the ton · the load · not sure**.
2. 🔴 The question names **the vendor and no figure from the document**. *"Is 20.72 yards or tons?"*
   would be a fail — it returns on every invoice forever.
3. Answer it.
4. Open a **different bwi receipt**. It shows the standing answer — **"bwi bills by the ton"** — and
   does **not** ask again.
5. Open **Bailey Bark**. It **does** ask, because that is a different vendor.

**PASS:** asked once per vendor, answered forever, and not leaked to other vendors.
⚠️ **Also try "not sure"** on Bailey Bark: it must record that nobody was sure and **stop asking** —
"not sure" is an answer, not a skipped question.
⚠️ `hour` is deliberately **not** on the list — the unit taxonomy is a closed DB CHECK and adding it
is your decision, not this build's.
**FAIL:** the second bwi receipt asks again, or the answer appears on a different vendor's receipt.

---

## CARD 12 — the list no longer accuses Lauren of an edit she did not make
**STATUS:** needs-test · **DEVICE:** desktop · **LAST-PROVEN:** —
⚠️ **`needs-test` WITH ITS REASON:** this card is a **re-read of #252's CARD 2**, whose expected text
this build changed. It is recorded here so the change is not invisible, but the card it amends lives
on `receipts-view-full-surface-test.md` and **that board is the one that should carry the flip** —
duplicating it here would be two documents answering one question (STD-011). Fold it in at merge.

On `/receipts`, read the sentence under **What the platform banked at save time** on any row.

1. It must **NOT** say *"Owner changed something before saving."*
2. It should read that the row is flagged as edited **but the total was not changed**, and that the
   flag also counts the platform's own date reformatting and the tax line it adds.

**PASS:** the sentence no longer asserts an owner edit that did not happen.
🔴 **Measured 2026-09-02, population 35:** vendor differs **0**, amount **3**, category **2**, date
**29** (our ISO conversion), lines **30** (our injected Tax line). `header_amount_edited` false on
**36 of 36**.
**FAIL:** the old sentence is still there.
