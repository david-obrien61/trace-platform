/**
 * ── RESET INVITE — the expiry a screen never showed, and the statement that fixes it ──────────
 *
 * THE SITUATION. An invitation expires seven days after it is created (`invitations.expires_at`
 * DEFAULT `now() + interval '7 days'`) and NOTHING in the product could reissue or extend one:
 * a sweep of all 1,061 commits on every branch for `resendInvitation` / `regenerateInvitation` /
 * `reissueInvitation` / `extendInvitation` / `refreshInvitation` / `renewInvitation` /
 * `rotateToken` / `Reissue` returned ZERO. The only recovery was David in the SQL editor.
 *
 * Two defects made that invisible rather than merely missing:
 *   (1) the INVITE — LINK & QR card read `expires_at` NOWHERE, so a live invite on day 6 looked
 *       exactly like one on day 1 — the case that nearly sent Joel Joiner a dead QR;
 *   (2) `getPendingInvitations` filtered `.gt('expires_at', now)`, so at the moment of expiry the
 *       card and the pending row VANISHED with no statement. A silently absent section is the
 *       six-state ruling's own defect: "A page without access RENDERS AND SAYS SO."
 *
 * THE FIX IS DAVID'S OWN STATEMENT, PARAMETERISED — `SET expires_at = now() + interval '7 days'
 * WHERE id = … AND used = false` — moved behind an RPC, because the statement issued from a
 * browser is NOT the statement issued as `postgres`. What changes is measured in §B/§C.
 *
 *   §A  the pure decision — `invitationValidity`. Both directions, and the boundary.
 *   §B  the MIGRATION as text. The four things the editor run got for free and an RPC must earn:
 *       tenant scope, the permission gate, the zero-row refusal, the audit row.
 *   §C  the CLIENT. It calls the funnel and does NOT reach the column-blind UPDATE policy.
 *   §D  the SITES. A correct helper that no screen consults is a green test over a blind card.
 *   §E  armPinReset — the E5 defect riding this build.
 *   §F  the /join copy that told him to ask for a path nobody had built.
 *
 * RED-FIRST, PROVEN AND COUNTED — see the header of the commit and the ledger row for the
 * pre-implementation failure count. A probe that passes without exercising the path has proven
 * nothing (CLAUDE.md §6 r19).
 *
 * Run (pure TS, no db, no network, no React — esbuild → node):
 *   node_modules/.bin/esbuild packages/shared/src/auth/invitationExpiry.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { invitationValidity, INVITE_TTL_DAYS } from './invitations';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}
// 🔴 A MISSING FILE MUST REPORT, NOT CRASH. An earlier draft let readFileSync throw, so the very
// first red-first run died at probe 9 of 46 and printed no summary — the rosterAuthority §B lesson
// arriving again: a harness that crashes is a worse signal than one that fails, because the run
// looks broken rather than red. Returning '' is only safe because EVERY negative probe below is
// paired with a positive anchor in the same region — otherwise `!/x/.test('')` is a check that
// cannot disagree (§6 r19).
function read(p: string): string {
  try { return readFileSync(join(process.cwd(), p), 'utf8'); } catch { return ''; }
}

// Region-scoped so a probe can never pass on a string that lives in a different component.
// Textual position is not control flow — a mistake made in this repo before (rosterAuthority §C).
// 🔴 THREE PROBES BELOW FAILED AT GREEN-TIME BY MATCHING THIS BUILD'S OWN COMMENTS, and that is
// worth recording rather than quietly patching: a probe that reads a comment as code is the same
// false-signal class as one that cannot fail. Every NEGATIVE probe about behaviour now runs
// against `code()`; the positives keep the raw source, because a comment is legitimate evidence
// that a decision was RECORDED.
function code(src: string): string {
  return src
    .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, ' ')   // JSX {/* … */}
    .replace(/\/\*[\s\S]*?\*\//g, ' ')                 // /* … */
    .replace(/^[ \t]*\/\/.*$/gm, ' ')                     // whole-line //
    .replace(/([^:'"`])\/\/.*$/gm, '$1');                 // trailing // (crude on purpose)
}

function region(src: string, from: string, to: string): string {
  const a = src.indexOf(from);
  const b = to ? src.indexOf(to, a + 1) : src.length;
  return a < 0 ? '' : src.slice(a, b < 0 ? src.length : b);
}

// ── §A — the decision, both directions and the boundary ───────────────────────────────────────
{
  const NOW = new Date('2026-09-04T15:00:00.000Z');

  const live = invitationValidity('2026-09-11T13:32:43.000Z', NOW);
  ok(live.expired === false, '§A a future expiry is NOT expired');
  ok(/valid until/i.test(live.label), '§A a live invite says how long it is good for — "valid until …"');
  ok(/11 September/.test(live.label),
    '§A 🔴 the label carries the DATE, not a relative phrase — "expires soon" is the undated card again');

  const dead = invitationValidity('2026-09-03T13:32:43.000Z', NOW);
  ok(dead.expired === true, '§A a past expiry IS expired — Joel, measured');
  ok(/expired/i.test(dead.label) && !/valid until/i.test(dead.label),
    '§A 🔴 an expired invite says EXPIRED — it must not read as live, which is the defect this build exists for');
  ok(/3 September/.test(dead.label), '§A and it names the day it died, so the owner knows how stale it is');

  // The boundary is the half nobody writes a probe for, and it is where an off-by-one lives.
  ok(invitationValidity(NOW.toISOString(), NOW).expired === true,
    '§A 🔴 expires_at EXACTLY equal to now reads EXPIRED — the accept path is `expires_at < now`, so a token at the boundary is refused server-side; a card calling it live would be the false claim, not the honest one');
  ok(invitationValidity(new Date(NOW.getTime() + 1000).toISOString(), NOW).expired === false,
    '§A one second later is live — the boundary is a boundary, not a cliff');

  // A year is only worth the ink when it is not the current one.
  ok(!/2026/.test(invitationValidity('2026-09-11T00:00:00.000Z', NOW).label),
    '§A a date in the current year does not carry the year — noise the reader already knows');
  ok(/2027/.test(invitationValidity('2027-01-04T00:00:00.000Z', NOW).label),
    '§A 🔴 a date in ANOTHER year DOES carry it — "4 January" for a date sixteen months out is a lie by omission');

  // Locale-independent by construction. A label formatted through the runner's locale is a check
  // that can disagree for a reason that has nothing to do with the code (R-33's neighbour).
  ok(!/toLocaleDateString/.test(read('packages/shared/src/auth/invitations.ts').slice(
       read('packages/shared/src/auth/invitations.ts').indexOf('export function invitationValidity'),
       read('packages/shared/src/auth/invitations.ts').indexOf('export function invitationValidity') + 1400)),
    '§A 🔴 the label is NOT built from toLocaleDateString — the runner\'s locale must not be able to change what a probe asserts');

  ok(INVITE_TTL_DAYS === 7,
    '§A the TTL is a named constant the copy reads, not a 7 typed into three sentences');
}

// ── §B — the MIGRATION. What the SQL editor got for free and an RPC must earn. ─────────────────
{
  const mig = read('supabase/migrations/20260904b_reset_invitation_expiry.sql');
  const fn  = region(mig, 'CREATE OR REPLACE FUNCTION public.reset_invitation_expiry', '\n-- ══');

  ok(fn.length > 0, '§B the function exists in the migration corpus');
  ok(/SECURITY DEFINER/.test(fn), '§B SECURITY DEFINER — the funnel is the only door, as with create_invitation');
  ok(/SET search_path = ''/.test(fn),
    '§B 🔴 search_path is pinned empty — a SECURITY DEFINER without it is the classic hijack');

  // ① TENANT SCOPE. David's editor statement has NO business_id predicate and does not need one:
  //    he named a uuid he had just read. A browser names the uuid, so the function must.
  ok(/business_id\s*=\s*p_business_id/.test(fn),
    '§B 🔴 AC-3 — the UPDATE is scoped to p_business_id. The editor statement keyed on `id` ALONE, which is safe for a human naming a row and is a cross-tenant write when the id arrives from a browser');

  // ② THE GATE. In the editor David is `postgres`; RLS was bypassed entirely.
  ok(/has_permission_for\([^)]*'team:create'\)/.test(fn),
    "§B 🔴 authorised on team:create — the same string that gates issuing and withdrawing (no new permission minted)");
  ok(/assert_movement_actor/.test(fn),
    '§B the actor is asserted, so a caller cannot reset an invitation as somebody else');
  ok(!/owner_id\s*=\s*p_actor_user_id/.test(fn),
    '§B 🔴 and it does NOT fall back to owner_id — has_permission_for has had no owner branch since 2026-07-30, and reintroducing one here would make this the exception the ruling removed');

  // ③ THE ZERO-ROW REFUSAL. An UPDATE matching nothing is not an error, in the editor or anywhere.
  ok(/RETURNING\s+expires_at/.test(fn),
    '§B 🔴 the UPDATE asks for the row back — E5: "A write that changed nothing MUST NOT report success"');
  ok(/used\s*=\s*false/.test(fn),
    '§B only while used = false — an accepted or withdrawn invitation has nothing to reset');
  ok(/IS NULL THEN/.test(fn),
    '§B and the NULL return is handled as a REFUSAL, with a reason, not as a success');

  // ④ THE AUDIT. The editor run wrote no audit_log row; there is no trigger on `invitations`
  //    anywhere in the corpus, so nothing would have written one for it.
  ok((fn.match(/INSERT INTO public\.audit_log/g) ?? []).length >= 2,
    '§B 🔴 BOTH outcomes are audited — create_invitation audits its denial too, and a refusal nobody can see is the incident R-18 exists to capture');
  ok(/'invitation\.expiry_reset'/.test(fn) && /'invitation\.expiry_reset_denied'/.test(fn),
    "§B the actions follow the existing vocabulary (invitation.created / invitation.create_denied)");
  ok(/'invitation_id'|target_id/.test(fn),
    '§B the audit row names WHOSE invitation was reset, not merely that one was');

  // The statement itself, unwidened.
  ok(/expires_at\s*=\s*now\(\)\s*\+\s*interval\s*'7 days'/.test(fn),
    "§B 🔴 the body is David's statement verbatim — now() + 7 days, NOT expires_at + 7 days, which would hand a five-day extension to an invitation that died two days ago");
  ok(!/\brole\s*=/.test(fn.slice(fn.indexOf('UPDATE public.invitations'), fn.indexOf('RETURNING'))),
    '§B 🔴 the UPDATE sets ONE column. The RLS policy it replaces is column-blind; the whole reason this is an RPC is that the function can name the column and the policy cannot');

  ok(/REVOKE ALL ON FUNCTION public\.reset_invitation_expiry/.test(mig)
     && /GRANT EXECUTE ON FUNCTION public\.reset_invitation_expiry/.test(mig),
    '§B execute is revoked from public/anon and granted deliberately');
  ok(/COMMENT ON FUNCTION public\.reset_invitation_expiry/.test(mig),
    '§B the function carries its own explanation in the catalog, where the next reader is standing');
  ok(/V1|V2|V3/.test(mig) && /ROLLBACK/.test(mig),
    '§B the migration ships verification blocks David can paste, and they roll back');

  // The orphan hazard belongs where the next person reads it (David\'s instruction).
  ok(/orphan/i.test(mig),
    '§B 🔴 the migration names the ORPHAN HAZARD — extending is safe, a second invite mints a second inactive member row that removeMember will not clear');
}

// ── §C — the CLIENT calls the funnel, and does not reach the column-blind policy ───────────────
{
  const src = read('packages/shared/src/auth/invitations.ts');
  const fn  = region(src, 'export async function resetInvitationExpiry', '\n// ');

  ok(fn.length > 0, '§C resetInvitationExpiry exists');
  ok(/\.rpc\('reset_invitation_expiry'/.test(fn),
    '§C 🔴 it calls the RPC — not `.from(\'invitations\').update({ expires_at })`, which the column-blind invitations_member_update WOULD have permitted alongside a rewrite of `role`');
  ok(/from\('invitations'\)/.test(src),
    '§C the module still talks to `invitations` at all — anchor for the negative below');
  // 🔴 THE FIRST DRAFT OF THIS REGEX MATCHED `expireInvitations` — which does NOT set expires_at,
  // it FILTERS on it (`.update({used:true}).lt('expires_at', …)`). A probe that cannot tell a SET
  // from a WHERE is asserting something other than what its sentence claims. Narrowed to the
  // update OBJECT, and the near-miss is what led to the warning now standing on that function.
  ok(!/update\(\{[^})]*expires_at/.test(code(src)),
    '§C 🔴 and NO client anywhere in this module SETS expires_at directly — the RPC is the only writer');
  ok(/lt\('expires_at'/.test(code(src)),
    '§C (anchor) expireInvitations still READS expires_at — so the negative above is discriminating between a SET and a WHERE, not passing on an empty file');
  ok(/auth\.getUser\(\)/.test(fn),
    '§C the actor comes from the SESSION, never from a caller argument — passing one in is a forgery seam');
  ok(/Array\.isArray\(data\)/.test(fn) && /applied/.test(fn),
    '§C a SETOF function returns an ARRAY — zero rows is not success (A9), and the refused case carries its reason to the screen');
}

// ── §D — the SITES. The half that matters. ────────────────────────────────────────────────────
{
  const src  = read('packages/shared/src/auth/invitations.ts');
  const pend = region(src, 'export async function getPendingInvitations', '\n// ');

  ok(!/gt\('expires_at'/.test(pend),
    "§D 🔴 getPendingInvitations NO LONGER FILTERS BY EXPIRY. This is the real work: while it did, an expired invite had no row on any screen to hang a date or a button on, and Joel disappeared without a word");
  ok(/eq\('used', false\)/.test(pend),
    '§D pending still means unaccepted-and-unwithdrawn — used = false is the whole predicate now');

  const mc     = read('packages/shared/src/components/team/MemberConsole.tsx');
  const detail = region(mc, 'function MemberDetail(p: {', 'function RolesTab(p: {');
  const card   = region(detail, '{pendingInvite && ', 'Reset PIN');

  ok(card.length > 0, '§D the INVITE — LINK & QR card is locatable');
  ok(/invitationValidity/.test(card),
    '§D 🔴 THE CARD READS expires_at. It did not before — six readers of that column existed and this card was none of them, which is how a live-looking card sat over a dead token');
  ok(/resetInvitationExpiry/.test(detail),
    '§D RESET INVITE is wired on the person\'s own page — E7: "a control that changes one record lives where that record is opened"');
  ok(!/resetInvitationExpiry/.test(region(mc, 'Pending invites', 'function QrImage')),
    '§D 🔴 and it is NOT on the pending-invites list row — that is the placement E7 forbids');
  ok(/invitationValidity/.test(region(mc, 'Pending invites', 'function QrImage')),
    '§D the pending LIST also states validity — expired rows now reach it, and a header claiming "Pending invites" over a dead row is S1\'s lie');

  const settings = read('packages/cultivar-os/src/pages/Settings.tsx');
  ok(/invitationValidity/.test(settings),
    '§D 🔴 the SECOND team surface uses the SAME helper — two spellings of one fact is the drift STD-011 names, and this build makes expired rows visible on both');
}

// ── §E — armPinReset. The E5 defect riding this build. ────────────────────────────────────────
{
  const pin = region(read('packages/shared/src/auth/pinReset.ts'), 'export async function armPinReset', '\n/**');
  ok(pin.length > 0, '§E armPinReset is locatable — the anchor for the two negatives below');
  ok(/from\('business_members'\)/.test(pin), '§E and it is still the pin_hash write, not something else');
  ok(/\.select\(/.test(pin),
    '§E 🔴 armPinReset asks for the affected rows. Without it an RLS refusal is zero rows and NO error, and the UI prints "PIN revoked." over a link to a locked door — live today for every OWNER-role member who is not businesses.owner_id');
  ok(/length|\?\./.test(pin) && /throw/.test(pin),
    '§E and a zero-row result THROWS rather than returning quietly — E5: success is reported on evidence, not on the absence of an error');
}

// ── §F — the /join copy that pointed at a path nobody had built ───────────────────────────────
{
  const join = read('packages/shared/src/auth/AcceptInvite.tsx');
  ok(/reason === 'expired'/.test(join),
    '§F the expired branch is locatable — the anchor for the negative below, which would otherwise pass on an empty read');
  const msgExpr = region(join, 'const msg =', ';\n');
  ok(msgExpr.length > 0, '§F the message expression is locatable — anchor for the negative below');
  ok(!/send a new one/i.test(msgExpr),
    '§F 🔴 the expired screen no longer says "ask the owner to send a new one" — an action that did not exist in 1,061 commits. Tech-debt #180\'s class: copy citing a path nobody built reads exactly like copy citing one that exists');
  ok(/reset/i.test(msgExpr),
    '§F it names the action that now DOES exist, so the sentence became true in the commit that built it');
  ok(new RegExp(`valid for ${7} days`).test(join) || /INVITE_TTL_DAYS/.test(join),
    '§F the seven-day claim is still stated to the person it affects');
}

// ── §G — the dead function that would silently undo this whole build ──────────────────────────
{
  const exp = region(read('packages/shared/src/auth/invitations.ts'), 'export async function expireInvitations', '\n');
  ok(exp.length > 0, '§G expireInvitations is locatable');
  const doc = region(read('packages/shared/src/auth/invitations.ts'), 'Marks expired invitations', 'export async function expireInvitations');
  ok(/reset|RESET/.test(doc),
    '§G 🔴 the cleanup function WARNS that it destroys the reset path. It flips expired invitations to used = true, and used = true is precisely what reset_invitation_expiry refuses — so wiring it would tombstone every invitation this build exists to rescue. It has ZERO callers today; the hazard is that it looks like housekeeping');
}

console.log(`\ninvitationExpiry: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map((f) => '  · ' + f).join('\n')); process.exit(1); }
