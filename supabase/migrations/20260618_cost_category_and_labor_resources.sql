-- ============================================================================
-- 20260618_cost_category_and_labor_resources.sql
-- D-11 (cost category dimension) + D-12 (labor model FOUNDATION) — schema only.
--
-- CANONICAL SPEC:
--   • docs/DECISION-cost-category-dimension.md  (category = the P&L line-item axis,
--     Schedule C–aligned, QBO-mappable, per-business/customizable → honest null/"Other")
--   • docs/DECISION-labor-cost-model.md          (robust labor model: EMPLOYEE|CONTRACTOR,
--     HOURLY|FLAT_FEE, employee burden/cost_rate/bill_rate, contractor rate/pass-through —
--     built ROBUST now even though only owner/contractor populate it; Ignition snaps in
--     without re-migration. Governing principle: robust SHAPE, sane defaults, honest nulls.)
--
-- THREE ORTHOGONAL TAGS already on cost_objects: PROJECT (parent_id, 20260615) ×
--   NATURE (cost_nature, 20260617) × SHAPE (cost_shape, 20260617). This migration adds the
--   FOURTH P&L axis (cost_category) + the labor RESOURCE spine. node_type stays the "what kind
--   of thing" discriminator; category = "what the money was spent on"; they are orthogonal.
--
-- BOUNDED SCOPE (D-11/D-12 Stage 2). This migration is SCHEMA ONLY:
--   1. cost_objects.cost_category   — D-11. text, NULLABLE, NO CHECK (per-business value set
--      grows without a migration — mirrors cost_source precedent, AC-1 data-driven).
--   2. labor_resources              — D-12 robust role/rate table (the home of the deferred
--      burden/bill/margin engine; reused across many applied-labor lines, so role economics
--      live ONCE here, never re-carried on each cost row — no drift).
--   3. cost_objects.resource_id     — FK → labor_resources (the applied-labor link).
--      cost_objects.labor_hours     — applied hours for an HOURLY labor cost (provenance/recompute).
--
-- DEFERRED (robust fields exist → these are LATER UI, never future re-migrations):
--   burden component breakdown (single `burden` value now; components later IN-field);
--   bill-rate/margin engine; categorized P&L block; spreadsheet grid. NOT in this migration.
--
-- LOSSLESS / NON-DESTRUCTIVE: ADD COLUMN + CREATE TABLE only. No data rewrite, no drop.
--   cost_category lands NULL on every existing row (honest "uncategorized", not a fake value).
--   resource_id/labor_hours land NULL on every existing row (no row is labor yet).
--
-- AC-1: no vertical nouns — resource_type / rate_basis / category are VALUES, not table names.
-- AC-2: labor_resources RLS = business_id membership (owner_all + member_all), mirrors
--        cost_object_edges exactly (20260615:152-164).
--
-- VERIFY-FIRST STATE (what the catalog should show BEFORE this migration applies):
--   cost_objects.cost_category → EXPECTED ABSENT  ← this migration adds it
--   cost_objects.resource_id   → EXPECTED ABSENT  ← this migration adds it
--   cost_objects.labor_hours   → EXPECTED ABSENT  ← this migration adds it
--   labor_resources (table)    → EXPECTED ABSENT  ← this migration creates it
-- Run scripts/verify-cost-objects.mjs (checks Q–W) AFTER applying — the schema-verification gate.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. cost_category — the P&L line-item axis (D-11).
--    NULLABLE (honest "uncategorized" — never a fake "Other" written by default) and
--    DELIBERATELY NO CHECK: the ~15–20 Schedule C values are seeded in the UI picker and are
--    per-business customizable (D-11 §"Categories are DATA"). Same loose-by-design precedent
--    as cost_source (20260617). The value-set grows without a migration.
-- ----------------------------------------------------------------------------
ALTER TABLE cost_objects
  ADD COLUMN cost_category text;

COMMENT ON COLUMN cost_objects.cost_category IS
  'P&L line-item axis (Schedule C–aligned, QBO-mappable): labor | contract-labor | software-subscriptions | utilities | supplies | materials | rent | insurance | taxes-licenses | repairs | advertising | vehicle-fuel | professional-fees | bank-fees | equipment | other. NULL = uncategorized (honest, never a fake default). Per-business customizable (DATA, AC-1) → no CHECK; value-set grows without a migration. Orthogonal to node_type / cost_nature / cost_shape. Labor categories: ''labor'' (Schedule C Wages) and ''contract-labor'' (1099-NEC) — exact lowercase strings, matched by the hasMigratedLabor read-path guard (D-12 Stage 3).';

-- ----------------------------------------------------------------------------
-- 2. labor_resources — the robust D-12 labor model (role/rate spine).
--    A RESOURCE is a role or person reused across many applied-labor cost lines. Building it
--    as its own table (vs. fields on cost_objects) keeps the universal cost spine uniform,
--    gives the deferred burden/bill/margin engine a clean home, and prevents role economics
--    from being re-carried (and drifting) on every labor cost row. The applied-labor cost is
--    a cost_objects row (node_type=COST, cost_category='labor'|'contract-labor') that carries
--    recurring_amount = the realized monthly cost (denormalized, like every recurring cost) so
--    the cost-to-produce read path stays byte-identical WITHOUT a join; this table feeds the
--    LATER engine, not the floor math.
--
--    EMPLOYEE vs CONTRACTOR (Schedule C distinction):
--      EMPLOYEE  → base_wage + burden = cost_rate (true cost to you); bill_rate = charged out.
--                  burden is a SINGLE value now (robust shape, shallow population — components
--                  are a later refinement INSIDE this field, NOT a re-migration; D-12).
--      CONTRACTOR→ rate (hourly OR flat-fee; already includes THEIR burden — you add none) +
--                  pass_through_expenses (materials/travel they bill you, separate from rate).
--                  No employer burden, no your-side bill markup.
--    Per-type fields are NULLABLE (honest nulls) — a contractor row leaves employee fields null
--    and vice-versa; no cross-field CHECK is imposed (keeps it flexible; the UI guides entry).
-- ----------------------------------------------------------------------------
CREATE TABLE labor_resources (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id   uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  resource_type text NOT NULL CHECK (resource_type IN ('EMPLOYEE','CONTRACTOR')),
  name          text NOT NULL,                                    -- role or person label ("Sr Tech", "Owner", "Connor (contract)")
  rate_basis    text NOT NULL CHECK (rate_basis IN ('HOURLY','FLAT_FEE')),

  -- EMPLOYEE economics (NULL for contractors) ----------------------------------
  base_wage     numeric(10,2),   -- $/hr base. NOT the labor cost — burden adds on top.
  burden        numeric(10,2),   -- SINGLE burden value now ($/hr or absolute add-on; components later in-field, not a re-migration).
  cost_rate     numeric(10,2),   -- = base_wage + burden, the TRUE cost to you (stored, not derived in SQL — UI computes it).
  bill_rate     numeric(10,2),   -- $/hr charged to the customer; margin lives ABOVE cost_rate.

  -- CONTRACTOR economics (NULL for employees) ----------------------------------
  rate                  numeric(10,2),  -- hourly OR flat-fee; already includes their own burden (you add none).
  pass_through_expenses numeric(10,2),  -- materials/travel the contractor bills you, SEPARATE from rate.

  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE labor_resources IS
  'D-12 robust labor model. A role/person (EMPLOYEE|CONTRACTOR) reused across applied-labor cost lines. Employee: base_wage+burden=cost_rate, bill_rate. Contractor: rate (incl. their burden) + pass_through_expenses. Built robust now; only owner/contractor populate in TRACE — Ignition populates full depth (Sr/Tech/Jr, real burden/bill) WITHOUT re-migration. The deferred burden/bill/margin engine reads this table; the cost-to-produce floor reads cost_objects.recurring_amount (denormalized).';

ALTER TABLE labor_resources ENABLE ROW LEVEL SECURITY;

-- RLS: business_id membership (AC-2) — mirrors cost_object_edges (20260615) exactly.
CREATE POLICY labor_resources_owner_all ON labor_resources
  USING (EXISTS (SELECT 1 FROM businesses
                 WHERE id = labor_resources.business_id AND owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM businesses
                 WHERE id = labor_resources.business_id AND owner_id = auth.uid()));

CREATE POLICY labor_resources_member_all ON labor_resources
  USING (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = labor_resources.business_id
                   AND user_id = auth.uid() AND active = true))
  WITH CHECK (EXISTS (SELECT 1 FROM business_members
                 WHERE business_id = labor_resources.business_id
                   AND user_id = auth.uid() AND active = true));

DROP TRIGGER IF EXISTS labor_resources_updated_at ON labor_resources;
CREATE TRIGGER labor_resources_updated_at
  BEFORE UPDATE ON labor_resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();

CREATE INDEX idx_labor_resources_business ON labor_resources (business_id);

-- ----------------------------------------------------------------------------
-- 3. cost_objects → labor link (the applied-labor cost references its resource).
--    resource_id ON DELETE SET NULL: deleting a role must NOT delete the cost history —
--    the cost row survives with its recurring_amount intact, just unlinked (honest debt, not
--    data loss). labor_hours: plain NULLABLE, NO DEFAULT — a non-labor cost has no hours, and
--    DEFAULT 0 would falsely assert "zero hours"; NULL = "not a labor row / no hours" (honest).
-- ----------------------------------------------------------------------------
ALTER TABLE cost_objects
  ADD COLUMN resource_id uuid REFERENCES labor_resources(id) ON DELETE SET NULL,
  ADD COLUMN labor_hours numeric;

COMMENT ON COLUMN cost_objects.resource_id IS
  'Applied-labor link → labor_resources(id). NULL for non-labor costs. ON DELETE SET NULL: deleting a role unlinks but preserves the cost history (recurring_amount stays). Set when cost_category IN (''labor'',''contract-labor'').';
COMMENT ON COLUMN cost_objects.labor_hours IS
  'Applied hours for an HOURLY labor cost (provenance/recompute: resource.rate × labor_hours = recurring_amount). NULLABLE, NO DEFAULT — NULL = not a labor row / no hours (a subscription has no hours; DEFAULT 0 would falsely imply zero hours). FLAT_FEE labor leaves this NULL.';

-- ============================================================================
-- SCHEMA-VERIFICATION GATE (§9) — run scripts/verify-cost-objects.mjs with a PAT.
-- Catalog queries the script runs (live information_schema / pg_catalog), for reference:
--
-- (Q) cost_category — text, nullable, NO CHECK:
--   SELECT data_type, is_nullable FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='cost_category';
--   -- expect: text, YES
--   SELECT COUNT(*)::int FROM pg_constraint
--    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_cost_category_check';
--   -- expect: 0 (loose by design)
--
-- (R) labor_resources columns all present:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='labor_resources' ORDER BY 1;
--   -- expect: id, business_id, resource_type, name, rate_basis, base_wage, burden,
--   --         cost_rate, bill_rate, rate, pass_through_expenses, created_at, updated_at
--
-- (S) resource_type CHECK = EMPLOYEE|CONTRACTOR:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='labor_resources'::regclass AND conname='labor_resources_resource_type_check';
--
-- (T) rate_basis CHECK = HOURLY|FLAT_FEE:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='labor_resources'::regclass AND conname='labor_resources_rate_basis_check';
--
-- (U) labor_resources RLS owner_all + member_all + rowsecurity=true:
--   SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename='labor_resources';
--   SELECT relrowsecurity FROM pg_class WHERE relname='labor_resources';
--
-- (V) labor_resources.business_id FK → businesses ON DELETE CASCADE.
--
-- (W) cost_objects.resource_id FK → labor_resources ON DELETE SET NULL;
--     cost_objects.labor_hours numeric, nullable, NO default.
-- ============================================================================
