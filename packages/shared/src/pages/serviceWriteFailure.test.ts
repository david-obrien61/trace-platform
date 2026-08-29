/**
 * ── serviceWriteFailure + the four Settings → Services write sites ──────────────────
 *
 * Written against the live defect it fixes: all four write sites discarded their result and
 * mutated local state optimistically, so A REFUSED WRITE RENDERED AS A SUCCESSFUL ONE until
 * reload. A nursery manager pressed the same Save three times in 23 seconds and could not say
 * what had gone wrong, because nothing on screen said anything.
 *
 * The fix has two halves and so does this file:
 *   §A/§B  the SENTENCE (pure). What the owner is told, and what must never leak into it.
 *   §C     the SITES (source probes over Settings.tsx). This is the half that matters, because
 *          the defect was never in a pure function — it was in four call sites that threw the
 *          answer away. A green helper proves nothing if a site still ignores it.
 *
 * §C probes are scoped to ONE function's body, sliced out by name, because textual position in
 * a file is not control flow — a probe that greps the whole file can pass on a definition that
 * is never called (a mistake made in this repo before, and not repeated here).
 *
 * RED-FIRST, proven not assumed: against the pre-fix Settings.tsx this file reports 31 failures;
 * a mutant that deletes the zero-row clause, and a mutant that moves the optimistic update back
 * above the check, are each caught. See the session write-up.
 *
 * Run (pure TS, no db, no network, no React — esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/pages/serviceWriteFailure.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serviceWriteFailure } from './serviceWriteFailure';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// 'delete' LEFT THIS LIST 2026-08-28 with the site that used it. Keeping a sentence for an act
// the platform can no longer perform would be a message describing a capability that does not
// exist — the fake-pill class, one layer down in the copy.
const ACTIONS = ['activate', 'deactivate', 'edit', 'add'] as const;

// ── §A — the refusal sentence (no error: the zero-row case) ────────────────────────
{
  for (const a of ACTIONS) {
    const msg = serviceWriteFailure(a);
    ok(typeof msg === 'string' && msg.length > 0,
      `§A ${a}: always yields a sentence — there is no silent path out of a failure`);
    ok(/permission/.test(msg),
      `§A ${a}: names the likeliest cause the owner can actually act on`);
    ok(/Nothing changed/.test(msg),
      `§A ${a}: says NOTHING CHANGED — the owner is not left guessing whether it half-landed`);
  }
  ok(serviceWriteFailure('activate', null) === serviceWriteFailure('activate'),
    '§A an explicit null error is the same case as no error — a zero-row refusal');
  ok(serviceWriteFailure('activate', undefined) === serviceWriteFailure('activate'),
    '§A and so is undefined (supabase omits the key on success)');
}

// ── §B — an error is reported, and the Postgres text NEVER reaches the owner ───────
{
  const raw = 'new row violates row-level security policy for table "service_offerings"';
  for (const a of ACTIONS) {
    const msg = serviceWriteFailure(a, { message: raw });
    ok(!msg.includes(raw),
      `§B ${a}: 🔴 the raw Postgres text is NOT shown — the owner cannot act on it`);
    ok(!/row-level|policy|constraint|violates|PGRST|null|undefined/i.test(msg),
      `§B ${a}: no database vocabulary or stray null leaks into the sentence at all`);
    ok(msg !== serviceWriteFailure(a),
      `§B ${a}: a broken write and a refused write read DIFFERENTLY — they are different facts`);
    ok(/Nothing changed/.test(msg),
      `§B ${a}: and this one also says nothing changed`);
  }
  ok(serviceWriteFailure('add', { message: null }) !== serviceWriteFailure('add'),
    '§B an error object carrying no message is still an error, not a refusal');
}

// ── §B2 — the sentences are distinct, plain, and in the owner's words ─────────────
{
  const msgs = ACTIONS.map(a => serviceWriteFailure(a));
  ok(new Set(msgs).size === ACTIONS.length,
    '§B2 each action gets its OWN sentence — "not turned on" is not "not deleted"');
  ok(msgs.every(m => /^That service|^Your changes/.test(m)),
    '§B2 every sentence opens by naming what did not happen');
  ok(serviceWriteFailure('activate').includes('turned on'),
    '§B2 activate speaks in the words on the button ("On"), not "updated"');
  ok(serviceWriteFailure('deactivate').includes('turned off'),
    '§B2 deactivate likewise');
  ok(msgs.every(m => !/\b(row|rows|PGRST|400|500|RLS)\b/.test(m)),
    '§B2 no jargon or status codes in anything the owner reads');
}

// ── §C — SOURCE PROBES: the four call sites actually CHECK, and act on the answer ──
{
  const src = readFileSync(join(process.cwd(), 'packages/shared/src/pages/Settings.tsx'), 'utf8');

  /** Slice ONE function's body out by name, so every probe below is scoped to it and cannot
   *  accidentally match a neighbouring function. */
  function body(name: string): string {
    const start = src.indexOf(`async function ${name}(`);
    if (start < 0) return '';
    const rest = src.slice(start + 10);
    const nextFn = rest.search(/\n {2}(async function|function|\/\/ ──)/);
    return nextFn < 0 ? rest : rest.slice(0, nextFn);
  }

  // deleteOffering REMOVED from this list 2026-08-28 because the SITE was removed — see §D.
  const SITES = ['toggleOffering', 'saveEdit', 'addOffering'] as const;

  for (const fn of SITES) {
    const b = body(fn);
    ok(b.length > 0, `§C ${fn}: found in Settings.tsx`);
    ok(/serviceWriteFailure\(/.test(b),
      `§C ${fn}: routes its message through the ONE shared sentence`);
    ok(/setServiceError\(\{/.test(b),
      `§C ${fn}: 🔴 puts the failure into state — a message computed and dropped is the same defect`);
    // Scoped to the region AFTER the failure check. A bare `/return;/` was green on the ORIGINAL
    // defective saveEdit and addOffering, because both already contained an early return from
    // required-field validation — a probe measuring the wrong return.
    const afterCheck = b.slice(b.indexOf('serviceWriteFailure('));
    ok(/\breturn;/.test(afterCheck),
      `§C ${fn}: RETURNS on failure rather than falling through into the optimistic update`);
  }

  // 🔴 THE A8 PROBE. The three mutation sites that can be refused with zero rows and NO error
  // must ask for evidence AND inspect it. addOffering is excluded by design: it uses `.single()`,
  // which raises on zero rows, so its check is `!data`.
  for (const fn of ['toggleOffering', 'saveEdit'] as const) {
    const b = body(fn);
    ok(/\.select\('id'\)/.test(b),
      `§C ${fn}: 🔴 asks for EVIDENCE IT LANDED (.select('id')) — A8 / the DeliverySchedule pattern`);
    ok(/const \{ data: hit, error \} = await/.test(b),
      `§C ${fn}: destructures BOTH the rows and the error, rather than a bare await`);
    ok(/if \(error \|\| !hit\?\.length\)/.test(b),
      `§C ${fn}: 🔴 and treats zero-rows-no-error as a REFUSAL — a missing error alone is not success`);
  }
  ok(/if \(error \|\| !data\)/.test(body('addOffering')),
    '§C addOffering: checks the error it already had in hand, and that a row came back');

  // 🔴 THE ORDERING PROBE — the whole defect in one assertion. Local state must not move until
  // the failure check has run. Compared by INDEX inside the sliced body, so this is a claim about
  // this function's own control flow rather than about the file's layout.
  for (const fn of SITES) {
    const b = body(fn);
    const check = b.search(/if \(error \|\| !/);
    const mutate = b.indexOf('setOfferings(');
    ok(check >= 0 && mutate >= 0 && check < mutate,
      `§C ${fn}: 🔴 the write is CHECKED BEFORE setOfferings runs — the screen never shows a change the database refused`);
  }

  // The editor and the add form keep the owner's typing on a failure. Losing it would make the
  // honest error worse to live with than the silent success it replaced.
  ok(body('saveEdit').indexOf('setServiceError({') < body('saveEdit').indexOf('setEditingId(null)'),
    '§C saveEdit: the editor stays OPEN on failure — the owner does not lose what they typed');
  ok(!/if \(!error && data\)/.test(src),
    '§C addOffering: the old silent `if (!error && data)` branch — which swallowed the error it had in hand — is gone');

  // A refused write has to be VISIBLE, not merely stored. Three renders: the editor, the view row,
  // and the add form.
  ok((src.match(/<WriteFailure text=/g) ?? []).length >= 3,
    '§C the failure is RENDERED at the row, in the editor and in the add form — not just held in state');
  ok(/role="alert"/.test(src),
    '§C and it is announced to a screen reader, not only coloured red');
  ok(/errorForId=\{serviceError\?\.id \?\? null\}/.test(src),
    '§C every offering group is handed the error, so any row can show its own');

  // The old shape must not survive anywhere in this file.
  ok(!/await supabase\.from\('service_offerings'\)\.update\(\{ is_active/.test(src),
    '§C the bare-await toggle is gone');
}

// ── §D — THE HARD DELETE IS GONE, AND IT MUST STAY GONE ────────────────────────────
// R2 stands (no delete verb; retire-by-flag is the shape), and the delete this replaced was broken
// in both directions: 23503 on any offering ever sold, permanent destruction of one that was not.
// These probes are the guard on a RULING, which is the only kind of guard a ruling gets here — no
// cap reads prose. They are written as NEGATIVES on purpose: the way this regresses is somebody
// re-adding a convenience delete, not somebody editing what is left.
{
  const src = readFileSync(join(process.cwd(), 'packages/shared/src/pages/Settings.tsx'), 'utf8');

  ok(!/\.from\('service_offerings'\)\s*\n?\s*\.delete\(\)/.test(src),
    '§D 🔴 NO hard delete of a service_offering exists in Settings.tsx (R2 — retire by flag)');
  ok(!/async function deleteOffering/.test(src),
    '§D the deleteOffering site is removed, not merely unwired');
  ok(!/onDelete/.test(src),
    '§D and the ✕ affordance that fired it is removed with it — no dead prop left behind');
  ok(/async function toggleOffering/.test(src),
    '§D the retire path R2 names still exists: toggleOffering flips is_active');
  ok(/serviceWriteFailure\('delete'/.test(src) === false,
    '§D nothing still asks for a "not deleted" sentence');
}

console.log(`\n  serviceWriteFailure: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
