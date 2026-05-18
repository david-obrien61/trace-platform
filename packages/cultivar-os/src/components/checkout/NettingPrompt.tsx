interface Props {
  selected: boolean;
  onToggle: () => void;
  pricePerPlant: number;
  quantity: number;
}

export function NettingPrompt({ selected, onToggle, pricePerPlant, quantity }: Props) {
  const total = pricePerPlant * quantity;

  return (
    <button
      onClick={onToggle}
      style={{
        display: 'block',
        width: '100%',
        padding: '16px',
        border: '3px solid #A32D2D',
        borderRadius: 12,
        background: '#fffbeb',
        textAlign: 'left',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span
          style={{
            flexShrink: 0,
            marginTop: 2,
            width: 22,
            height: 22,
            borderRadius: 4,
            border: `2.5px solid ${selected ? '#A32D2D' : '#9ca3af'}`,
            background: selected ? '#A32D2D' : '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {selected && (
            <svg width="13" height="10" viewBox="0 0 13 10" fill="none">
              <path d="M1.5 5L5 8.5L11.5 1.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontSize: '1.125rem' }}>⚠️</span>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#7f1d1d' }}>
              Netting required for transport
            </span>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#92400e', lineHeight: 1.5 }}>
            Texas law requires trees in open trucks to be secured. We wrap your plant(s) before you leave — this protects both the plant and other drivers.
          </p>
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7f1d1d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {selected ? 'Added' : 'Tap to add'}
            </span>
            <span style={{ fontWeight: 700, fontSize: '1rem', color: '#7f1d1d' }}>
              +${total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
