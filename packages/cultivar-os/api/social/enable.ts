import { createClient } from '@supabase/supabase-js';
import { callerCan } from '../../../shared/src/auth/callerPermission';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { business_id, advert_channels, cadence } = req.body;

  if (!business_id || !Array.isArray(advert_channels) || advert_channels.length === 0) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // 🔴 CALLER AUTHORITY — MB_D-015. ADDED 2026-07-27; this endpoint had NONE.
  // `business_id` comes off the REQUEST BODY and the upsert runs through adminDb() — service key,
  // RLS bypassed. Anyone reaching the URL could TURN ON a module in ANY tenant by naming its id.
  // `settings:update` and NOT `campaigns:update` (which gates the /social/setup route this is
  // reached from): activating a module changes what the BUSINESS HAS, not what its campaigns say.
  // A deliberate route/endpoint difference — the door is a read, the act behind it is a settings
  // write — recorded here rather than left for STD-020 to read as a disagreement.
  if (!(await callerCan(req.headers?.authorization, business_id, 'settings:update'))) {
    console.log('[TRACE:AUTHORITY] social/enable REFUSED — caller lacks settings:update/owner', { business_id });
    return res.status(403).json({ error: 'Not authorized to change module settings for this business', code: 'FORBIDDEN' });
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
        config:     { advert_channels, cadence: cadence ?? 'weekly' },
      },
      { onConflict: 'business_id,module_key' },
    );

  if (error) {
    console.error('[social/enable]', error.message);
    return res.status(500).json({ error: error.message });
  }

  return res.status(200).json({ ok: true });
}
