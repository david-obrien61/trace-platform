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
 *   GET  /api/qbo/deliveries/preview → _route=deliveries-preview (READ-ONLY — plans, writes nothing)
 *   POST /api/qbo/deliveries/ingest  → _route=deliveries-ingest  (WRITES customers + deliveries ONLY)
 *   GET  /api/qbo/orders/preview     → _route=orders-preview  (READ-ONLY — plans, writes nothing)
 *   POST /api/qbo/orders/ingest      → _route=orders-ingest   (WRITES orders + order_items + deliveries.order_id ONLY)
 *   GET  /api/qbo/items/preview      → _route=items-preview   (READ-ONLY — plans the catalogue import, writes nothing)
 *   POST /api/qbo/items/ingest       → _route=items-ingest    (WRITES business_inventory ONLY — creates + retires)
 *   POST /api/qbo/items/undo         → _route=items-undo      (DELETES this run's rows, un-retires what it hid)
 *   GET  /api/qbo/customers/preview  → _route=customers-preview (READ-ONLY — plans the customer import, writes nothing)
 *   POST /api/qbo/customers/ingest   → _route=customers-ingest  (WRITES `customers` ONLY — creates, and reconciles tax exemption)
 *   POST /api/qbo/customers/undo     → _route=customers-undo    (DELETES this run's customers; RESTRICT-aware, reports what it could not remove)
 */

import crypto from 'crypto';
import { callerCan, callerIsBusinessOwner } from '../../../shared/src/auth/callerPermission';
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
import { parseShipmentList } from '../../../shared/src/quickbooks/shipmentIngest';
import { previewDeliveryIngest, commitDeliveryIngest } from '../../../shared/src/quickbooks/deliveryIngestWriter';
import { previewOrderIngest, commitOrderIngest } from '../../../shared/src/quickbooks/historyOrderWriter';
import { isPushHeld, QBO_PUSH_HOLD_ENV } from '../../../shared/src/quickbooks/pushHold';
import { pushPermitted } from '../../../shared/src/business-logic/testMode';
import { previewItemImport, commitItemImport, undoItemImport } from '../../../shared/src/quickbooks/itemImportWriter';
import { adaptCustomers } from '../../../shared/src/quickbooks/qboCustomerAdapter';
import { previewCustomerImport, commitCustomerImport, undoCustomerImport } from '../../../shared/src/quickbooks/customerImportWriter';
import { randomUUID } from 'crypto';

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
    // 🔴 THE SECOND SWITCH, REPORTED 2026-09-06. `push_held` alone could not answer "are writes
    // off for this business" — it is the OPERATOR's env hold, while `qbo_writes_enabled` is the
    // OWNER's own decision and is what `submit.ts:856` actually gates the push on. Reporting only
    // the first meant `push_held: false` read as "you are live" for a business whose owner had
    // writes switched off. `writes_permitted` is the ANSWER, computed through the one shared
    // predicate so this endpoint and the push cannot disagree about it.
    const writesEnabled = (data as { qbo_writes_enabled?: boolean }).qbo_writes_enabled ?? null;
    const permitted = pushPermitted({ writesEnabled, platformHeld: pushHeld });
    console.log('[TRACE:QBO] status', { businessId, connected: true, needsReconnect, pushHeld, writesEnabled, permitted });

    return res.json({
      connected: true,
      realmId:   data.accounting_company_id,
      companyName: data.name,
      needsReconnect,
      push_held: pushHeld,
      writes_enabled: writesEnabled,
      // 🔴 THE ONE AN OPERATOR SHOULD READ. false = nothing can reach their books = the catalogue
      // import's undo is OPEN. It is not a third switch; it is the two above, AND-ed once.
      writes_permitted: permitted,
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

// ─── ShipDate → deliveries ────────────────────────────────────────────────────
//
// 🔴 WHY THESE TWO RIDE THIS ROUTER. `api/` is at 12 OF 12 (§6 r11) and function #13 does not
// error — it makes the whole deploy fail SILENTLY while Vercel keeps serving the last-good
// bundle. This file already holds the paginated Invoice walk, the token refresh and the
// `settings:*` gates, so both branches are additions to an existing function and the count is
// unchanged. Nothing was minted and nothing needed to be.
//
// 🔴 AND WHY THE INVOICE WALK IS REUSED RATHER THAN NARROWED. `ShipDate` is not a filterable
// field on Intuit's Invoice query, so "just ask for the future ones" is not available; the
// honest alternative is the COMPLETE walk that already counts-then-pages and refuses a shortfall
// (R-24), then a filter we can prove. That is what makes "18 of 1,469" a measurement rather than
// a hope — the denominator is on the screen beside the numerator.

/** The operator's own local date, `YYYY-MM-DD`. Falls back to UTC when absent or malformed. */
function todayFor(req: any): string {
  const given = String(req.query?.today ?? '');
  // Validated, never trusted: this string decides which invoices count as future, so a junk
  // value must fall back rather than silently select nothing.
  if (/^\d{4}-\d{2}-\d{2}$/.test(given)) return given;
  return new Date().toISOString().slice(0, 10);
}

/** The complete invoice walk, parsed for SHIPPING rather than for analysis. Shared by both. */
async function walkShipments(req: any, res: any) {
  const walked = await readAllPages(req, res, 'Invoice', raw => {
    const p = parseShipmentList(raw);
    return { ok: p.ok, count: p.shipments.length, parseError: p.parseError };
  });
  if (!walked) return null;
  const shipments = walked.rows.flatMap(raw => parseShipmentList(raw).shipments);
  const done = completenessOrRefuse(res, 'Invoice', walked.realmId, walked.queriedAt, walked.expected, shipments.length, walked.pages);
  if (!done) return null;
  return { shipments, realmId: walked.realmId, queriedAt: walked.queriedAt };
}

// PREVIEW — reads Intuit, reads our own tables, decides everything, WRITES NOTHING.
// Gated by `openQboRead`'s `settings:read` (inside walkShipments) plus `deliveries:read`: this
// response carries real customer names, streets and phone numbers, which the analytical invoice
// read deliberately never does. Whoever sees it must be someone allowed to see the schedule.
async function handleDeliveriesPreview(req: any, res: any) {
  const businessId = (req.query.business_id as string) || '';
  if (!businessId) return res.status(400).json({ error: 'business_id required' });
  if (!(await callerCan(req.headers?.authorization, businessId, 'deliveries:read'))) {
    console.log('[TRACE:QBDELIVERY] preview REFUSED — caller lacks deliveries:read', { businessId });
    return res.status(403).json({ error: 'Not authorized to read this business\'s delivery schedule', code: 'FORBIDDEN' });
  }
  const walked = await walkShipments(req, res);
  if (!walked) return;
  try {
    const report = await previewDeliveryIngest(supabase(), businessId, walked.shipments, todayFor(req));
    return res.status(200).json({ ...report, realm_id: walked.realmId, queried_at: walked.queriedAt, committed: false });
  } catch (e: any) {
    console.log('[TRACE:QBDELIVERY] preview failed', { businessId, message: e?.message });
    return res.status(500).json({ error: `Could not plan the delivery ingest: ${e?.message ?? 'unknown error'}` });
  }
}

// INGEST — the same plan, then the write. Two verbs are required and BOTH are enforced verbs
// (`status: enforced` in the manifest, not declared-unwired — R-31), because this genuinely does
// both things: it creates customers and it creates deliveries.
/**
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * 🔴 IMPORTING A COMPANY'S BOOKS IS AN OWNER ACT (David, 2026-09-03).
 * ══════════════════════════════════════════════════════════════════════════════════════════
 * David's ruling, verbatim: *"INGESTING A CUSTOMER'S BOOKS INTO THE SYSTEM IS AN OWNER ACT,
 * the same class as the QuickBooks writes switch, which is already owner-gated.
 * `deliveries:create` and `orders:create` are the wrong gates for it — those are for taking an
 * order, not for importing a company."*
 *
 * 🔴 WHY THE VERB-PERMISSIONS WERE THE WRONG GATE, MEASURED RATHER THAN ASSUMED. The MANAGER
 * floor (`20260727_align_floor_to_bundles.sql:48`) holds **`orders:create`** — so the order
 * ingest, which writes a whole company's sales history, was reachable by a manager under a
 * permission that exists so she can ring up ONE sale. ⚠️ The delivery ingest happened to be
 * closed, because the floor grants `deliveries:read`/`:update` and NOT `deliveries:create` —
 * **closed by an accident of bundle composition, not by anybody's decision**, which is exactly
 * the kind of protection that disappears the next time a bundle is edited.
 *
 * ⚠️ THIS IS AN AND, NOT AN OR. The verb permission still has to hold — an owner who somehow
 * lacks `orders:create` is still refused by it. Owner-ness is an ADDITIONAL requirement for the
 * import class, not a bypass of the existing one.
 *
 * ⚠️ AND IT IS NOT `settings:update`, WHICH WOULD HAVE LOOKED RIGHT AND BEEN WRONG: the manager
 * floor holds that too. The only gate that means *the owner* is `businesses.owner_id`, which is
 * what `callerIsBusinessOwner` compares — and it is the same authority the writes switch rests
 * on (`businesses_owner_update`), so the two controls are now one class rather than two.
 */
async function refuseUnlessOwner(auth: string | undefined, businessId: string, area: string, res: any): Promise<boolean> {
  if (await callerIsBusinessOwner(auth, businessId)) return true;
  console.log(`[TRACE:${area}] ingest REFUSED — importing a company's books is an owner act`, { businessId });
  res.status(403).json({
    error: 'Importing records from QuickBooks is done by the business owner. Ask them to run this import.',
    code: 'OWNER_ONLY',
  });
  return false;
}

async function handleDeliveriesIngest(req: any, res: any) {
  const businessId = (req.query.business_id as string) || '';
  if (!businessId) return res.status(400).json({ error: 'business_id required' });
  const auth = req.headers?.authorization;
  if (!(await refuseUnlessOwner(auth, businessId, 'QBDELIVERY', res))) return;
  if (!(await callerCan(auth, businessId, 'deliveries:create'))) {
    console.log('[TRACE:QBDELIVERY] ingest REFUSED — caller lacks deliveries:create', { businessId });
    return res.status(403).json({ error: 'Not authorized to schedule deliveries for this business', code: 'FORBIDDEN' });
  }
  if (!(await callerCan(auth, businessId, 'customers:create'))) {
    console.log('[TRACE:QBDELIVERY] ingest REFUSED — caller lacks customers:create', { businessId });
    return res.status(403).json({ error: 'This ingest creates customer records, which you are not authorized to do', code: 'FORBIDDEN' });
  }
  const walked = await walkShipments(req, res);
  if (!walked) return;
  try {
    const report = await commitDeliveryIngest(supabase(), businessId, walked.shipments, todayFor(req));
    return res.status(report.ok ? 200 : 409).json({ ...report, realm_id: walked.realmId, queried_at: walked.queriedAt, committed: report.ok });
  } catch (e: any) {
    console.log('[TRACE:QBDELIVERY] ingest failed', { businessId, message: e?.message });
    return res.status(500).json({ error: `The delivery ingest failed: ${e?.message ?? 'unknown error'}` });
  }
}

// ─── the load — invoice lines → history orders ────────────────────────────────
//
// 🔴 WHY THESE TWO ALSO RIDE THIS ROUTER, AND WHY NO INTUIT SURFACE IS NEW. `api/` is at
// 12 OF 12 (§6 r11) and function #13 does not error — it makes the whole deploy fail SILENTLY
// while Vercel keeps serving the last-good bundle. These are branches on a function that
// already exists. And the READ is the one `walkShipments` already performs: `Invoice.Line[]`
// arrives nested inside the same 1,469 rows the delivery ingest walks, so this is the same
// invoices read one level deeper — no new Intuit endpoint, no second token, no extra call.
//
// 🔴 THE PERMISSIONS ARE `orders:*`, NOT `deliveries:*`, AND THAT IS A DERIVATION FROM WHAT
// THE CODE WRITES RATHER THAN FROM WHAT THE SCREEN IS CALLED (the 2026-07-31 ruling). This
// pass writes `orders` and `order_items`; it touches `deliveries` only to set `order_id`, a
// field on a row that already exists. `orders:create` is the act; `orders:read` gates the
// preview, which carries what every customer bought and what they paid.

async function handleOrdersPreview(req: any, res: any) {
  const businessId = (req.query.business_id as string) || '';
  if (!businessId) return res.status(400).json({ error: 'business_id required' });
  if (!(await callerCan(req.headers?.authorization, businessId, 'orders:read'))) {
    console.log('[TRACE:QBORDERS] preview REFUSED — caller lacks orders:read', { businessId });
    return res.status(403).json({ error: 'Not authorized to read this business\'s orders', code: 'FORBIDDEN' });
  }
  const walked = await walkShipments(req, res);
  if (!walked) return;
  try {
    const report = await previewOrderIngest(supabase(), businessId, walked.shipments);
    return res.status(200).json({ ...report, realm_id: walked.realmId, queried_at: walked.queriedAt, committed: false });
  } catch (e: any) {
    console.log('[TRACE:QBORDERS] preview failed', { businessId, message: e?.message });
    return res.status(500).json({ error: `Could not plan the order ingest: ${e?.message ?? 'unknown error'}` });
  }
}

async function handleOrdersIngest(req: any, res: any) {
  const businessId = (req.query.business_id as string) || '';
  if (!businessId) return res.status(400).json({ error: 'business_id required' });
  const auth = req.headers?.authorization;
  if (!(await refuseUnlessOwner(auth, businessId, 'QBORDERS', res))) return;
  if (!(await callerCan(auth, businessId, 'orders:create'))) {
    console.log('[TRACE:QBORDERS] ingest REFUSED — caller lacks orders:create', { businessId });
    return res.status(403).json({ error: 'Not authorized to create orders for this business', code: 'FORBIDDEN' });
  }
  const walked = await walkShipments(req, res);
  if (!walked) return;
  try {
    const report = await commitOrderIngest(supabase(), businessId, walked.shipments);
    return res.status(report.ok ? 200 : 409).json({ ...report, realm_id: walked.realmId, queried_at: walked.queriedAt, committed: report.ok });
  } catch (e: any) {
    console.log('[TRACE:QBORDERS] ingest failed', { businessId, message: e?.message });
    return res.status(500).json({ error: `The order ingest failed: ${e?.message ?? 'unknown error'}` });
  }
}

// ─── the catalogue — QuickBooks items → business_inventory ────────────────────
//
// 🔴 THESE THREE RIDE THIS ROUTER AND NO NEW VERCEL FUNCTION IS CREATED. `api/` is at 12 OF 12
// (§6 r11) and function #13 does not error — it makes the whole deploy fail SILENTLY while Vercel
// keeps serving the last-good bundle. These are branches on a function that already exists, and
// the READ is the one `handleItems` already performs.
//
// 🔴 ALL THREE ARE OWNER-GATED (R-80). *"INGESTING A CUSTOMER'S BOOKS INTO THE SYSTEM IS AN OWNER
// ACT, the same class as the QuickBooks writes switch, which is already owner-gated."* The undo
// is gated identically and for a stronger reason: it DELETES rows.
//
// ⚠️ THE VERB PERMISSION STILL HAS TO HOLD — an AND, not an OR, exactly as the other two ingests
// do it. `inventory:read` for the preview; `inventory:create` for the write; and the undo needs
// BOTH `inventory:create` and `inventory:delete`, because deleting a catalogue is what it does.

/** Walk the complete Item list, or refuse. Same read the items endpoint performs. */
async function walkItems(req: any, res: any) {
  const walked = await readAllPages(req, res, 'Item', raw => {
    const p = parseItemList(raw);
    return { ok: p.ok, count: p.items.length, parseError: p.parseError };
  });
  if (!walked) return null;
  const items = walked.rows.flatMap(raw => parseItemList(raw).items);
  const done = completenessOrRefuse(res, 'Item', walked.realmId, walked.queriedAt, walked.expected, items.length, walked.pages);
  if (!done) return null;
  return { items, realmId: walked.realmId, queriedAt: walked.queriedAt };
}

async function handleItemsPreview(req: any, res: any) {
  const businessId = (req.query.business_id as string) || '';
  if (!businessId) return res.status(400).json({ error: 'business_id required' });
  if (!(await callerCan(req.headers?.authorization, businessId, 'inventory:read'))) {
    console.log('[TRACE:QBITEMS] preview REFUSED — caller lacks inventory:read', { businessId });
    return res.status(403).json({ error: 'Not authorized to read this business\'s catalogue', code: 'FORBIDDEN' });
  }
  const walked = await walkItems(req, res);
  if (!walked) return;
  try {
    const report = await previewItemImport(supabase(), businessId, walked.items);
    return res.status(200).json({ ...report, realm_id: walked.realmId, queried_at: walked.queriedAt, committed: false });
  } catch (e: any) {
    console.log('[TRACE:QBITEMS] preview failed', { businessId, message: e?.message });
    return res.status(500).json({ error: `Could not plan the catalogue import: ${e?.message ?? 'unknown error'}` });
  }
}

async function handleItemsIngest(req: any, res: any) {
  const businessId = (req.query.business_id as string) || '';
  if (!businessId) return res.status(400).json({ error: 'business_id required' });
  const auth = req.headers?.authorization;
  if (!(await refuseUnlessOwner(auth, businessId, 'QBITEMS', res))) return;
  if (!(await callerCan(auth, businessId, 'inventory:create'))) {
    console.log('[TRACE:QBITEMS] ingest REFUSED — caller lacks inventory:create', { businessId });
    return res.status(403).json({ error: 'Not authorized to create inventory for this business', code: 'FORBIDDEN' });
  }
  const walked = await walkItems(req, res);
  if (!walked) return;
  // 🔴 THE RUN ID IS MINTED SERVER-SIDE. A client-supplied one would let a caller stamp this run
  // with an EARLIER run's id — and the undo is keyed on it, so one undo would then delete two
  // runs' rows, including rows the owner had decided to keep.
  const runId = randomUUID();
  try {
    const report = await commitItemImport(supabase(), businessId, walked.items, runId, process.env[QBO_PUSH_HOLD_ENV]);
    return res.status(report.committed ? 200 : 409).json({ ...report, realm_id: walked.realmId, queried_at: walked.queriedAt });
  } catch (e: any) {
    console.log('[TRACE:QBITEMS] ingest failed', { businessId, runId, message: e?.message });
    return res.status(500).json({ error: `The catalogue import failed: ${e?.message ?? 'unknown error'}`, run_id: runId });
  }
}

async function handleItemsUndo(req: any, res: any) {
  const businessId = (req.query.business_id as string) || '';
  const runId = (req.query.run_id as string) || '';
  if (!businessId) return res.status(400).json({ error: 'business_id required' });
  // A blank run id must NEVER be treated as "undo everything". It is a bad request.
  if (!runId) return res.status(400).json({ error: 'run_id required — an undo names exactly one import run' });
  const auth = req.headers?.authorization;
  if (!(await refuseUnlessOwner(auth, businessId, 'QBITEMS', res))) return;
  if (!(await callerCan(auth, businessId, 'inventory:create'))
      || !(await callerCan(auth, businessId, 'inventory:delete'))) {
    console.log('[TRACE:QBITEMS] undo REFUSED — caller lacks inventory:create + inventory:delete', { businessId });
    return res.status(403).json({ error: 'Not authorized to remove inventory for this business', code: 'FORBIDDEN' });
  }
  try {
    const report = await undoItemImport(supabase(), businessId, runId, process.env[QBO_PUSH_HOLD_ENV]);
    // 409 for a refusal (writes are on) — a distinct code from a 500, because nothing went wrong.
    return res.status(report.ok ? 200 : (report.refused ? 409 : 500)).json(report);
  } catch (e: any) {
    console.log('[TRACE:QBITEMS] undo failed', { businessId, runId, message: e?.message });
    return res.status(500).json({ error: `The undo failed: ${e?.message ?? 'unknown error'}` });
  }
}

// ─── customer import (READS the customer list, WRITES `customers` only) ───────

/**
 * Walk the whole customer list and hand back the VERBATIM page bodies.
 *
 * 🔴 THE RAW BODIES, NOT `parseCustomerList`'s ROWS. That parser is the READ screen's, and its
 * row is deliberately reduced to seven fields for privacy — it drops `Taxable`, `ResaleNum` and
 * `Notes` and flattens the address into one display string, so it cannot fill an address column
 * or answer the exemption question. The import adapter parses the same bodies for its own shape.
 * Completeness is still proven with the read's own parser, so a truncated walk is refused here
 * exactly as it is on the read path.
 */
async function walkCustomersForImport(req: any, res: any) {
  const walked = await readAllPages(req, res, 'Customer', raw => {
    const p = parseCustomerList(raw);
    return { ok: p.ok, count: p.customers.length, parseError: p.parseError };
  });
  if (!walked) return null;
  const counted = walked.rows.flatMap(raw => parseCustomerList(raw).customers).length;
  const done = completenessOrRefuse(res, 'Customer', walked.realmId, walked.queriedAt, walked.expected, counted, walked.pages);
  if (!done) return null;
  return { bodies: walked.rows, realmId: walked.realmId, queriedAt: walked.queriedAt };
}

async function handleCustomersPreview(req: any, res: any) {
  const businessId = (req.query.business_id as string) || '';
  if (!businessId) return res.status(400).json({ error: 'business_id required' });
  if (!(await callerCan(req.headers?.authorization, businessId, 'customers:read'))) {
    console.log('[TRACE:CUSTIMPORT] preview REFUSED — caller lacks customers:read', { businessId });
    return res.status(403).json({ error: 'Not authorized to read this business\'s customers', code: 'FORBIDDEN' });
  }
  const walked = await walkCustomersForImport(req, res);
  if (!walked) return;
  try {
    const report = await previewCustomerImport(supabase(), businessId, adaptCustomers(walked.bodies));
    return res.status(200).json({ ...report, realm_id: walked.realmId, queried_at: walked.queriedAt, committed: false });
  } catch (e: any) {
    console.log('[TRACE:CUSTIMPORT] preview failed', { businessId, message: e?.message });
    return res.status(500).json({ error: `Could not plan the customer import: ${e?.message ?? 'unknown error'}` });
  }
}

async function handleCustomersIngest(req: any, res: any) {
  const businessId = (req.query.business_id as string) || '';
  if (!businessId) return res.status(400).json({ error: 'business_id required' });
  const auth = req.headers?.authorization;
  // R-80: importing a customer's books is an OWNER act, and it is an AND — the verb still has to
  // hold. `customers:create` alone would admit the MANAGER floor, which is R-80's own measurement.
  if (!(await refuseUnlessOwner(auth, businessId, 'CUSTIMPORT', res))) return;
  // BOTH verbs, because the run does both things: it CREATES the new customers and UPDATES the
  // exemption on ones already here. Asking only for create would be a gate narrower than the write.
  if (!(await callerCan(auth, businessId, 'customers:create'))
      || !(await callerCan(auth, businessId, 'customers:update'))) {
    console.log('[TRACE:CUSTIMPORT] ingest REFUSED — caller lacks customers:create + customers:update', { businessId });
    return res.status(403).json({ error: 'Not authorized to create or update customers for this business', code: 'FORBIDDEN' });
  }
  const walked = await walkCustomersForImport(req, res);
  if (!walked) return;
  // 🔴 THE RUN ID IS MINTED SERVER-SIDE. A client-supplied one would let a caller stamp this run
  // with an EARLIER run's id, and anything keyed on it would then act on two runs at once.
  const runId = randomUUID();
  try {
    const report = await commitCustomerImport(supabase(), businessId, adaptCustomers(walked.bodies), runId);
    return res.status(200).json({ ...report, realm_id: walked.realmId, queried_at: walked.queriedAt });
  } catch (e: any) {
    console.log('[TRACE:CUSTIMPORT] ingest failed', { businessId, runId, message: e?.message });
    return res.status(500).json({ error: `The customer import failed: ${e?.message ?? 'unknown error'}`, run_id: runId });
  }
}

async function handleCustomersUndo(req: any, res: any) {
  const businessId = (req.query.business_id as string) || '';
  const runId = (req.query.run_id as string) || '';
  if (!businessId) return res.status(400).json({ error: 'business_id required' });
  // A blank run id must NEVER be treated as "undo everything". It is a bad request.
  if (!runId) return res.status(400).json({ error: 'run_id required — an undo names exactly one import run' });
  const auth = req.headers?.authorization;
  if (!(await refuseUnlessOwner(auth, businessId, 'CUSTIMPORT', res))) return;
  // 🔴 GATED ON `customers:create` + `customers:update`, NOT ON A DELETE VERB, AND THAT IS
  // DELIBERATE. `customers:delete` is one of the FIVE UNMINTABLE DELETES (permissionManifest R2 /
  // A3: it "must be UNFINDABLE by grep in this file"). David answered R2's FK-cascade condition on
  // 2026-09-06 — `orders_customer_id_fkey` is ON DELETE RESTRICT — and ruled that the undo may be
  // wired; he did NOT rule that a general customer-delete capability should exist, and minting one
  // here would assert a protection boundary nobody decided on. The authority that created these
  // rows is the authority that un-creates them, and the OWNER gate above is the real protection
  // (R-80). This endpoint can only ever remove rows carrying its own run id.
  if (!(await callerCan(auth, businessId, 'customers:create'))
      || !(await callerCan(auth, businessId, 'customers:update'))) {
    console.log('[TRACE:CUSTIMPORT] undo REFUSED — caller lacks customers:create + customers:update', { businessId });
    return res.status(403).json({ error: 'Not authorized to undo a customer import for this business', code: 'FORBIDDEN' });
  }
  try {
    const report = await undoCustomerImport(supabase(), businessId, runId, process.env[QBO_PUSH_HOLD_ENV]);
    // 200 when everything that COULD go went — including a partial undo blocked only by real
    // orders, which is a success. 409 for the wholesale refusal (writes are on).
    return res.status(report.ok ? 200 : 409).json(report);
  } catch (e: any) {
    console.log('[TRACE:CUSTIMPORT] undo failed', { businessId, runId, message: e?.message });
    return res.status(500).json({ error: `The undo failed: ${e?.message ?? 'unknown error'}` });
  }
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
    case 'deliveries-preview': return handleDeliveriesPreview(req, res);
    case 'deliveries-ingest':  return handleDeliveriesIngest(req, res);
    case 'orders-preview':     return handleOrdersPreview(req, res);
    case 'orders-ingest':      return handleOrdersIngest(req, res);
    case 'items-preview':      return handleItemsPreview(req, res);
    case 'items-ingest':       return handleItemsIngest(req, res);
    case 'items-undo':         return handleItemsUndo(req, res);
    case 'customers-preview':  return handleCustomersPreview(req, res);
    case 'customers-ingest':   return handleCustomersIngest(req, res);
    case 'customers-undo':     return handleCustomersUndo(req, res);
    default:
      return res.status(400).json({ error: `Unknown QBO route: ${route || '(none)'}` });
  }
}
