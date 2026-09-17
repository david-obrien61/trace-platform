#!/usr/bin/env node
/**
 * ── undo-test-mode-edits-348 — a test-mode edit never blocks the wipe, and never survives it ─────
 *
 * PURPOSE:      Ledger #348 · David, 2026-09-16, restated 2026-09-17: *"the wipe must work regardless
 *               of what users entered or changed during testing … only live captures are never
 *               removed."* Runs the REAL `20260917b` against the LIVE schema on PGlite
 *               (`scripts/path-tests/lib/liveDb.mjs`), which carries the LIVE `undo_import_run` —
 *               so every probe runs RED-FIRST against today's function before the migration is applied.
 * DEPENDENCIES: @electric-sql/pglite (dev) · liveDb · supabase/migrations/20260917b…sql.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure. Synthetic data only.
 */
import { readFileSync } from 'node:fs';
import { openLiveDb } from '../path-tests/lib/liveDb.mjs';

const MIG = readFileSync(`${process.cwd()}/supabase/migrations/20260917b_undo_takes_test_mode_edits.sql`, 'utf8');
const B = 'b0000000-0000-4000-8000-00000000000b';
const OWNER = '0a000000-0000-4000-8000-0000000000aa';
const RUN = 'e1000000-0000-4000-8000-00000000000e';

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };
const one = async (db, q, p = []) => (await db.query(q, p)).rows[0];

/**
 * A tenant mid-import: 2 imported customers (each with a tagged phone, email and address), 2
 * imported products, 1 older product the run hid, and 1 hand-made customer that is not in the run.
 * `opts.typed` adds a row a PERSON typed onto an imported customer, untagged (what #348 is about).
 * `opts.capturedOrder` puts a CAPTURED (history) order on an imported customer — never removable.
 * `opts.practiceOrder` puts a PRACTICE (test) order of this run on one — removable with the run.
 */
async function fresh({ writes = false, typed = false, capturedOrder = false, practiceOrder = false, applyMigration = true } = {}) {
  const db = await openLiveDb();
  await db.exec(`insert into auth.users (id) values ('${OWNER}')`);
  await db.exec(`insert into public.businesses (id, owner_id, name, business_type, qbo_writes_enabled)
                 values ('${B}', '${OWNER}', 'Undo test', 'nursery', ${writes})`);
  await db.exec(`SET session_replication_role = replica`);
  for (const i of [1, 2]) {
    const c = `c000000${i}-0000-4000-8000-00000000000c`;
    await db.query(`insert into public.customers (id, business_id, first_name, last_name, source, import_run_id)
                    values ($1, $2, $3, 'Imported', 'qbo-customer-import', $4)`, [c, B, `Cust${i}`, RUN]);
    await db.query(`insert into public.customer_phones (business_id, customer_id, label, value, value_norm, is_primary, source, active, import_run_id)
                    values ($1, $2, 'main', $3, $4, true, 'qbo-customer-import', true, $5)`, [B, c, `(512) 555-010${i}`, `512555010${i}`, RUN]);
    await db.query(`insert into public.customer_emails (business_id, customer_id, label, value, value_norm, is_primary, source, active, import_run_id)
                    values ($1, $2, 'main', $3, $3, true, 'qbo-customer-import', true, $4)`, [B, c, `c${i}@example.com`, RUN]);
    await db.query(`insert into public.customer_addresses (business_id, customer_id, label, kind, line1, is_default, source, active, import_run_id)
                    values ($1, $2, 'Billing', 'billing', $3, true, 'qbo-customer-import', true, $4)`, [B, c, `${i} Import Rd`, RUN]);
  }
  await db.query(`insert into public.customers (id, business_id, first_name, last_name, source) values ($1, $2, 'Hand', 'Made', 'manual')`,
    ['c9999999-0000-4000-8000-00000000000c', B]);
  for (const i of [1, 2]) {
    await db.query(`insert into public.business_inventory (id, business_id, name, qty, status, sell_price, import_run_id)
                    values ($1, $2, $3, 0, 'available', 100, $4)`, [`b000000${i}-0000-4000-8000-00000000000b`, B, `Imported item ${i}`, RUN]);
  }
  await db.query(`insert into public.business_inventory (id, business_id, name, qty, status, sell_price, retired_at, retired_by_run_id, retired_reason)
                  values ($1, $2, 'Older item', 3, 'available', 50, now(), $3, 'hidden by the import')`,
    ['b0000009-0000-4000-8000-00000000000b', B, RUN]);
  if (typed) {
    // What Lauren types onto an imported customer while testing: no run id on the row.
    await db.query(`insert into public.customer_phones (business_id, customer_id, label, value, value_norm, is_primary, source, active)
                    values ($1, $2, 'other', '(222) 333-8080', '2223338080', false, 'manual', true)`, [B, 'c0000001-0000-4000-8000-00000000000c']);
  }
  if (capturedOrder) {
    await db.query(`insert into public.orders (id, business_id, customer_id, order_kind, total_amount, status, transport_method)
                    values ($1, $2, $3, 'history', 100, 'invoiced', 'self')`, ['0d000001-0000-4000-8000-00000000000d', B, 'c0000001-0000-4000-8000-00000000000c']);
  }
  if (practiceOrder) {
    await db.query(`insert into public.orders (id, business_id, customer_id, order_kind, import_run_id, total_amount, status, transport_method)
                    values ($1, $2, $3, 'test', $4, 100, 'pending', 'self')`, ['0d000002-0000-4000-8000-00000000000d', B, 'c0000002-0000-4000-8000-00000000000c', RUN]);
  }
  await db.exec(`SET session_replication_role = origin`);
  if (applyMigration) await db.exec(MIG);
  return db;
}

const counts = async (db) => await one(db, `select
  (select count(*)::int from public.customers) customers,
  (select count(*)::int from public.customer_phones) phones,
  (select count(*)::int from public.customer_emails) emails,
  (select count(*)::int from public.customer_addresses) addresses,
  (select count(*)::int from public.business_inventory) products,
  (select count(*)::int from public.business_inventory where retired_at is null) products_live,
  (select count(*)::int from public.orders) orders`);
const undo = async (db) => (await one(db, `select public.undo_import_run($1::uuid, $2::uuid) r`, [B, RUN])).r;

// ── R · RED-FIRST against the LIVE function (no migration) ────────────────────────────────────
{
  const db = await fresh({ typed: true, applyMigration: false });
  const before = await counts(db);
  const r = await undo(db);
  ok(r.refused === true && r.live_contact_rows === 1, `R1 🔴 RED: today's undo REFUSES in test mode because a person typed a number (${JSON.stringify(r).slice(0, 110)})`);
  ok(JSON.stringify(await counts(db)) === JSON.stringify(before), 'R2 …and nothing was removed — the wipe is blocked by a test-mode edit, which is the defect');
}

// ── A · TEST MODE: the undo takes every contact row on a run customer ─────────────────────────
{
  const db = await fresh({ typed: true });
  const r = await undo(db);
  ok(r.refused === false, `A1 test mode: the undo runs even though a person typed a number (${JSON.stringify(r).slice(0, 120)})`);
  ok(r.contact_rows_deleted === 7, `A2 it removed all SEVEN contact rows — the six imported and the one typed (${r.contact_rows_deleted})`);
  const after = await counts(db);
  ok(after.customers === 1 && after.phones === 0 && after.emails === 0 && after.addresses === 0,
    `A3 the imported customers and every contact row are gone; the hand-made customer stays (${JSON.stringify(after)})`);
  ok(after.products === 1 && after.products_live === 1 && r.unretired === 1,
    `A4 the imported products are gone and the older one is visible again (${JSON.stringify(after)})`);
}

// ── B · WRITES ON: today's refusal stands ─────────────────────────────────────────────────────
{
  const db = await fresh({ typed: true, writes: true });
  const before = await counts(db);
  const r = await undo(db);
  ok(r.refused === true && r.live_contact_rows === 1, `B1 writes ON: a contact row a person added still REFUSES (${JSON.stringify(r).slice(0, 110)})`);
  ok(JSON.stringify(await counts(db)) === JSON.stringify(before), 'B2 …and nothing was removed');
}
{
  const db = await fresh({ writes: true });
  const r = await undo(db);
  ok(r.refused === false && r.contact_rows_deleted === 6, `B3 writes ON with nothing typed: the undo works exactly as before (${JSON.stringify(r).slice(0, 110)})`);
}

// ── C · A LIVE CAPTURE IS NEVER REMOVED, IN EITHER MODE ───────────────────────────────────────
for (const writes of [false, true]) {
  const db = await fresh({ capturedOrder: true, writes });
  const before = await counts(db);
  const r = await undo(db);
  ok(r.refused === true && r.live_orders === 1,
    `C${writes ? 2 : 1} a CAPTURED order on an imported customer refuses with writes ${writes ? 'ON' : 'OFF'} (${JSON.stringify(r).slice(0, 110)})`);
  ok(JSON.stringify(await counts(db)) === JSON.stringify(before), `C${writes ? 2 : 1}b …and nothing was removed`);
}
{
  const db = await fresh({ typed: true, capturedOrder: true });
  const r = await undo(db);
  ok(r.refused === true && r.live_orders === 1 && r.live_contact_rows === 0,
    `C3 in test mode the ONLY thing left refusing is the capture — not the typed number (${JSON.stringify(r).slice(0, 130)})`);
}

// ── D · a PRACTICE order of this run goes with it (unchanged) ─────────────────────────────────
{
  const db = await fresh({ practiceOrder: true, typed: true });
  const r = await undo(db);
  ok(r.refused === false && r.practice_orders_deleted === 1 && (await counts(db)).orders === 0,
    `D1 a practice order of this run is removed with it (${JSON.stringify(r).slice(0, 120)})`);
}

// ── E · the migration refuses on a database without the pieces ────────────────────────────────
{
  const db = await openLiveDb();
  await db.exec(`DROP FUNCTION IF EXISTS public.undo_import_run(uuid, uuid)`);
  let err = null;
  try { await db.exec(MIG); } catch (e) { err = String(e.message); try { await db.exec('ROLLBACK'); } catch { /* none */ } }
  ok(err !== null && /REFUSED: undo_import_run does not exist/.test(err), `E1 the migration refuses if the undo is not there yet (${(err ?? 'applied').slice(0, 70)})`);
}

console.log(fails ? `\n${fails} probe(s) FAILED` : '\nall probes passed');
process.exit(fails ? 1 : 0);
