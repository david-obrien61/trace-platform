-- Rename campaign_tone_samples → business_voice_samples
-- AC-1: the voice store is a general business-level corpus, not campaign-specific.
-- The table is shared across generators (campaign_generate, social_generate, etc.).
-- Add source column: provenance of which generator produced each edit pair.
-- Rows + UUIDs ride along untouched. FK and RLS follow the table OID through the rename.

-- 1. Rename the table.
ALTER TABLE campaign_tone_samples RENAME TO business_voice_samples;

-- 2. Rename the RLS policy to match the new table name.
ALTER POLICY tone_samples_owner ON business_voice_samples RENAME TO business_voice_samples_owner;

-- 3. Add source column with temporary DEFAULT so existing rows backfill automatically.
ALTER TABLE business_voice_samples
  ADD COLUMN source text NOT NULL DEFAULT 'campaign_generate';

-- 4. Explicit backfill — all existing rows were produced by campaign_generate.
UPDATE business_voice_samples SET source = 'campaign_generate';

-- 5. Drop DEFAULT — callers must supply source explicitly (catches new generators that forget).
ALTER TABLE business_voice_samples ALTER COLUMN source DROP DEFAULT;

-- 6. Document the convention. Source values are capability names from
--    shared/src/ai/capabilities.ts. Read-back queries pool all sources for the business;
--    source is provenance metadata, not a filter. New generator: add a row to CAPABILITIES,
--    write with source='<new_capability_key>'. No constraint change needed.
COMMENT ON COLUMN business_voice_samples.source IS
  'Capability name that produced this edit pair (e.g. campaign_generate, social_generate). '
  'Matches capability keys in shared/src/ai/capabilities.ts. '
  'Read-back queries pool all sources by business_id — source is provenance, not a filter.';
