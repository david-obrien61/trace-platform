/**
 * ── 20260925d · LAWNS'S FIVE RINGS, EXECUTED END TO END (§6 r26) ────────────────────────────
 * PURPOSE:   Run the seed David is handed, against the live schema + the ring table 20260924f
 *            creates, and prove its V-blocks — including that a SECOND run does not duplicate.
 * OUTPUTS:   one line per check; exit 1 on any failure.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fails.push(m); console.log(`  🔴 ${m}`); } };
const body = f => { const s = readFileSync(f, 'utf8'); return s.slice(s.indexOf('BEGIN;'), s.indexOf('COMMIT;') + 7); };

const db = new PGlite();
const fixture = readFileSync(process.cwd() + '/scripts/sql-harness/fixtures/live-schema-public.sql', 'utf8');
let loaded = 0;
for (const stmt of fixture.split(/^-- @@\s*$/m)) { const s = stmt.trim(); if (!s) continue; try { await db.exec(s); loaded++; } catch { /* PGlite gaps */ } }
for (const [n, ddl] of [['is_active_member', `CREATE FUNCTION public.is_active_member(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$`],
                        ['has_permission', `CREATE FUNCTION public.has_permission(uuid, text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$`]]) {
  if ((await db.query(`SELECT 1 FROM pg_proc WHERE proname='${n}' LIMIT 1`)).rows.length === 0) { try { await db.exec(ddl); } catch {} }
}
console.log(`  live schema: ${loaded} statements loaded`);

// LAWNS must exist for the FK, with every NOT NULL the real table carries.
const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
if ((await db.query(`SELECT 1 FROM public.businesses WHERE id='${L}'`)).rows.length === 0) {
  const need = await db.query(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='businesses' AND is_nullable='NO' AND column_default IS NULL`);
  const c = ['id', 'name'], v = [`'${L}'`, `'LAWNS Tree Farm, LLC'`];
  for (const r of need.rows) { if (c.includes(r.column_name)) continue; c.push(r.column_name);
    v.push(r.data_type === 'uuid' ? `'b0000000-0000-4000-8000-00000000000b'` : r.data_type.includes('timestamp') ? 'now()'
      : r.data_type.includes('bool') ? 'false' : /int|numeric|double/.test(r.data_type) ? '0' : `'x'`); }
  await db.exec(`INSERT INTO public.businesses (${c.join(', ')}) VALUES (${v.join(', ')})`);
}

// 1. the ring TABLE migration, then the SEED — in David's stated apply order
await db.exec(body(process.cwd() + '/supabase/migrations/20260924f_delivery_rings.sql'));
ok(true, '20260924f applies first (the table)');
try { await db.exec(body(process.cwd() + '/supabase/migrations/20260925d_seed_lawns_delivery_rings.sql'));
      ok(true, '20260925d runs end to end — every statement, no errors'); }
catch (e) { ok(false, `20260925d FAILED: ${e.message}`); }

// 2. 🔴 A SECOND RUN DOES NOT DUPLICATE — David may paste it twice
try { await db.exec(body(process.cwd() + '/supabase/migrations/20260925d_seed_lawns_delivery_rings.sql'));
      ok(true, '🔴 a SECOND run updates rather than duplicating (ON CONFLICT on the partial unique index)'); }
catch (e) { ok(false, `the second run FAILED: ${e.message}`); }

// 3. V1 — five rings, the right radii against the right charges
const rows = (await db.query(`SELECT outer_radius_miles::float AS r, charge::float AS c, origin_note
  FROM public.business_delivery_rings WHERE business_id='${L}' AND active ORDER BY outer_radius_miles`)).rows;
ok(rows.length === 5, `V1 five rings (got ${rows.length})`);
const want = [[7.1, 50], [14.3, 100], [21.4, 150], [35.7, 250], [42.9, 300]];
ok(JSON.stringify(rows.map(x => [x.r, x.c])) === JSON.stringify(want),
   `🔴 V1 THE RADII MATCH DAVID'S ARITHMETIC EXACTLY — charge ÷ 3.50 ÷ 2, round trip (got ${JSON.stringify(rows.map(x => [x.r, x.c]))})`);

// 4. 🔴 the ring-5 disagreement is ON THE ROW, not smoothed away
ok(/48/.test(rows[4].origin_note) && /disagree/i.test(rows[4].origin_note),
   "🔴 RING 5 CARRIES THE DISAGREEMENT IN ITS OWN NOTE — the arithmetic says 42.9 and Lauren's paper map says ~48. A seeded number that quietly split the difference would be a figure nobody could ever check again");
ok(rows.every(r => /seeded from/i.test(r.origin_note) && /adjust/i.test(r.origin_note)),
   'V3 every ring says where it came from and that it is adjustable — a proposal, never a decision');

// 5. V2 — 🔴 NO OTHER TENANT GAINED A RING
const others = (await db.query(`SELECT count(*)::int AS c FROM public.business_delivery_rings WHERE business_id <> '${L}'`)).rows[0].c;
ok(others === 0, `🔴 V2 NO OTHER TENANT GAINED A RING (got ${others}) — this file seeds LAWNS alone, by id, and creates no platform default`);

console.log(`\nring-seed-386 — ${pass} passed, ${fails.length} failed`);
await db.close();
process.exit(fails.length === 0 ? 0 : 1);
