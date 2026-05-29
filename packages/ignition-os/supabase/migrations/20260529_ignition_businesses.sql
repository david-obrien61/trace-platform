-- ─────────────────────────────────────────────────────────────────────────────
-- IGNITION OS — businesses migration
-- Run in: Supabase Dashboard → SQL Editor (project: ufsgqckbxdtwviqjjtos)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── BUSINESSES: universal tenant anchor ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS businesses (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                    uuid REFERENCES auth.users(id),
  name                        text NOT NULL,
  phone                       text,
  address                     text,
  email                       text,
  website                     text,
  logo_url                    text,
  tax_rate                    numeric(5,4) NOT NULL DEFAULT 0.0825,
  business_type               text NOT NULL DEFAULT 'shop',
  accounting_type             text,
  accounting_token            text,
  accounting_refresh_token    text,
  accounting_token_expires_at timestamptz,
  accounting_needs_reconnect  boolean NOT NULL DEFAULT false,
  accounting_company_id       text,
  trial_started_at            timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY businesses_owner_select ON businesses
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY businesses_owner_insert ON businesses
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY businesses_owner_update ON businesses
  FOR UPDATE USING (owner_id = auth.uid());

-- ── SHOPS: add owner_id FK so the owner's Supabase account owns the shop row ──
ALTER TABLE shops ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

-- ── RLS: shops readable by owner ─────────────────────────────────────────────
DROP POLICY IF EXISTS shops_owner_select ON shops;
CREATE POLICY shops_owner_select ON shops
  FOR SELECT USING (
    owner_id = auth.uid()
    OR id IN (SELECT id FROM businesses WHERE owner_id = auth.uid() AND business_type = 'shop')
  );

DROP POLICY IF EXISTS shops_owner_update ON shops;
CREATE POLICY shops_owner_update ON shops
  FOR UPDATE USING (owner_id = auth.uid());

-- ── Add business_id to all operational tables ─────────────────────────────────
ALTER TABLE users           ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE jobs            ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE purchase_orders ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE tools           ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE pmi_schedules   ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE ai_usage        ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);
ALTER TABLE feature_events  ADD COLUMN IF NOT EXISTS business_id uuid REFERENCES businesses(id);

-- ── RLS: all operational tables via businesses.owner_id ───────────────────────
-- Pattern: owner resolves via businesses table; shop_id still present as fallback
-- during transition while business_id backfill is pending on existing rows.

DROP POLICY IF EXISTS users_shop_select ON users;
CREATE POLICY users_business_owner ON users FOR ALL
  USING (
    shop_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid() AND business_type = 'shop')
  );

DROP POLICY IF EXISTS jobs_shop_select ON jobs;
CREATE POLICY jobs_business_owner ON jobs FOR ALL
  USING (
    shop_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid() AND business_type = 'shop')
  );

DROP POLICY IF EXISTS po_shop_select ON purchase_orders;
CREATE POLICY po_business_owner ON purchase_orders FOR ALL
  USING (
    shop_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid() AND business_type = 'shop')
  );

DROP POLICY IF EXISTS tools_shop_select ON tools;
CREATE POLICY tools_business_owner ON tools FOR ALL
  USING (
    shop_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid() AND business_type = 'shop')
  );

DROP POLICY IF EXISTS pmi_shop_select ON pmi_schedules;
CREATE POLICY pmi_business_owner ON pmi_schedules FOR ALL
  USING (
    shop_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid() AND business_type = 'shop')
  );

DROP POLICY IF EXISTS ai_usage_shop_select ON ai_usage;
CREATE POLICY ai_usage_business_owner ON ai_usage FOR ALL
  USING (
    shop_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid() AND business_type = 'shop')
  );

DROP POLICY IF EXISTS feature_events_shop_select ON feature_events;
CREATE POLICY feature_events_business_owner ON feature_events FOR ALL
  USING (
    shop_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid() AND business_type = 'shop')
  );
