#!/usr/bin/env node
/**
 * apply-migrations.mjs — Apply pending Supabase SQL migrations programmatically
 *
 * Requires a Supabase personal access token (PAT):
 *   1. Go to https://supabase.com/dashboard/account/tokens
 *   2. Click "Generate new token", name it "trace-migrations"
 *   3. Copy the token
 *
 * Usage:
 *   SUPABASE_PAT=sbp_abc123 node scripts/apply-migrations.mjs
 *
 * What this does:
 *   - Applies supabase/migrations/20260602_shared_members_a_create_tables.sql
 *     to the cultivar-os project (bgobkjcopcxusjsetfob)
 *   - Applies packages/ignition-os/supabase/migrations/20260602_ignition_drop_team_tables.sql
 *     to the ignition-os project (ufsgqckbxdtwviqjjtos)
 *   - Runs verification queries after each
 *   - Exits 1 on any failure so you know to stop
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dir, '..');

const PAT = process.env.SUPABASE_PAT;
if (!PAT) {
  console.error('ERROR: SUPABASE_PAT env var is required.');
  console.error('Get one at: https://supabase.com/dashboard/account/tokens');
  process.exit(1);
}

const MGMT_API = 'https://api.supabase.com/v1';

async function execSQL(projectRef, sql, label) {
  console.log(`\n[${label}] Executing against project ${projectRef}...`);
  const res = await fetch(`${MGMT_API}/projects/${projectRef}/database/query`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAT}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  const body = await res.json().catch(() => ({ error: res.statusText }));

  if (!res.ok) {
    console.error(`  FAILED (HTTP ${res.status}): ${JSON.stringify(body)}`);
    return { ok: false, body };
  }

  console.log(`  OK — ${res.status}`);
  if (Array.isArray(body) && body.length > 0) {
    console.table(body);
  } else {
    console.log('  (No rows returned)');
  }
  return { ok: true, body };
}

async function main() {
  let anyFailed = false;

  // ──────────────────────────────────────────────────────────────────────────────
  // 1. CULTIVAR-OS: Apply shared members migration
  // ──────────────────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════');
  console.log('PROJECT: bgobkjcopcxusjsetfob (cultivar-os)');
  console.log('════════════════════════════════════════════');

  const cultivarMigration = readFileSync(
    join(repoRoot, 'supabase/migrations/20260602_shared_members_a_create_tables.sql'),
    'utf8'
  );

  const applyResult = await execSQL(
    'bgobkjcopcxusjsetfob',
    cultivarMigration,
    'cultivar migration'
  );

  if (!applyResult.ok) {
    console.error('\nSTOP: cultivar-os migration failed. Fix before proceeding.');
    anyFailed = true;
  } else {
    // Verify tables exist
    const verify = await execSQL(
      'bgobkjcopcxusjsetfob',
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name IN ('business_members', 'invitations', 'member_devices')
       ORDER BY table_name;`,
      'cultivar verify tables'
    );
    if (!verify.ok || verify.body.length < 3) {
      console.error('\nSTOP: Verification failed — expected 3 tables, got fewer.');
      anyFailed = true;
    }

    // Verify RLS
    await execSQL(
      'bgobkjcopcxusjsetfob',
      `SELECT tablename, rowsecurity
       FROM pg_tables
       WHERE schemaname = 'public'
         AND tablename IN ('business_members', 'invitations', 'member_devices');`,
      'cultivar verify RLS'
    );

    // Verify policies
    await execSQL(
      'bgobkjcopcxusjsetfob',
      `SELECT tablename, policyname
       FROM pg_policies
       WHERE schemaname = 'public'
         AND tablename IN ('business_members', 'invitations', 'member_devices')
       ORDER BY tablename, policyname;`,
      'cultivar verify policies'
    );
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // 2. IGNITION-OS: Drop legacy team tables
  // ──────────────────────────────────────────────────────────────────────────────
  if (!anyFailed) {
    console.log('\n════════════════════════════════════════════');
    console.log('PROJECT: ufsgqckbxdtwviqjjtos (ignition-os)');
    console.log('════════════════════════════════════════════');

    const ignitionDrop = readFileSync(
      join(repoRoot, 'packages/ignition-os/supabase/migrations/20260602_ignition_drop_team_tables.sql'),
      'utf8'
    );

    const dropResult = await execSQL(
      'ufsgqckbxdtwviqjjtos',
      ignitionDrop,
      'ignition drop'
    );

    if (!dropResult.ok) {
      console.error('\nSTOP: ignition-os drop migration failed.');
      anyFailed = true;
    } else {
      // Verify old tables are gone
      const verify = await execSQL(
        'ufsgqckbxdtwviqjjtos',
        `SELECT table_name
         FROM information_schema.tables
         WHERE table_schema = 'public'
           AND table_name IN ('pin_resets', 'member_devices', 'shop_members', 'shop_invites', 'teams');`,
        'ignition verify drop'
      );
      if (verify.ok && Array.isArray(verify.body) && verify.body.length > 0) {
        console.error('\nSTOP: Verification failed — old tables still exist:', verify.body);
        anyFailed = true;
      } else {
        console.log('  ✓ All legacy tables dropped.');
      }
    }
  }

  // ──────────────────────────────────────────────────────────────────────────────
  // Summary
  // ──────────────────────────────────────────────────────────────────────────────
  console.log('\n════════════════════════════════════════════');
  if (anyFailed) {
    console.error('RESULT: FAILED — see errors above. Do not proceed to next session.');
    process.exit(1);
  } else {
    console.log('RESULT: SUCCESS — both migrations applied and verified.');
    console.log('You can now run the next session (shared package + AcceptInvite).');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
