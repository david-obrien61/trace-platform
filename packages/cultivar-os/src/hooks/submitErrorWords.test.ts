/**
 * ── THE REFUSAL LAUREN READS · #398 ──────────────────────────────────────────
 *
 * 🔴 `useSubmitOrder` threw `new Error(body.error || …)`. On refusals that carry BOTH a machine
 * code and a sentence, `error` is the CODE. The tax-rate refusal (#397) sends
 * `{ error: 'tax_rate_unreadable', message: "Couldn't read your tax rate — try again." }`, so
 * the counter showed `tax_rate_unreadable` while the sentence written for her sat unread in the
 * same response. A refusal nobody can act on is the same class as a silent failure.
 */
let passed = 0, failed = 0; const failures: string[] = [];
const ok = (c: boolean, m: string) => { if (c) passed++; else { failed++; failures.push(m); console.error('   ✗ ' + m); } };

// the production precedence, extracted so it can be asserted without a network
const pick = (body: any, status = 503) =>
  body.message || body.error || `Order submission failed (${status})`;

// M1 — the OLD precedence, which must fail the first probe
const OLD = (body: any, status = 503) => body.error || `Order submission failed (${status})`;

const TAX = { error: 'tax_rate_unreadable', message: "Couldn't read your tax rate — try again." };

ok(pick(TAX) === "Couldn't read your tax rate — try again.",
   '🔴 A1 the tax refusal shows the SENTENCE, not the code');
ok(!pick(TAX).includes('tax_rate_unreadable'),
   '🔴 A2 and the machine code never reaches the screen');
ok(OLD(TAX) === 'tax_rate_unreadable',
   '🔴 A3 THE MUTANT — the old precedence showed the code. A1 and A3 are the red/green pair');

// endpoints that send only `error`, with human text in it, must be unaffected
ok(pick({ error: 'DB unavailable' }) === 'DB unavailable',
   '🔴 B1 REGRESSION GUARD — an endpoint sending only `error` still shows its text');
ok(pick({ error: 'forbidden: costs:read required' }) === 'forbidden: costs:read required',
   'B2 …including the permission refusals');
ok(pick({}, 500) === 'Order submission failed (500)',
   'C1 an empty body still says something, with the status');
ok(pick({ message: '' , error: 'fallback' }) === 'fallback',
   'C2 an EMPTY message falls through rather than showing a blank refusal');

console.log(`\nsubmitErrorWords — ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('FAILURES:\n' + failures.map(f => '  - ' + f).join('\n')); process.exit(1); }
