-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PHASE 2 (SERVER) — THE OWNER BRANCH COMES OUT, AND THE OWNER ROLE IS LOCKED
-- 2026-07-30 · ruling "permissions always checked; owner holds all, locked, computed"
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- 🔴 APPLY ORDER — 20260730a → 20260730b → **THIS** → deploy the Phase 2 client.
--    a backfills the owner's array; b guarantees every owner HAS the row that carries it. Applying
--    this file first would remove the owner branch while some owner still holds 6 legacy strings —
--    the lockout the phase order exists to prevent, executed by the migration meant to fix it.
--    Run 20260730b's V2 (every owner: role OWNER, active, n = 52) BEFORE running this.
--
-- SCHEMA: two function REPLACEMENTS. No table, column, policy, constraint, FK or trigger changes.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── §1 — has_permission_for LOSES ITS OWNER BRANCH ─────────────────────────────────────────────
-- WHAT WAS THERE, AND WHY IT IS GOING:
--     -- the owner is authorized for any permission, by owner_id, always (owner-default)
--     EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = p_user_id)
--
-- 🔧 THE HEADER OF THIS FUNCTION DOCUMENTED ITS DIVERGENCE FROM `has_permission` AS **DELIBERATE**.
--    That is now OVERTURNED, and this comment is the record of the overturning, with its date and
--    its ruling. The divergence was real — `has_permission` never had an owner branch — but calling
--    it deliberate made a DEFECT look like a design, and it is why nobody chased the symptom:
--    `get_business_tax_rate` → `has_permission` → no owner branch → the OWNER's 6 legacy strings
--    contain no `tax_rate:read` → the owner reads "Tax: not identified" while his MANAGER, whose
--    array WAS backfilled, passes. **Two authorisation functions disagreeing about the same person
--    is not a design.** They now agree, in the direction the ruling sets: neither has an owner
--    branch, and the owner passes because their array contains the string (20260730a put it there).
--
-- WHAT THIS DOES NOT CHANGE: the alias resolution, the membership scope, the NULL guards, the
-- SECURITY DEFINER + empty search_path, and the grants. One clause is removed; nothing else moves.
CREATE OR REPLACE FUNCTION public.has_permission_for(p_business_id uuid, p_user_id uuid, p_perm text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  SELECT p_user_id IS NOT NULL AND p_business_id IS NOT NULL AND (
    -- NO OWNER BRANCH (ruling 2026-07-30). An owner is an active member holding the string, like
    -- everyone else. `businesses.owner_id` is a fact about who owns the business, not a grant —
    -- and being single-valued it cannot express the TWO OWNERS ruled on 2026-07-26 anyway.
    EXISTS (SELECT 1 FROM public.business_members
             WHERE business_id = p_business_id AND user_id = p_user_id
               AND active = true
               AND (
                 permissions ? p_perm
                 OR permissions ?| COALESCE(
                      (SELECT array_agg(a.implies_perm)
                         FROM public.permission_aliases a
                        WHERE a.from_perm = p_perm),
                      ARRAY[]::text[]
                    )
               ))
  );
$$;

REVOKE ALL ON FUNCTION public.has_permission_for(uuid, uuid, text) FROM public;
GRANT EXECUTE ON FUNCTION public.has_permission_for(uuid, uuid, text) TO authenticated, service_role;

COMMENT ON FUNCTION public.has_permission_for(uuid, uuid, text) IS
  'Alias-aware permission check for an EXPLICIT user id. NO OWNER BRANCH (ruling 2026-07-30) — an '
  'owner passes by holding the string, like every other member. Agrees with has_permission by '
  'construction; the two diverged until 2026-07-30 and that divergence produced the "Tax: not '
  'identified" defect on the OWNER''s own screen.';

-- ── §2 — THE FUNNEL REFUSES A WRITE TO THE OWNER ROLE ──────────────────────────────────────────
-- LOCKED MEANS LOCKED, INCLUDING AGAINST THE OWNER (ruling 2026-07-30). The owner's set is computed
-- from the manifest; a per-tenant OWNER override would be a second, editable, drifting copy of it,
-- and the ability to edit it is the ability to REMOVE one's own authority — a self-inflicted
-- lockout with no recovery path in the UI.
--
-- 🔴 THE SEAM, STATED PLAINLY: this refuses the RPC — the USER-facing path, which is what "locked"
-- means. It does NOT refuse a MIGRATION. 20260730a legitimately writes the OWNER floor through
-- this very function, and it must keep working when re-run. So the refusal is scoped to TENANT
-- rows (`business_id` given) and the floor (`business_id IS NULL`) stays reachable by deploy-time
-- SQL. A deploy is an authored act with a diff and a review; a click is not.
--
-- ORDERING NOTE: 20260730a calls op='reset', which DELETES a tenant override — allowed, because
-- deleting a tenant copy is how the floor shows through. Only WRITING one is refused.
CREATE OR REPLACE FUNCTION public.save_role_permissions(
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_role_key      text,
  p_op            text,
  p_label         text,
  p_description   text,
  p_permissions   jsonb,
  p_reason        text DEFAULT NULL
) RETURNS TABLE(applied boolean, reason text, member_id uuid, member_name text, perms_before jsonb, perms_after jsonb)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_before jsonb; v_resolved jsonb; v_existing uuid; v_action text;
  v_members jsonb := '[]'::jsonb; v_count int := 0; r record;
  v_cur_perms jsonb; v_cur_label text; v_cur_desc text; v_drifted int;
BEGIN
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  IF NOT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = p_actor_user_id) THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'permission.self_elevation_denied', 'role', p_role_key,
            jsonb_build_object('op', p_op, 'attempted_permissions', p_permissions, 'reason', p_reason), 'denied');
    RETURN QUERY SELECT false, 'only the business owner may change role permissions'::text,
      NULL::uuid, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  -- ══ THE OWNER ROLE IS LOCKED (ruling 2026-07-30) ═══════════════════════════════════════════
  -- Refuses save/create/delete on OWNER. `reset` is permitted: it deletes the tenant override so
  -- the computed floor shows through, which is the direction the lock wants to go, and it is the
  -- op 20260730a uses. Audited as an attempt, because a refused authority change is exactly the
  -- kind of act the accountability log exists for (D-51).
  IF upper(p_role_key) = 'OWNER' AND p_op <> 'reset' THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, 'OWNER', 'role.locked_write_refused', 'role', p_role_key,
            jsonb_build_object('op', p_op, 'attempted_permissions', p_permissions,
                               'reason', p_reason,
                               'rule', 'the OWNER role is computed from the permission manifest and is not editable'),
            'denied');
    RETURN QUERY SELECT false,
      'the OWNER role is locked — its permissions are computed from the model and cannot be edited'::text,
      NULL::uuid, NULL::text, NULL::jsonb, NULL::jsonb;
    RETURN;
  END IF;

  IF p_op = 'save' THEN
    SELECT permissions, label, description
      INTO v_cur_perms, v_cur_label, v_cur_desc
      FROM public.role_definitions
     WHERE business_id = p_business_id AND role_key = p_role_key;

    IF v_cur_perms IS NOT NULL
       AND COALESCE(p_permissions, '[]'::jsonb) @> v_cur_perms
       AND v_cur_perms @> COALESCE(p_permissions, '[]'::jsonb)
       AND COALESCE(p_label, v_cur_label)       IS NOT DISTINCT FROM v_cur_label
       AND COALESCE(p_description, v_cur_desc)  IS NOT DISTINCT FROM v_cur_desc
    THEN
      SELECT count(*) INTO v_drifted
        FROM public.business_members bm
       WHERE bm.business_id = p_business_id AND bm.role = p_role_key AND bm.active = true
         AND NOT (COALESCE(bm.permissions, '[]'::jsonb) @> v_cur_perms
                  AND v_cur_perms @> COALESCE(bm.permissions, '[]'::jsonb));

      IF v_drifted = 0 THEN
        INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
        VALUES (p_business_id, p_actor_user_id, 'OWNER', 'role.permissions_changed', 'role', p_role_key,
                jsonb_build_object('before', v_cur_perms, 'after', v_cur_perms,
                                   'members_affected', 0, 'members', '[]'::jsonb,
                                   'reason', p_reason),
                'no_change');
        RETURN QUERY SELECT false, 'no-op'::text, NULL::uuid, NULL::text, v_cur_perms, v_cur_perms;
        RETURN;
      END IF;
    END IF;
  END IF;

  PERFORM set_config('trace.authority_funnel', 'on', true);

  SELECT permissions INTO v_before FROM public.role_definitions
   WHERE role_key = p_role_key AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC LIMIT 1;

  IF p_op IN ('reset', 'delete') THEN
    DELETE FROM public.role_definitions WHERE business_id = p_business_id AND role_key = p_role_key;
    v_action := CASE WHEN p_op = 'reset' THEN 'role.factory_reset' ELSE 'role.deleted' END;
  ELSE
    SELECT id INTO v_existing FROM public.role_definitions
     WHERE business_id = p_business_id AND role_key = p_role_key;
    IF v_existing IS NOT NULL THEN
      UPDATE public.role_definitions
         SET permissions = p_permissions,
             label       = COALESCE(p_label, label),
             description = COALESCE(p_description, description)
       WHERE id = v_existing;
    ELSE
      INSERT INTO public.role_definitions (business_id, role_key, is_system, label, description, permissions)
      VALUES (p_business_id, p_role_key, false, p_label, p_description, p_permissions);
    END IF;
    v_action := CASE WHEN p_op = 'create' THEN 'role.created' ELSE 'role.permissions_changed' END;
  END IF;

  SELECT permissions INTO v_resolved FROM public.role_definitions
   WHERE role_key = p_role_key AND (business_id = p_business_id OR business_id IS NULL)
   ORDER BY (business_id IS NOT NULL) DESC LIMIT 1;

  IF v_resolved IS NOT NULL THEN
    FOR r IN SELECT id, name, permissions AS before_perms FROM public.business_members
              WHERE business_id = p_business_id AND role = p_role_key AND active = true ORDER BY name
    LOOP
      UPDATE public.business_members SET permissions = v_resolved WHERE id = r.id;
      v_members := v_members || jsonb_build_object('id', r.id, 'before', r.before_perms, 'after', v_resolved);
      v_count := v_count + 1;
      RETURN QUERY SELECT true, NULL::text, r.id, r.name, r.before_perms, v_resolved;
    END LOOP;
  END IF;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, 'OWNER', v_action, 'role', p_role_key,
          jsonb_build_object('before', v_before, 'after', v_resolved,
                             'members_affected', v_count, 'members', v_members,
                             'reason', p_reason),
          'success');

  IF v_count = 0 THEN
    RETURN QUERY SELECT true, NULL::text, NULL::uuid, NULL::text, NULL::jsonb, NULL::jsonb;
  END IF;
  RETURN;
END;
$$;

REVOKE ALL ON FUNCTION public.save_role_permissions(uuid, uuid, text, text, text, text, jsonb, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_role_permissions(uuid, uuid, text, text, text, text, jsonb, text) TO authenticated, service_role;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- V-CHECKS — run AFTER applying. CORPUS stated on each.
-- ════════════════════════════════════════════════════════════════════════════════════════════════

-- ── V1 — THE OWNER BRANCH IS GONE. CORPUS: pg_proc, both permission functions.
-- EXPECT: 0 rows. A row means a function body still resolves authority from businesses.owner_id.
-- SELECT proname FROM pg_proc
--  WHERE pronamespace = 'public'::regnamespace
--    AND proname IN ('has_permission','has_permission_for')
--    AND pg_get_functiondef(oid) ~ 'businesses[^;]*owner_id';

-- ── V2 — 🔴 THE SYMPTOM, PROVEN DEAD, AS THE OWNER. CORPUS: get_business_tax_rate, impersonated.
-- This is THE check the whole build turns on. It must run as the OWNER, not as postgres:
-- has_permission reads auth.uid(), which is NULL under the SQL editor's role, so it would return
-- false for everyone and prove nothing.
-- EXPECT: a real rate, NOT null.
-- BEGIN;
--   SET LOCAL role authenticated;
--   SET LOCAL request.jwt.claims = '{"sub":"<DAVID''S auth.users.id>"}';
--   SELECT public.get_business_tax_rate('f7ec5d67-a9ef-4cb0-b807-438d67687d1b') AS owner_sees_rate,
--          public.has_permission('f7ec5d67-a9ef-4cb0-b807-438d67687d1b','tax_rate:read') AS owner_has_string;
-- ROLLBACK;

-- ── V3 — THE OWNER ROLE REFUSES A WRITE, AND SAYS SO. CORPUS: save_role_permissions.
-- EXPECT: applied = false, reason = 'the OWNER role is locked — …', plus ONE audit row
-- action='role.locked_write_refused' outcome='denied'. Rolled back, so it changes nothing.
-- BEGIN;
--   SELECT applied, reason FROM public.save_role_permissions(
--     '<BUSINESS UUID>', '<OWNER auth.users.id>', 'OWNER', 'save', NULL, NULL, '["costs:read"]'::jsonb,
--     'V3 lock probe');
--   SELECT action, outcome, detail->>'rule' FROM public.audit_log
--    WHERE action = 'role.locked_write_refused' ORDER BY created_at DESC LIMIT 1;
-- ROLLBACK;

-- ── V4 — A NON-OWNER ROLE STILL SAVES NORMALLY (the lock is narrow, not a freeze).
-- EXPECT: applied = true. Rolled back.
-- BEGIN;
--   SELECT applied, reason FROM public.save_role_permissions(
--     '<BUSINESS UUID>', '<OWNER auth.users.id>', 'MANAGER', 'save', NULL, NULL,
--     (SELECT permissions FROM public.role_definitions WHERE business_id IS NULL AND role_key='MANAGER'),
--     'V4 control');
-- ROLLBACK;

-- ── V5 — TWO OWNERS, END TO END. CORPUS: a second OWNER-role member.
-- The ruling's whole point, provable in one transaction. Add a second OWNER member (NOT touching
-- businesses.owner_id), confirm they pass a permission check, then roll back.
-- EXPECT: second_owner_has_costs = true, while businesses.owner_id is unchanged.
-- BEGIN;
--   INSERT INTO public.business_members (business_id, user_id, role, permissions, active, name)
--   VALUES ('<BUSINESS UUID>', '<SECOND PERSON auth.users.id>', 'OWNER',
--           (SELECT permissions FROM public.role_definitions WHERE business_id IS NULL AND role_key='OWNER'),
--           true, 'V5 second owner');
--   SELECT public.has_permission_for('<BUSINESS UUID>', '<SECOND PERSON auth.users.id>', 'costs:read')
--            AS second_owner_has_costs;
-- ROLLBACK;
