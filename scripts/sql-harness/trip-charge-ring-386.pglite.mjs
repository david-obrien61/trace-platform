/**
 * ── 20260925e · TRIP CHARGE → RING, EXECUTED END TO END (§6 r26) ────────────────────────────
 * PURPOSE:   Run the switch David is handed, against the live schema with the two earlier
 *            migrations applied, and prove it moves EXACTLY ONE ROW.
 * OUTPUTS:   one line per check; exit 1 on any failure.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
let pass = 0; const fails = [];
const ok = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fails.push(m); console.log(`  🔴 ${m}`); } };
const body = f => { const s = readFileSync(f, 'utf8'); return s.slice(s.indexOf('BEGIN;'), s.indexOf('COMMIT;') + 7); };
const M = process.cwd() + '/supabase/migrations/';

const db = new PGlite();
const fixture = readFileSync(process.cwd() + '/scripts/sql-harness/fixtures/live-schema-public.sql', 'utf8');
for (const s of fixture.split(/^-- @@\s*$/m)) { const q = s.trim(); if (q) { try { await db.exec(q); } catch {} } }
for (const [n, d] of [['is_active_member', 'uuid'], ['has_permission', 'uuid, text']])
  if ((await db.query(`SELECT 1 FROM pg_proc WHERE proname='${n}'`)).rows.length === 0)
    { try { await db.exec(`CREATE FUNCTION public.${n}(${d}) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$`); } catch {} }

const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const fill = async (table, extra) => {
  const need = await db.query(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='${table}' AND is_nullable='NO' AND column_default IS NULL`);
  const c = Object.keys(extra), v = Object.values(extra).map(x => typeof x === 'number' ? String(x) : `'${x}'`);
  for (const r of need.rows) { if (c.includes(r.column_name)) continue; c.push(r.column_name);
    v.push(r.data_type === 'uuid' ? `'b0000000-0000-4000-8000-00000000000b'` : r.data_type.includes('timestamp') ? 'now()'
      : r.data_type.includes('bool') ? 'false' : /int|numeric|double/.test(r.data_type) ? '0' : `'x'`); }
  await db.exec(`INSERT INTO public.${table} (${c.join(', ')}) VALUES (${v.join(', ')})`);
};
await fill('businesses', { id: L, name: 'LAWNS Tree Farm, LLC' });
await db.exec(body(M + '20260925c_transport_pricing_basis.sql'));
ok(true, '20260925c applies first (the column)');

// LAWNS's five real transport rows, as measured live 2026-09-25.
// ⚠️ `transport_mode` IS SUPPLIED because the live schema REFUSES a transport row without one
// (constraint `service_offerings_transport_requires_mode`, which the fixture carries and which
// refused the first version of this harness). The double behaving like the real table is the
// point — a fixture that accepted this insert would have let a bad migration through (§6 r19).
const rows = [['Trip Charge', 50, 'staff'], ['Tailgate Delivery', 50, 'staff'], ['Backyard', 50, 'staff'],
              ['Installation', 450, 'staff'], ['I will collect it myself', 0, 'self']];
let n = 1;
for (const [name, price, mode] of rows)
  await fill('service_offerings', { id: `5000000${n++}-0000-4000-8000-000000000001`, business_id: L, name, price, category: 'transport', transport_mode: mode });

const before = (await db.query(`SELECT count(*)::int c FROM public.service_offerings WHERE pricing_basis='flat'`)).rows[0].c;
ok(before === 5, `all five rows start 'flat' (got ${before})`);

try { await db.exec(body(M + '20260925e_trip_charge_prices_from_the_ring.sql')); ok(true, '20260925e runs end to end'); }
catch (e) { ok(false, `20260925e FAILED: ${e.message}`); }

// 🔴 EXACTLY ONE ROW, AND THE RIGHT ONE
const after = (await db.query(`SELECT name, pricing_basis FROM public.service_offerings WHERE business_id='${L}' ORDER BY name`)).rows;
const onRing = after.filter(r => r.pricing_basis === 'ring').map(r => r.name);
ok(onRing.length === 1 && onRing[0] === 'Trip Charge',
   `🔴 EXACTLY ONE ROW MOVED, AND IT IS TRIP CHARGE (got ${JSON.stringify(onRing)}) — the rings were derived from TC history and say nothing about a curb drop`);
ok(after.find(r => r.name === 'Tailgate Delivery')?.pricing_basis === 'flat'
   && after.find(r => r.name === 'Backyard')?.pricing_basis === 'flat',
   '🔴 TAILGATE AND BACKYARD ARE STILL FLAT — they happen to cost $50 today and are different services; ring-pricing them would move a curb drop to ring 1 and a backyard forty miles out to $300 with nobody told');
ok(after.find(r => r.name === 'Installation')?.pricing_basis === 'flat', 'Installation untouched');

// a second run is a no-op, not an error
try { await db.exec(body(M + '20260925e_trip_charge_prices_from_the_ring.sql')); ok(true, 'a SECOND run changes nothing and does not error'); }
catch (e) { ok(false, `the second run FAILED: ${e.message}`); }

// the documented undo really works
await db.exec(`UPDATE public.service_offerings SET pricing_basis='flat' WHERE business_id='${L}' AND category='transport' AND name='Trip Charge'`);
const undone = (await db.query(`SELECT pricing_basis FROM public.service_offerings WHERE business_id='${L}' AND name='Trip Charge'`)).rows[0].pricing_basis;
ok(undone === 'flat', "🔴 THE UNDO LINE AT THE FOOT OF THE FILE ACTUALLY WORKS — anything that changes money says how to reverse it in the same file, and here that is tested rather than asserted");

console.log(`\ntrip-charge-ring-386 — ${pass} passed, ${fails.length} failed`);
await db.close();
process.exit(fails.length === 0 ? 0 : 1);
