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

**Board: 0 of 19.** Every card is `STATUS: owed` except **CARD 11**, which is `needs-test` with its
reason stated. ✏️ **2026-09-16 (ledger #343): CARDS 1, 2, 3, 5 and 13 CHANGED and stay owed; CARDS 14–18
are new.** The page now reads every size from the nursery's container ladder and every figure from
Settings → Operations, and it prints the figures it used.

> ⛔ **MIGRATION GATE (ledger #343) — `supabase/migrations/20260916_container_ladder_install_t_posts.sql`
> MUST BE APPLIED BEFORE THE `feat/ladder-one-source` CODE IS MERGED, AND BEFORE ANY CARD BELOW.**
> The ladder read asks for `install_t_posts_per_tree`; on a database without it, every ladder read
> fails and this page shows **"Could not read container sizes"** with every tree unresolved (CARD 14).
> Apply it as `postgres` in the **SQL editor**, then run its V1–V4 block.

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
- Special mix is **section 1**, above the trees, and says *loads FIRST — trees on top*.
- The tree list is **biggest first**, starting **Live Oak 200 gallon × 1 — 4 T-posts**.
- Trees read as **name and size** (*"Mexican Sycamore 45 gallon"*), **never a SKU**.
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

### CARD 5 — DEER FENCE SAYS IT IS NOT RECORDED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: the capture gap, measured 2026-09-12 · [[R-156]] the ring figures, 2026-09-14
SIGNAL: a **ft ring · ft fence per tree** figure against each tree size in the deer-fence block

✏️ **THIS CARD CHANGED ON 2026-09-14 AND ITS PROOF RESET WITH IT ([[R-156]], OP-14 clause 3).** It
used to ask only that the page print the RULE. The page now prints the **FEET**, per tree size, so
the hand-add is read off rather than worked out on a trailer.

Same page.
**PASS:** a block reads **DEER FENCE — nothing recorded**, states that nothing in the system marks
which stops need it, gives the hand rule — ✏️ *a fenced tree carries **4 T-posts in total** (the figure
from Settings → Operations)*, and **each tree row says how many stake posts it already has** — and
says fence material is **by the roll, measured as the circumference of the ring**.
✏️ **CHANGED 2026-09-16 (ledger #343):** the *"95 gallon and above — 4 more, or reuse?"* sentence is
**GONE**: the rule's own words (*"4 T-posts per tree **in total**"*) settle it — a 95 gallon tree
already has 4 and takes none.
✏️ **CHANGED 2026-09-17 (David):** the deer-fence block is printed **ONCE, AT THE TOP** — above
*1 · Special mix* — and **no stop is listed for fence** anywhere (not in COULD NOT WORK OUT, not on a
stop's line). **FAIL if** a "Deer fence — N stops" line appears in the red block.
**PASS also — new:** the ring rule is stated (*grows with the square root of container gallons —
5 ft at 15 gallon, 12 ft at 95 gallon*), and **every tree size on the day carries its own figure**:
a ring diameter in feet, feet of fence for one tree, and feet if every tree of that size were
fenced. On Saturday 2026-08-29 that means the **200 gallon Live Oak reads about 17.2 ft ring and
55 ft of fence** — not a blank, not a zero, not a hand-work note.
**🔴 FAIL if** the page is silent about deer fence. Silence on a printout reads as *none needed*.
**🔴 FAIL if** any tree size shows a blank or a **0** where a fence figure should be — that is the
exact failure [[R-156]] exists to prevent (*"rope is a quantity so a missing one reads as zero"*),
and it is the T-post table's defect one quantity over.
**FAIL if** a DAY TOTAL for fence appears. There must not be one: nothing records which trees are
fenced, so a day total would be a fabricated quantity.
⚠️ Measured across the whole LAWNS tenant: **zero** order lines and **zero** stop notes mention
deer, fence, T-post or stake. `DF` — *Deer Fencing* — exists only as a QuickBooks **catalogue**
item nothing points at.

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
- The **consolidated headline occupies page 1 on its own**; the per-stop breakdown starts on page 2.
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
**PASS:** it appears **once**, in section 1, as the statement **"No mulch. Only the ingredients in
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
SIGNAL: `[TRACE:LOADLIST] built {date: '2026-09-19', stops: 7, trees: 27, mixYards: 7, tPosts: 54}`

**Before you start:** the stamp at the foot of the screen must end **`· prod`** and show the SHA I give you
after the merge.

1. Open **Delivery → Load list** and pick **Saturday, September 19, 2026** (or go to
   `/load-list?date=2026-09-19`).
2. **At the very top**, find **Figures used for this list**. **PASS:** it reads
   **Special mix per gallon of container — 2 gal** · **Rope per T-post — 4 ft** · **Bubblers per tree — 1** ·
   **T-posts on a deer-fenced tree, in total — 4** · then **45 gal · 30 gal · 15 gal**, each **2 T-posts**
   *(LAWNS, David 2026-09-12)* · and **Gallons in a cubic yard — 201.974**. It also says **"No figures have
   been saved for this nursery — these are the standard ones."** — correct: LAWNS has saved none (measured
   2026-09-17), and the standard mix IS 2.
3. Just below it, the **Deer fence — add by hand** rule, once.
4. **Section 1 · Special mix.** **PASS:** it reads **7 yards special mix**, and the sentence says
   **"2 gallons of mix per gallon of container — a 30 gallon tree takes 60 gallons"** with **1350 gallons**.
   *(The old page would have said 3½ yards and 675 gallons.)*
5. **Section 2 · Trees — 27 in total.** Each tree row shows its own gallons of mix — e.g.
   **Eagleston Holly (Tree Form) 45 Gallon × 5 — 10 T-posts · 450 gal mix**.
6. **Section 3 · Hardware.** **PASS:** **54 T-posts · 216 ft rope · 27 bubblers**.
7. **COULD NOT WORK OUT (1):** the line *"Flat fee - Applied on Aug 9, 2026"*.

**FAIL if** the mix reads 3½ yards or 675 gallons (the old 1.0), if "Figures used" is missing or sits below
the totals, or if the page says **"Could not read container sizes"** (the migration is not applied).

---

# NEEDS A SECOND LOGIN OR A DESK VISIT

*(You hold `owner_id`; these need someone who does not. Lauren or Joel, or a test member.)*

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
**PASS:** the line appears under **"Also on these orders — no container size"** or under **COULD
NOT WORK OUT** — i.e. it is VISIBLE and not counted as a tree.
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
SIGNAL: section 1 reads **2 gallons of mix per gallon of container — a 30 gallon tree takes 60 gallons**

✏️ **CHANGED 2026-09-16 — THE RATIO IS 2.0, NOT 1.0.** David, 2026-09-15: *"install mix is TWICE the
container volume (30 gal → 60 gal). The earlier 1.0 was Lightning's figure, not LAWNS's."*

Same page, section 1.
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

Saturday 2026-08-29. ✏️ **2026-09-17: the block is at the TOP of the page, above *1 · Special mix*.**
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
  both — the computed count in section 3, the billed `TB` line under *"Also on these orders"* — and
  deliberately does not reconcile them, because a word-matching rule is what R-144 forbids.
