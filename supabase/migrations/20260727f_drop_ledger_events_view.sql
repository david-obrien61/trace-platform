-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727f — 🔴 DROP the `business_inventory_ledger_events` VIEW (RLS bypass)
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres. David has already REVOKED anon — that was containment. This is the fix.
--
-- WHAT IT IS. A view runs with the privileges of its OWNER unless `security_invoker = on`
-- (PG15+, default OFF). This view is owned by `postgres`, so it read
-- `business_inventory_ledger` AS POSTGRES and the base table's RLS NEVER EVALUATED.
-- Unauthenticated cross-tenant read of every tenant's full inventory ledger.
--
-- 🔴 AND A WRITE PATH, WHICH IS WORSE. The view is a simple single-table SELECT — no DISTINCT,
-- no GROUP BY, no aggregate — so it is AUTO-UPDATABLE. `authenticated` held INSERT/UPDATE/DELETE
-- on it. The ledger's append-only guarantee is a trigger, `trg_inventory_ledger_immutable`, and
-- that trigger is **BEFORE UPDATE OR DELETE** — INSERT IS NOT BLOCKED. So an authenticated user of
-- ANY tenant could FORGE ledger rows into ANY OTHER TENANT, through a path where RLS does not
-- evaluate and the immutability trigger does not fire. D-50's whole integrity claim runs through
-- that table.
--
-- ⚠️ THE MIGRATION THAT CREATED IT ASSERTED THE OPPOSITE, IN A COMMENT
-- (20260720_ledger_event_store_columns.sql:99):
--     "The view inherits the base table's RLS (it is not SECURITY DEFINER and has no BYPASSRLS),
--      so tenant scope stays exactly LAYER 1's two policies — nothing is widened here."
-- Both named mechanisms are the WRONG ONES. `SECURITY DEFINER` is a FUNCTION attribute;
-- `BYPASSRLS` is a ROLE attribute. Neither governs a view. The governing setting is
-- `security_invoker`, which is absent, which is exactly what makes it unsafe. **A safety claim
-- derived from the absence of two irrelevant things** — the sixth instance this week of an
-- artifact confidently naming what is not there, and the first one that was load-bearing.
--
-- 🔴 THE GRANTS DID NOT COME FROM THAT MIGRATION EITHER. It wrote exactly one line —
-- `GRANT SELECT ON ... TO authenticated, service_role` (:101). It never granted anon anything and
-- never granted INSERT/UPDATE/DELETE to anybody. The catalog shows both. So the extra privileges
-- came from somewhere else — Supabase's default privileges on objects created in `public` are the
-- obvious candidate. **A migration's GRANT line does not describe an object's actual privileges**,
-- which is precisely why the standing sweep must read `information_schema.role_table_grants` and
-- not the repo (STD-021 v2.8).
--
-- WHY DROP RATHER THAN `SET (security_invoker = on)`:
--   NOTHING READS IT. Corpus: packages/cultivar-os/src · packages/cultivar-os/api ·
--   packages/shared/src · scripts · api · supabase/migrations. Every occurrence of the name is
--   INSIDE the creating migration — its definition, its grant, its COMMENT, and one commented-out
--   verify. Zero application readers, so nothing depends on the bypass and nothing breaks.
--   security_invoker would leave a correct-but-unused object carrying default privileges nobody
--   audits. The COALESCE it exists to centralise has no caller to centralise for.
--
-- IF A READER APPEARS LATER, recreate it WITH `security_invoker = on` and grant SELECT
-- explicitly — never rely on the default grants that produced this.

BEGIN;

DROP VIEW IF EXISTS public.business_inventory_ledger_events;

COMMIT;

-- ── V1 — NEGATIVE: the view is gone. EXPECT 0 rows.
-- SELECT table_name, table_type FROM information_schema.tables
--  WHERE table_schema='public' AND table_name='business_inventory_ledger_events';

-- ── V2 — NEGATIVE: no grant survives on it for anon or authenticated. EXPECT 0 rows.
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='business_inventory_ledger_events';

-- ── V3 — the base table still answers, and its RLS still holds. EXPECT the two LAYER 1 policies.
-- SELECT policyname, cmd, qual FROM pg_policies
--  WHERE schemaname='public' AND tablename='business_inventory_ledger';

-- ── V4 — 🔴 THE STANDING SWEEP (David's item 1, second half). Which objects grant anon or
--    authenticated ANYTHING beyond SELECT, and are any of them views? Catalog, not repo —
--    a migration's GRANT line does not describe reality.
-- SELECT g.table_name, t.table_type, g.grantee,
--        string_agg(g.privilege_type, ', ' ORDER BY g.privilege_type) AS privileges,
--        (SELECT c.relrowsecurity FROM pg_class c
--          WHERE c.oid = ('public.' || quote_ident(g.table_name))::regclass) AS rls_enabled
--   FROM information_schema.role_table_grants g
--   JOIN information_schema.tables t
--     ON t.table_schema = g.table_schema AND t.table_name = g.table_name
--  WHERE g.table_schema = 'public' AND g.grantee IN ('anon', 'authenticated')
--  GROUP BY g.table_name, t.table_type, g.grantee
--  ORDER BY t.table_type DESC, g.table_name, g.grantee;
--
-- READ IT FOR TWO THINGS: (1) any VIEW at all — a view has no policies, so RLS cannot protect it
-- and `rls_enabled` will be NULL; (2) any BASE TABLE where rls_enabled is false, which would mean
-- the grant is the ONLY thing standing. On base tables RLS does hold — that is the difference
-- from the view — but it means every base table's protection rests ENTIRELY on its policies being
-- right, with nothing beneath.
