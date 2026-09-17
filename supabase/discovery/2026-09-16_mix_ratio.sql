-- READ-ONLY DISCOVERY. WRITES NOTHING.
--
-- Question: what bill-of-materials values are STORED for LAWNS and Test Dave's?
--
-- Measured on origin/main 2a2f862 (2026-09-16): the BOM figures are NOT stored anywhere. They are
-- the code constant `BOM_RULES` in packages/cultivar-os/src/lib/loadList.ts:71-92, and no migration
-- creates a column or key for them. The only per-business home that COULD hold them is the jsonb
-- blob `business_operations_config.config` (20260905_production_planning.sql:57-62), whose
-- vocabulary is `OperationsConfig` (packages/shared/src/production/productionConfig.ts:67) and
-- contains none of these keys.
--
-- So the BOM columns below are EXPECTED to be NULL on both rows. A NULL here means "not stored"
-- (the load list uses the code value), NOT "zero". `has_ops_row = false` means the business has no
-- operations row at all, which is a different state from a row with no BOM keys. `all_ops_keys`
-- lists what IS in the blob, so an unexpected key shows up here even if it is not named below.
--
-- ✏️ 2026-09-16 (ledger #343, `feat/ladder-one-source`): the build that followed this discovery
-- moved the figures. The mix ratio is now the Operations key `installMixContainerVolumesPerTree`
-- (default 2.0), alongside `ropeFeetPerTPost`, `bubblersPerTree`, `deerFenceTPostsPerTree`; the
-- T-post counts moved to `container_ladder.install_t_posts_per_tree` and the threshold keys are gone.
-- The select below reads both the old and the new key names, so it answers either way.
-- Measured when this was committed: the table holds ONE row (Test Dave's) with none of these keys,
-- and LAWNS has no row.

SELECT
  b.id                                               AS business_id,
  b.name                                             AS business_name,
  (oc.business_id IS NOT NULL)                       AS has_ops_row,
  oc.config ->> 'installMixContainerVolumesPerTree'  AS install_mix_container_volumes_per_tree,
  oc.config ->> 'mixContainerVolumesPerTree'         AS mix_container_volumes_per_tree_old_key,
  oc.config ->> 'tPostsSmallThresholdGallons'        AS t_posts_small_threshold_gallons,
  oc.config ->> 'tPostsAtOrBelowThreshold'           AS t_posts_at_or_below_threshold,
  oc.config ->> 'tPostsAboveThreshold'               AS t_posts_above_threshold,
  oc.config ->> 'ropeFeetPerTPost'                   AS rope_feet_per_t_post,
  oc.config ->> 'bubblersPerTree'                    AS bubblers_per_tree,
  oc.config ->> 'deerFenceTPostsPerTree'             AS deer_fence_t_posts_per_tree,
  oc.config ->> 'tradeGallonFactor'                  AS trade_gallon_factor_not_a_mix_ratio,
  (SELECT array_agg(k ORDER BY k) FROM jsonb_object_keys(oc.config) AS k) AS all_ops_keys,
  oc.updated_at                                      AS ops_updated_at
FROM public.businesses b
LEFT JOIN public.business_operations_config oc ON oc.business_id = b.id
WHERE b.id IN (
  'ed2e5933-45dc-4b9b-a331-ddfd125e7a74',  -- LAWNS Tree Farm, LLC
  'f7ec5d67-a9ef-4cb0-b807-438d67687d1b'   -- Test Dave's Tree Nest
)
ORDER BY b.name;
