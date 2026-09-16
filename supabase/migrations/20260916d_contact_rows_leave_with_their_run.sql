-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260916d — A RUN'S CONTACT ROWS LEAVE WITH ITS CUSTOMERS · ledger #335
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it, as `postgres`, in the SQL EDITOR (§6 r17).
--
-- 🔴 APPLY ORDER — this file REFUSES unless both of these are already applied:
--      · 20260916c_practice_orders_and_one_unit_undo.sql   (ledger #342 — the one-unit undo)
--      · 20260915_contact_record.sql                        (ledger #335 — the three contact lists)
--    It REPLACES 20260916c's `undo_import_run` with the same function plus the contact rows. The body
--    below is 20260916c's, verbatim, with seven marked `#335` edits — nothing else changed.
--
-- ── WHY ─────────────────────────────────────────────────────────────────────────────────────
-- 20260915_contact_record seeds a phone, email and billing-address row for every customer holding
-- one (1,483 addresses · 1,497 phones · 1,720 emails on LAWNS, measured on the 2026-09-16 snapshot).
-- Without this file the import undo breaks two ways:
--   · 20260916c's pre-flight reads EVERY foreign key into `customers` from pg_constraint and counts
--     any referencing row as LIVE — CASCADE or not. customer_phones / customer_emails would make
--     every undo of an imported customer list REFUSE.
--   · `customer_addresses.customer_id` is ON DELETE RESTRICT (20260911b:78, R-104), so even without
--     the pre-flight the customer DELETE would fail.
--
-- ── WHAT IT DOES ────────────────────────────────────────────────────────────────────────────
-- §1  `import_run_id uuid` on customer_phones, customer_emails and customer_addresses — nullable, no
--     FK (there is no runs table; a run is the set of rows carrying its id, as on customers, orders
--     and business_inventory).
-- §2  BACKFILL from the parent customer: every contact row whose customer came from a run carries
--     that run. Those rows are exactly what the import (or the migration standing in for it)
--     wrote. The contact-sync triggers are DISABLED for this statement only: `import_run_id` is not
--     an input to the derived flat columns, so recomputing them would change nothing but
--     `customers.updated_at` on ~1,900 rows — and the snapshot-exact rule forbids that.
-- §3  `undo_import_run` removes a run's TAGGED contact rows before its customers and reports the
--     count. An UNTAGGED contact row on a run customer was added by a person after the import — it
--     is live, and the undo REFUSES (`live_contact_rows`) rather than take it.
--
-- ⚠️ NOTHING TAGS A ROW AUTOMATICALLY GOING FORWARD — deliberately. A trigger copying the parent's
--    run id onto every new row would tag a site Lauren saves next month, and the undo would then
--    delete it silently. Writers that act FOR the import pass the run id (`writeContactRecord`'s
--    `importRunId`); everyone else leaves it NULL.
-- ⚠️ The undo removes, and only removes: the run's practice orders and their children (20260916c),
--    the run's products, the run's customers AND their tagged contact rows. Nothing else.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $$
BEGIN
  IF to_regclass('public.customer_phones') IS NULL OR to_regclass('public.customer_emails') IS NULL THEN
    RAISE EXCEPTION 'REFUSED: apply 20260915_contact_record.sql first. Nothing changed.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema='public' AND table_name='orders' AND column_name='import_run_id')
     OR to_regprocedure('public.undo_import_run(uuid,uuid)') IS NULL THEN
    RAISE EXCEPTION 'REFUSED: apply 20260916c_practice_orders_and_one_unit_undo.sql first. Nothing changed.';
  END IF;
END $$;

-- ── §1 ───────────────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.customer_phones    ADD COLUMN IF NOT EXISTS import_run_id uuid;
ALTER TABLE public.customer_emails    ADD COLUMN IF NOT EXISTS import_run_id uuid;
ALTER TABLE public.customer_addresses ADD COLUMN IF NOT EXISTS import_run_id uuid;

CREATE INDEX IF NOT EXISTS idx_customer_phones_import_run
  ON public.customer_phones (business_id, import_run_id) WHERE import_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_emails_import_run
  ON public.customer_emails (business_id, import_run_id) WHERE import_run_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customer_addresses_import_run
  ON public.customer_addresses (business_id, import_run_id) WHERE import_run_id IS NOT NULL;

COMMENT ON COLUMN public.customer_phones.import_run_id IS
  'The import run that wrote this number; the run''s undo removes it with its customer. NULL = added '
  'by a person, which makes the undo refuse. Ledger #335.';
COMMENT ON COLUMN public.customer_emails.import_run_id IS
  'The import run that wrote this address; the run''s undo removes it with its customer. NULL = added '
  'by a person, which makes the undo refuse. Ledger #335.';
COMMENT ON COLUMN public.customer_addresses.import_run_id IS
  'The import run that wrote this address; the run''s undo removes it with its customer (the FK is '
  'RESTRICT, so it must go first). NULL = added by a person, which makes the undo refuse. Ledger #335.';

-- ── §2 BACKFILL ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.customer_phones    DISABLE TRIGGER trg_customer_phones_sync;
ALTER TABLE public.customer_emails    DISABLE TRIGGER trg_customer_emails_sync;
ALTER TABLE public.customer_addresses DISABLE TRIGGER trg_customer_addresses_sync;

UPDATE public.customer_phones t SET import_run_id = c.import_run_id
  FROM public.customers c
 WHERE c.id = t.customer_id AND c.import_run_id IS NOT NULL AND t.import_run_id IS NULL;
UPDATE public.customer_emails t SET import_run_id = c.import_run_id
  FROM public.customers c
 WHERE c.id = t.customer_id AND c.import_run_id IS NOT NULL AND t.import_run_id IS NULL;
UPDATE public.customer_addresses t SET import_run_id = c.import_run_id
  FROM public.customers c
 WHERE c.id = t.customer_id AND c.import_run_id IS NOT NULL AND t.import_run_id IS NULL;

ALTER TABLE public.customer_phones    ENABLE TRIGGER trg_customer_phones_sync;
ALTER TABLE public.customer_emails    ENABLE TRIGGER trg_customer_emails_sync;
ALTER TABLE public.customer_addresses ENABLE TRIGGER trg_customer_addresses_sync;

-- Prove it in the same transaction (§6 r19 — this can fail).
DO $$
DECLARE n int;
BEGIN
  SELECT (SELECT count(*) FROM public.customer_phones t JOIN public.customers c ON c.id = t.customer_id
           WHERE c.import_run_id IS NOT NULL AND t.import_run_id IS DISTINCT FROM c.import_run_id)
       + (SELECT count(*) FROM public.customer_emails t JOIN public.customers c ON c.id = t.customer_id
           WHERE c.import_run_id IS NOT NULL AND t.import_run_id IS DISTINCT FROM c.import_run_id)
       + (SELECT count(*) FROM public.customer_addresses t JOIN public.customers c ON c.id = t.customer_id
           WHERE c.import_run_id IS NOT NULL AND t.import_run_id IS DISTINCT FROM c.import_run_id)
    INTO n;
  IF n > 0 THEN
    RAISE EXCEPTION 'REFUSED: % contact row(s) on an imported customer carry a different run id than the customer. Nothing changed.', n;
  END IF;
END $$;

-- ── §3 THE UNDO ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.undo_import_run(p_business_id uuid, p_run_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- service_role ONLY. The function trusts its p_business_id; the caller (`api/qbo/router.ts`
-- books-undo / items-undo) resolves it from a validated owner session and checks both switches
-- and inventory:create + inventory:delete first. Granting to authenticated would let any signed-in
-- member delete another tenant's catalogue by passing its id (AC-3).
REVOKE ALL ON FUNCTION public.undo_import_run(uuid, uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.undo_import_run(uuid, uuid) TO service_role;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — read-only, one statement at a time
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 the three columns exist, nullable uuid:
--   SELECT table_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_schema='public' AND column_name='import_run_id'
--      AND table_name IN ('customer_phones','customer_emails','customer_addresses') ORDER BY 1;
--   EXPECT 3 rows: uuid, YES.
-- V2 every contact row of an imported customer carries its customer's run; no other row is tagged:
--   SELECT 'untagged on a run customer' AS k, count(*) FROM (
--     SELECT t.import_run_id, c.import_run_id AS run FROM public.customer_phones t JOIN public.customers c ON c.id=t.customer_id
--     UNION ALL SELECT t.import_run_id, c.import_run_id FROM public.customer_emails t JOIN public.customers c ON c.id=t.customer_id
--     UNION ALL SELECT t.import_run_id, c.import_run_id FROM public.customer_addresses t JOIN public.customers c ON c.id=t.customer_id
--   ) x WHERE x.run IS NOT NULL AND x.import_run_id IS DISTINCT FROM x.run
--   UNION ALL SELECT 'tagged on a hand-made customer', count(*) FROM (
--     SELECT t.import_run_id, c.import_run_id AS run FROM public.customer_phones t JOIN public.customers c ON c.id=t.customer_id
--     UNION ALL SELECT t.import_run_id, c.import_run_id FROM public.customer_emails t JOIN public.customers c ON c.id=t.customer_id
--     UNION ALL SELECT t.import_run_id, c.import_run_id FROM public.customer_addresses t JOIN public.customers c ON c.id=t.customer_id
--   ) y WHERE y.run IS NULL AND y.import_run_id IS NOT NULL;
--   EXPECT both 0.
-- V3 the sync triggers are enabled again ('O' = enabled):
--   SELECT tgname, tgenabled FROM pg_trigger
--    WHERE tgname IN ('trg_customer_phones_sync','trg_customer_emails_sync','trg_customer_addresses_sync');
--   EXPECT 3 rows, all 'O'.
-- V4 the function is still SECURITY DEFINER and service_role-only (same as 20260916c V2):
--   SELECT p.prosecdef, has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed,
--          has_function_privilege('service_role', p.oid, 'EXECUTE') AS service,
--          position('live_contact_rows' IN pg_get_functiondef(p.oid)) > 0 AS has_contact_check
--     FROM pg_proc p WHERE p.proname = 'undo_import_run';
--   EXPECT 1 row: true, false, true, true.
