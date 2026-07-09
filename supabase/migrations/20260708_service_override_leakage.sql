-- ============================================================================
-- 20260708_service_override_leakage.sql  (GATED — David applies as postgres)
-- Attributed price-override leakage, mirroring Ignition's shipped pattern
-- (supabase_price_override_migration.sql:5-8 → estimate_line_items). A discretionary
-- price give-away (e.g. planting 6×$225=$1350 → flat $1000 = a $350 give) is captured
-- ON THE SALE LINE with: the override flag, the baseline it overrode, the amount given
-- away, the acting user (attribution), and — improving on Ignition — a reason.
--
-- Additive + lossless: every column IF NOT EXISTS, nullable (or boolean DEFAULT false).
-- No CHECK, no data move, no RLS change. order_service_selections + order_items are
-- live-only tables (tech-debt #39) — these ALTERs are additive.
--
-- WHO (override_by): the acting user's auth.uid(), resolved SERVER-SIDE from the caller's
-- Bearer token in api/orders/submit.ts (never a client-posted id). Plain uuid, no FK — the
-- value is an auth.users id captured at write time; kept FK-free to stay purely additive.
--
-- DEPLOY ORDER: deploy the code FIRST (it inserts WITH these columns and, on a
-- missing-column error 42703/PGRST204, retries WITHOUT them — deploy-window-safe), THEN
-- apply this migration so the override columns persist.
-- ============================================================================

ALTER TABLE order_service_selections
  ADD COLUMN IF NOT EXISTS is_manual_override boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_price     numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_leakage      numeric(10,2),
  ADD COLUMN IF NOT EXISTS override_by        uuid,
  ADD COLUMN IF NOT EXISTS override_reason    text;

-- Schema-ready for a plant-line price give (order_items). The override UI wires SERVICES
-- this pass; a plant-line override rides the same columns when built (honest debt).
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS is_manual_override boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS original_price     numeric(10,2),
  ADD COLUMN IF NOT EXISTS price_leakage      numeric(10,2),
  ADD COLUMN IF NOT EXISTS override_by        uuid,
  ADD COLUMN IF NOT EXISTS override_reason    text;

-- ── Verify (run as postgres after apply) ────────────────────────────────────
-- (A) both tables carry the 5 override columns, correct types/nullability:
--   SELECT table_name, column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--   WHERE table_name IN ('order_service_selections','order_items')
--     AND column_name IN ('is_manual_override','original_price','price_leakage','override_by','override_reason')
--   ORDER BY table_name, column_name;
--   -- expect: is_manual_override boolean NO (default false); original_price/price_leakage numeric YES;
--   --         override_by uuid YES; override_reason text YES — for BOTH tables (10 rows).
--
-- (B) round-trip a service override then read it back (rollback):
--   BEGIN;
--     UPDATE order_service_selections
--       SET is_manual_override = true, original_price = 1350.00, price_leakage = 350.00,
--           override_by = gen_random_uuid(), override_reason = 'loyal contractor'
--       WHERE id = (SELECT id FROM order_service_selections LIMIT 1)
--       RETURNING is_manual_override, original_price, price_leakage, override_by, override_reason;
--   ROLLBACK;
