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

  const { businessId, customerId, deliveryDate, address, source, notes } = req.body ?? {};

  // customerId is required — a delivery is always tied to a customer (the loop links
  // the OCR-resolved customer; we never create a second one here).
  if (!businessId || !customerId) {
    return res.status(400).json({ error: 'businessId and customerId are required' });
  }

  const addr = address ?? {};
  if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] create — businessId:', businessId,
    'customerId:', customerId, 'date:', deliveryDate ?? '(none)',
    'addr:', [addr.line1, addr.city, addr.state, addr.zip].filter(Boolean).join(', ') || '(none)',
    'source:', source ?? 'ocr-invoice');

  const db = adminDb();
  try {
    const { data, error } = await db
      .from('deliveries')
      .insert({
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
      })
      .select('id')
      .single();

    if (error) {
      console.error('[TRACE:DELIVERY] create failed:', error.message);
      return res.status(500).json({ ok: false, error: error.message });
    }

    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] created — id:', data?.id, 'linked customer:', customerId);
    return res.json({ ok: true, deliveryId: data?.id });
  } catch (err: any) {
    console.error('[TRACE:DELIVERY] create exception:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
