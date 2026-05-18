import { useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { TRANSPORT_OPTIONS } from '../lib/constants';

interface ConfirmState {
  orderId:       string;
  invoiceNumber: string;
  total:         number;
  subtotal:      number;
  taxAmount:     number;
  email:         string;
  payOnline:     boolean;
}

function TransportBadge({
  icon,
  color,
  title,
  detail,
}: {
  icon: string;
  color: 'green' | 'amber';
  title: string;
  detail: string;
}) {
  const isGreen = color === 'green';
  return (
    <div
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 14px',
        borderRadius: 10,
        border: `1.5px solid ${isGreen ? '#86efac' : '#fcd34d'}`,
        background: isGreen ? '#f0fdf4' : '#fffbeb',
      }}
    >
      <span
        style={{
          flexShrink: 0,
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: isGreen ? '#27500A' : '#d97706',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.875rem',
          fontWeight: 700,
        }}
      >
        {icon}
      </span>
      <div>
        <p style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1f2937', marginBottom: 2 }}>
          {title}
        </p>
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', lineHeight: 1.5 }}>{detail}</p>
      </div>
    </div>
  );
}

export function Confirmation() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const { item, transport, nettingDeclined, addons, clear } = useCart();

  const state = location.state as ConfirmState | null;

  if (!state || !item) {
    navigate('/', { replace: true });
    return null;
  }

  const { invoiceNumber, total, subtotal, taxAmount, email, payOnline } = state;
  const { plant, quantity } = item;

  const isSelf         = transport === TRANSPORT_OPTIONS.SELF;
  const nettingActive  = isSelf && !nettingDeclined;
  const nettingDbAddon = addons.find((a) => a.addon.trigger_rule === 'transport=self');
  const nettingPrice   = nettingDbAddon?.addon.price_per_plant ?? 10;
  const nettingTotal   = nettingActive ? nettingPrice * quantity : 0;
  const alwaysAddons   = addons.filter((a) => a.selected && a.addon.trigger_rule === 'always');

  function handleDone() {
    clear();
    navigate('/', { replace: true });
  }

  return (
    <div className="page">
      {/* Success header */}
      <div
        style={{
          background: '#27500A',
          padding: '36px 24px 28px',
          textAlign: 'center',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: '3.5rem', lineHeight: 1, marginBottom: 10 }}>✓</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Order confirmed</h1>
        <p style={{ fontSize: '0.9375rem', color: '#c8ddb4', marginTop: 8 }}>
          Invoice sent to {email}
        </p>
        <p style={{ fontSize: '0.8125rem', color: '#a8c890', marginTop: 4 }}>
          {invoiceNumber}
        </p>
      </div>

      {/* Transport badge */}
      <div className="section">
        {!isSelf && (
          <TransportBadge
            icon="✓"
            color="green"
            title="LAWNS handling delivery/install"
            detail={
              transport === TRANSPORT_OPTIONS.INSTALL
                ? 'We will deliver and install your plant.'
                : 'We will deliver your plant to your property.'
            }
          />
        )}
        {isSelf && nettingActive && (
          <TransportBadge
            icon="✓"
            color="green"
            title="Trees protected — netting applied"
            detail="Staff will wrap your plant before loading. You're good to go."
          />
        )}
        {isSelf && !nettingActive && (
          <TransportBadge
            icon="⚠"
            color="amber"
            title="No netting — drive carefully"
            detail="Secure your load per Texas Transportation Code Ch. 725 before leaving the lot."
          />
        )}
      </div>

      {/* Order detail */}
      <div className="section">
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Order detail
        </p>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#374151', marginBottom: 8 }}>
          <span>{plant.common_name ?? plant.species} · {plant.current_container} × {quantity}</span>
          <span>${(plant.base_price * quantity).toFixed(2)}</span>
        </div>

        {nettingActive && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#374151', marginBottom: 8 }}>
            <span>Travel netting × {quantity}</span>
            <span>${nettingTotal.toFixed(2)}</span>
          </div>
        )}

        {alwaysAddons.map((ca) => (
          <div key={ca.addon.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#374151', marginBottom: 8 }}>
            <span>{ca.addon.name} × {quantity}</span>
            <span>${(ca.addon.price_per_plant * quantity).toFixed(2)}</span>
          </div>
        ))}

        <div style={{ borderTop: '1px solid #f3f4f6', marginTop: 8, paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#9ca3af' }}>
            <span>Subtotal</span><span>${subtotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#9ca3af' }}>
            <span>Tax (8.25%)</span><span>${taxAmount.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.0625rem', color: '#1f2937', paddingTop: 6, borderTop: '1px solid #e5e7eb' }}>
            <span>Total</span><span>${total.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="section" style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {payOnline ? (
          <a
            href="https://pay.cultivar-os.app"
            style={{
              display: 'block',
              width: '100%',
              minHeight: 56,
              padding: '16px 20px',
              background: '#27500A',
              color: '#fff',
              borderRadius: 8,
              fontWeight: 700,
              fontSize: '1rem',
              textAlign: 'center',
              boxSizing: 'border-box',
              lineHeight: '24px',
            }}
          >
            Pay your invoice — ${total.toFixed(2)}
          </a>
        ) : (
          <div
            style={{
              padding: '14px 16px',
              background: '#f0f7ea',
              borderRadius: 8,
              textAlign: 'center',
              fontSize: '0.9375rem',
              color: '#27500A',
              fontWeight: 600,
            }}
          >
            See you at the office!
          </div>
        )}

        <button
          className="btn btn-secondary"
          onClick={handleDone}
        >
          Scan another plant
        </button>
      </div>
    </div>
  );
}
