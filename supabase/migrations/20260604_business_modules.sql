-- Migration: business_modules — reshape module enablement to vertical-agnostic table
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Run in Supabase SQL editor → bgobkjcopcxusjsetfob project
-- Date: 2026-06-04
--
-- WHAT THIS DOES
-- Creates business_modules, migrates all rows from nursery_modules,
-- applies membership-scoped RLS, and leaves nursery_modules intact for
-- verification. The DROP of nursery_modules is a SEPARATE STEP — do NOT
-- run it until the verification queries below confirm counts match.
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
--
-- AC-1: zero vertical nouns in table, columns, keys, or policy names.
-- AC-2: RLS scoped to business_members membership, not loose USING(true).

-- ============================================================
-- PART 1: CREATE TABLE
-- ============================================================

CREATE TABLE IF NOT EXISTS business_modules (
  business_id  uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  module_key   text        NOT NULL,
  enabled      boolean     NOT NULL DEFAULT false,
  configured   boolean     NOT NULL DEFAULT false,
  config       jsonb       NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (business_id, module_key)
);

-- updated_at trigger — fires on every UPDATE (upsert included)
CREATE OR REPLACE FUNCTION set_updated_at_generic()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER business_modules_updated_at
  BEFORE UPDATE ON business_modules
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

-- ============================================================
-- PART 2: DATA MIGRATION — pivot from nursery_modules
--
-- nursery_modules is already row-per-(business_id, module_key),
-- so this is an INSERT SELECT, not a wide-to-narrow pivot.
-- created_at is preserved from the original row.
-- updated_at is set to now() (column is new; no historical value).
-- ============================================================

INSERT INTO business_modules (business_id, module_key, enabled, configured, config, created_at, updated_at)
SELECT
  business_id,
  module_key,
  COALESCE(enabled,    false),
  COALESCE(configured, false),
  COALESCE(config,     '{}'),
  created_at,
  now()
FROM nursery_modules
ON CONFLICT (business_id, module_key) DO NOTHING;

-- ============================================================
-- PART 3: VERIFICATION — run these queries after INSERT.
-- DO NOT drop nursery_modules until both counts match
-- and the per-module check below returns zero differences.
-- ============================================================

-- Total row count must match:
-- SELECT COUNT(*) FROM nursery_modules;           -- expected: 10
-- SELECT COUNT(*) FROM business_modules;          -- expected: 10

-- Per-module check for LAWNS (a1b2c3d4-0000-0000-0000-000000000001):
-- SELECT module_key, enabled, configured, config
-- FROM business_modules
-- WHERE business_id = 'a1b2c3d4-0000-0000-0000-000000000001'
-- ORDER BY module_key;
--
-- Expected rows (ground truth from live nursery_modules 2026-06-04):
--   business_insights | false | false | {}
--   contractor_tiers  | false | false | {}
--   delivery_routing  | false | false | {}
--   followup_engine   | false | false | {}
--   inventory_intake  | false | false | {}
--   online_shop       | false | false | {}
--   qb_invoicing      | true  | true  | {}
--   qr_checkout       | true  | true  | {}
--   seasonal_module   | false | false | {}
--   social_media      | true  | true  | {"blotato_account_id":"269df7e1-351d-4add-9111-3d42564b1fc6"}

-- Diff check — should return 0 rows if migration is complete:
-- SELECT nm.module_key, nm.enabled AS nm_enabled, bm.enabled AS bm_enabled
-- FROM nursery_modules nm
-- LEFT JOIN business_modules bm USING (business_id, module_key)
-- WHERE nm.enabled IS DISTINCT FROM bm.enabled
--    OR nm.configured IS DISTINCT FROM bm.configured;

-- ============================================================
-- PART 4: RLS — membership-scoped (AC-2 compliant)
--
-- A user may read/write a business_modules row if they are an
-- active member of that business via business_members.
-- Covers owners (role=OWNER, active=true) and enrolled members.
-- This is defense-in-depth behind the client-side BusinessProvider
-- business_type filter (commit 8792c71).
-- ============================================================

ALTER TABLE business_modules ENABLE ROW LEVEL SECURITY;

CREATE POLICY business_modules_member_access ON business_modules FOR ALL
  USING (
    business_id IN (
      SELECT business_id
      FROM business_members
      WHERE user_id = auth.uid()
        AND active = true
    )
  );

-- ============================================================
-- PART 5: DROP nursery_modules (SEPARATE STEP — GATED)
--
-- Run ONLY after the verification queries above confirm:
--   1. COUNT(*) matches (10 = 10)
--   2. Diff check returns 0 rows
--   3. Dashboard loads correctly with business_modules
--
-- When ready, run this in a separate SQL execution:
--
-- DROP TABLE nursery_modules CASCADE;
--
-- CASCADE will also drop:
--   - The nursery_modules_business_owner RLS policy
--   - The nursery_modules_business_module_key unique index
-- ============================================================
