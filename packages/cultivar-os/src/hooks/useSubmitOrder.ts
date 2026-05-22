import { useState } from 'react';
import { DEMO_NURSERY_ID } from '../lib/constants';
import { sendSilently } from '@trace/shared/notifications';
import type { CartAddon } from '../types/order';
import type { CustomerInput } from '../types/customer';
import type { Plant } from '../types/plant';
import type { TransportOption } from '../lib/constants';

export interface SubmitPayload {
  customer: CustomerInput;
  plant: Plant;
  quantity: number;
  addons: CartAddon[];
  transport: TransportOption;
  nettingDeclined: boolean;
  nettingPrice: number;
}

export interface OrderResult {
  orderId: string;
  invoiceNumber: string;
  total: number;
  subtotal: number;
  taxAmount: number;
  qbInvoiceId?: string;
  qbInvoiceNumber?: string;
  qbInvoiceUrl?: string;
  qbStatus: 'success' | 'pending';
}

export function useSubmitOrder() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(payload: SubmitPayload): Promise<OrderResult> {
    setSubmitting(true);
    setError(null);

    try {
      const { customer, plant, quantity, addons, transport, nettingDeclined, nettingPrice } = payload;
      const nurseryId = DEMO_NURSERY_ID;

      // ── DB writes via service-role serverless function ─────────────────────
      const res = await fetch('/api/orders/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer, plant, quantity, addons, transport, nettingDeclined, nettingPrice, nurseryId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Order submission failed (${res.status})`);
      }

      const { orderId, invoiceNumber, total, subtotal, taxAmount } = await res.json();

      // ── QB invoice — non-blocking, never throws ────────────────────────────
      let qbInvoiceId: string | undefined;
      let qbInvoiceNumber: string | undefined;
      let qbInvoiceUrl: string | undefined;
      let qbStatus: 'success' | 'pending' = 'pending';

      try {
        const apiBase = (import.meta.env.VITE_API_URL as string) ?? '';
        const qbRes = await fetch(`${apiBase}/api/qbo/invoice/cultivar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, nursery_id: nurseryId }),
        });
        if (qbRes.ok) {
          const qbData = await qbRes.json();
          qbInvoiceId     = qbData.qb_invoice_id ?? undefined;
          qbInvoiceNumber = qbData.qb_invoice_number ?? undefined;
          qbInvoiceUrl    = qbData.qb_invoice_url ?? undefined;
          qbStatus        = qbData.success === true ? 'success' : 'pending';
        } else {
          console.warn('[QB] invoice creation failed:', await qbRes.text());
        }
      } catch (qbErr) {
        console.warn('[QB] invoice call threw:', qbErr);
      }

      // ── Order confirmation email — non-blocking, never throws ──────────────
      const isSelf = transport === 'self';
      const nettingDbAddon = addons.find((a) => a.addon.trigger_rule === 'transport=self');
      const nettingActive = isSelf && !nettingDeclined;
      const nettingUnitPrice = nettingDbAddon?.addon.price_per_plant ?? nettingPrice;
      const nettingTotal = nettingActive ? nettingUnitPrice * quantity : 0;
      const alwaysAddons = addons.filter((a) => a.selected && a.addon.trigger_rule === 'always');
      const alwaysTotal = alwaysAddons.reduce((sum, a) => sum + a.addon.price_per_plant * quantity, 0);
      const addonsAmount = nettingTotal + alwaysTotal;
      const plantSubtotal = plant.base_price * quantity;

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
          plantTotal:    `$${plantSubtotal.toFixed(2)}`,
          addonsTotal:   `$${addonsAmount.toFixed(2)}`,
          subtotal:      `$${subtotal.toFixed(2)}`,
          tax:           `$${taxAmount.toFixed(2)}`,
          total:         `$${total.toFixed(2)}`,
          transport,
          nettingActive,
          payOnline:     false,
          payUrl:        '',
        },
        entityId: orderId,
        tenantId: nurseryId,
      });

      // ── Social post generation — non-blocking, never throws ───────────────
      fetch('/api/social/generate-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nursery_id:          nurseryId,
          order_id:            orderId,
          plant_species:       plant.species,
          plant_common_name:   plant.common_name ?? undefined,
          plant_container:     plant.current_container,
          customer_first_name: customer.first_name,
          addons_purchased:    addons
            .filter((a) => a.selected)
            .map((a) => a.addon.name),
        }),
      }).catch(() => {});

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
