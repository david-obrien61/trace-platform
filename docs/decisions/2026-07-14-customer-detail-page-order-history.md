# D-44 (proposed) — Customer detail page (`/customers/:id`) with live-computed order history

**Date:** 2026-07-14
**Status:** proposed (confirm the DECISIONS.md/INDEX head then assign)
**Ledger:** CLOSE-OUT-LEDGER row #122
**Type:** App code — 1 new page + 1 route + 1 roster row-nav repoint. NO migration, NO new api-fn (12/12).

## Decision

There is now a dedicated **customer detail PAGE** at `/customers/:id` — a summary header, four
live-computed stat cards, an order-history list, and a stubbed insights strip. It answers David's
question ("where do I view all of john smith's orders?"), which had no home: `/customers` was a
roster + an edit modal only, with no per-customer drill-in.

- **A page, not a modal tab.** Clicking a customer NAME on the roster navigates to `/customers/:id`.
  The roster's Edit button + tax badge still open the `CustomerPartyEditor` modal (a roster
  quick-edit); tier/status inline selects are unchanged.
- **Order rows LINK to the existing `/orders/:id`.** The history is a list of links, not inline
  expansion — one order-detail surface, reused.
- **Editing goes through the EXISTING `CustomerPartyEditor` (STD-011).** The detail page's "Edit
  record" button opens that editor in edit mode; the page does NOT re-implement the edit form. One
  canonical customer-edit surface.

## Stats — computed live, not stored (David's call)

The four cards are computed from this customer's own orders (one light, indexed
`orders WHERE customer_id = :id AND business_id = <active>` query, most-recent-first) — **no stored
`lifetime_value` is read or maintained**:

| Card | Rule |
|---|---|
| **Orders** | count of ALL orders (activity — includes cancelled) |
| **Lifetime value** | Σ `total_amount` **EXCLUDING** cancelled (cancelled = no revenue) |
| **Avg order** | lifetime value ÷ count of **non-cancelled** orders |
| **Last order** | max(`created_at`) across all orders |

A cancelled order appears in the history list but is excluded from lifetime value + avg.

## Why buildable with zero schema

Recon (2026-07-13 customer-order-history) confirmed `orders.customer_id` is populated
(`submit.ts:566` writes it) and the Orders roster already joins orders→customers. This page reuses
that query shape + the roster's row idiom. `orders` is owner-only-SELECT RLS, `customers` is
owner-only FOR ALL — the route sits in the owner-only `PermissionRoute` group beside `/customers`, so
nav AND route AND RLS agree (AC-3). `select('*')` on the single customer read is deploy-window-safe
across the gated party/exemption columns.

## Insights strip = the AI-advisory hook

The bottom strip is a **labeled stub** ("Insights — coming · spend trend, reorder cadence, margin") —
no logic, no fabricated numbers (D-9 omit-not-fake). It marks where the future spend→insight AI
advisory (the AIEngine port, post-demo) will render, on the same customer surface that already carries
the toggle-gated advisory placeholder on the roster.

## Constraints held

- **STD-011** — one canonical customer-edit surface (`CustomerPartyEditor`); the detail page links to
  it, never duplicates it.
- **AC-3** — every read `business_id`-scoped, owner-only RLS inherited.
- **BENCH-C (PII)** — same handling the roster/editor already do; `[TRACE]` logs ids/counts only,
  never PII; the URL carries a UUID (not PII).
- No migration (`orders.customer_id` + all fields exist); no new api-fn (12/12 — client reads reuse
  the Orders.tsx pattern).

## Owner-prove (David, live)

1. Click john smith's row on `/customers` → his detail page shows his order history, most-recent-first,
   each row clickable to `/orders/:id`.
2. Stat cards: Orders count, Lifetime value (excludes cancelled), Avg order, Last order — sane vs the
   visible orders.
3. A cancelled order shows in the list but is NOT in the lifetime-value sum.
4. "Edit record" opens the existing `CustomerPartyEditor`, not a new form.
5. A customer with no orders → clean empty state, sane zeros, no crash.
