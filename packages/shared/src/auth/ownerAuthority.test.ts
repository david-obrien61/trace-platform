/**
 * ── ownerAuthority — the R-22 interim gate · 2026-09-08 (#285 COMMIT 2) ──
 *
 * RED-first. The failing case that motivated it, live at LAWNS with the customer in the room:
 * Lauren holds the OWNER **role** in `business_members`; David is `businesses.owner_id`. Every
 * importer on /settings/accounting gated on `owner_id = auth.uid()`, so all three panels rendered
 * NOTHING for her and the server refused her from the other side.
 *
 * THE ONE THING THESE PROBES EXIST TO HOLD: **MANAGER STILL FAILS.** R-80's measurement is the
 * reason this build is a role check and not a permission — the MANAGER floor holds `orders:create`
 * AND `settings:update`, so either of those would have opened a customer's whole QuickBooks
 * catalogue to a manager. If a future edit makes MANAGER pass this predicate, that is the defect
 * this file is here to catch, and P4/P5 are the probes that catch it.
 *
 * Run:  node_modules/.bin/esbuild packages/shared/src/auth/ownerAuthority.test.ts \
 *         --bundle --platform=node --format=cjs | node
 */
import { holdsOwnerAuthority, OWNER_ROLE } from './ownerAuthority';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── §A THE RED CASE, STATED DIRECTLY ─────────────────────────────────────────────
// `BusinessProvider` resolves BOTH the owner_id holder and an OWNER-role member to 'OWNER',
// which is why one comparison covers the two-owner case without a second branch.
ok(holdsOwnerAuthority('OWNER'), '🔴 P1 an OWNER-role member holds owner authority — Lauren, the live defect');
ok(holdsOwnerAuthority('owner'), '🔴 P2 the role compares case-insensitively — the client uppercases, the ROW may not');
ok(holdsOwnerAuthority('  Owner  '), 'P3 surrounding whitespace in a stored role does not silently deny');

// ── §B THE EXCLUSIONS — THE HALF OF R-80 THAT SURVIVES UNCHANGED ─────────────────
ok(!holdsOwnerAuthority('MANAGER'), '🔴 P4 MANAGER is REFUSED — the manager floor holds settings:update and orders:create; this is the whole reason R-80 rejected a permission gate');
ok(!holdsOwnerAuthority('manager'), '🔴 P5 MANAGER is refused case-insensitively too — a lowercase row must not sneak through');
ok(!holdsOwnerAuthority('STAFF'), 'P6 STAFF is refused');
ok(!holdsOwnerAuthority('ADMIN'), 'P7 a role we do not use is refused — the predicate is an allowlist of ONE, never a denylist');
ok(!holdsOwnerAuthority('OWNER_READONLY'), '🔴 P8 a role that merely STARTS WITH "owner" is refused — the check is equality, not a prefix/substring match');
ok(!holdsOwnerAuthority('CO-OWNER'), '🔴 P9 a role that CONTAINS "owner" is refused — same defect from the other side');

// ── §C ABSENCE IS NOT AUTHORITY (D-9) ────────────────────────────────────────────
ok(!holdsOwnerAuthority(null), 'P10 null role → refused (unresolved session must not read as owner)');
ok(!holdsOwnerAuthority(undefined), 'P11 undefined role → refused');
ok(!holdsOwnerAuthority(''), 'P12 empty role → refused');
ok(!holdsOwnerAuthority('   '), 'P13 whitespace-only role → refused — it is blank, not an owner');

// ── §D THE CONSTANT IS THE SOURCE, NOT A SECOND SPELLING (STD-011) ───────────────
// If someone re-spells OWNER_ROLE, the predicate must move with it. A test that hardcoded
// 'OWNER' on both sides would pass while the two drifted, which is the #179 shape.
ok(holdsOwnerAuthority(OWNER_ROLE), 'P14 the exported constant satisfies the predicate — one definition, not two spellings');
ok(OWNER_ROLE === OWNER_ROLE.toUpperCase(), 'P15 the constant is stored in the form the comparison folds to');

console.log(`\nownerAuthority — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
