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
  TEST_MODE_BANNER, TEST_MODE_STOCK_CAVEAT, testModeExplanation, writeSwitchConfirmation, LIVE_MODE_CONFIRMED,
} from './testMode';
import { TEST_ORDER_KIND } from './orderKind';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}

/**
 * 🔴 STRIP COMMENTS BEFORE ASSERTING ANYTHING ABOUT SOURCE — and this build needed it THREE
 * TIMES, which is why it is a shared helper rather than three local copies.
 *
 *   ① §D's ordering probe went red because the new guard's comment NAMES `findOrCreateQBCustomer`
 *   ② `historyOrder.test.ts` §I went red for the identical reason, on a probe that had passed
 *      for weeks — meaning it had been readable-as-prose the whole time
 *   ③ §F's "no service key" probe matched the word SERVICE KEY inside a paragraph explaining
 *      why this component deliberately does NOT use one
 *
 * ✏️ THE THIRD IS THE ONE THAT SHOWS THE SHAPE, because it is the opposite polarity: ① and ②
 * were false REDS against correct code, ③ was a false RED against code that says the right
 * thing. The same mechanism produces false GREENS — a probe asserting a guard exists will pass
 * on a deleted guard whose comment survives. That is R-33 exactly (the thing asserting was
 * incapable of disagreeing), and a source probe is the easiest place in this repo to build one
 * by accident, because the file being read is mostly prose by volume.
 *
 * ⚠️ THE LIMIT, STATED: block comments and WHOLE-LINE `//` comments only. A trailing comment
 * after code on the same line survives, deliberately — stripping those safely means not
 * mangling `https://` inside a string literal, and no probe here needs lexing to stop reading
 * a doc-comment as control flow.
 */
function stripComments(t: string): string {
  return t.replace(/\/\*[\s\S]*?\*\//g, '')
          .split('\n').filter(l => !l.trim().startsWith('//')).join('\n');
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

  // Comments are stripped first — see `stripComments` above for the three separate times this
  // build needed it and why the false-GREEN direction is the dangerous one.

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
  // ══════════════════════════════════════════════════════════════════════════
  // 🔴 THESE TWO ARE ASSERTED VERBATIM, WHICH IS UNUSUAL AND DELIBERATE.
  // ══════════════════════════════════════════════════════════════════════════
  // Everywhere else this suite tests BEHAVIOUR and lets wording move. Here the wording IS the
  // ruling: David wrote both sentences himself (2026-09-02) to answer the question this build
  // raised and did not decide — *does a test order deplete stock?* — and his clause was that
  // if the answer is no, the SCREEN MUST SAY SO. A paraphrase that keeps the meaning does not
  // keep the ruling, and the earlier version of this section asserted the shape of MY wording,
  // so it went green on copy David had not seen and red on copy he had written.
  //
  // ⚠️ If these fail, the right move is to check whether David changed the wording — not to
  // relax the assertion.
  ok(TEST_MODE_BANNER === 'TEST MODE — nothing you do here reaches QuickBooks, and your tree counts do not change.',
    '🔴 THE BANNER IS DAVID\'S SENTENCE, VERBATIM');
  ok(TEST_MODE_STOCK_CAVEAT === 'Because stock does not move in test mode, this is not a test of whether the system tracks your trees. That happens after you switch writes on.',
    '🔴 AND SO IS THE STOCK CAVEAT — the sentence that says what is NOT being proven, which is the one that matters');

  ok(/QuickBooks/.test(TEST_MODE_BANNER) && /do not change/.test(TEST_MODE_BANNER),
    'the banner names BOTH protections — the accounting write and the tree counts');
  ok(/not a test of/.test(TEST_MODE_STOCK_CAVEAT) && /after you switch writes on/.test(TEST_MODE_STOCK_CAVEAT),
    '🔴 the caveat names the GAP and when it closes — a screen that only says what it protects lets somebody conclude they have tested something they have not');
  ok(!/stock is unaffected/i.test(TEST_MODE_BANNER + TEST_MODE_STOCK_CAVEAT),
    '🔴 AND IT IS NOT SHORTENED TO "stock is unaffected" — David named that phrasing as the one to avoid, because it reads as a FEATURE rather than as a capability deliberately not exercised yet');

  // 🔴 THE CONTRADICTION THAT SHIPPED FOR AN HOUR AND WOULD HAVE SHIPPED FOREVER.
  // testModeExplanation opened with "you can use every part of the system exactly as you would
  // in the real thing" — false in the one way that matters once stock is named, and it is the
  // LONGER text, which is the one a careful reader trusts. A banner and an explanation
  // disagreeing about one mode is STD-011 where it does the most damage.
  ok(!/every part of the system exactly as you would/.test(testModeExplanation()),
    '🔴 THE SETTINGS EXPLANATION DOES NOT CONTRADICT THE BANNER — it no longer claims every part of the system behaves as it really would');
  ok(testModeExplanation().includes(TEST_MODE_STOCK_CAVEAT),
    'and it CARRIES the caveat rather than restating it in its own words (one sentence, one home)');

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

// ══ §F 🔴 THE WRITE SWITCH — NARROWNESS AND AUTHORITY, ASSERTED IN SOURCE ═══
// This section exists because `verify-write-paths.mjs` DECLARES this path as an allowed fourth
// writer of `businesses`, and that declaration makes two claims: the write touches exactly one
// column, and its authority is the RLS policy rather than a hand-written check. A declaration
// citing a probe that does not exist is R-31's class in the caps' own machinery — so the probe
// exists, and it fails the build if either claim stops being true.
{
  const swRaw = readFileSync(join(process.cwd(), 'packages/shared/src/components/QboWriteSwitch.tsx'), 'utf8');
  const sw = stripComments(swRaw);

  const update = /\.update\(\{([^}]*)\}\)/.exec(sw);
  const keys = update ? update[1].split(',').map(k => k.split(':')[0].trim()).filter(Boolean) : [];
  ok(keys.length === 1 && keys[0] === 'qbo_writes_enabled',
    `🔴 THE PATCH KEY SET IS EXACTLY ['qbo_writes_enabled'] — the write-paths declaration says this table has four DISJOINT writers, and a second key here would silently make that false (got: ${JSON.stringify(keys)})`);

  ok(/\.select\('id'\)/.test(sw) && /data\.length !== 1/.test(sw),
    '🔴 R-12 — THE WRITE PROVES IT WROTE. A Postgres UPDATE matching ZERO rows returns error:null, which is exactly what a manager\'s refused attempt looks like; reporting that as done would tell someone their books are live when nothing changed');

  ok(!/fetch\(/.test(sw) && !/SERVICE_KEY/.test(sw),
    '🔴 IT DOES NOT GO THROUGH A SERVICE-KEY ENDPOINT. The write runs under the owner\'s OWN session so `businesses_owner_update` is the gate — routing it through the service key would replace a real database policy with a hand-written check somebody has to keep correct');

  ok(/isOwner/.test(sw) && /Only the account owner/.test(sw),
    'a non-owner is TOLD whose decision this is rather than shown a dead greyed control (§6 r13 — locked WITH an explanation, never mystery-locked)');
  ok(/writeSwitchConfirmation/.test(sw),
    'and turning writes on goes through the confirmation that states what changes');
}

// ══ §G THE BANNER IS NOT DISMISSABLE — asserted, because it is the whole feature ══
{
  const bn = stripComments(readFileSync(join(process.cwd(), 'packages/shared/src/components/TestModeBanner.tsx'), 'utf8'));
  ok(!/onClick/.test(bn) && !/dismiss/i.test(bn),
    '🔴 THE BANNER HAS NO CLICK HANDLER AND NO DISMISS PATH IN ITS CODE — a banner that can be dismissed is dismissed on day one, and the mode is then invisible for the rest of the week');
  ok(/isTestMode/.test(bn) && /TEST_MODE_BANNER/.test(bn),
    'it reads the mode and the sentence from the SAME module the order writer reads, so it cannot claim a state the server disagrees with');
  ok(/if \(loading\) return null/.test(bn),
    'and it stays silent during the FIRST load — a warning that flashes on every navigation for a live business is a warning people learn to ignore');

  // 🔴 THE CAVEAT HAS A HOME, AND IT IS THE POINT OF ACTION. The hand-off that carried David's
  // ruling noted this string had "no home yet — a new string plus a mount, not an edit". A
  // sentence exported and never rendered is the write-only-column defect #252 was built to end.
  const cv = stripComments(readFileSync(join(process.cwd(), 'packages/shared/src/components/TestModeStockCaveat.tsx'), 'utf8'));
  ok(/TEST_MODE_STOCK_CAVEAT/.test(cv) && /isTestMode/.test(cv),
    'the caveat component renders the shared sentence and gates on the shared mode');
  const cart = stripComments(readFileSync(join(process.cwd(), 'packages/cultivar-os/src/pages/CartReview.tsx'), 'utf8'));
  ok(/<TestModeStockCaveat \/>/.test(cart),
    '🔴 AND IT IS MOUNTED ON THE RING-UP SCREEN — the sentence is only TRUE of the act of ringing an order up, so it belongs where that happens rather than in the global banner');
  const submitAt = cart.indexOf('handleSubmit(true)');
  ok(cart.indexOf('<TestModeStockCaveat />') > -1 && cart.indexOf('<TestModeStockCaveat />') < submitAt,
    'and it sits ABOVE the submit buttons — a caveat read after the action is not a caveat');

  // 🔴 ONE COPY OF THE BANNER SENTENCE. The settings screen carried its own shorter version and
  // it went stale the moment the ruling landed, describing the same mode differently.
  const sw2 = stripComments(readFileSync(join(process.cwd(), 'packages/shared/src/components/QboWriteSwitch.tsx'), 'utf8'));
  ok(/TEST_MODE_BANNER/.test(sw2) && !/nothing is being sent to QuickBooks/.test(sw2),
    '🔴 the settings screen RENDERS the shared banner string rather than keeping a second, shorter copy of it (STD-011 — the copy that drifts is never the one you are looking at)');
}

console.log(`\n  testMode — ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
