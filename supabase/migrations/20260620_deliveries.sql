-- ============================================================
-- Migration: deliveries
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Date: 2026-06-20 (verified via `date` command — clock not drifted)
-- Purpose: hold a dated, addressed delivery tied to a customer —
--          the net-new piece that closes the OCR-invoice loop
--          (snap invoice → "Schedule delivery" → dated delivery →
--           appears under its DAY → plots on the existing route map).
-- AC-1: no vertical nouns — generic `deliveries` (business-scoped).
-- AC-2: RLS scoped to business_id membership (owner + active member).
-- AC-3: tenant isolation absolute — cross-tenant rows never resolve.
-- AC-4: status is free text with NO CHECK — the value-set grows
--        (scheduled → out_for_delivery → delivered → …) without a migration.
-- ⚠️  APPLY MANUALLY in Supabase SQL editor — do NOT execute without
--     David's explicit "run it" approval.  GATED / UNAPPLIED until then.
-- ============================================================
-- Pre-write verify (run these before applying — expected results in comments):
--   deliveries   → 404 (ABSENT ✅, this migration creates it)
--   businesses   → 200 (PRESENT ✅)  FK target + owner_id RLS target
--   business_members → 200 (PRESENT ✅)  business_id/user_id/active RLS target
--   customers    → 200 (PRESENT ✅)  FK target (customer_id)
-- NO existing table is altered by this migration — append-only, new table only.
-- ============================================================

CREATE TABLE deliveries (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid         NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_id   uuid         REFERENCES customers(id) ON DELETE SET NULL,
  delivery_date date,
  address_line1 text,
  city          text,
  state         text,
  zip           text,
  status        text         NOT NULL DEFAULT 'scheduled',  -- AC-4: NO CHECK
  source        text,                                       -- e.g. 'ocr-invoice'
  notes         text,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

-- Fast day-grouped lookups (the day view groups by delivery_date per tenant)
CREATE INDEX deliveries_business_date_idx
  ON deliveries (business_id, delivery_date);

ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY deliveries_owner_all ON deliveries
  USING (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = deliveries.business_id
        AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM businesses
      WHERE id = deliveries.business_id
        AND owner_id = auth.uid()
    )
  );

CREATE POLICY deliveries_member_all ON deliveries
  USING (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = deliveries.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM business_members
      WHERE business_id = deliveries.business_id
        AND user_id = auth.uid()
        AND active = true
    )
  );

-- ============================================================
-- END OF MIGRATION
-- Run verification after applying (catalog gate):
--   SUPABASE_PAT=sbp_xxx node scripts/verify-deliveries.mjs
-- Quick check:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_schema='public' AND table_name='deliveries';
-- Expected: 1 row.
-- ============================================================
