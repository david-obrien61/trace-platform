// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      EXECUTE 20260921 against real Postgres (PGlite, WASM) and prove the sharpened
//               R-165: the undo DELETES the load's history orders and their lines, and STILL
//               REFUSES on a live capture. Reading the SQL is not evidence that it runs — the
//               first draft of this migration carried a duplicated `$function$;` terminator and
//               would have failed on paste; only executing it found that.
// DEPENDENCIES: PGLITE_DIR pointing at a node_modules holding @electric-sql/pglite.
// OUTPUTS:      pass/fail per probe; exit 1 on any failure, 2 if PGlite is unavailable.
// ⚠️ NOT in `npm run verify` — PGlite is Postgres 18, Supabase runs an older major (the standing
//    reason recorded on the other harnesses in this folder).
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');

const MIG = process.cwd() + '/supabase/migrations/';
const M = f => readFileSync(MIG + f, 'utf8');
const C16_FILE = '20260916c_practice_orders_and_one_unit_undo.sql';
const C16 = existsSync(MIG + C16_FILE) ? M(C16_FILE)
  : execSync(`git show origin/fix/rehearsal-never-writes-the-record:supabase/migrations/${C16_FILE}`, { encoding: 'utf8' });
const MINE_FILE = '20260921_history_lines_qbo_item_and_undo_exempt.sql';

const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const RUN = '11111111-1111-1111-1111-111111111111';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function fresh(mineSql) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE businesses (id uuid PRIMARY KEY, qbo_writes_enabled boolean DEFAULT true);
    INSERT INTO businesses VALUES ('${L}');
    CREATE FUNCTION public.is_active_member(uuid) RETURNS boolean LANGUAGE sql AS 'select true';
    CREATE FUNCTION public.has_permission(uuid, text) RETURNS boolean LANGUAGE sql AS 'select true';
    CREATE FUNCTION public.set_updated_at_generic() RETURNS trigger LANGUAGE plpgsql AS $f$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $f$;
    CREATE TABLE customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id),
      import_run_id uuid, first_name text, phone text, email text, billing_line1 text, billing_line2 text, billing_city text,
      billing_state text, billing_zip text, address_line1 text,
      created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT '2020-01-01');
    CREATE TRIGGER customers_updated_at BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION set_updated_at_generic();
    CREATE TABLE business_inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      name text, qb_item_id text, import_run_id uuid, retired_at timestamptz, retired_reason text, retired_by_run_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT, order_kind text, import_run_id uuid);
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      quantity numeric, unit_price numeric, subtotal numeric, sku text, description text,
      business_inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL);
    CREATE TABLE order_compliance_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id));
    CREATE TABLE order_service_selections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id));
    CREATE TABLE deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, order_id uuid REFERENCES orders(id) ON DELETE SET NULL);
    CREATE TABLE business_inventory_ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid,
      inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL);
  `);
  await db.exec(M('20260911b_customer_addresses.sql'));
  await db.exec(C16);
  await db.exec(M('20260915_contact_record.sql'));
  await db.exec(M('20260916d_contact_rows_leave_with_their_run.sql'));
  await db.exec(M('20260917b_undo_takes_test_mode_edits.sql'));
  let err = null;
  try { await db.exec(mineSql); } catch (e) { err = String(e.message).slice(0, 200); await db.exec('ROLLBACK').catch(() => {}); }
  return { db, err };
}
const one = async (db, q) => Object.values((await db.query(q)).rows[0])[0];
const n = async (db, q) => Number(await one(db, q));
const undo = async (db, run = RUN) => await one(db, `SELECT public.undo_import_run('${L}','${run}')`);

// A customer belonging to the load, so the undo has something to try to delete.
const seedCustomer = async db => await one(db,
  `INSERT INTO customers (business_id, import_run_id, first_name) VALUES ('${L}','${RUN}','Load') RETURNING id`);

console.log('\n── 20260921 · the load\'s history leaves with it ──────────────────────────────\n');

// ── A · IT RUNS AT ALL. The duplicated terminator the first draft carried dies here.
{ const { err } = await fresh(M(MINE_FILE));
  ok(err === null, 'A1 the migration EXECUTES on real Postgres ' + (err ?? '')); }

// ── B · THE COLUMN
{ const { db } = await fresh(M(MINE_FILE));
  ok(await one(db, `select data_type from information_schema.columns where table_name='order_items' and column_name='qbo_item_id'`) === 'text',
     'B1 order_items.qbo_item_id exists and is text');
  ok(await one(db, `select is_nullable from information_schema.columns where table_name='order_items' and column_name='qbo_item_id'`) === 'YES',
     'B2 nullable — an OCR line has no QuickBooks id and NULL is the honest value');
  ok(await one(db, `select column_default is null from information_schema.columns where table_name='order_items' and column_name='qbo_item_id'`) === true,
     'B3 no default — a default would assert a fact about rows this migration never read (A9)');
  ok(await n(db, `select count(*) from pg_indexes where indexname='order_items_qbo_item_idx'`) === 1,
     'B4 the partial index exists'); }

// ── C · THE UNDO DELETES THE LOAD'S HISTORY, AND KEEPS EVERY LIVE CAPTURE
{ const { db } = await fresh(M(MINE_FILE));
  const c = await seedCustomer(db);
  const hist = await one(db, `INSERT INTO orders (business_id, customer_id, order_kind, import_run_id)
                              VALUES ('${L}','${c}','history','${RUN}') RETURNING id`);
  await db.exec(`INSERT INTO order_items (order_id, quantity, unit_price, subtotal, qbo_item_id)
                 VALUES ('${hist}', 3, 100, 300, '99');`);
  // A LIVE CAPTURE on its own customer — it must not make the undo refuse, and must survive it.
  const ocr = await one(db, `INSERT INTO orders (business_id, order_kind, import_run_id)
                             VALUES ('${L}','history',NULL) RETURNING id`);

  const res = await undo(db);
  ok(res.refused === false, 'C1 the undo did NOT refuse — the load\'s history is deleted, not blocking');
  ok(Number(res.history_orders_deleted) === 1, `C2 it reports history_orders_deleted = 1 (got ${res.history_orders_deleted})`);
  ok(Number(res.history_lines_deleted) === 1, `C3 and history_lines_deleted = 1 (got ${res.history_lines_deleted})`);
  ok(await n(db, `select count(*) from orders where id='${hist}'`) === 0,
     'C4 🔴 THE LOAD\'S HISTORY ORDER IS GONE — the claim the previous draft never made');
  ok(await n(db, `select count(*) from order_items where order_id='${hist}'`) === 0, 'C5 and its lines with it');
  ok(await n(db, `select count(*) from orders where id='${ocr}'`) === 1,
     'C6 🔴 THE OCR CAPTURE SURVIVED — R-160: only live captures are never removed');
  ok(await n(db, `select count(*) from customers where id='${c}'`) === 0,
     'C7 and the customer it pointed at was deleted, which RESTRICT would have blocked'); }

// ── D · IT STILL REFUSES ON A LIVE CAPTURE THAT SITS ON A LOAD CUSTOMER
{ const { db } = await fresh(M(MINE_FILE));
  const c = await seedCustomer(db);
  await db.exec(`INSERT INTO orders (business_id, customer_id, order_kind, import_run_id)
                 VALUES ('${L}','${c}','history',NULL);`);           // an OCR capture
  const res = await undo(db);
  ok(res.refused === true, 'D1 🔴 REFUSES on an OCR capture — the 25 rows R-160 protects');
  ok(Number(res.live_orders) === 1, `D2 and it NAMES it in live_orders (got ${res.live_orders})`);
  ok(await n(db, `select count(*) from customers where id='${c}'`) === 1, 'D3 nothing was deleted'); }

// ── E · AND ON A GENUINE LIVE ORDER (the second probe R-165's guard cell owes)
{ const { db } = await fresh(M(MINE_FILE));
  const c = await seedCustomer(db);
  await db.exec(`INSERT INTO orders (business_id, customer_id, order_kind, import_run_id)
                 VALUES ('${L}','${c}',NULL,NULL);`);                // a real checkout sale
  const res = await undo(db);
  ok(res.refused === true, 'E1 REFUSES on a live checkout order — the exemption is not a blanket'); }

// ── F · 🔴 THE MUTANT. `=` instead of `IS NOT DISTINCT FROM` reads identically and silently stops
//        the undo refusing on every OCR capture, because NULL = <run> is NULL, not false.
{ const mutant = M(MINE_FILE).replace(
    "AND NOT (o.order_kind IS NOT DISTINCT FROM 'history' AND o.import_run_id IS NOT DISTINCT FROM p_run_id);",
    "AND NOT (o.order_kind = 'history' AND o.import_run_id = p_run_id);");
  ok(mutant !== M(MINE_FILE), 'F0 the mutant actually changed the file — the probe can reach its target (#182)');
  const { db } = await fresh(mutant);
  const c = await seedCustomer(db);
  const ocr = await one(db, `INSERT INTO orders (business_id, customer_id, order_kind, import_run_id)
                             VALUES ('${L}','${c}','history',NULL) RETURNING id`);
  let refused = null, threw = null;
  try { refused = (await undo(db)).refused; } catch (e) { threw = String(e.message).slice(0, 120); }
  ok(refused === false || threw !== null,
     `F1 🔴 UNDER THE MUTANT THE PROTECTION IS GONE — refused=${refused} threw=${threw ?? 'no'}`);
  ok(!(refused === true), 'F2 so D1 is a real assertion: it FAILS when the null-safe form is removed'); }

console.log(`\nPGlite: ${fails === 0 ? 'ALL PASS' : fails + ' FAILED'}`);
process.exit(fails ? 1 : 0);
