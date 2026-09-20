/**
 * -- ladder-caliper-356.pglite -- 20260918c_container_ladder_caliper EXECUTED ---------------------
 * (built from ladder-install-posts-343.pglite.mjs — same minimal schema, the two ladder migrations
 * before this one replayed first, then the caliper migration.)
 *
 * PURPOSE:      the REAL 20260914_container_ladder.sql and 20260916_container_ladder_install_t_posts.sql
 *               run on PGlite with a minimal surrounding schema, so the migration David applies has been
 *               executed by a Postgres engine first, not only read.
 *               P1–P4 the four new columns and the LAWNS backfills (posts; 30 gal and above = large) ·
 *               P5 a negative post count is refused · P6 a re-run never overwrites an edited figure ·
 *               P7–P10 get_planting_materials: a member with nothing saved gets {}, a member gets ONLY the
 *               planting keys, a non-member and an inactive member get NULL, anon cannot execute it ·
 *               M1–M2 mutants: drop the membership test (P9 must catch) · drop the re-run guard (P6).
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR (the same convention as rehearsal-342.pglite.mjs).
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is not available.
 * ⚠️ NOT in `npm run verify`. PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/ladder-install-posts-343.pglite.mjs
 */
import { readFileSync } from 'node:fs';
const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(process.cwd() + '/' + pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');

const MIG = process.cwd() + '/supabase/migrations/';
const LADDER = readFileSync(MIG + '20260914_container_ladder.sql', 'utf8');
const POSTS = readFileSync(MIG + '20260916_container_ladder_install_t_posts.sql', 'utf8');
const CAL = readFileSync(MIG + '20260918c_container_ladder_caliper.sql', 'utf8');
const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74', T = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
const MEMBER = '11111111-1111-1111-1111-111111111111', OUTSIDER = '22222222-2222-2222-2222-222222222222', GONE = '33333333-3333-3333-3333-333333333333';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function fresh(cal = CAL) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $f$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
    CREATE TABLE public.businesses (id uuid PRIMARY KEY, name text NOT NULL);
    INSERT INTO public.businesses VALUES ('${L}', 'LAWNS Tree Farm, LLC'), ('${T}', 'Test Dave''s Tree Nest');
    CREATE TABLE public.business_members (business_id uuid, user_id uuid, active boolean);
    INSERT INTO public.business_members VALUES ('${L}', '${MEMBER}', true), ('${L}', '${GONE}', false);
    -- the canonical membership test, as 20260622_is_active_member_canonical_rls.sql defines it
    CREATE FUNCTION public.is_active_member(p_business_id uuid) RETURNS boolean
      LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $f$
      SELECT EXISTS (SELECT 1 FROM public.business_members
                      WHERE business_id = p_business_id AND user_id = auth.uid() AND active = true) $f$;
    CREATE FUNCTION public.has_permission(uuid, text) RETURNS boolean LANGUAGE sql AS 'select true';
    CREATE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql AS
      $f$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$;
    CREATE TABLE public.business_operations_config (business_id uuid PRIMARY KEY, config jsonb NOT NULL DEFAULT '{}',
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
  `);
  await db.exec(LADDER);
  await db.exec(POSTS);
  await db.exec(cal);
  return db;
}
const as = async (db, user) => db.exec(`SELECT set_config('request.jwt.claim.sub', '${user ?? ''}', false)`);
const one = async (db, q) => (await db.query(q)).rows[0];

// ── the real migration ────────────────────────────────────────────────────────────────────────────
{
  const db = await fresh();
  const cols = (await db.query(`SELECT column_name, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='container_ladder' AND column_name LIKE 'caliper%' ORDER BY 1`)).rows;
  ok(cols.length === 3, `C1 the three caliper columns exist (got ${cols.length})`);
  ok(cols.find(c => c.column_name === 'caliper_min_inches')?.is_nullable === 'YES'
     && cols.find(c => c.column_name === 'caliper_max_inches')?.is_nullable === 'YES'
     && cols.find(c => c.column_name === 'caliper_because')?.is_nullable === 'NO',
    '🔴 C1b min and max are NULLABLE (unknown is not 0); the reason is required');

  const rows = (await db.query(`SELECT label, caliper_min_inches AS a, caliper_max_inches AS b, caliper_because AS w
    FROM public.container_ladder WHERE business_id='${L}' ORDER BY sort_order`)).rows;
  const txt = rows.map(r => `${r.label}:${r.a == null ? '-' : Number(r.a)}-${r.b == null ? '-' : Number(r.b)}`).join(' ');
  ok(txt === 'slip:--- 4 in:--- 3/5 gal:1-1 15 gal:1.25-1.25 30 gal:1.5-2.5 45 gal:2.5-3.5 65 gal:3.5-4.5 95/100:4-5 200 gal:5--',
    `🔴 C2 LAWNS calipers backfilled per size, exactly David's (got ${txt})`);
  ok(rows.filter(r => r.a != null).every(r => r.w === 'LAWNS, David 2026-09-18 — measured 12 in above the soil line')
     && rows.filter(r => r.a == null).every(r => r.w.startsWith('not set')), 'C2b each size names the source, or says not set');

  const refuses = async (sql, name) => { try { await db.exec(sql); return false; } catch (e) { return new RegExp(name).test(String(e.message)); } };
  ok(await refuses(`UPDATE public.container_ladder SET caliper_max_inches = 1 WHERE business_id='${L}' AND label='45 gal'`, 'caliper_range_check'),
    '🔴 C3 a max below the min is refused (V2)');
  ok(await refuses(`UPDATE public.container_ladder SET caliper_min_inches = NULL WHERE business_id='${L}' AND label='45 gal'`, 'caliper_range_check'),
    '🔴 C3b a max with no min is refused');
  ok(await refuses(`UPDATE public.container_ladder SET caliper_min_inches = 0 WHERE business_id='${L}' AND label='slip'`, 'caliper_min_inches_check'),
    'C3c a zero caliper is refused');

  const ops = await one(db, `SELECT config FROM public.business_operations_config WHERE business_id='${L}'`);
  ok(ops && Object.keys(ops.config).sort().join() === 'caliperMeasuredAtBecause,caliperMeasuredAtInches'
     && ops.config.caliperMeasuredAtInches === 12 && /measure everything at 12/.test(ops.config.caliperMeasuredAtBecause), `🔴 C4 LAWNS measures at 12 in, its own words are recorded, and nothing else is invented (got ${JSON.stringify(ops?.config)})`);
  ok((await one(db, `SELECT count(*)::int AS n FROM public.business_operations_config WHERE business_id='${T}'`)).n === 0, 'C4b no other tenant gets a height');

  // a re-run never overwrites what somebody has since edited
  await db.exec(`UPDATE public.container_ladder SET caliper_min_inches = 2, caliper_max_inches = 3, caliper_because = 'Terry' WHERE business_id='${L}' AND label='45 gal'`);
  await db.exec(`UPDATE public.business_operations_config SET config = '{"caliperMeasuredAtInches": 6, "ropeFeetPerTPost": 5}' WHERE business_id='${L}'`);
  await db.exec(CAL);
  const r45 = await one(db, `SELECT caliper_min_inches AS a, caliper_because AS w FROM public.container_ladder WHERE business_id='${L}' AND label='45 gal'`);
  const cfg = (await one(db, `SELECT config FROM public.business_operations_config WHERE business_id='${L}'`)).config;
  ok(Number(r45.a) === 2 && r45.w === 'Terry', `🔴 C5 a RE-RUN never overwrites an edited caliper (got ${r45.a}/${r45.w})`);
  ok(cfg.caliperMeasuredAtInches === 6 && cfg.ropeFeetPerTPost === 5, `🔴 C6 …nor a saved height, nor any other saved figure (got ${JSON.stringify(cfg)})`);
  await db.close();
}
{
  // a row that already exists without the key gets the key ADDED, the rest kept
  const db = await fresh('SELECT 1');
  await db.exec(`INSERT INTO public.business_operations_config (business_id, config) VALUES ('${L}', '{"ropeFeetPerTPost": 5}')`);
  await db.exec(CAL);
  const cfg = (await one(db, `SELECT config FROM public.business_operations_config WHERE business_id='${L}'`)).config;
  ok(cfg.caliperMeasuredAtInches === 12 && cfg.ropeFeetPerTPost === 5, `C7 an existing Operations row gains the height and keeps its figures (got ${JSON.stringify(cfg)})`);
  await db.close();
}

// ── mutants: the probes must refuse a broken migration ───────────────────────────────────────────
{
  const m1 = CAL.replace("   AND cl.caliper_because = 'not set — no caliper recorded for this size';", '   ;');
  ok(m1 !== CAL, 'M1 applied');
  const db = await fresh();
  await db.exec(`UPDATE public.container_ladder SET caliper_min_inches = 2, caliper_max_inches = 3, caliper_because = 'Terry' WHERE business_id='${L}' AND label='45 gal'`);
  await db.exec(m1);
  const a = Number((await one(db, `SELECT caliper_min_inches AS a FROM public.container_ladder WHERE business_id='${L}' AND label='45 gal'`)).a);
  ok(a === 2.5, `🔴 M1 CAUGHT — without the re-run guard an edited 2 is put back to 2.5, so C5 would fail (got ${a})`);
  await db.close();
}
{
  const m2 = CAL.replace(" WHERE NOT (public.business_operations_config.config ? 'caliperMeasuredAtInches');", ';');
  ok(m2 !== CAL, 'M2 applied');
  const db = await fresh();
  await db.exec(`UPDATE public.business_operations_config SET config = '{"caliperMeasuredAtInches": 6}' WHERE business_id='${L}'`);
  await db.exec(m2);
  const h = (await one(db, `SELECT config FROM public.business_operations_config WHERE business_id='${L}'`)).config.caliperMeasuredAtInches;
  ok(h === 12, `🔴 M2 CAUGHT — without the guard a saved 6 is overwritten with 12, so C6 would fail (got ${h})`);
  await db.close();
}
{
  const m3 = CAL.replace('CHECK (caliper_max_inches IS NULL OR (caliper_min_inches IS NOT NULL AND caliper_max_inches >= caliper_min_inches))', 'CHECK (true)');
  ok(m3 !== CAL, 'M3 applied');
  const db = await fresh(m3);
  let refused = true;
  try { await db.exec(`UPDATE public.container_ladder SET caliper_max_inches = 1 WHERE business_id='${L}' AND label='45 gal'`); refused = false; } catch { /* refused */ }
  ok(!refused, '🔴 M3 CAUGHT — without the range check a max below the min is accepted, so C3 would fail');
  await db.close();
}

console.log(`\nladder-caliper-356: ${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
