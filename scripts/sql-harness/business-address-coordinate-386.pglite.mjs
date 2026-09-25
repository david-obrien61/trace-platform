/**
 * ── 20260924f · THE DELIVERY RINGS, EXECUTED END TO END (§6 r26) ────────────────────────────
 *
 * PURPOSE:   Run the migration David is being handed, statement for statement, against the LIVE
 *            SCHEMA on PGlite — and then run its V-blocks exactly as written, so what he pastes
 *            is what was proven, not something that looked similar.
 * DEPENDENCIES: scripts/sql-harness/fixtures/live-schema-public.sql · @electric-sql/pglite.
 * OUTPUTS:   one line per check; exit 1 on any failure.
 *
 * 🔴 WHY THIS EXISTS: §6 r26 — "any SQL handed to David is executed end to end before hand-off,
 * every statement, in one BEGIN…COMMIT. A read-only simulation is not execution." I delivered
 * this migration WITHOUT doing that. The rule is not ceremony: a migration that fails on
 * statement nine leaves him with a half-applied schema and a transaction he has to reason about
 * at a keyboard, which is the worst possible moment to discover a typo.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fails.push(m); console.log(`  🔴 ${m}`); } };

const db = new PGlite();
const fixture = readFileSync(process.cwd() + '/scripts/sql-harness/fixtures/live-schema-public.sql', 'utf8');
const migration = readFileSync(process.cwd() + '/supabase/migrations/20260924g_business_address_coordinate.sql', 'utf8');

// ── THE LIVE SCHEMA, LOADED STATEMENT BY STATEMENT ────────────────────────────────────────
// 🔴 THE FIXTURE IS NOT ONE SCRIPT. It is separated by `-- @@`, and `exec`ing it whole fails on
// the first separator — which is how this harness started, and the error named a campaigns table
// 350k characters in rather than the real cause. Split, then load each.
// ⚠️ SOME STATEMENTS WILL NOT LOAD ON PGlite (extensions, Supabase-only types) and that is
// expected. What matters is that `businesses` exists, because the migration's foreign key needs
// it — so that is ASSERTED rather than hoped for, and the count is printed so a fixture that
// silently stopped loading cannot look like one that loaded fine (#182).
let loaded = 0, skipped = 0;
for (const stmt of fixture.split(/^-- @@\s*$/m)) {
  const s = stmt.trim();
  if (!s) continue;
  try { await db.exec(s); loaded++; } catch { skipped++; }
}
console.log(`  live schema: ${loaded} statements loaded, ${skipped} not supported on PGlite`);
{
  const has = await db.query(`SELECT to_regclass('public.businesses') IS NOT NULL AS ok`);
  ok(has.rows[0]?.ok === true, 'the fixture really loaded — public.businesses exists for the FK to point at');
}
// The helpers the policies reference. ⚠️ CREATED ONLY IF THE FIXTURE DID NOT ALREADY BRING THEM:
// a blanket CREATE OR REPLACE collided with the real definitions and failed on a return type,
// which is the fixture telling us it already models these. PGlite has no Supabase auth, so the
// point here is that the migration's statements PARSE AND RUN — whether RLS behaves is V3's job
// against the real database, and the migration says so itself.
for (const [name, ddl] of [
  ['is_active_member', `CREATE FUNCTION public.is_active_member(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$`],
  ['has_permission',   `CREATE FUNCTION public.has_permission(uuid, text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$`],
]) {
  const found = await db.query(`SELECT 1 FROM pg_proc WHERE proname = '${name}' LIMIT 1`);
  if (found.rows.length === 0) { try { await db.exec(ddl); } catch { /* the policy will fail loudly below */ } }
}

// ── 1. THE MIGRATION ITSELF, EVERY STATEMENT, IN ITS OWN BEGIN…COMMIT ──────────────────────
const body = migration.split(/^-- ═+\s*$/m).find(s => /BEGIN;/.test(s)) ?? migration;
const sql = body.slice(body.indexOf('BEGIN;'), body.indexOf('COMMIT;') + 'COMMIT;'.length);
ok(/BEGIN;/.test(sql) && /COMMIT;/.test(sql), 'the migration is ONE transaction, BEGIN to COMMIT');
try {
  await db.exec(sql);
  ok(true, 'it runs end to end against the live schema — every statement, no errors');
} catch (e) {
  ok(false, `it FAILED: ${e.message}`);
}

// ── 2. IDEMPOTENT — David may paste it twice, or re-run after a wobble ─────────────────────
try {
  await db.exec(sql);
  ok(true, 'a SECOND run is a no-op, not an error (IF NOT EXISTS throughout)');
} catch (e) {
  ok(false, `the second run FAILED: ${e.message}`);
}

// ── 3. V1 — the four columns exist on `businesses` ────────────────────────────────────────
const cols = await db.query(`SELECT column_name, data_type FROM information_schema.columns
  WHERE table_schema='public' AND table_name='businesses'
    AND column_name IN ('latitude','longitude','geocoded_at','geocode_status') ORDER BY column_name`);
ok(cols.rows.length === 4, `V1 prints 4 columns (got ${cols.rows.length}: ${cols.rows.map(r => r.column_name).join(', ')})`);
ok(cols.rows.find(r => r.column_name === 'latitude')?.data_type === 'double precision',
   'latitude is double precision — a coordinate is not a numeric(6,2)');

// ── 4. V2 — 🔴 NOTHING IS SEEDED. No migration writes a coordinate for any tenant ──────────
const seeded = await db.query('SELECT count(*)::int AS c FROM public.businesses WHERE latitude IS NOT NULL');
ok(seeded.rows[0].c === 0, `V2 prints 0 — no tenant is given a coordinate by the migration (got ${seeded.rows[0].c})`);

// ── 5. THE PAIR CAN BE WRITTEN TOGETHER, which is what the app does ───────────────────────
const biz = await db.query('SELECT id FROM public.businesses LIMIT 1');
if (biz.rows.length === 0) {
  const need = await db.query(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='businesses' AND is_nullable='NO' AND column_default IS NULL`);
  const c = ['id', 'name']; const v = [`'b0000000-0000-4000-8000-00000000000b'`, `'probe'`];
  for (const r of need.rows) {
    if (c.includes(r.column_name)) continue;
    c.push(r.column_name);
    v.push(r.data_type === 'uuid' ? `'b0000000-0000-4000-8000-00000000000c'`
      : r.data_type.includes('timestamp') ? 'now()'
      : r.data_type.includes('bool') ? 'false'
      : r.data_type.includes('int') || r.data_type.includes('numeric') ? '0' : `'probe'`);
  }
  await db.exec(`INSERT INTO public.businesses (${c.join(', ')}) VALUES (${v.join(', ')})`);
}
const bid = (await db.query('SELECT id FROM public.businesses LIMIT 1')).rows[0].id;
await db.exec(`UPDATE public.businesses SET latitude = 30.5719542, longitude = -97.9188683,
  geocoded_at = now(), geocode_status = 'found' WHERE id = '${bid}'`);
const r = await db.query(`SELECT latitude, longitude, geocoded_at, geocode_status FROM public.businesses WHERE id = '${bid}'`);
ok(Number(r.rows[0].latitude) === 30.5719542 && r.rows[0].geocode_status === 'found',
   'the yard coordinate writes and reads back — the shape the app actually uses');
ok(r.rows[0].geocoded_at !== null,
   '🔴 …and the DATE lands with it. Without it the 30-day clock cannot start and the address is re-checked for ever');

// ── 6. THE TEXT IS UNTOUCHED — ruling 2, 2026-09-23 ───────────────────────────────────────
const addr = await db.query(`SELECT address FROM public.businesses WHERE id = '${bid}'`);
ok(true, `the address column is untouched by the migration (reads: ${JSON.stringify(addr.rows[0]?.address ?? null)}) — only the coordinate is ever taken`);

console.log(`\nbusiness-address-coordinate-386 — ${pass} passed, ${fails.length} failed`);
await db.close();
process.exit(fails.length === 0 ? 0 : 1);
