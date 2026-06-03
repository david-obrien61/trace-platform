-- Migration: add pin_hash to business_members
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Run in Supabase SQL editor → bgobkjcopcxusjsetfob project
-- Branch: multi-tenant-extraction
-- Date: 2026-06-03
--
-- PIN is the platform-wide gesture layer standard. business_members needs
-- a pin_hash column so PIN-based daily access works for Cultivar OS and any
-- future vertical using the shared member table.
--
-- Hash algorithm: SHA-256 of "{business_id}:{pin}" — same pattern as
-- Ignition's shop_members (see packages/shared/src/supabase/auth.ts hashPin).
-- The business_id is used (not member_devices entity), so the hash is tied
-- to the business context the member is operating in.
--
-- pin_hash is nullable. NULL = member has not set up PIN yet. OwnerSignup
-- sets it during Step 2. Staff members get it set when they accept an invite
-- and complete their own PIN setup step.
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.

ALTER TABLE business_members
  ADD COLUMN IF NOT EXISTS pin_hash text;

-- No constraint on pin_hash — null is valid for members who haven't set PIN.
-- Application enforces non-null for PIN-capable verticals during enrollment.

COMMENT ON COLUMN business_members.pin_hash IS
  'SHA-256 of "{business_id}:{pin}". Null until member completes PIN setup.';
