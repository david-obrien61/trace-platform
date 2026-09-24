-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260923d — A STOP KEEPS THE COORDINATE IT HAD ON THE DAY · ledger #386 · the address check ①b
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
-- ⚠️ APPLY `20260923c_address_coordinates.sql` FIRST. Nothing here depends on it mechanically —
--    these are additive columns on a different table — but a stop looks its coordinate up FROM
--    the address record, so applying this one alone gives you columns nothing can fill.
--
-- ── WHY (David's ruling, 2026-09-22) ────────────────────────────────────────────────────────
-- The industry standard for an order or a shipment: it SNAPSHOTS the address as it stood. This
-- table already does that — `address_line1`, `city`, `state`, `zip` are copied onto the stop at
-- scheduling time rather than read live from the customer. The coordinate now joins them, at the
-- same moment, for the same reason.
--
-- David: *"Correcting a customer's address later must never move a delivery that already
-- happened."* A stop is a record of where the truck went. If the coordinate were read live from
-- `customer_addresses`, then fixing a typo in a customer's street next spring would silently
-- relocate last autumn's delivery — the route history, the mileage, and anything ever computed
-- from them would change underneath a completed day.
--
-- ── 🔴 THE DIVISION OF LABOUR, WHICH IS THE PART TO GET RIGHT ───────────────────────────────
-- · A STOP answers "where did the truck go THAT DAY" → these columns, frozen.
-- · THE ADDRESS RECORD answers "where is this customer NOW" → `customer_addresses`, current.
--
-- EVERY "where is this customer now" question reads the ADDRESS RECORD, never an old stop:
-- the warranty queue matching owed trees to nearby work, routing a future day, a fertiliser
-- round, the customer map. A stop is evidence about the past and must not be consulted about the
-- present — it is the one mistake these columns make easy, so it is written here in the schema
-- rather than only in a ruling nobody re-reads.
--
-- ⚠️ A STOP WITH NO COORDINATE IS NOT AN ERROR. It is a stop that has not been routed yet. When
-- it is routed it looks one up from the address record and stores WHAT IT USED — so the snapshot
-- is taken at the moment the answer was actually needed, not guessed at scheduling time.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.deliveries
  ADD COLUMN IF NOT EXISTS latitude          double precision,
  ADD COLUMN IF NOT EXISTS longitude         double precision,
  ADD COLUMN IF NOT EXISTS coordinate_set_at timestamptz;

COMMENT ON COLUMN public.deliveries.latitude IS
  'Latitude of this stop AS IT STOOD when the stop was routed — a snapshot beside address_line1/city/state/zip, not a live read. Correcting the customer''s address later must never move a delivery that already happened (David 2026-09-22). "Where is this customer NOW" reads customer_addresses, never this.';
COMMENT ON COLUMN public.deliveries.longitude IS
  'Longitude of this stop as it stood when routed. See latitude.';
COMMENT ON COLUMN public.deliveries.coordinate_set_at IS
  'When this stop''s coordinate was taken from the address record. NOT a freshness clock: a stop''s coordinate never expires, because it describes a day that has already happened. The 30-day Google clock lives on customer_addresses.geocoded_at.';

-- 🔴 BOTH OR NEITHER, same reasoning as the address record: half a coordinate is a stop that
-- reads as located and routes nowhere.
ALTER TABLE public.deliveries
  DROP CONSTRAINT IF EXISTS deliveries_coordinate_complete;
ALTER TABLE public.deliveries
  ADD CONSTRAINT deliveries_coordinate_complete CHECK (
    (latitude IS NULL AND longitude IS NULL)
    OR (latitude IS NOT NULL AND longitude IS NOT NULL AND coordinate_set_at IS NOT NULL)
  );

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the three columns exist. EXPECT 3 rows.
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='deliveries'
--    AND column_name IN ('latitude','longitude','coordinate_set_at') ORDER BY column_name;
--
-- V2 · no stop carries a coordinate yet — this migration stores no data. EXPECT filled = 0.
-- SELECT count(*) AS stops, count(latitude) AS filled
--   FROM public.deliveries WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V3 · 🔴 HALF A COORDINATE IS REFUSED. Forced-rollback probe — it always rolls back.
--      EXPECT: 'OK — the check refused it', then the exception.
-- DO $probe$
-- DECLARE v_id uuid;
-- BEGIN
--   SELECT id INTO v_id FROM public.deliveries
--    WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' LIMIT 1;
--   IF v_id IS NULL THEN RAISE EXCEPTION 'ROLLED BACK — no stop to probe with'; END IF;
--   BEGIN
--     UPDATE public.deliveries SET latitude = 30.5788 WHERE id = v_id;
--     RAISE EXCEPTION 'ROLLED BACK — 🔴 THE CHECK DID NOT REFUSE: a stop now has half a coordinate';
--   EXCEPTION WHEN check_violation THEN
--     RAISE NOTICE 'OK — the check refused it';
--   END;
--   RAISE EXCEPTION 'ROLLED BACK ON PURPOSE — this probe never keeps a change';
-- END
-- $probe$;
--
-- V4 · the ship-to snapshot the coordinate now sits beside, unchanged. EXPECT the four text
--      columns still present — the coordinate JOINS them, it does not replace them.
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='deliveries'
--    AND column_name IN ('address_line1','city','state','zip') ORDER BY column_name;
