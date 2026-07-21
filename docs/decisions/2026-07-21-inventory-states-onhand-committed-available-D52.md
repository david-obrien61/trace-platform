# D-52 · Inventory has three states: on-hand, committed, available (the industry standard)

**Date:** 2026-07-21 · **Status:** ACCEPTED (David ratified) · **Class:** ARCHITECTURE — supersedes D-42's decrement timing
**Supersedes:** D-42's decrement-at-checkout. **Entangled with / resolves:** R-STATUS (the order lifecycle), the restore-guards, the fulfilled-vs-checkout question.

---

## Decision

Inventory is tracked in the three states every major platform uses (Shopify, Oracle, Microsoft Dynamics, ERPAG, Sellbrite — this is the unanimous industry standard, **adopted, not invented**):

- **On-hand** — units physically on the property. Includes units sold but not yet delivered. This is `business_inventory.qty`.
- **Committed** — units attached to a placed-but-unfulfilled order. Physically present, but spoken for; not sellable to anyone else.
- **Available** — on-hand minus committed (minus any unavailable/damaged). What a new order can actually take.

---

## The lifecycle (unanimous across platforms)

- **Checkout / order placed** → units move available→committed. **On-hand does NOT change** (the plant is still in the yard). This corrects D-42, which decremented on-hand at checkout.
- **Fulfilled (delivered / driven away)** → **on-hand decrements**, committed decrements. The plant physically leaves here, and ONLY here.
- **Cancelled** → committed releases back to available; on-hand never changed, so nothing to restore.
- **Walk-in / self-serve** collapses commit+fulfill into one instant (pay and drive away = committed and fulfilled simultaneously). Delivery holds them apart for days. Same two transitions, different spacing — one model serves both.

---

## What this resolves

- **Oversell:** new orders check AVAILABLE, not on-hand. Two orders can't commit the same unit (first commit drops available). This is why the pre-D-42 'reserved' concept existed; the standard says it was right.
- **The "how long did stock sit" question:** the committed interval (checkout→fulfilled) is a measurable duration.
- **Reconcile:** the ledger's `sale`/on-hand-decrement event is dated at FULFILLMENT (true departure), which is the timestamp reconcile subtracts against.

---

## The 16 existing pending orders (recon R3)

They decremented on-hand at checkout under D-42, before the ledger existed; genesis absorbed those sales. Under D-52 their stock should be on-hand-committed, not gone. Remediation is a one-time reconciliation of those orders at build time (re-derive committed vs on-hand) — **scoped in the build, not this decision.**

---

## Reasoning

Industry standard (cited platforms), **measured against not re-derived**. **STD-011** (on-hand is one number; committed and available derive from it + open orders). **Event sourcing (D-50):** commit and fulfill are both events; on-hand-decrement fires on the fulfill event. **D-9** (available never lies about what's sellable).
