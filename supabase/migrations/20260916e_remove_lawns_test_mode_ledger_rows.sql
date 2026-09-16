-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260916e — LAWNS: REMOVE THE STOCK-LEDGER ROWS TESTING WROTE · ledgers #335 / #342
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it, as `postgres`, in the SQL EDITOR (§6 r17).
--    ORDER: 20260916a (the test-mode ledger guard, standalone) → 20260916c → THIS FILE.
--    It REPLACES `20260916_rehearsal_cleanup_lawns.sql`, which was NOT applied: discovery
--    2026-09-16 (query 7c) found zero seed rows, so it would have deleted nothing.
--
-- David's ruling ②: *"we must never allow them to write to the actual record during testing."*
-- Two test-mode actions on LAWNS did write it. This removes exactly those, and NOTHING ELSE:
--
--   PART A — THE DESERT WILLOW PRACTICE ORDER. Order 6a60a0ca-dedf-4c1d-a58c-804bf1e64c79: a
--     test-mode walk-in rung up by Lauren on 2026-09-09 (2 × Desert Willow 30 Gallon, $1,875).
--     Its four ledger rows, its child rows, then the order. Its lot goes back from 8 to 10.
--   PART B — THE LACEY OAK 30 GALLON DELETION. Lauren's desk delete of 2026-09-16 20:27:42 UTC
--     wrote one `delete_tombstone` row. That ledger row is removed. The lot STAYS deleted, and
--     the audit_log row that records the delete STAYS — the audit log is the permanent record.
--
-- LIVE RE-READ (read-only PAT, 2026-09-16, after 20:00 UTC): six LAWNS ledger rows. One is Part
--   B's tombstone. The other five are `order_fulfilled` taps on CAPTURED (history) orders by
--   Lauren, 20:50:18–20:51:20 — the record of real sales; they stay. LAWNS total: 475 rows.
--   So the only test-mode activity since 20:00 is Part B, and nothing is added here.
--
-- 🔴 EVERY PART REFUSES — AND CHANGES NOTHING — IF ANYTHING DIFFERS FROM WHAT WAS MEASURED.
--    That includes the LAWNS ledger total (475): with 20260916a applied first, test mode can no
--    longer add rows, so a different total means something changed that this file has not read.
-- 🔴 THE APPEND-ONLY TRIGGER is disabled for this transaction only (postgres owns the table —
--    the precedent is scripts/wipe-for-person-spine.sql) and re-enabled before COMMIT; checked.
-- ⚠️ AN EVIDENCE ROW is written to audit_log (`ledger.test_mode_removal`) so the apply can be
--    observed later (migration-data-checks.json).
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
DECLARE
  c_lawns    CONSTANT uuid := 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
  c_lauren   CONSTANT uuid := '790b31d2-7b65-45ec-953f-79855453a73e';
  c_run      CONSTANT uuid := 'eab7fbd2-04cd-45e5-b771-cbb07f662f6f';
  -- Part A
  c_order    CONSTANT uuid := '6a60a0ca-dedf-4c1d-a58c-804bf1e64c79';
  c_willow   CONSTANT uuid := '3406972d-84b9-4454-b5bb-777a2169db0f';
  c_line     CONSTANT uuid := 'b8613d5a-3171-4b09-b434-438ef8111c80';
  c_a_sale   CONSTANT uuid := '3e6c5800-5897-4868-83dc-b08f23fdfa38';
  c_a_create CONSTANT uuid := 'd996c0a9-3460-4095-837e-cd845aefa0b5';
  c_a_commit CONSTANT uuid := '5d87dad9-459d-4dfa-b5bb-9328500bfcee';
  c_a_fulfil CONSTANT uuid := '45b9de2a-fb19-4f69-82db-b23702831aeb';
  -- Part B
  c_lacey    CONSTANT uuid := 'dc178b31-4daf-46fa-8232-529be1b7786d';
  c_b_tomb   CONSTANT uuid := 'cb806bbe-8f60-4a1d-9123-315f9ed76a0c';
  c_total_before CONSTANT int := 475;
  c_total_after  CONSTANT int := 470;

  n int; m int; v_email text; v_ok boolean;
  v_held int; v_live_orders int; v_live_lines int; v_live_stops int; v_other int := 0;
  r record;
BEGIN
  -- ── PRECONDITIONS ────────────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'orders' AND column_name = 'import_run_id')
     OR to_regprocedure('public.undo_import_run(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'REFUSED: apply 20260916c_practice_orders_and_one_unit_undo.sql first. Nothing changed.';
  END IF;
  IF (SELECT qbo_writes_enabled FROM public.businesses WHERE id = c_lawns) IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'REFUSED: LAWNS is not in test mode. Nothing changed.';
  END IF;
  SELECT count(*) INTO n FROM public.business_inventory_ledger WHERE business_id = c_lawns;
  IF n <> c_total_before THEN
    RAISE EXCEPTION 'REFUSED: LAWNS has % ledger rows, this file was written against %. Something changed — re-read before running. Nothing changed.', n, c_total_before;
  END IF;
  -- Every LAWNS ledger row since 2026-09-16 20:00 UTC that is not an event on a CAPTURED order
  -- must be Part B's tombstone and nothing else.
  SELECT count(*), count(*) FILTER (WHERE l.id = c_b_tomb) INTO n, m
    FROM public.business_inventory_ledger l
    LEFT JOIN public.orders o ON o.id = l.source_id AND l.source_type = 'order'
   WHERE l.business_id = c_lawns AND l.created_at > '2026-09-16 20:00:00+00'
     AND NOT (l.source_type = 'order' AND o.order_kind = 'history');
  IF n <> 1 OR m <> 1 THEN
    RAISE EXCEPTION 'REFUSED: % test-mode ledger row(s) on LAWNS since 20:00 UTC (expected exactly the Lacey Oak tombstone). Re-read and add them. Nothing changed.', n;
  END IF;

  -- ── PART A CHECKS ────────────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.orders
                  WHERE id = c_order AND business_id = c_lawns AND order_kind = 'test'
                    AND (created_at AT TIME ZONE 'UTC')::date = '2026-09-09') THEN
    RAISE EXCEPTION 'REFUSED (A): order 6a60a0ca is not a LAWNS test order created 2026-09-09. Nothing changed.';
  END IF;
  SELECT u.email INTO v_email FROM public.business_inventory_ledger l JOIN auth.users u ON u.id = l.actor_user_id
   WHERE l.id = c_a_create AND l.kind = 'order_created' AND l.source_id = c_order;
  IF v_email IS DISTINCT FROM 'lauren@lawnstrees.com' THEN
    RAISE EXCEPTION 'REFUSED (A): order 6a60a0ca was not created by lauren@lawnstrees.com (found %). Nothing changed.', v_email;
  END IF;
  SELECT count(*) INTO n FROM public.business_inventory_ledger WHERE source_id = c_order;
  SELECT count(*) INTO m FROM public.business_inventory_ledger
   WHERE business_id = c_lawns AND source_id = c_order AND source_type = 'order' AND actor_user_id = c_lauren
     AND ((id = c_a_sale   AND kind = 'sale'            AND delta = -2 AND inventory_id = c_willow)
       OR (id = c_a_create AND kind = 'order_created'   AND delta = 0  AND inventory_id IS NULL)
       OR (id = c_a_commit AND kind = 'order_committed' AND delta = 0  AND inventory_id IS NULL)
       OR (id = c_a_fulfil AND kind = 'order_fulfilled' AND delta = 0  AND inventory_id IS NULL));
  IF n <> 4 OR m <> 4 THEN
    RAISE EXCEPTION 'REFUSED (A): order 6a60a0ca has % ledger rows, % of them the four expected. Nothing changed.', n, m;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_inventory
                  WHERE id = c_willow AND business_id = c_lawns AND qty = 8 AND status <> 'deleted') THEN
    RAISE EXCEPTION 'REFUSED (A): the Desert Willow lot is not at qty 8. Nothing changed.';
  END IF;
  SELECT count(*) INTO n FROM public.business_inventory_ledger WHERE inventory_id = c_willow;
  IF n <> 1 THEN
    RAISE EXCEPTION 'REFUSED (A): the Desert Willow lot has % ledger rows (expected only the practice sale). Nothing changed.', n;
  END IF;
  SELECT count(*) INTO n FROM public.order_items WHERE order_id = c_order;
  SELECT count(*) INTO m FROM public.order_items WHERE order_id = c_order AND id = c_line AND business_inventory_id = c_willow AND quantity = 2;
  IF n <> 1 OR m <> 1 THEN
    RAISE EXCEPTION 'REFUSED (A): order 6a60a0ca has % line(s), not the one expected. Nothing changed.', n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.deliveries WHERE order_id = c_order) THEN
    RAISE EXCEPTION 'REFUSED (A): a delivery stop belongs to order 6a60a0ca. Nothing changed.';
  END IF;

  -- ── PART B CHECKS ────────────────────────────────────────────────────────────────────────
  IF NOT EXISTS (SELECT 1 FROM public.business_inventory_ledger
                  WHERE id = c_b_tomb AND business_id = c_lawns AND inventory_id = c_lacey
                    AND kind = 'delete_tombstone' AND delta = -10 AND actor_user_id = c_lauren
                    AND created_at = '2026-09-16 20:27:42.020857+00') THEN
    RAISE EXCEPTION 'REFUSED (B): ledger row cb806bbe is not the Lacey Oak tombstone as measured. Nothing changed.';
  END IF;
  SELECT count(*) INTO n FROM public.business_inventory_ledger WHERE inventory_id = c_lacey;
  IF n <> 1 THEN
    RAISE EXCEPTION 'REFUSED (B): the Lacey Oak lot has % ledger rows (expected only the tombstone). Nothing changed.', n;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.business_inventory
                  WHERE id = c_lacey AND business_id = c_lawns AND status = 'deleted' AND qty = 0
                    AND import_run_id = c_run) THEN
    RAISE EXCEPTION 'REFUSED (B): the Lacey Oak lot is not deleted / qty 0 / from run eab7fbd2. Nothing changed.';
  END IF;
  SELECT (SELECT count(*) FROM public.order_items WHERE business_inventory_id = c_lacey)
       + (SELECT count(*) FROM public.inventory_counts WHERE inventory_id = c_lacey) INTO n;
  -- every other FK into business_inventory, from the catalog (cultivar_plants, production_plan_lines, …)
  FOR r IN
    SELECT c.conrelid::regclass AS child, a.attname AS col
      FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
       AND c.confrelid = 'public.business_inventory'::regclass
       AND c.conrelid NOT IN ('public.business_inventory_ledger'::regclass, 'public.order_items'::regclass,
                              'public.inventory_counts'::regclass)
  LOOP
    EXECUTE format('SELECT count(*) FROM %s WHERE %I = $1', r.child, r.col) INTO m USING c_lacey;
    n := n + m;
  END LOOP;
  IF n <> 0 THEN
    RAISE EXCEPTION 'REFUSED (B): % row(s) reference the Lacey Oak lot. Nothing changed.', n;
  END IF;

  -- ── WRITES ──────────────────────────────────────────────────────────────────────────────
  ALTER TABLE public.business_inventory_ledger DISABLE TRIGGER trg_inventory_ledger_immutable;

  DELETE FROM public.business_inventory_ledger
   WHERE id IN (c_a_sale, c_a_create, c_a_commit, c_a_fulfil, c_b_tomb);
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 5 THEN RAISE EXCEPTION 'deleted % ledger rows, planned 5. Rolled back — nothing changed.', n; END IF;

  ALTER TABLE public.business_inventory_ledger ENABLE TRIGGER trg_inventory_ledger_immutable;

  DELETE FROM public.order_service_selections WHERE order_id = c_order;
  DELETE FROM public.order_compliance_records WHERE order_id = c_order;
  IF to_regclass('public.order_addons') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.order_addons WHERE order_id = $1' USING c_order;
  END IF;
  DELETE FROM public.order_items WHERE order_id = c_order;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'deleted % order lines, planned 1. Rolled back.', n; END IF;
  DELETE FROM public.orders WHERE id = c_order AND business_id = c_lawns AND order_kind = 'test';
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'deleted % orders, planned 1. Rolled back.', n; END IF;

  UPDATE public.business_inventory SET qty = 10 WHERE id = c_willow AND business_id = c_lawns AND qty = 8;
  GET DIAGNOSTICS n = ROW_COUNT;
  IF n <> 1 THEN RAISE EXCEPTION 'restored % Desert Willow lots, planned 1. Rolled back.', n; END IF;

  -- ── CHECKS AFTER THE WRITES — any failure rolls every write back ────────────────────────
  IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_trigger
                  WHERE tgrelid = 'public.business_inventory_ledger'::regclass
                    AND tgname = 'trg_inventory_ledger_immutable' AND tgenabled = 'O') THEN
    RAISE EXCEPTION 'the append-only trigger is not enabled. Rolled back.';
  END IF;
  SELECT count(*) INTO n FROM public.business_inventory_ledger WHERE business_id = c_lawns;
  IF n <> c_total_after THEN
    RAISE EXCEPTION 'LAWNS has % ledger rows after, expected %. Rolled back.', n, c_total_after;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.audit_log WHERE target_id = c_lacey::text AND action = 'inventory.delete') THEN
    RAISE EXCEPTION 'the audit row of the Lacey Oak delete is gone. Rolled back.';
  END IF;

  -- The refusal query of 20260916c's undo_import_run, for run eab7fbd2, read-only: ZERO blockers.
  SELECT count(DISTINCT bi.id) INTO v_held
    FROM public.business_inventory bi JOIN public.business_inventory_ledger l ON l.inventory_id = bi.id
   WHERE bi.business_id = c_lawns AND bi.import_run_id = c_run;
  SELECT count(*) INTO v_live_orders
    FROM public.orders o JOIN public.customers c ON c.id = o.customer_id
   WHERE o.business_id = c_lawns AND c.business_id = c_lawns AND c.import_run_id = c_run
     AND NOT (o.order_kind IS NOT DISTINCT FROM 'test' AND o.import_run_id IS NOT DISTINCT FROM c_run);
  SELECT count(*) INTO v_live_lines
    FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
    JOIN public.business_inventory bi ON bi.id = oi.business_inventory_id
   WHERE o.business_id = c_lawns AND bi.business_id = c_lawns AND bi.import_run_id = c_run
     AND NOT (o.order_kind IS NOT DISTINCT FROM 'test' AND o.import_run_id IS NOT DISTINCT FROM c_run);
  SELECT count(*) INTO v_live_stops
    FROM public.deliveries d JOIN public.customers c ON c.id = d.customer_id
   WHERE d.business_id = c_lawns AND c.business_id = c_lawns AND c.import_run_id = c_run
     AND NOT EXISTS (SELECT 1 FROM public.orders o WHERE o.id = d.order_id AND o.business_id = c_lawns
                      AND o.order_kind = 'test' AND o.import_run_id = c_run);
  FOR r IN
    SELECT c.conrelid::regclass AS child, a.attname AS col, c.confrelid::regclass AS parent,
           (c.conrelid = c.confrelid) AS self_ref
      FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f' AND array_length(c.conkey, 1) = 1
       AND c.confrelid IN ('public.business_inventory'::regclass, 'public.customers'::regclass)
       AND c.conrelid NOT IN ('public.business_inventory_ledger'::regclass, 'public.orders'::regclass,
                              'public.order_items'::regclass, 'public.deliveries'::regclass)
  LOOP
    EXECUTE format('SELECT count(*) FROM %s t JOIN %s p ON p.id = t.%I WHERE p.business_id = $1 AND p.import_run_id = $2 %s',
      r.child, r.parent, r.col, CASE WHEN r.self_ref THEN 'AND t.import_run_id IS DISTINCT FROM $2' ELSE '' END)
      INTO m USING c_lawns, c_run;
    v_other := v_other + m;
  END LOOP;
  IF v_held + v_live_orders + v_live_lines + v_live_stops + v_other > 0 THEN
    RAISE EXCEPTION 'the import undo would still refuse run eab7fbd2 (held lots %, live orders %, live lines %, live stops %, other references %). Rolled back.',
      v_held, v_live_orders, v_live_lines, v_live_stops, v_other;
  END IF;

  INSERT INTO public.audit_log (business_id, actor_role, action, target_type, target_id, detail)
  VALUES (c_lawns, 'system', 'ledger.test_mode_removal', 'business_inventory_ledger', NULL,
          jsonb_build_object('migration', '20260916e_remove_lawns_test_mode_ledger_rows.sql',
                             'ledger_rows_deleted', 5, 'order_deleted', c_order, 'order_lines_deleted', 1,
                             'lot_restored', c_willow, 'lot_qty', 10, 'tombstone_deleted', c_b_tomb,
                             'ledger_total_before', c_total_before, 'ledger_total_after', c_total_after));

  RAISE NOTICE 'LAWNS test-mode removal: 5 ledger rows (4 practice order + 1 tombstone), order 6a60a0ca and its line, Desert Willow 8 → 10. Ledger % → %. The import undo for run eab7fbd2 has zero blockers.',
    c_total_before, c_total_after;
END $$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — read-only, after applying. Paste one at a time.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · before/after, from the evidence row. EXPECT one row: 5 · 475 · 470.
-- SELECT detail->>'ledger_rows_deleted' AS deleted, detail->>'ledger_total_before' AS before,
--        detail->>'ledger_total_after' AS after, created_at
--   FROM public.audit_log WHERE action = 'ledger.test_mode_removal';
--
-- V2 · what is left. EXPECT: ledger 470 · order gone 0 · Desert Willow 10 · Lacey Oak deleted/0 ·
--      its audit row 1 · the append-only trigger O.
-- SELECT (SELECT count(*) FROM public.business_inventory_ledger WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74') AS lawns_ledger,
--        (SELECT count(*) FROM public.orders WHERE id = '6a60a0ca-dedf-4c1d-a58c-804bf1e64c79') AS practice_order,
--        (SELECT qty FROM public.business_inventory WHERE id = '3406972d-84b9-4454-b5bb-777a2169db0f') AS desert_willow_qty,
--        (SELECT status || ' / ' || qty FROM public.business_inventory WHERE id = 'dc178b31-4daf-46fa-8232-529be1b7786d') AS lacey_oak,
--        (SELECT count(*) FROM public.audit_log WHERE target_id = 'dc178b31-4daf-46fa-8232-529be1b7786d') AS lacey_audit_rows,
--        (SELECT tgenabled FROM pg_trigger WHERE tgname = 'trg_inventory_ledger_immutable') AS append_only;
