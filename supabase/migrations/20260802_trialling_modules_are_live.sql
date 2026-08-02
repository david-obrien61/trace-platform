-- Migration: A RUNNING TRIAL MEANS THE MODULE IS LIVE — correcting the rows 20260801c seeded
-- Target project: bgobkjcopcxusjsetfob (cultivar-os)
-- Date: 2026-08-02 · Ledger #182 · David's ruling, correcting the 2026-08-01 seed spec
--
-- ⛔ GATED — DAVID APPLIES. Thunder has no catalog access and cannot run the V-block.
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- WHAT IS WRONG, AND WHY A CODE FIX ALONE DOES NOT REACH IT
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- `20260801c` seeded 11 rows per tenant on 2026-08-01. Its payload came from `moduleSeedRow()`,
-- which mapped `enabled = (billing === 'core')` — so all seven paid add-ons landed **DISABLED with
-- a thirty-day clock running over them.**
--
-- 🔴 `enabled:false` IS A FUNCTIONAL GATE, NOT A LABEL. `api/social/generate-posts.ts:52` refuses
-- outright on `!enabled || !configured`. So social_media has been counting down toward a $19/mo
-- conversion decision **while the server refuses to generate a single post** — the owner reaches
-- day thirty with no basis whatsoever on which to convert. That is not a trial with a display bug;
-- it is a countdown attached to nothing.
--
-- **DAVID'S MODEL: the site goes live, EVERYTHING WORKS, and at the end of the term the unpaid
-- modules go behind the fuzz. The clock is what ENDS access — it is never what withholds it.**
--
-- `moduleSeedRow()` is corrected in the same commit as this file, which fixes every FUTURE tenant.
-- It does nothing for LAWNS, and the reason is `20260801c`'s own `ON CONFLICT DO NOTHING` (:428):
-- re-running the seeder deliberately never clobbers an existing row. That property is correct and
-- is not being changed — it is what makes the seeder safe to re-run as the repair path. It simply
-- means **the rows already on disk need a migration, and this is it.**
--
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- 🔴 SCOPE — THREE CONDITIONS, AND THE THIRD IS THE ONE THAT MATTERS
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--   1. `config->>'trial_started_at' IS NOT NULL`  — a clock is running on this row.
--   2. `enabled = false`                          — and the module is dark, which is the defect.
--   3. **THE TERM HAS NOT LAPSED** — `now() < trial_started_at + trial_days`.
--
-- Condition 3 is a NO-OP TODAY and is written anyway. Every clock in the database started on
-- 2026-08-02 with a 30-day term, so nothing is lapsed and the clause filters nothing. It is here
-- because **a repair must not be able to grant access a term no longer covers.** If this file is
-- applied late, or re-run in six weeks, or copied for the next tenant's repair, the version without
-- condition 3 silently resurrects expired trials — turning a correction into a giveaway. Cheap to
-- write today, impossible to add after it has already run.
--
-- ⚠️ WHAT THIS DOES **NOT** TOUCH, deliberately:
--   · Rows with NO clock — `qr_checkout` / `qb_invoicing` (core, already correct) and
--     `cost_to_produce` / `inventory_intake` (**`unpriced` — RULING OWED, David's**). The two
--     unpriced modules are BUILT AND WORKING and stay dark, so they render `[ENABLE]` on a purchase
--     nobody can make. That is a known open cost, named in `MODULE_CATALOG` and in the ledger. It
--     is NOT fixed here because the fix is a pricing decision, not a data repair, and guessing it
--     in a migration is exactly how an unratified number ends up governing live tenants.
--   · Rows an owner deliberately disabled. There are none and there CANNOT be: no surface has ever
--     been able to turn a module off (the marketplace is ITEM 3, unbuilt), and the only writers
--     that exist — `api/social/enable.ts` and `financialDataAccess` — set `true`. Stated rather
--     than assumed, because after the marketplace ships this reasoning expires and a future repair
--     would need to tell a deliberate OFF from a seed artifact.
--
-- ⚠️ THIS WRITES `business_modules` DIRECTLY, NOT THROUGH `set_business_module_state`. The RPC
-- resolves authority through `auth.uid()`, which is NULL under a migration, and the one-writer rule
-- (STD-011) has always had the migration path as its other legitimate door — `20260801c` seeds by
-- direct INSERT for the same reason. The audit row below is written by hand precisely BECAUSE the
-- RPC is not here to write it: a module turning on with no audit row while every other module
-- change has one is a hole in the record, not a saving.

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ⚠️ PRE-APPLY — ONE QUERY. Read every row before running anything.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- SELECT b.name,
--        bm.module_key,
--        bm.enabled,
--        bm.configured,
--        (bm.config->>'trial_started_at')::timestamptz            AS trial_started,
--        (bm.config->>'trial_days')::int                          AS term_days,
--        (bm.config->>'trial_started_at')::timestamptz
--          + ((bm.config->>'trial_days')::int || ' days')::interval AS expires,
--        CASE
--          WHEN bm.config->>'trial_started_at' IS NULL           THEN 'no clock — untouched'
--          WHEN bm.enabled                                       THEN 'already live — untouched'
--          WHEN now() >= (bm.config->>'trial_started_at')::timestamptz
--                        + ((bm.config->>'trial_days')::int || ' days')::interval
--                                                                THEN 'LAPSED — untouched (cond 3)'
--          ELSE '🔴 WILL BE CORRECTED → enabled+configured = true'
--        END AS disposition
--   FROM public.business_modules bm
--   JOIN public.businesses b ON b.id = bm.business_id
--  ORDER BY b.name, bm.module_key;
--
-- EXPECT on LAWNS: 7 rows read '🔴 WILL BE CORRECTED' (social_media, followup_engine, online_shop,
-- business_insights, delivery_routing, seasonal_module, contractor_tiers) · qr_checkout +
-- qb_invoicing read 'already live' · cost_to_produce + inventory_intake read 'no clock'. 11 total.
-- ⚠️ If ANY row reads 'LAPSED', STOP and surface it — it means this file is being applied late and
-- the tenant's term needs a decision, not a repair.

BEGIN;

-- ── THE CORRECTION ──────────────────────────────────────────────────────────────────────────────
-- `configured` moves WITH `enabled`, and that is not a rider — it is what makes the ruling reach a
-- screen. `useModules` renders a tile `active` only on `enabled && configured`, so correcting
-- `enabled` alone would fix the data and leave the dashboard showing `[ENABLE]` on all seven: the
-- customer-visible symptom would survive its own fix. The precedent for `configured:true` on a
-- not-yet-personalised module is already ruled and already live — `qb_invoicing` seeds configured
-- with no QuickBooks link, because a green tile says *included*, not *connected*.
WITH corrected AS (
  UPDATE public.business_modules
     SET enabled    = true,
         configured = true
   WHERE config->>'trial_started_at' IS NOT NULL
     AND enabled IS NOT TRUE
     AND now() < (config->>'trial_started_at')::timestamptz
                 + (COALESCE((config->>'trial_days')::int, 0) || ' days')::interval
  RETURNING business_id, module_key
)
-- ── THE RECORD ──────────────────────────────────────────────────────────────────────────────────
-- One audit row per BUSINESS (not per module) — this was a single operator act correcting a single
-- bad seed spec, and seven rows saying the same thing at the same timestamp is volume, not record.
-- The module list travels in `detail` so the act is still reconstructable module-by-module.
INSERT INTO public.audit_log
  (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
-- 🔴 `NULL::uuid`, NOT A BARE `NULL` — BECAUSE OF THE `GROUP BY` AT THE FOOT OF THIS STATEMENT.
-- ✏️ FIXED 2026-08-02 (4), BEFORE THIS FILE WAS EVER APPLIED. Its sibling in `20260802b` failed to
-- compile with `42804: column "actor_user_id" is of type uuid but expression is of type text`, and
-- this block is the same shape, so it would have failed identically on the next line David ran.
-- In an ordinary `INSERT … SELECT` an untyped `NULL` stays `unknown` and is coerced to the TARGET
-- COLUMN's type — which is why `20260720_inventory_movement_ledger.sql:374` writes a bare `NULL`
-- into this very column and applied fine. **`GROUP BY` (like `DISTINCT`) forces every output
-- column's type to resolve BEFORE the insert targets are applied**, and an unresolved `unknown`
-- resolves to `text`; `text → uuid` has no implicit cast.
-- ⚠️ A parse error is not row-dependent: this fails at ANALYZE time even when `corrected` is empty
-- and the statement would have inserted nothing.
SELECT c.business_id,
       NULL::uuid,
       'system',
       'business_modules.trial_access_corrected',
       'business',
       c.business_id::text,
       jsonb_build_object(
         'migration',  '20260802_trialling_modules_are_live',
         'ruling',     'a running trial means the module is LIVE — the clock ends access, it does not withhold it',
         'supersedes', '20260801c seed spec: enabled = (billing = core)',
         'modules',    jsonb_agg(c.module_key ORDER BY c.module_key),
         'count',      count(*)
       ),
       'success'
  FROM corrected c
 GROUP BY c.business_id;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════════════════════════
-- ✅ POST-APPLY VERIFICATION (V-BLOCK) — run every query; paste the output back.
--    §9 SCHEMA VERIFICATION GATE: catalog-backed, never the builder's memory.
-- ════════════════════════════════════════════════════════════════════════════════════════════════
--
-- V1 · THE INVARIANT, STATED AS A QUESTION THE DATABASE ANSWERS. This is the assertion `moduleSeed
--      .test.ts` B3 now makes about the payload, asked of the ROWS: a clock over a dark module.
--      EXPECT: **0 rows.** Any row here is a module counting down toward a bill nobody can evaluate.
--   SELECT b.name, bm.module_key, bm.enabled, bm.configured, bm.config->>'trial_started_at' AS started
--     FROM public.business_modules bm JOIN public.businesses b ON b.id = bm.business_id
--    WHERE bm.config->>'trial_started_at' IS NOT NULL
--      AND bm.enabled IS NOT TRUE
--      AND now() < (bm.config->>'trial_started_at')::timestamptz
--                  + (COALESCE((bm.config->>'trial_days')::int,0) || ' days')::interval;
--
-- V2 · THE WHOLE TENANT, READ AS THE DASHBOARD WILL RENDER IT. This is the row-level equivalent of
--      looking at the grid, and it is what makes the owner-test card checkable against data.
--      EXPECT on LAWNS — 9 live (2 core + 7 trialling), 2 dark (both `unpriced`), 11 total.
--   SELECT bm.module_key, bm.enabled, bm.configured,
--          (bm.config->>'trial_days')::int AS term,
--          CASE WHEN bm.config->>'trial_started_at' IS NULL THEN '— no clock'
--               ELSE ceil(extract(epoch FROM (
--                      (bm.config->>'trial_started_at')::timestamptz
--                      + ((bm.config->>'trial_days')::int || ' days')::interval - now()
--                    )) / 86400)::text || 'd left' END AS clock,
--          CASE WHEN bm.enabled AND bm.configured THEN 'renders ACTIVE'
--               ELSE 'renders [ENABLE]' END AS tile
--     FROM public.business_modules bm JOIN public.businesses b ON b.id = bm.business_id
--    WHERE b.name ILIKE '%LAWNS%' ORDER BY bm.module_key;
--
-- ⚠️ V2 IS ALSO WHERE THE OWED RULING SHOWS ITS COST: `cost_to_produce` and `inventory_intake` will
--    read 'renders [ENABLE]' with '— no clock'. Both modules are BUILT AND WORK. That is the
--    `unpriced` question, unanswered on purpose, visible in the output rather than buried.
--
-- V3 · THE TERM WAS NOT TOUCHED. This migration changes ACCESS, never TERMS — the snapshot ruling
--      (2026-08-01) says a tenant's terms are what they were given, and a repair that quietly
--      re-terms a tenant is the precise thing that ruling exists to forbid.
--      EXPECT: every trialling row still reads term = 30, started = its ORIGINAL 2026-08-02 stamp.
--   SELECT module_key, (config->>'trial_days')::int AS term, config->>'trial_started_at' AS started
--     FROM public.business_modules
--    WHERE config->>'trial_started_at' IS NOT NULL ORDER BY module_key;
--
-- V4 · THE AUDIT ROW EXISTS AND NAMES THE MODULES. EXPECT: 1 row per corrected business, detail
--      carrying 7 module keys and count 7.
--   SELECT business_id, action, outcome, detail->'count' AS n, detail->'modules' AS modules
--     FROM public.audit_log
--    WHERE action = 'business_modules.trial_access_corrected' ORDER BY created_at DESC;
--
-- V5 · NEGATIVE CONTROL — THE CORE ROWS WERE NOT COLLATERAL. They were already live and carry no
--      clock, so the UPDATE's first condition should have excluded them entirely.
--      EXPECT: qr_checkout + qb_invoicing → enabled = t, configured = t, trial_started_at NULL.
--   SELECT module_key, enabled, configured, config->>'trial_started_at' AS started
--     FROM public.business_modules
--    WHERE module_key IN ('qr_checkout','qb_invoicing') ORDER BY module_key;
--
-- V6 · RE-RUN SAFETY. Running the UPDATE block a second time must correct 0 rows (every trialling
--      row is now enabled, so condition 2 excludes them) and therefore write NO second audit row.
--      EXPECT: 0 rows updated, audit_log count for this action UNCHANGED from V4.
