-- Team system: member registry, invite tokens, PIN reset codes

-- ─── SHOP MEMBERS ─────────────────────────────────────────────────────────────
-- Cloud record for each person who has joined a shop. Used by admin to see all
-- team members across devices and to generate PIN reset codes.
CREATE TABLE IF NOT EXISTS shop_members (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  role       text        NOT NULL,
  phone      text,
  permissions jsonb      DEFAULT '[]'::jsonb,
  joined_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_members_shop_idx  ON shop_members(shop_id);
CREATE INDEX IF NOT EXISTS shop_members_name_idx  ON shop_members(shop_id, name);

ALTER TABLE shop_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_members" ON shop_members;
CREATE POLICY "pilot_all_members" ON shop_members FOR ALL USING (true);

-- ─── SHOP INVITES ─────────────────────────────────────────────────────────────
-- Single-use tokens. Admin generates invite → gets URL with token → staff opens
-- URL → JoinFlow pre-fills name/role from this record → marks used on join.
CREATE TABLE IF NOT EXISTS shop_invites (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text        NOT NULL UNIQUE,
  shop_id    uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  role       text        NOT NULL,
  phone      text,
  used       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS shop_invites_token_idx   ON shop_invites(token);
CREATE INDEX IF NOT EXISTS shop_invites_shop_idx    ON shop_invites(shop_id);

ALTER TABLE shop_invites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_invites" ON shop_invites;
CREATE POLICY "pilot_all_invites" ON shop_invites FOR ALL USING (true);

-- ─── PIN RESETS ───────────────────────────────────────────────────────────────
-- Admin clicks "Reset PIN" for a team member → 6-digit code stored here →
-- admin reads code aloud → staff enters code in Forgot PIN screen →
-- new profile created in localStorage → reset marked used.
CREATE TABLE IF NOT EXISTS pin_resets (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_code  text        NOT NULL,
  shop_id     uuid        NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  member_name text        NOT NULL,
  member_role text        NOT NULL,
  permissions jsonb       DEFAULT '[]'::jsonb,
  used        boolean     NOT NULL DEFAULT false,
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pin_resets_code_idx  ON pin_resets(reset_code);
CREATE INDEX IF NOT EXISTS pin_resets_shop_idx  ON pin_resets(shop_id);

ALTER TABLE pin_resets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilot_all_resets" ON pin_resets;
CREATE POLICY "pilot_all_resets" ON pin_resets FOR ALL USING (true);
