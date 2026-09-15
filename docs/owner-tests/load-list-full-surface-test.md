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

**Board: 0 of 13.** Every card is `STATUS: owed` except **CARD 11**, which is `needs-test` with its
reason stated.

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
COVERS: ledger #315 — the consolidated headline
SIGNAL: `[TRACE:LOADLIST] built {date: '2026-08-29', stops: 6, trees: 11, mixYards: 2.5, tPosts: 24}`

Open **`/load-list?date=2026-08-29`**.
**PASS — every one of these, and they are the numbers to compare against the real trailer:**
- **6 stops** · **11 trees** · **2.5 yards special mix** · **24 T-posts** · **96 ft rope** · **11 bubblers**
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
**PASS:** it reads **1 tree · 1 yd mix · 4 posts**, and the day's tree list shows the 200 gallon
carrying **4 T-posts**. Nowhere on the page do the words *"work out by hand"* or *"no T-post rule"*
appear.
**🔴 FAIL if** the 200 gallon shows 0 posts, a blank, or a hand-work note. **That was the defect**:
a five-row lookup table answered for 15/30/45/65/95 and the biggest tree on the trailer fell off
the end. It is now a threshold — 2 up to and including 65, 4 above — so there is no size it cannot answer.

### CARD 3 — 🔴 THE UNREADABLE LINE IS PRINTED, NOT DROPPED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: *"the page must never silently omit something it could not compute"*
SIGNAL: `unresolved: 1`

Same page. Find the red **COULD NOT WORK OUT** block.
**PASS:** it lists **1 line — `Military Discount 5%`** — with the sentence *"We could not read "5%"
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
which stops need it, gives the hand rule (*a fenced tree needs 4 T-posts in total, so a tree that
already has 2 needs 2 MORE*), says fence material is **by the roll, measured as the circumference
of the ring**, and states the open question at **95 gallon and above** (4 more, or reuse the 4 it
has?) as **open**.
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

### CARD 13 — 🔴 ONE MIX RATIO, AND IT IS THE CONTAINER SIZE ([[R-155]])
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: [[R-155]] · closes tech-debt #300 (was #291)
SIGNAL: section 1 reads **one container volume of mix per tree — a 45 gallon tree takes 45 gallons**

Same page, section 1.
**PASS:** the mix rule states **one container volume per tree**, names the 45 gallon example, and
the gallons figure reconciles: on Saturday 2026-08-29, **11 trees → 470 gallons → 2½ yards**, and
`470 ÷ 201.974 = 2.33`, rounded UP to the next half yard.
**PASS:** the sentence explains WHY it is a whole container rather than an allowance — *it settles
on the drive and compacts when watered*. A number a person can question is a number they can trust.
**🔴 FAIL if** the mix line is ~30% lower than the tree gallons on the day (e.g. 329 gallons against
those same 11 trees). That is the 0.7 ratio returning, and on paper it reads perfectly.
⚠️ **THIS CARD PROVES THE LOAD SHEET, NOT THE BOOKS.** `BOM_RULES` was already at 1.0 before the
ruling, so **nothing a customer is charged moved.** ✏️ **And nothing was charged wrongly before it
either: there is no install cost model in this repo to hold the old 0.7.** Building one — no mulch
line, the ring as R-156's total function — is tech-debt **#299**, and no card here can reach it.

---

## WHAT THIS BOARD DOES NOT COVER

- **Deer fence quantities — WHICH trees need fence.** Nothing records that; the page says so
  (CARD 5). ✏️ **Narrowed 2026-09-14 ([[R-156]]): HOW MUCH fence a tree of a given size needs IS now
  computed and printed** — the ring is a total function of container gallons, so a figure exists at
  every size including ones LAWNS has never sold. What remains uncovered is the CAPTURE: nothing
  says which stops need fence at all, so no card can exercise a real fenced stop.
- **The 66–94 gallon band.** `tPostsFor` returns 4 there, which is an INFERENCE from David's two
  anchors (2 up to 65, 4 at 95 and above) and errs large on his own instruction. LAWNS sells no
  size in that band, so no card can exercise it on real data.
- **Which √-fit David meant.** [[R-156]] gives two anchors and the word *through*, read as a curve
  passing through BOTH (`d = a√g + b`). A single-parameter `d = k√g` cannot hit both and would
  differ by up to ~6% away from the anchors. **Exact at 15 and 95 either way**, so no card on real
  LAWNS sizes can tell the readings apart — it needs a sentence from David, not a test.
- **Whether the computed bubbler count matches an invoice that bills bubblers.** The page prints
  both — the computed count in section 3, the billed `TB` line under *"Also on these orders"* — and
  deliberately does not reconcile them, because a word-matching rule is what R-144 forbids.
