-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727 — ALIGN THE SYSTEM FLOOR TO THE DEFAULT BUNDLES (David's ruling)
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres. AFTER 20260727_rbac_flip_corrections.sql. BEFORE the funnel calls.
--
-- 🔴 THIS NARROWS A DEFAULT. IT REVOKES NOTHING. No tenant exists to take authority from —
-- `f7ec5d67` carries its own tenant override rows and is untouched by this file. It changes what
-- a FUTURE tenant's roles receive on day one. The distinction matters when this is read back:
-- nobody loses anything here.
--
-- WHY. After the flip the MANAGER floor held costs:read, costs:delete, margin:read and
-- inventory:delete — faithful decompositions of view_costs/view_margin, no regression, correct
-- for a RENAME. But spec §4 says a confidential read is an OWNER GRANT, off by default, and §5
-- keeps inventory:delete off MANAGER. The concrete case is LAWNS as tenant two: Terry owns,
-- Lauren manages, and under the un-aligned floor Lauren receives Terry's FULL COST BASIS on day
-- one without Terry deciding anything. That is precisely what §4 exists to prevent, and it is the
-- demo.
--
-- ════════════════════════════════════════════════════════════════════════════════
-- THE MECHANISM — R-B2's PATTERN, SECOND APPLICATION
-- ════════════════════════════════════════════════════════════════════════════════
-- Aligning the floor and keeping the bundle would leave TWO representations of one fact with
-- nothing holding them together — capQ is source-based and cannot read `role_definitions`, so it
-- can never assert floor == bundle at runtime. Two agreeing representations with no mechanical
-- guard is the 2026-07-10 drift shape, which is how this whole thread started.
--
-- So: THE BUNDLE IS THE SOURCE AND THE FLOOR IS ITS MATERIALISATION.
--   · The literal below was GENERATED FROM `permissionManifest.ts`, never hand-typed.
--   · capQ assertion (d) FAILS when this list diverges from the bundle set — exactly as (b)
--     already reconciles the R-B2 `NOT IN` list against DECLARED_UNWIRED_PERMISSIONS.
--   · One authority in TypeScript; the derivation is checked, not trusted.
-- Editing the arrays below by hand will fail the build. Edit the bundle and regenerate.
--
-- OWNER IS SEEDED TOO, and that is deliberate (David's ruling A). Owner authority normally comes
-- from `businesses.owner_id` — but `assign_member_role` accepts p_role_key = 'OWNER', so a member
-- can hold role OWNER WITHOUT being the owner_id, and that person gets NO bypass at the table,
-- api or route layer. Their array is all they have. Excluding OWNER from the derivation would
-- leave its floor row unmanaged and free to drift — the exact thing being closed.
-- ════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- The floor is the shared catalog: business_id IS NULL. Tenant overrides are NOT touched.
UPDATE public.role_definitions rd
   SET permissions = v.perms
  FROM (VALUES
  ('OWNER', '["assets:create","assets:read","assets:update","audit_log:read","campaigns:read","campaigns:update","costs:create","costs:delete","costs:read","costs:update","customers:create","customers:read","customers:update","deliveries.route:read","deliveries:create","deliveries:read","deliveries:update","inventory:create","inventory:delete","inventory:import_price","inventory:read","inventory:update","inventory_ledger:read","margin:read","order_compliance_records:create","order_compliance_records:read","order_compliance_records:update","order_discount:apply","order_items:create","order_items:delete","order_items:read","order_items:update","order_service_selections:create","order_service_selections:delete","order_service_selections:read","order_service_selections:update","orders:create","orders:delete","orders:read","orders:update","pmi:read","pmi:update","pricing_recipe:read","pricing_recipe:update","service_offerings:read","settings:read","settings:update","tax_exempt:apply","tax_rate:read","tax_rate:update","team:read","wages:create","wages:delete","wages:read","wages:update"]'::jsonb),
  ('MANAGER', '["orders:read","orders:create","orders:update","order_items:read","order_service_selections:read","order_compliance_records:read","customers:read","customers:create","customers:update","service_offerings:read","inventory:read","inventory:create","inventory:update","inventory_ledger:read","deliveries:read","deliveries:update","deliveries.route:read","assets:read","assets:create","assets:update","pmi:read","pmi:update","tax_rate:read","tax_rate:update","settings:read","settings:update","campaigns:read","campaigns:update"]'::jsonb),
  ('STAFF', '["orders:create","orders:read","order_items:read","order_service_selections:read","order_compliance_records:read","customers:read","inventory:read","deliveries:read","deliveries:update","deliveries.route:read"]'::jsonb)
  ) AS v(role_key, perms)
 WHERE rd.business_id IS NULL
   AND rd.role_key = v.role_key
   AND rd.permissions IS DISTINCT FROM v.perms;   -- idempotent: a second run updates nothing

COMMIT;

-- ── V1 — the floor now equals the bundles. EXPECT OWNER 55 · MANAGER 28 · STAFF 10,
--    and legacy_left = 0 on every row.
-- SELECT role_key, jsonb_array_length(permissions) AS n,
--        (SELECT count(*) FROM jsonb_array_elements_text(permissions) x(s) WHERE x.s NOT LIKE '%:%') AS legacy_left
--   FROM public.role_definitions WHERE business_id IS NULL ORDER BY role_key;

-- ── V2 — NEGATIVE: the MANAGER floor no longer carries the cost basis. This is the whole point.
-- EXPECT 0 rows.
-- SELECT x.s FROM public.role_definitions rd, jsonb_array_elements_text(rd.permissions) x(s)
--  WHERE rd.business_id IS NULL AND rd.role_key = 'MANAGER'
--    AND x.s IN ('costs:read','costs:create','costs:update','costs:delete','margin:read','inventory:delete','wages:read');

-- ── V3 — NEGATIVE: no TENANT row was touched. EXPECT the f7ec5d67 MANAGER row still at 13
--    legacy strings, unchanged, because the funnel calls have not run yet.
-- SELECT business_id, role_key, jsonb_array_length(permissions) AS n
--   FROM public.role_definitions WHERE business_id IS NOT NULL ORDER BY role_key;

-- ── V4 — NEGATIVE: no declared-unwired string reached the floor (R-B2, capQ assertion c).
-- EXPECT 0 rows.
-- SELECT role_key, x.s FROM public.role_definitions rd, jsonb_array_elements_text(rd.permissions) x(s)
--  WHERE rd.business_id IS NULL
--    AND x.s IN ('maintenance:override','deliveries.route:update','campaigns:create',
--                'service_offerings:create','service_offerings:update','team:create','team:update','team:delete');
