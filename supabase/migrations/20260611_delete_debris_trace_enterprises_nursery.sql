-- Cleanup: delete the debris nursery-typed TRACE Enterprises row created
-- during a failed first add-a-business attempt (before the multi-business flow
-- was corrected). The correct row is the general-typed TRACE Enterprises
-- (id starts with 45830ba7) which resolves in the trace-app (businessType='general').
--
-- SAFE GUARD: targets only the nursery-typed row whose id starts with 11901e52.
-- The WHERE clause triple-confirms the target before deleting anything.
--
-- Run in: bgobkjcopcxusjsetfob Supabase SQL editor
--
-- STEP 1 — VERIFY (run this first, confirm 1 row returned):
-- SELECT id, name, business_type, created_at
-- FROM businesses
-- WHERE id::text LIKE '11901e52%'
-- AND business_type = 'nursery';
--
-- STEP 2 — DELETE (only after confirming STEP 1 returns exactly 1 row):

DELETE FROM businesses
WHERE id::text LIKE '11901e52%'
  AND business_type = 'nursery'
  AND name ILIKE '%TRACE%';

-- STEP 3 — VERIFY AFTER (confirm 0 rows returned):
-- SELECT id, name, business_type FROM businesses
-- WHERE id::text LIKE '11901e52%';

-- Expected post-delete state:
-- David owns:
--   LAWNS Tree Farm, LLC  (business_type='nursery') → resolves in Cultivar
--   TRACE Enterprises     (business_type='general') → resolves in trace-app
