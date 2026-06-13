/**
 * AC-5 QBO connector — single router for all QBO OAuth endpoints.
 * Path dispatch: vercel.json rewrites inject _route=auth-url|callback|status
 * before forwarding to /api/qbo-connector. All three public paths are preserved;
 * only the Vercel function count drops from 3 → 1.
 *
 * Public paths (via vercel.json rewrites):
 *   GET  /api/qbo/auth-url → _route=auth-url
 *   GET  /api/qbo/callback → _route=callback  (registered with Intuit — must not change)
 *   GET  /api/qbo/status   → _route=status
 */

import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';
import { refreshQBToken } from '../../../../shared/src/quickbooks/refresh';

// ─── shared constants ────────────────────────────────────────────────────────

const QBO_SCOPE      = 'com.intuit.quickbooks.accounting';
const QBO_AUTH_BASE  = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN_URL  = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const QBO_ENVIRONMENT = process.env.QBO_ENVIRONMENT || 'sandbox';
const QBO_API_BASE   = QBO_ENVIRONMENT === 'sandbox'
  ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
  : 'https://quickbooks.api.intuit.com/v3/company';

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

function peek(val: string | undefined): string {
  if (!val) return '(not set)';
  const first4 = val.slice(0, 4).replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  return `"${first4}..." (len=${val.length})`;
}

// ─── auth-url ────────────────────────────────────────────────────────────────

function handleAuthUrl(req: any, res: any) {
  const clientId    = process.env.QBO_CLIENT_ID;
  const redirectUri = process.env.QBO_REDIRECT_URI;
  const clientSecret = process.env.QBO_CLIENT_SECRET;

  console.log('[qbo/auth-url] env check:');
  console.log('  QBO_CLIENT_ID    set:', !!clientId,    '| first4:', peek(clientId));
  console.log('  QBO_CLIENT_SECRET set:', !!clientSecret, '| first4:', peek(clientSecret));
  console.log('  QBO_REDIRECT_URI  set:', !!redirectUri, '| first4:', peek(redirectUri));

  if (!clientId)    return res.status(500).json({ error: 'QBO_CLIENT_ID not configured' });
  if (!redirectUri) return res.status(500).json({ error: 'QBO_REDIRECT_URI not configured' });

  const nurseryId = (req.query.business_id as string) || (req.query.nursery_id as string) || 'demo';
  const random    = crypto.randomBytes(16).toString('hex');
  const state     = `${nurseryId}__${random}`;

  let url: string;
  try {
    const params = new URLSearchParams({
      client_id:     clientId,
      redirect_uri:  redirectUri,
      response_type: 'code',
      scope:         QBO_SCOPE,
      state,
    });
    url = `${QBO_AUTH_BASE}?${params}`;
    new URL(url);
  } catch (err: any) {
    console.error('[qbo/auth-url] URL construction failed:', err.message);
    return res.status(500).json({ error: `URL construction failed: ${err.message}` });
  }

  console.log('[qbo/auth-url] URL ok, client_id prefix:', clientId.slice(0, 4));
  return res.json({ url });
}

// ─── callback ────────────────────────────────────────────────────────────────

async function handleCallback(req: any, res: any) {
  const { code, state, realmId } = req.query as Record<string, string>;

  if (!code || !state || !realmId) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send('<h2>Missing OAuth parameters. Please try connecting again.</h2>');
  }

  const businessId = state.split('__')[0] || '';

  const credentials = Buffer.from(
    `${process.env.QBO_CLIENT_ID}:${process.env.QBO_CLIENT_SECRET}`
  ).toString('base64');

  const tokenResp = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization:  `Basic ${credentials}`,
      Accept:         'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type:   'authorization_code',
      code,
      redirect_uri: process.env.QBO_REDIRECT_URI!,
    }).toString(),
  });

  if (!tokenResp.ok) {
    const err = await tokenResp.text();
    res.setHeader('Content-Type', 'text/html');
    return res.status(500).send(`<h2>Token exchange failed: ${err}</h2>`);
  }

  const tokens = await tokenResp.json();

  let companyName = 'QuickBooks';
  try {
    const infoResp = await fetch(
      `${QBO_API_BASE}/${realmId}/companyinfo/${realmId}?minorversion=65`,
      { headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json' } },
    );
    if (infoResp.ok) {
      const data = await infoResp.json();
      companyName = data?.CompanyInfo?.CompanyName || companyName;
    }
  } catch {}

  if (businessId) {
    try {
      const db = supabase();
      await db.from('businesses').update({
        accounting_type:              'quickbooks',
        accounting_token:             tokens.access_token,
        accounting_refresh_token:     tokens.refresh_token,
        accounting_company_id:        realmId,
        accounting_token_expires_at:  new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000).toISOString(),
        accounting_needs_reconnect:   false,
      }).eq('id', businessId);
    } catch (e) {
      console.error('[QB callback] Supabase write failed:', e);
    }
  }

  res.setHeader('Content-Type', 'text/html');
  return res.send(`
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

// ─── status ──────────────────────────────────────────────────────────────────

async function handleStatus(req: any, res: any) {
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

    const expiresAt   = data.accounting_token_expires_at
      ? new Date(data.accounting_token_expires_at).getTime()
      : 0;
    const tokenExpired = !data.accounting_token || expiresAt < Date.now();

    let needsReconnect = false;
    if (tokenExpired) {
      const freshToken = await refreshQBToken(businessId, {
        accounting_token:             data.accounting_token,
        accounting_refresh_token:     data.accounting_refresh_token,
        accounting_token_expires_at:  data.accounting_token_expires_at,
      });
      needsReconnect = freshToken === null;
    }

    return res.json({
      connected: true,
      realmId:   data.accounting_company_id,
      companyName: data.name,
      needsReconnect,
    });
  } catch {
    return res.json({ connected: false });
  }
}

// ─── router (AC-5 dispatch) ───────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  const route = req.query._route as string;
  switch (route) {
    case 'auth-url': return handleAuthUrl(req, res);
    case 'callback': return handleCallback(req, res);
    case 'status':   return handleStatus(req, res);
    default:
      return res.status(400).json({ error: `Unknown QBO route: ${route || '(none)'}` });
  }
}
