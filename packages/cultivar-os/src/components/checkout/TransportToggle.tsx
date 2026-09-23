import type { TransportChoice, TransportRoles } from '../../lib/transport';
import { choiceMeta, sameChoice } from '../../lib/transport';
import type { LadderPricing } from '@trace/shared/business-logic';

interface Props {
  choices:   TransportChoice[];        // which branches are available (resolved from roles)
  roles:     TransportRoles;           // the resolved role rows (for price hints)
  selected:  TransportChoice | null;
  onChange:  (choice: TransportChoice) => void;
  /** The ladder price for THIS cart, when planting prices per size. Null ⇒ it does not. */
  ladderPricing?: LadderPricing | null;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

// The price hint shown under each branch — composed from the SAME rows the charge uses,
// so display and charge cannot drift. Shows unit prices (delivery flat, planting per-plant);
// the ×N total is shown in the summary + CartReview.
// The price hint shown under each branch — composed from the SAME rows the charge uses, so
// display and charge cannot drift. Shows unit prices (delivery flat, planting per-plant); the ×N
// total is shown in the summary + CartReview.
//
// 🔴 A LADDER-PRICED SERVICE HAS NO UNIT PRICE TO SHOW, AND SAYING "$0.00" WOULD BE A LIE.
// When planting reads its price off the container ladder the number depends on what is in the
// cart, so the hint reports the CART'S total (already computed once, upstream, and passed in) —
// or, when a line's rung carries no price, says an amount is needed. Never a fabricated unit
// figure, never a 0 (D-9 / R-171 (c)).
function priceHint(choice: TransportChoice, roles: TransportRoles, ladderPricing: LadderPricing | null): string {
  const row = [...roles.deliveries, roles.planting, roles.fused, roles.self]
    .find(o => o && o.id === choice.transportId) ?? null;

  const plantingHint = (): string => {
    if (!ladderPricing) return roles.planting ? `${money(Number(roles.planting.price))}/plant` : '';
    if (!ladderPricing.allPriced) {
      return ladderPricing.pricedTotal > 0
        ? `${money(ladderPricing.pricedTotal)} + amount needed`
        : 'amount needed';
    }
    return money(ladderPricing.pricedTotal);
  };

  switch (choice.kind) {
    case 'delivery_planting': {
      const parts: string[] = [];
      if (row && Number(row.price) > 0) parts.push(`${money(Number(row.price))} delivery`);
      const p = plantingHint();
      if (p) parts.push(`${p} planting`);
      return parts.join(' + ');
    }
    case 'delivery_only':
      return row && Number(row.price) > 0 ? money(Number(row.price)) : 'No extra charge';
    case 'self':
      return 'No transport charge';
  }
}

export function TransportToggle({ choices, roles, selected, onChange, ladderPricing = null }: Props) {
  if (choices.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{
        fontSize: '0.8125rem', fontWeight: 600, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
      }}>
        Transport
      </p>
      {choices.map((choice) => {
        // Compared by VALUE, never by reference: `choices` is rebuilt on every render while the
        // selection is held in the cart store, so `===` would light up nothing.
        const isSelected = sameChoice(selected, choice);
        const meta = choiceMeta(choice, roles);
        const hint = priceHint(choice, roles, ladderPricing);
        return (
          <button
            key={`${choice.kind}:${choice.transportId}`}
            onClick={() => onChange(choice)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 12,
              padding: '14px 16px',
              border: `2px solid ${isSelected ? '#27500A' : '#e5e7eb'}`,
              borderRadius: 10,
              background: isSelected ? '#f0f7ea' : '#fff',
              textAlign: 'left',
              cursor: 'pointer',
              width: '100%',
            }}
          >
            <span style={{
              flexShrink: 0,
              marginTop: 2,
              width: 18,
              height: 18,
              borderRadius: '50%',
              border: `2px solid ${isSelected ? '#27500A' : '#9ca3af'}`,
              background: isSelected ? '#27500A' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              {isSelected && (
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#fff', display: 'block' }} />
              )}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1f2937' }}>
                  {meta.label}
                </span>
                {hint && (
                  <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#27500A', whiteSpace: 'nowrap' }}>
                    {hint}
                  </span>
                )}
              </span>
              <span style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>
                {meta.sub}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
