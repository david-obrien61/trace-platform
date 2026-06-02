-- Migration: shared multi-tenant member tables
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Run in Supabase SQL editor → bgobkjcopcxusjsetfob project
-- Branch: multi-tenant-extraction
-- Date: 2026-06-02
--
-- This migration creates three vertical-agnostic tables that replace
-- Ignition OS's shop_members, shop_invites, teams, member_devices, and
-- pin_resets. The new tables belong to the businesses anchor (not shops),
-- use real Supabase auth.users for members (not PIN-only), and have
-- properly scoped RLS from day one.
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.

-- ============================================================
-- TABLE: business_members
-- One row per person who belongs to a business.
-- active=false: invited, not yet enrolled
-- active=true:  enrolled (has accepted invite, has user_id set)
-- ============================================================

CREATE TABLE IF NOT EXISTS business_members (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  -- null until invite is accepted; set on enrollment
  name          text        NOT NULL,
  email         text,
  -- email for invite delivery; null for SMS-only invites
  phone         text,
  -- phone for SMS invite delivery
  role          text        NOT NULL,
  -- vertical defines role semantics: OWNER, ADMIN, STAFF, etc.
  -- stored as free-form string, not enum — each vertical names its own roles
  permissions   jsonb       NOT NULL DEFAULT '[]'::jsonb,
  -- array of permission string IDs; vertical defines what each means
  active        boolean     NOT NULL DEFAULT false,
  invite_id     uuid,
  -- back-reference to invitations.id; set when invite creates member row
  -- FK added below after invitations table exists
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE business_members ENABLE ROW LEVEL SECURITY;

-- Business owner has full control over all members
CREATE POLICY bm_owner_all ON business_members
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- Any enrolled member can read their own row (role/permissions)
CREATE POLICY bm_self_select ON business_members
  FOR SELECT USING (user_id = auth.uid());

-- Enrolled member can update their own row (e.g. name, phone)
CREATE POLICY bm_self_update ON business_members
  FOR UPDATE USING (user_id = auth.uid());

-- Auto-stamp updated_at on every UPDATE
CREATE OR REPLACE FUNCTION set_business_members_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_members_updated_at
  BEFORE UPDATE ON business_members
  FOR EACH ROW EXECUTE FUNCTION set_business_members_updated_at();

-- ============================================================
-- TABLE: invitations
-- Single-use tokens for inviting new members to a business.
-- Each token has a 7-day expiry. Accepted invites set used=true
-- and link to the created/updated business_members row.
-- ============================================================

CREATE TABLE IF NOT EXISTS invitations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token         text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  -- 64-char hex token; unique index enforced by UNIQUE constraint
  business_id   uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  -- name of the person being invited (pre-filled in JoinFlow)
  email         text,
  -- where to send the invite email; null for QR/SMS-only invites
  phone         text,
  -- for SMS delivery of the invite link
  role          text        NOT NULL,
  used          boolean     NOT NULL DEFAULT false,
  -- false=available, true=claimed or cancelled
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

-- Only the business owner can create, read, and cancel invitations
CREATE POLICY inv_owner_all ON invitations
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- ============================================================
-- Back-reference FK: business_members.invite_id → invitations.id
-- Added after both tables exist to avoid forward-reference issues.
-- ============================================================

ALTER TABLE business_members
  ADD CONSTRAINT fk_business_members_invite_id
  FOREIGN KEY (invite_id) REFERENCES invitations(id) ON DELETE SET NULL;

-- ============================================================
-- TABLE: member_devices
-- Per-device enrollment tracking. A member can enroll on multiple
-- devices (phone + tablet). Each device gets its own row. Admin
-- can disable lost/stolen devices. Future-ready for WebAuthn/biometric.
-- ============================================================

CREATE TABLE IF NOT EXISTS member_devices (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           uuid        NOT NULL REFERENCES business_members(id) ON DELETE CASCADE,
  business_id         uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  -- denormalized for efficient RLS — avoids join through business_members
  device_label        text,
  -- human-readable: "Lauren's iPhone", "Shop Tablet"
  device_fingerprint  text,
  -- browser/device fingerprint string; implementation detail for the vertical
  biometric_enrolled  boolean     NOT NULL DEFAULT false,
  is_active           boolean     NOT NULL DEFAULT true,
  last_seen           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE member_devices ENABLE ROW LEVEL SECURITY;

-- Business owner sees and manages all devices in their business
CREATE POLICY md_owner_all ON member_devices
  FOR ALL USING (
    business_id IN (
      SELECT id FROM businesses WHERE owner_id = auth.uid()
    )
  );

-- A member manages their own devices
-- (reads business_members which is safe: member can see their own bm row via bm_self_select)
CREATE POLICY md_self ON member_devices
  FOR ALL USING (
    member_id IN (
      SELECT id FROM business_members WHERE user_id = auth.uid()
    )
  );
