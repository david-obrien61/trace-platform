-- ============================================================================
-- WIPE — FULL NUKE for the Person-spine build (Checkpoint 1, step 1)
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Run in the Supabase SQL editor AS the default `postgres` role.
-- Run this ONCE, BEFORE applying supabase/migrations/20260625_person_spine.sql.
--
-- ⚠️  DESTRUCTIVE — this deletes ALL tenant data AND ALL auth users.
--     David authorized a full nuke: every current row is throwaway stress-test
--     scaffolding. The real LAWNS demo comes back as a FRESH load through the new
--     structure via Build B (the per-tenant seed/reset function, queued — not built yet).
--     Deliberately NOT in supabase/migrations/ so it never replays in migration history.
--
-- WHY a full nuke + this order: businesses.owner_id is NOT NULL REFERENCES auth.users(id)
-- with no ON DELETE (RESTRICT), and customers.business_id → businesses is also RESTRICT.
-- So auth.users (incl. the ba7cf242… anchor) cannot be deleted while any business they
-- own — or any customer of that business — still exists. We truncate every tenant table
-- first (CASCADE pulls in the rest), then delete auth.users.
-- ============================================================================

-- ── STEP A — ENUMERATE (run first, INSPECT the output before truncating) ────────
-- Every public table carrying a business_id column — i.e. tenant-scoped data.
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'business_id'
ORDER BY table_name;

-- Sanity: every FK that points at businesses / nurseries / auth.users (what blocks the
-- auth.users delete until cleared). For visibility only.
SELECT
  conrelid::regclass  AS referencing_table,
  confrelid::regclass AS referenced_table,
  conname             AS constraint_name,
  confdeltype         AS on_delete   -- a=no action, r=restrict, c=cascade, n=set null
FROM pg_constraint
WHERE contype = 'f'
  AND confrelid::regclass::text IN ('businesses', 'nurseries', 'auth.users')
ORDER BY referenced_table, referencing_table;

-- ── STEP B — WIPE (run after inspecting STEP A) ─────────────────────────────────
-- Builds the truncate set FROM the live catalog (does not trust a hand-list): every
-- public table with a business_id column, plus the businesses + nurseries anchors.
-- A single TRUNCATE … CASCADE clears the whole web in one statement (CASCADE also pulls
-- in any referencing table not in the set), so truncation order is irrelevant.
DO $$
DECLARE
  tlist text;
BEGIN
  SELECT string_agg(format('public.%I', t.table_name), ', ')
  INTO tlist
  FROM (
    SELECT table_name
      FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'business_id'
    UNION SELECT 'businesses'
    UNION SELECT 'nurseries'
  ) t
  WHERE to_regclass(format('public.%I', t.table_name)) IS NOT NULL;

  IF tlist IS NULL THEN
    RAISE NOTICE 'WIPE: nothing to truncate (already pristine).';
  ELSE
    RAISE NOTICE 'WIPE: TRUNCATE % RESTART IDENTITY CASCADE', tlist;
    EXECUTE 'TRUNCATE TABLE ' || tlist || ' RESTART IDENTITY CASCADE';
  END IF;
END $$;

-- Now delete ALL auth users — no business.owner_id RESTRICT blocks them anymore.
-- Supabase cascades auth.identities / auth.sessions / auth.refresh_tokens.
DELETE FROM auth.users;

-- ── STEP C — VERIFY (expect 0 across the board) ─────────────────────────────────
SELECT 'auth.users'        AS scope, count(*) FROM auth.users
UNION ALL SELECT 'businesses',       count(*) FROM businesses
UNION ALL SELECT 'business_members', count(*) FROM business_members
UNION ALL SELECT 'customers',        count(*) FROM customers;
-- Storage objects (receipt files) are path-based, not FK-linked — clear via the
-- Storage dashboard if a fully empty bucket is wanted. Harmless orphans otherwise.
