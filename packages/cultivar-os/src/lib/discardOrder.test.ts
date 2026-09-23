/**
 * ── discardOrder — a back arrow that discarded the order, and the confirm that now guards it ───
 *
 * WHAT THIS GUARDS. Until 2026-09-23 `/checkout/scan`'s header was:
 *     <button onClick={exit} aria-label="Cancel order"><ArrowLeft/></button>
 *     function exit() { clear(); navigate('/orders'); }
 * An arrow that looked like BACK and performed DISCARD EVERYTHING — no confirm, no undo, and
 * nothing persisted to go back to. David found it live by doing exactly what it invites:
 * starting an order, backing out, and looking for the draft.
 *
 * 🔴 §C IS THE ONE THAT MATTERS AND IT READS THE PAGE, NOT THIS MODULE. Every assertion about
 * copy could pass while the button stayed wired to the destructive path — the defect was never in
 * the words, it was in which function the arrow called. §C parses `ScanOrder.tsx` and asserts the
 * WIRING: that the header's arrow reaches a handler that does not clear, and that `clear()` is
 * reachable only from the confirmed path. A test of this module alone would be testing around the
 * defect (tech-debt #182's class).
 *
 * Run: node scripts/run-tests.mjs discardOrder
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { discardStake, needsDiscardConfirm, discardConfirmCopy } from './discardOrder';
import type { CartItem } from '../types/order';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) { passed++; return; }
  failed++; failures.push(msg); console.error('   ✗ ' + msg);
}

const line = (quantity: number): CartItem => ({ plant: { common_name: 'Live Oak' } as never, quantity });

// ── §A — THE STAKE. Both numbers, because one line can carry twenty plants ───────────────────
{
  ok(discardStake([]).lines === 0 && discardStake([]).plants === 0, '§A an empty order stakes nothing');
  const s = discardStake([line(3), line(4)]);
  ok(s.lines === 2 && s.plants === 7, '§A 🔴 two lines, SEVEN plants — the number a person actually cares about losing');
  ok(discardStake([line(0)]).plants === 0, '§A a zero-quantity line contributes no plants');
}

// ── §B — WHEN A CONFIRM IS OWED, AND WHEN IT IS NOISE ────────────────────────────────────────
{
  ok(needsDiscardConfirm([]) === false,
    '§B 🔴 an EMPTY order asks nothing — a confirm with nothing at stake is the dialog people learn to dismiss unread');
  ok(needsDiscardConfirm([line(1)]) === true, '§B one line is enough to owe a confirm');
}

// ── §C — 🔴 THE WIRING. The defect was here, not in the copy. ────────────────────────────────
{
  const src = readFileSync(join(process.cwd(), 'packages/cultivar-os/src/pages/ScanOrder.tsx'), 'utf8');
  const code = src.replace(/\/\*[\s\S]*?\*\//g, '').split('\n').filter(l => !l.trimStart().startsWith('//')).join('\n');

  // The header arrow. Find the ArrowLeft button and read the handler it calls.
  const arrowBtn = code.match(/<button[^>]*onClick=\{(\w+)\}[^>]*>\s*<ArrowLeft/);
  ok(!!arrowBtn, '§C the header still renders an ArrowLeft button (if this fails the probe has lost its target)');
  const arrowHandler = arrowBtn?.[1] ?? '';
  ok(arrowHandler === 'back',
    `§C 🔴 THE ARROW CALLS back() — it called exit(), which cleared the cart. Got "${arrowHandler}"`);

  // …and that handler must not clear.
  // 🔴 SLICED TO THE FUNCTION'S OWN BODY, NOT A FIXED CHARACTER COUNT. A first draft took 200
  // characters from `function back(` — which runs past the closing brace into the NEXT function,
  // so mutant M3 (a change inside `requestDiscard`) failed this assertion as though `back` had
  // been altered. It went red for a defect that was real but not the one it names, which is a
  // probe passing its verdict on evidence it did not read (tech-debt #182's class).
  const bodyOf = (name: string): string => {
    const at = code.indexOf(`function ${name}(`);
    if (at < 0) return '';
    const open = code.indexOf('{', at);
    let depth = 0;
    for (let i = open; i < code.length; i++) {
      if (code[i] === '{') depth++;
      else if (code[i] === '}') { depth--; if (depth === 0) return code.slice(open, i + 1); }
    }
    return code.slice(open);
  };
  const backBody = bodyOf(arrowHandler);
  ok(!/\bclear\(\)/.test(backBody),
    '§C 🔴 THE DEFECT, PINNED: the back handler does NOT call clear(). This is the assertion that fails if anyone re-wires it.');

  // clear() is reachable from exactly ONE place, and that place is behind the confirm.
  const clearCalls = (code.match(/^\s*clear\(\);/gm) ?? []).length;
  ok(clearCalls === 1, `§C clear() is called exactly once on this page — got ${clearCalls}`);
  const discardBody = bodyOf('doDiscard');
  ok(/\bclear\(\)/.test(discardBody), '§C …and that one call is inside doDiscard — the confirmed path');

  // The discard control is gated: requestDiscard opens the sheet rather than clearing.
  const reqBody = bodyOf('requestDiscard');
  ok(/setConfirmDiscard\(true\)/.test(reqBody) && !/\bclear\(\)/.test(reqBody),
    '§C 🔴 requestDiscard OPENS THE CONFIRM and never clears — the gate cannot be skipped by the control that opens it');
  ok(/needsDiscardConfirm\(items\)/.test(reqBody),
    '§C …and it asks whether a confirm is owed, so an empty order just leaves');

  // The arrow's accessible name must not still say "Cancel".
  const arrowLabel = code.match(/aria-label="([^"]*)"[^>]*>\s*<ArrowLeft/) ?? code.match(/<button[^>]*aria-label="([^"]*)"[^>]*>\s*<ArrowLeft/);
  ok(!!arrowLabel && !/cancel/i.test(arrowLabel[1]),
    `§C 🔴 the arrow's accessible name no longer says "Cancel order" — it is what a screen reader announces, and it was the only honest thing about the old button. Got "${arrowLabel?.[1] ?? '(none)'}"`);
}

// ── §D — THE COPY NAMES THE COUNT (David's ruling) ───────────────────────────────────────────
{
  const c = discardConfirmCopy([line(3), line(4)]);
  ok(/2 items/.test(c.body) && /7 plants/.test(c.body),
    '§D the body names BOTH counts — "Are you sure?" asks a person to remember what they are holding');
  ok(c.confirmLabel === 'Discard 2 items',
    `§D 🔴 the ACTION BUTTON carries the count too, not just the title — on a phone the title scrolls off and the button is what the thumb is over. Got "${c.confirmLabel}"`);
  ok(/back arrow/.test(c.body),
    '§D and it points at the non-destructive alternative, which is the whole reason this dialog exists');

  const one = discardConfirmCopy([line(1)]);
  ok(one.confirmLabel === 'Discard 1 item' && !/\(1 plant\)/.test(one.body),
    '§D singular reads correctly, and "1 item (1 plant)" is suppressed — noise in a confirmation is what makes it unread');
  const many = discardConfirmCopy([line(20)]);
  ok(/1 item \(20 plants\)/.test(many.body),
    '§D 🔴 …but ONE line carrying TWENTY plants says so, which is exactly when the two numbers differ and matter');

  ok(discardConfirmCopy([line(1)]).keepLabel === 'Keep the order',
    '§D the safe choice is named as a positive act, not "Cancel" — which in this dialog would mean two opposite things');
}

console.log(`\n  discardOrder: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
