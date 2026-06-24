/**
 * ── PMI interval-conversion + accept-flow + override-permission tests ──────────────
 *
 * Proves the three assertions in the PMI minimal-fix prompt, each with teeth (every
 * test computes what a BUGGY implementation would produce and asserts the real one
 * differs):
 *   (1) accepting an AI-suggested schedule derives interval_days and getPMIStatus
 *       returns a REAL status (not NONE) given a last_service_at.
 *   (2) a usage-based-only task does NOT silently set a fake interval (honest no-due-date)
 *       — the donor's `INTERVAL_DAYS[x] || 30` fabrication is the bug we guard against.
 *   (3) override_maintenance appears in the role-config chip catalog and is OFF for
 *       STAFF / ON for OWNER+MANAGER by default.
 *
 * No test runner is installed in this repo. Run with the esbuild that ships in node_modules:
 *   node_modules/.bin/esbuild packages/shared/src/modules/pmiInterval.test.ts \
 *     --bundle --platform=node --format=cjs | node
 * Exits non-zero if any assertion fails.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  INTERVAL_DAYS,
  taskIntervalToDays,
  isUsageBasedInterval,
  deriveIntervalDays,
  pmiStatusFrom,
  type ScheduleTask,
} from './pmiInterval';
import { ALL_ACTION_PERMISSIONS, ACTION_ROLE_DEFAULTS, OVERRIDE_MAINTENANCE } from '../auth/actionPermissions';
import { ALL_FINANCIAL_PERMISSIONS } from '../auth/financialPermissions';

// ── tiny harness ─────────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { passed++; console.log(`  ✓ ${name}`); }
  else { failed++; console.error(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`); }
}

const DAY = 86_400_000;
const ago = (days: number) => new Date(Date.now() - days * DAY).toISOString();

// ── (1) accept-flow derives interval_days → real status ────────────────────────────
console.log('\n(1) accepting a schedule derives interval_days and yields a real status');
{
  const tasks: ScheduleTask[] = [
    { name: 'Change engine oil', interval: 'monthly' },   // 30
    { name: 'Check tire pressure', interval: 'weekly' },  // 7
    { name: 'Full inspection', interval: 'annually' },    // 365
  ];
  const { intervalDays, unconvertible } = deriveIntervalDays(tasks);

  // soonest convertible cadence drives it — NOT the max (a buggy Math.max would give 365)
  check('interval_days = soonest task (7), not 30/365', intervalDays === 7, `got ${intervalDays}`);
  check('all three tasks converted (none flagged)', unconvertible.length === 0);

  // given a last_service_at, status is REAL — the bug being fixed left it NONE forever
  const overdue = pmiStatusFrom(intervalDays, ago(60));
  check('serviced 60d ago + 7d cadence → OVERDUE (not NONE)', overdue === 'OVERDUE', `got ${overdue}`);
  check('status is not the broken NONE', overdue !== 'NONE');

  // OK = comfortably within the cadence (>7d before due). Use a 30d cadence serviced 1d ago.
  check('serviced 1d ago + 30d cadence → OK', pmiStatusFrom(30, ago(1)) === 'OK', `got ${pmiStatusFrom(30, ago(1))}`);
  // DUE_SOON = within 7 days of the cadence. 30d cadence serviced 25d ago → DUE_SOON.
  check('serviced 25d ago + 30d cadence → DUE_SOON', pmiStatusFrom(30, ago(25)) === 'DUE_SOON', `got ${pmiStatusFrom(30, ago(25))}`);

  // the "needs both" rule still holds: a cadence with no service date is NONE
  check('cadence but never serviced → NONE', pmiStatusFrom(intervalDays, null) === 'NONE');
}

// ── (2) usage-based intervals never fabricate a cadence ────────────────────────────
console.log('\n(2) usage-based tasks do NOT silently set a fake interval');
{
  const usageOnly: ScheduleTask[] = [
    { name: 'Change oil', interval: 'every 5000 miles' },
    { name: 'Service hydraulics', interval: 'every 250 hours' },
  ];
  const { intervalDays, unconvertible } = deriveIntervalDays(usageOnly);

  // the donor did `INTERVAL_DAYS[x] || 30` → would fabricate 30 here. The fix returns null.
  check('usage-based-only → interval_days is null (no fabricated 30)', intervalDays === null, `got ${intervalDays}`);
  check('both usage-based tasks flagged as unconvertible', unconvertible.length === 2);
  check('null cadence → status NONE (honest no due date)', pmiStatusFrom(intervalDays, ago(999)) === 'NONE');
  check('usage-based interval detected', isUsageBasedInterval('every 5000 miles') && isUsageBasedInterval('every 250 hours'));
  check('"monthly" is not usage-based', !isUsageBasedInterval('monthly'));

  // mixed: only the time-based task contributes; the mileage task is flagged but doesn't poison the cadence
  const mixed: ScheduleTask[] = [
    { name: 'Change oil', interval: 'every 5000 miles' },
    { name: 'Grease fittings', interval: 'quarterly' },   // 90
  ];
  const m = deriveIntervalDays(mixed);
  check('mixed → cadence from the time-based task only (90)', m.intervalDays === 90, `got ${m.intervalDays}`);
  check('mixed → mileage task still flagged', m.unconvertible.length === 1 && m.unconvertible[0].name === 'Change oil');

  // map + single-conversion sanity
  check('INTERVAL_DAYS is the ported donor map', INTERVAL_DAYS.daily === 1 && INTERVAL_DAYS.quarterly === 90 && INTERVAL_DAYS.annually === 365);
  check('unknown phrase → null (not fabricated)', taskIntervalToDays('whenever it feels right') === null);
}

// ── (3) override_maintenance: chip catalog + default ON/OFF ─────────────────────────
console.log('\n(3) override_maintenance is declared, chip-visible, and OFF for STAFF');
{
  check('override_maintenance constant', OVERRIDE_MAINTENANCE === 'override_maintenance');
  check('in ALL_ACTION_PERMISSIONS', ALL_ACTION_PERMISSIONS.includes('override_maintenance'));

  // Replicate the RoleConfig chip catalog union (registryPermissions ∪ financial ∪ action,
  // minus the structural owner-only gate). A registry that knows nothing of this action perm
  // would NOT surface it — the union via ALL_ACTION_PERMISSIONS is what makes it a chip.
  const registryStub = ['view_dashboard', 'qr_checkout', 'view_orders', 'view_costs', 'owner-only'];
  const catalog = [...new Set([...registryStub, ...ALL_FINANCIAL_PERMISSIONS, ...ALL_ACTION_PERMISSIONS])]
    .filter((p) => p !== 'owner-only');
  check('appears in the role-config chip catalog', catalog.includes('override_maintenance'));
  check('catalog excludes the structural owner-only gate', !catalog.includes('owner-only'));

  // canonical role defaults (single source of intent)
  check('default ON for OWNER',   ACTION_ROLE_DEFAULTS.OWNER.includes('override_maintenance'));
  check('default ON for MANAGER', ACTION_ROLE_DEFAULTS.MANAGER.includes('override_maintenance'));
  check('default OFF for STAFF', !ACTION_ROLE_DEFAULTS.STAFF.includes('override_maintenance'));

  // the cultivar DEFAULT_PERMISSIONS bundle must match that intent (read the source so the
  // test fails if the bundle drifts from the canonical default). Resolved from cwd — run from
  // the repo root (how all verify scripts run).
  const rolesPath = path.resolve(process.cwd(), 'packages/cultivar-os/src/auth/roles.ts');
  check('cultivar roles.ts found (run from repo root)', fs.existsSync(rolesPath), rolesPath);
  const rolesSrc = fs.existsSync(rolesPath) ? fs.readFileSync(rolesPath, 'utf8') : '';
  const block = (role: string): string => {
    const m = rolesSrc.match(new RegExp(`${role}:\\s*\\[([\\s\\S]*?)\\]`));
    return m ? m[1] : '';
  };
  check('cultivar DEFAULT_PERMISSIONS.OWNER has OVERRIDE_MAINTENANCE',   /OVERRIDE_MAINTENANCE/.test(block('OWNER')));
  check('cultivar DEFAULT_PERMISSIONS.MANAGER has OVERRIDE_MAINTENANCE', /OVERRIDE_MAINTENANCE/.test(block('MANAGER')));
  check('cultivar DEFAULT_PERMISSIONS.STAFF does NOT have OVERRIDE_MAINTENANCE', !/OVERRIDE_MAINTENANCE/.test(block('STAFF')));
}

// ── summary ────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
