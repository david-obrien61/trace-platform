# INVENTORY — FULL-SURFACE OWNER TEST

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own). Sibling of `stories.html` / `status.html`.
>
> **This file is the ONLY source of truth for inventory owner-tests.** It is STANDING, not dated —
> **run it after any inventory / count / add change.** A per-build proof is a FILTER on this board
> (`COVERS: #NNN`), never a second document. The dated `2026-07-16-inventory-count-add-owner-test.md`
> was folded in here and retired for exactly that reason: two docs answering "how do I prove the
> blank-size guard?" are two representations of one fact, and they drift (STD-011).

**Purpose:** walk every surface the inventory capability touches, so a fix verified on ONE surface
cannot hide a break on another.

**Why this exists (STD-017 scar, and it is not hypothetical — all of this is from ONE day, 2026-07-16):**
the apostrophe fix (#132) unblocked a resolver path and immediately exposed a promote that had never
run on it (#133) — **counting a variety made it permanently unscannable.** Fixing *that* exposed
three more mint paths that didn't obey its invariant (#135) — **all four minted through the UI in the
hour after the fix was proven.** `findDuplicateSizeGroups` is blind to blank-size rows, so the one
surface built to *surface* this damage could not see it. And D-49's own test suite **asserted one of
the defects as correct** — the defect was tested in and blessed.

**The pattern is always the same: the fix was right, and the surface it didn't reach was wrong.**
That is why this walks all of it.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Trustworthy. |
| `STATUS: owed` | 🟡 A test is written but has not been run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 The surface EXISTS and has NO test. **This is the annotation — it is a known hole, not an oversight.** |
| `STATUS: blocked` | ⛔ Cannot be run yet — the reason is on the card. |
| `LAST-PROVEN: never` | Nobody has ever run this against the real UI. Treat green claims about it with suspicion. |
| `DEVICE:` | `phone` (a lot-walk — **must be provable without a console**) · `desktop` · `either` |
| `COVERS:` | The ledger row / decision this check exists to defend. |
| `SIGNAL:` | The `[TRACE:*]` line. **Always secondary** — every PASS below must be visible without one. |

**PASS = every card in scope is `covered` with today's date.** A `needs-test` card is not a failure of
the run; it is a failure of the *build* that shipped that surface without a test — see OP-14.

---

## ⛔ GATE 0 — CONFIRM YOU ARE TESTING THE DEPLOYED CODE (OP-15 — owner-prove STEP ZERO)

> **This is STEP ZERO. Before the hard-refresh, before you read any screen as evidence: confirm the
> deploy for the SHA under test is live.** If the SHA you are testing is not live, **everything below
> is fiction.** (OP-15, RATIFIED 2026-07-17.)
>
> **Why this is first, and not a footnote (the #135 scar):** `313de44` — the fix this board proves —
> **never deployed. Its Vercel build FAILED**, so the server kept serving the OLD bundle, and #135
> went live ~20 hours later only as a side effect of an unrelated markdown push. **A failed deploy is
> silent** (Vercel serves last-good), and **Vercel deploys the TREE, not the COMMIT** — a green
> dashboard on a later push does not mean *your* SHA built. A stale bundle also produced phantom bugs
> 3× on 2026-07-03 and cost half a session on 2026-07-15. **Both present identically: the app is not
> what you think it is.**

- [ ] **① SHA is live.** In the Vercel dashboard, the deployment **for the exact SHA under test** reads
      **READY** — not Building, not Error, and **not a *different* SHA's** Ready. Write it here: `________`
      *(Until the SHA stamp ships — OP-15's flagged mechanical form — this is a dashboard check. Once it
      ships, GATE 0 becomes "does the app footer say the SHA?" — one glance, no dashboard.)*
- [ ] **② Hard-refresh** — Chrome/Edge `Cmd+Shift+R` · Safari `Cmd+Option+R` (iOS Safari: close the tab
      entirely and reopen — pull-to-refresh is **not** enough). Caching is **per browser**.
- [ ] **③ The new-code signal fires.** Name the build under test and the one signal only it emits, and
      see it. For the last build (#135, now proven) that was *a count with a blank Size being BLOCKED*.
      **If the old signal shows, you are on old code — stop, and record nothing.**

> **Standing (OP-15):** every owner-test board carries this GATE 0 at the top. Inventory is the only
> board today; any future board (the planned orders board included) inherits it by this rule.

---

## SETUP — do this before you walk

- [ ] **Note the starting row count** on `/inventory`: `________`
- [ ] Pick your fixtures and write down what you expect *before* you look:
      - a **stub** (qty 0, blank Size, blank Variant grp — ~103 of these, any un-counted `DISC-` row)
      - a **multi-size family** (e.g. Alley Cat Redbud Espalier — `DISC-1003` + siblings)
      - the **known twin** (Acoma Crape Myrtle — `DISC-1002` / `DISC-1002-15G`, same group, same size)
- [ ] **Know what this test WRITES.** Cards below add and fill rows. **That is expected — the catalog
      is supposed to move.** The data remediation is regenerated *after* this run, against wherever it
      settles. Do not try to hold it still.
- [ ] ⛔ **Do NOT apply `docs/decisions/2026-07-16-d49-stub-fold-remediation.sql`** — it is banner-marked
      STALE (written against 118 rows; the catalog moved 8× during the D-49 prove and its scope has grown).
- [ ] Console open **if you're at a desk**. If you're in the lot, ignore every `SIGNAL:` line — none of
      them is load-bearing for a PASS.

---

## SURFACE: resolve
_Scan → identity. The ladder: L1 plant tag → L2 SKU → L4 name token-set → L5 size-picker._

### A possessive variety resolves on the first scan
STATUS: covered
DEVICE: phone
COVERS: #132, D-45
LAST-PROVEN: 2026-07-16
SIGNAL: `[TRACE:RESOLVE] L4 name-token — … key: bashams crape myrtle party pink`
- **Do:** scan **Basham's Party Pink Crape Myrtle** (or Evey's Pride Mimosa · Summer's Tower Redbud · Hearts A'fire Redbud).
- **PASS:** resolves to the right row. The review sheet opens.
- **FAIL:** UNKNOWN — the apostrophe elide regressed.
- **Why:** the token key treated `'` as a word boundary and the 1-char filter ate the possessive `s`, so `Basham's` → `{basham}` never matched its own slug's `{bashams}`. **4 of 6 apostrophe varieties were silently unscannable in live data.** It hid because *wrapping* quotes survive either way — and every prove had been done on `'Sierra'`, which has no possessive. **The one case anybody eyeballs worked.**

### A multi-size variety fires the SIZE PICKER, not a guess
STATUS: covered
DEVICE: phone
COVERS: #72, D-45
LAST-PROVEN: 2026-07-16
- **Do:** scan **`'Sierra' Mexican Red Oak`** (2 sizes, both grouped).
- **PASS:** the size picker offers both sizes. Neither is auto-picked.
- **FAIL:** it picks one for you, or goes UNKNOWN.

### An AMBIGUOUS resolve refuses honestly and says why
STATUS: owed
DEVICE: desktop
COVERS: #135
LAST-PROVEN: never
SIGNAL: `[TRACE:RESOLVE] L4 MISS — ambiguous: 2 … candidates: [{size:"15",…},{size:"15",…}]`
- **Do:** scan **Acoma Crape Myrtle** (console needed for this one).
- **PASS:** **ONE** `L4 MISS — ambiguous` line, followed by a `candidates:` list showing **two rows with the same size `15`**. You are sent to the typed sheet.
- **FAIL:** a **second** line claiming *"no name-token match"* — there plainly were matches; that line was a lie. Or a hardcoded `(ungrouped siblings)` cause.
- **Why:** ⚠️ **Acoma is UNSCANNABLE right now and that is CORRECT.** Its twin means the picker can't tell the rows apart, so it **refuses to guess** — that refusal is the system working, and it is what surfaced this entire class. The old emit named the *wrong* cause confidently (Alley Cat's rows were all grouped; the real cause was a blank size) — **you diagnosed that yourself; the trace didn't.** It now shows candidates instead of asserting a cause.

---

## SURFACE: count-promote
_The walk-and-count loop: scan → resolve → which size + qty → save → next._

### A blank size is REFUSED 🔴
STATUS: covered
DEVICE: phone
COVERS: #135, D-49, D-34
LAST-PROVEN: 2026-07-17
SIGNAL: `[TRACE:INVENTORY] promote — REFUSED at the sheet: size-required`
- **Do:** scan a variety that already has sizes. **Leave Size EMPTY.** Enter a count. Save → Next.
- **PASS:** blocked. Size red-bordered. A message under it says why. **No row written.**
- **FAIL:** it saves *(stale bundle — see GATE 0)*, **or** a greyed button with no reason *(a silent refusal is its own defect — the owner must be told why)*.
- **Why:** you did exactly this at 17:03 and it minted `created {size: null, qty: 60}` next to 15/30/45. The re-scan went UNKNOWN. **A variety that was clean at 16:59 was broken at 17:03 — by the branch that was supposed to be the fix.**
- **✅ PROVEN 2026-07-17 (David, live) — FIXTURE: Lacey Oak, a VIRGIN STUB (no sizes, no chips at all).** Size left EMPTY, qty 5, Save → *"Which size? Pick one above or type it — a count has to say which size it counted."* Blocked, nothing written, re-scan still resolves. **The fixture is STRONGER than the card asked for:** Bur Oak has an existing size and would have nudged onto the MATCH branch; Lacey Oak has nothing to compare against — **the unconditional case, exactly where a "required only when the family has sizes" fix would have leaked, and did not.**

### A counted STUB fills in place — the row count does NOT move
STATUS: covered
DEVICE: phone
COVERS: #133, D-49, D-34
LAST-PROVEN: 2026-07-16
SIGNAL: `[TRACE:INVENTORY] promote — filled` (**not** `created`)
- **Do:** scan a stub (qty 0, no size, no group). Type a size. Enter a count. Save.
- **PASS:** **row count unchanged.** The existing row is filled and **keeps its `DISC-####` SKU**.
- **FAIL:** a second row appears beside it — the D-49 defect returning.
- **Then:** re-scan it. **PASS:** resolves. **FAIL:** UNKNOWN.

### A new size creates a sibling, SKU derived from the family BASE
STATUS: covered
DEVICE: phone
COVERS: #133, #135, D-46
LAST-PROVEN: 2026-07-16
SIGNAL: `[TRACE:INVENTORY] promote — created` with the derived `sku`
- **Do:** on a multi-size family, count a size it doesn't have (e.g. `20 gal`).
- **PASS:** one new row, SKU = **base + size** (Alley Cat → `DISC-1003-20G`). Re-scan → picker fires with **all** sizes.
- **FAIL:** SKU is compounded off a sibling (`DISC-1003-30G-20G`), or blank.

### Counting an EXISTING size updates it — never mints a duplicate
STATUS: owed
DEVICE: phone
COVERS: #124, D-45
LAST-PROVEN: never
SIGNAL: `[TRACE:INVENTORY] promote — updated`
- **Do:** count a size the variety already has. Change the number.
- **PASS:** that row's qty is **set** to your count (a count sets on-hand; it is not a decrement). **No new row.**
- **FAIL:** a second row at the same size appears (that is a CASE 5 twin, minted from the count path).

### The same (variety × size) counted twice in one session SURFACES, never silently overwrites
STATUS: owed
DEVICE: phone
COVERS: #54
LAST-PROVEN: never
- **Do:** count a size, then scan and count the **same** size again in the same session.
- **PASS:** the "Already counted this one" sheet shows first-vs-now and asks which holds. A reason box is offered.
- **FAIL:** it silently overwrites.

---

## SURFACE: typed-entry
_The "Didn't recognize this" sheet — resolve-before-create, or skip & flag._

### The typed sheet also requires a size
STATUS: owed
DEVICE: phone
COVERS: #135
LAST-PROVEN: never
- **Do:** scan something unrecognized. Type a variety name. **Leave Size empty.** Enter a count. Save.
- **PASS:** blocked, Size red-bordered, and the label reads **`Size *`** (not "Size (optional)").
- **FAIL:** it saves.
- **Why:** this is **not** "a different surface with no family to break" — it resolve-before-creates **INTO existing families**, and always groups whatever it mints. A blank size here is the same landmine, born in a different room. *(Recon finding, not a symmetry guess.)*

### "Skip & flag" still needs NO size — the rule must not over-reach
STATUS: owed
DEVICE: phone
COVERS: #135
LAST-PROVEN: never
- **Do:** from the unrecognized sheet, press **Skip & flag for later** with nothing entered.
- **PASS:** records and moves on. No size demanded.
- **FAIL:** it blocks you.
- **Why:** skip-and-flag writes no inventory row, so there is nothing for a size to describe. **This card exists to catch the fix being applied too broadly.** A guard that over-reaches is its own defect.

### A typed name resolves to an existing variety instead of orphaning a duplicate
STATUS: owed
DEVICE: phone
COVERS: #124, #61, D-45
LAST-PROVEN: never
SIGNAL: `[TRACE:INVENTORY] typed resolve-before-create — … → <matched variety>`
- **Do:** type a known variety with a different spelling / word order (e.g. `crape myrtle basham's party pink`).
- **PASS:** it resolves to the existing variety. **No new group.**
- **FAIL:** a duplicate variety is minted.

---

## SURFACE: add-size
_"+ Add size" — the manual sibling-minting path (the count's twin)._

### A size already in the group is REFUSED, and the twin is NAMED
STATUS: covered
DEVICE: desktop
COVERS: #135, #74
LAST-PROVEN: 2026-07-17
- **Do:** on **Acoma Crape Myrtle**, click **+ Add size** and type **`15`** — the size it already has.
- **PASS:** blocked. The message **names the existing row and its SKU** and says to edit that row instead. *(Either twin's SKU is a pass — it will most likely name `DISC-1002-15G`, since rows arrive newest-first. Which one it names doesn't matter; that it names one, with its SKU, does.)*
- **FAIL:** it saves → **you just minted another CASE 5 twin**. Or it refuses with no explanation.
- **Then:** type a size Acoma *doesn't* have (`30 gal`). **PASS:** saves normally — the guard refuses duplicates, not additions.
- **Why:** the editor enforced **SKU** uniqueness (`DISC-1002-15G` *is* unique → it passed) and never checked **SIZE** uniqueness. **Two different facts:** a SKU identifies one sellable UNIT; a (group, size) pair identifies one VARIANT. This is ledger #74's CASE 5 — **theoretical since 2026-06-30, minted through the UI in under a minute.**
- **✅ PROVEN 2026-07-17 (David, live) — FIXTURE: the `DISC-1003` (Alley Cat) family** (equivalent to the Acoma example — the guard is generic). "+ Add size", typed `15` (already present) → *"'15' already exists in this variety (SKU DISC-1003) — edit that row's quantity instead of adding a second one."* Blocked, NAMES the row by SKU, OFFERS the alternative — not a bare refusal. This is the input that minted Acoma's CASE 5 twin yesterday.

### Add-size from a SUFFIXED sibling does not compound the SKU
STATUS: covered
DEVICE: desktop
COVERS: #135, #127, D-46
LAST-PROVEN: 2026-07-17
- **Do:** click **+ Add size** on the **`DISC-1003-30G`** row (the *sibling*, not the base). Type `25 gal`.
- **PASS:** SKU pre-fills **`DISC-1003-25G`**, and the hint reads *"Suggested from this variety's **base SKU DISC-1003** + the size."*
- **FAIL:** it pre-fills **`DISC-1003-30G-25G`** — compounded off the row you clicked.
- **Why:** the live `DISC-1003-30G-45G` in your data. The next would have been `DISC-1003-30G-45G-15G`. **The helper was never the bug — the caller was:** the count path called the *same* helper minutes later and got `DISC-1003-60G` right.
- **✅ PROVEN 2026-07-17 (David, live) — FIXTURE: the SUFFIXED sibling `DISC-1003-30G`** (deliberately, not the base — the base would prove nothing since base == clicked row). "+ Add size", typed `25 gal`, sell 125 → minted **`DISC-1003-25G`**, NOT `DISC-1003-30G-25G`, with the hint *"Suggested from this variety's base SKU DISC-1003 + the size. No existing row's SKU is changed."* Before/after in one screenshot: yesterday's compounded `DISC-1003-30G-45G` directly above today's `DISC-1003-25G`.

### Add-size auto-groups an ungrouped parent
STATUS: covered
DEVICE: desktop
COVERS: #126, D-46
LAST-PROVEN: 2026-07-16
- **Do:** find a row with a size but **blank Variant grp**. Add a size to it.
- **PASS:** **both** rows end up sharing one group. Re-scan → the picker fires.
- **FAIL:** the parent stays ungrouped → the variety goes UNKNOWN on the next scan.

---

## SURFACE: manual-crud
_Add Item · Edit · Delete — the desk surface (STD-018: a capability ships its full entry surface)._

### A standalone item needs NO size — the rule must not over-reach
STATUS: owed
DEVICE: desktop
COVERS: #135, #126
LAST-PROVEN: never
- **Do:** **Add Item** → `Netting 6×12`. **Leave Variant group empty.** No size. Price + qty. Save.
- **PASS:** saves. No size demanded.
- **FAIL:** it demands a size.
- **Why:** netting isn't a size of anything. Size is required for rows **in a variety group** — the invariant stated exactly, not a blanket rule. **This card exists to catch over-reach.**

### Nothing is born unsellable-silently
STATUS: owed
DEVICE: desktop
COVERS: #126, D-35, D-9
LAST-PROVEN: never
- **Do:** **Add Item** with a blank sell price.
- **PASS:** blocked with a reason. **FAIL:** it saves at $0/null and the cart later refuses it with no explanation.

### The EDIT path is guarded exactly as create is
STATUS: owed
DEVICE: desktop
COVERS: #135
LAST-PROVEN: never
- **Do:** Edit a row that has a group + size. **Clear the Size** and click away.
- **PASS:** blocked, red border, message — and **the size is NOT saved** (re-open: `15` is still there).
- **FAIL:** the size is gone on re-open → a blank-size row in a family makes the whole variety unscannable.
- **Then:** change that size to one that already exists in the family. **PASS:** blocked, names the twin.
- **Known cosmetic wart, NOT a failure:** the input box stays visually empty after the refusal (edit-mode fields are uncontrolled and don't snap back). The **data** is guarded and the message says why. Worth a later polish; not worth failing.

### Every owner-editable field actually persists
STATUS: owed
DEVICE: desktop
COVERS: #127, #126
LAST-PROVEN: never
- **Do:** in the editor, change **SKU · size · variant group · location · notes · qty · price · cost · status · reorder point**. Close. Re-open.
- **PASS:** every one persisted.
- **FAIL:** any field silently reverts — *scar: the SKU edit didn't persist at all because the field was controlled and the equality guard short-circuited before the write (#127). It looked like it worked.*

### Renaming a variety renames its whole size family
STATUS: owed
DEVICE: desktop
COVERS: #126, D-46
LAST-PROVEN: never
- **Do:** rename one row of a multi-size variety.
- **PASS:** all siblings rename; a toast says how many. Re-scan still resolves.
- **FAIL:** only one renames → name-equality breaks → the family stops resolving.

### Delete is reference-aware (soft vs hard)
STATUS: needs-test
DEVICE: desktop
COVERS: #126, D-46, STD-018
LAST-PROVEN: never
- **NO TEST WRITTEN.** Delete ships soft-vs-hard behavior (referenced by orders → `status='archived'`, history intact; never-sold → hard delete) and **it has never been owner-proven.**
- **Owed:** delete a never-sold row (→ gone) and a row with order history (→ archived, order history intact, no longer sellable). Confirm-first on both.
- **Why it's flagged, not silently skipped:** deleting a referenced row is money-adjacent — the FKs are `ON DELETE SET NULL`, so a wrong delete **silently blanks a sales line rather than erroring.**

---

## SURFACE: grid
_The `/inventory` datasheet — the reconcile surface (desktop-first, per capture=mobile/reconcile=desktop)._

### A clean filtered view does NOT claim a collision is here
STATUS: covered
DEVICE: desktop
COVERS: #135
LAST-PROVEN: 2026-07-17
- **Do:** search **`alley`**.
- **PASS (either):** no banner, **OR** a banner saying the flagged rows are **elsewhere** — *"N flagged rows elsewhere … nothing on this screen is affected."*
- **FAIL:** *"N flagged rows here"* while no visible row carries ⚠️.
- ⚠️ **An "elsewhere" banner is a PASS, not a failure.** Acoma's twin is still in your data — the add-size guard refuses *new* twins; it does not clean up the old one.
- **Why:** the old banner said *"2 size collisions … edit a flagged row to fix it"* over four clean rows — **naming a real defect, in the wrong place, telling you to fix a row that wasn't on screen.** D-9 inverted: it mis-attributes a real value rather than fabricating one.
- **✅ PROVEN 2026-07-17 (David, live) — filtered to `alley` (4/123, sizes 15/30/45/60 all distinct):** *"2 flagged rows **elsewhere in your inventory** share a variant group and size — **nothing on this screen is affected.** Clear the search or status filter to see them."* The "elsewhere" branch, exactly.

### Filtering to the real collision DOES fire the banner
STATUS: covered
DEVICE: desktop
COVERS: #135
LAST-PROVEN: 2026-07-17
- **Do:** search **`acoma`**.
- **PASS:** banner fires, says **here**, and ⚠️ is on the **two rows that actually collide**.
- **FAIL:** no banner, or the icon is on the wrong rows.
- **✅ PROVEN 2026-07-17 (David, live) — via the UNFILTERED full board (123/123), NOT an `acoma` search:** *"2 flagged rows **here** — each shares a variant group and size with another row, so the scanner can't tell them apart."* The two flagged rows ARE the Acoma twin (the only collision in the data, in view because unfiltered), so every PASS condition held — banner fires · says "here" · ⚠️ on the two colliding rows. Same banner code path as the narrow `acoma` filter; David reached "here" via the full view and "elsewhere" via the `alley` filter.

### The count noun agrees with its own trace
STATUS: covered
DEVICE: desktop
COVERS: #135
LAST-PROVEN: 2026-07-17
SIGNAL: `[TRACE:invsheet] dup-size flags { collisions: 1, flaggedRows: 2, … }`
- **PASS:** the banner counts **rows** ("2 flagged rows"), matching the two ⚠️ you can see, and the trace agrees.
- **FAIL:** it says "2 collisions" — there is **one** collision involving **two** rows. **A number that disagrees with its own trace is how the next session misdiagnoses this.**
- **✅ PROVEN 2026-07-17 (David, live):** the banner read "2 flagged **rows**" — agreeing with the trace's `Array(1)` (one collision, two rows). Yesterday's copy nit ("2 size collisions") is fixed; copy and trace now count the same noun.

### Inline cell edits persist and the grid reloads
STATUS: owed
DEVICE: desktop
COVERS: #126
LAST-PROVEN: never
- **Do:** edit qty / size / location / cost / price inline on the grid.
- **PASS:** persists; the row reflects it after reload. Cost typed → confidence flips to **Confirmed**; cost cleared → **Unknown**.

### The frozen identifier column does not overlap the scrolling columns
STATUS: needs-test
DEVICE: desktop
COVERS: #104, #105, §6 r14
LAST-PROVEN: never
- **NO TEST WRITTEN.** Scroll a wide grid horizontally; the pinned Name column must reserve a real track — scrolling columns pass **behind** it, never over it. The horizontal scrollbar must be reachable **without** scrolling past every row.

---

## SURFACE: order-picker
_Where inventory is READ at checkout — the whole point of `variant_group` (STD-017: capture → persist → READ)._

### A counted size is actually sellable
STATUS: needs-test
DEVICE: either
COVERS: #124, D-45
LAST-PROVEN: never
- **NO TEST WRITTEN — and this is the highest-value hole on this board.** D-45 exists *because* counted sizes stranded in `inventory_counts` while the picker read `business_inventory`. **The count half is proven; the read half is not.**
- **Owed:** count a new size → go to checkout → **that size appears in the picker at its price**. A needs-price row must **refuse the sale**, never sell at $0 (D-9).
- **Why it's flagged:** "the count promotes" and "the picker shows it" are two surfaces. Proving the first proved nothing about the second — **that is the exact STD-017 scar this board exists for.**

---

## SURFACE: offline
_The SyncEngine — back-acre dead zones (ledger #54)._

### A count taken offline survives and syncs on reconnect
STATUS: needs-test
DEVICE: phone
COVERS: #54
LAST-PROVEN: never
- **NO TEST WRITTEN.** Airplane-mode mid-count → counts still save locally → a "waiting to sync" indicator appears → reconnect → they drain and land in `business_inventory`. **A save must never fail in a dead zone.**
- **Why it's flagged:** the lot has dead zones. This is a **shipped, load-bearing, never-proven** path.

---

## SURFACE: movement-ledger (DB layer — D-50 Layer 1)
_The append-only ledger under everything above: `business_inventory_ledger` + the 6 movement RPCs + the `audit_log` first writer. Migration `20260720_inventory_movement_ledger.sql` (SHA `2caeac7`), ledger #140._

> **⚠️ THESE CARDS PROVE THE DATABASE, NOT THE APP.** Layer 1 is live and proven; **the ten app-side
> callers are UNCHANGED** — the count loop, the desk grid, and the editor still write qty the old way
> and do NOT yet route through these RPCs. So a green board here does **not** mean the count is a
> reconcile yet. **The `count-promote` / `manual-crud` / `grid` cards above stay as they are** — the
> SET→reconcile rewrite is **Layer 2**, and until it ships, `InventoryCount.tsx:612-614`'s live
> *"count record SKIPPED … inventory already updated"* warning still stands.
>
> **GATE 0 does not apply to these cards** — they are run at a postgres prompt against the live DB,
> not through a deployed bundle. The apply-state of the migration is the equivalent check.

### The ledger table exists with the right shape and FKs
STATUS: covered
DEVICE: postgres
COVERS: #140, D-50
LAST-PROVEN: 2026-07-20
SIGNAL: V1 in the migration footer
- **Do:** run V1 — `information_schema.columns` for `business_inventory_ledger`, then `pg_constraint` for the FKs.
- **PASS:** 11 columns as specified; `business_id` → **CASCADE**, `inventory_id` → **SET NULL**.
- **Why SET NULL matters:** **history outlives the row.** A movement fact must survive even when its lot does not.
- **✅ PROVEN 2026-07-20 (David, live at postgres):** schema exact, both FK behaviours confirmed.

### UPDATE and DELETE are REFUSED — even for `postgres` 🔴
STATUS: covered
DEVICE: postgres
COVERS: #140, D-50
LAST-PROVEN: 2026-07-20
SIGNAL: `ERROR: business_inventory_ledger is append-only: UPDATE is not permitted`
- **Do:** run V2 — INSERT a probe row, then try to UPDATE it, then try to DELETE it.
- **PASS:** INSERT succeeds; **both** UPDATE and DELETE raise.
- **FAIL:** either one succeeds — the ledger is then a convention, not a guarantee.
- **Why:** D-50's whole claim is that immutability is a **DB guarantee**, not an app rule. *"A 'let owners fix a bad row' button is rejected by the database."* This defends against **our own future code**, which is why it must hold for `postgres` too.
- **✅ PROVEN 2026-07-20 (David, live):** INSERT ok; UPDATE **and** DELETE both rejected by `reject_inventory_ledger_mutation` — **and the trigger fired for `postgres`**, which is the strong form of the claim.
- **⚠️ The V2 probe row is PERMANENT and intentional.** Removing it would require exactly the power this table denies. Zero-delta, NULL `inventory_id`, so it does not affect replay.

### Replay EQUALS on-hand for every lot — zero drift
STATUS: covered
DEVICE: postgres
COVERS: #140, D-50
LAST-PROVEN: 2026-07-20
SIGNAL: V3(b) returns **0 rows**
- **Do:** run V3(a) then V3(b) — one `opening_balance` per lot; then `qty` vs `SUM(delta)` per lot.
- **PASS:** V3(a) 0 exceptions; **V3(b) 0 rows.**
- **FAIL:** **any row returned is a BUG, not shrinkage** (D-50 disagreement #1). Do not proceed to Layer 2.
- **Why:** on-hand and replay state the same fact. Same-transaction emission is supposed to make a gap *structurally impossible* — this is the check that says whether it actually is.
- **✅ PROVEN 2026-07-20 (David, live):** **126 lots / 126 genesis rows**, exactly one each; `qty == SUM(delta)` across every lot, **zero drift**.

### RLS is scoped, FOR ALL, and never `USING(true)`
STATUS: covered
DEVICE: postgres
COVERS: #140, D-50, AC-2, AC-3
LAST-PROVEN: 2026-07-20
SIGNAL: V4 — 2 policies, both `cmd = ALL`
- **Do:** run V4 — `pg_class.relrowsecurity`, then `pg_policies`.
- **PASS:** RLS on; exactly 2 policies (`owner_all`, `member_all`); both **FOR ALL** so **SELECT is covered**; neither `qual` is `true`.
- **Why FOR ALL:** Layer 2's reconcile reader must not hit the **missing-SELECT-policy trap** — which has bitten this platform **three times** (modules, nursery_modules, orders).
- **✅ PROVEN 2026-07-20 (David, live):** both policies present, FOR ALL, business_id-scoped, no `USING(true)`.

### Each RPC moves qty AND lands a ledger row — and refuses a forged or foreign actor
STATUS: covered
DEVICE: postgres
COVERS: #140, D-50, AC-3
LAST-PROVEN: 2026-07-20
SIGNAL: V5 — `applied=true` + a matching ledger row per call
- **Do:** run V5 — owner adjust; a real active **member**; then an all-zero uuid; then the **legacy 3-named-arg** `adjust_inventory_qty` call.
- **PASS:** qty moves **and** a ledger row appears for each; the bogus actor **RAISES**; the legacy 3-arg call still returns `applied=true`.
- **FAIL — read carefully:** the legacy call erroring means **checkout is broken on next deploy** (the DROP-and-recreate exists precisely so a defaulted overload can't make `submit.ts`'s call ambiguous to PostgREST).
- **✅ PROVEN 2026-07-20 (David, live):** owner adjust **37→35** (ledger `delta -2`); a non-owner **MANAGER** **35→34** (`delta -1`) — so the member branch works, not just the owner one; all-zero uuid **RAISED**; **a cross-tenant actor was also correctly refused** (AC-3 — found the hard way when a test run used a uid owning a *different* business).

### Delete TOMBSTONES the lot and writes BOTH a ledger row and an audit row
STATUS: covered
DEVICE: postgres
COVERS: #140, D-50, close-out row 19B
LAST-PROVEN: 2026-07-20
SIGNAL: V6 — row still present with `status='deleted'`; `audit_log` gains `inventory.delete`
- **Do:** run V6 — `soft_delete_inventory`, then confirm the lot row, the ledger row, and the audit row.
- **PASS:** the lot **STILL EXISTS** (`status='deleted'`, qty 0 — **no `DELETE FROM` anywhere**); a `delete_tombstone` ledger row with `delta = -prior_qty`; an `audit_log` row `inventory.delete` / `success` with the real actor.
- **FAIL:** the row is gone — history loses its anchor, and every prior ledger row for that lot is orphaned.
- **Why:** this closes the sharpest emit point in the recon (`inventoryEdit.ts:154`), which removed stock from existence with **no movement row and no tombstone**.
- **✅ PROVEN 2026-07-20 (David, live):** lot survived as a tombstone; `delete_tombstone` `delta -44`; **`audit_log` received `inventory.delete` / `success` / actor `95c1b2e9`** — the **first application-authored row** in a vault that sat **empty for 27 days**.
- **⚠️ This does NOT close close-out row 19B.** 19B names `role.factory_reset` (the writer the spine recon ranked FIRST); that one is **still owed**. The vault being non-empty and the governance writer existing are two different facts.

---

## RESULTS — fill this in

**Row count before:** `______` **Row count after:** `______` **Commit under test:** `__________`

| Surface | Card | Result | Notes |
|---|---|---|---|
| GATE 0 | Deployed-code signal fires | ⬜ PASS ⬜ FAIL | |
| resolve | Possessive variety resolves | ⬜ PASS ⬜ FAIL | |
| resolve | Multi-size fires the picker | ⬜ PASS ⬜ FAIL | |
| resolve | AMBIGUOUS refuses honestly, one emit | ⬜ PASS ⬜ FAIL | |
| count | **Blank size REFUSED** 🔴 | ⬜ PASS ⬜ FAIL | |
| count | Stub fills, row count unchanged | ⬜ PASS ⬜ FAIL | |
| count | New size → SKU from base | ⬜ PASS ⬜ FAIL | SKU seen: `________` |
| count | Existing size updates, no dup | ⬜ PASS ⬜ FAIL | |
| count | Same size twice → surfaced | ⬜ PASS ⬜ FAIL | |
| typed | Typed sheet requires a size | ⬜ PASS ⬜ FAIL | |
| typed | Skip & flag needs NO size | ⬜ PASS ⬜ FAIL | |
| typed | Typed name resolves, no orphan | ⬜ PASS ⬜ FAIL | |
| add-size | Dup size REFUSED + names twin | ⬜ PASS ⬜ FAIL | |
| add-size | Suffixed sibling → no compound | ⬜ PASS ⬜ FAIL | SKU seen: `________` |
| add-size | Auto-groups an ungrouped parent | ⬜ PASS ⬜ FAIL | |
| manual | Standalone item needs NO size | ⬜ PASS ⬜ FAIL | |
| manual | Nothing born unsellable | ⬜ PASS ⬜ FAIL | |
| manual | Edit path guarded | ⬜ PASS ⬜ FAIL | |
| manual | Every field persists | ⬜ PASS ⬜ FAIL | |
| manual | Rename hits the whole family | ⬜ PASS ⬜ FAIL | |
| grid | Clean filter → no "here" banner | ⬜ PASS ⬜ FAIL | |
| grid | Acoma filter → banner + right rows | ⬜ PASS ⬜ FAIL | |
| grid | Count noun agrees with trace | ⬜ PASS ⬜ FAIL | |
| grid | Inline edits persist | ⬜ PASS ⬜ FAIL | |

**Not run (no test written — OP-14 debt):** delete soft/hard · frozen column · **order-picker read** · offline sync.

---

## WHAT TO SEND BACK

- The table above, filled in.
- **For any FAIL:** what you did, what you saw, `[TRACE:*]` if you have it. A screenshot beats a description.
- Row count before/after.

**If a result surprises you: re-check GATE 0 before believing it.** On 2026-07-15, four separate
false-defect reports traced to a stale bundle, a service-role SQL query (which bypasses RLS and proves
nothing), a stale schema doc, and a code-read false-positive — **none of them to the system.**

---

## KNOWN AND DELIBERATELY NOT TESTED HERE

- **tech-debt #56 — size VOCABULARY.** The catalog carries six spellings of three sizes (`15`, `30`,
  `45`, `5 gal`, `30 gal`, `45 gal`), including on `'Sierra'`. Counting **"15 gal"** against a **"15"**
  row still mints a third row. **It is not fixed. Don't test it here.** It is the last live defect in
  this family and needs its own build — unlike the others it can *merge* existing rows.
- **`findDuplicateSizeGroups` is blind to blank-size rows** — so the grid cannot flag the landmine
  class *before* it detonates. Recorded, not widened.
- **The order-paid inventory decrement (D-42)** lives on the **orders** full-surface test, not here.

---

## APPENDIX — TRACE SIGNALS WORTH WATCHING

| Signal | Tells you |
|---|---|
| `[TRACE:RESOLVE] L4 name-token` | which layer hit + the normalized `key:` the equality compared |
| `[TRACE:RESOLVE] L4 MISS — ambiguous` | the candidate rows that defeated the picker — **read their sizes/groups; that IS the cause** |
| `[TRACE:RESOLVE] L4 MISS — no name-token match` | a false-UNKNOWN: the tag was right, the key disagreed by a character (#55's class) |
| `[TRACE:INVENTORY] promote — filled` | a stub was filled in place (**D-49 working**) |
| `[TRACE:INVENTORY] promote — created` | a real sibling was minted — check its `sku` and `regrouped` count |
| `[TRACE:INVENTORY] promote — auto-grouped parent` | the family was made whole in the same pass |
| `[TRACE:INVENTORY] promote — REFUSED` | the size-required gate fired (`at the sheet` or `at the write`) |
| `[TRACE:invsheet] dup-size flags` | `collisions` vs `flaggedRows` — **the two nouns, named** |
| `[TRACE:invsheet] load ok` | the grid's own row count — *if it disagrees with a SQL probe, one of them is lying* |
| `[TRACE:COUNT] save` | what landed, on which row |
| `[TRACE:SYNC]` | the offline queue depth + drain |
