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
const migration = readFileSync(process.cwd() + '/supabase/migrations/20260925c_transport_pricing_basis.sql', 'utf8');

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

// ── 3. V1 — the column exists and defaults to 'flat' ──────────────────────────────────────
const col = await db.query(`SELECT data_type, column_default FROM information_schema.columns
  WHERE table_schema='public' AND table_name='service_offerings' AND column_name='pricing_basis'`);
ok(col.rows.length === 1, 'V1 the column exists');
ok(String(col.rows[0]?.column_default ?? '').includes("'flat'"), `V1 …and defaults to 'flat' (got ${col.rows[0]?.column_default})`);

// ── 4. 🔴 V2 — EVERY EXISTING ROW IS UNCHANGED. Nothing re-prices on apply ─────────────────
const spread = await db.query(`SELECT pricing_basis, count(*)::int AS c FROM public.service_offerings GROUP BY 1`);
ok(spread.rows.every(r => r.pricing_basis === 'flat'),
   `🔴 V2 EVERY ROW IS 'flat' AFTER APPLYING — the migration re-prices NOTHING. A money column whose default changed behaviour on apply would re-price a tenant's deliveries while they slept (got ${JSON.stringify(spread.rows)})`);

// ── 5. V5 — an unknown basis is refused ───────────────────────────────────────────────────
const anyOffer = await db.query('SELECT id FROM public.service_offerings LIMIT 1');
if (anyOffer.rows.length === 0) {
  // Reach the probe rather than skip it (#182): a harness that cannot reach its target reports
  // the same as one that passed.
  const need = await db.query(`SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='service_offerings' AND is_nullable='NO' AND column_default IS NULL`);
  const c = ['id']; const v = [`'50000000-0000-4000-8000-000000000001'`];
  for (const r of need.rows) {
    if (c.includes(r.column_name)) continue;
    c.push(r.column_name);
    v.push(r.data_type === 'uuid' ? `'b0000000-0000-4000-8000-00000000000b'`
      : r.data_type.includes('timestamp') ? 'now()'
      : r.data_type.includes('bool') ? 'false'
      : r.data_type.includes('int') || r.data_type.includes('numeric') || r.data_type.includes('double') ? '0'
      : `'probe'`);
  }
  await db.exec(`INSERT INTO public.service_offerings (${c.join(', ')}) VALUES (${v.join(', ')})`);
}
const oid = (await db.query('SELECT id FROM public.service_offerings LIMIT 1')).rows[0].id;
let refused = false;
try { await db.exec(`UPDATE public.service_offerings SET pricing_basis = 'by_the_mile' WHERE id = '${oid}'`); }
catch { refused = true; }
ok(refused, "🔴 V5 AN UNKNOWN BASIS IS REFUSED — 'flat' and 'ring' are the only two answers, and a third would be a question with nothing to resolve it");

// ── 6. and the two legitimate values are accepted ─────────────────────────────────────────
let bothOk = true;
for (const basis of ['flat', 'ring']) {
  try { await db.exec(`UPDATE public.service_offerings SET pricing_basis = '${basis}' WHERE id = '${oid}'`); }
  catch { bothOk = false; }
}
ok(bothOk, 'V6 …while both real values are accepted — the CHECK refuses typos, not the feature');

console.log(`\ntransport-pricing-basis-386 — ${pass} passed, ${fails.length} failed`);
await db.close();
process.exit(fails.length === 0 ? 0 : 1);
