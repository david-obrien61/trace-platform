# YARD PRODUCTION — the design note, and the measurements it rests on
**Filed 2026-09-25 (YARD-PRODUCTION, ledger #409–#414). Every figure labelled LIVE or FIXTURE per §6 r25.**

One sentence: **LAWNS blends its own install mix, and the platform can neither say how much it has nor
tell anyone to make more.** This note records the standard each phase builds to, what already exists,
and the four places the prompt's premise turned out not to match the database.

---

## 0 · The industry standards this package builds to, and why each one earns its place (§6 r10, r16)

| Standard | What it is | Where it lands here |
|---|---|---|
| **Item master with a base unit + alternate sale units (UoM conversion)** | one item is held in ONE stocking unit; every sale unit is a *conversion* of it, never a second item | **P1** — the mix is held in gallons; the scoops and buckets become sale units |
| **Bill of materials / kit, consuming base items** | a finished or delivered thing lists the items it consumes, with a quantity rule per line | **P3** — the install kit |
| **Inventory issue on sale/install, receipt on purchase/build** | stock moves on an event, through one posting path | **P4** (issue) and **P2/P5** (receipt from a build) |
| **MRP — on hand − scheduled demand vs safety stock → planned order, offset by lead time** | the textbook shortage calculation, driven by a *known schedule* rather than an average | **P7** |
| **Field-service work order** (date · crew · lines · status) | the job record a crew is dispatched against | **P6** |

⚠️ **Deliberately NOT adopted, with the reason (§6 r10's "diverging above the need" clause):** no
separate *planned-order / released-order* lifecycle (a draft work order and a confirmed one are the
same row with a status — LAWNS has one yard and three crews, not a shop floor); no lot/serial
tracking on the mix (it is a pile, not a batch-traced pharmaceutical); no *scheduled receipts* term in
the MRP arithmetic, because a build lands in stock immediately, so the term is structurally zero —
**that is a modelling choice, not a gap in the formula**, and it is written down so nobody "fixes" it.

---

## 1 · 🔴 FOUR PREMISES IN THE PROMPT THAT THE DATABASE DOES NOT AGREE WITH

Recorded first, because three of them change what gets built ([[R-26]]: a written declaration nobody
checked against reality, steering a decision).

**(a) The five sale SKUs do not exist as SKUs. `sku` is NULL on every one of them.** The prompt names
`SFCM1` · `SFCM2` · `FCMB15/30/45`. **LIVE 2026-09-25: all ten mix rows carry `sku = NULL`** and are
identified only by `qb_item_id`. ⇒ **Every link in this package keys on `qb_item_id`, with `sku` as an
optional second key.** Keying on the SKU as written would have produced a config that matches nothing.

**(b) There are TEN rows in TWO families, not five.** LIVE 2026-09-25:

| Portion | Fertile Compost Mix — Proprietary Blend (**LAWNS blends this**) | Regular Compost Mix — w/o Fertilizer (**bought**) |
|---|---|---|
| 1 Yard Scoop | **qb 52** · qty 1 · `manufactured` | qb 54 · qty 10 · `purchased` |
| 1/2 Yard Scoop | qb 51 · qty 10 · `purchased` | qb 53 · qty 10 · `purchased` |
| 15gal Bucket | qb 40 · qty 10 · `purchased` | qb 48 · qty 10 · `purchased` |
| 30gal Bucket | qb 41 · qty 10 · `purchased` | qb 49 · qty 10 · `purchased` |
| 45gal Bucket | qb 42 · qty 10 · `purchased` | qb 50 · qty 10 · `purchased` |

⇒ The package must be able to describe **two bases** — one made, one bought — and **only qb 52 is typed
`manufactured`**; the other four Fertile portions are typed `purchased`, which is the old five-piles
model showing through. **Every qty above is `qty_basis = 'placeholder'` — a catalogue-import seed, not
a count. Not one of these ten rows has ever been counted.**

**(c) The recipe already exists AND its yield is already 2.5.** LIVE 2026-09-25: one recipe,
`qb_item_id = 52`, **`yield_quantity = 2.5`, `yield_unit = 'yd'`** — and `item_recipes.yield_quantity`
is already `numeric`, so **"accepts decimals" was already true**. P2 is therefore NOT the yield field;
see §2. Its seven components are **Shook Out Brown 2 yd · Compost 0.5 yd · Osmocote 25 lb · Micromax
2 lb · Ferrous Sulfate 2 lb · 19-5-9 2 lb · 12-24-12 2 lb** — richer than the prompt's four
fertilisers, and **0 of 7 are linked to an inventory item**, so a build consumes nothing.

**(d) A work order does exist for equipment.** `business_pmi_schedule` is equipment-only, as this
morning's recon said — but it is the shape to learn from, not a blank sheet.

---

## 2 · 🔴 THE DEFECT THAT DECIDES P1's DESIGN, MEASURED NOT REASONED (§6 r19, r26)

**`business_inventory.qty` is `integer NOT NULL` (LIVE snapshot 2026-09-24). `record_build_run`
computes `v_made := yield_quantity * batches` as `numeric` and assigns it into that integer column.**

Executed against the live schema snapshot in PGlite — the real `record_build_run`, the real column
types, the real `has_permission`:

```
BEFORE qty: 1
record_build_run(LAWNS, recipe, 1 batch) → {"ok":true, "made":2.5, "unit":"yd", …}
AFTER  qty: 4
```

**One batch that made 2.5 yards added 3 yards of recorded stock.** `1 + 2.5 = 3.5`, and
numeric→integer rounds **half away from zero** (measured: `2.5→3 · 3.5→4 · 0.5→1 · 1.5→2 · 7.5→8`).
🔴 **The RPC returns `"made": 2.5` in the same breath — an honest report beside a silently wrong
write**, which is why no screen and no test has caught it.

🔴 **AND THE EXISTING HARNESS COULD NOT HAVE CAUGHT IT — §6 r19's exact shape.**
`build-runs-freeze-370.pglite.mjs` builds its own stand-in table with **`qty numeric DEFAULT 0`**,
so the double can hold 2.5 and the production column cannot. *A test double more forgiving than the
real system*, proving the 2.5 yield against a column type that does not exist.

**⇒ THE FIX IS THE BASE UNIT, AND THAT IS WHY P1 COMES FIRST.** Holding the mix in **gallons** makes
the granularity fine enough that rounding stops mattering: the per-batch error falls from
**0.5 yd on 2.5 yd — 20%** to **504.935 gal → 505 gal, 0.013%**. A yard-based integer column cannot
represent half a yard at all; a gallon-based one is wrong by two thirds of a cup.
⚠️ **This is not an argument for making `qty` numeric.** `qty` is an integer because most of this
catalogue is trees, and "27 trees" is the right shape. **The unit changes, not the column.**

---

## 3 · What each phase builds, and what it must NOT rebuild

**P1 · ONE ITEM, SALE UNITS (#409).** A base item held in gallons, shown in yards; each sale unit a
conversion row keyed on `qb_item_id`. **The yards⇄gallons factor is NOT new** — `trueGallonsPerCubicYard`
is already an Operations config key the load list reads. Reuse it (§6 r8); do not add a second factor.
The ten existing placeholder counts are **REPORTED, never merged** — the opening base figure is
David's (see the morning file).

**P2 · RECIPE YIELD (#410).** Not the yield field — that is already 2.5 and already numeric. What is
owed: **cost per unit = batch cost ÷ yield**, and **naming the 7 unlinked components on screen** so
"this build consumed nothing" stops being invisible. Plus the integer-rounding repair from §2.

**P3 · CONFIGURABLE INSTALL KIT (#411).** 🔴 **`loadList.ts` ALREADY computes every install quantity**
— mix per container gallon, T-posts per rung, rope per T-post, bubblers, deer-fence posts, ring
circumference — from the container ladder plus five Operations keys, under [[R-155]] and ledger #343,
and it is 748 lines of deliberate design with *"this file holds NO numbers of its own"* written at the
top. **The kit does not re-derive any of it.** What is missing, and all that is missing: **the
component → inventory item link**. Without it there is nothing to issue from. So the kit is a table of
*(component role → `qb_item_id` → quantity rule)*, and the quantity rules point AT the load list's
existing arithmetic rather than copying it.

**P4 · INSTALLS DRAW STOCK (#412).** Through the **existing test-mode ledger guard** — measured above:
the guard suppresses the ledger row and says so (`"the movement was not recorded in the ledger"`),
while the qty still moves. No new inventory writer. A Delivery-only stop issues nothing. **The Google
review-ask hold is not touched.**

**P5 · BUILDS MEASURE THEMSELVES (#413).** `item_recipes.build_minutes` and `build_minutes_because`
**already exist**; `build_runs` has `built_at` but no start/finish. Add the pair, measure over real
runs, and label the figure *"measured over N batches"* — never assumed, because LAWNS has never
timed one.

**P6 · YARD WORK ORDERS (#413).** Date + crew (**reusing `teams`**) + lines + status + notes. MIX BATCH's
Done calls `record_build_run`, which already exists and already takes a batch count. UPPOT's Done uses
the existing rung-dates writer.

**P7 · MRP (#414).** On hand − scheduled demand, day by day, against a per-business minimum, offset by
lead time → a **draft** work order a person confirms, moves or deletes.
🔴 **AND THE HONEST REFUSAL THAT MAKES IT SAFE: every mix row's `qty_basis` is `placeholder`.** An MRP
that subtracts real demand from a seeded 10 produces a confident fiction. So until the pile has been
counted once, the band says **"the mix has never been counted — count it to plan"** and plans nothing.
That is D-9 / A9 (absent is not empty) at the one place it would otherwise be most expensive.

---

## 4 · Wipe classification (STD-019) — declared, per the prompt's hard constraint

| New table | Wipe class | Why |
|---|---|---|
| `item_sale_units` | **CONFIG — SURVIVES the wipe** | keyed on `qb_item_id`; the products are recreated by the reload, the conversions must not be re-entered |
| `install_kit_components` | **CONFIG — SURVIVES** | same: role → `qb_item_id` → rule |
| `work_orders` / `work_order_lines` | **LIVE CAPTURE — does not survive** | a work order is a dated event, not configuration |

For HISTORY's classification: appended to `~/Desktop/trace-sessions.md`.
