/**
 * ── trialDaysRemaining — THE ONE READER OF THE TRIAL PAIR · 2026-08-02 ──
 *
 * WHAT THIS GUARDS: the number a customer is shown about how long they have left, and — once the
 * fuzz lands — the number that decides when a module goes dark. The dangerous failures here are
 * QUIET ones: a `null` collapsing to `0` renders "no trial" as "expired", and a fabricated number
 * over a malformed row shows a deadline nobody granted.
 *
 * Probes run BOTH DIRECTIONS (STD-022): each rule has a case that must produce a number and a case
 * that must produce `null`, so a function that returned `null` for everything — or a number for
 * everything — fails rather than passing half the suite.
 *
 * Run (pure TS, no deps):
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/trialClock.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { trialDaysRemaining } from './trialClock';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg);
}

// A fixed clock — `Date.now()` in a test makes it pass on Tuesday and fail on the boundary.
const NOW = new Date('2026-08-02T12:00:00.000Z');
const started = (iso: string) => ({ trial_started_at: iso, trial_days: 30 });

// ── 1. THE HAPPY PATH — a real running trial reports a real number ───────────────────────────────

ok(trialDaysRemaining(started('2026-08-02T12:00:00.000Z'), NOW) === 30,
   'T1 a trial started this instant has its full term left');
ok(trialDaysRemaining(started('2026-07-23T12:00:00.000Z'), NOW) === 20,
   'T2 ten days in, twenty left — the arithmetic is days, not hours');
ok(trialDaysRemaining({ trial_started_at: '2026-08-02T11:00:00.000Z', trial_days: 14 }, NOW) === 14,
   'T3 🔴 the TERM comes from the ROW, not from a constant — a 14-day trial reports 14, not 30');

// 🔴 T4 — THE SNAPSHOT RULING, asserted as behaviour rather than trusted as a comment. Two rows with
// IDENTICAL start dates and DIFFERENT stored terms must report different numbers. If this function
// ever reached for the catalog instead of the row, both would report the same and this fails.
ok(trialDaysRemaining({ trial_started_at: '2026-08-01T12:00:00.000Z', trial_days: 30 }, NOW) === 29
   && trialDaysRemaining({ trial_started_at: '2026-08-01T12:00:00.000Z', trial_days: 14 }, NOW) === 13,
   'T4 🔴 same start, different stored terms → different answers. The term is read from the row (snapshot ruling)');

// ── 2. THE BOUNDARY — 0 means lapsed, and it is never claimed early ──────────────────────────────

ok(trialDaysRemaining({ trial_started_at: '2026-07-03T12:00:00.000Z', trial_days: 30 }, NOW) === 0,
   'T5 a trial whose term ran out exactly now reads 0');
ok(trialDaysRemaining({ trial_started_at: '2026-06-01T12:00:00.000Z', trial_days: 30 }, NOW) === 0,
   'T6 🔴 a LONG-lapsed trial reads 0, never a negative — a customer is never shown "-32 days left"');
// 🔴 T7 — the CEIL rule, and it is the one that keeps a live module from reading as expired. With
// one hour left the module still WORKS; reporting 0 would say it is over while it is not.
ok(trialDaysRemaining({ trial_started_at: '2026-07-03T13:00:00.000Z', trial_days: 30 }, NOW) === 1,
   'T7 🔴 one hour remaining reads 1, not 0 — 0 is reserved for genuinely lapsed');

// ── 3. `null` vs `0` — THE CONFLATION THIS FUNCTION EXISTS TO REFUSE (D-9) ───────────────────────

ok(trialDaysRemaining(null) === null,
   'T8 a null config (unseeded/legacy row) → null, NOT 0');
ok(trialDaysRemaining({}) === null,
   'T9 🔴 a config with NO trial keys → null. Core and unpriced modules are not expired, they are unclocked');
ok(trialDaysRemaining({ trial_started_at: '2026-08-02T12:00:00.000Z', trial_days: 0 }, NOW) === null,
   'T10 a zero term → null — the server refuses to write one, so a row carrying it is corrupt, not expired');

// ── 4. MALFORMED PAIRS FAIL TO `null`, NEVER TO A GUESS ─────────────────────────────────────────

ok(trialDaysRemaining({ trial_started_at: '2026-08-02T12:00:00.000Z' }, NOW) === null,
   'T11 a start with no term → null. Half a pair is not a term');
ok(trialDaysRemaining({ trial_days: 30 }, NOW) === null,
   'T12 a term with no start → null. This is the `trial_start_at` typo shape the RPC was named to prevent');
ok(trialDaysRemaining({ trial_started_at: 'last Tuesday', trial_days: 30 }, NOW) === null,
   'T13 an unparseable date → null, never NaN and never a fabricated day count');
ok(trialDaysRemaining({ trial_started_at: 1754140800000 as unknown as string, trial_days: 30 }, NOW) === null,
   'T14 a numeric epoch where a string belongs → null. The column stores an ISO string; anything else is a different writer');
ok(trialDaysRemaining({ trial_started_at: '2026-08-02T12:00:00.000Z', trial_days: -5 }, NOW) === null,
   'T15 a negative term → null, not a lapsed 0 — it is corrupt data and must not read as an expiry');

// 🔴 T16 — THE NEGATIVE CONTROL FOR THE WHOLE SUITE. A function that simply returned `null` would
// satisfy every probe in sections 3 and 4. This asserts the good path still produces a number, so
// "everything is null" cannot pass.
ok(typeof trialDaysRemaining(started('2026-07-28T12:00:00.000Z'), NOW) === 'number',
   'T16 🔴 negative control — a valid pair still returns a NUMBER, so a null-returning stub fails this suite');

// ── report ───────────────────────────────────────────────────────────────────────────────────────
console.log(`trialClock: ${passed} passed, ${failed} failed`);
if (failed) { for (const f of failures) console.error('  ✗ ' + f); process.exit(1); }
