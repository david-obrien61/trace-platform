import type { ServiceOffering } from '../../types/plant';

interface Props {
  offerings: ServiceOffering[];
  selected: ServiceOffering | null;
  onChange: (offering: ServiceOffering) => void;
}

function priceLabel(o: ServiceOffering): string {
  if (o.price === 0) return '';
  if (o.price_type === 'per_unit') return ` — $${o.price.toFixed(2)}/${o.price_unit}`;
  return ` — $${o.price.toFixed(2)}`;
}

export function TransportToggle({ offerings, selected, onChange }: Props) {
  if (offerings.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p style={{
        fontSize: '0.8125rem', fontWeight: 600, color: '#4b5563',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4,
      }}>
        Transport
      </p>
      {offerings.map((opt) => {
        const isSelected = selected?.id === opt.id;
        return (
          <button
            key={opt.id}
            onClick={() => onChange(opt)}
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
            <span>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9375rem', color: '#1f2937' }}>
                {opt.name}{priceLabel(opt)}
              </span>
              {opt.description && (
                <span style={{ display: 'block', fontSize: '0.8125rem', color: '#6b7280', marginTop: 2 }}>
                  {opt.description}
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
