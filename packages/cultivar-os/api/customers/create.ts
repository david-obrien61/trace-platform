/**
 * ── CUSTOMER (+ OPTIONAL DELIVERY) ENDPOINT (Cultivar OS) · THUNDER Wave 2 · 2026-06-20 ─
 *
 * PURPOSE      ONE call that resolves a customer (find-or-create, no order needed) AND,
 *              when a `delivery` block is supplied, creates a single linked `deliveries`
 *              row in the SAME request. Folding delivery-create in here (was its own
 *              api/deliveries/create function) keeps the repo under Vercel Hobby's
 *              12-Serverless-Function ceiling (tech-debt: see CLAUDE.md / built-inventory)
 *              AND structurally guarantees no double-create: one resolve → one customerId
 *              → at most one delivery linked to it.
 * DEPENDENCIES findOrCreateCustomer (shared); SUPABASE_URL + SUPABASE_SERVICE_KEY env;
 *              `customers` + `deliveries` tables. Reached via root shim
 *              api/customers/create.ts. Body: { businessId, customer, source?,
 *              delivery?: { deliveryDate, address:{line1,city,state,zip}, serviceType?, notes? } }.
 * OUTPUTS      { ok, customerId, created, deliveryId?, deliveryError? } | { ok:false, error }.
 */
import { createClient } from '@supabase/supabase-js';
import { findOrCreateCustomer } from '../../../shared/src/business-logic/customerUpsert';

const TRACE_ROUTER   = true; // [TRACE:ROUTER]   STD-003 — ON until David owner-proves
const TRACE_DELIVERY = true; // [TRACE:DELIVERY] STD-003 — ON until David owner-proves

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

// HONEST DEBT (migration window): service_type rides on 20260620_deliveries_service_type.
// If this code is live before the column is applied, inserting it fails (42703 / PGRST204);
// we retry without it so delivery creation never breaks. Remove once verify (G) is green.
function isMissingServiceTypeColumn(error: any): boolean {
  const s = `${error?.code} ${error?.message}`;
  return /42703|PGRST204/.test(s) || (/service_type/i.test(s) && /column|schema cache/i.test(s));
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessId, customer, source, delivery } = req.body ?? {};

  if (!businessId || !customer || !customer.first_name) {
    return res.status(400).json({ error: 'businessId and customer.first_name are required' });
  }

  if (TRACE_ROUTER) console.log('[TRACE:ROUTER] customer create — businessId:', businessId, 'hasEmail:', !!customer.email, 'source:', source ?? 'ocr-invoice', 'withDelivery:', !!delivery);

  const db = adminDb();

  // ── 1. Resolve the customer ONCE (find-or-create, dedup-by-email) ──
  let customerId: string;
  let created: boolean;
  try {
    ({ customerId, created } = await findOrCreateCustomer(
      db,
      businessId,
      customer,
      source || 'ocr-invoice',
    ));
    if (TRACE_ROUTER) console.log('[TRACE:ROUTER] customer', created ? 'created' : 'matched (dedup)', '— id:', customerId);
  } catch (err: any) {
    console.error('[TRACE:ROUTER] customer create failed:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }

  // ── 2. Optionally create ONE delivery linked to that SAME customer ──
  // No second customer is ever resolved here — the delivery rides the id from step 1
  // (the no-double-create contract, now structural: one endpoint, one customer, one delivery).
  let deliveryId: string | undefined;
  let deliveryError: string | undefined;
  if (delivery) {
    const addr = delivery.address ?? {};
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] create — customerId:', customerId,
      'date:', delivery.deliveryDate ?? '(none)', 'serviceType:', delivery.serviceType ?? '(none)',
      'addr:', [addr.line1, addr.city, addr.state, addr.zip].filter(Boolean).join(', ') || '(none)');

    const baseRow: Record<string, any> = {
      business_id:   businessId,
      customer_id:   customerId,
      delivery_date: delivery.deliveryDate || null,
      address_line1: addr.line1 || null,
      city:          addr.city  || null,
      state:         addr.state || null,
      zip:           addr.zip   || null,
      status:        'scheduled',
      source:        delivery.source || source || 'ocr-invoice',
      notes:         delivery.notes || null,
    };

    try {
      let { data, error } = await db
        .from('deliveries')
        .insert({ ...baseRow, service_type: delivery.serviceType || null })
        .select('id')
        .single();

      if (error && isMissingServiceTypeColumn(error)) {
        console.warn('[TRACE:DELIVERY] service_type column absent — retrying without it (apply 20260620_deliveries_service_type.sql)');
        ({ data, error } = await db.from('deliveries').insert(baseRow).select('id').single());
      }

      if (error) {
        // A delivery failure must NOT fail the customer resolve — the customer is already
        // saved. Surface the delivery error separately so the caller can warn, not lose data.
        deliveryError = error.message;
        console.error('[TRACE:DELIVERY] create failed:', error.message);
      } else {
        deliveryId = data?.id;
        if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] created — id:', deliveryId, 'linked customer:', customerId, 'serviceType:', delivery.serviceType ?? '(none)');
      }
    } catch (err: any) {
      deliveryError = err.message;
      console.error('[TRACE:DELIVERY] create exception:', err.message);
    }
  }

  return res.json({ ok: true, customerId, created, deliveryId, deliveryError });
}
