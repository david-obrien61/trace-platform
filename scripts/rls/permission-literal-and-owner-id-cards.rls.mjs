#!/usr/bin/env node
// ============================================================
// permission-literal-and-owner-id-cards — CARDS 5, 6, 8 of the profile-save board, run by Thunder
// PURPOSE:      Those three cards were written DEVICE: desktop (terminal). David does not run
//               terminal commands (standing, since July). They are builder probes wearing an
//               owner-test card. This runs them; the board is converted to SQL-editor form
//               alongside. Per OP-14 and memberSession.mjs's own header, a harness run NEVER
//               marks a card `covered` — only David's live run does.
// DEPENDENCIES: scripts/lib/memberSession.mjs (ephemeral principal, ANON-key assertions)
// OUTPUTS:      printed verdicts per card; exit 1 if any expectation fails.
// TENANT:       Test Dave's Tree Nest ONLY. Never LAWNS (read-only by standing constraint).
// ============================================================
import { withMemberSession, adminClient } from '../lib/memberSession.mjs';

const TEST_DAVES = await (async () => {
  const { data } = await adminClient().from('businesses').select('id,name').eq('name', "Test Dave's Tree Nest").single();
  return data;
})();
console.log(`TENANT: ${TEST_DAVES.name} (${TEST_DAVES.id})\n`);

let fails = 0;
const check = (label, actual, expected) => {
  const ok = actual === expected;
  if (!ok) fails++;
  console.log(`   ${ok ? '✅' : '🔴'} ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
};

// ── CARD 5 — has_permission is LITERAL against a real authenticated principal ──────────
console.log('CARD 5 — the refusal, against an ephemeral principal holding ONLY inventory:read');
await withMemberSession(
  { businessId: TEST_DAVES.id, role: 'STAFF', permissions: ['inventory:read'], label: 'Card5 literal probe' },
  async ({ client }) => {
    const call = async (perm) => {
      const { data, error } = await client.rpc('has_permission', { p_business_id: TEST_DAVES.id, p_perm: perm });
      if (error) throw new Error(`has_permission(${perm}): ${error.message}`);
      return data;
    };
    check('inventory:read  (the one it holds)', await call('inventory:read'), true);
    check('costs:read', await call('costs:read'), false);
    check('pricing_recipe:update', await call('pricing_recipe:update'), false);
    check('view_costs  (THE LEGACY ALIAS — the whole point)', await call('view_costs'), false);
    check('manage_settings  (second legacy string)', await call('manage_settings'), false);
  },
);

// ── CARD 6 — the member WITH the string writes business_pricing_config ─────────────────
console.log('\nCARD 6 — the ephemeral principal holding pricing_recipe:update saves the config');
await withMemberSession(
  { businessId: TEST_DAVES.id, role: 'STAFF', permissions: ['pricing_recipe:read', 'pricing_recipe:update'], label: 'Card6 write probe' },
  async ({ client, admin }) => {
    const { data: before } = await admin.from('business_pricing_config').select('business_id,config').eq('business_id', TEST_DAVES.id).maybeSingle();
    if (!before) { console.log('   ⚠️  no business_pricing_config row for this tenant — UPDATE path not reachable; card inconclusive'); fails++; return; }
    check('the member can READ it (bpc_member_select)', (await client.from('business_pricing_config').select('business_id').eq('business_id', TEST_DAVES.id)).data?.length === 1, true);
    // Write a throwaway key, then put the original config back with the SERVICE key (setup/teardown only).
    const probe = { ...before.config, __harness_card6: new Date().toISOString() };
    const { data: wrote, error: wErr } = await client.from('business_pricing_config')
      .update({ config: probe }).eq('business_id', TEST_DAVES.id).select('business_id');
    check('UPDATE returns one row (bpc_member_update admits the string)', (wrote ?? []).length === 1, true);
    if (wErr) console.log(`      error: ${wErr.message}`);
    // 🔴 THE RESTORE REPORTS ITS OWN ROW COUNT (A8, #289). It used to fire and return nothing, so a
    // teardown that silently affected ZERO rows would have left the harness's probe key on a real
    // tenant's config with the run still printing green — the exact silent-success shape the
    // zero-row cap exists for, in the one statement whose whole job is to leave no residue.
    const { data: restoredRows } = await admin.from('business_pricing_config')
      .update({ config: before.config }).eq('business_id', TEST_DAVES.id).select('business_id');
    check('the restore itself affected one row', (restoredRows ?? []).length === 1, true);
    const { data: restored } = await admin.from('business_pricing_config').select('config').eq('business_id', TEST_DAVES.id).single();
    check('original config restored (no residue)', JSON.stringify(restored.config) === JSON.stringify(before.config), true);
  },
);

// ── CARD 8 — nursery_profiles refuses an OWNER-ROLE member who is not businesses.owner_id ──
console.log('\nCARD 8 — nursery_profiles: an OWNER-ROLE member who is not the account holder (#236)');
await withMemberSession(
  { businessId: TEST_DAVES.id, role: 'OWNER', permissions: ['settings:read', 'settings:update'], label: 'Card8 owner-role probe' },
  async ({ client, admin }) => {
    const { data: ownerRow } = await admin.from('businesses').select('owner_id').eq('id', TEST_DAVES.id).single();
    console.log(`   (businesses.owner_id = ${ownerRow.owner_id ?? 'NULL'} — the probe principal is NOT it)`);
    const { data, error } = await client.from('nursery_profiles')
      .upsert({ business_id: TEST_DAVES.id, default_install_price: 225 }, { onConflict: 'business_id' })
      .select('business_id');
    const refused = !!error || (data ?? []).length === 0;
    check('the install-price save is REFUSED (confirms #236)', refused, true);
    console.log(`      ${error ? `refusal: ${error.code} ${error.message}` : `rows returned: ${(data ?? []).length}`}`);
    if (!refused) console.log('   🔴 IT SUCCEEDED — my reading of the policy is wrong and #236 must be WITHDRAWN.');
  },
);

// ── CARD 12 — 🔴 THE FALSE EMPTY, PROVEN FROM THE READ SIDE (#236 / #289) ──────────────
// Card 8 proves the WRITE is refused. This proves the READ returns ZERO ROWS WHILE A ROW EXISTS —
// which is the worse half, because a refusal at least says something and a false empty renders as
// "not set". The row is SEEDED by the service key first, so a zero-row result cannot be confused
// with an empty table (#182: a probe that cannot reach its target reports the same as one that
// passed). Mint-and-delete, on Test Dave's, never LAWNS.
console.log('\nCARD 12 — nursery_profiles: the read is a FALSE EMPTY, not a refusal (#236)');
await withMemberSession(
  { businessId: TEST_DAVES.id, role: 'OWNER', permissions: ['settings:read', 'settings:update'], label: 'Card12 read probe' },
  async ({ client, admin }) => {
    const { data: pre } = await admin.from('nursery_profiles').select('id').eq('business_id', TEST_DAVES.id);
    const seeded = (pre ?? []).length === 0;
    if (seeded) {
      const { data: made, error } = await admin.from('nursery_profiles')
        .insert({ business_id: TEST_DAVES.id, default_install_price: 225 }).select('id');
      check('SETUP — the service key seeded exactly one row (so a zero-row read means REFUSED, not EMPTY)',
        (made ?? []).length === 1, true);
      if (error) console.log(`      seed error: ${error.message}`);
    } else {
      console.log(`   (a row already existed for this tenant — not seeding, not deleting)`);
    }
    const { data: admin_sees } = await admin.from('nursery_profiles').select('id').eq('business_id', TEST_DAVES.id);
    check('the row DOES exist (service key, bypassing RLS)', (admin_sees ?? []).length === 1, true);

    const { data: member_sees, error: rErr } = await client.from('nursery_profiles')
      .select('id, default_install_price').eq('business_id', TEST_DAVES.id);
    console.log(`      member read → rows=${(member_sees ?? []).length}  error=${rErr ? rErr.message : 'none'}`);
    // 🔴 THE EXPECTATION IS STATED FOR BOTH WORLDS, and which one applies is decided by the
    // MIGRATION, not by the result. BEFORE 20260910b: 0 rows and NO error — the false empty.
    // AFTER: 1 row. Set OWNER_ID_REPOINT_APPLIED=1 once David has applied it and this card flips
    // to asserting the fix instead of the defect.
    const applied = process.env.OWNER_ID_REPOINT_APPLIED === '1';
    if (applied) {
      check('AFTER 20260910b — the OWNER-ROLE member READS the row via settings:read', (member_sees ?? []).length === 1, true);
    } else {
      check('BEFORE 20260910b — the read is a SILENT ZERO (no error, no row) = the false empty', (member_sees ?? []).length === 0 && !rErr, true);
    }
    if (seeded) {
      // TEARDOWN REPORTS ITS OWN ROW COUNT (A8). A delete that silently affects zero rows leaves
      // the harness's seeded row on a real tenant with the run still printing green.
      const { data: gone } = await admin.from('nursery_profiles')
        .delete().eq('business_id', TEST_DAVES.id).select('id');
      check('TEARDOWN — the seeded row was deleted (no residue)', (gone ?? []).length === 1, true);
    }
  },
);

console.log(`\n${fails === 0 ? '✅ EVERY CARD IN THIS FILE BEHAVED AS THE BOARD PREDICTS' : `🔴 ${fails} EXPECTATION(S) FAILED`}`);
console.log('⚠️  BUILDER VERIFICATION ONLY — no card is marked `covered` by this run (OP-14).');
process.exit(fails === 0 ? 0 : 1);
