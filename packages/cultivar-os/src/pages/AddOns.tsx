import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useAddons } from '../hooks/useAddons';
import { TransportToggle } from '../components/checkout/TransportToggle';
import { NettingPrompt } from '../components/checkout/NettingPrompt';
import { AddonCard } from '../components/checkout/AddonCard';
import { TRANSPORT_OPTIONS } from '../lib/constants';

export function AddOns() {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate = useNavigate();

  const { item, addons: cartAddons, transport, setTransport, setAddons, toggleAddon, setNettingDeclined } = useCart();
  const { addons: dbAddons, loading, error } = useAddons();

  // Local state for netting when DB addon isn't loaded yet
  const [localNettingSelected, setLocalNettingSelected] = useState(true);

  useEffect(() => {
    if (dbAddons.length > 0) {
      setAddons(dbAddons);
    }
  }, [dbAddons, setAddons]);

  if (!item) {
    navigate(`/plant/${tagId}`, { replace: true });
    return null;
  }

  const { plant, quantity } = item;
  const isSelfTransport = transport === TRANSPORT_OPTIONS.SELF;

  const nettingCartAddon = cartAddons.find((a) => a.addon.trigger_rule === 'transport=self');
  const alwaysAddons = cartAddons.filter((a) => a.addon.trigger_rule === 'always');

  // Netting prompt shows whenever transport=self, with DB data if available or a hardcoded fallback
  const nettingSelected = nettingCartAddon ? nettingCartAddon.selected : localNettingSelected;
  const nettingPrice = nettingCartAddon?.addon.price_per_plant ?? 10;
  const nettingId = nettingCartAddon?.addon.id ?? '__netting__';

  function handleNettingToggle() {
    const willBeSelected = !nettingSelected;
    setNettingDeclined(!willBeSelected);
    if (nettingCartAddon) {
      toggleAddon(nettingId);
    } else {
      setLocalNettingSelected(willBeSelected);
    }
  }

  const dbAddonsTotal = cartAddons
    .filter((a) => {
      if (a.addon.trigger_rule === 'transport=self') return isSelfTransport && a.selected;
      return a.selected;
    })
    .reduce((sum, a) => sum + a.addon.price_per_plant * quantity, 0);

  // If netting isn't in DB yet, include fallback price when selected + self-transport
  const fallbackNettingTotal =
    !nettingCartAddon && isSelfTransport && nettingSelected ? nettingPrice * quantity : 0;

  const addonsTotal = dbAddonsTotal + fallbackNettingTotal;

  const plantSubtotal = plant.base_price * quantity;
  const grandTotal = plantSubtotal + addonsTotal;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
        <button
          onClick={() => navigate(`/plant/${tagId}`)}
          style={{
            background: 'none',
            border: 'none',
            color: '#27500A',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '4px 0',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{ padding: '12px 16px 4px' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1f2937' }}>
          Add-ons & transport
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>
          {plant.common_name ?? plant.species} · {quantity} plant{quantity !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Transport */}
      <div className="section">
        <TransportToggle value={transport} onChange={setTransport} />
      </div>

      {/* Always-on add-ons */}
      {loading && (
        <div className="section">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="skeleton"
              style={{ height: 72, borderRadius: 10, marginBottom: 8 }}
            />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="section">
          <p style={{ fontSize: '0.875rem', color: '#9ca3af', textAlign: 'center' }}>
            Add-ons unavailable — {error}
          </p>
        </div>
      )}

      {!loading && !error && alwaysAddons.length > 0 && (
        <div className="section">
          <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#4b5563', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
            Optional add-ons
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alwaysAddons.map((ca) => (
              <AddonCard
                key={ca.addon.id}
                addon={ca.addon}
                selected={ca.selected}
                quantity={quantity}
                onToggle={() => toggleAddon(ca.addon.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Netting prompt — pinned above CTA so user must scroll through it */}
      {isSelfTransport && (
        <div className="section">
          <NettingPrompt
            selected={nettingSelected}
            onToggle={handleNettingToggle}
            pricePerPlant={nettingPrice}
            quantity={quantity}
          />
        </div>
      )}

      {/* Order summary */}
      <div className="section" style={{ marginTop: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
            <span>Plants ({quantity})</span>
            <span>${plantSubtotal.toFixed(2)}</span>
          </div>
          {addonsTotal > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
              <span>Add-ons</span>
              <span>+${addonsTotal.toFixed(2)}</span>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: '1.0625rem', color: '#1f2937', paddingTop: 8, borderTop: '1px solid #e5e7eb' }}>
            <span>Subtotal</span>
            <span>${grandTotal.toFixed(2)}</span>
          </div>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Tax calculated at checkout</p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => navigate('/checkout/customer')}
        >
          Review my cart — ${grandTotal.toFixed(2)}
        </button>
      </div>
    </div>
  );
}
