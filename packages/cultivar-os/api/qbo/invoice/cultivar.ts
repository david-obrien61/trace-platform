import { createClient } from '@supabase/supabase-js';
import { refreshQBToken } from '../../../../shared/src/quickbooks/refresh';
import { readQBSecrets } from '../../../../shared/src/quickbooks/secrets';
import { taxExemptionLabel } from '../../../../shared/src/business-logic/taxExemption';
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


async function findOrCreateQBCustomer(
  realm: string,
  token: string,
  email: string,
  firstName: string,
  lastName: string,
  supabaseCustomerId: string,
  db: any,
): Promise<string> {
  // [TRACE:QBO] full accountability trail for the customer find-or-create (STD-003, ON). This maps a
  // TRACE customer → a QBO customer. The MATCH PREDICATE IS EMAIL-ONLY and does NOT verify the name
  // before reusing a QBO record — this trail makes that visible per push (surfaced the TERRENCE→Andrew
  // cross-identity link, 2026-07-15). Behavior is UNCHANGED here; this is instrumentation only.
  const traceName = `${firstName ?? ''} ${lastName ?? ''}`.trim();
  // (1) the TRACE customer being resolved
  console.log('[TRACE:QBO] cust find-or-create — resolving TRACE customer', {
    traceCustomerId: supabaseCustomerId, traceName, email,
  });

  // Search by EMAIL ALONE (no name predicate). MAXRESULTS raised 1→20 SO THE FULL CANDIDATE SET IS
  // OBSERVABLE in the log; the SELECTION rule is unchanged (still index [0], the first hit).
  const predicate = `PrimaryEmailAddr = '${email.replace(/'/g, "\\'")}'`;
  const query = `select * from Customer where ${predicate} MAXRESULTS 20`;
  // (2) the exact query / predicate sent to QBO
  console.log('[TRACE:QBO] cust search query', {
    matchOn: 'email-only (DisplayName / name NOT in predicate)',
    predicate: `PrimaryEmailAddr = '${email}'`,
    query,
  });
  const searchResp = await qbGet(realm, token, `query?query=${encodeURIComponent(query)}&minorversion=65`);
  if (searchResp.ok) {
    const searchData = await searchResp.json();
    const candidates = (searchData?.QueryResponse?.Customer ?? []) as any[];
    // (3) the FULL result set QBO returned — ALL candidates, not just the pick
    console.log('[TRACE:QBO] cust search result set', {
      candidateCount: candidates.length,
      candidates: candidates.map((c: any) => ({
        id: c.Id, displayName: c.DisplayName, email: c.PrimaryEmailAddr?.Address ?? null,
      })),
    });
    const found = candidates[0];
    if (found) {
      const foundName = String(found.DisplayName ?? '').trim();
      const nameMatches = foundName.toLowerCase() === traceName.toLowerCase();
      // (4) which candidate was SELECTED and on what rule
      console.log('[TRACE:QBO] cust SELECTED', {
        selectedQbId: found.Id,
        selectedDisplayName: found.DisplayName,
        selectedEmail: found.PrimaryEmailAddr?.Address ?? null,
        rule: 'first-hit of the email-only query (index [0]); NO name verification before reuse',
        traceName, nameMatches,
      });
      if (!nameMatches) {
        // The exact defect class: an email-keyed reuse onto a DIFFERENT person's QBO customer.
        console.log('[TRACE:QBO] ⚠ NAME MISMATCH — reusing a QBO customer whose name differs from the TRACE customer (email-keyed, name unverified)', {
          traceCustomerId: supabaseCustomerId, traceName, email,
          reusedQbId: found.Id, reusedDisplayName: found.DisplayName,
        });
      }
      await db.from('customers').update({ qb_customer_id: found.Id }).eq('id', supabaseCustomerId);
      // (5) REUSED existing  +  (6) the qb_customer_id written back
      console.log('[TRACE:QBO] cust REUSED — qb_customer_id written back', {
        action: 'reused-existing', traceCustomerId: supabaseCustomerId, qb_customer_id: found.Id,
      });
      return found.Id;
    }
  } else {
    console.log('[TRACE:QBO] cust search request FAILED — falling through to CREATE', { status: searchResp.status });
  }

  // Create new QB customer
  const displayName = `${firstName} ${lastName}`.trim() || email;
  console.log('[TRACE:QBO] cust — no email match, CREATING new QBO customer', {
    traceCustomerId: supabaseCustomerId, displayName, email,
  });
  const createResp = await qbPost(realm, token, 'customer?minorversion=65', {
    GivenName: firstName,
    FamilyName: lastName,
    DisplayName: displayName,
    PrimaryEmailAddr: { Address: email },
  });

  if (!createResp.ok) {
    // Fallback: try with email as DisplayName (always unique)
    const fallbackResp = await qbPost(realm, token, 'customer?minorversion=65', {
      DisplayName: email,
      PrimaryEmailAddr: { Address: email },
    });
    if (!fallbackResp.ok) throw new Error(`QB customer creation failed: ${await fallbackResp.text()}`);
    const fallbackData = await fallbackResp.json();
    const qbId = fallbackData?.Customer?.Id;
    if (qbId) await db.from('customers').update({ qb_customer_id: qbId }).eq('id', supabaseCustomerId);
    // (5) CREATED (fallback)  +  (6) the qb_customer_id written back
    console.log('[TRACE:QBO] cust CREATED (fallback: email-as-DisplayName) — qb_customer_id written back', {
      action: 'created-new-fallback', traceCustomerId: supabaseCustomerId, qb_customer_id: qbId, displayName: email,
    });
    return qbId;
  }

  const createData = await createResp.json();
  const qbId = createData?.Customer?.Id;
  if (qbId) await db.from('customers').update({ qb_customer_id: qbId }).eq('id', supabaseCustomerId);
  // (5) CREATED  +  (6) the qb_customer_id written back
  console.log('[TRACE:QBO] cust CREATED — qb_customer_id written back', {
    action: 'created-new', traceCustomerId: supabaseCustomerId, qb_customer_id: qbId, displayName,
  });
  return qbId;
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

    // Find or create QB customer
    let qbCustomerId: string = customer.qb_customer_id;
    if (!qbCustomerId) {
      qbCustomerId = await findOrCreateQBCustomer(
        realm, token, customer.email, customer.first_name, customer.last_name, customer.id, db,
      );
    } else {
      // Already linked — find-or-create is SKIPPED, the stored qb_customer_id is used as-is (no
      // re-check that it still names the same person). Log so a stale/cross-identity link is visible.
      console.log('[TRACE:QBO] cust — using STORED qb_customer_id (find-or-create SKIPPED, link not re-verified)', {
        traceCustomerId: customer.id,
        traceName: `${customer.first_name ?? ''} ${customer.last_name ?? ''}`.trim(),
        email: customer.email,
        qb_customer_id: qbCustomerId,
      });
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
    console.error('[QB invoice/cultivar]', err);
    return res.status(500).json({ error: err?.message || 'QB invoice creation failed' });
  }
}
