interface QtySelectorProps {
  value:    number;
  max:      number;
  onChange: (qty: number) => void;
}

export function QtySelector({ value, max, onChange }: QtySelectorProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, border: '1.5px solid var(--sage-border)', borderRadius: 8, overflow: 'hidden', width: 'fit-content' }}>
      <button
        onClick={() => onChange(Math.max(1, value - 1))}
        disabled={value <= 1}
        style={{
          width: 48,
          height: 48,
          background: 'var(--white)',
          border: 'none',
          fontSize: '1.25rem',
          color: value <= 1 ? 'var(--gray-200)' : 'var(--green-primary)',
          fontWeight: 700,
        }}
        aria-label="Decrease quantity"
      >
        −
      </button>

      <div style={{
        width: 48,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: '1.125rem',
        borderLeft: '1px solid var(--sage-border)',
        borderRight: '1px solid var(--sage-border)',
        background: 'var(--sage-bg)',
      }}>
        {value}
      </div>

      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        style={{
          width: 48,
          height: 48,
          background: 'var(--white)',
          border: 'none',
          fontSize: '1.25rem',
          color: value >= max ? 'var(--gray-200)' : 'var(--green-primary)',
          fontWeight: 700,
        }}
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  );
}
