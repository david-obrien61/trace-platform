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
 *   GET  /api/qbo/items     → _route=items      (READ-ONLY, paginated, complete)
 *   GET  /api/qbo/customers → _route=customers  (READ-ONLY, paginated, complete)
 *   GET  /api/qbo/invoices  → _route=invoices   (READ-ONLY, paginated, complete, ceiling-capped)
 */

import crypto from 'crypto';
import { callerCan } from '../../../shared/src/auth/callerPermission';
import { createClient } from '@supabase/supabase-js';
import { refreshQBToken } from '../../../shared/src/quickbooks/refresh';
import { readQBSecrets, writeQBSecrets, QBO_CONNECTION_COLUMNS } from '../../../shared/src/quickbooks/secrets';
import {
  type QboEntity, QBO_PAGE_SIZE, maxPagesFor, ceilingCheck,
  qboCountQuery, qboPageQuery, parseCount, pageIsLast, completeness, classifyFailure,
} from '../../../shared/src/quickbooks/qboRead';
import { parseItemList, summariseItems } from '../../../shared/src/quickbooks/itemList';
import { parseCustomerList, summariseCustomers, previewCustomers } from '../../../shared/src/quickbooks/customerList';
import { parseInvoiceList, summariseInvoices } from '../../../shared/src/quickbooks/invoiceList';
import { isPushHeld, QBO_PUSH_HOLD_ENV } from '../../../shared/src/quickbooks/pushHold';

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

    // 🔴 `push_held` IS WHAT MAKES THE HOLD A CHECK RATHER THAN A HOPE. The hold fails OPEN by
    // design (an unset var means no hold), so "is it actually on?" cannot be answered by trusting
    // that an env change propagated — and the only other way to find out would be to complete a
    // real order against a real company's books, which is the thing being prevented. This handler
    // runs in the SAME deployment as the push and reads the SAME variable through the SAME
    // predicate, so if this says held, the push holds. Read it; do not assume it.
    const pushHeld = isPushHeld(process.env[QBO_PUSH_HOLD_ENV], businessId);
    console.log('[TRACE:QBO] status', { businessId, connected: true, needsReconnect, pushHeld });

    return res.json({
      connected: true,
      realmId:   data.accounting_company_id,
      companyName: data.name,
      needsReconnect,
      push_held: pushHeld,
    });
  } catch {
    return res.json({ connected: false });
  }
}
// ─── entity reads (READ-ONLY): items · customers ──────────────────────────────
//
// PURPOSE: read a COMPLETE list of one QuickBooks entity from the connected company —
//   `Item` or `Customer` — and return it to the caller's screen. NOTHING IS STORED.
//   `Item` exists to answer one urgent question with real ids instead of an assumption: the
//   invoice push carries TWELVE hardcoded `ItemRef: { value: '1', name: 'Services' }`
//   literals, nothing has pushed to LAWNS yet, and the next completed checkout would land
//   every line — trees included — in their books as generic "Services", collapsing the
//   Sales-of-Nursery-Stock vs Services split. `Customer` exists so an import can be SIZED —
//   field coverage and the duplicate problem — before anybody designs a resolver for it.
//
// 🔴 THE COUNT IS ASKED FIRST AND A SHORTFALL IS A FAILURE, NOT A NOTE. #229 shipped one page
//   with no MAXRESULTS; Intuit's silent default returned exactly 100 rows carrying ids past
//   1127, and the ONLY reason anyone knew it was truncated is that a human read the ids. So
//   `select count(*)` runs BEFORE the loop, the loop pages at MAXRESULTS 1000, and a retrieved
//   total that does not equal the expected total returns `ok:false` / `INCOMPLETE`. Truncation
//   cannot hide behind a table again.
//
// 🔴 READ-ONLY AGAINST INTUIT, AND STRUCTURALLY SO. GETs only, and every query is built by
//   `qboCountQuery`/`qboPageQuery`, both asserted write-verb-free by their own test across
//   both entities and every page position. A QuickBooks record deleted still leaves a trail
//   the customer's accountant sees; there is no second real company to practise on. No write
//   belongs on this route, ever. (R-23 clause a.)
//
// 🔴 NOTHING IS PERSISTED (R-23 clause b). Their chart of items and their book of customers
//   are a customer's live data. Storing either is a later decision with its own ruling
//   (user_stories.md — "QuickBooks read-back + customer de-dup"); this pass proves the pipe
//   and holds nothing.
//
// 🔴 NO BODY AND NO PERSONAL FIELD IS EVER LOGGED (R-23 clause c's neighbour). The
//   [TRACE:QBO] lines below carry the status, the realm, page numbers and COUNTS — never a
//   name, an email, a phone, an address, a body, or the token. A serverless log is a place
//   personal data can persist for a long time without anyone deciding it should. The verbatim
//   bodies go to the operator's own download folder and nowhere else.
//
// WHY IT RIDES THIS ROUTER RATHER THAN THE INVOICE ENDPOINT: these are COMPANY-level reads
// with no order. The invoice endpoint is POST-only and its every path assumes an order_id
// exists. This file already holds the company-level `companyinfo` GET against the same base
// URL, already dispatches on _route, and already runs the settings:* gates. No new Vercel
// function is minted — api/ stays at 12 of 12 (§6 r11).

/** One page as it will be written to the capture file: verbatim body, plus its attribution. */
interface CapturedPage {
  query: string;
  start_position: number;
  http_status: number;
  /** Intuit's response text, UNTOUCHED. Never re-shaped, never parsed on the way in. */
  body: string;
}

/**
 * The shared front half of both reads: authority, connection, token. Returns either a live
 * token + realm, or the response it already sent.
 *
 * 🔴 CALLER AUTHORITY — MB_D-015. These routes read a customer's live accounting data under
 * the SERVICE KEY, which bypasses RLS entirely, so `bas_owner_all` never runs here and this
 * gate is the only thing standing between the request and another tenant's books.
 * `settings:read` — the same string /api/qbo/status takes, because this is the same class of
 * fact: the state of the business's accounting connection. It resolves the caller from the
 * BEARER TOKEN, never the body, so naming someone else's business_id gets you nothing.
 */
async function openQboRead(req: any, res: any, entity: QboEntity):
  Promise<{ realmId: string; token: string } | null> {
  const businessId = (req.query.business_id as string) || '';
  if (!businessId) { res.status(400).json({ error: 'business_id required' }); return null; }

  if (!(await callerCan(req.headers?.authorization, businessId, 'settings:read'))) {
    console.log('[TRACE:QBO] read REFUSED — caller lacks settings:read/owner', { businessId, entity });
    res.status(403).json({ error: `Not authorized to read QuickBooks ${entity} records for this business`, code: 'FORBIDDEN' });
    return null;
  }

  const db = supabase();
  const { data: business } = await db
    .from('businesses')
    .select(QBO_CONNECTION_COLUMNS)
    .eq('id', businessId)
    .maybeSingle();

  if (!business?.accounting_company_id) {
    console.log('[TRACE:QBO] read — no QuickBooks connection on this business', { businessId, entity });
    res.status(409).json({ error: 'QuickBooks is not connected for this business — connect it first.', code: 'NOT_CONNECTED' });
    return null;
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
    console.log('[TRACE:QBO] read — token refresh returned null, reconnect required', { businessId, entity, realmId });
    res.status(503).json({ error: 'qb_token_expired', code: 'RECONNECT_REQUIRED',
      detail: 'The QuickBooks token could not be refreshed. Reconnect QuickBooks from Settings, then try again.' });
    return null;
  }
  return { realmId, token };
}

/** One GET against `/query`. Returns the status and the VERBATIM text, always both. */
async function qboQuery(realmId: string, token: string, query: string):
  Promise<{ status: number; body: string } | { networkError: string }> {
  try {
    const resp = await fetch(
      `${QBO_API_BASE}/${realmId}/query?query=${encodeURIComponent(query)}&minorversion=65`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } },
    );
    // Read as text before anything else looks at it: on failure this body IS the artifact worth
    // keeping (Intuit's Fault block names the real cause), and on success it is the customer's
    // own data, which must be re-readable without re-querying their books.
    return { status: resp.status, body: await resp.text() };
  } catch (e: any) {
    return { networkError: String(e?.message ?? 'network error') };
  }
}

/**
 * COUNT, then PAGE until short, then prove the two agree.
 *
 * The parse of each page is passed in (`parsePage`) because unwrapping is per-entity; the walk
 * itself is identical for both and therefore written once (§6 r8).
 */
async function readAllPages(
  req: any, res: any, entity: QboEntity,
  parsePage: (raw: string) => { ok: boolean; count: number; parseError: string | null },
): Promise<{ rows: string[]; pages: CapturedPage[]; expected: number | null; queriedAt: string; realmId: string } | null> {
  const opened = await openQboRead(req, res, entity);
  if (!opened) return null;
  const { realmId, token } = opened;
  const queriedAt = new Date().toISOString();
  const pages: CapturedPage[] = [];

  // ── ① THE COUNT, FIRST, SO COMPLETENESS IS PROVABLE ───────────────────────
  const countQuery = qboCountQuery(entity);
  const countResp = await qboQuery(realmId, token, countQuery);
  if ('networkError' in countResp) {
    console.log('[TRACE:QBO] count — request to Intuit did not complete', { entity, realmId, message: countResp.networkError });
    res.status(502).json({ error: 'The request to QuickBooks did not complete.', code: 'UPSTREAM_UNREACHABLE', detail: countResp.networkError });
    return null;
  }
  pages.push({ query: countQuery, start_position: 0, http_status: countResp.status, body: countResp.body });
  if (countResp.status < 200 || countResp.status >= 300) {
    const note = classifyFailure(countResp.status);
    console.log('[TRACE:QBO] count — Intuit refused the read', { entity, realmId, http_status: countResp.status, points_at: note.points_at, raw_bytes: countResp.body.length });
    res.status(502).json({
      ok: false, code: 'UPSTREAM_ERROR', entity, realm_id: realmId, queried_at: queriedAt,
      http_status: countResp.status, headline: note.headline, points_at: note.points_at,
      capture: { entity, realm_id: realmId, queried_at: queriedAt, expected_total: null, retrieved_total: 0, pages },
    });
    return null;
  }
  const counted = parseCount(countResp.body);
  const expected = counted.total;
  console.log('[TRACE:QBO] count OK', { entity, realmId, expected, count_readable: counted.ok });

  // ── ①b THE VOLUME CEILING — A STOP, TAKEN BEFORE A SINGLE PAGE IS PULLED ──
  // 🔴 The count is already in hand here, which is the whole reason this can be a refusal rather
  // than a regret. An Invoice carries a nested Line[], so an unexpectedly large history is not
  // "a slower read", it is a download nobody chose. The number is reported so the decision goes
  // back to the operator instead of being made by a loop.
  const ceiling = ceilingCheck(entity, expected);
  if (!ceiling.allowed) {
    console.log('[TRACE:QBO] STOPPED — above the walk ceiling, nothing pulled', { entity, realmId, expected, ceiling: ceiling.ceiling });
    res.status(413).json({
      ok: false, code: 'TOO_MANY', entity, realm_id: realmId, queried_at: queriedAt,
      expected_total: expected, retrieved_total: 0, ceiling: ceiling.ceiling,
      headline: ceiling.headline, stored: false,
      capture: { entity, realm_id: realmId, queried_at: queriedAt, expected_total: expected, retrieved_total: 0, pages },
    });
    return null;
  }

  // ── ② THE LOOP ────────────────────────────────────────────────────────────
  // Bounded two ways: by the SHORT PAGE (the real stop), and by a page ceiling so a server that
  // keeps answering full pages can never spin this forever. The page ceiling is PER-ENTITY, so
  // the volume cap above still holds when the count came back unreadable and there was no number
  // to refuse.
  const pageCeiling = maxPagesFor(entity);
  const rows: string[] = [];
  let retrieved = 0;
  let start = 1;
  for (let page = 1; page <= pageCeiling; page++) {
    const q = qboPageQuery(entity, start);
    const resp = await qboQuery(realmId, token, q);
    if ('networkError' in resp) {
      console.log('[TRACE:QBO] page — request to Intuit did not complete', { entity, realmId, page, retrieved, message: resp.networkError });
      res.status(502).json({
        ok: false, code: 'UPSTREAM_UNREACHABLE', entity, realm_id: realmId, queried_at: queriedAt,
        headline: `The read stopped part-way: page ${page} did not complete after ${retrieved} rows. What was retrieved is in the capture file and is NOT the whole list.`,
        detail: resp.networkError,
        capture: { entity, realm_id: realmId, queried_at: queriedAt, expected_total: expected, retrieved_total: retrieved, pages },
      });
      return null;
    }
    pages.push({ query: q, start_position: start, http_status: resp.status, body: resp.body });

    if (resp.status < 200 || resp.status >= 300) {
      const note = classifyFailure(resp.status);
      console.log('[TRACE:QBO] page — Intuit refused', { entity, realmId, page, http_status: resp.status, points_at: note.points_at, retrieved });
      res.status(502).json({
        ok: false, code: 'UPSTREAM_ERROR', entity, realm_id: realmId, queried_at: queriedAt,
        http_status: resp.status, headline: note.headline, points_at: note.points_at,
        capture: { entity, realm_id: realmId, queried_at: queriedAt, expected_total: expected, retrieved_total: retrieved, pages },
      });
      return null;
    }

    const parsed = parsePage(resp.body);
    if (!parsed.ok) {
      // A 200 whose body we could not read is a real outcome, not a swallowed one — and it is
      // NOT an empty page. Returning it as "the list ended here" is the exact defect this whole
      // read exists to refuse.
      console.log('[TRACE:QBO] page — 200 but unreadable body', { entity, realmId, page, retrieved, parse_error: parsed.parseError });
      res.status(502).json({
        ok: false, code: 'UNREADABLE_PAGE', entity, realm_id: realmId, queried_at: queriedAt,
        headline: `Page ${page} came back with HTTP 200 but could not be read (${parsed.parseError}). This is NOT an empty page and the list is NOT complete.`,
        capture: { entity, realm_id: realmId, queried_at: queriedAt, expected_total: expected, retrieved_total: retrieved, pages },
      });
      return null;
    }

    rows.push(resp.body);
    retrieved += parsed.count;
    console.log('[TRACE:QBO] page OK', { entity, realmId, page, start_position: start, rows_in_page: parsed.count, retrieved, expected });

    if (pageIsLast(parsed.count, QBO_PAGE_SIZE)) break;
    start += parsed.count;
  }

  return { rows, pages, expected, queriedAt, realmId };
}

/** Shared tail: prove expected == retrieved, and refuse if not. Returns the capture envelope. */
function completenessOrRefuse(
  res: any, entity: QboEntity, realmId: string, queriedAt: string,
  expected: number | null, retrieved: number, pages: CapturedPage[],
): { capture: Record<string, unknown>; verdict: ReturnType<typeof completeness> } | null {
  const verdict = completeness(expected, retrieved);
  const capture = {
    entity, realm_id: realmId, queried_at: queriedAt,
    expected_total: expected, retrieved_total: retrieved,
    complete: verdict.complete, pages,
  };
  if (!verdict.complete) {
    // 🔴 A FAILURE, NOT A NOTE. The whole build exists because a partial list rendered as a
    // complete one. The capture still goes back so the operator keeps what was retrieved.
    console.log('[TRACE:QBO] INCOMPLETE — refusing to present a partial list as a list', { entity, realmId, expected, retrieved });
    res.status(502).json({
      ok: false, code: 'INCOMPLETE', entity, realm_id: realmId, queried_at: queriedAt,
      expected_total: expected, retrieved_total: retrieved, headline: verdict.headline,
      stored: false, capture,
    });
    return null;
  }
  return { capture, verdict };
}

async function handleItems(req: any, res: any) {
  const walked = await readAllPages(req, res, 'Item', raw => {
    const p = parseItemList(raw);
    return { ok: p.ok, count: p.items.length, parseError: p.parseError };
  });
  if (!walked) return;

  const items = walked.rows.flatMap(raw => parseItemList(raw).items);
  const done = completenessOrRefuse(res, 'Item', walked.realmId, walked.queriedAt, walked.expected, items.length, walked.pages);
  if (!done) return;

  const breakdown = summariseItems(items);
  console.log('[TRACE:QBO] items — read COMPLETE', {
    expected: walked.expected, retrieved: items.length,
    categories: breakdown.categories, sellable: breakdown.sellable,
    has_item_id_1: breakdown.itemId1 !== null, income_accounts: breakdown.byIncomeAccount.length,
  });

  return res.status(200).json({
    ok: true, entity: 'Item', realm_id: walked.realmId, queried_at: walked.queriedAt,
    expected_total: walked.expected, retrieved_total: items.length, complete: true,
    pages_fetched: walked.pages.length - 1,
    items, breakdown,
    stored: false,   // stated in the payload so no consumer has to assume it (nothing is persisted)
    capture: done.capture,
  });
}

// 🔴 THE CUSTOMER RESPONSE IS DELIBERATELY NOT THE ITEM RESPONSE. It carries the SUMMARY and a
// five-row PREVIEW — never the 1,900 parsed records. The complete data reaches the operator
// exactly once, as the verbatim bodies inside `capture`, which the browser writes straight to a
// file. A screen that paints 1,900 real people is a screen someone screenshots.
async function handleCustomers(req: any, res: any) {
  const walked = await readAllPages(req, res, 'Customer', raw => {
    const p = parseCustomerList(raw);
    return { ok: p.ok, count: p.customers.length, parseError: p.parseError };
  });
  if (!walked) return;

  const customers = walked.rows.flatMap(raw => parseCustomerList(raw).customers);
  const done = completenessOrRefuse(res, 'Customer', walked.realmId, walked.queriedAt, walked.expected, customers.length, walked.pages);
  if (!done) return;

  const breakdown = summariseCustomers(customers);
  // Counts only. No name, no email, no phone, no address — not here, not anywhere in this file.
  console.log('[TRACE:QBO] customers — read COMPLETE', {
    expected: walked.expected, retrieved: customers.length,
    with_email: breakdown.withEmail, with_phone: breakdown.withPhone, with_address: breakdown.withAddress,
    shared_emails: breakdown.byEmail.sharedValues, shared_phones: breakdown.byPhone.sharedValues,
  });

  return res.status(200).json({
    ok: true, entity: 'Customer', realm_id: walked.realmId, queried_at: walked.queriedAt,
    expected_total: walked.expected, retrieved_total: customers.length, complete: true,
    pages_fetched: walked.pages.length - 1,
    breakdown, preview: previewCustomers(customers),
    stored: false,
    capture: done.capture,
  });
}

// 🔴 THE INVOICE RESPONSE IS SHAPED LIKE THE CUSTOMER ONE, NOT THE ITEM ONE, AND FOR A STRONGER
// REASON. An invoice names the human who bought and says what they paid, so the parsed records
// NEVER leave this function: the payload carries only the breakdown — dates, counts, quantities,
// discount verdicts. There is not even a preview, because there is no shape here worth showing
// that a summary does not already carry. The complete data reaches the operator exactly once, as
// the verbatim bodies inside `capture`, which the browser writes straight to a file (R-23/R-24).
async function handleInvoices(req: any, res: any) {
  const walked = await readAllPages(req, res, 'Invoice', raw => {
    const p = parseInvoiceList(raw);
    return { ok: p.ok, count: p.invoices.length, parseError: p.parseError };
  });
  if (!walked) return;

  const invoices = walked.rows.flatMap(raw => parseInvoiceList(raw).invoices);
  const done = completenessOrRefuse(res, 'Invoice', walked.realmId, walked.queriedAt, walked.expected, invoices.length, walked.pages);
  if (!done) return;

  const breakdown = summariseInvoices(invoices);
  // Counts and dates only. `QboInvoiceRow` has no customer NAME field at all, so nothing
  // personal can reach this line even by accident (R-24 clause c).
  console.log('[TRACE:QBO] invoices — read COMPLETE', {
    expected: walked.expected, retrieved: invoices.length,
    earliest: breakdown.dateRange.earliest, latest: breakdown.dateRange.latest,
    months_spanned: breakdown.dateRange.monthsSpanned, undated: breakdown.dateRange.undated,
    lines: breakdown.linesTotal, lines_with_item: breakdown.linesWithItemRef,
    lines_on_item_1: breakdown.linesOnItemId1, distinct_items: breakdown.distinctItemsSold,
    total_qty: breakdown.totalQtySold, distinct_customers: breakdown.distinctCustomers,
  });

  return res.status(200).json({
    ok: true, entity: 'Invoice', realm_id: walked.realmId, queried_at: walked.queriedAt,
    expected_total: walked.expected, retrieved_total: invoices.length, complete: true,
    pages_fetched: walked.pages.length - 1,
    breakdown,
    stored: false,
    capture: done.capture,
  });
}

// ─── router (AC-5 dispatch) ───────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  const route = req.query._route as string;
  switch (route) {
    case 'auth-url':  return handleAuthUrl(req, res);
    case 'callback':  return handleCallback(req, res);
    case 'status':    return handleStatus(req, res);
    case 'items':     return handleItems(req, res);
    case 'customers': return handleCustomers(req, res);
    case 'invoices':  return handleInvoices(req, res);
    default:
      return res.status(400).json({ error: `Unknown QBO route: ${route || '(none)'}` });
  }
}
