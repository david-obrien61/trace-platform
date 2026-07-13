/**
 * taxExemption.ts — vertical-agnostic tax-exemption vocabulary + the ONE presentation helper for
 * the three honest tax states (D-40 · 2026-07-13).
 *
 * REASON CODES are plain string VALUES (AC-1) — never vertical nouns, enum members, or TS
 * identifiers of a vertical. Generic across every business_type: a diesel shop has resale-exempt
 * fleet buyers; a nonprofit buys from any vertical; ag exemption spans nursery + equipment. 'other'
 * REQUIRES a free-text reason (the stored `reason` then IS that text, not the literal 'other').
 *
 * describeTaxLine is the SINGLE place the three-state wording lives, so Review, Confirmation, the
 * email, and the QBO line all say the same thing about WHY the tax number is what it is:
 *   • not_identified → a REDLINE ("set your tax rate") — never $0.00-as-no-tax, never blank.
 *   • taxed         → "Tax (X%)".
 *   • exempt        → "Tax exempt — <reason>[· cert <ref>]".
 *
 * DEPENDENCIES: TaxStatus from ./tierPricing (the money boundary).
 * OUTPUTS: TAX_EXEMPTION_REASONS, taxExemptionLabel, describeTaxLine, TX_COMPTROLLER_RATE_LOCATOR_URL.
 */
import type { TaxStatus } from './tierPricing';

export interface TaxExemptionReason {
  /** stored VALUE (AC-1 string, not an enum) */
  code: string;
  label: string;
}

/** The generic, vertical-agnostic exemption reason set. 'other' → the UI collects free text and
 *  stores THAT as the reason (so a stored reason is either a code below or the free text). */
export const TAX_EXEMPTION_REASONS: TaxExemptionReason[] = [
  { code: 'resale',       label: 'Resale / reseller certificate' },
  { code: 'nonprofit',    label: 'Nonprofit (501(c)(3))' },
  { code: 'government',   label: 'Government / public entity' },
  { code: 'agricultural', label: 'Agricultural exemption' },
  { code: 'other',        label: 'Other' },
];

/** Human label for a stored reason: a known code → its label; anything else (the 'other' free
 *  text) → the text as-is. Empty/nullish → 'Tax exempt'. */
export function taxExemptionLabel(reason: string | null | undefined): string {
  const r = (reason ?? '').trim();
  if (!r) return 'Tax exempt';
  const known = TAX_EXEMPTION_REASONS.find(x => x.code === r && x.code !== 'other');
  return known ? known.label : r;
}

export interface TaxLineView {
  state: TaxStatus;
  /** the left-hand label, e.g. "Tax (8.25%)" / "Tax: not identified — set your tax rate in Settings" */
  label: string;
  /** the right-hand amount string, e.g. "$48.33" / "$0.00"; null when there is no amount to show (redline) */
  amount: string | null;
  /** true only for not_identified — the surface renders this LOUD (amber/redline), never a silent $0 */
  redline: boolean;
}

/**
 * The SINGLE three-state tax-line presenter. Fed the authoritative computeOrderPricing output (or an
 * order row carrying the same fields). `taxRate` (Level-1 origin rate) is preferred for the taxed %;
 * when absent it derives the % from tax/taxableSubtotal (so a persisted order with no rate on hand
 * still labels correctly). Never fabricates a rate — an unset rate is the redline.
 */
export function describeTaxLine(args: {
  taxStatus: TaxStatus;
  tax: number;
  taxableSubtotal?: number | null;
  taxRate?: number | null;
  reason?: string | null;
  certRef?: string | null;
}): TaxLineView {
  const { taxStatus, tax } = args;
  if (taxStatus === 'not_identified') {
    return { state: 'not_identified', label: 'Tax: not identified — set your tax rate in Settings', amount: null, redline: true };
  }
  if (taxStatus === 'exempt') {
    const cert = (args.certRef ?? '').trim();
    return {
      state: 'exempt',
      label: `Tax exempt — ${taxExemptionLabel(args.reason)}${cert ? ` · cert ${cert}` : ''}`,
      amount: `$${tax.toFixed(2)}`,   // always $0.00 for exempt
      redline: false,
    };
  }
  // taxed — show the %: prefer the supplied origin rate, else derive from the amounts.
  const pctNum =
    (typeof args.taxRate === 'number' && args.taxRate >= 0) ? args.taxRate * 100
      : (args.taxableSubtotal && args.taxableSubtotal > 0) ? (tax / args.taxableSubtotal) * 100
      : 0;
  const pct = pctNum.toFixed(2).replace(/\.00$/, '');
  return { state: 'taxed', label: `Tax (${pct}%)`, amount: `$${tax.toFixed(2)}`, redline: false };
}

/**
 * The Texas Comptroller Sales Tax Rate Locator — the owner finds THEIR correct origin rate (their
 * business address) here; the platform never computes it. LEVEL-1 TX helper: this locator link is
 * TX-specific by design (the current target is in-state TX sellers). A future multi-state build
 * makes the locator link jurisdiction-aware; the RATE itself is already generic per-tenant data.
 */
export const TX_COMPTROLLER_RATE_LOCATOR_URL = 'https://gis.cpa.texas.gov/search/';
