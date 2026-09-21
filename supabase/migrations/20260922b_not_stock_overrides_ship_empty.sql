-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260922b — THE NOT-STOCK LIST SHIPS EMPTY · ledger #365
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ✅ APPLIED 2026-09-21 by David in the SQL EDITOR (§6 r17). Re-read live the same day:
--    `business_not_stock_items` exists and holds 0 rows — the list ships empty, as ruled.
--
-- ⚠️ IF YOU ALREADY HAVE A FILE NAMED `20260922b_fix_not_stock_override_ids.sql`, DELETE IT
--    UNAPPLIED. It corrected the two wrong ids and put four tenant rows back — the right data
--    for the wrong shape. This file supersedes it. (It was never applied.)
--
-- ── WHY (David, 2026-09-21) ─────────────────────────────────────────────────────────────────
-- `20260922` created `business_not_stock_items` AND seeded four LAWNS rows into it. The table is
-- legitimate — a per-business setting the owner controls. **The four rows are not.** David:
-- *"the override list as built is a TENANT-SPECIFIC TARGET, not the load-wipe-load concept —
-- four ids we chose for LAWNS, written into a migration, and two of them were wrong on first
-- run."*
--
-- Both halves of that are worth keeping in the record:
--   · **The shape was wrong.** A migration that inserts one customer's rows is platform code
--     carrying tenant data, which is what AC-1 exists to stop. A setting is something the owner
--     fills in, not something we pre-fill for her and call a setting.
--   · **The evidence was the first run.** Two of the four ids were mistyped — `1006` is Backyard
--     Delivery, not Deposit; `1007` is "Tree installation without warranty", not Gift Certificate
--     — because they were typed by hand from a list of NAMES. David's V1 and V4 disagreed and he
--     stopped. A list nobody could check against the catalogue is exactly the kind of thing that
--     should not have been in a migration in the first place.
--
-- ── WHAT THIS MEANS FOR THE FOUR ITEMS ──────────────────────────────────────────────────────
-- Deposit, Gift Certificate, Custom Amount and Arizona Cypress Blue Ice Replacement now take
-- whatever the seed's rule gives them. **In today's test data that is 10 each**, because three
-- are booked to *Sales of Nursery Stock* and the fourth is typed `NonInventory` — their books
-- call them stock. David ruled that acceptable: **the fix is Lauren's QuickBooks retype list,
-- where all four already are.** A number in test data is cheap; a tenant list in platform code
-- is not.
--
-- ⚠️ THE SEED STILL REFUSES IF IT CANNOT *READ* THIS TABLE. An unreadable setting is not an
-- empty one — treating them alike is how a refusal turns into a silent default. An EMPTY table
-- is a fine answer and the screen proceeds on it.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- Every row `20260922` inserted, gone. Scoped to exactly those four ids rather than a bare
-- DELETE, so that a row an owner adds through a screen between the two migrations survives.
DELETE FROM public.business_not_stock_items
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND qb_item_id IN ('603', '1006', '1007', '1120');

DO $assert$
DECLARE v_left int;
BEGIN
  SELECT count(*) INTO v_left FROM public.business_not_stock_items;
  IF v_left <> 0 THEN
    -- Not a failure: a row added by an owner is exactly what this table is for. It is said out
    -- loud so nobody reads a non-empty table as this migration having failed.
    RAISE NOTICE 'NOTE: % row(s) remain, none of them seeded by a migration — an owner added them.', v_left;
  ELSE
    RAISE NOTICE 'OK — the not-stock list is empty, and no migration seeds it.';
  END IF;
END
$assert$;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · 🔴 THE TABLE IS EMPTY. EXPECT 0.
-- SELECT count(*) AS rows_in_the_not_stock_list FROM public.business_not_stock_items;
--
-- V2 · and specifically none of the four remain. EXPECT 0 rows.
-- SELECT qb_item_id, item_name FROM public.business_not_stock_items
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V3 · the table, its unique index and BOTH policies survive — the setting is kept, only its
--      contents are gone. EXPECT the table, 1 unique index, 2 policies, rls = true.
-- SELECT relrowsecurity AS rls FROM pg_class WHERE relname = 'business_not_stock_items';
-- SELECT indexname FROM pg_indexes WHERE tablename = 'business_not_stock_items' ORDER BY 1;
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'business_not_stock_items' ORDER BY policyname;
--
-- V4 · AFTER the reload and the seed, the four take what the rule gives them. EXPECT all four
--      at 10 on today's data — Deposit and Gift Certificate and the replacement line because
--      their books file them under Sales of Nursery Stock, Custom Amount because QuickBooks
--      types it NonInventory. This is the ruled outcome, not a defect.
-- SELECT qb_item_id, name, qty, qb_income_account, qb_item_type
--   FROM public.business_inventory
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND qb_item_id IN ('10', '91', '603', '1120')
--  ORDER BY name;
