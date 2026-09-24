-- ─────────────────────────────────────────────────────────────────────────────
-- undo_import_run — THE PRE-FIX DEFINITION, PINNED. Ledger #348's R-block subject.
--
-- 🔴 WHY THIS FILE EXISTS. R1/R2 prove the DEFECT: before 20260917b, `undo_import_run`
-- REFUSED in test mode as soon as a person had typed a contact row, so the wipe was
-- blocked by the very editing test mode exists for. The probe used to get this definition
-- by loading the live-schema snapshot with `applyMigration: false` — i.e. it depended on
-- the SNAPSHOT still lacking the fix.
--
-- That made a RED-FIRST probe quietly dependent on a file nobody thinks of as its input.
-- When #391 refreshed the snapshot from live (fix applied), R1/R2 began FAILING on that
-- branch while passing on main — the probe reporting on the fixture's age, not on the code.
-- A probe whose subject can be swapped out from under it is not pinned to anything.
--
-- ⚠️ SO THE SUBJECT IS CARRIED HERE, VERBATIM, and installed over whatever the snapshot
-- holds. R1/R2 now prove the defect regardless of how fresh the snapshot is — and the A–E
-- blocks still run against the snapshot's CURRENT function plus the migration, which is
-- where freshness genuinely matters.
--
-- Extracted verbatim from scripts/sql-harness/fixtures/live-schema-public.sql at commit
-- 1585cdd3 (the last snapshot taken before 20260917b was applied live). Do not edit: its
-- value is being the OLD text. If it ever needs regenerating, take it from that commit.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.undo_import_run(p_business_id uuid, p_run_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_held          int;
  v_live_orders   int;
  v_live_lines    int;
  v_live_stops    int;
  v_live_contacts int;
  v_contacts      int := 0;
  v_other         jsonb := '{}'::jsonb;
  v_other_total   int := 0;
  v_n             int;
  r               record;
  v_p_orders      int;
  v_p_lines       int;
  v_p_stops       int;
  v_inventory     int;
  v_customers     int;
  v_unretired     int;
BEGIN
  IF p_business_id IS NULL OR p_run_id IS NULL THEN
    RAISE EXCEPTION 'undo_import_run requires a business and a run id';
  END IF;

  -- Serialise two undos of the same tenant (a double press, two tabs). Released at COMMIT.
  PERFORM pg_advisory_xact_lock(hashtext('undo_import_run:' || p_business_id::text));

  -- ── PRE-FLIGHT — reads only ─────────────────────────────────────────────────────────────
  SELECT count(DISTINCT bi.id) INTO v_held
    FROM public.business_inventory bi
    JOIN public.business_inventory_ledger l ON l.inventory_id = bi.id
   WHERE bi.business_id = p_business_id AND bi.import_run_id = p_run_id;

  SELECT count(*) INTO v_live_orders
    FROM public.orders o
    JOIN public.customers c ON c.id = o.customer_id
   WHERE o.business_id = p_business_id
     AND c.business_id = p_business_id AND c.import_run_id = p_run_id
     AND NOT (o.order_kind IS NOT DISTINCT FROM 'test' AND o.import_run_id IS NOT DISTINCT FROM p_run_id);

  SELECT count(*) INTO v_live_lines
    FROM public.order_items oi
    JOIN public.orders o             ON o.id = oi.order_id
    JOIN public.business_inventory bi ON bi.id = oi.business_inventory_id
   WHERE o.business_id = p_business_id
     AND bi.business_id = p_business_id AND bi.import_run_id = p_run_id
     AND NOT (o.order_kind IS NOT DISTINCT FROM 'test' AND o.import_run_id IS NOT DISTINCT FROM p_run_id);

  SELECT count(*) INTO v_live_stops
    FROM public.deliveries d
    JOIN public.customers c ON c.id = d.customer_id
   WHERE d.business_id = p_business_id
     AND c.business_id = p_business_id AND c.import_run_id = p_run_id
     AND NOT EXISTS (
       SELECT 1 FROM public.orders o
        WHERE o.id = d.order_id AND o.business_id = p_business_id
          AND o.order_kind = 'test' AND o.import_run_id = p_run_id);

  -- 🔴 #335: a run customer's CONTACT rows go with it only if they carry THIS run's id — the import
  -- (and the migrations/reload that stood in for it) tagged them. An untagged row was added by a
  -- person after the import: it is live, and the undo refuses rather than take it.
  SELECT (SELECT count(*) FROM public.customer_phones t JOIN public.customers c ON c.id = t.customer_id
           WHERE c.business_id = p_business_id AND c.import_run_id = p_run_id
             AND t.import_run_id IS DISTINCT FROM p_run_id)
       + (SELECT count(*) FROM public.customer_emails t JOIN public.customers c ON c.id = t.customer_id
           WHERE c.business_id = p_business_id AND c.import_run_id = p_run_id
             AND t.import_run_id IS DISTINCT FROM p_run_id)
       + (SELECT count(*) FROM public.customer_addresses t JOIN public.customers c ON c.id = t.customer_id
           WHERE c.business_id = p_business_id AND c.import_run_id = p_run_id
             AND t.import_run_id IS DISTINCT FROM p_run_id)
    INTO v_live_contacts;

  -- Every other single-column FK into the two parents, from the catalog.
  FOR r IN
    SELECT c.conrelid::regclass AS child, a.attname AS col, c.confrelid::regclass AS parent,
           (c.conrelid = c.confrelid) AS self_ref
      FROM pg_catalog.pg_constraint c
      JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
     WHERE c.contype = 'f'
       AND array_length(c.conkey, 1) = 1
       AND c.confrelid IN ('public.business_inventory'::regclass, 'public.customers'::regclass)
       AND c.conrelid NOT IN ('public.business_inventory_ledger'::regclass, 'public.orders'::regclass,
                              'public.order_items'::regclass,         'public.deliveries'::regclass,
                              -- #335: counted above, by run tag, and removed below
                              'public.customer_phones'::regclass,     'public.customer_emails'::regclass,
                              'public.customer_addresses'::regclass)
  LOOP
    EXECUTE format(
      'SELECT count(*) FROM %s t JOIN %s p ON p.id = t.%I '
      'WHERE p.business_id = $1 AND p.import_run_id = $2 %s',
      r.child, r.parent, r.col,
      CASE WHEN r.self_ref THEN 'AND t.import_run_id IS DISTINCT FROM $2' ELSE '' END)
      INTO v_n USING p_business_id, p_run_id;
    IF v_n > 0 THEN
      v_other := v_other || jsonb_build_object(r.child::text || '.' || r.col, v_n);
      v_other_total := v_other_total + v_n;
    END IF;
  END LOOP;

  IF v_held + v_live_orders + v_live_lines + v_live_stops + v_live_contacts + v_other_total > 0 THEN
    -- 🔴 NOTHING HAS BEEN WRITTEN. The caller turns these counts into one sentence.
    RETURN jsonb_build_object(
      'refused', true,
      'held_lots', v_held, 'live_orders', v_live_orders, 'live_order_lines', v_live_lines,
      'live_deliveries', v_live_stops, 'live_contact_rows', v_live_contacts,
      'other_references', v_other);
  END IF;

  -- ── WRITES — one transaction; any failure below rolls back every one of them ─────────────
  -- ① the run's PRACTICE orders and their children (the same children handleDelete removes,
  --   plus the delivery stop checkout scheduled for a delivery order — practice too).
  -- The practice set is re-derived in each statement (no temp table inside a SECURITY DEFINER
  -- function); `orders` is deleted LAST, so the set is identical in every statement.
  DELETE FROM public.order_compliance_records WHERE order_id IN (
    SELECT o.id FROM public.orders o
     WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id);
  DELETE FROM public.order_service_selections WHERE order_id IN (
    SELECT o.id FROM public.orders o
     WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id);
  WITH d AS (DELETE FROM public.order_items WHERE order_id IN (
               SELECT o.id FROM public.orders o
                WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id)
             RETURNING 1)
    SELECT count(*) INTO v_p_lines FROM d;
  WITH d AS (DELETE FROM public.deliveries
              WHERE business_id = p_business_id AND order_id IN (
                SELECT o.id FROM public.orders o
                 WHERE o.business_id = p_business_id AND o.order_kind = 'test' AND o.import_run_id = p_run_id)
             RETURNING 1)
    SELECT count(*) INTO v_p_stops FROM d;
  WITH d AS (DELETE FROM public.orders
              WHERE business_id = p_business_id AND order_kind = 'test' AND import_run_id = p_run_id
             RETURNING 1)
    SELECT count(*) INTO v_p_orders FROM d;

  -- ② products, ③ customers — products first: a practice line could only have anchored to them,
  --   and those lines are already gone.
  WITH d AS (DELETE FROM public.business_inventory
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT count(*) INTO v_inventory FROM d;
  -- #335: the run's contact rows, then the customers. customer_addresses is RESTRICT, so it MUST go
  -- first; phones and emails would cascade, but are removed explicitly so the count is reported.
  -- The pre-flight guaranteed every contact row of a run customer carries this run's id.
  WITH d AS (DELETE FROM public.customer_phones
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT v_contacts + count(*) INTO v_contacts FROM d;
  WITH d AS (DELETE FROM public.customer_emails
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT v_contacts + count(*) INTO v_contacts FROM d;
  WITH d AS (DELETE FROM public.customer_addresses
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT v_contacts + count(*) INTO v_contacts FROM d;
  WITH d AS (DELETE FROM public.customers
              WHERE business_id = p_business_id AND import_run_id = p_run_id RETURNING 1)
    SELECT count(*) INTO v_customers FROM d;

  -- ④ un-retire — scoped on retired_by_run_id, never on a time window (20260906 header).
  WITH u AS (UPDATE public.business_inventory
                SET retired_at = NULL, retired_reason = NULL, retired_by_run_id = NULL
              WHERE business_id = p_business_id AND retired_by_run_id = p_run_id RETURNING 1)
    SELECT count(*) INTO v_unretired FROM u;

  RETURN jsonb_build_object(
    'refused', false,
    'practice_orders_deleted', v_p_orders, 'practice_lines_deleted', v_p_lines,
    'practice_deliveries_deleted', v_p_stops,
    'inventory_deleted', v_inventory, 'customers_deleted', v_customers,
    'contact_rows_deleted', v_contacts, 'unretired', v_unretired);
END;
$function$;
