/**
 * ── teams.paths — the team list and a stop's team, driven end to end (ledger #362, piece 1) ─────
 *
 * PURPOSE:      One `path` per capture path in `writer-registry.json` → domain `teams`, and one
 *               `guard` per rule the two writers must hold. Every write goes through the function
 *               the SCREEN calls (`saveTeam`, `retireTeam`, `assignStopsTeam`) as Lauren, RLS on,
 *               and every result is read back from the database AND from where a person looks —
 *               the Settings list (`readTeams`) and the schedule (`readStops`).
 * DEPENDENCIES: scripts/path-tests/lib/liveDb.mjs (the LIVE schema on PGlite, RLS on) + migrations
 *               20260917c, 20260917e and 20260921a applied on top. Synthetic data only.
 * OUTPUTS:      `PATH <id> PASS|FAIL` and `GUARD <id> PASS|FAIL` lines; exit 1 on any FAIL.
 */
import { openLiveDb, restClient, installSupabaseShim } from './lib/liveDb.mjs';
import { readTeams, saveTeam, retireTeam, assignStopsTeam, teamLabel } from '../../packages/cultivar-os/src/lib/teams';
import { readStops } from '../../packages/cultivar-os/src/lib/stopRead';
import { readFileSync } from 'node:fs';

process.env.SUPABASE_URL = 'http://pglite.test';
process.env.SUPABASE_SERVICE_KEY = 'service';
process.env.VITE_SUPABASE_ANON_KEY = 'anon';

const ROOT = process.env.PATH_TEST_ROOT ?? process.cwd();
const MIGRATION = ['20260917c_crew_day_link.sql', '20260917e_route_order_is_saved.sql', '20260921a_teams.sql']
  .map(f => readFileSync(`${ROOT}/supabase/migrations/${f}`, 'utf8')).join('\n');
const ONLY = process.env.PATH_ONLY ? new Set(process.env.PATH_ONLY.split(',')) : null;

const B = 'b0000000-0000-4000-8000-00000000000b';
const B2 = 'b0000000-0000-4000-8000-0000000000b2';
const OWNER = '0a000000-0000-4000-8000-000000000001';
const MANAGER = '0a000000-0000-4000-8000-000000000002';
const STAFF = '0a000000-0000-4000-8000-000000000003';
const OTHER_OWNER = '0a000000-0000-4000-8000-000000000009';
const DAY = '2026-09-19';

const MANAGER_PERMS = ['customers:read', 'orders:read', 'order_items:read', 'inventory:read', 'deliveries:read', 'deliveries:create', 'deliveries:update'];
// STAFF reads the day and cannot change it — the shape that must be refused by the SERVER, not by a hidden button.
const STAFF_PERMS = ['customers:read', 'orders:read', 'deliveries:read'];

let failures = 0;
async function run(kind: 'PATH' | 'GUARD', id: string, what: string, body: (check: (ok: boolean, detail: string) => void) => Promise<void>) {
  if (ONLY && !ONLY.has(id)) return;
  const problems: string[] = [];
  try { await body((ok, detail) => { if (!ok) problems.push(detail); }); }
  catch (e: any) { problems.push(`threw: ${String(e?.message ?? e).slice(0, 300)}`); }
  if (problems.length) failures++;
  console.log(`${kind} ${id} ${problems.length ? 'FAIL' : 'PASS'} ${what}${problems.length ? ' — ' + problems.join(' | ') : ''}`);
}
const path = (id: string, what: string, body: Parameters<typeof run>[3]) => run('PATH', id, what, body);
const guard = (id: string, what: string, body: Parameters<typeof run>[3]) => run('GUARD', id, what, body);

async function freshDb() {
  const db: any = await openLiveDb();
  installSupabaseShim(db);
  await db.exec(MIGRATION);
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${OWNER}', 'o@test.invalid'), ('${MANAGER}', 'm@test.invalid'),
      ('${STAFF}', 's@test.invalid'), ('${OTHER_OWNER}', 'x@test.invalid');
    INSERT INTO public.businesses (id, owner_id, name, business_type, qbo_writes_enabled)
      VALUES ('${B}', '${OWNER}', 'Path Test Nursery', 'nursery', false),
             ('${B2}', '${OTHER_OWNER}', 'Other Nursery', 'nursery', false);
    INSERT INTO public.business_members (business_id, user_id, name, role, permissions, active) VALUES
      ('${B}', '${MANAGER}', 'Lauren', 'MANAGER', '${JSON.stringify(MANAGER_PERMS)}', true),
      ('${B}', '${STAFF}', 'Staff', 'STAFF', '${JSON.stringify(STAFF_PERMS)}', true),
      ('${B2}', '${OTHER_OWNER}', 'Other', 'MANAGER', '${JSON.stringify(MANAGER_PERMS)}', true);
  `);
  return db;
}
const one = async (db: any, sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows[0];
const all = async (db: any, sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows;
const lauren = (db: any) => restClient(db, { uid: MANAGER }) as any;
const staffer = (db: any) => restClient(db, { uid: STAFF }) as any;
const stranger = (db: any) => restClient(db, { uid: OTHER_OWNER }) as any;

let seq = 0;
async function stop(db: any, business: string, date = DAY) {
  seq++;
  const c = await one(db, `INSERT INTO public.customers (business_id, first_name, last_name, source, customer_type)
    VALUES ($1, $2, 'Smith', 'test', 'person') RETURNING id`, [business, `Cust${seq}`]);
  const d = await one(db, `INSERT INTO public.deliveries (business_id, customer_id, delivery_date, address_line1, city, state, zip, status)
    VALUES ($1, $2, $3, $4, 'Leander', 'TX', '78641', 'scheduled') RETURNING id`,
    [business, c.id, date, `${100 + seq} Honeycomb Mesa`]);
  return d.id as string;
}
/** What the Settings screen shows. */
async function listed(db: any) {
  const r = await readTeams(lauren(db), B);
  if (!r.ok) throw new Error(`readTeams: ${r.message}`);
  return r.teams;
}
/** What the schedule shows for a stop — the same read every delivery screen uses. */
async function scheduled(db: any, stopId: string) {
  const r = await readStops(lauren(db), B, { kind: 'day', date: DAY }, { readLines: false });
  if (!r.ok) throw new Error(`schedule read: ${r.error}`);
  return r.value.stops.find(s => s.id === stopId);
}
const audit = (db: any, target: string) => all(db, `SELECT action, actor_user_id, actor_role, outcome, detail FROM public.audit_log WHERE target_id = $1 ORDER BY created_at, action`, [target]);

// ════════════════════════════════════════════════════════════════════════════════════════════
// PATHS — each capture path, typed to database to screen
// ════════════════════════════════════════════════════════════════════════════════════════════

await path('team.create', 'Settings → Teams → Add a team: the team and its people are saved and shown, with an audit row', async (check) => {
  const db = await freshDb();
  const r = await saveTeam(lauren(db), B, { name: '  Team 1 ', memberNames: ['Mauro', ' Jose ', '', 'Hector'] });
  check(r.ok, `save refused: ${JSON.stringify(r)}`);
  if (!r.ok) return;
  check(r.value.members === 3, `members ${r.value.members}, want 3 (the blank is dropped)`);
  const row = await one(db, `SELECT name, active, vendor_id FROM public.teams WHERE id = $1`, [r.value.teamId]);
  check(row.name === 'Team 1', `stored name "${row.name}" — it must be trimmed`);
  check(row.active === true, 'a new team is not live');
  const names = (await all(db, `SELECT name FROM public.team_members WHERE team_id = $1 ORDER BY sort_order`, [r.value.teamId])).map((m: any) => m.name);
  check(JSON.stringify(names) === JSON.stringify(['Mauro', 'Jose', 'Hector']), `members ${JSON.stringify(names)} — order and trim`);
  // …and what Lauren sees on the screen.
  const shown = await listed(db);
  check(shown.length === 1 && shown[0].name === 'Team 1', `the list shows ${JSON.stringify(shown.map(t => t.name))}`);
  check(shown[0].members.map(m => m.name).join(' · ') === 'Mauro · Jose · Hector', 'the screen does not show the people, in order');
  const a = await audit(db, r.value.teamId);
  check(a.length === 1 && a[0].action === 'team.created' && a[0].actor_user_id === MANAGER && a[0].outcome === 'success', `audit ${JSON.stringify(a)}`);
});

await path('team.edit', 'Settings → Teams → Edit: the name changes and the member list is REPLACED, not added to', async (check) => {
  const db = await freshDb();
  const first = await saveTeam(lauren(db), B, { name: 'Team 1', memberNames: ['Mauro', 'Jose'] });
  if (!first.ok) { check(false, 'setup save refused'); return; }
  const r = await saveTeam(lauren(db), B, { id: first.value.teamId, name: 'Team One', memberNames: ['Mauro', 'Hector'] });
  check(r.ok, `edit refused: ${JSON.stringify(r)}`);
  const names = (await all(db, `SELECT name FROM public.team_members WHERE team_id = $1 ORDER BY sort_order`, [first.value.teamId])).map((m: any) => m.name);
  check(JSON.stringify(names) === JSON.stringify(['Mauro', 'Hector']), `members ${JSON.stringify(names)} — Jose must be gone, not kept`);
  const shown = await listed(db);
  check(shown.length === 1 && shown[0].name === 'Team One', `the screen shows ${JSON.stringify(shown.map(t => t.name))} — one team, renamed`);
  const a = await audit(db, first.value.teamId);
  check(a.length === 2 && a[1].action === 'team.updated', `audit ${JSON.stringify(a.map((x: any) => x.action))}`);
});

await path('team.retire', 'Settings → Teams → Retire: it leaves the live list, and the stop that has it keeps reading it', async (check) => {
  const db = await freshDb();
  const t = await saveTeam(lauren(db), B, { name: 'Mauro Crew', memberNames: ['Mauro'] });
  if (!t.ok) { check(false, 'setup save refused'); return; }
  const s = await stop(db, B);
  await assignStopsTeam(lauren(db), B, [s], t.value.teamId);
  const team = (await listed(db))[0];
  const r = await retireTeam(lauren(db), B, team);
  check(r.ok, `retire refused: ${JSON.stringify(r)}`);
  const shown = await listed(db);
  check(shown.length === 1 && shown[0].active === false, `after retiring: ${JSON.stringify(shown.map(x => [x.name, x.active]))}`);
  check(teamLabel(shown, t.value.teamId) === 'Mauro Crew (retired)', `the label reads "${teamLabel(shown, t.value.teamId)}"`);
  // 🔴 R-133: history stays true — the stop still carries the team it went out with.
  const kept = await one(db, `SELECT team_id FROM public.deliveries WHERE id = $1`, [s]);
  check(kept.team_id === t.value.teamId, 'retiring a team cleared it off the stop that already had it');
  check(shown[0].members.map(m => m.name).join('') === 'Mauro', 'the retired team lost its people');
});

await path('stop.assign-team', 'schedule/route → set a team on stops: the stops carry it, the schedule shows it, one audit row', async (check) => {
  const db = await freshDb();
  const t = await saveTeam(lauren(db), B, { name: 'Team 2', memberNames: ['Jose'] });
  if (!t.ok) { check(false, 'setup save refused'); return; }
  const a1 = await stop(db, B), a2 = await stop(db, B), untouched = await stop(db, B);
  const r = await assignStopsTeam(lauren(db), B, [a1, a2], t.value.teamId);
  check(r.ok && r.value.assigned === 2, `assign: ${JSON.stringify(r)}`);
  check(r.ok && r.value.teamName === 'Team 2', 'the result does not name the team it set');
  const rows = await all(db, `SELECT id, team_id FROM public.deliveries WHERE id = ANY($1::uuid[])`, [[a1, a2, untouched]]);
  check(rows.filter((x: any) => x.team_id === t.value.teamId).length === 2, `stops on the team: ${JSON.stringify(rows)}`);
  check(rows.find((x: any) => x.id === untouched).team_id === null, 'a stop that was not chosen was changed');
  // …and what the schedule shows.
  const onScreen = await scheduled(db, a1);
  check(onScreen?.team_id === t.value.teamId, `the schedule reads team_id ${String(onScreen?.team_id)}`);
  const blank = await scheduled(db, untouched);
  check(blank?.team_id === null, 'an unassigned stop does not read as unassigned on the schedule');
  const teams = await listed(db);
  check(teamLabel(teams, onScreen?.team_id) === 'Team 2' && teamLabel(teams, blank?.team_id) === 'No team',
    'the screen label is wrong for one of the two states');
  const rowsA = await audit(db, t.value.teamId);
  check(rowsA.filter((x: any) => x.action === 'stop.team_assigned').length === 1, `audit ${JSON.stringify(rowsA.map((x: any) => x.action))}`);
});

await path('stop.unassign-team', 'schedule/route → No team: the stop goes back to unassigned, which is a real state', async (check) => {
  const db = await freshDb();
  const t = await saveTeam(lauren(db), B, { name: 'Team 3', memberNames: [] });
  if (!t.ok) { check(false, 'setup save refused'); return; }
  const s = await stop(db, B);
  await assignStopsTeam(lauren(db), B, [s], t.value.teamId);
  const r = await assignStopsTeam(lauren(db), B, [s], null);
  check(r.ok && r.value.assigned === 1, `unassign: ${JSON.stringify(r)}`);
  check(r.ok && r.value.teamName === null, 'unassigning claims a team name');
  const row = await one(db, `SELECT team_id FROM public.deliveries WHERE id = $1`, [s]);
  check(row.team_id === null, `stop still carries ${String(row.team_id)}`);
  const onScreen = await scheduled(db, s);
  check(onScreen?.team_id === null, 'the schedule still shows a team');
  const a = await audit(db, 'unassigned');
  check(a.length === 1 && a[0].action === 'stop.team_assigned', `the unassign is not recorded: ${JSON.stringify(a)}`);
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// GUARDS — the rules both writers hold, each proven by being refused
// ════════════════════════════════════════════════════════════════════════════════════════════

await guard('team.name-taken', 'two LIVE teams cannot share a name, ignoring case and spaces — a retired one may keep it', async (check) => {
  const db = await freshDb();
  const first = await saveTeam(lauren(db), B, { name: 'Team 1', memberNames: [] });
  if (!first.ok) { check(false, 'setup save refused'); return; }
  const dup = await saveTeam(lauren(db), B, { name: '  team 1  ', memberNames: [] });
  check(!dup.ok && dup.code === 'name_taken', `a duplicate name was accepted: ${JSON.stringify(dup)}`);
  check((await all(db, `SELECT id FROM public.teams`)).length === 1, 'a second team row was written anyway');
  // Retire the first, and the name frees up — because the retired row is no longer in the index.
  const team = (await listed(db)).find(t => t.id === first.value.teamId)!;
  await retireTeam(lauren(db), B, team);
  const again = await saveTeam(lauren(db), B, { name: 'Team 1', memberNames: [] });
  check(again.ok, `the name did not free up after retiring: ${JSON.stringify(again)}`);
});

await guard('team.duplicate-member', 'one person cannot be on a team twice — it is refused, never silently merged', async (check) => {
  const db = await freshDb();
  const r = await saveTeam(lauren(db), B, { name: 'Team 1', memberNames: ['Mauro', ' mauro '] });
  check(!r.ok && r.code === 'duplicate_member', `a duplicate member was accepted: ${JSON.stringify(r)}`);
  check((await all(db, `SELECT id FROM public.teams`)).length === 0, 'the team was written despite the refusal');
});

await guard('team.no-name', 'a team with no name is refused, and nothing is written', async (check) => {
  const db = await freshDb();
  const r = await saveTeam(lauren(db), B, { name: '   ', memberNames: ['Mauro'] });
  check(!r.ok && r.code === 'name_required', `a nameless team was accepted: ${JSON.stringify(r)}`);
  check((await all(db, `SELECT id FROM public.teams`)).length === 0, 'a nameless team row exists');
});

await guard('team.not-permitted', 'a member who cannot change deliveries cannot save a team or set one on a stop', async (check) => {
  const db = await freshDb();
  const t = await saveTeam(lauren(db), B, { name: 'Team 1', memberNames: [] });
  if (!t.ok) { check(false, 'setup save refused'); return; }
  const s = await stop(db, B);
  const save = await saveTeam(staffer(db), B, { name: 'Team 9', memberNames: [] });
  check(!save.ok && save.code === 'not_permitted', `staff saved a team: ${JSON.stringify(save)}`);
  const assign = await assignStopsTeam(staffer(db), B, [s], t.value.teamId);
  check(!assign.ok && assign.code === 'not_permitted', `staff set a team on a stop: ${JSON.stringify(assign)}`);
  check((await all(db, `SELECT id FROM public.teams`)).length === 1, 'staff wrote a team row');
  check((await one(db, `SELECT team_id FROM public.deliveries WHERE id = $1`, [s])).team_id === null, 'staff changed the stop');
});

await guard('team.other-business', 'a team belongs to its business: it cannot be read, edited, or put on another business\'s stop', async (check) => {
  const db = await freshDb();
  const t = await saveTeam(lauren(db), B, { name: 'Team 1', memberNames: ['Mauro'] });
  if (!t.ok) { check(false, 'setup save refused'); return; }
  // AC-3: the other business sees no row at all — not a refusal, nothing.
  const theirs = await readTeams(stranger(db), B2);
  check(theirs.ok && theirs.teams.length === 0, `the other business reads ${JSON.stringify(theirs)}`);
  const peek = await readTeams(stranger(db), B);
  check(peek.ok && peek.teams.length === 0, 'a stranger read this business\'s teams');
  // Their own member with full permissions still cannot reach our team by id.
  const steal = await saveTeam(stranger(db), B2, { id: t.value.teamId, name: 'Mine now', memberNames: [] });
  check(!steal.ok && steal.code === 'team_not_found', `a team was edited across businesses: ${JSON.stringify(steal)}`);
  check((await one(db, `SELECT name FROM public.teams WHERE id = $1`, [t.value.teamId])).name === 'Team 1', 'the team was renamed across businesses');
  // And our team cannot be put on their stop, nor theirs on ours.
  const theirStop = await stop(db, B2);
  const cross = await assignStopsTeam(lauren(db), B, [theirStop], t.value.teamId);
  check(!cross.ok && cross.code === 'stop_not_found', `a foreign stop was assigned: ${JSON.stringify(cross)}`);
  check((await one(db, `SELECT team_id FROM public.deliveries WHERE id = $1`, [theirStop])).team_id === null, 'the foreign stop was changed');
});

await guard('stop.assign-all-or-nothing', 'one bad id in the set assigns NONE of them — a half-split day is the defect', async (check) => {
  const db = await freshDb();
  const t = await saveTeam(lauren(db), B, { name: 'Team 1', memberNames: [] });
  if (!t.ok) { check(false, 'setup save refused'); return; }
  const good1 = await stop(db, B), good2 = await stop(db, B);
  const ghost = '99999999-0000-4000-8000-000000000999';
  const r = await assignStopsTeam(lauren(db), B, [good1, ghost, good2], t.value.teamId);
  check(!r.ok && r.code === 'stop_not_found', `a set with a bad id was accepted: ${JSON.stringify(r)}`);
  const rows = await all(db, `SELECT team_id FROM public.deliveries WHERE id = ANY($1::uuid[])`, [[good1, good2]]);
  check(rows.every((x: any) => x.team_id === null), `${rows.filter((x: any) => x.team_id).length} stop(s) were assigned anyway`);
  const a = await audit(db, t.value.teamId);
  check(a.filter((x: any) => x.action === 'stop.team_assigned').length === 0, 'a refused assign wrote an audit row');
});

await guard('stop.retired-team', 'a retired team cannot be put on a stop — it is off the list, so it is off the pickers', async (check) => {
  const db = await freshDb();
  const t = await saveTeam(lauren(db), B, { name: 'Old Crew', memberNames: [] });
  if (!t.ok) { check(false, 'setup save refused'); return; }
  const team = (await listed(db))[0];
  await retireTeam(lauren(db), B, team);
  const s = await stop(db, B);
  const r = await assignStopsTeam(lauren(db), B, [s], t.value.teamId);
  check(!r.ok && r.code === 'team_not_available', `a retired team was assigned: ${JSON.stringify(r)}`);
  check((await one(db, `SELECT team_id FROM public.deliveries WHERE id = $1`, [s])).team_id === null, 'the stop took the retired team');
});

await guard('stop.no-stops-chosen', 'an empty set is refused rather than quietly doing nothing', async (check) => {
  const db = await freshDb();
  const t = await saveTeam(lauren(db), B, { name: 'Team 1', memberNames: [] });
  if (!t.ok) { check(false, 'setup save refused'); return; }
  const r = await assignStopsTeam(lauren(db), B, [], t.value.teamId);
  check(!r.ok && r.code === 'nothing_to_assign', `an empty set returned: ${JSON.stringify(r)}`);
  check((await all(db, `SELECT id FROM public.audit_log WHERE action = 'stop.team_assigned'`)).length === 0, 'an empty assign wrote an audit row');
});

await guard('team.no-pay-side', 'the vendor link records WHO a team is and never what they are owed', async (check) => {
  const db = await freshDb();
  const v = await one(db, `INSERT INTO public.vendors (business_id, name) VALUES ($1, 'Mauro Landscaping') RETURNING id`, [B]);
  const r = await saveTeam(lauren(db), B, { name: 'Mauro Crew', vendorId: v.id, memberNames: ['Mauro'] });
  check(r.ok, `a contractor team was refused: ${JSON.stringify(r)}`);
  if (!r.ok) return;
  const cols = (await all(db, `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name IN ('teams', 'team_members')`)).map((c: any) => c.column_name);
  const money = cols.filter((c: string) => /rate|pay|wage|cost|price|amount|hourly/i.test(c));
  check(money.length === 0, `teams carry money columns: ${JSON.stringify(money)}`);
  const linked = await one(db, `SELECT vendor_id FROM public.teams WHERE id = $1`, [r.value.teamId]);
  check(linked.vendor_id === v.id, 'the contractor link was not kept');
  // Losing the vendor must never delete the team or orphan its stops.
  await db.query(`DELETE FROM public.vendors WHERE id = $1`, [v.id]);
  const after = await one(db, `SELECT id, vendor_id FROM public.teams WHERE id = $1`, [r.value.teamId]);
  check(after && after.vendor_id === null, `deleting the vendor took the team with it: ${JSON.stringify(after)}`);
});

console.log(failures ? `\n${failures} FAILED` : '\nall teams paths and guards pass');
process.exit(failures ? 1 : 0);
