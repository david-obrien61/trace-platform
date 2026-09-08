-- ════════════════════════════════════════════════════════════════════════════════
-- 20260908 — BOOKS REPORT RUNS: what the review said, the last time it ran
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17).
-- 🔴 DAVID APPLIES THIS. It is written as a file and has NOT been run. Nothing in this build has
--    touched the live database — `SUPABASE_SERVICE_KEY` is empty in both env files (tech-debt
--    #183's blocker, recurring), so every statement below is UNVERIFIED AGAINST THE CATALOG and is
--    marked as such in the write-back. The VERIFY block at the foot is what settles it.
--
-- ── WHY THESE TWO TABLES EXIST ────────────────────────────────────────────────
-- The books review is a snapshot. Read twice, and the only thing that says anything about the
-- business is the DIFFERENCE: *33 sizes we could not read last month, 13 today.* That number is
-- the one demonstration this product has, and it cannot be made from a screen that remembers
-- nothing. So each run appends a row, and each finding appends a result.
--
-- 🔴 APPEND-ONLY, AND IT IS ENFORCED BY THE ABSENCE OF A POLICY RATHER THAN BY A PROMISE. There is
-- no UPDATE policy and no DELETE policy on either table. Under RLS, no policy means no rows — so a
-- past run cannot be edited or removed by anybody holding an anon or authenticated key, including
-- the owner. A history that can be rewritten is not a history, and the comparison that rests on it
-- would be worth nothing.
--
-- 🔴 THE COMPARISON KEY IS `(rule_id, rule_version)`, WHICH IS WHY BOTH ARE STORED. A rule whose
-- DEFINITION changes gets a new id, never a new definition under the old one — but a rule can also
-- be legitimately revised in place (wording, a widened denominator), and comparing across that
-- revision would be comparing two different measurements. The version says which measurement this
-- result came from. `booksFindings.ts` carries `RETIRED_RULE_IDS` and a probe that fails if a
-- retired id is ever reused.
--
-- ⚠️ `clean` IS NOT STORED. It is `measured AND matched = 0`, derivable from two columns that are
-- here — and a stored copy is a second representation of one fact that can disagree with it
-- (STD-011). The same reasoning excludes the finding's SENTENCE: prose is regenerated from the
-- rule, and a stored sentence would be the version that goes stale.
--
-- ⚠️ NO CUSTOMER DATA, IN EITHER TABLE. `Finding.rows` — the records behind a count — is screen-
-- only and is deliberately not persisted (R-23 clause b: storing a customer's book of customers is
-- a separate ruling nobody has made). What is stored is counts, and counts name nobody.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.books_report_runs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- The moment the review ran. NOT the moment the books were read — that is per-walk and lives in
  -- `walks` below, because two walks can be read a fortnight apart and collapsing them to one date
  -- would assert a read that did not happen on that day for half the findings.
  ran_at      timestamptz NOT NULL DEFAULT now(),
  -- The three reads, verbatim from `WalkState[]`: entity, read, expected, retrieved, complete,
  -- fromFile, queriedAt. jsonb because the shape belongs to `booksReport.ts` and a column per
  -- field would need a migration every time a walk gains one — this is a RECORD of a run, not a
  -- queryable model.
  walks       jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Were all three walks read AND complete? A run built on a partial read is not comparable with
  -- one built on a whole read, and a comparison across the two would report a business improving
  -- when it only read less. This is the flag that lets a reader refuse the comparison.
  complete    boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.books_report_results (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid NOT NULL REFERENCES public.books_report_runs(id) ON DELETE CASCADE,
  rule_id      text NOT NULL,
  rule_version integer NOT NULL,
  matched      integer NOT NULL,
  -- QUOTED, and the quoting is deliberate. `of` is non-reserved in PostgreSQL and needs no quotes;
  -- they are here so this DDL cannot fail on a future version that reserves it, and so a reader
  -- sees at a glance that the odd-looking name is intentional. It is named `of` and not
  -- `of_count` because it maps one-for-one onto `Finding.population.of`, which is what makes the
  -- mapping checkable by eye instead of by reading two files.
  "of"         integer NOT NULL,
  noun         text NOT NULL,
  -- Money at stake, computed from their own numbers. NULL means "not a money question", which is
  -- a different answer from zero and must stay distinguishable from it (D-9 / A9).
  value        numeric,
  -- FALSE = the rule could not run. A rule that did not run is NOT a rule that found nothing, and
  -- a comparison that treats the two alike will report a defect as fixed the month a walk fails.
  measured     boolean NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS books_report_runs_business_idx
  ON public.books_report_runs (business_id, ran_at DESC);
CREATE INDEX IF NOT EXISTS books_report_results_run_idx
  ON public.books_report_results (run_id);
-- The comparison's own access path: "what did this rule say, run over run".
CREATE INDEX IF NOT EXISTS books_report_results_rule_idx
  ON public.books_report_results (rule_id, rule_version);

COMMENT ON TABLE public.books_report_runs IS
  'One row per run of the QuickBooks books review. Append-only (no UPDATE or DELETE policy). '
  'The point is the DIFFERENCE between two runs — "33 unreadable sizes last month, 13 today" — '
  'which a screen that remembers nothing cannot produce. Holds no customer data.';
COMMENT ON TABLE public.books_report_results IS
  'One row per finding per run, keyed for comparison on (rule_id, rule_version). Append-only. '
  '`clean` is NOT stored: it is measured AND matched = 0, and a stored copy could disagree with '
  'the two columns it is derived from (STD-011). Holds no customer data — counts only.';

ALTER TABLE public.books_report_runs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books_report_results ENABLE ROW LEVEL SECURITY;

-- ── RE-PASTE SAFE. Every CREATE POLICY is preceded by its DROP (#282 found a migration with 12
--    CREATE POLICY and 0 drops, which fails on a second paste and leaves a half-applied file).
DROP POLICY IF EXISTS books_report_runs_owner_all      ON public.books_report_runs;
DROP POLICY IF EXISTS books_report_runs_member_select  ON public.books_report_runs;
DROP POLICY IF EXISTS books_report_runs_member_insert  ON public.books_report_runs;
DROP POLICY IF EXISTS books_report_results_owner_all     ON public.books_report_results;
DROP POLICY IF EXISTS books_report_results_member_select ON public.books_report_results;
DROP POLICY IF EXISTS books_report_results_member_insert ON public.books_report_results;

CREATE POLICY books_report_runs_owner_all ON public.books_report_runs
  FOR ALL TO authenticated
  USING      (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = books_report_runs.business_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.businesses b WHERE b.id = books_report_runs.business_id AND b.owner_id = auth.uid()));

CREATE POLICY books_report_runs_member_select ON public.books_report_runs
  FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:read'));

-- ⚠️ INSERT IS GATED ON `settings:read`, WHICH IS A DELIBERATE, RECORDED DIVERGENCE (§6 r10).
-- The ordinary rule would be a write permission. What this row records is the fact that somebody
-- ran a read they were already authorised to run — `settings:read` is what gates the books read
-- itself — and the row can neither change anything nor be changed afterwards, because there is no
-- UPDATE and no DELETE policy on this table at all. Gating it on `settings:update` instead would
-- mean a manager who can read the books cannot record that she did, so the comparison that is the
-- whole point of these tables would silently never accumulate for her. NO NEW PERMISSION STRING is
-- minted: that is a decision for David, and this build does not make it on his behalf.
CREATE POLICY books_report_runs_member_insert ON public.books_report_runs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'settings:read'));

-- ── RESULTS: scoped THROUGH the run, never through a denormalised business_id ──
-- A copied `business_id` on this table could disagree with its parent's, and a row whose tenant
-- says one thing while its parent says another is exactly the wrong-tenant record AC-3 forbids.
-- The EXISTS join cannot drift, because there is only one place the tenant is written down.
CREATE POLICY books_report_results_owner_all ON public.books_report_results
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books_report_runs r JOIN public.businesses b ON b.id = r.business_id
                  WHERE r.id = books_report_results.run_id AND b.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.books_report_runs r JOIN public.businesses b ON b.id = r.business_id
                  WHERE r.id = books_report_results.run_id AND b.owner_id = auth.uid()));

CREATE POLICY books_report_results_member_select ON public.books_report_results
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.books_report_runs r
                  WHERE r.id = books_report_results.run_id
                    AND public.is_active_member(r.business_id)
                    AND public.has_permission(r.business_id, 'settings:read')));

CREATE POLICY books_report_results_member_insert ON public.books_report_results
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.books_report_runs r
                  WHERE r.id = books_report_results.run_id
                    AND public.is_active_member(r.business_id)
                    AND public.has_permission(r.business_id, 'settings:read')));

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run AFTER applying. TENANT: LAWNS = ed2e5933-45dc-4b9b-a331-ddfd125e7a74.
-- ⚠️ NONE of these has been run. Nothing in this build reached the live database.
-- ════════════════════════════════════════════════════════════════════════════════
--
-- V1 — both tables exist, and their OWNER is `postgres` and not `supabase_admin` (§6 r17: a table
--      created in the dashboard TABLE EDITOR arrives with TRUNCATE and REFERENCES granted to anon,
--      which RLS cannot filter). EXPECT 2 rows, tableowner = 'postgres'.
-- SELECT tablename, tableowner FROM pg_tables
--  WHERE schemaname='public' AND tablename IN ('books_report_runs','books_report_results');
--
-- V2 — 🔴 THE PRIVILEGE FINGERPRINT. EXPECT **ZERO ROWS**. Any row here means the table was made
--      outside the migration path and `anon` can TRUNCATE it.
-- SELECT c.relname, a.grantee::regrole::text, a.privilege_type
--   FROM pg_class c, aclexplode(c.relacl) a
--  WHERE c.relname IN ('books_report_runs','books_report_results')
--    AND a.grantee::regrole::text = 'anon'
--    AND a.privilege_type IN ('TRUNCATE','REFERENCES');
--
-- V3 — RLS is ENABLED on both. EXPECT 2 rows, both true.
-- SELECT relname, relrowsecurity FROM pg_class
--  WHERE relname IN ('books_report_runs','books_report_results');
--
-- V4 — 🔴 APPEND-ONLY, PROVEN BY WHAT IS ABSENT. EXPECT exactly six policies, and the `cmd`
--      column must contain NO 'UPDATE' and NO 'DELETE'. `ALL` on the owner policy is expected and
--      is the owner's own row; there is no member UPDATE or DELETE at any level.
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename IN ('books_report_runs','books_report_results')
--  ORDER BY tablename, policyname;
--
-- V5 — the column named `of` really is called `of`, in lower case. EXPECT 1 row.
-- SELECT column_name, data_type, is_nullable FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='books_report_results' AND column_name='of';
--
-- V6 — nothing has run yet. EXPECT 0 / 0 before the first press of "Read my QuickBooks data".
-- SELECT (SELECT count(*) FROM public.books_report_runs)    AS runs,
--        (SELECT count(*) FROM public.books_report_results) AS results;
--
-- V7 — 🔴 THE PROOF THE TABLES EXIST FOR. After running the review TWICE, this must return TWO
--      rows for a rule that ran both times, with the SAME (rule_id, rule_version) — that is the
--      comparison, and "33 → 13" is what it looks like when something was fixed in between.
-- SELECT r.ran_at, x.rule_id, x.rule_version, x.matched, x."of", x.measured
--   FROM public.books_report_results x
--   JOIN public.books_report_runs r ON r.id = x.run_id
--  WHERE r.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND x.rule_id = 'sizes-we-could-not-read'
--  ORDER BY r.ran_at;
