-- ════════════════════════════════════════════════════════════════════════════════
-- 20260727b — RE-ALIGN THE FLOOR AFTER RETIRING `assets:*` (David's ruling)
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, AFTER 20260727_align_floor_to_bundles.sql (which is APPLIED — §6 r1, so
-- this is a new file rather than an edit).
--
-- ⚠️ "BEFORE the funnel calls" — THAT WINDOW WAS MISSED. Corrected 2026-07-28 (ledger #163).
-- The four funnel calls ran on 2026-07-27 and THIS FILE DID NOT. Proof is arithmetic, not memory:
-- David's catalog read of the live floor returned OWNER 55 · MANAGER 28 · STAFF 10, which is
-- `20260727_align_floor_to_bundles.sql` EXACTLY, on all three roles — and this file sets
-- 52 · 25 · 10. STAFF matching at 10 in both is the control row: STAFF never held `assets:*`.
-- No migration after this one (27c/d/e/f/g, 20260728, 20260728b) touches `role_definitions`.
--
-- CONSEQUENCE, and it is the whole reason this header is being rewritten rather than the file
-- being replaced: the decomposition ran against an UNPRUNED alias table, so the retired strings
-- were carried into a live tenant. Editing an unapplied file is permitted (§6 r1 governs
-- already-run migrations; the arithmetic above is the proof this one has not run) — but the
-- ordering assumption in the original header is now a matter of record, not a plan.
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
--
-- ⚠️ THE SURVIVING SET IS **THREE**, NOT SIX — CORRECTED 2026-07-28 (ledger #163). The reverse
-- (legacy-checked) rows `view_costs → assets:*` are ALREADY GONE: #155's rename-only correction
-- deleted every legacy-checked row on a 1→many split, and `view_costs` is a split, so all fourteen
-- went. What survives is the NEW-checked direction only:
--     assets:read → view_costs · assets:create → view_costs · assets:update → view_costs
--
-- 🔴 AND THAT IS THE DIRECTION THAT MATTERS. The decomposition at
-- `20260727_rbac_resource_action_flip.sql:518` joins `ON a.implies_perm = legacy.s` — it matches
-- the SURVIVING side, so decomposing `view_costs` still EMITS `assets:read|create|update`. The
-- R-B2 output filter names eight declared-unwired strings and none of them is `assets:*`.
-- **While this file is unapplied, the next rename at ANY tenant re-mints the three phantoms.**
-- That is not a hypothetical: it already happened at f7ec5d67 (see the runbook below).
DELETE FROM public.permission_aliases
 WHERE from_perm IN ('assets:read','assets:create','assets:update')
    OR implies_perm IN ('assets:read','assets:create','assets:update');

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- 🔴 THIS FILE FIXES THE FLOOR AND THE ALIAS TABLE. IT DOES **NOT** FIX A LIVE MEMBER.
-- ════════════════════════════════════════════════════════════════════════════════
-- `business_members.permissions` and a TENANT `role_definitions` row are only ever written
-- through the funnel, with an audit row (#152). f7ec5d67's MANAGER holds `assets:create/read/
-- update` RIGHT NOW — the R4 retirement true in the repo and false in the database. Clearing it
-- is a FIFTH funnel call, `rbac-cleanup:assets-retired`:
--     docs/runbooks/2026-07-28-rbac-assets-retirement-cleanup.sql
-- Apply THIS migration first (floor + aliases), then run that runbook (tenant + members).

-- ── V1 — the floor no longer names a retired string. EXPECT OWNER 52 · MANAGER 25 · STAFF 10.
-- SELECT role_key, jsonb_array_length(permissions) AS n FROM public.role_definitions
--  WHERE business_id IS NULL ORDER BY role_key;

-- ── V2 — NEGATIVE, FLOOR ONLY. EXPECT 0 rows.
-- ⚠️ SCOPED TO `business_id IS NULL` ON PURPOSE (corrected 2026-07-28): unscoped, this query
-- returns the TENANT row's three strings and reads as a FAILURE of a migration that is behaving
-- correctly. The tenant half is the runbook's job, and it has its own check.
-- SELECT rd.role_key FROM public.role_definitions rd, jsonb_array_elements_text(rd.permissions) x(s)
--  WHERE rd.business_id IS NULL AND x.s LIKE 'assets:%';
-- SELECT * FROM public.permission_aliases WHERE from_perm LIKE 'assets:%' OR implies_perm LIKE 'assets:%';

-- ── V2b — POSITIVE CONTROL, before you run this file. EXPECT exactly THREE rows (the surviving
-- new-checked direction). If it returns SIX, #155 did not land and something else is wrong; if it
-- returns ZERO, this file has already been applied and V1 should already read 52/25/10.
-- SELECT from_perm, implies_perm FROM public.permission_aliases
--  WHERE from_perm LIKE 'assets:%' OR implies_perm LIKE 'assets:%';

-- ── V3 — NEGATIVE: `business_assets` really is gone (the phantom capP asserted against).
-- EXPECT 0 rows.
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename='business_assets';
