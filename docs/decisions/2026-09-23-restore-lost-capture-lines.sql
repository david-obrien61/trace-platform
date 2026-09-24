-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-09-23-restore-lost-capture-lines.sql        ledger #386 · URGENT
--
-- RESTORE the tree lines that capture dropped from Lindsey LaPrime's and Duy Le's
-- orders. LaPrime DELIVERS TOMORROW (Thu 2026-09-24) with 8 trees missing from the
-- load list. Nothing is deleted; two rows are inserted.
--
-- ═══ THE CAUSE, MEASURED — AND IT IS NOT AN OCR FAILURE ═══
--
-- `api/customers/create.ts:200` selects **`line_items_original`** and passes it to
-- `buildHistoryOrder` as `lineItemsOriginal`. That column is the WRITE-ONCE OCR
-- SNAPSHOT — `20260902_receipt_line_edit_and_vendor_preference.sql` enforces it with a
-- trigger whose own message reads *"receipts.line_items_original is write-once: it is the
-- record of what the OCR read"*. Lauren's CORRECTIONS live in `line_items`.
--
-- 🔴 SO EVERY LINE LAUREN ADDS AT CAPTURE IS DISCARDED WHEN THE ORDER IS BUILT. She fixes
--    the document on screen, the receipt reconciles to `match` with delta 0.00 — and the
--    order is built from the pre-correction snapshot. The screen tells her it balanced.
--
--    MEASURED on both receipts: `accept_vs_edit = 'edited'`, `created_at = updated_at`,
--    `reconcile_status = 'match'`, `reconcile_delta = 0.00`, `line_items` = 4 lines,
--    `line_items_original` = 2. The corrected set foots; the snapshot never did.
--
-- ⚠️ `historyOrderLines()` IS NOT THE CULPRIT AND WAS CHECKED FIRST: it maps every line it
--    is given and filters nothing (`historyOrder.ts:186`). It was handed two lines.
--    A correct function on the wrong input — rule 23's lesson, one layer over.
--
-- 🔴 AND THE IMBALANCE WAS ALREADY DETECTED. `historyOrder.ts:334` computes
--    `arithmeticBalances`, and `create.ts:231` reacts to it with `console.warn(...)` —
--    *"recorded AS PRINTED, not corrected"* — then inserts the order and schedules the
--    stop anyway. A server log is not a surface: nobody at LAWNS can see it. The check
--    exists, is correct, and is wired to nothing. That is what part 2 builds.
--
-- ═══ BLAST RADIUS, SWEPT ACROSS EVERY CAPTURED ORDER (not only today) ═══
--   delivery     customer                subtotal      lines     missing
--   2026-09-12   Leo Fleishman            2175.00      50.00     2125.00   (delivery PAST)
--   2026-09-24   Lindsey LaPrime          1900.00    -100.00     2000.00   ← TOMORROW
--   2026-09-26   Duy Le                    432.50     -17.50      450.00   ← Saturday
--   (no stop)    LEANDER AREA WHLS NRS    1283.88    1319.80      -35.92   x2 (tech-debt #143's
--   (no stop)    Terry Schultz            2854.01    2831.51       22.50    double capture)
--   TOTAL $4,525.66. **53 of 145 LAWNS receipts have `line_items_original` shorter than
--   `line_items`**, so the population at risk is far larger than the six orders that
--   currently mis-foot.
--
-- ⚠️ THIS FILE RESTORES ONLY THE TWO WITH UPCOMING DELIVERIES, per David's instruction.
--    Fleishman (delivered 12 Sep) and the three no-stop rows are NOT touched here — a past
--    delivery is a different question (what was actually loaded?) and is flagged, not fixed.
--
-- ═══ WHERE THE RESTORED VALUES COME FROM ═══
-- `receipts.line_items` — Lauren's corrected capture, quoted verbatim:
--   Duy Le  {"sku":null,"amount":450, "quantity":null,"unit_price":null,"description":"Desert Willow 15 Gallon"}
--   LaPrime {"sku":null,"amount":2000,"quantity":null,"unit_price":null,"description":"Skyline Holly - 15 Gallon"}
--
-- ⚠️ THE CAPTURE GIVES AN AMOUNT AND NO QUANTITY, so qty/unit price are DERIVED — and the
--    derivation is stated rather than hidden:
--    · LaPrime: the DISCOUNT line on the same document is `quantity 8 @ -37.50`, so the
--      document itself says eight trees. 2000 / 8 = **250.00 exactly**, and 37.50 / 250 =
--      15%, which agrees with the discount's own rate. Nothing is rounded.
--    · Duy Le: one tree at 450.00. Corroborated independently — Gillespie's order 2,
--      captured the same evening, carries `DW15 Desert Willow - 15 Gallon` at $450.00.
--    If either derivation is wrong, it is wrong about QUANTITY, never about MONEY: the
--    subtotal is taken from the document and V1/V2 below foot it to the cent.
--
-- `business_inventory_id` is NULL on both — INVARIANT (1) of historyOrder.ts: committed
-- stock is DERIVED (D-52), so a lot id on a captured line silently reduces sellable stock.
--
-- D-37: TRACE never touches money. Neither order has a QuickBooks invoice
-- (`qb_invoice_id` NULL on both, measured). Nothing to void there.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- Lindsey LaPrime — order f6dea1c9, receipt f8dc9fa6, stop 6224f79a, THU 2026-09-24
INSERT INTO order_items (order_id, quantity, unit_price, subtotal, description, sku, business_inventory_id)
SELECT 'f6dea1c9-757a-48b7-90de-ce2e0268c84b', 8, 250.00, 2000.00, 'Skyline Holly - 15 Gallon', NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM order_items
                    WHERE order_id = 'f6dea1c9-757a-48b7-90de-ce2e0268c84b'
                      AND description = 'Skyline Holly - 15 Gallon');

-- Duy Le — order 82a97473, receipt 14afc47d, stop at 1145 Canna Bend, SAT 2026-09-26
INSERT INTO order_items (order_id, quantity, unit_price, subtotal, description, sku, business_inventory_id)
SELECT '82a97473-1b6f-490d-a73a-7484c23e1095', 1, 450.00, 450.00, 'Desert Willow 15 Gallon', NULL, NULL
 WHERE NOT EXISTS (SELECT 1 FROM order_items
                    WHERE order_id = '82a97473-1b6f-490d-a73a-7484c23e1095'
                      AND description = 'Desert Willow 15 Gallon');

-- GUARDED like the two line inserts above. Running the file twice previously added a SECOND
-- audit row - harmless but untrue, since the second run restores nothing. Found by EXECUTING
-- the file twice in PGlite; the read-only simulation could not have seen it.
INSERT INTO audit_log (business_id, actor_role, action, target_type, target_id, detail, outcome)
SELECT 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74', 'OWNER', 'order.lines_restored', 'order',
  'f6dea1c9-757a-48b7-90de-ce2e0268c84b',
  -- 🔴 `audit_log.detail` IS **jsonb NOT NULL**, not text. v1 of this file passed a text
  -- concatenation here and died on ERROR 42804 at this statement, aborting the whole
  -- transaction and writing nothing. See the header note on how that reached David.
  jsonb_build_object(
    'reason',      'capture built the order from line_items_original (write-once OCR snapshot) '
                || 'instead of line_items (Lauren''s corrections) — api/customers/create.ts:200',
    'ledger',      386,
    'restored',    jsonb_build_array(
        jsonb_build_object('order_id','f6dea1c9-757a-48b7-90de-ce2e0268c84b','customer','Lindsey LaPrime',
                           'description','Skyline Holly - 15 Gallon','quantity',8,'unit_price',250.00,
                           'subtotal',2000.00,'delivery_date','2026-09-24',
                           'receipt_id','f8dc9fa6-a238-4e33-b09e-d860bcbe77de'),
        jsonb_build_object('order_id','82a97473-1b6f-490d-a73a-7484c23e1095','customer','Duy Le',
                           'description','Desert Willow 15 Gallon','quantity',1,'unit_price',450.00,
                           'subtotal',450.00,'delivery_date','2026-09-26',
                           'receipt_id','14afc47d-8dc1-4e48-9df9-2806b8ad3c23')),
    'derivation',  'Amounts are the document''s. QUANTITIES ARE DERIVED: LaPrime from the same '
                || 'document''s discount line (quantity 8 @ -37.50), giving 2000/8 = 250.00 exact '
                || 'and 37.50/250 = 15%, which agrees with that discount''s own rate; Duy Le one '
                || 'tree at 450.00, corroborated by Gillespie order f638c955 carrying DW15 at 450.00 '
                || 'the same evening. A wrong derivation would be wrong about QUANTITY, never money.',
    'money_moved', false),
  'success'
 WHERE NOT EXISTS (SELECT 1 FROM audit_log
                    WHERE action = 'order.lines_restored'
                      AND target_id = 'f6dea1c9-757a-48b7-90de-ce2e0268c84b');

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style. Run AFTER the transaction. Read-only.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — 🔴 LaPRIME NOW FOOTS TO THE CENT. Expect PASS, gap 0.00.
SELECT 'V1 LaPrime lines foot to subtotal' AS check,
       CASE WHEN abs(o.subtotal - li.s) < 0.005 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       o.subtotal, li.s AS lines_sum, round(o.subtotal - li.s, 2) AS gap
  FROM orders o CROSS JOIN LATERAL
       (SELECT coalesce(sum(quantity * unit_price), 0) AS s FROM order_items WHERE order_id = o.id) li
 WHERE o.id = 'f6dea1c9-757a-48b7-90de-ce2e0268c84b';

-- V2 — 🔴 DUY LE NOW FOOTS TO THE CENT. Expect PASS, gap 0.00.
SELECT 'V2 Duy Le lines foot to subtotal' AS check,
       CASE WHEN abs(o.subtotal - li.s) < 0.005 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       o.subtotal, li.s AS lines_sum, round(o.subtotal - li.s, 2) AS gap
  FROM orders o CROSS JOIN LATERAL
       (SELECT coalesce(sum(quantity * unit_price), 0) AS s FROM order_items WHERE order_id = o.id) li
 WHERE o.id = '82a97473-1b6f-490d-a73a-7484c23e1095';

-- V3 — 🔴 THE THURSDAY LOAD LIST NOW CARRIES THE 8 TREES. This is the number the crew reads.
SELECT 'V3 Thu 2026-09-24 load list shows 8 Skyline Holly' AS check,
       CASE WHEN coalesce(sum(oi.quantity), 0) = 8 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       coalesce(sum(oi.quantity), 0) AS trees_on_the_sheet, 8 AS expected
  FROM deliveries dl JOIN order_items oi ON oi.order_id = dl.order_id
 WHERE dl.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND dl.delivery_date = '2026-09-24' AND dl.status <> 'cancelled'
   AND oi.description = 'Skyline Holly - 15 Gallon';

-- V4 — SATURDAY CARRIES DUY LE'S DESERT WILLOW.
SELECT 'V4 Sat 2026-09-26 load list shows the Desert Willow' AS check,
       CASE WHEN coalesce(sum(oi.quantity), 0) = 1 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       coalesce(sum(oi.quantity), 0) AS trees_on_the_sheet
  FROM deliveries dl JOIN order_items oi ON oi.order_id = dl.order_id
 WHERE dl.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND dl.delivery_date = '2026-09-26' AND dl.status <> 'cancelled'
   AND oi.description = 'Desert Willow 15 Gallon';

-- V5 — NEGATIVE CONTROL: THE MONEY DID NOT MOVE. Restoring a line must not change a total.
SELECT 'V5 totals unchanged — no money was touched' AS check,
       CASE WHEN bool_and(ok) THEN 'PASS' ELSE 'FAIL' END AS verdict, count(*) AS orders_checked
  FROM (SELECT (subtotal = 1900.00 AND tax_amount = 156.75 AND total_amount = 2056.75) AS ok
          FROM orders WHERE id = 'f6dea1c9-757a-48b7-90de-ce2e0268c84b'
        UNION ALL
        SELECT (subtotal = 432.50 AND tax_amount = 35.68 AND total_amount = 468.18)
          FROM orders WHERE id = '82a97473-1b6f-490d-a73a-7484c23e1095') t;

-- V6 — IDEMPOTENT: running this file twice inserts nothing the second time.
SELECT 'V6 re-run would insert 0 rows' AS check,
       CASE WHEN count(*) = 2 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS restored_lines_present, 2 AS expected
  FROM order_items
 WHERE (order_id = 'f6dea1c9-757a-48b7-90de-ce2e0268c84b' AND description = 'Skyline Holly - 15 Gallon')
    OR (order_id = '82a97473-1b6f-490d-a73a-7484c23e1095' AND description = 'Desert Willow 15 Gallon');

-- V7 — THE REMAINING MIS-FOOTING ORDERS ARE THE FOUR THIS FILE DELIBERATELY DID NOT TOUCH.
SELECT 'V7 only the 4 untouched orders still mis-foot' AS check,
       CASE WHEN count(*) = 4 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS still_mis_footing, 4 AS expected_fleishman_plus_three
  FROM orders o
 WHERE o.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND o.receipt_id IS NOT NULL
   AND abs(o.subtotal - (SELECT coalesce(sum(quantity * unit_price), 0)
                           FROM order_items WHERE order_id = o.id)) > 0.005;
