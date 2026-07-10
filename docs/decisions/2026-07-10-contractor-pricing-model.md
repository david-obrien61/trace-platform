# Decision D-38 — Contractor Pricing Model (flat, owner-managed; no progression engine)

**Date:** 2026-07-10 · **Type:** decision · **Rules out:** the earned/cumulative progression-ladder hypothesis.
**Relates:** D-35 (tier math = percent-off-baseline), D-37 (money boundary), party-model recon R4/story #8.

## The decision

Contractor pricing is FLAT, OWNER-SET tiers with MANUAL promote/demote. No auto-progression, no decay,
no cumulative-spend engine. The OWNER decides whether a person gets a discount and how much — the system
never assigns, promotes, or removes a discount on its own. Access terms (fees, if any) are owner-set
DESCRIPTIVE config per tier (ref D-37) — not a platform transaction.

## What this rules OUT (explicitly, so it never re-opens)

The register→$4.99→tier_1→earn tier_2/3-by-cumulative-spend loyalty-status engine (recon R4, story #8) is
NOT built and NOT planned. Every "earned / automatic / cumulative / decaying" element is decided-out, not
deferred. The role edge does not need cumulative_spend aggregation, promotion triggers, or decay jobs.

## AI_BI (advisory only, toggleable — surface, don't decide)

The platform MAY surface an optional, owner-toggleable suggestion — e.g. "this contractor has spent $10K;
a discount tier might fit" — sourced from orders summed per person. It is a SUGGESTION the owner acts on or
ignores; it NEVER auto-applies, auto-promotes, or changes a price. This is SURFACE THE BETWEEN + owner-
authority (D-9), the deliberate opposite of the ruled-out auto-promotion engine: inference that suggests,
never logic that acts. It lives on the customer-context surface (same surface as manager lookup).

## Constraints held

AC-1 (generic — no vertical noun) · AC-4 (tier value-set is owner-managed data, grows without schema) ·
no schema/migration (tiers ride business_pricing_config.config.pricingTiers jsonp) · no auto-logic anywhere.

## Durability

Holds until a build bounces against it; readdress then rather than working around it (audit-wins rule).
