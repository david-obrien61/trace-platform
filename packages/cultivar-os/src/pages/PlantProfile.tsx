import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { usePlant } from '../hooks/usePlant';
import { useCart } from '../hooks/useCart';
import { PlantHero } from '../components/plant/PlantHero';
import { PlantTimeline } from '../components/plant/PlantTimeline';
import { QtySelector } from '../components/checkout/QtySelector';

export function PlantProfile() {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate   = useNavigate();
  const { plant, events, availableCount, loading, error } = usePlant(tagId);
  const setItem    = useCart((s) => s.setItem);
  const [qty, setQty] = useState(1);

  if (loading) {
    return (
      <div className="page">
        <div style={{ padding: '60px 24px', textAlign: 'center' }}>
          <div className="skeleton" style={{ height: 200, marginBottom: 16 }} />
          <div className="skeleton" style={{ height: 24, width: '70%', marginBottom: 8 }} />
          <div className="skeleton" style={{ height: 16, width: '50%' }} />
        </div>
      </div>
    );
  }

  if (error || !plant) {
    return (
      <div className="page">
        <div className="error-state">
          <h2>Plant not found</h2>
          <p>Tag <strong>{tagId}</strong> didn't match any plant in the nursery.</p>
          <p style={{ marginTop: 8, fontSize: '0.875rem' }}>
            Check the tag and try scanning again.
          </p>
        </div>
      </div>
    );
  }

  const inv          = plant.business_inventory;
  const inventoryStatus = inv?.status ?? null;
  // D-35: the price shown to the customer is the stored sell_price, NEVER unit_cost (cost).
  const sellPrice    = inv?.sell_price ?? 0;
  const isUnavailable = !inv || inventoryStatus !== 'available';

  function handleAddToCart() {
    setItem(plant!, qty);
    navigate(`/plant/${tagId}/addons`);
  }

  return (
    <div className="page">
      <PlantHero plant={plant} />

      <PlantTimeline events={events} />

      {/* Quantity + CTA */}
      <div className="section" style={{ marginTop: 'auto', paddingBottom: 32 }}>
        {!isUnavailable && (
          <>
            {availableCount > 1 && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--gray-600)', marginBottom: 12 }}>
                {availableCount} of this variety available — how many would you like?
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <QtySelector
                value={qty}
                max={availableCount}
                onChange={setQty}
              />
              <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                {availableCount === 1
                  ? 'Only 1 left'
                  : `${availableCount} available`}
              </div>
            </div>

            <button className="btn btn-primary" onClick={handleAddToCart}>
              Add to cart — ${(sellPrice * qty).toLocaleString('en-US')}
            </button>

            <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--gray-400)', marginTop: 10 }}>
              Add-ons and transport options on the next screen
            </p>
          </>
        )}

        {isUnavailable && (
          <div style={{
            background: 'var(--gray-100)',
            borderRadius: 8,
            padding: '14px 16px',
            textAlign: 'center',
          }}>
            <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>
              {inventoryStatus ? `This plant is ${inventoryStatus}` : 'Availability not set up yet'}
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginTop: 4 }}>
              Ask a team member for availability on this species.
            </p>
          </div>
        )}
      </div>

      {/* Nursery footer */}
      <div style={{ borderTop: '1px solid var(--gray-100)', padding: '14px 16px', textAlign: 'center' }}>
        <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
          LAWNS Tree Farm, LLC · Leander, TX · (512) 450-3336
        </p>
      </div>
    </div>
  );
}
