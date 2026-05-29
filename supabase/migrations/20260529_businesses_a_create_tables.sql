-- Migration A: Create businesses, nursery_profiles tables
-- Run in Supabase SQL editor for bgobkjcopcxusjsetfob project

CREATE TABLE IF NOT EXISTS businesses (
  id                            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id                      uuid NOT NULL REFERENCES auth.users(id),
  name                          text NOT NULL,
  phone                         text,
  address                       text,
  email                         text,
  website                       text,
  logo_url                      text,
  tax_rate                      numeric(5,4) NOT NULL DEFAULT 0.0825,
  business_type                 text NOT NULL DEFAULT 'nursery',
  accounting_type               text,
  accounting_token              text,
  accounting_refresh_token      text,
  accounting_token_expires_at   timestamptz,
  accounting_needs_reconnect    boolean NOT NULL DEFAULT false,
  accounting_company_id         text,
  trial_started_at              timestamptz,
  created_at                    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

CREATE POLICY businesses_owner_select ON businesses
  FOR SELECT USING (owner_id = auth.uid());
CREATE POLICY businesses_owner_insert ON businesses
  FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY businesses_owner_update ON businesses
  FOR UPDATE USING (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS nursery_profiles (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id           uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  default_install_price numeric(10,2),
  created_at            timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE nursery_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY nursery_profiles_owner ON nursery_profiles
  FOR ALL USING (
    business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );
