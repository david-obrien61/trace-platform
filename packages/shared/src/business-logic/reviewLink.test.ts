/**
 * ── reviewLink — the review link's one store, the edit rule, and the per-table Save report ──
 *
 * WHY THIS FILE EXISTS (2026-09-11, ledger #300). David had LAWNS's Google review link in his hand and
 * no field to put it in — the input existed, on a module card four cards down /settings/all. The build
 * moved it to Business Profile, which turned a two-table Save into a three-table one. The Save's report
 * was then written as a pure function, and writing it that way exposed a defect in the version it
 * replaced: it told an owner "The tax rate was saved" when the rate had not been written at all.
 *
 * PROBES BOTH DIRECTIONS (STD-022). §E REACHES the shipped files and asserts CODE with comments
 * stripped (tech-debt #182 — a probe that cannot reach its target reports the same as one that passed).
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/reviewLink.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import {
  REVIEW_LINK_MODULE_KEY, readReviewLink, isUsableReviewUrl, reviewLinkEdit, saveReport,
  REVIEW_LINK_NOT_A_URL, REVIEW_LINK_NOT_LOADED, type SavePart,
} from './reviewLink';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}
// Strip whole-line comments (// · * · /* · {/*) so a probe grades code, never the prose explaining it.
const code = (s: string) => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §A — the stored link is read ONE way
// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§A — the stored link is read one way');
ok(readReviewLink(null) === null, 'A1 absent config → no link');
ok(readReviewLink({ review_url: '   ' }) === null, 'A2 (negative) whitespace is not a link');
ok(readReviewLink({ review_url: 42 as unknown as string }) === null, 'A3 (negative) a non-string is not a link');
ok(readReviewLink({ review_url: ' https://g.page/r/x/review ' }) === 'https://g.page/r/x/review', 'A4 a link is trimmed');
ok(readReviewLink({ trial_started_at: '2026-08-01', trial_days: 30, review_guidance: 'x', review_url: 'https://x.test/r' }) === 'https://x.test/r',
   'A5 the trial pair and the guidance line sharing this blob are ignored, not read as the link');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §B — a usable link is a web address, and NOTHING NARROWER
// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§B — a usable link is a web address, and nothing narrower');
for (const u of [
  'https://g.page/r/CabcDEF123/review',
  'https://search.google.com/local/writereview?placeid=ChIJabc123',
  'https://maps.app.goo.gl/AbCdEf',
  'http://x.test',
]) ok(isUsableReviewUrl(u), `B1 accepted: ${u}`);
ok(isUsableReviewUrl('https://example.com/whatever?a=1#b'),
   '🔴 B2 a shape we do not recognise is NOT refused — Google has issued several, and refusing an unknown one invents a rule the owner cannot get past');
ok(!isUsableReviewUrl('javascript:alert(1)'), '🔴 B3 (negative) javascript: is refused — this string becomes a QR a customer scans');
ok(!isUsableReviewUrl('mailto:a@b.c'), 'B4 (negative) mailto: is not a review page');
ok(!isUsableReviewUrl('g.page/r/abc/review'), 'B5 (negative) no scheme is not an absolute address — the hint tells the owner to copy the whole link');
ok(!isUsableReviewUrl('leave us a review'), 'B6 (negative) prose is not a link');
ok(!isUsableReviewUrl(''), 'B7 (negative) empty is not usable');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §C — an edit is a WRITE only when something changed
// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§C — an edit is a write only when something changed');
const L = 'https://g.page/r/old/review';
ok(reviewLinkEdit(L, L).kind === 'unchanged', 'C1 same value → unchanged, nothing written');
ok(reviewLinkEdit(L, `  ${L}  `).kind === 'unchanged', 'C2 surrounding whitespace is not an edit');
const set = reviewLinkEdit('', ' https://g.page/r/new/review ');
ok(set.kind === 'set' && set.url === 'https://g.page/r/new/review', 'C3 a first link → set, trimmed');
ok(reviewLinkEdit(L, '').kind === 'clear', 'C4 emptying a set link → clear (an owner may remove it)');
const bad = reviewLinkEdit(L, 'not a link');
ok(bad.kind === 'refused' && bad.reason === REVIEW_LINK_NOT_A_URL, 'C5 (negative) a non-address → refused, with the reason in words');
ok(reviewLinkEdit(null, '').kind === 'unchanged',
   '🔴 C6 NOT LOADED + BLANK → unchanged, NEVER clear — the field is blank because nothing arrived, not because the owner emptied it');
const early = reviewLinkEdit(null, 'https://g.page/r/new/review');
ok(early.kind === 'refused' && early.reason === REVIEW_LINK_NOT_LOADED,
   '🔴 C7 NOT LOADED + TYPED → refused: never written over a value nobody saw, never silently dropped under "Saved"');
ok(reviewLinkEdit('', '').kind === 'unchanged', 'C8 loaded, none set, still blank → unchanged');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §D — a Save across several tables reports PER TABLE
// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§D — a multi-table Save reports per table');
const W = (label: string): SavePart => ({ label, outcome: 'written' });
const U = (label: string): SavePart => ({ label, outcome: 'unchanged' });
const R = (label: string, reason: string | null): SavePart => ({ label, outcome: 'refused', reason });
ok(saveReport([W('your business details'), W('the tax rate'), W('the review link')]) === 'Saved', 'D1 all written → Saved');
ok(saveReport([W('your business details'), U('the tax rate'), U('the review link')]) === 'Saved', 'D2 written + unchanged → Saved');
const partial = saveReport([W('your business details'), U('the tax rate'), R('the review link', 'permission denied.')]);
ok(partial.startsWith('Error'), 'D3 a partial Save renders RED — part of it landed and cannot be rolled back, and green would read as all of it');
ok(/Saved: your business details\./.test(partial), 'D4 it names what DID land');
ok(/Not saved: the review link — permission denied\.$/.test(partial), 'D5 it names what did not, with the reason, and does not double the full stop');
ok(!/tax rate/.test(partial),
   '🔴 D6 (negative) an UNCHANGED part is never named — not as saved, not as unsaved. The branch this replaced said "The tax rate was saved" when nothing had been written');
const none = saveReport([R('your business details', 'refused'), U('the tax rate'), U('the review link')]);
ok(none.startsWith('Error: nothing was saved'), 'D7 a refusal with nothing written → "nothing was saved"');
ok(!/Saved:/.test(none), 'D8 (negative) …and it claims no saved part');
const two = saveReport([R('your business details', 'a'), W('the tax rate'), R('the review link', 'b')]);
ok(/Saved: the tax rate\./.test(two) && /your business details — a; the review link — b/.test(two),
   'D9 two refusals and one landing — all three accounted for, in order');
ok(/no reason was given/.test(saveReport([R('the review link', null)])) && !/null/.test(saveReport([R('the review link', null)])),
   'D10 (negative) a missing reason never renders as "null"');

// ════════════════════════════════════════════════════════════════════════════════════════════
// §E — THE PROBES REACH THE SHIPPED FILES (tech-debt #182)
// ════════════════════════════════════════════════════════════════════════════════════════════
console.log('§E — the probes reach the shipped files');
const sharedCode = code(readFileSync('packages/shared/src/pages/Settings.tsx', 'utf8'));
const hostCode   = code(readFileSync('packages/cultivar-os/src/pages/Settings.tsx', 'utf8'));
// ✏️ 2026-09-11 (ledger #301): the crew's tap and the ask it may trigger MOVED from DeliverySchedule.tsx into
// the shared `useStopActions` hook, so the schedule, the route and the order screen all run the same one.
// The assertions below are unchanged; only the file they read followed the code.
const crewCode   = code(readFileSync('packages/cultivar-os/src/components/delivery/useStopActions.tsx', 'utf8'));
// The crew floor is 4,000, not 10,000: the hook holds only the actions, where the page it came from also held
// the whole list. Still far above an empty or truncated read, which is all this guard is for.
ok(sharedCode.length > 20_000 && hostCode.length > 10_000 && crewCode.length > 4_000,
   `E0 the three files were read — not matched against empty slices (crew ${crewCode.length} chars)`);
ok(REVIEW_LINK_MODULE_KEY === 'followup_engine',
   'E1 the link lives in the Follow-Up module config — the store the 2026-08-31 build wrote, not a new column');
ok(/reviewLinkEdit\(loadedReviewLink, reviewLink\)/.test(sharedCode), 'E2 Business Profile judges the edit through reviewLinkEdit');
ok(/setBusinessModuleState\(supabase, businessId, REVIEW_LINK_MODULE_KEY/.test(sharedCode),
   'E3 …writes through the narrow module-state RPC (settings:update, checked server-side)');
ok(/else if \(linkEdit\?\.kind === 'set' \|\| linkEdit\?\.kind === 'clear'\) \{\s*const url/.test(sharedCode),
   'E4 …and writes ONLY on set or clear — an unchanged link is not written');
ok(/stored === url/.test(sharedCode), 'E5 the write is proven by reading the stored value back, not by `applied` (R-12)');
ok(/saveReport\(parts\)/.test(sharedCode), 'E6 the message is composed by saveReport, not by inline branches');
ok(/section === 'business'\) && \([\s\S]{0,3000}showReviewLink && \(/.test(sharedCode), 'E7 the field renders INSIDE the Business Profile card');
ok(/label="Google review link"/.test(sharedCode), 'E8 it is labelled for what the owner holds in their hand');
ok(/<SharedSettings[\s\S]*\n\s*showReviewLink\n/.test(hostCode), 'E9 the cultivar host opts in');
ok(!/review_url/.test(hostCode),
   '🔴 E10 (negative) the module card no longer writes the link — ONE input for one field, "entered once"');
ok(!/type="url"/.test(hostCode), 'E11 (negative) and no second URL input survives on it');
ok(/\.eq\('module_key', REVIEW_LINK_MODULE_KEY\)/.test(crewCode), 'E12 the crew screen reads the same module-key constant');
ok(!/'followup_engine'/.test(crewCode + hostCode), 'E13 (negative) no hand-spelled module key remains at either reader');
ok(/deliveryDate:\s+d\.delivery_date/.test(crewCode), 'E14 the crew screen hands the stop date to the ask decision');
ok(/console\.log\('\[TRACE:REVIEWLINK\]/.test(sharedCode), 'E15 the load trail is an ACTIVE CALL, ON by default (STD-003)');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
