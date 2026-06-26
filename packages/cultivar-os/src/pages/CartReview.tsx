import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useSubmitOrder } from '../hooks/useSubmitOrder';
import { useBusinessContext } from '@trace/shared/context';
import { TAX_RATE } from '../lib/constants';

export function CartReview() {
  const navigate = useNavigate();
  const { item, services, selectedTransport, nettingDeclined, customer, clear } = useCart();
  const { submit, submitting, error: submitError } = useSubmitOrder();
  const { business } = useBusinessContext();
  const [payOnline, setPayOnline] = useState<boolean | null>(null);

  if (!item) {
    navigate('/', { replace: true });
    return null;
  }
  if (!customer) {
    navigate('/checkout/customer', { replace: true });
    return null;
  }

  const { plant, quantity } = item;

  // Transport
  const transportAmount = selectedTransport
    ? selectedTransport.price_type === 'per_unit'
      ? selectedTransport.price * quantity
      : selectedTransport.price
    : 0;

  // Netting
  const nettingSelection = services.find(
    s => s.offering.trigger_transport_mode === 'self' && s.offering.category === 'addon',
  );
  const isSelf        = selectedTransport?.transport_mode === 'self';
  const nettingActive = isSelf && (nettingSelection?.selected ?? false);
  const nettingPrice  = nettingSelection?.offering.price ?? 10;
  const nettingTotal  = nettingActive ? nettingPrice * quantity : 0;

  // Other addons (no transport trigger)
  const otherAddons = services.filter(
    s => s.selected && s.offering.category === 'addon' && !s.offering.trigger_transport_mode,
  );
  const otherTotal = otherAddons.reduce((sum, s) => {
    const p = s.offering.price_type === 'per_unit'
      ? s.offering.price * quantity
      : s.offering.price;
    return sum + p;
  }, 0);

  // Tax rate from the business's own setting (businesses.tax_rate, editable in Settings);
  // the hardcoded TAX_RATE constant is only a fallback for a row that predates the column.
  // The server (orders/submit) recomputes from the same column — display and invoice agree.
  const taxRate       = business?.tax_rate ?? TAX_RATE;
  const plantSubtotal = (plant.business_inventory?.unit_cost ?? 0) * quantity;
  const addonsAmount  = transportAmount + nettingTotal + otherTotal;
  const subtotal      = plantSubtotal + addonsAmount;
  const taxAmount     = Math.round(subtotal * taxRate * 100) / 100;
  const total         = subtotal + taxAmount;

  async function handleSubmit(online: boolean) {
    setPayOnline(online);
    try {
      const result = await submit({
        customer: customer!,
        plant,
        quantity,
        services,
        selectedTransport,
        nettingDeclined,
        businessId: plant.business_id,
      });
      navigate('/checkout/confirm', {
        state: {
          orderId:         result.orderId,
          invoiceNumber:   result.invoiceNumber,
          total:           result.total,
          subtotal:        result.subtotal,
          taxAmount:       result.taxAmount,
          email:           customer!.email,
          payOnline:       online,
          qbInvoiceId:     result.qbInvoiceId,
          qbInvoiceNumber: result.qbInvoiceNumber,
          qbInvoiceUrl:    result.qbInvoiceUrl,
          qbStatus:        result.qbStatus,
        },
      });
    } catch {
      setPayOnline(null);
    }
  }

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
        <button
          onClick={() => navigate('/checkout/customer')}
          style={{
            background: 'none', border: 'none', color: '#27500A',
            fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
            padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ← Back
        </button>
      </div>
      <div style={{ padding: '12px 16px 0' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1f2937' }}>
          Review your order
        </h1>
      </div>

      {/* Order lines */}
      <div className="section">
        <p style={{
          fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
        }}>
          Order summary
        </p>

        {/* Plant */}
        <OrderLine
          label={`${plant.common_name ?? plant.species} · ${plant.current_container} × ${quantity}`}
          amount={plantSubtotal}
        />

        {/* Other addons */}
        {otherAddons.map(s => (
          <OrderLine
            key={s.offering.id}
            label={`${s.offering.name} × ${quantity}`}
            amount={s.offering.price_type === 'per_unit' ? s.offering.price * quantity : s.offering.price}
          />
        ))}

        {/* Netting */}
        {isSelf && (
          nettingActive ? (
            <OrderLine
              label={`Travel netting × ${quantity}`}
              amount={nettingTotal}
              prefix="✓ "
            />
          ) : (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#9ca3af' }}>
                <span>⚠ Netting declined</span>
                <span>$0.00</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 2 }}>
                Customer acknowledged TX TCC Ch.725
              </p>
            </div>
          )
        )}

        {/* Transport */}
        {selectedTransport && (
          selectedTransport.transport_mode === 'self' ? null : (
            transportAmount > 0 ? (
              <OrderLine
                label={`${selectedTransport.name} · ${quantity} plant${quantity > 1 ? 's' : ''}`}
                amount={transportAmount}
                prefix="✓ "
              />
            ) : (
              <div style={{
                display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem',
                color: '#27500A', marginBottom: 10, fontWeight: 500,
              }}>
                <span>✓ {business?.name ?? 'Staff'} — {selectedTransport.name.toLowerCase()}</span>
                <span>—</span>
              </div>
            )
          )
        )}

        {/* Totals */}
        <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 8, paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
            <span>Subtotal</span>
            <span>${subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
            <span>Tax ({(taxRate * 100).toFixed(2).replace(/\.00$/, '')}%)</span>
            <span>${taxAmount.toFixed(2)}</span>
          </div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', fontSize: '1.0625rem',
            fontWeight: 700, color: '#1f2937', paddingTop: 6, borderTop: '1px solid #e5e7eb',
          }}>
            <span>Total</span>
            <span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Customer summary */}
      <div className="section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sending to
          </p>
          <button
            onClick={() => navigate('/checkout/customer')}
            style={{ background: 'none', border: 'none', fontSize: '0.875rem', color: '#27500A', fontWeight: 600, cursor: 'pointer', padding: 0 }}
          >
            Edit
          </button>
        </div>
        <p style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#1f2937' }}>
          {customer.first_name} {customer.last_name}
        </p>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>{customer.email}</p>
        {customer.phone && (
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>{customer.phone}</p>
        )}
      </div>

      {/* Error */}
      {submitError && (
        <div style={{ margin: '0 16px', padding: '10px 14px', background: '#fff3f3', border: '1.5px solid #A32D2D', borderRadius: 8 }}>
          <p style={{ fontSize: '0.875rem', color: '#7f1d1d' }}>{submitError}</p>
        </div>
      )}

      {/* Actions */}
      <div className="section" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          className="btn btn-primary"
          style={{ minHeight: 56 }}
          disabled={submitting}
          onClick={() => handleSubmit(true)}
        >
          {submitting && payOnline ? 'Sending…' : `Send invoice + pay online — $${total.toFixed(2)}`}
        </button>
        <button
          className="btn btn-secondary"
          disabled={submitting}
          onClick={() => handleSubmit(false)}
        >
          {submitting && !payOnline ? 'Creating order…' : "I'll pay at the office"}
        </button>
      </div>
    </div>
  );
}

function OrderLine({
  label, amount, prefix = '',
}: {
  label: string; amount: number; prefix?: string;
}) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
      fontSize: '0.9375rem', color: '#374151', marginBottom: 10,
    }}>
      <span style={{ flex: 1, paddingRight: 8 }}>{prefix}{label}</span>
      <span style={{ fontWeight: 500, flexShrink: 0 }}>${amount.toFixed(2)}</span>
    </div>
  );
}
