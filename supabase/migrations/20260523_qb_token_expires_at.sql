ALTER TABLE nurseries
  ADD COLUMN IF NOT EXISTS qb_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS qb_needs_reconnect  boolean NOT NULL DEFAULT false;
