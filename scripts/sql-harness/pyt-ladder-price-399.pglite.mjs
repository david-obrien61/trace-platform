#!/usr/bin/env node
/**
 * ── pyt-ladder-price-399 — 20260924d EXECUTED END TO END ON THE LIVE SCHEMA (§6 r26) ──────────
 *
 * PURPOSE:      Ledger #399. §6 r26, David 2026-09-24: *"any SQL handed to David is executed end
 *               to end in one BEGIN … COMMIT against live-schema-public.sql."* So the file he will
 *               paste is RUN here by a Postgres engine before he ever sees it, and its own
 *               V-blocks are answered in the verdict style rather than predicted.
 *
 *                 P1  V1 — the two columns, nullable/NOT NULL, no default on the price
 *                 P2  V2 — the CHECK exists and is findable BY NAME (tech-debt #91)
 *                 P3  🔴 V3 — the CHECK actually REFUSES a 0, and says so by name ([[R-33]])
 *                 P4  🔴 a NEGATIVE is refused too — not just 0
 *                 P5  a real price (125.00) is ACCEPTED — the guard is not refusing everything
 *                 P6  V4 — no rung on ANY tenant carries a blank reason
 *                 P7  V5 — the migration wrote NO price anywhere
 *                 P8  V6 — install pricing intact: no rung is priced-but-silent
 *                 P9  V7 — idempotence: the whole file re-runs and changes nothing
 *                 P10 the two tenants get DIFFERENT reasons — LAWNS's measured one, the generic
 *                     one everywhere else — so section 4 is proven to be a separate branch
 *                 P11 a rung added AFTER the migration gets '' and is therefore visible to V4
 *                     (the honest limit of a one-shot seed, asserted rather than assumed)
 *                 M1  mutant: the CHECK written `>= 0` — P3 must catch it
 *                 M2  mutant: section 4 deleted — P6 must catch it (the probe reaches the whole
 *                     population, not only LAWNS; tech-debt #182's class)
 *                 D1  the LAWNS data file runs end to end, and flips ONLY Plant Your Tree
 *                 D2  it is idempotent — a second run changes nothing
 *                 D3  it changes no OTHER offering's price_source
 *                 M3  mutant: the seed also writes a price — P7 must catch it
 *                 M4  mutant: the data file's guard dropped — D2 must catch it
 *
 * 🔴 WHY MIGRATIONS ARE REPLAYED ON TOP OF THE SNAPSHOT, SAID PLAINLY: the fixture's
 *    `container_ladder` is the ORIGINAL 20260914 shape — no `install_price`, no t-posts, no
 *    caliper, no grow/hold. Those ALTERs are all APPLIED LIVE and post-date the snapshot, so the
 *    snapshot alone is NOT the live shape and a run against it would prove the wrong thing.
 *    They are replayed in order first, which is what `openLiveDb({ migrations })` exists for.
 *
 * DEPENDENCIES: @electric-sql/pglite (dev) · liveDb · the migration files.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure.
 * ⚠️ PGlite is Postgres 18 and Supabase runs an older major: this proves the SQL is well-formed
 *    and that the constraint BITES. It does not replace applying it.
 *
 * Run: node scripts/sql-harness/pyt-ladder-price-399.pglite.mjs
 */
import { readFileSync } from 'node:fs';
import { openLiveDb } from '../path-tests/lib/liveDb.mjs';

const FILE = `${process.cwd()}/supabase/migrations/20260924d_container_ladder_pyt_price.sql`;
const MIG = readFileSync(FILE, 'utf8');
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

// P1 / V1 — the shape.
{
  const r = await one(db, `select count(*)::int n,
      bool_and(case when column_name='pyt_price' then is_nullable='YES' and column_default is null
                    else is_nullable='NO' and column_default is not null end) shape
    from information_schema.columns
   where table_schema='public' and table_name='container_ladder'
     and column_name in ('pyt_price','pyt_price_because')`);
  ok(r.n === 2 && r.shape === true, `P1/V1 both columns exist; price nullable with NO default (found ${r.n}, shape ${r.shape})`);
}

// P2 / V2 — the CHECK is findable BY NAME.
{
  const r = await one(db, `select count(*)::int n, coalesce(string_agg(pg_get_constraintdef(oid),' · '),'') def
    from pg_constraint where conrelid='container_ladder'::regclass
      and conname='container_ladder_pyt_price_positive_check'`);
  ok(r.n === 1 && /pyt_price/.test(r.def) && />\s*\(?0/.test(r.def),
     `P2/V2 the named CHECK exists — ${r.def || '(none)'}`);
}

// P3 / V3 — 🔴 IT REFUSES A ZERO, AND THE ERROR NAMES THE CONSTRAINT.
{
  const z = await run(db, `update public.container_ladder set pyt_price = 0 where business_id='${LAWNS}' and label='15 gal'`);
  ok(!z.ok && /container_ladder_pyt_price_positive_check/.test(z.error || ''),
     `P3/V3 a 0 price is REFUSED by name — ${z.ok ? 'IT WAS ACCEPTED' : z.error.split('\n')[0]}`);
}

// P4 — a negative is refused too. 0 is the value the design is about; negative is the other way out.
{
  const n = await run(db, `update public.container_ladder set pyt_price = -50 where business_id='${LAWNS}' and label='15 gal'`);
  ok(!n.ok && /container_ladder_pyt_price_positive_check/.test(n.error || ''),
     `P4 a NEGATIVE price is REFUSED by name — ${n.ok ? 'IT WAS ACCEPTED' : 'refused'}`);
}

// P5 — 🔴 THE NEGATIVE CONTROL FOR P3/P4. A guard that refuses everything is not a guard.
{
  const y = await run(db, `update public.container_ladder set pyt_price = 125.00 where business_id='${LAWNS}' and label='15 gal'`);
  const back = await one(db, `select pyt_price from public.container_ladder where business_id='${LAWNS}' and label='15 gal'`);
  ok(y.ok && Number(back.pyt_price) === 125, `P5 a REAL price (125.00) is accepted and stored — read back ${back.pyt_price}`);
  await db.query(`update public.container_ladder set pyt_price = null where business_id=$1 and label='15 gal'`, [LAWNS]);
}

// P6 / V4 — every rung on every tenant says why.
{
  const r = await one(db, `select count(*) filter (where pyt_price_because='')::int silent,
     count(*)::int total, count(distinct business_id)::int tenants from public.container_ladder`);
  ok(r.silent === 0 && r.tenants === 2,
     `P6/V4 no rung on any tenant is silent — ${r.silent} silent of ${r.total} rungs across ${r.tenants} tenants`);
}

// P7 / V5 — the migration wrote no price at all.
{
  const r = await one(db, `select count(*) filter (where pyt_price is not null)::int priced from public.container_ladder`);
  ok(r.priced === 0, `P7/V5 the seed set no price anywhere — ${r.priced} priced`);
}

// P8 / V6 — install pricing intact, as an INVARIANT rather than a count.
{
  const r = await one(db, `select
     count(*) filter (where install_price is not null and coalesce(install_price_because,'')='')::int silent,
     count(*) filter (where install_price is not null)::int priced from public.container_ladder`);
  ok(r.silent === 0 && r.priced === 2,
     `P8/V6 no rung is install-priced-but-silent (${r.silent}); the 2 seeded install prices survived (${r.priced})`);
}

// P9 / V7 — 🔴 IDEMPOTENCE, THE ONE THAT PROTECTS AN EDIT SOMEONE HAS MADE.
{
  await db.query(`update public.container_ladder set pyt_price_because='Lauren set this by hand'
                  where business_id=$1 and label='30 gal'`, [LAWNS]);
  const again = await run(db, MIG);
  const r = await one(db, `select pyt_price_because b from public.container_ladder where business_id=$1 and label='30 gal'`, [LAWNS]);
  ok(again.ok && r.b === 'Lauren set this by hand',
     `P9/V7 a second run leaves a corrected reason alone — "${r.b.slice(0, 40)}"`);
}

// P10 — the two branches are genuinely two. LAWNS gets the measured sentence; nobody else does.
{
  const l = await one(db, `select pyt_price_because b from public.container_ladder where business_id=$1 and label='15 gal'`, [LAWNS]);
  const o = await one(db, `select pyt_price_because b from public.container_ladder where business_id=$1 and label='15 gal'`, [OTHER]);
  ok(/invoiced five Plant Your Tree lines/.test(l.b) && /Nobody has told the system/.test(o.b) && l.b !== o.b,
     `P10 LAWNS gets its measured reason, the second tenant the generic one — they differ: ${l.b !== o.b}`);
}

// P11 — 🔴 THE HONEST LIMIT, ASSERTED RATHER THAN LEFT TO BE DISCOVERED.
// A one-shot seed cannot reach a rung created later; that rung gets the DEFAULT ''. This is not a
// defect of the migration, it is the shape of a seed — and it is exactly what V4 is for, so the
// screen can be told. Asserting it here means nobody later reads V4's PASS as "this can never fail".
{
  await db.exec(`SET session_replication_role = replica`);
  await db.query(`insert into public.container_ladder (id, business_id, label, aliases, sort_order,
      handling_because, active, created_at, updated_at)
    values (gen_random_uuid(), $1, '7 gal', '{}', 45, 'not timed', true, now(), now())`, [LAWNS]);
  await db.exec(`SET session_replication_role = origin`);
  const r = await one(db, `select pyt_price_because b from public.container_ladder where business_id=$1 and label='7 gal'`, [LAWNS]);
  const v4 = await one(db, `select count(*) filter (where pyt_price_because='')::int silent from public.container_ladder`);
  ok(r.b === '' && v4.silent === 1,
     `P11 a rung added later carries '' and V4 SEES it (silent now ${v4.silent}) — the seed's limit, made visible`);
}

// ── THE DATA FILE DAVID RUNS AFTER IT (§6 r26 covers this too) ───────────────────────────────
{
  const before = await one(db, `select count(*) filter (where price_source='container_ladder')::int n
                                  from public.service_offerings where business_id='${LAWNS}'`);
  const d = await run(db, DATA);
  ok(d.ok, `D1 the LAWNS data file runs end to end${d.ok ? '' : ` — ${d.error}`}`);
  const after = await one(db, `select
      count(*) filter (where name='Plant Your Tree' and price_source='container_ladder')::int pyt,
      count(*) filter (where price_source='container_ladder')::int total,
      count(*) filter (where name not in ('Plant Your Tree','Installation') and price_source<>'fixed')::int others
    from public.service_offerings where business_id='${LAWNS}'`);
  ok(after.pyt === 1, `D1 Plant Your Tree now prices from the ladder`);
  ok(after.others === 0 && after.total === before.n + 1,
     `D3 nothing else moved — ladder-priced went ${before.n} → ${after.total}, other rows off-ladder ${after.others}`);

  // 🔴 D2 — THE GUARD. The file must be safe to paste twice, because it will be.
  const twice = await run(db, DATA);
  const still = await one(db, `select count(*) filter (where price_source='container_ladder')::int n
                                 from public.service_offerings where business_id='${LAWNS}'`);
  ok(twice.ok && still.n === after.total, `D2 a second run changes nothing — still ${still.n} ladder-priced`);
}

// ── MUTANTS — a check nobody has watched refuse is a claim ([[R-33]]) ─────────────────────────
const mutant = async (label, transform, probe) => {
  const mdb = await fresh();
  const res = await run(mdb, transform(MIG));
  if (!res.ok) { ok(false, `${label} — the mutant would not even run: ${res.error.split('\n')[0]}`); return; }
  await probe(mdb, label);
};

// M1 — the CHECK as `>= 0`. P3 must catch it.
await mutant('M1 CHECK written `>= 0`',
  (s) => s.replace('CHECK (pyt_price IS NULL OR pyt_price > 0)', 'CHECK (pyt_price IS NULL OR pyt_price >= 0)'),
  async (mdb, label) => {
    const z = await run(mdb, `update public.container_ladder set pyt_price = 0 where business_id='${LAWNS}' and label='15 gal'`);
    ok(z.ok, `${label} — a 0 is now ACCEPTED, so P3 is what stands between the design and a free planting`);
  });

// M2 — section 4 deleted. P6 must catch it, and it can only do so because it counts EVERY tenant.
await mutant('M2 the other-tenant reason branch deleted',
  (s) => s.replace(/UPDATE container_ladder SET\n  pyt_price_because = 'Not set\. Nobody has told[\s\S]*?WHERE pyt_price_because = '';/, ''),
  async (mdb, label) => {
    const r = await one(mdb, `select count(*) filter (where pyt_price_because='')::int silent,
       count(*) filter (where business_id='${LAWNS}' and pyt_price_because='')::int lawns_silent
       from public.container_ladder`);
    ok(r.silent === 3 && r.lawns_silent === 0,
       `${label} — ${r.silent} rungs go silent and NONE of them is LAWNS's, which is why a LAWNS-only probe would have passed`);
  });

// M3 — the seed also writes a price. P7 must catch it.
await mutant('M3 the reason seed also writes a price',
  (s) => s.replace("pyt_price_because = 'Not set. Nobody has told",
                   "pyt_price = 99.00, pyt_price_because = 'Not set. Nobody has told"),
  async (mdb, label) => {
    const r = await one(mdb, `select count(*) filter (where pyt_price is not null)::int priced from public.container_ladder`);
    ok(r.priced > 0, `${label} — ${r.priced} rungs come out priced, which P7 asserts must be 0`);
  });

// M4 — the data file's `price_source = 'fixed'` guard dropped. It still lands the same way once,
// so only a SECOND run can tell the difference — which is exactly what D2 does and why it exists.
{
  const mdb = await fresh();
  await run(mdb, MIG);
  const unguarded = DATA.replace("   AND price_source = 'fixed';   -- guard: a second run changes 0 rows", '   ;');
  const first = await run(mdb, unguarded);
  const n1 = await one(mdb, `select count(*) filter (where price_source='container_ladder')::int n,
      count(*) filter (where name='Trip Charge' and price_source='container_ladder')::int tc
      from public.service_offerings where business_id='${LAWNS}'`);
  ok(first.ok && n1.tc === 0,
     `M4 without the guard the file STILL lands correctly the first time (${n1.n} ladder-priced, Trip Charge untouched) — which is why a one-run probe proves nothing about idempotence`);
}

console.log(fails === 0 ? `\n✅ all probes pass` : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
