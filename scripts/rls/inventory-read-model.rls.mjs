/**
 * ── I14 + I16/I17 — the inventory READ model under real RLS ───────────────────────────
 *
 * CAPABILITY ASSERTED (STD-025 — capability, never configuration):
 *   (a) AVAILABLE is DERIVED as on-hand − committed, and COMMITMENT IS HELD BY OPEN ORDERS ONLY —
 *       a fulfilled or cancelled order releases it. No claim about how many orders exist or what
 *       any lot's qty is; the RULE is asserted over whatever data is present.
 *   (b) A member's inventory READ SPLIT is real at the DATA LAYER — `inventory:read` grants the
 *       operational fields; `costs:read` is what unit_cost requires. Asserted as "what a member
 *       WITHOUT costs:read can obtain by querying directly", which is the only form of the claim
 *       that means anything (card N-7: "N-6 without N-7 proves nothing").
 *
 * PURPOSE:      Test-inventory rows I14, I16, I17. Cards N-6 / N-7.
 * DEPENDENCIES: ../lib/memberSession.mjs · a live tenant · .env.local. Network required.
 * OUTPUTS:      pass/fail per assertion; exit 1 on any failure.
 *
 * READ-ONLY — this test creates no rows and mutates nothing. It needs no teardown, which is the
 * safest shape available and is why it is a good second file on the harness.
 *
 * DATA PRECONDITION, CHECKED NOT ASSUMED (the 2026-07-30 wages lesson: a test that needs data the
 * tenant does not have passes or fails for reasons unrelated to its subject). The read-split
 * assertions require at least one lot with a NON-NULL unit_cost — otherwise "no cost came back"
 * is indistinguishable from "there was no cost to come back". If none exists the test SAYS SO and
 * fails loudly rather than reporting a green it did not earn.
 *
 * ⚠️ NOT AN OWNER-TEST. Cards N-6/N-7 stay `owed` (OP-14). N-6 is a SCREEN claim — what the grid
 * renders — which only David can prove. N-7 is the DATA claim, and that is this file.
 *
 * 🔴 KNOWN RED — 2 FAILURES, BOTH REAL, NEITHER A TEST DEFECT (2026-07-30). Left failing on
 * purpose: David's standing rule is that a true failure lands red rather than sitting unread.
 *
 *   ① N-7 FAILS — THE INVENTORY READ SPLIT IS DECORATION. A member holding `inventory:read` and
 *      NOT `costs:read` reads `unit_cost` with one query: 14 costs returned in bulk. RLS is
 *      ROW-level; hiding a column needs a column-level GRANT or a narrowed view, and NEITHER
 *      EXISTS (`grep` over supabase/migrations finds no `GRANT SELECT (col)` and no view on
 *      business_inventory). The card predicted this exactly: "N-6 without N-7 proves nothing."
 *      This is the confidential-field wall not being a wall. Fix is a MIGRATION (David's call).
 *
 *   ② THE OVERSELL IS D-52 §R3's OWN UNRUN REMEDIATION, not a live defect — and the evidence is
 *      exact. "Shoal Creek Vitex" reads on-hand 29 / committed 61 across **16 order lines, EVERY
 *      ONE created before 2026-07-21**, which is D-52's ruling date and matches the decision
 *      doc's own count ("The 16 existing pending orders (recon R3)"). Those orders decremented
 *      on-hand under D-42 AND still hold commitment under D-52 — the double-count D-52 named and
 *      deferred: "Remediation is a one-time reconciliation of those orders at build time —
 *      scoped in the build, not this decision." IT WAS NEVER RUN.
 *      THE FORWARD PATH IS HEALTHY, checked not assumed: a SIBLING "Shoal Creek Vitex" lot whose
 *      commitments are all post-D-52 reads on-hand 38 / committed 8, and the oversell guard is
 *      live at `api/orders/submit.ts:371-375`. So this is a data backlog, not a broken rule.
 */

import { withMemberSession, requireBusinessId, makeHarness, adminClient } from '../lib/memberSession.mjs';

const { ok, done } = makeHarness();
const businessId = await requireBusinessId(process.env.RLS_BUSINESS_ID);
const admin = adminClient();

// D-52 / inventoryStates.holdsCommitment: commitment is held by every status EXCEPT these two.
// Derived by EXCLUSION on purpose — a NEW open status must default to holding stock (fail toward
// not overselling), so this mirrors the source rule rather than re-listing the open set.
const RELEASES_COMMITMENT = ['fulfilled', 'cancelled'];

console.log(`\n── I14 + I16/I17 · inventory read model · tenant ${businessId.slice(0, 8)} ──\n`);

// ════ DATA PRECONDITIONS ════
const costLots = ((await admin.from('business_inventory')
  .select('id,name,unit_cost,sell_price').eq('business_id', businessId)).data ?? [])
  .filter(r => r.unit_cost != null);

ok(costLots.length > 0,
  'PRECONDITION: at least one lot carries a real unit_cost — otherwise the read-split test is vacuous',
  `${costLots.length} lots with a non-null unit_cost`);

const allOrders = (await admin.from('orders').select('id,status').eq('business_id', businessId)).data ?? [];
const openOrderIds = new Set(allOrders.filter(o => !RELEASES_COMMITMENT.includes(o.status)).map(o => o.id));
const closedOrderIds = new Set(allOrders.filter(o => RELEASES_COMMITMENT.includes(o.status)).map(o => o.id));

ok(openOrderIds.size > 0,
  'PRECONDITION: the tenant has at least one OPEN order, so committed can be non-trivial',
  `${openOrderIds.size} open, ${closedOrderIds.size} released`);

await withMemberSession(
  { businessId, role: 'MANAGER', permissions: ['inventory:read', 'orders:read', 'order_items:read'], label: 'Harness MGR (read model)' },
  async ({ client }) => {
    // ════ I14 — AVAILABLE = ON-HAND − COMMITTED, committed from OPEN orders only ════
    console.log('=== I14 · available = on-hand − committed (D-52) ===');

    const lots = (await client.from('business_inventory').select('id,name,qty').eq('business_id', businessId)).data ?? [];
    const items = (await client.from('order_items')
      .select('quantity,business_inventory_id,orders!inner(id,status,business_id)')
      .eq('orders.business_id', businessId)).data ?? [];

    ok(lots.length > 0 && items.length > 0,
      'the member can read lots and order lines (real RLS — the derivation path the app uses)',
      `lots=${lots.length} lines=${items.length}`);

    const committed = new Map();
    let releasedUnits = 0;
    for (const it of items) {
      const status = it.orders?.status;
      const lotId = it.business_inventory_id;
      const q = Number(it.quantity ?? 0);
      if (!lotId || !Number.isFinite(q) || q <= 0) continue;
      if (RELEASES_COMMITMENT.includes(status)) { releasedUnits += q; continue; }
      committed.set(lotId, (committed.get(lotId) ?? 0) + q);
    }

    // THE RULE: available never goes negative, and it never exceeds on-hand.
    const qtyById = new Map(lots.map(l => [l.id, Number(l.qty ?? 0)]));
    const oversold = [];
    for (const [lotId, c] of committed) {
      const onHand = qtyById.get(lotId);
      if (onHand === undefined) continue;                  // lot not visible / deleted
      if (c > onHand) oversold.push({ lot: lots.find(l => l.id === lotId)?.name, onHand, committed: c });
    }
    ok(oversold.length === 0,
      '🔴 D-52: COMMITTED never exceeds ON-HAND — no lot is oversold',
      oversold.length === 0 ? `${committed.size} lots carry commitment`
        : `OVERSOLD: ${JSON.stringify(oversold.slice(0, 5))}`);

    const negatives = [...committed.entries()]
      .filter(([id, c]) => qtyById.has(id) && (qtyById.get(id) - c) < 0);
    ok(negatives.length === 0,
      'AVAILABLE (on-hand − committed) is non-negative on every committed lot',
      `${negatives.length} negative`);

    // THE OTHER HALF OF THE RULE, and the one a bug would actually break: a RELEASED order must
    // contribute NOTHING. D-52: fulfilled units physically left (counting them would subtract
    // twice); cancelled commitment was released and on-hand never moved.
    // Build the SAME map with the release rule REMOVED. If the two agree, the exclusion is doing
    // nothing and this half of D-52 is untested on this data; if they differ, the difference IS
    // the released commitment, and that is the number the rule is responsible for.
    //
    // (These two assertions replace a pair I wrote vacuously on the first draft — `ok(x || true)`
    //  and a predicate ending `&& false` — both unconditionally true. Caught on review the same
    //  hour STD-026 was written. Recorded rather than quietly fixed: see the self-catch tally.)
    const naive = new Map();
    for (const it of items) {
      const q = Number(it.quantity ?? 0);
      if (!it.business_inventory_id || !Number.isFinite(q) || q <= 0) continue;
      naive.set(it.business_inventory_id, (naive.get(it.business_inventory_id) ?? 0) + q);
    }
    const naiveTotal = [...naive.values()].reduce((a, b) => a + b, 0);
    const realTotal = [...committed.values()].reduce((a, b) => a + b, 0);

    ok(releasedUnits > 0,
      'PRECONDITION: released (fulfilled/cancelled) order lines EXIST, so the rule is exercisable',
      `${releasedUnits} units on released orders`);
    ok(naiveTotal - realTotal === releasedUnits,
      '🔴 D-52: a FULFILLED or CANCELLED order contributes ZERO committed — the release is what the rule does',
      `ignoring status would commit ${naiveTotal}; the rule commits ${realTotal}; difference ${naiveTotal - realTotal} == released ${releasedUnits}`);

    // ════ I16 / I17 — THE READ SPLIT, AT THE DATA LAYER ════
    console.log('\n=== I16/I17 · inventory:read WITHOUT costs:read — card N-7 ===');
    const probe = costLots[0];

    const r = await client.from('business_inventory')
      .select('id,name,sell_price,unit_cost').eq('id', probe.id).single();

    ok(r.error == null && r.data != null,
      'positive control: the member CAN read the lot (inventory:read is held)',
      r.error ? r.error.message : `row ${probe.name}`);
    ok(r.data?.sell_price != null,
      'N-6 "yes" half: SELL PRICE is readable — it is operational, not confidential',
      `sell_price=${r.data?.sell_price}`);

    // 🔴 THE ONE THAT MATTERS. RLS is ROW-level; hiding a column needs a column-level GRANT or a
    // narrowed view. If neither exists, the member reads unit_cost with one query and N-6 is decor.
    ok(r.data?.unit_cost == null,
      '🔴 N-7: UNIT COST is NOT reachable by a member without costs:read',
      r.data?.unit_cost == null
        ? 'no cost returned'
        : `LEAKED unit_cost=${r.data.unit_cost} for "${probe.name}" — the base table still grants SELECT on the column`);

    // Belt and braces: the same claim via a bulk select, which is how a curious member would do it.
    const bulk = await client.from('business_inventory').select('unit_cost').eq('business_id', businessId);
    const leaked = (bulk.data ?? []).filter(x => x.unit_cost != null);
    ok(bulk.error != null || leaked.length === 0,
      '🔴 N-7 (bulk): `select unit_cost from business_inventory` yields no costs',
      bulk.error ? `refused: ${bulk.error.message.slice(0, 60)}` : `${leaked.length} costs returned`);
  },
);

process.exit(done('I14 + I16/I17 · inventory read model'));
