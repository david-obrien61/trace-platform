-- ═══════════════════════════════════════════════════════════════════════════
-- IGNITION OS — Live DB Verification Queries
-- Project: ufsgqckbxdtwviqjjtos (Ignition OS Supabase project)
-- Date: 2026-06-09
-- Purpose: Resolve TD#27 (10 tables flagged as "NO migration found"),
--          confirm STD-008 inverse gaps, and validate the margin/estimate
--          chain before the Margin Engine port (TD#16 / build step 6).
-- References: CLAUDE.md Tech Debt #23, #24, #25, #27
--             docs/audits/ignition-reality-audit-2026-06-09.md §3.5
-- Run: Supabase Dashboard → ufsgqckbxdtwviqjjtos → SQL Editor
-- ═══════════════════════════════════════════════════════════════════════════

-- HOW TO USE THIS FILE:
-- Run each numbered query block separately. Copy the result table and paste
-- it back to Claude. Claude will reconcile against the committed migrations
-- and the reality audit to produce an updated TD#27 and built-inventory entry.
-- Each query is READ-ONLY (SELECT only — nothing will be modified).

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY 1: Every table that actually exists in the live Ignition DB
-- ═══════════════════════════════════════════════════════════════════════════
-- PURPOSE: Ground truth for TD#27. The reality audit inferred tables from
-- code and flagged ~10 as "NO migration found / exist vs phantom unknown."
-- This query settles it: a table is either here or it isn't.
--
-- WHAT TO LOOK FOR:
--   ✓ PRESENT: table exists in the live DB (may or may not have a migration)
--   ✗ ABSENT:  code writes to a table that doesn't exist → silent write
--              failure bug (same class as the social_drafts-insert failure)
--
-- EXPECTED present (from committed migration files):
--   shops, businesses, shop_members, customers, customer_vehicles, jobs,
--   evaluations, dtc_codes, eval_photos, labor_entries, estimates,
--   estimate_line_items, invoices, invoice_line_items, inventory, bays,
--   tool_signout_log, repair_logs, customer_authorizations, concept_aliases,
--   error_events, feature_events, monitoring_alerts
--
-- UNCERTAIN (no committed migration found — may exist hand-applied or be phantom):
--   tools, purchase_orders, pmi_schedules, ai_usage, tech_hours
--
-- DROPPED (migration 20260602 dropped them; 20260603 recreated shop_members):
--   teams, member_devices, pin_resets, shop_invites
--   → shop_members: should be PRESENT (recreated by 20260603_recreate_shop_members.sql)
--   → the others: should be ABSENT (dropped, not recreated = BROKEN sub-flows)

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY 2: STD-008 inverse sweep — CHECK constraints
-- ═══════════════════════════════════════════════════════════════════════════
-- PURPOSE: Find CHECK constraints that exist in the live DB but have no
-- corresponding committed migration. This is the same class of gap that
-- caused the social_drafts_platform_check rollback in Cultivar (TD#22).
-- The reality audit found the Cultivar gap; this sweeps Ignition.
--
-- WHAT TO LOOK FOR:
--   Any constraint whose name does not match a constraint created in a
--   committed migration → hand-applied → STD-008 inverse gap.
--   Cross-reference: grep -r <constraint_name> packages/ignition-os/supabase/migrations/
--
-- KNOWN EXPECTED constraints (from committed migration files):
--   shops.tier check: ('TRIAL','STARTER','PROFESSIONAL','PREMIER')
--   jobs.status check: various workflow status values
--   concept_aliases.status check: ('PENDING','ACTIVE','REJECTED')
--   Constraint names vary — compare pg_get_constraintdef output to migration files.

SELECT
    conrelid::regclass AS table_name,
    conname            AS constraint_name,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE connamespace = 'public'::regnamespace
  AND contype = 'c'
ORDER BY table_name, constraint_name;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY 3: STD-008 inverse sweep — triggers
-- ═══════════════════════════════════════════════════════════════════════════
-- PURPOSE: Find triggers that exist in the live DB but have no committed
-- migration. Triggers are invisible to code review.
--
-- KNOWN documented triggers (from committed migrations):
--   trg_business_members_updated_at (Cultivar-side — on business_members)
--   business_modules_updated_at     (Cultivar-side — on business_modules)
--   Ignition side: check for any updated_at auto-stamp triggers on shops,
--   shop_members, jobs, or other tables.

SELECT
    event_object_table  AS table_name,
    trigger_name,
    action_timing,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY table_name, trigger_name;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY 4: STD-008 inverse sweep — RLS policies
-- ═══════════════════════════════════════════════════════════════════════════
-- PURPOSE: Find RLS policies that exist live but have no committed migration.
-- The reality audit (§3.5) noted Ignition uses "pilot open" RLS (USING true)
-- across most tables — expected. Any policy NOT matching that pattern or not
-- traceable to a migration → hand-applied → STD-008 gap.
--
-- WHAT TO LOOK FOR:
--   Policy names matching "pilot_all" → expected, from pilot RLS migrations.
--   Any non-pilot policy on a table with no RLS migration → flag it.
--   Tables with RLS enabled but NO policy → reads return 0 rows (the
--   bug pattern from modules/nursery_modules, May 22, and orders, May 27).

SELECT
    schemaname,
    tablename,
    policyname,
    cmd,
    qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY 5: STD-008 inverse sweep — non-pkey indexes
-- ═══════════════════════════════════════════════════════════════════════════
-- PURPOSE: Find indexes that exist live but have no committed migration.
-- Hand-applied indexes are invisible to code review.
--
-- EXPECTED indexes (from committed migrations — most use CREATE INDEX IF NOT EXISTS):
--   concept_aliases_concept_idx, concept_aliases_status_idx
--   error_events_shop_id_idx, error_events_type_idx, error_events_created_idx
--   feature_events_shop_id_idx, feature_events_module_idx, feature_events_created_idx
--   monitoring_alerts_actioned_idx, monitoring_alerts_shop_id_idx,
--   monitoring_alerts_created_idx, monitoring_alerts_type_idx
-- Anything not in this list from other tables → cross-check against migrations.

SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname NOT LIKE '%_pkey'
ORDER BY tablename, indexname;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY 6: Confirm the margin/estimate chain tables (port foundation)
-- ═══════════════════════════════════════════════════════════════════════════
-- PURPOSE: The Margin Engine port (TD#16, build step 6) depends on the
-- estimate chain being live in ufsgqckbxdtwviqjjtos. If any table in this
-- chain is absent or has 0 columns, the port is blocked.
-- Resolves the "Presumed ✓" entries from the reality audit §3.5.
--
-- WHAT TO LOOK FOR:
--   col_count = 0  → table absent (LEFT JOIN returned null) → PHANTOM → BLOCKED
--   col_count > 0  → table present → CONFIRMED ✓ → port can proceed
--
-- The margin port chain (in workflow order):
--   jobs → evaluations → estimates / estimate_line_items →
--   invoices / invoice_line_items
-- Supporting: customers, customer_vehicles, labor_entries, inventory

SELECT
    t.table_name,
    CASE WHEN it.table_name IS NULL THEN 'ABSENT ❌' ELSE 'PRESENT ✓' END AS status,
    COALESCE(
        (SELECT count(*)::int
         FROM information_schema.columns c
         WHERE c.table_schema = 'public'
           AND c.table_name = t.table_name),
        0
    ) AS col_count
FROM (
    VALUES
        ('jobs'),
        ('customers'),
        ('customer_vehicles'),
        ('evaluations'),
        ('labor_entries'),
        ('estimates'),
        ('estimate_line_items'),
        ('invoices'),
        ('invoice_line_items'),
        ('inventory'),
        ('repair_logs'),
        ('tool_signout_log'),
        ('tools'),
        ('purchase_orders'),
        ('pmi_schedules')
) AS t(table_name)
LEFT JOIN information_schema.tables it
    ON  it.table_schema = 'public'
    AND it.table_name   = t.table_name
ORDER BY t.table_name;

-- ═══════════════════════════════════════════════════════════════════════════
-- QUERY 7: Spot-check row counts for the core workflow tables
-- ═══════════════════════════════════════════════════════════════════════════
-- PURPOSE: A table that exists but has 0 rows may be unused in practice.
-- Helps distinguish "present and in use" from "present but never written."
-- This is informational — not a STD-008 compliance question.
--
-- NOTE: This query uses dynamic SQL via a CTE trick that works in some
-- Postgres versions. If it errors, skip it — Query 6 covers the essential check.

SELECT 'jobs'              AS table_name, count(*) AS row_count FROM jobs
UNION ALL
SELECT 'customers',          count(*) FROM customers
UNION ALL
SELECT 'evaluations',        count(*) FROM evaluations
UNION ALL
SELECT 'estimates',          count(*) FROM estimates
UNION ALL
SELECT 'invoices',           count(*) FROM invoices
UNION ALL
SELECT 'inventory',          count(*) FROM inventory
UNION ALL
SELECT 'shop_members',       count(*) FROM shop_members
UNION ALL
SELECT 'shops',              count(*) FROM shops
ORDER BY table_name;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF VERIFICATION QUERIES
-- ═══════════════════════════════════════════════════════════════════════════
-- After running all queries, paste the results back to Claude with the
-- query number above each result block. Claude will:
--
--   1. Resolve TD#27: cross-reference Query 1 against the committed
--      migration list; upgrade "Presumed ✓" entries in built-inventory,
--      flag phantom tables as silent-write-failure bugs.
--
--   2. Log TD#23/#27 inverse gaps: any constraint/trigger/policy/index
--      in Queries 2–5 not traceable to a committed migration.
--
--   3. Confirm or block the Margin Engine port: Query 6 result determines
--      if build step 6 can proceed without first writing missing tables.
--
--   4. Update CLAUDE.md Tech Debt and docs/built-inventory.md.
