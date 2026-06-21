-- ============================================================================
-- 20260621_financial_wall_phase2.sql
-- Phase 2 HARD DATA-LAYER WALL — view_wages + view_pricing_config.
--
-- CANONICAL SPEC: docs/decisions/2026-06-21-role-financial-permissions.md
--   Recon: data/grower-scan/role-enforcement-ground-truth.md
--
-- MECHANISM (chosen at build, reported): CHILD-TABLE SPLIT with role-aware RLS that
--   reads the SAME business_members.permissions JSONB the chokepoint reads. Postgres
--   RLS gates ROWS not COLUMNS, so the sensitive values are moved to child rows an
--   RLS policy can gate per-permission. The masking-view alternative was rejected:
--   it needs REVOKE SELECT on the base table from the role `authenticated`, which is
--   ROLE-WIDE not per-user → it would also block the OWNER's writes (the wage/pricing
--   write path is client-side under the owner's session) and force writes onto a
--   service-key API endpoint, colliding with the 12-function ceiling (tech-debt #41).
--
-- DATA-MOVE (not just additive): the sensitive values are COPIED into the gated child
--   tables and then CLEARED from their member-readable home (labor_resources wage
--   columns → NULL; business_modules.config for 'cost_to_produce' → '{}'). The schema
--   is non-destructive (CREATE TABLE only; no column/table dropped — the now-empty base
--   columns drop in a LATER gated step once the app is owner-proven, mirroring the
--   nursery_modules→business_modules pattern). After this migration the value lives
--   ONLY in the RLS-gated child → a session without the permission cannot read it.
--
-- APPLY ORDER (avoids the migration window): DEPLOY THE NEW CODE FIRST. The refactored
--   reader/writer (financialDataAccess.ts) reads the child tables and FALLS BACK to the
--   legacy location ONLY when the child table is ABSENT (relation error) — so it works
--   both before this migration (child missing → reads base) and after (child present →
--   reads child; base cleared, never read). THEN apply this migration to close the wall.
--
-- AC-1: no vertical nouns. AC-2/AC-3: tenant isolation preserved (every policy is
--   business_id-scoped AND role-scoped). DEFAULT-DENY: a member lacking the permission
--   matches no policy → zero rows → the value never leaves the server.
--
-- VERIFY-FIRST STATE (catalog BEFORE apply):
--   labor_resource_wages (table)    → EXPECTED ABSENT  ← this migration creates it
--   business_pricing_config (table) → EXPECTED ABSENT  ← this migration creates it
--   labor_resources wage columns    → EXPECTED PRESENT + POPULATED ← cleared to NULL here
-- Run scripts/verify-financial-wall.mjs (PAT) AFTER applying — schema-verification gate.
-- Run scripts/verify-financial-wall-rls.mjs (anon + a member session) — the Gate 2 proof.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- A. labor_resource_wages — the view_wages child (HR pay).
--    One row per labor_resources row; PK = resource_id (1:1). business_id denormalized
--    for RLS (no join needed). Wage columns mirror labor_resources exactly.
-- ----------------------------------------------------------------------------
CREATE TABLE labor_resource_wages (
  resource_id           uuid PRIMARY KEY REFERENCES labor_resources(id) ON DELETE CASCADE,
  business_id           uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  base_wage             numeric(10,2),
  burden                numeric(10,2),
  cost_rate             numeric(10,2),
  bill_rate             numeric(10,2),
  rate                  numeric(10,2),
  pass_through_expenses numeric(10,2),
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE labor_resource_wages IS
  'view_wages hard wall (decision 2026-06-21). HR pay split off labor_resources so RLS can gate it per-permission. Owner + members holding view_wages only. Cleared base columns on labor_resources are vestigial (drop in a later gated step).';

ALTER TABLE labor_resource_wages ENABLE ROW LEVEL SECURITY;

-- owner: full access (mirrors labor_resources_owner_all)
CREATE POLICY lrw_owner_all ON labor_resource_wages
  USING (EXISTS (SELECT 1 FROM businesses
                 WHERE id = labor_resource_wages.business_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses
                 WHERE id = labor_resource_wages.business_id AND owner_id = auth.uid()));

-- member WITH view_wages ONLY (default-deny: a member without it matches no policy → 0 rows).
-- `permissions ? 'view_wages'` tests array-element existence on the jsonb permissions array.
CREATE POLICY lrw_member_view_wages ON labor_resource_wages
  USING (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = labor_resource_wages.business_id
                   AND user_id = auth.uid() AND active = true
                   AND permissions ? 'view_wages'))
  WITH CHECK (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = labor_resource_wages.business_id
                   AND user_id = auth.uid() AND active = true
                   AND permissions ? 'view_wages'));

DROP TRIGGER IF EXISTS labor_resource_wages_updated_at ON labor_resource_wages;
CREATE TRIGGER labor_resource_wages_updated_at
  BEFORE UPDATE ON labor_resource_wages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

CREATE INDEX idx_labor_resource_wages_business ON labor_resource_wages (business_id);

-- copy existing wages into the gated child (lossless)
INSERT INTO labor_resource_wages
  (resource_id, business_id, base_wage, burden, cost_rate, bill_rate, rate, pass_through_expenses)
SELECT id, business_id, base_wage, burden, cost_rate, bill_rate, rate, pass_through_expenses
FROM labor_resources
ON CONFLICT (resource_id) DO NOTHING;

-- clear the member-readable copy on the parent — the value now lives ONLY in the gated child.
-- (Columns kept, not dropped, per the append-only rule; they drop in a later gated step.)
UPDATE labor_resources
SET base_wage = NULL, burden = NULL, cost_rate = NULL,
    bill_rate = NULL, rate = NULL, pass_through_expenses = NULL;

-- ----------------------------------------------------------------------------
-- B. business_pricing_config — the view_pricing_config child (the pricing recipe / moat).
--    The cost_to_produce pricing blob (margin floors, c2p params, denominators, markup)
--    moves out of the shared, member-readable business_modules.config into its own
--    role-gated table. One row per business.
-- ----------------------------------------------------------------------------
CREATE TABLE business_pricing_config (
  business_id uuid PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  config      jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE business_pricing_config IS
  'view_pricing_config hard wall (decision 2026-06-21). The cost_to_produce pricing recipe (margin/denominators/labor params) moved out of the member-readable business_modules.config into a role-gated table. Owner + members holding view_pricing_config only.';

ALTER TABLE business_pricing_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY bpc_owner_all ON business_pricing_config
  USING (EXISTS (SELECT 1 FROM businesses
                 WHERE id = business_pricing_config.business_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses
                 WHERE id = business_pricing_config.business_id AND owner_id = auth.uid()));

CREATE POLICY bpc_member_view_pricing ON business_pricing_config
  USING (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = business_pricing_config.business_id
                   AND user_id = auth.uid() AND active = true
                   AND permissions ? 'view_pricing_config'))
  WITH CHECK (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = business_pricing_config.business_id
                   AND user_id = auth.uid() AND active = true
                   AND permissions ? 'view_pricing_config'));

DROP TRIGGER IF EXISTS business_pricing_config_updated_at ON business_pricing_config;
CREATE TRIGGER business_pricing_config_updated_at
  BEFORE UPDATE ON business_pricing_config
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

-- copy the cost_to_produce pricing config into the gated table (lossless)
INSERT INTO business_pricing_config (business_id, config)
SELECT business_id, config FROM business_modules WHERE module_key = 'cost_to_produce'
ON CONFLICT (business_id) DO NOTHING;

-- clear the member-readable copy (the recipe now lives ONLY in the gated table).
-- Only the cost_to_produce row's config is touched; enablement flags + other modules' configs are untouched.
UPDATE business_modules SET config = '{}'::jsonb WHERE module_key = 'cost_to_produce';

-- ============================================================================
-- SCHEMA-VERIFICATION GATE (§9) — scripts/verify-financial-wall.mjs (PAT). Checks:
--  (A) labor_resource_wages exists; columns = resource_id, business_id, base_wage, burden,
--      cost_rate, bill_rate, rate, pass_through_expenses, created_at, updated_at.
--  (B) labor_resource_wages RLS on; policies lrw_owner_all + lrw_member_view_wages; the
--      member policy references permissions ? 'view_wages'.
--  (C) labor_resource_wages.resource_id FK → labor_resources ON DELETE CASCADE.
--  (D) business_pricing_config exists; columns = business_id, config, created_at, updated_at.
--  (E) business_pricing_config RLS on; policies bpc_owner_all + bpc_member_view_pricing;
--      member policy references permissions ? 'view_pricing_config'.
--  (F) DATA MOVED: labor_resources wage columns all NULL; every labor_resources row has a
--      labor_resource_wages row; business_modules cost_to_produce config = '{}'; each such
--      business has a business_pricing_config row.
-- GATE 2 PROOF — scripts/verify-financial-wall-rls.mjs (anon + a member session without the
--  permission): a DIRECT SELECT for base_wage / the child / the pricing config is REFUSED at
--  the data layer (zero rows / no value), verified on the response — owner still reads both.
-- ============================================================================
