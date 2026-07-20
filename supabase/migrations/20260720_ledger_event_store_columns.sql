-- ════════════════════════════════════════════════════════════════════════════════
-- D-50 · LAYER 2A-2 — EVENT-STORE COLUMNS + THE ORDER-EVENT WRITER
-- ════════════════════════════════════════════════════════════════════════════════
-- PURPOSE:      Make business_inventory_ledger a general append-only EVENT LOG rather than
--               an inventory-only movement log, so an order's lifecycle and the stock
--               movements it causes live in ONE ordered stream. Adopts the standard
--               event-store column shape (aggregate_type / aggregate_id / event_type) —
--               this measures against that standard, it does not redesign it (§6 r10/r16).
--
--               INVENTORY events: aggregate_type='INVENTORY', aggregate_id=inventory_id,
--                 delta = the signed qty movement (they SUM to on-hand).
--               ORDER events:     aggregate_type='ORDER',     aggregate_id=order_id,
--                 delta = 0 — a status transition is FREE to the on-hand invariant. That is
--                 the entire reason one log can carry both without corrupting reconcile.
--
-- DEPENDENCIES: business_inventory_ledger + emit_inventory_movement + assert_movement_actor
--                 (20260720_inventory_movement_ledger.sql — LAYER 1, owner-proven 2026-07-20)
--               · orders(id, business_id, status)
--               · ORDER_STATUSES vocabulary (packages/cultivar-os/src/lib/orderStatus.ts)
--
-- OUTPUTS:      3 nullable columns · 1 index · view business_inventory_ledger_events
--               · emit_inventory_movement amended (12 args, backward-compatible)
--               · NEW RPC record_order_event
--
-- SCOPE:        ADDITIVE. No column is dropped, no constraint tightened, no existing row
--               touched (see §2 — the no-backfill ruling). emit_inventory_movement is
--               dropped and recreated rather than overloaded, for the same load-bearing
--               reason LAYER 1 §7a states for adjust_inventory_qty: a second overload makes
--               every existing 9-arg call site AMBIGUOUS and they would all start failing.
--               RPCs are postgres functions, NOT Vercel functions — 12/12 untouched (§6 r11).
--
-- SOURCE:       docs/decisions/2026-07-19-inventory-movement-ledger-D50.md (D-50, ACCEPTED)
-- GATED:        David applies this in the Supabase SQL editor.
-- ════════════════════════════════════════════════════════════════════════════════


-- ════════════════════════════════════════════════════════════════════════════════
-- §1 — THE EVENT-STORE COLUMNS
-- ════════════════════════════════════════════════════════════════════════════════
-- All three NULLABLE and all three ADDITIVE. `kind` is deliberately KEPT, not renamed:
-- renaming it would rewrite 131 rows of proven history and break the six LAYER 1 RPCs that
-- write it. event_type is the canonical going-forward name; kind is its historical spelling.
-- For every row written from here on, the emit seam (§3) sets them to the SAME value, so
-- they cannot drift (STD-011 — one fact, and the one place that writes it).
ALTER TABLE business_inventory_ledger
  ADD COLUMN IF NOT EXISTS aggregate_type text,   -- 'INVENTORY' | 'ORDER'
  ADD COLUMN IF NOT EXISTS aggregate_id   uuid,   -- the lot id, or the order id
  ADD COLUMN IF NOT EXISTS event_type     text;   -- canonical name for `kind`

-- NO CHECK constraint on aggregate_type or event_type — same reasoning LAYER 1 gives for
-- `kind` (the AC-4 / cost_source precedent): the value set grows without a migration.

-- The event-stream read this table now has to serve: "every event for this aggregate, in
-- order." Complements LAYER 1's per-lot and per-business indexes; does not replace them.
CREATE INDEX IF NOT EXISTS business_inventory_ledger_aggregate_idx
  ON business_inventory_ledger (aggregate_type, aggregate_id, occurred_at);


-- ════════════════════════════════════════════════════════════════════════════════
-- §2 — ⚠️ THE 131 EXISTING ROWS ARE **NOT** BACKFILLED — AND THAT IS THE RULING
-- ════════════════════════════════════════════════════════════════════════════════
-- The build spec asked for one UPDATE setting event_type = kind, aggregate_type =
-- 'INVENTORY', aggregate_id = inventory_id on the existing rows. That UPDATE IS NOT HERE,
-- for two reasons — the second of which means it could not have run as written anyway.
--
-- (1) IT WOULD BREACH THE GUARANTEE THIS TABLE WAS BUILT TO MAKE. D-50's thesis is "a
--     correction is a NEW row, never an edit," enforced by trg_inventory_ledger_immutable
--     plus a REVOKE of UPDATE/DELETE from anon, authenticated AND service_role. V2 of the
--     owner-prove verified the trigger fires EVEN FOR postgres — that was called out at the
--     time as the whole point (it defends against our own future code). A backfill would
--     require ALTER TABLE ... DISABLE TRIGGER: the first extension of the ledger would open
--     the exact door the ledger exists to weld shut.
--
-- (2) THE DATA IS 100% DERIVABLE, SO STORING IT WOULD BE A SECOND COPY OF ONE FACT (STD-011).
--     For every pre-existing row: event_type IS kind · aggregate_type IS 'INVENTORY' (every
--     LAYER 1 row is a stock movement) · aggregate_id IS inventory_id. Nothing is unknown
--     and nothing is lost. A COALESCE read returns the identical answer with zero mutation.
--
-- So the historical rows keep NULL in the three new columns and the VIEW below resolves
-- them on read. Readers use the view; nobody hand-writes the COALESCE (§6 r8).
CREATE OR REPLACE VIEW business_inventory_ledger_events AS
  SELECT
    l.id,
    l.business_id,
    l.inventory_id,
    l.delta,
    l.kind,
    COALESCE(l.event_type, l.kind)                AS event_type,
    COALESCE(l.aggregate_type, 'INVENTORY')       AS aggregate_type,
    COALESCE(l.aggregate_id, l.inventory_id)      AS aggregate_id,
    l.reason,
    l.source_type,
    l.source_id,
    l.actor_user_id,
    l.occurred_at,
    l.created_at
  FROM public.business_inventory_ledger l;

-- The view inherits the base table's RLS (it is not SECURITY DEFINER and has no BYPASSRLS),
-- so tenant scope stays exactly LAYER 1's two policies — nothing is widened here.
GRANT SELECT ON public.business_inventory_ledger_events TO authenticated, service_role;

COMMENT ON VIEW public.business_inventory_ledger_events IS
  'D-50 read contract: the ledger with event-store columns resolved. Pre-2026-07-20 rows '
  'carry NULL in event_type/aggregate_type/aggregate_id and are resolved here rather than '
  'backfilled — the table is append-only and even postgres cannot UPDATE it. Read this view, '
  'not the base table, whenever you want event_type/aggregate_*.';


-- ════════════════════════════════════════════════════════════════════════════════
-- §3 — THE EMIT SEAM, AMENDED (still ONE insert — §6 r8)
-- ════════════════════════════════════════════════════════════════════════════════
-- Three new trailing params, ALL DEFAULTED. The six LAYER 1 RPCs call this with 9 args and
-- are NOT edited: they bind to the new signature via defaults and now populate the aggregate
-- columns for free, because the default resolution below is 'INVENTORY' + p_inventory_id.
-- That is why this is done in the seam and not in six call sites.
--
-- DROP-then-CREATE, not CREATE OR REPLACE: adding parameters produces an OVERLOAD, and a
-- 9-arg call against both a 9-arg and a 12-arg candidate is ambiguous — every existing RPC
-- would fail at runtime. LAYER 1 §7a hit and documented this same trap.
DROP FUNCTION IF EXISTS public.emit_inventory_movement(uuid, uuid, int, text, text, text, uuid, uuid, timestamptz);

CREATE FUNCTION public.emit_inventory_movement(
  p_business_id    uuid,
  p_inventory_id   uuid,
  p_delta          int,
  p_kind           text,
  p_reason         text        DEFAULT NULL,
  p_source_type    text        DEFAULT NULL,
  p_source_id      uuid        DEFAULT NULL,
  p_actor_user_id  uuid        DEFAULT NULL,
  p_occurred_at    timestamptz DEFAULT now(),
  p_aggregate_type text        DEFAULT NULL,   -- NULL → 'INVENTORY'
  p_aggregate_id   uuid        DEFAULT NULL,   -- NULL → p_inventory_id
  p_event_type     text        DEFAULT NULL    -- NULL → p_kind
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- Grants restated verbatim from LAYER 1 §5 — the DROP took them with it. NOT granted to
-- authenticated: a client able to emit a bare movement could write a delta with no matching
-- qty change, precisely the divergence D-50 exists to make impossible.
REVOKE ALL ON FUNCTION public.emit_inventory_movement(uuid, uuid, int, text, text, text, uuid, uuid, timestamptz, text, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_inventory_movement(uuid, uuid, int, text, text, text, uuid, uuid, timestamptz, text, uuid, text) TO service_role;


-- ════════════════════════════════════════════════════════════════════════════════
-- §4 — record_order_event — THE ORDER-PATH WRITER
-- ════════════════════════════════════════════════════════════════════════════════
-- One immutable event per order-lifecycle transition. delta is HARD-CODED 0 (not a
-- parameter): an order event must never be able to move on-hand, and making that
-- un-passable is stronger than trusting every future caller to pass zero.
--
-- inventory_id stays NULL — an order event is not about a lot. source_type/source_id are
-- ALSO set to the order, so the existing source index finds an order's whole causal set
-- (its own transitions AND the stock movements it caused) in one query. That is what makes
-- the owner-prove's single WHERE clause work.
--
-- Actor validation is the SAME gate every movement RPC uses. An order transition is
-- manager-gated at the API, so a NULL actor here would be a real defect rather than an
-- honest system write — but the gate is not re-implemented, it is reused (§6 r8).
CREATE OR REPLACE FUNCTION public.record_order_event(
  p_business_id   uuid,
  p_order_id      uuid,
  p_event_type    text,
  p_actor_user_id uuid        DEFAULT NULL,
  p_reason        text        DEFAULT NULL,
  p_occurred_at   timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- service_role ONLY — deliberately NOT authenticated, matching LAYER 1's posture on the emit
-- seam. assert_movement_actor stops a client forging SOMEONE ELSE's id, but a signed-in manager
-- granted EXECUTE could still write arbitrary lifecycle events for their own business into an
-- append-only log that nobody can retract. The sole caller is the server (submit.ts, service
-- key), so granting to authenticated would add exactly that attack surface and zero capability.
REVOKE ALL ON FUNCTION public.record_order_event(uuid, uuid, text, uuid, text, timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_order_event(uuid, uuid, text, uuid, text, timestamptz) TO service_role;


-- ════════════════════════════════════════════════════════════════════════════════
-- §5 — VERIFICATION (run after applying; catalog-backed, not asserted — §9 schema gate)
-- ════════════════════════════════════════════════════════════════════════════════
-- V1 columns exist and are nullable:
--   SELECT column_name, data_type, is_nullable FROM information_schema.columns
--    WHERE table_name='business_inventory_ledger'
--      AND column_name IN ('aggregate_type','aggregate_id','event_type');
--   EXPECT 3 rows, all is_nullable = YES.
--
-- V2 no existing row was touched (the append-only guarantee held through this migration):
--   SELECT count(*) FILTER (WHERE event_type IS NULL) AS untouched, count(*) AS total
--     FROM business_inventory_ledger;
--   EXPECT untouched = total = 131 immediately after applying, BEFORE any new event.
--
-- V3 the view resolves them anyway (this is the point of §2):
--   SELECT count(*) FROM business_inventory_ledger_events
--    WHERE event_type IS NULL OR aggregate_type IS NULL OR aggregate_id IS NULL;
--   EXPECT 0.
--
-- V4 immutability still holds on the widened table:
--   UPDATE business_inventory_ledger SET event_type='x' WHERE id=(SELECT id FROM business_inventory_ledger LIMIT 1);
--   EXPECT ERROR: append-only ... is not permitted.
--
-- V5 the six LAYER 1 RPCs still resolve against the new 12-arg seam (no ambiguity):
--   SELECT proname, pronargs FROM pg_proc WHERE proname='emit_inventory_movement';
--   EXPECT exactly ONE row, pronargs = 12.
--
-- V6 order events never move on-hand (the invariant that lets one log carry both):
--   SELECT coalesce(sum(delta),0) FROM business_inventory_ledger WHERE aggregate_type='ORDER';
--   EXPECT 0, now and forever.
