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
--
-- ── APPEND-ONLY GUARD HANDLING (revised 2026-06-25 after STEP B rolled back) ─────
-- audit_log is APPEND-ONLY: a reject_*_mutation guard rejects TRUNCATE (working as
-- designed). A first run of STEP B rolled back on it. David's decision: the orphaned
-- audit rows must NOT persist (they would reference non-existent business IDs and weaken
-- the LAWNS-demo audit log). So audit_log is cleared as an EXPLICIT, ONE-TIME, PRIVILEGED
-- TEARDOWN of the whole test environment — never as a quiet workaround, never a reusable
-- normal-path move.
--   • Guarded tables (any reject_*_mutation trigger) are EXCLUDED from the normal
--     explicit truncate list (STEP B inside the B2 block).
--   • The guards are DISABLED only inside the labeled STEP B2 window, the set is truncated,
--     and the guards are RE-ENABLED — all in ONE transaction, so a failure auto-restores
--     them (the script can NEVER leave a guarded table unprotected).
--   • audit_log FK-CASCADES from businesses (ON DELETE CASCADE), so truncating businesses
--     necessarily truncates audit_log via cascade — that is WHY the guard window must
--     bracket the whole truncate, not just a standalone audit_log truncate.
--   • STEP C re-queries pg_trigger and PROVES every guard is back ON.
-- ============================================================================

-- ── STEP A — ENUMERATE + DISCOVER GUARDS (run first, INSPECT before STEP B2) ─────
-- A1: every public table carrying a business_id column — the tenant-scoped data.
SELECT table_name
FROM information_schema.columns
WHERE table_schema = 'public' AND column_name = 'business_id'
ORDER BY table_name;

-- A2: append-only GUARDED tables (a reject_*_mutation trigger). These are EXCLUDED from
--     the normal explicit truncate list and handled ONLY inside the STEP B2 window.
SELECT c.relname  AS guarded_table,
       t.tgname   AS trigger_name,
       p.proname  AS guard_function,
       t.tgenabled AS enabled_flag   -- expect 'O' (enabled) now and again after STEP B2
FROM pg_trigger t
JOIN pg_class     c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc      p ON p.oid = t.tgfoid
WHERE n.nspname = 'public'
  AND NOT t.tgisinternal
  AND p.proname ILIKE 'reject%mutation'
ORDER BY c.relname;

-- A3: every FK that points at businesses / nurseries / auth.users (what blocks the
--     auth.users delete until cleared). For visibility only.
SELECT
  conrelid::regclass  AS referencing_table,
  confrelid::regclass AS referenced_table,
  conname             AS constraint_name,
  confdeltype         AS on_delete   -- a=no action, r=restrict, c=cascade, n=set null
FROM pg_constraint
WHERE contype = 'f'
  AND confrelid::regclass::text IN ('businesses', 'nurseries', 'auth.users')
ORDER BY referenced_table, referencing_table;

-- ── STEP B2 — AUDIT-LOG TEARDOWN (PRIVILEGED, ONE-TIME, FULL ENVIRONMENT RESET) ──
-- ⚠️  NOT a normal mutation. This is a deliberate, on-the-record teardown of the entire
--     test environment before launch. It disables every append-only guard, truncates the
--     full tenant set (the normal STEP B set, with guarded tables excluded from the explicit
--     list but emptied via cascade), and RE-ENABLES every guard — in one transaction.
--     Do NOT lift this pattern into any normal code path.
DO $$
DECLARE
  g     record;
  tlist text;
BEGIN
  -- B2.1 — DISABLE every append-only guard (reject_*_mutation).
  FOR g IN
    SELECT c.relname AS tbl, t.tgname AS trg
    FROM pg_trigger t
    JOIN pg_class     c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc      p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public' AND NOT t.tgisinternal AND p.proname ILIKE 'reject%mutation'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DISABLE TRIGGER %I', g.tbl, g.trg);
    RAISE NOTICE 'TEARDOWN: disabled append-only guard %.%', g.tbl, g.trg;
  END LOOP;

  -- B2.2 — STEP B (normal truncate set): every business_id table EXCLUDING guarded tables,
  --        + businesses + nurseries. CASCADE empties the excluded guarded tables (audit_log)
  --        too — safe now because their guards are down for this one transaction.
  SELECT string_agg(format('public.%I', t.table_name), ', ')
  INTO tlist
  FROM (
    SELECT table_name
      FROM information_schema.columns
     WHERE table_schema = 'public' AND column_name = 'business_id'
    UNION SELECT 'businesses'
    UNION SELECT 'nurseries'
  ) t
  WHERE to_regclass(format('public.%I', t.table_name)) IS NOT NULL
    -- exclude every guarded (append-only) table from the EXPLICIT list (cascade still empties them)
    AND t.table_name NOT IN (
      SELECT c.relname
      FROM pg_trigger tg
      JOIN pg_class     c ON c.oid = tg.tgrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_proc      p ON p.oid = tg.tgfoid
      WHERE n.nspname = 'public' AND NOT tg.tgisinternal AND p.proname ILIKE 'reject%mutation'
    );

  IF tlist IS NULL THEN
    RAISE NOTICE 'TEARDOWN: nothing to truncate (already pristine).';
  ELSE
    RAISE NOTICE 'TEARDOWN: TRUNCATE % RESTART IDENTITY CASCADE', tlist;
    EXECUTE 'TRUNCATE TABLE ' || tlist || ' RESTART IDENTITY CASCADE';
  END IF;

  -- B2.3 — RE-ENABLE every guard. (Transactional: if B2.1/B2.2 had failed, the rollback
  --        would already have restored these — the guards can never be left off.)
  FOR g IN
    SELECT c.relname AS tbl, t.tgname AS trg
    FROM pg_trigger t
    JOIN pg_class     c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_proc      p ON p.oid = t.tgfoid
    WHERE n.nspname = 'public' AND NOT t.tgisinternal AND p.proname ILIKE 'reject%mutation'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE TRIGGER %I', g.tbl, g.trg);
    RAISE NOTICE 'TEARDOWN: RE-ENABLED append-only guard %.%', g.tbl, g.trg;
  END LOOP;
END $$;

-- ── STEP B3 — delete ALL auth users (no business.owner_id RESTRICT blocks them now) ──
-- Supabase cascades auth.identities / auth.sessions / auth.refresh_tokens.
DELETE FROM auth.users;

-- ── STEP C — VERIFY (guards restored + everything empty) ─────────────────────────
-- C1 (CRITICAL): every append-only guard is back ON. is_enabled MUST be true for all rows;
--     'D' (disabled) anywhere = STOP, the environment was left unguarded.
SELECT c.relname   AS guarded_table,
       t.tgname    AS trigger_name,
       t.tgenabled AS enabled_flag,        -- expect 'O' (origin-enabled), NEVER 'D'
       (t.tgenabled <> 'D') AS is_enabled  -- expect true for every row
FROM pg_trigger t
JOIN pg_class     c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_proc      p ON p.oid = t.tgfoid
WHERE n.nspname = 'public' AND NOT t.tgisinternal AND p.proname ILIKE 'reject%mutation'
ORDER BY c.relname;

-- C2: pristine — expect 0 everywhere (audit_log included — proves the teardown cleared it).
SELECT 'auth.users'        AS scope, count(*) FROM auth.users
UNION ALL SELECT 'businesses',       count(*) FROM businesses
UNION ALL SELECT 'business_members', count(*) FROM business_members
UNION ALL SELECT 'customers',        count(*) FROM customers
UNION ALL SELECT 'audit_log',        count(*) FROM audit_log;

-- Storage objects (receipt files) are path-based, not FK-linked — clear via the
-- Storage dashboard if a fully empty bucket is wanted. Harmless orphans otherwise.
--
-- ── DAVID OWNER-PROVES THE GUARD IS RESTORED (after STEP C is green) ─────────────
-- A manual mutation on audit_log MUST be rejected (proves the guard is truly back on):
--   BEGIN;
--   UPDATE audit_log SET action = 'tamper' WHERE true;   -- expect: ERROR (append-only)
--   ROLLBACK;
-- (Empty table → 0 rows updated still fires the BEFORE trigger; or insert one row first
--  inside the BEGIN…ROLLBACK to force the guard to fire, then confirm the UPDATE errors.)
