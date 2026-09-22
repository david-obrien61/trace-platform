-- ============================================================================================
-- 20260922c — V3–V5, REWRITTEN AS ONE SELF-CONTAINED BLOCK THAT LEAVES NOTHING BEHIND
--             ledger #375 · teams piece 2.5 · David's instruction, 2026-09-22
--
-- 🔴 THIS IS A PROBE, NOT A MIGRATION. It is not in supabase/migrations and must never be applied
--    as one. Paste it into the SQL editor, read the one line it prints, done.
--
-- WHY IT WAS REWRITTEN. The V3–V5 comments in the migration were UNSAFE AS WRITTEN and David hit it:
--   · V3 INSERTED A REAL ROW into an APPEND-ONLY table on LAWNS — a row nobody can ever delete,
--     because the whole point of the table is that DELETE raises.
--   · It then asked him to paste that row's id by hand into V4 and V5. His run failed on the
--     literal '<that id>' (22P02 invalid input syntax for uuid), which correctly rolled back the
--     insert — but only by luck of the ordering, and it left him checking V6 to find out whether a
--     row was stranded. (It was not: V6 = 0.)
--   A verification step that can permanently dirty a customer's data is not a verification step.
--
-- HOW THIS ONE IS SAFE, BY CONSTRUCTION:
--   · ONE `DO` block — no ids typed by hand, nothing to paste between statements.
--   · Every expected refusal is caught BY NAME (`insufficient_privilege`), so a refusal that is
--     the RIGHT one passes silently and a refusal that is the WRONG one still aborts.
--   · It ends by RAISING on success, so the whole block — probe row included — ROLLS BACK.
--     🔴 The PASS message therefore ARRIVES AS AN ERROR. That is intended: in Postgres a DO block
--     cannot both leave nothing behind and return a result set, and leaving nothing behind is the
--     property that matters here.
--   · It picks a business by SELECT rather than a hardcoded tenant id, so it carries no customer
--     literal (AC-1) and works on any database.
--
-- WHAT TO EXPECT — exactly one of these:
--   ✅ ERROR: V3–V5 PASSED — ...                → append-only holds. Nothing was written.
--   🔴 ERROR: V3–V5 FAILED — <what happened>    → a refusal did not fire. Tell Thunder the text.
-- ============================================================================================

DO $probe$
DECLARE
  v_biz uuid;
  v_id  uuid;
  v_n   integer;
BEGIN
  SELECT id INTO v_biz FROM public.businesses ORDER BY created_at LIMIT 1;
  IF v_biz IS NULL THEN
    RAISE EXCEPTION 'V3–V5 FAILED — there are no businesses to probe against.';
  END IF;

  -- ── V3a · a snapshot can be written ───────────────────────────────────────────────────────
  INSERT INTO public.delivery_day_estimates
    (business_id, service_date, reason, stops, trees, threshold_hours,
     planting_minutes_per_tree, settings_were_set, total_hours, drive_known, suggested_teams)
  VALUES (v_biz, current_date, 'route_save', 4, 10, 7, 30, true, 6.0, true, 1)
  RETURNING id INTO v_id;

  -- ── V3b · …and it CANNOT be rewritten ─────────────────────────────────────────────────────
  BEGIN
    UPDATE public.delivery_day_estimates SET total_hours = 99 WHERE id = v_id;
    RAISE EXCEPTION 'V3–V5 FAILED — a snapshot was REWRITTEN: total_hours accepted an UPDATE. The append-only trigger did not fire.';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;   -- expected: this is the refusal we want
  END;

  -- ── V4a · the CHOICE may be recorded, once ────────────────────────────────────────────────
  UPDATE public.delivery_day_estimates
     SET chosen_teams = 1, chosen_at = now()
   WHERE id = v_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 1 THEN
    RAISE EXCEPTION 'V3–V5 FAILED — recording the team choice changed % row(s), expected 1. Lauren''s decision would not be kept.', v_n;
  END IF;

  -- ── V4b · …and it cannot be changed afterwards ────────────────────────────────────────────
  BEGIN
    UPDATE public.delivery_day_estimates SET chosen_teams = 2 WHERE id = v_id;
    RAISE EXCEPTION 'V3–V5 FAILED — a recorded choice was CHANGED. Changing your mind must be a NEW estimate, not an edit of the old one.';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;   -- expected
  END;

  -- ── V5 · nothing can be deleted ───────────────────────────────────────────────────────────
  BEGIN
    DELETE FROM public.delivery_day_estimates WHERE id = v_id;
    RAISE EXCEPTION 'V3–V5 FAILED — a snapshot was DELETED. The table is not append-only.';
  EXCEPTION
    WHEN insufficient_privilege THEN NULL;   -- expected
  END;

  -- ── Everything held. Abort so the probe row goes with it. ─────────────────────────────────
  RAISE EXCEPTION
    'V3–V5 PASSED — rewrite refused, choice recorded once, second choice refused, delete refused. Probe row % discarded (rollback expected — this error IS the pass).', v_id;
END
$probe$;

-- Optional, after the block: confirm it left nothing. Expect the SAME number as before you ran it
-- (David measured 0 on LAWNS on 2026-09-22).
-- SELECT count(*) AS rows_in_table FROM public.delivery_day_estimates;
