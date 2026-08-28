/**
 * ── I10 — replay(ledger) === business_inventory.qty · THE D-50 INVARIANT ──────────────
 *
 * CAPABILITY ASSERTED (STD-025 — a test asserts a CAPABILITY, never a CONFIGURATION):
 *   The platform CANNOT move an inventory quantity without recording the movement, and the
 *   ledger therefore reconstructs on-hand exactly. This is a property of the write paths and the
 *   database's own guarantees — NOT a claim about how many lots LAWNS has, what any lot's qty is,
 *   or what the demo tenant contains. Seed data may change freely; every assertion below stays
 *   true. The one count that appears (`lots checked`) is reported, never asserted.
 *
 * PURPOSE:      D-50's disagreement 1: "Replay vs on-hand must be ZERO, BY CONSTRUCTION. These
 *               state the same fact; same-transaction emission makes a gap structurally
 *               impossible. Any gap here is a BUG, not shrinkage — and it is the WORST FAILURE
 *               MODE BECAUSE IT LOOKS FINE, so it must be PREVENTED, not monitored."
 *               Nothing guarded it until now. It is the highest-provenance untested invariant on
 *               the 2026-07-30 test inventory (row I10).
 * DEPENDENCIES: ../lib/memberSession.mjs · a live tenant · .env.local. Network required.
 * OUTPUTS:      pass/fail per assertion; exit 1 on any failure.
 * COVERS:       I10 · I11 (no qty moves without a ledger row) · I12 (immutable AT THE DATABASE)
 *               · part of O6/K10 (D-52: commitment does not change on-hand).
 *
 * WHY THIS READS UNDER A MEMBER SESSION AND NOT THE SERVICE KEY: the ledger's whole integrity
 * claim is that the number a USER can see reconstructs the number a USER is shown. A service-key
 * read bypasses RLS and would prove the data is consistent for someone who can see everything —
 * a weaker and different claim. The member here holds membership only; the ledger's policies gate
 * on `is_active_member`, so this is the real read path.
 *
 * ⚠️ NOT AN OWNER-TEST. No card flips on this (OP-14).
 */

import {
  withMemberSession, requireBusinessId, makeHarness, adminClient,
} from '../lib/memberSession.mjs';

const { ok, done } = makeHarness();
const businessId = await requireBusinessId(process.env.RLS_BUSINESS_ID);
const admin = adminClient();

console.log(`\n── I10 · ledger replay === on-hand · tenant ${businessId.slice(0, 8)} ──\n`);

// ════ ONE STABLE LOT, REUSED — NOT a throwaway, and the reason is a platform finding ════
//
// 🔴 A LOT THAT HAS ANY LEDGER ROW CAN NEVER BE HARD-DELETED. Found by this test on 2026-07-30,
// the first thing that ever exercised it. `business_inventory_ledger.inventory_id` is
// `ON DELETE SET NULL`, and SET NULL is an UPDATE on the ledger row — which the immutability
// trigger refuses unconditionally (`BEFORE UPDATE OR DELETE ... RAISE EXCEPTION`, and UPDATE is
// revoked from service_role too). So `DELETE FROM business_inventory` fails with
// "business_inventory_ledger is append-only" for any lot with history.
//
// That is NOT a defect in normal operation — §7e rules that a lot is tombstoned, never hard
// deleted — but the schema comment on that column claims SET NULL is "the belt for the rare true
// removal … the movement fact survives even when its lot does not." THAT BELT DOES NOT EXIST, and
// the same reasoning says a `businesses` cascade would fail too. Recorded as a finding.
//
// CONSEQUENCE FOR THIS TEST: mint-and-delete is IMPOSSIBLE here (unlike the customer test, where
// it is the rule). Creating a fresh lot per run would accumulate undeletable rows forever. So the
// harness FINDS-OR-CREATES one stable lot and re-adjusts it. This is strictly better anyway: the
// lot grows a long history, so the invariant is proven over an accumulating ledger rather than a
// two-row one — which is closer to what a real lot looks like.
const HARNESS_LOT = '__harness_replay_lot';
let lotId = null;

try {
  const existing = await admin.from('business_inventory')
    .select('id').eq('business_id', businessId).eq('name', HARNESS_LOT).maybeSingle();
  if (existing.data) {
    lotId = existing.data.id;
  } else {
    const { data: lot, error: lotErr } = await admin.from('business_inventory')
      .insert({ business_id: businessId, name: HARNESS_LOT, size: '15 gal', qty: 0 })
      .select('id').single();
    if (lotErr) throw new Error(`harness lot insert: ${lotErr.message}`);
    lotId = lot.id;
  }

  await withMemberSession(
    { businessId, role: 'STAFF', permissions: ['inventory:read'], label: 'Harness STAFF (ledger)' },
    async ({ client, userId }) => {
      // ════ 1. THE INVARIANT, over every lot the member can actually see. ════
      const { data: lots, error: lErr } = await client
        .from('business_inventory').select('id,name,size,qty').eq('business_id', businessId);
      const { data: rows, error: rErr } = await client
        .from('business_inventory_ledger').select('inventory_id,delta,kind').eq('business_id', businessId);

      ok(!lErr && !rErr && (lots ?? []).length > 0 && (rows ?? []).length > 0,
        'the member can READ both the lots and the ledger (real RLS — the actual read path)',
        `lots=${(lots ?? []).length} ledger=${(rows ?? []).length}`);

      const replay = new Map();
      for (const r of rows ?? []) {
        if (!r.inventory_id) continue;
        replay.set(r.inventory_id, (replay.get(r.inventory_id) ?? 0) + r.delta);
      }

      const drift = [];
      const unreplayable = [];
      for (const l of lots ?? []) {
        if (l.id === lotId) continue;            // the throwaway is handled in part 3
        if (!replay.has(l.id)) { unreplayable.push(l); continue; }
        if (replay.get(l.id) !== (l.qty ?? 0)) {
          drift.push({ name: l.name, size: l.size, qty: l.qty, replay: replay.get(l.id) });
        }
      }

      ok(drift.length === 0,
        '🔴 THE D-50 INVARIANT: SUM(ledger.delta) === business_inventory.qty on EVERY lot',
        drift.length === 0
          ? `${(lots ?? []).length - 1} lots checked, 0 drift`
          : `DRIFT on ${drift.length}: ${JSON.stringify(drift.slice(0, 5))}`);

      ok(unreplayable.length === 0,
        'I11: no lot exists WITHOUT a ledger row — a lot with a qty and no history is unreplayable',
        unreplayable.length === 0 ? 'all lots have history'
          : `${unreplayable.length} unreplayable: ${unreplayable.slice(0, 5).map((l) => l.name).join(', ')}`);

      // ════ 2. D-52 — COMMITMENT DOES NOT MOVE ON-HAND. ════
      // Checkout/commit/cancel are lifecycle events; the physical movement rides `sale`.
      // Asserted as a RULE over whatever rows exist, not as a count of them.
      // 🔴 `order_confirmed` STAYS, AND `order_invoiced` IS ADDED — BOTH, not a swap.
      // R-STATUS was ratified 2026-08-28 (`confirmed` → `invoiced`), so every event written from
      // that day forward is `order_invoiced`. But the ledger is APPEND-ONLY and is not rewritten:
      // one historical `order_confirmed` row is live and stays live. Replacing the string instead
      // of adding to it would make that row unrecognised — and an unrecognised lifecycle row is
      // one this invariant stops checking, which is the silent direction of failure.
      const COMMITMENT_KINDS = ['order_created', 'order_committed', 'order_confirmed',
                                'order_invoiced', 'order_cancelled', 'order_deleted',
                                'order_fulfilled'];
      const commitment = (rows ?? []).filter((r) => COMMITMENT_KINDS.includes(r.kind));
      const nonZero = commitment.filter((r) => r.delta !== 0);
      ok(nonZero.length === 0,
        'D-52: every ORDER-LIFECYCLE ledger row carries delta 0 — commitment never moves on-hand',
        `${commitment.length} lifecycle rows, ${nonZero.length} with a non-zero delta`);

      // ════ 3. BY CONSTRUCTION — a sanctioned qty change EMITS, and the invariant survives it. ════
      // This is the half that makes it "prevented, not monitored": part 1 could pass on a
      // coincidentally-consistent database, but a live movement that keeps it consistent cannot.
      console.log('\n=== a real movement through the sanctioned RPC ===');
      // The TARGET is derived from current state, never a literal — the lot is reused across runs,
      // so "qty is 7" would be a CONFIGURATION claim that breaks on the second run (STD-025). What
      // is asserted is the RULE: whatever the qty becomes, replay equals it, and a row was emitted.
      const before = (await client.from('business_inventory').select('qty').eq('id', lotId).single()).data?.qty ?? 0;
      const ledBefore = ((await client.from('business_inventory_ledger').select('delta').eq('inventory_id', lotId)).data ?? []).length;
      const targetQty = before + 3;

      const { error: rpcErr } = await admin.rpc('adjust_inventory_manual', {
        p_lot_id: lotId,
        p_business_id: businessId,
        p_new_qty: targetQty,
        p_actor_user_id: userId,
        p_reason: 'harness: I10 by-construction probe',
        p_kind: 'adjust',
      });
      ok(!rpcErr, 'adjust_inventory_manual applied a qty change', rpcErr ? rpcErr.message : 'ok');

      const after = await client.from('business_inventory').select('qty').eq('id', lotId).single();
      const led = await client.from('business_inventory_ledger').select('delta,kind,actor_user_id').eq('inventory_id', lotId);
      const sum = (led.data ?? []).reduce((s, r) => s + r.delta, 0);

      ok((led.data ?? []).length === ledBefore + 1,
        'the qty change EMITTED EXACTLY ONE ledger row (I11 — no silent write, no double-write)',
        `rows ${ledBefore} → ${(led.data ?? []).length}`);
      ok(after.data?.qty === targetQty,
        'on-hand moved to the requested quantity',
        `${before} → ${after.data?.qty} (asked ${targetQty})`);
      ok(sum === after.data?.qty,
        '🔴 the invariant HOLDS ACROSS THE MOVEMENT — replay still equals on-hand',
        `replay=${sum} qty=${after.data?.qty}`);
      ok((led.data ?? []).some((r) => r.actor_user_id === userId),
        'D-50: the ledger row carries the REAL actor, not the service key and not a defaulted owner');

      // ════ 4. IMMUTABILITY AT THE DATABASE (D-50 / D-51 / I12). ════
      // "Immutability is a DB guarantee, not an app convention." Proven from a client session.
      console.log('\n=== immutability — the ledger refuses its own mutation ===');
      const target = (await client.from('business_inventory_ledger').select('id').eq('inventory_id', lotId).limit(1)).data?.[0];

      const upd = await client.from('business_inventory_ledger').update({ delta: 999 }).eq('id', target.id).select('id');
      ok(upd.error != null || (upd.data ?? []).length === 0,
        'I12: a member UPDATE on a ledger row does NOT take effect',
        upd.error ? `refused: ${upd.error.message.slice(0, 60)}` : `affected=${(upd.data ?? []).length}`);

      const del = await client.from('business_inventory_ledger').delete().eq('id', target.id).select('id');
      ok(del.error != null || (del.data ?? []).length === 0,
        'I12: a member DELETE on a ledger row does NOT take effect',
        del.error ? `refused: ${del.error.message.slice(0, 60)}` : `affected=${(del.data ?? []).length}`);

      const stillThere = await client.from('business_inventory_ledger').select('delta').eq('id', target.id).single();
      ok(stillThere.data != null && stillThere.data.delta !== 999,
        'the row survives both attempts with its ORIGINAL delta — history cannot be rewritten',
        `delta=${stillThere.data?.delta}`);

      // ════ 5. NO BARE EMIT FROM A CLIENT. ════
      // The migration's own words: "a client that could emit a bare movement could write a delta
      // with no matching qty change — precisely the divergence D-50 exists to make impossible."
      const bare = await client.rpc('emit_inventory_movement', {
        p_business_id: businessId, p_inventory_id: lotId, p_delta: 500, p_kind: 'adjust',
      });
      ok(bare.error != null,
        '🔴 a client CANNOT call emit_inventory_movement — a bare delta with no qty change is impossible',
        bare.error ? `refused: ${bare.error.message.slice(0, 70)}` : 'NOT REFUSED — the divergence door is open');

      const finalSum = ((await client.from('business_inventory_ledger').select('delta').eq('inventory_id', lotId)).data ?? [])
        .reduce((s, r) => s + r.delta, 0);
      const finalQty = (await client.from('business_inventory').select('qty').eq('id', lotId).single()).data?.qty;
      ok(finalSum === finalQty,
        'after every refused mutation and refused emit, replay STILL equals on-hand',
        `replay=${finalSum} qty=${finalQty}`);
    },
  );
} finally {
  // NO TEARDOWN, DELIBERATELY — see the header block above. The lot cannot be deleted once it
  // holds ledger rows, and it must not be: it stays permanently INSIDE the invariant, because
  // every change to it goes through the sanctioned RPC. Reusing it is what makes that true.
  //
  // ⚠️ The earlier version of this file DID attempt `delete()` here and DID NOT CHECK ITS ERROR,
  // so four undeletable lots accumulated silently across runs — including one carrying planted
  // drift from the mutation probe, which then failed the invariant on the NEXT run and looked
  // like a real defect. Repaired the way D-50 prescribes: a correcting ledger row, never an edit
  // ("a correction is a NEW row"), then tombstoned through soft_delete_inventory.
  // THE LESSON, which is the same one this whole test asserts: an unchecked write is a write you
  // did not do. A8 applies to teardown too.
  console.log(`\n(stable harness lot ${String(lotId).slice(0, 8)} retained — it cannot be deleted, and it stays consistent)`);
}

process.exit(done('I10 · ledger replay === on-hand'));
