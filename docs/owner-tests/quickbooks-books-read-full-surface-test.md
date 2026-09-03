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

### CARD 4 — 🔴 HER OWN INVOICES ARE ON SCREEN — AND NO BUYER NAME IS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #268 · R-24 clause (b) · David's Option B ruling, 2026-09-03
SIGNAL: none needed — this is read with the eyes.

After the read finishes, scroll to **"Your invoices"**.

- **PASS:** a scrollable list of **invoice number · date · total**. The numbers are her real
  QuickBooks invoice numbers and she should recognise them.
- **PASS:** the line above the table states **how many of how many** are shown — *"Showing the 100
  most recent of 1,469 invoices"* — never a bare count over a capped list.
- **PASS:** the same line says **"We do not list your customers' details here"** and points at the
  downloaded file.
- 🔴 **FAIL — AND THIS IS THE ONE THAT MATTERS: any customer name, email, phone or address
  appears anywhere in this table.** R-24 clause (b): *"a read of personal data is summarised, never
  listed."*
- **FAIL:** an invoice with no date renders as blank or as today. It must read **"No date recorded"**.

⚠️ **Newest first, by the date on the INVOICE** — not by when we read it (G9). Check two rows.

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

### CARD 7 — 🔴 THE REPORT OPENS, AND IT CAN BE SAVED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #268 · the missing print/download control
SIGNAL: `[TRACE:QBO] visualize — report generated { walks_read, measured, total_rules }`.

Press **Visualize** and read the window that opens.

- **PASS:** a bar at the top carries **"↓ Download or print this report"**. Press it; the browser's
  print dialog opens and **"Save as PDF"** produces the document.
- **PASS:** the saved PDF **does not contain the button** — it is removed in print.
- **PASS:** the title is **"DATA ANALYSIS: FIRST LOOK PRIOR TO INGEST"**, it carries its own
  generated date, and it names all three reads with their counts.
- 🔴 **FAIL:** the report asks for anything — an Accept, an Ingest, a next step. **It asks for
  nothing.** The screen is where a decision gets made; this is the gift.
- **FAIL:** any customer name appears anywhere in it.

---

### CARD 8 — ⚠️ BOTH NUMBERS ARE SHOWN WHERE A FIGURE WAS RE-MEASURED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #268 · R-26

On the review panel, look at any finding carrying an amber *"29 Aug analysis said: …"*.

- **PASS:** where a re-measurement exists, a green **"re-measured 3 Sep: …"** sits beside it —
  **including where it CONFIRMS the original.** *"We checked and it held"* is a result.
- **FAIL:** the 29 August figure has been silently replaced by the corrected one. Overwriting it
  leaves a number nobody can tell was ever wrong, which is how it gets quoted confidently a second
  time.

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
