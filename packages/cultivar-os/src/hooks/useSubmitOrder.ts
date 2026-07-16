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
 */
export type QbSyncStatus = 'success' | 'not_connected' | 'failed';

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
              taxStatus, taxRate, taxExemptReason, taxExemptCertRef } = await res.json();

      // ── QB invoice — non-blocking ────────────────────────────────────────
      let qbInvoiceId: string | undefined;
      let qbInvoiceNumber: string | undefined;
      let qbInvoiceUrl: string | undefined;
      // D-48 (D-9 Surface Honesty): THREE honest states, not two. The old code collapsed every
      // non-success into 'pending', so a hard 400 rendered "Invoice will sync to QuickBooks shortly
      // — Connect QuickBooks from the owner dashboard". That was wrong twice: QBO WAS connected
      // (it had created a customer seconds earlier), and nothing was going to sync — ever. A
      // validation failure is not a connection problem and it is not a pending sync.
      let qbStatus: QbSyncStatus = 'failed';
      let qbError: string | undefined;

      try {
        const qbRes = await fetch('/api/qbo/invoice/cultivar', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ order_id: orderId, business_id: businessId }),
        });
        if (qbRes.ok) {
          const qbData    = await qbRes.json();
          qbInvoiceId     = qbData.qb_invoice_id   ?? undefined;
          qbInvoiceNumber = qbData.qb_invoice_number ?? undefined;
          qbInvoiceUrl    = qbData.qb_invoice_url   ?? undefined;
          qbStatus        = qbData.success === true && qbInvoiceId ? 'success' : 'failed';
          if (qbStatus === 'failed') qbError = 'QuickBooks returned no invoice for this order.';
        } else {
          // 503 = genuinely not connected / token expired → the connect prompt IS the right answer.
          // Anything else (400 validation, 409 identity conflict, 500) is a REAL failure the owner
          // must see and act on. NON-BLOCKING either way: the order already exists and stands.
          const body = await qbRes.json().catch(() => ({} as any));
          qbStatus = qbRes.status === 503 ? 'not_connected' : 'failed';
          qbError  = body?.error || `QuickBooks rejected the invoice (HTTP ${qbRes.status}).`;
          console.log('[TRACE:CHECKOUT] QBO invoice NOT created — degraded gracefully, did NOT throw',
            { status: qbRes.status, qbStatus, orderId, code: body?.code ?? null, detail: qbError });
        }
      } catch (qbErr) {
        // A network/parse throw is a failure, NOT "not connected" — do not point the owner at the
        // connect button for a problem that isn't the connection.
        qbStatus = 'failed';
        qbError  = qbErr instanceof Error ? qbErr.message : String(qbErr);
        console.log('[TRACE:CHECKOUT] QBO invoice call threw — caught, degraded gracefully, order stands',
          { qbStatus, orderId, error: qbError });
      }

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
