// ══════════════════════════════════════════════════════════════════════════════════════════════
// loadListChecks — WHAT IS AN INSTALL, WHAT IS A REPLACEMENT, WHAT IS JUST A NOTE, AND WHAT
//                  DISAGREES WITH ITSELF (David, 2026-09-25)
//
// PURPOSE:      the four judgements the load sheet's pages 2-4 rest on, extracted PURE so they can
//               be probed. The page renders what these return; it decides nothing itself.
//
// 🔴 THE GOVERNING RULE, IN DAVID'S WORDS: **install materials follow the SERVICE, not the tree.**
//    A tree does not know whether anyone is planting it. Three different things can say so — the
//    stop's own mark, a TRIP CHARGE on its order, or a warranty replacement — and before this
//    module only the first was read, so a TC-only install loaded no mix, no posts and no monitors.
//
// 🔴 AND WHERE THE DATA DISAGREES WITH ITSELF, THAT IS AN OUTPUT, NOT AN ERROR. David: *"these are
//    good for identification of broken/inconsistent processes."* A stop carrying a trip charge while
//    marked "Delivery only" is not a bug in the sheet — it is a bug in how the order was written,
//    and page 4 is where the crew reads it before they load rather than after they arrive.
//
// ⚠️ ERR LARGE, DELIBERATELY. A tree on an install stop with no install line of its own is counted
//    AS AN INSTALL and listed on page 4. David: better a spare T-post than a crew short.
//
// DEPENDENCIES: none — PURE. Takes the lines and the stop's own fields, returns judgements.
// OUTPUTS:      installBasis · isReplacementLine · replacementGallons · isNoteLine · stopChecks
// AC-1: no vertical noun. A stop is a stop; a line is a line.
// ══════════════════════════════════════════════════════════════════════════════════════════════

/** The fields of a line these rules read. Structurally a subset of `StopOrderItem`. */
export interface CheckLine {
  quantity: number;
  /** The line's own words, as written on the source document. NEVER normalised (D-23). */
  description?: string | null;
  sku?: string | null;
  business_inventory?: { name?: string | null; size?: string | null; sku?: string | null } | null;
}

/** Every string that might name this line, lower-cased, with blanks dropped. */
function words(l: CheckLine): string[] {
  return [l.description, l.sku, l.business_inventory?.name, l.business_inventory?.sku]
    .map(x => (x ?? '').trim().toLowerCase()).filter(x => x.length > 0);
}
/** The codes on the line — its own SKU and its lot's — upper-cased. */
function codes(l: CheckLine): string[] {
  return [l.sku, l.business_inventory?.sku].map(x => (x ?? '').trim().toUpperCase()).filter(x => x.length > 0);
}

// ── TRIP CHARGE ───────────────────────────────────────────────────────────────────────────────
/**
 * A TRIP CHARGE line. David, 2026-09-18: *"TC pairs with install."*
 *
 * ⚠️ `TC` IS MATCHED AS A WHOLE TOKEN, NEVER AS A SUBSTRING. "tc" inside "Dutch Elm" or a SKU like
 *    `BOTCH30` would otherwise make every such line a trip charge, and a false install quietly loads
 *    mix and posts for a drop-off. The long form is matched on its own words.
 */
export function isTripChargeLine(l: CheckLine): boolean {
  return words(l).some(w =>
    /(^|[^a-z])tc([^a-z]|$)/.test(w) || w.includes('trip charge') || w.includes('trip fee'));
}

// ── INSTALL / PLANTING ────────────────────────────────────────────────────────────────────────
/** A line that is itself the planting or install SERVICE. */
export function isInstallServiceLine(l: CheckLine): boolean {
  return words(l).some(w => w.includes('install') || w.includes('planting') || w.includes('plant your tree'));
}

// ── WARRANTY REPLACEMENT ──────────────────────────────────────────────────────────────────────
/**
 * A warranty replacement tree — *"code ending REP, or '(Replacement)' in the name"* (David).
 * **They are planted**, so they are installs whatever the stop is marked.
 *
 * ⚠️ `REP` MUST END THE CODE. A bare `includes('REP')` also matches `REPOT`, `PREP` and any SKU with
 *    those three letters mid-word — and calling an ordinary tree a warranty replacement puts the
 *    wrong words on a crew's sheet and on the customer's link.
 */
export function isReplacementLine(l: CheckLine): boolean {
  if (codes(l).some(c => /REP$/.test(c))) return true;
  return words(l).some(w => w.includes('(replacement)') || w.includes('replacement'));
}

/**
 * The container size of a replacement, read off the ITEM CODE when the name does not carry one.
 * David: *"BPJ30REP → 30 gal; AZBI45 → 45 gal — the digits are the size."*
 *
 * ⚠️ THE DIGITS IMMEDIATELY BEFORE `REP`, OR AT THE END OF THE CODE — not the first digits anywhere
 *    in it. A code like `15GALBPJ30REP` would otherwise read as 15 when the tree is a 30.
 * ⚠️ RETURNS null RATHER THAN GUESSING. A code with no digits has no size, and that belongs on page
 *    4 as unreadable — never as a default.
 */
export function replacementGallons(l: CheckLine): number | null {
  for (const c of codes(l)) {
    const m = /(\d{1,3})REP$/.exec(c) ?? /(\d{1,3})$/.exec(c);
    if (m) {
      const n = Number(m[1]);
      // A plausible container. 0 is not a size, and a 4-digit run is a part number, not gallons.
      if (n > 0 && n <= 200) return n;
    }
  }
  return null;
}

// ── A NOTE IS NOT A TREE ──────────────────────────────────────────────────────────────────────
/**
 * A line that is plainly a MESSAGE, not a thing to load. David, 2026-09-25: *"Bring Birthday Cake
 * for Vera!!!"* prints as a NOTE on its stop and on the crew link — **not** on page 4.
 *
 * 🔴 THE TEST IS THE ABSENCE OF EVERY HANDLE, NOT THE PRESENCE OF A KEYWORD. No item code, no lot,
 *    no size: nothing that could make it a product. A keyword list ("bring", "call") would be a
 *    guess about English and would miss the next note somebody writes.
 * ⚠️ So a line with a CODE is never a note, however chatty it reads — a code means somebody meant it
 *    as a thing.
 */
export function isNoteLine(l: CheckLine): boolean {
  const hasCode = codes(l).length > 0;
  const hasLot = !!l.business_inventory?.name;
  const hasSize = !!(l.business_inventory?.size ?? '').trim();
  const text = (l.description ?? '').trim();
  // 🔴 A SIZE IN THE LINE'S OWN WORDS DISQUALIFIES IT, AND THIS CLAUSE IS THE WHOLE RULE'S SAFETY.
  //    My first version tested only the LOT's size, so `"Live Oak - 200 Gallon"` — a description-only
  //    line with no SKU, which is how EVERY history line describes itself — came back as a note and
  //    would have been dropped off the sheet as "nothing to load". Caught by `loadList.test.ts` H9,
  //    not by my own probes: they only ever passed lot lines and coded lines, so they never reached
  //    the population the rule was most dangerous for (tech-debt #182's class).
  // ⚠️ A UNIT is required, not merely a digit: *"Call Vera at 512-456-3632"* is a note and must stay
  //    one, while *"Live Oak - 200 Gallon"* is a tree. The test is a number ATTACHED to a container
  //    or measure word, which is what a size looks like and a phone number does not.
  if (hasSizeInWords(text)) return false;
  return !hasCode && !hasLot && !hasSize && text.length > 0;
}

/** Does this text state a SIZE — a number attached to a container or measure word? */
// Not exported: only `isNoteLine` asks the question, and an exported name nobody imports is dead
// public surface that knip correctly flags (§6 r9 — the baseline shrinks, it does not grow for
// convenience). It stays a named function so the rule reads as a sentence.
function hasSizeInWords(text: string): boolean {
  const t = text.toLowerCase();
  return /#\s*\d/.test(t)                                            // "#3/5", "#15"
      || /\d\s*(?:gal|gallon|qt|quart|box|cf|cu|yard|yd|liter|litre|l\b)/.test(t)
      || /\b\d{1,3}\s*g\b/.test(t)                                  // "30 g"
      || /\d\s*(?:in|inch|"|ft|foot|feet|'|lb|pound|oz)\b/.test(t);  // calipers, bags, bales
}

// ── WHY THIS STOP COUNTS AS AN INSTALL ────────────────────────────────────────────────────────
// Not exported, for the same reason: call sites read `.basis` off the return value and never name
// the type, so exporting it adds a public name with no importer.
type InstallBasis =
  /** The stop itself says so — marked Planting / install. */
  | 'marked'
  /** A TRIP CHARGE on the order. TC pairs with install (David, 2026-09-18). */
  | 'trip_charge'
  /** A warranty replacement tree. Replacements are planted. */
  | 'replacement'
  /** An install or planting line on the order. */
  | 'install_line'
  /** Nothing says it is an install: a true delivery-only stop. */
  | null;

// Not exported: callers pass an object literal, which TypeScript checks structurally.
interface StopCheckInput {
  stopId: string;
  customerName: string;
  /** The stop's `service_type`, as stored. */
  serviceType: string | null;
  /** True when the linked order's `transport_method` is `install`. */
  markedInstall: boolean;
  lines: CheckLine[];
}

/** One line for page 4, naming the stop and what disagrees. */
export interface LoadCheck {
  stopId: string;
  customerName: string;
  /** `unreadable` → section (a); `inconsistency` → section (b). */
  kind: 'unreadable' | 'inconsistency';
  /** The line exactly as written, when the check is about one line. */
  asWritten: string | null;
  /** Why it is here, in the yard person's words. */
  why: string;
}

/**
 * Does this stop get the install kit, and on what grounds — plus everything page 4 must say.
 *
 * 🔴 THE ORDER OF THE BASES IS NOT ARBITRARY: the stop's own mark first, because that is somebody's
 *    deliberate statement; then the trip charge; then a replacement; then an install line. The
 *    reported basis is what a person should act on, and a mark beats an inference.
 */
export function stopChecks(input: StopCheckInput): { basis: InstallBasis; checks: LoadCheck[] } {
  const { stopId, customerName, serviceType, markedInstall, lines } = input;
  const checks: LoadCheck[] = [];
  const add = (kind: LoadCheck['kind'], why: string, asWritten: string | null = null) =>
    checks.push({ stopId, customerName, kind, asWritten, why });

  const tc = lines.filter(isTripChargeLine);
  const reps = lines.filter(isReplacementLine);
  const installLines = lines.filter(l => isInstallServiceLine(l) && !isTripChargeLine(l));
  const deliveryOnly = /delivery/i.test(serviceType ?? '') && !/install|plant/i.test(serviceType ?? '');

  const basis: InstallBasis =
    markedInstall ? 'marked'
    : tc.length > 0 ? 'trip_charge'
    : reps.length > 0 ? 'replacement'
    : installLines.length > 0 ? 'install_line'
    : null;

  // ── (b) INCONSISTENCIES ─────────────────────────────────────────────────────────────────────
  // Stallings, Saturday: a trip charge on the order and the stop not marked install.
  if (tc.length > 0 && !markedInstall) {
    add('inconsistency', 'a TRIP CHARGE is on the order but the stop is not marked install — a trip charge pairs with an install, so the install kit is being loaded on that basis. Mark the stop, or drop the charge.',
      tc[0].description ?? tc[0].sku ?? null);
  }
  // Gillespie, Saturday: replacements on a stop marked "Delivery only".
  if (reps.length > 0 && deliveryOnly) {
    add('inconsistency', `a WARRANTY REPLACEMENT is on a stop marked "${serviceType}" — replacements are planted, so this is being loaded as an install. The stop's service is wrong.`,
      reps[0].description ?? reps[0].sku ?? null);
  }
  // Gillespie's Desert Willow 15 and Miss Pryss Holly 30: trees on an install stop with nothing of
  // their own saying they are installed. Counted as installs; SAID OUT LOUD.
  if (basis !== null) {
    const bare = lines.filter(l =>
      !isTripChargeLine(l) && !isInstallServiceLine(l) && !isReplacementLine(l) && !isNoteLine(l)
      && (!!l.business_inventory?.name || codes(l).length > 0));
    if (bare.length > 0 && installLines.length === 0 && tc.length === 0) {
      add('inconsistency', `${bare.length} tree${bare.length === 1 ? '' : 's'} with no install or trip line of their own — install or drop-off? Counted AS INSTALLS, because a spare T-post costs less than a crew arriving short.`,
        bare.map(b => b.business_inventory?.name ?? b.description ?? b.sku ?? '?').join(', '));
    }
  }
  // A replacement whose size cannot be read anywhere — section (a), never a default.
  for (const r of reps) {
    const named = /\d/.test(r.business_inventory?.size ?? '') || /\d/.test(r.description ?? '');
    if (!named && replacementGallons(r) === null) {
      add('unreadable', 'a warranty replacement with no container size in its name and no digits in its code — the size cannot be read, so it is not staked or mixed.',
        r.description ?? r.sku ?? null);
    }
  }
  return { basis, checks };
}

export const CHECKS_COPY = {
  /** Page 4 with nothing on it still says so, in one line — silence is not an answer. */
  nothingToCheck: 'Nothing to check before you load — every line on every stop read cleanly and nothing disagrees.',
  installBasis: {
    marked: 'the stop is marked for planting',
    trip_charge: 'a trip charge on the order (a trip charge pairs with an install)',
    replacement: 'a warranty replacement, which is planted',
    install_line: 'an install line on the order',
  } as Record<string, string>,
  replacementLabel: 'replacement (warranty)',
  deliveryOnly: 'Delivery only — trees on the truck, no mix, posts, rope or monitors.',
};
