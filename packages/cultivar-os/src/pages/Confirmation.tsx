import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import type { OrderBreakdown } from '../hooks/useSubmitOrder';
import { describeTaxLine, type TaxStatus } from '@trace/shared/business-logic';

interface ConfirmState {
  orderId:          string;
  invoiceNumber:    string;
  total:            number;
  subtotal:         number;
  taxAmount:        number;
  // D-40: the authoritative tax state → the receipt renders redline / taxed(%) / exempt(reason).
  taxStatus?:       TaxStatus;
  taxRate?:         number | null;
  taxExemptReason?: string | null;
  taxExemptCertRef?: string | null;
  email:            string;
  payOnline:        boolean;
  transportMode?:   'self' | 'staff';
  transportName?:   string | null;                     // real service_offerings.name (H3/H6)
  serviceLines?:    { name: string; amount: number }[]; // real service itemization (H3/H6)
  breakdown?:       OrderBreakdown | null;              // D-39 (E2): SERVER-AUTHORITATIVE per-line breakdown
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
          transportMode, transportName, serviceLines, breakdown, tierLabel,
          businessName, nettingActive, taxStatus, taxRate, taxExemptReason, taxExemptCertRef,
          qbInvoiceId, qbInvoiceNumber, qbInvoiceUrl, qbStatus } = state;
  // D-40: ONE presenter, rendered from the authoritative state. taxableSubtotal ≈ subtotal here
  // (Confirmation shows the discounted subtotal); a null rate → redline, exempt → reason+$0.
  const taxLine = describeTaxLine({ taxStatus: taxStatus ?? 'taxed', tax: taxAmount, taxableSubtotal: subtotal, taxRate, reason: taxExemptReason, certRef: taxExemptCertRef });
  // D-39 (E2): render the SERVER-AUTHORITATIVE breakdown (goods retail lines → discount line → net),
  // not the client preview → the receipt equals QBO and the discount is a visible line.
  const goodsLines    = (breakdown?.lines ?? []).filter(l => l.kind === 'goods');
  const svcFromBreak  = (breakdown?.lines ?? []).filter(l => l.kind === 'service' && l.netTotal > 0);
  const hasBreakdown  = goodsLines.length > 0;
  const orderDiscount = breakdown?.discountTotal ?? 0;
  const goodsRetail   = breakdown?.goodsRetailSubtotal ?? 0;
  const discountLabel = breakdown?.discountLabel ?? (tierLabel ? tierLabel.split(' · ')[0] : 'Discount');

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

      {/* Order detail — grouped-only (D-39): goods at FULL retail → ONE discount line → goods after,
          then services (not discounted), then discounted subtotal → tax → total. Rendered from the
          SERVER-AUTHORITATIVE breakdown so the receipt equals QuickBooks by construction. */}
      <div className="section" style={{ paddingTop: 0 }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Plants
        </p>

        {hasBreakdown ? (
          goodsLines.map((gp, i) => (
            <div key={`goods-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#374151', marginBottom: 8 }}>
              <span>{gp.name} × {gp.qty}</span>
              <span>${gp.retailTotal.toFixed(2)}</span>
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

        {/* Goods subtotal → discount line → goods after (only when a discount applies). */}
        {orderDiscount > 0 && (
          <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 4, paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
              <span>Goods subtotal (retail)</span><span>${goodsRetail.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#27500A', fontWeight: 600 }}>
              <span>{discountLabel}</span><span>−${orderDiscount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#374151', fontWeight: 600 }}>
              <span>Goods after discount</span><span>${(goodsRetail - orderDiscount).toFixed(2)}</span>
            </div>
          </div>
        )}

        {/* Services — not discounted. Prefer the authoritative breakdown; fall back to serviceLines. */}
        {(hasBreakdown ? svcFromBreak.map(s => ({ name: s.name, amount: s.netTotal })) : (serviceLines ?? []).filter(s => s.amount > 0)).length > 0 && (
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '16px 0 10px' }}>
            Services <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500, color: '#b0b7c0' }}>· not discounted</span>
          </p>
        )}
        {(hasBreakdown ? svcFromBreak.map(s => ({ name: s.name, amount: s.netTotal })) : (serviceLines ?? []).filter(s => s.amount > 0)).map((s, i) => (
          <div key={`svc-${i}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#374151', marginBottom: 8 }}>
            <span>{s.name}</span>
            <span>${s.amount.toFixed(2)}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 8, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#9ca3af' }}>
            <span>{orderDiscount > 0 ? 'Subtotal (after discount)' : 'Subtotal'}</span><span>${subtotal.toFixed(2)}</span>
          </div>
          {/* D-40 three-state tax line: redline (rate unset) / taxed(%) / exempt(reason) — never a fabricated rate */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: taxLine.redline ? '#92400e' : '#9ca3af', fontWeight: taxLine.redline ? 600 : 400 }}>
            <span>{taxLine.redline ? '⚠ ' : ''}{taxLine.label}</span><span>{taxLine.amount ?? ''}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.0625rem', color: '#1f2937', paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
            <span>Total{taxLine.state === 'not_identified' ? ' (tax not included)' : ''}</span><span>${total.toFixed(2)}</span>
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
