-- ============================================================
-- Migration: cost_objects — SHAPE × NATURE × SOURCE (Unified Cost Model, BUILD step 1)
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Date: 2026-06-17
--
-- The unified-cost-model spine. Adds the two remaining orthogonal dimensions a
-- cost needs to be first-class, plus a provenance hook:
--   • cost_shape   — HOW the money behaves over time (the six shapes). Two land with
--                    immediate meaning (ONE_TIME, RECURRING_FIXED/PER_OCCASION); the
--                    other shape-specific columns (amortize term/start, increment_size,
--                    scales_with) are DEFERRED honest-debt — no writer yet.
--   • cadence      — billing cadence for recurring shapes (mirrors the Cadence type,
--                    CountOnceSeam.ts:99). Absent → shape inferred from date spacing.
--   • recurring_amount — the periodic figure, DISTINCT from acquisition_cost. Never
--                    overload capex onto recurring: acquisition_cost = capital outlay,
--                    recurring_amount = the per-cadence charge. The seam reads them in
--                    different buckets (CAPEX vs MONTHLY_POOL).
--   • cost_nature  — HOW the cost is recovered: CAPEX (build) | COGS (per-sale) |
--                    OPEX (run). Drives the three business views + payback/margin
--                    (DECISION-small-business-cost-accounting-model.md).
--   • cost_source  — provenance SEAM for the connect-via-API layer. MANUAL today (a
--                    REAL value — every cost is hand-entered now), QUICKBOOKS/BANK/
--                    RECEIPT/etc. later. Loose (no CHECK) so sources grow WITHOUT a
--                    migration. Stamped now (one ALTER) to avoid re-altering live cost
--                    data when connectors land.
--   • node_type    — extended with 'COST' (a standalone operating/recurring cost that
--                    is neither asset, project, nor product). cost_shape stays an
--                    INDEPENDENT axis — node_type = what kind of thing; cost_shape =
--                    how money behaves; cost_nature = how it's recovered. Three
--                    orthogonal tags.
--
-- THREE ORTHOGONAL DIMENSIONS on every cost (the model):
--   PROJECT (parent_id — built 20260615) × NATURE (this migration) × SHAPE (this migration).
--
-- AC-1: no vertical nouns — every value (ASSET/COST/CAPEX/MANUAL…) is DATA, never a
--       table name. AC-2: RLS unchanged (inherits cost_objects owner_all + member_all).
--
-- ⚠️  APPLY MANUALLY in Supabase SQL editor — do NOT execute without David's explicit
--     "run it" approval. After applying, run the catalog proof (independent
--     schema-verification gate — hits the live catalog, NOT the builder's memory):
--         SUPABASE_PAT=sbp_xxx node scripts/verify-cost-objects.mjs
-- ============================================================
-- Pre-write LIVE state (service-key catalog probe, 2026-06-17 — to RE-PROVE at apply):
--   cost_objects                  → present (Core-1 + D-5 already applied)
--   cost_objects.node_type        → present, CHECK ASSET|PROJECT|PRODUCT (extend → +COST)
--   cost_objects.cost_shape       → EXPECTED ABSENT  ← this migration adds it
--   cost_objects.cadence          → EXPECTED ABSENT  ← this migration adds it
--   cost_objects.recurring_amount → EXPECTED ABSENT  ← this migration adds it
--   cost_objects.cost_nature      → EXPECTED ABSENT  ← this migration adds it
--   cost_objects.cost_source      → EXPECTED ABSENT  ← this migration adds it
--   existing rows                 → all node_type='ASSET' capex (CoolRunnings + tractor)
--                                   → the NOT NULL DEFAULTs below are TRUE for every one
--                                     (ONE_TIME + CAPEX + MANUAL) — no row is mis-tagged.
--
-- LOSSLESS / NON-DESTRUCTIVE: ALTER ... ADD COLUMN only + one CHECK swap on node_type.
--   No data rewrite, no drop of data. The node_type CHECK swap only WIDENS the allowed
--   set (adds 'COST'); every existing value still satisfies it.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. node_type — WIDEN the discriminator with 'COST'.
--    Inline column CHECKs are named <table>_<column>_check by Postgres
--    (confirmed: cost_objects_substantiation_check, verify query H).
--    Drop + re-add with the widened set. Widen-only: every existing value passes.
-- ------------------------------------------------------------
ALTER TABLE cost_objects DROP CONSTRAINT cost_objects_node_type_check;
ALTER TABLE cost_objects ADD  CONSTRAINT cost_objects_node_type_check
  CHECK (node_type IN ('ASSET','PROJECT','PRODUCT','COST'));

COMMENT ON COLUMN cost_objects.node_type IS
  'AC-1 discriminator: ASSET | PROJECT | PRODUCT | COST. COST = a standalone operating/recurring cost (subscription, utility) that is not an asset/project/product. Independent of cost_shape (how money behaves) and cost_nature (how it is recovered).';

-- ------------------------------------------------------------
-- 2. cost_shape — the six shapes (how money behaves over time).
--    NOT NULL DEFAULT 'ONE_TIME' mirrors node_type/substantiation precedent and is
--    TRUE for every existing (capex asset) row. Shape-specific carry columns
--    (amortize_term_months/amortize_start for PREPAID_AMORTIZED, increment_size for
--    INCREMENTAL_PREPAID, scales_with for VARIABLE) are DEFERRED — no writer yet, would
--    be an always-null pile (the anti-pattern 20260615 deferred budget_estimate for).
--    The enum already ALLOWS variable-scales-with-N; the BEHAVIOR is not built.
-- ------------------------------------------------------------
ALTER TABLE cost_objects
  ADD COLUMN cost_shape text NOT NULL DEFAULT 'ONE_TIME'
    CHECK (cost_shape IN (
      'ONE_TIME',            -- capital / one-off outlay (current acquisition_cost rows)
      'RECURRING_FIXED',     -- billed on a cadence regardless of use (subscription)
      'PER_OCCASION',        -- cost tied to a usage event, billed when it happens (D-8)
      'PREPAID_AMORTIZED',   -- paid whole upfront, spread over a term (cols deferred)
      'INCREMENTAL_PREPAID', -- prepaid balance that auto-refills (col deferred)
      'VARIABLE'             -- scales with units/customers — ALLOWED, behavior NOT built
    )),
  -- Billing cadence for recurring shapes. Mirrors Cadence (CountOnceSeam.ts:99) exactly.
  -- Nullable: a ONE_TIME cost has no cadence; absent → seam infers from date spacing.
  ADD COLUMN cadence text
    CHECK (cadence IS NULL OR cadence IN ('ONE_OFF','WEEKLY','MONTHLY','QUARTERLY','ANNUAL')),
  -- The periodic charge for recurring shapes. DISTINCT from acquisition_cost (capex).
  -- Nullable + NEVER 0-for-unknown: null = UNKNOWN amount (Surface Honesty).
  ADD COLUMN recurring_amount numeric(10,2);

COMMENT ON COLUMN cost_objects.cost_shape IS
  'How the money behaves over time (the six shapes). ONE_TIME (capex/one-off) | RECURRING_FIXED | PER_OCCASION (D-8) | PREPAID_AMORTIZED | INCREMENTAL_PREPAID | VARIABLE (scales-with-N: allowed, behavior not built). Default ONE_TIME — true for every pre-existing capex row.';
COMMENT ON COLUMN cost_objects.cadence IS
  'Billing cadence for recurring shapes (ONE_OFF/WEEKLY/MONTHLY/QUARTERLY/ANNUAL). Mirrors the Cadence type, CountOnceSeam.ts:99. NULL for ONE_TIME costs; absent → shape inferred from date spacing. Closes the deferred cadence-edit gap (D-10).';
COMMENT ON COLUMN cost_objects.recurring_amount IS
  'The per-cadence charge for a recurring cost. DISTINCT from acquisition_cost (capital outlay) — never overload capex onto recurring; the seam reads them in different buckets (CAPEX vs MONTHLY_POOL). NULL = UNKNOWN amount, never written as 0 (Surface Honesty).';

-- ------------------------------------------------------------
-- 3. cost_nature — how the cost is recovered (CAPEX/COGS/OPEX).
--    The NEW orthogonal dimension that produces the three business views + payback/margin.
--    NOT NULL DEFAULT 'CAPEX' is TRUE for every existing (capex asset) row. Migrated
--    recurring (OPEX) + future COGS rows set it explicitly at insert.
-- ------------------------------------------------------------
ALTER TABLE cost_objects
  ADD COLUMN cost_nature text NOT NULL DEFAULT 'CAPEX'
    CHECK (cost_nature IN ('CAPEX','COGS','OPEX'));

COMMENT ON COLUMN cost_objects.cost_nature IS
  'How the cost is RECOVERED: CAPEX (build — depreciate/amortize over life → payback) | COGS (per-sale — recovered in price/margin) | OPEX (run — covered by monthly gross margin). Drives the three business views + computed payback & margin (DECISION-small-business-cost-accounting-model.md). Orthogonal to node_type and cost_shape. Default CAPEX — true for every pre-existing asset row.';

-- ------------------------------------------------------------
-- 4. cost_source — provenance SEAM for the connect-via-API layer (NOT a null-pile).
--    Has an IMMEDIATE writer: every cost today is MANUAL (a real value, true provenance).
--    Known near-future consumer: QuickBooks/bank/receipt connectors stamp their source.
--    INTENTIONALLY NO CHECK constraint — the value-set is EXPECTED TO GROW (QUICKBOOKS,
--    BANK, RECEIPT, PLAID, …) and must do so WITHOUT a migration. NOT NULL DEFAULT 'MANUAL'.
-- ------------------------------------------------------------
ALTER TABLE cost_objects
  ADD COLUMN cost_source text NOT NULL DEFAULT 'MANUAL';

COMMENT ON COLUMN cost_objects.cost_source IS
  'Provenance of the cost (connect-via-API seam). MANUAL now (hand-entered — a real value, not a placeholder); QUICKBOOKS / BANK / RECEIPT / PLAID / … as connectors land. DELIBERATELY no CHECK — the value-set grows without a migration. NOT NULL DEFAULT MANUAL.';

-- Index for the three-view hot path: WHERE business_id = ? GROUP BY cost_nature.
CREATE INDEX idx_cost_objects_business_nature ON cost_objects (business_id, cost_nature);

COMMIT;

-- ============================================================
-- SCHEMA-VERIFICATION GATE — run AFTER applying (live catalog, NOT memory).
-- scripts/verify-cost-objects.mjs runs (J)-(O) via the Management API (PAT).
-- ============================================================
-- (J) cost_shape — text NOT NULL default 'ONE_TIME', CHECK has all six values:
--   SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='cost_shape';
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_cost_shape_check';
--   Expect: text, NO, default 'ONE_TIME'; CHECK lists ONE_TIME,RECURRING_FIXED,PER_OCCASION,
--           PREPAID_AMORTIZED,INCREMENTAL_PREPAID,VARIABLE.
--
-- (K) cadence — text nullable, CHECK has the five cadence values:
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_cadence_check';
--   Expect: ONE_OFF,WEEKLY,MONTHLY,QUARTERLY,ANNUAL (IS NULL OR …).
--
-- (L) recurring_amount — numeric, nullable:
--   SELECT data_type, numeric_precision, numeric_scale, is_nullable FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='recurring_amount';
--   Expect: numeric(10,2), is_nullable=YES.
--
-- (M) node_type CHECK WIDENED to include 'COST' (and still the original three):
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_node_type_check';
--   Expect: IN ('ASSET','PROJECT','PRODUCT','COST').
--
-- (N) cost_nature — text NOT NULL default 'CAPEX', CHECK = CAPEX|COGS|OPEX:
--   SELECT column_name, is_nullable, column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='cost_nature';
--   SELECT pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_cost_nature_check';
--   Expect: NO, default 'CAPEX'; CHECK CAPEX,COGS,OPEX.
--
-- (O) cost_source — text NOT NULL default 'MANUAL', and NO CHECK constraint (loose by design):
--   SELECT column_name, is_nullable, column_default FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='cost_source';
--   SELECT COUNT(*) FROM pg_constraint
--    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_cost_source_check';
--   Expect: NO, default 'MANUAL'; constraint COUNT = 0 (intentionally unconstrained).
--
-- (P) existing rows correctly defaulted (no row mis-tagged by the new NOT NULL defaults):
--   SELECT node_type, cost_shape, cost_nature, cost_source, COUNT(*) FROM cost_objects
--    GROUP BY 1,2,3,4 ORDER BY 1,2,3,4;
--   Expect: all pre-existing rows = (ASSET, ONE_TIME, CAPEX, MANUAL) — true provenance.
-- ============================================================
