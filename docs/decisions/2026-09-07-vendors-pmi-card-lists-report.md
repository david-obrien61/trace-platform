# Vendors and PMI are not grids — what converting them takes
**Filed 2026-09-07 · REPORT, NOT A BUILD · commissioned by David in the G11 ruling**

> David: *"⚠️ Vendors and PMI are not grids at all — they are card lists. 21 vendors runs to five
> printed pages where a grid would be twelve lines with search and sort. Report what it takes; they
> are the two surfaces where cards actively cost her."*

Nothing here was built. This is the cost, per surface, so the decision is David's with the numbers
in front of him.

---

## ⚠️ What I could NOT measure this session, stated first

**The live row counts.** No database read was available, so **21 vendors is David's figure, not a
measurement of mine**, and the PMI asset count is unknown to me entirely. Everything below is
measured from **source**: which fields each card renders, how many, and what a grid would need.
Where a number is his, it says so.

---

## 1. VENDORS — `packages/cultivar-os/src/pages/Vendors.tsx` (327 lines)

### What the card renders today, field by field
| On the card | Would be | Note |
|---|---|---|
| `name` | **identifier column**, frozen | |
| `PREFERRED` chip | a column, or a leading flag glyph | read-only mark (E7) |
| `preference_note` | 🔴 **the one field a cell truncates** | see below |
| `email` · `phone` · `account_number` · `website` | 4 columns, most `defaultVisible: false` | joined with `·` today |
| `address_line1/city/state/zip` | 1 composed column | already joined for display |
| aliases ("Also bills as") | 1 column, comma-joined | 0–n per vendor |
| `Open` button | **`rowActions`** | the record is opened, never edited in place |

**Nine columns and one row per vendor.** Today each vendor renders up to four labelled sections
stacked vertically, which is where David's five printed pages comes from.

### The one real obstacle, and it is already solved elsewhere
`preference_note` is **free prose**, and the file's own divergence declaration rests on it: *"the
row carries a free-prose `notes` field a grid cell would truncate."* That was a good reason and it
has an answer that shipped on another surface — **`renderExpand`, the G10 per-row disclosure**,
which `/receipts` uses for exactly this shape (a row that has more to say than a row can hold). The
`PREFERRED` mark and its first line stay on the row; the full note opens underneath.

**⚠️ David reversed a modal-only cut on 2026-09-04 for a reason that survives conversion intact:**
*"'who is preferred' and 'why' are ONE FACT — splitting them means she scans the list, sees a mark,
and has to open a record to learn anything."* A disclosure keeps them together **on the list**. A
Notes column with a tooltip would not, and is the wrong answer.

### What it takes
- **~9-column `DataSheetColumn[]` + `rowActions` + `renderExpand`.** No migration, no new
  permission string, no `api/` function. The read, the RLS and the editor modal are untouched.
- **Delete the declaration** in `docs/decisions/ui-standard-divergences.json`. It self-prunes: a
  declaration for a file that now imports the shared control **fails the build as stale**, so this
  is not optional tidying.
- **`undeclared_bespoke_surfaces` (baseline 23) may move** — re-measure and lock the lower number.
- **Gains for free:** G1 sticky header · G2 bounded scroll · G3 frozen name · G4 sort · G5 column
  show/hide · G6 search · G7 density · G11 order. The declaration currently answers **`dropped`** to
  all of them.
- **One decision for David, not for me:** the file's own header says the list is **alphabetical, not
  preference-first**, because *"a sort is the quiet form of a filter and the unmarked vendor IS the
  answer on the day the preferred one is out of stock."* A grid makes preferred-first one click
  away, which is the point — but the DEFAULT sort is a ruling, and G9 (newest record date first)
  does not obviously apply to a vendor. **Recommend: keep alphabetical as the default.**

**Size: one build.** The lowest-cost, highest-return of the two.

---

## 2. PMI — `packages/shared/src/modules/PMI.tsx` (881 lines)

### It is TWO card lists, not one
1. **The equipment list** (`PMI.tsx:841`) — name · year/make/model · `barcode_id` · a status chip
   (`OVERDUE` / `DUE_SOON` / OK) · interval days · days-until-due · last service date · task count.
   **Eight facts per card**, and the card is itself the click target into the detail view.
2. **The service log** (`PMI.tsx:709`) — service type · performed date · result chip · performed by ·
   cost · notes. **Six facts per card**, rendered inside the detail view.

Both are naturally grids. The equipment list in particular is a maintenance register, which is the
textbook case for sort + filter: *"show me everything overdue"* is a column sort today only by eye.

### 🔴 The blocker, and it is real — this is why PMI is a bigger job than Vendors
**`PMI.tsx` lives in `packages/shared` and is rendered by more than one vertical.** `DataSheet` has
been reachable from shared since the 2026-09-03 promotion, so the import is not the problem. The
problem is what comes with it: **`sheetStyles` carries 7 occurrences of cultivar green `#27500A`
and 1 of sage `#EAF3DE`** — an AC-4 debt the engine's own header records as *carried, not created*.
Converting PMI would put **Cultivar's palette into a module Ignition renders**, which is tech-debt
**#157** — *the per-vertical palette in `design-system/tokens.ts` has ZERO importers*, and its
blocker is the unanswered question **"how does a shared component learn which vertical it renders
in?"**

That question is David's and it is unmade. It is also not PMI's to answer: #157 is filed against
`shared`, and 8 of 42 cultivar literals live in the grid engine.

### What it takes
- **Two column configs** (~8 and ~6 columns) + `rowActions` for "Open" on the equipment list.
- **G9 applies to the service log** — default sort on `performed_at`, the date on the paper, not on
  the row's creation timestamp.
- **The status chip becomes `rowFlag` + `flagBanner` + a `statusFilter`** — the `/inventory` shape,
  and the whole reason to convert: *"3 overdue"* at the top with a filter that shows only them.
- 🔴 **Blocked on #157, or an explicit decision to accept cultivar green inside a shared module for
  now.** Either is a legitimate answer; taking it silently is not.

**Size: one build, AFTER #157 is answered — or one build plus an accepted, recorded AC-4 deviation.**

---

## Recommendation

**Vendors first, on its own, and soon.** It is unblocked, it is one build, it deletes a divergence
declaration rather than adding one, and it is the surface David actually named a page count for.

**PMI second, and not until #157 has an answer** — because converting it is the moment the palette
question stops being theoretical, and answering a platform question inside a maintenance-screen
build is the drift the pre-flight gate exists to catch.

---

*Cited by: CLAUDE.md §3 (2026-09-07, G11) · `docs/RULINGS.md` R-108 ·
`docs/decisions/ui-standard-divergences.json` → `Vendors.tsx` → clause G11.*
