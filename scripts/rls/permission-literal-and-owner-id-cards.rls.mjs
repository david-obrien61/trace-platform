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
    check('UPDATE returns one row (bpc_member_update admits the string)', (wrote ?? []).length, 1);
    if (wErr) console.log(`      error: ${wErr.message}`);
    await admin.from('business_pricing_config').update({ config: before.config }).eq('business_id', TEST_DAVES.id);
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

console.log(`\n${fails === 0 ? '✅ ALL THREE CARDS BEHAVED AS THE BOARD PREDICTS' : `🔴 ${fails} EXPECTATION(S) FAILED`}`);
console.log('⚠️  BUILDER VERIFICATION ONLY — no card is marked `covered` by this run (OP-14).');
process.exit(fails === 0 ? 0 : 1);
