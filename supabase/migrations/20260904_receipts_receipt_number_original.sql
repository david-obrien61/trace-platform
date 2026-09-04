-- supabase/migrations/20260904_receipts_receipt_number_original.sql
-- Adds `receipt_number_original text` to `receipts`.
-- 2026-09-04 · ledger #273 · David's ruling: "A TYPED NUMBER AND A READ NUMBER ARE DIFFERENT
--              EVIDENCE, same shape as line_items_original. A number she typed must be visibly
--              hers, so nobody later treats it as read from the paper."
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ⛔ NOT YET APPLIED. David applies this from his own checkout on main. Nothing below depends on
--    another migration; it is one ADD COLUMN IF NOT EXISTS and one COMMENT.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- WHY A COLUMN AND NOT A DERIVATION
--   The obvious cheaper answer is "compare `receipt_number` against `ocr_raw` and infer". It does
--   not work, and the reason is worth recording so it is not re-proposed:
--     · `ocr_raw` holds the model's RAW TEXT, not the parsed object. `receipt_number` comes out of
--       `parsed`, which is never stored as a whole.
--     · The interesting case is the one where the reader found NOTHING and the owner typed a
--       number. There is no string to compare against — the evidence of "we did not read one" is
--       precisely an ABSENCE, and an absence cannot be recovered from a value that is present.
--   So the original is BANKED, exactly as `line_items_original` banks the line snapshot.
--
-- WHAT THE THREE STATES MEAN, and this is the whole point of the column:
--   original IS NULL      AND number IS NOT NULL  → 🔴 THE OWNER TYPED IT. We read nothing.
--   original = number                             → read from the document, unaltered.
--   original <> number                            → we read one, the owner corrected it.
--   original IS NULL      AND number IS NULL      → no number, nobody supplied one. Honest blank.
--
-- ⚠️ IT DOES NOT BACKFILL, AND IT MUST NOT. The 39 stored rows keep both columns as they are
--    (measured 2026-09-04: `receipt_number` is populated on 1 of 39). Writing `receipt_number`
--    into `receipt_number_original` for the one populated row would ASSERT that the reader read
--    it — which is true in that instance and unverifiable in general, and a backfill that is
--    right by luck teaches the next reader the column is trustworthy when it was guessed.
--    R-50's clause: no stored row is retro-classified.
--
-- ⚠️ NO UNIQUE INDEX HERE. The dedup key (business_id, vendor_id, receipt_number) is named in
--    20260903c and is still blocked by the same thing: tech-debt #143's two live duplicate pairs
--    must be settled before a partial unique index can land, or it rejects real rows on apply.
--    This migration deliberately adds evidence, not a constraint.

ALTER TABLE receipts ADD COLUMN IF NOT EXISTS receipt_number_original text;

COMMENT ON COLUMN receipts.receipt_number_original IS
  'What the OCR READ as the document number at capture, banked once and never overwritten — the '
  'same shape as line_items_original. NULL while receipt_number is set means the owner TYPED the '
  'number and the reader found none; equal means read unaltered; different means the owner '
  'corrected a misread. A typed number and a read number are different evidence and must stay '
  'distinguishable (David, 2026-09-04). Never backfilled: a stored row is not retro-classified.';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run this after applying. It must return exactly one row.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--   SELECT column_name, data_type, is_nullable
--     FROM information_schema.columns
--    WHERE table_name = 'receipts' AND column_name = 'receipt_number_original';
--   EXPECT: receipt_number_original | text | YES
--
-- And the population check — it must show the column present and empty on every existing row:
--   SELECT count(*) AS total,
--          count(receipt_number)          AS with_number,
--          count(receipt_number_original) AS with_original
--     FROM receipts;
--   EXPECT (as of 2026-09-04): total 39 · with_number 1 · with_original 0
--   🔴 with_original > 0 immediately after applying means something backfilled. Investigate.
