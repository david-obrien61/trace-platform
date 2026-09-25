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
const migration = readFileSync(process.cwd() + '/supabase/migrations/20260924f_delivery_rings.sql', 'utf8');

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

// ── 3. V1 — the columns, exactly as the V-block asks ───────────────────────────────────────
const cols = await db.query(`SELECT column_name FROM information_schema.columns
  WHERE table_schema='public' AND table_name='business_delivery_rings' ORDER BY ordinal_position`);
ok(cols.rows.length === 8, `V1 prints 8 columns (got ${cols.rows.length}: ${cols.rows.map(r => r.column_name).join(', ')})`);

// ── 4. V2 — 🔴 EMPTY. No migration seeds a ring for anyone ─────────────────────────────────
const n = await db.query('SELECT count(*)::int AS c FROM public.business_delivery_rings');
ok(n.rows[0].c === 0, `V2 prints 0 — the table ships EMPTY, as ruled (got ${n.rows[0].c})`);

// ── 5. V3 — RLS on, two policies, reusing the settings strings ─────────────────────────────
const rls = await db.query(`SELECT relrowsecurity AS on FROM pg_class WHERE relname='business_delivery_rings'`);
ok(rls.rows[0]?.on === true, 'V3 prints rls = true');
const pol = await db.query(`SELECT policyname FROM pg_policies
  WHERE schemaname='public' AND tablename='business_delivery_rings' ORDER BY policyname`);
ok(pol.rows.length === 2, `V3 prints 2 policies (got ${pol.rows.length}: ${pol.rows.map(r => r.policyname).join(', ')})`);

// ── 6. V4 — 🔴 TWO RINGS CANNOT SHARE A RADIUS ─────────────────────────────────────────────
const biz = await db.query('SELECT id FROM public.businesses LIMIT 1');
if (biz.rows.length === 0) {
  // The fixture carries no business row; make one so the probe is REACHED rather than skipped
  // (#182: a harness that cannot reach its target reports the same as one that passed).
  // ⚠️ EVERY NOT NULL THE REAL TABLE CARRIES MUST BE SUPPLIED — the fixture refused this insert
  // for a missing `owner_id`, which is the schema behaving like the real one rather than like a
  // forgiving double (§6 r19: a double that cannot refuse what the real thing refuses is a rubber
  // stamp). Columns are read from the fixture rather than guessed.
  const need = await db.query(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='businesses'
      AND is_nullable='NO' AND column_default IS NULL`);
  const cols = ['id', 'name']; const vals = [`'b0000000-0000-4000-8000-00000000000b'`, `'probe'`];
  for (const r of need.rows) {
    if (cols.includes(r.column_name)) continue;
    cols.push(r.column_name);
    vals.push(r.data_type === 'uuid' ? `'b0000000-0000-4000-8000-00000000000c'`
      : r.data_type.includes('timestamp') ? 'now()'
      : r.data_type.includes('bool') ? 'false'
      : r.data_type.includes('int') || r.data_type.includes('numeric') ? '0' : `'probe'`);
  }
  await db.exec(`INSERT INTO public.businesses (${cols.join(', ')}) VALUES (${vals.join(', ')})`);
}
const bid = (await db.query('SELECT id FROM public.businesses LIMIT 1')).rows[0].id;
await db.exec(`INSERT INTO public.business_delivery_rings (business_id, outer_radius_miles, charge) VALUES ('${bid}', 7.10, 50.00)`);
let refused = false;
try { await db.exec(`INSERT INTO public.business_delivery_rings (business_id, outer_radius_miles, charge) VALUES ('${bid}', 7.10, 75.00)`); }
catch { refused = true; }
ok(refused, '🔴 V4 the SECOND ring at the same radius is REFUSED — one radius cannot have two charges');

// ── 7. V5 — a negative radius is refused ───────────────────────────────────────────────────
let negRefused = false;
try { await db.exec(`INSERT INTO public.business_delivery_rings (business_id, outer_radius_miles, charge) VALUES ('${bid}', -1, 50.00)`); }
catch { negRefused = true; }
ok(negRefused, 'V5 a negative radius is refused');

// ── 8. A RETIRED ring may reuse a radius — the index is PARTIAL on `active` ────────────────
await db.exec(`UPDATE public.business_delivery_rings SET active = false WHERE outer_radius_miles = 7.10`);
let reused = true;
try { await db.exec(`INSERT INTO public.business_delivery_rings (business_id, outer_radius_miles, charge) VALUES ('${bid}', 7.10, 60.00)`); }
catch { reused = false; }
ok(reused, '🔴 a RETIRED ring releases its radius — the unique index is partial on `active`, so retiring and re-adding at the same distance works');

console.log(`\ndelivery-rings-386 — ${pass} passed, ${fails.length} failed`);
await db.close();
process.exit(fails.length === 0 ? 0 : 1);
