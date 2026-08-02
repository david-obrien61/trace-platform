-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 20260802b — THE CLASSIFICATION RULINGS REACH THE ROWS ALREADY ON DISK, AND FIVE CLOCKS STOP
-- David's rulings, 2026-08-02: inventory_intake → CORE · cost_to_produce → $29 add_on, trialled ·
-- contractor_tiers → core_optional ($0, no trial, OFF until switched on) · AND a trial starts only
-- when the thing being trialled can be USED, so the four `planned` add-ons lose their clocks too.
--
-- ✏️ AMENDED 2026-08-02 (3), BEFORE BEING APPLIED, and the §6 r1 judgement is stated rather than
-- assumed: r1 forbids editing an existing migration because an APPLIED file and its database would
-- then disagree. **This file has never been run** (it is GATED and David has not reported a V-block),
-- and David ruled ONE corrective migration for all five clocks. Extending it is therefore the
-- literal instruction and carries none of the risk r1 exists to prevent. ⚠️ **AND IT IS SAFE EVEN IF
-- THAT JUDGEMENT IS WRONG:** every statement is idempotent and absolute, so applying this version
-- over an already-applied earlier one converges (it would clear the four additionally and re-clear
-- contractor_tiers as a no-op). The only re-run cost is a duplicate audit row, which V5 already names.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- 🔴 WHY A MIGRATION AT ALL, restated because it is the same reason as yesterday and the day before:
-- `seed_business_modules` is `ON CONFLICT DO NOTHING` — deliberately, because that is what makes the
-- seeder safe as the repair path. The consequence is that a CATALOG EDIT REACHES EVERY FUTURE TENANT
-- AND CANNOT TOUCH A ROW THAT ALREADY EXISTS. The code change and this file are one deliverable;
-- shipping only the first would leave the catalog and the live rows disagreeing with nothing to
-- point at.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 THIS FILE IS ORDER-INDEPENDENT WITH RESPECT TO `20260802`, BY CONSTRUCTION AND ON PURPOSE.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- `20260802_trialling_modules_are_live.sql` may be applied BEFORE or AFTER this file, or between
-- any two statements in it, and the end state is identical. That is not a nicety — it is the fix for
-- the hazard that bit on the `20260801` / `20260801b` pair, where a correct result depended on a
-- human remembering an order. The mechanism:
--
--   · 20260802 keys its UPDATE on `config->>'trial_started_at' IS NOT NULL`. This file STRIPS that
--     key from all five, so 20260802 stops matching them — applied after, it skips those rows.
--   · This file keys ITS updates on `module_key`, never on the presence or absence of a clock, so
--     20260802 having already run changes nothing about what it does.
--   · Every write is an ABSOLUTE SET (`= true` / `= false`), never a toggle. Re-running converges.
--
-- ⚠️ BOTH FILES ARE STILL REQUIRED, and the division is now sharper: after both, **exactly TWO
-- modules are on running clocks — `social_media` ($19) and `delivery_routing` ($29)** — because they
-- are the only priced add-ons whose tiles are LIVE. `cost_to_produce` joins them as the third, via
-- (1) below. 20260802 is what makes those trials real; this file is what stops the five that are not.
--
-- ── PRE-APPLY (run first, paste the output back) ────────────────────────────────────────────────
--   SELECT b.name, bm.module_key, bm.enabled, bm.configured,
--          bm.config->>'trial_started_at' AS started, bm.config->>'trial_days' AS term
--     FROM public.business_modules bm JOIN public.businesses b ON b.id = bm.business_id
--    WHERE bm.module_key IN ('contractor_tiers','inventory_intake','cost_to_produce',
--                            'followup_engine','business_insights','online_shop','seasonal_module')
--    ORDER BY b.name, bm.module_key;
--
--   EXPECT, before this file: contractor_tiers AND the four planned add-ons carry clocks (enabled
--   depends on whether 20260802 has run) · inventory_intake and cost_to_produce are dark with NO clock.
--   ⚠️ If contractor_tiers' clock is ALREADY LAPSED, say so rather than applying — a lapsed clock on
--   a module that is being ruled free is harmless, but it means this file is landing later than
--   anyone thought and the other six add-ons deserve a fresh look first.

BEGIN;

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- (1) cost_to_produce — START ITS CLOCK. Through the RPC, never by writing the key here.
-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- 🔴 `start_module_trial` IS THE ONLY WRITER OF `trial_started_at` AND `trial_days`, PLATFORM-WIDE
-- (ruling 2026-08-01, and 20260801c V2 asserts the spelling is unique against `pg_proc`). A hand-
-- written `jsonb_set` here would be a second writer of the pair — the exact thing that ruling exists
-- to prevent — and it would also skip the audit row, the term validation, and the refuse-to-restart
-- guard. The RPC gives all four for free.
--
-- It requires an ACTOR HOLDING `subscription:update`, which is correct and is not a formality: this
-- starts a billing clock on a live tenant. The actor is resolved per business from the member rows.
-- ⚠️ NO ELIGIBLE ACTOR RAISES — it does not skip. A tenant silently left without the trial is the
-- missing-row defect this whole sequence exists to close, and a NOTICE in a migration log is not a
-- surfaced error (#158's class).
DO $$
DECLARE
  v_business  uuid;
  v_actor     uuid;
  v_applied   boolean;
  v_reason    text;
  v_already   boolean;
BEGIN
  FOR v_business IN
    SELECT DISTINCT business_id FROM public.business_modules
  LOOP
    -- ⚠️ THE COLUMN IS `active`, NOT `is_active` (20260602:37) — and the membership test is the ONLY
    -- test there is. `has_permission_for` LOST its owner branch in 20260730c §1, so `businesses.
    -- owner_id` grants nothing: an owner without a `business_members` row holding the string cannot
    -- start a trial on their own business. That is the ruled model, and it is exactly why the RAISE
    -- below names 20260730b (the owner-member-row invariant) as one of the two things to check.
    SELECT m.user_id INTO v_actor
      FROM public.business_members m
     WHERE m.business_id = v_business
       AND m.active
       AND m.user_id IS NOT NULL
       AND m.permissions ? 'subscription:update'
     ORDER BY m.created_at
     LIMIT 1;

    IF v_actor IS NULL THEN
      RAISE EXCEPTION
        'business % has NO active member holding subscription:update — cannot start the cost_to_produce trial. '
        'This is 20260801b not being applied, or an owner with no business_members row (20260730b). '
        'Fix that first; do NOT work around it by writing the trial key directly.', v_business;
    END IF;

    SELECT t.applied, t.reason, t.was_already_running
      INTO v_applied, v_reason, v_already
      FROM public.start_module_trial(v_business, 'cost_to_produce', 30, v_actor) t;

    IF NOT v_applied THEN
      RAISE EXCEPTION 'start_module_trial refused for business %: %', v_business, v_reason;
    END IF;

    RAISE NOTICE 'cost_to_produce trial for business %: already_running=%', v_business, v_already;
  END LOOP;
END $$;

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- (2) cost_to_produce + inventory_intake — MAKE THEM LIVE.
-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- `configured` moves WITH `enabled` and that is not a rider (ruling 2026-08-01): `useModules`
-- renders `active` only on both, so correcting `enabled` alone fixes the data and leaves `[ENABLE]`
-- on the screen — the customer-visible symptom surviving its own fix.
--
-- inventory_intake is CORE: on because it is included, with no clock and nothing to expire.
-- cost_to_produce is a TRIALLING add-on: on because a clock is now running over it, and the lapse
-- guard is kept even though (1) just started the clock — a guard that is true by construction today
-- is still the guard that holds if this file is ever re-run months from now.
UPDATE public.business_modules
   SET enabled = true, configured = true
 WHERE module_key = 'inventory_intake';

UPDATE public.business_modules
   SET enabled = true, configured = true
 WHERE module_key = 'cost_to_produce'
   AND config->>'trial_started_at' IS NOT NULL
   AND now() < (config->>'trial_started_at')::timestamptz
               + (COALESCE((config->>'trial_days')::int, 0) || ' days')::interval;

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- (3) FIVE MODULES COME OFF THE CLOCK, AND GO DARK.
-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- 🔴 THE PLATFORM CAN START A CLOCK AND HAS NO WAY TO STOP ONE. `start_module_trial` starts and
-- refuses to restart; nothing anywhere clears the pair. That is why this is a migration and not a
-- call — and it is worth naming, because the marketplace will need the same verb the first time an
-- owner declines a module mid-trial.
--
-- The keys are REMOVED, not zeroed. `trialDaysRemaining` returns null for a missing pair and 0 for a
-- lapsed one, and those are different answers by design (D-9): these modules are not on a clock at
-- all, which is `null`. Writing `trial_days: 0` would have said "expired" — a different and false
-- claim, and for the four below it would claim a trial had run its course when none ever started.
--
-- ══ WHY THESE FIVE, in two groups with two different reasons ═══════════════════════════════════
--   · `contractor_tiers`  — RECLASSIFIED `core_optional` ($0). Free, so nothing to convert to and
--                            nothing to expire. *"A working capability that expires in a month is
--                            exactly what the fuzz would take away wrongly."*
--   · the other FOUR      — PRICED, but their tiles are `status:'planned'`. **A trial is a countdown
--                            to a price decision, and there is nothing to decide about a module
--                            nobody can use** (David's ruling 2026-08-02 (3)). At day thirty each
--                            would ask the owner to pay for something he has never seen.
--
-- ⚠️ THIS LIST IS HAND-WRITTEN AND THE CODE-SIDE RULE IS NOT — SQL cannot read `TILE_REGISTRY`.
-- `moduleSeedRow` derives the same rule from `tile.status`, so **no FUTURE tenant can acquire one of
-- these clocks**; this statement exists only to clean the rows that already have them. The two
-- cannot drift in a way that matters, because the seeder is the only thing that creates clocks and
-- it now refuses. **What IS owed is the other direction — something must START the clock when a tile
-- goes live — and that is a named gap, not an implication.** See `RULINGS.md` OWED.
UPDATE public.business_modules
   SET config     = (COALESCE(config, '{}'::jsonb) - 'trial_started_at') - 'trial_days',
       enabled    = false,
       configured = false
 WHERE module_key IN (
   'contractor_tiers',    -- core_optional: free, nothing to expire
   'followup_engine',     -- planned tile: $19/mo counting down against nothing
   'business_insights',   -- planned tile: $19/mo counting down against nothing
   'online_shop',         -- planned tile: $19/mo counting down against nothing
   'seasonal_module'      -- planned tile: $29/mo counting down against nothing
 );

-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- (4) THE RECORD — one row per business, per the 20260802 precedent.
-- ────────────────────────────────────────────────────────────────────────────────────────────────
-- A reclassification is an operator act on the money model and it must be reconstructable. The trial
-- START already wrote its own `module_trial.started` row inside the RPC; this records the
-- CLASSIFICATION decision, which is the thing that has no other home.
INSERT INTO public.audit_log
  (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
SELECT DISTINCT bm.business_id,
       NULL,
       'system',
       'business_modules.classification_corrected',
       'business',
       bm.business_id::text,
       jsonb_build_object(
         'migration', '20260802b_module_classification_corrections',
         'rulings',   jsonb_build_object(
           'inventory_intake', 'unpriced -> core: how stock gets captured, nothing to buy',
           'cost_to_produce',  'unpriced -> add_on $29/mo trialled (placeholder price, to be set from what it reports)',
           'contractor_tiers', 'add_on $49 -> core_optional $0: core-with-a-switch, no clock, nothing to expire'
         ),
         'clock_cleared', 'contractor_tiers'
       ),
       'success'
  FROM public.business_modules bm;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ✅ POST-APPLY VERIFICATION (V-BLOCK) — run every query; paste the output back.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- V1 · THE THREE RULED MODULES ARE IN THEIR RULED STATE.
--   SELECT b.name, bm.module_key, bm.enabled, bm.configured,
--          bm.config->>'trial_started_at' AS started, bm.config->>'trial_days' AS term
--     FROM public.business_modules bm JOIN public.businesses b ON b.id = bm.business_id
--    WHERE bm.module_key IN ('contractor_tiers','inventory_intake','cost_to_produce',
--                            'followup_engine','business_insights','online_shop','seasonal_module')
--    ORDER BY b.name, bm.module_key;
--
--   EXPECT per business, exactly:
--     contractor_tiers   · enabled f · configured f · started NULL · term NULL  ← free, nothing to expire
--     followup_engine    · enabled f · configured f · started NULL · term NULL  ← planned tile, no clock
--     business_insights  · enabled f · configured f · started NULL · term NULL  ← planned tile, no clock
--     online_shop        · enabled f · configured f · started NULL · term NULL  ← planned tile, no clock
--     seasonal_module    · enabled f · configured f · started NULL · term NULL  ← planned tile, no clock
--     cost_to_produce    · enabled t · configured t · started TODAY · term 30   ← trialling, live
--     inventory_intake   · enabled t · configured t · started NULL · term NULL  ← core, live, no clock
--
--   🔴 FIVE NULL `started` VALUES ARE THE WHOLE POINT OF THIS FILE. A timestamp surviving on any of
--   them means the strip did not run and something free — or something nobody can even open — is
--   still counting down to a bill.
--
-- V2 · NO CLOCK ANYWHERE OVER A MODULE THAT IS NOT LIVE — the 2026-08-02 invariant, in the data.
--   SELECT b.name, bm.module_key, bm.enabled, bm.config->>'trial_started_at' AS started
--     FROM public.business_modules bm JOIN public.businesses b ON b.id = bm.business_id
--    WHERE bm.config->>'trial_started_at' IS NOT NULL AND bm.enabled IS NOT TRUE
--    ORDER BY b.name, bm.module_key;
--
--   EXPECT: ZERO ROWS **if 20260802 has been applied.** If it has NOT, expect exactly TWO —
--   `social_media` and `delivery_routing`, the only priced add-ons with LIVE tiles. **None of the
--   five this file clears may appear, whichever way round the two migrations were run.** That is
--   the order-independence claim, checked rather than asserted.
--
-- V3 · THE TRIAL WENT THROUGH THE RPC, so it has the RPC's audit row and not just a config blob.
--   SELECT business_id, action, detail->>'trial_days' AS term, detail->>'row_created' AS created, created_at
--     FROM public.audit_log
--    WHERE action = 'module_trial.started' AND target_id = 'cost_to_produce'
--    ORDER BY created_at DESC;
--
--   EXPECT: one row per business, term 30. ⚠️ ZERO ROWS means the clock was written some other way,
--   which would mean a second writer of the pair exists — stop and find it.
--
-- V4 · THE CLASSIFICATION RECORD.
--   SELECT business_id, detail->'rulings' AS rulings, detail->>'clock_cleared' AS cleared, created_at
--     FROM public.audit_log
--    WHERE action = 'business_modules.classification_corrected' ORDER BY created_at DESC;
--
--   EXPECT: one row per business.
--
-- V5 · RE-RUN SAFETY. Running this whole file a second time must change no module state.
--   Re-apply, then re-run V1 — every value identical, and V3 gains NO new `module_trial.started`
--   row (the RPC refuses to restart a running clock, and `was_already_running` comes back true).
--   ⚠️ V4 DOES gain a second row on a re-run, and that is deliberate: each run is a distinct
--   operator act. The MODULE STATE is what must be idempotent, not the record of who touched it.
--
-- V6 · THE COUNT IS UNCHANGED — this file creates no rows and destroys none.
--   SELECT business_id, count(*) AS module_rows FROM public.business_modules GROUP BY business_id;
--
--   EXPECT: 11 per seeded business, the same number as before. ⚠️ 12 would mean (1)'s
--   create-if-absent minted a cost_to_produce row for a tenant that was short one — which is a
--   REAL FINDING, not a defect of this file: it means that tenant's seed was incomplete and V6 of
--   20260801c should be run against every business.
