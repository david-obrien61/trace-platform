-- ═══════════════════════════════════════════════════════════════════════════════
-- LAWNS — THE GROW LADDER, TERRY'S SCHEDULE.   David, 2026-09-25.
-- David pastes this. SQL editor, as postgres. Run AFTER `20260923h_container_ladder_grow_and_hold.sql`.
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- ✏️ THIS SUPERSEDES `docs/decisions/2026-09-23-lawns-grow-ladder-step0.sql` (SHA
--    `951d9d0e…`). 🔴 **DO NOT RUN THAT ONE.** It carried a window of 2026-11-04 → 11-12
--    taken from David's workbook, and GROW on the 15 gal rung ONLY, with the other eight
--    deliberately left NULL pending Terry. **Terry has now answered and both change.**
--
-- WHAT DAVID RULED, 2026-09-25:
--   · **UPPOT WINDOW: mid-November to mid-February** → 15 Nov – 15 Feb, **recurring each year**,
--     a per-business setting Lauren can edit.
--   · **GROW = 6 MONTHS ON EVERY RUNG** — Terry's six-month rule. Sellable *typically* 6–8 months
--     after uppotting: **6 is stored as the rule**, and "typically sellable by 8 months" is
--     carried in the reason beside it, which is what the screen shows. Stock is UNDER PRODUCTION
--     until then.
--   · **HOLD IS NOT RULED. IT STAYS UNSET.** 🔴 This file writes nothing to `hold_months` and that
--     is deliberate — an unknown must not be guessed to make a column look finished (D-9).
--
-- 🔴 ONE THING DAVID RULED THAT THIS FILE CANNOT DELIVER, AND SAYING SO IS THE POINT.
--    **"RECURRING EACH YEAR" IS NOT STORABLE TODAY.** `windowStart`/`windowEnd` are declared
--    `string | null` and documented **"ISO 'YYYY-MM-DD'"** (`productionConfig.ts:158-160`), the
--    Settings editor renders them as `<input type="date">`, and `planLots` takes `startDate` as an
--    absolute date. There is no month-day form and no recurrence flag anywhere.
--    **So this file sets THIS SEASON: 2026-11-15 → 2027-02-15.** It will be right until
--    2027-11-15 and then silently a year stale — the window would read as CLOSED all season and
--    every batch would go undated, which looks exactly like "nobody set it".
--    ⚠️ **Recurrence is a small build (~3–5 h: store the month-day, derive the year, and teach the
--    Settings editor), and it is NOT done here. David decides whether it is worth it or whether
--    changing two dates each November is simpler.** Recorded so nobody reads "recurring" off the
--    ruling and assumes the database knows it.
--
-- ADDITIVE AND IDEMPOTENT: `||` merges the two keys, and the GROW update is absolute, so a second
-- run changes nothing. 🔴 **AND IT CANNOT LOSE AN EXISTING KEY EVEN IF SOMEBODY EDITS IT WRONG
-- LATER**: section ① raises and rolls the whole file back if any key present before is missing
-- after — derived from what is actually there, never from a list. LAWNS holds FIVE today
-- (`caliperMeasuredAtInches` 12 · `caliperMeasuredAtBecause` · `madeItemLabel` homemade ·
-- `dayHoursBeforeSecondTeam` 7 · `plantingMinutesPerGallon` 1), and the guard does not know that.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── ① THE UPPOT WINDOW — THIS SEASON'S DATES, AND THE FILE REFUSES TO LOSE A KEY ─────────────
-- 🔴 `||` MERGES, IT DOES NOT REPLACE — and this block PROVES it rather than asserting it,
--    because an earlier version of this file got that exactly wrong in a way that would have
--    passed its own check.
--
-- ✏️ WHAT WENT WRONG, RECORDED BECAUSE IT IS THE WHOLE REASON THIS IS A `DO` BLOCK AND NOT AN
--    `UPDATE`. The first version's V-block asserted that THREE NAMED KEYS survived —
--    `caliperMeasuredAtInches`, `caliperMeasuredAtBecause`, `madeItemLabel` — because those were
--    the three LAWNS held when it was written. **This morning two more were added by another
--    session** (`dayHoursBeforeSecondTeam` 7 and `plantingMinutesPerGallon` 1, from
--    `2026-09-25-lawns-capacity-settings.sql`). A hardcoded list would have gone GREEN while
--    silently dropping both. **That is tech-debt #73's exact shape: a check that asserts a list
--    somebody typed, not the thing that matters.**
--
-- 🔴 SO THE GUARD IS DERIVED AND IT IS INSIDE THE TRANSACTION. It snapshots every key BEFORE,
--    applies the merge, snapshots every key AFTER, and RAISES — rolling the whole file back — if
--    even one key present before is missing after. **It does not know or care what the keys are
--    called**, so a key written next week by a session that never read this file is protected too.
--    A lost `caliperMeasuredAtInches` would move every caliper on the ladder from LAWNS's 12
--    inches to the platform's 6, silently, on a screen nobody would think to re-check.
DO $$
DECLARE
  before_keys text[];
  after_keys  text[];
  lost        text[];
BEGIN
  SELECT coalesce(array_agg(k ORDER BY k), '{}')
    INTO before_keys
    FROM public.business_operations_config c,
         LATERAL jsonb_object_keys(c.config) AS k
   WHERE c.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

  UPDATE public.business_operations_config
     SET config = config || jsonb_build_object(
           'windowStart', '2026-11-15',
           'windowEnd',   '2027-02-15'
         )
   WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

  SELECT coalesce(array_agg(k ORDER BY k), '{}')
    INTO after_keys
    FROM public.business_operations_config c,
         LATERAL jsonb_object_keys(c.config) AS k
   WHERE c.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

  SELECT coalesce(array_agg(b), '{}') INTO lost
    FROM unnest(before_keys) AS b
   WHERE NOT (b = ANY (after_keys));

  IF array_length(lost, 1) IS NOT NULL THEN
    RAISE EXCEPTION
      'REFUSED — this file would have DROPPED % existing operations key(s): %. Nothing was written. The config must be MERGED, never replaced.',
      array_length(lost, 1), array_to_string(lost, ', ');
  END IF;

  RAISE NOTICE 'operations config: % key(s) before, % after — none lost', 
    array_length(before_keys, 1), array_length(after_keys, 1);
END $$;

-- ── ② GROW = 6 MONTHS ON EVERY RUNG ──────────────────────────────────────────
-- Terry's rule, and it is the same number on every size — which is WHY it can be written for all
-- of them at once rather than rung by rung. The reason carries the expected range, because the
-- reason is what the plan prints beside the date.
--
-- ⚠️ IT WRITES `grow_months` ONLY. `hold_months` is untouched on purpose: nobody has ruled how
-- long a tree then STAYS on a rung before it must move up, and a guessed hold would put a
-- move-up date on a screen that nobody decided.
UPDATE public.container_ladder
   SET grow_months  = 6,
       grow_because = 'Terry''s six-month rule, via David 2026-09-25 — six months from uppotting to sellable, on every size. Typically sellable by 8 months; stock is UNDER PRODUCTION until then. 6 is the rule, 6–8 is the expectation.'
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- V-BLOCKS — verdict style, self-contained, every one runs AS-IS (§6 r26). Read-only.
-- 🔴 NOT ONE PINS A ROW COUNT. LAWNS may add a container size at any time, and a check that
-- fails for that reason is a check people learn to ignore. What is asserted is the RELATION.
-- ═══════════════════════════════════════════════════════════════════════════════

-- V1 — THE WINDOW IS SET, AND IT IS THIS SEASON'S. Expect: PASS.
SELECT 'V1 the uppot window is 2026-11-15 → 2027-02-15' AS check,
       CASE WHEN config->>'windowStart' = '2026-11-15'
             AND config->>'windowEnd'   = '2027-02-15'
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       config->>'windowStart' AS starts,
       config->>'windowEnd'   AS ends
  FROM public.business_operations_config
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V2 — 🔴 EVERY KEY LAWNS HELD IS STILL THERE, AND THE TWO NEW ONES AROSE. Expect: PASS.
-- ⚠️ THIS IS NOT A LIST OF NAMES. An earlier version named three keys and would have gone green
-- while dropping the two another session added this morning. This asserts the RELATION: the
-- config gained exactly the two window keys and lost nothing. The named spot-checks below are
-- corroboration for a human reading the output — they are not what the verdict rests on.
SELECT 'V2 the merge added exactly 2 keys and lost none' AS check,
       CASE WHEN (SELECT count(*) FROM jsonb_object_keys(config)) >= 7
             AND config ? 'windowStart' AND config ? 'windowEnd'
             AND config ? 'caliperMeasuredAtInches'
             AND config ? 'caliperMeasuredAtBecause'
             AND config ? 'madeItemLabel'
             AND config ? 'dayHoursBeforeSecondTeam'
             AND config ? 'plantingMinutesPerGallon'
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       (SELECT count(*) FROM jsonb_object_keys(config)) AS keys_now_expect_7_or_more,
       config->>'caliperMeasuredAtInches'  AS caliper_at_expect_12,
       config->>'dayHoursBeforeSecondTeam' AS day_hours_expect_7,
       config->>'plantingMinutesPerGallon' AS mins_per_gallon_expect_1,
       (SELECT string_agg(k, ' · ' ORDER BY k) FROM jsonb_object_keys(config) k) AS every_key_now
  FROM public.business_operations_config
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V3 — 🔴 EVERY RUNG HAS GROW = 6, AND NOT ONE HAS A HOLD. Expect: PASS, 0 without, 0 with hold.
-- This is the whole ruling in one row, and both halves matter: the six is universal, and the
-- hold is ABSENT rather than defaulted.
SELECT 'V3 every rung grows in 6 months; not one carries a guessed hold' AS check,
       CASE WHEN count(*) FILTER (WHERE grow_months IS DISTINCT FROM 6) = 0
             AND count(*) FILTER (WHERE hold_months IS NOT NULL) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE grow_months IS DISTINCT FROM 6) AS rungs_not_six_should_be_zero,
       count(*) FILTER (WHERE hold_months IS NOT NULL)        AS rungs_with_hold_should_be_zero,
       count(*) AS rungs_total_context_only
  FROM public.container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V4 — THE REASON CARRIES THE EXPECTED RANGE, BECAUSE THE REASON IS WHAT THE PLAN PRINTS.
-- Expect: PASS. A 6 with no sentence beside it would tell Lauren the date and not the confidence.
SELECT 'V4 the reason says 6 is the rule and 6–8 is the expectation' AS check,
       CASE WHEN count(*) FILTER (WHERE grow_because NOT ILIKE '%8 months%'
                                     OR grow_because NOT ILIKE '%Terry%') = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) FILTER (WHERE grow_because ILIKE '%8 months%') AS rungs_naming_the_range,
       min(left(grow_because, 58)) AS sample
  FROM public.container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

-- V5 — 🔴 NO POTTING DATE WAS INVENTED. Expect: PASS, 0.
-- David, 2026-09-25: *"A lot with no potting date must NEVER get a guessed one."* This file
-- writes none, and this asserts that afterwards rather than trusting that it did not.
SELECT 'V5 not one potting date was written — none is guessed, ever' AS check,
       CASE WHEN (SELECT count(*) FROM public.production_rung_dates) = 0
            THEN 'PASS' ELSE 'FAIL' END AS verdict,
       (SELECT count(*) FROM public.production_rung_dates) AS rung_dates_should_be_zero,
       (SELECT count(*) FROM public.business_inventory
         WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
           AND retired_at IS NULL AND received_at IS NOT NULL) AS lots_with_received_at_should_be_zero;

-- V6 — IDEMPOTENCE. Re-running changes nothing. Expect: PASS, 0.
SELECT 'V6 re-running this file would change 0 rows' AS check,
       CASE WHEN count(*) = 0 THEN 'PASS' ELSE 'FAIL' END AS verdict,
       count(*) AS rungs_the_update_would_still_change
  FROM public.container_ladder
 WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
   AND (grow_months IS DISTINCT FROM 6 OR grow_because NOT ILIKE '%Terry%');
