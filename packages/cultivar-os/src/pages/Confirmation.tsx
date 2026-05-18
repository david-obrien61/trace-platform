import { useNavigate } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { TRANSPORT_OPTIONS } from '../lib/constants';

export function Confirmation() {
  const navigate = useNavigate();
  const { item, transport, nettingDeclined, addons, clear } = useCart();

  if (!item) {
    navigate('/', { replace: true });
    return null;
  }

  const { plant, quantity } = item;
  const isSelf = transport === TRANSPORT_OPTIONS.SELF;
  const nettingAddon = addons.find((a) => a.addon.trigger_rule === 'transport=self');
  const nettingPurchased = isSelf && !nettingDeclined && (nettingAddon?.selected ?? true);

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
          padding: '32px 24px 28px',
          textAlign: 'center',
          color: '#fff',
        }}
      >
        <div style={{ fontSize: '3rem', lineHeight: 1, marginBottom: 12 }}>✓</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Order confirmed</h1>
        <p style={{ fontSize: '0.9375rem', color: '#c8ddb4', marginTop: 6 }}>
          Your invoice will arrive by email shortly.
        </p>
      </div>

      {/* Plant summary */}
      <div className="section">
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
          What you're taking home
        </p>
        <p style={{ fontSize: '1rem', fontWeight: 600, color: '#1f2937' }}>
          {plant.common_name ?? plant.species}
        </p>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>
          {plant.current_container} · {quantity} plant{quantity !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Transport decision */}
      <div className="section">
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          Transport
        </p>

        {!isSelf && (
          <TransportBadge
            icon="✓"
            color="green"
            title="LAWNS handling transport"
            detail={
              transport === TRANSPORT_OPTIONS.INSTALL
                ? 'We will deliver and install your plant.'
                : 'We will deliver your plant to your property.'
            }
          />
        )}

        {isSelf && nettingPurchased && (
          <TransportBadge
            icon="✓"
            color="green"
            title="Netting applied — trees protected"
            detail="Staff will wrap your plant before loading. You're good to go."
          />
        )}

        {isSelf && !nettingPurchased && (
          <TransportBadge
            icon="⚠"
            color="amber"
            title="Netting declined — drive carefully"
            detail="Secure your load per Texas Transportation Code Ch. 725 before leaving the lot."
          />
        )}
      </div>

      {/* Selected add-ons */}
      {addons.filter((a) => a.selected && a.addon.trigger_rule === 'always').length > 0 && (
        <div className="section">
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Add-ons included
          </p>
          {addons
            .filter((a) => a.selected && a.addon.trigger_rule === 'always')
            .map((a) => (
              <div
                key={a.addon.id}
                style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#374151', paddingBottom: 6 }}
              >
                <span>{a.addon.name}</span>
                <span style={{ color: '#27500A', fontWeight: 600 }}>
                  +${(a.addon.price_per_plant * quantity).toFixed(2)}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* CTA */}
      <div className="section" style={{ marginTop: 'auto' }}>
        <button className="btn btn-primary" onClick={handleDone}>
          Done
        </button>
      </div>
    </div>
  );
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
