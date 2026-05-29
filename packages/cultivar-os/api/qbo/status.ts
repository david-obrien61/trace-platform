import { createClient } from '@supabase/supabase-js';

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  const businessId = (req.query.business_id as string) || (req.query.nursery_id as string);
  if (!businessId) return res.json({ connected: false });

  try {
    const db = supabase();
    const { data } = await db
      .from('businesses')
      .select('accounting_company_id, name')
      .eq('id', businessId)
      .single();

    if (!data?.accounting_company_id) return res.json({ connected: false });

    return res.json({
      connected: true,
      realmId: data.accounting_company_id,
      companyName: data.name,
    });
  } catch {
    return res.json({ connected: false });
  }
}
