# RECIPE BUILDER — FULL-SURFACE OWNER TEST

> 🔴 **BEFORE ANYTHING: READ THE STAMP AT THE FOOT OF THE SCREEN — `built <time> · <sha> · prod`.**
> If it is not the SHA you mean to test, **stop.** Nothing below this line is evidence, and a
> failed or unmerged build looks *completely normal* — the app just serves the old bundle.
> One glance. Match it to `git log --oneline origin/main -1` — **not to a SHA written in this
> file**, because Vercel deploys the TREE and *any* push to `main`, docs included, moves the
> stamp. *(GATE 0 · OP-15.)*

> **Rendered board:** open `owner-tests.html` (a PURE renderer — it parses this file live and holds
> no data of its own).
>
> **This file is the ONLY source of truth for the recipe-builder owner-tests.** It is STANDING — run
> it after any change to `recipeDraft.ts`, `recipeWrite.ts`, `RecipeModal.tsx`, `InventoryEditor.tsx`,
> or the shared costing modules (`landedCost.ts` · `recipeCost.ts` · `receiptMatch.ts`).

**Purpose:** prove that a person can write down what a made item is built from, link each component
to a real purchase on a real receipt, and get a cost that **either is right or says why it is not**.
David, 2026-09-21: *"show the working, suggest, Lauren decides."*

**Board: 0 of 22.** ✏️ **2026-09-25 (ledger #410): CARDS 19 and 20 are NEW** — a part-yard batch must say what went on the books, and a component that was not there must not be recorded as used. Both need `20260925f` applied and both are `owed`. ✏️ **2026-09-22 (David's seven recipe rulings): CARDS 4, 5, 6, 10 and 11 are REWRITTEN and CARDS 15–18 are new.** The batch size is no longer typed — it is derived from what goes in — so every card that asked you to type a yield has changed. `20260922d_build_runs_freeze_cost.sql` is a SECOND migration, **written and HELD**, and GATE 0 ② now names both. Every card is `STATUS: owed`. ⚠️ **THE SCREENS ARE HELD, NOT MERGED**
(David, 2026-09-22: *"Build the surfaces tonight but HOLD them — David reviews on Test Dave's after
Lauren's 08:00 start. They touch the inventory item, which she uses."*). Until the branch merges,
**GATE 0 ③ will fail by design** and cards 1–12 run only on a preview deploy of
`feat/recipe-surfaces`. Cards 13–14 are the ones that need a second person.

**Why this exists.** LAWNS builds things: a Special Planting Mix, a water monitor kit, a bubbler.
Today their cost is somebody's memory. The engine underneath this screen was proven against LAWNS's
own receipts (ledger #370, merged `127f4f4`) — **this board proves the part a person touches**, and
in particular the two places it is designed to REFUSE: a component on no purchase, and a price
suggestion on an incomplete cost.

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

- [ ] **① SHA is live** — the stamp at the foot of the screen matches `git log -1 --format=%h`, and
      its last token reads **`prod`** (an amber `PREVIEW <branch>` is the held state, see below).
- [ ] **② TWO MIGRATIONS ARE APPLIED; A THIRD IS WRITTEN AND HELD.**
      `20260921_recipes_made_items.sql` (applied 2026-09-21, SHA `0e6f3d6d90b6bd07aa2244a5c238aa96998eab65061ec63750aecd213cafe3b8`)
      and `20260921c_build_run_says_when_the_ledger_did_not_record.sql` (applied, SHA
      `b258dbf5110b35cd94de1602aaf1c9e6fea6d4a7c1e1f114e0ea1cb06996c985`).
      🔴 **`20260922d_build_runs_freeze_cost.sql` is WRITTEN, NOT APPLIED** (SHA
      `21ac452fdab0ff467d65b6450dd1e4c652721e4bbe3cc3565ada60302617e6bb`). Its V0–V4 have been run
      by the author on Postgres (`build-runs-freeze-370.pglite.mjs`, ALL PASS, 4/4 mutants caught).
      **CARDS 15–18 need it applied; CARDS 1–14 do not.** ⚠️ Without it the typed-price boxes and
      the measured-yield boxes will refuse to save, because their columns do not exist yet — that is
      the expected failure, not a defect.
- [ ] **③ the branch is merged.** `git merge-base --is-ancestor <sha> origin/main` (tech-debt #280).
      🔴 **THIS WILL FAIL UNTIL DAVID RELEASES THE HOLD.** That is the expected state on
      2026-09-22, not a defect — run on a preview of `feat/recipe-surfaces` and say so in the result.

---

# DAVID CAN RUN THESE NOW

*(Your own owner login, LAWNS, one browser. No second session, no desk visit.)*

### CARD 1 — 🔴 THE FLAG EXISTS, AND IT USES LAWNS'S OWN WORD
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #370 · R-118 (the flag IS the identifier) · AC-1 (no literal)
SIGNAL: `[TRACE:RECIPE] item type {inventoryId: '…', itemType: 'manufactured'}`

Open **`/inventory`**, find any item, press **Edit**. Scroll to **How it is made**.
**PASS:**
- the section exists, and the dropdown offers exactly three choices:
  **Bought in — we buy it and sell it** · **Grown here** · **Made here — homemade**.
- the third one carries **your own word for it** — `homemade`, from Settings → Operations. It is not
  written into the code anywhere; if you change that word, this option changes with it.
**FAIL if** the third option reads "Manufactured", or any word you did not choose.

### CARD 2 — THE FLAG IS NOT OFFERED ON A NEW ITEM, AND THAT IS DELIBERATE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: no dead affordance (§1.6 item 5)
SIGNAL: —

Press **Add Item** (not Edit).
**PASS:** there is **no "How it is made" section** on the create form.
**Why:** a recipe hangs off a row, and the row does not exist yet. Offering the control would mean
buffering a recipe against an id we have not got.
**FAIL if** the section appears — it would be a control that cannot persist what it collects.

### CARD 3 — 🔴 MARK AN ITEM MADE HERE AND IT STAYS MARKED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: E5 / R-12 — a write that changed nothing must not report success
SIGNAL: `[TRACE:RECIPE] item type`

On **Special Planting Mix** (or any item you build), set **How it is made → Made here — homemade**.
**PASS:**
- a green line appears: *"Marked as made here. Add what goes into it, and a build will take those
  out and put the finished units in."*
- a **What goes into it** button appears underneath.
- **close the editor, reload the page, open the same item again — it still says Made here.**
  🔴 **The reload is the card.** A flag that looks set and did not save is the failure this catches.
**FAIL if** the dropdown springs back, or the change survives only until a reload.

### CARD 4 — 🔴 THE BATCH SIZE WORKS ITSELF OUT — NOBODY TYPES IT
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's ruling ①, 2026-09-22
SIGNAL: —

Press **What goes into it**. Add two components: **Shook Out Brown · 2 · yd** and
**Osmocote 21-4-8 · 25 · lb**.
**PASS:**
- **There is no box asking how much a batch makes.** The panel headed **One batch makes** says
  **About 2 yards** and, underneath, *"2 yards loose. Bucket-measured, so treat it as approximate."*
- A second line reads **Osmocote 21-4-8 add cost and no volume.**
- Change the bark to **2.5** and the figure becomes **About 2.5 yards** as you type.
**🔴 FAIL if** anywhere on this screen asks you for a yield, or if the 25 lb of Osmocote changes
the yards. David, 2026-09-22: *"weight ingredients add cost, not volume."*

### CARD 5 — 🔴 SETTLING IS APPLIED, AND THE FIGURE SAYS IT IS APPROXIMATE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's shrink ruling, 2026-09-22
SIGNAL: —

Go to **Settings → Operations → Volume** and set **Mix shrink and spill (share)** to **0.1**.
Come back to the recipe.
**PASS:** the batch now reads **About 2.3 yards** (2.5 loose, less 10%) and the sentence underneath
says *"2.5 loose, less 10% settling. Bucket-measured, so treat it as approximate."*
**FAIL if** the figure is unchanged, or if it prints something like **2.2500000000000004**.
**Why:** David, 2026-09-22 — *"if 2 people drive the tractor you will get 2 different measures for a
yard. This is approx, not exact science or math."* Set the share back to **0** when you are done.

### CARD 4b — 🔴 A COMPONENT ON NO PURCHASE IS ALLOWED, AND SAYS SO
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: *"a partial total presented as a total is the thing that gets someone fired"*
SIGNAL: —

Press **What goes into it**. Fill in **Makes 2.5 / yd**. Add a component: **MicroMax · 2 · lb**.
Do **not** link a purchase.
**PASS:**
- the line reads, in amber: *"On no purchase we hold — it will not be costed, and the batch will
  say so."*
- the **What a batch costs** panel names **MicroMax** among what is missing.
- 🔴 **the form does NOT refuse to save it.**
**Why:** measured 2026-09-21, MicroMax and 12-24-12 are on **no captured receipt at LAWNS at all**.
A form that refused them would force somebody to invent a price — the one outcome this whole chain
exists to prevent.
**FAIL if** it shows $0.00, a blank, or refuses the save.

### CARD 5 — 🔴 NO PRICE IS SUGGESTED WHILE THE COST IS INCOMPLETE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's ruling, 2026-09-22
SIGNAL: —

With MicroMax still unlinked, read the bottom of the **What a batch costs** panel.
**PASS:** there is **no markup line and no suggested price**. In its place, one sentence:
*"No price is suggested while the cost is incomplete — a markup on a partial cost reads as a real one."*
**🔴 FAIL if** a suggested price appears at all — **including a greyed-out one.** A disabled price
still shows a number, and a number on a screen is a number somebody quotes.

### CARD 6 — 🔴 FIND THE PURCHASE: THE QUESTION, AND THE ANSWER IS YOURS
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: R-118 — a recipe is authored by hand · David: *"how do you propose a bubbler with no context"*
SIGNAL: `[TRACE:RECIPE] receipts for matching {receipts: 89}`

Add a component **Osmocote 21-4-8 · 25 · lb** and press **Find the purchase**.
**PASS:**
- a sheet opens headed *"Which purchase is Osmocote 21-4-8?"*
- at least one line reads like a **question**, in this shape:
  *"We found Osmocote Blend 21-4-8 (12-14M) - 50 lb, bwi, 50 lb @ $68.24, 2026-09-02 — correct?"*
- under it, **why it was offered** (*"Both mention "osmocote" and "21-4-8""*), and the landed cost
  **both ways** (*"Landed $69.28 split evenly · $70.04 split by value"*).
- there is a **None of these** button, and nothing is applied until you press **Yes, that is it**.
**FAIL if** anything is linked without you saying yes.

### CARD 7 — 🔴 THE SAME INVOICE IS OFFERED ONCE, AND THE COLLAPSE IS REPORTED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: tech-debt #143 — named where it bites
SIGNAL: —

On the same proposal sheet, read the line above the proposals.
**PASS:** it says something like *"3 repeat captures of a receipt you already have were set aside,
so one invoice is offered once."*, and **no two proposals are the same purchase twice.**
**Why:** bwi's 29 July invoice ($1,283.88) is photographed **twice** on LAWNS, two and a half
minutes apart; Bailey Bark's 7 July is in **three times**. Without this, *"what did we last pay"*
averages a document against itself.
**🔴 FAIL if** there is no such line **and** a duplicate purchase is listed — a silent collapse is
the same defect wearing a tidier face.

### CARD 8 — 🔴 THE LANDED COST, NOT THE LINE PRICE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's ruling — LANDED before any per-yard figure
SIGNAL: —

Link the Osmocote proposal (**Yes, that is it**). Read the component line and the cost panel.
**PASS:**
- the component line reads **$69.28 per 50 lb**, **not $68.24** — the difference is the freight.
- 25 lb of it costs **$34.64** a batch.
**🔴 FAIL if** it shows **$68.24** or **$34.12**. That is the invoice line price, which excludes the
freight surcharge, and every figure built on it is low.

### CARD 9 — BOTH FREIGHT SPLITS, EVEN ONE FIRST
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David, 2026-09-21 — *"show the working, suggest, Lauren decides"*
SIGNAL: —

In **What a batch costs**, look at the two buttons.
**PASS:**
- **Freight split evenly** is **first** and is the one already selected when the sheet opens.
- the Materials line prints **both**: *"Materials $98.96 · $99.34 on the other split"* — the other
  one is beside it whichever is chosen, never hidden behind the toggle.
- pressing the other button changes which is which, and nothing else moves unexpectedly.
**FAIL if** only one figure is ever visible.

### CARD 10 — 🔴 THE BUILD TIME COMES FROM YOUR MIXER, AND IT IS STILL NOT MONEY
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's ruling ③, 2026-09-22 · the labour table ships EMPTY
SIGNAL: —

With the mix at about 2.5 yards, read the **Labour** line in **What a batch costs**.
**PASS:** it reads **38 minutes to build (2.5 loose yards at 4 yd³/hr) — labour not costed yet, no
rates entered.** The 4 is **Settings → Operations → Mixer output (yd³/hr)**; change it to **2** and
the minutes become **75**. Set **People making mix** to **2** and they double again.
**🔴 FAIL if** labour contributes any dollar figure, or if there is a box asking you to type the
minutes. Nobody has entered a rate; a rate we invented would be indistinguishable from one you set.
⚠️ If Settings has **no** mixer output, the line must read *"Settings → Operations has no mixer
output (yd³/hr) to work it out from"* — **never 0 minutes**, which would read as instant.

### CARD 11 — 🔴 SAVE IT, RELOAD, AND IT IS ALL STILL THERE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #370 · tech-debt #69's shape (a multi-step save)
SIGNAL: `[TRACE:RECIPE] saved {components: 7}`

Finish LAWNS's Special Planting Mix — all seven components — **link each one to its product**
(CARD 15) and press **Save recipe**.
**PASS:**
- it closes without an error.
- **reload the page, open the item, press What goes into it** — every component, every quantity,
  every unit, **and every linked purchase** is still there, in the order you typed them.
**🔴 FAIL if** the components come back and the **prices do not.** That is the exact half-save the
writer warns about: components and their purchase links are two writes, and a part-applied save
leaves a recipe whose contents are right and whose costs are absent.

### CARD 12 — THE COMPLETE RECIPE FINALLY SUGGESTS A PRICE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: markup is a SUGGESTION, ×1.40 not ÷0.60
SIGNAL: —

Link a purchase to **every** component (use any receipt line for MicroMax and 12-24-12 just to see
this card; **undo it afterwards** — CARD 4 is the true state) and **clear the build minutes**.
**PASS:** the markup line appears — *"A 40% markup would be $X per yd"* — and it says
**whose decision the price is**: *"…a suggestion, not a price. You set the price."*
**FAIL if** the suggestion reads as an applied price, or if the arithmetic is cost ÷ 0.60 rather
than cost × 1.40. *(On $51.96 the right answer is **$72.74**, not $86.60.)*

### CARD 15 — 🔴 EVERY COMPONENT IS LINKED TO A PRODUCT, OR IT SAYS IT IS NOT
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's ruling ④, 2026-09-22
SIGNAL: `[TRACE:RECIPE] product search {term: 'Osmocote', found: 3}`

On a component, press **Link a product**, type **Osmocote**, press **Search**.
**PASS:**
- matching products list with their size, SKU and what is on hand.
- pressing **This one** closes the sheet and the button now reads **Linked to a product**.
- an **unlinked** component shows, in amber under its line: *"Not linked to a product — a build will
  not take this off the shelf."*
- a product with **no QuickBooks id** shows greyed with **Cannot link**, and a line explains that a
  recipe keyed on a row id would not survive the next catalogue reload.
**🔴 FAIL if** an unlinked component says nothing. Before this, every component the modal saved was
unlinked and a build run moved **no stock at all** — it reported them honestly and did nothing.

### CARD 16 — 🔴 NO RECEIPT? TYPE THE PRICE, AND IT IS FLAGGED
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's ruling ⑤, 2026-09-22 · needs `20260922` applied
SIGNAL: —

On **MicroMax** — which is on no captured receipt at LAWNS at all — open **No receipt for it? Type
what a pack costs** and enter **60 / 50 / lb / "Lauren remembers the bag price"**.
**PASS:**
- the line costs (**$2.40 a batch**) and carries **⚠ no receipt — this price was typed in, not read
  off an invoice**.
- under the total: *"One price was typed in rather than read off a receipt: MicroMax. Capture the
  invoice and the figure corrects itself."*
- leaving the pack SIZE blank refuses the save and says *"How much is in one pack of MicroMax?"*
**🔴 FAIL if** a typed price shows as **$0.00**, or if it shows with no flag. David, 2026-09-22:
*"never zero."*

### CARD 17 — 🔴 THE NEWEST PURCHASE LEADS, AND A PRICE RISE IS CALLED OUT
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's ruling ⑤, 2026-09-22
SIGNAL: —

Press **Find the purchase** on **Osmocote 21-4-8**. LAWNS has bought it more than once.
**PASS:**
- the **most recent** purchase is first, with a green border and **Most recent purchase · N older
  ones below**; the older ones are below it, dimmed, **not hidden**.
- if the price moved, a bold line says so in the newest card: *"Up from $68.24 on 2026-07-29 — a
  change of $1.04 a pack."* — **red** for a rise, **green** for a fall.
**FAIL if** an older purchase is offered first because its wording happened to match better. The
score picks **which product**; the date picks **which line**.

### CARD 18 — 🔴 A BUILD FREEZES WHAT IT COST (needs `20260922` applied)
STATUS: needs-test
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's ruling ⑦, 2026-09-22
SIGNAL: —

⚠️ **RUN ON TEST DAVE'S.** With a complete, fully linked recipe, record a build run, then note the
cost it shows. Now **change a component's price** (or capture a corrected receipt) and look again.
**PASS:** the **recipe's** cost per yard moves, and the **build run's** frozen cost does **not**.
**🔴 FAIL if** the run's figure moves with the recipe. A run is an EVENT — what it cost is a fact
about that day. Re-valuing units already made is how the books stop reconciling.
⚠️ **There is no screen for a build run yet** — this card is `needs-test` until one exists; the
database side is proven by `build-runs-freeze-370.pglite.mjs` V1.

### CARD 19 — 🔴 A 2.5 YARD BATCH SAYS WHAT WENT ON THE BOOKS (needs `20260925f` applied)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #410
SIGNAL: the confirmation names BOTH figures — "makes 2.5 yd" and "3 went on the books"

⚠️ **RUN ON TEST DAVE'S.** You need a recipe whose batch makes a **part** of a yard — 2.5 yd is
LAWNS's real figure — and a stock row for the made item sitting at a **whole** number.
Record a build of **one batch**, then read the confirmation and the item's on-hand.
**PASS:** it tells you the batch makes **2.5 yd**, that **3** went on the books, and that the half
yard is a rounding — *"stock is counted in whole yd"* — and it points at holding the item in
gallons. The ledger row for that build reads **+3**, the same as the row moved.
**🔴 FAIL if** it says only "made 2.5" and leaves on-hand up by 3 with nothing to explain it. That
is the defect: half a yard of mix that does not exist, on the figure the shortage calculation reads.
⚠️ **Before `20260925f` is applied this card CANNOT pass** — the old function has no field to say it
in. The database side is proven by `build-run-rounding-410.pglite.mjs` (R1 red-first, V1–V4 run
verbatim, M3/M4 caught).

### CARD 20 — 🔴 A COMPONENT YOU DID NOT HAVE IS NOT RECORDED AS USED (needs `20260925f` applied)
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: #410
SIGNAL: "wanted 25 lb, took 10 lb — there was not enough on hand"

⚠️ **RUN ON TEST DAVE'S.** Link a component to a stock row holding **less than the recipe wants**
(e.g. recipe wants 25 lb of Osmocote, the row has 10). Record one batch.
**PASS:** the component's on-hand lands at **0**, its ledger row reads **−10**, and the
confirmation NAMES the shortfall — what was wanted, what was taken, and that there was not enough.
**🔴 FAIL if** the ledger says **−25**. Nobody took 25 lb; the row only had 10. A consumption that
did not happen is on the permanent record for ever, and the reconcile replay will carry the
difference every time it runs.

---

# NEEDS A DESK VISIT (a second person, or Lauren's own login)

### CARD 13 — 🔴 A MANAGER CAN DO THIS; A YARD HAND CANNOT
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: §1.6 item 4 — enforced SERVER-SIDE, not merely hidden
SIGNAL: —

Sign in as a **staff** member (no `settings:update`). Open an item, set **Made here**, and try to
save a recipe.
**PASS:** on the item editor, a red band appears at the top of the **How it is made** section reading
*"That change was not saved: the write returned no row, which usually means permission was refused.
Nothing changed."*, and the **Where this item comes from** dropdown snaps back to **Bought in**.
**🔴 FAIL if** it appears to save and is gone after a reload. That is the worst of the three
outcomes: the person believes they recorded something.
⚠️ **The refusal is the DATABASE's, not the screen's.** The policy is on `settings:update`; the UI
hides nothing it cannot enforce.

### CARD 14 — 🔴 THE RECIPE SURVIVES A CATALOGUE RELOAD
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David's ruling — *recipes survive the wipe, keyed by `qb_item_id`* · trigger `recipe_link_must_survive_a_wipe`
SIGNAL: —

⚠️ **RUN THIS ON TEST DAVE'S, NEVER ON LAWNS.** Write a recipe on an imported item, then **re-import
the QuickBooks catalogue** (which replaces every inventory row id).
**PASS:** open the item afterwards — **the recipe is still attached**, with its components and its
linked purchases.
**Why this is the card that matters most:** the 2026-09-21 reload replaced all 632 row ids and kept
every QuickBooks id. A recipe keyed on a row id would be silently orphaned — and the undo would
refuse to run at all. It is proven on Postgres (harness `recipes-survive-wipe-370.pglite.mjs`, ALL
PASS) and by a database trigger that refuses to create a wipe-blocking link; **this card is the same
claim through the real screens.**
**FAIL if** the recipe is empty, missing, or the re-import refuses to run.

---

## NOT COVERED — STATED, NOT HIDDEN

| Surface | Why no card yet |
|---|---|
| **The build run** (`record_build_run`) | No screen calls it. The function is applied and harness-proven; a person cannot reach it, so there is nothing to owner-prove. Its screen is its own build. |
| **Labour rates** | The table ships **empty by instruction** and has no editor. CARD 10 proves the empty state is honest; the editor is David's call. |
| **The per-tree cost report** | Not built — it is the next stream after this review. |
| **Deleting a recipe** | There is no delete, by design (R-133's shape: a recipe a build run consumed against must not vanish). Nothing to test. |
