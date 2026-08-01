-- Migration: the TENANT MODULE SEED + the PER-MODULE TRIAL CLOCK
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-08-01 · Ledger #181 · ITEM 2 of the module-monetization build order
--
-- ⛔ GATED — DAVID APPLIES. Thunder has no catalog access and cannot run the V-block.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 DEPENDENCY: THIS FILE ASSUMES **20260801 AND 20260801b ARE BOTH APPLIED**, IN THAT ORDER.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- Confirmed applied and PROVEN 2026-08-01 (member_select FOR SELECT only · a manager's direct
-- UPDATE affects 0 rows · STAFF refused by the RPC with a named reason · owner floor 54 · V3d
-- proved the split). This file DEPENDS on that state in two ways, both stated rather than assumed:
--
--   1. `subscription:update` MUST EXIST IN THE OWNER FLOOR (20260801b §2, 52 → 54). Both functions
--      below gate on it. If the floor were still 52 the seed would be DENIED for every owner and
--      every new tenant would get zero module rows — the exact silent failure this file's own
--      §"WHAT HAPPENS WHEN THE SEED FAILS" is about.
--   2. `business_modules` HAS NO CLIENT WRITE POLICY (20260801 Part 2). That is WHY the seeder is
--      an RPC at all: a browser-side `.insert()` from the newly-created owner would be discarded
--      with no error and zero rows. The seeder could not be a plain table write even if we wanted
--      one.
--
-- ⚠️ THIS FILE DOES **NOT** `CREATE OR REPLACE set_business_module_state`. It adds two NEW,
-- differently-named functions and touches neither the policy nor the existing writer. **It cannot
-- reproduce the 20260801/20260801b silent-clobber hazard** — that hazard existed because two files
-- replaced one byte-identical signature. Nothing here shares a signature with anything.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT THIS ADDS, AND WHY IT IS TWO FUNCTIONS
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--   · `start_module_trial(uuid, text, uuid)`        — THE CLOCK. The ONLY writer of
--                                                     `config->'trial_started_at'`, anywhere.
--   · `seed_business_modules(uuid, uuid, jsonb)`    — one row per catalog module at tenant
--                                                     creation. Calls the clock; never spells the
--                                                     key itself.
--
-- 🔴 WHY THE CLOCK IS NOT `set_business_module_state(p_config_patch)`. David's ruling, and
-- 20260801:185-189 already committed to it in writing: `p_config_patch` accepts ARBITRARY KEYS and
-- MERGES them. A caller that typed `trial_start_at` would get a successful write, a `success` audit
-- row, and a module whose trial never ends — because the reader looks for `trial_started_at` and
-- finds nothing, which is indistinguishable from "no trial was ever started." **A typo surface on a
-- money field is not acceptable when the alternative is a named function.** Here the key is a SQL
-- literal inside `jsonb_set`, it appears EXACTLY ONCE in this file, and no caller can spell it at
-- all — callers pass a business and a module, never a key.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 THE PERMISSION IS `subscription:update`, AND THE READ IS RECORDED BECAUSE THE CALL IS ARGUABLE
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- The honest case FOR `settings:update` (i.e. against this choice): starting a trial costs $0. No
-- money leaves the business on day one. A manager evaluating Social Media for thirty days spends
-- nothing, and making her ask the owner for permission to TRY something is friction with no invoice
-- behind it.
--
-- The case FOR `subscription:update`, which is the one taken:
--   (a) **A trial is a spend with a delay, not an absence of spend.** At day thirty the module
--       either converts to $19/mo or goes dark. Starting the clock does not decide the money — it
--       SCHEDULES the decision, on a date the starter picked, for an owner who may not have been
--       asked. `subscription:*` was minted precisely so a manager cannot create a bill the owner
--       did not choose; a bill that arrives thirty days late is still a bill the owner did not
--       choose.
--   (b) **The clock is not restartable** (see the idempotence clause below). It is a one-shot
--       resource per module. Spending it is an irreversible commitment of something the business
--       owns exactly one of, which is the shape of a subscription act and not the shape of a
--       setting.
--   (c) **Decisive: the clock lives in the same row as `enabled`, behind the same wall, and for the
--       same stated reason.** 20260801's own header says it — *"a clock the person being billed can
--       rewrite is not a clock."* If `settings:update` could start the clock while
--       `subscription:update` is required to keep the module past day thirty, then the timer would
--       be writable by a strictly LARGER set than the enablement it governs. A wall whose weakest
--       gate is the one on the timer is not a wall.
--
-- THE COST OF THE CHOICE, STATED: a MANAGER cannot start a trial. "Let Lauren try Social Media for
-- a month" is one click by Terry. That is the ruling's own trade — the owner subscribes, the
-- manager configures — and it is a product cost, not an oversight. **Reversing it is a one-string
-- change in two places in this file; it is David's to reverse.**
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WHAT THE CLOCK STORES — ONE KEY, AND THE HAZARD THAT LEAVES BEHIND
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- `config->'trial_started_at'` — the START, and nothing else. The LENGTH (`trial_days`) stays in
-- MODULE_CATALOG and is read at render time. That is the ruling, and it is one representation of
-- one fact (STD-011).
--
-- ⚠️ THE CONSEQUENCE, NAMED RATHER THAN DISCOVERED: **changing `trial_days` in the catalog moves
-- the end date of every trial already running.** The catalog's own header says `trial_days: 30` is
-- INHERITED, NOT RATIFIED — so if David rules 14, every tenant seeded more than fourteen days ago
-- has a trial that ALREADY EXPIRED, retroactively, with no event marking it. The alternative
-- (capture the term in the row at seed time, as a contract term is captured when it is offered) is
-- a SECOND key and was not ruled. **Named as a ruling owed, not silently chosen either way.**
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 WHAT HAPPENS WHEN THE SEED FAILS — the question that has to be answered before this ships
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- The seed is NON-BLOCKING at the call sites (§6 r6 — a failed seed must never lose a business that
-- already exists). Combined with "the clock lives in the row," that means a silent seed failure is
-- **a tenant that never gets billed**, and the failure is INVISIBLE:
--
--   `useModules.ts:104` reads `nmByKey[module_key] ?? null` and renders `available` for a MISSING
--   row and for a `enabled:false` row IDENTICALLY. **An unseeded tenant looks exactly like a
--   correctly-seeded tenant with everything switched off.** That is the D-9 shape — absent
--   rendering as present-and-zero — one layer below the UI, in the data.
--
-- THREE THINGS ARE BUILT AGAINST IT, and one gap is left NAMED:
--   1. **The RPC RETURNS COUNTS** (`expected` / `seeded` / `existing`) instead of a bare boolean, so
--      the caller can COMPARE rather than assume. `seeded + existing <> expected` is a SHORT SEED
--      and the client warns loudly with the numbers.
--   2. **IT IS IDEMPOTENT** (`ON CONFLICT DO NOTHING` + a clock that refuses to restart), so
--      re-running is always safe and is therefore always the repair.
--   3. **IT IS CALLED FROM BOTH PATHS, AND THE WIZARD CALL SITS OUTSIDE THE LEGACY BRANCH** — so a
--      signup-path failure is REPAIRED minutes later when the owner finishes onboarding.
--      (`seedPricingConfig`'s wizard call is INSIDE the legacy branch and does not self-heal; that
--      difference is deliberate and is noted at both call sites.)
--   4. 🔴 **THE RESIDUAL, OWED NOT CLAIMED:** an owner who signs up and ABANDONS onboarding, with
--      the signup call also failing, has no rows and nothing will ever notice. The right third home
--      is the marketplace screen's own load (ITEM 3) — seed-if-absent on open, because the
--      marketplace is the one surface where a missing row is visibly wrong. **NOT BUILT HERE.**
--      Until it is, V6 below is the standing detection query.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ⚠️ PRE-APPLY — ONE QUERY. Read every row before running anything.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- SELECT * FROM (
--   -- A · THE PAIR IS APPLIED. This file is meaningless otherwise.
--   SELECT 1 AS ord, 'A · set_business_module_state gate'::text AS stage,
--          COALESCE((SELECT CASE WHEN pg_get_functiondef(pr.oid) LIKE '%subscription:update%'
--                                THEN 'SPLIT — 20260801 + b both applied. PROCEED.'
--                                ELSE 'settings:update ONLY — 20260801b NOT applied. STOP.' END
--                      FROM pg_proc pr JOIN pg_namespace n ON n.oid = pr.pronamespace
--                     WHERE n.nspname='public' AND pr.proname='set_business_module_state'),
--                   'ABSENT — neither applied. STOP.')::text AS observed
--   UNION ALL
--   -- B · THE POLICY IS NARROWED. If a FOR ALL policy is still here, 20260801 did not run.
--   SELECT 2, 'B · business_modules policies',
--          COALESCE(string_agg(p.polname || ' [' || p.polcmd || ']', ', ' ORDER BY p.polname),
--                   '(none — STOP)')
--     FROM pg_class c LEFT JOIN pg_policy p ON p.polrelid = c.oid
--    WHERE c.relname='business_modules' AND c.relnamespace='public'::regnamespace
--   UNION ALL
--   -- C · EVERY OWNER CAN ACTUALLY SEED. `subscription:update` on the owner's member row is the
--   --     ONE string both new functions check. A `false` here means that tenant seeds NOTHING.
--   SELECT 3, 'C · owner can seed · ' || b.name,
--          CASE WHEN m.user_id IS NULL THEN 'NO MEMBER ROW — seeds nothing (20260730b §2 fixes it)'
--               WHEN NOT m.active      THEN 'INACTIVE — seeds nothing'
--               WHEN NOT (m.permissions ? 'subscription:update')
--                                      THEN 'MISSING subscription:update — n=' ||
--                                           COALESCE(jsonb_array_length(m.permissions),0)::text ||
--                                           ' (expect 54; 52 means 20260801b §3 skipped this business)'
--               ELSE 'ok · can seed · n=' || COALESCE(jsonb_array_length(m.permissions),0)::text END
--     FROM public.businesses b
--     LEFT JOIN public.business_members m ON m.business_id=b.id AND m.user_id=b.owner_id
-- ) x ORDER BY ord, stage;
--
-- GO / NO-GO:
--   · A must read SPLIT. Anything else → STOP, apply the pair first.
--   · B must show ONLY `business_modules_member_select [r]`.
--   · Any C row that is not `ok` is a tenant that will seed NOTHING. That is not a reason to hold
--     this migration (the functions are still correct), but WRITE IT DOWN — it is a tenant with no
--     trial clock, and V6 will keep reporting it until the member row is fixed.
--
-- NEVER EDIT APPLIED MIGRATIONS. This file appends; it edits nothing.

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART 1 — THE CLOCK. The only writer of `trial_started_at`, anywhere in the platform.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- The `set_business_tax_rate` shape (20260727_rbac_resource_action_flip.sql:293) — its FOURTH
-- instance after `save_role_permissions` and `set_business_module_state`. Every clause is here
-- because that function has it and for the same reason: actor asserted, permission checked with the
-- DENIAL AUDITED, value validated (D-9), create-if-absent, audit row, REVOKE/GRANT.
--
-- ONE DELIBERATE DEPARTURE FROM THAT SHAPE, and it is the ruling. `set_business_tax_rate` does
-- `UPDATE … IF NOT FOUND → INSERT`, which would put the `{trial_started_at}` literal in BOTH
-- branches. Here the row is created FIRST (`ON CONFLICT DO NOTHING`) and the clock is then written
-- by a SINGLE `jsonb_set`. Same create-if-absent semantics, and **the key is spelled exactly once
-- in this file** — which is the whole point of the clock having its own function.
CREATE OR REPLACE FUNCTION public.start_module_trial(
  p_business_id   uuid,
  p_module_key    text,
  p_actor_user_id uuid
) RETURNS TABLE(applied boolean, reason text, started_at timestamptz, was_already_running boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_before  timestamptz;
  v_existed boolean;
  v_after   timestamptz;
BEGIN
  -- (1) NO FORGERY — a client-direct caller may only act as themselves.
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- (2) D-9 validation AHEAD of authority, matching 20260801b's ordering and for its reason: a
  --     garbage key must not produce a denial row that reads as an authority incident.
  IF p_module_key IS NULL OR btrim(p_module_key) = '' THEN
    RETURN QUERY SELECT false, 'module_key is required'::text, NULL::timestamptz, false;
    RETURN;
  END IF;

  -- (3) AUTHORITY. See the header for why this is `subscription:update` and not `settings:update`.
  --     A denial is RECORDED — an attempt nobody can see is an attempt nobody can investigate.
  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'subscription:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'module_trial.start_denied', 'business_module', p_module_key,
            jsonb_build_object('attempted_module', p_module_key), 'denied');
    RETURN QUERY SELECT false,
      'subscription:update permission required — starting a trial schedules what this business will pay'::text,
      NULL::timestamptz, false;
    RETURN;
  END IF;

  SELECT (bm.config->>'trial_started_at')::timestamptz INTO v_before
    FROM public.business_modules bm
   WHERE bm.business_id = p_business_id AND bm.module_key = p_module_key;
  v_existed := FOUND;

  -- (4) 🔴 A RUNNING CLOCK IS NEVER RESTARTED. This is the assertion that makes it a clock rather
  --     than a field. Without it, the seeder's own repair re-run — the thing that makes a failed
  --     seed recoverable — would hand every module a fresh thirty days on every onboarding load,
  --     and a trial that renews itself is a trial that never ends. It is also the tamper answer:
  --     even a caller who HOLDS `subscription:update` cannot buy themselves another month.
  --     Reported as `applied:true, was_already_running:true` — the requested state HOLDS, and the
  --     caller asked for a started clock, which is what it has. That is not a failure.
  IF v_existed AND v_before IS NOT NULL THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'module_trial.started', 'business_module', p_module_key,
            jsonb_build_object('trial_started_at', v_before, 'restart_refused', true), 'no_change');
    RETURN QUERY SELECT true, NULL::text, v_before, true;
    RETURN;
  END IF;

  -- (5) CREATE-IF-ABSENT, then the ONE write of the key. A module whose trial is being started must
  --     have a row to hold it; `ON CONFLICT DO NOTHING` means an existing row keeps its enabled /
  --     configured / config values untouched — starting a clock is not a state change.
  INSERT INTO public.business_modules (business_id, module_key, enabled, configured, config)
  VALUES (p_business_id, p_module_key, false, false, '{}'::jsonb)
  ON CONFLICT (business_id, module_key) DO NOTHING;

  -- ⬇⬇ THE ONLY OCCURRENCE OF `trial_started_at` AS A WRITE TARGET IN THE ENTIRE PLATFORM. ⬇⬇
  UPDATE public.business_modules
     SET config = jsonb_set(COALESCE(config, '{}'::jsonb), '{trial_started_at}', to_jsonb(now()), true)
   WHERE business_id = p_business_id AND module_key = p_module_key
  RETURNING (config->>'trial_started_at')::timestamptz INTO v_after;

  -- (6) THE RECORD. A trial starting is a money event; it gets a row with its own action name so it
  --     is findable without diffing two jsonb blobs.
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'module_trial.started', 'business_module', p_module_key,
          jsonb_build_object('trial_started_at', v_after, 'row_created', NOT v_existed), 'success');

  RETURN QUERY SELECT true, NULL::text, v_after, false;
END;
$$;

REVOKE ALL ON FUNCTION public.start_module_trial(uuid, text, uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.start_module_trial(uuid, text, uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.start_module_trial(uuid, text, uuid) IS
  'THE PER-MODULE TRIAL CLOCK. The only writer of business_modules.config->trial_started_at, '
  'anywhere — the key is a SQL literal here and no caller can spell it. Gated on '
  'subscription:update: a trial is a spend with a delay, and the clock must not be writable by a '
  'larger set than the enablement it governs. A running clock is NEVER restarted (ruling 2026-08-01).';

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- PART 2 — THE SEED. One row per catalog module, at tenant creation. Idempotent by construction.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 ROWS FOR EVERY MODULE, INCLUDING CORE — David's ruling, and his reason is the deciding one:
-- **a module may MOVE to core as the platform builds out, and with a row for everything that is a
-- field change in MODULE_CATALOG rather than a migration.** A model where core modules have no row
-- would make every promotion or demotion a data-migration against live tenants.
--
-- 🔴 THE CATALOG IS PASSED IN, NOT READ HERE, AND THAT IS AC-1. `MODULE_CATALOG` is a
-- cultivar-package artifact; this function serves every vertical. A hardcoded module list in SQL
-- would be the platform's fourth representation of the catalog and the only one nothing reconciles
-- — the `OWNER_ONLY_PENDING` shape (tech-debt #73) in a migration. The caller sends the rows; this
-- function owns the MECHANISM (authority, idempotence, the clock, the record) and knows no module
-- names at all.
--
-- 🔴 THE BATCH IS ALL-OR-NOTHING ON VALIDATION. A malformed element refuses the WHOLE payload
-- rather than seeding the good half. A partially-seeded tenant is worse than an unseeded one: it
-- looks seeded to every count-based check, and the modules that silently didn't land are the ones
-- with no clock and no bill. D-9 — refuse nonsense rather than storing part of it.
CREATE OR REPLACE FUNCTION public.seed_business_modules(
  p_business_id   uuid,
  p_actor_user_id uuid,
  p_modules       jsonb   -- [{"module_key":"qr_checkout","enabled":true,"start_trial":false}, …]
) RETURNS TABLE(applied boolean, reason text, expected int, seeded int, existing int, trials_started int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_expected int;
  v_seeded   int := 0;
  v_trials   int := 0;
  v_bad      text;
  r          record;
BEGIN
  -- (1) NO FORGERY.
  PERFORM public.assert_movement_actor(p_business_id, p_actor_user_id);

  -- (2) D-9 SHAPE VALIDATION, ahead of authority (20260801b's ordering).
  IF p_modules IS NULL OR jsonb_typeof(p_modules) <> 'array' THEN
    RETURN QUERY SELECT false, 'modules must be a JSON array'::text, 0, 0, 0, 0;
    RETURN;
  END IF;
  v_expected := jsonb_array_length(p_modules);
  IF v_expected = 0 THEN
    -- An empty catalog is a caller bug, not a tenant with nothing. Refuse it loudly rather than
    -- reporting a successful seed of nothing — `applied:true, seeded:0` would be a lie the caller
    -- has no way to distinguish from "already seeded".
    RETURN QUERY SELECT false, 'module catalog is empty — nothing to seed'::text, 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT string_agg(DISTINCT x.problem, '; ') INTO v_bad
    FROM (
      SELECT CASE
               WHEN jsonb_typeof(e.value) <> 'object'                      THEN 'every element must be an object'
               WHEN COALESCE(btrim(e.value->>'module_key'), '') = ''        THEN 'every element needs a non-blank module_key'
               -- ⚠️ COALESCE IS LOAD-BEARING. A MISSING key makes `->` return SQL NULL, so
               -- `jsonb_typeof(NULL) <> 'boolean'` evaluates to NULL — not TRUE — and the CASE
               -- would fall through to the next branch and out with no problem recorded. The
               -- element with no `enabled` at all would pass validation and then seed as NULL
               -- against a NOT NULL column. A missing field must fail the same way a wrong one does.
               WHEN COALESCE(jsonb_typeof(e.value->'enabled'),     '') <> 'boolean' THEN 'enabled must be a boolean'
               WHEN COALESCE(jsonb_typeof(e.value->'start_trial'), '') <> 'boolean' THEN 'start_trial must be a boolean'
             END AS problem
        FROM jsonb_array_elements(p_modules) e
    ) x
   WHERE x.problem IS NOT NULL;

  IF v_bad IS NOT NULL THEN
    RETURN QUERY SELECT false, ('malformed module catalog — ' || v_bad)::text, v_expected, 0, 0, 0;
    RETURN;
  END IF;

  -- (3) AUTHORITY — the SAME string the clock checks, and it must be, because this function starts
  --     clocks. A seed gated more loosely than `start_module_trial` would be a way to reach the
  --     clock through the back door with weaker authority.
  IF NOT public.has_permission_for(p_business_id, p_actor_user_id, 'subscription:update') THEN
    INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
    VALUES (p_business_id, p_actor_user_id, NULL, 'business_modules.seed_denied', 'business', p_business_id::text,
            jsonb_build_object('expected', v_expected), 'denied');
    RETURN QUERY SELECT false,
      'subscription:update permission required — seeding a tenant starts its trial clocks'::text,
      v_expected, 0, 0, 0;
    RETURN;
  END IF;

  -- (4) THE ROWS. `ON CONFLICT DO NOTHING` is what makes the whole thing re-runnable: an existing
  --     tenant's enabled/configured/config are NEVER clobbered by a re-seed. Seeding is a
  --     create-if-absent act — the same contract `seedPricingConfig` uses (`ignoreDuplicates`), and
  --     the reason is the same: the repair path and the create path must be the same call.
  INSERT INTO public.business_modules (business_id, module_key, enabled, configured, config)
  SELECT p_business_id, m.module_key, m.enabled, false, '{}'::jsonb
    FROM jsonb_to_recordset(p_modules) AS m(module_key text, enabled boolean, start_trial boolean)
  ON CONFLICT (business_id, module_key) DO NOTHING;
  GET DIAGNOSTICS v_seeded = ROW_COUNT;

  -- ⚠️ `configured` SEEDS FALSE FOR EVERYTHING, CORE INCLUDED, and that is honest rather than
  -- convenient. `configured` means "the owner has set this up" and at seed nobody has set anything
  -- up — QuickBooks has no OAuth link, Social has no channels. The visible consequence, stated so
  -- it is not read as a bug: `useModules.ts:104` renders `active` only on `enabled && configured`,
  -- so a seeded CORE tile still shows `available`, not `active`. If David wants QR Checkout to read
  -- `active` from day one that is a per-module fact about whether a module HAS configuration —
  -- a catalog field and a ruling, not something this function should invent.

  -- (5) THE CLOCKS. Delegated, never re-implemented: `start_module_trial` re-checks authority and
  --     writes its own audit row per module, so a trial start is findable in the log whether it
  --     came from a seed or from a click. That is deliberate volume, not noise — seven clocks
  --     starting is seven money events, and the row is the record of WHEN each one started.
  FOR r IN
    SELECT m.module_key
      FROM jsonb_to_recordset(p_modules) AS m(module_key text, enabled boolean, start_trial boolean)
     WHERE m.start_trial
  LOOP
    PERFORM * FROM public.start_module_trial(p_business_id, r.module_key, p_actor_user_id);
    v_trials := v_trials + 1;
  END LOOP;

  -- (6) THE RECORD. STD-023 / the #74 ruling: a seed that created nothing is still an operator act
  --     worth keeping, but `outcome` must not assert an event that did not occur. A re-run over a
  --     fully-seeded tenant is `no_change`, which is exactly what a repair-that-found-nothing-wrong
  --     should read as.
  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (p_business_id, p_actor_user_id, NULL, 'business_modules.seeded', 'business', p_business_id::text,
          jsonb_build_object('expected', v_expected, 'seeded', v_seeded,
                             'existing', v_expected - v_seeded, 'trials_started', v_trials),
          CASE WHEN v_seeded = 0 THEN 'no_change' ELSE 'success' END);

  RETURN QUERY SELECT true, NULL::text, v_expected, v_seeded, v_expected - v_seeded, v_trials;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_business_modules(uuid, uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.seed_business_modules(uuid, uuid, jsonb) TO authenticated, service_role;

COMMENT ON FUNCTION public.seed_business_modules(uuid, uuid, jsonb) IS
  'One business_modules row per catalog module at tenant creation — CORE seeded enabled, paid '
  'seeded disabled with the trial clock started (ruling 2026-08-01: rows for everything, so a '
  'module moving to core is a catalog field change and not a migration). The catalog is PASSED IN, '
  'never hardcoded here (AC-1). Idempotent: ON CONFLICT DO NOTHING never clobbers a configured '
  'tenant, so the create path and the repair path are the same call.';

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- V-BLOCK — RUN EVERY ONE AFTER APPLYING. Structure AND behaviour, both directions.
-- Thunder CANNOT run these (no catalog access). They are David's, per the §9 schema-verification
-- gate. Anything that does not match its stated expectation is a STOP, not a note.
--
-- Substitutions: <BIZ> business uuid · <OWNER> owner's auth uid · <MGR> the manager df7723be ·
--                <STAFF> a staff member's uid.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- ── V1 — STRUCTURE. Both functions exist, both are SECURITY DEFINER with an empty search_path.
--   SELECT p.proname, p.prosecdef AS security_definer, p.proconfig
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname='public' AND p.proname IN ('start_module_trial','seed_business_modules')
--    ORDER BY p.proname;
--   EXPECT: 2 rows · security_definer = t on both · proconfig = {search_path=}.
--
-- ── V2 — 🔴 THE KEY IS SPELLED ONCE, PLATFORM-WIDE. This is the ruling, asserted against the
--    CATALOG rather than against the file — a second writer added later by anyone shows up here.
--   SELECT p.proname
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname='public' AND pg_get_functiondef(p.oid) LIKE '%trial_started_at%'
--    ORDER BY p.proname;
--   EXPECT: EXACTLY TWO rows — `start_module_trial` (which writes it) and `seed_business_modules`
--           (which only names it in a COMMENT/audit detail, never as a write target).
--   🔴 A THIRD NAME HERE IS THE DEFECT THIS DESIGN EXISTS TO PREVENT — a second clock writer.
--
-- ── V3 — THE SEED, ON A REAL TENANT, AS THE OWNER. Use the 11 real catalog rows (the client sends
--    exactly this shape; `catalogSeedRows()` builds it).
--   SELECT * FROM public.seed_business_modules('<BIZ>', '<OWNER>', '[
--     {"module_key":"qr_checkout",      "enabled":true, "start_trial":false},
--     {"module_key":"qb_invoicing",     "enabled":true, "start_trial":false},
--     {"module_key":"social_media",     "enabled":false,"start_trial":true},
--     {"module_key":"followup_engine",  "enabled":false,"start_trial":true},
--     {"module_key":"online_shop",      "enabled":false,"start_trial":true},
--     {"module_key":"business_insights","enabled":false,"start_trial":true},
--     {"module_key":"delivery_routing", "enabled":false,"start_trial":true},
--     {"module_key":"seasonal_module",  "enabled":false,"start_trial":true},
--     {"module_key":"contractor_tiers", "enabled":false,"start_trial":true},
--     {"module_key":"cost_to_produce",  "enabled":false,"start_trial":false},
--     {"module_key":"inventory_intake", "enabled":false,"start_trial":false}]'::jsonb);
--   EXPECT: applied = t · expected = 11 · seeded + existing = 11 · trials_started = 7.
--   ⚠️ LAWNS ALREADY HAS ROWS (the 20260604 pivot moved 10 across), so `seeded` will be SMALL and
--   `existing` LARGE on that tenant. **That is the idempotence working, not a failure.** The
--   number that must hold is `seeded + existing = expected`.
--
-- ── V4 — THE ROWS SAY WHAT THEY SHOULD. Core on, paid off with a clock, unpriced off with none.
--   SELECT module_key, enabled, configured, config->>'trial_started_at' AS trial_started
--     FROM public.business_modules WHERE business_id='<BIZ>' ORDER BY module_key;
--   EXPECT: qr_checkout + qb_invoicing → enabled = t · the seven add-ons → enabled = f AND a
--           NON-NULL trial_started · cost_to_produce + inventory_intake → enabled = f AND
--           trial_started IS NULL (a trial is a countdown to a price decision, and they have no
--           price — D-9).
--   ⚠️ Pre-existing LAWNS rows keep whatever `enabled` they already had. ON CONFLICT DO NOTHING
--   means this migration does not re-decide a configured tenant, which is the point.
--
-- ── V5 — 🔴 IDEMPOTENCE AND THE NON-RESTARTING CLOCK. Run V3 AGAIN, verbatim.
--   EXPECT: applied = t · seeded = 0 · existing = 11 · trials_started = 7 (it CALLS the clock seven
--           times) — and then re-run V4: **every `trial_started` is the SAME TIMESTAMP as before.**
--   🔴 A CHANGED TIMESTAMP HERE MEANS TRIALS RENEW THEMSELVES ON EVERY ONBOARDING LOAD, which
--   would make the self-heal a permanent free subscription. This is the single most important
--   assertion in the block.
--   Also: `SELECT action, outcome FROM public.audit_log WHERE business_id='<BIZ>'
--          AND action IN ('business_modules.seeded','module_trial.started')
--          ORDER BY created_at DESC LIMIT 9;`
--   EXPECT on the SECOND run: `business_modules.seeded` outcome = **no_change**, and all seven
--          `module_trial.started` rows outcome = **no_change** with `restart_refused: true`.
--
-- ── V6 — THE DETECTION QUERY. This is the standing answer to "did a seed silently fail?" and it is
--    the thing to run before the demo. Keep it; it is referenced from the ledger.
--   SELECT b.name, COUNT(bm.module_key) AS module_rows,
--          COUNT(bm.module_key) FILTER (WHERE bm.config ? 'trial_started_at') AS with_clock
--     FROM public.businesses b
--     LEFT JOIN public.business_modules bm ON bm.business_id = b.id
--    GROUP BY b.id, b.name ORDER BY b.name;
--   EXPECT: module_rows = 11 for every business seeded since this shipped. **A business with 0 rows
--   is a tenant with NO TRIAL AND NO BILL, and it is indistinguishable from a normal tenant in the
--   UI** — that is the whole reason this query exists. Fewer than 11 with a non-zero count is a
--   SHORT SEED; re-run V3 for that business (it is safe).
--
-- ── V7 — 🔴 THE NEGATIVE, AND IT IS THE ONE THAT MAKES THE GATE REAL. A STAFF member is refused BY
--    THE FUNCTION, with a reason that names the money.
--   SELECT * FROM public.seed_business_modules('<BIZ>', '<STAFF>', '[{"module_key":"social_media","enabled":false,"start_trial":true}]'::jsonb);
--   EXPECT: applied = f · reason mentions `subscription:update` AND the words "trial clocks" · and
--           an audit_log row action='business_modules.seed_denied' outcome='denied'.
--   SELECT * FROM public.start_module_trial('<BIZ>', 'social_media', '<STAFF>');
--   EXPECT: applied = f · reason mentions `subscription:update` · audit action='module_trial.start_denied'.
--
-- ── V8 — 🔴 THE MANAGER SPLIT, THE SAME SHAPE V3d PROVED FOR ENABLEMENT. A manager holds
--    `settings:update` and NOT `subscription:update`.
--   SELECT * FROM public.start_module_trial('<BIZ>', 'social_media', '<MGR>');
--   EXPECT: applied = f. **A manager cannot start a trial** — that is the ruling, and if this reads
--   `t` the clock is writable by a larger set than the enablement it governs.
--   Then, for contrast, in the SAME session:
--   SELECT * FROM public.set_business_module_state('<BIZ>','social_media',NULL,NULL,'{"cadence":"weekly"}'::jsonb,'<MGR>');
--   EXPECT: applied = t. Configure yes, subscribe no — one manager, one session, both answers.
--
-- ── V9 — MALFORMED PAYLOAD REFUSES THE WHOLE BATCH, not the bad half.
--   SELECT * FROM public.seed_business_modules('<BIZ>', '<OWNER>', '[
--     {"module_key":"zz_probe_ok","enabled":false,"start_trial":false},
--     {"module_key":"","enabled":false,"start_trial":false}]'::jsonb);
--   EXPECT: applied = f · reason mentions "non-blank module_key" · **and `zz_probe_ok` was NOT
--           created** — check: SELECT COUNT(*) FROM public.business_modules WHERE module_key='zz_probe_ok';
--   EXPECT: 0. A partial seed is worse than none; it looks complete to every count-based check.
--   Also the empty case: SELECT * FROM public.seed_business_modules('<BIZ>','<OWNER>','[]'::jsonb);
--   EXPECT: applied = f · reason = 'module catalog is empty — nothing to seed'.
--
-- ── V10 — CLEANUP. Nothing above should have created a probe row, but prove it.
--   DELETE FROM public.business_modules WHERE module_key IN ('zz_probe','zz_probe_ok');
--   EXPECT: DELETE 0.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT CHANGES IN THE APP, STATED BEFORE IT SHIPS
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- · `packages/shared/src/business-logic/seedBusinessModules.ts` — NEW, the only caller of
--   `seed_business_modules`. Sibling of `seedPricingConfig`.
-- · `OwnerSignup.tsx` — calls it AFTER the owner's `business_members` row is inserted. **That order
--   is load-bearing**: authority lives entirely in `business_members` since 20260730c removed the
--   owner branch, so a seed attempted before the member row exists is DENIED for the owner of the
--   business he just created.
-- · `OnboardingWizard.finalize()` — calls it OUTSIDE the legacy-create branch, so it also repairs
--   the modern path. Deliberately different from `seedPricingConfig`'s placement; see that call site.
-- · `moduleState.ts` — its PRE-MIGRATION BRIDGE is DELETED in this same commit. Its own header said
--   it dies in the commit that confirms both migrations are applied; they are.
