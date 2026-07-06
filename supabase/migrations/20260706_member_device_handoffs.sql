-- ============================================================
-- MIGRATION: member_device_handoffs  (self-device-handoff via QR — D-31 device spine)
-- Apply as `postgres` (RLS + table owner). GATED — David applies; schema-verification gate owed.
--
-- PURPOSE: a short-lived, single-use, device-bound bearer token that lets an ALREADY
-- authenticated member get their OWN new device onto their account without typing a
-- URL/email/password. Distinct from `invitations` (which CREATES a new account) — this
-- AUTHENTICATES an existing member onto a new device.
--
-- GUARDRAILS (all four met by this table + the exchange endpoint):
--   short-TTL           → expires_at default now() + 15 min
--   single-use          → `used` flag, flipped atomically at exchange (returning-guarded)
--   issued-from-session → mdh_self_insert WITH CHECK (DB-enforced: only an active member
--                         of the business may mint a handoff for THEIR OWN membership)
--   device-bound        → device_fingerprint recorded on the (only) consuming exchange
-- ============================================================

CREATE TABLE IF NOT EXISTS member_device_handoffs (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  token              text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  -- 64-char hex bearer token (same generation as invitations.token)
  business_id        uuid        NOT NULL REFERENCES businesses(id)       ON DELETE CASCADE,
  member_id          uuid        NOT NULL REFERENCES business_members(id) ON DELETE CASCADE,
  -- the new device logs in AS this member
  issued_by          uuid        NOT NULL,
  -- auth.uid() of the issuer; equals the member's user_id (proves the real member minted it)
  device_fingerprint text,
  -- bound on the consuming exchange (null until scanned)
  used               boolean     NOT NULL DEFAULT false,
  used_at            timestamptz,
  expires_at         timestamptz NOT NULL DEFAULT (now() + interval '15 minutes'),  -- SHORT ttl
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS member_device_handoffs_business_idx
  ON member_device_handoffs (business_id);

ALTER TABLE member_device_handoffs ENABLE ROW LEVEL SECURITY;

-- ISSUE: a member may mint a handoff ONLY for their own active membership, from their own
-- session. This is the "issued-only-from-authenticated-session" guardrail, DB-enforced.
CREATE POLICY mdh_self_insert ON member_device_handoffs
  FOR INSERT WITH CHECK (
    issued_by = auth.uid()
    AND member_id IN (
      SELECT id FROM business_members
      WHERE user_id = auth.uid()
        AND business_id = member_device_handoffs.business_id
        AND active = true
    )
  );

-- The issuer can read their own handoffs (poll status / show expiry in the issuing UI).
CREATE POLICY mdh_self_select ON member_device_handoffs
  FOR SELECT USING (issued_by = auth.uid());

-- The business owner can see / revoke all handoffs in their business (mirrors md_owner_all).
CREATE POLICY mdh_owner_all ON member_device_handoffs
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- NOTE: EXCHANGE (validate + atomic consume + device-bind) runs with the SERVICE KEY in the
-- exchange endpoint — the new device has no session, so it bypasses RLS by design. No anon
-- policy is granted (a session-less client can never read/mutate these rows directly).

-- ============================================================
-- VERIFICATION (run after apply, as postgres; expected in comments)
-- (A) table + columns:
--     SELECT column_name, data_type, is_nullable, column_default
--       FROM information_schema.columns WHERE table_name = 'member_device_handoffs' ORDER BY ordinal_position;
--     → 10 cols; token default encode(gen_random_bytes(32),'hex'); expires_at default now()+'00:15:00'.
-- (B) RLS on:
--     SELECT relrowsecurity FROM pg_class WHERE relname = 'member_device_handoffs';  → t
-- (C) exactly 3 policies (mdh_self_insert INSERT, mdh_self_select SELECT, mdh_owner_all ALL):
--     SELECT polname, cmd FROM pg_policies WHERE tablename = 'member_device_handoffs';  (via pg_policies: policyname, cmd)
-- (D) FKs cascade:
--     business_id → businesses ON DELETE CASCADE; member_id → business_members ON DELETE CASCADE.
-- ============================================================
