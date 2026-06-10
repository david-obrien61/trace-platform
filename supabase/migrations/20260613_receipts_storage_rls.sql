-- supabase/migrations/20260613_receipts_storage_rls.sql
-- Storage bucket RLS for the 'receipts' private bucket.
--
-- WHY THIS FILE EXISTS:
-- The receipts TABLE (20260612_receipts.sql) has proper dual owner+member RLS.
-- The storage BUCKET 'receipts' had NO storage.objects policies, causing every
-- upload to return 400 "new row violates row-level security policy".
-- This migration brings storage policies under migration control (STD-008 inverse discipline).
--
-- PATH CONVENTION: objects are stored as {business_id}/{receipt_id}.{ext}
-- So split_part(name, '/', 1) extracts the business_id UUID from the object path.
--
-- DUAL OWNER+MEMBER PATTERN mirrors the receipts table policies exactly:
--   Owner path:  EXISTS in businesses WHERE owner_id = auth.uid()
--   Member path: EXISTS in business_members WHERE user_id = auth.uid() AND active = true
--
-- AC-3: tenant isolation absolute — cross-business upload is blocked by the
-- WITH CHECK constraint on the INSERT policy.
--
-- STD-008 SNAPSHOT (before state):
-- Run this to capture current policies before applying:
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'receipts%';
-- Expected BEFORE: (0 rows)
-- Expected AFTER:  3 rows (receipts_storage_delete, receipts_storage_insert, receipts_storage_select)

-- ============================================================
-- INSERT: authenticated user can upload to their own business's folder only
-- ============================================================
DROP POLICY IF EXISTS "receipts_storage_insert" ON storage.objects;
CREATE POLICY "receipts_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'receipts'
    AND (
      -- Owner path
      (split_part(name, '/', 1))::uuid IN (
        SELECT id FROM businesses
        WHERE owner_id = auth.uid()
      )
      OR
      -- Member path
      (split_part(name, '/', 1))::uuid IN (
        SELECT business_id FROM business_members
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );

-- ============================================================
-- SELECT: user can read objects in their business folder
-- (used by v2 createSignedUrl() — path stored in image_url column)
-- ============================================================
DROP POLICY IF EXISTS "receipts_storage_select" ON storage.objects;
CREATE POLICY "receipts_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (
      (split_part(name, '/', 1))::uuid IN (
        SELECT id FROM businesses
        WHERE owner_id = auth.uid()
      )
      OR
      (split_part(name, '/', 1))::uuid IN (
        SELECT business_id FROM business_members
        WHERE user_id = auth.uid() AND active = true
      )
    )
  );

-- ============================================================
-- DELETE: owner only — members cannot delete receipt images
-- ============================================================
DROP POLICY IF EXISTS "receipts_storage_delete" ON storage.objects;
CREATE POLICY "receipts_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'receipts'
    AND (split_part(name, '/', 1))::uuid IN (
      SELECT id FROM businesses
      WHERE owner_id = auth.uid()
    )
  );

-- ============================================================
-- VERIFICATION QUERY (run in Supabase SQL editor after applying):
-- ============================================================
-- SELECT policyname, cmd, roles
-- FROM pg_policies
-- WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'receipts%'
-- ORDER BY policyname;
--
-- Expect 3 rows:
--   receipts_storage_delete  | DELETE | {authenticated}
--   receipts_storage_insert  | INSERT | {authenticated}
--   receipts_storage_select  | SELECT | {authenticated}
--
-- CROSS-TENANT ISOLATION TEST:
-- While authenticated as user A (owner of business-A):
--   Upload to 'receipts' bucket with path '{business_B_id}/{any}.jpg' → expect 400 (RLS blocked)
--   Upload to 'receipts' bucket with path '{business_A_id}/{any}.jpg' → expect 200 (allowed)
