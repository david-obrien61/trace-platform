-- social_drafts: apply 20260604 + AC-1 de-noun + new status lifecycle
-- 2026-06-08
--
-- This migration does five things in order:
--   1. Apply 20260604_social_drafts_voice_learning (committed 2026-06-04, never applied
--      to the live bgobkjcopcxusjsetfob project — root cause of silent insert failures
--      and the loadSocialDrafts 400. Diagnosed 2026-06-08 per STD-001.)
--   2. Add subject_type + subject_id (AC-1 de-noun — vertical identity is a value, not a column)
--   3. Retire order_id + plant_id (vertical-specific FKs — AC-1 violations)
--   4. Retire 'content' column — original_text / edited_text pair replaces it
--   5. New status lifecycle: draft → edited → approved → copied (+ copied_at)
--      and clear the stale blotato_account_id from module configs
--
-- Table has ~0 real rows (every INSERT was failing because of #1 above).
-- No customer data at risk. Breaking is cheap at this stage.
--
-- David: paste this entire file into the Supabase SQL editor for project bgobkjcopcxusjsetfob,
-- then run the VERIFICATION query at the bottom to confirm the live shape.

-- ─── PART 1: Apply 20260604 columns (ADD IF NOT EXISTS — idempotent) ────────

ALTER TABLE social_drafts
  ADD COLUMN IF NOT EXISTS original_text  text,
  ADD COLUMN IF NOT EXISTS edited_text    text,
  ADD COLUMN IF NOT EXISTS cadence        text,
  ADD COLUMN IF NOT EXISTS period_start   timestamptz,
  ADD COLUMN IF NOT EXISTS period_end     timestamptz;

-- ─── PART 2: Add subject_ref (AC-1 de-noun) ─────────────────────────────────
-- subject_type: plain text value ('inventory', 'order', etc.) — NO CHECK constraint;
--   enumerating vertical nouns in a DB constraint is its own AC-1 leak. App-validated.
-- subject_id:   optional UUID pointing at the specific subject entity (null for period aggregates)

ALTER TABLE social_drafts
  ADD COLUMN IF NOT EXISTS subject_type text,
  ADD COLUMN IF NOT EXISTS subject_id   uuid;

-- ─── PART 3: Retire vertical-specific FKs ───────────────────────────────────
-- order_id: added 2026-05-22 for per-order post generation; orphaned when generation
--   moved to period-based model; never written in current code; AC-1 violation.
-- plant_id: AC-1 violation (Cultivar-specific noun). DROP IF EXISTS in case it was
--   added during the initial manual table setup (not captured in any migration).

ALTER TABLE social_drafts
  DROP COLUMN IF EXISTS order_id,
  DROP COLUMN IF EXISTS plant_id;

-- ─── PART 4: Retire 'content' — original_text/edited_text pair replaces it ──
-- Backfill original_text from content for any rows that exist without original_text
UPDATE social_drafts
  SET original_text = content
  WHERE original_text IS NULL AND content IS NOT NULL;

ALTER TABLE social_drafts
  DROP COLUMN IF EXISTS content;

-- ─── PART 5: New status lifecycle + copied_at ───────────────────────────────
ALTER TABLE social_drafts
  ADD COLUMN IF NOT EXISTS copied_at timestamptz;

-- Migrate any existing rows with old statuses before replacing the constraint
UPDATE social_drafts SET status = 'copied' WHERE status = 'published';
UPDATE social_drafts SET status = 'draft'  WHERE status = 'failed';

ALTER TABLE social_drafts
  DROP CONSTRAINT IF EXISTS social_drafts_status_check;

ALTER TABLE social_drafts
  ADD CONSTRAINT social_drafts_status_check
  CHECK (status IN ('draft', 'edited', 'approved', 'copied'));

-- ─── PART 6: Clear stale blotato_account_id from module configs ─────────────
-- Old enable.ts (pre-refactor) wrote blotato_account_id into business_modules.config.
-- New enable.ts writes only { platforms, cadence }. Clear any lingering stale value.
UPDATE business_modules
  SET config = config - 'blotato_account_id'
  WHERE module_key = 'social_media'
    AND config ? 'blotato_account_id';

-- ─── VERIFICATION (run this in SQL editor after applying to confirm live shape) ─
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_name = 'social_drafts'
--  ORDER BY ordinal_position;
--
-- Expected columns:
--   id, business_id, platform, status, created_at,
--   original_text, edited_text, cadence, period_start, period_end,
--   subject_type, subject_id, copied_at
--
-- NOT expected (should be gone):
--   content, order_id, plant_id
--
-- Expected status CHECK: ('draft', 'edited', 'approved', 'copied')
