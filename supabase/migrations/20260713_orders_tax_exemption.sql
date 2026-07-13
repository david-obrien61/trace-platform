-- Migration: orders tax-exemption — the per-order override + audit (D-40)
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-07-13
-- Branch: main
-- Apply: in the Supabase SQL editor AS the default `postgres` role. GATED — David applies + runs
--        the verification block below. NOTE: `orders` is a LIVE-ONLY table (tech-debt #39 — no
--        CREATE TABLE migration in version control); these ADD COLUMNs are the additive delta only.
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
--
-- WHY (D-40): the per-order tax state is PERSISTED on the order so every downstream surface
-- (Confirmation, QBO invoice, email, roster/detail) renders the SAME truth without recomputation —
-- and so a per-order EXEMPTION OVERRIDE (exempt this one order, or un-exempt a standing-exempt
-- customer) is captured with its actor. `tax_exempt_applied` is the effective per-order decision
-- (persistent customer exemption OR the owner/manager per-order override); `tax_exempt_by` is the
-- acting user's auth.uid when it came from a per-order OVERRIDE (null when it rode the persistent
-- customer attribute). Deploy-window-safe: submit.ts inserts WITH these columns and, on a
-- missing-column error (42703/PGRST204), retries WITHOUT them (mirrors delivery_date / override
-- cols) — the order still lands until this migration applies.
--
-- FOLLOW-UP (named, not built): an immutable order_compliance_records-style audit ROW for
-- exemptions (the netting-decline precedent) when volume/audit rigor justifies it. These order
-- columns are the Level-1 audit; the immutable row is the hardening follow-up.
--
-- ── RLS-INTACT ─────────────────────────────────────────────────────────────────
-- ADD COLUMN only. ALTERS NO policy/function/trigger. orders RLS unchanged (owner-only SELECT +
-- all writes via the service-key submit.ts, which independently proves apply_tax_exempt authority).
--
-- Idempotent: ADD COLUMN IF NOT EXISTS.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tax_exempt_applied  boolean NOT NULL DEFAULT false;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tax_exempt_reason   text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tax_exempt_cert_ref text;

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS tax_exempt_by       uuid;

COMMENT ON COLUMN orders.tax_exempt_applied IS
  'D-40: this order was invoiced tax-exempt (tax 0). Effective decision = the customer''s persistent '
  'exemption OR an owner/manager per-order override. tax_exempt_by = the acting uid when it came from '
  'a per-order OVERRIDE (null when it rode the persistent customer attribute). Reason is required to '
  'be honored — the server refuses to exempt without one (no silent tax removal).';

-- ============================================================================
-- VERIFICATION (run after apply)
-- ============================================================================
-- (A) all four columns exist with the right type/nullability/default:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name='orders'
--      AND column_name IN ('tax_exempt_applied','tax_exempt_reason','tax_exempt_cert_ref','tax_exempt_by')
--    ORDER BY column_name;
--   -- expect: tax_exempt_applied boolean NO 'false'; the other three YES NULL (cert/reason text, by uuid)
-- (B) NO CHECK constraint added on the reason:
--   SELECT conname FROM pg_constraint
--    WHERE conrelid='orders'::regclass AND contype='c'
--      AND pg_get_constraintdef(oid) ILIKE '%tax_exempt%';                       -- expect 0 rows
-- (C) RLS-INTACT — orders owner-only SELECT policy unchanged:
--   SELECT policyname, cmd FROM pg_policies WHERE tablename='orders';            -- unchanged from before
