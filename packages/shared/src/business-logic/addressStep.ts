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
import { isUsable, type StoredCoordinate } from './geocodeFreshness';
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
  if (chosen.geocode_status === 'not_found') {
    return {
      geocode: false,
      question: { ask: 'cannot-place', message: verdictMessage({ verdict: 'not_found', latitude: null, longitude: null, suggestion: null, reason: 'previously not found' }, addressLine(chosen)) ?? '' },
      reason: 'already known to be unplaceable',
    };
  }
  if (chosen.geocode_status === 'found' && isUsable(chosen, now)) {
    return { geocode: false, question: { ask: 'none' }, reason: 'found and within the 30-day window' };
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

/** May a delivery to this address be priced? The one question the charge path asks. */
export function mayPrice(a: ChoosableAddress | null | undefined, now: Date): boolean {
  if (!a) return false;
  return a.geocode_status === 'found' && isUsable(a, now);
}
