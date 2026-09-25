/**
 * ── crew-day.paths — the crew day link, driven end to end (ledger #347) ──────────────────────────
 *
 * PURPOSE:      One `path` per capture path in `writer-registry.json` → domain `stop-progress`, and one
 *               `guard` per security rule the link must hold. Every crew call goes through the REAL
 *               endpoint (`api/members/invite.ts` → `handleCrewDay`) by way of the page's own functions
 *               (`readCrewDay`, `crewStopAction`, with `fetch` routed to the handler). Lauren's calls go
 *               through the functions her panel calls, as her (RLS on). Each result is read back from
 *               the database AND from what a person looks at: the crew page's day, and the schedule's
 *               stop status + "who tapped what" (`readStops`, `readStopEvents` → `stopActivity`).
 * DEPENDENCIES: scripts/path-tests/lib/liveDb.mjs (the LIVE schema on PGlite, RLS on) + migration
 *               20260917c applied on top. Synthetic data only.
 * OUTPUTS:      `PATH <id> PASS|FAIL` and `GUARD <id> PASS|FAIL` lines; exit 1 on any FAIL.
 */
import { openLiveDb, restClient, installSupabaseShim, closeLiveDbs } from './lib/liveDb.mjs';
import inviteHandler from '../../packages/cultivar-os/api/members/invite';
import { clientKey } from '../../packages/cultivar-os/api/members/crewDay';
import {
  createCrewDayLink, revokeCrewDayLink, readCrewDayLinks, readStopEvents, stopActivity,
  readCrewDay, crewStopAction,
} from '../../packages/cultivar-os/src/lib/crewDayLink';
import { readStops } from '../../packages/cultivar-os/src/lib/stopRead';
import { stopAct } from '../../packages/cultivar-os/src/lib/stopProgress';
import { saveRouteOrder, routeOrderLine, routeRefusalText } from '../../packages/cultivar-os/src/lib/routeOrder';
import { saveTeam, assignStopsTeam } from '../../packages/cultivar-os/src/lib/teams';
import { readFileSync } from 'node:fs';

process.env.SUPABASE_URL = 'http://pglite.test';
process.env.SUPABASE_SERVICE_KEY = 'service';
process.env.VITE_SUPABASE_ANON_KEY = 'anon';

const ROOT = process.env.PATH_TEST_ROOT ?? process.cwd();
// 🔴 NO MIGRATION REPLAY ANY MORE, AND THE REASON IS THE SNAPSHOT (2026-09-24, ledger #391).
// This chain was replayed on top of the fixture because the fixture was generated 2026-09-17 and
// predated every one of these migrations. It has since been refreshed from the live database, which
// carries them all — so replaying them now fails with `relation "delivery_teams" already exists`.
// The snapshot IS the record of what is applied (`npm run verify:snapshot-fresh`), so a path test
// that also replays an applied migration is asserting the same thing twice and breaking on the
// second. If a migration this test needs is NOT yet applied, add it back through
// `openLiveDb({ migrations: [...] })` — that option exists for exactly that case.
const MIGRATION = '';
const ONLY = process.env.PATH_ONLY ? new Set(process.env.PATH_ONLY.split(',')) : null;

const B = 'b0000000-0000-4000-8000-00000000000b';
const B2 = 'b0000000-0000-4000-8000-0000000000b2';
const OWNER = '0a000000-0000-4000-8000-000000000001';
const MANAGER = '0a000000-0000-4000-8000-000000000002';
const STAFF = '0a000000-0000-4000-8000-000000000003';
const OTHER_OWNER = '0a000000-0000-4000-8000-000000000009';
const LOT = '1a000000-0000-4000-8000-000000000001';
const TZ = 'America/Chicago';
const PRICE = 187.35;
const DEVICE = 'device-0000-test';

const MANAGER_PERMS = ['customers:read', 'orders:read', 'order_items:read', 'inventory:read', 'deliveries:read', 'deliveries:create', 'deliveries:update'];
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

// ── dates, in the link's time zone ────────────────────────────────────────────────────────────
function localYmd(offsetDays: number): string {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}
const DAY_X = localYmd(1);
const DAY_Y = localYmd(2);
const YESTERDAY = localYmd(-1);

// ── every response body the crew endpoint returns, for the no-price guard ─────────────────────
const crewBodies: unknown[] = [];
let currentIp = '203.0.113.7';

function fakeRes() {
  const r: any = { statusCode: 200, body: undefined, headers: {} as Record<string, string> };
  r.status = (c: number) => { r.statusCode = c; return r; };
  r.json = (b: unknown) => { r.body = b; return r; };
  r.setHeader = (k: string, v: string) => { r.headers[k.toLowerCase()] = v; return r; };
  r.end = () => r; r.send = (b: unknown) => { r.body = b; return r; };
  return r;
}

/** The crew page's `fetch`, routed to the real endpoint the way vercel.json routes it. */
async function routeFetch(url: string, init: any = {}) {
  if (!String(url).startsWith('/api/crew/day')) throw new Error(`unexpected fetch ${url}`);
  const res = fakeRes();
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries(init.headers ?? {})) headers[k.toLowerCase()] = String(v);
  headers['x-forwarded-for'] = currentIp;
  await inviteHandler({
    method: init.method ?? 'GET', headers,
    query: { _route: 'crew-day' },
    body: init.body ? JSON.parse(init.body) : undefined,
  }, res);
  crewBodies.push(res.body);
  return { ok: res.statusCode >= 200 && res.statusCode < 300, status: res.statusCode, json: async () => res.body } as any;
}
(globalThis as any).fetch = routeFetch;

/** A raw endpoint call, for status codes the page functions fold into a message. */
async function endpoint(method: 'GET' | 'POST', token: string, body?: Record<string, unknown>, ip = currentIp) {
  const res = fakeRes();
  await inviteHandler({ method, headers: { 'x-crew-token': token, 'x-forwarded-for': ip }, query: { _route: 'crew-day' }, body }, res);
  crewBodies.push(res.body);
  return res;
}

async function freshDb(opts: { writesOn?: boolean; withPerCrew?: boolean } = {}) {
  // 🔬 STEP 2 of the parked recon's plan: the ONLY migration the refreshed snapshot does NOT carry.
  // The snapshot's `crew_day_links` has no `team_id` and all three functions are the OLD arities,
  // so this one is genuinely unapplied — measured, not assumed.
  // `withPerCrew: false` opens the snapshot WITHOUT 20260921d — the state of David's live database
  // tonight. `openLiveDb` keys its cache on the migration list, so the two are separate databases.
  const db: any = opts.withPerCrew === false
    ? await openLiveDb()
    : await openLiveDb({ migrations: ['20260921d_crew_link_per_team.sql'] });
  installSupabaseShim(db);
  await db.exec(MIGRATION);
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${OWNER}', 'o@test.invalid'), ('${MANAGER}', 'm@test.invalid'),
      ('${STAFF}', 's@test.invalid'), ('${OTHER_OWNER}', 'x@test.invalid');
    INSERT INTO public.businesses (id, owner_id, name, business_type, qbo_writes_enabled)
      VALUES ('${B}', '${OWNER}', 'Path Test Nursery', 'nursery', ${opts.writesOn ? 'true' : 'false'}),
             ('${B2}', '${OTHER_OWNER}', 'Other Nursery', 'nursery', false);
    INSERT INTO public.business_members (business_id, user_id, name, role, permissions, active) VALUES
      ('${B}', '${MANAGER}', 'Lauren', 'MANAGER', '${JSON.stringify(MANAGER_PERMS)}', true),
      ('${B}', '${STAFF}', 'Staff', 'STAFF', '${JSON.stringify(STAFF_PERMS)}', true),
      ('${B2}', '${OTHER_OWNER}', 'Other', 'MANAGER', '${JSON.stringify(MANAGER_PERMS)}', true);
    INSERT INTO public.business_inventory (id, business_id, name, qty, status, sell_price, size)
      VALUES ('${LOT}', '${B}', 'Live Oak', 20, 'available', ${PRICE}, '30 gal');
  `);
  return db;
}
const one = async (db: any, sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows[0];
const all = async (db: any, sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows;
const lauren = (db: any) => restClient(db, { uid: MANAGER }) as any;

let seq = 0;
/** A stop with a customer and an order with one priced line — the shape LAWNS' Saturday stops have. */
async function stop(db: any, business: string, date: string, extra: { status?: string; completed_by_name?: string | null } = {}) {
  seq++;
  const c = await one(db, `INSERT INTO public.customers (business_id, first_name, last_name, phone, source, customer_type)
    VALUES ($1, $2, 'Smith', '512-555-01${String(seq).padStart(2, '0')}', 'test', 'person') RETURNING id`, [business, `Cust${seq}`])
    .catch(async () => one(db, `INSERT INTO public.customers (business_id, first_name, last_name, source, customer_type)
      VALUES ($1, $2, 'Smith', 'test', 'person') RETURNING id`, [business, `Cust${seq}`]));
  const o = await one(db, `INSERT INTO public.orders (business_id, customer_id, transport_method, status, subtotal, total_amount)
    VALUES ($1, $2, 'delivery', 'invoiced', $3, $3) RETURNING id`, [business, c.id, PRICE * 2]);
  await db.query(`INSERT INTO public.order_items (order_id, quantity, unit_price, subtotal, business_inventory_id, description, sku)
    VALUES ($1, 2, $2, $3, $4, 'Live Oak 30 gal', 'LO-30')`, [o.id, PRICE, PRICE * 2, business === B ? LOT : null]);
  const d = await one(db, `INSERT INTO public.deliveries (business_id, customer_id, delivery_date, address_line1, city, state, zip, status, notes, order_id, completed_by_name, completed_at)
    VALUES ($1, $2, $3, $4, 'Leander', 'TX', '78641', $5, 'Gate code 1234', $6, $7, $8) RETURNING id`,
    [business, c.id, date, `${100 + seq} Honeycomb Mesa`, extra.status ?? 'scheduled', o.id, extra.completed_by_name ?? null,
     extra.status === 'fulfilled' ? new Date().toISOString() : null]);
  return { id: d.id as string, orderId: o.id as string };
}

async function link(db: any, date = DAY_X, teamId: string | null = null) {
  const r = await createCrewDayLink(lauren(db), B, date, TZ, teamId);
  if (!r.ok) throw new Error(`link: ${r.code} ${r.message}`);
  return r.value;
}
const act = (token: string, stopId: string, action: any, name = 'Mike', note?: string) =>
  crewStopAction(token, { stopId, action, name, deviceId: DEVICE, note });

async function schedule(db: any, date: string) {
  const r = await readStops(lauren(db), B, { kind: 'day', date }, { readLines: true });
  if (!r.ok) throw new Error(`schedule read: ${r.error}`);
  return r.value;
}
async function activity(db: any, stopId: string) {
  const r = await readStopEvents(lauren(db), B, [stopId]);
  if (!r.ok) throw new Error(`events read: ${r.message}`);
  // The box is given the stop's CURRENT state, exactly as the schedule passes it (David, 2026-09-18).
  const st = await one(db, `SELECT started_at, status FROM public.deliveries WHERE id = $1`, [stopId]);
  return stopActivity(r.byStop.get(stopId) ?? [], st);
}
const audit = (db: any, target: string) => all(db, `SELECT action, actor_user_id, actor_role, outcome, detail FROM public.audit_log WHERE target_id = $1 ORDER BY created_at, action`, [target]);

// ════════════════════════════════════════════════════════════════════════════════════════════
// PATHS — each writer path, capture to database to screen
// ════════════════════════════════════════════════════════════════════════════════════════════

await path('crew.link-create', 'schedule → Crew link → Make link: a working link for that day; only a hash stored; an audit row', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const l = await link(db);
  check(/^[0-9a-f]{64}$/.test(l.token), `token shape ${l.token}`);
  const row = await one(db, `SELECT token_hash, service_date::text d, time_zone, to_char(expires_at AT TIME ZONE '${TZ}', 'YYYY-MM-DD HH24:MI') local_exp FROM public.crew_day_links WHERE id = $1`, [l.linkId]);
  check(row.token_hash !== l.token && row.token_hash.length === 64, 'the token itself is stored');
  check(row.d === DAY_X, `service_date ${row.d}`);
  const next = new Date(`${DAY_X}T12:00:00Z`); next.setUTCDate(next.getUTCDate() + 1);
  check(row.local_exp === `${next.toISOString().slice(0, 10)} 06:00`, `expires ${row.local_exp}, want 06:00 the next day`);
  const shown = await readCrewDayLinks(lauren(db), B, DAY_X);
  // `readCrewDayLinks` returns a LIST now (one live link per team), so this reads the list. It is
  // STRONGER than the row form it replaces: exactly one live link, and it is the one just made.
  check(shown.ok && shown.value.length === 1 && shown.value[0].id === l.linkId,
    `the schedule does not show exactly the live link just made: ${shown.ok ? JSON.stringify(shown.value.map(x => x.id)) : shown.code}`);
  const day = await readCrewDay(l.token);
  check(day.ok && day.value.stops.some(x => x.id === s.id), 'the link does not open the day');
  const a = await audit(db, l.linkId);
  check(a.length === 1 && a[0].action === 'crew_link.created' && a[0].actor_user_id === MANAGER && a[0].outcome === 'success', `audit ${JSON.stringify(a)}`);
  // Reissue: a second link for the day turns the first off.
  const l2 = await link(db);
  check(l2.replaced === 1, `replaced ${l2.replaced}`);
  const old = await readCrewDay(l.token);
  check(!old.ok && old.code === 'revoked', `old link after reissue: ${JSON.stringify(old)}`);
  const newer = await readCrewDay(l2.token);
  check(newer.ok, 'the reissued link does not work');
  const a2 = await audit(db, l.linkId);
  check(a2.some((x: any) => x.action === 'crew_link.revoked' && x.detail.reason === 'reissued'), 'no audit row for the replaced link');
  // Refusals: no permission; a past day.
  const staff = await createCrewDayLink(restClient(db, { uid: STAFF }) as any, B, DAY_X, TZ);
  check(!staff.ok && staff.code === 'not_permitted', `staff without deliveries:update: ${JSON.stringify(staff)}`);
  const past = await createCrewDayLink(lauren(db), B, YESTERDAY, TZ);
  check(!past.ok && past.code === 'past_day', `past day: ${JSON.stringify(past)}`);
  const badTz = await createCrewDayLink(lauren(db), B, DAY_X, 'Mars/Olympus');
  check(!badTz.ok && badTz.code === 'bad_time_zone', `bad zone: ${JSON.stringify(badTz)}`);
  const other = await createCrewDayLink(restClient(db, { uid: OTHER_OWNER }) as any, B, DAY_X, TZ);
  check(!other.ok && other.code === 'not_permitted', `another business's manager: ${JSON.stringify(other)}`);
});

await path('crew.link-revoke', 'schedule → Crew link → Turn off: the link stops working at once; an audit row', async (check) => {
  const db = await freshDb();
  await stop(db, B, DAY_X);
  const l = await link(db);
  const r = await revokeCrewDayLink(lauren(db), l.linkId);
  check(r.ok && !r.value.already, `revoke: ${JSON.stringify(r)}`);
  const res = await endpoint('GET', l.token);
  check(res.statusCode === 410 && res.body.code === 'revoked', `after revoke: ${res.statusCode} ${JSON.stringify(res.body)}`);
  const page = await readCrewDay(l.token);
  check(!page.ok && /Ask Lauren/.test(page.message), `page message: ${JSON.stringify(page)}`);
  const shown = await readCrewDayLinks(lauren(db), B, DAY_X);
  check(shown.ok && shown.value.length === 0, `the schedule still shows a live link: ${shown.ok ? JSON.stringify(shown.value.map(x => x.id)) : shown.code}`);
  const a = await audit(db, l.linkId);
  check(a.some((x: any) => x.action === 'crew_link.revoked' && x.detail.reason === 'revoked' && x.actor_user_id === MANAGER), `audit ${JSON.stringify(a)}`);
  const staff = await revokeCrewDayLink(restClient(db, { uid: STAFF }) as any, l.linkId);
  check(!staff.ok, 'staff without deliveries:update revoked a link');
});

await path('crew.start', 'crew page → Start: started_at set; the schedule shows who and when', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const l = await link(db);
  const r = await act(l.token, s.id, 'start');
  check(r.ok && r.value.changed && !!r.value.stop?.started_at, `start: ${JSON.stringify(r)}`);
  const row = await one(db, `SELECT status, started_at, completed_at FROM public.deliveries WHERE id = $1`, [s.id]);
  check(row.status === 'scheduled' && !!row.started_at && !row.completed_at, `row ${JSON.stringify(row)}`);
  const ev = await all(db, `SELECT action, actor_name, device_id, link_id FROM public.delivery_stop_events WHERE delivery_id = $1`, [s.id]);
  check(ev.length === 1 && ev[0].actor_name === 'Mike' && ev[0].device_id === DEVICE && ev[0].link_id === l.linkId, `events ${JSON.stringify(ev)}`);
  const act1 = await activity(db, s.id);
  check(act1.started?.by === 'Mike' && !act1.done, `schedule activity ${JSON.stringify(act1)}`);
  const again = await act(l.token, s.id, 'start');
  check(again.ok && !again.value.changed, 'a second Start changed something');
  const a = await audit(db, s.id);
  check(a.length === 2 && a.every((x: any) => x.action === 'crew_stop.start' && x.actor_role === 'crew_link' && x.detail.actor_name === 'Mike' && x.detail.device_id === DEVICE)
    && a[1].outcome === 'no_change', `audit ${JSON.stringify(a)}`);
});

await path('crew.done', 'crew page → Done: stop done with the name, review ask HELD, order untouched; the schedule shows Done by Mike', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const l = await link(db);
  await act(l.token, s.id, 'start');
  const r = await act(l.token, s.id, 'done');
  check(r.ok && r.value.changed && r.value.stop?.completed_by_name === 'Mike' && r.value.stop?.status === 'fulfilled', `done: ${JSON.stringify(r)}`);
  const row = await one(db, `SELECT status, started_at, completed_at, completed_by_name, review_ask_held_at, review_asked_at FROM public.deliveries WHERE id = $1`, [s.id]);
  check(row.status === 'fulfilled' && !!row.completed_at && row.completed_by_name === 'Mike', `row ${JSON.stringify(row)}`);
  check(row.started_at !== row.completed_at, 'the real start was overwritten');
  check(!!row.review_ask_held_at && row.review_asked_at === null, 'review ask not held, or marked asked');
  const order = await one(db, `SELECT status FROM public.orders WHERE id = $1`, [s.orderId]);
  check(order.status === 'invoiced', `the order moved to ${order.status}`);
  const sch = await schedule(db, DAY_X);
  check(sch.stops.find(x => x.id === s.id)?.status === 'fulfilled', 'the schedule does not show the stop done');
  const act1 = await activity(db, s.id);
  check(act1.done?.by === 'Mike' && act1.started?.by === 'Mike', `schedule activity ${JSON.stringify(act1)}`);
  const a = await audit(db, s.id);
  check(a.some((x: any) => x.action === 'crew_stop.done' && x.outcome === 'success'), `audit ${JSON.stringify(a)}`);
  const noName = await endpoint('POST', l.token, { action: 'done', stopId: s.id, name: '  ', deviceId: DEVICE });
  check(noName.statusCode === 400 && noName.body.code === 'name_required', `no name: ${noName.statusCode} ${JSON.stringify(noName.body)}`);
});

await path('crew.undo-done', 'crew page → Undo: a Done is reopened the same day; a stop completed outside these taps is not', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const office = await stop(db, B, DAY_X, { status: 'fulfilled' });   // imported history: no name on it
  const l = await link(db);
  await act(l.token, s.id, 'done');
  const r = await act(l.token, s.id, 'undo_done', 'Mike');
  check(r.ok && r.value.changed && r.value.stop?.status === 'scheduled', `undo: ${JSON.stringify(r)}`);
  const row = await one(db, `SELECT status, started_at, completed_at, completed_by_name, review_ask_held_at FROM public.deliveries WHERE id = $1`, [s.id]);
  check(row.status === 'scheduled' && row.completed_at === null && row.started_at === null && row.completed_by_name === null && row.review_ask_held_at === null, `row ${JSON.stringify(row)}`);
  const act1 = await activity(db, s.id);
  check(act1.done === null, `schedule still shows Done: ${JSON.stringify(act1)}`);
  const sch = await schedule(db, DAY_X);
  check(sch.stops.find(x => x.id === s.id)?.status === 'scheduled', 'the schedule does not show the stop reopened');
  const refused = await endpoint('POST', l.token, { action: 'undo_done', stopId: office.id, name: 'Mike', deviceId: DEVICE });
  check(refused.statusCode === 409 && refused.body.code === 'not_undoable', `an imported stop: ${refused.statusCode} ${JSON.stringify(refused.body)}`);
  const officeRow = await one(db, `SELECT status FROM public.deliveries WHERE id = $1`, [office.id]);
  check(officeRow.status === 'fulfilled', 'an imported fulfilled stop was reopened');
  const a = await audit(db, s.id);
  check(a.some((x: any) => x.action === 'crew_stop.undo_done' && x.outcome === 'success'), `audit ${JSON.stringify(a)}`);
});

await path('crew.note', 'crew page → Note: the note is kept with the name; the crew page and the schedule show it', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const l = await link(db);
  const r = await act(l.token, s.id, 'note', 'Mike', 'Customer asked for the tree left of the drive');
  check(r.ok && r.value.stop?.notes.some(n => n.note === 'Customer asked for the tree left of the drive' && n.by === 'Mike'), `note: ${JSON.stringify(r)}`);
  const day = await readCrewDay(l.token);
  check(day.ok && day.value.stops.find(x => x.id === s.id)?.notes.length === 1, 'the crew page does not show the note');
  const act1 = await activity(db, s.id);
  check(act1.notes.length === 1 && act1.notes[0].by === 'Mike', `schedule notes ${JSON.stringify(act1)}`);
  const row = await one(db, `SELECT status, started_at FROM public.deliveries WHERE id = $1`, [s.id]);
  check(row.status === 'scheduled' && row.started_at === null, 'a note moved the stop');
  const empty = await endpoint('POST', l.token, { action: 'note', stopId: s.id, name: 'Mike', deviceId: DEVICE, note: '   ' });
  check(empty.statusCode === 400 && empty.body.code === 'note_required', `empty note: ${empty.statusCode}`);
  const a = await audit(db, s.id);
  check(a.some((x: any) => x.action === 'crew_stop.note' && x.detail.note === 'Customer asked for the tree left of the drive'), `audit ${JSON.stringify(a)}`);
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// THE OFFICE DOOR — the same writer, reached from Lauren's own session (David, 2026-09-17)
// ════════════════════════════════════════════════════════════════════════════════════════════

await path('office.start', 'schedule → Start this stop: started_at set, the member\'s own name recorded', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const r = await stopAct(lauren(db), B, s.id, 'start');
  check(r.ok && r.changed && !!r.stop?.started_at, `start: ${JSON.stringify(r)}`);
  const row = await one(db, `SELECT status, started_at FROM public.deliveries WHERE id = $1`, [s.id]);
  check(row.status === 'scheduled' && !!row.started_at, `row ${JSON.stringify(row)}`);
  const act1 = await activity(db, s.id);
  check(act1.started?.by === 'Lauren', `the schedule shows ${JSON.stringify(act1)}`);
  const ev = await one(db, `SELECT actor_user_id, device_id, link_id FROM public.delivery_stop_events WHERE delivery_id = $1`, [s.id]);
  check(ev.actor_user_id === MANAGER && ev.device_id === 'app-session' && ev.link_id === null, `event ${JSON.stringify(ev)}`);
  const staff = await stopAct(restClient(db, { uid: STAFF }) as any, B, s.id, 'done');
  check(!staff.ok && staff.code === 'not_permitted', `staff without deliveries:update: ${JSON.stringify(staff)}`);
  const other = await stopAct(restClient(db, { uid: OTHER_OWNER }) as any, B, s.id, 'done');
  check(!other.ok && other.code === 'not_permitted', `another business's manager: ${JSON.stringify(other)}`);
  const stillScheduled = await one(db, `SELECT status FROM public.deliveries WHERE id = $1`, [s.id]);
  check(stillScheduled.status === 'scheduled', 'a refused office tap changed the stop');
});

await path('office.done', 'schedule → Mark done: the stop is done, the review ask is HELD and nothing is sent, the order does not move', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const r = await stopAct(lauren(db), B, s.id, 'done');
  check(r.ok && r.changed && r.stop?.status === 'fulfilled' && r.stop?.completed_by_name === 'Lauren', `done: ${JSON.stringify(r)}`);
  const row = await one(db, `SELECT status, completed_at, completed_by_name, review_ask_held_at, review_asked_at, review_ask_outcome FROM public.deliveries WHERE id = $1`, [s.id]);
  check(row.status === 'fulfilled' && row.completed_by_name === 'Lauren', `row ${JSON.stringify(row)}`);
  // 🔴 THE RULING: the ask is HELD, never spent — no review_asked_at, no outcome, nothing sent.
  check(!!row.review_ask_held_at && row.review_asked_at === null && row.review_ask_outcome === null, `the ask was spent, not held: ${JSON.stringify(row)}`);
  const order = await one(db, `SELECT status FROM public.orders WHERE id = $1`, [s.orderId]);
  check(order.status === 'invoiced', `the order moved to ${order.status}`);
  const sch = await schedule(db, DAY_X);
  check(sch.stops.find(x => x.id === s.id)?.status === 'fulfilled', 'the schedule does not show it done');
  const again = await stopAct(lauren(db), B, s.id, 'done');
  check(again.ok && !again.changed, 'a second Mark done changed something');
  const a = await audit(db, s.id);
  check(a.some((x: any) => x.action === 'crew_stop.done' && x.actor_user_id === MANAGER && x.actor_role === 'MANAGER'), `audit ${JSON.stringify(a)}`);
});

await path('office.undo-done', 'schedule → Undo done: the office can reopen its own Done; a stop completed outside these taps cannot be reopened', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const imported = await stop(db, B, DAY_X, { status: 'fulfilled' });   // an R-37 history stop: no name
  await stopAct(lauren(db), B, s.id, 'done');
  const r = await stopAct(lauren(db), B, s.id, 'undo_done');
  check(r.ok && r.changed && r.stop?.status === 'scheduled', `undo: ${JSON.stringify(r)}`);
  const row = await one(db, `SELECT status, completed_at, completed_by_name, review_ask_held_at FROM public.deliveries WHERE id = $1`, [s.id]);
  check(row.status === 'scheduled' && row.completed_at === null && row.completed_by_name === null && row.review_ask_held_at === null, `row ${JSON.stringify(row)}`);
  check((await activity(db, s.id)).done === null, 'the schedule still shows Done');
  const refusedImport = await stopAct(lauren(db), B, imported.id, 'undo_done');
  check(!refusedImport.ok && refusedImport.code === 'not_undoable', `an imported stop: ${JSON.stringify(refusedImport)}`);
  // A stop whose review WAS asked (before this build) cannot be reopened either — the ask is spent.
  const asked = await stop(db, B, DAY_X);
  await stopAct(lauren(db), B, asked.id, 'done');
  await db.query(`UPDATE public.deliveries SET review_asked_at = now(), review_ask_outcome = 'shown' WHERE id = $1`, [asked.id]);
  const refusedAsked = await stopAct(lauren(db), B, asked.id, 'undo_done');
  check(!refusedAsked.ok && refusedAsked.code === 'not_undoable' && /review was already asked/i.test(refusedAsked.message), `an asked stop: ${JSON.stringify(refusedAsked)}`);
});

await guard('crew.both-doors-agree', 'the crew link and the office write the same columns, events and audit for the same tap', async (check) => {
  const viaCrew = await freshDb();
  const c = await stop(viaCrew, B, DAY_X);
  const l = await link(viaCrew);
  await act(l.token, c.id, 'done');
  const crewRow = await one(viaCrew, `SELECT status, completed_at IS NOT NULL done_at, completed_by_name IS NOT NULL named, review_ask_held_at IS NOT NULL held, review_asked_at FROM public.deliveries WHERE id = $1`, [c.id]);
  const crewEv = await one(viaCrew, `SELECT action, actor_name IS NOT NULL named FROM public.delivery_stop_events WHERE delivery_id = $1`, [c.id]);

  const viaOffice = await freshDb();
  const o = await stop(viaOffice, B, DAY_X);
  await stopAct(lauren(viaOffice), B, o.id, 'done');
  const officeRow = await one(viaOffice, `SELECT status, completed_at IS NOT NULL done_at, completed_by_name IS NOT NULL named, review_ask_held_at IS NOT NULL held, review_asked_at FROM public.deliveries WHERE id = $1`, [o.id]);
  const officeEv = await one(viaOffice, `SELECT action, actor_name IS NOT NULL named FROM public.delivery_stop_events WHERE delivery_id = $1`, [o.id]);

  check(JSON.stringify(crewRow) === JSON.stringify(officeRow), `the two doors disagree: crew ${JSON.stringify(crewRow)} vs office ${JSON.stringify(officeRow)}`);
  check(JSON.stringify(crewEv) === JSON.stringify(officeEv), `the event rows disagree: ${JSON.stringify(crewEv)} vs ${JSON.stringify(officeEv)}`);
  check(crewRow.review_asked_at === null && officeRow.review_asked_at === null, 'a tap spent the review ask');
  const crewAudit = (await audit(viaCrew, c.id)).map((x: any) => x.action).join();
  const officeAudit = (await audit(viaOffice, o.id)).map((x: any) => x.action).join();
  check(crewAudit === officeAudit && crewAudit === 'crew_stop.done', `audit actions differ: ${crewAudit} vs ${officeAudit}`);
  // NEGATIVE CONTROL: the two doors are genuinely different callers — one has a link and a user, the
  // other has neither, so the comparison above is not one row compared with itself.
  const crewWho = await one(viaCrew, `SELECT link_id IS NOT NULL linked, actor_user_id IS NOT NULL who FROM public.delivery_stop_events WHERE delivery_id = $1`, [c.id]);
  const officeWho = await one(viaOffice, `SELECT link_id IS NOT NULL linked, actor_user_id IS NOT NULL who FROM public.delivery_stop_events WHERE delivery_id = $1`, [o.id]);
  check(crewWho.linked === true && crewWho.who === false && officeWho.linked === false && officeWho.who === true,
    `the doors are not distinguishable: ${JSON.stringify(crewWho)} vs ${JSON.stringify(officeWho)}`);
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// THE ROUTE ORDER — saved once, read by the phone, the schedule and the day sheet (ledger #351)
// ════════════════════════════════════════════════════════════════════════════════════════════

await path('route.save', 'Route this day → the optimised order is saved, and every surface reads THAT order', async (check) => {
  const db = await freshDb();
  const a = await stop(db, B, DAY_X);      // created first
  const b = await stop(db, B, DAY_X);      // second
  const c = await stop(db, B, DAY_X);      // third
  // The optimiser's answer is deliberately NOT the creation order — otherwise this test could pass
  // on a read that ignores the saved sequence entirely.
  const planned = [c.id, a.id, b.id];
  const out = await saveRouteOrder(lauren(db), B, DAY_X, planned);
  check(out.ok && out.saved === 3 && !!out.routedAt, `save: ${JSON.stringify(out)}`);

  const rows = await all(db, `SELECT id, route_position, routed_at, routed_by FROM public.deliveries WHERE business_id = $1 AND delivery_date = $2 ORDER BY route_position`, [B, DAY_X]);
  check(rows.map((r: any) => r.id).join() === planned.join(), `stored order ${JSON.stringify(rows.map((r: any) => r.route_position))}`);
  check(rows.every((r: any) => r.routed_by === MANAGER && !!r.routed_at), 'who and when were not stamped on every stop');

  // (a) the SCHEDULE and the printed day sheet — both read through this one function.
  const sch = await schedule(db, DAY_X);
  check(sch.stops.map(x => x.id).join() === planned.join(), `the schedule shows ${sch.stops.map(x => x.id.slice(0, 4)).join()}`);
  check(sch.stops[0].route_position === 1 && sch.stops[2].route_position === 3, 'the schedule did not read the positions');

  // (b) the CREW PAGE, through the real endpoint.
  const l = await link(db);
  const day = await readCrewDay(l.token);
  check(day.ok && day.value.stops.map(x => x.id).join() === planned.join(), `the crew page shows ${day.ok ? day.value.stops.map(x => x.id.slice(0, 4)).join() : day.code}`);
  check(day.ok && !!day.value.routed_at, 'the crew page was not told the day is planned');
  check(day.ok && /^route order · planned /.test(routeOrderLine(day.value.routed_at, 'crew')), `the crew page's line reads "${day.ok ? routeOrderLine(day.value.routed_at, 'crew') : ''}"`);

  const audit = await all(db, `SELECT action, actor_user_id, detail FROM public.audit_log WHERE target_type = 'delivery_day' AND target_id = $1`, [DAY_X]);
  check(audit.length === 1 && audit[0].action === 'route.saved' && audit[0].actor_user_id === MANAGER && audit[0].detail.stops === 3, `audit ${JSON.stringify(audit)}`);

  // RE-ROUTING REPLACES — a new order, a new stamp, and a stop dropped from the plan loses its place.
  const firstStamp = rows[0].routed_at;
  await new Promise(r => setTimeout(r, 5));
  const again = await saveRouteOrder(lauren(db), B, DAY_X, [b.id, a.id]);
  check(again.ok && again.saved === 2 && again.droppedFromPlan === 1, `re-route: ${JSON.stringify(again)}`);
  const after = await all(db, `SELECT id, route_position, routed_at FROM public.deliveries WHERE business_id = $1 AND delivery_date = $2 ORDER BY route_position NULLS LAST, created_at`, [B, DAY_X]);
  check(after[0].id === b.id && after[0].route_position === 1 && after[1].id === a.id && after[1].route_position === 2, `after re-route ${JSON.stringify(after.map((r: any) => r.route_position))}`);
  check(after[2].id === c.id && after[2].route_position === null && after[2].routed_at === null, 'the dropped stop kept its place in the plan');
  check(after[0].routed_at !== firstStamp, 'the re-route did not re-stamp when it was planned');
  const sch2 = await schedule(db, DAY_X);
  check(sch2.stops.map(x => x.id).join() === [b.id, a.id, c.id].join(), `the schedule did not follow the new plan: ${sch2.stops.map(x => x.id.slice(0, 4)).join()}`);

  // The SAME order routed again is a new plan: it is re-stamped, not skipped (David: re-routing
  // records who and when). The page resets its de-dup on every fresh Route press to reach this.
  const before = (await one(db, `SELECT routed_at FROM public.deliveries WHERE id = $1`, [b.id])).routed_at;
  await new Promise(r => setTimeout(r, 5));
  const same = await saveRouteOrder(lauren(db), B, DAY_X, [b.id, a.id]);
  const afterSame = (await one(db, `SELECT routed_at, route_position FROM public.deliveries WHERE id = $1`, [b.id]));
  check(same.ok && afterSame.route_position === 1 && afterSame.routed_at !== before, `an identical re-route did not re-stamp: ${before} → ${afterSame.routed_at}`);

    // Permission is checked SERVER-side, not by hiding a button.
  const staff = await saveRouteOrder(restClient(db, { uid: STAFF }) as any, B, DAY_X, [a.id, b.id]);
  check(!staff.ok && staff.code === 'not_permitted', `staff without deliveries:update: ${JSON.stringify(staff)}`);
  const stillB = await one(db, `SELECT route_position FROM public.deliveries WHERE id = $1`, [b.id]);
  check(stillB.route_position === 1, 'a refused save changed the plan');
});

await guard('route.only-this-day-and-business', 'a route naming another day\'s or another business\'s stop is refused whole', async (check) => {
  const db = await freshDb();
  const x1 = await stop(db, B, DAY_X);
  const x2 = await stop(db, B, DAY_X);
  const y = await stop(db, B, DAY_Y);           // another day
  const theirs = await stop(db, B2, DAY_X);     // another business
  await saveRouteOrder(lauren(db), B, DAY_X, [x1.id, x2.id]);

  const otherDay = await saveRouteOrder(lauren(db), B, DAY_X, [x1.id, y.id]);
  check(!otherDay.ok && otherDay.code === 'not_on_this_day', `another day's stop: ${JSON.stringify(otherDay)}`);
  const otherBiz = await saveRouteOrder(lauren(db), B, DAY_X, [x1.id, theirs.id]);
  check(!otherBiz.ok && otherBiz.code === 'not_on_this_day', `another business's stop: ${JSON.stringify(otherBiz)}`);
  const dup = await saveRouteOrder(lauren(db), B, DAY_X, [x1.id, x1.id]);
  check(!dup.ok && dup.code === 'duplicate_stop', `the same stop twice: ${JSON.stringify(dup)}`);
  const none = await saveRouteOrder(lauren(db), B, DAY_X, []);
  check(!none.ok && none.code === 'nothing_to_save', `an empty route: ${JSON.stringify(none)}`);

  // NOTHING was written by any of the four refusals — the first plan still stands, untouched.
  const rows = await all(db, `SELECT id, route_position FROM public.deliveries WHERE business_id = $1 AND delivery_date = $2 ORDER BY route_position NULLS LAST, created_at`, [B, DAY_X]);
  check(rows[0].id === x1.id && rows[0].route_position === 1 && rows[1].route_position === 2, `the plan changed: ${JSON.stringify(rows.map((r: any) => r.route_position))}`);
  const untouched = await one(db, `SELECT route_position, routed_at FROM public.deliveries WHERE id = $1`, [y.id]);
  check(untouched.route_position === null && untouched.routed_at === null, 'another day\'s stop was written');
  const notMine = await one(db, `SELECT route_position FROM public.deliveries WHERE id = $1`, [theirs.id]);
  check(notMine.route_position === null, 'another business\'s stop was written');
});

await guard('route.no-unplanned-claim', 'a day nobody routed never claims a plan — on the phone or on the schedule', async (check) => {
  const db = await freshDb();
  const a = await stop(db, B, DAY_X);
  const b = await stop(db, B, DAY_X);
  const l = await link(db);
  const day = await readCrewDay(l.token);
  check(day.ok && (day.value.routed_at ?? null) === null, `an unrouted day reported routed_at ${day.ok ? day.value.routed_at : day.code}`);
  check(day.ok && day.value.stops.map(x => x.id).join() === [a.id, b.id].join(), 'an unrouted day is not in creation order');
  check(day.ok && day.value.stops.every(x => (x.route_position ?? null) === null), 'an unrouted stop carries a position');
  check(routeOrderLine(null, 'crew') === 'Not the planned route — follow the order in Lauren’s text.', `the crew's not-routed line reads "${routeOrderLine(null, 'crew')}"`);
  check(routeOrderLine(null, 'office') === 'Not routed yet — press Route this day.', `Lauren's not-routed line reads "${routeOrderLine(null, 'office')}"`);
  check(/^route order · planned /.test(routeOrderLine('2026-09-18T14:12:00Z', 'crew')), 'a planned day is not announced as planned');
  // NEGATIVE CONTROL: the sentences are genuinely different, so the assertions above are not
  // comparing one string with itself.
  check(routeOrderLine(null, 'crew') !== routeOrderLine('2026-09-18T14:12:00Z', 'crew'), 'the planned and unplanned lines are the same string');
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// GUARDS — what the link must refuse
// ════════════════════════════════════════════════════════════════════════════════════════════

await guard('crew.box-follows-stop', 'the schedule never shows a Started or Done the stop no longer has — the tap stays in the log', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const l = await link(db);
  await act(l.token, s.id, 'start');
  check((await activity(db, s.id)).started?.by === 'Mike', 'a real start is not shown');
  // What 20260918a did on LAWNS: a TEST start cleared by hand. The tap stays in the log …
  await db.query(`UPDATE public.deliveries SET started_at = NULL WHERE id = $1`, [s.id]);
  const events = await one(db, `SELECT count(*)::int n FROM public.delivery_stop_events WHERE delivery_id = $1 AND action = 'start'`, [s.id]);
  check(events.n === 1, 'the tap log lost the start — it is append-only and must keep it');
  // … and the box no longer restates it.
  const after = await activity(db, s.id);
  check(after.started === null, `the box still says Started beside a stop that is not started: ${JSON.stringify(after)}`);
  // A Done the stop no longer has is not shown either (the office reopened it by hand).
  await act(l.token, s.id, 'start');
  await act(l.token, s.id, 'done');
  check((await activity(db, s.id)).done?.by === 'Mike', 'a real Done is not shown');
  await db.query(`UPDATE public.deliveries SET status = 'scheduled', completed_at = NULL WHERE id = $1`, [s.id]);
  check((await activity(db, s.id)).done === null, 'the box still says Done beside a stop that is not done');
  // NEGATIVE CONTROL: notes carry no state and are never hidden.
  await act(l.token, s.id, 'note', 'Mike', 'gate code 42');
  check((await activity(db, s.id)).notes.length === 1, 'a note was hidden');
});

await guard('crew.expired', 'an expired link reads nothing and changes nothing', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const l = await link(db);
  await db.query(`UPDATE public.crew_day_links SET expires_at = now() - interval '1 second' WHERE id = $1`, [l.linkId]);
  const read = await endpoint('GET', l.token);
  check(read.statusCode === 410 && read.body.code === 'expired' && !read.body.stops, `read: ${read.statusCode} ${JSON.stringify(read.body)}`);
  const w = await endpoint('POST', l.token, { action: 'done', stopId: s.id, name: 'Mike', deviceId: DEVICE });
  check(w.statusCode === 410, `write: ${w.statusCode}`);
  const row = await one(db, `SELECT status FROM public.deliveries WHERE id = $1`, [s.id]);
  check(row.status === 'scheduled', 'an expired link changed the stop');
});

await guard('crew.revoked', 'a revoked link reads nothing and changes nothing', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const l = await link(db);
  await revokeCrewDayLink(lauren(db), l.linkId);
  const read = await endpoint('GET', l.token);
  check(read.statusCode === 410 && read.body.code === 'revoked' && !read.body.stops, `read: ${read.statusCode}`);
  const w = await endpoint('POST', l.token, { action: 'start', stopId: s.id, name: 'Mike', deviceId: DEVICE });
  check(w.statusCode === 410, `write: ${w.statusCode}`);
  const row = await one(db, `SELECT started_at FROM public.deliveries WHERE id = $1`, [s.id]);
  check(row.started_at === null, 'a revoked link changed the stop');
  const bogus = await endpoint('GET', 'f'.repeat(64));
  check(bogus.statusCode === 404 && !bogus.body.stops, `unknown token: ${bogus.statusCode}`);
  const none = await endpoint('GET', '');
  check(none.statusCode === 404, `no token: ${none.statusCode}`);
});

await guard('crew.other-day', 'a link for day X shows nothing from day Y and cannot act on it', async (check) => {
  const db = await freshDb();
  const x = await stop(db, B, DAY_X);
  const y = await stop(db, B, DAY_Y);
  const lx = await link(db, DAY_X);
  const read = await readCrewDay(lx.token);
  check(read.ok && read.value.service_date === DAY_X, 'wrong day');
  check(read.ok && read.value.stops.map(s => s.id).join() === x.id, `stops ${read.ok ? read.value.stops.map(s => s.id) : read.code}`);
  const w = await endpoint('POST', lx.token, { action: 'done', stopId: y.id, name: 'Mike', deviceId: DEVICE });
  check(w.statusCode === 404 && w.body.code === 'not_on_this_day', `act on Y: ${w.statusCode} ${JSON.stringify(w.body)}`);
  const row = await one(db, `SELECT status FROM public.deliveries WHERE id = $1`, [y.id]);
  check(row.status === 'scheduled', 'day Y changed');
  const junk = await endpoint('POST', lx.token, { action: 'done', stopId: 'not-a-uuid', name: 'Mike', deviceId: DEVICE });
  check(junk.statusCode === 404, `malformed stop id: ${junk.statusCode}`);
});

await guard('crew.other-business', 'a link for one business shows nothing of another, and cannot act on it', async (check) => {
  const db = await freshDb();
  const mine = await stop(db, B, DAY_X);
  const theirs = await stop(db, B2, DAY_X);
  const l = await link(db, DAY_X);
  const read = await readCrewDay(l.token);
  check(read.ok && read.value.stops.length === 1 && read.value.stops[0].id === mine.id, 'another business\'s stop is on the page');
  check(read.ok && !JSON.stringify(read.value).includes('Other Nursery'), 'another business is named');
  const w = await endpoint('POST', l.token, { action: 'start', stopId: theirs.id, name: 'Mike', deviceId: DEVICE });
  check(w.statusCode === 404, `act on the other business: ${w.statusCode}`);
  const row = await one(db, `SELECT started_at FROM public.deliveries WHERE id = $1`, [theirs.id]);
  check(row.started_at === null, 'the other business\'s stop changed');
  // Direct database calls with the public key or a login are refused: only the endpoint may call.
  for (const role of ['anon', 'authenticated']) {
    let refused = false;
    try {
      await db.transaction(async (tx: any) => {
        await tx.exec(`SET LOCAL ROLE ${role}`);
        await tx.query(`SELECT public.crew_day_read($1, 'x')`, [l.token]);
      });
    } catch (e: any) { refused = /permission denied/i.test(e.message); }
    check(refused, `${role} called crew_day_read directly`);
  }
  // Lauren's own session cannot read another business's links or events.
  const otherLinks = await readCrewDayLinks(restClient(db, { uid: OTHER_OWNER }) as any, B, DAY_X);
  check(otherLinks.ok && otherLinks.value.length === 0,
    `another business read this business's link: ${otherLinks.ok ? JSON.stringify(otherLinks.value.map(x => x.id)) : otherLinks.code}`);
});

await guard('crew.no-prices', 'no response carries a price, total, discount or cost — not as a key, not as a value', async (check) => {
  const db = await freshDb();
  const s = await stop(db, B, DAY_X);
  const l = await link(db);
  crewBodies.length = 0;
  const day = await readCrewDay(l.token);
  check(day.ok && day.value.stops[0].lines.length === 1 && day.value.stops[0].lines[0].quantity === 2, `lines ${JSON.stringify(day)}`);
  check(day.ok && day.value.stops[0].lines[0].item === 'Live Oak' && day.value.stops[0].lines[0].size === '30 gal', 'the line does not name the item');
  await act(l.token, s.id, 'start');
  await act(l.token, s.id, 'note', 'Mike', 'ok');
  await act(l.token, s.id, 'done');
  await act(l.token, s.id, 'undo_done');
  const bad = /price|total|amount|subtotal|discount|cost|leakage|tax/i;
  const keys: string[] = [];
  const walk = (v: unknown) => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (bad.test(k)) keys.push(k); walk(x); }
  };
  crewBodies.forEach(walk);
  check(crewBodies.length >= 5, `only ${crewBodies.length} bodies captured`);
  check(keys.length === 0, `price-like keys: ${keys.join(', ')}`);
  const text = JSON.stringify(crewBodies);
  check(!text.includes(String(PRICE)) && !text.includes(String(PRICE * 2)), 'a price value is in a response');
});

await guard('crew.rate-limit', 'more than 60 calls a minute from one client is refused with 429; another client is not', async (check) => {
  const db = await freshDb();
  await stop(db, B, DAY_X);
  const l = await link(db);
  const key = clientKey({ headers: { 'x-forwarded-for': '198.51.100.9' } });
  await db.query(`INSERT INTO public.crew_link_rate (client_key, window_start, hits)
    VALUES ($1, date_trunc('minute', now()), 59), ($1, date_trunc('minute', now()) + interval '1 minute', 59)`, [key]);
  const sixtieth = await endpoint('GET', l.token, undefined, '198.51.100.9');
  check(sixtieth.statusCode === 200, `the 60th call: ${sixtieth.statusCode}`);
  await db.query(`UPDATE public.crew_link_rate SET hits = 60 WHERE client_key = $1`, [key]);
  const over = await endpoint('GET', l.token, undefined, '198.51.100.9');
  check(over.statusCode === 429 && over.headers['retry-after'] === '60' && !over.body.stops, `the 61st call: ${over.statusCode}`);
  const overWrite = await endpoint('POST', l.token, { action: 'note', stopId: '00000000-0000-4000-8000-000000000000', name: 'x', deviceId: DEVICE, note: 'x' }, '198.51.100.9');
  check(overWrite.statusCode === 429, `a write over the limit: ${overWrite.statusCode}`);
  const guessing = await endpoint('GET', 'a'.repeat(64), undefined, '198.51.100.9');
  check(guessing.statusCode === 429, `a guessed token over the limit: ${guessing.statusCode} (guesses must be counted too)`);
  const other = await endpoint('GET', l.token, undefined, '198.51.100.10');
  check(other.statusCode === 200, `another client: ${other.statusCode}`);
  // Refusals are counted (a raise would roll the count back).
  const k2 = clientKey({ headers: { 'x-forwarded-for': '198.51.100.11' } });
  await endpoint('GET', 'b'.repeat(64), undefined, '198.51.100.11');
  const counted = await one(db, `SELECT coalesce(sum(hits), 0)::int n FROM public.crew_link_rate WHERE client_key = $1`, [k2]);
  check(counted.n === 1, `a refused call was not counted (${counted.n})`);
});

await guard('crew.no-stock-or-order', 'test mode and live mode: nothing here writes the stock ledger, stock, or the order', async (check) => {
  for (const writesOn of [false, true]) {
    const db = await freshDb({ writesOn });
    const s = await stop(db, B, DAY_X);
    const before = await one(db, `SELECT (SELECT count(*) FROM public.business_inventory_ledger)::int ledger,
      (SELECT qty FROM public.business_inventory WHERE id = '${LOT}')::int qty,
      (SELECT status FROM public.orders WHERE id = '${s.orderId}') order_status,
      (SELECT count(*) FROM public.order_items)::int lines`);
    const l = await link(db);
    await act(l.token, s.id, 'start');
    await act(l.token, s.id, 'note', 'Mike', 'x');
    await act(l.token, s.id, 'done');
    await act(l.token, s.id, 'undo_done');
    await act(l.token, s.id, 'done');
    await revokeCrewDayLink(lauren(db), l.linkId);
    const after = await one(db, `SELECT (SELECT count(*) FROM public.business_inventory_ledger)::int ledger,
      (SELECT qty FROM public.business_inventory WHERE id = '${LOT}')::int qty,
      (SELECT status FROM public.orders WHERE id = '${s.orderId}') order_status,
      (SELECT count(*) FROM public.order_items)::int lines`);
    check(JSON.stringify(before) === JSON.stringify(after), `writes ${writesOn ? 'on' : 'off'}: ${JSON.stringify(before)} → ${JSON.stringify(after)}`);
    const done = await one(db, `SELECT status FROM public.deliveries WHERE id = $1`, [s.id]);
    check(done.status === 'fulfilled', `writes ${writesOn ? 'on' : 'off'}: the stop did not end done`);
  }
});

// ════════════════════════════════════════════════════════════════════════════════════════════
// PIECE 2 — ONE SAVED ROUTE PER TEAM ([[R-169]], ledger #362 · tech-debt #345)
// ════════════════════════════════════════════════════════════════════════════════════════════

/** A team on business B. */
async function team(db: any, name: string) {
  const r = await saveTeam(lauren(db), B, { name, memberNames: [] });
  if (!r.ok) throw new Error(`team ${name}: ${r.code} ${r.message}`);
  return r.value.teamId;
}
const onTeam = (db: any, stopIds: string[], teamId: string | null) =>
  assignStopsTeam(lauren(db), B, stopIds, teamId);

// ══════════════════════════════════════════════════════════════════════════════════════════════
// PIECE 3 — A CREW LINK PER CREW (ledger #374's work, unparked 2026-09-24).
// 🔴 THESE FOUR GUARDS WENT RED FOR THREE DAYS AND THE CAUSE WAS NOT IN THEM. The suite replayed
//    six migrations onto a PGlite snapshot that already carried five of them; every crew guard,
//    including four long-green ones, failed with `server_error`. The snapshot was refreshed from
//    live on 2026-09-24 (ledger #391), so only `20260921d` needs replaying now — and with that one
//    change these pass UNMODIFIED. Not one assertion was weakened to get here; the proof is that
//    this block is byte-identical to the parked branch's.
// ══════════════════════════════════════════════════════════════════════════════════════════════
// ⚠️ TEAMS ARE SET UP IN SQL HERE, NOT THROUGH `saveTeam`. These guards are about the LINK, and
//    `saveTeam`/`assignStopsTeam` already have their own paths and guards in `teams.paths.mts`.
//    Driving them through the app client before touching the crew endpoint leaves the endpoint's own
//    Supabase client reaching through the crew page's `fetch` stub, which only answers
//    `/api/crew/day`. Setting the rows directly keeps each guard about one thing (§6 r8).
//
// 🔴 NAMED `teamRow`, NOT `team`, AND THAT IS DELIBERATE. The parked branch declared a SECOND
//    top-level `async function team(...)` beside the existing one. Function declarations hoist and
//    the LAST one wins, so every EARLIER guard calling `team()` — expecting the `saveTeam` app-client
//    version — would silently have got this raw-SQL one instead. A duplicate declaration that
//    changes what already-green guards do is not a helper, it is a trapdoor.
async function teamRow(db: any, name: string, business = B) {
  const r = await one(db, `INSERT INTO public.delivery_teams (business_id, name, active, sort_order)
                           VALUES ($1, $2, true, 0) RETURNING id`, [business, name]);
  return r.id as string;
}
const putOnTeam = (db: any, stopId: string, teamId: string) =>
  db.query(`UPDATE public.deliveries SET team_id = $1 WHERE id = $2`, [teamId, stopId]);

await guard('crew.link-shows-only-its-team', 'a team\'s link shows that team\'s stops and no others', async (check) => {
  const db = await freshDb();
  const t1 = await teamRow(db, 'Team 1');
  const t2 = await teamRow(db, 'Team 2');
  const a = await stop(db, B, DAY_X);
  const b = await stop(db, B, DAY_X);
  const loose = await stop(db, B, DAY_X);
  await putOnTeam(db, a.id, t1);
  await putOnTeam(db, b.id, t2);

  const l1 = await link(db, DAY_X, t1);
  const read = await readCrewDay(l1.token);
  check(read.ok && read.value.stops.map(s => s.id).join() === a.id,
    `🔴 Team 1's link shows: ${read.ok ? JSON.stringify(read.value.stops.map(s => s.id)) : read.code} — it must be ONLY its own stop`);
  check(read.ok && read.value.team_name === 'Team 1',
    'the phone must NAME the team, so a driver on the wrong link can tell');
  check(read.ok && !read.value.stops.some(s => s.id === loose.id),
    '🔴 a stop with NO team was swept into a team\'s link — nobody said it was that team\'s work');
});

await guard('crew.link-cannot-act-on-another-teams-stop', 'a team\'s token is REFUSED on another team\'s stop, not merely not shown it', async (check) => {
  const db = await freshDb();
  const t1 = await teamRow(db, 'Team 1');
  const t2 = await teamRow(db, 'Team 2');
  const mine = await stop(db, B, DAY_X);
  const theirs = await stop(db, B, DAY_X);
  await putOnTeam(db, mine.id, t1);
  await putOnTeam(db, theirs.id, t2);
  const l1 = await link(db, DAY_X, t1);

  // 🔴 THE POINT OF THE WHOLE MIGRATION. The stop id travels in the REQUEST, so hiding it from the
  // read does not stop anyone posting it back with this token. A filter that only hides is a UI
  // preference; this must be a REFUSAL.
  const w = await endpoint('POST', l1.token, { action: 'done', stopId: theirs.id, name: 'Mike', deviceId: DEVICE });
  check(w.body?.code === 'not_this_teams_stop',
    `🔴 Team 1's token acted on Team 2's stop: ${w.statusCode} ${JSON.stringify(w.body)}`);
  const row = await one(db, `SELECT status, completed_at FROM public.deliveries WHERE id = $1`, [theirs.id]);
  check(row.status === 'scheduled' && row.completed_at === null,
    '🔴 another team\'s stop was actually CHANGED — the refusal did not hold');
  // …and its OWN stop still works, or this guard would pass by breaking everything ([[R-33]]).
  const okAct = await endpoint('POST', l1.token, { action: 'done', stopId: mine.id, name: 'Mike', deviceId: DEVICE });
  check(okAct.body?.ok === true, `its OWN stop was refused too: ${JSON.stringify(okAct.body)}`);
});

await guard('crew.whole-day-link-unchanged', 'a nursery that never splits a day keeps the link it always had', async (check) => {
  const db = await freshDb();
  const a = await stop(db, B, DAY_X);
  const b = await stop(db, B, DAY_X);
  const l = await link(db, DAY_X);            // no team — exactly the old call
  const read = await readCrewDay(l.token);
  check(read.ok && read.value.stops.length === 2, `🔴 the whole-day link lost stops: ${read.ok ? read.value.stops.length : read.code}`);
  check(read.ok && !read.value.team_name, 'a whole-day link must not claim a team');
  const w = await endpoint('POST', l.token, { action: 'done', stopId: b.id, name: 'Mike', deviceId: DEVICE });
  check(w.body?.ok === true, `the whole-day link could not act: ${JSON.stringify(w.body)}`);
  check(!!a.id, 'setup');
});

await guard('crew.one-live-link-per-team', 'reissuing one team\'s link never revokes another team\'s', async (check) => {
  const db = await freshDb();
  const t1 = await teamRow(db, 'Team 1');
  const t2 = await teamRow(db, 'Team 2');
  await link(db, DAY_X, t1);
  const l2 = await link(db, DAY_X, t2);
  const again1 = await link(db, DAY_X, t1);
  check(again1.replaced === 1, `reissuing Team 1 replaced ${again1.replaced} — it must replace exactly its own`);
  const stillOk = await readCrewDay(l2.token);
  check(stillOk.ok, '🔴 remaking Team 1\'s link killed Team 2\'s — a crew must not lose its day');
  const live = await all(db, `SELECT team_id FROM public.crew_day_links WHERE revoked_at IS NULL AND service_date = $1`, [DAY_X]);
  check(live.length === 2, `live links: ${live.length} — one per team`);
});

await guard('crew.link-refuses-another-businesss-team', 'a link cannot be minted against a team this business does not own', async (check) => {
  const db = await freshDb();
  await teamRow(db, 'Team 1');
  const foreign = await teamRow(db, 'Theirs', B2);
  const r = await createCrewDayLink(lauren(db), B, DAY_X, TZ, foreign);
  check(!r.ok && r.code === 'team_not_available',
    `🔴 a link was minted against another tenant's team: ${JSON.stringify(r)} — the read would then hand back an EMPTY day, which reads as "nothing to do" rather than as a refusal (AC-3)`);
});




await guard('crew.link-safe-before-the-migration', '🔴 with 20260921d NOT applied, a per-crew link REFUSES and never falls back to the whole day', async (check) => {
  // ⚠️ THIS GUARD RUNS ON THE PRE-MIGRATION SNAPSHOT ON PURPOSE. Tonight (2026-09-24) David cannot
  //    apply SQL, so this code merges to production BEFORE 20260921d exists there. The thing that
  //    must be proven is not that per-crew links work — the guards above do that — it is that the
  //    absence of the migration produces a REFUSAL and not Saturday 2026-09-19 all over again.
  const db = await freshDb({ withPerCrew: false });
  const a = await stop(db, B, DAY_X);

  // There is no `delivery_teams` row to point at and no per-crew function; a made-up id is the
  // realistic shape, because the panel would be passing an id the schedule handed it.
  const asked = await createCrewDayLink(lauren(db), B, DAY_X, TZ, '7a000000-0000-4000-8000-0000000000aa');
  check(!asked.ok && asked.code === 'per_crew_not_set_up',
    `🔴 a per-crew link was NOT refused on the pre-migration rung: ${JSON.stringify(asked)}`);

  // 🔴 THE LOAD-BEARING ASSERTION: the refusal must not have quietly minted a WHOLE-DAY link,
  // which is what a "helpful" fallback would do — and that link would show a crew every stop.
  const after = await readCrewDayLinks(lauren(db), B, DAY_X);
  check(after.ok && after.value.length === 0,
    `🔴 the refusal still created a link — a crew would have been handed the whole day: ${after.ok ? JSON.stringify(after.value) : after.code}`);

  // …and Lauren's own whole-day link is UNTOUCHED on this rung, or the safety net has broken the
  // one thing that works today.
  const whole = await createCrewDayLink(lauren(db), B, DAY_X, TZ, null);
  check(whole.ok, `the whole-day link stopped working before the migration: ${JSON.stringify(whole)}`);
  const shown = await readCrewDayLinks(lauren(db), B, DAY_X);
  check(shown.ok && shown.value.length === 1 && shown.value[0].team_id === null,
    `the pre-team read did not report one whole-day link: ${shown.ok ? JSON.stringify(shown.value) : shown.code}`);
  const day = await readCrewDay(whole.ok ? whole.value.token : '');
  check(day.ok && day.value.stops.some(x => x.id === a.id), 'the whole-day link no longer opens the day');
});

await path('route.save-per-team', 'Route this day for ONE team → that team\'s order is saved with the optimiser\'s miles and minutes', async (check) => {
  const db = await freshDb();
  const t1 = await team(db, 'Team 1');
  const a = await stop(db, B, DAY_X), b = await stop(db, B, DAY_X), c = await stop(db, B, DAY_X);
  await onTeam(db, [a.id, b.id, c.id], t1);

  const planned = [c.id, a.id, b.id];   // NOT the creation order — a read that ignores the plan fails here
  const out = await saveRouteOrder(lauren(db), B, DAY_X, planned, t1, { miles: 133.4, minutes: 169 });
  check(out.ok && out.saved === 3, `save: ${JSON.stringify(out)}`);
  check(out.ok && out.teamName === 'Team 1', 'the result does not name the team it routed');

  const rows = await all(db, `SELECT id, route_position FROM public.deliveries WHERE delivery_date = $1 AND team_id = $2 ORDER BY route_position`, [DAY_X, t1]);
  check(rows.map((r: any) => r.id).join() === planned.join(), `stored order ${JSON.stringify(rows.map((r: any) => r.route_position))}`);

  // 🔴 THE OPTIMISER'S OWN NUMBERS, KEPT. Piece 2.5 compares against these, so a figure recomputed
  // later from changed settings would be comparing the estimate with itself.
  const plan = await one(db, `SELECT team_id, stops, miles::float8 miles, minutes, routed_by FROM public.delivery_route_plans WHERE delivery_date = $1 AND team_id = $2`, [DAY_X, t1]);
  check(!!plan, 'no route plan row was written');
  check(plan && plan.stops === 3 && plan.miles === 133.4 && plan.minutes === 169, `plan row ${JSON.stringify(plan)}`);
  check(plan && plan.routed_by === MANAGER, 'the plan does not record who routed it');

  const sch = await schedule(db, DAY_X);
  check(sch.stops.map(x => x.id).join() === planned.join(), 'the schedule does not show the team\'s saved order');

  // Re-routing REPLACES and re-stamps, and leaves exactly ONE plan row.
  const again = await saveRouteOrder(lauren(db), B, DAY_X, [a.id, b.id, c.id], t1, { miles: 120, minutes: 150 });
  check(again.ok, `re-route: ${JSON.stringify(again)}`);
  const plans = await all(db, `SELECT miles::float8 miles FROM public.delivery_route_plans WHERE delivery_date = $1 AND team_id = $2`, [DAY_X, t1]);
  check(plans.length === 1 && plans[0].miles === 120, `after a re-route: ${JSON.stringify(plans)}`);
});

await guard('route.keeps-another-teams-order', '🔴 THE SATURDAY REGRESSION — routing Team 1 leaves Team 2\'s saved order untouched', async (check) => {
  const db = await freshDb();
  const t1 = await team(db, 'Team 1'), t2 = await team(db, 'Team 2');
  const a1 = await stop(db, B, DAY_X), a2 = await stop(db, B, DAY_X);
  const b1 = await stop(db, B, DAY_X), b2 = await stop(db, B, DAY_X);
  await onTeam(db, [a1.id, a2.id], t1);
  await onTeam(db, [b1.id, b2.id], t2);

  // Team 2 is routed FIRST — Lauren's 09:57 save.
  const two = await saveRouteOrder(lauren(db), B, DAY_X, [b2.id, b1.id], t2, {});
  check(two.ok, `team 2 save: ${JSON.stringify(two)}`);
  const before = await all(db, `SELECT id, route_position, routed_at FROM public.deliveries WHERE team_id = $1 ORDER BY route_position`, [t2]);
  check(before.map((r: any) => r.id).join() === [b2.id, b1.id].join(), 'team 2 did not save');

  // …then Team 1. On 20260917e the clear was DAY-scoped, which is exactly what wiped Team 2's
  // order at 13:18 and again at 13:41 on 2026-09-19.
  const first = await saveRouteOrder(lauren(db), B, DAY_X, [a2.id, a1.id], t1, {});
  check(first.ok && first.saved === 2, `team 1 save: ${JSON.stringify(first)}`);

  const after = await all(db, `SELECT id, route_position, routed_at FROM public.deliveries WHERE team_id = $1 ORDER BY route_position`, [t2]);
  check(after.length === 2 && after.every((r: any) => r.route_position != null), `🔴 TEAM 2 LOST ITS PLAN: ${JSON.stringify(after)}`);
  check(after.map((r: any) => r.id).join() === [b2.id, b1.id].join(), `🔴 team 2's ORDER changed: ${JSON.stringify(after.map((r: any) => r.route_position))}`);
  check(String(after[0].routed_at) === String(before[0].routed_at), 'team 2 was re-stamped by a save that was not about it');

  const plans = await all(db, `SELECT team_id FROM public.delivery_route_plans WHERE delivery_date = $1`, [DAY_X]);
  check(plans.length === 2, `plans for the day: ${plans.length} — one per team expected`);

  // NEGATIVE CONTROL: dropping a stop from its OWN team's re-route still clears it, so this guard
  // cannot pass just because the clear stopped working altogether.
  await saveRouteOrder(lauren(db), B, DAY_X, [a1.id], t1, {});
  const dropped = await one(db, `SELECT route_position FROM public.deliveries WHERE id = $1`, [a2.id]);
  check(dropped.route_position === null, 'a stop dropped from its own team\'s route kept its number');
});

await guard('route.refuses-teamless-stop', '[[R-169]] ① a stop with no team STOPS the route, and the refusal NAMES it', async (check) => {
  const db = await freshDb();
  const t1 = await team(db, 'Team 1');
  const a = await stop(db, B, DAY_X), orphan = await stop(db, B, DAY_X);
  await onTeam(db, [a.id], t1);   // `orphan` is deliberately left with no team

  const out = await saveRouteOrder(lauren(db), B, DAY_X, [a.id, orphan.id], t1, {});
  check(!out.ok && out.code === 'stop_without_team', `a team-less stop was routed: ${JSON.stringify(out)}`);
  // 🔴 NAMED, not counted: "one stop has no team" sends Lauren hunting through eight cards.
  const said = out.ok ? '' : routeRefusalText(out.code, out.message);
  check(/Smith/.test(said), `the refusal does not name the stop: "${said}"`);
  check(/assign it to a team first/i.test(said), `the refusal does not say what to do: "${said}"`);
  // NOTHING was written — not even for the stop that did have a team.
  const rows = await all(db, `SELECT route_position FROM public.deliveries WHERE delivery_date = $1`, [DAY_X]);
  check(rows.every((r: any) => r.route_position === null), `a refused route wrote positions: ${JSON.stringify(rows)}`);
  check((await all(db, `SELECT id FROM public.delivery_route_plans`)).length === 0, 'a refused route wrote a plan row');
});

await guard('route.refuses-mixed-teams', '[[R-169]] ② a set spanning two teams is refused BY NAME, never routed across both', async (check) => {
  const db = await freshDb();
  const t1 = await team(db, 'Team 1'), t2 = await team(db, 'Team 2');
  const a = await stop(db, B, DAY_X), b = await stop(db, B, DAY_X);
  await onTeam(db, [a.id], t1);
  await onTeam(db, [b.id], t2);

  const out = await saveRouteOrder(lauren(db), B, DAY_X, [a.id, b.id], t1, {});
  check(!out.ok && out.code === 'mixed_teams', `a mixed set was routed: ${JSON.stringify(out)}`);
  const said = out.ok ? '' : routeRefusalText(out.code, out.message);
  check(/Team 2/.test(said), `the refusal does not name the other team: "${said}"`);
  const rows = await all(db, `SELECT route_position FROM public.deliveries WHERE delivery_date = $1`, [DAY_X]);
  check(rows.every((r: any) => r.route_position === null), 'a refused mixed route wrote positions');
});

await guard('route.wrapper-refuses-partly-teamed', 'the OLD three-argument call — what the deployed page makes — still refuses a partly team-less set by name', async (check) => {
  const db = await freshDb();
  const t1 = await team(db, 'Team 1');
  const a = await stop(db, B, DAY_X), orphan = await stop(db, B, DAY_X);
  await onTeam(db, [a.id], t1);   // `orphan` has no team

  // 🔴 THE RPC IS CALLED WITH THREE ARGUMENTS DIRECTLY, not through this repo's client. The client
  // now always sends six (team defaulting to null), so calling it would test the NEW function and
  // prove nothing about the wrapper. The DEPLOYED bundle sends three, and between David's apply
  // and this code's merge that is the only call that happens — so the ruling has to hold for a
  // caller that knows nothing about teams, or the window itself is where Saturday repeats.
  const legacy = async (ids: string[]) => {
    const { data } = await (lauren(db) as any).rpc('save_route_order', {
      p_business_id: B, p_service_date: DAY_X, p_stop_ids: ids,
    });
    return data as { ok: boolean; code?: string; message?: string };
  };
  const out = await legacy([a.id, orphan.id]);
  check(!out.ok, `the wrapper routed a partly team-less set: ${JSON.stringify(out)}`);
  check(out.code === 'stop_without_team', `wrong refusal: ${JSON.stringify(out)}`);
  const rows = await all(db, `SELECT route_position FROM public.deliveries WHERE delivery_date = $1`, [DAY_X]);
  check(rows.every((r: any) => r.route_position === null), 'the wrapper wrote positions for a refused set');

  // …and a MIXED set through the same three-argument door is refused by name too.
  const t2 = await team(db, 'Team 2');
  await onTeam(db, [orphan.id], t2);
  const mixed = await legacy([a.id, orphan.id]);
  check(!mixed.ok && mixed.code === 'mixed_teams', `the wrapper routed a mixed set: ${JSON.stringify(mixed)}`);
  const said = routeRefusalText(mixed.code ?? '', mixed.message);
  check(/Team [12]/.test(said), `the wrapper's refusal does not name a team: "${said}"`);

  // ⓪ AND THE SAME RULE THROUGH THE NEW DOOR: naming NO team on a day that HAS been split is
  // refused too. Without this the whole-day route writes positions across both crews while its
  // clear (scoped to `team_id IS NULL`) touches nothing — Saturday's shape, different door.
  const nullTeam = await saveRouteOrder(lauren(db), B, DAY_X, [a.id, orphan.id], null, {});
  check(!nullTeam.ok && nullTeam.code === 'team_required', `a split day routed with no team: ${JSON.stringify(nullTeam)}`);
  const namesTeam = nullTeam.ok ? '' : routeRefusalText(nullTeam.code, nullTeam.message);
  check(/Team [12]/.test(namesTeam), `the refusal does not name the teams: "${namesTeam}"`);
  const rows2 = await all(db, `SELECT route_position FROM public.deliveries WHERE delivery_date = $1`, [DAY_X]);
  check(rows2.every((r: any) => r.route_position === null), 'a day routed with no team wrote positions anyway');
});

await guard('route.unsplit-day-still-works', 'a business that never split a day routes exactly as before — teams change nothing for it', async (check) => {
  const db = await freshDb();
  const a = await stop(db, B, DAY_X), b = await stop(db, B, DAY_X);
  // No teams exist at all, and this is the THREE-ARGUMENT call the deployed page makes.
  const out = await saveRouteOrder(lauren(db), B, DAY_X, [b.id, a.id]);
  check(out.ok && out.saved === 2, `the unsplit day was refused: ${JSON.stringify(out)}`);
  const rows = await all(db, `SELECT id FROM public.deliveries WHERE delivery_date = $1 ORDER BY route_position`, [DAY_X]);
  check(rows.map((r: any) => r.id).join() === [b.id, a.id].join(), 'the unsplit day did not save its order');
  const plan = await one(db, `SELECT team_id, stops FROM public.delivery_route_plans WHERE delivery_date = $1`, [DAY_X]);
  check(plan && plan.team_id === null && plan.stops === 2, `the unsplit day's plan row: ${JSON.stringify(plan)}`);
});

// 🔴 CLOSE EVERY DATABASE, OR THIS PROCESS NEVER EXITS (§6 r28). Each `freshDb()` opens a PGlite
// instance; none used to be closed, so the file printed all its results and then hung forever,
// holding the runner with it. `exitCode` only sets a code — something still has to let the loop end.
const closed = await closeLiveDbs();
console.log(`(closed ${closed} PGlite database(s))`);
// 🔴 AND EXIT EXPLICITLY, AS `teams`, `contacts` AND `rung-dates` ALL ALREADY DO. Closing the
//    databases is the real fix; this is the belt to its braces, and the inconsistency is itself the
//    finding: this was the ONE path file relying on natural exit, which is why it was the one that
//    hung. ⚠️ `origin/main` has the same ending with 29 `freshDb()` calls and passes — so this is a
//    LATENT defect on main that more guards crossed the threshold of, not one this branch invented.
//    The next person to add a guard would have met it.
process.exit(failures ? 1 : 0);
