-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260920b — WHAT QUICKBOOKS CALLS THE ITEM, KEPT INSTEAD OF THROWN AWAY · ledger #357
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WRITTEN, NOT APPLIED. David applies it in the SQL EDITOR — never the table editor (§6 r17).
--
-- ── WHY (David, 2026-09-20) ─────────────────────────────────────────────────────────────────
-- MEASURED on the 2026-09-16 capture of LAWNS's 1,157 items:
--   · `Sku` is set on **1 item**. Intuit's SKU field is, in practice, empty.
--   · `Name` is set on all 1,157 and is what LAWNS actually uses as its code — `DLO30`,
--     `FCMB30`, `PATB5` — with the readable text in `Description`.
--   · `FullyQualifiedName` is `Parent:Name` (`Oak:DLO30`), unique across all 1,157, and it is
--     what Lauren's own species sheets are keyed on, because it carries the category.
--   · Where both `Sku` and `Name` exist they DIFFER (item 1048: `CBBM1Y` vs `BBM1Y`).
--
-- The import reads all of this and keeps none of it: `name` comes from `Description`, `sku` from
-- the almost-always-empty `Sku`, and `Type` decides one thing only (skip `Category`). So the
-- code Lauren works in is dropped on the floor, and nothing can join our rows to her sheets.
--
-- ── THE FOUR COLUMNS, AND ONE RULE ABOUT THEM ───────────────────────────────────────────────
--   qb_item_name        Intuit's `Name`   — the code LAWNS types: `DLO30`.
--   qb_item_fqn         `FullyQualifiedName` — `Oak:DLO30`. Unique; carries the category.
--   qb_item_type        `Type` — Service · NonInventory · Inventory. Kept because it is one half
--                       of the rule that decides what a row IS; `Category` never reaches us.
--   qb_income_account   `IncomeAccountRef.name` — "Sales of Nursery Stock", "Landscaping/
--                       Installation Services". The OTHER half, and the LEADING one.
--
-- 🔴 THE DISPLAY IDENTIFIER IS COMPUTED ON READ — `sku ?? qb_item_name` — AND IS NEVER STORED
-- MERGED (David's ruling, 2026-09-20). A stored merge changes meaning under you: the day Lauren
-- types a SKU onto an item, the next import would silently swap that row's identifier from its
-- Name to the new SKU, and anything keyed on it breaks for that row. Both values are kept raw,
-- and `itemIdentifier()` (packages/shared/src/quickbooks/itemIdentifier.ts) does the falling
-- back in one place.
--
-- ⚠️ WHY TYPE ALONE IS NOT A CLASSIFIER, RECORDED HERE SO NOBODY REACHES FOR IT: at LAWNS,
-- **91 of the 134 `Service`-typed rows are real plants** (Little Gem Magnolia, Shumard Red Oak).
-- The rule that works reads the INCOME ACCOUNT first and the type second — which is exactly what
-- `classifyDestination` already does for the Services review. Tech-debt #352 is the seed learning
-- to use it, and it is unblocked by this file.
--
-- ── FILLING THE EXISTING 631 ROWS ───────────────────────────────────────────────────────────
-- BY THE RELOAD, not by a backfill (David's call). The product import inserts, so the honest fill
-- is: apply this → merge → undo run bffc7713 → import once. Until that import runs every row
-- reads NULL, which is the truthful state: we have not read those fields into the row yet.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE public.business_inventory
  ADD COLUMN IF NOT EXISTS qb_item_name      text,
  ADD COLUMN IF NOT EXISTS qb_item_fqn       text,
  ADD COLUMN IF NOT EXISTS qb_item_type      text,
  ADD COLUMN IF NOT EXISTS qb_income_account text;

COMMENT ON COLUMN public.business_inventory.qb_item_name IS
  'Intuit''s Item.Name — the short code the owner types (DLO30). NOT a SKU: where both exist they differ. The display identifier is sku ?? qb_item_name, computed on read, never stored merged (ledger #357).';
COMMENT ON COLUMN public.business_inventory.qb_item_fqn IS
  'Intuit''s Item.FullyQualifiedName (Oak:DLO30). Unique per company and carries the category; this is what the owner''s own species sheets join on.';
COMMENT ON COLUMN public.business_inventory.qb_item_type IS
  'Intuit''s Item.Type — Service / NonInventory / Inventory. One half of what a row IS, and the WEAKER half: at LAWNS 91 of 134 Service-typed rows are real plants. Read the income account first.';
COMMENT ON COLUMN public.business_inventory.qb_income_account IS
  'Intuit''s IncomeAccountRef.name. The LEADING half of the rule that decides whether a row is stock, work or bookkeeping — the same axis classifyDestination uses for the Services review.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the four columns exist and are text. EXPECT four rows.
-- SELECT column_name, data_type, is_nullable
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'business_inventory'
--    AND column_name IN ('qb_item_name', 'qb_item_fqn', 'qb_item_type', 'qb_income_account')
--  ORDER BY column_name;
--
-- V2 · every existing row reads NULL, which is honest until the reload fills them. EXPECT the
--      row count of the business and filled = 0 on all four.
-- SELECT count(*) AS rows,
--        count(qb_item_name) AS name_filled, count(qb_item_fqn) AS fqn_filled,
--        count(qb_item_type) AS type_filled, count(qb_income_account) AS account_filled
--   FROM public.business_inventory
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- V3 · AFTER the reload (undo bffc7713, then ONE import press): the four are filled on every
--      imported row, and Sku is still its own column — not merged into the name.
--      EXPECT imported = name_filled = fqn_filled = type_filled, and sku_filled = 1.
-- SELECT count(*) AS imported,
--        count(qb_item_name) AS name_filled, count(qb_item_fqn) AS fqn_filled,
--        count(qb_item_type) AS type_filled, count(qb_income_account) AS account_filled,
--        count(sku) AS sku_filled
--   FROM public.business_inventory
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND import_run_id IS NOT NULL;
--
-- V4 · the one item that has BOTH keeps both, unmerged. EXPECT sku = CBBM1Y, qb_item_name =
--      BBM1Y — two different values in two different columns.
-- SELECT name, sku, qb_item_name, qb_item_fqn, qb_item_type, qb_income_account
--   FROM public.business_inventory
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND qb_item_id = '1048';
