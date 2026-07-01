-- ============================================================
-- Migration: cost_objects — add estimated_value (what-it's-worth) axis
-- Project: bgobkjcopcxusjsetfob (Cultivar OS / shared layer)
-- Date: 2026-07-01
-- Decision: THUNDER asset-capture recon 2026-07-01 — David chose the TWO-FIELD
--           model (AskUserQuestion "Field model" = "Two fields").
--
--   acquisition_cost  = WHAT I PAID    → cost-to-produce / CAPEX payback (EXISTING)
--   estimated_value   = WHAT IT'S WORTH → net-worth / insurance surface  (NEW, this file)
--
-- The two are semantically distinct and are NOT overloaded onto one column: an
-- AI Vision estimate of a used asset's market value is "what it's worth now", not
-- "what was paid" — mixing them would corrupt cost-to-produce (payback/depreciation
-- would run off a Vision guess rather than actual outlay).
--
-- AC-1: no vertical nouns — these are general `business_`-layer columns on a
--       shared table; value-set stays vocabulary-free.
-- AC-4: additive, lossless, non-destructive (ADD COLUMN only; nullable; no default
--       rewrite). Existing rows stay valid before and after.
--
-- ⚠️  APPLY MANUALLY in the Supabase SQL editor (project bgobkjcopcxusjsetfob),
--     AS postgres — do NOT execute without David's explicit "run it". After applying,
--     mint a short-lived PAT and run the catalog proof (independent schema-verification
--     gate — hits the live catalog, not the builder's memory):
--         SUPABASE_PAT=sbp_xxx node scripts/verify-cost-objects.mjs
--     then REVOKE the PAT.
--
-- DEPLOY-WINDOW SAFE: the app write path (AssetCapture) degrades gracefully when
-- these columns are absent — on a PostgREST "column does not exist" (42703 / PGRST204)
-- it retries the insert WITHOUT the estimated_value fields, so asset capture never
-- hard-fails before this migration applies (mirrors the deliveries service_type
-- fallback pattern). Remove that fallback once this gate is green.
-- ============================================================
-- Pre-write verify (run BEFORE applying, to confirm the columns are genuinely absent):
--   SELECT column_name FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='cost_objects'
--     AND column_name IN ('estimated_value','estimated_value_confidence');
--   -- Expect 0 rows.
-- ============================================================

BEGIN;

ALTER TABLE cost_objects
  -- What the asset is WORTH now (market/insurance value). DISTINCT from
  -- acquisition_cost. NULL = UNKNOWN worth — NEVER written as 0 (Surface Honesty).
  ADD COLUMN estimated_value numeric(10,2),
  -- The epistemic status of estimated_value, INDEPENDENT of cost_confidence
  -- (which grades acquisition_cost). An AI Vision estimate lands ESTIMATED; an
  -- owner edit promotes it to CONFIRMED — same four-value ladder as cost_confidence.
  ADD COLUMN estimated_value_confidence text
    CHECK (estimated_value_confidence IN ('CONFIRMED', 'DERIVED', 'ESTIMATED', 'UNKNOWN'));

COMMENT ON COLUMN cost_objects.estimated_value IS
  'What the asset is WORTH now (market / insurance / net-worth value). DISTINCT from acquisition_cost (what was paid — cost-to-produce/CAPEX). Populated by the asset-capture Vision estimate at ESTIMATED confidence; owner edit → CONFIRMED. NULL = UNKNOWN worth, never 0 (Surface Honesty). Meaningful for node_type=ASSET.';

COMMENT ON COLUMN cost_objects.estimated_value_confidence IS
  'Epistemic status of estimated_value (CONFIRMED|DERIVED|ESTIMATED|UNKNOWN), independent of cost_confidence which grades acquisition_cost. AI Vision estimate → ESTIMATED; owner edit → CONFIRMED. Same ladder as cost_confidence.';

COMMIT;

-- ============================================================
-- CATALOG PROOF (run AFTER applying, with a short-lived PAT, then revoke it):
--
-- (EV1) estimated_value — numeric, nullable, on cost_objects:
--   SELECT data_type, is_nullable, numeric_precision, numeric_scale
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='cost_objects' AND column_name='estimated_value';
--   -- Expect: numeric, YES, 10, 2
--
-- (EV2) estimated_value_confidence — text, nullable, on cost_objects:
--   SELECT data_type, is_nullable
--   FROM information_schema.columns
--   WHERE table_schema='public' AND table_name='cost_objects' AND column_name='estimated_value_confidence';
--   -- Expect: text, YES
--
-- (EV3) the CHECK constraint enumerates exactly the four ladder values:
--   SELECT pg_get_constraintdef(oid)
--   FROM pg_constraint
--   WHERE conrelid='cost_objects'::regclass
--     AND conname LIKE '%estimated_value_confidence%';
--   -- Expect: CHECK ((estimated_value_confidence = ANY (ARRAY['CONFIRMED','DERIVED','ESTIMATED','UNKNOWN'])))
--
-- (EV4) existing rows still valid (no NOT NULL / no default rewrite):
--   SELECT count(*) AS total,
--          count(estimated_value) AS with_value,
--          count(estimated_value_confidence) AS with_conf
--   FROM cost_objects;
--   -- Expect: total = pre-migration count; with_value = 0; with_conf = 0 (all NULL, additive).
--
-- (EV5) round-trip insertability (in a BEGIN…ROLLBACK, real business_id):
--   BEGIN;
--   UPDATE cost_objects SET estimated_value = 1234.56, estimated_value_confidence='ESTIMATED'
--   WHERE id = (SELECT id FROM cost_objects WHERE node_type='ASSET' LIMIT 1)
--   RETURNING estimated_value, estimated_value_confidence;
--   ROLLBACK;
-- ============================================================
