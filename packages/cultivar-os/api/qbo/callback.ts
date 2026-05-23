import { createClient } from '@supabase/supabase-js';

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID!;
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET!;
const QBO_REDIRECT_URI = process.env.QBO_REDIRECT_URI!;
const QBO_ENVIRONMENT = process.env.QBO_ENVIRONMENT || 'sandbox';
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_API_BASE =
  QBO_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
    : 'https://quickbooks.api.intuit.com/v3/company';

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  const { code, state, realmId } = req.query as Record<string, string>;

  if (!code || !state || !realmId) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send('<h2>Missing OAuth parameters. Please try connecting again.</h2>');
  }

  const nurseryId = state.split('__')[0] || '';

  // Exchange code for tokens
  const credentials = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64');
  const tokenResp = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: QBO_REDIRECT_URI,
    }).toString(),
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(`<h2>Token exchange failed: ${err}</h2>`);
  }

  const tokens = await tokenResp.json();

  // Fetch sandbox company name
  let companyName = 'QuickBooks Sandbox';
  try {
    const infoResp = await fetch(
      `${QBO_API_BASE}/${realmId}/companyinfo/${realmId}?minorversion=65`,
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
          Accept: 'application/json',
        },
      },
    );
    if (infoResp.ok) {
      const data = await infoResp.json();
      companyName = data?.CompanyInfo?.CompanyName || companyName;
    }
  } catch {}

  // Store tokens in Supabase nurseries table
  if (nurseryId) {
    try {
      const db = supabase();
      await db
        .from('nurseries')
        .update({
          qb_access_token:     tokens.access_token,
          qb_refresh_token:    tokens.refresh_token,
          qb_realm_id:         realmId,
          qb_token_expires_at: new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
          qb_needs_reconnect:  false,
        })
        .eq('id', nurseryId);
    } catch (e) {
      console.error('[QB callback] Supabase write failed:', e);
    }
  }

  res.setHeader('Content-Type', 'text/html');
  res.send(`
    <!DOCTYPE html>
    <html>
    <body style="font-family:system-ui;background:#111;color:#fff;display:flex;align-items:center;justify-content:center;height:100vh;margin:0">
      <div style="text-align:center">
        <div style="font-size:3rem;margin-bottom:16px">✓</div>
        <h2 style="color:#10b981;margin:0 0 8px">QuickBooks Connected!</h2>
        <p style="color:#94a3b8;margin:0">${companyName}</p>
        <p style="color:#64748b;font-size:0.875rem;margin-top:12px">This window will close automatically...</p>
      </div>
      <script>setTimeout(() => window.close(), 1800);</script>
    </body>
    </html>
  `);
}
