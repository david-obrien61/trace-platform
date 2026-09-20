#!/usr/bin/env node
/**
 * ── zero-seeded-fees-357 — the seeded 10 comes off the fee rows, and off nothing else ─────────
 *
 * PURPOSE:      Ledger #357. Runs the REAL `20260920_zero_seeded_qty_on_non_product_rows.sql`
 *               against the LIVE schema on PGlite (`scripts/path-tests/lib/liveDb.mjs`), so the
 *               refusals are proven to FIRE rather than asserted (§6 r19 / [[R-33]]).
 *               Every probe is synthetic: the ids are LAWNS's QuickBooks item ids, but no
 *               customer, name or address from the live data is used.
 * DEPENDENCIES: @electric-sql/pglite (dev) · liveDb · the migration file.
 * OUTPUTS:      PASS/FAIL per probe; exit 1 on any failure.
 */
import { readFileSync } from 'node:fs';
import { openLiveDb } from '../path-tests/lib/liveDb.mjs';

const MIG = readFileSync(`${process.cwd()}/supabase/migrations/20260920_zero_seeded_qty_on_non_product_rows.sql`, 'utf8');
const BIZ = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const RUN = 'bffc7713-d275-436c-bf8c-1ff29f3d14b9';
const OWNER = '0a000000-0000-4000-8000-0000000000aa';
/** The 41 the migration names, and the four it must leave alone. */
const FEES = ['1','2','3','4','5','6','7','8','10','12','13','14','15','16','91','102','105','116','117','121','128','129','137','164','167','172','176','186','187','195','196','197','198','199','207','210','603','1000','1006','1007','1116'];
const AMBIGUOUS = ['1120', '11', '1118', '1001'];

let fails = 0;
const ok = (c, m) => { console.log(`${c ? 'PASS' : 'FAIL'} ${m}`); if (!c) fails++; };
const one = async (db, q, p = []) => (await db.query(q, p)).rows[0];

/** A tenant mid-test: the run's 41 fee rows + 4 unclassified + 590 real products, all seeded to 10. */
async function fresh({ qtyOverride = null, withHistory = false, missingRow = false, alreadyZero = false } = {}) {
  const db = await openLiveDb();
  await db.exec(`insert into auth.users (id) values ('${OWNER}')`);
  await db.exec(`insert into public.businesses (id, owner_id, name, business_type, qbo_writes_enabled)
                 values ('${BIZ}', '${OWNER}', 'Seed test', 'nursery', false)`);
  await db.exec(`SET session_replication_role = replica`);
  const add = async (qb, name, qty) => db.query(
    `insert into public.business_inventory (id, business_id, name, qty, status, sell_price, price_basis, qb_item_id, import_run_id)
     values (gen_random_uuid(), $1, $2, $3, 'available', 10, 'quickbooks_item_price', $4, $5)`,
    [BIZ, name, qty, qb, RUN]);
  const feeIds = missingRow ? FEES.slice(0, -1) : FEES;   // one row gone: deleted by hand, or a reload moved it
  for (const qb of feeIds) await add(qb, `Fee row ${qb}`, alreadyZero ? 0 : (qtyOverride ?? 10));
  for (const qb of AMBIGUOUS) await add(qb, `Unclassified ${qb}`, 10);
  for (let i = 0; i < 590 - AMBIGUOUS.length; i++) await add(`9${String(i).padStart(4, '0')}`, `Real product ${i}`, 10);
  if (withHistory) {
    const row = await one(db, `select id from public.business_inventory where business_id=$1 and qb_item_id='176'`, [BIZ]);
    await db.query(`insert into public.business_inventory_ledger (id, business_id, inventory_id, delta, kind, reason)
                    values (gen_random_uuid(), $1, $2, 10, 'adjust', 'someone counted it')`, [BIZ, row.id]);
  }
  await db.exec(`SET session_replication_role = origin`);
  return db;
}

const apply = async (db) => {
  try { await db.exec(MIG); return { ok: true, error: null }; }
  catch (e) { try { await db.exec('ROLLBACK'); } catch { /* none */ } return { ok: false, error: String(e.message) }; }
};
const counts = async (db) => await one(db, `select
  (select count(*)::int from public.business_inventory where business_id=$1 and qb_item_id = any($2) and qty = 0) fees_at_zero,
  (select count(*)::int from public.business_inventory where business_id=$1 and not (qb_item_id = any($2)) and qty = 10) others_at_ten,
  (select count(*)::int from public.business_inventory where business_id=$1 and qb_item_id = any($3) and qty = 10) unclassified_at_ten,
  (select count(*)::int from public.business_inventory_ledger where business_id=$1) ledger_rows`, [BIZ, FEES, AMBIGUOUS]);

// ── A · THE HAPPY PATH ────────────────────────────────────────────────────────────────────────
{
  const db = await fresh();
  const before = await counts(db);
  const r = await apply(db);
  const after = await counts(db);
  ok(r.ok, `A1 it applies (${r.error ?? 'no error'})`);
  ok(after.fees_at_zero === 41, `A2 all 41 fee rows are at 0 (${after.fees_at_zero})`);
  ok(after.others_at_ten === 590, `A3 the 590 other rows still hold their seeded 10 (${after.others_at_ten})`);
  ok(after.unclassified_at_ten === 4, `A4 the four unclassified rows are untouched, still 10 (${after.unclassified_at_ten})`);
  ok(before.ledger_rows === 0 && after.ledger_rows === 0, `A5 🔴 NO ledger row was written (before ${before.ledger_rows}, after ${after.ledger_rows})`);
}

// ── B · THE REFUSALS, EACH PROVEN TO FIRE ─────────────────────────────────────────────────────
{
  const db = await fresh({ alreadyZero: true });
  const r = await apply(db);
  ok(!r.ok && /ALREADY APPLIED/.test(r.error), `B1 re-running it refuses instead of pretending to work (${(r.error ?? 'applied').slice(0, 60)})`);
}
{
  const db = await fresh({ qtyOverride: 7 });
  const r = await apply(db);
  const after = await counts(db);
  ok(!r.ok && /hold the seeded 10/.test(r.error), `B2 a fee row holding a number nobody seeded REFUSES — a real count is never overwritten (${(r.error ?? 'applied').slice(0, 70)})`);
  ok(after.fees_at_zero === 0, 'B3 …and nothing was changed');
}
{
  const db = await fresh({ withHistory: true });
  const r = await apply(db);
  const after = await counts(db);
  ok(!r.ok && /ledger history/.test(r.error), `B4 a fee row with ledger history REFUSES (${(r.error ?? 'applied').slice(0, 70)})`);
  ok(after.fees_at_zero === 0, 'B5 …and nothing was changed');
}
{
  // ✏️ A DUPLICATE qb_item_id CANNOT HAPPEN, and the harness is what proved it: the live schema
  // carries `business_inventory_business_qb_item_uidx` on (business_id, qb_item_id), so the
  // first draft of this probe was testing an unreachable state. The reachable shape is a row
  // that is GONE — deleted by hand, or moved by a reload.
  const db = await fresh({ missingRow: true });
  const r = await apply(db);
  const after = await counts(db);
  ok(!r.ok && /not 41/.test(r.error), `B6 one of the 41 rows missing REFUSES — the catalogue is not what this file was written against (${(r.error ?? 'applied').slice(0, 70)})`);
  ok(after.fees_at_zero === 0, 'B7 …and nothing was changed');
}
{
  const db = await openLiveDb();
  await db.exec(`insert into auth.users (id) values ('${OWNER}')`);
  await db.exec(`insert into public.businesses (id, owner_id, name, business_type, qbo_writes_enabled)
                 values ('${BIZ}', '${OWNER}', 'Empty', 'nursery', false)`);
  const r = await apply(db);
  ok(!r.ok && /not 41/.test(r.error), `B8 on a database where the run does not exist it REFUSES rather than matching zero rows (${(r.error ?? 'applied').slice(0, 60)})`);
}

console.log(fails ? `\n${fails} probe(s) FAILED` : '\nall probes passed');
process.exit(fails ? 1 : 0);
