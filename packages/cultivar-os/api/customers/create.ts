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
 *              api/customers/create.ts. Body: { businessId, customer, source?, receiptId?,
 *              delivery?: { deliveryDate, address:{line1,city,state,zip}, serviceType?, notes? } }.
 *              `receiptId` turns the captured document into a HISTORY ORDER (see step 3).
 * OUTPUTS      { ok, customerId, created, contactResults, deliveryId?, deliveryError?, orderId?, orderError? }
 *              — contactResults: what became of each typed phone / email / address (ledger #345).
 *              | { ok:false, error }.
 */
import { createClient } from '@supabase/supabase-js';
import { callerCan, resolveCallerUid } from '../../../shared/src/auth/callerPermission';
import type { ContactValueResult } from '../../../shared/src/business-logic/contactWriter';
import { findOrCreateCustomer } from '../../../shared/src/business-logic/customerUpsert';
import { buildHistoryOrder, decodeCapturedDocument, documentFooting, footingMessage } from '../../../shared/src/business-logic/historyOrder';

const TRACE_ROUTER   = true; // [TRACE:ROUTER]   STD-003 — ON until David owner-proves
const TRACE_DELIVERY = true; // [TRACE:DELIVERY] STD-003 — ON until David owner-proves
const TRACE_HISTORY  = true; // [TRACE:HISTORY]  STD-003 — ON until David owner-proves

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

  const { businessId, customer, source, delivery, receiptId } = req.body ?? {};

  if (!businessId || !customer || !customer.first_name) {
    return res.status(400).json({ error: 'businessId and customer.first_name are required' });
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // 🔴 CALLER AUTHORITY — MB_D-015. ADDED 2026-07-27; THIS ENDPOINT HAD NONE.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // `businessId` above comes off the REQUEST BODY, and every write below goes through adminDb()
  // — the SERVICE KEY, which bypasses RLS completely. Until this gate existed, anyone who could
  // reach the URL could write a customer and a delivery into ANY tenant by naming its id: AC-3
  // with no layer beneath it. The header of `callerPermission.ts` has stated the rule the whole
  // time ("authority is resolved from the AUTH CONTEXT, NEVER the request body") and
  // `orders/submit.ts` obeys it fifteen times, in this same directory.
  //
  // The gate is per-RESOURCE, not per-endpoint: this handler writes TWO things, so it proves
  // authority for each. A caller who may add a customer is not thereby allowed to schedule a
  // delivery. Owner passes either check via businesses.owner_id (callerCan tries owner first).
  const authHeader = req.headers?.authorization;
  if (!(await callerCan(authHeader, businessId, 'customers:create'))) {
    console.log('[TRACE:AUTHORITY] customers/create REFUSED — caller lacks customers:create/owner', { businessId });
    return res.status(403).json({ error: 'Not authorized to create a customer for this business', code: 'FORBIDDEN' });
  }
  if (delivery && !(await callerCan(authHeader, businessId, 'deliveries:create'))) {
    console.log('[TRACE:AUTHORITY] customers/create REFUSED delivery — caller lacks deliveries:create/owner', { businessId });
    return res.status(403).json({ error: 'Not authorized to schedule a delivery for this business', code: 'FORBIDDEN_DELIVERY' });
  }

  if (TRACE_ROUTER) console.log('[TRACE:ROUTER] customer create — businessId:', businessId, 'hasEmail:', !!customer.email, 'source:', source ?? 'ocr-invoice', 'withDelivery:', !!delivery);

  const db = adminDb();

  // ── 1. Resolve the customer ONCE (find-or-create, dedup-by-email) ──
  let customerId: string;
  let created: boolean;
  // #345 — NO SILENT DROP. What became of each typed phone / email / address goes back to the
  // capture screen. `billing_line2` is now carried (it was accepted and ignored). A value sent
  // under a RETIRED column name (`address_line1` / `city` / `state` / `zip`, dropped from
  // `customers` by 20260915b) is reported NOT SAVED rather than vanishing.
  let contactResults: ContactValueResult[] = [];
  const retired = (['address_line1', 'city', 'state', 'zip'] as const)
    .filter(k => typeof customer[k] === 'string' && customer[k].trim() !== '')
    .map(k => ({ list: 'addresses' as const, value: String(customer[k]).trim(), outcome: 'not_saved' as const,
                 reason: `it was sent as "${k}", a field that no longer exists — send it as billing_${k === 'address_line1' ? 'line1' : k}` }));
  try {
    ({ customerId, created, contact: contactResults } = await findOrCreateCustomer(
      db,
      businessId,
      customer,
      source || 'ocr-invoice',
      { actorUserId: await resolveCallerUid(authHeader) },
    ));
    contactResults = [...contactResults, ...retired];
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
  // Declared at FUNCTION scope, beside deliveryId, because the order insert ~100 lines below
  // reads it too. Declaring it inside `if (delivery)` compiled in the editor and failed
  // `verify:api-types` with TS2304 — the same shape as #381's ReferenceError, caught this
  // time before it shipped, by the ratchet #381 built.
  let footingHold: { missing: number } | null = null;
  if (delivery) {
    const addr = delivery.address ?? {};
    if (TRACE_DELIVERY) console.log('[TRACE:DELIVERY] create — customerId:', customerId,
      'date:', delivery.deliveryDate ?? '(none)', 'serviceType:', delivery.serviceType ?? '(none)',
      'addr:', [addr.line1, addr.city, addr.state, addr.zip].filter(Boolean).join(', ') || '(none)');

    // ── FOOTING GUARD (ledger #395) ───────────────────────────────────────────
    // 🔴 COMPUTED HERE, BEFORE THE STOP IS WRITTEN, AND THAT POSITION IS THE WHOLE FIX.
    // The same verdict was already available further down as `draft.arithmeticBalances` —
    // but the delivery is inserted at this point and the order is not built until ~70 lines
    // later, so by the time the imbalance was known the stop was already 'scheduled' and on
    // the load list. Knowing late is what made a console.warn the only possible response.
    //
    // A document whose lines do not foot to its own subtotal is HELD, not scheduled: the
    // crew never loads from it, and Lauren is told what is missing. She can correct the
    // lines or confirm. The capture itself is untouched — evidence is never edited by a guard.
    if (receiptId) {
      try {
        const { data: rcpt } = await db
          .from('receipts')
          .select('line_items, line_items_original, amount, ocr_raw')
          .eq('id', receiptId)
          .eq('business_id', businessId)
          .maybeSingle();
        if (rcpt) {
          const dec = decodeCapturedDocument(rcpt.ocr_raw);
          // the document's OWN subtotal when it decoded one, else total − tax, else the total
          const sub = dec?.subtotal ?? (dec?.tax != null ? Number(rcpt.amount ?? 0) - Number(dec.tax) : Number(rcpt.amount ?? 0));
          const f = documentFooting(rcpt.line_items ?? rcpt.line_items_original, sub);
          if (!f.balances) footingHold = { missing: f.missing };
        }
      } catch (e: any) {
        // §6 r6 — a guard that cannot read must not block the capture. It also must not
        // claim the document balanced: nothing is held, and the failure is surfaced.
        console.error('[TRACE:FOOTING] could not evaluate footing:', e?.message);
      }
    }
    if (footingHold) console.warn('[TRACE:FOOTING] HELD — lines do not foot:', footingHold);

    const baseRow: Record<string, any> = {
      business_id:   businessId,
      customer_id:   customerId,
      delivery_date: delivery.deliveryDate || null,
      address_line1: addr.line1 || null,
      city:          addr.city  || null,
      state:         addr.state || null,
      zip:           addr.zip   || null,
      // HELD keeps it off the schedule, route, load list and crew link until Lauren settles it.
      status:        footingHold ? 'held' : 'scheduled',
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

  // ── 3. HISTORY ORDER — the captured document becomes a sale record ──────────────────────
  // ══════════════════════════════════════════════════════════════════════════════════════════
  // WHY: a scanned customer invoice used to produce a customer and a delivery and NO ORDER, so a
  // business that captured six real invoices still read $0 of sales and 0 installs on its own
  // dashboard. The sale HAPPENED; only the record was missing.
  //
  // 🔴 THIS IS A HISTORY ORDER, NOT A SALE THIS PLATFORM MADE. It is already paid, already in the
  // seller's own QuickBooks, and its stock left the property before we existed. It therefore
  // NEVER pushes to QuickBooks (the push runs only from checkout, and the manual re-push refuses
  // this kind) and NEVER moves inventory. The two invariants that guarantee the second —
  // status 'fulfilled' and a NULL business_inventory_id on every line — live in ONE place,
  // `shared/business-logic/historyOrder.ts`, with the reasoning; they are not restated here
  // because a restated invariant is a copy that drifts (§6 r8 / STD-011).
  //
  // 🔴 NO CUSTOMER → NO ORDER, and it is STRUCTURAL, not a check anyone has to remember.
  // This handler REFUSES 400 without `customer.first_name` (the guard at the top), so execution
  // cannot reach this line without a resolved customer — `customerId` is non-null by the time
  // step 3 runs. A vendor receipt for hose, oil or emitters names no customer, so the OCR door
  // never calls this endpoint for one, and even a hand-rolled call carrying only a receiptId is
  // rejected before any write. Two independent reasons, which is the point: after the cleanup
  // pass there is no vendor receipt left in the tenant to demonstrate this on, so it is proven
  // by test rather than by pointing at data (`historyOrder.test.ts` §D).
  //
  // WHY THE SERVER RE-READS THE RECEIPT INSTEAD OF TAKING TOTALS FROM THE BODY: the client has
  // just written that row and could have posted its contents, but money that arrives in a request
  // body is money a caller can edit. The row is the authority, this handler already holds the
  // service key, and reading it costs one query (§1.6 item 10 — server-authoritative on money).
  //
  // §6 r6 — INTEGRATION FAILURE NEVER BLOCKS. Placed LAST, after the customer and the delivery
  // have already committed. A failure here is SURFACED as `orderError` and loses nothing: the
  // document, the customer and the delivery are all safely stored, and the order can be
  // backfilled from the receipt later by the same shared builder.
  let orderId: string | undefined;
  let orderError: string | undefined;
  if (receiptId) {
    try {
      const { data: receipt, error: rErr } = await db
        .from('receipts')
        .select('id, business_id, date, amount, ocr_raw, line_items, line_items_original')
        .eq('id', receiptId)
        .eq('business_id', businessId)   // AC-3: a receipt from another tenant is not found, never used
        .maybeSingle();

      if (rErr) throw new Error(rErr.message);
      if (!receipt) throw new Error('receipt not found for this business');

      const draft = buildHistoryOrder({
        businessId,
        customerId,
        receiptId: receipt.id,
        documentDate:  receipt.date ?? null,
        documentTotal: Number(receipt.amount ?? 0),
        // 🔴 `line_items`, NOT `line_items_original`. The _original column is the WRITE-ONCE
        // OCR snapshot (20260902's trigger says so in its own error message); Lauren's
        // corrections at capture land in `line_items`. Reading the snapshot here discarded
        // every correction she made — 8 trees off LaPrime's load list for the next morning.
        // Falls back to the snapshot only when a receipt genuinely has no corrected set.
        documentLines: receipt.line_items ?? receipt.line_items_original,
        decoded: decodeCapturedDocument(receipt.ocr_raw),
        deliveryDate: delivery?.deliveryDate || null,
        serviceType:  delivery?.serviceType  || null,
        // 🔴 THE STATUS OF THE ORDER FOLLOWS THIS. At capture the delivery has just been inserted
        // as 'scheduled', so a captured invoice lands 'confirmed' — a real, paid sale that has not
        // been delivered yet — NOT 'fulfilled'. Before this was threaded through, every capture
        // wrote 'fulfilled' at the moment of scanning, asserting that trees scheduled for a future
        // Saturday had already left the property.
        deliveryStatus: deliveryId ? (footingHold ? 'held' : 'scheduled') : null,
      });

      if (TRACE_HISTORY) console.log('[TRACE:HISTORY] building history order — receipt:', receipt.id,
        'saleDate:', draft.order.sale_date ?? '(none)', 'docNumber:', draft.order.source_document_number ?? '(none)',
        'lines:', draft.items.length, 'total:', draft.order.total_amount,
        'moneySource:', draft.moneySource, 'arithmeticBalances:', draft.arithmeticBalances);

      // The document is the authority on a captured sale, so an imbalance is REPORTED, never
      // silently corrected — but it is loud, because it means the transcription lost something.
      if (!draft.arithmeticBalances) console.warn('[TRACE:HISTORY] document does not balance — recorded AS PRINTED, not corrected:',
        { receiptId: receipt.id, lineSum: draft.lineSum, subtotal: draft.order.subtotal, tax: draft.order.tax_amount, total: draft.order.total_amount });

      const { data: ord, error: oErr } = await db.from('orders').insert(draft.order).select('id').single();
      if (oErr) throw new Error(oErr.message);
      orderId = ord?.id;

      if (draft.items.length) {
        const { error: iErr } = await db.from('order_items').insert(draft.items.map(l => ({
          order_id: orderId,
          quantity: l.quantity,
          unit_price: l.unitPrice,
          subtotal: l.subtotal,
          description: l.description,
          sku: l.sku,
          business_inventory_id: l.businessInventoryId,   // null — invariant (1)
        })));
        if (iErr) throw new Error(iErr.message);
      }

      // Close the loop the name-correlation used to stand in for: receipt → order → delivery,
      // all real keys. Best-effort — a delivery that fails to link is worth a line in the trail,
      // not a lost order.
      if (deliveryId) {
        // A8 — row-count-checked, and it is NOT ceremony here. PostgREST reports NO ERROR when an
        // UPDATE matches zero rows, so an unlinked delivery would look exactly like a linked one.
        // This FK is the entire point of the build: it replaces a heuristic that matched receipts
        // to deliveries on the OCR'd customer name. A link that silently fails to land puts us
        // back on that heuristic with nobody aware it happened.
        const { data: linked, error: dErr } = await db.from('deliveries')
          .update({ order_id: orderId }).eq('id', deliveryId).eq('business_id', businessId).select('id');
        if (dErr) console.error('[TRACE:HISTORY] delivery link FAILED (order kept):', dErr.message);
        else if (linked?.length !== 1) console.error('[TRACE:HISTORY] delivery link affected',
          linked?.length ?? 0, 'rows, expected 1 — the order is NOT linked to its delivery:', { orderId, deliveryId });
      }

      if (TRACE_HISTORY) console.log('[TRACE:HISTORY] history order created — id:', orderId,
        'receipt:', receipt.id, 'delivery:', deliveryId ?? '(none)', 'items:', draft.items.length,
        'status:', draft.order.status, 'kind:', draft.order.order_kind);
    } catch (err: any) {
      orderError = err.message;
      console.error('[TRACE:HISTORY] history order FAILED (customer + delivery kept):', err.message);
    }
  } else if (TRACE_HISTORY) {
    console.log('[TRACE:HISTORY] no receiptId supplied — no history order (a document with no customer never reaches here)');
  }

  // The capture screen renders `footingHeld` — the stop exists but is HELD, and saying so is
  // the point: a silent hold reads as a lost capture, which is the defect one door over.
  return res.json({ ok: true, customerId, created, contactResults, deliveryId, deliveryError, orderId, orderError,
    footingHeld: footingHold
      ? { missing: footingHold.missing, message: footingMessage(footingHold.missing) }
      : null });
}
