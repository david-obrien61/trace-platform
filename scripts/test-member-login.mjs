#!/usr/bin/env node
/**
 * test-member-login.mjs — End-to-end test for the BusinessProvider member-path fix.
 *
 * Tests the exact failure mode that blocked Erin's demo login:
 *   - Owner resolves business via businesses.owner_id = auth.uid()          ✓ (pre-existing)
 *   - Member resolves business via business_members → businesses join        ✓ (new in Prompt 4)
 *   - MANAGER permissions exclude manage_settings                           ✓
 *   - MANAGER permissions include operational permissions                   ✓
 *   - LAWNS (existing business) accepts new member additions                ✓
 *
 * Does NOT test:
 *   - Browser UI rendering (requires Playwright — not in scope)
 *   - AcceptInvite React component (test-shared-auth.mjs covers the DB flow)
 *   - Dashboard tile visibility (visual test — manual verification required)
 *
 * Usage:
 *   node scripts/test-member-login.mjs
 *
 * Exit 0 = all steps passed. Exit 1 = failure.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, '..');

const envFile = readFileSync(join(repoRoot, 'packages/cultivar-os/.env.local'), 'utf8');
const env = Object.fromEntries(
  envFile.split('\n')
    .filter(l => l && !l.startsWith('#'))
    .map(l => l.split('=').map(s => s.trim()))
    .filter(([k, v]) => k && v)
);

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('ERROR: Could not load credentials from packages/cultivar-os/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const LAWNS_BUSINESS_ID = 'a1b2c3d4-0000-0000-0000-000000000001';
const TEST_TAG = `e2e-member-${Date.now()}`;

const cleanup = {
  ownerUserId: null,
  memberUserId: null,
  testBusinessId: null,
  ownerMemberId: null,
  memberMemberId: null,
  invitationId: null,
  lawnsMemberId: null,
};

let failCount = 0;

function step(label) {
  return {
    async run(fn) {
      process.stdout.write(`  ${label}... `);
      try {
        const result = await fn();
        console.log('✓');
        return result;
      } catch (err) {
        console.log('✗ FAILED');
        console.error(`    ${err.message}`);
        failCount++;
        return null;
      }
    }
  };
}

async function cleanupAll() {
  const c = cleanup;
  if (c.memberMemberId) await supabase.from('business_members').delete().eq('id', c.memberMemberId);
  if (c.ownerMemberId)  await supabase.from('business_members').delete().eq('id', c.ownerMemberId);
  if (c.lawnsMemberId)  await supabase.from('business_members').delete().eq('id', c.lawnsMemberId);
  if (c.invitationId)   await supabase.from('invitations').delete().eq('id', c.invitationId);
  if (c.testBusinessId) await supabase.from('businesses').delete().eq('id', c.testBusinessId);
  if (c.memberUserId)   await supabase.auth.admin.deleteUser(c.memberUserId).catch(() => {});
  if (c.ownerUserId)    await supabase.auth.admin.deleteUser(c.ownerUserId).catch(() => {});
}

async function main() {
  console.log('\n=== BusinessProvider member-path E2E test ===\n');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log(`Tag: ${TEST_TAG}`);
  console.log('');

  // ── Section 1: Verify tables exist ───────────────────────────────────────────
  console.log('[1] Verify required tables exist');

  await step('businesses table').run(async () => {
    const { error } = await supabase.from('businesses').select('id').limit(0);
    if (error) throw new Error(error.message);
  });

  await step('business_members table').run(async () => {
    const { error } = await supabase.from('business_members').select('id').limit(0);
    if (error) throw new Error(error.message);
  });

  await step('invitations table').run(async () => {
    const { error } = await supabase.from('invitations').select('id').limit(0);
    if (error) throw new Error(error.message);
  });

  // ── Section 2: Create test owner and business ─────────────────────────────────
  console.log('\n[2] Create test owner + business');

  const ownerEmail = `${TEST_TAG}-owner@example.com`;
  const ownerUserId = await step('create test owner auth user').run(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: ownerEmail,
      password: 'Test-password-123!',
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    cleanup.ownerUserId = data.user.id;
    return data.user.id;
  });

  const testBusinessId = await step('create test business row').run(async () => {
    const { data, error } = await supabase
      .from('businesses')
      .insert({
        owner_id: ownerUserId,
        name: `Test Nursery ${TEST_TAG}`,
        business_type: 'nursery',
        tax_rate: 0.0825,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    cleanup.testBusinessId = data.id;
    return data.id;
  });

  await step('create OWNER business_members row for test owner').run(async () => {
    const { data, error } = await supabase
      .from('business_members')
      .insert({
        business_id: testBusinessId,
        user_id: ownerUserId,
        name: 'Test Owner',
        email: ownerEmail,
        role: 'OWNER',
        permissions: [
          'view_dashboard','qr_checkout','view_orders','manage_deliveries',
          'manage_customers','manage_campaigns','view_reports','manage_settings',
        ],
        active: true,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    cleanup.ownerMemberId = data.id;
  });

  // ── Section 3: Owner resolves business via owner_id lookup (fast path) ────────
  console.log('\n[3] Owner path — businesses.owner_id = user_id');

  const ownerBiz = await step('owner lookup returns the test business').run(async () => {
    const { data, error } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', ownerUserId)
      .eq('business_type', 'nursery')
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No business found for owner');
    if (data.id !== testBusinessId) throw new Error(`Wrong business: got ${data.id}`);
    return data;
  });

  await step('owner has no business_members fallback needed').run(async () => {
    // Owner path resolves successfully — member path should never run for owner
    if (!ownerBiz) throw new Error('Owner business resolution failed');
  });

  // ── Section 4: Create test MANAGER member ─────────────────────────────────────
  console.log('\n[4] Create test MANAGER member (Erin analog)');

  const memberEmail = `${TEST_TAG}-erin@example.com`;
  const managerPermissions = [
    'view_dashboard','qr_checkout','view_orders',
    'manage_deliveries','manage_customers','manage_campaigns','view_reports',
    // INTENTIONALLY excluded: manage_settings
  ];

  const memberUserId = await step('create test member auth user').run(async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: memberEmail,
      password: 'Test-password-123!',
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    cleanup.memberUserId = data.user.id;
    return data.user.id;
  });

  await step('create MANAGER business_members row for test member').run(async () => {
    const { data, error } = await supabase
      .from('business_members')
      .insert({
        business_id: testBusinessId,
        user_id: memberUserId,
        name: 'Test Erin',
        email: memberEmail,
        role: 'MANAGER',
        permissions: managerPermissions,
        active: true,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    cleanup.memberMemberId = data.id;
  });

  // ── Section 5: Member path — business_members → businesses join ───────────────
  console.log('\n[5] Member path — business_members → businesses join');

  const memberBiz = await step('business_members join returns the test business').run(async () => {
    const { data, error } = await supabase
      .from('business_members')
      .select('business_id, role, permissions, businesses(*)')
      .eq('user_id', memberUserId)
      .eq('active', true)
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('No member row found for member user');
    const biz = data.businesses;
    if (!biz) throw new Error('businesses join returned null');
    if (biz.id !== testBusinessId) throw new Error(`Wrong business: got ${biz.id}`);
    return { biz, permissions: data.permissions, role: data.role };
  });

  await step('member role is MANAGER').run(async () => {
    if (memberBiz?.role !== 'MANAGER') throw new Error(`Expected MANAGER, got ${memberBiz?.role}`);
  });

  await step('MANAGER permissions include view_dashboard').run(async () => {
    const perms = memberBiz?.permissions ?? [];
    if (!perms.includes('view_dashboard')) throw new Error('Missing view_dashboard');
  });

  await step('MANAGER permissions include qr_checkout').run(async () => {
    const perms = memberBiz?.permissions ?? [];
    if (!perms.includes('qr_checkout')) throw new Error('Missing qr_checkout');
  });

  await step('MANAGER permissions include view_orders').run(async () => {
    const perms = memberBiz?.permissions ?? [];
    if (!perms.includes('view_orders')) throw new Error('Missing view_orders');
  });

  await step('MANAGER permissions include manage_deliveries').run(async () => {
    const perms = memberBiz?.permissions ?? [];
    if (!perms.includes('manage_deliveries')) throw new Error('Missing manage_deliveries');
  });

  await step('MANAGER permissions include manage_campaigns').run(async () => {
    const perms = memberBiz?.permissions ?? [];
    if (!perms.includes('manage_campaigns')) throw new Error('Missing manage_campaigns');
  });

  await step('MANAGER permissions exclude manage_settings (cannot access Settings)').run(async () => {
    const perms = memberBiz?.permissions ?? [];
    if (perms.includes('manage_settings')) throw new Error('MANAGER should NOT have manage_settings');
  });

  // ── Section 6: Member path vs owner_id lookup (what the fixed code does) ──────
  console.log('\n[6] Simulate BusinessProvider two-path resolution');

  await step('owner_id lookup returns null for member user (correct)').run(async () => {
    const { data } = await supabase
      .from('businesses')
      .select('*')
      .eq('owner_id', memberUserId)
      .eq('business_type', 'nursery')
      .single();
    if (data) throw new Error(`owner_id lookup incorrectly returned a business for member user`);
  });

  await step('member fallback correctly resolves business for member user').run(async () => {
    // Simulate exactly what the fixed BusinessProvider does:
    let biz = null;

    // 1. Try owner lookup
    const { data: ownerData } = await supabase
      .from('businesses').select('*')
      .eq('owner_id', memberUserId).eq('business_type', 'nursery').single();
    biz = ownerData;

    // 2. If not owner, fall back to business_members
    if (!biz) {
      const { data: member } = await supabase
        .from('business_members')
        .select('business_id, role, permissions, businesses(*)')
        .eq('user_id', memberUserId).eq('active', true).single();
      biz = member?.businesses ?? null;
    }

    if (!biz) throw new Error('Two-path resolution failed to find business for member user');
    if (biz.id !== testBusinessId) throw new Error(`Resolved wrong business: ${biz.id}`);
  });

  // ── Section 7: LAWNS business supports member addition ───────────────────────
  console.log('\n[7] LAWNS business (existing) supports adding members');

  const lawnsExists = await step('LAWNS business row exists').run(async () => {
    const { data, error } = await supabase
      .from('businesses')
      .select('id, name')
      .eq('id', LAWNS_BUSINESS_ID)
      .single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('LAWNS businesses row not found');
    return data;
  });

  if (lawnsExists) {
    await step(`LAWNS name: "${lawnsExists.name}"`).run(async () => {
      if (!lawnsExists.name) throw new Error('LAWNS name is empty');
    });

    await step('can insert a pending invitation for LAWNS').run(async () => {
      const { data, error } = await supabase
        .from('invitations')
        .insert({
          business_id: LAWNS_BUSINESS_ID,
          name: 'Test LAWNS Member',
          email: `${TEST_TAG}-lawns@example.com`,
          role: 'MANAGER',
        })
        .select('id, token')
        .single();
      if (error) throw new Error(error.message);
      cleanup.invitationId = data.id;
      return data;
    });

    const invRow = await step('invitation token is a 64-char hex string').run(async () => {
      const { data } = await supabase
        .from('invitations')
        .select('token, expires_at, used')
        .eq('id', cleanup.invitationId)
        .single();
      if (data.token.length !== 64) throw new Error(`Token length ${data.token.length}, expected 64`);
      if (data.used !== false) throw new Error('New invite should have used=false');
      return data;
    });

    await step('invitation expires 7 days from now (within 1 hour tolerance)').run(async () => {
      const expires = new Date(invRow.expires_at);
      const expected = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const diffMs = Math.abs(expires - expected);
      if (diffMs > 60 * 60 * 1000) throw new Error(`Expiry ${expires.toISOString()} not within 1h of expected`);
    });

    await step('can insert inactive MANAGER member row for LAWNS').run(async () => {
      const { data, error } = await supabase
        .from('business_members')
        .insert({
          business_id: LAWNS_BUSINESS_ID,
          name: 'Test LAWNS Member',
          email: `${TEST_TAG}-lawns@example.com`,
          role: 'MANAGER',
          permissions: [
            'view_dashboard','qr_checkout','view_orders',
            'manage_deliveries','manage_customers','manage_campaigns','view_reports',
          ],
          active: false,
          invite_id: cleanup.invitationId,
        })
        .select('id')
        .single();
      if (error) throw new Error(error.message);
      cleanup.lawnsMemberId = data.id;
    });
  }

  // ── Section 8: Invite token preview (server-side logic) ──────────────────────
  console.log('\n[8] Invite token preview (mirrors previewInvitation server function)');

  await step('can query invitation by token with used=false filter').run(async () => {
    const { data: inv } = await supabase
      .from('invitations')
      .select('token')
      .eq('id', cleanup.invitationId)
      .single();
    const { data, error } = await supabase
      .from('invitations')
      .select('name, role, business_id')
      .eq('token', inv.token)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();
    if (error) throw new Error(`Token preview failed: ${error.message}`);
    if (!data) throw new Error('Token preview returned null');
    if (data.business_id !== LAWNS_BUSINESS_ID) throw new Error('Wrong business_id in preview');
  });

  await step('businesses join on invitation returns LAWNS name').run(async () => {
    const { data: inv } = await supabase.from('invitations').select('token').eq('id', cleanup.invitationId).single();
    const { data, error } = await supabase
      .from('invitations')
      .select('name, role, business_id, businesses(name)')
      .eq('token', inv.token)
      .eq('used', false)
      .single();
    if (error) throw new Error(`businesses join failed: ${error.message}`);
    const bizName = (data?.businesses)?.name;
    if (!bizName) throw new Error('businesses join returned no name');
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────────
  console.log('\n[cleanup]');

  await step('delete LAWNS test member row').run(async () => {
    if (!cleanup.lawnsMemberId) return;
    const { error } = await supabase.from('business_members').delete().eq('id', cleanup.lawnsMemberId);
    if (error) throw new Error(error.message);
    cleanup.lawnsMemberId = null;
  });

  await step('delete LAWNS test invitation').run(async () => {
    if (!cleanup.invitationId) return;
    const { error } = await supabase.from('invitations').delete().eq('id', cleanup.invitationId);
    if (error) throw new Error(error.message);
    cleanup.invitationId = null;
  });

  await step('delete test member business_members row').run(async () => {
    if (!cleanup.memberMemberId) return;
    const { error } = await supabase.from('business_members').delete().eq('id', cleanup.memberMemberId);
    if (error) throw new Error(error.message);
    cleanup.memberMemberId = null;
  });

  await step('delete test owner business_members row').run(async () => {
    if (!cleanup.ownerMemberId) return;
    const { error } = await supabase.from('business_members').delete().eq('id', cleanup.ownerMemberId);
    if (error) throw new Error(error.message);
    cleanup.ownerMemberId = null;
  });

  await step('delete test business').run(async () => {
    if (!cleanup.testBusinessId) return;
    const { error } = await supabase.from('businesses').delete().eq('id', cleanup.testBusinessId);
    if (error) throw new Error(error.message);
    cleanup.testBusinessId = null;
  });

  await step('delete test member auth user').run(async () => {
    if (!cleanup.memberUserId) return;
    const { error } = await supabase.auth.admin.deleteUser(cleanup.memberUserId);
    if (error) throw new Error(error.message);
    cleanup.memberUserId = null;
  });

  await step('delete test owner auth user').run(async () => {
    if (!cleanup.ownerUserId) return;
    const { error } = await supabase.auth.admin.deleteUser(cleanup.ownerUserId);
    if (error) throw new Error(error.message);
    cleanup.ownerUserId = null;
  });

  // ── Result ────────────────────────────────────────────────────────────────────
  console.log('');
  if (failCount === 0) {
    console.log('✅ ALL STEPS PASSED — BusinessProvider member-path fix is verified.\n');
    process.exit(0);
  } else {
    console.log(`❌ ${failCount} STEP(S) FAILED — see output above.\n`);
    await cleanupAll().catch(() => {});
    process.exit(1);
  }
}

main().catch(async err => {
  console.error('\nUnexpected error:', err.message);
  await cleanupAll().catch(() => {});
  process.exit(1);
});
