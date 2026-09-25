-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260925c — EACH TRANSPORT ROW CARRIES ITS OWN PRICING CHOICE · ledger #386
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHY (David, 2026-09-25) ─────────────────────────────────────────────────────────────────
-- The delivery rings were derived from TRIP CHARGE history — 566 TC lines, 403 of them $50 — so
-- the rings price a TRIP CHARGE. They say nothing about a tailgate drop or a backyard placement,
-- which happen to cost $50 today and are different services.
--
-- 🔴 SO THE CHOICE BELONGS TO THE ROW, NOT TO THE PLATFORM. LAWNS runs three staff transport rows
-- at $50 — `Trip Charge`, `Tailgate Delivery`, `Backyard` (measured live 2026-09-25). A rule that
-- said "rings price transport" would silently re-price all three by distance, so a curb drop two
-- miles away would drop to the inner ring and a backyard placement forty miles out would jump to
-- $300. Neither is what she charges, and nobody would be told it had changed.
--
-- DEFAULTS, AND THEY ARE DELIBERATE:
--   · `Trip Charge`        → **ring**   — the rings were derived from its own history
--   · everything else      → **flat**   — unchanged from what it does today
-- David is ruling on tailgate and backyard. Until he does, they keep charging exactly what they
-- charge now, because the safe default for a money column is "what it already did".
--
-- ⚠️ NOTHING IS SEEDED BY BUSINESS. The default is a COLUMN DEFAULT ('flat'), so every existing
-- row keeps its behaviour, and the one Trip Charge row is switched by the V-block below with
-- David watching — not by a migration guessing which row is which from its name.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.service_offerings
  ADD COLUMN IF NOT EXISTS pricing_basis text NOT NULL DEFAULT 'flat';

-- 🔴 TWO VALUES, AND A THIRD IS A QUESTION WITH NO ANSWER. A row must say which it is.
ALTER TABLE public.service_offerings
  DROP CONSTRAINT IF EXISTS service_offerings_pricing_basis_check;
ALTER TABLE public.service_offerings
  ADD CONSTRAINT service_offerings_pricing_basis_check
  CHECK (pricing_basis IN ('flat', 'ring'));

COMMENT ON COLUMN public.service_offerings.pricing_basis IS
  'How this transport row is priced. `flat` = the row''s own price, what every row did before this column existed and still the default. `ring` = read the charge from business_delivery_rings by distance from the yard; outside the last ring it is SHOWN and NOT PRICED (David 2026-09-23). Set per ROW, never per platform: LAWNS runs three staff rows at $50 and the rings were derived from Trip Charge history alone, so re-pricing a tailgate drop by distance would silently change what she bills for a service the rings say nothing about.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only except V4, which David runs deliberately.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the column exists and defaults to 'flat'. EXPECT one row: pricing_basis · text · 'flat'.
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='service_offerings' AND column_name='pricing_basis';
--
-- V2 · 🔴 EVERY EXISTING ROW IS UNCHANGED — all 'flat', so nothing re-prices on apply.
--      EXPECT: one row, flat, with your full offering count.
-- SELECT pricing_basis, count(*) FROM public.service_offerings GROUP BY 1 ORDER BY 1;
--
-- V3 · what LAWNS has, so you can see which row you are about to switch.
-- SELECT name, price, category, transport_mode, pricing_basis
--   FROM public.service_offerings
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND category = 'transport' ORDER BY name;
--
-- V4 · 🔴 SWITCH TRIP CHARGE TO THE RINGS — DAVID RUNS THIS DELIBERATELY, BY NAME, ONE ROW.
--      Not done by the migration: a migration matching a row by its NAME is the hand-typed
--      id↔name mapping that put a Gift Certificate in the not-stock list on 2026-09-22.
--      EXPECT: UPDATE 1. Re-run V3 to see it.
-- UPDATE public.service_offerings SET pricing_basis = 'ring'
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND category = 'transport' AND name = 'Trip Charge';
--
-- V5 · a bad value is refused. Forced-rollback probe; it always rolls back.
--      EXPECT: 'OK — refused', then the exception.
-- DO $probe$
-- DECLARE v_id uuid;
-- BEGIN
--   SELECT id INTO v_id FROM public.service_offerings LIMIT 1;
--   IF v_id IS NULL THEN RAISE EXCEPTION 'ROLLED BACK — no offering to probe with'; END IF;
--   BEGIN
--     UPDATE public.service_offerings SET pricing_basis = 'by_the_mile' WHERE id = v_id;
--     RAISE EXCEPTION 'ROLLED BACK — 🔴 AN UNKNOWN PRICING BASIS WAS ACCEPTED';
--   EXCEPTION WHEN check_violation THEN
--     RAISE NOTICE 'OK — refused';
--   END;
--   RAISE EXCEPTION 'ROLLED BACK ON PURPOSE — this probe never keeps a change';
-- END
-- $probe$;
