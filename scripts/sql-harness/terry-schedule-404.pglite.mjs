#!/usr/bin/env node
/**
 * ── terry-schedule — the LAWNS grow-ladder data file, EXECUTED END TO END (§6 r26) ────────────
 *
 * PURPOSE:      David, 2026-09-25 — the uppot window and Terry's six-month rule. The file he will
 *               paste is RUN here by a Postgres engine first, against the live schema with the
 *               ladder migrations replayed, on a tenant seeded to LAWNS's REAL shape: three
 *               config keys, nine rungs, no grow, no hold, no potting dates.
 *
 *                 P1  the file runs end to end in one BEGIN … COMMIT
 *                 P2  V1 — the window is this season's two dates
 *                 P3  🔴 V2 — the three keys LAWNS already held SURVIVED the merge (caliper 12,
 *                     not the platform's 6). This is the one that can silently move a number.
 *                 P4  V3 — every rung grows in 6, and NOT ONE carries a hold
 *                 P5  V4 — the reason names Terry and the 6–8 expectation
 *                 P6  V5 — no potting date was invented
 *                 P7  V6 — idempotence: a second run changes nothing
 *                 M1  🔴 mutant: `=` instead of `||` on the config — P3 must catch it, because
 *                     that is the shape that silently moves every caliper from 12 to 6
 *                 M2  mutant: a hold_months written "to finish the column" — P4 must catch it
 *                 M3  mutant: the reason without the 6–8 range — P5 must catch it
 *
 * DEPENDENCIES: @electric-sql/pglite (dev) · liveDb · the data file.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure.
 * ⚠️ PGlite is Postgres 18 and Supabase runs an older major: this proves the SQL is well-formed
 *    and that the merge preserves what it must. It does not replace applying it.
 *
 * Run: node scripts/sql-harness/terry-schedule-404.pglite.mjs
 */
import { readFileSync } from 'node:fs';
import { openLiveDb } from '../path-tests/lib/liveDb.mjs';

const DATA = readFileSync(`${process.cwd()}/docs/decisions/2026-09-25-lawns-grow-ladder-terry-schedule.sql`, 'utf8');
const PRIOR = [
  '20260916_container_ladder_install_t_posts.sql',
  '20260918c_container_ladder_caliper.sql',
  '20260923e_container_ladder_install_price.sql',
  '20260923h_container_ladder_grow_and_hold.sql',
];
const LAWNS = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const OWNER = '0a000000-0000-4000-8000-0000000000aa';
/** LAWNS's real rungs, 2026-09-25 — labels and order only. */
const RUNGS = [['slip',10,null],['4 in',20,null],['3/5 gal',30,4],['15 gal',40,15],
               ['30 gal',50,30],['45 gal',60,45],['65 gal',70,65],['95/100',80,95],['200 gal',90,200]];

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };
const one = async (db, q, p = []) => (await db.query(q, p)).rows[0];
const run = async (db, sql) => {
  try { await db.exec(sql); return { ok: true, error: null }; }
  catch (e) { try { await db.exec('ROLLBACK'); } catch { /* none */ } return { ok: false, error: String(e.message) }; }
};

/** A tenant at LAWNS's measured shape, BEFORE the data file. */
async function fresh() {
  const db = await openLiveDb({ migrations: PRIOR });
  await db.exec(`insert into auth.users (id) values ('${OWNER}') on conflict do nothing`);
  await db.query(`insert into public.businesses (id, owner_id, name, business_type, qbo_writes_enabled)
                  values ($1,$2,'LAWNS copy','nursery',false) on conflict do nothing`, [LAWNS, OWNER]);
  await db.exec(`SET session_replication_role = replica`);
  // 🔴 THE THREE KEYS LAWNS ACTUALLY HOLDS — read live 2026-09-25. Seeding a FULL config would
  // make M1 unfalsifiable: a replace only loses something if there is something to lose.
  await db.query(`insert into public.business_operations_config (business_id, config, created_at, updated_at)
     values ($1, $2::jsonb, now(), now())`,
    [LAWNS, JSON.stringify({ caliperMeasuredAtInches: 12,
      caliperMeasuredAtBecause: 'LAWNS, David 2026-09-18', madeItemLabel: 'homemade',
      // 🔴 ADDED BY ANOTHER SESSION THIS MORNING (2026-09-25-lawns-capacity-settings.sql). The
      // first version of this harness seeded THREE keys and the file's own check named THREE —
      // so both agreed, and both would have missed these two. Seeding what LAWNS actually holds
      // is what makes M1 falsifiable.
      dayHoursBeforeSecondTeam: 7, plantingMinutesPerGallon: 1 })]);
  for (const [label, sort, gal] of RUNGS) {
    await db.query(`insert into public.container_ladder (id, business_id, label, aliases, sort_order,
        volume_gallons, handling_because, active, created_at, updated_at)
      values (gen_random_uuid(), $1, $2, '{}', $3, $4, 'not timed', true, now(), now())`,
      [LAWNS, label, sort, gal]);
  }
  await db.exec(`SET session_replication_role = origin`);
  return db;
}

const db = await fresh();
const applied = await run(db, DATA);
ok(applied.ok, `P1 the data file runs end to end${applied.ok ? '' : ` — ${applied.error}`}`);
if (!applied.ok) { console.error('\nNothing further can be measured.'); process.exit(1); }

{
  const r = await one(db, `select config->>'windowStart' s, config->>'windowEnd' e
    from public.business_operations_config where business_id='${LAWNS}'`);
  ok(r.s === '2026-11-15' && r.e === '2027-02-15', `P2/V1 the window is ${r.s} → ${r.e}`);
}
{
  const r = await one(db, `select config->>'caliperMeasuredAtInches' cal, config->>'madeItemLabel' made,
     config->>'dayHoursBeforeSecondTeam' AS dayhrs, config->>'plantingMinutesPerGallon' mins,
     (select count(*)::int from jsonb_object_keys(config)) keys
     from public.business_operations_config where business_id='${LAWNS}'`);
  ok(r.cal === '12' && r.made === 'homemade' && r.keys === 7 && r.dayhrs === '7' && r.mins === '1',
     `P3/V2 🔴 ALL FIVE pre-existing keys SURVIVED — caliper ${r.cal}, made "${r.made}", dayHours ${r.dayhrs}, mins/gal ${r.mins}, ${r.keys} keys now (5 + the 2 window keys)`);
}
{
  const r = await one(db, `select count(*) filter (where grow_months is distinct from 6)::int notsix,
     count(*) filter (where hold_months is not null)::int withhold, count(*)::int total
     from public.container_ladder where business_id='${LAWNS}'`);
  ok(r.notsix === 0 && r.withhold === 0,
     `P4/V3 all ${r.total} rungs grow in 6 (${r.notsix} not) and NOT ONE has a hold (${r.withhold})`);
}
{
  const r = await one(db, `select count(*) filter (where grow_because ilike '%8 months%' and grow_because ilike '%Terry%')::int named,
     count(*)::int total from public.container_ladder where business_id='${LAWNS}'`);
  ok(r.named === r.total, `P5/V4 every rung's reason names Terry and the 6–8 expectation (${r.named}/${r.total})`);
}
{
  const r = await one(db, `select (select count(*)::int from public.production_rung_dates) d,
     (select count(*)::int from public.business_inventory where business_id='${LAWNS}' and received_at is not null) rx`);
  ok(r.d === 0 && r.rx === 0, `P6/V5 🔴 no potting date was invented — ${r.d} rung dates, ${r.rx} received_at`);
}
{
  const before = await one(db, `select md5(string_agg(label||coalesce(grow_months::text,'')||coalesce(grow_because,''), '|' order by sort_order)) h
    from public.container_ladder where business_id='${LAWNS}'`);
  const again = await run(db, DATA);
  const after = await one(db, `select md5(string_agg(label||coalesce(grow_months::text,'')||coalesce(grow_because,''), '|' order by sort_order)) h
    from public.container_ladder where business_id='${LAWNS}'`);
  ok(again.ok && before.h === after.h, `P7/V6 a second run changes nothing — ladder hash identical`);
}

// ── MUTANTS ──────────────────────────────────────────────────────────────────────────────────
const mutant = async (label, transform, probe) => {
  const mdb = await fresh();
  const res = await run(mdb, transform(DATA));
  if (!res.ok) { ok(false, `${label} — the mutant would not run: ${res.error.split('\n')[0]}`); return; }
  await probe(mdb, label);
};

// 🔴 M1 — THE ONE THAT MATTERS. `=` instead of `||` lands the window correctly and silently drops
// the caliper, moving every measurement from 12 inches to the platform's 6.
// 🔴 M1 — THE FILE ITSELF MUST REFUSE, NOT MERELY BE CAUGHT AFTERWARDS. An earlier version of
// this harness asserted the damage after the fact; the guard now rolls the whole file back, so
// the mutant leaves NOTHING written — no window, no grow, no lost key.
{
  const mdb = await fresh();
  const broken = DATA.replace('     SET config = config || jsonb_build_object(', '     SET config = jsonb_build_object(');
  const res = await run(mdb, broken);
  const r = await one(mdb, `select config ? 'caliperMeasuredAtInches' cal, config ? 'dayHoursBeforeSecondTeam' AS dayhrs,
     config ? 'windowStart' win, (select count(*)::int from jsonb_object_keys(config)) keys
     from public.business_operations_config where business_id='${LAWNS}'`);
  const g = await one(mdb, `select count(*) filter (where grow_months is not null)::int n from public.container_ladder where business_id='${LAWNS}'`);
  ok(!res.ok && /DROPPED/.test(res.error || '') && r.cal === true && r.dayhrs === true && r.win === false && g.n === 0,
     `M1 🔴 a REPLACE is REFUSED by the file itself and rolled back whole — ${res.ok ? 'IT COMMITTED' : 'raised: ' + (res.error||'').split('\n')[0].slice(0, 96)}`);
  ok(r.keys === 5 && g.n === 0,
     `M1 …and nothing at all was written: ${r.keys} keys intact, ${g.n} rungs given a grow figure`);
}
{
  // The named-list version of the check, planted, to show WHY the derived one replaced it.
  const mdb = await fresh();
  await mdb.query(`update public.business_operations_config set config = config - 'plantingMinutesPerGallon' where business_id=$1`, [LAWNS]);
  const r = await run(mdb, DATA);
  ok(r.ok, `M1b a key REMOVED BEFOREHAND is not this file's problem — it still runs (the guard compares before to after, not to a list)`);
}

await mutant('M2 a hold_months written to finish the column',
  (s) => s.replace('   SET grow_months  = 6,', '   SET grow_months  = 6, hold_months = 12,'),
  async (mdb, label) => {
    const r = await one(mdb, `select count(*) filter (where hold_months is not null)::int n from public.container_ladder where business_id='${LAWNS}'`);
    ok(r.n > 0, `${label} — ${r.n} rungs come out with a guessed hold, which P4 asserts must be 0`);
  });

await mutant('M3 the reason without the 6–8 range',
  (s) => s.replace(/grow_because = '[^']*(?:''[^']*)*'/, "grow_because = 'six months'"),
  async (mdb, label) => {
    const r = await one(mdb, `select count(*) filter (where grow_because ilike '%8 months%')::int n from public.container_ladder where business_id='${LAWNS}'`);
    ok(r.n === 0, `${label} — ${r.n} rungs name the expectation, so P5 goes red and Lauren would get a date without its confidence`);
  });

console.log(fails === 0 ? `\n✅ all probes pass` : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
