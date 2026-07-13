-- Migration: customers tax-exemption — the persistent, business-scoped PARTY attribute (D-40)
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-07-13
-- Branch: main
-- Apply: in the Supabase SQL editor AS the default `postgres` role. GATED — David applies + runs
--        the verification block below BEFORE the reader code is owner-proven.
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
--
-- WHY (D-40): tax EXEMPTION is a party attribute invoked per-transaction — the exact sibling of
-- price_tier (D-38): a resale/ag/nonprofit/gov buyer is exempt on EVERY order, so exemption lives
-- on the customer (the business-scoped customer-role edge — there is no person_business_roles
-- table). AC-3: business-scoped is correct — a resale/ag cert is filed with THIS seller; a buyer
-- exempt at one business is not automatically exempt at another. Mirrors the price_tier ADD COLUMN
-- (20260625_person_spine.sql): additive, nullable, NO CHECK on the reason (the reason set grows as
-- data — TAX_EXEMPTION_REASONS in shared code — never a migration).
--
-- ── RLS-INTACT ─────────────────────────────────────────────────────────────────
-- ADD COLUMN only. ALTERS NO policy/function/trigger. customers RLS is unchanged:
--   customers_business_owner (owner FOR ALL) + customers_member (is_active_member AND
--   has_permission('view_customers'), 20260710). Zeroing tax REQUIRES a recorded reason — enforced
--   in the pure computeOrderPricing (never removes tax without one) AND in the /customers edit UI
--   (can't set exempt with a blank reason); the columns themselves carry the persisted decision.
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS tax_exempt          boolean NOT NULL DEFAULT false;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS tax_exempt_reason   text;

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS tax_exempt_cert_ref text;

COMMENT ON COLUMN customers.tax_exempt IS
  'D-40: this customer is tax-exempt on every order (persistent party attribute, mirrors price_tier). '
  'A per-order override on the order row can flip it for one transaction. Requires tax_exempt_reason '
  'to be honored — the pure computeOrderPricing never zeros tax without a recorded reason.';

-- ============================================================================
-- VERIFICATION (run after apply)
-- ============================================================================
-- (A) all three columns exist with the right type/nullability/default:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name='customers'
--      AND column_name IN ('tax_exempt','tax_exempt_reason','tax_exempt_cert_ref')
--    ORDER BY column_name;
--   -- expect: tax_exempt boolean NO 'false'; tax_exempt_cert_ref text YES NULL; tax_exempt_reason text YES NULL
-- (B) NO CHECK constraint was added on the reason (value-set is data, not schema):
--   SELECT conname FROM pg_constraint
--    WHERE conrelid='customers'::regclass AND contype='c'
--      AND pg_get_constraintdef(oid) ILIKE '%tax_exempt%';                       -- expect 0 rows
-- (C) RLS-INTACT — existing customers policies unchanged by this migration:
--   SELECT policyname FROM pg_policies WHERE tablename='customers'
--     AND policyname IN ('customers_business_owner','customers_member');          -- both present
-- (D) round-trip: an owner can persist an exemption on their own customer:
--   UPDATE customers SET tax_exempt=true, tax_exempt_reason='agricultural', tax_exempt_cert_ref='AG-TX-88213'
--    WHERE id = '<a customer id in your business>';  SELECT tax_exempt, tax_exempt_reason FROM customers WHERE id='<same>';
