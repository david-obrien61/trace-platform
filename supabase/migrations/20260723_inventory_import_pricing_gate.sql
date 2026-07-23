-- ════════════════════════════════════════════════════════════════════════════════
-- import_pricing — THE SERVER-SIDE GATE FOR BULK PRICE IMPORT (David's ruling 2026-07-23)
-- ════════════════════════════════════════════════════════════════════════════════
-- PURPOSE:      Bulk price import (/inventory/import price columns) is gated by a permission that
--               DEFAULTS TO OWNER ONLY and that the owner may GRANT TO A MANAGER, per tenant.
--
--               ⚠️ SCOPE — READ THIS BEFORE BELIEVING A WALL WAS BUILT. This is a BLAST-RADIUS
--               control, NOT a price wall. `business_inventory` is ALREADY `view_costs`-gated
--               (business_inventory_member_all: is_active_member AND has_permission('view_costs')
--               on USING + WITH CHECK — 20260622_oauth_secrets_relocation_and_cost_wall.sql), so
--               a manager holding view_costs can ALREADY edit `sell_price` one CELL at a time
--               through the grid. This permission separates BULK price writes (a whole file at
--               once) from single-cell ones. It creates NO price authority that did not exist.
--
-- WHY WIRED, NOT JUST DECLARED: the sibling `apply_discount` is DECLARED but is NOT the gate — it
--               rides `manage_orders` (its own comment says so). A declared-but-unwired permission
--               is a fake surface (D-9): it looks like a control and controls nothing. This one is
--               enforced server-side by import_write_price below, or it is not shipped.
--
-- WHY A NEW RPC, NOT AN RLS CHANGE: the existing business_inventory member policy is proven,
--               load-bearing, and gates six tables' worth of behavior. It is NOT touched. The price
--               write is routed through an ADDITIVE SECURITY DEFINER function that checks the
--               import_pricing grant on the PASSED actor. Additive only.
--
-- DEPENDENCIES: · public.assert_movement_actor / public.is_member_of  (20260720_inventory_movement_ledger.sql)
--               · public.has_permission                               (20260622_oauth_secrets_relocation_and_cost_wall.sql)
--               · business_inventory.sell_price numeric(10,2)          (20260707_business_inventory_sell_price.sql)
--               · business_inventory.price_basis text                  (20260723_inventory_import_columns.sql — APPLY THAT FIRST)
--
-- OUTPUTS:      · has_permission_for(business, user, perm)  — passed-actor, owner-inclusive
--                 permission primitive (the analog of has_permission that is_member_of is to
--                 is_active_member)
--               · import_write_price(lot, business, actor, sell_price, price_basis) — the gated
--                 price write, RETURNS (applied, reason)
--
-- SCOPE:        ADDITIVE. No column dropped, no policy altered, no existing function replaced with
--               different behavior. RPCs are postgres functions, NOT Vercel functions — 12/12 held.
--
-- ⚠️ APPLY ORDER: this migration references business_inventory.price_basis, added by
--               20260723_inventory_import_columns.sql. Apply THAT migration FIRST. (The filename
--               sorts after it — "inventory_import_columns" < "inventory_import_pricing_gate" — so
--               `supabase db push` applies them in the right order automatically.)
--
-- SOURCE:       David's ruling 2026-07-23 (recorded DECISIONS-INDEX.md). Precedent for shape:
--               apply_tax_exempt / apply_discount (actionPermissions.ts).
-- GATED:        David applies this in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════════
-- §1 — has_permission_for — THE PASSED-ACTOR PERMISSION PRIMITIVE
-- ════════════════════════════════════════════════════════════════════════════════
-- public.has_permission(business, perm) reads auth.uid() — the SESSION caller. That is correct for
-- RLS but wrong for a gate that must validate an actor passed BY ID (the D-50 scar:
-- is_active_member/has_permission read auth.uid(), which is NULL under the service key, so a
-- passed-actor check must not consult it). has_permission_for is the passed-actor analog, exactly
-- as is_member_of is the passed-actor analog of is_active_member.
--
-- ⚠️ DELIBERATE DIVERGENCE FROM has_permission (stated per §6 r10 — no silent divergence): this
-- function is OWNER-INCLUSIVE. has_permission checks ONLY the business_members row and would return
-- FALSE for an owner who has no member row (owners are identified by businesses.owner_id, and may
-- not carry a member row at all — which is exactly why is_member_of checks owner_id separately).
-- The ruling DEFAULTS import_pricing to the owner, so the owner must always pass. The owner_id
-- clause makes "defaults to owner only; owner may grant to a manager" true with ZERO dependency on
-- the owner's member-row permissions jsonb (which may pre-date a newly-added permission) — the same
-- reasoning callerIsBusinessOwner documents for its owner path.
CREATE OR REPLACE FUNCTION public.has_permission_for(p_business_id uuid, p_user_id uuid, p_perm text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL AND p_business_id IS NOT NULL AND (
    -- the owner is authorized for any permission, by owner_id, always (owner-default)
    EXISTS (SELECT 1 FROM public.businesses
             WHERE id = p_business_id AND owner_id = p_user_id)
    -- a member is authorized only if the grant is in their permissions jsonb array
    OR EXISTS (SELECT 1 FROM public.business_members
                WHERE business_id = p_business_id AND user_id = p_user_id
                  AND active = true AND permissions ? p_perm)
  );
$$;

REVOKE ALL ON FUNCTION public.has_permission_for(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_permission_for(uuid, uuid, text) TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════════════
-- §2 — import_write_price — THE GATED PRICE WRITE
-- ════════════════════════════════════════════════════════════════════════════════
-- The ONLY server-authoritative path for the CSV import's price columns. SECURITY DEFINER so the
-- import_pricing check — not RLS alone — decides whether the price lands. The import's QUANTITY and
-- ATTRIBUTE/SIZE writes do NOT come through here: they ride the D-50 ledger RPCs and
-- persistInventoryPatch, unchanged. Only sell_price / price_basis are gated.
--
-- Returns (applied, reason) rather than RAISE-ing on a missing grant: a manager without
-- import_pricing must still be able to import QUANTITIES, so a permission refusal must NOT abort
-- the row — the qty/details land and the price is held with an honest reason. assert_movement_actor
-- still RAISEs on forgery / non-membership (those are not "held", they are refused outright).
--
-- ⚠️ THE CLIENT MARKER IS A COURTESY, THIS IS THE AUTHORITY. The /inventory/import plan shows
-- "won't be saved" to a manager without the grant, to save a round trip — but this function refuses
-- the write regardless of what any client sends. A client can be stale, offline, or bypassed.
CREATE OR REPLACE FUNCTION public.import_write_price(
  p_lot_id        uuid,
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_sell_price    numeric,
  p_price_basis   text
) RETURNS TABLE(applied boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- forgery pin + membership (a client-direct caller may only act as themselves; a passed actor
  -- must be the owner or an active member). RAISEs — these are not recoverable "held" states.
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- the import_pricing gate — the whole point of this function. A soft refusal, so the import
  -- continues and the caller's quantities/details still land.
  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'import_pricing') THEN
    RETURN QUERY SELECT false, 'import_pricing permission required — ask the owner to grant bulk price import on the Team page'::text;
    RETURN;
  END IF;

  -- COALESCE — a NULL price/basis never overwrites a known one (D-9; mirrors buildPatch, which only
  -- puts a KNOWN price in the patch). AC-3 — the WHERE pins the lot to the actor's own business.
  UPDATE public.business_inventory
     SET sell_price  = COALESCE(p_sell_price, sell_price),
         price_basis = COALESCE(p_price_basis, price_basis)
   WHERE id = p_lot_id AND business_id = p_business_id;

  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'lot not found in this business'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT true, NULL::text;
END;
$$;

-- authenticated (the browser import calls it under the user's JWT) + service_role. NOT anon.
REVOKE ALL ON FUNCTION public.import_write_price(uuid, uuid, uuid, numeric, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.import_write_price(uuid, uuid, uuid, numeric, text) TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════════════
-- §3 — VERIFICATION (run after applying; catalog-backed — §9 schema gate)
-- ════════════════════════════════════════════════════════════════════════════════
-- V1 both functions exist with the expected arity:
--   SELECT proname, pronargs FROM pg_proc
--    WHERE proname IN ('has_permission_for','import_write_price') ORDER BY proname;
--   EXPECT has_permission_for/3, import_write_price/5.
--
-- V2 the owner is authorized without a member row (owner-inclusive clause):
--   SELECT public.has_permission_for('f7ec5d67-a9ef-4cb0-b807-438d67687d1b',
--                                     '95c1b2e9-3b09-43dd-a9f8-ba0744ca4382', 'import_pricing');
--   EXPECT true  (owner by owner_id, regardless of any member row).
--
-- V3 a member WITHOUT the grant is refused, WITH the grant is allowed. Pick a manager user id U:
--   SELECT public.has_permission_for('f7ec5d67-...', U, 'import_pricing');   -- EXPECT false pre-grant
--   -- grant on /team (or: UPDATE business_members SET permissions = permissions || '["import_pricing"]'
--   --   WHERE business_id='f7ec5d67-...' AND user_id=U;), then re-run          -- EXPECT true
--
-- V4 the existing business_inventory policy is UNCHANGED (this migration must not have touched it):
--   SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr
--     FROM pg_policy WHERE polname = 'business_inventory_member_all';
--   EXPECT the view_costs expression, byte-identical to 20260622 — nothing widened.
--
-- V5 the write refuses for a member without the grant even when called directly (card 17):
--   SELECT * FROM public.import_write_price('<lot>', 'f7ec5d67-...', U, 99.00, 'each');
--   EXPECT applied=false, reason names import_pricing — and the lot's sell_price is UNCHANGED.
