-- Migration: customers member-read (membership + view_customers) + seed view_customers
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-07-10
-- Story: customer-first order entry (ways 1 & 4) · closes finding-D on attached orders
--
-- ⚠️ GATED — David applies this in the Supabase SQL editor as the default `postgres`
--    role. NOT applied by the builder. This is a TENANT-ISOLATION change (RLS) — the
--    careful category. Verification is embedded at the bottom (commented; uncomment and
--    run after apply). A MANAGER cannot be owner-proven on the customer lookup until this
--    is applied (owners already read customers via the pre-existing owner policy).
--
-- NEVER EDIT APPLIED MIGRATIONS. This appends; it touches no prior migration.
--
-- ── WHY (least-privilege row-level authorization at the DATA layer) ──────────────
--   `customers` today has ONE policy — customers_business_owner (FOR ALL, owner-only,
--   20260529_businesses_d_update_rls.sql:29-30). So only the business OWNER can read the
--   roster. But Path-A order entry (ScanOrder / /orders / /checkout/scan) is reachable by a
--   MANAGER (gated by qr_checkout, not owner-only), and customer-first order entry needs a
--   manager to LOOK UP an existing customer to attach them (way 1) — a read a manager
--   cannot do today. This adds a SELECT-only member policy, gated on active membership AND
--   the `view_customers` permission, so a manager (who holds view_customers) can read this
--   business's customers to power the attach typeahead — and nothing more (no member write;
--   the owner FOR ALL policy is the only write path, unchanged).
--
--   This is the standard pattern already used across the member-scoped tables
--   (is_active_member) fused with the financial-wall pattern (has_permission), so the read
--   grant is BOTH membership-scoped (AC-3, tenant isolation absolute) AND permission-gated
--   (a member without view_customers still cannot read — default-deny).
--
-- ── PART 1: the member SELECT policy (additive; owner policy untouched) ──────────
BEGIN;

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;  -- idempotent + defensive

DROP POLICY IF EXISTS customers_member ON customers;
CREATE POLICY customers_member ON customers
  FOR SELECT
  TO authenticated
  USING (
    public.is_active_member(business_id)
    AND public.has_permission(business_id, 'view_customers')
  );

-- ── PART 2: seed view_customers for OWNER + MANAGER (NOT staff — David grants staff
--    later in the /roles console). Three write targets, each idempotent (NOT-contains
--    guard) so this is safe to re-run:
--      (a) business_members.permissions — the jsonb the RLS gate above (has_permission)
--          actually reads. This is what makes an EXISTING manager able to read customers.
--      (b) role_definitions floor (business_id IS NULL) — the shared catalog + the source
--          role-apply/invite writes; keeps the /roles console + future members coherent.
--      (c) role_definitions tenant overrides (business_id IS NOT NULL) for OWNER/MANAGER —
--          keeps a tenant that customized its OWNER/MANAGER role coherent with the floor.
--    (Owners already read customers via customers_business_owner; seeding OWNER here is for
--     catalog/console coherence — harmless, and it makes the owner role show the chip.)

-- (a) existing member rows — the load-bearing seed (the RLS gate reads this)
UPDATE public.business_members
SET permissions = COALESCE(permissions, '[]'::jsonb) || '["view_customers"]'::jsonb
WHERE role IN ('OWNER', 'MANAGER')
  AND NOT (COALESCE(permissions, '[]'::jsonb) ? 'view_customers');

-- (b) shared floor catalog
UPDATE public.role_definitions
SET permissions = COALESCE(permissions, '[]'::jsonb) || '["view_customers"]'::jsonb
WHERE role_key IN ('OWNER', 'MANAGER')
  AND business_id IS NULL
  AND NOT (COALESCE(permissions, '[]'::jsonb) ? 'view_customers');

-- (c) per-tenant OWNER/MANAGER overrides
UPDATE public.role_definitions
SET permissions = COALESCE(permissions, '[]'::jsonb) || '["view_customers"]'::jsonb
WHERE role_key IN ('OWNER', 'MANAGER')
  AND business_id IS NOT NULL
  AND NOT (COALESCE(permissions, '[]'::jsonb) ? 'view_customers');

COMMIT;


-- ═══════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run AFTER applying (uncomment). Read-only; catalog + isolation.
-- ═══════════════════════════════════════════════════════════════════════════════

-- (A) STRUCTURE — customers now carries BOTH the owner policy and the new member policy.
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'customers'
-- ORDER BY policyname;
-- EXPECTED: customers_business_owner | ALL | (... businesses ... owner_id ...)
--           customers_member         | SELECT | (is_active_member(business_id) AND has_permission(business_id, 'view_customers'))

-- (B) SEED — OWNER + MANAGER member rows now hold view_customers; STAFF does NOT.
-- SELECT role, count(*) AS n, count(*) FILTER (WHERE permissions ? 'view_customers') AS with_view_customers
-- FROM public.business_members
-- GROUP BY role ORDER BY role;
-- EXPECTED: OWNER/MANAGER → with_view_customers == n ; STAFF → 0.

-- (C) FLOOR — the shared catalog OWNER/MANAGER floor rows hold view_customers.
-- SELECT role_key, permissions ? 'view_customers' AS has_it
-- FROM public.role_definitions
-- WHERE business_id IS NULL AND role_key IN ('OWNER','MANAGER','STAFF')
-- ORDER BY role_key;
-- EXPECTED: OWNER=true, MANAGER=true, STAFF=false.

-- (D) TENANT-ISOLATION PROOF (AC-3) — a manager reads ONLY their own business's customers,
--     never another tenant's. Impersonate an active MANAGER inside a rolled-back txn.
--     Replace :manager_email with a real active manager who holds view_customers.
--
-- BEGIN;
--   SELECT count(*) AS total_all_tenants FROM customers;  -- as postgres (RLS bypassed)
--   SELECT set_config(
--     'request.jwt.claims',
--     json_build_object('sub',
--       (SELECT bm.user_id FROM public.business_members bm
--        WHERE bm.role = 'MANAGER' AND bm.active = true
--          AND bm.permissions ? 'view_customers' LIMIT 1)
--     )::text, true);
--   SET LOCAL ROLE authenticated;
--   -- (a) the manager SEES their business's customers (the new capability).
--   SELECT count(*) AS manager_visible FROM customers;
--   -- (b) ISOLATION: every visible row belongs to a business the manager is an active member of.
--   SELECT count(*) AS cross_tenant_visible
--   FROM customers c
--   WHERE NOT public.is_active_member(c.business_id);
--   -- EXPECTED: cross_tenant_visible = 0 ; manager_visible <= total_all_tenants.
--   RESET ROLE;
-- ROLLBACK;

-- (E) DEFAULT-DENY — a member WITHOUT view_customers sees nothing (permission gate holds).
--     Impersonate an active STAFF member (no view_customers) and confirm 0 rows.
-- BEGIN;
--   SELECT set_config('request.jwt.claims',
--     json_build_object('sub',
--       (SELECT bm.user_id FROM public.business_members bm
--        WHERE bm.role = 'STAFF' AND bm.active = true
--          AND NOT (bm.permissions ? 'view_customers') LIMIT 1))::text, true);
--   SET LOCAL ROLE authenticated;
--   SELECT count(*) AS staff_visible FROM customers;  -- EXPECTED: 0
--   RESET ROLE;
-- ROLLBACK;
