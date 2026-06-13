import { useState } from 'react';
import { sendSilently } from '@trace/shared/notifications';
import type { ServiceSelection } from '../types/order';
import type { ServiceOffering } from '../types/plant';
import type { CustomerInput } from '../types/customer';
import type { Plant } from '../types/plant';

export interface SubmitPayload {
  customer:          CustomerInput;
  plant:             Plant;
  quantity:          number;
  services:          ServiceSelection[];
  selectedTransport: ServiceOffering | null;
  nettingDeclined:   boolean;
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
        customer, plant, quantity, services, selectedTransport,
        nettingDeclined, businessId,
      } = payload;

      const res = await fetch('/api/orders/submit', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          customer, plant, quantity, services, selectedTransport,
          nettingDeclined, businessId,
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
          console.warn('[QB] invoice creation failed:', await qbRes.text());
        }
      } catch (qbErr) {
        console.warn('[QB] invoice call threw:', qbErr);
      }

      // ── Order confirmation email — non-blocking ──────────────────────────
      const isSelf          = selectedTransport?.transport_mode === 'self';
      const nettingSelection = services.find(
        s => s.offering.trigger_transport_mode === 'self' && s.offering.category === 'addon',
      );
      const nettingActive  = isSelf && (nettingSelection?.selected ?? false);
      const servicesAmount = services
        .filter(s => s.selected)
        .reduce((sum, s) => {
          const p = s.offering.price_type === 'per_unit'
            ? s.offering.price * quantity
            : s.offering.price;
          return sum + p;
        }, 0);
      const transportAmount = selectedTransport
        ? selectedTransport.price_type === 'per_unit'
          ? selectedTransport.price * quantity
          : selectedTransport.price
        : 0;
      const addonsAmount = servicesAmount + transportAmount;

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
          plantName:     plant.common_name ?? plant.species,
          container:     plant.current_container,
          quantity,
          plantTotal:    `$${((plant.business_inventory?.unit_cost ?? 0) * quantity).toFixed(2)}`,
          addonsTotal:   `$${addonsAmount.toFixed(2)}`,
          subtotal:      `$${subtotal.toFixed(2)}`,
          tax:           `$${taxAmount.toFixed(2)}`,
          total:         `$${total.toFixed(2)}`,
          transport:     selectedTransport?.transport_mode ?? 'self',
          nettingActive,
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
