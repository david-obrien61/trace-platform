/**
 * -- recipes-370.pglite -- 20260921_recipes_made_items EXECUTED ----------------------------------
 *
 * PURPOSE:      the REAL migration run on PGlite against a minimal surrounding schema, so the file
 *               David applies has been EXECUTED by a Postgres engine, not only read.
 *               P1–P3 the flag, its CHECK and the per-business label · P4–P6 the four tables, RLS on,
 *               the policies, and NO delete policy anywhere · P7–P9 the identity rules (exactly one
 *               of qb_item_id/inventory_id; one recipe per item; a yield of 0 refused) ·
 *               P10–P14 the BUILD RUN: components out and finished in, in one transaction; an
 *               unstocked component moves nothing and is NAMED; refusals for a non-member, a bad
 *               batch count and a recipe with no stock row · P15 anon cannot execute it ·
 *               M1–M3 mutants: drop the identity CHECK, silently skip an unstocked component, and
 *               let the build run write outside its own business.
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is not available.
 * ⚠️ NOT in `npm run verify` — PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/recipes-370.pglite.mjs
 */
import { readFileSync } from 'node:fs';
const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(process.cwd() + '/' + pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');

const MIG = process.cwd() + '/supabase/migrations/';
const RECIPES = readFileSync(MIG + '20260921_recipes_made_items.sql', 'utf8');
const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74', T = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';
const MEMBER = '11111111-1111-1111-1111-111111111111', OUTSIDER = '22222222-2222-2222-2222-222222222222';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function fresh(mig = RECIPES, permission = 'select true') {
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
    CREATE FUNCTION public.has_permission(uuid, text) RETURNS boolean LANGUAGE sql AS '${permission}';
    CREATE TABLE public.business_operations_config (business_id uuid PRIMARY KEY, config jsonb NOT NULL DEFAULT '{}');
    CREATE TABLE public.vendors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, name text);
    CREATE TABLE public.receipts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, vendor text, amount numeric);
    CREATE TABLE public.business_inventory (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, name text NOT NULL,
      size text, qty numeric DEFAULT 0, qb_item_id text, retired_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.business_inventory_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, inventory_id uuid, delta numeric,
      kind text, reason text, source_type text, source_id uuid, actor_user_id uuid,
      occurred_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now());
  `);
  await db.exec(mig);
  return db;
}
const as = async (db, user) => db.exec(`SELECT set_config('request.jwt.claim.sub', '${user ?? ''}', false)`);
const one = async (db, q) => (await db.query(q)).rows[0];
const refuses = async (db, sql, name) => {
  try { await db.exec(sql); return false; } catch (e) { return new RegExp(name).test(String(e.message)); }
};

/** The special planting mix, as David gave it — the first real recipe. */
async function seedSpm(db) {
  await db.exec(`
    INSERT INTO public.business_inventory (business_id, name, qty, qb_item_id) VALUES
      ('${L}', 'Special Planting Mix', 0, 'SPM1'),
      ('${L}', 'Shook Out Brown', 100, 'BARK1'),
      ('${L}', 'Compost', 50, 'COMP1'),
      ('${L}', 'Osmocote 21-4-8', 200, 'OSMO1');
    INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit, build_minutes)
      VALUES ('${L}', 'SPM1', 2.5, 'yd', 38);
    INSERT INTO public.recipe_components (recipe_id, position, name, quantity, unit, component_qb_item_id)
      SELECT r.id, v.pos, v.nm, v.q, v.u, v.qb FROM public.item_recipes r,
        (VALUES (1,'Shook Out Brown',2.0,'yd','BARK1'), (2,'Compost',0.5,'yd','COMP1'),
                (3,'Osmocote 21-4-8',25,'lb','OSMO1'), (4,'12-24-12',2,'lb',NULL))
        AS v(pos, nm, q, u, qb)
      WHERE r.qb_item_id = 'SPM1';
  `);
}

// ── the real migration ────────────────────────────────────────────────────────────────────────
{
  const db = await fresh();
  const col = await one(db, `SELECT data_type, is_nullable, column_default FROM information_schema.columns
    WHERE table_schema='public' AND table_name='business_inventory' AND column_name='item_type'`);
  ok(col && col.data_type === 'text' && col.is_nullable === 'NO' && /purchased/.test(col.column_default),
    `P1 item_type exists, NOT NULL, defaulting to purchased (got ${JSON.stringify(col)})`);
  ok(await refuses(db, `INSERT INTO public.business_inventory (business_id, name, item_type) VALUES ('${L}','x','made-up')`,
    'item_type_check'), '🔴 P2 a value outside purchased/grown/manufactured is refused (the ERROR is the pass)');
  const label = await one(db, `SELECT config->>'madeItemLabel' AS w FROM public.business_operations_config WHERE business_id='${L}'`);
  ok(label && label.w === 'homemade', `🔴 P3 LAWNS's own word for a made item is recorded (got ${label && label.w})`);
  ok((await one(db, `SELECT count(*)::int n FROM public.business_operations_config WHERE business_id='${T}'`)).n === 0,
    'P3b no other tenant gets a label');

  const tables = (await db.query(`SELECT c.relname, c.relrowsecurity FROM pg_class c
    WHERE c.relname IN ('item_recipes','recipe_components','component_purchase_links','labour_rates') ORDER BY 1`)).rows;
  ok(tables.length === 4 && tables.every(t => t.relrowsecurity), `P4 four tables, RLS on all (got ${tables.length})`);
  const pols = (await db.query(`SELECT c.relname, p.polcmd FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relname IN ('item_recipes','recipe_components','component_purchase_links','labour_rates')`)).rows;
  ok(pols.length === 12, `P5 three policies on each table (got ${pols.length})`);
  ok(!pols.some(p => p.polcmd === 'd'), '🔴 P6 NO delete policy anywhere — a recipe is retired, never deleted (R-133)');
  const wages = (await db.query(`SELECT p.polname, pg_get_expr(p.polqual, p.polrelid) q FROM pg_policy p
    JOIN pg_class c ON c.oid = p.polrelid WHERE c.relname='labour_rates' AND p.polcmd='r'`)).rows[0];
  ok(wages && /pricing_recipe:read/.test(wages.q),
    '🔴 P6b wages sit behind the MONEY wall, not behind settings — a manager holds settings and not this (R-87)');

  // A REAL row first: with an empty table the subselect is NULL, only one identity is set, and the
  // probe would pass for the wrong reason — it did, on the first run, and that is why this line exists.
  await db.exec(`INSERT INTO public.business_inventory (business_id, name, qty, qb_item_id) VALUES ('${L}','Bubbler',0,NULL)`);
  ok(await refuses(db, `INSERT INTO public.item_recipes (business_id, qb_item_id, inventory_id, yield_quantity, yield_unit)
      VALUES ('${L}','9', (SELECT id FROM public.business_inventory WHERE name='Bubbler'), 1, 'each')`, 'one_identity'),
    '🔴 P7 a recipe carrying BOTH identities is refused — one item, one key (the ERROR is the pass)');
  ok(await refuses(db, `INSERT INTO public.item_recipes (business_id, yield_quantity, yield_unit) VALUES ('${L}', 1, 'each')`,
    'one_identity'), 'P7b …and a recipe carrying NEITHER is refused too');
  ok(await refuses(db, `INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit)
      VALUES ('${L}','9', 0, 'yd')`, 'yield_quantity_check'), '🔴 P8 a yield of zero is refused');
  await db.exec(`INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit) VALUES ('${L}','DUP',1,'each')`);
  ok(await refuses(db, `INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit) VALUES ('${L}','DUP',1,'each')`,
    'item_recipes_one_per_qb_item'), '🔴 P9 one recipe per item — a second is refused by the index');
  ok((await one(db, `SELECT count(*)::int n FROM public.labour_rates`)).n === 0, 'P10 the labour table ships EMPTY');
  await db.close();
}

// ── the build run ─────────────────────────────────────────────────────────────────────────────
{
  const db = await fresh();
  await seedSpm(db);
  await as(db, MEMBER);
  const r = await one(db, `SELECT public.record_build_run('${L}',
    (SELECT id FROM public.item_recipes WHERE qb_item_id='SPM1'), 2, 'two batches') AS j`);
  ok(r.j.ok === true && Number(r.j.made) === 5 && r.j.unit === 'yd',
    `🔴 P11 two batches make 5 yd of mix (got ${JSON.stringify(r.j.made)} ${r.j.unit})`);
  ok(Number(r.j.components_moved) === 3 && r.j.components_not_stocked.length === 1
     && r.j.components_not_stocked[0].name === '12-24-12',
    `🔴 P12 three components moved; the 12-24-12 has no stock row so it moved NOTHING and is NAMED (got ${JSON.stringify(r.j.components_not_stocked)})`);
  const qty = Object.fromEntries((await db.query(
    `SELECT name, qty::float FROM public.business_inventory WHERE business_id='${L}'`)).rows.map(x => [x.name, x.qty]));
  ok(qty['Special Planting Mix'] === 5 && qty['Shook Out Brown'] === 96 && qty['Compost'] === 49 && qty['Osmocote 21-4-8'] === 150,
    `🔴 P13 stock moved both ways in ONE call: mix 0→5, bark 100→96, compost 50→49, osmocote 200→150 (got ${JSON.stringify(qty)})`);
  const led = (await db.query(`SELECT kind, count(*)::int n FROM public.business_inventory_ledger GROUP BY 1 ORDER BY 1`)).rows;
  ok(JSON.stringify(led) === JSON.stringify([{ kind: 'build', n: 1 }, { kind: 'consume', n: 3 }]),
    `🔴 P14 the ledger carries one build and three consumes — the movements are events, not a silent qty edit (got ${JSON.stringify(led)})`);
  const src = await one(db, `SELECT count(DISTINCT source_id)::int n, count(*) FILTER (WHERE source_type='build_run')::int t
    FROM public.business_inventory_ledger`);
  ok(src.n === 1 && src.t === 4, 'P14b every row of the run shares ONE source id, so the run can be read back whole');

  const bad = await one(db, `SELECT public.record_build_run('${L}',
    (SELECT id FROM public.item_recipes WHERE qb_item_id='SPM1'), 0) AS j`);
  ok(bad.j.ok === false && bad.j.code === 'bad_batches', 'P15 zero batches is refused in words');
  await as(db, OUTSIDER);
  const out = await one(db, `SELECT public.record_build_run('${L}',
    (SELECT id FROM public.item_recipes WHERE qb_item_id='SPM1'), 1) AS j`);
  ok(out.j.ok === false && out.j.code === 'not_a_member', '🔴 P16 a non-member is refused — the function checks membership itself');
  const priv = await one(db, `SELECT has_function_privilege('anon','public.record_build_run(uuid,uuid,numeric,text)','EXECUTE') a,
    has_function_privilege('authenticated','public.record_build_run(uuid,uuid,numeric,text)','EXECUTE') u`);
  ok(priv.a === false && priv.u === true, '🔴 P17 anon cannot execute it; a logged-in member can');
  await db.close();
}

// ── a recipe whose item has no stock row ──────────────────────────────────────────────────────
{
  const db = await fresh();
  await db.exec(`INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit) VALUES ('${L}','GHOST',1,'each')`);
  await as(db, MEMBER);
  const r = await one(db, `SELECT public.record_build_run('${L}', (SELECT id FROM public.item_recipes WHERE qb_item_id='GHOST'), 1) AS j`);
  ok(r.j.ok === false && r.j.code === 'no_stock_row',
    '🔴 P18 a recipe pointing at an item that is not in stock REFUSES — it does not invent a row to put units into');
  await db.close();
}

// ── mutants: the probes must refuse a broken migration ────────────────────────────────────────
{
  const m1 = RECIPES.replace('CONSTRAINT item_recipes_one_identity CHECK ((qb_item_id IS NOT NULL) <> (inventory_id IS NOT NULL))',
    'CONSTRAINT item_recipes_one_identity CHECK (true)');
  ok(m1 !== RECIPES, 'M1 applied');
  const db = await fresh(m1);
  const slipped = !(await refuses(db, `INSERT INTO public.item_recipes (business_id, yield_quantity, yield_unit) VALUES ('${L}',1,'each')`,
    'one_identity'));
  ok(slipped, '🔴 M1 CAUGHT — without the identity CHECK a recipe with NO key is accepted, so P7b would fail');
  await db.close();
}
{
  const m2 = RECIPES.replace(`      v_unlinked := v_unlinked || jsonb_build_object('name', v_component.name,
        'quantity', v_component.quantity * p_batches, 'unit', v_component.unit);
      CONTINUE;`, '      CONTINUE;');
  ok(m2 !== RECIPES, 'M2 applied');
  const db = await fresh(m2);
  await seedSpm(db);
  await as(db, MEMBER);
  const r = await one(db, `SELECT public.record_build_run('${L}', (SELECT id FROM public.item_recipes WHERE qb_item_id='SPM1'), 1) AS j`);
  ok(r.j.components_not_stocked.length === 0,
    '🔴 M2 CAUGHT — silently skipping an unstocked component makes a partial build read as complete, so P12 would fail');
  await db.close();
}
{
  const m3 = RECIPES.replace('  IF NOT public.is_active_member(p_business_id) THEN', '  IF false THEN');
  ok(m3 !== RECIPES, 'M3 applied');
  const db = await fresh(m3);
  await seedSpm(db);
  await as(db, OUTSIDER);
  const r = await one(db, `SELECT public.record_build_run('${L}', (SELECT id FROM public.item_recipes WHERE qb_item_id='SPM1'), 1) AS j`);
  ok(r.j.ok === true, '🔴 M3 CAUGHT — without the membership test an outsider moves another business\'s stock, so P16 would fail');
  await db.close();
}

console.log(`\nrecipes-370: ${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
