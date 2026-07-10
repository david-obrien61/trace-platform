import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import type { PricedLine } from '@trace/shared/business-logic';

interface ConfirmState {
  orderId:          string;
  invoiceNumber:    string;
  total:            number;
  subtotal:         number;
  taxAmount:        number;
  email:            string;
  payOnline:        boolean;
  transportMode?:   'self' | 'staff';
  transportName?:   string | null;                     // real service_offerings.name (H3/H6)
  serviceLines?:    { name: string; amount: number }[]; // real service itemization (H3/H6)
  goodsBreakdown?:  PricedLine[];                       // D-39: per-goods-line retail→discount→net
  tierLabel?:       string | null;                     // the order's tier badge (display)
  businessName?:    string | null;                     // from context at review (AC-1)
  nettingActive?:   boolean;
  qbInvoiceId?:     string;
  qbInvoiceNumber?: string;
  qbInvoiceUrl?:    string;
  qbStatus?:        'success' | 'pending';
}

function StatusBadge({
  icon,
  color,
  title,
  detail,
}: {
  icon: string;
  color: 'green' | 'amber' | 'blue';
  title: string;
  detail: string;
}) {
  const colors = {
    green: { border: '#86efac', bg: '#f0fdf4', dot: '#27500A' },
    amber: { border: '#fcd34d', bg: '#fffbeb', dot: '#d97706' },
    blue:  { border: '#93c5fd', bg: '#eff6ff', dot: '#1d4ed8' },
  }[color];
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 14px', borderRadius: 10, border: `1.5px solid ${colors.border}`, background: colors.bg }}>
      <span style={{ flexShrink: 0, width: 28, height: 28, borderRadius: '50%', background: colors.dot, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.875rem', fontWeight: 700 }}>
        {icon}
      </span>
      <div>
        <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1f2937', marginBottom: 2 }}>{title}</p>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.5 }}>{detail}</p>
      </div>
    </div>
  );
}

export function Confirmation() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { items, clear } = useCart();

  const state = location.state as ConfirmState | null;

  if (!state) {
    navigate('/', { replace: true });
    return null;
  }

  const { invoiceNumber, total, subtotal, taxAmount, email, payOnline,
          transportMode, transportName, serviceLines, goodsBreakdown, tierLabel,
          businessName, nettingActive,
          qbInvoiceId, qbInvoiceNumber, qbInvoiceUrl, qbStatus } = state;
  const hasBreakdown = !!goodsBreakdown && goodsBreakdown.length > 0;
  const orderDiscount = hasBreakdown ? goodsBreakdown!.reduce((s, g) => s + g.discountAmt, 0) : 0;

  const isSelf      = (transportMode ?? 'self') === 'self';
  const nettingOn   = !!nettingActive;
  // A QB invoice object is NOT required to confirm — the order already exists. When QB is
  // absent (not connected / 503 / error → qbStatus 'pending', no invoice id) we render the
  // honest "invoice will follow" state, never a crash and never a blank. (Bug 2 hard req.)
  const qbConnected = qbStatus === 'success' && !!qbInvoiceId;
  if (!qbConnected) {
    console.log('[TRACE:CHECKOUT] confirmation rendering WITHOUT a QB invoice — degraded state, no crash',
      { orderId: state.orderId, qbStatus: qbStatus ?? 'pending', payOnline });
  }
  const displayQbNumber = qbInvoiceNumber || qbInvoiceId || '—';

  function handleDone() {
    clear();
    navigate('/', { replace: true });
  }

  return (
    <div className="page">
      {/* Success header */}
      <div style={{ background: '#27500A', padding: '36px 24px 28px', textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: 10 }}>✓</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Order confirmed</h1>
        <p style={{ fontSize: '0.9375rem', color: '#c8ddb4', marginTop: 8 }}>
          Invoice sent to {email}
        </p>
        <p style={{ fontSize: '0.8125rem', color: '#a8c890', marginTop: 4 }}>{invoiceNumber}</p>
      </div>

      {/* QB invoice status */}
      <div className="section">
        {qbConnected ? (
          <StatusBadge
            icon="✓"
            color="blue"
            title={`Invoice created in QuickBooks — #${displayQbNumber}`}
            detail="Open QuickBooks and go to Invoices — it's already there."
          />
        ) : (
          <StatusBadge
            icon="⏱"
            color="amber"
            title="Invoice will sync to QuickBooks shortly"
            detail="Connect QuickBooks from the owner dashboard to enable automatic sync."
          />
        )}
      </div>

      {/* Transport status */}
      <div className="section" style={{ paddingTop: 0 }}>
        {!isSelf && (
          <StatusBadge icon="✓" color="green"
            title={transportName
              ? `${businessName ? `${businessName} — ` : ''}${transportName}`
              : `${businessName ?? 'We'} handling your order`}
            detail="We will deliver your order to your property." />
        )}
        {isSelf && nettingOn && (
          <StatusBadge icon="✓" color="green" title="Trees protected — netting applied"
            detail="Staff will wrap your plants before loading. You're good to go." />
        )}
        {isSelf && !nettingOn && (
          <StatusBadge icon="⚠" color="amber" title="No netting — drive carefully"
            detail="Secure your load per Texas Transportation Code Ch. 725 before leaving the lot." />
        )}
      </div>

      {/* Order detail */}
      <div className="section" style={{ paddingTop: 0 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Order detail
        </p>

        {/* Plant lines — D-39: render the per-line breakdown (retail → discount → net) that matches
            what QuickBooks charges. The breakdown comes from the SAME computeOrderPricing the Review
            ran. Falls back to the cart's raw lines (retail) only if no breakdown was passed. */}
        {hasBreakdown ? (
          goodsBreakdown!.map((gp, i) => (
            <div key={`goods-${i}`} style={{ marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#374151' }}>
                <span>{gp.name} × {gp.qty}</span>
                <span>${gp.netTotal.toFixed(2)}</span>
              </div>
              {gp.discountAmt > 0 && (
                <p style={{ fontSize: '0.75rem', color: '#27500A', margin: '2px 0 0', lineHeight: 1.5 }}>
                  Retail ${gp.retailTotal.toFixed(2)} · {gp.basis === 'at_cost' ? 'at cost' : `${gp.discountPct}% off`} −${gp.discountAmt.toFixed(2)} · Net ${gp.netTotal.toFixed(2)}
                </p>
              )}
            </div>
          ))
        ) : (
          items.map((l) => (
            <div key={l.plant.stock_line_id ?? l.plant.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#374151', marginBottom: 8 }}>
              <span>{l.plant.common_name ?? l.plant.species}{l.plant.current_container ? ` · ${l.plant.current_container}` : ''} × {l.quantity}</span>
              <span>${((l.plant.business_inventory?.sell_price ?? 0) * l.quantity).toFixed(2)}</span>
            </div>
          ))
        )}

        {/* Service lines — itemized by REAL service_offerings.name (H3/H6), not a branch label. */}
        {(serviceLines ?? []).filter(s => s.amount > 0).map((s, i) => (
          <div key={`svc-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#374151', marginBottom: 8 }}>
            <span>{s.name}</span>
            <span>${s.amount.toFixed(2)}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 8, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {orderDiscount > 0 && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#9ca3af' }}>
                <span>Subtotal (retail)</span><span>${(subtotal + orderDiscount).toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#27500A', fontWeight: 600 }}>
                <span>{tierLabel ? `${tierLabel.split(' · ')[0]} discount` : 'Discount'} (plants only)</span><span>−${orderDiscount.toFixed(2)}</span>
              </div>
            </>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#9ca3af' }}>
            <span>{orderDiscount > 0 ? 'Subtotal (after discount)' : 'Subtotal'}</span><span>${subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#9ca3af' }}>
            <span>Tax ({subtotal > 0 ? ((taxAmount / subtotal) * 100).toFixed(2).replace(/\.00$/, '') : '0'}%)</span><span>${taxAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.0625rem', color: '#1f2937', paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="section" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {payOnline && qbInvoiceUrl ? (
          <a
            href={qbInvoiceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'block', width: '100%', minHeight: 56, padding: '16px 20px', background: '#27500A', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: '1rem', textAlign: 'center', boxSizing: 'border-box', lineHeight: '24px', textDecoration: 'none' }}
          >
            View invoice in QuickBooks
          </a>
        ) : payOnline ? (
          <div style={{ padding: '14px 16px', background: '#eff6ff', borderRadius: 8, textAlign: 'center', fontSize: '0.9375rem', color: '#1d4ed8', fontWeight: 600 }}>
            Invoice emailed to {email}
          </div>
        ) : (
          <div style={{ padding: '14px 16px', background: '#f0f7ea', borderRadius: 8, textAlign: 'center', fontSize: '0.9375rem', color: '#27500A', fontWeight: 600 }}>
            See you at the office!
          </div>
        )}

        {/* Demo QB fallback link */}
        <a
          href={`/demo/quickbooks-invoice?orderId=${state.orderId}&total=${total}&invoiceNumber=${invoiceNumber}`}
          style={{ display: 'block', textAlign: 'center', fontSize: '0.8125rem', color: '#6b7280', paddingTop: 4, textDecoration: 'none' }}
        >
          View QuickBooks sandbox preview →
        </a>

        <button className="btn btn-secondary" onClick={handleDone}>
          Start another order
        </button>
      </div>
    </div>
  );
}
