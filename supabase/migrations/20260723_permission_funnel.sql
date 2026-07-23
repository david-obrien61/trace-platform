-- ════════════════════════════════════════════════════════════════════════════════
-- THE PERMISSION FUNNEL — one path, one store, audited (David's ruling 2026-07-23, OPTION 1)
-- ════════════════════════════════════════════════════════════════════════════════
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-07-23
-- Branch: main
--
-- NEVER EDIT APPLIED MIGRATIONS. Append new migrations for changes.
--
-- ⚠️ APPLY NOTE FOR DAVID: run in the Supabase SQL editor as the default `postgres`
--   role. Every function below must be OWNED BY postgres + SECURITY DEFINER (the
--   load-bearing ownership rule — is_active_member / has_permission / is_member_of /
--   enforce_member_authority_immutability all rely on it). The funnel WRITES member
--   rows, so its DEFINER body must bypass the member RLS the same way.
--
-- PREREQ (must already be live):
--   • 20260623_role_definitions_and_self_grant_fix.sql  (role_definitions table + the
--     enforce_member_authority_immutability trigger this migration AMENDS)
--   • 20260623_audit_log_spine.sql                       (audit_log — the funnel's first
--     real writer of role.*/member.*/permission.* verbs)
--   • 20260720_inventory_movement_ledger.sql             (public.is_member_of / assert_movement_actor)
--
-- ── WHY THIS MIGRATION ──────────────────────────────────────────────────────────
-- The recon (docs/decisions/2026-07-23-permission-write-sites-recon.md) proved the /team
-- Roles tab writes role_definitions (a TEMPLATE store) while every gate reads
-- business_members.permissions (the per-MEMBER store), and NOTHING carries a Roles-tab
-- edit from the first into the second — so the screen an owner uses to grant a permission
-- does not grant it. THREE stores held role→permission facts (RD template, BM.perms, the
-- stale DEFAULT_PERMISSIONS constant); the gate consulted only one; nothing kept them in sync.
--
-- David's ruling (OPTION 1, 2026-07-23): KEEP the two-layer role_definitions model (system
-- floor = the PLATFORM owner's lever; per-tenant override = the business owner's lever) and
-- ADD the propagation that was never built. This migration is that propagation, made
-- STRUCTURALLY the only way authority can change.
--
-- ── THE FUNNEL SHAPE (D-50's ledger, applied to governance) ─────────────────────
-- D-50 made a quantity un-moveable without a ledger row by absorbing 14 emit points into 6
-- RPCs and REFUSING the alternatives at the database. This migration does the same for
-- permissions: two RPCs (save_role_permissions / assign_member_role) are the ONLY way a
-- role→permission fact changes, and §1 CLOSES the direct-UPDATE side door so "a permission
-- changed with no audit row, or on the template but not the member" becomes structurally
-- impossible rather than a convention someone must remember.
--
-- SUB-RULINGS ENCODED HERE:
--   #1 PROPAGATION WIPES, IT DOES NOT MERGE. A role save re-materializes every ACTIVE member
--      of that role from the resolved role, EXACTLY — a member holds what their role grants
--      and nothing else. (Per-person exceptions are served by "Clone to custom" in the UI.)
--      ⚠️ CONSEQUENCE: a role save can REMOVE authority from people. The RPC returns the
--      per-member before/after so the SCREEN can name the blast radius before and after.
--   #2 A NEW PERMISSION ENTERS THE FLOOR **OFF** — i.e. absent from the floor rows (import_pricing
--      is, correctly, not in the 12/9/3 floor). The owner opts in per-tenant THROUGH THIS FUNNEL;
--      the floor is not auto-widened. (No floor change ships here — absence IS off.)
--   #3 (UI) the two fake pills are HIDDEN not wired — an app-layer change, not here.
--
-- SCOPE: ADDITIVE except the AMENDMENT of enforce_member_authority_immutability (§1), which
--   is a CREATE OR REPLACE of an existing function — its behavior is TIGHTENED (the owner's
--   direct side door is closed), stated below in full. RPCs are postgres functions, NOT
--   Vercel functions — the 12/12 ceiling is untouched (§6 r11).
--
-- SOURCE: David's ruling 2026-07-23 (recorded DECISIONS-INDEX.md) + the recon above.
-- GATED: David applies this as postgres, then runs V1–V8 in the footer.
-- AC-1 (no vertical nouns) · AC-2 (membership-scoped) · AC-3 (tenant isolation absolute).
-- ════════════════════════════════════════════════════════════════════════════════


BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════
-- §0 — PRE-FLIGHT ASSERTIONS (loud at apply beats silent at first CALL — D-50 FLAG #3)
-- ════════════════════════════════════════════════════════════════════════════════
DO $preflight$
DECLARE
  v_missing text;
BEGIN
  -- functions this migration depends on must already exist (plpgsql does not resolve them
  -- until CALL time, so a missing prereq would apply cleanly and fail live).
  SELECT string_agg(p.fn, ', ') INTO v_missing
    FROM (VALUES ('is_member_of'), ('assert_movement_actor'), ('enforce_member_authority_immutability'))
      AS p(fn)
   WHERE NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = p.fn);
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'permission-funnel pre-flight FAILED — required function(s) absent: %. Apply 20260623_*/20260720_* first.', v_missing;
  END IF;

  -- tables + columns the funnel writes.
  SELECT string_agg(c.tbl || '.' || c.col, ', ') INTO v_missing
    FROM (VALUES
      ('role_definitions','business_id'), ('role_definitions','role_key'),
      ('role_definitions','permissions'), ('role_definitions','label'), ('role_definitions','description'),
      ('business_members','role'), ('business_members','permissions'),
      ('business_members','active'), ('business_members','business_id'), ('business_members','name'),
      ('businesses','owner_id'),
      ('audit_log','action'), ('audit_log','target_type'), ('audit_log','target_id'),
      ('audit_log','detail'), ('audit_log','outcome'), ('audit_log','actor_user_id'), ('audit_log','actor_role')
    ) AS c(tbl, col)
   WHERE NOT EXISTS (
     SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = c.tbl AND column_name = c.col
   );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'permission-funnel pre-flight FAILED — expected column(s) absent: %.', v_missing;
  END IF;
END
$preflight$;


-- ════════════════════════════════════════════════════════════════════════════════
-- §1 — CLOSE THE SIDE DOOR (make the funnel the ONLY way — David's 🔴)
-- ════════════════════════════════════════════════════════════════════════════════
-- David's requirement: "A funnel with an open side door is a convention, not a funnel."
-- Today (20260623) the immutability trigger PERMITS the business owner to directly
-- `UPDATE business_members SET permissions = …` (recon write site #8 — the SQL workaround
-- ruling #2 rejects as a fix). We CLOSE that here without breaking the funnel or the
-- service/migration paths, using a transaction-local marker only the funnel sets.
--
-- HOW: a namespaced session GUC `trace.authority_funnel`. The two funnel RPCs below set it
-- (transaction-locally) right before they write member rows; the trigger allows a
-- role/permissions change ONLY when either (a) auth.uid() IS NULL (service key / migration /
-- backfill — must keep working) OR (b) the funnel marker is set. A direct table UPDATE from a
-- JWT caller — the owner's SQL workaround OR a member's self-elevation — has NEITHER, so it is
-- refused. The owner-exception that used to live here is REMOVED: the owner now changes
-- authority the same single way everyone does — through the funnel.
--
-- ⚠️ WHAT REMAINS REACHABLE (stated plainly, per David — do not overstate the close):
--   • A SERVICE-KEY / postgres caller (auth.uid() IS NULL) can still write member rows
--     directly. This is DELIBERATE and load-bearing — migrations, backfills, and the server
--     service key legitimately need it, exactly as D-50 kept service_role able to insert the
--     ledger. It is the trusted server context, not a customer surface.
--   • A postgres / SQL-editor caller could set the GUC by hand. That caller is already
--     fully trusted (it is the DB superuser). No JWT/PostgREST client can set a GUC and then
--     UPDATE in the same request, so the browser surface cannot forge it.
--   NET: the side door is CLOSED for every authenticated (JWT) caller, INCLUDING the owner.
--   It is open only to the service key / postgres, which by necessity must retain it.
CREATE OR REPLACE FUNCTION public.enforce_member_authority_immutability()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.permissions IS DISTINCT FROM OLD.permissions THEN

    -- (a) No JWT = service/migration/admin context → allowed (backfills, server service key).
    IF auth.uid() IS NULL THEN
      RETURN NEW;
    END IF;

    -- (b) The permission funnel sets this transaction-local marker immediately before it
    --     re-materializes member rows. Only the funnel RPCs (SECURITY DEFINER) set it, and
    --     they authorize the OWNER first. missing_ok = true → unset reads as NULL, not error.
    IF current_setting('trace.authority_funnel', true) = 'on' THEN
      RETURN NEW;
    END IF;

    -- Otherwise: a direct JWT write of role/permissions — the owner's SQL side door OR a
    -- member self-elevation. Both are refused. (A direct-SQL RAISE cannot self-audit — a
    -- BEFORE-trigger RAISE rolls back the txn, and Postgres has no autonomous transaction —
    -- so the durable permission.self_elevation_denied row is written by the funnel RPC when a
    -- NON-owner CALLS it, which is the reachable app path; see §2/§3.)
    RAISE EXCEPTION
      'business_members.role/permissions may only be changed through the permission funnel (save_role_permissions / assign_member_role) — direct writes and self-elevation are blocked'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
-- Trigger definition itself is unchanged (still BEFORE UPDATE); only the body tightened.


-- ════════════════════════════════════════════════════════════════════════════════
-- §2 — save_role_permissions — THE ROLE FUNNEL (template write + propagation + audit)
-- ════════════════════════════════════════════════════════════════════════════════
-- The ONE path a role's permission set changes. In ONE transaction it: authorizes the passed
-- actor as the business owner · writes (or deletes) the per-tenant role_definitions row ·
-- re-materializes business_members.permissions for EVERY ACTIVE member of that role from the
-- RESOLVED role (sub-ruling #1 — WIPE not merge) · appends the audit_log row · returns the
-- per-member before/after so the screen can render the truth.
--
-- RETURN CONTRACT (mirrors import_write_price's (applied, reason), extended):
--   • denial            → exactly one row: (false, reason, NULL, NULL, NULL, NULL)
--   • success, 0 members → exactly one row: (true, NULL, NULL, NULL, NULL, NULL)
--   • success, N members → N rows:          (true, NULL, member_id, member_name, before, after)
-- A denial RETURNs (does not RAISE) so its audit row COMMITS. A forgery/impersonation is a
-- hard RAISE (assert_movement_actor) — not a recoverable "denied".
--
-- p_op distinguishes the audit verb + whether this is a delete:
--   'save'   → upsert the tenant row, propagate           → role.permissions_changed
--   'create' → insert a new tenant row (clone / add custom) → role.created   (0 members expected)
--   'reset'  → delete the tenant OVERRIDE (floor shows through), propagate to floor → role.factory_reset
--   'delete' → delete a CUSTOM tenant row (no floor)        → role.deleted   (members left as-is)
CREATE OR REPLACE FUNCTION public.save_role_permissions(
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_role_key      text,
  p_op            text,           -- 'save' | 'create' | 'reset' | 'delete'
  p_label         text,
  p_description   text,
  p_permissions   jsonb           -- the desired set; ignored for reset/delete
) RETURNS TABLE(applied boolean, reason text, member_id uuid, member_name text, perms_before jsonb, perms_after jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_before    jsonb;   -- resolved perms for the role BEFORE this change (for the audit detail)
  v_resolved  jsonb;   -- resolved perms AFTER this change (what members are wiped to)
  v_existing  uuid;    -- existing tenant role_definitions row id, if any
  v_action    text;    -- audit verb
  v_members   jsonb := '[]'::jsonb;  -- [{id, before, after}] for the audit detail
  v_count     int  := 0;
  r           record;
BEGIN
  -- ── forgery pin + membership floor (RAISEs — not recoverable) ──────────────────
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- ── authorization: ROLE MANAGEMENT IS OWNER-ONLY. A non-owner is a self-elevation
  --    attempt → write the durable denial row and RETURN (do not RAISE, so it commits). ──
  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = p_actor_user_id) THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'permission.self_elevation_denied', 'role', p_role_key,
            jsonb_build_object('op', p_op, 'attempted_permissions', p_permissions), 'denied');
    RETURN QUERY SELECT false,
      'only the business owner may change role permissions'::text,
      NULL::uuid, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  -- ── the funnel marker: from here the member re-materialization is permitted by the
  --    §1 trigger. Transaction-local — cleared automatically at txn end. ──────────────
  PERFORM set_config('trace.authority_funnel', 'on', true);

  -- resolved-BEFORE (tenant override wins over floor; NULL if the role does not resolve yet).
  SELECT permissions INTO v_before
    FROM public.role_definitions
   WHERE role_key = p_role_key AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC
   LIMIT 1;

  -- ── write the template (§tenant row) ──────────────────────────────────────────────
  IF p_op IN ('reset', 'delete') THEN
    DELETE FROM public.role_definitions
     WHERE business_id = p_business_id AND role_key = p_role_key;  -- floor (business_id NULL) never matched
    v_action := CASE WHEN p_op = 'reset' THEN 'role.factory_reset' ELSE 'role.deleted' END;
  ELSE
    SELECT id INTO v_existing
      FROM public.role_definitions
     WHERE business_id = p_business_id AND role_key = p_role_key;   -- partial-unique-index-safe (no ON CONFLICT)
    IF v_existing IS NOT NULL THEN
      UPDATE public.role_definitions
         SET permissions = p_permissions,
             label       = COALESCE(p_label, label),
             description  = COALESCE(p_description, description)
       WHERE id = v_existing;
    ELSE
      INSERT INTO public.role_definitions (business_id, role_key, is_system, label, description, permissions)
      VALUES (p_business_id, p_role_key, false, p_label, p_description, p_permissions);
    END IF;
    v_action := CASE WHEN p_op = 'create' THEN 'role.created' ELSE 'role.permissions_changed' END;
  END IF;

  -- resolved-AFTER (re-read; for reset the floor now shows through; for delete-custom it is NULL).
  SELECT permissions INTO v_resolved
    FROM public.role_definitions
   WHERE role_key = p_role_key AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC
   LIMIT 1;

  -- ── PROPAGATE (sub-ruling #1 — WIPE not merge). Only when the role still resolves: a
  --    fully-deleted custom role has no set to wipe members to, so its members are left as
  --    they are (orphaned-role handling is a separate concern, out of this pass). ──────────
  IF v_resolved IS NOT NULL THEN
    FOR r IN
      SELECT id, name, permissions AS before_perms
        FROM public.business_members
       WHERE business_id = p_business_id AND role = p_role_key AND active = true
       ORDER BY name
    LOOP
      UPDATE public.business_members
         SET permissions = v_resolved
       WHERE id = r.id;
      v_members := v_members || jsonb_build_object('id', r.id, 'before', r.before_perms, 'after', v_resolved);
      v_count := v_count + 1;
      RETURN QUERY SELECT true, NULL::text, r.id, r.name, r.before_perms, v_resolved;
    END LOOP;
  END IF;

  -- ── the audit row (INSIDE the transaction — a grant not recorded did not happen) ──────
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, 'OWNER', v_action, 'role', p_role_key,
          jsonb_build_object('before', v_before, 'after', v_resolved,
                             'members_affected', v_count, 'members', v_members),
          'success');

  -- success with zero affected members → one honest summary row so the caller sees applied=true.
  IF v_count = 0 THEN
    RETURN QUERY SELECT true, NULL::text, NULL::uuid, NULL::text, NULL::jsonb, NULL::jsonb;
  END IF;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.save_role_permissions(uuid, uuid, text, text, text, text, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_role_permissions(uuid, uuid, text, text, text, text, jsonb) TO authenticated, service_role;


-- ════════════════════════════════════════════════════════════════════════════════
-- §3 — assign_member_role — THE PER-MEMBER FUNNEL (Users tab role dropdown)
-- ════════════════════════════════════════════════════════════════════════════════
-- Re-assigns ONE member's role and re-materializes their permissions from the resolved role,
-- in one audited transaction. Replaces the old direct updateMemberRole path (recon site #1) —
-- which the §1 close now REFUSES anyway, proving the funnel is the only way.
CREATE OR REPLACE FUNCTION public.assign_member_role(
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_member_id     uuid,
  p_role_key      text
) RETURNS TABLE(applied boolean, reason text, role_before text, role_after text, perms_before jsonb, perms_after jsonb)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_resolved   jsonb;
  v_role_before text;
  v_perms_before jsonb;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = p_actor_user_id) THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'permission.self_elevation_denied', 'member', p_member_id::text,
            jsonb_build_object('attempted_role', p_role_key), 'denied');
    RETURN QUERY SELECT false, 'only the business owner may assign roles'::text,
      NULL::text, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  -- resolve the role's effective permissions (tenant override wins over floor).
  SELECT permissions INTO v_resolved
    FROM public.role_definitions
   WHERE role_key = p_role_key AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC
   LIMIT 1;
  IF v_resolved IS NULL THEN
    RETURN QUERY SELECT false, ('role ' || p_role_key || ' is not defined for this business')::text,
      NULL::text, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  SELECT role, permissions INTO v_role_before, v_perms_before
    FROM public.business_members
   WHERE id = p_member_id AND business_id = p_business_id;
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 'member not found in this business'::text,
      NULL::text, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  PERFORM set_config('trace.authority_funnel', 'on', true);

  UPDATE public.business_members
     SET role = p_role_key, permissions = v_resolved
   WHERE id = p_member_id AND business_id = p_business_id;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, 'OWNER', 'member.role_changed', 'member', p_member_id::text,
          jsonb_build_object('before_role', v_role_before, 'after_role', p_role_key,
                             'before', v_perms_before, 'after', v_resolved),
          'success');

  RETURN QUERY SELECT true, NULL::text, v_role_before, p_role_key, v_perms_before, v_resolved;
END;
$$;

REVOKE ALL ON FUNCTION public.assign_member_role(uuid, uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.assign_member_role(uuid, uuid, uuid, text) TO authenticated, service_role;


COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- §4 — VERIFICATION (run AFTER apply, catalog-backed — CLAUDE.md §9 schema gate)
-- These hit the live catalog, never builder memory. Expected results in [brackets].
-- Replace <BIZ> = f7ec5d67-a9ef-4cb0-b807-438d67687d1b, <OWNER> = the owner user id,
-- <MGR> = a manager member's user_id, <MGR_MID> = that manager's business_members.id.
-- ════════════════════════════════════════════════════════════════════════════════
-- V1  both funnel functions exist, DEFINER, owned by postgres:
--   SELECT proname, prosecdef, pg_get_userbyid(proowner) AS owner
--   FROM pg_proc WHERE proname IN ('save_role_permissions','assign_member_role') ORDER BY 1;
--   [both prosecdef=true, owner=postgres]
--
-- V2  the amended trigger fn is DEFINER + owned by postgres (side-door close is live):
--   SELECT prosecdef, pg_get_userbyid(proowner) FROM pg_proc WHERE proname='enforce_member_authority_immutability';
--   [true, postgres]
--
-- V3  🔴 THE SIDE DOOR IS CLOSED — as the OWNER's authenticated session (anon-key client,
--     NOT postgres), a direct member-permission UPDATE must now be REFUSED:
--   UPDATE business_members SET permissions = permissions || '["import_pricing"]'::jsonb
--     WHERE business_id='<BIZ>' AND user_id='<MGR>';
--   [ERROR: … only be changed through the permission funnel …]   -- if it SUCCEEDS, the close FAILED.
--   (As postgres in the SQL editor auth.uid() IS NULL, so the null-branch allows it — that is
--    expected and is the service/migration path. The proof must run under a JWT session.)
--
-- V4  THE FUNNEL GRANTS AND PROPAGATES (card 18 — the live import_pricing case). Owner adds
--     import_pricing to MANAGER and saves through the funnel:
--   SELECT * FROM save_role_permissions('<BIZ>','<OWNER>','MANAGER','save','Manager',
--     'Day-to-day ops',
--     (SELECT permissions FROM role_definitions WHERE role_key='MANAGER'
--        AND (business_id='<BIZ>' OR business_id IS NULL) ORDER BY (business_id IS NOT NULL) DESC LIMIT 1)
--        || '["import_pricing"]'::jsonb);
--   [applied=true rows, one per active MANAGER; perms_after CONTAINS import_pricing]
--   -- then confirm the MEMBER ROW actually changed (this is the whole defect):
--   SELECT jsonb_array_length(permissions), permissions ? 'import_pricing'
--     FROM business_members WHERE business_id='<BIZ>' AND user_id='<MGR>';
--   [import_pricing = true]   -- BEFORE this migration it was false and ungrantable.
--
-- V5  THE COUNT ON SCREEN NOW EQUALS THE COUNT THE GATE READS (R3). After V4 the MANAGER
--     override row and the MANAGER member row hold the SAME set:
--   SELECT (SELECT jsonb_array_length(permissions) FROM role_definitions
--            WHERE business_id='<BIZ>' AND role_key='MANAGER') AS template_n,
--          (SELECT jsonb_array_length(permissions) FROM business_members
--            WHERE business_id='<BIZ>' AND user_id='<MGR>') AS member_n;
--   [template_n = member_n]
--
-- V6  EVERY CHANGE LEFT A TRAIL (R6 — the spine's first governance writer):
--   SELECT action, target_id, outcome, detail->>'members_affected'
--   FROM audit_log WHERE business_id='<BIZ>' AND action LIKE 'role.%' ORDER BY created_at DESC LIMIT 5;
--   [a role.permissions_changed row for MANAGER, outcome=success, members_affected ≥ 1]
--
-- V7  A NON-OWNER IS REFUSED AND THE DENIAL IS RECORDED (self-elevation). As <MGR>'s session:
--   SELECT * FROM save_role_permissions('<BIZ>','<MGR>','MANAGER','save','x','y','["view_costs"]'::jsonb);
--   [applied=false, reason names owner-only]  -- and:
--   SELECT count(*) FROM audit_log WHERE action='permission.self_elevation_denied' AND outcome='denied';
--   [≥ 1]
--
-- V8  A ROLE SAVE THAT REMOVES A PERMISSION ACTUALLY REMOVES IT FROM MEMBERS (ruling #1). Save
--     MANAGER without view_costs, then read a manager row:
--   SELECT permissions ? 'view_costs' FROM business_members WHERE business_id='<BIZ>' AND user_id='<MGR>';
--   [false]   -- the wipe removed it; the RPC's returned perms_before showed what they lost.
