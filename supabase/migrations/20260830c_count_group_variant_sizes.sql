-- ════════════════════════════════════════════════════════════════════════════════
-- 20260830c — COUNT GROUPING, RESOLVED SERVER-SIDE: a staff member can finish a walk
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, IN THE SQL EDITOR — never the dashboard TABLE EDITOR (CLAUDE.md §6 r17).
-- Nothing here creates a table, so that rule is belt-and-braces; it is stated where the actor
-- stands, not where it is convenient.
--
-- ADDITIVE ONLY. ONE new function. NO table, NO column, NO constraint, NO trigger, and
-- 🔴 **NO POLICY IS WIDENED — that is the whole point of this migration.**
--
-- ── WHY ──────────────────────────────────────────────────────────────────────────
-- `InventoryCount.tsx` finishes a scan by writing `variant_group` onto the row it just counted
-- (and, on the create path, onto the family's other rows). It did that with a PLAIN UPDATE on
-- `business_inventory`, which `20260727_rbac_resource_action_flip.sql:72-74` gates on
-- `inventory:update`. A STAFF member holds `inventory:read` and NOT `inventory:update`.
--
-- 🔴 AND THE FAILURE IS SILENT, WHICH IS WHY IT HAS NEVER BEEN REPORTED. A PostgREST UPDATE that
-- RLS refuses matches ZERO ROWS and returns NO ERROR (ruling R-12 / E5 — "a write must prove it
-- wrote"). `syncEngine.ts:258-259` decides success from `error` alone, so the refusal returns
-- `'applied'`. The walk does not die and nobody is told anything: the count lands, the grouping
-- does not, and the cost arrives LATER — the comment at the call site says exactly what it is:
-- *"Without it the next scan sees a mixed-group family and goes UNKNOWN."* A staff member's walk
-- degrades the catalogue one variety at a time, invisibly, on the D-45/D-46 multi-size path,
-- which at LAWNS is the common case rather than the edge.
--
-- ── WHY AN RPC AND NOT A WIDER POLICY ────────────────────────────────────────────
-- Granting STAFF write access to `business_inventory` to fix a count screen would widen the first
-- name on tech-debt #124's over-wide-policy list, and would hand a yard hand `price`, `qty`,
-- `status` and `sell_price` in order to let them group two pot sizes. The narrow act is resolved
-- server-side instead, exactly as the two RPCs already on this screen resolve theirs:
-- `count_reconcile_inventory` (§7b) moves QUANTITY and `count_promote_create_inventory` (§7c)
-- CREATES A ROW, both under `assert_movement_actor` and nothing more. **This function is strictly
-- narrower than both of its neighbours** — it is the weakest of the three, not a new class of
-- authority.
--
-- ── 🔴 THE BOUNDARY, AND IT IS THE COLUMN LIST ───────────────────────────────────
-- **THIS FUNCTION SETS `variant_group`. IT SETS NOTHING ELSE, EVER.** Not price, not sell_price,
-- not qty, not status, not name, not size, not sku, not cost. The UPDATE below names ONE column
-- and that column list IS the security boundary (the 2026-08-21 ruling on the profile writer,
-- applied here before anyone needs it). A SECURITY DEFINER function bypasses RLS by construction,
-- so the ONLY thing standing between "a narrow grouping call" and "a side door onto the inventory
-- table" is the discipline of that list. **A future pass that needs to set a second column does
-- not add it here — it justifies its own function, on its own reasoning.**
--
-- ── WHAT IT DOES NOT CHANGE ──────────────────────────────────────────────────────
-- · No blank-only filter. The client's two UPDATEs overwrote `variant_group` unconditionally, and
--   so does this — so OWNER and MANAGER behaviour is unchanged on every valid call.
-- · The `business_inventory_unit_projection` trigger (20260830 §4) is BEFORE UPDATE and compares
--   `NEW.unit_parsed_from` with `NEW.size`. This write touches neither, so both arrive unchanged
--   from OLD, they remain equal, and the unit projection is NOT nulled. Same as today's plain
--   UPDATE — stated so the next reader does not have to re-derive it (R-27).
-- · `business_inventory_updated_at` fires exactly as it does for the plain UPDATE.
--
-- ── WHAT IT DOES CHANGE, DELIBERATELY ────────────────────────────────────────────
-- It REPORTS WHAT IT WROTE. `grouped_count` / `requested_count` / `applied` / `reason` follow the
-- convention `count_reconcile_inventory` already established and `syncEngine.ts:250-253` already
-- reads: a domain-level refusal comes back as `applied = false` with a reason and is surfaced,
-- never dropped. Today a grouping write that lands on nothing is indistinguishable from one that
-- worked. After this it cannot be. That is R-12 satisfied on the path that most needed it.
-- ════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.count_group_variant_sizes(
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_variant_group text,
  p_row_ids       uuid[]
) RETURNS TABLE (grouped_count int, requested_count int, applied boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_requested int;
  v_grouped   int;
BEGIN
  -- Same membership gate as §7b/§7c, and the same no-forgery rule: a client-direct caller may
  -- only act as themselves. Nothing here is looser than the two calls that already run beside it.
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF p_variant_group IS NULL OR btrim(p_variant_group) = '' THEN
    RAISE EXCEPTION 'a grouping key is required (D-9 — never write a blank identity over a real one)'
      USING ERRCODE = 'check_violation';
  END IF;

  IF p_row_ids IS NULL OR array_length(p_row_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'no rows named to group (a caller asking for nothing is a bug, not a no-op)'
      USING ERRCODE = 'check_violation';
  END IF;

  -- DISTINCT so a caller that names a row twice does not inflate the expected count and turn a
  -- successful grouping into a reported shortfall.
  SELECT count(DISTINCT id) INTO v_requested FROM unnest(p_row_ids) AS id;

  -- 🔴 ONE COLUMN. See THE BOUNDARY above. `business_id` is in the predicate, not the SET list —
  -- it scopes the write to the caller's own tenant (AC-3) and can never be moved by it.
  UPDATE public.business_inventory
     SET variant_group = p_variant_group
   WHERE id = ANY(p_row_ids)
     AND business_id = p_business_id;

  GET DIAGNOSTICS v_grouped = ROW_COUNT;

  -- The call site calls this "THE INVARIANT, in two writes that must both land." So a partial
  -- grouping is a REFUSAL, not a warning: a family half-keyed is the mixed-group state that makes
  -- the next scan resolve UNKNOWN, and it is better to stop the walk than to leave it there
  -- believing it succeeded. Replay-safe — re-running sets the same key on the same rows.
  IF v_grouped < v_requested THEN
    RETURN QUERY SELECT
      v_grouped, v_requested, false,
      format('grouped %s of %s rows — the rest are missing or belong to another business',
             v_grouped, v_requested)::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT v_grouped, v_requested, true, 'applied'::text;
END $$;

COMMENT ON FUNCTION public.count_group_variant_sizes(uuid, uuid, text, uuid[]) IS
  'Sets business_inventory.variant_group on the named rows of one business, and NOTHING ELSE — not price, qty, status, name, size or sku. Exists so the walk-and-count screen can group a variety''s sizes without the caller holding inventory:update, which STAFF does not. Membership-gated by assert_movement_actor. Reports rows actually written (R-12).';

REVOKE ALL ON FUNCTION public.count_group_variant_sizes(uuid, uuid, text, uuid[]) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.count_group_variant_sizes(uuid, uuid, text, uuid[]) TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFY — David runs these AFTER apply. Catalog-backed, never from memory (CLAUDE.md §9).
-- ════════════════════════════════════════════════════════════════════════════════
--
-- (A) the function exists, is SECURITY DEFINER, and has an empty search_path:
--   SELECT p.proname, p.prosecdef, p.proconfig
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public' AND p.proname = 'count_group_variant_sizes';
--   → 1 row. prosecdef = true. proconfig = {"search_path="}.
--
-- (B) EXECUTE is granted to authenticated + service_role and to NOBODY else:
--   SELECT grantee, privilege_type
--   FROM information_schema.role_routine_grants
--   WHERE routine_name = 'count_group_variant_sizes' ORDER BY grantee;
--   → authenticated + service_role (and the owner). NOT public, NOT anon.
--
-- (C) 🔴 NO POLICY MOVED. business_inventory still refuses a STAFF write directly — the whole
--     claim of this migration is that the narrow act moved, not the wall:
--   SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
--   FROM pg_policy WHERE polrelid = 'business_inventory'::regclass ORDER BY polname;
--   → business_inventory_member_update still reads has_permission(business_id,'inventory:update').
--     Four member policies + the owner policy, exactly as before this migration.
--
-- (D) the boundary holds — the function body sets ONE column:
--   SELECT prosrc FROM pg_proc WHERE proname = 'count_group_variant_sizes';
--   → exactly one `SET variant_group = p_variant_group`, and no other SET on business_inventory.
--
-- (E) a shortfall reports rather than lying (run as postgres; harmless, writes a key it re-reads):
--   SELECT * FROM public.count_group_variant_sizes(
--     '<business_id>'::uuid, NULL, 'probe-key',
--     ARRAY['00000000-0000-0000-0000-000000000000'::uuid]);
--   → grouped_count 0, requested_count 1, applied FALSE, reason naming 0 of 1.
--     (A NULL actor is the service-key path assert_movement_actor allows; from the app the actor
--      is always the signed-in user and a mismatch raises.)
