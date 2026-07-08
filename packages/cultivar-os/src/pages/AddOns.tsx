import { useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useCart } from '../hooks/useCart';
import { useServices } from '../hooks/useServices';
import { totalPlantCount, nettedQuantity } from '../lib/netting';
import {
  resolveTransportRoles, availableChoices, choiceToSelection, CHOICE_META,
} from '../lib/transport';
import { TransportToggle } from '../components/checkout/TransportToggle';
import { CompliancePrompt } from '../components/checkout/CompliancePrompt';
import { AddonCard } from '../components/checkout/AddonCard';

const TRACE_CART = true; // [TRACE:CART] STD-003 — on until OWNER-PROVEN

export function AddOns() {
  const { tagId } = useParams<{ tagId: string }>();
  const navigate  = useNavigate();

  const {
    items, transportChoice, selectedTransport, plantingOffering, plantingSelected, services,
    setTransportChoice, setServices, toggleService, setNettingDeclined, nettingDeclined,
  } = useCart();

  const businessId = items[0]?.plant.business_id ?? '';
  const { transportOfferings, addonOfferings, loading, error } = useServices(businessId);

  // Load addon service offerings into cart once fetched.
  useEffect(() => {
    if (transportOfferings.length > 0 || addonOfferings.length > 0) {
      setServices(transportOfferings, addonOfferings);
    }
  }, [transportOfferings, addonOfferings]);

  // Classify the raw transport rows into ROLES (self / delivery / planting) by shape,
  // then the three-branch radio (SPEC-transport-netting-decline-workflow).
  const roles   = useMemo(() => resolveTransportRoles(transportOfferings), [transportOfferings]);
  const choices = useMemo(() => availableChoices(roles), [roles]);

  // D-9 (Surface Honesty): any data-shape problem is FLAGGED, never silently mischarged.
  useEffect(() => {
    if (TRACE_CART && !loading && roles.flags.length > 0) {
      console.log('[TRACE:CART] transport role flags (data reshape owed via Settings)', { flags: roles.flags });
    }
  }, [loading, roles.flags]);

  // Set the initial branch once the offerings are known: prefer the pre_selected transport
  // row's branch (the seed pre-selects "Pick up myself" → the self/netting branch — the
  // Regina default), else the first available branch.
  useEffect(() => {
    if (transportChoice || choices.length === 0) return;
    const preSelectedMode = transportOfferings.find(o => o.pre_selected)?.transport_mode;
    const initial =
      (preSelectedMode === 'self' && choices.includes('self')) ? 'self'
      : (preSelectedMode === 'staff' && choices.includes('delivery_planting')) ? 'delivery_planting'
      : choices[0];
    setTransportChoice(initial, choiceToSelection(initial, roles));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transportChoice, choices, roles, transportOfferings]);

  if (items.length === 0) {
    navigate(tagId ? `/plant/${tagId}` : '/checkout/scan', { replace: true });
    return null;
  }

  const plantCount      = totalPlantCount(items);
  const isSelfTransport = selectedTransport?.transport_mode === 'self';

  // Netting (self-transport only, the compliance/Regina add-on).
  const nettingSelection = services.find(
    s => s.offering.trigger_transport_mode === 'self' && s.offering.category === 'addon',
  );
  const nettingPrice  = nettingSelection?.offering.price ?? 10;
  const nettingActive = isSelfTransport && (nettingSelection?.selected ?? true) && !nettingDeclined;

  // Other always-shown addons (no transport trigger).
  const alwaysAddons = services.filter(
    s => s.offering.category === 'addon' && !s.offering.trigger_transport_mode,
  );

  // ── Amounts (attach-rule netting: per_unit ×plantCount, flat ×1) ──────────
  const transportAmount = selectedTransport
    ? Number(selectedTransport.price) * nettedQuantity(selectedTransport, plantCount)
    : 0;
  // Planting is a SEPARATE per-plant service attached only by the "Delivery + planting" branch.
  const plantingAmount = plantingSelected && plantingOffering
    ? Number(plantingOffering.price) * nettedQuantity(plantingOffering, plantCount)
    : 0;

  const addonAmount = services
    .filter(s => s.selected && s.offering.category === 'addon')
    .reduce((sum, s) => sum + Number(s.offering.price) * nettedQuantity(s.offering, plantCount), 0);

  // Netting fallback when the cart hasn't loaded the netting service row yet.
  const nettingFallback =
    !nettingSelection && isSelfTransport && !nettingDeclined ? nettingPrice * plantCount : 0;

  // D-35: the cart reads sell_price (the retail price), NEVER unit_cost (what the grower paid).
  const plantSubtotal = items.reduce((sum, l) => sum + (l.plant.business_inventory?.sell_price ?? 0) * l.quantity, 0);
  const servicesAmount = transportAmount + plantingAmount + addonAmount + nettingFallback;
  const grandTotal     = plantSubtotal + servicesAmount;

  if (TRACE_CART) console.log('[TRACE:CART] addons summary — column=sell_price', {
    lineCount: items.length, plantCount, plantSubtotal,
    branch: transportChoice, transportAmount, plantingAmount, plantingSelected,
  });

  const headerLabel = items.length === 1
    ? `${items[0].plant.common_name ?? items[0].plant.species} · ${plantCount} plant${plantCount !== 1 ? 's' : ''}`
    : `${items.length} items · ${plantCount} plant${plantCount !== 1 ? 's' : ''}`;

  return (
    <div className="page">
      {/* Header */}
      <div style={{ padding: '16px 16px 0' }}>
        <button
          onClick={() => navigate(tagId ? `/plant/${tagId}` : '/checkout/scan')}
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
          {headerLabel}
        </p>
      </div>

      {/* Cart lines (multi-item) */}
      {items.length > 1 && (
        <div className="section" style={{ paddingTop: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.map((l) => (
              <div key={l.plant.stock_line_id ?? l.plant.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#374151' }}>
                <span>{l.plant.common_name ?? l.plant.species}{l.plant.current_container ? ` · ${l.plant.current_container}` : ''} × {l.quantity}</span>
                <span>${((l.plant.business_inventory?.sell_price ?? 0) * l.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transport — the three-branch radio */}
      <div className="section">
        {loading ? (
          <div className="skeleton" style={{ height: 140, borderRadius: 10 }} />
        ) : error ? (
          <p style={{ fontSize: '0.875rem', color: '#9ca3af' }}>Services unavailable — {error}</p>
        ) : choices.length === 0 ? (
          <p style={{ fontSize: '0.875rem', color: '#A32D2D' }}>
            No transport options are set up — add a delivery, planting, or self-transport service in Settings.
          </p>
        ) : (
          <>
            <TransportToggle
              choices={choices}
              roles={roles}
              selected={transportChoice}
              onChange={c => setTransportChoice(c, choiceToSelection(c, roles))}
            />
            {/* Honest note when the two correctly-ruled rows aren't both present (D-9). */}
            {roles.flags.length > 0 && (
              <p style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 8, lineHeight: 1.5 }}>
                Heads up: {roles.flags[0]}
              </p>
            )}
          </>
        )}
      </div>

      {/* Netting / compliance prompt — self-transport only (the Regina mechanic) */}
      {isSelfTransport && !loading && nettingSelection && (
        <div className="section" style={{ paddingTop: 0 }}>
          <CompliancePrompt
            title={nettingSelection.offering.compliance_title ?? 'Protective netting required'}
            body={nettingSelection.offering.compliance_body ??
              'Protective travel netting secures branches and prevents wind damage during transport.'}
            serviceNote={nettingSelection.offering.service_note ?? 'Applied by staff before you leave'}
            pricePerUnit={nettingPrice}
            unitLabel={nettingSelection.offering.price_unit === 'plant' ? 'plant' : 'unit'}
            quantity={plantCount}
            selected={nettingActive}
            onToggle={() => setNettingDeclined(nettingActive)}
          />
        </div>
      )}
      {/* Netting fallback (compliance row not yet seeded) — still offer + capture the decline */}
      {isSelfTransport && !loading && !nettingSelection && (
        <div className="section" style={{ paddingTop: 0 }}>
          <CompliancePrompt
            title="Protective netting required"
            body="Protective travel netting secures branches and prevents wind damage during transport."
            serviceNote="Applied by staff before you leave"
            pricePerUnit={nettingPrice}
            unitLabel="plant"
            quantity={plantCount}
            selected={isSelfTransport && !nettingDeclined}
            onToggle={() => setNettingDeclined(!nettingDeclined)}
          />
        </div>
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
                quantity={plantCount}
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
            <span>Plants ({plantCount})</span>
            <span>${plantSubtotal.toFixed(2)}</span>
          </div>
          {selectedTransport && transportAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
              <span>{CHOICE_META[transportChoice ?? 'delivery_only'].label.split(' — ')[0]}{selectedTransport.price_type === 'per_unit' ? ` (×${plantCount})` : ''}</span>
              <span>+${transportAmount.toFixed(2)}</span>
            </div>
          )}
          {plantingAmount > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
              <span>Planting (×{plantCount})</span>
              <span>+${plantingAmount.toFixed(2)}</span>
            </div>
          )}
          {(addonAmount + nettingFallback) > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', color: '#6b7280' }}>
              <span>Add-ons</span>
              <span>+${(addonAmount + nettingFallback).toFixed(2)}</span>
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
