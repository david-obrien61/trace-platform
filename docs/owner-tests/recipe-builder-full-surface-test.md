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

**Board: 0 of 14.** Every card is `STATUS: owed`. ⚠️ **THE SCREENS ARE HELD, NOT MERGED**
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
- [ ] **② THE MIGRATIONS ARE APPLIED — BOTH, AND THEY ALREADY ARE.**
      `20260921_recipes_made_items.sql` (applied 2026-09-21, SHA `0e6f3d6d90b6bd07aa2244a5c238aa96998eab65061ec63750aecd213cafe3b8`)
      and `20260921c_build_run_says_when_the_ledger_did_not_record.sql` (applied, SHA
      `b258dbf5110b35cd94de1602aaf1c9e6fea6d4a7c1e1f114e0ea1cb06996c985`).
      **Nothing further to apply for this board.** Recorded so nobody goes hunting.
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

### CARD 4 — 🔴 A COMPONENT ON NO PURCHASE IS ALLOWED, AND SAYS SO
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

### CARD 10 — 🔴 LABOUR IS MINUTES AND NO MONEY
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: David, 2026-09-21 — the labour table ships EMPTY
SIGNAL: —

Put **38** in **Build time (minutes)**.
**PASS:** the panel reads **Labour — 38 minutes, not costed yet — no rates entered**, the batch is
still **incomplete**, and **labour is named among what is missing**.
**🔴 FAIL if** labour contributes any dollar figure. Nobody has entered a rate; a rate we invented
would be indistinguishable from one you set.

### CARD 11 — 🔴 SAVE IT, RELOAD, AND IT IS ALL STILL THERE
STATUS: owed
LAST-PROVEN: never
DEVICE: desktop
COVERS: ledger #370 · tech-debt #69's shape (a multi-step save)
SIGNAL: `[TRACE:RECIPE] saved {components: 7}`

Finish LAWNS's Special Planting Mix — all seven components — and press **Save recipe**.
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
