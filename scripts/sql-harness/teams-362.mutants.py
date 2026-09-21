#!/usr/bin/env python3
"""
teams-362.mutants — can the team writers' rules actually fail? (ledger #362, §6 r19)

PURPOSE:      Breaks one rule at a time in migration 20260921a or the client, runs the matching
              path/guard test through scripts/path-tests/run-path-file.mjs, restores the file, and
              reports CAUGHT (the test went red) or SURVIVED. A rule nobody has watched refuse is
              a claim, not a guard — [[R-33]] / CLAUDE.md §6 r19.
DEPENDENCIES: python3 · node · the path-test runner. Restores every file in a finally block.
OUTPUTS:      one line per mutant and a total; exit 1 if any mutant survived.
Run from the repo root:  python3 scripts/sql-harness/teams-362.mutants.py
"""
import subprocess, os, sys
M='supabase/migrations/20260921a_teams.sql'
L='packages/cultivar-os/src/lib/teams.ts'
S='packages/cultivar-os/src/lib/stopRead.ts'

mutants = [
 ('M1 save_team skips its permission check', M,
  "  IF v_uid IS NULL OR NOT public.is_active_member(p_business_id)\n     OR NOT public.has_permission(p_business_id, 'deliveries:update') THEN\n    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted',\n      'message', 'You need permission to change deliveries to edit teams.');",
  "  IF v_uid IS NULL THEN\n    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted',\n      'message', 'You need permission to change deliveries to edit teams.');",
  'team.not-permitted'),

 ('M2 assign_stops_team skips its permission check', M,
  "  IF v_uid IS NULL OR NOT public.is_active_member(p_business_id)\n     OR NOT public.has_permission(p_business_id, 'deliveries:update') THEN\n    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted',\n      'message', 'You need permission to change deliveries to set a team.');",
  "  IF v_uid IS NULL THEN\n    RETURN jsonb_build_object('ok', false, 'code', 'not_permitted',\n      'message', 'You need permission to change deliveries to set a team.');",
  'team.not-permitted'),

 ('M3 two live teams may share a name', M,
  "CREATE UNIQUE INDEX IF NOT EXISTS teams_one_live_name_per_business\n  ON public.teams (business_id, lower(btrim(name))) WHERE active;",
  "CREATE INDEX IF NOT EXISTS teams_one_live_name_per_business\n  ON public.teams (business_id, lower(btrim(name))) WHERE active;",
  'team.name-taken'),

 ('M4 the name index is not partial, so retiring never frees the name', M,
  "  ON public.teams (business_id, lower(btrim(name))) WHERE active;",
  "  ON public.teams (business_id, lower(btrim(name)));",
  'team.name-taken'),

 ('M5 the same person may be on a team twice', M,
  "  IF v_n > 0 AND v_n <> (SELECT count(DISTINCT lower(x)) FROM unnest(v_names) x) THEN",
  "  IF false THEN",
  'team.duplicate-member'),

 ('M6 a nameless team is accepted', M,
  "  IF v_name IS NULL OR length(v_name) > 60 THEN",
  "  IF false THEN",
  'team.no-name'),

 ('M7 the member list is APPENDED instead of replaced', M,
  "  DELETE FROM public.team_members WHERE team_id = v_id;\n",
  "",
  'team.edit'),

 ('M8 a team can be edited from another business', M,
  "    SELECT id INTO v_id FROM public.teams WHERE id = p_team_id AND business_id = p_business_id;",
  "    SELECT id INTO v_id FROM public.teams WHERE id = p_team_id;",
  'team.other-business'),

 ('M9 any member may read any business\'s teams', M,
  "CREATE POLICY teams_member_select ON public.teams FOR SELECT\n  USING (public.is_active_member(business_id) AND public.has_permission(business_id, 'deliveries:read'));",
  "CREATE POLICY teams_member_select ON public.teams FOR SELECT\n  USING (true);",
  'team.other-business'),

 ('M10 a set with a foreign or missing stop is assigned anyway', M,
  "  IF v_valid <> v_n THEN",
  "  IF false THEN",
  'stop.assign-all-or-nothing,team.other-business'),

 ('M11 the stop count ignores the business, so a foreign stop passes', M,
  "  SELECT count(*) INTO v_valid FROM public.deliveries\n   WHERE id = ANY(p_stop_ids) AND business_id = p_business_id AND coalesce(status, '') <> 'cancelled';",
  "  SELECT count(*) INTO v_valid FROM public.deliveries\n   WHERE id = ANY(p_stop_ids) AND coalesce(status, '') <> 'cancelled';",
  'team.other-business'),

 ('M12 a retired team can still be put on a stop', M,
  "    SELECT name INTO v_name FROM public.teams\n     WHERE id = p_team_id AND business_id = p_business_id AND active;",
  "    SELECT name INTO v_name FROM public.teams\n     WHERE id = p_team_id AND business_id = p_business_id;",
  'stop.retired-team'),

 ('M13 an empty set quietly succeeds', M,
  "  IF v_n = 0 THEN\n    RETURN jsonb_build_object('ok', false, 'code', 'nothing_to_assign', 'message', 'No stops were chosen.');\n  END IF;",
  "  IF false THEN\n    RETURN jsonb_build_object('ok', false, 'code', 'nothing_to_assign', 'message', 'No stops were chosen.');\n  END IF;",
  'stop.no-stops-chosen'),

 ('M14 setting a team writes no audit row', M,
  "  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)\n  VALUES (p_business_id, v_uid, v_role, 'stop.team_assigned', 'team', coalesce(p_team_id::text, 'unassigned'),",
  "  INSERT INTO public.audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail, outcome)\n  SELECT p_business_id, v_uid, v_role, 'stop.team_assigned', 'team', coalesce(p_team_id::text, 'unassigned'),",
  'stop.assign-team,stop.unassign-team'),

 ('M15 losing the vendor takes the team with it', M,
  "  vendor_id   uuid        REFERENCES public.vendors(id) ON DELETE SET NULL,",
  "  vendor_id   uuid        REFERENCES public.vendors(id) ON DELETE CASCADE,",
  'team.no-pay-side'),

 ('M16 retiring a team clears it off the stops it already has', M,
  "  DELETE FROM public.team_members WHERE team_id = v_id;",
  "  UPDATE public.deliveries SET team_id = NULL WHERE team_id = v_id AND NOT v_active;\n  DELETE FROM public.team_members WHERE team_id = v_id;",
  'team.retire'),

 ('M17 a stop with no team reads as blank rather than saying so', L,
  "  if (!teamId) return 'No team';",
  "  if (!teamId) return '';",
  'stop.assign-team'),

 ('M18 a retired team is shown as if it were still live', L,
  "  return t.active ? t.name : `${t.name} (retired)`;",
  "  return t.name;",
  'team.retire'),

 ('M19 the schedule never reads the stop\'s team', S,
  "const STOP_COLS_FULL_TEAM = `${STOP_COLS_FULL}, team_id`;",
  "const STOP_COLS_FULL_TEAM = STOP_COLS_FULL;",
  'stop.assign-team'),
]

caught = 0
for name, f, a, b, ids in mutants:
    src = open(f).read()
    if a not in src:
        print(f'{name}: ANCHOR MISSING'); continue
    open(f, 'w').write(src.replace(a, b, 1))
    try:
        out = subprocess.run(['node', 'scripts/path-tests/run-path-file.mjs', 'scripts/path-tests/teams.paths.mts'],
                             capture_output=True, text=True,
                             env={**os.environ, 'PATH_ONLY': ids}, timeout=600).stdout
    finally:
        open(f, 'w').write(src)
    lines = [l for l in out.splitlines() if l.startswith(('PATH ', 'GUARD '))]
    red = any(' FAIL ' in l for l in lines)
    caught += red
    print(f"{'CAUGHT ' if red else 'SURVIVED'} {name} — {', '.join(l.split(' ')[1] + ':' + l.split(' ')[2] for l in lines) or 'NO OUTPUT'}")
print(f'{caught}/{len(mutants)} caught')
sys.exit(0 if caught == len(mutants) else 1)
