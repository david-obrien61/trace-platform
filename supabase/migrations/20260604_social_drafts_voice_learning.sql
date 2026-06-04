-- Social drafts voice-learning columns (Social Media Module spec v1)
--
-- original_text: immutable Claude output — never overwritten after creation
-- edited_text:   what the owner saves — the voice-learning signal (v1: capture only)
-- cadence:       which rhythm triggered generation (weekly/few_times/on_demand)
-- period_start/end: the aggregation window that produced this post

ALTER TABLE social_drafts
  ADD COLUMN IF NOT EXISTS original_text  text,
  ADD COLUMN IF NOT EXISTS edited_text    text,
  ADD COLUMN IF NOT EXISTS cadence        text,
  ADD COLUMN IF NOT EXISTS period_start   timestamptz,
  ADD COLUMN IF NOT EXISTS period_end     timestamptz;

-- Backfill existing rows: treat current content as the original generated text
UPDATE social_drafts
  SET original_text = content
  WHERE original_text IS NULL AND content IS NOT NULL;
