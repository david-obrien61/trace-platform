-- ============================================================================
-- 20260622_oauth_secrets_relocation_and_cost_wall.sql
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-06-22 · Branch: main
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
--
-- ONE migration, TWO sequenced parts (both authorized by the Gate-3 leak findings,
-- data/grower-scan/cost-wall-leak-scope.md — they intentionally enter the financial-wall
-- + accounting surfaces normally Off-Limits, because Gate-3 proved BOTH leaks live):
--   PART 1 — relocate the QuickBooks OAuth BEARER secrets out of the member-readable
--            businesses row into an owner-only business_accounting_secrets table.
--            (businesses_member_select, applied this session, exposed accounting_token +
--             accounting_refresh_token to active members — worse than the cost leak.)
--   PART 2 — the cost wall: a second canonical primitive has_permission(), compose-gate the
--            7 cost/wage-bearing tables, and decompose the two fused financial-wall policies
--            onto is_active_member() AND has_permission().
--
-- ⚠️  APPLY ORDER (load-bearing):
--      1. 20260621_business_discovery_profiles.sql
--      2. 20260621_financial_wall_phase2.sql        (Part 2 Step C rewrites its 2 policies)
--      3. 20260622_is_active_member_canonical_rls.sql (Part 2 composes is_active_member())
--      4. THIS migration
--   Apply this file AS the default `postgres` role (function ownership is load-bearing for
--   the SECURITY DEFINER RLS bypass — same as is_active_member; do not change the owner).
--
-- ⚠️  DEPLOY ORDER (avoids a token-read gap): deploy the repointed code FIRST. The repointed
--   reader (packages/shared/src/quickbooks/secrets.ts readQBSecrets/writeQBSecrets) reads the
--   secrets table and FALLS BACK to the businesses columns when the table is ABSENT — so it is
--   correct BOTH before this migration (table missing → businesses columns hold the live token)
--   AND after (table present → businesses columns NULL → secrets table authoritative). THEN
--   apply this migration. Mirrors the financialDataAccess fallback pattern (20260621).
--
-- AC-2 (membership-scoped) · AC-3 (tenant isolation — both primitives scope to the caller's
--   own membership only) · AC-4 (permission strings are VALUES, not nouns).
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- PART 1 — QB OAuth bearer secrets → owner-only business_accounting_secrets
-- ════════════════════════════════════════════════════════════════════════════
-- VERIFY-FIRST (recon + read): the six accounting_* columns on businesses are —
--   accounting_token            text  ← BEARER SECRET (grants API access)  → MOVE
--   accounting_refresh_token    text  ← BEARER SECRET (mints new tokens)   → MOVE
--   accounting_company_id       text  ← realm ID; an IDENTIFIER, useless without a token; used
--                                       client-side as the "connected?" boolean              → KEEP
--   accounting_token_expires_at timestamptz ← connection metadata, read client-side (banner)  → KEEP
--   accounting_needs_reconnect  boolean      ← UI flag, read client-side                       → KEEP
--   accounting_type             text         ← provider label ("quickbooks"), read client-side → KEEP
-- Only the two BEARER secrets, if read by a member, grant QuickBooks access — those are the
-- leak. They move to an owner-only table; the realm ID + non-secret state stay (members
-- reading a realm ID / expiry / flag is harmless and keeps every "connected?" check working
-- with ZERO client repoint).

CREATE TABLE IF NOT EXISTS business_accounting_secrets (
  business_id              uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  accounting_token         text,
  accounting_refresh_token text,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE business_accounting_secrets IS
  'QB OAuth bearer secrets (access + refresh token), relocated out of the member-readable businesses row (Gate-3 credential leak, 2026-06-22). OWNER-ONLY RLS — NO member policy. Server code (service key) reads/writes and bypasses RLS. The businesses.accounting_token/refresh_token columns are NULLed here (kept for deploy-window fallback; DROP is the immediate follow-up once owner-proven).';

ALTER TABLE business_accounting_secrets ENABLE ROW LEVEL SECURITY;

-- OWNER-ONLY. No member policy — tokens are an owner/connection concern, never a Staff concern.
CREATE POLICY bas_owner_all ON business_accounting_secrets
  USING      (EXISTS (SELECT 1 FROM businesses
                      WHERE id = business_accounting_secrets.business_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses
                      WHERE id = business_accounting_secrets.business_id AND owner_id = auth.uid()));

DROP TRIGGER IF EXISTS business_accounting_secrets_updated_at ON business_accounting_secrets;
CREATE TRIGGER business_accounting_secrets_updated_at
  BEFORE UPDATE ON business_accounting_secrets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

-- DATA MOVE — copy existing secrets into the owner-only table FIRST (lossless), so no row
-- loses its token mid-migration. Only rows that actually hold a token are copied.
INSERT INTO business_accounting_secrets (business_id, accounting_token, accounting_refresh_token)
SELECT id, accounting_token, accounting_refresh_token
FROM businesses
WHERE accounting_token IS NOT NULL OR accounting_refresh_token IS NOT NULL
ON CONFLICT (business_id) DO NOTHING;

-- EXPOSURE GONE — clear the member-readable copy. After this, businesses_member_select still
-- returns the row, but accounting_token / accounting_refresh_token are NULL → no secret value
-- is member-selectable. The value now lives ONLY in the owner-only table. Columns are KEPT
-- (NULL, not dropped) for the deploy-window fallback + append-only convention; the column DROP
-- is the immediate follow-up migration once the repointed code is owner-proven.
UPDATE businesses
SET accounting_token = NULL,
    accounting_refresh_token = NULL;


-- ════════════════════════════════════════════════════════════════════════════
-- PART 2 — the cost wall
-- ════════════════════════════════════════════════════════════════════════════

-- ── STEP A. has_permission() — the second canonical primitive ───────────────────
-- TRUE iff the caller has an ACTIVE membership in p_business_id whose `permissions` jsonb
-- array contains p_perm. Mirrors is_active_member exactly (SECURITY DEFINER, STABLE,
-- search_path='', fully qualified, owned by postgres → bypasses RLS, recursion-safe) plus the
-- array-element test `permissions ? p_perm` (the confirmed shape: jsonb array of strings,
-- same operator the fused wall used — 20260621:79). EXECUTE granted only to authenticated.
-- NOTE: has_permission already implies active membership (same row), so policies could call it
-- alone — but per David's "membership then permission, composed not fused" doctrine the policies
-- below write is_active_member(X) AND has_permission(X,'perm') for clarity/composition.
CREATE OR REPLACE FUNCTION public.has_permission(p_business_id uuid, p_perm text)
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
      AND permissions ? p_perm
  );
$$;

REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;


-- ── STEP B. Gate the 7 cost/wage-bearing tables (recon §1) ──────────────────────
-- Each member policy: is_active_member(business_id) AND has_permission(business_id,'<perm>').
-- Composed, not fused. Command scope (member_all = FOR ALL) + owner policies are PRESERVED.
-- The 6 membership-only-correct tables (businesses, cultivar_plants, business_modules,
-- business_pmi_schedule, deliveries, business_discovery_profiles) are LEFT ALONE — no financial
-- data (recon §1.B).

-- view_costs ×6 ------------------------------------------------------------------------------
DROP POLICY IF EXISTS cost_objects_member_all ON cost_objects;
CREATE POLICY cost_objects_member_all ON cost_objects
  USING      ( public.is_active_member(cost_objects.business_id)
               AND public.has_permission(cost_objects.business_id, 'view_costs') )
  WITH CHECK ( public.is_active_member(cost_objects.business_id)
               AND public.has_permission(cost_objects.business_id, 'view_costs') );

DROP POLICY IF EXISTS business_inventory_member_all ON business_inventory;
CREATE POLICY business_inventory_member_all ON business_inventory
  USING      ( public.is_active_member(business_inventory.business_id)
               AND public.has_permission(business_inventory.business_id, 'view_costs') )
  WITH CHECK ( public.is_active_member(business_inventory.business_id)
               AND public.has_permission(business_inventory.business_id, 'view_costs') );

DROP POLICY IF EXISTS cost_object_edges_member_all ON cost_object_edges;
CREATE POLICY cost_object_edges_member_all ON cost_object_edges
  USING      ( public.is_active_member(cost_object_edges.business_id)
               AND public.has_permission(cost_object_edges.business_id, 'view_costs') )
  WITH CHECK ( public.is_active_member(cost_object_edges.business_id)
               AND public.has_permission(cost_object_edges.business_id, 'view_costs') );

DROP POLICY IF EXISTS cost_object_assignments_member_all ON cost_object_assignments;
CREATE POLICY cost_object_assignments_member_all ON cost_object_assignments
  USING      ( public.is_active_member(cost_object_assignments.business_id)
               AND public.has_permission(cost_object_assignments.business_id, 'view_costs') )
  WITH CHECK ( public.is_active_member(cost_object_assignments.business_id)
               AND public.has_permission(cost_object_assignments.business_id, 'view_costs') );

DROP POLICY IF EXISTS business_service_log_member_all ON business_service_log;
CREATE POLICY business_service_log_member_all ON business_service_log
  USING      ( public.is_active_member(business_service_log.business_id)
               AND public.has_permission(business_service_log.business_id, 'view_costs') )
  WITH CHECK ( public.is_active_member(business_service_log.business_id)
               AND public.has_permission(business_service_log.business_id, 'view_costs') );

DROP POLICY IF EXISTS receipts_member_all ON receipts;
CREATE POLICY receipts_member_all ON receipts
  USING      ( public.is_active_member(receipts.business_id)
               AND public.has_permission(receipts.business_id, 'view_costs') )
  WITH CHECK ( public.is_active_member(receipts.business_id)
               AND public.has_permission(receipts.business_id, 'view_costs') );

-- view_wages ×1 -----------------------------------------------------------------------------
-- labor_resources: live wage $ already moved to labor_resource_wages (20260621); its own wage
-- columns are now vestigial NULLs but member-readable — gating the table behind view_wages
-- closes that read path. (Dropping the vestigial columns is a noted cleanup follow-up.)
DROP POLICY IF EXISTS labor_resources_member_all ON labor_resources;
CREATE POLICY labor_resources_member_all ON labor_resources
  USING      ( public.is_active_member(labor_resources.business_id)
               AND public.has_permission(labor_resources.business_id, 'view_wages') )
  WITH CHECK ( public.is_active_member(labor_resources.business_id)
               AND public.has_permission(labor_resources.business_id, 'view_wages') );


-- ── STEP C. Decompose the two fused financial-wall policies onto the same primitives ────────
-- Behavior-EQUIVALENT: the fused predicate (active = true AND permissions ? 'X' in one EXISTS,
-- 20260621:75-83 / :129-137) becomes is_active_member(X) AND has_permission(X,'X') — same two
-- conjuncts, same membership row, now composed via the two canonical primitives. Owner policies
-- (lrw_owner_all / bpc_owner_all) are UNTOUCHED.
DROP POLICY IF EXISTS lrw_member_view_wages ON labor_resource_wages;
CREATE POLICY lrw_member_view_wages ON labor_resource_wages
  USING      ( public.is_active_member(labor_resource_wages.business_id)
               AND public.has_permission(labor_resource_wages.business_id, 'view_wages') )
  WITH CHECK ( public.is_active_member(labor_resource_wages.business_id)
               AND public.has_permission(labor_resource_wages.business_id, 'view_wages') );

DROP POLICY IF EXISTS bpc_member_view_pricing ON business_pricing_config;
CREATE POLICY bpc_member_view_pricing ON business_pricing_config
  USING      ( public.is_active_member(business_pricing_config.business_id)
               AND public.has_permission(business_pricing_config.business_id, 'view_pricing_config') )
  WITH CHECK ( public.is_active_member(business_pricing_config.business_id)
               AND public.has_permission(business_pricing_config.business_id, 'view_pricing_config') );

COMMIT;

-- ============================================================================
-- SCHEMA-VERIFICATION GATE (§9) — run AFTER applying (live catalog, PAT, NOT memory).
-- The schema-verification gate is OWED until these pass post-apply.
-- ============================================================================
-- PART 1
--  (P1-A) secrets table exists + columns:
--    SELECT column_name, data_type FROM information_schema.columns
--     WHERE table_schema='public' AND table_name='business_accounting_secrets' ORDER BY 1;
--    Expect: accounting_refresh_token, accounting_token, business_id, created_at, updated_at.
--  (P1-B) owner-only RLS, NO member policy:
--    SELECT policyname, cmd FROM pg_policies
--     WHERE schemaname='public' AND tablename='business_accounting_secrets';
--    Expect exactly bas_owner_all (ALL); rowsecurity = true; no member policy.
--  (P1-C) EXPOSURE GONE — businesses token columns NULL for every row:
--    SELECT count(*) FROM businesses
--     WHERE accounting_token IS NOT NULL OR accounting_refresh_token IS NOT NULL;
--    Expect 0.
--  (P1-D) secrets preserved — every previously-connected business has its tokens in the new table:
--    SELECT count(*) FROM business_accounting_secrets WHERE accounting_token IS NOT NULL;
--    Expect = the count of businesses that were connected before apply.
--  (P1-E) NO secret member-selectable: businesses_member_select returns the row but
--    accounting_token / accounting_refresh_token resolve NULL (confirmed by P1-C).
-- PART 2
--  (P2-A) has_permission present, SECURITY DEFINER, owned by postgres:
--    SELECT p.proname, p.prosecdef, r.rolname AS owner
--     FROM pg_proc p JOIN pg_roles r ON r.oid=p.proowner WHERE p.proname='has_permission';
--  (P2-B) the 7 gated member policies reference BOTH primitives with the right permission:
--    SELECT tablename, policyname, qual FROM pg_policies
--     WHERE schemaname='public' AND policyname IN (
--       'cost_objects_member_all','business_inventory_member_all','cost_object_edges_member_all',
--       'cost_object_assignments_member_all','business_service_log_member_all','receipts_member_all',
--       'labor_resources_member_all') ORDER BY tablename;
--    Expect each qual to contain is_active_member(...) AND has_permission(..., 'view_costs')
--    (labor_resources → 'view_wages').
--  (P2-C) the 2 decomposed wall policies now reference has_permission:
--    SELECT tablename, policyname, qual FROM pg_policies
--     WHERE policyname IN ('lrw_member_view_wages','bpc_member_view_pricing');
--    Expect has_permission(...,'view_wages') / has_permission(...,'view_pricing_config').
--  (P2-D) the 6 membership-only tables UNTOUCHED (still is_active_member-only, no has_permission):
--    SELECT tablename, policyname FROM pg_policies
--     WHERE qual LIKE '%has_permission%'
--     AND tablename IN ('businesses','cultivar_plants','business_modules','business_pmi_schedule',
--                       'deliveries','business_discovery_profiles');
--    Expect 0 rows.
-- ============================================================================
