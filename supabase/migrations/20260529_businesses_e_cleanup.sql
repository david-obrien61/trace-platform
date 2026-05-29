-- Migration E: Drop old nursery_id columns (run AFTER smoke test passes)
-- DO NOT run until new code is confirmed working end-to-end.

ALTER TABLE plants          DROP COLUMN IF EXISTS nursery_id;
ALTER TABLE plant_events    DROP COLUMN IF EXISTS nursery_id;
ALTER TABLE addons          DROP COLUMN IF EXISTS nursery_id;
ALTER TABLE customers       DROP COLUMN IF EXISTS nursery_id;
ALTER TABLE orders          DROP COLUMN IF EXISTS nursery_id;
ALTER TABLE social_drafts   DROP COLUMN IF EXISTS nursery_id;
ALTER TABLE nursery_modules DROP COLUMN IF EXISTS nursery_id;

-- DO NOT drop nurseries table here — keep as read-only reference until next session confirms clean.
