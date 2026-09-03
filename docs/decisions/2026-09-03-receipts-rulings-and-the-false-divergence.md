# Receipts — David's rulings of 2026-09-03, and the divergence reason that was false when written

**Filed:** 2026-09-03 · **Author:** Thunder (session `90289835`) · **Status:** RECORD — nothing built, no code changed
**Measured against:** `main` `29d4433`, which is `origin/main`

---

## 0 · WHY THIS IS A DOCUMENT AND NOT ROWS IN THE CANONICAL FILES

Every file these rulings belong in — `docs/RULINGS.md`, `docs/CLOSE-OUT-LEDGER.md`, `CLAUDE.md`,
`docs/DECISIONS-INDEX.md`, `TRACE-SESSION-BOOTSTRAP.md`, `docs/built-inventory.md`,
`docs/handoff-archive.md` — is **uncommitted and held by a live peer session (`da661dea`)** in the
shared primary worktree, mid-close-out. Writing to them would clobber another session's work.

**R-62, in David's words:** *"A session edits only branches it owns. Work belonging to another
session's branch is handed to that session, never applied across. One writer per branch."*

⚠️ **AND THE HAND-OFF COULD NOT BE MADE THE OTHER WAY EITHER.** `ListAgents` resolves nine peers;
none maps to `da661dea`, and its transcript contains no self-name, so **it has never run
`ListAgents` and cannot be addressed.** That is R-62's own recorded failure mode, verbatim:
*"the owning session could not be addressed at all — it had never run ListAgents, so its peer name
was unrecoverable from disk and the [ref] is not derivable from a session id. A hand-off that
depends on a live listener is not a hand-off, so it was filed as a committed document plus a
⚡ ACTIVE STATUS row instead."*

**So: a committed document.** The ⚡ row is owed and cannot be written until `da661dea` releases
`TRACE-SESSION-BOOTSTRAP.md`.

**Sequencing David set:** ① `da661dea` finishes and commits (G9, the sort, the card flip, the cap)
→ ② the receipts prompt is re-issued amended → ③ the editor extraction is scoped as its own work.

---

## 1 · 🔴 THE URGENT ONE — THE CAP'S FIRST DECLARATION CARRIES THE CLAIM DAVID JUST OVERTURNED

`docs/decisions/ui-standard-divergences.json` (untracked, written by `da661dea` at 14:07 today)
records the receipts divergence with this `reason`:

> *"Each row carries a variable-length chain (0..n orders, each with 0..n deliveries). **A fixed-column
> grid can render that only by truncating the chain or by exploding one receipt into several rows** …"*

and grades it in its own `note`:

> *"THIS IS THE DECLARATION THAT PROVES THE CAP. **The original divergence was REASONED AND CORRECT
> about the shape**, and still defective: it explained dropping the grid and said NOTHING about G4,
> G5 and G6."*

🔴 **THE PREMISE IS FALSE AND THE MEASUREMENT IS NOT IN DISPUTE.** `DataSheet.tsx:81-82` has carried
`renderExpand?: (r: T) => React.ReactNode` — *"Optional per-row detail drawer. When present, a
trailing expand toggle column appears."* — since **2026-07-01**, commit `e3e6796`. The divergence
comment claiming a grid **cannot** render the chain was written **2026-09-01**, commit `ab617b2`
— **two months later.** A disclosure row is exactly what the widget already had.

**David's ruling:**

> *"THE DIVERGENCE WAS NOT A GAP IN THE WIDGET. IT WAS AN UNCHECKED CLAIM ABOUT OUR OWN WIDGET.
> Record it that way — R-26's class, and the second instance this week of a comment contradicting
> its own repo (#61 was the first). Which means the receipts divergence declaration, when the cap
> lands, is not 'grid dropped for a good reason, G4/G5/G6 owed.' It is: **THE STATED REASON WAS
> FALSE WHEN WRITTEN.** That is a stronger first declaration than the one Lightning asked for."*

**R-26, for the reader who does not have it to hand:** a written declaration nobody checked against
reality, steering a decision — eleven instances in three days of live customer use, filed
2026-08-29. **Tech-debt #61** is the first instance this week: `countPromote.ts:24` asserted that
scrape-reads-variations was *"never built"* while `fetchProductVariants` / `extractSizeVariants`
existed and were wired — a comment contradicting its repo, which then fed two days of wrong
reasoning.

### What the declaration must say instead

The `reason` field should not be repaired into a better argument for dropping the grid. It should
record what actually happened: **the shape was chosen on a claim about `<DataSheet>` that the
component contradicted at the time of writing, and the claim was never checked.** Whether the card
shape is nonetheless the right one is a separate question, still open, and it is not settled by the
reason currently on file. `G1`/`G2`/`G3`/`G5` are all declared `dropped` with reasons deriving from
*"the shape is a card list, not a table"* — every one of them is downstream of the false premise and
is re-answerable once it is withdrawn.

⚠️ **`da661dea`'s work here is good and this is not a criticism of it** — its `G4`/`G6`/`G7` `owed`
verdicts are the finding the cap exists to produce, and its baseline block (*"23 UNAUDITED … Do not
read this number as 23 known-good surfaces"*) is exactly right. **Only the `reason` and the
`note`'s grading of it are overturned.**

---

## 2 · ✏️ DRAFTED FOR DAVID, NOT FILED — THE R-38 AMENDMENT

⚠️ **THESE ARE THUNDER'S WORDS, DRAFTED AT DAVID'S INSTRUCTION, DELIBERATELY UNNUMBERED AND NOT IN
HIS VOICE.** David: *"Draft the amendment to R-38 unnumbered, in David's register, with your
3-of-10 table as its evidence. Do not file it in his voice."* It takes a number when he writes it.

**R-38 as filed** (`docs/RULINGS.md`, 2026-09-01):

> *"**A LINE WITH NO SKU AND NO QUANTITY IS NOT GOODS; IT IS A COST *ON* THE GOODS.** Recognise it
> as allocation, never ingest it as an item. BWI FUEL Surcharge $18.08/$18.55/$18.82, all
> `sku:null, quantity:null` · CC's $800 shipping under item code `111111` · Backbone's
> '44 × $3 per mile'."*

**THE EVIDENCE — R-38's structural test measured against our own corpus.** Population: every
cost-on-goods line in the 17 LAWNS receipts David approved in the demo dataset.

| line | occurrences | `sku` | `quantity` | R-38's test says | truth |
|---|---|---|---|---|---|
| bwi `FUEL Surcharge` | 3 | `null` | `null` | not goods ✅ | not goods |
| Bailey Bark `FREIGHT` | 3 | **`099`** | **`245`** | **goods ❌** | not goods |
| Bailey Bark `Fuel Surcharge` | 3 | **`110565`** | **`0.14`** | **goods ❌** | not goods |
| Sudderth `CREDIT CARD FEE` | 1 | `null` | **`1`** | **goods ❌** | not goods |

**3 of 10 caught. 7 misclassified as goods.** The rule was derived from bwi — whose surcharge
carries neither field — and never run against Bailey Bark or Sudderth, both of which were already
in the corpus when it was written. Bailey Bark prints a SKU for freight (`099`) and a real tonnage
(`245`); Sudderth's card fee carries `quantity: 1` because one fee was charged.

**THE AMENDMENT, DRAFTED:**

> **R-38's structural test is RETIRED. Its intent survives, carried by the resolver rather than by
> a field check.** A purchase line resolves to **a material**, or to **"not a material"** — freight,
> fuel surcharge, delivery, fees. **"Not a material" is a first-class answer, not a gap.** The owner
> answers once per vendor SKU and is never asked again.
>
> Description keywords (`freight` · `fuel` · `surcharge` · `fee` · `delivery`) may seed the
> **suggestion**. They are **never the rule**. That is suggest-and-capture-intent, which is already
> how the unit question and the normalisation question work.

**WHY THE STRUCTURAL TEST CANNOT BE PATCHED:** any field-shape test is a guess about how a vendor
prints their invoice, and each vendor prints differently — which is the same lesson the vendor
billing-unit question already produced. The resolver asks the owner once and remembers; a test
asks the data a question the data cannot answer.

---

## 3 · DAVID'S RULING — THE LINE-ITEM SEARCH SHIPS NOW, LABELLED HONESTLY

**Filed here awaiting a number**, because `docs/RULINGS.md` is held. This one **is** in David's
words and is a ruling, not a draft:

> *"THE LINE-ITEM SEARCH SHIPS NOW, LABELLED HONESTLY. At 37 rows the client-side filter is correct.
> The failure is above `RECEIPTS_PAGE_LIMIT = 100`, and it is a WRONG ANSWER, not a slow one. So:
> when the page is capped, the result says **'searched the newest 100 receipts'** — never a bare
> 'nothing found.' Server-side (jsonb + GIN or a generated text column) is filed as OWED with your
> reasoning, not built now. §6 R1's shape applied to search: a partial answer that names its limit,
> never a confident absence."*

**THE MEASUREMENT BEHIND IT.** `<DataSheet>`'s G6 filters **client-side over already-loaded rows** —
`out.filter(r => searchText(r).toLowerCase().includes(q))`, `DataSheet.tsx:149`. So:

- **At 37 rows:** free. The page already loads every row; adding `line_items` to `RECEIPTS_SELECT`
  costs roughly **20–25 KB** (171 line objects across 36 receipts, ~4.75 lines each). The filter is
  O(n) over 37 strings.
- **At 3,000 rows:** `RECEIPTS_PAGE_LIMIT = 100` (`packages/cultivar-os/src/lib/receiptsList.ts:78`).
  *"When did I last buy Osmocote and what did I pay"* would be answered from the newest 100 receipts
  and **report nothing found for a receipt that exists.** Not slow — **wrong.**

**G6, quoted, since the id alone says nothing:** *"Search / filter — a global text search + (where a
status field exists) a quick status filter. Rationale: scanning by eye doesn't scale past a
screenful."*

---

## 4 · WHAT THE PROMPT LOSES — DAVID'S THREE WITHDRAWALS

1. **§1(c) — DONE at #257/#258.** The prompt cites `ReceiptKeeper.tsx:424-426` mapping to
   `{description, amount}` only. On `29d4433` that map emits **all five keys**. David:
   *"Lightning cited a two-day-old report. Drop it."*
2. **The default-sort bullet — G9**, and `da661dea` has already flipped CARD 1 `covered` → `owed`.
   **G9, quoted:** *"DEFAULT SORT IS THE MOST RECENT RECORD DATE FIRST: the date the document or
   event itself carries, NOT the row's creation timestamp."* Its own status line: *"G9 IS NEW
   (2026-09-03) AND IS NOT YET MET ANYWHERE — it is a KNOWN RED, not an assumed green."*
3. **"the modal obeys M1–M5" — WITHDRAWN.** David: *"You are right that it makes one receipts modal
   answer a platform-wide question, which clause 5 forbids in terms. M3/M4/M5 land in the shared
   control as the modal rung; receipts inherits. NOT this build."*
   **The standard's own words:** *"M3 (escape-to-close), M4 (defined backdrop behavior —
   inconsistent: some sheets dismiss on backdrop, some don't), and M5 (focus management /
   focus-trap) are NOT yet implemented platform-wide. They are honest amber/red on the compliance
   board — the next modal rung — not silently assumed done."*
   **Clause 5, quoted:** *"① THIS DOC IS UPDATED → ② THEN THE SHARED DISPLAY WIDGET IS UPDATED, ONCE
   → ③ SURFACES USE THE WIDGET. NOT: each surface reasoning about the question separately."*

---

## 5 · SCOPE — 🔴 THE MODAL IS NOT A MOUNTING

**E1, quoted in full**, because the id is invisible to a reader and the board does not render it:

> *"**ONE RECORD, ONE EDIT SURFACE** — a given field of a record is editable in exactly ONE
> component. A second surface over the same record is a re-use of the first (mounted in context),
> never a second implementation. Why: two edit surfaces drift. The moment one gains a field or a
> rule, the other is quietly wrong, and nobody finds out from the code."*

**Measured:** `packages/cultivar-os/src/pages/ReceiptDetail.tsx:141` is `export function
ReceiptDetail()` — **one monolithic component**. The read, the editable table, the save call and the
vendor question all live inside it. **There is no extracted editor to mount**, so E1 cannot be
satisfied by mounting anything that exists today.

The pure lib **is** reusable — `receiptDetail.ts` holds the model, the four field states, the
preview verdict and the vendor question. The **editor UI is not**.

**David:** *"EXTRACTING THE EDITOR IS THE WORK. Scope it as such when the prompt returns; do not let
it read as a small piece of a display change."*

---

## 6 · TWO SMALLER RECORDS

**(a) The invoice number is a MIGRATION; the UOM is a prompt change. Different fixes, and the cheap
one is the one that removes the stupid question.**

- **Invoice number:** the reader **IS** asked — `api/receipts/ocr.ts:66` (receipt shape) and
  `:100` (invoice shape), both `"receipt_number": "string or null — receipt, invoice, or
  transaction number if printed"`. The **writer drops it**: there is no `receipt_number` column on
  `receipts` and it is not in the INSERT. Header-level, so a jsonb key on `line_items` cannot hold
  it. **A migration.**
- **UOM:** **zero occurrences** of `uom` / `unit_of_measure` in `ocr.ts`. **The reader was never
  asked.** A prompt change — and it is the one that stops the screen asking *"when bwi bills you, is
  it by the yard or the ton?"* on an invoice that answers it in its own UOM column and in every
  description (`4.4 cf`, `50 lb`, `40 lb`, `1 lb`).

**(b) "No order recorded for this receipt." must survive as a CELL.** Not a blank, not a dash.
**Receipts-view CARD 5 says so in those words** — an absence a reader has to interpret is the
defect, not the fix. Moving to a grid turns every sentence into a cell, and this is the sentence
that must not be lost in the move.

---

## 7 · WHAT IS OWED AND BY WHOM

| owed | to whom | blocked on |
|---|---|---|
| The `reason`/`note` correction in `ui-standard-divergences.json` | `da661dea` — **it is uncommitted in their tree right now** | they cannot be addressed; David relays, or it is corrected after their commit |
| A number for the search ruling (§3) | David | `docs/RULINGS.md` is held |
| A number and his own words for the R-38 amendment (§2) | David | by his instruction — deliberately not written for him |
| The ⚡ ACTIVE STATUS row for this record | Thunder | `TRACE-SESSION-BOOTSTRAP.md` is held |
| The §3 handoff entry and ledger row | Thunder | `CLAUDE.md` and `CLOSE-OUT-LEDGER.md` are held |
| Server-side line-item search (jsonb + GIN or a generated text column) | a future build | filed OWED by ruling, not built |
| Extracting the editor out of `ReceiptDetail` | the re-issued prompt | scoped as its own work, per §5 |
