/**
 * ── DELIVERY CREATE ENDPOINT (Cultivar OS) · THUNDER Wave 2 (loop close) · 2026-06-20 ─
 *
 * PURPOSE      POST endpoint to create a `deliveries` row from an OCR'd invoice —
 *              the piece that flips the router's "Schedule delivery — coming" badge
 *              to functional. Takes an ALREADY-resolved customerId (created/matched
 *              earlier in the same flow by /api/customers/create) so the customer is
 *              NEVER double-created: one customer, one delivery, linked.
 * DEPENDENCIES SUPABASE_URL + SUPABASE_SERVICE_KEY env; the `deliveries` table
 *              (gated migration 20260620_deliveries.sql). Reached via root shim
 *              api/deliveries/create.ts. Body: { businessId, customerId, deliveryDate,
 *              address:{line1,city,state,zip}, source?, notes? }.
 * OUTPUTS      { ok, deliveryId } | { ok:false, error }. source defaults 'ocr-invoice'.
 */
import { createClient } from '@supabase/supabase-js';

const TRACE_DELIVERY = true; // [TRACE:DELIVERY] STD-003 — ON until David owner-proves

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessId, customerId, deliveryDate, address, serviceType, source, notes } = req.body ?? {};

  // customerId is required — a delivery is always tied to a customer (the loop links
  // the OCR-resolved customer; we never create a second one here).
  if (!businessId || !customerId) {
    return res.status(400).json({ error: 'businessId and customerId are required' });
  }

  const addr = address ?? {};
  if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] create — businessId:', businessId,
    'customerId:', customerId, 'date:', deliveryDate ?? '(none)', 'serviceType:', serviceType ?? '(none)',
    'addr:', [addr.line1, addr.city, addr.state, addr.zip].filter(Boolean).join(', ') || '(none)',
    'source:', source ?? 'ocr-invoice');

  const db = adminDb();

  // Base row (no service_type) — always valid against the deliveries schema.
  const baseRow: Record<string, any> = {
    business_id:   businessId,
    customer_id:   customerId,
    delivery_date: deliveryDate || null, // YYYY-MM-DD or null
    address_line1: addr.line1 || null,
    city:          addr.city  || null,
    state:         addr.state || null,
    zip:           addr.zip   || null,
    status:        'scheduled',
    source:        source || 'ocr-invoice',
    notes:         notes || null,
  };

  // HONEST DEBT (migration window): service_type rides on the 20260620_deliveries_service_type
  // gated migration. If this code deploys before David applies it, inserting the column would
  // fail (42703 / PGRST204). We attempt WITH service_type, and on a missing-column error retry
  // WITHOUT it so delivery creation never breaks during the apply window. Remove the fallback
  // once the migration is confirmed applied (verify-deliveries.mjs (G) green).
  function isMissingServiceTypeColumn(error: any): boolean {
    const s = `${error?.code} ${error?.message}`;
    return /42703|PGRST204/.test(s) || /service_type/i.test(s) && /column|schema cache/i.test(s);
  }

  try {
    let { data, error } = await db
      .from('deliveries')
      .insert({ ...baseRow, service_type: serviceType || null }) // 'planting' | 'delivery_only'
      .select('id')
      .single();

    if (error && isMissingServiceTypeColumn(error)) {
      console.warn('[TRACE:DELIVERY] service_type column absent — retrying without it (apply 20260620_deliveries_service_type.sql)');
      ({ data, error } = await db.from('deliveries').insert(baseRow).select('id').single());
    }

    if (error) {
      console.error('[TRACE:DELIVERY] create failed:', error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] created — id:', data?.id, 'linked customer:', customerId, 'serviceType:', serviceType ?? '(none)');
    return res.json({ ok: true, deliveryId: data?.id });
  } catch (err: any) {
    console.error('[TRACE:DELIVERY] create exception:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
