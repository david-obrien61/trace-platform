/**
 * ── testMode — the switch between "seeing what comes out" and writing to real books ──
 *
 * 🔴 WHAT IS ACTUALLY UNDER TEST. Not string formatting. Two questions whose wrong answers
 * have opposite and both-expensive consequences:
 *   · answered "live" when it is test  → a fake invoice lands in a real company's accounting
 *   · answered "test" when it is live  → a week of real sales never reaches the books, and
 *                                        nobody finds out until a bookkeeper does
 * §B is written entirely around the second one, because it is the one nobody builds for.
 *
 * 🔴 §D IS A SOURCE PROBE AND IT IS THE POINT OF THE FILE. The guard that stops a test order
 * reaching QuickBooks is unrecoverable if it fails — a QuickBooks customer created by a test
 * order is a real row in a real chart of customers. So its ORDERING relative to the invoice
 * POST and to findOrCreateQBCustomer is asserted against the actual source, the same way
 * historyOrder.test.ts §I asserts it for the history guard. A guard that exists but runs
 * second is not a guard.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/testMode.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  isTestMode, orderKindForMode, pushPermitted,
  TEST_MODE_BANNER, testModeExplanation, writeSwitchConfirmation, LIVE_MODE_CONFIRMED,
} from './testMode';
import { TEST_ORDER_KIND } from './orderKind';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

// ══ §A THE MODE ═════════════════════════════════════════════════════════════
{
  ok(isTestMode(false) === true,  'writes off → test mode');
  ok(isTestMode(true)  === false, 'writes on → live');
  ok(orderKindForMode(false) === TEST_ORDER_KIND, 'an order born in test mode is marked `test` IN THE DATA');
  ok(orderKindForMode(true)  === null,
    '🔴 and an order born live carries NULL — going live STOPS ADDING A MARK rather than adding a different one, so a live business writes exactly the rows it always did');
}

// ══ §B 🔴 THE UNKNOWN VALUE, WHICH IS THE HALF THAT MATTERS ═════════════════
{
  ok(isTestMode(undefined) === true,
    '🔴 A VALUE NOBODY READ IS TEST MODE. undefined means the column was not selected, or the row was not fetched — reading that as "live" would push a real invoice on the strength of a value nobody saw');
  ok(isTestMode(null) === true, 'and so is null');
  ok(orderKindForMode(undefined) === TEST_ORDER_KIND,
    'so an order written during an unreadable-state moment is marked as a test rather than silently joining the real books');
  // Belt-and-braces on the exact comparison: `!== true` and not a truthiness check, so a
  // string 'false' read out of a query string can never be mistaken for live.
  ok(isTestMode('true' as unknown as boolean) === true,
    'a STRING "true" is not the boolean true — a mode must not be enterable by anything that merely looks truthy');
}

// ══ §C TWO SWITCHES, AND-ED — neither can override the other ════════════════
{
  ok(pushPermitted({ writesEnabled: true,  platformHeld: false }) === true,
    'owner on + no platform hold → the only combination that permits a push');
  ok(pushPermitted({ writesEnabled: true,  platformHeld: true  }) === false,
    '🔴 the OPERATOR hold survives the owner switching writes on — a customer cannot switch past David');
  ok(pushPermitted({ writesEnabled: false, platformHeld: false }) === false,
    '🔴 and a forgotten env var cannot make a customer live before they said so');
  ok(pushPermitted({ writesEnabled: false, platformHeld: true  }) === false, 'both off → off');
  ok(pushPermitted({ writesEnabled: undefined, platformHeld: false }) === false,
    'an unread switch does not permit a push');
}

// ══ §D 🔴 THE GUARD IN THE REAL SOURCE — existence AND ordering ═════════════
{
  const src  = readFileSync(join(process.cwd(), 'packages/cultivar-os/api/qbo/invoice/cultivar.ts'), 'utf8');

  // 🔴 COMMENTS ARE STRIPPED BEFORE ANY INDEX IS TAKEN, AND THIS PROBE FOUND OUT WHY THE HARD
  // WAY — it went RED on its first run against correct code. The guard's own comment explains
  // that it sits above `findOrCreateQBCustomer`, so `indexOf` found that NAME inside the
  // comment, at a position BEFORE the guard, and the ordering assertion failed. The guard was
  // right; the probe was measuring prose.
  //
  // That is the same lesson historyOrder.test.ts §I already carries in a different disguise
  // ("textual position is not control flow") — and it is worse than the version recorded there,
  // because a comment can move an index in EITHER direction. A probe like this could just as
  // easily have PASSED on a deleted guard because some comment still mentioned it. Stripping
  // is not tidiness; it is the difference between reading code and reading a description of it.
  //
  // ⚠️ THE LIMIT, STATED: this strips block comments and WHOLE-LINE `//` comments only. A
  // trailing comment after code on the same line survives, deliberately — stripping those
  // safely means not mangling `https://` inside a string literal, and this file does not need
  // to solve lexing to stop reading a doc-comment as control flow.
  const stripComments = (t: string): string =>
    t.replace(/\/\*[\s\S]*?\*\//g, '')
     .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');

  // Scoped to pushQboInvoice's BODY. historyOrder.test.ts §I records why: `findOrCreateQBCustomer`
  // is DEFINED above this function and CALLED from inside it, and textual position is not
  // control flow. Slicing from the function keyword is what makes the indexes comparable.
  const body      = stripComments(src.slice(src.indexOf('export async function pushQboInvoice')));
  const guardAt   = body.indexOf('order.order_kind === TEST_ORDER_KIND');
  const custAt    = body.indexOf('findOrCreateQBCustomer');
  const postAt    = body.indexOf('qbPost');
  const invoiceAt = body.indexOf('invoiceResp');

  ok(guardAt > -1, 'THE GUARD EXISTS — pushQboInvoice tests order_kind against the shared constant');
  ok(/TEST_ORDER_KIND\s*\}\s*from\s*'[^']*orderKind'/.test(src),
    'and it imports that constant from the ONE module rather than re-typing \'test\' (a re-typed literal is a typo away from admitting everything)');
  ok(guardAt > -1 && invoiceAt > -1 && guardAt < invoiceAt,
    '🔴 THE ORDERING IS THE GUARANTEE: the refusal precedes the invoice POST');
  ok(guardAt > -1 && custAt > -1 && guardAt < custAt,
    '🔴 AND IT PRECEDES findOrCreateQBCustomer — THE HALF PEOPLE FORGET. A test order that creates a QuickBooks CUSTOMER and no invoice has still written to their books');
  ok(guardAt > -1 && postAt > -1 && guardAt < postAt,
    'and it precedes every qbPost in the function');
  // 🔴 THE WINDOW ENDS WHERE THE NEXT GUARD BEGINS, AND THE FIRST VERSION OF THIS DID NOT.
  // It read a fixed 1400 characters from the guard, which reaches straight into the HISTORY
  // guard sitting immediately below — so the 422 assertion passed on the NEIGHBOUR'S 422.
  // Measured, not reasoned about: mutant M3 changed this guard's status to 403 and SURVIVED.
  // A window that spills into adjacent code asserts something about that code instead, which
  // is the same seam-blindness as a probe short-circuiting on an earlier guard (R-33 ②).
  const nextGuardAt = body.indexOf('order.order_kind ===', guardAt + 1);
  const ownBlock    = body.slice(guardAt, nextGuardAt > -1 ? nextGuardAt : guardAt + 1400);
  ok(/TEST_ORDER_NOT_PUSHABLE/.test(ownBlock),
    'it carries a machine-readable code distinct from the history refusal');
  ok(/status:\s*422/.test(ownBlock),
    '422 not 403 — the caller IS authorised, the REQUEST is incoherent. Asserted against THIS guard\'s own block, not a window that reaches the next one');
  ok(/\[TRACE:QBO\] REFUSED[^\n]*test order/.test(body),
    'and the failed intent is LOGGED rather than dropped');

  // 🔴 THE TWO GUARDS ARE SEPARATE BRANCHES, AND A PROBE HOLDS THEM APART. Collapsing them
  // would force one sentence to explain two different refusals to the owner.
  const histAt = body.indexOf('order.order_kind === HISTORY_ORDER_KIND');
  ok(histAt > -1 && guardAt > -1 && histAt !== guardAt,
    'the history guard is a SEPARATE branch and both survive — neither replaced the other');
  ok(histAt > -1 && histAt < custAt && histAt < postAt,
    'and the history guard STILL precedes the customer create and the POST (this build did not move it)');
}

// ══ §E THE SENTENCES — what they must and must not say ══════════════════════
{
  ok(/QuickBooks/.test(TEST_MODE_BANNER) && /not/i.test(TEST_MODE_BANNER),
    'the banner names QuickBooks and says something is NOT happening');
  ok(/saved/i.test(TEST_MODE_BANNER),
    '🔴 and it says the orders ARE saved — "test mode" alone leaves an owner guessing whether their work is being kept at all');
  ok(/sales figures|totals/i.test(TEST_MODE_BANNER),
    'and that they are kept out of the figures');

  const c = writeSwitchConfirmation('LAWNS Tree Farm');
  ok(/LAWNS Tree Farm/.test(c), 'the confirmation names the business whose books are about to be written to');
  ok(/will be written to QuickBooks/.test(c),
    '🔴 IT STATES WHAT CHANGES, IN THE FUTURE TENSE — consent to a consequence, not "are you sure?"');
  ok(/cannot be undone|still uses up its number/.test(c),
    'and that it cannot be taken back — an invoice deleted in QuickBooks still consumes its number');
  ok(/NOT affected|stay marked as tests/.test(c),
    '🔴 AND IT SAYS WHAT DOES NOT HAPPEN — the week of test orders does not become real. That is the half a confirmation usually omits and the half this owner will worry about');
  ok(!/Are you sure/i.test(c), 'it never asks "are you sure" — that asks someone to re-affirm a decision without telling them what it does');

  ok(writeSwitchConfirmation(null).includes('this business') && writeSwitchConfirmation('  ').includes('this business'),
    'a missing or blank name falls back to a phrase that still reads as a sentence, never to an empty gap');
  ok(/on\b/.test(LIVE_MODE_CONFIRMED) && /QuickBooks/.test(LIVE_MODE_CONFIRMED), 'the live confirmation states the new state');
  ok(testModeExplanation().length > TEST_MODE_BANNER.length,
    'the settings explanation is the longer form — the banner is not simply repeated where there is room to explain');
}

console.log(`\n  testMode — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
