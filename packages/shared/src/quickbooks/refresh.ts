import { createClient } from '@supabase/supabase-js';

const QBO_CLIENT_ID     = process.env.QBO_CLIENT_ID!;
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET!;
const QBO_TOKEN_URL     = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export interface NurseryQBTokens {
  qb_access_token:     string | null;
  qb_refresh_token:    string | null;
  qb_token_expires_at: string | null;
}

/**
 * Returns a valid QB access token for nurseryId.
 * Refreshes proactively if the token is missing or within 10 minutes of expiry.
 * Sets qb_needs_reconnect = true and returns null if the refresh token is dead.
 * Caller must handle null gracefully (skip invoice, never block the order).
 */
export async function refreshQBToken(
  nurseryId: string,
  tokens: NurseryQBTokens,
): Promise<string | null> {
  const { qb_access_token, qb_refresh_token, qb_token_expires_at } = tokens;

  const tenMinutesFromNow = Date.now() + 10 * 60 * 1000;
  const expiresAt = qb_token_expires_at ? new Date(qb_token_expires_at).getTime() : 0;
  const needsRefresh = !qb_access_token || !qb_token_expires_at || expiresAt < tenMinutesFromNow;

  if (!needsRefresh) return qb_access_token!;
  if (!qb_refresh_token) return null;

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
      refresh_token: qb_refresh_token,
    }).toString(),
  });

  if (!resp.ok) {
    await db.from('nurseries')
      .update({ qb_needs_reconnect: true })
      .eq('id', nurseryId);
    return null;
  }

  const data = await resp.json();
  const newExpiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString();

  await db.from('nurseries').update({
    qb_access_token:     data.access_token,
    qb_refresh_token:    data.refresh_token || qb_refresh_token,
    qb_token_expires_at: newExpiresAt,
    qb_needs_reconnect:  false,
  }).eq('id', nurseryId);

  return data.access_token;
}
