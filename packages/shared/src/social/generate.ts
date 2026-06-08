import { executeCapability } from '../ai/execute';

const SOCIALDRAFT_DEBUG = false;

// Business type descriptors — variation is DATA keyed by business_type value (AC-1/AC-4).
// New verticals: add an entry here; no code branching, no vertical nouns in conditions.
const BUSINESS_DESCRIPTORS: Record<string, string> = {
  nursery: 'owner-operated plant nursery',
};

const DEFAULT_DESCRIPTOR = 'owner-operated small business';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export interface SocialGenerateInput {
  businessName:  string;
  businessType:  string;
  platforms:     string[];
  periodStart:   Date;
  periodEnd:     Date;
  orderCount:    number;
  subjectSummary: string;   // vertical-assembled context: "Oak Trees, Crape Myrtles" | "oil changes, brake jobs"
  customerNames:  string[]; // first names only, deduplicated, limit 4
  apiKey:         string;
}

// Returns: { platform: caption } for each requested platform
// Throws on AI failure — caller decides whether to surface or swallow.
export async function generateSocialDrafts(
  input: SocialGenerateInput,
): Promise<Record<string, string>> {
  const {
    businessName, businessType, platforms, periodStart, periodEnd,
    orderCount, subjectSummary, customerNames, apiKey,
  } = input;

  const descriptor   = BUSINESS_DESCRIPTORS[businessType] ?? DEFAULT_DESCRIPTOR;
  const currentMonth = MONTH_NAMES[new Date().getMonth()];

  if (SOCIALDRAFT_DEBUG) {
    console.log('[TRACE:socialdraft] generate — businessType:', businessType, 'descriptor:', descriptor, 'platforms:', platforms);
  }

  const systemPrompt = `You are a social media writer for a ${descriptor}. \
Your job is to write ONE post per platform that celebrates the week's business activity.

Write warmly and specifically — reference what actually happened, not a generic template. \
Aggregate the week into one compelling moment. Never mention prices. Never include customer \
last names, emails, or contact info. Use customer first names only if they feel natural.

Formatting per platform:
- instagram: under 220 characters, 5–8 relevant hashtags at the end. Visual and upbeat.
- facebook: 50–120 words. Warm and conversational. 2–3 hashtags max. More storytelling.
- tiktok: under 150 characters, punchy and energetic. 3–5 hashtags.
- twitter: under 260 characters, brief and direct. 2–3 hashtags.

Return ONLY a JSON object. No markdown, no explanation, no preamble. Keys are platform names, \
values are caption strings. Include only the platforms listed in the user message. \
Example: {"instagram":"caption...","facebook":"caption..."}`;

  const customerLine = customerNames.length > 0
    ? `Customer first names: ${customerNames.join(', ')}`
    : '';

  const noSalesNote = orderCount === 0
    ? "No sales this period — write a general warm post about the season and what's growing."
    : '';

  const userPrompt = `Write social posts for ${businessName}.

Period: ${periodStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – \
${periodEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${currentMonth}
Orders this period: ${orderCount}
What was sold: ${subjectSummary}
${customerLine}
${noSalesNote}

Platforms to generate (include ALL of these as keys in the JSON):
${platforms.join(', ')}`;

  if (SOCIALDRAFT_DEBUG) {
    console.log('[TRACE:socialdraft] calling executeCapability — orderCount:', orderCount, 'subjectSummary:', subjectSummary);
  }

  const result = await executeCapability('social_generate', {
    system: systemPrompt,
    user:   userPrompt,
    apiKey,
  }) as Record<string, string>;

  if (SOCIALDRAFT_DEBUG) {
    console.log('[TRACE:socialdraft] result keys:', Object.keys(result ?? {}));
  }

  return result;
}
