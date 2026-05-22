-- Add 'failed' to social_drafts status check constraint.
-- The original constraint only allowed 'draft' and 'published',
-- which caused silent failures when publish.ts tried to write status='failed'.
ALTER TABLE social_drafts
  DROP CONSTRAINT IF EXISTS social_drafts_status_check;

ALTER TABLE social_drafts
  ADD CONSTRAINT social_drafts_status_check
  CHECK (status IN ('draft', 'published', 'failed'));
