import { createClient } from '@supabase/supabase-js';

const QBO_CLIENT_ID = process.env.QBO_CLIENT_ID!;
const QBO_CLIENT_SECRET = process.env.QBO_CLIENT_SECRET!;
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
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

async function doRefresh(refreshTok: string, nurseryId: string, db: any): Promise<string | null> {
  const creds = Buffer.from(`${QBO_CLIENT_ID}:${QBO_CLIENT_SECRET}`).toString('base64');
  const resp = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${creds}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshTok }).toString(),
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  await db.from('nurseries').update({
    qb_access_token: data.access_token,
    qb_refresh_token: data.refresh_token || refreshTok,
  }).eq('id', nurseryId);
  return data.access_token;
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
  // Search by email first
  const query = `select * from Customer where PrimaryEmailAddr = '${email.replace(/'/g, "\\'")}' MAXRESULTS 1`;
  const searchResp = await qbGet(realm, token, `query?query=${encodeURIComponent(query)}&minorversion=65`);
  if (searchResp.ok) {
    const searchData = await searchResp.json();
    const found = searchData?.QueryResponse?.Customer?.[0];
    if (found) {
      await db.from('customers').update({ qb_customer_id: found.Id }).eq('id', supabaseCustomerId);
      return found.Id;
    }
  }

  // Create new QB customer
  const displayName = `${firstName} ${lastName}`.trim() || email;
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
    return qbId;
  }

  const createData = await createResp.json();
  const qbId = createData?.Customer?.Id;
  if (qbId) await db.from('customers').update({ qb_customer_id: qbId }).eq('id', supabaseCustomerId);
  return qbId;
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { order_id, nursery_id } = req.body as { order_id: string; nursery_id: string };
  if (!order_id || !nursery_id) {
    return res.status(400).json({ error: 'order_id and nursery_id required' });
  }

  const db = supabase();

  try {
    // Fetch nursery QB tokens
    const { data: nursery, error: nurseryErr } = await db
      .from('nurseries')
      .select('qb_access_token, qb_refresh_token, qb_realm_id, tax_rate')
      .eq('id', nursery_id)
      .single();

    if (nurseryErr || !nursery?.qb_realm_id) {
      return res.status(503).json({ error: 'QuickBooks not connected — connect from dashboard first' });
    }

    let token: string = nursery.qb_access_token;
    const realm: string = nursery.qb_realm_id;

    // Fetch order with customer
    const { data: order } = await db
      .from('orders')
      .select('*, customers(*)')
      .eq('id', order_id)
      .single();

    if (!order) return res.status(404).json({ error: 'Order not found' });
    const customer = order.customers;
    const invoiceNumber: string = order.notes || `CLV-${order_id.slice(0, 8)}`;

    // Fetch line items
    const { data: orderItems } = await db
      .from('order_items')
      .select('*, plants(*)')
      .eq('order_id', order_id);

    const { data: orderAddons } = await db
      .from('order_addons')
      .select('*, addons(*)')
      .eq('order_id', order_id);

    // Find or create QB customer (retry with refreshed token on failure)
    let qbCustomerId: string = customer.qb_customer_id;
    if (!qbCustomerId) {
      try {
        qbCustomerId = await findOrCreateQBCustomer(
          realm, token, customer.email, customer.first_name, customer.last_name, customer.id, db,
        );
      } catch {
        if (nursery.qb_refresh_token) {
          const newToken = await doRefresh(nursery.qb_refresh_token, nursery_id, db);
          if (newToken) {
            token = newToken;
            qbCustomerId = await findOrCreateQBCustomer(
              realm, token, customer.email, customer.first_name, customer.last_name, customer.id, db,
            );
          }
        }
      }
    }

    // Build QB line items
    const lines: unknown[] = [];

    for (const item of orderItems || []) {
      const plant = item.plants;
      lines.push({
        Description: `${plant.common_name || plant.species} — ${plant.current_container}`,
        Amount: Number(item.subtotal),
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: {
          UnitPrice: Number(item.unit_price),
          Qty: item.quantity,
          ItemRef: { value: '1', name: 'Services' },
        },
      });
    }

    for (const oa of orderAddons || []) {
      const addon = oa.addons;
      const isNetting = addon.trigger_rule === 'transport=self';
      const declined = isNetting && order.netting_declined;

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

    // Transport line if LAWNS delivering (and no netting addon was in the list)
    const hasNettingAddon = (orderAddons || []).some((oa: any) => oa.addons?.trigger_rule === 'transport=self');
    if (!hasNettingAddon && order.transport_method !== 'self') {
      lines.push({
        Description: 'LAWNS Tree Farm staff transport/installation',
        Amount: 0,
        DetailType: 'SalesItemLineDetail',
        SalesItemLineDetail: { UnitPrice: 0, Qty: 1, ItemRef: { value: '1', name: 'Services' } },
      });
    }

    // Tax line
    const taxAmount = Number(order.tax_amount);
    if (taxAmount > 0) {
      lines.push({
        Description: 'Texas Sales Tax (8.25%)',
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

    // Push invoice (auto-refresh on 401)
    let invoiceResp = await qbPost(realm, token, 'invoice?minorversion=65', invoicePayload);

    if (invoiceResp.status === 401 && nursery.qb_refresh_token) {
      const newToken = await doRefresh(nursery.qb_refresh_token, nursery_id, db);
      if (newToken) {
        token = newToken;
        invoiceResp = await qbPost(realm, token, 'invoice?minorversion=65', invoicePayload);
      }
    }

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
