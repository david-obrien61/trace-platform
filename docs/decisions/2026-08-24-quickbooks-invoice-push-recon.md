# RECON — The QuickBooks invoice push

**Date:** 2026-08-24 · **Type:** READ-ONLY RECON (LOOK ONLY — nothing under `packages/` `api/` `supabase/` changed)
**Evidence (measured, not inferred):** QB invoice **txnId=436** · Cultivar order **`2661dbe4-e26d-486f-b65f-50e0f56716c3`** ·
dated **07/16/2026** · QB status **"Opened"** — meaning **sent AND viewed by the customer.**
**Governs:** **R-7** (attribution over approval, OPEN as build / IMPLEMENTED as doctrine) · **D-37** (money boundary) ·
**R-6** (late discount + discount TYPE — **OPEN, nothing built**) for Q1 option C.
**Seam:** ONE live file — `packages/cultivar-os/api/qbo/invoice/cultivar.ts` (723 lines).

---

## ✅ WHAT WORKS, STATED FIRST, BECAUSE NO OPTION BELOW MAY BREAK IT

The arithmetic reconciles (496 + 399 + 125 + 1575 − 575 = 2020; × 7.6% = 153.52; total 2173.52), line-level detail
reaches QB, and **the negative-adjustment shape preserves BOTH the original price and the concession** — which is
exactly what R-7 wants. That shape is not incidental; it is a scar with a name. `cultivar.ts:481-486` records it:
the branch *"used to push Amount = subtotal (the overridden $1000) alongside UnitPrice 225 × Qty 7, and QuickBooks
REJECTED the whole invoice — 6070 'Amount is not equal to UnitPrice * Qty'."* **There is also a reconcile guard**
that refuses to push an invoice whose lines do not sum to what TRACE charged (`cultivar.ts:625-637`).
**Every option costed below leaves the retail-line + negative-adjustment-line pair intact.**

---

# Q1 · 🔴 THE OVERRIDE REASON IS PRINTED TO THE CUSTOMER

## Where it is composed, and where `override_reason` enters

| step | code | file:line |
|---|---|---|
| the reason is read off the selection row | `const svcReason = (sel.override_reason ?? '').trim();` | **`cultivar.ts:481`** |
| it is interpolated into the QB line **description** | ``discountLine(`${offering.name} — price adjusted${svcReason ? ` (reason: ${svcReason})` : ''}`, svcAdj)`` | **`cultivar.ts:500-503`** |
| `discountLine` builds the negative line | `Description: description, Amount: -amount, …` | `cultivar.ts:313-320` |

**That single interpolation is the whole mechanism.** It matches the rendered invoice exactly:
*"Placement Service — price adjusted (reason: must be filled if discount applied cannot be EMPTY)"*.

## (a) Is the reason ALWAYS appended, or only on some paths?

**Only on ONE path, and it is conditional even there.**

- **It appends ONLY in the `svcOverridden` branch** — `sel.is_manual_override === true && Math.abs(svcAdj) >= 0.005`
  (`cultivar.ts:480`). An owner **service price override** is the only thing that carries a reason to QB.
- **It is omitted when empty** — `svcReason ? … : ''` (`:501`) — deliberate omit-not-fake (D-9); `cultivar.ts:479`
  says so: *"Historical override rows predate the required-reason rule → omit rather than invent."*
- 🔴 **The TIER discount line carries NO reason at all.** `cultivar.ts:451` pushes
  ``discountLine(`Discount${qbDiscPct > 0 ? ` (${qbDiscPct}% off)` : ''}`, qbDiscountTotal)`` — a **percentage only.**
  **So the two concession types are printed on completely different terms: a tier gives a number, an override gives
  free text.**

## (b) 🔴 Does the same text reach anywhere else customer-facing? **YES — the register receipt, through a SHARED component.**

| surface | audience | file:line |
|---|---|---|
| **QuickBooks invoice line** | 🔴 **CUSTOMER — SENT AND VIEWED** (status "Opened") | `cultivar.ts:500-503` |
| 🔴 **The Confirmation receipt** — the post-checkout screen at the register | 🔴 **CUSTOMER, standing there** | `Confirmation.tsx:94-101` → `services={svcAll}` `:237` → **`OrderTotals.tsx:97`** |
| **Order detail** — the owner's order screen | internal (login + RLS) | `OrderDetail.tsx:278` → `:382` → **the same `OrderTotals.tsx:97`** |
| **Cart Review** — the seller's own screen mid-edit | seller (customer may be beside it) | `CartReview.tsx:803` |

🔴 **THE PART THAT DECIDES WHAT A FIX COSTS: the receipt and the internal order screen are THE SAME COMPONENT.**
`OrderTotals.tsx:97` renders ``{s.adjustmentReason ? ` · ${s.adjustmentReason}` : ''}`` and is imported by BOTH
`Confirmation.tsx:5` and `OrderDetail.tsx:20`. Its own header calls it *"the ONE canonical show-the-work totals
block (STD-011)"* — **so it is one seam serving two audiences, and it currently has no idea which one it is
rendering for.** Any internal-vs-customer split has to teach it.

**No emailed confirmation of ours carries it** — `packages/shared/src/notifications/send.ts` exists, but no order/
invoice path calls it with line detail. **The email the customer actually received is QuickBooks' own**, which is
why the invoice shows "Opened".

## (c) 🔴 Is there an existing internal-vs-customer-facing distinction to FOLLOW rather than invent? **YES — in `packages/shared/`, on the ADJACENT field.**

**CORE MANDATE rule 1 checked first, and it pays out.** `packages/shared/src/business-logic/taxExemption.ts` already
solves this exact problem for the sibling reason field (`orders.tax_exempt_reason`):

```
TAX_EXEMPTION_REASONS: [ {code:'resale', label:'Resale / reseller certificate'}, {code:'nonprofit', …},
                         {code:'government', …}, {code:'agricultural', …}, {code:'other', label:'Other'} ]   :27-33
taxExemptionLabel(reason)  — a known code → its label; anything else (the 'other' free text) → as-is   :39-44
describeTaxLine(…)         — "the SINGLE place the three-state wording lives, so Review, Confirmation … agree"  :10, :62
```

**The stored value is a CODE; a presenter turns it into customer-readable text; `'other'` is the escape hatch that
stores free text.** And `cultivar.ts:596` **already calls `taxExemptionLabel`** when it builds the tax-exempt line —
**so the QB push is already importing this pattern for one reason field and not the other.** ✅ **This is a pattern
to follow, not one to invent.**

## Options — costed NEED→WANT. 🔴 NOT COLLAPSED. David decides.

> Every option preserves the retail-line + negative-adjustment pair. None needs a new `api/` function (12/12).

### A. Stop sending the reason; the line reads "price adjusted"
- **Change:** delete the `${svcReason ? ` (reason: ${svcReason})` : ''}` interpolation. **`cultivar.ts:501` — ONE line, ONE file.**
- `svcReason` (`:481`) becomes unused → also drop it, or it trips the quality gate's unused-var rule.
- **Cost: the smallest thing on this page.** No migration, no schema, no shared change, no new permission.
- ⚠️ **What it gives up:** QuickBooks then shows a $575 concession with **no "why" anywhere in the accounting
  system**. The reason still exists internally (`override_reason`, and the receipt/order-detail render it) — but the
  invoice becomes a number without an explanation, and **Lauren's after-the-fact investigation moves out of QB.**
  ⚠️ **It does NOT fix the receipt** (`OrderTotals.tsx:97`) — the customer still reads the reason at the register.

### B. Split the field — internal reason + optional customer-facing note
- **Change:** one additive migration (a `customer_note` alongside `override_reason` on `order_service_selections`;
  `order_items` carries the same five override columns per `20260708_service_override_leakage.sql:23-36`, so decide
  whether it needs the twin) · `CartReview.tsx` override editor (`:742-855`) gains a second input · `submit.ts:577`
  `overrideCols` writes it · `cultivar.ts:501` reads the note instead of the reason.
- 🔴 **Plus the part that is easy to under-cost: `OrderTotals.tsx` must learn its audience.** It is ONE component
  with TWO consumers (`Confirmation` = customer, `OrderDetail` = internal), so it needs a prop and both call sites
  updated — **and getting that wrong prints the internal reason on the receipt, which is today's defect with more steps.**
- **Cost: ~4 files + 1 gated migration + a shared-component signature change.** No new api fn.
- ⚠️ Two fields for one act means one can be left blank or contradict the other; the required-ness rule has to say
  which is required.

### C. Send a discount TYPE, not free text
- 🔴 **REPORTED AS ASKED: the R-6 concept is NOT reachable from here today, and it is missing in TWO independent ways.**
  1. **The vocabulary exists but is scoped to CUSTOMER TIERS, not to a per-line service override.**
     `DiscountType { name, tiers }` / `DiscountTier { name, basis, discountPercent, accessTerms }` —
     **`packages/shared/src/business-logic/tierPricing.ts:120-132`** — configured on the Discounts page.
     **R-6's own line says the values aren't there either:** *"'military' is not a configured type today. The
     mechanism exists — the Discounts page already offers `+ Wholesale`, `+ Municipality`, `+ Custom`."* **R-6 is OPEN.**
  2. 🔴 **The chosen tier's NAME is never persisted on the order.** `orderBase` (`submit.ts:685-698`) writes no tier
     column; `order_items` stores `discount_pct`/`discount_amt` only (`20260713_order_items_line_breakdown.sql:63-65`).
     **That is why the tier line can only print `Discount (10% off)` — the push has a percentage and nothing else.**
- **Cost: the largest here, and it is partly BUILDING R-6** — a reason vocabulary (new), or a persisted type/tier name
  (new column + writer), plus a presenter. ✅ **The presenter half is free and proven** — `taxExemption.ts`'s
  code→label shape, already imported by this very file (`cultivar.ts:596`).
- ✅ **What it buys:** the reason becomes a bounded, owner-sanctioned value — **which is the R-7 control working as
  ruled** (*"a seller picking from that list can only give away a number she already sanctioned"*), and it makes the
  lost-money report R-7 says is OWED actually groupable.

### D. Leave it, and make the input say plainly that the customer will read it
- 🔴 **REPORT FIRST — IT PARTLY SAYS THIS ALREADY, IN THE ONE PLACE NOBODY READS IT FIRST.**
  `CartReview.tsx:850` reads *"A reason is required to change this price — **it goes on the invoice and the record**."*
  **But it renders ONLY inside `{reasonErr && …}` (`:848`) — i.e. only AFTER you try to save an empty reason.**
  The always-visible copy is the label `Reason *` (`:838-840`) and the placeholder `"e.g. loyal contractor"` (`:844`).
- **Change: promote that sentence to always-visible helper text and sharpen it from "the invoice" to "the customer
  will read this on their invoice". `CartReview.tsx` — ~2 lines, ONE file.**
- **Cost: the cheapest honest option.** No migration, no shared change, nothing sent differently.
- ⚠️ **What it does NOT do:** anything already sent stays sent — **including invoice 436** — and it relies on the
  seller reading a label mid-sale with a customer waiting.

---

# Q2 · 🔴 EVERY LINE BOOKS AS "Services", INCLUDING PLANTS

## How a Cultivar line becomes a QB line, and how the ITEM is chosen

**Goods:** `cultivar.ts:424-444` — loops `orderItems`, name via `orderItemName()`, `Amount` = retail×qty when a
discount applies else `subtotal`, then pushes `SalesItemLineDetail`.
**Services:** `cultivar.ts:455-531` — loops `serviceSelections`, branching netting-declined / overridden / $0 transport / normal.

**The ITEM is chosen like this, everywhere:**

```js
ItemRef: { value: '1', name: 'Services' }
```

## 🔴 THE ANSWER IS (i) — A SINGLE HARDCODED QB ITEM EVERY LINE ATTACHES TO.

**`ItemRef` appears 12 times in the file and all 12 are that identical literal:** `:318` (the discount helper),
`:442` (goods), `:488`, `:496`, `:515`, `:527` (services), `:544`, `:554`, `:575`, `:583` (legacy `order_addons`),
`:600`, `:613` (tax-exempt and tax lines).

- **NOT (ii)** — there is no mapping that collapses to one value. **There is no mapping at all**: no lookup, no
  config, no column, no constant. The string is typed inline twelve times.
- **NOT (iii)** — this is not un-set QB-side configuration we forgot. **We hardcode the reference.** ⚠️ *That QB item
  `1` happens to be named "Services" in this realm is a QB-side fact nobody chose; the defect is that we point every
  line at item `1` regardless.*

## 🔴 Does plant-vs-service survive to the push? **YES — COMPLETELY. The information is not lost; it is KNOWN AND DISCARDED.**

The push reads the two tables **separately and keeps them separate the whole way**:

```
orderItems        ← .from('order_items').select('*, business_inventory ( name, size, sku )')     :381-384
serviceSelections ← .from('order_service_selections').select('*, service_offerings(*)')          :386-389
```

and loops them in **distinct blocks** — goods at `:424`, services at `:455` — with the service branch even reading
`offering.category` (`'transport'`, `'addon'`) at `:459-460`.

> **So at the exact moment the ItemRef is written, the code knows with certainty whether it is holding a plant or a
> service. It writes `'Services'` either way. Nothing is missing from the data; the distinction is thrown away in the
> literal.**

## 🔴 THE CONSEQUENCE, PLAINLY

**Booked this way, a nursery's QuickBooks shows 100% service revenue and zero product sales.** Every tree, every
container, every tarp lands on one service item. **There is no COGS booked against inventory** — the goods lines
never touch an inventory-tracked QB item, so cost of goods sold has nothing to post against and gross margin on
product cannot be computed inside QuickBooks at all. **A P&L built from this data says LAWNS is a service company
that sells no plants.**

---

# Q3 · ⚠️ SALES TAX PUSHED AS A LINE ITEM — MECHANISM ONLY

## Where the tax line is constructed

**`cultivar.ts:588-616`**, in two branches off the order's persisted D-40 tax state:

- **exempt** (`:590-599`) — a **$0** line, a `Description` of `Tax exempt — <taxExemptionLabel(reason)>`
- **taxed** (`:601-616`) — `const taxPct = sub > 0 ? Math.round((taxAmount / sub) * 10000) / 100 : 0;` then a line
  a `Description` of `Sales Tax (<taxPct>%)`, `Amount: taxAmount`, `UnitPrice: taxAmount`, `Qty: 1`,
  `ItemRef: { value: '1', name: 'Services' }`. **The % is DERIVED from amount ÷ subtotal, never a hardcoded rate** —
  the comment at `:585-588` says so explicitly (*"NO hardcoded 8.25%"*). This matches the rendered `Sales Tax (7.6%)`.
- **not-identified** — **no tax line at all** (the redline lives pre-invoice, in the app).

## Does the integration use QuickBooks' own tax fields anywhere?

### 🔴 **NO. A computed line is the ONLY mechanism present, and this is measured, not assumed.**

A repo-wide grep across `packages/` and `api/` for **`TxnTaxDetail`, `TaxCodeRef`, `GlobalTaxCalculation`,
`TaxRateRef`, `SalesTaxRef`** returns **ZERO hits.** No QB tax object is constructed, referenced, or read anywhere.

## D-37 consistency

**✅ CONSISTENT WITH THE BOUNDARY AS WRITTEN — and the reasoning matters more than the verdict.** D-37 scopes **IN**
*"charge computation on originated orders (sell_price × qty, tier discount, tax, total)"* and scopes **OUT**
*"payment processing, collection, reconciliation"* (`2026-07-10-money-boundary.md:43-45`). **Computing the tax and
putting the figure on an invoice IS charge computation — tax is named in D-40 as a computed line on this very
boundary.** Pushing it as a line **processes nothing, collects nothing and reconciles nothing.** It does not cross.

⚠️ **WHAT IS NOT A D-37 QUESTION, FLAGGED AND DELIBERATELY NOT ANSWERED HERE:** the tax amount lands on the same
`'Services'` item as everything else (Q2), so it books as **revenue**, not into QuickBooks' tax-liability handling.
**Whether that is acceptable to a filing business is a question for David's accountant, not for us** — this recon
reports the mechanism and stops. *(No tax-compliance opinion is offered or implied.)*

---

# Q4 · ⚠️ THE REASON FIELD IS REQUIRED SOMEWHERE, VALIDATED NOWHERE

## Every path that writes an override

| # | path | reason REQUIRED? | CONTENT checked? | file:line |
|---|---|---|---|---|
| 1 | **Cart Review override editor** (the only UI that creates one) | ✅ **yes** — `const reason = draftReason.trim(); if (!reason) { setReasonErr(true); return; }` | 🔴 **no** | `CartReview.tsx:768-771` |
| 2 | **submit authority gate** — refuses a caller without `order_discount:apply` with a **403, never a silent drop** | n/a (authority, not content) | n/a | `submit.ts:244-250` |
| 3 | **the shared computation** — `overrideApplies = l.overrideTotal != null && l.overrideTotal >= 0 && reason !== ''`; reasonless ⇒ **refused, baseline charged** (money-safe: refusal charges MORE) | ✅ **yes, independently** | 🔴 **no** | `tierPricing.ts:404-406` |
| 4 | **the INSERT** — `overrideCols(res)` writes the five columns only on `res.isOverride` | inherits #3 | 🔴 **no** | `submit.ts:575-578` |
| 5 | 🔴 **the EDIT path** — `.update({ quantity: su.quantity, subtotal: su.subtotal })` | 🔴 **NOT WRITTEN AT ALL** | — | **`submit.ts:1249`** |

> 🔴 **THREE INDEPENDENT GATES CHECK THAT THE STRING IS NON-EMPTY. NOT ONE OF THEM LOOKS AT WHAT IT SAYS.**
> `trim() !== ''` is the entire validation, at every layer. That is by design — `tierPricing.ts:271-276` states the
> rule as *"REQUIRES overrideReason (STD-013) — a reasonless override is refused"* — **but "a reason exists" and
> "a reason is meaningful" were never distinguished, and the field is printed to a customer.**

## 🔴 Explaining the discrepancy — with a premise correction first

### ① The fourth row does **NOT** hold "the validation message text". It holds a HUMAN's note-to-self.

**Measured:** a grep across `packages/` and `api/` for `"cannot be empty"`, `"must be filled"`, and
`"if discount applied"` returns **ZERO hits.** **This application does not emit that string.** Our actual message is:

> *"A reason is required to change this price — it goes on the invoice and the record."* — `CartReview.tsx:850`

**So the invoice is not echoing our own error text back. Somebody hit the required-reason gate and typed a
description of the rule into the box to get past it** — and because content is never checked, **a note about the
requirement satisfied the requirement, and QuickBooks emailed it to the customer.** ✏️ *That is the finding in its
purest form, and it is worse than the premise: no code path produced that sentence — the control did exactly what it
was built to do.*

### ② Why NULLs are the ordinary case, not three defeated validations

`overrideCols` (`submit.ts:575-578`) writes `override_reason` **only** on the `res.isOverride` branch; every other
selection row is written as `{ is_manual_override: false }` **with no reason key at all → NULL.** ✅ **So a NULL
`override_reason` on a non-overridden line is the CORRECT, expected shape** — an ordinary Delivery or Placement line
has nothing to explain. ⚠️ **I cannot say which case the three observed rows are without reading the catalog, and I
am not asserting it** — but two mechanisms below produce a NULL on a line that *was* overridden, and both are defects.

### ③ 🔴 The deploy-window strip — an override that charges the money and records nothing

`submit.ts:851-857`: on a missing-column error (`42703` / `PGRST204`) the insert **strips all five
`OVERRIDE_KEYS`** — `['is_manual_override','original_price','price_leakage','override_by','override_reason']`
(`:840`) — and retries. **The concession still lands, because it is already baked into `subtotal`
(`x.res.amount`, `:833`). The attribution is gone: no flag, no original price, no leakage, no actor, no reason.**
🔴 **This is precisely what R-7 cannot survive** — the ruling's cost-benefit rests on *"a lost-money report surfaces
a discount of $XX, Lauren investigates"*, and **this path leaves nothing for any report to find.**

### ④ 🔴 The edit path leaves a STALE override

`submit.ts:1249` updates `quantity` and `subtotal` and **never touches the five override columns.** Edit an
overridden line's quantity and `original_price` / `price_leakage` / `override_reason` go on describing a price that
no longer exists — while the D-43 goods breakdown right beside it **is** refreshed (`:1230-1242`, *"breakdown
refreshed (baseline; STD-016)"*). **The service half of the same edit did not get the same treatment.**

---

# Q5 · BLAST RADIUS

## Is there ONE seam where an invoice line is built, or several?

### **ONE live FILE — but TWELVE line-construction sites inside it. The distinction decides each fix's cost.**

**Files matching `DetailType` / `SalesItemLineDetail` across the repo:**

| file | hits | live? |
|---|---|---|
| **`packages/cultivar-os/api/qbo/invoice/cultivar.ts`** | **24** | ✅ **THE ONLY LIVE SEAM.** `api/qbo/invoice/cultivar.ts` is a one-line re-export shim. |
| `packages/shared/src/quickbooks/invoice.ts` | 6 | 🔴 **DEAD.** Its header says *"Extracted from CAI/ExternalBridge.js"*; exported from the shared barrel (`index.ts:12`) but **grep for `pushQBOInvoice`/`toQboInvoice`/`mapQBOInvoice`/`pullInvoices` finds NO cultivar or api caller**; `API_URL` defaults to `localhost:8000`. ⚠️ **It hardcodes `ItemRef: { value: '1', … }` too (`:90`) — the same defect, dormant.** |
| `packages/ignition-os/ExternalBridge.js` | 6 | Ignition — **noted and not touched** (§7). |

**Within `cultivar.ts` the lines are NOT built through one constructor.** There is a helper for the negative line
(`discountLine`, `:313-320`) and **eleven other inline object literals across eight branches** (goods · discount ·
netting-declined · overridden retail · overridden adjustment · $0 transport · normal service · legacy addon ·
legacy netting · legacy install · legacy transport · tax-exempt · tax).

**So, per issue:**

| issue | sites | one-line change or a sweep? |
|---|---|---|
| **Q1** the reason in the description | **1** (`:501`) | **one line** (option A); options B/C reach further by choice, not by structure |
| **Q2** every line books as `Services` | **12 ItemRef literals**, one file | **a sweep within one file** — or one shared helper the twelve call, which is the §6 r8 shape |
| **Q3** tax as a computed line | **1** (`:601-616`) | one site |
| **Q4** override attribution | **3** (`CartReview.tsx:768` · `submit.ts:851-857` · `submit.ts:1249`) | small, but **three different files/branches** |

## ✅ `api/` count — 12/12, and NO option here needs a new function

`find api -name "*.ts"` returns exactly **12**: `campaigns` · `customers/create` · `dashboard` · `discovery/ingest` ·
`members/invite` · `orders/submit` · `pmi/suggest` · `qbo-connector` · `qbo/invoice/cultivar` · `receipts/ocr` ·
`social/enable` · `social/generate-posts`. **Every option costed above is an edit inside an existing file.** Option B
adds one gated migration; **it adds no endpoint.** §6 r11's STOP-and-surface is not triggered by anything here.

---

## Three lenses (§9 gate 10)

- **HAVE** — one live QB seam that gets the hard part right (retail + explicit negative adjustment, plus a
  sum-reconcile guard) while printing an unvalidated free-text reason to the customer, booking every line to a
  hardcoded `'Services'` item despite knowing which table each line came from, computing tax as a line because no QB
  tax field is used anywhere, and losing override attribution on two paths.
- **NEED** (irreducible, no preference) — for Q1: the interpolation at `cultivar.ts:501` is the only thing that has to
  change for the customer to stop reading it; **the receipt at `OrderTotals.tsx:97` is a second, separate site.**
  For Q2: an ItemRef that differs between the goods loop and the service loop — the data is already there.
- **WANT** (labeled as want) — a bounded, owner-sanctioned reason vocabulary following `taxExemption.ts`'s
  code→label shape, QB items that mirror goods-vs-service so COGS can post, and an attribution record that survives
  both an edit and a deploy-window retry — which is what R-7's owed lost-money report would have to read.

⚠️ **STATED DEVIATION (§6 r10 / §9 gate 10 — no silent divergence):** gate 10 asks for options spanning NEED→WANT.
**Q1's four options are costed and deliberately NOT collapsed, as the prompt directs.** Q2–Q5 are reported as
findings without options, also as directed. **Options for Q2–Q4 are owed when David asks for a build.**

## Constraints held

**LOOK ONLY** — zero changes under `packages/`, `api/`, `supabase/` (proven by `git diff --stat` at close).
No code, no schema, no migration, no policy, no cap, no new permission string, no new api function (12/12).
**Nothing was fixed; the QB push was not touched.** No owner-proven mark; **no owner-test cards created for unbuilt
fixes.** No tax-compliance opinion. The negative-adjustment shape is preserved in every option costed.
Ignition noted, not touched. Every claim carries `file:line`; no estimate is given for anything not opened.
