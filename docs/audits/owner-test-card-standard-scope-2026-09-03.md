# SCOPE — the owner-test card build: reader + standard + print declarations as ONE pass

**Ledger #264 · 2026-09-03 · SCOPE ONLY. Nothing converted, no board edited, no reader changed.**
**Authorised by David; reported before starting, at his instruction.**

> 🔴 **THIS IS FILED AS A DOCUMENT RATHER THAN REPORTED IN CHAT, AND THAT IS THE POINT.** The audit
> that preceded it was a chat report from another session and was never filed — which is why the
> session asked to act on it could not find it. Same failure as card steps living in a report:
> it does not render, it dies with the window, and it cannot be sent. **A scope nobody can re-open
> is a scope that gets re-derived.**

---

## 0 · METHOD AND POPULATION

Every figure below was produced by reading the files in `docs/owner-tests/`, `owner-tests.html`,
`status.html` and `user_stories.md` on `main` at `01f2893`. **Population is stated on every count.**
Where a figure disagrees with the brief that authorised this build, **the measurement is reported
and the disagreement is named** rather than reconciled silently.

| | Brief said | 🔴 Measured | Where |
|---|---|---|---|
| Card formats | 2 (`## CARD` vs `## SURFACE:`) | **5 distinct shapes** | below |
| Boards to convert | 14 | **14 of 22** — but not the 14 the brief means | below |
| Total cards | 108 (mine) / 370 (earlier audit) | **296** across 22 boards | all five shapes |
| Boards with zero PASS/FAIL | 6 | **8** | table below |
| Capability-board rows | 25 | **26** (0.1–5.7) | already banner-corrected today |
| Boards with no `Capability:` | 11 of 20 | **13 of 22** | table below |
| Stories unmapped | 50 of 112 | **50 of 112** ✅ agrees | `user_stories.md` |
| Cards meeting step standard | 55 of 370 | **77 of 296** — and **55 of 275** under the narrower parse | corroborates |

✅ **The earlier audit's `55` reproduces exactly under the narrower parse**, from an independent
measurement. That is the strongest signal in this document that the earlier audit was sound.

---

## 1 · THERE ARE FIVE CARD SHAPES, NOT TWO — AND THIS CHANGES THE CONVERSION

| Shape | Boards | Example |
|---|---|---|
| `## CARD n` (h2) — **the standard** | 8 | `qb-test-mode`, `receipt-detail` |
| `### CARD n` (h3) | 9 | `customer-edit-surface` (19), `quickbooks-invoice` (19) |
| `### <n>.` numbered | 4 | `manager-visibility`, `team-permissions` |
| `### <CODE>-n` | 1 | `rbac-resource-action` (`R-9`, `N-5`) |
| `### <title>` under `## SURFACE:` | (the legacy band form) | `inventory` (104 cards) |

🔴 **THE BRIEF'S "convert the 14" ASSUMES THE 14 ARE EMPTY SHELLS. THEY ARE NOT.**
`rbac-resource-action` carries **40 PASS and 37 FAIL lines**; `customer-edit-surface` carries 23/16.
These are boards full of real checks written in a **third** heading shape that neither the reader
nor a `## CARD` grep can see. **Converting them is a content migration, not a rename.**

---

## 2 · THE READER — WHY 1 BOARD OF 22 RENDERS

`owner-tests.html`, measured:

- **Bands:** `^##\s*SURFACE:\s*([a-z0-9-]+)` (line 273)
- **Cards:** `^### ` — and **line 279: *"a `###` outside a SURFACE band is not a check"*** → silently dropped
- **Tags:** `^STATUS:` line-anchored (line 287) → **`**STATUS:**` (bold, the three newest boards) does not match**
- **Auto-fetch:** line 450 hardcodes **`./docs/owner-tests/inventory-full-surface-test.md`**

So the one board it loads is the one board written in the one shape it parses. **Every other board
renders nothing, silently.** The 8 `## CARD` boards — the working corpus, 108 cards including all 23
of the QuickBooks board — are invisible to it.

🔴 **PROPOSED CAP (PROPOSED, NOT MINTED — DAVID RULES):** a check in `npm run verify` that parses
**every** file in `docs/owner-tests/` with the reader's own grammar and **fails naming the board and
the reason** when one yields zero cards. Two properties matter: it must run over the *directory*
(not a list, which rots — #73's lesson), and it must be **capable of going red**, proven by pointing
it at a deliberately malformed fixture before it is trusted (R-33). Without it this recurs: the
mismatch has been invisible for seven weeks precisely because silence and success look identical.

---

## 3 · THE EIGHT ELEMENTS — WHAT EXISTS, WHAT IS OWED

Population: **296 cards**.

| # | Element | Have | Gain |
|---|---|---:|---:|
| 1 | exact screen / URL / query | 128 (43%) | **168** |
| 2 | numbered actions | 77 (26%) | **219** |
| 3 | exact expected result | 168 (57%) | **128** |
| 4 | specific FAIL | 174 (59%) | **122** |
| 5 | tenant & actor | 107 (36%) | **189** |
| 6 | what must be true first | 24 (8%) | **272** |
| 7 | 📄/🖱/🔧 print declaration | **14 (5%)** | **282** |
| 8 | 🔴 what the card cannot prove | **4 (1%)** | **292** |

**Elements 7 and 8 are effectively greenfield.** All 14 print declarations and 2 of the 4
"cannot prove" statements were written in the last two days (#262's cards 16–23); the earlier audit
measured **zero of 370** for print-provability and that is consistent with this.

---

## 4 · CONVERSION ORDER, AND WHAT I WOULD NOT TOUCH

**FIRST — the reader, alone, with its cap.** It is the only change that makes every later change
visible. Converting boards against an unfixed reader means converting blind.

**THEN, in this order, and the reason is "cards David will actually run next":**

| Order | Board | Cards | Why |
|---|---|---:|---|
| 1 | `qb-test-mode` | 23 | already the standard; **cards 21–23 are the live ones**, and 22 holds a stop |
| 2 | `receipt-detail` | 12 | 🔴 **the model — 12/12 on numbered steps**; converting it is nearly free and it becomes the reference |
| 3 | `receipts-view` | 11 | David settled **7 of 11 off one print** and had to work that grouping out himself — the print declarations pay for themselves here first |
| 4 | `delivery-fulfilment` | 12 | 6/12 steps already |
| 5 | `customer-edit-surface`, `quickbooks-invoice` | 38 | `### CARD` → `## CARD`; **real content**, mechanical heading change |
| 6 | `rbac-resource-action` | ~40 checks | richest non-conforming board; the `R-n`/`N-n` codes are cited elsewhere and **must be preserved as card titles, not renumbered** |

🔴 **WHAT I WOULD NOT TOUCH, AND WHY:**

- **`inventory-full-surface-test.md` (104 cards).** It is the single largest board, the **only** one
  the reader currently renders, and it has **0 numbered steps across 104 cards**. Converting it is
  half the corpus and it is the one thing that works today. **It should be its own build, after the
  reader lands and after the smaller boards prove the standard.** Doing it inside this pass risks
  breaking the only working board to fix boards nobody can see.
- **The `## 📋 24-CAPABILITY BOARD` heading string.** It says 24, the board holds **26**, and it is
  already banner-corrected in place. 🔴 **`status.html:261` parses the literal string
  `/^##\s*📋\s*24-CAPABILITY BOARD/i` — renaming it silently breaks the renderer.** The brief says
  "correct the count everywhere it appears"; the count is corrected **in prose**, and the heading is
  left alone deliberately. **29 references exist across 13 files**; they are a naming artefact, not
  a wrong measurement, and a blanket rename is exactly the sweep that breaks a parser.
- **`thunder/vendor-identity`** — live at session `d967011d`. R-62. `#259` stays reserved.

---

## 5 · 🔴 WHERE REWRITING WOULD BE AUTHORING A TEST, NOT RECORDING ONE

**8 boards carry ZERO `**PASS:**` and ZERO `**FAIL:**` lines** (brief said 6):

`operations-calendar` (16 cards) · `positions` (12) · `qb-order-ingest` (12) ·
`history-orders` (10) · `qb-delivery-ingest` (10) · `orders-roster` (8) ·
`owner-role-authority` (8) · `offline-store-and-forward` (7)

**That is 83 cards with no stated pass condition.** For these, elements 3 and 4 cannot be *recorded* —
they would be **invented**. A card whose PASS line I write is a test I designed, presented on a board
whose whole value is that David proves what somebody else claimed.

**PROPOSAL: convert their FORMAT and mark them `STATUS: needs-test` with the reason**, rather than
filling the template. `qb-order-ingest` and `qb-delivery-ingest` are the sharpest cases — 22 cards
about writing into a real company's accounting, with no pass condition between them.

⚠️ **`operations-calendar` is the one exception worth arguing**: 16 cards, 4 with numbered steps and
a `Capability:` line, so its author had a shape in mind. Worth asking David whether its PASS lines
are recoverable from the build that made it, rather than guessed.

---

## 6 · THE ARCS

**MAPS-TO — 50 of 112 stories read `—`.** ⚠️ **Not a defect list.** At least 12 are explicit
placeholders whose own text says the arc has no story yet (*"Cost-to-produce has no story yet"*,
*"Discovery has no story yet"*, *"Identity / roles / security has no story yet"*, the platform-economics
EPIC). **An unmapped story is a finding; inventing a mapping would be worse than the gap.** The full
list is reproducible with:
`awk '/^### /{t=$0} /^MAPS-TO: *—/{print t}' user_stories.md`

**`CAPABILITY:` — 13 of 22 boards declare none.** Board-level, and **`NONE` is a valid value and a
finding**, per David's ruling. The three surfaces that genuinely have no id:
**Receipt Keeper** (flagged at #252, still unminted) · **both receipt boards** (which already declare
`Capability: NONE` and call it a finding — **the model**) · **`positions-full-surface-test.md:11`**.

**Two real cards live in `docs/audits/offline-store-and-forward-recon-2026-08-23.md:805-824.**
Confirmed: complete cards with `STATUS: owed`, `DEVICE: phone`, `COVERS: #54 · #143`, EXPECT/FAIL
lines and a `NO CONSOLE` note — and one is *"THE RECON'S HEADLINE — EXPECTED TO FAIL"*.
⚠️ **The board `offline-store-and-forward-full-surface-test.md` also exists (7 cards) and carries a
`COVERS: #54`**, so this is partial duplication, not pure exile. **Reconcile, do not blind-move** —
the two may already be on the board in a weaker form, and moving them would create a duplicate.

---

## 7 · SIZE, HONESTLY

- **Reader + cap:** small and self-contained. One file, one new check.
- **Standard + the 6 conversion targets above:** ~96 cards, of which ~40 need real step-writing.
- **The 83 zero-PASS cards:** format only, marked `needs-test`.
- **`inventory` (104 cards):** **excluded — its own build.**

🔴 **The honest total for this pass is ~190 cards touched, ~40 authored-with-care, and 104
deliberately left alone.** If that is too large, the natural cut is **reader + cap + boards 1–3
(46 cards)**, which covers every card David is likely to run this week and proves the standard
before it is applied at scale.
