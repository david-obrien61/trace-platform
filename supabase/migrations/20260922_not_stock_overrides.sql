-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260922 — "THIS IS NOT STOCK", SAID BY THE OWNER, NOT BY US · ledger #364 · tech-debt #352
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ✅ APPLIED 2026-09-21 by David in the SQL EDITOR (§6 r17). Re-read live the same day: the table
--    exists. ⚠️ Its four seeded rows were then REMOVED by `20260922b` — see that file for why.
--
-- ── WHY (David, 2026-09-21) ─────────────────────────────────────────────────────────────────
-- The seed decides what gets a starting number by reading the owner's books: income account
-- first, type second. That is right for 627 of LAWNS's 631 imported rows and wrong for four,
-- because those four are MISBOOKED in QuickBooks — a Gift Certificate filed under *Sales of
-- Nursery Stock* reads as a tree to any rule that believes the books.
--
-- David: *"Use a per-business 'not stock' override list holding exactly these four, each with
-- its reason recorded — a setting, not names in code."* So this is a TABLE the owner owns, not
-- a constant in a file: the same four names hardcoded in TypeScript would be invisible to her,
-- unchangeable without a deploy, and a fresh lie on the next tenant (AC-1 — a tenant literal in
-- platform code is exactly what the hardcoded register exists to stop).
--
-- ⚠️ THE OVERRIDE IS A STOPGAP AND THE ROWS SAY SO. Each carries `fix_at_source`, TRUE when the
-- real repair is a retype in QuickBooks. All four are on Lauren's retype list. When she fixes
-- one, its override becomes stale — and a stale override is a row held back for a reason that is
-- no longer true, which is [[R-26]]'s shape, so `active` exists to retire it without deleting
-- the record of why it was ever needed.
-- ════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.business_not_stock_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  -- Intuit's item id, which survives a reload while our row id does not. This is the same key
  -- the 2026-09-20 repair matched on, for the same reason.
  qb_item_id    text NOT NULL,
  -- What the owner calls it, stored so the setting is readable without joining anything. It is a
  -- LABEL, never the key: a rename in QuickBooks must not silently free the row.
  item_name     text NOT NULL,
  -- 🔴 REQUIRED. An override with no reason is a rule nobody can audit, and this file exists
  -- because four rows were being given stock for a reason nobody had written down.
  reason        text NOT NULL,
  /** TRUE when the durable repair is a retype in QuickBooks rather than a permanent exception. */
  fix_at_source boolean NOT NULL DEFAULT true,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- One override per item per business; re-pasting this file must not mint a second.
CREATE UNIQUE INDEX IF NOT EXISTS business_not_stock_items_uidx
  ON public.business_not_stock_items (business_id, qb_item_id);

ALTER TABLE public.business_not_stock_items ENABLE ROW LEVEL SECURITY;

-- RE-PASTE SAFE: every CREATE POLICY is preceded by its DROP.
DROP POLICY IF EXISTS business_not_stock_items_member_select ON public.business_not_stock_items;
CREATE POLICY business_not_stock_items_member_select ON public.business_not_stock_items
  FOR SELECT TO authenticated
  USING (is_active_member(business_id) AND has_permission(business_id, 'inventory:read'));

-- Writing one is a settings change, and it is gated as one.
DROP POLICY IF EXISTS business_not_stock_items_member_write ON public.business_not_stock_items;
CREATE POLICY business_not_stock_items_member_write ON public.business_not_stock_items
  FOR ALL TO authenticated
  USING (is_active_member(business_id) AND has_permission(business_id, 'settings:update'))
  WITH CHECK (is_active_member(business_id) AND has_permission(business_id, 'settings:update'));

-- ── THE FOUR, FOR LAWNS, EACH WITH THE REASON DAVID GAVE (2026-09-21) ───────────────────────
-- Idempotent: re-pasting updates the reason rather than raising or duplicating.
INSERT INTO public.business_not_stock_items (business_id, qb_item_id, item_name, reason, fix_at_source)
VALUES
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', '1006', 'Deposit',
   'Money taken against a future order. Booked to Sales of Nursery Stock in QuickBooks, so the books read it as a tree. Retype at source.', true),
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', '1007', 'Gift Certificate',
   'A promise to pay, not a thing on a shelf. Booked to Sales of Nursery Stock. Retype at source.', true),
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', '603', 'Custom Amount',
   'Created by QuickBooks Payments and never sold as a line. Booked to QuickBooks Payments Sales. Make inactive in QuickBooks if unused — do not retype it to Service, which would put it on the services review.', false),
  ('ed2e5933-45dc-4b9b-a331-ddfd125e7a74', '1120', 'Arizona Cypress Blue Ice Replacement',
   'A $0 warranty-replacement line, not stock — the tree it replaces comes off the shelf under its own row. Booked to Sales of Nursery Stock. Retype at source.', true)
ON CONFLICT (business_id, qb_item_id)
DO UPDATE SET item_name = EXCLUDED.item_name, reason = EXCLUDED.reason,
              fix_at_source = EXCLUDED.fix_at_source, active = true;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run after applying. Read-only.
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- V1 · the four are there, each with a reason. EXPECT 4 rows, no empty reason.
-- SELECT qb_item_id, item_name, fix_at_source, active, left(reason, 60) AS reason
--   FROM public.business_not_stock_items
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--  ORDER BY item_name;
--
-- V2 · RLS is on and both policies exist. EXPECT rls = true and two rows.
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'business_not_stock_items';
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'business_not_stock_items' ORDER BY policyname;
--
-- V3 · the override cannot be minted twice for one item. EXPECT one row, unchanged count.
-- SELECT count(*) FROM public.business_not_stock_items
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND qb_item_id = '1006';
--
-- V4 · AFTER the reload and the seed: all four read 0 while the catalogue around them reads 10.
-- SELECT i.qb_item_id, i.name, i.qty
--   FROM public.business_inventory i
--   JOIN public.business_not_stock_items o
--     ON o.business_id = i.business_id AND o.qb_item_id = i.qb_item_id AND o.active
--  WHERE i.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--  ORDER BY i.name;
