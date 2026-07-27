-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 0 — RBAC TRANSITION CATALOG READ (2026-07-27)
-- ════════════════════════════════════════════════════════════════════════════════
-- RUN AS: postgres, Supabase SQL editor, project bgobkjcopcxusjsetfob.
-- 100% READ-ONLY. No BEGIN, no writes, nothing to roll back. Safe to run any time.
-- PASTE BACK: all eight outputs. Block A is the one I cannot write BUILD 1 without;
-- the rest close assumptions I would otherwise be guessing at.
--
-- WHY THIS EXISTS: I know what the migration HISTORY says. I do not know what the
-- DATABASE says, and tech-debt #39 records that live schema is not fully in version
-- control. Writing ALTER POLICY against a policy list derived from files is the
-- builder's-memory failure the schema-verification gate exists to prevent.
-- ════════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════════
-- BLOCK A — THE FLIP LIST ⛔ (the blocking one)
-- Every RLS policy whose USING or WITH CHECK mentions a legacy permission string.
-- EXPECT: ~15-30 rows. Any row that does not correspond to a migration file is
-- live-only drift — the most likely thing to break this build.
-- ════════════════════════════════════════════════════════════════════════════════
SELECT tablename,
       policyname,
       cmd,
       roles::text            AS granted_to,
       qual                   AS using_clause,
       with_check             AS with_check_clause
  FROM pg_policies
 WHERE schemaname = 'public'
   AND (COALESCE(qual, '') || ' ' || COALESCE(with_check, '')) ~
       '(view_costs|view_orders|view_customers|view_wages|view_pricing_config|view_margin|manage_orders|manage_settings|manage_deliveries|manage_campaigns|manage_customers|qr_checkout|import_pricing|apply_tax_exempt|view_dashboard|view_reports|process_orders|manage_team)'
 ORDER BY tablename, policyname;


-- ════════════════════════════════════════════════════════════════════════════════
-- BLOCK B — THE FUNCTION GATES (policies are not the only place a string is checked)
-- SECURITY DEFINER RPCs check permissions inside their BODIES — import_write_price,
-- get_business_tax_rate, the funnel. Those flip too, and they are invisible to Block A.
-- EXPECT: a handful of rows. `legacy_strings` names what each one checks.
-- ════════════════════════════════════════════════════════════════════════════════
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef                               AS security_definer,
       p.proconfig::text                         AS config,
       (SELECT string_agg(DISTINCT m[1], ', ')
          FROM regexp_matches(
                 p.prosrc,
                 '(view_costs|view_orders|view_customers|view_wages|view_pricing_config|view_margin|manage_orders|manage_settings|manage_deliveries|manage_campaigns|manage_customers|qr_checkout|import_pricing|apply_tax_exempt|view_dashboard|view_reports)',
                 'g') AS m)                      AS legacy_strings
  FROM pg_proc p
 WHERE p.pronamespace = 'public'::regnamespace
   AND p.prosrc ~ '(view_costs|view_orders|view_customers|view_wages|view_pricing_config|view_margin|manage_orders|manage_settings|manage_deliveries|manage_campaigns|manage_customers|qr_checkout|import_pricing|apply_tax_exempt|view_dashboard|view_reports)'
 ORDER BY p.proname;


-- ════════════════════════════════════════════════════════════════════════════════
-- BLOCK C — OWNER-PATH COVERAGE (so 3b's narrowing cannot lock YOU out)
-- BUILD 3 narrows the member SELECT on business_inventory. If a table's only read
-- path is a member policy, narrowing it blinds the owner too.
-- EXPECT: every gated table shows owner_all >= 1.
-- ════════════════════════════════════════════════════════════════════════════════
SELECT tablename,
       count(*) FILTER (WHERE policyname ~ 'owner')  AS owner_policies,
       count(*) FILTER (WHERE policyname ~ 'member') AS member_policies,
       count(*)                                      AS total_policies,
       string_agg(policyname || ' [' || cmd || ']', ' · ' ORDER BY policyname) AS policies
  FROM pg_policies
 WHERE schemaname = 'public'
 GROUP BY tablename
 ORDER BY tablename;


-- ════════════════════════════════════════════════════════════════════════════════
-- BLOCK D1 — THE ROLE TEMPLATES (floor + any tenant overrides)
-- The grant is computed FROM this, never from my memory of the seed.
-- EXPECT: 3 floor rows (OWNER 12 / MANAGER 9 / STAFF 3), plus any tenant rows.
-- ════════════════════════════════════════════════════════════════════════════════
SELECT COALESCE(business_id::text, '(SYSTEM FLOOR)') AS scope,
       role_key,
       is_system,
       label,
       jsonb_array_length(permissions) AS n,
       permissions
  FROM public.role_definitions
 ORDER BY (business_id IS NOT NULL), role_key;


-- ════════════════════════════════════════════════════════════════════════════════
-- BLOCK D2 — THE MEMBER CENSUS (R-C: the backfill's input and Contract's baseline)
-- Also settles the owner-masking question definitively: `is_owner` must be FALSE for
-- every account you test a non-owner role with, or those cards prove nothing.
-- EXPECT: ~6 rows across ~4 tenants.
-- ════════════════════════════════════════════════════════════════════════════════
SELECT b.name                       AS business,
       bm.business_id,
       bm.id                        AS member_id,
       bm.user_id,
       bm.name                      AS member_name,
       bm.role,
       bm.active,
       (b.owner_id = bm.user_id)    AS is_owner,
       jsonb_array_length(bm.permissions) AS n,
       bm.permissions
  FROM public.business_members bm
  JOIN public.businesses b ON b.id = bm.business_id
 ORDER BY b.name, bm.role, bm.name;


-- ════════════════════════════════════════════════════════════════════════════════
-- BLOCK E — ALIAS LAYER STATE (did #155 actually get applied? I have never seen this)
-- EXPECT if the correction is applied: total 53 · legacy_rows 7 · legacy_sources 7 ·
--        new_rows 46 · new_sources 45.
-- EXPECT if only the layer is applied: total 92 · legacy_rows 46 · legacy_sources 16.
-- Either answer is fine — I just need to know which world we are in before the flip.
-- ════════════════════════════════════════════════════════════════════════════════
SELECT count(*)                                                          AS total,
       count(*)                  FILTER (WHERE from_perm NOT LIKE '%:%') AS legacy_rows,
       count(DISTINCT from_perm) FILTER (WHERE from_perm NOT LIKE '%:%') AS legacy_sources,
       count(*)                  FILTER (WHERE from_perm LIKE '%:%')     AS new_rows,
       count(DISTINCT from_perm) FILTER (WHERE from_perm LIKE '%:%')     AS new_sources
  FROM public.permission_aliases;

-- Which indexes exist — proves whether the wrong one is gone and the right one landed.
-- EXPECT (correction applied): idx_permission_aliases_from ·
--         permission_aliases_legacy_is_rename_only · permission_aliases_pkey.
-- `permission_aliases_one_reverse_target` MUST NOT appear.
SELECT indexname, indexdef
  FROM pg_indexes
 WHERE schemaname = 'public' AND tablename = 'permission_aliases'
 ORDER BY indexname;


-- ════════════════════════════════════════════════════════════════════════════════
-- BLOCK F — business_inventory SHAPE (BUILD 3 / 3b writes a projection over this)
-- The projection must return every column the 24 read sites expect, minus the two it
-- redacts. I need the real column list, not the one I infer from queries.
-- ════════════════════════════════════════════════════════════════════════════════
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'business_inventory'
 ORDER BY ordinal_position;
