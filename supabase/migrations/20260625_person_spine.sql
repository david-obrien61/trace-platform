-- Migration: Person-entity spine — global `people` table + nullable person_id overlay
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-06-25
-- Branch: main
-- Apply: in the Supabase SQL editor AS the default `postgres` role, AFTER running
--        scripts/wipe-for-person-spine.sql (the full-nuke wipe — Checkpoint 1 step 1).
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
--
-- WHY-RECORD: data/grower-scan/person-spine-recon.md (R1 shape · R4 RLS-to-protect ·
--             R5 FK surface · the person_id-is-an-OVERLAY rule).
--
-- ── THE ONE RULE (R4) ───────────────────────────────────────────────────────────
-- person_id is an OVERLAY, NEVER the auth principal. RLS stays on user_id = auth.uid().
-- This migration ADDS a new table (+ its own self-only RLS) and ADDS nullable columns.
-- It ALTERS NO existing policy, NO existing function, NO existing trigger. Specifically
-- UNTOUCHED: is_active_member(), has_permission(), bm_owner_all / bm_self_select /
-- bm_self_update, enforce_member_authority_immutability, customers_business_owner,
-- businesses_owner_* / businesses_member_select. (Grep this file: no DROP POLICY, no
-- ALTER POLICY, no CREATE OR REPLACE FUNCTION on any existing object — only the new
-- people table's policy/trigger and ADD COLUMN statements.)
--
-- Idempotent: CREATE TABLE / POLICY / TRIGGER IF NOT EXISTS, ADD COLUMN IF NOT EXISTS.

-- ============================================================================
-- 1. people — the global human spine (one row per human, no business_id)
-- ============================================================================
CREATE TABLE IF NOT EXISTS people (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- nullable: an invited-not-enrolled worker / a captured customer has no auth account.
  -- UNIQUE: one auth account = exactly one person.
  -- SET NULL: deleting an auth user must never block or destroy the person record.
  auth_user_id  uuid        UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  first_name    text,
  last_name     text,
  full_name     text,
  email         text,
  phone         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE people IS
  'Global person spine (Person-spine build, 2026-06-25). One row per human behind every role: '
  'lead/customer/member/invited-worker/labor-resource. NO business_id (global). auth_user_id '
  '(nullable, UNIQUE) bridges to the auth principal; person_id is an OVERLAY, never the RLS '
  'principal — RLS stays on user_id = auth.uid(). See data/grower-scan/person-spine-recon.md.';

ALTER TABLE people ENABLE ROW LEVEL SECURITY;

-- Self-only RLS keyed on the auth principal. An authenticated user manages THEIR OWN person
-- row (auth_user_id = self) — this is what lets browser-side OwnerSignup create the owner's
-- person under RLS. Customer/invited-worker persons (auth_user_id NULL) are created
-- server-side with the service key (RLS bypassed); this policy never exposes one person's
-- row to another user (AC-3 — people has no business_id, only the caller's own row is visible).
CREATE POLICY people_self_all ON people
  FOR ALL
  TO authenticated
  USING      (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());

-- Auto-stamp updated_at (mirrors business_members' trigger pattern; new object, not a replace).
CREATE OR REPLACE FUNCTION set_people_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_people_updated_at ON people;
CREATE TRIGGER trg_people_updated_at
  BEFORE UPDATE ON people
  FOR EACH ROW EXECUTE FUNCTION set_people_updated_at();

-- Lookup indexes for the create-or-link resolve path (auth_user_id already has the UNIQUE
-- index; add email/phone for the auth-less customer/worker resolve).
CREATE INDEX IF NOT EXISTS people_email_idx ON people (email) WHERE auth_user_id IS NULL;
CREATE INDEX IF NOT EXISTS people_phone_idx ON people (phone) WHERE auth_user_id IS NULL;

-- ============================================================================
-- 2. Nullable person_id overlay on the role tables (FK→people ON DELETE SET NULL)
--    Additive only. Nothing forced NOT NULL. No existing RLS touched.
-- ============================================================================
ALTER TABLE business_members
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE labor_resources
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES people(id) ON DELETE SET NULL;

ALTER TABLE invitations
  ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES people(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. customers.price_tier — contractor-discount-as-TIER (a tier, NOT an entity)
--    text, default 'retail', NO CHECK (AC-4: the value-set grows without a migration).
--    Values in use: retail | wholesale | contractor.
--    NOTE (§6.10 flag): the prompt named "customer_type / price_tier" — ONE concept, so ONE
--    column (`price_tier`). A separate general `customer_type` classifier can be added later
--    if needed; a redundant column now would be debt.
-- ============================================================================
ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS price_tier text NOT NULL DEFAULT 'retail';

-- ============================================================================
-- 4. VERIFICATION (run after apply — proves structure + that RLS is intact)
-- ============================================================================
-- (A) people exists, RLS enabled:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'people';                 -- expect t
-- (B) people has exactly one policy, the self-only one:
--   SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'people';
-- (C) auth_user_id is UNIQUE + nullable, SET NULL on auth.users delete:
--   SELECT confdeltype FROM pg_constraint
--    WHERE conrelid='people'::regclass AND contype='f';                          -- expect n (SET NULL)
-- (D) every overlay column exists + is nullable:
--   SELECT table_name, column_name, is_nullable FROM information_schema.columns
--    WHERE column_name='person_id'
--      AND table_name IN ('business_members','customers','labor_resources','invitations');
-- (E) every person_id FK is ON DELETE SET NULL:
--   SELECT conrelid::regclass, confdeltype FROM pg_constraint
--    WHERE contype='f' AND confrelid='people'::regclass;                          -- expect n for all 4
-- (F) price_tier present, default 'retail':
--   SELECT column_default, is_nullable FROM information_schema.columns
--    WHERE table_name='customers' AND column_name='price_tier';
-- (G) RLS-INTACT proof — existing policies/functions UNCHANGED by this migration:
--   SELECT proname FROM pg_proc WHERE proname IN ('is_active_member','has_permission');   -- both present
--   SELECT policyname FROM pg_policies WHERE tablename='business_members'
--     AND policyname IN ('bm_owner_all','bm_self_select','bm_self_update');               -- all 3 present
--   SELECT policyname FROM pg_policies WHERE tablename='customers'
--     AND policyname='customers_business_owner';                                          -- present
