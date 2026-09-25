// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      "Where do the trees go?" — ONE step. Lauren picks a saved address or types a new
//               one, and the geocode verdict runs behind it, speaking only when it must.
// DEPENDENCIES: geocodeFreshness · geocodeResult (both pure). No network here — this decides
//               WHETHER to geocode and WHAT to ask; the caller performs the fetch.
// OUTPUTS:      planAddressStep() · AddressStepPlan · applyGeocodeToStep().
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 NEVER TWO QUESTIONS FOR ONE ADDRESS, AND USUALLY NONE AT ALL.
// ═════════════════════════════════════════════════════════════════════════════
// David, 2026-09-24: picking the address and checking it are the SAME MOMENT, not two steps. The
// regression Lauren would hate is a homeowner with a perfectly good saved address being asked
// anything — she is standing at a counter with a customer in front of her.
//
// So this returns AT MOST ONE question, and the first rule is the silent one:
//
//   · a saved address whose coordinate is FOUND and less than 30 days old → NO geocode call is
//     made at all, and nothing is asked. The 30-day clock (Google ToS §6.3.1) is what makes that
//     safe: inside the window we may use what we stored.
//   · anything else is geocoded once, and AT MOST one question follows.
//
// ⚠️ THE ORDER MATTERS AND IS NOT AN OPTIMISATION. Checking freshness BEFORE geocoding is what
// makes the ordinary case silent; doing it after would fetch, classify, and then discover we
// already knew — spending a request and, worse, risking a `confirm` on an address the person
// already confirmed weeks ago. A question asked twice is a question that stops being read.
//
// ── DAVID'S MODEL, 2026-09-09 ───────────────────────────────────────────────────────────────
// ONE bill-to, MANY delivery addresses, with a checkbox: "delivery address is the same".
// 🔴 THE BILL-TO IS OFFERED FIRST AND UNLABELLED. Measured 2026-09-09: only TEN LAWNS customers
// have a genuinely different delivery street — for most homeowners the billing address IS where
// the trees go. An earlier design labelled billing-only addresses as if they needed justifying,
// which would have flagged most customers' ONLY address as suspect. The kind counts (761 billing,
// 720 both, 15 shipping) came from how the IMPORT typed rows; no behaviour keys on them beyond
// ordering the list.
// ─────────────────────────────────────────────────────────────────────────────
import { isUsable, answerIsFresh, type StoredCoordinate } from './geocodeFreshness';
import { classifyGeocodeResponse, verdictMessage, type GeocodeOutcome } from './geocodeResult';

/** An address the person can choose, as the step needs to see it. */
export interface ChoosableAddress extends StoredCoordinate {
  id?: string | null;
  line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  /** billing · shipping · both — David's 2026-09-09 model. */
  kind?: string | null;
  geocode_status?: string | null;
}

/** What the step asks, if anything. Exactly one of these, never two. */
export type StepQuestion =
  /** Nothing to ask. The address may be priced. */
  | { ask: 'none' }
  /** One confirm: the person chooses between what they have and what Google says. */
  | { ask: 'confirm'; mine: string; google: string; message: string }
  /** Cannot be placed: save it, mark it unverified, do not price it. */
  | { ask: 'cannot-place'; message: string };

export interface AddressStepPlan {
  /** Does the caller need to call Google at all? */
  geocode: boolean;
  /** The question to put, when it is already decidable without a fetch. */
  question: StepQuestion;
  /** Why — for the trail, and for a person reading a failure list. */
  reason: string;
}

/** One line of an address, as a person reads it. */
export function addressLine(a: ChoosableAddress | null | undefined): string {
  if (!a) return '';
  return [a.line1, a.city, a.state, a.zip].map(p => (typeof p === 'string' ? p.trim() : '')).filter(Boolean).join(', ');
}

/**
 * Order the choices the way David's checkbox works: the bill-to first and unlabelled, then the
 * delivery-only sites. `both` counts as the bill-to — it IS the billing address.
 *
 * 🔴 NO ADDRESS IS LABELLED AS A PROBLEM HERE. For most homeowners the only address on file is
 * their billing address and it is exactly where the trees go.
 */
export function orderChoices<T extends ChoosableAddress>(addresses: readonly T[]): T[] {
  const rank = (a: T) => (a.kind === 'billing' || a.kind === 'both' ? 0 : 1);
  return [...addresses].sort((x, y) => rank(x) - rank(y));
}

/**
 * Decide what happens when this address is chosen, BEFORE spending a Google request.
 *
 * 🔴 THE SILENT PATH IS FIRST AND IT IS THE COMMON ONE. A saved address that was FOUND and is
 * less than thirty days old needs no call and no question — the person picked it, we already know
 * where it is, and the clock says we may still say so.
 */
export function planAddressStep(chosen: ChoosableAddress | null | undefined, now: Date): AddressStepPlan {
  if (!chosen || addressLine(chosen) === '') {
    return { geocode: false, question: { ask: 'none' }, reason: 'no address chosen' };
  }
  // A previously UNPLACEABLE address stays unplaceable until its text changes — re-asking Google
  // the same question gets the same answer and re-asking the PERSON is the second question this
  // exists to prevent.
  // ⚠️ DATED, NOT PERMANENT. An unplaceable address is left alone only while the answer is inside
  // the 30-day window; after that we look again, because new streets genuinely appear — Liberty
  // Hill's are 35% of the town. An UNDATED `not_found` is re-checked for the same reason.
  if (chosen.geocode_status === 'not_found' && answerIsFresh(chosen, now)) {
    return {
      geocode: false,
      question: { ask: 'cannot-place', message: verdictMessage({ verdict: 'not_found', latitude: null, longitude: null, suggestion: null, reason: 'previously not found' }, addressLine(chosen)) ?? '' },
      reason: 'already known to be unplaceable',
    };
  }
  if (chosen.geocode_status === 'found' && isUsable(chosen, now)) {
    return { geocode: false, question: { ask: 'none' }, reason: 'found and within the 30-day window' };
  }
  // 🔴 A PERSON ALREADY ANSWERED THIS ONE. `confirm` on a stored row does not mean "a question is
  // pending" — a pending confirm is never written (see `applyGeocodeToStep`, which returns
  // `store: null` for exactly that reason). It means the question was PUT and ANSWERED, and the
  // answer was "keep mine". Asking again on the next visit is the second question this whole step
  // exists to prevent, and it would be the most annoying kind: one the customer already settled.
  // ⚠️ It is deliberately NOT promoted to `found`. The address is still unverified, so `mayPrice`
  // stays false and a delivery to it is never priced from a guess.
  if (chosen.geocode_status === 'confirm' && answerIsFresh(chosen, now)) {
    return { geocode: false, question: { ask: 'none' }, reason: 'a person already answered this one' };
  }
  return { geocode: true, question: { ask: 'none' }, reason: chosen.geocode_status === 'found' ? 'coordinate has expired' : 'never geocoded' };
}

/**
 * Turn a Google response into the step's single question, and into what may be stored.
 *
 * 🔴 `store` IS WHAT GOES IN THE DATABASE, AND IT NEVER CONTAINS GOOGLE'S TEXT. David's ruling:
 * Google suggests, the person confirms, and what we store is THEIR choice. So a `confirm` writes
 * nothing until the person answers — the coordinate is carried on the plan, not persisted.
 */
export function applyGeocodeToStep(raw: unknown, typed: string): {
  question: StepQuestion;
  outcome: GeocodeOutcome;
  /** Fields to write now. Empty when a person still has to answer. */
  store: { latitude: number; longitude: number; geocoded_at: string; geocode_status: 'found' }
       | { geocode_status: 'not_found' }
       | null;
} {
  const outcome = classifyGeocodeResponse(raw);
  const message = verdictMessage(outcome, typed) ?? '';
  if (outcome.verdict === 'found') {
    return {
      question: { ask: 'none' },
      outcome,
      store: {
        latitude: outcome.latitude as number, longitude: outcome.longitude as number,
        geocoded_at: new Date().toISOString(), geocode_status: 'found',
      },
    };
  }
  if (outcome.verdict === 'confirm') {
    // Nothing is stored yet — the person has not chosen. Storing Google's coordinate here would
    // silently accept a correction they were about to be asked about.
    return { question: { ask: 'confirm', mine: typed, google: outcome.suggestion ?? typed, message }, outcome, store: null };
  }
  return { question: { ask: 'cannot-place', message }, outcome, store: { geocode_status: 'not_found' } };
}

/** What a person chose when the step asked them to confirm. */
export type ConfirmChoice = 'mine' | 'google';

/**
 * 🔴 WHAT IS WRITTEN ONTO THE ADDRESS RECORD **AFTER** A PERSON ANSWERS — ruling 1, 2026-09-24.
 *
 * This is the other half of `applyGeocodeToStep`, and the split is the whole point. That function
 * runs BEFORE the person answers and returns `store: null` for a `confirm`, because storing
 * Google's answer while someone is mid-question silently accepts a correction they were being
 * asked about. THIS function runs AFTER, and records what they actually decided.
 *
 * · they picked GOOGLE's version → it is verified: the coordinate is kept and the status is
 *   `found`. This is the ONE case where the address TEXT may be rewritten (ruling 2, 2026-09-23:
 *   Google suggests, the person confirms, and what is stored is THEIR choice — here their choice
 *   IS Google's). The caller does the text change; this returns the geocode half.
 * · they kept THEIRS → `confirm`, and 🔴 NO COORDINATE. Google's pin belongs to Google's text, and
 *   attaching it to a different street is precisely how a truck ends up at the house next door.
 *   The row records that the question was asked and answered, so it is never asked again, and the
 *   address stays unpriceable because nothing verified it.
 */
export function resolveAddressCheck(outcome: GeocodeOutcome, choice: ConfirmChoice, now: Date): {
  latitude: number | null; longitude: number | null;
  geocoded_at: string; geocode_status: 'found' | 'confirm' | 'not_found';
} {
  const at = now.toISOString();
  if (outcome.verdict === 'found') {
    return { latitude: outcome.latitude, longitude: outcome.longitude, geocoded_at: at, geocode_status: 'found' };
  }
  if (outcome.verdict === 'not_found') {
    return { latitude: null, longitude: null, geocoded_at: at, geocode_status: 'not_found' };
  }
  if (choice === 'google') {
    return { latitude: outcome.latitude, longitude: outcome.longitude, geocoded_at: at, geocode_status: 'found' };
  }
  return { latitude: null, longitude: null, geocoded_at: at, geocode_status: 'confirm' };
}

/** May a delivery to this address be priced? The one question the charge path asks. */
export function mayPrice(a: ChoosableAddress | null | undefined, now: Date): boolean {
  if (!a) return false;
  return a.geocode_status === 'found' && isUsable(a, now);
}
