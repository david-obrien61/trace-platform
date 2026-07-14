-- Migration: order_items (+ order_addons) RLS — retired nursery model → business_id model
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-07-09
-- Decision: D-36 follow-up · Story #231 (order display root cause)
--
-- ⚠️ GATED — David applies this in the Supabase SQL editor as the default `postgres`
--    role. NOT applied by the builder. Review, then apply. This is a TENANT-ISOLATION
--    change (RLS) — the careful category. Verification + an isolation proof are embedded
--    at the bottom (commented; uncomment and run after apply).
--
-- NEVER EDIT APPLIED MIGRATIONS. This appends; it does not touch 20260528.
--
-- ── ROOT CAUSE (the TRUE root cause of the recurring "PLANTS (0)" bug) ───────────
--   order_items' ONLY RLS policy is still `authenticated_select_order_items`
--   (20260528_per_tenant_rls_isolation.sql:119-129), which filters through the
--   RETIRED nurseries model:
--
--       order_id IN (
--         SELECT id FROM orders
--         WHERE nursery_id IN (SELECT id FROM nurseries WHERE owner_id = auth.uid())
--       )
--
--   But `orders.nursery_id` was DROPPED in 20260529_businesses_e_cleanup.sql:13 —
--   modern orders carry `business_id`, and nursery_id is gone. So for every modern
--   order the inner `WHERE nursery_id IN (...)` matches NOTHING → the policy returns
--   ZERO rows → the authenticated owner's own order lines are silently filtered out.
--   The frontend query succeeds (200) but returns [] → the OrderDetail line-item block
--   renders "PLANTS (0)" even though the stored subtotal includes the plant cost.
--
--   This is NOT the plant_id issue (D-36 dropped order_items.plant_id, a correct AC-1
--   fix, but a DIFFERENT problem — the line anchor). This is the RLS visibility gate,
--   still wired to the dead nurseries table.
--
-- ── WHY SERVICES SHOW BUT PLANTS DON'T (the decisive evidence) ──────────────────
--   The sibling child table `order_service_selections` was created on the MODERN model
--   from day one — `order_service_selections_owner`
--   (20260529_businesses_f_service_offerings.sql:78-84) joins through
--   orders.business_id → businesses.owner_id. So in the same OrderDetail read, services
--   return rows (correct business_id join) while order_items returns [] (dead nursery_id
--   join). The asymmetry IS the fingerprint of a stale-model policy on order_items.
--
--   Parent `orders` (orders_business_owner, 20260529_businesses_d_update_rls.sql:15-16)
--   is already on business_id → that is why the order header + services load for the
--   owner; only the two child tables below were left behind on 20260528.
--
-- ── THE FIX ─────────────────────────────────────────────────────────────────────
--   Replace order_items' stale nursery-model SELECT policy with a policy that MIRRORS
--   the proven, co-read sibling `order_service_selections_owner` exactly: owner-scoped
--   via orders.business_id → businesses.owner_id, FOR ALL. This makes order_items'
--   visibility IDENTICAL to order_service_selections and to the parent orders row — no
--   new asymmetry, the bug closed at the source.
--
--   order_addons carries the IDENTICAL stale nursery-join (20260528:137-146) and is the
--   only other BROKEN-NOW table found in the stale-RLS audit
--   (docs/decisions/2026-07-09-stale-nursery-rls-audit.md). It is a LEGACY table
--   (superseded by order_service_selections for new orders) so its live-read impact is
--   low, but the broken policy is the same class → fixed here in one pass (fix-all-in-
--   one-pass, §1.6). Guarded with to_regclass in case the legacy table was already
--   dropped, so a missing table can never abort this migration (the 20260622 lesson).
--
-- ── OWNER vs MEMBER axis (a finding — see the report / audit doc) ────────────────
--   This migration keeps order_items OWNER-ONLY, mirroring its sibling. The prompt's
--   premise "if services allows members" does NOT hold: order_service_selections and
--   the parent `orders` are BOTH owner-only (no member policy). The whole order-read
--   family is owner-only by the deliberate deferral in
--   20260622_is_active_member_canonical_rls.sql:268-274 ("Granting Staff member-read is
--   a PRODUCT decision … Left owner-only → NEXT hardening pass"). Adding a member policy
--   to order_items ALONE would create a NEW asymmetry (a staff session would see plant
--   lines but not the order or the services). So member-read is intentionally NOT added
--   here; if wanted it is a WHOLE-FAMILY change (orders + order_items +
--   order_service_selections + order_compliance_records together, using is_active_member
--   for the member axis). A ready, clearly-fenced, DO-NOT-APPLY-IN-ISOLATION block for
--   that decision is included at the very bottom, commented out.
--
-- ── WRITE PATH (confirmed — NOT affected by this or the stale model) ─────────────
--   order_items has NO write policy at all (never did). All order writes — including the
--   #100 CRUD edit/delete via submit.ts action=update|delete — go through the
--   SERVICE KEY, which BYPASSES RLS entirely (handoff: "ALL order writes go through the
--   service-key submit.ts; no anon INSERT/UPDATE/DELETE policy"). So edit/delete were
--   NEVER blocked by the stale model — the nursery-join only ever gated authenticated
--   frontend SELECTs. This fix is a SELECT-visibility fix. The new FOR ALL policy adds a
--   USING clause (covering an owner's own UPDATE/DELETE targeting), matching the sibling;
--   with no WITH CHECK, direct authenticated INSERT stays blocked (writes = service key),
--   exactly like order_service_selections. No CRUD regression is possible.
--
-- AC-2 (business_id-scoped) · AC-3 (tenant isolation absolute — proof embedded below).

BEGIN;

-- ── PART 1: order_items — replace the stale nursery-model SELECT policy ──────────
-- RLS already enabled (20260528:117); ENABLE is idempotent + defensive.
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_order_items" ON order_items;  -- the stale nursery-join
DROP POLICY IF EXISTS order_items_owner ON order_items;                   -- defensive (re-run safety)

-- Mirrors order_service_selections_owner (20260529_businesses_f:78-84) exactly.
CREATE POLICY order_items_owner ON order_items
  FOR ALL
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
    )
  );

-- ── PART 1b: order_addons — same stale join (BROKEN-NOW, legacy). Guarded. ───────
-- Superseded by order_service_selections for new orders; fixed for consistency + any
-- historical reads. Guard: no-op if the legacy table was already dropped.
DO $$
BEGIN
  IF to_regclass('public.order_addons') IS NOT NULL THEN
    DROP POLICY IF EXISTS "authenticated_select_order_addons" ON order_addons;
    DROP POLICY IF EXISTS order_addons_owner ON order_addons;
    CREATE POLICY order_addons_owner ON order_addons
      FOR ALL
      USING (
        order_id IN (
          SELECT id FROM orders
          WHERE business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
        )
      );
  END IF;
END $$;

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run AFTER applying (uncomment). Read-only; catalog + isolation.
-- ═══════════════════════════════════════════════════════════════════════════════

-- (A) STRUCTURE — order_items now has exactly the business-model owner policy, and the
--     stale nursery policy is GONE. Confirm the predicate references businesses/business_id
--     and does NOT reference nurseries/nursery_id.
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'order_items'
-- ORDER BY policyname;
-- EXPECTED: one row — order_items_owner | ALL | (... orders ... business_id ... businesses ... owner_id ...)
-- ABSENT:   authenticated_select_order_items ; NO 'nursery' substring anywhere in qual.

-- (B) No stale nursery-model policy survives on EITHER order child.
-- SELECT tablename, policyname, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('order_items','order_addons')
--   AND (qual ILIKE '%nurser%');
-- EXPECTED: 0 rows.

-- (C) TENANT-ISOLATION PROOF (the AC-3 standard) — self-contained, read-only.
--     Proves (a) the owner SEES his own order lines (the fix works) and (b) he does NOT
--     see any other business's order lines (isolation intact). Impersonates David's
--     authenticated session via the JWT `sub` claim, inside a rolled-back transaction.
--
--     Run this whole block as postgres, then it ROLLBACKs — nothing is written.
--
-- BEGIN;
--   -- Baseline as postgres (RLS bypassed): how many order_items rows exist in total,
--   -- and how many belong to David's business(es).
--   SELECT count(*) AS total_all_tenants FROM order_items;
--   SELECT count(*) AS davids_business_lines
--   FROM order_items oi
--   JOIN orders o ON o.id = oi.order_id
--   WHERE o.business_id IN (
--     SELECT b.id FROM businesses b
--     JOIN auth.users u ON u.id = b.owner_id
--     WHERE u.email = 'david_obrien2016@outlook.com'
--   );
--
--   -- Spot-check the specific order from the bug report (Shoal Creek Vitex ×4 + Live Oak ×2).
--   SELECT count(*) AS order_0d1e4110_lines
--   FROM order_items WHERE order_id::text LIKE '0d1e4110%';
--   -- EXPECTED: 2 (the two plant lines that were rendering as "PLANTS (0)").
--
--   -- Impersonate David as an authenticated user (RLS now enforced against auth.uid()).
--   SELECT set_config(
--     'request.jwt.claims',
--     json_build_object('sub',
--       (SELECT u.id FROM auth.users u WHERE u.email = 'david_obrien2016@outlook.com')
--     )::text,
--     true  -- local to this transaction
--   );
--   SET LOCAL ROLE authenticated;
--
--   -- (a) THE FIX: David now SEES his own order lines under RLS.
--   SELECT count(*) AS owner_visible_lines FROM order_items;
--   -- EXPECTED: owner_visible_lines == davids_business_lines  (he sees ALL of his own).
--
--   -- (a') and the specific bug order returns its lines under RLS (not 0).
--   SELECT count(*) AS order_0d1e4110_visible
--   FROM order_items WHERE order_id::text LIKE '0d1e4110%';
--   -- EXPECTED: 2  (was 0 before this migration — the bug closed).
--
--   -- (b) ISOLATION: David sees ONLY his own — never another business's lines.
--   SELECT count(*) AS other_tenant_lines_visible
--   FROM order_items oi
--   WHERE oi.order_id IN (
--     SELECT id FROM orders o
--     WHERE o.business_id NOT IN (
--       SELECT b.id FROM businesses b WHERE b.owner_id = auth.uid()
--     )
--   );
--   -- EXPECTED: 0  (cross-tenant rows are filtered — AC-3 holds).
--   -- Corollary: owner_visible_lines <= total_all_tenants; strictly < when another
--   -- tenant has any order lines (proves the filter is doing work, not vacuous).
--
--   RESET ROLE;
-- ROLLBACK;


-- ═══════════════════════════════════════════════════════════════════════════════
-- OPTIONAL — member-read for the order-read family. ⚠️ DO NOT APPLY IN ISOLATION.
-- ═══════════════════════════════════════════════════════════════════════════════
-- This is the deferred "NEXT hardening pass" from 20260622:268-274 — a PRODUCT decision,
-- not part of the bug fix. Member-read must be granted to the WHOLE order-read family at
-- once (orders + order_items + order_service_selections + order_compliance_records) or it
-- creates asymmetry. The member axis uses the canonical is_active_member() primitive
-- (owners are covered by the owner-join above; is_active_member does not cover owners).
-- Do NOT paste just one of these. Bring the whole block to a deliberate decision first.
--
-- DROP POLICY IF EXISTS orders_member_select ON orders;
-- CREATE POLICY orders_member_select ON orders
--   FOR SELECT TO authenticated
--   USING ( public.is_active_member(business_id) );
--
-- DROP POLICY IF EXISTS order_items_member ON order_items;
-- CREATE POLICY order_items_member ON order_items
--   FOR SELECT TO authenticated
--   USING (
--     order_id IN (
--       SELECT id FROM orders WHERE public.is_active_member(business_id)
--     )
--   );
--
-- DROP POLICY IF EXISTS order_service_selections_member ON order_service_selections;
-- CREATE POLICY order_service_selections_member ON order_service_selections
--   FOR SELECT TO authenticated
--   USING (
--     order_id IN (
--       SELECT id FROM orders WHERE public.is_active_member(business_id)
--     )
--   );
--
-- DROP POLICY IF EXISTS order_compliance_records_member ON order_compliance_records;
-- CREATE POLICY order_compliance_records_member ON order_compliance_records
--   FOR SELECT TO authenticated
--   USING ( public.is_active_member(business_id) );
