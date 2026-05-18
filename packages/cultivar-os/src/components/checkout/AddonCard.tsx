import type { Addon } from '../../types/plant';

interface Props {
  addon: Addon;
  selected: boolean;
  quantity: number;
  onToggle: () => void;
}

export function AddonCard({ addon, selected, quantity, onToggle }: Props) {
  const lineTotal = addon.price_per_plant * quantity;

  return (
    <button
      onClick={onToggle}
      style={{
        display: 'block',
        width: '100%',
        padding: '14px 16px',
        border: `2px solid ${selected ? '#27500A' : '#e5e7eb'}`,
        borderRadius: 10,
        background: selected ? '#f0f7ea' : '#fff',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span
          style={{
            flexShrink: 0,
            marginTop: 2,
            width: 20,
            height: 20,
            borderRadius: 4,
            border: `2px solid ${selected ? '#27500A' : '#9ca3af'}`,
            background: selected ? '#27500A' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <svg width="12" height="9" viewBox="0 0 12 9" fill="none">
              <path d="M1 4.5L4.5 8L11 1" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: '#1f2937' }}>
              {addon.name}
            </span>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: selected ? '#27500A' : '#6b7280', flexShrink: 0 }}>
              +${lineTotal.toFixed(2)}
            </span>
          </div>

          {addon.description && (
            <p style={{ fontSize: '0.8125rem', color: '#6b7280', marginTop: 3, lineHeight: 1.5 }}>
              {addon.description}
            </p>
          )}

          <p style={{ fontSize: '0.75rem', color: '#9ca3af', marginTop: 4 }}>
            ${addon.price_per_plant.toFixed(2)} × {quantity} plant{quantity !== 1 ? 's' : ''}
          </p>
        </div>
      </div>
    </button>
  );
}
