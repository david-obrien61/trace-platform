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
- [ ] **③ The new-code signal:** this build's signal is the ABSENCE of `(reason: …)` on an adjusted
      line. **If you still see a reason in parentheses, you are on old code — STOP.**

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

**WHAT UNBLOCKS IT — DAVID, IN QUICKBOOKS, and it is a read not a build:**
1. In QuickBooks: **Sales → Products and services.**
2. Find (or create, your call) an item for **plants/nursery stock** — the *Product* kind, not *Service*.
3. Open it and read its **id** — it is the number in the browser URL when the item is open
   (`…/app/service?id=NN` or similar). **That number is the missing input.**
4. Hand back **the id and the exact item name.** Then FIX 2 is a one-seam change.

⚠️ **Do not change item `1` itself.** Everything already invoiced points at it.

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
