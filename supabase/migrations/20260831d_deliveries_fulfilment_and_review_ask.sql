-- ============================================================
-- Migration: deliveries — fulfilment stamps + the review-ask record
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Date: 2026-08-31 (verified via `date` — clock not drifted)
--
-- Purpose: give `deliveries` somewhere to say that a stop actually HAPPENED, when it
--          started and finished, and whether the crew asked that customer for a review.
--          Closes the schema half of tech-debt #121 — "nothing can mark a delivery
--          complete" — whose own trigger reads "the first Monday after a real delivery
--          Saturday", i.e. TODAY.
--
-- Why now, in one line: Saturday 2026-08-29 had SEVEN LAWNS stops. Six were made and one
--          was rescheduled, and all seven rows still read `status = 'scheduled'`. The
--          QuickBooks ingest then added NINETEEN more rows in the same state. Lauren's
--          paper sheet is currently the only record of what happened on a real install day.
--
-- Append-only: four ALTER ADD COLUMN, every one NULLABLE with NO DEFAULT, so existing rows
--          are byte-unchanged and nothing is backfilled. NO existing column is altered, no
--          constraint is added or dropped, no policy is touched, no index is created.
--
-- RLS: NOT RE-STATED, DELIBERATELY. `deliveries` already carries `deliveries_owner_all` and
--          `deliveries_member_all` (both FOR ALL, business_id-scoped, from 20260620). A new
--          column on an RLS-enabled table inherits those policies — there is nothing to add,
--          and adding a policy here would create a second opinion about who may write this
--          table. AC-2 is satisfied by the existing pair; AC-3 by their business_id scope.
--
-- ⚠️  APPLY MANUALLY in the Supabase SQL editor — do NOT execute without David's explicit
--     "run it".  GATED / UNAPPLIED until then.
--
-- ⚠️  USE THE SQL EDITOR, NOT THE TABLE EDITOR (§6 r17). A table touched through the table
--     editor is created/altered by `supabase_admin`, whose default ACL grants TRUNCATE and
--     REFERENCES to `anon` — privileges RLS cannot filter. The SQL editor inherits the
--     corrected `postgres` default and is the proven-safe surface.
-- ============================================================
-- Pre-write verify (run these BEFORE applying — expected results in comments):
--
--   -- (a) the table is there and the columns are not:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='deliveries'
--      AND column_name IN ('started_at','completed_at','review_asked_at','review_ask_outcome');
--   -- EXPECT: 0 rows (ABSENT ✅ — this migration adds them)
--
--   -- (b) the measured premise this build rests on — status has ONE value today:
--   SELECT status, count(*) FROM deliveries GROUP BY status ORDER BY 2 DESC;
--   -- EXPECT: exactly one row, `scheduled`. If any other value appears, STOP and re-read
--   --         `deliveryFulfilment.ts` §1 before applying — the vocabulary note is then stale.
-- ============================================================

ALTER TABLE deliveries
  ADD COLUMN started_at   timestamptz,   -- when the crew began this stop
  ADD COLUMN completed_at timestamptz;   -- when they marked it done

-- The pair exists to MEASURE, not to decorate. The capacity model the whole schedule rests on
-- uses one minute per gallon — a figure invented on 2026-08-26 and never measured. These two
-- stamps are what turn it into a measurement, and it has been deferred five times.
--
-- 🔴 EQUAL STAMPS ARE NOT A ZERO-MINUTE STOP. A crew that taps only "done" gets both values at
-- the same instant, which honestly records "we know when it finished, we do not know when it
-- began". `stopMinutes()` returns NULL for that case rather than 0, so an unmeasured stop can
-- never be averaged into the capacity model as a real observation (D-9: absent is not empty).
COMMENT ON COLUMN deliveries.started_at IS
  'Set by the platform when a crew member starts this stop. Never edited by hand. Equal to completed_at when the stop was only marked done — that pair means UNMEASURED, not zero minutes.';
COMMENT ON COLUMN deliveries.completed_at IS
  'Set by the platform when this stop is marked done, in the same write that sets status=fulfilled. Never edited by hand.';

ALTER TABLE deliveries
  ADD COLUMN review_asked_at    timestamptz,  -- when the crew was prompted about a review
  ADD COLUMN review_ask_outcome text;         -- 'shown' | 'skipped'  (AC-4: NO CHECK — see below)

-- 🔴 NO CHECK ON review_ask_outcome, AND NONE ON status EITHER — this is the table's own
-- documented convention, not an oversight. `20260620_deliveries.sql` states it in its header
-- ("AC-4: status is free text with NO CHECK — the value-set grows without a migration"), and
-- `20260715` DROPPED a status CHECK elsewhere for the reason `orderStatus.ts` records: a DB CHECK
-- on a BUSINESS vocabulary is the anti-pattern. The vocabulary is enforced in exactly one place
-- in code — `packages/cultivar-os/src/lib/deliveryFulfilment.ts` — the same way ORDER_STATUSES is.
-- Tech-debt #91 is the cost of the alternative: two CHECKs on adjacent tables that disagreed,
-- one of them refusing a value nothing else knew was illegal.
--
-- 🔴 AND THE THING THIS COLUMN MAY NEVER BECOME: it records THE ASK, never a review received.
-- Google does not report which customer left which review, so the platform cannot know it. A
-- 'received' value here would be a number nobody can know. Asked and skipped only.
COMMENT ON COLUMN deliveries.review_asked_at IS
  'When the review prompt was reached for this stop. Records THE ASK — never that a review was left; Google does not report which customer reviewed.';
COMMENT ON COLUMN deliveries.review_ask_outcome IS
  'shown | skipped. A SKIP is recorded deliberately: an unrecorded skip and a stop nobody reached look identical, and the skip rate is a signal about the JOBS, not about reviews.';

-- ============================================================
-- END OF MIGRATION
--
-- Verify AFTER applying (catalog gate — structure AND policy, per §9):
--
--   -- (1) STRUCTURE: four columns, all nullable, correct types
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='deliveries'
--      AND column_name IN ('started_at','completed_at','review_asked_at','review_ask_outcome')
--    ORDER BY column_name;
--   -- EXPECT 4 rows:
--   --   completed_at       | timestamp with time zone | YES | (null)
--   --   review_ask_outcome | text                     | YES | (null)
--   --   review_asked_at    | timestamp with time zone | YES | (null)
--   --   started_at         | timestamp with time zone | YES | (null)
--
--   -- (2) NOTHING WAS BACKFILLED — every existing row is untouched
--   SELECT count(*) AS total,
--          count(started_at)   AS started,
--          count(completed_at) AS completed,
--          count(review_asked_at) AS asked
--     FROM deliveries;
--   -- EXPECT: total = 28 (9 LAWNS + 19 from the QuickBooks ingest), started/completed/asked = 0
--
--   -- (3) RLS UNCHANGED — the existing pair still stands, and nothing new was added
--   SELECT policyname, cmd FROM pg_policies
--    WHERE schemaname='public' AND tablename='deliveries' ORDER BY policyname;
--   -- EXPECT exactly 2 rows: deliveries_member_all | ALL
--   --                        deliveries_owner_all  | ALL
--
--   -- (4) RLS still ENABLED on the table
--   SELECT relrowsecurity FROM pg_class WHERE relname='deliveries';
--   -- EXPECT: t
--
--   -- (5) §6 r17 FINGERPRINT — this must have gone through the SQL editor, not the table editor
--   SELECT c.relname, pg_get_userbyid(c.relowner) AS owner, a.privilege_type
--     FROM pg_class c
--     CROSS JOIN LATERAL aclexplode(c.relacl) a
--     JOIN pg_roles r ON r.oid = a.grantee
--    WHERE c.relname='deliveries' AND r.rolname='anon';
--   -- EXPECT: no TRUNCATE and no REFERENCES rows for anon.
--   --         (Read relacl via aclexplode — NEVER information_schema.role_table_grants, which
--   --          returns zero rows on a database full of violations.)
-- ============================================================
