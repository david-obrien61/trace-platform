-- ============================================================================================
-- 20260923j — ORDERS GET A SHIP DATE OF THEIR OWN
--             ledger #392 · David's F-task 2026-09-23
--
-- ✅ APPLIED 2026-09-24 BY DAVID in the SQL editor (§6 r17). His results, verbatim:
--      V1 date / YES · V2 orders_ship_date_idx partial · V3 ship_date 0, delivery_date 59,
--      history 1,546 · V4 "V4 PASSED — ship_date is writable and delivery_date is untouched" · V5 0
--
-- 🔴 THE CALL, IN ONE LINE: ship date lands in a NEW `orders.ship_date` column, NOT in
--    `delivery_date` — because `delivery_date` is a PLANNING field the schedule and the route page
--    read, so writing 1,484 historical QuickBooks ShipDates into it would make years of finished
--    invoices appear as scheduled delivery days on Lauren's schedule.
--    (Measured: `delivery_date` is populated on 43 of 1,530 history orders and the stop machinery
--     writes it; `install_date` is populated on 0 and is a different fact again.)
--
-- ⚠️ THIS MIGRATION ADDS THE COLUMN AND BACKFILLS NOTHING, AND THAT IS NOT AN OVERSIGHT.
--    The backfill needs a live QuickBooks read, and there is no token: measured 2026-09-23,
--    `businesses.accounting_token` and `accounting_refresh_token` are **NULL on all three
--    tenants**. So the data does not exist on this side yet. The backfill is therefore a separate,
--    data-only step and is deliberately NOT in this folder — see
--    `docs/decisions/2026-09-23-ship-date-recovery.md` for why and for the runnable form.
--
-- WHY THE COLUMN LANDS NOW ANYWAY: the next history load can carry ShipDate the moment the import
-- is fixed (one mapping — see the decision doc), and the warranty window wants this date as its
-- second-best source. A column waiting for data is cheap; a load that has to be re-run because the
-- column was not there is not.
-- ============================================================================================

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS ship_date date;

COMMENT ON COLUMN public.orders.ship_date IS
  'QuickBooks Invoice.ShipDate — when the goods actually went out, as the owner''s books record it. '
  'DISTINCT from delivery_date (a planning field the schedule and route read) and from install_date. '
  'Populated by the history import; NULL means the books did not carry one, never that it shipped today.';

-- Partial: the warranty window and any "what actually shipped" read only ever want the rows that
-- HAVE one, and on today's data that is zero of 1,530 — a full index would be all dead weight.
CREATE INDEX IF NOT EXISTS orders_ship_date_idx
  ON public.orders (business_id, ship_date) WHERE ship_date IS NOT NULL;

-- ============================================================================================
-- V-BLOCKS — David pastes these AFTER applying. Verdict style: one self-contained block that
-- rolls itself back, so nothing is left on a customer's database (the 20260922c lesson).
-- ============================================================================================
-- V1 · the column exists, is a date, and is nullable → expect one row: date / YES
-- SELECT data_type, is_nullable FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='orders' AND column_name='ship_date';
--
-- V2 · the partial index exists → expect 1 row whose indexdef contains "WHERE (ship_date IS NOT NULL)"
-- SELECT indexname, indexdef ILIKE '%ship_date IS NOT NULL%' AS is_partial
--   FROM pg_indexes WHERE schemaname='public' AND tablename='orders' AND indexname='orders_ship_date_idx';
--
-- V3 · NOTHING was backfilled, and nothing was overwritten → expect ship_date_set = 0.
--      🔴 THIS BLOCK ORIGINALLY PINNED delivery_date_set AT 43 AND IT READ 59 ON THE DAY DAVID RAN
--      IT — the live figure moved between writing and running, so a correct migration produced a
--      V-block that looked wrong. That is exactly what §6 r26 forbids: a V-block must assert SHAPE
--      or read its comparison AT RUN TIME, never hard-code a live count that drifts. The count is
--      now reported rather than asserted, and only `ship_date_set = 0` is a claim.
-- SELECT count(*) FILTER (WHERE ship_date IS NOT NULL)     AS ship_date_set,
--        count(*) FILTER (WHERE delivery_date IS NOT NULL) AS delivery_date_set,
--        count(*)                                          AS history_orders
--   FROM public.orders
--  WHERE business_id = (SELECT id FROM public.businesses WHERE name ILIKE 'LAWNS%' LIMIT 1)
--    AND order_kind = 'history';
--
-- V4 · 🔴 THE COLUMN CANNOT BE MISTAKEN FOR A PLANNING DATE — a rolled-back proof that writing
--      ship_date leaves delivery_date alone. Expect ONE error reading "V4 PASSED — …".
-- DO $probe$
-- DECLARE v_id uuid; v_before date; v_after date;
-- BEGIN
--   SELECT id, delivery_date INTO v_id, v_before FROM public.orders
--    WHERE order_kind = 'history' ORDER BY created_at LIMIT 1;
--   IF v_id IS NULL THEN RAISE EXCEPTION 'V4 FAILED — no history order to probe against'; END IF;
--   UPDATE public.orders SET ship_date = DATE '2025-01-15' WHERE id = v_id;
--   SELECT delivery_date INTO v_after FROM public.orders WHERE id = v_id;
--   IF v_after IS DISTINCT FROM v_before THEN
--     RAISE EXCEPTION 'V4 FAILED — writing ship_date CHANGED delivery_date (% -> %). The schedule would gain a phantom day.', v_before, v_after;
--   END IF;
--   RAISE EXCEPTION 'V4 PASSED — ship_date is writable and delivery_date is untouched. Probe row discarded (rollback expected — this error IS the pass).';
-- END $probe$;
--
-- V5 · confirm it left nothing → expect 0 again
-- SELECT count(*) FILTER (WHERE ship_date IS NOT NULL) AS ship_date_set FROM public.orders;
