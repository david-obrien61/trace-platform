-- ─────────────────────────────────────────────────────────────────────────────
-- 20260925o · "KEEP WHAT I TYPED" IS AN ANSWER, AND THE DATABASE REFUSES TO RECORD IT
--
-- ⚠️ STATUS AT WRITING: **WRITTEN, NOT APPLIED.**
--
-- 🔴 THE DEFECT, MEASURED LIVE 2026-09-25, AND IT IS SILENT.
-- `customer_addresses_geocode_consistent` permits exactly three states: NULL, `found` with a
-- coordinate, `not_found` without one. **`confirm` is not among them.** But `confirm` is precisely
-- what the address check records when Google suggests a different street and the person says
-- *"keep what I typed"* — David's ruling, 2026-09-23: Google suggests, the person confirms, and
-- what we store is THEIR choice.
--
-- So today that write is REFUSED by the database. `rememberAnswer` catches the failure, logs
-- `address answer NOT recorded — checkout continues`, and the sale proceeds — correctly, because a
-- failed cache write must never cost a sale (§6 r6). **And that is what makes it invisible.** The
-- answer is never stored, so the 30-day clock never starts, so the SAME question is asked about
-- the SAME address on the next visit. The one rule the whole build exists to keep — *never two
-- questions for one address* — is broken for exactly the case that needed a human to decide.
--
-- Live evidence: `geocode_status` across LAWNS's 1,516 addresses is `(null) 1301 · found 208 ·
-- not_found 7`. **Zero `confirm`.** Not because nobody ever kept their own text, but because
-- nobody could.
--
-- 🔴 FOUND BY WRITING THE OWED TEST, NOT BY READING THE CODE. `writer-registry.json` had carried
-- *"NO end-to-end path test enters a value through this field and reads the coordinate back"* as
-- an OWED test since 2026-09-24. The code is correct — `resolveAddressCheck` returns `confirm`
-- with no coordinate exactly as ruled — and every unit test of it passes, because they test the
-- function and not the write. Only driving the value into a real schema found the disagreement.
--
-- WHAT THIS CHANGES: one CHECK constraint, widened by one branch. `confirm` joins `not_found` as a
-- verdict that carries NO coordinate — for the same reason: a pin nobody agreed to must not be
-- stored against an address. Nothing else moves, and no data is touched.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

ALTER TABLE public.customer_addresses
  DROP CONSTRAINT IF EXISTS customer_addresses_geocode_consistent;

ALTER TABLE public.customer_addresses
  ADD CONSTRAINT customer_addresses_geocode_consistent CHECK (
    geocode_status IS NULL
    OR (geocode_status = 'found'     AND latitude IS NOT NULL AND longitude IS NOT NULL AND geocoded_at IS NOT NULL)
    -- 🔴 THE NEW BRANCH. `confirm` = the person was shown Google's version and kept their own.
    -- It is DATED (that date is the whole point — it stops the question being asked again) and it
    -- carries NO coordinate, because Google's pin belongs to Google's text.
    OR (geocode_status = 'confirm'   AND latitude IS NULL     AND longitude IS NULL     AND geocoded_at IS NOT NULL)
    OR (geocode_status = 'not_found' AND latitude IS NULL     AND longitude IS NULL)
  );

COMMENT ON COLUMN public.customer_addresses.geocode_status IS
  'found (a coordinate we can price from) · confirm (Google offered a different address and the person kept theirs — dated, no coordinate) · not_found (saved and unverified) · NULL (never attempted). A delivery may be priced only from found.';

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V1 · THE CONSTRAINT NOW ADMITS `confirm`, AND STILL REFUSES EVERYTHING IT SHOULD
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  aid uuid;
  refused int := 0;
  accepted int := 0;
BEGIN
  SELECT id INTO aid FROM public.customer_addresses ORDER BY created_at LIMIT 1;
  IF aid IS NULL THEN RAISE NOTICE 'V1 SKIPPED — no customer_addresses row to probe'; RETURN; END IF;

  -- THE ONE THIS MIGRATION IS FOR.
  BEGIN
    UPDATE public.customer_addresses
       SET geocode_status = 'confirm', latitude = NULL, longitude = NULL, geocoded_at = now()
     WHERE id = aid;
    accepted := accepted + 1;
  EXCEPTION WHEN check_violation THEN
    RAISE NOTICE 'V1 🔴 confirm is STILL refused — the migration did not take';
  END;

  -- …and the shapes that must still be refused. A constraint widened too far is worse than one
  -- widened too little, because the bad rows it admits are believed.
  BEGIN
    UPDATE public.customer_addresses SET geocode_status = 'confirm', latitude = 30.5, longitude = -97.9, geocoded_at = now() WHERE id = aid;
    RAISE NOTICE 'V1 🔴 confirm WITH a coordinate was accepted — Google''s pin against her text';
  EXCEPTION WHEN check_violation THEN refused := refused + 1;
  END;

  BEGIN
    UPDATE public.customer_addresses SET geocode_status = 'confirm', latitude = NULL, longitude = NULL, geocoded_at = NULL WHERE id = aid;
    RAISE NOTICE 'V1 🔴 an UNDATED confirm was accepted — the clock would never expire it';
  EXCEPTION WHEN check_violation THEN refused := refused + 1;
  END;

  BEGIN
    UPDATE public.customer_addresses SET geocode_status = 'found', latitude = NULL, longitude = NULL, geocoded_at = now() WHERE id = aid;
    RAISE NOTICE 'V1 🔴 a found verdict with NO coordinate was accepted';
  EXCEPTION WHEN check_violation THEN refused := refused + 1;
  END;

  -- Put it back exactly as it was.
  UPDATE public.customer_addresses
     SET geocode_status = NULL, latitude = NULL, longitude = NULL, geocoded_at = NULL
   WHERE id = aid AND geocode_status = 'confirm';

  RAISE NOTICE 'V1 accepted % of 1 good shape, refused % of 3 bad ones', accepted, refused;
END $$;
-- EXPECT: NOTICE "V1 accepted 1 of 1 good shape, refused 3 of 3 bad ones", and no 🔴 lines.

-- ═════════════════════════════════════════════════════════════════════════════
-- V2 · NOTHING WAS CHANGED BY THIS MIGRATION — the counts are what they were
-- ═════════════════════════════════════════════════════════════════════════════
SELECT coalesce(geocode_status, '(never attempted)') AS status, count(*)
FROM public.customer_addresses GROUP BY 1 ORDER BY 2 DESC;
-- EXPECT (LAWNS, 2026-09-25): (never attempted) 1301 · found 208 · not_found 7 · NO confirm rows.
-- `confirm` starts appearing only as people answer the question from now on.
