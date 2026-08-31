// ============================================================
// positionDescription — ASSEMBLE THE DOCUMENT AN OWNER HANDS TO A PERSON
//
// PURPOSE:      Turn (business context + a position + its ticked responsibilities) into the
//               printed description. PURE — no React, no fetch, no dates read from the clock
//               except the one passed in — so the thing the acceptance bar is actually about
//               (does it READ like something Lauren would hand Joel on Monday?) is testable.
// DEPENDENCIES: responsibilityCatalogue.ts. Nothing else, deliberately.
// OUTPUTS:      `buildPositionDocument()` → `PositionDocument`, and `describeOperatingDays()`.
//
// 🔴 THE BAR IS NOT "IT RENDERS", IT IS "WOULD SHE HAND THIS OVER?" — so three rules shape
//    every line below, and each is here because the obvious implementation breaks it.
//
//  1. **NO BLANK EVER PRINTS.** A missing context field omits its whole sentence; it never
//     renders "We are known for ." and never renders a labelled empty row. That is A9/D-9 —
//     absent is not empty — and it is also the single thing that makes a generated document
//     read as filler. `contextComplete` is returned so the SURFACE can say what is missing
//     BEFORE printing; the document itself never apologises in the middle of a paragraph.
//
//  2. **NO SOFTWARE VOCABULARY REACHES THE PAGE.** No permission string, no capability mark, no
//     "not built yet". The story is explicit: *the description says what the JOB is, not what
//     the app covers.* A responsibility the platform cannot represent prints exactly like one
//     it can, because to the person doing the job they are the same work. The marks exist for
//     the OWNER at ticking time (`responsibilityMarks.ts`) and stop there.
//
//  3. **THE SPECIFIC BEATS THE COMPLETE.** What stops this reading as a template is not more
//     sections — it is the two things only this business can supply: the operating rhythm
//     (read from `business_operating_days`, never asked for) and the owner's own sentence about
//     what doing the job well looks like here. Those get the top and the bottom of the page.
// ============================================================
import {
  FREQUENCY_ORDER, FREQUENCY_LABEL, responsibilityById,
  type ResponsibilityFrequency,
} from './responsibilityCatalogue';

/** A tenant's pick: a catalogue id, plus a frequency override where the owner changed it. */
export interface PositionPick {
  readonly responsibilityId: string;
  /** `null` = the catalogue default stands. Stored NULL rather than a copy — see the migration. */
  readonly frequency: ResponsibilityFrequency | null;
}

/** What the business told us once, on the context form. Every field optional and honest. */
export interface BusinessContext {
  readonly whatWeDo: string | null;
  readonly whoWeServe: string | null;
  readonly knownFor: string | null;
}

/** One weekday pattern row, already resolved to its label by the caller. 0 = Sunday (JS getDay). */
export interface OperatingDay {
  readonly weekday: number;
  readonly dayTypeLabel: string;
}

export interface PositionDocumentItem {
  readonly text: string;
  /** "throughout the day", "weekly", "as needed" — reads inline after an em-dash. */
  readonly cadence: string;
}

export interface PositionDocumentArea {
  readonly area: string;
  readonly items: readonly PositionDocumentItem[];
}

export interface PositionDocument {
  readonly title: string;
  readonly businessName: string;
  /** Whole sentences, already joined. Empty when the business supplied no context at all. */
  readonly intro: readonly string[];
  /** The operating rhythm, read from the platform's own data. `null` when none is recorded. */
  readonly operatingLine: string | null;
  readonly areas: readonly PositionDocumentArea[];
  /** The owner's own words. Quoted verbatim on the page; never rewritten. */
  readonly excellence: string | null;
  readonly responsibilityCount: number;
  readonly generatedOn: string;
  /**
   * FALSE when a context field or the excellence line is missing. The document still builds —
   * refusing to print would be the wrong trade — but the surface warns first (surface, don't
   * decide). `missing` names them in the owner's words, never as column names.
   */
  readonly contextComplete: boolean;
  readonly missing: readonly string[];
}

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "Weekly" → "weekly"; "Every two weeks" → "every two weeks". Proper nouns never appear here. */
function cadencePhrase(f: ResponsibilityFrequency): string {
  const label = FREQUENCY_LABEL[f];
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** "Monday and Tuesday" · "Thursday, Friday and Saturday" — an Oxford-free list a person reads. */
function joinWords(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/**
 * 🔴 THE LINE THE PLATFORM ALREADY KNOWS AND MUST NOT ASK FOR. `business_operating_days` has held
 * this since 20260828 (applied and catalog-verified 2026-08-30), so the context form has NO
 * "days closed" field — asking would be asking an owner to retype what they already told us,
 * which is the one thing this feature exists to stop doing to them.
 *
 * ⚠️ `weekday` is 0 = SUNDAY (JavaScript `Date.getDay()`), NOT ISO-8601. The column's own COMMENT
 * warns that reading it as ISO shifts the week by one and every screen still looks plausible.
 * `WEEKDAY_NAMES[0]` above is literally 'Sunday' for that reason.
 *
 * Days are grouped BY TYPE rather than listed one per line, because seven lines of "Monday:
 * service" is a table and a person reads a sentence.
 */
export function describeOperatingDays(days: readonly OperatingDay[]): string | null {
  const pattern = days.filter((d) => d.weekday >= 0 && d.weekday <= 6);
  if (pattern.length === 0) return null;

  const byType = new Map<string, number[]>();
  for (const d of pattern) {
    const list = byType.get(d.dayTypeLabel) ?? [];
    if (!list.includes(d.weekday)) list.push(d.weekday);
    byType.set(d.dayTypeLabel, list);
  }
  // Order by the earliest weekday in each group so the sentence walks the week.
  const groups = [...byType.entries()]
    .map(([label, wd]) => ({ label, wd: [...wd].sort((a, b) => a - b) }))
    .sort((a, b) => a.wd[0] - b.wd[0]);

  const clauses = groups.map((g) => `${joinWords(g.wd.map((w) => WEEKDAY_NAMES[w]))} — ${g.label.toLowerCase()}`);
  return `How the week runs here: ${clauses.join('; ')}.`;
}

/**
 * Build the intro. Each field contributes ONE sentence or NONE — the shapes are fixed so an owner
 * writing a fragment ("shade trees, grown on site") still reads as English, and an owner writing a
 * full sentence is not double-punctuated.
 */
function introSentences(businessName: string, ctx: BusinessContext): string[] {
  const out: string[] = [];
  const clean = (s: string | null) => {
    const t = (s ?? '').trim();
    return t ? t.replace(/[.\s]+$/, '') : null;
  };
  const doing = clean(ctx.whatWeDo);
  const serve = clean(ctx.whoWeServe);
  const known = clean(ctx.knownFor);

  if (doing) out.push(`${businessName} ${/^(we|our)\b/i.test(doing) ? doing.replace(/^we\s+/i, '') : doing}.`);
  if (serve) out.push(`We sell to ${serve}.`);
  if (known) out.push(`What we are known for: ${known}.`);
  return out;
}

export function buildPositionDocument(input: {
  title: string;
  businessName: string;
  context: BusinessContext;
  operatingDays: readonly OperatingDay[];
  picks: readonly PositionPick[];
  excellence: string | null;
  today: Date;
}): PositionDocument {
  const { title, businessName, context, operatingDays, picks, excellence, today } = input;

  // Resolve picks against the catalogue. A pick whose row no longer exists is DROPPED rather than
  // rendered as a blank line — a stored id can outlive a catalogue row, and a document with an
  // empty bullet on it is worse than one with a shorter list.
  const resolved = picks
    .map((p) => {
      const row = responsibilityById(p.responsibilityId);
      return row ? { row, frequency: p.frequency ?? row.defaultFrequency } : null;
    })
    .filter((x): x is { row: NonNullable<ReturnType<typeof responsibilityById>>; frequency: ResponsibilityFrequency } => x !== null);

  // Grouped by area in CATALOGUE order, then by frequency (most-often first) within the area —
  // so the page opens on what the person does every day and ends on what they do once a year.
  const areaOrder = [...new Set(resolved.map((x) => x.row.area))];
  const areas: PositionDocumentArea[] = areaOrder.map((area) => ({
    area,
    items: resolved
      .filter((x) => x.row.area === area)
      .sort((a, b) => FREQUENCY_ORDER.indexOf(a.frequency) - FREQUENCY_ORDER.indexOf(b.frequency))
      .map((x) => ({ text: x.row.text, cadence: cadencePhrase(x.frequency) })),
  }));

  const missing: string[] = [];
  if (!context.whatWeDo?.trim())   missing.push('what the business does');
  if (!context.whoWeServe?.trim()) missing.push('who it sells to');
  if (!context.knownFor?.trim())   missing.push('what it is known for');
  if (!excellence?.trim())         missing.push('what doing this job well looks like here');

  return {
    title: title.trim(),
    businessName,
    intro: introSentences(businessName, context),
    operatingLine: describeOperatingDays(operatingDays),
    areas,
    excellence: excellence?.trim() ? excellence.trim() : null,
    responsibilityCount: resolved.length,
    generatedOn: today.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    contextComplete: missing.length === 0,
    missing,
  };
}
