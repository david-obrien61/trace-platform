# SHOW LAUREN HER DATA — RECON, AND A STOP

**Date:** 2026-09-03 · **Type:** RECON → STOP → REPORT. **No build. Zero changed lines under `packages/`, `api/`, `supabase/`.**
**Measured against:** the 2026-08-29 captures in `~/Downloads` (outside the repo, R-23), read read-only, nothing written.
**Prompt:** *SHOW LAUREN HER DATA — READ, DISPLAY, REPORT. NO INGEST.*

---

## 1 · THE STOP — §2 CONTRADICTS R-24, AND THE SAFEGUARD IT WOULD UNDO WAS BUILT ON PURPOSE

§2 asks for **"HER CUSTOMERS' NAMES, HER ITEM NAMES, HER INVOICE NUMBERS"** on screen, and calls the
absence of them *"the gap you measured."*

**It is not a gap. It is a ruling, and the code says so at the line.**

> **R-24, clause (b)** — `docs/RULINGS.md:79`, David's words:
> *"🔴 **DO NOT RENDER 1,900 CUSTOMER RECORDS ON SCREEN.** Show the count, the field coverage… and
> the first few rows so David can see the shape. The file is the artefact; the screen is a summary.
> Nothing is logged. No customer name, address or email in a trace line, ever."*
> And the clause as filed: *"**A READ OF PERSONAL DATA IS SUMMARISED, NEVER LISTED** — counts,
> coverage, duplicate sizing, and a hard-capped handful of example rows; the complete data exists
> in the operator's own file and nowhere else."*

The prompt's own evidence sentence is **a quotation of the comment that implements the ruling.**
`api/qbo/router.ts:694`:

> *"There is not even a preview, because there is no shape here worth showing that a summary does
> not already carry. The complete data reaches the operator exactly once, as the verbatim bodies
> inside `capture`… (R-23/R-24)."*

And the restraint is **structural, not stylistic** — `QboInvoiceRow` (`invoiceList.ts:86-94`) has
`customerId` and **no customer name field at all**, so `BooksReview.tsx:31` can say *"R-24 clause (b)
holds by construction, not by care."* Rendering names on this surface means **re-adding a field that
was deliberately not parsed.**

**⚠️ The honest counter-argument, which is why this is David's call and not mine.** R-24 was ruled
about **David's** screen during a developer read. §2 is **Lauren**, looking at **her own** customers,
in her own business, under RLS — data she already reads in QuickBooks every day. That may be a
genuinely different case. But it is a *different case from the one that was ruled*, and R-24's text
does not carve it out. **The filed one wins until you say otherwise.**

**Three ways forward, narrowest first:**

| | What ships | R-24 |
|---|---|---|
| **A** | **Items in full** (already shipped — a catalogue, not people) + invoices and customers stay summarised. | Untouched. |
| **B** | Items in full · **invoices listed by number, date, total** — no buyer name · customers stay summarised. | The invoice *record* becomes visible without the person. Needs a narrow amendment. |
| **C** | All three listed, names included, as §2 asks. | Overturns clause (b) and re-adds the dropped field. |

**B is the one I would put to you**, because the recognition §0 is after — *"she has to recognise her
own business"* — is carried by **her item names and her invoice numbers**, and neither is personal
data. Her customer list is the one place where the screen buys recognition at the cost of the ruling.

---

## 2 · TWO MORE QUESTIONS THE PROMPT ASKS THAT ARE ALREADY ANSWERED ON FILE

**§3 — the PDF question is decided and built.** Option (b), print-to-PDF, no dependency, with the
`qr/print.ts` precedent named. `QboBooksReader.tsx:289`:

> *"A print stylesheet plus `window.print()` (the `qr/print.ts` precedent) rather than a PDF
> dependency. Which means it can be REGENERATED after they fix something — and the second run
> showing fewer findings is the best demonstration this product has."*

There is nothing to cost out. ⚠️ **One real gap inside it:** `booksReport.ts` renders **no print or
download control at all** (`grep button` → one hit, in a comment saying the document has none). The
report opens in a window with no way to save it but the browser menu. §3 asks for a download icon and
a download button. **That is a genuine, small, uncontested piece of work.**

**§3 — the card-processing recommendation.** Already ruled un-authorable, and the ruling applies to
itself. **R-68**: *"the worked example from the prompt — card processing… is NOT built and CANNOT be
from these three reads: it needs payment-method fee data, and Item/Customer/Invoice do not carry it.
Naming it as a gap rather than authoring the numbers is the ruling applying to itself."*

**④ Where the standard does not cover it — a gap, not licence.** `ui-control-standards.md` has **no
clause for a long-running operation's progress narration.** G1–G9 are grid clauses, M1–M5 modal, F1–F4
field, E1–E6 editor, S1 headers. §1 is asking for behaviour the standard has never described. If §1
is built, it should mint the clause, per **R-74** — *"① the design doc is updated ② THEN the display
widget is updated, once ③ surfaces use the widget."*

---

## 3 · RE-MEASUREMENT — EVERY POPULATION IN §3, MEASURED TODAY (R-26)

Method: the **shipped** `evaluateBooks` engine compiled and run over the three captures exactly as
`QboBooksReader` calls it (items + customers + invoices + discounts + shipDates). Where the engine
does not compute a figure, measured directly from the capture and labelled as such.

**Reads:** 685 items · **1,936** customers · 1,469 invoices — all three `complete: true`.
**Engine result: 15 rules, 11 measured, 4 not.**

### Confirmed exactly — quoted figure survives re-measurement

| Figure | Prompt | Measured |
|---|---|---|
| Items | 685 | **685** ✅ |
| Invoices | 1,469 | **1,469** ✅ |
| Open balance | $30,736 | **$30,736** (14 invoices) ✅ |
| More than 30 days past due | $11,157 | **$11,158** (6 invoices) ✅ |
| Oldest due date | 22 April | **2026-04-22** ✅ |
| "Due on receipt" | 1,412 of 1,469 | **1,412** ✅ |
| Reused invoice numbers | 22 numbers / 44 invoices | **22 / 44** ✅ |
| No delivery date | 881 of 1,469 | **881 of 1,469** ✅ |
| ShipDate adoption | 2% before / 64% after | **2% of 570 / 64% of 899** ✅ |
| Customers with no contact | 110 | **110** ✅ |
| Bought exactly once | 83%, 56% of revenue | **83% (905 of 1,093) / 56%** ✅ |
| Sold at more than one price | 286 of 414 | **286 of 414** ✅ |
| Top customer / top ten | 4.4% / 18% | **4.4% / 18.3%** ✅ |
| Military discount items | 3 | **3** ✅ |

### Wrong, stale, or a different measurement than the sentence claims

| Figure | Prompt | Measured | What it is |
|---|---|---|---|
| **Customers** | 1,927 | **1,936** | 🔴 **Stale.** R-69 already records 1,936. Both "1,927" uses in §1/§3 are wrong, and so is the denominator in "110 of 1,927". |
| **Income accounts** | 41 | **13** | 🔴 **Unsupported.** 13 distinct `IncomeAccountRef` across 685 items; 9 appear on invoice lines. 41 is not derivable from these three reads. The discovery doc says *five* (line 185) — a third number. |
| **Discount-in-wording** | 504 lines / $614,053 | **412 lines / $461,835** | Engine's own count. |
| **Formal discount lines** | 66 / $31,985 | **66 / $31,985** raw · **88 / $36,287** engine | Both right, two definitions (raw `DiscountLineDetail` vs discount-item names). The report must pick one. |
| **Possible duplicate customers** | ~72 | **54** | Engine, shared email *or* phone. |
| **Below list price** | 54% of 3,366 | **56.8%** (1,976 of 3,476) | Close; denominator differs. |
| **March 7.5× January** | $341,245 vs $45,382 | **exact — for 2026 only** | ✅ figures right, ⚠️ **population unstated.** 2025 is 4.6× ($238,582 vs $52,301). A single year presented as the pattern, in a report whose own rule is that every figure names its population. |
| **23 months** | 23 months | **2024-10-09 → 2026-08-29, 22 months carrying invoices** | November 2024 has none. |
| **40 planted jobs, ~$6,000** | 40 | **not computable** | Deliberately uncomputed — see §5. |
| **7 customers qualified for a discount** | 7 | **not computable** | Deliberately uncomputed — see §5. |

### 🔴 The one that must not ship as written

| Figure | Prompt | Engine says today |
|---|---|---|
| Sold below the price card | *"53 rows, 32 items, 230 sales"* | **"1,976 sales… 314 products… $1,607,416 less than your own price list over 22 months."** |

**$1,607,416 is 52% of their total revenue ($3,187,796), and under R-66 money-first ordering it sorts
FIRST — the opening line of the document David hands Lauren.**

It is not leakage. It is mostly their pricing:

- Median charged/list ratio across all comparable lines: **0.87** — so list price is broadly real…
- …but of 185 items with ≥5 sales, **49 (26%) were never once sold at or above their list price**, and
  those carry **$671,741 — 41% of the total shortfall.** `Oak:MO15` lists at $500 and typically sells
  at $169. `Elm:CE30` lists at $900, sells at $320.
- **74 below-list lines were charged exactly $0**, each counted at its full list price.
- Quantity more than doubles it: **$761,504 at qty=1 → $1,657,696 with qty applied**, driven by 36
  large-quantity lines. That is bulk pricing being counted as loss.

**And the rule's name does not match what it computes.** It is `sold-below-price-card`, quoted at
*"53 rows, 32 items, 230 sales"* (`booksFindings.ts:235`) — figures that came from a **published price
card**. The code compares against the **QuickBooks `UnitPrice`**. Two different floors, one sentence.

⚠️ **This is the mutant pattern the prompt warns about, inverted:** not a screen made calmer than the
truth, but a headline made *louder* than it. Lauren knows her own prices. If the first line of the
report tells her she gave away half her revenue, she will know it is wrong, and every correct figure
underneath it goes with it.

---

## 4 · A CANNOT-COMPUTE THAT IS FALSE ABOUT THE READ — AND IT IS TWO FIELDS

`booksFindings.ts:571` tells the owner:

> *"We cannot tell you what you are owed. **The invoice read does not include** how much of each
> invoice is still unpaid, or when it was due — so nothing here should be read as 'your receivables
> are fine'."*

**The invoice read does include both.** `Balance` and `DueDate` are present on **1,469 of 1,469** rows
of the 29 August capture. What drops them is our parser: `QboInvoiceRow` (`invoiceList.ts:86-94`)
carries `id · docNumber · txnDate · totalAmt · customerId · lines` and neither field.

Proof it is computable: **$30,736 open · $11,158 past 30 days · oldest due 2026-04-22** — measured
from the capture in one pass, and **matching the prompt's own figures exactly.**

So §3's second money finding is **real, correct, and currently reported to the owner as impossible.**
The fix is two fields in the parser and one rule body. **The sentence is the defect** — it blames
their data for something our parser did, and it is the kind of false silence the report exists to
prevent.

---

## 5 · TWO CANNOT-COMPUTES THAT ARE CORRECT, AND SHOULD STAY

Both figures §3 asks for are deliberately unbuilt, with the reason at the line:

- **Trip charge** (`booksFindings.ts:224-231`) — *"The rule needs to know WHICH ITEM MEANS 'trip
  charge' in these books. Guessing it from item names would produce a number that happens to be right
  on the rows we have looked at and is a rule nobody agreed to — R-50's retro-classification,
  arriving as a helpful default."* ⚠️ The catalogue has five candidates at three prices —
  `Backyard Delivery` $125, `Tailgate Delivery` $75, `TC` $50, `DIW` $0, `FDIW` $0 — and **none is
  $150**, the rate §3 prices the finding at. My own loose proxy gave 52 invoices, not 40, which is
  exactly the "number that happens to be right on the rows we looked at" the comment predicts.
- **Discount never applied** (`:283-289`) — needs the policy: who qualifies. *"That is a rule about
  their business, not a pattern in their data."*

**Leave both.** They are R-25 holding — *measure, don't decide*.

---

## 6 · WHAT §1–§3 ACTUALLY COST, GIVEN WHAT IS BUILT

Far more of this exists than the prompt assumes.

**Already built and shipping:** the three reads with count-first completeness refusal · the file
harness (R-69) · the 15-rule findings engine, money→risk→tidiness, money-at-stake ordering within
tier (R-66) · the review panel that renders unmeasured rows in grey with their reason · **the
quoted-beside-measured display the prompt asks for in §4** (`BooksReview.tsx:22-26`, and its comment
cites R-26) · the full report — *"DATA ANALYSIS: FIRST LOOK PRIOR TO INGEST"*, asks for nothing,
carries its own date and the read date, names each walk whole-or-not, escapes item names, no customer
names · `renderExpand` on `<DataSheet>`, live at `BusinessInventory.tsx:418`, so §2's display work has
a proven widget under it and does not need one built.

**Genuinely new, and small:**
1. **One button instead of three** — a sequencer over the three existing reads. No new `api/` function
   (`api/` is **12 of 12**; this adds none).
2. **"This will take a few minutes"** before the first request.
3. **A print/download control on the report page.**
4. **Receivables** — two parser fields, one rule body, one false sentence deleted.

**Genuinely new and NOT small:**
5. **§2's record display** — blocked on §1 above.
6. **Real per-walk narration** — see §7.

---

## 7 · WHAT NARRATION THE WALK CAN HONESTLY EMIT TODAY

**"reading customers, 1,000 of 1,927" cannot be emitted today, and not for a small reason.**

`readAllPages` (`router.ts:495`) counts first, then pages, then returns — **all inside one HTTP
request**. The browser learns nothing until the whole walk lands. There is no stream. So:

- **Honest today, free:** *"Reading your products & services…"* → *"Read 685 products & services —
  that is all of them."* → *"Reading your customers…"* → and so on. Per-**walk** granularity, three
  real counts, each stating it is whole. **This already satisfies R-24's completeness surfacing** and
  is most of what §1 describes.
- **Honest today, cheap:** a count-only call before each walk gives *"reading customers — expecting
  1,936"*, a real number before the wait rather than during it.
- **Running counts within a walk** need streaming (SSE) or client-driven pagination. Client-driven
  pagination **moves the completeness refusal into the browser**, which is the one thing R-24 clause
  (a) exists to prevent. **I would not do this for a demo.**

⚠️ **And §1's own correction protects you here.** "A few minutes" up front, then three real counts
landing one after another, is honest and cannot stall misleadingly. A per-row counter buys very little
on top of that and costs the refusal's location.

---

## 8 · WHAT I DID NOT DO

- **Nothing was written.** Working tree clean; the only commit during this session is the peer's
  `5205ae0` (#266). All measurement scripts live in the session scratchpad, never the repo.
- **Nothing was read from Intuit.** Every figure comes from the 29 August capture files already on
  disk. **QuickBooks was not contacted.**
- **No ruling filed.** §1's question is David's, and R-38's precedent from #266 stands: a ruling is not
  drafted in his voice.
