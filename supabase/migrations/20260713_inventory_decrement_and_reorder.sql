-- ============================================================
-- 20260713_inventory_decrement_and_reorder.sql
-- D-42 — INVENTORY DECREMENT-ON-PAID (the Amazon model) + reorder stub
--
-- WHAT: (1) the ONE server-authoritative atomic inventory-adjust RPC that the order
--           path calls to decrement qty at order-paid (and restore on edit-down /
--           delete / cancel); (2) a nullable reorder_point stub column.
--
-- WHY:  Before this, the order path only flipped a whole lot's status to 'reserved'
--       on ANY sale (submit.ts §11) — under D-34 (the LOT is the SKU, qty is the
--       COUNT) that marked all 45 of a 45-lot reserved when 1 sold, and the lot then
--       vanished from the status-filtered dashboard count (looked like depletion).
--       A real per-unit qty decrement is the FOUNDATION reconciliation sits on
--       (counted vs expected = last count − sold). Model (David): decrement at
--       ORDER-PAID/CONFIRMED (checkout complete + invoice generated), NOT at delivery
--       — delivery is a later event that does not touch qty. Mirrors Amazon: pay →
--       inventory committed → ships → arrives.
--
-- STANDARDS: STD-011 (qty = the ONE canonical on-hand fact; status DERIVES from it,
--            never diverges) · STD-012 (server-authoritative, one computation) ·
--            AC-3 (business_id-scoped — the RPC filters on business_id).
--
-- ADDITIVE + APPEND-ONLY: one nullable column (no default, no CHECK) + one new
-- function. No existing column/constraint/policy altered. Lossless.
--
-- ⚠️ GATED — David applies as postgres (function ownership = the SECURITY DEFINER
-- posture, same as is_active_member). Deploy order: deploy the code FIRST (it
-- degrades gracefully when the RPC is absent — decrement deferred, checkout still
-- completes), THEN apply this migration. An old bundle never calls a function that
-- doesn't exist yet; the new bundle tolerates its absence until applied.
--
-- NOTE: this is a Postgres FUNCTION, NOT a Vercel serverless function — it does NOT
-- count against the 12/12 api/ ceiling (CLAUDE.md §6 rule 11).
-- ============================================================

-- ── 1. reorder_point stub ──────────────────────────────────────────────────────
-- The SLOT for the future low-stock / reorder-threshold build (no threshold logic
-- this pass). Homed here so the decrement build and the reorder build share the
-- schema. Nullable (unset = "no threshold set", honestly absent — D-9), no default,
-- no CHECK (AC-1/AC-4 — a value set / policy grows without a migration).
ALTER TABLE public.business_inventory
  ADD COLUMN IF NOT EXISTS reorder_point int;

-- ── 2. adjust_inventory_qty — the ONE atomic adjust path (STD-011/STD-012) ──────
-- A SINGLE guarded UPDATE (row-level lock is implicit) — concurrency-safe: two
-- concurrent orders on the same lot serialize on the row, so no unit is ever lost
-- (no JS read-modify-write). delta < 0 decrements (a sale/commit); delta > 0 restores
-- (edit-down / delete / cancel). The `qty + p_delta >= 0` predicate is the OVERSELL
-- GUARD — a decrement can NEVER drive qty negative (the row simply isn't updated, and
-- we report 'oversell_refused' rather than silently going negative — Surface Honesty).
-- Status DERIVES from the new qty (qty>0 → 'available', qty<=0 → 'depleted' — the
-- existing datasheet vocabulary), and a manual 'damaged'/'returned' classification is
-- PRESERVED (only sale-relevant statuses auto-toggle).
CREATE OR REPLACE FUNCTION public.adjust_inventory_qty(
  p_lot_id      uuid,
  p_business_id uuid,
  p_delta       int
) RETURNS TABLE (new_qty int, new_status text, applied boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_qty    int;
  v_status text;
BEGIN
  UPDATE public.business_inventory bi
     SET qty = bi.qty + p_delta,
         status = CASE
                    WHEN bi.status IN ('available', 'depleted', 'reserved')
                      THEN CASE WHEN bi.qty + p_delta <= 0 THEN 'depleted' ELSE 'available' END
                    ELSE bi.status  -- preserve a manual damaged/returned classification
                  END,
         updated_at = now()
   WHERE bi.id = p_lot_id
     AND bi.business_id = p_business_id
     AND bi.qty + p_delta >= 0     -- OVERSELL GUARD: never drive qty negative
   RETURNING bi.qty, bi.status INTO v_qty, v_status;

  IF FOUND THEN
    RETURN QUERY SELECT v_qty, v_status, true, 'applied'::text;
    RETURN;
  END IF;

  -- 0 rows updated → distinguish an oversell refusal from a missing lot (honest signal).
  IF EXISTS (SELECT 1 FROM public.business_inventory
              WHERE id = p_lot_id AND business_id = p_business_id) THEN
    SELECT bi.qty, bi.status INTO v_qty, v_status
      FROM public.business_inventory bi
     WHERE bi.id = p_lot_id AND bi.business_id = p_business_id;
    RETURN QUERY SELECT v_qty, v_status, false, 'oversell_refused'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::int, NULL::text, false, 'lot_not_found'::text;
END $$;

-- SECURITY: the RPC TRUSTS its p_business_id argument (no membership check inside),
-- so it must be callable ONLY by trusted server code that resolves business_id from
-- validated context. It is called via the SERVICE KEY (service_role) in submit.ts.
-- Granting to `authenticated` would let any logged-in user pass an arbitrary
-- business_id and mutate another tenant's stock — so EXECUTE is service_role ONLY.
REVOKE ALL ON FUNCTION public.adjust_inventory_qty(uuid, uuid, int) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.adjust_inventory_qty(uuid, uuid, int) TO service_role;

-- ============================================================
-- VERIFICATION (run in Supabase SQL editor after applying — STD-008):
--
-- (A) column exists, nullable, int, no default:
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_name = 'business_inventory' AND column_name = 'reorder_point';
--   -- expect: reorder_point | integer | YES | (null)
--
-- (B) function exists, SECURITY DEFINER, search_path locked:
--   SELECT p.proname, p.prosecdef, p.proconfig
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'adjust_inventory_qty';
--   -- expect: adjust_inventory_qty | t | {search_path=}
--
-- (C) EXECUTE grant is service_role only (NOT authenticated/anon/public):
--   SELECT grantee, privilege_type
--     FROM information_schema.role_routine_grants
--    WHERE routine_name = 'adjust_inventory_qty';
--   -- expect: exactly service_role (+ the owner) — never authenticated/anon/public
--
-- (D) atomic decrement round-trip (against a real lot — read qty first):
--   SELECT id, qty, status FROM business_inventory WHERE id = '<lot>' AND business_id = '<biz>';
--   SELECT * FROM adjust_inventory_qty('<lot>', '<biz>', -3);   -- decrement 3
--     -- expect: new_qty = qty-3, new_status = 'available' (or 'depleted' if it hit 0), applied = t
--   SELECT * FROM adjust_inventory_qty('<lot>', '<biz>', 3);    -- restore
--     -- expect: new_qty back to original, applied = t
--
-- (E) OVERSELL GUARD — cannot go negative:
--   SELECT * FROM adjust_inventory_qty('<lot>', '<biz>', -999999);
--     -- expect: applied = f, reason = 'oversell_refused', new_qty = the UNCHANGED current qty
-- ============================================================
