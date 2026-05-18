interface Props {
  selected: boolean;
  onToggle: () => void;
  pricePerPlant: number;
  quantity: number;
}

export function NettingPrompt({ selected, onToggle, pricePerPlant, quantity }: Props) {
  const total = pricePerPlant * quantity;

  return (
    <div
      style={{
        border: '3px solid #A32D2D',
        borderRadius: 12,
        background: '#fffbeb',
        padding: '16px',
      }}
    >
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>⚠️</span>
        <span style={{ fontWeight: 700, fontSize: '1rem', color: '#7f1d1d', lineHeight: 1.3 }}>
          Texas law requires securing your load
        </span>
      </div>

      {/* Body */}
      <p style={{ fontSize: '0.875rem', color: '#92400e', lineHeight: 1.6, marginBottom: 12 }}>
        Under Texas Transportation Code Chapter 725, unsecured loads that can blow or spill from a
        vehicle are a misdemeanor — fines from $25 to $500. A 30-gallon tree extending above your
        truck bed qualifies. Our protective travel netting secures branches, prevents wind damage,
        and keeps you legal on the drive home.
      </p>

      {/* Price line */}
      <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#7f1d1d', marginBottom: 14 }}>
        $10 per tree — applied by staff before you leave
      </p>

      {/* Primary action */}
      <button
        onClick={() => { if (!selected) onToggle(); }}
        style={{
          display: 'block',
          width: '100%',
          minHeight: 48,
          padding: '12px 20px',
          border: selected ? 'none' : '2px solid #27500A',
          borderRadius: 8,
          background: selected ? '#27500A' : '#fff',
          color: selected ? '#fff' : '#27500A',
          fontSize: '1rem',
          fontWeight: 700,
          cursor: selected ? 'default' : 'pointer',
          textAlign: 'center',
        }}
      >
        {selected ? `✓ Netting added — $${total.toFixed(2)}` : `Yes — add netting ($${total.toFixed(2)})`}
      </button>

      {/* Decline link */}
      <div style={{ textAlign: 'center', marginTop: 10 }}>
        {selected ? (
          <button
            onClick={() => onToggle()}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.8125rem',
              color: '#9ca3af',
              cursor: 'pointer',
              padding: '4px 0',
              textDecoration: 'underline',
              textDecorationColor: '#d1d5db',
            }}
          >
            I understand the risk — no thanks
          </button>
        ) : (
          <p style={{ fontSize: '0.8125rem', color: '#92400e', fontStyle: 'italic', padding: '4px 0' }}>
            No netting added. Drive carefully and secure your load.
          </p>
        )}
      </div>
    </div>
  );
}
