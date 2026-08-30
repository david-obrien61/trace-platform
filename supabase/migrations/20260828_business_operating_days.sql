-- ============================================================
-- Migration: business_operating_days — THE DAY-TYPE RULES
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Date: 2026-08-28 (verified via `date` — clock not drifted)
-- Purpose: hold WHAT KIND OF DAY each day is, so the operations calendar can
--          surface the MISMATCH between the work booked on a day and the work
--          that day is for. Lauren's own schedule is the first instance:
--          Monday service/maintenance · Tue-Wed delivery only · Thu-Sun delivery/placement.
--
-- 🔴 IT WARNS, IT NEVER BLOCKS. Nothing in this schema refuses a write. There is no
--    trigger, no FK to an activity, no constraint that can stop a delivery landing on a
--    maintenance Monday. The 2026-08-23 attribution-over-approval ruling is the reason:
--    an approval gate is a person standing next to another person, and David's own words
--    about a trailer flagged red are "today I'm taking the damn trailer." The schedule
--    advises; the owner decides. A future build that adds a blocking trigger here is
--    contradicting a ruling, not tightening a table.
--
-- SHAPE — ONE table, two row kinds, EXCEPTION WINS:
--   · weekday IS NOT NULL  → the weekly pattern  (0=Sunday … 6=Saturday)
--   · on_date IS NOT NULL  → a date-level exception, overriding the pattern for that day
--   Exactly one of the two is set (the XOR check below). A big delivery WILL land on a
--   maintenance Monday eventually, and when it does the answer is an exception row, not
--   an edit to the pattern that silently changes every other Monday.
--
-- AC-1: no vertical nouns — `business_operating_days`, `business_id`-scoped. Nothing here
--       knows what a nursery is; a print shop with a Monday press-maintenance day is the
--       same table.
-- AC-2: RLS scoped to business_id membership.
-- AC-3: tenant isolation absolute.
-- AC-4: `day_type` is FREE TEXT WITH NO CHECK — the value set grows without a migration,
--       exactly as `deliveries.status` and `deliveries.service_type` do. The structural
--       checks below (XOR, weekday range) are NOT an AC-4 violation: they constrain the
--       SHAPE of a row, never the vocabulary of a value.
--       ⚠️ THE CONSEQUENCE IS DELIBERATE AND IS HANDLED IN THE READER: a day_type the code
--       does not recognise is NOT flagged and NOT silently passed — the calendar says
--       "type not recognised — conflicts not checked for this day". Claiming to check what
--       we cannot check is the failure §6 r18 exists to stop.
--
-- PERMISSIONS (David's call, 2026-08-28 Stage 0 answers):
--   READ  = is_active_member. Everyone who works there should see what kind of day it is.
--   WRITE = settings:update. Lauren and Joel hold it; STAFF does not. Joel is the
--           operations manager, so he must be able to set them.
--
-- ⚠️  APPLY MANUALLY in the Supabase SQL editor — do NOT execute without David's explicit
--     "run it".  GATED / UNAPPLIED until then.  §6 r17: created through a MIGRATION, never
--     the dashboard table editor (the table editor's supabase_admin default ACL grants
--     TRUNCATE + REFERENCES to anon, and RLS cannot filter TRUNCATE).
-- ============================================================
-- Pre-write verify (run BEFORE applying — expected results in comments):
--   business_operating_days → 404 (ABSENT ✅, this migration creates it)
--   businesses              → 200 (PRESENT ✅)  FK target + owner_id RLS target
--   is_active_member(uuid)  → PRESENT ✅  (20260622_is_active_member_canonical_rls.sql)
--   has_permission(uuid,text) → PRESENT ✅ (20260727_rbac_resource_action_flip.sql)
-- NO existing table, policy, role, function or RPC is altered by this migration.
-- ============================================================

CREATE TABLE business_operating_days (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- The weekly pattern row. 0 = Sunday … 6 = Saturday (JS getDay(), which is what the
  -- reader uses — one convention, named here so nobody re-derives it as ISO 1-7).
  weekday     int,

  -- The date-level exception row. Overrides the pattern for this one calendar day.
  on_date     date,

  -- AC-4: FREE TEXT, NO CHECK. The four the UI offers today are
  -- 'service' | 'delivery_only' | 'delivery_placement' | 'closed', and a business may type
  -- its own. An unrecognised value is reported as unchecked, never silently treated as safe.
  day_type    text        NOT NULL,

  -- Why this day is what it is ("Joel + Tyler on equipment"; "Terry travelling").
  note        text,

  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- EXACTLY ONE of weekday / on_date. A row with both is ambiguous and a row with neither
  -- describes nothing; either would be a rule that silently never matches.
  CONSTRAINT business_operating_days_one_kind
    CHECK ((weekday IS NULL) <> (on_date IS NULL)),

  CONSTRAINT business_operating_days_weekday_range
    CHECK (weekday IS NULL OR (weekday BETWEEN 0 AND 6))
);

-- ONE rule per weekday and ONE per date, per business. Without these, two rows can claim
-- the same day and the resolver's answer depends on row order — the "one field, two
-- authors" class (tech-debt #71) designed out rather than discovered later.
CREATE UNIQUE INDEX business_operating_days_pattern_uniq
  ON business_operating_days (business_id, weekday) WHERE weekday IS NOT NULL;
CREATE UNIQUE INDEX business_operating_days_exception_uniq
  ON business_operating_days (business_id, on_date) WHERE on_date IS NOT NULL;

-- The calendar reads one business's rules for a four-week window in one round trip.
CREATE INDEX business_operating_days_business_idx
  ON business_operating_days (business_id);

ALTER TABLE business_operating_days ENABLE ROW LEVEL SECURITY;

-- ── OWNER: full control. Matches the dual-RLS convention verify-universals cap3 asserts. ──
CREATE POLICY business_operating_days_owner_all ON business_operating_days
  USING (
    EXISTS (SELECT 1 FROM businesses
            WHERE id = business_operating_days.business_id AND owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM businesses
            WHERE id = business_operating_days.business_id AND owner_id = auth.uid())
  );

-- ── MEMBER READ: every active member, NO permission string. David's call: everyone who
--    works there should see what kind of day it is. A staff member who cannot read the day
--    types would see a calendar that flags nothing and never says why. ──
CREATE POLICY business_operating_days_member_select ON business_operating_days
  FOR SELECT TO authenticated
  USING ( public.is_active_member(business_id) );

-- ── MEMBER WRITE: settings:update. Verb-split (the 20260727 flip convention) rather than
--    a FOR ALL policy — the un-flipped `business_pmi_schedule_member_all` is precisely the
--    hole this build reported (a STAFF member can write the PMI schedule), and repeating
--    its shape on a new table would be adding to a known defect knowingly. ──
CREATE POLICY business_operating_days_member_insert ON business_operating_days
  FOR INSERT TO authenticated
  WITH CHECK ( public.is_active_member(business_id)
               AND public.has_permission(business_id, 'settings:update') );

CREATE POLICY business_operating_days_member_update ON business_operating_days
  FOR UPDATE TO authenticated
  USING      ( public.is_active_member(business_id)
               AND public.has_permission(business_id, 'settings:update') )
  WITH CHECK ( public.is_active_member(business_id)
               AND public.has_permission(business_id, 'settings:update') );

CREATE POLICY business_operating_days_member_delete ON business_operating_days
  FOR DELETE TO authenticated
  USING ( public.is_active_member(business_id)
          AND public.has_permission(business_id, 'settings:update') );

DROP TRIGGER IF EXISTS business_operating_days_updated_at ON business_operating_days;
CREATE TRIGGER business_operating_days_updated_at
  BEFORE UPDATE ON business_operating_days
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

-- ⚠️ NO SEED ROW, DELIBERATELY. Lauren's pattern (Mon service · Tue-Wed delivery only ·
-- Thu-Sun delivery/placement) is HER TENANT'S DATA, not a platform default. Seeding it
-- would put a tenant literal in a migration (AC-1 / HARDCODED-REGISTER), and seeding a
-- generic default would make every business silently agree with a guess — the same
-- argument seedPricingConfig makes for leaving taxRate null. A business with no rules
-- reads "no day types set" and nothing is flagged, which is the honest state until
-- someone answers.

-- ============================================================
-- END OF MIGRATION
-- Verify after applying (catalog gate — structure AND RLS, both required by §9):
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='business_operating_days' ORDER BY ordinal_position;
--   -- Expected 8 rows: id, business_id, weekday, on_date, day_type, note, created_at, updated_at
--
--   SELECT policyname, cmd, qual, with_check FROM pg_policies
--    WHERE schemaname='public' AND tablename='business_operating_days' ORDER BY policyname;
--   -- Expected 5: owner_all(ALL) · member_select(SELECT) · member_insert(INSERT)
--   --             · member_update(UPDATE) · member_delete(DELETE)
--
--   SELECT relrowsecurity FROM pg_class WHERE relname='business_operating_days';
--   -- Expected: t
--
--   -- §6 r17 privilege fingerprint — proves it came through the migration path, not the
--   -- dashboard table editor (which would grant TRUNCATE/REFERENCES to anon):
--   SELECT grantee, privilege_type FROM (
--     SELECT (aclexplode(relacl)).grantee::regrole::text AS grantee,
--            (aclexplode(relacl)).privilege_type
--       FROM pg_class WHERE relname='business_operating_days') x
--    WHERE grantee='anon';
--   -- Expected: NO 'TRUNCATE' and NO 'REFERENCES' row.
-- ============================================================
