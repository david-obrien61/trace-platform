#!/usr/bin/env node
/**
 * ── install-price-check-404 — 20260924e AND THE REVISED DATA FILE, EXECUTED (§6 r26) ──────────
 *
 * PURPOSE:      Ledger #404. Both files David will paste are RUN here by a Postgres engine before
 *               he sees them, against the live schema with the ladder migrations replayed.
 *
 *                 P1  V1 — the CHECK exists and is findable BY NAME (tech-debt #91)
 *                 P2  🔴 V3 — the file's own V3 statement is REFUSED, by name ([[R-33]])
 *                 P3  🔴 a NEGATIVE is refused too
 *                 P4  a real price is ACCEPTED — the guard does not refuse everything
 *                 P5  NULL is still accepted — "not set" is the ordinary state (R-171 (c))
 *                 P6  V2 — no existing row violates the new rule
 *                 P7  V4 — the comments landed: install_price names Plant Your Tree, pyt_price says NOT USED
 *                 P8  V5 — pyt_price is empty on every rung on every tenant
 *                 P9  V6 — idempotence: the whole file re-runs and leaves exactly one constraint
 *                 D1  the revised LAWNS data file runs end to end and flips ONLY Plant Your Tree
 *                 D2  it is idempotent
 *                 M1  mutant: the CHECK as `>= 0` — P2 must catch it
 *                 M2  🔴 mutant: A ROW ALREADY AT 0. The constraint must REFUSE TO BE ADDED, which
 *                     is the whole reason the live read came first — and it proves the read was
 *                     load-bearing rather than ceremonial.
 *                 M3  mutant: the pyt_price comment left saying it is in use — P7 must catch it
 *
 * 🔴 WHY MIGRATIONS ARE REPLAYED ON TOP OF THE SNAPSHOT: the fixture's `container_ladder` is the
 *    ORIGINAL 20260914 shape. Every later ALTER is applied live and post-dates the snapshot, so the
 *    snapshot alone is not the live shape and a run against it would prove the wrong thing.
 *
 * DEPENDENCIES: @electric-sql/pglite (dev) · liveDb · the two SQL files.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure.
 * ⚠️ PGlite is Postgres 18 and Supabase runs an older major: this proves the SQL is well-formed and
 *    that the constraint BITES. It does not replace applying it.
 *
 * Run: node scripts/sql-harness/install-price-check-404.pglite.mjs
 */
import { readFileSync } from 'node:fs';
import { openLiveDb } from '../path-tests/lib/liveDb.mjs';

const FILE = `${process.cwd()}/supabase/migrations/20260924e_container_ladder_install_price_check.sql`;
const WHOLE = readFileSync(FILE, 'utf8');

// 🔴 V3 IS LIVE SQL THAT MUST FAIL, SO IT IS SPLIT OUT AND RUN ON ITS OWN — exactly as its own
// header tells David to run it. Running the file straight through would abort at V3 and prove
// nothing about V4–V7. The text below is LIFTED FROM THE FILE, never retyped, so P3 exercises the
// statement David will paste and cannot drift from it.
const V3_RE = /UPDATE container_ladder SET install_price = 0\n[\s\S]*?;\n/;
const V3 = (WHOLE.match(V3_RE) || [''])[0];
if (!V3) { console.error('FAIL could not find V3 in the migration — the harness would silently skip it'); process.exit(1); }
/** Everything except V3 — what runs in one go. */
const MIG = WHOLE.replace(V3_RE, '');
/** The LAWNS data file David runs after the migration — §6 r26 covers it too. */
const DATA = readFileSync(`${process.cwd()}/docs/decisions/2026-09-24-lawns-pyt-prices-by-size.sql`, 'utf8');

/** The ALTERs that are applied live but post-date the schema snapshot — the ladder's, and the one
 *  that gives `service_offerings` its `price_source`. Replayed in order before anything is proven. */
const PRIOR = [
  '20260916_container_ladder_install_t_posts.sql',
  '20260918c_container_ladder_caliper.sql',
  '20260923e_container_ladder_install_price.sql',
  // `service_offerings.price_source` — applied live, and the column the data file flips.
  '20260923f_service_offerings_price_source.sql',
  '20260923h_container_ladder_grow_and_hold.sql',
  '20260924a_rung_entry_dates.sql',
  '20260924b_rung_sellability.sql',
  // the column #404 documents as NOT USED — applied live, never edited (§6 r1)
  '20260924d_container_ladder_pyt_price.sql',
];

const LAWNS = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const OTHER = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
const OWNER = '0a000000-0000-4000-8000-0000000000aa';

/** LAWNS's real rung labels and order, 2026-09-24. Labels only — no price is copied in. */
const LAWNS_RUNGS = [
  ['slip', 10, null], ['4 in', 20, null], ['3/5 gal', 30, 4], ['15 gal', 40, 15],
  ['30 gal', 50, 30], ['45 gal', 60, 45], ['65 gal', 70, 65], ['95/100', 80, 95],
  ['200 gal', 90, 200],
];
/** A second tenant, so every cross-tenant claim has something to be wrong about. */
const OTHER_RUNGS = [['1 gal', 10, 1], ['5 gal', 20, 5], ['15 gal', 30, 15]];

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };
const one = async (db, q, p = []) => (await db.query(q, p)).rows[0];

/** A database at the LIVE ladder shape, two tenants seeded, BEFORE 20260924d runs. */
async function fresh() {
  const db = await openLiveDb({ migrations: PRIOR });
  await db.exec(`insert into auth.users (id) values ('${OWNER}') on conflict do nothing`);
  for (const [id, name] of [[LAWNS, 'LAWNS copy'], [OTHER, 'Second tenant']]) {
    await db.query(`insert into public.businesses (id, owner_id, name, business_type, qbo_writes_enabled)
                    values ($1, $2, $3, 'nursery', false) on conflict do nothing`, [id, OWNER, name]);
  }
  await db.exec(`SET session_replication_role = replica`);
  const add = async (biz, [label, sort, gal]) => db.query(
    `insert into public.container_ladder (id, business_id, label, aliases, sort_order, volume_gallons,
        handling_because, active, created_at, updated_at)
     values (gen_random_uuid(), $1, $2, '{}', $3, $4, 'not timed', true, now(), now())`,
    [biz, label, sort, gal]);
  // LAWNS's seven live service_offerings rows, by name and price_source only — the data file's
  // subject. `Installation` already prices from the ladder; the rest are `fixed`.
  const svc = async (name, category, source, price, sort, mode) => db.query(
    `insert into public.service_offerings (id, business_id, name, category, timing, price_type,
        price_unit, price, price_source, transport_mode, is_active, sort_order)
     values (gen_random_uuid(), $1, $2, $3, 'at_checkout', 'per_unit', $4, $5, $6, $7, true, $8)`,
    [LAWNS, name, category, category === 'transport' ? 'order' : 'plant', price, source, mode, sort]);
  await svc('Plant Your Tree',          'addon',     'fixed',            125, 10, null);
  await svc('Tree Tarp',                'addon',     'fixed',             35, 11, null);
  await svc('Tree Bubbler',             'addon',     'fixed',             65, 12, null);
  await svc('Trip Charge',              'transport', 'fixed',             50, 100, 'staff');
  await svc('Tailgate Delivery',        'transport', 'fixed',            150, 101, 'staff');
  await svc('Installation',             'transport', 'container_ladder', 450, 102, 'staff');
  await svc('I will collect it myself', 'transport', 'fixed',              0, 103, 'self');
  for (const r of LAWNS_RUNGS) await add(LAWNS, r);
  for (const r of OTHER_RUNGS) await add(OTHER, r);
  // Two LAWNS rungs carry an install price, as live — so P8's invariant has something to measure
  // and is not trivially true on a table where no rung is priced at all.
  await db.query(`update public.container_ladder set install_price = 204.00,
                    install_price_because = 'billed median' where business_id=$1 and label='15 gal'`, [LAWNS]);
  await db.query(`update public.container_ladder set install_price = 450.00,
                    install_price_because = 'billed median' where business_id=$1 and label='45 gal'`, [LAWNS]);
  await db.exec(`SET session_replication_role = origin`);
  return db;
}

const run = async (db, sql) => {
  try { await db.exec(sql); return { ok: true, error: null }; }
  catch (e) { try { await db.exec('ROLLBACK'); } catch { /* nothing open */ } return { ok: false, error: String(e.message) }; }
};

// ── the run ───────────────────────────────────────────────────────────────────────────────────
const db = await fresh();
const applied = await run(db, MIG);
ok(applied.ok, `the migration runs end to end on the live schema${applied.ok ? '' : ` — ${applied.error}`}`);
if (!applied.ok) { console.error('\nNothing further can be measured.'); process.exit(1); }

// P1 / V1 — the CHECK is findable BY NAME.
{
  const r = await one(db, `select count(*)::int n, coalesce(string_agg(pg_get_constraintdef(oid),' · '),'') def
    from pg_constraint where conrelid='container_ladder'::regclass
      and conname='container_ladder_install_price_positive_check'`);
  ok(r.n === 1 && /install_price/.test(r.def), `P1/V1 the named CHECK exists — ${r.def || '(none)'}`);
}

// P2 / V3 — 🔴 THE FILE'S OWN V3, RUN VERBATIM. It must be REFUSED, by name.
{
  const z = await run(db, V3);
  ok(!z.ok && /container_ladder_install_price_positive_check/.test(z.error || ''),
     `P2/V3 a 0 install price is REFUSED by name — ${z.ok ? 'IT WAS ACCEPTED' : z.error.split('\n')[0]}`);
}

// P3 — a negative is refused too.
{
  const n = await run(db, `update public.container_ladder set install_price = -50 where business_id='${LAWNS}' and label='15 gal'`);
  ok(!n.ok && /container_ladder_install_price_positive_check/.test(n.error || ''), 'P3 a NEGATIVE install price is REFUSED by name');
}

// P4 / P5 — 🔴 THE NEGATIVE CONTROLS. A guard that refuses everything is not a guard, and "not
// set" must stay writable because it is the ordinary state (R-171 (c)).
{
  const y = await run(db, `update public.container_ladder set install_price = 225.00 where business_id='${LAWNS}' and label='15 gal'`);
  const back = await one(db, `select install_price from public.container_ladder where business_id='${LAWNS}' and label='15 gal'`);
  ok(y.ok && Number(back.install_price) === 225, `P4 a REAL price (225.00) is accepted — read back ${back.install_price}`);
  const nul = await run(db, `update public.container_ladder set install_price = null where business_id='${LAWNS}' and label='15 gal'`);
  const back2 = await one(db, `select install_price from public.container_ladder where business_id='${LAWNS}' and label='15 gal'`);
  ok(nul.ok && back2.install_price === null, 'P5 🔴 NULL is still accepted — "not set" is the ordinary state and must stay writable');
  await db.query(`update public.container_ladder set install_price = 204.00 where business_id=$1 and label='15 gal'`, [LAWNS]);
}

// P6 / V2 — no existing row violates the new rule.
{
  const r = await one(db, `select count(*) filter (where install_price is not null and install_price <= 0)::int bad,
     count(*) filter (where install_price is not null)::int priced from public.container_ladder`);
  ok(r.bad === 0 && r.priced > 0, `P6/V2 no row violates the rule (${r.bad}) and there are priced rows to violate it (${r.priced})`);
}

// P7 / V4 — 🔴 THE COMMENTS ARE THE ONLY THING STANDING BETWEEN `pyt_price` AND SOMEBODY WIRING TO
// IT, so they are asserted like any other guard.
{
  const r = await one(db, `select
     max(case when a.attname='install_price' then d.description end) inst,
     max(case when a.attname='pyt_price' then d.description end) pyt
    from pg_description d join pg_attribute a on a.attrelid=d.objoid and a.attnum=d.objsubid
   where d.objoid='container_ladder'::regclass and a.attname in ('install_price','pyt_price')`);
  ok(/Plant Your Tree/i.test(r.inst || ''), `P7/V4 install_price's comment says it serves Plant Your Tree too`);
  ok(/^NOT USED/.test(r.pyt || ''), `P7/V4 pyt_price's comment opens with NOT USED — "${(r.pyt||'').slice(0,34)}"`);
}

// P8 / V5 — pyt_price is empty everywhere, which is what makes "not used" true rather than hopeful.
{
  const r = await one(db, `select count(*) filter (where pyt_price is not null)::int priced,
     count(*) filter (where install_price is not null and coalesce(install_price_because,'')='')::int silent
     from public.container_ladder`);
  ok(r.priced === 0 && r.silent === 0, `P8/V5 pyt_price is null on every rung (${r.priced}) and no priced rung is silent (${r.silent})`);
}

// P9 / V6 — idempotence: the whole file re-runs and leaves exactly one constraint.
{
  const again = await run(db, MIG);
  const r = await one(db, `select count(*)::int n from pg_constraint
    where conrelid='container_ladder'::regclass and conname='container_ladder_install_price_positive_check'`);
  ok(again.ok && r.n === 1, `P9/V6 a second run leaves exactly one constraint — ${r.n}`);
}

// ── THE REVISED DATA FILE (§6 r26 covers it too) ─────────────────────────────────────────────
{
  const d = await run(db, DATA);
  ok(d.ok, `D1 the revised LAWNS data file runs end to end${d.ok ? '' : ` — ${d.error}`}`);
  const r = await one(db, `select
      count(*) filter (where name='Plant Your Tree' and price_source='container_ladder')::int pyt,
      count(*) filter (where name not in ('Plant Your Tree','Installation') and price_source<>'fixed')::int others
    from public.service_offerings where business_id='${LAWNS}'`);
  ok(r.pyt === 1 && r.others === 0, `D1 Plant Your Tree reads the ladder (${r.pyt}); nothing else moved (${r.others})`);
  const twice = await run(db, DATA);
  const still = await one(db, `select count(*) filter (where price_source='container_ladder')::int n
                                 from public.service_offerings where business_id='${LAWNS}'`);
  ok(twice.ok && still.n === 2, `D2 a second run changes nothing — still ${still.n} ladder-priced`);
}

// ── MUTANTS — a check nobody has watched refuse is a claim ([[R-33]]) ─────────────────────────
const mutant = async (label, transform, probe) => {
  const mdb = await fresh();
  const res = await run(mdb, transform(MIG));
  if (!res.ok) { ok(false, `${label} — the mutant would not even run: ${res.error.split('\n')[0]}`); return; }
  await probe(mdb, label);
};

// M1 — the CHECK as `>= 0`. P2 must catch it.
await mutant('M1 CHECK written `>= 0`',
  (x) => x.replace('CHECK (install_price IS NULL OR install_price > 0)', 'CHECK (install_price IS NULL OR install_price >= 0)'),
  async (mdb, label) => {
    const z = await run(mdb, `update public.container_ladder set install_price = 0 where business_id='${LAWNS}' and label='15 gal'`);
    ok(z.ok, `${label} — a 0 is now ACCEPTED, so P2 is what stands between the design and a free install`);
  });

// M3 — the pyt_price comment left saying it is in use. P7 must catch it.
await mutant('M3 pyt_price documented as in use',
  (x) => x.replace("'NOT USED — Plant Your Tree prices from install_price", "'In use — Plant Your Tree prices from this"),
  async (mdb, label) => {
    const r = await one(mdb, `select d.description from pg_description d join pg_attribute a
      on a.attrelid=d.objoid and a.attnum=d.objsubid
      where d.objoid='container_ladder'::regclass and a.attname='pyt_price'`);
    ok(!/^NOT USED/.test(r.description || ''),
       `${label} — the comment now reads "${(r.description||'').slice(0,26)}…", which P7 asserts must open with NOT USED`);
  });

// ── M2 — 🔴 THE ONE THAT PROVES THE LIVE READ WAS LOAD-BEARING ───────────────────────────────
// A row already at 0 must make the constraint REFUSE TO BE ADDED. That is exactly why the live
// read came before the SQL was written, and this is what it was protecting against.
{
  const mdb = await fresh();
  await mdb.exec(`SET session_replication_role = replica`);
  await mdb.query(`update public.container_ladder set install_price = 0 where business_id=$1 and label='15 gal'`, [LAWNS]);
  await mdb.exec(`SET session_replication_role = origin`);
  const res = await run(mdb, MIG);
  ok(!res.ok && /container_ladder_install_price_positive_check/.test(res.error || ''),
     `M2 🔴 with one rung already at 0 the migration REFUSES TO APPLY — ${res.ok ? 'IT APPLIED ANYWAY' : res.error.split('\n')[0]}`);
  const still = await one(mdb, `select count(*)::int n from pg_constraint
    where conrelid='container_ladder'::regclass and conname='container_ladder_install_price_positive_check'`);
  ok(still.n === 0, `M2 …and no constraint is left half-applied (${still.n}) — which is why the live read had to come first`);
}

console.log(fails === 0 ? `\n✅ all probes pass` : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
