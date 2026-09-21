#!/usr/bin/env python3
"""
route-per-team-362.mutants — can piece 2's guards actually fail? (ledger #362, §6 r19)

PURPOSE:      Breaks one rule at a time in 20260923b (or the client) and runs the matching
              path/guard through scripts/path-tests/run-path-file.mjs, restoring the file after.
              🔴 M1 IS THE POINT OF THE WHOLE HARNESS: it puts the DAY-SCOPED clear back — the exact
              code that wiped Team 2's order on 2026-09-19 — and the Saturday guard must go red.
              A regression test nobody has watched fail is not a regression test.
DEPENDENCIES: python3 · node · the path-test runner. Restores every file in a finally block.
OUTPUTS:      one line per mutant and a total; exit 1 if any mutant survived.
Run from the repo root:  python3 scripts/sql-harness/route-per-team-362.mutants.py
"""
import subprocess, os, sys
M = 'supabase/migrations/20260923b_route_order_per_team.sql'
R = 'packages/cultivar-os/src/lib/routeOrder.ts'

mutants = [
 ('M1 🔴 THE SATURDAY BUG PUT BACK — the clear is day-scoped again', M,
  "     AND NOT (d.id = ANY(p_stop_ids)) AND d.route_position IS NOT NULL\n     AND d.team_id IS NOT DISTINCT FROM p_team_id;",
  "     AND NOT (d.id = ANY(p_stop_ids)) AND d.route_position IS NOT NULL;",
  'route.keeps-another-teams-order'),

 ('M2 a stop with no team is routed anyway', M,
  "    IF v_teamless IS NOT NULL THEN",
  "    IF false THEN",
  'route.refuses-teamless-stop'),

 ('M3 the team-less refusal COUNTS instead of NAMING', M,
  "      RETURN jsonb_build_object('ok', false, 'code', 'stop_without_team', 'stops', v_teamless,\n        'message', v_teamless || ' has no team — assign it to a team first.');",
  "      RETURN jsonb_build_object('ok', false, 'code', 'stop_without_team', 'stops', v_teamless,\n        'message', 'One stop has no team — assign it to a team first.');",
  'route.refuses-teamless-stop'),

 # ⚠️ ANCHORED ON THE RETURN, NOT ON `IF v_teams IS NOT NULL`. The ⓪ rule added a second, identical
 # line above this one, so the short anchor silently mutated the WRONG block and M4 survived while
 # appearing to test something — tech-debt #182's class, caught here by a survivor.
 ('M4 a set spanning two teams is routed across both', M,
  "      RETURN jsonb_build_object('ok', false, 'code', 'mixed_teams', 'teams', v_teams,",
  "      RETURN jsonb_build_object('ok', true, 'code', 'mixed_teams', 'teams', v_teams,",
  'route.refuses-mixed-teams'),

 ('M5 the mixed refusal does not name the other team', M,
  "        'message', 'That set also contains stops for ' || v_teams || '. Route one team at a time.');",
  "        'message', 'That set covers more than one team. Route one team at a time.');",
  'route.refuses-mixed-teams'),

 ('M6 the optimiser\'s miles and minutes are dropped on the floor', M,
  "  VALUES (p_business_id, p_service_date, p_team_id, v_now, v_uid, v_n, p_miles, p_minutes);",
  "  VALUES (p_business_id, p_service_date, p_team_id, v_now, v_uid, v_n, NULL, NULL);",
  'route.save-per-team'),

 ('M7 a re-route leaves the old plan row behind', M,
  "  DELETE FROM public.delivery_route_plans\n   WHERE business_id = p_business_id AND delivery_date = p_service_date\n     AND team_id IS NOT DISTINCT FROM p_team_id;",
  "",
  'route.save-per-team'),

 ('M8 the plan does not record who routed it', M,
  "  VALUES (p_business_id, p_service_date, p_team_id, v_now, v_uid, v_n, p_miles, p_minutes);",
  "  VALUES (p_business_id, p_service_date, p_team_id, v_now, NULL, v_n, p_miles, p_minutes);",
  'route.save-per-team'),

 # ✏️ M9 AND M10 REPLACED. The first pair mutated a REDUNDANT branch of the wrapper — two paths
 # that did the same thing — so both SURVIVED by being equivalent, not by escaping a test. The
 # wrapper is now one path, and these two mutate what it actually decides.
 ('M9 the wrapper never names a team, so every legacy save routes the whole day', M,
  "  SELECT team_id INTO v_team FROM public.deliveries\n   WHERE id = ANY(p_stop_ids) AND business_id = p_business_id AND team_id IS NOT NULL\n   ORDER BY team_id LIMIT 1;",
  "  v_team := NULL;",
  'route.wrapper-refuses-partly-teamed'),

 ('M10 the wrapper may pick a NULL team from a partly team-less set', M,
  "   WHERE id = ANY(p_stop_ids) AND business_id = p_business_id AND team_id IS NOT NULL\n   ORDER BY team_id LIMIT 1;",
  "   WHERE id = ANY(p_stop_ids) AND business_id = p_business_id\n   ORDER BY team_id NULLS FIRST LIMIT 1;",
  'route.wrapper-refuses-partly-teamed'),

 ('M14 a split day may be routed with NO team named — Saturday through the other door', M,
  "    IF v_teams IS NOT NULL THEN\n      RETURN jsonb_build_object('ok', false, 'code', 'team_required', 'teams', v_teams,",
  "    IF false THEN\n      RETURN jsonb_build_object('ok', false, 'code', 'team_required', 'teams', v_teams,",
  'route.wrapper-refuses-partly-teamed'),

 ('M15 the team_required refusal does not name the teams', M,
  "        'message', 'These stops belong to ' || v_teams || '. Route one team at a time.');",
  "        'message', 'These stops belong to a team. Route one team at a time.');",
  'route.wrapper-refuses-partly-teamed'),

 ('M11 the client throws the server\'s refusal away and says something generic', R,
  "  if (serverMessage && serverMessage.trim()) return serverMessage.trim();",
  "  if (false) return String(serverMessage);",
  'route.refuses-teamless-stop,route.refuses-mixed-teams'),

 ('M12 the client stops sending the team, so every save routes the whole day', R,
  "    p_team_id: teamId, p_miles: effort.miles ?? null, p_minutes: effort.minutes ?? null,",
  "    p_team_id: null, p_miles: effort.miles ?? null, p_minutes: effort.minutes ?? null,",
  'route.keeps-another-teams-order'),

 ('M13 the client stops sending the optimiser\'s numbers', R,
  "p_miles: effort.miles ?? null, p_minutes: effort.minutes ?? null,",
  "p_miles: null, p_minutes: null,",
  'route.save-per-team'),
]

caught = 0
for name, f, a, b, ids in mutants:
    src = open(f).read()
    if a not in src:
        print(f'{name}: ANCHOR MISSING'); continue
    open(f, 'w').write(src.replace(a, b, 1))
    try:
        out = subprocess.run(['node', 'scripts/path-tests/run-path-file.mjs', 'scripts/path-tests/crew-day.paths.mts'],
                             capture_output=True, text=True,
                             env={**os.environ, 'PATH_ONLY': ids}, timeout=900).stdout
    finally:
        open(f, 'w').write(src)
    lines = [l for l in out.splitlines() if l.startswith(('PATH ', 'GUARD '))]
    red = any(' FAIL ' in l for l in lines)
    caught += red
    print(f"{'CAUGHT ' if red else 'SURVIVED'} {name} — {', '.join(l.split(' ')[1] + ':' + l.split(' ')[2] for l in lines) or 'NO OUTPUT'}")
print(f'{caught}/{len(mutants)} caught')
sys.exit(0 if caught == len(mutants) else 1)
