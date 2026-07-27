-- ════════════════════════════════════════════════════════════════════════════════
-- RUNBOOK 2026-07-27 — GRANT `manage_orders` TO THE MANAGER ROLE, THROUGH THE FUNNEL
-- ════════════════════════════════════════════════════════════════════════════════
-- WHO RUNS IT: David, as `postgres`, in the Supabase SQL editor (project bgobkjcopcxusjsetfob).
-- WHY:  `manage_orders` gates FOUR api sites (`submit.ts` 238 tier/override · 1005 update ·
--       1223 delete · 1292 status, all via `callerCanManageOrders`) and appears in NO UI
--       catalog, so it has never been grantable. `callerCanManageOrders` falls through to
--       `businesses.owner_id` FIRST, so the OWNER is unaffected — but a MANAGER's only path is
--       the member array, and no MANAGER holds the string. Lauren cannot edit, cancel, or
--       re-status an order, and cannot invoke a tier or a service price override (the :238 gate
--       fails SOFT — the override is silently ignored and logged, not refused).
-- WHAT IT IS NOT: a direct `UPDATE business_members.permissions`. The #152
--       `enforce_member_authority_immutability` trigger REFUSES that, and the audit row is the
--       point. Everything below goes through `save_role_permissions`.
--
-- ROLE vs MEMBER — WHICH RPC, AND WHY THIS ONE:
--   · `save_role_permissions` writes the ROLE TEMPLATE (`role_definitions`) and then
--     RE-MATERIALIZES `business_members.permissions` for EVERY ACTIVE MEMBER of that role.
--     ← THIS IS THE ONE. Every MANAGER at the tenant holds it, not just Lauren.
--   · `assign_member_role` moves ONE member to a different ROLE. It does not change what a role
--     grants. Wrong tool here — it would not add the string to anything.
--
-- ⚠️ THREE THINGS TO KNOW BEFORE YOU RUN IT — each is a real consequence, not a caveat:
--
--   (1) `p_permissions` IS THE DESIRED FULL SET, AND PROPAGATION **WIPES, NOT MERGES**
--       (#152 sub-ruling 1, funnel §2 line 280). Passing `'["manage_orders"]'` would strip every
--       MANAGER down to that ONE string. STEP 2 therefore computes CURRENT ∪ {manage_orders}
--       from the live resolved role — never a hand-typed array.
--
--   (2) IT MINTS A TENANT OVERRIDE ROW. If this tenant has no `role_definitions` row for
--       MANAGER yet, the RPC INSERTs one (`business_id` = this tenant, `is_system` = false).
--       From that moment this tenant's MANAGER **stops tracking the system floor** — a later
--       change to the shared floor will NOT reach it. That is the designed two-layer model
--       (platform floor / tenant override), but it is a one-way door for this role at this
--       tenant, so it is named here rather than discovered later.
--
--   (3) ANY PER-PERSON EXTRA A MANAGER HOLDS BEYOND THE ROLE IS LOST. The wipe sets every
--       active MANAGER's array to the resolved role set exactly. STEP 1 shows you who is
--       affected and what each of them holds TODAY — read it before running STEP 3.
--
-- 🔴 AND THE ONE THAT OUTLIVES THIS SCRIPT — THE GRANT IS FRAGILE UNTIL THE PILL EXISTS:
--       `manage_orders` is not in the Roles-page catalog (`registryPermissions()` ∪
--       `ALL_FINANCIAL_PERMISSIONS` ∪ `ALL_ACTION_PERMISSIONS`, minus `HIDDEN_PERMISSIONS`).
--       The Roles tab submits the chip set it knows about as the desired set — so **the next
--       time anyone opens /team → Roles → MANAGER and clicks Save, the funnel will WIPE
--       `manage_orders` back out**, silently and with a correct-looking audit row. This SQL is
--       the stopgap; the durable fix is adding the string to the catalog so the pill renders.
--       Do not treat this as closed until it does.
-- ════════════════════════════════════════════════════════════════════════════════

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 0 — RESOLVE THE IDS, AND PROVE THEY ARE THE ONES YOU MEANT
-- ════════════════════════════════════════════════════════════════════════════════
-- You gave me 8-char prefixes (owner 95c1b2e9, member df7723be); tenant f7ec5d67 is the LAWNS
-- business id used throughout the #152/#153 verifies. Nothing below hardcodes a full uuid —
-- each is resolved from its prefix and asserted UNIQUE, so a typo fails loudly instead of
-- landing on the wrong row.
-- EXPECT: exactly 1 row. `owner_matches` MUST be true — that is the authorization the funnel
-- checks (`businesses.owner_id = p_actor_user_id`); if it is false the RPC will write a
-- `permission.self_elevation_denied` row and change nothing.
SELECT b.id                              AS business_id,
       b.name                            AS business_name,
       b.owner_id                        AS actor_user_id,
       (b.owner_id::text LIKE '95c1b2e9%') AS owner_matches,
       m.id                              AS lauren_member_id,
       m.name                            AS lauren_name,
       m.role                            AS lauren_role,
       m.active                          AS lauren_active,
       m.permissions                     AS lauren_permissions_now
  FROM public.businesses b
  LEFT JOIN public.business_members m
         ON m.business_id = b.id AND m.id::text LIKE 'df7723be%'
 WHERE b.id::text LIKE 'f7ec5d67%';

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 1 — THE BLAST RADIUS. READ THIS BEFORE STEP 3.
-- ════════════════════════════════════════════════════════════════════════════════
-- Every ACTIVE MANAGER at this tenant will be re-materialized to the resolved role set.
-- `loses_on_wipe` is the per-person extra that will be DESTROYED — it should be empty for
-- everyone. If it is not, STOP and decide (a per-person exception belongs on a cloned custom
-- role, per the #152 ruling), because the funnel has no merge mode.
WITH biz AS (SELECT id FROM public.businesses WHERE id::text LIKE 'f7ec5d67%'),
resolved AS (
  SELECT rd.permissions
    FROM public.role_definitions rd, biz
   WHERE rd.role_key = 'MANAGER'
     AND (rd.business_id = biz.id OR rd.business_id IS NULL)
   ORDER BY (rd.business_id IS NOT NULL) DESC
   LIMIT 1
)
SELECT m.id, m.name, m.role, m.permissions AS holds_now,
       (SELECT permissions FROM resolved)  AS role_resolves_to,
       (SELECT jsonb_agg(p) FROM jsonb_array_elements_text(m.permissions) p
         WHERE p NOT IN (SELECT jsonb_array_elements_text(permissions) FROM resolved))
                                           AS loses_on_wipe,
       (m.permissions ? 'manage_orders')   AS already_has_manage_orders
  FROM public.business_members m, biz
 WHERE m.business_id = biz.id AND m.role = 'MANAGER' AND m.active = true
 ORDER BY m.name;

-- ⚠️ IF STEP 1 RETURNS ZERO ROWS, DO NOT PROCEED — check the CASING first. The floor seed
--    writes `role_key = 'MANAGER'` (20260623:210) and the live OWNER arrays read 'OWNER', so
--    uppercase is expected on both `role_definitions.role_key` and `business_members.role`. A
--    zero-row STEP 1 means either no active MANAGER exists, or the casing differs — and in the
--    second case STEP 3 would write the template and propagate to NOBODY, looking like success:
--      SELECT DISTINCT role FROM public.business_members
--       WHERE business_id::text LIKE 'f7ec5d67%' AND active;

-- Also confirm whether a TENANT override row already exists (consequence 2 above).
-- 0 rows = STEP 3 will MINT one and this tenant's MANAGER stops tracking the floor.
SELECT id, business_id, role_key, is_system, label, permissions
  FROM public.role_definitions
 WHERE role_key = 'MANAGER'
 ORDER BY (business_id IS NOT NULL);   -- floor first, tenant row second (if any)

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 2 + 3 — THE GRANT, IN ONE TRANSACTION
-- ════════════════════════════════════════════════════════════════════════════════
-- Signature (20260723_permission_funnel.sql:192):
--   save_role_permissions(p_business_id uuid, p_actor_user_id uuid, p_role_key text,
--                         p_op text, p_label text, p_description text, p_permissions jsonb)
--   RETURNS TABLE(applied boolean, reason text, member_id uuid, member_name text,
--                 perms_before jsonb, perms_after jsonb)
--
-- p_op = 'save'          → v_action 'role.permissions_changed' (NOT 'create'/'reset'/'delete').
-- p_label/p_description  → COALESCE'd with the existing row on UPDATE, but written verbatim on
--                          INSERT — so they are read from the resolved role and passed back,
--                          otherwise a freshly-minted tenant row would have a NULL label.
-- p_permissions          → CURRENT RESOLVED SET ∪ {'manage_orders'}, computed live. Idempotent:
--                          re-running is a no-op on content (it still writes an audit row).
--
-- Wrapped in an explicit transaction so you can read the returned rows and ROLLBACK if the
-- before/after is not what STEP 1 predicted. The funnel's `trace.authority_funnel` GUC is
-- transaction-local and set INSIDE the function — an outer BEGIN does not interfere.

BEGIN;

WITH biz AS (
  SELECT id, owner_id FROM public.businesses WHERE id::text LIKE 'f7ec5d67%'
),
resolved AS (
  SELECT rd.label, rd.description, rd.permissions
    FROM public.role_definitions rd, biz
   WHERE rd.role_key = 'MANAGER'
     AND (rd.business_id = biz.id OR rd.business_id IS NULL)
   ORDER BY (rd.business_id IS NOT NULL) DESC
   LIMIT 1
),
desired AS (
  SELECT r.label,
         r.description,
         -- CURRENT ∪ {manage_orders}, de-duplicated, order-stable. NEVER a hand-typed array:
         -- p_permissions is the DESIRED FULL SET and propagation WIPES.
         (SELECT jsonb_agg(DISTINCT p)
            FROM (SELECT jsonb_array_elements_text(r.permissions) AS p
                  UNION SELECT 'manage_orders') u(p)) AS perms
    FROM resolved r
)
SELECT f.*
  FROM biz, desired d,
       LATERAL public.save_role_permissions(
         biz.id,             -- p_business_id
         biz.owner_id,       -- p_actor_user_id  ← owner 95c1b2e9, read from the row, not typed
         'MANAGER',          -- p_role_key       ← uppercase; matches the floor seed (20260623:210)
         'save',             -- p_op
         d.label,            -- p_label
         d.description,      -- p_description
         d.perms             -- p_permissions    ← the FULL desired set
       ) f;

-- ── READ THE RETURN BEFORE COMMITTING ────────────────────────────────────────────
-- One row PER AFFECTED MEMBER: applied=true, member_id, member_name, perms_before, perms_after.
-- `perms_after` must contain 'manage_orders' and must contain everything `perms_before` did.
-- If zero members were affected you get ONE summary row (applied=true, member_id NULL) — that
-- means no ACTIVE member currently carries role='MANAGER'; the template still changed.
-- applied=false with a reason = the actor is not the owner; NOTHING was written except a
-- `permission.self_elevation_denied` audit row. ROLLBACK and re-check STEP 0's owner_matches.

COMMIT;   -- ← or ROLLBACK; if the before/after is not what STEP 1 predicted.

-- ════════════════════════════════════════════════════════════════════════════════
-- STEP 4 — THE PROOFS. Run all four.
-- ════════════════════════════════════════════════════════════════════════════════

-- 4a. THE AUDIT ROW the funnel wrote (funnel §2 line 289 — inside the same transaction, so a
--     grant that is not recorded did not happen).
-- EXPECT: 1 row · action `role.permissions_changed` · target_type `role` · target_id `MANAGER`
--         · actor_role `OWNER` · outcome `success` · detail carrying {before, after,
--         members_affected, members:[{id, before, after}]}.
SELECT id, created_at, actor_user_id, actor_role, action, target_type, target_id, outcome,
       detail -> 'members_affected'        AS members_affected,
       detail -> 'before'                  AS role_before,
       detail -> 'after'                   AS role_after,
       jsonb_pretty(detail -> 'members')   AS per_member_before_after
  FROM public.audit_log
 WHERE business_id::text LIKE 'f7ec5d67%'
   AND action IN ('role.permissions_changed', 'permission.self_elevation_denied')
 ORDER BY created_at DESC
 LIMIT 3;

-- 4b. THE MEMBER ROW actually moved (this is the #151 defect — the template changing while the
--     member row did not is exactly what the funnel exists to prevent).
-- EXPECT: Lauren `has_manage_orders` = true.
SELECT m.id, m.name, m.role, m.active,
       (m.permissions ? 'manage_orders') AS has_manage_orders,
       m.permissions
  FROM public.business_members m
 WHERE m.business_id::text LIKE 'f7ec5d67%' AND m.role = 'MANAGER' AND m.active
 ORDER BY m.name;

-- 4c. THE TEMPLATE row (so the next MANAGER minted at this tenant inherits it).
-- EXPECT: a tenant row (business_id NOT NULL, is_system=false) whose permissions contain
--         'manage_orders'.
SELECT business_id, role_key, is_system, label, permissions ? 'manage_orders' AS has_it, permissions
  FROM public.role_definitions
 WHERE role_key = 'MANAGER'
 ORDER BY (business_id IS NOT NULL);

-- 4d. THE GATE ITSELF — the only proof that matters, run as Lauren, not as postgres.
--     `has_permission` reads auth.uid(), which is NULL under the SQL editor's postgres role and
--     would return FALSE for everyone. Impersonate.
-- EXPECT: manage_orders_now = TRUE.
BEGIN;
  SET LOCAL role authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"<LAUREN user_id — business_members.user_id for df7723be>"}';
  SELECT public.has_permission(
           (SELECT id FROM public.businesses WHERE id::text LIKE 'f7ec5d67%'),
           'manage_orders') AS manage_orders_now;
ROLLBACK;

-- 4e. THE REAL ONE — David, then Lauren, in the APP: open an order and change its status /
--     edit a line / cancel it while signed in AS LAUREN. 4d proves the string resolves; only
--     the app proves `callerCanManageOrders` lets her through with a live Bearer token. The
--     `[TRACE:ROSTER]` REFUSED lines in `submit.ts` are what a failure looks like.
