/**
 * -- contact-run-undo-335.pglite -- 20260916d EXECUTED, not shape-checked ------------------------
 *
 * PURPOSE:      the REAL 20260911b + 20260916c + 20260915_contact_record + 20260916d run on PGlite with
 *               synthetic rows: D1 refuses before 20260916c · D2–D6 the backfill tags exactly the run
 *               customers' rows, leaves customers.updated_at alone and re-enables the sync triggers ·
 *               D7–D9 the undo removes a run's customers, their tagged contact rows and its practice
 *               order, and nothing of another run or a hand-made customer · D10–D12 a hand-added phone
 *               or ship-to site on a run customer REFUSES and writes nothing · M1–M3 mutants: drop the
 *               address delete (RESTRICT fails, whole undo rolls back) · drop the loop exclusion
 *               (every run refuses) · drop the live-contact term (a hand-added phone is taken).
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR (NOT a repo dependency — same convention as
 *               rehearsal-342.pglite.mjs). 20260916c is read from the tree, or from
 *               origin/fix/rehearsal-never-writes-the-record until ledger #342 merges.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is not available.
 * ⚠️ NOT in `npm run verify`. PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=/tmp/pgl/node_modules node scripts/sql-harness/contact-run-undo-335.pglite.mjs
 */
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
const D16 = M('20260916d_contact_rows_leave_with_their_run.sql');
const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74', RUN = '11111111-1111-1111-1111-111111111111', RUN2 = '33333333-3333-3333-3333-333333333333';
let fails = 0; const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };
async function fresh({ with16c = true, d16 = D16 } = {}) {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE businesses (id uuid PRIMARY KEY);
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
      name text, import_run_id uuid, retired_at timestamptz, retired_reason text, retired_by_run_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT, order_kind text);
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id),
      business_inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL);
    CREATE TABLE order_compliance_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id));
    CREATE TABLE order_service_selections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id));
    CREATE TABLE deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, order_id uuid REFERENCES orders(id) ON DELETE SET NULL);
    CREATE TABLE business_inventory_ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid,
      inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL);
  `);
  await db.exec(M('20260911b_customer_addresses.sql'));
  if (with16c) await db.exec(C16);
  // customers: run customer A (phone+email+billing), run customer B (phone only), run2 customer, hand-made customer
  await db.exec(`
    INSERT INTO customers (id, business_id, import_run_id, phone, email, billing_line1, billing_city) VALUES
      ('c0000000-0000-0000-0000-00000000000a','${L}','${RUN}','(512) 555-0001','a@x.invalid','1 A St','Leander'),
      ('c0000000-0000-0000-0000-00000000000b','${L}','${RUN}','(512) 555-0002',NULL,NULL,NULL),
      ('c0000000-0000-0000-0000-00000000000c','${L}','${RUN2}','(512) 555-0003','c@x.invalid','3 C St','Austin'),
      ('c0000000-0000-0000-0000-00000000000d','${L}',NULL,'(512) 555-0004','d@x.invalid','4 D St','Cedar Park');
    INSERT INTO business_inventory (business_id, name, import_run_id) VALUES ('${L}','lot','${RUN}');
  `);
  if (with16c) await db.exec(`INSERT INTO orders (id, business_id, customer_id, order_kind, import_run_id) VALUES
      ('b0000000-0000-0000-0000-000000000001','${L}','c0000000-0000-0000-0000-00000000000a','test','${RUN}');`);
  await db.exec(M('20260915_contact_record.sql'));
  let err = null;
  try { await db.exec(d16); } catch (e) { err = String(e.message).slice(0, 160); await db.exec('ROLLBACK').catch(() => {}); }
  return { db, err };
}
const one = async (db, q) => Object.values((await db.query(q)).rows[0])[0];
const n = async (db, q) => Number(await one(db, q));
const undo = async (db, run = RUN) => await one(db, `SELECT public.undo_import_run('${L}','${run}')`);

{ const { err } = await fresh({ with16c: false }); ok(/apply 20260916c/.test(err ?? ''), 'D1 refuses before 20260916c: ' + err); }

{ const { db, err } = await fresh();
  ok(err === null, 'D2 applies after 20260916c + 20260915_contact_record ' + (err ?? ''));
  ok(await n(db, `select count(*) from customer_phones where import_run_id is null and customer_id <> 'c0000000-0000-0000-0000-00000000000d'`) === 0
    && await n(db, `select count(*) from customer_addresses where import_run_id is not null`) === 2, 'D3 seeded rows tagged from their customer (2 run addresses)');
  ok(await n(db, `select (count(*) filter (where import_run_id is not null))::int from customer_emails where customer_id='c0000000-0000-0000-0000-00000000000d'`) === 0, 'D4 the hand-made customer\'s rows stay untagged');
  ok(await n(db, `select count(*) from customers where updated_at <> '2020-01-01'`) === 0, 'D5 the backfill did not touch customers.updated_at');
  ok(await n(db, `select count(*) from pg_trigger where tgname like 'trg_customer_%_sync' and tgenabled='O'`) === 3, 'D6 sync triggers re-enabled');
  await db.exec(`select 1`);
  const r = await undo(db);
  ok(r.refused === false && r.customers_deleted === 2 && r.contact_rows_deleted === 4 && r.practice_orders_deleted === 1,
     'D7 undo removes the run\'s 2 customers, their 4 contact rows (A: phone, email, address · B: phone) and the practice order: ' + JSON.stringify(r));
  ok(await n(db, `select count(*) from customers`) === 2 && await n(db, `select count(*) from customer_phones`) === 2
     && await n(db, `select count(*) from customer_addresses`) === 2, 'D8 run2 customer and hand-made customer keep every row');
  ok(await one(db, `select phone from customers where id='c0000000-0000-0000-0000-00000000000c'`) === '(512) 555-0003', 'D9 survivors\' derived phone intact');
}

{ const { db } = await fresh();
  await db.exec(`INSERT INTO customer_phones (business_id, customer_id, label, value, source) VALUES ('${L}','c0000000-0000-0000-0000-00000000000b','mobile','(512) 555-0099','manual')`);
  const r = await undo(db);
  ok(r.refused === true && r.live_contact_rows === 1, 'D10 a hand-added phone on a run customer refuses: ' + JSON.stringify(r));
  ok(await n(db, `select count(*) from customers`) === 4 && await n(db, `select count(*) from orders`) === 1, 'D11 … and nothing was written');
}
{ const { db } = await fresh();
  await db.exec(`INSERT INTO customer_addresses (business_id, customer_id, label, line1) VALUES ('${L}','c0000000-0000-0000-0000-00000000000a','Job site','9 Site Rd')`);
  const r = await undo(db);
  ok(r.refused === true && r.live_contact_rows === 1, 'D12 a hand-saved ship-to site on a run customer refuses');
}
// MUTANTS — each must turn a probe red
{ const mut = D16.replace(/  WITH d AS \(DELETE FROM public\.customer_addresses[\s\S]*?INTO v_contacts FROM d;\n/, '');
  if (mut === D16) throw new Error('M1 did not apply');
  const { db } = await fresh({ d16: mut }); let e = null; try { await undo(db); } catch (x) { e = String(x.message).slice(0, 100); }
  ok(/foreign key|violates/.test(e ?? ''), 'M1 CAUGHT — without the address delete the undo fails on RESTRICT: ' + e);
  ok(await n(db, `select count(*) from customer_phones`) === 4, 'M1 … and rolled back whole');
}
{ const mut = D16.replace(/,\n\s*-- #335: counted above, by run tag, and removed below\n[^\n]*\n[^\n]*'public\.customer_addresses'::regclass\)/, ')');
  if (mut === D16) throw new Error('M2 did not apply');
  const { db } = await fresh({ d16: mut }); const r = await undo(db);
  ok(r.refused === true, 'M2 CAUGHT — without the loop exclusion every run refuses: ' + JSON.stringify(r.other_references));
}
{ const mut = D16.replace('+ v_live_contacts ', '');
  const { db } = await fresh({ d16: mut });
  await db.exec(`INSERT INTO customer_phones (business_id, customer_id, label, value, source) VALUES ('${L}','c0000000-0000-0000-0000-00000000000b','mobile','(512) 555-0099','manual')`);
  let r = null, e = null; try { r = await undo(db); } catch (x) { e = x.message; }
  ok(r?.refused !== true, 'M3 CAUGHT — without the live-contact term a hand-added phone is taken silently (D10 would go red): ' + JSON.stringify(r));
}
console.log(fails ? `${fails} FAILED` : 'ALL PASS'); process.exit(fails ? 1 : 0);
