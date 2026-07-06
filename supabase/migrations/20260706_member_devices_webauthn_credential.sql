-- ============================================================
-- member_devices — WebAuthn / face-unlock credential home (GATED — David applies)
-- ------------------------------------------------------------
-- WHY: Build 2 of the device sequence — real biometric ENROLLMENT. Today the enroll ceremony
--      (OwnerSignup.handleRegisterBiometric / any future Profile "Enable face unlock") calls
--      navigator.credentials.create() and DISCARDS the returned credential, and member_devices
--      has ONLY a `biometric_enrolled` boolean (never set true) — there is NO home for the
--      credential public key. Persisting the credential needs these columns. Neither Cultivar's
--      shared member_devices NOR Ignition (localStorage-only, no DB column) already has a
--      credential-key home → this is genuinely NET-NEW SCHEMA, not a port.
--
-- PRIVACY (D-30 — privacy-clean): the private key + the biometric template live ONLY in the
--      device Secure Enclave and NEVER leave it. TRACE stores ONLY the PUBLIC key + the public
--      credential id — public identifiers used to VERIFY a future assertion. No biometric data,
--      no template, no fingerprint image is ever stored. This is the foundation for later
--      face-swap on shared devices (multiple credentials per device row's business).
--
-- SHAPE: additive · nullable · NO CHECK constraint (AC-4 — value set can grow without a migration).
--      Byte-safe: ADD COLUMN only, no ALTER of existing columns, no data move. Existing rows get
--      NULL credential fields + keep biometric_enrolled=false until a real enrollment lands.
--
-- RLS: member_devices already carries md_owner_all + md_self, both FOR ALL — they cover the new
--      columns with no new policy. (The stored value is a PUBLIC key, not a secret, and rows are
--      already owner/self scoped.)
-- ============================================================

ALTER TABLE member_devices
  ADD COLUMN IF NOT EXISTS credential_id          text,          -- WebAuthn credential id (base64url) — the lookup handle
  ADD COLUMN IF NOT EXISTS credential_public_key  text,          -- COSE/DER public key (base64) — PUBLIC, used to verify assertions
  ADD COLUMN IF NOT EXISTS credential_transports  text,          -- optional JSON array e.g. ["internal","hybrid"] (nullable)
  ADD COLUMN IF NOT EXISTS credential_enrolled_at timestamptz;   -- when the credential was persisted

-- One physical credential id must be unique (a credential can't belong to two device rows).
-- Partial unique so the many existing NULL rows don't collide.
CREATE UNIQUE INDEX IF NOT EXISTS member_devices_credential_id_key
  ON member_devices (credential_id)
  WHERE credential_id IS NOT NULL;

-- ============================================================
-- VERIFICATION (run after apply, as postgres — catalog, not memory):
--
-- (A) columns exist, nullable, correct types:
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'member_devices'
--      AND column_name IN ('credential_id','credential_public_key','credential_transports','credential_enrolled_at')
--    ORDER BY column_name;
--   -- expect 4 rows, all is_nullable = YES; credential_enrolled_at = timestamp with time zone, others = text
--
-- (B) partial unique index present:
--   SELECT indexname, indexdef FROM pg_indexes
--    WHERE tablename = 'member_devices' AND indexname = 'member_devices_credential_id_key';
--   -- expect one row, indexdef contains 'UNIQUE' and 'WHERE (credential_id IS NOT NULL)'
--
-- (C) RLS still on, no new policies needed (md_owner_all + md_self cover the new columns):
--   SELECT policyname, cmd FROM pg_policies WHERE tablename = 'member_devices' ORDER BY policyname;
--   -- expect md_owner_all (ALL) + md_self (ALL); rowsecurity = true on member_devices
--
-- (D) existing rows unharmed (credential fields NULL, biometric_enrolled unchanged):
--   SELECT count(*) AS total,
--          count(*) FILTER (WHERE credential_id IS NULL) AS null_cred,
--          count(*) FILTER (WHERE biometric_enrolled) AS enrolled
--     FROM member_devices;
--   -- expect null_cred = total, enrolled unchanged from before apply
-- ============================================================
