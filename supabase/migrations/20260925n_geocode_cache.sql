-- ─────────────────────────────────────────────────────────────────────────────
-- 20260925n · GEOCODE RESULTS SURVIVE THE RELOAD
--
-- ⚠️ STATUS AT WRITING: **WRITTEN, NOT APPLIED.** Nothing in the codebase depends on this table
--    existing; every reader treats its absence as "not set up yet" and says so.
--
-- WHY:  The final QuickBooks reload REPLACES `customer_addresses`. The coordinates on those rows
--       were paid for one Google request at a time — 215 of them on 2026-09-25, and ~1,300 more to
--       come — and a reload would throw every one away, so the whole run would have to be bought
--       again. This table is where a verdict lives that is NOT tied to a row that gets replaced.
--
-- 🔴 THE KEY IS (business, QuickBooks customer id, NORMALISED ADDRESS TEXT), and each part earns
--    its place:
--      · `qb_customer_id` because it is the ONE identifier that survives the reload — HISTORY
--        re-links customers by it, so it is the only thing on both sides of the join.
--      · the NORMALISED ADDRESS because a coordinate belongs to a PLACE, not to a person. A
--        customer who moves must not inherit the pin of the house they left.
--      · and because the text is part of the key, **an address whose text changed simply misses
--        and is re-checked.** That is not a rule anybody has to remember — it falls out of the
--        shape, which is the only kind of rule that holds.
--
-- ⚠️ IT IS A CACHE OF ANSWERS, NOT A SOURCE OF TRUTH. `customer_addresses` remains where a
--    verdict is read from. This is only consulted to REFILL a row that has no verdict at all, so
--    a stale entry can never overwrite a fresher answer somebody just got.
--
-- ⚠️ `geocode_status` IS STORED WITH THE COORDINATE AND `confirm`/`not_found` CARRY NONE. That
--    mirrors the rule the whole address check rests on: a coordinate exists only for `found`,
--    because a pin nobody agreed to is the one lie the check exists to prevent.
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE IF NOT EXISTS public.geocode_cache (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id     uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  qb_customer_id  text NOT NULL,
  address_norm    text NOT NULL,
  latitude        double precision,
  longitude       double precision,
  geocode_status  text NOT NULL,
  geocoded_at     timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  -- A verdict is one of exactly three things. An unknown string here would flow straight back
  -- onto a customer address and be believed.
  CONSTRAINT geocode_cache_status_check CHECK (geocode_status IN ('found', 'confirm', 'not_found')),
  -- 🔴 BOTH OR NEITHER. A latitude with no longitude is not a location, and half a coordinate
  -- refilled onto an address would read as "located" to every `latitude IS NOT NULL` check.
  CONSTRAINT geocode_cache_coord_pair_check CHECK (
    (latitude IS NULL AND longitude IS NULL) OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  ),
  -- Only `found` may carry a coordinate — the address check's own rule, enforced here so the
  -- cache cannot reintroduce what the check refuses.
  CONSTRAINT geocode_cache_found_has_coord_check CHECK (
    geocode_status <> 'found' OR (latitude IS NOT NULL AND longitude IS NOT NULL)
  ),
  CONSTRAINT geocode_cache_key UNIQUE (business_id, qb_customer_id, address_norm)
);

COMMENT ON TABLE public.geocode_cache IS
  'Geocode verdicts keyed by (business, QuickBooks customer id, normalised address text) so they survive a reload that replaces customer_addresses. A cache of answers, never a source of truth: it is read only to refill an address that has no verdict.';
COMMENT ON COLUMN public.geocode_cache.address_norm IS
  'Lower-cased, punctuation- and whitespace-collapsed "line1, city, state, zip". Part of the key on purpose: an address whose text changed misses and is re-checked.';

CREATE INDEX IF NOT EXISTS idx_geocode_cache_business ON public.geocode_cache (business_id);

ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

-- AC-2: scoped to business membership, both directions. No owner-only policy — this is
-- operational data the same people who run the locate already read.
DROP POLICY IF EXISTS geocode_cache_member_select ON public.geocode_cache;
CREATE POLICY geocode_cache_member_select ON public.geocode_cache
  FOR SELECT USING (public.is_active_member(business_id));

DROP POLICY IF EXISTS geocode_cache_member_write ON public.geocode_cache;
CREATE POLICY geocode_cache_member_write ON public.geocode_cache
  FOR ALL USING (public.is_active_member(business_id))
  WITH CHECK (public.is_active_member(business_id));

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V1 · THE TABLE IS THERE, WITH RLS ON AND BOTH POLICIES
-- ═════════════════════════════════════════════════════════════════════════════
SELECT
  to_regclass('public.geocode_cache') IS NOT NULL                      AS table_exists,
  (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.geocode_cache'::regclass) AS rls_on,
  (SELECT count(*) FROM pg_policies WHERE tablename = 'geocode_cache') AS policies;
-- EXPECT: t | t | 2

-- ═════════════════════════════════════════════════════════════════════════════
-- V2 · THE CONSTRAINTS REFUSE WHAT THEY SHOULD — each one proven by being hit
-- ═════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  biz uuid;
  refused int := 0;
BEGIN
  SELECT id INTO biz FROM public.businesses ORDER BY created_at LIMIT 1;
  IF biz IS NULL THEN RAISE NOTICE 'V2 SKIPPED — no business row to hang a probe on'; RETURN; END IF;

  BEGIN
    INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status)
    VALUES (biz, '__v2', '__v2 addr', 'nonsense');
    RAISE NOTICE 'V2 🔴 a nonsense status was ACCEPTED';
  EXCEPTION WHEN check_violation THEN refused := refused + 1;
  END;

  BEGIN
    INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status, latitude)
    VALUES (biz, '__v2', '__v2 addr', 'found', 30.5);
    RAISE NOTICE 'V2 🔴 half a coordinate was ACCEPTED';
  EXCEPTION WHEN check_violation THEN refused := refused + 1;
  END;

  BEGIN
    INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status)
    VALUES (biz, '__v2', '__v2 addr', 'found');
    RAISE NOTICE 'V2 🔴 a found verdict with NO coordinate was ACCEPTED';
  EXCEPTION WHEN check_violation THEN refused := refused + 1;
  END;

  -- …and the legitimate shapes are NOT refused. A constraint set that rejects everything would
  -- pass the three probes above and be useless.
  INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status, latitude, longitude)
  VALUES (biz, '__v2', '__v2 found', 'found', 30.5719542, -97.9188683);
  INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status)
  VALUES (biz, '__v2', '__v2 notfound', 'not_found');

  BEGIN
    INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status)
    VALUES (biz, '__v2', '__v2 notfound', 'not_found');
    RAISE NOTICE 'V2 🔴 a DUPLICATE key was ACCEPTED';
  EXCEPTION WHEN unique_violation THEN refused := refused + 1;
  END;

  RAISE NOTICE 'V2 refused % of 4 bad shapes, and accepted both good ones', refused;
  DELETE FROM public.geocode_cache WHERE qb_customer_id = '__v2';
END $$;
-- EXPECT: NOTICE "V2 refused 4 of 4 bad shapes, and accepted both good ones", and no 🔴 lines.

-- ═════════════════════════════════════════════════════════════════════════════
-- V3 · NOTHING WAS BACKFILLED — the table starts empty, on purpose
-- ═════════════════════════════════════════════════════════════════════════════
SELECT count(*) AS rows_in_cache FROM public.geocode_cache;
-- EXPECT: 0. Filling it is the app's job, one verdict at a time as they are earned; a bulk
-- backfill from customer_addresses is a SEPARATE, later decision and deliberately not done here.
