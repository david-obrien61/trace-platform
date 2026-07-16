import { createClient } from '@supabase/supabase-js';
import { refreshQBToken } from '../../../../shared/src/quickbooks/refresh';
import { readQBSecrets } from '../../../../shared/src/quickbooks/secrets';
import { taxExemptionLabel } from '../../../../shared/src/business-logic/taxExemption';
import { personNamesMatch } from '../../../../shared/src/utils/personName';
import {
  resolveQboCustomerMatch,
  type QboCustomerCandidate,
} from '../../../../shared/src/quickbooks/customerIdentity';
import { orderItemName, orderItemAnchor } from '../../../src/lib/orderItemName';

const QBO_ENVIRONMENT = process.env.QBO_ENVIRONMENT || 'sandbox';
const QBO_API_BASE =
  QBO_ENVIRONMENT === 'sandbox'
    ? 'https://sandbox-quickbooks.api.intuit.com/v3/company'
    : 'https://quickbooks.api.intuit.com/v3/company';
const QB_INVOICE_VIEW_BASE =
  QBO_ENVIRONMENT === 'sandbox'
    ? 'https://app.sandbox.qbo.intuit.com/app/invoice?txnId='
    : 'https://app.qbo.intuit.com/app/invoice?txnId=';

function supabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

async function qbGet(realm: string, token: string, path: string) {
  return fetch(`${QBO_API_BASE}/${realm}/${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
}

async function qbPost(realm: string, token: string, path: string, body: unknown) {
  return fetch(`${QBO_API_BASE}/${realm}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}


/**
 * A real identity ambiguity the OWNER must resolve. The push REFUSES rather than guessing —
 * billing the wrong person is catastrophic; a refused push is recoverable (D-47).
 */
class QboIdentityConflict extends Error {
  constructor(message: string) { super(message); this.name = 'QboIdentityConflict'; }
}

/** QBO SQL string escaping — the surname O'Brien MUST survive the predicate. */
function qbEscape(s: string): string { return s.replace(/'/g, "\\'"); }

function toCandidate(c: any): QboCustomerCandidate {
  return {
    id: String(c.Id),
    displayName: c.DisplayName ?? null,
    email: c.PrimaryEmailAddr?.Address ?? null,
  };
}

/** Run one Customer query. Returns ok:false on a request failure (caller decides). */
async function qbQueryCustomers(
  realm: string, token: string, where: string,
): Promise<{ ok: boolean; candidates: QboCustomerCandidate[]; status?: number }> {
  const query = `select * from Customer where ${where} MAXRESULTS 20`;
  const resp = await qbGet(realm, token, `query?query=${encodeURIComponent(query)}&minorversion=65`);
  if (!resp.ok) return { ok: false, candidates: [], status: resp.status };
  const data = await resp.json();
  return { ok: true, candidates: ((data?.QueryResponse?.Customer ?? []) as any[]).map(toCandidate) };
}

/** Read one QBO customer by id — used to VERIFY a stored link before billing it. */
async function qbFetchCustomer(realm: string, token: string, qbId: string): Promise<QboCustomerCandidate | null> {
  const resp = await qbGet(realm, token, `customer/${encodeURIComponent(qbId)}?minorversion=65`);
  if (!resp.ok) return null;
  const data = await resp.json();
  return data?.Customer ? toCandidate(data.Customer) : null;
}

/** QBO rejects a duplicate DisplayName with error 6240 (the name namespace spans customer/vendor/employee). */
function isDuplicateNameError(body: string): boolean {
  return /"code"\s*:\s*"6240"/.test(body) || /Duplicate Name Exists/i.test(body);
}

/** The DisplayName TRACE would use for this party. Empty name → fall back to email. */
function displayNameFor(customer: any): string {
  return `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim() || String(customer.email ?? '').trim();
}

/**
 * BillAddr from the D-41 billing_* fields, falling back to the legacy unprefixed address_*
 * (which the shared editor still mirrors — ledger #119). All-empty → OMIT the block entirely
 * rather than push a hollow address (D-9 omit-not-fake).
 */
function billAddrFrom(customer: any): Record<string, string> | undefined {
  const line1 = customer.billing_line1 ?? customer.address_line1 ?? null;
  const line2 = customer.billing_line2 ?? null;
  const city  = customer.billing_city  ?? customer.city  ?? null;
  const state = customer.billing_state ?? customer.state ?? null;
  const zip   = customer.billing_zip   ?? customer.zip   ?? null;
  if (!line1 && !city && !state && !zip) return undefined;
  const addr: Record<string, string> = {};
  if (line1) addr.Line1 = String(line1);
  if (line2) addr.Line2 = String(line2);
  if (city)  addr.City = String(city);
  if (state) addr.CountrySubDivisionCode = String(state);
  if (zip)   addr.PostalCode = String(zip);
  return addr;
}

/**
 * COLLISION GUARD — two TRACE customers must NEVER carry the same qb_customer_id (that is one
 * QBO customer being billed for two different people). business_id-scoped (AC-3).
 * NOTE: this is a read-then-write check, so it is not race-proof under concurrency. The
 * race-proof form is a partial unique index on (business_id, qb_customer_id) — FLAGGED for
 * David as the durable fix; at a single-owner nursery's push volume this guard is proportionate.
 */
async function assertNoLinkCollision(
  db: any, businessId: string, qbId: string, traceCustomerId: string,
): Promise<void> {
  const { data } = await db
    .from('customers').select('id, first_name, last_name')
    .eq('business_id', businessId).eq('qb_customer_id', qbId)
    .neq('id', traceCustomerId).limit(1);
  if (data && data.length > 0) {
    const other = data[0];
    console.log('[TRACE:QBO] ⚠ LINK COLLISION REFUSED — another TRACE customer already owns this qb_customer_id', {
      qb_customer_id: qbId, traceCustomerId, conflictingTraceCustomerId: other.id,
    });
    throw new QboIdentityConflict(
      `QuickBooks customer ${qbId} is already linked to a different TRACE customer `
      + `("${other.first_name ?? ''} ${other.last_name ?? ''}".trim()). TRACE will not bill one QuickBooks customer `
      + `for two different people. Resolve the duplicate in TRACE or QuickBooks, then push again.`,
    );
  }
}

/**
 * Resolve a TRACE customer → a QBO customer id via the D-47 THREE-WAY rule.
 * Ambiguity NEVER auto-links: it resolves to CREATE or SURFACE. See
 * packages/shared/src/quickbooks/customerIdentity.ts for the rule table and the scar.
 */
async function findOrCreateQBCustomer(
  realm: string,
  token: string,
  customer: any,
  businessId: string,
  db: any,
): Promise<string> {
  // [TRACE:QBO] full accountability trail (STD-003, ON until owner-proven).
  const traceCustomerId: string = customer.id;
  const traceName = displayNameFor(customer);
  const email: string | null = customer.email ?? null;

  // (1) the TRACE customer being resolved
  console.log('[TRACE:QBO] cust find-or-create — resolving TRACE customer', {
    traceCustomerId, traceName, email, rule: 'D-47 three-way (email AND name)',
  });

  // (2) query QBO by EMAIL **and** by DisplayName — never email alone. QBO guarantees
  //     DisplayName unique and does NOT guarantee email unique, so the name query is the
  //     one keyed on the field QBO actually enforces.
  const candidateById = new Map<string, QboCustomerCandidate>();
  let searchDegraded = false;

  if (email) {
    const byEmail = await qbQueryCustomers(realm, token, `PrimaryEmailAddr = '${qbEscape(email)}'`);
    if (byEmail.ok) byEmail.candidates.forEach(c => candidateById.set(c.id, c));
    else { searchDegraded = true; console.log('[TRACE:QBO] cust email search FAILED', { status: byEmail.status }); }
  }
  if (traceName) {
    const byName = await qbQueryCustomers(realm, token, `DisplayName = '${qbEscape(traceName)}'`);
    if (byName.ok) byName.candidates.forEach(c => candidateById.set(c.id, c));
    else { searchDegraded = true; console.log('[TRACE:QBO] cust name search FAILED', { status: byName.status }); }
  }
  const candidates = [...candidateById.values()];

  // (3) the FULL candidate set QBO returned — the union of both queries
  console.log('[TRACE:QBO] cust candidate set (union of email + DisplayName queries)', {
    matchOn: 'email AND DisplayName (both queried; both compared)',
    candidateCount: candidates.length, searchDegraded,
    candidates: candidates.map(c => ({ id: c.id, displayName: c.displayName, email: c.email })),
  });

  // (4) THE DECISION — the one shared rule (STD-011)
  const verdict = resolveQboCustomerMatch({ name: traceName, email }, candidates);
  console.log('[TRACE:QBO] cust DECISION', {
    traceCustomerId, traceName, email,
    action: verdict.action, rule: verdict.rule, reason: verdict.reason,
    emailHits: verdict.emailHits.map(c => `${c.id}:${c.displayName}`),
    nameHits:  verdict.nameHits.map(c => `${c.id}:${c.displayName}`),
  });

  if (verdict.action === 'surface') {
    throw new QboIdentityConflict(verdict.reason);
  }

  if (verdict.action === 'link') {
    const qbId = verdict.qbCustomerId!;
    await assertNoLinkCollision(db, businessId, qbId, traceCustomerId);
    await db.from('customers').update({ qb_customer_id: qbId }).eq('id', traceCustomerId);
    // (5) LINKED + (6) the qb_customer_id written back
    console.log('[TRACE:QBO] cust LINKED (email AND name concur) — qb_customer_id written back', {
      action: 'linked-existing', traceCustomerId, qb_customer_id: qbId,
    });
    return qbId;
  }

  // ── CREATE ────────────────────────────────────────────────────────────────────────────
  const displayName = traceName;
  if (!displayName) {
    throw new QboIdentityConflict(
      'This customer has no name and no email, so TRACE cannot identify them in QuickBooks. '
      + 'Add a name to the customer in TRACE, then push again.',
    );
  }
  const billAddr = billAddrFrom(customer);
  console.log('[TRACE:QBO] cust CREATING new QBO customer', {
    traceCustomerId, displayName, email, rule: verdict.rule, hasBillAddr: !!billAddr,
  });
  const createResp = await qbPost(realm, token, 'customer?minorversion=65', {
    GivenName: customer.first_name ?? undefined,
    FamilyName: customer.last_name ?? undefined,
    DisplayName: displayName,
    ...(email ? { PrimaryEmailAddr: { Address: email } } : {}),
    ...(billAddr ? { BillAddr: billAddr } : {}),
  });

  if (!createResp.ok) {
    const errText = await createResp.text();
    // An EXACT DisplayName collision is a REAL ambiguity → SURFACE it. NEVER auto-link onto
    // the colliding record (that is the scar), and never silently create an email-named junk
    // record to route around it (the retired fallback — it hid the collision from the owner).
    if (isDuplicateNameError(errText)) {
      console.log('[TRACE:QBO] ⚠ CREATE REFUSED — QBO reports a duplicate DisplayName (6240)', {
        traceCustomerId, displayName, email,
      });
      throw new QboIdentityConflict(
        `QuickBooks already has a customer named "${displayName}" that TRACE could not match to this customer `
        + `(the emails disagree). TRACE will not guess whether they are the same person. Open QuickBooks and either `
        + `correct that customer's email to "${email ?? '(this customer\'s email)'}", or give one of them a distinct name — then push again.`,
      );
    }
    throw new Error(`QB customer creation failed: ${errText}`);
  }

  const createData = await createResp.json();
  const qbId = createData?.Customer?.Id;
  if (!qbId) throw new Error('QB customer creation returned no Id');
  await db.from('customers').update({ qb_customer_id: qbId }).eq('id', traceCustomerId);
  // (5) CREATED + (6) the qb_customer_id written back
  console.log('[TRACE:QBO] cust CREATED — qb_customer_id written back', {
    action: 'created-new', traceCustomerId, qb_customer_id: qbId, displayName, rule: verdict.rule,
  });
  return qbId;
}

/**
 * VERIFY a stored qb_customer_id before billing it. A stored link is a CACHE, not a fact —
 * it must be re-checked. The old code trusted it forever with no re-verification, which is
 * exactly how the TERRENCE→Andrew link silently billed nine invoices: the mis-link was made
 * once and never questioned again. Name drift → REFUSE the push (D-47).
 */
async function verifyStoredQbLink(
  realm: string, token: string, customer: any, qbId: string,
): Promise<void> {
  const traceName = displayNameFor(customer);
  const stored = await qbFetchCustomer(realm, token, qbId);

  if (!stored) {
    console.log('[TRACE:QBO] ⚠ STORED LINK UNREADABLE — refusing the push', {
      traceCustomerId: customer.id, qb_customer_id: qbId,
    });
    throw new QboIdentityConflict(
      `This customer is linked to QuickBooks customer ${qbId}, but that customer could not be read from QuickBooks `
      + `(it may have been deleted or merged). TRACE will not bill an unverifiable link. Re-link this customer, then push again.`,
    );
  }

  if (!personNamesMatch(stored.displayName, traceName)) {
    console.log('[TRACE:QBO] ⚠ STORED LINK NAME DRIFT — refusing the push (this is the check that would have caught TERRENCE→Andrew on invoice #1)', {
      traceCustomerId: customer.id, traceName,
      qb_customer_id: qbId, qbDisplayName: stored.displayName, qbEmail: stored.email,
    });
    throw new QboIdentityConflict(
      `This customer ("${traceName}") is linked to QuickBooks customer ${qbId}, which is named "${stored.displayName ?? '(no name)'}". `
      + `TRACE will not bill an invoice to a different person than the order names. Correct the link in TRACE `
      + `(clear this customer's QuickBooks link so it re-resolves on the next push), then push again.`,
    );
  }

  console.log('[TRACE:QBO] cust — STORED link VERIFIED (name still agrees), billing it', {
    traceCustomerId: customer.id, traceName, qb_customer_id: qbId, qbDisplayName: stored.displayName,
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { order_id, business_id } = req.body as { order_id: string; business_id: string };
  if (!order_id || !business_id) {
    return res.status(400).json({ error: 'order_id and business_id required' });
  }

  const db = supabase();

  try {
    // Fetch business accounting tokens
    const { data: business, error: bizErr } = await db
      .from('businesses')
      .select('accounting_token_expires_at, accounting_company_id, name')
      .eq('id', business_id)
      .single();

    if (bizErr || !business?.accounting_company_id) {
      return res.status(503).json({ error: 'QuickBooks not connected — connect from dashboard first' });
    }

    // Bearer secrets come from the owner-only secrets table (not the businesses row).
    const secrets = await readQBSecrets(db, business_id);
    const token = await refreshQBToken(business_id, {
      accounting_token:            secrets.accounting_token,
      accounting_refresh_token:    secrets.accounting_refresh_token,
      accounting_token_expires_at: business.accounting_token_expires_at,
    });
    if (!token) {
      return res.status(503).json({ error: 'qb_token_expired' });
    }
    const realm: string = business.accounting_company_id;

    // Fetch order with customer
    const { data: order } = await db
      .from('orders')
      .select('*, customers(*)')
      .eq('id', order_id)
      .single();

    if (!order) return res.status(404).json({ error: 'Order not found' });
    const customer = order.customers;
    const invoiceNumber: string = order.notes || `CLV-${order_id.slice(0, 8)}`;

    // Fetch line items — D-34: every line anchors to its business_inventory stock line
    // (business_inventory_id), the sole anchor after the AC-1 vertical noun order_items.plant_id
    // was dropped (20260709). The lot's name IS the variety name → name via the shared resolver
    // (orderItemName), same as the roster/detail/preview.
    const { data: orderItems } = await db
      .from('order_items')
      .select('*, business_inventory ( name, size, sku )')
      .eq('order_id', order_id);

    // Try new service_selections model first; fall back to legacy order_addons
    const { data: serviceSelections } = await db
      .from('order_service_selections')
      .select('*, service_offerings(*)')
      .eq('order_id', order_id);

    const { data: orderAddons } = await db
      .from('order_addons')
      .select('*, addons(*)')
      .eq('order_id', order_id);

    const useNewModel = (serviceSelections ?? []).length > 0;

    // Resolve the QB customer (D-47). A stored link is a CACHE, not a fact: VERIFY it before
    // billing it. An unstored one resolves through the three-way rule, which never guesses.
    let qbCustomerId: string = customer.qb_customer_id;
    if (qbCustomerId) {
      await verifyStoredQbLink(realm, token, customer, qbCustomerId);
    } else {
      qbCustomerId = await findOrCreateQBCustomer(realm, token, customer, business_id, db);
    }

    // Build QB line items
    const lines: unknown[] = [];

    // D-43: read the STORED per-line breakdown (retail_unit/discount_pct/discount_amt — via select('*'))
    // so the pushed invoice SHOWS the discount as its OWN line (goods at retail → an explicit discount
    // line), never a silently-net rate. GATED on a discount actually applying: a non-discounted (retail)
    // order pushes goods at net EXACTLY as before → zero regression; only a discounted order carries the
    // retail-goods + negative-discount representation. Historical rows (null retail_unit) → net lines, no
    // discount line (omit-not-fake, D-9). The invoice total is unchanged (retail − discount === net).
    const goodsRows = (orderItems || []) as any[];
    const qbHasBreakdown = goodsRows.length > 0 && goodsRows.every((it: any) => it.retail_unit != null);
    const qbDiscountTotal = qbHasBreakdown
      ? Math.round(goodsRows.reduce((s: number, it: any) => s + Number(it.discount_amt ?? 0), 0) * 100) / 100 : 0;
    const qbShowDiscount = qbHasBreakdown && qbDiscountTotal > 0;
    const qbDiscPct = goodsRows.find((it: any) => Number(it.discount_amt ?? 0) > 0)?.discount_pct ?? 0;

    for (const item of goodsRows) {
      // Name via the shared resolver (the stock line's name — the lot IS the variety).
      const name      = orderItemName(item as any);
      const container = item.business_inventory?.size ?? null;
      const anchor    = orderItemAnchor(item as any);
      console.log('[TRACE:QBO] invoice line — dual anchor', { anchor, name, container });
      // Goods at RETAIL when a discount applies (the discount line below shows the tier came off), else net.
      const lineAmount = qbShowDiscount
        ? Math.round(Number(item.retail_unit) * Number(item.quantity) * 100) / 100
        : Number(item.subtotal);
      const lineUnit = qbShowDiscount ? Number(item.retail_unit) : Number(item.unit_price);
      lines.push({
        Description: container ? `${name} — ${container}` : name,
        Amount: lineAmount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          UnitPrice: lineUnit,
          Qty: item.quantity,
          ItemRef: { value: '1', name: 'Services' },
        },
      });
    }

    // ONE explicit discount line (negative SalesItemLine — consistent with this invoice's own
    // all-SalesItemLine convention, incl. its manual tax line) so the 10% shows on the invoice, not
    // baked into a net rate. Reads the STORED discount total; never recomputes.
    if (qbShowDiscount) {
      lines.push({
        Description: `Discount${qbDiscPct > 0 ? ` (${qbDiscPct}% off)` : ''}`,
        Amount: -qbDiscountTotal,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          UnitPrice: -qbDiscountTotal,
          Qty: 1,
          ItemRef: { value: '1', name: 'Services' },
        },
      });
      console.log('[TRACE:QBO] invoice discount line from stored breakdown', { discountTotal: qbDiscountTotal, pct: qbDiscPct });
    }

    if (useNewModel) {
      // ── New model: service_offerings lines ────────────────────────────────
      for (const sel of serviceSelections || []) {
        const offering = sel.service_offerings;
        if (!offering) continue;

        const isNetting  = offering.trigger_transport_mode === 'self' && offering.category === 'addon';
        const isTransport = offering.category === 'transport';

        if (isNetting && order.netting_declined) {
          lines.push({
            Description: 'Protective travel netting — DECLINED by customer (TX TCC Ch.725 waiver signed)',
            Amount: 0,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: { UnitPrice: 0, Qty: 1, ItemRef: { value: '1', name: 'Services' } },
          });
        } else if (isTransport && Number(sel.subtotal) === 0) {
          if (offering.transport_mode !== 'self') {
            lines.push({
              Description: `${business.name} — ${offering.name}`,
              Amount: 0,
              DetailType: 'SalesItemLineDetail',
              SalesItemLineDetail: { UnitPrice: 0, Qty: 1, ItemRef: { value: '1', name: 'Services' } },
            });
          }
          // self-transport with $0 price → no line item needed
        } else if (Number(sel.subtotal) > 0) {
          lines.push({
            Description: `${offering.name} × ${sel.quantity}`,
            Amount: Number(sel.subtotal),
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              UnitPrice: Number(sel.unit_price_at_time),
              Qty: sel.quantity,
              ItemRef: { value: '1', name: 'Services' },
            },
          });
        }
      }
    } else {
      // ── Legacy model: order_addons fallback ───────────────────────────────
      for (const oa of orderAddons || []) {
        const addon     = oa.addons;
        const isNetting = addon.trigger_rule === 'transport=self';
        const declined  = isNetting && order.netting_declined;

        if (declined) {
          lines.push({
            Description: 'Protective travel netting — DECLINED by customer (TX TCC Ch.725 waiver signed)',
            Amount: 0,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: { UnitPrice: 0, Qty: 1, ItemRef: { value: '1', name: 'Services' } },
          });
        } else {
          lines.push({
            Description: `${addon.name} × ${oa.quantity}`,
            Amount: Number(oa.subtotal),
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              UnitPrice: Number(oa.unit_price),
              Qty: oa.quantity,
              ItemRef: { value: '1', name: 'Services' },
            },
          });
        }
      }

      // Legacy transport line
      const hasNettingAddon = (orderAddons || []).some((oa: any) => oa.addons?.trigger_rule === 'transport=self');
      if (!hasNettingAddon && order.transport_method !== 'self') {
        if (order.transport_method === 'install') {
          // install_price removed from cultivar_plants (stock fact — moved to service_offerings).
          // Legacy install line defaults to 0 until service_offerings pricing is wired.
          const installUnitPrice = 0;
          const installQty       = (orderItems || [])[0]?.quantity ?? 1;
          lines.push({
            Description: `Installation service · ${installQty} plant${installQty > 1 ? 's' : ''}`,
            Amount: installUnitPrice * installQty,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: {
              UnitPrice: installUnitPrice,
              Qty: installQty,
              ItemRef: { value: '1', name: 'Services' },
            },
          });
        } else {
          lines.push({
            Description: `${business.name} staff transport`,
            Amount: 0,
            DetailType: 'SalesItemLineDetail',
            SalesItemLineDetail: { UnitPrice: 0, Qty: 1, ItemRef: { value: '1', name: 'Services' } },
          });
        }
      }
    }

    // Tax line (D-40) — render the order's PERSISTED tax state; NO hardcoded 8.25%:
    //   • exempt order      → a $0 "Tax exempt — <reason>[· cert]" line (documents the exemption);
    //   • taxed order       → the tax with the % DERIVED from amount/subtotal (never a fabricated rate);
    //   • not-identified    → no tax was charged → no tax line (the redline lives pre-invoice, in the app).
    const taxAmount = Number(order.tax_amount);
    if (order.tax_exempt_applied === true) {
      const cert = String(order.tax_exempt_cert_ref ?? '').trim();
      lines.push({
        Description: `Tax exempt — ${taxExemptionLabel(order.tax_exempt_reason)}${cert ? ` · cert ${cert}` : ''}`,
        Amount: 0,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: { UnitPrice: 0, Qty: 1, ItemRef: { value: '1', name: 'Services' } },
      });
      console.log('[TRACE:TAX] QBO invoice — tax-exempt line', { order_id, reason: order.tax_exempt_reason, cert });
    } else if (taxAmount > 0) {
      const sub = Number(order.subtotal) || 0;
      const taxPct = sub > 0 ? Math.round((taxAmount / sub) * 10000) / 100 : 0;
      lines.push({
        Description: `Sales Tax (${taxPct}%)`,
        Amount: taxAmount,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          UnitPrice: taxAmount,
          Qty: 1,
          ItemRef: { value: '1', name: 'Services' },
        },
      });
    }

    const today = new Date().toISOString().slice(0, 10);
    const invoicePayload = {
      Line: lines,
      CustomerRef: { value: qbCustomerId },
      TxnDate: today,
      DueDate: today,
      BillEmail: { Address: customer.email },
      CustomerMemo: { value: order.transport_note || '' },
      PrivateNote: `Cultivar OS Order ${invoiceNumber}. Netting declined: ${order.netting_declined ?? false}. Source: QR scan.`,
    };

    // Push invoice
    const invoiceResp = await qbPost(realm, token, 'invoice?minorversion=65', invoicePayload);

    if (!invoiceResp.ok) {
      const errText = await invoiceResp.text();
      throw new Error(`QB invoice push failed (${invoiceResp.status}): ${errText}`);
    }

    const invoiceData = await invoiceResp.json();
    const qbInvoice = invoiceData?.Invoice;
    const qbInvoiceId: string = qbInvoice?.Id;
    const qbDocNumber: string = qbInvoice?.DocNumber;
    const qbInvoiceUrl = `${QB_INVOICE_VIEW_BASE}${qbInvoiceId}`;

    // Write QB invoice ID back to Supabase order
    await db.from('orders').update({
      qb_invoice_id: qbInvoiceId,
      qb_invoice_url: qbInvoiceUrl,
      status: 'invoiced',
    }).eq('id', order_id);

    return res.json({
      success: true,
      qb_invoice_id: qbInvoiceId,
      qb_invoice_number: qbDocNumber,
      qb_invoice_url: qbInvoiceUrl,
    });

  } catch (err: any) {
    // A real identity ambiguity is NOT a server fault — it is a decision only the owner can
    // make. Surface it as an actionable 409 so the UI can show the owner what to resolve,
    // rather than burying it in a generic 500 (D-47: refuse the push, never guess the party).
    if (err instanceof QboIdentityConflict) {
      console.log('[TRACE:QBO] ⚠ PUSH REFUSED — customer identity must be resolved by the owner', {
        order_id, business_id, reason: err.message,
      });
      return res.status(409).json({ error: err.message, code: 'qb_customer_identity_conflict' });
    }
    console.error('[QB invoice/cultivar]', err);
    return res.status(500).json({ error: err?.message || 'QB invoice creation failed' });
  }
}
