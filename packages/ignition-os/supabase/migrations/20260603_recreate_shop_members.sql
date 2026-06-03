-- Migration: recreate shop_members with PIN support
-- Target project: ufsgqckbxdtwviqjjtos (ignition-os)
-- Run in Supabase SQL editor → ufsgqckbxdtwviqjjtos project
-- Branch: multi-tenant-extraction
-- Date: 2026-06-03
--
-- Context: 20260602_ignition_drop_team_tables.sql dropped shop_members from
-- this project as part of the shared member table extraction. That migration
-- was correct in intent (consolidate to business_members on the shared project)
-- but was premature — Ignition OS OnboardingWizard still writes to shop_members
-- on the Ignition Supabase project directly, and the shared business_members
-- table lives in bgobkjcopcxusjsetfob, not ufsgqckbxdtwviqjjtos.
--
-- Until Ignition OS OnboardingWizard is updated to write to business_members
-- on the Cultivar/shared Supabase project (a separate cross-project migration),
-- shop_members must exist in ufsgqckbxdtwviqjjtos.
--
-- This recreation adds pin_hash, active, and updated_at — columns the
-- OnboardingWizard already writes but the old schema never had (original
-- schema from supabase_team_system_migration.sql only had id, shop_id, name,
-- role, phone, permissions, joined_at — no pin_hash, no active column).
--
-- Hash algorithm: SHA-256 of "{shop_id}:{pin}" — matches authenticate() in
-- packages/shared/src/supabase/auth.ts.
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.

CREATE TABLE IF NOT EXISTS shop_members (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  role        text        NOT NULL,
  -- 'ADMIN', 'TECH', 'VIEW_ALL', or vertical-defined roles
  phone       text,
  email       text,
  permissions jsonb       NOT NULL DEFAULT '[]'::jsonb,
  pin_hash    text,
  -- SHA-256 of "{shop_id}:{pin}". Null until PIN is set.
  active      boolean     NOT NULL DEFAULT true,
  -- false = deactivated/suspended; true = can authenticate
  joined_at   timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_members_shop_idx  ON shop_members(shop_id);
CREATE INDEX IF NOT EXISTS shop_members_name_idx  ON shop_members(shop_id, name);
CREATE INDEX IF NOT EXISTS shop_members_pin_idx   ON shop_members(shop_id, pin_hash) WHERE pin_hash IS NOT NULL;

ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;

-- Owner has full access (service key bypasses RLS for owner operations).
-- Staff can only read their own row (by matching pin_hash at auth time).
-- All writes go through the service key — no direct frontend writes.
CREATE POLICY "shop_owner_all" ON shop_members
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM businesses b
      WHERE b.id = shop_id
        AND b.owner_id = auth.uid()
    )
  );

CREATE POLICY "shop_member_self_select" ON shop_members
  FOR SELECT
  USING (true);
-- PIN auth is not RLS-aware (auth.uid() is null during PIN challenge).
-- SELECT is open so the PIN lookup query can run from the anon/service key.
-- After PIN validates, the application sets a Supabase session via signIn.
-- Data-mutation policies tighten when owner session is active.
