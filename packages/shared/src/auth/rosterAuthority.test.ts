/**
 * ── rosterAuthority + the roster surfaces that consume it ──────────────────────────
 *
 * Written against the defect this module exists to PREVENT rather than one it fixes, which is why
 * §C matters more than §A.
 *
 * THE SITUATION. The 2026-08-28 access pass gives an OWNER-ROLE member who is NOT
 * `businesses.owner_id` a member SELECT policy on `business_members` — so for the first time she
 * sees the whole roster instead of only herself. It does NOT widen the three roster WRITES
 * (Remove · Deactivate/Reactivate · Set phone), which stay fenced on `bm_owner_all`, i.e. on
 * `owner_id`. Shipping only the read would therefore have handed her a full team list with three
 * buttons that refuse — the dead-affordance class §1.6 item 5 forbids, arriving in the same commit
 * that fixed the read, and newly VISIBLE because 393682a stopped a refused write rendering as a
 * saved one.
 *
 *   §A  the DECISION (pure). Both directions, and the shape of what is said.
 *   §B  the COPY. What a locked control may and may not say to the person reading it.
 *   §C  the SITES (source probes). The half that matters: a correct helper proves nothing if a
 *       button never asks it. Probes are scoped to a named region, never to the whole file —
 *       textual position is not control flow, a mistake made in this repo before.
 *
 * RED-FIRST, PROVEN AND COUNTED, not asserted. With the three consumer files reverted to their
 * pre-pass state (MemberConsole.tsx, cultivar Settings.tsx, invitations.ts) this file reports
 * **27 passed, 20 failed** — every §C and §D probe. §A/§B stay green there, correctly: the
 * decision was always right, it was simply consulted by nothing.
 *
 * FOUR MUTANTS, EACH RUN AND EACH COUNTED (47 probes green; the number is the failures):
 *   · `disabled={busy}` on Remove — the lock derived and never applied      →  1
 *   · the `<LockNote>` beside the danger zone deleted, title left in place  →  1
 *   · `rosterActionLock` always allowed                                     → 16
 *   · a lock returned as `allowed:false, reason:null`                       → 12
 * The first two are the ones that matter: they are the failure this file exists for, and each is
 * caught by exactly ONE probe, so neither is carried by a neighbour. The last two are why §B
 * coerces rather than casts — see the note at `reasons`.
 *
 * Run (pure TS, no db, no network, no React — esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/auth/rosterAuthority.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { rosterActionLock, ROSTER_WRITE_ACTIONS } from './rosterAuthority';
import type { RosterWriteAction } from './rosterAuthority';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

// ── §A — the decision, both directions ─────────────────────────────────────────────
{
  ok(ROSTER_WRITE_ACTIONS.length === 3,
    '§A exactly three roster writes are still owner_id-fenced — if this grows, something was added without a decision');

  for (const a of ROSTER_WRITE_ACTIONS) {
    const held = rosterActionLock(a, { isAccountHolder: true });
    ok(held.allowed === true, `§A ${a}: the ACCOUNT HOLDER is allowed`);
    ok(held.reason === null,
      `§A ${a}: 🔴 an allowed control carries NO reason — a caller must not be able to render an explanation beside a working button`);

    const locked = rosterActionLock(a, { isAccountHolder: false });
    ok(locked.allowed === false, `§A ${a}: 🔴 a NON-holder is refused — including an OWNER-role member`);
    ok(typeof locked.reason === 'string' && locked.reason.length > 0,
      `§A ${a}: 🔴 and the refusal ALWAYS carries a sentence — a silent grey is the mystery-lock §6 r13 forbids`);
  }

  // The whole point of the module is that the OWNER ROLE does not unlock these. If it ever should,
  // that is a ruling and this probe is where it gets overturned — deliberately, not by accident.
  ok(rosterActionLock('remove', { isAccountHolder: false }).allowed === false,
    '§A 🔴 holding the OWNER role does not unlock Remove — only being businesses.owner_id does (Stage 1 boundary)');
}

// ── §B — what the sentence may and may not say ─────────────────────────────────────
{
  // 🔴 COERCED, NOT ASSERTED. An earlier draft read `.reason as string` and a mutant that returned
  // a null reason CRASHED this block on `r.trim()` — so the harness died at probe 10 of 47 and
  // never printed its summary. A test that crashes instead of reporting is a worse signal than one
  // that fails: the mutant WAS caught by §A, and the run looked like a broken harness. Found by
  // running the mutant rather than by reading the code.
  const reasons = ROSTER_WRITE_ACTIONS
    .map((a) => rosterActionLock(a, { isAccountHolder: false }).reason ?? '');

  ok(new Set(reasons).size === reasons.length,
    '§B each action gets its OWN sentence — "cannot remove" is not "cannot change a phone number"');

  for (const r of reasons) {
    ok(/account holder/i.test(r),
      '§B the sentence names WHO can do it, so the reader knows who to ask');
    ok(!/owner_id|RLS|policy|bm_owner_all|permission denied/i.test(r),
      '§B 🔴 and it never leaks the mechanism — a nursery manager cannot act on "bm_owner_all"');
    ok(r.trim().endsWith('.'),
      '§B it is a complete sentence, not a fragment bolted onto a control');
  }

  // The Remove and Deactivate locks say what IS still hers, because a lock with no horizon reads
  // as a general demotion. This is the difference between "you may not" and "this one is not
  // yours, the rest is".
  for (const a of ['remove', 'set_active'] as RosterWriteAction[]) {
    const r = rosterActionLock(a, { isAccountHolder: false }).reason ?? '';
    ok(/everything else on this page/i.test(r),
      `§B ${a}: the sentence also says what the reader CAN still do — a bare refusal reads as a demotion`);
  }
}

// ── §C — THE SITES. A correct helper that nothing consults is a green test over a broken screen.
{
  const console_ = readFileSync(
    join(process.cwd(), 'packages/shared/src/components/team/MemberConsole.tsx'), 'utf8');

  // Scope every probe to MemberDetail's body: MemberConsole.tsx holds four components, and a probe
  // that greps the whole file can pass on a lock derived in one and never used in another.
  const detailStart = console_.indexOf('function MemberDetail(p: {');
  const detailEnd = console_.indexOf('function RolesTab(p: {');
  ok(detailStart > 0 && detailEnd > detailStart, '§C MemberDetail is locatable in MemberConsole.tsx');
  const detail = console_.slice(detailStart, detailEnd);

  for (const a of ROSTER_WRITE_ACTIONS) {
    ok(new RegExp(`rosterActionLock\\('${a}'`).test(detail),
      `§C MemberDetail derives the ${a} lock from the ONE shared decision, not a local isOwner test`);
  }

  // 🔴 THE LOAD-BEARING PROBES. Deriving a lock and not applying it is precisely the shape this
  // file exists to catch — it is the "message computed and dropped" defect, one layer over.
  ok(/disabled=\{busy \|\| !lockRemove\.allowed\}/.test(detail),
    '§C 🔴 Remove is DISABLED by the lock — deriving it and not applying it is the defect, not the fix');
  ok(/disabled=\{busy \|\| !lockSetActive\.allowed\}/.test(detail),
    '§C 🔴 Deactivate/Reactivate is DISABLED by the lock');
  ok(/disabled=\{!lockSetPhone\.allowed\}/.test(detail),
    '§C 🔴 the phone Edit/Add control is DISABLED by the lock');

  // …and the reason is RENDERED, not only held in a title attribute. A tooltip is invisible on the
  // phone this roster is read on (capture=mobile), which makes a title-only lock a silent grey.
  ok(/<LockNote text=\{lockRemove\.reason\}/.test(detail),
    '§C 🔴 the Remove/Deactivate lock RENDERS its reason on screen, not only in a title attribute');
  ok(/<LockNote text=\{lockSetPhone\.reason\}/.test(detail),
    '§C 🔴 the phone lock RENDERS its reason on screen');
  ok(/role="note"/.test(console_),
    '§C the note is announced to a screen reader — and as a NOTE, not an alert: nothing has failed');

  // The second team surface. `/settings/all` renders its own roster off the same
  // getMembersByBusiness, so it inherits the same hazard and must not grow a second spelling.
  const settings = readFileSync(
    join(process.cwd(), 'packages/cultivar-os/src/pages/Settings.tsx'), 'utf8');
  ok(/rosterActionLock\('remove'/.test(settings),
    '§C the /settings/all team card uses the SAME shared lock (§6 r8 — one operation, one place)');
  ok(/disabled=\{removing === m\.id \|\| !lockRemove\.allowed\}/.test(settings),
    '§C 🔴 …and actually disables its × with it');
  ok(/title=\{lockRemove\.reason \?\? 'Remove member'\}/.test(settings),
    '§C …and the locked × says why rather than repeating the action name');
}

// ── §D — THE INVITE ARRAY NO LONGER COMES FROM THE BROWSER ─────────────────────────
// Not strictly this module, but it is the same commit's other half and it has the same failure
// mode: a thing the client could supply that the server should decide. Probed here because there
// is no better home, and an unprobed ruling is a ruling waiting to be undone.
{
  const inv = readFileSync(join(process.cwd(), 'packages/shared/src/auth/invitations.ts'), 'utf8');

  ok(/supabase\.rpc\('create_invitation'/.test(inv),
    '§D createInvitation goes through the invite FUNNEL, not two client INSERTs');
  ok(!/\.from\('business_members'\)\s*\n?\s*\.insert/.test(inv),
    '§D 🔴 it no longer INSERTs a business_members row from the browser — the trigger is BEFORE UPDATE and would not have covered it');
  ok(!/permissions: input\.permissions/.test(inv),
    '§D 🔴 and the permissions array is not passed through — the server resolves it from the role floor');
  ok(!/permissions: string\[\]; \/\/ vertical-defined/.test(inv),
    '§D the input type no longer DECLARES a permissions field — a parameter that is ignored is one someone keeps believing in');
  ok(/if \(!row\.applied\) throw/.test(inv),
    '§D a refusal from the funnel is surfaced, not swallowed');
  ok(/if \(!row\)/.test(inv),
    '§D and zero rows from a SETOF function is treated as a failure, not as success with undefined fields');

  for (const f of ['packages/shared/src/components/team/MemberConsole.tsx',
                   'packages/cultivar-os/src/pages/Settings.tsx']) {
    const src = readFileSync(join(process.cwd(), f), 'utf8');
    ok(!/permissions:\s*(invitePerms|await resolveRoleDefaults)/.test(src),
      `§D ${f.split('/').pop()}: no longer hands a client-resolved permission array to the invite`);
  }
}

console.log(`\n  rosterAuthority: ${passed} passed, ${failed} failed`);
if (failed > 0) { console.error('\nFAILURES:\n' + failures.join('\n')); process.exit(1); }
