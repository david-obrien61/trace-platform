export interface VerticalSchema {
  vertical: string;
  industryContext: string;
  extractionHints: string[];
  commonPainPoints: string[];
  typicalOfferings: Array<{
    name: string;
    category: 'transport' | 'addon' | 'maintenance' | 'inspection' | 'subscription';
    price_type: 'flat' | 'per_unit';
    price_unit: 'order' | 'plant' | 'vehicle' | 'visit';
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
