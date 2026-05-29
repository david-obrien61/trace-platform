import crypto from 'crypto';

const QBO_SCOPE = 'com.intuit.quickbooks.accounting';
const QBO_AUTH_BASE = 'https://appcenter.intuit.com/connect/oauth2';

function peek(val: string | undefined): string {
  if (!val) return '(not set)';
  // Show first 4 chars so we can spot leading quotes or spaces without exposing the secret
  const first4 = val.slice(0, 4).replace(/\n/g, '\\n').replace(/\r/g, '\\r');
  return `"${first4}..." (len=${val.length})`;
}

export default function handler(req: any, res: any) {
  // Read env vars inside handler so we always get current Vercel values
  const clientId    = process.env.QBO_CLIENT_ID;
  const redirectUri = process.env.QBO_REDIRECT_URI;
  const clientSecret = process.env.QBO_CLIENT_SECRET;

  // Diagnostic logging — remove after QB connect is verified working
  console.log('[qbo/auth-url] env check:');
  console.log('  QBO_CLIENT_ID    set:', !!clientId,    '| first4:', peek(clientId));
  console.log('  QBO_CLIENT_SECRET set:', !!clientSecret, '| first4:', peek(clientSecret));
  console.log('  QBO_REDIRECT_URI  set:', !!redirectUri, '| first4:', peek(redirectUri));

  if (!clientId) {
    return res.status(500).json({ error: 'QBO_CLIENT_ID not configured' });
  }
  if (!redirectUri) {
    return res.status(500).json({ error: 'QBO_REDIRECT_URI not configured' });
  }

  const nurseryId = (req.query.nursery_id as string) || 'demo';
  const random = crypto.randomBytes(16).toString('hex');
  const state = `${nurseryId}__${random}`;

  let url: string;
  try {
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: QBO_SCOPE,
      state,
    });
    url = `${QBO_AUTH_BASE}?${params}`;
    // Validate it's a parseable URL before sending to client
    new URL(url);
  } catch (err: any) {
    console.error('[qbo/auth-url] URL construction failed:', err.message);
    return res.status(500).json({ error: `URL construction failed: ${err.message}` });
  }

  console.log('[qbo/auth-url] URL ok, client_id prefix:', clientId.slice(0, 4));
  console.log('[qbo/auth-url] FULL URL:', url);
  res.json({ url });
}
