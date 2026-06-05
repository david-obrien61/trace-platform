import { executeCapability } from '../ai/execute';
import type { VerticalSchema, BusinessDiscoveryProfile, SuggestedOffering } from './types';
import type { WebsiteContent } from './adapters/website';

const SYSTEM_PROMPT = `You are a business analyst for TRACE Enterprises, a software platform for owner-operated small businesses.
You extract structured profiles from business website content.
Be specific and grounded — only include what you actually observe in the content.
If something is not mentioned, use null, false, or an empty array. Do not invent details.
Return only valid JSON. No markdown fences, no explanation.`;

export async function runEngine(
  content: WebsiteContent,
  schema: VerticalSchema,
  statedPainPoint: string | null,
  apiKey: string,
): Promise<BusinessDiscoveryProfile> {
  const userPrompt = `Analyze this ${schema.industryContext} website and extract a structured business profile.

Website URL: ${content.url}
Page title: ${content.title || '(none)'}
Meta description: ${content.description || '(none)'}

Website content:
${content.text || '(empty — could not extract text)'}

${statedPainPoint ? `The business owner stated this pain point: "${statedPainPoint}"` : ''}

When extracting services and suggesting offerings, look for these ${schema.vertical}-specific signals:
${schema.extractionHints.map(h => `- ${h}`).join('\n')}

Common pain points for this type of business include:
${schema.commonPainPoints.map(p => `- ${p}`).join('\n')}

Return a JSON object matching this exact structure:
{
  "businessName": "string or null",
  "location": "city and state if mentioned, or null",
  "yearsInBusiness": "specific number as string if mentioned, or null",
  "staffSize": "solo | small | medium | large — infer from language, or null",
  "servicesFound": ["array of services explicitly mentioned on the site"],
  "pricingVisible": true or false,
  "certifications": ["array of certifications, memberships, or awards mentioned"],
  "tone": "formal | casual | family | professional — describe the overall voice of the site",
  "contentFreshness": "current | stale | unknown — based on dates, copyright years, or event references",
  "socialPresence": ["array of social platforms linked or mentioned"],
  "strengths": ["3-5 specific positive observations grounded in what you actually read — be specific, not generic"],
  "gaps": ["2-4 things common to ${schema.vertical} businesses that are not mentioned on this site"],
  "suggestedOfferings": [
    {
      "name": "service name",
      "category": "transport | addon | maintenance | inspection | subscription",
      "description": "one clear sentence",
      "price_type": "flat | per_unit",
      "price_unit": "order | plant | vehicle | visit",
      "rationale": "one sentence explaining why this fits based on what you observed"
    }
  ]
}

For suggestedOfferings: suggest 3-6 services that this business could add or formalize based on what their site reveals. Ground each rationale in a specific observation from the content.`;

  // businessId not in scope for runEngine — override resolution falls through to default
  const parsed = await executeCapability('discovery_engine', {
    system: SYSTEM_PROMPT,
    user: userPrompt,
    apiKey,
  });

  return {
    businessName:       parsed.businessName       ?? null,
    websiteUrl:         content.url,
    vertical:           schema.vertical,
    location:           parsed.location           ?? null,
    yearsInBusiness:    parsed.yearsInBusiness    ?? null,
    staffSize:          parsed.staffSize          ?? null,
    servicesFound:      parsed.servicesFound      ?? [],
    pricingVisible:     parsed.pricingVisible     ?? false,
    certifications:     parsed.certifications     ?? [],
    tone:               parsed.tone               ?? 'professional',
    contentFreshness:   parsed.contentFreshness   ?? 'unknown',
    socialPresence:     parsed.socialPresence     ?? [],
    strengths:          parsed.strengths          ?? [],
    gaps:               parsed.gaps               ?? [],
    statedPainPoint:    statedPainPoint,
    suggestedOfferings: (parsed.suggestedOfferings ?? []) as SuggestedOffering[],
    analysisDate:       new Date().toISOString(),
    inputSource:        'website',
  };
}
