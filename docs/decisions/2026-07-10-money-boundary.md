# Decision D-37 — Money Boundary (order origination + access grant IN, payment execution OUT)

**Date:** 2026-07-10 · **Type:** decision (promotes standing Jul-3 doctrine to a canonical D-##)
**Why now:** the party-model / contractor arc surfaced a would-be new money flow (a contractor
access fee, e.g. $4.99). Authoring the boundary defines precisely where the platform stops so any
future drift across it is a catchable violation.

## The decision

Cultivar computes charges on orders it originates and grants role-based access (including
discounted contractor ordering); it never processes, collects, or reconciles payment for either
— the business collects on the rail it already has. Access terms (fees, if any) are owner-set
descriptive config, not a platform transaction.

## What this means (two money axes, one line)

1. **Order charge** — for orders Cultivar ORIGINATES, computing the charge is in scope
   (sell_price × qty, tier discount via applyTierDiscount, tax, total). Collecting/reconciling
   that charge is NOT — that is the business's own rail (QBO, cash, etc.). Ingested invoices are
   read-only for scheduling (Cultivar does not create/modify/reconcile them).
2. **Platform SaaS** — business→TRACE billing is TRACE's own rail. Unrelated to the above.

The contractor access fee (any amount $0..$N, flat or per-tier) is NOT a third axis. It is
something the BUSINESS charges its own customer and collects on its OWN rail — it sits entirely
on the business's side of axis 1. The platform's job is to GRANT the capability (a restricted,
role-scoped ability to order at a discount), never to charge for it.

## Founding-principle grounding

"Connect what they already have; don't add a rail." A business already processes payment (LAWNS
runs cards through QBO). Bolting a TRACE-facilitated payment mechanism onto their business is the
replace-don't-connect anti-pattern this decision forbids. We hold the entitlement; we do not
process the payment behind it (same posture as customers.price_tier today).

## Access terms = descriptive config, not a transaction

The contractor role may carry an OPTIONAL owner-set "access terms" note (descriptive only — e.g.
"10% tier = $4.99/mo via QBO", or blank for a free/$0 contractor). The platform STORES and
SURFACES this label; it never charges it. AC-4: settle the capability, let the value vary.

## Scope

- IN: charge computation on originated orders; role-based access grant (incl. contractor ordering).
- OUT: payment processing, collection, reconciliation — for both order charges and access fees.
- OUT (unbuilt, not claimed): the contractor progression engine and any fee-collection code.

## Standing / durability

Holds until a build bounces against it; if it does, readdress the decision to see if it still
holds rather than silently working around it (audit-wins rule).

## Constraints held

AC-1 (decision text is vertical-noun-free) · AC-3 (business-scoped by construction) ·
no schema/migration/code/api (docs-only).
