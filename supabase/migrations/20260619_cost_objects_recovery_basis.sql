-- ============================================================
-- Migration: cost_objects — recovery_basis (D-16 Pricing Model B, Phase 2a)
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Date: 2026-06-19
--
-- CANONICAL SPEC: docs/DECISION-pricing-model.md (D-16). Model B = price by
--   COST-TO-SERVE ÷ N ÷ (1 − margin); PLATFORM INVESTMENT (founder/platform labor)
--   is NEVER divided into per-unit price — it sits on a separate PAYBACK line.
--   The flag added here is the split D-16's recon found is NOT cleanly derivable from
--   existing columns (cost_nature is too coarse — owner labor and per-tenant subs are
--   both OPEX; the truest signal cost_shape='VARIABLE' is unbuilt). One small column,
--   per the verify-first recon (Handoff 2026-06-19).
--
-- TWO NEW COLUMNS on cost_objects:
--   • recovery_basis        — COST_TO_SERVE | PLATFORM_INVESTMENT. Whether this cost
--                             feeds the ÷N price (cost-to-serve) or the separate payback
--                             line (platform investment). text, NULLABLE, NO CHECK
--                             (AC-4 / cost_source precedent: the value-set grows without
--                             a migration).
--   • recovery_basis_source — DERIVED | EXPLICIT. Provenance of the CURRENT recovery_basis:
--                             DERIVED = the system's default guess (owner has NOT vetted it);
--                             EXPLICIT = owner-set. This is the "derived first, then explicit"
--                             honesty axis — it tells the owner which classifications still
--                             run on the system's guess. ALL backfilled rows = DERIVED.
--                             text, NULLABLE, NO CHECK.
--
-- This is a CLASSIFICATION, not an amount. It must move NO cost total. After backfill the
-- live /costs tile MUST be byte-identical: floor $11,323/mo, knownMonthly $12,930.67/mo,
-- capexKnown $6,917.31 (TRACE tenant 45830ba7, captured live 2026-06-19). If any total
-- changes, that is a BUG — recovery_basis touches no arithmetic.
--
-- ─── THE DERIVED DEFAULT RULE (a SUGGESTION, not a verdict — 2b makes it owner-overridable) ───
--   • Owner/founder labor  (cost_category='labor' AND resource_id → labor_resources where
--                           resource_type='EMPLOYEE')                → PLATFORM_INVESTMENT
--   • Everything else       (recurring subs, contract-labor, COGS,
--                           assets/capital, project/product buckets) → COST_TO_SERVE
--   • recovery_basis_source = 'DERIVED' for EVERY backfilled row.
--
--   ⚠️ KNOWN LIMITATION (expected — the flag exists precisely so this can be corrected):
--      the proxy "labor=investment" holds ONLY for a two-person business. A future
--      customer-serving EMPLOYEE would be mis-tagged PLATFORM_INVESTMENT by this rule
--      (they are cost-to-serve), and owner per-tenant support time is really cost-to-serve
--      too. Both are corrected in 2b by an EXPLICIT owner override (recovery_basis_source
--      → 'EXPLICIT'). DERIVED rows are the ones still running on the system's guess.
--
--   Expected split on the live TRACE tenant (45830ba7, 21 rows, verified 2026-06-19):
--      PLATFORM_INVESTMENT = 1   (Owner (labor), the sole EMPLOYEE-resource labor row)
--      COST_TO_SERVE       = 20  (Connor/Andrew contract-labor [CONTRACTOR], all subs,
--                                 5 ASSET/capital rows, 3 PROJECT buckets, TX-tax/other)
--
-- AC-1: no vertical nouns — every value is DATA, never a table name.
-- AC-2: RLS unchanged (inherits cost_objects owner_all + member_all).
--
-- LOSSLESS / NON-DESTRUCTIVE: ALTER ... ADD COLUMN (nullable → existing rows valid before
--   backfill) + an in-migration UPDATE that only sets the two NEW columns. No existing
--   column is read for writing, no amount is touched.
--
-- ⚠️  STAGED / GATED — do NOT execute without David's explicit "run it". Apply MANUALLY in
--     the Supabase SQL editor (project bgobkjcopcxusjsetfob). After applying, run the catalog
--     proof (the schema-verification gate — hits the live catalog, NOT the builder's memory):
--         SUPABASE_PAT=sbp_xxx node scripts/verify-cost-objects.mjs   # checks (X)-(Z)
--     then REVOKE the PAT.
-- ============================================================
-- Pre-write LIVE state (service-key probe, 2026-06-19 — RE-PROVE at apply):
--   cost_objects                       → present (Core-1 + D-5 + shape/nature + category/labor applied)
--   cost_objects.recovery_basis        → EXPECTED ABSENT  ← this migration adds it
--   cost_objects.recovery_basis_source → EXPECTED ABSENT  ← this migration adds it
--   21 rows total: 1 EMPLOYEE-labor (→ PLATFORM_INVESTMENT), 20 others (→ COST_TO_SERVE)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1. recovery_basis — feeds-the-price vs feeds-the-payback-line (D-16 Model B).
--    NULLABLE so existing rows are valid BEFORE the backfill UPDATE below runs in the
--    same transaction. DELIBERATELY NO CHECK (AC-4) — like cost_source/cost_category, the
--    value-set is expected to grow without a migration.
-- ------------------------------------------------------------
ALTER TABLE cost_objects
  ADD COLUMN recovery_basis text,
  ADD COLUMN recovery_basis_source text;

COMMENT ON COLUMN cost_objects.recovery_basis IS
  'D-16 Pricing Model B split: COST_TO_SERVE (feeds the ÷N per-unit price) | PLATFORM_INVESTMENT (feeds the separate payback line — NEVER divided into per-unit price). NULLABLE, NO CHECK (AC-4 — value-set grows without a migration, like cost_source). Orthogonal to node_type / cost_nature / cost_shape / cost_category. Derived-default rule (see recovery_basis_source for whether the owner has vetted it): EMPLOYEE owner/founder labor → PLATFORM_INVESTMENT, everything else → COST_TO_SERVE.';
COMMENT ON COLUMN cost_objects.recovery_basis_source IS
  'Provenance of the CURRENT recovery_basis: DERIVED = the system''s default guess (owner has NOT vetted) | EXPLICIT = owner-set. The "derived first, then explicit" honesty axis — surfaces which classifications still run on the system''s guess (D-16, Phase 2a). All backfilled rows = DERIVED; Phase 2b lets the owner override → EXPLICIT. NULLABLE, NO CHECK.';

-- ------------------------------------------------------------
-- 2. BACKFILL (derived default rule). Two statements, in order:
--    (a) classify EVERY row COST_TO_SERVE / DERIVED — the safe default, never investment;
--    (b) PROMOTE EMPLOYEE owner/founder labor to PLATFORM_INVESTMENT (source stays DERIVED).
--    recovery_basis_source = 'DERIVED' for ALL rows: this is a SUGGESTION the owner overrides
--    in 2b, not a verdict. A CLASSIFICATION only — no amount column is read or written.
-- ------------------------------------------------------------
UPDATE cost_objects
   SET recovery_basis = 'COST_TO_SERVE',
       recovery_basis_source = 'DERIVED'
 WHERE recovery_basis IS NULL;

UPDATE cost_objects co
   SET recovery_basis = 'PLATFORM_INVESTMENT'
 WHERE co.cost_category = 'labor'
   AND co.resource_id IN (
     SELECT id FROM labor_resources WHERE resource_type = 'EMPLOYEE'
   );

COMMIT;

-- ============================================================
-- SCHEMA-VERIFICATION GATE — run AFTER applying (live catalog, NOT memory).
-- scripts/verify-cost-objects.mjs runs (X)-(Z) via the Management API (PAT).
-- ============================================================
-- (X) recovery_basis — text, nullable, NO CHECK (loose by design):
--   SELECT data_type, is_nullable FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='recovery_basis';
--   -- expect: text, YES
--   SELECT COUNT(*)::int FROM pg_constraint
--    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_recovery_basis_check';
--   -- expect: 0
--
-- (Y) recovery_basis_source — text, nullable, NO CHECK:
--   SELECT data_type, is_nullable FROM information_schema.columns
--    WHERE table_schema='public' AND table_name='cost_objects' AND column_name='recovery_basis_source';
--   -- expect: text, YES
--   SELECT COUNT(*)::int FROM pg_constraint
--    WHERE conrelid='cost_objects'::regclass AND conname='cost_objects_recovery_basis_source_check';
--   -- expect: 0
--
-- (Z) backfill populated every row correctly:
--   SELECT recovery_basis, recovery_basis_source, COUNT(*)::int FROM cost_objects GROUP BY 1,2 ORDER BY 1,2;
--   -- expect: (COST_TO_SERVE, DERIVED) = 20 ; (PLATFORM_INVESTMENT, DERIVED) = 1 ; NO NULLs.
--   -- And the lone PLATFORM_INVESTMENT row IS the EMPLOYEE owner labor:
--   SELECT co.name FROM cost_objects co
--    WHERE co.recovery_basis='PLATFORM_INVESTMENT';
--   -- expect: exactly 'Owner (labor)' (cost_category='labor', resource_type='EMPLOYEE').
-- ============================================================
