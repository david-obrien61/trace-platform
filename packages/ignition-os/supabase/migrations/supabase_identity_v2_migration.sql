-- ─────────────────────────────────────────────────────────────────────────────
-- IGNITION OS — Identity & Teams Migration v2
-- Run after: supabase_schema.sql + supabase_team_system_migration.sql
--
-- What this adds:
--   NEW TABLE  teams          — named groups within a shop (Tech Team, Front Office)
--   NEW TABLE  member_devices — per-device enrollment, biometrics, disable/delete
--   ALTER      shop_members   — team_id, sub_role, active, pin_hash, invite_id, updated_at
--   ALTER      pin_resets     — member_id (links reset to live shop_members record)
-- ─────────────────────────────────────────────────────────────────────────────


-- ─── TEAMS ───────────────────────────────────────────────────────────────────
-- Owner/admin creates named teams (e.g. 'Tech Team', 'Front Office').
-- Each team is scoped to a shop. shop_members.team_id references this table.
-- Teams are displayed on the Team tab — one section per team.

CREATE TABLE IF NOT EXISTS teams (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name        text        NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teams_shop_idx ON teams(shop_id);

ALTER TABLE teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_teams" ON teams;
CREATE POLICY "pilot_all_teams" ON teams FOR ALL USING (true);


-- ─── SHOP_MEMBERS — additional columns ───────────────────────────────────────
--
-- team_id    : which team this member belongs to (nullable — not every shop uses teams)
-- sub_role   : tier within role e.g. SR_TECH, BAY_TECH, APPRENTICE (nullable)
-- active     : false until member completes PIN enrollment via invite flow
-- pin_hash   : bcrypt hash stored in cloud — enables PIN verification on any device
--              without re-enrolling. Multi-device support depends on this column.
-- invite_id  : back-reference to the shop_invite that created this member record
-- updated_at : auto-updated on any change — app compares against localStorage
--              timestamp to detect stale cache and re-hydrate from Supabase

ALTER TABLE shop_members
  ADD COLUMN IF NOT EXISTS team_id    uuid        REFERENCES teams(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sub_role   text,
  ADD COLUMN IF NOT EXISTS active     boolean     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pin_hash   text,
  ADD COLUMN IF NOT EXISTS invite_id  uuid        REFERENCES shop_invites(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS shop_members_team_idx   ON shop_members(team_id);
CREATE INDEX IF NOT EXISTS shop_members_active_idx ON shop_members(shop_id, active);
CREATE INDEX IF NOT EXISTS shop_members_invite_idx ON shop_members(invite_id);

-- Auto-stamp updated_at on every row change.
-- Uses set_updated_at() defined in supabase_schema.sql.
DROP TRIGGER IF EXISTS shop_members_updated_at ON shop_members;
CREATE TRIGGER shop_members_updated_at
  BEFORE UPDATE ON shop_members
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─── MEMBER DEVICES ───────────────────────────────────────────────────────────
-- One row per device a member has enrolled on.
--
-- Why per-device and not on shop_members:
--   biometric_enrolled is hardware-bound. Face ID on a personal iPhone is a
--   separate enrollment from Face ID on a shop tablet. A single boolean on
--   shop_members cannot represent three devices independently.
--
-- Disable/delete lifecycle:
--   Active device  → is_active = true  (normal operation)
--   Lost/stolen    → is_active = false (device locked out immediately, row kept)
--   Device found   → is_active = true  (re-enable, no re-enrollment needed)
--   Confirmed gone → DELETE row        (member re-enrolls fresh on replacement device)
--
-- device_fingerprint is set by the client (browser fingerprint or device ID).
-- device_label is set by the member at enrollment ("Connor's iPhone", "Shop Tablet").

CREATE TABLE IF NOT EXISTS member_devices (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id           uuid        NOT NULL REFERENCES shop_members(id) ON DELETE CASCADE,
  shop_id             uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  device_label        text,
  device_fingerprint  text,
  biometric_enrolled  boolean     NOT NULL DEFAULT false,
  is_active           boolean     NOT NULL DEFAULT true,
  last_seen           timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_devices_member_idx ON member_devices(member_id);
CREATE INDEX IF NOT EXISTS member_devices_shop_idx   ON member_devices(shop_id);

ALTER TABLE member_devices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_member_devices" ON member_devices;
CREATE POLICY "pilot_all_member_devices" ON member_devices FOR ALL USING (true);


-- ─── PIN_RESETS — link to live shop_members record ────────────────────────────
-- Previous design: reset code stored a snapshot of name/role/permissions.
-- Problem: if admin changed permissions after the reset was generated, the
--   member would get stale permissions on re-enrollment.
--
-- Fix: member_id links the reset code to the live shop_members row.
-- On redemption, the app pulls current permissions from shop_members
-- rather than from the snapshot columns (member_name, member_role, permissions).
-- Snapshot columns are kept for backwards compatibility and as a fallback
-- if the member_id link is null (pre-migration resets).

ALTER TABLE pin_resets
  ADD COLUMN IF NOT EXISTS member_id uuid REFERENCES shop_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pin_resets_member_idx ON pin_resets(member_id);


-- ─── REFERENCE: full member enrollment flow ───────────────────────────────────
--
-- 1. Owner creates team        → INSERT teams
-- 2. Owner adds staff member   → INSERT shop_members (active=false) +
--                                INSERT shop_invites (token, role, permissions)
--                                shop_members.invite_id = shop_invites.id
-- 3. Member opens QR/SMS link  → app reads shop_invites by token
-- 4. Member sets PIN           → shop_members.pin_hash = bcrypt(PIN)
--                                shop_members.active = true
--                                shop_invites.used = true
-- 5. Member opts into biometrics → INSERT member_devices
--                                  (biometric_enrolled = true/false)
-- 6. Member confirmed          → confirmation screen shows shop name
-- 7. Multi-device login        → verify PIN against shop_members.pin_hash
--                                INSERT member_devices for new device
--                                overwrite localStorage from shop_members record
-- 8. Admin disables device     → member_devices.is_active = false
-- 9. Device found, re-enable   → member_devices.is_active = true
-- 10. Device deleted           → DELETE member_devices row
