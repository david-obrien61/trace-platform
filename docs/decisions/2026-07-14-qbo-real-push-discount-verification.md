# Verification note — QBO real-push discount (STD-017 instance #1) was ALREADY delivered by D-43

**Date:** 2026-07-14
**Type:** Verification / doc reconciliation (NO code change — verify-before-build outcome)
**Relates to:** STD-017 (a fix is complete only when true on every surface — the all-surfaces standard),
STD-012 (server-authoritative pricing, one computation + persistence clause), D-43 (order persists its
own line breakdown), D-39 (goods-only tier discount + show-the-work).
**Ledger:** row #125.

---

## THE PROMPT'S PREMISE (stale)

A build prompt was issued to "make the real QBO push send the discount," describing it as the
all-surfaces validation report's **#1 ranked break** — *"the REAL QBO invoice push
(`api/qbo/invoice/cultivar.ts`) sends net-priced lines with NO discount representation, so the
customer's actual QBO invoice shows no discount even though Review/Confirmation/order-detail/QBO-preview
all show it."*

**That is exactly STD-017's scar instance #1** ("the tier discount showed on Review/Confirmation but NOT
on the real QBO push (customer's actual invoice showed net with no discount line)").

## THE FINDING (STEP 0 verify-before-build)

**The fix already exists in HEAD.** It landed in **D-43 (`5583cb3`, 2026-07-14 09:47)** — before this
session — as part of working through the same all-surfaces sweep. STD-017 memorializes the PRE-fix state
as a scar (past tense); D-43 is the fix for instances #1 (QBO real push) and #2 (edit path). The current
in-progress work (D-45 / `InventoryCount.tsx`) is instances #3/#4 (count → inventory / `variant_group`).
Nobody had mapped "STD-017 instance #1" → "already delivered by D-43," so the ranked break read as still
open.

Per the verify-before-build gate (CLAUDE.md §10 #6 — "if it exists, extend/reuse, do NOT rebuild") and
STD-001 (prove before you act), the committed, correct, proven code was **NOT rebuilt.** David confirmed:
reconcile docs, don't rebuild.

## EVIDENCE — all five surfaces read the ONE stored D-43 breakdown (no recompute; STD-012 persistence clause)

`submit.ts` persists the frozen-at-charge breakdown (`retail_unit` / `discount_pct` / `discount_amt`) on
`order_items` on **CREATE** (submit.ts:511-517, 626-639) **and EDIT** (`handleUpdate`, 976-987 — so
STD-017 instance #2 "edit drops the breakdown" is also fixed). Invariant `retail_total − discount_amt ===
net_total` holds by construction in `computeOrderPricing`. Migration
`20260713_order_items_line_breakdown.sql` is APPLIED + catalog-verified (A–E).

| Surface | Reads the stored breakdown? | Evidence |
|---|---|---|
| Review | live via `computeOrderPricing` (the SAME fn — pre-submit, nothing stored yet) | submit.ts:508 |
| Confirmation | renders the submit response (== persisted output by construction) | — |
| order-detail `/orders/:id` | ✓ "Discount — N% off" grouped block | OrderDetail.tsx:82, 234-241, 319 |
| QBO preview (`DemoQBInvoice`) | ✓ retail lines + explicit −discount line | DemoQBInvoice.tsx:68, 92-112 |
| **real QBO push (`cultivar.ts`)** | ✓ goods at retail + ONE negative-Amount `Discount (N% off)` SalesItemLine | cultivar.ts:175-220 |

The real QBO push:
- reads the stored breakdown via `select('*')`, never recomputes (`qbHasBreakdown` / `qbDiscountTotal` /
  `qbShowDiscount`, cultivar.ts:175-180);
- **gated on a discount actually applying** — a retail (non-discounted) order pushes goods at net EXACTLY
  as before → zero regression; only a discounted order carries the retail-goods + negative-discount
  representation;
- historical/pre-migration rows (null `retail_unit`) → net lines, NO discount line (D-9 omit-not-fake);
- logs `[TRACE:QBO] invoice discount line from stored breakdown { discountTotal, pct }` (cultivar.ts:219).

**Reconciliation invariant on the pushed invoice:** goods-at-retail total − discount line = net total
(then services + tax on top). The QBO invoice total equals what TRACE charged — no double-count.

## QBO DISCOUNT REPRESENTATION (design already decided in D-43)

Industry standard for a QBO discount is a native `DiscountLineDetail`. D-43 deliberately chose a
**negative-Amount `SalesItemLine`** instead, documented in the D-43 doc §"QBO REAL-PUSH REPRESENTATION":
(a) it's consistent with this invoice's own all-`SalesItemLine` convention (including its manual tax
line); (b) the fixed-amount `DiscountLineDetail` form can require a pre-configured discount account;
(c) the real push is an UNTESTABLE surface locally (no live QB sandbox) where a malformed line 400s the
WHOLE invoice — so the safe, already-consistent form was chosen. This decision stands; it is not
re-opened here.

## MINOR NOTE (not a defect, not changed)

The prompt asked for `[TRACE:PRICE]` on the QBO discount payload; the committed code logs `[TRACE:QBO]`
— the correct subsystem tag for a QBO surface, and it does log the discount payload. Left as-is
(changing it would be churn against a proven, sensible choice).

## WHAT ACTUALLY REMAINS (owner-prove — David's, unchanged from D-43 #121)

The real QBO push is untestable locally (no live QB sandbox). OWNER-PROVE owed:
push a real contractor-tier order to a live QBO sandbox → confirm the discount appears as its own line,
the total reconciles to the charged net ($115.20/ea on a $128 Live Oak at contractor 10%), and ⚠️ confirm
QBO accepts the negative-Amount discount line on the REAL push (else fall back to the description-embed
form). This closes STD-017's owner-prove for the pricing capability across all five surfaces:
**Review AND Confirmation AND order-detail AND QBO-preview AND real QBO push.**
