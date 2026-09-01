/**
 * ── deliveryFulfilment — the tap, the times, and the ask that may follow ─────────────
 *
 * Written against the live 2026-08-31 measurements rather than invented data:
 *   · `deliveries.status` holds `scheduled` and ONLY `scheduled` across every tenant — the nine
 *     LAWNS rows and the nineteen the QuickBooks ingest added. `fulfilled` is the first other
 *     value the column will ever carry, so §A pins what the vocabulary is and what reads it.
 *   · Saturday 2026-08-29 had SEVEN LAWNS stops: six made, one rescheduled. §C uses those numbers.
 *   · LAWNS has 1,936 customers with real repeat trade, which is what the window in §E is for.
 *
 * PROBES BOTH DIRECTIONS (STD-022): every rule is asserted by a case that must pass AND a case
 * that must fail. A test that only ever confirms the happy path cannot tell code from coincidence.
 *
 * Run:
 *   node_modules/.bin/esbuild packages/cultivar-os/src/lib/deliveryFulfilment.test.ts \
 *     --bundle --platform=node --format=cjs | node
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Repo-root-relative, NOT __dirname/import.meta: esbuild bundles this file elsewhere, so only
// process.cwd() reliably points at the repo root. Same convention as historyOrder.test.ts.
const SELF = join(process.cwd(), 'packages/cultivar-os/src/lib/deliveryFulfilment.ts');
import {
  DELIVERY_STATUSES, DELIVERY_STATUS_FULFILLED, DELIVERY_STATUS_SCHEDULED,
  deliveryStatusMeta, isDeliveryFulfilled,
  fulfilmentPatch, startPatch, stopMinutes, crewStopModel,
  readReviewAskConfig, isUsableReviewUrl, reviewCopyProblems, reviewAskDecision,
  reviewAskPatch, askRateFor,
  DEFAULT_REVIEW_GUIDANCE, REVIEW_ASK_WINDOW_DAYS, REVIEW_ASK_SHOWN, REVIEW_ASK_SKIPPED,
  type ReviewAskInput,
} from './deliveryFulfilment';

let passed = 0, failed = 0;
const failures: string[] = [];
function ok(cond: boolean, msg: string): void {
  if (cond) passed++; else { failed++; failures.push(msg); console.error('   ✗ ' + msg); }
}

const T = (s: string) => new Date(s);
const NOW = T('2026-08-31T17:00:00.000Z');

// ══ §A THE VOCABULARY — and what already reads it ═══════════════════════════════
{
  ok(DELIVERY_STATUSES.includes(DELIVERY_STATUS_SCHEDULED as never), 'A1: scheduled is in the vocabulary');
  ok(DELIVERY_STATUSES.includes(DELIVERY_STATUS_FULFILLED as never), 'A2: fulfilled is in the vocabulary');

  // A3 — the load-bearing compatibility claim. `historyOrder.ts`'s DELIVERY_COMPLETE list was
  // written in advance for this control; if our word is not in it, the order status silently
  // stops following the delivery and NOTHING fails loudly. Read from the real source file so it
  // cannot drift: a copy of the list here would agree with itself forever.
  const historySrc = readFileSync(join(process.cwd(), 'packages/shared/src/business-logic/historyOrder.ts'), 'utf8');
  const listed = /const DELIVERY_COMPLETE\s*=\s*\[([^\]]*)\]/.exec(historySrc)?.[1] ?? '';
  ok(listed.includes(`'${DELIVERY_STATUS_FULFILLED}'`),
    '🔴 A3: the word we write MUST be in historyOrder.DELIVERY_COMPLETE — otherwise the order status stops following the delivery, silently');
  ok(listed.includes("'delivered'"),
    'A3b: `delivered` is also accepted there — our choice of `fulfilled` is a choice, not a constraint');

  ok(isDeliveryFulfilled('fulfilled'),  'A4: fulfilled reads as done');
  ok(isDeliveryFulfilled('Delivered'),  'A5: case/spelling variants read as done (the column is open text)');
  ok(!isDeliveryFulfilled('scheduled'), '🔴 A6 (negative): scheduled must NOT read as done');
  ok(!isDeliveryFulfilled(null),        'A7 (negative): null is not done');
  ok(!isDeliveryFulfilled('cancelled'), '🔴 A8 (negative): a cancelled stop is not a completed one');

  // A9 — an unknown status renders raw rather than being relabelled (D-9).
  ok(deliveryStatusMeta('out_for_delivery').label === 'out_for_delivery',
    'A9: an unrecognised status renders under its own raw name, never forced into a known bucket');
  ok(deliveryStatusMeta(null).label === 'No status', 'A10: absent status says so');
}

// ══ §B THE TIMES — the measurement this build exists to start ═══════════════════
{
  const p = fulfilmentPatch(NOW, { started_at: null, completed_at: null });
  ok(p.status === DELIVERY_STATUS_FULFILLED, 'B1: the tap writes fulfilled');
  ok(p.completed_at === NOW.toISOString(),   'B2: the tap stamps completed_at');
  ok(p.started_at === NOW.toISOString(),     'B3: an unstarted stop gets both stamps at the same instant');

  const already = fulfilmentPatch(NOW, { started_at: '2026-08-31T15:30:00.000Z', completed_at: null });
  ok(already.started_at === undefined,
    '🔴 B4 (negative): a stop already started must NOT have its real start overwritten — that would destroy the measurement');
  ok(already.completed_at === NOW.toISOString(), 'B5: …but it is still stamped done');

  ok(startPatch(NOW).started_at === NOW.toISOString(), 'B6: start stamps only the start');

  // B7/B8 — the honesty rule that protects the capacity model. One-minute-per-gallon is a GUESS;
  // feeding it a fabricated zero would be worse than feeding it nothing.
  ok(stopMinutes({ started_at: '2026-08-31T15:00:00.000Z', completed_at: '2026-08-31T16:30:00.000Z' }) === 90,
    'B7: a measured interval reports its minutes');
  ok(stopMinutes({ started_at: NOW.toISOString(), completed_at: NOW.toISOString() }) === null,
    '🔴 B8 (negative): equal stamps are NOT a zero-minute stop — they are an unmeasured one, and must read null');
  ok(stopMinutes({ started_at: null, completed_at: NOW.toISOString() }) === null,
    'B9 (negative): a missing start cannot yield a duration');
  ok(stopMinutes({ started_at: '2026-08-31T18:00:00.000Z', completed_at: '2026-08-31T17:00:00.000Z' }) === null,
    'B10 (negative): a completion before its start is not a negative duration, it is unmeasured');
}

// ══ §C THE CREW SCREEN — and the paywall proof ═════════════════════════════════
{
  const fresh = crewStopModel({ status: 'scheduled', started_at: null, completed_at: null });
  ok(fresh.action === 'start',        'C1: an untouched stop offers Start');
  const running = crewStopModel({ status: 'scheduled', started_at: '2026-08-31T15:00:00.000Z', completed_at: null });
  ok(running.action === 'finish',     'C2: a started stop offers Mark done');
  const done = crewStopModel({ status: 'fulfilled', started_at: '2026-08-31T15:00:00.000Z', completed_at: '2026-08-31T16:00:00.000Z' });
  ok(done.action === null,            '🔴 C3 (negative): a completed stop offers NO control — no dead affordance');
  ok(done.minutes === 60,             'C4: a completed stop reports how long it took');
  ok(crewStopModel({ status: 'cancelled', started_at: null, completed_at: null }).action === null,
    'C5 (negative): a cancelled stop cannot be marked done');

  // 🔴 C6 — THE PAYWALL IS PROVEN BY THE SIGNATURE, NOT BY A VALUE COMPARISON.
  // The requirement is that the crew screen is byte-identical with the tile on and off. Comparing
  // two outputs would only prove that a branch nobody wrote is still absent. Instead assert the
  // stronger, structural fact: `crewStopModel` accepts exactly ONE parameter, and the source
  // declares no module/config/entitlement input — so the two cases CANNOT differ, because there is
  // no input through which they could. The day someone adds a config parameter, this goes red.
  ok(crewStopModel.length === 1,
    '🔴 C6: crewStopModel takes exactly one argument — module state cannot reach the crew screen');
  const src = readFileSync(SELF, 'utf8');
  const body = /export function crewStopModel\([\s\S]*?\n}/.exec(src)?.[0] ?? '';
  ok(body.length > 0, 'C7: the crewStopModel body was located for inspection');
  ok(!/module|config|enabled|entitle|review|paywall|upgrade/i.test(body),
    '🔴 C8: the crew screen body must not mention module/config/entitlement/review — a paywall the customer can read over a shoulder is the worst kind');
}

// ══ §D THE RULES THAT ARE NOT PREFERENCES ══════════════════════════════════════
//
// 🔴 DAVID'S RULING 2026-08-31: the rule is the CONSTRUCTION, not the topic — "anything of the
// form 'it helps if you mention…' is the prohibited construction WHATEVER FOLLOWS IT." So the
// probes below vary the OBJECT deliberately: if the check only fired on crews and plants it would
// be enforcing a word list, not the policy clause.
{
  // D1 — the shipped default must be clean. It is David's own wording.
  ok(DEFAULT_REVIEW_GUIDANCE === "If you have a moment, we'd appreciate a review.",
    'D1: the default is David\'s ruled wording — nothing about the contents');
  ok(reviewCopyProblems(DEFAULT_REVIEW_GUIDANCE).length === 0,
    'D1b: …and it passes its own check');

  // 🔴 D2 — THE CONSTRUCTION, WITH FOUR DIFFERENT OBJECTS. Every one must be refused, and the
  // last two are the point: they name nothing about staff or product, and are still the
  // prohibited act. A word-list check would pass them.
  const constructions = [
    'It helps most if you mention what we planted and how the crew did.',
    'It helps if you mention how quickly we arrived.',
    'It helps if you mention the weather.',
    'Please mention your experience.',
    'Be sure to talk about the service.',
    'Tell them what you thought.',
    'Don\'t forget to include it in your review.',
    'Make sure to describe the visit.',
  ];
  for (const line of constructions) {
    ok(reviewCopyProblems(line).length > 0,
      `🔴 D2: REFUSED whatever follows the directive — "${line}"`);
  }

  // D3 — the staff clause is enforced SEPARATELY, because Google enumerates it separately.
  ok(reviewCopyProblems('A note about the crew is always welcome.').length > 0,
    '🔴 D3: naming staff is refused on its own clause, with no directive verb present');
  ok(reviewCopyProblems('Our driver appreciates your feedback.').length > 0,
    'D3b: …and a different staff noun is caught too');

  // D4 — incentives.
  ok(reviewCopyProblems('Leave us a review and get 10% off your next order').length > 0,
    '🔴 D4: an incentive is refused');
  ok(reviewCopyProblems('A free tree for anyone who reviews us').length > 0,
    'D4b: a different incentive is refused');

  // D5 — screening.
  ok(reviewCopyProblems('If you are happy, please leave us a 5 star review').length > 0,
    '🔴 D5: sentiment screening is refused');
  ok(reviewCopyProblems('How did we do today?').length > 0,
    'D5b: the softest gating opener is refused');

  // 🔴 D6 — NEGATIVE CONTROLS. A check that refuses everything is not a check, and it would push
  // the owner into turning the feature off rather than writing a clean line.
  const clean = [
    "If you have a moment, we'd appreciate a review.",
    'A review helps our small family business.',
    'Thanks for your business.',
    'Reviews mean a lot to a family farm.',
    'We appreciate you taking the time.',
  ];
  for (const line of clean) {
    ok(reviewCopyProblems(line).length === 0,
      `D6 (negative control): an ordinary clean line is NOT refused — "${line}"`);
  }
  ok(reviewCopyProblems('').length === 0 && reviewCopyProblems(null).length === 0,
    'D7: an empty line has no problems (the default is used)');

  // D8 — the refusal must be an EXPLANATION, and it must carry the clause. A refusal nobody
  // understands gets worked around; a refusal quoting the policy can be checked against it.
  const why = reviewCopyProblems('It helps if you mention the crew.');
  ok(why.some(w => /request that specific content be included/i.test(w)),
    '🔴 D8: the content-direction refusal QUOTES clause ① back to the owner');
  ok(why.some(w => /identifies a staff member/i.test(w)),
    '🔴 D8b: the staff refusal QUOTES clause ② back to the owner');
  ok(reviewCopyProblems('get a free tree for a review').some(w => /incentives/i.test(w)),
    'D8c: the incentive refusal quotes its own clause');
}

// ══ §E THE ASK — every suppression renders the same nothing ════════════════════
const base: ReviewAskInput = {
  moduleEnabled: true,
  moduleConfigured: true,
  config: { review_url: 'https://g.page/r/lawns/review' },
  businessName: 'LAWNS Tree Farm',
  status: 'fulfilled',
  customerId: 'cust-1',
  reviewAskedAt: null,
  customerLastAskedAt: null,
  now: NOW,
};
{
  const good = reviewAskDecision(base);
  ok(good.offer !== null,                       'E1: a done stop at a configured business offers the ask');
  ok(good.offer?.url === 'https://g.page/r/lawns/review', 'E2: the offer carries the business own link');
  ok(good.offer?.lines[0] === 'Thanks for choosing LAWNS Tree Farm.', 'E3: the customer screen names the business');
  ok(good.offer?.lines[1] === DEFAULT_REVIEW_GUIDANCE, 'E4: and carries the guidance line');
  ok(good.suppressedBy === null,                'E5: nothing is suppressing it');

  // 🔴 E6 — THE TILE-OFF NO-OP. The single most important negative in this file.
  const off = reviewAskDecision({ ...base, moduleEnabled: false });
  ok(off.offer === null,                        '🔴 E6: tile off → NO offer at all');
  ok(off.suppressedBy === 'module_off',         'E7: …and the reason is available to the OWNER surface, never to the crew');

  ok(reviewAskDecision({ ...base, status: 'scheduled' }).offer === null,
    '🔴 E8 (negative): you cannot ask for a review of a job that has not happened');
  ok(reviewAskDecision({ ...base, config: {} }).offer === null,
    'E9 (negative): no link entered → nothing is shown (never a broken QR)');
  ok(reviewAskDecision({ ...base, config: { review_url: 'notaurl' } }).suppressedBy === 'bad_link',
    'E10 (negative): an unusable link is named as such rather than rendered');
  ok(reviewAskDecision({ ...base, reviewAskedAt: '2026-08-31T16:00:00.000Z' }).offer === null,
    'E11 (negative): a stop already asked is not asked twice');
  ok(reviewAskDecision({ ...base, customerId: null }).offer === null,
    'E12 (negative): with no customer the window cannot be honoured, so we do not ask');

  // E13/E14 — the repeat-trade window, probed on both sides of the boundary.
  const justInside = new Date(NOW.getTime() - (REVIEW_ASK_WINDOW_DAYS - 1) * 86_400_000).toISOString();
  const justOutside = new Date(NOW.getTime() - (REVIEW_ASK_WINDOW_DAYS + 1) * 86_400_000).toISOString();
  ok(reviewAskDecision({ ...base, customerLastAskedAt: justInside }).suppressedBy === 'asked_recently',
    '🔴 E13: a customer asked inside the window is not asked again');
  ok(reviewAskDecision({ ...base, customerLastAskedAt: justOutside }).offer !== null,
    '🔴 E14 (the other direction): outside the window the same customer may be asked again — the window is a window, not a ban');

  // E15 — a business with no name still gets honest copy rather than "Thanks for choosing null".
  ok(reviewAskDecision({ ...base, businessName: null }).offer?.lines[0] === 'Thanks for choosing us.',
    'E15: a missing business name degrades to honest copy, never a rendered null');

  // E16 — per-business guidance actually reaches the customer screen.
  const custom = reviewAskDecision({ ...base, config: { review_url: base.config!.review_url, review_guidance: 'A review means a lot to a family farm.' } });
  ok(custom.offer?.lines[1] === 'A review means a lot to a family farm.',
    'E16: the per-business line is used — a pantry line is not a nursery line');
}

// ══ §F CONFIG READING ══════════════════════════════════════════════════════════
{
  ok(readReviewAskConfig(null).reviewUrl === null, 'F1: absent config yields no link');
  ok(readReviewAskConfig({ review_url: '   ' }).reviewUrl === null, 'F2 (negative): whitespace is not a link');
  ok(readReviewAskConfig({ review_url: 42 as unknown as string }).reviewUrl === null, 'F3 (negative): a non-string is not a link');
  ok(readReviewAskConfig({ review_url: ' https://x.test/r ' }).reviewUrl === 'https://x.test/r', 'F4: a link is trimmed');
  ok(readReviewAskConfig({ trial_started_at: 'x', review_url: 'https://x.test/r' }).reviewUrl === 'https://x.test/r',
    'F5: the trial pair sharing this blob is ignored, not clobbered');
  ok(isUsableReviewUrl('https://g.page/r/x') && isUsableReviewUrl('http://x.test'), 'F6: http and https are usable');
  ok(!isUsableReviewUrl('javascript:alert(1)'), '🔴 F7 (negative): a javascript: URL is refused — this string reaches a QR and a link');
  ok(!isUsableReviewUrl(''), 'F8 (negative): empty is not usable');
}

// ══ §G THE RECORD — asked and skipped, never "reviews received" ════════════════
{
  const shown = reviewAskPatch(NOW, REVIEW_ASK_SHOWN);
  ok(shown.review_asked_at === NOW.toISOString() && shown.review_ask_outcome === 'shown', 'G1: showing the code is recorded');
  const skip = reviewAskPatch(NOW, REVIEW_ASK_SKIPPED);
  ok(skip.review_asked_at === NOW.toISOString() && skip.review_ask_outcome === 'skipped',
    '🔴 G2: a SKIP is recorded too — an unrecorded skip and a stop nobody reached look identical');

  // G3–G5 — Saturday 2026-08-29's real shape: seven stops, six done, one moved.
  const day = [
    { review_ask_outcome: 'shown' }, { review_ask_outcome: 'shown' }, { review_ask_outcome: 'shown' },
    { review_ask_outcome: 'skipped' }, { review_ask_outcome: 'skipped' },
    { review_ask_outcome: 'shown' }, { review_ask_outcome: null },
  ];
  const rate = askRateFor(day);
  ok(rate.asked === 6 && rate.shown === 4 && rate.skipped === 2, 'G3: asked counts only stops that reached the prompt');
  ok(Math.abs((rate.skipRate ?? 0) - 2 / 6) < 1e-9, 'G4: the skip rate is skipped over asked');
  ok(askRateFor([]).skipRate === null,
    '🔴 G5 (negative): with nothing asked the skip rate is null, NOT 0% — a fabricated zero is the D-9 failure this feature must not commit');
  ok(askRateFor([{ review_ask_outcome: null }]).asked === 0,
    'G6 (negative): a stop that never reached the prompt is not an ask');

  // 🔴 G7 — THE CLAIM THIS FEATURE MAY NEVER MAKE. Google does not report who left what, so no
  // count of RECEIVED reviews can exist. Asserted against the module source so that adding one
  // later fails here rather than shipping an invented number.
  const src = readFileSync(SELF, 'utf8');
  ok(!/\breviews?_(received|left|count|earned)\b|\breviewsReceived\b|\breviewCount\b/i.test(src),
    '🔴 G7: nothing in this module counts reviews RECEIVED — the platform cannot know that, and a tile reading "12 reviews generated" would invent a number nobody can know');
}

// ══ §H THE POLICY IS QUOTED VERBATIM AT THE REFUSAL ════════════════════════════
//
// David, 2026-08-31: "cite the policy AT THE REFUSAL, not only in a doc — the two clauses
// verbatim, beside the code that refuses. This is the rule most likely to be 'improved' in six
// months by someone who thinks a helpful prompt is harmless. It came to me from a research summary
// that recommended exactly what Google forbids."
{
  const raw = readFileSync(SELF, 'utf8');
  // A quoted clause wraps across comment lines, so match the WORDS, not the layout: strip the
  // leading `//` of each line and collapse whitespace. Asserting the raw text would make the
  // check fail on a reflow — a probe that breaks when nothing broke teaches people to delete it.
  const src = raw.replace(/^\s*\/\/ ?/gm, ' ').replace(/\s+/g, ' ');
  ok(/support\.google\.com\/business\/answer\/7400114/.test(raw),
    'H1: the policy source URL is at the code');
  ok(/Rating Manipulation/.test(src), 'H2: the section is named');

  // 🔴 H3/H4 — THE TWO CLAUSES, WORD FOR WORD. Asserted as exact substrings so a paraphrase, a
  // trim, or a well-meaning tidy-up fails here rather than quietly weakening the record.
  ok(src.includes('nor should they request that specific content be included'),
    '🔴 H3: clause ① is quoted VERBATIM beside the code that enforces it');
  ok(src.includes('including content that identifies a staff member'),
    '🔴 H4: clause ② is quoted VERBATIM beside the code that enforces it');
  ok(src.includes('Discourage or prohibit negative reviews, or selectively solicit positive reviews'),
    'H5: the gating clause is quoted verbatim');
  ok(src.includes('in exchange for posting any review'),
    'H6: the incentive clause is quoted verbatim');

  // H7 — the provenance is recorded, because it is the reason the rule needs teeth at all.
  ok(/research summary that recommended exactly what Google forbids/i.test(src),
    '🔴 H7: WHERE the prohibited wording came from is recorded — it arrived looking like best practice, and the next one will too');

  // H8 — the ruling that the rule is the construction, not the topic.
  ok(/whatever follows it/i.test(src),
    'H8: David\'s construction ruling is stated at the code');
}

console.log(`\ndeliveryFulfilment: ${passed} passed, ${failed} failed`);
if (failed) { console.error('\nFAILURES:\n' + failures.map(f => '  · ' + f).join('\n')); process.exit(1); }
