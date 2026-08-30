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
STATUS: owed
⚠️ FLIPPED covered → owed 2026-08-30 (#238): the fill path's `variant_group` write moved from a plain UPDATE to `count_group_variant_sizes`. The proof below is unchanged; nobody has run it since the surface moved.
DEVICE: phone
COVERS: #133, D-49, D-34
LAST-PROVEN: 2026-07-16
SIGNAL: `[TRACE:INVENTORY] promote — filled` (**not** `created`)
- **Do:** scan a stub (qty 0, no size, no group). Type a size. Enter a count. Save.
- **PASS:** **row count unchanged.** The existing row is filled and **keeps its `DISC-####` SKU**.
- **FAIL:** a second row appears beside it — the D-49 defect returning.
- **Then:** re-scan it. **PASS:** resolves. **FAIL:** UNKNOWN.

### A new size creates a sibling, SKU derived from the family BASE
STATUS: owed
⚠️ FLIPPED covered → owed 2026-08-30 (#238): the create path's regroup loop became ONE RPC call. The proof below is unchanged; nobody has run it since the surface moved.
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

## SURFACE: offline — store-and-forward
_The SyncEngine (`packages/shared/src/sync/`) — back-acre dead zones (ledger #54, #143).
**PROVEN BY DAVID 2026-08-23 by an airplane-mode test, and UNRECORDED until now** — which is why it
was re-questioned the same evening and cost a recon to re-establish. These cards exist so it is
never re-established from memory again. Mechanism located: `docs/audits/offline-store-and-forward-recon-2026-08-23.md`._

> **Coverage, established from code (recon 2026-08-23):** the queue is wired into **exactly TWO**
> surfaces — this count loop (`InventoryCount.tsx:194`) and asset capture (`AssetCapture.tsx:62`).
> Checkout, the QR profile, the delivery route and the desk reconcile have **no queue**.
> 🔴 **And on THIS covered surface the WRITES are queued while the READ in front of them is not** —
> see card 2, which is expected to fail.

### 1. A count taken offline survives and syncs on reconnect  (COVERED SURFACE)
STATUS: owed
DEVICE: phone
COVERS: #54 · #143 · recon 2026-08-23
LAST-PROVEN: never
MEASURED: 2026-08-24 — **RE-MAPPED BY CONTENT, AND THIS ONE WAS CORRECTLY PLACED — IT IS THE ONLY CARD THAT CARRIES *TWO* OF DAVID'S TESTS.** 🔴 **THE MAPPING IS NOW BY WHAT THE CARD TESTS, NEVER BY ITS NUMBER.** David's phone tests are numbered T1–T6 and are **NOT** these cards; the two sets share only their integers, and the first pass matched them by integer. **This card holds T2 (a count taken offline) in its first three bullets AND T3 (reconnect drains the queue) in its *Airplane mode OFF* clause** — which is the clause David cited as the evidence the mapping was wrong: *"airplane mode OFF — expect the counter to fall to 0 without pressing anything"* is **T3**, not T1. **MEASURED 2026-08-24 by David — SHA `1c60964`, iPhone Safari, normal tab, airplane mode ON with wifi manually OFF.** **T2 PASSED. T3 FAILED:** signal returns, the pending banner stays, and the queue drains only after a manual page refresh (tech-debt **#95**). ⚠️ **STATUS THEREFORE STAYS `owed`** — and would stay `owed` even if Thunder could flip it (OP-14: only David's live run does), because **a card whose own pass condition was measured failing is not proven by the rest of it passing.** Re-run when #95 is scoped and resolved; the storage-banner and counter-accuracy clauses added by ledger #207 held. 🔴 **The origin was not recorded and no card on this board names one** — per tech-debt **#96** the offline stores are per-origin, so this is evidence about ONE host and the record cannot say which.
- Start a count **ONLINE** — it refuses to start offline by design (`InventoryCount.tsx:222`).
  Resolve ONE item and leave the review sheet **OPEN**. Airplane mode **ON**.
- **EXPECT** the banner: *"Offline — counts are saved on this phone and will sync when you're back in signal."* Save the qty.
- **EXPECT** *"N waiting to sync"* to APPEAR and the number to be RIGHT. Save two more.
- Airplane mode **OFF**. **EXPECT** the counter to fall to 0 **without pressing anything**.
- Open `/inventory`. **EXPECT** every counted qty to be there.
- 🔴 **ADDED ledger #207 — THE COUNTER MUST BE ACCURATE, NOT MERELY PRESENT.** Save a known number of items (say four) and check the badge reads **exactly** that. A badge that lags or sticks is the visible symptom of a queue write that did not land, and it is the one signal available in a lot with no console.
- 🔴 **AND THE WARNING FROM CARD 5 MUST *NOT* APPEAR HERE.** In a normal tab the red storage banner must be absent and the offline note must read *"counts are saved on this phone…"* — the healthy wording. If the red banner shows up in a normal tab, the probe is over-firing and **STOP and report**.
- **FAIL:** the Save errors · the counter never appears · the counter is wrong · the counter does not fall on reconnect · a qty is missing or wrong · the storage warning appears in a normal tab.
- **NO CONSOLE.** Every check above is on-screen.

### 2. 🔴 Scanning offline names the SERVER, never the tag  (THE RECON'S HEADLINE — NOW EXPECTED TO PASS)
STATUS: owed
DEVICE: phone
COVERS: recon 2026-08-23 · ledger #206 · `stockLineResolver.ts` · R-11
LAST-PROVEN: never
MEASURED: 2026-08-24 — **RE-MAPPED BY CONTENT: this card is David's T1 (offline scan), and it was correctly placed.** 🔴 **Mapping is by what the card tests, never by its number** — T1–T6 are David's phone tests and are NOT these cards. **MEASURED 2026-08-24 by David — SHA `1c60964`, iPhone Safari, normal tab, airplane mode ON with wifi manually OFF. REPORTED PASS: the offline scan named the SERVER, not the tag.** ⚠️ **`STATUS` STAYS `owed` AND THAT IS NOT A CLERICAL LAG: Thunder may never write `covered` (OP-14), and this line is Thunder RELAYING a result, not David recording one.** It flips on David's own entry with a `LAST-PROVEN` date. ⚠️ **WHICH OF TWO CARDS T1 LANDS ON IS NOT SETTLED, AND IS FLAGGED RATHER THAN GUESSED: this card is the CHECKOUT offline scan (`/checkout/scan`); card 8 is the COUNT-loop offline scan.** The result was reported without naming the surface. It is recorded here because the reported wording matches this card's check; **if the scan was taken on the count screen, this annotation belongs on card 8 instead.** One sentence from David settles it. 🔴 **AND THE RESULT DOES NOT SAY WHICH ORIGIN IT WAS MEASURED ON** — per tech-debt **#96** the offline stores are per-origin, `cultivar-os.app` and `cultivar-os.vercel.app` are different origins, and **no card on this board names an origin**, so a pass here is evidence about ONE host and the record cannot say which.
- Airplane mode **ON**. On `/checkout/scan`, scan a tag you **know** is in inventory.
- **EXPECT** the sheet to read **"Couldn't reach the server"**, and its body: *"You're offline — we couldn't reach the server to look this up. Try again once you have a signal. We didn't check &lt;TAG&gt; against your inventory, so this says nothing about the tag."* The button says **Try again**.
- 🔴 **THE CHECK THAT MATTERS — READ THE WHOLE SHEET: the words "check the tag" must NOT appear anywhere on it, and neither must "didn't recognize" or "didn't match a stock line."** That copy sent a person to inspect a tag that was fine.
- Now use the manual **Look up** field (still offline), type `vitex`. **EXPECT the same "Couldn't reach the server" sheet — NOT "0 matches"**, which is a claim about your catalog that nothing read.
- Airplane mode **OFF**, scan the same tag again. **EXPECT** it to resolve into the cart normally.
- **FAIL:** any mention of the tag being wrong · a "not recognized" heading · a silent nothing · the item added anyway.
- **NO CONSOLE.** Every check is on-screen.

> ✏️ **This card was written on 2026-08-23 as EXPECTED TO FAIL, and the build it was written against
> landed the same day (ledger #206).** It is rewritten to its passing form rather than replaced —
> the failing text is preserved in the recon and in the handoff, so the record still shows what was
> wrong. **`STATUS: needs-test` → `owed`, because a test now exists but nobody has run it. Thunder
> does not mark it covered (OP-14).**

### 3. Submitting an order offline  (UNCOVERED SURFACE)
STATUS: needs-test
DEVICE: phone
COVERS: recon 2026-08-23 · `useSubmitOrder.ts:108` · `CartReview.tsx:628`
LAST-PROVEN: never
- Build a cart **ONLINE**. Airplane mode **ON**. Press *"I'll pay at the office"*.
- **EXPECTED TODAY:** a red box reading **`Load failed`** (or `Failed to fetch`) — the browser's own string. Nothing says offline; nothing offers a retry.
- Airplane mode **OFF**, press again: **EXPECT** it to go through, cart intact.
- **FAIL (worse than expected):** the order submits twice · nothing appears at all · the cart empties.

### 4. 🔴 The cart does NOT survive a reload  (UNCOVERED — EXPECTED TO FAIL)
STATUS: needs-test
DEVICE: phone
COVERS: recon 2026-08-23 · `useCart.ts` (zustand, no `persist`)
LAST-PROVEN: never
- Scan 3 items into a cart. Pull-to-refresh (or background the tab long enough for iOS to discard it) and return.
- **EXPECTED TODAY:** the cart is **EMPTY**. Lines, customer, tier, transport — all gone, no warning.
- Record **how long** backgrounding takes to lose it on the actual demo phone. That number is the real input to whether cart persistence is worth building.

### 5. 🔴 A day's counts in a PRIVATE tab  (THE STORE'S DURABILITY — ties to the logout-loop hunt)
STATUS: owed
DEVICE: phone
COVERS: recon 2026-08-23 · ledger #207 · `store.ts` · `syncEngine.submit`
LAST-PROVEN: never
MEASURED: 2026-08-24 — 🔴 **RUN, AND IT FAILED AGAINST ITS OWN STATED PASS CONDITION. THIS CARD IS DAVID'S T5 — the one case where the card number and the test number happen to agree, confirmed by content and not by the integer.** **MEASURED 2026-08-24 by David — SHA `ebdb186`, iPhone Safari, Safari PRIVATE tab, `cultivar-os.vercel.app`, ONLINE THROUGHOUT.** **The app loaded, login worked and DID NOT LOOP, a count session opened, and a variety resolved with live on-hand data. At no point did anything warn that storage was unavailable — and this card's stated pass condition is that red warning.** ✅ **ONE THING IS CLEARED BY THIS RUN AND IT IS WORTH THE TRIP ON ITS OWN: the Private tab is NOT the logout-loop repro. Login worked and did not loop, so the loop is UNEXPLAINED and the store is no longer the leading suspect.** 🔴 **THE CARD'S EXPECTATION IS WHAT THE MEASUREMENT FALSIFIES, NOT THE CODE — recon `docs/decisions/2026-08-24-storage-probe-private-tab-recon.md`.** The probe DID run (`InventoryCount.tsx:214`, on page mount, ungated) and correctly returned `ok`: it writes a sentinel, reads it back and removes it **all inside one page session** (`store.ts:168-183`), and a Private tab holds a value fine for the lifetime of the tab. What a Private tab costs is persistence **across tab close**, which the probe does not and cannot test. ⚠️ **CARRY THE CAVEAT: David was ONLINE the whole time, so every write went straight to the server and NOTHING EVER HAD TO SURVIVE IN THE STORE. Private-tab-WHILE-OFFLINE is still unproven** — the decisive step nobody has run is *close the Private tab, reopen a new one, and see whether a pending count survives*. The recon carries the exact tap sequence. ⚠️ **STATUS STAYS `owed`. Thunder marks nothing `covered` (OP-14)** — and this card is not passed either way: its condition was measured failing and the half it exists to prove was never exercised.
- 🔴 **RUN THIS ON THE SAME DEVICE AND BROWSER AS THE LOGOUT-LOOP REPRO.** The store holding a day's counts is the same mechanism suspected in the logout loop, so this card may inform both — that is why it is worth the trip even though the count half is now fixed.
- Open the app in a Safari **PRIVATE** tab and go to `/inventory/count`.
- 🔴 **BEFORE STARTING — EXPECT A RED WARNING ON THE START CARD**, reading: *"This phone isn't letting the app store anything — that usually means a Private browsing tab, or site data turned off. Counts will go straight to the server while you have signal, but NOTHING can be held on the phone: lose signal and that count is gone. Open the app in a normal tab before you walk the lot."*
- **If that warning is ABSENT, STOP and report** — the probe did not fire, and everything below is untestable.
- Start the count anyway (this is allowed on purpose — see below) and, **still online**, save one item. **EXPECT it to save normally** and appear in the tally.
- Now **airplane mode ON** and try to save another. 🔴 **EXPECT A REFUSAL that names STORAGE, not the network:** *"This phone isn't letting the app store anything … We could NOT save that. Open the app in a normal tab and count there."*
- 🔴 **THE CHECK THAT MATTERS: it must NOT say "N waiting to sync", and it must NOT say "counts are saved on this phone."** Those were the words over lost work. If you see either, **STOP and report.**
- **CLOSE** the private tab, reopen private, return to `/inventory`. The item saved **while online** should be there; the one refused offline should not — and you were told so at the time.
- **FAIL:** no warning before the walk · an offline save that reports success · a pending counter that climbs in a Private tab · a message blaming the network.
- **NO CONSOLE.** Every check is on-screen.

> ✏️ **WHY THE APP DOES NOT SIMPLY BLOCK COUNTING HERE, stated so it is not filed as a bug:**
> with signal, a Private tab works — the engine writes straight to the server when the queue
> cannot persist, and that write is real (proven by call count, not by status). What is lost is
> the **dead-zone promise**, and that is precisely what the warning names. Blocking would remove
> a capability that genuinely works; saying nothing was what cost the work.

### 6. Photos captured offline  (COVERED SURFACE — the second consumer)
STATUS: needs-test
DEVICE: phone
COVERS: recon 2026-08-23 · `AssetCapture.tsx:62` · `assetBlobStore.ts`
LAST-PROVEN: never
- Airplane mode **ON**. On `/asset-capture`, take 2 photos.
- **EXPECT** the *Offline* chip and a **held** count of 2. **Reload the page STILL OFFLINE.**
- **EXPECT** the held count to still be 2 — these live in **IndexedDB**, so unlike a cart they survive a reload.
- Airplane mode **OFF**. **EXPECT** them to drain and appear as assets.
- **FAIL:** the held count is wrong · a photo is lost on reload · they never drain.

### 7. A stuck queue says nothing  (THE DRAIN'S OWN FAILURE — hard to stage, recorded anyway)
STATUS: needs-test
DEVICE: phone
COVERS: recon 2026-08-23 · `syncEngine.ts:176,180` · `forget()` has 2 call sites
LAST-PROVEN: never
- If an op is ever **REFUSED** on drain (RLS, a constraint, an RPC returning `applied:false`), the FIFO stops at it and everything behind it is stuck — **permanently, with no UI to clear it**.
- **EXPECTED TODAY:** *"N waiting to sync"* stays put; **Sync now** appears to do nothing; the only evidence is a console line — which this `DEVICE: phone` card cannot use.
- Staging this needs a deliberate refusal, so it is recorded as a **KNOWN HOLE** rather than a runnable check. **Do NOT mark this covered by inference from card 1 passing.**

---

### 8. The count loop's offline scan is honest AND still lets you type  (COVERED SURFACE — the read in front of it)
STATUS: owed
DEVICE: phone
COVERS: recon 2026-08-23 · ledger #206 · `InventoryCount.tsx:290` · R-11
LAST-PROVEN: never
- Start a count **ONLINE** (it refuses to start offline by design). Airplane mode **ON**. Scan a tag you **know** is in inventory.
- **EXPECT** the sheet heading to read **"Couldn't reach the server"** — *not* "Didn't recognize this" — and the body to end with *"You can still record what you counted with **Skip & flag** — it saves on this phone and syncs when you're back in range."*
- 🔴 **AND THE HALF THIS CARD EXISTS FOR: the typed-entry fields are STILL THERE and still usable.** The honest failure must not lock her out of the sheet; the walk still has to be recordable in a dead zone.
- Press **Skip & flag**. **EXPECT** the count to record and *"N waiting to sync"* to go **up**.
- Now type a **variety name and size** into the same sheet and press the save/count button instead. **EXPECT** a refusal reading *"…We can't check whether "&lt;name&gt;" is already in your inventory, and adding it without checking would split one variety into two. Use Skip & flag to record the count now."*
- 🔴 **That refusal is the point: it must NOT create a new variety.** Airplane mode **OFF**, open `/inventory`, and **EXPECT NO new row** for that name.
- **FAIL:** the heading still says "Didn't recognize this" · the typed fields are gone · a new variety row appears · the sheet mentions checking the tag.
- **NO CONSOLE.**

### 9. Online, a tag that genuinely does NOT exist still reads as a miss  (THE MIRRORED-DEFECT GUARD)
STATUS: owed
DEVICE: phone
COVERS: recon 2026-08-23 · ledger #206
LAST-PROVEN: never
MEASURED: 2026-08-24 — ✅ **RUN, AND REPORTED PASS. THIS CARD IS DAVID'S T4 (a real miss while online) — RE-MAPPED HERE BY CONTENT.** 🔴 **It was previously annotated onto card 3 and card 4 by INTEGER COLLISION; both of those annotations are removed. T4 belongs here, because this is the card that tests a genuine miss on a live connection.** **MEASURED 2026-08-24 by David — SHA `ebdb186`, iPhone Safari, `cultivar-os.vercel.app`, ONLINE.** **The sheet read "Didn't recognize this", the code was ECHOED BACK, and both endings were offered — add the variety, and "Skip & flag for later".** 🔴 **THE POINT OF THIS CARD HELD: there was NO over-correction to a network message.** A real miss still reads as a real miss, which is the half cards 2 and 8 cannot prove — the #206 fix did not turn every miss into "couldn't reach the server". ⚠️ **`STATUS` STAYS `owed`: Thunder may never write `covered` (OP-14); this is Thunder RELAYING a result, not David recording one.** It flips on David's own entry with a `LAST-PROVEN` date. ⚠️ **Not every clause of this card was exercised** — the `/checkout/scan` half and the *type a genuinely new variety + size and save* step are not covered by the reported result. ⚠️ **Origin is named here but no other card on this board names one (tech-debt #96).**
- 🔴 **WHY THIS CARD EXISTS: a fix that turned every miss into "network error" would be the same defect pointed the other way, and just as wrong in the lot.** Cards 2 and 8 only prove half of it.
- **ONLINE**, with signal confirmed. On `/checkout/scan`, scan (or type into Look up) something that is definitely not in inventory — e.g. `ZZZ-NOT-A-REAL-TAG`.
- **EXPECT** the ORIGINAL sheet: **"Didn't recognize this"** — *"Scanned `ZZZ-NOT-A-REAL-TAG` — it didn't match a stock line. Check the tag, or keep scanning."* **Here that copy is TRUE and must still appear.**
- Repeat on the count screen. **EXPECT** the typed-entry sheet headed **"Didn't recognize this"**, with *"Scanned: `ZZZ-…`"* — not the server message.
- Type a genuinely new variety + size and save. **EXPECT** it to create normally, as it always did.
- **FAIL:** a real miss now claims the server was unreachable · a real new variety can no longer be added while online.
- **NO CONSOLE.**

### 10. The QR plant profile offline blames the server, not the tag  (UNCOVERED SURFACE — a CUSTOMER may be holding it)
STATUS: owed
DEVICE: phone
COVERS: recon 2026-08-23 · ledger #206 · `usePlant.ts` · `PlantProfile.tsx`
LAST-PROVEN: never
- 🔴 **Clear the site's storage first, or use a tag you have NOT opened in the last 24 hours** — otherwise the undocumented 24-hour read cache (`usePlant.ts`, declared at the site as of ledger #206) will serve the page from disk and you will prove nothing. **If the plant renders, the cache answered — pick a different tag.**
- Airplane mode **ON**. Open `/plant/<a real tag>`.
- **EXPECT** the page to read **"Couldn't reach the server"** — *"You're offline — we couldn't reach the server to look this up. Try again once you have a signal."* followed by **"Nothing is wrong with the tag — we just couldn't look it up."**
- 🔴 **The words "Plant not found" and "didn't match any plant in the nursery" must NOT appear**, and neither must "Check the tag and try scanning again."
- Airplane mode **OFF**, reload. **EXPECT** the plant to render normally.
- Now open `/plant/ZZZ-NOT-A-REAL-TAG` **ONLINE**. **EXPECT** the original **"Plant not found"** page — *that* copy is true there and must survive.
- **FAIL:** a raw `TypeError: Failed to fetch` · a "not found" claim while offline · a "couldn't reach the server" claim while online.
- **NO CONSOLE.**

> ⚠️ **NOT CLOSED BY THIS BUILD, AND NAMED SO IT IS NOT ASSUMED:** on a **cache HIT** the profile still
> renders **silently stale** — up to 24h old qty, price and status, with nothing on screen saying so.
> The cache is now DECLARED at its site and in `built-inventory.md`; the staleness SIGNAL is a
> PlantProfile render change with a real design question in it (customer-facing vs operator-facing)
> and was deliberately not invented here.

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

## SURFACE: unit-of-measure (ledger #234 — what a quantity actually MEANS)

> **Five cards.** ✅ **UNBLOCKED 2026-08-30 — `20260830_inventory_unit_of_measure.sql` is APPLIED and catalog-verified (A)–(G), and the
> backfill has RUN: 478 rows written across 3 tenants, zero disagreements.** U1 is **covered** on David's own (F) run. U2–U4 are `owed`:
> Thunder ran the script and the output is recorded below, but **Thunder never sets `covered`** (OP-14) — a re-run by David closes them.
> **The whole point of this build is that NOTHING ELSE ON THIS BOARD SHOULD CHANGE** — if any other
> inventory card behaves differently after this ships, that is the finding, and it outranks all five.

### U1 · The guard lets go — a size change never leaves a stale unit
STATUS: covered
DEVICE: desktop
COVERS: #234
LAST-PROVEN: 2026-08-30 — **David ran verify block (F) himself and reported the result.** `size` moved to `'1 Yard Scoop'` and `unit_kind`, `unit_value` and `unit_parsed_from` ALL WENT NULL: the projection let go rather than continuing to claim the row was a 45-gallon container. Rolled back. **(A)–(G) all pass**: 5 columns correct + nullable · both NAMED CHECKs with the definitions as written and **nothing referencing `size`** · the trigger live BEFORE INSERT OR UPDATE beside the pre-existing `updated_at` one · 578 rows, 0 parsed, nothing rewritten or lost · 5 policies identical to before apply.
SIGNAL: none needed — this is the transaction in the migration's own VERIFY block (F).
- **Do:** in the Supabase **SQL editor**, run verify block **(F)** at the foot of `20260830_inventory_unit_of_measure.sql` verbatim. It is wrapped in `BEGIN … ROLLBACK` and writes nothing permanent.
- **PASS:** the INSERT returns `container | 45 | 45 gal` — a consistent projection survives. The UPDATE to `'1 Yard Scoop'` returns `unit_kind NULL`, `unit_value NULL`, `unit_parsed_from NULL`.
- **FAIL:** the UPDATE returns `container | 45` still — **the projection is now LYING about the row**, and every number derived from it downstream is wrong. Or the UPDATE ERRORS on a check violation — the trigger is missing and the count screen will break the same way.
- **Why:** this is the single behaviour that makes the unit columns a projection instead of a parallel truth. Everything else in this build assumes it.

### U2 · The backfill reports per tenant, and LISTS what it could not read
STATUS: owed
DEVICE: desktop
COVERS: #234
LAST-PROVEN: never — **but RUN by Thunder 2026-08-30 and the output is recorded here.** Thunder never sets `covered` (OP-14); a re-run by David closes it.
SIGNAL: `[TRACE:UNITS] tenant {...}` — one line per business_id, with parsed / refused / notYetParsed / disagreements.
RECORDED RUN (2026-08-30, after apply): **578 rows / 3 tenants.** LAWNS `ed2e5933` **447 rows · 447 parsed · 0 refused · 0 no-size · 447 written**. Test Dave's `f7ec5d67` **130 rows · 31 parsed · 0 refused · 99 no-size · 31 written**. Third `06065fe7` **1 row · 0 parsed · 1 no-size · 0 written**. **478 written, 0 failed, 0 disagreements.** Confirming `--verify` re-run: needing-a-write **0** on every tenant. The three per-tenant totals match David's own pre-backfill catalog counts exactly (447 / 130-of-which-31 / 1), which is an independent cross-check that the script read the whole table and not a page of it.
- **Do:** `npm run units:backfill -- --verify` first (**read-only, writes nothing**). Read the output. Then, if it looks right, `npm run units:backfill` to write.
- **PASS:** one block per tenant, LAWNS labelled. `parsed + refused + no size` equals the tenant's row count exactly. Every unparsed value is **printed as a string**, not just counted. `disagreements` is **0**.
- **FAIL:** any tenant's three buckets do not sum to its row count *(a row fell through the classification)* · `disagreements > 0` *(the guard from U1 is not applied — stop and fix that first)* · the script reports numbers while the migration is unapplied *(it should refuse; a zero here would be a lie)*.
- **⚠️ EXPECTED, NOT A FAILURE:** `notYetParsed` climbing again on later runs. The count screen and the import CREATE path write `size` through RPCs that know nothing about units — deliberately out of scope — so they mint unparsed rows. Re-run; it is idempotent.
- **Why:** *"how many parsed"* is a claim. *"here are the ones I could not read"* is evidence, and it is the only form that lets Lauren or Joel actually answer.

### U3 · The unparsed list — and on LAWNS it came back EMPTY
STATUS: owed
DEVICE: desktop
COVERS: #234
LAST-PROVEN: never — RUN by Thunder 2026-08-30; result below. David's re-run closes it.
SIGNAL: the `unparsed size values` list in U2's output.
🔴 **RESULT, AND IT IS NOT THE EXPECTED ONE: LAWNS REFUSED NOTHING. 447 of 447 parsed, and all 447 are `unit_kind = container`.** The three trade codes this card was written to catch — `3GP`, `1DP`, `2DP` — **are not in `business_inventory.size` at all** (checked directly, all three absent). They came from LAWNS's QuickBooks item descriptions and vendor invoices, which is where the Stage 0 corpus was drawn from; they have never been in this table. ⚠️ **So a 0 here is REAL, not a false green — and the reason it is real is the finding: the 447 rows are exclusively container gallons.** Every other unit family in the corpus (yard scoops, weight bags, bottles, by-the-roll, T-post kits) is in QuickBooks and NOT in the platform. **The refusals will arrive with the 685-item import, not before it** — which is precisely when this card starts earning its keep. Re-run it then.
- **Do:** read U2's unparsed list for LAWNS. Take it to Lauren or Joel.
- **PASS:** the list contains **`3GP`, `1DP`, `2DP`** (and whatever else live data holds), each with a count. Nothing in the catalogue silently became a gallon.
- **FAIL:** the list is empty while rows carry sizes like `3GP` — **the parser guessed**, which is the one thing it must never do.
- **🔴 THE ANSWER IS NOT OURS:** these are LAWNS's own liner/pot codes. Ask what `GP` and `DP` mean and whether the number is gallons. **Do not add them to the parser on a guess** — one sentence from Joel turns three refusals into three correct rows.
- **Why:** §1.6 item 3 — an honest "unknown", never a fabricated value.

### U4 · Fertile Compost Mix flags as ONE product in TWO kinds of unit
STATUS: owed
DEVICE: desktop
COVERS: #234
LAST-PROVEN: never — RUN by Thunder 2026-08-30; result below.
SIGNAL: `⚑ MULTI-UNIT FAMILIES` in U2's output.
🔴 **RESULT: NO FAMILY FLAGGED ON ANY TENANT, AND THAT IS CORRECT RATHER THAN A FAILURE — now MEASURED, where before it was predicted.** All 447 LAWNS rows and all 31 sized Test Dave's rows are `unit_kind = container`; **a flag needs two KINDS in one `variant_group` and there is only one kind in the whole database.** The five compost SKUs are QuickBooks items and have never been `business_inventory` rows. **This card cannot fire until the import runs, and the day it does is the day it matters.** The detection itself is proven over a fixture in `npm run verify` (the five real compost SKUs, `container + volume`, all five named).
- **Do:** look for the `⚑ MULTI-UNIT FAMILIES` block in U2's output.
- **PASS:** the compost family is named, reported as `container + volume`, and **all five rows are listed by name** — FCMB15/30/45 and SFCM1/SFCM2.
- **FAIL:** the family is silently merged, converted, or offered as a picker. **None of those should exist.** This pass REPORTS; it does not reconcile.
- **🔴 WHAT THIS CARD IS ACTUALLY FOR — the question for Lauren:** *is compost STOCKED in yards, or in buckets?* One yard is roughly thirteen 15-gallon buckets of the same pile, and until she says which is the real stock unit, nothing can convert between them without inventing a number. **Her answer is the input to the next pass.**
- **Why:** the flag makes a real ambiguity visible instead of letting five SKUs quietly count five different things.

### U5 · Nothing about `size` behaves differently — the headline card
STATUS: owed
DEVICE: phone
COVERS: #234
LAST-PROVEN: never
SIGNAL: `[TRACE:INVENTORY] patch { fields: [...] }` — the field list now includes the `unit_*` keys on a size edit. That is the ONLY visible change.
- **Do:** run the ordinary size surfaces you already know, and watch for anything different. (1) On `/inventory`, **edit a Size cell** on a grouped row. (2) **Scan a multi-size variety** on the count screen and confirm the size picker still offers its sizes. (3) **Scan the same variety in an order** and confirm the customer-facing size chooser still appears. (4) Check the dup-size amber flag still shows on whatever rows it showed on yesterday.
- **PASS:** all four behave **exactly as before**. The size picker offers the same sizes in the same order; the dup-size flag count is unchanged; the grid's Size column edits and saves as it always did.
- **FAIL:** the size picker offers a different set, refuses where it used to fire, or fires where it used to refuse · the dup-size flag count changes · a size edit no longer saves · **any `unit_` column appears anywhere on any screen**.
- **🔴 WHY THIS IS THE CARD THAT MATTERS MOST:** the build's whole promise is *"no existing reader of `size` changes behaviour"*, and 24 of the 24 reader/decider files were proven unchanged by diff. **This card is the human half of that proof** — a diff shows nothing was edited; only a walk shows nothing broke.
- **⚠️ If the migration is NOT yet applied when you run this, that is fine and the card still means something:** the write path degrades and drops the unit keys, so this is the case that proves the deploy-window gate works.

---

## SURFACE: staff-can-count (ledger #238 — a yard hand's walk actually finishes)

> **Four cards, and C1 is the whole build.** 🔴 **THE DEFECT WAS SILENT, WHICH IS WHY IT WAS NEVER
> REPORTED.** `business_inventory` gates UPDATE on `inventory:update`; a STAFF member holds
> `inventory:read` and not that. The count screen finished each scan with a plain UPDATE writing
> `variant_group` — and **a PostgREST update RLS refuses matches zero rows and returns NO ERROR**,
> which `syncEngine.ts:258-259` reads as success. So the walk never died and nobody was told
> anything: **the count landed, the grouping did not, and the bill arrived on the NEXT scan**, when
> the family resolved UNKNOWN. On the D-45/D-46 multi-size path, which at LAWNS is the common case.
>
> ⚠️ **SO "THE WALK COMPLETED" IS NOT THE PASS.** It completed before this build too. The pass is
> that **the grouping is actually there afterwards** — which is why every card below re-scans.
>
> **RUN AS STAFF ON TEST DAVE'S (`f7ec5d67-a9ef-4cb0-b807-438d67687d1b`) — NEVER LAWNS.**
> `user.obrien@outlook.com` is a real STAFF member there. Requires `20260830c` APPLIED.

### C1 · 🔴 A STAFF MEMBER COUNTS A MULTI-SIZE VARIETY AND THE FAMILY IS ACTUALLY GROUPED
STATUS: owed
DEVICE: phone
COVERS: #238, D-45, D-46, R-12
LAST-PROVEN: never
SIGNAL: `[TRACE:INVENTORY] promote — grouped sizes` (secondary — the PASS below needs no console)
- **Do:** signed in as **STAFF**, open `/inventory` → **Start count**. Scan a variety that has more
  than one size. Enter a count for one of them. Save.
- **Then — THIS IS THE ACTUAL TEST — scan the SAME tag again.**
- **PASS:** the **size picker fires**, listing that variety's sizes. The walk finished AND the
  grouping landed.
- **FAIL:** the second scan resolves **UNKNOWN** and falls through to typed entry. That is the
  defect: the count saved, the grouping did not, and nothing said so.
- **ALSO FAIL:** an error on save that stops the walk. The fix is meant to let the walk finish, not
  to make it fail loudly instead of quietly.

### C2 · A count of a size the variety does NOT have still lands, and the family stays whole
STATUS: owed
DEVICE: phone
COVERS: #238, D-46
LAST-PROVEN: never
- **Do:** as **STAFF**, count a size the variety doesn't have yet (e.g. `20 gal`) on a family whose
  rows are not all grouped.
- **PASS:** the new row appears AND re-scanning shows the picker with **every** size — parent and
  new sibling together.
- **FAIL:** the picker shows only some sizes, or resolves UNKNOWN. A half-keyed family is the
  mixed-group state this card exists to catch.

### C3 · 🔴 NOTHING WAS WIDENED — STAFF still cannot edit the inventory grid
STATUS: owed
DEVICE: desktop
COVERS: #238, tech-debt #124
LAST-PROVEN: never
- **Why it is here:** the easy way to "fix" C1 is to grant STAFF `inventory:update`. That would
  widen the first name on tech-debt #124's over-wide list and hand a yard hand price and qty in
  order to let them group two pot sizes. This card is the assertion that we did not do that.
- **Do:** as **STAFF**, open `/inventory` and try to change a quantity or a price in the grid.
- **PASS:** it is refused — and the refusal is **visible**, not a cell that appears to accept the
  edit and reverts.
- **FAIL:** the edit lands. The wall moved when only the narrow act was supposed to.

### C4 · MANAGER and OWNER behave exactly as they did before
STATUS: owed
DEVICE: either
COVERS: #238
LAST-PROVEN: never
- **Do:** repeat C1 as **MANAGER** (`test.obrien@outlook.com`, who is NOT `owner_id`) and as OWNER.
- **PASS:** identical to before this build, in both directions — the count completes, the picker
  fires on re-scan, and the inventory grid is still editable for them.
- **FAIL:** any difference at all. This build was supposed to be invisible to everyone who already
  held `inventory:update`.

> **A MACHINE PROOF EXISTS FOR THE POLICY HALF, AND IT IS NOT A SUBSTITUTE FOR THESE CARDS.**
> `npm run verify:rls -- count-group` runs `scripts/rls/count-group-variant-sizes.rls.mjs`, which
> signs in as a real ephemeral STAFF member and asserts the silent refusal, the RPC fix, the column
> boundary, the shortfall report, no-forgery, AC-3, and that no policy moved. It proves **the
> policy and the function**. These cards prove **the screen**. Only David's run closes them (OP-14).

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

**Not run (no test written — OP-14 debt):** delete soft/hard · frozen column · **order-picker read**.

**Offline / store-and-forward — NO LONGER IN THIS LIST, and the correction is worth stating:** it was
`offline sync` here because **no test was written**, never because the mechanism was missing. The
mechanism was located from code on 2026-08-23 and cards now exist. **TEN, of which SIX are now
`owed` (ledger #207)** — cards 1, 2, 5, 8, 9, 10 written and awaiting David's run; 3, 4, 6, 7
`needs-test`. **Card 5 flipped `needs-test` → `owed` when the swallowed-storage defect was fixed**
and is the one to run on the logout-loop device: same storage, plausibly the same cause.
🔴 **CARD 2 WAS WRITTEN THE SAME DAY AS *EXPECTED TO FAIL* AND HAS BEEN REWRITTEN TO ITS PASSING
FORM — the resolver's third state landed in ledger #206**, so the offline scan now names the server
instead of the tag. **CARD 4 IS STILL EXPECTED TO FAIL** (the cart does not survive a reload) and is
deliberately left that way: cart persistence was NOT in this build's scope.
Cards 8/9/10 came with that fix — the count loop's honest-but-still-usable sheet, the mirrored-defect
guard (**a real miss must STILL read as a miss**), and the QR profile. A card that predicts its own
failure is still a card — the hole is recorded rather than rediscovered.

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
STATUS: covered
DEVICE: phone
COVERS: D-52
LAST-PROVEN: 2026-07-22
SIGNAL: `[TRACE:INVENTORY] D-52 commit — units COMMITTED, on-hand deliberately UNCHANGED`
- **Do:** note a lot's **On hand** in the inventory grid. Place an order for 2 of it choosing **Delivery**. Reload the grid.
- **PASS:** **On hand is UNCHANGED.** Committed shows **2**. Available dropped by **2**.
- **FAIL:** On hand dropped — the decrement did not move, and this build's central claim is false.
- **Why:** the plant is still standing in the yard. Saying it left because someone ordered it is the thing D-52 corrects.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** order `897be269` (delivery) wrote `order_created` + `order_committed` at 16:49:15 with **delta 0** — on-hand UNTOUCHED and **no `sale` event at all**. The D-42→D-52 relocation, proven at the event level rather than inferred from a grid number.

### Marking it FULFILLED is what drops on-hand 🔴
STATUS: covered
DEVICE: desktop
COVERS: D-52
LAST-PROVEN: 2026-07-22
SIGNAL: `[TRACE:INVENTORY] D-52 fulfilled — on-hand decremented at departure`
- **Do:** open that order, set status **Fulfilled**. Reload the grid.
- **PASS:** **On hand drops by 2.** Committed returns to **—**. Available is unchanged *from the committed state* (the units were already not sellable).
- **PASS:** the ledger has a `sale` row dated **now** (the fulfillment moment), not the checkout moment.
- **Why the date matters:** reconcile subtracts against this timestamp. Dating a sale at checkout claims stock left on a day it demonstrably had not.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** the same order wrote `order_fulfilled` + `sale −6` at **16:53:34** — the same instant as each other, and **four minutes after checkout**. The sale is dated at departure, not at order.

### A WALK-IN collapses both into one instant 🔴
STATUS: covered
DEVICE: phone
COVERS: D-52
LAST-PROVEN: 2026-07-22
SIGNAL: `[TRACE:INVENTORY] lot qty adjusted … 'walk-in sale decrement (commit+fulfill collapsed)'`
- **Do:** checkout on a countable lot choosing **"No thank you — I'll haul it myself."**
- **PASS:** On hand drops **immediately**. Committed stays **—** (it never sat committed). The order shows **Fulfilled**, not Pending.
- **PASS:** the ledger holds `order_created`, `order_committed`, `order_fulfilled` and one `sale` — all sharing a timestamp.
- **⚠️ The order being born Fulfilled is deliberate**, not a bug: the customer has the plant. Leaving it Pending would count units as committed that are already on someone's trailer, permanently understating what you can sell.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** a self-transport checkout wrote `sale −2` at **17:06:50 — at checkout**, commit and fulfill collapsed into one instant with no separate fulfill step. **One model, two spacings** — the delivery order above and this walk-in differ only in how far apart the events sit.

### Oversell is refused against AVAILABLE, with stock visibly on hand 🔴
STATUS: covered
DEVICE: phone
COVERS: D-52
LAST-PROVEN: 2026-07-22
SIGNAL: `[TRACE:INVENTORY] REFUSED — insufficient AVAILABLE`
- **Do:** find a lot with **exactly N** on hand. Place a **delivery** order for all N (do not fulfil it). Now try to order **1 more** of the same lot.
- **PASS:** the second order is **REFUSED**, and the message reads *"Only 0 … available to sell (N on hand, N committed to open orders)"*.
- **PASS:** the grid still shows **On hand = N** — the stock is genuinely there, and correctly not sellable.
- **Why this is the card that justifies the build:** under D-42 this second order would have **succeeded**, selling the same physical plants twice. The message names both numbers on purpose — *"only 0 in stock"* against a lot you can see holding N reads as a bug.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** the checkout review refused and named both figures — **"0 available (29 on hand, 57 committed)"**. Refused against AVAILABLE with the stock visibly on hand.

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
STATUS: covered
DEVICE: desktop
COVERS: #145
LAST-PROVEN: 2026-07-22
SIGNAL: `[TRACE:RECONCILE] load ok` — `baseline:` count > 0, `delta:` 0 on a never-counted tenant
- **Do:** open **/inventory/reconcile** on lots that have never been counted.
- **PASS:** there is **no "Since last count" column at all** — not an empty one.
- **FAIL:** an empty "sold" column renders. An empty column on a clean slate reads as a broken feature, which is exactly what the demo must not show.
- **Why:** baseline has no window. A column with nothing in it invites the question "why is this blank?" on the screen meant to prove how easy this is.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** reported green as part of the full-surface run. *(No itemized figure cited for this card — it rests on David's "all cards green" report rather than a quoted number.)*

### A baseline Accept stamps the count as on-hand, with your name and the time 🔴
STATUS: covered
DEVICE: desktop
COVERS: #145
LAST-PROVEN: 2026-07-22
SIGNAL: `[TRACE:RECONCILE] accept — plan` then `accept — step ok` with a `ledgerId`
- **Do:** pick a real lot. Note its **Book on-hand**. Type a different count. Press **Accept**, read the "What Accept writes" box, confirm.
- **PASS:** the sheet lists exactly **ONE** step (`count_reconcile`). On-hand becomes your counted number.
- **PASS (the actual proof, in SQL):** a `business_inventory_ledger` row, `kind='count_reconcile'`, `reason='baseline'`, `occurred_at` = **now**, `actor_user_id` = **your uid** — not null, not the system.
- **FAIL:** `actor_user_id` is NULL. This screen is always driven by a signed-in human; a null actor here would mean the page could not name who asserted the count.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** lot `3ec53db3` (Shoal Creek Vitex 45), book **60** → counted **58**. Accept wrote **ONE** `count_reconcile`, **delta −2**, `actor_user_id` **95c1b2e9** (not null), reason carried, qty → **58**. Stamped, dated, attributed truth through the surface — never a silent overwrite.

### Nothing is written until you Accept 🔴
STATUS: covered
DEVICE: desktop
COVERS: #145
LAST-PROVEN: 2026-07-22
SIGNAL: no `[TRACE:RECONCILE] accept` line at all
- **Do:** type counts into **three** rows. Do **not** press Accept. Reload the page.
- **PASS:** all three lots still show their **original** book on-hand; `SELECT count(*) FROM business_inventory_ledger` is **unchanged**.
- **Why:** the log is append-only. A screen that wrote on blur or on navigate would put un-retractable rows in it for a number someone was still typing.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** reported green as part of the full-surface run. *(No itemized figure cited — rests on the "all cards green" report.)*

### DELTA mode replays the window and names the movements 🔴
STATUS: covered
DEVICE: desktop
COVERS: #145
LAST-PROVEN: 2026-07-22
SIGNAL: `[TRACE:RECONCILE] load ok` — `delta:` > 0
- **Do:** on the lot you just baselined, place a **delivery** order for 2 and mark it **Fulfilled** (that is the D-52 moment stock actually leaves). Return to /inventory/reconcile.
- **PASS:** that lot now reads **DELTA**; "Since last count" says **2 sold — 1 order**.
- **PASS:** count the physical truth (book − 2). The math cell reads **agrees — done**, and Accept asks for **no attribution**.
- **Why:** the sale is already on the ledger and already in the book. A screen that made you explain a sale it recorded itself would be asking you to account for its own arithmetic.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** the evidence strip read **"6 sold — 1 order"** against the D-52 delivery order above, and at counted **38** vs book **40** only the **−2** residual surfaced for attribution. **The sales-netting math works on real events** — the 6 it recorded itself was never put to the owner to explain.

### ⚠️ A RECEIVE in the window must NOT read as a residual 🔴
STATUS: covered
DEVICE: desktop
COVERS: #145
LAST-PROVEN: 2026-07-22
SIGNAL: `[TRACE:RECONCILE] load ok`, then the row's math cell
- **Do:** on a DELTA lot, add stock (any path that writes a non-`sale` ledger row — a manual qty edit on /inventory works). Then reconcile, counting the lot **honestly** (i.e. matching book).
- **PASS:** residual is **0**. The "Since last count" strip names **both** the sale and the adjustment.
- **FAIL:** a nonzero residual appears and the sheet asks you to attribute it to dead/lost. **This is the exact defect the build spec's formula would have shipped** — subtracting only sales turns every receive into phantom shrinkage.
- **Why:** it would ask a human to account, permanently and by name, for a movement the system itself recorded.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** a **+5 desk edit** was absorbed into expected — residual **0**, itemized as *"5 adjusted by hand"*, **not phantom shrinkage**. **Fix A held:** expected is a full replay of every delta, not `prior_count − sales`.

### ⚠️ Attribution SPLITS the delta — it must not decrement twice 🔴
STATUS: covered
DEVICE: desktop
COVERS: #145
LAST-PROVEN: 2026-07-22
SIGNAL: `[TRACE:RECONCILE] accept — plan` — read `netDelta` and compare it to (counted − book)
- **Do:** on a DELTA lot holding (say) 30, count **13**. Attribute **4 dead** and **3 lost**. Read the "What Accept writes" box **before** confirming.
- **PASS:** exactly **THREE** steps — `dead → 26`, `loss → 23`, `count_reconcile → 13`. The **last** step lands on **13**.
- **PASS:** after accepting, on-hand is **13** — and `SUM(delta)` for the three new rows is **−17**, not −24.
- **FAIL:** on-hand ends at **6**, or the ledger sums to −24. That is the double-decrement — **7 plants invented as dead** in a log that cannot be retracted.
- **Why:** both RPCs move qty. Running a full `count_reconcile` and *then* the attributions applies the shrinkage twice.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** **−17 partitioned into `dead −4` + `loss −3` + `count_reconcile −10` = exactly −17**, landing on **46**. **Not −24.** **Fix B held:** attribution splits the delta, it never adds a second movement. The 7 invented dead plants did not happen.

### The plan refuses to drive on-hand below zero 🔴
STATUS: covered
DEVICE: desktop
COVERS: #145
LAST-PROVEN: 2026-07-22
SIGNAL: the refusal text in the sheet; **no** `[TRACE:RECONCILE] accept — plan` line
- **Do:** on a lot holding 3, count 0 and attribute **9 dead**.
- **PASS:** refused **before any write**, and the message **names the number** — "9 dead is more than the 3 this lot has on hand".
- **FAIL:** a bare "invalid input", or a partial write that lands the first step and then errors.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** reported green as part of the full-surface run. *(No itemized figure cited — rests on the "all cards green" report.)*

### `qty == SUM(delta)` still holds after a reconcile 🔴
STATUS: covered
DEVICE: desktop
COVERS: #145
LAST-PROVEN: 2026-07-22
SIGNAL: — (SQL)
- **Do:** re-run D-50 Layer 1's **V3(b)**: every lot's `qty` equals the `SUM(delta)` of its ledger rows.
- **PASS:** **0 rows** disagree, with this build's reconcile events included in the sum.
- **Why:** this is the one check that proves the new writer did not break the guarantee the whole ledger rests on.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** **V3(b) returned ZERO rows across all lots**, with every reconcile write of this session counted in the sum. `qty == SUM(delta)` survived its new writer.

## SURFACE: sellability (the ONE predicate — cap, not just display)
_`checkSellable()` in `src/lib/inventoryStates.ts` is the single answer to "can this be sold?" — read by the scan picker, the scan review sheet, and the anonymous QR page. The server refusal in `submit.ts` STAYS as defence in depth._

> **GATE 0 APPLIES.** Confirm the Vercel deploy for the SHA under test is READY and the stamp says it.

### DISC-1105 cannot be ADDED, not merely labelled correctly 🔴
STATUS: owed
DEVICE: phone
COVERS: #147
LAST-PROVEN: —
SIGNAL: the review sheet's red reason block; no `[TRACE:CART] scan-add` line
- **Do:** on **/checkout/scan**, reach **DISC-1105** (29 on hand, 57 committed) via scan or search.
- **PASS:** the picker line reads the blocking reason; the review sheet shows **"None available to sell (29 on hand, 57 committed)"**, the quantity stepper is **gone**, and the button reads **"Can't be added"** and is **disabled**.
- **FAIL:** it adds to the cart. That is the live defect — display fixed, cap missing, refusal five screens later at review.
- **Why:** a picker that offers stock the server will refuse teaches the owner to distrust the refusal, not the picker.

### A DAMAGED lot cannot be sold anywhere 🔴
STATUS: owed
DEVICE: phone
COVERS: #147
LAST-PROVEN: —
SIGNAL: `[TRACE:INVENTORY] QR page sellability` — `reason: 'condition'`
- **Do:** mark a healthy, priced lot **damaged** in /inventory. Try to add it at **/checkout/scan** AND at its **QR page**.
- **PASS:** both refuse, and both say **"Marked damaged — clear the condition in Inventory before selling it."**
- **PASS:** the reason is about CONDITION, not quantity — a damaged lot holding 50 must **not** be described as "0 available".
- **Then:** set status back to the **derived** option and confirm it sells again — the condition flag is not a one-way door.

### A healthy lot still sells normally 🔴
STATUS: owed
DEVICE: phone
COVERS: #147
LAST-PROVEN: —
SIGNAL: `[TRACE:CART] scan-add`
- **Do:** add **DISC-1104** (10 available) at /checkout/scan.
- **PASS:** adds normally; the stepper stops at **10** and the + button greys at the cap.
- **FAIL:** the cap blocks a healthy lot. A guard that blocks good sales is worse than the bug it fixed.

### Scanning the SAME lot twice cannot exceed its available 🔴
STATUS: owed
DEVICE: phone
COVERS: #147
LAST-PROVEN: —
SIGNAL: the review sheet's availability note on the second scan
- **Do:** on a lot with 10 available, add **10**. Scan it again.
- **PASS:** the second sheet reports **none available** and refuses — the units already in this cart count as committed.
- **Why:** without this, a 10-lot scans twice into a 20-line and the refusal waits for the server.

### The status control offers only what it owns 🔴
STATUS: owed
DEVICE: desktop
COVERS: #147
LAST-PROVEN: —
SIGNAL: `[TRACE:invsheet] edit … field: 'status'` — note `selected` vs the persisted `to`
- **Do:** open the Status dropdown on any /inventory row, and on the Edit sheet.
- **PASS:** exactly **four** entries — **`available (derived from qty)`** (or `depleted`, matching that row's qty) plus **damaged · returned · archived**. **No `reserved`. No settable `available`/`depleted`.**
- **PASS:** choosing the derived option on a damaged lot **clears** it back to available/depleted per qty.
- **Why:** David set `depleted` by hand on a lot holding 29 and it still sold — correctly, since status derives from qty. A control that appears to do something and doesn't is a fake surface (D-9).

### The server refusal still fires 🔴
STATUS: owed
DEVICE: phone
COVERS: #147
LAST-PROVEN: —
SIGNAL: `[TRACE:INVENTORY] REFUSED — insufficient AVAILABLE`
- **Do:** build a cart, then have someone else commit the stock (or edit qty down) before submitting.
- **PASS:** submit still refuses server-side with the named numbers. **The UI cap is a courtesy, not the authority.**
- **FAIL:** the order goes through because "the UI already checked". That would make the cap load-bearing, which it must never be.

### ⚠️ KNOWN GAP — the anon QR page still cannot see committed 🔴
STATUS: needs-test
DEVICE: phone
COVERS: #147
LAST-PROVEN: —
SIGNAL: `[TRACE:INVENTORY] QR page sellability — committed NOT derivable for anon (#66)`
- **Reason it is `needs-test`, not `owed`:** this cannot PASS today. `order_items` RLS is `authenticated_*`, so an anonymous scanner cannot derive committed at all. The page now says **"in stock"** (on-hand — the honest word) instead of "available", and caps at on-hand, but **a fully-committed lot will still let an anonymous customer build a cart.** The server refuses at submit, so it is a late-refusal UX gap, not an oversell hole.
- **The fix, PROPOSED not built (it is a migration):** `SECURITY DEFINER public.lot_available(uuid) RETURNS int`, GRANTed to `anon`, returning **only the derived integer** — no order rows, no customer data. Closes #66 without widening `order_items` RLS and without a new api function. **David's call.**

---

### ⚠️ REGRESSION — the genesis row must not be replayed as a movement 🔴
STATUS: covered
DEVICE: desktop
COVERS: #146
LAST-PROVEN: 2026-07-22
SIGNAL: the row's math cell — the "ledger replays to X but book says Y" line
- **Do:** open **/inventory/reconcile** on lot **3ec53db3** (Shoal Creek Vitex 45). Do not enter a count.
- **PASS:** the replay figure **equals the book** and the *"ledger replays to X but the book says Y"* line **does not render**.
- **FAIL:** the replay reads ~2× the book, or the mismatch line appears against a lot whose SQL replay is clean.
- **Cross-check (SQL):** `SELECT COUNT(*), SUM(delta) FROM business_inventory_ledger WHERE inventory_id='3ec53db3-…';` — the screen must agree with that number.
- **⚠️ FIXTURE NOTE (2026-07-22):** this card originally asserted the literal figures **58 / 2 rows**. That was correct when written; the same lot was then used for the ATTRIBUTION-SPLIT card, which legitimately moved it to **46** with more rows. The card now asserts the **invariant (replay == book, no banner)** rather than a frozen number — a fixture that drifts by design must not be pinned to a constant, or it manufactures a false FAIL on its next run.
- **Why it was load-bearing:** DELTA-mode `expected` is computed from replay. A doubled replay makes expected ~2× reality and surfaces a **phantom surplus** — asking the owner to account for stock that never existed. Same failure class as the `prior−sales` bug this build already corrected.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** replay read **46**, agreeing with book **46**, and the *"replays to X but book says Y"* banner **disappeared**. ⚠️ **The root cause in the original report was WRONG** — it was not a table+view double-read (there is exactly ONE read); it was the genesis `opening_balance` being both **seeded AND summed**. `isMovement()` now distinguishes a **position-assertion** from a **change**.

### ⚠️ REGRESSION — the checkout picker shows AVAILABLE, not on-hand 🔴
STATUS: covered
DEVICE: phone
COVERS: #146
LAST-PROVEN: 2026-07-22
SIGNAL: the picker sub-line under each size/match
- **Do:** on **/checkout/scan**, search a term matching **Shoal Creek 30 (DISC-1105)** so the multi-match picker opens. Compare against /inventory's **AVAILABLE** column for the same lot.
- **PASS:** the picker reads **0 available (29 on hand, 57 committed)** — the same number the grid shows, with both figures named.
- **FAIL:** it reads **"29 available"**. That is raw on-hand wearing the word available, and it offers stock the server will then refuse at submit.
- **Why both numbers are named:** a bare "0 available" against a lot the owner can see holding 29 reads as a bug, not a rule — the same reason D-52's refusal copy names both.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** the picker read **"0 available (29 on hand, 57 committed)"** — matching the grid's AVAILABLE column exactly.

### The unresolved-scan queue reads, and offers nothing it cannot do 🔴
STATUS: covered
DEVICE: desktop
COVERS: #145
LAST-PROVEN: 2026-07-22
SIGNAL: `[TRACE:RECONCILE] load ok` — `unresolvedScans:`
- **Do:** have (or make) an unrecognized scan during a phone count, then open /inventory/reconcile.
- **PASS:** an amber card lists it with its label, qty, time, and raw scan — **and says plainly that resolving it is not built yet.**
- **FAIL:** a "Resolve" button exists. A control that looks actionable and isn't is a dead affordance (§1.6 item 5); saying so is the honest form.
- **✅ PROVEN 2026-07-22 (David, live — `aca0b5d`/`679fb9a`, tenant `f7ec5d67`):** the queue rendered **3 unrecognized scans** with honest copy and **no fake Resolve button**.

| `[TRACE:SYNC]` | the offline queue depth + drain |

---

## SURFACE: csv-import
_The second half of onboarding: `/inventory/import` (owner-only, desktop). Load a grower price list, map columns to the spine, review a per-row plan, Accept. Two steps; nothing written until Accept. Prove all 14 with `docs/owner-tests/fixtures/test-grower-pricelist-FIXTURE.csv` and WITHOUT a console._

### 1 — `Ready` maps to qty only AFTER you confirm it (L3 never auto-applies)
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
- **Do:** upload the fixture. On the mapping step, find the **`Ready`** column.
- **PASS:** it shows an amber **"guessed — confirm"** control; its values do NOT import as quantity until you click confirm (or pick "Quantity on hand" yourself).
- **FAIL:** `Ready` is silently mapped to quantity with no confirm — an L3 guess that auto-applied.
- **Why:** `ready` is deliberately NOT a synonym; it is inferred from its integer values and must be confirmed (a guess that acts on its own is how the wrong column becomes stock).

### 2 — `Cont.` maps to size by synonym, and the rung is visible
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
- **Do:** on the mapping step, find **`Cont.`**.
- **PASS:** it reads **Size / container**, and the "Why" column says **known synonym**.
- **FAIL:** it lands unmapped, or the reason for the match is not shown.

### 3 — Every mapping is overridable, including an exact match
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
- **Do:** change any column's "Maps to" dropdown — including one the system matched confidently.
- **PASS:** the override sticks and drives the plan.
- **FAIL:** a matched column is locked / not editable.

### 4 — The five descriptive columns land in the attribute bag under their own names
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
- **Do:** leave **Sun, Height, Spread, Notes, Zone** as "Keep as a note (attribute)". Accept, then open one imported lot.
- **PASS:** those five values are preserved on the lot, keyed by the grower's own header names, verbatim.
- **FAIL:** a descriptive column is dropped, renamed, or forced into a spine field.

### 5 — 🔴 `Wholesale` is FLAGGED as spine-shaped, held in the bag, and nothing computes on it
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
- **Do:** on the mapping step, find **`Wholesale`** (a currency column).
- **PASS:** it is flagged **"looks like money — kept as a note, nothing computes on it"**; it lands in the attribute bag and NO price/margin is computed from it.
- **FAIL:** it is silently mapped to sell price, or silently bagged with no flag.
- **Why:** a blob field may never be money — making Wholesale a real field is a spine decision + a migration, not something an import invents.

### 6 — The basis question is asked ONCE; "I don't know" writes NULL
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
- **Do:** on the mapping step, use the single **"What does each price apply to?"** control; choose **"I don't know — leave it blank"**. Accept, then open a priced lot.
- **PASS:** asked exactly once for the whole file; the lot's price basis is **blank** (not a guessed unit).
- **FAIL:** asked per row, or "don't know" writes a fabricated basis.

### 7 — Possessive and wrapping-quoted names resolve on the first pass
STATUS: owed
DEVICE: desktop
COVERS: #148, #132
LAST-PROVEN: —
- **Do:** review the plan for **Basham's …**, **Hearts A'fire …**, and **'Sierra' Mexican Red Oak**.
- **PASS:** each resolves to a verdict (UPDATE / CREATE / FILL) against the right variety — none falls to "no name" or an unexpected new variety because of the apostrophe/quotes.
- **FAIL:** an apostrophe or wrapping-quote name mis-resolves.
- **Note:** on your live catalog, Basham's and 'Sierra' also carry a red **item-# collision note** and default unchecked — that is **card 20** (the item # never sources); the NAME resolution proved here is separate and still holds.

### 8 — The size-less Alley Cat row is HELD as AMBIGUOUS and names its candidate sizes
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
- **Do:** review the **Alley Cat** row (no size, multi-size family).
- **PASS:** verdict **AMBIGUOUS**, with a size picker listing the family's sizes; it is excluded from the Accept count until you pick one.
- **FAIL:** it silently picks a size, or creates a size-less row.

### 9 — 🔴 The Shoal Creek CONFLICT row does NOT overwrite the count by default
STATUS: owed
DEVICE: desktop
COVERS: #148, #150
LAST-PROVEN: —
- **Do:** review the **Shoal Creek Vitex · 45 gal** row (lot `3ec53db3`, physically counted at 38 on 2026-07-22; the CSV says 99). _(The fixture's `45 gal` row exists to exercise this against your real counted lot — the earlier `30 gal` row routes to CREATE and never reaches CONFLICT.)_
- **PASS:** verdict **CONFLICT**; it shows counted **38** vs CSV **99** and is EXCLUDED from Accept until you tick the overwrite box. Left untouched, Accept never changes its qty **or its price** (stays 205.00, not the file's 310.00).
- **FAIL:** the CSV qty (or price) lands on a counted lot without ticking overwrite.
- **Why:** David's ruling 2026-07-23 — a CSV may never overwrite a physical count unless the owner says so explicitly, per row.
- **Note — the hold is WHOLE-ROW (stated for David's question):** a CONFLICT holds the **entire row**, not just the quantity. Un-ticked → nothing writes (qty stays 38, price stays 205.00). Ticked → both land (qty→99 **and** price→310.00). The checkbox says so. This matches the "held rows don't count until you resolve them" contract; if you want a CONFLICT to let the safe fields (price/notes) flow while holding only the qty, that is a deliberate change — flagged, not assumed.

### 10 — 🔴 `$0.00` and blank prices land as UNKNOWN; those lots stay NOT sellable
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
- **Do:** review the **'Sierra' 45 gal** ($0.00) and **Texas Mountain Laurel** (blank price) rows. Accept. Try to sell one on /checkout/scan.
- **PASS:** neither writes a price; both lots have NO sell price and checkout refuses them as unpriced.
- **FAIL:** either lands at price 0 (as if free) or becomes sellable.
- **Why:** $0.00 and blank are BOTH unknown (D-9); an unknown price is never "free".

### 11 — The quoted-comma row, the padded name, and the blank line all parse correctly
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
- **Do:** confirm the plan has the right number of rows and that **Hearts A'fire** (quoted "Full sun, part shade") and **`  Shoal Creek Vitex  `** (padded) resolved.
- **PASS:** the embedded comma did not split a column; the blank line produced no phantom row; the padded name resolved to Shoal Creek.
- **FAIL:** an extra/short row, or a padded name failing to resolve.

### 12 — Nothing is written until Accept
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
- **Do:** upload, map, preview the plan — then leave the screen (Back to inventory) without Accepting.
- **PASS:** the catalog is unchanged; no new lots, no qty moves.
- **FAIL:** any row landed before Accept.

### 13 — 🔴 After Accept, `qty == SUM(delta)` holds and every qty change names the import
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
SIGNAL: `[TRACE:IMPORT] setLot / create` and the ledger
- **Do:** Accept a plan that includes qty changes. Then run V3(b): `SELECT bi.id FROM business_inventory bi WHERE bi.qty <> (SELECT COALESCE(SUM(l.delta),0) FROM business_inventory_ledger l WHERE l.inventory_id = bi.id)` (David-query).
- **PASS:** **ZERO rows.** Each imported qty change has a ledger row of `kind='import'` whose `reason` names the CSV file, with the real actor.
- **FAIL:** any row where qty ≠ SUM(delta), or a bare UPDATE with no ledger row, or a `count_reconcile` row minted by the import.

### 14 — A price-only change writes NO ledger event
STATUS: owed
DEVICE: desktop
COVERS: #148
LAST-PROVEN: —
- **Do:** import a row that changes only a lot's price/notes (qty already agrees, e.g. Hearts A'fire at 8). Check the ledger for that lot.
- **PASS:** the price/attributes updated; NO new ledger row was written (a price is not a movement).
- **FAIL:** a ledger row appears for a price-only change.

### 15 — 🔴 A row that fails mid-write is NAMED, not swallowed
STATUS: owed
DEVICE: desktop
COVERS: #148, #149
LAST-PROVEN: —
SIGNAL: the done screen lists `Row N: created the lot, but its stock didn't land …` per failed row
- **Why this card exists:** a CREATE is two sequential RPCs (create-at-qty-0, then the import move) and the ledger is append-only, so the sequence is NOT one transaction (#69). The failure direction is SAFE — a row stranded at qty 0 is a stub (missing stock, never invented) — but card 13's `qty == SUM(delta)` invariant is BLIND to it: a half-created row at qty 0 with no delta satisfies the invariant perfectly. An import could silently under-deliver and every other card would pass. This card is the only one that can catch it.
- **Do:** run an Accept, then read the done screen against the plan's accepted count.
- **PASS:** **rows written == rows accepted.** Every row that did NOT complete is NAMED with what landed and what did not (`applyImportPlan` returns a per-row outcome; the surface renders every failure). The success banner's count matches the number of green rows.
- **FAIL:** the banner says "N saved" but fewer rows actually changed, and no row is named as incomplete — a silent under-delivery.

⛔ SUPERSEDED 2026-07-26 → R-10 on `rbac-resource-action-full-surface-test.md` (`import_pricing` → `inventory:import_price`). Do not run as evidence.

### 16 — A MANAGER without `import_pricing` imports QUANTITIES; price columns show as won't-be-written
STATUS: owed
DEVICE: desktop
COVERS: #149
LAST-PROVEN: —
SIGNAL: the amber "Prices won't be saved" notice on the map/plan steps
- **Do:** sign in as a manager who has inventory access (`view_costs`) but was NOT granted bulk price import. Open `/inventory/import`, map a file that includes a price column, and reach the plan.
- **PASS:** the manager REACHES the surface (not bounced), a **"Prices won't be saved"** notice appears with the reason and the Team-page remedy, and Accept imports **quantities and details** — the done screen confirms prices were held on the priced rows.
- **FAIL:** the manager is bounced from the route entirely (quantity import blocked), OR prices import silently despite the missing grant.

⛔ SUPERSEDED 2026-07-26 → R-11 on `rbac-resource-action-full-surface-test.md` (`import_pricing` → `inventory:import_price`). Do not run as evidence.

### 17 — 🔴 That manager's price write is refused BY THE SERVER even if the client sends it
STATUS: owed
DEVICE: desktop
COVERS: #149
LAST-PROVEN: —
RUN 2026-07-23 (David, live): PASSED — a direct `import_write_price` call as the un-granted manager returned `applied=false` and the lot's `sell_price` was UNCHANGED. Thunder does NOT mark this `covered` (OP-14 clause 3 — only David's flip sets `covered`); recorded here as a passing owner run pending his flip.
SIGNAL: `import_write_price` returns `applied=false`, and the lot's `sell_price` is UNCHANGED
- **Why:** a client-side marker is render-only (2026-06-21 record) — hiding a field in the UI while the API still ships the write is not security. The gate must be server-side.
- **Do:** call the RPC directly as the un-granted manager (V5 in `20260723_inventory_import_pricing_gate.sql`): `SELECT * FROM import_write_price('<lot>', '<business>', '<manager uid>', 99.00, 'each');` and then read that lot's `sell_price`.
- **PASS:** `applied=false`, the reason names `import_pricing`, and the lot's `sell_price` is **unchanged** — the server refused independently of any client.
- **FAIL:** the price changes, or the RPC accepts the write for a member without the grant.

⛔ SUPERSEDED 2026-07-26 → R-12 on `rbac-resource-action-full-surface-test.md` (`import_pricing` → `inventory:import_price`). Do not run as evidence.

### 18 — The owner grants it on `/team`; the same manager re-runs the identical file and prices land
STATUS: failed
DEVICE: desktop
COVERS: #149
LAST-PROVEN: —
FAILED-ON-RUN: 2026-07-23 (David, live)
SIGNAL: the "Prices won't be saved" notice is GONE; the done screen reports no held prices
- **Do:** as the owner, grant **bulk price import** to that manager on the existing `/team` member/role-config surface (ledger #86). The manager re-runs the **identical** CSV.
- **PASS:** the notice is gone, `import_write_price` returns `applied=true`, and the priced lots now carry the CSV's prices. Nothing else about the run changed.
- **FAIL:** prices still don't land after the grant, or a NEW admin screen was required to grant it (it must be the existing /team surface).
- **🔴 FAILED LIVE 2026-07-23 (David).** The owner granted "Import Pricing" to MANAGER on `/team → Roles` and saved; the manager's import STILL showed the no-permission banner and `sell_price`/`price_basis` still landed null. **Root cause is NOT the import — it is the permission plumbing:** the Roles tab writes `role_definitions` (`upsertTenantRole`), while the gate `has_permission_for` reads `business_members.permissions`, and nothing propagates one to the other (recon `docs/decisions/2026-07-23-permission-write-sites-recon.md`). **Evidence:** the manager's `business_members` row (`df7723be-bd28-4750-96fe-023279806489`) still carries `updated_at = 2026-07-10 20:11:46` — the Save never touched it — and its `permissions` array (11 entries) does not contain `import_pricing`. **NOT bandaided green with a SQL grant** (David's ruling #2: a permission that must be set by SQL is not shipped). This card stays FAILED until the /team grant actually writes the store the gate reads.

### 19 — An OWNER is unaffected throughout — no new friction on the owner path
STATUS: owed
DEVICE: desktop
COVERS: #149
LAST-PROVEN: —
SIGNAL: no "Prices won't be saved" notice ever appears for the owner
- **Do:** as the owner, run a priced import exactly as before this build.
- **PASS:** prices import with no extra step and no notice — the owner is authorized by `owner_id` (owner-inclusive `has_permission_for`), with zero dependency on any member-row permission.
- **FAIL:** the owner sees the manager's "won't be saved" notice, or is asked to grant themselves anything.

### 20 — 🔴 A foreign item # NEVER sources a match; name + size decide, and a collision is SURFACED
STATUS: owed
DEVICE: desktop
COVERS: #150, #128
LAST-PROVEN: —
- **Why this card exists (D-47 / STD-019, live 2026-07-23):** our `business_inventory.sku` holds internal `DISC-` discovery-scrape ids; a grower's item number is THEIR namespace. The first owner-prove bound the file's **Basham's** row (item # `DISC-1101`) to our **Texas Redbud** and **'Sierra'** (item # `DISC-1104`) to **Flip Side Vitex** — the exact QBO-email-match shape (nine mis-billed invoices) on a new surface. A foreign identifier must never bind on a field it shares no guaranteed meaning with.
- **Do:** upload the fixture. Your live catalog carries `DISC-1101` / `DISC-1104` as unrelated scraped varieties. Review the **Basham's Party Pink Crape Myrtle** and **'Sierra' Mexican Red Oak** rows.
- **PASS:** each resolves to the **right variety by name + size** (Basham's → its own lot; 'Sierra' 45 gal → a new Sierra sibling), the reason says **"by name + size"**, and a **red note** names the different plant the item # points at ("…item # DISC-1101 matches a DIFFERENT plant … Texas Redbud … Ignored — matched by name + size"). The row is **unchecked by default** — it is not written until you tick it.
- **FAIL:** either row binds to the plant its item # points at (Texas Redbud / Flip Side Vitex), OR the collision is silent (no note), OR the "Matched by item #" wording reappears.
- **Note:** the grower's item # is still KEPT — as a descriptive attribute under its own header ("Item #") on the resolved lot — it is simply never treated as our sku (D-24 / point 3).

### 21 — 🔴 A size written in a different format than the catalog stores resolves to the SAME lot
STATUS: owed
DEVICE: desktop
COVERS: #150
LAST-PROVEN: —
- **Why this card exists (live 2026-07-23):** the catalog stores DISC-1105 "Shoal Creek Vitex" size **`30`** (a bare trade number) while a CSV says **`30 gal`**. Compared as exact strings they differ, so the import **CREATEs a duplicate lot** instead of resolving to the one already there. Size was the one attribute never given the name-matcher's fold-before-compare treatment (D-45 did it for names).
- **Do:** in the fixture, the **Shoal Creek Vitex · 45 gal** row targets your lot `3ec53db3` whose size is stored as **`45`**. Review its verdict. (Also check any lot whose stored size is a bare number against a `N gal` CSV row.)
- **PASS:** the `45 gal` CSV row resolves to the existing `45` lot — it becomes the **CONFLICT** of card 9 (a counted lot), NOT a new duplicate `45 gal` sibling. No second Shoal Creek 45 lot is minted. The whole gallon family folds: `45` / `45 gal` / `45gal` / `45G` / `#45` / `45-gallon` are one size.
- **FAIL:** a duplicate lot appears because the size format differed, or card 9 never fires because the `45 gal` row CREATEd instead of matching.
- **Note:** the fold is COMPARISON-ONLY — your stored `45` stays `45` on its row (D-23, faithful-before-connected); it is never rewritten to `45 Gallon`.
- **⚠️ Blast-radius (probe, do not assume):** if any ONE variety already holds two rows that are the same size in different spellings (e.g. a `15` row AND a `15 gal` row under one variant_group), the size-picker now reads them as a duplicate and that variety needs those two rows merged — a read-only check (`SELECT variant_group, size FROM business_inventory` grouped) is worth a glance during this prove. This is tech-debt #56's deferred merge half; the comparison fix here does not itself merge existing rows.

---

## COST-BASIS COLUMN WITHHOLDING (#81 MINIMUM · ledger #202 · 2026-08-23)

> **What this build did, in one sentence:** the plant-profile stock-line fallback and the checkout
> scan loop asked `business_inventory` for `unit_cost` on **every** read regardless of who was
> logged in; they now ask for it only when the session holds `costs:read`.
>
> 🔴 **WHAT IT DID *NOT* DO, and these cards must not be read as proving it: #81 IS STILL OPEN.**
> RLS on `business_inventory` is ROW-level and grants every column to any session holding
> `inventory:read`, so **a devtools one-liner still returns the cost** and
> `scripts/rls/inventory-read-model.rls.mjs` **card N-7 stays RED**. This closes the *accidental*
> exposure — cost arriving on an ordinary screen for someone who never asked for it. The wall
> itself is the COHERENT scope and is not built.
>
> **Cards 22–24 are REGRESSION checks** (the paths the change could break); **card 25 is the only
> one that proves the fix.** Card 25 needs a console **by design** — it is the one place the
> withheld column is observable — and it is `DEVICE: desktop` for exactly that reason.

### 22 — An OWNER scans a plant tag: the size picker still resolves and the order still builds
STATUS: owed
DEVICE: either
COVERS: #202
LAST-PROVEN: —
SIGNAL: `[TRACE:RESOLVE] usePlant — stock-line columns: cost-bearing (costs:read)`
- **Why this card exists:** the fix changes the SELECT the resolver sends. The resolver's own ladder (SKU → name token-equality → size-picker) reads `name` / `sku` / `size` / `variant_group` — none of which moved — but a column-list change is exactly the kind of edit that silently drops a field a downstream branch depends on.
- **Do:** as the OWNER, scan (or open) a plant tag that lands on the size picker, choose a size, and put it in the cart.
- **PASS:** the picker offers the same sizes as before, the chosen lot resolves, name/size/price render, and the cart line is correct. The TRACE line says **cost-bearing** — the owner holds `costs:read`, so the owner's payload is byte-for-byte what it was before this build.
- **FAIL:** the picker is empty or missing a size, the plant resolves with a blank name or size, or the price disappears.

### 23 — 🔴 A discovery-seeded / CSV-imported lot (the D-34 fallback) still resolves — the path this fix touches most directly
STATUS: owed
DEVICE: either
COVERS: #202
LAST-PROVEN: —
SIGNAL: `[TRACE:RESOLVE] usePlant — cultivar_plants MISS → business_inventory … (stock line)`
- **Why this card exists:** this is the lane the fix actually changed. A lot with **no `cultivar_plants` row** falls to the stock-line resolver — and that is not an edge case, it is **LAWNS's real catalog**: every discovery-scraped and every CSV-imported row takes it. The 2026-07-30 pass narrowed the *specimen* read 33 lines above and left this one wide; a mistake here breaks the majority path while the demo path looks fine.
- **Do:** open a lot you know has no specimen row (a `DISC-` scraped variety, or anything from the grower price-list import). Do it once as OWNER and once as a MANAGER or STAFF session.
- **PASS:** it resolves and renders identically in both sessions — name, size, available count, and **retail price** all present. `sell_price` is NOT confidential (D-35) and must still appear for everyone.
- **FAIL:** the lot resolves for the owner and not for the manager/staff, or the retail price vanishes for the non-owner, or the plant renders with a missing size/count.
- **⚠️ Note:** if the retail price disappears for a non-owner, the subtraction took the wrong column — that is a build defect, not a permission working as intended.

### 24 — Build and submit an order end to end; the total is unchanged
STATUS: owed
DEVICE: either
COVERS: #202
LAST-PROVEN: —
- **Why this card exists:** `synthesizePlant` copies the resolved row onto the cart line, and `CartReview` prices from it. Withholding a column from the resolver therefore reaches the money path, which is the one place a "harmless" read change is not harmless.
- **Do:** as the OWNER, build a multi-item order (at least one stock-line lot), review it, and submit. Compare the total against the same order before this build.
- **PASS:** subtotal, discount, tax and total are identical, and the QuickBooks invoice matches the Review screen.
- **FAIL:** any figure moves.
- **🔴 KNOWN AND UNRULED — read this before running the card as a MANAGER or STAFF (ruling C-A, OWED):** if a customer is on an **`at_cost`** tier, a session **without** `costs:read` no longer receives the cost, so `applyTierPrice` **degrades neutral to retail** and the Review screen shows RETAIL while `submit.ts` — which re-reads the true cost server-side with the service key — **charges COST**. It fails toward charging the customer *less* than Review displayed. **This is inherent to any cost wall, not to this build**, it fires on `at_cost` tiers only, and **David has not ruled it.** Do not file it as a defect of this build; it is ruling **C-A**. The OWNER path is unaffected (the owner holds `costs:read`).

### 25 — 🔴 THE ONE THAT PROVES THE FIX: `unit_cost` is ABSENT from the scan/plant response
STATUS: owed
DEVICE: desktop
COVERS: #202
LAST-PROVEN: —
SIGNAL: `[TRACE:CART] scan columns: NO-COST (unit_cost withheld)`
- **Why this card needs a console, stated rather than hidden:** the whole point is that **nothing on screen changes** — the value was never rendered, it was merely delivered. There is no visible symptom to check, so the network response is the only honest evidence. Every OTHER card on this board avoids the console; this one cannot.
- **Do:** log in as a **MANAGER or STAFF** session (one holding `inventory:read` / `orders:create` and **not** `costs:read`). Open devtools → Network. Go to `/scan` (checkout) and scan or look up a lot. Find the `business_inventory` request.
- **PASS:** the request URL's `select=` **does not contain `unit_cost`**, and no returned row has a `unit_cost` key. The console shows **`NO-COST (unit_cost withheld)`**. Repeat by opening a discovery-seeded plant profile — same result.
- **FAIL:** `unit_cost` appears in the `select=` parameter or in any returned row, or the TRACE line says `cost-bearing` for a session that does not hold `costs:read`.
- **Then confirm the other direction (this is half the card — a wall that withholds from everyone is not a wall, it is a break):** repeat as the OWNER. `unit_cost` **must** be present and the TRACE line must say **`cost-bearing (costs:read)`**.
- **⚠️ AND THE HONEST LIMIT, which is the point of card 25 existing at all:** in that same console, as the manager, run `await supabase.from('business_inventory').select('id,name,unit_cost')` — **it still returns the costs.** That is #81, it is still open, and this card must never be read as proving otherwise.
