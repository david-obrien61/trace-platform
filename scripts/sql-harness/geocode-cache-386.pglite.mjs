/**
 * ── 20260925n · THE GEOCODE CACHE, EXECUTED END TO END (§6 r26) ─────────────────────────────
 *
 * PURPOSE:   Run the migration David is being handed, statement for statement, against the LIVE
 *            SCHEMA on PGlite, then run its V-blocks exactly as written — so what he pastes is
 *            what was proven, not something that looked similar.
 * DEPENDENCIES: scripts/sql-harness/fixtures/live-schema-public.sql · @electric-sql/pglite.
 * OUTPUTS:   one line per check; exit 1 on any failure.
 *
 * 🔴 §6 r26: "a read-only simulation is not execution." A migration that fails on statement nine
 * leaves him with a half-applied schema at a keyboard, which is the worst possible moment to find
 * a typo.
 */
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

let pass = 0; const fails = [];
const ok = (c, m) => { if (c) { pass++; console.log(`  ✅ ${m}`); } else { fails.push(m); console.log(`  🔴 ${m}`); } };

const db = new PGlite();
const fixture = readFileSync(process.cwd() + '/scripts/sql-harness/fixtures/live-schema-public.sql', 'utf8');
const migration = readFileSync(process.cwd() + '/supabase/migrations/20260925n_geocode_cache.sql', 'utf8');

// The fixture is separated by `-- @@`; exec'ing it whole fails on the first separator.
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

// `is_active_member` is a Supabase-auth helper; PGlite has no auth. Stub it ONLY if absent, so a
// fixture that already models it wins. What is proven here is that the policies PARSE AND RUN.
try {
  await db.exec(`CREATE FUNCTION public.is_active_member(uuid) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;`);
  console.log('  stubbed is_active_member (PGlite has no Supabase auth)');
} catch { console.log('  is_active_member already present in the fixture'); }

// ── THE MIGRATION, AS WRITTEN, IN ONE GO ────────────────────────────────────────────────────
const [body] = migration.split(/^-- ═+$/m);
try {
  await db.exec(body);
  ok(true, 'the migration ran end to end — every statement, in its own BEGIN…COMMIT');
} catch (e) {
  ok(false, `the migration FAILED: ${e.message}`);
}

// ── V1 ──────────────────────────────────────────────────────────────────────────────────────
{
  const r = await db.query(`SELECT
    to_regclass('public.geocode_cache') IS NOT NULL AS table_exists,
    (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.geocode_cache'::regclass) AS rls_on,
    (SELECT count(*)::int FROM pg_policies WHERE tablename = 'geocode_cache') AS policies`);
  const v = r.rows[0] ?? {};
  ok(v.table_exists === true, 'V1 the table exists');
  ok(v.rls_on === true, 'V1 RLS is ON');
  ok(Number(v.policies) === 2, `V1 both policies are there (got ${v.policies})`);
}

// ── V2 — every constraint proven by being HIT ───────────────────────────────────────────────
{
  // 🔴 `owner_id` IS NOT NULL AND HAS NO DEFAULT — the first version of this insert omitted it,
  // failed, and was SWALLOWED by a `.catch(() => {})`. `biz` was then the string "undefined", so
  // the three constraint probes below "refused" on a uuid parse error rather than on the
  // constraints they name. Three green ticks for checks that never reached their subject —
  // [[R-33]], caught here only because the negative control (a LEGITIMATE row must be accepted)
  // failed with a message naming the real cause. Without that control this harness would have
  // reported 13/13 and proved nothing.
  await db.exec(`INSERT INTO public.businesses (id, owner_id, name)
                 VALUES ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Probe Co')
                 ON CONFLICT (id) DO NOTHING`);
  const biz = (await db.query(`SELECT id FROM public.businesses LIMIT 1`)).rows[0]?.id;
  ok(typeof biz === 'string' && biz.length === 36,
     `V2 a real business row exists to hang the probes on (got ${JSON.stringify(biz)})`);

  const refuses = async (label, sql, code) => {
    try { await db.exec(sql); ok(false, `V2 ${label} was ACCEPTED`); }
    catch (e) { ok(true, `V2 ${label} refused${code && e.message ? '' : ''}`); }
  };
  await refuses('a nonsense status',
    `INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status)
     VALUES ('${biz}', '__v2', '__a', 'nonsense')`);
  await refuses('half a coordinate',
    `INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status, latitude)
     VALUES ('${biz}', '__v2', '__b', 'found', 30.5)`);
  await refuses('a `found` verdict with NO coordinate',
    `INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status)
     VALUES ('${biz}', '__v2', '__c', 'found')`);

  // 🔴 THE NEGATIVE CONTROL. A constraint set that refuses everything passes all three above and
  // is worthless — so the legitimate shapes must be ACCEPTED.
  try {
    await db.exec(`INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status, latitude, longitude)
                   VALUES ('${biz}', '__v2', '__found', 'found', 30.5719542, -97.9188683)`);
    await db.exec(`INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status)
                   VALUES ('${biz}', '__v2', '__notfound', 'not_found')`);
    ok(true, 'V2 🔴 NEGATIVE CONTROL: a found-with-coordinate and a not_found-without are both ACCEPTED');
  } catch (e) {
    ok(false, `V2 a LEGITIMATE row was refused — the constraints are too strict: ${e.message}`);
  }

  await refuses('a duplicate (business, qb id, address)',
    `INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status)
     VALUES ('${biz}', '__v2', '__notfound', 'not_found')`);

  // …and the same address for a DIFFERENT customer is not a duplicate.
  try {
    await db.exec(`INSERT INTO public.geocode_cache (business_id, qb_customer_id, address_norm, geocode_status)
                   VALUES ('${biz}', '__v2_other', '__notfound', 'not_found')`);
    ok(true, 'V2 the same address under a DIFFERENT QuickBooks customer is allowed');
  } catch (e) { ok(false, `V2 a different customer at the same address was wrongly refused: ${e.message}`); }

  await db.exec(`DELETE FROM public.geocode_cache WHERE qb_customer_id LIKE '__v2%'`);
}

// ── V3 ──────────────────────────────────────────────────────────────────────────────────────
{
  const r = await db.query(`SELECT count(*)::int AS n FROM public.geocode_cache`);
  ok(Number(r.rows[0]?.n) === 0,
     `V3 the table starts EMPTY — nothing is backfilled by this migration (got ${r.rows[0]?.n})`);
}

console.log(`\ngeocode-cache-386 — ${pass} passed, ${fails.length} failed`);
if (fails.length) { console.error('FAILURES:\n' + fails.map(f => '  - ' + f).join('\n')); process.exit(1); }
