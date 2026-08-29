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
 *   GET  /api/qbo/items    → _route=items
 */

import crypto from 'crypto';
import { callerCan } from '../../../shared/src/auth/callerPermission';
import { createClient } from '@supabase/supabase-js';
import { refreshQBToken } from '../../../shared/src/quickbooks/refresh';
import { readQBSecrets, writeQBSecrets, QBO_CONNECTION_COLUMNS } from '../../../shared/src/quickbooks/secrets';
import {
  QBO_ITEM_QUERY, parseItemList, classifyFailure,
} from '../../../shared/src/quickbooks/itemList';

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

// `async` is LOAD-BEARING: this handler awaits `callerCan` (the 2026-07-27 capK gate) and the
// pending-state upsert. Without it the `await` on line ~68 is a SyntaxError, the MODULE never
// parses, and every route through this router 500s — auth-url, status AND callback — even though
// handleStatus is correct. Removing it does not break one branch; it breaks the file.
async function handleAuthUrl(req: any, res: any) {
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

  // 🔴 CALLER AUTHORITY — MB_D-015. ADDED 2026-07-27 (item (a) of the qbo split).
  // Starting an OAuth connect binds a QuickBooks company to THIS tenant, and the callback that
  // follows WRITES `businesses` accounting tokens under the service key. Until this gate existed
  // anyone could begin that flow for ANY tenant by naming its id in the query string.
  // `settings:update` — it changes the business's accounting configuration.
  // ⚠️ THE CALLBACK BRANCH IS DELIBERATELY NOT GATED HERE: Intuit redirects the BROWSER to it, so
  // no Bearer token can exist. It needs a signed, single-use, business-bound `state` — a different
  // mechanism, shipping as its own commit. The `state` built below is currently
  // `${nurseryId}__${random}`: it carries the tenant but is NEITHER SIGNED NOR SINGLE-USE, so it
  // is forgeable. That is the (b) work, named here so nobody reads this gate as closing it.
  if (!(await callerCan(req.headers?.authorization, nurseryId, 'settings:update'))) {
    console.log('[TRACE:AUTHORITY] qbo/auth-url REFUSED — caller lacks settings:update/owner', { businessId: nurseryId });
    return res.status(403).json({ error: 'Not authorized to connect QuickBooks for this business', code: 'FORBIDDEN' });
  }
  // MINTED HERE, BY AN AUTHENTICATED CALLER — the gate above (settings:update) is what makes this
  // state trustworthy at all: a client cannot mint one, so a valid state proves an authorised
  // human began this connect for THIS business.
  const state = mintState(nurseryId);
  {
    const db = supabase();
    const { error: stateErr } = await db
      .from('business_accounting_secrets')
      .upsert({ business_id: nurseryId, oauth_state: state, oauth_state_at: new Date().toISOString() },
              { onConflict: 'business_id' });
    if (stateErr) {
      console.log('[TRACE:AUTHORITY] qbo/auth-url could not store pending state', { businessId: nurseryId, error: stateErr.message });
      return res.status(500).json({ error: 'Could not begin the QuickBooks connect — please retry.' });
    }
  }

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


// ════════════════════════════════════════════════════════════════════════════════
// THE OAuth STATE — SIGNED, BUSINESS-BOUND, STORED PENDING, SINGLE-USE
// ════════════════════════════════════════════════════════════════════════════════
// Format: `v2.<businessId>.<nonce>.<issuedAtMs>.<hmac>` — versioned so the OLD
// `${businessId}__${random}` shape is not merely unparseable but IDENTIFIABLE, and can be
// rejected LOUDLY rather than falling through some generic 400.
//
// Signed with QBO_CLIENT_SECRET — an EXISTING server secret (David: do not introduce a new one to
// rotate). Rotating QBO credentials invalidates in-flight states, which is correct: they live ten
// minutes and a credential rotation should end them.
//
// 🔴 THE SIGNATURE IS NOT THE SECURITY BOUNDARY ON ITS OWN. It proves the state was minted by us;
// the STORED, SINGLE-USE copy proves it has not been used before. Both are required — a signed
// state with no storage is replayable for its whole TTL.
const STATE_TTL_MS = 10 * 60 * 1000;

function signState(businessId: string, nonce: string, issuedAt: number): string {
  const secret = process.env.QBO_CLIENT_SECRET || '';
  return crypto.createHmac('sha256', secret)
    .update(`${businessId}.${nonce}.${issuedAt}`)
    .digest('hex');
}

function mintState(businessId: string): string {
  const nonce    = crypto.randomBytes(16).toString('hex');
  const issuedAt = Date.now();
  return `v2.${businessId}.${nonce}.${issuedAt}.${signState(businessId, nonce, issuedAt)}`;
}

/** Parse + verify the SIGNATURE and TTL. Storage/single-use is checked separately, by the caller. */
function verifyStateSignature(state: string): { businessId: string; issuedAt: number } | null {
  const parts = state.split('.');
  if (parts.length !== 5 || parts[0] !== 'v2') return null;
  const [, businessId, nonce, issuedAtRaw, mac] = parts;
  const issuedAt = Number(issuedAtRaw);
  if (!businessId || !nonce || !Number.isFinite(issuedAt)) return null;
  const expected = signState(businessId, nonce, issuedAt);
  // timing-safe compare — lengths are equal by construction (both hex sha256)
  if (mac.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac, 'hex'), Buffer.from(expected, 'hex'))) return null;
  if (Date.now() - issuedAt > STATE_TTL_MS) return null;
  return { businessId, issuedAt };
}

// ─── callback ────────────────────────────────────────────────────────────────

async function handleCallback(req: any, res: any) {
  const { code, state, realmId } = req.query as Record<string, string>;

  if (!code || !state || !realmId) {
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send('<h2>Missing OAuth parameters. Please try connecting again.</h2>');
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 VALIDATE THE STATE. This is the ONLY thing standing between Intuit's redirect and a write
  // of another tenant's QuickBooks tokens — there is no Bearer token here and there never can be.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // (1) OLD FORMAT — REJECTED OUTRIGHT, NO COMPATIBILITY WINDOW (David's ruling). A window on a
  //     forgeable format is a hole with a schedule. Logged LOUDLY, not silently 400'd: after this
  //     ships, an old-format state means either a stale in-flight connect or someone probing, and
  //     both are worth seeing.
  if (state.includes('__') && !state.startsWith('v2.')) {
    console.log('[TRACE:AUTHORITY] 🔴 qbo/callback REJECTED an OLD-FORMAT state — forgeable `businessId__random` shape. Either a connect started before 2026-07-27 or someone probing.', {
      statePrefix: state.slice(0, 12), realmId,
    });
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send('<h2>This QuickBooks connection link is no longer valid. Please start the connect again from Settings.</h2>');
  }

  // (2) SIGNATURE + TTL — proves WE minted it, for THIS business, recently.
  const verified = verifyStateSignature(state);
  if (!verified) {
    console.log('[TRACE:AUTHORITY] 🔴 qbo/callback REJECTED a state that failed signature or TTL.', {
      statePrefix: state.slice(0, 12), realmId,
    });
    res.setHeader('Content-Type', 'text/html');
    return res.status(400).send('<h2>This QuickBooks connection link is not valid. Please start the connect again from Settings.</h2>');
  }
  const businessId = verified.businessId;

  // (3) SINGLE-USE, ENFORCED BY STORAGE — the condition is ON THE UPDATE, so two simultaneous
  //     callbacks cannot both win: the second matches zero rows. Clearing it here is also the
  //     cleanup path (see the migration header) — there is no table of pending rows to sweep.
  {
    const db = supabase();
    const { data: claimed, error: claimErr } = await db
      .from('business_accounting_secrets')
      .update({ oauth_state: null, oauth_state_at: null })
      .eq('business_id', businessId)
      .eq('oauth_state', state)
      .select('business_id');
    if (claimErr || !claimed || claimed.length === 0) {
      console.log('[TRACE:AUTHORITY] 🔴 qbo/callback REJECTED a state that was already used, unknown, or for another business — REPLAY or FORGERY.', {
        businessId, statePrefix: state.slice(0, 12), realmId, error: claimErr?.message ?? null,
      });
      res.setHeader('Content-Type', 'text/html');
      return res.status(400).send('<h2>This QuickBooks connection link has already been used. Please start the connect again from Settings.</h2>');
    }
  }
  console.log('[TRACE:AUTHORITY] qbo/callback state VALIDATED — signed, in-date, claimed single-use', { businessId, realmId });

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
      // Bearer secrets → owner-only secrets table; non-secret connection state → businesses.
      await writeQBSecrets(db, businessId, {
        accounting_token:         tokens.access_token,
        accounting_refresh_token: tokens.refresh_token,
      });
      await db.from('businesses').update({
        accounting_type:              'quickbooks',
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

  // 🔴 CALLER AUTHORITY — MB_D-015 (item (a)). Reads `businesses` under the service key and
  // discloses whether a named tenant has QuickBooks connected, plus its company id. A read, but
  // the same missing check. `settings:read` — it is business configuration state.
  if (!(await callerCan(req.headers?.authorization, businessId, 'settings:read'))) {
    console.log('[TRACE:AUTHORITY] qbo/status REFUSED — caller lacks settings:read/owner', { businessId });
    return res.status(403).json({ error: 'Not authorized to read accounting status for this business', code: 'FORBIDDEN' });
  }

  try {
    const db = supabase();
    const { data } = await db
      .from('businesses')
      .select(QBO_CONNECTION_COLUMNS)
      .eq('id', businessId)
      .single();

    if (!data?.accounting_company_id) return res.json({ connected: false });

    // Bearer secrets come from the owner-only secrets table (not the businesses row).
    const secrets = await readQBSecrets(db, businessId);

    const expiresAt   = data.accounting_token_expires_at
      ? new Date(data.accounting_token_expires_at).getTime()
      : 0;
    const tokenExpired = !secrets.accounting_token || expiresAt < Date.now();

    let needsReconnect = false;
    if (tokenExpired) {
      const freshToken = await refreshQBToken(businessId, {
        accounting_token:             secrets.accounting_token,
        accounting_refresh_token:     secrets.accounting_refresh_token,
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

// ─── items (READ-ONLY) ────────────────────────────────────────────────────────
//
// PURPOSE: read the connected company's QuickBooks Item list — `select * from Item` — and
//   return it to the caller's screen. NOTHING IS STORED. This exists to answer one urgent
//   question with real ids instead of an assumption: the invoice push carries TWELVE
//   hardcoded `ItemRef: { value: '1', name: 'Services' }` literals, nothing has pushed to
//   LAWNS yet, and the next completed checkout would land every line — trees included — in
//   their books as generic "Services", collapsing the Sales-of-Nursery-Stock vs Services
//   split. This read is what tells us the real ids before that happens.
//
// 🔴 READ-ONLY AGAINST INTUIT, AND STRUCTURALLY SO. One GET, one query, `QBO_ITEM_QUERY`
//   asserted read-only by its own test. A QuickBooks invoice deleted still consumes its
//   number and leaves a trail the customer's accountant sees; there is no second real
//   company to practise on. No write belongs on this route, ever.
//
// 🔴 NOTHING IS PERSISTED. Their chart of items is a customer's live accounting data.
//   Storing it is a later decision with its own ruling (user_stories.md — "QuickBooks
//   read-back + customer de-dup"); this pass proves the pipe and holds nothing.
//
// 🔴 THE BODY IS NEVER LOGGED. The [TRACE:QBO] lines below carry the status, the realm and a
//   COUNT — never a name, never a body, and never the token. A serverless log is a place
//   customer data can persist for a long time without anyone deciding it should.
//
// WHY IT RIDES THIS ROUTER RATHER THAN THE INVOICE ENDPOINT: this is a COMPANY-level read
// with no order. The invoice endpoint is POST-only and its every path assumes an order_id
// exists. This file already holds the company-level `companyinfo` GET against the same base
// URL, already dispatches on _route, and already runs the settings:* gates. No new Vercel
// function is minted — the ceiling is lifted, but the reason still has to exist (§6 r11).
async function handleItems(req: any, res: any) {
  const businessId = (req.query.business_id as string) || '';
  if (!businessId) return res.status(400).json({ error: 'business_id required' });

  // 🔴 CALLER AUTHORITY — MB_D-015. This route reads a customer's live accounting data under
  // the SERVICE KEY, which bypasses RLS entirely, so `bas_owner_all` never runs here and this
  // gate is the only thing standing between the request and another tenant's books.
  // `settings:read` — the same string /api/qbo/status takes, because this is the same class of
  // fact: the state of the business's accounting connection. It resolves the caller from the
  // BEARER TOKEN, never the body, so naming someone else's business_id gets you nothing.
  if (!(await callerCan(req.headers?.authorization, businessId, 'settings:read'))) {
    console.log('[TRACE:QBO] items REFUSED — caller lacks settings:read/owner', { businessId });
    return res.status(403).json({ error: 'Not authorized to read QuickBooks items for this business', code: 'FORBIDDEN' });
  }

  const db = supabase();
  const { data: business } = await db
    .from('businesses')
    .select(QBO_CONNECTION_COLUMNS)
    .eq('id', businessId)
    .maybeSingle();

  if (!business?.accounting_company_id) {
    console.log('[TRACE:QBO] items — no QuickBooks connection on this business', { businessId });
    return res.status(409).json({ error: 'QuickBooks is not connected for this business — connect it first.', code: 'NOT_CONNECTED' });
  }
  const realmId: string = business.accounting_company_id;

  const secrets = await readQBSecrets(db, businessId);
  const token = await refreshQBToken(businessId, {
    accounting_token:            secrets.accounting_token,
    accounting_refresh_token:    secrets.accounting_refresh_token,
    accounting_token_expires_at: business.accounting_token_expires_at,
  });
  if (!token) {
    // The refresh path itself failed — Stage 0 G3. Reported as its own state rather than as a
    // generic read failure, because reconnecting is the fix and no amount of retrying is.
    console.log('[TRACE:QBO] items — token refresh returned null, reconnect required', { businessId, realmId });
    return res.status(503).json({ error: 'qb_token_expired', code: 'RECONNECT_REQUIRED',
      detail: 'The QuickBooks token could not be refreshed. Reconnect QuickBooks from Settings, then try again.' });
  }

  const queriedAt = new Date().toISOString();
  let resp: Response;
  try {
    resp = await fetch(
      `${QBO_API_BASE}/${realmId}/query?query=${encodeURIComponent(QBO_ITEM_QUERY)}&minorversion=65`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
  } catch (e: any) {
    console.log('[TRACE:QBO] items — request to Intuit did not complete', { businessId, realmId, message: e?.message });
    return res.status(502).json({ error: 'The request to QuickBooks did not complete.', code: 'UPSTREAM_UNREACHABLE',
      detail: String(e?.message ?? 'network error') });
  }

  // VERBATIM, ALWAYS, BOTH DIRECTIONS. Read as text before anything else looks at it: on
  // failure this body IS the artifact worth keeping (Intuit's Fault block names the real
  // cause), and on success it is the customer's own data, which must be re-readable without
  // re-querying their books. The caller writes it to a file; we never re-shape it first.
  const raw = await resp.text();

  if (!resp.ok) {
    const note = classifyFailure(resp.status);
    console.log('[TRACE:QBO] items — Intuit refused the read', {
      businessId, realmId, http_status: resp.status, points_at: note.points_at, raw_bytes: raw.length,
    });
    return res.status(502).json({
      ok: false, code: 'UPSTREAM_ERROR', realm_id: realmId, queried_at: queriedAt,
      http_status: resp.status, headline: note.headline, points_at: note.points_at,
      raw,   // ← the operator saves this; a 401 and a 403 are different problems and the body says which
    });
  }

  const parsed = parseItemList(raw);
  console.log('[TRACE:QBO] items — read OK', {
    businessId, realmId, http_status: resp.status,
    parsed_ok: parsed.ok, item_count: parsed.items.length, raw_bytes: raw.length,
  });

  // `parsed.ok:false` on a 200 is a real outcome, not a swallowed one: the read SUCCEEDED and
  // the body was not the shape we expected. It is returned as such — with the raw body — rather
  // than as an empty item list, because "no items in QuickBooks" and "we could not read the
  // answer" are different facts and rendering them the same is this platform's oldest defect.
  return res.status(200).json({
    ok: parsed.ok, realm_id: realmId, queried_at: queriedAt, http_status: resp.status,
    query: QBO_ITEM_QUERY,
    item_count: parsed.items.length, items: parsed.items, parse_error: parsed.parseError,
    stored: false,   // stated in the payload so no consumer has to assume it (nothing is persisted)
    raw,
  });
}

// ─── router (AC-5 dispatch) ───────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  const route = req.query._route as string;
  switch (route) {
    case 'auth-url': return handleAuthUrl(req, res);
    case 'callback': return handleCallback(req, res);
    case 'status':   return handleStatus(req, res);
    case 'items':    return handleItems(req, res);
    default:
      return res.status(400).json({ error: `Unknown QBO route: ${route || '(none)'}` });
  }
}
