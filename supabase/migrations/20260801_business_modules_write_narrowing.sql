-- Migration: business_modules — SELECT stays membership-scoped, EVERY WRITE moves behind an RPC
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-08-01 · Ledger #180 · ITEM 3 of the module-monetization build order
--
-- ⛔ GATED — DO NOT RUN UNTIL PRE-CHECK 0 PASSES. Read it first; it can lock an owner out.
--
-- NEVER EDIT APPLIED MIGRATIONS. This file appends; it edits nothing.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT THIS DOES, AND WHY IT COMES BEFORE THE CLOCK
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- `business_modules_member_access` is ONE policy, `FOR ALL`, with NO `WITH CHECK` — so Postgres
-- reuses the `USING` expression for writes — and its only predicate is active membership.
-- ✏️ ITS CURRENT DEFINITION IS `20260622_is_active_member_canonical_rls.sql:189`, NOT the 20260604
-- create: 20260622 dropped and recreated it as `FOR ALL USING (public.is_active_member(business_id))`.
-- Same substance, newer file. Citing the create would have described a superseded definition — the
-- exact class of error this file's own pre-check exists to prevent, one layer out.
-- Today that means: **any active member, STAFF included, can INSERT / UPDATE / DELETE any module
-- row for their tenant**, including `enabled`, `configured` and every key in `config`.
--
-- That is tolerable for "which social channels are on." It is NOT tolerable the moment a TRIAL
-- CLOCK or a PRICE lives in that row: a staff member could reset their own trial expiry from a
-- browser console. **A clock the person being billed can rewrite is not a clock.** Hence the order
-- David set: narrow the writes FIRST, then land the clock.
--
-- AFTER THIS MIGRATION:
--   · SELECT  — unchanged, membership-scoped. A tile MUST be able to read its own state; useModules
--               reads this table on every dashboard load for every role.
--   · WRITE   — no direct client write at all. INSERT / UPDATE / DELETE for `authenticated` are
--               revoked at the policy layer; the only write path is `set_business_module_state`.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 PRE-CHECK 0 — RUN THIS BEFORE ANYTHING ELSE. THE DEPENDENCY IS STATED, NOT ASSUMED.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- The policy is scoped to `business_members`. The OWNER is resolved by the app from
-- `businesses.owner_id` (BusinessProvider.tsx:474), NOT from a member row. **An owner with no
-- ACTIVE `business_members` row already reads ZERO module rows today** — every module-keyed tile
-- renders `[ENABLE]` for him — and after this migration he could not write one either, through any
-- path, because the RPC checks `has_permission_for`, which reads the same member row.
--
-- `20260730b_owner_member_row_invariant.sql` is what guarantees that row exists. This migration
-- DEPENDS on it and does not re-establish it. If the invariant does not hold, STOP: fix the member
-- rows first (20260730a §2), then return here.
--
--   -- PRE-CHECK 0 — expect ONE row per business, all three columns TRUE. Any FALSE ⇒ STOP.
--   SELECT b.id,
--          b.name,
--          (b.owner_id IS NOT NULL)                                   AS has_owner_id,
--          EXISTS (SELECT 1 FROM public.business_members m
--                   WHERE m.business_id = b.id
--                     AND m.user_id     = b.owner_id
--                     AND m.active)                                   AS owner_has_active_member_row,
--          EXISTS (SELECT 1 FROM public.business_members m
--                   WHERE m.business_id = b.id
--                     AND m.user_id     = b.owner_id
--                     AND m.active
--                     AND 'settings:update' = ANY (m.permissions))     AS owner_can_write_modules
--     FROM public.businesses b
--    ORDER BY b.name;
--
-- ⚠️ `owner_can_write_modules` is the column that matters HERE and it is not the same question as
-- 20260730b's V2. 20260730b proves the owner holds the full 52-string set; this proves the ONE
-- string the module RPC checks. They should agree — if they do not, the member array is stale and
-- 20260730a §2 is the fix, not an edit to this file.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART 1 — THE WRITER. Narrow, actor-asserted, validated, audited.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- The `set_business_tax_rate` shape (20260727_rbac_resource_action_flip.sql:293), which is now its
-- third instance after `save_role_permissions`. Every clause below is there because that function
-- has it and for the same reason.
--
-- 🔴 THE PERMISSION IS `settings:update`, AND THAT IS DELIBERATE: IT IS WHAT THE ONLY EXISTING
-- AUTHORITY CHECK ON THIS TABLE ALREADY REQUIRES (`api/social/enable.ts:26`). **A narrowing must not
-- also change WHO passes** — that is two changes wearing one commit, and #172 is the standing proof
-- of what it costs. When `subscription:update` is minted (David's ruling, still OPEN), module
-- ENABLEMENT and the trial clock move to it and CONFIG (channels, margin settings) stays here. That
-- split is the marketplace build's job, not this one's.
--
-- 🔴 `p_config_patch` IS A MERGE, NOT A REPLACE, AND IT IS NOT THE CLOCK'S WRITER. It exists to
-- carry the two config shapes that already exist (`advert_channels`/`cadence`; the pricing keys).
-- It accepts arbitrary keys, so it is exactly the typo surface the clock ruling forbids for money —
-- which is why THE CLOCK GETS ITS OWN RPC naming `{trial_started_at}` as a SQL literal (item 2).
-- Do not route the clock through this function.
CREATE OR REPLACE FUNCTION public.set_business_module_state(
  p_business_id   uuid,
  p_module_key    text,
  p_enabled       boolean,
  p_configured    boolean,
  p_config_patch  jsonb,
  p_actor_user_id uuid
) RETURNS TABLE(applied boolean, reason text, was_insert boolean, enabled_before boolean, enabled_after boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_before   boolean;
  v_existed  boolean;
BEGIN
  -- (1) NO FORGERY — a client-direct caller may only act as themselves.
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- (2) AUTHORITY. A denial is RECORDED, not merely refused — an attempt nobody can see is an
  --     attempt nobody can investigate.
  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'settings:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'business_module.update_denied', 'business_module', p_module_key,
            jsonb_build_object('attempted_enabled', p_enabled), 'denied');
    RETURN QUERY SELECT false, 'settings:update permission required'::text, false, NULL::boolean, NULL::boolean;
    RETURN;
  END IF;

  -- (3) D-9 — refuse nonsense rather than storing it. A blank module_key is not a module, and an
  --     unregistered one would mint an orphan row no tile can ever read.
  IF p_module_key IS NULL OR btrim(p_module_key) = '' THEN
    RETURN QUERY SELECT false, 'module_key is required'::text, false, NULL::boolean, NULL::boolean;
    RETURN;
  END IF;
  IF p_config_patch IS NOT NULL AND jsonb_typeof(p_config_patch) <> 'object' THEN
    RETURN QUERY SELECT false, 'config patch must be a JSON object'::text, false, NULL::boolean, NULL::boolean;
    RETURN;
  END IF;

  SELECT bm.enabled INTO v_before
    FROM public.business_modules bm
   WHERE bm.business_id = p_business_id AND bm.module_key = p_module_key;
  v_existed := FOUND;

  -- (4) THE WRITE. `IF NOT FOUND → INSERT` is not a nicety: NOTHING in the codebase creates a
  --     business_modules row, so for most tenants this IS the create path. config is MERGED
  --     (`||`), never replaced, so a caller touching enablement cannot silently drop another
  --     caller's keys.
  IF v_existed THEN
    UPDATE public.business_modules
       SET enabled    = COALESCE(p_enabled,    enabled),
           configured = COALESCE(p_configured, configured),
           config     = COALESCE(config, '{}'::jsonb) || COALESCE(p_config_patch, '{}'::jsonb)
     WHERE business_id = p_business_id AND module_key = p_module_key;
  ELSE
    INSERT INTO public.business_modules (business_id, module_key, enabled, configured, config)
    VALUES (p_business_id, p_module_key, COALESCE(p_enabled, false), COALESCE(p_configured, false),
            COALESCE(p_config_patch, '{}'::jsonb));
  END IF;

  -- (5) THE RECORD. STD-023's sibling of the #74 ruling: a save that changed nothing is still an
  --     operator act worth keeping, but the OUTCOME must not assert an event that did not occur.
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'business_module.state_changed', 'business_module', p_module_key,
          jsonb_build_object('was_insert', NOT v_existed, 'enabled_before', v_before, 'enabled_after', COALESCE(p_enabled, v_before),
                             'config_keys_patched', COALESCE((SELECT array_agg(k) FROM jsonb_object_keys(COALESCE(p_config_patch, '{}'::jsonb)) k), ARRAY[]::text[])),
          CASE WHEN v_existed AND v_before IS NOT DISTINCT FROM COALESCE(p_enabled, v_before)
                            AND COALESCE(p_config_patch, '{}'::jsonb) = '{}'::jsonb
               THEN 'no_change' ELSE 'success' END);

  RETURN QUERY SELECT true, NULL::text, NOT v_existed, v_before, COALESCE(p_enabled, v_before);
END;
$$;

REVOKE ALL ON FUNCTION public.set_business_module_state(uuid, text, boolean, boolean, jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_business_module_state(uuid, text, boolean, boolean, jsonb, uuid) TO authenticated, service_role;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART 2 — THE POLICY SPLIT. One FOR ALL policy becomes one SELECT policy.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Dropping `business_modules_member_access` and replacing it with a SELECT-only policy leaves NO
-- policy permitting INSERT/UPDATE/DELETE for `authenticated`. Under RLS that is a DENY — which is
-- the point, and it is fail-CLOSED. `SECURITY DEFINER` functions and `service_role` are unaffected.
--
-- ⚠️ This table is DECLARED in `select-policy-declarations.json`? NO — and it must not be. It keeps
-- a real SELECT policy, so `verify-select-policies` continues to pass on its own assertion. Nothing
-- to declare; noted because the next reader will wonder.
DROP POLICY IF EXISTS business_modules_member_access ON public.business_modules;

CREATE POLICY business_modules_member_select ON public.business_modules
  FOR SELECT
  USING (public.is_active_member(business_id));

COMMENT ON TABLE public.business_modules IS
  'Per-tenant module enablement + config. SELECT is membership-scoped (a tile must read its own '
  'state). ALL WRITES go through set_business_module_state() — there is deliberately no client '
  'write policy. Narrowed 2026-08-01 (ledger #180) ahead of the per-module trial clock: a clock the '
  'person being billed can rewrite is not a clock.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — RUN EVERY ONE AFTER APPLYING. Structure AND behaviour; both directions.
-- Thunder CANNOT run these (no catalog access). They are David's, per the §9 schema-verification
-- gate. Anything that does not match its stated expectation is a STOP, not a note.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── V1 — STRUCTURE. Expect EXACTLY ONE policy, cmd = SELECT, and RLS still enabled.
--   SELECT c.relrowsecurity AS rls_enabled, p.polname, p.polcmd,
--          pg_get_expr(p.polqual, p.polrelid)      AS using_expr,
--          pg_get_expr(p.polwithcheck, p.polrelid) AS with_check_expr
--     FROM pg_class c
--     LEFT JOIN pg_policy p ON p.polrelid = c.oid
--    WHERE c.relname = 'business_modules' AND c.relnamespace = 'public'::regnamespace;
--   EXPECT: rls_enabled = true · exactly 1 row · polname = business_modules_member_select ·
--           polcmd = 'r' (SELECT) · with_check_expr = NULL.
--   🔴 If `business_modules_member_access` is still listed, the DROP did not run — STOP.
--
-- ── V2 — A MEMBER CAN STILL READ. As the MANAGER df7723be (impersonated), expect ROWS, not zero.
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims TO '{"sub":"<MANAGER_UUID>","role":"authenticated"}';
--   SELECT module_key, enabled, configured FROM public.business_modules
--    WHERE business_id = '<BUSINESS_UUID>' ORDER BY module_key;
--   EXPECT: the tenant's module rows. **ZERO ROWS HERE MEANS THE DASHBOARD SHOWS [ENABLE] ON
--   EVERYTHING** — that is the visible symptom, and it is the same symptom as a missing member row,
--   so check PRE-CHECK 0 before blaming this migration.
--   RESET ROLE;
--
-- ── V3 — 🔴 A MEMBER CAN NO LONGER WRITE DIRECTLY. This is the assertion the migration exists for.
--   SET LOCAL ROLE authenticated;
--   SET LOCAL request.jwt.claims TO '{"sub":"<MANAGER_UUID>","role":"authenticated"}';
--   UPDATE public.business_modules SET enabled = true
--    WHERE business_id = '<BUSINESS_UUID>' AND module_key = 'social_media';
--   EXPECT: **UPDATE 0.** Not an error — RLS filters the row out of the update's scope, so a
--   forbidden write reports zero rows affected. **`UPDATE 1` MEANS THE NARROWING DID NOT TAKE.**
--   Then the same again as INSERT and DELETE:
--   INSERT INTO public.business_modules (business_id, module_key) VALUES ('<BUSINESS_UUID>','zz_probe');
--   EXPECT: ERROR — new row violates row-level security policy. (INSERT has no permissive policy,
--   so it RAISES where UPDATE silently affects nothing. Both are refusals; they look different.)
--   RESET ROLE;
--
-- ── V4 — THE RPC PATH STILL WORKS, and it is the ONLY one that does.
--   SELECT * FROM public.set_business_module_state(
--     '<BUSINESS_UUID>', 'social_media', true, true, '{"cadence":"weekly"}'::jsonb, '<OWNER_UUID>');
--   EXPECT: applied = true · was_insert = (true if the tenant had no row) · one `audit_log` row
--           action='business_module.state_changed'.
--
-- ── V5 — 🔴 THE NEGATIVE. A member WITHOUT settings:update is refused BY THE RPC, not just by RLS.
--   SELECT * FROM public.set_business_module_state(
--     '<BUSINESS_UUID>', 'social_media', false, false, NULL, '<STAFF_UUID>');
--   EXPECT: applied = false · reason = 'settings:update permission required' · and an `audit_log`
--           row action='business_module.update_denied' outcome='denied'.
--   🔴 A cap that only proved V3 would pass over an RPC that grants everyone — V5 is what makes the
--   narrowing a gate rather than a relocation.
--
-- ── V6 — THE OWNER READS HIS OWN ROWS. Same shape as V2, as the OWNER.
--   EXPECT: the same row count V2 returned. **Zero here is PRE-CHECK 0 failing, not this policy** —
--   the owner is resolved from businesses.owner_id and this policy reads business_members.
--
-- ── V7 — NO-OP HONESTY (STD-023 / the #74 ruling). Run V4 again with identical arguments.
--   EXPECT: applied = true, and the SECOND audit row reads outcome='no_change', NOT 'success' —
--           `business_module.state_changed` asserts an event, and none occurred.
--
-- ── V8 — CLEANUP. If V3's INSERT probe somehow succeeded, remove it:
--   DELETE FROM public.business_modules WHERE module_key = 'zz_probe';
--   EXPECT: DELETE 0 (it should never have been created).
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT BREAKS IN THE APP, STATED BEFORE IT BREAKS
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- · `packages/shared/src/business-logic/financialDataAccess.ts:233,243` — upserts
--   `business_modules` FROM THE BROWSER under the member's own RLS. **THIS BREAKS.** It must be
--   repointed at `set_business_module_state` in the same deploy as this migration. It is the only
--   client-side writer in the repo.
-- · `packages/cultivar-os/api/social/enable.ts:33` — upserts via `adminDb()` (service key), which
--   bypasses RLS, and already proves the caller with `callerCan(..., 'settings:update')`. **NOT
--   BLOCKED.** It should still move to the RPC so the table has ONE writer (STD-011) and so its
--   act is audited like every other, but that is a tidy-up, not a break.
-- · `useModules.ts:72` and every other reader — SELECT only. Unaffected.
