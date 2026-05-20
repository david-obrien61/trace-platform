import crypto from 'crypto';

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID!;
const QBO_REDIRECT_URI = process.env.QBO_REDIRECT_URI!;
const QBO_SCOPE = 'com.intuit.quickbooks.accounting';
const QBO_AUTH_BASE = 'https://appcenter.intuit.com/connect/oauth2';

export default function handler(req: any, res: any) {
  if (!QBO_CLIENT_ID) {
    return res.status(500).json({ error: 'QBO_CLIENT_ID not configured' });
  }

  const nurseryId = (req.query.nursery_id as string) || '';
  const random = crypto.randomBytes(16).toString('hex');
  const state = `${nurseryId}__${random}`;

  const params = new URLSearchParams({
    client_id: QBO_CLIENT_ID,
    redirect_uri: QBO_REDIRECT_URI,
    response_type: 'code',
    scope: QBO_SCOPE,
    state,
  });

  res.json({ url: `${QBO_AUTH_BASE}?${params}` });
}
