// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Decide what a Google Geocoding response MEANS — found, needs confirming, or
//               cannot be placed — and therefore whether checkout may price a delivery to it.
// DEPENDENCIES: none — pure. No network, no key, no database. The transport is somebody else's.
// OUTPUTS:      GeocodeVerdict · classifyGeocodeResponse() · verdictMessage().
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 `status: "OK"` DOES NOT MEAN THE ADDRESS EXISTS. MEASURED, NOT ASSUMED.
// ═════════════════════════════════════════════════════════════════════════════
// Probed live against the real API, 2026-09-23, with LAWNS's own addresses:
//
//   INPUT                                   status          location_type      partial_match
//   ─────────────────────────────────────── ─────────────── ────────────────── ─────────────
//   400 Honeycomb Mesa, Leander TX          OK              ROOFTOP            false
//   400 Hunnycom Mesa  (typo'd street)      OK              ROOFTOP            TRUE
//   Honey Comb Mesa    (no house number)    OK              GEOMETRIC_CENTER   false
//   99999 Nonexistent Fake Road, Leander    OK              APPROXIMATE        TRUE
//   qqqqzzzz xxxx yyyy                      ZERO_RESULTS    —                  —
//   "" (empty)                              INVALID_REQUEST —                  —
//
// 🔴 ROW FOUR IS THE WHOLE REASON THIS FILE EXISTS. A street that does not exist returned
// **`OK`** — Google fell back to the CENTRE OF THE TOWN and answered successfully. A reader who
// treats `status === 'OK'` as "found" marks a nonexistent address VERIFIED, stores a coordinate
// in the middle of Leander, and PRICES A DELIVERY TO IT. Nothing errors. Nobody finds out until
// a truck is somewhere wrong.
//
// So the verdict is decided by `location_type`, never by `status`. Google's own documentation
// does not say this plainly, which is why the table above is measurement rather than citation —
// and why it is written here instead of left for the next person to rediscover.
//
// ⚠️ `partial_match` IS A HINT, NOT A DIFF. Measured: it was FALSE for "Honeycomb" → "Honey Comb"
// and TRUE for "Hunnycom" → "Honey Comb" — the same correction, reported differently. Anything
// that needs to know whether Google changed the text must COMPARE the text, not trust this flag.
//
// ── DAVID'S RULINGS (2026-09-23) THIS ENCODES ───────────────────────────────────────────────
// · ROOFTOP → found: store the coordinate, price the delivery.
// · RANGE_INTERPOLATED → CONFIRM. It is an estimate between two known house numbers, and on
//   LAWNS's rural roads (8301 FM 487, 2201 High Lonesome) that can be far from the gate. *"A tap
//   is cheap; a wrong pin sends a truck to the wrong place."* Two hand-typed street errors killed
//   a Saturday route on 2026-09-09.
// · any partial_match → CONFIRM: show what was typed and what Google says, the person chooses.
// · GEOMETRIC_CENTER / APPROXIMATE / ZERO_RESULTS / INVALID_REQUEST → cannot place it: say so,
//   save it anyway, mark it unverified, and NEVER price it.
//
// 🔴 AND WHAT THIS CHECK HONESTLY CANNOT DO, so no surface may imply otherwise: it finds
// addresses that CANNOT BE PLACED. It cannot catch a real-but-wrong address — 415 typed for 451
// returns a confident ROOFTOP pin on the neighbour's house. An address is verified as FINDABLE,
// never as CORRECT.
// ─────────────────────────────────────────────────────────────────────────────

/** What may be done with the address, which is the only question a caller actually has. */
export type GeocodeVerdict =
  /** A building. Store the coordinate; the delivery may be priced. */
  | 'found'
  /** Placed, but the person must agree to it first — an estimate, or Google changed the text. */
  | 'confirm'
  /** Cannot be placed. Save the address, mark it unverified, do not price it. */
  | 'not_found';

export interface GeocodeOutcome {
  verdict: GeocodeVerdict;
  latitude: number | null;
  longitude: number | null;
  /** What Google would call this address. SHOWN so a person can choose it; never stored unless
   *  they do (David 2026-09-23: "Google suggests, the person confirms"). */
  suggestion: string | null;
  /** Why, in the vocabulary of the API, for the trail and for a person reading a failure list. */
  reason: string;
}

/** Precision values that mean "a specific building". Only these may price without a tap. */
const PRECISE = new Set(['ROOFTOP']);
/** Placed, but an estimate or a correction — a person decides. */
const NEEDS_CONFIRMING = new Set(['RANGE_INTERPOLATED']);

interface RawResponse {
  status?: unknown;
  results?: unknown;
  error_message?: unknown;
}

function firstResult(r: RawResponse): Record<string, unknown> | null {
  const rs = r.results;
  if (!Array.isArray(rs) || rs.length === 0) return null;
  const first = rs[0] as Record<string, unknown>;
  return first && typeof first === 'object' ? first : null;
}

function coordOf(result: Record<string, unknown>): { lat: number; lng: number } | null {
  const geom = result.geometry as Record<string, unknown> | undefined;
  const loc = geom?.location as Record<string, unknown> | undefined;
  const lat = loc?.lat, lng = loc?.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

/**
 * Read a Geocoding response and say what may be done with it.
 *
 * Takes the parsed JSON exactly as the API returns it. A response shape we do not recognise is
 * `not_found`, never `found`: an unreadable answer is not permission to price something.
 */
export function classifyGeocodeResponse(raw: unknown): GeocodeOutcome {
  const nothing = (reason: string): GeocodeOutcome =>
    ({ verdict: 'not_found', latitude: null, longitude: null, suggestion: null, reason });

  if (!raw || typeof raw !== 'object') return nothing('no response');
  const r = raw as RawResponse;
  const status = typeof r.status === 'string' ? r.status : '';

  // Anything other than OK is a failure to place it, whatever the cause. The reason is carried
  // through so the failure list can tell a quota problem from a nonsense address.
  if (status !== 'OK') {
    const extra = typeof r.error_message === 'string' && r.error_message ? ` — ${r.error_message}` : '';
    return nothing(status ? `${status}${extra}` : 'no status');
  }

  const result = firstResult(r);
  if (!result) return nothing('OK with no results');

  const geom = result.geometry as Record<string, unknown> | undefined;
  const locationType = typeof geom?.location_type === 'string' ? geom.location_type : '';
  const partial = result.partial_match === true;
  const suggestion = typeof result.formatted_address === 'string' ? result.formatted_address : null;
  const coord = coordOf(result);

  // 🔴 THE DECISION IS `location_type`, NOT `status`. See the table in the header.
  if (!PRECISE.has(locationType) && !NEEDS_CONFIRMING.has(locationType)) {
    return {
      verdict: 'not_found', latitude: null, longitude: null, suggestion,
      // APPROXIMATE is the town centroid; GEOMETRIC_CENTER is the middle of a street. Both are
      // real places and neither is the address that was typed.
      reason: locationType ? `${locationType} — not a specific address` : 'no location_type',
    };
  }
  if (!coord) return nothing(`${locationType} with no usable coordinate`);

  if (NEEDS_CONFIRMING.has(locationType)) {
    return { verdict: 'confirm', latitude: coord.lat, longitude: coord.lng, suggestion,
             reason: 'RANGE_INTERPOLATED — estimated between house numbers' };
  }
  if (partial) {
    return { verdict: 'confirm', latitude: coord.lat, longitude: coord.lng, suggestion,
             reason: 'partial match — Google changed what was typed' };
  }
  return { verdict: 'found', latitude: coord.lat, longitude: coord.lng, suggestion, reason: 'ROOFTOP' };
}

/**
 * What the screen says. Kept beside the rule so the words and the verdict cannot drift.
 *
 * 🔴 THE `found` SENTENCE SAYS "FOUND", NOT "VERIFIED" OR "CORRECT". The check proves an address
 * can be placed on a map; it cannot prove it is the right one. 415 typed for 451 is a confident
 * ROOFTOP pin on the neighbour's house, and no wording here may imply otherwise.
 */
export function verdictMessage(o: GeocodeOutcome, typed: string): string | null {
  switch (o.verdict) {
    case 'found':
      return null;                       // nothing to say: the ordinary case is silent
    case 'confirm':
      return o.suggestion && o.suggestion !== typed
        ? `You typed "${typed}". Google says "${o.suggestion}". Which is right?`
        : 'We found this roughly — please check the pin before we charge for delivery.';
    case 'not_found':
    default:
      return "We can't find this address — is it correct? We'll save it, but we can't work out a delivery charge until it can be found.";
  }
}
