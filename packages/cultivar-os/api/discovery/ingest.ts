import { fetchWebsiteContent } from '@trace/shared/discovery/adapters/website';
import { runEngine } from '@trace/shared/discovery/engine';
import { runSynthesis } from '@trace/shared/discovery/synthesis';
import { nurserySchema } from '@trace/shared/discovery/verticals/nursery';
import type { VerticalSchema } from '@trace/shared/discovery/types';

const VERTICAL_SCHEMAS: Record<string, VerticalSchema> = {
  nursery: nurserySchema,
};

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url, vertical = 'nursery', painPoint } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'url is required' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(503).json({ error: 'AI unavailable' });
  }

  const schema = VERTICAL_SCHEMAS[vertical] ?? nurserySchema;

  try {
    // Step 1: Fetch website
    const content = await fetchWebsiteContent(url);
    if (content.error && !content.text) {
      return res.status(422).json({
        error: `Could not read website: ${content.error}`,
        url: content.url,
      });
    }

    // Step 2: Extract structured profile
    const profile = await runEngine(content, schema, painPoint ?? null, apiKey);

    // Step 3: Generate silent partner analysis email
    const analysis = await runSynthesis(profile, apiKey);

    res.json({ profile, analysis, fetchError: content.error ?? null });

  } catch (err: any) {
    console.error('[discovery/ingest]', err.message);
    res.status(500).json({ error: err.message });
  }
}
