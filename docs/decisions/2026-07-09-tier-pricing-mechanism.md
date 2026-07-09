# Decision — customer price-tier → discount (D-35 addendum, AC-4 hold CLOSED)

**Date:** 2026-07-09 · **Type:** decision + build · **Closes:** the Item-1 (D-35) AC-4 hold — "price_tier read but not applied; tier math undefined."
**Story:** contractor/tier-pricing umbrella (`user_stories.md`) · flow spec `docs/user-stories/cultivar-flows-and-contractor-program-2026-06-03.md` §3/§4 · recon `docs/decisions/2026-07-08-as-built-contractor-pricing.md`.

## The decision (the tier math, previously undefined)

**tier → discount = PERCENT-OFF-BASELINE, owner-set per tier, default 0%.** The baseline is the stored,
server-authoritative `business_inventory.sell_price` (D-35 — the charge is the stored retail price, NEVER
re-derived from cost). A customer tagged a tier gets that tier's `discountPercent` taken off each line's
sell_price at checkout. `retail` = 0% (default / full price); `contractor` / `wholesale` = owner-set.

This is DELIBERATELY separate from `MarginEngine.calculateRetail`, which derives a price FROM vendor cost via
markup slabs — the cultivar order path never touches cost. The reusable piece is the tier arithmetic (lookup +
`×(1−d/100)`), extracted to `packages/shared/src/business-logic/tierPricing.ts` (`applyTierDiscount`), which
`PricingTier`-shares with MarginEngine (one shape, one taxonomy home — AC-1: tier names are jsonb DATA).

## Where the % lives / who applies it

- **Config (no migration):** `business_pricing_config.config.pricingTiers[]` — additive jsonb key alongside the
  cost-to-produce recipe; read/written via the existing `read/writePricingConfig` accessor. Owner sets each
  tier's % in Settings → Cost-to-Produce → **Block 5 · Customer pricing tiers** (FIX 5 validation: 0–100,
  block+message, never silent). Seed = `retail`(default,0%) + `contractor`(0%) + `wholesale`(0%) — the known
  value-set so the config UI + the customer tier picker present the full set on day one; "default 0%" holds for
  all (the owner sets contractor to 10% themselves — the flow-spec §3 Tier-1 value, now owner-set not hardcoded).
- **Assignment:** the `/customers` roster Tier column is now an inline `SelectCell` (was display-only) writing
  `customers.price_tier`; the Add-Customer form gained a tier picker (was omitted → silently defaulted retail).
- **Mechanism (server-side, tamper-defended):** `api/orders/submit.ts` reads the customer's `price_tier` AND the
  business's `pricingTiers` SERVER-SIDE (never from the client) and applies `applyTierDiscount(sell_price, tier,
  tiers)` per line. A no-op for retail/default/unknown/0% (unitPrice === sell_price) → non-tiered orders unchanged.
  The discount flows through order_items.unit_price/subtotal → tax → total (money-safe end to end). `[TRACE:PRICE]`
  logs the tier + discount% + base/net price.

## Out of scope (storied, not built)

- Layer 3 — the contractor **program** (register → verify → approve → notify): all net-new, not demo-critical (flow spec §3/§4).
- Pre-submit per-line discounted DISPLAY (customer is unknown until CustomerCapture → server-side-at-submit is the mechanism; the confirmation/receipt reflect the discounted stored total, which is honest).
- The AI/BI "is this contractor discount still leaving margin?" advisory — the documented slot per `docs/concepts/margin-aware-pricing-intelligence.md`, NOT built here (the tier discount is only the arithmetic floor).
- `submit.ts` `handleUpdate` (roster order EDIT) recomputes baseline sell_price only and was never tier-aware — left as-is (a separate follow-up if edited orders should re-apply the tier).

## Constraints held

AC-1 (tier names are generic jsonb data, no vertical noun) · AC-3 (business_id-scoped reads/writes) · AC-4 (this
CLOSES the hold; tier math now defined) · no migration · no new `api/` file (12/12) · override honored only
server-side (public checkout stays server-authoritative + tamper-defended) · FIX 5 validation on the % inputs ·
`[TRACE:PRICE]`/`[TRACE:customers]` ON.
