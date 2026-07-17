# OWNER TEST — Inventory · Count · Add (2026-07-16)

**Tests:** ledger **#135** (`313de44`) — the four defects minted through the UI today — plus regression controls on **D-49** (`92136b3`) and **#55** (`d99e829`), which are already owner-proven and **must not have moved**.

**Time:** ~20 minutes. **Devices:** a phone with a camera (tests A) + a desktop (tests B, C).
**You do not need a console.** Every PASS below is something you can SEE. Console lines are listed as *secondary* confirmation only — skip them if you're in the lot.

**Home:** `docs/CLOSE-OUT-LEDGER.md` row #135 · `CLAUDE.md` §3 (2026-07-16, first entry).
**Convention note:** this is the first doc in `docs/owner-tests/`. If it earns its keep, that's the home for owner-prove scripts — the ledger says *whether* a thing is closed; this says *how you close it*.

---

## ⛔ GATE 0 — DO THIS FIRST. Do not skip it. Do not declare pass/fail before it passes.

**Committed ≠ live.** This exact check exists because a stale cached bundle produced phantom bugs three times on 2026-07-03 and again on #128/#129.

1. Confirm the Vercel deploy for `313de44` is **READY** (not Building, not Error).
2. **Hard-refresh** the app (iOS Safari: close the tab entirely and reopen — a pull-to-refresh is not enough).
3. **The new-code signal:** start a count, scan any variety, **clear the Size box**, type a number in the count box, and press **Save → Next**.
   - **You should be BLOCKED**, with the Size box **red-bordered** and a message under it.
   - **If it SAVES, you are on OLD CODE.** Stop. Re-deploy or clear the cache. **Do not record any result below** — everything after this depends on running the new bundle.

> **Why this is the signal:** a blank-size save succeeding *is* defect 1. It is the one behavior only this build changes, and it needs no console to see.

---

## ⚠️ Before you start — two honest notes

**1. These tests WRITE to your live catalog.** Tests A2, A3, and B2 each add or fill a row. That is expected and fine — **the data remediation is regenerated AFTER this test, against whatever the catalog settles at.** Note your row count before and after; don't try to keep it still.

**2. ⛔ DO NOT APPLY `docs/decisions/2026-07-16-d49-stub-fold-remediation.sql`.** It is stale (written against 118 rows; you're at ~123 and it moved 8× during the D-49 prove) and its scope has grown. The file is banner-marked ⛔ STALE. It gets rewritten after this test passes.

**Record your starting row count from `/inventory`:** `________`

---

## A — COUNT (phone, `/inventory/count`)

### A1 · Blank size is BLOCKED 🔴 *the RED one — this is the defect that broke a working variety*

1. Start a count. Scan **any variety that already has sizes** (e.g. Alley Cat Redbud Espalier).
2. **Leave the Size box EMPTY.** Enter any number in the count box. Press **Save → Next**.

- ✅ **PASS:** blocked. Size box red-bordered. A message under it says which size it needs. **No row is written.**
- ❌ **FAIL:** it saves (→ you're on a stale bundle, see Gate 0), *or* the button is greyed with no reason given (a silent refusal is its own defect — the owner must be told **why**).
- *Secondary (console):* `[TRACE:INVENTORY] promote — REFUSED at the sheet: size-required`

> **What this caught:** you did exactly this at 17:03 today and it minted `created {size: null, qty: 60}` next to 15/30/45. The re-scan then went UNKNOWN. **A variety that was clean at 16:59 was broken at 17:03.**

### A2 · A new size creates a sibling, and its SKU comes from the PARENT

1. Same variety. Type a size that **doesn't exist yet** on it (e.g. `20 gal`). Enter a count. Save.
2. Go to `/inventory`, find the new row.

- ✅ **PASS:** one new row. Its SKU is the family's **base + the size** — for Alley Cat: **`DISC-1003-20G`**.
- ❌ **FAIL:** the SKU is `DISC-1003-30G-20G` or `DISC-1003-30G-45G-20G` (compounded off a sibling), or the SKU is blank.
- *Secondary:* `[TRACE:INVENTORY] promote — created` with the derived `sku`.

3. **Re-scan the same variety.** ✅ **PASS:** the **size picker fires** and shows **all** its sizes including the new one. ❌ **FAIL:** UNKNOWN, or the picker doesn't appear.

### A3 · A stub still FILLS in place *(D-49 regression — already proven, must not move)*

1. On `/inventory`, find a variety with **qty 0, blank Size, blank Variant grp** (there are ~103 of these — any un-counted `DISC-` row).
2. Scan it. Type a size. Enter a count. Save.

- ✅ **PASS:** **the row count does not increase.** The existing row is filled — it keeps its `DISC-####` SKU, and now has your size and qty.
- ❌ **FAIL:** a second row appears next to it (that's the D-49 defect returning).
- *Secondary:* `[TRACE:INVENTORY] promote — filled` (**not** `created`).

3. **Re-scan it.** ✅ **PASS:** resolves. ❌ **FAIL:** UNKNOWN.

### A4 · The typed "Didn't recognize this" sheet also requires a size *(new today)*

1. Scan something unrecognized (or any tag that misses). The **"Didn't recognize this"** sheet opens.
2. Type a variety name. **Leave Size empty.** Enter a count. Press **Save → Next**.

- ✅ **PASS:** blocked, Size red-bordered, and the label reads **`Size *`** (not "Size (optional)").
- ❌ **FAIL:** it saves.

> **Why this sheet too:** it resolves a typed name **into existing families**, and always groups whatever it mints — so a blank size here is the same landmine, born in a different room. This was a recon finding, not a symmetry guess.

### A5 · "Skip & flag" still needs NO size *(this must NOT have been over-tightened)*

1. From the same unrecognized sheet, press **Skip & flag for later** without entering anything.

- ✅ **PASS:** it records and moves on. **No size demanded.**
- ❌ **FAIL:** it blocks you.

> **Why:** skip-and-flag writes no inventory row, so there is nothing for a size to describe. If this blocks, the rule was applied too broadly.

---

## B — ADD / EDIT (desktop, `/inventory`)

### B1 · "+ Add size" refuses a size already in the group *(and tells you what to do instead)*

1. Find **Acoma Crape Myrtle** (`DISC-1002`, size `15`). Click **+ Add size** on it.
2. Type size **`15`** — the size it already has. Fill in a sell price. Press **Save size**.

- ✅ **PASS:** blocked. Size red-bordered. The message **names the existing row and its SKU** and tells you to edit that row instead — *"15" already exists in this variety (SKU `DISC-…`) — edit that row's quantity instead of adding a second one.*
- ❌ **FAIL:** it saves (→ you just minted another CASE 5 twin), or it refuses with no explanation.

> **Either twin's SKU is a PASS** — it will most likely name **`DISC-1002-15G`** (rows arrive newest-first, so the guard hits the newer twin). *Which* one it names doesn't matter; that it names one, with its SKU, does.

> **What this caught:** you minted `DISC-1002-15G` beside `DISC-1002` at the same size today, in under a minute. The editor guarded **SKU** uniqueness (`DISC-1002-15G` *is* unique, so it passed) and never guarded **SIZE** uniqueness. **Two different facts.** That pair is ledger #74's CASE 5 — theoretical since 2026-06-30 until today.

3. Now type a size Acoma **doesn't** have (e.g. `30 gal`). ✅ **PASS:** it saves normally. *(The guard refuses duplicates, not additions.)*

### B2 · "+ Add size" from a SUFFIXED sibling does not compound the SKU

1. Find **Alley Cat Redbud Espalier**, and click **+ Add size** specifically on the **`DISC-1003-30G`** row (the *sibling*, not the base).
2. Type a new size, e.g. `25 gal`.

- ✅ **PASS:** the SKU field pre-fills **`DISC-1003-25G`**, and the hint below reads *"Suggested from this variety's **base SKU DISC-1003** + the size"*.
- ❌ **FAIL:** it pre-fills **`DISC-1003-30G-25G`** (compounded off the row you clicked — the old behavior).

> **What this caught:** the live `DISC-1003-30G-45G` in your data. The next one would have been `DISC-1003-30G-45G-15G`. The helper was never the bug — the *caller* was: the count path called that same helper minutes later and got `DISC-1003-60G` right.

### B3 · A standalone item still needs NO size *(must NOT have been over-tightened)*

1. Click **Add Item**. Name it something like `Netting 6×12`. **Leave Variant group empty.** Leave Size empty. Give it a sell price and qty. Save.

- ✅ **PASS:** it saves. No size demanded. The hint under Size &amp; grouping says standalone items need no size.
- ❌ **FAIL:** it demands a size.

> **Why:** netting isn't a size of anything. Size is required for rows **in a variety group** — that's the invariant stated exactly, not a blanket rule.

### B4 · The EDIT path is guarded too

1. Open **Edit** on any row that **has a variant group and a size** (e.g. Alley Cat's `15`).
2. **Clear the Size field** and click away (edit mode auto-saves on blur).

- ✅ **PASS:** blocked, red border, message — and **the size is NOT saved**. Close and re-open the editor: **`15` is still there.**
- ❌ **FAIL:** the size is gone when you re-open — that leaves a blank-size row in a family, which makes the whole variety unscannable.

> **Known cosmetic wart, not a failure:** the input box itself stays visually empty after the refusal (edit-mode fields are uncontrolled — they don't snap back). The **data** is what's guarded; the message tells you why, and re-opening shows the true value. Worth a later polish pass; not worth failing the test over.

3. Now change that size to **another size that already exists in the same family** (e.g. change `15` → `30`). ✅ **PASS:** blocked, names the twin. ❌ **FAIL:** it saves.

---

## C — THE GRID BANNER (desktop, `/inventory`)

### C1 · A clean filtered view does NOT claim a collision is here

1. In the search box, type **`alley`**.

- ✅ **PASS (two acceptable outcomes):**
  - **No banner at all**, **OR**
  - a banner that says the flagged rows are **elsewhere** — e.g. *"2 flagged rows **elsewhere** in your inventory share a variant group and size — nothing on this screen is affected. Clear the search or status filter to see them."*
- ❌ **FAIL:** a banner saying **"N flagged rows here"** while none of the visible rows carries the ⚠️ icon.

> ⚠️ **An "elsewhere" banner is a PASS, not a failure.** Acoma's twin is **still in your data** (B1 refuses new ones; it does not clean up old ones). The old banner said *"2 size collisions … edit a flagged row to fix it"* over four clean Alley Cat rows — **naming a real defect, in the wrong place, and telling you to fix a row that wasn't on screen.**

### C2 · Filtering to the real collision DOES fire the banner

1. Clear the search. Type **`acoma`**.

- ✅ **PASS:** the banner fires, says the flagged rows are **here**, and the ⚠️ icon is on the **two rows that actually collide** (`DISC-1002` and `DISC-1002-15G`).
- ❌ **FAIL:** no banner, or the icon is on the wrong rows.

### C3 · The count noun agrees with itself

- ✅ **PASS:** the banner counts **rows** ("2 flagged rows"), matching the two ⚠️ icons you can see.
- ❌ **FAIL:** it says "2 collisions" (there is **one** collision, involving **two** rows — the old copy counted rows and called them collisions).

---

## D — REGRESSION CONTROLS *(already owner-proven — these must not have moved)*

| # | Check | ✅ PASS |
|---|---|---|
| D1 | Scan **`'Sierra' Mexican Red Oak`** (demo variety, 2 sizes) | Size picker fires with both sizes. Both resolve. |
| D2 | Scan **Basham's Party Pink Crape Myrtle** (or any of the 4 possessive varieties) | Resolves at first scan — **not** UNKNOWN (#55 holding). |
| D3 | **Scan Acoma Crape Myrtle** *(console — skip if you're in the lot)* | **ONE** `[TRACE:RESOLVE] L4 MISS — ambiguous: 2 …` line, followed by a `candidates:` list showing **two rows with the same size `15`**. **No second line claiming "no name-token match"** — that line was a lie firing right after it. |

> **Why Acoma is the right D3 target — and a thing to know:** **Acoma is UNSCANNABLE right now**, and that is *correct behavior*, not a new bug. Its twin (`DISC-1002` / `DISC-1002-15G`, same group, same size) means the size-picker can't tell the two rows apart, so it **refuses to guess** and sends you to the typed sheet. That refusal is the system working — **it is what surfaced this whole class of defect.** B1 stops you minting *new* twins; it does not clean up the one already there. The regenerated remediation does that.
>
> **What you're checking is the honesty of the trace, not the refusal.** The old emit fired *two* lines — "2 equal-token rows", then "no name-token match" — **and the second was false; there plainly were matches.** It also appended a hardcoded `(ungrouped siblings)` to every ambiguous miss. For Alley Cat, whose four rows were **all grouped**, that was simply wrong — the real cause was a blank size, and **you worked that out yourself; the trace didn't tell you.** It now **shows the candidates** and lets you see the cause instead of asserting one.

---

## RESULTS — fill this in

**Row count before:** `______` **Row count after:** `______`

| Test | What | Result | Notes |
|---|---|---|---|
| **Gate 0** | Blank-size save is blocked (new-code signal) | ⬜ PASS ⬜ FAIL | |
| A1 | Blank size BLOCKED with a visible reason 🔴 | ⬜ PASS ⬜ FAIL | |
| A2 | New size → sibling, SKU from **parent** base | ⬜ PASS ⬜ FAIL | SKU seen: `__________` |
| A2b | Re-scan → picker fires with all sizes | ⬜ PASS ⬜ FAIL | |
| A3 | Stub FILLS in place, row count unchanged | ⬜ PASS ⬜ FAIL | |
| A4 | Typed UNKNOWN sheet requires a size | ⬜ PASS ⬜ FAIL | |
| A5 | Skip &amp; flag still needs NO size | ⬜ PASS ⬜ FAIL | |
| B1 | Dup size BLOCKED + names the row | ⬜ PASS ⬜ FAIL | |
| B2 | Add-size from suffixed sibling → `DISC-1003-25G` | ⬜ PASS ⬜ FAIL | SKU seen: `__________` |
| B3 | Standalone item needs NO size | ⬜ PASS ⬜ FAIL | |
| B4 | Edit path guarded (blank + dup) | ⬜ PASS ⬜ FAIL | |
| C1 | Clean filter → no "here" banner | ⬜ PASS ⬜ FAIL | |
| C2 | Acoma filter → banner fires, right rows | ⬜ PASS ⬜ FAIL | |
| C3 | Copy counts rows, not "collisions" | ⬜ PASS ⬜ FAIL | |
| D1 | `'Sierra'` unregressed | ⬜ PASS ⬜ FAIL | |
| D2 | Apostrophe varieties still resolve (#55) | ⬜ PASS ⬜ FAIL | |
| D3 | Scan Acoma → ONE ambiguous line + candidates, no false `MISS` | ⬜ PASS ⬜ FAIL | |

---

## What to send back

- **The table above**, filled in.
- **For any FAIL:** what you did, what you saw, and the `[TRACE:*]` lines if you have them. A screenshot of the sheet beats a description.
- **Your row count before/after** — the catalog needs to settle before the remediation is regenerated.

**If everything passes:** ledger #135 flips **BUILDER-COMPLETE → OWNER-PROVEN**, and the next build regenerates the fold SQL against your settled catalog — which by then also owes **Acoma's twin** (`DISC-1002` / `DISC-1002-15G`) and **`DISC-1003-30G-45G`**, neither of which existed when the stale version was written.

**Still open after this, by design:** **tech-debt #56** — size *vocabulary*. Your catalog carries six spellings of three sizes (`15`, `30`, `45`, `5 gal`, `30 gal`, `45 gal`), including on `'Sierra'`. Counting **"15 gal"** against a **"15"** row still mints a third row — two spellings of one physical size. **Don't test that here; it's not fixed.** It's the last live defect in this family and it needs its own build, because unlike these four it can *merge* existing rows.
