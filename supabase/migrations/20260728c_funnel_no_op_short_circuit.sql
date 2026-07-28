-- ════════════════════════════════════════════════════════════════════════════════
-- 20260728c — THE FUNNEL SHORT-CIRCUITS A NO-OP SAVE, AND STILL RECORDS THE ACT
-- ════════════════════════════════════════════════════════════════════════════════
-- APPLY AS: postgres, AFTER 20260727_rbac_resource_action_flip.sql (APPLIED — it owns the
-- current 8-arg signature with `p_reason`). §6 r1: a new file, never an edit of an applied one.
--
-- ✅ APPLIED AND VERIFIED 2026-07-28 (David, at postgres). V1 → `applied=false, reason='no-op',
-- outcome='no_change'`, 40 → 40 · **🔴 V3 REORDER — same 40 elements, reversed order → still
-- `no-op`. SET COMPARISON CONFIRMED**, and V3 is the ONLY probe that distinguishes this build
-- from an array-comparison one (an array build returns `applied=true` there and passes every
-- other check) · V4 label-change → `applied=true`, member_id populated, rolled back · `prosrc`
-- confirmed to contain the short-circuit.
--
-- 🔴 DO NOT PRUNE THE PROBE ROWS FROM `audit_log`. They are the fix's own before/after, and
-- better evidence than any comment in this file:
--     18:13:29  rbac-cleanup:assets-retired  success     40 → 40   ← the defect
--     18:45:08  v1-noop-probe                no_change   40 → 40   ← fixed
--     18:45:25  v3-reorder-probe             no_change   40 → 40   ← fixed, and order-insensitive
-- Three rows, same tenant, same role, same counts — the only difference is `outcome`, which is
-- exactly the property this migration exists to establish. A future audit-log cleanup that
-- removes "probe noise" would delete the demonstration that the guard is alive (STD-022's whole
-- concern, applied to the evidence rather than to the check).
--
-- WHY. Tech-debt #74 / ledger #163. `save_role_permissions` had no `IS DISTINCT FROM` check
-- anywhere: it re-materialized every active member's array and appended the `audit_log` row
-- UNCONDITIONALLY. Found 2026-07-28 when the CALL 5 cleanup runbook was re-run 88 seconds after
-- the real work on an already-clean tenant and wrote:
--     rbac-cleanup:assets-retired · MANAGER · 40 → 40 · outcome `success`
-- The runbook's own halt gate was fixed the same day, but that protects one file. Every caller
-- has this property, and the live one is the UI: **pressing Save on /team → Roles with nothing
-- changed writes a `role.permissions_changed` row asserting an event nobody caused.**
--
-- DAVID'S RULING (2026-07-28), implemented literally:
--   · Short-circuit the WRITE — no `role_definitions` update, no member re-materialization,
--     return `applied=false, reason='no-op'`.
--   · **KEEP THE AUDIT ROW**, with `outcome='no_change'` and both before/after recorded.
--     A Save that changed nothing is an OPERATOR ACT on a permissions surface — someone opened
--     Roles, looked at a role, pressed Save. That is worth keeping. What is not acceptable is
--     `outcome='success'` on `action='role.permissions_changed'` when nothing changed, because
--     **the action name asserts an event that did not occur** — the outcome is what makes the
--     action name truthful. `no_change` rows are ignorable by anything counting changes and
--     present for anything reconstructing who touched what. Silence loses the second and gains
--     nothing on the first.
--   · 🔴 **COMPARE AS SETS, NOT AS ARRAYS.** jsonb array ordering is not guaranteed stable
--     across a re-materialization, so `before <> after` on raw arrays reports a change on a pure
--     REORDERING — a false positive that reintroduces the defect from the other side.
--
-- ⚠️ ANYTHING COUNTING PERMISSION CHANGES MUST NOW FILTER ON `outcome`. A query that reads
-- `action='role.permissions_changed'` alone will include no-ops. That is the deliberate cost of
-- keeping the operator act; it is stated here because an unstated cost is a trap.
--
-- ── FOUR CASES THAT ARE **NOT** NO-OPS, AND WHY EACH ONE MATTERS ────────────────────────────
--  (a) NO TENANT ROW YET. Saving a set identical to the floor MINTS a tenant override — the
--      ONE-WAY DOOR (from that write the tenant stops tracking the system floor). Identical
--      contents, profoundly different state. Short-circuiting it would make the most consequential
--      write in this system the most silent one.
--  (b) LABEL OR DESCRIPTION CHANGED. A rename with the same permission set is a real edit. A
--      short-circuit that swallowed it would be a NEW defect shipped inside the fix for an old one.
--  (c) A MEMBER ARRAY HAS DRIFTED from the resolved set. The service-key/postgres path is still
--      open by necessity (#152, named not hidden), so drift is reachable. When it exists, the save
--      REPAIRS it — something changes, and it records `success`. **This case is an INTERPRETATION:
--      the ruling says "compares desired vs current resolved," which does not address a drifted
--      member. Resolved in the direction that keeps `no_change` truthful — flagged for David.**
--  (d) op <> 'save'. `create`, `reset` and `delete` are out of scope by design. A `reset` whose
--      DELETE matches zero rows is arguably a no-op too, but its resolved-after can legitimately
--      differ from its resolved-before, so it is left alone rather than guessed at. Narrow first.

BEGIN;

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

  -- ══ NO-OP SHORT-CIRCUIT (#74) ══════════════════════════════════════════════════════════════
  -- Evaluated BEFORE `set_config` on purpose: this path performs no write at all, so it never
  -- arms the §1 trigger's funnel marker. The premise is the branch condition itself — not a
  -- neighbouring check the write could proceed without (STD-023).
  IF p_op = 'save' THEN
    SELECT permissions, label, description
      INTO v_cur_perms, v_cur_label, v_cur_desc
      FROM public.role_definitions
     WHERE business_id = p_business_id AND role_key = p_role_key;   -- case (a): NULL ⇒ not a no-op

    IF v_cur_perms IS NOT NULL
       -- 🔴 SET equality, both directions. jsonb array containment is order- and
       -- duplicate-insensitive, which is exactly the comparison asked for: a pure REORDERING
       -- is not a change. `a <> b` on the raw arrays would report one.
       AND COALESCE(p_permissions, '[]'::jsonb) @> v_cur_perms
       AND v_cur_perms @> COALESCE(p_permissions, '[]'::jsonb)
       -- case (b): a label/description edit is a real change. COALESCE mirrors the UPDATE below,
       -- which only overwrites when the argument is non-NULL.
       AND COALESCE(p_label, v_cur_label)       IS NOT DISTINCT FROM v_cur_label
       AND COALESCE(p_description, v_cur_desc)  IS NOT DISTINCT FROM v_cur_desc
    THEN
      -- case (c): does every active member already hold the resolved set?
      SELECT count(*) INTO v_drifted
        FROM public.business_members bm
       WHERE bm.business_id = p_business_id AND bm.role = p_role_key AND bm.active = true
         AND NOT (COALESCE(bm.permissions, '[]'::jsonb) @> v_cur_perms
                  AND v_cur_perms @> COALESCE(bm.permissions, '[]'::jsonb));

      IF v_drifted = 0 THEN
        -- The operator act is kept; the claim of a change is not made.
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
  -- ══ end no-op short-circuit ════════════════════════════════════════════════════════════════

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

-- The column comment named two values and there are now three. A comment that undercounts the
-- domain is the same class of artifact this whole week has been about.
COMMENT ON COLUMN public.audit_log.outcome IS
  '''success'' | ''denied'' | ''no_change''. no_change = the operator performed the act (opened the '
  'surface, pressed Save) but nothing changed — the row records WHO TOUCHED WHAT without claiming '
  'an event. ANY QUERY COUNTING CHANGES MUST FILTER ON THIS COLUMN: action=''role.permissions_changed'' '
  'alone now includes no-ops (tech-debt #74, ledger #163).';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════
-- VERIFICATION — run as postgres. V3–V6 are the NEGATIVE half: a short-circuit that fires when
-- it should not is a worse defect than the one it fixes (STD-022 — an assertion that cannot fail
-- is indistinguishable from one that works).
-- ════════════════════════════════════════════════════════════════════════════════
-- Substitute :biz = the tenant, :actor = its owner_id. Read the CURRENT set first:
--   SELECT permissions FROM public.role_definitions WHERE business_id = :biz AND role_key='MANAGER';

-- ── V1 — POSITIVE: saving the CURRENT set is a no-op. EXPECT applied=false, reason='no-op'.
-- SELECT * FROM public.save_role_permissions(:biz, :actor, 'MANAGER', 'save', NULL, NULL,
--   (SELECT permissions FROM public.role_definitions WHERE business_id=:biz AND role_key='MANAGER'),
--   'v1-noop-probe');

-- ── V2 — the audit row exists and is honest. EXPECT one row, outcome='no_change',
-- action='role.permissions_changed', before == after, members_affected=0.
-- SELECT action, outcome, detail->>'reason', detail->>'members_affected',
--        (detail->'before') = (detail->'after') AS before_eq_after
--   FROM public.audit_log ORDER BY created_at DESC LIMIT 1;

-- ── V3 — 🔴 THE SET-COMPARISON PROOF. Same elements, REVERSED order. EXPECT applied=false,
-- reason='no-op' — an array-equality implementation returns applied=true here and this is the
-- single check that tells them apart.
-- SELECT * FROM public.save_role_permissions(:biz, :actor, 'MANAGER', 'save', NULL, NULL,
--   (SELECT jsonb_agg(s ORDER BY s DESC) FROM jsonb_array_elements_text(
--      (SELECT permissions FROM public.role_definitions WHERE business_id=:biz AND role_key='MANAGER')) s),
--   'v3-reorder-probe');

-- ── V4 — NEGATIVE: a LABEL edit with an identical permission set is NOT a no-op.
-- EXPECT applied=true and outcome='success'. (Then set the label back.)
-- SELECT * FROM public.save_role_permissions(:biz, :actor, 'MANAGER', 'save', 'Manager (v4 probe)', NULL,
--   (SELECT permissions FROM public.role_definitions WHERE business_id=:biz AND role_key='MANAGER'),
--   'v4-label-probe');

-- ── V5 — NEGATIVE, THE ONE-WAY DOOR: with NO tenant row for a role, saving the floor's own set
-- MINTS the override and MUST NOT short-circuit. EXPECT applied=true.
-- Run against a role_key with no tenant row (check first):
--   SELECT role_key FROM public.role_definitions WHERE business_id = :biz;
-- SELECT * FROM public.save_role_permissions(:biz, :actor, '<role-with-no-tenant-row>', 'save', 'X', 'X',
--   (SELECT permissions FROM public.role_definitions WHERE business_id IS NULL AND role_key='<same>'),
--   'v5-mint-probe');
-- ⚠️ THIS PROBE MINTS A TENANT OVERRIDE — a one-way door. Run it on a throwaway tenant, or not
-- at all; V5 is the case that must never silently pass, and reading this comment is most of it.

-- ── V6 — NEGATIVE, DRIFT REPAIR: if an active member's array differs from the template, a save
-- of the identical template is NOT a no-op (it repairs the member). EXPECT applied=true.
-- Requires manufacturing drift via the service-key path; recorded as the case, not as a probe to
-- run casually on the live tenant.

-- ── V7 — NEGATIVE: nothing else changed. EXPECT the same counts as before this migration —
-- floor MANAGER 25 · tenant template 40 · member array 40 · zero assets:* anywhere.
-- SELECT role_key, jsonb_array_length(permissions) FROM public.role_definitions
--  WHERE business_id IS NULL OR business_id = :biz ORDER BY business_id NULLS FIRST, role_key;
