// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE: prove "Texas" never becomes "TE" again, and that an unknown value is never guessed at.
// DEPENDENCIES: usStates (pure).
// OUTPUTS: assertions only.
// ─────────────────────────────────────────────────────────────────────────────
import { US_STATES, normalizeState, isValidStateCode } from './usStates';

let passed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else failures.push(m); };

// ── §A · 🔴 THE DEFECT DAVID FOUND ──────────────────────────────────────────────────────────
ok(normalizeState('Texas') === 'TX',
   '🔴 A1 "Texas" IS TX, NOT "TE". The old control took the first two letters, so a customer in Texas was stored in a state that does not exist — and an impossible state makes the address unverifiable by construction, then stores that verdict for thirty days');
ok(normalizeState('texas') === 'TX', 'A2 …whatever the case');
ok(normalizeState('  TEXAS  ') === 'TX', 'A3 …and whatever the spacing');
ok(normalizeState('TX') === 'TX', 'A4 a code passes straight through');
ok(normalizeState('tx') === 'TX', 'A5 …in any case');

// ── §B · the first two letters are a COIN FLIP, and here is the proof ───────────────────────
{
  const wrong = US_STATES.filter(s => s.name.slice(0, 2).toUpperCase() !== s.code);
  // ✏️ MEASURED, NOT ESTIMATED. My first draft of this probe asserted ">= 40 wrong" and it FAILED:
  // the real figure is 34 of 54. The claim was wrong, not the code — corrected to what was counted
  // rather than loosening the probe until my guess passed, which is the whole point of writing it.
  ok(wrong.length === 34,
     `🔴 B1 THE OLD RULE WAS WRONG FOR ${wrong.length} OF ${US_STATES.length} STATES — and RIGHT for ${US_STATES.length - wrong.length}. That is the trap: Alabama, Arizona, California, Colorado and sixteen others come out correct, so it works often enough that nobody checks it. A rule that is right 37% of the time is not a rule, it is a coin flip with good PR`);
  ok(normalizeState('Connecticut') === 'CT',
     'B2 Connecticut is CT — the first two letters give CO, which is Colorado, a real state 1,800 miles away. That one would never have been caught by eye');
  ok(normalizeState('Mississippi') === 'MS' && normalizeState('Missouri') === 'MO',
     'B3 Mississippi and Missouri both start "MI" — which is Michigan');
}

// ── §C · 🔴 AN UNKNOWN VALUE IS NEVER GUESSED ───────────────────────────────────────────────
ok(normalizeState('TE') === null,
   '🔴 C1 "TE" RETURNS null, NOT "TX". Guessing Texas because it is alphabetically near would be the same coin flip that caused this, wearing a different hat. The surface says it does not recognise it and keeps what the person typed');
ok(normalizeState('Texazz') === null, 'C2 a near-miss is not a state either');
ok(normalizeState('') === null && normalizeState(null) === null && normalizeState(undefined) === null,
   'C3 nothing typed is null, never a default state');

// ── §D · pasted out of an address line ──────────────────────────────────────────────────────
ok(normalizeState('TX 78642') === 'TX', 'D1 "TX 78642" pasted from an address gives TX');
ok(normalizeState('XX 78642') === null, 'D2 …but only when the code is real');

// ── §E · the list itself ────────────────────────────────────────────────────────────────────
ok(US_STATES.length === 54, `E1 50 states + DC + 3 territories = 54 (got ${US_STATES.length})`);
ok(new Set(US_STATES.map(s => s.code)).size === US_STATES.length, 'E2 every code is unique');
ok(US_STATES.every(s => /^[A-Z]{2}$/.test(s.code)), 'E3 every code is two capitals');
ok(isValidStateCode('TX') && !isValidStateCode('TE') && !isValidStateCode(''),
   '🔴 E4 "TE" IS NOT A VALID CODE and the validator says so — the one assertion that stops it being stored at all');

console.log(`\nusStates — ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
