-- ══════════════════════════════════════════════════════════════════════════════════
-- LAWNS — STEP 0 FOR THE GROW LADDER.  Ledger #390.  David pastes this. SQL editor, as postgres.
-- Run it AFTER `supabase/migrations/20260923h_container_ladder_grow_and_hold.sql`.
-- ══════════════════════════════════════════════════════════════════════════════════
--
-- 🔴 READ THIS FIRST — THE BRIEF SAID "THE PLANNER NEEDS 18 KEYS AND LAWNS HOLDS 3, POPULATE IT."
-- THAT PREMISE IS FALSE AND I CHECKED IT BEFORE WRITING ANY SQL, so this file is four lines
-- rather than twenty-four.
--
-- `resolveConfig` (packages/shared/src/production/productionConfig.ts:379) begins
--     const ops: OperationsConfig = { ...OPERATIONS_DEFAULTS };
-- and only then overlays whatever the tenant has stored. So LAWNS's 3-key row ALREADY resolves to
-- a complete, usable config — the planner can run there today, and 0 plans exist because nobody
-- has used the screen, not because it is blocked.
--
-- AND THE DEFAULTS ARE NOT SOMEBODY ELSE'S NUMBERS: they were taken FROM David's own workbook in
-- ledger #276. Compared key by key against `uppot-mix-model.xlsx` → Inputs, every one of
-- tradeGallonFactor (0.7) · handlingMinutesPerPot (3) · productiveHoursPerDay (6) ·
-- cushionPctDefault (0.1) · peopleMakingMix (1) · mixerCubicYardsPerHour (4) · survivalRate (1)
-- ALREADY EQUALS the workbook's figure. Writing them into LAWNS's row would change nothing and
-- would convert a platform default into what LOOKS like a measured tenant value — which is the
-- [[R-26]] defect this platform keeps paying for. So they are deliberately NOT written.
--
-- ⚠️ WHAT IS GENUINELY MISSING IS THE UPPOT WINDOW, AND IT IS THE REAL BLOCKER FOR DATES.
-- `UppotPlan.tsx:137` passes `startDate: cfg.ops.windowStart` into `planLots`, and `planLots`
-- leaves `completesOn` NULL when that is null — so with no window EVERY batch is undated and the
-- new "Sellable from" column reads "no uppot window set" on every row. The screen says exactly
-- that rather than a bare dash, but the fix is here.

-- ── ① THE UPPOT WINDOW — 🔴 DAVID CHOOSES THESE TWO DATES. The values below are the ones from
--    his own workbook (Inputs C16/C17, "Your window. Nov 4 … Nov 12"), carried forward to 2026.
--    Change them if the window has moved; they are a decision, not a measurement.
UPDATE public.business_operations_config
   SET config = config || jsonb_build_object(
         'windowStart', '2026-11-04',
         'windowEnd',   '2026-11-12'
       )
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- ── ② GROW ON THE 15 GAL RUNG = 6 MONTHS. David, 2026-09-18: "a 15 gal is SELLABLE AT THE
--    UPPOT-TO-15 DATE + 6 MONTHS." It is the ONLY rung anybody has stated a figure for.
--    🔴 THE OTHER EIGHT RUNGS ARE DELIBERATELY LEFT NULL. They are unknown, David is asking Terry
--    for them, and the plan prints "UNKNOWN — nobody has set GROW on the 30 gal rung" rather than
--    borrowing a number. Do NOT fill them in to make the screen look finished.
UPDATE public.container_ladder
   SET grow_months  = 6,
       grow_because = 'David, 2026-09-18 — a 15 gal is sellable at the uppot-to-15 date plus six months. Terry to confirm or correct.'
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND label = '15 gal';

-- ══════════════════════════════════════════════════════════════════════════════════
-- VERIFY — run these after, and read the verdicts.
-- ══════════════════════════════════════════════════════════════════════════════════
--
-- (S1) The window is set. Expect one row, both dates non-null.
--   SELECT config->>'windowStart' AS starts, config->>'windowEnd' AS ends
--   FROM public.business_operations_config
--   WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- (S2) 🔴 THE THREE KEYS LAWNS ALREADY HELD ARE STILL THERE. `||` merges, it does not replace —
--      but a merge that quietly dropped `caliperMeasuredAtInches` would silently move every
--      caliper on the ladder from 12 inches to the platform's 6. Expect 12, and a non-empty label.
--   SELECT config->>'caliperMeasuredAtInches' AS caliper_at,   -- expect 12, NOT 6
--          config->>'madeItemLabel'          AS made_label,    -- expect homemade
--          config ? 'caliperMeasuredAtBecause' AS because_kept -- expect t
--   FROM public.business_operations_config
--   WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
--
-- (S3) EXACTLY ONE rung has a grow figure, and it is the 15 gal at 6.
--      Expect 9 rows: '15 gal' = 6, every other grow_months NULL.
--   SELECT label, sort_order, grow_months, hold_months, grow_because
--   FROM public.container_ladder
--   WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--   ORDER BY sort_order;
--
-- (S4) The count, stated as a single number so it is hard to misread. Expect 1.
--   SELECT count(*) FILTER (WHERE grow_months IS NOT NULL) AS rungs_with_grow,
--          count(*)                                       AS rungs_total
--   FROM public.container_ladder
--   WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
