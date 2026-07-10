# Decision D-39 — Discount line scope (goods-only) + one shared order pricing

**Date:** 2026-07-10 · **Type:** decision + build · **Closes:** MUST-FIX #1 (Review-vs-QBO divergence) + #2 (labor-exemption + show-the-work) from SESSION-HANDOVER-2026-07-10-1615L.
**Relates:** [2026-07-09-tier-pricing-mechanism.md](2026-07-09-tier-pricing-mechanism.md) (the tier math this scopes) · D-35 (sell_price is the baseline) · D-37 (money boundary) · D-38 (flat owner-managed tiers).

## The decision

1. **The customer tier discount applies to GOODS / INVENTORY lines ONLY.** SERVICE / LABOR lines
   (Placement Service, Delivery, netting, add-ons) are **NEVER** discounted — they are charged at full
   price. An owner price-override on a service is attributed **leakage** (surfaced separately), not a
   tier discount.
2. **Tax is computed on the DISCOUNTED subtotal** (goods-after-discount + services-at-full), not on the
   retail subtotal.
3. **Review, submit/QBO, and Confirmation all render IDENTICAL numbers from ONE computation.** The Review
   preview no longer runs its own pricing math — it, the server-authoritative `submit.ts`, and the
   Confirmation receipt all call the single shared `computeOrderPricing` (packages/shared/src/business-logic/tierPricing.ts).
4. **The discount is shown as work.** Each goods line renders `Retail $X × qty = $retailTotal · <tier>
   N% off −$discount · Net $net`; each service line is marked `no discount`; the totals show retail →
   discount → discounted subtotal → tax → total. The owner can SEE the discount come off plants and NOT
   off labor. (This is the demo pitch — surface the truth; an unshown, self-contradicting discount is a
   demo risk.)

## Why (the bug this closes)

On a contractor-tier order (8× Vitex retail $128, tier 10%), the Review page showed $124/each →
$3539.78 while QBO/Confirmation showed the correct $115.20/each ($128 × 0.9) → $3418.54. Root cause:
`CartReview` computed its own subtotal from the raw `sell_price` with the tier **never applied to goods**,
and taxed the un-discounted subtotal — a computation that diverged from the authoritative `submit.ts`
(which applied the tier per goods line). Two computations → two numbers. The fix removes the second
computation: one `computeOrderPricing` for every surface, so they cannot disagree.

The labor exemption was already the *behaviour* of `submit.ts` (services never went through
`applyTierPrice`) but it was **implicit/accidental**. D-39 makes it an explicit, documented, and visible rule.

## The mechanism (single source of truth)

`computeOrderPricing(lines, resolvedTier, taxRate)` — pure, no DB, no config resolution inside. Goods
lines are priced by the existing `applyTierPrice` (the SOLE basis-branch arithmetic — reused, not
forked); service lines pass through; tax on the discounted subtotal. Rounding mirrors the prior submit
path exactly, so the authoritative order_items / QBO numbers are byte-identical to before.

- **submit.ts** resolves the tier SERVER-SIDE (`resolveTier` over `normalizeDiscountTypes(config)`) for
  tamper defense (client supplies neither tier nor config) and passes the resolved tier in. Unchanged.
- **CartReview** carries the tier RESOLVED ONCE at attach (`ScanOrder` already loads the discount
  config to build the tier badge) via a new cart field `orderTier: DiscountTier | null`, and feeds it
  to the same `computeOrderPricing`. Display-only; submit re-resolves authoritatively. Because both call
  the one function over the same inputs, Review === submit === QBO.
- **Confirmation** renders the per-line breakdown passed through nav state; totals stay the
  authoritative submit values (which equal the breakdown).

## Constraints held

AC-1 (line kinds are generic `'goods' | 'service'` — no vertical noun in shared logic) · AC-3
(business_id-scoped reads/writes, unchanged) · **AC-4 (this IS the settle-once — one computation, every
surface)** · NO migration · NO new `api/` file (12/12 held; refactor within submit.ts + shared +
Review/Confirmation) · server-authoritative + tamper-defended (unchanged) · `[TRACE:PRICE]` ON on both
the Review render path and submit.

## Out of scope (carried, not this decision)

`submit.ts handleUpdate` (roster order EDIT) recomputes the baseline only and is NOT tier/basis-aware —
inherited fast-follow from #107, unchanged here.

## Durability

Holds until a build bounces against it; readdress then rather than working around it (audit-wins rule).
