import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useBusinessContext } from '@trace/shared/context';
import { checkSellable } from '../lib/inventoryStates';
import { usePlant } from '../hooks/usePlant';
import { useCart } from '../hooks/useCart';
import { PlantHero } from '../components/plant/PlantHero';
import { PlantTimeline } from '../components/plant/PlantTimeline';
import { QtySelector } from '../components/checkout/QtySelector';

export function PlantProfile() {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate   = useNavigate();
  const { plant, events, availableCount, loading, error, sizeChoices, chooseSize } = usePlant(tagId);
  const { business } = useBusinessContext();
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

  // D-34: the scanned variety resolved to a multi-size stock line — customer picks a size
  // (L5 NEED_CLARIFICATION) before the profile renders. Choosing one synthesizes that lot.
  if (sizeChoices && sizeChoices.length > 0) {
    return (
      <div className="page">
        <div className="section" style={{ padding: '32px 16px' }}>
          <h1 style={{ fontSize: '1.375rem', fontWeight: 700, color: '#1f2937', marginBottom: 6 }}>
            Which size?
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: 20 }}>
            This variety is stocked in more than one size. Pick the one you're looking at.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {sizeChoices.map((c) => (
              <button
                key={c.inventoryId}
                className="btn btn-secondary"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: 52 }}
                onClick={() => chooseSize(c.inventoryId)}
              >
                <span style={{ fontWeight: 700 }}>{c.size}</span>
                {/* "in stock" = ON-HAND. This page cannot derive committed (#66), and calling
                    on-hand "available" is the exact mislabel D-52 exists to stop. */}
                {c.qty != null && (
                  <span style={{ fontSize: '0.8125rem', color: 'var(--gray-600)' }}>{c.qty} in stock</span>
                )}
              </button>
            ))}
          </div>
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
  // D-35: the price shown to the customer is the stored sell_price, NEVER unit_cost (cost).
  const sellPrice    = inv?.sell_price ?? 0;

  // ── THE CAP, through the ONE predicate (BUILD 1/2) ────────────────────────────────────────
  // ⚠️ committed is passed as 0 HERE AND ONLY HERE, and it is NOT a claim that nothing is
  // committed — it is an admission that this page CANNOT KNOW. `order_items` RLS is
  // `authenticated_*` by policy, so an anonymous customer scanning a tag in the lot cannot
  // derive committed at all (tech-debt #66). Consequences, stated rather than papered over:
  //   • the number below is ON-HAND, so the copy says "in stock", NOT "available" — those are
  //     different facts and D-52 named them differently for this reason.
  //   • a lot that is fully committed (DISC-1105: 29 on hand, 57 committed) will still let an
  //     anonymous customer build a cart. The SERVER refuses it correctly at submit, so this is
  //     a late-refusal UX gap, not an oversell hole — but it IS a gap and it is not closed here.
  // THE REAL FIX, PROPOSED NOT BUILT (it is a MIGRATION, and this build ships none): a
  // SECURITY DEFINER function `public.lot_available(p_lot_id uuid) RETURNS int` that reads
  // order_items server-side and returns ONLY the derived integer — no order rows, no customer
  // data, nothing an anonymous caller should not see — GRANTed to `anon`. That closes #66
  // without widening order_items RLS and without a new api function (12/12). David's call.
  const verdict = checkSellable({
    onHand: availableCount, committed: 0, status: inv?.status ?? null, sellPrice,
  });
  const isUnavailable = !inv || !verdict.sellable;
  const maxQty = Math.max(1, verdict.available);

  console.log('[TRACE:INVENTORY] QR page sellability — committed NOT derivable for anon (#66)', {
    tagId, onHand: availableCount, status: inv?.status ?? null, sellPrice,
    sellable: verdict.sellable, reason: verdict.reason ?? 'ok',
  });

  function handleAddToCart() {
    if (!verdict.sellable) return;   // the gate, not just the styling
    setItem(plant!, Math.min(qty, maxQty));
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
                {availableCount} of this variety in stock — how many would you like?
              </p>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
              <QtySelector
                value={qty}
                max={maxQty}
                onChange={setQty}
              />
              <div style={{ fontSize: '0.875rem', color: 'var(--gray-600)' }}>
                {availableCount === 1
                  ? 'Only 1 left'
                  : `${availableCount} in stock`}
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
            {/* The reason comes from the predicate itself, so a customer reads exactly what the
                code applied — not a second, hand-written paraphrase that drifts from it. */}
            <p style={{ fontWeight: 600, color: 'var(--gray-800)' }}>
              {inv ? (verdict.sellable ? 'Not available right now' : verdict.detail) : 'Availability not set up yet'}
            </p>
            <p style={{ fontSize: '0.875rem', color: 'var(--gray-600)', marginTop: 4 }}>
              Ask a team member for availability on this species.
            </p>
          </div>
        )}
      </div>

      {/* Business footer — H2: identity from the businesses row (AC-1), never a hardcoded tenant.
          Rendered only when the business is resolvable (a signed-in owner/staff session); an anon
          customer scan has no businesses read under RLS → no footer, rather than a wrong tenant. */}
      {business && (business.name || business.address || business.phone) && (
        <div style={{ borderTop: '1px solid var(--gray-100)', padding: '14px 16px', textAlign: 'center' }}>
          <p style={{ fontSize: '0.75rem', color: 'var(--gray-400)' }}>
            {[business.name, business.address, business.phone].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}
    </div>
  );
}
