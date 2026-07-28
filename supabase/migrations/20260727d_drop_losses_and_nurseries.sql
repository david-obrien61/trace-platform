-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727d — DROP the pre-`businesses` generation: `losses`, then `nurseries`
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres — **ONLY ON DAVID'S SAY-SO.** Dropping tables is not a side effect of a
-- security pass, so this ships as its own commit and its own decision.
--
-- ── WHAT THESE TWO WERE ─────────────────────────────────────────────────────────
-- `nurseries` was the ORIGINAL TENANT TABLE and `losses` was its LOSS LEDGER — one generation
-- of the schema, superseded by `businesses` and never dropped. The generational marker is on
-- the column: `losses` keys on `nursery_id`, not `business_id`. It was specced in
-- CULTIVAR_OS_CLAUDE_CODE_BRIEF_v2.md (a `/dashboard/losses` page, a staff "record losses"
-- permission, a CREATE TABLE at line 380) and NONE of it was built — no page, no route, no
-- permission string, no client call, no migration (tech-debt **#39** — the CULTIVAR live-only
-- schema class, NOT #27, which is Ignition tables only).
--
-- ⚠️ THIS IS NOT ABANDONMENT BY ASSUMPTION. Loss recording IS still a planned capability; it is
-- planned on a DIFFERENT SHAPE, and that choice predates this drop. The pricing-intelligence
-- story's Layer 3 ("great losses / shrinkage on this line") reads `plant_events` with
-- `event_type = 'lost'` (packages/cultivar-os/src/types/plant.ts:48). It was written down in
-- docs/concepts/margin-aware-pricing-intelligence.md:96 — "treat plant_events['lost'] as the
-- real source, not the orphan `losses` table." Dropping `losses` removes an orphan, not the
-- shape the feature will use.
--
-- `nurseries` carried `qb_access_token` / `qb_refresh_token` columns and a
-- `nurseries_select_public` policy — SELECT **TO public USING (true)**, world-readable. It held
-- ZERO ROWS and ZERO TOKENS: the QB OAuth relocation (20260622) took the values with it and left
-- an empty husk still carrying a public read. **Nothing was ever exposed. That is precisely why
-- this is CLEANUP and not a finding** — no incident, no disclosure, no remediation window. What
-- is being removed is the room, not a leak: a table nobody writes and anyone on the internet may
-- SELECT from is one stray INSERT away from being a real one.
--
-- AC-1 bonus, stated but not the reason: both are VERTICAL NOUNS in shared schema (§1.5 Noun
-- Purge). Their successor is `businesses`.
--
-- SIDE EFFECT, NAMED RATHER THAN SILENT: `losses` sits on the owner-only list in
-- docs/decisions/2026-07-27-rbac-transition-execution-plan.md:288 (a MANAGER holding a
-- permission cannot read a row). That row is retired BY REMOVAL, not by being fixed. Strike it
-- from the plan; do not leave it reading as an unresolved gap.
--
-- ── ORDER AND FORCE ─────────────────────────────────────────────────────────────
-- `losses_nursery_id_fkey` references `nurseries` FROM `losses`. **`losses` drops FIRST and the
-- constraint dissolves with it.** The constraint is NEVER dropped separately to force `nurseries`
-- through — that would be defeating the check that found the dependency rather than satisfying
-- it. Both DROPs are RESTRICT, never CASCADE: if anything still depends on either, this must FAIL
-- LOUDLY, not quietly take a dependent object with it.
--
-- ── EMPTINESS IS RE-CONFIRMED HERE, NOT INHERITED (STD-021 / ledger #159) ───────
-- David probed both at 0 rows. **That claim is NOT trusted by this file.** #159's lesson is that
-- an emptiness claim goes stale between the probe and the apply, so the guard below re-reads the
-- catalog INSIDE the transaction and ABORTS the whole thing if anything has changed. A DROP is
-- irreversible; a stale premise is how an irreversible thing goes wrong.

BEGIN;

-- ── GUARD — runs at APPLY TIME, aborts on any surprise. Not a comment; not dismissible.
--    Covers all three of: rows present · dependent object (pg_depend) · FK from a third table.
DO $$
DECLARE
  v_losses_rows    bigint;
  v_nurseries_rows bigint;
  v_dep            text;
  v_fk             text;
BEGIN
  -- (1) EMPTINESS, re-read now.
  IF to_regclass('public.losses') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.losses' INTO v_losses_rows;
    IF v_losses_rows <> 0 THEN
      RAISE EXCEPTION
        'ABORT: public.losses has % row(s). The premise of this migration is that it is empty. Rows mean this is a DIFFERENT FINDING — stop and report, do not drop.', v_losses_rows;
    END IF;
  END IF;

  IF to_regclass('public.nurseries') IS NOT NULL THEN
    EXECUTE 'SELECT count(*) FROM public.nurseries' INTO v_nurseries_rows;
    IF v_nurseries_rows <> 0 THEN
      RAISE EXCEPTION
        'ABORT: public.nurseries has % row(s) — a stray INSERT landed since the probe. Stop and report.', v_nurseries_rows;
    END IF;
  END IF;

  -- (2) ANY dependent object — view, matview, function, trigger, rule, default, index.
  --     Catalog, not grep: neither table has a migration, so source is blind by construction.
  --     Self-dependencies (the tables' own columns/constraints/indexes/types) are excluded.
  SELECT string_agg(DISTINCT format('%s %s', d.classid::regclass, d.objid::text), ', ')
    INTO v_dep
    FROM pg_depend d
   WHERE d.refobjid IN (
           COALESCE(to_regclass('public.losses'),    0::oid),
           COALESCE(to_regclass('public.nurseries'), 0::oid))
     AND d.deptype IN ('n','a')                       -- normal + auto: real dependents
     AND d.classid <> 'pg_class'::regclass            -- exclude own indexes/toast
     AND NOT (d.classid = 'pg_constraint'::regclass)  -- FKs handled explicitly below
     AND NOT (d.classid = 'pg_type'::regclass)        -- own composite rowtype
     AND NOT (d.classid = 'pg_attrdef'::regclass);    -- own column defaults
  IF v_dep IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: dependent object(s) on losses/nurseries: %. Investigate before dropping.', v_dep;
  END IF;

  -- (3) FK from a THIRD table (i.e. any inbound FK that is not losses -> nurseries).
  --     losses -> nurseries is EXPECTED and dissolves with the losses drop.
  SELECT string_agg(format('%s ON %s', c.conname, c.conrelid::regclass), ', ')
    INTO v_fk
    FROM pg_constraint c
   WHERE c.contype = 'f'
     AND c.confrelid IN (
           COALESCE(to_regclass('public.losses'),    0::oid),
           COALESCE(to_regclass('public.nurseries'), 0::oid))
     AND c.conrelid NOT IN (
           COALESCE(to_regclass('public.losses'),    0::oid),
           COALESCE(to_regclass('public.nurseries'), 0::oid));
  IF v_fk IS NOT NULL THEN
    RAISE EXCEPTION 'ABORT: inbound FK from a third table: %. Resolve that table first.', v_fk;
  END IF;

  RAISE NOTICE 'GUARD PASSED — losses=% rows, nurseries=% rows, no dependents, no third-table FK.',
    COALESCE(v_losses_rows, -1), COALESCE(v_nurseries_rows, -1);
END $$;

-- ── FK ORDER: the ledger before the tenant table it points at.
DROP TABLE IF EXISTS public.losses    RESTRICT;
DROP TABLE IF EXISTS public.nurseries RESTRICT;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run after COMMIT.
-- ════════════════════════════════════════════════════════════════════════════════

-- ── V1 — NEGATIVE: both tables gone. EXPECT 0 rows.
-- SELECT tablename FROM pg_tables
--  WHERE schemaname='public' AND tablename IN ('losses','nurseries');

-- ── V2 — NEGATIVE: their policies went with them, incl. nurseries_select_public. EXPECT 0 rows.
-- SELECT tablename, policyname FROM pg_policies
--  WHERE schemaname='public' AND tablename IN ('losses','nurseries');

-- ── V3 — NEGATIVE: the FK is gone because the table is, not because we dropped it. EXPECT 0.
-- SELECT conname FROM pg_constraint WHERE conname = 'losses_nursery_id_fkey';

-- ── V4 — the unscoped-public set is now FIVE, not six. Corpus is BOTH roles — `TO public`
--    INCLUDES anon, which the first N6 sweep missed by grepping the anon role alone.
-- SELECT tablename, policyname, cmd, roles::text FROM pg_policies
--  WHERE schemaname='public' AND (roles::text LIKE '%anon%' OR roles::text LIKE '%public%')
--    AND qual = 'true'
--  ORDER BY tablename;

-- ── V5 — POSITIVE: the successor shape is untouched. plant_events still carries the loss
--    signal the pricing-intelligence story reads. EXPECT 1 row.
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='plant_events';
