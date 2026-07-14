-- ============================================================================
-- GATED DATA BACKFILL — variant_group for existing business_inventory rows (D-45)
-- ============================================================================
-- WHY: the size-picker (count + order) only fires when ≥2 rows of ONE variety share a
--   NON-NULL variant_group AND carry DISTINCT sizes AND share the same NAME
--   (stockLineResolver.ts:73-83 detectSizeCollision + L4 name token-set equality).
--   David's existing rows have variant_group = NULL, so nothing groups. Going forward the
--   count-promote (D-45) sets variant_group in-flow when a variety is COUNTED; this SQL
--   pre-groups rows the owner hasn't re-counted yet (and is REQUIRED for the case where
--   a variety already has ≥2 ungrouped size-siblings — a scan of those goes ambiguous →
--   UNKNOWN and can't auto-backfill).
--
-- ⚠️  GATED — Thunder does NOT run this. David REVIEWS Step A, then runs Step C per variety.
-- ⚠️  Only TRUE size-siblings of ONE variety share a group. Different varieties get
--     DIFFERENT slugs. (David's "Shoal Creek Vitex" and "Flip Side Vitex" are DIFFERENT
--     varieties → they do NOT group together.)
-- ⚠️  business_id-scoped (AC-3). Replace <BID> with David's business_id. Additive, reversible
--     (UPDATE ... SET variant_group = NULL to undo).
--
-- No schema change. This is DATA, not a migration.
-- ============================================================================

-- ── STEP A — REVIEW: what's there now (run first, read only) ────────────────
SELECT id, name, size, variant_group, qty, sell_price
  FROM business_inventory
 WHERE business_id = '<BID>'
 ORDER BY name, size;

-- ── STEP B — FIND grouping candidates: variety NAMES with >1 row (true multi-size) ──
--     These are the names that NEED a shared variant_group so the picker fires.
SELECT name, count(*) AS size_rows, array_agg(size ORDER BY size) AS sizes,
       array_agg(DISTINCT variant_group) AS groups_now
  FROM business_inventory
 WHERE business_id = '<BID>'
 GROUP BY name
HAVING count(*) > 1
 ORDER BY name;

-- ── STEP C — BACKFILL one variety (run once per variety, keyed by its exact NAME) ──
--     Pick a stable slug (the product-slug convention, matching populate + the scanned
--     QR): lowercase, words hyphenated. Example below groups Shoal Creek Vitex's sizes.
--     Only touches NULL variant_group rows of that exact name (idempotent, safe to re-run).
UPDATE business_inventory
   SET variant_group = 'vitex-shoal-creek'          -- ← the slug for THIS variety
 WHERE business_id = '<BID>'
   AND name = 'Shoal Creek Vitex'                    -- ← this variety only
   AND variant_group IS NULL;

-- (repeat STEP C per multi-size variety from STEP B, each with its OWN slug + exact name)

-- ── STEP D — VERIFY: siblings now share a non-null group with distinct sizes ───────
SELECT name, variant_group, count(*) AS size_rows, array_agg(size ORDER BY size) AS sizes
  FROM business_inventory
 WHERE business_id = '<BID>'
   AND variant_group IS NOT NULL
 GROUP BY name, variant_group
 ORDER BY name;
-- Expect: each grouped variety shows size_rows ≥ 2 with DISTINCT sizes → the size-picker
-- (count + order) will now fire when that variety's QR / name is scanned.
