/**
 * -- recipes-survive-wipe-370.pglite -- DO RECIPES SURVIVE THE WIPE? ------------------------------
 *
 * PURPOSE:      David's ruling (2026-09-21) is that recipes are CONFIG and survive a catalogue wipe,
 *               while the wipe removes everything the load created. This probes that claim against
 *               THE REAL `undo_import_run` — its definition is pulled from the live database
 *               (scripts/sql-harness/fixtures/undo_import_run.live.sql) and executed here, so the
 *               answer is the function's own behaviour and not a lookalike of it.
 *               W1–W3 a recipe keyed on qb_item_id with components linked the same way: the undo
 *               COMPLETES, the products go, the recipe stays · W4–W5 after a re-import with new row
 *               ids and the same qb_item_ids, the recipe re-links and a build run works again ·
 *               W6 a component linked by ROW ID blocks the undo, and the refusal NAMES the table ·
 *               W7 a BUILD RUN's ledger rows block the undo (`held_lots`) — the collision that
 *               matters, reported rather than worked around.
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR · the live function text in fixtures/, RE-PULLED
 *               2026-09-21 after HISTORY applied 20260921b (the capture re-link) — the probe answers
 *               for the function as it is TODAY, not as it was when this file was written.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is missing.
 * ⚠️ NOT in `npm run verify` — PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=node_modules node scripts/sql-harness/recipes-survive-wipe-370.pglite.mjs
 */
import { readFileSync } from 'node:fs';
const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(process.cwd() + '/' + pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');

const ROOT = process.cwd() + '/';
const RECIPES = readFileSync(ROOT + 'supabase/migrations/20260921_recipes_made_items.sql', 'utf8');
const UNDO = readFileSync(ROOT + 'scripts/sql-harness/fixtures/undo_import_run.live.sql', 'utf8');
const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const MEMBER = '11111111-1111-1111-1111-111111111111';
const RUN1 = 'aaaaaaaa-0000-4000-8000-000000000001';
const RUN2 = 'aaaaaaaa-0000-4000-8000-000000000002';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
const one = async (db, q) => (await db.query(q)).rows[0];

/**
 * The surrounding schema the real function touches — columns and FK ACTIONS copied from the live
 * catalog 2026-09-21, because the function reads `pg_constraint` itself and a wrong action here
 * would make the probe answer a different question than the database will.
 */
async function fresh() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $f$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $f$;
    CREATE TABLE public.businesses (id uuid PRIMARY KEY, name text NOT NULL, qbo_writes_enabled boolean DEFAULT true);
    CREATE TABLE public.business_members (business_id uuid, user_id uuid, active boolean);
    CREATE FUNCTION public.is_active_member(p uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path='' AS
      $f$ SELECT EXISTS (SELECT 1 FROM public.business_members WHERE business_id=p AND user_id=auth.uid() AND active) $f$;
    CREATE FUNCTION public.has_permission(uuid, text) RETURNS boolean LANGUAGE sql AS 'select true';
    CREATE TABLE public.business_operations_config (business_id uuid PRIMARY KEY, config jsonb NOT NULL DEFAULT '{}');
    CREATE TABLE public.vendors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, name text);
    CREATE TABLE public.receipts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, vendor text, amount numeric);

    CREATE TABLE public.business_inventory (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, name text NOT NULL,
      size text, qty numeric DEFAULT 0, sell_price numeric, qb_item_id text, retired_at timestamptz,
      import_run_id uuid, retired_by_run_id uuid, retired_reason text, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.business_inventory_ledger (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, inventory_id uuid REFERENCES public.business_inventory(id) ON DELETE SET NULL,
      delta numeric, kind text, reason text, source_type text, source_id uuid, actor_user_id uuid,
      occurred_at timestamptz DEFAULT now(), created_at timestamptz DEFAULT now());
    -- the append-only trigger, as 20260720 defines it: the ledger refuses UPDATE and DELETE
    CREATE FUNCTION public.reject_inventory_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS
      $f$ BEGIN RAISE EXCEPTION 'business_inventory_ledger is append-only'; END; $f$;
    CREATE TRIGGER trg_inventory_ledger_immutable BEFORE DELETE OR UPDATE ON public.business_inventory_ledger
      FOR EACH ROW EXECUTE FUNCTION public.reject_inventory_ledger_mutation();

    CREATE TABLE public.customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, first_name text,
      last_name text, import_run_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE public.customer_addresses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT, business_id uuid, import_run_id uuid, line1 text);
    CREATE TABLE public.customer_emails (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE, business_id uuid, import_run_id uuid, email text);
    CREATE TABLE public.customer_phones (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE, business_id uuid, import_run_id uuid, phone text);
    CREATE TABLE public.orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid,
      customer_id uuid REFERENCES public.customers(id) ON DELETE RESTRICT, order_kind text, import_run_id uuid,
      -- added by HISTORY's 20260921b (capture re-link, ledger #372): the undo now unlinks captures first
      relinked_from_customer_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE public.order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE,
      business_inventory_id uuid REFERENCES public.business_inventory(id) ON DELETE SET NULL, quantity int);
    CREATE TABLE public.order_compliance_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE);
    CREATE TABLE public.order_service_selections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      order_id uuid REFERENCES public.orders(id) ON DELETE CASCADE);
    CREATE TABLE public.deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid,
      order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
      customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL, import_run_id uuid, status text);

    INSERT INTO public.businesses VALUES ('${L}', 'LAWNS Tree Farm, LLC', true);
    INSERT INTO public.business_members VALUES ('${L}', '${MEMBER}', true);
  `);
  await db.exec(RECIPES);
  await db.exec(UNDO);
  await db.exec(`SELECT set_config('request.jwt.claim.sub', '${MEMBER}', false)`);
  return db;
}

/** One catalogue load: three products, each with a stable QuickBooks id. */
async function load(db, runId) {
  await db.exec(`
    INSERT INTO public.business_inventory (business_id, name, qty, qb_item_id, import_run_id) VALUES
      ('${L}', 'Special Planting Mix', 0,   'SPM1',  '${runId}'),
      ('${L}', 'Shook Out Brown',      100, 'BARK1', '${runId}'),
      ('${L}', 'Osmocote 21-4-8',      200, 'OSMO1', '${runId}');
  `);
}

/** The recipe, keyed the way the migration intends: everything by qb_item_id. */
async function recipeByQbId(db) {
  await db.exec(`
    INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit, build_minutes)
      VALUES ('${L}', 'SPM1', 2.5, 'yd', 38);
    INSERT INTO public.recipe_components (recipe_id, position, name, quantity, unit, component_qb_item_id)
      SELECT r.id, v.pos, v.nm, v.q, v.u, v.qb FROM public.item_recipes r,
        (VALUES (1,'Shook Out Brown',2.0,'yd','BARK1'), (2,'Osmocote 21-4-8',25,'lb','OSMO1'),
                (3,'12-24-12',2,'lb',NULL)) AS v(pos,nm,q,u,qb)
       WHERE r.qb_item_id='SPM1';
    INSERT INTO public.component_purchase_links (business_id, component_id, document_key, line_unit_price, pack_size, pack_unit, purchased_on)
      SELECT '${L}', c.id, 'bwi|2026-09-02|647.79', 68.24, 50, 'lb', DATE '2026-09-02'
        FROM public.recipe_components c WHERE c.name='Osmocote 21-4-8';
  `);
}

// ══ W1–W3 — THE WIPE RUNS, THE PRODUCTS GO, THE RECIPE STAYS ══════════════════════════════════
{
  const db = await fresh();
  await load(db, RUN1);
  await recipeByQbId(db);
  const before = await one(db, `SELECT (SELECT count(*)::int FROM public.business_inventory) inv,
    (SELECT count(*)::int FROM public.item_recipes) rec, (SELECT count(*)::int FROM public.recipe_components) comp,
    (SELECT count(*)::int FROM public.component_purchase_links) links`);
  ok(before.inv === 3 && before.rec === 1 && before.comp === 3 && before.links === 1, 'W0 the load and the recipe are in place');

  const undo = await one(db, `SELECT public.undo_import_run('${L}', '${RUN1}') AS j`);
  ok(undo.j.refused !== true, `🔴 W1 the undo COMPLETES with a recipe in place (got ${JSON.stringify(undo.j).slice(0, 180)})`);
  const after = await one(db, `SELECT (SELECT count(*)::int FROM public.business_inventory) inv,
    (SELECT count(*)::int FROM public.item_recipes) rec, (SELECT count(*)::int FROM public.recipe_components) comp,
    (SELECT count(*)::int FROM public.component_purchase_links) links`);
  ok(after.inv === 0, `🔴 W2 the wipe removed everything the load created (products left: ${after.inv})`);
  ok(after.rec === 1 && after.comp === 3 && after.links === 1,
    `🔴 W3 …and the recipe, its components and the confirmed match SURVIVED (${after.rec}/${after.comp}/${after.links})`);

  // ── W4–W5 — a re-import with NEW row ids and the SAME QuickBooks ids ──────────────────────
  await load(db, RUN2);
  const relink = await one(db, `SELECT count(*)::int n FROM public.recipe_components c
     JOIN public.business_inventory bi ON bi.qb_item_id = c.component_qb_item_id AND bi.business_id='${L}'
    WHERE c.component_qb_item_id IS NOT NULL`);
  ok(relink.n === 2, `🔴 W4 after the re-import both linked components find their product again by qb_item_id (got ${relink.n})`);
  const build = await one(db, `SELECT public.record_build_run('${L}',
    (SELECT id FROM public.item_recipes WHERE qb_item_id='SPM1'), 1) AS j`);
  ok(build.j.ok === true && Number(build.j.made) === 2.5 && Number(build.j.components_moved) === 2,
    `🔴 W5 …and a build run works against the NEW rows — 2.5 yd made, two components moved (got ${JSON.stringify(build.j).slice(0, 140)})`);
  await db.close();
}

// ══ W6 — A COMPONENT LINKED BY ROW ID BLOCKS THE WIPE, AND THE REFUSAL NAMES IT ═══════════════
{
  const db = await fresh();
  await load(db, RUN1);
  // 🔴 THE GUARD (§5b) now REFUSES this link outright — W8 proves that. So to prove the OTHER half,
  // that the undo itself would refuse such a row, the trigger is switched off to create a row of the
  // shape that could exist from BEFORE the guard. Stated, not smuggled: this is deliberately making
  // the world worse than the migration allows, to show what the function does about it.
  await db.exec(`
    INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit)
      VALUES ('${L}', 'SPM1', 2.5, 'yd');
    ALTER TABLE public.recipe_components DISABLE TRIGGER trg_recipe_components_link_survives;
    INSERT INTO public.recipe_components (recipe_id, name, quantity, unit, component_inventory_id)
      SELECT r.id, 'Shook Out Brown', 2, 'yd', (SELECT id FROM public.business_inventory WHERE qb_item_id='BARK1')
        FROM public.item_recipes r WHERE r.qb_item_id='SPM1';
    ALTER TABLE public.recipe_components ENABLE TRIGGER trg_recipe_components_link_survives;
  `);
  const undo = await one(db, `SELECT public.undo_import_run('${L}', '${RUN1}') AS j`);
  ok(undo.j.refused === true, '🔴 W6 a component linked by ROW ID (one predating the guard) refuses the wipe — the FK is counted by the function itself');
  ok(JSON.stringify(undo.j.other_references ?? {}).includes('recipe_components.component_inventory_id'),
    `🔴 W6b …and the refusal NAMES the table and column, so nobody has to guess (got ${JSON.stringify(undo.j.other_references)})`);
  await db.close();
}

// ══ W7 — A BUILD RUN'S LEDGER ROWS BLOCK THE WIPE. THE REAL COLLISION. ════════════════════════
{
  const db = await fresh();
  await load(db, RUN1);
  await recipeByQbId(db);
  const build = await one(db, `SELECT public.record_build_run('${L}',
    (SELECT id FROM public.item_recipes WHERE qb_item_id='SPM1'), 1) AS j`);
  ok(build.j.ok === true, 'W7a a batch is built against the loaded products');
  const undo = await one(db, `SELECT public.undo_import_run('${L}', '${RUN1}') AS j`);
  ok(undo.j.refused === true && Number(undo.j.held_lots) === 3,
    `🔴 W7 ONCE A BATCH IS BUILT THE WIPE REFUSES — three products now hold ledger history (got held_lots=${undo.j.held_lots})`);
  ok(Number(undo.j.held_lots) > 0 && (undo.j.other_references === null || Object.keys(undo.j.other_references ?? {}).length === 0),
    'W7b …and it is the LEDGER that holds them, not the recipe tables — the recipe is not what blocks it');
  await db.close();
}

// ══ W8 — THE GUARD: THE LINK THAT WOULD BLOCK THE WIPE CANNOT BE MADE AT ALL ═════════════════
{
  const db = await fresh();
  await load(db, RUN1);
  // A row this platform owns — the bubbler's case: no import run, so the wipe never touches it.
  await db.exec(`INSERT INTO public.business_inventory (business_id, name, qty, qb_item_id) VALUES ('${L}','Bubbler',0,NULL)`);
  await db.exec(`INSERT INTO public.item_recipes (business_id, qb_item_id, yield_quantity, yield_unit) VALUES ('${L}','SPM1',2.5,'yd')`);
  let refused = false;
  try {
    await db.exec(`INSERT INTO public.recipe_components (recipe_id, name, quantity, unit, component_inventory_id)
      SELECT r.id, 'Shook Out Brown', 2, 'yd', (SELECT id FROM public.business_inventory WHERE qb_item_id='BARK1')
        FROM public.item_recipes r WHERE r.qb_item_id='SPM1'`);
  } catch (e) { refused = /must_survive_a_wipe/.test(String(e.message)); }
  ok(refused, '🔴 W8 linking a component by ROW ID to an IMPORTED product is REFUSED — the wipe-blocker cannot be created');

  let allowed = true;
  try {
    await db.exec(`INSERT INTO public.recipe_components (recipe_id, name, quantity, unit, component_inventory_id)
      SELECT r.id, 'Bubbler body', 1, 'each', (SELECT id FROM public.business_inventory WHERE name='Bubbler')
        FROM public.item_recipes r WHERE r.qb_item_id='SPM1'`);
  } catch { allowed = false; }
  ok(allowed, '🔴 W8b …while a row THIS PLATFORM owns (no import run — the bubbler) may still be linked by id');
  const undo = await one(db, `SELECT public.undo_import_run('${L}', '${RUN1}') AS j`);
  ok(undo.j.refused !== true, 'W8c and with only that link in place, the wipe still runs');
  await db.close();
}

console.log(`\nrecipes-survive-wipe-370: ${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
