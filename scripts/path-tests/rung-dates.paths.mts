/**
 * ── rung-dates — every way a potting date is entered, driven end to end (§6 r21, ledger #391) ────
 *
 * PURPOSE:      `production_rung_dates` records when a lot went into the size it is in. There is ONE
 *               writer, `recordRungDate`, and one capture path today: the potting sheet on
 *               /inventory/uppot. This drives that path through the REAL writer against the LIVE
 *               schema with RLS on, and reads the value back BOTH from the database AND from the
 *               read a person looks at (`currentRungDate` over `loadRungDates`'s shape).
 * DEPENDENCIES: scripts/path-tests/lib/liveDb.mjs — the live snapshot on PGlite, RLS enforced.
 *
 * ⚠️ REGISTERED ONLY NOW, AND THE DELAY WAS MECHANICAL. A path test must run on the live-schema
 *    fixture; `production_rung_dates` was not in it until David applied `20260924a` and the snapshot
 *    was refreshed (2026-09-24). Declaring the test earlier would have declared one that cannot run.
 *
 * Run: node scripts/path-tests/run-path-file.mjs scripts/path-tests/rung-dates.paths.mts
 */
import { openLiveDb, restClient, installSupabaseShim } from './lib/liveDb.mjs';
import { recordRungDate, currentRungDate, rungDateHistory, readinessOf } from '../../packages/shared/src/production/rungDates';

process.env.SUPABASE_URL = 'http://pglite.test';
process.env.SUPABASE_SERVICE_KEY = 'service';

const ONLY = process.env.PATH_ONLY ? new Set(process.env.PATH_ONLY.split(',')) : null;
const B = 'b0000000-0000-4000-8000-00000000000b';
const B2 = 'b0000000-0000-4000-8000-00000000000c';
const OWNER = '0a000000-0000-4000-8000-000000000001';
const MANAGER = '0a000000-0000-4000-8000-000000000002';
const STAFF = '0a000000-0000-4000-8000-000000000003';
const LOT = '1a000000-0000-4000-8000-000000000001';

const MANAGER_PERMS = ['inventory:read', 'inventory:update', 'settings:read'];
const OWNER_PERMS = [...MANAGER_PERMS, 'inventory:create', 'inventory:delete'];
// 🔴 STAFF HOLDS inventory:read ALONE — measured at LAWNS 2026-09-05. That is the whole of the
// staff guard below: they may SEE a date and may not SET one, enforced by the policy.
const STAFF_PERMS = ['inventory:read'];

let failures = 0;
async function runner(kind: 'PATH' | 'GUARD', id: string, what: string, body: (check: (ok: boolean, detail: string) => void) => Promise<void>) {
  if (ONLY && !ONLY.has(id)) return;
  const problems: string[] = [];
  try { await body((ok, detail) => { if (!ok) problems.push(detail); }); }
  catch (e: any) { problems.push(`threw: ${String(e?.message ?? e).slice(0, 300)}`); }
  if (problems.length) failures++;
  console.log(`${kind} ${id} ${problems.length ? 'FAIL' : 'PASS'} ${what}${problems.length ? ' — ' + problems.join(' | ') : ''}`);
}
const path = (id: string, what: string, b: any) => runner('PATH', id, what, b);
const guard = (id: string, what: string, b: any) => runner('GUARD', id, what, b);

async function freshDb() {
  const db: any = await openLiveDb();
  installSupabaseShim(db);
  await db.exec(`
    INSERT INTO auth.users (id, email) VALUES ('${OWNER}','o@test.invalid'),('${MANAGER}','m@test.invalid'),('${STAFF}','s@test.invalid');
    INSERT INTO public.businesses (id, owner_id, name, business_type) VALUES
      ('${B}', '${OWNER}', 'Path Test Nursery', 'nursery'),
      ('${B2}', '${OWNER}', 'Other Nursery', 'nursery');
    INSERT INTO public.business_members (business_id, user_id, name, role, permissions, active) VALUES
      ('${B}', '${OWNER}', 'Owner', 'OWNER', '${JSON.stringify(OWNER_PERMS)}', true),
      ('${B}', '${MANAGER}', 'Manager', 'MANAGER', '${JSON.stringify(MANAGER_PERMS)}', true),
      ('${B}', '${STAFF}', 'Staff', 'STAFF', '${JSON.stringify(STAFF_PERMS)}', true);
    INSERT INTO public.business_inventory (id, business_id, name, qty, status, size)
      VALUES ('${LOT}', '${B}', 'Mexican Sycamore', 140, 'available', '3/5 gal');
  `);
  return db;
}
const asUser = (db: any, uid: string) => restClient(db, { uid });
const all = async (db: any, sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows;

// ── THE CAPTURE PATH ───────────────────────────────────────────────────────────────────────────
await path('potting.record', '/inventory/uppot → Potted on → Add this entry', async (check) => {
  const db = await freshDb();
  const out = await recordRungDate(asUser(db, MANAGER) as any, {
    businessId: B, inventoryId: LOT, enteredOn: '2026-06-25', unitValue: 4, note: '140 Cedar Creek liners landed',
  });
  check(out.ok, `the writer reported failure: ${out.message}`);

  // ① read it back from the DATABASE
  const rows = await all(db, `SELECT entered_on, unit_value, note, recorded_by, seq FROM public.production_rung_dates WHERE inventory_id = $1`, [LOT]);
  check(rows.length === 1, `rows in the table: ${rows.length}`);
  check(String(rows[0]?.entered_on).slice(0, 10) === '2026-06-25', `entered_on stored: ${rows[0]?.entered_on}`);
  check(rows[0]?.note === '140 Cedar Creek liners landed', 'the note was stored');
  // 🔴 STAMPED BY THE DATABASE, NOT SENT. The writer omits the key so `auth.uid()` fills it.
  check(rows[0]?.recorded_by === MANAGER, `recorded_by is the real caller: ${rows[0]?.recorded_by}`);

  // ② read it back from WHERE A PERSON LOOKS — the sheet's own current-entry read
  const read = await asUser(db, MANAGER).from('production_rung_dates')
    .select('id, inventory_id, entered_on, unit_value, note, recorded_by, recorded_at, seq').eq('business_id', B);
  const current = currentRungDate((read.data ?? []) as any);
  check(current?.entered_on?.toString().slice(0, 10) === '2026-06-25', 'the sheet shows the date it was given');
  const r = readinessOf(String(current?.entered_on).slice(0, 10), 6, 'sold', '15 gal', '2027-01-01');
  check(r.state === 'sellable', `readiness derived from the stored date: ${r.state}`);
});

// ── GUARDS ─────────────────────────────────────────────────────────────────────────────────────
await guard('potting.correction-adds-a-row', 'a correction ADDS a row and becomes current; the original stays', async (check: any) => {
  const db = await freshDb();
  const w = (d: string, n: string) => recordRungDate(asUser(db, MANAGER) as any, { businessId: B, inventoryId: LOT, enteredOn: d, unitValue: 4, note: n });
  check((await w('2026-06-25', 'first')).ok, 'the first entry was refused');
  check((await w('2026-07-02', 'Joel: it was the week after')).ok, 'the correction was refused');
  const rows = await all(db, `SELECT entered_on, note, recorded_at, seq FROM public.production_rung_dates WHERE inventory_id = $1`, [LOT]);
  check(rows.length === 2, `nothing was overwritten: ${rows.length} rows`);
  const cur = currentRungDate(rows as any);
  check(String(cur?.entered_on).slice(0, 10) === '2026-07-02', 'the correction is current');
  check(rungDateHistory(rows as any).length === 2, 'the history keeps both');
});

await guard('potting.append-only', 'nobody may UPDATE or DELETE an entry — a correction is a new row', async (check: any) => {
  const db = await freshDb();
  await recordRungDate(asUser(db, MANAGER) as any, { businessId: B, inventoryId: LOT, enteredOn: '2026-06-25', unitValue: 4, note: null });
  for (const stmt of ['UPDATE public.production_rung_dates SET entered_on = $1', 'DELETE FROM public.production_rung_dates']) {
    let refused = false;
    try { await db.query(stmt, stmt.startsWith('UPDATE') ? ['2020-01-01'] : []); }
    catch (e: any) { refused = /append-only/i.test(e.message); }
    check(refused, `not refused: ${stmt.split(' ')[0]}`);
  }
});

await guard('potting.staff-may-not-set', 'a STAFF member sees a date and cannot set one (inventory:update)', async (check: any) => {
  const db = await freshDb();
  await recordRungDate(asUser(db, MANAGER) as any, { businessId: B, inventoryId: LOT, enteredOn: '2026-06-25', unitValue: 4, note: null });
  const out = await recordRungDate(asUser(db, STAFF) as any, { businessId: B, inventoryId: LOT, enteredOn: '2026-08-01', unitValue: 4, note: 'staff' });
  // 🔴 AND IT MUST SAY SO. A refused PostgREST insert returns NO error and an empty representation,
  // so the writer must not report success (E5 / R-12 / tech-debt #74).
  check(!out.ok, 'a staff member was allowed to set a potting date');
  // ⚠️ THE WORDING IS NOT THE POINT AND AN EARLIER DRAFT MADE IT ONE. RLS can refuse in two shapes:
  // an ERROR ("new row violates row-level security policy") or NO error with an empty
  // representation. The writer handles both; asserting one wording made this guard fail against a
  // refusal that was working correctly. What must hold is that it is REPORTED and nothing landed.
  check(/row-level security|permission|Nothing changed/i.test(out.message), `the refusal is not explained: ${out.message}`);
  check((await all(db, `SELECT 1 FROM public.production_rung_dates WHERE note = 'staff'`)).length === 0,
    'the staff entry was written anyway');
  const read = await asUser(db, STAFF).from('production_rung_dates').select('entered_on').eq('business_id', B);
  check((read.data ?? []).length === 1, 'a staff member cannot SEE the date either (they hold inventory:read)');
});

await guard('potting.other-business', 'a member of one business never sees another business\'s dates', async (check: any) => {
  const db = await freshDb();
  await recordRungDate(asUser(db, MANAGER) as any, { businessId: B, inventoryId: LOT, enteredOn: '2026-06-25', unitValue: 4, note: null });
  const read = await asUser(db, MANAGER).from('production_rung_dates').select('business_id');
  check((read.data ?? []).every((r: any) => r.business_id === B), 'a row from another business was visible');
});

await guard('potting.no-future-date', 'a date in the future is refused before it is written', async (check: any) => {
  const db = await freshDb();
  const out = await recordRungDate(asUser(db, MANAGER) as any, { businessId: B, inventoryId: LOT, enteredOn: '2099-01-01', unitValue: 4, note: null });
  check(!out.ok && /future/i.test(out.message), `not refused: ${out.message}`);
  check((await all(db, `SELECT 1 FROM public.production_rung_dates`)).length === 0, 'it was written anyway');
});

process.exit(failures ? 1 : 0);
