import type { TransportChoice, TransportRoles } from '../../lib/transport';
import { CHOICE_META } from '../../lib/transport';

interface Props {
  choices:   TransportChoice[];        // which branches are available (resolved from roles)
  roles:     TransportRoles;           // the resolved role rows (for price hints)
  selected:  TransportChoice | null;
  onChange:  (choice: TransportChoice) => void;
}

function money(n: number): string {
  return `$${n.toFixed(2)}`;
}

// The price hint shown under each branch — composed from the SAME rows the charge uses,
// so display and charge cannot drift. Shows unit prices (delivery flat, planting per-plant);
// the ×N total is shown in the summary + CartReview.
function priceHint(choice: TransportChoice, roles: TransportRoles): string {
  switch (choice) {
    case 'delivery_planting': {
      if (roles.delivery && roles.planting) {
        const parts: string[] = [];
        if (Number(roles.delivery.price) > 0) parts.push(`${money(Number(roles.delivery.price))} delivery`);
        parts.push(`${money(Number(roles.planting.price))}/plant planting`);
        return parts.join(' + ');
      }
      if (roles.fused) return `${money(Number(roles.fused.price))}/plant`;
      return '';
    }
    case 'delivery_only':
      return roles.delivery && Number(roles.delivery.price) > 0 ? money(Number(roles.delivery.price)) : 'No extra charge';
    case 'self':
      return 'No transport charge';
  }
}

export function TransportToggle({ choices, roles, selected, onChange }: Props) {
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
        const isSelected = selected === choice;
        const meta = CHOICE_META[choice];
        const hint = priceHint(choice, roles);
        return (
          <button
            key={choice}
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
