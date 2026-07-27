-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727d — PROPOSED: DROP the `nurseries` husk  ⛔ AWAITING DAVID'S RULING
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres — **ONLY ON DAVID'S SAY-SO.** Dropping a table is not a side effect of a
-- security pass, so this ships as its own commit and its own decision.
--
-- WHY IT IS PROPOSED. `nurseries` carries `nurseries_select_public` — SELECT TO public USING
-- (true) — an unscoped world-readable policy, one of the six found in the corrected N6 sweep.
-- David's probes: query (B) returned 0 ROWS / 0 TOKENS, and query (C) returned 0 legacy values on
-- `businesses`. The QB OAuth relocation (20260622) took the values with it and left an EMPTY HUSK
-- still carrying a public read.
--
-- ⚠️ SO NOTHING IS EXPOSED TODAY — this is not a live leak, and the migration is not urgent. What
-- it is: a table nobody writes, nobody reads, and anyone on the internet may SELECT from. The
-- moment a stray INSERT lands there, it is public. Removing the table removes the policy, which is
-- strictly better than keeping a guarded empty room.
--
-- AC-1 BONUS, stated but not the reason: `nurseries` is a VERTICAL NOUN in shared schema, the
-- §1.5 violation the Noun Purge exists to close. Its successor is `businesses`.
--
-- 🔴 BEFORE APPLYING, RUN THE TWO CONFIRMATIONS BELOW. They are cheap and they are the difference
-- between "David's probe said empty last week" and "it is empty now". A DROP is irreversible and
-- an emptiness claim is exactly the kind of artifact this week keeps finding stale.

-- ── CONFIRM 1 — still empty? EXPECT 0.
-- SELECT count(*) AS nursery_rows FROM public.nurseries;

-- ── CONFIRM 2 — does ANYTHING still reference it? EXPECT 0 rows.
--    Corpus is the catalog, not the repo: a foreign key from a table with no migration
--    (tech-debt #27) would be invisible to a source grep.
-- SELECT c.conname, c.conrelid::regclass AS referencing_table
--   FROM pg_constraint c
--  WHERE c.confrelid = 'public.nurseries'::regclass;

-- ── CONFIRM 3 — is any VIEW built on it? A view would break silently on DROP ... CASCADE.
-- SELECT viewname FROM pg_views WHERE schemaname = 'public' AND definition ILIKE '%nurseries%';

BEGIN;

-- RESTRICT, never CASCADE: if anything still depends on this, the DROP must FAIL LOUDLY rather
-- than quietly taking a dependent object with it. CONFIRM 2 and 3 should already be empty — this
-- is the belt to that braces, because a silent cascade is how a "clean husk" removes a live view.
DROP TABLE IF EXISTS public.nurseries RESTRICT;

COMMIT;

-- ── V1 — NEGATIVE: the table and its public policy are both gone. EXPECT 0 rows from each.
-- SELECT tablename FROM pg_tables  WHERE schemaname='public' AND tablename='nurseries';
-- SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='nurseries';

-- ── V2 — the unscoped-public set is now FIVE, not six. Corpus is BOTH roles — `TO public`
--    INCLUDES anon, which is what my first N6 sweep missed by grepping the anon role alone.
-- SELECT tablename, policyname, cmd, roles::text FROM pg_policies
--  WHERE schemaname='public' AND (roles::text LIKE '%anon%' OR roles::text LIKE '%public%')
--    AND qual = 'true'
--  ORDER BY tablename;
