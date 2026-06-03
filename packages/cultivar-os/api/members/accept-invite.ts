import { createClient } from '@supabase/supabase-js';
import { acceptInvitation } from '../../../shared/src/auth/acceptInvitation';

const serviceSupabase = createClient(
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).end();

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
