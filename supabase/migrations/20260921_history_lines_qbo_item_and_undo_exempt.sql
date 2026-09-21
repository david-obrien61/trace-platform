-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260921 — THE HISTORY IMPORT, PHASES 1 AND 2 · ledger #363
--   ① the QuickBooks item a line names, so a captured line can reach the catalogue
--   ② history leaves with its own run, so the customer wipe keeps working
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17):
-- a table-editor object is created by `supabase_admin`, whose default ACL grants TRUNCATE and
-- REFERENCES to `anon`, and TRUNCATE is outside row-level security entirely.
--
-- 🔴 GATE — DO NOT APPLY UNTIL CONTACTS-349 REPORTS THE CUSTOMER/PRODUCT RELOAD DONE.
--    David, 2026-09-21. Measured here at 09:29 CDT: the reload had NOT run — `customers` and
--    `business_inventory` both still carried run bffc7713 of 2026-09-17T20:16 (1,956 customers,
--    631 live product rows). Nothing in THIS file depends on which run is live: both ids it deals
--    in are QuickBooks ids, which survive a reload by construction. What must wait for the reload
--    is the IMPORT that follows, and the join-coverage figure it reports — the 99.2% measured on
--    2026-09-20 was taken against the 631 rows the reload retires, and it is re-measured after.
--
-- ADDITIVE ONLY. One nullable column with NO DEFAULT, one partial index, and one
-- CREATE OR REPLACE of a function whose body is reproduced VERBATIM from its current definition
-- (`20260917b`, applied) except for the single clause marked §2. Not one existing row is rewritten
-- and no constraint added here can reject a row that exists today.
--
-- ── §6 r1 ──────────────────────────────────────────────────────────────────────────────────
-- `20260917b` is NOT edited. A function is replaced by re-declaring it in a NEW dated file, which
-- is why its whole body appears below rather than a diff.
-- ⚠️ THE BODY IS TAKEN FROM `20260917b`, NOT FROM `20260916c` WHICH IT SUPERSEDES. Three files
-- declare this function; replacing the wrong one silently reverts the two changes in between.
-- That is tech-debt #241's shape — a checker (or an author) reading a `CREATE` the applied
-- migration had already removed, and passing on history.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1 · THE QUICKBOOKS ITEM A LINE NAMES ───────────────────────────────────────────────────
-- ONE COLUMN, and the reason it is one is David's ruling of 2026-09-21: it means *the QuickBooks
-- item this line is for*, written from the INVOICE on a captured line and, when `20260916b` is
-- eventually ruled, from the LOT on a live line. `20260916b`'s drafted `order_items.lot_qb_item_id`
-- is therefore NOT minted — two columns holding the same kind of value in one table is STD-011,
-- and the copy that drifts is the one nobody is reading.
--
-- 🔴 A VALUE JOIN, NEVER A FOREIGN KEY, AND NEVER `business_inventory_id`.
--   Committed stock is DERIVED (D-52): `available = on-hand − committed`, where committed is a
--   live join over open order lines. A lot id on a captured line therefore needs no decrement to
--   do damage — merely existing would reduce what LAWNS can sell, with no ledger row, nothing to
--   reverse and nothing on any screen. `business_inventory_id` STAYS NULL on every captured line.
--
-- 🔴 AND THE VALUE JOIN IS WHAT SURVIVES A WIPE-AND-RELOAD.
--   A reload retires every `business_inventory` row and inserts new ones with new internal ids.
--   Both sides of this join are QuickBooks ids, so the link is unaffected: it needs no
--   re-attachment pass, which is precisely why this build does not depend on `20260916b`'s
--   still-open re-key-vs-keep-and-reuse ruling.
ALTER TABLE public.order_items
  ADD COLUMN IF NOT EXISTS qbo_item_id text;

COMMENT ON COLUMN public.order_items.qbo_item_id IS
  'The QuickBooks Item.Id this line is for. On a captured line it is read from '
  'Invoice.Line[].SalesItemLineDetail.ItemRef.value; on a live line it will be the lot''s own '
  'qb_item_id when 20260916b is ruled. A VALUE join to business_inventory.qb_item_id (unique per '
  'tenant, 20260906c) — never a foreign key, and never business_inventory_id: committed stock is '
  'DERIVED (D-52), so a lot id on a captured line silently reduces sellable stock. Both sides are '
  'QuickBooks ids, so the link survives a wipe-and-reload with no re-attachment. NULL on the 16 OCR '
  'and 9 backfill orders, which carry no QuickBooks item id at all.';

CREATE INDEX IF NOT EXISTS order_items_qbo_item_idx
  ON public.order_items (qbo_item_id) WHERE qbo_item_id IS NOT NULL;

-- ── §1b · WHAT IS DELIBERATELY NOT STORED, SAID HERE SO THE GAP IS NOT READ AS A DROP ───────
-- David, 2026-09-21: the import stores 4,030 of the 5,540 `Line[]` entries on LAWNS's 1,510
-- invoices — every `SalesItemLineDetail` (3,763), `DescriptionOnly` (200) and `DiscountLineDetail`
-- (67). The 1,510 `SubTotalLineDetail` entries are NOT stored: there is exactly one per invoice, it
-- is DERIVED from the lines above it, and it is already on `orders.subtotal`. Storing it would be a
-- second representation of one fact (STD-011), and the raw capture file keeps it either way.
-- ⚠️ So a line COUNT taken from `order_items` will not match a line count taken from the capture,
-- BY DESIGN. 1,510 is the expected difference. Anyone reconciling the two should expect it.

-- ── §2 · HISTORY LEAVES WITH ITS OWN RUN ────────────────────────────────────────────────────
-- Body verbatim from 20260917b except the clause marked R-165 inside `v_live_orders`.
--
-- ⚠️ `v_live_lines` IS DELIBERATELY NOT GIVEN THE SAME EXEMPTION. It reaches order lines through
-- `JOIN business_inventory bi ON bi.id = oi.business_inventory_id`, and a captured line's lot id is
-- NULL, so an inner join already excludes every history line. Adding the clause there would change
-- nothing today and would MASK the one thing worth hearing about: if a history line ever did carry
-- a lot id, that is the D-52 landmine going off, and the undo refusing loudly is the correct and
-- only alarm we have for it. Left strict on purpose.

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
     AND NOT (o.order_kind IS NOT DISTINCT FROM 'test' AND o.import_run_id IS NOT DISTINCT FROM p_run_id)
     -- ── R-165, AS CORRECTED 2026-09-21 (ledger #363) ────────────────────────────────────────
     -- An order WRITTEN BY AN IMPORT is a projection of QuickBooks: press the button again and it
     -- comes back. Deleting it loses nothing, so it must never make the CUSTOMER undo refuse.
     --
     -- 🔴 KEYED ON `import_run_id`, NOT ON `order_kind` — AND THAT IS THE WHOLE POINT OF THIS LINE.
     -- `order_kind = 'history'` covers THREE doors, and only one of them is re-derivable:
     --    · the QuickBooks API import   (19 orders live today)  — re-derivable, exempt here
     --    · the OCR capture             (16 orders live today)  — A PHOTOGRAPH OF A DOCUMENT
     --    · the backfill script          (9 orders live today)  — same origin, receipts since gone
     -- The latter 25 are LIVE CAPTURES. R-160: *only live captures are never removed.* They must
     -- KEEP making the undo refuse, and a bare `order_kind` test would have exempted all 25
     -- SILENTLY — the undo would have reported success while Lauren's photographed invoices sat
     -- against customers it had just deleted.
     --
     -- MEASURED 2026-09-21, before this line was written: `order_kind = 'history' AND
     -- import_run_id IS NOT NULL` selects 0 of LAWNS's 45 orders. Nothing that exists today
     -- changes behaviour; only rows a future import writes are exempted.
     AND NOT (o.order_kind = 'history' AND o.import_run_id IS NOT NULL);

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

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run these AFTER the COMMIT above and paste the results back. All are SELECTs.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the column and the index exist, and the column is nullable with no default.
--      Expected EXACTLY one row: text | YES | (null)
-- SELECT data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='order_items' AND column_name='qbo_item_id';
--
-- V2 · the index exists and is the partial one.
--      Expected: order_items_qbo_item_idx ... WHERE (qbo_item_id IS NOT NULL)
-- SELECT indexname, indexdef FROM pg_indexes
--  WHERE schemaname='public' AND tablename='order_items' AND indexname='order_items_qbo_item_idx';
--
-- V3 · NOTHING WAS REWRITTEN. Every existing line still has a NULL qbo_item_id.
--      Expected: 145 total, 0 non-null (LAWNS, 2026-09-21).
-- SELECT count(*) AS lines, count(qbo_item_id) AS with_item_id
--   FROM public.order_items oi
--   JOIN public.orders o ON o.id = oi.order_id
--  WHERE o.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V4 · THE EXEMPTION SELECTS NOTHING THAT EXISTS TODAY — the measurement this file rests on.
--      Expected EXACTLY: 45 | 44 | 0
-- SELECT count(*) AS all_orders,
--        count(*) FILTER (WHERE order_kind = 'history')                              AS history,
--        count(*) FILTER (WHERE order_kind = 'history' AND import_run_id IS NOT NULL) AS exempted
--   FROM public.orders WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V5 · 🔴 THE UNDO STILL REFUSES ON A LIVE CAPTURE. This is the probe R-165's guard cell owes,
--      and it is the one that would have caught the wording this file corrects. It plants an OCR
--      order (history, NO import_run_id) against a throwaway customer in a throwaway run and
--      asserts the undo REFUSES. It rolls itself back and writes nothing.
-- DO $verify$
-- DECLARE b uuid := 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--         r uuid := gen_random_uuid(); c uuid; res jsonb;
-- BEGIN
--   INSERT INTO public.customers (business_id, first_name, last_name, import_run_id)
--        VALUES (b, 'V5', 'Probe', r) RETURNING id INTO c;
--   INSERT INTO public.orders (business_id, customer_id, order_kind, status, import_run_id)
--        VALUES (b, c, 'history', 'fulfilled', NULL);            -- an OCR-shaped capture
--   res := public.undo_import_run(b, r);
--   IF (res->>'refused')::boolean IS NOT TRUE THEN
--     RAISE EXCEPTION 'V5 FAILED — the undo did NOT refuse on a live capture: %', res;
--   END IF;
--   RAISE NOTICE 'V5 PASSED — refused, live_orders=%', res->>'live_orders';
--   RAISE EXCEPTION 'V5 rollback (expected — nothing was kept)';
-- END $verify$;
--
-- V6 · 🔴 AND IT DOES *NOT* REFUSE ON AN IMPORT-WRITTEN HISTORY ORDER. The negative control:
--      without it, V5 passes on a function that refuses on everything, which is no check at all
--      ([[R-33]]). Same shape, one field different — the order carries an import_run_id.
-- DO $verify$
-- DECLARE b uuid := 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--         r uuid := gen_random_uuid(); h uuid := gen_random_uuid(); c uuid; res jsonb;
-- BEGIN
--   INSERT INTO public.customers (business_id, first_name, last_name, import_run_id)
--        VALUES (b, 'V6', 'Probe', r) RETURNING id INTO c;
--   INSERT INTO public.orders (business_id, customer_id, order_kind, status, import_run_id)
--        VALUES (b, c, 'history', 'fulfilled', h);               -- written by an import
--   res := public.undo_import_run(b, r);
--   IF (res->>'refused')::boolean IS TRUE THEN
--     RAISE EXCEPTION 'V6 FAILED — the undo refused on an import-written history order: %', res;
--   END IF;
--   RAISE NOTICE 'V6 PASSED — not refused; the exemption works';
--   RAISE EXCEPTION 'V6 rollback (expected — nothing was kept)';
-- END $verify$;
