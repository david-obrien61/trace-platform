/**
 * ── campaignLifecycle — the three rulings of 2026-09-12, proven both directions ──────────────
 *
 * WHY THIS FILE EXISTS. R-145 (edit scope), R-146 (cancel) and R-147 (append) were each blocked by
 * nothing but a missing surface — the RLS policy, the permission string and the `'cancelled'` CHECK
 * value all already existed. What did NOT exist was any test that could tell the append path from the
 * create path, which is why "Generate more posts for this campaign" minted duplicates for weeks and
 * the list called a zero-post campaign "All posts published ✓".
 *
 * PROBES BOTH DIRECTIONS (STD-022): every rule is asserted to HOLD where it should and to REFUSE
 * where it should. §F REACHES the shipped files and grades CODE with comments stripped — tech-debt
 * #182: a probe that cannot reach its target reports the same as one that passed.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/shared/src/business-logic/campaignLifecycle.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import {
  campaignEditLock, campaignEditPlan, campaignCancelPlan, campaignAppendPlan,
  campaignPostClaim, isEditableCampaignField,
  CAMPAIGN_EDITABLE_FIELDS, CAMPAIGN_CANCELLED,
} from './campaignLifecycle';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; console.error('   ✗ ' + msg); }
}
const code = (s: string) => s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l)).join('\n');

const draft = { status: 'draft' };
const copied = { status: 'published' };

// ══ §A · R-145 — THE LOCK ════════════════════════════════════════════════════════════════════
console.log('\n§A — R-145 the publication lock');

ok(campaignEditLock([]).locked === false, 'A1 no posts → unlocked');
ok(campaignEditLock([draft, draft]).locked === false, 'A2 all drafts → unlocked');
ok(campaignEditLock([draft, copied]).locked === true, 'A3 ONE copied post → LOCKED');
ok(campaignEditLock([copied, copied]).copiedCount === 2, 'A4 copiedCount counts copied posts');
ok(campaignEditLock([draft, draft]).copiedCount === 0, 'A5 (negative) no copied → count 0');
ok(campaignEditLock([]).reason === undefined, 'A6 (negative) an unlocked campaign carries NO refusal text');
ok(typeof campaignEditLock([copied]).reason === 'string' && campaignEditLock([copied]).reason!.length > 0,
  'A7 a locked campaign always explains itself (D-9)');
ok(campaignEditLock([copied]).route === 'cancel-and-restart',
  'A8 the lock names the route out — R-145 answered-and-restarted');

// 🔴 THE HONESTY PROBE. `published` means the owner COPIED it; TRACE cannot see a feed. The refusal
// must not claim otherwise — user_stories.md:1250-1252.
const lockText = campaignEditLock([copied]).reason!.toLowerCase();
ok(!/your customers have seen/.test(lockText), 'A9 refusal does NOT claim customers saw it');
ok(!/published to/.test(lockText),             'A10 refusal does NOT say "published to" anywhere');
ok(!/\blive\b/.test(lockText),                 'A11 refusal does NOT call a copied post "live"');
ok(/cop(y|ied)/.test(lockText),                'A12 refusal DOES say copied — the thing we actually know');
ok(/cannot see|cannot know/.test(lockText),    'A13 refusal states the limit of our knowledge');
ok(/cancel/.test(lockText),                    'A14 refusal points at cancel-and-restart');
// M5 escaped without this: a mutant that deleted the FIRST sentence left a refusal that still
// mentioned copying and still pointed at cancel, so every probe above stayed green while the owner
// lost the one number that makes the sentence actionable.
ok(/\b2\b/.test(campaignEditLock([copied, copied]).reason!),
  'A15 the refusal states HOW MANY posts were copied');
ok(/\b1\b/.test(campaignEditLock([copied]).reason!),
  'A16 and it states the count when that count is one');

// ══ §B · R-145 — THE SCOPE ═══════════════════════════════════════════════════════════════════
console.log('\n§B — R-145 edit scope is dates and focus');

ok(CAMPAIGN_EDITABLE_FIELDS.length === 3, 'B1 exactly three editable fields');
ok(isEditableCampaignField('start_date') && isEditableCampaignField('end_date')
   && isEditableCampaignField('target_category'), 'B2 dates + focus are editable');
ok(!isEditableCampaignField('name'),        'B3 (negative) name is NOT editable — identity, not focus');
ok(!isEditableCampaignField('description'), 'B4 (negative) description is NOT editable — it carries the ask, a separate pass');
ok(!isEditableCampaignField('status'),      'B5 (negative) status is NOT an edit — cancel is its own verb');
ok(!isEditableCampaignField('business_id'), 'B6 (negative) tenant is never editable');

const base = { start_date: '2026-10-26', end_date: '2026-11-08', target_category: 'shade', name: 'Arbor Day 2026', status: 'active' };

const moved = campaignEditPlan({ current: base, proposed: { end_date: '2026-11-15' }, posts: [draft] });
ok(moved.allowed === true, 'B7 moving the end date is allowed while nothing is copied');
ok(Object.keys(moved.patch).length === 1 && moved.patch.end_date === '2026-11-15',
  'B8 the patch holds ONLY the changed field');

const locked = campaignEditPlan({ current: base, proposed: { end_date: '2026-11-15' }, posts: [copied] });
ok(locked.allowed === false, 'B9 the same edit is REFUSED once a post is copied');
ok(Object.keys(locked.patch).length === 0, 'B10 a refused plan carries an EMPTY patch — nothing to write');

const oos = campaignEditPlan({ current: base, proposed: { name: 'Renamed' }, posts: [draft] });
ok(oos.allowed === false, 'B11 an out-of-scope field is refused');
ok(/cannot change name/.test(oos.reason ?? ''), 'B12 the refusal NAMES the field it will not change');
ok(oos.reason !== locked.reason, 'B13 scope refusal and lock refusal are DIFFERENT sentences');

const nochange = campaignEditPlan({ current: base, proposed: { end_date: '2026-11-08' }, posts: [draft] });
ok(nochange.allowed === false && nochange.reason === 'Nothing changed.',
  'B14 a Save that changes nothing says so and writes nothing (STD-023)');

const crossed = campaignEditPlan({ current: base, proposed: { end_date: '2026-10-01' }, posts: [] });
ok(crossed.allowed === false && /before the start date/.test(crossed.reason ?? ''),
  'B15 crossed dates are refused in words, not by a constraint violation');

const blanked = campaignEditPlan({ current: base, proposed: { target_category: '   ' }, posts: [] });
ok(blanked.allowed === true && blanked.patch.target_category === null,
  'B16 a blanked focus normalises to NULL, not an empty string');

// ══ §C · R-146 — CANCEL ══════════════════════════════════════════════════════════════════════
console.log('\n§C — R-146 cancel');

ok(CAMPAIGN_CANCELLED === 'cancelled', 'C1 the value is the one already in the CHECK constraint');
ok(campaignCancelPlan({ status: 'active' }).allowed === true,  'C2 an active campaign can be cancelled');
ok(campaignCancelPlan({ status: 'draft'  }).allowed === true,  'C3 a draft campaign can be cancelled');
ok(campaignCancelPlan({ status: 'active' }).nextStatus === 'cancelled', 'C4 cancel writes cancelled');
ok(campaignCancelPlan({ status: 'cancelled' }).allowed === false, 'C5 (negative) already cancelled → refused');
ok(campaignCancelPlan({ status: 'completed' }).allowed === false, 'C6 (negative) completed → refused, it already ran');
ok(/already cancelled/.test(campaignCancelPlan({ status: 'cancelled' }).reason ?? ''), 'C7 refusal says which case');
ok(/never ran|stays as completed/.test(campaignCancelPlan({ status: 'completed' }).reason ?? ''),
  'C8 the completed refusal explains WHY, not just that it cannot');
ok(campaignCancelPlan({ status: 'active' }).reason === undefined, 'C9 (negative) an allowed plan carries no refusal');
// Cancel must never be a delete in disguise.
ok(!('delete' in campaignCancelPlan({ status: 'active' })), 'C10 the plan has no delete affordance at all');

// ══ §D · R-147 — APPEND ══════════════════════════════════════════════════════════════════════
console.log('\n§D — R-147 generate-more appends');

ok(campaignAppendPlan('c-123').mode === 'append', 'D1 an id → APPEND');
ok(campaignAppendPlan('c-123').campaignId === 'c-123', 'D2 append carries the id');
ok(campaignAppendPlan('c-123').navigate === false, 'D3 🔴 append NEVER navigates — walking away was the symptom');
ok(campaignAppendPlan(null).mode === 'create',      'D4 (negative) no id → CREATE');
ok(campaignAppendPlan(undefined).mode === 'create', 'D5 (negative) undefined → CREATE');
ok(campaignAppendPlan('').mode === 'create',        'D6 (negative) empty string → CREATE');
ok(campaignAppendPlan('   ').mode === 'create',     'D7 (negative) whitespace-only → CREATE, not an append to "   "');
ok(campaignAppendPlan(null).navigate === true,      'D8 create DOES navigate — a new campaign is somewhere new');
ok(campaignAppendPlan(null).campaignId === undefined, 'D9 (negative) create carries no campaign id');
ok(campaignAppendPlan('  c-7  ').campaignId === 'c-7', 'D10 the id is trimmed before use');

// ══ §E · THE CLAIM THAT HID IT ═══════════════════════════════════════════════════════════════
console.log('\n§E — the honest post claim');

// 🔴 THE DEFECT, AS A TEST. status is irrelevant when there are no posts.
ok(campaignPostClaim({ total: 0, draft: 0, published: 0 }).tone === 'empty',
  'E1 🔴 ZERO posts → empty, whatever the status');
ok(/no posts yet/i.test(campaignPostClaim({ total: 0, draft: 0, published: 0 }).text),
  'E2 🔴 a campaign with no posts SAYS it has no posts');
ok(!/published/i.test(campaignPostClaim({ total: 0, draft: 0, published: 0 }).text),
  'E3 🔴 THE REGRESSION GUARD — a zero-post campaign never says "published"');

// The negative control David asked for explicitly: the TRUE claim must survive.
const done = campaignPostClaim({ total: 5, draft: 0, published: 5 });
ok(done.tone === 'done', 'E4 all posts published → done');
ok(/all 5 posts published/i.test(done.text), 'E5 🟢 NEGATIVE CONTROL — the true all-done claim still renders');

ok(campaignPostClaim({ total: 5, draft: 3, published: 2 }).tone === 'ready', 'E6 drafts outstanding → ready');
ok(/3 posts ready to review/.test(campaignPostClaim({ total: 5, draft: 3, published: 2 }).text), 'E7 ready names the count');
ok(/1 post ready/.test(campaignPostClaim({ total: 1, draft: 1, published: 0 }).text), 'E8 singular is not "1 posts"');
ok(campaignPostClaim({ total: 1, draft: 0, published: 1 }).text === 'All 1 post published ✓', 'E9 singular done case');

// Posts that are neither draft nor published ('scheduled'/'failed' are in the CHECK) must not be
// rounded to either end — that rounding is how the original lie was possible.
const partial = campaignPostClaim({ total: 4, draft: 0, published: 1 });
ok(partial.tone === 'partial', 'E10 some posts neither draft nor published → partial');
ok(partial.text === '1 of 4 posts published', 'E11 partial states the arithmetic');
ok(campaignPostClaim({ total: 4, draft: 0, published: 0 }).tone === 'partial',
  'E12 posts exist, none draft, none published → partial, NOT done');
ok(campaignPostClaim({ total: -1, draft: 0, published: 0 }).tone === 'empty', 'E13 a negative total is empty, not a crash');

// ══ §F · THE SHIPPED SURFACES ════════════════════════════════════════════════════════════════
console.log('\n§F — the shipped files actually use these rules');

const list   = code(readFileSync('packages/cultivar-os/src/pages/Campaigns.tsx', 'utf8'));
const detail = code(readFileSync('packages/cultivar-os/src/pages/CampaignDetail.tsx', 'utf8'));
const api    = code(readFileSync('packages/cultivar-os/api/campaigns.ts', 'utf8'));

ok(/campaignPostClaim\(/.test(list), 'F1 the list renders the shared claim');
ok(!/All posts published/.test(list), 'F2 🔴 the literal false claim is GONE from the list');
ok(/total_count/.test(list) && /published_count/.test(list), 'F3 the list now carries a TOTAL, the missing field');
ok(/\.eq\('business_id', businessId\)/.test(list), 'F4 the post tally is tenant-scoped (AC-3)');

ok(/campaignEditPlan\(/.test(detail),   'F5 the detail page asks the edit plan');
ok(/campaignCancelPlan\(/.test(detail), 'F6 the detail page asks the cancel plan');
ok(/campaignEditLock\(/.test(detail),   'F7 the detail page asks the lock');
// 🔴 PINNED TO THE BODY, NOT THE FILE. The first version of this probe was /campaignId: id/, which
// also matched the two `[TRACE:CAMPAIGN]` log lines in the edit and cancel handlers — so mutant P2
// (the body stops sending the id) SURVIVED while the probe reported green. The probe was wrong, not
// the mutant. tech-debt #182's class, found by the harness the same hour it was written.
ok(/JSON\.stringify\(\{ action: 'generate', businessId, campaignId: id \}\)/.test(detail),
  'F8 🔴 generate-more sends THIS campaign id IN THE REQUEST BODY');
ok(/campaignId: id/.test(detail), 'F8b the id also appears in the trace trail');
ok(!/navigate\(`\/campaigns\/\$\{data\.campaignId\}`\)/.test(detail),
  'F9 🔴 generate-more no longer navigates onto a new campaign');
ok(/setGenError/.test(detail), 'F10 generate-more has an error surface — the story\'s "no error surface at all"');
ok(!/catch \{ \/\* silent \*\/ \}/.test(detail), 'F11 🔴 the silent catch is gone');
// R-12's exact-count form: a PostgREST update matching zero rows returns SUCCESS with no error, so
// the affected-row count is the only proof. `!== 1` also catches a one-id update that hit two rows.
ok((detail.match(/rows\?\.length !== 1/g) ?? []).length === 2,
  'F12 BOTH campaign writes check the affected-row count exactly (R-12/E5)');
ok(/did not save/.test(detail), 'F12b and a refused write says so in words');

ok(/campaignAppendPlan\(/.test(api), 'F13 the endpoint asks the append plan');
ok(/plan\.mode === 'append'/.test(api), 'F14 the endpoint branches on the plan');
ok(/\.eq\('business_id', businessId\)/.test(api), 'F15 the append target is tenant-scoped (AC-3)');
ok(/\[TRACE:CAMPAIGN\]/.test(api), 'F16 STD-003 instrumentation ships ON');
// The create INSERT must no longer be unconditional — that was the defect.
ok(/if \(plan\.mode === 'append'\) \{\s*targetId/.test(api),
  'F17 🔴 the campaigns INSERT is reached only on CREATE');
ok(!/campaigns:delete/.test(api + detail + list), 'F18 (negative) no delete verb anywhere — R2 holds');
ok(!/campaigns:create/.test(api + detail + list), 'F19 (negative) the declared-unwired string is in no gate');

// ══ SUMMARY ══════════════════════════════════════════════════════════════════════════════════
console.log(`\n${failed === 0 ? '✅' : '🔴'} campaignLifecycle — ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
