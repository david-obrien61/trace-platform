// ─────────────────────────────────────────────────────────────────────────────
// PURPOSE:      Reading a Places suggestion, and deciding whether taking it would quietly move
//               the customer to another town. Pure — no network, no React.
// DEPENDENCIES: customerAddresses (normalizeAddressPart — the ONE address comparator, §6 r8).
// OUTPUTS:      parseSuggestion() · townMismatch() · TownMismatch.
//
// ═════════════════════════════════════════════════════════════════════════════
// 🔴 WHY THIS EXISTS — MEASURED, 2026-09-24
// ═════════════════════════════════════════════════════════════════════════════
// Typing `101 Crupp` — a REAL LAWNS delivery at 101 Crupp Avenue, Liberty Hill — biased on the
// yard, Places offers:
//     101 Crupp Ct, Austin, TX · 101 Crupperneck Ridge Rd, Welch, WV · …Craigsville, WV
//     · 101 Crupper Street, Dry Ridge, KY · 101 Crupper Lane, Alexandria, KY
// The real address is NOT IN THE LIST AT ALL — Liberty Hill's streets are too new — and the first
// suggestion is a confident, real address **34 miles away in another town**. A picked suggestion
// is stored as LOCATED without a second check, so one tap sends a truck to Austin.
//
// David's 2026-09-18 rule is never to guess an address. A suggestion list that cannot offer the
// right answer, and takes a tap as agreement, is a guess wearing a tick.
//
// ⚠️ THIS COMPARES THE TOWN, NOT THE STREET, AND THAT IS DELIBERATE. The street is exactly what
// the person is half-way through typing and expects to be completed; the TOWN is the part they
// already know and did not ask to have changed. Questioning a street completion would fire on
// every ordinary use and be switched off within a day (#73).
// ─────────────────────────────────────────────────────────────────────────────
import { normalizeAddressPart } from './customerAddresses';

export interface ParsedSuggestion {
  /** The street line — everything before the first comma. */
  line1: string;
  /** The town, when the suggestion names one. */
  city: string;
  /** Two-letter state, when present. */
  state: string;
  /** A ZIP, when the text carries one. Places autocomplete usually does not. */
  zip: string;
}

/**
 * Read a Places autocomplete line: `"153 Twin Creekview Ln, Georgetown, TX, USA"`.
 *
 * 🔴 `USA` IS A COUNTRY, NOT A STATE, and dropping it is what stops the state being read as
 * "USA" and every comparison being a mismatch. Formats vary — a business result carries its name
 * first — so anything unparseable yields empty parts, and an empty part asks nothing.
 */
export function parseSuggestion(text: string): ParsedSuggestion {
  const parts = String(text ?? '').split(',').map(p => p.trim()).filter(Boolean);
  const dropCountry = parts.filter(p => !/^(usa|united states)$/i.test(p));
  const line1 = dropCountry[0] ?? '';
  // The tail may be "TX" or "TX 78642" — take the state and any ZIP out of the same piece.
  const tail = dropCountry[dropCountry.length - 1] ?? '';
  const m = /^([A-Za-z]{2})\s*(\d{5})?$/.exec(tail);
  const state = m ? m[1].toUpperCase() : '';
  const zip = m?.[2] ?? (/\b(\d{5})\b/.exec(tail)?.[1] ?? '');
  // The town is the piece before the state, when there is one.
  const city = dropCountry.length >= 3 ? dropCountry[dropCountry.length - 2]
    : (dropCountry.length === 2 && !m ? dropCountry[1] : '');
  return { line1, city, state, zip };
}

export interface TownMismatch {
  /** True when taking this suggestion would change the town or ZIP the person typed. */
  differs: boolean;
  /** What they typed, for the question. */
  typedCity: string;
  /** What the suggestion says. */
  suggestedCity: string;
  /** The sentence to put, or '' when nothing should be asked. */
  message: string;
}

const NO: TownMismatch = { differs: false, typedCity: '', suggestedCity: '', message: '' };

/**
 * Would taking this suggestion move the customer to a different town?
 *
 * 🔴 SILENT WHEN THE PERSON TYPED NO TOWN. David, 2026-09-24: *"If nothing was typed for town, no
 * question."* Someone who has not said where they mean has not been contradicted, and asking
 * would turn the ordinary case — type a street, take the completion — into an interrogation.
 */
export function townMismatch(
  typed: { city?: string | null; zip?: string | null },
  suggestionText: string,
): TownMismatch {
  const typedCity = normalizeAddressPart(typed.city ?? '');
  const typedZip = String(typed.zip ?? '').trim();
  // ⚠️ A SHORT-CIRCUIT FOR READABILITY — **NOT** THE GUARANTEE, and the difference is recorded
  // because a mutation run proved it. Deleting this line changes NO outcome: the `!!typedCity &&`
  // and `!!typedZip &&` tests below already return NO when nothing was typed, so the mutant that
  // removed it SURVIVED the whole suite.
  // 🔴 THE HAZARD IS THE OTHER DIRECTION. Anyone loosening those lower tests — dropping the
  // `!!typedCity &&`, say, to "simplify" — would believe this line still protects the no-town
  // case. It does not protect it; it merely reaches the same answer sooner. The behaviour lives
  // BELOW, and probes C1/C2 assert the behaviour rather than this line.
  if (!typedCity && !typedZip) return NO;

  const s = parseSuggestion(suggestionText);
  const sCity = normalizeAddressPart(s.city);
  const sZip = s.zip;

  // A suggestion that names no town cannot contradict one. Silence is not disagreement.
  const cityDiffers = !!typedCity && !!sCity && typedCity !== sCity;
  const zipDiffers = !!typedZip && !!sZip && typedZip !== sZip;
  if (!cityDiffers && !zipDiffers) return NO;

  const mine = typed.city?.trim() || typedZip;
  const theirs = s.city || sZip;
  return {
    differs: true,
    typedCity: mine,
    suggestedCity: theirs,
    // Named both ways round, because the person is the one who knows which is right.
    message: `You typed ${mine}; this suggestion is in ${theirs}.`,
  };
}
