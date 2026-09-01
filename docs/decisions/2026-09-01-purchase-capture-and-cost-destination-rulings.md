# The purchase-capture and cost-destination rulings — filed 2026-09-01

**What this is:** the evidence behind rulings **R-36 … R-51**, established in the 1 September
session. `docs/RULINGS.md` carries one line each and points here — that file's own rule is that a
ruling needing a paragraph is a ruling whose decision doc is missing, so the paragraphs live here.

🔴 **MOST OF THESE DO NOT GOVERN THE BUILD THAT FILED THEM.** They govern the CAPTURE and
COST-ASSIGNMENT builds that follow. **Filing them now is the point:** they were paid for on a day
whose narrative will scroll out of CLAUDE.md §3 at N=3, and four rulings have already evaporated
exactly that way (2026-07-30 — not disputed, forgotten).

**Provenance check performed before filing.** `docs/RULINGS.md` was read in full and grepped for
each rule's subject. **None of the sixteen was already on the board.** The prompt flagged that the
last two (R-50, R-51) might already exist from 28 August; they do not. The nearest neighbours are
**R-22** (2026-08-28 — owner authority and role assignment) and the 2026-08-23 ruling *"the manager
may see maintenance cost"*. Both are adjacent to R-50 and neither IS R-50: one is about who may
change a ROLE, the other about who may SEE one kind of cost. R-50 is a third thing — that seeing a
cost and assigning what it BECOMES are different permissions.

---

## A · Capture and parse

| # | Ruling | Evidence |
|---|---|---|
| **R-36** | A line with **no SKU and no quantity is not goods — it is a cost ON the goods.** Recognise it as allocation; never ingest it as an item. | BWI FUEL Surcharge $18.08 / $18.55 / $18.82, all `sku:null, quantity:null` · CC's $800 shipping under item code `111111` · Backbone's "44 × $3 per mile". |
| **R-37** | A line with **quantity > 0 and amount $0.00 NEVER silently raises stock at zero cost. Flag it and ask.** | `HE6849` Ferrous Iron Sulfate, qty 2 at unit $27.37 with amount $0.00 — $54.74 of goods at no cost. ⚠️ **The ambiguity is WHY the answer is an ask rather than a rule:** Greenleaf's trial cultivars ship qty 3 at merch $0.00 with only freight charged. **Identical shape, opposite meaning — the numbers cannot disambiguate it.** |
| **R-38** | **Match purchased items on SKU, never on description.** | `GM2042X` (1/2"×200', 6mil, 24pk) and `GM2044X` (1"×150', 8mil, 12pk) are **both named "Hand Tie Tape" and both $25.71.** A description match merges two different products at an identical price, and nothing about the result looks wrong. |
| **R-39** | **A struck-through line is never captured.** | Hand Tree Farm 2-16-2026 — capturing it overstates the purchase by **$3,900**. |
| **R-40** | **Handwriting on a printed invoice may be the BUYER'S own notes, not vendor data.** | McGill 0129 carries LAWNS's own retail price ladders written beside every line. Ingesting them as vendor figures puts LAWNS's SELL price into its own COST basis. |

## B · Cost model

| # | Ruling | Evidence |
|---|---|---|
| **R-41** | **Unit cost is per LOT, never per item.** | Gardenline `R190` 40lb at **$22.92 and $34.21 — 49.3% apart, same SKU.** ⚠️ **And stability cannot be assumed in the other direction either:** Osmocote `OS98615` held $68.24 across three invoices. Neither "it moves" nor "it holds" is the rule; the lot is. |
| **R-42** | **Freight allocation basis is OUR convention, not the vendor's formula — and it is shown as WORKING on screen.** | BWI's surcharge is **flat per shipment**, not a percentage: 1.351%, 1.717%, 1.488% of goods across three invoices. They do not compute it by value, so any basis we pick is ours to justify and ours to display. |
| **R-43** | **Allocate by UNIT for a homogeneous load, by VALUE for a mixed one.** | CC's $800 across 90 trees = $8.89 each. Twelve bags of Osmocote and one pack of tape are not comparable units. |
| **R-44** | **A purchased line has one of FIVE destinations, plus freight as a line TYPE:** stock (plants for sale) · supplies for resale · production input (this is `carry`) · job material (belongs to the placement service's cost) · operating expense. | One BWI invoice hits **four of the five in seven lines.** |
| **R-45** | 🔴 **The destination is NOT knowable at capture. Default it from the item; let it be corrected later. NEVER force a guess at capture.** | You cannot know, when 30 bags of Osmocote arrive, how many go into pots and how many onto the shelf — that is known at CONSUMPTION. **LAWNS both consumes and SELLS Osmocote:** catalogue price $150–175 against $68.24 paid. |
| **R-46** | **The item's default destination seeds from the SALES CATALOGUE:** a SKU carrying a sales price in QuickBooks is resale-capable. | Osmocote and Micromax both appear in LAWNS's own catalogue. This is [[R-25]]'s shape — a policy question the customer's own history can answer is answered from the history, not by us picking a default. |
| **R-47** | **No line splitting in v1.** Assign whole lines; reclassification moves quantity later. | — |

## C · Document routing and access

| # | Ruling | Evidence |
|---|---|---|
| **R-48** | 🔴 **The launch point sets the document's destination where one exists; where none exists, ASK.** The launch point is a fact already held; the classifier is an inference over a photo. | David's 2026-07-07 ruling — "one pipeline, two doors", launcher pinned to `shape:'invoice'`. **The capture panel today reads *"This looks like a receipt / expense"* and then offers *Add customer* and *Schedule delivery* — two SALES actions on something it has just called an EXPENSE.** 🔴 **AND THE MEASUREMENT THAT MAKES IT URGENT (live, 2026-09-01):** `receipts` has **21 columns and NONE of `origin` / `shape` / `source` / `doc_type` / `document_type` / `kind`**, and no migration adds one (only `20260612_receipts.sql`, `20260613_receipts_add_line_items.sql`, `20260614_receipts_reconciliation.sql` touch it). So the table holds LAWNS's OWN sales invoices (vendor = `LAWNS Tree Farm, LLC.`, 9 rows) beside its SUPPLIERS' (bwi ×4, Bailey Bark ×3, Sudderth ×1) **with nothing distinguishing them.** Until the launcher pins the shape, **no stored row may be retro-classified** — reading "the vendor is the tenant, therefore a sales invoice" happens to work on these 17 rows and is not a rule. |
| **R-49** | **At least SIX document types reach this capture surface, each with a different destination:** own sales invoice · vendor purchase invoice · freight-only invoice · receiving ticket (quantities, no prices) · acknowledgment (no money, no stock) · store receipt (expense only). | Archer2 $955 freight-only · **KBE 5107 $1,000 covering two tree invoices from two different vendors** · Hand Tree Farm #228851 receiving ticket · Hand's 2-16 "Coming in Friday 2/20". |
| **R-50** | 🔴 **SEEING cost is not ASSIGNING destination.** A manager may SEE cost; assigning the destination changes what is COGS, expense or inventory, and is an OWNER call. | Lauren already maintains 346 purchase rows by hand — cost, freight per tree, landed cost. Terry: *"I can see the money but I'm more in Operations."* |
| **R-51** | **A chemical purchase is the front end of an APPLICATION RECORD, not only a cost.** | Snapshot herbicide · Malathion · Heritage G fungicide · fire ant killer. Ties the buy side to the spray programme from the 2026-08-28 lot walk. ⚠️ **And LAWNS SELLS chemicals** (`Chemicals:BPT` $80) — so the category is production input, compliance artefact and resale **at once**: R-44/R-45's problem arriving with a regulator attached. |

---

## What governed the build that filed these

Two of the sixteen bear on the read-only receipts view (`packages/cultivar-os/src/lib/receiptsList.ts`,
ledger **#250**), and both bear on it as a PROHIBITION rather than as a feature:

- **R-48** — no document type is derived on a stored row. The module derives none, the vendor string
  renders exactly as stored, and probes **E1/E2/F3** hold it there. The measurement in R-48's
  evidence column was taken by this build (`scripts/measure-receipts-view.mjs`).
- **R-45** — never force a guess. Its read-side twin: a receipt that produced no order says so and
  stops, and the module's probe **D14** asserts the sentence carries none of
  *orphan / missing / unlinked / error / should / fail / problem*.

**One binding constraint of that build is NOT filed as a numbered ruling, deliberately:** *the
screen does not adjudicate — surface, don't decide.* David set it as a caveat on this build, not as
a platform ruling, and minting a ruling number for it would put words in his mouth on a board whose
whole value is that every line is his. It is stated at the module's head and asserted by D14. **If
it should be a ruling, it is one line and David's to say.**

## What is NOT ruled here

Two questions were left open on 1 September and are **David's — not a default anyone may pick in
code**:

1. **Why `accept_vs_edit` reads `edited` on every row.** ⚠️ **NARROWED, NOT ANSWERED, by this
   session's measurement:** all 17 LAWNS rows read `edited` while **`header_amount_edited` is false
   on all 17** — so whatever the owner changed, **it was never the total.** Lightning's hypothesis —
   that it may be an accurate signal rather than a broken one, because if OCR never parses cleanly
   every capture gets edited — is recorded and is **not to be built against**.
2. **Why the 1 September captures wrote receipts but no orders.** Measured: **8 receipts captured
   that day, 2 produced orders** (the bwi 2026-07-29 pair), 6 did not. Whether that is correct
   behaviour on a purchase invoice or a defect is precisely what the receipts view is forbidden
   from deciding.
