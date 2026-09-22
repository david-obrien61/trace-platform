# DELIVERY DAY LOAD LIST — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha>`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance. Match it to `git log --oneline origin/main -1` — **not to a SHA written in this
> file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the
> stamp. *(GATE 0 · OP-15.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own).
>
> **This file is the ONLY source of truth for the load-list owner-tests.** It is STANDING — run it
> after any change to `loadList.ts`, `LoadList.tsx`, `stopRead.ts`, or the shared size resolvers
> (`readProductFromDescription` / `parseUnitOfMeasure`). A per-build proof is a FILTER
> (`COVERS: #NNN`), never a second doc.

**Purpose:** prove that the page Lauren hand-assembles today from several printouts comes out of the
platform correct, and — the harder half — that **it never silently omits something it could not
compute.** David, 2026-09-12: *"Blank is indistinguishable from zero, and a yard person cannot tell
the difference between 'no T-posts needed' and 'we could not work it out.'"*

**Board: 0 of 25.** ✏️ **2026-09-21 (ledger #373): ONE SECTION PER TEAM — CARDS 21–25 added.** A split day prints one headed section per team, each with its own bulk, its own trees to pull and its own stops; the stops carrying NO team are a section of their own, LAST, never dropped. 🔴 **CARD 23 is the one that protects everybody else: a nursery that never splits a day must see the sheet exactly as it was** — no headings, no captions. The existing cards are NOT re-flipped: the sheet body was extracted into one component and rendered unchanged for an unsplit day, so nothing they describe moved. **Nothing is merged — David reviews on Test Dave's first.** ✏️ **2026-09-20 (ledger #358): LAUREN PULLS BY VARIETY — the species roll-up is back, as "Trees to pull", between the bulk and the stops; the stops are the name check at staging (a tree's tag carries the customer's name). This REVERSES #355's one-line version.** ✏️ **2026-09-18 (ledger #355): the sheet reads the way the trailer is loaded — page 1 the date and the BULK (mix, T-posts, rope, bubblers, water monitor kits, trunk protection), the day's trees as ONE line ("29 trees across 8 stops"), then the stops from page 2. CARDS 1, 5, 6, 7, 13 and 19 are reworded to the new layout; the numbers do not change.** ✏️ **2026-09-18 (ledger #354): CARD 20 added — one sheet per crew. The page changed, so CARDS 6 and 19, which David ran and PASSED on paper today on `f9f3b8a · prod`, are `owed` again; the whole-day sheet is built the same way and should read exactly as it did.** ✏️ **2026-09-17 (ledger #350): CARDS 3, 5, 12, 13, 15, 19 changed after David ran CARD 19 live — the sheet is an ALLOW-LIST.** CARD 5 is rewritten; all stay `owed`. Every card is `STATUS: owed` except **CARD 11**, which is `needs-test` with its
reason stated. ✏️ **2026-09-16 (ledger #343): CARDS 1, 2, 3, 5 and 13 CHANGED and stay owed; CARDS 14–18
are new.** The page now reads every size from the nursery's container ladder and every figure from
Settings → Operations, and it prints the figures it used.

> ✅ **MIGRATION GATE (ledger #343) — `20260916_container_ladder_install_t_posts.sql` IS APPLIED**
> (David, 2026-09-16–17; V1–V4 all pass), and the code is **merged `56107ee`**. Every card below can run.
> ⚠️ CARD 14's "could not read sizes" state is no longer reachable on LAWNS — it is kept for the day a
> read genuinely fails.

**Why this exists.** The route goes to the driver digitally; the LOAD goes on paper, and nothing
produced it. The arithmetic is Lauren's, done by hand, every delivery morning.

---

## HOW TO READ A CARD

| Tag | Means |
|---|---|
| `STATUS: covered` | 🟢 A test exists AND it passed on `LAST-PROVEN`. Only David sets this. |
| `STATUS: owed` | 🟡 Written but not run since the surface changed. **Not proven.** |
| `STATUS: needs-test` | 🔴 Surface exists, no test — a known hole. |
| `LAST-PROVEN: never` | Nobody has ever run this against the real UI. |
| `DEVICE:` | `phone` (capture) · `desktop` (reconcile/admin) · `either`. |
| `COVERS:` | The ledger row / gap / card this check defends. |
| `SIGNAL:` | The `[TRACE:*]` line. **Always secondary** — every PASS must be visible without a console. |

**PASS = every card in scope is `covered` with today's date.** Thunder never sets `covered` (OP-14).

---

## ⛔ GATE 0 — CONFIRM YOU ARE TESTING THE DEPLOYED CODE (OP-15)

- [ ] **① SHA is live** — the `?debug=1` DebugPanel stamp matches `git log -1 --format=%h`.
- [ ] **② NO MIGRATION IS NEEDED.** This build reads only tables that already exist
      (`deliveries`, `orders`, `order_items`, `customers`, `business_inventory`). Nothing to apply,
      nothing to run first. Recorded so nobody goes looking for a migration that does not exist.
- [ ] **③ the branch is merged.** `git merge-base --is-ancestor <sha> origin/main` (tech-debt #280).

---

# DAVID CAN RUN THESE NOW

*(Your own owner login, LAWNS, one browser. No second session, no desk visit.)*

### CARD 1 — 🔴 THE WHOLE BUILD: SATURDAY 2026-08-29 COMES OUT RIGHT
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #315 — the consolidated headline · ledger #343 — the mix at 2.0, off the ladder
SIGNAL: `[TRACE:LOADLIST] built {date: '2026-08-29', stops: 6, trees: 11, mixYards: 5, tPosts: 24}`

Open **`/load-list?date=2026-08-29`**.
**PASS — every one of these, and they are the numbers to compare against the real trailer:**
- **6 stops** · **11 trees** · **5 yards special mix** · **24 T-posts** · **96 ft rope** · **11 bubblers**
  ✏️ *(was 2.5 yards: the ratio was 1.0 until David's 2026-09-15 correction — twice the container volume, so 470 container gallons → 940 gallons of mix → 4.65 yd → 5 rounded up.)*
- ✏️ *(ledger #355, amended #358)* Page 1 is headed **Bulk materials — loads first**: special mix first, saying *loads FIRST — trees on top*, then T-posts, rope, bubblers, water monitor kits. Under it, **Trees to pull — 11 across 6 stops**, listed **by variety, biggest first**, each row with its T-posts and its gallons of mix.
- From page 2, each stop lists its own trees as **name and size** (*"Mexican Sycamore 45 gallon"*), **never a SKU**, under the line *"Each tree is tagged with the customer's name…"*.
**FAIL if** any number differs, or if a tree row shows a SKU instead of a name.

### CARD 2 — 🔴 THE 200 GALLON IS FULLY COMPUTED (the correction of 2026-09-12)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's BOM correction — the ladder has no upper bound
SIGNAL: —

On the same page, find **Sherry Cooper**'s stop.
**PASS:** it reads **1 tree · 2 yd mix · 4 T-posts** *(✏️ was 1 yd — 400 gallons of mix at 2.0)*, and
the day's tree list shows the 200 gallon carrying **4 T-posts** — read off the **200 gal** size, which
the "Figures used" block lists with *(LAWNS, David 2026-09-12)*. Nowhere on the page do the words *"work out by hand"* or *"no T-post rule"*
appear.
**🔴 FAIL if** the 200 gallon shows 0 posts, a blank, or a hand-work note. **That was the defect**:
a five-row lookup table answered for 15/30/45/65/95 and the biggest tree on the trailer fell off
the end. ✏️ It is now **a figure on each size** (Settings → Container sizes), not a threshold — so a size
answers exactly what its row says, and a size that is not set up prints as COULD NOT WORK OUT (CARD 16).

### CARD 3 — 🔴 THE UNREADABLE LINE IS PRINTED, NOT DROPPED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: *"the page must never silently omit something it could not compute"*
SIGNAL: `unresolved: 1`

Same page. Find the red **COULD NOT WORK OUT** block.
**PASS:** its heading reads **(1)** and it lists **1 line — `Military Discount 5%`** — ✏️ *(2026-09-17: no
deer-fence line here any more; the fence rule is printed once at the top, CARD 5)* — with the sentence *"We could not read "5%"
as a size. Check the invoice."*, and the page states that nothing in it is counted in the totals
above. **Leroy & Lila Ludemann**'s stop line ends **· 1 line could not be read**.
**🔴 FAIL if** the block is absent or empty. A tidy page here is the failure, not the pass.

### CARD 4 — THE FLOOR WARNING, AND WHAT IT NOW MEANS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the repointed `totalsAreFloors`
SIGNAL: —

Same page.
**PASS:** a block says **every total above is a FLOOR**, and gives the reason as *1 line could not
be read* — **not** as a tree size. Then open **`/load-list?date=`** on a day whose lines all read
(any day with stops and no red block): **that day must NOT claim a floor.**
**FAIL if** the floor warning fires on every day — a warning that always fires is ignored — **or**
if it blames a tree size, which is a state that no longer exists.

### CARD 5 — 🔴 DEER FENCE PRINTS NOTHING UNLESS A STOP RECORDS IT
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David, 2026-09-17 — *"print nothing … unless a stop records that it needs fence"*
SIGNAL: no deer-fence block on the sheet

✏️ **REWRITTEN 2026-09-17, AND ITS PROOF RESET (OP-14 clause 3).** This card used to require the RULE,
the ring rule and a per-tree fence figure on every sheet. David ran it and ruled the opposite: on a day
where nothing is marked, the sheet says nothing at all about deer fence.

Saturday 2026-08-29 (and 2026-09-19 — no stop on either records fence).
**PASS:** **nowhere** on the page do the words *deer fence*, *ring* or *fence per tree* appear. The
bulk materials show T-posts, rope, bubblers and water monitor kits only.
**🔴 FAIL if** the rule, the ring rule, or any per-tree ring/fence footage prints.
⚠️ **The arithmetic is still there and still tested** — a stop that says it needs fence brings each tree
to 4 T-posts IN TOTAL, and the block prints then. Measured across the whole LAWNS book 2026-09-17:
**not one order line has ever said Deer Fencing**, so no card can exercise a real fenced stop yet.

### CARD 6 — 🔴 THE PRINTED PAGE (this is the deliverable, not the screen)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: *"printable, one page per day, for the yard person"*
SIGNAL: —

Press **Print this day** and look at the print PREVIEW (do not waste paper; Save as PDF is the same
renderer).
**PASS — all five:**
- The **date picker and the Print button are GONE** from the paper.
- ✏️ *(ledger #355)* **Page 1 is the date and the bulk materials on their own** — mix, T-posts, rope, bubblers, water monitor kits, trunk protection, and the one trees line; **the stops start on page 2**.
- **No stop is split across a page boundary** — a stop's name, address and lines stay together.
- It is **black on white** — no sage background, no green fills.
- Every flagged block still has its **border and its text** on paper.
**FAIL if** the chrome prints, or a stop straddles two pages.

### CARD 7 — NO MULCH, ANYWHERE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: tech-debt #299 (was #290) — the install cost model that must be BUILT, without a mulch line
SIGNAL: —

Same page. Search the printed sheet for the word **mulch**.
**PASS:** it appears **once**, under the special mix on page 1, as the statement **"No mulch. Only the ingredients in
the special mix."** There is no mulch QUANTITY anywhere.
**FAIL if** any number is attached to mulch. Lauren states mulch is not used, only the ingredients
in the special mix.
✏️ **CORRECTED 2026-09-15.** This card used to cite *"the cost model's mulch line ($7.49 at 15G to
$43.12 at 95G)"* as though a live model were getting it wrong. **Those figures are Lightning's**,
from a Python script run in a chat on 2026-09-11 — not a LAWNS fact, and not in this repo.
**Tech-debt #299 is now BUILD the model without a mulch line**, and the *"net effect uncomputed"*
wording is gone: there is no model for a net to be computed over.

### CARD 8 — AN EMPTY DAY SAYS SO AND OFFERS NO PRINT
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: D-9 — a document with nothing on it does not offer itself as a document
SIGNAL: `stops: 0`

Open `/load-list?date=` on a date with no stops (any Sunday well in the past).
**PASS:** the page reads **"No stops are scheduled for this day."**, the **Print button is
disabled**, and a note beside it says why.
**FAIL if** it offers to print a blank sheet.

---

# 🔴 FRIDAY 2026-09-18 — BEFORE SATURDAY'S TRAILER

### CARD 19 — 🔴 SATURDAY 2026-09-19 PRINTS THE MIX AT 2 × THE CONTAINER, WITH ITS FIGURES AT THE TOP
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #343 — the go-live target for Saturday 2026-09-19
SIGNAL: `[TRACE:LOADLIST] built {date: '2026-09-19', stops: 8, trees: 29, mixYards: 9, tPosts: 62}` ✏️ *(2026-09-18: an eighth stop, Angela Garzon, 2 × 95 gal, was added; David ran this card on paper the same day on `f9f3b8a` and it PASSED with these numbers)*

**Before you start:** the stamp at the foot of the screen must read **`56107ee`** (or newer) and end **`· prod`**.

1. Open **Delivery → Load list** and pick **Saturday, September 19, 2026** (or go to
   `/load-list?date=2026-09-19`).
2. **On the LAST page**, find **Figures used for this list** — ✏️ *(2026-09-17: reference, not load
   instructions, so it prints on its own page at the back, not at the top)*. **PASS:** it reads
   **Special mix per gallon of container — 2 gal** · **Rope per T-post — 4 ft** · **Bubblers per tree — 1** ·
   **T-posts on a deer-fenced tree, in total — 4** · then **45 gal · 30 gal · 15 gal**, each **2 T-posts**
   *(LAWNS, David 2026-09-12)* · and **Gallons in a cubic yard — 201.974**. It also says **"No figures have
   been saved for this nursery — these are the standard ones."** — correct: LAWNS has saved none (measured
   2026-09-17), and the standard mix IS 2.
3. ✏️ **Deer fence: nothing prints** — no rule, no ring, no footage. Nothing records which stops need
   fence, and a stop that says so is the only thing that brings it back (2026-09-17).
4. ✏️ **Page 1 — Bulk materials — loads first** *(ledger #355)*. **PASS:** it reads **9 yards special mix**, and the sentence says
   **"2 gallons of mix per gallon of container — a 30 gallon tree takes 60 gallons"** with **1730 gallons**.
5. ✏️ **(ledger #358 — Lauren pulls by variety)** Under the bulk, **Trees to pull — 29 across 8 stops**,
   by variety — e.g. **Eagleston Holly (Tree Form) 45 Gallon × 5 — 10 T-posts · 450 gal mix**. Then from
   page 2 each stop lists its own trees, for the name check at staging — e.g. **Sappal: 5 × Eagleston
   Holly (Tree Form) 45 Gallon**. **PASS:** both are present, the pull list ABOVE the stops.
6. ✏️ **Still page 1, after the mix:** **62 T-posts · 248 ft rope** · **Bubblers — none specified on these orders** *(bubblers are the ones BILLED; no Saturday order carries a Tree Bubbler line)* · **23 water monitor kits** *(one for every tree on an install order — Sappal and Kossa are recorded as delivery, so 29 are needed and 23 print; tech-debt #342)* · **2 trunk protection**. **FAIL if** bubblers read a bare 0, if PVC, bamboo or drilling appears anywhere, or if any of these lines is not on page 1.
7. **COULD NOT WORK OUT (1):** the line *"Flat fee - Applied on Aug 9, 2026"* — and nothing else.
8. ✏️ **NOTHING ELSE PRINTS (2026-09-17).** No Trip Charge (5 of them), no Customer Discount, no
   "15% Off - Tree Sale", and **no "Also on these orders" block at all.**
9. ✏️ **Trunk protection:** page 1 shows **2 trunk protection**, and it appears on the stop that
   carries it.
10. 🔴 ✏️ **THE LAST STOP (Chris Dubec, 8 Eagleston Holly):** a flagged line reads **"plus 1 tree to
   plant on site (Plant Your Tree) — size unknown; add mix and T-posts by hand."** The day's tree count
   stays **29** (it is not one of them) and the FLOOR warning fires because of it.

**FAIL if** the mix reads 3½ yards or 675 gallons (the old 1.0); if any charge, discount or "also on these
orders" line prints; if the deer-fence rule prints on a day nobody marked; if "Figures used" is missing or
sits at the top instead of its own page at the back; if Chris Dubec's ninth tree is silent or is counted as
a tree; or if the page says **"Could not read container sizes"**.

---

# NEEDS A SECOND LOGIN OR A DESK VISIT

*(You hold `owner_id`; these need someone who does not. Lauren or Joel, or a test member.)*

### CARD 20 — 🔴 TWO CREWS, TWO SHEETS: EACH SHEET CARRIES ITS OWN STOPS AND ONLY THEIR TOTALS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #354 — David, 2026-09-18: two crews Saturday, and the sheet could not be split
SIGNAL: `[TRACE:LOADLIST] stops ticked {date: '2026-09-19', ticked: 4, of: 8}` then `[TRACE:LOADLIST] built {… stops: 4, subset: true, dayStops: 8, leftOff: 4}`

**Before you start:** the stamp at the foot of the screen must read the #354 merge (or newer) and end **`· prod`**. This card reads LAWNS's Saturday and writes nothing.

1. **Delivery → Load list**, date **09/19/2026**. → Above the sheet, a white box **Stops on this sheet** lists the day's **8** stops, each with a ticked box and its number in Lauren's plan: **1. Chris Freehill · 2. Saurabh Sappal · 3. Ariel Thiry · 4. Angela Garzon · 5. Chris Dubec · 6. Kathy Gustafson · 7. Amanda Kossa · 8. Shailesh Raja**.
2. **Untick 5, 6, 7 and 8.** → The sheet now reads, near the top, **LAWNS Tree Farm, LLC · 4 stops of 8 on this day**, and a boxed warning: **This sheet carries 4 of the day's 8 stops — it is not the whole day. · Every total on this sheet is for these stops only. · On another sheet: 5. Chris Dubec · 6. Kathy Gustafson · 7. Amanda Kossa · 8. Shailesh Raja**. The button reads **Print these 4 stops**.
   **PASS:** the totals read **6.5 yards special mix · 36 T-posts · 144 ft rope · 11 water monitor kits · 2 trunk protection**, and **16 trees**. Each stop below starts with its plan number (**1. Chris Freehill** …). No "could not work out" box.
3. **Print** (the preview is enough). → **PASS:** the white tick box is **not** on the paper; the boxed "carries 4 of the day's 8 stops" warning **is**.
4. **Tick 5–8 and untick 1–4.** → **PASS:** **2.5 yards · 26 T-posts · 104 ft rope · 12 water monitor kits**, **13 trees**, no trunk protection, the **Flat fee** line under "could not work out", and **On another sheet: 1. Chris Freehill · 2. Saurabh Sappal · 3. Ariel Thiry · 4. Angela Garzon**.
5. **The two halves are the day:** 6.5 + 2.5 = **9 yd**, 36 + 26 = **62 posts**, 11 + 12 = **23 kits**, 16 + 13 = **29 trees** — exactly CARD 19's whole day.
   ⚠️ *Mix is rounded up to the next half yard on EACH sheet, so on another day two halves can add to half a yard more than the day. Today they add exactly.*
6. **Reload the page** (Cmd-R). → **PASS:** the same four stops are still the only ones ticked — the choice is in the page's address.
7. Click **Whole day**. → **PASS:** every box ticked, no warning box, **8 stops · 9 yards · 62 T-posts · 248 ft rope · 23 water monitor kits · 2 trunk protection** — CARD 19's sheet, unchanged, and the button reads **Print this day** again.
8. **Untick every stop.** → **PASS:** the sheet says **No stops are ticked, so there is nothing on this sheet. Tick the stops this crew is taking.** — never "No stops are scheduled for this day".

**FAIL:** a partial sheet shows the day's totals (9 yd / 62 posts) · the warning box or the "On another sheet" names are missing on paper · the tick boxes print · a reload returns to the whole day · two halves do not add to the day's posts, kits and trees.

### CARD 9 — 🔴 A WITHHELD ORDER SAYS WITHHELD, NEVER "NO ITEMS"
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the six-state ruling — withheld data announces its redaction
SIGNAL: `[TRACE:STOP] read` with `canReadLines: false`

Sign in as a member **without `order_items:read`**. Open `/load-list?date=2026-08-29`.
**PASS:** all six stops still appear by name and address, and each carries **"You do not have
permission to see what is on this order."** The top of the page warns **the list may be short**.
**🔴 FAIL if** any stop reads *"No items are recorded on this order"* — that reports a fact about
the VIEWER as a fact about the BUSINESS, and on paper it means a crew loads nothing for a customer
who ordered six trees.
**FAIL also if** a stop disappears entirely.

### CARD 10 — THE PAGE IS GATED WITH THE SCHEDULE IT PRINTS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the route gate — `deliveries:read`
SIGNAL: —

As a member **without `deliveries:read`**, type `/load-list` into the address bar.
**PASS:** refused at the route with a stated reason — the same refusal `/delivery-schedule` gives.
**FAIL if** the page renders, or if it renders empty without saying why.

### CARD 11 — A CHECKOUT ORDER'S LINES RESOLVE OFF THEIR LOT
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: the anchored-lot resolution path
SIGNAL: —

🔴 **NO TEST IS WRITTEN AND THE REASON IS THE FINDING: every LAWNS order on every delivery day is a
`history` order from the QuickBooks ingest, so every line is UNANCHORED and the lot path — which
the model implements and 8 probes cover — has never once run on real data here.** Proving it needs
a checkout order, placed against a real lot, scheduled to a delivery date. That is a data setup on
**Test Dave's**, not LAWNS, and it is not this build's job. Recorded rather than quietly assumed
working, because an untested path that looks identical to a tested one is what this board exists
to make visible.

### CARD 12 — THE SIZES THE RESOLVER CANNOT READ (the corpus-wide flag)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: tech-debt #292 — a size stated before a trailing remark
SIGNAL: —

Open `/load-list?date=` on a day carrying one of these known lines — e.g. an order containing
**"Cedar Elm - 30 gallon Install & Warranty"** or **"Chinkapin Oak - 45 gallon (Buy One Get One
Half Off) Install & Warranty"**.
✏️ **CHANGED 2026-09-17:** the "Also on these orders" block is gone, so the ONLY place such a line can
appear is **COULD NOT WORK OUT**. **PASS:** the line appears there — VISIBLE, and not counted as a tree.
🔴 **FAIL if it is absent altogether** — a tree we cannot size must never be dropped with the charges.
**🔴 This card passes on a page that is INCOMPLETE, and that is deliberate.** Measured 2026-09-12
over all 130 LAWNS order lines: **9 real trees state a gallon size in plain text that the resolver
cannot reach**, because a remark trails *after* the size without brackets. The page is honest about
them; it does not yet read them. **The fix is tech-debt #301 (was #292), not this card.**
**FAIL if** such a line is silently absent from the page altogether.

### CARD 13 — 🔴 ONE MIX RATIO, AND IT IS TWICE THE CONTAINER ([[R-155]], amended 2026-09-16)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: [[R-155]] as amended · ledger #343
SIGNAL: page 1 (bulk materials) reads **2 gallons of mix per gallon of container — a 30 gallon tree takes 60 gallons**

✏️ **CHANGED 2026-09-16 — THE RATIO IS 2.0, NOT 1.0.** David, 2026-09-15: *"install mix is TWICE the
container volume (30 gal → 60 gal). The earlier 1.0 was Lightning's figure, not LAWNS's."*

Same page, the special mix on page 1.
**PASS:** the mix rule states **2 gallons of mix per gallon of container** with the 30 → 60 example, and
the figure reconciles: on Saturday 2026-08-29, **470 container gallons × 2 = 940 gallons → 5 yards**
(`940 ÷ 201.974 = 4.65`, rounded UP to the next half yard). Each tree row shows its own gallons of mix.
**PASS:** change **Settings → Operations → Planting materials → "Special mix per gallon of container"**
to **1.5**, Save, reload this page: the day reads **705 gallons → 3.5 yards** and "Figures used" says
**1.5 gal**. **Put it back to 2 and Save.**
**🔴 FAIL if** the page shows 470 gallons (the 1.0 figure returning) or ignores the saved 1.5.
⚠️ **THIS CARD PROVES THE LOAD SHEET, NOT THE BOOKS.** There is no install cost model in this repo;
building one is tech-debt **#299**, and no card here can reach it.

### CARD 14 — 🔴 THE SIZES' OWN TWO STATES
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #343 — "could not read sizes" and "no sizes set up" are different sentences
SIGNAL: `[TRACE:LOADLIST] settings read {sizes: 'loaded', rungs: 9, …}`

**PASS (loaded):** on LAWNS neither banner appears and the console shows `sizes: 'loaded', rungs: 9`.
**PASS (none set up):** switch to **Test Dave's** (no sizes) and open a day with a tree on it: a red block
reads **"No container sizes set up."** and every container line sits under COULD NOT WORK OUT saying
the sizes are not set up.
**PASS (could not read) — only reachable before the migration is applied:** the red block reads
**"Could not read container sizes."** with the database's message beneath it.
**🔴 FAIL if** either state prints as an ordinary day with trees counted, or if the two states share one sentence.

### CARD 15 — 🔴 THE PAGE PRINTS THE FIGURES IT USED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #343 — *"The page states the values it used."*
SIGNAL: the **Figures used for this list** block

Saturday 2026-08-29. ✏️ **2026-09-17: the block is on its OWN PAGE, at the BACK** — reference, not load
instructions (David, after running it live).
**PASS:** the block lists **special mix 2 gal · rope 4 ft · bubblers 1 · deer-fenced tree 4 posts in total ·
201.974 gallons in a cubic yard**, then one row per size on the day — **200 gal (200 gal container) 4 T-posts
· 45 gal 2 · 15 gal 2** — each with *(LAWNS, David 2026-09-12)* once the migration's backfill has run.
It also says **"No figures have been saved for this nursery — these are the standard ones."** (LAWNS has
no Operations row today; measured 2026-09-16.)
**FAIL if** a figure printed here differs from the one the totals used (CARD 13's 1.5 step proves it).

### CARD 16 — 🔴 A SIZE THAT IS NOT SET UP IS COUNTED, NAMED, AND NOT STAKED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #343 — *"A size with no rung prints UNRESOLVED, counted and named"*
SIGNAL: `offLadderTrees` > 0 in `[TRACE:LOADLIST] built`

Find a delivery day carrying a **7 gal**, **1 gal**, **10 gal** or **300 gal** tree (LAWNS has live rows at
all four), or add one to a test order.
**PASS:** the tree list is followed by an amber line *"N trees on this day are a size this nursery has not
set up — counted as trees and given bubblers, but NO mix or posts"*; the line appears under COULD NOT WORK
OUT with *"is not one of this nursery's container sizes … Add the size in Settings → Container sizes"*;
the day's tree and bubbler counts INCLUDE it; the floor warning fires.
**PASS also:** add that size in Settings → Container sizes (CARD 28 on the uppot board), reload — the same
tree is now staked and mixed. **Retire the size again afterwards.**
**🔴 FAIL if** the tree vanishes from the counts, or is staked with a number nobody set.

### CARD 17 — "#3/5" AND "100 gal" ARE SIZES NOW
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #343 — 3/5 is ONE rung; 95 and 100 are ONE container
SIGNAL: —

On a day carrying a `3/5 Gallon`/`#3/5` lot or a `100 gal` line (Cedar Elm and Native Pecan carry 3/5 at LAWNS).
**PASS:** the 3/5 tree is a TREE on the **3/5 gal** size — 4 gallons of container, 8 gallons of mix, 0 posts;
a 100 gallon tree is on **95/100** with 4 posts.
**🔴 FAIL if** "#3/5" is still under COULD NOT WORK OUT as "a range" — that was the behaviour before.

---

# NEEDS A SECOND LOGIN

### CARD 18 — 🔴 A STAFF LOGIN READS THE NURSERY'S OWN FIGURES
STATUS: owed
LAST-PROVEN: never
DEVICE: either
COVERS: tech-debt #309 (✏️ resolved 2026-09-17 — David: staff may READ the planting figures)
SIGNAL: `[TRACE:LOADLIST] settings read {figures: 'stored'}` for the STAFF login

✏️ **CHANGED 2026-09-17.** Staff now read the four figures through `get_planting_materials`.
1. As the **OWNER**, set *Special mix per gallon of container* to **2.5** in Settings → Operations and Save.
2. As a **STAFF** member (no settings access), open Saturday's load list.
**PASS:** "Figures used" shows **2.5 gal**, and no "standard figures" warning appears.
**FAIL if** the staff login shows 2 or a warning — it is still being refused.
3. As the OWNER, **set it back to 2** and Save.

---

## WHAT THIS BOARD DOES NOT COVER

- **Deer fence quantities — WHICH trees need fence.** Nothing records that; the page says so
  (CARD 5). ✏️ **Narrowed 2026-09-14 ([[R-156]]): HOW MUCH fence a tree of a given size needs IS now
  computed and printed** — the ring is a total function of container gallons, so a figure exists at
  every size including ones LAWNS has never sold. What remains uncovered is the CAPTURE: nothing
  says which stops need fence at all, so no card can exercise a real fenced stop.
- ~~**The 66–94 gallon band.**~~ ✏️ **GONE 2026-09-16 (ledger #343):** there is no threshold any more —
  posts are a figure on each size, and a size that is not set up is COULD NOT WORK OUT (CARD 16).
- **Which √-fit David meant.** [[R-156]] gives two anchors and the word *through*, read as a curve
  passing through BOTH (`d = a√g + b`). A single-parameter `d = k√g` cannot hit both and would
  differ by up to ~6% away from the anchors. **Exact at 15 and 95 either way**, so no card on real
  LAWNS sizes can tell the readings apart — it needs a sentence from David, not a test.
- **Whether the computed bubbler count matches an invoice that bills bubblers.** The page prints
  the computed count in the bulk materials and **no longer prints the billed `TB` line at all** (2026-09-17: a
  Tree Bubbler line is recognised and left off). Nothing reconciles the two — the billed line is now
  invisible on this sheet, so a mismatch between what was billed and what the sheet says to load is
  **uncovered here**, by David's own instruction.

---

# ONE SECTION PER TEAM (ledger #373, teams piece 4 — David, 2026-09-21)

### CARD 21 — 🔴 A SPLIT DAY PRINTS ONE SECTION PER TEAM, AND THE SECTIONS ADD UP TO THE DAY
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #373 — one section per team, same allow-list and roll-up rules
SIGNAL: `[TRACE:LOADLIST] sections` naming each team and its stop count

On **Test Dave's**, with a day whose stops are assigned across **two teams** (assign them on the
schedule or the route page first — that is piece 1, already live).
1. Open the load list for that day.
**PASS:** the sheet opens with *"This day is split across N sections"*, then one headed block per
team — **the team's name and its stop count** — each with its own bulk totals, its own trees to
pull, and only its own stops.
**PASS:** the two sections' **T-posts add up to the day's T-posts**, and so do the mix gallons.
Add them by hand off the paper; the arithmetic is the check.
**🔴 FAIL if** a section shows the DAY's totals rather than its own — that is the defect this
exists to prevent, and it is the one that puts a whole day's mix on one crew's trailer.
**🔴 FAIL if** any stop on the day is missing from every section, or appears in two.

### CARD 22 — 🔴 A STOP WITH NO TEAM IS A SECTION, NOT A SILENT OMISSION
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #373 — D-9/A9, absent is not empty
SIGNAL: `[TRACE:LOADLIST] sections` showing a `null` team with its count

With the same day, leave **one stop unassigned** to any team.
**PASS:** a **last** section headed *"No team"* carries that stop, above the note *"Nobody has been
given these yet, so they are listed last rather than left off."*
**🔴 FAIL if** the unassigned stop is nowhere on the sheet. A stop left off every sheet is the real
risk this whole feature is built around — it would be loaded by nobody.

### CARD 23 — 🔴 A NURSERY THAT NEVER SPLITS A DAY SEES NO CHANGE AT ALL
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #373 — the unsplit day is untouched
SIGNAL: `[TRACE:LOADLIST] built` with no `sections` line

On a day where **not one stop carries a team** (any ordinary LAWNS day before teams are assigned).
**PASS:** the sheet is **exactly the one it has always been** — no team headings, no "split across"
line, no "No team" caption. One bulk block, one trees-to-pull, the stops.
**🔴 FAIL if** a single-crew day grows a "No team" heading. A nursery that does not use teams must
not be told about them on its paper.

### CARD 24 — TICKING STOPS AND TEAMS COMPOSE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #373 — grouping runs on the stops the sheet carries
SIGNAL: `[TRACE:LOADLIST] stops ticked` then the sections rebuilt

On a two-team day, **untick** one of Team 2's stops, then print.
**PASS:** the unticked stop is in **no section**, Team 2's section is one stop lighter, its totals
drop accordingly, and the unticked stop appears in the existing *"not on this sheet"* list.
**FAIL if** the unticked stop comes back because it shares a team with one still ticked.

### CARD 25 — A RETIRED TEAM STILL CARRIES ITS STOPS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #373 + [[R-133]] — retire, never delete
SIGNAL: —

Assign a stop to a team, then **retire that team** in Settings → TEAMS, then open the load list.
**PASS:** the section is still there, headed **"<name> (retired)"**, carrying its stop.
**FAIL if** the stops vanish with the team — history must stay true, and the trailer still has to
be loaded.
