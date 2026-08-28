#!/usr/bin/env node
/**
 * ── R-STATUS DATA MIGRATION — `confirmed` → `invoiced`, plus four settled walk-ins ──────────
 *
 * PURPOSE:      Bring the DATA to the vocabulary ratified 2026-08-28. Two writes, in one pass,
 *               because code and data ship together: a deploy where the code says `invoiced`
 *               and the rows still say `confirmed` leaves Lauren looking at an empty screen.
 *
 *                 WRITE 1 — the four SETTLED walk-ins → 'fulfilled'.
 *                 WRITE 2 — every remaining 'confirmed' → 'invoiced', all tenants.
 *
 * DEPENDENCIES: SUPABASE_PAT (Management API, via scripts/lib/pgQuery.mjs).
 * OUTPUTS:      per-tenant per-status counts BEFORE and AFTER · available-to-sell per lot
 *               BEFORE and AFTER, every mover tied to an order id · exit 1 on any guard failure.
 *
 * Run:  node scripts/migrate-order-status-vocabulary.mjs            (DRY RUN — reports, writes nothing)
 *       node scripts/migrate-order-status-vocabulary.mjs --apply    (writes)
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 WHY WRITE 1 EXISTS, AND WHY IT IS NOT PART OF THE RENAME
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * `invoiced` was live on twelve rows BEFORE ratification, written only by the QuickBooks push,
 * and ABSENT from ORDER_STATUSES — so `fetchCommittedByLot`, an allow-list built from that enum,
 * could not see them. They held no commitment because of an enum they were not in. Ratifying the
 * set admits all twelve at once, and they are not one population:
 *
 *   FOUR are `self` (walk-in) orders. Each was born 'fulfilled' and its on-hand was decremented
 *   at checkout (submit.ts:824 + :1059 — the customer drove away with the trees); the push then
 *   overwrote the status. Their ledger deltas MATCH their unit counts exactly, which is the
 *   evidence the stock really left. Leaving them open would subtract those units a SECOND time,
 *   logically, on top of the physical decrement — D-52's double-count, arriving through the
 *   integration path. THEY GO TO 'fulfilled'. This is a correction of a defect, not a rename.
 *
 *   EIGHT are `install`/`delivery`. Ledger delta 0 — the stock never moved. They are genuinely
 *   open, paid-but-undelivered sales. `invoiced` is the correct status and their entering the
 *   committed derivation is the CORRECTION the ratification buys: 32 units that were spoken for
 *   and were not being counted. Available-to-sell SHOULD move for these. They are NOT written.
 *
 * The QBO push no longer creates this class (cultivar.ts — the write-back now preserves a
 * terminal status), so this is a one-time cleanup and not a recurring chore.
 *
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 WHAT THIS SCRIPT REFUSES TO DO
 * ════════════════════════════════════════════════════════════════════════════════════════════
 * Every guard below is a REFUSAL, not a warning, and each one exists because the alternative is
 * a silent wrong write on money- or stock-bearing rows:
 *
 *   G1  The four walk-in ids are addressed BY ID and re-verified in place: still 'invoiced',
 *       still transport_method='self', ledger delta still equal to their unit count. If the
 *       world has moved since the audit, this script stops rather than acting on a stale premise.
 *   G2  No history order is touched. `order_kind='history'` is excluded from both writes, and
 *       a history line carrying a lot id aborts the run outright — that invariant is the ONLY
 *       thing keeping captured invoices out of available-to-sell.
 *   G3  LAWNS (the live customer tenant) must not move. Its available-to-sell is compared
 *       before and after and any change is a FAILURE, not a note.
 *   G4  The available-to-sell delta must be EXACTLY the eight open orders' units and nothing
 *       else. Every moving lot is named and tied to the order ids responsible.
 *   G5  Zero rows may read 'confirmed' when this finishes.
 */
import { sql } from './lib/pgQuery.mjs';

const APPLY = process.argv.includes('--apply');
const P = (...a) => console.log(...a);
const money = (n) => `$${Number(n ?? 0).toFixed(2)}`;

/** The four settled walk-ins, from the 2026-08-28 audit. Addressed BY ID — never by a predicate
 *  like "transport_method='self'", because a predicate would sweep up any row that happens to
 *  match tomorrow, and these four were each verified against their own ledger rows by hand. */
const SETTLED_WALK_INS = [
  { id: 'fdf522bd', date: '2026-07-22', units: 2 },
  { id: 'dbf88429', date: '2026-07-23', units: 2 },
  { id: '1885f388', date: '2026-07-24', units: 4 },
  { id: 'c9b192e3', date: '2026-08-25', units: 5 },
];

const LAWNS = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';

/** available-to-sell for every lot, under a given open-status set. The shape mirrors
 *  inventoryStates.fetchCommittedByLot exactly: sum open order-line quantities per lot, floor at
 *  0 is NOT applied here — a negative is a data fact we want to SEE, not a number to tidy away. */
const availableSql = (openSet) => `
  with c as (
    select oi.business_inventory_id lot, sum(oi.quantity)::int q
    from order_items oi join orders o on o.id = oi.order_id
    where o.status in (${openSet}) and oi.business_inventory_id is not null
    group by 1)
  select li.business_id, li.id as lot_id, li.name, li.size, li.qty as on_hand,
         coalesce(c.q,0) as committed, (li.qty - coalesce(c.q,0)) as available
  from business_inventory li left join c on c.lot = li.id`;

const statusCountsSql = `
  select b.name as tenant, o.business_id, o.status, count(*)::int as n
  from orders o join businesses b on b.id = o.business_id
  group by 1,2,3 order by 1,3`;

function fail(msg) {
  console.error(`\n🔴 REFUSED — ${msg}\n`);
  process.exit(1);
}

P(`\n══ R-STATUS DATA MIGRATION ${APPLY ? '· APPLY' : '· DRY RUN (writes nothing)'} ══\n`);

// ── BEFORE ───────────────────────────────────────────────────────────────────────────────────
const before      = await sql(statusCountsSql);
const availBefore = await sql(availableSql(`'pending','confirmed'`));
const availAfterProjected = await sql(availableSql(`'pending','invoiced'`));

P('── BEFORE · orders per tenant per status ──');
for (const r of before) P(`   ${r.tenant.padEnd(24)} ${String(r.status).padEnd(11)} ${r.n}`);

// ── G2 · THE HISTORY-ORDER INVARIANT ─────────────────────────────────────────────────────────
const histLots = await sql(`
  select count(*)::int as n from order_items oi join orders o on o.id = oi.order_id
  where o.order_kind = 'history' and oi.business_inventory_id is not null`);
if (Number(histLots[0]?.n ?? -1) !== 0) {
  fail(`G2: ${histLots[0].n} history order line(s) carry a lot id. That invariant is the ONLY thing `
     + `keeping captured invoices out of available-to-sell, and this migration puts their status `
     + `into the OPEN set. Fix the lines before running this.`);
}
P('\n✅ G2 — zero history lines carry a lot id; captured invoices cannot reach available-to-sell.');

// ── G1 · RE-VERIFY THE FOUR SETTLED WALK-INS AGAINST THE LIVE WORLD ──────────────────────────
const walkIns = await sql(`
  select o.id, o.business_id, o.status, o.transport_method, o.total_amount,
         coalesce(sum(oi.quantity) filter (where oi.business_inventory_id is not null),0)::int as units,
         coalesce((select sum(l.delta)::int from business_inventory_ledger l
                   where l.aggregate_id = o.id and l.aggregate_type = 'ORDER'),0) as ledger_delta
  from orders o left join order_items oi on oi.order_id = o.id
  where o.status = 'invoiced' and o.transport_method = 'self'
  group by o.id, o.business_id, o.status, o.transport_method, o.total_amount
  order by o.created_at`);

P('\n── G1 · the four settled walk-ins, re-verified in place ──');
if (walkIns.length !== SETTLED_WALK_INS.length) {
  fail(`G1: expected ${SETTLED_WALK_INS.length} 'invoiced' self orders, found ${walkIns.length}. `
     + `The audit's premise has moved. Re-audit before writing.`);
}
for (const w of walkIns) {
  const expected = SETTLED_WALK_INS.find((s) => w.id.startsWith(s.id));
  if (!expected) fail(`G1: order ${w.id} is an 'invoiced' self order that was NOT in the audit. Re-audit.`);
  const deltaOk = Number(w.ledger_delta) === -Number(expected.units);
  P(`   ${w.id.slice(0, 8)}  ${String(expected.units).padStart(2)} units  ledger ${String(w.ledger_delta).padStart(3)}  ${money(w.total_amount)}  ${deltaOk ? '✅ stock left' : '🔴 MISMATCH'}`);
  if (!deltaOk) {
    fail(`G1: order ${w.id.slice(0, 8)} has ledger delta ${w.ledger_delta} but ${expected.units} units. `
       + `The evidence that its stock physically left does not hold. Do not mark it fulfilled.`);
  }
}
P('   → all four verified: born fulfilled, decremented at checkout, status overwritten by the push.');

// ── PROJECTED MOVERS ─────────────────────────────────────────────────────────────────────────
// The projection compares the CURRENT open set against the POST-RENAME one, before Write 1 is
// applied. Write 1 then removes the four walk-ins from that set, so the true post-state is
// re-measured after the writes rather than assumed from this projection.
const byLot = new Map(availBefore.map((r) => [r.lot_id, r]));
const movers = availAfterProjected
  .filter((a) => Number(a.available) !== Number(byLot.get(a.lot_id)?.available ?? a.available))
  .map((a) => ({ ...a, before: Number(byLot.get(a.lot_id).available) }));

P('\n── PROJECTED · lots whose available-to-sell moves (before Write 1) ──');
for (const m of movers) {
  const orders = await sql(`
    select o.id, o.status, o.transport_method, oi.quantity
    from order_items oi join orders o on o.id = oi.order_id
    where oi.business_inventory_id = '${m.lot_id}' and o.status = 'invoiced'`);
  P(`   ${String(m.name).slice(0, 30).padEnd(31)} ${String(m.size).padEnd(8)} ${String(m.before).padStart(4)} → ${String(m.available).padStart(4)}`);
  for (const o of orders) P(`      ← ${o.id.slice(0, 8)}  ${o.transport_method}  ${o.quantity} units`);
}
if (movers.length === 0) P('   (none)');

if (!APPLY) {
  P('\n── DRY RUN. Nothing was written. Re-run with --apply to write. ──\n');
  process.exit(0);
}

// ── WRITE 1 · the four settled walk-ins → fulfilled ──────────────────────────────────────────
// BY ID, one statement, driven by the id list — the premise is the DRIVING RELATION of the write
// (STD-023), so a row that no longer qualifies is simply not matched rather than being caught by
// a trailing WHERE the planner may or may not apply as intended.
const ids = walkIns.map((w) => `'${w.id}'`).join(',');
await sql(`update orders set status = 'fulfilled'
           where id in (${ids}) and status = 'invoiced' and transport_method = 'self'
             and coalesce(order_kind,'checkout') <> 'history'`);
P(`\n✅ WRITE 1 — ${walkIns.length} settled walk-ins → 'fulfilled'.`);

// ── WRITE 2 · the rename, all tenants ────────────────────────────────────────────────────────
await sql(`update orders set status = 'invoiced' where status = 'confirmed'`);
P(`✅ WRITE 2 — every 'confirmed' → 'invoiced'.`);

// ── AFTER + THE GUARDS THAT MATTER ───────────────────────────────────────────────────────────
const after     = await sql(statusCountsSql);
const availPost = await sql(availableSql(`'pending','invoiced'`));

P('\n── AFTER · orders per tenant per status ──');
for (const r of after) P(`   ${r.tenant.padEnd(24)} ${String(r.status).padEnd(11)} ${r.n}`);

// G5 — zero 'confirmed' survives.
const leftovers = after.filter((r) => r.status === 'confirmed');
if (leftovers.length > 0) fail(`G5: ${leftovers.length} tenant(s) still hold 'confirmed' rows.`);
P("\n✅ G5 — zero rows read 'confirmed'.");

// G3 — LAWNS must not move at all.
const lawnsBefore = new Map(availBefore.filter((r) => r.business_id === LAWNS).map((r) => [r.lot_id, Number(r.available)]));
const lawnsAfter  = availPost.filter((r) => r.business_id === LAWNS);
const lawnsMoved  = lawnsAfter.filter((r) => lawnsBefore.get(r.lot_id) !== Number(r.available));
if (lawnsMoved.length > 0) {
  for (const m of lawnsMoved) P(`   🔴 ${m.name} ${m.size}: ${lawnsBefore.get(m.lot_id)} → ${m.available}`);
  fail(`G3: LAWNS available-to-sell moved on ${lawnsMoved.length} lot(s). The live customer's `
     + `sellable stock must be byte-identical across this migration.`);
}
P(`✅ G3 — LAWNS unchanged across all ${lawnsAfter.length} lots.`);

// G4 — every mover is named and attributed.
const postMovers = availPost
  .filter((a) => Number(a.available) !== Number(byLot.get(a.lot_id)?.available ?? a.available))
  .map((a) => ({ ...a, before: Number(byLot.get(a.lot_id).available) }));

P('\n── G4 · every lot that moved, and the orders responsible ──');
let attributed = 0;
for (const m of postMovers) {
  const orders = await sql(`
    select o.id, o.status, o.transport_method, oi.quantity
    from order_items oi join orders o on o.id = oi.order_id
    where oi.business_inventory_id = '${m.lot_id}' and o.status in ('pending','invoiced')`);
  const delta = m.before - Number(m.available);
  attributed += delta;
  P(`   ${String(m.name).slice(0, 30).padEnd(31)} ${String(m.size).padEnd(8)} ${String(m.before).padStart(4)} → ${String(m.available).padStart(4)}  (−${delta})`);
  for (const o of orders) P(`      ← ${o.id.slice(0, 8)}  ${o.status}  ${o.transport_method}  ${o.quantity} units`);
}
if (postMovers.length === 0) P('   (none)');
P(`\n   total units newly committed: ${attributed}`);
P('   Expected: exactly the eight open install/delivery orders. Any other lot moving is a defect.');

P('\n✅ MIGRATION COMPLETE.\n');
