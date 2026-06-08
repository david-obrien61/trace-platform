-- social_drafts: regularize + extend platform CHECK constraint
-- 2026-06-09
--
-- CONTEXT (STD-008 inverse scar):
-- The constraint social_drafts_platform_check exists in the live DB but in NO
-- committed migration — it was hand-applied when the social_drafts table was
-- created pre-migration-era. The allowed values were (instagram, facebook,
-- tiktok, twitter). advert_channels now enables 'sms' as a channel, so
-- generate-posts attempts to INSERT platform='sms' rows. Because the batch
-- insert is atomic, one sms row rolls back all rows (instagram + tiktok
-- included) — confirmed by live probe 2026-06-09: zero rows written.
--
-- This migration does double duty:
--   1. Brings the hand-applied constraint under migration control.
--   2. Extends the allowed list to include 'sms'.
--
-- STD-008 INVERSE: deployed schema == on-disk migrations, both directions —
-- a live-DB-object-not-in-any-migration is the same gap as a
-- migration-not-applied. This migration closes the gap for this constraint.
--
-- David: paste into Supabase SQL editor (bgobkjcopcxusjsetfob), run, then
-- run the VERIFICATION QUERY at the bottom before reporting complete.

-- ─── DROP the hand-applied constraint (IF NOT EXISTS not available for DROP) ──

ALTER TABLE social_drafts
  DROP CONSTRAINT IF EXISTS social_drafts_platform_check;

-- ─── RECREATE with sms in the allowed list ────────────────────────────────────

ALTER TABLE social_drafts
  ADD CONSTRAINT social_drafts_platform_check
  CHECK (platform IN ('instagram', 'facebook', 'tiktok', 'twitter', 'sms'));

-- ─── VERIFICATION QUERY (run after applying; paste result into Handoff) ───────

-- SELECT pg_get_constraintdef(oid) AS constraint_def
--   FROM pg_constraint
--  WHERE conrelid = 'social_drafts'::regclass
--    AND conname  = 'social_drafts_platform_check';
--
-- Expected result:
--   CHECK ((platform = ANY (ARRAY['instagram'::text, 'facebook'::text,
--           'tiktok'::text, 'twitter'::text, 'sms'::text])))
--
-- Then trigger a test generation and confirm 3 rows appear in social_drafts
-- (instagram + tiktok + sms for the LAWNS business with current config).
