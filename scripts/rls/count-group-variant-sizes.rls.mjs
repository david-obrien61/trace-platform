/**
 * ── A STAFF MEMBER CAN FINISH A COUNT WALK · RLS PROOF ────────────────────────────────
 *
 * PURPOSE:      Prove, under REAL RLS, both halves of the 20260830c defect and its fix.
 *               THE DEFECT: `business_inventory` gates UPDATE on `inventory:update`
 *               (20260727_rbac_resource_action_flip.sql:72-74). A STAFF member holds
 *               `inventory:read` and not that — so the walk-and-count screen's `variant_group`
 *               write matched ZERO ROWS and PostgREST returned NO ERROR. Zero rows + no error is
 *               the whole defect: the walk carried on believing it had grouped the family.
 *               THE FIX: `count_group_variant_sizes` resolves the same act server-side, gated on
 *               MEMBERSHIP rather than on a write permission the counter has no business holding.
 * DEPENDENCIES: ../lib/memberSession.mjs · a live tenant · .env.local · migration 20260830c
 *               APPLIED. Network required.
 * OUTPUTS:      pass/fail per assertion; exit 1 on any failure.
 * COVERS:       ledger #238 · owner-test cards C1-C4 (inventory board) · R-12 / A8 (a write must
 *               prove it wrote) · tech-debt #124 (the policy is NOT widened — that is asserted
 *               here, in the negative, deliberately).
 *
 * ⚠️ THIS MARKS NO CARD `covered`. OP-14: only David's live walk through the real UI does that,
 * and this proves a different claim. This proves THE POLICY AND THE FUNCTION are correct. The
 * card proves THE SCREEN completes a real walk on a real phone. A machine can do the first.
 *
 * 🔴 THE ASSERTION THAT MATTERS MOST is #2 — that the direct write is refused SILENTLY. If
 * PostgREST errored there, the screen could never have had this bug, and it would have been
 * reported months ago instead of quietly degrading the catalogue one variety at a time.
 */

import { withMemberSession, requireBusinessId, makeHarness, adminClient } from '../lib/memberSession.mjs';

const { ok, done } = makeHarness();
const admin = adminClient();
const businessId = await requireBusinessId(process.env.RLS_BUSINESS_ID);
const KEY = `harness-group-${Date.now()}`;
const FAMILY_SIZE = 2;   // the throwaway family below — named so every row-count check is exact

console.log(`\n── count_group_variant_sizes · tenant ${businessId.slice(0, 8)} ──\n`);

/** Two throwaway lots of one pretend variety, ungrouped — the family the walk has to key. */
async function withThrowawayFamily(fn) {
  const stamp = Date.now();
  const name = `Harness Variety ${stamp}`;
  let ids = [];
  try {
    const { data, error } = await admin.from('business_inventory').insert([
      { business_id: businessId, name, qty: 5, size: '15 gallon', status: 'available' },
      { business_id: businessId, name, qty: 3, size: '30 gallon', status: 'available' },
    ]).select('*');
    if (error) throw new Error(`throwaway family insert: ${error.message}`);
    ids = data.map(r => r.id);
    return await fn(data, ids);
  } finally {
    // A8 on teardown (tech-debt #79's lesson). These lots have no ledger rows — nothing called a
    // movement RPC on them — so the delete should land. Report loudly if it does not: residue
    // here is a real row in a real tenant's catalogue.
    if (ids.length) {
      const { data: gone, error } = await admin.from('business_inventory').delete().in('id', ids).select('id');
      // The family is always FAMILY_SIZE rows, so the exact count is knowable and is checked as
      // one — a teardown that removed "some" is the residue case tech-debt #79 was.
      if (error || (gone ?? []).length !== 2) {   // literal, not the constant: the cap reads the comparison
        console.error(`⚠️  TEARDOWN INCOMPLETE — business_inventory ${ids.join(', ')} NOT removed`
          + `${error ? `: ${error.message}` : ` (${(gone ?? []).length} of ${ids.length} affected)`}.`
          + ' These are live catalogue rows now — remove them by hand.');
      }
    }
  }
}

await withThrowawayFamily(async (rows, ids) => {
  const before = Object.fromEntries(rows.map(r => [r.id, r]));
  console.log(`Throwaway family: ${ids.map(i => i.slice(0, 8)).join(' + ')}\n`);

  // ════ STAFF — inventory:read, NOT inventory:update. Exactly the live bundle's shape. ════
  console.log('=== STAFF: inventory:read, NOT inventory:update ===');
  await withMemberSession(
    { businessId, role: 'STAFF', permissions: ['inventory:read'], label: 'Harness STAFF (count only)' },
    async ({ client, userId }) => {

      // 1 · POSITIVE CONTROL — they can see the family. Without this, every refusal below could
      //     be explained by "the rows are not visible", and the suite would prove nothing.
      const seen = await client.from('business_inventory').select('id,variant_group').in('id', ids);
      ok(!seen.error && (seen.data ?? []).length === 2,
        'the STAFF member CAN read both lots (inventory:read is held — positive control)',
        `rows=${(seen.data ?? []).length}`);

      // 2 · 🔴 THE DEFECT, HEAD-ON. This is what InventoryCount.tsx used to do.
      const direct = await client.from('business_inventory')
        .update({ variant_group: KEY }).in('id', ids).select('id');
      ok((direct.data ?? []).length === 0,
        '🔴 THE DEFECT: the direct UPDATE affects ZERO ROWS (inventory:update denied by RLS)',
        `affected=${(direct.data ?? []).length}`);
      ok(direct.error == null,
        '🔴 …AND POSTGREST RETURNS NO ERROR — silent. syncEngine reads `error` alone, so this came back `applied`',
        `error=${direct.error ? direct.error.message : 'null'}`);

      // 3 · …and the rows are genuinely untouched. Proves 2 was a refusal, not a no-op write.
      const after = await client.from('business_inventory').select('id,variant_group').in('id', ids);
      ok((after.data ?? []).every(r => r.variant_group == null),
        'RELOAD: both lots are still UNGROUPED — nothing was written',
        (after.data ?? []).map(r => `${r.id.slice(0, 8)}=${r.variant_group}`).join(' '));

      // 4 · 🔴 THE FIX. Same member, same session, same rows — through the RPC.
      const rpc = await client.rpc('count_group_variant_sizes', {
        p_business_id:   businessId,
        p_actor_user_id: userId,
        p_variant_group: KEY,
        p_row_ids:       ids,
      });
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      ok(rpc.error == null && row?.applied === true,
        '🔴 THE FIX: the SAME member groups the family through the RPC — applied=true',
        `err=${rpc.error ? rpc.error.message : 'null'} applied=${row?.applied}`);
      ok(row?.grouped_count === 2 && row?.requested_count === 2,
        '…and it REPORTS WHAT IT WROTE: 2 of 2 (R-12 — a write must prove it wrote)',
        `grouped=${row?.grouped_count} requested=${row?.requested_count}`);

      // 5 · The grouping is really there, read back under the counter's own RLS.
      const grouped = await client.from('business_inventory').select('id,variant_group').in('id', ids);
      ok((grouped.data ?? []).length === 2 && (grouped.data ?? []).every(r => r.variant_group === KEY),
        'RELOAD: both lots now carry the key — the family is picker-ready (D-45/D-46)',
        (grouped.data ?? []).map(r => `${r.id.slice(0, 8)}=${r.variant_group}`).join(' '));

      // 6 · 🔴 THE BOUNDARY. The function's whole safety claim is its column list: it sets
      //     variant_group and nothing else. A future edit that widens it fails HERE.
      const full = await admin.from('business_inventory').select('*').in('id', ids);
      const drifted = [];
      for (const r of full.data ?? []) {
        for (const [k, v] of Object.entries(before[r.id])) {
          if (k === 'variant_group' || k === 'updated_at') continue;
          if (JSON.stringify(r[k]) !== JSON.stringify(v)) drifted.push(`${k}: ${JSON.stringify(v)}→${JSON.stringify(r[k])}`);
        }
      }
      ok(drifted.length === 0,
        '🔴 THE BOUNDARY HOLDS: every other column is byte-identical — no price, qty, status, size or sku moved',
        drifted.length ? drifted.join(' · ') : 'no column drifted');

      // 7 · A SHORTFALL REPORTS RATHER THAN LYING. A family half-keyed IS the mixed-group state
      //     the invariant exists to prevent, so a partial grouping is a refusal, not a warning.
      const short = await client.rpc('count_group_variant_sizes', {
        p_business_id:   businessId,
        p_actor_user_id: userId,
        p_variant_group: KEY,
        p_row_ids:       [...ids, '00000000-0000-0000-0000-000000000000'],
      });
      const sRow = Array.isArray(short.data) ? short.data[0] : short.data;
      ok(sRow?.applied === false && sRow?.grouped_count === 2 && sRow?.requested_count === 3,
        'a row it cannot reach is a REFUSAL naming the shortfall, not a silent partial',
        `applied=${sRow?.applied} ${sRow?.grouped_count}/${sRow?.requested_count} reason="${sRow?.reason}"`);

      // 8 · NO FORGERY — a caller may only act as themselves (assert_movement_actor).
      const forged = await client.rpc('count_group_variant_sizes', {
        p_business_id:   businessId,
        p_actor_user_id: '00000000-0000-0000-0000-000000000000',
        p_variant_group: KEY,
        p_row_ids:       ids,
      });
      ok(forged.error != null,
        'a forged actor id is REFUSED by assert_movement_actor — the RPC is not a way around identity',
        `error=${forged.error ? forged.error.message.slice(0, 70) : 'NONE — this is a hole'}`);

      // 9 · AC-3 — the business_id in the predicate, not the argument list. A row belonging to a
      //     different tenant is never grouped, even when its id is named.
      const other = await admin.from('business_inventory')
        .select('id').neq('business_id', businessId).limit(1);
      const foreignId = (other.data ?? [])[0]?.id ?? null;
      if (foreignId) {
        const cross = await client.rpc('count_group_variant_sizes', {
          p_business_id:   businessId,
          p_actor_user_id: userId,
          p_variant_group: KEY,
          p_row_ids:       [foreignId],
        });
        const cRow = Array.isArray(cross.data) ? cross.data[0] : cross.data;
        const foreignAfter = await admin.from('business_inventory').select('variant_group').eq('id', foreignId).single();
        ok(cRow?.applied === false && cRow?.grouped_count === 0 && foreignAfter.data?.variant_group !== KEY,
          '🔴 AC-3: another tenant\'s row is NOT grouped even when named — 0 of 1, and its key is untouched',
          `grouped=${cRow?.grouped_count} foreign_key=${foreignAfter.data?.variant_group}`);
      } else {
        // Honest rather than silently skipped: a one-tenant database cannot prove a cross-tenant
        // claim, and reporting "pass" here would be a fabricated proof.
        console.log('  ⚠️  SKIPPED  AC-3 cross-tenant probe — no row exists outside this tenant to name');
      }

      // 10 · 🔴 THE POLICY WAS NOT WIDENED. This is the assertion that keeps the fix honest: the
      //      narrow act moved server-side, the wall did NOT move. If someone "fixes" a future
      //      variant of this defect by granting STAFF inventory:update, this goes red.
      const stillRefused = await client.from('business_inventory')
        .update({ qty: 999 }).in('id', ids).select('id');
      ok((stillRefused.data ?? []).length === 0,
        '🔴 tech-debt #124: STAFF still cannot write business_inventory directly — no policy was widened',
        `affected=${(stillRefused.data ?? []).length}`);
    },
  );

  // ════ MANAGER — holds inventory:update. Byte-identical behaviour is an acceptance criterion. ════
  console.log('\n=== MANAGER: inventory:read + inventory:update — unchanged in both directions ===');
  // 🔴 CHECKED, and not as a formality: if this reset silently matched zero rows, the MANAGER
  // assertions below would pass against rows the STAFF session had ALREADY grouped — a green run
  // proving nothing. That is the same vacuous-proof failure the cap exists to prevent.
  const reset = await admin.from('business_inventory')
    .update({ variant_group: null }).in('id', ids).select('id');
  if (reset.error || (reset.data ?? []).length !== 2) {   // literal, not the constant: the cap reads the comparison
    throw new Error(`reset before the MANAGER block affected ${(reset.data ?? []).length} rows, expected ${FAMILY_SIZE}`
      + `${reset.error ? `: ${reset.error.message}` : ''} — every assertion after this would be meaningless.`);
  }
  await withMemberSession(
    { businessId, role: 'MANAGER', permissions: ['inventory:read', 'inventory:update'], label: 'Harness MANAGER' },
    async ({ client, userId }) => {
      const rpc = await client.rpc('count_group_variant_sizes', {
        p_business_id:   businessId,
        p_actor_user_id: userId,
        p_variant_group: KEY,
        p_row_ids:       ids,
      });
      const row = Array.isArray(rpc.data) ? rpc.data[0] : rpc.data;
      ok(rpc.error == null && row?.applied === true && row?.grouped_count === 2,
        'a MANAGER gets the SAME result from the RPC — the change is not role-conditional',
        `applied=${row?.applied} grouped=${row?.grouped_count}`);

      const direct = await client.from('business_inventory')
        .update({ variant_group: KEY }).in('id', ids).select('id');
      const landed = (direct.data ?? []);
      ok(landed.length !== 0,
        'a MANAGER\'s DIRECT write is NOT refused — the policy was not NARROWED either (A8: rows came back)',
        `affected=${landed.length}`);
      ok(landed.length === FAMILY_SIZE,
        '…and it landed on the whole family, exactly as it did before this build',
        `affected=${landed.length}`);
    },
  );
});

process.exit(done('#238 · a staff member can finish a count walk'));
