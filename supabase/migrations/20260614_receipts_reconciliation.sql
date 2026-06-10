-- supabase/migrations/20260614_receipts_reconciliation.sql
-- Adds reconciliation metadata columns to the receipts table.
--
-- WHY:
-- Receipt Keeper v1 captures OCR line items (line_items jsonb) and the owner-confirmed
-- total (amount). In v1 the owner can edit both freely with no cross-check.
-- This migration adds the columns needed for:
--   (1) Snapshot the raw OCR output BEFORE the owner edits it (line_items_original,
--       amount_original) — the "Tesla bit": we can always show what was read, what
--       was surfaced, and what the owner chose.
--   (2) Record the outcome of the line-vs-total reconciliation check (reconcile_status,
--       reconcile_delta) — 'match', 'small_gap', or 'large_mismatch_overridden'.
--   (3) Record exactly when an owner overrode a LARGE conflict (reconcile_overridden_at).
--   (4) Flag whether the owner changed the total field from what OCR reported
--       (header_amount_edited) — drives the LINE_CHANGED vs HEADER_CHANGED
--       analytics split.
--
-- All columns are additive (ADD COLUMN IF NOT EXISTS) — no destructive change.
-- Existing receipts rows keep NULL in all new columns; new rows are populated by
-- the updated ReceiptKeeper.tsx confirm flow.
--
-- AC-1: No vertical nouns. All column names are generic and shared-80% compatible.
-- AC-2: RLS is unchanged — dual owner+member policy on the receipts table already
--       covers all new columns via row-level enforcement.
-- STD-008: David must apply this migration manually in bgobkjcopcxusjsetfob SQL editor,
--          then run the VERIFICATION QUERY below.

-- 1 · Snapshot of raw OCR line items before owner editing
--     Mirrors the shape of line_items (jsonb array of {description, amount}).
--     Set once from OCR output; never updated after the row is written.
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS line_items_original jsonb;

-- 2 · Snapshot of raw OCR total before owner editing
--     Mirrors the precision of amount (numeric 10,2).
--     Set once from OCR output; never updated after the row is written.
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS amount_original numeric(10,2);

-- 3 · Reconciliation outcome at the moment the owner clicked Save
--     'match'                    — sum(line_items.amount) ≈ amount (within $0.02)
--     'small_gap'                — gap ≤ $5 or ≤ 10% of total (plausibly tax/tip)
--     'large_mismatch_overridden'— large gap; owner was shown conflict dialog + chose Save anyway
--     NULL                       — no line items available (can't reconcile)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reconcile_status text
  CHECK (reconcile_status IN ('match', 'small_gap', 'large_mismatch_overridden'));

-- 4 · Timestamp when the owner clicked "Save anyway" in the conflict dialog
--     NULL for all rows where reconcile_status is not 'large_mismatch_overridden'.
--     When set, proves the owner was shown the conflict before saving.
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reconcile_overridden_at timestamptz;

-- 5 · Delta at save time: sum(line_items.amount) − amount
--     Positive  = lines exceed total (e.g. OCR picked up a line Gemini missed in total)
--     Negative  = total exceeds sum of lines (e.g. tax not broken out as a line item)
--     NULL      = no line items (can't compute)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS reconcile_delta numeric(10,2);

-- 6 · Whether the owner changed the Total Amount field from what OCR reported
--     true  = owner edited the total (amount differs from amount_original)
--     false = owner accepted OCR total as-is
--     NULL  = no amount_original snapshot available (legacy row)
ALTER TABLE receipts ADD COLUMN IF NOT EXISTS header_amount_edited boolean;

-- VERIFICATION QUERY (run in Supabase SQL editor after applying):
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'receipts'
--   AND column_name IN (
--     'line_items_original', 'amount_original', 'reconcile_status',
--     'reconcile_overridden_at', 'reconcile_delta', 'header_amount_edited'
--   )
-- ORDER BY column_name;
--
-- Expect 6 rows:
--   amount_original          | numeric  | YES
--   header_amount_edited     | boolean  | YES
--   line_items_original      | jsonb    | YES
--   reconcile_delta          | numeric  | YES
--   reconcile_overridden_at  | timestamptz | YES
--   reconcile_status         | text     | YES
