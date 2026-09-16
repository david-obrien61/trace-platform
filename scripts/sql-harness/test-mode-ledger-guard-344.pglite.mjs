/**
 * -- test-mode-ledger-guard-344.pglite -- 20260916a EXECUTED against the LIVE ledger functions ----
 *
 * PURPOSE:      Every stock writer, in TEST MODE and with writes ON, on PGlite:
 *               the LIVE definitions of the ledger functions (fixtures/ledger-functions-live-
 *               2026-09-16.sql, read with the read-only PAT) + the real 20260916a migration.
 *               Each screen's call — desk qty edit, desk delete, count, count-promote, reconcile
 *               accept, order status tap on a captured order, walk-in checkout, discovery re-scan —
 *               in test mode: the row change applies, ZERO ledger rows, no error. With writes on:
 *               ledger rows are written exactly as without the guard. A direct INSERT for a
 *               test-mode business: nothing written, no error. The audit row of a desk delete is
 *               still written.
 *               RED-FIRST: `--without-guard` runs the same probes with the migration NOT applied —
 *               every test-mode probe must then FAIL (the ledger rows appear).
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR (not a repo dependency).
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is not available.
 * ⚠️ NOT in `npm run verify`. PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=/tmp/pgl/node_modules node scripts/sql-harness/test-mode-ledger-guard-344.pglite.mjs [--without-guard]
 */
import { readFileSync } from 'node:fs';

const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');
const ROOT = process.cwd() + '/';
const WITHOUT_GUARD = process.argv.includes('--without-guard');
const LIVE_FNS = readFileSync(ROOT + 'scripts/sql-harness/fixtures/ledger-functions-live-2026-09-16.sql', 'utf8');
const GUARD = readFileSync(ROOT + 'supabase/migrations/20260916a_test_mode_ledger_guard.sql', 'utf8');

const TEST = 'b0000000-0000-0000-0000-000000000001';
const LIVE = 'b0000000-0000-0000-0000-000000000002';
const ACTOR = 'a0000000-0000-0000-0000-000000000001';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function fresh() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT NULL::uuid $$;
    CREATE TABLE public.businesses (id uuid PRIMARY KEY, owner_id uuid, qbo_writes_enabled boolean NOT NULL DEFAULT false);
    INSERT INTO public.businesses VALUES ('${TEST}', '${ACTOR}', false), ('${LIVE}', '${ACTOR}', true);
    CREATE TABLE public.business_members (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      user_id uuid, name text NOT NULL DEFAULT 'x', role text NOT NULL DEFAULT 'OWNER', active boolean NOT NULL DEFAULT true);
    CREATE FUNCTION public.set_updated_at_generic() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$;
    CREATE TABLE public.business_inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES public.businesses(id),
      sku text, name text NOT NULL, description text, qty integer NOT NULL DEFAULT 0, status text NOT NULL DEFAULT 'available',
      notes text, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
      size text, variant_group text, sell_price numeric, unit_kind text, unit_value numeric, unit_value_max numeric,
      unit_name text, unit_parsed_from text, retired_at timestamptz, retired_reason text, import_run_id uuid,
      retired_by_run_id uuid, qb_item_id text, cost_confidence text, price_basis text, attributes jsonb, receipt_id uuid);
    CREATE TABLE public.business_inventory_ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
      inventory_id uuid REFERENCES public.business_inventory(id) ON DELETE SET NULL,
      delta integer NOT NULL, kind text NOT NULL, reason text, source_type text, source_id uuid, actor_user_id uuid,
      occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now(),
      aggregate_type text, aggregate_id uuid, event_type text);
    CREATE TABLE public.audit_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, actor_user_id uuid,
      actor_role text, action text NOT NULL, target_type text, target_id text, detail jsonb NOT NULL DEFAULT '{}',
      outcome text NOT NULL DEFAULT 'success', created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE public.inventory_counts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, inventory_id uuid);
    CREATE FUNCTION public.is_member_of(p_business_id uuid, p_user_id uuid) RETURNS boolean LANGUAGE sql STABLE AS
      $f$ SELECT EXISTS (SELECT 1 FROM public.businesses WHERE id = p_business_id AND owner_id = p_user_id) $f$;
  `);
  await db.exec(LIVE_FNS);
  await db.exec(`
    CREATE TRIGGER trg_inventory_ledger_immutable BEFORE DELETE OR UPDATE ON public.business_inventory_ledger
      FOR EACH ROW EXECUTE FUNCTION public.reject_inventory_ledger_mutation();
    CREATE TRIGGER business_inventory_unit_projection BEFORE INSERT OR UPDATE ON public.business_inventory
      FOR EACH ROW EXECUTE FUNCTION public.business_inventory_unit_projection_guard();
    CREATE TRIGGER business_inventory_updated_at BEFORE UPDATE ON public.business_inventory
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_generic();
  `);
  if (!WITHOUT_GUARD) await db.exec(GUARD);
  return db;
}
const one = async (db, q, p = []) => (await db.query(q, p)).rows[0];
const ledger = async (db, biz) => Number((await one(db, `SELECT count(*)::int n FROM public.business_inventory_ledger WHERE business_id = $1`, [biz])).n);
const lot = async (db, biz, name, qty) => (await one(db, `INSERT INTO public.business_inventory (business_id, name, qty) VALUES ($1, $2, $3) RETURNING id`, [biz, name, qty])).id;

// Each scenario: act → the row change that must apply, and how many ledger rows WITHOUT a guard.
const SCENARIOS = [
  { name: 'desk qty edit (adjust_inventory_manual)', ledgerRows: 1, run: async (db, biz) => {
      const id = await lot(db, biz, 'Desert Willow', 10);
      const r = await one(db, `SELECT * FROM public.adjust_inventory_manual($1, $2, 7, $3, 'desk edit')`, [id, biz, ACTOR]);
      const q = await one(db, `SELECT qty FROM public.business_inventory WHERE id = $1`, [id]);
      return r.applied === true && q.qty === 7; } },
  { name: 'desk delete (soft_delete_inventory)', ledgerRows: 1, run: async (db, biz) => {
      const id = await lot(db, biz, 'Lacey Oak', 10);
      const r = await one(db, `SELECT * FROM public.soft_delete_inventory($1, $2, $3, 'deleted from desk')`, [id, biz, ACTOR]);
      const q = await one(db, `SELECT qty, status FROM public.business_inventory WHERE id = $1`, [id]);
      const a = await one(db, `SELECT count(*)::int n FROM public.audit_log WHERE target_id = $1 AND action = 'inventory.delete'`, [String(id)]);
      return r.applied === true && q.qty === 0 && q.status === 'deleted' && a.n === 1; } },
  { name: 'count walk (count_reconcile_inventory)', ledgerRows: 1, run: async (db, biz) => {
      const id = await lot(db, biz, 'Live Oak', 10);
      const r = await one(db, `SELECT * FROM public.count_reconcile_inventory($1, $2, 12, $3)`, [id, biz, ACTOR]);
      const q = await one(db, `SELECT qty FROM public.business_inventory WHERE id = $1`, [id]);
      return r.applied === true && q.qty === 12; } },
  { name: 'count walk, new item (count_promote_create_inventory)', ledgerRows: 1, run: async (db, biz) => {
      const r = await one(db, `SELECT * FROM public.count_promote_create_inventory($1, $2, 'Found Tree', 4, '15 gallon')`, [biz, ACTOR]);
      const q = await one(db, `SELECT qty FROM public.business_inventory WHERE id = $1`, [r.inventory_id]);
      return r.applied === true && q.qty === 4; } },
  { name: 'reconcile accept (loss adjust + count)', ledgerRows: 2, run: async (db, biz) => {
      const id = await lot(db, biz, 'Cedar Elm', 10);
      const a = await one(db, `SELECT * FROM public.adjust_inventory_manual($1, $2, 8, $3, 'reconcile: dead', 'dead')`, [id, biz, ACTOR]);
      const b = await one(db, `SELECT * FROM public.count_reconcile_inventory($1, $2, 9, $3)`, [id, biz, ACTOR]);
      const q = await one(db, `SELECT qty FROM public.business_inventory WHERE id = $1`, [id]);
      return a.applied === true && b.applied === true && q.qty === 9; } },
  { name: 'order status tap on a captured order (record_order_event)', ledgerRows: 1, run: async (db, biz) => {
      const r = await one(db, `SELECT public.record_order_event($1, gen_random_uuid(), 'order_fulfilled', $2, 'from invoiced') AS id`, [biz, ACTOR]);
      return r !== undefined; } },
  { name: 'walk-in checkout (adjust_inventory_qty + three order events)', ledgerRows: 4, run: async (db, biz) => {
      const id = await lot(db, biz, 'Shumard Oak', 10);
      const r = await one(db, `SELECT * FROM public.adjust_inventory_qty($1, $2, -2, $3, 'sale', NULL, 'order', gen_random_uuid())`, [id, biz, ACTOR]);
      for (const e of ['order_created', 'order_committed', 'order_fulfilled']) {
        await db.query(`SELECT public.record_order_event($1, gen_random_uuid(), $2, $3)`, [biz, e, ACTOR]);
      }
      const q = await one(db, `SELECT qty FROM public.business_inventory WHERE id = $1`, [id]);
      return r.applied === true && q.qty === 8; } },
  { name: 'discovery re-scan (discovery_rescan_clear)', ledgerRows: 1, run: async (db, biz) => {
      const id = (await one(db, `INSERT INTO public.business_inventory (business_id, name, sku, qty) VALUES ($1, 'Disc row', 'DISC-1', 0) RETURNING id`, [biz])).id;
      const r = await one(db, `SELECT * FROM public.discovery_rescan_clear($1)`, [biz]);
      const q = await one(db, `SELECT status FROM public.business_inventory WHERE id = $1`, [id]);
      return r.cleared === 1 && q.status === 'deleted'; } },
];

for (const s of SCENARIOS) {
  // test mode
  {
    const db = await fresh();
    let applied = false, err = null;
    try { applied = await s.run(db, TEST); } catch (e) { err = String(e.message).slice(0, 120); }
    const n = await ledger(db, TEST);
    ok(err === null && applied && n === 0,
      `TEST MODE · ${s.name}: change applied=${applied}, ledger rows=${n}, error=${err ?? 'none'}`);
  }
  // writes on
  {
    const db = await fresh();
    let applied = false, err = null;
    try { applied = await s.run(db, LIVE); } catch (e) { err = String(e.message).slice(0, 120); }
    const n = await ledger(db, LIVE);
    ok(err === null && applied && n === s.ledgerRows,
      `WRITES ON · ${s.name}: change applied=${applied}, ledger rows=${n} (expected ${s.ledgerRows}), error=${err ?? 'none'}`);
  }
}

// a direct INSERT, both ways
{
  const db = await fresh();
  let err = null, got = null;
  try {
    got = (await db.query(`INSERT INTO public.business_inventory_ledger (business_id, delta, kind, source_type) VALUES ($1, 0, 'probe', 'manual') RETURNING id`, [TEST])).rows.length;
  } catch (e) { err = String(e.message).slice(0, 120); }
  ok(err === null && got === 0 && await ledger(db, TEST) === 0, `DIRECT INSERT, test mode: nothing written, no error (returned ${got}, error ${err ?? 'none'})`);
  await db.query(`INSERT INTO public.business_inventory_ledger (business_id, delta, kind, source_type) VALUES ($1, 0, 'probe', 'manual')`, [LIVE]);
  ok(await ledger(db, LIVE) === 1, 'DIRECT INSERT, writes on: written');
  // flipping the switch takes effect on the next row
  await db.exec(`UPDATE public.businesses SET qbo_writes_enabled = true WHERE id = '${TEST}'`);
  await db.query(`INSERT INTO public.business_inventory_ledger (business_id, delta, kind, source_type) VALUES ($1, 0, 'probe', 'manual')`, [TEST]);
  ok(await ledger(db, TEST) === 1, 'the moment writes go on, the same insert is written');
}

// the flag cannot be read → nothing is written (fail toward not writing)
if (!WITHOUT_GUARD) {
  const db = await fresh();
  await db.exec(`REVOKE ALL ON public.businesses FROM PUBLIC;`);
  await db.exec(`ALTER TABLE public.businesses RENAME COLUMN qbo_writes_enabled TO qbo_writes_enabled_gone;`);
  let err = null;
  try { await db.query(`INSERT INTO public.business_inventory_ledger (business_id, delta, kind, source_type) VALUES ($1, 0, 'probe', 'manual')`, [LIVE]); }
  catch (e) { err = String(e.message).slice(0, 120); }
  ok(err === null && await ledger(db, LIVE) === 0, `UNREADABLE FLAG: nothing written, no error (${err ?? 'none'})`);
}

console.log(fails ? `\n${fails} FAILED${WITHOUT_GUARD ? ' (expected: this is the red-first run WITHOUT the guard)' : ''}` : '\nALL PASS');
process.exit(fails ? 1 : 0);
