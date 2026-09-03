# THE STANDARD OUTRANKS THE PROMPT — the receipts divergence, and the cap that makes it mechanical

**Filed:** 2026-09-03 · **Ledger:** #265 · **Ruling:** R-73 (G9) · **Branch:** `main`
**Type:** report + build (one cap, one clause, one behaviour change)

> **WHY THIS IS A FILED DOCUMENT AND NOT A CHAT REPORT.** #264's own finding, one day old: *"the
> audit that authorised this build was itself a chat report from another session and was never
> filed, which is why the session asked to act on it could not find it."* A report that lives in a
> window dies with the window and cannot be sent. This one is in the repo.

---

## 0. WHAT HAPPENED

A build prompt for the receipts list asked David to rule two display questions:
**"newest-first or unreviewed-first?"** and **"true modal or `/receipts/:id`?"** Both had answers
already. David's instruction, recorded as the rule that outlives this incident:

> **A BUILD SPEC IS NOT A HIGHER AUTHORITY THAN THE DESIGN SYSTEM.** Where a prompt contradicts a
> filed standard, the STANDARD WINS and the contradiction comes back to David as a question. It is
> never silently built either way — not to the prompt, and not to the standard while the prompt
> says otherwise.

Recorded at `docs/standards/ui-control-standards.md` → *How this is enforced*, clause 5, together
with the order of operations: **① the design doc is updated → ② then the shared display widget is
updated, once → ③ surfaces use the widget.**

---

## 1. THE TWO QUESTIONS, ANSWERED

### 1a. LIST ORDERING — the standard was SILENT, and that silence was the defect

**No clause named a default sort.** `G4` requires *"Sortable columns — click a header to sort
asc/desc, with a visible sort indicator"* — a CONTROL requirement, not an ORDER. Greps over
`docs/standards/`, `RULINGS.md`, `DECISIONS-INDEX.md` and `user_stories.md` returned nothing.

But the shipped order was settled four ways: in the query, re-asserted in the model, probe-covered
(`E7`), and **owner-proven by David** — `receipts-view` CARD 1, *"PROVEN 2026-09-02 on build
`7952cb1` — 17 rows, newest first: 15:51:49 at the top down to 08-26 20:50, no inversions."*

**⚠️ AND DAVID'S RULING CHANGED IT ANYWAY, WHICH IS WHY "it was already settled" WAS THE WRONG
CONCLUSION TO STOP AT.** The ruling is not *newest-first*; it is **newest DOCUMENT DATE first** —
`receipts.date`, the date on the paper, **not** `created_at`, the moment somebody photographed it.
The shipped code ordered on `created_at`. **On LAWNS's own rows the two disagree: the 2026-07-02
bwi invoice was captured AFTER the 2026-07-29 one**, so the list contradicted the invoices it was
a list of. Filed as **G9**.

**THE PRIOR PROOF PROVED THE OTHER ORDER.** CARD 1's evidence cites `15:51:49` and `08-26 20:50` —
capture timestamps — and its step read *"newest CAPTURE first."* It was a correct proof of the
behaviour that G9 replaces. **CARD 1 flipped `covered` → `owed`, LAST-PROVEN reset** (OP-14 clause
3), with the prior evidence preserved verbatim and a new discriminating step added: *find the bwi
2026-07-29 row and the bwi 2026-07-02 row; 07-29 must appear ABOVE 07-02.*

### 1b. "UNREVIEWED-FIRST" — not an alternative. An ask no build can honour.

`receipts` has **no reviewed/unreviewed column**. Measured live 2026-09-01 and recorded at
**R-50**: *"`receipts` has 21 columns and NONE of `origin`/`shape`/`source`/`doc_type`/
`document_type`/`kind`."* `reconcile_status` is the verdict the platform **banked at capture
time**, not a review state a human sets. **A sort order cannot be chosen over a field the table
does not have.** Recorded under G9 so the question does not return.

### 1c. MODAL vs ROUTE — the standard answers it, in §4, not §2

§2 (`M1`–`M5`) governs how a modal behaves once you have one. **§4 decides whether you may have
one:**

> **E1** — *"ONE RECORD, ONE EDIT SURFACE — a given field of a record is editable in exactly ONE
> component. A second surface over the same record is a re-use of the first (mounted in context),
> **never a second implementation**… Two edit surfaces drift."*

> **Enforcement clause 4** — *"A new edit surface is measured against §4 **BEFORE it is written**.
> The question is not 'is this component good?' but **'does this record already have an edit
> surface?'** — if it does, mount that one."*

A receipt has one: `/receipts/:id` → `ReceiptDetail`, routed at `router.tsx:235`, 12 owner-test
cards, and a write path enforced in the database (`edit_receipt_line_items` + the
`guard_receipt_snapshot_and_lines()` write-once trigger that **refused `postgres` twice from the
SQL editor**, #261). **David's ruling: `/receipts/:id` stands, the prompt is amended.** A modal
mounting *that same editor* is E1-compliant by E1's own words; a second implementation is not.

⚠️ **AND ONE THING I CANNOT REPORT: I HAVE NOT SEEN THE RECEIPTS PROMPT.** It is not in the
repository — no `docs/prompts/`, no build-spec file, nothing untracked. I was given David's
characterisation of it (*"it asks for the SAME editor mounted in a modal"*) and I have no text to
audit against that. **I am not going to claim I checked it.** If a second editor is in there, it
will not be caught by me having read it; it will be caught by E1 at build time.

---

## 2. WHY IT DEVIATED — a correct divergence, filed where nobody looks

`ReceiptsList` shipped as a card stack rather than a `<DataSheet>`. That was **(a) a filed
divergence with a recorded reason** — `ReceiptsList.tsx` header, executing §6 r16 properly: it
names the standard, names the deviation, and gives a reason about the data shape (a receipt row
carries 0..n orders each with 0..n deliveries; a fixed-column grid can render that only by
truncating or by exploding one receipt into several rows).

**Two defects survive that correctness, and both are the real finding:**

**① THE DIVERGENCE RECORDED IS NARROWER THAN THE DIVERGENCE TAKEN.** The header explains dropping
the grid SHAPE. It is silent on **G4 (sortable), G5 (column show/hide), G6 (search/filter)** — and
the surface has none of them. G7's density/bounded-box half is also unanswered; the header
addressed only virtualisation. **A narrow record read as a complete one.**

**② IT WAS FILED IN EXACTLY ONE PLACE.** Not the as-built doc
(`2026-09-01-receipts-view-as-built.md` — checked, no mention), not the ledger cell (#252 — no
mention), not `ui-standards.html`, not the standard. **A prompt-writer could not find it without
opening the component, and did not.**

**🔴 AND THE BOARD IS WORSE THAN EMPTY: `ui-standards.html` renders 3 of the standard's 6
sections.** Measured by the new cap: **11 clauses are defined in the doc and rendered nowhere** —
`G9, F4, E1, E2, E3, E4, E5, E6, S1, R1, R2`. **E1 — the clause that answers modal-vs-route — is
not on the board a prompt-writer would check.** The doc's own enforcement clause 2 promises
*"remaining gaps are visible, not buried."* For half the document they are buried.

---

## 3. THE CAP — `scripts/verify-ui-standard-divergence.mjs`

Wired into `npm run verify` as `verify:ui-divergence`. Declarations live at
`docs/decisions/ui-standard-divergences.json`.

| Check | What it asserts | Baselined? |
|---|---|---|
| **A** | A bespoke record-list surface carries a declaration. | ✅ ratchet (23) |
| **B** | 🔴 **A declaration ANSWERS EVERY CLAUSE of the sections it diverges from** — `met` / `dropped` (reason required) / `owed` — and says where a human can read it. | ❌ hard fail |
| **C** | Self-pruning: a declaration for a deleted file, or for one that NOW uses the shared control, fails as stale. | ❌ hard fail |
| **D** | Every clause in the doc has a row on `ui-standards.html`. | ✅ ratchet (11) |

**🔴 THE CLAUSE LIST IS DERIVED FROM THE DOC, NEVER HARDCODED** (#73's lesson). The consequence is
the whole point: **adding a clause to the standard automatically invalidates every declaration
until it is re-answered.** That is ①→②→③ made mechanical instead of remembered.

**CHECK B AND C ARE NOT BASELINED, DELIBERATELY.** Declaring is opt-in, so a declaration can be
held to its full standard from the first one. A and D are ratcheted because a day-one hard fail
would be paid off with ~23 rubber-stamp declarations, and **a declaration file full of rubber
stamps is R-33's exact defect: a check incapable of disagreeing.**

### 3a. PROVEN RED FIRST — seven times, deliberately, before it was trusted

| # | Induced defect | Went red |
|---|---|---|
| 1 | delete `G6` from the declaration | ✅ B1 names G6 and quotes it |
| 2 | `G4: dropped` with an empty reason | ✅ B3 |
| 3 | declaration for a file that does not exist | ✅ C1 |
| 4 | declaration for a file that now imports `DataSheet` | ✅ C1 ("the surface converged — delete the entry") |
| 5 | baseline 23 → 22 (simulating a new bespoke surface) | ✅ A1, naming six of them |
| 6 | baseline 11 → 10 (simulating a clause leaving the board) | ✅ D1, listing all eleven |
| 7 | 🔴 **add a `G10` clause to the DOC** | ✅ **B1 (declaration incomplete) AND D1 (board absent) — the derivation working** |

### 3b. A DEFECT THE CAP HAD ON ITS FIRST RUN, RECORDED BECAUSE IT IS INSTRUCTIVE

The first version read **comments as code**, so `ReceiptsList.tsx` — whose header contains the
words `<DataSheet>` **while naming the standard it diverges FROM** — was classified as a CONSUMER
of the shared grid and excluded from the population. **The cap exonerated the one file it was
written for, because that file's prose was the most careful.** Detection now strips comments
first. Separately, `DataSheet.tsx` itself was being measured as a divergence from itself; the
carrier list is now parsed out of the standard's own *"shared controls that carry these
standards"* block.

### 3c. WHAT IT CANNOT CATCH

- **Whether a reason is a good one.** It reads a string.
- **Correct USE of `DataSheet`** once imported (a missing `frozenWidth`, no identifier column).
- **§5 SECTION HEADERS.** The standard itself rules that review-only: *"one that tried would be
  reading intent."*
- **Detection is HEURISTIC.** It over-reaches (`Settings`, `OnboardingWizard`) and under-reaches
  (rows rendered through a helper the regex cannot see).
- 🔴 **`baseline.undeclared_bespoke_surfaces: 23` IS NOT 23 KNOWN-GOOD SURFACES.** They are
  **unaudited** — not found wanting, not looked at. The number is a debt, not a clean bill.

---

## 4. THE THREE STALE RECORDS, FIXED IN THE SAME PASS

1. **tech-debt #145** read *"🟡 no `/receipts/:id`"* while the route was shipped, boarded and
   wired. Corrected; the residual is a **data** gap (`cost_objects.receipt_id` populated 0 of 5 —
   tech-debt #144), not a routing one.
2. **`ProjectCostDrillIn.tsx:28`** said the route *"does not exist yet"* — **170 lines above
   `ProjectCostDrillIn.tsx:199`, which navigates to it.** A file's header contradicting its own
   body is R-26 at the shortest possible range. Corrected.
3. **§6 DATA READS read `🔴 DRAFT — DAVID RULES`** for eleven days after the 2026-08-23 ruling that
   settled it (*"READ HONESTY IS A TYPE, NOT A DISCIPLINE — the shape is a discriminated union"*)
   and two days after `ReceiptsList` shipped that exact shape. **Flipped to BINDING.** ⚠️ The R1/R2
   counts are unchanged and still owed — 30 confirmed instances, 9 HTTP-body sites, 7 auth reads —
   and **the auth carve-out is explicitly NOT swept up by this.**

---

## 5. WHAT IS OWED

- 🔴 **CARD 1 re-proof.** One new print of `/receipts`; the discriminating step is 07-29 above
  07-02. Thunder may never set `covered`.
- 🔴 **`ui-standards.html` renders 3 of 6 sections.** Its own build. When it lands, baseline D
  drops from 11 to 0 and the cap locks it there.
- ⚠️ **`receipts.date` NULL count is UNMEASURED from here.** The undated-row fallback (position by
  capture day, `nullsFirst: true` at the query so an undated row is never the first dropped at the
  100-row cap) is probe-covered but has no live population behind it. One query settles it.
- ⚠️ **23 unaudited bespoke surfaces.** The next sweep.
- ⚠️ **G9 has not been applied to `DataSheet`'s own consumers** (inventory / assets / customers).
  Unaudited against the clause that was just minted.
