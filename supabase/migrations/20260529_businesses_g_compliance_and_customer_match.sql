-- Migration G: compliance notices on service_offerings + audit trail
--
-- Every service offering with legal/regulatory implications can carry its
-- own compliance notice. The NettingPrompt is the first instance; the same
-- mechanism handles DOT inspection sign-offs, EPA disposal notices,
-- manager overrides, and any future compliance touch point.

-- ── Add compliance fields to service_offerings ────────────────────────────────
ALTER TABLE service_offerings
  ADD COLUMN IF NOT EXISTS compliance_title text,   -- "Texas law requires securing your load"
  ADD COLUMN IF NOT EXISTS compliance_body  text,   -- full legal paragraph
  ADD COLUMN IF NOT EXISTS service_note     text;   -- "applied by staff before you leave"

-- Seed compliance text for the LAWNS netting offering
UPDATE service_offerings
SET
  compliance_title = 'Texas law requires securing your load',
  compliance_body  = 'Under Texas Transportation Code Chapter 725, unsecured loads that can blow or spill from a vehicle are a misdemeanor — fines from $25 to $500. A 30-gallon tree extending above your truck bed qualifies. Our protective travel netting secures branches, prevents wind damage, and keeps you legal on the drive home.',
  service_note     = 'Applied by staff before you leave'
WHERE
  category = 'addon'
  AND trigger_transport_mode = 'self'
  AND name = 'Travel netting';

-- ── order_compliance_records ──────────────────────────────────────────────────
-- Immutable audit log: who was asked, what they saw, what they decided.
-- Pattern: DOT inspection, manager override, legal waiver, netting decline.
-- Never update or delete — append only.
CREATE TABLE IF NOT EXISTS order_compliance_records (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             uuid        NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  service_offering_id  uuid        REFERENCES service_offerings(id),
  business_id          uuid        NOT NULL REFERENCES businesses(id),

  -- What the customer/staff saw at the time of acknowledgment
  compliance_title_shown text,
  compliance_body_shown  text,

  -- The decision
  decision             text        NOT NULL CHECK (decision IN ('accepted', 'declined')),

  -- Who was present (staff member name or ID if captured; nullable for now)
  acknowledged_by      text,

  -- When — immutable, set at insert
  created_at           timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE order_compliance_records ENABLE ROW LEVEL SECURITY;

-- Owner can read their own records; no update or delete (append-only by policy)
CREATE POLICY compliance_records_owner_select ON order_compliance_records
  FOR SELECT USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- Service key (backend) handles inserts; no INSERT policy needed for anon/authenticated
-- (RLS bypass via service role key in API functions)

-- Index for audit queries: "show me all compliance events for this order"
CREATE INDEX IF NOT EXISTS compliance_records_order_idx ON order_compliance_records (order_id);
CREATE INDEX IF NOT EXISTS compliance_records_business_idx ON order_compliance_records (business_id, created_at DESC);
