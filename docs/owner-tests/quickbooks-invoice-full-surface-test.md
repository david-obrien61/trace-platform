# QUICKBOOKS INVOICE — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance, no dashboard, no `git log`. *(GATE 0 · OP-15 · paid for on 2026-08-31: a whole
> session was spent hunting a defect in code that was never deployed.)*

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
      · **CARDS 12–14 (the #231 invoice read):** the signal is a **THIRD button** in the
        **Read from QuickBooks** section, reading **`Read invoice history`**. Two buttons means you
        are on #230's code — **STOP.** A missing button is not an empty invoice history.
      · **CARDS 4, 15–17 (the #237 push disarm):** the signal is that a completed order returns
        **`QBO_ITEM_UNMAPPED`** instead of creating an invoice. 🔴 **If an invoice IS created, you
        are on old code and it has just booked against item `1` — STOP, and check QuickBooks.**
        That is the one card on this board whose old-code path writes to a customer's books.

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

### CARD 4 — 🔴 THE TWELVE LITERALS ARE GONE — AND WITH NO MAPPING, THE PUSH REFUSES
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: tech-debt #106 (RESOLVED) · ledger #237 · the ③ disarm
SIGNAL: a completed order returns **`QBO_ITEM_UNMAPPED`** and names the lines — NOT a QuickBooks invoice.

⚠️ **THIS CARD WAS REWRITTEN 2026-08-30 AND THE OLD TEXT IS GONE ON PURPOSE — the surface it
described no longer exists.** It previously read *"every line still books as Services — KNOWN, and
the fix is blocked on you"* and was `needs-test`, pinning the defect. **The defect is fixed; a card
still describing it would assert a state the code cannot produce.** What it asserted is preserved
in ledger #215 and in the git history of this file.

🔴 **WHAT CHANGED, AND WHY THE ANSWER IS A REFUSAL RATHER THAN A BETTER GUESS.** The twelve
hardcoded `ItemRef: { value: '1', name: 'Services' }` literals are removed. The item read settled
what they would have cost: **item `1` exists, is named "Sales" — not "Services" — and books to the
generic income account** already holding $41,667 on your P&L beside $1.52m of nursery stock. So the
push would **not** have failed; it would have **succeeded and silently misfiled every tree.** A
default is how that happens, so there is no default: **no row, no id, no push.**

⚠️ **THE MAPPING DOES NOT EXIST YET (that is pass ②), SO TODAY EVERY REVENUE LINE REFUSES. THAT IS
THE PASS CONDITION OF THIS CARD, not a failure.**

**HOW TO RUN (Test Dave's — NEVER LAWNS):**
1. Make sure `QBO_PUSH_HOLD` does **not** cover Test Dave's for this one test, so the push actually
   runs and can refuse. ⚠️ **Leave the LAWNS hold ON.**
2. Complete an ordinary order with at least one plant and one priced service.
3. **PASS:** the order COMPLETES and is correct in TRACE, and the QuickBooks step comes back with
   **`QBO_ITEM_UNMAPPED`** and a message naming **each** unmapped line, the money at stake, and
   *"TRACE will not pick one — that is how every tree came to book as generic income."*
4. **Open QuickBooks and confirm NO invoice was created.** This is the half that matters: a refusal
   that still writes is not a refusal.
5. Console: `[TRACE:QBO] ⚠ REVENUE LINE HAS NO INTUIT ITEM` once per line, then
   `[TRACE:QBO] REFUSED — revenue lines with no QuickBooks item (failed intent)` with the count.

- **FAIL:** an invoice appears in QuickBooks · any line books against item `1` or an item named
  "Services" · the message names only the first bad line · the order itself fails or is left in a
  broken state (the ORDER must be fine — only the push is refused).

⚠️ **Do not change item `1` itself.** Everything already invoiced points at it.

---

### CARD 5 — 🔴 THE ITEM LIST COMES BACK, AND IT ANSWERS THE CARD-4 QUESTION
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #229 · #230 · the CARD 4 / tech-debt #106 unblock · Stage 0 G1+G2+G5
SIGNAL: `[TRACE:QBO] items — read COMPLETE { expected: N, retrieved: N, has_item_id_1: … }` — secondary; every PASS below is readable without a console.

⚠️ **THIS CARD'S SURFACE MOVED IN #230 AND THE CARD IS RE-WORDED TO MATCH.** The section is now
headed **Read from QuickBooks** and holds TWO buttons; the read paginates and states its own
completeness. A card describing the old one-page surface would have asserted a proof nobody
performed.

**As the OWNER (or a member holding `settings:read`)**, go to **Settings → Accounting**. Under the
green "QuickBooks connected" row there is a section headed **Read from QuickBooks**. Press
**Read item list**.

🔴 **THIS IS READ-ONLY AGAINST INTUIT AND IT IS SAFE TO PRESS ON THE LIVE COMPANY.** It sends a
`select count(*) from Item` and then `select * from Item` pages. It writes nothing to QuickBooks,
creates no invoice, consumes no invoice number, and stores nothing on our side.

- **PASS — all five:**
  1. 🔴 **a GREEN completeness line appears above the table** reading *"Complete — QuickBooks reports
     N and N were retrieved across P page(s)"* — **the two numbers must be EQUAL.** If it is a red
     box saying INCOMPLETE, that is a FAIL and it is the whole point of this build (→ CARD 9);
  2. 🔴 **an answer box states whether item Id 1 exists**, and if it does, its name and income
     account. This is the first time the claim the push makes twelve times has been checked;
  3. a **stat row** reads items / sellable / categories / inactive, and a **By income account**
     table lists every account with its count;
  4. the full table appears with columns **Id · Name · Type · Income account · Active**, and the rows
     are **LAWNS's real products and services**;
  5. 🔴 **you can answer CARD 4 from it:** is there an item a **tree** should map to, and what is its
     **income account**? Write down the **id + exact name**.
- **FAIL:** an error box (→ CARD 7), a red INCOMPLETE box (→ CARD 9), or a table whose names are not
  LAWNS's.

⚠️ **Change nothing in QuickBooks as a result of this card.** Reading is this pass's whole scope;
the mapping is the next build.

---

### CARD 6 — 🔴 THE FULL RESPONSE LANDED IN A FILE, AND THE FILE IS OUTSIDE THE REPO
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #229 · #230 · the no-re-query rule · the "no live customer data where a commit can sweep it up" rule
SIGNAL: —

⚠️ **RE-WORDED IN #230:** the file now holds an ENVELOPE — every page's verbatim body plus the
expected/retrieved totals — rather than one body, and the customer read writes its own file under a
`qbo-customers-…` name. Same rule, more pages.

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
- ~~**PAGINATION of the item list**~~ ✅ **BUILT 2026-08-29 (#230) — and the flag that predicted it
  FIRED.** The one-page read came back `maxResults: 100, startPosition: 1` with ids past 1127. The
  read now counts first, pages at MAXRESULTS 1000, and REFUSES a shortfall. → CARDS 5 and 9.
- **STORING the item list** — nothing is persisted, by decision. Whether TRACE should hold a
  customer's chart of items is its own ruling and has not been made (`user_stories.md` — *QuickBooks
  read-back*).
- **THE MAPPING ITSELF** — reading the ids does not change the twelve literals. CARD 4 stays
  `needs-test` until that build lands. ⚠️ **As of #231 the mapping's LAST MISSING INPUT is in hand:**
  the invoice history says which items the trees actually sold as, and what the discount lines were
  computed on. The build is still not done — this only removes the reason to defer it.
- **THE INVOICE HISTORY'S OWN CONTENT** — this board proves the read is complete, honest and
  private. **It does not audit whether LAWNS's own invoices are correct.** If the item names or
  quantities in their books are wrong, that is a fact about their bookkeeping, and no card here
  catches it.
- **THE VOLUME CEILING'S NUMBER** — 10,000 is a human judgement. A cap proves the refusal FIRES; no
  cap proves 10,000 is the right place for it.

---

### CARD 9 — 🔴 THE LIST PROVES IT IS THE WHOLE LIST, OR IT REFUSES
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #230 · R-24 clause (a) · the #229 truncation
SIGNAL: `[TRACE:QBO] count OK { expected: N }` then `[TRACE:QBO] page OK { page, rows_in_page, retrieved, expected }` per page — secondary.

🔴 **THIS IS THE CARD THE WHOLE BUILD EXISTS FOR.** #229's read returned exactly 100 rows carrying
ids past 1127 — a truncated list rendered as a complete one — and the ONLY reason anybody knew is
that you read the ids. Completeness is now a claim the screen makes out loud on every read.

**On the same press as CARD 5, and again on CARD 10's customer read**, read the line above the
results.

- **PASS:** a **green** line, *"Complete — QuickBooks reports N and N were retrieved across P
  page(s)"*, with **the two numbers equal**. For items, N should be well above 100 — if it reads
  exactly 100, the pagination did not take.
- **PASS (the other direction, and it is still a pass for this card):** a **red** box reading
  *"INCOMPLETE — QuickBooks reports N but M were retrieved"*. That is the guard WORKING. Report the
  two numbers; do not treat the partial list as the list.
- **FAIL:** results with **no completeness line at all**, or a green line whose two numbers differ.
  Either means the claim is decorative.

⚠️ **A third state exists and it is honest:** *"QuickBooks did not give a readable total, so this
list of N CANNOT be proven complete."* That is not the data being wrong — it is the count query
having failed. Report it; do not use the list as complete.

---

### CARD 10 — 🔴 THE CUSTOMER LIST COMES BACK AS A SUMMARY, AND ~1,900 PEOPLE ARE NOT ON THE SCREEN
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #230 · R-24 clauses (b) and (c) · R-23 clauses (a)(b)(c)
SIGNAL: `[TRACE:QBO] customers — read COMPLETE { expected, retrieved, with_email, with_phone, … }` — 🔴 **counts only. If you see a NAME, an EMAIL, a PHONE or an ADDRESS in a trace line, that is a FAIL and it is the serious kind.**

**As the OWNER**, in the same **Read from QuickBooks** section, press **Read customer list**.

🔴 **READ-ONLY, AND IT STORES NOTHING** — same rule as the item read, against a file of real people.

- **PASS — all six:**
  1. the green **completeness** line (→ CARD 9), roughly **1,900** and equal both sides;
  2. a **stat row**: customers · with email · with phone · with address · with company name · no
     email/phone/address · inactive — each with a percentage;
  3. a **Records sharing a contact detail** block giving, for email and for phone, how many
     **records** sit on how many **shared values**, and the **largest group**. 🔴 **This is the
     duplicate problem sized before anyone designs a resolver for it** — write the numbers down;
  4. 🔴 **a "What a record looks like" table of exactly FIVE rows**, captioned *"The first 5 of
     1,9xx"*;
  5. 🔴 **NOWHERE ON THE SCREEN IS THERE A LIST OF ALL THE CUSTOMERS.** Scroll the whole card. If you
     can find a sixth customer row, that is a **FAIL**;
  6. an **amber warning** under the saved-file line stating the file holds names, addresses, phones
     and email.
- **FAIL:** more than five customer rows rendered; a missing completeness line; or any customer
  detail in the console.

---

### CARD 11 — 🔴 THE CUSTOMER FILE IS ON DISK, AND IT IS NOT IN THE REPOSITORY
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #230 · R-23 clause (c) · R-24 clause (c)
SIGNAL: —

**On the same press as CARD 10.**

- **PASS — all four:**
  1. a green line names the saved file: **`qbo-customers-9341455222430707-<timestamp>.json`** —
     note the **`customers`**, distinct from the item file's `items`;
  2. the file is in your **downloads folder** (`~/Downloads` unless you have changed the browser's
     default). Open it: it holds an envelope with `expected_total`, `retrieved_total`, and one entry
     per page carrying Intuit's **verbatim** body;
  3. 🔴 **run `git status --short` in `~/Desktop/trace-platform`. The file MUST NOT appear.** A
     serverless function cannot write to your disk, so this check is the part that could not be made
     structural;
  4. the amber warning from CARD 10 point 6 is present.
- **FAIL:** no file saved (a red line says so — re-run rather than assuming); the file inside the
  repo; or a file named `qbo-items-…` for a customer read.

🔴 **AFTERWARDS: that file is ~1,900 real people belonging to LAWNS.** Keep it out of the repo, off
shared drives, and delete it when the mapping pass is done with it.

---

### CARD 12 — 🔴 HOW FAR BACK DOES THEIR HISTORY GO? SAY THE TWO DATES OUT LOUD
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #231 · the reason this read exists
SIGNAL: `[TRACE:QBO] invoices — read COMPLETE { earliest, latest, months_spanned, undated, … }` — 🔴 **counts and dates only. A NAME, EMAIL, PHONE or ADDRESS in a trace line is a FAIL, and it is the serious kind.**

🔴 **THIS IS THE ANSWER THE WHOLE BUILD EXISTS FOR, AND IT IS THE FIRST THING ON THE SCREEN.** Every
other number on this card is meaningless without it — *"412 Shumard oaks"* is a different fact over
ten years than over eight months.

**As the OWNER**, Settings → Accounting → **Read from QuickBooks** → **Read invoice history**.

- **PASS — all five:**
  1. the green **completeness** line (→ CARD 9), with the two numbers **equal**;
  2. 🔴 a green block headed **HOW FAR BACK THE HISTORY GOES** showing **`earliest → latest`** and
     the number of months. **Write both dates down and say which it is:** does the history start at
     or near **2025-08-23** — the day 1,163 of their 1,936 customers were created in one bulk
     migration — or does it genuinely run further back? **Either answer is fine. Not knowing is not.**
  3. **Invoices by year**, and an **Invoices by month** list covering *every* month in the span
     **including the ones reading 0** — the empty months are the seasonality curve;
  4. if any invoice carried no readable date, an **amber clause** saying how many and that they are
     in none of the months;
  5. a stat row: lines · lines with an item · **lines on item 1 (generic)** · distinct items ·
     **total quantity sold** · distinct customers.
- **FAIL:** no date block; a month list that skips months; a date range that disagrees with what
  QuickBooks itself shows under Sales → Invoices.

🔴 **THEN THE ONE TERRY HAS NEVER BEEN ABLE TO ASK: scroll to `Top items by quantity sold`.** That
column is *how many of each thing left the yard over the span above*. Read the top five out loud.

---

### CARD 13 — 🔴 WHAT WERE THE DISCOUNTS ACTUALLY CALCULATED ON?
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #231 · R-25 clause (a)
SIGNAL: — (the whole card is on screen; no console needed)

🔴 **THIS CARD DECIDES A BUILD, AND IT DECIDES IT FROM LAWNS'S OWN HISTORY RATHER THAN FROM OUR
GUESS.** *Is placement discounted?* was about to be an assumption in code.

**On the same press as CARD 12**, find **What each discount was calculated on**.

- **PASS — all four:**
  1. a row per discount item found (`CD10%`, `CD15%`, `MD10`, `Military Discount`,
     `Military Discount 5`, `Customer Discount`, `FD10`);
  2. for each, **Base = subtotal** vs **Base below** — 🔴 **this is the answer.** *Base = subtotal*
     means the discount covered the whole invoice, placement included. *Base below* means something
     was left out;
  3. 🔴 the **Excluded from the base** column **NAMES the item** that accounts for the gap. If it
     says a placement/installation item, **placement is not discounted in their practice** — write
     down what it says;
  4. the **Bundle lines (DIW / FDIW)** table above it, with **At $0** and **Carrying money** as
     separate columns. If *Carrying money* is anything but 0, say so — the premise that these are
     $0 documentation lines is a claim about their books, and this is where it gets checked.
- **PASS (and REPORT IT):** an **amber box** listing *discount-shaped lines that are not on the named
  list*. That is not a bug — it is the seven-name list reporting its own gaps. **Read out any names
  in it**; they may be discounts nobody remembered.
- **FAIL:** a table with no rows while QuickBooks plainly shows discounted invoices in that span; or
  a `CD10%`-style row appearing in **Top items by quantity sold** (its Qty is a dollar base, not a
  count — if it is up there, the units column is holding dollars).

---

### CARD 14 — 🔴 THE INVOICE FILE IS ON DISK, IT IS NOT IN THE REPO, AND NOBODY'S NAME IS ON THE SCREEN
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #231 · R-23 clause (c) · R-24 clauses (b) and (c) · R-25 clause (b)
SIGNAL: —

**On the same press as CARD 12.**

- **PASS — all five:**
  1. a green line naming **`qbo-invoices-9341455222430707-<timestamp>.json`** — note the
     **`invoices`**, distinct from `items` and `customers`;
  2. an **amber warning** stating the file holds your customers' names, what they bought and what
     they paid. 🔴 **That warning is correct and it matters:** the SCREEN carries no names, but the
     FILE is Intuit's verbatim response and it does;
  3. 🔴 **run `git status --short` in `~/Desktop/trace-platform`. The file MUST NOT appear.** A
     serverless function cannot write to your disk, so this is the part that could not be made
     structural;
  4. 🔴 **scroll the entire results card. There must be NO invoice record anywhere** — no invoice
     number list, no customer names, no addresses, no line-item table of individual sales. Only
     dates, counts, item totals and discount verdicts. **A single customer name on this screen is a
     FAIL**;
  5. open the browser console: `[TRACE:QBO]` lines carry **counts and dates only**.
- **FAIL:** any customer name, address, email or phone on screen or in the console; the file inside
  the repo; a file named `qbo-items-…` or `qbo-customers-…` for an invoice read; or no file at all
  (a red line says so — re-run rather than assuming).

⚠️ **THE VOLUME STOP IS PROBABLY NOT REACHABLE ON LAWNS AND THAT IS FINE.** Above 10,000 invoices the
read refuses before pulling anything and says *"STOPPED BEFORE READING: QuickBooks reports N …"*. If
you ever see that box, **it is the guard working** — report the number, do not retry.

🔴 **AFTERWARDS: that file is LAWNS's complete billing history.** Keep it out of the repo, off shared
drives, and delete it when the mapping pass is done with it.

---

### CARD 15 — 🔴 A $0 NOTE IS A NOTE, NOT A $0 SALE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #237 · the five DescriptionOnly lines
SIGNAL: the declined-netting line shows in QuickBooks with **no item in the PRODUCT/SERVICE column.**
⚠️ **BLOCKED-ON: pass ② (the item mapping).** Until a revenue line can resolve an id, no invoice
reaches QuickBooks at all, so there is nothing to look at. Run this the first time a push lands.

🔴 **WHAT THIS IS ABOUT.** Five lines on this invoice are $0 documentation: netting **declined**,
$0 transport, legacy netting declined, staff transport, and the tax-exemption note. Every one of
them used to book against a revenue item — so **your books recorded a $0 SALE of a service the
customer explicitly REFUSED.** They are now `DescriptionOnly`, which carries no item at all.

✅ **THIS MATCHES YOUR OWN PRACTICE RATHER THAN IMPOSING OURS — LAWNS's history already carries 194
`DescriptionOnly` lines.**

**HOW TO RUN:** complete an order on Test Dave's where the customer **declines netting**, then open
the invoice in QuickBooks.
- **PASS:** the "Protective travel netting — DECLINED by customer (TX TCC Ch.725 waiver signed)"
  line is present, reads $0, and its **PRODUCT/SERVICE column is EMPTY**. The waiver language is
  intact — this line is the legal record and must not be dropped.
- **FAIL:** the line carries an item name · the line is missing entirely · QuickBooks rejects the
  invoice (a 400 mentioning `DescriptionOnly` means the shape is wrong — **report the verbatim
  error body**, it is the artifact that says which field Intuit disliked).

---

### CARD 16 — 🔴 THE DISCOUNT IS QUICKBOOKS' OWN DISCOUNT, AND THE TOTAL IS UNCHANGED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #237 · D-43/D-48 re-represented · tech-debt trail on `discountLine`
SIGNAL: the concession appears as QuickBooks' **Discount**, not as a negative line item.
⚠️ **BLOCKED-ON: pass ② (the item mapping).**

🔴 **THE NUMBER TO WATCH IS THE TOTAL, NOT THE DISCOUNT.** A native discount line carries a
**POSITIVE** amount that QuickBooks SUBTRACTS, where the old shape carried a negative one it added.
Get the construct right and the sign wrong and **the invoice is off by twice the discount** — so the
only assertion that matters is that the QuickBooks total equals what TRACE charged.

✅ **YOUR OWN PRACTICE: LAWNS use the native discount 66 times for $31,985 — three times more than
their discount ITEMS (21).**

**HOW TO RUN:** on Test Dave's, complete (a) a contractor-tier order so a **tier discount** applies,
and (b) an order where you **override a service price downward**. Both use the same construct.
- **PASS:** each concession shows as a discount, the amount matches TRACE's, and **the QuickBooks
  BALANCE DUE equals the TRACE total to the penny.**
- 🔴 **THE ONE UNMEASURED RISK, AND IT IS ON THIS CARD BECAUSE ONLY A LIVE PUSH CAN SETTLE IT:** an
  order with **BOTH** a tier discount and a service override emits **TWO** discount lines.
  **QuickBooks documents `DiscountLine` as transaction-level and its own UI offers exactly one.**
  Whether Intuit accepts two is **not known and cannot be measured from the repo.** Run that
  combination deliberately. If it 400s, **report the verbatim error body** — the fix is to combine
  them, and we should not guess at that before it is proven necessary.
- **FAIL:** the total disagrees with TRACE by any amount · a discount appears as a line ITEM · the
  services get discounted too (that would mean `PercentBased` came back).

---

### CARD 17 — 🔴 SALES TAX IS NOT REVENUE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #237 · the `:580` literal — arguably the worst of the twelve
SIGNAL: the invoice has **no "Sales Tax" line item**; tax shows in QuickBooks' own tax field.
⚠️ **BLOCKED-ON: pass ② (the item mapping).**

🔴 **WHY THIS ONE IS WORSE THAN THE TREE.** Tax used to push as a revenue line against the same
generic item as everything else, which **books tax as INCOME.** The goods line misfiled revenue you
really earned; this one **invented revenue you never earned** — money you are holding for the state,
recorded as yours. Your P&L already carries $85,281 of sales tax.

**HOW TO RUN:** complete a taxed order on Test Dave's and open the invoice.
- **PASS:** there is **no line item named "Sales Tax"**; the tax appears in QuickBooks' tax field;
  the BALANCE DUE matches TRACE; and — the real check — **your Income accounts do not move by the
  tax amount.**
- Then a **tax-exempt** order: a $0 `Tax exempt — <reason> · cert <ref>` note is present, and there
  is **no tax figure at all** (not a zero).
- 🔴 **THE UNMEASURED HALF, STATED PLAINLY:** we send `TxnTaxDetail.TotalTax` and **no `TaxRateRef`**
  — we hold no tax-rate id and this build does not fabricate ids. **If the company runs Automated
  Sales Tax, QuickBooks may RECOMPUTE the tax rather than accept our figure.** So compare the two
  numbers: if QuickBooks' tax differs from TRACE's, that is not a bug in this card, it is the answer
  to a question we could not ask from here — **report both numbers.**
- **FAIL:** a "Sales Tax" line item still exists · the tax lands in an income account · a tax-exempt
  order shows a $0.00 tax figure instead of no tax.

---

### CARD 18 — ⚠️ THE HOLD IS STILL ON, AND IT COMES OFF ONLY AFTER YOU HAVE WATCHED ONE LAND
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #237 · [[R-23]]'s restraint applied to the WRITE side
SIGNAL: `/api/qbo/status` reports `push_held: true` for LAWNS.

🔴 **THE HOLD'S ORIGINAL CAUSE IS GONE AND THE HOLD STAYS ON ANYWAY — SAY WHY OUT LOUD, BECAUSE
"the reason expired" is exactly how a safety gets removed by accident.** It was put on because of
the twelve literals. Those are fixed. **But three constructs on this invoice are NEW and none has
ever been seen by Intuit** — the native discount, the `DescriptionOnly` notes, and `TxnTaxDetail` —
and **a malformed line 400s the WHOLE invoice.**

**HOW TO RUN:** hit `/api/qbo/status` and confirm `push_held: true` for the LAWNS business id.
⚠️ An env change needs a **Vercel redeploy** to take effect, and this endpoint is the only way to
confirm it without completing a real order against Terry's books.

- **PASS:** LAWNS is held. **FAIL:** LAWNS is not held.
- 🔴 **THE HOLD COMES OFF WHEN DAVID HAS WATCHED ONE INVOICE LAND CORRECTLY IN REAL BOOKS** — not
  when a build says it should work, and not when CARDS 15–17 pass on Test Dave's.


---

### CARD 19 — 🔴 THE INSTALLATION LINE IS GONE, AND NOTHING PRINTS IN ITS PLACE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #239 · the removed `transport_method === 'install'` branch
SIGNAL: a legacy install order's invoice carries **no line mentioning installation at all.**
⚠️ **BLOCKED-ON: pass ② (the item mapping)**, exactly like CARDS 15–17 — until a revenue line can
resolve an id, no invoice reaches QuickBooks, so there is nothing to look at. Run it with those.

🔴 **WHAT THIS IS ABOUT, AND WHY IT IS A CARD RATHER THAN JUST A DELETION.** The push used to build
a REVENUE line — `Installation service · N plant(s)` — from a hardcoded `0`, backed by **no row at
all**. It was born with a real source (`plants.install_price`, $225) and lost it on 2026-06-13 when
that column was dropped; it then sat backed by nothing for 78 days. It is now **removed**, not
re-shaped.

✅ **YOUR OWN BOOKS ARE WHY.** Across all **1,469** captured invoices / 5,371 lines the shape it
emitted appears **ZERO** times. LAWNS bill installation two ways and **neither is a $0 line**: baked
into the plant's own line (`Live Oak - 200 gallon (Install & Warranty)` — **624 invoices**) or as a
real priced item, **`137 · Installation`**, $200–$4,500 (**4 invoices, 5 lines**). We were not
preserving a path you use; we were preserving one you have never used.

**HOW TO RUN:** complete an order on **Test Dave's, never LAWNS** where the business delivers and
plants, then open the invoice in QuickBooks.
- **PASS:** there is **no `Installation service` line**, and no $0 line with an empty description
  where one used to be. Delivery/placement still appear as their own service lines with real money
  on them, and the invoice total is unchanged from what TRACE charged.
- **FAIL:** an installation line appears (the branch came back) · a stray $0 line appears · **the
  total changed** — that last one would mean the removed line had been carrying money, which the
  measurement says it never did; **report the invoice and stop.**

⚠️ **A LEGACY `install` ORDER NOW PRINTS THE `staff transport` NOTE INSTEAD.** That is deliberate
and it is the weaker of two true claims — staff did carry it. The order's own `transport_method`
still records that it was an install; a $0 invoice line was never where that fact lived.

✅ **ALREADY PROVEN IN CODE, WHICH IS WHY THIS CARD IS ABOUT THE BOOKS AND NOT THE LOGIC:** the
payload suite asserts an install order emits no installation line, takes the staff-transport note,
and carries no $0 revenue line anywhere (E5/E5b/E5c) — and the guard was **mutation-tested**: with
the branch restored, 2 of 2 assertions fail.
