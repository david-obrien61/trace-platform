import { fetchWebsiteContent } from '../../../shared/src/discovery/adapters/website';
import { runIdentity, runAnalysis } from '../../../shared/src/discovery/engine';
import { runSynthesis } from '../../../shared/src/discovery/synthesis';
import { nurserySchema } from '../../../shared/src/discovery/verticals/nursery';
import type { VerticalSchema } from '../../../shared/src/discovery/types';

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

    // Step 2a: Fast identity extraction (Haiku) — feeds recognition moment
    // NOTE: ingest.ts returns this as `identity` in the response JSON.
    // DiscoveryGlimpse reads `data.profile` (the deep analysis) — unchanged.
    const identity = await runIdentity(content, schema, apiKey);

    // Step 2b: Deep analysis (Sonnet) — uses identity context, avoids re-extraction
    const profile = await runAnalysis(content, schema, painPoint ?? null, identity, apiKey);

    // Step 3: Silent partner email from the deep analysis (unchanged)
    const analysis = await runSynthesis(profile, apiKey);

    res.json({ identity, profile, analysis, fetchError: content.error ?? null });

  } catch (err: any) {
    console.error('[discovery/ingest]', err.message);
    res.status(500).json({ error: err.message });
  }
}
