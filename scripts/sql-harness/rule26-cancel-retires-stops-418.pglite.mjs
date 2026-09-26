/**
 * -- rule26-cancel-retires-stops-418.pglite -- THE CANCEL MIGRATION, EXECUTED -------------------
 *
 * PURPOSE:      CLAUDE.md §6 r26 for `supabase/migrations/20260925k_cancel_order_retires_stops.sql`.
 *               Every statement is RUN against the LIVE SCHEMA SNAPSHOT, the function is CALLED on
 *               the two shapes measured live, its V-blocks are answered from the resulting rows,
 *               and it is called again to prove idempotence.
 *
 * 🔴 THE TWO SHAPES ARE REAL ROWS, NOT INVENTED ONES:
 *    · GILLESPIE — a scheduled stop on a day somebody has to route, with a team already assigned.
 *    · TRACY FISHER — stop `889b0df1`, order status `cancelled`, stop status `scheduled`, live on
 *      2026-09-06. The pre-existing wreckage: proof that cancel has NEVER reached a delivery, and
 *      the case the fix has to be able to clean up as well as prevent.
 *
 * 🔴 P5 IS THE NEGATIVE CONTROL THAT MATTERS: a function that cancelled every stop on the day
 *    would satisfy "Gillespie is off Saturday" by emptying Saturday. Another customer's stop, and
 *    a SECOND stop belonging to the same order-less customer, must both survive untouched.
 *
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR · fixtures/live-schema-public.sql.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/rule26-cancel-retires-stops-418.pglite.mjs
 */
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { openLiveDb } from '../path-tests/lib/liveDb.mjs';

const FILE  = process.cwd() + '/supabase/migrations/20260925k_cancel_order_retires_stops.sql';
const L     = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const OWNER = '11111111-1111-1111-1111-111111111111';
const GILL  = 'ab41d76b-9f4e-414d-8b02-af1ef3a2bae9';
const TRACY = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
const ORD_G = 'f638c955-a90e-403f-a290-a5b990ba373b';
const ORD_T = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
const STOP_G= '77bdf86f-d1ae-47a9-b39c-025abd984521';
const STOP_T= '889b0df1-2541-44aa-ac6b-16ebc66479f6';
const ORD_O = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const STOP_O= 'da32ecf2-bfa8-4b8a-8e1f-206da6c5031d';
const TEAM  = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex').slice(0, 12);
const text = readFileSync(FILE, 'utf8');
const db = await openLiveDb({});

// 🔴 `auth.uid()` READS `request.jwt.claim.sub` — SINGULAR "claim", not the `request.jwt.claims`
//    JSON blob. A first draft set the blob, `auth.uid()` returned NULL, and the function refused
//    with "not a member of this business". The refusal was CORRECT and it is what caught the
//    mistake: an impersonation that silently does nothing, against a check that quietly allowed it,
//    would have produced a green proving nothing ([[R-33]]).
const beUser = (uid) => db.query(
  `SELECT set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false)`, [uid]);
const asOwner = () => beUser(OWNER);

// ── SEED ───────────────────────────────────────────────────────────────────────────────────────
await db.exec(`
  INSERT INTO auth.users (id,email) VALUES ('${OWNER}','owner@example.test') ON CONFLICT DO NOTHING;
  INSERT INTO public.businesses (id,name,owner_id) VALUES ('${L}','LAWNS Tree Farm, LLC','${OWNER}') ON CONFLICT DO NOTHING;
  INSERT INTO public.customers (id,business_id,first_name,last_name) VALUES
    ('${GILL}','${L}','Dwight','Gillespie'), ('${TRACY}','${L}','Tracy','Fisher');
  INSERT INTO public.delivery_teams (id,business_id,name) VALUES ('${TEAM}','${L}','Team 1') ON CONFLICT DO NOTHING;
  -- 🔴 A REAL MEMBERSHIP ROW, because the function checks is_active_member + has_permission and
  --    SECURITY DEFINER bypasses RLS. The first run of this harness died on "not a member of this
  --    business" with only an auth.users row seeded — the fixture refusing an incomplete seed,
  --    which is exactly what a double more forgiving than the real system would NOT have done.
  INSERT INTO public.business_members (business_id,user_id,name,role,permissions,active) VALUES
    ('${L}','${OWNER}','David','OWNER','["orders:update","orders:delete"]'::jsonb,true);
  INSERT INTO public.orders (id,business_id,customer_id,status,transport_method) VALUES
    ('${ORD_G}','${L}','${GILL}','invoiced','delivery'),
    -- 🔴 TRACY AS SHE IS LIVE: the order is ALREADY cancelled and the stop is still scheduled.
    ('${ORD_T}','${L}','${TRACY}','cancelled','delivery'),
    ('${ORD_O}','${L}','${GILL}','invoiced','delivery');
  INSERT INTO public.deliveries (id,business_id,customer_id,order_id,delivery_date,address_line1,status,notes,team_id,route_position) VALUES
    ('${STOP_G}','${L}','${GILL}','${ORD_G}','2026-09-26','101 Crupp Avenue','scheduled','From QuickBooks invoice #3648.562','${TEAM}',2),
    ('${STOP_T}','${L}','${TRACY}','${ORD_T}','2026-09-06','9 Pecan Row','scheduled','Delivery for Tracy Fisher',NULL,NULL),
    ('${STOP_O}','${L}','${GILL}','${ORD_O}','2026-09-26','109 Blue Vervain Trail','scheduled','Another order, same customer','${TEAM}',1);
`);

// ── P0 ─────────────────────────────────────────────────────────────────────────────────────────
{
  const t = (await db.query(`SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='public'`)).rows[0].n;
  ok(t > 55, `P0 the FULL live schema (${t} tables)`);
  const pre = (await db.query(`SELECT count(*)::int n FROM public.deliveries d JOIN public.orders o ON o.id=d.order_id
    WHERE o.status='cancelled' AND d.status NOT IN ('cancelled','held')`)).rows[0].n;
  ok(pre === 1, `P0 🔴 THE DEFECT IS PRESENT BEFORE THE FIX — ${pre} stop still scheduled under a cancelled order (Tracy Fisher). V3's "before" answer.`);
}

// ── P1 — every statement executed ──────────────────────────────────────────────────────────────
{
  let err = null;
  try { await db.exec(text); } catch (e) { err = String(e.message || e); }
  ok(err === null, `P1 the migration — EXECUTED end to end${err ? ` — ${err}` : ''} · sha256:${sha(text)}`);
}

// ── P2 — V1: the function, its security, and who may execute it ────────────────────────────────
{
  const r = (await db.query(`SELECT p.prosecdef sd, has_function_privilege('anon', p.oid, 'EXECUTE') anon
    FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public' AND p.proname='cancel_order_with_stops'`)).rows[0];
  ok(!!r, 'V1 the function exists');
  ok(r?.sd === true, 'V1 …SECURITY DEFINER');
  ok(r?.anon === false, 'V1 🔴 …and anon CANNOT execute it — the REVOKE landed');
}

// ── P3 — V2: applying the migration moved nothing ──────────────────────────────────────────────
{
  const n = (await db.query(`SELECT count(*)::int n FROM public.deliveries WHERE status='cancelled'`)).rows[0].n;
  ok(n === 0, `V2 🔴 NOTHING CHANGED ON APPLY — the migration only adds a function (${n} stops cancelled by it)`);
}

// ── P4 — THE GILLESPIE SHAPE: cancel takes the stop off the day, team and route with it ────────
await asOwner();
{
  const out = (await db.query(`SELECT public.cancel_order_with_stops($1,$2,$3) AS r`,
    [L, ORD_G, 'duplicate of order f638c955 — cancelled by David'])).rows[0].r;
  ok(out.ok === true && out.stops_retired === 1, `P4 the call retired ${out.stops_retired} stop (expected 1)`);

  const d = (await db.query(`SELECT status, team_id, route_position, notes FROM public.deliveries WHERE id='${STOP_G}'`)).rows[0];
  ok(d.status === 'cancelled',  `P4 the stop is cancelled (${d.status}) — off schedule, load list, route and crew link, which all read one filter`);
  ok(d.team_id === null,        'P4 🔴 …team_id CLEARED — the cancelled/held filter does NOT cover it, and a cancelled stop keeping its team is still counted when Lauren splits the day');
  ok(d.route_position === null, 'P4 …route_position cleared');
  ok(d.notes.includes('#3648.562') && d.notes.includes('duplicate of order f638c955'),
    'P4 🔴 …provenance APPENDED, not overwritten — for Gillespie that QuickBooks note was the only surviving record of where the stop came from');
  const o = (await db.query(`SELECT status FROM public.orders WHERE id='${ORD_G}'`)).rows[0];
  ok(o.status === 'cancelled', `P4 …and the order moved with it (${o.status})`);
}

// ── P5 — 🔴 NEGATIVE CONTROLS ──────────────────────────────────────────────────────────────────
{
  const other = (await db.query(`SELECT status, team_id, route_position FROM public.deliveries WHERE id='${STOP_O}'`)).rows[0];
  ok(other.status === 'scheduled' && other.team_id === TEAM && other.route_position === 1,
    'P5 NEGATIVE CONTROL — the SAME customer\'s other stop, same day, same team, is UNTOUCHED (status/team/position intact)');
  const swept = (await db.query(`SELECT count(*)::int n FROM public.deliveries WHERE status='cancelled'`)).rows[0].n;
  ok(swept === 1, `P5 🔴 …EXACTLY ONE stop moved in the whole table (${swept}) — it retires an ORDER's stops, it does not sweep a day`);
}

// ── P6 — V4: the audit rows neither click ever wrote ───────────────────────────────────────────
{
  const rows = (await db.query(`SELECT action, target_type, target_id::text tid, detail FROM public.audit_log
    WHERE action IN ('order.cancelled','delivery.cancelled') ORDER BY action`)).rows;
  ok(rows.length === 2, `V4 two audit rows written (${rows.length})`);
  const ord = rows.find((r) => r.action === 'order.cancelled');
  const del = rows.find((r) => r.action === 'delivery.cancelled');
  ok(ord?.tid === ORD_G && ord?.detail?.stops_retired === 1,
    'V4 order.cancelled names the order and how many stops went with it');
  ok(del?.tid === STOP_G && del?.detail?.order_id === ORD_G,
    'V4 🔴 delivery.cancelled names the STOP and the order that cancelled it — the trail David had none of');
  ok(typeof ord?.detail === 'object' && ord?.detail !== null,
    'V4 …and `detail` is real jsonb, not text — passing text here raises 42804, the error §6 r26 exists for');
}

// ── P7 — THE TRACY FISHER SHAPE: the fix CLEANS UP the wreckage, not only prevents it ──────────
{
  const out = (await db.query(`SELECT public.cancel_order_with_stops($1,$2,$3) AS r`,
    [L, ORD_T, 'stop retired to match an order cancelled on 2026-09-06'])).rows[0].r;
  // The order was ALREADY 'cancelled', so the idempotence guard returns unchanged and retires nothing.
  ok(out.stops_retired === 1,
    `P7 🔴 THE TRACY SHAPE IS REPAIRED, NOT ONLY PREVENTED — her order was ALREADY 'cancelled' and the call still retired ${out.stops_retired} live stop. An earlier draft returned early on the order's status alone and left her exactly where she was; the harness caught it, and every existing instance would have needed its own hand-written data file.`);
  const d = (await db.query(`SELECT status FROM public.deliveries WHERE id='${STOP_T}'`)).rows[0];
  ok(d.status === 'cancelled', `P7 …her stop is now ${d.status}`);
  const a = (await db.query(`SELECT action, detail FROM public.audit_log WHERE target_id='${ORD_T}'`)).rows;
  ok(a.length === 1 && a[0].action === 'order.stops_reconciled',
    `P7 🔴 …and the audit says RECONCILED, not "cancelled" — the order's transition already happened and is not re-claimed; only the delivery is genuinely being cancelled now (${a.map((r) => r.action).join(',') || 'none'})`);
  const dl = (await db.query(`SELECT count(*)::int n FROM public.audit_log WHERE action='delivery.cancelled' AND target_id='${STOP_T}'`)).rows[0].n;
  ok(dl === 1, `P7 …with a delivery.cancelled row for her stop (${dl})`);
}

// ── P8 — idempotence on the shape it does handle ───────────────────────────────────────────────
{
  const before = (await db.query(`SELECT notes FROM public.deliveries WHERE id='${STOP_G}'`)).rows[0].notes;
  const out = (await db.query(`SELECT public.cancel_order_with_stops($1,$2,$3) AS r`, [L, ORD_G, 'again'])).rows[0].r;
  const after = (await db.query(`SELECT notes FROM public.deliveries WHERE id='${STOP_G}'`)).rows[0].notes;
  const audit = (await db.query(`SELECT count(*)::int n FROM public.audit_log WHERE action='order.cancelled'`)).rows[0].n;
  ok(out.unchanged === true && before === after && audit === 1,
    'P8 🔴 a second cancel writes NOTHING — no stamped-on note, no second audit row manufacturing a transition nobody performed');
}

// ── P9 — a caller who is not a member is REFUSED ───────────────────────────────────────────────
{
  await beUser('99999999-9999-9999-9999-999999999999');
  let err = null;
  try { await db.query(`SELECT public.cancel_order_with_stops($1,$2,$3)`, [L, ORD_O, 'x']); }
  catch (e) { err = String(e.message || e); }
  ok(err !== null && /member|permission|42501/i.test(err),
    `P9 🔴 a NON-MEMBER is refused — SECURITY DEFINER bypasses RLS, so the check is explicit and first (${err ? err.slice(0, 60) : 'NO ERROR — the function is open'})`);
  const o = (await db.query(`SELECT status FROM public.orders WHERE id='${ORD_O}'`)).rows[0];
  ok(o.status === 'invoiced', 'P9 …and nothing moved on the refused call');
}

console.log(fails ? `\n${fails} probe(s) FAILED` : '\nall probes passed');
process.exit(fails ? 1 : 0);
