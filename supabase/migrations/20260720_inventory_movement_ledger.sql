-- ════════════════════════════════════════════════════════════════════════════════
-- D-50 · INVENTORY MOVEMENT LEDGER — LAYER 1 of 2 (schema + guards + RPCs + backfill)
-- ════════════════════════════════════════════════════════════════════════════════
-- PURPOSE:      Give every inventory quantity change a durable, immutable, actor-carrying
--               row written in the SAME TRANSACTION as the qty write, so "a quantity moved
--               with no record explaining it" becomes structurally impossible rather than
--               a convention someone must remember. On-hand and expected both DERIVE from
--               this ledger (D-50: movement is the truth; there is no expected_qty snapshot).
--               Also wires the FIRST real audit_log writer (close-out ledger row 19B —
--               UNBLOCKED/NOT-STARTED since 2026-06-24; the vault has been empty 27 days).
--
-- DEPENDENCIES: businesses(id, owner_id) · business_members(business_id, user_id, active, role)
--               · business_inventory(id, business_id, qty, status, sku, name, size,
--                 variant_group, cost_confidence) · audit_log (20260623_audit_log_spine.sql)
--               · public.is_active_member (20260622_is_active_member_canonical_rls.sql)
--               · public.adjust_inventory_qty (20260713_inventory_decrement_and_reorder.sql)
--
-- OUTPUTS:      table business_inventory_ledger · trigger trg_inventory_ledger_immutable
--               · 2 RLS policies · helpers is_member_of / assert_movement_actor /
--               emit_inventory_movement · 6 movement RPCs · one genesis row per existing lot.
--
-- SCOPE:        ADDITIVE. Nothing is dropped or altered except public.adjust_inventory_qty,
--               which is amended backward-compatibly (see §7a — it MUST be dropped and
--               recreated, not overloaded; the reason is load-bearing and stated there).
--               NO application code is touched — the 10 app-side callers are rewired in
--               LAYER 2. Every RPC signature added here is backward-compatible.
--               RPCs are postgres functions, NOT Vercel functions — the 12/12 ceiling is
--               untouched (§6 r11).
--
-- SOURCE:       docs/decisions/2026-07-19-inventory-movement-ledger-D50.md (D-50, ACCEPTED)
--               docs/decisions/2026-07-19-qty-write-and-audit-emit-recon.md (the emit map:
--               14 sites / 5 chokepoints / 4 already atomic / 10 needing an RPC)
--
-- GATED:        David applies this as postgres, then runs V1–V6 in the footer. LAYER 2 does
--               not start until every check is green.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- ⚠️ BUILD-TIME FLAG #1 — THE ACTOR-VALIDATION MECHANISM WAS CORRECTED (read before applying)
-- ════════════════════════════════════════════════════════════════════════════════
-- The build prompt specified: "VALIDATES the actor via public.is_active_member(p_business_id)".
-- Implemented LITERALLY, that would BREAK LIVE CHECKOUT.
--
--   public.is_active_member(uuid) validates the SESSION caller — its body reads auth.uid()
--   (20260622_is_active_member_canonical_rls.sql:100). It does NOT look at p_actor_user_id.
--   Recon R3 establishes that on chokepoint 1 (the order/sale path) writes run on adminDb()
--   with the SERVICE KEY, so auth.uid() IS NULL. is_active_member() would therefore return
--   FALSE for every legitimate sale, and a RAISE on false would refuse every decrement.
--
-- The prompt's INTENT — trust-but-verify: the actor named must genuinely belong to that
-- business — is correct and is what is built. Only the named mechanism was wrong. So this
-- migration adds public.is_member_of(p_business_id, p_user_id), which verifies the PASSED
-- actor by id (owner OR active member) and never consults auth.uid().
--
-- This is the same class as the CLAUDE.md:409 correction in BUILD 7 and tech-debt #61:
-- the conclusion holds, the mechanism sentence does not. Surfaced, not silently patched.
--
-- The gate is STRICTER than the prompt asked for, in two ways, both stated:
--   (1) MEMBERSHIP — a non-NULL actor must be owner-or-active-member of p_business_id, by id.
--   (2) NO FORGERY — when auth.uid() IS NOT NULL (any client-direct caller), the actor MUST
--       equal auth.uid(). A member can append their own movement, never one attributed to
--       someone else. This mirrors the audit_insert policy's actor pin
--       (20260623_audit_log_spine.sql:128). Under the service key auth.uid() is NULL, the
--       pin does not apply, and (1) carries the check.
--   NULL actor = an honest system write (populate / scripts). Never defaulted to the owner
--   (D-50 §11, recon R3). Only service_role-EXECUTE RPCs can reach that branch, because an
--   authenticated caller has a non-NULL auth.uid() and so trips the forgery pin.
--
-- ⚠️ BUILD-TIME FLAG #2 — occurred_at is a PARAMETER, not just a DB default.
-- Recon R3's timing caveat: the count path is OFFLINE-CAPABLE and drains through SyncEngine,
-- so a DB-side now() would stamp the SYNC time, not the COUNT time, and the replay timeline
-- would be wrong by the length of the lot walk. Every RPC therefore takes p_occurred_at
-- DEFAULT now(), so LAYER 2 can carry the client-captured event time. The column default
-- stays now() for direct inserts. This is additive and costs nothing if unused.
--
-- ⚠️ BUILD-TIME FLAG #3 — four columns this migration depends on are NOT in version control.
-- business_inventory.size / .variant_group / .cost_confidence (and .sell_price) are live-only
-- — that is tech-debt #39, confirmed by grep: no migration in supabase/migrations/ adds them,
-- yet InventoryCount.tsx writes all three. plpgsql does NOT resolve column names at CREATE
-- time, so a drifted column would apply cleanly here and fail at the FIRST CALL — in a lot,
-- on a phone. §0 below therefore asserts the columns exist AT APPLY TIME and refuses to
-- proceed if they do not. Loud at apply beats silent until 2am.
-- ════════════════════════════════════════════════════════════════════════════════


BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- §0 — PRE-FLIGHT ASSERTIONS (see BUILD-TIME FLAG #3)
-- ════════════════════════════════════════════════════════════════════════════════
DO $preflight$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(c.tbl || '.' || c.col, ', ')
    INTO v_missing
    FROM (VALUES
      ('business_inventory','id'), ('business_inventory','business_id'),
      ('business_inventory','qty'), ('business_inventory','status'),
      ('business_inventory','sku'), ('business_inventory','name'),
      ('business_inventory','size'), ('business_inventory','variant_group'),
      ('business_inventory','cost_confidence'),
      ('audit_log','business_id'), ('audit_log','actor_user_id'), ('audit_log','actor_role'),
      ('audit_log','action'), ('audit_log','target_type'), ('audit_log','target_id'),
      ('audit_log','detail'), ('audit_log','outcome'),
      ('business_members','user_id'), ('business_members','active'), ('business_members','role'),
      ('businesses','owner_id')
    ) AS c(tbl, col)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = c.tbl AND column_name = c.col
   );

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION
      'D-50 pre-flight FAILED — expected column(s) absent: %. The RPCs below reference them and would fail at first CALL, not at apply. Reconcile the live schema (tech-debt #39) before applying.',
      v_missing;
  END IF;
END
$preflight$;


-- ════════════════════════════════════════════════════════════════════════════════
-- §1 — THE LEDGER TABLE  (BUILD 1)
-- ════════════════════════════════════════════════════════════════════════════════
-- Named business_inventory_ledger — the business_ layer, no vertical noun (AC-1).
-- Append-only BY DESIGN: there is deliberately no updated_at, because a row is never
-- amended. A correction is a NEW row with an opposing delta (D-50: "a 'let owners fix a
-- bad row' button is rejected by the database").
CREATE TABLE IF NOT EXISTS business_inventory_ledger (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id    uuid        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,  -- tenant scope (AC-3)

  -- NULLABLE + ON DELETE SET NULL, deliberately: HISTORY OUTLIVES THE ROW. The ruling is
  -- that a lot is never hard-deleted (it is tombstoned — §7e), so this should stay populated
  -- in normal operation. SET NULL is the belt for the rare true removal (e.g. a business_id
  -- cascade elsewhere) — the movement fact survives even when its lot does not.
  inventory_id   uuid        REFERENCES business_inventory(id) ON DELETE SET NULL,

  -- SIGNED: + is stock IN (receive, found, restore, opening balance), - is stock OUT
  -- (sale, dead, loss, tombstone). On-hand = SUM(delta). Typed int, NOT jsonb, because
  -- the whole point is that it SUMS (event-model recon: "you want to sum it").
  delta          int         NOT NULL,

  -- NO CHECK constraint (AC-4 / the cost_source precedent): the value set grows without a
  -- migration. Current vocabulary: opening_balance · count_reconcile · sale · sale_reversal
  -- · receive · adjust · dead · loss · found · delete_tombstone · rescan_clear.
  kind           text        NOT NULL,

  reason         text,                    -- the human's words; D-50: cannot be derived or backfilled
  source_type    text,                    -- 'order' | 'inventory_count' | 'receipt' | 'discovery' | ...
  source_id      uuid,                    -- the order/count/receipt that caused it

  -- The REAL actor. Informational, NOT an FK to auth.users — mirrors
  -- inventory_count_sessions.counted_by, so history does not move or block when a user row
  -- changes. NULL = a genuine system write, never a defaulted owner (D-50 §11).
  actor_user_id  uuid,

  occurred_at    timestamptz NOT NULL DEFAULT now(),  -- WHEN IT HAPPENED (see FLAG #2)
  created_at     timestamptz NOT NULL DEFAULT now()   -- when it was recorded
);

-- Replay indexes: on-hand and "expected at instant T" are both a walk of one lot in time
-- order — that is the read this table exists to serve.
CREATE INDEX IF NOT EXISTS business_inventory_ledger_lot_idx
  ON business_inventory_ledger (inventory_id, occurred_at);
CREATE INDEX IF NOT EXISTS business_inventory_ledger_business_idx
  ON business_inventory_ledger (business_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS business_inventory_ledger_source_idx
  ON business_inventory_ledger (source_type, source_id);


-- ════════════════════════════════════════════════════════════════════════════════
-- §2 — IMMUTABILITY AT THE DATABASE  (BUILD 2 — REUSED, NOT REINVENTED)
-- ════════════════════════════════════════════════════════════════════════════════
-- REUSE STATEMENT (§6 r10): this is the audit_log guard, applied verbatim in shape.
-- The reused pattern is reject_audit_log_mutation() + its trigger + the REVOKE pair,
-- at 20260623_audit_log_spine.sql:151-171 — owner-proven 2026-06-24 (spine #19) and
-- proven in anger: it rejected the full-nuke wipe (scripts/wipe-for-person-spine.sql).
-- A SECOND function is created rather than reusing the audit one because a trigger
-- function's message names its own table; the PATTERN is reused, the text is honest.
CREATE OR REPLACE FUNCTION public.reject_inventory_ledger_mutation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  RAISE EXCEPTION 'business_inventory_ledger is append-only: % is not permitted (D-50 — a correction is a NEW row, never an edit)', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$;

DROP TRIGGER IF EXISTS trg_inventory_ledger_immutable ON business_inventory_ledger;
CREATE TRIGGER trg_inventory_ledger_immutable
  BEFORE UPDATE OR DELETE ON business_inventory_ledger
  FOR EACH ROW EXECUTE FUNCTION public.reject_inventory_ledger_mutation();

-- Independent backstop: even a future accidental UPDATE/DELETE policy cannot help if the
-- underlying table privilege is absent. INSERT and SELECT remain (RLS-gated, §3).
-- service_role is included — the prompt asks for it, and it matters: the sale path runs
-- under the service key, so leaving service_role able to UPDATE the ledger would leave the
-- single most-trafficked path able to rewrite history.
REVOKE UPDATE, DELETE ON public.business_inventory_ledger FROM authenticated;
REVOKE UPDATE, DELETE ON public.business_inventory_ledger FROM anon;
REVOKE UPDATE, DELETE ON public.business_inventory_ledger FROM service_role;

-- TRUNCATE is a FOURTH mutation path that bypasses BOTH RLS and FOR EACH ROW triggers
-- (the lesson of 20260624_audit_log_truncate_revoke.sql:16-20 — a scar, reused).
REVOKE TRUNCATE ON public.business_inventory_ledger FROM anon, authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════════════
-- §3 — RLS  (BUILD 3 — mirrors inventory_counts exactly)
-- ════════════════════════════════════════════════════════════════════════════════
-- Both policies are FOR ALL (the default when no FOR clause is given) so SELECT IS COVERED.
-- That is deliberate and load-bearing: LAYER 2's reconcile reader must not hit the
-- missing-SELECT-policy trap that has now bitten this platform three times (open
-- architecture decision #11 — modules, nursery_modules, orders).
-- No USING(true) anywhere. Tenant scope is business_id membership (AC-2/AC-3).
ALTER TABLE business_inventory_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS business_inventory_ledger_owner_all ON business_inventory_ledger;
CREATE POLICY business_inventory_ledger_owner_all ON business_inventory_ledger
  USING (
    EXISTS (SELECT 1 FROM businesses
             WHERE id = business_inventory_ledger.business_id AND owner_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM businesses
             WHERE id = business_inventory_ledger.business_id AND owner_id = auth.uid())
  );

DROP POLICY IF EXISTS business_inventory_ledger_member_all ON business_inventory_ledger;
CREATE POLICY business_inventory_ledger_member_all ON business_inventory_ledger
  USING      ( public.is_active_member(business_inventory_ledger.business_id) )
  WITH CHECK ( public.is_active_member(business_inventory_ledger.business_id) );

-- NOTE: the UPDATE/DELETE half of these FOR ALL policies is INERT — §2's trigger raises
-- and the privileges are revoked. The policies grant no mutation power; they exist so SELECT
-- and INSERT are correctly scoped.


-- ════════════════════════════════════════════════════════════════════════════════
-- §4 — ACTOR VALIDATION HELPERS  (see BUILD-TIME FLAG #1)
-- ════════════════════════════════════════════════════════════════════════════════
-- Verifies the PASSED actor id — never auth.uid(). This is the piece is_active_member
-- cannot do, and the reason the prompt's literal instruction would have broken checkout.
CREATE OR REPLACE FUNCTION public.is_member_of(p_business_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL AND p_business_id IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.businesses
             WHERE id = p_business_id AND owner_id = p_user_id)
    OR EXISTS (SELECT 1 FROM public.business_members
                WHERE business_id = p_business_id AND user_id = p_user_id AND active = true)
  );
$$;

REVOKE ALL ON FUNCTION public.is_member_of(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.is_member_of(uuid, uuid) TO authenticated, service_role;

-- The gate every movement RPC calls first. Two clauses, both stated in FLAG #1.
CREATE OR REPLACE FUNCTION public.assert_movement_actor(p_business_id uuid, p_actor_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
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
$$;

REVOKE ALL ON FUNCTION public.assert_movement_actor(uuid, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assert_movement_actor(uuid, uuid) TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════════════
-- §5 — THE ONE LEDGER-INSERT SEAM  (§6 r8: one OPERATION, one place)
-- ════════════════════════════════════════════════════════════════════════════════
-- Every RPC below emits through this. Writing the INSERT six times would be six chances to
-- drift — the exact class §6 r8 exists to prevent.
CREATE OR REPLACE FUNCTION public.emit_inventory_movement(
  p_business_id   uuid,
  p_inventory_id  uuid,
  p_delta         int,
  p_kind          text,
  p_reason        text        DEFAULT NULL,
  p_source_type   text        DEFAULT NULL,
  p_source_id     uuid        DEFAULT NULL,
  p_actor_user_id uuid        DEFAULT NULL,
  p_occurred_at   timestamptz DEFAULT now()
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.business_inventory_ledger
    (business_id, inventory_id, delta, kind, reason, source_type, source_id, actor_user_id, occurred_at)
  VALUES
    (p_business_id, p_inventory_id, p_delta, p_kind, p_reason, p_source_type, p_source_id,
     p_actor_user_id, COALESCE(p_occurred_at, now()))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Callable only from the SECURITY DEFINER RPCs below (and trusted server code). NOT granted
-- to authenticated: a client that could emit a bare movement could write a delta with no
-- matching qty change — precisely the divergence D-50 exists to make impossible.
REVOKE ALL ON FUNCTION public.emit_inventory_movement(uuid, uuid, int, text, text, text, uuid, uuid, timestamptz) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.emit_inventory_movement(uuid, uuid, int, text, text, text, uuid, uuid, timestamptz) TO service_role;


-- ════════════════════════════════════════════════════════════════════════════════
-- §6 — GENESIS BACKFILL  (BUILD 4)
-- ════════════════════════════════════════════════════════════════════════════════
-- One opening_balance row per existing lot, delta = that lot's CURRENT qty. This makes
-- replay-from-genesis equal on-hand from row one, so V3's SUM(delta) = qty holds for every
-- pre-existing lot. Deterministic and additive: it COPIES the live value and retypes nothing.
-- Runs AFTER the immutability guard is installed — INSERT is unaffected by it (the trigger is
-- BEFORE UPDATE OR DELETE only), which is the ordering the prompt calls for.
-- actor_user_id = NULL: nobody performed this movement; it is the system stating an opening
-- position. Defaulting it to the owner would fabricate an actor (D-9 / D-50 §11).
-- Guarded by NOT EXISTS so a re-apply cannot double-seed.
INSERT INTO business_inventory_ledger
  (business_id, inventory_id, delta, kind, reason, source_type, actor_user_id, occurred_at)
SELECT
  bi.business_id,
  bi.id,
  bi.qty,
  'opening_balance',
  'D-50 genesis backfill — opening position at ledger adoption',
  'migration',
  NULL,
  now()
FROM business_inventory bi
WHERE NOT EXISTS (
  SELECT 1 FROM business_inventory_ledger l
   WHERE l.inventory_id = bi.id AND l.kind = 'opening_balance'
);


-- ════════════════════════════════════════════════════════════════════════════════
-- §7 — THE MOVEMENT RPCs  (BUILD 5)
-- ════════════════════════════════════════════════════════════════════════════════
-- Every RPC below: SECURITY DEFINER · search_path='' · takes p_business_id +
-- p_actor_user_id · calls assert_movement_actor FIRST · does the qty write AND the ledger
-- INSERT in ONE plpgsql transaction, so a gap between them is structurally impossible
-- (D-50 disagreement #1: replay vs on-hand must be ZERO by construction).
-- All preserve the qty + delta >= 0 OVERSELL GUARD.
--
-- NOTE ON RLS: a SECURITY DEFINER function runs as its owner (postgres), which bypasses RLS
-- as table owner. Tenant isolation is therefore enforced EXPLICITLY by the business_id
-- predicate in every statement below plus the actor gate — the same model
-- adjust_inventory_qty already uses. This is stated, not assumed (AC-3).

-- ── §7a — AMEND adjust_inventory_qty (chokepoint 1 — emit points 1,2,3,4) ──────────
-- Funnels the FOUR already-atomic sites: order-paid decrement (submit.ts:792), order edit
-- (:990 — note the recon corrected the prompt's stale :986), delete restore (:1090),
-- cancel restore (:1139).
--
-- ⚠️ WHY DROP-AND-RECREATE RATHER THAN "CREATE OR REPLACE WITH DEFAULTS":
-- CREATE OR REPLACE with a DIFFERENT argument list creates an OVERLOAD, not a replacement.
-- Both a 3-arg and an 8-arg adjust_inventory_qty would then exist, and submit.ts:100-101
-- calls it by NAME with three named params — PostgREST cannot resolve that against two
-- candidates and returns a 300 ambiguity error. That would break checkout on deploy, which
-- is the opposite of backward-compatible. Dropping the 3-arg signature and creating the
-- extended one with ALL new params DEFAULTED keeps the existing 3-named-arg call compiling
-- and behaving identically. The prompt permits amending this one function; this is how the
-- amendment stays actually backward-compatible.
DROP FUNCTION IF EXISTS public.adjust_inventory_qty(uuid, uuid, int);

CREATE OR REPLACE FUNCTION public.adjust_inventory_qty(
  p_lot_id        uuid,
  p_business_id   uuid,
  p_delta         int,
  p_actor_user_id uuid        DEFAULT NULL,
  p_kind          text        DEFAULT 'sale',
  p_reason        text        DEFAULT NULL,
  p_source_type   text        DEFAULT NULL,
  p_source_id     uuid        DEFAULT NULL,
  p_occurred_at   timestamptz DEFAULT now()
) RETURNS TABLE (new_qty int, new_status text, applied boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
END $$;

-- Grants UNCHANGED from 20260713: service_role ONLY. The RPC trusts its p_business_id, so it
-- must stay callable only by trusted server code that resolves business_id from validated
-- context. Granting to authenticated would let any logged-in user pass an arbitrary
-- business_id and mutate another tenant's stock (AC-3).
REVOKE ALL ON FUNCTION public.adjust_inventory_qty(uuid, uuid, int, uuid, text, text, text, uuid, timestamptz) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.adjust_inventory_qty(uuid, uuid, int, uuid, text, text, text, uuid, timestamptz) TO service_role;


-- ── §7b — count_reconcile_inventory (chokepoint 2 — emit points 5, 6) ─────────────
-- The count is a RECONCILE EVENT, not a SET (D-50). It records the OBSERVATION: delta =
-- counted - current, on-hand becomes counted, ONE ledger row of kind 'count_reconcile'.
-- It does NOT classify the gap — accounting for it as dead/loss/found is a later human
-- choice driven by LAYER 2 through §7d, and those are separate ledger rows. Recording the
-- observation and classifying the cause are different acts; conflating them is what would
-- let the system guess a cause (D-9).
-- Handles emit point 6 (the D-49 stub fill) via p_size: when supplied, size is filled in the
-- SAME statement, exactly as InventoryCount.tsx:438-440 does today.
CREATE OR REPLACE FUNCTION public.count_reconcile_inventory(
  p_lot_id        uuid,
  p_business_id   uuid,
  p_counted_qty   int,
  p_actor_user_id uuid,
  p_size          text        DEFAULT NULL,
  p_reason        text        DEFAULT NULL,
  p_source_id     uuid        DEFAULT NULL,   -- the inventory_counts / session row
  p_occurred_at   timestamptz DEFAULT now()
) RETURNS TABLE (new_qty int, delta int, ledger_id uuid, applied boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
END $$;

REVOKE ALL ON FUNCTION public.count_reconcile_inventory(uuid, uuid, int, uuid, text, text, uuid, timestamptz) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.count_reconcile_inventory(uuid, uuid, int, uuid, text, text, uuid, timestamptz) TO authenticated, service_role;


-- ── §7c — count_promote_create_inventory (chokepoint 2 — emit point 7) ────────────
-- Mints a NEW lot from a count (the D-49 sibling-create) in the SAME transaction as its
-- first ledger row. A lot cannot be born without its genesis movement.
-- kind: 'opening_balance' when the new lot starts at 0 (a born-empty placeholder), else
-- 'count_reconcile' — a net-new lot discovered WITH stock on it is a counted observation,
-- not an opening position we are asserting.
CREATE OR REPLACE FUNCTION public.count_promote_create_inventory(
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_name          text,
  p_qty           int,
  p_size          text        DEFAULT NULL,
  p_variant_group text        DEFAULT NULL,
  p_sku           text        DEFAULT NULL,
  p_reason        text        DEFAULT NULL,
  p_source_id     uuid        DEFAULT NULL,
  p_occurred_at   timestamptz DEFAULT now()
) RETURNS TABLE (inventory_id uuid, ledger_id uuid, applied boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
END $$;

REVOKE ALL ON FUNCTION public.count_promote_create_inventory(uuid, uuid, text, int, text, text, text, text, uuid, timestamptz) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.count_promote_create_inventory(uuid, uuid, text, int, text, text, text, text, uuid, timestamptz) TO authenticated, service_role;


-- ── §7d — adjust_inventory_manual (chokepoint 3 — emit points 8, 9, 10) ───────────
-- The DESK path: the inline grid cell edit (BusinessInventory.tsx:173), the edit-mode field
-- blur (InventoryEditor.tsx:232), and the reconcile classification (dead / loss / found).
-- p_kind defaults to 'adjust' and accepts 'dead' | 'loss' | 'found' — this is the RPC
-- LAYER 2 drives when a human ACCOUNTS for a count gap (D-50 §16).
--
-- ⚠️ This closes the through-line the event-model recon named: "THE WALK HAS PROVENANCE; THE
-- DESK DOES NOT." The surface where a number can be quietly changed — at a desk, alone, no
-- session, no scan — was the one with no record. After LAYER 2 rewires it, it has one.
--
-- p_new_qty is ABSOLUTE (that is what the grid edits), but the ledger stores the computed
-- SIGNED delta, under the same FOR UPDATE lock as §7b. A desk edit can no longer silently
-- overwrite a concurrent sale.
CREATE OR REPLACE FUNCTION public.adjust_inventory_manual(
  p_lot_id        uuid,
  p_business_id   uuid,
  p_new_qty       int,
  p_actor_user_id uuid,
  p_reason        text        DEFAULT NULL,
  p_kind          text        DEFAULT 'adjust',
  p_occurred_at   timestamptz DEFAULT now()
) RETURNS TABLE (new_qty int, delta int, ledger_id uuid, applied boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
END $$;

REVOKE ALL ON FUNCTION public.adjust_inventory_manual(uuid, uuid, int, uuid, text, text, timestamptz) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.adjust_inventory_manual(uuid, uuid, int, uuid, text, text, timestamptz) TO authenticated, service_role;


-- ── §7e — soft_delete_inventory (chokepoint 3 — emit point 12) + AUDIT FIRST WRITER ──
-- Replaces the HARD DELETE at inventoryEdit.ts:154 — the sharpest emit point in the recon:
-- it removed stock from existence with no movement row and no tombstone, orphaning every
-- historical ledger row's inventory_id.
--
-- RULING APPLIED: NO hard delete of a lot. The row is TOMBSTONED (status flips, the row
-- SURVIVES), a ledger row records the stock leaving (delta = -current qty), and — because
-- deleting a lot is a CHOICE a human made, not an observation the system recorded — an
-- audit_log row is written. All three in ONE transaction.
--
-- This is BUILD 6: the FIRST real audit_log writer. The vault has been immutable, correct,
-- catalog-proven, and EMPTY for 27 days (close-out row 19B, UNBLOCKED/NOT-STARTED since
-- 2026-06-24). Note this is the SECOND-ranked writer, not the first the spine recon named —
-- see the REPORT's audit note; `role.factory_reset` remains owed and is not in this layer.
CREATE OR REPLACE FUNCTION public.soft_delete_inventory(
  p_lot_id        uuid,
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_reason        text        DEFAULT NULL,
  p_occurred_at   timestamptz DEFAULT now()
) RETURNS TABLE (ledger_id uuid, audit_id uuid, prior_qty int, applied boolean, reason text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
END $$;

REVOKE ALL ON FUNCTION public.soft_delete_inventory(uuid, uuid, uuid, text, timestamptz) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.soft_delete_inventory(uuid, uuid, uuid, text, timestamptz) TO authenticated, service_role;


-- ── §7f — THE COLD PAIR: populate births + the re-scan clear (chokepoint 4) ───────
-- Emit points 13, 14 (populate births at qty 0) and clearDiscovery's mass wipe.

-- (i) A catalog birth. qty is 0 by contract ("never fabricate stock", populate.ts:119), so
-- the ledger row is a zero-delta opening_balance: it asserts a starting position of nothing.
-- actor is NULL — no human acted; a system write, honestly marked (D-50 §11).
CREATE OR REPLACE FUNCTION public.discovery_create_inventory(
  p_business_id   uuid,
  p_name          text,
  p_sku           text        DEFAULT NULL,
  p_size          text        DEFAULT NULL,
  p_variant_group text        DEFAULT NULL,
  p_source_id     uuid        DEFAULT NULL,
  p_occurred_at   timestamptz DEFAULT now()
) RETURNS TABLE (inventory_id uuid, ledger_id uuid)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
END $$;

REVOKE ALL ON FUNCTION public.discovery_create_inventory(uuid, text, text, text, text, uuid, timestamptz) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.discovery_create_inventory(uuid, text, text, text, text, uuid, timestamptz) TO service_role;

-- (ii) THE RE-SCAN CLEAR — replaces clearDiscovery's mass DELETE (populate.ts:73, :82-86).
--
-- ⚠️ THE BAR (the prompt asks how it is enforced — this is the answer):
-- A re-scan may NEVER silently wipe counted stock. A lot is CLEARABLE only if it has no
-- history beyond its own genesis. Enforced by TWO independent predicates, both in the SQL,
-- neither dependent on the caller behaving:
--   (1) NO ledger row of any kind other than 'opening_balance' — i.e. nothing has ever moved
--       on this lot. This is the strong, general test: it catches counts, sales, manual
--       adjusts, and anything a future kind adds, because it is a NOT-EXISTS on the
--       complement rather than a list of forbidden kinds.
--   (2) NO row in inventory_counts pointing at it — belt-and-suspenders for lots counted
--       BEFORE this ledger existed, whose movement history genesis backfill cannot know
--       about. Without (2), a lot counted last month looks pristine to (1).
-- Additionally qty must be 0: a lot carrying stock is never clearable, whatever its history.
--
-- Lots that FAIL the bar are SKIPPED, not deleted — and RETURNED, so the caller can surface
-- them. Silently skipping would be the same lie as silently wiping (D-9).
-- Cleared lots are TOMBSTONED, not deleted (the no-hard-delete ruling), each with a
-- 'rescan_clear' ledger row.
CREATE OR REPLACE FUNCTION public.discovery_rescan_clear(
  p_business_id uuid,
  p_sku_prefix  text        DEFAULT 'DISC-',
  p_occurred_at timestamptz DEFAULT now()
) RETURNS TABLE (cleared int, skipped int, skipped_ids uuid[])
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
END $$;

REVOKE ALL ON FUNCTION public.discovery_rescan_clear(uuid, text, timestamptz) FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.discovery_rescan_clear(uuid, text, timestamptz) TO service_role;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION GATE — RUN AS postgres AFTER APPLY.  THIS IS THE LAYER-1 OWNER-PROVE.
-- LAYER 2 DOES NOT START UNTIL EVERY CHECK BELOW IS GREEN.
-- Queries hit the LIVE CATALOG, never the builder's memory (CLAUDE.md §9 schema gate).
-- Expected results in [brackets].
-- ════════════════════════════════════════════════════════════════════════════════
--
-- ── V1 · SCHEMA ───────────────────────────────────────────────────────────────────
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_schema='public' AND table_name='business_inventory_ledger'
--  ORDER BY ordinal_position;
--   [11 rows: id uuid NO gen_random_uuid() · business_id uuid NO · inventory_id uuid YES
--    · delta integer NO · kind text NO · reason text YES · source_type text YES
--    · source_id uuid YES · actor_user_id uuid YES · occurred_at timestamptz NO now()
--    · created_at timestamptz NO now()]
--
-- SELECT conname, confdeltype FROM pg_constraint
--  WHERE conrelid='public.business_inventory_ledger'::regclass AND contype='f';
--   [business_id → 'c' (CASCADE) · inventory_id → 'n' (SET NULL — history outlives the row)]
--
-- ── V2 · IMMUTABILITY (the guarantee, not the convention) ─────────────────────────
-- Run all three. The first must SUCCEED; the next two must BOTH RAISE.
--   -- pick any ledger row:
--   SELECT id FROM public.business_inventory_ledger LIMIT 1;   \gset
--
--   -- (a) INSERT still works [succeeds]:
--   INSERT INTO public.business_inventory_ledger (business_id, delta, kind, reason)
--   SELECT business_id, 0, 'adjust', 'V2 probe' FROM public.businesses LIMIT 1
--   RETURNING id;
--
--   -- (b) UPDATE is rejected [ERROR: business_inventory_ledger is append-only: UPDATE ...]:
--   UPDATE public.business_inventory_ledger SET delta = 999 WHERE reason = 'V2 probe';
--
--   -- (c) DELETE is rejected [ERROR: business_inventory_ledger is append-only: DELETE ...]:
--   DELETE FROM public.business_inventory_ledger WHERE reason = 'V2 probe';
--
--   ⚠️ The V2 probe row CANNOT BE CLEANED UP — that is the proof working. Leave it; it is a
--      zero-delta row and does not affect V3 (which sums per-lot, and the probe has a NULL
--      inventory_id). Cleaning it up would require exactly the power this table denies.
--
-- SELECT tgname, tgenabled FROM pg_trigger
--  WHERE tgrelid='public.business_inventory_ledger'::regclass AND NOT tgisinternal;
--   [trg_inventory_ledger_immutable · O]
--
-- SELECT grantee, privilege_type FROM information_schema.role_table_grants
--  WHERE table_schema='public' AND table_name='business_inventory_ledger'
--  ORDER BY grantee, privilege_type;
--   [NO row where privilege_type IN ('UPDATE','DELETE','TRUNCATE') for
--    anon / authenticated / service_role]
--
-- ── V3 · GENESIS — the number that matters most ───────────────────────────────────
-- (a) exactly ONE opening_balance per lot [expect 0 rows]:
--   SELECT bi.id, count(l.id) AS genesis_rows
--     FROM public.business_inventory bi
--     LEFT JOIN public.business_inventory_ledger l
--       ON l.inventory_id = bi.id AND l.kind = 'opening_balance'
--    GROUP BY bi.id HAVING count(l.id) <> 1;
--
-- (b) REPLAY EQUALS ON-HAND for every lot [expect 0 rows — ZERO discrepancies]:
--   SELECT bi.id, bi.sku, bi.name, bi.qty AS on_hand,
--          COALESCE(SUM(l.delta), 0) AS replay
--     FROM public.business_inventory bi
--     LEFT JOIN public.business_inventory_ledger l ON l.inventory_id = bi.id
--    GROUP BY bi.id, bi.sku, bi.name, bi.qty
--   HAVING bi.qty <> COALESCE(SUM(l.delta), 0);
--   ⚠️ Any row returned here is a BUG, not shrinkage (D-50 disagreement #1). Do not proceed.
--
-- ── V4 · RLS ──────────────────────────────────────────────────────────────────────
-- SELECT relrowsecurity FROM pg_class WHERE relname='business_inventory_ledger';   [true]
--
-- SELECT policyname, cmd, qual FROM pg_policies
--  WHERE tablename='business_inventory_ledger' ORDER BY policyname;
--   [2 rows · both cmd = ALL (so SELECT is covered) · both business_id-scoped
--    · NEITHER qual is 'true' — grep the output for `true` and find none]
--
-- ── V5 · EACH RPC: qty MOVED **and** a ledger row appeared, same transaction ───────
-- Substitute a real lot id and a real member/owner uid. Run each, then the paired check.
--
--   SELECT * FROM public.adjust_inventory_qty('<lot>','<biz>', -1, '<uid>', 'sale',
--                                             'V5 probe', 'order', NULL, now());
--     [applied=true, new_qty = prior-1]
--   SELECT * FROM public.count_reconcile_inventory('<lot>','<biz>', 7, '<uid>');
--     [applied=true, new_qty=7, delta = 7 - prior]
--   SELECT * FROM public.adjust_inventory_manual('<lot>','<biz>', 5, '<uid>', 'V5 probe','adjust');
--     [applied=true, new_qty=5, delta = 5 - 7 = -2]
--   SELECT * FROM public.count_promote_create_inventory('<biz>','<uid>','V5 Probe Lot', 3, '15 gal');
--     [returns a new inventory_id + ledger_id]
--
--   -- the pairing check — every probe above left a ledger row [expect one row per call]:
--   SELECT kind, delta, actor_user_id, occurred_at
--     FROM public.business_inventory_ledger
--    WHERE inventory_id = '<lot>' ORDER BY occurred_at DESC LIMIT 5;
--
--   -- A NON-MEMBER ACTOR IS REFUSED [ERROR: movement actor ... is not the owner or an
--   -- active member of business ...]:
--   SELECT * FROM public.adjust_inventory_manual('<lot>','<biz>', 4,
--            '00000000-0000-0000-0000-000000000000', 'V5 refusal probe');
--
--   -- The oversell guard SURVIVED the amendment [applied=false, reason='oversell_refused']:
--   SELECT * FROM public.adjust_inventory_qty('<lot>','<biz>', -99999, '<uid>');
--
--   ⚠️ V5 ALSO PROVES BACKWARD COMPATIBILITY — the exact 3-named-arg shape submit.ts sends.
--      If this errors, checkout breaks on the next deploy. It MUST return applied=true:
--   SELECT * FROM public.adjust_inventory_qty(
--            p_lot_id => '<lot>', p_business_id => '<biz>', p_delta => 1);
--
--   -- and exactly ONE adjust_inventory_qty must exist (no ambiguous overload) [1 row]:
--   SELECT oid::regprocedure FROM pg_proc WHERE proname = 'adjust_inventory_qty';
--
-- ── V6 · SOFT DELETE: tombstoned, NOT deleted; ledger AND audit both written ───────
--   SELECT * FROM public.soft_delete_inventory('<probe_lot>','<biz>','<uid>','V6 probe');
--     [applied=true, ledger_id + audit_id both NON-NULL, prior_qty = what was on hand]
--
--   -- the row STILL EXISTS [1 row: status='deleted', qty=0]:
--   SELECT id, status, qty FROM public.business_inventory WHERE id='<probe_lot>';
--
--   -- the movement was recorded [1 row: kind='delete_tombstone', delta = -prior_qty]:
--   SELECT kind, delta, actor_user_id FROM public.business_inventory_ledger
--    WHERE inventory_id='<probe_lot>' AND kind='delete_tombstone';
--
--   -- THE AUDIT VAULT IS NO LONGER EMPTY (close-out row 19B) [>= 1 row]:
--   SELECT action, actor_user_id, actor_role, target_type, target_id, detail, outcome, created_at
--     FROM public.audit_log WHERE action='inventory.delete' ORDER BY created_at DESC LIMIT 5;
--
--   -- the re-scan bar HOLDS — a lot with history is skipped, not wiped:
--   SELECT * FROM public.discovery_rescan_clear('<biz>');
--     [skipped_ids CONTAINS any DISC- lot that has been counted or moved;
--      cleared counts only never-touched, qty-0 rows]
--
-- ════════════════════════════════════════════════════════════════════════════════
