-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260923 — A FINISHED STOP REMEMBERS WHAT ITS ORDER WAS · ledger #369 · tech-debt #319
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
-- ⚠️ NOT FOR TONIGHT. David, 2026-09-22: nothing to paste before Lauren's 08:00 start.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────────────────
-- Finishing a stop now fulfils its order (tech-debt #319), and David ruled that **Undo done
-- reverses the fulfil** — otherwise a truck run that did not happen leaves stock decremented.
--
-- To reverse it we must know what the order was BEFORE. That is not knowable any other way:
--   · The order's own status is now `fulfilled`, which says nothing about where it came from.
--   · Order transitions are recorded in `business_inventory_ledger` — and **in test mode that
--     guard discards every row** (R-158 / ledger #342). So on the tenant where this is being
--     proven, the event history is empty BY DESIGN and cannot be read back.
--   · Guessing is what this platform keeps getting caught by. LAWNS's stop-bearing orders sit at
--     `invoiced` (33), `fulfilled` (10) and `cancelled` (1) — measured 2026-09-22 — so there is
--     no single "the status before a delivery" to assume.
--
-- So the stop remembers it, in one nullable column, written at the moment of the fulfil and
-- cleared when the undo restores it.
--
-- ⚠️ IT IS NOT A SECOND SOURCE OF TRUTH FOR THE ORDER'S STATUS. `orders.status` remains the only
-- one. This column holds a single fact with one reader: *"if this stop's Done is undone, put the
-- order back to this"*. It is null whenever there is nothing to put back.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS order_status_before_finish text;

COMMENT ON COLUMN public.deliveries.order_status_before_finish IS
  'What this stop''s order was immediately before finishing the stop fulfilled it (tech-debt #319). Written by the office door at the fulfil, read and cleared by Undo done. NULL means there is nothing to put back. Not a second source of truth: orders.status is the only one.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the column exists, is text, and is nullable. EXPECT one row: text · YES.
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'deliveries'
--    AND column_name = 'order_status_before_finish';
--
-- V2 · every existing stop reads NULL — nothing has been finished through the new path yet.
--      EXPECT filled = 0.
-- SELECT count(*) AS stops, count(order_status_before_finish) AS filled
--   FROM public.deliveries
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V3 · AFTER finishing one stop from the schedule: that stop remembers the status its order held,
--      and the order now reads `fulfilled`. EXPECT one row, `remembered` NOT null, status
--      `fulfilled`.
-- SELECT d.id, d.status AS stop_status, d.order_status_before_finish AS remembered, o.status AS order_status
--   FROM public.deliveries d JOIN public.orders o ON o.id = d.order_id
--  WHERE d.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND d.order_status_before_finish IS NOT NULL;
--
-- V4 · AFTER pressing Undo done on that stop: the order is back where it was and the stop has
--      forgotten. EXPECT `remembered` NULL and the order at its earlier status (at LAWNS most
--      stop-bearing orders sit at `invoiced`).
-- SELECT d.id, d.status AS stop_status, d.order_status_before_finish AS remembered, o.status AS order_status
--   FROM public.deliveries d JOIN public.orders o ON o.id = d.order_id
--  WHERE d.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND d.id = '<the stop you used>';
--
-- V5 · 🔴 THE STOCK RECORD DID NOT MOVE, because this tenant is in test mode (R-158). EXPECT the
--      same 470 the reload left.
-- SELECT count(*) AS ledger_rows FROM public.business_inventory_ledger
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
