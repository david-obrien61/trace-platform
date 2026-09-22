/**
 * -- build-runs-freeze-370.pglite -- 20260922_build_runs_freeze_cost EXECUTED --------------------
 *
 * PURPOSE:      the REAL migration run on PGlite, so the file David applies has been EXECUTED by a
 *               Postgres engine rather than only read. These are the migration's OWN V-blocks
 *               (V0–V4), run by the author first, per David's standing instruction: "write them,
 *               run their V-blocks yourself, and HOLD".
 *
 *               V0 the tables, their column counts and their policies · V1 a run's cost is FROZEN
 *               and does not move when the recipe is corrected afterwards · V2 there is no UPDATE
 *               and no DELETE policy, because a frozen cost that can be edited is not frozen ·
 *               V3 a half-typed price is refused · V4 an uncosted run stores NULL, never 0 ·
 *               M1–M4 mutants, each restoring a defect this file exists to prevent.
 *
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR. Runs 20260921 + 20260921c first, because this
 *               migration depends on both (item_recipes, recipe_components, business_inventory).
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is not available.
 * ⚠️ NOT in `npm run verify` — PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/build-runs-freeze-370.pglite.mjs
 */
import { readFileSync } from 'node:fs';
const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(process.cwd() + '/' + pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');

const MIG = process.cwd() + '/supabase/migrations/';
const BASE = readFileSync(MIG + '20260921_recipes_made_items.sql', 'utf8')
  + '\n' + readFileSync(MIG + '20260921c_build_run_says_when_the_ledger_did_not_record.sql', 'utf8');
const THIS_ONE = readFileSync(MIG + '20260922_build_runs_freeze_cost.sql', 'utf8');

const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const MEMBER = '11111111-1111-1111-1111-111111111111';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function fresh(extra = THIS_ONE) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $f$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
    CREATE TABLE public.businesses (id uuid PRIMARY KEY, name text NOT NULL, qbo_writes_enabled boolean DEFAULT true);
    INSERT INTO public.businesses VALUES ('${L}', 'LAWNS Tree Farm, LLC', true);
    CREATE TABLE public.business_members (business_id uuid, user_id uuid, active boolean);
    INSERT INTO public.business_members VALUES ('${L}', '${MEMBER}', true);
    CREATE FUNCTION public.is_active_member(p_business_id uuid) RETURNS boolean
      LANGUAGE sql SECURITY DEFINER STABLE SET search_path = '' AS $f$
      SELECT EXISTS (SELECT 1 FROM public.business_members
                      WHERE business_id = p_business_id AND user_id = auth.uid() AND active = true) $f$;
    CREATE FUNCTION public.has_permission(uuid, text) RETURNS boolean LANGUAGE sql AS 'select true';
    CREATE TABLE public.business_operations_config (business_id uuid PRIMARY KEY, config jsonb NOT NULL DEFAULT '{}');
    CREATE TABLE public.vendors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, name text);
    CREATE TABLE public.receipts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, vendor text, amount numeric);
    CREATE TABLE public.business_inventory (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, name text NOT NULL,
      size text, qty numeric DEFAULT 0, qb_item_id text, retired_at timestamptz,
      import_run_id uuid, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.business_inventory_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, inventory_id uuid, delta numeric,
      kind text, reason text, source_type text, source_id uuid, actor_user_id uuid,
      occurred_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now());
  `);
  await db.exec(BASE);
  await db.exec(extra);
  await db.exec(`SET request.jwt.claim.sub = '${MEMBER}';`);
  return db;
}

/** A recipe with one typed-price component, returning its id. */
async function recipeWith(db, tag, typed = true) {
  const r = await db.query(`INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit)
    VALUES ('${L}', '${tag}-' || gen_random_uuid()::text, 2.5, 'yd') RETURNING id`);
  const id = r.rows[0].id;
  await db.query(`INSERT INTO public.recipe_components (recipe_id, position, name, quantity, unit
    ${typed ? ', typed_pack_cost, typed_pack_size, typed_pack_unit' : ''})
    VALUES ($1, 1, '${tag} Bark', 2, 'yd' ${typed ? ", 30.88, 1, 'yd'" : ''})`, [id]);
  return id;
}

// ── V0 · the tables, their columns and their policies ────────────────────────────────────────
{
  const db = await fresh();
  const q = await db.query(`
    SELECT c.table_name, count(*)::int AS cols,
           (SELECT count(*)::int FROM pg_policies p WHERE p.tablename = c.table_name) AS policies
      FROM information_schema.columns c
     WHERE c.table_schema = 'public' AND c.table_name IN ('build_runs','build_run_components')
     GROUP BY c.table_name ORDER BY 1`);
  const runs = q.rows.find(r => r.table_name === 'build_runs');
  const comps = q.rows.find(r => r.table_name === 'build_run_components');
  ok(runs && runs.cols === 16 && runs.policies === 2,
    `V0a build_runs — 16 columns, 2 policies (got ${runs?.cols}/${runs?.policies})`);
  ok(comps && comps.cols === 11 && comps.policies === 2,
    `V0b build_run_components — 11 columns, 2 policies (got ${comps?.cols}/${comps?.policies})`);
  const typed = await db.query(`SELECT count(*)::int n FROM information_schema.columns
     WHERE table_name='recipe_components' AND column_name LIKE 'typed_%'`);
  ok(typed.rows[0].n === 4, `V0c recipe_components gained its four typed-price columns (got ${typed.rows[0].n})`);
  await db.close();
}

// ── V1 · THE COST IS FROZEN ──────────────────────────────────────────────────────────────────
{
  const db = await fresh();
  const rec = await recipeWith(db, 'V1');
  const run = (await db.query(`INSERT INTO public.build_runs
    (business_id, recipe_id, batches, yield_cubic_yards, materials_cost, total_cost,
     cost_per_cubic_yard, cost_incomplete, cost_note)
    VALUES ('${L}', $1, 1, 2.5, 61.76, 61.76, 24.70, false, 'V1 frozen') RETURNING id`, [rec])).rows[0].id;
  const before = (await db.query(`SELECT total_cost FROM public.build_runs WHERE id = $1`, [run])).rows[0].total_cost;
  await db.query(`UPDATE public.recipe_components SET typed_pack_cost = 99.00 WHERE recipe_id = $1`, [rec]);
  const after = (await db.query(`SELECT total_cost FROM public.build_runs WHERE id = $1`, [run])).rows[0].total_cost;
  ok(String(before) === String(after) && Number(after) === 61.76,
    `🔴 V1 the run's cost is FROZEN — still ${after} after the recipe moved to 99.00`);
  await db.close();
}

// ── V2 · NO UPDATE, NO DELETE ────────────────────────────────────────────────────────────────
{
  const db = await fresh();
  const n = (await db.query(`SELECT count(*)::int n FROM pg_policies
     WHERE tablename IN ('build_runs','build_run_components') AND cmd IN ('UPDATE','DELETE')`)).rows[0].n;
  ok(n === 0, `🔴 V2 no UPDATE and no DELETE policy — a frozen cost that can be edited is not frozen (got ${n})`);
  await db.close();
}

// ── V3 · A HALF-TYPED PRICE IS REFUSED ───────────────────────────────────────────────────────
{
  const db = await fresh();
  const rec = await recipeWith(db, 'V3', false);
  let refused = false;
  try {
    await db.query(`INSERT INTO public.recipe_components (recipe_id, position, name, quantity, unit, typed_pack_cost)
      VALUES ($1, 2, 'V3 half', 1, 'lb', 60.00)`, [rec]);
  } catch { refused = true; }
  ok(refused, '🔴 V3 a cost with no pack size is REFUSED — it can give no price per lb, and a half-typed price is the blank that reads as zero');
  let whole = true;
  try {
    await db.query(`INSERT INTO public.recipe_components
      (recipe_id, position, name, quantity, unit, typed_pack_cost, typed_pack_size, typed_pack_unit)
      VALUES ($1, 3, 'V3 whole', 1, 'lb', 60.00, 50, 'lb')`, [rec]);
  } catch { whole = false; }
  ok(whole, 'V3b NEGATIVE CONTROL — a COMPLETE typed price is accepted, so the CHECK refuses the right thing');
  await db.close();
}

// ── V4 · AN UNCOSTED RUN STORES NULL, NOT ZERO ───────────────────────────────────────────────
{
  const db = await fresh();
  const rec = await recipeWith(db, 'V4', false);
  const row = (await db.query(`INSERT INTO public.build_runs (business_id, recipe_id, batches, cost_incomplete, cost_note)
    VALUES ('${L}', $1, 1, true, 'nothing could be costed') RETURNING total_cost, cost_incomplete`, [rec])).rows[0];
  ok(row.total_cost === null, `🔴 V4 an uncosted run stores NULL, never 0 — 0 reads as free (got ${row.total_cost})`);
  ok(row.cost_incomplete === true, 'V4b …and the row SAYS its cost is incomplete rather than leaving a reader to infer it');
  await db.close();
}

// ── MUTANTS ──────────────────────────────────────────────────────────────────────────────────
// Each restores a defect this migration exists to prevent. A probe nobody has watched refuse is a
// claim (§6 r19), and these are the four claims this file makes.
const MUTANTS = [
  ['M1 an UPDATE policy is added to build_runs (the cost becomes editable)',
   'COMMIT;', `CREATE POLICY build_runs_edit ON public.build_runs FOR UPDATE USING (true);\nCOMMIT;`],
  ['M2 the typed-price CHECK is dropped (a half-typed price is accepted)',
   'ADD CONSTRAINT recipe_components_typed_price_is_whole CHECK (', 'ADD CONSTRAINT recipe_components_typed_price_is_whole CHECK (true OR ('],
  ['M3 total_cost gains a DEFAULT 0 (an uncosted run reads as free)',
   'total_cost        numeric NULL CHECK (total_cost IS NULL OR total_cost >= 0),',
   'total_cost        numeric NULL DEFAULT 0 CHECK (total_cost IS NULL OR total_cost >= 0),'],
  ['M4 build_run_components loses its price_source (which figures were typed becomes unknowable)',
   "  price_source      text NULL CHECK (price_source IS NULL OR price_source IN ('receipt', 'typed')),", ''],
];

console.log('\n── MUTANTS ──────────────────────────────────────────');
let caught = 0;
for (const [name, from, to] of MUTANTS) {
  if (!THIS_ONE.includes(from)) { console.log(`⚠️  ${name} — TARGET NOT FOUND, proves nothing`); continue; }
  const before = fails;
  try {
    const db = await fresh(THIS_ONE.replace(from, to));
    // re-run the assertions that matter for this mutant
    const pol = (await db.query(`SELECT count(*)::int n FROM pg_policies
       WHERE tablename IN ('build_runs','build_run_components') AND cmd IN ('UPDATE','DELETE')`)).rows[0].n;
    if (pol !== 0) fails++;
    const cols = (await db.query(`SELECT count(*)::int n FROM information_schema.columns
       WHERE table_name='build_run_components' AND column_name='price_source'`)).rows[0].n;
    if (cols !== 1) fails++;
    const rec = await recipeWith(db, 'M', false);
    try {
      await db.query(`INSERT INTO public.recipe_components (recipe_id, position, name, quantity, unit, typed_pack_cost)
        VALUES ($1, 9, 'half', 1, 'lb', 60.00)`, [rec]);
      fails++;                       // it was accepted — the CHECK is gone
    } catch { /* refused, correct */ }
    const r = (await db.query(`INSERT INTO public.build_runs (business_id, recipe_id, batches, cost_incomplete)
      VALUES ('${L}', $1, 1, true) RETURNING total_cost`, [rec])).rows[0];
    if (r.total_cost !== null) fails++;
    await db.close();
  } catch { fails++; }
  const bit = fails > before;
  if (bit) caught++;
  console.log(`${bit ? '✅ CAUGHT  ' : '🔴 SURVIVED'} ${name}`);
  fails = before;                    // the mutant's failures are not the file's
}
console.log(`\n${caught}/${MUTANTS.length} mutants caught`);
if (caught !== MUTANTS.length) fails++;

console.log(fails === 0 ? '\nALL PASS' : `\n${fails} FAILURE(S)`);
process.exit(fails === 0 ? 0 : 1);
