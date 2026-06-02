-- Migration: drop legacy Ignition team/invitation tables
-- Target project: ufsgqckbxdtwviqjjtos (ignition-os)
-- Run in Supabase SQL editor → ufsgqckbxdtwviqjjtos project
-- Branch: multi-tenant-extraction
-- Date: 2026-06-02
--
-- Drops the old Ignition-specific team tables that are being replaced
-- by the shared business_members, invitations, and member_devices tables
-- in the cultivar-os project (bgobkjcopcxusjsetfob).
--
-- CONFIRMED: user data in these tables is disposable (David confirmed 2026-06-02).
-- The tables and their data can be dropped without backup.
--
-- Drop order matters: dependent tables first (CASCADE handles FKs but
-- explicit order is safer and makes the intent clearer).

-- 1. Drop pin_resets first (references shop_members and shops)
DROP TABLE IF EXISTS pin_resets CASCADE;

-- 2. Drop member_devices (references shop_members and shops)
DROP TABLE IF EXISTS member_devices CASCADE;

-- 3. Drop shop_members (references shop_invites, teams, shops)
--    Must come before shop_invites if invite_id FK exists in shop_members.
DROP TABLE IF EXISTS shop_members CASCADE;

-- 4. Drop shop_invites (references shops)
DROP TABLE IF EXISTS shop_invites CASCADE;

-- 5. Drop teams (references shops)
DROP TABLE IF EXISTS teams CASCADE;

-- Verification query — run after applying this migration.
-- Should return 0 rows for all five table names.
-- SELECT table_name
-- FROM information_schema.tables
-- WHERE table_schema = 'public'
--   AND table_name IN ('pin_resets', 'member_devices', 'shop_members', 'shop_invites', 'teams');
