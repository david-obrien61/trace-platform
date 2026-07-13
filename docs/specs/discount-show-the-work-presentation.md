# SPEC — Discount "show the work" presentation (Review + Confirmation)

**Date:** 2026-07-10 · **Status:** ✅ BUILT (2026-07-13, build `__BUILD__` → merge `__MERGE__`) — implements D-39 on
the Review surface + the grouped display on both. Owner-proof owed (David's live 8×-Vitex prove-out).
**Scope:** the checkout Review page + the Confirmation receipt. **Decision:** D-39 (goods-only discount, one shared
computation). **Follows:** the owner-prove of ledger #113 on main (merge `f2f0e4b`) — the money bar FAILED on the
Review surface. **Ledger row #114.**
**Industry-standard basis (CLAUDE.md §6 r16):** server = single pricing authority (client never holds a divergent
computation; interactive surfaces run IDENTICAL resolution against the SAME authoritative inputs); presentation = list
amounts full → discount as its OWN labeled negative line → subtotal → tax on the discounted subtotal → total (standard
invoice/receipt/POS convention, auditable).

> **BUILD NOTE (what shipped):** E1 — the Review no longer relies on the `orderTier` snapshot; it resolves the tier the
> way submit does (`invokedTier ?? customer.price_tier` against the fetched config), and the customer's `price_tier` is
> now carried on the client (`CustomerInput.price_tier`), set by ScanOrder attach OR a business-scoped email lookup in
> CustomerCapture (mirrors submit's dedup). `orderTier` remains a fast-path only while the config loads. E2 — submit now
> RETURNS its authoritative per-line breakdown in the existing response (no new endpoint); Confirmation renders THAT.
> Display is grouped-only per §2A on both surfaces. Section E below is the plan that was executed.

---

## 0. The order this spec uses (David's real owner-prove numbers)

| Line | Qty × Unit | Retail |
|---|---|---|
| Shoal Creek Vitex | 3 × $124.00 | $372.00 |
| Live Oak · 30 gal | 8 × $128.00 | $1,024.00 |
| Delivery (service) | — | $125.00 |

Tier = **Contractor tier 1 · 10% off** · Tax = **8.25%**.

**QBO invoice (correct, source of truth): $1,495.37.**

---

## 1. PHASE 1 — RECON FINDINGS (what's actually happening on the deployed build)

### 1.1 Does Review call `computeOrderPricing`? YES — and that's not the problem.
[CartReview.tsx:136](../../packages/cultivar-os/src/pages/CartReview.tsx#L136) calls `computeOrderPricing([...goodsInputs, ...serviceInputs], resolvedTier, taxRate)`. The tier it feeds is:

```
const resolvedTier = orderTier ?? RETAIL_FLOOR;   // CartReview.tsx:118
```

**Root cause: `orderTier` arrived `null` on the Review path → `resolvedTier` fell back to `RETAIL_FLOOR` (0%) → the discount was genuinely never applied.** The math confirms it: $372 + $1,024 + $125 = **$1,521.00**, tax `8.25% × $1,521.00 = $125.48`, total **$1,646.48** — exactly David's wrong number. Tax was computed on the *undiscounted* $1,521, which is only possible if the discount percent was 0.

### 1.2 Why is `orderTier` null on the Review path?
`orderTier` is a **client snapshot** set in exactly ONE place:

- Written ONLY by `attachCustomer` — [useCart.ts:193–204](../../packages/cultivar-os/src/hooks/useCart.ts#L193-L204) (`orderTier: resolvedTier ?? null`).
- `attachCustomer` is called ONLY from ScanOrder's attach strip — `attachExisting` [ScanOrder.tsx:167](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L167) and `useNewCustomerForOrder` [ScanOrder.tsx:192](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L192).
- The checkout customer step **does not set it**: `CustomerCapture` sets the customer via `setCustomer(c)` [CustomerCapture.tsx:137](../../packages/cultivar-os/src/pages/CustomerCapture.tsx#L137) → [useCart.ts:191](../../packages/cultivar-os/src/hooks/useCart.ts#L191), which writes `customer` only — never `orderTier`.
- `setItem` (the profile "Add to cart" path) **clears** it: `orderTier: null` [useCart.ts:93](../../packages/cultivar-os/src/hooks/useCart.ts#L93).
- ScanOrder loads the discount config **asynchronously** [ScanOrder.tsx:129–135](../../packages/cultivar-os/src/pages/ScanOrder.tsx#L129-L135); `discountTypes` starts `[]`.

So `orderTier` is null (or a 0% retail floor) whenever **any** of these is true:
1. the customer was provided/confirmed at **CustomerCapture** rather than ScanOrder's attach strip (attach is optional — you can scan, then enter the customer later);
2. an item was added via a profile `setItem` after the attach (it wipes the tier);
3. the customer was attached **before** ScanOrder's async config fetch resolved → `resolveTier(price_tier, [])` → retail floor (0%) + a "Retail — no discount" badge.

Any of these produces a Review with no discount, while `submit.ts` still discounts (see 1.3). This is the fragility: **the tier the Review shows depends on how/where the customer was attached, not on the authoritative source.**

### 1.3 Is `submit.ts` / QBO unchanged and correct? YES — $1,495.37.
`submit.ts` does NOT trust the client `orderTier`. It re-resolves the tier SERVER-SIDE from `customerId → customers.price_tier → business discount config` and applies it per goods line ([submit.ts:187–210](../../packages/cultivar-os/api/orders/submit.ts#L187-L210), via `computeOrderPricing`). Because the customer's stored tier IS "Contractor tier 1", submit discounts correctly regardless of the client snapshot → `order_items.unit_price` net → QBO `$1,495.37`. Confirmed unchanged.

### 1.4 What does the Confirmation receipt render today? Correct total, invisible discount.
- **Totals** come from `submit`'s authoritative response passed in nav state (`subtotal $1,381.40`, `tax $113.97`, `total $1,495.37`) → correct.
- **Per-line breakdown** comes from Review's CLIENT computation (`goodsBreakdown`, passed via nav state from CartReview). Because Review computed with the retail floor, each goods line's `netTotal` == retail and `discountAmt == 0` → the receipt shows **$372.00 and $1,024.00 (retail)** with **no discount line** (the discount-line only renders when `discountAmt > 0`), then jumps to the discounted `$1,381.40` subtotal. Result: shown lines sum to $1,521 but the subtotal is $1,381.40 — a **$139.60 gap with nothing explaining it.**

### 1.5 VERDICT — plainly
- **Review = a COMPUTATION miss.** The discount was genuinely not applied (tax on $1,521 proves it). Root cause: `orderTier` null → `RETAIL_FLOOR`.
- **Confirmation = a DISPLAY miss.** The total is right (submit-authoritative), but the discount is baked silently into the subtotal because the per-line breakdown was sourced from Review's (wrong) client computation, and there is no explicit discount line.

Both trace to the same root: **the tier does not reliably resolve on the client Review surface.** D-39's "one shared computeOrderPricing" IS in place on both surfaces — but Review feeds it a 0% tier, so the shared function faithfully returns an undiscounted result.

---

## 2. PHASE 2 — THE TARGET PRESENTATION

### A. The layout David specified (filled in with this order's real math)

```
PLANTS
  Shoal Creek Vitex        3 × $124.00          $372.00
  Live Oak · 30 gal        8 × $128.00        $1,024.00
  Goods subtotal (retail)                     $1,396.00
  Contractor tier 1 — 10% off                   −$139.60
  Goods after discount                         $1,256.40

SERVICES  (not discounted)
  Delivery                                       $125.00
  [Placement Service, if present, at full rate on its own line]

  Subtotal (after discount)                    $1,381.40
  Tax (8.25%)                                    $113.97
  Total                                        $1,495.37
```

**Every intermediate number, so David can eyeball the chain:**
- Goods retail: `$372.00 + $1,024.00 = $1,396.00`
- Discount: `10% × $1,396.00 = $139.60`
- Goods after discount: `$1,396.00 − $139.60 = $1,256.40`
- Services (full, never discounted): `$125.00`
- Subtotal after discount: `$1,256.40 + $125.00 = $1,381.40`
- Tax: `8.25% × $1,381.40 = $113.97`
- **Total: `$1,381.40 + $113.97 = $1,495.37` — matches QBO exactly.**

The discount is its OWN line on the goods subtotal (not per-line, and not hidden inside the subtotal). Services sit in their own group at full price. Tax is on the discounted subtotal.

### B. Same layout on BOTH surfaces
- **Review page** (`/checkout/review`, pre-submit): the layout above, PLUS the existing per-service "Adjust price" owner/manager controls (leave those exactly as they are — an owner override is leakage, shown on its own service row, orthogonal to the tier discount). Editable qty steppers stay. The goods "show the work" per-line sub-note (`Retail $X × qty · 10% off −$Y · Net $Z`) may remain in addition to the grouped discount line, or be folded into the grouped block — David's call on density (see §5, open question).
- **Confirmation receipt** (`/checkout/confirm`, post-submit, read-only): the identical layout, no editing controls. This is the customer/owner record; numbers must equal QBO.

Per-surface difference: **Review is interactive** (adjust qty/price) and previews; **Confirmation is read-only** and reflects the order actually written.

### C. The rule being shown (D-39)
The customer tier discount applies to **GOODS/inventory lines ONLY**. It is presented as ONE discount line on the goods subtotal. **Service/labor lines** (Delivery, Placement Service, netting, add-ons) are **NEVER discounted** — shown at full price in their own group. **Tax is computed on the discounted subtotal.** (AC-1: "goods" vs "service" are generic line kinds — no vertical noun in the shared logic.)

### D. What changes vs today

| | Today (deployed) | Target |
|---|---|---|
| **Review** | Discount NOT applied at all → total $1,646.48 (tax on $1,521) | Discount applied; explicit `−$139.60` line; total $1,495.37 |
| **Confirmation** | Correct total ($1,495.37) but retail lines ($372/$1,024) + a $1,381.40 subtotal with **no discount line** (the $139.60 is invisible) | Retail lines + an explicit `−$139.60` discount line → goods-after → services → discounted subtotal → tax → total |
| **Both** | Discount either missing (Review) or hidden (Confirmation) | Discount is an explicit, visible line on both |

---

## E. THE FIX PLAN (described only — do NOT build in this task)

Two parts, matching the two misses. **No migration. No new api function (12/12 held). Stays within `tierPricing.ts` (already has `computeOrderPricing`) + the Review/Confirmation components + a small cart/customer field.** The current owner-override / leakage machinery and the server-authoritative money path are untouched.

**E1 — Computation fix (Review): resolve the tier the way submit does, not from the fragile `orderTier` snapshot.**
The Review surface must derive the effective tier from the SAME authoritative inputs `submit.ts` uses — `invokedTier ?? the customer's stored price_tier`, resolved against the business's discount config (`readPricingConfig` + `resolveTier`) — instead of depending on `orderTier` having been set in ScanOrder. Concretely (what/where):
- Carry the customer's `price_tier` on the client so Review can see it regardless of how the customer was attached. Today the cart `customer` object (`CustomerInput`) does not include `price_tier`; the attached-customer paths (ScanOrder `attachExisting`, and any CustomerCapture lookup) know it. Add it to what the cart carries (a field alongside `customer`, or extend the attached representation).
- In CartReview, compute `resolvedTier` from `invokedTier ?? customer.price_tier` against the fetched config (mirroring submit), rather than `orderTier ?? RETAIL_FLOOR`. `orderTier` can remain as a fast-path/override but must not be the sole source.
- This eliminates all three null-triggers from §1.2 at once (attach-path dependence, `setItem` wipe, config race), because the tier is resolved from the customer + config at render time — the same way the server does.
- *(Belt-and-suspenders alternative if David prefers minimal surface: also set `orderTier` in the CustomerCapture path and guard ScanOrder's config race. But E1's "resolve at Review from the authoritative inputs" is the single-source fix and is preferred — it makes Review structurally unable to diverge from submit.)*

**E2 — Display fix (both surfaces): render the explicit discount line, and make Confirmation authoritative.**
- **Review:** once E1 makes the tier resolve, the grouped layout of §2A renders: goods retail subtotal → `−$discount` line → goods-after → services group → discounted subtotal → tax → total. (CartReview already has a discount line in its totals block from D-39, but it only appears when `discountTotal > 0`; E1 lights it up. Add the "Goods subtotal (retail)" and "Goods after discount" rows + the SERVICES group heading to match §2A exactly.)
- **Confirmation:** stop sourcing the per-line breakdown from Review's client `goodsBreakdown`. Instead, have `submit.ts` RETURN its own authoritative per-line breakdown (it already computes `pricing.lines` internally via `computeOrderPricing`; today `res.json` at [submit.ts:636](../../packages/cultivar-os/api/orders/submit.ts#L636) returns only totals — add the lines to the existing response, **no new endpoint**). Confirmation renders THAT. This guarantees the receipt shows the correct discount line even if a future client state is wrong — the receipt reflects what was actually charged, not a client preview.

**Seam note (stale client base): SEPARATE, not implicated here.** The known "client sell_price vs server sell_price" seam is about the *value* of a goods unit price (the $124-vs-$128 class from #113). THIS bug is that the *tier* fails to resolve on the Review client at all — an independent axis. E1/E2 do not touch the sell_price seam; submit remains authoritative for the charged base. Worth fixing the tier resolution first; the value seam stays a separate, pre-existing item.

**Constraints held by the plan:** AC-1 (generic goods/service), AC-3 (business-scoped), AC-4 (one computation, every surface — E1 makes Review truly share submit's resolution). ZERO migration, ZERO new api fn (12/12). `[TRACE:PRICE]` stays ON (it already logs the resolved tier on both the Review path and submit — post-fix it will show the real percent instead of 0).

---

## STOP

This is the presentation + root-cause spec only. **No source files were changed.** David reviews the layout in §2A and the fix plan in §E, confirms it's how he wants it, then we build in the next prompt.
