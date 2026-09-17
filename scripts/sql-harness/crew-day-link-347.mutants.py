#!/usr/bin/env python3
"""
crew-day-link-347.mutants — can the crew day link's guards actually fail? (ledger #347, §6 r19)

PURPOSE:      Breaks one rule at a time in migration 20260917c or the endpoint, runs the matching
              path/guard test through scripts/path-tests/run-path-file.mjs, restores the file, and
              reports CAUGHT (the test went red) or SURVIVED. 17 mutants; 17/17 caught on 2026-09-17.
DEPENDENCIES: python3 · node · the path-test runner. Restores every file in a finally block.
OUTPUTS:      one line per mutant and a total; exit 1 if any mutant survived.
Run from the repo root:  python3 scripts/sql-harness/crew-day-link-347.mutants.py
"""
import subprocess, os, sys
M='supabase/migrations/20260917c_crew_day_link.sql'
H='packages/cultivar-os/api/members/crewDay.ts'
mutants = [
 ('M1 expiry check removed', M, "IF now() >= link.expires_at THEN code := 'expired'; RETURN; END IF;", "", 'crew.expired'),
 ('M2 revoked check removed', M, "IF link.revoked_at IS NOT NULL THEN code := 'revoked'; RETURN; END IF;", "", 'crew.revoked'),
 ('M3 act ignores the day', M, "AND business_id = v_link.business_id AND delivery_date = v_link.service_date", "AND business_id = v_link.business_id", 'crew.other-day'),
 ('M4 read ignores the day', M, "      AND d.delivery_date = p_service_date\n", "", 'crew.other-day'),
 ('M5 act ignores the business', M, "WHERE id = p_stop_id AND business_id = v_link.business_id AND", "WHERE id = p_stop_id AND", 'crew.other-business'),
 ('M6 read ignores the business', M, "    WHERE d.business_id = p_business_id\n      AND", "    WHERE", 'crew.other-business'),
 ('M7 anon may call the read', M, "GRANT EXECUTE ON FUNCTION public.crew_day_read(text, text)                         TO service_role;", "GRANT EXECUTE ON FUNCTION public.crew_day_read(text, text) TO service_role, anon;", 'crew.other-business'),
 ('M8 unit price in the line', M, "'quantity', oi.quantity)", "'quantity', oi.quantity, 'unit_price', oi.unit_price)", 'crew.no-prices'),
 ('M9 price hidden under an innocent key', M, "'size', bi.size,", "'size', bi.size || ' ' || oi.unit_price::text,", 'crew.no-prices'),
 ('M10 rate limit never refuses', M, "RETURN v_hits <= 60;", "RETURN true;", 'crew.rate-limit'),
 ('M11 rate limit counted after the token check', M, "  IF NOT public.crew_link_hit(p_client_key) THEN RETURN jsonb_build_object('ok', false, 'code', 'rate_limited'); END IF;\n  SELECT * INTO r FROM public.crew_link_resolve(p_token);\n  IF r.code IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'code', r.code); END IF;\n  UPDATE public.crew_day_links SET last_used_at = now() WHERE id = (r.link).id;",
   "  SELECT * INTO r FROM public.crew_link_resolve(p_token);\n  IF r.code IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'code', r.code); END IF;\n  IF NOT public.crew_link_hit(p_client_key) THEN RETURN jsonb_build_object('ok', false, 'code', 'rate_limited'); END IF;\n  UPDATE public.crew_day_links SET last_used_at = now() WHERE id = (r.link).id;", 'crew.rate-limit'),
 ('M12 endpoint maps 429 to 200', H, "rate_limited: 429,", "rate_limited: 200,", 'crew.rate-limit'),
 ('M13 Done fulfils the order', M, "             review_ask_held_at = CASE WHEN review_asked_at IS NULL THEN v_now ELSE review_ask_held_at END\n       WHERE id = v_stop.id;",
   "             review_ask_held_at = CASE WHEN review_asked_at IS NULL THEN v_now ELSE review_ask_held_at END\n       WHERE id = v_stop.id;\n      UPDATE public.orders SET status = 'fulfilled' WHERE id = v_stop.order_id;", 'crew.no-stock-or-order,crew.done'),
 ('M14 Done takes stock', M, "      UPDATE public.deliveries\n         SET status = 'fulfilled',",
   "      UPDATE public.business_inventory SET qty = qty - 1 WHERE business_id = v_link.business_id;\n      UPDATE public.deliveries\n         SET status = 'fulfilled',", 'crew.no-stock-or-order'),
 ('M15 office Done can be undone', M, "ELSIF v_stop.completed_by_name IS NULL OR v_stop.review_asked_at IS NOT NULL THEN", "ELSIF false THEN", 'crew.undo-done'),
 ('M16 no audit row for an action', M, "  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)\n  VALUES (v_link.business_id, NULL, 'crew_link',", "  PERFORM 1; INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)\n  SELECT v_link.business_id, NULL, 'crew_link',", 'crew.start'),
 ('M17 create skips the permission check', M, "  IF v_uid IS NULL OR NOT public.is_active_member(p_business_id)\n     OR NOT public.has_permission(p_business_id, 'deliveries:update') THEN\n    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted',\n      'message', 'You need permission to change deliveries to make a crew link.');",
   "  IF v_uid IS NULL THEN\n    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted',\n      'message', 'You need permission to change deliveries to make a crew link.');", 'crew.link-create'),
]
caught = 0
for name, f, a, b, ids in mutants:
    src = open(f).read()
    if a not in src:
        print(f'{name}: ANCHOR MISSING'); continue
    if name.startswith('M16'):
        # the audit insert becomes a SELECT … WHERE false
        mutated = src.replace(a, b).replace("CASE WHEN v_change THEN 'success' ELSE 'no_change' END);\n\n  UPDATE public.crew_day_links", "CASE WHEN v_change THEN 'success' ELSE 'no_change' END WHERE false;\n\n  UPDATE public.crew_day_links")
    else:
        mutated = src.replace(a, b)
    open(f, 'w').write(mutated)
    try:
        out = subprocess.run(['node', 'scripts/path-tests/run-path-file.mjs', 'scripts/path-tests/crew-day.paths.mts'], capture_output=True, text=True, env={**os.environ, 'PATH_ONLY': ids}, timeout=600).stdout
    finally:
        open(f, 'w').write(src)
    lines = [l for l in out.splitlines() if l.startswith(('PATH ', 'GUARD '))]
    red = any(' FAIL ' in l for l in lines)
    caught += red
    print(f"{'CAUGHT ' if red else 'SURVIVED'} {name} — {', '.join(l.split(' ')[1] + ':' + l.split(' ')[2] for l in lines) or 'NO OUTPUT'}")
print(f'{caught}/{len(mutants)} caught')
sys.exit(0 if caught == len(mutants) else 1)
