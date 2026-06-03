import { createClient } from '@supabase/supabase-js';
import { previewInvitation } from '../../../shared/src/auth/acceptInvitation';

const serviceSupabase = createClient(
  process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

export default async function handler(req: any, res: any) {
  if (req.method !== 'GET') return res.status(405).end();

  const { token } = req.query;
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'token required' });
  }

  const result = await previewInvitation(serviceSupabase, token);
  return res.status(200).json(result);
}
