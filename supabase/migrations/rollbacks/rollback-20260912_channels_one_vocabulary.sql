-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- ROLLBACK for 20260912_channels_one_vocabulary.sql
-- Written 2026-09-12, BEFORE the migration was applied. Not yet run.
--
-- Restores the schema to the exact pre-state captured in
--   docs/snapshots/pre-20260912_channels_one_vocabulary.sql
-- which holds the two CHECK definitions verbatim — they are reproduced below from that capture,
-- not from memory.
--
-- 🔴 RUN THIS *BEFORE* THE DATA RESTORE, NOT AFTER. This file puts the SCHEMA back; the snapshot
-- file puts the ROWS back. In that order, because the old CHECK constraints will REFUSE any row
-- carrying 'tiktok' or 'twitter' — so if posts were generated after the migration, the data
-- restore is what fails and tells you, rather than a constraint appearing to succeed over rows
-- that contradict it.
--
-- ⚠️ AND THE ONE THING TO UNDERSTAND BEFORE RUNNING IT: rolling back re-creates the DEFECT.
-- campaign_posts would again forbid tiktok and twitter while the config UI offers them, and every
-- post insert would die on the atomic batch again. Roll back to get un-stuck, not to stay.
-- ═══════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── E′ · drop the trigger and its function ───────────────────────────────────────────────────
DROP TRIGGER IF EXISTS business_modules_advert_channels_known ON public.business_modules;
DROP FUNCTION IF EXISTS public.channels_validate_advert_channels();

-- ─── C′ · foreign keys back to CHECK constraints ──────────────────────────────────────────────
-- The FKs must go first: `channels` cannot be dropped while anything references it.
ALTER TABLE public.campaign_posts DROP CONSTRAINT IF EXISTS campaign_posts_platform_fkey;
ALTER TABLE public.social_drafts  DROP CONSTRAINT IF EXISTS social_drafts_platform_fkey;

-- Reproduced VERBATIM from the pre-migration capture, section A.
ALTER TABLE public.campaign_posts
  ADD CONSTRAINT campaign_posts_platform_check
  CHECK ((platform = ANY (ARRAY['instagram'::text, 'facebook'::text, 'sms'::text, 'email'::text])));

ALTER TABLE public.social_drafts
  ADD CONSTRAINT social_drafts_platform_check
  CHECK ((platform = ANY (ARRAY['instagram'::text, 'facebook'::text, 'tiktok'::text, 'twitter'::text, 'sms'::text])));

-- ─── D′ · the subject column ──────────────────────────────────────────────────────────────────
-- ⚠️ DESTRUCTIVE IF EMAIL DRAFTS EXIST. Dropping this column discards every subject line written
-- since the migration. It is commented out DELIBERATELY: leaving an unused nullable column costs
-- nothing, and a rollback should not silently destroy content. Uncomment only if you mean it.
-- ALTER TABLE public.campaign_posts DROP COLUMN IF EXISTS subject;

-- ─── A′ · the lookup table ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS channels_authenticated_select ON public.channels;
DROP TABLE IF EXISTS public.channels;

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY THE ROLLBACK LANDED — expect 2 rows, both contype 'c', and zero 'f':
--
-- SELECT conrelid::regclass AS tbl, conname, contype, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conrelid IN ('public.campaign_posts'::regclass,'public.social_drafts'::regclass)
--    AND conname LIKE '%platform%' ORDER BY 1;
--
-- SELECT to_regclass('public.channels') AS channels_should_be_null;
--
-- SELECT tgname FROM pg_trigger WHERE NOT tgisinternal
--   AND tgrelid='public.business_modules'::regclass;   -- only business_modules_updated_at
-- ═══════════════════════════════════════════════════════════════════════════════════════════════
