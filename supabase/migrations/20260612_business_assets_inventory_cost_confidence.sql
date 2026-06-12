-- ============================================================
-- Migration: business_assets + business_inventory — cost confidence + receipt link
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- AC-1: no vertical nouns — business_ prefix only
-- Date: 2026-06-12 (follow-up to 20260612_business_assets_inventory_pmi_service.sql)
-- ⚠️  APPLY MANUALLY in Supabase SQL editor — do NOT execute without
--     David's explicit "run it" approval.
-- ============================================================
-- Pre-write verify (completed before writing):
--   business_assets.location         → ABSENT ✅  (not in base migration)
--   business_assets.cost_confidence  → ABSENT ✅  (not in base migration)
--   business_inventory.receipt_id    → ABSENT ✅  (not in base migration)
--   business_inventory.cost_confidence → ABSENT ✅ (not in base migration)
--   business_inventory.location      → PRESENT (already in base migration — NOT added here)
--   Both tables: ZERO rows — all ALTERs are maximally safe, no backfill needed.
-- ============================================================


-- ============================================================
-- business_assets: physical location + confidence on acquisition_cost
--
-- location: where the asset lives or is assigned (shop floor, site, vehicle,
--   storage bay). Free-text; not normalized — owner knows their own layout.
--
-- cost_confidence: the epistemic status of acquisition_cost.
--   CONFIRMED = receipt-linked actual (receipts table or paper trail).
--   DERIVED    = AI-appraised from make/model/year/condition; TRACE label. Must
--                never read as CONFIRMED — Surface Honesty: the label is the signal.
--   ESTIMATED  = manual owner estimate ("I paid around $X").
--   UNKNOWN    = no basis at all. Surface Honesty: silence is worse than flagging.
-- ============================================================
ALTER TABLE business_assets
  ADD COLUMN location         text,
  ADD COLUMN cost_confidence  text
    CHECK (cost_confidence IN ('CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'));


-- ============================================================
-- business_inventory: receipt link (count-once dedup seam) + confidence on unit_cost
--
-- receipt_id: links a stock purchase to the receipt that documents it.
--   PRESENT  = receipt is the cost source; unit_cost is derived from that receipt.
--              This is the COUNT-ONCE dedup seam: the same dollars are captured as
--              inventory (stock on hand) AND may appear in QB/accounting as an expense.
--              The receipt_id is the join that prevents double-count in the accumulator.
--              Whether the item is capitalized as stock vs. expensed now is the
--              ACCOUNTANT'S call — TRACE captures and links, never rules on treatment.
--   ABSENT   = no receipt link; unit_cost stands as the authoritative figure (manual entry).
--
-- cost_confidence: same four-value enum as business_assets.cost_confidence.
--   For inventory: CONFIRMED = receipt-linked; ESTIMATED = manual entry or quoted price;
--   DERIVED = AI-extracted from receipt OCR (OCR confidence < CONFIRMED manual verification);
--   UNKNOWN = no basis.
-- ============================================================
ALTER TABLE business_inventory
  ADD COLUMN receipt_id       uuid
    REFERENCES receipts(id) ON DELETE SET NULL,
  ADD COLUMN cost_confidence  text
    CHECK (cost_confidence IN ('CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'));


-- ============================================================
-- No RLS change — both tables inherit existing owner_all + member_all policies.
-- No trigger change — updated_at triggers already exist on both tables.
-- ALTERs only.
-- ============================================================


-- ============================================================
-- VERIFICATION QUERY — run after applying; expect 5 rows:
--   (business_assets,   location)
--   (business_assets,   cost_confidence)
--   (business_inventory, location)         ← pre-existing from base migration
--   (business_inventory, receipt_id)
--   (business_inventory, cost_confidence)
--
SELECT table_name, column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_schema = 'public'
   AND table_name   IN ('business_assets', 'business_inventory')
   AND column_name  IN ('location', 'cost_confidence', 'receipt_id')
 ORDER BY table_name, column_name;
-- Expected: 5 rows.
-- ============================================================
