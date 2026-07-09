import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Minus, Plus, X } from 'lucide-react';
import { useCart } from '../hooks/useCart';
import { useSubmitOrder } from '../hooks/useSubmitOrder';
import { useBusinessContext } from '@trace/shared/context';
import { TAX_RATE } from '../lib/constants';
import { anchorKey } from '../lib/stockLinePlant';
import {
  totalPlantCount, nettedQuantity, lineSubtotal, isNettingOffering,
} from '../lib/netting';
import type { ServiceOffering } from '../types/plant';

const TRACE_CART = true; // [TRACE:CART] STD-003 — on until OWNER-PROVEN

export function CartReview() {
  const navigate = useNavigate();
  const {
    items, services, selectedTransport, plantingOffering, plantingSelected,
    nettingDeclined, customer, deliveryDate,
    setLineQty, removeLine, toggleService, setNettingDeclined, setPlantingSelected,
  } = useCart();
  const { submit, submitting, error: submitError } = useSubmitOrder();
  const { business, isOwner, can } = useBusinessContext();
  const [payOnline, setPayOnline] = useState<boolean | null>(null);

  // Owner overrides for a service's netted quantity (review-only refinement; default = the
  // attach rule's netted value). Keyed by offering id. Surface-not-silent: the rule computes
  // the proposal, the owner can adjust it here before submit (Regina Principle / D-9).
  const [serviceQty, setServiceQty] = useState<Record<string, number>>({});

  // Owner/manager PRICE overrides (attributed leakage). Keyed by offering id → { amount, reason }.
  // A give-away (e.g. planting 6×$225=$1350 → flat $1000) is honored ONLY on a token-verified
  // owner/manager path server-side (submit.ts); the public path stays server-authoritative +
  // tamper-defended. `canOverride` gates the affordance; the server independently re-verifies.
  const canOverride = isOwner || can('manage_orders');
  const [serviceOverride, setServiceOverride] = useState<Record<string, { amount: number; reason: string }>>({});
  const setOverride = (id: string, next: { amount: number; reason: string } | null) =>
    setServiceOverride(m => {
      const copy = { ...m };
      if (next) copy[id] = next; else delete copy[id];
      return copy;
    });

  const plantCount = totalPlantCount(items);
  const isSelf     = selectedTransport?.transport_mode === 'self';

  const nettingSel = services.find(s => isNettingOffering(s.offering));
  const nettingActive = isSelf && (nettingSel?.selected ?? false) && !nettingDeclined;
  const otherAddons = services.filter(
    s => s.offering.category === 'addon' && !isNettingOffering(s.offering),
  );

  // Effective quantity for a service = owner override, else the attach rule's netted value.
  const effQty = (o: ServiceOffering) => serviceQty[o.id] ?? nettedQuantity(o, plantCount);

  // ── Surface the netting engine's proposal in the trace (rule applied + resulting qty) ──
  useEffect(() => {
    if (!TRACE_CART) return;
    if (selectedTransport) {
      console.log('[TRACE:CART] netting — transport', {
        name: selectedTransport.name, rule: selectedTransport.price_type === 'per_unit' ? 'per-plant' : 'per-order',
        plantCount, qty: effQty(selectedTransport),
      });
    }
    if (nettingActive && nettingSel) {
      console.log('[TRACE:CART] netting — travel netting', { rule: 'per-plant', plantCount, qty: effQty(nettingSel.offering) });
    }
    for (const s of otherAddons) if (s.selected) {
      console.log('[TRACE:CART] netting — addon', {
        name: s.offering.name, rule: s.offering.price_type === 'per_unit' ? 'per-plant' : 'per-order',
        plantCount, qty: effQty(s.offering),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plantCount, selectedTransport, nettingActive, services, serviceQty]);

  if (items.length === 0) {
    navigate('/', { replace: true });
    return null;
  }
  if (!customer) {
    navigate('/checkout/customer', { replace: true });
    return null;
  }

  // Tax rate from the business's own setting (server recomputes from the same column).
  const taxRate = business?.tax_rate ?? TAX_RATE;

  // D-35: read sell_price (retail), NEVER unit_cost. A line with missing/0 sell_price is
  // REFUSED below rather than silently charged $0 (Surface Honesty, D-9).
  const sellPriceOf = (i: number) => items[i].plant.business_inventory?.sell_price ?? 0;
  const unpricedLine = items.findIndex((_, i) => sellPriceOf(i) <= 0);
  const noSalePrice  = unpricedLine >= 0;

  const plantSubtotal = items.reduce((sum, l) => sum + (l.plant.business_inventory?.sell_price ?? 0) * l.quantity, 0);

  // Rule-computed (baseline) amount for a service, and the EFFECTIVE amount = owner override
  // (if set) else the baseline. leakage = baseline − override (surfaced in the row + server).
  const computedAmt = (o: ServiceOffering) => lineSubtotal(o, effQty(o));
  const effAmt = (o: ServiceOffering, computed: number) => serviceOverride[o.id]?.amount ?? computed;

  const plantingOn = plantingSelected && !!plantingOffering;

  const transportComputed = selectedTransport ? computedAmt(selectedTransport) : 0;
  const plantingComputed  = plantingOn && plantingOffering ? computedAmt(plantingOffering) : 0;
  const nettingComputed   = nettingActive && nettingSel ? computedAmt(nettingSel.offering) : 0;

  const transportAmount = selectedTransport ? effAmt(selectedTransport, transportComputed) : 0;
  const plantingTotal   = plantingOn && plantingOffering ? effAmt(plantingOffering, plantingComputed) : 0;
  const nettingTotal    = nettingActive && nettingSel ? effAmt(nettingSel.offering, nettingComputed) : 0;
  const otherTotal      = otherAddons.filter(s => s.selected)
    .reduce((sum, s) => sum + effAmt(s.offering, computedAmt(s.offering)), 0);

  const addonsAmount = transportAmount + plantingTotal + nettingTotal + otherTotal;
  const subtotal     = plantSubtotal + addonsAmount;
  const taxAmount    = Math.round(subtotal * taxRate * 100) / 100;
  const total        = subtotal + taxAmount;

  function setQty(o: ServiceOffering, qty: number) {
    const next = Math.max(1, qty);
    if (TRACE_CART) console.log('[TRACE:CART] review adjust — service qty', { offering: o.name, qty: next });
    setServiceQty(m => ({ ...m, [o.id]: next }));
  }

  async function handleSubmit(online: boolean) {
    setPayOnline(online);
    // Build the owner-confirmed service quantities (only INCLUDED services), keyed by id.
    const serviceQuantities: Record<string, number> = {};
    if (selectedTransport) serviceQuantities[selectedTransport.id] = effQty(selectedTransport);
    if (plantingOn && plantingOffering) serviceQuantities[plantingOffering.id] = effQty(plantingOffering);
    if (nettingActive && nettingSel) serviceQuantities[nettingSel.offering.id] = effQty(nettingSel.offering);
    for (const s of otherAddons) if (s.selected) serviceQuantities[s.offering.id] = effQty(s.offering);

    // Real service lines for the receipt (Confirmation) — itemized by the offering's REAL name
    // (service_offerings.name), NEVER a CHOICE_META branch label (H3/H6). Amounts are the same
    // effective values shown here (owner overrides included). One source, no drift.
    const serviceLines: { name: string; amount: number }[] = [];
    if (selectedTransport) serviceLines.push({ name: selectedTransport.name, amount: transportAmount });
    if (plantingOn && plantingOffering) serviceLines.push({ name: plantingOffering.name, amount: plantingTotal });
    if (nettingActive && nettingSel) serviceLines.push({ name: nettingSel.offering.name, amount: nettingTotal });
    for (const s of otherAddons) if (s.selected) serviceLines.push({ name: s.offering.name, amount: effAmt(s.offering, computedAmt(s.offering)) });

    // Owner/manager price overrides for the honored path — only for services actually in the order.
    const activeIds = new Set<string>([
      ...(selectedTransport ? [selectedTransport.id] : []),
      ...(plantingOn && plantingOffering ? [plantingOffering.id] : []),
      ...(nettingActive && nettingSel ? [nettingSel.offering.id] : []),
      ...otherAddons.filter(s => s.selected).map(s => s.offering.id),
    ]);
    const serviceOverrides: Record<string, { amount: number; reason: string }> = {};
    for (const [id, ov] of Object.entries(serviceOverride)) {
      if (activeIds.has(id)) serviceOverrides[id] = ov;
    }

    if (TRACE_CART) console.log('[TRACE:CART] submit — handoff to checkout tail', {
      lineCount: items.length, plantCount, serviceQuantities, serviceLines,
      overrides: Object.keys(serviceOverrides).length,
      anchors: items.map(l => anchorKey(l.plant)),
    });

    try {
      const result = await submit({
        customer: customer!,
        lines: items.map(l => ({ plant: l.plant, quantity: l.quantity })),
        services,
        selectedTransport,
        plantingOffering: plantingOn ? plantingOffering : null,
        plantingSelected: plantingOn,
        nettingDeclined,
        serviceQuantities,
        serviceOverrides,
        deliveryDate,
        businessId: items[0].plant.business_id,
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
          transportMode:   selectedTransport?.transport_mode ?? 'self',
          transportName:   selectedTransport?.name ?? null,
          serviceLines,
          businessName:    business?.name ?? null,
          nettingActive,
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
        <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 4 }}>
          {items.length} item{items.length !== 1 ? 's' : ''} · {plantCount} plant{plantCount !== 1 ? 's' : ''} — adjust anything before you send it.
        </p>
      </div>

      {/* Order lines — editable */}
      <div className="section">
        <p style={{
          fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
        }}>
          Plants
        </p>

        {items.map((l, i) => {
          const key = anchorKey(l.plant);
          const price = sellPriceOf(i);
          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: '0.9375rem', color: '#1f2937', fontWeight: 600, margin: 0 }}>
                  {l.plant.common_name ?? l.plant.species}
                </p>
                <p style={{ fontSize: '0.75rem', color: price <= 0 ? '#A32D2D' : '#6b7280', margin: '2px 0 0' }}>
                  {l.plant.current_container ? `${l.plant.current_container} · ` : ''}
                  {price > 0 ? `$${price.toFixed(2)} each` : 'No price set'}
                </p>
              </div>
              <Stepper value={l.quantity} onChange={q => setLineQty(key, q)} min={1} />
              <span style={{ width: 68, textAlign: 'right', fontWeight: 600, fontSize: '0.9375rem', color: '#374151' }}>
                ${(price * l.quantity).toFixed(2)}
              </span>
              {items.length > 1 && (
                <button onClick={() => removeLine(key)} aria-label="Remove" style={iconBtn}>
                  <X size={16} color="#9ca3af" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Services — netted proposal, editable */}
      <div className="section" style={{ paddingTop: 0 }}>
        <p style={{
          fontSize: '0.75rem', fontWeight: 600, color: '#9ca3af',
          textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
        }}>
          Services
        </p>

        {/* Transport */}
        {selectedTransport && (
          <ServiceRow
            name={selectedTransport.name}
            rule={selectedTransport.price_type === 'per_unit' ? `per plant · ×${effQty(selectedTransport)}` : 'per order · ×1'}
            amount={transportAmount}
            editable={selectedTransport.price_type === 'per_unit' || Number(selectedTransport.price) > 0}
            qty={effQty(selectedTransport)}
            onQty={selectedTransport.price_type === 'per_unit' ? (q => setQty(selectedTransport, q)) : undefined}
            included
            canOverride={canOverride}
            baseline={transportComputed}
            override={serviceOverride[selectedTransport.id]}
            onOverride={next => setOverride(selectedTransport.id, next)}
          />
        )}

        {/* Planting — the separate per-plant service attached by the "Delivery + planting" branch */}
        {plantingOffering && (
          plantingOn ? (
            <ServiceRow
              name={plantingOffering.name}
              rule={`per plant · ×${effQty(plantingOffering)}`}
              amount={plantingTotal}
              editable
              qty={effQty(plantingOffering)}
              onQty={q => setQty(plantingOffering, q)}
              included
              onToggle={() => setPlantingSelected(false)}
              canOverride={canOverride}
              baseline={plantingComputed}
              override={serviceOverride[plantingOffering.id]}
              onOverride={next => setOverride(plantingOffering.id, next)}
            />
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={() => setPlantingSelected(true)} style={linkBtn}>+ Add {plantingOffering.name}</button>
              <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                ${Number(plantingOffering.price).toFixed(2)}/plant
              </span>
            </div>
          )
        )}

        {/* Netting (self-transport only) — include/decline toggle */}
        {isSelf && nettingSel && (
          nettingActive ? (
            <ServiceRow
              name={nettingSel.offering.name}
              rule={`per plant · ×${effQty(nettingSel.offering)}`}
              amount={nettingTotal}
              editable
              qty={effQty(nettingSel.offering)}
              onQty={q => setQty(nettingSel.offering, q)}
              included
              onToggle={() => { setNettingDeclined(true); }}
              canOverride={canOverride}
              baseline={nettingComputed}
              override={serviceOverride[nettingSel.offering.id]}
              onOverride={next => setOverride(nettingSel.offering.id, next)}
            />
          ) : (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9375rem', color: '#9ca3af' }}>
                <button onClick={() => setNettingDeclined(false)} style={{ ...linkBtn, color: '#92400e' }}>
                  + Add travel netting
                </button>
                <span>$0.00</span>
              </div>
              <p style={{ fontSize: '0.75rem', color: '#92400e', marginTop: 2 }}>
                Netting declined — customer acknowledged TX TCC Ch.725
              </p>
            </div>
          )
        )}

        {/* Other add-ons — toggle include + qty */}
        {otherAddons.map(s => (
          s.selected ? (
            <ServiceRow
              key={s.offering.id}
              name={s.offering.name}
              rule={s.offering.price_type === 'per_unit' ? `per plant · ×${effQty(s.offering)}` : 'per order · ×1'}
              amount={effAmt(s.offering, computedAmt(s.offering))}
              editable={s.offering.price_type === 'per_unit'}
              qty={effQty(s.offering)}
              onQty={s.offering.price_type === 'per_unit' ? (q => setQty(s.offering, q)) : undefined}
              included
              onToggle={() => toggleService(s.offering.id)}
              canOverride={canOverride}
              baseline={computedAmt(s.offering)}
              override={serviceOverride[s.offering.id]}
              onOverride={next => setOverride(s.offering.id, next)}
            />
          ) : (
            <div key={s.offering.id} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <button onClick={() => toggleService(s.offering.id)} style={linkBtn}>+ Add {s.offering.name}</button>
              <span style={{ fontSize: '0.875rem', color: '#9ca3af' }}>
                ${Number(s.offering.price).toFixed(2)}{s.offering.price_type === 'per_unit' ? '/plant' : ''}
              </span>
            </div>
          )
        ))}

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
        {customer.address_line1 && (
          <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: 2 }}>
            {customer.address_line1}{customer.city ? `, ${customer.city}` : ''}{customer.state ? ` ${customer.state}` : ''}{customer.zip ? ` ${customer.zip}` : ''}
          </p>
        )}
        {deliveryDate && (
          <p style={{ fontSize: '0.875rem', color: '#27500A', fontWeight: 600, marginTop: 6 }}>
            Delivery: {new Date(`${deliveryDate}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
      </div>

      {/* No-sale-price refusal (Surface Honesty, D-9) — block, don't silently sell at $0 */}
      {noSalePrice && (
        <div style={{ margin: '0 16px', padding: '10px 14px', background: '#fff3f3', border: '1.5px solid #A32D2D', borderRadius: 8 }}>
          <p style={{ fontSize: '0.875rem', color: '#7f1d1d', fontWeight: 600 }}>
            No sale price set for {items[unpricedLine].plant.common_name ?? items[unpricedLine].plant.species} — set a price in Inventory before selling.
          </p>
        </div>
      )}

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
          disabled={submitting || noSalePrice}
          onClick={() => handleSubmit(true)}
        >
          {submitting && payOnline ? 'Sending…' : `Send invoice + pay online — $${total.toFixed(2)}`}
        </button>
        <button
          className="btn btn-secondary"
          disabled={submitting || noSalePrice}
          onClick={() => handleSubmit(false)}
        >
          {submitting && !payOnline ? 'Creating order…' : "I'll pay at the office"}
        </button>
      </div>
    </div>
  );
}

// ── Small building blocks ──────────────────────────────────────────────────
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' };
const linkBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#27500A', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer', padding: 0 };

function Stepper({ value, onChange, min = 0 }: { value: number; onChange: (v: number) => void; min?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: 2 }}>
      <button onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease" style={{ ...iconBtn, padding: 4 }}>
        <Minus size={15} color="#374151" />
      </button>
      <span style={{ minWidth: 22, textAlign: 'center', fontWeight: 700, fontSize: '0.9375rem', color: '#1f2937' }}>{value}</span>
      <button onClick={() => onChange(value + 1)} aria-label="Increase" style={{ ...iconBtn, padding: 4 }}>
        <Plus size={15} color="#374151" />
      </button>
    </div>
  );
}

function ServiceRow({
  name, rule, amount, editable, qty, onQty, included, onToggle,
  canOverride, baseline, override, onOverride,
}: {
  name: string; rule: string; amount: number; editable: boolean;
  qty: number; onQty?: (q: number) => void; included: boolean; onToggle?: () => void;
  // Owner/manager price override (attributed leakage). canOverride gates the affordance;
  // baseline = rule-computed amount; override = current {amount, reason}; onOverride persists it.
  canOverride?: boolean; baseline?: number;
  override?: { amount: number; reason: string };
  onOverride?: (next: { amount: number; reason: string } | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draftAmt, setDraftAmt]     = useState<string>(String(override?.amount ?? amount ?? 0));
  const [draftReason, setDraftReason] = useState<string>(override?.reason ?? '');
  const isOverridden = !!override;
  const base = baseline ?? amount;
  const leak = isOverridden ? Math.max(0, base - override!.amount) : 0;

  function openEditor() {
    setDraftAmt(String(override?.amount ?? base ?? 0));
    setDraftReason(override?.reason ?? '');
    setEditing(true);
  }
  function saveEditor() {
    const val = Math.max(0, parseFloat(draftAmt) || 0);
    onOverride?.({ amount: val, reason: draftReason.trim() });
    setEditing(false);
  }
  function clearEditor() {
    onOverride?.(null);
    setEditing(false);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: '0.9375rem', color: '#1f2937', margin: 0 }}>
            {included ? '✓ ' : ''}{name}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '2px 0 0' }}>{rule}</p>
          {canOverride && onOverride && !editing && (
            <button onClick={openEditor} style={{ ...linkBtn, fontSize: '0.75rem', marginTop: 2 }}>
              {isOverridden ? 'Edit price' : 'Adjust price'}
            </button>
          )}
          {isOverridden && leak > 0 && (
            <p style={{ fontSize: '0.75rem', color: '#92400e', margin: '2px 0 0' }}>
              −${leak.toFixed(2)} off ${base.toFixed(2)}{override!.reason ? ` · ${override!.reason}` : ''}
            </p>
          )}
        </div>
        {editable && onQty && !isOverridden && (
          <Stepper value={qty} onChange={onQty} min={1} />
        )}
        <span style={{ width: 68, textAlign: 'right', fontWeight: 500, fontSize: '0.9375rem', color: isOverridden ? '#92400e' : '#374151' }}>
          {amount > 0 ? `$${amount.toFixed(2)}` : '—'}
        </span>
        {onToggle && (
          <button onClick={onToggle} aria-label="Remove service" style={iconBtn}>
            <X size={16} color="#9ca3af" />
          </button>
        )}
      </div>

      {/* Owner/manager price-override editor (leakage capture) */}
      {editing && (
        <div style={{ marginTop: 8, padding: '10px 12px', background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.8125rem', color: '#78350f', fontWeight: 600 }}>Set price</span>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: '#92400e', fontWeight: 700 }}>$</span>
              <input
                type="number" inputMode="decimal" step="0.01" min="0" value={draftAmt}
                onChange={e => setDraftAmt(e.target.value)}
                style={{ width: '100%', padding: '8px 8px 8px 20px', border: '1.5px solid #fcd34d', borderRadius: 6, fontSize: '0.9375rem', boxSizing: 'border-box' }}
              />
            </div>
          </div>
          <input
            type="text" value={draftReason}
            onChange={e => setDraftReason(e.target.value)}
            placeholder="Reason (e.g. loyal contractor)"
            style={{ padding: '8px 10px', border: '1.5px solid #fcd34d', borderRadius: 6, fontSize: '0.875rem', boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: '0.75rem', color: '#92400e', margin: 0 }}>
            Baseline ${base.toFixed(2)} · giving away ${Math.max(0, base - (parseFloat(draftAmt) || 0)).toFixed(2)}
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={saveEditor} className="btn btn-primary" style={{ minHeight: 40, flex: 1, fontSize: '0.875rem' }}>Apply</button>
            {isOverridden && (
              <button onClick={clearEditor} className="btn btn-secondary" style={{ minHeight: 40, fontSize: '0.875rem' }}>Reset to ${base.toFixed(2)}</button>
            )}
            <button onClick={() => setEditing(false)} className="btn btn-secondary" style={{ minHeight: 40, fontSize: '0.875rem' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
