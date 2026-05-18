import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { DEMO_NURSERY_ID, LARGE_CONTAINERS, TAX_RATE } from '../lib/constants';
import { buildTransportNote } from '../types/order';
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
}

export function useSubmitOrder() {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(payload: SubmitPayload): Promise<OrderResult> {
    setSubmitting(true);
    setError(null);

    try {
      const {
        customer, plant, quantity, addons,
        transport, nettingDeclined, nettingPrice,
      } = payload;
      const nurseryId = DEMO_NURSERY_ID;

      // ── 1. Find or create customer ─────────────────────────────────────────
      let customerId: string;

      const { data: existing } = await supabase
        .from('customers')
        .select('id')
        .eq('nursery_id', nurseryId)
        .eq('email', customer.email)
        .limit(1);

      if (existing && existing.length > 0) {
        customerId = existing[0].id;
        await supabase.from('customers').update({
          first_name:     customer.first_name,
          last_name:      customer.last_name,
          phone:          customer.phone ?? null,
          address_line1:  customer.address_line1 ?? null,
          city:           customer.city ?? null,
          state:          customer.state ?? 'TX',
          zip:            customer.zip ?? null,
          marketing_opt_in: customer.marketing_opt_in ?? true,
        }).eq('id', customerId);
      } else {
        const { data: newCustomer, error: custErr } = await supabase
          .from('customers')
          .insert({
            nursery_id:     nurseryId,
            first_name:     customer.first_name,
            last_name:      customer.last_name,
            email:          customer.email,
            phone:          customer.phone ?? null,
            address_line1:  customer.address_line1 ?? null,
            city:           customer.city ?? null,
            state:          customer.state ?? 'TX',
            zip:            customer.zip ?? null,
            marketing_opt_in: customer.marketing_opt_in ?? true,
            source:         'qr-scan',
          })
          .select('id')
          .single();

        if (custErr) throw new Error(`Customer: ${custErr.message}`);
        customerId = newCustomer.id;
      }

      // ── 2. Calculate totals ────────────────────────────────────────────────
      const isSelf = transport === 'self';
      const nettingActive = isSelf && !nettingDeclined;

      // Netting: use DB addon price if it's in the addons list, else fallback
      const nettingDbAddon = addons.find((a) => a.addon.trigger_rule === 'transport=self');
      const nettingUnitPrice = nettingDbAddon?.addon.price_per_plant ?? nettingPrice;
      const nettingTotal = nettingActive ? nettingUnitPrice * quantity : 0;

      // Always addons (selected)
      const alwaysAddons = addons.filter(
        (a) => a.selected && a.addon.trigger_rule === 'always',
      );
      const alwaysTotal = alwaysAddons.reduce(
        (sum, a) => sum + a.addon.price_per_plant * quantity,
        0,
      );

      const plantSubtotal = plant.base_price * quantity;
      const addonsAmount  = nettingTotal + alwaysTotal;
      const subtotal      = plantSubtotal + addonsAmount;
      const taxAmount     = Math.round(subtotal * TAX_RATE * 100) / 100;
      const total         = subtotal + taxAmount;

      // ── 3. Leakage flag ────────────────────────────────────────────────────
      const isLargeContainer = LARGE_CONTAINERS.includes(plant.current_container);
      const leakageFlag = isLargeContainer && addonsAmount === 0;

      // ── 4. Transport note ──────────────────────────────────────────────────
      const transportNote = buildTransportNote(transport, nettingDeclined, nettingActive);

      // ── 5. Invoice number ──────────────────────────────────────────────────
      const now = new Date();
      const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
      const seq = String(now.getMinutes() * 60 + now.getSeconds()).padStart(3, '0');
      const invoiceNumber = `CLV-${datePart}-${seq}`;

      // ── 6. Create order ────────────────────────────────────────────────────
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          nursery_id:       nurseryId,
          customer_id:      customerId,
          transport_method: transport,
          transport_note:   transportNote,
          netting_declined: nettingDeclined,
          subtotal,
          tax_amount:       taxAmount,
          total_amount:     total,
          addons_amount:    addonsAmount,
          leakage_flag:     leakageFlag,
          notes:            invoiceNumber,
          status:           'pending',
        })
        .select('id')
        .single();

      if (orderErr) throw new Error(`Order: ${orderErr.message}`);
      const orderId = order.id;

      // ── 7. Order item ──────────────────────────────────────────────────────
      const { error: itemErr } = await supabase.from('order_items').insert({
        order_id:  orderId,
        plant_id:  plant.id,
        quantity,
        unit_price: plant.base_price,
        subtotal:  plantSubtotal,
      });
      if (itemErr) throw new Error(`Order item: ${itemErr.message}`);

      // ── 8. Order addons ────────────────────────────────────────────────────
      if (nettingActive && nettingDbAddon) {
        await supabase.from('order_addons').insert({
          order_id:  orderId,
          addon_id:  nettingDbAddon.addon.id,
          quantity,
          unit_price: nettingUnitPrice,
          subtotal:  nettingTotal,
        });
      }
      for (const ca of alwaysAddons) {
        await supabase.from('order_addons').insert({
          order_id:  orderId,
          addon_id:  ca.addon.id,
          quantity,
          unit_price: ca.addon.price_per_plant,
          subtotal:  ca.addon.price_per_plant * quantity,
        });
      }

      // ── 9. Reserve plant ───────────────────────────────────────────────────
      await supabase
        .from('plants')
        .update({ status: 'reserved', updated_at: new Date().toISOString() })
        .eq('id', plant.id);

      return { orderId, invoiceNumber, total, subtotal, taxAmount };

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
