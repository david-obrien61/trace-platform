import { createClient } from '@supabase/supabase-js';
import { refreshQBToken } from '../../../shared/src/quickbooks/refresh';

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
      .select('accounting_company_id, name, accounting_token, accounting_refresh_token, accounting_token_expires_at')
      .eq('id', businessId)
      .single();

    if (!data?.accounting_company_id) return res.json({ connected: false });

    // Proactive token freshness check — STD-007: connection state must be derived
    // from real evidence (token expiry), not a cached flag that only updates on failure.
    const expiresAt = data.accounting_token_expires_at
      ? new Date(data.accounting_token_expires_at).getTime()
      : 0;
    const tokenExpired = !data.accounting_token || expiresAt < Date.now();

    let needsReconnect = false;
    if (tokenExpired) {
      // Token is missing or expired — attempt silent refresh before declaring dead.
      const freshToken = await refreshQBToken(businessId, {
        accounting_token: data.accounting_token,
        accounting_refresh_token: data.accounting_refresh_token,
        accounting_token_expires_at: data.accounting_token_expires_at,
      });
      // freshToken === null means refresh failed; refreshQBToken already wrote
      // accounting_needs_reconnect=true to the DB in that case.
      needsReconnect = freshToken === null;
    }

    return res.json({
      connected: true,
      realmId: data.accounting_company_id,
      companyName: data.name,
      needsReconnect,
    });
  } catch {
    return res.json({ connected: false });
  }
}
