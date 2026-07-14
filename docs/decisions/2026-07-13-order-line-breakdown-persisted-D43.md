# D-43 (proposed) — AN ORDER PERSISTS ITS OWN LINE BREAKDOWN (frozen-at-charge show-the-work)

**Date:** 2026-07-13
**Status:** PROPOSED (confirm the DECISIONS.md head, then graduate D-43) · migration APPLIED + catalog-verified (A–E green, invariant holds) 2026-07-13 · owner-proof (live UI) owed
**Type:** Architecture / data model + pricing-display doctrine
**Strengthens:** STD-012 (server-authoritative pricing, one computation) → adds the PERSISTENCE CLAUSE.
**Relates to:** D-35 (stored sell_price), D-39 (goods-only tier discount + show-the-work), STD-016 (order edits recompute through the canonical path), D-9 (omit-not-fake).
**Ledger:** row #121. **Migration:** `20260713_order_items_line_breakdown.sql` (additive; APPLIED + catalog-verified A–E, 2026-07-13).

---

## THE PROBLEM (recurring)

The tier discount is CHARGED correctly ($115.20 on a $128 Live Oak at contractor 10%), but the
show-the-work discount LINE rendered only on **Review** and **Confirmation** — NOT on the
order-detail page (`/orders/:id`) or the QuickBooks invoice. Those surfaces showed the net price
with no visible "Contractor 10% off −$X" line.

**Root cause (recon, ledger #120 follow-up):** `submit.ts` COMPUTES the full per-line breakdown via
`computeOrderPricing` (retail/discount/net per line) and then **DISCARDS it**, persisting only the
net `unit_price`/`subtotal` on `order_items` ([submit.ts:615-616]). Every downstream surface had
nothing to read, so it could not show the discount. This gap resurfaced repeatedly.

The cheap fix — "have each surface recompute from the same function" — is the WRONG conclusion: it
fragments the one computation into N recompute sites that drift (and a surface that computes nothing,
like the QBO push, still shows nothing).

## THE DECISION (the durable fix, and the industry standard)

**An order PERSISTS its own line breakdown at submit; every surface RENDERS the stored breakdown. No
surface recomputes.** An invoice stores its own lines — you don't recompute an invoice every time you
view it. This is **STD-012 taken to its correct conclusion**: the computation runs ONCE at submit, is
PERSISTED on the order, and every downstream surface renders the stored fact.

**Frozen-at-charge:** a later tier or price change cannot make a displayed discount disagree with the
total, because surfaces read HISTORY, not a live recompute.

## WHAT SHIPPED

**Migration (`20260713_order_items_line_breakdown.sql`, gated, additive, zero destruction):** three
nullable columns on `order_items` alongside the existing net `unit_price`/`subtotal`:
- `retail_unit numeric(10,2)` — pre-discount unit price (the stored sell_price at time of order).
- `discount_pct numeric(5,2)` — the tier % applied to this line (0 for none / service lines).
- `discount_amt numeric(10,2)` — per-line discount = `round2(retail_total − net_total)` (0 = none).
Inherits `order_items` RLS (no new policy). Existing rows get NULL → surfaces render net only.

**Submit WRITES the breakdown (create AND edit):**
- **Create** — the breakdown `computeOrderPricing` already produces per goods line is written to
  `order_items` alongside net. Deploy-window-safe (strip-and-retry on a missing-column error).
- **Edit (`handleUpdate`, STD-016)** — re-persists each kept line's breakdown too, or an edited
  tiered order would keep its stale create-time retail/discount while the net moved, VIOLATING the
  invariant. `handleUpdate` charges baseline (RETAIL_FLOOR — the carried #107/#114 "edit drops the
  tier" gap), so the refreshed breakdown is retail=net, discount 0 → order-detail shows net only,
  HONEST to what the edit re-charged.

**INVARIANT (enforced at write, verifiable in SQL):** `retail_total − discount_amt === net_total`
per line. `discountAmt = round2(retailTotal − netTotal)` by construction, so it holds exactly.

**Every surface RENDERS the stored breakdown (no recompute downstream):**
- **OrderDetail.tsx** — goods at retail + a grouped discount block (goods subtotal → discount line →
  goods after), mirroring the Confirmation receipt. NO `computeOrderPricing` call on this surface.
- **DemoQBInvoice.tsx (preview)** — goods at retail + an explicit negative discount line.
- **api/qbo/invoice/cultivar.ts (real push)** — goods at retail + one explicit discount line
  (a negative-Amount SalesItemLine, consistent with this invoice's own all-SalesItemLine convention
  incl. its manual tax line), so the 10% shows on the invoice. GATED on a discount actually applying
  → a non-discounted (retail) order pushes byte-identical to before (zero regression).
- **Confirmation.tsx / CartReview.tsx** — unchanged. Confirmation renders the submit-response
  breakdown, which is the SAME `computeOrderPricing` output that was persisted (identical numbers by
  construction). CartReview is pre-submit (nothing stored yet) → keeps its live compute, calling the
  same function (correct per STD-012).

**Graceful for historical rows (null breakdown):** if `retail_unit` is null (pre-migration orders),
surfaces render net only, no discount line — never a fabricated partial breakdown (D-9 omit-not-fake).

## LABEL NOTE (deliberate, within spec)

The discount LABEL on order-detail/QBO is `Discount (N% off)`, derived from the stored `discount_pct`
(the frozen fact). Confirmation additionally carries the tier NAME (`Contractor — 10% off`) because it
renders the live submit response, which has it. The tier name is NOT persisted (not in the migration
spec; it's cosmetic and would risk a live-tier read that violates frozen-at-charge). The discount
AMOUNT and % are identical across all surfaces; only the label wording differs slightly.

## QBO REAL-PUSH REPRESENTATION (§6 r16 note)

Industry standard for a QBO discount is a native `DiscountLineDetail` line. We use a negative-Amount
`SalesItemLine` instead because: (a) this invoice ALREADY represents everything (incl. tax) as manual
SalesItemLine entries, so a negative SalesItemLine fits its own convention; (b) `DiscountLineDetail`
(PercentBased) discounts ALL prior lines incl. services (which must NOT be discounted, per D-39), and
the fixed-amount form can require a configured discount account; (c) the real push is an UNTESTABLE
surface here (no live QB sandbox) where a malformed line 400s the WHOLE invoice — so the safe,
total-preserving choice is used, GATED on a discount applying (retail orders unchanged). The native
`DiscountLineDetail` is the future upgrade once it can be owner-tested against a live sandbox.

## OWNER-PROVE (David, live)

1. ✅ DONE — `20260713_order_items_line_breakdown.sql` APPLIED as postgres + catalog-verified (A)-(E) green (invariant holds).
2. Contractor order (john smith, tier 1, Live Oak $128): submit → **order-detail shows the grouped
   breakdown WITH "Discount — 10% off −$12.80"** (retail $128 → net $115.20), not just net.
3. **QBO invoice shows the discount represented** (10% visible as its own line, not baked into a net
   rate) — on the preview AND the real push. ⚠️ On the real push, confirm QBO accepts the negative
   discount line (if a config rejects it, fall back to description-embed — noted as the one live risk).
4. Review === Confirmation === order-detail === QBO — all show the SAME discount amount/%, all from
   the stored breakdown post-submit.
5. Edit the order (change qty) → the stored breakdown refreshes; surfaces still agree (edit shows net
   only, honest to the baseline re-charge — the carried #107/#114 "edit drops the tier" gap).
6. A historical order (pre-migration, null columns) → net only, no broken discount line (graceful).
7. `retail − discount === net` on every line (the invariant holds; SQL check (E)).

## CARRIED (not fixed here)

- `handleUpdate` still charges BASELINE (no tier) on edit — the #107/#114 gap. This build persists the
  refreshed baseline breakdown honestly (net only after edit); making edits tier-aware is a separate
  decision (STD-016 territory).
- Persisting the tier NAME (a 4th column) so order-detail/QBO label matches Confirmation verbatim —
  deferred (cosmetic; `N% off` from stored pct is sufficient and frozen-correct).
