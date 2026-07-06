import { createClient } from '@supabase/supabase-js';
import { previewInvitation, acceptInvitation } from '../../../shared/src/auth/acceptInvitation';
import { exchangeDeviceHandoff } from '../../../shared/src/auth/deviceHandoff';

const serviceSupabase = createClient(
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method === 'GET') {
    const { token } = req.query;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'token required' });
    }
    const result = await previewInvitation(serviceSupabase, token);
    return res.status(200).json(result);
  }

  if (req.method === 'POST') {
    // Self-device-handoff exchange rides this endpoint (12/12 Vercel-function ceiling — no new
    // function). The session-less new device posts action:'handoff-exchange'; everything else is
    // the invite-accept path. Service key here bypasses RLS by design (new device has no session).
    if (req.body?.action === 'handoff-exchange') {
      const { token, deviceFingerprint, deviceLabel } = req.body ?? {};
      if (!token || !deviceFingerprint) {
        return res.status(400).json({ error: 'token and deviceFingerprint required' });
      }
      try {
        const result = await exchangeDeviceHandoff(serviceSupabase, { token, deviceFingerprint, deviceLabel });
        return res.status(200).json(result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'unknown';
        const status =
          msg === 'INVALID_TOKEN' ? 404 :
          msg === 'EXPIRED'       ? 410 :
          msg === 'USED'          ? 410 :
          msg.startsWith('MEMBER') || msg.startsWith('EMAIL') || msg === 'LINK_FAILED' ? 500 :
          500;
        return res.status(status).json({ error: msg });
      }
    }

    const { token, email, password, displayName } = req.body ?? {};
    if (!token || !email || !password) {
      return res.status(400).json({ error: 'token, email, and password required' });
    }
    try {
      const result = await acceptInvitation(serviceSupabase, { token, email, password, displayName });
      return res.status(200).json(result);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'unknown';
      const status =
        msg === 'INVALID_TOKEN'        ? 410 :
        msg === 'MEMBER_ROW_NOT_FOUND' ? 500 :
        msg.startsWith('AUTH_CREATE')  ? 422 :
        500;
      return res.status(status).json({ error: msg });
    }
  }

  return res.status(405).end();
}
