-- Migration: THUNDER FINISH — cultivar_plants policy cleanup
-- Date: 2026-06-13
--
-- Closes the policy chaff left over from the plants → cultivar_plants untangle.
-- The untangle migration (20260613_cultivar_plants_untangle.sql) renamed the table and
-- updated the SELECT policy, but FOUR policies survived on cultivar_plants — two of them
-- redundant/over-broad leftovers carried over from the old `plants` table:
--
--   KEEP    anon_select_plants            anon          SELECT  USING(true)              QR scan resolves a scanned tag
--   KEEP    cultivar_plants_owner_select  authenticated SELECT  owner-or-member scoped   owner/member read
--   REPLACE plants_business_owner         public        ALL     business_id IN (owner)   ⚠️ ONLY policy granting WRITE
--   DROP    plants_select_public          public        SELECT  USING(true)              redundant w/ anon_select_plants
--
-- Two confirmed catches this session:
--   1. plants_business_owner is the ONLY policy granting owners WRITE (the SELECT policies
--      don't). It cannot simply be dropped — it must be REPLACED with a correctly-named,
--      authenticated-scoped ALL policy, or owners lose write access to their own plants.
--   2. The real scan→checkout flow is SERVER-MEDIATED (QBO credentials can't live in an anon
--      browser), so blanket public read (USING true) is not load-bearing for checkout.
--      anon_select_plants stays ONLY so the public plant page can resolve a scanned tag.
--
-- AC-3 compliance: tenant isolation — the public/ALL write-hole shape is eliminated; write is
-- scoped to the owning business (owner_id) or an active member.
--
-- Run in bgobkjcopcxusjsetfob SQL editor. Verify with the queries at the bottom of this file.

-- ── STEP 1: Drop redundant public-read policy ────────────────────────────────
-- anon_select_plants (USING true) already covers public read of plant identity for the QR page.
-- plants_select_public is a duplicate of that grant on the `public` role — pure redundancy.

DROP POLICY IF EXISTS "plants_select_public" ON cultivar_plants;

-- ── STEP 2: Replace the owner write path ─────────────────────────────────────
-- Create the correctly-named, authenticated-scoped ALL policy FIRST, then drop the
-- public/ALL leftover it replaces. Predicate matches cultivar_plants_owner_select
-- (owner via businesses.owner_id OR active business_members row).

CREATE POLICY "cultivar_plants_owner_all"
  ON cultivar_plants
  FOR ALL
  TO authenticated
  USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = cultivar_plants.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  )
  WITH CHECK (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = cultivar_plants.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  );

DROP POLICY IF EXISTS "plants_business_owner" ON cultivar_plants;

-- ── STEP 3: Leave the two keepers untouched ──────────────────────────────────
-- anon_select_plants            (anon, SELECT, USING true) — public QR-page tag resolution
-- cultivar_plants_owner_select  (authenticated, SELECT)    — owner/member read
-- NOTE for David: anon_select_plants USING(true) exposes ALL plant-identity rows to anon,
-- not just a scanned one. Acceptable for non-sensitive plant identity + a server-mediated
-- checkout, but logged as tech debt — if tighter per-tag scoping is wanted later, that's a
-- separate change. Do NOT change it here.

-- ─────────────────────────────────────────────────────────────────────────────
-- POST-RUN VERIFICATION QUERIES (run these in the Supabase SQL editor)
-- ─────────────────────────────────────────────────────────────────────────────

-- V1: Exactly THREE policies remain, with the right role/cmd; leftovers GONE.
-- SELECT polname, polcmd,
--        CASE WHEN polroles = '{0}'::oid[] THEN 'public'
--             ELSE array_to_string(ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(polroles)), ',')
--        END AS roles
-- FROM pg_policy
-- WHERE polrelid = 'public.cultivar_plants'::regclass
-- ORDER BY polname;
-- EXPECTED — exactly 3 rows:
--   anon_select_plants            | r (SELECT) | anon
--   cultivar_plants_owner_all     | * (ALL)    | authenticated
--   cultivar_plants_owner_select  | r (SELECT) | authenticated
-- ABSENT: plants_business_owner, plants_select_public

-- V2: No public/ALL policy remains (the write-hole shape is eliminated).
-- SELECT count(*) AS public_all_policies
-- FROM pg_policy
-- WHERE polrelid = 'public.cultivar_plants'::regclass
--   AND polcmd = '*'
--   AND polroles = '{0}'::oid[];
-- EXPECTED: 0

-- V3: RLS still enabled on the table.
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relname = 'cultivar_plants'
--   AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public');
-- EXPECTED: relrowsecurity = true
