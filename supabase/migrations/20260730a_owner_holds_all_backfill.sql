-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PHASE 1a — THE OWNER HOLDS ALL, AND HOLDS IT AS STRINGS
-- 2026-07-30 · ruling "permissions always checked; owner holds all, locked, computed" (RULINGS.md)
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- THE RULING THIS IMPLEMENTS (David, 2026-07-30):
--   Permissions are ALWAYS checked. There is no exception path. The OWNER role holds every
--   enforced permission, LOCKED — computed from the manifest, not stored — so a new permission is
--   inherited automatically and nobody can remove one. `businesses.owner_id` is a FACT ABOUT WHO
--   OWNS THE BUSINESS; it is NOT an authority mechanism. Two owners = two members holding the same
--   locked set. Nothing special-cased.
--
-- THE SYMPTOM THAT PROVES THE DEFECT IS REAL, NOT THEORETICAL:
--   `get_business_tax_rate` calls `has_permission`, which has NO owner branch. The OWNER member
--   array holds 6 LEGACY strings, none of which is `tax_rate:read`, so the OWNER FAILS the check
--   and the screen reads "Tax: not identified." The MANAGER passes, because the MANAGER's array
--   was backfilled and the OWNER's was not — skipped on the theory that `owner_id` made it
--   unnecessary. The owner is worse off than his own manager. That theory is the defect.
--
-- 🔴 ORDER IS SAFETY-CRITICAL — THIS FILE APPLIES BEFORE PHASE 2.
--   Phase 2 deletes `BusinessProvider.tsx:695`'s `if (isOwnerActive) return true`. Until the OWNER
--   member arrays actually CONTAIN the strings, that short-circuit is the only thing granting the
--   owner anything on the client. Applying Phase 2 first locks David out of his own platform.
--   With this file applied first, removing the short-circuit changes NOTHING the owner can do.
--
-- WHY `reset` AND NOT `save` — the op choice is the design, not a detail.
--   `save` upserts a per-tenant OVERRIDE row. Using it here would mint an OWNER override in every
--   business, permanently detaching each tenant from the shared floor: the next manifest change
--   would reach the floor and NOT reach any tenant. That is the 2026-07-10 floor drift, re-created
--   by the very migration meant to end it.
--   `reset` DELETES the tenant override, lets the floor show through, and re-materialises every
--   active member from it (funnel lines 147-179). So: set the floor ONCE here, then `reset` every
--   business onto it. One authority, no per-tenant copies.
--
-- WHY THE R-B STRIP NEEDS NO CLAUSE: the funnel is WIPE-not-merge (sub-ruling #1) —
--   `UPDATE business_members SET permissions = v_resolved`, an assignment, not a union. The four
--   R-B strings (`view_dashboard`, `view_reports`, `manage_team`, `process_orders`) are not in the
--   floor set below, so they are gone by assignment. Writing a DELETE clause for them would be a
--   second mechanism for something the first already guarantees. V2 proves it rather than assuming.
--
-- ⚠️ THE 52 STRINGS BELOW ARE A HAND-MADE SNAPSHOT OF `OWNER_DEFAULT_BUNDLE`
--   (packages/shared/src/auth/permissionManifest.ts:1142) — SQL cannot read the TS register. The
--   manifest is the AUTHORITY; this is a copy, and a copy goes stale. The loop is closed in the
--   other direction by capA assertion 3 (Phase 2), which FAILS the build when this literal and the
--   manifest disagree — the same shape as capQ assertion (b) over the R-B2 list.
--
-- SCHEMA: none. No table, column, policy, constraint, FK or trigger is created or altered.
--   Two data writes (role_definitions floor row, business_members arrays) + audit rows.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1 — THE OWNER FLOOR BECOMES THE MANIFEST'S ENFORCED SET ────────────────────────────────────
-- The flip migration (20260727 §5) RENAMED this row — it decomposed the legacy strings it already
-- held into resource:verb words. It deliberately did NOT align it to the designed bundle, because
-- aligning a floor is a GRANT and a grant is its own authority act with its own reason string.
-- THIS IS THAT ACT, and this is its reason: the owner holds all, by ruling.
UPDATE public.role_definitions
   SET permissions = $OWNER$[
    "audit_log:read",
    "campaigns:read",
    "campaigns:update",
    "costs:create",
    "costs:delete",
    "costs:read",
    "costs:update",
    "customers:create",
    "customers:read",
    "customers:update",
    "deliveries.route:read",
    "deliveries:create",
    "deliveries:read",
    "deliveries:update",
    "inventory:create",
    "inventory:delete",
    "inventory:import_price",
    "inventory:read",
    "inventory:update",
    "inventory_ledger:read",
    "margin:read",
    "order_compliance_records:create",
    "order_compliance_records:read",
    "order_compliance_records:update",
    "order_discount:apply",
    "order_items:create",
    "order_items:delete",
    "order_items:read",
    "order_items:update",
    "order_service_selections:create",
    "order_service_selections:delete",
    "order_service_selections:read",
    "order_service_selections:update",
    "orders:create",
    "orders:delete",
    "orders:read",
    "orders:update",
    "pmi:read",
    "pmi:update",
    "pricing_recipe:read",
    "pricing_recipe:update",
    "service_offerings:read",
    "settings:read",
    "settings:update",
    "tax_exempt:apply",
    "tax_rate:read",
    "tax_rate:update",
    "team:read",
    "wages:create",
    "wages:delete",
    "wages:read",
    "wages:update"
]$OWNER$::jsonb,
       description = 'Holds every enforced permission in the manifest. LOCKED — computed from the '
                  || 'model, not curated. A new enforced permission is inherited automatically; no '
                  || 'permission can be removed, including by the owner (ruling 2026-07-30).',
       updated_at  = now()
 WHERE business_id IS NULL
   AND role_key    = 'OWNER';

-- ── §2 — EVERY BUSINESS RESETS ITS OWNER ROLE ONTO THAT FLOOR, THROUGH THE FUNNEL ───────────────
-- Not a direct UPDATE of business_members. The funnel is the ONLY way a role→permission fact
-- changes (ruling 2026-07-23, OPTION 1) and the §1 side-door trigger REFUSES a direct write anyway.
-- Going through it also produces the audit row that makes this backfill visible afterwards.
--
-- THE ACTOR IS THE REAL OWNER, NOT NULL. `assert_movement_actor`'s forgery pin only fires when
-- `auth.uid()` is non-NULL, and in the SQL editor it is NULL — so passing `businesses.owner_id`
-- satisfies both the membership check and `save_role_permissions`'s owner check, and the audit row
-- names a real person rather than a system ghost.
--
-- SKIPS a business whose `owner_id` IS NULL (the LAWNS row is one — CLAUDE.md §4 tracks it). The
-- funnel would refuse it and audit a `permission.self_elevation_denied` that means nothing here;
-- V4 reports those rows instead of burying them.
DO $$
DECLARE
  b record;
  v_rows int;
BEGIN
  FOR b IN
    SELECT id, name, owner_id
      FROM public.businesses
     WHERE owner_id IS NOT NULL
     ORDER BY name
  LOOP
    SELECT count(*) INTO v_rows
      FROM public.save_role_permissions(
             b.id,
             b.owner_id,
             'OWNER',
             'reset',
             NULL,
             NULL,
             '[]'::jsonb,                        -- ignored by `reset`; the floor is the source
             'rbac-model:owner-holds-all'        -- p_reason (ruling 4 — the audit says WHY)
           );
    RAISE NOTICE 'OWNER reset · % (%) · rows=%', b.name, b.id, v_rows;
  END LOOP;
END $$;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- V-CHECKS — run AFTER applying, one block at a time. Paste the OUTPUT into the ledger row,
-- not a sentence saying it passed. EVERY CHECK STATES ITS CORPUS.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- ── V1 — THE FLOOR IS THE 52. CORPUS: role_definitions, business_id IS NULL, role_key OWNER.
-- EXPECT: n = 52, legacy_remaining = 0.
-- SELECT jsonb_array_length(permissions) AS n,
--        (SELECT count(*) FROM jsonb_array_elements_text(permissions) x(s) WHERE s NOT LIKE '%:%')
--          AS legacy_remaining
--   FROM public.role_definitions WHERE business_id IS NULL AND role_key = 'OWNER';

-- ── V2 — THE SYMPTOM IS GONE, AND THE FOUR R-B STRINGS WENT WITH IT.
-- CORPUS: business_members, role='OWNER', active=true, all businesses.
-- EXPECT: one row per OWNER member · n = 52 · has_tax_rate_read = true · rb_survivors = 0.
-- 🔴 THIS IS THE ROW THAT ANSWERS "does the owner still see 'Tax: not identified'".
-- SELECT bm.name, jsonb_array_length(bm.permissions) AS n,
--        bm.permissions ? 'tax_rate:read' AS has_tax_rate_read,
--        (SELECT count(*) FROM jsonb_array_elements_text(bm.permissions) x(s)
--          WHERE s IN ('view_dashboard','view_reports','manage_team','process_orders')) AS rb_survivors
--   FROM public.business_members bm
--  WHERE bm.role = 'OWNER' AND bm.active = true
--  ORDER BY bm.name;

-- ── V3 — NO TENANT OVERRIDE SURVIVED. CORPUS: role_definitions, business_id IS NOT NULL.
-- EXPECT: 0 rows. A surviving OWNER override means some tenant is detached from the floor and
-- will NOT inherit the next manifest change — the drift this migration's op choice exists to avoid.
-- SELECT business_id, role_key, jsonb_array_length(permissions) AS n
--   FROM public.role_definitions WHERE business_id IS NOT NULL AND role_key = 'OWNER';

-- ── V4 — THE AUDIT TRAIL EXISTS AND CARRIES THE REASON. CORPUS: audit_log, today.
-- EXPECT: one `role.factory_reset` per business with a non-NULL owner_id, outcome 'success',
-- detail->>'reason' = 'rbac-model:owner-holds-all'. A `denied` row here = an owner_id problem,
-- not a permission problem — read the business name and fix the row.
-- SELECT business_id, action, outcome, detail->>'reason' AS reason,
--        (detail->>'members_affected')::int AS members_affected
--   FROM public.audit_log
--  WHERE action IN ('role.factory_reset','permission.self_elevation_denied')
--    AND created_at > now() - interval '1 hour'
--  ORDER BY created_at;

-- ── V5 — BUSINESSES THIS MIGRATION COULD NOT TOUCH. CORPUS: businesses, owner_id IS NULL.
-- EXPECT: whatever it returns is a KNOWN gap, not a surprise. Each row is a business whose OWNER
-- members were NOT backfilled and who will therefore hold nothing after Phase 2. Fix the owner_id,
-- then re-run §2's DO block for that business alone.
-- SELECT id, name FROM public.businesses WHERE owner_id IS NULL;
