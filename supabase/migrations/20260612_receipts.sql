-- =============================================================================
-- receipts table — shared 80% (no vertical noun), per-tenant, STD-010 applied
-- =============================================================================
-- Naming: receipts is shared 80% per the 80/20 convention.
-- Scope: business_id scopes every row. No vertical noun appears in this file.
-- STD-010 (ACTIVE): per-tenant storage path enforced by convention — see ocr.ts.
-- Dual RLS: owner (businesses.owner_id) + member (business_members) — AC-2 compliant.
-- accept_vs_edit: captured at confirm moment — unrecoverable if deferred.
-- ocr_cost_estimate: nullable — records token count or estimated cost per OCR call.

CREATE TABLE IF NOT EXISTS receipts (
  id                uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id       uuid         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  uploaded_by       uuid         NOT NULL REFERENCES auth.users(id),
  image_url         text,
  ocr_raw           jsonb,
  vendor            text,
  date              date,
  amount            numeric(10,2),
  category          text,
  status            text         NOT NULL DEFAULT 'captured'
                    CHECK (status IN ('captured', 'confirmed')),
  accept_vs_edit    text
                    CHECK (accept_vs_edit IN ('accepted_as_is', 'edited')),
  ocr_cost_estimate numeric(10,6),
  created_at        timestamptz  NOT NULL DEFAULT now(),
  updated_at        timestamptz  NOT NULL DEFAULT now()
);

-- RLS: dual policy — owner OR active member of business_id
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY receipts_owner_all ON receipts
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = receipts.business_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = receipts.business_id AND owner_id = auth.uid()
    )
  );

CREATE POLICY receipts_member_all ON receipts
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = receipts.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = receipts.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  );

-- updated_at trigger — reuses existing function from 20260604_business_modules.sql
DROP TRIGGER IF EXISTS receipts_updated_at ON receipts;
CREATE TRIGGER receipts_updated_at
  BEFORE UPDATE ON receipts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

-- VERIFICATION QUERY (run in Supabase SQL editor after applying):
-- SELECT column_name, data_type, is_nullable, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'receipts'
-- ORDER BY ordinal_position;
--
-- Expect columns: id, business_id, uploaded_by, image_url, ocr_raw, vendor, date,
-- amount, category, status (default 'captured'), accept_vs_edit, ocr_cost_estimate,
-- created_at, updated_at.
