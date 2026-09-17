/**
 * -- ladder-install-posts-343.pglite -- 20260916_container_ladder_install_t_posts EXECUTED -----------
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
const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74', T = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
const MEMBER = '11111111-1111-1111-1111-111111111111', OUTSIDER = '22222222-2222-2222-2222-222222222222', GONE = '33333333-3333-3333-3333-333333333333';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function fresh(posts = POSTS) {
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
  await db.exec(posts);
  return db;
}
const as = async (db, user) => db.exec(`SELECT set_config('request.jwt.claim.sub', '${user ?? ''}', false)`);
const one = async (db, q) => (await db.query(q)).rows[0];

// ── the real migration ────────────────────────────────────────────────────────────────────────────
{
  const db = await fresh();
  const cols = (await db.query(`SELECT column_name, data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='container_ladder'
      AND column_name IN ('install_t_posts_per_tree','install_t_posts_because','is_large','is_large_because') ORDER BY 1`)).rows;
  ok(cols.length === 4 && cols.every(c => c.is_nullable === 'NO'), `P1 the four columns exist, NOT NULL (got ${cols.length})`);
  ok(cols.find(c => c.column_name === 'install_t_posts_per_tree')?.column_default === '0'
     && cols.find(c => c.column_name === 'is_large')?.column_default === 'false', 'P1b defaults are 0 and false');

  const rows = (await db.query(`SELECT label, install_t_posts_per_tree AS p, install_t_posts_because AS pb, is_large AS g, is_large_because AS gb
    FROM public.container_ladder WHERE business_id='${L}' ORDER BY sort_order`)).rows;
  const posts = rows.map(r => `${r.label}:${r.p}`).join(' ');
  ok(posts === 'slip:0 4 in:0 3/5 gal:0 15 gal:2 30 gal:2 45 gal:2 65 gal:2 95/100:4 200 gal:4', `🔴 P2 LAWNS posts backfilled per size (got ${posts})`);
  ok(rows.every(r => r.pb === 'LAWNS, David 2026-09-12'), 'P2b every LAWNS size names the source of its posts');
  const large = rows.filter(r => r.g).map(r => r.label).join(',');
  ok(large === '30 gal,45 gal,65 gal,95/100,200 gal', `🔴 P3 30 gal and above are large, 15 gal and below are not (got ${large})`);
  ok(rows.every(r => r.gb.startsWith('LAWNS, David 2026-09-17')), 'P3b every LAWNS size names the source of its large flag');
  ok((await one(db, `SELECT count(*)::int AS n FROM public.container_ladder WHERE business_id='${T}'`)).n === 0, 'P4 no other tenant gets rows');

  let refused = false;
  try { await db.exec(`UPDATE public.container_ladder SET install_t_posts_per_tree = -1 WHERE business_id='${L}' AND label='15 gal'`); }
  catch (e) { refused = /install_t_posts_per_tree_check/.test(String(e.message)); }
  ok(refused, 'P5 a negative post count is refused by the named CHECK (V2)');

  await db.exec(`UPDATE public.container_ladder SET install_t_posts_per_tree = 3, install_t_posts_because = 'Terry, by phone',
    is_large = false, is_large_because = 'Terry' WHERE business_id='${L}' AND label='45 gal'`);
  await db.exec(POSTS);
  const after = await one(db, `SELECT install_t_posts_per_tree AS p, is_large AS g FROM public.container_ladder WHERE business_id='${L}' AND label='45 gal'`);
  ok(after.p === 3 && after.g === false, `🔴 P6 a RE-RUN never overwrites a figure somebody edited (got ${after.p}/${after.g})`);

  await as(db, MEMBER);
  ok(JSON.stringify((await one(db, `SELECT public.get_planting_materials('${L}') AS j`)).j) === '{}',
    '🔴 P7 a member with nothing saved gets {} — the page then uses the standard figures and says so');
  await db.exec(`INSERT INTO public.business_operations_config (business_id, config) VALUES ('${L}',
    '{"installMixContainerVolumesPerTree": 2.5, "ropeFeetPerTPost": 5, "setupMinutesPerRun": 60, "tradeGallonFactor": 0.7}')`);
  const j = (await one(db, `SELECT public.get_planting_materials('${L}') AS j`)).j;
  ok(j.installMixContainerVolumesPerTree === 2.5 && j.ropeFeetPerTPost === 5, 'P8 a member reads the saved planting figures');
  ok(!('setupMinutesPerRun' in j) && !('tradeGallonFactor' in j) && !('bubblersPerTree' in j),
    `🔴 P8b ONLY the planting keys that are saved — nothing else from the row (got ${JSON.stringify(j)})`);
  await as(db, OUTSIDER);
  ok((await one(db, `SELECT public.get_planting_materials('${L}') AS j`)).j === null, '🔴 P9 a NON-member gets NULL — a refusal, not {}');
  await as(db, GONE);
  ok((await one(db, `SELECT public.get_planting_materials('${L}') AS j`)).j === null, 'P9b an INACTIVE member gets NULL');
  await as(db, null);
  ok((await one(db, `SELECT public.get_planting_materials('${L}') AS j`)).j === null, 'P9c no session gets NULL (the SQL editor case in V4)');
  const priv = await one(db, `SELECT has_function_privilege('anon','public.get_planting_materials(uuid)','EXECUTE') AS a,
    has_function_privilege('authenticated','public.get_planting_materials(uuid)','EXECUTE') AS u`);
  ok(priv.a === false && priv.u === true, `🔴 P10 anon cannot execute it; authenticated can (got ${priv.a}/${priv.u})`);
  await db.close();
}

// ── mutants: the probes must refuse a broken migration ───────────────────────────────────────────
{
  const m1 = POSTS.replace('WHEN NOT public.is_active_member(p_business_id) THEN NULL', 'WHEN false THEN NULL');
  ok(m1 !== POSTS, 'M1 applied');
  const db = await fresh(m1);
  await db.exec(`INSERT INTO public.business_operations_config (business_id, config) VALUES ('${L}', '{"ropeFeetPerTPost": 5}')`);
  await as(db, OUTSIDER);
  const leaked = (await one(db, `SELECT public.get_planting_materials('${L}') AS j`)).j;
  ok(leaked !== null, '🔴 M1 CAUGHT — without the membership test a non-member reads the figures, so P9 would fail');
  await db.close();
}
{
  const m2 = POSTS.replace("   AND cl.install_t_posts_because = 'not set — no posts until somebody enters them';", '   ;');
  ok(m2 !== POSTS, 'M2 applied');
  const db = await fresh();
  await db.exec(`UPDATE public.container_ladder SET install_t_posts_per_tree = 3, install_t_posts_because = 'Terry' WHERE business_id='${L}' AND label='45 gal'`);
  await db.exec(m2);
  const p = (await one(db, `SELECT install_t_posts_per_tree AS p FROM public.container_ladder WHERE business_id='${L}' AND label='45 gal'`)).p;
  ok(p === 2, `🔴 M2 CAUGHT — without the re-run guard an edited 3 is put back to 2, so P6 would fail (got ${p})`);
  await db.close();
}

console.log(`\nladder-install-posts-343: ${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
