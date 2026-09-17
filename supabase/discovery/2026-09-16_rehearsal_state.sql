-- READ-ONLY DISCOVERY. WRITES NOTHING.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 2026-09-16 — THE REHEARSAL STATE ON LAWNS (ledger #342)
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- Run in the Supabase SQL editor, as postgres. Every statement is a SELECT. Paste each result
-- back. Nothing below changes a row — if the editor reports "rows affected", stop and say so.
--
-- ORIGIN, AS THE SCHEMA RECORDS IT (no new column is needed — ledger #342 §1a/§1b):
--   orders.order_kind  NULL      = a checkout order rung up with QuickBooks writes ON (live)
--                      'test'    = a checkout order rung up in TEST mode (practice)
--                      'history' = a CAPTURED sale (an OCR'd invoice, or the QuickBooks API door)
--   orders.receipt_id  set only on an OCR-captured order (the photographed invoice's receipts row)
--   orders.qb_invoice_id  set on an API-door captured order, and on a live order after its push
--   There is NO separate "captured documents" table: a captured invoice is a `receipts` row plus
--   an `orders` row pointing at it. A vendor receipt is a `receipts` row with no order.
--   `orders` has NO created_by column. The actor below is the `order_created` ledger event's
--   actor (checkout only — captured orders write no creation event) or, for an OCR capture, the
--   receipt's `uploaded_by`.
--
-- LAWNS = ed2e5933-45dc-4b9b-a331-ddfd125e7a74
-- ════════════════════════════════════════════════════════════════════════════════════════════


-- ── 0. THE THREE TENANTS, resolved from the table (short ids are prefixes, not guesses) ──────
SELECT id, name, business_type, qbo_writes_enabled, created_at
  FROM public.businesses
 WHERE id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
    OR id::text LIKE 'f7ec5d67%'
    OR id::text LIKE '06065fe7%'
 ORDER BY name;


-- ── 1. LAWNS ORDERS BY ORIGIN × order_kind × status ───────────────────────────────────────────
SELECT CASE
         WHEN o.order_kind = 'history' AND o.receipt_id IS NOT NULL THEN 'captured — OCR invoice'
         WHEN o.order_kind = 'history'                              THEN 'captured — QuickBooks API door / backfill'
         WHEN o.order_kind = 'test'                                 THEN 'checkout — TEST mode (practice)'
         WHEN o.order_kind IS NULL                                  THEN 'checkout — live'
         ELSE 'other kind: ' || o.order_kind
       END                                   AS origin,
       COALESCE(o.order_kind, '(null)')      AS order_kind,
       o.status,
       count(*)                              AS orders,
       min(o.created_at)                     AS first_created,
       max(o.created_at)                     AS last_created,
       string_agg(DISTINCT COALESCE(ue.email, ur.email, '(no actor recorded)'), ', ') AS created_by
  FROM public.orders o
  LEFT JOIN LATERAL (
         SELECT l.actor_user_id FROM public.business_inventory_ledger l
          WHERE l.source_type = 'order' AND l.source_id = o.id AND l.kind = 'order_created'
          ORDER BY l.created_at LIMIT 1) ev ON true
  LEFT JOIN auth.users ue ON ue.id = ev.actor_user_id
  LEFT JOIN public.receipts r ON r.id = o.receipt_id
  LEFT JOIN auth.users ur ON ur.id = r.uploaded_by
 WHERE o.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
 GROUP BY 1, 2, 3
 ORDER BY 1, 2, 3;


-- ── 2. ORDER 6a60a0ca — what it is, who made it, what it sold ─────────────────────────────────
-- 2a. the order
SELECT o.id, o.business_id, o.order_kind, o.status, o.transport_method, o.total_amount,
       o.notes AS invoice_number, o.receipt_id, o.qb_invoice_id, o.created_at,
       c.first_name, c.last_name, c.import_run_id AS customer_import_run_id,
       ev.actor_user_id AS created_by_user_id, u.email AS created_by_email,
       bm.role AS created_by_role
  FROM public.orders o
  LEFT JOIN public.customers c ON c.id = o.customer_id
  LEFT JOIN LATERAL (
         SELECT l.actor_user_id FROM public.business_inventory_ledger l
          WHERE l.source_type = 'order' AND l.source_id = o.id AND l.kind = 'order_created'
          ORDER BY l.created_at LIMIT 1) ev ON true
  LEFT JOIN auth.users u ON u.id = ev.actor_user_id
  LEFT JOIN public.business_members bm ON bm.business_id = o.business_id AND bm.user_id = ev.actor_user_id
 WHERE o.id = '6a60a0ca-dedf-4c1d-a58c-804bf1e64c79';

-- 2b. its lines
SELECT oi.id, oi.quantity, oi.unit_price, oi.subtotal, oi.business_inventory_id,
       bi.name, bi.size, bi.qty AS lot_qty_now, bi.import_run_id AS lot_import_run_id, bi.retired_at
  FROM public.order_items oi
  LEFT JOIN public.business_inventory bi ON bi.id = oi.business_inventory_id
 WHERE oi.order_id = '6a60a0ca-dedf-4c1d-a58c-804bf1e64c79';

-- 2c. every ledger row it caused, with the actor
SELECT l.created_at, l.kind, l.delta, l.inventory_id, l.source_type, l.reason,
       l.actor_user_id, u.email AS actor_email
  FROM public.business_inventory_ledger l
  LEFT JOIN auth.users u ON u.id = l.actor_user_id
 WHERE l.source_type = 'order' AND l.source_id = '6a60a0ca-dedf-4c1d-a58c-804bf1e64c79'
 ORDER BY l.created_at, l.kind;


-- ── 3. RECEIPTS (vendor receipts and captured invoices) ───────────────────────────────────────
SELECT CASE WHEN EXISTS (SELECT 1 FROM public.orders o WHERE o.receipt_id = r.id)
            THEN 'captured invoice (has an order)' ELSE 'receipt (no order)' END AS kind,
       count(*)            AS rows,
       min(r.created_at)   AS first_created,
       max(r.created_at)   AS last_created,
       string_agg(DISTINCT COALESCE(u.email, r.uploaded_by::text), ', ') AS uploaded_by
  FROM public.receipts r
  LEFT JOIN auth.users u ON u.id = r.uploaded_by
 WHERE r.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
 GROUP BY 1
 ORDER BY 1;


-- ── 4. DELIVERIES BY THE ORIGIN OF THE ORDER THEY BELONG TO ───────────────────────────────────
SELECT CASE
         WHEN d.order_id IS NULL        THEN 'no order (stop only)'
         WHEN o.id IS NULL              THEN 'order id set, order not found'
         WHEN o.order_kind = 'history'  THEN 'captured order'
         WHEN o.order_kind = 'test'     THEN 'checkout — TEST mode (practice)'
         WHEN o.order_kind IS NULL      THEN 'checkout — live'
         ELSE 'other kind: ' || o.order_kind
       END                    AS order_origin,
       COALESCE(d.source, '(null)') AS delivery_source,
       d.status,
       count(*)               AS stops
  FROM public.deliveries d
  LEFT JOIN public.orders o ON o.id = d.order_id
 WHERE d.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
 GROUP BY 1, 2, 3
 ORDER BY 1, 2, 3;


-- ── 5. ASSETS / COSTS (cost_objects) ──────────────────────────────────────────────────────────
SELECT node_type, count(*) AS rows, min(created_at) AS first_created, max(created_at) AS last_created
  FROM public.cost_objects
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
 GROUP BY node_type
 ORDER BY node_type;


-- ── 6. LIVE REFERENCES TO IMPORT-RUN ROWS — what makes the undo refuse ────────────────────────
-- (cost_objects and receipts have NO column that can point at a customer or a product; they are
--  listed with a structural 0 so the absence is stated, not implied.)
SELECT 'orders on an imported customer — ' || COALESCE(o.order_kind, 'checkout (live)') AS reference,
       count(*) AS rows
  FROM public.orders o
  JOIN public.customers c ON c.id = o.customer_id
 WHERE o.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND c.import_run_id IS NOT NULL
 GROUP BY o.order_kind
UNION ALL
SELECT 'order lines on an imported product — ' || COALESCE(o.order_kind, 'checkout (live)'), count(*)
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.business_inventory bi ON bi.id = oi.business_inventory_id
 WHERE o.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND bi.import_run_id IS NOT NULL
 GROUP BY o.order_kind
UNION ALL
SELECT 'receipts behind a captured order on an imported customer', count(*)
  FROM public.receipts r
  JOIN public.orders o    ON o.receipt_id = r.id
  JOIN public.customers c ON c.id = o.customer_id
 WHERE r.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND c.import_run_id IS NOT NULL
UNION ALL
SELECT 'deliveries on an imported customer — ' ||
       CASE WHEN d.order_id IS NULL THEN 'no order' ELSE COALESCE(o.order_kind, 'checkout (live)') END, count(*)
  FROM public.deliveries d
  JOIN public.customers c ON c.id = d.customer_id
  LEFT JOIN public.orders o ON o.id = d.order_id
 WHERE d.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND c.import_run_id IS NOT NULL
 GROUP BY CASE WHEN d.order_id IS NULL THEN 'no order' ELSE COALESCE(o.order_kind, 'checkout (live)') END
UNION ALL
SELECT 'customer_addresses on an imported customer', count(*)
  FROM public.customer_addresses ca
  JOIN public.customers c ON c.id = ca.customer_id
 WHERE c.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND c.import_run_id IS NOT NULL
UNION ALL
SELECT 'cost_objects (no customer or product column — structurally 0)', 0
UNION ALL
SELECT 'receipts pointing directly at a customer or product (no such column — structurally 0)', 0
ORDER BY 1;


-- ── 7. LEDGER ROWS ON IMPORT-RUN LOTS, by run × kind × source_type × order origin ─────────────
SELECT bi.import_run_id,
       l.kind,
       COALESCE(l.source_type, '(null)') AS source_type,
       CASE WHEN l.source_type <> 'order' THEN '—'
            WHEN o.id IS NULL            THEN 'order no longer exists'
            ELSE COALESCE(o.order_kind, 'checkout (live)') END AS order_origin,
       count(*)          AS rows,
       sum(l.delta)      AS delta_sum,
       min(l.created_at) AS first_at,
       max(l.created_at) AS last_at
  FROM public.business_inventory_ledger l
  JOIN public.business_inventory bi ON bi.id = l.inventory_id
  LEFT JOIN public.orders o ON l.source_type = 'order' AND o.id = l.source_id
 WHERE bi.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND bi.import_run_id IS NOT NULL
 GROUP BY 1, 2, 3, 4
 ORDER BY 1, 2, 3, 4;

-- 7b. 🔴 WHICH ROWS ARE TODAY'S REVERSAL. Every non-order row on an import-run lot, by kind,
--     reason and DAY. The seed is kind 'opening_stock_seed', source 'manual'. The 2026-09-16
--     reversal is not in any committed file — this read is how it is identified.
SELECT l.kind, COALESCE(l.source_type, '(null)') AS source_type, l.reason,
       (l.created_at AT TIME ZONE 'America/Chicago')::date AS day_ct,
       count(*) AS rows, count(DISTINCT l.inventory_id) AS lots,
       sum(l.delta) AS delta_sum, min(l.delta) AS min_delta, max(l.delta) AS max_delta,
       string_agg(DISTINCT COALESCE(u.email, l.actor_user_id::text, 'system'), ', ') AS actors
  FROM public.business_inventory_ledger l
  JOIN public.business_inventory bi ON bi.id = l.inventory_id
  LEFT JOIN auth.users u ON u.id = l.actor_user_id
 WHERE bi.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND bi.import_run_id IS NOT NULL
   AND l.source_type IS DISTINCT FROM 'order'
 GROUP BY 1, 2, 3, 4
 ORDER BY 4, 1, 3;

-- 7c. 🔴 EXACTLY WHAT 20260916_rehearsal_cleanup_lawns.sql WILL DELETE — the same predicate,
--     as a SELECT. Compare with 7b before applying. If a row here is not a seed or a reversal,
--     DO NOT APPLY and say so.
WITH seed AS (
  SELECT l.* FROM public.business_inventory_ledger l
    JOIN public.business_inventory bi ON bi.id = l.inventory_id
   WHERE bi.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
     AND bi.import_run_id IS NOT NULL
     AND l.business_id  = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
     AND l.kind = 'opening_stock_seed' AND l.source_type = 'manual'
), reversal AS (
  SELECT DISTINCT l.* FROM public.business_inventory_ledger l
    JOIN seed s ON s.inventory_id = l.inventory_id
   WHERE l.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
     AND l.source_type = 'manual'
     AND l.kind <> 'opening_stock_seed'
     AND s.delta > 0
     AND l.delta < 0
     AND l.delta = -s.delta
     AND l.created_at > s.created_at
     AND (l.created_at AT TIME ZONE 'America/Chicago')::date = DATE '2026-09-16'
)
SELECT 'seed' AS part, kind, source_type, count(*) AS rows, sum(delta) AS delta_sum FROM seed GROUP BY kind, source_type
UNION ALL
SELECT 'reversal', kind, source_type, count(*), sum(delta) FROM reversal GROUP BY kind, source_type
ORDER BY 1, 2;


-- ── 8. LEDGER ROWS ON LOTS WITH import_run_id IS NULL, and rows with no lot, by source_type ───
SELECT CASE WHEN l.inventory_id IS NULL THEN 'no lot (order events)'
            WHEN bi.id IS NULL          THEN 'lot no longer exists'
            ELSE 'lot not from an import' END AS lot,
       COALESCE(l.source_type, '(null)') AS source_type,
       count(*) AS rows, sum(l.delta) AS delta_sum
  FROM public.business_inventory_ledger l
  LEFT JOIN public.business_inventory bi ON bi.id = l.inventory_id
 WHERE l.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND (bi.import_run_id IS NULL)
 GROUP BY 1, 2
 ORDER BY 1, 2;


-- ── 9. LIVE IMPORT RUNS ON business_inventory AND customers ───────────────────────────────────
SELECT 'business_inventory' AS tbl, import_run_id,
       count(*) AS rows,
       count(*) FILTER (WHERE retired_at IS NULL)  AS live_rows,
       count(*) FILTER (WHERE qty > 0)             AS rows_with_qty,
       min(created_at) AS first_created, max(created_at) AS last_created
  FROM public.business_inventory
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND import_run_id IS NOT NULL
 GROUP BY import_run_id
UNION ALL
SELECT 'customers', import_run_id, count(*), count(*), NULL, min(created_at), max(created_at)
  FROM public.customers
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND import_run_id IS NOT NULL
 GROUP BY import_run_id
ORDER BY 1, 2;


-- ── 10. EVERY TABLE THAT CAN POINT AT AN IMPORT-RUN ROW ───────────────────────────────────────
-- 10a. the LIVE foreign-key set into the two parents (includes FKs no migration records)
SELECT c.conrelid::regclass AS child, a.attname AS col, c.confrelid::regclass AS parent,
       CASE c.confdeltype WHEN 'a' THEN 'NO ACTION' WHEN 'r' THEN 'RESTRICT' WHEN 'c' THEN 'CASCADE'
                          WHEN 'n' THEN 'SET NULL' WHEN 'd' THEN 'SET DEFAULT' END AS on_delete,
       c.conname
  FROM pg_catalog.pg_constraint c
  JOIN pg_catalog.pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
 WHERE c.contype = 'f'
   AND c.confrelid IN ('public.business_inventory'::regclass, 'public.customers'::regclass)
 ORDER BY 3, 1, 2;

-- 10b. rows on LAWNS in each of them that point at an import-run row
SELECT 'business_inventory_ledger.inventory_id' AS reference, count(*) AS rows
  FROM public.business_inventory_ledger t JOIN public.business_inventory p ON p.id = t.inventory_id
 WHERE p.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND p.import_run_id IS NOT NULL
UNION ALL
SELECT 'order_items.business_inventory_id', count(*)
  FROM public.order_items t JOIN public.business_inventory p ON p.id = t.business_inventory_id
 WHERE p.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND p.import_run_id IS NOT NULL
UNION ALL
SELECT 'inventory_counts.inventory_id', count(*)
  FROM public.inventory_counts t JOIN public.business_inventory p ON p.id = t.inventory_id
 WHERE p.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND p.import_run_id IS NOT NULL
UNION ALL
SELECT 'cultivar_plants.inventory_id', count(*)
  FROM public.cultivar_plants t JOIN public.business_inventory p ON p.id = t.inventory_id
 WHERE p.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND p.import_run_id IS NOT NULL
UNION ALL
SELECT 'production_plan_lines (source or target)', count(*)
  FROM public.production_plan_lines t JOIN public.business_inventory p
    ON p.id = t.source_inventory_id OR p.id = t.target_inventory_id
 WHERE p.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND p.import_run_id IS NOT NULL
UNION ALL
SELECT 'orders.customer_id', count(*)
  FROM public.orders t JOIN public.customers p ON p.id = t.customer_id
 WHERE p.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND p.import_run_id IS NOT NULL
UNION ALL
SELECT 'deliveries.customer_id', count(*)
  FROM public.deliveries t JOIN public.customers p ON p.id = t.customer_id
 WHERE p.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND p.import_run_id IS NOT NULL
UNION ALL
SELECT 'customer_addresses.customer_id', count(*)
  FROM public.customer_addresses t JOIN public.customers p ON p.id = t.customer_id
 WHERE p.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND p.import_run_id IS NOT NULL
UNION ALL
SELECT 'audit_log.target_id (text, no FK) → an imported product', count(*)
  FROM public.audit_log t JOIN public.business_inventory p ON p.id::text = t.target_id
 WHERE p.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND p.import_run_id IS NOT NULL
UNION ALL
SELECT 'audit_log.detail->>customer_id (jsonb, no FK) → an imported customer', count(*)
  FROM public.audit_log t JOIN public.customers p ON p.id::text = t.detail->>'customer_id'
 WHERE p.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND p.import_run_id IS NOT NULL
ORDER BY 1;


-- ── 11. TOTAL LEDGER ROWS, PER TENANT (all three) ─────────────────────────────────────────────
SELECT b.name, b.id, count(l.id) AS ledger_rows,
       count(l.id) FILTER (WHERE l.inventory_id IS NOT NULL) AS stock_rows,
       count(l.id) FILTER (WHERE l.inventory_id IS NULL)     AS order_event_rows
  FROM public.businesses b
  LEFT JOIN public.business_inventory_ledger l ON l.business_id = b.id
 WHERE b.id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
    OR b.id::text LIKE 'f7ec5d67%'
    OR b.id::text LIKE '06065fe7%'
 GROUP BY b.name, b.id
 ORDER BY b.name;
