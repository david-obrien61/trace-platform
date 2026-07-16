/**
 * ── QBO customer identity — the D-47 three-way rule · 2026-07-16 ──
 *
 * Proves the rule that replaces the email-only match. The anchor case is the REAL one that
 * cross-billed nine invoices: TRACE "TERRENCE OBRIEN" / david_obrien2016@outlook.com shares
 * an email with QBO customer 81 "Andrew O'Brien" — the OLD matcher linked them; the new rule
 * MUST create instead.
 *
 * Run (no test runner installed — pure TS, esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/customerIdentity.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { resolveQboCustomerMatch, type QboCustomerCandidate } from './customerIdentity';
import { personNamesMatch } from '../utils/personName';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const ANDREW: QboCustomerCandidate  = { id: '81', displayName: "Andrew O'Brien", email: 'david_obrien2016@outlook.com' };
const TERRENCE: QboCustomerCandidate = { id: '99', displayName: 'TERRENCE OBRIEN', email: 'david_obrien2016@outlook.com' };
const TRACE_TERRENCE = { name: 'TERRENCE OBRIEN', email: 'david_obrien2016@outlook.com' };

// ── THE SCAR: email matches Andrew, name does not → CREATE, never link ────────────────
{
  const v = resolveQboCustomerMatch(TRACE_TERRENCE, [ANDREW]);
  ok(v.action === 'create', 'THE SCAR: email-YES/name-NO → CREATE (not link onto Andrew)');
  ok(v.qbCustomerId === undefined, 'THE SCAR: no qb id handed back — nothing to mis-bill');
  ok(v.emailHits.length === 1 && v.emailHits[0].id === '81', 'THE SCAR: the email hit is still OBSERVABLE in the verdict');
}

// ── email + name concur on ONE record → the only safe LINK ────────────────────────────
{
  const v = resolveQboCustomerMatch(TRACE_TERRENCE, [TERRENCE]);
  ok(v.action === 'link' && v.qbCustomerId === '99', 'email-YES/name-YES → LINK to 99');
}

// ── the real post-fix world: BOTH Andrew and Terrence share the email ─────────────────
{
  const v = resolveQboCustomerMatch(TRACE_TERRENCE, [ANDREW, TERRENCE]);
  ok(v.action === 'link' && v.qbCustomerId === '99',
    'two email-sharers → link the one whose NAME agrees (99), never the arbitrary first hit (81)');
}
{
  // Order must not matter — the old bug was literally "take candidates[0]".
  const v = resolveQboCustomerMatch(TRACE_TERRENCE, [TERRENCE, ANDREW]);
  ok(v.action === 'link' && v.qbCustomerId === '99', 'candidate ORDER does not decide identity');
}

// ── nothing matches → CREATE ─────────────────────────────────────────────────────────
{
  const v = resolveQboCustomerMatch({ name: 'Jane Doe', email: 'jane@example.com' }, [ANDREW]);
  ok(v.action === 'create', 'email-no/name-no → CREATE (new party)');
}
{
  const v = resolveQboCustomerMatch({ name: 'Jane Doe', email: 'jane@example.com' }, []);
  ok(v.action === 'create', 'empty candidate set → CREATE');
}

// ── name matches but email differs → SURFACE (could be a 2nd David Smith) ─────────────
{
  const other: QboCustomerCandidate = { id: '55', displayName: 'David Smith', email: 'other.david@example.com' };
  const v = resolveQboCustomerMatch({ name: 'David Smith', email: 'david@example.com' }, [other]);
  ok(v.action === 'surface', 'name-YES/email-no → SURFACE, never link and never blind-create');
  ok(/different person with the same name/i.test(v.reason), 'surface reason is owner-actionable');
}

// ── split case: email hits record A, name hits record B → SURFACE ─────────────────────
{
  const nameTwin: QboCustomerCandidate = { id: '77', displayName: 'TERRENCE OBRIEN', email: 'someone.else@example.com' };
  const v = resolveQboCustomerMatch(TRACE_TERRENCE, [ANDREW, nameTwin]);
  ok(v.action === 'surface', 'email→A but name→B (different records) → SURFACE, never pick one');
}

// ── D-9 applied to identity: absence is NOT agreement ────────────────────────────────
{
  const nameless: QboCustomerCandidate = { id: '10', displayName: null, email: null };
  const v = resolveQboCustomerMatch({ name: null, email: null }, [nameless]);
  ok(v.action === 'create', 'two blank identities must NOT match each other (empty ≠ agreement)');
}
{
  const blankEmail: QboCustomerCandidate = { id: '11', displayName: 'TERRENCE OBRIEN', email: null };
  const v = resolveQboCustomerMatch({ name: 'TERRENCE OBRIEN', email: null }, [blankEmail]);
  ok(v.action === 'surface', 'name agrees but BOTH emails blank → not a concur → SURFACE, never link on one field');
}

// ── the apostrophe rule — why personName is not nameTokenSet ─────────────────────────
ok(personNamesMatch('TERRENCE OBRIEN', "Terrence O'Brien"), "apostrophe elided: TERRENCE OBRIEN == Terrence O'Brien");
ok(!personNamesMatch('TERRENCE OBRIEN', "Andrew O'Brien"), 'shared surname is NOT identity');
ok(personNamesMatch('John Smith', 'Smith, John'), "QBO's 'Last, First' convention matches TRACE's 'First Last'");
ok(personNamesMatch('John A. Smith', 'John Smith'), 'middle initial is not identity');
ok(!personNamesMatch('John Smith', 'John Smith Jr'), 'a suffix IS a discriminator → no match → safe CREATE');
ok(!personNamesMatch('', ''), 'empty never matches empty');
ok(!personNamesMatch(null, null), 'null never matches null');
ok(personNamesMatch("Dave's Tree Svs", 'Daves Tree Svs'), "org apostrophe elided: Dave's == Daves");

// ── a linked customer whose QBO name drifts must NOT verify ──────────────────────────
ok(!personNamesMatch('TERRENCE OBRIEN', "Andrew O'Brien"),
  'stored-link verification: TERRENCE vs Andrew fails → push refuses (the invoice-#1 catch)');

console.log(`\n  customerIdentity (D-47): ${passed} passed, ${failed} failed`);
if (failed > 0) { failures.forEach(f => console.error('   ✗ ' + f)); process.exit(1); }
