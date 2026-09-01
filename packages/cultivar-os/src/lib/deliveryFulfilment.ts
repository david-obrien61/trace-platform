// ============================================================
// deliveryFulfilment — THE ONE FULFILMENT ACTION, and the review ask that may follow it.
//
// PURPOSE:      `deliveries.status` could only ever say `scheduled` (tech-debt #121). This module
//               is the single statement of what "done" means on a delivery row, what it stamps,
//               and — separately — whether a review may be asked for afterwards.
//
//               🔴 ONE ACTION, NOT FIVE. The user story is explicit that the tap has FIVE
//               consumers (`user_stories.md` → "The stop is done — one tap, and a moved stop says
//               where it went"): the review request · completion status · contractor pay ·
//               material consumption · "what actually happened on a given day". Only the first two
//               exist today. The other three are why the patch is built as a VALUE returned by a
//               pure function rather than as an inline `.update({...})` at a call site — the fifth
//               consumer must not need this reshaped. §6 r8.
//
// DEPENDENCIES: none. Pure — no React, no Supabase, no DOM, no clock of its own (every entry point
//               takes `now`). This is deliberate: a render condition inside a `.tsx` cannot be
//               asserted (tech-debt #134), so every DECISION lives here where a test can reach it.
//
// OUTPUTS:      DELIVERY_STATUSES · isDeliveryFulfilled · fulfilmentPatch · crewStopModel
//               readReviewAskConfig · reviewAskDecision · reviewAskPatch · askRateFor
//
// ── AC-1: no vertical noun anywhere in this file. A "stop" is a stop for a nursery, a pantry or a
//    workshop; nothing here knows what was delivered.
// ============================================================

// ════════════════════════════════════════════════════════════════════════════════════════════
// §1 THE STATUS VOCABULARY
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 WHY THERE IS NO DATABASE CHECK, STATED HERE BECAUSE IT LOOKS LIKE AN OMISSION.
//
// `deliveries.status` is `text NOT NULL DEFAULT 'scheduled'` with NO CHECK, and that is a
// DELIBERATE, DOCUMENTED decision made when the table was created — `20260620_deliveries.sql`
// says so in its own header: *"AC-4: status is free text with NO CHECK — the value-set grows
// (scheduled → out_for_delivery → delivered → …) without a migration."* The platform then made the
// same call a second time and wrote down why: `20260715` DROPPED a status CHECK, and `orderStatus.ts`
// cites it — *"a DB CHECK on a business vocabulary is the anti-pattern."*
//
// So the vocabulary is enforced in ONE place in code, exactly as `ORDER_STATUSES` is. This file is
// that place for deliveries. Adding a CHECK now would contradict the table's own recorded reasoning
// AND would have to be reconciled with the QuickBooks ingest that writes these rows — the
// tech-debt #91 shape, where two CHECKs on adjacent tables disagreed and one of them could refuse a
// value nothing else knew was illegal.
//
// ⚠️ MEASURED, NOT ASSUMED (2026-08-31): `scheduled` is the ONLY value this column has ever held,
// across every tenant — the nine LAWNS rows and the nineteen the QuickBooks ingest just added. So
// `fulfilled` below is the FIRST other value the column will carry, and it is worth being precise
// about what makes that safe rather than asserting that it is:
//
//   ✅ The value is not new to the CODE, only to the DATA. `historyOrder.ts`'s `DELIVERY_COMPLETE`
//      list already accepts `complete` / `completed` / `delivered` / `fulfilled` / `done`, and its
//      own comment says it was written in advance *"so that the day a 'mark delivered' control
//      ships the order status follows automatically instead of needing this rule rediscovered."*
//      THIS IS THAT CONTROL. The seam was built for it and left dormant.
//   ✅ `fulfilled` — rather than `delivered`, which the 06-20 migration comment guessed at — because
//      R-20 already ruled `fulfilled` the platform's word for *the goods have gone*, matching
//      QuickBooks' own vocabulary, and because a `service_type:'planting'` job is completed rather
//      than "delivered". One word for one fact across both rows beats two words that must be kept
//      in sync. ⚠️ Flagged to David rather than assumed: `delivered` remains equally legal to the
//      code, so this is a choice, not a constraint.
//   ✅ Nothing re-derives an EXISTING order's status from this column. `historyOrderStatus()` is
//      called at CAPTURE time, building a history order from a scanned document; it does not run
//      over rows already written. So marking a stop done today moves no existing order and,
//      per D-52, moves no stock — committed is derived over OPEN orders, and this touches none of
//      them. The fulfil-time inventory decrement is a LATER consumer of this same tap, deliberately
//      not built here.
//
// The reader who adds the next value: add it here, and check `isDeliveryFulfilled` still means what
// it says. Do not add a CHECK without reading the two migrations named above.

export const DELIVERY_STATUS_SCHEDULED = 'scheduled';
export const DELIVERY_STATUS_FULFILLED = 'fulfilled';
const DELIVERY_STATUS_CANCELLED = 'cancelled';

/** The values this platform writes. Others may EXIST (the column is open) and are rendered raw. */
export const DELIVERY_STATUSES = [
  DELIVERY_STATUS_SCHEDULED,
  DELIVERY_STATUS_FULFILLED,
  DELIVERY_STATUS_CANCELLED,
] as const;

const DELIVERY_STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  scheduled: { label: 'Scheduled', color: '#1E40AF', bg: '#DBEAFE' },
  fulfilled: { label: 'Done',      color: '#27500A', bg: '#DCFCE7' },
  cancelled: { label: 'Cancelled', color: '#991B1B', bg: '#FEE2E2' },
};

/**
 * Presentation for ANY status string, including one this vocabulary does not know — the same
 * fallback contract `orderStatusMeta` defines, for the same reason: a status we cannot explain is a
 * fact about the data, and relabelling it as something recognised is the D-9 failure of showing a
 * confident label over a value nobody looked at.
 */
export function deliveryStatusMeta(status: string | null | undefined): { label: string; color: string; bg: string } {
  const key = String(status ?? '');
  return DELIVERY_STATUS_META[key] ?? { label: key || 'No status', color: '#6b7280', bg: '#f3f4f6' };
}

/** Has this stop been marked done? Mirrors `historyOrder.isDeliveryComplete` — same word set. */
export function isDeliveryFulfilled(status: string | null | undefined): boolean {
  const s = String(status ?? '').trim().toLowerCase();
  return s === DELIVERY_STATUS_FULFILLED || s === 'delivered' || s === 'complete' || s === 'completed' || s === 'done';
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §2 THE TAP — what it writes
// ════════════════════════════════════════════════════════════════════════════════════════════

interface DeliveryTimes {
  started_at: string | null;
  completed_at: string | null;
}

interface FulfilmentPatch {
  status: string;
  started_at?: string;
  completed_at: string;
}

/**
 * The column patch a fulfilment tap writes. A VALUE, not a write — the caller performs the update,
 * so the same patch can be replayed by a future consumer (contractor pay, the decrement) without
 * this decision being re-derived at a second call site.
 *
 * 🔴 THE TIMES ARE THE POINT, AND THEY ARE WHY THIS IS NOT JUST A STATUS WRITE. The capacity model
 * the whole schedule rests on uses ONE MINUTE PER GALLON — a figure David and Lauren invented on
 * 2026-08-26 and never measured. Two stamps turn that guess into a measurement. It has been
 * deferred five times, so it is stamped by the same act that marks the stop done rather than by a
 * separate control someone has to remember to use.
 *
 * `started_at` is only written if the stop has not already been started — a crew that taps Start,
 * then Done, keeps its real start; a crew that taps only Done gets both stamps at the same instant,
 * which is HONEST (we know when it finished, we do not know when it began) and is distinguishable
 * from a measured interval precisely because the two values are equal.
 */
export function fulfilmentPatch(now: Date, existing: DeliveryTimes | null): FulfilmentPatch {
  const iso = now.toISOString();
  const patch: FulfilmentPatch = { status: DELIVERY_STATUS_FULFILLED, completed_at: iso };
  if (!existing?.started_at) patch.started_at = iso;
  return patch;
}

/** The patch a "start" tap writes — nothing else moves, the stop stays scheduled. */
export function startPatch(now: Date): { started_at: string } {
  return { started_at: now.toISOString() };
}

/**
 * How long a stop took, in minutes, or null when it cannot be known.
 *
 * Equal stamps → null, NOT zero. A stop that was stamped once carries no duration, and reporting
 * `0` would put a fabricated measurement into the very dataset this exists to measure honestly
 * (D-9 — absent is not empty). The capacity model must be able to tell "we did not measure this"
 * from "this took no time".
 */
export function stopMinutes(t: DeliveryTimes | null): number | null {
  if (!t?.started_at || !t?.completed_at) return null;
  const a = Date.parse(t.started_at), b = Date.parse(t.completed_at);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return null;
  return Math.round((b - a) / 60000);
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §3 THE CREW'S OWN SCREEN — built WITHOUT any knowledge of the review module
// ════════════════════════════════════════════════════════════════════════════════════════════

interface CrewStopInput {
  status: string | null;
  started_at: string | null;
  completed_at: string | null;
}

interface CrewStopModel {
  statusLabel: string;
  statusColor: string;
  statusBg: string;
  /** Which control the crew sees. `null` = no control (the stop is already done or cancelled). */
  action: 'start' | 'finish' | null;
  actionLabel: string | null;
  minutes: number | null;
}

/**
 * 🔴 THE PAYWALL PROOF IS THE SIGNATURE, NOT A TEST.
 *
 * The requirement is that the crew's screen is BYTE-IDENTICAL whether or not the business pays for
 * the review tile — because a greyed "upgrade to ask for reviews" button on a crew member's phone,
 * in a customer's garden, is the worst possible place for a paywall: the customer can read it over
 * their shoulder.
 *
 * The cheapest way to guarantee that is to make it UNREPRESENTABLE. This function computes
 * everything the crew sees before the tap, and it takes NO module state, NO config and NO
 * entitlement argument — so there is no input through which the two cases could differ. A test
 * asserting equality would only be checking that a branch nobody wrote is still not there; the
 * signature is the assertion. `reviewAskDecision` (§4) is consulted only AFTER the tap has already
 * been written, which is also when it is honest to consult it: you cannot ask for a review of a job
 * that has not happened.
 *
 * If someone later adds a `config` parameter here, that is the moment the guarantee is lost. Do not.
 */
export function crewStopModel(d: CrewStopInput): CrewStopModel {
  const meta = deliveryStatusMeta(d.status);
  const done = isDeliveryFulfilled(d.status);
  const cancelled = String(d.status ?? '').trim().toLowerCase() === DELIVERY_STATUS_CANCELLED;
  const action: CrewStopModel['action'] = done || cancelled ? null : d.started_at ? 'finish' : 'start';
  return {
    statusLabel: meta.label,
    statusColor: meta.color,
    statusBg: meta.bg,
    action,
    actionLabel: action === 'start' ? 'Start this stop' : action === 'finish' ? 'Mark done' : null,
    minutes: stopMinutes(d),
  };
}

// ════════════════════════════════════════════════════════════════════════════════════════════
// §4 THE REVIEW ASK — a TILE, and a genuine no-op when it is off
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// 🔴🔴 THREE RULES THAT ARE NOT PREFERENCES. THEY ARE GOOGLE POLICY, AND BREAKING THEM CAN COST THE
// BUSINESS ITS REVIEWS — not ours to trade away for a nicer flow.
//
// Source, read and quoted verbatim on 2026-08-31: Google Business Profile Help → "Prohibited &
// restricted content" (support.google.com/business/answer/7400114), section **Rating Manipulation**.
//
//   ① NO SCREENING / NO GATING. *"Discourage or prohibit negative reviews, or selectively solicit
//      positive reviews from customers"* is prohibited. So there is NO "rate us 1–5, and if it is 4
//      or more here is the Google link" step, and there must never be one. The code either shows
//      the customer the review destination or shows them nothing. **The crew's judgement about
//      whether to ask at all is the only filter, and that is a human declining to solicit — not the
//      software filtering by predicted sentiment.**
//
//   ② NO INCENTIVES, ANYWHERE. *"Offer incentives – such as payment, discounts, free goods and/or
//      services - in exchange for posting any review or revision or removal of a negative review."*
//      No discount, no gift, no prize draw — not in this copy, and not in the per-business guidance
//      line, which is why that line is validated rather than trusted (`REVIEW_COPY_FORBIDDEN`).
//
//   ③ NO CONTENT DIRECTION — and this one is the least obvious of the three, which is exactly why
//      it is written here. *"When soliciting reviews, merchants should not require or pressure
//      users to leave ratings or write reviews while on the premises, nor should they **request
//      that specific content be included**"*, and the same section names *"Merchants requesting
//      that staff solicit reviews that include specific content, **including content that
//      identifies a staff member**."*
//      ⚠️ So a line like *"it helps most if you mention what we planted and how the crew did"* is
//      the prohibited shape TWICE OVER — it requests specific content, and the content it requests
//      identifies staff. It is a natural thing to want (naming the work and the crew IS what turns
//      a rating into a review) and it is the first thing anyone will try to add. It is not
//      available to us. The default copy below asks for a review and says nothing about what it
//      should contain.
//
// 🔴 AND THE FOURTH THING, WHICH IS OURS RATHER THAN GOOGLE'S: **NEVER CLAIM A REVIEW WAS LEFT.**
// Google does not report which customer left which review, so the platform cannot know. This module
// records THE ASK and nothing else. A tile reading "12 reviews generated" would be inventing a
// number nobody can know — D-9's plainest form. `askRateFor` below reports asked / skipped, and the
// business's public review count is left to speak for itself.
//
// This comment is here, at the code, and not only in a doc, because this is precisely the thing
// somebody "improves" in six months by adding a helpful screening question.

// ════════════════════════════════════════════════════════════════════════════════════════════
// THE REFUSAL — and the policy, VERBATIM, beside the code that enforces it
// ════════════════════════════════════════════════════════════════════════════════════════════
//
// 🔴 THE TWO CLAUSES ARE QUOTED HERE, IN FULL, AT THE POINT OF REFUSAL — not merely referenced.
// Read 2026-08-31 from Google Business Profile Help → "Prohibited & restricted content"
// (https://support.google.com/business/answer/7400114), section **Rating Manipulation**:
//
//   ① "When soliciting reviews, merchants should not require or pressure users to leave ratings
//      or write reviews while on the premises, nor should they request that specific content be
//      included."
//
//   ② "Merchants requesting that staff solicit reviews that include specific content, including
//      content that identifies a staff member."
//
// and, for the incentive and gating rules that sit beside them in the same section:
//
//   ③ "Discourage or prohibit negative reviews, or selectively solicit positive reviews from
//      customers"
//   ④ "Offer incentives – such as payment, discounts, free goods and/or services - in exchange
//      for posting any review or revision or removal of a negative review."
//
// 🔴 WHY THE QUOTES ARE HERE RATHER THAN IN A DOC, AND THIS IS THE LOAD-BEARING PART:
// **THE PROHIBITED WORDING REACHED THIS PROJECT FROM A RESEARCH SUMMARY THAT RECOMMENDED EXACTLY
// WHAT GOOGLE FORBIDS** (David, 2026-08-31). It arrived looking like best practice, because that
// is what it looks like — asking the customer to name the work and the crew genuinely does produce
// a better review, and that is precisely why the policy names it. So the failure mode is not
// carelessness; it is a helpful-sounding suggestion from a plausible source, and the next one will
// arrive the same way. A reader who has the clauses in front of them can check a proposal against
// the words. A reader with only a pointer will follow the suggestion.
//
// 🔴 DAVID'S RULING, 2026-08-31 — THE RULE IS THE CONSTRUCTION, NOT THE TOPIC:
// **"Anything of the form 'it helps if you mention…' is the prohibited construction whatever
// follows it."**
// This is STRICTER than the first implementation and it is the correct generalisation. The first
// version keyed on the OBJECT — it caught "mention the crew" and "mention what we planted" — which
// means it would have passed "it helps if you mention how quickly we arrived", a sentence that is
// the same prohibited act with a different noun. Clause ① prohibits requesting that specific
// content be included; it does not enumerate which content. **So the check fires on the DIRECTIVE,
// and never asks what is being directed.**

/**
 * The three refusals. Each carries the clause it enforces so a refusal can be checked against the
 * policy rather than merely obeyed.
 */
const REVIEW_COPY_FORBIDDEN: { pattern: RegExp; why: string }[] = [
  // ── ① + ② CONTENT DIRECTION — fires on the CONSTRUCTION, whatever follows it ──
  //
  // Two shapes, and neither one looks at the object:
  //   (a) a bare directive verb of telling — mention / include / talk about / write about /
  //       describe / tell them / let them know / be sure to say. In a line whose entire purpose is
  //       to solicit a review, ANY of these is "request[ing] that specific content be included".
  //   (b) the "it helps if/to/most…" frame David named, which is the polite form of the same act.
  {
    pattern: /\b(mention|mentioning|talk about|write about|describe|be sure to|don'?t forget to|make sure to)\b|\b(tell|let|remind)\s+(them|him|her|people|others|everyone)\b|\binclude\b[^.]{0,40}\b(review|it|that|this)\b|\bin your review\b|\bit\s+(would\s+)?helps?\s+(if|to|most)\b/i,
    why: 'directs what the review should say. Google prohibits this whatever the topic is — '
       + '"nor should they request that specific content be included" (Rating Manipulation). '
       + 'Ask for a review; say nothing about its contents.',
  },
  // ② is a SEPARATE refusal, not a special case of ①, because it is separately enumerated and
  // because naming staff is the single most tempting version of the mistake.
  {
    pattern: /\b(crew|driver|drivers|staff|installer|technician|team member|our guys|the men|the lads|by name)\b/i,
    why: 'names or points at a staff member. Google separately prohibits "requesting that staff '
       + 'solicit reviews that include specific content, including content that identifies a '
       + 'staff member" (Rating Manipulation).',
  },
  // ④ INCENTIVES
  {
    pattern: /\b(discount|coupon|voucher|free|gift|prize|giveaway|raffle|entry into|store credit|refund|reward|on us)\b|%\s*off/i,
    why: 'offers something in return for a review. Google prohibits "incentives – such as payment, '
       + 'discounts, free goods and/or services - in exchange for posting any review" '
       + '(Rating Manipulation).',
  },
  // ③ SCREENING / GATING
  {
    pattern: /\b([45]\s*star|five star|four star|only if|were you happy|how did we do)\b|\bif you(?:'?re| are)?\s{0,3}(happy|satisfied|pleased|enjoyed)\b/i,
    why: 'screens by sentiment before the review page is shown. Google prohibits "discourag[ing] '
       + 'or prohibit[ing] negative reviews, or selectively solicit[ing] positive reviews from '
       + 'customers" (Rating Manipulation).',
  },
];

/**
 * Is this guidance line safe to show? Returns the reasons it is not, or an empty array.
 * Used by the settings surface to REFUSE a line rather than to warn about it after saving.
 */
export function reviewCopyProblems(line: string | null | undefined): string[] {
  const s = String(line ?? '');
  if (!s.trim()) return [];
  return REVIEW_COPY_FORBIDDEN.filter(r => r.pattern.test(s)).map(r => r.why);
}

export const DEFAULT_REVIEW_GUIDANCE = "If you have a moment, we'd appreciate a review.";   // David's wording, 2026-08-31

/**
 * How long before the same customer may be asked again.
 *
 * LAWNS has 1,936 customers with real repeat trade — the same person is on the schedule several
 * times a year — and being asked for a review at every single visit is how a business trains its
 * customers to ignore the ask. Six months is one growing season plus a margin: long enough that a
 * repeat customer is not asked twice for what they experience as the same relationship, short
 * enough that a genuinely annual customer is still reachable.
 */
export const REVIEW_ASK_WINDOW_DAYS = 180;

interface ReviewAskConfig {
  /** The business's own Google review destination, from their Google Business Profile. */
  reviewUrl: string | null;
  /** The per-business guidance line. Null → DEFAULT_REVIEW_GUIDANCE. */
  guidance: string | null;
}

/** Read the review-ask settings out of a `business_modules.config` blob. Unknown keys ignored. */
export function readReviewAskConfig(config: Record<string, unknown> | null | undefined): ReviewAskConfig {
  const c = (config ?? {}) as Record<string, unknown>;
  const url = typeof c.review_url === 'string' && c.review_url.trim() ? c.review_url.trim() : null;
  const guide = typeof c.review_guidance === 'string' && c.review_guidance.trim() ? c.review_guidance.trim() : null;
  return { reviewUrl: url, guidance: guide };
}

/**
 * A review URL must be an absolute http(s) URL. We do NOT check that it is a Google domain: a
 * business may legitimately use a short link, a profile link, or a different review destination
 * entirely, and refusing those would be us inventing a rule Google does not have.
 */
export function isUsableReviewUrl(url: string | null | undefined): boolean {
  const s = String(url ?? '').trim();
  if (!s) return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}

type ReviewAskSuppression =
  | 'module_off'      // the business does not have the follow-up tile
  | 'not_configured'  // the tile is on but no review link has been entered
  | 'bad_link'        // a link was entered but it is not a usable URL
  | 'not_fulfilled'   // the stop is not done — you cannot ask about a job that has not happened
  | 'no_customer'     // nothing to record the ask against, so the window could not be honoured
  | 'already_asked'   // this stop has already been through the prompt
  | 'asked_recently'; // this customer was asked within REVIEW_ASK_WINDOW_DAYS

export interface ReviewAskOffer {
  url: string;
  /** The customer-facing lines, in order. Assembled here so no `.tsx` invents copy. */
  lines: string[];
  guidance: string;
}

export interface ReviewAskInput {
  moduleEnabled: boolean;
  moduleConfigured: boolean;
  config: Record<string, unknown> | null;
  businessName: string | null;
  status: string | null;
  customerId: string | null;
  /** This stop's own prior ask, if any. */
  reviewAskedAt: string | null;
  /** The most recent ask to THIS customer on any stop, if any. */
  customerLastAskedAt: string | null;
  now: Date;
}

/**
 * 🔴 THE WHOLE PAYWALL, IN ONE RETURN VALUE: `null` means there is nothing to render, and every
 * caller renders nothing. There is no greyed control, no "upgrade" copy, no placeholder — the
 * suppression reason is returned ALONGSIDE for the desk/settings surfaces to explain to the OWNER,
 * and is never handed to the crew screen.
 *
 * ⚠️ TWO AUDIENCES, ONE DEVICE — and they are separately languaged. The crew's buttons (§3) and the
 * customer's screen (this function's `lines`) are assembled by different code paths on purpose, and
 * nothing here reads a business-level language setting. There is no such setting and one would be
 * the wrong shape: Cuto, who does the on-site maintenance at LAWNS, speaks no English while the
 * office does — one business, more than one language — so the axis is per-PERSON (the crew member's
 * own choice) and per-AUDIENCE (crew vs customer), never per-tenant. Full translation is a later
 * story; what this build owes it is not to write down an assumption that would have to be undone.
 */
export function reviewAskDecision(
  input: ReviewAskInput,
): { offer: ReviewAskOffer | null; suppressedBy: ReviewAskSuppression | null } {
  const no = (r: ReviewAskSuppression) => ({ offer: null, suppressedBy: r });

  // Order matters only for the OWNER-facing explanation; every branch renders the same nothing.
  if (!input.moduleEnabled) return no('module_off');
  if (!isDeliveryFulfilled(input.status)) return no('not_fulfilled');

  const cfg = readReviewAskConfig(input.config);
  if (!cfg.reviewUrl) return no(input.moduleConfigured ? 'not_configured' : 'not_configured');
  if (!isUsableReviewUrl(cfg.reviewUrl)) return no('bad_link');

  if (input.reviewAskedAt) return no('already_asked');
  if (!input.customerId) return no('no_customer');

  if (input.customerLastAskedAt) {
    const last = Date.parse(input.customerLastAskedAt);
    if (Number.isFinite(last)) {
      const days = (input.now.getTime() - last) / 86_400_000;
      if (days < REVIEW_ASK_WINDOW_DAYS) return no('asked_recently');
    }
  }

  const guidance = cfg.guidance ?? DEFAULT_REVIEW_GUIDANCE;
  const who = String(input.businessName ?? '').trim();
  const lines = [
    who ? `Thanks for choosing ${who}.` : 'Thanks for choosing us.',
    guidance,
  ];
  return { offer: { url: cfg.reviewUrl, lines, guidance }, suppressedBy: null };
}

export const REVIEW_ASK_SHOWN   = 'shown';
export const REVIEW_ASK_SKIPPED = 'skipped';

/**
 * The patch recording that the ask happened. `shown` and `skipped` are both RECORDED — the skip is
 * not an absence.
 *
 * 🔴 THE SKIP RATE IS THE SIGNAL NOBODY EXPECTS, which is why skipping writes a row rather than
 * doing nothing. If crews skip a third of jobs, that is a job problem surfacing through a review
 * feature — the honest reading is that something about those jobs is not ending well — and it can
 * only be read if the skip is recorded. An unrecorded skip and a stop nobody reached look identical.
 */
export function reviewAskPatch(now: Date, outcome: typeof REVIEW_ASK_SHOWN | typeof REVIEW_ASK_SKIPPED) {
  return { review_asked_at: now.toISOString(), review_ask_outcome: outcome };
}

interface AskRate {
  asked: number;
  shown: number;
  skipped: number;
  /** Skips as a share of asks, or null when nothing has been asked — never a fabricated 0%. */
  skipRate: number | null;
}

/** Asked vs skipped across a set of stops. NEVER reviews received — see the §4 header, rule four. */
export function askRateFor(rows: { review_ask_outcome: string | null }[]): AskRate {
  let shown = 0, skipped = 0;
  for (const r of rows) {
    if (r.review_ask_outcome === REVIEW_ASK_SHOWN) shown++;
    else if (r.review_ask_outcome === REVIEW_ASK_SKIPPED) skipped++;
  }
  const asked = shown + skipped;
  return { asked, shown, skipped, skipRate: asked === 0 ? null : skipped / asked };
}
