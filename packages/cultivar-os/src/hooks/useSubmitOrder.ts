import { useState } from 'react';
import { sendSilently } from '@trace/shared/notifications';
import type { NotifyBusiness } from '@trace/shared/notifications';
import { supabase } from '../lib/supabase';
import type { ServiceSelection } from '../types/order';
import type { ServiceOffering } from '../types/plant';
import type { CustomerInput } from '../types/customer';
import type { Plant } from '../types/plant';
import type { PricedLine } from '@trace/shared/business-logic';
import { nettedQuantity, lineSubtotal, totalPlantCount, isNettingOffering } from '../lib/netting';

// D-39: the server-authoritative per-line breakdown returned by submit — the Confirmation receipt
// renders THIS (not the client Review preview), so Confirmation === QBO and the discount is visible.
/**
 * The THREE honest states of a QuickBooks invoice push (D-48 · D-9 Surface Honesty). There is no
 * 'pending': the push is synchronous, so "will sync shortly" was never true — it was the absence of
 * a failed state. Each maps to distinct owner copy and a distinct owner action:
 *   • 'success'       — the invoice exists in QBO.
 *   • 'not_connected' — QBO isn't connected / the token expired (503) → connect, then re-push.
 *   • 'failed'        — QBO rejected it or the call failed → the owner sees the reason and fixes it.
 *   • 'held'          — the push is deliberately PAUSED for this business (409 PUSH_HELD) → the
 *                       order is complete and correct and NOTHING is wrong; there is no owner
 *                       action, and the copy says who can lift it.
 *
 * 🔴 'held' IS A FOURTH STATE RATHER THAN A REUSE OF 'not_connected', and the reason is the
 * same one that created these three: `not_connected` renders "QuickBooks isn't connected —
 * connect it from the owner dashboard", which on a held push is FALSE TWICE (it IS connected,
 * and reconnecting changes nothing). That is the exact shape of the defect D-48 ended. A
 * deliberate pause reported as a connection problem is a lie with a call to action attached.
 */
export type QbSyncStatus = 'success' | 'not_connected' | 'failed' | 'held';

export interface OrderBreakdown {
  lines:               PricedLine[];
  goodsRetailSubtotal: number;
  /** the customer's TIER discount on goods — NOT the owner's service concessions (D-48) */
  discountTotal:       number;
  /** D-48: Σ the owner's service price concessions, kept separate from the tier's discount */
  serviceAdjustmentTotal?: number;
  discountedSubtotal:  number;
  discountLabel:       string | null;
}

export interface SubmitPayload {
  customer:          CustomerInput;
  // Customer-first attach (ways 1 & 4). customerId set → the server uses THAT existing customer
  // row directly (no typed-field dedup). Null/absent → the server find-or-creates as before.
  customerId?:       string | null;
  // Order-scoped tier invoke (way 4). A tier NAME applied to THIS order only. Honored server-side
  // ONLY on a token-verified owner/manager path (tamper defense); null/absent → the customer's
  // stored price_tier governs.
  invokedTier?:      string | null;
  lines:             { plant: Plant; quantity: number }[];   // multi-item: one entry per cart line
  services:          ServiceSelection[];
  selectedTransport: ServiceOffering | null;
  plantingOffering:  ServiceOffering | null;   // per-plant planting service (branch: Delivery + planting)
  plantingSelected:  boolean;
  nettingDeclined:   boolean;
  // Owner-confirmed netted quantities (offering id → qty). Absent ⇒ server applies the rule.
  serviceQuantities: Record<string, number>;
  // Owner/manager PRICE overrides (offering id → { amount, reason }). Honored ONLY on a
  // token-verified owner/manager path server-side; ignored (tamper defense) otherwise.
  serviceOverrides?: Record<string, { amount: number; reason: string }>;
  deliveryDate?:     string | null;   // owner/manager-entered delivery date (ISO 'YYYY-MM-DD')
  // D-40: per-order tax-exemption OVERRIDE (owner/manager only). Honored server-side ONLY on a
  // token-verified apply_tax_exempt path; ignored (tamper defense) otherwise. Null/absent → the
  // customer's PERSISTENT exemption governs.
  orderExemption?:   { exempt: boolean; reason?: string | null; certRef?: string | null } | null;
  businessId:        string;
  // AC-1: the ACTIVE business identity (name/address/phone/email), threaded into the customer-facing
  // confirmation notification so the email renders the true tenant — never a hardcoded brand. Resolved
  // from the business_id-scoped context at the call site (CartReview). Omitted → the template omits it.
  business?:         NotifyBusiness;
}

export interface OrderResult {
  orderId:         string;
  invoiceNumber:   string;
  total:           number;
  subtotal:        number;
  taxAmount:       number;
  qbInvoiceId?:    string;
  qbInvoiceNumber?: string;
  qbInvoiceUrl?:   string;
  qbStatus:        QbSyncStatus;
  /** D-48: the REAL reason a push failed (owner-facing). Present only when qbStatus === 'failed'. */
  qbError?:        string;
  breakdown?:      OrderBreakdown;   // D-39: server-authoritative per-line breakdown for the receipt
  // D-40: the authoritative tax state — the receipt/email render it (redline / taxed / exempt).
  taxStatus?:      'not_identified' | 'taxed' | 'exempt';
  taxRate?:        number | null;    // the origin rate (for the taxed %); null when not identified
  taxExemptReason?: string | null;
  taxExemptCertRef?: string | null;
}

export function useSubmitOrder() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function submit(payload: SubmitPayload): Promise<OrderResult> {
    setSubmitting(true);
    setError(null);

    try {
      const {
        customer, customerId, invokedTier, lines, services, selectedTransport, plantingOffering, plantingSelected,
        nettingDeclined, serviceQuantities, serviceOverrides, deliveryDate, orderExemption, businessId, business,
      } = payload;

      // Attach the caller's Bearer token when a session exists so the server can VERIFY an
      // owner/manager for a price override (attributed leakage). An anon customer has no session
      // → no token → the server ignores any overrides (tamper defense) and charges the baseline.
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};

      const res = await fetch('/api/orders/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders },
        body:    JSON.stringify({
          customer, customerId, invokedTier, lines, services, selectedTransport, plantingOffering, plantingSelected,
          nettingDeclined, serviceQuantities, serviceOverrides, deliveryDate, orderExemption, businessId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Order submission failed (${res.status})`);
      }

      const { orderId, invoiceNumber, total, subtotal, taxAmount, breakdown,
              taxStatus, taxRate, taxExemptReason, taxExemptCertRef,
              // ── QB invoice — now returned BY THE SUBMIT RESPONSE ────────────────────────────
              // The browser used to make a SECOND call to /api/qbo/invoice/cultivar right here.
              // That endpoint had no caller check and took business_id from the body — the last
              // of the eight unauthenticated cross-tenant writes (2026-07-27). It is closed by
              // DELETING THE HOP: submit.ts already holds the order, the business and the service
              // key, so it pushes inline and returns the result. One round trip, not two.
              //
              // D-48's THREE HONEST STATES are unchanged, they are just decided server-side now:
              // success · not_connected (QBO genuinely not connected → the connect prompt IS the
              // right answer) · failed (a real failure the owner must see and act on). Everything
              // downstream reads the same variables it always did.
              //
              // NON-BLOCKING still holds (§6 r6): the order writes COMMIT BEFORE the push begins,
              // so a failed — or even a KILLED — push leaves a whole order with qbStatus 'failed',
              // which is exactly what the manual re-push endpoint repairs.
              qbInvoiceId, qbInvoiceNumber, qbInvoiceUrl, qbStatus: qbStatusRaw, qbError } = await res.json();
      const qbStatus: QbSyncStatus = (qbStatusRaw as QbSyncStatus) ?? 'failed';
      console.log('[TRACE:CHECKOUT] QBO result carried on the submit response —',
        { orderId, qbStatus, qbInvoiceId: qbInvoiceId ?? null, qbError: qbError ?? null });

      // ── Order confirmation email — non-blocking ──────────────────────────
      const plantCount   = totalPlantCount(lines);
      const isSelf       = selectedTransport?.transport_mode === 'self';
      const nettingSel   = services.find(s => isNettingOffering(s.offering));
      const nettingOn    = isSelf && (nettingSel?.selected ?? false) && !nettingDeclined;
      // Service amount honors the owner-adjusted netted quantities.
      const qtyFor = (o: ServiceOffering) => serviceQuantities[o.id] ?? nettedQuantity(o, plantCount);
      const servicesAmount = services
        .filter(s => s.selected)
        .reduce((sum, s) => sum + lineSubtotal(s.offering, qtyFor(s.offering)), 0);
      const transportAmount = selectedTransport ? lineSubtotal(selectedTransport, qtyFor(selectedTransport)) : 0;
      const plantingAmount  = plantingSelected && plantingOffering ? lineSubtotal(plantingOffering, qtyFor(plantingOffering)) : 0;
      const addonsAmount = servicesAmount + transportAmount + plantingAmount;
      // D-35: sale price, not cost. Sum across every line.
      const plantsTotal = lines.reduce((sum, l) => sum + (l.plant.business_inventory?.sell_price ?? 0) * l.quantity, 0);
      const firstPlant  = lines[0]?.plant;
      const plantLabel  = lines.length === 1
        ? (firstPlant?.common_name ?? firstPlant?.species ?? 'your order')
        : `${firstPlant?.common_name ?? firstPlant?.species ?? 'your order'} +${lines.length - 1} more`;

      sendSilently({
        vertical:   'cultivar',
        templateId: 'order_confirmation',
        to: {
          email:      customer.email,
          name:       `${customer.first_name} ${customer.last_name}`,
          emailOptIn: customer.marketing_opt_in ?? true,
        },
        data: {
          business,   // AC-1: active tenant identity → the email renders the true business, not a literal
          customerName:  `${customer.first_name} ${customer.last_name}`,
          invoiceNumber,
          plantName:     plantLabel,
          container:     firstPlant?.current_container ?? '',
          quantity:      plantCount,
          plantTotal:    `$${plantsTotal.toFixed(2)}`,
          addonsTotal:   `$${addonsAmount.toFixed(2)}`,
          subtotal:      `$${subtotal.toFixed(2)}`,
          tax:           `$${taxAmount.toFixed(2)}`,
          total:         `$${total.toFixed(2)}`,
          // D-40: the authoritative tax state → the email renders redline / taxed(%) / exempt(reason),
          // NOT a hardcoded "Tax (8.25%)". taxAmountNum feeds the shared describeTaxLine presenter.
          taxStatus:        taxStatus ?? 'taxed',
          taxAmountNum:     taxAmount,
          taxRate:          taxRate ?? null,
          taxExemptReason:  taxExemptReason ?? null,
          taxExemptCertRef: taxExemptCertRef ?? null,
          transport:     selectedTransport?.transport_mode ?? 'self',
          nettingActive: nettingOn,
          payOnline:     false,
          payUrl:        '',
        },
        entityId: orderId,
        tenantId: businessId,
      });

      return { orderId, invoiceNumber, total, subtotal, taxAmount, qbInvoiceId, qbInvoiceNumber, qbInvoiceUrl, qbStatus, qbError, breakdown,
               taxStatus, taxRate, taxExemptReason, taxExemptCertRef };

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Submission failed';
      setError(msg);
      throw err;
    } finally {
      setSubmitting(false);
    }
  }

  return { submit, submitting, error };
}
