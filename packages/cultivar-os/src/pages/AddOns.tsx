import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useServices } from '../hooks/useServices';
import { TransportToggle } from '../components/checkout/TransportToggle';
import { CompliancePrompt } from '../components/checkout/CompliancePrompt';
import { AddonCard } from '../components/checkout/AddonCard';

export function AddOns() {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate  = useNavigate();

  const {
    item, selectedTransport, services,
    setTransport, setServices, toggleService, setNettingDeclined, nettingDeclined,
  } = useCart();

  const { transportOfferings, addonOfferings, loading, error } = useServices(
    item?.plant.business_id ?? '',
  );

  // Load service offerings into cart once fetched
  useEffect(() => {
    if (transportOfferings.length > 0 || addonOfferings.length > 0) {
      setServices(transportOfferings, addonOfferings);
    }
  }, [transportOfferings, addonOfferings]);

  if (!item) {
    navigate(`/plant/${tagId}`, { replace: true });
    return null;
  }

  const { plant, quantity } = item;
  const isSelfTransport = selectedTransport?.transport_mode === 'self';

  // Find netting in the services list
  const nettingSelection = services.find(
    s => s.offering.trigger_transport_mode === 'self' && s.offering.category === 'addon',
  );
  const nettingPrice  = nettingSelection?.offering.price ?? 10;
  const nettingActive = isSelfTransport && (nettingSelection?.selected ?? true);

  // Other always-shown addons (no transport trigger)
  const alwaysAddons = services.filter(
    s => s.offering.category === 'addon' && !s.offering.trigger_transport_mode,
  );

  // Running subtotal for the summary bar
  const transportAmount = selectedTransport
    ? selectedTransport.price_type === 'per_unit'
      ? selectedTransport.price * quantity
      : selectedTransport.price
    : 0;

  const addonAmount = services
    .filter(s => s.selected && s.offering.category === 'addon')
    .reduce((sum, s) => {
      const p = s.offering.price_type === 'per_unit'
        ? s.offering.price * quantity
        : s.offering.price;
      return sum + p;
    }, 0);

  // Netting amount is already included in addonAmount via services state,
  // but if cart hasn't loaded the netting service yet fall back to manual calc
  const nettingFallback =
    !nettingSelection && isSelfTransport && !nettingDeclined ? nettingPrice * quantity : 0;

  const plantSubtotal = plant.base_price * quantity;
  const grandTotal    = plantSubtotal + transportAmount + addonAmount + nettingFallback;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
        <button
          onClick={() => navigate(`/plant/${tagId}`)}
          style={{
            background: 'none', border: 'none', color: '#27500A',
            fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer',
            padding: '4px 0', display: 'flex', alignItems: 'center', gap: 4,
          }}
        >
          ← Back
        </button>
      </div>

      <div style={{ padding: '12px 16px 4px' }}>
        <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1f2937' }}>
          Services & add-ons
        </h1>
        <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 4 }}>
          {plant.common_name ?? plant.species} · {quantity} plant{quantity !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Transport */}
      <div className="section">
        {loading ? (
          <div className="skeleton" style={{ height: 140, borderRadius: 10 }} />
        ) : error ? (
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Services unavailable — {error}</p>
        ) : (
          <TransportToggle
            offerings={transportOfferings}
            selected={selectedTransport}
            onChange={setTransport}
          />
        )}
      </div>

      {/* Compliance prompt — any self-transport addon with a compliance notice */}
      {isSelfTransport && !loading && nettingSelection && (
        nettingSelection.offering.compliance_title ? (
          <div className="section">
            <CompliancePrompt
              title={nettingSelection.offering.compliance_title}
              body={nettingSelection.offering.compliance_body ?? ''}
              serviceNote={nettingSelection.offering.service_note ?? 'Applied by staff'}
              pricePerUnit={nettingPrice}
              unitLabel={nettingSelection.offering.price_unit === 'plant' ? 'plant' : 'unit'}
              quantity={quantity}
              selected={nettingActive}
              onToggle={() => setNettingDeclined(nettingActive)}
            />
          </div>
        ) : (
          /* Fallback if compliance text not yet seeded */
          <div className="section">
            <CompliancePrompt
              title="Protective netting required"
              body="Protective travel netting secures branches and prevents wind damage during transport."
              serviceNote="Applied by staff before you leave"
              pricePerUnit={nettingPrice}
              unitLabel="plant"
              quantity={quantity}
              selected={nettingActive}
              onToggle={() => setNettingDeclined(nettingActive)}
            />
          </div>
        )
      )}

      {/* Always-on add-ons */}
      {!loading && !error && alwaysAddons.length > 0 && (
        <div className="section">
          <p style={{
            fontSize: '0.8125rem', fontWeight: 600, color: '#4b5563',
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
          }}>
            Optional add-ons
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alwaysAddons.map((sel) => (
              <AddonCard
                key={sel.offering.id}
                addon={{
                  id:              sel.offering.id,
                  business_id:     sel.offering.business_id,
                  name:            sel.offering.name,
                  description:     sel.offering.description,
                  price_per_plant: sel.offering.price,
                  trigger_rule:    null,
                  pre_selected:    sel.offering.pre_selected,
                  active:          sel.offering.is_active,
                  sort_order:      sel.offering.sort_order,
                }}
                selected={sel.selected}
                quantity={quantity}
                onToggle={() => toggleService(sel.offering.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Order summary */}
      <div className="section" style={{ marginTop: 'auto' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
            <span>Plants ({quantity})</span>
            <span>${plantSubtotal.toFixed(2)}</span>
          </div>
          {(addonAmount + nettingFallback + transportAmount) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
              <span>Services</span>
              <span>+${(addonAmount + nettingFallback + transportAmount).toFixed(2)}</span>
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between', fontWeight: 700,
            fontSize: '1.0625rem', color: '#1f2937', paddingTop: 8, borderTop: '1px solid #e5e7eb',
          }}>
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
