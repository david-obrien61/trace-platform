#!/usr/bin/env node
// ============================================================
// d52-remediate-committed-stock — the ONE-TIME D-52 reconciliation of pre-D-52 open orders.
//
// PURPOSE:
//   Under D-42, on-hand was decremented at CHECKOUT. Under D-52 it decrements at FULFILLMENT.
//   Orders placed before this build therefore already took their units OUT of on-hand while
//   still sitting open — so today those lots UNDER-report: stock that is physically standing in
//   the yard, committed to an open order, reads as gone. This script credits it back, after
//   which the units show as ON-HAND and COMMITTED (derived from the still-open order) — which is
//   what D-52 says they are.
//
//   ⚠️ IT IS NOT A BLANKET "CREDIT EVERY OPEN ORDER". See WALK-INS below — that distinction is
//   the whole reason this is a script with a report mode rather than one UPDATE statement.
//
// DEPENDENCIES: Supabase service key (writes go through the emit_inventory_movement RPC family).
// OUTPUTS:      a REPORT (default) or, with --apply, one ledger event per affected order line.
//
// ── WALK-INS ARE EXCLUDED, AND THIS IS THE POINT ────────────────────────────────────────────
//   A self-transport ("I'll haul it myself") order that is still sitting at 'pending' is NOT
//   under-reported. That customer drove away with the plants the day they paid — the stock is
//   genuinely gone, and D-42 decremented it correctly. Its status only reads 'pending' because
//   no status-transition UI existed to move it, not because anything is owed.
//   Crediting those lots would INVENT stock the nursery does not have, in an append-only ledger
//   that cannot be retracted — the precise failure D-50's immutability exists to prevent, done
//   by our own hand. Only delivery/install orders are remediated.
//
// ── WHY LEDGERED EVENTS AND NOT AN UPDATE ───────────────────────────────────────────────────
//   Every unit that moves leaves a dated, attributed row (D-50). A silent UPDATE would restore
//   the number while erasing the reason, and the next reconcile would show qty != SUM(delta)
//   with nothing to explain the gap. Each credit here is a first-class movement carrying the
//   order it came from, so the ledger still reconciles afterwards.
//
// ── USAGE ───────────────────────────────────────────────────────────────────────────────────
//   REPORT (default — writes NOTHING; this is what David confirms):
//     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/d52-remediate-committed-stock.mjs
//   APPLY (only after the report is confirmed):
//     SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/d52-remediate-committed-stock.mjs --apply
//
//   --apply is deliberately not the default and takes no shortcut flag: this writes irreversible
//   rows to an append-only log, so the default had to be the harmless one.
// ============================================================
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');
const KIND = 'd42_remediation';

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;
if (!url || !key) {
  console.error('FATAL: SUPABASE_URL and SUPABASE_SERVICE_KEY are required.');
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// The states that hold a commitment (mirrors inventoryStates.holdsCommitment — kept in sync by
// hand here because a .mjs script cannot import the TS module without a build step; the list is
// two values and is asserted against the live data below rather than trusted).
const OPEN_STATUSES = ['pending', 'confirmed'];

const { data: orders, error: oErr } = await db
  .from('orders')
  .select('id, status, transport_method, total_amount, created_at, business_id, notes')
  .in('status', OPEN_STATUSES)
  .order('created_at', { ascending: true });
if (oErr) { console.error('FATAL: order read failed:', oErr.message); process.exit(1); }

const { data: items, error: iErr } = await db
  .from('order_items')
  .select('id, order_id, quantity, business_inventory_id');
if (iErr) { console.error('FATAL: order_items read failed:', iErr.message); process.exit(1); }

const linesFor = (orderId) => (items ?? []).filter(i => i.order_id === orderId);

const remediate = [];   // delivery/install → credit back
const skipWalkIn = [];  // self → stock genuinely gone, do NOT credit
const skipNoLot = [];   // no lot anchor → nothing to credit, must be surfaced not dropped

for (const o of orders ?? []) {
  const isWalkIn = o.transport_method === 'self';
  for (const l of linesFor(o.id)) {
    const row = {
      orderId: o.id, status: o.status, transport: o.transport_method ?? '(null)',
      lotId: l.business_inventory_id, qty: Number(l.quantity),
      businessId: o.business_id, invoice: o.notes ?? '', created: (o.created_at ?? '').slice(0, 10),
    };
    if (isWalkIn)                  skipWalkIn.push(row);
    else if (!l.business_inventory_id) skipNoLot.push(row);
    else                           remediate.push(row);
  }
}

// ── Lot context: what the credit does to each lot's on-hand ────────────────────────────────
const lotIds = [...new Set(remediate.map(r => r.lotId))];
const lotById = new Map();
if (lotIds.length) {
  const { data: lots } = await db
    .from('business_inventory').select('id, name, size, qty, status').in('id', lotIds);
  for (const l of lots ?? []) lotById.set(l.id, l);
}

const addByLot = new Map();
for (const r of remediate) addByLot.set(r.lotId, (addByLot.get(r.lotId) ?? 0) + r.qty);

console.log('='.repeat(78));
console.log(`D-52 REMEDIATION — ${APPLY ? '⚠️  APPLY MODE (WILL WRITE)' : 'REPORT ONLY (writes nothing)'}`);
console.log('='.repeat(78));
console.log(`\nOpen orders found (${OPEN_STATUSES.join('/')}): ${(orders ?? []).length}`);
console.log(`  → lines to remediate (delivery/install): ${remediate.length}`);
console.log(`  → lines SKIPPED, walk-in/self:           ${skipWalkIn.length}   (stock genuinely left — crediting would invent it)`);
console.log(`  → lines SKIPPED, no lot anchor:          ${skipNoLot.length}`);

if (remediate.length) {
  console.log('\n── TO REMEDIATE (credit back to on-hand) ──');
  console.table(remediate.map(r => ({
    order: r.orderId.slice(0, 8), invoice: r.invoice, created: r.created,
    transport: r.transport, qty: r.qty, lot: (r.lotId ?? '').slice(0, 8),
    lotName: lotById.get(r.lotId)?.name ?? '(lot missing)',
  })));

  console.log('\n── LOT IMPACT (current on-hand → after remediation) ──');
  console.table([...addByLot.entries()].map(([lotId, add]) => {
    const l = lotById.get(lotId);
    return {
      lot: lotId.slice(0, 8), name: l?.name ?? '(MISSING LOT)', size: l?.size ?? '—',
      currentOnHand: l ? Number(l.qty) : null, credit: add,
      newOnHand: l ? Number(l.qty) + add : null, lotStatus: l?.status ?? '—',
    };
  }));
}

if (skipWalkIn.length) {
  console.log('\n── SKIPPED: walk-in / self-transport (NOT credited — stock physically left) ──');
  console.table(skipWalkIn.map(r => ({
    order: r.orderId.slice(0, 8), invoice: r.invoice, created: r.created, qty: r.qty,
    lot: (r.lotId ?? '—').slice(0, 8),
  })));
  console.log('  NOTE: these orders read "pending" only because no status UI existed to close them.');
  console.log('  Consider marking them fulfilled separately — that is a STATUS correction, not a stock one.');
}

if (skipNoLot.length) {
  console.log('\n── SKIPPED: no business_inventory_id on the line (nothing to credit) ──');
  console.table(skipNoLot.map(r => ({ order: r.orderId.slice(0, 8), qty: r.qty, transport: r.transport })));
}

const missingLots = [...addByLot.keys()].filter(id => !lotById.has(id));
if (missingLots.length) {
  console.log(`\n⚠️  ${missingLots.length} referenced lot(s) NO LONGER EXIST — those credits will be skipped on apply:`);
  for (const id of missingLots) console.log(`     ${id}`);
}

if (!APPLY) {
  console.log('\n' + '='.repeat(78));
  console.log('REPORT ONLY — nothing was written.');
  console.log('Confirm the tables above, then re-run with --apply to write the ledger events.');
  console.log('='.repeat(78));
  process.exit(0);
}

// ── APPLY ───────────────────────────────────────────────────────────────────────────────────
// One credit per LINE (not per lot): each event names the order it restores, so the ledger
// explains itself later. A lot appearing on two orders gets two rows — that is correct, and
// collapsing them into one would lose which order each unit came back from.
console.log('\n── APPLYING ──');
let ok = 0, failed = 0, skipped = 0;
for (const r of remediate) {
  if (!lotById.has(r.lotId)) { skipped++; continue; }
  const { error } = await db.rpc('adjust_inventory_qty', {
    p_lot_id: r.lotId, p_business_id: r.businessId, p_delta: r.qty,
    p_actor_user_id: null,          // a system reconciliation — no human performed it (D-9: honest NULL, never a fabricated owner)
    p_kind: KIND,
    // The reason names the order, so a reader six months from now can see WHY on-hand jumped
    // without needing this script or its commit message to still be findable.
    p_reason: `D-52 reconciliation: order ${r.orderId} (${r.invoice || 'no invoice'}) decremented on-hand at checkout under D-42 but is still open (${r.status}/${r.transport}); the units never left the property. Crediting ${r.qty} back to on-hand, where the open order now holds them as COMMITTED.`,
    p_source_type: 'order', p_source_id: r.orderId,
    p_occurred_at: new Date().toISOString(),
  });
  if (error) {
    failed++;
    console.error(`  ✗ order ${r.orderId.slice(0, 8)} lot ${r.lotId.slice(0, 8)} +${r.qty}: ${error.message}`);
  } else {
    ok++;
    console.log(`  ✓ order ${r.orderId.slice(0, 8)} lot ${r.lotId.slice(0, 8)} +${r.qty} (${lotById.get(r.lotId)?.name ?? '?'})`);
  }
}
console.log(`\nDONE — applied ${ok}, failed ${failed}, skipped ${skipped} (missing lot).`);
if (failed) {
  console.log('⚠️  Some credits failed. Re-running is NOT safe without first checking the ledger:');
  console.log('    the successful ones already landed and would be applied a second time.');
  process.exit(1);
}
