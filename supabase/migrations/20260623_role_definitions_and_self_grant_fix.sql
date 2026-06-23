-- Migration: close the bm_self_update self-grant hole + three-tier role-definition storage
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-06-23
-- Branch: main
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
--
-- ⚠️  APPLY NOTE FOR DAVID: run in the Supabase SQL editor as the default `postgres`
--   role. The two new functions must be OWNED BY postgres so their SECURITY DEFINER
--   bodies bypass RLS (same load-bearing ownership rule as is_active_member /
--   has_permission, 20260622). The system-floor seed (§3) also relies on postgres
--   bypassing the role_definitions RLS to write the business_id-NULL anchor rows.
--
-- PREREQ (must already be live): 20260622_is_active_member_canonical_rls.sql
--   (this migration calls public.is_active_member(uuid) in the role_definitions read policy).
--
-- ── WHY THIS MIGRATION (two ordered concerns) ───────────────────────────────────
--   PART A1  Close the bm_self_update self-grant hole. The current policy
--            (20260602_shared_members_a_create_tables.sql:60) is:
--                CREATE POLICY bm_self_update ON business_members
--                  FOR UPDATE USING (user_id = auth.uid());
--            — USING-only, NO WITH CHECK. A member may UPDATE its own row with ANY
--            new values, including widening its OWN `permissions` jsonb or changing its
--            OWN `role`. That walks around the entire role system (cost wall included)
--            from the inside: self-elevation. This is the 3rd instance of the
--            write-without-authority pattern (after the +cost button and the cost-apply
--            service-key bypass) and the most dangerous. Per MB_D-015 (write-authority
--            >= read-authority) applied to the permission table itself.
--
--   PART A2  Three-tier role-definition storage (neither codebase had it): a shared
--            system-role floor + per-tenant overrides + per-tenant custom roles, so the
--            PART B role-config console writes role definitions to a real, RLS-scoped
--            store instead of mutating member rows directly.
--
-- ── WHY A TRIGGER FOR A1, NOT A PURE-RLS WITH CHECK (state-which-and-why) ────────
--   Column IMMUTABILITY ("role/permissions may not change on a self-update") is not a
--   row predicate — it is a comparison of NEW vs OLD. RLS WITH CHECK only sees the NEW
--   row; it cannot reference OLD. The pure-RLS workaround (a WITH CHECK self-subquery
--   `role = (SELECT role FROM business_members WHERE id = ...)` to read the pre-statement
--   value) re-enters business_members inside a business_members policy — exactly the
--   self-referential recursion hazard this codebase already hit on `businesses`
--   (42P17; see 20260622 §"WHY A SECURITY DEFINER HELPER"). The correct, recursion-free
--   mechanism for column immutability is a BEFORE UPDATE trigger with direct OLD/NEW
--   access. So A1 = trigger (authority-column immutability) + a tightened WITH CHECK on
--   bm_self_update (a genuine row predicate: a member may not reassign its row's user_id
--   to someone else). The owner path is unaffected: bm_owner_all is a separate permissive
--   policy that is OR'd in, and the trigger explicitly permits owner-authored changes.
--
-- AC-1 (no vertical nouns) · AC-2 (membership-scoped) · AC-3 (tenant isolation absolute).


-- ════════════════════════════════════════════════════════════════════════════════
-- PART A1 — close the self-grant hole
-- ════════════════════════════════════════════════════════════════════════════════

-- ── A1.a  Trigger: role/permissions are owner-authority columns ──────────────────
-- Blocks any UPDATE that changes business_members.role or .permissions unless the
-- caller is the business owner. Service/migration context (auth.uid() IS NULL — service
-- key, backfills, this migration) is permitted so admin tooling is not broken.
CREATE OR REPLACE FUNCTION public.enforce_member_authority_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.permissions IS DISTINCT FROM OLD.permissions THEN

    -- No JWT = service/migration/admin context → allowed (backfills, server service key).
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;

    -- Authority changes require business-owner authority. A member editing its OWN row
    -- (the bm_self_update path) is by definition not the owner of that authority check,
    -- so a self-elevation attempt raises here even though RLS USING (user_id = auth.uid())
    -- would otherwise let the UPDATE through.
    IF NOT EXISTS (
      SELECT 1 FROM public.businesses
      WHERE id = NEW.business_id AND owner_id = auth.uid()
    ) THEN
      RAISE EXCEPTION
        'business_members.role/permissions may only be changed by the business owner (self-elevation blocked)'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Owned-by-postgres SECURITY DEFINER → the owner-check reads businesses with RLS bypassed,
-- so it is reliable regardless of the caller's row visibility.

DROP TRIGGER IF EXISTS trg_business_members_authority_guard ON business_members;
CREATE TRIGGER trg_business_members_authority_guard
  BEFORE UPDATE ON business_members
  FOR EACH ROW EXECUTE FUNCTION public.enforce_member_authority_immutability();

-- ── A1.b  Tighten bm_self_update with a WITH CHECK (row-ownership predicate) ──────
-- USING unchanged (a member may target its own row). The new WITH CHECK prevents a
-- member from reassigning its row's user_id to another account. Authority-column
-- immutability is enforced by the trigger above (A1.a), not here.
DROP POLICY IF EXISTS bm_self_update ON business_members;
CREATE POLICY bm_self_update ON business_members
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ════════════════════════════════════════════════════════════════════════════════
-- PART A2 — three-tier role-definition storage
-- ════════════════════════════════════════════════════════════════════════════════

-- role_definitions holds role -> permission-set definitions in three tiers:
--   1. SHARED FLOOR     business_id IS NULL,     is_system = true   (seeded anchors, locked)
--   2. PER-TENANT OVER  business_id = <tenant>,  role_key matches a floor key (tuned copy)
--   3. PER-TENANT CUSTOM business_id = <tenant>, is_system = false  (new role the tenant made)
--
-- RESOLUTION CHAIN (performed in app code at read time — this table only stores):
--   shared floor (business_id IS NULL, role_key)
--     -> per-tenant override (business_id = X, role_key)  [if present, replaces the floor]
--       -> member's own business_members.permissions jsonb [final per-member grant]
--
-- FACTORY-RESET = DELETE the tenant's override row so the floor shows through again
--   (NOT a snapshot restore — MB_D-010). The floor rows are immutable anchors.
--
-- DATA-EXTENSIBLE: the 5-role doctrine (MB_D-010) adds TECH / SERVICE later as new floor
--   SEED ROWS — no schema change. Seeded with the 3 roles that match code reality today
--   (DEFAULT_PERMISSIONS, packages/cultivar-os/src/auth/roles.ts:43).
--
-- business_id NULL = the shared floor (chosen over a sentinel UUID: cleaner, and the
--   partial unique indexes below give the floor its own uniqueness namespace).

CREATE TABLE IF NOT EXISTS role_definitions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id  uuid        REFERENCES businesses(id) ON DELETE CASCADE,
  -- NULL = shared system floor; non-NULL = a tenant override or custom role
  role_key     text        NOT NULL,
  is_system    boolean     NOT NULL DEFAULT false,
  label        text,
  description  text,
  permissions  jsonb       NOT NULL DEFAULT '[]'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- Uniqueness: one floor row per role_key; one tenant row per (business_id, role_key).
-- Partial indexes because a plain UNIQUE(business_id, role_key) treats NULL business_id
-- as distinct, which would let duplicate floor rows in.
CREATE UNIQUE INDEX IF NOT EXISTS role_definitions_floor_key
  ON role_definitions (role_key) WHERE business_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS role_definitions_tenant_key
  ON role_definitions (business_id, role_key) WHERE business_id IS NOT NULL;

ALTER TABLE role_definitions ENABLE ROW LEVEL SECURITY;

-- READ: the shared floor is visible to every authenticated user; tenant rows are visible
-- only to active members of that business (so the app can resolve the chain). AC-3.
CREATE POLICY rd_read ON role_definitions
  FOR SELECT TO authenticated
  USING (business_id IS NULL OR public.is_active_member(business_id));

-- WRITE: business owner only, and only on their OWN tenant rows. business_id IS NOT NULL
-- in both USING and WITH CHECK means the shared floor (business_id NULL) is NEVER matched
-- by this policy → floor rows are not tenant-writable (locked anchors; only postgres /
-- service seeds them). Covers INSERT/UPDATE/DELETE → owner creates custom roles, tunes
-- overrides, and factory-resets by deleting the override row.
CREATE POLICY rd_owner_write ON role_definitions
  FOR ALL TO authenticated
  USING (
    business_id IS NOT NULL
    AND business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  )
  WITH CHECK (
    business_id IS NOT NULL
    AND business_id IN (SELECT id FROM businesses WHERE owner_id = auth.uid())
  );

-- updated_at auto-stamp
CREATE OR REPLACE FUNCTION public.set_role_definitions_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_role_definitions_updated_at ON role_definitions;
CREATE TRIGGER trg_role_definitions_updated_at
  BEFORE UPDATE ON role_definitions
  FOR EACH ROW EXECUTE FUNCTION public.set_role_definitions_updated_at();


-- ════════════════════════════════════════════════════════════════════════════════
-- PART A3 — seed the system-role floor (3 now; extensible to 5 by data)
-- ════════════════════════════════════════════════════════════════════════════════
-- Permissions match DEFAULT_PERMISSIONS exactly (roles.ts:43):
--   OWNER   = all 12   MANAGER = 9   STAFF = 3
-- Idempotent: WHERE NOT EXISTS so re-running this migration is a no-op for existing floor.
INSERT INTO role_definitions (business_id, role_key, is_system, label, description, permissions)
SELECT NULL, v.role_key, true, v.label, v.description, v.permissions::jsonb
FROM (VALUES
  (
    'OWNER', 'Owner',
    'Full access — settings, team, QB, all reports',
    '["view_dashboard","qr_checkout","view_orders","manage_deliveries","manage_customers","manage_campaigns","view_reports","manage_settings","view_wages","view_pricing_config","view_costs","view_margin"]'
  ),
  (
    'MANAGER', 'Manager',
    'Day-to-day ops — checkout, deliveries, campaigns, orders',
    '["view_dashboard","qr_checkout","view_orders","manage_deliveries","manage_customers","manage_campaigns","view_reports","view_costs","view_margin"]'
  ),
  (
    'STAFF', 'Staff',
    'QR checkout and order history only',
    '["view_dashboard","qr_checkout","view_orders"]'
  )
) AS v(role_key, label, description, permissions)
WHERE NOT EXISTS (
  SELECT 1 FROM role_definitions r
  WHERE r.business_id IS NULL AND r.role_key = v.role_key
);


-- ════════════════════════════════════════════════════════════════════════════════
-- CATALOG-VERIFICATION GATE (run AFTER apply, with a short-lived PAT) — §9
-- These hit the live catalog, never builder memory. Expected results in [brackets].
-- ════════════════════════════════════════════════════════════════════════════════
-- (A) self-grant trigger is live:
--   SELECT tgname, tgenabled FROM pg_trigger
--   WHERE tgrelid = 'business_members'::regclass AND tgname = 'trg_business_members_authority_guard';
--   [1 row, tgenabled = 'O']
-- (B) bm_self_update now carries a WITH CHECK:
--   SELECT polname, pg_get_expr(polqual, polrelid) AS using_expr,
--          pg_get_expr(polwithcheck, polrelid) AS check_expr
--   FROM pg_policy WHERE polrelid = 'business_members'::regclass AND polname = 'bm_self_update';
--   [using_expr = (user_id = auth.uid()), check_expr = (user_id = auth.uid())  -- check_expr NOT NULL]
-- (C) trigger fn owned by postgres + SECURITY DEFINER:
--   SELECT proname, prosecdef, pg_get_userbyid(proowner) AS owner
--   FROM pg_proc WHERE proname = 'enforce_member_authority_immutability';
--   [prosecdef = true, owner = postgres]
-- (D) role_definitions table + RLS enabled:
--   SELECT relrowsecurity FROM pg_class WHERE relname = 'role_definitions';   [true]
-- (E) partial unique indexes present:
--   SELECT indexname FROM pg_indexes WHERE tablename = 'role_definitions'
--   AND indexname IN ('role_definitions_floor_key','role_definitions_tenant_key');   [2 rows]
-- (F) policies present:
--   SELECT polname FROM pg_policy WHERE polrelid = 'role_definitions'::regclass;   [rd_read, rd_owner_write]
-- (G) floor seeded, 3 system rows, correct counts:
--   SELECT role_key, is_system, jsonb_array_length(permissions) AS n
--   FROM role_definitions WHERE business_id IS NULL ORDER BY role_key;
--   [MANAGER true 9, OWNER true 12, STAFF true 3]
-- (H) FK cascade on tenant rows:
--   SELECT confdeltype FROM pg_constraint
--   WHERE conrelid = 'role_definitions'::regclass AND contype = 'f';   ['c' (CASCADE)]
