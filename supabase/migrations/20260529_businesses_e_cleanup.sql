-- Migration E: Drop old nursery_id columns (run AFTER smoke test passes)
-- DO NOT run until new code is confirmed working end-to-end.
--
-- Uses CASCADE to drop any RLS policies still referencing nursery_id
-- (e.g. plants_all_owner, authenticated_select_plants from the May 28 isolation
-- migration). Migration D already created the replacement business_id policies,
-- so CASCADE here only removes the stale nursery_id-dependent objects.

ALTER TABLE plants          DROP COLUMN IF EXISTS nursery_id CASCADE;
ALTER TABLE plant_events    DROP COLUMN IF EXISTS nursery_id CASCADE;
ALTER TABLE addons          DROP COLUMN IF EXISTS nursery_id CASCADE;
ALTER TABLE customers       DROP COLUMN IF EXISTS nursery_id CASCADE;
ALTER TABLE orders          DROP COLUMN IF EXISTS nursery_id CASCADE;
ALTER TABLE social_drafts   DROP COLUMN IF EXISTS nursery_id CASCADE;
ALTER TABLE nursery_modules DROP COLUMN IF EXISTS nursery_id CASCADE;

-- DO NOT drop nurseries table here — keep as read-only reference until next session confirms clean.
