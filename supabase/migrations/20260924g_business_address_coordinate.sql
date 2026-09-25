-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260924g — WHERE THE TRUCKS LEAVE FROM · ledger #386 · the address check ②
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHY IT IS HERE AND NOT IN A NEW SETTING (David, 2026-09-24) ─────────────────────────────
-- *"Do NOT create a separate depot setting. The yard/depot IS the ADDRESS in Settings → Business
-- profile — read it from there (one fact, one place)."*
--
-- So the coordinate goes BESIDE the address it describes, on `businesses`, and nowhere else.
-- A second "depot address" field would be a second representation of one fact (STD-011), and it
-- is always the copy that drifts — the yard would move in Settings and the rings would keep
-- measuring from the old place, silently, because nothing would tell them.
--
-- There is no linked address ROW to put this on: `customer_addresses` is keyed to a CUSTOMER, and
-- a business is not a customer of itself. `businesses.address` is a single free-text field (it is
-- the only address-ish column on the table — measured live 2026-09-24), so the coordinate joins
-- it there.
--
-- ── WHAT THIS COORDINATE IS FOR ─────────────────────────────────────────────────────────────
-- Two readers, both of which are wrong without it:
--   · the AUTOCOMPLETE BIAS CENTRE — a shorter list of plausible neighbours when someone types an
--     address at the counter;
--   · the RING MAP CENTRE — every delivery ring is measured in miles FROM here, so the rings are
--     meaningless until this is set.
--
-- ── MEASURED BEFORE WRITING (2026-09-24) ────────────────────────────────────────────────────
-- LAWNS's profile holds `400 Honeycomb Mesa Leander, Texas 78641`. Through the same server path
-- the product uses, that returns location_type ROOFTOP, partial_match false,
-- 30.5719542 / -97.9188683. So the yard IS placeable and the column will hold a real pin on day
-- one rather than a NULL nobody notices.
--
-- ⚠️ GOOGLE SPELLS IT `400 Honey Comb Mesa` (three words). THE TEXT IS NOT REWRITTEN. David's
-- ruling 2 (2026-09-23): Google suggests, the person confirms, and what is stored is THEIR
-- choice. Only the coordinate is taken.
--
-- ── THE 30-DAY CLOCK APPLIES HERE TOO (Google ToS §6.3.1) ───────────────────────────────────
-- `geocoded_at` starts it. The same lazy refresh as every other address: re-checked when it is
-- next needed and older than thirty days. No cron, no 13th api function.
-- 🔴 AND EDITING THE ADDRESS IN SETTINGS RE-GEOCODES IT — the pair must never be left saying that
-- a new address sits at the old address's pin, which is the precise failure the whole address
-- check exists to prevent, aimed at the business's own record instead of a customer's.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS latitude       double precision,
  ADD COLUMN IF NOT EXISTS longitude      double precision,
  ADD COLUMN IF NOT EXISTS geocoded_at    timestamptz,
  ADD COLUMN IF NOT EXISTS geocode_status text;

COMMENT ON COLUMN public.businesses.latitude IS
  'Where the trucks leave from. The coordinate of `address` — NOT a separate depot field (David 2026-09-24: the yard IS the business-profile address, one fact in one place). Null until geocoded, and null is honest: the rings cannot be measured and the autocomplete bias stays off rather than centring on somebody else''s town.';
COMMENT ON COLUMN public.businesses.longitude IS
  'See `latitude`. The pair is written together or not at all.';
COMMENT ON COLUMN public.businesses.geocoded_at IS
  'When this coordinate was obtained. Starts the 30-day clock (Google ToS §6.3.1); the refresh is lazy — re-checked when next needed and older than thirty days. Re-set whenever the owner edits the address in Settings, because a new address must never keep the old address''s pin.';
COMMENT ON COLUMN public.businesses.geocode_status IS
  'The VERDICT, decided by Google''s `location_type` and never by `status` — `status: OK` only means Google answered. found (ROOFTOP) · confirm (interpolated or corrected — a person must agree) · not_found (cannot be placed: saved, unverified, never used as a ring centre).';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only. No live counts pinned.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the four columns exist. EXPECT 4 rows.
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='businesses'
--    AND column_name IN ('latitude','longitude','geocoded_at','geocode_status')
--  ORDER BY column_name;
--
-- V2 · 🔴 NOTHING IS SEEDED. No migration writes a coordinate for any tenant — the app geocodes
--      the profile address and stores the result. EXPECT 0.
-- SELECT count(*) AS businesses_with_a_coordinate FROM public.businesses WHERE latitude IS NOT NULL;
--
-- V3 · the address the coordinate will describe, for every business — so you can see WHICH text
--      is about to be geocoded before anything is stored. EXPECT your three rows.
-- SELECT id, name, address, latitude, longitude, geocode_status FROM public.businesses ORDER BY name;
--
-- V4 · 🔴 THE PAIR CANNOT DISAGREE — a coordinate without a date, or a date without a coordinate,
--      is the shape that lets a stale pin read as fresh. Forced-rollback probe; it always rolls back.
--      EXPECT: 'OK — both halves present', then the exception.
-- DO $probe$
-- DECLARE v_biz uuid; v_lat double precision; v_at timestamptz;
-- BEGIN
--   SELECT id INTO v_biz FROM public.businesses LIMIT 1;
--   IF v_biz IS NULL THEN RAISE EXCEPTION 'ROLLED BACK — no business to probe with'; END IF;
--   UPDATE public.businesses
--      SET latitude = 30.5719542, longitude = -97.9188683,
--          geocoded_at = now(), geocode_status = 'found'
--    WHERE id = v_biz;
--   SELECT latitude, geocoded_at INTO v_lat, v_at FROM public.businesses WHERE id = v_biz;
--   IF v_lat IS NULL OR v_at IS NULL THEN
--     RAISE EXCEPTION 'ROLLED BACK — 🔴 THE PAIR DID NOT LAND TOGETHER';
--   END IF;
--   RAISE NOTICE 'OK — both halves present';
--   RAISE EXCEPTION 'ROLLED BACK ON PURPOSE — this probe never keeps a coordinate';
-- END
-- $probe$;
