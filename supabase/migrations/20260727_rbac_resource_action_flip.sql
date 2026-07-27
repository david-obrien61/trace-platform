-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727 — RBAC RESOURCE:ACTION FLIP (BUILD 1)
-- ════════════════════════════════════════════════════════════════════════════════
-- PLAN:  docs/decisions/2026-07-27-rbac-transition-execution-plan.md (+ Amendments 1-5).
-- SPEC:  docs/resource-action-permission-spec.md v3 (RULED). STANDARD: STD-020.
-- APPLY AS: postgres, Supabase SQL editor, project bgobkjcopcxusjsetfob.
--
-- WHAT THIS IS: the one-pass flip of every gate from the legacy permission vocabulary to
-- resource:verb. Written against the LIVE CATALOG (STEP 0, 2026-07-27), not against migration
-- history — 15 policy sites, one function gate, confirmed by pg_policies with ZERO live-only
-- drift. Every policy below was read before it was rewritten.
--
-- ⚠️ THIS MIGRATION DOES NOT GRANT ANYONE ANYTHING. It renames what gates read. The member
-- arrays are moved by the FOUR FUNNEL CALLS in the companion runbook, which run in the SAME
-- transaction as this file (see §7). Applying this file alone leaves every member holding
-- legacy strings against gates that now check new ones — the alias layer covers the NEW-checked
-- direction, so reads still resolve, but do not stop here.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- WHERE THE NARROWING HAPPENS — READ THIS BEFORE THE AUDIT LOG MISLEADS YOU
-- ════════════════════════════════════════════════════════════════════════════════
-- STAFF holds UNRESTRICTED create/update/delete on `deliveries` today, via
-- `deliveries_member_all [ALL]` which carries NO permission string (verified live, STEP 0
-- Block C). §1.15 below splits that policy by verb. After this migration STAFF can READ and
-- UPDATE a delivery and can no longer CREATE or DELETE one.
--
-- 🔴 THAT REVOCATION IS DELIVERED BY THIS FILE — BY THE POLICY SPLIT — NOT BY THE FUNNEL CALL.
--    The funnel call tagged `rbac-migration:staff-narrow` is ADDITIVE to the member array
--    (STAFF never held a delivery STRING; they had the capability through a string-less policy).
--    An auditor reading that additive row alone would conclude nothing was taken away. It was.
--    It was taken away HERE. Recorded in the ledger row in the same words.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- DECLARED-UNWIRED IS HELD BACK (David's ruling, 2026-07-27)
-- ════════════════════════════════════════════════════════════════════════════════
-- A string whose manifest status is `declared-unwired` is filtered OUT of the Roles-page
-- catalog (§7.1), and `MemberConsole.tsx:651` seeds its draft from the RESOLVED SET — so a held
-- string with no chip survives every save and is UN-REMOVABLE through the UI. Granting one
-- MINTS a new instance of the exact defect this migration removes.
--   · `override_maintenance`     — unwired, stripped at rename.
--   · `deliveries.route:update`  — HELD. No persisted route exists; DeliveryRoute.tsx:385 is a
--     SELECT; no code and no RPC writes a route (corpus: cultivar-os/src, cultivar-os/api,
--     shared/src, api/, supabase/migrations). Granted the day route persistence ships, in one
--     funnel call. A second authority act is the honest act.
--   · `deliveries.route:read`    — NOT held: it is ENFORCED at two layers by §BUILD 2
--     (`/deliveries` PermissionRoute + `nav_delivery_route` tile). Route and tile are real
--     enforcement under STD-020; concluding otherwise from the table layer alone is the
--     `manage_orders` mistake.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- ROLES CLAUSE: the six pre-existing `FOR ALL` policies were `TO public`; the newer SELECT
-- policies were `TO authenticated`. Every policy this file writes is `TO authenticated`. The
-- predicate closed the gap either way (is_active_member is false for anon), but `public`
-- includes anon and there is no reason to keep it. Stated as a change, not slipped in.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- §1 — THE 15 POLICY SITES
-- Each `FOR ALL` policy gated on a coarse legacy string becomes verb-split policies on the
-- resource's fine strings. A verb the spec does not mint (R2 — no tombstone) gets NO member
-- policy; that command stays owner-only through the table's existing `*_owner_all`.
-- ════════════════════════════════════════════════════════════════════════════════

-- ── 1.1 business_inventory — view_costs FOR ALL → inventory:{read,create,update,delete} ──────
DROP POLICY IF EXISTS business_inventory_member_all ON public.business_inventory;
CREATE POLICY business_inventory_member_select ON public.business_inventory FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:read'));
CREATE POLICY business_inventory_member_insert ON public.business_inventory FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:create'));
CREATE POLICY business_inventory_member_update ON public.business_inventory FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:update'));
CREATE POLICY business_inventory_member_delete ON public.business_inventory FOR DELETE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'inventory:delete'));

-- ── 1.2-1.4 cost_objects / cost_object_assignments / cost_object_edges → costs:{…} ───────────
DROP POLICY IF EXISTS cost_objects_member_all ON public.cost_objects;
CREATE POLICY cost_objects_member_select ON public.cost_objects FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:read'));
CREATE POLICY cost_objects_member_insert ON public.cost_objects FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:create'));
CREATE POLICY cost_objects_member_update ON public.cost_objects FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:update'));
CREATE POLICY cost_objects_member_delete ON public.cost_objects FOR DELETE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:delete'));

DROP POLICY IF EXISTS cost_object_assignments_member_all ON public.cost_object_assignments;
CREATE POLICY cost_object_assignments_member_select ON public.cost_object_assignments FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:read'));
CREATE POLICY cost_object_assignments_member_insert ON public.cost_object_assignments FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:create'));
CREATE POLICY cost_object_assignments_member_update ON public.cost_object_assignments FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:update'));
CREATE POLICY cost_object_assignments_member_delete ON public.cost_object_assignments FOR DELETE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:delete'));

DROP POLICY IF EXISTS cost_object_edges_member_all ON public.cost_object_edges;
CREATE POLICY cost_object_edges_member_select ON public.cost_object_edges FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:read'));
CREATE POLICY cost_object_edges_member_insert ON public.cost_object_edges FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:create'));
CREATE POLICY cost_object_edges_member_update ON public.cost_object_edges FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:update'));
CREATE POLICY cost_object_edges_member_delete ON public.cost_object_edges FOR DELETE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:delete'));

-- ── 1.5 receipts — cost documents → costs:{…} ────────────────────────────────────────────────
DROP POLICY IF EXISTS receipts_member_all ON public.receipts;
CREATE POLICY receipts_member_select ON public.receipts FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:read'));
CREATE POLICY receipts_member_insert ON public.receipts FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:create'));
CREATE POLICY receipts_member_update ON public.receipts FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:update'));
CREATE POLICY receipts_member_delete ON public.receipts FOR DELETE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'costs:delete'));

-- ── 1.6 business_service_log — the PMI service log → pmi:{read,update} ───────────────────────
-- NOTE: the spec mints no pmi:create / pmi:delete (§3). INSERT rides pmi:update (logging a
-- service IS the update act); DELETE gets no member policy and stays owner-only. Recorded as a
-- deliberate mapping, not an oversight.
DROP POLICY IF EXISTS business_service_log_member_all ON public.business_service_log;
CREATE POLICY business_service_log_member_select ON public.business_service_log FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'pmi:read'));
CREATE POLICY business_service_log_member_insert ON public.business_service_log FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'pmi:update'));
CREATE POLICY business_service_log_member_update ON public.business_service_log FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'pmi:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'pmi:update'));

-- ── 1.7 business_pricing_config — THE RECIPE. read/update only (no create/delete verb) ───────
DROP POLICY IF EXISTS bpc_member_view_pricing ON public.business_pricing_config;
CREATE POLICY bpc_member_select ON public.business_pricing_config FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'pricing_recipe:read'));
CREATE POLICY bpc_member_insert ON public.business_pricing_config FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'pricing_recipe:update'));
CREATE POLICY bpc_member_update ON public.business_pricing_config FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'pricing_recipe:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'pricing_recipe:update'));

-- ── 1.8-1.9 labor_resources / labor_resource_wages → wages:{…} ───────────────────────────────
DROP POLICY IF EXISTS labor_resources_member_all ON public.labor_resources;
CREATE POLICY labor_resources_member_select ON public.labor_resources FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'wages:read'));
CREATE POLICY labor_resources_member_insert ON public.labor_resources FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'wages:create'));
CREATE POLICY labor_resources_member_update ON public.labor_resources FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'wages:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'wages:update'));
CREATE POLICY labor_resources_member_delete ON public.labor_resources FOR DELETE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'wages:delete'));

DROP POLICY IF EXISTS lrw_member_view_wages ON public.labor_resource_wages;
CREATE POLICY lrw_member_select ON public.labor_resource_wages FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'wages:read'));
CREATE POLICY lrw_member_insert ON public.labor_resource_wages FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'wages:create'));
CREATE POLICY lrw_member_update ON public.labor_resource_wages FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'wages:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'wages:update'));
CREATE POLICY lrw_member_delete ON public.labor_resource_wages FOR DELETE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'wages:delete'));

-- ── 1.10 customers — read renamed; N5 member WRITE now REAL (David's ruling) ─────────────────
-- customers:delete is NOT minted (R2 — a column is not a tombstone). DELETE stays owner-only.
DROP POLICY IF EXISTS customers_member ON public.customers;
CREATE POLICY customers_member_select ON public.customers FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:read'));
CREATE POLICY customers_member_insert ON public.customers FOR INSERT TO authenticated
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:create'));
CREATE POLICY customers_member_update ON public.customers FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'customers:update'));

-- ── 1.11-1.14 the order-read family — view_orders → the four read strings ────────────────────
-- SELECT-only, exactly as today: every order WRITE goes through the service-key api layer
-- (submit.ts), so no member write policy is added here and none is removed.
DROP POLICY IF EXISTS orders_member_select ON public.orders;
CREATE POLICY orders_member_select ON public.orders FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'orders:read'));

DROP POLICY IF EXISTS order_items_member ON public.order_items;
CREATE POLICY order_items_member ON public.order_items FOR SELECT TO authenticated
  USING (order_id IN (SELECT o.id FROM public.orders o
          WHERE public.is_active_member(o.business_id)
            AND public.has_permission(o.business_id, 'order_items:read')));

DROP POLICY IF EXISTS order_service_selections_member ON public.order_service_selections;
CREATE POLICY order_service_selections_member ON public.order_service_selections FOR SELECT TO authenticated
  USING (order_id IN (SELECT o.id FROM public.orders o
          WHERE public.is_active_member(o.business_id)
            AND public.has_permission(o.business_id, 'order_service_selections:read')));

DROP POLICY IF EXISTS order_compliance_records_member ON public.order_compliance_records;
CREATE POLICY order_compliance_records_member ON public.order_compliance_records FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'order_compliance_records:read'));

-- ── 1.15 deliveries — THE NARROWING. [ALL] with NO string → verb-split. ──────────────────────
-- 🔴 THIS IS WHERE STAFF LOSES CREATE AND DELETE. See the header. The only INSERT in the
-- codebase is server-side under the service key (api/customers/create.ts:101, adminDb), which
-- bypasses RLS and is unaffected. No client INSERT and no DELETE exists anywhere (corpus:
-- cultivar-os/src, cultivar-os/api, shared/src, api/, supabase/migrations RPCs).
DROP POLICY IF EXISTS deliveries_member_all ON public.deliveries;
CREATE POLICY deliveries_member_select ON public.deliveries FOR SELECT TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'deliveries:read'));
CREATE POLICY deliveries_member_update ON public.deliveries FOR UPDATE TO authenticated
  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'deliveries:update'))
  WITH CHECK (public.is_active_member(business_id) AND public.has_permission(business_id, 'deliveries:update'));
-- No member INSERT policy: `deliveries:create` is not granted to any role this pass and the only
-- writer is the service key. No member DELETE policy: R2, no tombstone. Both stay owner-only.

COMMIT;


BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- §2 — THE FUNCTION GATE: import_write_price → inventory:import_price
-- ════════════════════════════════════════════════════════════════════════════════
-- The ONLY function in the schema whose body checks a legacy string (STEP 0 Block B — corpus:
-- pg_proc across schema `public`, all 16 legacy strings, one hit). Body is otherwise VERBATIM
-- from 20260723_inventory_import_pricing_gate.sql:105 — only the gate string changes.
CREATE OR REPLACE FUNCTION public.import_write_price(
  p_lot_id        uuid,
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_sell_price    numeric,
  p_price_basis   text
) RETURNS TABLE(applied boolean, reason text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'inventory:import_price') THEN
    RETURN QUERY SELECT false, 'inventory:import_price permission required — ask the owner to grant bulk price import on the Team page'::text;
    RETURN;
  END IF;

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

-- ════════════════════════════════════════════════════════════════════════════════
-- §3 — TAX: re-gate the reader, and MINT THE NARROW WRITER (spec §5)
-- ════════════════════════════════════════════════════════════════════════════════
-- get_business_tax_rate (#153) is membership-only today — it checks NO string, which is why
-- STEP 0 Block B did not return it. It now carries `tax_rate:read`, so tax read is a declared
-- capability instead of an undeclared side effect of membership.
CREATE OR REPLACE FUNCTION public.get_business_tax_rate(p_business_id uuid)
RETURNS numeric
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = ''
AS $$
  SELECT CASE
    WHEN public.has_permission(p_business_id, 'tax_rate:read')
     AND public.is_active_member(p_business_id)
    THEN (SELECT (config->>'taxRate')::numeric FROM public.business_pricing_config
           WHERE business_id = p_business_id)
    ELSE NULL
  END;
$$;
REVOKE ALL ON FUNCTION public.get_business_tax_rate(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_business_tax_rate(uuid) TO authenticated, service_role;

-- THE NARROW WRITER. Writes ONLY config->'taxRate' via jsonb_set. It must never be able to
-- touch baselineMargin / referencePrice / markup / discountTypes — that is the pricing recipe,
-- and the whole point of a separate tax_rate resource is that setting a tax rate is not the
-- same authority as setting prices. Audited in the same transaction (ruling 4).
CREATE OR REPLACE FUNCTION public.set_business_tax_rate(
  p_business_id   uuid,
  p_rate          numeric,
  p_actor_user_id uuid
) RETURNS TABLE(applied boolean, reason text, rate_before numeric, rate_after numeric)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_before numeric;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'tax_rate:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'tax_rate.update_denied', 'business', p_business_id::text,
            jsonb_build_object('attempted_rate', p_rate), 'denied');
    RETURN QUERY SELECT false, 'tax_rate:update permission required'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  -- D-9: refuse a nonsense rate rather than storing it. A negative or >1 rate is not a rate.
  IF p_rate IS NULL OR p_rate < 0 OR p_rate > 1 THEN
    RETURN QUERY SELECT false, 'tax rate must be a fraction between 0 and 1 (e.g. 0.0825)'::text, NULL::numeric, NULL::numeric;
    RETURN;
  END IF;

  SELECT (config->>'taxRate')::numeric INTO v_before
    FROM public.business_pricing_config WHERE business_id = p_business_id;

  UPDATE public.business_pricing_config
     SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{taxRate}', to_jsonb(p_rate), true)
   WHERE business_id = p_business_id;

  IF NOT FOUND THEN
    INSERT INTO public.business_pricing_config (business_id, config)
    VALUES (p_business_id, jsonb_build_object('taxRate', p_rate));
  END IF;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'tax_rate.changed', 'business', p_business_id::text,
          jsonb_build_object('before', v_before, 'after', p_rate), 'success');

  RETURN QUERY SELECT true, NULL::text, v_before, p_rate;
END;
$$;
REVOKE ALL ON FUNCTION public.set_business_tax_rate(uuid, numeric, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_business_tax_rate(uuid, numeric, uuid) TO authenticated, service_role;

COMMIT;


BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- §4 — p_reason ON THE FUNNEL (ruling 4 — the audit says WHY, not only WHAT)
-- ════════════════════════════════════════════════════════════════════════════════
-- The four migration funnel calls all write `role.permissions_changed`. Without a reason a
-- reader must INFER which was the mechanical rename and which was David's grant, from the
-- before/after shape. That is tech-debt #72's defect (the `sale` ledger row's NULL reason)
-- and it is cheaper to not create it than to fix it later.
-- The 7-arg form is DROPPED first: keeping it would make a 7-arg call ambiguous against the
-- new 8-arg-with-default. Existing app callers pass 7 args and resolve to the default.
DROP FUNCTION IF EXISTS public.save_role_permissions(uuid, uuid, text, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION public.save_role_permissions(
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_role_key      text,
  p_op            text,
  p_label         text,
  p_description   text,
  p_permissions   jsonb,
  p_reason        text DEFAULT NULL
) RETURNS TABLE(applied boolean, reason text, member_id uuid, member_name text, perms_before jsonb, perms_after jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_before jsonb; v_resolved jsonb; v_existing uuid; v_action text;
  v_members jsonb := '[]'::jsonb; v_count int := 0; r record;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = p_actor_user_id) THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'permission.self_elevation_denied', 'role', p_role_key,
            jsonb_build_object('op', p_op, 'attempted_permissions', p_permissions, 'reason', p_reason), 'denied');
    RETURN QUERY SELECT false, 'only the business owner may change role permissions'::text,
      NULL::uuid, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  PERFORM set_config('trace.authority_funnel', 'on', true);

  SELECT permissions INTO v_before FROM public.role_definitions
   WHERE role_key = p_role_key AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC LIMIT 1;

  IF p_op IN ('reset', 'delete') THEN
    DELETE FROM public.role_definitions WHERE business_id = p_business_id AND role_key = p_role_key;
    v_action := CASE WHEN p_op = 'reset' THEN 'role.factory_reset' ELSE 'role.deleted' END;
  ELSE
    SELECT id INTO v_existing FROM public.role_definitions
     WHERE business_id = p_business_id AND role_key = p_role_key;
    IF v_existing IS NOT NULL THEN
      UPDATE public.role_definitions
         SET permissions = p_permissions,
             label       = COALESCE(p_label, label),
             description = COALESCE(p_description, description)
       WHERE id = v_existing;
    ELSE
      INSERT INTO public.role_definitions (business_id, role_key, is_system, label, description, permissions)
      VALUES (p_business_id, p_role_key, false, p_label, p_description, p_permissions);
    END IF;
    v_action := CASE WHEN p_op = 'create' THEN 'role.created' ELSE 'role.permissions_changed' END;
  END IF;

  SELECT permissions INTO v_resolved FROM public.role_definitions
   WHERE role_key = p_role_key AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC LIMIT 1;

  IF v_resolved IS NOT NULL THEN
    FOR r IN SELECT id, name, permissions AS before_perms FROM public.business_members
              WHERE business_id = p_business_id AND role = p_role_key AND active = true ORDER BY name
    LOOP
      UPDATE public.business_members SET permissions = v_resolved WHERE id = r.id;
      v_members := v_members || jsonb_build_object('id', r.id, 'before', r.before_perms, 'after', v_resolved);
      v_count := v_count + 1;
      RETURN QUERY SELECT true, NULL::text, r.id, r.name, r.before_perms, v_resolved;
    END LOOP;
  END IF;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, 'OWNER', v_action, 'role', p_role_key,
          jsonb_build_object('before', v_before, 'after', v_resolved,
                             'members_affected', v_count, 'members', v_members,
                             'reason', p_reason),          -- ← the addition
          'success');

  IF v_count = 0 THEN
    RETURN QUERY SELECT true, NULL::text, NULL::uuid, NULL::text, NULL::jsonb, NULL::jsonb;
  END IF;
  RETURN;
END;
$$;
REVOKE ALL ON FUNCTION public.save_role_permissions(uuid, uuid, text, text, text, text, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_role_permissions(uuid, uuid, text, text, text, text, jsonb, text) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════════
-- §5 — THE FLOOR REWRITE — computed from permission_aliases, NOT hand-typed
-- ════════════════════════════════════════════════════════════════════════════════
-- The floor seeds every future member, so it must speak the new vocabulary or the first member
-- minted after this migration arrives holding retired strings (§11.5 — R-C extended sideways).
--
-- THE DECOMPOSITION IS READ FROM DATA. `decomposition(L)` = every NEW-checked row whose
-- satisfier is L: `SELECT from_perm FROM permission_aliases WHERE implies_perm = L AND
-- from_perm LIKE '%:%'`. This is exact, self-verifying, and it AUTOMATICALLY drops retired
-- strings (view_dashboard / view_reports have no alias rows at all). A hand-typed list here
-- would be the fourth unstated-corpus claim in this program.
--
-- ── THE OWNER FLOOR — DECOMPOSED, NOT EMPTIED (decision, David 2026-07-27, reason on record) ──
-- The recommendation on the table was to EMPTY the OWNER floor: owner authority is `owner_id` at
-- all three layers (table = 20 `*_owner_all`; api = `callerIsBusinessOwner`; route =
-- BusinessProvider.tsx:695), so the array is decorative for the actual owner — and a decorative
-- array is what produced the 6-string fiction.
--
-- FIRST, THE FACT THAT WAS MISSING: something DOES read it.
-- `OnboardingWizard.tsx:561` calls `resolveRoleDefaults(supabase, businessId, 'OWNER')` and mints
-- the owner's member row FROM THE FLOOR. (`SignUp.tsx:34` does not — it writes a hardcoded
-- 5-string literal. The two mint paths disagree; BUILD 2 makes SignUp read the floor too.)
-- CORPUS: packages/shared/src, packages/cultivar-os/src, packages/cultivar-os/api — grep
-- `role_definitions` + `resolveRoleDefaults`; readers are roleDefinitions.ts (the accessor),
-- MemberConsole (display), OnboardingWizard:561 (OWNER), Settings:205 (invite role).
--
-- DECISION: DECOMPOSE. Two reasons.
--   1. `role_key = 'OWNER'` and `businesses.owner_id` are DIFFERENT THINGS. Every current OWNER
--      member happens to be the owner_id (STEP 0 Block D2), but the model permits a member with
--      role OWNER who is not the owner. That person gets NO owner bypass at any layer and falls
--      back to the array — an empty floor would silently give them nothing. Fail-closed, but a
--      trap laid for a state the model allows.
--   2. Emptying is a REVOCATION dressed as cleanup, and this migration is a RENAME. Same
--      discipline as the two-call tenant split: removing authority is its own act, with its own
--      audit row and its own reason string.
-- The fiction is fixed at its actual source — the hardcoded mint literal — not by hollowing out
-- the template. **David may overrule; emptying it later is one UPDATE and one audit row.**
--
-- ⚠️ THIS IS A RENAME, NOT AN ALIGNMENT. The floor becomes exactly what it already granted, in
-- new words. It is NOT set to MANAGER_DEFAULT_BUNDLE / STAFF_DEFAULT_BUNDLE — aligning the
-- floor to the designed bundles is a GRANT decision and therefore a separate authority act,
-- the same discipline as the two-call tenant split.
--
-- ── R-B2 — THE OUTPUT FILTER. A DISTINCT MECHANISM FROM R-B, AT A DIFFERENT PIPELINE POINT ──
-- 🔧 CORRECTION (David, 2026-07-27). An earlier write-up claimed this exclusion "is R-A's
-- existing rule" and that `deliveries.route:update` merely "joins override_maintenance in
-- STRIPPED_AT_BACKFILL.unwired". THAT WAS WRONG. The SQL below was right and the prose was not.
--
--   R-B  (STRIPPED_AT_BACKFILL) is an INPUT filter. It drops a LEGACY string before
--        decomposition, so its replacements are never produced. Its members are legacy strings:
--        `override_maintenance`, `view_dashboard`, `view_reports`, `process_orders`, `manage_team`.
--
--   R-B2 (this clause) is an OUTPUT filter. It drops a specific NEW string FROM the
--        decomposition, while its legacy antecedent stays fully wired and fully kept.
--
-- THE PROOF THEY ARE NOT THE SAME RULE: `deliveries.route:update` descends from
-- `manage_deliveries`, which is wired, kept, and decomposes into three other strings we DO want.
-- No input filter can reach it — dropping `manage_deliveries` would also destroy `deliveries:read`,
-- `deliveries:update` and `deliveries.route:read`. Only an output filter reaches this case.
-- (`maintenance:override` is caught by BOTH mechanisms; `deliveries.route:update` by R-B2 alone.
-- That asymmetry is exactly why the two need separate names.)
--
-- WHY ANY OF IT IS FILTERED: a `declared-unwired` string in a role definition is UN-REMOVABLE
-- through the UI — §7.1 filters it out of the Roles-page catalog, and MemberConsole.tsx:651 seeds
-- its draft from the RESOLVED SET, so a held string with no chip survives every save. Seeding one
-- mints the very defect this migration exists to remove.
--
-- ⚠️ THE LITERAL BELOW IS A HAND-MADE SNAPSHOT AND IS NOT THE AUTHORITY. The authority is
-- `permissionManifest.ts` — any string whose status is `declared-unwired`. SQL cannot read the TS
-- register, so the loop is closed in the OTHER direction, by the verifier (BUILD 2):
--   (a) capQ FAILS if any DEFAULT bundle contains a declared-unwired string;
--   (b) capQ FAILS if THIS LIST diverges from the manifest's declared-unwired set — so adding a
--       new declared-unwired string to the manifest breaks the build until this line is updated;
--   (c) V5 below FAILS if any role_definitions row — floor OR tenant — holds one.
-- Three surfaces, one authority, no silent drift.
UPDATE public.role_definitions rd
   SET permissions = COALESCE((
         SELECT jsonb_agg(DISTINCT a.from_perm)
           FROM jsonb_array_elements_text(rd.permissions) AS legacy(s)
           JOIN public.permission_aliases a ON a.implies_perm = legacy.s
          WHERE a.from_perm LIKE '%:%'
            AND a.from_perm NOT IN ('maintenance:override', 'deliveries.route:update')
       ), '[]'::jsonb)
 WHERE rd.business_id IS NULL
   AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(rd.permissions) AS x(s)
                WHERE x.s NOT LIKE '%:%');   -- idempotent: only rows still holding legacy strings

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════
-- V-CHECKS — run AFTER applying, BEFORE the funnel calls. Uncomment one at a time.
-- ════════════════════════════════════════════════════════════════════════════════
-- ⚠️ EVERY CHECK BELOW STATES ITS CORPUS. This program has produced three negative claims with
-- unstated corpora (§12.2); Phase 7 CONTRACT is built entirely out of negative claims, so the
-- discipline starts here. Paste the OUTPUT into the ledger row — not a sentence saying it passed.

-- ── V1 — ZERO legacy strings survive in any policy. CORPUS: pg_policies, schema public, all 16.
-- EXPECT: 0 rows.
-- SELECT tablename, policyname, cmd FROM pg_policies
--  WHERE schemaname='public'
--    AND (COALESCE(qual,'')||' '||COALESCE(with_check,'')) ~
--        '(view_costs|view_orders|view_customers|view_wages|view_pricing_config|view_margin|manage_orders|manage_settings|manage_deliveries|manage_campaigns|manage_customers|qr_checkout|import_pricing|apply_tax_exempt|view_dashboard|view_reports)';

-- ── V2 — ZERO legacy strings survive in any function body. CORPUS: pg_proc, schema public.
-- EXPECT: 0 rows. (`has_permission` itself is exempt — it takes the string as a PARAMETER.)
-- SELECT proname FROM pg_proc
--  WHERE pronamespace='public'::regnamespace
--    AND proname NOT IN ('has_permission','has_permission_for')
--    AND prosrc ~ '(view_costs|view_orders|view_customers|view_wages|view_pricing_config|view_margin|manage_orders|manage_settings|manage_deliveries|manage_campaigns|manage_customers|qr_checkout|import_pricing|apply_tax_exempt|view_dashboard|view_reports)';

-- ── V3 — the 15 sites became verb-split policies, all TO authenticated.
-- EXPECT: 43 rows across 15 tables; no row shows {public}.
-- SELECT tablename, policyname, cmd, roles::text FROM pg_policies
--  WHERE schemaname='public' AND policyname ~ '_member_(select|insert|update|delete)$|_member$'
--  ORDER BY tablename, policyname;

-- ── V4 — NEGATIVE: deliveries has NO member INSERT and NO member DELETE policy.
-- This is the narrowing, asserted rather than assumed. EXPECT: 0 rows.
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname='public' AND tablename='deliveries'
--    AND cmd IN ('INSERT','DELETE') AND policyname ~ 'member';

-- ── V5 — R-B2 / R-C SIDEWAYS: EVERY role_definitions row — FLOOR **AND TENANT** — speaks the
--    new vocabulary and holds NO declared-unwired string.
-- CORPUS: public.role_definitions, all rows, both scopes. Not just the floor: a legacy or unwired
-- string surviving in a TENANT override seeds it into the next member minted for that role.
-- EXPECT: every row `legacy_left` = 0 AND `unwired_left` = 0.
-- SELECT COALESCE(business_id::text,'(FLOOR)') AS scope, role_key,
--        jsonb_array_length(permissions) AS n,
--        (SELECT count(*) FROM jsonb_array_elements_text(permissions) x(s) WHERE x.s NOT LIKE '%:%') AS legacy_left,
--        (SELECT count(*) FROM jsonb_array_elements_text(permissions) x(s)
--          WHERE x.s IN ('maintenance:override','deliveries.route:update')) AS unwired_left,
--        permissions
--   FROM public.role_definitions ORDER BY (business_id IS NOT NULL), role_key;

-- ── V5b — THE SAME INVARIANT AGAINST MEMBER ARRAYS (run after the funnel calls).
-- EXPECT: 0 rows. A declared-unwired string in a member array is un-removable through the UI.
-- SELECT bm.business_id, bm.name, bm.role, x.s AS unwired_string
--   FROM public.business_members bm, jsonb_array_elements_text(bm.permissions) x(s)
--  WHERE bm.active AND x.s IN ('maintenance:override','deliveries.route:update');

-- ── V6 — the tax writer cannot touch the recipe. Run as a member holding tax_rate:update.
-- EXPECT: taxRate changes; baselineMargin / referencePrice / markup / discountTypes IDENTICAL.
-- BEGIN;
--   SELECT config FROM public.business_pricing_config WHERE business_id='f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
--   SELECT * FROM public.set_business_tax_rate('f7ec5d67-a9ef-4cb0-b807-438d67687d1b', 0.0825,
--                                              '95c1b2e9-3b09-43dd-a9f8-ba0744ca4382');
--   SELECT config FROM public.business_pricing_config WHERE business_id='f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
-- ROLLBACK;

-- ── V7 — NEGATIVE: a nonsense rate is REFUSED, not stored (D-9). EXPECT applied=false, twice.
-- BEGIN;
--   SELECT * FROM public.set_business_tax_rate('f7ec5d67-a9ef-4cb0-b807-438d67687d1b', -0.1,
--                                              '95c1b2e9-3b09-43dd-a9f8-ba0744ca4382');
--   SELECT * FROM public.set_business_tax_rate('f7ec5d67-a9ef-4cb0-b807-438d67687d1b', 8.25,
--                                              '95c1b2e9-3b09-43dd-a9f8-ba0744ca4382');
-- ROLLBACK;

-- ── V8 — p_reason lands in the audit detail. Run AFTER the funnel calls.
-- EXPECT: 4 rows, reasons rbac-migration:rename ×2, :grant, :staff-narrow.
-- SELECT created_at, target_id, detail->>'reason' AS reason, detail->'members_affected' AS n
--   FROM public.audit_log WHERE action='role.permissions_changed'
--    AND detail->>'reason' LIKE 'rbac-migration:%' ORDER BY created_at;

-- ── V9 — NEGATIVE: the owner is not locked out of anything. CORPUS: every table this file
-- touched. EXPECT: every row owner_policies >= 1.
-- SELECT tablename, count(*) FILTER (WHERE policyname ~ 'owner') AS owner_policies
--   FROM pg_policies WHERE schemaname='public'
--    AND tablename IN ('business_inventory','cost_objects','cost_object_assignments','cost_object_edges',
--                      'receipts','business_service_log','business_pricing_config','labor_resources',
--                      'labor_resource_wages','customers','orders','order_items',
--                      'order_service_selections','order_compliance_records','deliveries')
--  GROUP BY tablename ORDER BY tablename;
