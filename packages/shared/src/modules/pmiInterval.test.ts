/**
 * ── PMI interval-conversion + accept-flow tests ────────────────────────────────────
 *
 * PURPOSE      Prove the interval arithmetic behind preventive-maintenance scheduling,
 *              each assertion with teeth (every test computes what a BUGGY implementation
 *              would produce and asserts the real one differs):
 *   (1) accepting an AI-suggested schedule derives interval_days and getPMIStatus
 *       returns a REAL status (not NONE) given a last_service_at.
 *   (2) a usage-based-only task does NOT silently set a fake interval (honest no-due-date)
 *       — the donor's `INTERVAL_DAYS[x] || 30` fabrication is the bug we guard against.
 * DEPENDENCIES ./pmiInterval only. No DB, no React, no permission model.
 * OUTPUTS      pass/fail counts; exits non-zero on any failure.
 *
 * ⚠️ SPLIT 2026-07-30 (David's instruction): the ~100 PERMISSION-MODEL assertions that had
 *   accumulated here — the chip-catalog hidden set and the whole RBAC manifest block — moved
 *   VERBATIM to `../auth/permissionManifest.test.ts`, where the thing they assert lives.
 *   They were here only because the PMI build was where `override_maintenance` first needed a
 *   catalog check. Permission assertions filed under a maintenance-scheduling filename is why
 *   two stale STAFF-bundle checks sat unread. Nothing was deleted in the move.
 *
 * Run: node scripts/run-tests.mjs pmiInterval
 */

import {
  INTERVAL_DAYS,
  taskIntervalToDays,
  isUsageBasedInterval,
  deriveIntervalDays,
  pmiStatusFrom,
  type ScheduleTask,
} from './pmiInterval';

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


// ── summary ────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
