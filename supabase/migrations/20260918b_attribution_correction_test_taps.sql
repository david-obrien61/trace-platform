-- ════════════════════════════════════════════════════════════════════════════════════════════
-- 20260918b — THE TWO "MAURO" TAPS AT 10:10 WERE DAVID, TESTING · ledger #351 · tech-debt #344
-- ════════════════════════════════════════════════════════════════════════════════════════════
-- ⏳ NOT APPLIED. David, 2026-09-18: *"the 10:10 taps today were ME, testing in my own browser with
--    Mauro's name typed in. Mauro has not used the link. Record that against those events so the log
--    is not read later as his work."* The Thursday 15:55 taps were Lauren, and are correct as recorded.
--
-- 🔴 IT CORRECTS BY APPENDING, NOT BY EDITING — and that is the design, not a limitation.
--    `delivery_stop_events` and `audit_log` are both append-only (their triggers reject UPDATE even
--    from `postgres`). A log whose past rows can be rewritten is not evidence of anything. So the
--    two events keep the name typed at the time, and this file adds the correction beside them:
--      · one `audit_log` row per event   — action `crew_stop.attribution_corrected`, target = the event
--      · one `audit_log` row for the BROWSER — action `crew_device.identified`, target = its device id,
--        so ANY tap from that browser, under any typed name, can be recognised as David's test device.
--    Written as David (the LAWNS owner), because the correction is his statement.
--
-- THE TWO EVENTS (read live 2026-09-18):
--    5e21fd75-11f5-4b8e-9096-4a0ee33085ce  start      Chris Freehill   Fri 10:10:17  typed "Mauro"
--    d0e8c03d-d209-4fd3-8c55-38674d6e6417  undo_done  Saurabh Sappal   Fri 10:10:55  typed "Mauro"
--    device f18d48bd-2f18-45cb-bfe0-d55ab3c4b17f · link 8ff4ea91-4e15-42af-8ed2-78d449f2e328 (made Fri 10:07)
--
-- 🔴 REFUSAL: it writes NOTHING unless both events still exist exactly as measured (typed "Mauro",
--    that device, 10:10–10:11 Friday Chicago) and no correction has been recorded for them yet — so it
--    is safe to paste twice (the second run refuses and changes nothing).
-- ════════════════════════════════════════════════════════════════════════════════════════════
DO $$
DECLARE
  v_business uuid   := 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
  v_david    uuid   := '98f4e56b-cd27-4099-a9d8-5c8cbb63d00f';
  v_device   text   := 'f18d48bd-2f18-45cb-bfe0-d55ab3c4b17f';
  v_events   uuid[] := ARRAY['5e21fd75-11f5-4b8e-9096-4a0ee33085ce', 'd0e8c03d-d209-4fd3-8c55-38674d6e6417']::uuid[];
  v_n        int;
BEGIN
  SELECT count(*) INTO v_n FROM public.delivery_stop_events
   WHERE id = ANY(v_events) AND business_id = v_business AND actor_name = 'Mauro' AND device_id = v_device
     AND occurred_at >= ('2026-09-18 10:10:00'::timestamp AT TIME ZONE 'America/Chicago')
     AND occurred_at <  ('2026-09-18 10:11:00'::timestamp AT TIME ZONE 'America/Chicago');
  IF v_n <> 2 THEN
    RAISE EXCEPTION 'REFUSED — expected the 2 test taps typed "Mauro" at 10:10 on 2026-09-18 from device %; found %. Nothing written.', v_device, v_n;
  END IF;
  IF EXISTS (SELECT 1 FROM public.audit_log WHERE action = 'crew_stop.attribution_corrected' AND target_id = ANY(v_events::text[])) THEN
    RAISE EXCEPTION 'REFUSED — the correction is already recorded. Nothing written.';
  END IF;

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  SELECT e.business_id, v_david, 'OWNER', 'crew_stop.attribution_corrected', 'delivery_stop_event', e.id::text,
         jsonb_build_object(
           'recorded_actor_name', e.actor_name,
           'actual_actor', 'David O''Brien (owner) — testing in his own browser with Mauro''s name typed in',
           'mauro_used_the_link', false,
           'event_action', e.action, 'occurred_at', e.occurred_at, 'delivery_id', e.delivery_id,
           'device_id', e.device_id, 'link_id', e.link_id, 'migration', '20260918b'),
         'success'
    FROM public.delivery_stop_events e WHERE e.id = ANY(v_events);

  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)
  VALUES (v_business, v_david, 'OWNER', 'crew_device.identified', 'crew_device', v_device,
          jsonb_build_object('belongs_to', 'David O''Brien (owner)', 'use', 'testing',
                             'note', 'Any crew-link tap from this device is David testing, whatever name is typed.',
                             'migration', '20260918b'),
          'success');
  RAISE NOTICE 'Recorded: the two 10:10 taps typed "Mauro" were David, testing; device % marked as his test browser.', v_device;
END $$;

-- ── V-BLOCK (read-only) — run after, paste back ─────────────────────────────────────────────
-- SELECT action, target_type, left(target_id, 8) AS target, detail->>'actual_actor' AS actual,
--        detail->>'recorded_actor_name' AS recorded_as
--   FROM audit_log
--  WHERE business_id = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74'
--    AND action IN ('crew_stop.attribution_corrected', 'crew_device.identified')
--  ORDER BY created_at;
--   expect: 3 rows — two corrections (recorded_as "Mauro", actual "David O'Brien…") and one device row.
