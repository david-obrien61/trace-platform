import { createClient } from '@supabase/supabase-js';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

async function fetchBlotatoAccountId(platform: string): Promise<string | null> {
  const apiKey = process.env.BLOTATO_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://backend.blotato.com/v2/users/me/accounts', {
      headers: { 'blotato-api-key': apiKey },
    });
    if (!res.ok) return null;
    const data = await res.json();
    // data is expected to be an array of account objects with { id, platform, ... }
    const accounts: Array<{ id: string | number; platform?: string; targetType?: string }> =
      Array.isArray(data) ? data : (data.accounts ?? []);
    const match = accounts.find(a =>
      (a.platform ?? a.targetType ?? '').toLowerCase() === platform.toLowerCase()
    );
    return match ? String(match.id) : (accounts[0] ? String(accounts[0].id) : null);
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { business_id, platforms } = req.body;

  if (!business_id || !Array.isArray(platforms) || platforms.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Fetch TRACE's Blotato account ID for the first selected platform server-side.
  // TRACE owns the Blotato account; customers never need to supply a Blotato ID.
  const blotato_account_id = await fetchBlotatoAccountId(platforms[0]);

  const db = adminDb();

  const { error } = await db
    .from('nursery_modules')
    .upsert(
      {
        business_id,
        module_key:  'social_media',
        enabled:     true,
        configured:  true,
        config:      { blotato_account_id, platforms },
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'business_id,module_key' },
    );

  if (error) {
    console.error('[social/enable]', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
