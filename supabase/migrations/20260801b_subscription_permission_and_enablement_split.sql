-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- `subscription:read` / `subscription:update` — THE MODEL LEARNS TO SAY "MAY SPEND MONEY"
-- 2026-08-01 · David's ruling · ledger #181
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- 🔴 GATED. NOT APPLIED. David applies this in the Supabase SQL editor and runs every V-check.
--
-- APPLY ORDER — `20260801_business_modules_write_narrowing.sql` FIRST, then THIS.
--   That file created `set_business_module_state()` and narrowed the table to a SELECT-only policy,
--   with EVERY write gated on `settings:update` — deliberately, because a narrowing must not also
--   change who passes (#172). This file makes the second change on its own: it SPLITS that one gate
--   in two.
--   ✏️ CORRECTED 2026-08-01: this line previously said applying this file alone "replaces a function
--   that does not exist yet", implying an error would stop you. **It would not.** `CREATE OR REPLACE`
--   creates the function when it is absent and raises nothing, so applying b alone SUCCEEDS QUIETLY
--   and leaves the split gate guarding a table anyone can still write around. The sentence made a
--   dangerous order sound self-correcting. See the PAIR block below for what each order actually does.
--
-- WHAT THIS DOES, in one sentence: enabling a module becomes a DIFFERENT ACT from configuring one,
-- because one of them changes the bill.
--
-- ── WHY A NEW STRING AT ALL (the check that came before the mint) ────────────────────────────────
-- Twenty resources in the manifest and NOT ONE of them is about money leaving the business. That
-- capability has never existed in the model. `settings:update` was the only near-miss and it is
-- disqualified on evidence: MANAGER_DEFAULT_BUNDLE contains it, so a manager would enable a $49/mo
-- module on day one and the only remedy would be re-gating a live screen.
--
-- ── NO DELETE VERB ──────────────────────────────────────────────────────────────────────────────
-- A module is DISABLED, never deleted. The row is the tenant's billing history for that module —
-- when its trial started, how it was configured, whether it was ever on. Deleting it destroys the
-- record of a thing the business was charged for. (Same shape as `campaigns` R2, reached
-- independently: that one is about history, this one is about money.)
--
-- SCHEMA: one function REPLACEMENT + one role_definitions floor UPDATE + the funnel reset per
-- business. No table, column, policy, constraint, FK or trigger changes. The SELECT-only policy
-- from 20260801 is untouched.
--
-- ████████████████████████████████████████████████████████████████████████████████████████████████
-- 🔴 SECOND HALF OF A PAIR. APPLY ORDER: **20260801 → THIS FILE**, NEVER REVERSED.
-- ████████████████████████████████████████████████████████████████████████████████████████████████
--
-- ⛔ THE PRE-APPLY QUERY AND THE FULL APPLY-ORDER ANALYSIS LIVE AT THE TOP OF
--    `20260801_business_modules_write_narrowing.sql` — ONE query covering BOTH files, because the
--    thing being asked ("which half has run, and is the owner still able to act?") is one question
--    about one surface. This file had its own PRE-APPLY GATE; it was FOLDED INTO THAT ONE and is
--    not repeated here. Two queries answering one question is how a reader ends up trusting the
--    greener one (STD-011).
--
-- ⚠️ THE HAZARD, repeated here because it is the one that bites SILENTLY and this is the file whose
--    work gets destroyed: both files `CREATE OR REPLACE` the same function with a BYTE-IDENTICAL
--    signature, so **running 20260801 AFTER this file silently reverts the enablement split** with
--    no error. Stage B of the combined query is the detector — re-run it after applying this file
--    and it MUST read `SPLIT`.
--
-- ⚠️ THIS FILE ASSUMES 20260801's POLICY STATE AND DOES NOT RE-DERIVE IT. It touches NO policy. On
--    its own the split gate is DECORATIVE: `business_modules_member_access` would still be FOR ALL,
--    so any active member writes `enabled` directly and never reaches this function. Applying only
--    this file is a BROKEN state, not a partial one.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §1 — THE GATE SPLITS. Configuring is `settings:update`. Enabling is `subscription:update`.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Every clause not mentioned below is carried over from 20260801 VERBATIM — the actor assertion,
-- the D-9 value validation, the `IF NOT FOUND → INSERT` create path, the config MERGE, the audit
-- row and its `no_change` outcome. This replaces the AUTHORITY step and nothing else.
--
-- 🔴 THE ENABLEMENT GATE IS KEYED ON AN ACTUAL CHANGE, NOT ON THE PARAMETER BEING PRESENT.
--    `p_enabled IS DISTINCT FROM v_before` — so a caller that passes `enabled := true` for a module
--    that is ALREADY enabled needs no spend authority, because it is not spending anything. This is
--    what keeps the split from being a silent narrowing: `api/social/enable.ts` passes true on every
--    save, and on a tenant where Social is already on, a MANAGER's save keeps working exactly as it
--    did yesterday. On a NEW tenant the same call is a FIRST enable — a real $19/mo decision — and
--    it is refused for anyone without `subscription:update`. That asymmetry is correct and it is
--    the whole ruling: the owner subscribes, the manager configures.
--
--    A NULL row counts as a change (`true IS DISTINCT FROM NULL` = true), so creating a row already
--    enabled is a spend. It cannot be smuggled in through the INSERT path.
--
-- 🔴 A DENIAL OF EITHER KIND IS RECORDED, and they are DIFFERENT ACTIONS in the log. `_denied` with
--    one undifferentiated reason would make "a manager tried to configure without settings:update"
--    and "a manager tried to SPEND MONEY without authority" the same row. The second is the one
--    worth an owner's attention.
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
  v_touches_config     boolean;
  v_touches_enablement boolean;
BEGIN
  -- (1) NO FORGERY — a client-direct caller may only act as themselves. UNCHANGED.
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- (2) D-9 value validation moves AHEAD of the authority check, for one reason: the enablement
  --     gate now needs to know the CURRENT value, and reading it requires a usable module_key.
  --     Refusing nonsense before authority also means a garbage key never produces a denial row
  --     that reads as an authority incident.
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

  v_touches_config     := (p_config_patch IS NOT NULL AND p_config_patch <> '{}'::jsonb)
                       OR (p_configured IS NOT NULL AND (NOT v_existed OR p_configured IS DISTINCT FROM
                             (SELECT bm.configured FROM public.business_modules bm
                               WHERE bm.business_id = p_business_id AND bm.module_key = p_module_key)));
  v_touches_enablement := p_enabled IS NOT NULL AND p_enabled IS DISTINCT FROM v_before;

  -- (3a) AUTHORITY — CONFIG. Unchanged from 20260801: `settings:update`.
  IF v_touches_config
     AND NOT public.has_permission_for(p_business_id, p_actor_user_id, 'settings:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'business_module.update_denied', 'business_module', p_module_key,
            jsonb_build_object('attempted_configured', p_configured,
                               'attempted_config_keys',
                               COALESCE((SELECT array_agg(k) FROM jsonb_object_keys(COALESCE(p_config_patch, '{}'::jsonb)) k), ARRAY[]::text[])),
            'denied');
    RETURN QUERY SELECT false, 'settings:update permission required'::text, false, NULL::boolean, NULL::boolean;
    RETURN;
  END IF;

  -- (3b) AUTHORITY — ENABLEMENT. THE NEW GATE. This is the one that changes the bill.
  IF v_touches_enablement
     AND NOT public.has_permission_for(p_business_id, p_actor_user_id, 'subscription:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'business_module.enablement_denied', 'business_module', p_module_key,
            jsonb_build_object('enabled_before', v_before, 'attempted_enabled', p_enabled), 'denied');
    RETURN QUERY SELECT false, 'subscription:update permission required — enabling or disabling a module changes what this business pays'::text,
                        false, v_before, v_before;
    RETURN;
  END IF;

  -- (4) THE WRITE. UNCHANGED from 20260801, including the create path and the config MERGE.
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

  -- (5) THE RECORD. UNCHANGED, plus `enablement_changed` so a spend is findable in the log without
  --     diffing two jsonb fields. STD-023: a save that changed nothing keeps its row and says so.
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'business_module.state_changed', 'business_module', p_module_key,
          jsonb_build_object('was_insert', NOT v_existed, 'enabled_before', v_before,
                             'enabled_after', COALESCE(p_enabled, v_before),
                             'enablement_changed', v_touches_enablement,
                             'config_keys_patched', COALESCE((SELECT array_agg(k) FROM jsonb_object_keys(COALESCE(p_config_patch, '{}'::jsonb)) k), ARRAY[]::text[])),
          CASE WHEN v_existed AND NOT v_touches_enablement AND NOT v_touches_config
               THEN 'no_change' ELSE 'success' END);

  RETURN QUERY SELECT true, NULL::text, NOT v_existed, v_before, COALESCE(p_enabled, v_before);
END;
$$;

REVOKE ALL ON FUNCTION public.set_business_module_state(uuid, text, boolean, boolean, jsonb, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_business_module_state(uuid, text, boolean, boolean, jsonb, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.set_business_module_state(uuid, text, boolean, boolean, jsonb, uuid) IS
  'The ONE writer of business_modules. TWO gates, because they are two acts: config/configured '
  'require settings:update; ENABLEMENT requires subscription:update and only when the value '
  'actually changes. The owner subscribes, the manager configures (ruling 2026-08-01).';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- §2 — THE OWNER FLOOR GROWS 52 → 54, CARRYING THE COMPLETE SET
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 THE COMPLETE SET, NEVER A DELTA — and that is now MECHANICALLY REQUIRED, not a convention.
-- capA assertion 3 was un-pinned earlier today (5e7f009): it compares OWNER_DEFAULT_BUNDLE against
-- the NEWEST migration carrying an `$OWNER$[…]$OWNER$` literal, by FULL EQUALITY. This file is now
-- that newest carrier. A delta-shaped literal here would fail the build with 52 strings missing —
-- which is the contract working, not the cap being awkward.
--
-- 20260730a IS NOT EDITED. It stays exactly as it was applied; capA prints it as `superseded`.
-- This is the whole reason the pin came out: the model could not grow without editing history.
UPDATE public.role_definitions
   SET permissions = $OWNER$[
  "audit_log:read", "campaigns:read", "campaigns:update", "costs:create", "costs:delete",
  "costs:read", "costs:update", "customers:create", "customers:read", "customers:update",
  "deliveries.route:read", "deliveries:create", "deliveries:read", "deliveries:update",
  "inventory:create", "inventory:delete", "inventory:import_price", "inventory:read",
  "inventory:update", "inventory_ledger:read", "margin:read", "order_compliance_records:create",
  "order_compliance_records:read", "order_compliance_records:update", "order_discount:apply",
  "order_items:create", "order_items:delete", "order_items:read", "order_items:update",
  "order_service_selections:create", "order_service_selections:delete",
  "order_service_selections:read", "order_service_selections:update", "orders:create",
  "orders:delete", "orders:read", "orders:update", "pmi:read", "pmi:update", "pricing_recipe:read",
  "pricing_recipe:update", "service_offerings:read", "settings:read", "settings:update",
  "subscription:read", "subscription:update", "tax_exempt:apply", "tax_rate:read",
  "tax_rate:update", "team:read", "wages:create", "wages:delete", "wages:read", "wages:update"
]$OWNER$::jsonb,
       description = 'Holds every enforced permission in the manifest. LOCKED — computed from the '
                  || 'model, not curated. A new enforced permission is inherited automatically; no '
                  || 'permission can be removed, including by the owner (ruling 2026-07-30). '
                  || 'Grown to 54 on 2026-08-01 by the subscription:* mint.',
       updated_at  = now()
 WHERE business_id IS NULL
   AND role_key    = 'OWNER';

-- ── §3 — EVERY BUSINESS RESETS ITS OWNER ROLE ONTO THE NEW FLOOR, THROUGH THE FUNNEL ────────────
-- Identical mechanism to 20260730a §2 and for the same reasons: the funnel is the only way a
-- role→permission fact changes, the side-door trigger refuses a direct write anyway, and going
-- through it produces the audit row that makes this visible afterwards. The actor is the REAL
-- owner (auth.uid() is NULL in the SQL editor, so a NULL actor would fail the membership check and
-- name a system ghost in the log). A business with owner_id IS NULL is SKIPPED — the known LAWNS
-- gap; V4 reports those rather than burying them.
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
             b.id, b.owner_id, 'OWNER', 'reset', NULL, NULL,
             '[]'::jsonb,                          -- ignored by `reset`; the floor is the source
             'rbac-model:subscription-mint'        -- p_reason — the audit says WHY
           );
    RAISE NOTICE 'OWNER reset · % (%) · rows=%', b.name, b.id, v_rows;
  END LOOP;
END $$;

COMMIT;


-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — RUN EVERY ONE AFTER APPLYING. Thunder CANNOT run these (no catalog access); they are
-- David's, per the §9 schema-verification gate. Paste the OUTPUT, not a sentence saying it passed.
-- Anything not matching its stated expectation is a STOP, not a note.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── V1 — THE FLOOR IS 54, AND BOTH NEW STRINGS ARE IN IT.
--   SELECT jsonb_array_length(permissions) AS n,
--          permissions ? 'subscription:read'   AS has_read,
--          permissions ? 'subscription:update' AS has_update,
--          (SELECT count(*) FROM jsonb_array_elements_text(permissions) x(s) WHERE s NOT LIKE '%:%')
--            AS legacy_remaining
--     FROM public.role_definitions WHERE business_id IS NULL AND role_key = 'OWNER';
--   EXPECT: n = 54 · has_read = t · has_update = t · legacy_remaining = 0.
--
-- ── V2 — EVERY LIVE OWNER CARRIES THE 54. This is the one that decides whether the marketplace
--         will work for the person it is built for. CORPUS: business_members, role OWNER, active.
--   SELECT b.name, m.user_id, jsonb_array_length(m.permissions) AS n,
--          m.permissions ? 'subscription:update' AS can_spend
--     FROM public.business_members m
--     JOIN public.businesses b ON b.id = m.business_id
--    WHERE m.role = 'OWNER' AND m.active = true
--    ORDER BY b.name;
--   EXPECT: every row n = 54 · can_spend = t. A row at 52 means §3 skipped that business —
--           check owner_id (V4), do NOT hand-edit the array.
--
-- ── V3 🔴 THE SPLIT IS REAL, PROVEN IN BOTH DIRECTIONS, ON A THROWAWAY KEY.
--   -- V3a — a CONFIG-ONLY write by the owner succeeds and does NOT enable anything.
--   SELECT * FROM public.set_business_module_state(
--     (SELECT id FROM public.businesses WHERE owner_id IS NOT NULL ORDER BY name LIMIT 1),
--     'zz_probe', NULL, true, '{"probe":1}'::jsonb,
--     (SELECT owner_id FROM public.businesses WHERE owner_id IS NOT NULL ORDER BY name LIMIT 1));
--   EXPECT: applied = t · was_insert = t · enabled_after = f  ← configuring did NOT subscribe.
--
--   -- V3b — the same owner ENABLES it. Requires subscription:update, which V2 just proved.
--   SELECT * FROM public.set_business_module_state(
--     (SELECT id FROM public.businesses WHERE owner_id IS NOT NULL ORDER BY name LIMIT 1),
--     'zz_probe', true, NULL, NULL,
--     (SELECT owner_id FROM public.businesses WHERE owner_id IS NOT NULL ORDER BY name LIMIT 1));
--   EXPECT: applied = t · enabled_before = f · enabled_after = t.
--
--   -- V3c — a re-enable of an ALREADY-enabled module is NOT a spend (the no-silent-narrowing case).
--   --        Run V3b again, verbatim.
--   EXPECT: applied = t · enabled_before = t · enabled_after = t, and the audit row's outcome is
--           'no_change' with enablement_changed = false.
--
--   -- V3d 🔴 THE NEGATIVE. A member holding settings:update but NOT subscription:update must be
--   --        able to configure and NOT able to enable. Run as a MANAGER user_id on this tenant:
--   SELECT * FROM public.set_business_module_state(<business_id>, 'zz_probe', false, NULL, NULL, <manager_user_id>);
--   EXPECT: applied = f · reason mentions subscription:update · the module is STILL enabled ·
--           an audit row action = 'business_module.enablement_denied', outcome = 'denied'.
--   ⚠️ If this SUCCEEDS, the split did not take — STOP and do not deploy the client.
--
--   -- V3e — the same manager CONFIGURING the same module still works (proves 3d is not a wall).
--   SELECT * FROM public.set_business_module_state(<business_id>, 'zz_probe', NULL, true, '{"probe":2}'::jsonb, <manager_user_id>);
--   EXPECT: applied = t.
--
--   -- CLEANUP — the probe row is not a module. Remove it and its audit noise stays (audit is
--   -- append-only by trigger and that is correct; the rows record a real test).
--   DELETE FROM public.business_modules WHERE module_key = 'zz_probe';
--   EXPECT: DELETE 1.
--
-- ── V4 — WHICH BUSINESSES §3 SKIPPED, named rather than buried.
--   SELECT name, id FROM public.businesses WHERE owner_id IS NULL ORDER BY name;
--   EXPECT: the known LAWNS row and nothing surprising. Each row here is a tenant whose owner
--           holds NOTHING — tracked in CLAUDE.md §4, not created by this migration.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT CHANGES IN THE APP WHEN THIS LANDS
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- · `financialDataAccess.writePricingConfig` STOPS SETTING `enabled: true` as a side effect of
--   saving a cost model. Saving your pricing recipe silently subscribed you to a module; it now
--   sets `configured` and leaves enablement to the owner. PROVEN SAFE BEFORE CHANGING IT: nothing
--   reads `cost_to_produce.enabled` — the tile is `placement:'admin'` and `useModules` only ever
--   maps dashboard tiles, so no surface changes state.
-- · `api/social/enable.ts` moves to the RPC. It is NOT blocked either way (service key), but the
--   table gets ONE writer (STD-011) and its act becomes audited like every other. It passes
--   `enabled := true`; on a tenant where Social is already on that is not a change and needs no
--   spend authority — see §1's IS DISTINCT FROM reasoning.
-- · Nothing else. Every reader is SELECT-only and the SELECT policy did not move.
