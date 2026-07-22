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

- [ ] **① SHA is live — READ IT OFF THE SCREEN. No menu, no flag, no dashboard.** The **bottom of
      every screen** carries the version stamp: **`built <date> · <sha>`**. **That is what is
      ACTUALLY RUNNING in your browser.** Compare it to the SHA you intend to test
      (`git log -1 --format=%h`). Write both — app: `________` intended: `________`
      **They must MATCH.** If they differ, you are on old code — stop, and record nothing.
      - `dev` means a local build, not a Vercel deploy. **Stamp absent entirely** = a bundle from
        **before** the stamp shipped — which is itself proof you are on old code.
      - The **built date** answers a question the SHA can't: *how old is this?* Two same-day deploys
        are told apart by the time, not the date.
      - *(Ledger #141 put the SHA in the debug panel; **ledger #142 moved it to an always-visible
        stamp and removed it from the panel** — one home, no drift (STD-011). It is deliberately
        NOT behind the owner-only debug gate: GATE 0 reads it, so a broken deploy must never be
        able to hide its own tell. The Vercel dashboard is now the FALLBACK. Note it still proves
        only what the BROWSER holds — a matching SHA **after a hard-refresh** is the full answer.)*
- [ ] **② Hard-refresh** — Chrome/Edge `Cmd+Shift+R` · Safari `Cmd+Option+R` (iOS Safari: close the tab
      entirely and reopen — pull-to-refresh is **not** enough). Caching is **per browser**.
- [ ] **③ The new-code signal fires.** Name the build under test and the one signal only it emits, and
      see it. For the last build (#135, now proven) that was *a count with a blank Size being BLOCKED*.
      **If the old signal shows, you are on old code — stop, and record nothing.**

> **Standing (OP-15):** every owner-test board carries this GATE 0 at the top. Inventory is the only
> board today; any future board (the planned orders board included) inherits it by this rule.

### The app states its own SHA — visibly, on every screen
STATUS: owed
DEVICE: phone
COVERS: #141, #142, OP-15, tech-debt #60
LAST-PROVEN: never
SIGNAL: none — **and that is the point.** This card must be provable with NO console and NO menu, because GATE 0 runs in the lot before every other card.
- **Do:** open the app. Look at the bottom of the screen. **Do not open a menu, do not type a flag.**
- **PASS:** a small muted line reads **`built <date> · <sha>`**, the SHA is 7 hex chars and **MATCHES** the commit you pushed (`git log -1 --format=%h`). It is present on **every** screen — check at least three, **including one pre-login** (the `/plant/:tagId` QR page or `/login`).
- **FAIL:** absent *(a bundle from before the stamp — you are on old code, which its absence just told you)* · `dev` *(a local build reached the deploy)* · a SHA that does **not** match *(the deploy under test is not live — every card below is fiction; the #135 scar, caught)* · **present on some screens but not others** *(it is mounted at the wrong level — it must be outside the router)*.
- **Also confirm it never blocks a tap:** try to tap a control near the bottom edge. The stamp is `pointer-events: none`; if anything at the bottom of a screen becomes unclickable, that is a FAIL.
- **Why:** the artifact did not carry its own provenance. A failed Vercel deploy is SILENT (last-good keeps serving) and Vercel deploys the TREE not the COMMIT — so a stale bundle and a failed deploy present identically, and #135 sat dead ~20 hours undetected.

### Dev surfaces are unreachable when signed out
STATUS: owed
DEVICE: phone
COVERS: #142, recon 2026-07-20
LAST-PROVEN: never
SIGNAL: `[TRACE:DEVGATE]` should NOT report a bound identity while signed out.
- **Do:** **sign out.** Open the customer QR page `/plant/SCV-0031`. Then try every old trick: append **`?debug=1`**, append **`?rhythm=1`**, reload with them, try `/login?debug=1`.
- **PASS:** **no 🐞 button, no 🟢 button, ever.** The flags do nothing at all. The version stamp IS still visible (it is meant to be).
- **FAIL:** either panel appears, by any means. **This is the leak this build exists to close** — the panel shows tenant ids and emails, and it was previously reachable on the customer-facing QR page by typing six characters.
- **Why:** the panels used to mount OUTSIDE the router, so they rendered before any auth gate. They now mount inside `AppLayout` (inside `PrivateRoute`) — there is no code path that mounts them for a signed-out visitor. **This card proves the structure, not a conditional.**

### The owner toggles both panels from the account menu
STATUS: owed
DEVICE: phone
COVERS: #142
LAST-PROVEN: never
SIGNAL: `[TRACE:DEVGATE] toggle { key: 'debug', on: [...] }`
- **Do:** sign in **as owner** → tap the avatar (top right) → scroll to the **Developer** block.
- **PASS:** two rows, **Debug panel** and **Rhythm logger**, each showing **Off**. Tap Debug panel → it reads **On** and the 🐞 button appears (bottom-right). Tap again → **Off**, button gone. Same for Rhythm logger → 🟢 (bottom-left). The state survives a reload.
- **FAIL:** no Developer block · a toggle that shows no On/Off state *(a dead affordance)* · a panel that does not appear/disappear immediately · state lost on reload.
- **Why:** this replaces `?debug=1`. Typing a URL flag on a phone in a lot is not a control surface.

### A non-owner never sees the Developer block
STATUS: owed
DEVICE: either
COVERS: #142
LAST-PROVEN: never
- **Do:** sign in as a **MANAGER or STAFF** member → open the account menu.
- **PASS:** **no Developer block at all** — absent, not greyed. No 🐞, no 🟢 anywhere in the app.
- **FAIL:** the block renders, or renders disabled *(disabled still tells them it exists)*, or a panel is visible.
- **Why:** the panel exposes tenant ids and emails; it is an owner tool.

### Turning a panel on does not follow you to another account
STATUS: owed
DEVICE: either
COVERS: #142
LAST-PROVEN: never
SIGNAL: `[TRACE:DEVGATE] identity cleared — all dev surfaces OFF`
- **Do:** as owner, turn **Debug panel ON**. **Sign out.** Sign in as a **different** user (or a member).
- **PASS:** the panel is **OFF** and no 🐞 is visible. Signing back in as the owner may restore it — that is correct, it is *their* setting.
- **FAIL:** the 🐞 appears for the second account. **That was the old defect:** `traceDebug` was a raw localStorage key with no session coupling, so it survived logout and role change and a device left in debug stayed in debug for whoever signed in next.

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

## SURFACE: order-events (D-50 Layer 2A-2 — the order path writes to the ledger)
_The order half of the funnel: every lifecycle transition and every order-driven stock movement lands in `business_inventory_ledger` as an event. Migration `20260720_ledger_event_store_columns.sql` + `api/orders/submit.ts`._

> **⚠️ READ THIS BEFORE RUNNING — the build spec's premise was wrong and the cards below are corrected.**
> The spec described a **`paid` transition** that writes the sale event. **There is no `paid` status.**
> `ORDER_STATUSES` is `pending | confirmed | fulfilled | cancelled` ([orderStatus.ts:13](../../packages/cultivar-os/src/lib/orderStatus.ts#L13)),
> and **no status transition decrements stock at all** — the decrement fires at **CHECKOUT**
> ([submit.ts §11](../../packages/cultivar-os/api/orders/submit.ts)), where the order is born `pending`.
> So **"mark an order PAID" is not a performable step** and is not asked for below. David ruled
> 2026-07-20: build to the real four statuses, date the sale at checkout, leave R-STATUS unratified.
>
> **GATE 0 APPLIES to the app-driven cards** (they run through a deployed bundle) but **not** to the
> postgres-only ones. The migration is **GATED — apply it first, or every card below fails honestly.**

### The event-store columns exist and no historical row was rewritten 🔴
STATUS: owed
DEVICE: postgres
COVERS: D-50 Layer 2A-2
LAST-PROVEN: —
SIGNAL: V1 + V2 in the migration footer
- **Do:** apply the migration, then run V1 and V2 **before** creating any new order.
- **PASS:** the 3 columns exist and are nullable; **`untouched == total`** — every pre-existing row still has NULL in all three.
- **FAIL:** `untouched < total` means something backfilled by UPDATE — which should have been *impossible*.
- **Why this is the sharpest card here:** the spec asked for a backfill UPDATE. **That UPDATE was deliberately not written.** It would have required `DISABLE TRIGGER` on the one table engineered so that *even `postgres`* cannot amend it — opening the exact door D-50 welded shut, on the ledger's first extension. The data is 100% derivable, so the view resolves it on read instead. **This card checks that the guarantee survived its own first upgrade.**

### The view resolves old rows without touching them
STATUS: owed
DEVICE: postgres
COVERS: D-50 Layer 2A-2
LAST-PROVEN: —
SIGNAL: V3 returns 0
- **Do:** run V3 against `business_inventory_ledger_events`.
- **PASS:** **0 rows** with a NULL `event_type` / `aggregate_type` / `aggregate_id`.
- **Why:** this is the other half of the card above. Not backfilling is only correct if reads still get clean values — V2 proves nothing was rewritten, V3 proves nothing was lost.

### Checkout writes a dated `sale` event carrying its actor 🔴
STATUS: owed
DEVICE: phone
COVERS: D-50 Layer 2A-2
LAST-PROVEN: —
SIGNAL: `[TRACE:INVENTORY] lot qty adjusted … kind: 'sale', actor: …`

> **⚠️ AMENDED BY D-52 (2026-07-21) — run this as a WALK-IN only.**
> This card was written when **every** checkout decremented stock. Under D-52 only a
> **self-transport (walk-in)** checkout still writes its `sale` event at checkout; a
> **delivery/install** order writes `order_committed` and deliberately moves **no stock** until it
> is marked fulfilled. Running this card on a delivery order will show **no `sale` row — and that
> is the correct new behavior**, not a failure. The delivery half is covered by its own cards under
> **SURFACE: inventory-states** below.

- **Do:** run a checkout on a **countable lot**, choosing **"No thank you — I'll haul it myself"** — first while **signed in as staff**, then a second one **signed out** via the QR page.
- **PASS:** each produces a `sale` row, `delta = −qty`, `source_id` = the order, `occurred_at` = the checkout moment. The signed-in one carries **your uid**; the anonymous one carries **NULL**.
- **⚠️ NULL on the anonymous checkout is a PASS, not a failure.** There is genuinely no caller on the QR path. `assert_movement_actor` admits it as a system write, and D-50 §11 forbids defaulting it to the owner — **a fabricated actor is worse than an absent one** (D-9). A card that demanded non-NULL everywhere would be demanding a lie.
- **FAIL:** the anonymous checkout records the owner's uid — that is the failure this card exists to catch.

### A status transition writes an ORDER event with delta 0
STATUS: owed
DEVICE: desktop
COVERS: D-50 Layer 2A-2
LAST-PROVEN: —
SIGNAL: `[TRACE:ROSTER] order event recorded`
- **Do:** move an order `pending → confirmed`, then `confirmed → fulfilled`, from the order detail page. Then run the funnel query:
  ```sql
  SELECT event_type, aggregate_type, delta, actor_user_id, occurred_at
    FROM business_inventory_ledger_events
   WHERE aggregate_id = '<order id>' OR source_id = '<order id>'
   ORDER BY occurred_at;
  ```
- **PASS:** `order_created` (at checkout) then `order_confirmed` then `order_fulfilled` — each `aggregate_type='ORDER'`, **`delta = 0`**, **your real uid**, dated. Alongside them, the `sale` INVENTORY row from checkout with `delta = −qty`.
- **Why delta 0 matters:** it is what lets **one log** carry both event families. A status event that moved `SUM(delta)` would silently corrupt on-hand for every lot in the order. The RPC hard-codes the zero rather than accepting it as a parameter, so no future caller can get it wrong.
- **Also check:** re-submitting the **same** status writes **no** event (`status unchanged — no event written`). An event log records what happened; a transition nobody performed must not appear.

### Cancelling restores stock as a `sale_reversal`, attributed
STATUS: owed
DEVICE: desktop
COVERS: D-50 Layer 2A-2
LAST-PROVEN: —
SIGNAL: `kind: 'sale_reversal'`
- **Do:** cancel an order that has a line on a countable lot. Re-run the funnel query.
- **PASS:** a `sale_reversal` row, `delta = +qty`, **your uid**, plus an `order_cancelled` ORDER event at `delta 0`. The lot's `qty` matches `SUM(delta)` again.
- **Why:** the reversal is a **new row**, never an edit of the original sale. The original sale still happened and still reads as having happened — that is the append-only model doing its job.

### Order events never move on-hand — the invariant, measured
STATUS: owed
DEVICE: postgres
COVERS: D-50 Layer 2A-2
LAST-PROVEN: —
SIGNAL: V6 returns 0
- **Do:** after all of the above, run V6 — `SELECT sum(delta) FROM business_inventory_ledger WHERE aggregate_type='ORDER'`.
- **PASS:** **0.** Now and forever, no matter how many orders exist.
- **FAIL:** anything non-zero means an order event leaked into the stock invariant, and **every** replay number in this document is wrong.
- **Then re-run V3(b) from the Layer 1 surface** (`qty == SUM(delta)` per lot). It must still return **0 rows** — the Layer 1 guarantee has to survive Layer 2A-2's new writers.

---

## RESULTS — fill this in

**Row count before:** `______` **Row count after:** `______` **Commit under test:** `__________`

| Surface | Card | Result | Notes |
|---|---|---|---|
| GATE 0 | **Version stamp visible on every screen (matches push)** 🆕 | ⬜ PASS ⬜ FAIL | app: `________` intended: `________` |
| GATE 0 | **Signed out: no debug reachable by any means** 🔴🆕 | ⬜ PASS ⬜ FAIL | tried `?debug=1` `?rhythm=1` |
| GATE 0 | **Owner menu toggles both panels on/off** 🆕 | ⬜ PASS ⬜ FAIL | |
| GATE 0 | **Non-owner never sees the Developer block** 🆕 | ⬜ PASS ⬜ FAIL | role tested: `________` |
| GATE 0 | **Panel state does not follow you to another account** 🆕 | ⬜ PASS ⬜ FAIL | |
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

## SURFACE: inventory-states (D-52 — on-hand / committed / available)
_Stock no longer leaves on-hand at checkout. It leaves when the order is **fulfilled**. Committed and available are **derived**, never stored. `api/orders/submit.ts` · `src/lib/inventoryStates.ts` · `BusinessInventory.tsx` · `Dashboard.tsx` · `api/dashboard.ts`._

> **GATE 0 APPLIES** to every card here — they all run through a deployed bundle. Confirm the Vercel
> deploy for the SHA under test is READY, then check the version stamp says that SHA (OP-15).
>
> **⚠️ RUN THE REMEDIATION REPORT FIRST, AND DO NOT `--apply` UNTIL YOU HAVE READ IT.** Orders placed
> before this build already took their stock out at checkout. Until they are reconciled, on-hand
> under-reports and the numbers below will look wrong for those specific lots — *correctly so*.

### A DELIVERY order commits stock without moving on-hand 🔴
STATUS: owed
DEVICE: phone
COVERS: D-52
LAST-PROVEN: —
SIGNAL: `[TRACE:INVENTORY] D-52 commit — units COMMITTED, on-hand deliberately UNCHANGED`
- **Do:** note a lot's **On hand** in the inventory grid. Place an order for 2 of it choosing **Delivery**. Reload the grid.
- **PASS:** **On hand is UNCHANGED.** Committed shows **2**. Available dropped by **2**.
- **FAIL:** On hand dropped — the decrement did not move, and this build's central claim is false.
- **Why:** the plant is still standing in the yard. Saying it left because someone ordered it is the thing D-52 corrects.

### Marking it FULFILLED is what drops on-hand 🔴
STATUS: owed
DEVICE: desktop
COVERS: D-52
LAST-PROVEN: —
SIGNAL: `[TRACE:INVENTORY] D-52 fulfilled — on-hand decremented at departure`
- **Do:** open that order, set status **Fulfilled**. Reload the grid.
- **PASS:** **On hand drops by 2.** Committed returns to **—**. Available is unchanged *from the committed state* (the units were already not sellable).
- **PASS:** the ledger has a `sale` row dated **now** (the fulfillment moment), not the checkout moment.
- **Why the date matters:** reconcile subtracts against this timestamp. Dating a sale at checkout claims stock left on a day it demonstrably had not.

### A WALK-IN collapses both into one instant 🔴
STATUS: owed
DEVICE: phone
COVERS: D-52
LAST-PROVEN: —
SIGNAL: `[TRACE:INVENTORY] lot qty adjusted … 'walk-in sale decrement (commit+fulfill collapsed)'`
- **Do:** checkout on a countable lot choosing **"No thank you — I'll haul it myself."**
- **PASS:** On hand drops **immediately**. Committed stays **—** (it never sat committed). The order shows **Fulfilled**, not Pending.
- **PASS:** the ledger holds `order_created`, `order_committed`, `order_fulfilled` and one `sale` — all sharing a timestamp.
- **⚠️ The order being born Fulfilled is deliberate**, not a bug: the customer has the plant. Leaving it Pending would count units as committed that are already on someone's trailer, permanently understating what you can sell.

### Oversell is refused against AVAILABLE, with stock visibly on hand 🔴
STATUS: owed
DEVICE: phone
COVERS: D-52
LAST-PROVEN: —
SIGNAL: `[TRACE:INVENTORY] REFUSED — insufficient AVAILABLE`
- **Do:** find a lot with **exactly N** on hand. Place a **delivery** order for all N (do not fulfil it). Now try to order **1 more** of the same lot.
- **PASS:** the second order is **REFUSED**, and the message reads *"Only 0 … available to sell (N on hand, N committed to open orders)"*.
- **PASS:** the grid still shows **On hand = N** — the stock is genuinely there, and correctly not sellable.
- **Why this is the card that justifies the build:** under D-42 this second order would have **succeeded**, selling the same physical plants twice. The message names both numbers on purpose — *"only 0 in stock"* against a lot you can see holding N reads as a bug.

### Cancelling an OPEN order invents no stock 🔴
STATUS: owed
DEVICE: desktop
COVERS: D-52
LAST-PROVEN: —
SIGNAL: `[TRACE:INVENTORY] D-52 cancelled while open — commitment released, on-hand untouched (nothing was taken)`
- **Do:** note On hand. Place a **delivery** order for 2 (do not fulfil). **Cancel** it. Reload.
- **PASS:** On hand is **exactly what it was before the order** — unchanged throughout. Committed returns to **—**; Available returns to its original value.
- **FAIL:** On hand is **2 higher** than when you started. That is stock invented from nothing.
- **Why this card exists:** the cancel path used to restore stock unconditionally, which was right when checkout took it. Moving the decrement without moving that assumption would have credited back a decrement that never happened — and an append-only ledger would have recorded the invention as fact. Same for **delete** and for **editing** an open order's quantities: none may move on-hand.

### The grid shows three numbers and only one is editable
STATUS: owed
DEVICE: desktop
COVERS: D-52
LAST-PROVEN: —
SIGNAL: —
- **Do:** open the inventory grid with at least one open delivery order outstanding.
- **PASS:** columns **On hand · Committed · Available** sit together. Editing **On hand** works; **Committed** and **Available** show a **lock** whose popover explains what sets them.
- **PASS:** a lot that is fully spoken for (on hand > 0, available 0) renders **Available in amber**.
- **FAIL:** Committed or Available is greyed with no explanation — a locked field with no reason is a hidden edit function (§6 r13).

### The dashboard stops calling on-hand "available"
STATUS: owed
DEVICE: desktop
COVERS: D-52
LAST-PROVEN: —
SIGNAL: —
- **Do:** with an open delivery order outstanding, load the dashboard **Plants tracked** tile.
- **PASS:** the sub-line reads **"N available · M committed"** where N + M = the headline.
- **PASS:** with **no** open orders it reads plainly **"N available"** — no "· 0 committed" noise.

### REMEDIATION — the pre-D-52 orders, report first 🔴
STATUS: owed
DEVICE: desktop
COVERS: D-52
LAST-PROVEN: —
SIGNAL: script stdout
- **Do:** run **report mode** (writes nothing):
  `SUPABASE_URL=… SUPABASE_SERVICE_KEY=… node scripts/d52-remediate-committed-stock.mjs`
- **PASS:** read the three tables. Confirm the *"TO REMEDIATE"* list is orders whose plants are **genuinely still on your property**, and that the *"SKIPPED: walk-in"* list is orders whose customers **already drove away**.
- **⚠️ THE WALK-IN SPLIT IS THE JUDGEMENT CALL, AND IT IS YOURS.** Crediting a walk-in's stock back would invent plants you do not have, in a log that cannot be retracted. The script decides by `transport_method`; if any row in either list looks misfiled, **stop and say so — do not `--apply`.**
- **Then:** re-run with `--apply` only after you are satisfied. Afterwards, on-hand for those lots should match what you can physically count, and those units should read as **Committed**.
- **Then:** re-run Layer 1's **V3(b)** — `qty == SUM(delta)` must still return **0 rows**, with the remediation events counted in the sum.

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


---

## SURFACE: reconcile (D-50 payoff — the count becomes stamped truth)
_The desk surface that turns a physical count into an append-only, dated, actor-stamped ledger event. `/inventory/reconcile` · `src/pages/InventoryReconcile.tsx` · `src/lib/reconcileMath.ts` (the pure decision) · RPCs `count_reconcile_inventory` + `adjust_inventory_manual`._

> **GATE 0 APPLIES** to every card here. Confirm the Vercel deploy for the SHA under test is READY,
> then check the version stamp says that SHA (OP-15).
>
> **Nothing on this screen writes until you press Accept.** Typing a count is free; every card below
> that says "PASS: a ledger row exists" is asserting a row that **cannot be edited or deleted**.

### BASELINE mode shows NO sales column on a fresh lot 🔴
STATUS: owed
DEVICE: desktop
COVERS: #145
LAST-PROVEN: —
SIGNAL: `[TRACE:RECONCILE] load ok` — `baseline:` count > 0, `delta:` 0 on a never-counted tenant
- **Do:** open **/inventory/reconcile** on lots that have never been counted.
- **PASS:** there is **no "Since last count" column at all** — not an empty one.
- **FAIL:** an empty "sold" column renders. An empty column on a clean slate reads as a broken feature, which is exactly what the demo must not show.
- **Why:** baseline has no window. A column with nothing in it invites the question "why is this blank?" on the screen meant to prove how easy this is.

### A baseline Accept stamps the count as on-hand, with your name and the time 🔴
STATUS: owed
DEVICE: desktop
COVERS: #145
LAST-PROVEN: —
SIGNAL: `[TRACE:RECONCILE] accept — plan` then `accept — step ok` with a `ledgerId`
- **Do:** pick a real lot. Note its **Book on-hand**. Type a different count. Press **Accept**, read the "What Accept writes" box, confirm.
- **PASS:** the sheet lists exactly **ONE** step (`count_reconcile`). On-hand becomes your counted number.
- **PASS (the actual proof, in SQL):** a `business_inventory_ledger` row, `kind='count_reconcile'`, `reason='baseline'`, `occurred_at` = **now**, `actor_user_id` = **your uid** — not null, not the system.
- **FAIL:** `actor_user_id` is NULL. This screen is always driven by a signed-in human; a null actor here would mean the page could not name who asserted the count.

### Nothing is written until you Accept 🔴
STATUS: owed
DEVICE: desktop
COVERS: #145
LAST-PROVEN: —
SIGNAL: no `[TRACE:RECONCILE] accept` line at all
- **Do:** type counts into **three** rows. Do **not** press Accept. Reload the page.
- **PASS:** all three lots still show their **original** book on-hand; `SELECT count(*) FROM business_inventory_ledger` is **unchanged**.
- **Why:** the log is append-only. A screen that wrote on blur or on navigate would put un-retractable rows in it for a number someone was still typing.

### DELTA mode replays the window and names the movements 🔴
STATUS: owed
DEVICE: desktop
COVERS: #145
LAST-PROVEN: —
SIGNAL: `[TRACE:RECONCILE] load ok` — `delta:` > 0
- **Do:** on the lot you just baselined, place a **delivery** order for 2 and mark it **Fulfilled** (that is the D-52 moment stock actually leaves). Return to /inventory/reconcile.
- **PASS:** that lot now reads **DELTA**; "Since last count" says **2 sold — 1 order**.
- **PASS:** count the physical truth (book − 2). The math cell reads **agrees — done**, and Accept asks for **no attribution**.
- **Why:** the sale is already on the ledger and already in the book. A screen that made you explain a sale it recorded itself would be asking you to account for its own arithmetic.

### ⚠️ A RECEIVE in the window must NOT read as a residual 🔴
STATUS: owed
DEVICE: desktop
COVERS: #145
LAST-PROVEN: —
SIGNAL: `[TRACE:RECONCILE] load ok`, then the row's math cell
- **Do:** on a DELTA lot, add stock (any path that writes a non-`sale` ledger row — a manual qty edit on /inventory works). Then reconcile, counting the lot **honestly** (i.e. matching book).
- **PASS:** residual is **0**. The "Since last count" strip names **both** the sale and the adjustment.
- **FAIL:** a nonzero residual appears and the sheet asks you to attribute it to dead/lost. **This is the exact defect the build spec's formula would have shipped** — subtracting only sales turns every receive into phantom shrinkage.
- **Why:** it would ask a human to account, permanently and by name, for a movement the system itself recorded.

### ⚠️ Attribution SPLITS the delta — it must not decrement twice 🔴
STATUS: owed
DEVICE: desktop
COVERS: #145
LAST-PROVEN: —
SIGNAL: `[TRACE:RECONCILE] accept — plan` — read `netDelta` and compare it to (counted − book)
- **Do:** on a DELTA lot holding (say) 30, count **13**. Attribute **4 dead** and **3 lost**. Read the "What Accept writes" box **before** confirming.
- **PASS:** exactly **THREE** steps — `dead → 26`, `loss → 23`, `count_reconcile → 13`. The **last** step lands on **13**.
- **PASS:** after accepting, on-hand is **13** — and `SUM(delta)` for the three new rows is **−17**, not −24.
- **FAIL:** on-hand ends at **6**, or the ledger sums to −24. That is the double-decrement — **7 plants invented as dead** in a log that cannot be retracted.
- **Why:** both RPCs move qty. Running a full `count_reconcile` and *then* the attributions applies the shrinkage twice.

### The plan refuses to drive on-hand below zero 🔴
STATUS: owed
DEVICE: desktop
COVERS: #145
LAST-PROVEN: —
SIGNAL: the refusal text in the sheet; **no** `[TRACE:RECONCILE] accept — plan` line
- **Do:** on a lot holding 3, count 0 and attribute **9 dead**.
- **PASS:** refused **before any write**, and the message **names the number** — "9 dead is more than the 3 this lot has on hand".
- **FAIL:** a bare "invalid input", or a partial write that lands the first step and then errors.

### `qty == SUM(delta)` still holds after a reconcile 🔴
STATUS: owed
DEVICE: desktop
COVERS: #145
LAST-PROVEN: —
SIGNAL: — (SQL)
- **Do:** re-run D-50 Layer 1's **V3(b)**: every lot's `qty` equals the `SUM(delta)` of its ledger rows.
- **PASS:** **0 rows** disagree, with this build's reconcile events included in the sum.
- **Why:** this is the one check that proves the new writer did not break the guarantee the whole ledger rests on.

### ⚠️ REGRESSION — the genesis row must not be replayed as a movement 🔴
STATUS: owed
DEVICE: desktop
COVERS: #146
LAST-PROVEN: —
SIGNAL: the row's math cell — the "ledger replays to X but book says Y" line
- **Do:** open **/inventory/reconcile** on lot **3ec53db3** (Shoal Creek Vitex 45). Do not enter a count.
- **PASS:** the replay figure reads **58** and the *"ledger replays to X but the book says Y"* line **does not render** (they agree).
- **FAIL:** it reads **116 / 120**, or the mismatch line appears against a lot whose SQL replay is clean.
- **Cross-check (SQL):** `SELECT COUNT(*), SUM(delta) FROM business_inventory_ledger WHERE inventory_id='3ec53db3-…';` → **2 rows, 58**. The screen must agree with that number.
- **Why it was load-bearing:** DELTA-mode `expected` is computed from replay. A doubled replay makes expected ~2× reality and surfaces a **phantom surplus** — asking the owner to account for stock that never existed. Same failure class as the `prior−sales` bug this build already corrected.

### ⚠️ REGRESSION — the checkout picker shows AVAILABLE, not on-hand 🔴
STATUS: owed
DEVICE: phone
COVERS: #146
LAST-PROVEN: —
SIGNAL: the picker sub-line under each size/match
- **Do:** on **/checkout/scan**, search a term matching **Shoal Creek 30 (DISC-1105)** so the multi-match picker opens. Compare against /inventory's **AVAILABLE** column for the same lot.
- **PASS:** the picker reads **0 available (29 on hand, 57 committed)** — the same number the grid shows, with both figures named.
- **FAIL:** it reads **"29 available"**. That is raw on-hand wearing the word available, and it offers stock the server will then refuse at submit.
- **Why both numbers are named:** a bare "0 available" against a lot the owner can see holding 29 reads as a bug, not a rule — the same reason D-52's refusal copy names both.

### The unresolved-scan queue reads, and offers nothing it cannot do 🔴
STATUS: owed
DEVICE: desktop
COVERS: #145
LAST-PROVEN: —
SIGNAL: `[TRACE:RECONCILE] load ok` — `unresolvedScans:`
- **Do:** have (or make) an unrecognized scan during a phone count, then open /inventory/reconcile.
- **PASS:** an amber card lists it with its label, qty, time, and raw scan — **and says plainly that resolving it is not built yet.**
- **FAIL:** a "Resolve" button exists. A control that looks actionable and isn't is a dead affordance (§1.6 item 5); saying so is the honest form.

| `[TRACE:SYNC]` | the offline queue depth + drain |
