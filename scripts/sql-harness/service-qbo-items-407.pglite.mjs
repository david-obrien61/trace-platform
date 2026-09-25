#!/usr/bin/env node
/**
 * ── service-qbo-items-407 — the migration AND the LAWNS data file, EXECUTED (§6 r26) ──────────
 *
 * PURPOSE:      Ledger #407. Both files David will paste are RUN by a Postgres engine first.
 *
 *                 P1  the migration runs end to end
 *                 P2  V1 — the four columns, right nullability
 *                 P3  V2 — the CHECK exists BY NAME (tech-debt #91)
 *                 P4  🔴 V3 — the file's own V3 is REFUSED: a row cannot be BOTH mapped and omitted
 *                 P5  V4 — the migration mapped nothing on any tenant
 *                 P6  the data file runs end to end
 *                 P7  V1(data) — no LAWNS service is left undecided
 *                 P8  🔴 V3(data) — each service points at the item it should, NAMED INDIVIDUALLY:
 *                     a transposed pair passes every count and bills a trip charge as a bubbler
 *                 P9  V4(data) — self-collect is OMITTED: flagged, no item, with a reason
 *                 P10 🔴 every mapping cites the DESCRIPTION, and not one says "guess"
 *                 P11 V5 — no other tenant was touched (AC-3)
 *                 P12 V6 — idempotence
 *                 M1  🔴 mutant: two mappings transposed — only P8 catches it
 *                 M2  mutant: self-collect mapped instead of omitted — P9 catches it
 *                 M3  mutant: a mapping with an empty reason — P10 catches it
 *
 * DEPENDENCIES: @electric-sql/pglite (dev) · liveDb · both SQL files.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure.
 * ⚠️ PGlite is Postgres 18 and Supabase runs an older major.
 *
 * Run: node scripts/sql-harness/service-qbo-items-407.pglite.mjs
 */
import { readFileSync } from 'node:fs';
import { openLiveDb } from '../path-tests/lib/liveDb.mjs';

const WHOLE = readFileSync(`${process.cwd()}/supabase/migrations/20260925_service_offerings_qbo_item.sql`, 'utf8');
// V3 is live SQL that must FAIL; split it out and run it verbatim, as its own header tells David.
const V3_RE = /UPDATE service_offerings SET qbo_omit = true[\s\S]*?;\n/;
const V3 = (WHOLE.match(V3_RE) || [''])[0];
if (!V3) { console.error('FAIL could not find V3 in the migration'); process.exit(1); }
const MIG = WHOLE.replace(V3_RE, '');
const DATA = readFileSync(`${process.cwd()}/docs/decisions/2026-09-25-lawns-service-qbo-items.sql`, 'utf8');

const PRIOR = ['20260923f_service_offerings_price_source.sql'];
const LAWNS = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const OTHER = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
const OWNER = '0a000000-0000-4000-8000-0000000000aa';
/** LAWNS's seven live services, read 2026-09-25 — names, categories and order only. */
const SVC = [
  ['Plant Your Tree','addon','plant',125,10,null],
  ['Tree Tarp','addon','order',35,11,null],
  ['Tree Bubbler','addon','plant',65,12,null],
  ['Trip Charge','transport','order',50,100,'staff'],
  ['Tailgate Delivery','transport','order',150,101,'staff'],
  ['Installation','transport','plant',450,102,'staff'],
  ['I will collect it myself','transport','order',0,103,'self'],
];

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };
const one = async (db, q, p = []) => (await db.query(q, p)).rows[0];
const run = async (db, sql) => {
  try { await db.exec(sql); return { ok: true, error: null }; }
  catch (e) { try { await db.exec('ROLLBACK'); } catch { /* none */ } return { ok: false, error: String(e.message) }; }
};

async function fresh() {
  const db = await openLiveDb({ migrations: PRIOR });
  await db.exec(`insert into auth.users (id) values ('${OWNER}') on conflict do nothing`);
  for (const [id, nm] of [[LAWNS, 'LAWNS copy'], [OTHER, 'Second tenant']]) {
    await db.query(`insert into public.businesses (id, owner_id, name, business_type, qbo_writes_enabled)
                    values ($1,$2,$3,'nursery',false) on conflict do nothing`, [id, OWNER, nm]);
  }
  await db.exec(`SET session_replication_role = replica`);
  const add = async (biz, [name, cat, unit, price, sort, mode]) => db.query(
    `insert into public.service_offerings (id, business_id, name, category, timing, price_type,
        price_unit, price, price_source, transport_mode, is_active, sort_order)
     values (gen_random_uuid(), $1, $2, $3, 'at_checkout', 'per_unit', $4, $5, 'fixed', $6, true, $7)`,
    [biz, name, cat, unit, price, mode, sort]);
  for (const s of SVC) await add(LAWNS, s);
  // a second tenant with its own services — so "no other tenant was touched" can be wrong
  await add(OTHER, ['Placement Service', 'transport', 'plant', 225, 10, 'staff']);
  await db.exec(`SET session_replication_role = origin`);
  return db;
}

const db = await fresh();
{
  const r = await run(db, MIG);
  ok(r.ok, `P1 the migration runs end to end${r.ok ? '' : ` — ${r.error}`}`);
  if (!r.ok) process.exit(1);
}
{
  const r = await one(db, `select count(*)::int n,
      bool_and(case when column_name in ('qbo_item_id','qbo_item_name') then is_nullable='YES'
                    else is_nullable='NO' and column_default is not null end) shape
    from information_schema.columns where table_schema='public' and table_name='service_offerings'
      and column_name in ('qbo_item_id','qbo_item_name','qbo_item_because','qbo_omit')`);
  ok(r.n === 4 && r.shape === true, `P2/V1 four columns with the right nullability (${r.n}, shape ${r.shape})`);
}
{
  const r = await one(db, `select count(*)::int n from pg_constraint
    where conrelid='service_offerings'::regclass and conname='service_offerings_qbo_mapped_or_omitted_check'`);
  ok(r.n === 1, `P3/V2 the named CHECK exists (${r.n})`);
}
{
  const z = await run(db, V3);
  ok(!z.ok && /service_offerings_qbo_mapped_or_omitted_check/.test(z.error || ''),
     `P4/V3 a row cannot be BOTH mapped and omitted — ${z.ok ? 'IT WAS ACCEPTED' : 'refused by name'}`);
}
{
  const r = await one(db, `select count(*) filter (where qbo_item_id is not null)::int m,
     count(*) filter (where qbo_omit)::int o from public.service_offerings`);
  ok(r.m === 0 && r.o === 0, `P5/V4 the migration mapped nothing (${r.m}) and omitted nothing (${r.o})`);
}
{
  const r = await run(db, DATA);
  ok(r.ok, `P6 the LAWNS data file runs end to end${r.ok ? '' : ` — ${r.error}`}`);
}
{
  const r = await one(db, `select count(*) filter (where qbo_item_id is null and not qbo_omit)::int undecided,
     count(*)::int total from public.service_offerings where business_id='${LAWNS}'`);
  ok(r.undecided === 0, `P7/V1 no LAWNS service is left undecided (${r.undecided} of ${r.total})`);
}
{
  // 🔴 NAMED INDIVIDUALLY. A transposed pair passes every count-based check ever written.
  const want = [['Trip Charge','186'],['Tailgate Delivery','117'],['Tree Bubbler','185'],
                ['Installation','137'],['Plant Your Tree','164'],['Tree Tarp','203']];
  let bad = [];
  for (const [name, id] of want) {
    const r = await one(db, `select qbo_item_id i from public.service_offerings where business_id=$1 and name=$2`, [LAWNS, name]);
    if (r.i !== id) bad.push(`${name}→${r.i} (want ${id})`);
  }
  ok(bad.length === 0, `P8/V3 🔴 each service points at the item it should${bad.length ? ' — WRONG: ' + bad.join(', ') : ' (all 6)'}`);
}
{
  const r = await one(db, `select qbo_omit o, qbo_item_id i, coalesce(qbo_item_because,'') b
    from public.service_offerings where business_id=$1 and name='I will collect it myself'`, [LAWNS]);
  ok(r.o === true && r.i === null && r.b !== '',
     `P9/V4 self-collect is OMITTED — flagged ${r.o}, no item ${r.i === null}, reason present ${r.b !== ''}`);
}
{
  const r = await one(db, `select
     count(*) filter (where qbo_item_id is not null and qbo_item_because not ilike '%description%')::int nodesc,
     count(*) filter (where qbo_item_because ilike '%guess%')::int guesses
     from public.service_offerings where business_id='${LAWNS}'`);
  ok(r.nodesc === 0 && r.guesses === 0,
     `P10 🔴 every mapping cites the DESCRIPTION (${r.nodesc} without) and not one is a guess (${r.guesses}) — David, 2026-09-25`);
}
{
  const r = await one(db, `select count(*) filter (where qbo_item_id is not null or qbo_omit)::int touched,
     count(*)::int total from public.service_offerings where business_id<>'${LAWNS}'`);
  ok(r.touched === 0 && r.total > 0, `P11/V5 no other tenant touched (${r.touched} of ${r.total}) — and there WAS one to touch`);
}
{
  const before = await one(db, `select md5(string_agg(name||coalesce(qbo_item_id,'-')||qbo_omit::text,'|' order by sort_order)) h
    from public.service_offerings where business_id='${LAWNS}'`);
  const again = await run(db, DATA);
  const after = await one(db, `select md5(string_agg(name||coalesce(qbo_item_id,'-')||qbo_omit::text,'|' order by sort_order)) h
    from public.service_offerings where business_id='${LAWNS}'`);
  ok(again.ok && before.h === after.h, `P12/V6 a second run changes nothing — hash identical`);
}

// ── MUTANTS ──────────────────────────────────────────────────────────────────────────────────
const mutant = async (label, transform, probe) => {
  const mdb = await fresh();
  await run(mdb, MIG);
  const res = await run(mdb, transform(DATA));
  if (!res.ok) { ok(false, `${label} — the mutant would not run: ${res.error.split('\n')[0]}`); return; }
  await probe(mdb, label);
};

// 🔴 M1 — THE ONE THE COUNTS CANNOT SEE. Swap two ids: every count stays identical, every
// "is it decided" check passes, and LAWNS bills a trip charge against a bubbler.
await mutant('M1 Trip Charge and Tree Bubbler transposed',
  (s) => s.replace("('Trip Charge',       '186'", "('Trip Charge',       '185'")
          .replace("('Tree Bubbler',      '185'", "('Tree Bubbler',      '186'"),
  async (mdb, label) => {
    const r = await one(mdb, `select count(*) filter (where qbo_item_id is null and not qbo_omit)::int undecided,
       (select qbo_item_id from public.service_offerings where business_id='${LAWNS}' and name='Trip Charge') tc
       from public.service_offerings where business_id='${LAWNS}'`);
    ok(r.undecided === 0 && r.tc === '185',
       `${label} — still 0 undecided, so every COUNT passes; Trip Charge now points at ${r.tc}. Only P8's named check sees it.`);
  });

await mutant('M2 self-collect mapped instead of omitted',
  (s) => s.replace("('I will collect it myself', NULL, NULL,", "('I will collect it myself', '186', 'TC',")
          .replace(/Omitted so the push does not refuse an order over a line that was never meant to go\.', true\)/,
                   "Omitted so the push does not refuse an order over a line that was never meant to go.', false)"),
  async (mdb, label) => {
    const r = await one(mdb, `select qbo_omit o, qbo_item_id i from public.service_offerings
      where business_id='${LAWNS}' and name='I will collect it myself'`);
    ok(r.o === false && r.i !== null, `${label} — it comes out mapped (${r.i}) rather than omitted, which P9 asserts must not happen`);
  });

await mutant('M3 a mapping with no source',
  (s) => s.replace(/'QuickBooks item description \+ David 2026-09-25\. Item 203[^']*(?:''[^']*)*'/, "''"),
  async (mdb, label) => {
    const r = await one(mdb, `select count(*) filter (where qbo_item_id is not null and coalesce(qbo_item_because,'')='')::int silent
      from public.service_offerings where business_id='${LAWNS}'`);
    ok(r.silent > 0, `${label} — ${r.silent} mapped rows come out with no source, which P10/V2 assert must be 0`);
  });

console.log(fails === 0 ? `\n✅ all probes pass` : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
