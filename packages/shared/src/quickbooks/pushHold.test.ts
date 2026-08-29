/**
 * ── pushHold — the switch that stands between a live customer's books and twelve literals ──
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST. Not a string parser. This predicate is the only thing that
 * stops the FIRST completed checkout on LAWNS from writing generic "Services" lines into
 * Terry's real QuickBooks — because the push is INLINE and UNCONDITIONAL at the end of
 * checkout and there is no step a person can decline. Every probe below is written as
 * "which way does this fail?", and the answer must never be "it pushes".
 *
 * ⚠️ THE ONE DELIBERATE FAIL-OPEN, stated so it is not mistaken for an oversight: an UNSET
 * variable means NO hold. Defaulting to hold-everything would silently stop pushes for every
 * tenant on any deploy lacking the var. That is why the hold is also READABLE from
 * /api/qbo/status — the operator verifies it rather than trusting propagation.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/quickbooks/pushHold.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { isPushHeld, pushHoldReason, QBO_PUSH_HOLD_ENV } from './pushHold';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const LAWNS = 'ed2e5933-45dc-4b9b-a331-ddfd125e7a74';
const TESTDAVE = 'f7ec5d67-a9ef-4cb0-b807-438d67687d1b';

// ══ §A THE LIVE CASE — LAWNS held, nobody else ══════════════════════════════
{
  ok(isPushHeld(LAWNS, LAWNS) === true,
    '🔴 THE CASE THIS EXISTS FOR: with LAWNS in the hold list, LAWNS is held');
  ok(isPushHeld(LAWNS, TESTDAVE) === false,
    'and a DIFFERENT tenant is not — the hold is precise, not a global kill');
  ok(isPushHeld(`${LAWNS},${TESTDAVE}`, TESTDAVE) === true, 'a two-id list holds both');
  ok(isPushHeld('all', LAWNS) === true && isPushHeld('all', TESTDAVE) === true,
    '`all` holds every business — the panic setting');
  ok(isPushHeld('ALL', LAWNS) === true, 'and `all` is case-insensitive, because it will be typed by hand');
}

// ══ §B UNSET MEANS NO HOLD — the deliberate fail-open, asserted so it stays deliberate ══
{
  ok(isPushHeld(undefined, LAWNS) === false, 'unset → no hold (behaviour preserved for every tenant)');
  ok(isPushHeld('', LAWNS) === false, 'empty → no hold');
  ok(isPushHeld('   ', LAWNS) === false, 'whitespace-only → no hold');
  ok(isPushHeld(null, LAWNS) === false, 'null → no hold');
  ok(isPushHeld(undefined, undefined) === false,
    'unset AND no business → no hold; with no hold configured there is nothing to fail closed ABOUT');
}

// ══ §C AN ACTIVE HOLD LIST NEVER DEGRADES INTO A PUSH ═══════════════════════
{
  ok(isPushHeld(LAWNS, undefined) === true,
    '🔴 THE ONE THAT MATTERS MOST: a hold list is SET but the caller could not name the business → HELD. A live hold plus an unknown target is not permission to write to somebody\'s books');
  ok(isPushHeld(LAWNS, '') === true, 'same for an empty business id');
  ok(isPushHeld(LAWNS, null) === true, 'same for null');
  ok(isPushHeld(LAWNS, '   ') === true, 'same for whitespace — trimmed to empty, still held');
}

// ══ §D THE WAYS A HAND-EDITED ENV VAR GETS MANGLED ══════════════════════════
{
  ok(isPushHeld(` ${LAWNS} `, LAWNS) === true, 'surrounding whitespace does not defeat the hold');
  ok(isPushHeld(`${LAWNS},`, LAWNS) === true, 'a trailing comma does not defeat it');
  ok(isPushHeld(`,${LAWNS}`, LAWNS) === true, 'nor a leading one');
  ok(isPushHeld(`${LAWNS} , ${TESTDAVE}`, TESTDAVE) === true, 'nor spaces around the separator');
  ok(isPushHeld(LAWNS.toUpperCase(), LAWNS) === true,
    '🔴 case does not defeat it — a UUID is case-insensitive in Postgres and gets pasted out of a dashboard by hand. A case difference must never be why a real company got written to');
  ok(isPushHeld(LAWNS, LAWNS.toUpperCase()) === true, 'in either direction');
  ok(isPushHeld(`${LAWNS},,${TESTDAVE}`, TESTDAVE) === true, 'an empty entry between commas is skipped, not treated as a match-all');
  ok(isPushHeld(',,,', LAWNS) === false,
    'a list of nothing but separators holds NOTHING — it parses to zero ids, and an id that is not listed is not held');
}

// ══ §E NO ACCIDENTAL SUBSTRING MATCHING ═════════════════════════════════════
{
  ok(isPushHeld(LAWNS, LAWNS.slice(0, 8)) === false,
    'a PREFIX of a held id is not held — ids are compared whole, so a truncated paste does not silently inherit a hold it was never given');
  ok(isPushHeld(LAWNS.slice(0, 8), LAWNS) === false, 'and a truncated LIST entry does not hold the full id');
  ok(isPushHeld('all-tenants-someday', LAWNS) === false,
    "🔴 a value merely STARTING with 'all' is not the `all` sentinel — it is an unrecognised id, and it holds nothing it does not name");
}

// ══ §F THE SENTENCE AND THE NAME ════════════════════════════════════════════
{
  ok(QBO_PUSH_HOLD_ENV === 'QBO_PUSH_HOLD', 'the env var name is fixed in one place — the server and the status endpoint read the same key or the readout lies');
  const r = pushHoldReason();
  ok(r.length > 0 && /paused/i.test(r), 'the owner is told the push was PAUSED');
  ok(/saved and correct/i.test(r),
    'and told the ORDER is fine — a held push must not read as a failed order, because the order genuinely completed');
  ok(/David/.test(r),
    '🔴 and told WHO CAN LIFT IT. Lauren made eight add attempts against a refusal that never named an actor; a refusal without an actor generates retries');
  ok(!/not connected|isn't connected|reconnect/i.test(r),
    "🔴 and it must NEVER say 'not connected' — QuickBooks IS connected, and telling an owner to reconnect it is exactly the D-48 defect this state was created to avoid");
}

console.log(`\npushHold: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
