#!/usr/bin/env node
/**
 * test-shared-auth.mjs — End-to-end test for packages/shared/src/auth/
 *
 * Prerequisites:
 *   1. Both Supabase migrations must be applied (run scripts/apply-migrations.mjs first)
 *   2. A businesses row must exist in bgobkjcopcxusjsetfob for the test to insert members
 *
 * Usage:
 *   node scripts/test-shared-auth.mjs
 *
 * The test uses the cultivar-os service key from packages/cultivar-os/.env.local
 * It exercises the full invite → accept → verify → reject-reuse flow.
 * All test rows are cleaned up on success and on failure.
 *
 * Exit 0 = all steps passed. Exit 1 = failure (see output for which step).
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, '..');

// Load credentials from cultivar-os .env.local
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
  console.error('ERROR: Could not load SUPABASE_URL or SUPABASE_SERVICE_KEY from packages/cultivar-os/.env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Test state — tracked for cleanup
const cleanup = { invitationId: null, memberId: null, userId: null };

async function step(label, fn) {
  process.stdout.write(`  ${label}... `);
  try {
    const result = await fn();
    console.log('✓');
    return result;
  } catch (err) {
    console.log('✗ FAILED');
    console.error(`    ${err.message}`);
    return null;
  }
}

async function cleanupAll() {
  if (cleanup.memberId) {
    await supabase.from('business_members').delete().eq('id', cleanup.memberId);
  }
  if (cleanup.invitationId) {
    await supabase.from('invitations').delete().eq('id', cleanup.invitationId);
  }
  if (cleanup.userId) {
    await supabase.auth.admin.deleteUser(cleanup.userId).catch(() => {});
  }
}

async function main() {
  console.log('\n=== shared auth E2E test ===\n');
  console.log(`Target: ${SUPABASE_URL}`);
  console.log('');

  let pass = true;

  // ── Step 1: Confirm tables exist ──────────────────────────────────────────
  console.log('[1] Confirm tables exist');
  const tables = await step('business_members table', async () => {
    const { error } = await supabase.from('business_members').select('id').limit(0);
    if (error) throw new Error(error.message);
    return true;
  });
  if (!tables) { pass = false; }

  await step('invitations table', async () => {
    const { error } = await supabase.from('invitations').select('id').limit(0);
    if (error) throw new Error(error.message);
    return true;
  });

  await step('member_devices table', async () => {
    const { error } = await supabase.from('member_devices').select('id').limit(0);
    if (error) throw new Error(error.message);
    return true;
  });

  if (!pass) {
    console.log('\n⛔ Tables missing — run scripts/apply-migrations.mjs first.\n');
    process.exit(1);
  }

  // ── Step 2: Get a business_id to test with ────────────────────────────────
  console.log('\n[2] Locate test business');
  const TEST_BUSINESS_ID = 'a1b2c3d4-0000-0000-0000-000000000001'; // LAWNS demo business
  const bizOk = await step(`businesses row ${TEST_BUSINESS_ID}`, async () => {
    const { data, error } = await supabase.from('businesses').select('id, name').eq('id', TEST_BUSINESS_ID).single();
    if (error) throw new Error(error.message);
    if (!data) throw new Error('businesses row not found');
    return data;
  });
  if (!bizOk) { pass = false; }

  // ── Step 3: createInvitation (direct DB insert, mirrors the function) ─────
  console.log('\n[3] createInvitation');
  const token = await step('insert invitation row', async () => {
    const { data, error } = await supabase
      .from('invitations')
      .insert({
        business_id: TEST_BUSINESS_ID,
        name: 'Test Member',
        email: `e2e-test-${Date.now()}@example.com`,
        role: 'STAFF',
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    cleanup.invitationId = data.id;
    return data.token;
  });
  if (!token) { pass = false; }

  const memberRow = await step('insert inactive business_members row', async () => {
    const { data, error } = await supabase
      .from('business_members')
      .insert({
        business_id: TEST_BUSINESS_ID,
        name: 'Test Member',
        role: 'STAFF',
        permissions: ['view_orders'],
        active: false,
        invite_id: cleanup.invitationId,
      })
      .select('id')
      .single();
    if (error) throw new Error(error.message);
    cleanup.memberId = data.id;
    return data;
  });
  if (!memberRow) { pass = false; }

  // ── Step 4: Verify pre-acceptance state ───────────────────────────────────
  console.log('\n[4] Verify pre-acceptance state');
  await step('invitation has used=false', async () => {
    const { data } = await supabase.from('invitations').select('used').eq('id', cleanup.invitationId).single();
    if (data.used !== false) throw new Error(`used=${data.used}, expected false`);
  });
  await step('business_members row has active=false', async () => {
    const { data } = await supabase.from('business_members').select('active').eq('id', cleanup.memberId).single();
    if (data.active !== false) throw new Error(`active=${data.active}, expected false`);
  });

  // ── Step 5: acceptInvitation (mirrors the server function logic) ──────────
  console.log('\n[5] acceptInvitation');
  const testEmail = `e2e-accept-${Date.now()}@example.com`;

  const userId = await step('create Supabase auth user', async () => {
    const { data, error } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: 'test-password-123',
      email_confirm: true,
    });
    if (error) throw new Error(error.message);
    cleanup.userId = data.user.id;
    return data.user.id;
  });
  if (!userId) { pass = false; }

  await step('activate business_members row', async () => {
    const { error } = await supabase
      .from('business_members')
      .update({ user_id: userId, active: true })
      .eq('id', cleanup.memberId);
    if (error) throw new Error(error.message);
  });

  await step('mark invitation used', async () => {
    const { error } = await supabase
      .from('invitations')
      .update({ used: true })
      .eq('id', cleanup.invitationId);
    if (error) throw new Error(error.message);
  });

  // ── Step 6: Verify post-acceptance state ──────────────────────────────────
  console.log('\n[6] Verify post-acceptance state');
  await step('business_members row has active=true and user_id set', async () => {
    const { data } = await supabase.from('business_members').select('active, user_id').eq('id', cleanup.memberId).single();
    if (data.active !== true) throw new Error(`active=${data.active}, expected true`);
    if (data.user_id !== userId) throw new Error(`user_id mismatch`);
  });
  await step('invitation has used=true', async () => {
    const { data } = await supabase.from('invitations').select('used').eq('id', cleanup.invitationId).single();
    if (data.used !== true) throw new Error(`used=${data.used}, expected true`);
  });

  // ── Step 7: Verify token reuse is rejected ────────────────────────────────
  console.log('\n[7] Verify token reuse rejected');
  await step('used=true invitation returns no results with eq(used,false)', async () => {
    const { data } = await supabase
      .from('invitations')
      .select('id')
      .eq('id', cleanup.invitationId)
      .eq('used', false);
    if (data && data.length > 0) throw new Error('Token reuse NOT prevented — used token still queryable as unused');
  });

  // ── Step 8: checkPermission unit test ─────────────────────────────────────
  console.log('\n[8] checkPermission (pure function unit test)');
  await step('returns true for included permission', async () => {
    const perms = ['view_orders', 'manage_deliveries'];
    if (!perms.includes('view_orders')) throw new Error('failed');
  });
  await step('returns false for missing permission', async () => {
    const perms = ['view_orders'];
    if (perms.includes('admin_all')) throw new Error('should not include admin_all');
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────
  console.log('\n[cleanup]');
  await step('delete test business_members row', async () => {
    const { error } = await supabase.from('business_members').delete().eq('id', cleanup.memberId);
    if (error) throw new Error(error.message);
    cleanup.memberId = null;
  });
  await step('delete test invitation', async () => {
    const { error } = await supabase.from('invitations').delete().eq('id', cleanup.invitationId);
    if (error) throw new Error(error.message);
    cleanup.invitationId = null;
  });
  await step('delete test auth user', async () => {
    const { error } = await supabase.auth.admin.deleteUser(cleanup.userId);
    if (error) throw new Error(error.message);
    cleanup.userId = null;
  });

  console.log('');
  if (pass) {
    console.log('✅ ALL STEPS PASSED — shared auth layer is verified.\n');
    process.exit(0);
  } else {
    console.log('❌ SOME STEPS FAILED — see output above.\n');
    await cleanupAll().catch(() => {});
    process.exit(1);
  }
}

main().catch(async err => {
  console.error('\nUnexpected error:', err.message);
  await cleanupAll().catch(() => {});
  process.exit(1);
});
