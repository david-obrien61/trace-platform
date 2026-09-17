/**
 * -- lawns-test-mode-removal-335.pglite -- 20260916e EXECUTED on a LAWNS-shaped copy ---------------
 *
 * PURPOSE:      The targeted removal of LAWNS's test-mode ledger rows, run on PGlite against a fixture
 *               carrying the EXACT ids measured live on 2026-09-16 (synthetic everything else), with
 *               the real 20260916a guard, the real 20260916c undo and the real 20260916e file.
 *               R1 (red-first): before 20260916e, undo_import_run REFUSES run eab7fbd2.
 *               R2–R9: 20260916e removes exactly 5 ledger rows, the practice order and its children,
 *               restores Desert Willow to 10, leaves Lacey Oak deleted and its audit row in place.
 *               R10: after it, undo_import_run for eab7fbd2 has zero blockers and runs.
 *               P1–P12: every precondition that differs REFUSES and changes nothing.
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR (not a repo dependency). 20260916a is read from the
 *               tree or from origin/fix/test-mode-ledger-guard until ledger #344 merges.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure, 2 if PGlite is not available.
 * ⚠️ NOT in `npm run verify`. PGlite is Postgres 18; Supabase runs an older major.
 *
 * Run: PGLITE_DIR=/tmp/pgl/node_modules node scripts/sql-harness/lawns-test-mode-removal-335.pglite.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');
const MIG = process.cwd() + '/supabase/migrations/';
const read = (f, branch) => existsSync(MIG + f) ? readFileSync(MIG + f, 'utf8')
  : execSync(`git show ${branch}:supabase/migrations/${f}`, { encoding: 'utf8' });
const GUARD = read('20260916a_test_mode_ledger_guard.sql', 'origin/fix/test-mode-ledger-guard');
const C16 = read('20260916c_practice_orders_and_one_unit_undo.sql', 'HEAD');
const E16 = read('20260916e_remove_lawns_test_mode_ledger_rows.sql', 'HEAD');

const L = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const LAUREN = '790b31d2-7b65-45ec-953f-79855453a73e';
const OTHER_USER = '11111111-2222-3333-4444-555555555555';
const RUN = 'eab7fbd2-04cd-45e5-b771-cbb07f662f6f';
const ORDER = '6a60a0ca-dedf-4c1d-a58c-804bf1e64c79';
const WILLOW = '3406972d-84b9-4454-b5bb-777a2169db0f';
const LACEY = 'dc178b31-4daf-46fa-8232-529be1b7786d';
const LINE = 'b8613d5a-3171-4b09-b434-438ef8111c80';
const TOMB = 'cb806bbe-8f60-4a1d-9123-315f9ed76a0c';
const CUST = 'c0000000-0000-0000-0000-00000000b15b';
const FILLER_LOT = 'f0000000-0000-0000-0000-000000000001';
let fails = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); if (!c) fails++; };

async function fresh({ with16c = true, fixture = {} } = {}) {
  const f = { orderKind: 'test', orderActor: LAUREN, willowQty: 8, tombDelta: -10, writes: false, fillers: 465,
    extraLaceyRow: false, extraTestRowAfter2000: false, laceyCounted: false, stopOnOrder: false, ...fixture };
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    INSERT INTO auth.users VALUES ('${LAUREN}', 'lauren@lawnstrees.com'), ('${OTHER_USER}', 'someone@example.com');
    CREATE TABLE businesses (id uuid PRIMARY KEY, qbo_writes_enabled boolean NOT NULL DEFAULT false);
    INSERT INTO businesses VALUES ('${L}', ${f.writes});
    CREATE TABLE customers (id uuid PRIMARY KEY, business_id uuid NOT NULL REFERENCES businesses(id), import_run_id uuid, first_name text);
    CREATE TABLE business_inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, name text, qty int NOT NULL DEFAULT 0,
      status text NOT NULL DEFAULT 'available', import_run_id uuid, retired_at timestamptz, retired_reason text, retired_by_run_id uuid);
    CREATE TABLE orders (id uuid PRIMARY KEY, business_id uuid NOT NULL, customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT,
      order_kind text, status text, created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      business_inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL, quantity int);
    CREATE TABLE order_compliance_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id) ON DELETE CASCADE);
    CREATE TABLE order_service_selections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id) ON DELETE CASCADE);
    CREATE TABLE order_addons (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id) ON DELETE CASCADE);
    CREATE TABLE deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL,
      customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, order_id uuid REFERENCES orders(id) ON DELETE SET NULL);
    CREATE TABLE inventory_counts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid, inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL);
    CREATE TABLE cultivar_plants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL);
    CREATE TABLE audit_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, actor_user_id uuid, actor_role text,
      action text NOT NULL, target_type text, target_id text, detail jsonb NOT NULL DEFAULT '{}', outcome text NOT NULL DEFAULT 'success',
      created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE business_inventory_ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      business_id uuid NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
      inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL,
      delta int NOT NULL, kind text NOT NULL, reason text, source_type text, source_id uuid, actor_user_id uuid,
      occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
    CREATE FUNCTION reject_inventory_ledger_mutation() RETURNS trigger LANGUAGE plpgsql AS $f$
      BEGIN RAISE EXCEPTION 'business_inventory_ledger is append-only: % is not permitted.', TG_OP; END; $f$;
    CREATE TRIGGER trg_inventory_ledger_immutable BEFORE DELETE OR UPDATE ON business_inventory_ledger
      FOR EACH ROW EXECUTE FUNCTION reject_inventory_ledger_mutation();
  `);
  if (with16c) await db.exec(C16);
  await db.exec(`
    INSERT INTO customers VALUES ('${CUST}', '${L}', '${RUN}', 'Lauren Bishop');
    INSERT INTO business_inventory (id, business_id, name, qty, status, import_run_id) VALUES
      ('${WILLOW}', '${L}', 'Desert Willow', ${f.willowQty}, 'available', '${RUN}'),
      ('${LACEY}', '${L}', 'Lacey Oak', 0, 'deleted', '${RUN}'),
      ('${FILLER_LOT}', '${L}', 'Hand-made lot', 5, 'available', NULL);
    INSERT INTO orders (id, business_id, customer_id, order_kind, status, created_at) VALUES
      ('${ORDER}', '${L}', '${CUST}', '${f.orderKind}', 'fulfilled', '2026-09-09 20:26:28.615142+00');
    INSERT INTO order_items (id, order_id, business_inventory_id, quantity) VALUES ('${LINE}', '${ORDER}', '${WILLOW}', 2);
    INSERT INTO order_service_selections (order_id) VALUES ('${ORDER}'), ('${ORDER}');
    INSERT INTO business_inventory_ledger (id, business_id, inventory_id, delta, kind, reason, source_type, source_id, actor_user_id, created_at) VALUES
      ('3e6c5800-5897-4868-83dc-b08f23fdfa38', '${L}', '${WILLOW}', -2, 'sale', NULL, 'order', '${ORDER}', '${f.orderActor}', '2026-09-09 20:26:28.751032+00'),
      ('d996c0a9-3460-4095-837e-cd845aefa0b5', '${L}', NULL, 0, 'order_created', 'checkout', 'order', '${ORDER}', '${f.orderActor}', '2026-09-09 20:26:28.827489+00'),
      ('5d87dad9-459d-4dfa-b5bb-9328500bfcee', '${L}', NULL, 0, 'order_committed', 'walk-in', 'order', '${ORDER}', '${f.orderActor}', '2026-09-09 20:26:28.855287+00'),
      ('45b9de2a-fb19-4f69-82db-b23702831aeb', '${L}', NULL, 0, 'order_fulfilled', 'walk-in', 'order', '${ORDER}', '${f.orderActor}', '2026-09-09 20:26:28.893833+00'),
      ('${TOMB}', '${L}', '${LACEY}', ${f.tombDelta}, 'delete_tombstone', 'deleted from desk', 'manual', NULL, '${LAUREN}', '2026-09-16 20:27:42.020857+00');
    INSERT INTO audit_log (business_id, actor_user_id, actor_role, action, target_type, target_id, detail) VALUES
      ('${L}', '${LAUREN}', 'OWNER', 'inventory.delete', 'business_inventory', '${LACEY}', '{"prior_qty": 10}');
  `);
  // five captured (history) orders tapped fulfilled after 20:00 — the record of real sales, they stay
  for (let i = 1; i <= 5; i++) {
    const hid = `d0000000-0000-0000-0000-00000000000${i}`;
    await db.exec(`INSERT INTO orders (id, business_id, order_kind, status) VALUES ('${hid}', '${L}', 'history', 'fulfilled');
      INSERT INTO business_inventory_ledger (business_id, delta, kind, reason, source_type, source_id, actor_user_id, created_at)
      VALUES ('${L}', 0, 'order_fulfilled', 'from invoiced', 'order', '${hid}', '${LAUREN}', '2026-09-16 20:5${i}:00+00');`);
  }
  let fillers = f.fillers - (f.extraLaceyRow ? 1 : 0) - (f.extraTestRowAfter2000 ? 1 : 0);
  await db.exec(`INSERT INTO business_inventory_ledger (business_id, inventory_id, delta, kind, source_type, created_at)
    SELECT '${L}', '${FILLER_LOT}', 1, 'count_reconcile', 'inventory_count', '2026-09-01'::timestamptz FROM generate_series(1, ${fillers});`);
  if (f.extraLaceyRow) await db.exec(`INSERT INTO business_inventory_ledger (business_id, inventory_id, delta, kind, source_type, created_at) VALUES ('${L}', '${LACEY}', 0, 'adjust', 'manual', '2026-09-10')`);
  if (f.extraTestRowAfter2000) await db.exec(`INSERT INTO business_inventory_ledger (business_id, inventory_id, delta, kind, source_type, actor_user_id, created_at) VALUES ('${L}', '${FILLER_LOT}', -1, 'adjust', 'manual', '${LAUREN}', '2026-09-16 21:00:00+00')`);
  if (f.laceyCounted) await db.exec(`INSERT INTO inventory_counts (business_id, inventory_id) VALUES ('${L}', '${LACEY}')`);
  if (f.stopOnOrder) await db.exec(`INSERT INTO deliveries (business_id, customer_id, order_id) VALUES ('${L}', '${CUST}', '${ORDER}')`);
  if (f.dropLaceyAudit) await db.exec(`DELETE FROM audit_log WHERE target_id = '${LACEY}'`);
  await db.exec(GUARD);   // applied AFTER the fixture, so the fixture's rows exist
  return db;
}
const one = async (db, q) => Object.values((await db.query(q)).rows[0])[0];
const n = async (db, q) => Number(await one(db, q));
const state = async (db) => JSON.stringify([
  await n(db, `SELECT count(*) FROM business_inventory_ledger`),
  await n(db, `SELECT count(*) FROM orders`),
  await n(db, `SELECT count(*) FROM order_items`),
  await n(db, `SELECT qty FROM business_inventory WHERE id = '${WILLOW}'`),
  await one(db, `SELECT tgenabled FROM pg_trigger WHERE tgname = 'trg_inventory_ledger_immutable'`),
]);

// ── the good path ─────────────────────────────────────────────────────────────────────────────
{
  const db = await fresh();
  ok(await n(db, `SELECT count(*) FROM business_inventory_ledger WHERE business_id = '${L}'`) === 475, 'R0 the fixture has LAWNS\'s 475 ledger rows');
  await db.exec('BEGIN');
  const before = await one(db, `SELECT undo_import_run('${L}', '${RUN}')`);
  await db.exec('ROLLBACK');
  ok(before.refused === true && before.held_lots === 2 && before.live_orders === 1,
    `R1 (red-first) BEFORE 20260916e the undo refuses run eab7fbd2: ${JSON.stringify(before)}`);
  let err = null;
  try { await db.exec(E16); } catch (e) { err = String(e.message).slice(0, 200); }
  ok(err === null, 'R2 20260916e applies ' + (err ?? ''));
  ok(await n(db, `SELECT count(*) FROM business_inventory_ledger WHERE business_id = '${L}'`) === 470, 'R3 LAWNS ledger 475 → 470');
  ok(await n(db, `SELECT count(*) FROM business_inventory_ledger WHERE source_id = '${ORDER}' OR id = '${TOMB}'`) === 0, 'R4 the four practice-order rows and the tombstone are gone');
  ok(await n(db, `SELECT count(*) FROM business_inventory_ledger WHERE kind = 'order_fulfilled' AND reason = 'from invoiced'`) === 5, 'R5 the five captured-order taps STAY');
  ok(await n(db, `SELECT count(*) FROM orders WHERE id = '${ORDER}'`) === 0 && await n(db, `SELECT count(*) FROM order_items`) === 0
     && await n(db, `SELECT count(*) FROM order_service_selections`) === 0, 'R6 the practice order, its line and its two service selections are gone');
  ok(await n(db, `SELECT qty FROM business_inventory WHERE id = '${WILLOW}'`) === 10, 'R7 Desert Willow is back to 10');
  ok(await one(db, `SELECT status || '/' || qty FROM business_inventory WHERE id = '${LACEY}'`) === 'deleted/0'
     && await n(db, `SELECT count(*) FROM audit_log WHERE target_id = '${LACEY}'`) === 1, 'R8 Lacey Oak stays deleted and its audit row stays');
  ok(await one(db, `SELECT tgenabled FROM pg_trigger WHERE tgname = 'trg_inventory_ledger_immutable'`) === 'O'
     && await n(db, `SELECT count(*) FROM audit_log WHERE action = 'ledger.test_mode_removal'`) === 1, 'R9 the append-only guard is back on; the evidence row is written');
  let refusedDelete = false;
  try { await db.exec(`DELETE FROM business_inventory_ledger WHERE true`); } catch { refusedDelete = true; }
  ok(refusedDelete, 'R9b …and still refuses a DELETE');
  const after = await one(db, `SELECT undo_import_run('${L}', '${RUN}')`);
  ok(after.refused === false && after.inventory_deleted === 2 && after.customers_deleted === 1,
    `R10 AFTER it, the undo for eab7fbd2 has zero blockers and runs (the audit row pointing at Lacey Oak does not block): ${JSON.stringify(after)}`);
}

// ── every refusal changes nothing ────────────────────────────────────────────────────────────
const PROBES = [
  ['P1 20260916c not applied', { with16c: false }, /apply 20260916c/],
  ['P2 LAWNS has writes on', { fixture: { writes: true } }, /not in test mode/],
  ['P3 the LAWNS total differs (476)', { fixture: { fillers: 466 } }, /has 476 ledger rows/],
  ['P4 another test-mode row after 20:00', { fixture: { extraTestRowAfter2000: true } }, /2 test-mode ledger row/],
  ['P5 the order is not a test order', { fixture: { orderKind: 'history' } }, /not a LAWNS test order/],
  ['P6 the order was not created by Lauren', { fixture: { orderActor: OTHER_USER } }, /not created by lauren/],
  ['P7 Desert Willow is not at 8', { fixture: { willowQty: 7 } }, /not at qty 8/],
  ['P8 Lacey Oak has another ledger row', { fixture: { extraLaceyRow: true } }, /Lacey Oak lot has 2 ledger rows/],
  ['P9 the tombstone is not −10', { fixture: { tombDelta: -9 } }, /not the Lacey Oak tombstone/],
  ['P10 Lacey Oak is referenced by a count', { fixture: { laceyCounted: true } }, /reference the Lacey Oak lot/],
  ['P11 a delivery stop belongs to the order', { fixture: { stopOnOrder: true } }, /delivery stop belongs/],
  ['P12 the Lacey Oak audit row is missing (checked AFTER the writes)', { fixture: { dropLaceyAudit: true } }, /audit row of the Lacey Oak delete is gone/],
];
for (const [label, opts, re] of PROBES) {
  const db = await fresh(opts);
  const before = await state(db);
  let err = null;
  try { await db.exec(E16); } catch (e) { err = String(e.message); }
  await db.exec('ROLLBACK').catch(() => {});
  const after = await state(db);
  ok(err !== null && re.test(err) && before === after, `${label}: refused and nothing changed — ${(err ?? 'NOT REFUSED').slice(0, 90)}`);
}

console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
