import { executeCapability } from '../ai/execute';
import type { VerticalSchema, BusinessDiscoveryProfile, BusinessIdentity, SuggestedOffering } from './types';
import type { WebsiteContent } from './adapters/website';

// ── System prompts ────────────────────────────────────────────────────────────

const IDENTITY_SYSTEM_PROMPT = `You extract minimal business identity facts from website content.
Extract only what is directly stated or clearly inferable. Do not analyze, do not suggest.
Return only valid JSON. No markdown fences, no explanation.`;

const ANALYSIS_SYSTEM_PROMPT = `You are a business analyst for TRACE Enterprises, a software platform for owner-operated small businesses.
You extract structured profiles from business website content.
Be specific and grounded — only include what you actually observe in the content.
If something is not mentioned, use null, false, or an empty array. Do not invent details.
Return only valid JSON. No markdown fences, no explanation.`;

// ── Pass 1 — fast Haiku identity extraction ───────────────────────────────────

/**
 * runIdentity — fast Pass 1 (Haiku). Extracts the minimal business identity
 * facts needed for the signup recognition moment and pain-demo. Results are
 * available quickly and fed into runAnalysis as context.
 */
export async function runIdentity(
  content: WebsiteContent,
  schema: VerticalSchema,
  apiKey: string,
): Promise<BusinessIdentity> {
  const userPrompt = `Extract the business identity from this ${schema.industryContext} website.

Website URL: ${content.url}
Page title: ${content.title || '(none)'}

Website content:
${(content.text || '').slice(0, 2000) || '(empty — could not extract text)'}

Return JSON:
{
  "businessName": "string or null",
  "location": "city and state if mentioned, or null",
  "yearsInBusiness": "number as string if mentioned, or null",
  "staffSize": "solo | small | medium | large — infer from language, or null",
  "servicesFound": ["up to 3 primary services explicitly mentioned"],
  "tone": "formal | casual | family | professional",
  "contentFreshness": "current | stale | unknown — based on dates, copyright years, or event references"
}`;

  const parsed = await executeCapability('discovery_identity', {
    system: IDENTITY_SYSTEM_PROMPT,
    user:   userPrompt,
    apiKey,
  });

  return {
    businessName:     parsed.businessName     ?? null,
    location:         parsed.location         ?? null,
    yearsInBusiness:  parsed.yearsInBusiness  ?? null,
    staffSize:        parsed.staffSize        ?? null,
    servicesFound:    parsed.servicesFound    ?? [],
    tone:             parsed.tone             ?? 'professional',
    contentFreshness: parsed.contentFreshness ?? 'unknown',
  };
}

// ── Pass 2 — deep Sonnet analysis ─────────────────────────────────────────────

/**
 * runAnalysis — deep Pass 2 (Sonnet). Takes the Pass-1 identity as context so
 * it doesn't re-extract basics. Returns the full BusinessDiscoveryProfile with
 * strengths, gaps, suggestedOfferings, and the complete field set.
 */
export async function runAnalysis(
  content: WebsiteContent,
  schema: VerticalSchema,
  statedPainPoint: string | null,
  identity: BusinessIdentity,
  apiKey: string,
): Promise<BusinessDiscoveryProfile> {
  const userPrompt = `We already identified this business in a fast extraction pass:
- Name: ${identity.businessName ?? '(unknown)'}
- Location: ${identity.location ?? '(unknown)'}
- Services (initial): ${identity.servicesFound.join(', ') || '(unknown)'}
- Years in business: ${identity.yearsInBusiness ?? '(unknown)'}
- Site tone: ${identity.tone}
- Content freshness: ${identity.contentFreshness}

Now do the deep analysis of this ${schema.industryContext} website.

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

  const parsed = await executeCapability('discovery_analysis', {
    system: ANALYSIS_SYSTEM_PROMPT,
    user:   userPrompt,
    apiKey,
  });

  return {
    businessName:       parsed.businessName       ?? identity.businessName,
    websiteUrl:         content.url,
    vertical:           schema.vertical,
    location:           parsed.location           ?? identity.location,
    yearsInBusiness:    parsed.yearsInBusiness    ?? identity.yearsInBusiness,
    staffSize:          parsed.staffSize          ?? identity.staffSize,
    servicesFound:      parsed.servicesFound      ?? identity.servicesFound,
    pricingVisible:     parsed.pricingVisible     ?? false,
    certifications:     parsed.certifications     ?? [],
    tone:               parsed.tone               ?? identity.tone,
    contentFreshness:   parsed.contentFreshness   ?? identity.contentFreshness,
    socialPresence:     parsed.socialPresence     ?? [],
    strengths:          parsed.strengths          ?? [],
    gaps:               parsed.gaps               ?? [],
    statedPainPoint:    statedPainPoint,
    suggestedOfferings: (parsed.suggestedOfferings ?? []) as SuggestedOffering[],
    analysisDate:       new Date().toISOString(),
    inputSource:        'website',
  };
}

// ── Legacy single-pass export (kept for any callers outside ingest.ts) ─────────

/**
 * runEngine — backward-compat wrapper. Runs identity then analysis in sequence.
 * Prefer calling runIdentity + runAnalysis directly for progressive disclosure.
 */
export async function runEngine(
  content: WebsiteContent,
  schema: VerticalSchema,
  statedPainPoint: string | null,
  apiKey: string,
): Promise<BusinessDiscoveryProfile> {
  const identity = await runIdentity(content, schema, apiKey);
  return runAnalysis(content, schema, statedPainPoint, identity, apiKey);
}
