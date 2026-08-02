-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 20260802c — ENABLING A PRICED ADD-ON AND STARTING ITS TRIAL ARE **ONE ACT**
-- David's ruling, 2026-08-02 (8). Ledger #187.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- 🔴 THE DEFECT THIS MAKES UNREACHABLE. The marketplace's `Enable` called
-- `set_business_module_state({enabled:true})` and nothing else. The clock's only writer is
-- `start_module_trial`, a SEPARATE RPC the page never called — so enabling a priced add-on produced
-- **a BILLABLE MODULE THAT IS LIVE WITH NOTHING THAT EVER ENDS IT: free forever, no conversion
-- date.** That is invariant B6's exact defect, arriving through a button instead of a seed.
--
-- **TWO SEQUENTIAL RPCs WOULD NOT HAVE FIXED IT, WHICH IS THE WHOLE REASON FOR THIS SHAPE.** A
-- partial failure between call one and call two produces precisely the state the ruling exists to
-- prevent (#69's class — a multi-step act that can half-land). One call makes it **UNREACHABLE
-- rather than merely unlikely.**
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHY `set_business_module_state` CALLS `start_module_trial` RATHER THAN ABSORBING IT
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- The alternative — writing the trial keys inline here — was rejected on evidence, not taste:
--   1. 🔴 **IT WOULD BREAK THE ONE-WRITER RULING.** `start_module_trial` is the only function that
--      spells `trial_started_at` / `trial_days` as write targets anywhere, and `20260801c` V2
--      ASSERTS that against `pg_proc` — *"a third function name there is a second clock writer."*
--      Inlining would make this file that third name and fail its own predecessor's check.
--   2. It would duplicate the refuse-to-restart guard, the term validation, and the audit row — the
--      four things that ruling bought.
-- Calling it keeps the key literals in ONE function while still being ONE CLIENT CALL, and because
-- both run inside this function's transaction, the enable and the clock **land together or not at
-- all.** That is the atomicity the ruling asked for, with no new door.
--
-- ⚠️ A NEW PARAMETER, SO THE OLD SIGNATURE IS DROPPED IN THE SAME TRANSACTION. Adding
-- `p_trial_days` creates a NEW function rather than replacing the 6-arg one, and leaving both would
-- give PostgREST two candidates for a 6-argument call — *"Could not choose the best candidate
-- function"*, a runtime failure on the money path. DROP + CREATE inside one BEGIN/COMMIT means
-- there is no window in which either ambiguity or absence is observable.
-- ✅ AND OLD CLIENTS KEEP WORKING: PostgREST binds by NAME, and `p_trial_days` DEFAULTs to NULL, so
-- a deployed bundle still sending six named arguments resolves to this function and simply starts
-- no clock — the exact behaviour it has today.
--
-- 🔴 **THE CATALOG IS PASSED IN, NOT LOOKED UP — AC-1, and the same call the seeder already makes.**
-- The database has no idea what a module COSTS or whether it is `core`. `p_trial_days` comes from
-- `MODULE_CATALOG` in the vertical, exactly as `seed_business_modules` takes its catalog as an
-- argument. **That is what keeps `core` and `core_optional` clock-free: the client passes 0.**
--
-- ── PRE-APPLY (run first, paste the output back) ────────────────────────────────────────────────
--   SELECT p.oid::regprocedure AS signature
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'set_business_module_state';
--
--   EXPECT: exactly ONE row, the 6-argument signature. Two rows means an overload already exists
--   and this migration's DROP must be widened before it is run.

BEGIN;

-- ── DROP THE OLD ARITY (see the header — ambiguity, not replacement) ────────────────────────────
DROP FUNCTION IF EXISTS public.set_business_module_state(uuid, text, boolean, boolean, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.set_business_module_state(
  p_business_id   uuid,
  p_module_key    text,
  p_enabled       boolean,
  p_configured    boolean,
  p_config_patch  jsonb,
  p_actor_user_id uuid,
  -- The module's OFFER, from MODULE_CATALOG. 0/NULL = this module does not get a clock, which is
  -- the correct and required value for `core` and `core_optional`.
  p_trial_days    integer DEFAULT NULL
) RETURNS TABLE(applied boolean, reason text, was_insert boolean,
                enabled_before boolean, enabled_after boolean, trial_started boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_before   boolean;
  v_existed  boolean;
  v_touches_config     boolean;
  v_touches_enablement boolean;
  v_trial_applied boolean := false;
  v_trial_already boolean := false;
  v_trial_reason  text;
BEGIN
  -- (1) NO FORGERY — a client-direct caller may only act as themselves. UNCHANGED.
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- (2) D-9 value validation ahead of authority. UNCHANGED.
  IF p_module_key IS NULL OR btrim(p_module_key) = '' THEN
    RETURN QUERY SELECT false, 'module_key is required'::text, false, NULL::boolean, NULL::boolean, false;
    RETURN;
  END IF;
  IF p_config_patch IS NOT NULL AND jsonb_typeof(p_config_patch) <> 'object' THEN
    RETURN QUERY SELECT false, 'config patch must be a JSON object'::text, false, NULL::boolean, NULL::boolean, false;
    RETURN;
  END IF;

  SELECT bm.enabled INTO v_before
    FROM public.business_modules bm
   WHERE bm.business_id = p_business_id AND bm.module_key = p_module_key;
  v_existed := FOUND;

  v_touches_config     := (p_config_patch IS NOT NULL AND p_config_patch <> '{}'::jsonb)
                       OR (p_configured IS NOT NULL AND (NOT v_existed OR p_configured IS DISTINCT FROM
                             (SELECT bm.configured FROM public.business_modules bm
                               WHERE bm.business_id = p_business_id AND bm.module_key = p_module_key)));
  v_touches_enablement := p_enabled IS NOT NULL AND p_enabled IS DISTINCT FROM v_before;

  -- (3a) AUTHORITY — CONFIG. UNCHANGED: `settings:update`.
  IF v_touches_config
     AND NOT public.has_permission_for(p_business_id, p_actor_user_id, 'settings:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'business_module.update_denied', 'business_module', p_module_key,
            jsonb_build_object('attempted_configured', p_configured,
                               'attempted_config_keys',
                               COALESCE((SELECT array_agg(k) FROM jsonb_object_keys(COALESCE(p_config_patch, '{}'::jsonb)) k), ARRAY[]::text[])),
            'denied');
    RETURN QUERY SELECT false, 'settings:update permission required'::text, false, NULL::boolean, NULL::boolean, false;
    RETURN;
  END IF;

  -- (3b) AUTHORITY — ENABLEMENT. UNCHANGED, and it now also gates the clock: the trial below can
  --      only fire on an enablement change, which cannot reach this point without this permission.
  --      **The manager's refusal is unchanged and still names its reason.**
  IF v_touches_enablement
     AND NOT public.has_permission_for(p_business_id, p_actor_user_id, 'subscription:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'business_module.enablement_denied', 'business_module', p_module_key,
            jsonb_build_object('enabled_before', v_before, 'attempted_enabled', p_enabled,
                               'attempted_trial_days', p_trial_days), 'denied');
    RETURN QUERY SELECT false, 'subscription:update permission required — enabling or disabling a module changes what this business pays'::text,
                        false, v_before, v_before, false;
    RETURN;
  END IF;

  -- (4) THE WRITE. UNCHANGED, including the create path and the config MERGE.
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

  -- ══════════════════════════════════════════════════════════════════════════════════════════════
  -- (4b) 🔴 THE CLOCK — THE SAME ACT, INSIDE THE SAME TRANSACTION (ruling 2026-08-02 (8)).
  -- ══════════════════════════════════════════════════════════════════════════════════════════════
  -- THREE CONDITIONS, and each one is load-bearing:
  --   · `v_touches_enablement` — an ACTUAL change. **A re-enable of an already-on module does not
  --     touch enablement, so it cannot re-clock anything.** (`start_module_trial` refuses a restart
  --     too; this is the belt to that braces, and it is the one that also avoids the round trip.)
  --   · `p_enabled IS TRUE` — turning a module OFF never starts a clock.
  --   · `p_trial_days > 0` — 🔴 **THIS IS WHAT KEEPS `core` AND `core_optional` CLOCK-FREE.** The
  --     client passes 0 for both. Starting a countdown on Contractors — free, and nothing expires —
  --     would be the INVERSE defect arriving through the fix, which is precisely what David flagged.
  IF v_touches_enablement AND p_enabled IS TRUE AND COALESCE(p_trial_days, 0) > 0 THEN
    SELECT t.applied, t.was_already_running, t.reason
      INTO v_trial_applied, v_trial_already, v_trial_reason
      FROM public.start_module_trial(p_business_id, p_module_key, p_trial_days, p_actor_user_id) t;

    -- 🔴 A REFUSED CLOCK ROLLS THE ENABLE BACK. This is the ruling in one statement: the module must
    -- never end up live without something that ends it. `start_module_trial` returns applied:true
    -- for an ALREADY-RUNNING clock (was_already_running), so this fires only on a genuine anomaly —
    -- and on an anomaly, failing loudly beats a half-landed money change.
    IF NOT v_trial_applied THEN
      RAISE EXCEPTION 'module enabled but its trial could not start (%) — refusing to leave a billable module with no conversion date', v_trial_reason;
    END IF;
  END IF;

  -- (5) THE RECORD. UNCHANGED, plus the trial outcome so the act is reconstructable from one row.
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'business_module.state_changed', 'business_module', p_module_key,
          jsonb_build_object('was_insert', NOT v_existed, 'enabled_before', v_before,
                             'enabled_after', COALESCE(p_enabled, v_before),
                             'enablement_changed', v_touches_enablement,
                             'offered_trial_days', p_trial_days,
                             'trial_started', v_trial_applied AND NOT v_trial_already,
                             'trial_already_running', v_trial_already,
                             'config_keys_patched', COALESCE((SELECT array_agg(k) FROM jsonb_object_keys(COALESCE(p_config_patch, '{}'::jsonb)) k), ARRAY[]::text[])),
          CASE WHEN v_existed AND NOT v_touches_enablement AND NOT v_touches_config
               THEN 'no_change' ELSE 'success' END);

  RETURN QUERY SELECT true, NULL::text, NOT v_existed, v_before, COALESCE(p_enabled, v_before),
                      v_trial_applied AND NOT v_trial_already;
END;
$$;

REVOKE ALL ON FUNCTION public.set_business_module_state(uuid, text, boolean, boolean, jsonb, uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_business_module_state(uuid, text, boolean, boolean, jsonb, uuid, integer) TO authenticated, service_role;

COMMENT ON FUNCTION public.set_business_module_state(uuid, text, boolean, boolean, jsonb, uuid, integer) IS
  'The ONE writer of business_modules. TWO gates, because they are two acts: config/configured '
  'require settings:update; ENABLEMENT requires subscription:update and only when the value '
  'actually changes. ENABLING A PRICED ADD-ON ALSO STARTS ITS TRIAL, in this same transaction, by '
  'calling start_module_trial — one act, so a partial failure cannot leave a billable module live '
  'with nothing that ends it (ruling 2026-08-02). p_trial_days comes from the vertical''s catalog '
  '(AC-1); 0/NULL means no clock, which is what core and core_optional pass.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ✅ POST-APPLY VERIFICATION (V-BLOCK) — run every query; paste the output back.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- V1 · EXACTLY ONE SIGNATURE SURVIVES. Two would be the PostgREST ambiguity this file exists to
--      avoid, and it would fail on the money path rather than at deploy.
--   SELECT p.oid::regprocedure AS signature
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.proname = 'set_business_module_state';
--
--   EXPECT: ONE row, ending `, integer)`.
--
-- V2 · 🔴 THE ONE-WRITER RULING STILL HOLDS — this is the assertion this file was most at risk of
--      breaking, so it is re-run rather than assumed.
--   SELECT p.proname
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public'
--      AND (pg_get_functiondef(p.oid) LIKE '%trial_started_at%'
--           OR pg_get_functiondef(p.oid) LIKE '%''trial_days''%');
--
--   EXPECT: **`start_module_trial` ONLY.** `set_business_module_state` must NOT appear — it calls
--   the clock, it does not spell it. If it appears, the keys were inlined and the ruling is broken.
--
-- V3 · CORE AND CORE_OPTIONAL GET NO CLOCK — the inverse defect, checked rather than assumed.
--      Turn Contractors on from the marketplace (or call with p_trial_days => 0), then:
--   SELECT module_key, enabled, config->>'trial_started_at' AS started
--     FROM public.business_modules
--    WHERE module_key IN ('contractor_tiers','qr_checkout','qb_invoicing','inventory_intake');
--
--   EXPECT: `started` NULL on every row. contractor_tiers `enabled t` after you switch it on.
--   🔴 A TIMESTAMP ON contractor_tiers MEANS A FREE MODULE IS COUNTING DOWN — stop and report it.
--
-- V4 · ENABLING A PRICED ADD-ON STARTS ITS CLOCK, IN ONE CALL.
--      Enable any Available module from the marketplace, then:
--   SELECT module_key, enabled, configured,
--          config->>'trial_started_at' AS started, config->>'trial_days' AS term
--     FROM public.business_modules WHERE module_key = '<the one you enabled>';
--
--   EXPECT: enabled t · started = NOW · term = the catalog's number.
--   ⚠️ `configured` is NOT set by this path and that is correct — enabling is a subscription act,
--   configuring is a settings act, and they are separately gated. The dashboard tile renders
--   `active` only on BOTH, so a module enabled here still shows [ENABLE] until it is configured.
--   **That is a KNOWN consequence, named here rather than discovered.**
--
-- V5 · A RE-ENABLE DOES NOT RE-CLOCK. Call again with the same module already on:
--   SELECT * FROM public.set_business_module_state('<business>', '<module>', true, NULL, NULL, '<actor>', 30);
--
--   EXPECT: `applied t · trial_started f` — `v_touches_enablement` is false, so the clock branch
--   never runs and the term is untouched. Re-run V4: `started` must be the ORIGINAL timestamp.
--
-- V6 · THE MANAGER IS STILL REFUSED, WITH THE REASON NAMED. As the MANAGER's user id:
--   SELECT * FROM public.set_business_module_state('<business>', 'social_media', true, NULL, NULL, '<manager uuid>', 30);
--
--   EXPECT: `applied f` · reason mentions `subscription:update` · an audit row
--   `business_module.enablement_denied` carrying `attempted_trial_days`. **And no clock started.**
--
-- V7 · THE AUDIT ROW RECONSTRUCTS THE WHOLE ACT FROM ONE ROW.
--   SELECT detail->>'enablement_changed' AS enabled_changed,
--          detail->>'offered_trial_days' AS offered,
--          detail->>'trial_started' AS clock_started,
--          detail->>'trial_already_running' AS already, outcome, created_at
--     FROM public.audit_log
--    WHERE action = 'business_module.state_changed' ORDER BY created_at DESC LIMIT 5;
--
--   EXPECT: the enable you did in V4 reads `enabled_changed t · offered 30 · clock_started t`.
--   Its sibling `module_trial.started` row (written inside start_module_trial) is the clock's own
--   record — two rows for two facts, both in the same transaction.
