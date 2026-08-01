import { createClient } from '@supabase/supabase-js';
import { callerCan, resolveCallerUid } from '../../../shared/src/auth/callerPermission';
import { setBusinessModuleState } from '../../../shared/src/business-logic/moduleState';

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

  // 🔴 MOVED TO THE RPC 2026-08-01. This was NEVER BLOCKED — the service key bypasses RLS, so the
  // 20260801 narrowing did not break it. It moves anyway so `business_modules` has ONE writer
  // (STD-011) and so this act is AUDITED like every other one; a module turning on with no audit
  // row while every other module change has one is a hole in the record, not a saving.
  //
  // THE ACTOR IS THE REAL CALLER, not a system ghost — `resolveCallerUid` off the same header the
  // authority check above already read. `assert_movement_actor`'s forgery pin only fires when
  // `auth.uid()` is non-NULL, and under the service key it is NULL, so this passes and the audit
  // row names a person.
  //
  // ⚠️ `enabled: true` STILL PASSES, and on a tenant where Social is already on that is NOT a
  // change, so it needs no `subscription:update` — a manager's save keeps working exactly as it
  // did. On a NEW tenant it is a FIRST enable, a real $19/mo decision, and the RPC refuses anyone
  // without spend authority. That refusal is surfaced as a 403 below rather than a 500: it is an
  // authority answer, not a failure.
  const actor = await resolveCallerUid(req.headers?.authorization);
  const r = await setBusinessModuleState(db, business_id, 'social_media', {
    enabled:    true,
    configured: true,
    config:     { advert_channels, cadence: cadence ?? 'weekly' },
  }, actor);

  if (r.error) {
    console.error('[social/enable]', r.error.message);
    return res.status(500).json({ error: r.error.message });
  }
  if (!r.applied) {
    console.log('[TRACE:AUTHORITY] social/enable REFUSED by set_business_module_state', { business_id, reason: r.reason });
    return res.status(403).json({ error: r.reason ?? 'Module change refused', code: 'FORBIDDEN' });
  }

  return res.status(200).json({ ok: true });
}
