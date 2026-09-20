-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260920 — THE STARTING-NUMBER SEED GAVE STOCK TO 44 ROWS THAT ARE NOT PRODUCTS · ledger #357
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHAT HAPPENED ───────────────────────────────────────────────────────────────────────────
-- The 2026-09-17 reload (run `bffc7713-d275-436c-bf8c-1ff29f3d14b9`) imported 631 products, and
-- the test-mode starting-number seed then set `qty = 10` on every one of them — including fees,
-- labour, discounts and bookkeeping lines. A trip charge reading "10 in stock" confuses the
-- person at the counter, and Lauren sells from this catalogue.
--
-- This is the SECOND run in a row it has happened (the previous run needed the same repair).
-- The durable fix is NOT here: the seed must skip non-products by reading what the books say
-- each item is — tech-debt #352, which waits on the item type and income account being stored.
-- This file repairs the rows that are live today, and nothing else.
--
-- ── THE 44 ROWS ─────────────────────────────────────────────────────────────────────────────
-- Matched on `qb_item_id`, NOT on our row id: the QuickBooks id survives a reload, our id does
-- not. Identified by reading every row the run created that carries no parsed size, plus every
-- sized row whose name contains a fee word (only the three Tree Staking Kits, which are real
-- goods and are NOT touched).
--
-- ✏️ DAVID RULED THE FOUR UNCLASSIFIED ROWS 2026-09-20, AND THREE JOIN THE LIST (41 → 44), each
-- checked against the book before it was added:
--   · Arizona Cypress Blue Ice Replacement (1120) — ZERO. One invoice line, 2026-07-23, **$0**,
--     described "Arizona Cypress Blue Ice (Replacement)". A warranty replacement, not stock.
--   · Gallons Diesel (11) — ZERO. **Nothing in the book contradicts it:** zero lines across 1,510
--     invoices, 318 estimates and the one credit memo. Fuel billed to a job.
--   · Fertilizer-1 (1001) — ZERO. Sold ONCE, 2025-05-15, and the line reads **$250,
--     "Fertilizations of Existing Trees and Shrubs"** — the WORK, not a product. The item's own
--     $0 is a placeholder. It has never been sold as a product, which was David's condition.
--   · HYIS (1118) — **KEPT AT 10.** Two invoice lines at $35 (2026-08-07, 2026-09-11), booked to
--     Sales of Nursery Stock. Physical, so it keeps its starting number.
--
--   FEES / CHARGES (5)     Backyard Delivery · Tailgate Delivery · Trip Charge · Extra charge ·
--                          Late fee
--   SERVICE / LABOUR (23)  Augur Holes and install water monitor pipe · Deliver, Install and
--                          Warranty listed plants · Furnish, Deliver, Install and Warranty
--                          listed Trees · Existing tree removal · Extended warranty · Hours ·
--                          Install your Tree · Kubota Tractor Use · Labor Hours · Move Tree ·
--                          Plant Your Tree · Remove your existing Tree · Replant your existing
--                          tree straight · Services · Sprinkler repair · Stump Removal ·
--                          Supervisor Hours · Tree installation without warranty · Tree removal
--                          and disposal · Tree removal and replant · Tree Replacement · Tree
--                          Trimming by Quote · Tree Warranty Replacement
--   DISCOUNTS (6)          Contractor Discount 15% off · Contractor Discount, 10% · Customer
--                          Discount · Family Discount · Military Discount -10% · Military
--                          Discount 5%
--   BOOKKEEPING (7)        Balance Correction · Bank Deposit/Customer Overpayment Refund ·
--                          Credit · Custom Amount · Deposit · Gift Certificate · Sales
--   RULED BY DAVID (3)     Arizona Cypress Blue Ice Replacement · Gallons Diesel · Fertilizer-1
--                          ────────────────────────────────────────────────────────────────────
--                          5 + 23 + 6 + 7 + 3 = 44. HYIS is the fourth ruled row and is KEPT,
--                          so 587 of the 631 keep their seeded 10.
--
-- ── WHY NO LEDGER ROW IS WRITTEN, AND WHY THE LEDGER MUST STAY AT 470 ───────────────────────
-- This is a plain UPDATE of `qty`. MEASURED on the live catalog 2026-09-20: `business_inventory`
-- carries exactly two triggers, `business_inventory_unit_projection` and
-- `business_inventory_updated_at` — NEITHER writes to `business_inventory_ledger`. The ledger
-- additionally carries `trg_ledger_test_mode_guard → discard_ledger_row_in_test_mode`, so a row
-- would be discarded even if something tried. The seeded 10 never had a ledger line either
-- (R-158: nothing writes the record in test mode), so removing it erases no history.
--
-- ⚠️ IT IS A DIRECT `UPDATE qty`, the form R-93's neighbour declaration warns about. That is
-- deliberate and is the same reasoning the test-mode seed itself records: in test mode there
-- must be no provenance line, because the line would be permanent and the number is practice.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

DO $guard$
DECLARE
  v_biz   uuid := 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
  v_run   uuid := 'bffc7713-d275-436c-bf8c-1ff29f3d14b9';
  v_ids   text[] := ARRAY['1','2','3','4','5','6','7','8','10','11','12','13','14','15','16',
                          '91','102','105','116','117','121','128','129','137','164','167',
                          '172','176','186','187','195','196','197','198','199','207','210',
                          '603','1000','1001','1006','1007','1116','1120'];
  v_found int;
  v_at10  int;
  v_at0   int;
  v_hist  int;
  v_done  int;
BEGIN
  IF array_length(v_ids, 1) <> 44 THEN
    RAISE EXCEPTION 'REFUSED: the id list holds % entries, not 44. Nothing changed.', array_length(v_ids, 1);
  END IF;

  SELECT count(*) INTO v_found
    FROM public.business_inventory
   WHERE business_id = v_biz AND import_run_id = v_run AND qb_item_id = ANY(v_ids);

  IF v_found <> 44 THEN
    RAISE EXCEPTION 'REFUSED: % of the 44 rows are in run bffc7713 on this business, not 44. The catalogue has been reloaded or these ids have moved — re-identify before running this. Nothing changed.', v_found;
  END IF;

  SELECT count(*) FILTER (WHERE qty = 10),
         count(*) FILTER (WHERE qty = 0)
    INTO v_at10, v_at0
    FROM public.business_inventory
   WHERE business_id = v_biz AND import_run_id = v_run AND qb_item_id = ANY(v_ids);

  IF v_at0 = 44 THEN
    RAISE EXCEPTION 'ALREADY APPLIED: all 44 rows are already at 0. Nothing changed.';
  END IF;

  IF v_at10 <> 44 THEN
    RAISE EXCEPTION 'REFUSED: % of the 44 rows hold the seeded 10; the rest hold some other number, which means a person or a sale has touched them. A real count must never be overwritten. Nothing changed.', v_at10;
  END IF;

  -- A row with ledger history has had something real happen to it, so its number is not a
  -- placeholder and is not ours to erase (the seed's own exclusion rule, applied in reverse).
  SELECT count(DISTINCT i.id) INTO v_hist
    FROM public.business_inventory i
    JOIN public.business_inventory_ledger l ON l.inventory_id = i.id
   WHERE i.business_id = v_biz AND i.import_run_id = v_run AND i.qb_item_id = ANY(v_ids);

  IF v_hist <> 0 THEN
    RAISE EXCEPTION 'REFUSED: % of the 44 rows carry ledger history, so their quantity is a measured number and not the seed. Nothing changed.', v_hist;
  END IF;

  UPDATE public.business_inventory
     SET qty = 0
   WHERE business_id = v_biz AND import_run_id = v_run AND qb_item_id = ANY(v_ids)
     AND qty = 10 AND retired_at IS NULL;

  GET DIAGNOSTICS v_done = ROW_COUNT;

  IF v_done <> 44 THEN
    RAISE EXCEPTION 'REFUSED: the update touched % rows, not 44. Rolled back, nothing changed.', v_done;
  END IF;

  RAISE NOTICE 'OK — % non-product rows set to 0. No ledger row was written.', v_done;
END
$guard$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the 44 are at 0, and nothing else in the run moved. EXPECT: non_products_at_zero = 44 ·
--      products_still_at_ten = 587 · run_rows = 631.
-- SELECT
--   count(*) FILTER (WHERE qb_item_id = ANY(ARRAY['1','2','3','4','5','6','7','8','10','11','12',
--     '13','14','15','16','91','102','105','116','117','121','128','129','137','164','167','172',
--     '176','186','187','195','196','197','198','199','207','210','603','1000','1001','1006',
--     '1007','1116','1120'])
--     AND qty = 0) AS non_products_at_zero,
--   count(*) FILTER (WHERE NOT (qb_item_id = ANY(ARRAY['1','2','3','4','5','6','7','8','10','11','12',
--     '13','14','15','16','91','102','105','116','117','121','128','129','137','164','167','172',
--     '176','186','187','195','196','197','198','199','207','210','603','1000','1001','1006',
--     '1007','1116','1120'])) AND qty = 10) AS products_still_at_ten,
--   count(*) AS run_rows
--   FROM public.business_inventory
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND import_run_id = 'bffc7713-d275-436c-bf8c-1ff29f3d14b9';
--
-- V2 · 🔴 THE LEDGER DID NOT MOVE. EXPECT exactly 470, the figure measured before the seed ran
--      and after it. Count on the ledger's OWN business_id — joining through business_inventory
--      drops 17 orphan rows whose product has since been deleted, and reads 453.
-- SELECT count(*) AS ledger_rows
--   FROM public.business_inventory_ledger
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V3 · HYIS is the one unclassified row David KEPT. EXPECT one row, qty 10.
-- SELECT name, qty FROM public.business_inventory
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND import_run_id = 'bffc7713-d275-436c-bf8c-1ff29f3d14b9'
--    AND qb_item_id = '1118';
--
-- V4 · a counter spot-check in words: these should read 0.
-- SELECT name, qty, sell_price FROM public.business_inventory
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND import_run_id = 'bffc7713-d275-436c-bf8c-1ff29f3d14b9'
--    AND qb_item_id IN ('176', '195', '210')   -- Trip Charge · Tailgate Delivery · Labor Hours
--  ORDER BY name;
