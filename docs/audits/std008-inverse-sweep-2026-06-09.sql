-- STD-008 INVERSE SWEEP — bgobkjcopcxusjsetfob (cultivar-os live DB)
-- 2026-06-09
--
-- PURPOSE: Find any live DB object (CHECK constraint, trigger, RLS policy,
-- index) that exists in the live schema but has NO corresponding committed
-- migration. This is the INVERSE direction of STD-008.
--
-- HOW TO RUN: Paste into Supabase SQL editor at:
-- https://supabase.com/dashboard/project/bgobkjcopcxusjsetfob/sql/new
--
-- KNOWN CONFIRMED FINDING (already fixed this session):
--   social_drafts_platform_check — hand-applied pre-migration era.
--   Fixed by: supabase/migrations/20260609_social_drafts_platform_check.sql
--   After applying that migration, this constraint will appear in the results
--   but IS now migration-controlled.
--
-- HOW TO AUDIT RESULTS:
-- For each row returned, grep the migration files:
--   grep -r "<constraint_name or trigger_name or policy_name>" supabase/migrations/
-- If no result: undocumented live object → log to Tech Debt.
-- If found: documented ✅.

-- ─── QUERY 1: All CHECK constraints on public tables ─────────────────────────

SELECT
  tc.table_name,
  tc.constraint_name,
  cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc
  ON tc.constraint_name = cc.constraint_name
  AND tc.constraint_schema = cc.constraint_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type = 'CHECK'
ORDER BY tc.table_name, tc.constraint_name;

-- Expected documented constraints (from committed migrations):
--   social_drafts_platform_check  (after applying 20260609 migration)
--   social_drafts_status_check    (20260608_social_drafts_subject_ref.sql or prior)
--   business_modules pkey, etc.   (standard PKs — not usually named as CHECK)
-- Any constraint NOT in this list that appears in migrations: ✅ documented.
-- Any constraint that appears here but has no migration: ⚠️ log to Tech Debt.

-- ─── QUERY 2: All triggers on public tables ───────────────────────────────────

SELECT
  event_object_table AS table_name,
  trigger_name,
  event_manipulation,
  action_timing,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Expected documented triggers (from committed migrations):
--   trg_business_members_updated_at  (20260602_shared_members_a_create_tables.sql)
--   business_modules_updated_at      (20260604_business_modules.sql)
-- Any trigger not in committed migrations: ⚠️ log to Tech Debt.

-- ─── QUERY 3: All RLS policies on public tables ──────────────────────────────

SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Key tables to check for undocumented policies:
--   nurseries, plants, plant_events, addons, losses  (pre-migration era tables)
--   orders, order_items, order_addons                (added May 2026)
--   social_drafts                                    (added May 2026)
--   business_modules, business_members, businesses   (2026-06 migrations)
-- Cross-reference against supabase/migrations/ — if a policy appears here
-- but not in any migration: ⚠️ hand-applied, log to Tech Debt.

-- ─── QUERY 4: All non-system indexes on public tables ────────────────────────

SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'      -- primary keys are implicit
ORDER BY tablename, indexname;

-- Any unique index that is NOT a pkey and has no corresponding migration:
-- ⚠️ log to Tech Debt if hand-applied.
