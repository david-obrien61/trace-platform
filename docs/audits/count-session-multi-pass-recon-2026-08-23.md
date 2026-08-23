# Count session — the multi-pass walk. SCOPING RECON.

**Date:** 2026-08-23 · **Branch:** main · **HEAD at close-out:** `1e4a8aa` *(recon read at `b3fa36f`; see F5)* · **Type:** RECON + ESTIMATE. **NOTHING BUILT.**
**Scope bar honoured:** no app code, no schema, no migration, no cap. ONE document. Zero diff under
`packages/`, `api/`, `supabase/` **from this session** (see F5 — the tree was already dirty on arrival).

**The customer question (Lauren, on site 2026-08-22):** she counts 3 of something, finds 6 more further
down the row, then 5 more. *"Do we manually update the number, or does it add 3+6+5 with three entries?"*

---

## 🔴 LIVE FINDINGS OUTSIDE THE TEN QUESTIONS — recorded, UNFIXED (STEP 5)

**F1 🔴 THE CONFLICT SHEET'S "first count" LABEL BECOMES FALSE AFTER THE FIRST RECOUNT — in the exact
sheet Lauren will hit twice on Wednesday.** `prevQty` reads `sessionCounts[key]` (`InventoryCount.tsx:387`),
and `commitCount` OVERWRITES that key on every save (`:564`). So on her third pass the sheet reads
**"first count 6"** — 6 was the *second* count, and the real first count (3) is not on the screen at all.
Two sites: the caption `:833` and the button `:849`. **This is §6 r18's class exactly** — a label asserting
something the state contradicts — and it lands in the one sheet whose entire job is to help a human choose
between two numbers. Filed and not fixed because MINIMUM (piece 3) rewrites this sheet's job.

**F2 🔴 `item_count` IS WRONG ON ANY SESSION CONTAINING A RECOUNT, AND IT INFLATES.** `:691` writes
`counted.length + 1`, `:702` writes `counted.length`, and `counted` gains an entry on EVERY commit
including a conflict re-save (`:565`). Lauren's walk records **`item_count: 3` for ONE item counted three
times.** It is a denormalized convenience column (`20260626:32`) with no derived consumer today — which is
why this is a finding and not a defect with a blast radius.

**F3 🔴 THE DONE SUMMARY LISTS ONE LOT THREE TIMES AS THREE ITEMS** (`:898-906`). Her walk closes with
*"3 items counted"* over three lines of the same variety at 3, 6 and 5 — which reads as a data-entry mess
rather than as one lot walked in three passes. Same root as F2, reaching a screen.

**F4 ⚠️ `'abandoned'` IS A DECLARED SESSION STATE WITH NO WRITER ANYWHERE.** `20260626:30` names the
lifecycle `in_progress | completed | abandoned`; there are **zero hits for `'abandoned'` in `packages/`**.
A walk quit by hitting back stays `in_progress` forever. Harmless today; **load-bearing the moment
reconcile filters by session**, which is #68.

**F5 ✏️ CORRECTED IN PLACE — AND THE CORRECTION IS THE MORE USEFUL FINDING. MY STEP 0 GIT SNAPSHOT WENT
STALE UNDER ME MID-RECON, AND I ALMOST FILED IT AS A DEFECT.**
**What I read at STEP 0, accurately:** HEAD `b3fa36f`, and `packages/shared/src/campaigns/generate.ts`
**modified and uncommitted on `main`** (+11/−1 — the anti-fabrication `SYSTEM_PROMPT` rewrite, i.e. the fix
§3 had recorded as *owed three sessions running*). I drafted this as a finding: *an uncommitted fix on
`main` that nothing in the process will catch.*
**What is true at close-out:** the tree is clean and HEAD is **`1e4a8aa`**. The work was **IN FLIGHT, NOT
ABANDONED** — it committed as **`c020560`** (*"fix(campaigns): TRACE never originates an unverified
claim"*) with `1e4a8aa` (owner-tests GATE 0) **while this recon was running**, and it is ledger **#197**.
🔴 **The finding that survives is the one about my own method, not about the tree: I held a point-in-time
`git status` for the length of a multi-hour recon and was one edit away from publishing a stale read as a
current defect.** That is **`RULINGS.md:133`'s class** — *a claim about state sourced from a snapshot
rather than from the authority* — arriving on **GIT STATE** instead of on migration-apply state
(tech-debt **#92**'s other face). The catalog-equivalent here is `git log`/`git status` **re-run at
write-up time**, which is what caught it. **Cheap, and it was nearly not done.**
⚠️ **One real consequence for this document:** every `file:line` below was read against the tree at
`b3fa36f`. **`c020560` touches only `packages/shared/src/campaigns/generate.ts`** — no inventory, count,
sync, reconcile or migration file — so **no line reference in this recon is affected**. Verified, not
assumed.

---

## STEP 0 — GATE

| Check | Result |
|---|---|
| `date` | Sun Aug 23 12:31 CDT 2026 — matches `memory/currentDate` |
| Branch / HEAD | `main` / **`1e4a8aa`** at close-out — ⚠️ read as `b3fa36f` at STEP 0; **the repo moved mid-recon**, see **F5** |
| Working tree | ⚠️ dirty on arrival, **clean at close-out** (the change committed as `c020560` mid-session) — see **F5** |
| `PLATFORM_STATE.md` | present |
| `npm run verify` | ✅ **exit 0** · baseline unchanged **5 / 247 / 10 / 12 / 15** · 27/27 test files, **1050 assertions** · capA PASSED |
| `api/` slots | ✅ **12 / 12** — `campaigns · customers/create · dashboard · discovery/ingest · members/invite · orders/submit · pmi/suggest · qbo-connector · qbo/invoice/cultivar · receipts/ocr · social/enable · social/generate-posts` |
| CLAUDE.md | read **IN FULL** — 707 lines, ⚠️ over its own ~600 budget |
| `docs/RULINGS.md` | read **IN FULL** — 145 lines incl. the OWED table; **row 144 carries #67/#68** |

**Session Starter confirms (the three asked for):**
1. **Last session** (2026-08-23 (5), ledger #196) — three stories added from Lauren's on-site (growing
   ladder · accumulated cost · consumable reorder). **DOCS ONLY, nothing built.** No code state to inherit.
2. **Shared modules this session needs** — none written to. Read-only across
   `@trace/shared/inventory` (`countPromote` · `stockLineResolver` · `variantGroup` · `sizeLabel`) and
   `@trace/shared/sync` (`syncEngine`).
3. **Those modules exist and are live** — `countPromote.ts` (184 lines, 54 assertions passing),
   `syncEngine.ts` (in the zero-row baseline, see Q9). Both WORKS-level; both read, neither touched.

*(Also run, being binding: **#8 story gate** — see the CONFLICT finding under STEP 1; **#9 RULINGS** — read in full.)*

---

## STEP 1 — THE STORY GATE FIRES **CONFLICT**, AND IT IS THE MOST IMPORTANT FINDING IN THIS DOCUMENT

**A written story already covers Lauren's question, and the code contradicts it.**

`user_stories.md:424` — **"Inventory — the real spoken-count spec (Billy Bob + the messy walk)"**,
`STATUS: written` · `SCOPE: vertical:cultivar` · `ARC: asset-inventory-pmi` · `MAPS-TO: 2.3` ·
`PIECES: voice_capture, catalog_accrete, name_pick_fast, inventory_count`.

Built from two real spoken walks, it states as requirements:

- **"running tallies ('4, 6, 8, 12, 16' → 16)"**
- **"self-correction (last value wins)"**
- 🔴 **"location-spanning tallies (same variety here + in the greenhouse, SUMMED)"**

**That third clause is Lauren's question, already answered on the board, as SUM.** Her three clumps down
one row are the same shape as the same variety in two places: one thing, encountered in pieces, totalled.

**The code implements the SECOND clause and refuses the third.** `InventoryCount.tsx:384-390` treats a
second entry on the same (variety × size) as a *disagreement* and forces "last value wins" through the
conflict sheet — which is exactly what the story lists as a *different* behaviour, sitting beside summation
rather than replacing it. The two behaviours are both in the story; only one is built, and the built one
is the one Lauren is not asking for.

**Per §9's story-reconciliation gate this is the CONFLICT case: STOP and surface. Surfaced here.**
The build does not need a new story written — it needs David to confirm that the `written` story's
summation clause is what governs, and then the spec cites `user_stories.md:424`.

⚠️ **Two adjacent stories are NOT the parent and are named so nobody cites the wrong one:**
`:339` *"Count the lot without paper"* (`needs-input`, the loop shape) and `:349` *"Count promotes size +
qty into inventory"* (`written`, the *different-size* case — "scan the same tag, tap 45 gal, enter 12 — a
SECOND stock row is born"). **That last one is the same gesture with the opposite meaning**, and the
platform already distinguishes them correctly: a different size is a different `countKey` and mints a
sibling; the same size is the conflict. The distinction is sound. Only the same-size branch is wrong.

---

## STEP 2 — #67 AND #68 AGAINST THE CODE

### #67 BLIND CAPTURE — ✅ **STILL TRUE. One clause needs a sharper mechanism.**

- ✅ **"`InventoryCount.tsx:438` calls `count_reconcile_inventory` AT CAPTURE"** — CONFIRMED.
  `engine.rpc({ … fn: 'count_reconcile_inventory' … })` opens at `:438`, fn named at `:440`.
- ⚠️ **"by the time the desk reconcile screen opens, book == counted and the residual is 0 by
  construction"** — **directionally right, mechanically different, and the difference matters for the
  build.** The desk screen's `Counted` column is an **EMPTY input** (`InventoryReconcile.tsx:270-279`,
  `placeholder="—"`). It never prefills the phone's number. So the residual is not arithmetically
  cancelled — **the walk is simply never presented for review at all.** Her number survives only as
  `prior` (`:165-167`), which is used to open the ledger window (`:178-186`), not as a proposal.
  **The desk cannot show the walk's variance because the walk was applied and then reduced to a marker.**
- ✅ **`blind_capture_mode` is NOT BUILT** — zero hits across every `.ts` / `.tsx` / `.sql`. It exists
  only at `user_stories.md:392` in the D-50 story's `PIECES:`, whose own `NEEDS:` asks David to
  *"confirm blind-capture ships as a per-session mode, default blind."* Still owed, still David's.

### #68 SESSION-SCOPED RECONCILE — ✅ **STILL TRUE, and one clause is now provably exact.**

- ✅ **"Works per-lot across the catalog instead"** — CONFIRMED. `:121-126` selects every non-archived
  lot; `:139-143` reads every `inventory_counts` row desc; `:165` takes the first per lot.
  **No session filter exists anywhere on the page.**
- ✅ **"`inventory_count_sessions.status` already has ONE owner in `InventoryCount.tsx`"** — CONFIRMED
  **EXACTLY, by grep across `packages/`.** Three sites, all in that one file: `:230` (insert
  `'in_progress'`), `:690` (`item_count`), `:701-703` (`'completed'`). **`InventoryReconcile.tsx` never
  reads or writes the sessions table.** So the second-writer hazard is **PROSPECTIVE — a hazard the build
  would CREATE**, not a defect standing today. That is the correct reading of #68's warning and it is
  worth stating precisely, because it means the fix is a design choice made once (see **R-C**), not a
  repair.

**Neither has moved. Both are quoted accurately by the tech-debt log. No stale-doc correction is owed.**

---

## STEP 3 — THE TEN QUESTIONS

### Q1 🔴 WHAT HAPPENS TODAY IF SHE ENTERS 3, THEN 6, THEN 5 ON THE SAME LOT IN ONE SESSION?

**She ends at 5. Not 14 — and not silently. The app stops and makes her arbitrate, twice.**

The walk, line by line:

**Entry 1 — she types 3.** `saveAndNext` `:363` → `countKey(resolved, size)` `:384` builds
`grp:<groupKey>|<size>` (`:356-359`). `sessionCounts[key]` is undefined → straight to `commitCount(…, 3)`
`:391`. `resolveCountTarget` `:406` returns `update` (exact variety × size). `engine.rpc` `:438-450` sends
`p_counted_qty: 3`. The RPC (`20260720:528-531`) computes `v_delta := 3 − v_current` and executes
`UPDATE … SET qty = 3`. `recordCount` `:553` INSERTs an `inventory_counts` row. `sessionCounts[key] = 3`
`:564`. The `counted` list gains an entry `:565`.

**Entry 2 — she types 6.** `sessionCounts[key]` is now `3`, so `:385` fires and **the save STOPS**:
`setConflict({prevQty: 3, newQty: 6})`, `phase = 'conflict'` `:387-388`. The sheet renders `:825-853`:

> **Already counted this one** — You already counted *Shoal Creek Vitex, 30 gal* this session.
> **3** *first count* → **6** *now*
> The difference could be a sale, a miscount, or a tree that moved. Which count holds?
> `[ Use the new count (6) ]`  ·  `[ Keep the first count (3) ]`

🔴 **There is no third button. There is no "add them". The sheet's own copy frames her second pass as an
anomaly to be explained — "a sale, a miscount, or a tree that moved" — when it is none of those.**

Tapping **Use the new count** → `resolveConflict('second')` `:580-588` → `commitCount(…, 6)` → RPC with
`p_counted_qty: 6` → `qty = 6`, `delta = +3`, a **second** ledger row, a **second** `inventory_counts`
row, `sessionCounts[key] = 6`, a **second** entry in `counted`.

**Entry 3 — she types 5.** Conflict again — and now reading **"first count 6"** (F1, the label is false).
Tapping through → `qty = 5`, `delta = −1`, a third ledger row, a third count row.

**FINAL STATE:** `business_inventory.qty = 5` · three `inventory_counts` rows (3, 6, 5) · three immutable
ledger rows · session summary reads *"3 items counted"* listing one variety three times (F2/F3).

**The honest characterisation:** the platform is **ASSERTION-CORRECT and WORKFLOW-WRONG.** It never adds —
the principle in the prompt is genuinely enforced (Q2) — but it models three passes over one block as
three disagreements about one number, and hands the arbitration to Lauren mid-row, twice, with copy that
tells her a tree probably moved.

### Q2 ABSOLUTE OR DELTA?

**ABSOLUTE on every capture path, enforced server-side, and the client cannot express an increment.**

- `count_reconcile_inventory(p_counted_qty int, …)` — `20260720:492`. `v_delta := p_counted_qty − v_current`
  `:528`; `UPDATE … SET qty = p_counted_qty` `:531`. **The delta is COMPUTED for the ledger, never accepted
  from the caller.**
- It refuses a negative outright: `:510-513` — `RAISE EXCEPTION 'counted qty must be >= 0 (got %) — a count
  asserts physical truth'`.
- The create branch is the same shape: `count_promote_create_inventory(p_qty)` `InventoryCount.tsx:519-529`
  — a new lot's birth quantity, absolute.
- **Both shapes exist in the platform and they are correctly separated.** `adjust_inventory_manual` IS
  delta-shaped, and it is the *reconcile-screen attribution* RPC (`reconcileMath.ts:215`, `:299`) — dead/
  loss/found. **No capture path can reach it.** That separation is exactly right and the build must keep it.

### Q3 WHAT IS A SESSION TODAY?

`inventory_count_sessions`, `20260626:27-37`:

| column | note |
|---|---|
| `id` uuid PK | |
| `business_id` uuid NOT NULL | FK `businesses`, CASCADE |
| `status` text NOT NULL DEFAULT `'in_progress'` | 🔴 **no CHECK constraint** — deliberate, AC-4 comment at `:30` |
| `counted_by` uuid | nullable, informational, **not** an FK to `auth.users` |
| `item_count` int DEFAULT 0 | denormalized (see **F2**) |
| `started_at` / `completed_at` / `created_at` / `updated_at` | `updated_at` trigger `:58-61` |

- **Lifecycle:** `in_progress → completed`. **`abandoned` is declared and never written** (**F4**).
- **Who writes `status`:** exactly one file — `InventoryCount.tsx:230` and `:701-703`. Nothing else in
  `packages/` touches the table (**#68 confirmed**).
- **Entries are ROWS UNDER A SESSION:** `inventory_counts.session_id` FK, CASCADE (`20260626:68`).

🔴 **CAN A SESSION HOLD MULTIPLE ENTRIES FOR ONE LOT? YES — structurally, and it already happens.**
There is **no unique constraint on `(session_id, inventory_id)`**; the table is append-only *by convention*
(`:99-100`) and `recordCount` `:680-683` is a plain INSERT. Every conflict re-save writes another row.

**This is the single most useful structural fact in the recon: the DATA MODEL ALREADY SUPPORTS Lauren's
three entries. What refuses them is the CLIENT. MINIMUM therefore needs no migration.**

### Q4 CAN AN ENTRY BE UNDONE?

**No path exists, in the UI or the data — and "undo" means three different things here, which is the
answer worth having.**

- **UI: nothing.** No delete or remove affordance for a count entry anywhere; the DONE screen `:898-906`
  is a read-only list. ⚠️ **The conflict sheet's "Keep the first count" is NOT an undo** — it abandons the
  *second* entry before it is written (`:574-579` returns without calling `commitCount`). The first is
  already applied and already on the ledger.
- **`inventory_counts`: DELETE is PERMITTED at the database.** Both policies (`20260626:85-97`) declare
  `USING` / `WITH CHECK` with **no `FOR` clause**, so Postgres defaults to `FOR ALL` — DELETE included.
  There is **no immutability trigger** on this table; `:99-100`'s "append-only by design" is a *convention*,
  not an enforcement. So the owner could delete a count row in the SQL editor today.
- **`business_inventory_ledger`: ABSOLUTELY NOT.** `trg_inventory_ledger_immutable` `20260720:208-210`,
  `BEFORE UPDATE OR DELETE`, `RAISE EXCEPTION '… append-only: % is not permitted (D-50 — a correction is a
  NEW row, never an edit)'` `:203`. **Ruled 2026-07-20, IMPLEMENTED** (`RULINGS.md:84`).

🔴 **So what CAN "remove that line" mean?** Only one thing that respects the ledger: **write a NEW absolute
assertion landing on the right total, leaving the wrong one on the record with its correction beside it.**
That is D-50's model and it is right. **Which means MINIMUM's "individually removable" has to mean
*remove-from-the-running-tally-BEFORE-it-is-applied*, not remove-from-the-record.** Those are different
builds — and the difference between them is precisely what blind capture buys.

### Q5 WHAT DOES THE PHONE SHOW HER WHILE SHE WALKS?

- **A tally of ENTRIES, not a sum:** `{counted.length} counted` in the header `:725`, repeated on the
  button as `Complete count ({counted.length})` `:763`.
- **No running total for the current lot. No list of what she has entered.** The `counted` array is
  rendered **only on the DONE screen** `:898-906`, after Complete.
- 🔴 **And it shows her the BOOK number before she types hers.** `openReview:341-342` prefills the qty box
  with the lot's current on-hand (`setQtyInput(sib?.qty)`), and the size chips display `{s.size} · {s.qty}`
  `:797`. **This is the exact inverse of blind capture** — the anchoring #67 exists to remove.

**Summary: during the walk she can see how many things she has counted, and what the book already believed.
She cannot see what she herself has said about the block in front of her.**

### Q6 THE RE-SCAN CASE — IS #57's CLASS CLOSED?

**Closed, by a DERIVE plus a GUARD — not luck. And #57 was a different mechanism from Lauren's, which is
the part that matters for this build.**

🔴 **#57 was ROW PROLIFERATION, not summation.** Each scan MINTED A NEW ROW; the *variety* total — the sum
across rows — climbed 114 → 118 over four scans. **Nothing ever added two numbers together.** The mechanism:

- `resolveCountTarget` (`countPromote.ts`, extracted pure, **54 assertions passing**) — a counted **STUB**
  is FILLED in place, never siblinged (`:22-30`); an **ungrouped non-stub** CREATEs *and* auto-groups the
  parent in the same pass (`:31-38`); **size is REQUIRED at the decision**, not only at the sheet (`:40-49`).
- Reinforced by the RPC's absolute SET (Q2), and by the within-session conflict guard (Q1).

🔴 **Therefore the accumulation Lauren is ASKING FOR is not the accumulation #57 was about.** #57 was the
platform *accidentally growing a total*; Lauren wants to *deliberately build one*. The prompt's principle —
a count asserts, never adds — is enforced at the **lot** level by the RPC, and **accumulating three passes
into ONE assertion before it is applied does not violate it**: the session asserts once instead of three
times. Confirmed at code level: **nothing in `count_reconcile_inventory` cares how the client arrived at
`p_counted_qty`.**

### Q7 WHAT WOULD BLIND CAPTURE ACTUALLY TOUCH?

`blind_capture_mode`: **zero hits in any `.ts` / `.tsx` / `.sql`. NOT BUILT.**

- 🔴 **The RPC(s): NOTHING NEW IS NEEDED — and this is the finding that shrinks the estimate.** Blind
  capture is the **ABSENCE** of the RPC call at capture, not a new one. `count_reconcile_inventory`
  already accepts `p_source_id` (`20260720:496` — *"the inventory_counts / session row"*), so the desk
  applier can point every applied count back at the row that captured it **with no signature change.**
  ⚠️ **One exception, and it is structural:** a brand-new variety has no lot to assert against, so
  `count_promote_create_inventory` must still fire at capture or the count has no `inventory_id` to link —
  `InventoryCount.tsx:502-514` already refuses that branch offline for exactly this reason.
- **The capture component:** `InventoryCount.tsx` — `commitCount:424-464` stops calling the RPC on the
  `update`/`fill` branches and `recordCount` becomes the only write; the prefill `:341-342` and the chip
  quantities `:797` go dark (**that IS the blindness**).
- **The reconcile surface:** `InventoryReconcile.tsx` gains the applier it has never had — today it reads
  `inventory_counts` only to derive `prior` (`:139-171`) and presents nothing (`:270-279`).
- **Where the mode lives — genuinely open, and it is a RULING (R-B).** A **business setting** survives a
  session and is one owner decision; a **session flag** is per-walk and is the story's own suggestion, and
  **it is a MIGRATION**; a **build-time switch** is not a real option because it makes the behaviour
  untestable by David.

### Q8 THE SECOND-WRITER HAZARD #68 NAMES

- **Today: ONE writer, verified by grep** (Q3). `InventoryReconcile.tsx` does not touch the sessions table.
- **Would the build repeat #71? YES, if the desk applier writes `status`.** #71's precedent is exact —
  one column, two authors, and D-42's qty-derive silently reverts D-52's manual `archived`. **The reverting
  author wins and nothing says so.**
- 🔴 **What avoids it, and it is a shape this repo has already ruled:** the applier must not write `status`
  at all. **`status` answers "did the WALK finish", and only the phone knows that. Whether the walk has
  been APPLIED is a DIFFERENT FACT and wants a DIFFERENT FIELD** — an `applied_at`, and preferably at the
  `inventory_counts` row level rather than the session level, because a per-row stamp survives a partial
  accept (**#69's class**). One author per field.
- ⚠️ **The cap will present this debt either way, so it is a choice and not a thing to remember:**
  `verify-write-paths` counts write paths **per TABLE** (`RULINGS.md:69` — *"a write path is a FILE, not a
  call site, and more than one per table fails the build unless declared"*), so a second file writing
  `inventory_count_sessions` **FAILS the build unless declared**, whichever column it writes.

### Q9 ZERO-ROW WRITES ON THIS PATH (E5)

**Split — and the split is the useful part.**

- ✅ **The RPC path IS protected, server-side, and the client actually reads the refusal.**
  `count_reconcile_inventory:518-526` takes `SELECT … FOR UPDATE` and returns
  `applied = false, reason = 'lot_not_found'` when the lot is gone. `syncEngine.ts:210-214` checks
  `row.applied === false` and converts it to a failure, with a comment naming this exact hazard:
  *"A movement RPC can succeed at the transport level and still REFUSE at the domain level … surface it
  rather than dropping the op silently, which would look exactly like a successful count."*
  **So a count against a vanished lot does NOT silently land nowhere. This is the strongest part of the
  current build and it is worth saying plainly.**
- ⚠️ **The plain-update path is NOT checked — and it is KNOWN, BASELINED DEBT, not a new finding.**
  `syncEngine.ts:219` — `const { error } = await this.supabase.from(op.table).update(p.set).match(p.match);`
  — inspects only `error`. It is in `zero-row-writes-baseline.json:82` as
  `packages/shared/src/sync/syncEngine.ts::p#?.update`. **Three writes on this path ride it:** the
  `variant_group` backfill (`InventoryCount.tsx:456-463`), the `item_count` bump (`:689-693`), and the
  `completed` flip (`:700-704`).
- 🔴 **What that costs Lauren, concretely:** the `variant_group` backfill is the one that matters — the
  code itself says it is what makes the size-picker fire next time (`:453-455`). **If it matches zero rows
  it reports success, and the family goes UNKNOWN on the next scan with nothing said** — #57's destination
  by a different road. The only thing standing between that and a real defect is that the RPC on the same
  row succeeded one line earlier.
- **Latency, honestly:** under owner-only RLS this is largely theoretical today. **It goes live the moment
  a MANAGER counts — which is the demo persona.**

### Q10 WHAT DOES RECONCILE COMPARE TODAY?

- **Per lot, across the whole catalog** (`:121-126`, `:139-143`, `:165-167`). No session filter (**#68**).
- ✅ **The arithmetic is genuinely good and is not the problem.** `expected` is a **FULL LEDGER REPLAY**,
  not prior-minus-sales (`reconcileMath.ts:16-31`, which documents why the spec's version was wrong), and
  it computes `bookAgreesWithReplay` and **surfaces** disagreement rather than averaging it away.
- 🔴 **Can the desk screen show a real variance? YES — but never for the WALK.** The `Counted` column is an
  empty input she types into at the desk (`:270-279`). So it produces a real residual for a **desk-typed**
  number against a book **the phone already moved.** What it structurally cannot do is show the variance
  the walk found.
- **Plainly: the residual is real, and it is measuring the wrong count.** It measures a second count
  against a book the first count already overwrote. **The screen is a desk-count tool wearing a reconcile
  screen's name.** ✏️ And it is not a silent fall-through — `MathCell:408` honestly prints *"counted
  before"* for a lot with a prior count and no desk entry, which is an accurate statement of *"I have
  nothing to compare."*

---

## STEP 4 — THE ESTIMATE

*Unit = one focused Thunder build prompt.*

### MINIMUM — Lauren's walk gives 14, and she can remove a mis-entered line

| # | Piece | Touches | Migration | Ruling | Size |
|---|---|---|---|---|---|
| 1 | **Per-lot session tally** — `sessionCounts` becomes `key → entry[]`; the review sheet shows a running total + the entry list + a remove control; a save ADDS instead of firing the conflict sheet | `InventoryCount.tsx` | **no** | no | **~1.5** |
| 2 | **One absolute assertion per lot per session** — the RPC fires with the TOTAL | `InventoryCount.tsx` | **no** | 🔴 **R-A** | **~0.5** |
| 3 | **The conflict sheet's new job** — from *"which number wins"* to *"already counted this session — add to it, or replace it?"*; includes **F1**'s label | `InventoryCount.tsx` | **no** | no | **~0.5** |
| 4 | **Owner-test cards (OP-14, binding)** — count cards on the changed surfaces flip `covered → owed`; new cards for the tally, the remove, and re-scan-after-total. `DEVICE: phone`, provable with no console | `docs/owner-tests/inventory-…` | **no** | no | **~0.5** |

**MINIMUM ≈ 3 prompts · ZERO migrations · ONE ruling (R-A).**

🔴 **What MINIMUM LEAVES BROKEN — stated, not buried:**
- **The count still applies itself.** #67 untouched: the desk still has nothing to review and the residual
  still measures the wrong count (Q10).
- **"Remove a line" only means remove-before-apply, on this phone, in this session.** `sessionCounts` is
  React state (`:175`) — **a session resumed after a phone lock has forgotten her three passes**, and the
  only surviving record is N rows in `inventory_counts` with no notion of being siblings.
- **A second walk starts the tally over** — correct, but nothing on screen says so.
- **F2/F3's over-count survives** unless piece 1 also redefines what an "item" is.

### COHERENT — #67 and #68 landed together, as they were designed to be

*Everything in MINIMUM, plus:*

| # | Piece | Touches | Migration | Ruling | Size |
|---|---|---|---|---|---|
| 5 | **Blind capture as a mode** — prefill dark, no RPC on update/fill, `recordCount` is the capture write; the create branch keeps its RPC (Q7) | `InventoryCount.tsx` | **only if a session column** | 🔴 **R-B** | **~1.5** |
| 6 | **The tally's durable home** — entries move from React state into `inventory_counts` rows that know they are siblings, so a resumed session still has them (this is what makes "remove a line" survive a phone lock) | `InventoryCount.tsx`, schema | 🔴 **yes** | with R-B | **~1 + migration** |
| 7 | **Session-scoped reconcile** — the desk filters to ONE session and presents each lot's session TOTAL as the proposed counted number (the thing the empty input should always have been) | `InventoryReconcile.tsx`, `reconcileMath.ts` | no | — | **~2** |
| 8 | **The applier, without a second author on `status`** (Q8) — a new field, one writer each; `verify-write-paths` declaration | schema, `InventoryReconcile.tsx` | 🔴 **yes** *(can share 6's file)* | 🔴 **R-C** | **~1** |
| 9 | **Owner-test cards** for the desk half + a regression card: *the walk's number is what the desk proposes* | `docs/owner-tests/` | no | no | **~0.5** |

**COHERENT ≈ 6–7 prompts beyond MINIMUM (~9–10 all-in) · 1–2 migrations · TWO further rulings (R-B, R-C).**

### COMPLETE — + what the recon surfaced that neither covers

| # | Piece | Migration | Ruling | Size |
|---|---|---|---|---|
| 10 | **#69 partial-accept durability** — 2–4 sequential RPCs per accept, each atomic, **the sequence is not**, and append-only means no rollback. **Session-scoped accept makes this WORSE by multiplying steps per accept.** Durable fix = ONE RPC taking the plan as `jsonb` | 🔴 **yes** | **R-D** *(already open)* | **~1.5** |
| 11 | **The `variant_group` zero-row write** (Q9) — the one unchecked write here whose silent failure has a real consequence. **Shrinks `zero-row-writes-baseline.json` rather than growing it** | no | no | **~0.5** |
| 12 | **`'abandoned'` gets a writer** (**F4**) — required once reconcile filters by session, or an eternal `in_progress` walk sits atop the desk list forever | no | no | **~0.5** |
| 13 | **F1 / F2 / F3** — the false label and the two over-counts *(largely absorbed if MINIMUM piece 3 does it)* | no | no | **~0.5** |
| 14 | ⚠️ **#71's lifecycle field — NOT this build, named because COHERENT piece 8 walks straight past it.** A `status` column with two authors is the precedent the applier must not repeat; fixing #71 itself is its own migration and David has already ruled it logged-not-fixed | — | — | — |

**COMPLETE ≈ 3 prompts beyond COHERENT (~12–13 all-in) · 2–3 migrations · THREE rulings.**

---

## RULINGS OWED BEFORE ANY OF IT STARTS

**R-A — blocks MINIMUM. 🔴 WHEN THREE PASSES MAKE ONE COUNT, WHAT DOES THE LEDGER GET: ONE ROW OF 14, OR
THREE ROWS OF 3 / 9 / 14?**
One row is the honest reading — *the session asserted once* — but it discards that she walked it in three
passes. Three rows put two assertions on an **immutable** log that were **never physically true at the
moment they are dated** (#70's genesis-row shape, arriving through a UI instead of a backfill). **This is a
D-50 question, not a UI question, and the log cannot be corrected afterwards.**
✏️ **Thunder's read, offered not taken:** ONE ledger row of 14, with the three passes living in
`inventory_counts` where pass detail belongs — **the ledger records what MOVED, the count record records
how she got there.** But it is David's, and MINIMUM cannot start without it.

**R-B — blocks COHERENT. 🔴 WHERE DOES BLIND-CAPTURE MODE LIVE — A BUSINESS SETTING, A SESSION FLAG, OR
ALWAYS-BLIND?**
The D-50 story asks for *"a per-session mode, default blind"* — **that is a suggestion in a `NEEDS:` tag,
not a ruling.** A session flag is a MIGRATION; a business setting may not be; always-blind is cheapest and
forecloses the walk-with-the-book-visible case Lauren may genuinely want on a spot-check.
🔴 **The prefill at `:341-342` is the thing actually being decided** — it is either an anchoring bug or a
feature, and nobody has ever said which.

**R-C — blocks COHERENT. 🔴 DOES THE DESK APPLIER WRITE `inventory_count_sessions.status`, OR A NEW FIELD?**
**#71 is the live precedent for what happens when two authors share one lifecycle column.** A new field
keeps one author per field and costs a column; reusing `status` costs nothing today and repeats a defect
this repo has already paid for once. `verify-write-paths` presents the debt either way (`RULINGS.md:69`),
so the question is **which debt**, not whether.

**R-D — COMPLETE, and already on the OWED table. #69's partial accept:** is ONE `jsonb` RPC worth a
migration, or does the step-naming mitigation stand? **Session-scoped accept is what makes it press.**

### WHAT DAVID MUST APPLY

| Scope | Migrations |
|---|---|
| **MINIMUM** | 🟢 **NONE** |
| **COHERENT** | **1–2** — the count/session grouping (piece 6) and the applier's field (piece 8); these can be ONE file |
| **COMPLETE** | **+1** — #69's `jsonb` accept RPC |

---

## STEP 6 — HAVE / NEED / WANT (OP-8)

### HAVE
- An **absolute-assertion capture path that is correct at the lot level and enforced server-side**
  (`20260720:528-531`), with a real concurrency lock (`:518-521`) and an honest domain refusal the client
  actually reads (`syncEngine.ts:210-214`).
- A within-session duplicate **GUARD that stops rather than guesses** (`InventoryCount.tsx:384-390`) — the
  right instinct, aimed at the wrong scenario.
- A **data model that already permits many entries per lot per session** (`20260626:66-81`, no unique
  constraint) — **MINIMUM needs no schema.**
- A desk reconcile screen with **correct arithmetic** (`reconcileMath.ts:16-38`) and **nothing to point it
  at**.
- An **immutable ledger** (`20260720:203-210`) that makes "undo" mean "assert again" — correctly.
- 🔴 A **written story that already answers the customer's question** (`user_stories.md:424`), and code
  that contradicts it.

### NEED — the irreducible minimum to answer Lauren, no preference
The session **accumulates** and **asserts once** per lot: a per-lot entry list in the capture sheet, a
visible running total, a remove control, and **one** RPC call carrying the total.
**`InventoryCount.tsx` only · ~3 prompts · zero migrations · one ruling (R-A).**

### WANT — labeled as want
Blind capture **+** session-scoped reconcile, so the walk becomes a **PROPOSAL the desk reviews as a unit**
and the residual finally measures the count that was actually taken — with the tally durable across a phone
lock, one author per lifecycle field, and the accept atomic.
**~12–13 prompts all-in · 2–3 migrations · three rulings.**

---

## THE ANSWER DAVID CAN SAY TO LAUREN ON WEDNESDAY

> **"Right now it does neither — when you enter the second number it stops and asks which count is right,
> and whichever you pick replaces the other, so you'd finish on 5. It will never add them up behind your
> back. Making it total 3 + 6 + 5 into one count of 14, with the three entries listed so you can drop one
> if you double-counted a clump, is a build — and we've scoped it."**

---

*Recon 2026-08-23 · ledger #198 · Thunder · NOTHING BUILT · `npm run verify` exit 0 · api/ 12/12*
