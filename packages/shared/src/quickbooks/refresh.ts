import { createClient } from '@supabase/supabase-js';
import { writeQBSecrets } from './secrets';

const QBO_CLIENT_ID     = process.env.QBO_CLIENT_ID!;
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET!;
const QBO_TOKEN_URL     = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export interface BusinessQBTokens {
  accounting_token:           string | null;
  accounting_refresh_token:   string | null;
  accounting_token_expires_at: string | null;
}

export async function refreshQBToken(
  businessId: string,
  tokens: BusinessQBTokens,
): Promise<string | null> {
  const { accounting_token, accounting_refresh_token, accounting_token_expires_at } = tokens;

  const tenMinutesFromNow = Date.now() + 10 * 60 * 1000;
  const expiresAt = accounting_token_expires_at ? new Date(accounting_token_expires_at).getTime() : 0;
  const needsRefresh = !accounting_token || !accounting_token_expires_at || expiresAt < tenMinutesFromNow;

  if (!needsRefresh) return accounting_token!;
  if (!accounting_refresh_token) return null;

  const db = adminDb();
  const creds = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64');

  const resp = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: accounting_refresh_token,
    }).toString(),
  });

  if (!resp.ok) {
    await db.from('businesses')
      .update({ accounting_needs_reconnect: true })
      .eq('id', businessId);
    return null;
  }

  const data = await resp.json();
  const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();

  // Bearer secrets → owner-only secrets table; non-secret connection state → businesses.
  await writeQBSecrets(db, businessId, {
    accounting_token:         data.access_token,
    accounting_refresh_token: data.refresh_token || accounting_refresh_token,
  });
  await db.from('businesses').update({
    accounting_token_expires_at: newExpiresAt,
    accounting_needs_reconnect:  false,
  }).eq('id', businessId);

  return data.access_token;
}
