/**
 * ── 20260925o · "KEEP WHAT I TYPED" BECOMES RECORDABLE, EXECUTED END TO END (§6 r26) ────────
 *
 * PURPOSE:   Run the migration against the LIVE SCHEMA on PGlite and prove BOTH directions — the
 *            shape it must now admit, and the three it must still refuse.
 * DEPENDENCIES: scripts/sql-harness/fixtures/live-schema-public.sql · @electric-sql/pglite.
 * OUTPUTS:   one line per check; exit 1 on any failure.
 *
 * 🔴 RED FIRST: the harness proves the constraint refuses `confirm` BEFORE the migration, so the
 * defect is demonstrated rather than asserted. A fix whose "before" was never observed is a fix
 * nobody can tell from a no-op.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fails.push(m); console.log(`  🔴 ${m}`); } };

const db = new PGlite();
const fixture = readFileSync(process.cwd() + '/scripts/sql-harness/fixtures/live-schema-public.sql', 'utf8');
const migration = readFileSync(process.cwd() + '/supabase/migrations/20260925o_confirm_is_a_verdict.sql', 'utf8');

let loaded = 0, skipped = 0;
for (const stmt of fixture.split(/^-- @@\s*$/m)) {
  const s = stmt.trim(); if (!s) continue;
  try { await db.exec(s); loaded++; } catch { skipped++; }
}
console.log(`  live schema: ${loaded} statements loaded, ${skipped} not supported on PGlite`);
{
  const r = await db.query(`SELECT to_regclass('public.customer_addresses') IS NOT NULL AS ok`);
  ok(r.rows[0]?.ok === true, 'the fixture really loaded — public.customer_addresses exists');
}
{
  const r = await db.query(`SELECT count(*)::int AS n FROM pg_constraint
    WHERE conrelid = 'public.customer_addresses'::regclass AND conname = 'customer_addresses_geocode_consistent'`);
  ok(Number(r.rows[0]?.n) === 1, 'the fixture carries the constraint this migration replaces (without it the probes below prove nothing)');
}

// A row to probe. The fixture has no data.
await db.exec(`INSERT INTO public.businesses (id, owner_id, name)
  VALUES ('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Probe Co') ON CONFLICT DO NOTHING`);
await db.exec(`INSERT INTO public.customers (id, business_id, first_name, last_name)
  VALUES ('33333333-3333-3333-3333-333333333333','11111111-1111-1111-1111-111111111111','Probe','Person') ON CONFLICT DO NOTHING`);
await db.exec(`INSERT INTO public.customer_addresses (id, business_id, customer_id, label, line1, kind)
  VALUES ('44444444-4444-4444-4444-444444444444','11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333','Site','1 Probe St','shipping')
  ON CONFLICT DO NOTHING`);
const AID = '44444444-4444-4444-4444-444444444444';
{
  const r = await db.query(`SELECT count(*)::int AS n FROM public.customer_addresses WHERE id = '${AID}'`);
  ok(Number(r.rows[0]?.n) === 1, 'a probe address row exists (asserted, not assumed)');
}

const tryUpdate = async (sql) => {
  try { await db.exec(sql); return null; } catch (e) { return e.message; }
};
const CONFIRM = `UPDATE public.customer_addresses SET geocode_status='confirm', latitude=NULL, longitude=NULL, geocoded_at=now() WHERE id='${AID}'`;

// ── RED FIRST ───────────────────────────────────────────────────────────────────────────────
{
  const err = await tryUpdate(CONFIRM);
  ok(!!err && /check constraint/i.test(err),
     `🔴 BEFORE: the live constraint REFUSES a 'confirm' verdict — the defect, demonstrated (${err ? err.slice(0, 80) : 'IT WAS ACCEPTED, so this migration fixes nothing'})`);
}

// ── THE MIGRATION ───────────────────────────────────────────────────────────────────────────
const [body] = migration.split(/^-- ═+$/m);
try { await db.exec(body); ok(true, 'the migration ran end to end'); }
catch (e) { ok(false, `the migration FAILED: ${e.message}`); }

// ── GREEN AFTER, AND STILL STRICT ───────────────────────────────────────────────────────────
{
  const err = await tryUpdate(CONFIRM);
  ok(err === null, `AFTER: a dated 'confirm' with no coordinate is ACCEPTED${err ? ` — still refused: ${err.slice(0, 90)}` : ''}`);
  const r = await db.query(`SELECT geocode_status, latitude, geocoded_at FROM public.customer_addresses WHERE id = '${AID}'`);
  ok(r.rows[0]?.geocode_status === 'confirm' && r.rows[0]?.latitude === null && !!r.rows[0]?.geocoded_at,
     `…and it is on the row, dated, with no coordinate: ${JSON.stringify(r.rows[0])}`);
}
{
  const bad = [
    [`confirm WITH a coordinate`, `UPDATE public.customer_addresses SET geocode_status='confirm', latitude=30.5, longitude=-97.9, geocoded_at=now() WHERE id='${AID}'`],
    [`an UNDATED confirm`,        `UPDATE public.customer_addresses SET geocode_status='confirm', latitude=NULL, longitude=NULL, geocoded_at=NULL WHERE id='${AID}'`],
    [`found with NO coordinate`,  `UPDATE public.customer_addresses SET geocode_status='found', latitude=NULL, longitude=NULL, geocoded_at=now() WHERE id='${AID}'`],
    [`a nonsense verdict`,        `UPDATE public.customer_addresses SET geocode_status='maybe', latitude=NULL, longitude=NULL, geocoded_at=now() WHERE id='${AID}'`],
  ];
  for (const [label, sql] of bad) {
    const err = await tryUpdate(sql);
    ok(!!err, `…and ${label} is STILL refused — a constraint widened too far admits rows that are then believed`);
  }
}
{
  // The negative control for the widening: `found` and `not_found` must be unaffected.
  const a = await tryUpdate(`UPDATE public.customer_addresses SET geocode_status='found', latitude=30.5, longitude=-97.9, geocoded_at=now() WHERE id='${AID}'`);
  const b = await tryUpdate(`UPDATE public.customer_addresses SET geocode_status='not_found', latitude=NULL, longitude=NULL, geocoded_at=now() WHERE id='${AID}'`);
  ok(a === null && b === null, `🔴 NEGATIVE CONTROL: found and not_found still work — the widening did not break what already worked (${a ?? ''} ${b ?? ''})`);
}

console.log(`\nconfirm-verdict-386 — ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.error('FAILURES:\n' + fails.map(f => '  - ' + f).join('\n')); process.exit(1); }
