import { createClient } from '@supabase/supabase-js';

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  const nurseryId = req.query.nursery_id as string;
  if (!nurseryId) return res.json({ connected: false });

  try {
    const db = supabase();
    const { data } = await db
      .from('nurseries')
      .select('qb_realm_id, name')
      .eq('id', nurseryId)
      .single();

    if (!data?.qb_realm_id) return res.json({ connected: false });

    return res.json({
      connected: true,
      realmId: data.qb_realm_id,
      companyName: data.name,
    });
  } catch {
    return res.json({ connected: false });
  }
}
