-- PULLED FROM THE LIVE DATABASE 2026-09-21 (re-pulled after HISTORY applied 20260921b, the capture re-link)
-- with pg_get_functiondef — the function as it actually is. Used by recipes-survive-wipe-370.pglite.mjs.
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
  v_unlinked      int;                       -- captures put back on their twin (ledger #372)
  v_h_orders      int;                       -- history orders this load wrote (ledger #363)
  v_h_lines       int;                       -- and their lines
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
     -- ── R-165, AS SHARPENED 2026-09-21 (David, ledger #363) ─────────────────────────────────
     -- ONE TENANT LOAD, ONE ID: the wipe REMOVES everything the load created. A history order
     -- this load wrote is therefore not merely exempt from the refusal — it is DELETED below,
     -- in the same transaction, BEFORE the customers it points at. Exempting it without
     -- deleting it would achieve nothing: `orders_customer_id_fkey` is RESTRICT, so the customer
     -- delete would refuse anyway, one step later and with a worse error.
     --
     -- 🔴 KEYED ON THIS LOAD'S RUN, NOT ON `order_kind` AND NOT ON 'any import'.
     -- `order_kind = 'history'` covers THREE doors and only one is re-derivable:
     --    · the QuickBooks API import  (19 today) — re-derivable; this load's are deleted
     --    · the OCR capture            (16 today) — A PHOTOGRAPH OF A DOCUMENT
     --    · the backfill script         (9 today) — same origin, receipts since gone
     -- The latter 25 carry NO import_run_id, so they are never matched here and never deleted.
     -- R-160: only live captures are never removed. They must KEEP making the undo refuse, and
     -- a bare `order_kind` test would have exempted all 25 SILENTLY.
     --
     -- ⚠️ `IS NOT DISTINCT FROM`, NEVER `=`, AND THIS IS NOT STYLE. With `=`, an OCR order
     -- (import_run_id NULL) makes `NULL = p_run_id` → NULL, so `TRUE AND NULL` → NULL, `NOT NULL`
     -- → NULL, and the row is dropped from the COUNT — the undo would stop refusing on exactly
     -- the 25 rows this clause exists to protect, silently. The null-safe form is why the `test`
     -- clause above is written the same way.
     --
     -- A history order carrying a DIFFERENT run's id is NOT exempt: it still counts, so the undo
     -- REFUSES and names it. Fail-loud, not fail-silent.
     AND NOT (o.order_kind IS NOT DISTINCT FROM 'history' AND o.import_run_id IS NOT DISTINCT FROM p_run_id);

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

  -- ①0 🔴 PUT THE CAPTURES BACK BEFORE ANYTHING IS DELETED (R-165's re-link half, ledger #372).
  --   A re-linked capture is a PHOTOGRAPHED invoice moved onto the reloaded customer and stamped
  --   with this run. It must survive the wipe (R-160: only live captures are never removed) — but
  --   while it carries the run id, ①b below would DELETE it. So it is unlinked FIRST:
  --   `customer_id` goes back to the row it came from and the run id is cleared, and by the time
  --   ①b runs there is nothing of it left for the run to claim.
  --
  -- 🔴 `relinked_from_customer_id` IS WHY THIS IS POSSIBLE AND WHY IT IS A COLUMN. The twin cannot
  --   be DERIVED after the fact — a capture's previous customer is recorded nowhere else, and
  --   guessing it by NAME is exactly what the link itself refuses to do (two of the nineteen
  --   differ in spelling: David Ferraro/Ferrara, Luis Gomez Candanoza/Luis Candanoza). The link
  --   writes down where it came from; the wipe reads it back.
  --
  -- ⚠️ THE TWIN IS NEVER DELETED, which is what makes this safe: it carries no import_run_id, so
  --   the customer delete below cannot see it. It is the capture's home between loads.
  WITH u AS (UPDATE public.orders
                SET customer_id = relinked_from_customer_id,
                    import_run_id = NULL,
                    relinked_from_customer_id = NULL
              WHERE business_id = p_business_id
                AND import_run_id = p_run_id
                AND relinked_from_customer_id IS NOT NULL
             RETURNING 1)
    SELECT count(*) INTO v_unlinked FROM u;

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

  -- ①b THE LOAD'S HISTORY ORDERS AND THEIR LINES (ledger #363). Same shape as ① above, one
  --   word different, and it runs BEFORE products and customers because those are what it
  --   unblocks. `order_items.order_id` is ON DELETE CASCADE, so the lines would go anyway; they
  --   are deleted explicitly so the COUNT can be reported — the idiom ① already uses.
  --   ⚠️ `deliveries` is NOT touched here. Its FK to orders is ON DELETE SET NULL, so a stop
  --   outlives the order and keeps every field Lauren typed. No stop carries this run today:
  --   phases 1 and 2 write no deliveries, and `deliveries` has no import_run_id column at all.
  --   WHEN history deliveries are built, they get one and a DELETE belongs here beside this.
  DELETE FROM public.order_compliance_records WHERE order_id IN (
    SELECT o.id FROM public.orders o
     WHERE o.business_id = p_business_id AND o.order_kind = 'history' AND o.import_run_id = p_run_id);
  DELETE FROM public.order_service_selections WHERE order_id IN (
    SELECT o.id FROM public.orders o
     WHERE o.business_id = p_business_id AND o.order_kind = 'history' AND o.import_run_id = p_run_id);
  WITH d AS (DELETE FROM public.order_items WHERE order_id IN (
               SELECT o.id FROM public.orders o
                WHERE o.business_id = p_business_id AND o.order_kind = 'history' AND o.import_run_id = p_run_id)
             RETURNING 1)
    SELECT count(*) INTO v_h_lines FROM d;
  WITH d AS (DELETE FROM public.orders
              WHERE business_id = p_business_id AND order_kind = 'history' AND import_run_id = p_run_id
             RETURNING 1)
    SELECT count(*) INTO v_h_orders FROM d;

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
    'captures_unlinked', v_unlinked, 'history_orders_deleted', v_h_orders, 'history_lines_deleted', v_h_lines,
    'inventory_deleted', v_inventory, 'customers_deleted', v_customers,
    'contact_rows_deleted', v_contacts, 'unretired', v_unretired);
END;
$function$
;
