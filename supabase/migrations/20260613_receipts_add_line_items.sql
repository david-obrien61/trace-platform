-- supabase/migrations/20260613_receipts_add_line_items.sql
-- Adds line_items jsonb column to the receipts table.
--
-- WHY:
-- The OCR prompt (ocr.ts PROMPT constant) already asks for:
--   "line_items": [{"description": "string", "amount": number}] or null
-- The OcrResult.parsed interface in ReceiptKeeper.tsx already types line_items correctly.
-- The only missing piece was this column + the save call.
-- This is v1 data capture only — no per-line classification UI is built here.
-- Stored as raw JSONB; a future analytics surface can read and aggregate it.

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS line_items jsonb;

-- VERIFICATION QUERY (run in Supabase SQL editor after applying):
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'receipts' AND column_name = 'line_items';
--
-- Expect: line_items | jsonb | YES
