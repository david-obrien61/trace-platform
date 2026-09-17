-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260917b — THE WIPE WORKS REGARDLESS OF WHAT WAS TYPED DURING TESTING · ledger #348
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────────────────
-- David, 2026-09-16, restated 2026-09-17: **the wipe must work regardless of what users entered or
-- changed during testing — contacts, orders, inventory. Test-mode edits must never make the undo
-- refuse. Only LIVE CAPTURES (an OCR invoice or receipt, an asset) are never removed.**
-- `20260916d` gave the opposite rule for contact rows: *"an untagged row was added by a person after
-- the import: it is live, and the undo refuses rather than take it."* That refusal is correct when
-- the business is LIVE and wrong while it is testing — and testing is exactly when Lauren is typing
-- phone numbers onto imported customers. Measured live 2026-09-17: 0 such rows exist today on any
-- tenant, so nothing changes for tonight's reload; this closes the door before training.
--
-- ── WHAT CHANGES (only the contact-row rule; everything else is byte-identical) ─────────────
--   · The flag is read once: `businesses.qbo_writes_enabled`. NULL or unreadable counts as WRITES ON
--     (the stricter side), so a missing answer never widens what the undo takes.
--   · WRITES ON  → unchanged: a contact row on a run customer that does not carry the run's id makes
--     the undo REFUSE (`live_contact_rows`), and nothing is deleted.
--   · TEST MODE  → the refusal does not apply, and the undo removes EVERY contact row on a run
--     customer, tagged or not.
--   · UNCHANGED IN BOTH MODES: a CAPTURED order (`order_kind = 'history'`) or a live order, order
--     line or delivery stop on a run customer still refuses — a live capture is never removed. So
--     does any other foreign key into the run's customers or products (read from the catalog).
--   · Nothing else is touched: same signature, same SECURITY DEFINER, same lock, same counts.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $guard$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = 'undo_import_run') THEN
    RAISE EXCEPTION 'REFUSED: undo_import_run does not exist — apply 20260916c and 20260916d first. Nothing changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'businesses'
                    AND column_name = 'qbo_writes_enabled') THEN
    RAISE EXCEPTION 'REFUSED: businesses.qbo_writes_enabled does not exist. Nothing changed.';
  END IF;
END $guard$;

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
  v_writes        boolean;
BEGIN
  IF p_business_id IS NULL OR p_run_id IS NULL THEN
    RAISE EXCEPTION 'undo_import_run requires a business and a run id';
  END IF;

  -- 🔴 IS THIS BUSINESS IN TEST MODE? (ledger #348 · David, 2026-09-16, restated 2026-09-17:
  -- *"the wipe must work regardless of what users entered or changed during testing"*.) The flag is
  -- read ONCE, here. An unreadable or NULL flag counts as WRITES ON — the stricter behaviour, so a
  -- missing answer never widens what the undo takes.
  SELECT b.qbo_writes_enabled INTO v_writes FROM public.businesses b WHERE b.id = p_business_id;
  v_writes := COALESCE(v_writes, true);

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

  -- 🔴 #335, AMENDED BY #348: a contact row a PERSON added to a run customer blocks the undo only
  -- when WRITES ARE ON. In TEST MODE nothing a person typed may stand in the way of the wipe — they
  -- are testing, and testing to them is testing (David). The rows are removed below, tagged or not.
  IF v_writes THEN
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
  ELSE
    v_live_contacts := 0;
  END IF;

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
  -- #335, AMENDED BY #348: the run customers' contact rows, then the customers themselves.
  -- `customer_addresses` is RESTRICT, so it MUST go first; phones and emails would cascade, but are
  -- removed explicitly so the count is reported. A row is taken when it carries THIS run's id, or —
  -- IN TEST MODE ONLY — when it sits on a run customer at all, whoever typed it.
  WITH d AS (DELETE FROM public.customer_phones t
              WHERE (t.business_id = p_business_id AND t.import_run_id = p_run_id)
                 OR (NOT v_writes AND EXISTS (SELECT 1 FROM public.customers c
                      WHERE c.id = t.customer_id AND c.business_id = p_business_id
                        AND c.import_run_id = p_run_id))
              RETURNING 1)
    SELECT v_contacts + count(*) INTO v_contacts FROM d;
  WITH d AS (DELETE FROM public.customer_emails t
              WHERE (t.business_id = p_business_id AND t.import_run_id = p_run_id)
                 OR (NOT v_writes AND EXISTS (SELECT 1 FROM public.customers c
                      WHERE c.id = t.customer_id AND c.business_id = p_business_id
                        AND c.import_run_id = p_run_id))
              RETURNING 1)
    SELECT v_contacts + count(*) INTO v_contacts FROM d;
  WITH d AS (DELETE FROM public.customer_addresses t
              WHERE (t.business_id = p_business_id AND t.import_run_id = p_run_id)
                 OR (NOT v_writes AND EXISTS (SELECT 1 FROM public.customers c
                      WHERE c.id = t.customer_id AND c.business_id = p_business_id
                        AND c.import_run_id = p_run_id))
              RETURNING 1)
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

COMMENT ON FUNCTION public.undo_import_run(uuid, uuid) IS
  'Ledger #348: one all-or-nothing undo for an import run. In TEST MODE it removes every contact row '
  'on a run customer, whoever typed it (David, 2026-09-16: a test-mode edit never blocks the wipe); '
  'with writes ON an untagged contact row still refuses. A captured or live order, line or stop always '
  'refuses, in both modes.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. V1 and V2 are read-only. V3 ALWAYS ends in an error on purpose
-- (that error is the result) and keeps nothing.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the new rule is in the function. EXPECT one row, both true.
-- SELECT pg_get_functiondef(p.oid) LIKE '%NOT v_writes%' AS takes_typed_rows_in_test_mode,
--        pg_get_functiondef(p.oid) LIKE '%qbo_writes_enabled%' AS reads_the_mode
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--  WHERE n.nspname = 'public' AND p.proname = 'undo_import_run';
--
-- V2 · how many contact rows a person has added to imported customers, per business, and whether
--      that business is in test mode. EXPECT LAWNS 0 today; any number is now safe in test mode.
-- SELECT b.name, b.qbo_writes_enabled AS writes_on, count(*) AS typed_rows_on_imported_customers
--   FROM public.businesses b
--   JOIN public.customers c ON c.business_id = b.id AND c.import_run_id IS NOT NULL
--   JOIN (SELECT customer_id, import_run_id FROM public.customer_phones
--         UNION ALL SELECT customer_id, import_run_id FROM public.customer_emails
--         UNION ALL SELECT customer_id, import_run_id FROM public.customer_addresses) t
--     ON t.customer_id = c.id AND t.import_run_id IS DISTINCT FROM c.import_run_id
--  GROUP BY 1, 2 ORDER BY 1;
--
-- V3 · LAWNS's undo, as a dry run that keeps nothing. EXPECT the error to read
--      DRY RUN (nothing kept) {"refused": false, ...} with the counts.
-- DO $$
-- DECLARE r jsonb;
-- BEGIN
--   r := public.undo_import_run('ed2e5933-45dc-4b9b-a331-ddfd125e7a74'::uuid,
--                               'eab7fbd2-04cd-45e5-b771-cbb07f662f6f'::uuid);
--   RAISE EXCEPTION 'DRY RUN (nothing kept) %', r;
-- END $$;
