# QUICKBOOKS INVOICE — FULL-SURFACE OWNER TEST

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for QuickBooks-invoice owner-tests.** It is STANDING, not
> dated — **run it after any change to `api/qbo/invoice/cultivar.ts` or to what an order charges.**
> A per-build proof is a FILTER on this board (`COVERS: #NNN`), never a second document (STD-011).

**Purpose:** prove what the customer actually receives. Every card below is read on the QuickBooks
invoice or in the QuickBooks UI, **not** in Cultivar.

**🔴 WHY THIS BOARD EXISTS, AND IT IS NOT HYPOTHETICAL — IT IS ONE INVOICE.** QB **txnId=436**
(Cultivar order `2661dbe4-e26d-486f-b65f-50e0f56716c3`, dated 07/16/2026, status **"Opened"** =
sent AND viewed) carried this line to a customer:

> `Placement Service — price adjusted (reason: must be filled if discount applied cannot be EMPTY)`

An internal attribution field was interpolated into customer copy (tech-debt **#104**), and the
string itself was a human's note-to-self typed to get past a gate that checks only that the field is
non-empty (**#105**). **Nothing anywhere asserted what the payload said** — QuickBooks returned 200,
because 200 means *accepted*, not *correct*. **This capability had NO owner test at all until
2026-08-24.** That absence is the reason the invoice went out, and this board is the fix for it.

⚠️ **NOTHING BELOW CAN UN-SEND INVOICE 436.** These cards prove what is sent NEXT.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Trustworthy. |
| `STATUS: owed` | 🟡 A test is written but has not been run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 The surface EXISTS and has NO test. A known hole, annotated, not an oversight. |
| `LAST-PROVEN: never` | Nobody has ever run this against a real invoice. |
| `DEVICE:` | `desktop` — every card here is read in QuickBooks on a real screen. |
| `COVERS:` | The tech-debt row / ledger entry this check defends. |
| `SIGNAL:` | The `[TRACE:*]` line. **Always secondary** — every PASS below is visible without a console. |

🔴 **Thunder NEVER marks a card `covered` (OP-14).** Thunder writes the check and sets `owed`; only
David's live run flips it, with a date. **Changing a surface flips its card back to `owed`.**

---

## ⛔ GATE 0 — CONFIRM YOU ARE TESTING THE DEPLOYED CODE (OP-15 — owner-prove STEP ZERO)

> **This is STEP ZERO. Before you push a single invoice: confirm the deploy for the SHA under test
> is live.** If the SHA you are testing is not live, **everything below is fiction** — and on this
> board a wrong answer is not a wasted session, it is **another invoice in a customer's inbox.**

- [ ] **① SHA is live — READ IT OFF THE SCREEN.** The bottom of every Cultivar screen carries
      **`built <date> · <sha>`**. Compare to `git log -1 --format=%h`.
      App: `________` Intended: `________` — **they must MATCH.**
- [ ] **② The Vercel deploy for THAT SHA reads READY** — not a different push's Ready. A failed
      build is SILENT; Vercel keeps serving last-good, and **Vercel deploys the TREE, not the COMMIT.**
- [ ] **③ The new-code signal — WHICHEVER BUILD YOU ARE PROVING:**
      · **CARDS 1–4 (the #215 invoice build):** the signal is the ABSENCE of `(reason: …)` on an
        adjusted line. **If you still see a reason in parentheses, you are on old code — STOP.**
      · **CARDS 5–8 (the #229 item read):** the signal is that **Settings → Accounting shows a
        "QuickBooks item list" section with a `Read item list` button.** **If that section is not
        there, you are on old code — STOP**, and do not read a missing button as a failed read.

---

### CARD 1 — 🔴 THE OVERRIDE REASON DOES NOT REACH THE CUSTOMER'S INVOICE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: tech-debt #104 · ledger #215 · the invoice-surface half only
SIGNAL: `[TRACE:QBO] service price-override line (D-48) — retail + adjustment, not a bare net { … reason: '<your text>' }` — **the reason is STILL in this log, deliberately. That is internal attribution (R-7), and it is the proof the reason was not deleted, only withheld from the customer.**

**As the OWNER or a MANAGER**, take an order to **Checkout → Review**, override a service price
(Placement or Delivery), and **type something unmistakable in the Reason box — e.g. `INTERNAL ONLY
do not print`.** Complete the order and push the invoice to QuickBooks.

**Then open the invoice IN QUICKBOOKS and read the adjusted line.**

- **PASS:** the line reads exactly **`<Service name> — price adjusted`** and **the words you typed
  appear NOWHERE on the invoice.**
- **FAIL (the old behaviour, invoice 436):** `… — price adjusted (reason: INTERNAL ONLY do not print)`.

🔴 **Read the actual invoice in QuickBooks, not the Cultivar confirmation screen.** They are
different surfaces and **only one of them was fixed** — see CARD 3.

---

### CARD 2 — 🔴 THE CONCESSION IS STILL FULLY VISIBLE — BOTH LINES, RIGHT AMOUNTS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: D-48 · the negative-adjustment shape · the QBO 6070 scar
SIGNAL: `[TRACE:QBO] invoice reconcile — lines sum vs the order total { reconciles: true }`

**This is the card that matters most, because it guards what already WORKED.** Withholding the
reason must not have cost the record. On the same invoice as CARD 1:

- **PASS — all four, on the QuickBooks invoice:**
  1. the service appears at its **full retail** (e.g. `Placement Service × 7`, rate `225.00`, amount `1575.00`);
  2. a **separate negative line** `— price adjusted` carries the give-away (e.g. `-575.00`);
  3. those two net to what Cultivar charged (`1000.00`);
  4. the **BALANCE DUE equals the total on the Cultivar confirmation screen, to the penny.**
- **FAIL:** one collapsed line at the reduced rate (the give-away is now invisible forever), OR a
  balance that differs from Cultivar's total, OR **QuickBooks rejecting the invoice with error 6070**
  (*"Amount is not equal to UnitPrice * Qty"*) — that is the exact failure D-48 was built to end.

---

### CARD 3 — ⚠️ THE REGISTER RECEIPT STILL SHOWS THE REASON — EXPECTED, NOT A BUG
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: tech-debt #104, the SECOND HALF — deliberately NOT fixed this build
SIGNAL: —

🔴 **RECORDED SO NOBODY REFILES IT AS A DEFECT.** The Confirmation screen (the receipt shown at the
register) renders the override reason through **`OrderTotals.tsx:97`** — a component shared with the
internal order-detail screen. **One component, two audiences, and it does not know which it is
rendering for**, so teaching it costs more than the invoice fix and **David scoped it out of this
pass on purpose.**

**On the same order as CARD 1**, look at the Cultivar **Confirmation** screen.
- **EXPECTED TODAY:** the adjusted service shows `Baseline $1,575.00 · price adjusted −$575.00 · <your reason text>`.
- **That is the KNOWN state.** It is not a regression and it is not CARD 1 failing.
- `needs-test` **with its reason**: the fix is not built, so there is nothing yet to prove.

---

### CARD 4 — ⚠️ EVERY LINE STILL BOOKS AS "Services" — KNOWN, AND THE FIX IS BLOCKED ON YOU
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: tech-debt #106 · the FIX 2 gate, STOPPED 2026-08-24
SIGNAL: —

🔴 **RECORDED SO IT IS NOT DISCOVERED IN FRONT OF AN ACCOUNTANT.** On any pushed invoice, the
**SERVICE / PRODUCT column reads `Services` on every row — including the plants.** Booked this way
your QuickBooks shows **100% service revenue, zero product sales, and no COGS against inventory.**

**FIX 2 was STOPPED AT ITS GATE this build and nothing was changed.** The reason is on the ledger:
**`value: '1'` is the only QuickBooks item id this platform holds anywhere** — no config, no env var,
no column, no lookup, and **no code path that can read your QuickBooks item list.** Inventing a
second id would push an invoice QuickBooks rejects, and **a push that fails is worse than a push
that mis-categorizes.**

**WHAT UNBLOCKS IT — and as of 2026-08-29 THERE IS AN IN-APP PATH, so this no longer needs a
manual hunt through the QuickBooks UI.** ➡️ **See CARDS 5–8 below: `Settings → Accounting → Read
item list`** returns every item with its **Id, Name, Type and INCOME ACCOUNT**, which is more than
the browser-URL method gives — the income account is the field that actually decides the
Nursery-Stock-vs-Services split. Read it, then hand back **the id and the exact item name** for the
item a tree should map to. Then FIX 2 is a one-seam change.

**The manual route still works and is a fine cross-check:** QuickBooks → **Sales → Products and
services** → open the plants/nursery-stock item → the id is the number in the browser URL. If the
two disagree, the app is wrong and that is worth knowing.

⚠️ **Do not change item `1` itself.** Everything already invoiced points at it.

---

### CARD 5 — 🔴 THE ITEM LIST COMES BACK, AND IT ANSWERS THE CARD-4 QUESTION
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #229 · the CARD 4 / tech-debt #106 unblock · Stage 0 G1+G2+G5
SIGNAL: `[TRACE:QBO] items — read OK { http_status: 200, parsed_ok: true, item_count: N }` — secondary; every PASS below is readable without a console.

**As the OWNER (or a member holding `settings:read`)**, go to **Settings → Accounting**. Under the
green "QuickBooks connected" row there is a section headed **QuickBooks item list**. Press
**Read item list**.

🔴 **THIS IS READ-ONLY AGAINST INTUIT AND IT IS SAFE TO PRESS ON THE LIVE COMPANY.** It sends one
`select * from Item` query. It writes nothing to QuickBooks, creates no invoice, consumes no invoice
number, and stores nothing on our side.

- **PASS — all four:**
  1. a table appears with columns **Id · Name · Type · Income account · Active**;
  2. the rows are **LAWNS's real products and services** — names you recognise from their books;
  3. 🔴 **you can answer CARD 4 from it:** is there an item a **tree** should map to, and what is its
     **income account**? Write down the **id + exact name**;
  4. 🔴 **and check the claim the push has been making all along: is id `1` really named `Services`
     in their company?** The twelve hardcoded literals assert it. This is the first time anything
     has checked.
- **FAIL:** an error box (→ CARD 7), or a table whose names are not LAWNS's.

⚠️ **Change nothing in QuickBooks as a result of this card.** Reading is this pass's whole scope;
the mapping is the next build.

---

### CARD 6 — 🔴 THE FULL RESPONSE LANDED IN A FILE, AND THE FILE IS OUTSIDE THE REPO
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #229 · the no-re-query rule · the "no live customer data where a commit can sweep it up" rule
SIGNAL: —

**On the same press as CARD 5**, before reading the table at all, look for the green line under the
button:

> ↓ Full response saved to your downloads folder as **`qbo-items-<realm>-<timestamp>.json`**

- **PASS — all three:**
  1. the line appears **and names a file**;
  2. the file is **in your Downloads folder** — open it and confirm it is the full JSON QuickBooks
     returned, not the trimmed table;
  3. 🔴 **it is NOT anywhere inside `~/Desktop/trace-platform`.** Confirm with
     `git status --short` in the repo — **the capture must not appear.**
- **FAIL:** no line at all, or the red *"could not be saved to a file"* warning, or the file lands
  inside the repo.

🔴 **WHY THIS CARD IS NOT A NICETY.** Re-reading a customer's books must never mean re-querying a
customer's books, so the response is written to disk **before** anything renders. And it goes to
your downloads folder specifically because that is **outside version control** — the same class of
hazard as the `service_role` JWT that sat in a settings file: the fix is not to redact it, it is to
keep it where git cannot reach it.

---

### CARD 7 — 🔴 A FAILED READ NAMES ITS OWN CAUSE — 401 AND 403 ARE DIFFERENT PROBLEMS
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: Stage 0 G2 (scope) · Stage 0 G3 (token refresh) · ledger #229
SIGNAL: `[TRACE:QBO] items — Intuit refused the read { http_status, points_at }`

**`needs-test` WITH ITS REASON, and the reason is the honest one: this cannot be provoked on
demand without either breaking the live connection or waiting for it to lapse.** Recording the
hole beats leaving it unrecorded (OP-14 clause 2).

**IF a read ever fails, this is what to check** — and the message is built to tell you which
problem you have rather than making you guess:

- **401 →** *"the access token is expired or was revoked — this is the token-refresh path (G3), not
  a permissions problem."* **Reconnect QuickBooks from this same card.**
- **403 →** *"the granted scope does not permit it (G2)."* That would mean the recon's reading of
  `com.intuit.quickbooks.accounting` was wrong, and it is a **different** fix entirely.
- **anything else →** the message quotes the status and points at the capture file.

🔴 **THE CAPTURE FILE IS STILL WRITTEN ON FAILURE** — with Intuit's verbatim error body, which is
the artifact worth keeping. **Check for it before pressing the button a second time**, because a
retry against a customer's books is a thing to do deliberately, not reflexively.

---

### CARD 8 — 🔴 SOMEONE WITHOUT `settings:read` CANNOT READ THE COMPANY'S BOOKS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: MB_D-015 · Stage 0 G6 · ledger #229
SIGNAL: `[TRACE:QBO] items REFUSED — caller lacks settings:read/owner { businessId }`

🔴 **THE GATE IS THE ONLY THING PROTECTING THIS.** The endpoint reads under the **service key**,
which bypasses RLS entirely — so `bas_owner_all` never runs on this path and no policy is standing
behind the check. It is worth one real test.

**Sign in as a STAFF member** (or any member without `settings:read`) on the same tenant and try to
reach **Settings → Accounting**.

- **PASS:** you never reach the card at all — `/settings` is already gated — **and** if the endpoint
  is called directly, it returns **403 `Not authorized to read QuickBooks items for this business`**.
- **FAIL:** a staff session can see the item list, or a 403 does not appear when the endpoint is
  called with a staff token.

⚠️ **The authority is resolved from the BEARER TOKEN, never the request body** — so naming a
different `business_id` gets you nothing, and that is worth trying once if you want to prove it.

---
## WHAT THIS BOARD DOES NOT COVER (said out loud, so absence is not read as coverage)

- **The tax line** — pushed as a computed `Sales Tax (x%)` line on the same `Services` item, because
  **no QuickBooks tax field is used anywhere in this repo** (measured: zero hits for `TxnTaxDetail` /
  `TaxCodeRef` / `GlobalTaxCalculation` / `TaxRateRef` / `SalesTaxRef`). Consistent with **D-37**.
  **Whether booking tax this way suits a filing business is a question for David's accountant** —
  it is not a TRACE question and no card here answers it.
- **The deploy-window strip and the edit path** (tech-debt #105) — two paths that lose the override
  attribution entirely. Out of scope this pass; no card written.
- **The tier-discount line** — prints a percentage and no type, because the tier NAME is never
  persisted on the order (tech-debt #107).
- **PAGINATION of the item list** — CARDS 5–8 read ONE page. A company with more items than one page
  returns a partial list and **nothing on screen says so**. Deliberately not built this pass
  (`STARTPOSITION` is absent rather than half-written); if LAWNS's list looks truncated, say so
  rather than assuming it is complete.
- **STORING the item list** — nothing is persisted, by decision. Whether TRACE should hold a
  customer's chart of items is its own ruling and has not been made (`user_stories.md` — *QuickBooks
  read-back*).
- **THE MAPPING ITSELF** — reading the ids does not change the twelve literals. CARD 4 stays
  `needs-test` until that build lands.
