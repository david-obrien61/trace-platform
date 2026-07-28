-- ════════════════════════════════════════════════════════════════════════════════
-- 20260728b — DEFAULT PRIVILEGES: the durable half of 20260728 (§2, now resolved)
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres.
--
-- ⚠️ REPO-AUTHORITY RECORD. David applied BOTH statements below by hand and read the catalog
--    back. This file is the replayable form.
--
-- ⚠️ WHY THIS IS A SECOND FILE AND NOT AN EDIT TO `20260728`. That migration's §2 was left
--    deliberately unwritten, pending the `pg_default_acl` read, with the sequencing stated in it:
--    if §1 is applied before the read returns, §2 becomes its own appended file. §1 WAS applied
--    first. Editing an applied migration recreates the exact repo/DB disagreement that record
--    exists to prevent (§6 r1, migrations are append-only). So: `20260728b`.
--
-- ── WHAT `pg_default_acl` SAID, AND WHY §1 ALONE WAS NOT ENOUGH ──────────────────
-- A default ACL on `public` DID grant TRUNCATE and REFERENCES to the client roles. §1 expanded
-- ONCE over the tables existing at apply time; every table created afterwards would have arrived
-- carrying them again. §1 was a point-in-time cleanup; this is the rule that keeps it true.
--
-- The read named `postgres` as the granting role, so `FOR ROLE postgres` is explicit below. This
-- is not decoration — a default ACL is keyed by (grantor, schema, object type), and omitting
-- `FOR ROLE` targets only entries whose grantor is the CURRENT role. Had the entry belonged to
-- another role, the bare form would have run clean, reported success, and changed nothing.
--
-- VERIFIED BY DAVID AFTER APPLY: the `postgres` / objtype `'r'` row in `pg_default_acl` now reads
-- `anon=arwdtm` — **`D` (TRUNCATE) and `x` (REFERENCES) are gone**, INSERT/SELECT/UPDATE/DELETE/
-- TRIGGER/MAINTAIN remain. The letters are the proof; the statement succeeding is not.

BEGIN;

-- Re-assert §1 over today's tables. Idempotent (REVOKE of an unheld privilege is a no-op) and
-- kept here deliberately: on a rebuild the two statements must land TOGETHER, because a default
-- ACL governs only FUTURE objects and never retroactively fixes one already created.
REVOKE TRUNCATE, REFERENCES ON ALL TABLES IN SCHEMA public FROM anon, authenticated;

-- The durable half: every table created BY POSTGRES in `public` from here on.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE TRUNCATE, REFERENCES ON TABLES FROM anon, authenticated;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 THE RESIDUAL — THIS IS NOT FULLY CLOSED, AND THE GAP IS A WORKFLOW, NOT A STATEMENT
-- ════════════════════════════════════════════════════════════════════════════════
-- THE SAME `ALTER` AGAINST `supabase_admin` WAS **DENIED**. Supabase owns that role and does not
-- grant membership in it, so its default ACL on `public` cannot be altered from here. It is not an
-- oversight and there is no statement that fixes it — it is a property of managed Postgres.
--
-- WHY THAT MATTERS: `supabase_admin` is the role that creates tables WHEN SUPABASE DOES — i.e.
-- **the dashboard table editor**. Its default ACL still grants TRUNCATE and REFERENCES to `anon`.
--
--   ⇒ A TABLE CREATED THROUGH THE DASHBOARD UI ARRIVES WITH `TRUNCATE` AND `REFERENCES`
--     GRANTED TO `anon` ALL OVER AGAIN — silently, looking exactly like every other table.
--
-- ⚠️ THE WORKFLOW CONSTRAINT THAT FOLLOWS (binding):
--
--        ***  CREATE TABLES THROUGH MIGRATIONS, NOT THE DASHBOARD.  ***
--
--    Not a style preference. The migration path runs as `postgres`, whose default ACL is now
--    correct; the dashboard path runs as `supabase_admin`, whose default ACL cannot be corrected.
--    Same table, same schema, different privileges — decided by which window it was typed into.
--
-- THE GOOD NEWS: this is DETECTABLE, and the detector is exact. A table in `public` carrying
-- TRUNCATE or REFERENCES for `anon` after this migration was, with near-certainty, created outside
-- the migration path. The privilege is the fingerprint.

-- ── ASSERTION A — 🔴 THE DASHBOARD-CREATED-TABLE DETECTOR. EXPECT 0 ROWS, ALWAYS, FOREVER.
--    Any row is a table that acquired these privileges outside the migration path. Remediate with
--    the §1 statement above, then find out who created it and how.
--
-- SELECT c.relname                    AS table_name,
--        a.grantee::regrole::text     AS grantee,
--        a.privilege_type,
--        pg_get_userbyid(c.relowner)  AS owner   -- expect `supabase_admin` on a violation
--   FROM pg_class c
--   JOIN pg_namespace n ON n.oid = c.relnamespace
--   CROSS JOIN LATERAL aclexplode(c.relacl) a
--  WHERE n.nspname = 'public'
--    AND c.relkind IN ('r','p','v','m','f')
--    AND a.grantee::regrole::text IN ('anon', 'authenticated')
--    AND a.privilege_type IN ('TRUNCATE', 'REFERENCES')
--  ORDER BY c.relname, grantee, a.privilege_type;
--
-- ⚠️ READ `pg_class.relacl` VIA `aclexplode`, **NOT** `information_schema.role_table_grants` —
--    AND THIS IS A CORRECTNESS POINT, NOT A PREFERENCE. The information_schema view only exposes
--    grants where the querying role is the grantor or a member of the grantee. Run from a role
--    that is not a member of `anon`, it returns ZERO ROWS ON A DATABASE FULL OF VIOLATIONS —
--    a false green produced by the checker's own permissions. `pg_class.relacl` is the raw catalog
--    and is readable regardless. (`relacl` NULL = owner-defaults-only = no grant to anon at all,
--    so `aclexplode` correctly yields nothing for it.)
--
-- ⚠️ WHERE THIS ASSERTION SHOULD LIVE, AND WHY IT DOES NOT LIVE THERE YET: the schema snapshot
--    checker named in ledger #159b (a committed catalog dump, ~600 rows) **does not exist yet**,
--    and `scripts/verify-universals.mjs` CANNOT host it — that script reads migration .sql files
--    from the repo, and this is a claim about the live catalog, which is precisely the class of
--    fact the repo cannot answer (STD-021 v2.8: privileges are catalog facts). So today this is a
--    query David runs. It is written here in its final form so the checker inherits it verbatim
--    when it is built, rather than being re-derived. Recorded as OWED, not as done.

-- ── ASSERTION B — the default ACL itself. EXPECT `postgres`/`r` to show no `D` and no `x` for
--    anon or authenticated. `supabase_admin`'s row WILL still show them; that is the known,
--    unfixable residual above, not a failure of this migration.
-- SELECT d.defaclrole::regrole AS granting_role, d.defaclobjtype AS obj_type, d.defaclacl AS acl
--   FROM pg_default_acl d
--   JOIN pg_namespace n ON n.oid = d.defaclnamespace
--  WHERE n.nspname = 'public'
--  ORDER BY granting_role, obj_type;

-- ── ASSERTION C — proven by BREAKING it (STD-022). A fresh table is the only thing that
--    distinguishes "the default ACL was fixed" from "there was never one to fix." Rolls back.
-- BEGIN;
--   CREATE TABLE public._privilege_probe (id int);
--   SELECT a.grantee::regrole::text AS grantee, a.privilege_type
--     FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
--    WHERE c.oid = 'public._privilege_probe'::regclass
--      AND a.grantee::regrole::text IN ('anon', 'authenticated')
--    ORDER BY grantee, a.privilege_type;
-- ROLLBACK;
--    EXPECT: INSERT/SELECT/UPDATE/DELETE/TRIGGER — and NO TRUNCATE, NO REFERENCES.


-- ── STILL OPEN, RECORDED NOT BLOCKING (carried forward from 20260728, unchanged) ─
-- `anon` HOLDS INSERT / UPDATE / DELETE ON ~45 BASE TABLES, and **RLS is the only line** — it is
-- on everywhere, which is why this is a follow-on and not a hole. Scoping it down needs a corpus
-- check of what anon actually writes, and that is its own build.
