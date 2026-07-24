-- Migration: manager-visibility gaps — the permission funnel's data half
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-07-24
-- Story: manager-visibility pass (David's live owner-prove 2026-07-24, tenant f7ec5d67,
--        signed in as MANAGER df7723be) · the PRINCIPLE (STD-020, David's ruling 2026-07-24)
-- Ledger: #153
--
-- ⚠️ GATED — David applies this in the Supabase SQL editor as the default `postgres`
--    role. NOT applied by the builder. This is a TENANT-ISOLATION change (RLS) + one new
--    SECURITY DEFINER function — the careful category. Verification (V1–V12), INCLUDING the
--    NEGATIVE isolation proofs, is embedded at the bottom (commented; uncomment + run after
--    apply). Nothing here is owner-proven until those queries pass AND the deploy for the
--    SHA under test is READY (OP-15).
--
-- NEVER EDIT APPLIED MIGRATIONS. This APPENDS. It modifies NO prior migration and NO existing
-- policy — every statement below is ADDITIVE (a new policy or a new function). The pre-existing
-- owner policies are untouched: an owner keeps exactly the access they had.
--
-- ══════════════════════════════════════════════════════════════════════════════════════════
-- WHY — THE PRINCIPLE (STD-020, David's ruling 2026-07-24)
--   ONE PERMISSION MEANS ONE CAPABILITY, AND EVERY LAYER THAT CAPABILITY TOUCHES CHECKS THAT
--   SAME PERMISSION. Hold it and the whole path works — route, data, and function. A capability
--   was being gated in up to three independent places (route / RLS policy / RPC) with nothing
--   requiring them to agree. David's live evidence showed BOTH failure directions:
--     · /orders — route open on view_orders, orders RLS owner-only → open at the door, locked
--       at the vault (a manager creates an order they cannot read).
--     · /customers — route gated on the literal 'owner-only' (unholdable), customers RLS already
--       grants member SELECT on view_customers → locked at the door, vault standing open.
--   This migration is the DATA half: it makes view_orders mean "read the order-read family" and
--   makes the sell-side catalog + the sales-tax rate readable by any active member, so the route
--   gates the app already has stop lying.
--
-- ⚠️ DIRECTION OF CHANGE: everything here EXPANDS access (the opposite direction from the
--    20260622 cost wall). Because it expands, EVERY policy has a NEGATIVE test below: a member
--    WITHOUT the permission still sees nothing. An expansion without a negative test is an
--    unproven claim about who can see what.
--
-- AC-2 (business_id-scoped) · AC-3 (tenant isolation absolute — proofs embedded, V9–V12).
-- ══════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── GAP 1: service_offerings — the sell-side catalog (add-ons, transport, netting) ──────────
--   Today service_offerings has ONE policy (service_offerings_owner, FOR ALL, owner-only,
--   20260529_businesses_f:58-61). A manager reads NO offerings → checkout shows no add-ons, no
--   delivery/transport option, no netting. VERIFIED in STEP 0: this table carries only sell-side
--   product/price columns (name, category, timing, price, transport_mode, …) — NO cost or margin
--   column — so the catalog of what a business sells is NOT a financial secret. Gate SELECT on
--   ACTIVE MEMBERSHIP (is_active_member), not view_costs. WRITES STAY OWNER-ONLY (the owner FOR
--   ALL policy is unchanged; this adds a SELECT-only member door).
DROP POLICY IF EXISTS service_offerings_member ON service_offerings;
CREATE POLICY service_offerings_member ON service_offerings
  FOR SELECT
  TO authenticated
  USING ( public.is_active_member(business_id) );

-- ── GAP 2: orders — the order header (view_orders) ──────────────────────────────────────────
--   orders_business_owner (FOR SELECT, owner-only, 20260529_businesses_d:15-16) is the ONLY
--   read policy. A manager passes the /orders route (qr_checkout / view_orders) then reads ZERO
--   rows → "No orders yet". There is NO INSERT policy at all — order creation is server-side
--   (service key, bypasses RLS) — which is exactly how a manager creates an order they cannot
--   read. Add a member SELECT gated on view_orders (the permission the route already keys on),
--   so holding view_orders means something for the first time (retires the THIRD fake pill).
DROP POLICY IF EXISTS orders_member_select ON orders;
CREATE POLICY orders_member_select ON orders
  FOR SELECT
  TO authenticated
  USING ( public.is_active_member(business_id)
          AND public.has_permission(business_id, 'view_orders') );

-- ── GAP 3: order_items — the plant lines (view_orders, scoped through the parent order) ──────
--   order_items_owner (FOR ALL, owner-only, 20260709:98-105) mirrors order_service_selections.
--   The committed-stock derivation reads order_items, so a manager reads lotsCommitted:0 where
--   the owner reads {4,132} → 132 spoken-for units render as AVAILABLE. Add a member SELECT on
--   the SAME view_orders, scoped through the parent order's business_id (mirrors the owner
--   policy's join shape exactly — no new asymmetry). Re-scopes tech-debt #66 (it was filed as an
--   anon-visitor UX gap; it is NOT anon-only — a MANAGER hit it).
DROP POLICY IF EXISTS order_items_member ON order_items;
CREATE POLICY order_items_member ON order_items
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders o
      WHERE public.is_active_member(o.business_id)
        AND public.has_permission(o.business_id, 'view_orders')
    )
  );

-- ── GAP 3 (whole-family): order_service_selections + order_compliance_records ───────────────
--   ⚠️ SCOPE NOTE (flagged to David): the spec lists gaps #2/#3 as orders + order_items. The
--   20260709 migration's own guidance (lines 61-73, 213-248) is that member-read must be granted
--   to the WHOLE order-read family AT ONCE or it creates an asymmetry — a manager would see the
--   plant lines (order_items) but NOT the services/netting selected on the SAME order. The
--   PRINCIPLE (STD-020) makes that asymmetry a NEW layer-disagreement, the exact thing this build
--   exists to end. So the two remaining order-read children get the identical view_orders member
--   SELECT here. This is still purely ADDITIVE (new policies; no existing policy touched) and each
--   gets its own negative test. If David wants the family narrowed back to two tables, deleting
--   these two policies is trivial and isolated.
DROP POLICY IF EXISTS order_service_selections_member ON order_service_selections;
CREATE POLICY order_service_selections_member ON order_service_selections
  FOR SELECT
  TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders o
      WHERE public.is_active_member(o.business_id)
        AND public.has_permission(o.business_id, 'view_orders')
    )
  );

-- order_compliance_records carries its OWN business_id column (20260529_businesses_g), so gate
-- directly on it (no parent join needed).
DROP POLICY IF EXISTS order_compliance_records_member ON order_compliance_records;
CREATE POLICY order_compliance_records_member ON order_compliance_records
  FOR SELECT
  TO authenticated
  USING ( public.is_active_member(business_id)
          AND public.has_permission(business_id, 'view_orders') );

COMMIT;


-- ══════════════════════════════════════════════════════════════════════════════════════════
-- GAP 4: THE SALES-TAX RATE — a NARROW read, NOT a view_pricing_config grant.
--   The rate lives in business_pricing_config.config->>'taxRate' (D-40), a table gated by
--   view_pricing_config — a HARD WALL that (correctly, owner-only) protects the PRICING RECIPE:
--   cost basis, markup, margin floor. The SALES TAX RATE is not the recipe. It is printed on every
--   invoice and the customer reads it. It sits behind the wall only because it SHARES A TABLE.
--   So: build a SECURITY DEFINER function returning ONLY the tax rate — no recipe, no other column
--   — checking ACTIVE MEMBERSHIP, granted to authenticated. Same shape as tech-debt #66's proposed
--   lot_available(uuid): return the one value, no rows. A manager reading the tax rate can NOT read
--   margin/markup/cost basis (owner-test card #10 — the whole justification for the narrow read).
--
--   🔴 DO NOT grant managers view_pricing_config to solve this — that would hand over the recipe.
-- ══════════════════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_business_tax_rate(p_business_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
DECLARE
  v_raw  text;
  v_rate numeric;
BEGIN
  -- Membership gate — a non-member (or an inactive one) gets NULL, never a rate. This mirrors
  -- the "not identified" contract: to a caller with no access the answer is honestly "unknown".
  IF NOT public.is_active_member(p_business_id) THEN
    RETURN NULL;
  END IF;

  SELECT config->>'taxRate' INTO v_raw
  FROM public.business_pricing_config
  WHERE business_id = p_business_id;

  -- Same semantics as resolveTaxRate (tierPricing.ts): absent/empty/garbage/negative → NULL
  -- ("not identified"), never a fabricated default. Only a finite, >= 0 number is a real rate.
  IF v_raw IS NULL OR v_raw = '' THEN
    RETURN NULL;
  END IF;
  BEGIN
    v_rate := v_raw::numeric;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  IF v_rate < 0 THEN
    RETURN NULL;
  END IF;
  RETURN v_rate;
END;
$$;

REVOKE ALL ON FUNCTION public.get_business_tax_rate(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.get_business_tax_rate(uuid) TO authenticated;


-- ══════════════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run AFTER applying (uncomment). Read-only; catalog + isolation + NEGATIVES.
--
-- ✅ APPLIED + catalog-verified live by David 2026-07-24 (tenant f7ec5d67). All V1–V12 pass.
--    Observed: V6 manager tax rate = 0.0765 (the real rate) · V8 manager recipe rows = 0 ·
--    V9 non-member tax rate = NULL · V12 owner reads 24 orders / 10 offerings.
--
-- 🔧 HARNESS FIX 2026-07-24 (verify SQL only — the applied DDL above is unchanged): the shipped
--    V6/V9/V12 could not be run as-written in the Supabase SQL editor. V6/V9 used a psql client
--    variable (:'bid'), which the editor rejects; V12 impersonated 'david_obrien2016@outlook.com'
--    — the test CUSTOMER, not the owner (a query that authenticates as the wrong identity proves
--    nothing about what it claims). All three are rewritten EDITOR-NATIVE below: no client
--    variables, no hardcoded email — the tenant and every identity are resolved by role/owner
--    lookup (matching V4/V5/V7), and the OWNER is resolved exactly as the RLS resolves it
--    (businesses.owner_id — see 20260529_businesses_d:16). A temp table pins the tenant/identity
--    once, as postgres, before the role switch so the RLS'd body still sees a real business_id.
-- ══════════════════════════════════════════════════════════════════════════════════════════

-- (V1) STRUCTURE — each table now carries BOTH its owner policy and the new member policy.
-- SELECT tablename, policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('service_offerings','orders','order_items',
--                     'order_service_selections','order_compliance_records')
-- ORDER BY tablename, policyname;
-- EXPECTED: for each table, the pre-existing *_owner (ALL/SELECT) AND the new *_member (SELECT).

-- (V2) FUNCTION — the narrow tax read exists, is SECURITY DEFINER with an empty search_path, and
--       is executable by authenticated (not public).
-- SELECT p.proname, p.prosecdef AS security_definer, p.proconfig,
--        has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed_can_exec,
--        has_function_privilege('public',        p.oid, 'EXECUTE') AS public_can_exec
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'get_business_tax_rate';
-- EXPECTED: security_definer = true ; proconfig contains search_path= ; authed_can_exec = true ;
--           public_can_exec = false.

-- (V3) THE FUNCTION RETURNS THE RECIPE'S ONE VALUE — never the recipe. Confirm the source column
--       is config->>'taxRate' and nothing else leaves the function (read the body).
-- SELECT pg_get_functiondef('public.get_business_tax_rate(uuid)'::regprocedure);
-- EXPECTED: references business_pricing_config.config->>'taxRate' ONLY; no other config key.

-- ── POSITIVE PROOFS (the manager can now see) ───────────────────────────────────────────────

-- (V4) A MANAGER SEES ORDERS + THE ROSTER COUNT (gaps #2/#3). Impersonate an active manager who
--      holds view_orders inside a rolled-back txn.
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--     json_build_object('sub',
--       (SELECT bm.user_id FROM public.business_members bm
--        WHERE bm.role = 'MANAGER' AND bm.active = true
--          AND bm.permissions ? 'view_orders' LIMIT 1))::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) AS manager_orders          FROM orders;                    -- EXPECTED: > 0
--   SELECT count(*) AS manager_order_lines      FROM order_items;               -- EXPECTED: > 0
--   SELECT count(*) AS manager_service_lines    FROM order_service_selections;  -- EXPECTED: >= 0
--   RESET ROLE;
-- ROLLBACK;

-- (V5) A MANAGER SEES THE SELL-SIDE CATALOG (gap #1) — netting/transport/add-ons.
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--     json_build_object('sub',
--       (SELECT bm.user_id FROM public.business_members bm
--        WHERE bm.role = 'MANAGER' AND bm.active = true LIMIT 1))::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) AS manager_offerings FROM service_offerings;  -- EXPECTED: > 0 (LAWNS seeds 4)
--   RESET ROLE;
-- ROLLBACK;

-- (V6) A MANAGER READS THE TAX RATE via the narrow function (gap #4). Editor-native: the tenant
--      business_id is resolved by role lookup into a temp table (as postgres, before the role
--      switch), so no :'bid' client variable is needed.
-- BEGIN;
--   CREATE TEMP TABLE _mgr ON COMMIT DROP AS
--     SELECT bm.user_id, bm.business_id
--     FROM public.business_members bm
--     WHERE bm.role = 'MANAGER' AND bm.active = true AND bm.permissions ? 'view_orders'
--     LIMIT 1;
--   SELECT set_config('request.jwt.claims',
--     json_build_object('sub', (SELECT user_id FROM _mgr))::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT public.get_business_tax_rate((SELECT business_id FROM _mgr)) AS manager_tax_rate;
--     -- EXPECTED: the real rate, NOT null (David 2026-07-24, tenant f7ec5d67: 0.0765)
--   RESET ROLE;
-- ROLLBACK;

-- ── NEGATIVE PROOFS (the wall still holds — an expansion is unproven without these) ─────────

-- (V7) DEFAULT-DENY on the order-read family: an active STAFF member WITHOUT view_orders sees
--      ZERO across the whole family. This is the negative twin of V4/V5's orders.
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--     json_build_object('sub',
--       (SELECT bm.user_id FROM public.business_members bm
--        WHERE bm.role = 'STAFF' AND bm.active = true
--          AND NOT (bm.permissions ? 'view_orders') LIMIT 1))::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) AS staff_orders       FROM orders;                    -- EXPECTED: 0
--   SELECT count(*) AS staff_order_lines   FROM order_items;               -- EXPECTED: 0
--   SELECT count(*) AS staff_service_lines FROM order_service_selections;  -- EXPECTED: 0
--   RESET ROLE;
-- ROLLBACK;

-- (V8) THE PRICING RECIPE IS STILL WALLED (owner-test card #10). A manager reading the tax rate
--      can NOT read business_pricing_config directly — margin/markup/cost basis stay owner-only.
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--     json_build_object('sub',
--       (SELECT bm.user_id FROM public.business_members bm
--        WHERE bm.role = 'MANAGER' AND bm.active = true LIMIT 1))::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) AS manager_recipe_rows FROM business_pricing_config;  -- EXPECTED: 0 (RLS-walled)
--   RESET ROLE;
-- ROLLBACK;

-- (V9) NON-MEMBER gets NO tax rate from the narrow read (negative twin of V6, owner-test card #6).
--      Editor-native: the tenant is pinned in a temp table (as postgres) so the non-member is
--      still tested against a REAL business they are not a member of — not a degenerate NULL bid.
-- BEGIN;
--   CREATE TEMP TABLE _tenant ON COMMIT DROP AS
--     SELECT bm.business_id
--     FROM public.business_members bm
--     WHERE bm.role = 'MANAGER' AND bm.active = true AND bm.permissions ? 'view_orders'
--     LIMIT 1;
--   SELECT set_config('request.jwt.claims',
--     json_build_object('sub',
--       (SELECT u.id FROM auth.users u
--        WHERE u.id NOT IN (SELECT user_id FROM public.business_members
--                           WHERE business_id = (SELECT business_id FROM _tenant))
--        LIMIT 1))::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT public.get_business_tax_rate((SELECT business_id FROM _tenant)) AS nonmember_tax_rate;
--     -- EXPECTED: NULL (David 2026-07-24: NULL)
--   RESET ROLE;
-- ROLLBACK;

-- (V10) TENANT ISOLATION (AC-3) on the order family — a manager sees ONLY their own tenant's
--       orders, never another business's. Every visible order belongs to a business the caller
--       is an active member of.
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--     json_build_object('sub',
--       (SELECT bm.user_id FROM public.business_members bm
--        WHERE bm.role = 'MANAGER' AND bm.active = true
--          AND bm.permissions ? 'view_orders' LIMIT 1))::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) AS cross_tenant_orders_visible
--   FROM orders o WHERE NOT public.is_active_member(o.business_id);  -- EXPECTED: 0
--   RESET ROLE;
-- ROLLBACK;

-- (V11) TENANT ISOLATION (AC-3) on the catalog — a manager sees ONLY their own tenant's offerings.
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--     json_build_object('sub',
--       (SELECT bm.user_id FROM public.business_members bm
--        WHERE bm.role = 'MANAGER' AND bm.active = true LIMIT 1))::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) AS cross_tenant_offerings_visible
--   FROM service_offerings s WHERE NOT public.is_active_member(s.business_id);  -- EXPECTED: 0
--   RESET ROLE;
-- ROLLBACK;

-- (V12) THE OWNER IS UNCHANGED — the owner still reads their whole order family + catalog exactly
--       as before (no regression from the additive member policies). The OWNER is resolved exactly
--       as the RLS resolves it — businesses.owner_id for the manager's tenant (20260529_businesses_d:16)
--       — NOT a hardcoded email. (The prior 'david_obrien2016@outlook.com' was the test CUSTOMER, so
--       the shipped V12 authenticated as the wrong identity and returned 0/0.)
-- BEGIN;
--   CREATE TEMP TABLE _owner ON COMMIT DROP AS
--     SELECT b.owner_id AS uid
--     FROM public.businesses b
--     WHERE b.id = (SELECT bm.business_id FROM public.business_members bm
--                   WHERE bm.role = 'MANAGER' AND bm.active = true LIMIT 1);
--   SELECT set_config('request.jwt.claims',
--     json_build_object('sub', (SELECT uid FROM _owner))::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) AS owner_orders FROM orders;                 -- EXPECTED: unchanged (David 2026-07-24: 24)
--   SELECT count(*) AS owner_offerings FROM service_offerings;   -- EXPECTED: unchanged (David 2026-07-24: 10)
--   RESET ROLE;
-- ROLLBACK;
