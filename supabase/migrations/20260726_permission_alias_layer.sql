-- ════════════════════════════════════════════════════════════════════════════════
-- 20260726 — THE PERMISSION ALIAS LAYER (Phase 0 of the resource:action RBAC refit)
-- ════════════════════════════════════════════════════════════════════════════════
-- SPEC:  docs/resource-action-permission-spec.md (v3, 2026-07-26 — David's rulings R1–R9), §8.
-- PLAN:  docs/decisions/2026-07-26-rbac-build-plan.md §2 (the map this seeds), §8 (the perf
--        requirement), SEQUENCE Phase 0.
-- SOURCE OF TRUTH FOR THE SEED: packages/shared/src/auth/permissionManifest.ts → ALIAS_PAIRS.
--        The 92 rows below were GENERATED from that register. If the two ever disagree, the
--        TypeScript register is the source and this file is wrong.
--
-- WHAT THIS DOES, IN ONE PARAGRAPH
--   During the migration, has_permission(biz,'inventory:read') returns true if the member holds
--   the NEW string OR a LEGACY string that implies it (view_costs) — and the reverse. Old and new
--   strings mutually satisfy each other's checks. Because of that, the ORDER of the two writes
--   (flip policies / backfill member rows) does not matter: can(X) returns exactly what the model
--   intends at every instant, under whichever vocabulary that member currently holds. A tenant
--   mid-backfill is fully functional. This is what makes Phases 1–6 order-independent and
--   reversible; the only irreversible step is CONTRACT (Phase 7), which drops these rows.
--
-- ⚠️ THIS MIGRATION FLIPS NO GATE AND GRANTS NO MEMBER ANYTHING NEW TODAY.
--   Every policy still checks the string it checked yesterday, and no member array changes. The
--   ONLY behavioral delta is that has_permission now also accepts an equivalent string — and no
--   member holds one yet (the backfill is Phase 6). Phase 0 is neutral by construction.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 THE WIDENING, AND THE TWO INVARIANTS THAT CLOSE IT — READ BEFORE CHANGING ANYTHING
-- ════════════════════════════════════════════════════════════════════════════════
-- Reverse resolution on a 1→many split is a REAL, TEMPORARY WIDENING. `view_costs` decomposes
-- into 14 strings; seeding both directions means a holder of `inventory:read` satisfies a
-- `view_costs` policy — which during the window also admits cost_objects / receipts. That is
-- what "mutually satisfy each other's checks" costs, and it is accepted deliberately (David,
-- 2026-07-26) because it is what makes the migration order-independent.
--
-- WHAT CLOSES IT IS TWO INVARIANTS, AND BOTH MUST HOLD:
--
--   (i)  BACKFILL IS RENAME-ONLY (R-A). Every member is re-materialized to the decomposition of
--        EXACTLY what their array already holds. NO BUNDLE SEEDING. The MANAGER/STAFF default
--        bundles seed FRESH roles; they are NOT migration targets. Live STAFF holds no
--        inventory:read while the bundle contains it — seeding bundles into this tenant would
--        GRANT that string, and the reverse alias would then carry it into every view_costs
--        policy. A member can only reach a legacy gate through a string they already had.
--
--   (ii) ALL CAPABILITY FLIPS (Phases 1–5) COMPLETE BEFORE BACKFILL (Phase 6). Once every gate
--        checks the new vocabulary, no legacy policy survives for the reverse direction to
--        resolve INTO. The widening has no target left to exploit before the rows are dropped.
--
-- ⚠️ ANYONE LATER SEEDING DEFAULT BUNDLES INTO AN EXISTING TENANT BREAKS (i) AND REOPENS THIS.
--   That is why this note lives on the TABLE (COMMENT ON TABLE, below) and not only in a doc:
--   the next person to touch this reads it where they are standing.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- PERFORMANCE — A BUILD REQUIREMENT, NOT A NOTE (spec §8, antigravity)
-- ════════════════════════════════════════════════════════════════════════════════
-- has_permission is called PER ROW inside RLS USING clauses (thousands of rows on the inventory
-- grid). The shape below is chosen for that, and the reasoning is recorded so a later edit does
-- not casually undo it:
--
--   1. THE DIRECT CONTAINMENT TEST COMES FIRST. `permissions ? p_perm OR permissions ?| (…)`.
--      The left operand is the pre-existing test and is nearly free; the planner evaluates it
--      first and skips the SubPlan when it is true. TODAY EVERY MEMBER HOLDS LEGACY STRINGS AND
--      EVERY POLICY CHECKS LEGACY STRINGS — so the direct test hits and the alias lookup never
--      runs. The regression on the live inventory grid is therefore ~zero, by construction, not
--      by hope. (Postgres does not GUARANTEE OR short-circuit order; correctness does not depend
--      on it, only speed. The measured proof is DAVID-QUERY 3.)
--
--   2. ARRAY EXPANSION, NOT A CORRELATED SUBQUERY PER ROW. The alias set is resolved as a single
--      `?|` against an aggregated text[]. The subquery references ONLY the function parameter —
--      never a column of the outer row — so it is uncorrelated and the planner runs it as an
--      InitPlan/SubPlan on the parameter, not once per candidate row.
--
--   3. THE FUNCTION STAYS `LANGUAGE sql` + `STABLE` + `SET search_path = ''`, exactly as before.
--      (SECURITY DEFINER functions are not inlined by Postgres — that was already true of
--      has_permission, so this changes nothing about the call shape; it adds at most one indexed
--      lookup on a ~92-row table, and only on the miss path.)
--
--   4. `permission_aliases(from_perm)` IS INDEXED. See idx_permission_aliases_from.
--
-- A MEASURABLE REGRESSION ON THE INVENTORY GRID IS A PHASE 0 EXIT-GATE FAILURE, not a follow-up
-- ticket. DAVID-QUERY 3 (bottom of this file) measures it before/after with EXPLAIN ANALYZE.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres (Supabase SQL editor, project bgobkjcopcxusjsetfob).
-- Then run the DAVID-QUERY blocks at the bottom. The verifies are commented out so this file
-- applies clean; uncomment and run them one at a time.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- §1 — THE TABLE
-- ════════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.permission_aliases (
  from_perm    text NOT NULL,
  implies_perm text NOT NULL,
  PRIMARY KEY (from_perm, implies_perm)
);

-- The lookup index the resolver rides. The PK's leading column is from_perm and would serve,
-- but the plan names this index explicitly as a build requirement — so it is explicit, and a
-- later PK change cannot silently remove it.
CREATE INDEX IF NOT EXISTS idx_permission_aliases_from
  ON public.permission_aliases (from_perm);

COMMENT ON TABLE public.permission_aliases IS
  'Migration-window equivalence between the legacy permission vocabulary and resource:verb '
  '(spec v3 §8). Seeded BOTH DIRECTIONS from permissionManifest.ts ALIAS_PAIRS. '
  '⚠️ REVERSE RESOLUTION ON A 1→many SPLIT IS A REAL, TEMPORARY WIDENING: a holder of '
  'inventory:read satisfies a view_costs policy, which during the window also admits '
  'cost_objects/receipts. TWO INVARIANTS CLOSE IT AND BOTH MUST HOLD: (i) BACKFILL IS '
  'RENAME-ONLY — no member receives a string whose legacy antecedent they did not already hold; '
  'NO BUNDLE SEEDING (the MANAGER/STAFF bundles seed FRESH roles, they are not migration '
  'targets). (ii) ALL CAPABILITY FLIPS (Phases 1-5) COMPLETE BEFORE BACKFILL (Phase 6), so no '
  'legacy policy survives for the reverse direction to resolve into. ANYONE SEEDING DEFAULT '
  'BUNDLES INTO AN EXISTING TENANT BREAKS (i) AND REOPENS THIS. Dropped at Phase 7 CONTRACT, '
  'behind two zero-checks.';

-- RLS: this is reference data the resolver reads under SECURITY DEFINER (which bypasses RLS).
-- No client ever needs it, so nothing is granted to authenticated — the table is closed.
ALTER TABLE public.permission_aliases ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.permission_aliases FROM public, authenticated, anon;

-- ════════════════════════════════════════════════════════════════════════════════
-- §2 — THE SEED — 92 rows = 46 mappings × 2 directions
-- ════════════════════════════════════════════════════════════════════════════════
-- Generated from permissionManifest.ts ALIAS_PAIRS. Grouped by legacy string for review.
--
-- ARITHMETIC (build-plan §2 says "19 entries, all accounted for" — here is the reconciliation):
--   19 rows in §2  =  16 MAPPABLE  +  3 that produce NO alias pair, by construction:
--     · view_dashboard — RETIRE (R3). Folds into is_active_member; grants nothing a member
--       lacks. There is no resource:verb on the other side to alias TO.
--     · view_reports   — RETIRE. No live surface consumes it. Same reason.
--     · owner-only     — NOT A PERMISSION. A route sentinel resolved from businesses.owner_id.
--   These three are named exclusions, not dropped rows.
--
--   PLUS TWO STRINGS §2 MISSED ENTIRELY — found 2026-07-26 by grepping DATA, not code:
--     · process_orders · manage_team
--   Both are in LIVE member arrays (minted at SignUp.tsx:34 / AddBusiness.tsx:23) and are READ
--   BY NOTHING: zero hits across migrations, router.tsx, tileRegistry.ts, the api layer and
--   packages/shared/src. They gate nothing, so they get NO alias row — they are STRIPPED at
--   backfill (R-B, "unmapped" class). §2's inventory was built from code and never checked
--   against data; this is that gap, closed.
--   ⚠️ The two mint sites still inject them (and the retired view_reports). Phase 7's
--   zero-check cannot stay green until those literals read the resolved floor, as
--   Settings.tsx / OnboardingWizard.tsx already do (#152).

INSERT INTO public.permission_aliases (from_perm, implies_perm) VALUES
  -- qr_checkout (rename, 1 replacement)
  ('qr_checkout', 'orders:create'),
  ('orders:create', 'qr_checkout'),
  -- view_orders (split, 4 replacements)
  ('view_orders', 'orders:read'),
  ('orders:read', 'view_orders'),
  ('view_orders', 'order_items:read'),
  ('order_items:read', 'view_orders'),
  ('view_orders', 'order_service_selections:read'),
  ('order_service_selections:read', 'view_orders'),
  ('view_orders', 'order_compliance_records:read'),
  ('order_compliance_records:read', 'view_orders'),
  -- manage_orders (split, 2 replacements)
  ('manage_orders', 'orders:update'),
  ('orders:update', 'manage_orders'),
  ('manage_orders', 'orders:delete'),
  ('orders:delete', 'manage_orders'),
  -- manage_deliveries (split, 4 replacements)
  ('manage_deliveries', 'deliveries:read'),
  ('deliveries:read', 'manage_deliveries'),
  ('manage_deliveries', 'deliveries:update'),
  ('deliveries:update', 'manage_deliveries'),
  ('manage_deliveries', 'deliveries.route:read'),
  ('deliveries.route:read', 'manage_deliveries'),
  ('manage_deliveries', 'deliveries.route:update'),
  ('deliveries.route:update', 'manage_deliveries'),
  -- manage_customers (split, 2 replacements)
  ('manage_customers', 'customers:create'),
  ('customers:create', 'manage_customers'),
  ('manage_customers', 'customers:update'),
  ('customers:update', 'manage_customers'),
  -- view_customers (rename, 1 replacement)
  ('view_customers', 'customers:read'),
  ('customers:read', 'view_customers'),
  -- manage_campaigns (split, 2 replacements)
  ('manage_campaigns', 'campaigns:read'),
  ('campaigns:read', 'manage_campaigns'),
  ('manage_campaigns', 'campaigns:update'),
  ('campaigns:update', 'manage_campaigns'),
  -- manage_settings (split, 5 replacements)
  ('manage_settings', 'settings:read'),
  ('settings:read', 'manage_settings'),
  ('manage_settings', 'settings:update'),
  ('settings:update', 'manage_settings'),
  ('manage_settings', 'team:read'),
  ('team:read', 'manage_settings'),
  ('manage_settings', 'team:update'),
  ('team:update', 'manage_settings'),
  ('manage_settings', 'pricing_recipe:update'),
  ('pricing_recipe:update', 'manage_settings'),
  -- view_costs (split, 14 replacements)
  ('view_costs', 'inventory:read'),
  ('inventory:read', 'view_costs'),
  ('view_costs', 'inventory:create'),
  ('inventory:create', 'view_costs'),
  ('view_costs', 'inventory:update'),
  ('inventory:update', 'view_costs'),
  ('view_costs', 'inventory:delete'),
  ('inventory:delete', 'view_costs'),
  ('view_costs', 'costs:read'),
  ('costs:read', 'view_costs'),
  ('view_costs', 'costs:create'),
  ('costs:create', 'view_costs'),
  ('view_costs', 'costs:update'),
  ('costs:update', 'view_costs'),
  ('view_costs', 'costs:delete'),
  ('costs:delete', 'view_costs'),
  ('view_costs', 'inventory_ledger:read'),
  ('inventory_ledger:read', 'view_costs'),
  ('view_costs', 'assets:read'),
  ('assets:read', 'view_costs'),
  ('view_costs', 'assets:create'),
  ('assets:create', 'view_costs'),
  ('view_costs', 'assets:update'),
  ('assets:update', 'view_costs'),
  ('view_costs', 'pmi:read'),
  ('pmi:read', 'view_costs'),
  ('view_costs', 'pmi:update'),
  ('pmi:update', 'view_costs'),
  -- view_pricing_config (split, 2 replacements)
  ('view_pricing_config', 'pricing_recipe:read'),
  ('pricing_recipe:read', 'view_pricing_config'),
  ('view_pricing_config', 'pricing_recipe:update'),
  ('pricing_recipe:update', 'view_pricing_config'),
  -- view_wages (split, 4 replacements)
  ('view_wages', 'wages:read'),
  ('wages:read', 'view_wages'),
  ('view_wages', 'wages:create'),
  ('wages:create', 'view_wages'),
  ('view_wages', 'wages:update'),
  ('wages:update', 'view_wages'),
  ('view_wages', 'wages:delete'),
  ('wages:delete', 'view_wages'),
  -- view_margin (rename, 1 replacement)
  ('view_margin', 'margin:read'),
  ('margin:read', 'view_margin'),
  -- override_maintenance (rename, 1 replacement)
  ('override_maintenance', 'maintenance:override'),
  ('maintenance:override', 'override_maintenance'),
  -- apply_tax_exempt (rename, 1 replacement)
  ('apply_tax_exempt', 'tax_exempt:apply'),
  ('tax_exempt:apply', 'apply_tax_exempt'),
  -- apply_discount (rename, 1 replacement)
  ('apply_discount', 'order_discount:apply'),
  ('order_discount:apply', 'apply_discount'),
  -- import_pricing (rename, 1 replacement)
  ('import_pricing', 'inventory:import_price'),
  ('inventory:import_price', 'import_pricing')
ON CONFLICT (from_perm, implies_perm) DO NOTHING;

-- ════════════════════════════════════════════════════════════════════════════════
-- §3 — THE RESOLVER — has_permission, alias-aware
-- ════════════════════════════════════════════════════════════════════════════════
-- UNCHANGED from 20260622 except the permission test. Still SECURITY DEFINER + STABLE +
-- search_path='' + owned by postgres (bypasses RLS, recursion-safe), still implies active
-- membership on the same row. EXECUTE still granted only to authenticated.
CREATE OR REPLACE FUNCTION public.has_permission(p_business_id uuid, p_perm text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.business_members
    WHERE business_id = p_business_id
      AND user_id = auth.uid()
      AND active = true
      AND (
        -- 1. the direct test — the pre-existing behavior, evaluated first and nearly free
        permissions ? p_perm
        -- 2. the alias expansion — one indexed lookup on a parameter-only (uncorrelated)
        --    subquery, aggregated to a text[] and tested with ?| in ONE operation.
        OR permissions ?| COALESCE(
             (SELECT array_agg(a.implies_perm)
                FROM public.permission_aliases a
               WHERE a.from_perm = p_perm),
             ARRAY[]::text[]
           )
      )
  );
$$;

REVOKE ALL ON FUNCTION public.has_permission(uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;

COMMENT ON FUNCTION public.has_permission(uuid, text) IS
  'TRUE iff the caller has an ACTIVE membership in p_business_id whose permissions array '
  'contains p_perm OR any string aliased to it (public.permission_aliases, spec v3 §8). The '
  'direct containment test is evaluated FIRST so the alias lookup is skipped on the hit path.';

-- ── has_permission_for — the PASSED-ACTOR analog (20260723) ─────────────────────────────────
-- ⚠️ DELIBERATE DIVERGENCE PRESERVED, NOT INTRODUCED HERE: this function is OWNER-INCLUSIVE
-- (has_permission is not). An owner may carry no member row at all, and import_pricing defaults
-- to the owner — see the 20260723 header for the full reasoning. Only the member branch gains
-- the alias test; the owner branch is untouched.
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
    -- a member is authorized if the grant, or a string aliased to it, is in their array
    OR EXISTS (SELECT 1 FROM public.business_members
                WHERE business_id = p_business_id AND user_id = p_user_id
                  AND active = true
                  AND (
                    permissions ? p_perm
                    OR permissions ?| COALESCE(
                         (SELECT array_agg(a.implies_perm)
                            FROM public.permission_aliases a
                           WHERE a.from_perm = p_perm),
                         ARRAY[]::text[]
                       )
                  ))
  );
$$;

REVOKE ALL ON FUNCTION public.has_permission_for(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_permission_for(uuid, uuid, text) TO authenticated, service_role;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════
-- DAVID-QUERY VERIFIES — run AFTER applying. Uncomment one block at a time.
-- ════════════════════════════════════════════════════════════════════════════════
-- These are the Phase 0 exit gate. Thunder cannot run them (no service key, and the
-- source-based verifier has no DB connection) — the "is it actually applied in this database"
-- half is yours, using the same pg_policies proof the 20260724 migration used.

-- ── V1 — the seed landed, and the arithmetic reconciles ──────────────────────────────────────
-- EXPECT: total 92 · distinct_from 61 · legacy_sources 16
--   92 = 46 mappings × 2 directions. 61 = 16 legacy sources + 45 DISTINCT resource:verb sources
--   (46 replacements, but `pricing_recipe:update` is the replacement of BOTH manage_settings and
--   view_pricing_config, so it is one from_perm carrying two rows).
-- SELECT count(*) AS total,
--        count(DISTINCT from_perm) AS distinct_from,
--        count(DISTINCT from_perm) FILTER (WHERE from_perm NOT LIKE '%:%') AS legacy_sources
--   FROM public.permission_aliases;

-- ── V2 — every pair has its mirror (both directions, no orphan edge) ─────────────────────────
-- EXPECT: 0 rows. Any row returned is a one-way alias — the migration-ordering hole §8 closes.
-- SELECT a.from_perm, a.implies_perm
--   FROM public.permission_aliases a
--  WHERE NOT EXISTS (SELECT 1 FROM public.permission_aliases b
--                     WHERE b.from_perm = a.implies_perm AND b.implies_perm = a.from_perm);

-- ── V3 — THE UNMINTABLE FIVE APPEAR NOWHERE (R2/A3, verifier assertion 5) ────────────────────
-- EXPECT: 0 rows. customers/service_offerings/deliveries/campaigns/assets have no delete verb.
-- SELECT * FROM public.permission_aliases
--  WHERE from_perm    IN ('customers:delete','service_offerings:delete','deliveries:delete','campaigns:delete','assets:delete')
--     OR implies_perm IN ('customers:delete','service_offerings:delete','deliveries:delete','campaigns:delete','assets:delete');

-- ── V4 — THE ROUND-TRIP, BOTH DIRECTIONS (the Phase 0 exit gate, items 1 and 2) ──────────────
-- This is the proof the whole phase turns on. It runs as a real member, not as postgres:
-- has_permission reads auth.uid(), which is NULL under the SQL editor's postgres role, so it
-- would return FALSE for everyone and prove nothing. Impersonate instead.
--
-- 4a. A member holding ONLY the LEGACY string passes a NEW-string check.
--     EXPECT: view_costs_direct = true, inventory_read_via_alias = TRUE  ← the forward direction
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<A MEMBER user_id WHO HOLDS view_costs>"}';
--   SELECT public.has_permission('f7ec5d67-a9ef-4cb0-b807-438d67687d1b','view_costs')    AS view_costs_direct,
--          public.has_permission('f7ec5d67-a9ef-4cb0-b807-438d67687d1b','inventory:read') AS inventory_read_via_alias,
--          public.has_permission('f7ec5d67-a9ef-4cb0-b807-438d67687d1b','costs:read')     AS costs_read_via_alias;
-- ROLLBACK;
--
-- 4b. THE REVERSE — a member holding ONLY the NEW string passes a LEGACY check. Nobody holds a
--     new string yet (backfill is Phase 6), so grant one inside a transaction and ROLL IT BACK.
--     EXPECT: inventory_read_direct = true, view_costs_via_alias = TRUE  ← the reverse direction
-- BEGIN;
--   UPDATE public.business_members SET permissions = '["inventory:read"]'::jsonb
--    WHERE user_id = '<A TEST MEMBER user_id>'
--      AND business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<THAT SAME TEST MEMBER user_id>"}';
--   SELECT public.has_permission('f7ec5d67-a9ef-4cb0-b807-438d67687d1b','inventory:read') AS inventory_read_direct,
--          public.has_permission('f7ec5d67-a9ef-4cb0-b807-438d67687d1b','view_costs')     AS view_costs_via_alias;
-- ROLLBACK;   -- ⚠️ MANDATORY. The UPDATE above must not survive; the backfill is Phase 6.
--
-- ⚠️ NOTE ON 4b: the authority-immutability trigger (#152) refuses a permissions UPDATE from a
--    JWT caller. Run this block as postgres (auth.uid() IS NULL is the permitted service path),
--    then SET LOCAL role for the reads. If the UPDATE is refused, that is the funnel working.

-- ── V5 — NEUTRALITY: nothing a member could do yesterday broke (exit gate item 1) ────────────
-- EXPECT: identical results to before this migration. Run 4a's first column for each live
-- member and confirm every legacy check still returns what it returned yesterday.
-- SELECT bm.user_id, bm.role, bm.permissions
--   FROM public.business_members bm
--  WHERE bm.business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b' AND bm.active
--  ORDER BY bm.role;
--
-- ⚠️ This query is ALSO the CENSUS (R-C): Phase 7's zero-check asserts against the strings
--    members ACTUALLY hold, not against §2's list — §2 missed process_orders and manage_team.
--    Save this output; it is the backfill's input and the contract's baseline.

-- ── V6 — the pg_policies proof, same shape the 20260724 migration used ───────────────────────
-- EXPECT: every row unchanged from before this migration. THIS MIGRATION FLIPS NO POLICY. The
-- proof is that the qual text still names the LEGACY strings — if a policy changed, this file
-- did something it was not supposed to.
-- SELECT tablename, policyname, cmd,
--        (qual LIKE '%has_permission%') AS gates_on_permission
--   FROM pg_policies
--  WHERE schemaname = 'public'
--    AND tablename IN ('business_inventory','cost_objects','receipts','orders','order_items',
--                      'customers','business_pricing_config','labor_resource_wages')
--  ORDER BY tablename, policyname;

-- ── V7 — the functions are STABLE, SECURITY DEFINER, and search_path-pinned ──────────────────
-- EXPECT: 2 rows, both provolatile='s', prosecdef=true, proconfig={search_path=}
-- SELECT proname, provolatile, prosecdef, proconfig
--   FROM pg_proc WHERE proname IN ('has_permission','has_permission_for');

-- ── V8 — NO MEASURABLE REGRESSION ON THE INVENTORY GRID (exit gate item 3) ───────────────────
-- MEASURED, NOT ASSERTED. Run the BEFORE half FIRST — before applying this migration — and
-- keep the output. Then apply and run the AFTER half. Same query, same session shape.
--
-- BEFORE (capture this first, on the pre-migration function):
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<A MEMBER user_id WHO HOLDS view_costs>"}';
--   EXPLAIN (ANALYZE, BUFFERS)
--     SELECT id, name, sku, size, qty, sell_price
--       FROM public.business_inventory
--      WHERE business_id = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'
--      ORDER BY name;
-- ROLLBACK;
--
-- AFTER: the identical block, post-apply.
--
-- PASS CONDITION: execution time within noise of the BEFORE run (the member holds view_costs,
-- the direct containment test hits, and the alias SubPlan never executes — look for the absence
-- of a per-row SubPlan on permission_aliases in the AFTER plan). A visible per-row SubPlan, or
-- a materially higher execution time, is a PHASE 0 EXIT-GATE FAILURE — report it, do not
-- proceed to Phase 1.
