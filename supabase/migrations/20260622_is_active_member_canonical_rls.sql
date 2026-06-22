-- Migration: is_active_member() canonical primitive + standardize member-RLS + md_self leak fix
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-06-22
-- Branch: main
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
-- This file SUPERSEDES last session's gated/unapplied draft
-- 20260622_businesses_member_read_rls.sql (removed) — that draft created a
-- businesses-only helper `is_active_business_member`; this migration generalizes it to
-- the ONE canonical primitive `is_active_member` and standardizes the whole member-RLS
-- surface onto it. If the old draft was ever applied, the cleanup in §0 removes its
-- artifacts before the rename lands.
--
-- PREREQ (approved): data/grower-scan/member-rls-consistency-audit.md
--   business_members state column = `active boolean` ONLY (NO `status` column).
--   3 spellings of 1 semantic across RLS:
--     Form A  EXISTS(... AND active = true)                 ×11 tables  (correct)
--     Form B  business_id IN (SELECT ... AND active = true) ×2  tables  (correct, syntax drift)
--     Form C  member_id IN (SELECT id ... )  -- NO active   ×1  (md_self) = LEAK
--
-- WHAT THIS MIGRATION DOES (4 things — see the 4 proofs in the handoff):
--   A. Lands ONE canonical SECURITY DEFINER primitive: is_active_member(p_business_id).
--   B. Adds member-read to `businesses` (closes the staff-resolve bug → unblocks Gate 3),
--      recursion-safe via the SECURITY DEFINER helper.
--   C. Migrates the member-scoped tables onto the primitive (kills Form A/B drift).
--      Behavior-EQUIVALENT — all already filter `active = true`; this removes the
--      EXISTS/IN spelling drift, not the semantics. 12 tables run unconditionally;
--      business_discovery_profiles runs GUARDED (it is live only once 20260621 applies —
--      see §C note + the apply-order requirement below).
--
-- ⚠️  APPLY ORDER: apply 20260621_business_discovery_profiles.sql BEFORE this migration so
--   the guarded discovery block fires. If applied out of order, this migration still
--   succeeds (the guard no-ops) but discovery keeps the inline-EXISTS policy until re-run.
--
-- ── LIVE-CATALOG RECONCILIATION (2026-06-22) ────────────────────────────────────
--   The first apply 42P01'd: relation "business_discovery_profiles" does not exist
--   (whole txn rolled back, nothing applied). ROOT: the table list came from the audit
--   reading migration FILES; a policy in a file does not prove the table is LIVE.
--   Probed the live DB (service key, PostgREST schema cache) for every touched table:
--     EXISTS (12): businesses, receipts, cost_objects, business_inventory,
--             business_pmi_schedule, business_service_log, labor_resources,
--             cost_object_edges, cost_object_assignments, deliveries, business_modules,
--             cultivar_plants  + member_devices  (+ storage.objects = Supabase built-in)
--     NOT YET LIVE: business_discovery_profiles (PGRST205) — its table 20260621 is being
--             applied now; standardized here via a to_regclass GUARD so order can't abort.
--   D. Fixes the md_self active-omission LEAK (the one true behavior change here).
--
-- AC-2 (membership-scoped) · AC-3 (tenant isolation absolute) · AC-4 (value-set, no nouns).
--
-- ⚠️  APPLY NOTE FOR DAVID: run in the Supabase SQL editor as the default `postgres`
--   role so the function is OWNED BY postgres. That ownership is load-bearing — it is
--   what bypasses RLS inside the SECURITY DEFINER function and breaks the
--   businesses → business_members → businesses recursion (see §A). Do not change the owner.
--
-- ── WHY A SECURITY DEFINER HELPER (recursion) ───────────────────────────────────
--   business_members' own policy `bm_owner_all` (FOR ALL,
--   20260602_shared_members_a_create_tables.sql:48-53) sub-queries `businesses`.
--   So a `businesses` member policy that inlined EXISTS(SELECT ... FROM business_members)
--   would mutually recurse:
--       businesses.SELECT → business_members → bm_owner_all → businesses → … (42P17)
--   Postgres OR's all permissive policies on a relation (you can't isolate the
--   non-recursive bm_self_select), so the rewrite would fail for the OWNER too.
--   A SECURITY DEFINER function reads business_members with RLS BYPASSED (function owned
--   by `postgres`; no table has FORCE ROW LEVEL SECURITY — verified), so bm_owner_all is
--   never expanded and the cycle is broken. Same membership semantics as the inline
--   sibling predicate (user_id = auth.uid() AND active = true), recursion-free.
--
--   For the other 13 tables the swap is purely a refactor: the inline EXISTS already only
--   ever matched the caller's own row (it filters user_id = auth.uid()), and the helper
--   filters user_id = auth.uid() too → identical truth value, no behavior change.


-- ── 0. CLEANUP — supersede last session's draft (safe whether or not it was applied) ─
-- The businesses_member_select policy (if the draft was applied) depends on the old
-- helper, so drop the policy first, then the old-named function.
DROP POLICY   IF EXISTS businesses_member_select ON businesses;
DROP FUNCTION IF EXISTS public.is_active_business_member(uuid);


-- ── A. Canonical membership primitive ───────────────────────────────────────────
-- TRUE iff the calling user has an ACTIVE membership in p_business_id.
-- The ONE shared predicate every member-scoped policy now calls.
-- Hardening (Supabase SECURITY DEFINER): SET search_path = '' + fully-qualified
-- public.business_members / auth.uid(); EXECUTE granted only to authenticated; function
-- owned by postgres (ownership bypasses RLS — load-bearing for the businesses recursion).
-- NOTE: uses search_path = '' (audit-recommended, strictly safer) rather than an
-- explicit `public, pg_temp`; both are "explicit search_path", the empty form forces full
-- qualification and leaves no schema-injection surface.
CREATE OR REPLACE FUNCTION public.is_active_member(p_business_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_members
    WHERE business_id = p_business_id
      AND user_id = auth.uid()
      AND active = true
  );
$$;

REVOKE ALL ON FUNCTION public.is_active_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_active_member(uuid) TO authenticated;


-- ── B. businesses member-read (unblocks Gate 3) ─────────────────────────────────
-- SELECT only — members may READ the business they belong to; they may NOT write it
-- (no member INSERT/UPDATE/DELETE policy; owner-only writes stay as-is).
-- businesses_owner_select / _insert / _update are UNTOUCHED — owner OR active member reads.
DROP POLICY IF EXISTS businesses_member_select ON businesses;
CREATE POLICY businesses_member_select ON businesses
  FOR SELECT
  TO authenticated
  USING ( public.is_active_member(id) );


-- ── C. Standardize the 13 member-scoped tables onto the primitive ───────────────
-- Each policy's command scope (FOR ALL / FOR SELECT) and role target are PRESERVED.
-- Owner policies are untouched throughout. Behavior is EQUIVALENT (all already required
-- active = true) — this removes the EXISTS/IN spelling drift, nothing more.

-- C1. Form-A FOR-ALL member_all policies (USING + WITH CHECK, default role) ────────
DROP POLICY IF EXISTS receipts_member_all ON receipts;
CREATE POLICY receipts_member_all ON receipts
  USING      ( public.is_active_member(receipts.business_id) )
  WITH CHECK ( public.is_active_member(receipts.business_id) );

DROP POLICY IF EXISTS cost_objects_member_all ON cost_objects;
CREATE POLICY cost_objects_member_all ON cost_objects
  USING      ( public.is_active_member(cost_objects.business_id) )
  WITH CHECK ( public.is_active_member(cost_objects.business_id) );

DROP POLICY IF EXISTS business_inventory_member_all ON business_inventory;
CREATE POLICY business_inventory_member_all ON business_inventory
  USING      ( public.is_active_member(business_inventory.business_id) )
  WITH CHECK ( public.is_active_member(business_inventory.business_id) );

DROP POLICY IF EXISTS business_pmi_schedule_member_all ON business_pmi_schedule;
CREATE POLICY business_pmi_schedule_member_all ON business_pmi_schedule
  USING      ( public.is_active_member(business_pmi_schedule.business_id) )
  WITH CHECK ( public.is_active_member(business_pmi_schedule.business_id) );

DROP POLICY IF EXISTS business_service_log_member_all ON business_service_log;
CREATE POLICY business_service_log_member_all ON business_service_log
  USING      ( public.is_active_member(business_service_log.business_id) )
  WITH CHECK ( public.is_active_member(business_service_log.business_id) );

DROP POLICY IF EXISTS labor_resources_member_all ON labor_resources;
CREATE POLICY labor_resources_member_all ON labor_resources
  USING      ( public.is_active_member(labor_resources.business_id) )
  WITH CHECK ( public.is_active_member(labor_resources.business_id) );

DROP POLICY IF EXISTS cost_object_edges_member_all ON cost_object_edges;
CREATE POLICY cost_object_edges_member_all ON cost_object_edges
  USING      ( public.is_active_member(cost_object_edges.business_id) )
  WITH CHECK ( public.is_active_member(cost_object_edges.business_id) );

DROP POLICY IF EXISTS cost_object_assignments_member_all ON cost_object_assignments;
CREATE POLICY cost_object_assignments_member_all ON cost_object_assignments
  USING      ( public.is_active_member(cost_object_assignments.business_id) )
  WITH CHECK ( public.is_active_member(cost_object_assignments.business_id) );

-- business_discovery_profiles — GUARDED. Its table (20260621_business_discovery_profiles.sql)
-- is applied in the same batch as this migration (David is applying 20260621 now). To keep
-- this file from aborting if the apply ORDER slips (the first apply already died on a missing
-- 20260621 table), this block is conditional: it standardizes the policy ONLY IF the table is
-- live, and is a silent no-op otherwise. Apply 20260621 FIRST so this runs; if 20260621 is not
-- yet applied, this migration still succeeds and discovery is standardized on the next run.
DO $$
BEGIN
  IF to_regclass('public.business_discovery_profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS business_discovery_profiles_member_all ON business_discovery_profiles;
    CREATE POLICY business_discovery_profiles_member_all ON business_discovery_profiles
      USING      ( public.is_active_member(business_discovery_profiles.business_id) )
      WITH CHECK ( public.is_active_member(business_discovery_profiles.business_id) );
  END IF;
END $$;

DROP POLICY IF EXISTS deliveries_member_all ON deliveries;
CREATE POLICY deliveries_member_all ON deliveries
  USING      ( public.is_active_member(deliveries.business_id) )
  WITH CHECK ( public.is_active_member(deliveries.business_id) );

-- C2. business_modules — Form B (IN), FOR ALL, USING only (NO WITH CHECK — preserved) ─
DROP POLICY IF EXISTS business_modules_member_access ON business_modules;
CREATE POLICY business_modules_member_access ON business_modules
  FOR ALL
  USING ( public.is_active_member(business_modules.business_id) );

-- C3. cultivar_plants — combined owner-OR-member; replace ONLY the member branch ────
-- The owner branch (business_id IN businesses WHERE owner_id = auth.uid()) stays.
-- anon_select_plants (anon, USING true) is NOT touched.
DROP POLICY IF EXISTS "cultivar_plants_owner_select" ON cultivar_plants;
CREATE POLICY "cultivar_plants_owner_select" ON cultivar_plants
  FOR SELECT
  TO authenticated
  USING (
    business_id IN ( SELECT id FROM businesses WHERE owner_id = auth.uid() )
    OR public.is_active_member(cultivar_plants.business_id)
  );

DROP POLICY IF EXISTS "cultivar_plants_owner_all" ON cultivar_plants;
CREATE POLICY "cultivar_plants_owner_all" ON cultivar_plants
  FOR ALL
  TO authenticated
  USING (
    business_id IN ( SELECT id FROM businesses WHERE owner_id = auth.uid() )
    OR public.is_active_member(cultivar_plants.business_id)
  )
  WITH CHECK (
    business_id IN ( SELECT id FROM businesses WHERE owner_id = auth.uid() )
    OR public.is_active_member(cultivar_plants.business_id)
  );

-- C4. storage.objects (receipts bucket) — Form B; member branch only ───────────────
-- The business_id is the path's first folder segment: (split_part(name,'/',1))::uuid.
-- Pass THAT into is_active_member; preserve the bucket_id check + the owner branch.
-- receipts_storage_delete is owner-only (no member branch) → NOT touched.
DROP POLICY IF EXISTS "receipts_storage_insert" ON storage.objects;
CREATE POLICY "receipts_storage_insert" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (
      (split_part(name, '/', 1))::uuid IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
      OR public.is_active_member( (split_part(name, '/', 1))::uuid )
    )
  );

DROP POLICY IF EXISTS "receipts_storage_select" ON storage.objects;
CREATE POLICY "receipts_storage_select" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      (split_part(name, '/', 1))::uuid IN (
        SELECT id FROM businesses WHERE owner_id = auth.uid()
      )
      OR public.is_active_member( (split_part(name, '/', 1))::uuid )
    )
  );


-- ── D. Fix the md_self leak (the one true behavior change) ───────────────────────
-- Self-device scope is member_id-based (the caller's OWN membership rows), NOT
-- business-wide — so we do NOT widen it to is_active_member(business_id) (that would let
-- a member see every device in the business). The narrow correct fix: add AND active = true
-- so a deactivated/invited-not-enrolled member loses access to their own device rows.
-- md_owner_all is untouched.
DROP POLICY IF EXISTS md_self ON member_devices;
CREATE POLICY md_self ON member_devices
  FOR ALL USING (
    member_id IN (
      SELECT id FROM public.business_members
      WHERE user_id = auth.uid()
        AND active = true        -- ⬅ the leak fix (Form C → filters active)
    )
  );


-- ── NOT TOUCHED (recorded as the next hardening item) ───────────────────────────
-- 1. Owner-only operational tables (orders, customers, plants, addons, plant_events,
--    social_drafts, order_items, order_service_selections, order_compliance_records,
--    nursery_profiles, pmi_assets, pmi_service_logs) have NO member policy. Granting
--    Staff member-read is a PRODUCT decision (which roles see what, scoped how, PII?),
--    not a mechanical consistency refactor. They fail CLOSED today (not a leak). Left
--    owner-only. → NEXT hardening pass.
-- 2. Financial wall (20260621_financial_wall_phase2.sql): lrw_member_view_wages and the
--    pricing-config member policy use a COMPOUND predicate
--    (active = true AND permissions ? 'view_wages' / 'view_pricing_config') in one EXISTS.
--    The permission gate is FUSED into the membership check, inseparable — swapping to
--    is_active_member() would drop the permission filter and breach the wall. Off-Limits
--    this session. LEFT AS-IS (not a plain membership predicate).
--
-- ── VERIFICATION (run after applying, catalog-backed; the 3 proofs are in the handoff) ─
--   -- function present, SECURITY DEFINER, owned by postgres:
--   SELECT p.proname, p.prosecdef, r.rolname AS owner
--   FROM pg_proc p JOIN pg_roles r ON r.oid = p.proowner
--   WHERE p.proname = 'is_active_member';
--   -- businesses now has a member SELECT policy:
--   SELECT policyname, cmd FROM pg_policies
--   WHERE schemaname = 'public' AND tablename = 'businesses' ORDER BY policyname;
--   -- every standardized policy now references is_active_member:
--   SELECT schemaname, tablename, policyname FROM pg_policies
--   WHERE qual LIKE '%is_active_member%' OR with_check LIKE '%is_active_member%'
--   ORDER BY tablename, policyname;
--   -- md_self now filters active:
--   SELECT policyname, qual FROM pg_policies
--   WHERE tablename = 'member_devices' AND policyname = 'md_self';
