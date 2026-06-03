import { createClient } from '@supabase/supabase-js';
import { previewInvitation, acceptInvitation } from '../../../shared/src/auth/acceptInvitation';

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
