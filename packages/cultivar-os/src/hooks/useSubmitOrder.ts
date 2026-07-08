import { useState } from 'react';
import { sendSilently } from '@trace/shared/notifications';
import type { ServiceSelection } from '../types/order';
import type { ServiceOffering } from '../types/plant';
import type { CustomerInput } from '../types/customer';
import type { Plant } from '../types/plant';
import { nettedQuantity, lineSubtotal, totalPlantCount, isNettingOffering } from '../lib/netting';

export interface SubmitPayload {
  customer:          CustomerInput;
  lines:             { plant: Plant; quantity: number }[];   // multi-item: one entry per cart line
  services:          ServiceSelection[];
  selectedTransport: ServiceOffering | null;
  nettingDeclined:   boolean;
  // Owner-confirmed netted quantities (offering id → qty). Absent ⇒ server applies the rule.
  serviceQuantities: Record<string, number>;
  businessId:        string;
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
  qbStatus:        'success' | 'pending';
}

export function useSubmitOrder() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  async function submit(payload: SubmitPayload): Promise<OrderResult> {
    setSubmitting(true);
    setError(null);

    try {
      const {
        customer, lines, services, selectedTransport,
        nettingDeclined, serviceQuantities, businessId,
      } = payload;

      const res = await fetch('/api/orders/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          customer, lines, services, selectedTransport,
          nettingDeclined, serviceQuantities, businessId,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Order submission failed (${res.status})`);
      }

      const { orderId, invoiceNumber, total, subtotal, taxAmount } = await res.json();

      // ── QB invoice — non-blocking ────────────────────────────────────────
      let qbInvoiceId: string | undefined;
      let qbInvoiceNumber: string | undefined;
      let qbInvoiceUrl: string | undefined;
      let qbStatus: 'success' | 'pending' = 'pending';

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
          qbStatus        = qbData.success === true ? 'success' : 'pending';
        } else {
          // QB not connected / token expired / QB error (incl. 503). NON-BLOCKING: the order
          // is already created — leave qbStatus 'pending' so confirmation renders "invoice to
          // follow" WITHOUT a QB invoice object. Never throws to the UI. (Bug 2 hard req.)
          console.log('[TRACE:CHECKOUT] QBO invoice unavailable — degraded gracefully, did NOT throw',
            { status: qbRes.status, qbStatus: 'pending', orderId, detail: await qbRes.text().catch(() => '') });
        }
      } catch (qbErr) {
        console.log('[TRACE:CHECKOUT] QBO invoice call threw — caught, degraded gracefully, order stands',
          { qbStatus: 'pending', orderId, error: qbErr instanceof Error ? qbErr.message : String(qbErr) });
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
      const addonsAmount = servicesAmount + transportAmount;
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
          transport:     selectedTransport?.transport_mode ?? 'self',
          nettingActive: nettingOn,
          payOnline:     false,
          payUrl:        '',
        },
        entityId: orderId,
        tenantId: businessId,
      });

      return { orderId, invoiceNumber, total, subtotal, taxAmount, qbInvoiceId, qbInvoiceNumber, qbInvoiceUrl, qbStatus };

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
