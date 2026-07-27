-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727b — RE-ALIGN THE FLOOR AFTER RETIRING `assets:*` (David's ruling)
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, AFTER 20260727_align_floor_to_bundles.sql (which is APPLIED — §6 r1, so
-- this is a new file rather than an edit). BEFORE the funnel calls.
--
-- WHY. `assets` was minted by R4 from a description of `business_assets` — A TABLE RENAMED TO
-- `cost_objects` ON 2026-06-15, six weeks before the ruling. The resource lived in three bundles
-- and no schema. The /assets surface reads `cost_objects`, which is CONFIDENTIAL per §4 and gated
-- on `costs:read`, so a MANAGER held `assets:read` (bundle) and NOT `costs:read` (confidential):
-- they passed the route and read ZERO ROWS. #153's open-at-the-door-locked-at-the-vault defect,
-- reintroduced by the BUILD 2 route split, landing on the first tenant made from the new floor.
--
-- The route and tile now gate on `costs:read` — door matches vault. `assets:*` returns when 3b's
-- projection makes an operational/financial split inside cost_objects real. STRINGS LAND WHEN
-- ENFORCED, NOT BEFORE.
--
-- 🔴 STILL NARROWS A DEFAULT, REVOKES NOTHING. No tenant resolves from this floor yet.
-- Generated from permissionManifest.ts; capQ (d) reconciles this file against the bundles.

BEGIN;

UPDATE public.role_definitions rd
   SET permissions = v.perms
  FROM (VALUES
  ('OWNER', '["audit_log:read","campaigns:read","campaigns:update","costs:create","costs:delete","costs:read","costs:update","customers:create","customers:read","customers:update","deliveries.route:read","deliveries:create","deliveries:read","deliveries:update","inventory:create","inventory:delete","inventory:import_price","inventory:read","inventory:update","inventory_ledger:read","margin:read","order_compliance_records:create","order_compliance_records:read","order_compliance_records:update","order_discount:apply","order_items:create","order_items:delete","order_items:read","order_items:update","order_service_selections:create","order_service_selections:delete","order_service_selections:read","order_service_selections:update","orders:create","orders:delete","orders:read","orders:update","pmi:read","pmi:update","pricing_recipe:read","pricing_recipe:update","service_offerings:read","settings:read","settings:update","tax_exempt:apply","tax_rate:read","tax_rate:update","team:read","wages:create","wages:delete","wages:read","wages:update"]'::jsonb),
  ('MANAGER', '["orders:read","orders:create","orders:update","order_items:read","order_service_selections:read","order_compliance_records:read","customers:read","customers:create","customers:update","service_offerings:read","inventory:read","inventory:create","inventory:update","inventory_ledger:read","deliveries:read","deliveries:update","deliveries.route:read","pmi:read","pmi:update","tax_rate:read","tax_rate:update","settings:read","settings:update","campaigns:read","campaigns:update"]'::jsonb),
  ('STAFF', '["orders:create","orders:read","order_items:read","order_service_selections:read","order_compliance_records:read","customers:read","inventory:read","deliveries:read","deliveries:update","deliveries.route:read"]'::jsonb)
  ) AS v(role_key, perms)
 WHERE rd.business_id IS NULL
   AND rd.role_key = v.role_key
   AND rd.permissions IS DISTINCT FROM v.perms;

-- The alias rows for the retired strings: a legacy string may no longer decompose into a string
-- the model does not define. Deleting them keeps `view_costs`'s decomposition honest.
DELETE FROM public.permission_aliases
 WHERE from_perm IN ('assets:read','assets:create','assets:update')
    OR implies_perm IN ('assets:read','assets:create','assets:update');

COMMIT;

-- ── V1 — the floor no longer names a retired string. EXPECT OWNER 52 · MANAGER 25 · STAFF 10.
-- SELECT role_key, jsonb_array_length(permissions) AS n FROM public.role_definitions
--  WHERE business_id IS NULL ORDER BY role_key;

-- ── V2 — NEGATIVE: `assets:*` appears nowhere. EXPECT 0 rows from BOTH.
-- SELECT role_key FROM public.role_definitions rd, jsonb_array_elements_text(rd.permissions) x(s)
--  WHERE x.s LIKE 'assets:%';
-- SELECT * FROM public.permission_aliases WHERE from_perm LIKE 'assets:%' OR implies_perm LIKE 'assets:%';

-- ── V3 — NEGATIVE: `business_assets` really is gone (the phantom capP asserted against).
-- EXPECT 0 rows.
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='business_assets';
