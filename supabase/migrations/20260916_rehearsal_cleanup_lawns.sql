-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260916 — REHEARSAL CLEANUP, LAWNS ONLY, NARROW · ledger #342
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it, as `postgres`, in the SQL EDITOR — and ONLY after:
--    1. supabase/discovery/2026-09-16_rehearsal_state.sql has been run and pasted back, and
--       its query 7c (the exact rows this file deletes) has been read against 7b;
--    2. the latest nightly snapshot has been confirmed in the dashboard (Database → Backups).
--       There is no point-in-time recovery; the snapshot is the floor.
--
-- ⚠️ FILENAME ORDER. David's own `20260916_reverse_seed_qty_on_non_stock_rows.sql` (uncommitted, in
--    his checkout, NOT READ by this session — §6 r20) sorts AFTER this file alphabetically but ran
--    BEFORE it. This file depends on that reversal having happened; it does not re-run it.
--
-- ── WHAT IT REMOVES, AND NOTHING ELSE ───────────────────────────────────────────────────────
-- David's ruling ② (2026-09-16): *"we must never allow them to write to the actual record during
-- testing."* The opening-stock seed (#333) ran on LAWNS in test mode through
-- `adjust_inventory_manual`, which writes the ledger — so the record was written during testing.
-- This removes exactly those rows:
--   SEED     every ledger row on a LAWNS lot with import_run_id IS NOT NULL whose
--            kind = 'opening_stock_seed' AND source_type = 'manual'
--            (`openingStock.ts:58` SEED_LEDGER_KIND; `adjust_inventory_manual` hard-codes 'manual',
--            20260720_inventory_movement_ledger.sql:678-680)
--   REVERSAL every row on the SAME lot, source_type = 'manual', kind <> 'opening_stock_seed',
--            with delta EXACTLY the negative of a positive seed row on that lot, recorded AFTER it,
--            on 2026-09-16 (America/Chicago) — today's reversal of 92 fee rows to qty 0.
--            ⚠️ Identified STRUCTURALLY because the reversal's kind is written nowhere this session
--            may read. If it ran as kind 'opening_stock_seed' (negative delta), SEED already covers
--            it and this set is empty. If it ran as a direct UPDATE, it wrote no ledger row and this
--            set is empty. Discovery 7b shows which.
--
-- ── WHAT IT DOES NOT TOUCH ──────────────────────────────────────────────────────────────────
--   · NO order and NO order-sourced ledger row — order 6a60a0ca and its four rows are HELD
--     (ruling-level follow-up; see the report). Asserted below.
--   · NO lot's qty. A seeded lot keeps its number: in test mode a starting number is qty with no
--     ledger line (ruling ②), which is exactly the state this leaves. A reversed lot is already 0.
--   · No other tenant. No row on a lot with import_run_id IS NULL. No desk edit, count or
--     reconcile row. Asserted below: every other (business, source_type, kind) count is unchanged.
--
-- ── THE APPEND-ONLY TRIGGER ─────────────────────────────────────────────────────────────────
-- `trg_inventory_ledger_immutable` refuses DELETE even for postgres (by design, D-50). The
-- simplest method the postgres role permits is `ALTER TABLE … DISABLE TRIGGER` — postgres OWNS the
-- table (created by migration), and the precedent is `scripts/wipe-for-person-spine.sql:91`.
-- It is TRANSACTIONAL: disabled and re-enabled inside this BEGIN/COMMIT, holding an ACCESS
-- EXCLUSIVE lock throughout, so no other session ever sees the table unguarded — and if anything
-- below raises, the ROLLBACK restores the trigger with everything else. Asserted before COMMIT.
-- ⚠️ `session_replication_role = replica` was NOT used: it silences EVERY trigger in the session,
-- not one, and Supabase does not grant it to postgres on every plan.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- One DO block, no temp tables: every step below is inside it, so a RAISE anywhere rolls back the
-- whole transaction — the DELETE, the trigger toggle and the audit row together.
DO $$
DECLARE
  c_lawns   CONSTANT uuid := 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
  v_ids     uuid[];
  v_seed    int;
  v_rev     int;
  v_before  jsonb;   -- all tenants: 'business|source_type|kind' → rows
  v_after   jsonb;
  v_del     jsonb;   -- LAWNS only:  'business|source_type|kind' → rows deleted
  v_deleted int;
  v_drift   int;
BEGIN
  -- ── §0 PRECONDITION — LAWNS is still rehearsing ─────────────────────────────────────────────
  IF (SELECT qbo_writes_enabled FROM public.businesses WHERE id = c_lawns) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'LAWNS is not in test mode (qbo_writes_enabled is not false). This cleanup is for the rehearsal only. Nothing was changed.';
  END IF;

  -- ── §1 THE TARGET SET (the same predicate as discovery query 7c) ────────────────────────────
  WITH lots AS (
    SELECT bi.id FROM public.business_inventory bi
     WHERE bi.business_id = c_lawns AND bi.import_run_id IS NOT NULL
  ), seed AS (
    SELECT l.id, l.inventory_id, l.delta, l.created_at
      FROM public.business_inventory_ledger l
     WHERE l.business_id = c_lawns
       AND l.inventory_id IN (SELECT id FROM lots)
       AND l.kind = 'opening_stock_seed'
       AND l.source_type = 'manual'
  ), reversal AS (
    SELECT DISTINCT l.id
      FROM public.business_inventory_ledger l
      JOIN seed s ON s.inventory_id = l.inventory_id
     WHERE l.business_id = c_lawns
       AND l.source_type = 'manual'
       AND l.kind <> 'opening_stock_seed'
       AND s.delta > 0
       AND l.delta < 0
       AND l.delta = -s.delta
       AND l.created_at > s.created_at
       AND (l.created_at AT TIME ZONE 'America/Chicago')::date = DATE '2026-09-16'
  )
  SELECT array_agg(id), count(*) FILTER (WHERE part = 'seed'), count(*) FILTER (WHERE part = 'reversal')
    INTO v_ids, v_seed, v_rev
    FROM (SELECT id, 'seed' AS part FROM seed UNION ALL SELECT id, 'reversal' FROM reversal) t;
  v_ids := COALESCE(v_ids, ARRAY[]::uuid[]);

  -- Safety: every target is a manual, lot-bound LAWNS row, and none appears twice.
  IF EXISTS (SELECT 1 FROM public.business_inventory_ledger
              WHERE id = ANY(v_ids)
                AND (source_type IS DISTINCT FROM 'manual' OR inventory_id IS NULL OR business_id <> c_lawns)) THEN
    RAISE EXCEPTION 'cleanup target set contains a non-manual, lot-less or foreign row. Nothing was changed.';
  END IF;
  IF cardinality(v_ids) <> (SELECT count(DISTINCT x) FROM unnest(v_ids) x) THEN
    RAISE EXCEPTION 'cleanup target set contains a row twice. Nothing was changed.';
  END IF;

  -- ── §2 BEFORE — every (business, source_type, kind) count, all tenants ──────────────────────
  SELECT COALESCE(jsonb_object_agg(k, n), '{}'::jsonb) INTO v_before
    FROM (SELECT business_id || '|' || COALESCE(source_type, '(null)') || '|' || kind AS k, count(*) AS n
            FROM public.business_inventory_ledger GROUP BY 1) g;
  SELECT COALESCE(jsonb_object_agg(k, n), '{}'::jsonb) INTO v_del
    FROM (SELECT business_id || '|' || COALESCE(source_type, '(null)') || '|' || kind AS k, count(*) AS n
            FROM public.business_inventory_ledger WHERE id = ANY(v_ids) GROUP BY 1) g;

  -- ── §3 THE DELETE, with the trigger off for exactly this statement ─────────────────────────
  ALTER TABLE public.business_inventory_ledger DISABLE TRIGGER trg_inventory_ledger_immutable;
  DELETE FROM public.business_inventory_ledger
   WHERE id = ANY(v_ids) AND business_id = c_lawns;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ALTER TABLE public.business_inventory_ledger ENABLE TRIGGER trg_inventory_ledger_immutable;

  -- ── §4 AFTER, and the assertions that make a wrong result impossible to COMMIT ─────────────
  SELECT COALESCE(jsonb_object_agg(k, n), '{}'::jsonb) INTO v_after
    FROM (SELECT business_id || '|' || COALESCE(source_type, '(null)') || '|' || kind AS k, count(*) AS n
            FROM public.business_inventory_ledger GROUP BY 1) g;

  IF v_deleted <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'deleted % rows, planned %. Rolled back — nothing changed.', v_deleted, cardinality(v_ids);
  END IF;

  -- Every group, every tenant: after = before − what this deleted from it. Anything else aborts.
  SELECT count(*) INTO v_drift
    FROM (SELECT jsonb_object_keys(v_before) AS k UNION SELECT jsonb_object_keys(v_after)) keys
   WHERE COALESCE((v_before->>k)::int, 0) - COALESCE((v_del->>k)::int, 0) <> COALESCE((v_after->>k)::int, 0);
  IF v_drift > 0 THEN
    RAISE EXCEPTION '% ledger group(s) changed by something other than this cleanup. Rolled back — nothing changed.', v_drift;
  END IF;

  -- No order-sourced row, on any tenant, is in the deleted set.
  IF EXISTS (SELECT 1 FROM jsonb_object_keys(v_del) k WHERE split_part(k, '|', 2) = 'order') THEN
    RAISE EXCEPTION 'an order-sourced ledger row was in the deleted set. Rolled back — nothing changed.';
  END IF;

  -- The guard is back on.
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
                  WHERE tgrelid = 'public.business_inventory_ledger'::regclass
                    AND tgname = 'trg_inventory_ledger_immutable' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'the append-only trigger is not enabled. Rolled back — nothing changed.';
  END IF;

  -- ── §5 EVIDENCE — the audit row this file writes about itself (migration-data-checks.json) ─
  -- It also carries LAWNS's before/after BY SOURCE_TYPE, which §6 prints.
  INSERT INTO public.audit_log
    (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (
    c_lawns, NULL, 'migration', 'ledger.rehearsal_cleanup', 'business', c_lawns::text,
    jsonb_build_object(
      'migration', '20260916_rehearsal_cleanup_lawns.sql',
      'ledger_close_out', 342,
      'deleted', v_deleted, 'seed_rows', v_seed, 'reversal_rows', v_rev,
      'deleted_by_group', v_del,
      'lawns_before_by_source_type', (
        SELECT COALESCE(jsonb_object_agg(st, n), '{}'::jsonb) FROM (
          SELECT split_part(e.key, '|', 2) AS st, sum(e.value::int) AS n
            FROM jsonb_each_text(v_before) e WHERE split_part(e.key, '|', 1) = c_lawns::text GROUP BY 1) q),
      'lawns_after_by_source_type', (
        SELECT COALESCE(jsonb_object_agg(st, n), '{}'::jsonb) FROM (
          SELECT split_part(e.key, '|', 2) AS st, sum(e.value::int) AS n
            FROM jsonb_each_text(v_after) e WHERE split_part(e.key, '|', 1) = c_lawns::text GROUP BY 1) q)),
    'success');

  RAISE NOTICE 'rehearsal cleanup: deleted % ledger rows (% seed, % reversal)', v_deleted, v_seed, v_rev;
END $$;

COMMIT;

-- ── §6 THE REPORT — LAWNS before/after by source_type (the editor shows this last result) ────
SELECT e.key                                                           AS source_type,
       e.value::int                                                    AS before_rows,
       COALESCE((a.detail->'lawns_after_by_source_type'->>e.key)::int, 0) AS after_rows,
       e.value::int - COALESCE((a.detail->'lawns_after_by_source_type'->>e.key)::int, 0) AS removed
  FROM (SELECT detail FROM public.audit_log
         WHERE action = 'ledger.rehearsal_cleanup' ORDER BY created_at DESC LIMIT 1) a
 CROSS JOIN LATERAL jsonb_each_text(a.detail->'lawns_before_by_source_type') e
 ORDER BY 1;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION (run after; paste back)
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 the evidence row:
--   SELECT created_at, detail FROM public.audit_log WHERE action = 'ledger.rehearsal_cleanup';
--   EXPECT 1 row; detail.deleted = the 7c total from the discovery file.
--
-- V2 no seed row is left on a LAWNS import-run lot:
--   SELECT count(*) FROM public.business_inventory_ledger l
--     JOIN public.business_inventory bi ON bi.id = l.inventory_id
--    WHERE bi.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND bi.import_run_id IS NOT NULL
--      AND l.kind = 'opening_stock_seed';
--   EXPECT 0.
--
-- V3 every order-sourced row is still there (order 6a60a0ca's four included):
--   SELECT kind, delta FROM public.business_inventory_ledger
--    WHERE source_type = 'order' AND source_id = '6a60a0ca-dedf-4c1d-a58c-804bf1e64c79' ORDER BY created_at;
--   EXPECT the same four rows as discovery 2c (sale -2, order_created, order_committed, order_fulfilled).
--
-- V4 the append-only guard is ON and still refuses:
--   SELECT tgenabled FROM pg_trigger WHERE tgname = 'trg_inventory_ledger_immutable';   -- EXPECT 'O'
--   BEGIN; DELETE FROM public.business_inventory_ledger WHERE id = (SELECT id FROM public.business_inventory_ledger LIMIT 1); ROLLBACK;
--   EXPECT ERROR: business_inventory_ledger is append-only: DELETE is not permitted.
--
-- V5 the LAWNS total is the discovery-11 total minus 7c's total, and the other two tenants' totals
--    are exactly discovery 11's:
--   SELECT business_id, count(*) FROM public.business_inventory_ledger
--    WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' OR business_id::text LIKE 'f7ec5d67%'
--       OR business_id::text LIKE '06065fe7%'
--    GROUP BY 1;
--
-- V6 no lot's qty moved — spot-check the 6a60a0ca lot still reads 8:
--   SELECT qty FROM public.business_inventory bi
--     JOIN public.order_items oi ON oi.business_inventory_id = bi.id
--    WHERE oi.order_id = '6a60a0ca-dedf-4c1d-a58c-804bf1e64c79';
