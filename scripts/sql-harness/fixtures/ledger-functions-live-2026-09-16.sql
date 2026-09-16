-- LIVE definitions (pg_get_functiondef), read 2026-09-16 with the read-only PAT, for the ledger #344 harness.
-- Schema only — no data. Regenerate from the live database rather than editing by hand.
CREATE OR REPLACE FUNCTION public.emit_inventory_movement(p_business_id uuid, p_inventory_id uuid, p_delta integer, p_kind text, p_reason text DEFAULT NULL::text, p_source_type text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_actor_user_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now(), p_aggregate_type text DEFAULT NULL::text, p_aggregate_id uuid DEFAULT NULL::uuid, p_event_type text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.business_inventory_ledger
    (business_id, inventory_id, delta, kind, reason, source_type, source_id, actor_user_id,
     occurred_at, aggregate_type, aggregate_id, event_type)
  VALUES
    (p_business_id, p_inventory_id, p_delta, p_kind, p_reason, p_source_type, p_source_id,
     p_actor_user_id, COALESCE(p_occurred_at, now()),
     COALESCE(p_aggregate_type, 'INVENTORY'),
     COALESCE(p_aggregate_id, p_inventory_id),
     COALESCE(p_event_type, p_kind))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.discovery_rescan_clear(p_business_id uuid, p_sku_prefix text DEFAULT 'DISC-'::text, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(cleared integer, skipped integer, skipped_ids uuid[])
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_cleared int := 0;
  v_skipped uuid[] := ARRAY[]::uuid[];
  r         record;
BEGIN
  FOR r IN
    SELECT bi.id, bi.qty
      FROM public.business_inventory bi
     WHERE bi.business_id = p_business_id
       AND bi.sku LIKE p_sku_prefix || '%'
       AND bi.status <> 'deleted'
     FOR UPDATE
  LOOP
    IF r.qty <> 0
       OR EXISTS (SELECT 1 FROM public.business_inventory_ledger l
                   WHERE l.inventory_id = r.id AND l.kind <> 'opening_balance')
       OR EXISTS (SELECT 1 FROM public.inventory_counts ic
                   WHERE ic.inventory_id = r.id)
    THEN
      v_skipped := v_skipped || r.id;      -- HAS HISTORY → protected, and reported
      CONTINUE;
    END IF;

    UPDATE public.business_inventory
       SET status = 'deleted', updated_at = now()
     WHERE id = r.id;

    PERFORM public.emit_inventory_movement(
      p_business_id, r.id, 0, 'rescan_clear',
      'catalog re-scan cleared an uncounted discovery row (qty 0, no movement history)',
      'discovery', NULL, NULL, p_occurred_at);

    v_cleared := v_cleared + 1;
  END LOOP;

  -- COALESCE: array_length of an EMPTY array returns NULL, not 0 — an untreated NULL here
  -- would read as "unknown how many were skipped" on a clean run. Honest zero.
  RETURN QUERY SELECT v_cleared, COALESCE(array_length(v_skipped, 1), 0), v_skipped;
END $function$

;
CREATE OR REPLACE FUNCTION public.reject_inventory_ledger_mutation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  RAISE EXCEPTION 'business_inventory_ledger is append-only: % is not permitted (D-50 — a correction is a NEW row, never an edit)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$function$

;
CREATE OR REPLACE FUNCTION public.assert_movement_actor(p_business_id uuid, p_actor_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- (2) NO FORGERY — a client-direct caller may only write movements as themselves.
  IF auth.uid() IS NOT NULL AND p_actor_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'movement actor mismatch: a caller may only record movements as themselves (D-50 — the row carries the REAL actor)'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- NULL actor = an honest system write. Reachable only under the service key, because an
  -- authenticated caller has a non-NULL auth.uid() and would have tripped the pin above.
  IF p_actor_user_id IS NULL THEN
    RETURN;
  END IF;

  -- (1) MEMBERSHIP — trust-but-verify, by id (AC-2).
  IF NOT public.is_member_of(p_business_id, p_actor_user_id) THEN
    RAISE EXCEPTION 'movement actor % is not the owner or an active member of business %', p_actor_user_id, p_business_id
      USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.adjust_inventory_manual(p_lot_id uuid, p_business_id uuid, p_new_qty integer, p_actor_user_id uuid, p_reason text DEFAULT NULL::text, p_kind text DEFAULT 'adjust'::text, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(new_qty integer, delta integer, ledger_id uuid, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current int;
  v_delta   int;
  v_ledger  uuid;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF p_new_qty IS NULL OR p_new_qty < 0 THEN
    RAISE EXCEPTION 'qty must be >= 0 (got %)', p_new_qty USING ERRCODE = 'check_violation';
  END IF;

  SELECT bi.qty INTO v_current
    FROM public.business_inventory bi
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::int, NULL::int, NULL::uuid, false, 'lot_not_found'::text;
    RETURN;
  END IF;

  v_delta := p_new_qty - v_current;

  IF v_delta = 0 THEN
    -- Nothing moved. No ledger row — the ledger records MOVEMENT, and a no-op is not one
    -- (a row here would make replay noisier without adding a fact).
    RETURN QUERY SELECT p_new_qty, 0, NULL::uuid, true, 'noop'::text;
    RETURN;
  END IF;

  UPDATE public.business_inventory bi
     SET qty = p_new_qty,
         status = CASE
                    WHEN bi.status IN ('available', 'depleted', 'reserved')
                      THEN CASE WHEN p_new_qty <= 0 THEN 'depleted' ELSE 'available' END
                    ELSE bi.status
                  END,
         updated_at = now()
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id;

  v_ledger := public.emit_inventory_movement(
    p_business_id, p_lot_id, v_delta, COALESCE(p_kind, 'adjust'),
    p_reason, 'manual', NULL, p_actor_user_id, p_occurred_at);

  RETURN QUERY SELECT p_new_qty, v_delta, v_ledger, true, 'applied'::text;
END $function$

;
CREATE OR REPLACE FUNCTION public.adjust_inventory_qty(p_lot_id uuid, p_business_id uuid, p_delta integer, p_actor_user_id uuid DEFAULT NULL::uuid, p_kind text DEFAULT 'sale'::text, p_reason text DEFAULT NULL::text, p_source_type text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(new_qty integer, new_status text, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_qty    int;
  v_status text;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- UNCHANGED from 20260713 — a SINGLE guarded UPDATE (implicit row lock), concurrency-safe,
  -- oversell guard intact, status derivation intact, manual damaged/returned preserved.
  UPDATE public.business_inventory bi
     SET qty = bi.qty + p_delta,
         status = CASE
                    WHEN bi.status IN ('available', 'depleted', 'reserved')
                      THEN CASE WHEN bi.qty + p_delta <= 0 THEN 'depleted' ELSE 'available' END
                    ELSE bi.status
                  END,
         updated_at = now()
   WHERE bi.id = p_lot_id
     AND bi.business_id = p_business_id
     AND bi.qty + p_delta >= 0     -- OVERSELL GUARD: never drive qty negative
   RETURNING bi.qty, bi.status INTO v_qty, v_status;

  IF FOUND THEN
    -- SAME TRANSACTION as the UPDATE above. This is the whole decision.
    PERFORM public.emit_inventory_movement(
      p_business_id, p_lot_id, p_delta, COALESCE(p_kind, 'sale'),
      p_reason, p_source_type, p_source_id, p_actor_user_id, p_occurred_at);
    RETURN QUERY SELECT v_qty, v_status, true, 'applied'::text;
    RETURN;
  END IF;

  -- 0 rows updated → distinguish an oversell refusal from a missing lot (honest signal).
  -- NO ledger row: nothing moved, so there is nothing to record. A refusal is not a movement.
  IF EXISTS (SELECT 1 FROM public.business_inventory
              WHERE id = p_lot_id AND business_id = p_business_id) THEN
    SELECT bi.qty, bi.status INTO v_qty, v_status
      FROM public.business_inventory bi
     WHERE bi.id = p_lot_id AND bi.business_id = p_business_id;
    RETURN QUERY SELECT v_qty, v_status, false, 'oversell_refused'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT NULL::int, NULL::text, false, 'lot_not_found'::text;
END $function$

;
CREATE OR REPLACE FUNCTION public.count_promote_create_inventory(p_business_id uuid, p_actor_user_id uuid, p_name text, p_qty integer, p_size text DEFAULT NULL::text, p_variant_group text DEFAULT NULL::text, p_sku text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(inventory_id uuid, ledger_id uuid, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_lot    uuid;
  v_ledger uuid;
  v_kind   text;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF p_qty IS NULL OR p_qty < 0 THEN
    RAISE EXCEPTION 'new lot qty must be >= 0 (got %)', p_qty USING ERRCODE = 'check_violation';
  END IF;
  IF p_name IS NULL OR btrim(p_name) = '' THEN
    RAISE EXCEPTION 'a new lot requires a name (D-9 — never mint an unnamed row)'
      USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.business_inventory
    (business_id, name, qty, size, variant_group, sku, status, cost_confidence)
  VALUES
    (p_business_id, p_name, p_qty, p_size, p_variant_group, p_sku,
     CASE WHEN p_qty > 0 THEN 'available' ELSE 'depleted' END,
     'UNKNOWN')            -- mirrors InventoryCount.tsx:479-484 — cost is not known at count time
  RETURNING id INTO v_lot;

  v_kind := CASE WHEN p_qty > 0 THEN 'count_reconcile' ELSE 'opening_balance' END;

  v_ledger := public.emit_inventory_movement(
    p_business_id, v_lot, p_qty, v_kind,
    p_reason, 'inventory_count', p_source_id, p_actor_user_id, p_occurred_at);

  RETURN QUERY SELECT v_lot, v_ledger, true, 'applied'::text;
END $function$

;
CREATE OR REPLACE FUNCTION public.count_reconcile_inventory(p_lot_id uuid, p_business_id uuid, p_counted_qty integer, p_actor_user_id uuid, p_size text DEFAULT NULL::text, p_reason text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(new_qty integer, delta integer, ledger_id uuid, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current int;
  v_delta   int;
  v_ledger  uuid;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF p_counted_qty IS NULL OR p_counted_qty < 0 THEN
    RAISE EXCEPTION 'counted qty must be >= 0 (got %) — a count asserts physical truth', p_counted_qty
      USING ERRCODE = 'check_violation';
  END IF;

  -- FOR UPDATE: lock the lot so a concurrent sale cannot land between the read and the write.
  -- This closes recon finding #1 — "a count committed while an order is being paid silently
  -- overwrites the decrement" — which is live today on every absolute-SET path.
  SELECT bi.qty INTO v_current
    FROM public.business_inventory bi
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::int, NULL::int, NULL::uuid, false, 'lot_not_found'::text;
    RETURN;
  END IF;

  v_delta := p_counted_qty - v_current;

  UPDATE public.business_inventory bi
     SET qty    = p_counted_qty,
         size   = COALESCE(p_size, bi.size),
         status = CASE
                    WHEN bi.status IN ('available', 'depleted', 'reserved')
                      THEN CASE WHEN p_counted_qty <= 0 THEN 'depleted' ELSE 'available' END
                    ELSE bi.status
                  END,
         updated_at = now()
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id;

  -- A zero-delta count is still a FACT worth recording ("counted, and it agreed"): it is the
  -- evidence that closes a reconcile window. Recorded, same transaction.
  v_ledger := public.emit_inventory_movement(
    p_business_id, p_lot_id, v_delta, 'count_reconcile',
    p_reason, 'inventory_count', p_source_id, p_actor_user_id, p_occurred_at);

  RETURN QUERY SELECT p_counted_qty, v_delta, v_ledger, true, 'applied'::text;
END $function$

;
CREATE OR REPLACE FUNCTION public.discovery_create_inventory(p_business_id uuid, p_name text, p_sku text DEFAULT NULL::text, p_size text DEFAULT NULL::text, p_variant_group text DEFAULT NULL::text, p_source_id uuid DEFAULT NULL::uuid, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(inventory_id uuid, ledger_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_lot    uuid;
  v_ledger uuid;
BEGIN
  INSERT INTO public.business_inventory
    (business_id, name, qty, sku, size, variant_group, status, cost_confidence)
  VALUES (p_business_id, p_name, 0, p_sku, p_size, p_variant_group, 'available', 'UNKNOWN')
  RETURNING id INTO v_lot;

  v_ledger := public.emit_inventory_movement(
    p_business_id, v_lot, 0, 'opening_balance',
    'catalog discovery birth (qty 0 — stock is never fabricated)',
    'discovery', p_source_id, NULL, p_occurred_at);

  RETURN QUERY SELECT v_lot, v_ledger;
END $function$

;
CREATE OR REPLACE FUNCTION public.record_order_event(p_business_id uuid, p_order_id uuid, p_event_type text, p_actor_user_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_id uuid;
BEGIN
  IF p_order_id IS NULL OR p_event_type IS NULL THEN
    RAISE EXCEPTION 'record_order_event requires an order id and an event type';
  END IF;

  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  v_id := public.emit_inventory_movement(
    p_business_id    => p_business_id,
    p_inventory_id   => NULL,
    p_delta          => 0,
    p_kind           => p_event_type,
    p_reason         => p_reason,
    p_source_type    => 'order',
    p_source_id      => p_order_id,
    p_actor_user_id  => p_actor_user_id,
    p_occurred_at    => COALESCE(p_occurred_at, now()),
    p_aggregate_type => 'ORDER',
    p_aggregate_id   => p_order_id,
    p_event_type     => p_event_type
  );
  RETURN v_id;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.soft_delete_inventory(p_lot_id uuid, p_business_id uuid, p_actor_user_id uuid, p_reason text DEFAULT NULL::text, p_occurred_at timestamp with time zone DEFAULT now())
 RETURNS TABLE(ledger_id uuid, audit_id uuid, prior_qty integer, applied boolean, reason text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_current int;
  v_sku     text;
  v_name    text;
  v_status  text;
  v_ledger  uuid;
  v_audit   uuid;
  v_role    text;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  SELECT bi.qty, bi.sku, bi.name, bi.status
    INTO v_current, v_sku, v_name, v_status
    FROM public.business_inventory bi
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, NULL::int, false, 'lot_not_found'::text;
    RETURN;
  END IF;

  IF v_status = 'deleted' THEN
    RETURN QUERY SELECT NULL::uuid, NULL::uuid, v_current, false, 'already_deleted'::text;
    RETURN;
  END IF;

  -- THE TOMBSTONE — flip status, zero the on-hand. NO `DELETE FROM`. The row survives so
  -- history keeps its anchor (ledger.inventory_id stays populated).
  UPDATE public.business_inventory bi
     SET status = 'deleted', qty = 0, updated_at = now()
   WHERE bi.id = p_lot_id AND bi.business_id = p_business_id;

  -- The movement: whatever was on hand has left the book.
  v_ledger := public.emit_inventory_movement(
    p_business_id, p_lot_id, -v_current, 'delete_tombstone',
    p_reason, 'manual', NULL, p_actor_user_id, p_occurred_at);

  -- The DISCRETIONARY act (Layer 1). Role is a SNAPSHOT STRING at time of action, never an
  -- FK — history must not move when roles change (20260623_audit_log_spine.sql:66).
  SELECT bm.role INTO v_role
    FROM public.business_members bm
   WHERE bm.business_id = p_business_id AND bm.user_id = p_actor_user_id AND bm.active = true
   LIMIT 1;

  IF v_role IS NULL AND EXISTS (
    SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = p_actor_user_id
  ) THEN
    v_role := 'owner';
  END IF;

  INSERT INTO public.audit_log
    (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES
    (p_business_id, p_actor_user_id, v_role, 'inventory.delete', 'business_inventory',
     p_lot_id::text,
     jsonb_build_object(
       'sku', v_sku, 'name', v_name,
       'prior_qty', v_current, 'prior_status', v_status,
       'reason', p_reason, 'ledger_id', v_ledger),   -- ledger row id, per the R5 narrowing
     'success')
  RETURNING id INTO v_audit;

  RETURN QUERY SELECT v_ledger, v_audit, v_current, true, 'applied'::text;
END $function$

;
CREATE OR REPLACE FUNCTION public.business_inventory_unit_projection_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
BEGIN
  IF NEW.unit_parsed_from IS DISTINCT FROM NEW.size THEN
    NEW.unit_kind        := NULL;
    NEW.unit_value       := NULL;
    NEW.unit_value_max   := NULL;
    NEW.unit_name        := NULL;
    NEW.unit_parsed_from := NULL;
  END IF;
  RETURN NEW;
END $function$

;
