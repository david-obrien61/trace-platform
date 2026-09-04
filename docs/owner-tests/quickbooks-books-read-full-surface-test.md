# QUICKBOOKS BOOKS READ — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance. Match it to `git log --oneline origin/main -1` — **not to a SHA written in this
> file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the
> stamp. *(GATE 0 · OP-15.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for the books-read owner-tests.** It is STANDING, not
> dated — **run it after any change to `QboBooksReader`, `booksFindings`, `booksReport`, or the
> `api/qbo` read routes.** A per-build proof is a FILTER on this board (`COVERS: #NNN`), never a
> second document (STD-011).

**Purpose:** this is the surface an owner presses at their own desk — one button, a wait, their own
records, and a document they keep. **Everything on it is read by a NON-TECHNICAL OWNER**, so a card
that needs a console has not tested what this surface is for.

**🔴 WHY THIS BOARD EXISTS.** The read half of QuickBooks shipped across four builds and had **no
owner test at all** until 2026-09-03. It is also the surface where a wrong number is most expensive:
it is shown to a business owner and their accountant, before they have bought anything. One figure
on it — *"$1,607,416 less than your own price list"*, **52% of their entire revenue** — was
withdrawn on 2026-09-03 for being two findings wearing one sentence.

⚠️ **NOTHING ON THIS SURFACE IMPORTS ANYTHING.** No card below should find a control that writes.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Trustworthy. |
| `STATUS: owed` | 🟡 A test is written but has not been run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 No test written yet, and the reason is stated. An honest hole. |
| `DEVICE: phone` | Must be provable **without a console**. |

**Thunder never sets `covered`.** Only David's live run does, with a date.

---

### CARD 1 — 🔴 ONE BUTTON, AND THE WAIT IS ANNOUNCED BEFORE ANYTHING HAPPENS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #268 · `ui-control-standards.md` §7 W1 · W2
SIGNAL: the sequencer emits three walks in order; the panel appears on the FIRST click, before any network response.

**As the OWNER**, open **Settings → Accounting** with QuickBooks connected and press
**"Read my QuickBooks data"**. Watch the top of the panel **in the first second**.

- **PASS:** *"This will take a few minutes…"* appears **immediately on click** — before any count,
  before the first walk returns.
- **FAIL (W1):** the message appears only after the first walk lands, so the longest silence — the
  one at the very front — is still unexplained. **That silence is the entire defect.**
- **FAIL (W2):** any percentage bar or countdown appears. There must be neither.

🔴 **The point of the range rather than a number:** if we promise twenty seconds and take ninety we
have lied; if we say a few minutes and take forty seconds we are simply faster than expected.

---

### CARD 2 — 🔴 EACH WALK REPORTS A REAL COUNT AND SAYS IT IS WHOLE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #268 · §7 W3 · R-24 clause (a)
SIGNAL: `[TRACE:QBO] items — read COMPLETE { expected, retrieved }` — one per walk, three in all.

Keep watching through the whole read.

- **PASS:** three lines appear one after another, each naming a **real number** and saying it is
  all of them — e.g. **"Read 685 products & services — that is all of them."** The counts should be
  roughly **685 products · 1,936 customers · 1,469 invoices** for LAWNS.
- **FAIL:** a count that is a round number, a placeholder, or absent; or a walk that finishes with
  no line at all.

⚠️ **You should NOT see "1,000 of 1,927"-style progress inside a walk, and its absence is correct.**
The server counts, pages and returns in one request, so a running count would have to be produced by
driving the paging from the browser — which moves the completeness refusal off the server. **A
progress number is not worth relocating a refusal** (§7 W4).

---

### CARD 3 — ⚠️ A FAILED WALK STOPS THE SEQUENCE AND SAYS WHICH ONE
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: #268 · §7 W5
SIGNAL: the narration's last line turns red and names the walk.

**Reason it is `needs-test` rather than `owed`:** provoking a real mid-sequence failure against a
live customer's QuickBooks needs either a revoked token or a forced network failure, and **neither
should be done to LAWNS's live company to satisfy a checkbox.** The honest options are to run it on
Test Dave's with the token deliberately expired, or to leave this as a known hole. **Recorded rather
than quietly assumed to work.**

- **PASS (when run):** the sequence halts, the line reads *"Stopped while reading your …"*, and the
  reads after it were **not attempted** — the panel says so.
- **FAIL:** the narration goes quiet (indistinguishable from still working), or a later success
  paints over the earlier failure.

---

### CARD 4 — 🔴 HER OWN INVOICES ARE ON THE PLATFORM GRID — AND NO BUYER NAME IS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · [[R-77]] · [[R-24]] clause (b) · G3 · G9
SIGNAL: none needed — this is read with the eyes.
🖱 NEEDS INTERACTION (scroll right, and read two rows). 📄 The static half — the caption and the
absence sentence — shares one print with CARDS 11, 12 and 16.

🔴 **THIS CARD WAS REWRITTEN AT #275 BECAUSE THE SURFACE CHANGED UNDER IT** (OP-14 cl.3). It
previously proved a hand-written three-column table and its criteria included *"Showing the 100
most recent of 1,469 invoices"* — a cap that no longer exists. **That wording is preserved here
rather than deleted, because it is what the card used to assert and a reader needs to know the
proof was replaced, not merely re-dated.** It was never `covered`, so no green check is being
withdrawn.

**PREREQUISITE:** a completed read (CARD 2 passed) — the block does not exist before one.

1. After the read finishes, scroll to **"Your invoices"**.
2. Read the caption line above the grid.
3. Look at the invoice-number column, then **scroll the grid sideways**.
4. Read two rows against a printed invoice if you have one to hand.

- **PASS:** a bounded, scrollable grid — it scrolls **inside its own box**, and the page behind it
  does not scroll sideways.
- **PASS:** the caption reads **"Showing all 1,480 invoices, newest first."** (the number is
  whatever the read returned).
- **PASS:** the caption also says **"We do not list your customers' details here"** and points at
  the downloaded file.
- **PASS (G3):** the **invoice-number column stays put** while the rest scrolls sideways. You never
  lose which row you are on.
- **PASS (G9):** newest first **by the date on the INVOICE**, not by when we read it. Check two rows.
- 🔴 **FAIL — THE ONE THAT MATTERS: any customer name, email, phone or address appears anywhere
  in this grid or in an opened row.** The ruling: *"an owner may see her own records that are not
  about a person: items in full, invoices by number, date and total, no buyer name."*
- **FAIL:** an invoice with no date renders blank or as today. It must read **"No date recorded"**.
- **FAIL:** a scrolling column slides *underneath* the pinned invoice-number column.

⚠️ **WHAT THIS CARD CANNOT PROVE:** that no name reaches the grid *in general*. It proves it for
the rows you looked at. The structural guarantee is that `QboInvoiceRow` has no name field at all —
which no amount of looking can confirm, and no amount of looking can break either.

---

### CARD 5 — 🔴 THE $1.6M FIGURE IS GONE, AND WHAT REPLACED IT NAMES ITS OWN FLOOR
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #268 · the withdrawn `sold-below-price-card` rule
SIGNAL: mutants M19 · M20 · M21 · M22 in `scripts/measure-books-findings-mutants.mjs`.

Read the **"Worth money"** section of the review panel.

- 🔴 **FAIL — STOP AND REPORT:** any sentence claiming roughly **$1.6 million** below "your own
  price list". That figure was 52% of LAWNS's entire revenue and it is withdrawn.
- **PASS:** a grey, unmeasured row saying we **cannot** check against a printed price list because
  we were never given it.
- **PASS:** a separate measured row that says **"below the price recorded on that product in
  QuickBooks"** — naming the floor it actually used — with roughly **$724,000** and the phrase
  **"counted once per sale rather than per item"**.
- **PASS:** it also reports what people typically paid as a percentage of the recorded price
  (**about 87%** for LAWNS). That is the number that survives either framing.

---

### CARD 6 — 🔴 THE RECEIVABLES FINDING IS REAL, WHERE IT USED TO SAY IT COULD NOT BE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #268 · mutants M23 · M24 · M25 · M26
SIGNAL: none needed.

Still in **"Worth money"**.

- **PASS:** a measured row reading approximately **"$30,736 is still owed to you across 14
  invoices, and $11,158 of that — 6 invoices — was more than 30 days past due… The oldest was due
  on 2026-04-22."**
- 🔴 **FAIL:** the old grey row saying *"the invoice read does not include how much of each invoice
  is still unpaid, or when it was due."* **That sentence was false** — those fields were on 1,469 of
  1,469 invoices and our own parser discarded them. A cannot-compute that is false about our own
  read tells an owner their books lack something their books carry.

---

### CARD 7 — 🔴 THE REPORT OPENS, IT CAN BE SAVED, AND IT CARRIES ONE DATE: THE READ
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · #257 · David's ruling, 2026-09-04
📄 PRINT-PROVABLE — one press of Visualize proves this card AND CARD 8.

🔴 **REWRITTEN AT #275: the date line changed.** The report used to head itself *"Generated
<today>"* — the day somebody pressed a button. David: *"'Generated today' is the day the button was
pressed, not the day her books were read. One number and when it was read; that is the only date on
the page."* The rest of this card's #257 criteria are unchanged and still required.

1. After a read, press **"Visualize — open the first-look report"**.
2. Read the line directly under the title.
3. Press **Ctrl/Cmd-P** and choose *Save as PDF*.

- **PASS:** a new window opens carrying a printable document.
- 🔴 **PASS:** the line under the title reads **"Read from your QuickBooks company on
  &lt;date&gt;"** — and that date is **when the books were read**, not today. On a live read they
  are the same day; **the way to actually prove this is to load a saved read from an earlier day
  (CARD 15) and confirm the report still shows THAT day.**
- **PASS:** it says **"Generated"** nowhere.
- 🔴 **PASS:** search the document — **every date on it is that same read date.** One number, one
  date, and no second one.
- **PASS:** it states *"This report reflects no corrections"* rather than staying silent — an absent
  line reads as *"none were needed"*.
- **PASS:** each of the three reads is named, including any that was **not run**.
- **PASS:** it asks for nothing. No Accept, no Ingest, no next step.
- **FAIL:** a pop-up blocker stops it and the screen says nothing. It must name the blocker.
- **FAIL:** any read that was not run is simply missing from the document.

⚠️ **WHAT THIS CARD CANNOT PROVE ON A LIVE READ:** that the date is the read's and not the clock's —
on a live pull they are the same day and the two are indistinguishable. **CARD 15 is where that is
actually settled.**

---

### CARD 8 — 🔴 THE DRIFT RECORD IS ON THE SCREEN AND **NOT** IN THE REPORT
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · David's ruling, 2026-09-04 · supersedes the #268 form of this card
📄 PRINT-PROVABLE — shares one print with CARD 7 (open the report once, prove both).

🔴 **THIS CARD IS INVERTED FROM ITS #268 FORM AND THAT IS THE POINT.** It used to read: *"PASS:
where a re-measurement exists, a green 're-measured 3 Sep: …' sits beside it — including where it
CONFIRMS the original"*, and it applied to **both the screen and the report**. That was right about
the screen and wrong about the report. David: *"Two numbers for one fact, disagreeing, on the page
I hand Terry. That is my error. I asked for the measured value beside the quoted one so drift was
visible. THAT WAS FOR MY RECORD, NOT HER REPORT."* The prior criteria are preserved above rather
than deleted. It was never `covered`.

**ON THE SCREEN — unchanged, and still required:**

1. On the review panel, find any finding carrying an amber *"29 Aug analysis said: …"*.

- **PASS:** where a re-measurement exists, a green **"re-measured 3 Sep: …"** sits beside it —
  **including where it CONFIRMS the original.** *"We checked and it held"* is a result.
- **FAIL:** the 29 August figure has been silently replaced by the corrected one.

**IN THE REPORT — the new half:**

2. Press **Visualize**. In the report window press **Ctrl/Cmd-F**.
3. Search for: `Re-measured` · `29 Aug` · `not derivable` · `not previously computed` ·
   `second definition`.

- 🔴 **PASS: ZERO hits for every one of those five.**
- 🔴 **FAIL:** any hit. Each is either a second disagreeing number for one fact, or a working note
  addressed to us, in a document a customer keeps.
- **FAIL:** a finding shows only the re-measured value with no sign there was ever a quoted one —
  that is the *screen's* failure mode and it must not have been "fixed" by overwriting.

⚠️ **WHY THE TWO READS DISAGREE AT ALL, so nobody re-derives it:** the live read is 1,480 invoices
and 1,946 customers; the 29 August capture was 1,469 and 1,936. **Her books grew.** That is time
passing, not drift — and it is the other half of why a report carrying both numbers misleads.

---

### CARD 9 — 🔴 NOTHING ON THIS SURFACE IMPORTS ANYTHING
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #268 · the no-ingest scope
SIGNAL: row counts before and after are identical.

Before pressing anything, note the row counts for `business_inventory`, `customers` and `orders`.
Run the whole flow — read, scroll, open the report. Re-count.

- **PASS:** every count is unchanged, and the panel states **"nothing is saved here"**.
- 🔴 **FAIL / FLAG:** you find an import or ingest control **inside the books-read panel**.

⚠️ **KNOWN AND FLAGGED, NOT A FAILURE OF THIS CARD:** the **Delivery ingest** and **Order ingest**
panels are separate components sitting immediately BELOW this one on the same Accounting card, and
they are gated on `deliveries:create` / `orders:create` — **permissions a manager holds.** So on the
Accounting page as a whole, a manager CAN reach a write control. That is a scope decision for David,
not something this build changed. See ledger #268 flag (b).

---

## 🔴 BEFORE THURSDAY — WHICH CARDS DAVID RUNS ALONE, AND WHICH NEED LAUREN

David has **one pass** at the demo, so this board is split by **who has to be standing there**,
not by card order.

### ✅ RUN ALONE, BEFORE THE DEMO — on Test Dave's, loading LAWNS's saved JSON (R-69's harness)
**CARDS 1 · 2 · 4 · 5 · 6 · 7 · 8.** All seven are readable from the file harness: *a file replaces
a CONNECTION, not a CODE PATH*, so these are the same screens in the same order Lauren will see.
🔴 **These are the ones that catch a wrong number before a customer reads it** — especially **CARD 5**
(the ~$1.6M sentence must be GONE) and **CARD 6** (receivables must be measured, not grey).
⚠️ **Run these first and run them all.** Every one is a defect David can still fix on Wednesday.

### 🔴 NEEDS LAUREN AT THE SCREEN — and cannot be rehearsed away
**CARD 1's timing half** and **CARD 2's counts** are read ALONE for correctness, but their real
test is **live, on LAWNS, with Lauren pressing the button** — R-69: *"David does not run the import.
Lauren runs it, on LAWNS, live, while he stands behind her. That IS the test — can a customer do
this."* The file harness cannot tell you whether **three real walks over Intuit's connection**
land inside *"a few minutes"*. **Nothing else on this board depends on her.**

### ⚠️ CANNOT BE RUN BEFORE THURSDAY, AND SHOULD NOT BE
**CARD 3** (`needs-test`) — a mid-sequence failure needs a deliberately expired token. **Do not
expire a token against LAWNS's live company for a checkbox.**

**CARD 9** (nothing is written) — the row-count half runs alone on Test Dave's. ⚠️ **Its manager
half is NEW and now has a card of its own (CARD 10) — that one needs a second sign-in, not Lauren.**

### 📋 THE ONE-LINE ANSWER
**Seven cards alone, on the file, before Wednesday night. One card (10) needs a manager login.
Two things need Lauren and only two: whether "a few minutes" is true over her connection, and
whether she can do it without asking David anything** — which is R-69's real acceptance bar:
*"every question Lauren asks David is written down, and every one is a defect in this build."*

---

### CARD 10 — 🔴 A MANAGER'S ACCOUNTING PAGE HAS NO IMPORT TOOLS ON IT AT ALL
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · [[R-80]] · supersedes the #271 form of this card
🔧 NEEDS SETUP — a second sign-in as a MANAGER. Shares that setup with CARD 14.

🔴 **THIS CARD'S PASS CRITERIA ARE REVERSED FROM ITS #271 FORM.** It used to require that both
panels *"render the sentence 'Bringing records in from QuickBooks is done by the account owner' and
carry no button at all — an explained absence, not a greyed control"*, and that the previews still
worked for her. David, 2026-09-04: *"Gating them owner-only was the right fix for the wrong problem
— I answered 'she can press it' instead of 'why is it on her screen.'"* The old criteria are
preserved here; the card was never `covered`.

⚠️ **AND THE OLD CARD ASSERTED SOMETHING THAT WAS NOT TRUE OF THE CODE IT DESCRIBED.** It required
*"the delivery and order PREVIEWS still work"* for a manager. They never did — the panel returned
before rendering any button. A comment in the source claimed the same thing. If you had run this
card at #271 it would have **failed on a criterion that was never built**, which is worth knowing
about how the card got written.

1. **Sign in as a MANAGER** (not the owner).
2. Open **Settings → Accounting**.
3. Scroll the whole card, top to bottom.

- 🔴 **PASS:** **"Scheduled deliveries from QuickBooks"** and **"Past orders from QuickBooks"** are
  **not on the page at all** — no heading, no sentence, no button, nothing to scroll past.
- 🔴 **PASS:** the **"TEST FACILITY"** box is **not on the page either** (CARD 14 covers it).
- **PASS:** **"Read my QuickBooks data" is still there and still works for her.** That is deliberate
  and it is the whole point of the surface — *"reading your own books"* is a manager's job.
- **PASS:** the review panel and the report still work for her after a read.
- 🔴 **FAIL:** any import panel, heading or explanatory sentence about importing is visible.
- 🔴 **FAIL:** the read button is missing or refuses. That would be a different, worse defect —
  this build took nothing away from her.

⚠️ **THE SERVER IS STILL THE GATE AND MUST BE PROVEN SEPARATELY.** Hiding a button has never
stopped anybody. With a manager's token, `POST /api/qbo/orders/ingest` and
`/api/qbo/deliveries/ingest` must still return **403 `OWNER_ONLY`**. **This card cannot prove
that** — it needs a console, and this board's cards must be provable without one. It is asserted
by the two ingest handlers calling `refuseUnlessOwner` before anything else, and it is unchanged
by this build.

⚠️ **STILL OPEN AND NOT FIXED HERE:** a manager also holds `settings:update`, so **Reconnect /
Connect QuickBooks is manager-reachable** — she can start an OAuth flow and change which company
is connected. Reported at #271, still open. David's call.

⚠️ **AND THE WIDER AUDIT #275 WAS ASKED FOR IS IN THE LEDGER ROW, NOT ON THIS CARD:** everything
else a manager reaches behind `settings:read`. It is a list, not a test.

---


### CARD 11 — 🔴 THE SEARCH FINDS AN INVOICE FROM YEARS AGO
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · [[R-75]] · G6
🖱 NEEDS INTERACTION (typing). 📄 Shares one print with CARDS 4, 12 and 16 for the static half.

🔴 **THIS IS THE DEFECT DAVID SAID HE WOULD NEVER SEE COMING AS A USER, AND IT IS WHY THIS CARD IS
WORDED AROUND AN OLD INVOICE RATHER THAN A RECENT ONE.** Until #275 the grid was handed the newest
**100** rows of **1,480**. Search filters what the grid holds — so asking for anything older than
the newest hundred returned **nothing found, for an invoice that exists**, and there was no error,
no empty table and nothing red. The page looked completely normal.

**PREREQUISITE:** a completed read. **You need one real invoice number from more than a year ago** —
get it from QuickBooks or from a paper copy **before you start**, not from this screen.

1. Read the grey text inside the **search box** before typing.
2. Type that old invoice number into the search box.
3. Clear it. Type a **product name** you sell — *Live Oak*, say.

- 🔴 **PASS: the old invoice appears.** One row, the number you typed.
- 🔴 **PASS:** the search box's grey text reads **"Searching all 1,480 invoices."** — it names the
  number and it says **all**.
- **PASS:** searching a product name returns every invoice carrying that item — the item names on
  the lines are searchable, which is what recognition actually runs on.
- 🔴 **FAIL — THE WHOLE POINT: the old invoice is not found.** Do not accept *"maybe it is not in
  QuickBooks"* — you fetched the number from QuickBooks in step 0. **A confident empty result is
  the failure.**
- 🔴 **FAIL:** the search box says *"Searching the 100 most recent of 1,480"* (or any other slice).
  That sentence is **correct behaviour for a capped grid** — but at 1,480 invoices nothing should be
  capped, so seeing it here means the ceiling was lowered or the read is far bigger than expected.
  **Report the numbers rather than passing or failing.**
- **FAIL:** typing a customer's NAME finds rows. Names are not searchable and are not on the row.

⚠️ **WHAT THIS CARD CANNOT PROVE:** the capped case itself. LAWNS's books are under the ceiling, so
the honest label above it is unreachable from this screen. **That is proven mechanically instead** —
`invoiceGrid.test.ts` §B builds 1,480 rows against a ceiling of 100, asks for a row that fell off,
and asserts both the empty result and the sentence that must accompany it; and
`measure-invoice-grid-mutants.mjs` **G1** restores the shipped 100-row cap and must be caught.
**This is a case where the machine can prove something the owner cannot, and the reverse is not
true — so both exist.**

---

### CARD 12 — 🔴 SORT BY TOTAL, AND THE BIGGEST INVOICE IS ACTUALLY AT THE TOP
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · G4
🖱 NEEDS INTERACTION (two header clicks). 📄 Shares a print with CARDS 4, 11 and 16.

🔴 **THE FAILURE HERE LOOKS COMPLETELY NORMAL.** Sorted as text rather than as a number,
**`$1,283.88` sits BELOW `$920.13`** — because `1` sorts before `9`. The column is sorted, the
arrow points the right way, the rows moved. Nothing looks wrong, and the most expensive invoice is
nowhere near the top.

1. Click the **Total** header once, then again, so the arrow points **down** (largest first).
2. Read the **first three** amounts.
3. Do the same on **Still owed**, then on **Lines**.

- 🔴 **PASS:** the largest amount is first, and each row below is smaller. **Specifically check a
  four-figure amount against a three-figure one** — that is the pair that exposes a text sort.
- **PASS:** the same holds for **Still owed** and for **Lines**.
- **PASS:** rows whose total reads *"Not recorded"* group at one end and do not scatter through the
  list.
- 🔴 **FAIL:** any three-figure amount above a four-figure one. That is a text sort, and every
  money column on this grid is then untrustworthy.
- **FAIL:** sorting by **Date** puts an older invoice above a newer one, or puts *"No date recorded"*
  rows at the TOP under newest-first.

---

### CARD 13 — 🔴 RED IS ONLY WHAT SHE CAN ACT ON, AND EVERY CELL SAYS SOMETHING
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · David's ruling, 2026-09-04 · `ui-control-standards.md` E7 · §5 cl.4 · G8
🖱 NEEDS INTERACTION (sort one column, read cells).

**PREREQUISITE:** a completed read. LAWNS has **22 reused invoice numbers across 44 invoices**
(measured 29 Aug), so red rows should exist. If none do, say so — that is a finding either way.

1. Click the **"Needs a look"** header to bring flagged rows to the top.
2. Read the banner above the grid.
3. Read the cells in that column — **the red ones and the ones that are not**.
4. **Try to click a "Needs a look" cell.**

- **PASS:** red appears on **reused invoice numbers**, on **one customer billed twice on the same
  day**, and on **records we could not read**. Nothing else is red.
- 🔴 **PASS:** an unflagged row's cell reads **"Nothing found"** — **words, not a blank and not a
  dash.** A blank cell here would read as *"not checked"* beside rows that were.
- 🔴 **PASS:** each red cell says **which** of the three applies — *"Invoice number used twice"*,
  not just red. The banner carries the shared fact; the cell carries what makes **this** row
  different.
- 🔴 **PASS (G8/E7):** clicking a cell in that column **does nothing and the cursor does not change
  to a pointer.** It is a read-only mark, and a mark that looks like a control is a dead affordance.
- **FAIL:** a large invoice, an old invoice, or an invoice with no delivery date is red. All three
  are true and none is something she can act on **here**; red spent on them is red she stops reading.
- **FAIL:** a repeat customer is red simply for being a repeat customer. Twice **on one day** is the
  flag; twice in a year is a good outcome.
- **FAIL:** both halves of a duplicate pair are not red. Marking one makes the other look correct.

⚠️ **WHAT THIS CARD CANNOT PROVE:** that a duplicate hidden above the display ceiling is still
counted in the banner. LAWNS is not capped, so it cannot arise. `invoiceGrid.test.ts` §D proves it
with a ceiling of 1 and a twin on either side.

---

### CARD 14 — 🔴 THE TEST FACILITY IS NOT ON LAUREN'S SCREEN
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · David's ruling, 2026-09-04
🔧 NEEDS SETUP — a MANAGER sign-in. **Shares that sign-in with CARD 10 — do both in one session.**

**As the MANAGER**, on **Settings → Accounting**:

- 🔴 **PASS:** there is **no "TEST FACILITY" box anywhere on the page** — no file input, no dashed
  panel, no sentence about loading a saved read.
- **PASS:** *"Read my QuickBooks data"* is still there and still works.

**Then sign back in as the OWNER:**

- **PASS:** the TEST FACILITY box **is** there, below the read buttons.
- 🔴 **PASS:** it is **grey/slate**, not amber. Compare it directly against the **test-mode banner**
  higher up the same card — **the two must not look like the same kind of thing.** One is a warning
  about state (*your writes are not reaching QuickBooks*); the other is a tool.
- **PASS:** the single green **"Read my QuickBooks data"** button is the most prominent thing on
  the card. If your eye goes to the file box first, that is a **FAIL** even if every colour is
  technically as described.

⚠️ **THE ORIGINAL DEFECT, RECORDED:** the facility and the test-mode banner used byte-identical
amber (`#fffbeb` / `#92400e`). David called it *"the red is wrong on it"*; the colour was amber
rather than red, and being the **same** amber as a state-warning is worse than being the wrong
colour on its own.

---

### CARD 15 — 🔴 A SAVED READ SHOWS THE INVOICES — THE ONE THAT WAS BROKEN
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · [[R-69]]
🔧 NEEDS SETUP — you need a saved `qbo-Invoice-*.json` from a previous read. **This card is the
reason the rehearsal path exists; run it before any rehearsal you intend to trust.**

🔴 **WHAT WAS BROKEN, SO THE PASS IS UNAMBIGUOUS.** Loading a saved invoice read showed **no invoice
table at all**, and **13 of the 16 findings** — every rule that needs invoices, which is every money
finding — reported *"we could not work this out"* over a file that contained every invoice they
needed. The screen looked calm, honest and complete. One field was being dropped between the file
and the screen.

1. **As the OWNER**, press **"Read my QuickBooks data"** once and let it finish. Note the three
   files that download.
2. **Reload the page** so nothing is left in memory.
3. In **TEST FACILITY**, choose the saved **`qbo-Invoice-…json`**.

- 🔴 **PASS: "Your invoices" appears, with rows in it.** This is the whole card.
- 🔴 **PASS:** the review panel reports roughly the **same number of measured checks** as the live
  read did — not three of sixteen.
- **PASS:** an amber banner says **"Showing a SAVED read loaded from a file — not a live pull."**
- **PASS:** the green line names the file and says **"QuickBooks was not contacted."**
- 🔴 **PASS:** press **Visualize** — the report's date line shows the day the **file was read**, not
  today. **This is the only way to actually prove CARD 7's date rule**, because on a live pull the
  two dates are the same day.
- 🔴 **FAIL:** no invoice table, or a review panel where the money findings all say *"could not
  work this out"*. That is the exact defect, returned.
- **FAIL:** the screen is indistinguishable from a live pull. A rehearsal read must announce itself.

---

### CARD 16 — 🔴 BEFORE THE FIRST READ, THE PAGE SAYS NOTHING ABOUT HER BUSINESS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · David's ruling, 2026-09-04
📄 PRINT-PROVABLE — a single screenshot of the untouched page proves the whole card.

🔴 **WHAT WAS THERE BEFORE #275, MEASURED:** the findings panel rendered **16 rules, 0 measured, all
16 quoting a figure from the 29 August analysis** — before anybody pressed anything. So the page
opened by telling Lauren *"504 lines carrying $614,053"* and *"881 of 1,469"* about her own
business, under sixteen grey rows saying *"not checked"*.

1. Open **Settings → Accounting** in a **fresh tab**. Press nothing.
2. Read the whole card, top to bottom.
3. Press **Ctrl/Cmd-F** and search for `$` and for `1,469`.

- 🔴 **PASS:** there is **no findings section at all.** No *"What we found in your books"*, no grey
  *"not checked"* rows, no *"could not work out"* section.
- 🔴 **PASS:** **zero hits** for a dollar figure about her business, and zero for `1,469`.
- **PASS:** what IS there: the heading, one sentence saying what the button will do, and the button.
- **PASS:** the **Visualize** button is absent too — a report over nothing is a document full of
  *"not read"*.
- **FAIL:** any figure about her business appears before she has pressed anything.
- **FAIL:** a "0 of 16 checks could be run" line. That is an answer to a question nobody asked.

⚠️ **AND THE OPPOSITE MUST STILL HOLD — CHECK IT IN THE SAME SITTING.** Press the button, let it
finish, and confirm the **unmeasured rows come BACK**, in grey, saying why. Hiding them *after* a
read would be the real dishonesty: a row the reader cannot see is a row the reader assumes passed.
**Before a read there are no outcomes; after one, every outcome is shown.**

---

### CARD 17 — ⚠️ OPEN A ROW AND SEE WHAT WAS ON THE INVOICE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · [[R-77]]
🖱 NEEDS INTERACTION (open a row).

1. In the invoice grid, find the **expand toggle at the far right of a row** and click it.
2. Read the drawer.

- **PASS:** a small table of the invoice's lines — **what · qty · each · amount**.
- **PASS:** it opens **instantly**. No spinner, no second load. The lines were already in hand.
- **PASS:** a line with no item shows what it is — *"DiscountLineDetail"*, *"SubTotalLineDetail"* —
  rather than a blank.
- **PASS:** a line with no unit price reads **"Not recorded"**, never `$0.00`. *They gave it away*
  and *we do not know* are different answers.
- 🔴 **FAIL:** any customer name or address in the drawer.
- **FAIL:** an empty drawer with no explanation on an invoice that has no lines. It must say so.

🔴 **KNOWN AND DELIBERATELY NOT FIXED HERE — the toggle is on the RIGHT, and the filed standard says
it should be on the LEFT with the whole row clickable.** The standard records this about itself:
*"`DataSheet.tsx` renders the expand toggle TRAILING and the row is not a click target, so both
halves of G10 are unmet on both consumers."* Fixing it changes the shared engine for **all eight**
grids — doc, then widget, then surfaces — and doing it inside a surface build is exactly the order
that rule forbids. **So: a right-hand toggle is a PASS on this card today.** When G10 lands, this
card flips to `owed` and gains a left-toggle and click-the-row step.

---

### CARD 18 — ⚠️ NOTHING WAS WRITTEN, PROVEN BY COUNTING
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: #275 · supplements CARD 9
🔧 NEEDS SETUP — a database console. **Marked `needs-test` for that reason and no other.**

🔴 **WHY IT IS `needs-test` RATHER THAN WRITTEN AS A PASS/FAIL:** every other card on this board must
be provable **without a console**, because this surface is read by a non-technical owner. This one
cannot be. Recording the hole is the honest move; pretending CARD 9 covers it is not — CARD 9 proves
**no control writes**, which is a different claim from **nothing was written**.

**What it would be, when someone runs it:** before pressing *"Read my QuickBooks data"*, record
`select count(*)` for `receipts`, `orders`, `order_items`, `customers`, `business_inventory`,
`cost_objects` and `deliveries`, scoped to the LAWNS `business_id`. Run the full read. Re-count.

- **PASS:** every count identical.
- 🔴 **FAIL:** any count moves. The read is advertised as changing nothing on both sides.

⚠️ **WHAT IS ASSERTED IN ITS PLACE, so the gap is bounded rather than open:** the three read handlers
contain no insert, upsert, update or delete of any kind — the only writes anywhere in that router
are on the OAuth path — and every read payload carries `stored: false`. That is a reading of the
code, not a measurement of the database, and this card is the difference.

---
