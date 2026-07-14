-- ============================================================
-- 20260713_order_items_line_breakdown.sql
-- D-43 — ORDER PERSISTS ITS OWN LINE BREAKDOWN (frozen-at-charge show-the-work)
--
-- WHAT: three additive, nullable columns on order_items so each GOODS line stores its
--       show-the-work provenance ALONGSIDE the net (unit_price/subtotal) it was charged:
--         • retail_unit   numeric(10,2)  — pre-discount unit price (the sell_price at time of order)
--         • discount_pct  numeric(5,2)   — the tier discount % applied to this line (0 = none/service)
--         • discount_amt  numeric(10,2)  — per-line discount = round2(retail_total − net_total), 0 = none
--       The existing unit_price/subtotal stay the NET (what was charged) — unchanged. The new
--       columns are provenance the surfaces RENDER; they never change what was charged.
--
-- WHY:  The tier discount is CHARGED correctly ($115.20) but the show-the-work discount LINE
--       rendered only on Review/Confirmation, NOT on order-detail or QBO — because submit
--       COMPUTES the full per-line breakdown (computeOrderPricing) then DISCARDS it, persisting
--       only the net. Every downstream surface had nothing to read, so it could not show the
--       discount. This recurred repeatedly. ROOT FIX (D-43, the industry standard): an order
--       PERSISTS its own line breakdown at submit; EVERY surface READS the stored fact. An
--       invoice stores its own lines — you don't recompute an invoice every time you view it.
--       Frozen-at-charge: a later tier/price change can't make a displayed discount disagree
--       with the total, because surfaces read history, not a live recompute.
--
-- STANDARDS: STD-012 (server-authoritative pricing, ONE computation) — TAKEN TO ITS CORRECT
--            CONCLUSION: the computation runs ONCE at submit, is PERSISTED, and every downstream
--            surface RENDERS the stored fact — NOT "every surface recomputes" (which fragments
--            into N copies that drift). See the STD-012 persistence-clause amendment (this build).
--            STD-016 (edits recompute through the canonical path) — the edit path ALSO persists
--            the refreshed breakdown, or the stored breakdown goes stale vs the re-charged net.
--            INVARIANT (enforced at write, verifiable here): retail_total − discount_amt === net_total.
--
-- SHAPE: additive, nullable, NO CHECK, ZERO destruction. Existing rows get NULL (historical orders
--        predate the breakdown → surfaces render net only, no fabricated discount line — D-9
--        omit-not-fake). order_items RLS is unchanged (no new policy — inherits existing).
--
-- GATED — David applies as postgres, then runs the catalog-verify block below. The app is
--        deploy-window-safe: submit strips these keys and retries on a missing-column error, and
--        the read surfaces treat a null retail_unit as "no stored breakdown" (render net only). So
--        code may deploy BEFORE or AFTER this migration without breaking checkout.
-- ============================================================

ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS retail_unit  numeric(10,2),
  ADD COLUMN IF NOT EXISTS discount_pct numeric(5,2),
  ADD COLUMN IF NOT EXISTS discount_amt numeric(10,2);

COMMENT ON COLUMN public.order_items.retail_unit  IS 'D-43: pre-discount unit price (sell_price at time of order). NULL for pre-migration/historical rows → surfaces render net only.';
COMMENT ON COLUMN public.order_items.discount_pct IS 'D-43: tier discount %% applied to this line (0 = none). Frozen-at-charge provenance; surfaces render this, never a live recompute.';
COMMENT ON COLUMN public.order_items.discount_amt IS 'D-43: per-line discount amount = round2(retail_total − net_total). INVARIANT: retail_total − discount_amt === net_total (subtotal).';

-- ============================================================
-- VERIFICATION (STD-008) — run in the Supabase SQL editor as postgres AFTER applying:
--
-- (A) the three columns exist, numeric, nullable, no default:
--   SELECT column_name, data_type, numeric_precision, numeric_scale, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'order_items'
--      AND column_name IN ('retail_unit','discount_pct','discount_amt')
--    ORDER BY column_name;
--   -- expect 3 rows: discount_amt|numeric|10|2|YES|(null), discount_pct|numeric|5|2|YES|(null), retail_unit|numeric|10|2|YES|(null)
--
-- (B) NO new CHECK constraint introduced on order_items by this migration (additive only):
--   SELECT tc.constraint_name, cc.check_clause
--     FROM information_schema.table_constraints tc
--     JOIN information_schema.check_constraints cc USING (constraint_name, constraint_schema)
--    WHERE tc.table_name = 'order_items' AND tc.constraint_type = 'CHECK';
--   -- expect: only pre-existing NOT NULL checks (nothing referencing retail_unit/discount_pct/discount_amt)
--
-- (C) RLS unchanged — order_items still carries its existing owner + member policies, no new one:
--   SELECT polname FROM pg_policies WHERE tablename = 'order_items' ORDER BY polname;
--   -- expect: the SAME policy set as before this migration (this file adds none)
--
-- (D) historical rows are NULL (untouched), a new order writes the trio:
--   SELECT count(*) FILTER (WHERE retail_unit IS NULL)  AS historical_null,
--          count(*) FILTER (WHERE retail_unit IS NOT NULL) AS with_breakdown
--     FROM order_items;
--   -- expect immediately after apply: historical_null = every existing row, with_breakdown = 0
--   -- after one new PAID order: with_breakdown grows; historical rows stay NULL.
--
-- (E) INVARIANT holds on every row that stored a breakdown (retail_total − discount_amt === net):
--   SELECT id, quantity, retail_unit, discount_amt, unit_price, subtotal,
--          round(retail_unit * quantity, 2) - COALESCE(discount_amt,0) AS reconstructed_net
--     FROM order_items
--    WHERE retail_unit IS NOT NULL
--      AND abs( (round(retail_unit * quantity, 2) - COALESCE(discount_amt,0)) - subtotal ) > 0.01;
--   -- expect: ZERO rows (the breakdown always reconciles to what was charged).
-- ============================================================
