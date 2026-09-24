/**
 * -- ladder-grow-hold-390.pglite -- 20260923h_container_ladder_grow_and_hold EXECUTED ------------
 * (built from ladder-caliper-356.pglite.mjs — same minimal surrounding schema, the ladder
 * migrations replayed in order, then the grow/hold migration.)
 *
 * PURPOSE:      the REAL migration David will paste runs on PGlite first, so it has been EXECUTED
 *               by a Postgres engine rather than only read. Answers the V-block in the migration's
 *               own foot, in the verdict style, so the verdicts can be reported before it is applied.
 *               V1 the four columns exist with the right nullability and defaults ·
 *               V2 both named CHECKs exist and are findable BY NAME (tech-debt #91) ·
 *               V3 🔴 the grow CHECK actually REFUSES a 0 and accepts a 6 (R-33 — a guard nobody has
 *                  watched refuse is a claim) · V3b the same for hold ·
 *               V4 nothing existing changed: every seeded rung keeps its label and sort order, and
 *                  both new numerics are NULL on every row until somebody sets one ·
 *               V5 the ladder's existing RLS policies are untouched, unchanged in number ·
 *               V6 a NEGATIVE value is refused too, not just 0 ·
 *               M1 mutant: the CHECK written as `>= 0` — V3 must catch it.
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR (the convention of every harness in this folder).
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is not available.
 * ⚠️ NOT in `npm run verify`. PGlite is Postgres 18; Supabase runs an older major, so this proves
 *    the SQL is well-formed and the constraints bite — it does not replace applying it.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/ladder-grow-hold-390.pglite.mjs
 */
import { readFileSync } from 'node:fs';
const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(process.cwd() + '/' + pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');

const MIG = process.cwd() + '/supabase/migrations/';
const read = (f) => readFileSync(MIG + f, 'utf8');
const LADDER = read('20260914_container_ladder.sql');
const POSTS = read('20260916_container_ladder_install_t_posts.sql');
const CAL = read('20260918c_container_ladder_caliper.sql');
const PRICE = read('20260923e_container_ladder_install_price.sql');
const GROW = read('20260923h_container_ladder_grow_and_hold.sql');

const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74', T = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
const MEMBER = '11111111-1111-1111-1111-111111111111';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const refused = async (db, sql) => { try { await db.exec(sql); return null; } catch (e) { return String(e.message || e); } };

async function fresh(grow = GROW) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $f$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
    CREATE TABLE public.businesses (id uuid PRIMARY KEY, name text NOT NULL);
    INSERT INTO public.businesses VALUES ('${L}', 'LAWNS Tree Farm, LLC'), ('${T}', 'Test Dave''s Tree Nest');
    CREATE TABLE public.business_members (business_id uuid, user_id uuid, active boolean);
    INSERT INTO public.business_members VALUES ('${L}', '${MEMBER}', true);
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
  await db.exec(LADDER); await db.exec(POSTS); await db.exec(CAL); await db.exec(PRICE);
  await db.exec(grow);
  return db;
}

const db = await fresh();

// ── V1 the four columns, with the nullability the design depends on ────────────────────────────
{
  const r = await db.query(`SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public' AND table_name='container_ladder'
      AND column_name IN ('grow_months','grow_because','hold_months','hold_because')
    ORDER BY column_name`);
  const by = Object.fromEntries(r.rows.map((x) => [x.column_name, x]));
  ok(r.rows.length === 4, `V1 all four columns exist (${r.rows.length} of 4)`);
  ok(by.grow_months?.is_nullable === 'YES' && by.hold_months?.is_nullable === 'YES',
    'V1 🔴 both month columns are NULLABLE — UNKNOWN is a state the schema can hold');
  ok(by.grow_because?.is_nullable === 'NO' && by.hold_because?.is_nullable === 'NO',
    'V1 both reason columns are NOT NULL — an unlabelled number cannot exist');
  ok(/''::text/.test(by.grow_because?.column_default ?? '') && /''::text/.test(by.hold_because?.column_default ?? ''),
    'V1 …and they default to the empty string, which the reader maps to "not set"');
  ok(by.grow_months?.data_type === 'numeric' && by.hold_months?.data_type === 'numeric',
    'V1 both month columns are numeric');
}

// ── V2 the CHECKs are NAMED and findable BY NAME (tech-debt #91) ────────────────────────────────
{
  const r = await db.query(`SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
    WHERE conrelid='public.container_ladder'::regclass AND contype='c'
      AND conname IN ('container_ladder_grow_months_check','container_ladder_hold_months_check')
    ORDER BY conname`);
  ok(r.rows.length === 2, `V2 both named CHECKs exist and are greppable by name (${r.rows.length} of 2)`);
}

// ── V3 🔴 THE GUARD ACTUALLY REFUSES. A check nobody has watched refuse is a claim (R-33) ───────
{
  const zero = await refused(db, `UPDATE public.container_ladder SET grow_months = 0 WHERE label = '15 gal'`);
  ok(zero != null && /container_ladder_grow_months_check/.test(zero),
    'V3 🔴 a GROW of 0 is REFUSED by name — a tree sellable the day it is potted is not a short grow');
  const six = await refused(db, `UPDATE public.container_ladder SET grow_months = 6, grow_because = 'David 2026-09-18' WHERE label = '15 gal'`);
  ok(six == null, 'V3 …and 6 is accepted — the guard refuses the nonsense, not the number David ruled');
  const neg = await refused(db, `UPDATE public.container_ladder SET grow_months = -1 WHERE label = '15 gal'`);
  ok(neg != null, 'V6 a NEGATIVE grow is refused too, not only 0');
  const h0 = await refused(db, `UPDATE public.container_ladder SET hold_months = 0 WHERE label = '15 gal'`);
  ok(h0 != null && /container_ladder_hold_months_check/.test(h0), 'V3b a HOLD of 0 is refused by name');
  const h12 = await refused(db, `UPDATE public.container_ladder SET hold_months = 12 WHERE label = '15 gal'`);
  ok(h12 == null, 'V3b …and 12 is accepted');
  // NULL is always legal — it is the ordinary answer, not an error.
  const nul = await refused(db, `UPDATE public.container_ladder SET grow_months = NULL WHERE label = '15 gal'`);
  ok(nul == null, 'V3c 🔴 NULL is accepted on both — UNKNOWN is a legal, expected state');
}

// ── V4 nothing existing changed ─────────────────────────────────────────────────────────────────
// ⚠️ ON A FRESH DATABASE, DELIBERATELY. The first draft reused `db` and FAILED — because V3 above
// had just UPDATEd the 15 gal rung to prove the guard refuses, so V4 was reading V3's leftovers.
// The probe was wrong, not the migration; recorded here because a later reader will otherwise
// "simplify" it back to the shared handle and get a red that looks like a schema defect.
{
  const fresh4 = await fresh();
  const r = await fresh4.query(`SELECT label, sort_order, grow_months, hold_months, grow_because, hold_because
    FROM public.container_ladder WHERE business_id='${L}' ORDER BY sort_order`);
  ok(r.rows.length > 0, `V4 the seeded rungs are still there (${r.rows.length})`);
  ok(r.rows.every((x) => x.grow_months == null && x.hold_months == null),
    'V4 🔴 every rung carries NULL grow and hold — the migration states nothing on anybody\'s behalf');
  ok(r.rows.every((x) => x.grow_because === '' && x.hold_because === ''),
    'V4 …and both reasons are the empty string, which reads as "not set"');
}

// ── V5 RLS untouched ────────────────────────────────────────────────────────────────────────────
{
  const r = await db.query(`SELECT policyname, cmd FROM pg_policies WHERE tablename='container_ladder'`);
  const bare = await (async () => { const d = await fresh(''); const q = await d.query(
    `SELECT policyname FROM pg_policies WHERE tablename='container_ladder'`); return q.rows.length; })();
  ok(r.rows.length === bare,
    `V5 🔴 the policy COUNT is identical with and without this migration (${r.rows.length} = ${bare}) — RLS untouched`);
}

// ── S1–S4 THE STEP-0 SQL DAVID PASTES, EXECUTED ────────────────────────────────────────────────
// `docs/decisions/2026-09-23-lawns-grow-ladder-step0.sql` is run here against a config row seeded
// with EXACTLY the three keys LAWNS holds live, so the claim "the merge keeps them" is measured
// rather than reasoned about. The caliper one is load-bearing: LAWNS measures at 12 and the
// platform default is 6, so a merge that replaced instead of merging would silently move every
// caliper on the ladder.
{
  const s0 = await fresh();
  // UPSERT, not INSERT: an earlier ladder migration already creates this row, and the first draft
  // of this probe collided on the primary key. Set it to EXACTLY the three keys LAWNS holds live.
  await s0.exec(`INSERT INTO public.business_operations_config (business_id, config) VALUES ('${L}',
    '{"madeItemLabel":"homemade","caliperMeasuredAtInches":12,"caliperMeasuredAtBecause":"LAWNS, David 2026-09-18"}'::jsonb)
    ON CONFLICT (business_id) DO UPDATE SET config = EXCLUDED.config`);
  const STEP0 = readFileSync(process.cwd() + '/docs/decisions/2026-09-23-lawns-grow-ladder-step0.sql', 'utf8');
  await s0.exec(STEP0);

  const w = (await s0.query(`SELECT config->>'windowStart' a, config->>'windowEnd' b,
      config->>'caliperMeasuredAtInches' cal, config->>'madeItemLabel' made,
      (config ? 'caliperMeasuredAtBecause') AS kept
    FROM public.business_operations_config WHERE business_id='${L}'`)).rows[0];
  ok(w.a === '2026-11-04' && w.b === '2026-11-12', `S1 the uppot window is set (${w.a} → ${w.b})`);
  ok(w.cal === '12', `S2 🔴 LAWNS's caliper height SURVIVES the merge — still 12, not the platform's 6 (got ${w.cal})`);
  ok(w.made === 'homemade' && w.kept === true, 'S2 …and the other two keys LAWNS held are still there');

  const g = (await s0.query(`SELECT count(*) FILTER (WHERE grow_months IS NOT NULL)::int with_grow,
      count(*)::int total FROM public.container_ladder WHERE business_id='${L}'`)).rows[0];
  ok(g.with_grow === 1, `S4 🔴 EXACTLY ONE rung carries a grow figure (${g.with_grow}) — the other eight stay UNKNOWN on purpose`);
  ok(g.total === 9, `S3 all nine rungs are still present (${g.total})`);
  const fifteen = (await s0.query(`SELECT grow_months::int m, grow_because b FROM public.container_ladder
    WHERE business_id='${L}' AND label='15 gal'`)).rows[0];
  ok(fifteen.m === 6, `S3 …and it is the 15 gal rung at 6 months (got ${fifteen.m})`);
  ok(/David, 2026-09-18/.test(fifteen.b), 'S3 …carrying its provenance, not a bare number');

  // ⚠️ IDEMPOTENCE. David may paste it twice; it must not double anything or fail.
  await s0.exec(STEP0);
  const again = (await s0.query(`SELECT count(*) FILTER (WHERE grow_months IS NOT NULL)::int n
    FROM public.container_ladder WHERE business_id='${L}'`)).rows[0];
  ok(again.n === 1, 'S5 running it twice changes nothing — it is idempotent');
}

// ── M1 MUTANT: the CHECK written the forgiving way. V3 must catch it. ───────────────────────────
{
  const mutant = GROW.replace(/grow_months IS NULL OR grow_months > 0/, 'grow_months IS NULL OR grow_months >= 0');
  const m = await fresh(mutant);
  const zero = await refused(m, `UPDATE public.container_ladder SET grow_months = 0 WHERE label = '15 gal'`);
  ok(zero == null, 'M1 (setup) the mutant DOES accept 0 — the mutant is live, not a no-op');
  ok(!(zero != null), 'M1 🔴 …so V3 above would have gone RED against it — the probe can disagree');
}

console.log(fails === 0 ? '\n✅ ladder-grow-hold-390 — all probes pass' : `\n❌ ${fails} FAILED`);
process.exit(fails === 0 ? 0 : 1);
