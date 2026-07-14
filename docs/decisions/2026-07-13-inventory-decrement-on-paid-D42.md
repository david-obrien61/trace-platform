# D-42 — Inventory decrement-on-paid (the Amazon model)

**Date:** 2026-07-13
**Status:** PROPOSED (BUILDER-COMPLETE app-code; migration gated; owner-proof owed)
**Supersedes:** the coarse whole-lot status-flip-to-`reserved` reservation model (never a real decrement).
**Standards:** STD-011 (qty = the ONE canonical on-hand fact; status derives), STD-012 (server-authoritative, one computation), AC-3 (business_id-scoped). Builds on D-34 (the LOT is the SKU; qty is the COUNT).

---

## The decision

Inventory `qty` is **decremented per-unit at ORDER-PAID / CONFIRMED** — the checkout-complete + invoice-generated commitment point (today's `submit.ts` §11) — **NOT at delivery**. Delivery is a separate, later event that does **not** touch `qty` (the stock was committed at payment). This mirrors the Amazon standard: **pay → inventory committed/decremented → ships → arrives.**

- **Per-unit, atomic:** `qty = qty − n` via a single guarded Postgres RPC (`adjust_inventory_qty`), **never** a JS read-modify-write (which races two concurrent orders on the same lot and loses a unit). The RPC's `qty + delta >= 0` predicate is the oversell guard — a decrement can never drive `qty` negative.
- **Status derives from qty (STD-011):** `qty > 0 → 'available'`, `qty <= 0 → 'depleted'` (the existing datasheet vocabulary — not a new `sold_out` synonym). A manual `'damaged'`/`'returned'` classification is preserved. This **replaces** the old whole-lot flip to `'reserved'`, which — under D-34 — wrongly marked all 45 of a 45-lot reserved when 1 sold and then made the lot vanish from the status-filtered dashboard count (that vanishing is what *looked* like depletion).
- **The whole order lifecycle stays coherent (one RPC, signed delta):** create decrements (`−n`); **edit** adjusts by `(oldQty − newQty)` per lot (reduce/remove restores, increase decrements further); **delete** and **cancel** restore (`+n`), guarded against double-restore (a cancelled order already returned its stock). Un-cancel does not auto-re-decrement (R-STATUS preserved) — edit to re-commit.
- **Oversell is surfaced, never silent (D-9 / Surface Honesty):** a pre-flight check refuses the whole order with `INSUFFICIENT_STOCK` before any write when a line exceeds on-hand; the §11 atomic RPC is the authoritative guard for the rare concurrent-depletion race (logs `oversell_refused`, never a negative qty).

## Why this is the foundation

Reconciliation (Lauren's pain: **counted vs expected = last count − sold**, split into sold / dead / missing) **requires real per-unit depletion**. It was gated on a decrement that never existed. D-42 unblocks it: `sold` is now truthfully recorded as qty movement at the paid point.

## Reorder stub

`business_inventory.reorder_point int` (nullable, additive) is added as the SLOT for the future low-stock / reorder-threshold build — **no threshold logic this pass**. Homed now so the decrement build and the reorder build share the schema. The **reorder-threshold capability is the next build** on this stub (needs D-42's decrement + this column).

## Scope / migration

- ONE additive gated migration `20260713_inventory_decrement_and_reorder.sql`: the `reorder_point` column + the `adjust_inventory_qty` RPC (a Postgres FUNCTION — does **not** count against the 12/12 Vercel `api/` ceiling). David applies as postgres. Deploy code first (degrades gracefully — decrement deferred — when the RPC is absent), then apply.
- ZERO new Vercel api-fn (rides `submit.ts`; 12/12 held). `[TRACE:INVENTORY]` ON.

## Flagged / follow-up

- **Reconciliation (counted vs expected)** is now UNBLOCKED — the next capability that reads this depletion.
- **Reorder-threshold** build on the `reorder_point` stub.
- Un-cancel does not auto-re-decrement (matches the prior R-STATUS note) — deliberate.
