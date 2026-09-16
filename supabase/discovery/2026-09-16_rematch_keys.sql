-- READ-ONLY DISCOVERY. WRITES NOTHING.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 2026-09-16 — REMATCH KEYS: what a wipe-and-reload could rematch on, measured for LAWNS.
-- Branch recon/rematch-keys. Business ed2e5933-45dc-4b9b-a331-ddfd125e7a74.
--
-- ONE statement, ONE result set: (section, key, value). Paste the whole file into the SQL editor.
--
-- 🔴 COLUMN GUARDS. Every column that a draft or a pending migration may add or remove is read
--    through query_to_xml() on a query string chosen by a CASE on information_schema. The real
--    query text is only EXECUTED when its columns exist; otherwise a fallback row says
--    'column missing'. A plain reference to a missing column would fail the whole statement at
--    parse time, before any CASE could stop it.
--
-- Guarded: business_inventory.qb_item_id · business_inventory.import_run_id ·
--          customers.qb_customer_id · customers.import_run_id · orders.order_kind ·
--          orders.receipt_id · orders.qb_invoice_id · inventory_counts.lot_qb_item_id (20260916b
--          draft — expected ABSENT) · orders.customer_qb_id (20260916b draft — expected ABSENT).
-- ════════════════════════════════════════════════════════════════════════════════════════════

WITH
biz AS (SELECT 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'::uuid AS id),
col AS (
  SELECT
    bool_or(table_name = 'business_inventory' AND column_name = 'qb_item_id')      AS inv_qb,
    bool_or(table_name = 'business_inventory' AND column_name = 'import_run_id')   AS inv_run,
    bool_or(table_name = 'customers'          AND column_name = 'qb_customer_id')  AS cust_qb,
    bool_or(table_name = 'customers'          AND column_name = 'import_run_id')   AS cust_run,
    bool_or(table_name = 'orders'             AND column_name = 'order_kind')      AS ord_kind,
    bool_or(table_name = 'orders'             AND column_name = 'receipt_id')      AS ord_rcpt,
    bool_or(table_name = 'orders'             AND column_name = 'qb_invoice_id')   AS ord_qbinv,
    bool_or(table_name = 'orders'             AND column_name = 'customer_qb_id')  AS ord_snap,
    bool_or(table_name = 'inventory_counts'   AND column_name = 'lot_qb_item_id')  AS cnt_snap
  FROM information_schema.columns
  WHERE table_schema = 'public'
),
q(section, sql_text) AS (
  SELECT
    -- ── A. the guards themselves ────────────────────────────────────────────────────────────
    'A. column present', format($f$
      SELECT k, v FROM (VALUES
        ('business_inventory.qb_item_id',    %L), ('business_inventory.import_run_id', %L),
        ('customers.qb_customer_id',         %L), ('customers.import_run_id',          %L),
        ('orders.order_kind',                %L), ('orders.receipt_id',                %L),
        ('orders.qb_invoice_id',             %L),
        ('orders.customer_qb_id (16b draft)', %L), ('inventory_counts.lot_qb_item_id (16b draft)', %L)
      ) t(k, v) $f$,
      c.inv_qb, c.inv_run, c.cust_qb, c.cust_run, c.ord_kind, c.ord_rcpt, c.ord_qbinv, c.ord_snap, c.cnt_snap)
  FROM col c
  UNION ALL
  -- ── B. inventory rows by import_run_id, with / without a QuickBooks item id ─────────────────
  SELECT 'B. inventory by run',
    CASE WHEN c.inv_qb AND c.inv_run THEN format($f$
      SELECT coalesce(import_run_id::text, '(no run)')
               || CASE WHEN retired_at IS NULL THEN ' · live' ELSE ' · retired' END AS k,
             count(*) FILTER (WHERE qb_item_id IS NOT NULL) || ' with qb_item_id / '
               || count(*) FILTER (WHERE qb_item_id IS NULL) || ' without' AS v
      FROM public.business_inventory WHERE business_id = %L
      GROUP BY 1 ORDER BY 1 $f$, b.id)
    ELSE $f$ SELECT 'column missing'::text AS k, 'business_inventory.qb_item_id or .import_run_id'::text AS v $f$ END
  FROM col c, biz b
  UNION ALL
  -- ── C. one QuickBooks item on more than one inventory row ───────────────────────────────────
  SELECT 'C. duplicate qb_item_id',
    CASE WHEN c.inv_qb THEN format($f$
      SELECT 'groups with >1 row'::text AS k, count(*)::text AS v FROM (
        SELECT qb_item_id FROM public.business_inventory
        WHERE business_id = %L AND qb_item_id IS NOT NULL
        GROUP BY qb_item_id HAVING count(*) > 1) d
      UNION ALL
      SELECT 'qb ' || qb_item_id, count(*) || ' rows: ' || string_agg(id::text, ', ')
      FROM public.business_inventory
      WHERE business_id = %L AND qb_item_id IS NOT NULL
      GROUP BY qb_item_id HAVING count(*) > 1 $f$, b.id, b.id)
    ELSE $f$ SELECT 'column missing'::text AS k, 'business_inventory.qb_item_id'::text AS v $f$ END
  FROM col c, biz b
  UNION ALL
  -- ── D. inventory_counts and what they point at ──────────────────────────────────────────────
  SELECT 'D. inventory_counts',
    CASE WHEN c.inv_run AND c.inv_qb THEN format($f$
      SELECT 'total'::text AS k, count(*)::text AS v FROM public.inventory_counts WHERE business_id = %1$L
      UNION ALL SELECT 'inventory_id NULL (detached or unknown)', count(*)::text
        FROM public.inventory_counts WHERE business_id = %1$L AND inventory_id IS NULL
      UNION ALL SELECT 'points at an import-run row', count(*)::text
        FROM public.inventory_counts k JOIN public.business_inventory i ON i.id = k.inventory_id
        WHERE k.business_id = %1$L AND i.import_run_id IS NOT NULL
      UNION ALL SELECT 'points at a row WITH qb_item_id', count(*)::text
        FROM public.inventory_counts k JOIN public.business_inventory i ON i.id = k.inventory_id
        WHERE k.business_id = %1$L AND i.qb_item_id IS NOT NULL
      UNION ALL SELECT 'points at a retired row', count(*)::text
        FROM public.inventory_counts k JOIN public.business_inventory i ON i.id = k.inventory_id
        WHERE k.business_id = %1$L AND i.retired_at IS NOT NULL
      UNION ALL SELECT 'carries plant_tag_id', count(*)::text
        FROM public.inventory_counts WHERE business_id = %1$L AND plant_tag_id IS NOT NULL
      UNION ALL SELECT 'carries item_label', count(*)::text
        FROM public.inventory_counts WHERE business_id = %1$L AND item_label IS NOT NULL $f$, b.id)
    ELSE $f$ SELECT 'column missing'::text AS k, 'business_inventory.qb_item_id or .import_run_id'::text AS v $f$ END
  FROM col c, biz b
  UNION ALL
  -- ── E. captured orders → customers with a qb_customer_id, by door ───────────────────────────
  --    QuickBooks door = order_kind 'history' with qb_invoice_id (historyOrderWriter.ts)
  --    OCR door        = order_kind 'history' with receipt_id   (api/customers/create.ts)
  SELECT 'E. captured orders',
    CASE WHEN c.cust_qb AND c.cust_run AND c.ord_kind AND c.ord_rcpt AND c.ord_qbinv THEN format($f$
      SELECT CASE WHEN o.qb_invoice_id IS NOT NULL THEN 'QuickBooks door'
                  WHEN o.receipt_id    IS NOT NULL THEN 'OCR door'
                  ELSE 'history, neither key' END AS k,
             count(*) || ' orders · ' ||
             count(*) FILTER (WHERE cu.qb_customer_id IS NOT NULL) || ' → customer with qb_customer_id · ' ||
             count(*) FILTER (WHERE cu.qb_customer_id IS NULL) || ' → customer without · ' ||
             count(*) FILTER (WHERE cu.import_run_id IS NOT NULL) || ' → import-run customer' AS v
      FROM public.orders o LEFT JOIN public.customers cu ON cu.id = o.customer_id
      WHERE o.business_id = %L AND o.order_kind = 'history'
      GROUP BY 1 ORDER BY 1 $f$, b.id)
    ELSE $f$ SELECT 'column missing'::text AS k, 'customers.qb_customer_id/.import_run_id or orders.order_kind/.receipt_id/.qb_invoice_id'::text AS v $f$ END
  FROM col c, biz b
  UNION ALL
  -- ── F. the 20260916b snapshot columns, if anyone has applied them ───────────────────────────
  SELECT 'F. 16b snapshots',
    CASE WHEN c.ord_snap AND c.cnt_snap THEN format($f$
      SELECT 'orders with customer_qb_id'::text AS k, count(*)::text AS v
        FROM public.orders WHERE business_id = %1$L AND customer_qb_id IS NOT NULL
      UNION ALL SELECT 'inventory_counts with lot_qb_item_id', count(*)::text
        FROM public.inventory_counts WHERE business_id = %1$L AND lot_qb_item_id IS NOT NULL $f$, b.id)
    ELSE $f$ SELECT 'not applied'::text AS k, 'orders.customer_qb_id / inventory_counts.lot_qb_item_id absent (expected: 16b is a draft)'::text AS v $f$ END
  FROM col c, biz b
)
SELECT q.section, x.k, x.v
FROM q,
     xmltable('/table/row' PASSING query_to_xml(q.sql_text, true, false, '')
              COLUMNS k text PATH 'k', v text PATH 'v') x
ORDER BY q.section, x.k;
