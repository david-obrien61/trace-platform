/**
 * ── DISCOVERY DISCREPANCY-COMPARE (capability 1.1) ─────────────────────────────
 *
 * PURPOSE: Compare the business data an owner ENTERED during onboarding against
 *   what their LIVE website actually says, and surface honest, hedged discrepancies
 *   ("we noticed your site lists X — is that current?"). Closes the gap between
 *   stale entered data and the public-facing site without ever asserting a
 *   "correction" the system isn't sure of.
 *
 * DEPENDENCIES:
 *   - fetchWebsiteContent (adapters/website) — interrogates the LIVE site every
 *     call (no cache, no history); the returned `fetchedAt` proves freshness.
 *   - executeCapability('discovery_compare', …) — the shared AI gateway. The model
 *     only EXTRACTS what the site says + a confidence; it does NOT author the
 *     owner-facing message.
 *
 * OUTPUTS: CompareResult — { url, fetchedAt, siteReachable, error, checkedFields,
 *   discrepancies[] }. Each Discrepancy carries a hedged question MESSAGE built by
 *   this module (buildDiscrepancyMessage), so the hedge is a code guarantee, not a
 *   property of the model's free text.
 *
 * HONESTY (D-9): three independent gates before anything surfaces —
 *   (1) the site must actually show a value (no site value → no claim);
 *   (2) entered and site must genuinely differ (case/space-insensitive);
 *   (3) confidence must clear the threshold (default: drop 'low').
 *   The message is always phrased as a QUESTION; the system never declares which
 *   value is correct.
 *
 * Instrumentation: emits [TRACE:DISCOVERY] on every compare (start / unreachable /
 *   done). ON by default per the standing owner instruction.
 */

import { fetchWebsiteContent, type WebsiteContent } from './adapters/website';
import { executeCapability } from '../ai/execute';

export interface EnteredBusinessData {
  businessName?:    string | null;
  /** Street address as entered (e.g. "400 Honeycomb Mesa, Leander TX"). Distinct from
   *  `location` (a looser city/region). Added so the entered-vs-site ADDRESS conflict
   *  surfaces — the exact gap from the 2026-06-26 test (typed address, site address differed,
   *  no conflict raised). */
  address?:         string | null;
  location?:        string | null;
  phone?:           string | null;
  email?:           string | null;
  services?:        string[] | null;
  hours?:           string | null;
  yearsInBusiness?: string | null;
  /** REQUIRED — the live site to interrogate. */
  website:          string;
}

export type DiscrepancyConfidence = 'high' | 'medium' | 'low';

export interface Discrepancy {
  field:      string;                 // e.g. 'phone', 'services'
  entered:    string | null;          // what the owner entered
  site:       string | null;          // what the LIVE site shows
  confidence: DiscrepancyConfidence;
  message:    string;                 // hedged question — never an assertion
}

export interface CompareResult {
  url:           string;
  fetchedAt:     string;              // proves a LIVE fetch happened
  siteReachable: boolean;
  error:         string | null;
  checkedFields: string[];
  discrepancies: Discrepancy[];       // already D-9 filtered
}

/** Raw shape the model returns — extraction only, no owner-facing prose. */
interface RawCandidate {
  field?:      string;
  siteValue?:  string | null;
  confidence?: string;
}

const FIELD_LABELS: Record<string, string> = {
  businessName:    'your business name',
  address:         'your address',
  location:        'your location',
  phone:           'your phone number',
  email:           'your email',
  services:        'your services',
  hours:           'your hours',
  yearsInBusiness: 'years in business',
};

/** The fields we ask the model to compare, with the entered value flattened to a string. */
function enteredAsStrings(entered: EnteredBusinessData): Record<string, string | null> {
  return {
    businessName:    entered.businessName ?? null,
    address:         entered.address ?? null,
    location:        entered.location ?? null,
    phone:           entered.phone ?? null,
    email:           entered.email ?? null,
    services:        entered.services && entered.services.length ? entered.services.join(', ') : null,
    hours:           entered.hours ?? null,
    yearsInBusiness: entered.yearsInBusiness ?? null,
  };
}

/** Loose equality — ignores case, surrounding/extra whitespace, and trailing punctuation. */
export function looksSame(a: string | null, b: string | null): boolean {
  if (a == null || b == null) return false;
  const norm = (s: string) =>
    s.toLowerCase().replace(/[\s.,;:()\-]+/g, ' ').trim();
  return norm(a) === norm(b);
}

/**
 * buildDiscrepancyMessage — the hedge guarantee. Always a question; never tells the
 * owner which value is right. Phrasing softens further at lower confidence.
 */
export function buildDiscrepancyMessage(d: { field: string; entered: string | null; site: string | null; confidence: DiscrepancyConfidence }): string {
  const label = FIELD_LABELS[d.field] ?? d.field;
  const site    = d.site ?? '(nothing)';
  const entered = d.entered ?? '(nothing entered)';
  if (d.confidence === 'high') {
    return `Your site shows "${site}" for ${label}, but you entered "${entered}". Should we update it, or is the site out of date?`;
  }
  // medium (and any softer) — extra hedge
  return `We noticed your site may list "${site}" for ${label} — you entered "${entered}". Is that still current?`;
}

const RANK: Record<DiscrepancyConfidence, number> = { low: 0, medium: 1, high: 2 };

/**
 * filterDiscrepancies — the D-9 honesty gate, pure and testable.
 * Drops: no-site-value, look-same (not a real diff), below-threshold confidence.
 * Rebuilds every surviving message via buildDiscrepancyMessage (hedge guarantee).
 */
export function filterDiscrepancies(
  candidates: RawCandidate[],
  entered: Record<string, string | null>,
  minConfidence: DiscrepancyConfidence = 'medium',
): Discrepancy[] {
  const out: Discrepancy[] = [];
  for (const c of candidates ?? []) {
    const field = (c.field ?? '').trim();
    if (!field) continue;
    const site = (c.siteValue ?? '').toString().trim() || null;
    if (!site) continue;                                   // gate 1: site must show something
    const enteredVal = entered[field] ?? null;
    if (looksSame(enteredVal, site)) continue;             // gate 2: must genuinely differ
    const conf: DiscrepancyConfidence =
      c.confidence === 'high' ? 'high' : c.confidence === 'low' ? 'low' : 'medium';
    if (RANK[conf] < RANK[minConfidence]) continue;        // gate 3: confidence threshold
    out.push({
      field,
      entered: enteredVal,
      site,
      confidence: conf,
      message: buildDiscrepancyMessage({ field, entered: enteredVal, site, confidence: conf }),
    });
  }
  return out;
}

const COMPARE_SYSTEM = `You compare a small business's ENTERED onboarding data against the text of their OWN live website. You are an extractor, not an editor. For each field, report ONLY the value the website actually states. Be conservative: if the site does not clearly state a field, omit that field entirely — never guess, never infer, never invent a value to create a discrepancy. Do not decide which value is "correct" — only report what the site says and how confident you are that the site states it.`;

export function buildComparePrompt(entered: EnteredBusinessData, content: WebsiteContent): string {
  const e = enteredAsStrings(entered);
  return `The business owner ENTERED this data during onboarding:
${Object.entries(e).map(([k, v]) => `- ${k}: ${v ?? '(not provided)'}`).join('\n')}

Here is the current text of their LIVE website (fetched ${content.fetchedAt}):
URL: ${content.url}
Title: ${content.title || '(none)'}
Meta description: ${content.description || '(none)'}

Content:
${content.text || '(empty — could not extract text)'}

For each field where the website CLEARLY STATES a value, return what the site says.
Omit any field the site does not clearly address. Return a JSON array:
[
  { "field": "phone | businessName | address | location | email | services | hours | yearsInBusiness",
    "siteValue": "the value as the site states it",
    "confidence": "high | medium | low — how sure you are the SITE states this value" }
]
Return [] if the site states nothing matchable. Never fabricate a siteValue.`;
}

export interface CompareOpts {
  apiKey: string;
  minConfidence?: DiscrepancyConfidence;
  /** Injectable for tests — defaults to the live fetch + real AI gateway. */
  _fetchContent?: (url: string) => Promise<WebsiteContent>;
  _execute?: (capabilityKey: string, opts: any) => Promise<any>;
}

/**
 * compareEnteredVsSite — orchestrates a LIVE-site discrepancy compare.
 * Always re-fetches the site (never cached/history). Returns hedged, D-9-gated
 * discrepancies, or an honest empty result when the site can't be read.
 */
export async function compareEnteredVsSite(
  entered: EnteredBusinessData,
  opts: CompareOpts,
): Promise<CompareResult> {
  const fetchContent = opts._fetchContent ?? fetchWebsiteContent;
  const execute      = opts._execute ?? executeCapability;
  const minConfidence = opts.minConfidence ?? 'medium';
  const checkedFields = Object.keys(enteredAsStrings(entered)).filter(k => enteredAsStrings(entered)[k] != null);

  console.log(JSON.stringify({
    tag: '[TRACE:DISCOVERY]', phase: 'compare:start',
    url: entered.website, checkedFields, ts: new Date().toISOString(),
  }));

  const content = await fetchContent(entered.website);

  // Honest failure — can't read the site, so we make NO claims.
  if (content.error && !content.text) {
    console.log(JSON.stringify({
      tag: '[TRACE:DISCOVERY]', phase: 'compare:unreachable',
      url: content.url, error: content.error,
    }));
    return {
      url: content.url, fetchedAt: content.fetchedAt,
      siteReachable: false, error: content.error,
      checkedFields, discrepancies: [],
    };
  }

  let candidates: RawCandidate[] = [];
  try {
    const parsed = await execute('discovery_compare', {
      system: COMPARE_SYSTEM,
      user:   buildComparePrompt(entered, content),
      apiKey: opts.apiKey,
    });
    candidates = Array.isArray(parsed) ? parsed : (parsed?.discrepancies ?? []);
  } catch (err: any) {
    console.log(JSON.stringify({
      tag: '[TRACE:DISCOVERY]', phase: 'compare:error', error: err?.message ?? String(err),
    }));
    return {
      url: content.url, fetchedAt: content.fetchedAt,
      siteReachable: true, error: `compare failed: ${err?.message ?? err}`,
      checkedFields, discrepancies: [],
    };
  }

  const discrepancies = filterDiscrepancies(candidates, enteredAsStrings(entered), minConfidence);

  console.log(JSON.stringify({
    tag: '[TRACE:DISCOVERY]', phase: 'compare:done',
    url: content.url, fetchedAt: content.fetchedAt,
    rawCandidates: candidates.length, surfaced: discrepancies.length,
    fields: discrepancies.map(d => d.field),
  }));

  return {
    url: content.url, fetchedAt: content.fetchedAt,
    siteReachable: true, error: content.error ?? null,
    checkedFields, discrepancies,
  };
}
