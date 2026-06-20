/**
 * ── CUSTOMER CREATE ENDPOINT (Cultivar OS) · THUNDER Wave 2 · 2026-06-20 ─────────
 *
 * PURPOSE      POST endpoint to find-or-create a customer WITHOUT an order — the OCR
 *              invoice → customer bridge. Reuses the SAME shared write the cart uses.
 * DEPENDENCIES findOrCreateCustomer (shared); SUPABASE_URL + SUPABASE_SERVICE_KEY env.
 *              Reached via root shim api/customers/create.ts. Body: { businessId, customer,
 *              source? }. customer.first_name required.
 * OUTPUTS      { ok, customerId, created } | { ok:false, error }. source defaults 'ocr-invoice'.
 */
// Standalone customer create — find-or-create a customer WITHOUT an order.
// Calls the SAME shared write path the cart uses (findOrCreateCustomer), so the
// dedup-by-email contract is identical. Bridges OCR'd-invoice output → a customer row.
//
// source defaults to 'ocr-invoice' (mirrors the cart's 'qr-scan' provenance) so the
// dashboard can tell invoice-captured customers from QR-scan checkouts.

import { createClient } from '@supabase/supabase-js';
import { findOrCreateCustomer } from '../../../shared/src/business-logic/customerUpsert';

const TRACE_ROUTER = true; // [TRACE:ROUTER] STD-003 — ON until David owner-proves

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return createClient(url, key);
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { businessId, customer, source } = req.body ?? {};

  if (!businessId || !customer || !customer.first_name) {
    return res.status(400).json({ error: 'businessId and customer.first_name are required' });
  }

  if (TRACE_ROUTER) console.log('[TRACE:ROUTER] customer create — businessId:', businessId, 'hasEmail:', !!customer.email, 'source:', source ?? 'ocr-invoice');

  const db = adminDb();
  try {
    const { customerId, created } = await findOrCreateCustomer(
      db,
      businessId,
      customer,
      source || 'ocr-invoice',
    );
    if (TRACE_ROUTER) console.log('[TRACE:ROUTER] customer', created ? 'created' : 'matched (dedup)', '— id:', customerId);
    return res.json({ ok: true, customerId, created });
  } catch (err: any) {
    console.error('[TRACE:ROUTER] customer create failed:', err.message);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
