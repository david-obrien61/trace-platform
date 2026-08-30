# SPEC — ② THE QUICKBOOKS ITEM MAPPING

**Written:** 2026-08-30 · **Written by:** ③ (the push disarm), which CONSUMES this and does not create it
**Status:** SPEC — not built, no schema written, no column created
**Story:** `user_stories.md` → *QuickBooks read-back + customer de-dup against the books* (`MAPS-TO: 4.1`, `PIECES: qbo_itemref_mapping`)
**Consumer, already shipped:** `packages/shared/src/quickbooks/invoiceLineShapes.ts` → `qboItemMappingOf` / `resolveQboItemRef`

---

## 0. 🔴 WHY THIS SPEC EXISTS AT ALL — THE PREMISE THAT WAS WRONG

③ was scoped on the sentence *"after ②, a Cultivar inventory row carries its QuickBooks SKU, so the push
resolves the ItemRef from the row."* Three measurements taken before any code was written:

| Claim | Measurement | Verdict |
|---|---|---|
| ② has landed | `git fetch --all`; `origin/main` == local `main`; no branch carries it | **FALSE** |
| A row carries a QuickBooks reference | `grep -rn "qb_item_id\|qbo_item_id\|quickbooks_item\|qb_sku\|qbItemId"` over all `.ts`/`.tsx`/`.sql`/`.md` → **zero hits** | **FALSE** |
| `business_inventory.sku` is that reference | It is TRACE's OWN generated identifier — `variantGroup.ts:42` `skuSizeSuffix` → `deriveSiblingSku`. Intuit has never seen it | **FALSE** |

🔴 **AND THE CORRECTION THAT MATTERS MOST: `ItemRef.value` TAKES AN INTUIT `Id`, NOT A SKU.**
`Item.Sku` is a different field — one our own read does not even retain (`itemList.ts:29-36` reduces an
item to `id · name · type · incomeAccount · active`). **A SKU stored where an Id belongs resolves to
nothing, or worse, to something.** ② must store the **Id**.

This is [[R-26]] instance 13 — a written declaration nobody checked against reality, steering a decision.
David owned it on being shown the measurements, and ③ was rebuilt as consume-only.

---

## 1. WHAT ② MUST DELIVER — THE CONTRACT, IN ONE PARAGRAPH

**Every row that can back a REVENUE line on a QuickBooks invoice must be able to name the Intuit `Item.Id`
it books against.** One column, `qbo_item_id text`, nullable. Optionally a second, `qbo_item_name text`,
holding Intuit's item name for readability — **non-authoritative, never used to resolve anything**, so it
may drift without breaking a push.

The consumer is already written and already tested (`invoiceLineShapes.test.ts` §A, 50 assertions). It reads:

```ts
qboItemMappingOf(row)  // → { qboItemId, qboItemName } | null
```

**It tolerates the column's absence on purpose** — a PostgREST select cannot name a column that does not
exist without failing the whole query, so the selects in `cultivar.ts` stay as they are until ② lands.
**The moment the column exists AND is added to the select, every revenue line resolves — with no change in
③ and none at its call sites.**

⚠️ **A BLANK IS NOT AN ID.** `''` and `'   '` map to `null` and refuse exactly like a missing value. Pushing
`ItemRef: { value: "" }` to a customer's books is worse than refusing, because it looks like it worked.
(Asserted: `invoiceLineShapes.test.ts` A4/A4b/A4c.)

---

## 2. WHICH TABLES — IT IS THREE, NOT ONE

The five revenue lines the push can emit are backed by **three different tables**. "A Cultivar inventory row
carries its SKU" covers exactly one of them.

| Backing table | Which line(s) | `source` in a refusal | Volume at LAWNS |
|---|---|---|---|
| **`business_inventory`** | 🔴 **the goods line — the tree.** The one that decides whether the books can tell Sales of Nursery Stock from Services at all | `business_inventory` | **447 rows**, growing to ~1,132 after the 685-item import |
| **`service_offerings`** | the service line (`subtotal > 0`), the service RETAIL baseline on an override, and an override **surcharge** | `service_offerings` | `[STATED]` **ONE row** — "tree placement" |
| **`addons`** | the legacy `order_addons` line | `addons` | `[STATED]` small |

⚠️ **`service_offerings` and `addons` are the ENTITY tables, not the ORDER-LINE tables.** The mapping belongs
on the thing being sold, not on each sale of it — `order_service_selections` and `order_addons` are line
rows and must not carry a copy. One fact, one place (STD-011).

---

## 3. 🔴 HOW EACH GETS POPULATED — AND WHY ② IS SMALLER THAN IT LOOKS

**This is David's own correction to the scoping, and it collapses most of the work:**

> **THE IMPORT GETS THE INTUIT `Id` FOR FREE ON EVERY ROW IT IMPORTS.** It is reading FROM QuickBooks — the
> Id is in hand at write time. What it gets nothing for is rows that ALREADY EXIST.

So the work splits cleanly, and only one half is real:

### (a) Imported rows — **no mapping job at all, just don't throw the Id away**
The 685-item import reads Intuit's item list, which carries `Id` on every row (`QboItemRow.id`, already
parsed). Writing `qbo_item_id` at insert time is **one more column in a write that is already happening**.
⚠️ **The failure mode is doing nothing: importing the rows and discarding the Id, then needing a second pass
to match them back by name.** The discovery doc already flagged the same shape for invoices — *"the QBO id
is the idempotency key, not just a cross-link."*

### (b) Rows that already exist — **a short mapping job, not a second import**
- **`service_offerings`: ONE row.** This is a single UPDATE once someone reads which Intuit item "tree
  placement" should book to.
- **`addons`: small.** Same shape.
- **`business_inventory`: 447 existing rows.** The only one with volume. ⚠️ **Do NOT auto-match by name.**
  The units pass measured that LAWNS spell 15 physical sizes 46 different ways; a name matcher over that
  catalogue will confidently mis-map, and a mis-mapped item is a **silently wrong** book entry — the exact
  failure ③ exists to prevent, arriving through the back door. A **preview-before-commit** surface is the
  right shape, and it is already on its **fifth caller** (contacts, inventory, vendor terms, historical
  invoices, and now this).

### (c) 🔴 THE POLICY QUESTION ② MUST ANSWER, AND ③ DELIBERATELY DID NOT
**Do all 447 nursery lots point at ONE Intuit item ("Nursery Stock"), or does each variety get its own?**
This is not a technical question — it is what the customer's P&L will be able to say. Their books already
hold the answer for how they have sold historically (the `#231` invoice read reports top items by quantity),
so per [[R-25]] **it is answered from their history, not by us picking a default.**

---

## 4. WHAT THE RESOLVER EXPECTS TO FIND — THE EXACT SHAPE

```ts
// on the backing row, as selected by PostgREST
{ qbo_item_id: '47', qbo_item_name: 'Nursery Stock:Trees' }
```

Then, for each line carrying money:

```
resolveQboItemRef({ label, source, amount, mapping })
  → { ok: true,  itemRef: { value: '47', name: 'Nursery Stock:Trees' } }
  → { ok: false, unmapped: { label, source, amount } }      ← NO fallback branch exists
```

**A single unmapped revenue line refuses the WHOLE push** (422 `QBO_ITEM_UNMAPPED`), naming every unmapped
line at once with the money at stake. There is deliberately no partial invoice: an invoice that is
three-quarters right is silently wrong on the fourth line. (Asserted: `qboInvoiceLines.test.ts` D6.)

### What ② must ALSO do, in the same pass
Add the column to the three selects in `cultivar.ts` (`:381` `order_items → business_inventory(...)`,
`:386` `order_service_selections → service_offerings(*)` — already `*`, so free — and `:390`
`order_addons → addons(*)` — also `*`, so free). **Only the `business_inventory` select names its columns
explicitly and therefore needs editing.**

---

## 5. ⚠️ THE LEGACY INSTALLATION LINE IS NOT A MAPPING PROBLEM — ITS OWN DECISION

`cultivar.ts`, the legacy `transport_method === 'install'` branch, pushes a line **backed by no row at all**.

- **A row can be given a `qbo_item_id`. A hardcoded line has nothing to carry one.**
- It is **$0 by construction today** (install pricing moved to `service_offerings` and was never re-wired),
  so ③ lands it as a `DescriptionOnly` note and no id is needed.
- 🔴 **The day install pricing is re-wired it becomes revenue with `source: 'none'`**, and the refusal will
  say *"this line is backed by nothing"* rather than sending someone to fix a row that does not exist.
  (Asserted both ways: `qboInvoiceLines.test.ts` E5 and E6.)

**It either gets a source or it stops being pushed. That is David's call, and it is NOT folded in with the
other four.**

---

## 6. WHAT ② DOES **NOT** NEED TO DO

- **No change to `invoiceLineShapes.ts`.** The consumer is written, tested, and mutation-proven (14/14).
- **No change to the refusal path, the reconcile, or the payload shape.** All shipped in ③.
- **Nothing about the discount, the $0 notes, or the tax.** Those needed no item id and are done.
- **No persisting of the customer's chart of items beyond the ids actually used.** ⚠️ Persisting a
  customer's item catalogue is a **separate ruling that has not been made** ([[R-23]] clause b) — storing
  the id a row books against is a mapping, not a copy of their books, and ② should stay on that side of the
  line unless David rules otherwise.

---

## 7. THE ACCEPTANCE ③ COULD NOT MEET, HANDED FORWARD

③'s acceptance read: *"a test order on Test Dave's produces a payload whose lines carry real item ids, $0
notes as DescriptionOnly, the discount as DiscountLineDetail and the tax as TxnTaxDetail — and a line whose
row has no SKU refuses rather than defaulting."*

**Three of the four are met and proven. "Lines carry real item ids" CANNOT be true until ② lands, and is
reported UNMET rather than faked.** What ③ proved instead is that the consumer is correct *when* the ids
exist — the `mapped` fixture in `qboInvoiceLines.test.ts` is invoice 436 with `qbo_item_id` on its rows, and
it produces exactly the payload ② will make live. **② turns a passing fixture into a passing live order.**
