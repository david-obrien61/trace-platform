export interface VerticalSchema {
  vertical: string;
  industryContext: string;
  extractionHints: string[];
  commonPainPoints: string[];
  typicalOfferings: Array<{
    name: string;
    category: 'transport' | 'addon' | 'maintenance' | 'inspection' | 'subscription';
    price_type: 'flat' | 'per_unit';
    /**
     * ✏️ WIDENED to `string` 2026-09-14 (ledger #328). It was a closed union of the same four
     * values as the old CHECK constraint — so a `verticals/foodbank.ts` writing
     * `price_unit: 'household'` was a COMPILE ERROR, before it was ever a database one.
     * Validated at the seam by `classifyPriceUnit` (./seed), never by this type.
     * Consistent with `SuggestedOffering.price_unit` below, which was already `string`.
     */
    price_unit: string;
  }>;
}

export interface BusinessDiscoveryProfile {
  businessName:        string | null;
  websiteUrl:          string | null;
  vertical:            string;
  location:            string | null;
  yearsInBusiness:     string | null;
  staffSize:           'solo' | 'small' | 'medium' | 'large' | null;
  servicesFound:       string[];
  pricingVisible:      boolean;
  certifications:      string[];
  tone:                'formal' | 'casual' | 'family' | 'professional';
  contentFreshness:    'current' | 'stale' | 'unknown';
  socialPresence:      string[];
  strengths:           string[];
  gaps:                string[];
  statedPainPoint:     string | null;
  suggestedOfferings:  SuggestedOffering[];
  analysisDate:        string;
  inputSource:         'website' | 'conversation' | 'combined';
}

export interface SuggestedOffering {
  name:        string;
  category:    string;
  description: string;
  price_type:  'flat' | 'per_unit';
  price_unit:  string;
  rationale:   string;
}

export interface SilentPartnerAnalysis {
  subject:    string;
  body:       string;
  html:       string;
}

export interface DiscoveryResult {
  profile:  BusinessDiscoveryProfile;
  analysis: SilentPartnerAnalysis;
}

/** Minimal fast-extraction result from Pass 1 (Haiku). Feeds the recognition
 *  moment and pain-demo during onboarding — available before the deep analysis
 *  completes. */
export interface BusinessIdentity {
  businessName:     string | null;
  location:         string | null;
  yearsInBusiness:  string | null;
  staffSize:        'solo' | 'small' | 'medium' | 'large' | null;
  servicesFound:    string[];
  tone:             'formal' | 'casual' | 'family' | 'professional';
  contentFreshness: 'current' | 'stale' | 'unknown';
}
