-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260918a — CLEAR TWO TEST STARTS ON LAWNS SATURDAY 2026-09-19 · ledger #351 · tech-debt #344
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ⏳ NOT APPLIED. A ONE-OFF DATA FIX, David's instruction 2026-09-18: two stops on Lauren's real
--    Saturday carry a `started_at` from a TEST tap, and no screen can clear a start (an Undo clears
--    a Done, not a Start — tech-debt #344). Left alone, Saturday's record would carry those times:
--    the crew page would show "STARTED 10:10 AM" with no Start button, and a Done on Saturday would
--    record ~23 and ~41 HOURS on site.
--
-- WHAT THE TAP LOG SAYS (read live 2026-09-18, delivery_stop_events — append-only, untouched here):
--    · Saurabh Sappal (pos 2)  — Lauren, crew link, Thu 15:55:20 start → 15:55:21 done → 15:55:23
--      undo → 15:56:22 done; then "Mauro", crew link, Fri 10:10:55 undo. started_at = Thu 15:55.
--    · Chris Freehill (pos 1)  — "Mauro", crew link, Fri 10:10:17 start. started_at = Fri 10:10.
-- ✅ APPLIED 2026-09-18 BY DAVID; V-block after: 8 rows, positions 1–8, all scheduled, started /
--    completed / done_by blank. ✏️ CORRECTED THE SAME DAY: the two "Mauro" taps at 10:10 were DAVID,
--    testing in his own browser with Mauro's name typed in — Mauro has not used the link. The log
--    keeps the typed name (append-only); 20260918b records the correction beside it.
--
-- SCOPE — EXACTLY these two stops, and nothing else on LAWNS:
--    9244b11e-6047-46f1-944e-ea364c9f4298  Chris Freehill
--    25a698b4-6f56-4f42-8f8e-cca4215ee6fb  Saurabh Sappal
--
-- 🔴 THE REFUSAL. It changes NOTHING unless BOTH stops are still exactly as they were measured:
--    LAWNS, dated 2026-09-19, status `scheduled`, NOT completed, and started BEFORE 00:00 on
--    Saturday (Chicago). So a start Mauro makes ON Saturday can never be cleared by this file — if
--    either stop was started on the day, or finished, it refuses whole and says so. It is one
--    transaction: a refusal after the audit rows are written rolls those back too.
--
-- WHAT IT WRITES: `deliveries.started_at = NULL` on the two stops, and one `audit_log` row per stop
--    recording the value it cleared and why. It does NOT touch the tap log: the history that Lauren
--    and Mauro tapped Start stays true. ⚠️ So Lauren's schedule will keep showing the test start in
--    the grey "From the crew link" box until Mauro's real Start on Saturday replaces it there — the
--    box shows the LATEST start event. The stop itself, the crew page and minutes-on-site read
--    `started_at` and are clean from the moment this runs.
-- ════════════════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_ids      uuid[] := ARRAY['9244b11e-6047-46f1-944e-ea364c9f4298', '25a698b4-6f56-4f42-8f8e-cca4215ee6fb']::uuid[];
  v_business uuid   := 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
  v_dayStart timestamptz := ('2026-09-19 00:00:00'::timestamp AT TIME ZONE 'America/Chicago');
  v_n        int;
BEGIN
  SELECT count(*) INTO v_n
    FROM public.deliveries
   WHERE id = ANY(v_ids) AND business_id = v_business AND delivery_date = '2026-09-19'
     AND coalesce(status, '') = 'scheduled' AND completed_at IS NULL
     AND started_at IS NOT NULL AND started_at < v_dayStart;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'REFUSED — expected the 2 test starts (LAWNS, 2026-09-19, scheduled, not completed, started before Saturday); found % matching. NOTHING WAS CHANGED. Run the read-only check and tell Thunder what it shows.', v_n;
  END IF;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  SELECT business_id, NULL, 'migration', 'crew_stop.test_start_cleared', 'delivery', id::text,
         jsonb_build_object('cleared_started_at', started_at, 'migration', '20260918a',
                            'reason', 'a TEST tap made before the pilot day; no screen can clear a start (tech-debt #344)'),
         'success'
    FROM public.deliveries WHERE id = ANY(v_ids);

  UPDATE public.deliveries SET started_at = NULL
   WHERE id = ANY(v_ids) AND business_id = v_business AND delivery_date = '2026-09-19'
     AND coalesce(status, '') = 'scheduled' AND completed_at IS NULL
     AND started_at IS NOT NULL AND started_at < v_dayStart;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'REFUSED — the update matched % rows, not 2; everything in this file has been rolled back.', v_n;
  END IF;
  RAISE NOTICE 'Cleared the 2 test starts on LAWNS 2026-09-19 (Freehill, Sappal).';
END $$;

-- ── V-BLOCK (read-only) — run after, paste back ─────────────────────────────────────────────
-- SELECT d.route_position AS pos, c.first_name || ' ' || c.last_name AS customer, d.status,
--        to_char(d.started_at   AT TIME ZONE 'America/Chicago', 'Dy HH24:MI') AS started,
--        to_char(d.completed_at AT TIME ZONE 'America/Chicago', 'Dy HH24:MI') AS completed,
--        d.completed_by_name AS done_by
--   FROM deliveries d LEFT JOIN customers c ON c.id = d.customer_id
--  WHERE d.business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74' AND d.delivery_date = '2026-09-19'
--  ORDER BY d.route_position NULLS LAST;
--   expect: 8 rows, started / completed / done_by all blank.
