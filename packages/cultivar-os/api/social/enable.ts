import { createClient } from '@supabase/supabase-js';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { business_id, platforms, cadence } = req.body;

  if (!business_id || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const db = adminDb();

  const { error } = await db
    .from('business_modules')
    .upsert(
      {
        business_id,
        module_key: 'social_media',
        enabled:    true,
        configured: true,
        config:     { platforms, cadence: cadence ?? 'weekly' },
      },
      { onConflict: 'business_id,module_key' },
    );

  if (error) {
    console.error('[social/enable]', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
