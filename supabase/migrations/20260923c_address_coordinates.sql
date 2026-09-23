-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260923c — AN ADDRESS REMEMBERS WHERE IT IS · ledger #386 · the address check ①
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ⚠️ FILENAME NOTE: `20260923c`, NOT `20260923b`. My first draft took `b` and that is crew-link's
--    `20260923b_route_order_per_team.sql` — caught by listing the slot across every remote branch
--    before committing, not by a cap. The DAY in the name is not the day it was written
--    (2026-09-22): the 20260923 slot was already in use, and renaming an APPLIED migration breaks
--    the match to the database (David, 2026-09-21). The name is a sequence position, not a date.
--
-- ── WHY (David's ruling, 2026-09-22) ────────────────────────────────────────────────────────
-- Checkout prices a delivery without ever establishing that the address exists. An address is
-- typed, a zone is applied, a charge is made — and nothing has asked whether the place is real.
-- The ruling: validate at checkout; found → store the coordinate; **not found → say so, save it
-- anyway, mark it unverified, and DO NOT PRICE IT**.
--
-- Storing the coordinate is also what lets the warranty queue match owed trees to nearby stops
-- by REAL DISTANCE. Today that queue matches on zip, which is why two addresses either side of a
-- zip boundary read as far apart and two ends of a long zip read as neighbours.
--
-- ── WHAT IS STORED, AND WHAT DELIBERATELY IS NOT ────────────────────────────────────────────
-- ✅ `latitude` / `longitude` — the coordinate Google returned.
-- ✅ `geocoded_at`           — WHEN it was fetched. This is the compliance clock, see below.
-- ✅ `geocode_status`        — 'found' or 'not_found'. NULL means never attempted.
--
-- 🔴 GOOGLE'S CORRECTED ADDRESS TEXT IS NOT STORED, AND THERE IS NO COLUMN FOR IT. David ruled:
--    *"Google suggests, the person confirms, we store the confirmed value."* What lands in
--    `line1`/`city`/`state`/`zip` is always what a human agreed to. A `formatted_address` column
--    would be the obvious thing to add later, and adding it would break the ruling — which is
--    why its ABSENCE is written down here rather than left to be inferred from an empty schema.
--
-- ── THE 30-DAY CLOCK IS THE COMPLIANCE MECHANISM, NOT A CACHE OPTIMISATION ───────────────────
-- Google's terms (§6.3.1) allow lat/lng to be cached for 30 days. `geocoded_at` is what makes
-- that enforceable: a coordinate older than 30 days is re-fetched ON NEXT USE, and one that is
-- never used again is deleted rather than kept. The refresh rolls the clock forward for
-- addresses that matter and lets it expire for the rest.
-- ⚠️ LAZY BY RULING — no cron, and no 13th `api/` function (the ceiling is 12 of 12, §6 r11).
--    Nothing sweeps this table on a timer; the next read is what refreshes it.
--
-- ⚠️ STOPS ARE NOT TOUCHED HERE AND THAT IS A QUESTION, NOT AN OVERSIGHT. `deliveries` carries a
--    SNAPSHOT of the ship-to address, so a stop's coordinate could be copied at scheduling time
--    or looked up through the address record. Which one is right depends on whether a stop must
--    keep the coordinate it had on the day — David's call, filed rather than assumed.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.customer_addresses
  ADD COLUMN IF NOT EXISTS latitude       double precision,
  ADD COLUMN IF NOT EXISTS longitude      double precision,
  ADD COLUMN IF NOT EXISTS geocoded_at    timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_status text;

COMMENT ON COLUMN public.customer_addresses.latitude IS
  'Latitude from Google Geocoding. Cacheable for 30 days under Google ToS 6.3.1; `geocoded_at` is the clock that enforces it. NULL means not geocoded.';
COMMENT ON COLUMN public.customer_addresses.longitude IS
  'Longitude from Google Geocoding. See latitude.';
COMMENT ON COLUMN public.customer_addresses.geocoded_at IS
  'When the coordinate was fetched — the 30-day compliance clock (Google ToS 6.3.1). Older than 30 days: re-fetch on next use. Never used again: delete rather than keep. Lazy by ruling (David 2026-09-22) — nothing sweeps this on a timer.';
COMMENT ON COLUMN public.customer_addresses.geocode_status IS
  'found | not_found. NULL = never attempted. not_found means the address was SAVED and is UNVERIFIED: checkout says so and must not price a delivery to it (David 2026-09-22).';

-- 🔴 THE CHECK IS THE HONEST HALF: a row that claims `found` must actually carry a coordinate,
-- and one that says `not_found` must not pretend to. Without this, a bug that writes the status
-- without the numbers produces a row that reads as verified and routes nowhere — the same shape
-- as a search that matches nothing while the screen says it should (R-170).
ALTER TABLE public.customer_addresses
  DROP CONSTRAINT IF EXISTS customer_addresses_geocode_consistent;
ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_geocode_consistent CHECK (
    (geocode_status IS NULL)
    OR (geocode_status = 'found'     AND latitude IS NOT NULL AND longitude IS NOT NULL AND geocoded_at IS NOT NULL)
    OR (geocode_status = 'not_found' AND latitude IS NULL     AND longitude IS NULL)
  );

-- Finding the addresses whose coordinate has expired, without reading the whole table. Partial:
-- only rows that HAVE a coordinate can go stale, and on LAWNS most rows never will.
CREATE INDEX IF NOT EXISTS customer_addresses_geocoded_at
  ON public.customer_addresses (business_id, geocoded_at)
  WHERE geocoded_at IS NOT NULL;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the four columns exist with the right types. EXPECT 4 rows:
--      geocode_status text · geocoded_at timestamptz · latitude double precision · longitude double precision
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='customer_addresses'
--    AND column_name IN ('latitude','longitude','geocoded_at','geocode_status') ORDER BY column_name;
--
-- V2 · nothing is geocoded yet — this migration stores no data. EXPECT all zero.
-- SELECT count(*) AS addresses,
--        count(latitude) AS with_latitude,
--        count(geocoded_at) AS with_clock,
--        count(geocode_status) AS with_status
--   FROM public.customer_addresses
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V3 · 🔴 THE CONSISTENCY CHECK REFUSES A LYING ROW. This is a forced-rollback probe: it tries
--      to write `found` with no coordinate, expects the refusal, and ALWAYS rolls back so the
--      table is untouched. EXPECT: 'OK — the check refused it', then the exception.
-- DO $probe$
-- DECLARE v_id uuid;
-- BEGIN
--   SELECT id INTO v_id FROM public.customer_addresses
--    WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' LIMIT 1;
--   IF v_id IS NULL THEN RAISE EXCEPTION 'ROLLED BACK — no address row to probe with'; END IF;
--   BEGIN
--     UPDATE public.customer_addresses SET geocode_status = 'found' WHERE id = v_id;
--     RAISE EXCEPTION 'ROLLED BACK — 🔴 THE CHECK DID NOT REFUSE: a row now claims found with no coordinate';
--   EXCEPTION WHEN check_violation THEN
--     RAISE NOTICE 'OK — the check refused it';
--   END;
--   RAISE EXCEPTION 'ROLLED BACK ON PURPOSE — this probe never keeps a change';
-- END
-- $probe$;
--
-- V4 · the partial index exists. EXPECT one row.
-- SELECT indexname FROM pg_indexes
--  WHERE schemaname='public' AND tablename='customer_addresses' AND indexname='customer_addresses_geocoded_at';
--
-- V5 · 🔴 NO COLUMN HOLDS GOOGLE'S CORRECTED TEXT — the ruling, asserted rather than assumed.
--      EXPECT 0 rows.
-- SELECT column_name FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='customer_addresses'
--    AND column_name IN ('formatted_address','google_address','corrected_address','place_id');
