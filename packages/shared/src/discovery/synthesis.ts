import Anthropic from '@anthropic-ai/sdk';
import type { BusinessDiscoveryProfile, SilentPartnerAnalysis } from './types';

const SYSTEM_PROMPT = `You write "silent partner analysis" emails for TRACE Enterprises.

TRACE is a software platform for owner-operated small businesses. We describe ourselves as a silent partner: we do our job quietly so the business owner's customers only ever see the business, not us.

The tone of every email you write:
- Warm and specific — reference actual things observed about their business, never generic
- Strengths-forward — acknowledge what they have built before anything else
- Gentle on opportunities — frame as "what could amplify this" not "what is wrong"
- Never preachy, never a score or grade, never a laundry list
- This business has been operating for years. They did not need us to succeed. We are here because we can make the hours easier.
- Short. Under 350 words. Every sentence earns its place.

Sign as: David, TRACE Enterprises
Return only valid JSON. No markdown fences, no explanation.`;

export async function runSynthesis(
  profile: BusinessDiscoveryProfile,
  apiKey: string,
): Promise<SilentPartnerAnalysis> {
  const anthropic = new Anthropic({ apiKey });

  const yearsLine = profile.yearsInBusiness
    ? `They have been in business for ${profile.yearsInBusiness} years.`
    : 'They are an established business.';

  const painLine = profile.statedPainPoint
    ? `They told us their main pain point is: "${profile.statedPainPoint}".`
    : 'No specific pain point was stated — infer from their profile.';

  const prompt = `Write a silent partner analysis email for this business.

Business: ${profile.businessName ?? 'this business'}
Website: ${profile.websiteUrl ?? 'not provided'}
Vertical: ${profile.vertical}
Location: ${profile.location ?? 'not specified'}
${yearsLine}
${painLine}

What we observed:
Strengths: ${profile.strengths.join('; ') || 'none extracted'}
Services found on site: ${profile.servicesFound.join(', ') || 'none listed'}
Tone of their site: ${profile.tone}
Content freshness: ${profile.contentFreshness}
Gaps (things common to their vertical not mentioned): ${profile.gaps.join('; ') || 'none identified'}

Suggested service offerings we identified:
${profile.suggestedOfferings.map(o => `- ${o.name}: ${o.rationale}`).join('\n') || 'none'}

Write the email. It should:
1. Open by acknowledging what they built — reference something specific from their strengths
2. Acknowledge their pain point (or the most likely one from their profile) with empathy, not alarm
3. Offer 2-3 specific opportunities framed as amplifiers — each tied to a business outcome
4. Close warmly with a soft, no-pressure invitation to learn more
5. Feel like it came from a person who actually read their website, not a template

Return JSON:
{
  "subject": "email subject line — specific to them, not generic",
  "body": "full plain text email",
  "html": "same email as clean HTML using only <p>, <strong>, <br> tags"
}`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  });

  const raw = (response.content[0] as any).text?.trim() ?? '{}';
  const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error('Synthesis returned unparseable JSON');
  }

  return {
    subject: parsed.subject ?? `A note on ${profile.businessName ?? 'your business'} from TRACE`,
    body:    parsed.body    ?? '',
    html:    parsed.html    ?? `<p>${parsed.body ?? ''}</p>`,
  };
}
