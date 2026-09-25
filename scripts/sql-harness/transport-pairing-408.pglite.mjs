#!/usr/bin/env node
/**
 * ── transport-pairing-408 — the migration AND the LAWNS data file, EXECUTED (§6 r26) ──────────
 *
 * PURPOSE:      Ledger #408. Both files David will paste are RUN by a Postgres engine first, on a
 *               tenant seeded to LAWNS's REAL rows as he found them at the counter on 2026-09-25:
 *               Tailgate at $150, Backyard at $100 flat, Tree Tarp saying per_unit/order.
 *
 *                 P1  the migration runs end to end
 *                 P2  V1 — four columns, NOT NULL, neutral defaults (adding one changes nothing)
 *                 P3  V2 — both named CHECKs exist
 *                 P4  🔴 V3 — an ADDON cannot claim to offer installation
 *                 P5  🔴 V4 — line_rows refuses an object; an array is the only shape
 *                 P6  V5 — the migration turned no behaviour on, on any tenant
 *                 P7  the data file runs end to end
 *                 P8  🔴 V1(data) — EXACTLY ONE row offers installation and it is TRIP CHARGE.
 *                     This is the defect David hit, asserted by NAME and not by count.
 *                 P9  V2(data) — TC $50 · Tailgate $50 (was $150) · Backyard $50 · self $0
 *                 P10 🔴 V3(data) — only BACKYARD demands an amount at the counter
 *                 P11 🔴 V4(data) — Tree Tarp is flat/order, $35, quantity editable
 *                 P12 V5/V6(data) — the ladder rows keep their scalars; no other tenant moved
 *                 P13 V7(data) — idempotence
 *                 M1  🔴 mutant: installation paired with TAILGATE instead — P8 must catch it,
 *                     and the COUNT still reads 1, which is why P8 names the row
 *                 M2  mutant: Tailgate left at $150 — P9 must catch it
 *                 M3  mutant: Tree Tarp left per_unit — P11 must catch it
 *                 M4  🔴 mutant: `amount_required_at_sale` set on TRIP CHARGE too — P10 catches
 *                     it, and the point is that it would force Lauren to type an amount on the
 *                     commonest branch in the shop
 *
 * DEPENDENCIES: @electric-sql/pglite (dev) · liveDb · both SQL files.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure.
 *
 * Run: node scripts/sql-harness/transport-pairing-408.pglite.mjs
 */
import { readFileSync } from 'node:fs';
import { openLiveDb } from '../path-tests/lib/liveDb.mjs';

const WHOLE = readFileSync(`${process.cwd()}/supabase/migrations/20260925c_transport_pairing_and_service_rows.sql`, 'utf8');
const V3_RE = /UPDATE service_offerings SET offers_installation = true\n[\s\S]*?;\n/;
const V4_RE = /UPDATE order_service_selections SET line_rows = '\{[\s\S]*?;\n/;
const V3 = (WHOLE.match(V3_RE) || [''])[0];
const V4 = (WHOLE.match(V4_RE) || [''])[0];
if (!V3 || !V4) { console.error('FAIL could not lift V3/V4 out of the migration'); process.exit(1); }
const MIG = WHOLE.replace(V3_RE, '').replace(V4_RE, '');
const DATA = readFileSync(`${process.cwd()}/docs/decisions/2026-09-25-lawns-transport-and-tarp.sql`, 'utf8');

const PRIOR = ['20260923f_service_offerings_price_source.sql'];
const LAWNS = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const OTHER = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
const OWNER = '0a000000-0000-4000-8000-0000000000aa';
/** 🔴 LAWNS AS DAVID FOUND IT — the wrong figures are the fixture, or nothing is being fixed. */
const SVC = [
  ['Plant Your Tree','addon','per_unit','plant',125,10,null,'container_ladder'],
  ['Tree Tarp','addon','per_unit','order',35,11,null,'fixed'],          // ← the contradiction
  ['Tree Bubbler','addon','per_unit','plant',65,12,null,'fixed'],
  ['Backyard','transport','flat','order',100,17,'staff','fixed'],        // ← $100 flat
  ['Trip Charge','transport','flat','order',50,100,'staff','fixed'],
  ['Tailgate Delivery','transport','flat','order',150,101,'staff','fixed'], // ← $150
  ['Installation','transport','per_unit','plant',450,102,'staff','container_ladder'],
  ['I will collect it myself','transport','flat','order',0,103,'self','fixed'],
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
  const add = async (biz, [name, cat, ptype, unit, price, sort, mode, src]) => db.query(
    `insert into public.service_offerings (id, business_id, name, category, timing, price_type,
        price_unit, price, price_source, transport_mode, is_active, sort_order)
     values (gen_random_uuid(), $1,$2,$3,'at_checkout',$4,$5,$6,$7,$8,true,$9)`,
    [biz, name, cat, ptype, unit, price, src, mode, sort]);
  for (const s of SVC) await add(LAWNS, s);
  await add(OTHER, ['Placement Service','transport','per_unit','plant',225,10,'staff','fixed']);
  // one order + one selection, so V6/V4 have a row to be wrong about
  const cust = '0c000000-0000-4000-8000-0000000000cc';
  await db.query(`insert into public.customers (id, business_id, first_name, last_name, marketing_opt_in, source, lifetime_value, created_at)
                  values ($1,$2,'A','Customer',false,'test',0,now()) on conflict do nothing`, [cust, LAWNS]);
  const ord = '0d000000-0000-4000-8000-0000000000dd';
  await db.query(`insert into public.orders (id, business_id, customer_id, status, transport_method, subtotal, tax_amount, total_amount)
                  values ($1,$2,$3,'pending','self',0,0,0) on conflict do nothing`, [ord, LAWNS, cust]);
  const svc = await one(db, `select id from public.service_offerings where business_id=$1 and name='Tree Tarp'`, [LAWNS]);
  await db.query(`insert into public.order_service_selections (id, order_id, service_offering_id, quantity, unit_price_at_time, subtotal)
                  values (gen_random_uuid(), $1, $2, 1, 35, 35)`, [ord, svc.id]);
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
  const r = await one(db, `select count(*)::int n, bool_and(is_nullable='NO' and column_default is not null) ok
    from information_schema.columns where table_schema='public'
      and ((table_name='service_offerings' and column_name in ('offers_installation','amount_required_at_sale','quantity_editable'))
        or (table_name='order_service_selections' and column_name='line_rows'))`);
  ok(r.n === 4 && r.ok === true, `P2/V1 four columns, NOT NULL with neutral defaults (${r.n})`);
}
{
  const r = await one(db, `select count(*)::int n from pg_constraint where conname in
    ('service_offerings_installation_pairs_transport_check','order_service_selections_line_rows_is_array_check')`);
  ok(r.n === 2, `P3/V2 both named CHECKs exist (${r.n})`);
}
{
  const z = await run(db, V3);
  ok(!z.ok && /installation_pairs_transport/.test(z.error || ''),
     `P4/V3 an ADDON cannot offer installation — ${z.ok ? 'IT WAS ACCEPTED' : 'refused by name'}`);
}
{
  const z = await run(db, V4);
  ok(!z.ok && /line_rows_is_array/.test(z.error || ''),
     `P5/V4 line_rows refuses an object — ${z.ok ? 'IT WAS ACCEPTED' : 'refused by name'}`);
}
{
  const r = await one(db, `select count(*) filter (where offers_installation)::int a,
     count(*) filter (where amount_required_at_sale)::int b, count(*) filter (where quantity_editable)::int c
     from public.service_offerings`);
  ok(r.a === 0 && r.b === 0 && r.c === 0, `P6/V5 the migration turned no behaviour on (${r.a}/${r.b}/${r.c})`);
}
{
  const r = await run(db, DATA);
  ok(r.ok, `P7 the LAWNS data file runs end to end${r.ok ? '' : ` — ${r.error}`}`);
}
{
  const r = await one(db, `select count(*) filter (where offers_installation)::int n,
     coalesce(string_agg(name,' · ') filter (where offers_installation),'(none)') which
     from public.service_offerings where business_id='${LAWNS}'`);
  ok(r.n === 1 && r.which === 'Trip Charge',
     `P8/V1 🔴 exactly one row offers installation and it is ${r.which} — the defect David hit`);
}
{
  const r = await one(db, `select
     max(price) filter (where name='Trip Charge') tc, max(price) filter (where name='Tailgate Delivery') tg,
     max(price) filter (where name='Backyard') by, max(price) filter (where name='I will collect it myself') sc
     from public.service_offerings where business_id='${LAWNS}'`);
  ok(Number(r.tc) === 50 && Number(r.tg) === 50 && Number(r.by) === 50 && Number(r.sc) === 0,
     `P9/V2 TC $${r.tc} · Tailgate $${r.tg} (was 150) · Backyard $${r.by} · self $${r.sc}`);
}
{
  const r = await one(db, `select count(*) filter (where amount_required_at_sale)::int n,
     coalesce(string_agg(name,' · ') filter (where amount_required_at_sale),'(none)') which
     from public.service_offerings where business_id='${LAWNS}'`);
  ok(r.n === 1 && r.which === 'Backyard',
     `P10/V3 🔴 only ${r.which} demands an amount at the counter — Trip Charge must never ask`);
}
{
  const r = await one(db, `select price_type pt, price_unit pu, price::text p, quantity_editable qe
     from public.service_offerings where business_id='${LAWNS}' and name='Tree Tarp'`);
  ok(r.pt === 'flat' && r.pu === 'order' && Number(r.p) === 35 && r.qe === true,
     `P11/V4 🔴 Tree Tarp is ${r.pt}/${r.pu} $${r.p} qty_editable=${r.qe} — one representation, #252 closed for this row`);
}
{
  const r = await one(db, `select
     count(*) filter (where name='Installation' and price_source='container_ladder' and price=450)::int inst,
     count(*) filter (where name='Plant Your Tree' and price_source='container_ladder' and price=125)::int pyt,
     (select count(*) filter (where offers_installation or amount_required_at_sale or quantity_editable)::int
        from public.service_offerings where business_id<>'${LAWNS}') other
     from public.service_offerings where business_id='${LAWNS}'`);
  ok(r.inst === 1 && r.pyt === 1 && r.other === 0,
     `P12/V5+V6 the ladder rows keep their unused scalars (${r.inst}/${r.pyt}) and no other tenant moved (${r.other})`);
}
{
  const before = await one(db, `select md5(string_agg(name||price::text||offers_installation::text||amount_required_at_sale::text||quantity_editable::text||price_type,'|' order by sort_order)) h
    from public.service_offerings where business_id='${LAWNS}'`);
  const again = await run(db, DATA);
  const after = await one(db, `select md5(string_agg(name||price::text||offers_installation::text||amount_required_at_sale::text||quantity_editable::text||price_type,'|' order by sort_order)) h
    from public.service_offerings where business_id='${LAWNS}'`);
  ok(again.ok && before.h === after.h, `P13/V7 a second run changes nothing — hash identical`);
}

// ── MUTANTS ──────────────────────────────────────────────────────────────────────────────────
const mutant = async (label, transform, probe) => {
  const mdb = await fresh();
  await run(mdb, MIG);
  const res = await run(mdb, transform(DATA));
  if (!res.ok) { ok(false, `${label} — the mutant would not run: ${res.error.split('\n')[0]}`); return; }
  await probe(mdb, label);
};

// 🔴 M1 — THE ONE A COUNT CANNOT SEE, AND IT IS EXACTLY DAVID'S DEFECT MOVED ONE ROW OVER.
await mutant('M1 installation paired with TAILGATE instead of Trip Charge',
  (s) => s.replace("('Trip Charge',              50.00,  true,  false)", "('Trip Charge',              50.00,  false, false)")
          .replace("('Tailgate Delivery',        50.00,  false, false)", "('Tailgate Delivery',        50.00,  true,  false)"),
  async (mdb, label) => {
    const r = await one(mdb, `select count(*) filter (where offers_installation)::int n,
       coalesce(string_agg(name,'') filter (where offers_installation),'') which
       from public.service_offerings where business_id='${LAWNS}'`);
    ok(r.n === 1 && r.which === 'Tailgate Delivery',
       `${label} — the COUNT still reads ${r.n}, so a count-based check passes; it is ${r.which} that offers install. Only P8's named assertion sees it.`);
  });

await mutant('M2 Tailgate left at $150',
  (s) => s.replace("('Tailgate Delivery',        50.00,", "('Tailgate Delivery',       150.00,"),
  async (mdb, label) => {
    const r = await one(mdb, `select price::text p from public.service_offerings where business_id='${LAWNS}' and name='Tailgate Delivery'`);
    ok(Number(r.p) === 150, `${label} — it comes out at $${r.p}, which P9 asserts must be 50`);
  });

await mutant('M3 Tree Tarp left per_unit',
  (s) => s.replace("  price_type        = 'flat',", "  price_type        = 'per_unit',"),
  async (mdb, label) => {
    const r = await one(mdb, `select price_type pt from public.service_offerings where business_id='${LAWNS}' and name='Tree Tarp'`);
    ok(r.pt === 'per_unit', `${label} — it stays ${r.pt}, so OrderDetail would still say "per plant" and P11 goes red`);
  });

// 🔴 M4 — the consequence is worth stating: Lauren forced to type an amount on the commonest branch.
await mutant('M4 amount_required_at_sale set on Trip Charge too',
  (s) => s.replace("('Trip Charge',              50.00,  true,  false)", "('Trip Charge',              50.00,  true,  true)"),
  async (mdb, label) => {
    const r = await one(mdb, `select count(*) filter (where amount_required_at_sale)::int n from public.service_offerings where business_id='${LAWNS}'`);
    ok(r.n === 2, `${label} — ${r.n} rows now demand an amount, so Lauren would be asked to type one on every ordinary delivery; P10 asserts exactly 1`);
  });

console.log(fails === 0 ? `\n✅ all probes pass` : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
