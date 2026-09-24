-- ─────────────────────────────────────────────────────────────────────────────
-- 2026-09-23-gillespie-cancel-order-1.sql          ledger #386 · David's ruling
--
-- CANCEL Dwight Gillespie's ORDER 1. Nothing is deleted.
--
-- WHY THIS IS IN docs/decisions/ AND **NOT** supabase/migrations/:
--   it is a ONE-CUSTOMER, ONE-TENANT correction keyed to UUIDs that exist only in
--   LAWNS's live database. A migration is replayed against every rebuilt database and
--   listed forever by `verify-migration-apply-state`; this would be NOT_APPLIED on every
--   other environment for all time, which is the stale-noise that made tech-debt #248
--   worth retiring. The schema change it implies (`orders.replaced_by`) IS a migration
--   and is flagged below — that is the part that belongs in the corpus.
--   ⚠️ David's call if he would rather it lived in the corpus; say so and it moves.
--
-- WHAT HAPPENED (David, 2026-09-23). Dwight Gillespie is legitimate and so are both
-- orders. Lauren captured order 1 (warranty replacements only), then a corrected order 2
-- (the same replacements PLUS a new tree). She entered him twice BECAUSE SHE HAS NO WAY
-- TO CANCEL AN ORDER, OR TO ADD TO ONE. The duplicate is a missing control, not a mistake.
--
-- MEASURED LIVE 2026-09-23 21:20 UTC, read-only, before writing a line of this:
--
--   ORDER 1 — THE ONE CANCELLED HERE
--     id          10094bbc-8a6f-44f5-95e4-0b6e310539bc
--     created_at  2026-09-01 15:26:10.170216+00
--     source      qb_invoice_id 10208, import_run_id NULL, order_kind 'history'
--     status      invoiced          total_amount 0.00      2 lines
--       BPJ30REP        Blue Point Juniper (Replacement)        x1  $0.00
--       Cypress:AZBI45  Arizona Cypress Blue Ice (Replacement)  x1  $0.00
--     stop        b01deff3-4081-4a69-bb53-30eabac903e5
--                 101 Crupp Avenue · 2026-09-26 · scheduled · created 2026-08-31 22:01:04
--
--   ORDER 2 — THE SURVIVOR, UNTOUCHED BY THIS FILE
--     id          f638c955-a90e-403f-a290-a5b990ba373b
--     created_at  2026-09-23 20:35:40.642451+00
--     source      qb_invoice_id NULL, import_run_id NULL, order_kind 'history'
--     status      invoiced          total_amount 1515.50   4 lines
--       AZBI45     Arizona Cypress Blue Ice (Replacement)             x1  $0.00
--       BPJ30REP   Blue Point Juniper (Replacement)                   x1  $0.00
--       DW15       Desert Willow - 15 Gallon                          x1  $450.00
--       EHMP30BF   Eagleston Holly Miss Pryss (Tree Form), 30 gallon  x1  $950.00
--     stop        77bdf86f-d1ae-47a9-b39c-025abd984521
--                 101 Crupp Avenue · 2026-09-26 · scheduled · delivery_only
--     (1400.00 of tree lines + 8.25% tax = 1515.50 — the arithmetic agrees)
--
-- 🔴 A FINDING THE BRIEF DID NOT ANTICIPATE, AND IT IS WHY THE LOAD LIST IS WORSE THAN
--   "the two replacement trees twice": THE ARIZONA CYPRESS IS DUPLICATED UNDER TWO
--   DIFFERENT SKUs. Order 1 carries `Cypress:AZBI45`; order 2 carries `AZBI45`. Counted
--   by SKU, Saturday reads `BPJ30REP` qty 2 (visibly doubled) but `AZBI45` qty 1 and
--   `Cypress:AZBI45` qty 1 — two rows of one qty, which does NOT read as a duplicate.
--   So a human scanning the load sheet sees ONE doubled tree and one pair of
--   different-looking trees. Cancelling order 1 removes both, but the SKU divergence is
--   its own defect and is flagged for David, not fixed here.
--
-- ⚠️ `orders.replaced_by` DOES NOT EXIST — measured (information_schema: no replaced_by,
--   replaced_by_order_id, cancelled_at or cancel_reason on `orders`). The link is
--   therefore recorded in `audit_log.detail` below, and the COLUMN is flagged for part B.
--   An audit row is a record, not a relation: no screen can follow it. B must add the
--   column for "Cancelled — replaced by #…" to render.
--
-- ⚠️ `cancelled` IS ALREADY A LIVE `orders.status` VALUE at LAWNS (measured: cancelled,
--   fulfilled, invoiced), and NEITHER `orders` NOR `deliveries` carries a CHECK
--   constraint on status — so nothing can silently refuse this write. `deliveries.status`
--   holds only 'scheduled' today; `stopRead.ts` filters `.neq('status','cancelled')`,
--   which is what takes the stop off the schedule, route and load list.
--
-- D-37: TRACE NEVER TOUCHES MONEY. Order 1 carries QuickBooks invoice 10208. This file
--   does NOT void it. If a second invoice exists in QuickBooks, LAUREN VOIDS IT THERE.
--
-- 2026-09-16 RULING: a live capture survives any wipe/undo/cleanup — a cancelled capture
--   included, keeping its status. Nothing here deletes, so that holds by construction.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- 1. the order is CANCELLED, never deleted
UPDATE orders
   SET status = 'cancelled'
 WHERE id = '10094bbc-8a6f-44f5-95e4-0b6e310539bc'
   AND status <> 'cancelled';

-- 2. its stop comes off Saturday
UPDATE deliveries
   SET status = 'cancelled'
 WHERE id = 'b01deff3-4081-4a69-bb53-30eabac903e5'
   AND status <> 'cancelled';

-- 3. the replaced-by link, recorded where it CAN be recorded today
INSERT INTO audit_log (business_id, actor_role, action, target_type, target_id, detail, outcome)
VALUES (
  'ed2e5933-45dc-4b9b-a331-ddfd125e7a74', 'OWNER', 'order.cancelled', 'order',
  '10094bbc-8a6f-44f5-95e4-0b6e310539bc',
  'Cancelled by David 2026-09-23. SUPERSEDED BY order f638c955-a90e-403f-a290-a5b990ba373b, '
  || 'which carries the same two warranty replacements (BPJ30REP, Arizona Cypress Blue Ice) '
  || 'plus DW15 and EHMP30BF. Lauren re-entered the customer because there is no cancel or '
  || 'append control (ledger #386 part B). Stop b01deff3 cancelled with it. '
  || 'QuickBooks invoice 10208 is NOT touched by TRACE (D-37) — voiding it there is Lauren''s act. '
  || 'replaced_by recorded here because orders.replaced_by does not exist yet.',
  'success');

COMMIT;

-- ═════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style. Each returns a row saying PASS or FAIL in words.
-- Run AFTER the transaction. Read-only.
-- ═════════════════════════════════════════════════════════════════════════════

-- V1 — ORDER 1 IS CANCELLED AND STILL EXISTS. Expect PASS, 1 row, 2 lines intact.
SELECT 'V1 order 1 cancelled, NOT deleted' AS check,
       CASE WHEN count(*) = 1 AND bool_and(status = 'cancelled') THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rows_found,
       (SELECT count(*) FROM order_items WHERE order_id = '10094bbc-8a6f-44f5-95e4-0b6e310539bc') AS lines_still_there
  FROM orders WHERE id = '10094bbc-8a6f-44f5-95e4-0b6e310539bc';

-- V2 — ORDER 2 IS UNTOUCHED. The negative control: this file must change nothing else.
SELECT 'V2 order 2 untouched and still invoiced' AS check,
       CASE WHEN count(*) = 1 AND bool_and(status = 'invoiced')
                 AND bool_and(total_amount = 1515.50) THEN 'PASS' ELSE 'FAIL' END AS verdict,
       min(status) AS status_now, min(total_amount) AS total_now
  FROM orders WHERE id = 'f638c955-a90e-403f-a290-a5b990ba373b';

-- V3 — SATURDAY DROPS 7 -> 6 STOPS. The number David reads on the schedule.
SELECT 'V3 Saturday 2026-09-26 stop count' AS check,
       CASE WHEN count(*) = 6 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS stops_now, 7 AS stops_before, 6 AS expected
  FROM deliveries
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND delivery_date = '2026-09-26' AND status <> 'cancelled';

-- V4 — 🔴 THE LOAD LIST NO LONGER CARRIES THE REPLACEMENTS TWICE, counted the way the
-- defect actually presents: BOTH spellings of the Arizona Cypress collapse to one tree.
SELECT 'V4 replacement trees on Saturday, once each' AS check,
       CASE WHEN coalesce(sum(CASE WHEN sku = 'BPJ30REP' THEN quantity ELSE 0 END), 0) = 1
             AND coalesce(sum(CASE WHEN sku IN ('AZBI45','Cypress:AZBI45') THEN quantity ELSE 0 END), 0) = 1
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       coalesce(sum(CASE WHEN sku = 'BPJ30REP' THEN quantity ELSE 0 END), 0) AS blue_point_juniper,
       coalesce(sum(CASE WHEN sku IN ('AZBI45','Cypress:AZBI45') THEN quantity ELSE 0 END), 0) AS arizona_cypress
  FROM deliveries dl JOIN order_items oi ON oi.order_id = dl.order_id
 WHERE dl.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND dl.delivery_date = '2026-09-26' AND dl.status <> 'cancelled';

-- V5 — GILLESPIE STILL HAS EXACTLY ONE STOP ON SATURDAY, and it is order 2's.
SELECT 'V5 Gillespie has one Saturday stop, order 2' AS check,
       CASE WHEN count(*) = 1 AND bool_and(order_id = 'f638c955-a90e-403f-a290-a5b990ba373b')
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS stops, min(order_id::text) AS which_order
  FROM deliveries
 WHERE customer_id = 'ab41d76b-9f4e-414d-8b02-af1ef3a2bae9'
   AND delivery_date = '2026-09-26' AND status <> 'cancelled';

-- V6 — THE REPLACED-BY LINK IS RECORDED AND NAMES ORDER 2.
SELECT 'V6 audit row records the replaced-by link' AS check,
       CASE WHEN count(*) >= 1 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS audit_rows
  FROM audit_log
 WHERE target_id = '10094bbc-8a6f-44f5-95e4-0b6e310539bc'
   AND action = 'order.cancelled'
   AND detail LIKE '%f638c955-a90e-403f-a290-a5b990ba373b%';

-- V7 — NOTHING WAS DELETED ANYWHERE. Gillespie still has all FOUR orders.
SELECT 'V7 nothing deleted — all 4 Gillespie orders present' AS check,
       CASE WHEN count(*) = 4 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS orders_now, 4 AS expected
  FROM orders WHERE customer_id = 'ab41d76b-9f4e-414d-8b02-af1ef3a2bae9';
