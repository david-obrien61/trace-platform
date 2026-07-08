/**
 * seed-role-floor.mjs — seed the SHARED role_definitions FLOOR (OWNER/MANAGER/STAFF).
 *
 * WHY: the 20260623 migration created role_definitions + RLS but its floor-seed INSERT
 * never landed on the live Cultivar project (verified live: 0 rows). With an empty catalog,
 * getRoleDefinitions()→resolveRoles() returns [] → the /roles + Team-console role dropdowns
 * render with NO options, so a member's correctly-stored business_members.role (e.g. STAFF)
 * has nothing to match against and shows empty. This seeds the catalog so stored roles are
 * selectable. business_members.role is UNCHANGED — this is the OPTIONS catalog, not the
 * member's role.
 *
 * The floor rows are business_id IS NULL, is_system=true. RLS rd_owner_write forbids an owner
 * session from writing the NULL-business anchor rows, so this MUST run with the service key
 * (RLS bypass) — same mechanism the migration comment describes. DML only, no DDL.
 *
 * IDEMPOTENT: upsert-by-role_key (select-then-insert/update), matching the partial unique index
 * role_definitions_floor_key ON (role_key) WHERE business_id IS NULL. Re-runnable.
 * REVERSIBLE: DELETE FROM role_definitions WHERE business_id IS NULL;
 *
 * Permission sets MUST match packages/cultivar-os/src/auth/roles.ts DEFAULT_PERMISSIONS
 * (the same sets the invite flow writes) so the invite and the catalog cannot drift.
 *
 * Usage:  node scripts/seed-role-floor.mjs           # seed + verify
 *         node scripts/seed-role-floor.mjs --verify   # read-only readback, no writes
 *         node scripts/seed-role-floor.mjs --clear     # remove the floor (reversal)
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envText = readFileSync(new URL('../packages/cultivar-os/.env.local', import.meta.url), 'utf8');
const env = Object.fromEntries(
  envText.split('\n').filter((l) => l.includes('=') && !l.trim().startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const URL_ = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_KEY;
if (!URL_ || !KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }
const sb = createClient(URL_, KEY);

// ── canonical floor — MUST mirror roles.ts DEFAULT_PERMISSIONS (drift = a wall leak) ──
const FLOOR = [
  {
    role_key: 'OWNER', label: 'Owner',
    description: 'Full access — settings, team, QB, all reports',
    permissions: [
      'view_dashboard', 'qr_checkout', 'view_orders', 'manage_orders', 'manage_deliveries',
      'manage_customers', 'manage_campaigns', 'view_reports', 'manage_settings',
      'view_wages', 'view_pricing_config', 'view_costs', 'view_margin', 'override_maintenance',
    ],
  },
  {
    role_key: 'MANAGER', label: 'Manager',
    description: 'Day-to-day ops — checkout, deliveries, campaigns, orders',
    permissions: [
      'view_dashboard', 'qr_checkout', 'view_orders', 'manage_orders', 'manage_deliveries',
      'manage_customers', 'manage_campaigns', 'view_reports', 'view_costs',
      'view_margin', 'override_maintenance',
    ],
  },
  {
    role_key: 'STAFF', label: 'Staff',
    description: 'QR checkout and order history only',
    permissions: ['view_dashboard', 'qr_checkout', 'view_orders'],
  },
];

const mode = process.argv.includes('--clear') ? 'clear'
  : process.argv.includes('--verify') ? 'verify' : 'seed';

async function readFloor() {
  const { data, error } = await sb
    .from('role_definitions').select('role_key,is_system,label,permissions,business_id')
    .is('business_id', null).order('role_key');
  if (error) throw new Error(error.message);
  return data;
}

if (mode === 'clear') {
  const { error } = await sb.from('role_definitions').delete().is('business_id', null);
  if (error) { console.error('[TRACE:ROLESEED] clear FAILED:', error.message); process.exit(1); }
  console.log('[TRACE:ROLESEED] floor cleared (business_id IS NULL rows removed).');
  process.exit(0);
}

if (mode === 'seed') {
  for (const r of FLOOR) {
    // idempotent upsert-by-role_key on the floor (business_id IS NULL)
    const { data: existing, error: selErr } = await sb
      .from('role_definitions').select('id')
      .is('business_id', null).eq('role_key', r.role_key).maybeSingle();
    if (selErr) { console.error(`[TRACE:ROLESEED] select ${r.role_key} FAILED:`, selErr.message); process.exit(1); }
    if (existing) {
      const { error } = await sb.from('role_definitions')
        .update({ is_system: true, label: r.label, description: r.description, permissions: r.permissions })
        .eq('id', existing.id);
      if (error) { console.error(`[TRACE:ROLESEED] update ${r.role_key} FAILED:`, error.message); process.exit(1); }
      console.log(`[TRACE:ROLESEED] updated floor ${r.role_key} (${r.permissions.length} perms)`);
    } else {
      const { error } = await sb.from('role_definitions').insert({
        business_id: null, role_key: r.role_key, is_system: true,
        label: r.label, description: r.description, permissions: r.permissions,
      });
      if (error) { console.error(`[TRACE:ROLESEED] insert ${r.role_key} FAILED:`, error.message); process.exit(1); }
      console.log(`[TRACE:ROLESEED] inserted floor ${r.role_key} (${r.permissions.length} perms)`);
    }
  }
}

// verify readback (both seed and --verify land here)
const rows = await readFloor();
console.log('\n[TRACE:ROLESEED] floor readback:');
for (const r of rows) console.log(`  ${r.role_key.padEnd(8)} is_system=${r.is_system} perms=${(r.permissions || []).length}`);
const keys = rows.map((r) => r.role_key).sort().join(',');
const ok = keys === 'MANAGER,OWNER,STAFF' && rows.every((r) => r.is_system === true && r.business_id === null);
console.log(ok ? '\n[TRACE:ROLESEED] PASS — floor OWNER/MANAGER/STAFF present, is_system, business_id NULL.'
  : '\n[TRACE:ROLESEED] FAIL — floor not as expected.');
process.exit(ok ? 0 : 1);
