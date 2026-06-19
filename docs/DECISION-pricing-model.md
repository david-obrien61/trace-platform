# DECISION — Pricing Model (Model B: cost-to-serve + payback)
Status: ACCEPTED · Date: 2026-06-19 · Decider: David (owner)
Builds on: D-12 (labor), D-13 (margin store, deferred), D-14 (carve-out), D-15 (cost-object model).

## The model (Model B — chosen over fully-loaded Model A)
Price is set by COST-TO-SERVE, not fully-loaded cost. Founder/platform labor is INVESTMENT recovered on a separate payback line — it is NEVER divided into the per-unit price.

- **Subscription shape** (BuiltWithCAI, Cultivar — what TRACE charges): `price/customer/mo = (cost_to_serve_monthly ÷ N_customers) ÷ (1 − target_margin)`. Founder labor ($11,323/mo floor) = payback line: "at this price and N, platform investment recovers in X months." Not in the unit price.
- **Product shape** (LAWNS — what the nursery charges per item): `price/item = (lot_cost ÷ qty + overhead_share_per_item) ÷ (1 − target_margin)`. Per-item denominator, not per-customer-month.
- **Same MarginEngine, same cost spine; the DENOMINATOR and FEED vary by business shape (AC-1).** Unit of production is config, not engine branching.

## Why Model A (fully-loaded) was rejected
Dividing the whole floor (mostly founder labor) by N makes low-N prices unsellable ($11,323 ÷ 10 ≈ $1,913/customer) and conflates investment with cost-of-goods. This is what made the old $149 guesstimate untrustworthy. Investment is recovered over time across volume, not absorbed per-unit.

## Required distinction (the build dependency)
Computing cost-to-serve requires separating, per cost object: COST-TO-SERVE (marginal/per-tenant — API, infra-per-tenant) vs PLATFORM INVESTMENT (founder labor on the spine, build cost). Confidence/honesty stack unchanged ([[D-9]]); a soft cost-to-serve yields a soft price.

## Deferred (not this pass)
Per-project N and target-margin DIALS; the payback-line computation; the LAWNS per-item feed. Sequenced after the verify-first (2026-06-19) confirms how cost-to-serve is identified.
