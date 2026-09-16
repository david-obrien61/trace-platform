/**
 * -- rehearsal-342.pglite -- the ledger #342 SQL, EXECUTED rather than shape-checked --------------
 *
 * PURPOSE:      `undo_import_run` (20260916c) runs against a
 *               real Postgres (PGlite, WASM) on a minimal schema carrying the REAL append-only trigger
 *               lifted from 20260720. The unit suites only prove the SQL's SHAPE (itemImportWriter
 *               §L10); this proves it RUNS and does what the shape claims: U1–U7 (clean undo with a
 *               practice order · captured order refuses · ledger history refuses · derived FKs named ·
 *               untagged test order + live stop refuse · an unforeseen RESTRICT rolls back EVERY write ·
 *               another run untouched) and C1–C16 (exact rows removed · hand-made lot, other tenant,
 *               order rows, a same-delta desk edit on another day and a count all survive · trigger
 *               re-enabled and still refusing · evidence row · report by source_type · idempotent ·
 *               refuses when live, changing nothing).
 * DEPENDENCIES: @electric-sql/pglite via PGLITE_DIR (NOT a repo dependency). Run from the repo root.
 * OUTPUTS:      pass/fail per probe; exit 1 on any failure, 2 if PGlite is not available.
 * ⚠️ NOT in `npm run verify`. PGlite is Postgres 18; Supabase runs an older major. Nothing used here
 *    is version-specific, but that is an argument, not a measurement — David's V-blocks are the proof.
 * RED-FIRST (2026-09-16): moving the fixture's reversal to 2026-09-17 turns C1/C10/C11 red.
 *
 * Run: PGLITE_DIR=/tmp/pgl/node_modules node scripts/sql-harness/rehearsal-342.pglite.mjs
 */
import { readFileSync } from 'node:fs';
const WT = process.cwd() + '/';
// PGlite is NOT a dependency of this repo (a decision owed to David). Install it anywhere and point
// PGLITE_DIR at that folder's node_modules, e.g.  mkdir /tmp/pgl && cd /tmp/pgl && npm i @electric-sql/pglite
const pgliteDir = process.env.PGLITE_DIR;
if (!pgliteDir) { console.error('Set PGLITE_DIR to a node_modules folder containing @electric-sql/pglite.'); process.exit(2); }
const { PGlite } = await import(pgliteDir.replace(/\/$/, '') + '/@electric-sql/pglite/dist/index.js');
const LAWNS = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const OTHER = 'f7ec5d67-0000-0000-0000-000000000001';
const RUN = '11111111-1111-1111-1111-111111111111';
const OLD = '22222222-2222-2222-2222-222222222222';
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  ✗ ' + m); } };

async function fresh() {
  const db = new PGlite();
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE TABLE businesses (id uuid PRIMARY KEY, name text, qbo_writes_enabled boolean NOT NULL DEFAULT false);
    CREATE TABLE customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id),
      import_run_id uuid, first_name text, created_at timestamptz DEFAULT now());
    CREATE TABLE business_inventory (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id),
      name text, qty int NOT NULL DEFAULT 0, import_run_id uuid, retired_at timestamptz, retired_reason text, retired_by_run_id uuid,
      created_at timestamptz DEFAULT now());
    CREATE TABLE orders (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id),
      customer_id uuid REFERENCES customers(id) ON DELETE RESTRICT, order_kind text, status text, receipt_id uuid, created_at timestamptz DEFAULT now());
    CREATE TABLE order_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid NOT NULL REFERENCES orders(id),
      business_inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL, quantity int);
    CREATE TABLE order_compliance_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id));
    CREATE TABLE order_service_selections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), order_id uuid REFERENCES orders(id));
    CREATE TABLE deliveries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id),
      customer_id uuid REFERENCES customers(id) ON DELETE SET NULL, order_id uuid REFERENCES orders(id) ON DELETE SET NULL);
    CREATE TABLE customer_addresses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid,
      customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT);
    CREATE TABLE inventory_counts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL);
    CREATE TABLE audit_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL, actor_user_id uuid, actor_role text,
      action text NOT NULL, target_type text, target_id text, detail jsonb NOT NULL DEFAULT '{}', outcome text NOT NULL DEFAULT 'success',
      created_at timestamptz NOT NULL DEFAULT now());
    CREATE TABLE business_inventory_ledger (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), business_id uuid NOT NULL REFERENCES businesses(id),
      inventory_id uuid REFERENCES business_inventory(id) ON DELETE SET NULL, delta int NOT NULL, kind text NOT NULL, reason text,
      source_type text, source_id uuid, actor_user_id uuid, occurred_at timestamptz NOT NULL DEFAULT now(), created_at timestamptz NOT NULL DEFAULT now());
    INSERT INTO businesses VALUES ('${LAWNS}', 'LAWNS', false), ('${OTHER}', 'Test Dave', false);
  `);
  // the REAL append-only trigger, lifted from the applied migration
  const led = readFileSync(WT + 'supabase/migrations/20260720_inventory_movement_ledger.sql', 'utf8');
  const fn = led.slice(led.indexOf('CREATE OR REPLACE FUNCTION public.reject_inventory_ledger_mutation()'), led.indexOf('-- Independent backstop'));
  await db.exec(fn);
  await db.exec(readFileSync(WT + 'supabase/migrations/20260916c_practice_orders_and_one_unit_undo.sql', 'utf8'));
  return db;
}
const q1 = async (db, sql, p = []) => (await db.query(sql, p)).rows[0];
const n = async (db, t, w = 'true') => Number((await q1(db, `SELECT count(*) c FROM ${t} WHERE ${w}`)).c);
const undo = async (db, run = RUN) => (await q1(db, `SELECT public.undo_import_run($1,$2) r`, [LAWNS, run])).r;

async function seedRun(db) {
  await db.exec(`
    INSERT INTO customers (id, business_id, import_run_id) VALUES
      ('c0000000-0000-0000-0000-000000000001', '${LAWNS}', '${RUN}'),
      ('c0000000-0000-0000-0000-000000000002', '${LAWNS}', NULL);
    INSERT INTO business_inventory (id, business_id, name, import_run_id) VALUES
      ('a0000000-0000-0000-0000-000000000001', '${LAWNS}', 'Desert Willow', '${RUN}'),
      ('a0000000-0000-0000-0000-000000000002', '${LAWNS}', 'Live Oak', '${RUN}');
    INSERT INTO business_inventory (id, business_id, name, retired_at, retired_by_run_id) VALUES
      ('a0000000-0000-0000-0000-000000000009', '${LAWNS}', 'hidden', now(), '${RUN}');
  `);
}

// ── U1 clean run with a practice order: everything goes, captured untouched ─────────────────────
{
  const db = await fresh(); await seedRun(db);
  await db.exec(`
    INSERT INTO orders (id, business_id, customer_id, order_kind, import_run_id) VALUES
      ('b0000000-0000-0000-0000-000000000001', '${LAWNS}', 'c0000000-0000-0000-0000-000000000001', 'test', '${RUN}'),
      ('b0000000-0000-0000-0000-000000000002', '${LAWNS}', 'c0000000-0000-0000-0000-000000000002', 'history', NULL);
    INSERT INTO order_items (order_id, business_inventory_id, quantity) VALUES ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 2);
    INSERT INTO order_compliance_records (order_id) VALUES ('b0000000-0000-0000-0000-000000000001');
    INSERT INTO order_service_selections (order_id) VALUES ('b0000000-0000-0000-0000-000000000001');
    INSERT INTO deliveries (business_id, customer_id, order_id) VALUES
      ('${LAWNS}', 'c0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001'),
      ('${LAWNS}', 'c0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000002');
  `);
  const r = await undo(db);
  ok(r.refused === false, `U1 clean run proceeds (${JSON.stringify(r)})`);
  ok(r.practice_orders_deleted === 1 && r.practice_lines_deleted === 1 && r.practice_deliveries_deleted === 1, 'U1 practice order, line and stop removed');
  ok(r.inventory_deleted === 2 && r.customers_deleted === 1 && r.unretired === 1, 'U1 products, customer, un-retire');
  ok(await n(db, 'orders') === 1 && await n(db, 'deliveries') === 1, 'U1 captured order and its stop survive');
  ok(await n(db, 'order_compliance_records') === 0 && await n(db, 'order_service_selections') === 0, 'U1 practice children gone');
  ok(await n(db, 'business_inventory', 'retired_at IS NOT NULL') === 0, 'U1 hidden row un-retired');
}
// ── U2 captured order on an imported customer → refused, nothing changes ────────────────────────
{
  const db = await fresh(); await seedRun(db);
  await db.exec(`INSERT INTO orders (business_id, customer_id, order_kind) VALUES ('${LAWNS}', 'c0000000-0000-0000-0000-000000000001', 'history');`);
  const r = await undo(db);
  ok(r.refused === true && r.live_orders === 1, `U2 refused on captured order (${JSON.stringify(r)})`);
  ok(await n(db, 'customers') === 2 && await n(db, 'business_inventory') === 3, 'U2 nothing changed');
}
// ── U3 ledger history → refused ──────────────────────────────────────────────────────────────────
{
  const db = await fresh(); await seedRun(db);
  await db.exec(`INSERT INTO business_inventory_ledger (business_id, inventory_id, delta, kind, source_type) VALUES ('${LAWNS}', 'a0000000-0000-0000-0000-000000000002', -2, 'sale', 'order');`);
  const r = await undo(db);
  ok(r.refused === true && r.held_lots === 1, `U3 refused on ledger history (${JSON.stringify(r)})`);
}
// ── U4 a saved address (derived FK) → refused and named ─────────────────────────────────────────
{
  const db = await fresh(); await seedRun(db);
  await db.exec(`INSERT INTO customer_addresses (business_id, customer_id) VALUES ('${LAWNS}', 'c0000000-0000-0000-0000-000000000001');
                 INSERT INTO inventory_counts (inventory_id) VALUES ('a0000000-0000-0000-0000-000000000001');`);
  const r = await undo(db);
  ok(r.refused === true && r.other_references['public.customer_addresses.customer_id'] === 1
     && r.other_references['public.inventory_counts.inventory_id'] === 1, `U4 derived FKs counted by name (${JSON.stringify(r)})`);
}
// ── U5 an untagged test order → refused; a live stop on a run customer → refused ────────────────
{
  const db = await fresh(); await seedRun(db);
  await db.exec(`INSERT INTO orders (business_id, customer_id, order_kind) VALUES ('${LAWNS}', 'c0000000-0000-0000-0000-000000000001', 'test');
                 INSERT INTO deliveries (business_id, customer_id) VALUES ('${LAWNS}', 'c0000000-0000-0000-0000-000000000001');`);
  const r = await undo(db);
  ok(r.refused === true && r.live_orders === 1 && r.live_deliveries === 1, `U5 untagged test order + live stop (${JSON.stringify(r)})`);
}
// ── U6 an FK the pre-flight cannot see → the error rolls back EVERY write ───────────────────────
{
  const db = await fresh(); await seedRun(db);
  // A multi-column FK is excluded from the derived read, so it reaches the DELETE and RESTRICTs there.
  await db.exec(`ALTER TABLE business_inventory ADD CONSTRAINT bi_uq UNIQUE (id, business_id);
    CREATE TABLE sneaky (inv uuid, biz uuid, FOREIGN KEY (inv, biz) REFERENCES business_inventory(id, business_id) ON DELETE RESTRICT);
    INSERT INTO sneaky VALUES ('a0000000-0000-0000-0000-000000000001', '${LAWNS}');
    INSERT INTO orders (id, business_id, customer_id, order_kind, import_run_id) VALUES
      ('b0000000-0000-0000-0000-000000000003', '${LAWNS}', 'c0000000-0000-0000-0000-000000000001', 'test', '${RUN}');`);
  let threw = false;
  try { await undo(db); } catch { threw = true; }
  ok(threw, 'U6 an unforeseen RESTRICT raises');
  ok(await n(db, 'orders') === 1 && await n(db, 'customers') === 2 && await n(db, 'business_inventory', 'retired_at IS NOT NULL') === 1,
     'U6 🔴 ONE UNIT: the practice order, the customers and the retirement are all still there');
}
// ── U7 another run's rows are untouched ─────────────────────────────────────────────────────────
{
  const db = await fresh(); await seedRun(db);
  await db.exec(`INSERT INTO business_inventory (business_id, name, import_run_id) VALUES ('${LAWNS}', 'older', '${OLD}');`);
  const r = await undo(db);
  ok(r.refused === false && await n(db, 'business_inventory', `import_run_id = '${OLD}'`) === 1, 'U7 another run survives');
}

// ── CLEANUP — REMOVED 2026-09-16 (David) ──────────────────────────────────────────────────────────
// `20260916_rehearsal_cleanup_lawns.sql` was NOT applied: discovery 2026-09-16 (7c) found ZERO seed
// rows on LAWNS, so it would have deleted nothing. It is replaced by the targeted
// `20260916e_remove_lawns_test_mode_ledger_rows.sql`, tested in
// `lawns-test-mode-removal-335.pglite.mjs`. Its checks C1–C16 went with it.

console.log(`\nPGlite: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
